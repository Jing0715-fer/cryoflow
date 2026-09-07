/**
 * CryoFlow — HPC / Slurm integration (server only).
 *
 * DESIGN (three layers):
 *   1. ExecutionBackend abstraction: today the engine spawns local binaries;
 *      a Slurm backend wraps the SAME argv (engine buildArgv) into an
 *      sbatch submission — the workflow graph, params, inputs and progress
 *      machinery are backend-agnostic.
 *   2. GPU-aware scheduling: each job type declares a GPU strategy —
 *      data-parallel ARRAY splitting (motioncorr/ctffind per-micrograph),
 *      single-job MULTI-GPU (RELION class2d/class3d/refine3d split
 *      particles across `mpirun -n N` ranks pinned to GPUs), or
 *      single-GPU (topaz train, autopick), or CPU-only.
 *   3. Monitoring & lifecycle: sbatch returns a cluster JobID; the
 *      RunRecord is extended with scheduler fields (slurmId, state,
 *      array progress) polled via squeue/sacct; scancel wires into the
 *      existing stopRun; --requeue + RELION --continue give fault
 *      tolerance.
 *
 * In-sandbox reality: no Slurm controller exists here, so submission runs
 * in DRY-RUN mode — the generator still produces the exact script (real
 * argv from the live job graph, translated onto cluster paths) plus a
 * queue SIMULATION of the whole project so the scheduling behaviour is
 * observable without a cluster.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { EngineJobRef, UpstreamRef } from "../relion/engine";
import { buildArgv, resolveInputs } from "../relion/engine";

/* ------------------------------------------------------------------ */
/* Cluster profiles                                                    */
/* ------------------------------------------------------------------ */

export interface SlurmProfile {
  id: string;
  name: string;
  /** Submit host — null = submit locally (slurm client on this machine). */
  host: string | null;
  partition: string;
  account: string | null;
  qos: string | null;
  /** Walltime cap in minutes. */
  timeLimitMin: number;
  nodes: number;
  gpusPerNode: number;
  gpuModel: "A100" | "H100" | "V100" | "RTX4090";
  /** Cluster-side RELION install root (module dir or /opt). */
  relionHome: string;
  /** Cluster-side project data root (shared FS: Lustre/NFS/GPFS). */
  dataRoot: string;
  /** Local project data root that maps onto dataRoot (path translation). */
  localRoot: string;
  /** Environment prep lines (module loads / conda activate / exports). */
  envLines: string[];
  /** ctffind path on the cluster. */
  ctffind: string | null;
  /** Max concurrent array elements (Slurm %N throttle). */
  arrayConcurrency: number;
  /** Simulated GPU speed multiplier vs the sandbox (for the simulator). */
  gpuSpeedup: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILE_FILE = path.join(DATA_DIR, "hpc-profiles.json");

export function defaultProfiles(): SlurmProfile[] {
  return [
    {
      id: "local-workstation",
      name: "Local workstation (this machine)",
      host: null,
      partition: "none",
      account: null,
      qos: null,
      timeLimitMin: 0,
      nodes: 1,
      gpusPerNode: 0,
      gpuModel: "RTX4090",
      relionHome: "",
      dataRoot: "",
      localRoot: path.join(process.cwd(), "data", "relion"),
      envLines: [],
      ctffind: null,
      arrayConcurrency: 1,
      gpuSpeedup: 1,
    },
    {
      id: "slurm-gpu-cluster",
      name: "Slurm GPU cluster (example: 4×A100 partition)",
      host: "login.hpc.example.org",
      partition: "gpu",
      account: "cryo-em",
      qos: "normal",
      timeLimitMin: 720,
      nodes: 4,
      gpusPerNode: 4,
      gpuModel: "A100",
      relionHome: "/opt/relion/5.0.1",
      dataRoot: "/lustre/project/cryoflow",
      localRoot: path.join(process.cwd(), "data", "relion"),
      envLines: [
        "module purge",
        "module load relion/5.0.1 cuda/12.2",
        "module load ctffind/4.1.14",
        "# topaz jobs also run: source ~/miniconda3/etc/profile.d/conda.sh && conda activate topaz",
      ],
      ctffind: "/opt/ctffind/4.1.14/bin/ctffind",
      arrayConcurrency: 16,
      gpuSpeedup: 25,
    },
    {
      id: "slurm-h100-hub",
      name: "Slurm H100 hub (2×8 GPU, burst queue)",
      host: "h100.hub.example.org",
      partition: "burst",
      account: "structural-bio",
      qos: "burst",
      timeLimitMin: 1440,
      nodes: 2,
      gpusPerNode: 8,
      gpuModel: "H100",
      relionHome: "/shared/relion/5.0.1",
      dataRoot: "/nfs/project/cryoflow",
      localRoot: path.join(process.cwd(), "data", "relion"),
      envLines: [
        "module load singularity",
        "singularity exec --bind /nfs relion_5.0.1_cuda.sif bash -c 'module load cuda'",
      ],
      ctffind: "/shared/ctffind-4.1.14/bin/ctffind",
      arrayConcurrency: 32,
      gpuSpeedup: 40,
    },
  ];
}

export function loadProfiles(): SlurmProfile[] {
  try {
    if (existsSync(PROFILE_FILE)) {
      return JSON.parse(readFileSync(PROFILE_FILE, "utf8")) as SlurmProfile[];
    }
  } catch {
    /* fall through to defaults */
  }
  return defaultProfiles();
}

export function saveProfiles(profiles: SlurmProfile[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PROFILE_FILE, JSON.stringify(profiles, null, 2));
}

/* ------------------------------------------------------------------ */
/* GPU scheduling strategy per job type                                */
/* ------------------------------------------------------------------ */

export type GpuMode = "array" | "multi-gpu" | "single" | "cpu";

export interface GpuStrategy {
  mode: GpuMode;
  /** GPUs per array element (array) or per job (single/multi-gpu). */
  gpus: number;
  /** Array shard count for data-parallel types (0 = not array). */
  shards: number;
  /** Minutes per shard (array) or per job — used by the simulator. */
  minutes: number;
  reason: string;
}

const MULTI_GPU_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel", "multibody"]);
const SINGLE_GPU_TYPES = new Set(["topaztrain", "dynamight", "modelangelo", "tomo_ctfrefine", "tomo_polish"]);
const CPU_TYPES = new Set([
  "import", "manualpick", "select", "select2d", "joinstar", "symexpand",
  "rebalance", "maskcreate", "postprocess", "localres", "polish", "ctfrefine",
  "subtract", "external", "tomo_import", "tomo_exclude", "tomo_picks",
]);

/**
 * Strategy for a job type. `micrographCount`/`particleCount` drive array
 * shard counts and run-time estimates (simulator).
 */
export function gpuStrategyFor(
  type: string,
  opts: { micrographs?: number; particles?: number; gpus?: number } = {}
): GpuStrategy {
  const mics = Math.max(1, opts.micrographs ?? 10);
  const parts = Math.max(1, opts.particles ?? 5000);
  const gpus = Math.max(1, opts.gpus ?? 2);
  if (MULTI_GPU_TYPES.has(type)) {
    return {
      mode: "multi-gpu", gpus: Math.max(2, gpus), shards: 0,
      minutes: type === "refine3d" ? 45 + parts / 2000 : type === "class3d" ? 30 : 20,
      reason:
        "RELION splits particles across MPI ranks pinned to GPUs — ONE job, N GPUs " +
        "(`mpirun -n N relion_refine … --gpu 0:1:…`). Splitting the dataset instead " +
        "would break global alignment statistics (FSC halves, class occupancies).",
    };
  }
  if (SINGLE_GPU_TYPES.has(type)) {
    return {
      mode: "single", gpus: 1, shards: 0,
      minutes: type === "topaztrain" ? 30 : 20,
      reason:
        type === "topaztrain"
          ? "Topaz CNN training is data-parallel but converges on ONE GPU " +
            "(multi-GPU would need DDP — keep it simple, one GPU per training job)."
          : "External deep-learning step — single GPU job, one per model.",
    };
  }
  const isAutoPick = type === "autopick";
  if (type === "motioncorr" || type === "ctffind" || type === "extract" || isAutoPick ||
      type.startsWith("tomo_aligntiltseries") || type === "tomo_tomograms" ||
      type === "tomo_reconstruct" || type === "tomo_extract" || type === "tomo_denoise") {
    const shards = Math.min(mics, 64);
    const perShard = type === "motioncorr" ? 4 : type === "ctffind" ? 1 : 0.5;
    return {
      mode: "array",
      gpus: type === "motioncorr" || isAutoPick ? 1 : 0,
      shards,
      minutes: Math.max(1, Math.round((mics / shards) * perShard * 2)),
      reason:
        "Embarrassingly parallel per micrograph — sbatch --array=1-" +
        shards +
        " launches independent shards (capped by %N concurrency); failure of one " +
        "shard never poisons the rest, and --dependency=afterok chains the merge.",
    };
  }
  const heavy = type === "polish" || type === "ctfrefine" || type === "localres" || type === "postprocess";
  return {
    mode: "cpu", gpus: 0, shards: 0,
    minutes: heavy ? 10 : 1,
    reason:
      "CPU-bound bookkeeping / postprocessing — runs on the batch partition; " +
      "no GPU allocation (frees the GPU queue for the classification jobs).",
  };
}

/* ------------------------------------------------------------------ */
/* Path translation                                                    */
/* ------------------------------------------------------------------ */

export function translatePath(local: string, profile: SlurmProfile): string {
  if (profile.id === "local-workstation" || !profile.dataRoot) return local;
  const norm = local.split(path.sep).join("/");
  const root = profile.localRoot.split(path.sep).join("/").replace(/\/$/, "");
  if (norm.startsWith(root)) {
    return profile.dataRoot.replace(/\/$/, "") + norm.slice(root.length);
  }
  return norm;
}

/* ------------------------------------------------------------------ */
/* SBATCH generation                                                   */
/* ------------------------------------------------------------------ */

export interface SbatchResult {
  script: string;
  strategy: GpuStrategy;
  argv: string[];
  slurmNotes: string[];
  error?: string;
}

function hms(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
}

function shellQuote(a: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a)) return a;
  return "'" + a.replace(/'/g, "'\\''") + "'";
}

/**
 * Generate a submission-ready SBATCH script for a concrete job in the
 * graph. The argv is the engine's REAL command (same builder the local
 * runner uses), with paths translated onto the cluster profile.
 */
export async function buildSbatchForJob(args: {
  job: EngineJobRef & { name?: string | null };
  upstream: UpstreamRef[];
  profile: SlurmProfile;
  localWorkdir: string;
  clusterWorkdir: string;
  micrographs?: number;
  particles?: number;
}): Promise<SbatchResult> {
  const { job, upstream, profile, clusterWorkdir } = args;
  const strategy = gpuStrategyFor(job.type, {
    micrographs: args.micrographs,
    particles: args.particles,
  });

  const r = resolveInputs(job.type, upstream, job.params as Record<string, unknown>);
  if (r.missing) {
    return { script: "", strategy, argv: [], slurmNotes: [], error: r.missing };
  }
  const inputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.inputs)) inputs[k] = translatePath(v, profile);

  const clusterBin = profile.relionHome ? path.posix.join(profile.relionHome, "bin") : "/opt/relion/5.0.1/bin";
  const ctx = {
    binDir: clusterBin,
    workdir: clusterWorkdir,
    inputs,
    job,
    upstream,
    bridge: null,
  } as unknown as Parameters<typeof buildArgv>[0];

  const built = await buildArgv(ctx);
  if (!Array.isArray(built)) {
    const err = built as { error: string };
    return { script: "", strategy, argv: [], slurmNotes: [], error: err.error };
  }
  const argv = built as string[];

  const threads = (() => {
    const p = job.params as Record<string, unknown> | null;
    const t = Number(p?.threads ?? p?.j ?? 4);
    return Number.isFinite(t) && t > 0 ? Math.min(32, Math.round(t)) : 4;
  })();

  const jobName = `cf_${job.type}_${(job.id ?? "job").slice(-8)}`;
  const logDir = `${clusterWorkdir}/logs`;
  const params = (job.params ?? {}) as Record<string, unknown>;
  const isTopaz =
    job.type === "topaztrain" ||
    String(params.pickingMethod ?? "").toLowerCase().includes("topaz");

  const L: string[] = [];
  L.push("#!/bin/bash");
  L.push(`# CryoFlow HPC submission — job "${job.name ?? job.type}" (${job.type})`);
  L.push(`# generated ${new Date().toISOString()}`);
  L.push(`#SBATCH --job-name=${jobName}`);
  if (profile.partition && profile.partition !== "none") L.push(`#SBATCH --partition=${profile.partition}`);
  if (profile.account) L.push(`#SBATCH --account=${profile.account}`);
  if (profile.qos) L.push(`#SBATCH --qos=${profile.qos}`);
  L.push(`#SBATCH --nodes=1`);
  L.push(`#SBATCH --ntasks=1`);
  L.push(`#SBATCH --cpus-per-task=${threads}`);
  L.push(`#SBATCH --mem=${strategy.mode === "array" && strategy.gpus === 0 ? 16 : 64}G`);
  if (profile.timeLimitMin > 0) L.push(`#SBATCH --time=${hms(profile.timeLimitMin)}`);
  if (strategy.gpus > 0 && profile.partition !== "none") {
    L.push(`#SBATCH --gres=gpu:${profile.gpuModel.toLowerCase()}:${strategy.gpus}`);
  }
  if (strategy.mode === "array" && strategy.shards > 1) {
    L.push(`#SBATCH --array=1-${strategy.shards}%${profile.arrayConcurrency}`);
    L.push("#SBATCH --requeue");
  }
  L.push(`#SBATCH --output=${logDir}/%x-%j.out`);
  L.push(`#SBATCH --error=${logDir}/%x-%j.err`);
  L.push("");
  L.push("set -euo pipefail");
  L.push(`mkdir -p "${clusterWorkdir}" "${logDir}"`);
  for (const line of profile.envLines) L.push(line);
  if (isTopaz && !profile.envLines.some((l) => l.includes("conda"))) {
    L.push("source ~/miniconda3/etc/profile.d/conda.sh && conda activate topaz");
  }
  if (profile.ctffind) L.push(`export RELION_CTFFIND_EXECUTABLE=${profile.ctffind}`);
  L.push(`export RELION_HOME=${profile.relionHome}`);
  L.push(`export PATH=$RELION_HOME/bin:$PATH`);
  L.push(`export OMPI_MCA_btl=self,tcp   # WSL2/cluster-safe MPI transport`);
  L.push("");
  if (strategy.mode === "array" && strategy.shards > 1) {
    L.push("# ---- array shard: slice the micrograph STAR by SLURM_ARRAY_TASK_ID ----");
    L.push(`SHARD="${clusterWorkdir}/shard_$SLURM_ARRAY_TASK_ID.star"`);
    L.push(`INPUT_STAR="${inputs.micrographs_star ?? inputs.particles_star ?? "$1"}"`);
    L.push(`awk -v s=$SLURM_ARRAY_TASK_ID -v n=${strategy.shards} '`);
    L.push("  /^data_/{block++; print; next}");
    L.push("  block>=2 && NF>3 && $1 !~ /^#/{ if(idx % n == s-1) print; idx++ }");
    L.push("  { if(block<2) print }");
    L.push(`' "$INPUT_STAR" > "$SHARD" 2>/dev/null || cp "$INPUT_STAR" "$SHARD"`);
    L.push("");
  }
  L.push(`cd "${clusterWorkdir}"`);
  L.push("");
  if (strategy.mode === "multi-gpu") {
    const gpuList = Array.from({ length: strategy.gpus }, (_, i) => i).join(":");
    L.push("# RELION multi-GPU: one MPI rank per GPU (rank r pinned to GPU r)");
    L.push(`mpirun -n ${strategy.gpus} \\`);
    L.push("  " + argv.map(shellQuote).join(" \\\n  "));
    L.push(`  --gpu ${gpuList}`);
  } else if (strategy.gpus >= 1) {
    L.push(argv.map(shellQuote).join(" \\\n  ") + " \\");
    L.push("  --gpu 0");
  } else {
    L.push(argv.map(shellQuote).join(" \\\n  "));
  }
  L.push("");
  L.push(`echo "CryoFlow job ${jobName} finished at $(date)"`);
  L.push("# submit with dependency chaining (example):");
  L.push(`#   sbatch --dependency=afterok:<upstream_slurm_id> ${jobName}.sbatch`);

  const notes = [
    strategy.reason,
    strategy.mode === "array"
      ? `Array mode: ${strategy.shards} independent shards, concurrency capped at ${profile.arrayConcurrency} (Slurm backfills the rest).`
      : strategy.mode === "multi-gpu"
        ? `Multi-GPU mode: ${strategy.gpus} × ${profile.gpuModel} in ONE job (RELION splits particles across MPI ranks).`
        : strategy.mode === "single"
          ? "Single-GPU mode: one exclusive GPU for the deep-learning step."
          : "CPU mode: batch partition, GPUs stay free for classification work.",
    "Monitoring: squeue -j <id> (state) / sacct -j <id> (elapsed, TRES billing) map onto the CryoFlow RunRecord state machine.",
    "Stop: scancel <id> wires into the existing stopRun path; --requeue + RELION --continue resume interrupted refinements.",
  ];

  return { script: L.join("\n"), strategy, argv, slurmNotes: notes };
}

/* ------------------------------------------------------------------ */
/* Queue simulation (event-driven, cluster-shaped)                     */
/* ------------------------------------------------------------------ */

export interface SimJobInput {
  key: string;
  type: string;
  minutes: number;
  gpus: number;
  mode: GpuMode;
  shards: number;
  deps: string[]; // afterok dependencies
}

export interface SimEvent {
  t: number; // minutes since submit
  key: string;
  slurmId: string;
  state: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  detail?: string;
}

export interface SimBar {
  key: string;
  type: string;
  slurmId: string;
  start: number;
  end: number;
  gpus: number;
  nodes: string[];
}

export interface SimResult {
  events: SimEvent[];
  bars: SimBar[];
  makespanMin: number;
  gpuUtilization: number; // 0..1
  avgWaitMin: number;
  totalGpuHours: number;
  clusterGpus: number;
}

/**
 * Event-driven Slurm-shaped scheduler: priority-FIFO with dependency
 * (afterok) edges, GPU pool first-fit, array elements as separate
 * schedulable units sharing one jobId. Mirrors squeue semantics for the
 * observable properties (pending reasons, utilization, makespan).
 */
export function simulateQueue(
  jobs: SimJobInput[],
  cluster: { gpus: number; nodes: number; arrayConcurrency: number }
): SimResult {
  const events: SimEvent[] = [];
  const bars: SimBar[] = [];
  const gpuFreeAt: number[] = Array.from({ length: Math.max(1, cluster.gpus) }, () => 0);
  const nodeFreeAt: number[] = Array.from({ length: Math.max(1, cluster.nodes) }, () => 0);
  const doneAt = new Map<string, number>();
  const placedKeys = new Set<string>();
  const arrayPlaced = new Map<string, number>();
  const queue = jobs.map((j, i) => ({ ...j, slurmId: String(1000 + i) }));
  let t = 0;
  let guard = 0;

  const placedCount = (key: string) => bars.filter((b) => b.key === key).length;

  while (guard++ < 10000) {
    const runnable = queue.filter((j) => !doneAt.has(j.key) && !placedKeys.has(j.key) && j.deps.every((d) => doneAt.has(d)));
    const inFlight = queue.filter((j) => !doneAt.has(j.key) && placedKeys.has(j.key));
    if (runnable.length === 0 && inFlight.length === 0) break;

    let advanced = false;
    for (const job of runnable) {
      const shards = job.mode === "array" ? Math.max(1, job.shards) : 1;
      const active = arrayPlaced.get(job.key) ?? 0;
      const budget = Math.min(shards - placedCount(job.key), cluster.arrayConcurrency - active);
      let placedNow = 0;
      for (let s = 0; s < budget; s++) {
        const g: number[] = job.gpus > 0 ? (pickGpus(job.gpus, gpuFreeAt, t) ?? []) : [];
        if (job.gpus > 0 && g.length === 0) break;
        const node = pickNode(nodeFreeAt, t);
        const dur = job.minutes;
        const end = t + dur;
        for (const gi of g) gpuFreeAt[gi] = end;
        nodeFreeAt[node] = Math.max(nodeFreeAt[node], end);
        bars.push({
          key: job.key, type: job.type,
          slurmId: job.slurmId + (job.mode === "array" ? "_" + (placedCount(job.key) + 1) : ""),
          start: t, end, gpus: job.gpus, nodes: [`node-${node + 1}`],
        });
        events.push({
          t, key: job.key, slurmId: job.slurmId, state: "RUNNING",
          detail: job.mode === "array" ? `array element ${placedCount(job.key)}/${shards}` : undefined,
        });
        placedNow++;
        arrayPlaced.set(job.key, (arrayPlaced.get(job.key) ?? 0) + 1);
      }
      if (placedNow > 0) advanced = true;
      if (placedCount(job.key) >= shards) placedKeys.add(job.key);
      if (placedKeys.has(job.key)) {
        const ends = bars.filter((b) => b.key === job.key).map((b) => b.end);
        doneAt.set(job.key, Math.max(...ends, t));
        events.push({ t: doneAt.get(job.key)!, key: job.key, slurmId: job.slurmId, state: "COMPLETED" });
      }
    }

    // advance to the next completion (array shards release GPUs)
    const nextTimes = [
      ...bars.filter((b) => b.end > t).map((b) => b.end),
      ...[...doneAt.values()].filter((v) => v > t),
    ];
    if (nextTimes.length === 0) break;
    const next = Math.min(...nextTimes);
    if (next <= t) break;
    t = next;
    // release array concurrency for finished shards
    for (const job of queue) {
      if (job.mode !== "array") continue;
      const finished = bars.filter((b) => b.key === job.key && b.end <= t).length;
      arrayPlaced.set(job.key, Math.max(0, (arrayPlaced.get(job.key) ?? 0) - Math.max(0, finished - (arrayPlaced.get("_done_" + job.key) ?? 0))));
      arrayPlaced.set("_done_" + job.key, finished);
    }
    if (!advanced) {
      // record a PENDING event for blocked head jobs
      for (const job of runnable.slice(0, 2)) {
        if (placedCount(job.key) === 0) {
          events.push({ t, key: job.key, slurmId: job.slurmId, state: "PENDING", detail: "Resources" });
        }
      }
    }
  }

  const makespan = Math.max(0, ...bars.map((b) => b.end));
  const gpuBusy = bars.reduce((acc, b) => acc + (b.end - b.start) * Math.max(1, b.gpus), 0);
  const totalGpuMinutes = makespan * Math.max(1, cluster.gpus);
  const starts = bars.map((b) => b.start);
  return {
    events: events.sort((a, b) => a.t - b.t),
    bars: bars.sort((a, b) => a.start - b.start),
    makespanMin: Math.round(makespan),
    gpuUtilization: totalGpuMinutes > 0 ? Math.min(1, gpuBusy / totalGpuMinutes) : 0,
    avgWaitMin: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : 0,
    totalGpuHours: Math.round((gpuBusy / 60) * 10) / 10,
    clusterGpus: Math.max(1, cluster.gpus),
  };

  function pickGpus(n: number, freeAt: number[], now: number): number[] | null {
    const avail = freeAt.map((f, i) => ({ i, f })).filter((x) => x.f <= now);
    if (avail.length < n) return null;
    return avail.slice(0, n).map((x) => x.i);
  }
  function pickNode(freeAt: number[], now: number): number {
    const idx = freeAt.findIndex((f) => f <= now);
    return idx === -1 ? 0 : idx;
  }
}

/** The DB Job row is a superset of what the engine needs from a job ref. */
export type EngineJobLike = EngineJobRef & { name?: string };

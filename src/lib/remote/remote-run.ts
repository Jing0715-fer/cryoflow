/**
 * CryoFlow — remote RELION execution engine (SERVER ONLY).
 *
 * The remote backend: the SAME workflow graph, parameters and argv builder as
 * the local engine (engine.buildArgv is the single source of command truth),
 * executed on an SSH-reachable cluster inside a `module load relion/<ver>`
 * environment. The user's terminal ritual (ssh → module load → run) becomes:
 *
 *   startRemoteJob     resolve inputs → stage them to the cluster (upload,
 *                      STAR-rewrite external paths) → build argv (paths
 *                      translated onto the cluster mirror) → wrapper script
 *                      (module load + setsid + exit-status capture) → the
 *                      cluster pid lands in the run record.
 *   reconcileRemoteJobs  one batched SSH poll per connection per few seconds:
 *                      alive? exit code? log tail → progress; on exit →
 *                      sync-back (download outputs into the LOCAL mirror
 *                      workdir, STAR-rewrite remote paths back) → the local
 *                      collectOutputs/finalize machinery runs unchanged →
 *                      downstream jobs auto-start, on the same cluster.
 *   remoteLogTail      live log tail for the log tab (fetched over SSH).
 *   remoteStopRun      kill the cluster-side session (process group).
 *
 * Paths: the local RELION workdir root (data/relion) mirrors onto
 * <remoteRoot>. Files outside it (imported movies on the laptop) stage under
 * <remoteRoot>/_staged/<hash>/ and every STAR reference is rewritten so the
 * cluster sees a consistent tree. The sync-back rewrites them back, so local
 * visualization + downstream LOCAL runs work after completion.
 */

import { createHash } from "crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import type { Job, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DATA_DIR, RELION_DIR } from "@/lib/paths";
import {
  buildArgv,
  collectOutputs,
  describeExitCode,
  getRun,
  parseJobParams,
  parseProgressText,
  readRuns,
  resolveInputs,
  synthesizeTrainingPicks,
  upsertRun,
  updateRun,
  workdirFor,
  type EngineJobRef,
  type RunRecord,
  type UpstreamRef,
  type WaitKind,
} from "@/lib/relion/engine";
import { gpuStrategyFor } from "@/lib/hpc/slurm";
import { getConnection, patchConnection } from "./connections";
import { writeRemoteManifest } from "./remote-files";
import { probeConnection } from "./probe";
import {
  exec,
  loginShellScript,
  remoteDownload,
  remoteMkdir,
  remoteStat,
  remoteUpload,
  shQuote,
  shSingleQuote,
} from "./ssh";
import type {
  ConnectionRunResume,
  RemoteConnection,
  RemoteConnectionDTO,
  RemoteRunInfo,
  RemoteRunState,
  RemoteRunTarget,
} from "./types";

/* ------------------------------------------------------------------ */
/* Constants + small helpers                                           */
/* ------------------------------------------------------------------ */

/** Engine-native types never run remotely (they are local fs bookkeeping). */
const NATIVE_TYPES = new Set([
  "import", "mapimport", "manualpick", "select", "select2d", "symexpand", "rebalance",
]);

/** MPI-parallel types (mirrors engine's MPI_PARALLEL_TYPES). */
const MPI_PARALLEL_TYPES = new Set(["class3d", "refine3d"]);

const STAGE_MAP_FILE = path.join(DATA_DIR, "remote-stage-map.json");

export interface RemoteLogPayload {
  text: string;
  totalLines: number;
  truncated: boolean;
}

export interface StartRemoteOutcome {
  ok: boolean;
  /** Spawned on the cluster (job is running in the DB). */
  started?: boolean;
  /** Inputs are uploading; the job is pending and flips to running itself. */
  staging?: boolean;
  error?: string;
  waiting?: WaitKind;
  busy?: string;
  busyKind?: "inflight" | "live";
  job?: Job;
  /** True when the error is about the REQUEST (unsupported mode, deleted
   * connection, native type) — the job row must NOT flip to failed. */
  requestError?: boolean;
}

function fail(error: string, requestError = false): StartRemoteOutcome {
  return { ok: false, error, ...(requestError ? { requestError } : {}) };
}

/** True when a job type can execute on a remote cluster (not engine-native). */
export function remoteEligible(type: string): boolean {
  return !NATIVE_TYPES.has(type);
}

/** tail() over a local file — bounded read (never loads the whole file). */
function tailText(file: string, maxChars: number): string {
  try {
    const st = statSync(file);
    const bytes = Math.min(st.size, maxChars * 4); // utf8 headroom
    const fd = openSync(file, "r");
    try {
      const buf = Buffer.alloc(bytes);
      const read = readSync(fd, buf, 0, bytes, Math.max(0, st.size - bytes));
      return buf.toString("utf8", 0, read).slice(-maxChars);
    } finally {
      closeSync(fd);
    }
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Remote $HOME expansion + path mapping                               */
/* ------------------------------------------------------------------ */

const homeCache = new Map<string, string>(); // fingerprint → remote home

async function remoteHome(c: RemoteConnection): Promise<string> {
  const key = `${c.id}:${c.username}@${c.host}:${c.port}`;
  const hit = homeCache.get(key);
  if (hit) return hit;
  const r = await exec(c, loginShellScript("echo $HOME"), { timeoutMs: 10_000 });
  const home = r.stdout.trim().split("\n").pop() ?? "";
  if (r.error || !home.startsWith("/")) {
    throw new Error(`could not resolve the cluster home directory: ${r.error ?? r.stderr.trim().slice(0, 200)}`);
  }
  homeCache.set(key, home);
  return home;
}

export async function expandRemotePath(c: RemoteConnection, p: string): Promise<string> {
  if (p === "~") return remoteHome(c);
  if (p.startsWith("~/")) return (await remoteHome(c)) + p.slice(1);
  return p;
}

/** local (under RELION_DIR) → cluster mirror path. */
function mapLocalToRemote(localPath: string, remoteRoot: string): string {
  const norm = localPath.split(path.sep).join("/");
  if (norm === RELION_DIR.split(path.sep).join("/")) return remoteRoot;
  if (norm.startsWith(RELION_DIR.split(path.sep).join("/") + "/")) {
    return remoteRoot.replace(/\/$/, "") + norm.slice(RELION_DIR.length);
  }
  return norm;
}

/** cluster mirror path → local (under RELION_DIR). */
function mapRemoteToLocal(remotePath: string, remoteRoot: string): string {
  const root = remoteRoot.replace(/\/$/, "");
  if (remotePath === root) return RELION_DIR;
  if (remotePath.startsWith(root + "/")) {
    return path.join(RELION_DIR, remotePath.slice(root.length));
  }
  return remotePath;
}

/* ------------------------------------------------------------------ */
/* Stage map (external local files ↔ cluster _staged paths)            */
/* ------------------------------------------------------------------ */

interface StageEntry {
  local: string;
  remote: string;
  at: number;
}
let stageMap: Record<string, StageEntry> | null = null;

function loadStageMap(): Record<string, StageEntry> {
  if (stageMap) return stageMap;
  try {
    if (existsSync(STAGE_MAP_FILE)) {
      stageMap = JSON.parse(readFileSync(STAGE_MAP_FILE, "utf8"));
    }
  } catch {
    /* corrupt → fresh */
  }
  return (stageMap = stageMap ?? {});
}

function saveStageMap(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STAGE_MAP_FILE, JSON.stringify(loadStageMap(), null, 2));
  } catch {
    /* best-effort persistence */
  }
}

function stageEntryFor(localAbs: string): StageEntry | null {
  const norm = localAbs.split(path.sep).join("/");
  const map = loadStageMap();
  for (const e of Object.values(map)) {
    if (e.local === norm) return e;
  }
  return null;
}

function rememberStage(localAbs: string, remote: string): void {
  const map = loadStageMap();
  const key = createHash("sha1").update(localAbs.split(path.sep).join("/")).digest("hex").slice(0, 16);
  map[key] = { local: localAbs.split(path.sep).join("/"), remote, at: Date.now() };
  // cap the map — prune the oldest quarter beyond 4000 entries
  const keys = Object.keys(map);
  if (keys.length > 4000) {
    const sorted = keys.sort((a, b) => map[a].at - map[b].at);
    for (const k of sorted.slice(0, 1000)) delete map[k];
  }
  saveStageMap();
}

/* ------------------------------------------------------------------ */
/* STAR path rewriting                                                 */
/* ------------------------------------------------------------------ */

/**
 * Rewrite a STAR file's path references between the local and cluster views.
 * - prefix map: RELION_DIR ↔ remoteRoot
 * - exact map:  every staged external file (both directions)
 * Returns the rewritten text (unchanged when nothing matches).
 */
export function rewriteStarPaths(
  content: string,
  dir: "to-remote" | "to-local",
  remoteRoot: string
): string {
  let out = content;
  const localRoot = RELION_DIR.split(path.sep).join("/");
  const root = remoteRoot.replace(/\/$/, "");
  if (dir === "to-remote") {
    if (out.includes(localRoot + "/")) out = out.split(localRoot + "/").join(root + "/");
  } else {
    if (out.includes(root + "/")) out = out.split(root + "/").join(localRoot + "/");
  }
  const map = loadStageMap();
  for (const e of Object.values(map)) {
    if (dir === "to-remote" && out.includes(e.local)) {
      out = out.split(e.local).join(e.remote);
    } else if (dir === "to-local" && out.includes(e.remote)) {
      out = out.split(e.remote).join(e.local);
    }
  }
  return out;
}

/**
 * File references inside a STAR — ABSOLUTE paths that exist locally, plus
 * RELATIVE (project-relative, the RELION pipeliner convention: the engine
 * runs with cwd = project root, so "micrographs/mic_1.mrc" lives at
 * <RELION_DIR>/<projectId>/micrographs/mic_1.mrc). Strips the "idx@path"
 * convention of rlnImageName. Relative refs are validated against the
 * project root by the caller (it knows the projectId).
 */
function refsInStar(
  content: string,
  projectRootLocal: string
): Array<{ raw: string; kind: "abs" | "rel"; localAbs: string }> {
  const out = new Map<string, { raw: string; kind: "abs" | "rel"; localAbs: string }>();
  const IMG = /\.(mrc|mrcs|tif|tiff|eer|star|coord|box|sav)$/i;
  for (const raw of content.split(/\r?\n/)) {
    for (const token of raw.trim().split(/\s+/)) {
      let t = token;
      const at = t.lastIndexOf("@");
      if (at >= 0 && at < t.length - 1) t = t.slice(at + 1);
      t = t.replace(/[,;)\]]+$/, "").replace(/^"|"$/g, "");
      if (t.length < 5) continue;
      try {
        if (t.startsWith("/")) {
          if (existsSync(t) && statSync(t).isFile()) out.set(t, { raw: t, kind: "abs", localAbs: t });
        } else if (t.includes("/") && IMG.test(t)) {
          // project-relative — resolve against the project root
          const localAbs = path.join(projectRootLocal, t);
          if (existsSync(localAbs) && statSync(localAbs).isFile()) {
            out.set(localAbs, { raw: t, kind: "rel", localAbs });
          }
        }
      } catch {
        /* unreadable → not a local file */
      }
    }
  }
  return [...out.values()];
}

/* ------------------------------------------------------------------ */
/* Input staging (upload + rewrite)                                    */
/* ------------------------------------------------------------------ */

/** Walk a local directory → relative file list (cap for sanity). */
function walkFiles(dir: string, max = 20_000): string[] {
  const out: string[] = [];
  const queue = [dir];
  while (queue.length > 0 && out.length < max) {
    const d = queue.shift() as string;
    let entries: string[] = [];
    try {
      entries = readdirSync(d);
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e);
      try {
        const st = statSync(p);
        if (st.isDirectory()) queue.push(p);
        else if (st.isFile()) out.push(p);
      } catch {
        /* unreadable */
      }
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * Upload one local input (file or directory) to the cluster, skipping files
 * whose remote twin already matches (size) — idempotent re-staging. STAR
 * files travel REWRITTEN (their path references translated to-remote).
 */
async function stageFileTree(
  c: RemoteConnection,
  localAbs: string,
  remoteTarget: string
): Promise<number> {
  let uploaded = 0;
  const st = statSync(localAbs);
  if (st.isFile()) {
    let content: Buffer;
    if (/\.star$/i.test(localAbs)) {
      const rewritten = rewriteStarPaths(readFileSync(localAbs, "utf8"), "to-remote", await expandRemotePath(c, c.remoteRoot));
      content = Buffer.from(rewritten, "utf8");
    } else {
      content = readFileSync(localAbs);
    }
    const existing = await remoteStat(c, remoteTarget);
    if (!existing || existing.size !== content.length) {
      const ok = await remoteUpload(c, content, remoteTarget);
      if (!ok) throw new Error(`upload failed: ${remoteTarget}`);
    }
    return content.length;
  }
  // directory: mirror the tree
  for (const f of walkFiles(localAbs)) {
    const rel = path.relative(localAbs, f).split(path.sep).join("/");
    const target = `${remoteTarget.replace(/\/$/, "")}/${rel}`;
    const fst = statSync(f);
    let content: Buffer;
    if (/\.star$/i.test(f)) {
      const rewritten = rewriteStarPaths(readFileSync(f, "utf8"), "to-remote", await expandRemotePath(c, c.remoteRoot));
      content = Buffer.from(rewritten, "utf8");
    } else {
      content = readFileSync(f);
    }
    const existing = await remoteStat(c, target);
    if (!existing || existing.size !== content.length) {
      const ok = await remoteUpload(c, content, target);
      if (!ok) throw new Error(`upload failed: ${target}`);
      uploaded += content.length;
    }
  }
  return uploaded;
}

/* ------------------------------------------------------------------ */
/* Wrapper script (module load + detached spawn + exit capture)         */
/* ------------------------------------------------------------------ */

function buildWrapperScript(args: {
  conn: RemoteConnection;
  module: string;
  relionHome: string | null;
  ctffind: string | null;
  command: string;
  remoteProjectRoot: string;
  remoteWorkdir: string;
}): string {
  const { conn, module: moduleName, relionHome, ctffind, command, remoteProjectRoot, remoteWorkdir } = args;
  const L: string[] = [];
  L.push("#!/usr/bin/env bash");
  L.push("# CryoFlow remote run — generated locally, executed on the cluster");
  L.push("# connection: " + `${conn.username}@${conn.host}:${conn.port} · module ${moduleName || "(none)"}`);
  L.push("set -u");
  L.push("# ---- login-shell environment (module is a shell function) ----");
  L.push("source /etc/profile >/dev/null 2>&1 || true");
  L.push('[ -f "$HOME/.bash_profile" ] && . "$HOME/.bash_profile" >/dev/null 2>&1 || true');
  L.push('[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc" >/dev/null 2>&1 || true');
  L.push("");
  L.push("# ---- connection environment lines ----");
  for (const line of conn.envLines) {
    if (line.trim() && !line.trim().startsWith("#")) L.push(line);
  }
  L.push("");
  L.push("# ---- RELION environment (module load, with a PATH fallback) ----");
  if (moduleName) {
    L.push(`module load ${shQuote(moduleName)} 2>/dev/null || module load ${shQuote(moduleName)}`);
  }
  if (relionHome) {
    L.push(`export RELION_HOME=${shQuote(relionHome)}`);
    L.push(`export PATH="$RELION_HOME/bin:$PATH"`);
  }
  if (ctffind) {
    L.push(`export RELION_CTFFIND_EXECUTABLE=${shQuote(ctffind)}`);
  }
  L.push('command -v relion_refine >/dev/null 2>&1 || { echo "CRYOFLOW_ERR: relion_refine not found on PATH after module load" >&2; exit 127; }');
  L.push("");
  L.push("# ---- run ----");
  L.push(`mkdir -p ${shQuote(remoteProjectRoot)}`);
  L.push(`cd ${shQuote(remoteProjectRoot)} || exit 111`);
  L.push(`mkdir -p ${shQuote(remoteWorkdir)}`);
  L.push(`rm -f ${shQuote(remoteWorkdir + "/.cf-exit")}`);
  // the command runs in its own session (setsid) so killing the session id
  // takes down mpirun AND its ranks; the exit status lands in .cf-exit
  L.push(
    `setsid bash -c ${shSingleQuote(`${command}; __rc=$?; echo $__rc > "${remoteWorkdir}/.cf-exit"`)} ` +
      `> ${shQuote(remoteWorkdir + "/run.out")} 2> ${shQuote(remoteWorkdir + "/run.err")} < /dev/null &`
  );
  // record pid + /proc starttime — the poll verifies BOTH so a RECYCLED pid
  // (long-lived cluster, pid wraparound) can never fake "alive"
  L.push(`__p=$!`);
  L.push(
    `echo "$__p $(awk '{print \$22}' /proc/$__p/stat 2>/dev/null)" > ${shQuote(remoteWorkdir + "/.cf-pid")}`
  );
  L.push('echo "CRYOFLOW_PID:$__p"');
  return L.join("\n") + "\n";
}

/* ------------------------------------------------------------------ */
/* startRemoteJob                                                      */
/* ------------------------------------------------------------------ */

/**
 * t306 — the array split's type contract: a type is array-eligible only when
 * its argv takes ONE per-micrograph input STAR (`--i`) and points `--o` at
 * the workdir root, so each SLURM_ARRAY_TASK_ID can slice the star
 * round-robin, run the shard in its own output subdir, and the LAST task
 * home can merge the shard output stars back into the canonical file the
 * engine's collectOutputs expects. The value is that canonical output star's
 * name. Anything else (refine3d's global halves, postprocess's single map)
 * would be split in name only — refused honestly instead.
 */
const ARRAY_TYPES: Record<string, string> = {
  motioncorr: "corrected_micrographs.star",
  ctffind: "micrographs_ctf.star",
};

/**
 * t306 — the %M concurrency cap baked into `--array=1-N%M`. A real cluster
 * backfills beyond it as slots free; the run dialog exposes ONE knob (the
 * shard count) and this honest default, not a second stepper to misuse.
 */
const ARRAY_CONCURRENCY = 4;

/**
 * t300 — the hostnames the probe's sinfo inventory resolved for ONE
 * partition (from the connection's lastProbe.slurmGpus[].hosts). null =
 * the partition is unknown to the probe (bare API callers, stale probes)
 * — the submission stays partition-level, never a fabricated node.
 */
function connLastPartitionHosts(connId: string, partition: string): string[] | null {
  const groups = getConnection(connId)?.lastProbe?.slurmGpus ?? null;
  if (!groups) return null;
  const g = groups.find((x) => x.partition === partition);
  return g?.hosts && g.hosts.length > 0 ? g.hosts : null;
}

/**
 * t297 — the sbatch variant of the run script, modeled on the user's
 * sbatch6gpu.sh submission idiom (OpenHPC + Slurm + Lmod clusters):
 *
 *   #SBATCH --nodes=1
 *   #SBATCH --ntasks=<gpus>          ← one MPI rank per GPU
 *   #SBATCH --gres=gpu:<gpus>
 *   … mpirun -n <gpus> relion_* … --gpu 0:1:…:N-1
 *
 * The GPU count is the WIDTH the user chose in the run dialog (1–8) — the
 * same script shape at any width. The output/error land in the workdir's
 * run.out / run.err (the SAME contract as direct mode), so log tailing,
 * progress parsing and the finalize sweep are unchanged. The exit status
 * lands in .cf-exit via the explicit capture + EXIT trap — the completion
 * truth the poll already speaks (a scancel SIGKILL that beats the trap
 * leaves no file → the honest "interrupted remotely" path).
 */
function buildSbatchScript(args: {
  conn: RemoteConnection;
  module: string;
  relionHome: string | null;
  ctffind: string | null;
  command: string;
  gpus: number;
  ntasks: number;
  threads: number;
  jobName: string;
  remoteProjectRoot: string;
  remoteWorkdir: string;
  /**
   * t300 — the partition this submission pins (the run dialog's detected
   * node group). null = the connection's own default (conn.slurmPartition),
   * undefined = neither (the scheduler decides). Already sanitized by the
   * caller ([A-Za-z0-9_.-], ≤64 chars).
   */
  partition?: string | null;
  /**
   * t300 — the exact NODE this submission pins (--nodelist), when the
   * picked partition resolved to a single hostname in the probe's sinfo
   * inventory ("brain2" as partition AND node). null = partition-level
   * only. Sanitized like partition (a hostname is the same charset).
   */
  nodelist?: string | null;
  /**
   * t304 — the pipeline handoff, scheduler-side: "afterok:<id>[:<id>…]"
   * when an upstream job is still in flight on this same connection. The
   * child becomes the SCHEDULER's problem (PENDING until the parents land)
   * instead of a failed RELION command staring at missing inputs;
   * --kill-on-invalid-dep=yes (emitted alongside) keeps a parent's failure
   * from stranding the child in PENDING forever. null = no live upstream.
   */
  dependency?: string | null;
  /**
   * t306 — the array split: when present the script carries
   * `#SBATCH --array=1-N%M`, each SLURM_ARRAY_TASK_ID slices the input STAR
   * round-robin (data-block rows), runs the command on the shard with --o
   * pointed at a per-task subdir, and the LAST task home (the rc-file count
   * gate — nobody else knows who is last) merges the shard output stars
   * into the canonical one and writes .cf-exit: 0 only when every task's rc
   * was 0. The EXIT trap stands down for array tasks (a single shard's
   * failure must not speak the verdict while its siblings still run) — the
   * TERM/INT trap keeps writing 143 (a scancel kills ALL tasks; the first
   * writer wins, the word is the same). null = single job, byte-identical
   * to the pre-t306 contract.
   */
  array?: {
    total: number;
    concurrency: number;
    inputStar: string;
    outStar: string;
  } | null;
}): string {
  const { conn, module: moduleName, relionHome, ctffind, command, gpus, ntasks, threads, jobName, remoteProjectRoot, remoteWorkdir, partition, nodelist, dependency, array } = args;
  const effectivePartition = partition ?? conn.slurmPartition ?? null;
  const L: string[] = [];
  L.push("#!/bin/bash");
  L.push("# CryoFlow Slurm submission — generated locally, submitted on the cluster");
  L.push("# connection: " + `${conn.username}@${conn.host}:${conn.port} · module ${moduleName || "(none)"} · ${gpus > 0 ? `${gpus} GPU(s)` : "CPU"}${effectivePartition ? ` · partition ${effectivePartition}` : ""}${nodelist ? ` · node ${nodelist}` : ""}${array ? ` · array 1-${array.total}%${array.concurrency}` : ""}`);
  L.push(`#SBATCH --job-name=${jobName}`);
  if (effectivePartition) L.push(`#SBATCH --partition=${effectivePartition}`);
  if (nodelist) L.push(`#SBATCH --nodelist=${nodelist}`);
  if (dependency) {
    L.push(`#SBATCH --dependency=${dependency}`);
    L.push("#SBATCH --kill-on-invalid-dep=yes");
  }
  // t306 — the array directive: N shards, at most M running at once (the
  // scheduler backfills as slots free). Rides AFTER the dependency so an
  // array child of a live upstream orders the WHOLE fan-out behind it.
  if (array) {
    L.push(`#SBATCH --array=1-${array.total}%${array.concurrency}`);
  }
  L.push("#SBATCH --nodes=1");
  L.push(`#SBATCH --ntasks=${Math.max(1, ntasks)}`);
  L.push(`#SBATCH --cpus-per-task=${Math.max(1, threads)}`);
  if (gpus > 0) L.push(`#SBATCH --gres=gpu:${gpus}`);
  L.push(`#SBATCH --mem=${Math.min(256, 16 + 12 * Math.max(1, gpus))}G`);
  L.push(`#SBATCH --output=${remoteWorkdir}/run.out`);
  L.push(`#SBATCH --error=${remoteWorkdir}/run.err`);
  L.push("");
  L.push("# ---- login-shell environment (module is a shell function) ----");
  L.push("source /etc/profile >/dev/null 2>&1 || true");
  L.push('[ -f "$HOME/.bash_profile" ] && . "$HOME/.bash_profile" >/dev/null 2>&1 || true');
  L.push('[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc" >/dev/null 2>&1 || true');
  L.push("");
  L.push("# ---- connection environment lines ----");
  for (const line of conn.envLines) {
    if (line.trim() && !line.trim().startsWith("#")) L.push(line);
  }
  L.push("");
  L.push("# ---- RELION environment (module load, with a PATH fallback) ----");
  if (moduleName) {
    L.push(`module load ${shQuote(moduleName)} 2>/dev/null || module load ${shQuote(moduleName)}`);
  }
  if (relionHome) {
    L.push(`export RELION_HOME=${shQuote(relionHome)}`);
    L.push('export PATH="$RELION_HOME/bin:$PATH"');
  }
  if (ctffind) {
    L.push(`export RELION_CTFFIND_EXECUTABLE=${shQuote(ctffind)}`);
  }
  L.push('command -v relion_refine >/dev/null 2>&1 || { echo "CRYOFLOW_ERR: relion_refine not found on PATH after module load" >&2; exit 127; }');
  L.push("");
  L.push("# ---- run ----");
  L.push(`mkdir -p ${shQuote(remoteProjectRoot)}`);
  L.push(`cd ${shQuote(remoteWorkdir)} || exit 111`);
  L.push(`rm -f ${shQuote(remoteWorkdir + "/.cf-exit")}`);
  // Exit-status contract (the poll's completion truth):
  //   - natural completion: the explicit capture below writes the TRUE
  //     status (0 included) — the last word;
  //   - scancel's SIGTERM: the TERM/INT trap writes 143 (cancelled), and
  //     the EXIT trap only speaks when rc != 0 — a TERM'ed bash otherwise
  //     runs its EXIT trap with a stale $? == 0, which would forge a
  //     success line for a job the user just killed (observed on GNU bash:
  //     `bash -c 'trap "echo $?" EXIT; sleep N'` + kill → writes 0);
  //   - SIGKILL / node loss: nothing is written → VANISHED → the honest
  //     "interrupted remotely" path.
  //   t306 — array tasks: the EXIT trap STANDS DOWN (one shard's failure
  //     must not speak the verdict while its siblings still run — the
  //     count gate below owns the word); the TERM/INT trap keeps writing
  //     143 (a scancel hits ALL tasks; first writer wins, same word).
  L.push(`trap 'echo 143 > ${shQuote(remoteWorkdir + "/.cf-exit")} 2>/dev/null; exit 143' TERM INT`);
  L.push(
    `trap '__rc=$?; [ "$__rc" -eq 0 ] || [ -n "${"${"}SLURM_ARRAY_TASK_ID:-}" ] || echo "$__rc" > ${shQuote(remoteWorkdir + "/.cf-exit")} 2>/dev/null' EXIT`
  );
  L.push(`set +e`);
  // t306 — the array branch: each task slices its shard out of the input
  // star (round-robin over the data-block rows — the optics block and the
  // comments pass through untouched), runs the command with $SHARD as the
  // input and $OSHARD as its own output subdir, appends its rc, and the
  // LAST task home (the rc-file count gate) merges the shard output stars
  // into the canonical one before writing .cf-exit. The RCF's name carries
  // SLURM_ARRAY_JOB_ID so a re-run never reads a previous submission's
  // tally, and the merge is tolerated-missing (a failed shard's star is
  // simply absent — the verdict says FAILED anyway).
  if (array) {
    const N = array.total;
    const W = remoteWorkdir;
    L.push(`if [ -n "${"${"}SLURM_ARRAY_TASK_ID:-}" ]; then`);
    L.push(`  SHARD="${W}/.cf-shard-$SLURM_ARRAY_TASK_ID.star"`);
    L.push(`  RCF="${W}/.cf-array-rc-$SLURM_ARRAY_JOB_ID"`);
    L.push(`  OSHARD="${W}/shard_$SLURM_ARRAY_TASK_ID"`);
    L.push(`  awk -v s="$SLURM_ARRAY_TASK_ID" -v n=${N} '`);
    L.push(`    /^data_/{block++; print; next}`);
    L.push(`    /^loop_/{print; next}`);
    L.push(`    /^_/{print; next}`);
    L.push(`    block>=2 && NF>0 && $1 !~ /^#/{ if(idx % n == s-1) print; idx++; next }`);
    L.push(`    { if(block<2) print }`);
    L.push(`  ' ${shQuote(array.inputStar)} > "$SHARD" 2>/dev/null || cp ${shQuote(array.inputStar)} "$SHARD"`);
    L.push(`  ${command}`);
    L.push(`  __rc=$?`);
    L.push(`  echo "$SLURM_ARRAY_TASK_ID $__rc" >> "$RCF"`);
    L.push(`  __done="$(wc -l < "$RCF" 2>/dev/null || true)"`);
    L.push(`  if [ "${"${__done:-0}"}" -ge ${N} ]; then`);
    L.push(`    __merged="${W}/${array.outStar}"`);
    L.push(`    __have=0`);
    L.push(`    for __k in $(seq 1 ${N}); do`);
    L.push(`      __f="${W}/shard_$__k/${array.outStar}"`);
    L.push(`      [ -f "$__f" ] || continue`);
    L.push(`      if [ "$__have" = "0" ]; then`);
    L.push(`        cp "$__f" "$__merged.cf-merge"`);
    L.push(`        __have=1`);
    L.push(`      else`);
    L.push(`        awk '!/^data_/ && !/^loop_/ && !/^_/ && !/^#/ && NF>0' "$__f" >> "$__merged.cf-merge" 2>/dev/null || true`);
    L.push(`      fi`);
    L.push(`    done`);
    L.push(`    [ "$__have" = "1" ] && mv "$__merged.cf-merge" "$__merged"`);
    L.push(`    __bad="$(awk '$2!=0{print $2; exit}' "$RCF" 2>/dev/null || true)"`);
    L.push(`    echo "${"${__bad:-0}"}" > ${shQuote(W + "/.cf-exit")}`);
    L.push(`    rm -f "$RCF" "${W}"/.cf-shard-*.star`);
    L.push(`  fi`);
    L.push(`  exit "$__rc"`);
    L.push(`fi`);
  }
  L.push(command);
  L.push(`__rc=$?`);
  L.push(`echo "$__rc" > ${shQuote(remoteWorkdir + "/.cf-exit")}`);
  L.push(`exit $__rc`);
  return L.join("\n") + "\n";
}

/** A staging heartbeat older than this means the upload task is gone. */
const STAGING_BEAT_STALE_MS = 120_000;

/**
 * Staging beat interval. 10s suits a real cluster (staging minutes, stale
 * window 2min); a fast LOCAL rig stages in under one interval, so the beat
 * would never land (t268's first run) — deployments and test rigs tune it
 * with CF_STAGING_BEAT_MS without touching the ledger's stale math (any
 * interval well under STAGING_BEAT_STALE_MS is safe).
 */
const STAGING_BEAT_MS = Math.max(500, Number(process.env.CF_STAGING_BEAT_MS) || 10_000);

/**
 * Staging heartbeat — the background staging task has no supervisor (it is
 * void-spawned), so it touches the ledger every STAGING_BEAT_MS while alive.
 * The poll sweep reads the beat to distinguish "still uploading" from "the
 * task vanished without a trace" (a hung SSH exec used to strand the row in
 * pending until the 30min fallback). Returns a stop() that is idempotent.
 */
function startStagingBeat(jobId: string): () => void {
  const beat = setInterval(() => {
    updateRun(jobId, (rec) =>
      rec.remote && rec.remote.phase === "staging" && !rec.done
        ? { ...rec, remote: { ...rec.remote, stagingBeat: Date.now() } }
        : null
    );
  }, STAGING_BEAT_MS);
  beat.unref?.();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(beat);
  };
}

/**
 * A row flip that survives SQLITE_BUSY. The finalize write races every
 * other engine write (the poll sweep, the transition sweep, a UI patch) —
 * losing the race used to strand the row non-terminal FOREVER with the
 * record already done (no self-heal path). Retry with backoff; if all
 * attempts fail, the orphan sweep in reconcileRemoteJobs heals the row
 * from the record truth on a later tick.
 */
async function updateJobWithRetry(
  id: string,
  data: Prisma.JobUpdateInput,
  attempts = 3
): Promise<Job | null> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await db.job.update({ where: { id }, data });
    } catch (e) {
      if (i === attempts) {
        console.error(
          `remote-run: row flip failed ${attempts}x for ${id} — the orphan sweep will heal it:`,
          e instanceof Error ? e.message : e
        );
        return null;
      }
      await new Promise((r) => setTimeout(r, 200 * i));
    }
  }
  return null;
}

export async function startRemoteJob(args: {
  job: Job;
  upstream: UpstreamRef[];
  target: RemoteRunTarget;
}): Promise<StartRemoteOutcome> {
  const { job, upstream, target } = args;

  // t297 — slurm mode is WIRED: the sbatch6gpu.sh pattern at a chosen GPU
  // width. The one honest pre-condition: the cluster must actually offer a
  // Slurm client (the probe looked for sbatch + squeue on the login node).
  const isSlurm = target.mode === "slurm";
  const gpuWidth = isSlurm
    ? Math.max(1, Math.min(8, Math.round(Number(target.gpus ?? 6)) || 6))
    : 0;
  // t306 — the array split width: 0 = no split (the single-job contract,
  // byte-identical submissions). 2..64 after the clamp; the route already
  // dropped sub-2 values, this is the second gate on the engine side.
  const shardTotal =
    isSlurm && Number(target.shards) >= 2 ? Math.min(64, Math.round(Number(target.shards))) : 0;
  // t300 — the partition (detected node group) this sbatch pins. The run
  // route already sanitized the raw body; this is the second gate on the
  // engine side (bare API callers get the same clamps, never a raw string
  // into the script — #SBATCH --partition is a shell-facing line).
  const partitionOverride =
    isSlurm && typeof target.partition === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(target.partition)
      ? target.partition
      : null;
  // t300 — the NODE pin: a user picking a group the probe resolved to
  // exactly ONE hostname ("brain2", "normal"…) asked for THAT node, not
  // merely its partition — a partition can outlive its hostlist (nodes
  // added later would silently widen the pick). Only a single resolved
  // host pins (--nodelist); multi-host groups stay partition-level (a
  // 1-node sbatch pinning 4 nodes would request the whole group).
  const partitionHosts =
    partitionOverride != null
      ? connLastPartitionHosts(target.connectionId, partitionOverride)
      : null;
  // the pin rides ONLY a hostname-shaped single host (expandHostlist's
  // grammar cannot emit metacharacters, but the second gate is cheap and
  // #SBATCH --nodelist is a shell-facing line like --partition)
  const nodelistPin =
    partitionHosts && partitionHosts.length === 1 && /^[A-Za-z0-9_.-]{1,64}$/.test(partitionHosts[0])
      ? partitionHosts[0]
      : null;

  if (NATIVE_TYPES.has(job.type)) {
    return fail(
      `"${job.type}" runs locally in milliseconds (no cluster needed) — its outputs stage to the cluster automatically when a remote job needs them`,
      true
    );
  }

  // t306 — the array gate: shards only mean something for the types whose
  // argv takes ONE per-micrograph input star and whose output star the last
  // task can merge (ARRAY_TYPES). Anything else is refused BEFORE staging —
  // a silently un-split run would be a lie with extra steps, and a split
  // refine3d would break global alignment statistics outright.
  if (shardTotal >= 2 && !ARRAY_TYPES[job.type]) {
    return fail(
      `"${job.type}" cannot ride an array split (only ${Object.keys(ARRAY_TYPES).join(" / ")} shard per micrograph today) — submit it without the split`,
      true
    );
  }

  let conn = getConnection(target.connectionId);
  if (!conn) {
    return fail("cluster connection not found — it may have been deleted (re-open Remote cluster and re-save)", true);
  }
  if (!conn.host || !conn.username) {
    return fail("connection has no host/username — open Remote cluster and complete the form", true);
  }

  const moduleName = target.module ?? conn.defaultModule ?? "";

  // t297 — sbatch needs the Slurm client the probe looked for; a cluster
  // that never probed (bare API) gets the same honest door the module probe
  // has — never a blind spawn that fails five minutes later at submit time.
  if (isSlurm && conn.lastProbe && !conn.lastProbe.slurm) {
    return fail(
      `the probe saw no Slurm client (sbatch/squeue) on ${conn.host} — re-test the connection, or run direct (nohup) mode`,
      true
    );
  }

  // ---- liveness pre-check (precise, async — isRunAlive only guesses) ----
  const prev = getRun(job.id);
  // marker for the anti-ghost re-check below: if a CONCURRENT dispatch
  // lands a record while we await, its startedAt differs from the one we
  // verified here (t262's ghost-dispatch finding, hardened t263).
  const prevStartedAt = prev?.startedAt ?? null;
  if (prev?.remote && prev.done === false) {
    // poll the PREVIOUS run's OWN connection — checking a record from
    // cluster A against cluster B reads the wrong filesystem and would
    // report a live run VANISHED (the ghost-dispatch door t262 caught:
    // the record-side staging phase short-circuits first, but a RUNNING
    // record must be witnessed on its own cluster, not the new target).
    const prevConn =
      prev.remote.connectionId === conn.id ? conn : getConnection(prev.remote.connectionId);
    if (prevConn) {
      const alive = await pollOneRemote(prevConn, prev);
      if (alive === "alive" || alive === "unknown" || alive === "busy" || alive === "staging") {
        return {
          ok: false,
          busy:
            alive === "staging"
              ? `inputs are still staging to ${prevConn.host} — the run starts by itself`
              : `remote run still active on ${prev.remote.host}${prev.remote.pid != null ? ` (cluster pid ${prev.remote.pid})` : ""}`,
          busyKind: "live",
          job,
        };
      }
    }
    // else: the previous connection is gone — the sweep already failed that
    // row and the record can no longer be verified; safe to replace.
    // Dead + finalized by the poll above? pollOneRemote only INSPECTS; the
    // sweep finalizes. A dead-but-unfinalized record is safe to replace.
  }

  // ---- resolve inputs (same semantics as the local engine) -------------
  const params = parseJobParams(job.params);
  const resolved = resolveInputs(job.type, upstream, params);
  if (resolved.missing) {
    return { ok: false, error: resolved.missing, ...(resolved.wait ? { waiting: resolved.wait } : {}) };
  }

  // ---- t267: a never-probed connection must not dispatch blind ----------
  // The UI dialog can't reach this state (its module list IS lastProbe),
  // but the bare API can: without lastProbe the argv below would be built
  // from NULL externals/ctffind/relionHome, and externalFor would fall
  // back to the LOCAL PATH — an honest-but-misleading LOCAL error for a
  // CLUSTER command (t266's unprobed-dispatch finding, now closed at the
  // product layer). The probe is load-bearing, so the dispatch performs
  // it itself: probe now, persist exactly like the Test route does, and
  // re-read the connection; a failed probe degrades to an honest error
  // naming the door, never to a local-path guess.
  if (!conn.lastProbe) {
    try {
      const probe = await probeConnection(conn);
      patchConnection(conn.id, { lastProbe: probe });
      if (probe.ok) {
        conn = getConnection(conn.id) ?? conn; // re-read with the fresh truth
        // t268: the ceremony's cost is part of the dispatch's latency —
        // say it out loud (probe.durationMs rides the persisted record too).
        console.log(
          `remote-run: auto-probed ${conn.host}:${conn.port} in ${probe.durationMs ?? "?"}ms — the dispatch ran the ceremony itself (t267/t268)`
        );
      } else {
        const why = probe.error?.split("\n")[0]?.trim() || "probe failed";
        return fail(
          `the connection has never been probed and probing just failed (${why}) — open Remote clusters and run Test first`,
          true
        );
      }
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      return fail(
        `the connection has never been probed and probing just failed (${why.split("\n")[0]}) — open Remote clusters and run Test first`,
        true
      );
    }
  }
  const relionHomeFromProbe = moduleName ? conn.lastProbe?.relionHomes?.[moduleName] ?? null : null;

  // ---- remote roots ------------------------------------------------------
  let remoteRoot: string;
  try {
    remoteRoot = await expandRemotePath(conn, conn.remoteRoot || "~/cryoflow");
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const jobRef: EngineJobRef = { id: job.id, projectId: job.projectId, type: job.type, params };
  const localWorkdir = workdirFor(jobRef);
  const remoteProjectRoot = `${remoteRoot.replace(/\/$/, "")}/${job.projectId}`;
  const remoteWorkdir = `${remoteProjectRoot}/${job.type}_${job.id.slice(-8)}`;

  // ---- topaztrain: build the coordinate_files index HERE (t265) ----------
  // --topaz_train_picks must be the data_coordinate_files INDEX star, and
  // the engine's synthesis reads the resolved inputs from a DISK. At
  // dispatch time those inputs are still LOCAL paths (the cluster hasn't
  // seen them yet), so the index is synthesized now, into the job's local
  // workdir, and stages below like any other input — its per-mic star
  // references ride the same mirror mapping. buildArgv's cluster-side
  // re-synthesis then degrades to a pass-through by design: its
  // readFileSync of a cluster path cannot succeed, and the staged file is
  // already index-format, exactly what RELION's trainTopaz reads.
  const resolvedInputs: Record<string, string> = { ...resolved.inputs };
  if (
    job.type === "topaztrain" &&
    resolvedInputs.train_picks &&
    resolvedInputs.micrographs_star &&
    existsSync(resolvedInputs.train_picks)
  ) {
    const synth = synthesizeTrainingPicks(
      resolvedInputs.train_picks,
      resolvedInputs.micrographs_star,
      localWorkdir
    );
    if (synth !== resolvedInputs.train_picks) resolvedInputs.train_picks = synth;
  }

  const remoteState: RemoteRunState = {
    connectionId: conn.id,
    connectionName: conn.name,
    host: `${conn.host}:${conn.port}`,
    user: conn.username,
    module: moduleName,
    mode: isSlurm ? "slurm" : "direct",
    remoteRoot,
    remoteWorkdir,
    pid: null,
    slurmId: null,
    ...(isSlurm ? { gpusRequested: gpuWidth } : {}),
    ...(isSlurm && partitionOverride ? { partition: partitionOverride } : {}),
    phase: "staging",
  };

  // ---- plan the input staging -------------------------------------------
  // upstream remote outputs (same cluster tree) pass through untouched;
  // everything else uploads (STARs rewritten, external files staged).
  const runs = readRuns();
  const upstreamRemoteTwins = new Map<string, string>(); // local path → remote twin
  for (const up of upstream) {
    const rec = runs[up.id];
    if (!rec?.remote?.remoteOutputs) continue;
    for (const [key, localTw] of Object.entries(rec.outputs)) {
      const remoteTw = rec.remote.remoteOutputs[key];
      if (remoteTw && localTw) upstreamRemoteTwins.set(localTw.split(path.sep).join("/"), remoteTw);
    }
  }

  const uploads: Array<{ key: string; local: string; remote: string; external: boolean }> = [];
  let needsStaging = false;
  for (const [key, localRaw] of Object.entries(resolvedInputs)) {
    const local = localRaw.split(path.sep).join("/");
    const twin = upstreamRemoteTwins.get(local);
    if (twin) continue; // already on the cluster (upstream ran there)
    if (!existsSync(localRaw)) {
      return fail(`input "${key}" does not exist locally: ${local} — run the upstream job first`);
    }
    const underMirror = local.startsWith(RELION_DIR.split(path.sep).join("/"));
    if (underMirror) {
      uploads.push({ key, local: localRaw, remote: mapLocalToRemote(localRaw, remoteRoot), external: false });
    } else {
      const hash = createHash("sha1").update(local).digest("hex").slice(0, 16);
      const remote = `${remoteRoot.replace(/\/$/, "")}/_staged/${hash}/${path.basename(localRaw)}`;
      uploads.push({ key, local: localRaw, remote, external: true });
    }
    needsStaging = true;
  }

  // STARs also reference files beyond the resolved inputs (the import case:
  // micrographs.star → the movie files, referenced ABSOLUTELY or PROJECT-
  // RELATIVELY) — stage those references too. Relative refs resolve against
  // the project root and upload to the SAME relative location on the cluster
  // (the wrapper cds into the remote project root, exactly like the local
  // engine's cwd contract).
  if (needsStaging) {
    const projectRootLocal = path.join(RELION_DIR, job.projectId);
    const projectRootRemote = `${remoteRoot.replace(/\/$/, "")}/${job.projectId}`;
    const seenRefs = new Set(uploads.map((u) => `${u.local}|${u.remote}`));
    for (const u of uploads) {
      if (!/\.star$/i.test(u.local) || u.external) continue;
      try {
        const refs = refsInStar(readFileSync(u.local, "utf8"), projectRootLocal);
        for (const ref of refs) {
          const refNorm = ref.localAbs.split(path.sep).join("/");
          if (upstreamRemoteTwins.has(refNorm)) continue;
          let remote: string;
          if (ref.kind === "rel") {
            remote = `${projectRootRemote}/${ref.raw}`;
          } else {
            const underMirror = refNorm.startsWith(RELION_DIR.split(path.sep).join("/"));
            remote = underMirror
              ? mapLocalToRemote(ref.localAbs, remoteRoot)
              : `${remoteRoot.replace(/\/$/, "")}/_staged/${createHash("sha1").update(refNorm).digest("hex").slice(0, 16)}/${path.basename(ref.localAbs)}`;
          }
          const dedupe = `${ref.localAbs}|${remote}`;
          if (seenRefs.has(dedupe)) continue;
          seenRefs.add(dedupe);
          uploads.push({
            key: `${u.key}:ref`,
            local: ref.localAbs,
            remote,
            external: ref.kind === "abs" && !refNorm.startsWith(RELION_DIR.split(path.sep).join("/")),
          });
          needsStaging = true;
        }
      } catch {
        /* unreadable star → the cluster will report the real problem */
      }
    }
  }

  // ---- anti-ghost re-check (the dispatch race, t263) ---------------------
  // The pre-check above ran before several awaits (remote-root expansion).
  // A CONCURRENT dispatch — the dialog vs the auto-start passthrough — may
  // have landed a live record in that window; proceeding would clobber its
  // record (upsertRun overwrites by jobId) and swallow its fresh
  // "pending (staging)" row. Re-verify at the last serial point: any live
  // remote record we did NOT verify ourselves means someone else is
  // dispatching this job right now.
  {
    const inFlight = getRun(job.id);
    if (inFlight?.remote && inFlight.done === false && inFlight.startedAt !== prevStartedAt) {
      return {
        ok: false,
        busy: `a run for this job is already in flight on ${inFlight.remote.connectionName}${
          inFlight.remote.phase === "staging" ? " (inputs still staging)" : ""
        }`,
        busyKind: "live",
        job,
      };
    }
  }

  // ---- build the record + DB state --------------------------------------
  const startedAtMs = Date.now();
  const pendingPatch = needsStaging
    ? { status: "pending" as const, progress: 0, result: `Staging inputs to ${conn.host}${moduleName ? ` (${moduleName})` : ""}…` }
    : { status: "running" as const, progress: 0, result: null };
  const jobRow = await db.job.update({
    where: { id: job.id },
    data: { ...pendingPatch, startedAt: new Date(startedAtMs), duration: 60_000 },
  });

  const record: RunRecord = {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    pid: null,
    cmd: "(staging)",
    workdir: localWorkdir,
    logFile: path.join(localWorkdir, "run.out"),
    errFile: path.join(localWorkdir, "run.err"),
    startedAt: new Date(startedAtMs).toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
    remote: remoteState,
  };
  upsertRun(job.id, record);

  // ---- the actual work (staging + spawn) --------------------------------
  // the heartbeat runs for the WHOLE task (staging phase only — the updateRun
  // guard no-ops once the phase flips) and is stopped on both exits.
  const stopBeat = startStagingBeat(job.id);
  const spawn = async (): Promise<void> => {
    try {
      console.log(
        `remote-run: task alive — staging ${uploads.length} input file(s) for "${job.name}" to ${conn.host} (module ${moduleName || "none"})`
      );
      let stagedBytes = 0;
      // t269 — the staging leg's wall-clock cost: the ledger's first entry,
      // set when staging hands off to the spawn (visible in the inspector's
      // remote strip once the run is terminal).
      const stagedT0 = Date.now();
      for (const u of uploads) {
        stagedBytes += await stageFileTree(conn, u.local, u.remote);
        if (u.external) rememberStage(u.local, u.remote);
        await updateRun(job.id, (rec) =>
          rec.remote && rec.startedAt === record.startedAt
            ? { ...rec, remote: { ...rec.remote, stagedBytes } }
            : null
        );
      }
      const stagedMs = Date.now() - stagedT0;

      // ---- argv (cluster paths, cluster binary dir) ---------------------
      const relionHome = relionHomeFromProbe;
      const binDir = relionHome ? `${relionHome.replace(/\/$/, "")}/bin` : "<RELION_BIN>";
      const inputs: Record<string, string> = {};
      for (const [key, localRaw] of Object.entries(resolvedInputs)) {
        const local = localRaw.split(path.sep).join("/");
        inputs[key] = upstreamRemoteTwins.get(local) ?? (uploads.find((u) => u.key === key)?.remote ?? local);
      }

      const built = await buildArgv({
        binDir,
        workdir: remoteWorkdir,
        inputs,
        job: jobRef,
        upstream,
        bridge: null,
        ctffindExe: moduleName ? conn.lastProbe?.relionCtffind?.[moduleName] ?? null : null,
        // t264: the cluster's OWN externals (probed after module load) —
        // a cluster argv must never resolve motioncor2/topaz on the LOCAL disk
        externals: moduleName ? conn.lastProbe?.externals?.[moduleName] ?? null : null,
      } as Parameters<typeof buildArgv>[0]);
      if ("error" in built) throw new Error(built.error);
      let argv = built as string[];

      // strip the placeholder prefix → bare names resolved by module PATH
      if (argv[0].startsWith("<RELION_BIN>/")) argv[0] = argv[0].slice("<RELION_BIN>/".length);

      // ---- GPU adaptation (cluster GPUs are probed, not assumed) --------
      // t297 — slurm mode: the GPUs live on the COMPUTE node the scheduler
      // grants, so the login-node nvidia-smi result is irrelevant — a GPU
      // strategy > 0 gets its flags, and the MPI width is the USER-chosen
      // gpuWidth (the sbatch6gpu.sh idiom: one rank per GPU). The multi-GPU
      // TYPE SET follows the scheduler-aware strategy (hpc/slurm.ts's
      // MULTI_GPU_TYPES — class2d/class3d/refine3d/initialmodel/multibody:
      // relion_refine_mpi splits particles across ranks), NOT the local
      // engine's narrower set (which mirrors sandbox constraints). Direct
      // mode keeps the probe-driven behavior untouched.
      const strategy = gpuStrategyFor(job.type, {
        micrographs: 10,
        particles: Number(params.particles ?? 5000) || 5000,
        ...(isSlurm ? { gpus: gpuWidth } : {}),
      });
      const multiGpuType = strategy.mode === "multi-gpu";
      const mpiParallelType = isSlurm ? multiGpuType : MPI_PARALLEL_TYPES.has(job.type);
      const hasGpu = isSlurm
        ? strategy.gpus > 0
        : (conn.lastProbe?.gpus?.length ?? 0) > 0;
      const mpiAvailable = moduleName ? conn.lastProbe?.relionMpi?.[moduleName] ?? false : false;

      let ntasks = 1;
      if (mpiParallelType && mpiAvailable) {
        const nranks = isSlurm ? gpuWidth : job.type === "refine3d" ? 3 : 2;
        ntasks = nranks;
        argv = ["mpirun", "-n", String(nranks), ...argv];
        if (hasGpu && nranks > 1) argv.push("--gpu", Array.from({ length: nranks }, (_, i) => i).join(":"));
        else if (hasGpu) argv.push("--gpu", "0");
      } else {
        if (mpiParallelType) {
          // sequential fallback — mirrors the engine's no-mpirun path
          const splitIdx = argv.indexOf("--split_random_halves");
          if (splitIdx !== -1) {
            argv.splice(splitIdx, 1);
            argv.push("--debug_split_random_half", "1");
          }
          if (!argv.includes("--j")) {
            argv.push("--j", String(Math.max(1, Math.round(Number(params.threads ?? 4) || 4))));
          }
        }
        if (hasGpu && strategy.gpus > 0 && !argv.includes("--gpu")) argv.push("--gpu", "0");
      }
      // slurm mode: the --gres width follows what the argv actually uses —
      // MPI rank count for MPI jobs, one GPU for single-GPU jobs, none for
      // CPU jobs (a CPU job that requests GPUs starves the GPU queue).
      const gresWidth = isSlurm
        ? mpiParallelType && mpiAvailable
          ? gpuWidth
          : hasGpu && strategy.gpus > 0
            ? 1
            : 0
        : 0;

      // t306 — the array rewrite: the shard task sees $SHARD (its slice of
      // the input star) and $OSHARD (its own output subdir) — the two argv
      // slots are swapped for raw shell refs the script defines per task;
      // every other arg keeps its quoted literal. A rewrite that cannot
      // name its targets (no --i star, --o not the workdir root) refuses
      // the split honestly instead of submitting a script that would slice
      // the wrong file.
      let command: string;
      let arrayPlan: { total: number; concurrency: number; inputStar: string; outStar: string } | null = null;
      if (shardTotal >= 2) {
        const ii = argv.indexOf("--i");
        const oi = argv.indexOf("--o");
        const inputStar = ii >= 0 ? String(argv[ii + 1] ?? "") : "";
        const outArg = oi >= 0 ? String(argv[oi + 1] ?? "") : "";
        const outStar = ARRAY_TYPES[job.type] ?? "";
        if (!inputStar.endsWith(".star") || outArg !== remoteWorkdir + "/" || !outStar) {
          // inside the spawn task the honest exit is a THROWN error (the
          // catch below marks the record + row failed with this message) —
          // a return here could not reach the caller.
          throw new Error(
            `array split unavailable for "${job.type}": the command does not take one input STAR + the workdir as its output (the shard slicing would target the wrong file)`
          );
        }
        arrayPlan = { total: shardTotal, concurrency: ARRAY_CONCURRENCY, inputStar, outStar };
        command = argv
          .map((a, k) => (k === ii + 1 ? '"$SHARD"' : k === oi + 1 ? '"$OSHARD/"' : shQuote(a)))
          .join(" ");
      } else {
        command = argv.map(shQuote).join(" ");
      }
      const threads = Math.max(1, Math.min(32, Math.round(Number(params.threads ?? 4) || 4)));
      const jobName = `cf_${job.type}_${job.id.slice(-8)}`;

      await remoteMkdir(conn, remoteWorkdir);

      if (isSlurm) {
        // ---- t297: the sbatch door (sbatch6gpu.sh pattern) ---------------
        // t304 — the pipeline handoff: upstream jobs still in flight on THIS
        // connection contribute their slurmIds to --dependency=afterok, so
        // the scheduler orders the pipeline (the child sits PENDING — the
        // sweep already speaks that word — instead of failing on inputs that
        // are not there yet). A finished parent's outputs are already synced
        // and staged; a failed one is the user's override. Staging-phase
        // parents have no scheduler id yet and cannot ride this door.
        const depIds: string[] = [];
        const parentIds = (
          await db.edge.findMany({ where: { toJobId: job.id }, select: { fromJobId: true } })
        ).map((e) => e.fromJobId);
        if (parentIds.length) {
          const runs = readRuns();
          for (const pid of parentIds) {
            const pr = runs[pid];
            if (
              pr?.remote && !pr.done && pr.remote.connectionId === conn.id &&
              pr.remote.slurmId != null
            )
              depIds.push(pr.remote.slurmId);
          }
        }
        const dependency = depIds.length ? `afterok:${depIds.join(":")}` : null;
        const script = buildSbatchScript({
          conn,
          module: moduleName,
          relionHome,
          ctffind: moduleName ? conn.lastProbe?.relionCtffind?.[moduleName] ?? null : null,
          command,
          gpus: gresWidth,
          ntasks,
          threads,
          jobName,
          remoteProjectRoot,
          remoteWorkdir,
          partition: partitionOverride,
          nodelist: nodelistPin,
          dependency,
          array: arrayPlan,
        });
        const scriptPath = `${remoteWorkdir}/.cf-sbatch.sh`;
        const upOk = await remoteUpload(conn, script, scriptPath);
        if (!upOk) throw new Error(`could not upload the sbatch script to ${scriptPath}`);
        const subRes = await exec(conn, `sbatch ${shQuote(scriptPath)}`, { timeoutMs: 30_000 });
        const idMatch = /Submitted batch job (\d+)/.exec(subRes.stdout);
        if (!idMatch) {
          const why =
            subRes.stderr.trim().slice(0, 400) ||
            subRes.stdout.trim().slice(0, 400) ||
            subRes.error ||
            `ssh exit ${subRes.code}`;
          throw new Error(`sbatch refused the submission: ${why}`);
        }
        const slurmId = idMatch[1];

        await updateRun(job.id, (rec) =>
          rec.startedAt === record.startedAt && rec.remote
            ? {
                ...rec,
                cmd: command,
                remote: {
                  ...rec.remote,
                  slurmId,
                  slurmState: "PENDING",
                  ...(depIds.length ? { slurmDependsOn: depIds } : {}),
                  ...(arrayPlan ? { slurmArray: { total: arrayPlan.total, concurrency: arrayPlan.concurrency } } : {}),
                  phase: "running",
                  stagedBytes,
                  stagedMs,
                },
              }
            : null
        );
        await db.job.update({
          where: { id: job.id },
          data: { status: "running", progress: 0, result: null, startedAt: new Date(startedAtMs) },
        });
        stopBeat();
        console.log(
          `remote-run: ${job.type} "${job.name}" submitted to Slurm on ${conn.name} (job ${slurmId}, ${gresWidth > 0 ? `${gresWidth} GPU(s)` : "CPU"}${partitionOverride ? ` · partition ${partitionOverride}` : ""}${nodelistPin ? ` · node ${nodelistPin}` : ""}${depIds.length ? ` · afterok ${depIds.join(",")}` : ""}${arrayPlan ? ` · array 1-${arrayPlan.total}%${arrayPlan.concurrency}` : ""}, module ${moduleName || "none"})`
        );
      } else {
        // ---- direct mode: the setsid wrapper (unchanged contract) --------
        const wrapper = buildWrapperScript({
          conn,
          module: moduleName,
          relionHome,
          ctffind: moduleName ? conn.lastProbe?.relionCtffind?.[moduleName] ?? null : null,
          command,
          remoteProjectRoot,
          remoteWorkdir,
        });

        const wrapperPath = `${remoteWorkdir}/.cf-run.sh`;
        const upOk = await remoteUpload(conn, wrapper, wrapperPath);
        if (!upOk) throw new Error(`could not upload the run script to ${wrapperPath}`);

        const runRes = await exec(conn, `bash ${shQuote(wrapperPath)}`, { timeoutMs: 30_000 });
        const pidMatch = /CRYOFLOW_PID:(\d+)/.exec(runRes.stdout);
        if (!pidMatch) {
          const why =
            runRes.stderr.trim().slice(0, 400) ||
            runRes.stdout.trim().slice(0, 400) ||
            runRes.error ||
            `ssh exit ${runRes.code}`;
          throw new Error(`the cluster refused to start the job: ${why}`);
        }
        const pid = Number(pidMatch[1]);

        await updateRun(job.id, (rec) =>
          rec.startedAt === record.startedAt && rec.remote
            ? {
                ...rec,
                pid,
                cmd: command,
                remote: { ...rec.remote, pid, phase: "running", stagedBytes, stagedMs },
              }
            : null
        );
        await db.job.update({
          where: { id: job.id },
          data: { status: "running", progress: 0, result: null, startedAt: new Date(startedAtMs) },
        });
        stopBeat();
        console.log(
          `remote-run: ${job.type} "${job.name}" spawned on ${conn.name} (pid ${pid}, module ${moduleName || "none"})`
        );
      }
    } catch (e) {
      stopBeat();
      const msg = e instanceof Error ? e.message : String(e);
      // finalize the record (done=true) — a !done record would otherwise be
      // polled by the heal path forever with no pid and no exit file
      await updateRun(job.id, (rec) =>
        rec.startedAt === record.startedAt && rec.remote
          ? {
              ...rec,
              done: true,
              exitCode: -1,
              result: `remote run failed: ${msg}`.slice(0, 900),
              remote: { ...rec.remote, note: msg.slice(0, 300) },
            }
          : null
      );
      await updateJobWithRetry(job.id, {
        status: "failed",
        progress: 0,
        result: `remote run failed: ${msg}`.slice(0, 900),
      });
      console.error(`remote-run: ${job.type} "${job.name}" failed to start:`, msg);
    }
  };

  if (needsStaging) {
    // background: the route already answered "pending (staging)" — this task
    // uploads (possibly GBs) and flips the DB itself when the spawn lands
    void spawn();
    return { ok: true, staging: true, job: jobRow };
  }
  await spawn();
  const finalRow = await db.job.findUnique({ where: { id: job.id } });
  if (finalRow && finalRow.status === "failed") {
    const rec = getRun(job.id);
    return fail(rec?.result?.replace(/^remote run failed: /, "") ?? "remote spawn failed");
  }
  return { ok: true, started: true, job: finalRow ?? jobRow };
}

/* ------------------------------------------------------------------ */
/* Polling (batched per connection)                                    */
/* ------------------------------------------------------------------ */

type PollVerdict = "alive" | "exit" | "vanished" | "unknown" | "busy" | "staging";

/** Inspect ONE record (used by the pre-spawn guard). */
async function pollOneRemote(conn: RemoteConnection, rec: RunRecord): Promise<PollVerdict> {
  const r = rec.remote;
  if (!r) return "unknown";
  if (r.phase === "staging") return "staging";
  const script = aliveCheckScript(r.remoteWorkdir, r.slurmId);
  const res = await exec(conn, script, { timeoutMs: 10_000 });
  if (res.error) return res.error === "busy" ? "busy" : "unknown";
  if (/^EXIT:/m.test(res.stdout)) return "exit";
  if (/^ALIVE/m.test(res.stdout)) return "alive";
  // t299 — the scheduler's terminal verdict is an exit: the script only
  // emits SACCT: for accounting words that ended the run, so the pre-spawn
  // guard can treat the record as finished (the sweep does the finalize)
  if (/^SACCT:/m.test(res.stdout)) return "exit";
  if (/^VANISHED/m.test(res.stdout)) return "vanished";
  return "unknown";
}

/**
 * The alive-check snippet shared by the single poll + the batch sweep:
 * EXIT:<code> when the wrapper wrote its exit file; for DIRECT runs ALIVE
 * only when the recorded pid AND its /proc starttime (field 22) still match
 * (recycled pids can never fake liveness), VANISHED otherwise; for SLURM
 * runs (t297) the scheduler is the witness — squeue still knowing the job
 * means queued/running/completing, and the state word rides the line
 * (ALIVE:PENDING / ALIVE:RUNNING) so the UI can say "queued" honestly.
 * t299 — squeue purges finished jobs almost immediately, so a vanished
 * .cf-exit (NFS lag, node gone mid-write) used to fall straight through to
 * VANISHED and age into a false "interrupted remotely" failure. The third
 * witness closes that hole: sacct serves the controller's OWN terminal
 * verdict (COMPLETED/FAILED/CANCELLED/TIMEOUT/…) from the accounting
 * ledger — terminal words ride out as SACCT:<state>|<exit>:<sig> for the
 * sweep to map onto the exit contract, in-flight words (rare accounting
 * lag) stay ALIVE, and an empty verdict (no accounting row either) is the
 * only thing still allowed to mean VANISHED.
 */

/**
 * t303 — the scheduler's stopwatch dialect: Elapsed as sacct prints it
 * ([[DD-]hh:]mm:ss — under an hour it is mm:ss, over a day it carries the
 * day prefix) → ms. Anything else stays null: an unparseable column is
 * silence, never a guess.
 */
function parseSlurmElapsed(s?: string): number | null {
  if (!s) return null;
  const t = s.trim();
  let days = 0;
  let rest = t;
  const dm = /^(\d+)-(.*)$/.exec(t);
  if (dm) {
    days = Number(dm[1]);
    rest = dm[2];
  }
  const p = rest.split(":").map(Number);
  if (p.length < 2 || p.length > 3 || p.some((n) => !Number.isFinite(n))) return null;
  const [h, m, sec = 0] = p.length === 3 ? p : [0, p[0], p[1]];
  return ((days * 24 + h) * 3600 + m * 60 + sec) * 1000;
}

/**
 * t303 — the scheduler's meter dialect: MaxRSS as sacct prints it (a number
 * with an optional K/M/G/T suffix, bare = KiB) → bytes. Empty (the common
 * case when accounting TRES usage is off) stays null.
 */
function parseSlurmMaxRss(s?: string): number | null {
  if (!s) return null;
  const m = /^([\d.]+)([KMGT])?$/.exec(s.trim());
  if (!m) return null;
  const mult = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }[m[2] ?? "K"] ?? 1024;
  return Math.round(Number(m[1]) * mult);
}

/**
 * t303 — one terminal accounting row ("STATE|exit:sig|Elapsed|MaxRSS", real
 * sacct's "CANCELLED by <uid>" tolerated) → its parts. The Elapsed/MaxRSS
 * columns are optional: a ledger that never served them parses the same
 * three-lead row it always did.
 */
function parseSacctRow(raw: string): {
  word: string;
  exitNum: number;
  sigNum: number;
  elapsedMs: number | null;
  maxRssBytes: number | null;
} | null {
  const m = /^([A-Z_]+)(?:\s+by\s+\d+)?\|(\d+):(\d+)(?:\|([^|]*)\|([^|]*))?/.exec(raw.trim());
  if (!m) return null;
  return {
    word: m[1],
    exitNum: Number(m[2]),
    sigNum: Number(m[3]),
    elapsedMs: parseSlurmElapsed(m[4]),
    maxRssBytes: parseSlurmMaxRss(m[5]),
  };
}

/**
 * t303 — the ledger's stopwatch + meter onto the record. Fired from BOTH
 * exit paths (the wrapper's EXIT with the sacct line riding along, and the
 * SACCT-fallback verdict itself); never overwrites a done record, and only
 * writes when there is something new to say (the state word moved, or a
 * column the record does not carry yet).
 */
function persistSacctTestimony(
  e: BatchEntry,
  row: NonNullable<ReturnType<typeof parseSacctRow>>,
  includeWord: boolean
): void {
  if (e.remote.slurmId == null) return;
  const patch: Partial<RemoteRunState> = {};
  if (includeWord && e.remote.slurmState !== row.word) patch.slurmState = row.word;
  if (row.elapsedMs != null && e.remote.slurmElapsedMs == null) patch.slurmElapsedMs = row.elapsedMs;
  if (row.maxRssBytes != null && e.remote.slurmMaxRssBytes == null) patch.slurmMaxRssBytes = row.maxRssBytes;
  if (Object.keys(patch).length === 0) return;
  Object.assign(e.remote, patch);
  updateRun(e.job.id, (rec) =>
    rec.remote && !rec.done ? { ...rec, remote: { ...rec.remote, ...patch } } : null
  );
}

/**
 * t305 — does the ledger's terminal word tell the SAME story as the
 * wrapper's exit? The mapping is the fallback's OWN exit contract
 * (CANCELLED→143, TIMEOUT→124, exit/sig otherwise): agreement means the
 * scheduler's word may decorate the record (and the strip's
 * '· Slurm COMPLETED' finally speaks on the happy path — t299's terminal
 * word used to be fallback-only, nearly dead code). A disagreement (a
 * scancel landing in the script's final breath, a wrapper that survived a
 * TIMEOUT kill) keeps the word silent: the wrapper's exit is the verdict,
 * the word is vocabulary, and the strip never renders a contradiction.
 */
function wordAgreesWithExit(
  row: NonNullable<ReturnType<typeof parseSacctRow>>,
  exitCode: number
): boolean {
  const mapped =
    row.word === "CANCELLED"
      ? 143
      : row.word === "TIMEOUT"
        ? 124
        : row.exitNum !== 0
          ? row.exitNum
          : row.sigNum !== 0
            ? 128 + row.sigNum
            : 0;
  return mapped === exitCode;
}

function aliveCheckScript(remoteWorkdir: string, slurmId?: string | null): string {
  const W = shQuote(remoteWorkdir);
  const EXIT = shQuote(remoteWorkdir + "/.cf-exit");
  if (slurmId) {
    const J = shQuote(String(Number(slurmId)));
    // t303 — the query grew the scheduler's stopwatch and meter (Elapsed,
    // MaxRSS); both branches speak the same 4-column grammar so the verdict
    // and its ledger line arrive in ONE SSH round trip. A TEMPLATE literal —
    // the first draft used a plain string and ${J} shipped LITERALLY into
    // the shell script, where set -u doomed every $() to an empty verdict
    // (VANISHED for jobs the ledger knew all about — the t302 suite's live
    // C-phase caught what the source assertions could not).
    const AC = `sacct -j ${J} -n -P -o State,ExitCode,Elapsed,MaxRSS 2>/dev/null | head -1`;
    return (
      `if [ -f ${EXIT} ]; then echo "EXIT:$(cat ${EXIT} 2>/dev/null)"; ` +
      // t303 — the wrapper's exit usually wins the race, but the ledger's
      // stopwatch rides ALONG: a terminal accounting row (and only a
      // terminal one — accounting lag must never fake a verdict) is echoed
      // as a second line for the block parser to stow.
      `__ac="$(${AC})"; case "$__ac" in ` +
      `COMPLETED*|FAILED*|CANCELLED*|TIMEOUT*|NODE_FAIL*|BOOT_FAIL*|OUT_OF_*|PREEMPTED*|DEADLINE*|SPECIAL_EXIT*) echo "SACCT:$__ac" ;; esac; ` +
      `else __st="$(squeue -j ${J} -h -o %T 2>/dev/null | head -1)"; ` +
      `if [ -n "$__st" ]; then echo "ALIVE:$__st"; ` +
      `else __ac="$(${AC})"; ` +
      `case "$__ac" in ` +
      `PENDING*|RUNNING*|COMPLETING*) echo "ALIVE:${"${"}__ac%%|*}" ;; ` +
      `COMPLETED*|FAILED*|CANCELLED*|TIMEOUT*|NODE_FAIL*|BOOT_FAIL*|OUT_OF_*|PREEMPTED*|DEADLINE*|SPECIAL_EXIT*) echo "SACCT:$__ac" ;; ` +
      `*) echo VANISHED ;; esac; fi; fi`
    );
  }
  return (
    `__ps="$(cat ${W}/.cf-pid 2>/dev/null)"; __p="${'${'}__ps%% *}"; __st="${'${'}__ps##* }"; ` +
    `if [ -f ${EXIT} ]; then echo "EXIT:$(cat ${EXIT} 2>/dev/null)"; ` +
    `elif [ -n "$__p" ] && [ -r "/proc/$__p/stat" ] && [ "$(awk '{print \$22}' /proc/$__p/stat 2>/dev/null)" = "$__st" ] && kill -0 "$__p" >/dev/null 2>&1; then echo ALIVE; ` +
    `else echo VANISHED; fi`
  );
}

/** Per-connection poll throttle state (survives within one server process). */
const pollState = new Map<string, { at: number; inflight: boolean }>();

interface BatchEntry {
  job: Job;
  rec: RunRecord;
  /** non-null by construction (entries are filtered on rec.remote) */
  remote: RemoteRunState;
}

/**
 * The remote poll sweep — the twin of reconcileRealJobs. Called by the jobs
 * GET route on every poll tick: one batched SSH round trip per connection
 * covers ALL of its running jobs (state + log tail), then completions
 * finalize (sync-back → collectOutputs → DB flip → downstream auto-start).
 *
 * Records for jobs whose DB row is no longer "running" still get finalized
 * (sync-back + done flag) — the heal path for stop/restart races.
 */
export async function reconcileRemoteJobs(jobs: Job[]): Promise<Job[]> {
  const runs = readRuns();
  const active: BatchEntry[] = [];
  const heal: BatchEntry[] = [];
  const stagingEntries: BatchEntry[] = [];
  const orphans: Array<{ job: Job; rec: RunRecord }> = [];
  const out = [...jobs];
  for (const job of jobs) {
    const rec = runs[job.id];
    if (!rec?.remote) continue;
    if (rec.done) {
      // ORPHAN: the record finalized but the row never reached a terminal
      // state — the finalize flip was swallowed (SQLITE_BUSY, a crash
      // between record and row, t262 finding #2). The RECORD is the truth;
      // re-apply it below (no SSH needed). The status guard keeps a live
      // user re-run safe: only a non-terminal row may be healed.
      if (job.status === "running" || job.status === "pending") orphans.push({ job, rec });
      continue;
    }
    const entry: BatchEntry = { job, rec, remote: rec.remote };
    if (rec.remote.phase === "staging") {
      // staging records are owned by their background task — an SSH
      // alive-check would read no pid and report VANISHED for a HEALTHY
      // upload (finalize-killing legitimate staging > 2min). They are
      // judged ledger-side by the heartbeat windows below.
      stagingEntries.push(entry);
      continue;
    }
    if (job.status === "running" || job.status === "pending") active.push(entry);
    else heal.push(entry);
  }

  // ---- orphan heal (ledger-side, no SSH) --------------------------------
  for (const { job, rec } of orphans) {
    const result = rec.result ?? (rec.exitCode === 0 ? "REMOTE run completed" : "remote run failed");
    const patch: Prisma.JobUpdateInput =
      rec.exitCode === 0
        ? {
            status: "completed",
            progress: 100,
            result,
            duration: Math.max(500, Date.now() - new Date(rec.startedAt).getTime()),
          }
        : { status: "failed", progress: 0, result };
    // conditional flip — only a non-terminal row may be healed (a fresh
    // dispatch that already re-owned the row must never be reverted)
    const flipped = await db.job
      .updateMany({ where: { id: job.id, status: { in: ["running", "pending"] } }, data: patch })
      .catch(() => null);
    if (flipped && flipped.count > 0) {
      const healed = await db.job.findUnique({ where: { id: job.id } });
      if (healed) replace(out, healed);
      console.log(
        `remote-run: healed orphan row for "${job.name}" (record said ${
          rec.exitCode === 0 ? "completed" : `exit ${rec.exitCode}`
        }, row was stuck ${job.status})`
      );
    }
  }

  // ---- staging heartbeat windows (ledger-side, no SSH) ------------------
  // Two honest ways to be stale:
  //  - heartbeat older than 2min  → the task vanished mid-flight (its
  //    catch never ran — a hung SSH exec, or the process died quietly)
  //  - no heartbeat at all + older than 30min → pre-heartbeat ledger or a
  //    server restart before the first beat (the old fallback, kept)
  for (const e of stagingEntries) {
    if (e.job.status !== "pending" && e.job.status !== "idle") continue;
    const ageMs = Date.now() - new Date(e.rec.startedAt).getTime();
    const beatAge = e.remote.stagingBeat != null ? Date.now() - e.remote.stagingBeat : null;
    const stale = beatAge != null ? beatAge > STAGING_BEAT_STALE_MS : ageMs > 30 * 60_000;
    if (!stale) continue;
    const msg =
      "staging to the cluster was interrupted (the upload task vanished or the server restarted) — re-run to continue where it left off (uploaded files are skipped)";
    const flipped = await db.job
      .updateMany({
        where: { id: e.job.id, status: { in: ["pending", "idle"] } },
        data: { status: "failed", progress: 0, result: msg },
      })
      .catch(() => null);
    if (flipped && flipped.count > 0) {
      const healed = await db.job.findUnique({ where: { id: e.job.id } });
      if (healed) replace(out, healed);
      // finalize the record too so the liveness guard stops seeing a
      // ghost staging run — but only if the task has not JUST flipped it
      updateRun(e.job.id, (rec) =>
        rec.remote && !rec.done && rec.remote.phase === "staging"
          ? { ...rec, done: true, exitCode: -1, result: msg, remote: { ...rec.remote, note: "staging interrupted" } }
          : null
      );
      console.log(
        `remote-run: staging for "${e.job.name}" went stale (heartbeat ${
          beatAge == null ? "absent" : `${Math.round(beatAge / 1000)}s old`
        }) — row failed honestly`
      );
    }
  }

  if (active.length === 0 && heal.length === 0) return out;

  // group by connection
  const byConn = new Map<string, BatchEntry[]>();
  for (const e of [...active, ...heal]) {
    const list = byConn.get(e.remote.connectionId) ?? [];
    list.push(e);
    byConn.set(e.remote.connectionId, list);
  }

  for (const [connId, entries] of byConn) {
    const conn = getConnection(connId);
    if (!conn) {
      for (const e of entries) {
        if (e.job.status !== "running") continue;
        const patch = {
          status: "failed" as const,
          progress: 0,
          result: "the cluster connection for this run was deleted — re-add it and re-run",
        };
        const updated = await updateJobWithRetry(e.job.id, patch);
        if (updated) replace(out, updated);
        updateRun(e.job.id, (rec) => (rec.remote ? { ...rec, done: true, exitCode: -1, result: patch.result } : null));
      }
      continue;
    }

    // throttle: skip this connection entirely on a sub-4s tick or while a
    // poll is still in flight (slow SSH must never stack round trips)
    const st = pollState.get(connId) ?? { at: 0, inflight: false };
    if (st.inflight || Date.now() - st.at < 4000) continue;
    pollState.set(connId, { at: Date.now(), inflight: true });

    try {
      const scriptLines: string[] = ["set -u"];
      for (const e of entries) {
        const r = e.remote;
        const W = shQuote(r.remoteWorkdir);
        scriptLines.push(`echo "===CF:START:${e.job.id}"`);
        scriptLines.push(aliveCheckScript(r.remoteWorkdir, r.slurmId));
        scriptLines.push(`echo "---LOG---"`);
        scriptLines.push(`tail -c 4096 ${W}/run.out 2>/dev/null`);
        scriptLines.push(`echo "===CF:END:${e.job.id}"`);
      }
      const res = await exec(conn, scriptLines.join("\n"), { timeoutMs: 15_000 });
      if (res.error) {
        // busy / timeout / network: the CLUSTER process is unaffected — keep
        // everything running and retry next tick
        continue;
      }
      // parse per-job blocks. t303 — the status is still the FIRST line,
      // but a terminal sacct row may now ride as a SECOND line (the EXIT
      // branch's ledger enrichment) — stow it as b.sacct before the log.
      const blocks = new Map<string, { status: string; sacct?: string; log: string }>();
      const re = /===CF:START:([\w-]+)\n([\s\S]*?)===CF:END:\1/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(res.stdout)) !== null) {
        const body = m[2];
        const nl = body.indexOf("\n");
        const status = body.slice(0, nl).trim();
        const rest = body.slice(nl + 1);
        const nl2 = rest.indexOf("\n");
        const line2 = (nl2 >= 0 ? rest.slice(0, nl2) : rest).trim();
        const sacct = line2.startsWith("SACCT:") ? line2.slice("SACCT:".length) : undefined;
        const log = body.includes("---LOG---") ? body.slice(body.indexOf("---LOG---") + 10) : "";
        blocks.set(m[1], { status, sacct, log: log.replace(/\n$/, "") });
      }

      for (const e of entries) {
        const b = blocks.get(e.job.id);
        if (!b) continue;
        const ageMs = Date.now() - new Date(e.rec.startedAt).getTime();
        if (/^ALIVE/.test(b.status)) {
          // t297 — slurm records speak their scheduler state (ALIVE:PENDING /
          // ALIVE:RUNNING): persist it for the inspector's strip so "queued"
          // and "running" are two honest words, not one merged guess.
          const slurmState = b.status.startsWith("ALIVE:") ? b.status.slice("ALIVE:".length) : null;
          if (slurmState && e.remote.slurmId != null && e.remote.slurmState !== slurmState) {
            e.remote.slurmState = slurmState;
            updateRun(e.job.id, (rec) =>
              rec.remote && !rec.done
                ? { ...rec, remote: { ...rec.remote, slurmState } }
                : null
            );
          }
          if (e.job.status !== "running") continue; // heal path: still alive, nothing to do
          const progress = parseProgressText(e.job.type, b.log, parseJobParams(e.job.params));
          if (progress != null && progress !== e.job.progress) {
            replace(out, { ...e.job, progress });
          }
          continue;
        }
        const exitMatch = /^EXIT:\s*(-?\d+)/.exec(b.status);
        if (exitMatch) {
          const exitCode = Number(exitMatch[1]);
          // t303 — the wrapper's verdict wins, the ledger's stopwatch rides:
          // a terminal SACCT line on the EXIT block enriches the record
          // (Elapsed/MaxRSS) without touching the verdict.
          // t305 — AND the word can finally speak: when the ledger's terminal
          // word agrees with the wrapper's exit (the fallback's own mapping
          // equals the exit code), the record carries the scheduler's word
          // too — the strip's '· Slurm COMPLETED' is no longer fallback-only.
          // A disagreement keeps the old silence and says so out loud.
          const witness = b.sacct ? parseSacctRow(b.sacct) : null;
          let agreed = false;
          if (witness) {
            agreed = wordAgreesWithExit(witness, exitCode);
            if (!agreed) {
              console.log(
                `remote-run: the ledger says ${witness.word} but the wrapper exited ${exitCode} for "${e.job.name}" — the word stays silent (the verdict is the wrapper's)`
              );
            }
          }
          if (witness) persistSacctTestimony(e, witness, agreed);
          const updated = await finalizeRemoteRun(e.job, e.rec, exitCode, b.log, conn);
          if (updated) replace(out, updated);
          continue;
        }
        // t299 — the accounting fallback: squeue went silent AND the exit
        // file never landed, but the scheduler's ledger still knows the
        // truth. Map the terminal word onto the SAME exit contract the
        // wrapper would have written, so finalize (sync-back → outputs →
        // DB flip) runs the one honest path instead of the false
        // "interrupted remotely" tombstone.
        const witness = b.status.startsWith("SACCT:") ? parseSacctRow(b.status.slice("SACCT:".length)) : null;
        if (witness) {
          const { word, exitNum, sigNum } = witness;
          // CANCELLED is the stop contract (t297's TERM trap writes 143 —
          // the scheduler's own accounting must speak the same word); a
          // signal death with a clean exit rides 128+sig; TIMEOUT killed
          // by the walltime limit is a failure even when the step itself
          // exited 0 (timeout(1)'s 124, the batch world's shared idiom)
          const mapped =
            word === "CANCELLED" ? 143 : exitNum !== 0 ? exitNum : sigNum !== 0 ? 128 + sigNum : 0;
          const exitCode = word === "TIMEOUT" && mapped === 0 ? 124 : mapped;
          persistSacctTestimony(e, witness, true);
          const updated = await finalizeRemoteRun(e.job, e.rec, exitCode, b.log, conn);
          if (updated) replace(out, updated);
          continue;
        }
        if (b.status === "VANISHED" && ageMs > 120_000) {
          // no pid, no exit file, older than the startup grace window — the
          // node rebooted or someone killed the session without a trace
          if (e.job.status === "running") {
            const patch = {
              status: "failed" as const,
              progress: 0,
              result: `interrupted remotely (no exit status — node reboot or hard kill); re-run${
                ["class2d", "class3d", "refine3d", "initialmodel", "multibody"].includes(e.job.type)
                  ? " resumes from the last synced checkpoint"
                  : ""
              }`,
            };
            const updated = await updateJobWithRetry(e.job.id, patch);
            updateRun(e.job.id, (rec) => (rec.remote ? { ...rec, done: true, exitCode: -1, result: patch.result } : null));
            if (updated) replace(out, updated);
          } else {
            // heal path: the DB row already left "running" (stopped by the
            // user / failed earlier) but the record never finalized (a
            // SIGKILL'd wrapper cannot write its exit file) — finalize the
            // RECORD so the liveness guard stops reporting a ghost run
            updateRun(
              e.job.id,
              (rec) =>
                rec.remote && !rec.done
                  ? { ...rec, done: true, exitCode: rec.exitCode ?? 137, result: rec.result ?? "stopped/interrupted remotely" }
                  : null
            );
          }
        }
      }
    } finally {
      pollState.set(connId, { at: Date.now(), inflight: false });
    }
  }
  return out;
}

function replace(list: Job[], job: Job): void {
  const i = list.findIndex((j) => j.id === job.id);
  if (i >= 0) list[i] = job;
}

/* ------------------------------------------------------------------ */
/* Finalize (sync-back + outputs + DB)                                 */
/* ------------------------------------------------------------------ */

async function finalizeRemoteRun(
  job: Job,
  rec: RunRecord,
  exitCode: number,
  remoteLogTail: string,
  conn: RemoteConnection
): Promise<Job | null> {
  const r = rec.remote;
  if (!r) return null; // defensive: entries are pre-filtered on rec.remote
  const localWorkdir = rec.workdir;
  // t269 — the sync-back leg's wall-clock cost: the ledger's second entry,
  // set at finalize (the run itself is already over; this is the wait the
  // user still feels before the results appear).
  const syncT0 = Date.now();
  const sync = await syncBackWorkdir(conn, r, localWorkdir);
  const syncMs = Date.now() - syncT0;

  let outputs: Record<string, string> = {};
  let result: string;
  if (exitCode === 0) {
    const collected = collectOutputs(job.type, localWorkdir);
    outputs = collected.outputs;
    const origin = `${r.user}@${r.host.split(":")[0]}${r.module ? ` · ${r.module}` : ""}`;
    result =
      collected.outputs && Object.keys(collected.outputs).length > 0
        ? `REMOTE[${origin}]: ${collected.result.replace(/^REAL: /, "")}`
        : `REMOTE[${origin}]: exited 0 but no expected outputs appeared — check the log tab`;
  } else {
    const meaning = describeExitCode(exitCode);
    const errTail = tailText(path.join(localWorkdir, "run.err"), 400) || remoteLogTail.slice(-400);
    result = [
      `REMOTE[${r.user}@${r.host.split(":")[0]}]: exit ${exitCode}${meaning ? ` (${meaning})` : ""}`,
      errTail.trim() ? errTail.trim().split("\n").slice(-4).join(" ") : "",
      sync.note,
    ]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 900);
  }

  // remote twins for the outputs (downstream remote jobs consume these
  // without any re-upload)
  const remoteOutputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(outputs)) {
    remoteOutputs[k] = mapLocalToRemote(v, r.remoteRoot);
  }

  updateRun(job.id, (cur) =>
    cur.startedAt === rec.startedAt && cur.remote
      ? {
          ...cur,
          done: true,
          exitCode,
          outputs,
          result,
          remote: {
            ...cur.remote,
            remoteOutputs,
            syncedFiles: sync.files,
            syncedBytes: sync.bytes,
            skippedFiles: sync.skipped.slice(0, 50),
            syncMs,
            ...(sync.note ? { note: sync.note } : {}),
          },
        }
      : null
  );

  const patch =
    exitCode === 0
      ? {
          status: "completed" as const,
          progress: 100,
          result,
          duration: Math.max(500, Date.now() - new Date(rec.startedAt).getTime()),
        }
      : { status: "failed" as const, progress: 0, result };
  // SQLITE_BUSY-safe flip (t262 finding #2): a swallowed flip used to leave
  // the row non-terminal forever — the orphan sweep now backs this up too.
  const updated = await updateJobWithRetry(job.id, patch);
  if (updated && exitCode === 0) {
    // downstream auto-start — same cluster (the trigger's remote target
    // passes through so a remote pipeline stays remote)
    void import("@/lib/relion/dispatch")
      .then((m) => m.autoStartPendingDownstream(job.id))
      .catch((e) => console.error("remote-run: downstream auto-start failed:", e));
  }
  if (updated) console.log(`remote-run: ${job.type} "${job.name}" exit ${exitCode} (${sync.files} files synced, ${sync.skipped.length} skipped)`);
  return updated;
}

interface SyncResult {
  files: number;
  bytes: number;
  skipped: string[];
  note?: string;
}

/** t289 — extensions that ALWAYS sync under the key-files policy: the
 * small textual skeleton of a RELION run (particles/metadata/logs). Bulky
 * binary formats (.mrc/.mrcs/.map/.hdf/…) are gated by the key-file size
 * cap instead — class averages (a few MB) come home, half-maps and stacks
 * stay on the cluster and wait for an explicit fetch. */
const KEY_TEXT_EXT =
  /\.(star|log|txt|out|err|json|xml|com|lst|coord|bild|dat|eps|pdf|csv|ini|toml|ya?ml|md)$/i;

/**
 * Download the cluster workdir into the local mirror (bounded by the
 * connection's caps AND — since t289 — its sync policy). STAR files are
 * rewritten to-local so downstream LOCAL jobs and the results viewers work
 * unchanged. `.cf-*` control files stay remote-only. The FULL remote
 * listing lands in `.cf-remote-manifest.json` so the outputs view can show
 * what stayed behind. Returns counts + the skipped list for the UI.
 */
async function syncBackWorkdir(
  conn: RemoteConnection,
  r: RemoteRunState,
  localWorkdir: string
): Promise<SyncResult> {
  const res: SyncResult = { files: 0, bytes: 0, skipped: [] };
  const W = shQuote(r.remoteWorkdir);
  const manifest = await exec(
    conn,
    `cd ${W} 2>/dev/null && find . -type f -not -name '.cf-*' -printf '%P\\t%s\\n' 2>/dev/null | head -4000`,
    { timeoutMs: 15_000 }
  );
  if (manifest.error || manifest.code !== 0) {
    res.note = "sync-back failed (workdir unreadable over SSH) — outputs remain on the cluster";
    return res;
  }
  // t289 — the policy: key-files (default) gates binaries at keyFileMb;
  // everything keeps the pre-t289 behavior (caps only).
  const policy = conn.syncPolicy === "everything" ? "everything" : "key-files";
  const keyCap = (conn.keyFileMb ?? 16) * 1024 * 1024;
  const capPerFile = conn.maxFileMb * 1024 * 1024;
  let budget = conn.maxTotalMb * 1024 * 1024;
  const entries: { rel: string; size: number }[] = [];
  for (const line of manifest.stdout.trim().split("\n")) {
    if (!line.trim()) continue;
    const tab = line.lastIndexOf("\t");
    if (tab < 0) continue;
    const rel = line.slice(0, tab).trim();
    const size = Number(line.slice(tab + 1).trim());
    if (!rel || !Number.isFinite(size)) continue;
    entries.push({ rel, size });
  }
  // t289 — the ledger FIRST: even a sync that dies mid-way leaves the
  // outputs view knowing what the cluster holds (sizes included).
  writeRemoteManifest(localWorkdir, {
    connectionId: r.connectionId,
    remoteWorkdir: r.remoteWorkdir,
    files: entries.map((e) => ({ path: e.rel, size: e.size })),
  });
  for (const { rel, size } of entries) {
    if (policy === "key-files" && !KEY_TEXT_EXT.test(rel) && size > keyCap) {
      res.skipped.push(`${rel} (${(size / 1024 / 1024).toFixed(0)} MB > ${conn.keyFileMb ?? 16} MB key-file cap)`);
      continue;
    }
    if (size > capPerFile) {
      res.skipped.push(`${rel} (${(size / 1024 / 1024).toFixed(0)} MB > ${conn.maxFileMb} MB cap)`);
      continue;
    }
    if (budget - size < 0) {
      res.skipped.push(`${rel} (sync budget exhausted)`);
      continue;
    }
    const localPath = path.join(localWorkdir, rel);
    // fresh copy already there? skip (idempotent re-finalize)
    try {
      if (existsSync(localPath) && statSync(localPath).size === size) {
        res.files += 1;
        continue;
      }
    } catch {
      /* re-download */
    }
    const written = await remoteDownload(conn, `${r.remoteWorkdir}/${rel}`, localPath, capPerFile);
    if (written == null) {
      res.skipped.push(`${rel} (download failed)`);
      continue;
    }
    if (written === -1) {
      res.skipped.push(`${rel} (grew past the cap mid-download)`);
      continue;
    }
    budget -= written;
    res.bytes += written;
    res.files += 1;
    // STAR rewrite to-local (in place)
    if (/\.star$/i.test(localPath)) {
      try {
        const text = readFileSync(localPath, "utf8");
        const rewritten = rewriteStarPaths(text, "to-local", r.remoteRoot);
        if (rewritten !== text) writeFileSync(localPath, rewritten);
      } catch {
        /* best-effort */
      }
    }
  }
  if (res.skipped.length > 0) {
    res.note =
      policy === "key-files"
        ? `${res.skipped.length} bulky file(s) stayed on the cluster (key-files policy): ${res.skipped.slice(0, 3).join(", ")}${res.skipped.length > 3 ? " …" : ""} — they are listed in this job's Results; preview or download them there on demand`
        : `${res.skipped.length} file(s) stayed on the cluster (caps): ${res.skipped.slice(0, 3).join(", ")}${res.skipped.length > 3 ? " …" : ""} — raise the sync caps in the connection settings or fetch them manually from ${r.remoteWorkdir}`;
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Log tail + stop + DTO enrichment                                    */
/* ------------------------------------------------------------------ */

/** Live log tail for remote records (the /log route's remote branch). */
export async function remoteLogTail(jobId: string, opts: { full?: boolean }): Promise<RemoteLogPayload | null> {
  const rec = getRun(jobId);
  if (!rec?.remote) return null;
  const conn = getConnection(rec.remote.connectionId);
  if (!conn) return { text: "(the connection for this run was deleted — logs stay on the cluster)", totalLines: 0, truncated: false };
  const capOut = opts.full ? 8 * 1024 * 1024 : 512 * 1024;
  const capErr = opts.full ? 1024 * 1024 : 64 * 1024;
  const W = shQuote(rec.remote.remoteWorkdir);
  const res = await exec(
    conn,
    `wc -l < ${W}/run.out 2>/dev/null || echo 0; echo ---CF-SPLIT---; tail -c ${capOut} ${W}/run.out 2>/dev/null; echo ---CF-SPLIT---; tail -c ${capErr} ${W}/run.err 2>/dev/null`,
    { timeoutMs: 15_000 }
  );
  if (res.error) {
    return { text: `(log fetch failed: ${res.error})`, totalLines: 0, truncated: false };
  }
  const parts = res.stdout.split("---CF-SPLIT---");
  const totalLines = Number((parts[0] ?? "0").trim()) || 0;
  let out = (parts[1] ?? "").replace(/^\n/, "");
  const err = (parts[2] ?? "").replace(/^\n/, "");
  if (err.trim().length > 0) out += "\n----- stderr -----\n" + err;
  // collapse \r-updated lines like getLogTail does
  const lines = out
    .split("\n")
    .map((line) => {
      const idx = line.lastIndexOf("\r");
      return (idx >= 0 ? line.slice(idx + 1) : line).replace(/\s+$/, "");
    });
  const tail = opts.full ? lines : lines.slice(-600);
  return {
    text: tail.join("\n"),
    totalLines,
    truncated: totalLines > tail.length,
  };
}

/** Kill the cluster-side session — the stop route's branch.
 *  t297: slurm records die by scancel (the scheduler owns the tree on the
 *  compute node; a login-node kill could never reach it). */
export async function remoteStopRun(jobId: string): Promise<{ stopped: boolean; message: string }> {
  const rec = getRun(jobId);
  if (!rec?.remote) return { stopped: false, message: "not a remote run" };
  const conn = getConnection(rec.remote.connectionId);
  if (!conn) return { stopped: false, message: "the connection for this run was deleted — kill the process on the cluster manually" };
  const r = rec.remote;
  if (r.mode === "slurm" && r.slurmId) {
    const res = await exec(conn, `scancel ${shQuote(String(Number(r.slurmId)))}`, { timeoutMs: 15_000 });
    const ok = res.code === 0 && !res.error;
    return {
      stopped: ok,
      message: ok
        ? `sent scancel to Slurm job ${r.slurmId} — the scheduler tears the process tree down on the compute node`
        : `scancel ${r.slurmId} failed${res.stderr.trim() ? `: ${res.stderr.trim().slice(0, 200)}` : " (already finished?)"}`,
    };
  }
  const W = shQuote(rec.remote.remoteWorkdir);
  const res = await exec(
    conn,
    `P=$(cat ${W}/.cf-pid 2>/dev/null); ` +
      `if [ -n "$P" ]; then kill -- -$P 2>/dev/null; kill $P 2>/dev/null; sleep 1; kill -9 -- -$P 2>/dev/null; kill -9 $P 2>/dev/null; echo KILLED; ` +
      `else echo NOPID; fi`,
    { timeoutMs: 15_000 }
  );
  const killed = /KILLED/.test(res.stdout);
  return {
    stopped: killed,
    message: killed
      ? `sent SIGTERM+SIGKILL to the cluster-side session (pid group ${rec.remote.pid})`
      : "no live cluster pid found (already exited?)",
  };
}

/** DTO enrichment: what the UI knows about a job's remote execution. */
export function remoteInfoFor(jobId: string): RemoteRunInfo | null {
  const rec = readRuns()[jobId];
  if (!rec?.remote) return null;
  const r = rec.remote;
  return {
    connectionId: r.connectionId,
    connectionName: r.connectionName,
    host: r.host,
    user: r.user,
    module: r.module,
    mode: r.mode,
    remoteWorkdir: r.remoteWorkdir,
    ...(r.pid != null ? { pid: r.pid } : {}),
    ...(r.slurmId != null ? { slurmId: r.slurmId } : {}),
    ...(r.slurmState ? { slurmState: r.slurmState } : {}),
    ...(r.gpusRequested != null ? { gpusRequested: r.gpusRequested } : {}),
    ...(r.partition ? { partition: r.partition } : {}),
    // t303 — the scheduler's stopwatch + meter ride the DTO so the
    // inspector's terminal strip can speak the ledger's own numbers.
    ...(r.slurmElapsedMs != null ? { slurmElapsedMs: r.slurmElapsedMs } : {}),
    ...(r.slurmMaxRssBytes != null ? { slurmMaxRssBytes: r.slurmMaxRssBytes } : {}),
    ...(r.slurmDependsOn?.length ? { slurmDependsOn: r.slurmDependsOn } : {}),
    ...(r.slurmArray ? { slurmArray: r.slurmArray } : {}),
    phase: r.phase,
    ...(r.stagedBytes != null ? { stagedBytes: r.stagedBytes } : {}),
    // t269 — the time ledger rides the DTO so the inspector's remote strip
    // can speak it once the run is terminal.
    ...(r.stagedMs != null ? { stagedMs: r.stagedMs } : {}),
    ...(r.syncMs != null ? { syncMs: r.syncMs } : {}),
    ...(r.syncedFiles != null ? { syncedFiles: r.syncedFiles } : {}),
    ...(r.syncedBytes != null ? { syncedBytes: r.syncedBytes } : {}),
    ...(r.note ? { note: r.note } : {}),
  };
}

/**
 * t270 — the connection's run résumé: one aggregation over the run records
 * for the cluster manager's résumé card ("what has this cluster done for
 * me"). A record counts when it IS a remote run dispatched through this
 * connection; status derives from done/exitCode the same way the stop route
 * writes them (137 = stopped by user → failed bucket). recent keeps the ≤3
 * newest entries, newest first — the reading line under the summary.
 * t295 — opts.all is the PANORAMA variant: recent then holds EVERY entry
 * (newest first, same shape) for the card's expand — the reading line and
 * the panorama are the same aggregate at two apertures, never two truths.
 * A connection with zero runs yields an all-zero resume (total 0) — the
 * route omits the field entirely for that case, so "no résumé" stays honest.
 */
export async function connectionRunResume(
  connectionId: string,
  opts?: { all?: boolean }
): Promise<ConnectionRunResume> {
  const resume: ConnectionRunResume = { total: 0, completed: 0, failed: 0, lastRunAt: null, recent: [] };
  const runs = readRuns();
  for (const rec of Object.values(runs)) {
    if (rec.remote?.connectionId !== connectionId) continue;
    resume.total += 1;
    if (rec.done) {
      if (rec.exitCode === 0) resume.completed += 1;
      else resume.failed += 1;
    }
    if (!resume.lastRunAt || rec.startedAt > resume.lastRunAt) resume.lastRunAt = rec.startedAt;
    const r = rec.remote;
    resume.recent.push({
      jobId: rec.jobId,
      jobType: rec.type,
      done: rec.done,
      exitCode: rec.exitCode,
      startedAt: rec.startedAt,
      ...(r.stagedMs != null ? { stagedMs: r.stagedMs } : {}),
      ...(r.syncMs != null ? { syncMs: r.syncMs } : {}),
      ...(r.syncedFiles != null ? { syncedFiles: r.syncedFiles } : {}),
      ...(r.syncedBytes != null ? { syncedBytes: r.syncedBytes } : {}),
    });
  }
  resume.recent.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  resume.recent = resume.recent.slice(0, opts?.all ? undefined : 3);
  // t272 — existence is the doorway's truth: the résumé is GLOBAL (records +
  // connections), the job is per-project. For every rendered entry (the ≤3
  // reading line, or the whole panorama under opts.all) the server says
  // whether the job still exists anywhere, and under which project's canvas
  // it lives — the UI can then speak THREE honest states
  // (jumpable / another canvas / gone) instead of one merged guess.
  for (const e of resume.recent) {
    const row = await db.job.findUnique({
      where: { id: e.jobId },
      select: { id: true, project: { select: { name: true } } },
    });
    if (row) {
      e.exists = true;
      if (row.project?.name) e.projectName = row.project.name;
    } else {
      e.exists = false;
    }
  }
  return resume;
}

/**
 * Project a connection DTO with its résumé attached (omitted at zero runs).
 * Shared by every route that returns a connection body — the dialog upserts
 * whole rows, so ANY layer returning a bare DTO would erase the history the
 * list view already showed.
 */
export async function withRunResume(dto: RemoteConnectionDTO): Promise<RemoteConnectionDTO> {
  const resume = await connectionRunResume(dto.id);
  return resume.total > 0 ? { ...dto, resume } : dto;
}

/**
 * CryoFlow — REAL RELION 5 execution engine (SERVER ONLY).
 *
 * Spawns the actual RELION CLI programs (command shapes extracted from
 * /home/z/relion-build/pipeline_jobs.cpp — RELION 5.0.1 getCommands* builders).
 * Engine state (pid / workdir / log / outputs) lives in data/engine-state.json
 * so it survives Next.js dev-server hot reloads (the Prisma schema is frozen).
 *
 * Three job classes:
 *  - engine-native (import / manualpick / select): no RELION binary needed,
 *    writes RELION-5 style STAR files directly.
 *  - real CLI jobs: spawn relion_* binaries with faithful argv.
 *  - external jobs: honest failure when the external binary is absent.
 */

import type { ChildProcess } from "child_process";
import { execFile, execFileSync, spawn } from "child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import path from "path";
import type { Job } from "@prisma/client";
import { db } from "@/lib/db";
import { DATA_DIR } from "@/lib/paths";
import { detectRelion } from "./system";
import { MIC_RE, expandPattern, hasWildcard, userPathToHost } from "./glob";
import { writePathrefMarker } from "./pathref";
import {
  bridgeFromStatus,
  hostToWsl,
  isWindowsPath,
  wslStopArgs,
  wrapWslCommand,
  type WslBridge,
} from "./wsl-bridge";

/* ------------------------------------------------------------------ */
/* Paths & constants                                                    */
/* ------------------------------------------------------------------ */

const STATE_FILE = path.join(DATA_DIR, "engine-state.json");
const RELION_ROOT = path.join(DATA_DIR, "relion");
/** Sandbox-only demo source (EMPIAR seed); user machines use the import
 * job's micrographsPath param (folder / wildcard pattern / file list) instead. */
const EMPIAR_DIR = "/home/z/empiar-10017/micrographs";
const MPICH_BIN = "/home/z/relion-build/deps/mpich/bin";
const MPICH_LIB = "/home/z/relion-build/deps/mpich/lib";
const FFTW_LIB = "/home/z/relion-build/deps/fftw/lib";
const CTFFIND_EXE = "/home/z/relion-build/deps/ctffind/bin/ctffind";

const MPI_PARALLEL_TYPES = new Set(["class2d", "class3d", "refine3d"]);

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface RunRecord {
  jobId: string;
  projectId: string;
  type: string;
  pid: number | null;
  cmd: string;
  workdir: string;
  logFile: string;
  errFile: string;
  startedAt: string;
  outputs: Record<string, string>;
  done: boolean;
  exitCode: number | null;
  result?: string | null;
}

export interface EngineJobRef {
  id: string;
  projectId: string;
  type: string;
  params: Record<string, number | string | boolean>;
}

export interface UpstreamRef {
  id: string;
  type: string;
  params?: Record<string, number | string | boolean>;
  /** DB status of the upstream job (idle | pending | running | completed | failed)
   * — powers the differentiated waiting messages. */
  status?: string;
  /** Display name (e.g. "Import · EMPIAR-10017") for waiting messages. */
  name?: string;
}

/** Why a job could not start yet — maps to the PENDING status, not failed. */
export type WaitKind = "upstream-failed" | "upstream-running" | "not-ready";

export interface RunOutcome {
  ok: boolean;
  /** true when the job completed synchronously (engine-native). */
  native?: boolean;
  pid?: number;
  error?: string;
  result?: string;
  /** Set when the job cannot start because an UPSTREAM job failed or is
   * still running — the dispatcher marks the job pending instead of
   * failed (no cascade of red jobs down the whole pipeline). */
  waiting?: WaitKind;
  /** Set when an interrupted refine-family run was resumed via --continue
   * (the iteration number it picked up from). */
  resumedFrom?: number;
}

/** Live child processes (lost on server restart — reconcile handles that). */
const live = new Map<string, ChildProcess>();

/* ------------------------------------------------------------------ */
/* State file                                                           */
/* ------------------------------------------------------------------ */

export function readRuns(): Record<string, RunRecord> {
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, RunRecord>;
    }
  } catch {
    // ENOENT / corrupt → fresh state
  }
  return {};
}

export function writeRuns(map: Record<string, RunRecord>): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(map, null, 2));
}

export function getRun(jobId: string): RunRecord | null {
  return readRuns()[jobId] ?? null;
}

/**
 * Forget a job's run record (used by the explicit user reset). The next
 * run then starts FRESH instead of resuming from a leftover checkpoint —
 * "Reset & edit" semantically means "discard this run".
 */
export function clearRunRecord(jobId: string): void {
  const runs = readRuns();
  if (!(jobId in runs)) return;
  delete runs[jobId];
  writeRuns(runs);
}

/**
 * Number of live RELION child processes this server instance is still
 * tracking (used by the dispatcher's auto-start stampede guard — see
 * autoStartPendingDownstream).
 */
export function liveRunCount(): number {
  let n = 0;
  for (const child of live.values()) {
    if (child.exitCode === null && child.pid != null && pidAlive(child.pid)) n += 1;
  }
  return n;
}

/**
 * Non-null when a live child process is still tracked for this job —
 * either through this server instance's `live` map, or via /proc on a
 * record written before a hot reload / server restart. The run route
 * uses this to refuse duplicate spawns (two mpirun trees writing to the
 * same workdir = corrupt checkpoints + an OOM on this 4GB box).
 * Returns a human-readable reason, or null when nothing is running.
 */
export function isRunAlive(jobId: string): string | null {
  const child = live.get(jobId);
  if (child && child.exitCode === null && child.pid != null && pidAlive(child.pid)) {
    return `job is already running (pid ${child.pid})`;
  }
  const state = readRuns()[jobId];
  if (state && state.done === false && state.pid != null && pidAlive(state.pid)) {
    return `job is already running (pid ${state.pid})`;
  }
  return null;
}

/** All descendant pids of `pid` (mpirun → hydra → ranks), via /proc stat. */
function descendantsOf(pid: number): number[] {
  const ppidOf = new Map<number, number>();
  try {
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      const p = Number(entry);
      if (p === pid) continue;
      try {
        const stat = readFileSync(`/proc/${p}/stat`, "utf8");
        const close = stat.lastIndexOf(")");
        // fields after "comm": state, ppid, ... → ppid is rest[1]
        const rest = stat.slice(close + 2).split(" ");
        const ppid = Number(rest[1]);
        if (Number.isFinite(ppid)) ppidOf.set(p, ppid);
      } catch {
        /* process vanished */
      }
    }
  } catch {
    return [];
  }
  const out: number[] = [];
  const queue = [pid];
  while (queue.length > 0) {
    const parent = queue.shift() as number;
    for (const [p, pp] of ppidOf) {
      if (pp === parent && !out.includes(p)) {
        out.push(p);
        queue.push(p);
      }
    }
  }
  return out;
}

/** Cross-platform pid liveness: /proc on Linux, signal-0 probe on Windows. */
function pidAlive(pid: number): boolean {
  try {
    if (existsSync("/proc")) return existsSync(`/proc/${pid}`);
  } catch {
    /* fall through to the signal probe */
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = the process EXISTS but belongs to another session/user
    // (e.g. a detached wsl.exe after a dev-server restart) — still alive.
    // ESRCH (or anything else) = gone.
    const err = e as NodeJS.ErrnoException;
    return err.code === "EPERM";
  }
}

/**
 * Stop a job's live process tree (SIGTERM → grace → SIGKILL).
 *  - kills mpirun AND its ranks (a bare mpirun kill orphans the ranks)
 *  - if the child is in `live`, its exit handler fires and records
    exit −1 → the next POST /run can --continue from the checkpoint
 *  - for restart-orphaned trees (no live child, only a state record)
    the record is marked interrupted directly
 * Returns what happened, for the API response.
 */
export async function stopRun(jobId: string): Promise<{ stopped: boolean; message: string }> {
  const child = live.get(jobId);
  const state = readRuns()[jobId];
  const pid = child?.pid ?? state?.pid ?? null;

  // ---- WSL bridge runs --------------------------------------------------
  // The host-side pid is the wsl.exe session host; the distro-internal
  // mpirun/rank tree has no /proc entries on Windows. Kill the host session
  // AND pkill the distro side by the translated workdir (always embedded in
  // the RELION argv via --o / --i), so no orphan keeps writing checkpoints.
  //
  // BRIDGE-NESS COMES FROM THE RECORD, not from the live detection state:
  // the wrapped display command starts with "wsl" / "wsl -d <distro> --" —
  // relying on detectRelion() here made stopping impossible exactly when
  // detection was stale/failed while the job kept running.
  const bridged =
    state?.cmd?.match(/^wsl(?: -d (\S+))? -- bash -c /) ?? null;
  if (pid != null && state?.workdir && pidAlive(pid) && bridged) {
    const distro = bridged[1] ?? null;
    try {
      process.kill(pid);
    } catch {
      /* already gone */
    }
    execFile("wsl.exe", wslStopArgs(state.workdir, distro), { timeout: 5000 }, () => {
      /* best effort — pkill exits non-zero when nothing matched */
    });
    if (!child) {
      const runs = readRuns();
      const rec = runs[jobId];
      if (rec && rec.done === false) {
        runs[jobId] = { ...rec, done: true, exitCode: -1, result: "stopped by user (WSL bridge)" };
        writeRuns(runs);
      }
    }
    return {
      stopped: true,
      message: `stopped WSL session pid ${pid} (pkill sent inside ${distro ?? "default distro"})`,
    };
  }

  const tree = pid != null && existsSync(`/proc/${pid}`) ? [pid, ...descendantsOf(pid)] : [];

  if (tree.length === 0) {
    // Windows native fallback: no /proc tree exists, but the pid is alive
    // (a non-bridged record on a win32 host). process.kill() terminates
    // unconditionally there — no graceful SIGTERM, but the job stops.
    if (pid != null && pidAlive(pid) && process.platform === "win32") {
      try {
        process.kill(pid);
      } catch {
        /* raced away */
      }
      return { stopped: true, message: `stopped pid ${pid} (Windows terminate)` };
    }
    return { stopped: false, message: "no live process for this job" };
  }

  for (const p of tree) {
    try {
      process.kill(p, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  // graceful window: RELION ranks exit on SIGTERM, mpirun reaps them
  const graceDeadline = Date.now() + 5000;
  while (Date.now() < graceDeadline) {
    await new Promise((r) => setTimeout(r, 250));
    if (!tree.some((p) => pidAlive(p))) break;
  }
  let killed = 0;
  for (const p of tree) {
    if (pidAlive(p)) {
      try {
        process.kill(p, "SIGKILL");
        killed += 1;
      } catch {
        /* raced away */
      }
    }
  }

  // If the exit handler won't fire (child not in `live` — e.g. the tree
  // survived a server restart), mark the record interrupted ourselves so
  // reconcile + the resume branch see a consistent state.
  if (!child) {
    const runs = readRuns();
    const rec = runs[jobId];
    if (rec && rec.done === false) {
      runs[jobId] = { ...rec, done: true, exitCode: -1, result: "stopped by user" };
      writeRuns(runs);
    }
  }
  return {
    stopped: true,
    message: `stopped pid ${pid} (${tree.length} processes${killed > 0 ? `, ${killed} SIGKILLed` : ""})`,
  };
}

/* ------------------------------------------------------------------ */
/* Environment                                                          */
/* ------------------------------------------------------------------ */

/** Environment for spawning RELION binaries (PATH + libs + RELION_HOME). */
export function relionEnv(binDir: string): NodeJS.ProcessEnv {
  const pathParts: string[] = [binDir];
  if (existsSync(MPICH_BIN)) pathParts.push(MPICH_BIN);
  const libParts = [MPICH_LIB, FFTW_LIB].filter((p) => existsSync(p));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // path.delimiter (";" on Windows, ":" on POSIX) — a hardcoded ":" would
    // corrupt PATH on native Windows runs
    PATH: pathParts.join(path.delimiter) + path.delimiter + (process.env.PATH ?? ""),
    RELION_HOME: binDir.replace(/\/bin\/?$/, ""),
  };
  // relion_run_ctffind does NOT search PATH — it needs an explicit executable
  if (existsSync(CTFFIND_EXE)) env.RELION_CTFFIND_EXECUTABLE = CTFFIND_EXE;
  env.LD_LIBRARY_PATH =
    libParts.length > 0
      ? libParts.join(":") + ":" + (process.env.LD_LIBRARY_PATH ?? "")
      : (process.env.LD_LIBRARY_PATH ?? "");
  return env;
}

function workdirFor(job: EngineJobRef): string {
  return path.join(RELION_ROOT, job.projectId, `${job.type}_${job.id.slice(-8)}`);
}

/**
 * RELION "project root" directory — all real CLI jobs run with this as CWD
 * (mirrors how the RELION GUI/pipeliner launches jobs from the pipeline root),
 * so STAR files can use project-relative micrograph paths. ctffind_runner
 * symlinks micrographs as (cwd + star-path) → output-dir + path, which only
 * resolves when CWD is this directory.
 */
function projectDirFor(job: EngineJobRef): string {
  return path.join(RELION_ROOT, job.projectId);
}

/* ------------------------------------------------------------------ */
/* Toolchain resolution (native sandbox MPICH vs WSL distro tools)      */
/* ------------------------------------------------------------------ */

/** mpirun for MPI-parallel types: distro-side (bridge) or sandbox MPICH. */
function resolveMpirun(binDir: string, bridge: WslBridge | null): string | null {
  if (bridge) return bridge.mpirun;
  return existsSync(path.join(MPICH_BIN, "mpirun"))
    ? path.join(MPICH_BIN, "mpirun")
    : null;
}

/** relion_refine_mpi presence (WSL-side facts come from the probe). */
function hasMpiBinary(binDir: string, bridge: WslBridge | null): boolean {
  if (bridge) return bridge.hasMpiBinary;
  return existsSync(path.join(binDir, "relion_refine_mpi"));
}

/** ctffind executable: distro-side (bridge) or the sandbox bundle. */
function resolveCtffind(bridge: WslBridge | null): string | null {
  if (bridge) return bridge.ctffind;
  return existsSync(CTFFIND_EXE) ? CTFFIND_EXE : null;
}

/**
 * Link a data directory into the RELION project/job tree so STAR files can
 * use project-relative "micrographs/<name>" paths (RELION pipeliner style).
 * POSIX hosts get a symlink; Windows gets a directory JUNCTION (no admin
 * rights needed — plain symlinks require Developer Mode there). Returns
 * false when no link could be created (e.g. junction to a UNC target).
 */
function linkDirInto(target: string, linkPath: string): boolean {
  try {
    if (existsSync(linkPath)) {
      // a previous import may point elsewhere — re-point the link
      try {
        if (realpathSync(linkPath) === realpathSync(target)) return true;
        rmSync(linkPath, { force: true, recursive: true });
      } catch {
        /* stale/broken link — remove and recreate below */
        try {
          rmSync(linkPath, { force: true, recursive: true });
        } catch {
          /* cannot clean up — keep the old link and fail honestly */
          return false;
        }
      }
    }
    if (process.platform === "win32") {
      symlinkSync(target, linkPath, "junction");
    } else {
      symlinkSync(target, linkPath, "dir");
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * De-duplicate a STAR entry name for file-set imports. Collisions get the
 * parent folder as a prefix (MovieDir__frame.mrc), then -2, -3… suffixes.
 */
function uniqueStarName(file: string, used: Set<string>): string {
  let name = path.basename(file);
  if (used.has(name)) {
    const ext = path.extname(name);
    const stem = name.slice(0, name.length - ext.length);
    const parent = path.basename(path.dirname(file)) || "src";
    name = `${parent}__${stem}${ext}`;
    let i = 2;
    while (used.has(name)) {
      name = `${parent}__${stem}-${i}${ext}`;
      i += 1;
    }
  }
  used.add(name);
  return name;
}

/**
 * Import a SET of files (multi-select / wildcard pattern / single file):
 * create a real "micrographs" directory in the project tree and link every
 * file into it — hardlink first (no data duplication, works on POSIX and
 * NTFS), then a file symlink, then absolute STAR paths as honest fallback
 * (translated to WSL-side paths when the bridge is active).
 * Unlinkable files additionally get a .pathref marker so the gallery/preview
 * routes can still serve them from their source location — without the
 * marker an absolute-path import LOOKS like "nothing was imported" even
 * though the STAR file references every file correctly.
 * Returns the STAR entries + how many files could NOT be linked.
 */
function importFileSet(
  hostFiles: string[],
  projectDir: string,
  workdir: string,
  bridge: WslBridge | null
): { entries: string[]; unlinked: number } {
  const projectMic = path.join(projectDir, "micrographs");
  const workdirMic = path.join(workdir, "micrographs");
  // fresh real dir — removes a previous import's symlink/junction (the link
  // only, never the target data) or an older file-set's hardlinks
  for (const stale of [workdirMic, projectMic]) {
    try {
      rmSync(stale, { force: true, recursive: true });
    } catch {
      /* non-fatal: linkDirInto below re-points what it can */
    }
  }
  mkdirSync(projectMic, { recursive: true });

  const used = new Set<string>();
  const entries: string[] = [];
  /** unlinkable files: name → source, for pathref markers */
  const unlinkedFiles: { name: string; abs: string }[] = [];
  for (const f of hostFiles) {
    const name = uniqueStarName(f, used);
    const target = path.join(projectMic, name);
    let linked = false;
    try {
      linkSync(f, target); // hardlink — same filesystem only
      linked = true;
    } catch {
      try {
        symlinkSync(f, target, "file");
        linked = true;
      } catch {
        linked = false; // cross-volume + no symlink rights → absolute path
      }
    }
    if (linked) {
      entries.push(`micrographs/${name}`);
    } else {
      unlinkedFiles.push({ name, abs: f });
      entries.push(bridge ? hostToWsl(f) : f);
    }
  }
  // expose the set inside the import job's workdir (Files tab + gallery)
  if (!linkDirInto(projectMic, workdirMic)) {
    // junction failed — link each file directly into the workdir instead
    for (const e of entries) {
      if (!e.startsWith("micrographs/")) continue;
      const src = path.join(projectMic, e.slice("micrographs/".length));
      const dst = path.join(workdirMic, e.slice("micrographs/".length));
      try {
        mkdirSync(path.dirname(dst), { recursive: true });
        linkSync(src, dst);
      } catch {
        try {
          mkdirSync(path.dirname(dst), { recursive: true });
          symlinkSync(src, dst, "file");
        } catch {
          /* gallery preview lost for this file — import still works */
        }
      }
    }
  }
  // markers for the unlinkable files (both trees — the junction case only
  // carries projectMic's markers into the workdir automatically)
  for (const u of unlinkedFiles) {
    writePathrefMarker(projectMic, u.name, u.abs);
    try {
      mkdirSync(workdirMic, { recursive: true });
      writePathrefMarker(workdirMic, u.name, u.abs);
    } catch {
      /* workdir marker is best-effort */
    }
  }
  return { entries, unlinked: unlinkedFiles.length };
}

/* ------------------------------------------------------------------ */
/* Param helpers                                                        */
/* ------------------------------------------------------------------ */

function num(job: EngineJobRef, key: string, fallback: number): number {
  const v = job.params[key];
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function str(job: EngineJobRef, key: string, fallback: string): string {
  const v = job.params[key];
  return v === undefined || v === null ? fallback : String(v);
}

function flag(job: EngineJobRef, key: string): boolean {
  return String(job.params[key] ?? "false") === "true";
}

/** Particle pixel size: import pixel × (extract box / downsample). */
function particlePixel(job: EngineJobRef, upstream: UpstreamRef[]): number {
  const importUp = upstream.find((u) => u.type === "import" || u.type === "tomo_import");
  const extractUp = upstream.find((u) => u.type === "extract");
  const pixel =
    importUp?.params && typeof importUp.params.pixelSize === "number"
      ? importUp.params.pixelSize
      : 1.77;
  if (extractUp?.params) {
    const box = typeof extractUp.params.boxSize === "number" ? extractUp.params.boxSize : 128;
    const down =
      typeof extractUp.params.downsampleTo === "number" ? extractUp.params.downsampleTo : 0;
    if (down > 0 && down < box) return (pixel * box) / down;
  }
  return pixel;
}

/* ------------------------------------------------------------------ */
/* Input resolution (upstream runs' outputs)                            */
/* ------------------------------------------------------------------ */

interface InputReq {
  /** Canonical key under which the resolved path is stored. */
  key: string;
  /** Upstream output keys that satisfy this requirement (first match wins). */
  accepts: string[];
  /** Upstream job types allowed to provide it. */
  from: string[];
  /** Human label used in honest-failure messages. */
  label: string;
}

const INPUTS: Record<string, InputReq[]> = {
  ctffind: [
    { key: "micrographs_star", accepts: ["micrographs_star"], from: ["import", "motioncorr"], label: "micrographs.star (run Import first)" },
  ],
  motioncorr: [
    { key: "micrographs_star", accepts: ["micrographs_star"], from: ["import"], label: "micrographs.star (run Import first)" },
  ],
  manualpick: [
    { key: "micrographs_star", accepts: ["micrographs_star"], from: ["import", "motioncorr", "ctffind"], label: "micrographs.star (run Import first)" },
  ],
  autopick: [
    { key: "micrographs_star", accepts: ["micrographs_star", "micrographs_ctf_star"], from: ["import", "motioncorr", "ctffind"], label: "micrographs.star (run Import first)" },
    { key: "refs_mrc", accepts: ["classes_mrc", "model_mrc"], from: ["class2d", "initialmodel", "class3d"], label: "2D reference templates (run Class2D first)" },
  ],
  extract: [
    { key: "micrographs_star", accepts: ["micrographs_star", "micrographs_ctf_star"], from: ["import", "motioncorr", "ctffind"], label: "micrographs.star (run Import first)" },
    { key: "coords_dir", accepts: ["coords_dir", "coords_star"], from: ["manualpick", "autopick"], label: "particle coordinates (run ManualPick/AutoPick first)" },
  ],
  select: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "class2d", "select", "joinstar"], label: "particles.star (run Extract first)" },
  ],
  class2d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d", "joinstar"], label: "particles.star (run Extract first)" },
  ],
  initialmodel: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d", "joinstar"], label: "particles.star (run Extract first)" },
  ],
  class3d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d", "initialmodel"], label: "particles.star (run Extract first)" },
    { key: "model_mrc", accepts: ["model_mrc", "classes_mrc"], from: ["initialmodel", "class3d", "class2d"], label: "reference map (run InitialModel first)" },
  ],
  refine3d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d", "joinstar", "initialmodel"], label: "particles.star (run Extract first)" },
    { key: "model_mrc", accepts: ["model_mrc", "classes_mrc"], from: ["initialmodel", "class3d", "class2d"], label: "reference map (run InitialModel first)" },
  ],
  multibody: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d"], label: "particles.star (run Extract first)" },
    { key: "optimiser_star", accepts: ["optimiser_star"], from: ["refine3d", "class3d"], label: "optimiser.star (run Refine3D first)" },
  ],
  maskcreate: [
    { key: "map_mrc", accepts: ["half1_mrc", "model_mrc", "map_mrc"], from: ["refine3d", "initialmodel", "class3d", "postprocess", "localres"], label: "3D map (run Refine3D first)" },
  ],
  postprocess: [
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["refine3d"], label: "half1 map (run Refine3D first)" },
    { key: "half2_mrc", accepts: ["half2_mrc"], from: ["refine3d"], label: "half2 map (run Refine3D first)" },
    { key: "mask_mrc", accepts: ["mask_mrc"], from: ["maskcreate"], label: "solvent mask (run MaskCreate first)" },
  ],
  localres: [
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["refine3d"], label: "half1 map (run Refine3D first)" },
    { key: "mask_mrc", accepts: ["mask_mrc"], from: ["maskcreate"], label: "solvent mask (run MaskCreate first)" },
  ],
  polish: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "refine3d", "class2d"], label: "particles.star (run Extract first)" },
    { key: "postprocess_star", accepts: ["postprocess_star"], from: ["postprocess"], label: "postprocess.star (run PostProcess first)" },
    { key: "micrographs_star", accepts: ["micrographs_star", "corrected_micrographs_star"], from: ["motioncorr", "import"], label: "corrected micrographs.star (run MotionCorr first)" },
  ],
  ctfrefine: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "refine3d", "class2d"], label: "particles.star (run Extract first)" },
    { key: "postprocess_star", accepts: ["postprocess_star"], from: ["postprocess"], label: "postprocess.star (run PostProcess first)" },
  ],
  dynamight: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "refine3d", "class2d"], label: "particles.star (run Extract first)" },
    { key: "model_mrc", accepts: ["model_mrc", "map_mrc"], from: ["refine3d", "postprocess"], label: "consensus map (run Refine3D first)" },
  ],
  modelangelo: [
    { key: "map_mrc", accepts: ["map_mrc", "model_mrc"], from: ["postprocess", "refine3d"], label: "sharpened map (run PostProcess first)" },
  ],
  subtract: [
    { key: "optimiser_star", accepts: ["optimiser_star"], from: ["refine3d", "class3d"], label: "optimiser.star (run Refine3D first)" },
    { key: "mask_mrc", accepts: ["mask_mrc"], from: ["maskcreate"], label: "mask of signal to subtract (run MaskCreate first)" },
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "refine3d"], label: "particles.star (run Extract first)" },
  ],
  tomo_import: [],
  tomo_aligntiltseries: [
    { key: "tilt_series_star", accepts: ["tilt_series_star", "tilt_series_ctf_star"], from: ["tomo_import", "tomo_exclude"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_tomograms: [
    { key: "tilt_series_star", accepts: ["aligned_tilt_series_star", "tilt_series_star"], from: ["tomo_aligntiltseries", "tomo_import"], label: "aligned tilt series (run Tomo: Align Tilt Series first)" },
  ],
  tomo_ctfrefine: [
    { key: "particles_star", accepts: ["particles_star"], from: ["tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["tomo_reconstruct", "refine3d"], label: "reference half-map (run Tomo: Reconstruct first)" },
  ],
  tomo_exclude: [
    { key: "tilt_series_star", accepts: ["tilt_series_star"], from: ["tomo_import", "tomo_aligntiltseries"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_polish: [
    { key: "particles_star", accepts: ["particles_star"], from: ["tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["tomo_reconstruct", "refine3d"], label: "reference half-map (run Tomo: Reconstruct first)" },
  ],
  tomo_reconstruct: [
    { key: "particles_star", accepts: ["particles_star"], from: ["tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
  ],
  tomo_denoise: [
    { key: "tomograms_star", accepts: ["tomograms_star"], from: ["tomo_tomograms"], label: "tomograms.star (run Tomo: Reconstruct Tomograms first)" },
  ],
  tomo_picks: [
    { key: "tilt_series_star", accepts: ["tilt_series_star", "aligned_tilt_series_star"], from: ["tomo_aligntiltseries", "tomo_import"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_extract: [
    { key: "particles_star", accepts: ["particles_star"], from: ["tomo_picks"], label: "picks (run Tomo: Picking first)" },
  ],
  external: [],
};

/** Requirements a type can NEVER resolve through the graph → generic fail. */
const GENERIC_REQUIREMENTS: Record<string, string> = {
  multibody: "a body STAR file (bodies.star with multi-body masks)",
  joinstar: "two or more particle STAR files wired as inputs (joinstar combines them)",
  tomo_import: "SerialEM tilt-series movies + .mdoc files (no tilt data present in this project)",
  external: "a custom run.sh script inside the job directory",
};

/**
 * Resolve required inputs from upstream completed runs.
 * `missing` is a human-readable message (null on success); `wait` classifies
 * WHY an input is missing so the dispatcher can mark the job PENDING
 * (upstream failed / still running / never ran) instead of failed — a failed
 * upstream used to cascade red "Waiting for upstream output" failures down
 * the entire pipeline.
 */
function resolveInputs(
  type: string,
  upstream: UpstreamRef[]
): { inputs: Record<string, string>; missing: string | null; wait?: WaitKind } {
  const reqs = INPUTS[type] ?? [];
  const runs = readRuns();
  const inputs: Record<string, string> = {};

  for (const req of reqs) {
    let resolved: string | null = null;
    // upstream arrives in INPUT-PRIORITY order from lineageFor(): BFS by
    // graph distance (direct parents first) with newest-first within a
    // layer — scan forward and take the first provider that has the output.
    const providers: { name: string; status: string }[] = [];
    for (const up of upstream) {
      if (!req.from.includes(up.type)) continue;
      const state = runs[up.id];
      if (state && state.done && state.exitCode === 0) {
        for (const key of req.accepts) {
          const p = state.outputs[key];
          if (p && existsSync(p)) {
            resolved = p;
            break;
          }
        }
        if (resolved) break;
      }
      providers.push({ name: up.name ?? up.type, status: up.status ?? "idle" });
    }
    if (!resolved) {
      // pick the most actionable blocker: a FAILED provider (re-run it)
      // beats a RUNNING one (transient wait) beats anything else
      const failed = providers.find((p) => p.status === "failed");
      const running = providers.find((p) => p.status === "running");
      if (failed) {
        return {
          inputs: {},
          missing: `Upstream "${failed.name}" failed — fix and re-run it; this job then starts automatically once its inputs are ready`,
          wait: "upstream-failed",
        };
      }
      if (running) {
        return {
          inputs: {},
          missing: `Waiting for upstream "${running.name}" to finish… (this job starts automatically when it does)`,
          wait: "upstream-running",
        };
      }
      return {
        inputs: {},
        missing: `Waiting for upstream output: ${req.label} — runs automatically once ready`,
        wait: "not-ready",
      };
    }
    inputs[req.key] = resolved;
  }
  return { inputs, missing: null };
}

/* ------------------------------------------------------------------ */
/* Command templates (all 32 types — for reference/UI)                  */
/* ------------------------------------------------------------------ */

/**
 * Canonical RELION 5.0.1 command templates (extracted from pipeline_jobs.cpp).
 * <...> placeholders are substituted with real paths/params by buildArgv().
 */
export const COMMAND_TEMPLATES: Record<string, string> = {
  import: "engine-native: write micrographs.star (RELION 5 optics format)",
  motioncorr: "relion_run_motioncorr --i <micrographs.star> --o <outdir>/ --use_motioncor2 --motioncor2_exe <mc2> --bin_factor <bf> --bfactor <bfac> --dose_per_frame <dose> --patch_x <px> --patch_y <py> --j <n>",
  ctffind: "relion_run_ctffind --i <micrographs.star> --o <outdir>/ --Box <box> --ResMin <rmin> --ResMax <rmax> --dFMin <dmin> --dFMax <dmax> --FStep 500 --dAst 0 --is_ctffind4 --fast_search [--ctffind_exe <ctffind>]",
  manualpick: "engine-native: import Henderson .coord picks → manualpick.star (_rlnCoordinateX/Y + _rlnMicrographName)",
  autopick: "relion_autopick --i <micrographs.star> --odir <outdir>/ --pickname autopick --particle_diameter <dia> --threshold <thr> --lowpass <lp> --ref <refs.mrc>",
  extract: "relion_preprocess --i <micrographs_ctf.star> --coord_list <coords.star> --part_star <outdir>/particles.star --part_dir <outdir>/ --extract --extract_size <box> [--scale <down>] --norm --bg_radius <bgr> --white_dust 3 --black_dust -3",
  select: "engine-native: particle selection — class-aware occupancy pruning when input has _rlnClassNumber, else first-N",
  class2d: "mpirun -n 2 relion_refine --i <particles.star> --o <outdir>/run --K <K> --tau2_fudge 1 --particle_diameter <dia> --ctf --pad 2 --iter <it> --flatten_solvent --zero_mask",
  initialmodel: "relion_refine --grad --denovo_3dref --i <particles.star> --o <outdir>/run --K <K> --particle_diameter <dia> --sym <sym> --ctf --iter <it> --flatten_solvent --zero_mask",
  class3d: "mpirun -n 2 relion_refine --i <particles.star> --ref <ref.mrc> --o <outdir>/run --K <K> --tau2_fudge 4 --particle_diameter <dia> --sym <sym> --ctf --pad 2 --iter <it> --flatten_solvent",
  refine3d: "mpirun -n 3 relion_refine --i <particles.star> --ref <ref.mrc> --o <outdir>/run --sym <sym> --particle_diameter <dia> --ctf --pad <pad> --firstiter_cc --ini_high <iniHigh> --trust_ref_size --split_random_halves [--auto_refine | --iter <it> --tau2_fudge 1]",
  multibody: "mpirun -n 2 relion_refine --continue <optimiser.star> --o <outdir>/run --solvent_correct_fsc --multibody_masks <bodies.star> --oversampling 1",
  maskcreate: "relion_mask_create --i <half1.mrc> --o <outdir>/mask.mrc --lowpass <lp> --angpix <pix> --ini_threshold <thr> --extend_inimask <ext> --width_soft_edge <soft> --j 4",
  joinstar: "relion_star_handler --combine --i <parts1.star parts2.star ...> --check_duplicates rlnImageName --o <outdir>/join_particles.star",
  subtract: "relion_particle_subtract --i <optimiser.star> --mask <mask.mrc> --data <particles.star> --o <outdir>/ [--recenter_on_mask] [--float16] [--new_box <box>]",
  postprocess: "relion_postprocess --i <half1.mrc> --o <outdir>/postprocess --mask <mask.mrc> --angpix <pix> [--auto_bfac --autob_lowres <lr>]",
  localres: "relion_postprocess --locres --i <half1.mrc> --o <outdir>/relion --angpix <pix> --adhoc_bfac <bfac> [--mask <mask.mrc>]",
  polish: "relion_motion_refine --i <particles.star> --f <postprocess.star> --corr_mic <corrected_micrographs.star> --first_frame <f> --last_frame <l> --o <outdir>/ --eval_frac <ef>",
  ctfrefine: "relion_ctf_refine --i <particles.star> --f <postprocess.star> --o <outdir>/ --fit_defocus --kmin_defocus <kmin>",
  dynamight: "relion_python_dynamight optimize-deformations --refinement-star-file <particles.star> --output-directory <outdir>/ --initial-model <map.mrc> --n-gaussians <ng> --regularization-factor <rf> --n-threads <nt>",
  modelangelo: "model_angelo build_no_seq -v <map.mrc> -o <outdir>/ -d <gpu>",
  tomo_import: "relion_python_tomo_import SerialEM --tilt-image-movie-pattern <movies> --mdoc-file-pattern <mdocs> --nominal-tilt-axis-angle <angle> --nominal-pixel-size <pix> --voltage <kV> --spherical-aberration <Cs> --amplitude-contrast <Q0> --dose-per-tilt-image <dose> --output-directory <outdir>/",
  tomo_aligntiltseries: "relion_align_tiltseries --i <tilt_series.star> --o <outdir>/ --tomogram_thickness <thick> --aretomo2 --aretomo_exe <aretomo> --gpu <gpu>",
  tomo_tomograms: "relion_tomo_reconstruct_tomogram --t <aligned_tilt_series.star> --o <outdir>/ --w <xdim> --h <ydim> --d <zdim> --binned_angpix <binned> --j <n>",
  tomo_ctfrefine: "relion_tomo_refine_ctf --i <particles.star> --ref1 <half1.mrc> --ref2 <half2.mrc> --b <box> --focus_range <range> --o <outdir>/",
  tomo_exclude: "relion_python_tomo_exclude_tilt_images --tilt-series-star-file <tilt_series.star> --cache-size <cache> --output-directory <outdir>/",
  tomo_polish: "relion_tomo_align --ref1 <half1.mrc> --ref2 <half2.mrc> --theme classic --o <outdir>/ --b <box> --r <maxerr> [--shift_only]",
  tomo_reconstruct: "relion_tomo_reconstruct_particle --i <particles.star> --theme classic --o <outdir>/ --b <box> --bin <bin> --j <n> --sym C1",
  tomo_denoise: "relion_python_tomo_denoise cryoCARE:<train|predict> --tomogram-star-file <tomograms.star> --output-directory <outdir>/ --gpu <gpu>",
  tomo_picks: "relion_python_tomo_pick <mode> --tilt-series-star-file <tilt_series.star> --output-directory <outdir>/ && relion_python_tomo_get_particle_poses <mode> --annotations-directory <outdir>/annotations --output-directory <outdir>/",
  tomo_extract: "relion_tomo_subtomo --i <particles.star> --theme classic --o <outdir>/ --b <box> --bin <bin> --stack2d --float16 --j <n>",
  external: "bash <outdir>/run.sh (user-provided script, RELION metadata exported as env vars)",
};

/* ------------------------------------------------------------------ */
/* STAR file helpers                                                    */
/* ------------------------------------------------------------------ */

interface StarBlock {
  /** "data_xxx" header line. */
  header: string;
  /** All following lines (including loop_/labels/rows). */
  lines: string[];
}

function parseStarBlocks(text: string): StarBlock[] {
  const blocks: StarBlock[] = [];
  let current: StarBlock | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^data_/.test(line.trim())) {
      current = { header: line.trim(), lines: [] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return blocks;
}

/** Micrograph names from a micrographs.star (first column after the loop header). */
function micrographNames(starPath: string): string[] {
  const blocks = parseStarBlocks(readFileSync(starPath, "utf8"));
  const micBlock = blocks.find(
    (b) => b.header === "data_micrographs" || b.lines.some((l) => l.includes("_rlnMicrographName"))
  );
  if (!micBlock) return [];
  const names: string[] = [];
  for (const line of micBlock.lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t === "loop_" || t.startsWith("_rln") || t.startsWith("data_")) {
      continue;
    }
    const first = t.split(/\s+/)[0];
    if (first) names.push(first);
  }
  return names;
}

/* ------------------------------------------------------------------ */
/* Engine-native jobs                                                   */
/* ------------------------------------------------------------------ */

interface NativeResult {
  ok: boolean;
  result?: string;
  error?: string;
  /** Set when the failure is an upstream-waiting condition → job goes PENDING. */
  wait?: WaitKind;
}

function recordNativeRun(
  job: EngineJobRef,
  workdir: string,
  cmd: string,
  outputs: Record<string, string>,
  result: string,
  logText: string
): void {
  const logFile = path.join(workdir, "run.out");
  const errFile = path.join(workdir, "run.err");
  appendFileSync(logFile, logText);
  writeFileSync(errFile, "");
  const runs = readRuns();
  runs[job.id] = {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    pid: null,
    cmd,
    workdir,
    logFile,
    errFile,
    startedAt: new Date().toISOString(),
    outputs,
    done: true,
    exitCode: 0,
    result,
  };
  writeRuns(runs);
}

/** Import: writes a RELION 5 optics-group micrographs.star (EMPIAR or empty). */
async function runImportNative(job: EngineJobRef): Promise<NativeResult> {
  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const projectDir = projectDirFor(job);
  mkdirSync(projectDir, { recursive: true });

  const pixel = num(job, "pixelSize", 1.77);
  const kV = num(job, "voltage", 300);
  const cs = num(job, "cs", 2.7);
  const q0 = num(job, "ampContrast", 0.1);
  const empiar =
    String(job.params.empiarData ?? "") === "true" &&
    !String(job.params.micrographsPath ?? "").trim();

  const starPath = path.join(workdir, "micrographs.star");
  const lines: string[] = [
    "data_optics",
    "",
    "loop_",
    "_rlnOpticsGroup #1",
    "_rlnOpticsGroupName #2",
    "_rlnMicrographPixelSize #3",
    "_rlnVoltage #4",
    "_rlnSphericalAberration #5",
    "_rlnAmplitudeContrast #6",
    `1 optGroup1 ${pixel} ${kV} ${cs} ${q0}`,
    "",
    "data_micrographs",
    "",
    "loop_",
    "_rlnMicrographName #1",
    "_rlnOpticsGroup #2",
  ];

  let result: string;
  let sourceLabel = "";
  if (empiar) {
    const mrcs = existsSync(EMPIAR_DIR)
      ? readdirSync(EMPIAR_DIR)
          .filter((f) => f.endsWith(".mrc"))
          .sort()
      : [];
    if (mrcs.length === 0) {
      return { ok: false, error: `EMPIAR directory not found: ${EMPIAR_DIR}` };
    }
    // Project-relative paths + a symlink so every downstream RELION job (run
    // with CWD = projectDir) can open "micrographs/<name>.mrc". This mirrors
    // the RELION pipeliner: STAR paths are project-root-relative.
    const micLink = path.join(projectDir, "micrographs");
    if (!existsSync(micLink)) symlinkSync(EMPIAR_DIR, micLink);
    // Also expose the micrographs inside the import job's own workdir so the
    // Files tab + gallery can serve PNG previews through outputs/file.
    const micLinkInWorkdir = path.join(workdir, "micrographs");
    if (!existsSync(micLinkInWorkdir)) symlinkSync(EMPIAR_DIR, micLinkInWorkdir);
    for (const m of mrcs) lines.push(`micrographs/${m} 1`);
    result = `${mrcs.length} micrographs imported · EMPIAR-10017 (pixel ${pixel} Å)`;
    sourceLabel = `source: EMPIAR-10017 ${EMPIAR_DIR}`;
  } else {
    // ---- user-selected source — RELION "Select files by" forms ----------
    // micrographsPath accepts THREE shapes (exactly one param):
    //   1. a folder            → import every image inside it
    //   2. a wildcard pattern  → /data/movies/*.tiff — expanded here
    //   3. file paths          → newline-separated multi-select list
    const customRaw = String(job.params.micrographsPath ?? "").trim();
    if (customRaw) {
      const status = await detectRelion();
      const bridge = bridgeFromStatus(status);
      const toHost = (p: string) => userPathToHost(p, bridge?.distro ?? null);

      const listed = customRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const multiFile = listed.length > 1;
      const single = listed[0] ?? "";
      const isPattern = !multiFile && hasWildcard(single);

      let hostFiles: string[] = [];
      let skipped = 0; // non-image files filtered out of an explicit set

      if (multiFile) {
        // ---- 3. explicit multi-select file list ---------------------------
        for (const line of listed) {
          const host = toHost(line);
          try {
            if (!statSync(host).isFile()) {
              return {
                ok: false,
                error: `Not a file: ${line} — re-pick the micrographs in the params tab (Browse → Files)`,
              };
            }
          } catch {
            return {
              ok: false,
              error: `File not accessible: ${line} — re-pick the micrographs in the params tab (Browse → Files)`,
            };
          }
          if (MIC_RE.test(path.basename(host))) hostFiles.push(host);
          else skipped += 1;
        }
      } else if (isPattern) {
        // ---- 2. wildcard pattern (RELION "File name pattern") -------------
        const expanded = expandPattern(single, toHost);
        if ("error" in expanded) {
          return { ok: false, error: `${expanded.error} — check the pattern in the params tab` };
        }
        for (const f of expanded.files) {
          if (MIC_RE.test(path.basename(f))) hostFiles.push(f);
          else skipped += 1;
        }
        if (expanded.total > expanded.files.length) {
          sourceLabel = `source: pattern ${single} (${expanded.total} matches, first ${expanded.files.length} imported)`;
        }
      } else {
        // ---- 1. folder (or a single pasted file) --------------------------
        const hostDir = toHost(single);
        let st: { isDirectory: boolean; isFile: boolean } | null = null;
        try {
          const s = statSync(hostDir);
          st = { isDirectory: s.isDirectory(), isFile: s.isFile() };
        } catch {
          st = null;
        }
        if (!st) {
          return {
            ok: false,
            error: `Micrographs folder not accessible: ${customRaw} — re-pick it in the params tab (Browse…)`,
          };
        }
        if (st.isDirectory) {
          const mrcs = readdirSync(hostDir)
            .filter((f) => MIC_RE.test(f))
            .sort();
          if (mrcs.length === 0) {
            return {
              ok: false,
              error: `No .mrc/.mrcs/.tif/.eer micrographs found in ${customRaw}`,
            };
          }
          hostFiles = mrcs.map((m) => path.join(hostDir, m));
        } else {
          if (!MIC_RE.test(path.basename(hostDir))) {
            return {
              ok: false,
              error: `Not a micrograph file (.mrc/.mrcs/.tif/.tiff/.eer): ${customRaw}`,
            };
          }
          hostFiles = [hostDir];
        }
      }

      if (hostFiles.length === 0) {
        return {
          ok: false,
          error: multiFile
            ? `No image files (.mrc/.mrcs/.tif/.tiff/.eer) among the ${listed.length} selected paths`
            : `No image files (.mrc/.mrcs/.tif/.tiff/.eer) match the pattern ${single}`,
        };
      }

      let unlinked = 0;
      if (!multiFile && !isPattern) {
        // folder import — link the WHOLE directory (one junction/symlink,
        // star stays project-relative; transparent to WSL drvfs too)
        const hostDir = toHost(single);
        const linked =
          linkDirInto(hostDir, path.join(projectDir, "micrographs")) &&
          linkDirInto(hostDir, path.join(workdir, "micrographs"));
        if (linked) {
          for (const f of hostFiles) lines.push(`micrographs/${path.basename(f)} 1`);
        } else {
          // no link possible (e.g. junction to a UNC \\wsl.localhost target) —
          // absolute paths: RELION opens them as-is; on a Windows host with the
          // bridge they are translated to WSL-side /… paths.
          for (const f of hostFiles) {
            lines.push(`${bridge ? hostToWsl(f) : f} 1`);
            unlinked += 1;
          }
        }
      } else {
        // pattern / file-list — link the FILES into a real project dir
        const r = importFileSet(hostFiles, projectDir, workdir, bridge);
        for (const e of r.entries) lines.push(`${e} 1`);
        unlinked = r.unlinked;
      }

      const skipNote = skipped > 0 ? ` · ${skipped} non-image file${skipped === 1 ? "" : "s"} skipped` : "";
      const linkedCount = hostFiles.length - unlinked;
      const linkNote =
        unlinked > 0
          ? ` · ${linkedCount} linked, ${unlinked} referenced by path (source not linkable)`
          : "";
      const kindNote = isPattern ? " · pattern" : multiFile ? " · file list" : "";
      result = `${hostFiles.length} micrographs imported${kindNote}${skipNote}${linkNote} (pixel ${pixel} Å)`;
      if (!sourceLabel) {
        sourceLabel =
          "source: " +
          (isPattern ? "pattern " : multiFile ? `${listed.length} selected files — ` : "") +
          customRaw.slice(0, 200) +
          (unlinked > 0 ? " (absolute paths)" : "");
      }
    } else {
      result = "Import job completed (no source data configured — pick a micrographs folder, pattern or files in the params tab)";
      sourceLabel = "source: (none configured)";
    }
  }

  writeFileSync(starPath, lines.join("\n") + "\n");
  const logText = [
    `CryoFlow engine-native import ${new Date().toISOString()}`,
    `pixel=${pixel} Å  voltage=${kV} kV  Cs=${cs} mm  Q0=${q0}`,
    sourceLabel,
    `output: ${starPath}`,
    result,
    "",
  ].join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: write micrographs.star (RELION 5 optics format)",
    { micrographs_star: starPath },
    result,
    logText
  );
  return { ok: true, result };
}

/** ManualPick: import Henderson .coord files as a RELION pick STAR. */
async function runManualPickNative(job: EngineJobRef, upstream: UpstreamRef[]): Promise<NativeResult> {
  const resolved = resolveInputs("manualpick", upstream);
  if (resolved.missing) return { ok: false, error: resolved.missing, wait: resolved.wait };
  const micStar = resolved.inputs.micrographs_star;

  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const starPath = path.join(workdir, "manualpick.star");

  const mics = micrographNames(micStar);
  if (mics.length === 0) {
    return { ok: false, error: `No micrographs found in ${micStar} (run Import first)` };
  }
  const projectDir = projectDirFor(job);
  // Star paths are project-root-relative — resolve to absolute for FS access.
  // Absolute entries (import's no-link fallback) may be WSL-side paths on a
  // Windows host → translate /mnt/<drive> and distro paths back to host form.
  const bridge = bridgeFromStatus(await detectRelion());
  const toAbs = (mic: string) => {
    const abs = mic.startsWith("/") ? mic : path.join(projectDir, mic);
    if (!isWindowsPath(abs) && abs.startsWith("/") && !existsSync(abs)) {
      // WSL-side path this host cannot open as-is
      const mnt = abs.match(/^\/mnt\/([A-Za-z])\/(.*)$/);
      if (mnt) return `${mnt[1].toUpperCase()}:\\${mnt[2].replace(/\//g, "\\")}`;
      if (bridge?.distro) {
        return `\\\\wsl.localhost\\${bridge.distro}\\${abs.slice(1).replace(/\//g, "\\")}`;
      }
    }
    return abs;
  };

  const lines: string[] = [
    "data_particles",
    "",
    "loop_",
    "_rlnCoordinateX #1",
    "_rlnCoordinateY #2",
    "_rlnMicrographName #3",
  ];
  let total = 0;
  const missing: string[] = [];
  // Also write plain .coord files (RELION extract consumes them via
  // --coord_dir/--coord_suffix) — readCoordinates() parses "x y" ASCII.
  const coordsDir = path.join(workdir, "micrographs");
  mkdirSync(coordsDir, { recursive: true });
  const coordText: string[] = [];
  for (const mic of mics) {
    const micAbs = toAbs(mic);
    const coord = micAbs.replace(/\.mrcs?$/i, "") + ".coord";
    if (!existsSync(coord)) {
      missing.push(path.basename(coord));
      continue;
    }
    const rows = readFileSync(coord, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    const outRows: string[] = [];
    for (const row of rows) {
      const parts = row.split(/\s+/);
      if (parts.length >= 2) {
        // keep the project-relative micrograph name (matches import star)
        lines.push(`${parts[0]} ${parts[1]} ${mic}`);
        outRows.push(`${parts[0]} ${parts[1]}`);
        total++;
      }
    }
    if (outRows.length > 0) {
      const base = path.basename(mic).replace(/\.mrcs?$/i, "");
      writeFileSync(path.join(coordsDir, base + ".coord"), outRows.join("\n") + "\n");
      coordText.push(`  ${base}.coord (${outRows.length} picks)`);
    }
    // expose the picked micrograph frames next to their coord files so the
    // picks preview panel can render overlay thumbnails via outputs/file
    const micLink = path.join(coordsDir, path.basename(mic));
    if (!existsSync(micLink)) {
      try {
        symlinkSync(micAbs, micLink);
      } catch {
        /* best-effort — preview only */
      }
    }
  }
  if (total === 0) {
    return {
      ok: false,
      error: `No .coord pick files found beside the micrographs (expected Henderson picks in ${EMPIAR_DIR}) — missing: ${missing.join(", ")}`,
    };
  }

  writeFileSync(starPath, lines.join("\n") + "\n");
  const result = `${total} picks imported from Henderson .coord files`;
  const logText = [
    `CryoFlow engine-native manualpick ${new Date().toISOString()}`,
    `micrographs: ${mics.length} (from ${micStar})`,
    ...coordText,
    `output: ${starPath} (${total} coordinates)`,
    `coord files: ${coordsDir}/*.coord (consumed by relion_preprocess --coord_dir)`,
    result,
    "",
  ].join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: import Henderson .coord picks",
    { coords_star: starPath, coords_dir: workdir },
    result,
    logText
  );
  return { ok: true, result };
}

/** Select: class-aware or first-N subset of upstream particles.star (engine-native).
 *
 * When the input STAR carries `_rlnClassNumber` (e.g. the run_data.star of a
 * Class2D/Class3D job) and classCutoff > 0, classes whose occupancy is below
 * cutoff × (largest class occupancy) are pruned — the programmatic equivalent
 * of RELION's "select good 2D classes by occupancy" workflow.
 * Otherwise: first-N subset.
 */
async function runSelectNative(job: EngineJobRef, upstream: UpstreamRef[]): Promise<NativeResult> {
  const resolved = resolveInputs("select", upstream);
  if (resolved.missing) return { ok: false, error: resolved.missing, wait: resolved.wait };
  const inStar = resolved.inputs.particles_star;

  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const outStar = path.join(workdir, "particles_select.star");

  const text = readFileSync(inStar, "utf8");
  const blocks = parseStarBlocks(text);
  const outLines: string[] = [];
  let total = 0;
  let kept = 0;
  const maxN = Math.max(1, Math.round(num(job, "maxParticles", 1000)));
  const cutoff = Math.max(0, Math.min(1, num(job, "classCutoff", 0.5)));
  const classStats: { cls: string; count: number; kept: boolean }[] = [];
  let keptClasses = 0;

  for (const block of blocks) {
    outLines.push(block.header, "");
    const lines = block.lines;
    // find the loop header boundary
    let i = 0;
    const isParticles = lines.some((l) => l.trim().startsWith("_rlnImageName"));
    if (!isParticles) {
      for (const l of lines) outLines.push(l);
      outLines.push("");
      continue;
    }
    // header lines until the first data row
    while (
      i < lines.length &&
      (lines[i].trim() === "" ||
        lines[i].trim() === "loop_" ||
        lines[i].trim().startsWith("_rln") ||
        lines[i].trim().startsWith("#"))
    ) {
      if (lines[i].trim() !== "") outLines.push(lines[i]);
      i++;
    }

    // class-aware mode: find the _rlnClassNumber column index
    const classCol = labelColumn(lines, i, "_rlnClassNumber");

    let keepClasses: Set<number> | null = null;
    if (classCol >= 0 && cutoff > 0) {
      // first pass: occupancy per class
      const counts = new Map<number, number>();
      for (let r = i; r < lines.length; r++) {
        const t = lines[r].trim();
        if (!t) continue;
        const cells = t.split(/\s+/);
        const cls = parseInt(cells[classCol] ?? "", 10);
        if (Number.isFinite(cls)) counts.set(cls, (counts.get(cls) ?? 0) + 1);
      }
      const maxCount = Math.max(0, ...counts.values());
      keepClasses = new Set<number>();
      for (const [cls, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
        const ok = count >= cutoff * maxCount;
        classStats.push({ cls: String(cls), count, kept: ok });
        if (ok) {
          keepClasses.add(cls);
          keptClasses++;
        }
      }
    }

    for (let r = i; r < lines.length; r++) {
      const t = lines[r].trim();
      if (!t) continue;
      total++;
      let keep = kept < maxN;
      if (keep && keepClasses) {
        const cells = t.split(/\s+/);
        const cls = parseInt(cells[classCol] ?? "", 10);
        keep = Number.isFinite(cls) && keepClasses.has(cls);
      }
      if (keep) {
        outLines.push(t);
        kept++;
      }
    }
    outLines.push("");
  }

  writeFileSync(outStar, outLines.join("\n") + "\n");
  const result =
    classStats.length > 0
      ? `${kept} of ${total} particles selected · kept ${keptClasses}/${classStats.length} classes (occupancy ≥ ${cutoff}× best)`
      : `${kept} of ${total} particles selected`;
  const logText = [
    `CryoFlow engine-native select ${new Date().toISOString()}`,
    `input:  ${inStar} (${total} particles)`,
    ...(classStats.length > 0
      ? [
          "class occupancy (count · kept):",
          ...classStats
            .sort((a, b) => b.count - a.count)
            .map((c) => `  class ${c.cls}: ${c.count} · ${c.kept ? "kept" : "PRUNED"}`),
        ]
      : [`mode: first-N (no _rlnClassNumber column or classCutoff=0)`]),
    `output: ${outStar} (${kept} particles)`,
    result,
    "",
  ].join("\n");
  recordNativeRun(job, workdir, "engine-native: particle selection (class-aware)", { particles_star: outStar }, result, logText);
  return { ok: true, result };
}

/* ------------------------------------------------------------------ */
/* CLI argv builders (faithful to pipeline_jobs.cpp)                    */
/* ------------------------------------------------------------------ */

interface BuildCtx {
  binDir: string;
  workdir: string;
  inputs: Record<string, string>;
  job: EngineJobRef;
  upstream: UpstreamRef[];
  /** Active WSL bridge (null on native execution). */
  bridge: WslBridge | null;
}

function outPath(ctx: BuildCtx, name: string): string {
  return path.join(ctx.workdir, name);
}

/**
 * Resolve an external program executable.
 *  - native installs: bin dir first, then the host PATH (`which`)
 *  - WSL-bridged installs: the bin dir and PATH live INSIDE the distro —
 *    host existsSync/`which` cannot see them (and `which` does not exist on
 *    Windows at all) — so ask the distro itself with `command -v`.
 */
async function externalOnPath(
  binDir: string,
  names: string[],
  bridge: WslBridge | null
): Promise<string | null> {
  for (const n of names) {
    if (bridge) {
      // distro-side lookup — one wsl.exe call per name
      try {
        const args: string[] = [];
        if (bridge.distro) args.push("-d", bridge.distro);
        const q = binDir.replace(/'/g, "'\\''");
        const nm = n.replace(/'/g, "'\\''");
        args.push(
          "-e", "bash", "-lc",
          `command -v '${nm}' 2>/dev/null || { test -x '${q}'/'${nm}' && printf '%s' '${q}/${n}'; } || true`
        );
        const found = await new Promise<string>((resolve) => {
          execFile("wsl.exe", args, { timeout: 4000, windowsHide: true }, (err, stdout) => {
            const out = String(stdout ?? "").trim();
            resolve(!err && out.startsWith("/") ? out : "");
          });
        });
        if (found) return found;
      } catch {
        /* distro unreachable — the honest not-found error below */
      }
    } else {
      if (existsSync(path.join(binDir, n))) return path.join(binDir, n);
      const found = await new Promise<string | null>((resolve) => {
        execFile("which", [n], { timeout: 2000 }, (err, stdout) => {
          const out = String(stdout ?? "").trim();
          resolve(!err && out.includes("/") ? out : null);
        });
      });
      if (found) return found;
    }
  }
  return null;
}

/**
 * Build the real argv for a type. Returns argv (WITHOUT mpirun prefix —
 * that is decided by the caller) or an honest-failure message.
 */
async function buildArgv(ctx: BuildCtx): Promise<string[] | { error: string }> {
  const { job, inputs, binDir } = ctx;
  const type = job.type;

  switch (type) {
    case "ctffind": {
      const argv = [
        path.join(binDir, "relion_run_ctffind"),
        "--i", inputs.micrographs_star,
        "--o", ctx.workdir + "/",
        "--Box", String(num(job, "box", 512)),
        "--ResMin", String(num(job, "resMin", 30)),
        "--ResMax", String(num(job, "resMax", 5)),
        "--dFMin", String(num(job, "dFMin", 5000)),
        "--dFMax", String(num(job, "dFMax", 50000)),
        "--FStep", "500",
        "--dAst", "0",
        "--is_ctffind4",
        "--fast_search",
      ];
      const ctffindExe = resolveCtffind(ctx.bridge);
      if (ctffindExe) argv.push("--ctffind_exe", ctffindExe);
      return argv;
    }

    case "extract": {
      const box = Math.round(num(job, "boxSize", 128));
      const down = Math.round(num(job, "downsampleTo", 64));
      const doScale = down > 0 && down < box;
      // bg radius: 0.75 × effective box / 2 (RELION default when bgDiameter < 0)
      const bgDiam = num(job, "bgDiameter", -1);
      const effBox = doScale ? down : box;
      const bg = bgDiam > 0 ? Math.round((bgDiam * effBox) / box / 2) : Math.round(0.375 * effBox);
      // Coordinate source: manualpick writes <workdir>/micrographs/*.coord —
      // relion_preprocess composes fn_coord = coord_dir + fn_post + suffix,
      // where fn_post is the mic path minus extension ("micrographs/X") —
      // so coord_dir points at the manualpick JOB dir (contains micrographs/).
      const coordsInput = inputs.coords_dir;
      const isCoordDir =
        existsSync(coordsInput) && statSync(coordsInput).isDirectory();
      const coordDir = isCoordDir ? coordsInput + "/" : path.dirname(coordsInput) + "/";
      const coordSuffix = isCoordDir ? ".coord" : path.extname(coordsInput) || ".star";
      const argv = [
        path.join(binDir, "relion_preprocess"),
        "--i", inputs.micrographs_star,
        "--coord_dir", coordDir,
        "--coord_suffix", coordSuffix,
        "--part_star", outPath(ctx, "particles.star"),
        "--part_dir", ctx.workdir + "/",
        "--extract",
        "--extract_size", String(box),
      ];
      if (doScale) argv.push("--scale", String(down));
      argv.push(
        "--norm", "--bg_radius", String(bg),
        "--white_dust", "3",
        "--black_dust", "-3"
      );
      return argv;
    }

    case "class2d": {
      const argv = [
        path.join(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 10))),
        "--tau2_fudge", String(num(job, "tau2Fudge", 1)),
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--ctf",
        "--pad", "2",
        "--iter", String(Math.round(num(job, "iterations", 25))),
        // finer in-plane angular sampling → sharper class averages
        "--psi_step", String(num(job, "psiSampling", 6)),
        "--flatten_solvent",
        "--zero_mask",
      ];
      // optional cap on alignment resolution (0 = unlimited)
      const hl = num(job, "highresLimit", 0);
      if (hl > 0) argv.push("--highres_limit", String(hl));
      return argv;
    }

    case "initialmodel": {
      // VDAM gradient refinement — no MPI (RELION forbids --grad with MPI)
      return [
        path.join(binDir, "relion_refine"),
        "--grad", "--denovo_3dref",
        "--i", inputs.particles_star,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 4))),
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--sym", str(job, "symmetry", "D2"),
        "--ctf",
        "--iter", String(Math.round(num(job, "iterations", 50))),
        "--flatten_solvent",
        "--zero_mask",
        // memory: VDAM allocates K reference + gradient volumes at padded box
        // size; pad 1 (128³ instead of 256³ grids) cuts RSS from ~1.7GB to
        // under 1GB — de-novo models only need ~30 Å detail, where the
        // un-padded FFT grid is more than sufficient (RELION default pad is 2).
        "--pad", "1",
        // fewer particles pooled per task → smaller E-step working set
        "--pool", "3",
      ];
    }

    case "class3d": {
      return [
        path.join(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--ref", inputs.model_mrc,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 4))),
        "--tau2_fudge", "4",
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--sym", str(job, "symmetry", "C1"),
        "--ctf",
        "--pad", "2",
        "--iter", String(Math.round(num(job, "iterations", 25))),
        "--flatten_solvent",
      ];
    }

    case "refine3d": {
      const argv = [
        path.join(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--ref", inputs.model_mrc,
        "--o", outPath(ctx, "run"),
        "--sym", str(job, "symmetry", "D2"),
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--ctf",
        "--pad", String(Math.round(num(job, "padding", 2))),
        "--firstiter_cc",
        "--ini_high", String(num(job, "iniHigh", 30)),
        // the reference may come from a different-box job (e.g. a low-res
        // InitialModel) — RELION resizes it to the particles' optics group
        "--trust_ref_size",
        "--split_random_halves",
      ];
      if (flagAutoRefine(job)) argv.push("--auto_refine");
      else argv.push("--iter", String(Math.round(num(job, "iterations", 15))), "--tau2_fudge", "1");
      return argv;
    }

    case "maskcreate": {
      return [
        path.join(binDir, "relion_mask_create"),
        "--i", inputs.map_mrc,
        "--o", outPath(ctx, "mask.mrc"),
        "--lowpass", String(num(job, "lowpass", 15)),
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
        "--ini_threshold", String(num(job, "threshold", 0.02)),
        "--extend_inimask", String(Math.round(num(job, "extend", 3))),
        "--width_soft_edge", String(Math.round(num(job, "softEdge", 6))),
        "--j", "4",
      ];
    }

    case "postprocess": {
      const argv = [
        path.join(binDir, "relion_postprocess"),
        "--i", inputs.half1_mrc,
        "--o", outPath(ctx, "postprocess"),
        "--mask", inputs.mask_mrc,
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
      ];
      if (flag(job, "autoBfac")) {
        argv.push("--auto_bfac", "--autob_lowres", String(num(job, "autobLowres", 10)));
      }
      const randomizeFrom = num(job, "randomizeFrom", 0);
      if (randomizeFrom > 0) argv.push("--randomize_at", String(randomizeFrom));
      return argv;
    }

    case "motioncorr": {
      const mc2 = await externalOnPath(binDir, ["motioncor2", "MotionCor2"], ctx.bridge);
      if (!mc2) {
        return {
          error:
            "MotionCor2 executable not found — EMPIAR-10017 images are pre-averaged anyway (import them as micrographs and skip MotionCorr)",
        };
      }
      return [
        path.join(binDir, "relion_run_motioncorr"),
        "--i", inputs.micrographs_star,
        "--o", ctx.workdir + "/",
        "--use_motioncor2",
        "--motioncor2_exe", mc2,
        "--bin_factor", "1",
        "--bfactor", String(num(job, "bfactor", 150)),
        "--dose_per_frame", String(num(job, "dosePerFrame", 1.28)),
        "--patch_x", String(Math.round(num(job, "patchX", 5))),
        "--patch_y", String(Math.round(num(job, "patchY", 5))),
        "--j", "4",
      ];
    }

    case "autopick": {
      return [
        path.join(binDir, "relion_autopick"),
        "--i", inputs.micrographs_star,
        "--odir", ctx.workdir + "/",
        "--pickname", "autopick",
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--threshold", String(num(job, "threshold", 0.4)),
        "--lowpass", String(num(job, "lowpass", 20)),
        "--ref", inputs.refs_mrc,
      ];
    }

    case "localres": {
      const argv = [
        path.join(binDir, "relion_postprocess"),
        "--locres",
        "--i", inputs.half1_mrc,
        "--o", outPath(ctx, "relion"),
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
        "--adhoc_bfac", String(num(job, "adhocBfac", -100)),
      ];
      if (inputs.mask_mrc) argv.push("--mask", inputs.mask_mrc);
      return argv;
    }

    case "polish": {
      return [
        path.join(binDir, "relion_motion_refine"),
        "--i", inputs.particles_star,
        "--f", inputs.postprocess_star,
        "--corr_mic", inputs.micrographs_star,
        "--first_frame", String(Math.round(num(job, "firstFrame", 1))),
        "--last_frame", String(Math.round(num(job, "lastFrame", 24))),
        "--o", ctx.workdir + "/",
        "--eval_frac", String(num(job, "evalFrac", 0.5)),
      ];
    }

    case "ctfrefine": {
      const argv = [
        path.join(binDir, "relion_ctf_refine"),
        "--i", inputs.particles_star,
        "--f", inputs.postprocess_star,
        "--o", ctx.workdir + "/",
      ];
      if (flag(job, "fitDefocus")) {
        argv.push("--fit_defocus", "--kmin_defocus", String(num(job, "minres", 20)));
      }
      if (flag(job, "fitAstig")) argv.push("--fit_astig");
      return argv;
    }

    case "dynamight": {
      const exe = await externalOnPath(binDir, ["relion_python_dynamight", "dynamight"], ctx.bridge);
      if (!exe) {
        return { error: "DynaMight requires python + torch (relion_python_dynamight not found on PATH)" };
      }
      return [
        exe,
        "optimize-deformations",
        "--refinement-star-file", inputs.particles_star,
        "--output-directory", ctx.workdir + "/",
        "--initial-model", inputs.model_mrc,
        "--n-gaussians", String(Math.round(num(job, "nGaussians", 10000))),
        "--regularization-factor", String(num(job, "regFactor", 1)),
        "--n-threads", String(Math.round(num(job, "nThreads", 4))),
      ];
    }

    case "modelangelo": {
      const exe = await externalOnPath(binDir, ["model_angelo", "modelangelo"], ctx.bridge);
      if (!exe) {
        return { error: "ModelAngelo requires a python environment with model_angelo installed (not found on PATH)" };
      }
      const argv = [exe, str(job, "buildMode", "build_no_seq"), "-v", inputs.map_mrc, "-o", ctx.workdir + "/", "-d", str(job, "gpuId", "0")];
      return argv;
    }

    case "joinstar": {
      // gather ALL upstream particle stars (need ≥2)
      const runs = readRuns();
      const stars: string[] = [];
      for (const up of ctx.upstream) {
        const state = runs[up.id];
        if (state?.done && state.exitCode === 0 && state.outputs.particles_star && existsSync(state.outputs.particles_star)) {
          stars.push(state.outputs.particles_star);
        }
      }
      if (stars.length < 2) {
        return { error: GENERIC_REQUIREMENTS[type] };
      }
      const dupLabel = str(job, "selectKind", "particles") === "micrographs" ? "rlnMicrographName" : str(job, "selectKind", "particles") === "movies" ? "rlnMicrographMovieName" : "rlnImageName";
      return [
        path.join(binDir, "relion_star_handler"),
        "--combine",
        "--i", stars.join(" "),
        "--check_duplicates", dupLabel,
        "--o", outPath(ctx, "join_particles.star"),
      ];
    }

    case "subtract": {
      const argv = [
        path.join(binDir, "relion_particle_subtract"),
        "--i", inputs.optimiser_star,
        "--mask", inputs.mask_mrc,
        "--o", ctx.workdir + "/",
      ];
      if (inputs.particles_star) argv.push("--data", inputs.particles_star);
      if (flag(job, "recenter")) argv.push("--recenter_on_mask");
      if (flag(job, "float16")) argv.push("--float16");
      const nb = Math.round(num(job, "newBox", -1));
      if (nb > 0) argv.push("--new_box", String(nb));
      return argv;
    }

    case "multibody":
      return { error: `Command template for multibody requires ${GENERIC_REQUIREMENTS.multibody}` };

    /* ---------------- TOMO ---------------- */
    case "tomo_import":
      return { error: `Command template for tomo_import requires ${GENERIC_REQUIREMENTS.tomo_import}` };

    case "tomo_aligntiltseries": {
      const method = str(job, "method", "AreTomo2");
      const argv = [
        path.join(binDir, "relion_align_tiltseries"),
        "--i", inputs.tilt_series_star,
        "--o", ctx.workdir + "/",
        "--tomogram_thickness", String(num(job, "thickness", 300)),
      ];
      if (method === "AreTomo2") argv.push("--aretomo2", "--aretomo_exe", "AreTomo2");
      else if (method === "IMOD fiducials")
        argv.push("--imod_fiducials", "--fiducial_diameter", String(num(job, "fiducialDiameter", 10)), "--batchtomo_exe", "batchruntomo");
      else argv.push("--imod_patchtrack", "--patch_size", "100", "--patch_overlap", "50", "--batchtomo_exe", "batchruntomo");
      return argv;
    }

    case "tomo_tomograms": {
      return [
        path.join(binDir, "relion_tomo_reconstruct_tomogram"),
        "--t", inputs.tilt_series_star,
        "--o", ctx.workdir + "/",
        "--w", String(Math.round(num(job, "xdim", 1024))),
        "--h", String(Math.round(num(job, "xdim", 1024))),
        "--d", String(Math.round(num(job, "zdim", 300))),
        "--binned_angpix", String(num(job, "binnedAngpix", 10)),
        "--j", "4",
      ];
    }

    case "tomo_ctfrefine": {
      const half2 = inputs.half1_mrc.replace("half1", "half2");
      return [
        path.join(binDir, "relion_tomo_refine_ctf"),
        "--i", inputs.particles_star,
        "--ref1", inputs.half1_mrc,
        "--ref2", existsSync(half2) ? half2 : inputs.half1_mrc,
        "--b", String(Math.round(num(job, "boxSize", 128))),
        "--focus_range", String(num(job, "focusRange", 3000)),
        "--o", ctx.workdir + "/",
      ];
    }

    case "tomo_exclude": {
      return [
        path.join(binDir, "relion_python_tomo_exclude_tilt_images"),
        "--tilt-series-star-file", inputs.tilt_series_star,
        "--cache-size", String(Math.round(num(job, "cacheSize", 5))),
        "--output-directory", ctx.workdir + "/",
      ];
    }

    case "tomo_polish": {
      const half2 = inputs.half1_mrc.replace("half1", "half2");
      const argv = [
        path.join(binDir, "relion_tomo_align"),
        "--i", inputs.particles_star,
        "--ref1", inputs.half1_mrc,
        "--ref2", existsSync(half2) ? half2 : inputs.half1_mrc,
        "--theme", "classic",
        "--o", ctx.workdir + "/",
        "--b", String(Math.round(num(job, "boxSize", 128))),
        "--r", String(num(job, "maxError", 5)),
      ];
      if (str(job, "motionMode", "motion") === "shift_only") argv.push("--shift_only");
      return argv;
    }

    case "tomo_reconstruct": {
      return [
        path.join(binDir, "relion_tomo_reconstruct_particle"),
        "--i", inputs.particles_star,
        "--theme", "classic",
        "--o", ctx.workdir + "/",
        "--b", String(Math.round(num(job, "boxSize", 128))),
        "--bin", String(num(job, "binning", 1)),
        "--j", "4",
        "--sym", "C1",
      ];
    }

    case "tomo_denoise": {
      const exe = await externalOnPath(binDir, ["relion_python_tomo_denoise"], ctx.bridge);
      if (!exe) {
        return { error: "cryoCARE requires a python environment (relion_python_tomo_denoise not found on PATH)" };
      }
      const mode = str(job, "mode", "cryoCARE:train");
      return [
        exe,
        mode,
        "--tomogram-star-file", inputs.tomograms_star,
        "--output-directory", ctx.workdir + "/",
        "--gpu", "0",
      ];
    }

    case "tomo_picks": {
      const pick = await externalOnPath(binDir, ["relion_python_tomo_pick"], ctx.bridge);
      if (!pick) {
        return { error: "Napari picking requires a python environment (relion_python_tomo_pick not found on PATH)" };
      }
      return [
        pick,
        str(job, "pickMode", "particles"),
        "--tilt-series-star-file", inputs.tilt_series_star,
        "--output-directory", ctx.workdir + "/",
      ];
    }

    case "tomo_extract": {
      return [
        path.join(binDir, "relion_tomo_subtomo"),
        "--i", inputs.particles_star,
        "--theme", "classic",
        "--o", ctx.workdir + "/",
        "--b", String(Math.round(num(job, "boxSize", 128))),
        "--bin", String(num(job, "binning", 1)),
        "--stack2d",
        "--float16",
        "--j", "4",
      ];
    }

    case "external": {
      const script = path.join(ctx.workdir, "run.sh");
      if (!existsSync(script)) {
        return { error: `Command template for external requires ${GENERIC_REQUIREMENTS.external}` };
      }
      return [str(job, "interpreter", "bash"), script];
    }

    default:
      return { error: `Command template for ${type} requires input data (no builder implemented)` };
  }
}

function flagAutoRefine(job: EngineJobRef): boolean {
  return String(job.params.autoRefine ?? "false") === "true";
}

/* ------------------------------------------------------------------ */
/* Completion checks & output harvesting                                */
/* ------------------------------------------------------------------ */

function firstExisting(dir: string, candidates: string[]): string | null {
  for (const c of candidates) {
    const p = path.join(dir, c);
    if (existsSync(p)) return p;
  }
  return null;
}

function globOne(dir: string, pattern: RegExp): string | null {
  try {
    const hit = readdirSync(dir).find((f) => pattern.test(f));
    return hit ? path.join(dir, hit) : null;
  } catch {
    return null;
  }
}

/** Iteration number encoded in a RELION per-iteration file name (it000 → 0). */
function iterOf(name: string): number {
  const m = /it(\d+)/.exec(name);
  return m ? parseInt(m[1], 10) : -1;
}

/** Like globOne but deterministic: prefers the HIGHEST iteration, then name order. */
function globLatest(dir: string, pattern: RegExp): string | null {
  try {
    const hits = readdirSync(dir)
      .filter((f) => pattern.test(f))
      .sort((a, b) => iterOf(b) - iterOf(a) || a.localeCompare(b));
    return hits.length > 0 ? path.join(dir, hits[0]) : null;
  } catch {
    return null;
  }
}

/** Resolve the 0-based data-row column of a label inside the loop header [0, headerEnd).
 * Handles both "_rlnX 3" (explicit index) and "_rlnX #3" (RELION 5 position
 * comment — 1-based running position of _rln labels inside the loop). */
function labelColumn(lines: string[], headerEnd: number, label: string): number {
  let pos = 0; // 1-based running position of labels in the current loop
  let inLoop = false;
  for (let h = 0; h < headerEnd; h++) {
    const t = lines[h].trim();
    if (t === "loop_") {
      inLoop = true;
      pos = 0;
      continue;
    }
    if (!inLoop || !t.startsWith("_")) continue;
    const name = t.split(/\s+/)[0];
    pos++;
    if (name === label) {
      const m = /#\s*(\d+)\s*$/.exec(t) ?? /^_\S+\s+(\d+)\s*$/.exec(t);
      return m ? parseInt(m[1], 10) - 1 : pos - 1;
    }
  }
  return -1;
}

/** Most populated _rlnClassNumber in a data star (or null). */
function bestClassFromData(starPath: string): number | null {
  const dist = classDistributionFromData(starPath);
  if (!dist) return null;
  let best: number | null = null;
  let bestCount = -1;
  for (const [cls, count] of dist.counts) {
    if (count > bestCount) {
      bestCount = count;
      best = cls;
    }
  }
  return best;
}

/**
 * Class occupancy from a RELION data.star (counts of _rlnClassNumber).
 * Used to summarize 2D classification quality in the job result line.
 */
function classDistributionFromData(
  starPath: string
): { counts: Map<number, number>; total: number } | null {
  try {
    const text = readFileSync(starPath, "utf8");
    const lines = text.split("\n");
    const classCol = labelColumn(lines, lines.length, "_rlnClassNumber");
    if (classCol < 0) return null;
    const counts = new Map<number, number>();
    let total = 0;
    for (const raw of lines) {
      const t = raw.trim();
      if (!t || t.startsWith("#") || t.startsWith("_") || t === "loop_" || t.startsWith("data_")) continue;
      const cells = t.split(/\s+/);
      if (cells.length <= classCol) continue;
      const cls = parseInt(cells[classCol], 10);
      if (Number.isFinite(cls)) {
        counts.set(cls, (counts.get(cls) ?? 0) + 1);
        total++;
      }
    }
    return total > 0 ? { counts, total } : null;
  } catch {
    return null;
  }
}

function countStarRows(starPath: string): number {
  try {
    const blocks = parseStarBlocks(readFileSync(starPath, "utf8"));
    let n = 0;
    for (const b of blocks) {
      // only count loop_ blocks with _rln labels; skip optics rows (first token opt*)
      if (!b.lines.some((l) => l.trim() === "loop_")) continue;
      for (const line of b.lines) {
        const t = line.trim();
        if (!t || t === "loop_" || t.startsWith("#") || t.startsWith("_rln") || t.startsWith("data_")) {
          continue;
        }
        const first = t.split(/\s+/)[0] ?? "";
        if (/^opt(ics|ic|group)/i.test(first)) continue;
        n++;
      }
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * After a CLI job exits 0: verify expected outputs exist, harvest output
 * paths and build the human result string.
 */
function collectOutputs(type: string, workdir: string): { outputs: Record<string, string>; result: string } {
  const outputs: Record<string, string> = {};
  let result = `REAL: ${type} exited 0`;

  switch (type) {
    case "ctffind": {
      const star = firstExisting(workdir, ["micrographs_ctf.star"]);
      if (star) {
        outputs.micrographs_ctf_star = star;
        result = `REAL: CTF estimated for ${countStarRows(star)} micrographs`;
      }
      break;
    }
    case "motioncorr": {
      const star = firstExisting(workdir, ["corrected_micrographs.star"]);
      if (star) {
        outputs.micrographs_star = star;
        result = `REAL: motion corrected, ${countStarRows(star)} micrographs`;
      }
      break;
    }
    case "autopick": {
      const star = firstExisting(workdir, ["autopick.star"]);
      if (star) {
        outputs.coords_star = star;
        result = "REAL: autopick coordinates written";
      }
      break;
    }
    case "extract": {
      const star = firstExisting(workdir, ["particles.star"]);
      if (star) {
        outputs.particles_star = star;
        result = `REAL: ${countStarRows(star)} particles extracted`;
      }
      break;
    }
    case "class2d": {
      // RELION 5 writes class stacks with the .mrcs extension
      const classes =
        firstExisting(workdir, ["run_unmasked_classes.mrcs", "run_classes.mrcs", "run_classes.mrc"]) ??
        globLatest(workdir, /^run_it\d+_classes\.mrcs?$/);
      if (classes) {
        outputs.classes_mrc = classes;
        // the per-iteration data star carries assignments/offsets — chainable
        const data = globLatest(workdir, /^run_it\d+_data\.star$/) ?? firstExisting(workdir, ["run_data.star"]);
        if (data) outputs.particles_star = data;
        result = "REAL: 2D classification finished — class averages written";
        // class occupancy summary — the quality signal for 2D results
        const dist = data ? classDistributionFromData(data) : null;
        if (dist) {
          const ranked = [...dist.counts.entries()].sort((a, b) => b[1] - a[1]);
          const top = ranked
            .slice(0, 3)
            .map(([cls, n]) => `class ${cls} ${Math.round((100 * n) / dist.total)}%`)
            .join(", ");
          result = `REAL: 2D classification finished — ${dist.counts.size} classes · ${dist.total.toLocaleString()} particles · top: ${top}`;
        }
      }
      break;
    }
    case "initialmodel": {
      // VDAM writes per-iteration class volumes; the reference for downstream
      // jobs is the most populated class of the FINAL iteration
      const finalIter = globLatest(workdir, /^run_it\d+_class\d+\.mrc$/);
      let model =
        finalIter ??
        globLatest(workdir, /class\d+\.mrcs?$/i) ??
        firstExisting(workdir, ["run_model.mrc", "run_model.mrcs", "run_classes.mrcs"]);
      if (finalIter) {
        const m = /^run_it(\d+)_class(\d+)\.mrc$/.exec(path.basename(finalIter));
        if (m) {
          const iterStr = String(parseInt(m[1], 10)).padStart(3, "0");
          const best = bestClassFromData(path.join(workdir, `run_it${iterStr}_data.star`));
          if (best != null) {
            const candidate = path.join(workdir, `run_it${iterStr}_class${String(best).padStart(3, "0")}.mrc`);
            if (existsSync(candidate)) model = candidate;
          }
        }
      }
      if (model) {
        outputs.model_mrc = model;
        // VDAM writes run_it<XXX>_data.star — NOT chained as particles output:
        // a de-novo 3D initial model is a low-res SEED; downstream refinements
        // should consume the curated particles.star instead.
        const data = globLatest(workdir, /^run_it\d+_data\.star$/);
        if (data) outputs.refine_data_star = data;
        result = "REAL: de-novo 3D initial model generated";
      }
      break;
    }
    case "class3d":
    case "refine3d": {
      // RELION 5 writes per-iteration half maps: run_it<N>_half1/2_class<K>.mrc
      // (RELION <=4 named the final maps run_half1_class001_unfil.mrc)
      const half1 =
        globLatest(workdir, /^run_it\d+_half1_class\d+\.mrc$/) ??
        firstExisting(workdir, ["run_half1_class001_unfil.mrc"]);
      const half2 =
        globLatest(workdir, /^run_it\d+_half2_class\d+\.mrc$/) ??
        firstExisting(workdir, ["run_half2_class001_unfil.mrc"]);
      const model = half1 ?? firstExisting(workdir, ["run_class001.mrc"]) ?? globLatest(workdir, /^run_it\d+_class\d+\.mrc$/);
      if (model) {
        outputs.model_mrc = model;
        if (half1 && half2) {
          outputs.half1_mrc = half1;
          outputs.half2_mrc = half2;
        }
        const opt = firstExisting(workdir, ["run_optimiser.star"]);
        if (opt) outputs.optimiser_star = opt;
        const data = firstExisting(workdir, ["run_data.star"]);
        if (data) outputs.refine_data_star = data;
        result = parseRefineResult(workdir) ?? `REAL: ${type === "class3d" ? "3D classification" : "3D refinement"} finished`;
      }
      break;
    }
    case "maskcreate": {
      const mask = firstExisting(workdir, ["mask.mrc"]);
      if (mask) {
        outputs.mask_mrc = mask;
        result = "REAL: soft-edged mask created";
      }
      break;
    }
    case "postprocess": {
      const map = firstExisting(workdir, ["postprocess.mrc"]);
      const star = firstExisting(workdir, ["postprocess.star"]);
      if (map) {
        outputs.map_mrc = map;
        if (star) outputs.postprocess_star = star;
        const res = parseFinalResolution(path.join(workdir, "run.out"));
        result = res ? `REAL: sharpened map · FSC(0.143) = ${res} Å` : "REAL: postprocessed map written";
      }
      break;
    }
    case "localres": {
      const locres = firstExisting(workdir, ["relion_locres.mrc"]);
      if (locres) {
        outputs.map_mrc = locres;
        result = "REAL: local resolution map written";
      }
      break;
    }
    case "joinstar": {
      const star = firstExisting(workdir, ["join_particles.star", "join_mics.star", "join_movies.star"]);
      if (star) {
        outputs.particles_star = star;
        result = `REAL: joined STAR (${countStarRows(star)} rows)`;
      }
      break;
    }
    case "subtract": {
      const star = firstExisting(workdir, ["particles_subtracted.star"]);
      if (star) {
        outputs.particles_star = star;
        result = `REAL: ${countStarRows(star)} particles subtracted`;
      }
      break;
    }
    case "polish": {
      const star = firstExisting(workdir, ["shiny.star", "particles_polished.star"]);
      if (star) {
        outputs.particles_star = star;
        result = "REAL: Bayesian polishing finished";
      }
      break;
    }
    case "ctfrefine": {
      const star = firstExisting(workdir, ["particles_ctf_refine.star"]);
      if (star) {
        outputs.particles_star = star;
        result = "REAL: CTF refinement finished";
      }
      break;
    }
    case "tomo_aligntiltseries": {
      const star = firstExisting(workdir, ["aligned_tilt_series.star"]);
      if (star) {
        outputs.aligned_tilt_series_star = star;
        outputs.tilt_series_star = star;
        result = "REAL: tilt series aligned";
      }
      break;
    }
    case "tomo_tomograms":
    case "tomo_denoise": {
      const star = firstExisting(workdir, ["tomograms.star"]);
      if (star) {
        outputs.tomograms_star = star;
        result = `REAL: ${type === "tomo_tomograms" ? "tomograms reconstructed" : "tomograms denoised"}`;
      }
      break;
    }
    case "tomo_reconstruct": {
      const map = firstExisting(workdir, ["merged.mrc"]);
      if (map) {
        outputs.model_mrc = map;
        result = "REAL: subtomogram reconstruction written";
      }
      break;
    }
    case "tomo_picks":
    case "tomo_extract":
    case "tomo_ctfrefine": {
      const star = firstExisting(workdir, ["particles.star"]);
      if (star) {
        outputs.particles_star = star;
        result = `REAL: ${type} particles written`;
      }
      break;
    }
    case "tomo_exclude": {
      const star = firstExisting(workdir, ["selected_tilt_series.star"]);
      if (star) {
        outputs.tilt_series_star = star;
        result = "REAL: tilt images excluded";
      }
      break;
    }
    default:
      break;
  }
  return { outputs, result };
}

/** "FINAL RESOLUTION" style lines from relion logs. */
function parseFinalResolution(logFile: string): string | null {
  try {
    const tail = readTail(logFile, 8192);
    const m = tail.match(/final\s+resolution[^0-9\-]*([0-9]+\.?[0-9]*)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function parseRefineResult(workdir: string): string | null {
  const res = parseFinalResolution(path.join(workdir, "run.out"));
  return res ? `REAL: refined — FSC(0.143) = ${res} Å` : null;
}

/* ------------------------------------------------------------------ */
/* Log helpers                                                          */
/* ------------------------------------------------------------------ */

function readTail(file: string, bytes: number): string {
  const stat = statSync(file);
  const fd = openSync(file, "r");
  try {
    const len = Math.min(bytes, stat.size);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, Math.max(0, stat.size - len));
    return buf.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

export interface LogPayload {
  /** Collapsed (\r-safe) text of the requested window. */
  text: string;
  /** Total collapsed line count of the FULL combined log. */
  totalLines: number;
  /** True when `text` covers fewer lines than totalLines (tail window). */
  truncated: boolean;
}

/** Combined run.out + run.err for log views.
 * RELION rewrites progress bars with \r — collapse each line to its final
 * frame (what a terminal would show) so \r spam doesn't eat the line budget.
 *
 * The whole (small, ≤8MB) file is always read so `totalLines`/`truncated`
 * stay honest — the "tail" window only shrinks the RESPONSE payload, never
 * the line accounting (RELION run.out files are hundreds of KB at most and
 * page-cached, so the 1.5s live poll stays cheap).
 *
 * Tail mode (default): last 600 lines — cheap for live polling.
 * Full mode: the entire log. */
export function getLogTail(jobId: string, opts?: { full?: boolean }): LogPayload | null {
  const state = readRuns()[jobId];
  if (!state) return null;
  const full = opts?.full === true;
  const parts: string[] = [];
  let overCap = false;
  try {
    if (existsSync(state.logFile)) {
      const st = statSync(state.logFile);
      parts.push(readTail(state.logFile, 8 * 1024 * 1024));
      if (st.size > 8 * 1024 * 1024) overCap = true;
    }
  } catch {
    /* ignore */
  }
  try {
    if (existsSync(state.errFile)) {
      const err = readTail(state.errFile, 1 * 1024 * 1024);
      if (err.trim().length > 0) parts.push("\n----- stderr -----\n" + err);
    }
  } catch {
    /* ignore */
  }
  const text = parts.join("\n");
  const collapse = (s: string) =>
    s
      .split("\n")
      .map((line) => {
        const idx = line.lastIndexOf("\r");
        return (idx >= 0 ? line.slice(idx + 1) : line).replace(/\s+$/, "");
      });
  const allLines = collapse(text);
  const totalLines = allLines.length;
  if (full) {
    return {
      text: allLines.join("\n").slice(-8 * 1024 * 1024),
      totalLines,
      truncated: overCap,
    };
  }
  const tailLines = allLines.slice(-600);
  return {
    text: tailLines.join("\n"),
    totalLines,
    truncated: totalLines > tailLines.length,
  };
}

/* ------------------------------------------------------------------ */
/* Progress parsing                                                     */
/* ------------------------------------------------------------------ */

export function parseProgress(
  type: string,
  logFile: string,
  params: Record<string, number | string | boolean>
): number | null {
  try {
    if (!existsSync(logFile)) return null;
    const tail = readTail(logFile, 4096);
    const totalIter = Number(params.iterations ?? 25);
    if (Number.isFinite(totalIter) && totalIter > 0) {
      const itMatches = [...tail.matchAll(/(?:^|\s)it\s*\[?\s*(\d+)/gi)].map((m) => parseInt(m[1], 10));
      const iterMatches = [...tail.matchAll(/iteration\s*:?\s*(\d+)/gi)].map((m) => parseInt(m[1], 10));
      const all = [...itMatches, ...iterMatches];
      if (all.length > 0) {
        const current = Math.max(...all);
        return Math.min(99, Math.round((current / totalIter) * 100));
      }
    }
    // per-micrograph jobs: fraction of 6 EMPIAR micrographs seen in the log
    if (type === "ctffind" || type === "extract" || type === "motioncorr") {
      const micLines = tail.split("\n").filter((l) => /micrograph/i.test(l)).length;
      if (micLines > 0) return Math.min(99, Math.round((micLines / 6) * 100));
    }
    return null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                     */
/* ------------------------------------------------------------------ */

const NATIVE_TYPES = new Set(["import", "manualpick", "select"]);

/**
 * Run a job with the REAL engine.
 * - import / manualpick / select: engine-native (no RELION needed)
 * - everything else: detect RELION (fresh, no cache), resolve inputs,
 *   spawn the CLI with the faithful argv.
 */
/* ------------------------------------------------------------------ */
/* Shared spawn + state tracking (fresh runs AND --continue resumes)   */
/* ------------------------------------------------------------------ */

/**
 * Best-effort pre-flight for WSL-bridged runs: make sure every executable
 * argv element actually exists (test -x) INSIDE the distro BEFORE spawning
 * wsl.exe. A missing binary otherwise surfaces as a bare "exit 127" from
 * bash's exec — with this check the user gets an actionable message up front
 * (Re-detect / switch installs). Uses one wsl.exe call per candidate; probe
 * failures other than a definite "not executable" (wsl.exe absent, distro
 * starting, timeout) are ignored — the run itself stays the source of truth.
 */
function verifyBridgeTarget(argv: string[], bridge: WslBridge): string | null {
  // executable-looking POSIX paths only (binaries / mpirun / ctffind);
  // Windows drive args are translated by the wrapper and star paths never
  // look like these
  const BIN_RE = /^\/.*\/(relion_[a-z0-9_]+(?:_mpi)?|mpirun|mpiexec|ctffind[0-9]*)$/i;
  const candidates = [...new Set(argv.filter((a) => BIN_RE.test(a)))];
  for (const c of candidates) {
    try {
      const args: string[] = [];
      if (bridge.distro) args.push("-d", bridge.distro);
      args.push("-e", "test", "-x", c);
      execFileSync("wsl.exe", args, { timeout: 2500, stdio: "ignore", windowsHide: true });
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { status?: number; killed?: boolean };
      // status 1 = test answered "no" — anything else (ENOENT wsl.exe /
      // timeout / signal) means we could not ask, not that the binary is
      // missing; let the real run speak then
      if (err.status === 1) {
        return `RELION executable ${path.basename(c)} is missing or not executable inside the WSL distro${bridge.distro ? ` (${bridge.distro})` : ""} — checked ${c}. Press Re-detect in the top bar, or switch to another RELION install.`;
      }
    }
  }
  return null;
}

/**
 * Record the run, spawn argv, pipe run.out/run.err (append) and attach the
 * exit handler that finalizes state + DB. Shared by the fresh-run path and
 * the resume path so both get identical bookkeeping.
 *
 * When `bridge` is active (RELION inside WSL, app on the Windows host) the
 * Linux argv is relayed through a single wsl.exe invocation: paths are
 * translated, RELION env is set inside the distro, and wsl.exe's exit code
 * + stdio are exactly the Linux command's — so logs, progress parsing and
 * resume checkpoints behave identically to native runs.
 */
function spawnTrackedRun(
  job: EngineJobRef,
  argv: string[],
  workdir: string,
  binDir: string,
  resumedFrom?: number,
  bridge: WslBridge | null = null
): RunOutcome {
  const logFile = path.join(workdir, "run.out");
  const errFile = path.join(workdir, "run.err");
  const projectDir = projectDirFor(job);
  mkdirSync(projectDir, { recursive: true });

  // ---- decide the actual spawn target --------------------------------
  let file = argv[0];
  let args = argv.slice(1);
  let env = relionEnv(binDir);
  let displayCmd = argv.join(" ");
  if (bridge) {
    const wrapped = wrapWslCommand(argv, projectDir, bridge);
    file = wrapped.file;
    args = wrapped.args;
    env = { ...process.env };
    displayCmd = wrapped.display;
  }

  const record: RunRecord = {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    pid: null,
    cmd: displayCmd,
    workdir,
    logFile,
    errFile,
    startedAt: new Date().toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
  };
  const runs = readRuns();
  runs[job.id] = record;
  writeRuns(runs);

  // Pre-open the log files and pass the raw fds as stdio: the child keeps
  // its own dup'd descriptors, so a Next.js dev-server restart no longer
  // EPIPEs the tree to death mid-refinement (the pipes used to be held by
  // the parent — two documented incidents of hours-long refines dying).
  // detached: true puts the tree in its own session, so group signals aimed
  // at the dev server (Ctrl-C, reaper) can't take the refine down either.
  const outFd = openSync(logFile, "a");
  const errFd = openSync(errFile, "a");
  const child = spawn(file, args, {
    cwd: projectDir,
    env,
    detached: true,
    stdio: ["ignore", outFd, errFd],
  });
  // the parent's copies are redundant now (the child dups survive on their
  // own) — close them to avoid leaking 2 fds per run
  try {
    closeSync(outFd);
  } catch {
    /* already closed */
  }
  try {
    closeSync(errFd);
  } catch {
    /* already closed */
  }
  live.set(job.id, child);

  record.pid = child.pid ?? null;
  const runsNow = readRuns();
  runsNow[job.id] = { ...record };
  writeRuns(runsNow);

  attachExitHandler(job, child, record.startedAt);

  return {
    ok: true,
    pid: child.pid ?? undefined,
    ...(resumedFrom != null ? { resumedFrom } : {}),
  };
}

/**
 * Newest run_itXXX_optimiser.star checkpoint in a workdir (RELION's
 * --continue entry point), or null when none exists.
 */
function resumableOptimiser(workdir: string): { file: string; iteration: number } | null {
  try {
    const matches = readdirSync(workdir)
      .map((n) => {
        const m = n.match(/^run_it(\d+)_optimiser\.star$/i);
        return m ? { file: path.join(workdir, n), iteration: Number(m[1]) } : null;
      })
      .filter((x): x is { file: string; iteration: number } => x != null);
    matches.sort((a, b) => b.iteration - a.iteration);
    return matches[0] ?? null;
  } catch {
    return null;
  }
}

/** Refine-family job types that support RELION's --continue. */
const RESUMABLE_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel", "multibody"]);

export async function runRealJob(job: EngineJobRef, upstream: UpstreamRef[]): Promise<RunOutcome> {
  // ---- engine-native jobs -------------------------------------------
  if (job.type === "import") {
    const r = await runImportNative(job);
    return r.ok ? { ok: true, native: true, result: r.result } : { ok: false, error: r.error };
  }
  if (job.type === "manualpick") {
    const r = await runManualPickNative(job, upstream);
    return r.ok
      ? { ok: true, native: true, result: r.result }
      : { ok: false, error: r.error, ...(r.wait ? { waiting: r.wait } : {}) };
  }
  if (job.type === "select") {
    const r = await runSelectNative(job, upstream);
    return r.ok
      ? { ok: true, native: true, result: r.result }
      : { ok: false, error: r.error, ...(r.wait ? { waiting: r.wait } : {}) };
  }

  // ---- RELION required ------------------------------------------------
  // Non-force: served instantly from the warm cache / SAVED detection
  // snapshot (stale-while-revalidate re-probes in the background). Run never
  // waits a full host+WSL sweep — the Re-detect button is the manual gate.
  const status = await detectRelion();
  if (!status.found || !status.path) {
    return {
      ok: false,
      error:
        "RELION not detected — install it (or expose it in WSL) and press Re-detect in the top bar; multiple installs are switchable there",
    };
  }
  // Native: spawn the binaries directly. WSL: relay every job through the
  // built-in bridge (wsl.exe + path translation) — jobs run INSIDE the
  // distro with the same logs/progress/resume machinery.
  const bridge = bridgeFromStatus(status);
  const binDir = status.path;

  // ---- resume an interrupted refine-family run ---------------------------
  // If a previous run of THIS job crashed / was stopped / was interrupted
  // (record never finished OR exited non-zero) and the workdir holds RELION
  // iteration checkpoints, --continue picks up from the newest one instead
  // of starting over — hours saved on long auto-refinements. A COMPLETED run
  // (exit 0) intentionally restarts fresh. Upstream re-validation is skipped:
  // the checkpoint STAR files already reference the validated inputs.
  const workdir = workdirFor(job);
  const prevRun = readRuns()[job.id];
  const interrupted =
    prevRun != null && (prevRun.done === false || prevRun.exitCode !== 0);
  if (
    RESUMABLE_TYPES.has(job.type) &&
    prevRun &&
    interrupted &&
    prevRun.jobId === job.id
  ) {
    const checkpoint = resumableOptimiser(workdir);
    const mpirun = resolveMpirun(binDir, bridge);
    const mpiBin = bridge
      ? `${binDir.replace(/\/$/, "")}/relion_refine_mpi`
      : path.join(binDir, "relion_refine_mpi");
    if (checkpoint && mpirun && (bridge ? bridge.hasMpiBinary : existsSync(mpiBin))) {
      // gold-standard halves need leader + 2 half-mappers
      const nranks = job.type === "refine3d" ? 3 : 2;
      // --o MUST point at the SAME output root the checkpoint was written
      // to (RELION in continue mode still checks the output dir from --o;
      // omitting it defaults to ./run relative to cwd → "output directory
      // does not exist" abort on the follower ranks).
      const resumeArgv = [
        mpirun,
        "-n",
        String(nranks),
        mpiBin,
        "--continue",
        checkpoint.file,
        "--o",
        path.join(workdir, "run"),
      ];
      const preFlight = bridge ? verifyBridgeTarget(resumeArgv, bridge) : null;
      if (preFlight) return { ok: false, error: preFlight };
      return spawnTrackedRun(job, resumeArgv, workdir, binDir, checkpoint.iteration, bridge);
    }
  }

  // ---- resolve inputs --------------------------------------------------
  const resolved = resolveInputs(job.type, upstream);
  if (resolved.missing) {
    // upstream failed / still running / never ran → the dispatcher marks the
    // job PENDING (amber) instead of failed — no cascade of red jobs
    return {
      ok: false,
      error: resolved.missing,
      ...(resolved.wait ? { waiting: resolved.wait } : {}),
    };
  }
  const inputs = resolved.inputs;

  // ---- workdir ----------------------------------------------------------
  mkdirSync(workdir, { recursive: true });

  // ---- build argv ---------------------------------------------------------
  const ctx: BuildCtx = { binDir, workdir, inputs, job, upstream, bridge };
  const built = await buildArgv(ctx);
  if ("error" in built) {
    return { ok: false, error: built.error };
  }
  let argv = built;

  // ---- MPI prefix for parallel types --------------------------------------
  const mpirun = resolveMpirun(binDir, bridge);
  if (MPI_PARALLEL_TYPES.has(job.type) && mpirun) {
    // RELION ships serial AND _mpi builds — mpirun must launch the MPI build
    // (a serial binary under mpirun runs N independent copies: no parallelism,
    // and --split_random_halves hard-errors without MPI).
    const target = argv[0] as string;
    const canMpi = bridge
      ? bridge.hasMpiBinary
      : target.startsWith("/") && existsSync(target + "_mpi");
    if (target.startsWith("/") && canMpi) argv[0] = target + "_mpi";
    // --split_random_halves (gold-standard FSC) needs leader + 2 half-mappers
    const nranks = job.type === "refine3d" ? 3 : 2;
    argv = [mpirun, "-n", String(nranks), ...argv];
  }

  // ---- target binary sanity (partial installs fail honestly) --------------
  // WSL-side paths cannot be existsSync'd from the host — for those the
  // wsl.exe pre-flight (verifyBridgeTarget) below is the equivalent; when
  // even that cannot ask the distro, the run itself reports honestly.
  // MPI-prefixed argv: [mpirun, -n, N, relionBinary, ...] → index 3.
  const target = argv[0] !== "mpirun" && argv[0] !== mpirun ? argv[0] : argv[3];
  if (
    !bridge &&
    target &&
    target.startsWith("/") &&
    !existsSync(target)
  ) {
    return {
      ok: false,
      error: `RELION binary ${path.basename(target)} not present in ${binDir} (incomplete RELION install)`,
    };
  }

  if (bridge) {
    const preFlight = verifyBridgeTarget(argv, bridge);
    if (preFlight) return { ok: false, error: preFlight };
  }

  return spawnTrackedRun(job, argv, workdir, binDir, undefined, bridge);
}

/* ------------------------------------------------------------------ */
/* Exit handling (state file + Prisma update)                           */
/* ------------------------------------------------------------------ */

/**
 * Human meaning of a process exit code. A bare "exit 127" says nothing
 * actionable; these mappings make the common RELION / WSL-bridge failures
 * self-explanatory (127 in particular = the executable was missing from the
 * selected install — the classic incomplete-RELION / stale-distro-path case).
 */
export function describeExitCode(code: number): string {
  if (code === 127)
    return "command not found — the executable (or a shared library it needs) is missing from the selected RELION install (Re-detect or switch installs in the top bar)";
  if (code === 126) return "command found but not executable (check permissions)";
  if (code === 111) return "WSL bridge could not enter the job directory inside the distro";
  if (code === 139) return "segmentation fault (SIGSEGV)";
  if (code === 135) return "bus error (SIGBUS)";
  if (code === 137) return "killed by SIGKILL (out of memory or stop)";
  if (code === 130) return "interrupted (Ctrl-C)";
  if (code === 143) return "terminated (SIGTERM)";
  if (code === 255) return "uncaught error / abort";
  if (code > 128) return `killed by signal ${code - 128}`;
  if (code === 1) return "RELION reported an error";
  return "";
}

/**
 * Build the failure result line: exit code meaning + the actual stderr tail
 * (run.out as fallback — some tools log their errors to stdout) + the command
 * + where the full logs live. Everything the user needs to diagnose without
 * opening the log tab.
 */
function failureResult(state: RunRecord, exitCode: number): string {
  const meaning = describeExitCode(exitCode);
  const errTail = tailText(state.errFile, 280);
  const outTail = errTail ? "" : tailText(state.logFile, 280);
  const parts: string[] = [`exit ${exitCode}${meaning ? ` (${meaning})` : ""}`];
  const detail = errTail || outTail;
  if (detail) parts.push(detail);
  // 127 with EMPTY logs: wsl.exe sometimes exits without relaying the
  // distro's stderr — name the exact exec target (parsed from the wrapped
  // command) so the user can still pin it down: missing → stale saved
  // install, present → missing shared library (ldd shows which).
  if (exitCode === 127 && !detail) {
    const m = state.cmd.match(/exec '([^']+)'/);
    if (m) {
      parts.push(
        `exec target was ${m[1]} — verify inside the distro (missing → the saved install is stale, press Re-detect in the top bar; present → run ldd ${m[1]} there to find the missing shared library)`
      );
    }
  }
  const cmd = state.cmd.length > 160 ? state.cmd.slice(0, 160) + "…" : state.cmd;
  parts.push(`command: ${cmd}`);
  parts.push(`logs: ${state.errFile} + ${state.logFile}`);
  return parts.join(" — ").slice(0, 900);
}

function attachExitHandler(
  job: EngineJobRef,
  child: ChildProcess,
  startedAt: string
): void {
  child.on("exit", (code) => {
    live.delete(job.id);
    const exitCode = code ?? -1;

    // wsl.exe relays the distro's stderr through its own pipe — the exit
    // event can fire BEFORE the final bytes land in run.err (observed as
    // "exit 127 — " with an empty tail on Windows). Re-read with a short
    // backoff before finalizing; a non-empty stderr short-circuits.
    const delays = exitCode === 0 ? [0] : [0, 250, 650, 1100];
    let settled = false;

    const finalize = (): void => {
      if (settled) return;
      settled = true;
      const runs = readRuns();
      const state = runs[job.id];
      // A newer run may have replaced this record — only handle our own.
      if (!state || state.startedAt !== startedAt) return;

      let outputs: Record<string, string> = {};
      let result: string | null = null;

      if (exitCode === 0) {
        const collected = collectOutputs(job.type, state.workdir);
        outputs = collected.outputs;
        result = collected.result;
      } else {
        result = failureResult(state, exitCode);
      }

      runs[job.id] = { ...state, done: true, exitCode, outputs, result };
      writeRuns(runs);

      const elapsed = Date.now() - new Date(state.startedAt).getTime();
      void db.job
        .update({
          where: { id: job.id },
          data:
            exitCode === 0
              ? { status: "completed", progress: 100, result, duration: Math.max(1000, elapsed) }
              : { status: "failed", progress: 0, result },
        })
        .then(() => {
          if (exitCode !== 0) return;
          // RELION-pipeliner semantics: the moment this job's outputs land,
          // PENDING downstream jobs become runnable — auto-start them (no
          // manual re-click). Dynamic import keeps the module graph acyclic
          // at load time (dispatch statically imports this module).
          return import("./dispatch")
            .then((m) => m.autoStartPendingDownstream(job.id))
            .catch((e) => console.error("engine: downstream auto-start failed:", e));
        })
        .catch((err) => console.error("engine: DB update on exit failed:", err));
    };

    delays.forEach((delay, i) => {
      setTimeout(() => {
        if (settled) return;
        if (i < delays.length - 1) {
          // intermediate attempt — finalize early once stderr has content
          const state = readRuns()[job.id];
          if (state && state.startedAt === startedAt && tailText(state.errFile, 80)) {
            finalize();
          }
          return;
        }
        finalize();
      }, delay);
    });
  });

  child.on("error", (err) => {
    live.delete(job.id);
    const runs = readRuns();
    const state = runs[job.id];
    if (!state || state.startedAt !== startedAt) return;
    runs[job.id] = {
      ...state,
      done: true,
      exitCode: -1,
      result: `spawn failed — ${err.message}`,
    };
    writeRuns(runs);
    void db.job
      .update({
        where: { id: job.id },
        data: { status: "failed", progress: 0, result: `spawn failed — ${err.message}` },
      })
      .catch((e) => console.error("engine: DB update on spawn error failed:", e));
  });
}

function tailText(file: string, maxChars: number): string {
  try {
    if (!existsSync(file)) return "";
    const text = readTail(file, maxChars * 2);
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.slice(-maxChars);
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Reconciliation (GET /api/jobs)                                       */
/* ------------------------------------------------------------------ */

export function parseJobParams(raw: string): Record<string, number | string | boolean> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number | string | boolean>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

/**
 * Reconcile 'running' jobs against the REAL engine's records (the only
 * engine — the time-based simulation was retired):
 *  - pid alive → derive progress from the log tail
 *  - pid dead + not done → outputs landed? (orphaned-but-finished run —
 *    the exit handler died with a server restart/HMR reload while the
 *    detached child kept running) → completed + downstream auto-start;
 *    otherwise interrupted (server restart etc.) → failed
 *  - done + exit 0 (DB stale) → completed with the recorded result
 *  - no run record at all → spawn race window (< 2 min, keep running) or
 *    stale legacy state → honest failure
 * Read-mostly; DB writes only in the interrupted/stale cases (idempotent).
 */
/**
 * Job types whose RELION output is written ONCE at the very end of the run
 * (no partial mid-run artifacts): output presence alone proves the run
 * finished, so an orphaned record can be finalized as completed. Refine-
 * family jobs are excluded on purpose — they emit per-iteration artifacts
 * mid-run, and the safe recovery for them is "interrupted" + --continue.
 */
const ORPHAN_COMPLETABLE = new Set(["ctffind", "motioncorr", "extract", "autopick"]);
/** Primary output key per completable type (collectOutputs gate). */
const ORPHAN_PRIMARY_KEY: Record<string, string> = {
  ctffind: "micrographs_ctf_star",
  motioncorr: "micrographs_star",
  extract: "particles_star",
  autopick: "coords_star",
};

export async function reconcileRealJobs(jobs: Job[]): Promise<Job[]> {
  const runs = readRuns();
  const out: Job[] = [];

  for (const job of jobs) {
    if (job.status !== "running") {
      out.push(job);
      continue;
    }
    const state = runs[job.id];
    if (!state) {
      // No engine record: either the spawn race window (startJob flips the
      // DB to running seconds before the record lands) or a stale legacy
      // running state (retired simulation engine / crashed before spawn).
      // Recent → keep running; older → honest failure.
      const ageMs = job.startedAt
        ? Date.now() - new Date(job.startedAt).getTime()
        : Infinity;
      if (ageMs < 120_000) {
        out.push(job);
      } else {
        const patch = {
          status: "failed" as const,
          progress: 0,
          result: "stale running state (no engine record) — re-run",
        };
        const updated = await db.job
          .update({ where: { id: job.id }, data: patch })
          .catch(() => null);
        out.push(updated ?? { ...job, ...patch });
      }
      continue;
    }
    // Guard against the re-run race: the DB flips to "running" (new
    // startedAt) before spawnTrackedRun overwrites the state record, so a
    // poll in that window would otherwise reconcile the PREVIOUS run's
    // outcome into the fresh run (false completed/failed + bogus toast).
    // Records that predate the current DB run are ignored.
    const recordIsCurrent =
      job.startedAt == null ||
      new Date(state.startedAt).getTime() >= new Date(job.startedAt).getTime() - 2000;
    // pidAlive is cross-platform (signal-0 probe on Windows) — the previous
    // raw existsSync("/proc/<pid>") is Linux-only and insta-failed EVERY
    // running WSL-bridged job on Windows hosts on the first poll
    const alive = state.pid != null && pidAlive(state.pid);

    if (alive) {
      const progress = parseProgress(job.type, state.logFile, parseJobParams(job.params));
      out.push(progress != null ? { ...job, progress } : job);
      continue;
    }

    if (!recordIsCurrent) {
      // stale record from an earlier run — the fresh run's record is being
      // written; keep reporting "running" until it lands
      out.push(job);
      continue;
    }

    if (!state.done) {
      // Orphaned-but-finished: the exit handler died with a server restart /
      // HMR reload while the DETACHED child kept running and finished later.
      // For atomic-output types the landed outputs prove completion — finalize
      // the record, flip the DB to completed and auto-start downstream, exactly
      // like the exit handler would have (this also heals the Windows
      // false-"interrupted" state written by the old /proc-blind reconcile).
      if (ORPHAN_COMPLETABLE.has(job.type)) {
        const collected = collectOutputs(job.type, state.workdir);
        const key = ORPHAN_PRIMARY_KEY[job.type];
        if (collected.outputs[key]) {
          const runsNow = readRuns();
          const rec = runsNow[job.id];
          if (rec && rec.startedAt === state.startedAt) {
            runsNow[job.id] = {
              ...rec,
              done: true,
              exitCode: 0,
              outputs: collected.outputs,
              result: collected.result,
            };
            writeRuns(runsNow);
          }
          const patch = {
            status: "completed" as const,
            progress: 100,
            result: collected.result,
          };
          const updated = await db.job
            .update({ where: { id: job.id }, data: patch })
            .catch(() => null);
          out.push(updated ?? { ...job, ...patch });
          void import("./dispatch")
            .then((m) => m.autoStartPendingDownstream(job.id))
            .catch((e) => console.error("engine: orphan-run downstream auto-start failed:", e));
          continue;
        }
      }
      const updated = await db.job
        .update({
          where: { id: job.id },
          data: { status: "failed", progress: 0, result: "interrupted (exit unknown) — re-run" },
        })
        .catch(() => null);
      out.push(updated ?? { ...job, status: "failed", progress: 0, result: "interrupted (exit unknown) — re-run" });
      continue;
    }

    if (state.exitCode === 0) {
      // job.status is 'running' here (narrowed above); the DB update is
      // idempotent — the exit handler may already have written this.
      const updated = await db.job
        .update({
          where: { id: job.id },
          data: { status: "completed", progress: 100, result: state.result ?? "completed" },
        })
        .catch(() => null);
      out.push(updated ?? { ...job, status: "completed", progress: 100, result: state.result ?? "completed" });
      continue;
    }

    if (state.exitCode !== null) {
      const updated = await db.job
        .update({
          where: { id: job.id },
          data: { status: "failed", progress: 0, result: state.result ?? `exit ${state.exitCode}` },
        })
        .catch(() => null);
      out.push(updated ?? { ...job, status: "failed", progress: 0, result: state.result ?? `exit ${state.exitCode}` });
      continue;
    }

    out.push(job);
  }
  return out;
}

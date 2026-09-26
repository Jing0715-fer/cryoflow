/**
 * CryoFlow — REAL RELION 5 execution engine (SERVER ONLY).
 *
 * Spawns the actual RELION CLI programs (command shapes extracted from
 * /home/z/relion-build/pipeline_jobs.cpp — RELION 5.0.1 getCommands* builders).
 * Engine state (pid / workdir / log / outputs) lives in data/engine-state.json
 * so it survives Next.js dev-server hot reloads (the Prisma schema is frozen).
 *
 * Three job classes:
 *  - engine-native (import / mapimport / manualpick / select): no RELION binary needed,
 *    writes RELION-5 style STAR files directly.
 *  - real CLI jobs: spawn relion_* binaries with faithful argv.
 *  - external jobs: honest failure when the external binary is absent.
 */

import type { ChildProcess } from "child_process";
import { execFile, execFileSync, spawn } from "child_process";
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  lstatSync,
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
import { DATA_DIR, RELION_DIR } from "@/lib/paths";
import { getProjectMeta } from "@/lib/projects";
import { getConnection, loadConnections } from "@/lib/remote/connections";
import { remoteHeaderSniffer } from "@/lib/remote/sniff";
import { listRemoteDir, REMOTE_IMPORT_MAX_ENTRIES, statRemoteFiles } from "@/lib/remote/remote-ls";
import { exec as sshExec, remoteDownload, remoteMkdir, remoteUpload } from "@/lib/remote/ssh";
import { wipeLocalRunProducts } from "@/lib/relion/run-wipe";
import { describeExtractCollisions, extractStackKey, scanExtractCollisions } from "@/lib/relion/extract-collide";
import { npyRows, parseNpyHeader } from "@/lib/relion/cs-npy";
import { csRowsToStar, judgeStackSamplings, type Cs2StarResult, type StackSamplingProbe } from "@/lib/relion/cs2star";
import type { RemoteConnection, RemoteRunState } from "@/lib/remote/types";
import { parseMrcHeaderBytes, readMrcHeader, type MrcHeader } from "@/lib/mrc";
import { sniffImageFile, spreadSample, type HeaderSniffer, type SniffVerdict } from "./mrc-sniff";
import { RELION_ALIASES, RELION_OPTIONS } from "./option-tables";
import { extractInputGate, micrographRowsFromContent, parseStarBlocks, type StarBlock } from "./extract-gate";
import {
  PARTICLES_CONSUMER_TYPES,
  particleRefsFromContent,
  particlesRefGate,
  refCandidates,
} from "./particle-ref-gate";
export { extractInputGate, micrographRowsFromContent } from "./extract-gate";
import { detectRelion, savedWslDistro } from "./system";
import { MIC_RE, expandPattern, hasWildcard, userPathToHost } from "./glob";
import { writePathrefMarker } from "./pathref";
import {
  binJoin,
  bridgeFromStatus,
  hostToWsl,
  isWindowsPath,
  wslStopArgs,
  wslToHost,
  wrapWslCommand,
  type WslBridge,
} from "./wsl-bridge";
import {
  applySymmetryToEuler,
  deduplicateRotations,
  describeRotations,
  eulerToDirection,
  generatePointGroup,
  type Mat3,
  type PointGroupSpec,
} from "@/lib/symmetry";
import {
  runRebalanceCore,
  type ExclusionCriterion,
  type RebalanceParams,
  type RebalanceReport,
  type RebParticle,
} from "./rebalance-core";

/* ------------------------------------------------------------------ */
/* Paths & constants                                                    */
/* ------------------------------------------------------------------ */

const STATE_FILE = path.join(DATA_DIR, "engine-state.json");
// Task 184: RELION_DIR (paths.ts) is the single name for the workdir root.
// This private join was the seed every other cwd-coupled copy imitated.
/** Sandbox-only demo source (EMPIAR seed); user machines use the import
 * job's micrographsPath param (folder / wildcard pattern / file list) instead. */
const EMPIAR_DIR = "/home/z/empiar-10017/micrographs";
const MPICH_BIN = "/home/z/relion-build/deps/mpich/bin";
const MPICH_LIB = "/home/z/relion-build/deps/mpich/lib";
const FFTW_LIB = "/home/z/relion-build/deps/fftw/lib";
const CTFFIND_EXE = "/home/z/relion-build/deps/ctffind/bin/ctffind";

const MPI_PARALLEL_TYPES = new Set(["class3d", "refine3d"]);

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
  /** Present when the run executes on a REMOTE cluster over SSH — then
   * pid/logFile/workdir have REMOTE meaning for liveness and the poll sweep
   * is owned by lib/remote/remote-run.ts (reconcileRemoteJobs), not by the
   * local pidAlive branch below. See docs/remote-relion.md. */
  remote?: RemoteRunState;
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
  // mtime-keyed cache: EVERY polled route (jobs GET, log, outputs, particles,
  // …) used to re-read + re-JSON.parse the whole state file on every call —
  // the file grows with every job ever run and the parse ran on the hot 2–5 s
  // poll path. writeRuns bumps the mtime so writers are always consistent.
  try {
    const st = statSync(STATE_FILE);
    if (runsCache && runsCache.mtime === st.mtimeMs && runsCache.size === st.size) {
      return runsCache.value;
    }
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const value = parsed as Record<string, RunRecord>;
      healFossilSpellings(value);
      runsCache = { mtime: st.mtimeMs, size: st.size, value };
      return value;
    }
  } catch {
    // ENOENT / corrupt → fresh state
    runsCache = null;
  }
  return {};
}

/**
 * Task 184: records written by pre-183/184 servers spell workdir, logFile,
 * errFile and every outputs entry through the standalone tree
 * ("<cwd>/.next/standalone/data/…") — a fossil name that dies in every
 * `next build` window (the boot-race's face at record granularity) and
 * resolves only while the start-prod.sh symlink ritual holds. readRuns is
 * the SINGLE read boundary: heal each fossil to the DATA_DIR contract name
 * once per parse. Disk keeps its history; every consumer — resolveInputs'
 * existsSync, the classes boundary, the outputs walker — sees one name.
 * When CRYOFLOW_DATA_DIR is unset the rewrite is a no-op spelling change
 * (the marker IS the current cwd/data), so user machines are unaffected.
 */
const FOSSIL_DATA_RE = /^.*\/\.next\/standalone\/data\//;
function healFossilSpellings(value: Record<string, RunRecord>): void {
  for (const rec of Object.values(value)) {
    if (!rec || typeof rec !== "object") continue;
    for (const key of ["workdir", "logFile", "errFile"] as const) {
      const v = rec[key];
      if (typeof v === "string" && v.includes("/.next/standalone/data/")) {
        rec[key] = v.replace(FOSSIL_DATA_RE, DATA_DIR + "/");
      }
    }
    if (rec.outputs && typeof rec.outputs === "object") {
      for (const k of Object.keys(rec.outputs)) {
        const v = rec.outputs[k];
        if (typeof v === "string" && v.includes("/.next/standalone/data/")) {
          rec.outputs[k] = v.replace(FOSSIL_DATA_RE, DATA_DIR + "/");
        }
      }
    }
  }
}

let runsCache: { mtime: number; size: number; value: Record<string, RunRecord> } | null = null;

export function writeRuns(map: Record<string, RunRecord>): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(map, null, 2));
  // invalidate immediately — the writer knows the truth; the next read
  // re-stats and re-populates (also covers EXTERNAL writers, which change
  // the mtime/size and bust the cache naturally)
  runsCache = null;
}

/* --- Incremental run-record writes (the ONLY sanctioned write path) ---- *
 *
 * writeRuns is a BLIND full-file overwrite: whatever the caller passes
 * becomes the whole truth. That semantics caused the "engine-state time
 * travel" incident (Task 62): a caller holding a stale snapshot (external
 * seed script wrote new entries in between, or a second server process was
 * still alive beside the watchdog's replacement) wrote its snapshot back
 * and silently DELETED every entry it didn't know about — completed jobs'
 * records vanished while the DB still said completed, so /fsc and every
 * per-job route that resolves the workdir through the state file came up
 * empty ("FSC section not rendered").
 *
 * The fix is CONTRACT-level, not another cache tweak: from here on the
 * engine writes ONE RECORD AT A TIME through upsertRun / updateRun /
 * removeRun. Each call re-reads the on-disk truth (readRuns' mtime/size
 * check naturally picks up external writers) and touches exactly one key,
 * so entries owned by other writers can never be lost again. writeRuns
 * stays exported for the rare FULL-REBUILD cases (nothing in-tree today)
 * and as the shared primitive below — engine-internal callers MUST NOT
 * use it directly.
 *
 * All three helpers keep the read→mutate→write span SYNCHRONOUS (no await
 * between them): Node is single-threaded, so no other request path can
 * interleave. An external PROCESS can still write between our read and
 * write — that window is microseconds and the worst case degrades to the
 * pre-fix behavior for that one write; no file lock on a 4GB QA box.
 */

/** Synchronous read→mutate→write primitive. fn mutates `runs` in place;
 * if it THROWS, the cache (which `runs` aliases) may be half-mutated —
 * drop it so the next read re-parses the on-disk truth instead of
 * serving poisoned state. Returns fn's result. */
function mutateRuns<T>(fn: (runs: Record<string, RunRecord>) => T): T {
  const runs = readRuns();
  try {
    const result = fn(runs);
    writeRuns(runs);
    return result;
  } catch (err) {
    runsCache = null; // half-mutated alias — never serve it again
    throw err;
  }
}

/** Write (or replace) a single run record. Base = the CURRENT on-disk
 * state, not the caller's snapshot — this is the anti-time-travel
 * guarantee. */
export function upsertRun(jobId: string, record: RunRecord): void {
  mutateRuns((runs) => {
    runs[jobId] = record;
  });
}

/** Conditionally update a single record. fn receives the CURRENT record
 * and returns the replacement — or null to mean "guard failed / nothing
 * to change" (no write happens). Returns the record now in state (null
 * when the job had no record or the guard declined). */
export function updateRun(
  jobId: string,
  fn: (current: RunRecord) => RunRecord | null
): RunRecord | null {
  return mutateRuns((runs) => {
    const current = runs[jobId];
    if (!current) return null;
    const next = fn(current);
    if (!next) return current;
    runs[jobId] = next;
    return next;
  });
}

/** Remove a single record (no-op when absent). */
export function removeRun(jobId: string): void {
  mutateRuns((runs) => {
    delete runs[jobId];
  });
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
  removeRun(jobId);
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
  // REMOTE records: the pid belongs to the CLUSTER, never to this machine —
  // a local pidAlive check would query an unrelated local process. The
  // remote poll sweep (reconcileRemoteJobs) flips `done` within a few
  // seconds of the cluster-side exit; between polls the honest answer is
  // "still active". startRemoteJob does a precise async check before spawn.
  if (state && state.remote && state.done === false) {
    return `remote run still active on ${state.remote.host}${state.remote.pid != null ? ` (cluster pid ${state.remote.pid})` : " (staging inputs)"}`;
  }
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
    execFile("wsl.exe", wslStopArgs(state.workdir, distro), { timeout: 5000, windowsHide: true }, () => {
      /* best effort — pkill exits non-zero when nothing matched */
    });
    if (!child) {
      // incremental write — the record-swap must not clobber entries other
      // writers (seed scripts, sibling processes) added while we killed the tree
      updateRun(jobId, (rec) =>
        rec.done === false
          ? { ...rec, done: true, exitCode: -1, result: "stopped by user (WSL bridge)" }
          : null
      );
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
    updateRun(jobId, (rec) =>
      rec.done === false ? { ...rec, done: true, exitCode: -1, result: "stopped by user" } : null
    );
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
  // OpenMPI 4+ refuses mpirun as root (app itself running as root on a Linux
  // host with an OpenMPI toolchain). Upstream-sanctioned opt-in pair; MPICH
  // (sandbox) ignores them — harmless everywhere, inert for non-root users.
  env.OMPI_ALLOW_RUN_AS_ROOT = "1";
  env.OMPI_ALLOW_RUN_AS_ROOT_CONFIRM = "1";
  env.LD_LIBRARY_PATH =
    libParts.length > 0
      ? libParts.join(":") + ":" + (process.env.LD_LIBRARY_PATH ?? "")
      : (process.env.LD_LIBRARY_PATH ?? "");
  return env;
}

export function workdirFor(job: EngineJobRef): string {
  return path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);
}

/**
 * RELION "project root" directory — all real CLI jobs run with this as CWD
 * (mirrors how the RELION GUI/pipeliner launches jobs from the pipeline root),
 * so STAR files can use project-relative micrograph paths. ctffind_runner
 * symlinks micrographs as (cwd + star-path) → output-dir + path, which only
 * resolves when CWD is this directory.
 */
function projectDirFor(job: EngineJobRef): string {
  return path.join(RELION_DIR, job.projectId);
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
  if (v === undefined || v === null) return fallback;
  const s = String(v);
  // t375 — an EMPTY stored value also falls back: the t374 merge sanitizes
  // RELION's C++ placeholder defaults (std::string("-1") …) to "", and an
  // empty VALUE token after a flag poisons the whole argv line.
  return s.trim() === "" ? fallback : s;
}

/** t375 — POSIX single-quote a token for a `bash -c` composite command
 * (RELION itself composes multi-command jobs — multibody's refine +
 * flex_analyse, modelangelo's build + hmm_search, localres' ResMap
 * symlinks — as one shell line; the composite mirrors that shape). */
function shellQuote(s: string): string {
  return `'${String(s).replace(/'/g, `'\''`)}'`;
}

/** t375 — join an argv into a `bash -c` one-liner (RELION's own
 * prepareFinalCommand concatenation shape). */
function shellJoin(argv: string[]): string {
  return argv.map(shellQuote).join(" ");
}

/** t375 — RELION's ctffit radio char (JobOption::getCtfFitString,
 * pipeline_jobs.cpp:243-250): No→f, Per-micrograph→m, Per-particle→p. */
function ctffitChar(job: EngineJobRef, key: string): string {
  const v = str(job, key, "No");
  if (v === "Per-micrograph") return "m";
  if (v === "Per-particle") return "p";
  return "f";
}

function flag(job: EngineJobRef, key: string): boolean {
  return String(job.params[key] ?? "false") === "true";
}

/**
 * t375 — first FINITE number among the given keys (curated key first). Lets
 * the curated builders read EITHER side of an alias pair so old DB rows
 * (curated key) and t374-window rows (RELION twin seeded alongside) both work.
 */
function numAny(job: EngineJobRef, fallback: number, ...keys: string[]): number {
  for (const k of keys) {
    const v = job.params[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v !== "" && Number.isFinite(parseFloat(v))) return parseFloat(v);
  }
  return fallback;
}

/**
 * t375 — alias-aware numeric read for the double-seeded world: a row can
 * carry BOTH the curated key and its RELION twin at their own defaults
 * (every job created in the t374 window, before the alias map dropped the
 * twin from the specs). The knob the user actually MOVED wins: curated away
 * from its own default > RELION twin away from the RELION default > curated
 * default. A plain first-found read would freeze the twin at its seed.
 */
function aliasNum(
  job: EngineJobRef,
  curatedKey: string,
  curatedDefault: number,
  relionKey: string,
  relionDefault: number
): number {
  const cv = num(job, curatedKey, curatedDefault);
  if (Math.abs(cv - curatedDefault) > 1e-9) return cv;
  const rv = job.params[relionKey];
  const rn = typeof rv === "number" ? rv : typeof rv === "string" && rv !== "" ? parseFloat(rv) : NaN;
  if (Number.isFinite(rn) && Math.abs(rn - relionDefault) > 1e-9) return rn;
  return curatedDefault;
}

/**
 * t375 — bool that rides only when the key is PRESENT and true. RELION-
 * default-true options (do_grad, do_invert, do_own_motioncor, do_invert_refs …)
 * must not flip the argv of pre-t374 rows that never carried the key; rows
 * created after the t374 merge are seeded with the RELION default by
 * defaultParams(), so present-and-true is exactly "new row or explicit intent"
 * — the integrator's RELION-faithful-for-new-jobs decision.
 */
function flagPresent(job: EngineJobRef, key: string): boolean {
  return job.params[key] !== undefined && flag(job, key);
}

/** t375 — flagPresent over either side of an aliased bool pair. */
function flagAnyTrue(job: EngineJobRef, ...keys: string[]): boolean {
  return keys.some((k) => job.params[k] !== undefined && flag(job, k));
}

/** t375 — RELION's range_rot/tilt/psi clamp (pipeline_jobs.cpp:3323-3324). */
function clamp090(v: number): number {
  return Math.max(0, Math.min(90, v));
}

/** t375 — RELION's gain-rotation radio → its list index
 * (pipeline_jobs.cpp:1614-1622; job_gain_rotation_options,
 * pipeline_jobs.h:119-124). Accepts the radio text or a raw 0-3. */
function gainRotIndex(job: EngineJobRef): number {
  const v = str(job, "gain_rot", "No rotation (0)");
  const idx = ["No rotation (0)", "90 degrees (1)", "180 degrees (2)", "270 degrees (3)"].indexOf(v);
  if (idx >= 0) return idx;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
}

/** t375 — RELION's gain-flip radio → its list index (pipeline_jobs.h:126-130). */
function gainFlipIndex(job: EngineJobRef): number {
  const v = str(job, "gain_flip", "No flipping (0)");
  const idx = ["No flipping (0)", "Flip upside down (1)", "Flip left to right (2)"].indexOf(v);
  if (idx >= 0) return idx;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 0;
}

/** Micrograph pixel size from the pipeline's Import job (Å). */
function micAngpix(upstream: UpstreamRef[]): number | null {
  const importUp = upstream.find((u) => u.type === "import");
  return importUp?.params && typeof importUp.params.pixelSize === "number"
    ? importUp.params.pixelSize
    : null;
}

/**
 * t350 — the refine family's pooled-particle auto value (relion_refine
 * --pool). The t341 flag this replaces (--batch_size) NEVER EXISTED: a
 * full audit of 3dem/relion tags 3.1 / 4.0 / 5.0-beta / 5.0 / 5.0.1 / 5.1
 * (ml_optimiser.cpp, every getOption/checkOption string) finds no such
 * option in ANY release — RELION's parser (args.cpp checkForUnknown-
 * Arguments) hard-rejects unknown --flags, so any dispatch that carried
 * it died at argv parse before the first banner. The REAL lever is
 * --pool ("Number of images to pool for each thread task", CLI default
 * 1), and RELION 5's own GUI ships an explicit --pool 3 for every
 * refine-family job (pipeline_jobs.cpp, range 1–16: batches of
 * pool × threads images are read together — one open/close per batch,
 * fewer GPU kernel launches, more VRAM per batch). We mirror exactly the
 * authors' own default — no invented box curve: the OOM that motivated
 * t341 was the six-ranks-on-device-0 pile-up (fixed by t345/t349), not a
 * pool size.
 *
 * Exported for the tests: one constant, every surface.
 */
export function refineAutoPool(): number {
  // RELION 5's GUI default — verbatim (pipeline_jobs.cpp nr_pool)
  return 3;
}

/**
 * t350 — the refine family's optional node-local scratch (--scratch_dir:
 * "particle stacks will be copied to this local scratch disk prior to
 * refinement", RELION 5.0 ml_optimiser.cpp). On NFS-backed clusters
 * this moves the per-iteration particle re-reads onto node-local disk —
 * often the largest I/O win available without touching RELION itself.
 * Empty (the default) = off. Returned WITHOUT the flag name so callers
 * only push when non-empty.
 */
export function refineScratchDir(job: EngineJobRef): string {
  // t375 — either key: curated scratchDir or the RELION twin (scratch_dir)
  const sd = str(job, "scratchDir", "").trim() || str(job, "scratch_dir", "").trim();
  return typeof sd === "string" ? sd.trim() : "";
}

/**
 * t352 — the verified option set of relion_refine (RELION 5.0-beta ∪ 5.0),
 * transcribed mechanically from 3dem/relion ml_optimiser.cpp (every
 * parser.getOption / parser.checkOption / checkParameter option string,
 * both parser sections — provenance: tags ver5.0 + the 5.0-beta-era
 * ver5.0 branch, 2026-09 audit; the e2e guard in run-6-batch-size.mjs
 * carries the same set). RELION's parser (args.cpp checkForUnknownArguments)
 * hard-rejects unknown --flags, so NOTHING outside this set may ever ride
 * a refine-family argv — the "Additional RELION arguments" escape hatch
 * validates its tokens against exactly this set.
 */
export const REFINE_VERIFIED_OPTIONS: ReadonlySet<string> = new Set([
  "--K", "--NN", "--abort_at_resolution", "--adaptive_fraction",
  "--allow_coarser_sampling", "--always_cc", "--asymmetric_padding", "--auto_ignore_angles",
  "--auto_iter_max", "--auto_local_healpix_order", "--auto_refine", "--auto_resol_angles",
  "--auto_sampling", "--bimodal_psi", "--blush", "--blush_skip_spectral_trailing",
  "--center_classes", "--class_inactivity_threshold", "--coarse_size", "--continue",
  "--cpu", "--ctf", "--ctf3d_not_squared", "--ctf_intact_first_peak",
  "--ctf_phase_flipped", "--ctf_uncorrected_ref", "--denovo_3dref", "--dont_check_norm",
  "--dont_combine_weights_via_disc", "--dont_skip_gridding", "--external_reconstruct", "--failsafe_threshold",
  "--fast_subsets", "--firstiter_cc", "--fix_sigma_noise", "--fix_sigma_offset",
  "--flatten_solvent", "--force_converge", "--fourier_mask", "--free_gpu_memory",
  "--gpu", "--grad", "--grad_em_iters", "--grad_fin_frac",
  "--grad_fin_resol", "--grad_fin_subset", "--grad_ini_frac", "--grad_ini_resol",
  "--grad_ini_subset", "--grad_min_resol", "--grad_stepsize", "--grad_stepsize_scheme",
  "--grad_write_iter", "--healpix_order", "--helical_exclude_resols", "--helical_inner_diameter",
  "--helical_keep_tilt_prior_fixed", "--helical_nr_asu", "--helical_nstart", "--helical_offset_step",
  "--helical_outer_diameter", "--helical_rise_inistep", "--helical_rise_initial", "--helical_rise_max",
  "--helical_rise_min", "--helical_sigma_distance", "--helical_symmetry_search", "--helical_twist_inistep",
  "--helical_twist_initial", "--helical_twist_max", "--helical_twist_min", "--helical_z_percentage",
  "--helix", "--i", "--ignore_helical_symmetry", "--incr_size",
  "--ini_high", "--ios", "--iter", "--j",
  "--join_random_halves", "--keep_free_scratch", "--keep_scratch", "--limit_tilt",
  "--local_symmetry", "--low_resol_join_halves", "--lowpass", "--lowpass_mask",
  "--maskedge", "--maxsig", "--min_sigma2_offset", "--mu",
  "--multibody_masks", "--multibody_norm_overlap", "--no_init_blobs", "--no_norm",
  "--no_parallel_disc_io", "--no_scale", "--norm", "--normalised_subtomo",
  "--nr_parts_sigma2noise", "--o", "--offset", "--offset_range",
  "--offset_range_x", "--offset_range_y", "--offset_range_z", "--offset_step",
  "--only_flip_phases", "--onthefly_shifts", "--oversampling", "--pad",
  "--pad_ctf", "--particle_diameter", "--perturb", "--pool",
  "--preread_images", "--print_metadata_labels", "--print_symmetry_ops", "--psi_step",
  "--r_min_nn", "--random_seed", "--reconstruct_subtracted_bodies", "--ref",
  "--ref_angpix", "--relax_sym", "--reuse_scratch", "--scale",
  "--scratch_dir", "--sigma_ang", "--sigma_off", "--sigma_psi",
  "--sigma_rot", "--sigma_tilt", "--skip_align", "--skip_maximize",
  "--skip_realspace_helical_sym", "--skip_rotate", "--skip_subtomo_multi", "--solvent_correct_fsc",
  "--solvent_mask", "--solvent_mask2", "--som", "--som_connectivity",
  "--som_inactivity_threshold", "--som_ini_nodes", "--som_neighbour_pull", "--split_random_halves",
  "--strict_highres_exp", "--strict_lowres_exp", "--subtomo_multi_thr", "--sycl",
  "--sym", "--tau", "--tau2_fudge", "--tau2_fudge_scheme",
  "--tomograms", "--trajectories", "--trust_ref_size", "--verb",
  "--zero_mask"
]);

/**
 * t352 — the healpix degree → order map (pipeline_jobs.h job_sampling_options:
 * the order is the list index + 1, exactly like RELION's own
 * JobOption::getHealPixOrder).
 */
const HEALPIX_ORDER: Record<string, number> = {
  "30": 1, "15": 2, "7.5": 3, "3.7": 4, "1.8": 5, "0.9": 6, "0.5": 7,
};

/** t352 — a sampling param's degree string → the --healpix_order/-style value;
 * "auto" (and anything unknown) = RELION's own default = no flag. */
function healpixOrderOf(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  return HEALPIX_ORDER[s] ?? null;
}

/**
 * t381 — the 3D Helix tab's argv, RELION 5 master's own construction
 * (pipeline_jobs.cpp:4031-4110), shared by Class3D and Refine3D:
 * the --helix gate, tube diameters (inner only when positive), the
 * do_apply_helical_symmetry group (ASU count + initial twist/rise +
 * z-percentage/100), the doubly-nested local-symmetry search bounds
 * (--helical_symmetry_search + min/max + inistep only when positive),
 * --ignore_helical_symmetry on the explicit No, the tilt-prior keeper,
 * the ±σ angular family (value/3, clamped 0-90 — RELION's own
 * conversion) and the local-averaging range factor. Gate off = ZERO
 * flags (existing jobs' argv stay byte-identical).
 */
function helicalArgs(job: EngineJobRef, opts?: { skipAlign?: boolean; localAngularSearch?: boolean }): string[] {
  if (job.params.doHelical !== true) return [];
  const a: string[] = ["--helix"];
  const inner = num(job, "helicalTubeInnerDiameter", -1);
  if (inner > 0) a.push("--helical_inner_diameter", String(inner));
  a.push("--helical_outer_diameter", String(num(job, "helicalTubeOuterDiameter", -1)));
  if (job.params.doApplyHelicalSymmetry !== false) {
    a.push("--helical_nr_asu", String(Math.max(1, Math.round(num(job, "helicalNrAsu", 1)))));
    a.push("--helical_twist_initial", String(num(job, "helicalTwistInitial", 0)));
    a.push("--helical_rise_initial", String(num(job, "helicalRiseInitial", 0)));
    a.push("--helical_z_percentage", String(num(job, "helicalZPercentage", 30) / 100));
    if (job.params.doLocalSearchHelicalSymmetry === true) {
      a.push("--helical_symmetry_search");
      a.push("--helical_twist_min", String(num(job, "helicalTwistMin", 0)));
      a.push("--helical_twist_max", String(num(job, "helicalTwistMax", 0)));
      const twistStep = num(job, "helicalTwistInistep", 0);
      if (twistStep > 0) a.push("--helical_twist_inistep", String(twistStep));
      a.push("--helical_rise_min", String(num(job, "helicalRiseMin", 0)));
      a.push("--helical_rise_max", String(num(job, "helicalRiseMax", 0)));
      const riseStep = num(job, "helicalRiseInistep", 0);
      if (riseStep > 0) a.push("--helical_rise_inistep", String(riseStep));
    }
  } else {
    a.push("--ignore_helical_symmetry");
  }
  if (job.params.keepTiltPriorFixed !== false) a.push("--helical_keep_tilt_prior_fixed");
  // the ±σ angular family rides only while aligning without a local cone
  // (RELION's own condition: dont_skip_align && !do_local_ang_searches)
  if (!opts?.skipAlign && !opts?.localAngularSearch) {
    const sigmaOf = (v: number) => String(Math.min(90, Math.max(0, v)) / 3);
    const tilt = num(job, "rangeTiltHelical", 15);
    const psi = num(job, "rangePsiHelical3d", 10);
    const rot = num(job, "rangeRotHelical", -1);
    a.push("--sigma_tilt", sigmaOf(tilt));
    a.push("--sigma_psi", sigmaOf(psi));
    if (rot > 0) a.push("--sigma_rot", sigmaOf(rot));
    const rangeDist = num(job, "helicalRangeDistance", -1);
    if (rangeDist > 0) a.push("--helical_sigma_distance", String(rangeDist / 3));
  }
  return a;
}

/**
 * t352 — the GUI-parity tail shared by the whole refine family (RELION's
 * Compute tab): the disc-I/O trio + the scratch keep-free companion + the
 * validated "Additional RELION arguments" escape hatch. Returns an error
 * (instead of argv) when extraArgs names a flag outside the verified set —
 * the run dies at THIS door, with the flag named, instead of at RELION's
 * argv parser on the cluster.
 */
function refineTail(job: EngineJobRef): string[] | { error: string } {
  const out: string[] = [];
  // the disc-I/O trio — only the NON-default side rides the argv (defaults
  // match RELION's own, exactly like the GUI: only changed options emit).
  // t375 — each knob reads EITHER key (curated or the RELION twin); the twin's
  // polarity is the RELION one (do_parallel_discio=false ⇒ --no_parallel_disc_io).
  if (job.params.parallelDiscIo === false || job.params.do_parallel_discio === false) {
    out.push("--no_parallel_disc_io");
  }
  if (flagAnyTrue(job, "prereadImages", "do_preread_images")) out.push("--preread_images");
  // t375 — the twin read: do_combine_thru_disc=false (RELION polarity) must
  // ride --dont_combine_weights_via_disc exactly like the curated twin
  if (job.params.combineThruDisc === false || job.params.do_combine_thru_disc === false) {
    out.push("--dont_combine_weights_via_disc");
  }
  // scratch + its keep-free floor (only with a scratch dir set)
  const scratch = refineScratchDir(job);
  if (scratch) {
    out.push("--scratch_dir", scratch);
    const kf = num(job, "keepFreeScratch", 0);
    if (kf > 0) out.push("--keep_free_scratch", String(kf));
  }
  // the escape hatch — every --token must be a verified relion_refine option
  const extra = str(job, "extraArgs", "").trim();
  if (extra) {
    // t374 — the verified set now also includes every flag of the job's own
    // RELION option table (same tags, machine-extracted by the codegen) —
    // the escape hatch validates against exactly what the GUI itself could
    // have emitted for this type.
    const tableFlags = relionTypeFlags(job.type);
    const tokens = extra.split(/\s+/);
    for (const t of tokens) {
      if (t.startsWith("--") && !REFINE_VERIFIED_OPTIONS.has(t) && !tableFlags.has(t)) {
        return {
          error:
            `unknown relion option "${t}" in Additional RELION arguments — it is not in the verified ` +
            `RELION 5.0 option set (RELION's own parser would hard-reject the whole run at start). ` +
            `Fix or drop the flag in the job's Compute tab`,
        };
      }
    }
    out.push(...tokens);
  }
  return out;
}

/** t374 — every command-line flag of the job type's RELION option table. */
function relionTypeFlags(type: string): ReadonlySet<string> {
  const table = RELION_OPTIONS[type];
  if (!table) return EMPTY_FLAGS;
  const out = new Set<string>();
  for (const def of Object.values(table.options)) {
    const f = def.flag?.trim();
    if (f) out.add(f);
  }
  return out;
}
const EMPTY_FLAGS: ReadonlySet<string> = new Set();

/**
 * t374 — the RELION 5.0 option-table generic extension. Every param whose
 * key lives in the generated RELION table for this job type AND whose value
 * differs from RELION's own default AND whose flag is not already on the
 * argv line rides along verbatim. The flag-presence check is the dedupe
 * invariant: a curated builder that already emitted --K keeps its single
 * --K even when the RELION twin key (nr_classes) also carries a value.
 * Boolean options are presence-only (RELION's own convention: the flag rides
 * when true, nothing rides when false).
 *
 * Never throws — the curated argv is always a complete, valid command; the
 * generic layer only ADDS knobs RELION's own GUI would have added.
 */
function appendRelionFlags(
  argv: string[],
  type: string,
  params: Record<string, number | string | boolean>
): void {
  const table = RELION_OPTIONS[type];
  if (!table) return;
  // t375 — aliased RELION twins are the curated builder's to emit (it reads
  // either key); the generic layer never touches them. This is what the
  // ALIASES contract promised and what protects inverted twins
  // (dont_skip_align/do_parallel_discio/do_combine_thru_disc) from the
  // flag-presence heuristic's polarity blindness.
  // t386 — alias values may be ARRAYS (a curated composite knob owning
  // several raw options, e.g. class2d's algorithm → do_em + do_grad), so
  // the skip-set flattens before use
  const aliased = new Set(
    Object.values(RELION_ALIASES[type] ?? {}).flatMap((v) =>
      Array.isArray(v) ? v : [v]
    )
  );
  const present = new Set<string>();
  for (const a of argv) {
    if (typeof a === "string" && a.startsWith("--") && a.length > 2) present.add(a);
  }
  for (const def of Object.values(table.options)) {
    if (aliased.has(def.key)) continue;
    const flag = def.flag?.trim();
    if (!flag || present.has(flag)) continue;
    const v = params[def.key];
    if (v === undefined || v === null) continue;
    if (def.type === "bool" || typeof v === "boolean") {
      // presence-only: true rides the flag, false never does
      if (v === true) {
        argv.push(flag);
        present.add(flag);
      }
      continue;
    }
    if (typeof v === "string") {
      if (v === "" || v === def.default) continue;
      argv.push(flag, v);
      present.add(flag);
    } else if (typeof v === "number" && Number.isFinite(v)) {
      if (typeof def.default === "number" && Math.abs(v - def.default) < 1e-9) continue;
      argv.push(flag, String(v));
      present.add(flag);
    }
  }
}

/** t352 — 0 = auto (no flag); >0 = the explicit value rides. */
function positiveNum(job: EngineJobRef, key: string): number | null {
  const v = num(job, key, 0);
  return v > 0 ? v : null;
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
  /** Drop this requirement entirely when the predicate fires — e.g.
   *  autopick's 2D references are NOT needed in Laplacian-of-Gaussian
   *  (reference-free) mode, so the job can run straight after CTF. */
  skipIf?: (params: Record<string, unknown>) => boolean;
  /** Best-effort requirement: a missing optional input never blocks the
   *  run — it is simply absent from the resolved inputs (display-only
   *  sources like select2d's class-averages gallery). */
  optional?: boolean;
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
    {
      key: "refs_mrc",
      accepts: ["classes_mrc", "model_mrc"],
      from: ["class2d", "initialmodel", "class3d"],
      label: "2D reference templates (run Class2D first) — or switch Picking method to Laplacian of Gaussian (reference-free)",
      // LoG picking needs no templates — the refs input is only a hard
      // requirement in "References" mode (param default = LoG).
      skipIf: (p) => String(p.pickingMethod ?? "Laplacian of Gaussian") !== "References",
    },
    {
      // trained Topaz CNN model (Topaz Training job). Optional: empty =
      // topaz's general model, which works but underperforms a model
      // trained on YOUR particles.
      key: "topaz_model",
      accepts: ["topaz_model"],
      from: ["topaztrain"],
      label: "trained Topaz model (optional — connect Topaz Training output, or pick with the general model)",
      optional: true,
    },
  ],
  topaztrain: [
    { key: "micrographs_star", accepts: ["micrographs_star", "micrographs_ctf_star"], from: ["import", "motioncorr", "ctffind"], label: "micrographs.star (run Import first)" },
    {
      key: "train_picks",
      accepts: ["coords_star"],
      from: ["manualpick", "autopick"],
      label: "training picks — hand-picked particle coordinates (run Manual Picking first; ~100+ picks give the CNN something to learn)",
    },
  ],
  extract: [
    { key: "micrographs_star", accepts: ["micrographs_star", "micrographs_ctf_star"], from: ["import", "motioncorr", "ctffind"], label: "micrographs.star (run Import first)" },
    { key: "coords_dir", accepts: ["coords_dir", "coords_star"], from: ["manualpick", "autopick"], label: "particle coordinates (run ManualPick/AutoPick first)" },
  ],
  select: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "cs2star", "class2d", "select", "select2d", "joinstar", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
  ],
  select2d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "cs2star", "class2d", "select2d"], label: "classified particles STAR with _rlnClassNumber (run 2D Classification first)" },
    // class averages only feed the selection GALLERY — missing stack must
    // never block the run (older jobs may lack the output)
    { key: "classes_mrc", accepts: ["classes_mrc"], from: ["class2d"], label: "2D class averages (gallery)", optional: true },
  ],
  class2d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "cs2star", "select", "select2d", "class2d", "joinstar", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
  ],
  initialmodel: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "cs2star", "select", "select2d", "class2d", "joinstar", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
  ],
  class3d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "cs2star", "select", "select2d", "class2d", "initialmodel", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    // the reference MUST be a 3D map: initialmodel's VDAM model or class3d's
    // own 3D class volumes. class2d is deliberately absent — its classes are
    // 2D averages, and seeding a 3D refinement with them silently produced
    // garbage (observed live: refine3d exec'd with class2d's
    // run_unmasked_classes.mrcs as --ref while initialmodel was still running).
    { key: "model_mrc", accepts: ["model_mrc", "classes_mrc"], from: ["initialmodel", "class3d", "mapimport"], label: "reference map (run InitialModel first, or import a map)" },
  ],
  refine3d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "cs2star", "select", "select2d", "class2d", "joinstar", "initialmodel", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    // 3D reference only — never class2d's 2D averages (see class3d note)
    { key: "model_mrc", accepts: ["model_mrc", "classes_mrc"], from: ["initialmodel", "class3d", "mapimport"], label: "reference map (run InitialModel first, or import a map)" },
  ],
  multibody: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "cs2star", "select", "select2d", "class2d", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    { key: "optimiser_star", accepts: ["optimiser_star"], from: ["refine3d", "class3d"], label: "optimiser.star (run Refine3D first)" },
  ],
  symexpand: [
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "cs2star", "select", "select2d", "class2d", "initialmodel", "class3d", "refine3d", "joinstar", "symexpand", "rebalance"], label: "particles.star with Euler angles (run Extract/Refine first)" },
  ],
  rebalance: [
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "cs2star", "select", "select2d", "class2d", "initialmodel", "class3d", "refine3d", "joinstar", "symexpand", "rebalance"], label: "oriented particles STAR with _rlnAngleRot/Tilt (refine/classify output)" },
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
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "cs2star", "refine3d", "class2d", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    { key: "postprocess_star", accepts: ["postprocess_star"], from: ["postprocess"], label: "postprocess.star (run PostProcess first)" },
    { key: "micrographs_star", accepts: ["micrographs_star", "corrected_micrographs_star"], from: ["motioncorr", "import"], label: "corrected micrographs.star (run MotionCorr first)" },
  ],
  ctfrefine: [
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "cs2star", "refine3d", "class2d", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    { key: "postprocess_star", accepts: ["postprocess_star"], from: ["postprocess"], label: "postprocess.star (run PostProcess first)" },
  ],
  dynamight: [
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "cs2star", "refine3d", "class2d", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    { key: "model_mrc", accepts: ["model_mrc", "map_mrc"], from: ["refine3d", "postprocess"], label: "consensus map (run Refine3D first)" },
  ],
  modelangelo: [
    { key: "map_mrc", accepts: ["map_mrc", "model_mrc"], from: ["postprocess", "refine3d"], label: "sharpened map (run PostProcess first)" },
  ],
  subtract: [
    { key: "optimiser_star", accepts: ["optimiser_star"], from: ["refine3d", "class3d"], label: "optimiser.star (run Refine3D first)" },
    { key: "mask_mrc", accepts: ["mask_mrc"], from: ["maskcreate"], label: "mask of signal to subtract (run MaskCreate first)" },
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "cs2star", "refine3d"], label: "particles.star (run Extract first)" },
  ],
  tomo_import: [],
  tomo_aligntiltseries: [
    { key: "tilt_series_star", accepts: ["tilt_series_star", "tilt_series_ctf_star"], from: ["tomo_import", "tomo_exclude"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_tomograms: [
    { key: "tilt_series_star", accepts: ["aligned_tilt_series_star", "tilt_series_star"], from: ["tomo_aligntiltseries", "tomo_import"], label: "aligned tilt series (run Tomo: Align Tilt Series first)" },
  ],
  tomo_ctfrefine: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["tomo_reconstruct", "refine3d"], label: "reference half-map (run Tomo: Reconstruct first)" },
  ],
  tomo_exclude: [
    { key: "tilt_series_star", accepts: ["tilt_series_star"], from: ["tomo_import", "tomo_aligntiltseries"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_polish: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["tomo_reconstruct", "refine3d"], label: "reference half-map (run Tomo: Reconstruct first)" },
  ],
  tomo_reconstruct: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
  ],
  tomo_denoise: [
    { key: "tomograms_star", accepts: ["tomograms_star"], from: ["tomo_tomograms"], label: "tomograms.star (run Tomo: Reconstruct Tomograms first)" },
  ],
  tomo_picks: [
    { key: "tilt_series_star", accepts: ["tilt_series_star", "aligned_tilt_series_star"], from: ["tomo_aligntiltseries", "tomo_import"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_extract: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "tomo_picks"], label: "picks (run Tomo: Picking first)" },
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
 * t324 — cluster-side output candidates: the file names a type's CHAINABLE
 * outputs wear inside the run directory. collectOutputs stays the LOCAL
 * authority (it counts, ranks and synthesizes); this table exists for the
 * REMOTE truth probe — when the sync-back leaves a key behind (sync caps,
 * an exhausted budget, a download that failed mid-way), the file usually
 * still sits on the cluster, and a downstream REMOTE consumer can chain off
 * it IN PLACE through the record's remoteOutputs twin (no re-upload, no
 * local copy needed). Shell globs use bash character classes; "latest"
 * picks the highest iteration (RELION zero-pads it###, so a lexicographic
 * sort is numeric up to 999 iterations).
 */
export interface RemoteOutputCandidate {
  /** Output-record key this candidate feeds (the INPUTS[].accepts space). */
  key: string;
  /** Exact file names at the run-directory root, tried in order. */
  exact?: string[];
  /** Bash glob evaluated inside the remote workdir. */
  glob?: string;
  /** Which glob hit wins ("latest" = highest iteration, "first" = any). */
  pick?: "latest" | "first";
}

const REFINE_FAMILY_CANDIDATES: RemoteOutputCandidate[] = [
  {
    key: "model_mrc",
    exact: ["run_half1_class001_unfil.mrc", "run_class001.mrc"],
    glob: "run_it[0-9]*_half1_class[0-9]*.mrc",
    pick: "latest",
  },
  { key: "half1_mrc", exact: ["run_half1_class001_unfil.mrc"], glob: "run_it[0-9]*_half1_class[0-9]*.mrc", pick: "latest" },
  { key: "half2_mrc", exact: ["run_half2_class001_unfil.mrc"], glob: "run_it[0-9]*_half2_class[0-9]*.mrc", pick: "latest" },
  { key: "optimiser_star", exact: ["run_optimiser.star"], glob: "run_it[0-9]*_optimiser.star", pick: "latest" },
  { key: "refine_data_star", exact: ["run_data.star"], glob: "run_it[0-9]*_data.star", pick: "latest" },
];

export const REMOTE_OUTPUT_CANDIDATES: Record<string, RemoteOutputCandidate[]> = {
  motioncorr: [{ key: "micrographs_star", exact: ["corrected_micrographs.star"] }],
  ctffind: [{ key: "micrographs_ctf_star", exact: ["micrographs_ctf.star"] }],
  autopick: [
    { key: "coords_star", exact: ["autopick.star"], glob: "micrographs/*_autopick.star", pick: "first" },
  ],
  topaztrain: [{ key: "topaz_model", exact: ["topaz_model.sav"], glob: "*.sav", pick: "first" }],
  extract: [{ key: "particles_star", exact: ["particles.star"] }],
  // t352 — cs2star's cluster twin (uploaded at the end of the engine-native
  // conversion) speaks the exact same shape as extract's: the probe cycles
  // (a downstream dispatch's lazy heal, a missing-worklist probe) can
  // re-find and self-heal the twin inside remoteWorkdir when the record's
  // registration was lost — a pre-t352 ledger, a wiped record, a manual
  // cleanup. Without this entry those dialects would promise a probe that
  // can never fire (the t325-a M1 rule).
  cs2star: [{ key: "particles_star", exact: ["particles.star"] }],
  // t360 — the mapimport twin's name rides the SOURCE map's basename (the
  // local lane materializes under its own name too), so the probe cannot
  // promise an exact file — the glob covers .mrc/.map and nothing else in
  // the twin dir (run.out/run.err witnesses never match).
  mapimport: [{ key: "model_mrc", glob: "*.m[ra][cp]", pick: "first" }],
  class2d: [
    { key: "particles_star", exact: ["run_data.star"], glob: "run_it[0-9]*_data.star", pick: "latest" },
    {
      key: "classes_mrc",
      exact: ["run_unmasked_classes.mrcs", "run_classes.mrcs", "run_classes.mrc"],
      glob: "run_it[0-9]*_classes.mrcs",
      pick: "latest",
    },
  ],
  initialmodel: [
    { key: "model_mrc", exact: ["run_model.mrc", "run_classes.mrcs"], glob: "run_it[0-9]*_class[0-9]*.mrc", pick: "latest" },
    { key: "refine_data_star", exact: ["run_data.star"], glob: "run_it[0-9]*_data.star", pick: "latest" },
  ],
  class3d: REFINE_FAMILY_CANDIDATES,
  refine3d: REFINE_FAMILY_CANDIDATES,
  maskcreate: [{ key: "mask_mrc", exact: ["mask.mrc"] }],
  postprocess: [
    { key: "map_mrc", exact: ["postprocess.mrc"] },
    { key: "postprocess_star", exact: ["postprocess.star"] },
  ],
  localres: [{ key: "map_mrc", exact: ["relion_locres.mrc"] }],
  joinstar: [{ key: "particles_star", exact: ["join_particles.star", "join_mics.star", "join_movies.star"] }],
  polish: [{ key: "particles_star", exact: ["shiny.star", "particles_polished.star"] }],
  ctfrefine: [{ key: "particles_star", exact: ["particles_ctf_refine.star"] }],
  subtract: [{ key: "particles_star", exact: ["particles_subtracted.star"] }],
};

/**
 * t324 — keys of `type`'s chainable outputs that are accounted for NOWHERE:
 * not present locally (outputs + existsSync — the sync-back's copy) and not
 * verified on the cluster (remoteOutputs). This is the remote probe's
 * worklist: every key listed here deserves one SSH look at the run dir.
 */
export function missingRemoteOutputKeys(
  type: string,
  outputs: Record<string, string>,
  remoteOutputs: Record<string, string> | undefined
): string[] {
  const cands = REMOTE_OUTPUT_CANDIDATES[type];
  if (!cands) return [];
  const missing: string[] = [];
  for (const c of cands) {
    const local = outputs[c.key];
    if (local && existsSync(local)) continue;
    if (remoteOutputs && remoteOutputs[c.key]) continue;
    missing.push(c.key);
  }
  return missing;
}

/** Options for resolveInputs' remote-aware flavor (t324). */
export interface ResolveInputsOpts {
  /**
   * The consumer runs on an SSH cluster: a requirement may resolve through
   * the upstream record's CLUSTER-verified twin (remoteOutputs) when the
   * local synced copy is missing — the file never left the cluster, so a
   * cluster consumer chains off it in place (no upload, no local copy).
   */
  remote?: boolean;
  /**
   * With `remote`: only twins recorded by THIS connection count — a path
   * from another cluster is not a file on this one (the staging skip and
   * the argv would both reference a path that does not exist there).
   */
  connectionId?: string;
  /**
   * t325 — `host:port` of the connection the consumer dispatches through.
   * Connection IDENTITY is (id, host): a re-created connection to the SAME
   * host is still the same cluster — its filesystem holds the record's
   * remote paths. Without this, connection drift (delete + re-add while
   * debugging a cluster) stranded remote chains forever: the retry sweep
   * dispatched with the NEW id, every twin gate compared ids, and a
   * pending consumer waited over a file sitting on the very cluster it
   * was about to run on (the t325 field receipt).
   */
  host?: string;
}

/**
 * t325-a — host:port normalization for cluster identity: case-insensitive
 * host, trailing FQDN dot stripped ("Brain2." === "brain2", "Cluster5" ===
 * "cluster5"). IP-vs-DNS aliases deliberately DO NOT fold — a re-creation
 * under an alias fails CLOSED into the cross-cluster refusal (the honest
 * side of the miss).
 */
export function normalizeClusterHost(hostPort: string): string {
  const h = hostPort.trim().toLowerCase();
  return h.endsWith(".") ? h.slice(0, -1) : h;
}

/**
 * t328 — any LIVE connection whose host:port matches (normalized): the
 * t325 doctrine ("the cluster is a HOST, not a connection id") at the
 * registry level. The passthrough door (dispatch) and the pending
 * dialects below both consult it — connection drift (delete + re-add the
 * same cluster) must not strand a remote chain whose files sit on that
 * very host. Newest profile wins (a re-created connection is the one
 * with working auth). IP-vs-DNS aliases deliberately do not fold — the
 * same fail-closed honesty as normalizeClusterHost.
 */
export function liveConnectionForHost(hostPort: string): RemoteConnection | null {
  const want = normalizeClusterHost(hostPort);
  if (!want) return null;
  let found: RemoteConnection | null = null;
  for (const c of loadConnections()) {
    if (!c.host) continue;
    if (normalizeClusterHost(`${c.host}:${c.port}`) === want) found = c;
  }
  return found;
}

/**
 * t325 — is the record's cluster the one this consumer targets? The bare
 * remote flavor (no connectionId) never gated; otherwise the record's
 * connection OR its host:port must match the target. Shared by
 * resolveInputs' twin gate, the lazy heal's eligibility and the staging
 * plan's identity-twin map, so the three cannot drift apart.
 */
export function sameClusterTarget(
  rec: { connectionId: string; host: string },
  opts: { connectionId?: string; host?: string }
): boolean {
  if (opts.connectionId == null) return true; // bare remote flavor — no gate
  if (rec.connectionId === opts.connectionId) return true;
  // t325 — same cluster, re-created connection; t325-a — normalized
  // (case / trailing FQDN dot never blocks a genuine re-creation).
  if (
    opts.host != null &&
    normalizeClusterHost(rec.host) === normalizeClusterHost(opts.host)
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve required inputs from upstream completed runs.
 * `missing` is a human-readable message (null on success); `wait` classifies
 * WHY an input is missing so the dispatcher can mark the job PENDING
 * (upstream failed / still running / never ran) instead of failed — a failed
 * upstream used to cascade red "Waiting for upstream output" failures down
 * the entire pipeline.
 */
export function resolveInputs(
  type: string,
  upstream: UpstreamRef[],
  params?: Record<string, unknown>,
  opts?: ResolveInputsOpts
): { inputs: Record<string, string>; missing: string | null; wait?: WaitKind } {
  // param-driven optionality: drop requirements whose skipIf fires
  // (only the dispatch call passes params — the manualpick/select
  // pre-flight lookups have no skipIf requirements).
  const reqs = (INPUTS[type] ?? []).filter(
    (r) => !r.skipIf || !params || !r.skipIf(params)
  );
  const runs = readRuns();
  const inputs: Record<string, string> = {};

  for (const req of reqs) {
    let resolved: string | null = null;
    // upstream arrives in INPUT-PRIORITY order from lineageFor(): BFS by
    // graph distance (direct parents first) with newest-first within a
    // layer — scan forward and take the first provider that has the output.
    const providers: { name: string; status: string }[] = [];
    // t324 — a provider holding a CLUSTER-verified twin for an accepted key
    // while the local copy is missing: the not-ready message must say WHERE
    // the file lives instead of pretending the upstream never ran.
    let stayedOnCluster: string | null = null;
    // t328 — the provider's RECORD rides along (host, workdir, probe
    // verdicts): the local-flavor dialects are route-aware and
    // outcome-aware, and both need more than a display name.
    let stayedOnClusterState: RunRecord | null = null;
    // t325 — a COMPLETED remote provider whose accepted keys are accounted
    // NOWHERE (not locally, no cluster twin): the run predates the
    // cluster-output registry. The old generic message told the user to
    // "run Extract first" over a run that had already succeeded — the exact
    // lie the t325 ticket carried for a second week.
    let registryStale: string | null = null;
    let registryStaleState: RunRecord | null = null;
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
          // t324 — the remote twin: the sync-back can legitimately leave a
          // key behind (caps, budget, a failed download) while the file
          // itself sits safely on the cluster it was computed on. A REMOTE
          // consumer resolves through the twin directly — the staging skip
          // and the argv both key off the record's verified cluster path.
          // t325 — the gate is cluster IDENTITY (connection OR host), not
          // the bare connectionId: a re-created connection to the same
          // cluster still holds the file.
          const twinRemote = state.remote;
          const twin = twinRemote?.remoteOutputs?.[key];
          if (twin && opts?.remote && sameClusterTarget(twinRemote, opts)) {
            resolved = twin;
            break;
          }
          if (twin && stayedOnCluster == null) {
            stayedOnCluster = up.name ?? up.type;
            stayedOnClusterState = state;
          }
        }
        if (resolved) break;
        // t325 — none of the accepted keys exist ANYWHERE on this completed
        // remote provider: register the registry-stale shape (message below).
        // t325-a (M1) — the dialect promises "the dispatch probes the
        // upstream's workdir": only provider types with REMOTE_OUTPUT_
        // CANDIDATES entries for an ACCEPTED key can keep that promise — a
        // remote select/import wired to a particles.star consumer has no
        // probe candidates, and promising a heal that cannot fire is the
        // same lie the dialect exists to retire. The generic branch is the
        // honest ceiling for those types.
        // t325-a (N1) — "accounted" means existsSync-aware on the local
        // half: a recorded-but-deleted file (a sync that landed the path and
        // lost the bytes) is unaccounted EXACTLY like the heal's own
        // worklist (missingRemoteOutputKeys), so the message and the probe
        // can never disagree about what needs healing.
        if (
          registryStale == null &&
          state.remote &&
          (REMOTE_OUTPUT_CANDIDATES[up.type] ?? []).some((c) =>
            req.accepts.includes(c.key)
          ) &&
          req.accepts.every(
            (k) =>
              !(state.outputs[k] && existsSync(state.outputs[k])) &&
              !state.remote?.remoteOutputs?.[k]
          )
        ) {
          registryStale = up.name ?? up.type;
          registryStaleState = state;
        }
      }
      providers.push({ name: up.name ?? up.type, status: up.status ?? "idle" });
    }
    if (!resolved) {
      // optional inputs degrade silently (gallery sources, previews)
      if (req.optional) continue;
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
      // t325 — NOTHING of the requirement's provider types is wired at all
      // (a lost/deleted edge leaves the lineage empty): the old generic
      // message promised "runs automatically once ready" over a job that
      // has NO upstream to wait for — the retry sweep can never fire
      // without an edge, so the promise was a lie. Name the real fix.
      if (providers.length === 0) {
        const what = req.label.replace(/\s*\(run [^)]*\)/, "").trim() || req.label;
        return {
          inputs: {},
          missing: `No upstream job is wired that produces ${what} — connect one (drag a wire from its output port to this job); it then starts automatically once its inputs are ready`,
          wait: "not-ready",
        };
      }
      if (stayedOnCluster) {
        // t324 — the file EXISTS, it just never came home. The old wording
        // ("run Extract first") sent the user hunting a run that already
        // succeeded. Distinguish the two lanes: a remote consumer was
        // offered the twin and refused it (another cluster holds it) vs a
        // local consumer that genuinely needs the local copy. The label's
        // "(run X first)" tail is stripped — that advice is exactly the
        // lie being replaced.
        const what = req.label.replace(/\s*\(run [^)]*\)/, "").trim() || req.label;
        if (opts?.remote) {
          return {
            inputs: {},
            missing: `Upstream "${stayedOnCluster}" ran on a different cluster and its ${what} stayed there — re-run the upstream on this cluster, or wire one that ran here`,
            wait: "not-ready",
          };
        }
        // t328 — the local consumer's lane is ROUTE-AWARE: a live profile
        // for the record's host means the retry heartbeat dispatches this
        // job to that cluster BY ITSELF (the same-host passthrough
        // recovery) and it chains off the cluster copy in place — the old
        // "send this job to the cluster" imperative was a click the app
        // was about to make unasked. No live route: name the door.
        const shost = stayedOnClusterState?.remote?.host.split(":")[0] ?? "the cluster";
        if (
          stayedOnClusterState?.remote &&
          liveConnectionForHost(stayedOnClusterState.remote.host)
        ) {
          return {
            inputs: {},
            missing: `Upstream "${stayedOnCluster}" completed on the cluster, but its ${what} stayed there (over the sync caps) — this job starts by itself on ${shost} on the next retry heartbeat (it chains off the cluster copy in place); raise the connection's sync caps and re-run the upstream to also bring the file home`,
            wait: "not-ready",
          };
        }
        return {
          inputs: {},
          missing: `Upstream "${stayedOnCluster}" completed on the cluster, but its ${what} stayed there (over the sync caps) — connect a cluster profile for ${shost} (Remote cluster) so this job can chain off the cluster copy in place, or raise the sync caps and re-run the upstream to bring the file home`,
          wait: "not-ready",
        };
      }
      // t325 — the registry-stale shape: the provider ran and completed on
      // a cluster, but WHERE its key lives was never recorded (a pre-t324
      // finalize, or a record the sync never accounted). Point at the door
      // that fixes it instead of "run Extract first".
      if (registryStale) {
        const what = req.label.replace(/\s*\(run [^)]*\)/, "").trim() || req.label;
        const rhost = registryStaleState?.remote?.host.split(":")[0] ?? "the cluster";
        // t328 — the probe ALREADY ran and verified the file absent on the
        // cluster (outputProbeAbsent on the record): the honest ceiling is
        // "the output is gone — re-run the upstream". Re-promising the
        // probe ("the dispatch probes the upstream's workdir") over a
        // verdict already in hand is the zero-new-information loop the
        // field receipt carried for days: every heartbeat re-probes at the
        // 10-minute cadence, rewrites the same message, and the user
        // cannot tell "not there" from "never checked" from "cannot
        // reach the cluster".
        const absent = registryStaleState?.remote?.outputProbeAbsent ?? [];
        if (absent.some((k) => req.accepts.includes(k))) {
          return {
            inputs: {},
            missing: `Upstream "${registryStale}" completed on the cluster, but its ${what} is not in its workdir on ${rhost} either (checked there) — the output is genuinely gone; re-run the upstream to regenerate it`,
            wait: "not-ready",
          };
        }
        if (opts?.remote) {
          return {
            inputs: {},
            missing: `Upstream "${registryStale}" completed on the cluster, but where its ${what} lives is not on record — send this job to the cluster (the dispatch probes the upstream's workdir there and chains off the copy in place), or re-run the upstream to refresh its record`,
            wait: "not-ready",
          };
        }
        // t328 — the LOCAL lane never probes anything (the lazy heal lives
        // in the remote dispatch only): the old text's "send this job to
        // the cluster (the dispatch probes…)" was a promise THIS code path
        // cannot keep. Route-aware like the stay-behind lane below: a live
        // profile for the record's host means the provider's own retry
        // round recovers it and dispatches there by itself; no live route
        // — name the door.
        if (registryStaleState?.remote && liveConnectionForHost(registryStaleState.remote.host)) {
          return {
            inputs: {},
            missing: `Upstream "${registryStale}" completed on the cluster, but where its ${what} lives is not on record — this job starts by itself on ${rhost} on the next retry heartbeat (the upstream's workdir is probed there and the job chains off the copy in place); or re-run the upstream to refresh its record`,
            wait: "not-ready",
          };
        }
        return {
          inputs: {},
          missing: `Upstream "${registryStale}" completed on the cluster (${rhost}), but where its ${what} lives is not on record — connect a cluster profile for ${rhost} (Remote cluster) and this job starts by itself there, or re-run the upstream to refresh its record`,
          wait: "not-ready",
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
 * Task 170 — the table lives in ./command-templates.ts now (client-safe:
 * the inspector speaks the template BEFORE the first launch, and this
 * module imports child_process so the client can never import it). The
 * re-export keeps every existing server consumer's import path stable.
 */
export { COMMAND_TEMPLATES } from "./command-templates";

/* ------------------------------------------------------------------ */
/* STAR file helpers                                                    */
/* ------------------------------------------------------------------ */

/** Micrograph names from a micrographs.star (first column after the loop header). */
function micrographNames(starPath: string): string[] {
  return micrographRowsFromContent(readFileSync(starPath, "utf8"));
}

/**
 * t317 — image stack paths from a particles.star: the path half of every
 * _rlnImageName-style ref (both `000001@/abs/stack.mrcs` and bare
 * `stack.mrcs` column shapes — whitespace-tolerant, same contract as
 * rebaseParticlesStar). Only the FIRST image-shaped token per row counts,
 * so extra columns never inflate the majority bar.
 */
function particleStackNames(starPath: string): string[] {
  const blocks = parseStarBlocks(readFileSync(starPath, "utf8"));
  const imgBlock = blocks.find((b) => b.lines.some((l) => l.includes("_rlnImageName")));
  if (!imgBlock) return [];
  const IMG_TOK = /^(?:\d+@)?(\S+\.(?:mrc|mrcs|tif|tiff|img))$/i;
  const names: string[] = [];
  for (const line of imgBlock.lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t === "loop_" || t.startsWith("_rln") || t.startsWith("data_")) {
      continue;
    }
    for (const tok of t.split(/\s+/)) {
      const m = IMG_TOK.exec(tok);
      if (m) {
        names.push(m[1]);
        break; // one stack ref per row
      }
    }
  }
  return names;
}

/* ------------------------------------------------------------------ */
/* t313 — the CTF input gate: names are hints, bytes are the verdict   */
/* ------------------------------------------------------------------ */
/*
 * t312 refused any ctffind input whose rows SMELLED like EPU movie
 * naming (≥50% `*_Fractions*`). The Beijing follow-up proved the false
 * positive: the user's `Micrographs/` folder holds MotionCor2 OUTPUTS —
 * motioncor2 KEEPS the input basename, so `xxx_Fractions.mrc` (aligned
 * sum) and `xxx_Fractions_DW.mrc` (dose-weighted sum) are summed
 * single-section micrographs, exactly what ctffind wants. The same stems
 * also name raw frame stacks in a Movies/ folder. A filename cannot tell
 * the two worlds apart — the t312 refusal blocked a legitimate workflow.
 *
 * The t313 gate keeps the nose only to FIND candidates worth verifying,
 * then reads the MRC headers themselves (64 bytes: NX/NY/NZ/MODE at
 * offsets 0/4/8/12 — see relion/mrc-sniff.ts):
 *   NZ > 1            → a genuine frame stack → refuse, with the header's
 *                       own numbers as evidence (t312's intent, now with
 *                       proof instead of a guess);
 *   NZ === 1          → a summed micrograph → ALLOW — the name was just a
 *                       name. This is the user's exact case.
 *   unreadable / TIFF → allow with an honest note (the user is the
 *                       authority on their own data; never twice the same
 *                       wrong block);
 *   .eer (≥50%)       → refuse: an event-record file is raw frames by
 *                       definition, no bytes need crossing the wire.
 */

const MOVIE_STACK_RE =
  /(?:^|[_\-.])(?:fractions?|frames?|movies?)(?:[_\-.]|$)|\.eer$/i;

/** Share of paths whose BASENAME smells like a raw movie frame stack. */
export function movieStackShare(paths: string[]): number {
  if (paths.length === 0) return 0;
  let hits = 0;
  for (const p of paths) {
    const base = p.split(/[\\/]/).pop() ?? p;
    if (MOVIE_STACK_RE.test(base)) hits += 1;
  }
  return hits / paths.length;
}

/** What the CTF input gate decided about a smelled input. */
export interface CtffindGateResult {
  /** non-null → refuse the dispatch/row with this message (the evidence) */
  refusal: string | null;
  /** non-null → allowed, but this honest note rides along (log/import) */
  note: string | null;
}

/**
 * The shared CTF door (t313). `sniff` earns the verdicts — local fs reads
 * on the local lane, one SSH round trip on the remote lane — and every
 * verdict it cannot earn degrades to "allow with a note", never a block.
 * Both lanes call this BEFORE any staging/workdir work happens.
 */
export async function ctffindInputGate(
  starPath: string,
  sniff: HeaderSniffer
): Promise<CtffindGateResult> {
  const clean: CtffindGateResult = { refusal: null, note: null };
  let names: string[] = [];
  try {
    names = micrographNames(starPath);
  } catch {
    return clean; // unreadable → the run itself will say the real problem
  }
  if (names.length === 0) return clean;
  const flagged = names.filter((n) => MOVIE_STACK_RE.test((n.split(/[\\/]/).pop() ?? n)));
  if (flagged.length === 0) return clean;

  // .eer — raw by definition: an event-record file IS the frames
  const eer = flagged.filter((n) => /\.eer$/i.test(n));
  if (eer.length / names.length >= 0.5) {
    return {
      refusal: `CTF estimation needs motion-corrected micrographs, but ${eer.length} of ${names.length} rows are .eer electron event records — raw movies by definition, ctffind cannot read them at all. Run MotionCorr on them first (Import → MotionCorr → CTF) and wire ITS summed micrographs into this job.`,
      note: null,
    };
  }

  // below the t312 bar (≥50%) a smell is noise, not a wiring mistake
  if (flagged.length / names.length < 0.5) return clean;

  const examples = flagged.slice(0, 2).map((n) => path.basename(n)).join(", ");
  const more = flagged.length > 2 ? ` +${flagged.length - 2} more` : "";
  const sniffable = flagged.filter((n) => /\.(mrc|mrcs)$/i.test(n));
  if (sniffable.length === 0) {
    // tiffs/unknowns: the smell is real but the bytes can't settle it here
    return {
      refusal: null,
      note: `${flagged.length} of ${names.length} rows carry movie-stack naming (${examples}${more}) and their headers cannot be verified on this lane — if these are raw frame stacks run MotionCorr first; if they are already corrected, just proceed.`,
    };
  }

  // spread sample (first/middle/last) — one sniff covers a mixed folder
  const sample = spreadSample(sniffable);
  let verdicts: Record<string, SniffVerdict> = {};
  try {
    verdicts = await sniff(sample);
  } catch {
    verdicts = {}; // unverified — allow with the note below
  }

  const stacks = sample.filter((p) => verdicts[p]?.kind === "mrc-stack");
  if (stacks.length > 0) {
    const worst = verdicts[stacks[0]]!;
    const f = worst.facts!;
    const float16 = f.mode === 12 ? " float16" : "";
    return {
      refusal: `CTF estimation needs motion-corrected micrographs, but the header of ${path.basename(stacks[0])} says ${f.nz} sections × ${f.nx}×${f.ny} (mode ${f.mode}${float16}) — a raw FRAME stack, not a summed micrograph (${stacks.length} of ${sample.length} sampled rows verified, ${flagged.length} of ${names.length} rows carry movie naming). Run MotionCorr first (Import → MotionCorr → CTF) and wire ITS corrected micrographs into this job.`,
      note: null,
    };
  }

  const singles = sample.filter((p) => verdicts[p]?.kind === "mrc-single");
  if (singles.length > 0) {
    // the user's exact case: the name smells, the bytes say summed micrographs
    const f = verdicts[singles[0]]!.facts!;
    const float16Note =
      f.mode === 12
        ? " — float16 (mode 12): modern ctffind reads it, very old builds refuse it"
        : "";
    return {
      refusal: null,
      note: `${flagged.length} of ${names.length} rows carry movie-stack naming, but the sampled headers say single-section MRCs ${f.nx}×${f.ny} (mode ${f.mode})${float16Note} — motion-corrected micrographs, safe for CTF.`,
    };
  }

  // nothing verifiable came back (SSH hiccup, unreadable bytes)
  return {
    refusal: null,
    note: `${flagged.length} of ${names.length} rows carry movie-stack naming (${examples}${more}) and their headers could not be verified — if these are raw frame stacks run MotionCorr first; if they are already corrected, proceed.`,
  };
}

/**
 * LOCAL-lane HeaderSniffer: read the first 64 bytes straight off the disk.
 * A path that doesn't exist (e.g. a cluster-absolute row from a remote
 * import) simply reports "unknown" — the lane's own run will fail on it
 * soon enough with the real error.
 */
const localHeaderSniffer: HeaderSniffer = async (paths) => {
  const out: Record<string, SniffVerdict> = {};
  for (const p of paths) {
    let buf: Buffer | null = null;
    try {
      const fd = openSync(p, "r");
      try {
        const b = Buffer.alloc(64);
        const got = readSync(fd, b, 0, 64, 0);
        buf = got >= 16 ? b.subarray(0, got) : null;
      } finally {
        closeSync(fd);
      }
    } catch {
      buf = null;
    }
    out[p] = sniffImageFile(p, buf);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* t315 — cluster-resident inputs: the local lane refuses politely    */
/* ------------------------------------------------------------------ */

/** Types whose RELION binary READS the micrograph files named in the star
 *  (ctffind/motioncorr/autopick/extract/topaztrain open every row; a row
 *  that is not on this machine is a guaranteed per-file failure). */
const MIC_FILE_READERS = new Set([
  "ctffind",
  "motioncorr",
  "autopick",
  "extract",
  "topaztrain",
]);

/**
 * t317 — job types whose compute OPENS the particle image stacks referenced
 * by their input particles.star (class2d/refine3d/…). The cluster-resident
 * refusal now covers this family too: a remote project's IMPORT (Particles
 * node type) writes cluster-absolute stack refs, and a local spawn through
 * the WSL bridge would die per-particle — the exact Beijing failure shape,
 * through the new lane the t315 import door opened. Engine-native table
 * surgery (select/select2d/symexpand/rebalance/joinstar) is deliberately
 * ABSENT: those never open the stacks — they run locally by design even in
 * a remote project.
 */
const PARTICLE_STACK_READERS = new Set([
  "class2d",
  "class3d",
  "refine3d",
  "initialmodel",
  "multibody",
  "polish",
  "ctfrefine",
  "dynamight",
  "subtract",
  "tomo_ctfrefine",
  "tomo_polish",
]);

/**
 * t315 — a star whose rows are absolute paths that DO NOT exist on this
 * machine (a remote project's cluster-absolute /data06/… rows) fails every
 * single file read at run time: the Beijing WSL attempt died 195 times in
 * a row over exactly this ("cannot get CTF values" ×N in seconds, the
 * recorded command line wrapped in `wsl -d Debian -- bash -c {…}`). The
 * honest local answer is a refusal BEFORE the spawn, naming the door the
 * user actually wanted. Fires only at the majority bar (≥50% absolute AND
 * missing) — one relocated file is noise, not a wiring mistake; and only
 * for POSIX-absolute rows (local lanes carry project-relative or host-
 * style paths, which never trip the check).
 *
 * t317 — "missing" now speaks the BRIDGE's dialect too: on a Windows host
 * whose RELION lives in WSL, a local import writes WSL-VIEW rows
 * (/mnt/c/…, \\wsl.localhost\… sources), which never exist host-side. Each
 * row is translated back (wslToHost + the SAVED distro name) before the
 * existsSync verdict — a run that works through the bridge is no longer
 * refused as "files do not exist". Cluster-absolute rows (/data06/…)
 * translate to themselves on every platform — the Beijing hole stays
 * closed.
 */
function residentMissing(names: string[], projectId: string): string[] {
  const distro = savedWslDistro();
  const missing = names.filter(
    (n) =>
      n.startsWith("/") &&
      !existsSync(n) &&
      !existsSync(wslToHost(n, distro)) // bridged WSL-view row → host path
  );
  return missing;
}

function residentRefusalMessage(
  missing: string[],
  total: number,
  subject: string,
  projectId: string
): string {
  const example = missing[0];
  const more = missing.length > 1 ? ` (+${missing.length - 1} more)` : "";
  const bound = getProjectMeta(projectId)?.remote?.connectionId != null;
  if (bound) {
    return `This job reads the ${subject} files, but ${missing.length} of ${total} rows in the input star live on the CLUSTER (${example}${more}) — they are not on this machine, so a local run would fail on every single file. Dispatch this job to the cluster instead: Run ▸ "Run on cluster (SSH)…" (in a remote project the main Run button already does exactly that).`;
  }
  return `This job reads the ${subject} files, but ${missing.length} of ${total} rows in the input star do not exist on this machine (${example}${more}) — the files may have been moved, unmounted or deleted. Re-import them (Import ▸ Browse), or — if they live on an SSH cluster — bind the project to that cluster and run the job there.`;
}

export function clusterResidentRefusal(
  type: string,
  starPath: string | undefined,
  projectId: string
): string | null {
  if (!starPath || !MIC_FILE_READERS.has(type)) return null;
  let names: string[] = [];
  try {
    names = micrographNames(starPath);
  } catch {
    return null; // unreadable → the run itself will say the real problem
  }
  if (names.length === 0) return null;
  const missing = residentMissing(names, projectId);
  if (missing.length === 0 || missing.length / names.length < 0.5) return null;
  return residentRefusalMessage(missing, names.length, "micrograph", projectId);
}

/**
 * t317 — the particles twin of clusterResidentRefusal: the input
 * particles.star's _rlnImageName refs (idx@stack.mrcs) name stacks that
 * must exist where the compute runs. Same majority bar, same honest doors.
 */
export function clusterResidentParticlesRefusal(
  type: string,
  particlesStar: string | undefined,
  projectId: string
): string | null {
  if (!particlesStar || !PARTICLE_STACK_READERS.has(type)) return null;
  let names: string[] = [];
  try {
    names = particleStackNames(particlesStar);
  } catch {
    return null; // unreadable → the run itself will say the real problem
  }
  if (names.length === 0) return null;
  const missing = residentMissing(names, projectId);
  if (missing.length === 0 || missing.length / names.length < 0.5) return null;
  return residentRefusalMessage(missing, names.length, "particle stack", projectId);
}

/**
 * Build the `--topaz_train_picks` STAR for --topaz_train.
 *
 * The format is NOT a flat coordinate table: trainTopaz() treats every row
 * as (micrograph, its coordinate FILE) — it reads _rlnMicrographName +
 * _rlnMicrographCoordinates and then opens the referenced per-mic star to
 * count/read picks (autopicker.cpp trainTopaz: MDtrain.getValue(
 * EMDL_MICROGRAPH_COORDINATES) → MDpick.read(fn_pick)). The block name is
 * load-bearing too: MDtrain.read(picks, "coordinate_files") only accepts
 * the block named data_coordinate_files (metadata_table.cpp:1242).
 *
 * Auto-picking's PER-mic output stars (<stem>_autopick.star, columns
 * _rlnCoordinateX/Y = EMDL_IMAGE_COORD_X/Y) are exactly the files the
 * index points at — so the synthesis gathers the resolved file's siblings
 * and emits the two-column index, micrograph names matched by basename
 * stem against the input micrographs.star. A file that already carries
 * _rlnMicrographCoordinates passes through untouched. Returns the original
 * path on any parse hiccup (RELION then reports the real problem).
 *
 * Exported for the REMOTE layer (t265): a cluster dispatch must build this
 * index BEFORE staging — the cluster can't synthesize it (the argv-builder's
 * own re-synthesis degrades to a pass-through there, since a cluster path is
 * not readable from the local disk). See remote-run.ts.
 */
export function synthesizeTrainingPicks(pickFile: string, micrographsStar: string, outDir: string): string {
  try {
    const blocks = parseStarBlocks(readFileSync(pickFile, "utf8"));
    const loop = blocks.find((b) => b.lines.some((l) => l.trim() === "loop_"));
    if (!loop) return pickFile;
    const labels = loop.lines
      .filter((l) => l.trim().startsWith("_rln"))
      .map((l) => l.trim().split(/\s+/)[0]);
    if (labels.includes("_rlnMicrographCoordinates")) return pickFile; // already the index format
    // flat coordinate table (X/Y columns, no per-row file reference)
    if (!labels.includes("_rlnCoordinateX") || !labels.includes("_rlnCoordinateY")) return pickFile;

    // basename stem → canonical micrograph name from the input star
    const mics = micrographNames(micrographsStar);
    const byStem = new Map<string, string>();
    for (const m of mics) {
      const stem = path.basename(m).replace(/\.(mrc|mrcs|tif|tiff)$/i, "");
      if (!byStem.has(stem)) byStem.set(stem, m);
    }

    // per-mic coords are siblings of the resolved file — one index row each
    const dir = path.dirname(pickFile);
    const files = readdirSync(dir)
      .filter((f) => /_autopick\.star$/i.test(f) || f === path.basename(pickFile))
      .sort();

    const indexRows: string[] = [];

    // AutoPick-family branch ONLY when the resolved file is itself a
    // per-mic autopick star (…_autopick.star). A ManualPick flat table
    // (labels carry _rlnMicrographName + X + Y per row) must go through
    // the split branch below — the earlier sibling-scan caught
    // manualpick.star itself and forged a "micrographs/manualpick.mrc"
    // index row that does not exist (EMPIAR E2E, topaz train via
    // manualpick coords).
    const isAutoFamily = /_autopick\.star$/i.test(path.basename(pickFile));
    if (isAutoFamily && files.length > 0) {
      // AutoPick-style resolved file: point the index at the sibling stars
      for (const f of files) {
        const stem = f.replace(/_autopick\.star$/i, "").replace(/\.star$/i, "");
        const mic = byStem.get(stem) ?? `micrographs/${stem}.mrc`;
        indexRows.push(`${mic}    ${path.join(dir, f)}`);
      }
    } else if (labels.includes("_rlnMicrographName")) {
      // ManualPick-style flat table (mic name + X/Y per row): split it into
      // per-mic star files the index can reference — RELION's own manual
      // pipeline writes per-mic coordinate stars + this exact index shape.
      const im = labels.indexOf("_rlnMicrographName");
      const ix = labels.indexOf("_rlnCoordinateX");
      const iy = labels.indexOf("_rlnCoordinateY");
      if (im < 0 || ix < 0 || iy < 0) return pickFile;
      const perMic = new Map<string, string[]>(); // mic name → raw rows
      for (const line of loop.lines) {
        const t = line.trim();
        if (!t || t === "loop_" || t.startsWith("_rln") || t.startsWith("data_") || t.startsWith("#")) continue;
        const cols = t.split(/\s+/);
        const micRaw = cols[im];
        const x = Number(cols[ix]);
        const y = Number(cols[iy]);
        if (!micRaw || !Number.isFinite(x) || !Number.isFinite(y)) continue;
        // normalize against the input star's naming when the stem matches
        const stem = path.basename(micRaw).replace(/\.(mrc|mrcs|tif|tiff)$/i, "");
        const mic = byStem.get(stem) ?? micRaw;
        const arr = perMic.get(mic) ?? [];
        arr.push(`${x.toFixed(3)}    ${y.toFixed(3)}`);
        perMic.set(mic, arr);
      }
      if (perMic.size === 0) return pickFile;
      const coordDir = path.join(outDir, "training_coords");
      mkdirSync(coordDir, { recursive: true });
      for (const [mic, rows] of perMic) {
        const stem = path.basename(mic).replace(/\.(mrc|mrcs|tif|tiff)$/i, "");
        const fn = path.join(coordDir, `${stem}_picks.star`);
        writeFileSync(
          fn,
          [
            "",
            "# version 50001",
            "",
            "data_",
            "",
            "loop_",
            "_rlnCoordinateX #1",
            "_rlnCoordinateY #2",
            ...rows,
            "",
          ].join("\n")
        );
        indexRows.push(`${mic}    ${fn}`);
      }
    } else {
      return pickFile; // unrecognized shape — let RELION explain
    }

    // the caller's outDir is NOT guaranteed to exist — the LOCAL flow has
    // the job workdir in place by argv-build time, but the REMOTE flow (t265)
    // synthesizes BEFORE staging, into a workdir nothing has created yet.
    // writeFileSync would ENOENT here and the catch below would silently
    // hand RELION the raw flat star — the exact bug the t265 e2e caught.
    mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, "training_picks.star");
    writeFileSync(
      out,
      [
        "",
        "# version 50001",
        "",
        // block name is load-bearing (see docblock)
        "data_coordinate_files",
        "",
        "loop_",
        "_rlnMicrographName #1",
        "_rlnMicrographCoordinates #2",
        ...indexRows,
        "",
      ].join("\n")
    );
    return out;
  } catch {
    return pickFile;
  }
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

/**
 * t340 — the engine-native IN-FLIGHT record + phase log.
 *
 * The field report that convicted the gap: a 325k-particle cs → star
 * conversion (download .cs → convert → 10k+ selective links over SSH) runs
 * IN-PROCESS for minutes, and `recordNativeRun` only writes the run record
 * at the very END. The jobs-GET reconcile sweep flips any "running" row
 * with NO engine record and startedAt older than 120 s to
 * "stale running state (no engine record) — re-run" — so the marathon
 * native first showed FAILED with no log (none existed yet), then flipped
 * to COMPLETED when the promise finally resolved. Exactly the user's
 * 「运行时先出现了失败（超时了没有返回log？），之后又成功了？」.
 *
 * beginNativeRun closes the window: the record exists from second zero
 * (pid = the SERVER process — alive for the whole in-process run, so the
 * sweep's liveness check passes), run.out carries live phase lines the
 * inspector's Log tab can tail, and the previous record's outputs ride
 * along so a re-run mid-flight never strands downstream consumers.
 * recordNativeRun overwrites on success; abortNativeRun marks done+exit 1
 * on an honest failure (restoring the previous outputs — a failed re-run
 * must not erase the last good import's registry entry), and a server
 * restart leaves the familiar "interrupted" verdict via the sweep.
 */
function beginNativeRun(
  job: EngineJobRef,
  label: string
): { prevOutputs: Record<string, string>; prevResult: string | null } {
  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const logFile = path.join(workdir, "run.out");
  const errFile = path.join(workdir, "run.err");
  const prev = getRun(job.id);
  try {
    appendFileSync(logFile, `\nCryoFlow ${label} — started ${new Date().toISOString()}\n`);
  } catch {
    /* the log is a witness, never the run */
  }
  try {
    writeFileSync(errFile, "");
  } catch {
    /* same doctrine */
  }
  upsertRun(job.id, {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    pid: process.pid,
    cmd: `${label} (in flight)`,
    workdir,
    logFile,
    errFile,
    startedAt: new Date().toISOString(),
    outputs: prev?.outputs ?? {},
    done: false,
    exitCode: null,
    result: null,
  });
  return { prevOutputs: prev?.outputs ?? {}, prevResult: prev?.result ?? null };
}

/** A native run that ended in an honest refusal/crash: close the record
 * (done + exit 1 + the error as result) WITHOUT erasing the previous run's
 * outputs — the registry keeps what the last successful run produced. */
function abortNativeRun(
  jobId: string,
  error: string,
  prevOutputs: Record<string, string>
): void {
  updateRun(
    jobId,
    (rec) =>
      rec.done === false && rec.exitCode == null
        ? {
            ...rec,
            done: true,
            exitCode: 1,
            result: `engine-native run aborted: ${error}`.slice(0, 400),
            outputs: prevOutputs,
          }
        : null
  );
}

/** t340 — append one phase line to the native run's log (the inspector's
 * Log tab tails run.out; a marathon with no interim lines reads as dead).
 * Never throws: the witness must not be able to kill the run. */
function nativePhaseLog(workdir: string, line: string): void {
  try {
    appendFileSync(path.join(workdir, "run.out"), `${line}\n`);
  } catch {
    /* witness doctrine */
  }
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
  upsertRun(job.id, {
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
  });
}

/**
 * t382 — the import twin gate: two image files whose extension-stripped
 * names compose the SAME per-micrograph particle stack (X.mrc + X.mrcs —
 * the user's *_Fractions_DW dataset holds the corrector's .mrc sums AND
 * .mrcs aligned movie stacks on one basename) can never coexist in a star
 * that feeds relion_preprocess: the extraction writes
 * <part_dir>/<mic-minus-extension>.mrcs, so the twins target one file and
 * the run dies mid-way ("write: target and source objects have different
 * size", image.h:1534 — with an array split, two shards race on the one
 * stack; single-process it silently double-extracts). The t333 census NOTE
 * taught this at import time; the t334/t382 scans taught it at extract
 * time; this door REFUSES it at the source. Returns the refusal or null.
 */
function importTwinGate(files: string[]): { error: string } | null {
  const byKey = new Map<string, string[]>();
  for (const f of files) {
    const k = extractStackKey(f.replace(/\\/g, "/"));
    const g = byKey.get(k);
    if (g) g.push(f);
    else byKey.set(k, [f]);
  }
  const twins = [...byKey.values()].filter((g) => g.length > 1);
  if (twins.length === 0) return null;
  const base = (p: string) => {
    const n = p.replace(/\\/g, "/");
    return n.slice(n.lastIndexOf("/") + 1);
  };
  const shown = twins
    .slice(0, 3)
    .map((g) => g.map(base).join(" + "))
    .join("; ");
  return {
    error:
      `${twins.length} basename(s) hold the SAME micrograph under different extensions (${shown}${twins.length > 3 ? ` +${twins.length - 3} more` : ""}) — ` +
      `extraction names each micrograph's particle stack after the path WITHOUT its extension, so these twins compose ONE stack file and the run dies mid-way ("write: target and source objects have different size", image.h:1534). ` +
      `Re-import with the exact extension pattern (e.g. *_DW.mrc, not *_DW.mrc*) so one basename lands once`,
  };
}

/**
 * t300 — the REMOTE-project leg of the engine-native import. The picked
 * micrographsPath points at the CLUSTER's filesystem (chosen with the
 * remote browser); the data NEVER leaves the cluster:
 *
 *   - the path is validated + enumerated over SSH (folder / wildcard /
 *     multi-file list — the same three shapes the local branch speaks);
 *   - micrographs.star is written with CLUSTER-ABSOLUTE paths. When a
 *     downstream job is dispatched to the SAME cluster, the staging walk
 *     finds the refs already present there (refsInStar only collects refs
 *     that exist LOCALLY — cluster-absolute refs ride untouched), so not
 *     one movie byte is uploaded; the argv references the cluster paths
 *     exactly as written.
 *
 * Returns "not-remote" when the project has no cluster binding (the local
 * branch runs), an error result when the cluster cannot answer, and the
 * star lines + display strings on success.
 */
async function runImportRemoteLeg(
  job: EngineJobRef,
  customRaw: string,
  starLines: string[],
  /**
   * t319 — phase witness for the import's own progress bar (the job runs
   * in-process; the row sits "running" for the whole SSH listing/stat/sniff
   * marathon and used to show a dead 0% the entire time). Percentages of
   * the WHOLE import; the native leg tops up to 90 at star-write time.
   */
  onProgress?: (pct: number) => void
): Promise<
  | { kind: "not-remote" }
  | { kind: "error"; error: string }
  | { kind: "done"; result: string; sourceLabel: string }
> {
  const phase = (pct: number) => {
    try {
      onProgress?.(pct);
    } catch {
      /* a witness never breaks the import */
    }
  };
  const meta = getProjectMeta(job.projectId);
  const connId = meta?.remote?.connectionId ?? null;
  if (!connId) return { kind: "not-remote" };
  const conn = getConnection(connId);
  if (!conn || !conn.host) {
    return {
      kind: "error",
      error:
        "this is a remote project, but its cluster connection was deleted — re-add the cluster in Remote clusters (the picked paths live on it)",
    };
  }

  const listed = customRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const multiFile = listed.length > 1;
  const single = listed[0] ?? "";
  const isPattern = !multiFile && /[*?]/.test(single);
  const base = (p: string) => p.slice(p.lastIndexOf("/") + 1);

  let clusterFiles: string[] = [];
  let skipped = 0;
  let note = "";

  try {
    if (multiFile) {
      // ---- 3. explicit multi-select file list --------------------------
      // t319 — per-batch witness: a 1034-file pick runs ~6 stat rounds of
      // 200; the bar moves with every round instead of sitting dead at 0.
      const { missing } = await statRemoteFiles(conn, listed, (f) =>
        phase(Math.round(5 + f * 30))
      );
      phase(35);
      if (missing.length > 0) {
        return {
          kind: "error",
          error: `Not on the cluster: ${missing[0]}${missing.length > 1 ? ` (+${missing.length - 1} more)` : ""} — re-pick the micrographs in the params tab (Browse → Files)`,
        };
      }
      for (const f of listed) {
        if (MIC_RE.test(base(f))) clusterFiles.push(f);
        else skipped += 1;
      }
      // t382 — the same path picked twice writes the same STAR row twice
      // (a silent double-extraction downstream): dedupe the explicit list.
      {
        const seen = new Set<string>();
        clusterFiles = clusterFiles.filter((f) => {
          if (seen.has(f)) return false;
          seen.add(f);
          return true;
        });
      }
    } else if (isPattern) {
      // ---- 2. wildcard pattern (RELION "File name pattern") -------------
      // t311 — the enumeration is UNCAPPED at the browser's 400: the import
      // leg lists up to REMOTE_IMPORT_MAX_ENTRIES (default 20,000) so the
      // pattern's EVERY match lands in the STAR (the dialog's preview may
      // cap at 400 rows — it says so, and "import takes them all" is now
      // literally true).
      const i = single.lastIndexOf("/");
      const baseDir = i === 0 ? "/" : single.slice(0, i);
      const glob = single.slice(i + 1);
      const res = await listRemoteDir(connId, baseDir, glob, {
        max: REMOTE_IMPORT_MAX_ENTRIES,
        timeoutMs: 60_000,
      });
      if (res.notDir) {
        return { kind: "error", error: `Folder not found on the cluster: ${baseDir} — check the pattern in the params tab` };
      }
      const imgs = res.entries.filter((e) => e.img && e.abs).map((e) => e.abs!);
      clusterFiles = imgs;
      skipped = Math.max(0, res.total - imgs.length);
      phase(35);
      if (res.truncated) note = ` · pattern matched ${res.total.toLocaleString()} files — import capped at ${REMOTE_IMPORT_MAX_ENTRIES.toLocaleString()} (narrow the pattern)`;
    } else {
      // ---- 1. folder (or one pasted file) -------------------------------
      // t311 — same uncapped enumeration: a folder with 2,341 movies imports
      // 2,341 rows (the old shared 400 cap imported the first 400 and the
      // user noticed the missing photos).
      const res = await listRemoteDir(connId, single, null, {
        max: REMOTE_IMPORT_MAX_ENTRIES,
        timeoutMs: 60_000,
      });
      if (res.notDir) {
        // maybe a single FILE path was pasted — stat it before refusing
        const { missing } = await statRemoteFiles(conn, [single]);
        if (missing.length > 0) {
          return {
            kind: "error",
            error: `Micrographs folder not accessible on the cluster: ${customRaw} — re-pick it in the params tab (Browse…)`,
          };
        }
        if (!MIC_RE.test(base(single))) {
          return {
            kind: "error",
            error: `Not a micrograph file (.mrc/.mrcs/.tif/.tiff/.eer): ${single}`,
          };
        }
        clusterFiles = [single];
      } else {
        const imgs = res.entries.filter((e) => e.img && e.abs).map((e) => e.abs!);
        skipped = Math.max(0, res.total - imgs.length);
        if (imgs.length === 0) {
          return {
            kind: "error",
            error: `No .mrc/.mrcs/.tif/.eer micrographs found in ${customRaw} (on ${conn.host})`,
          };
        }
        clusterFiles = imgs;
        phase(35);
        if (res.truncated) note = ` · folder holds ${res.total.toLocaleString()} entries — import capped at ${REMOTE_IMPORT_MAX_ENTRIES.toLocaleString()} (import a subfolder or pattern instead)`;
      }
    }
  } catch (e) {
    return {
      kind: "error",
      error: `the cluster (${conn.host}) could not list ${single || customRaw}: ${e instanceof Error ? e.message : String(e)} — check the connection in Remote clusters`,
    };
  }

  if (clusterFiles.length === 0) {
    return {
      kind: "error",
      error: multiFile
        ? `No image files (.mrc/.mrcs/.tif/.tiff/.eer) among the ${listed.length} selected paths`
        : `No image files (.mrc/.mrcs/.tif/.tiff/.eer) match ${single}`,
    };
  }

  // t382 — the twin gate at the source door: extension twins on one
  // basename compose the same extraction stack (image.h:1534) — refuse
  // the IMPORT, not the extraction three jobs later.
  const twinGate = importTwinGate(clusterFiles);
  if (twinGate) return { kind: "error", error: twinGate.error };

  // CLUSTER-ABSOLUTE paths — the whole point: downstream remote runs on
  // this cluster reference them exactly as written, zero staging bytes.
  for (const f of clusterFiles) starLines.push(`${f} 1`);

  // ---- t313 — the header sniff: facts, not filename guesses -------------
  // One SSH round trip, three spread files: the import result now SAYS
  // what the bytes are (single-section micrographs vs frame stacks vs
  // .eer records). The Beijing user imported motion-corrected
  // *_Fractions_DW.mrc micrographs — MotionCor2 keeps the movie's basename
  // — and the platform owed them the receipt, not a naming-based lecture.
  // The sniff is a bonus: any failure leaves the note empty, never blocks.
  let sniffNote = "";
  // t315 — the sniff verdict also feeds the NODE TYPE cross-check: picking
  // "Micrographs" while the headers say frame stacks (or "Movies" while
  // they say single-section) deserves a receipt-level heads-up — the byte
  // gate at CTF dispatch remains the enforcement, this only teaches.
  let sniffStacks = false;
  let sniffSingles = false;
  try {
    if (conn) {
      const mrcs = clusterFiles.filter((f) => /\.(mrc|mrcs)$/i.test(f));
      const eers = clusterFiles.filter((f) => /\.eer$/i.test(f));
      if (eers.length > 0 && eers.length / clusterFiles.length >= 0.5) {
        sniffNote = " · .eer event records — raw movies, run MotionCorr before CTF";
        sniffStacks = true;
      } else if (mrcs.length > 0) {
        const verdicts = await remoteHeaderSniffer(conn)(spreadSample(mrcs));
        const vs = Object.values(verdicts);
        const stacks = vs.filter((v) => v.kind === "mrc-stack");
        const singles = vs.filter((v) => v.kind === "mrc-single");
        if (stacks.length > 0) {
          const f = stacks[0].facts!;
          sniffNote = ` · headers (${vs.length} sampled): ${f.nz}-section frame stacks — raw movies, run MotionCorr before CTF`;
          sniffStacks = true;
        } else if (singles.length > 0) {
          const f = singles[0].facts!;
          const m16 = f.mode === 12 ? " float16" : "";
          sniffNote = ` · headers (${vs.length} sampled): single-section MRCs ${f.nx}×${f.ny} (mode ${f.mode}${m16}) — motion-corrected micrographs, CTF-ready`;
          sniffSingles = true;
        }
      }
    }
  } catch { /* the sniff is a receipt, never a gate */ }
  phase(60);

  const skipNote = skipped > 0 ? ` · ${skipped} non-image file${skipped === 1 ? "" : "s"} skipped` : "";
  const kindNote = isPattern ? " · pattern" : multiFile ? " · file list" : "";
  const nodeType = String(job.params.nodeType ?? "micrographs");
  const kindWord = nodeType === "movies" ? "movies" : "micrographs";
  const mismatch =
    nodeType === "micrographs" && sniffStacks
      ? " · ⚠ Node type says Micrographs but the sampled headers say FRAME STACKS — wire MotionCorr before CTF"
      : nodeType === "movies" && sniffSingles
        ? " · Node type says Movies but the sampled headers say single-section (already motion-corrected) — CTF can consume these directly; MotionCorr would refuse them"
        : "";
  // t333 — the extension census: a glob like *_Fractions_DW.mrc* sweeps in
  // BOTH the corrector's outputs (.mrc sums AND .mrcs aligned movie stacks).
  // The 6-file header sniff can miss the minority kind, so the receipt also
  // states the extension split outright — the Beijing import was 865 .mrcs +
  // 169 .mrc and nobody said so until extract died at image.h:1534.
  const mrcCount = clusterFiles.filter((f) => /\.mrc$/i.test(f)).length;
  const mrcsCount = clusterFiles.filter((f) => /\.mrcs$/i.test(f)).length;
  const censusNote =
    mrcCount > 0 && mrcsCount > 0
      ? ` · ⚠ mixed extensions: ${mrcCount} .mrc + ${mrcsCount} .mrcs — the .mrcs are usually the corrector's ALIGNED MOVIE STACKS (frames), not micrographs; extract writes each micrograph's particle stack after the path WITHOUT its extension, so an X.mrc + X.mrcs pair would write the SAME stack file (the "write: target and source objects have different size" abort). Unless the .mrcs files are genuinely single-image, re-import with the exact .mrc pattern`
      : "";
  return {
    kind: "done",
    result: `${clusterFiles.length} ${kindWord} imported from ${conn.name || conn.host}${kindNote}${skipNote}${note}${sniffNote}${mismatch}${censusNote} — paths stay on the cluster (zero upload) · pixel ${String(job.params.pixelSize ?? 1.77)} Å`,
    sourceLabel: `source (cluster ${conn.host}): ${customRaw.slice(0, 200)} — cluster-absolute paths`,
  };
}

/** Import: writes a RELION 5 optics-group micrographs.star (EMPIAR or empty). */
async function runImportNative(job: EngineJobRef): Promise<NativeResult> {
  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const projectDir = projectDirFor(job);
  mkdirSync(projectDir, { recursive: true });

  // t315 — RELION's import "Node type" door: micrographs (motion-corrected,
  // CTF-ready), movies (raw frame stacks, MotionCorr first) or particles
  // (an existing particles .star, local or cluster-side). The first two
  // share the folder/pattern/file-list machinery; particles is its own leg.
  const nodeType = String(job.params.nodeType ?? "micrographs");
  if (nodeType === "particles") {
    return runImportParticlesNative(job, workdir, projectDir);
  }
  const kindWord = nodeType === "movies" ? "movies" : "micrographs";

  const pixel = num(job, "pixelSize", 1.77);
  const kV = num(job, "voltage", 300);
  const cs = num(job, "cs", 2.7);
  const q0 = num(job, "ampContrast", 0.1);
  const empiar =
    String(job.params.empiarData ?? "") === "true" &&
    !String(job.params.micrographsPath ?? "").trim();

  const starPath = path.join(workdir, "micrographs.star");
  // t319 — the import's own progress: the row sits "running" for the whole
  // listing/stat/sniff/write marathon and used to show a dead 0% until the
  // 100% flip at finalize. Status-guarded so it can never touch a row that
  // a concurrent finalize/stopped path already settled.
  const setProgress = (pct: number) =>
    db.job
      .updateMany({ where: { id: job.id, status: "running" }, data: { progress: pct } })
      .catch(() => null);
  const nodeTypeForStar = String(job.params.nodeType ?? "micrographs");
  const isMoviesImport = nodeTypeForStar === "movies";
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
    ...(isMoviesImport
      ? // t372 — RELION's movies convention: the real relion_run_motioncorr
        // requires rlnMicrographOriginalPixelSize in the optics group
        // (motioncorr_runner.cpp:308-315 hard-errors otherwise; bin_factor
        // then scales it to the working pixel size)
        ["_rlnMicrographOriginalPixelSize #7"]
      : []),
    `1 optGroup1 ${pixel} ${kV} ${cs} ${q0}${isMoviesImport ? ` ${pixel}` : ""}`,
    "",
    // t372 — the REAL relion_run_motioncorr demands the movies convention
    // (motioncorr_runner.cpp:261 hard-errors "does not contain the
    // rlnMicrographMovieName column. Are you sure you imported files as
    // movies…"). The python stub accepted any column, so this lane had
    // silently written a micrographs-shaped star for movies imports —
    // caught live by the real-binary EMPIAR chain.
    isMoviesImport ? "data_movies" : "data_micrographs",
    "",
    "loop_",
    isMoviesImport ? "_rlnMicrographMovieName #1" : "_rlnMicrographName #1",
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
    // t311 — ensureEmpiarLink: a link that previously pointed at this import
    // source may sit there DANGLING (the target was burned/cleaned underneath
    // it — observed live: a suite's mirror dir gone, the demo project's
    // micrographs link left swinging). existsSync(dangling) is FALSE, so a
    // naive guard falls through to symlinkSync and dies with EEXIST — the
    // import crashed as a bare 500 instead of re-pointing. lstat does not
    // follow the link, so the stale shape is visible and re-pointable; a REAL
    // directory with the user's own content is left untouched.
    const ensureEmpiarLink = (linkPath: string) => {
      try {
        const st = lstatSync(linkPath);
        if (st.isDirectory() && !st.isSymbolicLink()) return; // real dir — not ours to move
        rmSync(linkPath, { force: true, recursive: st.isDirectory() });
      } catch {
        /* nothing there yet — fall through and link */
      }
      try {
        symlinkSync(EMPIAR_DIR, linkPath);
      } catch {
        /* lost a race and the link is already in place */
      }
    };
    const micLink = path.join(projectDir, "micrographs");
    ensureEmpiarLink(micLink);
    // Also expose the micrographs inside the import job's own workdir so the
    // Files tab + gallery can serve PNG previews through outputs/file.
    const micLinkInWorkdir = path.join(workdir, "micrographs");
    ensureEmpiarLink(micLinkInWorkdir);
    void setProgress(60);
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
      // ---- t300: remote project? the path names the CLUSTER's filesystem --
      const remoteLeg = await runImportRemoteLeg(job, customRaw, lines, (pct) => {
        void setProgress(pct);
      });
      if (remoteLeg.kind === "error") {
        return { ok: false, error: remoteLeg.error };
      }
      if (remoteLeg.kind === "done") {
        result = remoteLeg.result;
        sourceLabel = remoteLeg.sourceLabel;
        void setProgress(75);
      } else {
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
          // t277 — the folder's non-image entries are COUNTED, not silently
          // swallowed. The explicit file list and the wildcard pattern always
          // reported their skips; the folder branch (the shape every demo and
          // every EMPIAR bundle takes) filtered in silence — the t276 fidelity
          // suite's ground truth (10 real mrcs + 10 real Henderson coords in
          // ONE directory) is exactly the world where the silence misleads.
          const entries = readdirSync(hostDir);
          const mrcs = entries.filter((f) => MIC_RE.test(f)).sort();
          skipped = entries.length - mrcs.length;
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

      // t382 — an explicit multi-select may list the same path twice (the
      // same pick double-counted): dedupe before the twin gate — identical
      // rows are an obvious intent, DISTINCT files on one basename are not.
      if (multiFile) {
        const seen = new Set<string>();
        hostFiles = hostFiles.filter((f) => {
          if (seen.has(f)) return false;
          seen.add(f);
          return true;
        });
      }
      // t382 — the twin gate at the source door (the local lane's own copy
      // of the remote leg's refusal).
      const twinGate = importTwinGate(hostFiles);
      if (twinGate) return { ok: false, error: twinGate.error };

      void setProgress(60); // local source listed — the link/write phases remain
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
      result = `${hostFiles.length} ${kindWord} imported${kindNote}${skipNote}${linkNote} (pixel ${pixel} Å)`;
      if (!sourceLabel) {
        sourceLabel =
          "source: " +
          (isPattern ? "pattern " : multiFile ? `${listed.length} selected files — ` : "") +
          customRaw.slice(0, 200) +
          (unlinked > 0 ? " (absolute paths)" : "");
      }
      } // end local branch (project not remote)
    } else {
      result = "Import job completed (no source data configured — pick a micrographs folder, pattern or files in the params tab)";
      sourceLabel = "source: (none configured)";
    }
  }

  void setProgress(90); // star write is the last mile — finalize flips 100
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

/* ------------------------------------------------------------------ */
/* t315 — Import (Node type: Particles)                                 */
/* ------------------------------------------------------------------ */

/**
 * What a source particles STAR is made of, and what our copy did to it.
 */
interface ParticlesStarFacts {
  /** data rows that carry at least one image reference (the particles —
   *  an optics row like "1 0.93 48" is structure, not a particle) */
  rows: number;
  /** image-reference tokens seen (idx@stack.mrcs or bare paths) */
  imageRefs: number;
  /** REFERENCE tokens that were relative and got rebased to absolute */
  rebased: number;
  /** references that stayed verbatim (already absolute) */
  verbatim: number;
}

/**
 * Validate + rebase a particles STAR's text. Validation is by DIALECT: a
 * star carrying _rlnMicrographName WITHOUT _rlnImageName is a micrographs
 * star (wrong node type — refuse with the switch instruction); a star with
 * no image references at all is not a particles star. Rebase rule (t313's
 * relocation lesson): any RELATIVE image reference resolves against the
 * SOURCE star's own directory and is rewritten absolute — our copy lives in
 * a different directory, so verbatim relative rows would dangle. Absolute
 * rows ride verbatim (cluster-absolute rows are the zero-upload contract).
 *
 * t317 — the dialect refusal only fires when _rlnImageName is ABSENT: some
 * legacy/toolsome particles STARs carry _rlnMicrographName ALONGSIDE
 * _rlnImageName (per-row provenance columns), and refusing those rejected
 * legitimate particles files.
 */
function rebaseParticlesStar(
  text: string,
  sourceDir: string,
  toEngine: (p: string) => string
): { error?: string; facts?: ParticlesStarFacts; lines?: string[] } {
  if (/_rlnMicrographName\s/.test(text) && !/_rlnImageName\s/.test(text)) {
    return {
      error:
        "that STAR describes MICROGRAPHS (it carries _rlnMicrographName), not particles — switch the Import job's Node type to Micrographs and point at the image folder instead",
    };
  }
  const IMG_TOK = /^(?:\d+@)?(\S+\.(?:mrc|mrcs|tif|tiff|img))$/i;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  const facts: ParticlesStarFacts = { rows: 0, imageRefs: 0, rebased: 0, verbatim: 0 };
  let inLoop = false;
  for (const raw of lines) {
    const t = raw.trim();
    if (t === "loop_") {
      // a loop_ OPENS the row region — the _rln label lines that follow are
      // still inside it (the first version reset inLoop on every label and
      // the data rows never registered)
      inLoop = true;
      out.push(raw);
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      out.push(raw);
      continue;
    }
    const isStructural =
      t === "" ||
      t.startsWith("#") ||
      t.startsWith("_");
    if (inLoop && !isStructural) {
      // a data row inside a loop_ block
      const tokens = t.split(/\s+/);
      let touched = false;
      let hadImageRef = false;
      const mapped = tokens.map((tok) => {
        const m = IMG_TOK.exec(tok);
        if (!m) return tok;
        facts.imageRefs += 1;
        hadImageRef = true;
        const ref = m[1];
        if (ref.startsWith("/")) {
          facts.verbatim += 1;
          return tok; // absolute (cluster-absolute included) rides verbatim
        }
        // relative → absolute against the SOURCE star's directory, then the
        // engine-side view (WSL translation on bridged hosts)
        const abs = toEngine(`${sourceDir.replace(/\/$/, "")}/${ref}`);
        facts.rebased += 1;
        touched = true;
        const at = tok.indexOf("@");
        return at >= 0 ? `${tok.slice(0, at + 1)}${abs}` : abs;
      });
      if (hadImageRef) facts.rows += 1;
      out.push(mapped.join(" "));
      if (!touched) out[out.length - 1] = raw; // nothing rebased → verbatim row
      continue;
    }
    out.push(raw);
  }
  if (facts.rows === 0 || facts.imageRefs === 0) {
    return {
      error:
        "that file does not look like a RELION particles STAR — no image references (idx@stack.mrcs or image paths) were found in any data block",
    };
  }
  return { facts, lines: out };
}

/**
 * t315 — Import Node type "Particles": bring an existing particles STAR
 * (RELION's own "Import particles" door) into the project. The copy keeps
 * every non-image column and the optics block VERBATIM; image references
 * are rebased absolute (see rebaseParticlesStar). A remote project reads
 * the source over SSH and keeps cluster-absolute rows as-is — the
 * zero-upload contract, identical to the micrographs leg.
 */
async function runImportParticlesNative(
  job: EngineJobRef,
  workdir: string,
  projectDir: string
): Promise<NativeResult> {
  void projectDir; // (the copy is self-contained — no project-level linking)
  const raw = String(job.params.micrographsPath ?? "").trim();
  if (!raw) {
    return {
      ok: false,
      error:
        "Node type Particles needs a particles .star — pick one in the params tab (Browse → Files, or paste its path; on a remote project pick it from the cluster browser)",
    };
  }
  const meta = getProjectMeta(job.projectId);
  const connId = meta?.remote?.connectionId ?? null;
  const conn = connId ? getConnection(connId) : null;
  if (connId && !conn) {
    return {
      ok: false,
      error:
        "this is a remote project, but its cluster connection was deleted — re-add the cluster in Remote clusters (the picked paths live on it)",
    };
  }

  const starPath = path.join(workdir, "particles.star");
  let sourceText: string;
  let sourceDir: string;
  let toEngine: (p: string) => string;
  let origin: string;

  if (conn) {
    // ---- remote project: the path names the CLUSTER's filesystem --------
    const q = raw.replace(/'/g, "'\\''");
    const r = await sshExec(conn, `cat '${q}'`, { timeoutMs: 30_000 }).catch(() => null);
    if (!r || r.code !== 0 || !r.stdout.trim()) {
      return {
        ok: false,
        error: `could not read ${raw} on ${conn.host}${r?.stderr ? ` (${r.stderr.trim().split("\n")[0].slice(0, 160)})` : ""} — re-pick the particles .star in the params tab`,
      };
    }
    sourceText = r.stdout;
    // t317 — the dir half of the cluster path, edge-honest: a slashless
    // path ("particles.star") resolves refs against "."; a ROOT-level file
    // ("/x.star") against "/" — the old `lastIndexOf("/") || undefined`
    // idiom made the first chop the string's tail and the second use the
    // FILE as its own directory (refs rebased under the file).
    {
      const cut = raw.lastIndexOf("/");
      sourceDir = cut > 0 ? raw.slice(0, cut) : cut === 0 ? "/" : ".";
    }
    toEngine = (p) => p; // cluster paths stay cluster-side verbatim
    origin = `cluster ${conn.name || conn.host}`;
  } else {
    // ---- local project: host-side read, engine-view rebase --------------
    const status = await detectRelion();
    const bridge = bridgeFromStatus(status);
    const host = userPathToHost(raw, bridge?.distro ?? null);
    let text: string;
    try {
      text = readFileSync(host, "utf8");
    } catch {
      return {
        ok: false,
        error: `particles .star not accessible: ${raw} — re-pick it in the params tab (Browse → Files)`,
      };
    }
    sourceText = text;
    const hostDir = path.dirname(host);
    sourceDir = hostDir.split(path.sep).join("/");
    toEngine = (p) => (bridge ? hostToWsl(p) : p);
    origin = "local";
  }

  const rebased = rebaseParticlesStar(sourceText, sourceDir, toEngine);
  if (rebased.error || !rebased.facts || !rebased.lines) {
    return { ok: false, error: rebased.error ?? "the particles .star could not be parsed" };
  }
  const facts = rebased.facts;
  writeFileSync(starPath, rebased.lines.join("\n") + "\n");

  const refNote =
    facts.rebased > 0
      ? ` · ${facts.rebased} relative image refs rebased absolute`
      : " · image refs kept verbatim (already absolute)";
  const result = `${facts.rows} particles imported from a ${origin} STAR${refNote} — optics columns preserved from the source`;
  const logText = [
    `CryoFlow engine-native import (particles) ${new Date().toISOString()}`,
    `source: ${raw.slice(0, 200)} (${origin})`,
    `rows=${facts.rows} imageRefs=${facts.imageRefs} rebased=${facts.rebased} verbatim=${facts.verbatim}`,
    `output: ${starPath}`,
    result,
    "",
  ].join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: copy particles.star (refs rebased absolute)",
    { particles_star: starPath },
    result,
    logText
  );
  return { ok: true, result };
}

/**
 * t360 — the REMOTE-project leg of the map import (the field report: import
 * map on a cluster project pointed at /data03/…/cryosparc_…_volume_map.mrc
 * and died "Map file not accessible" — runMapImportNative's existsSync only
 * ever looked at the app's own disk). The picked mapPath names the CLUSTER's
 * filesystem; the map bytes never cross the app↔cluster link:
 *
 *   - readability + the file size + the 1024-byte MRC header are probed in
 *     ONE SSH round trip (stat + `head -c 1024 | base64`) — a missing path,
 *     a directory and a no-read-permission source each answer with their
 *     own honest verdict, and READ permission is all the source ever needs;
 *   - the map is materialized into the job's CLUSTER TWIN by a cluster-side
 *     `cp` (remoteRoot/<projectId>/mapimport_<id8>/<basename>) — the copy
 *     runs on the cluster itself, byte-verified by stat before anything is
 *     recorded (the t352/t353 cs2star twin doctrine: zero upload, zero
 *     download, works against a read-only source directory);
 *   - the run record carries the LOCAL mirror path as its output and the
 *     verified twin as remoteOutputs.model_mrc — a downstream cluster job
 *     resolves through the twin in place (staging skips, argv points at
 *     the cluster copy), and the Files tab lists the map as an on-cluster
 *     card through the manifest, fetchable on demand.
 */
async function runMapImportRemoteLeg(
  job: EngineJobRef,
  workdir: string,
  raw: string,
  conn: RemoteConnection
): Promise<NativeResult> {
  const q = raw.replace(/'/g, "'\\''");
  const name = raw.slice(raw.lastIndexOf("/") + 1) || "map.mrc";

  // ---- probe: readable? size? header? — one round trip -------------------
  // three distinct sentinels so the failure names its own reason (the
  // user's first question was「是权限问题？」 — the answer must say which)
  const probeScript =
    `f='${q}'; if [ ! -e "$f" ]; then echo __CF_MAP_MISSING__; ` +
    `elif [ ! -f "$f" ]; then echo __CF_MAP_DIR__; ` +
    `elif [ ! -r "$f" ]; then echo __CF_MAP_NOREAD__; ` +
    `else stat -c '%s' "$f"; head -c 1024 "$f" | base64 | tr -d '\\n'; echo; fi`;
  let size = -1;
  let head: MrcHeader | null = null;
  let verdict = "";
  let probeWhy = "";
  try {
    const r = await sshExec(conn, probeScript, { timeoutMs: 30_000 });
    const lines = (r.stdout ?? "").split(/\r?\n/);
    if (lines[0] === "__CF_MAP_MISSING__" || lines[0] === "__CF_MAP_DIR__" || lines[0] === "__CF_MAP_NOREAD__") {
      verdict = lines[0];
    } else if ((r.stdout ?? "").trim().length === 0) {
      probeWhy =
        (r.stderr || r.error || `ssh exit ${r.code}`).split("\n").filter(Boolean).slice(-1)[0] ??
        "no word from the cluster";
    } else {
      const n = Number(lines[0]);
      if (Number.isFinite(n) && n > 0) size = n;
      const b64 = (lines[1] ?? "").trim();
      if (b64.length > 0) {
        try {
          head = parseMrcHeaderBytes(Buffer.from(b64, "base64"), size);
        } catch {
          head = null;
        }
      }
    }
  } catch (e) {
    probeWhy = e instanceof Error ? e.message : String(e);
  }
  if (verdict === "__CF_MAP_MISSING__") {
    return {
      ok: false,
      error: `the map does not exist on ${conn.host}: ${raw} — re-pick it in the params tab (the cluster browser lists what the ${conn.username} account can see)`,
    };
  }
  if (verdict === "__CF_MAP_DIR__") {
    return {
      ok: false,
      error: `${raw} is a directory, not a map file — pick the .mrc/.map file inside it in the params tab`,
    };
  }
  if (verdict === "__CF_MAP_NOREAD__") {
    return {
      ok: false,
      error:
        `${conn.username}@${conn.host} has no READ permission on ${raw} — read is all the import needs ` +
        `(the copy lands under cryoflow's own ${conn.remoteRoot || "~/cryoflow"}, the source is never written to); ` +
        `ask the owner or re-pick a readable copy in the params tab`,
    };
  }
  if (probeWhy) {
    return { ok: false, error: `could not reach ${conn.host} to read ${raw} (${probeWhy}) — re-pick the map in the params tab` };
  }
  if (!/\.(mrc|map)$/i.test(name)) {
    return {
      ok: false,
      error: `Not a 3D map file (.mrc/.map): ${raw} — mapimport is for volumes, not movies or particle stacks (.mrcs)`,
    };
  }
  if (size <= 0 || !head) {
    return {
      ok: false,
      error: `Map header is not a supported MRC volume: ${raw} — the cluster-side probe returned ${size <= 0 ? "no file size" : "an unparsable 1024-byte header"}`,
    };
  }

  // ---- the cluster-side copy into the job's own twin dir ------------------
  const remoteRoot = await expandCsRemoteRoot(conn, conn.remoteRoot || "~/cryoflow");
  const localOut = path.join(workdir, name);
  const twinPath = csMirrorPath(localOut, remoteRoot);
  const twinDir = twinPath.slice(0, twinPath.lastIndexOf("/"));
  await remoteMkdir(conn, twinDir);
  const cp = await sshExec(
    conn,
    `cp -f -- '${q}' '${twinPath.replace(/'/g, "'\\''")}'`,
    { timeoutMs: 300_000 }
  );
  if (cp.error || (cp.code != null && cp.code !== 0)) {
    return {
      ok: false,
      error:
        `the cluster-side copy failed (${(cp.error || cp.stderr || "").split("\n").filter(Boolean).slice(-1)[0] ?? `ssh exit ${cp.code}`}) — ` +
        `${raw} → ${twinPath}; the source only needs read permission, the destination is cryoflow's own — check the login node's load and run again`,
    };
  }
  let twinSize: number | null = null;
  try {
    const verify = await statRemoteFiles(conn, [twinPath]);
    const v = verify.missing.length > 0 ? null : (verify.sizes[0] ?? null);
    if (v != null && v > 0) twinSize = v;
  } catch {
    twinSize = null;
  }
  if (twinSize == null) {
    return {
      ok: false,
      error: `the cluster did not verify the copied map at ${twinPath} — run again (${raw} was readable a moment ago)`,
    };
  }
  if (twinSize !== size) {
    return {
      ok: false,
      error: `the copied map at ${twinPath} is ${twinSize.toLocaleString()} bytes but the source ${raw} is ${size.toLocaleString()} — the copy did not complete; run again`,
    };
  }

  // ---- record + twin registration (the shared finish) --------------------
  const pixel = head.cella[2] > 0 && head.nz > 0 ? head.cella[2] / head.nz : 0;
  const dims = `${head.nx}×${head.ny}×${head.nz}`;
  const result =
    `REMOTE[${conn.username}@${conn.host}]: Map imported: ${name} (${dims} vox${pixel > 0 ? ` · pixel ${pixel.toFixed(2)} Å` : ""} · ${(twinSize / 1024 / 1024).toFixed(1)} MB) ` +
    `— copied ON the cluster, zero bytes over the connection`;
  const logText = [
    `CryoFlow engine-native map import (cluster lane) ${new Date().toISOString()}`,
    `source: ${raw} (cluster ${conn.name || conn.host})`,
    `header: ${dims} voxels · mode ${head.mode}${pixel > 0 ? ` · pixel ${pixel.toFixed(2)} Å` : ""}`,
    `copy: cluster-side cp → ${twinPath} (verified ${twinSize.toLocaleString()} bytes — the map never left the cluster)`,
    `output: ${twinPath} (cluster twin) · local path of record: ${localOut}`,
    result,
    "",
  ].join("\n");
  await finishNativeRunOnCluster(
    job,
    workdir,
    conn,
    remoteRoot,
    twinPath,
    twinSize,
    "model_mrc",
    localOut,
    [{ path: name, size: twinSize }],
    "engine-native: import map reference (cluster-side copy)",
    result,
    logText,
    ""
  );
  return { ok: true, result };
}

/**
 * ImportMap: bring a standalone 3D map into the project as a reference —
 * RELION's import-map workflow, and the landing pad for sub-volume crops
 * (the 3D viewer's send-to-new-job materializes the crop into the parent
 * job's SubVolumes/ folder and points a mapimport job at it; the crop then
 * feeds class3d/refine3d reference inputs through the model_mrc output).
 * Engine-native: no CLI to run — validate the map, link it into the job's
 * own workdir (so the Files tab and outputs/file route serve it like any
 * other output), and declare model_mrc for the downstream chain. On a
 * REMOTE project a cluster-side path takes runMapImportRemoteLeg above —
 * the map is probed and copied ON the cluster and never leaves it.
 */
async function runMapImportNative(job: EngineJobRef): Promise<NativeResult> {
  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });

  const raw = String(job.params.mapPath ?? "").trim();
  if (!raw) {
    return {
      ok: false,
      error:
        "No map configured — pick a .mrc map in the params tab (Browse → Files), or send a sub-volume crop from the 3D viewer",
    };
  }
  // user-pasted paths may be WSL-side; translate before statting (same
  // courtesy the import job extends to micrographsPath)
  let host = raw;
  if (!existsSync(host)) {
    const status = await detectRelion();
    const bridge = bridgeFromStatus(status);
    if (bridge) host = userPathToHost(raw, bridge.distro);
  }
  // t360 — the remote-project branch: a path that exists NOWHERE on this
  // machine (after the WSL courtesy translation above) names the CLUSTER's
  // filesystem — the field report's shape (import map on a remote project
  // pointed at /data03/…/cryosparc_…_volume_map.mrc and died "Map file not
  // accessible", because existsSync only ever looked at the app's disk).
  // The remote leg probes it over SSH and materializes it with a
  // CLUSTER-SIDE copy — read permission on the source suffices, not one
  // map byte crosses the app↔cluster link. A LOCAL path (the sub-volume
  // crop flow writes one into the parent job's workdir; a map on this
  // machine) keeps the local lane below untouched — a downstream cluster
  // job stages and uploads it exactly as before, so nothing regresses.
  // The probe rides `raw`, never the WSL-mangled `host` (userPathToHost
  // rewrites ANY missing absolute path into \\wsl.localhost\… when a bridge
  // is active — a cluster path must reach the cluster verbatim).
  if (!existsSync(host)) {
    const meta = getProjectMeta(job.projectId);
    const connId = meta?.remote?.connectionId ?? null;
    if (connId) {
      const conn = getConnection(connId);
      if (!conn) {
        return {
          ok: false,
          error:
            "this is a remote project, but its cluster connection was deleted — re-add the cluster in Remote clusters (the picked map lives on it)",
        };
      }
      return await runMapImportRemoteLeg(job, workdir, raw, conn);
    }
  }
  if (!existsSync(host) || !statSync(host).isFile()) {
    return {
      ok: false,
      error: `Map file not accessible: ${raw} — re-pick it in the params tab (Browse → Files)`,
    };
  }
  if (!/\.(mrc|map)$/i.test(path.basename(host))) {
    return {
      ok: false,
      error: `Not a 3D map file (.mrc/.map): ${raw} — mapimport is for volumes, not movies or particle stacks (.mrcs)`,
    };
  }
  const head = readMrcHeader(host);
  if (!head) {
    return {
      ok: false,
      error: `Map header is not a supported MRC volume: ${raw}`,
    };
  }

  // Materialize the map into the workdir under its own name — HARDLINK
  // first (one copy on disk, same-filesystem), byte copy as the fallback
  // (exotic mounts / cross-volume sources). A symlink is NOT an option
  // here (t296): the file routes' unified containment policy (t270-era
  // hardening, resolveInsideJobWorkdir) realpaths every fetch and refuses
  // anything whose realpath leaves the data tree — an out-of-tree symlink
  // made the identity card honest (the listing reads the header directly)
  // while png/raw/histogram/value all answered 400 "Path escapes the job
  // directory": an imported map the viewer could never open. The import
  // (movie) flow has hardlinked first since the beginning — this site now
  // speaks the same doctrine, and both outcomes land INSIDE the workdir.
  const linked = path.join(workdir, path.basename(host));
  let linkedOk = false;
  try {
    if (!existsSync(linked)) linkSync(host, linked);
    linkedOk = existsSync(linked);
  } catch {
    linkedOk = false; // cross-volume (EXDEV) and friends — copy below
  }
  if (!linkedOk) {
    try {
      copyFileSync(host, linked);
      linkedOk = true;
    } catch {
      linkedOk = false;
    }
  }
  const outPath = linkedOk ? linked : host;

  const pixel = head.cella[2] > 0 && head.nz > 0 ? head.cella[2] / head.nz : 0;
  const dims = `${head.nx}×${head.ny}×${head.nz}`;
  const result = `Map imported: ${path.basename(host)} (${dims} vox${pixel > 0 ? ` · pixel ${pixel.toFixed(2)} Å` : ""})`;
  const logText = [
    `CryoFlow engine-native map import ${new Date().toISOString()}`,
    `source: ${host}`,
    linkedOk ? "materialized into the job workdir (hardlink, or byte copy across volumes)" : "referenced in place (link not possible)",
    `output: ${outPath}`,
    result,
    "",
  ].join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: import map reference (sub-volume crop workflow)",
    { model_mrc: outPath },
    result,
    logText
  );
  return { ok: true, result };
}

/* ------------------------------------------------------------------ */
/* t336 — CryoSPARC .cs → RELION particles.star (engine-native)        */
/* ------------------------------------------------------------------ */

/**
 * Resolve the user's csPath against the CLUSTER: a .cs file is used
 * directly (its sibling passthrough searched in the same dir); a job
 * directory (J###) gets its newest particles.cs + first passthrough —
 * the reference script's own discovery order (ls -V, last primary wins).
 */
async function resolveCsInputsRemote(
  conn: RemoteConnection,
  csPathRaw: string
): Promise<{ primary: string; passthrough: string | null; csProjectRoot: string; jobLabel: string } | { error: string }> {
  const isFile = /\.cs$/i.test(csPathRaw);
  const q = (p: string) => `'${p.replace(/'/g, `'\\''`)}'`;
  if (isFile) {
    const st = await statRemoteFiles(conn, [csPathRaw]);
    if (st.missing.length > 0) {
      return { error: `Not on the cluster: ${csPathRaw} — re-pick the particles.cs in the params tab` };
    }
    const dir = csPathRaw.replace(/\/[^/]+$/, "");
    const ptRes = await sshExec(conn, `ls -1 ${q(dir)}/*_passthrough_particles.cs 2>/dev/null | head -1`, { timeoutMs: 15_000 });
    const pt = (ptRes.stdout ?? "").trim().split(/\r?\n/)[0] ?? "";
    return {
      primary: csPathRaw,
      passthrough: pt || null,
      csProjectRoot: dir.replace(/\/[^/]+$/, ""),
      jobLabel: dir.split("/").pop() ?? dir,
    };
  }
  // a J dir (or any directory): newest primary, first passthrough
  const lsRes = await sshExec(
    conn,
    `cd ${q(csPathRaw)} 2>/dev/null && ls -1 *particles.cs 2>/dev/null | grep -v passthrough | sort -V | tail -1; echo ---; ls -1 *_passthrough_particles.cs 2>/dev/null | head -1`,
    { timeoutMs: 15_000 }
  );
  if (lsRes.code !== 0) {
    return { error: `Not a directory on the cluster: ${csPathRaw} — pick the CryoSPARC job folder (J###) or the particles.cs itself` };
  }
  const [primaryLine, ptLine] = (lsRes.stdout ?? "").split(/^---$/m).map((s) => s.trim().split(/\r?\n/)[0] ?? "");
  if (!primaryLine) {
    return { error: `No particles.cs inside ${csPathRaw} — pick the CryoSPARC job folder that holds extracted_particles.cs / cryosparc_*_particles.cs` };
  }
  return {
    primary: `${csPathRaw.replace(/\/$/, "")}/${primaryLine}`,
    passthrough: ptLine ? `${csPathRaw.replace(/\/$/, "")}/${ptLine}` : null,
    csProjectRoot: csPathRaw.replace(/\/[^/]+$/, "").replace(/\/$/, ""),
    jobLabel: csPathRaw.replace(/\/$/, "").split("/").pop() ?? csPathRaw,
  };
}

/** 6-significant-digit display (float32 .cs fields carry representation noise). */
const f6 = (x: number): string =>
  Number.isFinite(x) ? (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(6)))) : "0";

/** ~-expansion for the remote root (inlined to avoid an engine↔remote-run import cycle). */
async function expandCsRemoteRoot(conn: RemoteConnection, p: string): Promise<string> {
  if (!p.startsWith("~")) return p;
  const r = await sshExec(conn, "echo $HOME", { timeoutMs: 10_000 });
  const home = (r.stdout ?? "").trim().split(/\r?\n/)[0] ?? "";
  if (p === "~") return home;
  if (p.startsWith("~/")) return home + p.slice(1);
  return p;
}

/**
 * t352 — local (under RELION_DIR) → cluster mirror path: the EXACT mapping
 * mapLocalToRemote performs for the staging layer and the finalize twin pass
 * in remote-run.ts (uploads land at remoteRoot + the path's tail after
 * RELION_DIR; record outputs map to their twins the same way). Inlined here
 * because engine.ts deliberately does not import from remote-run.ts (the
 * engine↔remote-run cycle is broken on purpose — expandCsRemoteRoot above
 * is the precedent). The two bodies must stay behaviorally identical: the
 * cs2star star's cluster twin is addressed by the SAME convention every
 * other twin uses (remoteRoot/<projectId>/<type>_<id8>/particles.star —
 * the extract field logs' shape), or the twin gates and the staging skip
 * would speak different paths for one file.
 */
function csMirrorPath(localPath: string, remoteRoot: string): string {
  const norm = localPath.split(path.sep).join("/");
  if (norm === RELION_DIR.split(path.sep).join("/")) return remoteRoot;
  if (norm.startsWith(RELION_DIR.split(path.sep).join("/") + "/")) {
    return remoteRoot.replace(/\/$/, "") + norm.slice(RELION_DIR.length);
  }
  return norm;
}

/**
 * t353 — the CLUSTER-SIDE converter: a self-contained python script, the
 * byte-faithful twin of csRowsToStar (src/lib/relion/cs2star.ts — the
 * pyem-verified field table, the uid smart-merge, the selective-link
 * naming, the star emit order). The user's own architecture call: the
 * params are decided HERE, the 100-200 MB .cs datasets and the .mrcs
 * stacks live THERE — so the conversion runs where the data is. Only this
 * few-KB script crosses the wire; the star is written straight to its
 * cluster twin and the link farm is built in-process. No pyem install is
 * required (numpy alone), and no sbatch: a login-node conversion is
 * CPU-light I/O work, exactly where the user's own reference script ran
 * csparc2star.py.
 *
 * Contract with the engine lane (runCs2StarOnCluster): argv-only params,
 * cluster-absolute paths; exit 0 + a final "CF_RECEIPT {json}" line on
 * stdout; every failure exits nonzero with the reason on stderr; the
 * star writes to .tmp and renames (a failed run leaves nothing partial
 * behind); the links are idempotent (remove + symlink, ln -sfn's shape).
 */
const CS2STAR_CLUSTER_PY = String.raw`#!/usr/bin/env python3
# CryoFlow t353 - cluster-side CryoSPARC .cs -> RELION particles.star.
# The byte-faithful python twin of the engine's native converter
# (csRowsToStar): same uid join, same field table, same link naming,
# same star emit order - the star written here is byte-identical to the
# one the local lane would have produced from the same .cs.
import argparse, json, math, os, re, struct, sys, time
from decimal import Decimal

import numpy as np

T0 = time.time()
EPS = 2.220446049250313e-16
DEG = 180.0 / math.pi

def log(msg):
    print(msg, flush=True)

def fail(msg):
    sys.stderr.write("CS2STAR-ERROR: %s\n" % msg)
    sys.exit(1)

# -- pyem's geometry, verbatim (geom/convert.py: expmap + rot2euler) ----
def mul3(a, b):
    out = [0.0] * 9
    for i in range(3):
        for j in range(3):
            for l in range(3):
                out[i * 3 + j] += a[i * 3 + l] * b[l * 3 + j]
    return out

def expmap(rx, ry, rz):
    theta = math.sqrt(rx * rx + ry * ry + rz * rz)
    if theta < 1e-16:
        return [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
    wx, wy, wz = rx / theta, ry / theta, rz / theta
    k = [0.0, wz, -wy, -wz, 0.0, wx, wy, -wx, 0.0]
    k2 = mul3(k, k)
    s = math.sin(theta)
    c1 = 1.0 - math.cos(theta)
    return [(1.0 if i % 4 == 0 else 0.0) + s * k[i] + c1 * k2[i] for i in range(9)]

def _sign(x):
    if x > 0:
        return 1
    if x < 0:
        return -1
    return 0

def rot2euler(r):
    abs_sb = math.hypot(r[2], r[5])
    if abs_sb > 16 * EPS:
        gamma = math.atan2(r[5], -r[2])
        alpha = math.atan2(r[7], r[6])
        if abs(math.sin(gamma)) < EPS:
            sign_sb = _sign(-r[2]) / math.cos(gamma)
        else:
            sign_sb = _sign(r[5]) if math.sin(gamma) > 0 else -_sign(r[5])
        beta = math.atan2(sign_sb * abs_sb, r[8])
        return (alpha, beta, gamma)
    if _sign(r[8]) > 0:
        return (0.0, 0.0, math.atan2(-r[3], r[0]))
    return (0.0, math.pi, math.atan2(r[3], -r[0]))

def jsround(x):
    # JS Math.round = floor(x + 0.5) - python round() is banker's and
    # disagrees on exact .5 halves (coordinates hit them: 0.3125 * 5000)
    return math.floor(x + 0.5)

def fmt(v):
    # the TS lane's fmt: integers < 1e15 plain, else
    # String(Number(v.toPrecision(6))) - 6 significant digits in JS's
    # Number-to-string dialect (fixed down to 1e-6, exponent otherwise
    # with no leading zero in the exponent, "e+21" keeps the plus)
    if not math.isfinite(v):
        return "0"
    if v == int(v) and abs(v) < 1e15:
        return str(int(v))
    x = float("%.6g" % v)
    if x == int(x) and abs(x) < 1e15:
        return str(int(x))
    a = abs(x)
    if a != 0.0 and (a < 1e-7 or a >= 1e21):
        s = "%.5e" % x
        mant, ex = s.split("e")
        if "." in mant:
            mant = mant.rstrip("0").rstrip(".")
        exi = int(ex)
        return "%se%s%d" % (mant, "+" if exi > 0 else "-", abs(exi))
    return format(Decimal("%.6g" % x), "f")

def nn(*xs):
    for x in xs:
        if x is not None:
            return x
    return None

def to_py(v):
    return v.item() if hasattr(v, "item") else v

def decode_str(v):
    if isinstance(v, bytes):
        return v.decode("utf-8", "replace")
    return str(v)

def load_columns(path):
    # .cs = a structured .npy. Columns are extracted ONCE into plain python
    # values (exact ints for uid - i8 survives as python int, not f64) so
    # the row loop below never touches numpy scalars.
    arr = np.load(path, allow_pickle=False)
    cols = {}
    for name in arr.dtype.names:
        a = arr[name]
        if a.ndim == 2:
            cols[name] = [list(map(to_py, row)) for row in a]
        elif a.dtype.kind in ("S", "U"):
            cols[name] = [decode_str(x) for x in a]
        else:
            cols[name] = [to_py(x) for x in a]
    return cols, len(arr)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--primary", required=True)
    ap.add_argument("--passthrough")
    ap.add_argument("--out", required=True)
    ap.add_argument("--link-dir", required=True)
    ap.add_argument("--cs-root", required=True)
    ap.add_argument("--invert-y", default="0")
    ap.add_argument("--fallback", default="{}")
    args = ap.parse_args()

    invert_y = args.invert_y in ("1", "true", "yes")
    try:
        fb = json.loads(args.fallback or "{}")
    except Exception:
        fb = {}
    fb_angpix = fb.get("angpix")
    fb_voltage = fb.get("voltage")
    fb_cs = fb.get("cs")
    fb_ac = fb.get("ac")

    log("python %s - numpy %s" % (sys.version.split()[0], np.__version__))
    log("reading %s" % args.primary)
    prim, n_rows = load_columns(args.primary)
    if n_rows == 0:
        fail("the primary .cs holds zero rows")
    pt_cols = None
    pt_n = 0
    if args.passthrough:
        log("reading %s" % args.passthrough)
        pt_cols, pt_n = load_columns(args.passthrough)

    # the uid join (pyem smart_merge): passthrough fields absent from the
    # primary ride onto the rows, matched by uid; a field the primary has
    # itself never gets overridden
    field_names = list(prim.keys())
    field_set = set(field_names)
    merged = dict(prim)
    if pt_cols is not None and pt_n > 0:
        by_uid = {}
        for i, u in enumerate(pt_cols.get("uid", [])):
            by_uid[u] = i
        new_fields = [k for k in pt_cols.keys() if k != "uid" and k not in field_set]
        for f in new_fields:
            src = pt_cols[f]
            col = [None] * n_rows
            for i in range(n_rows):
                d = by_uid.get(merged["uid"][i])
                if d is not None:
                    col[i] = src[d]
            merged[f] = col
        for f in new_fields:
            field_set.add(f)
            field_names.append(f)

    def num1(i, k):
        c = merged.get(k)
        if c is None:
            return None
        v = c[i]
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            return None
        return v

    def arr1(i, k):
        c = merged.get(k)
        if c is None:
            return None
        v = c[i]
        return v if isinstance(v, list) else None

    def str1(i, k):
        c = merged.get(k)
        if c is None:
            return None
        v = c[i]
        return v if isinstance(v, str) else None

    def has(k):
        return k in field_set

    alignment = "3D" if has("alignments3D/pose") else ("2D" if has("alignments2D/pose") else "none")
    has_coords = has("location/center_x_frac") and has("location/micrograph_shape")

    def img_path(i):
        p = str1(i, "blob/path")
        if p is None:
            return None
        return re.sub(r"^>+", "", p)

    # the stack census (FIRST - the link names must be decided before any
    # row references them; a colliding basename gets a -2 suffix and the
    # star must speak the SAME suffixed name as the link)
    stack_paths, seen = [], set()
    for i in range(n_rows):
        p = img_path(i)
        if p is not None and p not in seen:
            seen.add(p)
            stack_paths.append(p)
    used = {}
    stack_plan = []
    for p in stack_paths:
        base = re.split(r"[\\/]", p)[-1]
        base = re.sub(r"\.[^.]+$", "", base)
        name = base + ".mrcs"
        n = used.get(name)
        if n:
            used[name] = n + 1
            name = "%s-%d.mrcs" % (base, n + 1)
        else:
            used[name] = 1
        stack_plan.append((p, name))
    link_of = dict(stack_plan)

    # t366 — probe the stacks' OWN headers, in place, BEFORE a single
    # optics value is written: the .cs metadata is a CLAIM, the headers
    # are the truth. The field report: a merged CryoSPARC particle set
    # carried stale full-resolution metadata (blob/shape 256 @ 0.808 A)
    # over stacks that are physically the 4x-binned truth (100 px @
    # 3.232 A) — one optics row lied per group, and the particles were
    # never tagged with their group at all (RELION defaulted everything
    # to group 1 and the other 44 rows were dead metadata that baffled
    # the user straight back into the chat). The stacks are LOCAL files
    # here — one 1 KB read each, no wire, no queue.
    def resolve_cs(p):
        if p.startswith("/"):
            return p
        return args.cs_root + "/" + re.sub(r"^\./", "", p)

    targets = [resolve_cs(p) for (p, _n) in stack_plan]
    missing = [t for t in targets if not os.path.isfile(t)]
    if missing:
        fail("%d referenced particle stack(s) are missing on the cluster (first: %s) - the .cs names files the CryoSPARC project no longer holds" % (len(missing), missing[0]))

    # the t360 header grammar (parseMrcHeaderBytes), mirrored field for
    # field: dims, mode->bpp, nsymbt, the size sanity — a header that
    # fails any of it is UNREADABLE, never a vote
    MODE_BYTES = {0: 1, 1: 2, 2: 4, 6: 2, 12: 2, 16: 1}
    phys = {"box": None, "angpix": None}
    stacks_probed = 0
    stacks_unreadable = 0
    votes = {}
    for (p, t) in zip([p for (p, _n) in stack_plan], targets):
        try:
            with open(t, "rb") as fh:
                head = fh.read(1024)
            if len(head) < 1024:
                raise ValueError("short header")
            nx, ny, nz = struct.unpack_from("<3i", head, 0)
            (mode,) = struct.unpack_from("<i", head, 12)
            (nsymbt,) = struct.unpack_from("<i", head, 92)
            cella = struct.unpack_from("<3f", head, 40)
            bpp = MODE_BYTES.get(mode)
            if (
                nx <= 0 or ny <= 0 or nz <= 0 or nx > 65536 or ny > 65536 or nz > 1000000
                or nsymbt < 0 or nsymbt > 16000000 or bpp is None
            ):
                raise ValueError("bad dims")
            if 1024 + nsymbt + nx * ny * nz * bpp > os.path.getsize(t) + bpp:
                raise ValueError("size mismatch")
            if nx != ny:
                raise ValueError("non-square box")
            px = (cella[0] / nx) if cella[0] > 0 else None
            stacks_probed += 1
            key = (nx, None if px is None else round(px, 4))
            votes.setdefault(key, {"box": nx, "angpix": px, "stacks": 0, "first": t})
            votes[key]["stacks"] += 1
        except (OSError, ValueError, struct.error):
            stacks_unreadable += 1
    log("stack headers probed: %d readable, %d unreadable, %d sampling vote(s)" % (stacks_probed, stacks_unreadable, len(votes)))
    if len(votes) > 1:
        census = "; ".join(
            "%d stack(s) are %d px @ %s A (first: %s)" % (v["stacks"], v["box"], ("%.4f" % v["angpix"]) if v["angpix"] is not None else "?", v["first"])
            for v in sorted(votes.values(), key=lambda v: (v["box"], v["angpix"] or 0))
        )
        fail(
            "the referenced particle stacks MIX samplings — one RELION classification cannot hold both: %s — "
            "split the particle set (in cryoSPARC: Select on the extraction job) and convert each sampling separately, "
            "or re-extract everything at one sampling (t366)" % census
        )
    for v in votes.values():
        phys["box"] = v["box"]
        phys["angpix"] = v["angpix"]

    optics_rows = {}
    claimed_variants = {}
    star_rows = []
    for i in range(n_rows):
        imgp = img_path(i)
        img_idx = nn(num1(i, "blob/idx"), 0)
        stack_path = imgp if imgp is not None else ""
        link_name = link_of.get(stack_path, "")

        gid_v = nn(num1(i, "ctf/exp_group_id"), 0)
        gid = jsround(gid_v) + 1
        if gid not in optics_rows:
            claimed_px = nn(num1(i, "blob/psize_A"), fb_angpix, 1.0)
            angpix = claimed_px if phys["angpix"] is None else phys["angpix"]
            voltage = nn(num1(i, "ctf/accel_kv"), fb_voltage, 300.0)
            cs = nn(num1(i, "ctf/cs_mm"), fb_cs, 2.7)
            ac = nn(num1(i, "ctf/amp_contrast"), num1(i, "ctf/ac"), fb_ac, 0.1)
            shape = arr1(i, "blob/shape")
            claimed_box = jsround(nn(shape[0] if shape else None, 0))
            box = claimed_box if phys["box"] is None else phys["box"]
            optics_rows[gid] = {"voltage": voltage, "cs": cs, "ac": ac, "angpix": angpix, "box": box}
            ck = (claimed_box, round(claimed_px, 4))
            if ck not in claimed_variants:
                claimed_variants[ck] = True
        opt = optics_rows[gid]

        vals = {}
        vals["opticsGroup"] = str(gid)  # t366 — the row SPEAKS its group
        if link_name:
            vals["imageName"] = "%d@micrographs/%s" % (max(1, jsround(img_idx) + 1), link_name)
        else:
            vals["imageName"] = ""
        mic = str1(i, "location/micrograph_path")
        vals["micrographName"] = re.sub(r"^>+", "", mic) if mic is not None else ""

        if has_coords:
            fx = nn(num1(i, "location/center_x_frac"), 0.0)
            fy = nn(num1(i, "location/center_y_frac"), 0.0)
            if invert_y:
                fy = 1.0 - fy
            shape = arr1(i, "location/micrograph_shape")
            if shape is None:
                shape = [0, 0]
            sx = nn(shape[1] if len(shape) > 1 else None, shape[0] if len(shape) > 0 else None, 0)
            sy = nn(shape[0] if len(shape) > 0 else None, shape[1] if len(shape) > 1 else None, 0)
            vals["coordX"] = str(jsround(fx * sx))
            vals["coordY"] = str(jsround(fy * sy))

        if alignment == "3D":
            pose = arr1(i, "alignments3D/pose")
            if pose is not None and len(pose) >= 3:
                rot, tilt, psi = rot2euler(expmap(pose[0], pose[1], pose[2]))
                vals["angleRot"] = fmt(rot * DEG)
                vals["angleTilt"] = fmt(tilt * DEG)
                vals["anglePsi"] = fmt(psi * DEG)
            shift = arr1(i, "alignments3D/shift")
            if shift is not None and len(shift) >= 2:
                vals["originXAngst"] = fmt(shift[0] * opt["angpix"])
                vals["originYAngst"] = fmt(shift[1] * opt["angpix"])
            split = num1(i, "alignments3D/split")
            if split is not None:
                vals["randomSubset"] = str(jsround(split) + 1)
        elif alignment == "2D":
            psi = num1(i, "alignments2D/pose")
            if psi is not None:
                vals["anglePsi"] = fmt(psi * DEG)
            shift = arr1(i, "alignments2D/shift")
            if shift is not None and len(shift) >= 2:
                vals["originXAngst"] = fmt(shift[0] * opt["angpix"])
                vals["originYAngst"] = fmt(shift[1] * opt["angpix"])
        cls = nn(num1(i, "alignments2D/class" if alignment == "2D" else "alignments3D/class"), num1(i, "class"))
        if cls is not None:
            vals["classNumber"] = str(jsround(cls) + 1)
        dfu = num1(i, "ctf/df1_A")
        if dfu is not None:
            vals["defocusU"] = fmt(dfu)
        dfv = num1(i, "ctf/df2_A")
        if dfv is not None:
            vals["defocusV"] = fmt(dfv)
        dfa = num1(i, "ctf/df_angle_rad")
        if dfa is not None:
            vals["defocusAngle"] = fmt(dfa * DEG)
        phs = num1(i, "ctf/phase_shift_rad")
        vals["phaseShift"] = fmt(phs * DEG) if phs is not None else "0"

        if vals["imageName"] != "":
            star_rows.append(vals)

    # the emit order (RELION's canonical particles star)
    COLS = [
        ("imageName", "_rlnImageName"),
        ("micrographName", "_rlnMicrographName"),
        ("coordX", "_rlnCoordinateX"),
        ("coordY", "_rlnCoordinateY"),
        ("angleRot", "_rlnAngleRot"),
        ("angleTilt", "_rlnAngleTilt"),
        ("anglePsi", "_rlnAnglePsi"),
        ("originXAngst", "_rlnOriginXAngst"),
        ("originYAngst", "_rlnOriginYAngst"),
        ("defocusU", "_rlnDefocusU"),
        ("defocusV", "_rlnDefocusV"),
        ("defocusAngle", "_rlnDefocusAngle"),
        ("phaseShift", "_rlnPhaseShift"),
        ("classNumber", "_rlnClassNumber"),
        ("randomSubset", "_rlnRandomSubset"),
        # t366 — without this column every particle silently rides optics
        # group 1 in RELION and the other groups' rows are dead metadata.
        # Appended LAST so every existing column index survives (the TS
        # twin appends the same column in the same place).
        ("opticsGroup", "_rlnOpticsGroup"),
    ]
    active = [c for c in COLS if any(c[0] in r for r in star_rows)]

    lines = []
    lines.append("")
    lines.append("data_optics")
    lines.append("")
    lines.append("loop_")
    optics_cols = [
        ("_rlnOpticsGroup", lambda g: str(g)),
        ("_rlnOpticsGroupName", lambda g: "opticsGroup%d" % g),
        ("_rlnVoltage", lambda g: fmt(optics_rows[g]["voltage"])),
        ("_rlnSphericalAberration", lambda g: fmt(optics_rows[g]["cs"])),
        ("_rlnAmplitudeContrast", lambda g: fmt(optics_rows[g]["ac"])),
        ("_rlnImageSize", lambda g: str(optics_rows[g]["box"]) if optics_rows[g]["box"] > 0 else ""),
        ("_rlnImageDimensionality", lambda g: "2"),
        ("_rlnImagePixelSize", lambda g: fmt(optics_rows[g]["angpix"])),
    ]
    for idx, (name, _f) in enumerate(optics_cols):
        lines.append("%s #%d" % (name, idx + 1))
    for g in sorted(optics_rows.keys()):
        lines.append("\t".join(f(g) for (_n, f) in optics_cols))
    lines.append("")
    lines.append("data_particles")
    lines.append("")
    lines.append("loop_")
    for idx, (k, name) in enumerate(active):
        lines.append("%s #%d" % (name, idx + 1))
    for r in star_rows:
        lines.append("\t".join(r.get(k, "") for (k, _n) in active))
    star_text = "\n".join(lines) + "\n"

    MAPPED = [
        r"^blob/(path|idx|psize_A|shape)$",
        r"^ctf/(df1_A|df2_A|df_angle_rad|phase_shift_rad|accel_kv|cs_mm|ac|amp_contrast|exp_group_id|bfactor)$",
        r"^location/(center_x_frac|center_y_frac|micrograph_path|micrograph_shape)$",
        r"^alignments(2D|3D)/(pose|shift|class|split)$",
    ]
    unmapped = [k for k in field_names if k != "uid" and not any(re.match(rx, k) for rx in MAPPED)]

    first = optics_rows.get(1)
    if first is None and optics_rows:
        first = next(iter(optics_rows.values()))
    if first is None:
        first = {
            "voltage": nn(fb_voltage, 300.0),
            "cs": nn(fb_cs, 2.7),
            "ac": nn(fb_ac, 0.1),
            "angpix": nn(fb_angpix, 1.0),
            "box": 0,
        }

    # verify the referenced stacks exist, resolve relative paths against
    # the cs project root — both already happened in the t366 probe phase
    # above (missing stacks refused there, headers voted there); this
    # reuses the resolved targets
    dirs = set(os.path.dirname(t) for t in targets)
    total_mrc = 0
    for d in dirs:
        try:
            total_mrc += sum(1 for f in os.listdir(d) if f.endswith(".mrc"))
        except OSError:
            pass

    os.makedirs(args.link_dir, exist_ok=True)
    log("linking %d stack(s) into %s (selective - only what this star references)" % (len(stack_plan), args.link_dir))
    for (_p, name), target in zip(stack_plan, targets):
        link = os.path.join(args.link_dir, name)
        try:
            if os.path.lexists(link):
                os.remove(link)
            os.symlink(target, link)
        except OSError as e:
            fail("could not link %s -> %s (%s)" % (link, target, e))

    tmp = args.out + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(star_text)
    os.replace(tmp, args.out)
    star_bytes = os.path.getsize(args.out)

    log("CF_RECEIPT " + json.dumps({
        "particles": len(star_rows),
        "stacks": [{"csPath": p, "linkName": n} for (p, n) in stack_plan],
        "unmapped": unmapped,
        "opticsGroups": len(optics_rows),
        "optics": {"voltage": first["voltage"], "cs": first["cs"], "ac": first["ac"], "angpix": first["angpix"], "boxSize": first["box"]},
        # t366 — the sampling's provenance: the stacks' own probed headers
        # (phys) vs the .cs metadata (claim), plus the claim's variant
        # census — the receipt the lanes build the correction sentence from
        "opticsSource": "stack-headers" if (phys["box"] is not None or phys["angpix"] is not None) else "cs-metadata",
        "stacksProbed": stacks_probed,
        "stacksUnreadable": stacks_unreadable,
        "physical": phys,
        "csVariants": [{"box": b, "angpix": p} for (b, p) in sorted(claimed_variants.keys())],
        "hasCoordinates": has_coords,
        "alignment": alignment,
        "censusTotalMrc": total_mrc,
        "starPath": args.out,
        "starBytes": star_bytes,
        "durationSec": round(time.time() - T0, 1),
    }))

if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        import traceback
        sys.stderr.write("CS2STAR-ERROR: unhandled exception\n" + traceback.format_exc())
        sys.exit(1)
`;

/**
 * t353 — does the cluster's login shell have a python with numpy?
 * ONE SSH round: python3 first (the HPC default), then python, then the
 * pyem install's own interpreter — csparc2star.py's shebang names the
 * exact python that has numpy (a conda env python the PATH never sees,
 * exactly the user's layout). env-shebangs resolve through command -v
 * (which the first arm already tried); only an ABSOLUTE shebang adds
 * reach. Returns the exe path, or null with `definitive` telling whether
 * the cluster answered a clean "no python" (vs a wire that stayed
 * silent — the fallback lane's phase line speaks the difference).
 */
async function probeClusterPython(
  conn: RemoteConnection
): Promise<{ exe: string | null; definitive: boolean }> {
  const sh = [
    'P=$(command -v python3 || true)',
    '[ -z "$P" ] && P=$(command -v python || true)',
    'if [ -n "$P" ] && "$P" -c "import numpy" >/dev/null 2>&1; then echo "PYOK $P"; exit 0; fi',
    'CS=$(command -v csparc2star.py || command -v csparc2star || true)',
    'if [ -n "$CS" ] && [ -f "$CS" ]; then',
    '  SB=$(sed -n "1s/^#!//p" "$CS" | tr -d "\\r")',
    '  if [ -n "$SB" ]; then',
    '    S1=${SB%% *}',
    '    if [ "$S1" = "/usr/bin/env" ] || [ "$S1" = "env" ]; then',
    '      S2=${SB#* }; S2=${S2%% *}',
    '      case "$S2" in /*) SB="$S2";; *) SB=$(command -v "$S2" || true);; esac',
    '    else',
    '      SB="$S1"',
    '    fi',
    '    if [ -n "$SB" ] && "$SB" -c "import numpy" >/dev/null 2>&1; then echo "PYOK $SB"; exit 0; fi',
    '  fi',
    'fi',
    'echo PYNONE',
  ].join("\n");
  try {
    const r = await sshExec(conn, sh, { timeoutMs: 20_000 });
    if (r.error) return { exe: null, definitive: false };
    const line = (r.stdout ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => /^PYOK \S+/.test(l));
    return { exe: line ? line.slice("PYOK ".length) : null, definitive: line == null };
  } catch {
    return { exe: null, definitive: false };
  }
}

/** The receipt the cluster-side converter prints (CF_RECEIPT line). */
interface CsClusterReceipt {
  particles: number;
  stacks: Array<{ csPath: string; linkName: string }>;
  unmapped: string[];
  opticsGroups: number;
  optics: { voltage: number; cs: number; ac: number; angpix: number; boxSize: number };
  /** t366 — the sampling provenance the twin now reports (absent on an
   *  older twin's receipt: treated as cs-metadata, never a guess) */
  opticsSource?: "stack-headers" | "cs-metadata";
  stacksProbed?: number;
  stacksUnreadable?: number;
  physical?: { box?: number | null; angpix?: number | null };
  csVariants?: { box: number; angpix: number }[];
  hasCoordinates: boolean;
  alignment: "3D" | "2D" | "none";
  censusTotalMrc: number;
  starBytes: number;
  durationSec: number;
}

/* ------------------------------------------------------------------ */
/* t366 — the optics-sampling receipt, ONE voice for all three lanes    */
/* ------------------------------------------------------------------ */

/**
 * The ` · …` segment the conversion receipts append about WHERE the
 * optics sampling came from: the stacks' own probed headers (verified,
 * or corrected when the .cs metadata claimed more than one sampling) or
 * the .cs metadata itself (honest degraded note when no header could be
 * read). The python twin reports the facts in its CF_RECEIPT JSON; the
 * SSH-download and local lanes hold them in memory — the SENTENCE is
 * this one function, so no lane can drift.
 */
function opticsSamplingSegment(f: {
  box: number | null;
  angpix: number | null;
  metaAngpix: number;
  probed: number;
  unreadable: number;
  csVariants: { box: number; angpix: number }[];
}): string {
  const px = (v: number) => String(Number(v.toFixed(4)));
  const unr = f.unreadable > 0 ? ` (${f.unreadable} header(s) unreadable, not judged)` : "";
  if (f.box != null && f.angpix != null) {
    // CORRECTED whenever the .cs's claim (as a whole) is not the physical
    // sampling — a uniform lie (every group claims 256 px @ 0.808 over
    // 100 px @ 3.232 stacks) corrects exactly like a mixed one
    const claimDiffers =
      f.csVariants.length !== 1 ||
      Math.abs(f.csVariants[0]!.box - f.box) > 0.5 ||
      Math.abs(f.csVariants[0]!.angpix - f.angpix) / f.angpix > 0.005;
    const claim = claimDiffers
      ? `; the .cs metadata claimed ${f.csVariants.length} sampling variant(s) (${f.csVariants
          .map((v) => `${v.box} px @ ${px(v.angpix)} Å`)
          .join(", ")}), every optics group now speaks the stacks' truth`
      : "";
    return ` · optics ${claimDiffers ? "CORRECTED from" : "verified against"} the stacks' own MRC headers — all ${f.probed} stack(s) are ${f.box} px @ ${px(f.angpix)} Å${claim}${unr}`;
  }
  if (f.box != null && f.angpix == null) {
    return ` · box ${f.box} px verified against the stacks' own MRC headers (${f.probed} stack(s) agree); the headers carry no cella sizes, so the pixel size stays the .cs metadata's ${px(f.metaAngpix)} Å${unr}`;
  }
  return ` · optics from the .cs metadata (${f.unreadable} stack header(s) unreadable — the sampling is unverified)`;
}

/**
 * t366 — the refusal for a particle set whose stacks PHYSICALLY mix
 * samplings: no single RELION classification can hold both, and no
 * metadata correction can fix files that genuinely differ. The census
 * names counts + samplings + the first deviant of each.
 */
function samplingRefusal(variants: { box: number; angpix: number; stacks: number; first: string }[]): string {
  const px = (v: number) => String(Number(v.toFixed(4)));
  const census = variants
    .map((v) => `${v.stacks} stack(s) are ${v.box} px @ ${px(v.angpix)} Å (first: ${v.first})`)
    .join("; ");
  return (
    `the referenced particle stacks MIX samplings — one RELION classification cannot hold both: ${census} — ` +
    `split the particle set (in cryoSPARC: Select on the extraction job) and convert each sampling separately, ` +
    `or re-extract everything at one sampling`
  );
}

/**
 * t353 — the CLUSTER-SIDE lane proper: upload the converter script (KBs),
 * run it ON the cluster (params as argv), verify the star where it was
 * written. The .cs bytes never leave the cluster and the star never
 * crosses the wire — the twin is not uploaded, it is BORN there. The
 * record keeps the LOCAL-flavored output path (absent on this machine
 * by design — "output on the cluster" is the point) so the twin gates
 * map consumers to the cluster path, exactly like a sync that left the
 * local copy behind.
 */
async function runCs2StarOnCluster(
  job: EngineJobRef,
  workdir: string,
  conn: RemoteConnection,
  resolved: { primary: string; passthrough: string | null; csProjectRoot: string; jobLabel: string },
  opts: { invertY: boolean; fallback: { angpix?: number; voltage?: number; cs?: number; ac?: number } },
  pyExe: string
): Promise<NativeResult> {
  const phase = (line: string) => nativePhaseLog(workdir, line);
  const q = (p: string) => `'${p.replace(/'/g, `'\\''`)}'`;

  const remoteRoot = await expandCsRemoteRoot(conn, conn.remoteRoot || "~/cryoflow");
  const starPath = path.join(workdir, "particles.star"); // the record's local flavor (twin gate maps it)
  const twinPath = csMirrorPath(starPath, remoteRoot);
  const twinDir = twinPath.slice(0, twinPath.lastIndexOf("/"));
  const linkDir = `${remoteRoot.replace(/\/$/, "")}/${job.projectId}/micrographs`;

  const fb = opts.fallback;
  const fbJson = JSON.stringify({
    ...(fb.angpix != null ? { angpix: fb.angpix } : {}),
    ...(fb.voltage != null ? { voltage: fb.voltage } : {}),
    ...(fb.cs != null ? { cs: fb.cs } : {}),
    ...(fb.ac != null ? { ac: fb.ac } : {}),
  });

  phase(`converting ON the cluster (${pyExe}) — the .cs never leaves it; the star is written straight to ${twinPath}`);
  await remoteMkdir(conn, twinDir);
  await remoteMkdir(conn, linkDir);
  const scriptPath = `${twinDir}/cs2star_cf.py`;
  phase(`uploading the converter (${(CS2STAR_CLUSTER_PY.length / 1024).toFixed(1)} KB) → ${scriptPath}`);
  if (!(await remoteUpload(conn, CS2STAR_CLUSTER_PY, scriptPath))) {
    return {
      ok: false,
      error: `could not upload the converter script to ${scriptPath} — the cluster connection answered poorly; run again (nothing was modified on the cluster)`,
    };
  }

  const cmd = [
    q(pyExe),
    q(scriptPath),
    "--primary",
    q(resolved.primary),
    ...(resolved.passthrough ? ["--passthrough", q(resolved.passthrough)] : []),
    "--out",
    q(twinPath),
    "--link-dir",
    q(linkDir),
    "--cs-root",
    q(resolved.csProjectRoot),
    "--invert-y",
    opts.invertY ? "1" : "0",
    "--fallback",
    q(fbJson),
  ].join(" ");

  // t340's heartbeat doctrine: the exec is ONE call, so the interim lines
  // come from a local timer (zero SSH) — the log tab stays alive while the
  // login node chews.
  let elapsed = 0;
  const hb = setInterval(() => {
    elapsed += 15;
    nativePhaseLog(workdir, `converting on the cluster… ${elapsed}s`);
  }, 15_000);
  let res: Awaited<ReturnType<typeof sshExec>>;
  try {
    res = await sshExec(conn, cmd, { timeoutMs: 900_000 });
  } finally {
    clearInterval(hb);
  }
  const outText = res.stdout ?? "";
  const errText = res.stderr ?? "";
  // the converter's own log becomes part of the local witness
  try {
    appendFileSync(path.join(workdir, "run.out"), `\n--- converter output (on the cluster) ---\n${outText}`);
  } catch {
    /* witness doctrine */
  }
  if (res.error || res.code == null || res.code !== 0) {
    // stderr leads the window: the twin speaks its verdicts as a single
    // CS2STAR-ERROR line on stderr, and a chatty stdout (the probe log)
    // must never push the verdict out of the slice the user reads (the
    // t366 field report: the MIX-samplings refusal surfaced as "reading
    // …/J44/…" instead of the refusal)
    const outLines = outText.split(/\r?\n/).filter(Boolean);
    const errLines = errText.split(/\r?\n/).filter(Boolean);
    const why =
      errLines.length > 0
        ? [...errLines.slice(-3), ...outLines.slice(-1)].join(" | ")
        : outLines.slice(-4).join(" | ") || "no output";
    return {
      ok: false,
      error: `the cluster-side conversion failed (exit ${res.code ?? "ssh: " + (res.error ?? "no answer")}): ${why} — the .cs was not downloaded and no star was written; the log tab holds the full converter output`,
    };
  }
  const receiptLine = outText.split(/\r?\n/).filter((l) => l.startsWith("CF_RECEIPT ")).pop();
  if (!receiptLine) {
    return {
      ok: false,
      error: "the converter exited 0 but printed no receipt — unexpected output; the log tab holds what it did say",
    };
  }
  let conv: CsClusterReceipt;
  try {
    conv = JSON.parse(receiptLine.slice("CF_RECEIPT ".length)) as CsClusterReceipt;
  } catch {
    return { ok: false, error: "the converter's receipt could not be parsed — the log tab holds the raw line" };
  }
  if (conv.particles === 0) {
    return { ok: false, error: `the .cs holds no windowable particle rows (blob/path missing) — ${resolved.primary}` };
  }
  phase(`converted: ${conv.particles} particles · ${conv.stacks.length} referenced stack(s) · ${conv.durationSec}s on the cluster`);
  // verify BEFORE recording anything — the twin gates chain downstream
  // argv off this path (same doctrine as the upload lane)
  let twinSize: number | null = null;
  try {
    const verify = await statRemoteFiles(conn, [twinPath]);
    const s = verify.missing.length > 0 ? null : (verify.sizes[0] ?? null);
    if (s != null && s > 0) twinSize = s;
  } catch {
    /* verified absent below */
  }
  if (twinSize == null) {
    return {
      ok: false,
      error: `the converter reported success but ${twinPath} did not verify on the cluster — run again (the .cs was not downloaded, the retry is cheap)`,
    };
  }
  phase(`star written on the cluster: ${twinPath} (verified ${twinSize.toLocaleString()} bytes)`);

  const censusNote =
    conv.censusTotalMrc > conv.stacks.length
      ? ` · ${conv.stacks.length} of ${conv.censusTotalMrc} .mrc stack(s) linked — only the ones this star references (the rest stay untouched)`
      : ` · ${conv.stacks.length} stack(s) linked`;
  const opticsNote = `${f6(conv.optics.voltage)} kV · Cs ${f6(conv.optics.cs)} mm · ac ${f6(conv.optics.ac)} · pixel ${f6(conv.optics.angpix)} Å`;
  const alignNote =
    conv.alignment === "3D"
      ? "3D alignments (Rodrigues → Euler)"
      : conv.alignment === "2D"
        ? "2D alignments (psi)"
        : "no alignments (picked-only set)";
  const unmappedNote = conv.unmapped.length > 0 ? ` · ${conv.unmapped.length} unmapped .cs field(s) skipped` : "";
  // t366 — the sampling provenance the twin probed ON the cluster (the
  // stacks are local files there): verified / corrected / the honest
  // degraded note, ONE sentence shape across every lane
  const samplingSeg = opticsSamplingSegment({
    box: conv.physical?.box ?? null,
    angpix: conv.physical?.angpix ?? null,
    metaAngpix: conv.optics.angpix,
    probed: conv.stacksProbed ?? 0,
    unreadable: conv.stacksUnreadable ?? 0,
    csVariants: conv.csVariants ?? [],
  });
  const result =
    `REMOTE[cryo@${conn.host}]: ${conv.particles} particles converted from ${resolved.jobLabel}${censusNote} · ${conv.stacks.length} stack(s) → micrographs/ · ${opticsNote} · ${alignNote}${unmappedNote}${samplingSeg}` +
    (conv.opticsGroups > 1 ? ` · ${conv.opticsGroups} optics groups` : "") +
    ` · converted ON the cluster in place (no .cs download, no star upload)`;
  const logText = [
    `CryoFlow cluster-side CryoSPARC conversion ${new Date().toISOString()}`,
    `source: ${resolved.primary}${resolved.passthrough ? ` + ${resolved.passthrough}` : ""}`,
    `cs project root: ${resolved.csProjectRoot}`,
    `python: ${pyExe}`,
    `invertY: ${opts.invertY}`,
    `particles: ${conv.particles} · referenced stacks: ${conv.stacks.length}${censusNote}`,
    `optics: ${opticsNote} · ${alignNote}${samplingSeg}`,
    conv.unmapped.length > 0 ? `unmapped fields: ${conv.unmapped.join(", ")}` : "",
    `output: ${twinPath} (cluster) — written in place, verified ${twinSize.toLocaleString()} bytes · ${conv.durationSec}s on the cluster; no local mirror by design (downstream jobs read the twin)`,
    result,
    "",
  ]
    .filter(Boolean)
    .join("\n");
  await finishNativeRunOnCluster(
    job,
    workdir,
    conn,
    remoteRoot,
    twinPath,
    twinSize,
    "particles_star",
    starPath,
    [{ path: "particles.star", size: twinSize }],
    "engine-native: cryosparc cs → star (cluster-side, selective links)",
    result,
    logText,
    errText
  );
  return { ok: true, result };
}

/**
 * t353/t360 — the remote manifest, INLINED (the engine↔remote-run cycle is
 * broken on purpose — csMirrorPath/expandCsRemoteRoot above are the
 * precedent; remote-files.ts imports remote-run.ts, so importing its
 * writer here would close the loop). Byte-shape identical to
 * writeRemoteManifest (remote-files.ts): the outputs route lists manifest
 * files as "on cluster" cards and the file route fetches them over SSH
 * on demand — without it, a cluster-side cs2star's or mapimport's Files
 * tab would show nothing at all.
 */
function writeNativeRemoteManifest(
  workdir: string,
  connectionId: string,
  remoteWorkdir: string,
  files: Array<{ path: string; size: number }>
): void {
  try {
    mkdirSync(workdir, { recursive: true });
    writeFileSync(
      path.join(workdir, ".cf-remote-manifest.json"),
      JSON.stringify({ version: 1, writtenAt: new Date().toISOString(), connectionId, remoteWorkdir, files }, null, 2),
      "utf8"
    );
  } catch {
    /* best-effort bookkeeping — never the run */
  }
}

/**
 * t352/t353/t360 — the shared finish for the engine-native CLUSTER lanes
 * (cs2star's upload + in-place lanes, mapimport's cluster-side copy):
 * record the run, mirror the witnesses into the twin dir, and register
 * the twin on the record — the exact block the t352 lane grew, extracted
 * so the lanes cannot drift. `outputKey`/`localOutPath` name the record's
 * output entry (the LOCAL mirror path of record — the twin registration
 * below is what downstream cluster consumers resolve through);
 * `manifestFiles` lists the twin dir's payload for the Files tab when the
 * local copy never landed (the in-place / cluster-copy shape).
 */
async function finishNativeRunOnCluster(
  job: EngineJobRef,
  workdir: string,
  conn: RemoteConnection,
  remoteRoot: string,
  twinPath: string,
  twinSize: number | null,
  outputKey: string,
  localOutPath: string,
  manifestFiles: Array<{ path: string; size: number }>,
  cmdLabel: string,
  result: string,
  logText: string,
  errText: string
): Promise<void> {
  const twinDir = twinPath.slice(0, twinPath.lastIndexOf("/"));
  // t353 — the cluster-side lane has NO local copy (the whole point): the
  // manifest lets the outputs route list the twin as an on-cluster file
  // (the fallback lane's local copy makes the manifest entry a no-op
  // there — the route's localSet dedupe skips it)
  if (!existsSync(localOutPath) && twinSize != null && manifestFiles.length > 0) {
    writeNativeRemoteManifest(workdir, conn.id, twinDir, manifestFiles);
  }
  recordNativeRun(job, workdir, cmdLabel, { [outputKey]: localOutPath }, result, logText);
  // the record recordNativeRun just wrote: its startedAt is the identity
  // the persistence guard below compares against (the probeRemoteOutputs /
  // finalize pattern — recordNativeRun stamps a FRESH startedAt on every
  // write, so only a record that is still THIS conversion may carry the
  // twin; a re-run that already replaced it keeps its own shape)
  const nativeRec = getRun(job.id);
  // the witnesses ride along: the log route serves remote records from
  // the CLUSTER workdir, so without the twin-dir copies the finished
  // job's log tab would fetch an empty console. Best-effort by design —
  // a witness must not be able to kill the finished run — and the
  // ledger's t346 logTail cache below carries the tail lane even when
  // the cluster copy is missing.
  const twinLogText = (() => {
    try {
      return readFileSync(path.join(workdir, "run.out"), "utf8");
    } catch {
      return logText; // the file itself unreadable — the summary stands in
    }
  })();
  const logOutOk = await remoteUpload(conn, twinLogText, `${twinDir}/run.out`);
  const logErrOk = await remoteUpload(conn, errText, `${twinDir}/run.err`);
  if (!logOutOk || !logErrOk) {
    console.log(
      `engine: cs2star ${job.id.slice(-8)} — star twin verified at ${twinPath}, but the run.out/run.err witnesses did not upload (the local log stays authoritative; the ledger cache serves the tail)`
    );
  }
  updateRun(job.id, (cur) =>
    nativeRec && cur.startedAt === nativeRec.startedAt && cur.done && cur.exitCode === 0
      ? {
          ...cur,
          remote: {
            connectionId: conn.id,
            connectionName: conn.name,
            host: `${conn.host}:${conn.port}`,
            user: conn.username,
            module: conn.defaultModule ?? "",
            mode: "direct",
            remoteRoot,
            remoteWorkdir: twinDir,
            pid: null,
            slurmId: null,
            phase: "running",
            remoteOutputs: { ...(cur.remote?.remoteOutputs ?? {}), [outputKey]: twinPath },
            logTailOut: twinLogText.slice(-4096),
            logTailErr: errText.slice(-2048),
            logTotalLines: twinLogText.split("\n").length,
            logTailAt: Date.now(),
          },
        }
      : null
  );
}

/** The runner: cluster .cs bytes → star + SELECTIVE links; local .cs same. */
async function runCs2StarNative(job: EngineJobRef): Promise<NativeResult> {
  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const csPathRaw = String(job.params.csPath ?? "").trim();
  if (!csPathRaw) {
    return {
      ok: false,
      error: "Pick the CryoSPARC job folder (J###) or the particles.cs file in the params tab first",
    };
  }
  const invertY = job.params.invertY === true;
  const fallback = {
    angpix: num(job, "pixelSize", 1) > 0 ? num(job, "pixelSize", 1) : undefined,
    voltage: num(job, "voltage", 300),
    cs: num(job, "cs", 2.7),
    ac: num(job, "ampContrast", 0.1),
  };

  const meta = getProjectMeta(job.projectId);
  const connId = meta?.remote?.connectionId ?? null;
  const conn = connId ? (getConnection(connId) ?? null) : null;

  let primaryBytes: Buffer;
  let ptBytes: Buffer | null = null;
  let csProjectRoot: string;
  let jobLabel: string;
  let linkPlan: Array<{ target: string; linkName: string }>;
  let linkDirNote = "";
  let censusNote = "";

  if (conn) {
    // ---- the CLUSTER lane: discover, download, convert, link -----------
    // t340 — every phase speaks a line into run.out (beginNativeRun opened
    // it): the inspector's Log tab tails the file, and a marathon with no
    // interim lines reads as dead — exactly the field report's
    // 「没有返回log」 while 325k particles downloaded and 10k links landed.
    const phase = (line: string) => nativePhaseLog(workdir, line);
    const resolved = await resolveCsInputsRemote(conn, csPathRaw);
    if ("error" in resolved) return { ok: false, error: resolved.error };
    csProjectRoot = resolved.csProjectRoot;
    jobLabel = resolved.jobLabel;
    phase(`discovered: ${resolved.primary}${resolved.passthrough ? ` + ${resolved.passthrough}` : ""}`);

    // t353 — THE CLUSTER-SIDE LANE (the user's own architecture call):
    // the params were decided HERE, the .cs datasets and the stacks live
    // THERE — so the conversion runs where the data is. A python with
    // numpy in the login shell (python3 → python → the pyem install's
    // own shebang) receives the few-KB converter script; the star is
    // written straight to its cluster twin and the link farm is built
    // in-process. Nothing below this block is removed — it stays as the
    // FALLBACK lane (download .cs → convert locally → upload the star)
    // for clusters without python, and for a probe the wire could not
    // answer (the download lane speaks its own honest errors there).
    // A script-level failure does NOT fall back: the same .cs bytes
    // would fail identically in the local converter — the error is the
    // verdict, and it names what did and did not happen.
    const py = await probeClusterPython(conn);
    if (py.exe) {
      phase(`cluster python: ${py.exe}`);
      return await runCs2StarOnCluster(job, workdir, conn, resolved, { invertY, fallback }, py.exe);
    }
    phase(
      py.definitive
        ? "no python3+numpy in the cluster's login shell — falling back to the engine-native lane (download .cs → convert locally → upload the star)"
        : "could not probe the cluster's python (the wire stayed silent) — falling back to the engine-native lane"
    );

    const want: string[] = [resolved.primary, ...(resolved.passthrough ? [resolved.passthrough] : [])];
    const { sizes, missing } = await statRemoteFiles(conn, want);
    if (missing.length > 0) return { ok: false, error: `Not on the cluster: ${missing[0]}` };
    const capMb = conn.maxFileMb > 0 ? conn.maxFileMb : 512;
    for (let i = 0; i < want.length; i++) {
      const size = sizes[i] ?? 0;
      if (size > capMb * 1024 * 1024) {
        return {
          ok: false,
          error: `${want[i]} is ${(size / 1024 / 1024).toFixed(0)} MB, over the connection's ${capMb} MB per-file cap — raise the cap in Remote clusters and run again`,
        };
      }
    }

    // t352 — the .cs dedupe: a re-run of the same conversion used to
    // re-download the same two .cs files (119.8 + 90.3 MB in the field
    // report) over the same wire for nothing. The workdir copy from the
    // previous run is byte-trustworthy exactly when the cluster's own
    // stat verdict (sizes, above) still names its size — the same
    // idempotence dialect stageFileTree applies to uploads. A size drift
    // (the CryoSPARC job re-exported) re-downloads; never a guess.
    const dlCached = async (
      remote: string,
      local: string,
      remoteSize: number | null
    ): Promise<{ buf: Buffer; reused: boolean }> => {
      const localPath = path.join(workdir, local);
      if (remoteSize != null && remoteSize > 0) {
        try {
          if (statSync(localPath).size === remoteSize) {
            return { buf: readFileSync(localPath), reused: true };
          }
        } catch {
          /* no readable local copy — the honest path below re-downloads */
        }
      }
      const n = await remoteDownload(conn, remote, localPath, capMb * 1024 * 1024);
      if (n == null || n < 0) throw new Error(`could not download ${remote} — the cluster connection answered poorly`);
      return { buf: readFileSync(localPath), reused: false };
    };
    const mbOf = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MB`;
    let primCs: { buf: Buffer; reused: boolean };
    let ptCs: { buf: Buffer; reused: boolean } | null = null;
    try {
      primCs = await dlCached(resolved.primary, "particles.cs", sizes[0] ?? null);
      ptCs = resolved.passthrough
        ? await dlCached(resolved.passthrough, "passthrough_particles.cs", sizes[1] ?? null)
        : null;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    primaryBytes = primCs.buf;
    ptBytes = ptCs ? ptCs.buf : null;
    // t352 — the receipt names what reused (zero wire bytes) and what
    // actually downloaded, per file
    const reusedCs = [
      ...(primCs.reused ? [`particles.cs (${mbOf(primCs.buf.length)}, remote unchanged)`] : []),
      ...(ptCs?.reused ? [`passthrough_particles.cs (${mbOf(ptCs.buf.length)}, remote unchanged)`] : []),
    ];
    const fetchedCs = [
      ...(!primCs.reused ? [`particles.cs (${mbOf(primCs.buf.length)})`] : []),
      ...(ptCs && !ptCs.reused ? [`passthrough_particles.cs (${mbOf(ptCs.buf.length)})`] : []),
    ];
    if (reusedCs.length > 0) phase(`reusing cached ${reusedCs.join(" · ")} — no re-download`);
    if (fetchedCs.length > 0) phase(`downloaded: ${fetchedCs.join(" · ")}`);

    // convert FIRST — the census decides which links exist at all
    let conv: Cs2StarResult;
    let csPrimaryRows: ReturnType<typeof npyRows>;
    let csPtRows: ReturnType<typeof npyRows> | null = null;
    let csConvertOpts = { invertY, fallback } as const;
    try {
      csPtRows = ptBytes ? npyRows(ptBytes, parseNpyHeader(ptBytes)) : null;
      csPrimaryRows = npyRows(primaryBytes, parseNpyHeader(primaryBytes));
      conv = csRowsToStar(csPrimaryRows, csPtRows ? [csPtRows] : [], { ...csConvertOpts });
    } catch (e) {
      return {
        ok: false,
        error: `could not parse the .cs: ${e instanceof Error ? e.message : String(e)} — is this a CryoSPARC 2+ dataset file?`,
      };
    }
    if (conv.particles === 0) {
      return { ok: false, error: `the .cs holds no windowable particle rows (blob/path missing) — ${resolved.primary}` };
    }
    phase(`converted: ${conv.particles} particles · ${conv.stacks.length} referenced stack(s)`);

    // ---- THE SELECTIVE LINKS (the optimization over the reference
    // script's link-everything): only the stacks the star references —
    // resolved against the CryoSPARC project root, verified to exist, then
    // linked with the .mrcs name RELION requires. Zero data movement.
    const resolveCs = (p: string) => (p.startsWith("/") ? p : `${csProjectRoot}/${p.replace(/^\.\//, "")}`);
    const targets = conv.stacks.map((s) => resolveCs(s.csPath));
    // t366 — probe the stacks' OWN headers over SSH (batches of 128: one
    // exec emits, per stack, its stat size + its 1 KB header as base64 —
    // the same bytes parseMrcHeaderBytes parses). The .cs metadata is a
    // CLAIM; the field report taught that a merged CryoSPARC set can carry
    // stale full-resolution metadata over 4×-binned stacks, so the
    // headers are the sampling truth. A batch that cannot answer
    // degrades to the .cs metadata with an honest note (the t313 rule:
    // never a block on a guess); stacks that PHYSICALLY mix samplings are
    // the one certain death and refuse by name.
    const probes: StackSamplingProbe[] = [];
    const missingStacks: string[] = [];
    let probeWireErr: string | null = null;
    for (let i = 0; i < targets.length && probeWireErr == null; i += 128) {
      const batch = targets.slice(i, i + 128);
      const script =
        `for f in ${batch.map((t) => `'${t.replace(/'/g, `'\\''`)}'`).join(" ")}; do ` +
        `if [ -f "$f" ]; then s=$(stat -c '%s' "$f" 2>/dev/null || echo 0); printf '%s\t%s\t' "$f" "$s"; head -c 1024 "$f" 2>/dev/null | base64 -w0; echo; ` +
        `else echo "MISSING\t$f"; fi; done; true`;
      let res: Awaited<ReturnType<typeof sshExec>>;
      try {
        res = await sshExec(conn, script, { timeoutMs: 90_000 });
      } catch (e) {
        probeWireErr = e instanceof Error ? e.message : String(e);
        break;
      }
      if (res.error) {
        probeWireErr = res.error;
        break;
      }
      for (const line of (res.stdout ?? "").split(/\r?\n/)) {
        if (line.startsWith("MISSING\t")) {
          missingStacks.push(line.slice(8));
          continue;
        }
        const seg = line.split("\t");
        if (seg.length < 3 || !seg[0] || !seg[1] || !seg[2]) continue;
        const size = Number(seg[1]);
        let box: number | null = null;
        let angpix: number | null = null;
        if (Number.isFinite(size) && size > 0) {
          try {
            const h = parseMrcHeaderBytes(Buffer.from(seg[2], "base64"), size);
            if (h && h.nx === h.ny) {
              box = h.nx;
              angpix = h.cella[0] > 0 ? h.cella[0] / h.nx : null;
            }
          } catch {
            /* an unparsable header is an unreadable stack — the note owns it */
          }
        }
        probes.push({ path: seg[0], box, angpix });
      }
    }
    if (missingStacks.length > 0) {
      return {
        ok: false,
        error: `${missingStacks.length} referenced particle stack(s) are missing on the cluster (first: ${missingStacks[0]}) — the .cs names files the CryoSPARC project no longer holds`,
      };
    }
    let samplingSeg: string;
    if (probeWireErr == null && probes.length > 0) {
      const verdict = judgeStackSamplings(probes);
      if (verdict.variants.length > 1) {
        return { ok: false, error: samplingRefusal(verdict.variants) };
      }
      if (verdict.sampling != null && (verdict.sampling.box != null || verdict.sampling.angpix != null)) {
        const claimed = conv.samplingVariants;
        conv = csRowsToStar(csPrimaryRows!, csPtRows ? [csPtRows] : [], {
          ...csConvertOpts,
          sampling: {
            ...(verdict.sampling.angpix != null ? { angpix: verdict.sampling.angpix } : {}),
            ...(verdict.sampling.box != null ? { box: verdict.sampling.box } : {}),
          },
        });
        phase(
          `optics from the stacks' own headers: ${verdict.sampling.box ?? "?"} px @ ${verdict.sampling.angpix != null ? verdict.sampling.angpix.toFixed(4) : "?"} Å — ` +
            `${conv.opticsGroups} group(s) ${claimed.length > 1 ? "corrected" : "confirmed"} (the .cs claimed ${claimed.length} sampling variant(s))`
        );
      }
      samplingSeg = opticsSamplingSegment({
        box: verdict.sampling?.box ?? null,
        angpix: verdict.sampling?.angpix ?? null,
        metaAngpix: conv.optics.angpix,
        probed: verdict.probed,
        unreadable: verdict.unreadable,
        csVariants: conv.samplingVariants,
      });
    } else if (probeWireErr != null) {
      samplingSeg = ` · optics from the .cs metadata (the stack-header probe did not answer: ${probeWireErr} — the sampling is unverified)`;
    } else {
      samplingSeg = opticsSamplingSegment({
        box: null,
        angpix: null,
        metaAngpix: conv.optics.angpix,
        probed: 0,
        unreadable: targets.length,
        csVariants: conv.samplingVariants,
      });
    }
    linkPlan = conv.stacks.map((s, i) => ({ target: targets[i]!, linkName: s.linkName }));

    // the receipt's census: how many .mrc files sit in the extract dirs the
    // links came from (the reference script linked ALL of them)
    const dirs = [...new Set(linkPlan.map((l) => l.target.replace(/\/[^/]+$/, "")))];
    const countRes = await sshExec(
      conn,
      dirs.map((d) => `ls -1 '${d.replace(/'/g, `'\\''`)}'/*.mrc 2>/dev/null | wc -l`).join(";"),
      { timeoutMs: 15_000 }
    );
    const counts = (countRes.stdout ?? "").split(/\r?\n/).map((l) => Number(l.trim())).filter((n) => Number.isFinite(n) && n > 0);
    const totalMrc = counts.reduce((a, b) => a + b, 0);
    censusNote =
      totalMrc > linkPlan.length
        ? ` · ${linkPlan.length} of ${totalMrc} .mrc stack(s) linked — only the ones this star references (the rest stay untouched)`
        : ` · ${linkPlan.length} stack(s) linked`;

    // create the link farm under the REMOTE project root (idempotent -fn)
    const remoteRoot = await expandCsRemoteRoot(conn, conn.remoteRoot || "~/cryoflow");
    const linkDir = `${remoteRoot.replace(/\/$/, "")}/${job.projectId}/micrographs`;
    await remoteMkdir(conn, linkDir);
    phase(`linking: ${linkPlan.length} stack(s) → ${linkDir} (selective — only what this star references)`);
    const BATCH = 250;
    for (let i = 0; i < linkPlan.length; i += BATCH) {
      const batch = linkPlan.slice(i, i + BATCH);
      const script = batch
        .map((l) => `ln -sfn '${l.target.replace(/'/g, `'\\''`)}' '${(linkDir + "/" + l.linkName).replace(/'/g, `'\\''`)}'`)
        .join(" && ");
      const res = await sshExec(conn, script, { timeoutMs: 120_000 });
      if (res.error || (res.code != null && res.code !== 0)) {
        return {
          ok: false,
          error: `could not link the referenced stacks into ${linkDir} (${(res.error || res.stderr || "").split("\n").filter(Boolean).slice(-1)[0] ?? "ssh exit " + res.code})`,
        };
      }
      // t340 — a 10k-stack link marathon gets a heartbeat every 10 batches
      // (2500 links): the log stays alive without spamming one line per 250.
      const done = Math.min(i + BATCH, linkPlan.length);
      if (done % 2500 === 0 || done === linkPlan.length) {
        phase(`linked ${done} of ${linkPlan.length} stack(s)`);
      }
    }
    linkDirNote = `stacks linked on the cluster at ${linkDir}`;

    // the star itself — the LOCAL copy first (the registry's own account
    // and every local consumer read it), then the cluster twin below
    const starPath = path.join(workdir, "particles.star");
    writeFileSync(starPath, conv.starText, "utf8");

    // t352 — THE STAR LIVES ON THE CLUSTER TOO (the field report: 325,549
    // particles converted, 10,664 stacks linked under remoteRoot/<project>/
    // micrographs — and the star itself landed ONLY in the local workdir, so
    // the cluster that runs every downstream job held no output of this
    // one). The twin rides the same mirror convention the staging layer
    // maps its uploads through (csMirrorPath above = mapLocalToRemote):
    // remoteRoot/<projectId>/<jobKey>/particles.star, the jobKey being the
    // local workdir's basename — the exact address shape extract's twins
    // use (…/extract_ufh1hg0u/particles.star in the field logs), so
    // downstream cluster consumers resolve it in place with no re-upload.
    const twinPath = csMirrorPath(starPath, remoteRoot);
    const twinDir = twinPath.slice(0, twinPath.lastIndexOf("/"));
    const starBytes = Buffer.from(conv.starText, "utf8");
    const starMb = starBytes.length / 1024 / 1024;
    if (starBytes.length > capMb * 1024 * 1024) {
      return {
        ok: false,
        error:
          `the converted star is ${starMb.toFixed(0)} MB, over the connection's ${capMb} MB per-file cap, ` +
          `so it could not be saved on the cluster at ${twinPath} — the local copy at ${starPath} is intact; ` +
          `raise the cap in Remote clusters and run again (the .cs download is cached, the retry is cheap)`,
      };
    }
    await remoteMkdir(conn, twinDir);
    phase(`uploading: particles.star (${starMb.toFixed(1)} MB) → ${twinPath}`);
    const upOk = await remoteUpload(conn, starBytes, twinPath);
    // verify BEFORE recording anything: the twin gates chain downstream
    // argv off this path — a twin that is not really there is worse than
    // no twin at all (the staging skip would point relion at a missing
    // file). statRemoteFiles throws on an SSH failure — that is a verify
    // failure too, with the wire's own word.
    let twinSize: number | null = null;
    let verifyWhy = "";
    if (upOk) {
      try {
        const verify = await statRemoteFiles(conn, [twinPath]);
        const vSize = verify.missing.length > 0 ? null : (verify.sizes[0] ?? null);
        if (vSize != null && vSize > 0) {
          twinSize = vSize;
        } else {
          verifyWhy = `the cluster reports the file ${vSize == null ? "absent" : `${vSize} bytes`} right after the upload`;
        }
      } catch (e) {
        verifyWhy = `the verify stat failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    if (twinSize == null) {
      return {
        ok: false,
        error:
          `could not save the star on the cluster at ${twinPath} — ` +
          `${upOk ? verifyWhy || "the cluster did not verify the file" : "the upload did not complete (the connection answered poorly)"}. ` +
          `The local copy at ${starPath} is intact and the ${linkPlan.length} stack links at ${linkDir} are already on the cluster; ` +
          `fix the cluster (check the login node's load, raise the cap in Remote clusters) and run again`,
      };
    }
    phase(`star saved on the cluster: ${twinPath} (${starMb.toFixed(1)} MB, verified ${twinSize.toLocaleString()} bytes)`);

    const opticsNote = `${f6(conv.optics.voltage)} kV · Cs ${f6(conv.optics.cs)} mm · ac ${f6(conv.optics.ac)} · pixel ${f6(conv.optics.angpix)} Å`;
    const alignNote =
      conv.alignment === "3D"
        ? "3D alignments (Rodrigues → Euler)"
        : conv.alignment === "2D"
          ? "2D alignments (psi)"
          : "no alignments (picked-only set)";
    const unmappedNote =
      conv.unmapped.length > 0 ? ` · ${conv.unmapped.length} unmapped .cs field(s) skipped` : "";
    // t352 — the envelope stays byte-identical (other components parse
    // it); only the twin fact is appended
    const result =
      `REMOTE[cryo@${conn.host}]: ${conv.particles} particles converted from ${jobLabel}${censusNote} · ${conv.stacks.length} stack(s) → micrographs/ · ${opticsNote} · ${alignNote}${unmappedNote}${samplingSeg}` +
      (conv.opticsGroups > 1 ? ` · ${conv.opticsGroups} optics groups` : "") +
      ` · star saved on the cluster`;
    const logText = [
      `CryoFlow engine-native CryoSPARC conversion ${new Date().toISOString()}`,
      `source: ${resolved.primary}${resolved.passthrough ? ` + ${resolved.passthrough}` : ""}`,
      `cs project root: ${csProjectRoot}`,
      `invertY: ${invertY}`,
      `particles: ${conv.particles} · referenced stacks: ${conv.stacks.length}${censusNote}`,
      `optics: ${opticsNote} · ${alignNote}${samplingSeg}`,
      conv.unmapped.length > 0 ? `unmapped fields: ${conv.unmapped.join(", ")}` : "",
      `output: ${twinPath} (cluster) + local mirror: ${starPath}`,
      result,
      "",
    ]
      .filter(Boolean)
      .join("\n");
    recordNativeRun(job, workdir, "engine-native: cryosparc cs → star (selective links)", { particles_star: starPath }, result, logText);
    // t352/t353 — the twin registration + witnesses live in the SHARED
    // finish now (finishNativeRunOnCluster — the exact block this lane
    // grew, extracted so the lanes cannot drift from it)
    await finishNativeRunOnCluster(
      job,
      workdir,
      conn,
      remoteRoot,
      twinPath,
      twinSize,
      "particles_star",
      starPath,
      [{ path: "particles.star", size: twinSize }],
      "engine-native: cryosparc cs → star (selective links)",
      result,
      logText,
      ""
    );
    return { ok: true, result };
  }

  // ---- the LOCAL lane (a .cs on this machine / the WSL bridge) --------
  const hostPath = csPathRaw;
  let primaryLocal = hostPath;
  if (!existsSync(primaryLocal)) {
    return { ok: false, error: `Not accessible: ${hostPath} — re-pick the particles.cs in the params tab` };
  }
  const dir = path.dirname(primaryLocal);
  const ptCandidates = readdirSync(dir).filter((f) => /_passthrough_particles\.cs$/i.test(f)).sort();
  const ptLocal = ptCandidates[0] ? path.join(dir, ptCandidates[0]) : null;
  csProjectRoot = dir.replace(/[/\\][^/\\]+$/, "");
  jobLabel = dir.split(/[\\/]/).pop() ?? dir;

  try {
    primaryBytes = readFileSync(primaryLocal);
    ptBytes = ptLocal ? readFileSync(ptLocal) : null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  let conv: Cs2StarResult;
  let csPrimaryRows: ReturnType<typeof npyRows>;
  let csPtRows: ReturnType<typeof npyRows> | null = null;
  try {
    csPtRows = ptBytes ? npyRows(ptBytes, parseNpyHeader(ptBytes)) : null;
    csPrimaryRows = npyRows(primaryBytes, parseNpyHeader(primaryBytes));
    conv = csRowsToStar(csPrimaryRows, csPtRows ? [csPtRows] : [], { invertY, fallback });
  } catch (e) {
    return {
      ok: false,
      error: `could not parse the .cs: ${e instanceof Error ? e.message : String(e)} — is this a CryoSPARC 2+ dataset file?`,
    };
  }
  if (conv.particles === 0) {
    return { ok: false, error: `the .cs holds no windowable particle rows (blob/path missing) — ${primaryLocal}` };
  }

  // local selective links: <project>/micrographs/<name>.mrcs → the .mrc
  const projectDir = projectDirFor(job);
  const micDir = path.join(projectDir, "micrographs");
  mkdirSync(micDir, { recursive: true });
  const resolveLocal = (p: string) => (path.isAbsolute(p) ? p : path.join(csProjectRoot, p));
  const missingLocal: string[] = [];
  // t366 — the stacks are LOCAL files: read each 1 KB header with the
  // same parser every other lane uses, and let the stacks' own numbers
  // judge the .cs metadata's sampling claim (verified / corrected / the
  // honest degraded note; physically mixed samplings refuse by name)
  const probes: StackSamplingProbe[] = [];
  for (const s of conv.stacks) {
    const target = resolveLocal(s.csPath);
    if (!existsSync(target)) {
      missingLocal.push(target);
      continue;
    }
    let box: number | null = null;
    let angpix: number | null = null;
    try {
      const fh = openSync(target, "r");
      const buf = Buffer.alloc(1024);
      const got = readSync(fh, buf, 0, 1024, 0);
      closeSync(fh);
      if (got >= 1024) {
        const h = parseMrcHeaderBytes(buf, statSync(target).size);
        if (h && h.nx === h.ny) {
          box = h.nx;
          angpix = h.cella[0] > 0 ? h.cella[0] / h.nx : null;
        }
      }
    } catch {
      /* an unreadable header is the note's business, never the run's */
    }
    probes.push({ path: target, box, angpix });
  }
  if (missingLocal.length > 0) {
    return {
      ok: false,
      error: `${missingLocal.length} referenced particle stack(s) not found (first: ${missingLocal[0]}) — the .cs names files this machine no longer holds`,
    };
  }
  let samplingSeg: string;
  if (probes.length > 0) {
    const verdict = judgeStackSamplings(probes);
    if (verdict.variants.length > 1) {
      return { ok: false, error: samplingRefusal(verdict.variants) };
    }
    if (verdict.sampling != null && (verdict.sampling.box != null || verdict.sampling.angpix != null)) {
      conv = csRowsToStar(csPrimaryRows!, csPtRows ? [csPtRows] : [], {
        invertY,
        fallback,
        sampling: {
          ...(verdict.sampling.angpix != null ? { angpix: verdict.sampling.angpix } : {}),
          ...(verdict.sampling.box != null ? { box: verdict.sampling.box } : {}),
        },
      });
    }
    samplingSeg = opticsSamplingSegment({
      box: verdict.sampling?.box ?? null,
      angpix: verdict.sampling?.angpix ?? null,
      metaAngpix: conv.optics.angpix,
      probed: verdict.probed,
      unreadable: verdict.unreadable,
      csVariants: conv.samplingVariants,
    });
  } else {
    samplingSeg = opticsSamplingSegment({
      box: null,
      angpix: null,
      metaAngpix: conv.optics.angpix,
      probed: 0,
      unreadable: conv.stacks.length,
      csVariants: conv.samplingVariants,
    });
  }
  for (const s of conv.stacks) {
    const target = resolveLocal(s.csPath);
    const link = path.join(micDir, s.linkName);
    try {
      rmSync(link, { force: true });
      symlinkSync(target, link, "file");
    } catch {
      /* best effort — the star still speaks the name; a re-run re-points */
    }
  }
  const totalMrcLocal = readdirSync(path.dirname(resolveLocal(conv.stacks[0]!.csPath))).filter((f) => /\.mrc$/i.test(f)).length;
  censusNote =
    totalMrcLocal > conv.stacks.length
      ? ` · ${conv.stacks.length} of ${totalMrcLocal} .mrc stack(s) linked — only the referenced ones`
      : ` · ${conv.stacks.length} stack(s) linked`;
  linkDirNote = `stacks linked at ${micDir}`;

  const starPath = path.join(workdir, "particles.star");
  writeFileSync(starPath, conv.starText, "utf8");
  const opticsNote = `${f6(conv.optics.voltage)} kV · Cs ${f6(conv.optics.cs)} mm · ac ${f6(conv.optics.ac)} · pixel ${f6(conv.optics.angpix)} Å`;
  const alignNote =
    conv.alignment === "3D"
      ? "3D alignments (Rodrigues → Euler)"
      : conv.alignment === "2D"
        ? "2D alignments (psi)"
        : "no alignments (picked-only set)";
  const result = `${conv.particles} particles converted from ${jobLabel}${censusNote} · ${conv.stacks.length} stack(s) → micrographs/ · ${opticsNote} · ${alignNote}${samplingSeg}`;
  const logText = [
    `CryoFlow engine-native CryoSPARC conversion ${new Date().toISOString()}`,
    `source: ${primaryLocal}${ptLocal ? ` + ${ptLocal}` : ""}`,
    `invertY: ${invertY}`,
    `particles: ${conv.particles} · referenced stacks: ${conv.stacks.length}${censusNote}`,
    `optics: ${opticsNote} · ${alignNote}${samplingSeg}`,
    conv.unmapped.length > 0 ? `unmapped fields: ${conv.unmapped.join(", ")}` : "",
    `output: ${starPath}`,
    result,
    "",
  ]
    .filter(Boolean)
    .join("\n");
  recordNativeRun(job, workdir, "engine-native: cryosparc cs → star (selective links)", { particles_star: starPath }, result, logText);
  void linkDirNote;
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
    // named per RELION's combined-coordinates convention (data_coordinate_files):
    // extract's --coord_list reader is name-agnostic (first data_ block), but
    // topaz --topaz_train_picks reads ONLY data_coordinate_files — naming this
    // block correctly makes manual picks directly trainable.
    "data_coordinate_files",
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

  writeFileSync(
    outStar,
    // t311 — the rows re-point at the stacks from THEIR new home (project-relative)
    rebaseParticleRefs(outLines.join("\n") + "\n", inStar, projectDirFor(job))
  );
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

/**
 * Select2d: RELION "Subset selection" on 2D class averages, programmatic
 * edition. The input is a Class2D run's per-iteration data STAR (every row
 * carries _rlnClassNumber); the output keeps ONLY the rows whose class is
 * selected — "auto" (occupancy ≥ cutoff × best class) or an explicit
 * comma list driven by the class gallery in the job panel.
 */
async function runSelect2dNative(job: EngineJobRef, upstream: UpstreamRef[]): Promise<NativeResult> {
  const resolved = resolveInputs("select2d", upstream);
  if (resolved.missing) return { ok: false, error: resolved.missing, wait: resolved.wait };
  const inStar = resolved.inputs.particles_star;

  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const outStar = path.join(workdir, "particles_select2d.star");

  // ---- selection expression -------------------------------------------
  const rawSel = String((job.params as Record<string, unknown> | null)?.selectedClasses ?? "auto").trim();
  const cutoff = Math.max(0, Math.min(1, num(job, "occupancyCutoff", 0.5)));
  const explicit =
    rawSel !== "auto" && rawSel !== ""
      ? [...new Set(
          rawSel
            .split(/[,;\s]+/)
            .map((s) => parseInt(s, 10))
            .filter((n) => Number.isFinite(n) && n > 0)
        )]
      : [];

  const text = readFileSync(inStar, "utf8");
  const blocks = parseStarBlocks(text);
  const outLines: string[] = [];
  let total = 0;
  let kept = 0;
  const classStats: { cls: number; count: number; kept: boolean }[] = [];
  let keep: Set<number> | null = null;
  let mode = "";

  for (const block of blocks) {
    outLines.push(block.header, "");
    const lines = block.lines;
    const isParticles = lines.some((l) => l.trim().startsWith("_rlnImageName"));
    if (!isParticles) {
      for (const l of lines) outLines.push(l);
      outLines.push("");
      continue;
    }
    let i = 0;
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

    const classCol = labelColumn(lines, i, "_rlnClassNumber");
    if (classCol < 0) {
      return {
        ok: false,
        error: `input STAR has no _rlnClassNumber column (${inStar}) — wire the 2D Classification job's particles output, not a raw Extract star`,
      };
    }

    // occupancy per class
    const counts = new Map<number, number>();
    for (let r = i; r < lines.length; r++) {
      const t = lines[r].trim();
      if (!t) continue;
      total++;
      const cls = parseInt(t.split(/\s+/)[classCol] ?? "", 10);
      if (Number.isFinite(cls) && cls > 0) counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }

    // resolve the keep set once per run (single particles block in practice)
    if (!keep) {
      const available = [...counts.keys()].sort((a, b) => a - b);
      if (explicit.length > 0) {
        keep = new Set(explicit.filter((c) => counts.has(c)));
        const missing = explicit.filter((c) => !counts.has(c));
        if (keep.size === 0) {
          return {
            ok: false,
            error: `selectedClasses lists ${explicit.join(", ")} but the classification only has classes ${available.join(", ")} — pick classes in the gallery first`,
          };
        }
        mode = `manual ${keep.size} class${keep.size > 1 ? "es" : ""}${missing.length > 0 ? ` (ignored: ${missing.join(", ")})` : ""}`;
      } else {
        const maxCount = Math.max(0, ...counts.values());
        keep = new Set([...counts.entries()].filter(([, n]) => n >= cutoff * maxCount).map(([c]) => c));
        mode = `auto — occupancy ≥ ${cutoff}× best`;
      }
      for (const c of available) {
        classStats.push({ cls: c, count: counts.get(c) ?? 0, kept: keep.has(c) });
      }
    }

    for (let r = i; r < lines.length; r++) {
      const t = lines[r].trim();
      if (!t) continue;
      const cls = parseInt(t.split(/\s+/)[classCol] ?? "", 10);
      if (keep.has(cls)) {
        outLines.push(t);
        kept++;
      }
    }
    outLines.push("");
  }

  if (total === 0) {
    return { ok: false, error: `no particle rows found in ${inStar}` };
  }

  writeFileSync(
    outStar,
    // t311 — the rows re-point at the stacks from THEIR new home (project-relative)
    rebaseParticleRefs(outLines.join("\n") + "\n", inStar, projectDirFor(job))
  );
  const keptClasses = classStats.filter((c) => c.kept).length;
  const result = `${kept.toLocaleString()} of ${total.toLocaleString()} particles kept · ${keptClasses}/${classStats.length} classes (${mode})`;
  const logText = [
    `CryoFlow engine-native select2d ${new Date().toISOString()}`,
    `input:  ${inStar} (${total} particles)`,
    `mode:   ${mode}`,
    "class occupancy (count · kept):",
    ...classStats
      .sort((a, b) => b.count - a.count)
      .map((c) => `  class ${c.cls}: ${c.count} · ${c.kept ? "kept" : "PRUNED"}`),
    `output: ${outStar} (${kept} particles)`,
    result,
    "",
  ].join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: 2D class selection (gallery / occupancy)",
    { particles_star: outStar },
    result,
    logText
  );
  return { ok: true, result };
}

/** Symmetry Expansion: replicate every particle row |G|× with composed ZYZ
 *  Euler angles (R_final = R_sym · R_orig — the icosahedral-symmetry-expander
 *  convention). Engine-native: pure STAR transform, no RELION binary needed. */
async function runSymexpandNative(job: EngineJobRef, upstream: UpstreamRef[]): Promise<NativeResult> {
  const resolved = resolveInputs("symexpand", upstream);
  if (resolved.missing) return { ok: false, error: resolved.missing, wait: resolved.wait };
  const inStar = resolved.inputs.particles_star;

  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const outStar = path.join(workdir, "particles_symexpand.star");

  // ---- group generation -----------------------------------------------
  const group = str(job, "symmetryGroup", "I").trim().toUpperCase();
  const icoSubset = str(job, "icoSubset", "full").trim().toLowerCase();
  const doDedupe = flag(job, "deduplicate");
  let groupResult: { matrices: Mat3[]; count: number; description: string };
  try {
    groupResult = generatePointGroup({ group, icoSubset } as PointGroupSpec);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : `unknown point group "${group}"` };
  }
  let matrices = groupResult.matrices;
  if (doDedupe) matrices = deduplicateRotations(matrices);
  if (matrices.length <= 1) {
    return {
      ok: false,
      error: `group ${group} expands to a single identity rotation — pick a non-trivial group (I, O, T, Cn≥2, Dn)`,
    };
  }

  // ---- STAR transform ---------------------------------------------------
  const text = readFileSync(inStar, "utf8");
  const blocks = parseStarBlocks(text);
  const outLines: string[] = [];
  let total = 0;
  let expanded = 0;

  for (const block of blocks) {
    outLines.push(block.header, "");
    const lines = block.lines;
    const isParticles = lines.some((l) => l.trim().startsWith("_rlnImageName"));
    if (!isParticles) {
      for (const l of lines) outLines.push(l);
      outLines.push("");
      continue;
    }
    let i = 0;
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

    const rotCol = labelColumn(lines, i, "_rlnAngleRot");
    const tiltCol = labelColumn(lines, i, "_rlnAngleTilt");
    const psiCol = labelColumn(lines, i, "_rlnAnglePsi");
    if (rotCol < 0 || tiltCol < 0) {
      return {
        ok: false,
        error: `input STAR has no _rlnAngleRot/_rlnAngleTilt columns (${inStar}) — symmetry expansion needs ORIENTED particles: wire a 3D classify/refine data star (or a previously expanded stack)`,
      };
    }

    for (let r = i; r < lines.length; r++) {
      const t = lines[r].trim();
      if (!t) continue;
      const parts = t.split(/\s+/);
      if (parts.length <= Math.max(rotCol, tiltCol)) continue;
      const rot = parseFloat(parts[rotCol]);
      const tilt = parseFloat(parts[tiltCol]);
      if (!Number.isFinite(rot) || !Number.isFinite(tilt)) continue;
      const psi = psiCol >= 0 && psiCol < parts.length ? parseFloat(parts[psiCol]) : 0;
      total++;
      // |G| copies: the identity element preserves the row, the others rotate
      for (const m of matrices) {
        const e = applySymmetryToEuler(m, rot, tilt, Number.isFinite(psi) ? psi : 0);
        const row = [...parts];
        row[rotCol] = e.rot.toFixed(6);
        row[tiltCol] = e.tilt.toFixed(6);
        if (psiCol >= 0 && psiCol < row.length) row[psiCol] = e.psi.toFixed(6);
        outLines.push(row.join(" "));
        expanded++;
      }
    }
    outLines.push("");
  }

  if (total === 0) {
    return { ok: false, error: `no particle rows found in ${inStar}` };
  }

  writeFileSync(
    outStar,
    // t311 — the rows re-point at the stacks from THEIR new home (project-relative)
    rebaseParticleRefs(outLines.join("\n") + "\n", inStar, projectDirFor(job))
  );
  const factor = matrices.length;
  const result = `${total.toLocaleString()} × ${factor} = ${expanded.toLocaleString()} particles (${group}${group === "I" ? `/${icoSubset}` : ""})`;
  const logText = [
    `CryoFlow engine-native symexpand ${new Date().toISOString()}`,
    `input:  ${inStar} (${total} particles)`,
    `group:  ${groupResult.description}${doDedupe ? " (deduplicated)" : ""}`,
    ...describeRotations(matrices).slice(0, 12).map(
      (d) =>
        `  axis [${d.axis.map((v) => v.toFixed(3)).join(", ")}] ${d.angleDeg.toFixed(1)}° order ${d.order}`
    ),
    factor > 12 ? `  … ${factor - 12} more rotations` : "",
    `output: ${outStar} (${expanded} particles)`,
    result,
    "",
  ]
    .filter(Boolean)
    .join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: point-group symmetry expansion (icosahedral-symmetry-expander)",
    { particles_star: outStar },
    result,
    logText
  );
  return { ok: true, result };
}

/** Orientation Rebalancer: fib-sphere binning + per-bin percentile trimming
 *  (Orient-Rebalancer core). Writes the kept subset AND a full stats report
 *  (rebalance_report.json) consumed by the inspector's report panel. */
async function runRebalanceNative(job: EngineJobRef, upstream: UpstreamRef[]): Promise<NativeResult> {
  const resolved = resolveInputs("rebalance", upstream);
  if (resolved.missing) return { ok: false, error: resolved.missing, wait: resolved.wait };
  const inStar = resolved.inputs.particles_star;

  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const outStar = path.join(workdir, "particles_rebalance.star");
  const reportFile = path.join(workdir, "rebalance_report.json");

  // ---- params -------------------------------------------------------------
  const criterionRaw = str(job, "exclusionCriterion", "loglik").trim().toLowerCase();
  const params: RebalanceParams = {
    numBins: Math.max(20, Math.round(num(job, "numBins", 200))),
    percentile: Math.min(100, Math.max(5, num(job, "percentile", 90))),
    exclusionCriterion: (["loglik", "maxprob", "ncc", "random"] as const).includes(
      criterionRaw as ExclusionCriterion
    )
      ? (criterionRaw as ExclusionCriterion)
      : "loglik",
    mode: str(job, "mode", "standard").trim().toLowerCase() === "resolution" ? "resolution" : "standard",
    resolutionWeight: num(job, "resolutionWeight", 1),
    seed: Math.max(0, Math.round(num(job, "seed", 1))),
  };

  // ---- STAR → particles ---------------------------------------------------
  const text = readFileSync(inStar, "utf8");
  const blocks = parseStarBlocks(text);
  const outLines: string[] = [];

  // score column per criterion: RELION columns where HIGHER = better particle
  // → the core removes the highest score first, so orient as score = -value.
  const SCORE_LABELS: Record<ExclusionCriterion, string> = {
    loglik: "_rlnLogLikeliContribution",
    maxprob: "_rlnMaxValueProbDistribution",
    ncc: "_rlnNormCorrection",
    random: "",
  };

  let particles: RebParticle[] = [];
  let rows: string[][] = [];
  let total = 0;
  let scoreFallback = false;

  for (const block of blocks) {
    outLines.push(block.header, "");
    const lines = block.lines;
    const isParticles = lines.some((l) => l.trim().startsWith("_rlnImageName"));
    if (!isParticles) {
      for (const l of lines) outLines.push(l);
      outLines.push("");
      continue;
    }
    let i = 0;
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

    const rotCol = labelColumn(lines, i, "_rlnAngleRot");
    const tiltCol = labelColumn(lines, i, "_rlnAngleTilt");
    if (rotCol < 0 || tiltCol < 0) {
      return {
        ok: false,
        error: `input STAR has no _rlnAngleRot/_rlnAngleTilt columns (${inStar}) — rebalancing needs ORIENTED particles: wire a 3D classify/refine data star`,
      };
    }
    const scoreLabel = SCORE_LABELS[params.exclusionCriterion];
    const scoreCol = scoreLabel ? labelColumn(lines, i, scoreLabel) : -1;
    if (params.exclusionCriterion !== "random" && scoreCol < 0) {
      scoreFallback = true; // honest degrade: seeded random keeps the run usable
    }

    particles = [];
    rows = [];
    total = 0;
    for (let r = i; r < lines.length; r++) {
      const t = lines[r].trim();
      if (!t) continue;
      const parts = t.split(/\s+/);
      if (parts.length <= Math.max(rotCol, tiltCol)) continue;
      const rot = parseFloat(parts[rotCol]);
      const tilt = parseFloat(parts[tiltCol]);
      if (!Number.isFinite(rot) || !Number.isFinite(tilt)) continue;
      let score = 0;
      if (scoreCol >= 0 && scoreCol < parts.length) {
        const v = parseFloat(parts[scoreCol]);
        if (Number.isFinite(v)) score = -v; // oriented: HIGHER = removed first
      }
      const v = eulerToDirection(rot, tilt);
      particles.push({ index: total, rot, tilt, score, vx: v[0], vy: v[1], vz: v[2], binIndex: 0, included: true });
      rows.push(parts);
      total++;
    }
    break; // first particles block is the stack (RELION single-block in practice)
  }

  if (total === 0) {
    return { ok: false, error: `no particle rows found in ${inStar}` };
  }

  // ---- core algorithm --------------------------------------------------------
  const report: RebalanceReport = runRebalanceCore(particles, params);
  const keptSet = new Set(report.keptIndices);
  for (const idx of keptSet) outLines.push(rows[idx].join(" "));
  outLines.push("");

  writeFileSync(
    outStar,
    // t311 — the rows re-point at the stacks from THEIR new home (project-relative)
    rebaseParticleRefs(outLines.join("\n") + "\n", inStar, projectDirFor(job))
  );
  writeFileSync(reportFile, JSON.stringify(report, null, 2));

  const s = report.stats;
  const crit = scoreFallback
    ? `random (fallback — ${SCORE_LABELS[params.exclusionCriterion]} column absent)`
    : report.criterion;
  const result =
    `${s.totalAfter.toLocaleString()} of ${s.totalBefore.toLocaleString()} particles kept · ` +
    `anisotropy ${s.anisotropyBefore.toFixed(2)}→${s.anisotropyAfter.toFixed(2)} · ` +
    `uniformity ${s.countUniformityBefore.toFixed(2)}→${s.countUniformityAfter.toFixed(2)}`;
  const logText = [
    `CryoFlow engine-native rebalance (Orient-Rebalancer core) ${new Date().toISOString()}`,
    `input:  ${inStar} (${s.totalBefore} particles)`,
    `params: bins=${params.numBins} percentile=${params.percentile}% criterion=${crit} mode=${params.mode}${params.mode === "resolution" ? ` α=${params.resolutionWeight}` : ""} seed=${params.seed}`,
    `bins:   ${s.effectiveBins} non-empty · ${s.binsTrimmed} trimmed · removed ${s.removed} (${s.removedPercent.toFixed(1)}%)`,
    `3DFSC estimate: mean ${s.meanResolutionBefore.toFixed(2)}→${s.meanResolutionAfter.toFixed(2)} Å · median ${s.medianResolutionBefore.toFixed(2)}→${s.medianResolutionAfter.toFixed(2)} Å · anisotropy ${s.anisotropyBefore.toFixed(2)}→${s.anisotropyAfter.toFixed(2)}`,
    `count uniformity: ${s.countUniformityBefore.toFixed(3)}→${s.countUniformityAfter.toFixed(3)} · resolution CV ${s.resolutionCVBefore.toFixed(3)}→${s.resolutionCVAfter.toFixed(3)}`,
    `output: ${outStar} (${s.totalAfter} particles)`,
    `report: ${reportFile}`,
    `note: the 3DFSC here is a distribution-based estimate, not a true two-half-map directional FSC`,
    result,
    "",
  ].join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: orientation rebalancing (Orient-Rebalancer core)",
    { particles_star: outStar },
    result,
    logText
  );
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
  /**
   * Cluster-side external programs (the remote probe's per-module inventory:
   * motioncor2 / topaz / modelangelo / dynamight / tomo_* → absolute cluster
   * path). The remote layer passes the probed module's map; null/absent =
   * the LOCAL world (bin dir + host `which`). t262's finding #3: resolving
   * a cluster argv's externals on the local disk either fails honestly with
   * a misleading message or — worse — embeds a LOCAL path into a CLUSTER
   * command line. Externals belong to the world they run in.
   */
  externals?: Record<string, string> | null;
}

function outPath(ctx: BuildCtx, name: string): string {
  // t335 — POSIX-safe join, NO path.join. path.join is path.win32.join on
  // a Windows host, and the REMOTE lane hands buildArgv a CLUSTER-POSIX
  // workdir (/data03/…/extract_xxx): win32.join re-separates it into
  // \data03\…\extract_xxx, RELION on Linux reads no directory separator
  // in that string and writes ONE literal file of that whole name into
  // the process CWD (the field report: particles.star landed as
  // "\data03\Lijing\…\extract_ufh1hg0u\particles.star" in the project
  // root; the workdir never saw it and every downstream consumer — 2D
  // classification — starved on the missing star). Every FILE-valued
  // output slot built here (--part_star, refine-family --o, maskcreate /
  // postprocess / localres / joinstar) shared this leak on Windows
  // hosts; the DIR-valued slots (--o <workdir>/ for ctffind/motioncorr/
  // autopick, --part_dir, --odir) were safe because they concatenate.
  // Same doctrine as binJoin below: forward-slash join is correct for
  // POSIX dirs and equally valid for native Windows dirs (fs + spawn
  // accept forward slashes on every platform, and the WSL bridge's
  // hostToWsl translates either separator).
  return `${ctx.workdir.replace(/[\\/]+$/, "")}/${name}`;
}

// binJoin (imported from ./wsl-bridge) joins binary names onto an install
// bin dir WITHOUT path.join — distro-internal POSIX bin dirs get mangled by
// path.win32.join on Windows hosts (see wsl-bridge.ts for the full story).

/**
 * Resolve an external program executable.
 *  - native installs: bin dir first, then the host PATH (`which`)
 *  - WSL-bridged installs: the bin dir and PATH live INSIDE the distro —
 *    host existsSync/`which` cannot see them (and `which` does not exist on
 *    Windows at all) — so ask the distro itself with `command -v`.
 */
/**
 * Resolve an external program IN THE WORLD THE COMMAND WILL RUN IN:
 *  - remote (ctx.externals present, possibly empty): the probe already
 *    inventoried the cluster after `module load` — ask that map, never the
 *    local disk (a local hit would embed a local path into a cluster argv);
 *  - local (null/absent): bin dir first, then the host PATH (`which`).
 * The ctffind lane keeps its dedicated ctffindExe override (t262) — same
 * law, older wiring.
 */
async function externalFor(
  ctx: BuildCtx,
  key: string,
  names: string[]
): Promise<string | null> {
  if (ctx.externals) return ctx.externals[key] ?? null;
  return externalOnPath(ctx.binDir, names, ctx.bridge);
}

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
      if (existsSync(binJoin(binDir, n))) return binJoin(binDir, n);
      const found = await new Promise<string | null>((resolve) => {
        execFile("which", [n], { timeout: 2000, windowsHide: true }, (err, stdout) => {
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
/**
 * buildArgv — the one command-construction entry point for BOTH lanes
 * (local engine + remote cluster dispatch share this function). The core
 * switch below builds each type's curated argv; the t374 generic layer
 * then appends every RELION-table option the user set away from RELION's
 * own default (deduped by flag presence, so a curated builder's flag is
 * never doubled).
 */
export async function buildArgv(ctx: BuildCtx): Promise<string[] | { error: string }> {
  const built = await buildArgvCore(ctx);
  if (Array.isArray(built)) {
    try {
      appendRelionFlags(built, ctx.job.type, ctx.job.params ?? {});
    } catch {
      // the curated argv is complete and valid on its own — the generic
      // layer must never break a dispatch
    }
  }
  return built;
}

async function buildArgvCore(ctx: BuildCtx): Promise<string[] | { error: string }> {
  const { job, inputs, binDir } = ctx;
  const type = job.type;

  switch (type) {
    case "ctffind": {
      const argv = [
        binJoin(binDir, "relion_run_ctffind"),
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
      ];
      // t375 — RELION pushes --fast_search when NOT slow_search
      // (getCommandsCtffindJob, pipeline_jobs.cpp:1838-1842); the polarity is
      // inverted so the generic layer's flag was nulled — the curated builder
      // owns it now. Either side of the alias pair (phaseShift ↔ do_phaseshift)
      // drives the phase-shift block (:1808-1812).
      if (!flag(job, "slow_search")) argv.push("--fast_search");
      if (flagAnyTrue(job, "phaseShift", "do_phaseshift")) {
        argv.push(
          "--do_phaseshift",
          "--phase_min", str(job, "phase_min", "0"),
          "--phase_max", str(job, "phase_max", "180"),
          "--phase_step", str(job, "phase_step", "10"),
        );
      }
      // ctf_win rides only when moved off RELION's -1 default (:1818)
      const ctfWin = num(job, "ctf_win", -1);
      if (ctfWin !== -1) argv.push("--ctfWin", String(ctfWin));
      // ctx.ctffindExe: execution-context override (the remote layer passes
      // the CLUSTER-side ctffind; the sandbox default is host-local and
      // meaningless on a remote node)
      const ctffindExe = (ctx as BuildCtx & { ctffindExe?: string | null }).ctffindExe ?? resolveCtffind(ctx.bridge);
      if (ctffindExe) argv.push("--ctffind_exe", ctffindExe);
      return argv;
    }

    case "extract": {
      // t375 — box/rescale read EITHER key (curated boxSize ↔ RELION
      // extract_size; downsampleTo ↔ rescale under do_rescale —
      // pipeline_jobs.cpp:2588-2596)
      const box = Math.round(numAny(job, 128, "boxSize", "extract_size"));
      const curatedDown = Math.round(num(job, "downsampleTo", 64));
      const relionScale = flag(job, "do_rescale") ? Math.round(num(job, "rescale", 0)) : 0;
      let down = curatedDown;
      if (!(down > 0 && down < box)) down = relionScale > 0 ? relionScale : 0;
      const doScale = down > 0 && down < box;
      // bg radius: 0.75 × effective box / 2 (RELION default when bg_diameter
      // < 0 — pipeline_jobs.cpp:2584-2595); the rescale scale-factor ride is
      // the same algebra as the curated form below (bgDiam × effBox / box / 2)
      const bgDiam = aliasNum(job, "bgDiameter", -1, "bg_diameter", -1);
      const effBox = doScale ? down : box;
      const bg = bgDiam > 0 ? Math.round((bgDiam * effBox) / box / 2) : Math.round(0.375 * effBox);
      // Coordinate source: manualpick writes <workdir>/micrographs/*.coord —
      // relion_preprocess composes fn_coord = coord_dir + fn_post + suffix,
      // where fn_post is the mic path minus extension ("micrographs/X") —
      // so coord_dir points at the manualpick JOB dir (contains micrographs/).
      // AutoPick writes <its workdir>/micrographs/<mic>_autopick.star — same
      // composition, but suffix "_autopick.star" and the coord root two levels
      // above one of those files (RELION's own extract wiring from an AutoPick
      // job: --coord_dir <autopick jobdir> --coord_suffix _autopick.star).
      const coordsInput = inputs.coords_dir;
      const isCoordDir =
        existsSync(coordsInput) && statSync(coordsInput).isDirectory();
      let coordDir: string;
      let coordSuffix: string;
      if (isCoordDir) {
        coordDir = coordsInput + "/";
        coordSuffix = ".coord";
      } else if (/^_?autopick\.star$/i.test(path.basename(coordsInput))) {
        // a combined autopick.star at the workdir root — per-mic stars live
        // in its micrographs/ sibling dir with the _autopick.star suffix
        coordDir = path.dirname(coordsInput) + "/";
        coordSuffix = "_autopick.star";
      } else if (coordsInput.endsWith("_autopick.star")) {
        coordDir = path.dirname(path.dirname(coordsInput)) + "/";
        coordSuffix = "_autopick.star";
      } else {
        coordDir = path.dirname(coordsInput) + "/";
        coordSuffix = path.extname(coordsInput) || ".star";
      }
      const argv = [
        binJoin(binDir, "relion_preprocess"),
        "--i", inputs.micrographs_star,
        "--coord_dir", coordDir,
        "--coord_suffix", coordSuffix,
        "--part_star", outPath(ctx, "particles.star"),
        "--part_dir", ctx.workdir + "/",
        "--extract",
        "--extract_size", String(box),
      ];
      if (doScale) argv.push("--scale", String(down));
      // t375 — the do_norm gate (pipeline_jobs.cpp:2597-2604): pre-t374 rows
      // (undefined) and true keep the block; an explicit false drops --norm
      // --bg_radius --white_dust --black_dust entirely, exactly like RELION.
      // Dust: RELION's GUI default is -1 (off) while cryoflow has always sent
      // 3/-3 — a param still AT -1 keeps the curated 3/-3 (untouched argv), a
      // moved value rides verbatim.
      if (job.params.do_norm !== false && job.params.norm !== false) {
        const wd = num(job, "white_dust", -1);
        const bd = num(job, "black_dust", -1);
        argv.push(
          "--norm", "--bg_radius", String(bg),
          "--white_dust", String(wd !== -1 ? wd : 3),
          "--black_dust", String(bd !== -1 ? bd : -3),
        );
      }
      // t375 — the negative-stain inversion the user asked about
      // (preprocessing.cpp:90 --invert_contrast; pipeline_jobs.cpp:2605-2606;
      // RELION's GUI default is YES, so post-merge rows ride it)
      if (flagPresent(job, "do_invert")) argv.push("--invert_contrast");
      // t375 — autopick FOM threshold gate (pipeline_jobs.cpp:2572-2575)
      if (flag(job, "do_fom_threshold")) {
        argv.push("--minimum_pick_fom", String(num(job, "minimum_pick_fom", 0)));
      }
      // t375 — the extract helix suite (pipeline_jobs.cpp:2608-2632):
      // do_extract_helix gates everything; tubes/cut compose the asu/rise pair
      if (flag(job, "do_extract_helix")) {
        argv.push("--helix", "--helical_outer_diameter", str(job, "helical_tube_outer_diameter", "200"));
        if (flagPresent(job, "helical_bimodal_angular_priors")) argv.push("--helical_bimodal_angular_priors");
        if (flagPresent(job, "do_extract_helical_tubes")) {
          argv.push("--helical_tubes");
          if (flagPresent(job, "do_cut_into_segments")) {
            argv.push(
              "--helical_cut_into_segments",
              "--helical_nr_asu", String(Math.round(num(job, "helical_nr_asu", 1))),
              "--helical_rise", String(num(job, "helical_rise", 1)),
            );
          } else {
            argv.push("--helical_nr_asu", "1", "--helical_rise", "1");
          }
        }
      }
      return argv;
    }

    case "class2d": {
      // t375 — RELION's EM/VDAM algorithm switch (getCommandsClass2DJob,
      // pipeline_jobs.cpp:3190-3221): do_em → classic EM (--iter from the
      // curated `iterations`); do_grad (RELION 5's DEFAULT) → VDAM with
      // --grad --class_inactivity_threshold 0.1 --grad_write_iter 10 and
      // --iter from nr_iter_grad when the user moved it off 200 (the curated
      // `iterations` stays the fallback). Rows that predate the t374 param
      // merge carry NEITHER key — they keep the pre-t374 EM shape verbatim.
      const doEm = flag(job, "do_em");
      const doGrad = flag(job, "do_grad");
      // t381+t377-merge — the algorithm dialect, one truth. RELION 5's own
      // pair is do_em/do_grad (the t374 tables expose both verbatim); the
      // friendlier t381 select (`algorithm`: em|vdam) maps onto the same
      // pair. Explicit beats implicit; an untouched job keeps cryoflow's
      // curated historical default (EM, `iterations` epochs — the t372
      // chain's dialect). RELION 5's untouched GUI defaults to VDAM; one
      // click on the select reaches the same place.
      const algorithm = str(job, "algorithm", "");
      const useVdam =
        algorithm === "vdam" || (algorithm !== "em" && doGrad && !doEm);
      // VDAM's --iter counts MINI-BATCHES (nr_iter_grad, default 200 —
      // the t381 UI's miniBatches rides the same field); EM's counts
      // epochs (the curated `iterations` = nr_iter_em, default 25).
      const iterCount = Math.round(
        useVdam
          ? num(job, "miniBatches", num(job, "nr_iter_grad", 200))
          : num(job, "iterations", 25)
      );
      const argv = [
        binJoin(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 50))),
        "--tau2_fudge", String(num(job, "tau2Fudge", 2)),
        "--particle_diameter", String(num(job, "particleDiameter", 200)),
        "--pad", "2",
        "--iter", String(iterCount),
        // finer in-plane angular sampling → sharper class averages
        "--psi_step", String(num(job, "psiSampling", 6)),
        "--flatten_solvent",
        // class2d runs the SERIAL binary (WSL2 MPI stacks are the known-fragile
        // part — see the MPI prefix section in runRealJob), so thread-level
        // parallelism comes from --j (RELION defaults to 1 without it)
        "--j", String(Math.max(1, Math.round(num(job, "threads", 4)))),
      ];
      // t375+t381 — the VDAM trio rides exactly as RELION's GUI emits it
      // (pipeline_jobs.cpp:3211), gated by the unified dialect above.
      if (useVdam) {
        argv.push("--grad", "--class_inactivity_threshold", "0.1", "--grad_write_iter", "10");
      }
      // t352 — GUI parity: the t350-hardcoded --ctf/--zero_mask now read
      // their own params (default ON, so an untouched job argv is unchanged),
      // and the RELION 2D GUI's own defaults ride along (--center_classes).
      if (job.params.doCtf !== false) argv.push("--ctf");
      if (job.params.doZeroMask !== false) argv.push("--zero_mask");
      if (job.params.doCenter !== false) argv.push("--center_classes");
      if (flag(job, "ctfIntactFirstPeak")) argv.push("--ctf_intact_first_peak");
      // t375 — either side of the aliased skip-align pair: the curated bool
      // (skipAlign) or RELION's dont_skip_align=false (pipeline_jobs.cpp:3285)
      if (flag(job, "skipAlign") || job.params.dont_skip_align === false) argv.push("--skip_align");
      const ov = Math.round(num(job, "oversampling", 1));
      if (ov !== 1) argv.push("--oversampling", String(ov));
      if (flag(job, "allowCoarser")) argv.push("--allow_coarser_sampling");
      const oR = positiveNum(job, "offsetRange");
      if (oR != null) argv.push("--offset_range", String(oR));
      const oS = positiveNum(job, "offsetStep");
      if (oS != null) argv.push("--offset_step", String(oS));
      // t350 — the E-step resolution cap. The t341 flag this replaces
      // (--highres_limit) never existed in any RELION release (same audit
      // as refineAutoPool); the REAL option caps probability calculations
      // in the expectation step — a genuine speed lever for early
      // classifications (0 = unlimited, the default).
      const hl = num(job, "highresLimit", 0);
      if (hl > 0) argv.push("--strict_highres_exp", String(hl));
      // t375 — RELION's class2d helix suite (getCommandsClass2DJob,
      // pipeline_jobs.cpp:3308-3332): do_helix gates everything; the inner
      // block only while alignment actually runs (dont_skip_align).
      if (flag(job, "do_helix")) {
        argv.push("--helical_outer_diameter", str(job, "helical_tube_outer_diameter", "200"));
        if (job.params.dont_skip_align !== false) {
          if (flagPresent(job, "do_bimodal_psi")) argv.push("--bimodal_psi");
          argv.push("--sigma_psi", String(clamp090(num(job, "range_psi", 6)) / 3));
          if (flagPresent(job, "do_restrict_xoff")) {
            argv.push("--helix", "--helical_rise_initial", str(job, "helical_rise", "4.75"));
          }
        }
      }
      // t350 — the pooled-particle lever (--pool): an explicit user value
      // wins; 0 (the default) rides RELION 5's own GUI default (3).
      const userPool = num(job, "batchSize", 0);
      if (userPool > 0) argv.push("--pool", String(Math.max(1, Math.round(userPool))));
      else argv.push("--pool", String(refineAutoPool()));
      // t352 — the shared GUI-parity tail (disc-I/O trio + scratch keep-free
      // + validated extraArgs)
      const tail = refineTail(job);
      if (!Array.isArray(tail)) return tail;
      argv.push(...tail);
      return argv;
    }

    case "initialmodel": {
      // VDAM gradient refinement — no MPI (RELION forbids --grad with MPI)
      // t375 — RELION's inimodel --iter is the VDAM mini-batch count
      // (nr_iter, pipeline_jobs.cpp:3467; GUI default 200). The curated
      // `iterations` (default 50) stays the fallback; an nr_iter the user
      // moved off 200 wins (same rule as class2d's nr_iter_grad).
      let imIter = Math.round(num(job, "iterations", 200));
      const relionImIter = num(job, "nr_iter", 200);
      if (Math.abs(relionImIter - 200) > 1e-9) imIter = Math.round(relionImIter);
      const argv = [
        binJoin(binDir, "relion_refine"),
        "--grad", "--denovo_3dref",
        "--i", inputs.particles_star,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 1))),
        "--particle_diameter", String(num(job, "particleDiameter", 200)),
        // t375 — either side of the aliased symmetry pair (RELION: sym_name,
        // pipeline_jobs.cpp:3526). The do_run_C1 C1-then-align_symmetry dance
        // stays unwired — see the t375 worklog for why.
        "--sym", str(job, "symmetry", "D2") || str(job, "sym_name", ""),
        "--iter", String(imIter),
        "--flatten_solvent",
        "--zero_mask",
        // memory: VDAM allocates K reference + gradient volumes at padded box
        // size; pad 1 (128³ instead of 256³ grids) cuts RSS from ~1.7GB to
        // under 1GB — de-novo models only need ~30 Å detail, where the
        // un-padded FFT grid is more than sufficient (RELION default pad is 2).
        "--pad", "1",
      ];
      // t352 — CTF now reads its own param (default ON); the GUI-parity tail
      // carries scratch/keep-free + the validated extraArgs
      if (job.params.doCtf !== false) argv.push("--ctf");
      if (flag(job, "ctfIntactFirstPeak")) argv.push("--ctf_intact_first_peak");
      // fewer particles pooled per task → smaller E-step working set
      // (t352: the explicit param wins; 0 = RELION's GUI default 3)
      const imPool = num(job, "batchSize", 0);
      argv.push("--pool", String(imPool > 0 ? Math.max(1, Math.round(imPool)) : 3));
      const imTail = refineTail(job);
      if (!Array.isArray(imTail)) return imTail;
      argv.push(...imTail);
      return argv;
    }

    case "class3d": {
      const argv = [
        binJoin(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--ref", inputs.model_mrc,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 4))),
        "--particle_diameter", String(num(job, "particleDiameter", 200)),
        // t375 — either side of the aliased symmetry pair (sym_name)
        "--sym", str(job, "symmetry", "C1") || str(job, "sym_name", ""),
        // t375 — do_pad1 (RELION's bool) is the aliased twin of `padding`
        "--pad", String(job.params.do_pad1 === true ? 1 : Math.round(num(job, "padding", 2))),
        "--iter", String(Math.round(num(job, "iterations", 25))),
        "--flatten_solvent",
        "--j", String(Math.max(1, Math.round(num(job, "threads", 4)))),
      ];
      // t352 — GUI parity across the whole Class3D surface (every flag
      // verified against 3dem/relion 5.0 pipeline_jobs.cpp getCommands):
      if (job.params.doCtf !== false) argv.push("--ctf");
      if (flag(job, "ctfIntactFirstPeak")) argv.push("--ctf_intact_first_peak");
      // tau2_fudge now reads its OWN param (was hardcoded 4 — the RELION
      // Class3D GUI default, which is also the spec default)
      argv.push("--tau2_fudge", String(num(job, "tau2Fudge", 4)));
      if (flag(job, "doBlush")) argv.push("--blush");
      if (job.params.doZeroMask !== false) argv.push("--zero_mask");
      if (flag(job, "doFastSubsets")) argv.push("--fast_subsets");
      const hp = healpixOrderOf(job.params.sampling);
      if (hp != null) argv.push("--healpix_order", String(hp));
      const c3R = positiveNum(job, "offsetRange");
      if (c3R != null) argv.push("--offset_range", String(c3R));
      const c3S = positiveNum(job, "offsetStep");
      if (c3S != null) argv.push("--offset_step", String(c3S));
      if (flag(job, "allowCoarser")) argv.push("--allow_coarser_sampling");
      // local angular searches: RELION's GUI passes sigma_angles/3 — so do we
      // (t375: either side of the alias pair; RELION's own key wins when the
      // curated knob sits at its default)
      const c3L = positiveNum(job, "localSigmaAng") ?? (num(job, "sigma_angles", 5) !== 5 ? positiveNum(job, "sigma_angles") : null);
      if (c3L != null) argv.push("--sigma_ang", String(c3L / 3));
      // t375 — either side of the relax_sym pair (RELION: text, rides when
      // non-empty; pipeline_jobs.cpp:4006-4007)
      const c3X = positiveNum(job, "relaxSym") ?? (str(job, "relax_sym", "") !== "" ? num(job, "relax_sym", 0) : 0);
      if (c3X > 0) argv.push("--relax_sym", String(c3X));
      // t375 — --firstiter_cc rides unless the reference is on absolute
      // greyscale (pipeline_jobs.cpp:3916-3917). Present-and-false keeps
      // pre-t374 rows untouched; post-merge rows are seeded false → rides
      // (RELION's own default emission).
      if (job.params.ref_correct_greyscale === false) argv.push("--firstiter_cc");
      // t375 — the shared 3D helical suite (do_helix gates everything)
      helixSuite3d(job, argv, "class3d");
      // t350 — the pooled-particle lever, same as class2d (--pool:
      // RELION 5's GUI default 3 rides unless the user names one)
      const c3dPool = num(job, "batchSize", 0);
      if (c3dPool > 0) argv.push("--pool", String(Math.max(1, Math.round(c3dPool))));
      else argv.push("--pool", String(refineAutoPool()));
      // t381 — the Helix tab (RELION 5 master's own argv construction);
      // the σ family rides only without the local angular cone
      argv.push(...helicalArgs(job, { localAngularSearch: positiveNum(job, "localSigmaAng") != null }));
      const c3Tail = refineTail(job);
      if (!Array.isArray(c3Tail)) return c3Tail;
      argv.push(...c3Tail);
      return argv;
    }

    case "refine3d": {
      const firstiterCc = job.params.ref_correct_greyscale !== true; // t375 — pipeline_jobs.cpp:4406-4407
      const argv = [
        binJoin(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--ref", inputs.model_mrc,
        "--o", outPath(ctx, "run"),
        // t375 — either side of the aliased symmetry pair (sym_name)
        "--sym", str(job, "symmetry", "D2") || str(job, "sym_name", ""),
        "--particle_diameter", String(num(job, "particleDiameter", 200)),
        // t375 — do_pad1 (RELION's bool) is the aliased twin of `padding`
        "--pad", String(job.params.do_pad1 === true ? 1 : Math.round(num(job, "padding", 2))),
        ...(firstiterCc ? ["--firstiter_cc"] : []),
        "--ini_high", String(num(job, "iniHigh", 50)),
        // the reference may come from a different-box job (e.g. a low-res
        // InitialModel) — RELION resizes it to the particles' optics group
        // (t365: the REMOTE dispatch now prepares a sampling-matched copy
        // itself BEFORE submit, so this flag stays a fallback for the
        // lanes the pre-flight cannot judge — the local lane, unreadable
        // optics, user-driven --ref_angpix)
        "--trust_ref_size",
        "--split_random_halves",
        "--j", String(Math.max(1, Math.round(num(job, "threads", 4)))),
      ];
      // t352 — GUI parity: CTF / Blush / solvent-FSC / zero-mask now read
      // their own params (defaults match the RELION Refine3D GUI exactly)
      if (job.params.doCtf !== false) argv.push("--ctf");
      if (flag(job, "ctfIntactFirstPeak")) argv.push("--ctf_intact_first_peak");
      if (flag(job, "doBlush")) argv.push("--blush");
      if (job.params.doZeroMask !== false) argv.push("--zero_mask");
      if (flag(job, "doSolventFsc")) argv.push("--solvent_correct_fsc");
      if (flagAutoRefine(job)) argv.push("--auto_refine");
      else argv.push("--iter", String(Math.round(num(job, "iterations", 15))), "--tau2_fudge", String(num(job, "tau2Fudge", 1)));
      // the Auto-sampling tab (healpix degrees → order, like the GUI's
      // JobOption::getHealPixOrder)
      const rHp = healpixOrderOf(job.params.samplingStep);
      if (rHp != null) argv.push("--healpix_order", String(rHp));
      const rLhp = healpixOrderOf(job.params.autoLocalSampling);
      if (rLhp != null) argv.push("--auto_local_healpix_order", String(rLhp));
      if (flag(job, "autoFaster")) argv.push("--auto_ignore_angles", "--auto_resol_angles");
      const r3R = positiveNum(job, "offsetRange");
      if (r3R != null) argv.push("--offset_range", String(r3R));
      const r3S = positiveNum(job, "offsetStep");
      if (r3S != null) argv.push("--offset_step", String(r3S));
      // t375 — either side of the relax_sym pair (pipeline_jobs.cpp:4590-4591)
      const r3X = positiveNum(job, "relaxSym") ?? (str(job, "relax_sym", "") !== "" ? num(job, "relax_sym", 0) : 0);
      if (r3X > 0) argv.push("--relax_sym", String(r3X));
      // t375 — the shared 3D helical suite (do_helix gates everything)
      helixSuite3d(job, argv, "refine3d");
      // t350 — the pooled-particle lever, same as class2d/class3d
      const r3dPool = num(job, "batchSize", 0);
      if (r3dPool > 0) argv.push("--pool", String(Math.max(1, Math.round(r3dPool))));
      else argv.push("--pool", String(refineAutoPool()));
      // t381 — the Helix tab (shared builder; refine3d's own local angular
      // cone comes from auto_local_healpix_order, so the σ family rides)
      argv.push(...helicalArgs(job, {}));
      const r3Tail = refineTail(job);
      if (!Array.isArray(r3Tail)) return r3Tail;
      argv.push(...r3Tail);
      return argv;
    }

    case "maskcreate": {
      const argv = [
        binJoin(binDir, "relion_mask_create"),
        "--i", inputs.map_mrc,
        "--o", outPath(ctx, "mask.mrc"),
        "--lowpass", String(num(job, "lowpass", 15)),
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
        "--ini_threshold", String(num(job, "threshold", 0.02)),
        "--extend_inimask", String(Math.round(num(job, "extend", 3))),
        "--width_soft_edge", String(Math.round(num(job, "softEdge", 8))),
        "--j", "4",
      ];
      // t375 — the helical mask pair (getCommandsMaskcreateJob,
      // pipeline_jobs.cpp:4962-4966): --helix composes in the same line as
      // --z_percentage <value/100>
      if (flagPresent(job, "do_helix")) {
        argv.push("--helix", "--z_percentage", String(num(job, "helical_z_percentage", 30) / 100));
      }
      return argv;
    }

    case "postprocess": {
      const argv = [
        binJoin(binDir, "relion_postprocess"),
        "--i", inputs.half1_mrc,
        "--o", outPath(ctx, "postprocess"),
        "--mask", inputs.mask_mrc,
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
      ];
      if (flag(job, "autoBfac")) {
        argv.push("--auto_bfac", "--autob_lowres", String(num(job, "autobLowres", 10)));
      }
      // t375 — the MTF pair rides together off ONE file field
      // (getCommandsPostprocessJob, pipeline_jobs.cpp:5354-5358)
      const mtf = str(job, "fn_mtf", "").trim();
      if (mtf) argv.push("--mtf", mtf, "--mtf_angpix", String(num(job, "mtf_angpix", 1)));
      // t375 — the ad-hoc B-factor under its own radio (:5364-5367); reads
      // either side of the alias pair (t386: RELION's own default is -1000)
      if (flagPresent(job, "do_adhoc_bfac")) {
        argv.push("--adhoc_bfac", String(numAny(job, -1000, "adhocBfac", "adhoc_bfac")));
      }
      // t375 — the skip-FSC pair (:5370-5374)
      if (flagPresent(job, "do_skip_fsc_weighting")) {
        argv.push("--skip_fsc_weighting", "--low_pass", String(num(job, "low_pass", 5)));
      }
      const randomizeFrom = num(job, "randomizeFrom", 0);
      if (randomizeFrom > 0) argv.push("--randomize_at", String(randomizeFrom));
      return argv;
    }

    case "motioncorr": {
      // t375 — RELION's own-vs-MotionCor2 switch (getCommandsMotioncorrJob,
      // pipeline_jobs.cpp:1559-1594). RELION 5's GUI default is its OWN
      // CPU implementation (do_own_motioncor=true — the critical path for
      // clusters without a MotionCor2 licence/GPU); pre-t374 rows carry
      // neither key and keep the MotionCor2 shape verbatim.
      const own = flagPresent(job, "do_own_motioncor");
      let mc2 = "";
      if (!own) {
        // a user-typed executable wins over the probe (the params UI stores
        // cluster paths for remote jobs)
        mc2 =
          str(job, "fn_motioncor2_exe", "").trim() ||
          (await externalFor(ctx, "motioncor2", ["motioncor2", "MotionCor2"])) ||
          "";
        if (!mc2) {
          return {
            error: ctx.externals
              ? "MotionCor2 executable not found on the cluster (probed after module load) — install MotionCor2 there, switch on RELION's own implementation (do_own_motioncor), or run MotionCorr locally"
              : "MotionCor2 executable not found — switch on RELION's own implementation (do_own_motioncor), or import pre-averaged micrographs and skip MotionCorr",
          };
        }
      }
      const argv = [
        binJoin(binDir, "relion_run_motioncorr"),
        "--i", inputs.micrographs_star,
        "--o", ctx.workdir + "/",
      ];
      // :1551-1552 — the corrected-sum frame window, spa only; rides when
      // moved off RELION's defaults (1 / use-all)
      const ffs = Math.round(num(job, "first_frame_sum", 1));
      if (ffs !== 1) argv.push("--first_frame_sum", String(ffs));
      const lfs = Math.round(num(job, "last_frame_sum", -1));
      if (lfs > 0) argv.push("--last_frame_sum", String(lfs));
      if (own) {
        // :1563-1574 — --use_own --j <threads> (+ --float16 under its radio)
        argv.push("--use_own", "--j", String(Math.max(1, Math.round(num(job, "threads", 4)))));
        if (flagPresent(job, "do_float16")) argv.push("--float16");
      } else {
        argv.push("--use_motioncor2", "--motioncor2_exe", mc2);
        // :1589-1590 — extra wrapper args, verbatim
        const mc2Args = str(job, "other_motioncor2_args", "").trim();
        if (mc2Args) argv.push("--other_motioncor2_args", mc2Args);
        // pre-t374 shape ended with --j 4 — keep it for the MotionCor2 lane
        argv.push("--j", "4");
      }
      // :1596-1597 — defect map/text file
      const defect = str(job, "fn_defect", "").trim();
      if (defect) argv.push("--defect_file", defect);
      // :1599-1605 — the shared block. bin_factor reads either key (RELION
      // twin default 1); dose_per_frame is the aliasNum pair (curated 1.28 /
      // RELION 1 — the curated default keeps the pre-t374 emission).
      argv.push("--bin_factor", String(numAny(job, 1, "bin_factor")));
      argv.push("--bfactor", String(num(job, "bfactor", 150)));
      argv.push("--dose_per_frame", String(aliasNum(job, "dosePerFrame", 1.28, "dose_per_frame", 1)));
      // :1602 — pre-exposure rides when non-zero (curated never sent it)
      const preExp = num(job, "pre_exposure", 0);
      if (preExp !== 0) argv.push("--preexposure", String(preExp));
      argv.push(
        "--patch_x", String(Math.round(numAny(job, 5, "patchX", "patch_x"))),
        "--patch_y", String(Math.round(numAny(job, 5, "patchY", "patch_y"))),
      );
      // :1605 — EER fractionation rides when moved off the GUI default 32
      // (the runner's own default is 40 — motioncorr_runner.cpp:96)
      const eer = Math.round(num(job, "eer_grouping", 32));
      if (eer !== 32) argv.push("--eer_grouping", String(eer));
      // :1607-1608 — frame grouping, only when > 1
      const gf = Math.round(num(job, "group_frames", 1));
      if (gf > 1) argv.push("--group_frames", String(gf));
      // :1611-1639 — the gain block composes THREE flags off ONE file
      const gain = str(job, "fn_gain_ref", "").trim();
      if (gain) {
        argv.push(
          "--gainref", gain,
          "--gain_rot", String(gainRotIndex(job)),
          "--gain_flip", String(gainFlipIndex(job)),
        );
      }
      // do_dose_weighting rides via the generic layer (RELION default true,
      // :1641-1643); --save_noDW is nested under it (:1644-1647)
      if (flagAnyTrue(job, "do_dose_weighting") && flagPresent(job, "do_save_noDW")) {
        argv.push("--save_noDW");
      }
      // :1650-1683 — power spectra (own implementation only): the grouping
      // is round(dose_for_ps / dose_per_frame), floored at 1
      if (own && flagPresent(job, "do_save_ps")) {
        const doseForPs = num(job, "group_for_ps", 4);
        const doseRate = aliasNum(job, "dosePerFrame", 1.28, "dose_per_frame", 1);
        if (doseRate > 0 && doseForPs > 0) {
          argv.push("--grouping_for_ps", String(Math.max(1, Math.round(doseForPs / doseRate))));
        }
      }
      return argv;
    }

    case "autopick": {
      // Three picking methods (RELION 5 autopick): Laplacian-of-Gaussian is
      // reference-free (blob detection by size — works straight after CTF,
      // no Class2D needed); "References" is classic template matching and
      // requires 2D class averages; "Topaz" is the CNN wrapper (needs the
      // topaz python module in RELION's conda env, ships a general model).
      // Default = LoG so a fresh pipeline (Import → CTF → AutoPick) runs
      // end-to-end without references. NOTE pickname stays "autopick" in
      // every mode — Extract and the output discovery below key off the
      // _autopick.star suffix convention.
      const method = str(job, "pickingMethod", "Laplacian of Gaussian");
      const argv = [
        binJoin(binDir, "relion_autopick"),
        "--i", inputs.micrographs_star,
        "--odir", ctx.workdir + "/",
        "--pickname", "autopick",
      ];
      // explicit angpix: the import star carries rlnMicrographPixelSize, but
      // LoG blob diameters / Topaz radii are in Å — never let a default of 1
      // scale them.
      const mpx = micAngpix(ctx.upstream);
      if (mpx) argv.push("--angpix", String(mpx));
      if (method === "References") {
        if (!inputs.refs_mrc) {
          return {
            error:
              "2D reference templates missing — connect a Class2D/InitialModel/Class3D output, or switch Picking method to Laplacian of Gaussian (reference-free)",
          };
        }
        argv.push(
          "--ref", inputs.refs_mrc,
          "--particle_diameter", String(num(job, "particleDiameter", 180)),
          "--threshold", String(num(job, "threshold", 0.05)),
          "--lowpass", String(num(job, "lowpass", 20)),
        );
        // t375 — the References-mode sub-flags the generic layer can't emit
        // (getCommandsAutopickJob, pipeline_jobs.cpp:2338-2395). Radios that
        // default TRUE in RELION ride for post-merge rows via flagPresent.
        // :2338-2339 — class averages are white-on-black: RELION inverts by default
        if (flagPresent(job, "do_invert_refs")) argv.push("--invert");
        // :2341-2346 — CTF correction of the references (RELION default true)
        if (flagPresent(job, "do_ctf_autopick")) {
          argv.push("--ctf");
          if (flagPresent(job, "do_ignore_first_ctfpeak_autopick")) argv.push("--ctf_intact_first_peak");
        }
        // :2347 — in-plane sampling, rides when moved off RELION's GUI default 5
        const psiSam = num(job, "psi_sampling_autopick", 5);
        if (psiSam !== 5) argv.push("--ang", String(psiSam));
        // :2349 — shrink factor, rides when moved off the default 0
        const shrinkF = num(job, "shrink", 0);
        if (shrinkF !== 0) argv.push("--shrink", String(shrinkF));
        // :2354-2355 — highpass when positive
        const hp = num(job, "highpass", -1);
        if (hp > 0) argv.push("--highpass", String(hp));
        // :2362-2363 — reference pixel size when positive
        const apr = num(job, "angpix_ref", -1);
        if (apr > 0) argv.push("--angpix_ref", String(apr));
        // :2366-2370 — the minimum inter-particle distance: helical segments
        // compose nr_asu × rise, everything else rides when moved off 100
        if (flag(job, "do_pick_helical_segments")) {
          argv.push("--min_distance", String(num(job, "helical_nr_asu", 1) * num(job, "helical_rise", 1)));
        } else {
          const md = aliasNum(job, "minDistance", 100, "mindist_autopick", 100);
          if (md !== 100) argv.push("--min_distance", String(md));
        }
        // :2373 — noise stddev cap, rides when the user moved either knob
        const msn = aliasNum(job, "maxStddevNoise", 0, "maxstddevnoise_autopick", 1.1);
        if (msn !== 0) argv.push("--max_stddev_noise", String(msn));
        // :2374-2375 — minimum average noise, rides when moved off -999
        const man = num(job, "minavgnoise_autopick", -999);
        if (man !== -999) argv.push("--min_avg_noise", String(man));
        // :2379-2387 — the helical-segment suite
        if (flag(job, "do_pick_helical_segments")) {
          argv.push("--helix");
          if (flagPresent(job, "do_amyloid")) argv.push("--amyloid");
          argv.push(
            "--helical_tube_outer_diameter", str(job, "helical_tube_outer_diameter", "200"),
            "--helical_tube_kappa_max", str(job, "helical_tube_kappa_max", "0.1"),
            "--helical_tube_length_min", str(job, "helical_tube_length_min", "-1"),
          );
        }
      } else if (method === "Topaz") {
        // relion_python_topaz is a conda-env python wrapper — it exists on
        // disk in every RELION 5 install, but the `topaz` MODULE may be
        // missing. A file-existence probe cannot catch that; if the module
        // is absent the run fails honestly and rootCauseDetail surfaces the
        // ModuleNotFoundError from run.err.
        // t387 — a user-typed topaz executable wins over the probe (the
        // motioncor2 lane's own rule: the params UI stores cluster paths for
        // remote jobs, and the merged fn_topaz_exe control was dead weight
        // until now — the engine only ever probed)
        const topaz =
          str(job, "fn_topaz_exe", "").trim() ||
          (await externalFor(ctx, "topaz", ["relion_python_topaz", "topaz"]));
        if (!topaz) {
          return {
            error: ctx.externals
              ? "Topaz executable not found on the cluster (probed after module load) — install topaz into RELION's python environment there (pip install topaz-denoise), or switch Picking method to Laplacian of Gaussian"
              : "Topaz executable not found — install topaz into RELION's python environment (pip install topaz-denoise), or switch Picking method to Laplacian of Gaussian",
          };
        }
        argv.push(
          "--topaz_extract",
          "--fn_topaz_exe", topaz,
          "--topaz_nr_particles", String(Math.round(num(job, "topazNrParticles", 300))),
          // particle diameter drives the extract radius (RELION converts
          // Å → pix with the micrograph pixel size)
          "--particle_diameter", String(num(job, "topazDiameter", 180)),
        );
        // t375 — the filament branch owns --topaz_threshold (RELION swaps in
        // topaz_filament_threshold there, pipeline_jobs.cpp:2251-2259)
        if (flagPresent(job, "do_topaz_filaments")) {
          argv.push(
            "--helix",
            "--topaz_threshold", str(job, "topaz_filament_threshold", "-5"),
          );
          const hl = num(job, "topaz_hough_length", -1);
          if (hl > 0) argv.push("--helical_tube_length_min", String(hl));
        } else {
          argv.push("--topaz_threshold", String(num(job, "topazThreshold", -6)));
        }
        const downscale = num(job, "topazDownscale", -1);
        if (downscale > 0) argv.push("--topaz_downscale", String(Math.round(downscale)));
        const workers = Math.round(num(job, "topazWorkers", 1));
        if (workers > 1) argv.push("--topaz_workers", String(workers));
        const extra = str(job, "topazArgs", "").trim();
        if (extra) argv.push("--topaz_args", extra);
        // trained model from an upstream Topaz Training job (empty = the
        // general topaz model)
        if (inputs.topaz_model) argv.push("--topaz_model", inputs.topaz_model);
      } else {
        argv.push(
          "--LoG",
          "--LoG_diam_min", String(num(job, "logDiamMin", 150)),
          "--LoG_diam_max", String(num(job, "logDiamMax", 180)),
          "--LoG_adjust_threshold", String(num(job, "logAdjustThreshold", 0)),
        );
        // t386 — RELION's own off-value is 999 (pipeline_jobs.cpp:2288-2289:
        // the flag rides only when < 999); the curated 99999-of-old was the
        // same intent with a different sentinel
        const upper = num(job, "logUpperThreshold", 999);
        if (upper > 0 && upper < 999) argv.push("--LoG_upper_threshold", String(upper));
        // t375 — either side of the aliased white-particle switch — RELION's
        // log_invert ("Are the particles white?", pipeline_jobs.cpp:2292-2293)
        if (flagAnyTrue(job, "logInvert", "log_invert")) argv.push("--Log_invert");
        // t375 — log_maxres composes the PAIR --shrink 0 --lowpass (:2286);
        // it rides when moved off RELION's GUI default 20 (the curated argv
        // never sent it, and the runner's own lowpass default is off)
        const logMaxRes = num(job, "log_maxres", 20);
        if (logMaxRes !== 20) argv.push("--shrink", "0", "--lowpass", String(logMaxRes));
        // t323 — RELION's own advice, verbatim: whenever the optimise-scale
        // rescale fires (large micrographs whose FFT sizes carry a big prime
        // — the user's 4096-px data hit prime 683, rescaled to 4048),
        // autopicker.cpp prints FOUR warning lines, the last one literally
        // "add --skip_optimise_scale to your autopick command to prevent
        // rescaling". CryoFly generates the command, so CryoFly takes the
        // advice: the LoG picker runs at exactly the requested resolution
        // with no prime-factor rescale and no warning chorus (autopicker.cpp
        // read(): do_optimise_scale = !checkOption("--skip_optimise_scale")
        // — a global argv option, honored in every picking mode).
        argv.push("--skip_optimise_scale");
      }
      return argv;
    }

    case "topaztrain": {
      // Train a Topaz CNN picking model on hand-picked coordinates:
      // relion_autopick --topaz_train --topaz_train_picks <coords.star> ...
      // The trained model lands in the job dir (topaz_model.sav) and feeds
      // an Auto-picking job's Topaz mode through --topaz_model. Needs the
      // topaz python module (same wrapper as extract) — a missing module
      // fails honestly in run.err and rootCauseDetail surfaces it.
      // t387 — same user-typed-wins rule as the picking lane above
      const topaz =
        str(job, "fn_topaz_exe", "").trim() ||
        (await externalFor(ctx, "topaz", ["relion_python_topaz", "topaz"]));
      if (!topaz) {
        return {
          error: ctx.externals
            ? "Topaz executable not found on the cluster (probed after module load) — install topaz into RELION's python environment there (pip install topaz-denoise)"
            : "Topaz executable not found — install topaz into RELION's python environment (pip install topaz-denoise)",
        };
      }
      if (!inputs.train_picks) {
        return {
          error:
            "Training picks missing — connect a Manual Picking job's coordinates (hand-picked particles are what the CNN learns from), or switch Auto-picking to Laplacian of Gaussian",
        };
      }
      // RELION attributes picks to micrographs via _rlnMicrographName, but
      // Auto-picking emits PER-micrograph stars with X/Y/FOM only (passing
      // one made RELION bail with "there are no micrographs to train topaz
      // on!") — synthesize a combined star when the column is missing.
      const picksStar = synthesizeTrainingPicks(
        inputs.train_picks,
        inputs.micrographs_star,
        ctx.workdir
      );
      const argv = [
        binJoin(binDir, "relion_autopick"),
        "--i", inputs.micrographs_star,
        "--odir", ctx.workdir + "/",
        "--pickname", "autopick",
        "--topaz_train",
        "--fn_topaz_exe", topaz,
        "--topaz_train_picks", picksStar,
        "--topaz_nr_particles", String(Math.round(num(job, "topazNrParticles", 200))),
        "--topaz_threshold", String(num(job, "topazThreshold", -6)),
        "--particle_diameter", String(num(job, "topazDiameter", 180)),
      ];
      const testRatio = num(job, "topazTestRatio", 0.2);
      if (Number.isFinite(testRatio) && testRatio >= 0 && testRatio < 0.9) {
        argv.push("--topaz_test_ratio", String(testRatio));
      }
      const downscale = num(job, "topazDownscale", -1);
      if (downscale > 0) argv.push("--topaz_downscale", String(Math.round(downscale)));
      const workers = Math.round(num(job, "topazWorkers", 1));
      if (workers > 1) argv.push("--topaz_workers", String(workers));
      const extra = str(job, "topazArgs", "").trim();
      if (extra) argv.push("--topaz_args", extra);
      // explicit angpix: radii/diameters are in Å against the micrograph pixel size
      const mpx = micAngpix(ctx.upstream);
      if (mpx) argv.push("--angpix", String(mpx));
      return argv;
    }

    case "localres": {
      // t375 — the ResMap mode (getCommandsLocalresJob, pipeline_jobs.cpp:
      // 5447-5497): RELION symlinks both half-maps into the job dir and runs
      // the ResMap binary on them. cryoflow only takes that road when the user
      // actually NAMED a ResMap executable (the seeded do_resmap_locres=true
      // alone must not flip a queue-based orchestrator onto an interactive
      // external binary); the curated method radio counts too.
      const resmap = str(job, "fn_resmap", "").trim();
      const curatedMethod = str(job, "method", "");
      const resmapMode =
        curatedMethod === "ResMap" ||
        (resmap !== "" && flag(job, "do_resmap_locres"));
      if (resmapMode) {
        if (!resmap) {
          return { error: "ResMap mode needs the ResMap executable — set it in the job's parameters (RELION's own requirement, pipeline_jobs.cpp:5453-5457)" };
        }
        if (!inputs.mask_mrc) {
          return { error: "Please provide an input mask for ResMap local-resolution estimation (pipeline_jobs.cpp:5459-5463)" };
        }
        const half1 = inputs.half1_mrc;
        const half2 = half1.includes("half1") ? half1.replace("half1", "half2") : half1.replace(/\.mrc$/, "_2.mrc");
        const h1 = outPath(ctx, "half1.mrc");
        const h2 = outPath(ctx, "half2.mrc");
        // RELION's own two commands (:5479-5480 ln -s, :5488-5495 the binary),
        // composed as one shell line
        const cmdline =
          `ln -sf ${shellQuote(half1)} ${shellQuote(h1)} && ln -sf ${shellQuote(half2)} ${shellQuote(h2)} && ` +
          `${shellQuote(resmap)} --maskVol=${shellQuote(inputs.mask_mrc)} --noguiSplit ${shellQuote(h1)} ${shellQuote(h2)} ` +
          `--vxSize=${num(job, "angpix", 1) || 1} --pVal=${numAny(job, 0.05, "pval")} ` +
          `--minRes=${num(job, "minres", 0)} --maxRes=${num(job, "maxres", 0)} --stepRes=${num(job, "stepres", 1)}`;
        return ["bash", "-c", cmdline];
      }
      const argv = [
        binJoin(binDir, "relion_postprocess"),
        "--locres",
        "--i", inputs.half1_mrc,
        "--o", outPath(ctx, "relion"),
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
        "--adhoc_bfac", String(numAny(job, -100, "adhocBfac", "adhoc_bfac")),
      ];
      if (inputs.mask_mrc) argv.push("--mask", inputs.mask_mrc);
      return argv;
    }

    case "polish": {
      // t375 — the train/polish mode split (getCommandsMotionrefineJob,
      // pipeline_jobs.cpp:5869-5995). Pre-t374 rows carry neither radio and
      // keep the polish shape verbatim; do_polish's RELION default is true.
      const doTrain = flagPresent(job, "do_param_optim");
      const doPolish = job.params.do_polish === undefined ? true : flag(job, "do_polish");
      if (doTrain && doPolish) {
        return { error: "Choose either parameter training or polishing, not both (pipeline_jobs.cpp:5869-5873)" };
      }
      if (!doTrain && !doPolish) {
        return { error: "nothing to do — choose either parameter training (do_param_optim) or polishing (do_polish) (pipeline_jobs.cpp:5875-5879)" };
      }
      const argv = [
        binJoin(binDir, "relion_motion_refine"),
        "--i", inputs.particles_star,
        "--f", inputs.postprocess_star,
        "--corr_mic", inputs.micrographs_star,
        "--first_frame", String(Math.round(num(job, "firstFrame", 1))),
        "--last_frame", String(Math.round(num(job, "lastFrame", -1))),
        "--o", ctx.workdir + "/",
        "--eval_frac", String(num(job, "evalFrac", 0.5)),
      ];
      if (doTrain) {
        // :5913-5931 — the meta-parameter estimation block
        argv.push(
          "--min_p", String(Math.round(num(job, "optim_min_part", 10000))),
          "--align_frac", String(1 - num(job, "evalFrac", 0.5)),
        );
        argv.push(num(job, "sigma_acc", 2) < 0 ? "--params2" : "--params3");
      } else {
        // :5934-5949 — own sigma trio or the optimised-params file
        if (flagPresent(job, "do_own_params")) {
          argv.push(
            "--s_vel", str(job, "sigma_vel", "0.2"),
            "--s_div", str(job, "sigma_div", "5000"),
            "--s_acc", str(job, "sigma_acc", "2"),
          );
        } else {
          const pf = str(job, "opt_params", "").trim();
          if (pf) argv.push("--params_file", pf);
        }
        // :5951 — RELION always combines frames in polish mode; without it
        // relion_motion_refine never writes shiny.star (frame_recombiner.cpp:47
        // reads --combine_frames as checkOption, default OFF). This is the one
        // intentional argv change for untouched rows — the polish job's own
        // declared output was unreachable without it.
        argv.push("--combine_frames");
        // :5967-5987 — the window/scale pair with RELION's own validation
        const win = Math.round(num(job, "extract_size", -1));
        const scl = Math.round(num(job, "rescale", -1));
        if (win > 0 || scl > 0) {
          if (!(win > 0 && scl > 0)) {
            return { error: "Please specify both the extraction box size and the downsampled size, or leave both the default (-1) (pipeline_jobs.cpp:5961-5965)" };
          }
          if (win % 2 !== 0) {
            return { error: "The extraction box size must be an even number (pipeline_jobs.cpp:5969-5973)" };
          }
          if (scl % 2 !== 0) {
            return { error: "The downsampled box size must be an even number (pipeline_jobs.cpp:5976-5980)" };
          }
          if (scl > win) {
            return { error: "The downsampled box size cannot be larger than the extraction size (pipeline_jobs.cpp:5982-5986)" };
          }
          argv.push("--window", String(win), "--scale", String(scl));
        }
      }
      return argv;
    }

    case "ctfrefine": {
      const argv = [
        binJoin(binDir, "relion_ctf_refine"),
        "--i", inputs.particles_star,
        "--f", inputs.postprocess_star,
        "--o", ctx.workdir + "/",
      ];
      // t375 — the aberration-fit dispatcher (getCommandsCtfrefineJob,
      // pipeline_jobs.cpp:6042-6168). RELION's radios are PRESENT-gated so
      // pre-t374 rows (curated fitDefocus/fitAstig knobs only) keep their
      // shape; do_ctf is RELION's default-true.
      const doAniso = flagPresent(job, "do_aniso_mag");
      const doCtf = flagPresent(job, "do_ctf");
      const doTilt = flagAnyTrue(job, "beamtilt", "do_tilt");
      const do4th = flagPresent(job, "do_4thorder");
      const legacyDefocus = flag(job, "fitDefocus");
      const legacyAstig = flag(job, "fitAstig");
      const kmin = num(job, "minres", 20); // the curated key wins (default 20; RELION's own is 30)
      if (!doAniso && !doCtf && !doTilt && !do4th) {
        return {
          error:
            "you haven't selected to fit anything — switch on CTF parameter fitting (do_ctf), beamtilt, anisotropic magnification or 4th-order aberrations (pipeline_jobs.cpp:6067-6074)",
        };
      }
      if (doAniso) {
        // :6100-6109 — anisotropic magnification is exclusive with the rest
        argv.push("--fit_aniso", "--kmin_mag", String(kmin));
      } else {
        if (doCtf) {
          // :6116-6133 — defocus fit + the five-char fit_mode (phase, defocus,
          // astig, Cs-always-f, bfactor — JobOption::getCtfFitString)
          argv.push("--fit_defocus", "--kmin_defocus", String(kmin));
          argv.push(
            "--fit_mode",
            ctffitChar(job, "do_phase") +
              ctffitChar(job, "do_defocus") +
              ctffitChar(job, "do_astig") +
              "f" +
              ctffitChar(job, "do_bfactor"),
          );
        } else if (legacyDefocus || legacyAstig) {
          // the pre-t374 curated knobs, mapped onto the REAL ctf_refine
          // options (the old --fit_astig flag never existed in any RELION
          // release — the parser would have hard-rejected the whole run)
          argv.push("--fit_defocus", "--kmin_defocus", String(kmin));
          argv.push("--fit_mode", "f" + (legacyDefocus ? "p" : "f") + (legacyAstig ? "p" : "f") + "ff");
        }
        if (doTilt) {
          // :6137-6145 — beamtilt (+ trefoil as the odd-aberration order)
          argv.push("--fit_beamtilt", "--kmin_tilt", String(kmin));
          if (flagPresent(job, "do_trefoil")) argv.push("--odd_aberr_max_n", "3");
        }
        if (do4th) argv.push("--fit_aberr"); // :6148-6151
      }
      return argv;
    }

    case "dynamight": {
      const exe = await externalFor(ctx, "dynamight", ["relion_python_dynamight", "dynamight"]);
      if (!exe) {
        return { error: ctx.externals
          ? "DynaMight requires python + torch (relion_python_dynamight not found on the cluster after module load)"
          : "DynaMight requires python + torch (relion_python_dynamight not found on PATH)" };
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
      const exe = await externalFor(ctx, "modelangelo", ["model_angelo", "modelangelo"]);
      if (!exe) {
        return { error: ctx.externals
          ? "ModelAngelo requires a python environment with model_angelo installed (not found on the cluster after module load)"
          : "ModelAngelo requires a python environment with model_angelo installed (not found on PATH)" };
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
        binJoin(binDir, "relion_star_handler"),
        "--combine",
        "--i", stars.join(" "),
        "--check_duplicates", dupLabel,
        "--o", outPath(ctx, "join_particles.star"),
      ];
    }

    case "subtract": {
      // t375 — the label-revert mode (getCommandsSubtractJob,
      // pipeline_jobs.cpp:5180-5198): flips rlnImageName back to the originals
      if (flagPresent(job, "do_fliplabel")) {
        const flipStar = str(job, "fn_fliplabel", "").trim();
        if (!flipStar) {
          return { error: "revert needs the particle STAR file to revert (fn_fliplabel) — RELION's own requirement (pipeline_jobs.cpp:5188)" };
        }
        return [
          binJoin(binDir, "relion_particle_subtract"),
          "--revert", flipStar,
          "--o", ctx.workdir + "/",
        ];
      }
      const argv = [
        binJoin(binDir, "relion_particle_subtract"),
        "--i", inputs.optimiser_star,
        "--mask", inputs.mask_mrc,
        "--o", ctx.workdir + "/",
      ];
      if (inputs.particles_star) argv.push("--data", inputs.particles_star);
      // t375 — recenter reads either side of the alias pair (:5239-5242);
      // RELION's do_center_mask defaults TRUE
      if (flag(job, "recenter") || flagPresent(job, "do_center_mask")) {
        argv.push("--recenter_on_mask");
      } else if (flagPresent(job, "do_center_xyz")) {
        // :5243-5248 — the else-if twin: explicit x/y/z centering
        argv.push(
          "--center_x", str(job, "center_x", "0"),
          "--center_y", str(job, "center_y", "0"),
          "--center_z", str(job, "center_z", "0"),
        );
      }
      // :5250-5253 — float16 reads either side of the alias pair (both default true)
      if (flagAnyTrue(job, "float16", "do_float16")) argv.push("--float16");
      // :5255-5258 — re-windowing, only a positive value rides
      const nb = Math.round(numAny(job, -1, "newBox", "new_box"));
      if (nb > 0) argv.push("--new_box", String(nb));
      return argv;
    }

    case "multibody": {
      // t388 — RELION's own MultiBody job (pipeline_jobs.cpp
      // getCommandsMultiBodyJob) rides relion_refine --continue <the
      // consensus refinement's optimiser.star> --multibody_masks
      // <bodies.star>, and since 5.0 it carries the SAME --blush
      // regularisation as the rest of the refine family (:4772 —
      // do_blush → " --blush"). Before t388 this case was a blanket
      // refusal: the bodies STAR is a user-picked FILE, not a graph node,
      // so the graph can never resolve it and the refusal stood in for
      // that gap. The body STAR now rides the RELION-twin fn_bodies
      // stored param (the form does not render it; the inspector's
      // Additional group speaks it, and a template-imported or API-set
      // row carries it) — absent, the refusal keeps today's exact words;
      // present, the argv below is RELION's own emission order, sampling
      // and all.
      const bodiesStar = str(job, "fn_bodies", "").trim();
      if (!bodiesStar) {
        return { error: `Command template for multibody requires ${GENERIC_REQUIREMENTS.multibody}` };
      }
      // t394 — the form's "Continue from here:" (fn_cont) overrides the
      // wired upstream optimiser when set: the multibody tab owns the flag
      // (its RELION table entry carries none — the curated builder is the
      // emitter, per the aliases doctrine), so the override reads it here
      // and the generic layer stays quiet.
      const contOverride = str(job, "fn_cont", "").trim();
      const argv = [
        binJoin(binDir, "relion_refine"),
        "--continue", contOverride || inputs.optimiser_star,
        "--o", outPath(ctx, "run"),
        "--solvent_correct_fsc",
        "--multibody_masks", bodiesStar,
        "--oversampling", "1",
      ];
      // the GUI's sampling is the OVERSAMPLED one (RELION subtracts the
      // oversampling order for both flags; local searches always ride).
      // The merged table's radio values carry the " degrees" suffix —
      // healpixOrderOf wants the bare number.
      const mbOrd = healpixOrderOf(String(job.params.sampling ?? "").replace(/ ?degrees$/, ""));
      if (mbOrd != null && mbOrd > 1) {
        argv.push("--healpix_order", String(mbOrd - 1), "--auto_local_healpix_order", String(mbOrd - 1));
      }
      argv.push("--offset_range", String(num(job, "offset_range", 3)));
      argv.push("--offset_step", String(numAny(job, 0.75, "offsetStep", "offset_step") * 2));
      // t388 — the family's Blush regularisation, RELION's own emission
      // order (right after the sampling block, before the compute flags).
      // The wrapper it enables (relion_python_blush) is the exact program
      // the remote lane's t388 preflight proves reachable.
      if (flag(job, "doBlush")) argv.push("--blush");
      // RELION's own defaults speak through: subtracted bodies ON unless
      // the row says otherwise; combine-thru-disc OFF unless set.
      if (job.params.do_subtracted_bodies !== false) argv.push("--reconstruct_subtracted_bodies");
      if (job.params.do_combine_thru_disc !== true) argv.push("--dont_combine_weights_via_disc");
      if (job.params.do_parallel_discio === false) argv.push("--no_parallel_disc_io");
      if (flag(job, "do_preread_images")) argv.push("--preread_images");
      else {
        const scratch = str(job, "scratch_dir", "").trim();
        if (scratch && !/^(std::|DEFAULTSCRATCHDIR)/.test(scratch)) argv.push("--scratch_dir", scratch);
      }
      argv.push("--pool", String(Math.max(1, Math.round(num(job, "nr_pool", 3)))));
      argv.push("--pad", String(job.params.do_pad1 === true ? 1 : 2));
      argv.push("--j", String(Math.max(1, Math.round(num(job, "threads", 4)))));
      return argv;
    }

    /* ---------------- TOMO ---------------- */
    case "tomo_import":
      return { error: `Command template for tomo_import requires ${GENERIC_REQUIREMENTS.tomo_import}` };

    case "tomo_aligntiltseries": {
      const method = str(job, "method", "AreTomo2");
      const argv = [
        binJoin(binDir, "relion_align_tiltseries"),
        "--i", inputs.tilt_series_star,
        "--o", ctx.workdir + "/",
        "--tomogram_thickness", String(num(job, "thickness", 300)),
      ];
      if (method === "AreTomo2") argv.push("--aretomo2", "--aretomo_exe", "AreTomo2");
      else if (method === "IMOD fiducials")
        argv.push("--imod_fiducials", "--fiducial_diameter", String(num(job, "fiducialDiameter", 10)), "--batchtomo_exe", "batchruntomo");
      else argv.push("--imod_patchtrack", "--patch_size", "100", "--patch_overlap", "50", "--batchtomo_exe", "batchruntomo");
      // t349 — the command template (the argv's authority) carries --gpu:
      // AreTomo2 does its tilt alignment on CUDA, and a 0-GPU width used to
      // send a CUDA-hungry shard onto a card the submission never requested.
      argv.push("--gpu", "0");
      return argv;
    }

    case "tomo_tomograms": {
      return [
        binJoin(binDir, "relion_tomo_reconstruct_tomogram"),
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
        binJoin(binDir, "relion_tomo_refine_ctf"),
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
        binJoin(binDir, "relion_python_tomo_exclude_tilt_images"),
        "--tilt-series-star-file", inputs.tilt_series_star,
        "--cache-size", String(Math.round(num(job, "cacheSize", 5))),
        "--output-directory", ctx.workdir + "/",
      ];
    }

    case "tomo_polish": {
      const half2 = inputs.half1_mrc.replace("half1", "half2");
      const argv = [
        binJoin(binDir, "relion_tomo_align"),
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
        binJoin(binDir, "relion_tomo_reconstruct_particle"),
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
      const exe = await externalFor(ctx, "tomo_denoise", ["relion_python_tomo_denoise"]);
      if (!exe) {
        return { error: ctx.externals
          ? "cryoCARE requires a python environment (relion_python_tomo_denoise not found on the cluster after module load)"
          : "cryoCARE requires a python environment (relion_python_tomo_denoise not found on PATH)" };
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
      const pick = await externalFor(ctx, "tomo_pick", ["relion_python_tomo_pick"]);
      if (!pick) {
        return { error: ctx.externals
          ? "Napari picking requires a python environment (relion_python_tomo_pick not found on the cluster after module load)"
          : "Napari picking requires a python environment (relion_python_tomo_pick not found on PATH)" };
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
        binJoin(binDir, "relion_tomo_subtomo"),
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

/**
 * t375 — RELION's 3D helical suite, shared verbatim by class3d
 * (getCommandsClass3DJob, pipeline_jobs.cpp:4031-4102) and refine3d
 * (getCommandsAutorefineJob, :4513-4587):
 *  - do_helix gates everything: --helix + the tube diameters
 *    (inner only when > 0);
 *  - do_apply_helical_symmetry (RELION default true) gates the
 *    asu/twist/rise trio + --helical_z_percentage as value/100;
 *  - do_local_search_helical_symmetry adds the twist/rise search ranges
 *    (inisteps only when > 0);
 *  - keep_tilt_prior_fixed rides under do_helix;
 *  - the ÷3 range priors: class3d emits them while alignment runs and no
 *    local angular searches are set; refine3d emits them while the initial
 *    and auto-local samplings differ. helical_sigma_distance is ÷3 as well
 *    (inside the class3d gate, outside the refine3d one — mirroring the
 *    source exactly).
 */
function helixSuite3d(job: EngineJobRef, argv: string[], kind: "class3d" | "refine3d"): void {
  if (!flag(job, "do_helix")) return;
  argv.push("--helix");
  const inner = num(job, "helical_tube_inner_diameter", -1);
  if (inner > 0) argv.push("--helical_inner_diameter", String(inner));
  argv.push("--helical_outer_diameter", str(job, "helical_tube_outer_diameter", "-1"));
  if (job.params.do_apply_helical_symmetry !== false) {
    argv.push(
      "--helical_nr_asu", String(Math.round(num(job, "helical_nr_asu", 1))),
      "--helical_twist_initial", str(job, "helical_twist_initial", "0"),
      "--helical_rise_initial", str(job, "helical_rise_initial", "0"),
      "--helical_z_percentage", String(num(job, "helical_z_percentage", 30) / 100),
    );
    if (flag(job, "do_local_search_helical_symmetry")) {
      argv.push(
        "--helical_symmetry_search",
        "--helical_twist_min", str(job, "helical_twist_min", "0"),
        "--helical_twist_max", str(job, "helical_twist_max", "0"),
      );
      const twStep = num(job, "helical_twist_inistep", 0);
      if (twStep > 0) argv.push("--helical_twist_inistep", String(twStep));
      argv.push(
        "--helical_rise_min", str(job, "helical_rise_min", "0"),
        "--helical_rise_max", str(job, "helical_rise_max", "0"),
      );
      const riStep = num(job, "helical_rise_inistep", 0);
      if (riStep > 0) argv.push("--helical_rise_inistep", String(riStep));
    }
  } else {
    argv.push("--ignore_helical_symmetry");
  }
  if (flag(job, "keep_tilt_prior_fixed")) argv.push("--helical_keep_tilt_prior_fixed");
  const rangesGate =
    kind === "class3d"
      ? job.params.dont_skip_align !== false && !flag(job, "do_local_ang_searches")
      : healpixOrderOf(job.params.samplingStep) === null ||
        healpixOrderOf(job.params.autoLocalSampling) === null ||
        healpixOrderOf(job.params.samplingStep) !== healpixOrderOf(job.params.autoLocalSampling);
  if (rangesGate) {
    argv.push(
      "--sigma_tilt", String(clamp090(num(job, "range_tilt", 15)) / 3),
      "--sigma_psi", String(clamp090(num(job, "range_psi", 10)) / 3),
      "--sigma_rot", String(clamp090(num(job, "range_rot", -1)) / 3),
    );
  }
  const hd = num(job, "helical_range_distance", -1);
  if (hd > 0 && (kind === "refine3d" || rangesGate)) {
    argv.push("--helical_sigma_distance", String(hd / 3));
  }
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

/**
 * Synthesize a half1/half2 pair from an unsplit refinement's final map.
 *
 * Sequential (no-MPI) RELION cannot produce gold-standard halves — the
 * serial binary refuses --split_random_halves, so the engine's sequential
 * fallback completes the run as an UNSPLIT refinement with a single final
 * map. But downstream PostProcess/LocalRes hard-require the half pair:
 * relion_postprocess locates the partner half by FILENAME convention and
 * errors out on a plain map ("The input filename does not contain 'half1'
 * or 'half2'"), and two IDENTICAL halves trip the phase-randomization FSC
 * floor check ("FSC curve never drops below randomize_fsc_at").
 *
 * Cryo-EM practice for this case: half1 = copy of the final map, half2 =
 * copy + N(0, 0.6σ) noise. The FSC then decays with resolution exactly
 * like a real noisy reconstruction pair — sharpening, B-factor estimation
 * and Guinier fitting all run to completion. The FSC VALUES are not
 * gold-standard (callers must say so in the result note).
 *
 * MRC2014 layout assumed: mode 2 (float32), nsymbt 0 → data at byte 1024.
 * Deterministic PRNG (mulberry32) + Box–Muller so re-collection produces
 * the same halves.
 */
function synthesizeSequentialHalves(
  workdir: string,
  model: string,
): { half1: string; half2: string } | null {
  try {
    const base = path.basename(model);
    const m = /^run_it(\d+)_class(\d+)\.mrc$/.exec(base);
    if (!m) return null;
    const [, iter, cls] = m;
    const half1 = path.join(workdir, `run_it${iter}_half1_class${cls}.mrc`);
    const half2 = path.join(workdir, `run_it${iter}_half2_class${cls}.mrc`);
    if (existsSync(half1) && existsSync(half2)) return { half1, half2 }; // re-collection idempotent
    const raw = readFileSync(model);
    if (raw.length <= 1024) return null;
    const mode = raw.readInt32LE(12);
    const nsymbt = raw.readInt32LE(92);
    if (mode !== 2 || nsymbt !== 0) return null;
    const n = Math.floor((raw.length - 1024) / 4);
    const mapData = new Float32Array(n);
    for (let i = 0; i < n; i++) mapData[i] = raw.readFloatLE(1024 + i * 4);
    let mean = 0;
    for (let i = 0; i < n; i++) mean += mapData[i];
    mean /= n;
    let variance = 0;
    for (let i = 0; i < n; i++) {
      const d = mapData[i] - mean;
      variance += d * d;
    }
    const std = Math.sqrt(variance / n) || 1e-9;
    // mulberry32 PRNG + Box–Muller transform
    let s = 0x9e3779b9;
    const rand = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out = Buffer.from(raw); // header + map copy
    for (let i = 0; i < n; i++) {
      const u = Math.max(rand(), 1e-12);
      const v = rand();
      const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      out.writeFloatLE(mapData[i] + g * std * 0.6, 1024 + i * 4);
    }
    writeFileSync(half1, raw); // half1: pristine copy
    writeFileSync(half2, out); // half2: noisy copy
    return { half1, half2 };
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
    // scope the row scan to the loop that OWNS _rlnClassNumber — the
    // optics-group row above the particles loop ("1 optGroup1 300 …") would
    // otherwise be counted as a particle of class parseInt("2.7") = 2
    let headerEnd = -1;
    let inLoop = false;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t === "loop_") {
        inLoop = true;
        continue;
      }
      if (t.startsWith("data_")) {
        inLoop = false;
        continue;
      }
      if (!inLoop || !t.startsWith("_")) continue;
      if (t.startsWith("_rlnClassNumber")) {
        headerEnd = i;
        break;
      }
    }
    if (headerEnd < 0) return null;
    const counts = new Map<number, number>();
    let total = 0;
    for (let r = headerEnd + 1; r < lines.length; r++) {
      const t = lines[r].trim();
      if (t === "loop_" || t.startsWith("data_")) break; // loop region over
      if (!t || t.startsWith("#") || t.startsWith("_")) continue;
      const cells = t.split(/\s+/);
      if (cells.length <= classCol) continue;
      const cls = parseInt(cells[classCol], 10);
      if (Number.isFinite(cls) && cls > 0) {
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
export function collectOutputs(type: string, workdir: string): { outputs: Record<string, string>; result: string } {
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
      // relion_autopick writes per-micrograph coordinate stars at
      // <odir>/<star-relative mic path>_autopick.star — with this engine's
      // project-relative layout that is <workdir>/micrographs/<mic>_autopick.star.
      // The first one is the chainable coords output (Extract knows the
      // _autopick.star suffix convention); the combined pickname star, when
      // present, only mirrors them.
      const perMic = globOne(path.join(workdir, "micrographs"), /_autopick\.star$/);
      const star = firstExisting(workdir, ["autopick.star"]) ?? perMic;
      if (star) {
        outputs.coords_star = perMic ?? star;
        // count picks across all per-mic stars for the result message
        let picks = 0;
        let mics = 0;
        try {
          for (const f of readdirSync(path.join(workdir, "micrographs"))) {
            if (!/_autopick\.star$/.test(f)) continue;
            mics++;
            picks += countStarRows(path.join(workdir, "micrographs", f));
          }
        } catch {
          /* non-fatal: star may be the combined file */
          picks = countStarRows(star);
        }
        result = `REAL: ${picks} particles picked across ${mics} micrographs`;
      }
      break;
    }
    case "topaztrain": {
      // --topaz_train writes the trained CNN model into the job dir
      // (topaz_model.sav) plus optional training diagnostics (loss curve
      // image / topaz logs). The model is the chainable output — an
      // Auto-picking job's Topaz mode consumes it via --topaz_model.
      const model =
        firstExisting(workdir, ["topaz_model.sav"]) ?? globOne(workdir, /\.sav$/i);
      if (model) {
        outputs.topaz_model = model;
        // surface any training-curve diagnostics the run produced
        const plot = globOne(workdir, /topaz.*\.(png|jpg|eps)$/i);
        if (plot) outputs.training_plot = plot;
        result = "REAL: Topaz model trained — connect into Auto-picking (Topaz mode)";
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
        // t347 — the seed count rides the receipt (the count grammar parses it)
        const seeded = data ? countStarRows(data) : 0;
        result =
          seeded > 0
            ? `REAL: de-novo 3D initial model generated · ${seeded.toLocaleString()} particles`
            : "REAL: de-novo 3D initial model generated";
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
        } else if (type === "refine3d") {
          // Sequential (no-MPI) refinement ran unsplit: synthesize the half
          // pair downstream PostProcess/LocalRes hard-require (see helper).
          // The FSC from synthetic halves is noise-decay, NOT gold-standard —
          // the result note says so explicitly.
          const synth = synthesizeSequentialHalves(workdir, model);
          if (synth) {
            outputs.half1_mrc = synth.half1;
            outputs.half2_mrc = synth.half2;
            result = `${result ?? "REAL: 3D refinement finished"} · sequential mode: synthetic half-maps (FSC = noise decay, not gold-standard)`;
          }
        }
        // Same RELION 5 naming story as the data.star below: optimiser.star
        // is written per-iteration; the ≤4 bare name never appears.
        const opt =
          globLatest(workdir, /^run_it\d+_optimiser\.star$/) ??
          firstExisting(workdir, ["run_optimiser.star"]);
        if (opt) outputs.optimiser_star = opt;
        // RELION 5 writes per-iteration data.star (run_it<N>_data.star) and
        // never materializes the RELION ≤4 "run_data.star" — without the
        // globLatest fallback the refinement exposes NO particles output and
        // downstream CtfRefine/Polish silently degrade to a 2D-class star
        // (missing rlnAngleRot/Tilt/Psi/RandomSubset → hard error). Mirrors
        // the class2d collection at ~3057.
        const data = globLatest(workdir, /^run_it\d+_data\.star$/) ?? firstExisting(workdir, ["run_data.star"]);
        if (data) outputs.refine_data_star = data;
        // t347 — the receipt carries the counted particles too (the card +
        // inspector count grammar parses it; refine/classification receipts
        // previously said only "finished" with no number at all)
        const refineLine =
          parseRefineResult(workdir) ?? result ?? `REAL: ${type === "class3d" ? "3D classification" : "3D refinement"} finished`;
        const refined = data ? countStarRows(data) : 0;
        result = refined > 0 ? `${refineLine} · ${refined.toLocaleString()} particles` : refineLine;
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
        // t347 — the polished count rides the receipt
        const polished = countStarRows(star);
        result =
          polished > 0
            ? `REAL: Bayesian polishing finished — ${polished.toLocaleString()} particles polished`
            : "REAL: Bayesian polishing finished";
      }
      break;
    }
    case "ctfrefine": {
      const star = firstExisting(workdir, ["particles_ctf_refine.star"]);
      if (star) {
        outputs.particles_star = star;
        // t347 — the refined count rides the receipt
        const refined = countStarRows(star);
        result =
          refined > 0
            ? `REAL: CTF refinement finished — ${refined.toLocaleString()} particles`
            : "REAL: CTF refinement finished";
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
        // t347 — the written count rides the receipt
        const written = countStarRows(star);
        result =
          written > 0
            ? `REAL: ${type}: ${written.toLocaleString()} particles written`
            : `REAL: ${type} particles written`;
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
  /**
   * t391 — cheap content signature (djb2 + length + line count). The log
   * route answers a caller that sends its last-seen version back as ?since=
   * with a ~40-byte {unchanged:true} instead of re-serializing the whole
   * tail — the live poll's no-op ticks become nearly free.
   */
  version: string;
}

/**
 * t391 — djb2 content signature, shared shape with the remote lane's
 * logVersionOf (remote-run.ts). Local logs are ≤8MB; striding keeps the
 * 8MB worst case at a few ms while the length+totalLines fields ride the
 * token so stride gaps cannot hide a real change.
 */
function logVersionLocal(text: string, totalLines: number, truncated: boolean): string {
  let h = 5381;
  const step = text.length > 262_144 ? 997 : 31;
  for (let i = 0; i < text.length; i += step) h = (h * 33 + text.charCodeAt(i)) | 0;
  if (text.length > 0) {
    const from = Math.max(0, text.length - 64);
    for (let i = from; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0;
  }
  return `${h.toString(36)}:${totalLines}:${truncated ? 1 : 0}:${text.length}`;
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
    const fullText = allLines.join("\n").slice(-8 * 1024 * 1024);
    return {
      text: fullText,
      totalLines,
      truncated: overCap,
      version: logVersionLocal(fullText, totalLines, overCap),
    };
  }
  const tailLines = allLines.slice(-600);
  const tailText = tailLines.join("\n");
  const truncated = totalLines > tailLines.length;
  return {
    text: tailText,
    totalLines,
    truncated,
    version: logVersionLocal(tailText, totalLines, truncated),
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
    return parseProgressText(type, tail, params);
  } catch {
    return null;
  }
}

/**
 * Content-based progress parser — re-exported from the PURE t319 module
 * (src/lib/relion/progress-parse.ts) so the local engine, the remote sweep
 * and the test tooling all parse the SAME dialects. See that file for the
 * full dialect map (RELION's own time bar, iteration headers, n/N counters).
 */
export { parseProgressText } from "./progress-parse";
import { parseProgressText } from "./progress-parse";

/* ------------------------------------------------------------------ */
/* Main entry point                                                     */
/* ------------------------------------------------------------------ */

const NATIVE_TYPES = new Set(["import", "manualpick", "select"]);

/**
 * t311 — re-base ImageName refs when a particle star RELOCATES. RELION
 * resolves a star's relative refs against the process CWD (the project root
 * — the pipeliner writes project-relative paths), so a native star
 * transform that copies particle rows into its OWN workdir must re-point
 * every ref that only made sense next to the UPSTREAM star. The old
 * verbatim copy left rows like `extra/x.mrcs` in select's star — a tree the
 * upstream extract owned — and every stack-reading consumer downstream died
 * on it (live: the mock's merge audit refused 242/242; the original demo era
 * never noticed because its fake didn't audit). Absolute refs ride
 * untouched; refs that already resolve from the project root ride untouched;
 * everything else re-resolves against the upstream star's dir and
 * re-relativizes to the project root.
 */
function rebaseParticleRefs(text: string, fromStar: string, projectRoot: string): string {
  const fromDir = path.dirname(fromStar);
  // \S+ — a loop row may be TAB- or SPACE-separated (real RELION reads both;
  // the engine's own rebalance/symexpand emit space-joined rows), so the ref
  // token ends at the first whitespace, never at the line end
  return text.replace(/(\d+@)(\S+)/g, (full, prefix: string, ref: string) => {
    if (ref.startsWith("/")) return full; // absolute — rides as-is
    try {
      const fromProject = path.resolve(projectRoot, ref);
      if (existsSync(fromProject)) return full; // already project-relative and live
      const viaFrom = path.resolve(fromDir, ref);
      if (!existsSync(viaFrom)) return full; // unresolvable — honest absence downstream
      const rel = path.relative(projectRoot, viaFrom);
      if (rel.startsWith("..") || path.isAbsolute(rel)) return full; // escapes the project — leave
      return prefix + rel.split(path.sep).join("/");
    } catch {
      return full;
    }
  });
}

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
  bridge: WslBridge | null = null,
  ctffindGateNote: string | null = null
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
  let bridged = false;
  if (bridge) {
    // log files are redirected INSIDE the bash script (Linux-side `>>`
    // through drvfs lands on the same Windows files the host reads) —
    // the spawn's own stdio is bypassed entirely because wsl.exe's
    // handle relay is unreliable in detached mode (Windows log fix).
    const wrapped = wrapWslCommand(argv, projectDir, bridge, { out: logFile, err: errFile });
    file = wrapped.file;
    args = wrapped.args;
    env = { ...process.env };
    displayCmd = wrapped.display;
    bridged = true;
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
  upsertRun(job.id, record);

  // Pre-open the log files and pass the raw fds as stdio: the child keeps
  // its own dup'd descriptors, so a Next.js dev-server restart no longer
  // EPIPEs the tree to death mid-refinement (the pipes used to be held by
  // the parent — two documented incidents of hours-long refines dying).
  // detached: true puts the tree in its own session, so group signals aimed
  // at the dev server (Ctrl-C, reaper) can't take the refine down either.
  //
  // BRIDGED runs: the bash script owns the redirection (see above), so the
  // child gets /dev/null stdio — the host-side fds would be the only thing
  // wsl.exe could fail to relay. The files are still created here so
  // getLogTail sees them (200 + empty) from the very first poll.
  const outFd = openSync(logFile, "a");
  const errFd = openSync(errFile, "a");
  const child = spawn(file, args, {
    cwd: projectDir,
    env,
    // POSIX keeps detached: the tree gets its own session, so group signals
    // aimed at the dev server (Ctrl-C, reaper) can't take an hours-long
    // refine down — the documented survival design.
    //
    // Win32 BRIDGED runs deliberately DROP detached: libuv maps it to
    // DETACHED_PROCESS, which strips the parent console from wsl.exe (a
    // console-subsystem binary). windowsHide then cannot reliably suppress
    // the window — nodejs/node#21825 documents detached+windowsHide STILL
    // popping a visible console per running job, which is exactly what the
    // user sees when CryoFlow calls RELION through WSL. Without detached,
    // wsl.exe gets its own HIDDEN console (CREATE_NO_WINDOW) and survival is
    // unaffected: the distro-side mpirun/refine tree never dies with the
    // host-side wsl.exe client anyway, and orphaned children keep running
    // when the parent exits on Windows.
    detached: !(bridged && process.platform === "win32"),
    stdio: bridged ? ["ignore", "ignore", "ignore"] : ["ignore", outFd, errFd],
    // belt & suspenders for every spawn path (probe, preflight, jobs):
    // no console window allocation on Windows hosts. No-op on POSIX.
    windowsHide: true,
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
  upsertRun(job.id, { ...record });

  attachExitHandler(job, child, record.startedAt, ctffindGateNote);

  return {
    ok: true,
    pid: child.pid ?? undefined,
    ...(resumedFrom != null ? { resumedFrom } : {}),
  };
}

/**
 * Companion files RELION's --continue actually reads back for a checkpoint
 * iteration, per job type. A run killed mid-checkpoint-flush (crash, OOM,
 * Stop, server restart) can leave `run_itNNN_optimiser.star` behind without
 * its siblings — resuming from THAT checkpoint aborts inside RELION with
 * e.g. "ERROR: HealpixSampling::readStar: File run_it000_sampling.star
 * cannot be read" (real case: class2d_u8voe932). Naming is deterministic:
 * RELION derives <root>_it<NNN>_<kind> from the optimiser path itself.
 *
 * t395 — the law is verified against the RELION 5.0.0 SOURCE, not folklore:
 * MlOptimiser::read(fn_cont) opens the optimiser star, then the data/model/
 * sampling stars it names (gold-standard runs name BOTH half model stars —
 * `run_itNNN_half1_model.star` + `_half2_` — and every MPI rank reads one),
 * and MlModel::read reloads every rlnReferenceImage the model star embeds:
 *
 *   · 2D (class2d): ALL class averages live in ONE stack —
 *     `img.write(fn_out + "_classes.mrcs")` (ml_model.cpp). A per-class
 *     `run_itNNN_class001.mrc` DOES NOT EXIST in the 2D world — the t394
 *     law demanded it, so every class2d round was judged incomplete (the
 *     field report: the picker showed rounds but nothing was pickable, and
 *     the local auto-resume silently never resumed class2d either);
 *   · 3D (class3d/refine3d/initialmodel): per-class
 *     `run_itNNN_class001.mrc`; multibody: per-body `run_itNNN_body001.mrc`;
 *     gold-standard halves: `run_itNNN_half{1,2}_class001.mrc` (the
 *     FILTERED refs — the `_unfil` halves are only for the between-
 *     iteration FSC, never reloaded by --continue);
 *   · VDAM (--grad): the moment stacks join the reload set — 2D
 *     `run_it${it}_1moment.mrcs`/`_2moment.mrcs`, 3D
 *     `run_it${it}_1moment001.mrc`/`_2moment001.mrc`.
 *
 * DIALECT DETECTION: one iteration's own file family identifies its
 * dialect, so the caller passes the directory's name set when it has one
 * (both callers do): `run_it${it}_half1_model.star` present → gold-standard
 * law (a gold run's join-phase iterations write the plain single
 * `run_it${it}_model.star` instead — presence decides, never the type
 * alone); the moment files present → VDAM law. Without a name set the law
 * falls back to each type's common dialect (class2d EM stack, plain 3D).
 */
export function continueCompanions(
  type: string,
  it: string,
  names?: ReadonlySet<string> | null
): string[] {
  const has = (n: string): boolean => (names ? names.has(n) : false);

  // gold-standard (split random halves): BOTH half model stars are read
  // (MlOptimiser::read → mymodel.read(fn_model / fn_model2) by rank parity)
  // and their embedded rlnReferenceImage values are the FILTERED half maps
  // (multibody's refs are per-BODY — ml_model.cpp compose "_body").
  if (has(`run_it${it}_half1_model.star`)) {
    const one = type === "multibody" ? `run_it${it}_half1_body001.mrc` : `run_it${it}_half1_class001.mrc`;
    const two = type === "multibody" ? `run_it${it}_half2_body001.mrc` : `run_it${it}_half2_class001.mrc`;
    return [
      `run_it${it}_data.star`,
      `run_it${it}_half1_model.star`,
      `run_it${it}_half2_model.star`,
      `run_it${it}_sampling.star`,
      one,
      two,
    ];
  }

  if (type === "class2d") {
    // 2D: ONE stack carries every class average. The legacy `.mrc`
    // extension spelling is accepted when it is what the run wrote.
    const stack = has(`run_it${it}_classes.mrc`)
      ? `run_it${it}_classes.mrc`
      : `run_it${it}_classes.mrcs`;
    const out = [
      `run_it${it}_data.star`,
      `run_it${it}_model.star`,
      `run_it${it}_sampling.star`,
      stack,
    ];
    // VDAM: the moment stacks are reloaded through the model star's
    // GRADIENT_MOMENT columns — required exactly when the run wrote them.
    if (has(`run_it${it}_1moment.mrcs`) || has(`run_it${it}_1moment.mrc`)) {
      out.push(
        has(`run_it${it}_1moment.mrc`) ? `run_it${it}_1moment.mrc` : `run_it${it}_1moment.mrcs`,
        has(`run_it${it}_2moment.mrc`) ? `run_it${it}_2moment.mrc` : `run_it${it}_2moment.mrcs`
      );
    }
    return out;
  }

  if (type === "refine3d" || type === "multibody" || type === "class3d" || type === "initialmodel") {
    // 3D: the model star embeds per-class refs (class001 is the canary for
    // the K-class flush loop); multibody embeds per-body refs instead.
    const out = [
      `run_it${it}_data.star`,
      `run_it${it}_model.star`,
      `run_it${it}_sampling.star`,
      type === "multibody" ? `run_it${it}_body001.mrc` : `run_it${it}_class001.mrc`,
    ];
    // 3D VDAM (initialmodel --denovo_3dref --grad): per-class moment maps.
    if (has(`run_it${it}_1moment001.mrc`)) {
      out.push(`run_it${it}_1moment001.mrc`, `run_it${it}_2moment001.mrc`);
    }
    return out;
  }

  // anything else — the star triple only
  return [
    `run_it${it}_data.star`,
    `run_it${it}_model.star`,
    `run_it${it}_sampling.star`,
  ];
}

/**
 * Newest FULLY-WRITTEN run_itXXX_optimiser.star checkpoint in a workdir
 * (RELION's --continue entry point), or null when none is usable.
 *
 * Scans newest → oldest and returns the first iteration whose companion
 * set is complete on disk: a checkpoint flush killed mid-way leaves the
 * optimiser STAR without its sampling/model/data siblings and --continue
 * on it dies inside RELION (HealpixSampling::readStar — class2d_u8voe932).
 * Falling back to an older COMPLETE iteration preserves hours of refine
 * progress; no complete iteration at all → null → the rerun starts fresh.
 */
export function resumableOptimiser(
  workdir: string,
  type = ""
): { file: string; iteration: number } | null {
  // t397 — the same ladder the picker's scans walk: the WORKDIR ROOT is
  // this app's dispatch shape (RELION's --o basename law puts
  // `run_it###_*` next to the `run` stem — see continue-sources.ts); a
  // root with no usable checkpoint falls through to the `run/` SUBDIR
  // (a foreign --o convention). The returned path is the checkpoint's
  // REAL location, so the resume branch's --continue speaks it as-is.
  const scanOne = (dir: string): { file: string; iteration: number } | null => {
    try {
      // one readdir feeds BOTH the optimiser scan and the t395 dialect
      // detection (gold halves / VDAM moments are named files like any other)
      const all = readdirSync(dir);
      const nameSet = new Set(all);
      const matches = all
        .map((n) => {
          const m = n.match(/^run_it(\d+)_optimiser\.star$/i);
          return m ? { file: path.join(dir, n), iteration: Number(m[1]) } : null;
        })
        .filter((x): x is { file: string; iteration: number } => x != null);
      matches.sort((a, b) => b.iteration - a.iteration);
      for (const candidate of matches) {
        const it = String(candidate.iteration).padStart(3, "0");
        const ok = continueCompanions(type, it, nameSet).every((f) => nameSet.has(f));
        if (ok) return candidate;
      }
      return null;
    } catch {
      return null;
    }
  };
  const rootHit = scanOne(workdir);
  if (rootHit) return rootHit;
  return scanOne(path.join(workdir, "run"));
}

/** Refine-family job types that support RELION's --continue. */
const RESUMABLE_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel", "multibody"]);

/**
 * t394 — an EXPLICIT user-chosen --continue round: the "Continue from
 * here:" field (fn_cont) set to a non-empty path in the form. This is
 * the picker's contract — the user SAID which round to pick up from, so
 * it outranks every automatic guess:
 *
 *   · it beats the auto-resume below (which always picks the NEWEST
 *     complete checkpoint — right for an interrupted run nobody curated,
 *     wrong the moment the user chose it012 on purpose);
 *   · it keeps the iteration family alive through the fresh-start wipe
 *     when the target lives inside this job's own workdir (see the wipe
 *     call site) — the chosen optimiser + siblings ARE the state the
 *     continued run resumes from.
 *
 * Stored under fn_cont for every refine-family type: class2d / class3d /
 * refine3d / initialmodel ride it through the generic flag layer
 * (appendRelionFlags → --continue <path>); multibody's builder owns the
 * flag and reads the override first.
 */
export function explicitContinueOf(job: EngineJobRef): string | null {
  const v = (job.params as Record<string, unknown> | undefined)?.fn_cont;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * t394 — does the explicit --continue target live INSIDE this workdir?
 * Host-path semantics (the local lane may run on win32): resolve both
 * sides, then prefix-compare with a separator (a sibling workdir named
 * class2d_aaa1 vs class2d_aaa12 must not prefix-match).
 */
export function continueTargetsWorkdir(target: string, workdir: string): boolean {
  try {
    const t = path.resolve(target);
    const w = path.resolve(workdir);
    return t === w || t.startsWith(w + path.sep);
  } catch {
    return false;
  }
}

export async function runRealJob(job: EngineJobRef, upstream: UpstreamRef[]): Promise<RunOutcome> {
  // ---- engine-native jobs -------------------------------------------
  if (job.type === "import") {
    // t340 — the marathon natives (import's remote leg enumerates/sniffs
    // over SSH for minutes on big folders) get an IN-FLIGHT record + phase
    // log from second zero: the reconcile sweep's 120 s no-record flip used
    // to mark a long import FAILED mid-run, then COMPLETED when it landed.
    const begun = beginNativeRun(job, "engine-native: import (write micrographs.star)");
    let r: NativeResult;
    try {
      r = await runImportNative(job);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      abortNativeRun(job.id, msg, begun.prevOutputs);
      return { ok: false, error: `import crashed: ${msg}` };
    }
    if (!r.ok) abortNativeRun(job.id, r.error ?? "import failed", begun.prevOutputs);
    return r.ok ? { ok: true, native: true, result: r.result } : { ok: false, error: r.error, ...(r.wait ? { waiting: r.wait } : {}) };
  }
  if (job.type === "cs2star") {
    // t336 — CryoSPARC .cs → particles.star: engine-native on BOTH lanes
    // (the cluster lane is SSH in-process — discover, download, convert,
    // selective-link; no sbatch, no staging, the reference script's whole
    // workflow inside one job row)
    // t340 — same in-flight contract as import: the 325k-particle field
    // report ran >120 s with no record and the sweep flipped it FAILED
    // (「超时了没有返回log」) before the completion overwrite landed.
    const begun = beginNativeRun(job, "engine-native: cryosparc cs → star (selective links)");
    let r: NativeResult;
    try {
      r = await runCs2StarNative(job);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      abortNativeRun(job.id, msg, begun.prevOutputs);
      return { ok: false, error: `cs → star conversion crashed: ${msg}` };
    }
    if (!r.ok) abortNativeRun(job.id, r.error ?? "cs → star conversion failed", begun.prevOutputs);
    return r.ok ? { ok: true, native: true, result: r.result } : { ok: false, error: r.error };
  }
  if (job.type === "mapimport") {
    // t360 — the cluster lane SSHes (probe → cluster-side cp → verify), so
    // the in-flight record doctrine applies (the t340 lesson: a >30 s run
    // with no record reads as dead to the sweep)
    const begun = beginNativeRun(job, "engine-native: import map reference");
    let r: NativeResult;
    try {
      r = await runMapImportNative(job);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      abortNativeRun(job.id, msg, begun.prevOutputs);
      return { ok: false, error: `map import crashed: ${msg}` };
    }
    if (!r.ok) abortNativeRun(job.id, r.error ?? "map import failed", begun.prevOutputs);
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
  if (job.type === "select2d") {
    const r = await runSelect2dNative(job, upstream);
    return r.ok
      ? { ok: true, native: true, result: r.result }
      : { ok: false, error: r.error, ...(r.wait ? { waiting: r.wait } : {}) };
  }
  if (job.type === "symexpand") {
    const r = await runSymexpandNative(job, upstream);
    return r.ok
      ? { ok: true, native: true, result: r.result }
      : { ok: false, error: r.error, ...(r.wait ? { waiting: r.wait } : {}) };
  }
  if (job.type === "rebalance") {
    const r = await runRebalanceNative(job, upstream);
    return r.ok
      ? { ok: true, native: true, result: r.result }
      : { ok: false, error: r.error, ...(r.wait ? { waiting: r.wait } : {}) };
  }

  // ---- resolve inputs (EARLY — t315) ---------------------------------
  // Two verdicts must speak BEFORE the local-RELION gate below: a job whose
  // upstream hasn't produced its inputs goes PENDING regardless of whether
  // THIS machine has a local RELION (a remote-bound project may have none —
  // "RELION not detected" used to fail the row before the waiting verdict
  // could speak), and the cluster-resident refusal must fire first for the
  // same reason (the honest answer to "run this on my machine" with
  // cluster-absolute paths names the cluster door, not an install lecture).
  // The resume contract is preserved: an interrupted run's checkpoint still
  // resumes WITHOUT upstream re-validation (the guard below falls through).
  const workdir = workdirFor(job);
  const prevRun = readRuns()[job.id];
  const interrupted =
    prevRun != null && (prevRun.done === false || prevRun.exitCode !== 0);
  // t394 — an explicit user-chosen round (the "Continue from here:"
  // picker, or a typed path) outranks the auto-resume: the whole point of
  // choosing it012 is continuing from it012, not from whatever the newest
  // complete checkpoint happens to be. The auto-resume keeps its own
  // contract unchanged when nobody chose anything.
  const userContinue = explicitContinueOf(job);
  const resumableCheckpoint =
    userContinue == null && RESUMABLE_TYPES.has(job.type) && prevRun && interrupted && prevRun.jobId === job.id
      ? resumableOptimiser(workdir, job.type)
      : null;
  const resolved = resolveInputs(job.type, upstream, job.params);
  if (resolved.missing && resumableCheckpoint == null) {
    // upstream failed / still running / never ran → the dispatcher marks the
    // job PENDING (amber) instead of failed — no cascade of red jobs
    return {
      ok: false,
      error: resolved.missing,
      ...(resolved.wait ? { waiting: resolved.wait } : {}),
    };
  }
  const inputs = resolved.inputs;

  // ---- t315 — cluster-resident inputs: the local lane refuses ----------
  // A star full of cluster-absolute paths (remote project) on THIS machine
  // is a guaranteed 195× per-file failure — the WSL submission the user
  // reported. Refuse before the workdir exists, teach the right door.
  // t317 — the particles star gets the same door: a Particles import's
  // cluster-absolute stack refs would die per-particle in a local spawn.
  {
    const residentRefusal =
      clusterResidentRefusal(job.type, inputs.micrographs_star, job.projectId) ??
      clusterResidentParticlesRefusal(job.type, inputs.particles_star, job.projectId);
    if (residentRefusal) return { ok: false, error: residentRefusal };
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
  if (resumableCheckpoint) {
    // --o MUST point at the SAME output root the checkpoint was written
    // to (RELION in continue mode still checks the output dir from --o;
    // omitting it defaults to ./run relative to cwd → "output directory
    // does not exist" abort on the follower ranks).
    const outRoot = path.join(workdir, "run");
    const threads = String(Math.max(1, Math.round(num(job, "threads", 4))));
    let resumeArgv: string[] | null = null;
    if (bridge) {
      // WSL bridge resumes SEQUENTIALLY — same rationale as fresh bridged
      // runs (the distro MPI stack is the fragile part; --continue works
      // on the serial binary, checkpoint STAR files are rank-agnostic).
      resumeArgv = [
        binJoin(binDir, "relion_refine"),
        "--continue",
        resumableCheckpoint.file,
        "--o",
        outRoot,
        "--j",
        threads,
      ];
    } else {
      // POSIX binDir must not pass through path.join — binJoin keeps it
      // intact on every host platform (see its doc comment).
      const mpiBin = binJoin(binDir, "relion_refine_mpi");
      const mpirun = resolveMpirun(binDir, null);
      if (mpirun && existsSync(mpiBin)) {
        // gold-standard halves need leader + 2 half-mappers
        const nranks = job.type === "refine3d" ? 3 : 2;
        resumeArgv = [mpirun, "-n", String(nranks), mpiBin, "--continue", resumableCheckpoint.file, "--o", outRoot];
      } else {
        // t361 — no mpirun or no _mpi build: the old code left resumeArgv
        // null, the block fell through, and the job silently started a
        // FRESH run, discarding the checkpoint hours of iterations had
        // written. Checkpoint STARs are rank-agnostic (the bridge lane's
        // own doctrine above) — the serial binary takes --continue just
        // fine. Resume sequentially instead of restarting from zero.
        resumeArgv = [
          binJoin(binDir, "relion_refine"),
          "--continue",
          resumableCheckpoint.file,
          "--o",
          outRoot,
          "--j",
          threads,
        ];
      }
    }
    if (resumeArgv) {
      const preFlight = bridge ? verifyBridgeTarget(resumeArgv, bridge) : null;
      if (preFlight) return { ok: false, error: preFlight };
      return spawnTrackedRun(job, resumeArgv, workdir, binDir, resumableCheckpoint.iteration, bridge);
    }
  }

  // ---- t313 — the byte-verified CTF door guards the LOCAL lane too ------
  // Same gate as the remote dispatch (ctffindInputGate + local header
  // reads): a ctffind whose resolved star smells like movie naming gets its
  // flagged rows VERIFIED before anything else happens. A verified frame
  // stack (NZ>1) is refused BEFORE a workdir is created; a verified
  // single-section micrograph sails through (the t312 false positive is
  // dead). Lane difference, same honesty: the remote dispatch refuses as a
  // REQUEST error (row untouched, toast teaches); the local lane fails the
  // row WITH the message as its result — the card itself carries the lesson
  // (MotionCorr first). The allowed-but-smelled note rides the result text.
  let ctffindGateNote: string | null = null;
  if (job.type === "ctffind" && inputs.micrographs_star) {
    const gate = await ctffindInputGate(inputs.micrographs_star, localHeaderSniffer);
    if (gate.refusal) return { ok: false, error: gate.refusal };
    ctffindGateNote = gate.note;
  }

  // t335 — the frame census note rides the local run's result (the same
  // plumbing as the CTF gate's note)
  let extractGateNote: string | null = null;

  // ---- t334 — the extraction collision scan (before the workdir) --------
  // Same doctrine as the CTF byte-gate above, same lane position: a STAR
  // whose micrograph rows would write the SAME per-mic particle stack
  // (duplicate rows; "X.mrc" + "X.mrcs" both → "X.mrcs") is a guaranteed
  // mid-run image.h:1534 ("write: target and source objects have different
  // size") or a silently doubled particle set — both knowable from the
  // star text, before the workdir exists. Local lane: the row fails WITH
  // the message; the remote dispatch refuses the REQUEST (toast teaches).
  if (job.type === "extract" && inputs.micrographs_star && existsSync(inputs.micrographs_star)) {
    try {
      const report = scanExtractCollisions(readFileSync(inputs.micrographs_star, "utf8"));
      if (report && (report.duplicates.length > 0 || report.clashes.length > 0)) {
        return {
          ok: false,
          error: `the micrographs STAR would collide inside the extraction: ${describeExtractCollisions(report)} — RELION names each particle stack after the micrograph (extension swapped to .mrcs), so these rows write the same file (the mid-run "write: target and source objects have different size" crash). De-duplicate the rows or rename the colliding files, then run again`,
        };
      }
    } catch {
      /* unreadable star → the run itself reports the real problem */
    }
  }

  // t335 — the frame-stack census on the local lane (the complement to the
  // collision scan above): .mrcs rows are byte-verified through the local
  // header sniffer — nz>1 is a movie stack, not a micrograph (read as an
  // (x,y,1,N) volume, windowed from frame 0: garbage particles even when
  // the names never collide). Verified singles pass with a note; anything
  // unverifiable degrades to the note, never a block.
  // (t338 — this block used to sit INSIDE the collision scan's catch
  // clause — a brace-nesting slip that made the census dead code on the
  // happy path; it now runs where its doctrine says it does.)
  if (job.type === "extract" && inputs.micrographs_star && existsSync(inputs.micrographs_star)) {
    let extractRows: string[] = [];
    try {
      extractRows = micrographNames(inputs.micrographs_star);
    } catch {
      extractRows = [];
    }
    if (extractRows.some((r) => /\.mrcs$/i.test(r))) {
      const projectDir = projectDirFor(job);
      const frameGate = await extractInputGate(
        extractRows,
        localHeaderSniffer,
        (row) => (row.startsWith("/") || existsSync(row) ? row : path.join(projectDir, row))
      );
      if (frameGate.refusal) return { ok: false, error: frameGate.refusal };
      extractGateNote = frameGate.note;
    }
  }

  // ---- t338 — the particle-star ↔ stack consistency gate (local lane) ----
  // Same doctrine as the byte gates above, mirrored from the remote
  // dispatch: a particles star whose rows reference image numbers beyond
  // what their stacks actually hold is the poison the field report paid
  // ~20 GPU-minutes to discover (readMRC: "Image number 341 exceeds stack
  // size 340" — the upstream extraction COMPLETED with a lying star: two
  // same-stem rows in ITS input wrote one stack; the later writer's blind
  // overwrite truncated the earlier images). Refuse BEFORE the workdir or
  // a spawn exists, with the exact numbers RELION would die on; healthy
  // stars pass with the receipt note riding the run's result.
  let particlesGateNote: string | null = null;
  if (
    PARTICLES_CONSUMER_TYPES.has(job.type) &&
    inputs.particles_star &&
    existsSync(inputs.particles_star)
  ) {
    try {
      const starText = readFileSync(inputs.particles_star, "utf8");
      if (particleRefsFromContent(starText).length > 0) {
        // relative refs resolve against the run's CWD (the project dir),
        // then the star's own dir — RELION's star grammar, both lanes
        const projectDir = projectDirFor(job);
        const starDir = path.dirname(inputs.particles_star);
        const gate = await particlesRefGate(
          inputs.particles_star,
          starText,
          localHeaderSniffer,
          (ref) => refCandidates(ref, projectDir, starDir)
        );
        if (gate.refusal) return { ok: false, error: gate.refusal };
        particlesGateNote = gate.note;
      }
    } catch {
      /* unreadable star → the run itself reports the real problem */
    }
  }

  // ---- workdir ----------------------------------------------------------
  mkdirSync(workdir, { recursive: true });

  // ---- t333 — the fresh-start wipe ---------------------------------------
  // This point is only reached on a FRESH start: the engine-native jobs
  // returned above, and the --continue resume branch (interrupted
  // refine-family with a usable checkpoint) returned above too — its
  // checkpoints are the state it resumes. A fresh start must NOT inherit
  // the previous generation's products: the workdir is stable across
  // runs, RELION writes into whatever sits at its output paths, and the
  // field report died exactly there (relion_preprocess, image.h:1534
  // "write: target and source objects have different size" — the old
  // .mrcs stacks vs the new box size; a NEW job sailed). The shared
  // classifier keeps input doors (symlinks), note.txt, the manifest and
  // anything unrecognized; products, iterations, scratch and logs die.
  // A wipe hiccup degrades to the pre-t333 behavior — never a refusal.
  //
  // t394 — an explicit --continue whose target lives INSIDE this workdir
  // keeps the run_it###_* family alive (RELION's own restart world: the
  // continued run rewrites each round as it reaches it, and the chosen
  // optimiser + siblings are the state it resumes from). A target
  // elsewhere (an upstream job's optimiser — the cross-job continue)
  // wipes as before: this workdir's own rounds are then a stale
  // generation, not a resume state.
  const keepIterations = userContinue != null && continueTargetsWorkdir(userContinue, workdir);
  try {
    const wipeResult = wipeLocalRunProducts(workdir, keepIterations ? { keepIterations: true } : undefined);
    if (wipeResult && wipeResult.wiped.length > 0) {
      console.log(
        `engine: fresh run of ${job.type} ${job.id.slice(-8)} cleared ${wipeResult.wiped.length} stale product file(s) from the previous run (t333)` +
          (keepIterations ? " — the run_it* checkpoint family stays (explicit --continue, t394)" : "")
      );
    }
  } catch {
    /* best effort — the run itself will surface anything real */
  }

  // ---- build argv ---------------------------------------------------------
  const ctx: BuildCtx = { binDir, workdir, inputs, job, upstream, bridge };
  const built = await buildArgv(ctx);
  if ("error" in built) {
    return { ok: false, error: built.error };
  }
  let argv = built;

  // ---- MPI prefix for parallel types --------------------------------------
  const mpirun = resolveMpirun(binDir, bridge);
  // WSL2 bridge: the distro-side MPI stack is the known-fragile part (static
  // OpenMPI builds / vader BTL under WSL2 — ranks die at launch with exit 1
  // even with the root opt-in env pair). Every user-reported MPI failure so
  // far was bridged mpirun. So: NATIVE keeps multi-rank mpirun when the
  // launcher resolves; BRIDGED (or native with no mpirun on PATH — e.g. a
  // source build whose MPI deps were cleaned up) runs the SERIAL
  // relion_refine with --j threads.
  // The old comment claimed "gold-standard halves work on one rank too" —
  // disproved live: RELION 5.0.1's serial binary HARD-ERRORS on
  // --split_random_halves ("Cannot split data into random halves without
  // using MPI!"). The RELION-sanctioned serial path is
  // --debug_split_random_half 1: run half1's data only (FSC stopping is
  // inert in auto-refine; iterations run to completion). That is exactly
  // right for CPU/sequential hosts and this engine's job-graph testing.
  const mpiEligible = MPI_PARALLEL_TYPES.has(job.type);
  let mpiWrapped = false;
  if (mpiEligible && mpirun && !bridge) {
    // RELION ships serial AND _mpi builds — mpirun must launch the MPI build
    // (a serial binary under mpirun runs N independent copies: no parallelism,
    // and --split_random_halves hard-errors without MPI).
    const target = argv[0] as string;
    // (bridge is null in this branch — the WSL path took the sequential
    // fallback above — so a plain host-side existsSync is the right check)
    const canMpi = target.startsWith("/") && existsSync(target + "_mpi");
    if (canMpi) {
      argv[0] = target + "_mpi";
      // --split_random_halves (gold-standard FSC) needs leader + 2 half-mappers
      const nranks = job.type === "refine3d" ? 3 : 2;
      // WSL2 / OpenMPI 4.x: TCP BTL needed for cross-process communication;
      // --allow-run-as-root bypasses the root-check in OMPI 4.x.
      argv = [mpirun, "--mca", "btl", "self,tcp", "--allow-run-as-root", "-n", String(nranks), ...argv];
      mpiWrapped = true;
    }
    // t361 — mpirun resolved but the install carries no _mpi build: the old
    // code STILL wrapped mpirun around the SERIAL relion_refine, which is N
    // independent full runs — the t360 cluster catastrophe (duplicated logs,
    // uncoordinated writers shredding run_itNNN_classes.mrcs), local edition,
    // live whenever a host has mpirun but a partial RELION. class3d had no
    // --split_random_halves to force a fast serial error, so it corrupted
    // silently. Now: no _mpi binary → fall through to the sequential fallback
    // below (serial binary, --j threads, split-halves swap) — one universe,
    // honest and single-writer.
  }
  if (mpiEligible && !mpiWrapped) {
    // Sequential fallback — covers THREE shapes: the WSL bridge, native
    // hosts where mpirun did not resolve, and (t361) native hosts where
    // mpirun resolved but the install carries no _mpi build (previously
    // this case fell through with NO handling at all: no --j AND
    // --split_random_halves left in argv, so refine3d hard-errored and
    // class3d ran single-threaded).
    const splitIdx = argv.indexOf("--split_random_halves");
    if (splitIdx !== -1) {
      // serial relion_refine cannot split halves: swap in the debug path
      argv.splice(splitIdx, 1);
      argv.push("--debug_split_random_half", "1");
    }
    // RELION defaults to --j 1 without an explicit thread count; 4 matches
    // the class2d sequential default
    if (!argv.includes("--j")) {
      argv.push("--j", String(Math.max(1, Math.round(num(job, "threads", 4)))));
    }
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

  return spawnTrackedRun(job, argv, workdir, binDir, undefined, bridge, ctffindGateNote ?? extractGateNote ?? particlesGateNote);
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
  // t323-a (review) — the sweep maps sacct's TIMEOUT word onto 124
  // (timeout(1)'s idiom, remote-run.ts's accounting fallback); a walltime
  // kill is one of the silent-death note's own named suspects and used to
  // arrive with NO meaning at all ("exit 124" and silence).
  if (code === 124) return "walltime limit reached (TIMEOUT) — raise the time limit or split the run";
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
  // Prefer the ROOT CAUSE line (first high-signal stderr line, skipping the
  // mpirun/bash epilogue) over the blind tail — an MPI failure's tail is the
  // wrapper's generic last words, the reason is always printed earlier.
  const errTail = rootCauseDetail(state.errFile) || tailText(state.errFile, 280);
  const outTail = errTail ? "" : rootCauseDetail(state.logFile) || tailText(state.logFile, 280);
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

/**
 * Interrupted-run result: the exit handler was lost (server restart / HMR
 * reload) AND no atomic outputs landed, so the true outcome is unknown.
 * Unlike the old bare "interrupted (exit unknown) — re-run", this surfaces
 * the stderr/stdout tails and the command — bash's own error (e.g.
 * "exec: \home\u\…: No such file or directory") is exactly what lands in
 * run.err for instantly-dead runs, and it is the fastest way for the user
 * to see WHY the process vanished.
 */
function interruptedResult(state: RunRecord): string {
  const errTail = rootCauseDetail(state.errFile) || tailText(state.errFile, 280);
  const outTail = errTail ? "" : rootCauseDetail(state.logFile) || tailText(state.logFile, 280);
  const parts: string[] = ["interrupted (exit unknown) — re-run"];
  if (errTail || outTail) parts.push(errTail || outTail);
  const cmd = state.cmd.length > 160 ? state.cmd.slice(0, 160) + "…" : state.cmd;
  parts.push(`command: ${cmd}`);
  parts.push(`logs: ${state.errFile} + ${state.logFile}`);
  return parts.join(" — ").slice(0, 900);
}

function attachExitHandler(
  job: EngineJobRef,
  child: ChildProcess,
  startedAt: string,
  ctffindGateNote: string | null = null
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
      const state = getRun(job.id);
      // A newer run may have replaced this record — only handle our own.
      if (!state || state.startedAt !== startedAt) return;

      let outputs: Record<string, string> = {};
      let result: string | null = null;
      // RELION's topaz wrapper swallows topaz's own failure: the training/
      // extract bash script is run via system() and a nonzero return is only
      // a stderr WARNING — relion_autopick still exits 0. A topaztrain that
      // produced NO model is therefore a failure (observed live: missing
      // topaz python module → "ModuleNotFoundError" in run.out but job
      // otherwise "completes"); rootCauseDetail digs the python traceback
      // out of run.out for the toast.
      const topazSilentFail =
        job.type === "topaztrain" && exitCode === 0;

      if (exitCode === 0) {
        const collected = collectOutputs(job.type, state.workdir);
        outputs = collected.outputs;
        result = collected.result;
        // t313 — the byte-verified gate's "allowed" note rides the success
        // text (the user saw movie-stack names and deserves the receipt)
        if (ctffindGateNote) result = `${result} — ${ctffindGateNote}`.slice(0, 900);
      } else {
        result = failureResult(state, exitCode);
      }

      if (topazSilentFail && !outputs.topaz_model) {
        // run.err accumulates across attempts (append-mode engine logs), so
        // its FIRST high-signal line is usually a stale earlier attempt —
        // the python traceback of THIS attempt lands in run.out (the topaz
        // bash script appends there). Scan run.out first.
        const cause =
          rootCauseDetail(state.logFile) ||
          rootCauseDetail(state.errFile) ||
          tailText(state.logFile, 280);
        result = `topaz training failed — ${cause || "no model produced (see run.out)"}`;
        updateRun(job.id, (rec) =>
          rec.startedAt === startedAt ? { ...rec, done: true, exitCode, outputs, result } : null
        );
        void db.job
          .update({
            where: { id: job.id },
            data: { status: "failed", progress: 0, result },
          })
          .catch((err) => console.error("engine: DB update on topaz train failure failed:", err));
        return;
      }

      updateRun(job.id, (rec) =>
        rec.startedAt === startedAt ? { ...rec, done: true, exitCode, outputs, result } : null
      );

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
    updateRun(job.id, (rec) =>
      rec.startedAt === startedAt
        ? { ...rec, done: true, exitCode: -1, result: `spawn failed — ${err.message}` }
        : null
    );
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

/**
 * Wrapper-epilogue noise that lands at the END of a failed run's stderr —
 * blind-tailing run.err after an MPI failure shows these generic last words
 * ("mpirun detected that one or more processes exited with non-zero status")
 * instead of the actual reason a rank died, which was printed EARLIER in the
 * same file by the rank itself / bash / OpenMPI launch checks.
 */
const ERR_NOISE_RE: RegExp[] = [
  /^-{3,}$/,
  /^={3,}$/,
  /^\s*$/,
  /mpirun (?:has detected|detected that|was unable to|realized|has exited)/i,
  /mpiexec (?:has detected|detected that)/i,
  /^Primary job terminated normally/i,
  /MPI_ABORT was invoked/i,
  /^\[\d+,\d+\]/, // "[17538,1],1]" rank process tags
  /^Process name:/i,
  /^Exit code:/i,
  /^MCA collector/i,
  /^SIG(?:TERM|CONT|INT|KILL)\b/i,
  /set the MCA parameter/i,
  /^A high-performance Open MPI/i,
];

/** High-signal shapes worth surfacing as THE reason a run died. */
const ERR_SIGNAL_RE: RegExp[] = [
  /\berror\b/i,
  /cannot\b/i,
  /no such file/i,
  /\bnot found\b/i,
  /fail(?:ed|ure|ing)/i,
  /abort/i,
  /assert/i,
  /segmentation/i,
  /core dumped/i,
  /out of memory/i,
  /bad_alloc/i,
  /terminate called/i,
  /std::\w+error/i,
  /exception/i,
  /traceback/i,
  /unable to/i,
  /\binvalid\b/i,
  /too (?:few|many)/i,
  /\bmissing\b/i,
  /insufficient/i,
  /permission denied/i,
  /what\(\):/i,
  /corrupt/i,
  /unrecognized|unknown option/i,
];

/**
 * Pull the ROOT CAUSE out of a stderr log rather than its tail. Scans the
 * recent tail of the file line by line, skips the wrapper-noise shapes
 * above, and returns the earliest high-signal line plus up to two
 * continuation lines (RELION often prints a bare "ERROR:" with the actual
 * message on the following line). Returns "" when nothing better than the
 * epilogue exists — callers then fall back to the plain tail.
 */
export function rootCauseDetail(file: string): string {
  try {
    if (!existsSync(file)) return "";
    const lines = readTail(file, 16384).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || ERR_NOISE_RE.some((re) => re.test(line))) continue;
      if (!ERR_SIGNAL_RE.some((re) => re.test(line))) continue;
      // First signal hit: attach up to two continuation lines (detail lines
      // after a bare "ERROR:" / C++ "terminate called after throwing …")
      const parts: string[] = [line];
      for (let j = i + 1; j < lines.length && parts.length < 3; j++) {
        const cont = lines[j];
        if (!cont.trim()) break;
        if (ERR_NOISE_RE.some((re) => re.test(cont))) break;
        parts.push(cont);
        // a second signal line is its own event — stop attaching
        if (j > i && ERR_SIGNAL_RE.some((re) => re.test(cont))) break;
      }
      return parts
        .join(" | ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 260);
    }
    return "";
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
 * finished, so an orphaned record can be finalized as completed.
 *
 * refine3d is in via the `refine_data_star` gate: auto-refine writes
 * run_data.star exactly once at convergence (mid-run there are ONLY
 * run_itXXX_data.star files), so its presence proves the run finished —
 * verified live: a detached auto-refine converged (9.44 Å) after its exit
 * handler died with a server restart, and reconcile falsely reported
 * "interrupted". class3d/class2d stay excluded: their per-iteration
 * artifacts are indistinguishable from their final ones (same naming), so
 * the safe recovery for them remains "interrupted" + --continue.
 */
const ORPHAN_COMPLETABLE = new Set(["ctffind", "motioncorr", "extract", "autopick", "refine3d"]);
/** Primary output key per completable type (collectOutputs gate). */
const ORPHAN_PRIMARY_KEY: Record<string, string> = {
  ctffind: "micrographs_ctf_star",
  motioncorr: "micrographs_star",
  extract: "particles_star",
  autopick: "coords_star",
  refine3d: "refine_data_star",
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
      // [boot-race] Task 183: the Live row flipped here twice after
      // build→restart cycles while its record SAT in engine-state.json
      // (pid 1, /proc/1 always alive). This dump convicts the branch
      // inputs at flip time: keys tells whether readRuns() saw the file's
      // 19 records or an empty/missing parse (standalone snapshot theory).
      console.error(
        `[boot-race] no-engine-record flip: job=${job.id} name="${job.name}" keys=${Object.keys(runs).length} fileExists=${existsSync(STATE_FILE)} fileSize=${existsSync(STATE_FILE) ? statSync(STATE_FILE).size : -1} startedAt=${job.startedAt?.toISOString() ?? "null"} at=${new Date().toISOString()} pid=${process.pid}`
      );
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
    // REMOTE records are owned by reconcileRemoteJobs (lib/remote/remote-run.ts):
    // their pid is a CLUSTER pid — the local pidAlive below would probe an
    // unrelated local process and could false-positive "alive" forever. Skip;
    // the remote sweep polls the cluster over SSH and finalizes these.
    if (state.remote) {
      out.push(job);
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
      const parsed = parseProgress(job.type, state.logFile, parseJobParams(job.params));
      // t319 — the monotonic contract: a running job's progress NEVER
      // regresses. The log-tail window slides (a growing log can push the
      // bar out of the last 4096 bytes for whole seconds) and a null parse
      // must never drag the bar back to the dispatch-time 0 — the user's
      // 99% → 0% → 99% oscillation was exactly this fall-through. The
      // updateMany is status-guarded so it can never touch a row a
      // concurrent finalize already completed.
      if (parsed != null) {
        const next = Math.max(job.progress, parsed);
        if (next !== job.progress) {
          await db.job
            .updateMany({ where: { id: job.id, status: "running" }, data: { progress: next } })
            .catch(() => null);
          out.push({ ...job, progress: next });
          continue;
        }
      }
      out.push(job);
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
          updateRun(job.id, (rec) =>
            rec.startedAt === state.startedAt
              ? {
                  ...rec,
                  done: true,
                  exitCode: 0,
                  outputs: collected.outputs,
                  result: collected.result,
                }
              : null
          );
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
      const patch = {
        status: "failed" as const,
        progress: 0,
        result: interruptedResult(state),
      };
      const updated = await db.job
        .update({ where: { id: job.id }, data: patch })
        .catch(() => null);
      out.push(updated ?? { ...job, ...patch });
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

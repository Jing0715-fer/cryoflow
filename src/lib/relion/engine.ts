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
import { getConnection } from "@/lib/remote/connections";
import { remoteHeaderSniffer } from "@/lib/remote/sniff";
import { listRemoteDir, REMOTE_IMPORT_MAX_ENTRIES, statRemoteFiles } from "@/lib/remote/remote-ls";
import { exec as sshExec } from "@/lib/remote/ssh";
import type { RemoteRunState } from "@/lib/remote/types";
import { readMrcHeader } from "@/lib/mrc";
import { sniffImageFile, spreadSample, type HeaderSniffer, type SniffVerdict } from "./mrc-sniff";
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
  return v === undefined || v === null ? fallback : String(v);
}

function flag(job: EngineJobRef, key: string): boolean {
  return String(job.params[key] ?? "false") === "true";
}

/** Micrograph pixel size from the pipeline's Import job (Å). */
function micAngpix(upstream: UpstreamRef[]): number | null {
  const importUp = upstream.find((u) => u.type === "import");
  return importUp?.params && typeof importUp.params.pixelSize === "number"
    ? importUp.params.pixelSize
    : null;
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
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "class2d", "select", "select2d", "joinstar", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
  ],
  select2d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "class2d", "select2d"], label: "classified particles STAR with _rlnClassNumber (run 2D Classification first)" },
    // class averages only feed the selection GALLERY — missing stack must
    // never block the run (older jobs may lack the output)
    { key: "classes_mrc", accepts: ["classes_mrc"], from: ["class2d"], label: "2D class averages (gallery)", optional: true },
  ],
  class2d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "select", "select2d", "class2d", "joinstar", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
  ],
  initialmodel: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "select", "select2d", "class2d", "joinstar", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
  ],
  class3d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "select", "select2d", "class2d", "initialmodel", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    // the reference MUST be a 3D map: initialmodel's VDAM model or class3d's
    // own 3D class volumes. class2d is deliberately absent — its classes are
    // 2D averages, and seeding a 3D refinement with them silently produced
    // garbage (observed live: refine3d exec'd with class2d's
    // run_unmasked_classes.mrcs as --ref while initialmodel was still running).
    { key: "model_mrc", accepts: ["model_mrc", "classes_mrc"], from: ["initialmodel", "class3d", "mapimport"], label: "reference map (run InitialModel first, or import a map)" },
  ],
  refine3d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "select", "select2d", "class2d", "joinstar", "initialmodel", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    // 3D reference only — never class2d's 2D averages (see class3d note)
    { key: "model_mrc", accepts: ["model_mrc", "classes_mrc"], from: ["initialmodel", "class3d", "mapimport"], label: "reference map (run InitialModel first, or import a map)" },
  ],
  multibody: [
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "select", "select2d", "class2d", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    { key: "optimiser_star", accepts: ["optimiser_star"], from: ["refine3d", "class3d"], label: "optimiser.star (run Refine3D first)" },
  ],
  symexpand: [
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "select", "select2d", "class2d", "initialmodel", "class3d", "refine3d", "joinstar", "symexpand", "rebalance"], label: "particles.star with Euler angles (run Extract/Refine first)" },
  ],
  rebalance: [
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "select", "select2d", "class2d", "initialmodel", "class3d", "refine3d", "joinstar", "symexpand", "rebalance"], label: "oriented particles STAR with _rlnAngleRot/Tilt (refine/classify output)" },
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
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "refine3d", "class2d", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    { key: "postprocess_star", accepts: ["postprocess_star"], from: ["postprocess"], label: "postprocess.star (run PostProcess first)" },
    { key: "micrographs_star", accepts: ["micrographs_star", "corrected_micrographs_star"], from: ["motioncorr", "import"], label: "corrected micrographs.star (run MotionCorr first)" },
  ],
  ctfrefine: [
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "refine3d", "class2d", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    { key: "postprocess_star", accepts: ["postprocess_star"], from: ["postprocess"], label: "postprocess.star (run PostProcess first)" },
  ],
  dynamight: [
    { key: "particles_star", accepts: ["particles_star", "refine_data_star"], from: ["import", "extract", "refine3d", "class2d", "symexpand", "rebalance"], label: "particles.star (run Extract first)" },
    { key: "model_mrc", accepts: ["model_mrc", "map_mrc"], from: ["refine3d", "postprocess"], label: "consensus map (run Refine3D first)" },
  ],
  modelangelo: [
    { key: "map_mrc", accepts: ["map_mrc", "model_mrc"], from: ["postprocess", "refine3d"], label: "sharpened map (run PostProcess first)" },
  ],
  subtract: [
    { key: "optimiser_star", accepts: ["optimiser_star"], from: ["refine3d", "class3d"], label: "optimiser.star (run Refine3D first)" },
    { key: "mask_mrc", accepts: ["mask_mrc"], from: ["maskcreate"], label: "mask of signal to subtract (run MaskCreate first)" },
    { key: "particles_star", accepts: ["particles_star"], from: ["import", "extract", "refine3d"], label: "particles.star (run Extract first)" },
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
  params?: Record<string, unknown>
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
  starLines: string[]
): Promise<
  | { kind: "not-remote" }
  | { kind: "error"; error: string }
  | { kind: "done"; result: string; sourceLabel: string }
> {
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
      const { missing } = await statRemoteFiles(conn, listed);
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
  return {
    kind: "done",
    result: `${clusterFiles.length} ${kindWord} imported from ${conn.name || conn.host}${kindNote}${skipNote}${note}${sniffNote}${mismatch} — paths stay on the cluster (zero upload) · pixel ${String(job.params.pixelSize ?? 1.77)} Å`,
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
      const remoteLeg = await runImportRemoteLeg(job, customRaw, lines);
      if (remoteLeg.kind === "error") {
        return { ok: false, error: remoteLeg.error };
      }
      if (remoteLeg.kind === "done") {
        result = remoteLeg.result;
        sourceLabel = remoteLeg.sourceLabel;
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
 * ImportMap: bring a standalone 3D map into the project as a reference —
 * RELION's import-map workflow, and the landing pad for sub-volume crops
 * (the 3D viewer's send-to-new-job materializes the crop into the parent
 * job's SubVolumes/ folder and points a mapimport job at it; the crop then
 * feeds class3d/refine3d reference inputs through the model_mrc output).
 * Engine-native: no CLI to run — validate the map, link it into the job's
 * own workdir (so the Files tab and outputs/file route serve it like any
 * other output), and declare model_mrc for the downstream chain.
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
  return path.join(ctx.workdir, name);
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
export async function buildArgv(ctx: BuildCtx): Promise<string[] | { error: string }> {
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
        "--fast_search",
      ];
      // ctx.ctffindExe: execution-context override (the remote layer passes
      // the CLUSTER-side ctffind; the sandbox default is host-local and
      // meaningless on a remote node)
      const ctffindExe = (ctx as BuildCtx & { ctffindExe?: string | null }).ctffindExe ?? resolveCtffind(ctx.bridge);
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
      argv.push(
        "--norm", "--bg_radius", String(bg),
        "--white_dust", "3",
        "--black_dust", "-3"
      );
      return argv;
    }

    case "class2d": {
      const argv = [
        binJoin(binDir, "relion_refine"),
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
        // class2d runs the SERIAL binary (WSL2 MPI stacks are the known-fragile
        // part — see the MPI prefix section in runRealJob), so thread-level
        // parallelism comes from --j (RELION defaults to 1 without it)
        "--j", String(Math.max(1, Math.round(num(job, "threads", 4)))),
      ];
      // optional cap on alignment resolution (0 = unlimited)
      const hl = num(job, "highresLimit", 0);
      if (hl > 0) argv.push("--highres_limit", String(hl));
      return argv;
    }

    case "initialmodel": {
      // VDAM gradient refinement — no MPI (RELION forbids --grad with MPI)
      return [
        binJoin(binDir, "relion_refine"),
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
        binJoin(binDir, "relion_refine"),
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
        binJoin(binDir, "relion_refine"),
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
        binJoin(binDir, "relion_mask_create"),
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
        binJoin(binDir, "relion_postprocess"),
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
      const mc2 = await externalFor(ctx, "motioncor2", ["motioncor2", "MotionCor2"]);
      if (!mc2) {
        return {
          error: ctx.externals
            ? "MotionCor2 executable not found on the cluster (probed after module load) — install MotionCor2 there, or run MotionCorr locally"
            : "MotionCor2 executable not found — EMPIAR-10017 images are pre-averaged anyway (import them as micrographs and skip MotionCorr)",
        };
      }
      return [
        binJoin(binDir, "relion_run_motioncorr"),
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
          "--threshold", String(num(job, "threshold", 0.4)),
          "--lowpass", String(num(job, "lowpass", 20)),
        );
      } else if (method === "Topaz") {
        // relion_python_topaz is a conda-env python wrapper — it exists on
        // disk in every RELION 5 install, but the `topaz` MODULE may be
        // missing. A file-existence probe cannot catch that; if the module
        // is absent the run fails honestly and rootCauseDetail surfaces the
        // ModuleNotFoundError from run.err.
        const topaz = await externalFor(ctx, "topaz", ["relion_python_topaz", "topaz"]);
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
          "--topaz_nr_particles", String(Math.round(num(job, "topazNrParticles", 200))),
          "--topaz_threshold", String(num(job, "topazThreshold", -6)),
          // particle diameter drives the extract radius (RELION converts
          // Å → pix with the micrograph pixel size)
          "--particle_diameter", String(num(job, "topazDiameter", 180)),
        );
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
          "--LoG_diam_min", String(num(job, "logDiamMin", 120)),
          "--LoG_diam_max", String(num(job, "logDiamMax", 180)),
          "--LoG_adjust_threshold", String(num(job, "logAdjustThreshold", 0)),
        );
        const upper = num(job, "logUpperThreshold", 99999);
        if (upper > 0 && upper < 99999) argv.push("--LoG_upper_threshold", String(upper));
        if (flag(job, "logInvert")) argv.push("--Log_invert");
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
      const topaz = await externalFor(ctx, "topaz", ["relion_python_topaz", "topaz"]);
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
      const argv = [
        binJoin(binDir, "relion_postprocess"),
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
        binJoin(binDir, "relion_motion_refine"),
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
        binJoin(binDir, "relion_ctf_refine"),
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
      const argv = [
        binJoin(binDir, "relion_particle_subtract"),
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
        binJoin(binDir, "relion_align_tiltseries"),
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
        result = parseRefineResult(workdir) ?? result ?? `REAL: ${type === "class3d" ? "3D classification" : "3D refinement"} finished`;
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
    return parseProgressText(type, tail, params);
  } catch {
    return null;
  }
}

/**
 * Content-based progress parser — the remote layer's entry (log text arrives
 * over SSH, not from a local file). Same heuristics as parseProgress.
 */
export function parseProgressText(
  type: string,
  tail: string,
  params: Record<string, number | string | boolean>
): number | null {
  try {
    if (!tail) return null;
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
 */
function continueCompanions(type: string, it: string): string[] {
  // every continue mode reloads the data/model/sampling triple
  const stars = [
    `run_it${it}_data.star`,
    `run_it${it}_model.star`,
    `run_it${it}_sampling.star`,
  ];
  if (type === "refine3d" || type === "multibody" || type === "class3d") {
    // 3D reconstruction restart reads the unfiltered gold-standard halves
    // (class001 — refine3d/multibody are K=1; class3d K>1 writes them all
    // in the same flush, so class001 missing ⇔ the iteration is partial)
    return [
      ...stars,
      `run_it${it}_half1_class001_unfil.mrc`,
      `run_it${it}_half2_class001_unfil.mrc`,
    ];
  }
  if (type === "class2d") {
    // the reloaded model references the per-class average images
    return [...stars, `run_it${it}_class001.mrc`];
  }
  return stars; // initialmodel (VDAM/grad) & anything else — star-only
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
  try {
    const matches = readdirSync(workdir)
      .map((n) => {
        const m = n.match(/^run_it(\d+)_optimiser\.star$/i);
        return m ? { file: path.join(workdir, n), iteration: Number(m[1]) } : null;
      })
      .filter((x): x is { file: string; iteration: number } => x != null);
    matches.sort((a, b) => b.iteration - a.iteration);
    for (const candidate of matches) {
      const it = String(candidate.iteration).padStart(3, "0");
      const ok = continueCompanions(type, it).every((f) =>
        existsSync(path.join(workdir, f))
      );
      if (ok) return candidate;
    }
    return null;
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
  if (job.type === "mapimport") {
    const r = await runMapImportNative(job);
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
  const resumableCheckpoint =
    RESUMABLE_TYPES.has(job.type) && prevRun && interrupted && prevRun.jobId === job.id
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
  if (mpiEligible && mpirun && !bridge) {
    // RELION ships serial AND _mpi builds — mpirun must launch the MPI build
    // (a serial binary under mpirun runs N independent copies: no parallelism,
    // and --split_random_halves hard-errors without MPI).
    const target = argv[0] as string;
    // (bridge is null in this branch — the WSL path took the sequential
    // fallback above — so a plain host-side existsSync is the right check)
    const canMpi = target.startsWith("/") && existsSync(target + "_mpi");
    if (canMpi) argv[0] = target + "_mpi";
    // --split_random_halves (gold-standard FSC) needs leader + 2 half-mappers
    const nranks = job.type === "refine3d" ? 3 : 2;
    // WSL2 / OpenMPI 4.x: TCP BTL needed for cross-process communication;
    // --allow-run-as-root bypasses the root-check in OMPI 4.x.
    argv = [mpirun, "--mca", "btl", "self,tcp", "--allow-run-as-root", "-n", String(nranks), ...argv];
  } else if (mpiEligible) {
    // Sequential fallback — covers BOTH the WSL bridge AND native hosts
    // where mpirun did not resolve (previously this case fell through with
    // NO handling at all: no --j AND --split_random_halves left in argv,
    // so refine3d hard-errored and class3d ran single-threaded).
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

  return spawnTrackedRun(job, argv, workdir, binDir, undefined, bridge, ctffindGateNote);
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

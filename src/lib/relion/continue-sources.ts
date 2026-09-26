/**
 * CryoFlow — the "Continue from here:" round picker's data plane (t394).
 *
 * 「continue from here 可以变成下拉菜单选择从前面哪一轮继续，也可以
 * 自己输入路径」— RELION's fn_cont field is a raw text box in the GUI
 * (with a browser), and cryoflow's form inherited exactly that: a blank
 * Input that demands the user already KNOWS where the checkpoints live.
 * The rounds exist — a refine-family run writes run_itNNN_optimiser.star
 * every iteration — but nothing in the UI could see them.
 *
 * This module answers ONE question for the picker: WHICH rounds exist and
 * are actually usable? Sources, in order:
 *
 *   · self — THIS job's own previous run (its latest RunRecord): a
 *     re-run that continues from its own round is RELION's native
 *     restart, the exact world the local lane's auto-resume already
 *     runs in;
 *   · upstream — the job's refine-family ancestors (lineageFor, BFS
 *     input-priority order, capped): the cross-job continue (a refine3d
 *     picking up from a class3d's optimiser, a multibody from a refine3d's)
 *     is RELION's other native idiom.
 *
 * Every round is judged by the SAME completeness law the engine's
 * resumableOptimiser applies to auto-resume (continueCompanions): an
 * optimiser without its data/model/sampling siblings (+ the type's mrc
 * family) is a checkpoint flush that died mid-write, and --continue on it
 * aborts inside RELION — the picker shows it, disabled, with the missing
 * names, instead of letting the user pick a guaranteed crash.
 *
 * Lanes: a run that executed on the CLUSTER is listed over SSH (one
 * find round per source — glob run_it*, maxdepth 1, so the t385
 * .cryoflow_prev archive never answers) and its paths are CLUSTER paths;
 * a local run reads the mirror directly and speaks host paths. The
 * picker's lane badge says which world a path belongs to.
 *
 * Never throws — a source that cannot answer carries its error honestly
 * (the usage-route dialect); the route stays 200.
 */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { continueCompanions, getRun } from "./engine";
import { lineageFor } from "./dispatch";
import { listRemoteDir } from "@/lib/remote/remote-ls";

/** The refine family — RELION's job windows that carry fn_cont. */
export const CONTINUE_FAMILY_TYPES: ReadonlySet<string> = new Set([
  "class2d",
  "class3d",
  "refine3d",
  "initialmodel",
  "multibody",
]);

export interface ContinueRoundEntry {
  iteration: number;
  /** run_itNNN_optimiser.star */
  name: string;
  /** Absolute path in the coordinate system of the run that wrote the
   * round (local lane → host path; remote lane → cluster path). */
  path: string;
  size: number;
  /** Every sibling RELION reloads is present — a legal --continue target. */
  complete: boolean;
  /** Missing sibling names (the disabled reason, first few). */
  missing: string[];
  /** The newest COMPLETE round of the source — the suggested default. */
  newest: boolean;
  /** Local mirror only (the remote listing protocol carries no clock). */
  mtimeMs?: number;
}

export interface ContinueSource {
  jobId: string;
  jobName: string;
  jobType: string;
  relation: "self" | "upstream";
  lane: "local" | "remote";
  connectionId?: string;
  workdir: string;
  entries: ContinueRoundEntry[];
  /** Remote listing hit its cap — the rounds shown are a floor, not all. */
  truncated?: boolean;
  /** Honest failure (workdir unreadable, SSH round failed, never ran…). */
  error?: string;
}

/** The optimiser's own naming law (RELION writes run_itNNN_optimiser.star). */
const OPTIMISER_RE = /^run_it(\d+)_optimiser\.star$/i;

/**
 * PURE — analyse a directory's file-name set into round entries,
 * newest-first. Shared by both lanes (the local mirror's readdirSync and
 * the remote listing's find lines) so the completeness law cannot drift
 * between worlds. `names` are ROOT-level names of ONE directory.
 */
export function optimiserRoundsFromNames(
  names: ReadonlySet<string>,
  type: string,
  pathOf: (name: string) => string,
  sizeOf: (name: string) => number,
  mtimeOf?: (name: string) => number | undefined
): ContinueRoundEntry[] {
  const candidates: { it: number; name: string }[] = [];
  for (const name of names) {
    const m = OPTIMISER_RE.exec(name);
    if (m) candidates.push({ it: Number(m[1]), name });
  }
  candidates.sort((a, b) => b.it - a.it);
  let newestSpoken = false;
  return candidates.map(({ it, name }) => {
    const pad = String(it).padStart(3, "0");
    const missing = continueCompanions(type, pad).filter((s) => !names.has(s));
    const complete = missing.length === 0;
    const newest = complete && !newestSpoken;
    if (newest) newestSpoken = true;
    const mtimeMs = mtimeOf?.(name);
    return {
      iteration: it,
      name,
      path: pathOf(name),
      size: sizeOf(name),
      complete,
      missing,
      newest,
      ...(mtimeMs != null ? { mtimeMs } : {}),
    };
  });
}

/**
 * Local lane: read the mirror/run workdir directly (stat gives size+clock).
 * Exported for the bench (the fixture-verified half of the round law).
 */
export function scanLocalWorkdir(
  workdir: string,
  type: string
): { entries: ContinueRoundEntry[]; error?: string } {
  let names: string[];
  try {
    names = readdirSync(workdir);
  } catch {
    return { entries: [], error: "workdir is unreadable (or was wiped) on this machine" };
  }
  const nameSet = new Set(names);
  const entries = optimiserRoundsFromNames(
    nameSet,
    type,
    (n) => path.join(workdir, n),
    (n) => {
      try {
        return statSync(path.join(workdir, n)).size;
      } catch {
        return 0;
      }
    },
    (n) => {
      try {
        return statSync(path.join(workdir, n)).mtimeMs;
      } catch {
        return undefined;
      }
    }
  );
  return { entries };
}

/**
 * Remote lane: ONE SSH round per source — find <workdir> -maxdepth 1
 * -name 'run_it*' (the whole iteration family, so completeness is judged
 * from the same listing; the t385 .cryoflow_prev archive lives one level
 * deeper and never answers). Paths are CLUSTER paths.
 */
async function scanRemoteWorkdir(
  connectionId: string,
  remoteWorkdir: string,
  type: string
): Promise<{ entries: ContinueRoundEntry[]; truncated?: boolean; error?: string }> {
  let res;
  try {
    res = await listRemoteDir(connectionId, remoteWorkdir, "run_it*", { timeoutMs: 20_000 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { entries: [], error: `cluster listing failed: ${msg}` };
  }
  if (res.notDir) {
    return { entries: [], error: "the cluster workdir no longer exists" };
  }
  const nameSet = new Set<string>(res.entries.map((e) => e.name));
  const sizeBy = new Map<string, number>(
    res.entries.map((e): [string, number] => [e.name, e.size ?? 0])
  );
  const root = remoteWorkdir.endsWith("/") && remoteWorkdir.length > 1
    ? remoteWorkdir.slice(0, -1)
    : remoteWorkdir;
  const entries = optimiserRoundsFromNames(
    nameSet,
    type,
    (n) => `${root}/${n}`,
    (n) => sizeBy.get(n) ?? 0
  );
  return { entries, ...(res.truncated ? { truncated: true } : {}) };
}

/** One source row — self or one upstream ancestor, both lanes. */
async function sourceForJob(
  row: { id: string; name: string; type: string },
  relation: "self" | "upstream"
): Promise<ContinueSource> {
  const base = { jobId: row.id, jobName: row.name, jobType: row.type, relation };
  const run = getRun(row.id);
  if (!run) {
    return {
      ...base,
      lane: "local",
      workdir: "",
      entries: [],
      error: "has never run — no checkpoints exist yet",
    };
  }
  if (run.remote) {
    const scanned = await scanRemoteWorkdir(
      run.remote.connectionId,
      run.remote.remoteWorkdir,
      row.type
    );
    return {
      ...base,
      lane: "remote",
      ...(run.remote.connectionId ? { connectionId: run.remote.connectionId } : {}),
      workdir: run.remote.remoteWorkdir,
      entries: scanned.entries,
      ...(scanned.truncated ? { truncated: true } : {}),
      ...(scanned.error ? { error: scanned.error } : {}),
    };
  }
  const scanned = scanLocalWorkdir(run.workdir, row.type);
  return {
    ...base,
    lane: "local",
    workdir: run.workdir,
    entries: scanned.entries,
    ...(scanned.error ? { error: scanned.error } : {}),
  };
}

/** Upstream ancestors worth an SSH round — bounds the picker's cost. */
const MAX_UPSTREAM_SOURCES = 4;

/** 12s TTL — the picker refetches on open; a mid-run reopen stays cheap. */
const TTL_MS = 12_000;
const cache = new Map<string, { at: number; sources: ContinueSource[] }>();

/**
 * The picker's whole data plane: self + refine-family upstream sources,
 * newest round first, every round judged for --continue legality.
 * Never throws; sources carry their own errors. Cached per job for the
 * TTL (refresh=1 on the route bypasses).
 */
export async function continueSourcesFor(
  job: { id: string; name: string; type: string },
  opts: { refresh?: boolean } = {}
): Promise<ContinueSource[]> {
  if (!opts.refresh) {
    const hit = cache.get(job.id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.sources;
  }
  const self = await sourceForJob(job, "self");
  const lineage = await lineageFor(job.id);
  const upstreamRows = lineage
    .filter((u) => CONTINUE_FAMILY_TYPES.has(u.type))
    .slice(0, MAX_UPSTREAM_SOURCES);
  const upstream = await Promise.all(
    upstreamRows.map((u) =>
      sourceForJob(
        { id: u.id, name: u.name ?? u.type, type: u.type },
        "upstream"
      )
    )
  );
  // upstream honesty rule: a source that never ran is graph-visible anyway
  // (an idle card) and would only add noise — but a source that RAN and
  // cannot answer (SSH failure, wiped workdir) stays, error and all, so
  // the picker never silently hides rounds the user knows exist.
  const sources = [
    self,
    ...upstream.filter((s) => s.entries.length > 0 || s.error != null),
  ];
  cache.set(job.id, { at: Date.now(), sources });
  return sources;
}

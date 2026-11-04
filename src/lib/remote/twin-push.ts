/**
 * CryoFlow — the twin-push leg (t1137): the sync door's reverse face.
 *
 * The t424 sync route brings cluster bytes HOME; this lib is the PUSH
 * direction: an app-side native's fresh book (the engine's local lane
 * writes under RELION_DIR) refreshes the CLUSTER twin its world carries.
 * The reason the door exists is the seeder's stale twin — select's
 * `particles_select.star` cluster-side, 96 rows of the t1135 two-dot
 * tilt, with NO living writer targeting it (the select native writes
 * app-side via RELION_DIR; the sync door is bring-home only). A fossil
 * retires through a WRITER — this lib is the writer.
 *
 * The address is the t396 deterministic formula (a fact about the JOB):
 * `remoteWorkdirForJob(remoteRoot, projectId, type, id)` — derivable at
 * ANY later moment with nothing but the job row and the connection. The
 * CONNECTION is a witness question: an app-side native carries no
 * run.remote of its own, so the witness is either an explicit
 * connectionId (the client's own choice) or the project's most recent
 * remote-run sibling (the world's own witness that this data has a
 * cluster home — one readRuns scan, newest startedAt wins).
 *
 * Server-only (fs, ssh, engine state).
 */

import path from "path";
import { existsSync, readFileSync, statSync } from "fs";
import { readRuns } from "@/lib/relion/engine";
import { getConnection } from "@/lib/remote/connections";
import { expandRemotePath } from "@/lib/remote/remote-run";
import { remoteWorkdirForJob } from "@/lib/relion/workdir";
import { remoteUpload } from "@/lib/remote/ssh";
import {
  planPush,
  describePushSkip,
  type PushEntry,
  type PushPolicyContext,
} from "@/lib/remote/push-policy";
import type { RemoteConnection } from "@/lib/remote/types";

/** The witness: the connection a push rides, plus the expanded root the
 * twin formula anchors on. */
export interface PushWitness {
  conn: RemoteConnection;
  /** expanded remote root (no `~` left — the t396 formula's contract). */
  remoteRoot: string;
  /** where the witness came from — the receipt names it (the honest-word law). */
  source: "explicit" | "sibling-run";
}

/**
 * Resolve the push witness for a project. Explicit first (the client's
 * own choice, validated against the saved connections), else the
 * project's most recent remote-run sibling — the world's own witness.
 * Null when neither speaks: an app-only project has no cluster home and
 * the door says so honestly (400, not a silent push into the void).
 */
export function resolvePushWitness(
  projectId: string,
  explicitConnectionId?: string
): PushWitness | null {
  if (explicitConnectionId) {
    const conn = getConnection(explicitConnectionId);
    if (conn) {
      return { conn, remoteRoot: conn.remoteRoot, source: "explicit" };
    }
  }
  // the project's most recent remote-run sibling (newest startedAt wins —
  // the same recency discipline the continue-picker's data plane speaks)
  let best: { connId: string; startedAt: number } | null = null;
  for (const rec of Object.values(readRuns())) {
    if (rec.projectId !== projectId || !rec.remote?.connectionId) continue;
    const startedAt = Date.parse(rec.startedAt ?? "") || 0;
    if (!best || startedAt > best.startedAt) {
      best = { connId: rec.remote.connectionId, startedAt };
    }
  }
  if (!best) return null;
  const conn = getConnection(best.connId);
  if (!conn) return null;
  return { conn, remoteRoot: conn.remoteRoot, source: "sibling-run" };
}

/**
 * The twin workdir for a job — the t396 formula with the root expanded
 * (async: a `~` root asks the cluster's home; an absolute root passes
 * through). One wrapper so the route and the unit cannot drift.
 */
export async function twinWorkdirFor(
  witness: PushWitness,
  projectId: string,
  type: string,
  id: string
): Promise<string> {
  const root = await expandRemotePath(witness.conn, witness.remoteRoot);
  return remoteWorkdirForJob(root, projectId, type, id);
}

/** The policy context a push speaks — the connection's own caps, the
 * sync policy read in reverse (the same field the bring-home planner
 * drinks; ONE knob, two directions). */
export function pushPolicyContext(
  witness: PushWitness,
  remoteWorkdir: string
): PushPolicyContext {
  const c = witness.conn;
  return {
    policy: c.syncPolicy === "everything" ? "everything" : "key-files",
    maxFileMb: c.maxFileMb,
    maxTotalMb: c.maxTotalMb,
    remoteWorkdir,
  };
}

/** The workdir-relative hygiene the route's verdict layer speaks (the
 * planner never sees paths): no leading /, no .. segments. */
export function pushPathRejected(rel: string): string | null {
  if (rel.length === 0 || rel.startsWith("/") || rel.split("/").includes("..")) {
    return "Path rejected — absolute paths and '..' segments are not allowed";
  }
  return null;
}

/** One pushed file's verdict (the t424 row shape, push direction). */
export interface PushRow {
  path: string;
  ok: boolean;
  bytes?: number;
  error?: string;
}

/**
 * Push up to `paths.length` books to the job's cluster twin. Each path:
 * hygiene → exists → size → planner classification → read → remoteUpload.
 * Per-path verdicts, never a silent skip; the budget arithmetic runs per
 * call (the client-driven chunk doctrine — a chunk is ≤ 8 paths).
 */
export async function pushBooksToTwin(opts: {
  witness: PushWitness;
  workdir: string;
  jobType: string;
  jobId: string;
  projectId: string;
  paths: string[];
}): Promise<{ rows: PushRow[]; pushed: number; twinWorkdir: string }> {
  const twinWorkdir = await twinWorkdirFor(
    opts.witness,
    opts.projectId,
    opts.jobType,
    opts.jobId
  );
  const ctx = pushPolicyContext(opts.witness, twinWorkdir);

  // stage one: classify what exists (the planner's budget arithmetic runs
  // over the PRESENT entries, in the caller's order — an absent file is a
  // verdict, not a budget entry)
  const entries: PushEntry[] = [];
  const present = new Map<string, number>();
  for (const rel of opts.paths) {
    const abs = path.join(opts.workdir, rel);
    if (existsSync(abs) && statSync(abs).isFile()) {
      const size = statSync(abs).size;
      present.set(rel, size);
      entries.push({ rel, size });
    }
  }
  const plan = planPush(entries, ctx);
  const takeSet = new Map(plan.take.map((e) => [e.rel, e.size]));
  const skipWords = new Map(plan.skip.map((e) => [e.rel, describePushSkip(e, ctx)]));

  // stage two: the ride — only the take-list touches the wire
  const rows: PushRow[] = [];
  let pushed = 0;
  for (const rel of opts.paths) {
    const reject = pushPathRejected(rel);
    if (reject) {
      rows.push({ path: rel, ok: false, error: reject });
      continue;
    }
    const size = present.get(rel);
    if (size === undefined) {
      rows.push({ path: rel, ok: false, error: "Not present in the local workdir — the push leg moves this job's own books" });
      continue;
    }
    const skipWord = skipWords.get(rel);
    if (skipWord) {
      rows.push({ path: rel, ok: false, error: skipWord });
      continue;
    }
    const size2 = takeSet.get(rel) ?? size;
    try {
      const buf = readFileSync(path.join(opts.workdir, rel));
      const okUpload = await remoteUpload(opts.witness.conn, buf, `${twinWorkdir}/${rel}`);
      if (okUpload) {
        pushed += 1;
        rows.push({ path: rel, ok: true, bytes: size2 });
      } else {
        rows.push({ path: rel, ok: false, error: "Upload failed — the cluster refused or dropped the write" });
      }
    } catch (err) {
      rows.push({
        path: rel,
        ok: false,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }
  return { rows, pushed, twinWorkdir };
}

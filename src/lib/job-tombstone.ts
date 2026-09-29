/**
 * CryoFlow — the delete tombstone (SERVER ONLY), t341 (review C3).
 *
 * DELETE /api/jobs/[id] keeps the WORKDIR on disk so an undo can re-attach
 * it — but the row's run record (outputs, remote twins, lineage) and its
 * EDGES (the DB rows cascade away, the sidecar entries are swept) died with
 * the row. The restore route re-created the row and stopped there: the job
 * came back "completed" with no record, so downstream consumers sat pending
 * on "Waiting for upstream output" until someone re-ran the restored job;
 * and the canvas lost its wires unless the CLIENT still held its pre-delete
 * snapshot (after a page reload the undo stack is gone and the edges were
 * unrecoverable — the E2E proved both holes live).
 *
 * The tombstone closes both holes SERVER-side: DELETE snapshots the run
 * record + every touching edge (sidecar WITH ports, DB rows as plain
 * pairs) next to the surviving workdir; POST /api/jobs/restore re-applies
 * what it finds. Both sides are best-effort (advisory, exactly like the
 * record state file) and idempotent — a second delete overwrites, a second
 * restore finds both endpoints alive and the sidecar upsert no-ops.
 */

import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { DATA_DIR } from "@/lib/paths";
import { getRun, upsertRun, type RunRecord } from "@/lib/relion/engine";
import {
  readFileEdges,
  persistPortEdge,
  type FileEdge,
} from "@/lib/edge-ports";

const TOMBSTONE_DIR = path.join(DATA_DIR, "deleted-jobs");

export interface TombstoneDbEdge {
  projectId: string;
  fromJobId: string;
  toJobId: string;
}

export interface JobTombstone {
  id: string;
  deletedAt: string;
  /** The run record at delete time, coerced TERMINAL — a stopped run must
   *  not come back as live (the same honesty the restore route's
   *  running→idle coercion applies to the row). */
  record: RunRecord | null;
  /** Sidecar (port-aware) edges touching the job. */
  fileEdges: FileEdge[];
  /** Plain DB edges touching the job (port-less; ports re-infer on read,
   *  the legacy-edge path). Only pairs WITHOUT a file-edge twin matter —
   *  persistPortEdge re-mirrors the file twins into the DB itself. */
  dbEdges: TombstoneDbEdge[];
  /** t477 — the DB row's scalar snapshot at delete time. Older graves
   *  (t341-era) carry only the record + edges: their name/params lived in
   *  the client's undo stack and died with the page. A grave WITH a row is
   *  self-sufficient — the agent's restore_deleted can bring it back with
   *  no canvas memory at all; a row-less grave stays honest about what it
   *  cannot do. Optional so old JSON keeps parsing. */
  row?: TombstoneRow | null;
}

/** The DB row's scalars — exactly what restoreJobRows needs to rebuild a
 *  job under its original id (params stays the serialized JSON string; the
 *  restore core re-filters it against the type schema anyway). */
export interface TombstoneRow {
  type: string;
  name: string;
  x: number;
  y: number;
  params: string;
  workspaceId: string | null;
  linkedJobId: string | null;
  status: string;
  progress: number;
  result: string | null;
  note: string | null;
  startedAt: string | null;
  duration: number;
}

export interface RestoredTombstoneEdge {
  fromJobId: string;
  toJobId: string;
  fromPort?: string;
  toPort?: string;
}

function tombstonePath(id: string): string {
  // ids are cuids (charset [a-z0-9]); the sanitize is belt-and-braces so a
  // hostile id can never traverse out of the tombstone dir
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(TOMBSTONE_DIR, `${safe}.json`);
}

/**
 * Snapshot everything a same-id restore needs: the run record (coerced
 * terminal) plus every edge touching the job, both layers. Called by
 * DELETE BEFORE the record is cleared and the cascade lands. Never throws
 * to the caller's world for longer than the two awaits — and the DELETE
 * route wraps it in its own try/catch anyway (advisory, like the record).
 */
export async function writeJobTombstone(id: string): Promise<void> {
  const rec = getRun(id);
  const record: RunRecord | null = rec
    ? rec.done
      ? rec
      : {
          ...rec,
          done: true,
          exitCode: rec.exitCode ?? -1,
          // the row's own restore says idle for a stopped run; the record
          // says the same thing its own way
          result: (rec.result ?? "the run was stopped when the job was deleted").slice(0, 900),
        }
    : null;
  const fileEdges = readFileEdges().filter(
    (e) => e.fromJobId === id || e.toJobId === id
  );
  const dbEdges = await db.edge.findMany({
    where: { OR: [{ fromJobId: id }, { toJobId: id }] },
    select: { projectId: true, fromJobId: true, toJobId: true },
  });
  // t477 — snapshot the row itself: a grave that remembers its name, its
  // params and its home is one the agent can restore without the canvas's
  // undo stack. Scalar pick by hand (no spread of the Prisma row — the
  // tombstone's contract stays explicit and forward-safe).
  const dbRow = await db.job.findUnique({ where: { id } });
  const row: TombstoneRow | null = dbRow
    ? {
        type: dbRow.type,
        name: dbRow.name,
        x: dbRow.x,
        y: dbRow.y,
        params: dbRow.params,
        workspaceId: dbRow.workspaceId,
        linkedJobId: dbRow.linkedJobId,
        status: dbRow.status,
        progress: dbRow.progress,
        result: dbRow.result,
        note: dbRow.note,
        startedAt: dbRow.startedAt ? dbRow.startedAt.toISOString() : null,
        duration: dbRow.duration,
      }
    : null;
  const tomb: JobTombstone = {
    id,
    deletedAt: new Date().toISOString(),
    record,
    fileEdges,
    dbEdges: dbEdges.map((e) => ({
      projectId: e.projectId,
      fromJobId: e.fromJobId,
      toJobId: e.toJobId,
    })),
    row,
  };
  mkdirSync(TOMBSTONE_DIR, { recursive: true });
  const file = tombstonePath(id);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(tomb, null, 2));
  try {
    renameSync(tmp, file);
  } catch {
    // cross-platform rename-over-existing fallback (the edge sidecar's
    // t325 pattern)
    writeFileSync(file, JSON.stringify(tomb, null, 2));
  }
}

/** Read a job's tombstone (null = none ever written / unreadable). */
export function readJobTombstone(id: string): JobTombstone | null {
  try {
    const parsed = JSON.parse(readFileSync(tombstonePath(id), "utf8")) as JobTombstone;
    if (!parsed || typeof parsed !== "object" || parsed.id !== id) return null;
    if (!Array.isArray(parsed.fileEdges)) parsed.fileEdges = [];
    if (!Array.isArray(parsed.dbEdges)) parsed.dbEdges = [];
    return parsed;
  } catch {
    // ENOENT (never deleted, or already applied-and-consumed by hand) or
    // corrupt — both mean "no tombstone", never a blocked restore
    return null;
  }
}

/**
 * t477 — the graveyard's roll call: every tombstone on disk, newest first.
 * A corrupt file is skipped, never invented into a row (the roster only
 * points at graves that are actually there). The list is unbounded by
 * design — deletions are rare and the graves are small.
 */
export function listJobTombstones(): JobTombstone[] {
  let names: string[] = [];
  try {
    names = readdirSync(TOMBSTONE_DIR).filter((n) => n.endsWith(".json"));
  } catch {
    return []; // no graveyard yet — a true answer, not an error
  }
  const graves: JobTombstone[] = [];
  for (const name of names) {
    try {
      const parsed = JSON.parse(readFileSync(path.join(TOMBSTONE_DIR, name), "utf8")) as JobTombstone;
      if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
        if (!Array.isArray(parsed.fileEdges)) parsed.fileEdges = [];
        if (!Array.isArray(parsed.dbEdges)) parsed.dbEdges = [];
        graves.push(parsed);
      }
    } catch {
      /* one corrupt grave never blocks the roll call */
    }
  }
  graves.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : a.deletedAt > b.deletedAt ? -1 : 0));
  return graves;
}

/** The roll call's row grammar (t478): id/type/name/deletedAt/run summary/
 *  edges count/restorable + why. ONE brain for BOTH faces — the agent's
 *  list_deleted tool and the storage dialog's graveyard drawer read the
 *  same rows, so a grave announced restorable is restorable everywhere.
 *  The rows only PRE-PLAY restoreJobRows' own refusal reasons: the spoken
 *  line never promises a restore the core would refuse. */
export interface GraveRow {
  id: string;
  type: string;
  name?: string;
  deletedAt: string;
  rowSnapshot: boolean;
  run: {
    done: boolean;
    exitCode: number | null;
    result?: string;
  } | null;
  edges: number;
  restorable: boolean;
  why?: string;
}

export async function graveRowsOf(): Promise<GraveRow[]> {
  const graves = listJobTombstones();
  return Promise.all(
    graves.map(async (g) => {
      const rec = g.record;
      // restoreJobRows refuses an occupied id — the roll call pre-computes
      // the same truth so no face ever promises a blocked restore
      const occupied = !!(await db.job.findUnique({ where: { id: g.id }, select: { id: true } }));
      const name = g.row?.name ?? null;
      const type = g.row?.type ?? rec?.type ?? "unknown";
      return {
        id: g.id,
        type,
        ...(name ? { name } : {}),
        deletedAt: g.deletedAt,
        rowSnapshot: g.row ? true : false,
        run: rec
          ? {
              done: rec.done,
              exitCode: rec.exitCode,
              ...(rec.result ? { result: rec.result.slice(0, 120) } : {}),
            }
          : null,
        edges: g.fileEdges.length + g.dbEdges.length,
        restorable: g.row ? !occupied : false,
        ...(g.row && occupied
          ? { why: "a job with this id already exists — already restored or re-created" }
          : {}),
        ...(!g.row
          ? {
              why: "no row snapshot in this old grave — restore it from the canvas's undo while the session remembers, or recreate it",
            }
          : {}),
      };
    }),
  );
}

/**
 * Re-apply a job's tombstone after its row came back: the run record (only
 * when the slot is free — a re-run between delete and restore owns the
 * slot and its record WINS) and every edge whose BOTH endpoints are alive
 * (the tombstone never resurrects a job that is not back on the canvas).
 * Idempotent: the sidecar upserts by id, the DB creates are guarded by the
 * unique (from,to) pair, the record only fills an empty slot.
 */
export async function applyJobTombstone(id: string): Promise<{
  recordRestored: boolean;
  edgesRestored: RestoredTombstoneEdge[];
}> {
  const tomb = readJobTombstone(id);
  if (!tomb) return { recordRestored: false, edgesRestored: [] };
  const out: { recordRestored: boolean; edgesRestored: RestoredTombstoneEdge[] } = {
    recordRestored: false,
    edgesRestored: [],
  };

  // 1) the run record — the outputs map is what downstream resolveInputs
  //    reads; without it a restored "completed" job starves its consumers
  //    ("Waiting for upstream output") until someone re-runs it
  if (tomb.record && !getRun(id)) {
    upsertRun(id, tomb.record);
    out.recordRestored = true;
  }

  // 2) the edges — both endpoints alive, else the wire pointed at a job
  //    that is NOT back (its own delete removed it; nothing to wire)
  const alive = async (jid: string): Promise<boolean> => {
    const row = await db.job.findUnique({ where: { id: jid }, select: { id: true } });
    return !!row;
  };

  const filePairs = new Set(
    tomb.fileEdges.map((e) => `${e.fromJobId}->${e.toJobId}`)
  );
  for (const fe of tomb.fileEdges) {
    if (!(await alive(fe.fromJobId)) || !(await alive(fe.toJobId))) continue;
    try {
      await persistPortEdge(fe); // sidecar upsert by id + guarded DB mirror
      out.edgesRestored.push({
        fromJobId: fe.fromJobId,
        toJobId: fe.toJobId,
        ...(fe.fromPort ? { fromPort: fe.fromPort } : {}),
        ...(fe.toPort ? { toPort: fe.toPort } : {}),
      });
    } catch {
      /* one bad wire never aborts the batch — the restore route reports
         the rest honestly */
    }
  }
  for (const e of tomb.dbEdges) {
    // persistPortEdge above already re-mirrored the file twins; only the
    // port-less legacy rows need their own create
    if (filePairs.has(`${e.fromJobId}->${e.toJobId}`)) continue;
    if (!(await alive(e.fromJobId)) || !(await alive(e.toJobId))) continue;
    try {
      const existing = await db.edge.findUnique({
        where: {
          fromJobId_toJobId: { fromJobId: e.fromJobId, toJobId: e.toJobId },
        },
      });
      if (existing) continue;
      await db.edge.create({
        data: {
          projectId: e.projectId,
          fromJobId: e.fromJobId,
          toJobId: e.toJobId,
        },
      });
      out.edgesRestored.push({ fromJobId: e.fromJobId, toJobId: e.toJobId });
    } catch {
      /* unique race (someone else created it) or a project cascade — the
         GET merge still renders whatever survived */
    }
  }

  return out;
}

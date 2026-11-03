/**
 * CryoFlow — edge port sidecar (SERVER ONLY).
 *
 * The Prisma schema is frozen (Edge has from/to job ids only), so port-aware
 * edges live in data/edge-ports.json and are MIRRORED into the DB whenever
 * the unique (fromJobId, toJobId) constraint allows it. The DB mirror keeps
 * the RELION engine's upstream resolution working (it queries db.edge),
 * while the sidecar carries the port semantics for the UI.
 *
 * GET semantics: DB edges + file edges merged; for any (from,to) pair that
 * has file edges, the file edges supersede the legacy DB row (dedup).
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync, copyFileSync, rmSync } from "fs";
import path from "path";
import type { Edge, Job } from "@prisma/client";
import { db } from "@/lib/db";
import { DATA_DIR } from "@/lib/paths";
import { defaultPorts, jobType } from "@/lib/workflow";
import type { EdgeDTO } from "@/lib/types";

const FILE = path.join(DATA_DIR, "edge-ports.json");

export interface FileEdge {
  id: string;
  projectId: string;
  fromJobId: string;
  toJobId: string;
  fromPort?: string;
  toPort?: string;
  createdAt: string;
}

interface PortFile {
  edges: FileEdge[];
}

function readPortFile(): PortFile {
  try {
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as PortFile;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.edges)) {
      return parsed;
    }
  } catch {
    // ENOENT / corrupt → fresh state
  }
  return { edges: [] };
}

/**
 * t325 — ATOMIC sidecar writes: the JSON lands through a tmp file + rename,
 * so a reader (or a second server instance sharing DATA_DIR) can never see
 * a half-written edge-ports.json. The old direct writeFileSync let a
 * cross-process reader parse a torn file → edges: [] → every sidecar wire
 * vanished for that response — the "the wire sometimes disappears" field
 * receipt. In-process reads are already safe (all mutations are sync,
 * single-tick read-modify-write), this closes the cross-process half.
 * t325-a (L1) — the tmp file is reaped on EVERY exit path (a consumed
 * rename, a failed write, the copy fallback): ENOSPC mid-write or a
 * rename-then-copy double failure no longer litters data/ with debris.
 */
function writePortFile(file: PortFile): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmp, JSON.stringify(file, null, 2));
    try {
      renameSync(tmp, FILE);
    } catch {
      // cross-platform rename-over-existing fallback (kept best-effort —
      // the direct write preserves the pre-t325 behavior on failure)
      try {
        copyFileSync(tmp, FILE);
      } catch {
        writeFileSync(FILE, JSON.stringify(file, null, 2));
      }
    }
  } finally {
    rmSync(tmp, { force: true }); // consumed by rename → no-op; debris never survives
  }
}

export function readFileEdges(): FileEdge[] {
  return readPortFile().edges;
}

export function upsertFileEdge(edge: FileEdge): void {
  const file = readPortFile();
  const idx = file.edges.findIndex((e) => e.id === edge.id);
  if (idx >= 0) file.edges[idx] = edge;
  else file.edges.push(edge);
  writePortFile(file);
}

export function removeFileEdge(id: string): void {
  const file = readPortFile();
  file.edges = file.edges.filter((e) => e.id !== id);
  writePortFile(file);
}

/**
 * Drop every file-layer edge that references `jobId` on either end.
 * Called when a job is deleted — the DB cascade handles the DB rows, but
 * the sidecar file has no FK constraint and would otherwise keep orphaned
 * edges forever (they resurface in GET /api/edges with dead endpoints).
 */
export function removeFileEdgesTouching(jobId: string): number {
  const file = readPortFile();
  const before = file.edges.length;
  file.edges = file.edges.filter((e) => e.fromJobId !== jobId && e.toJobId !== jobId);
  const removed = before - file.edges.length;
  if (removed > 0) writePortFile(file);
  return removed;
}

/** Infer ports for a legacy DB edge from the job types. */
function inferPorts(fromType: string, toType: string): { fromPort?: string; toPort?: string } {
  return defaultPorts(fromType, toType);
}

/**
 * Full edge list for a project: DB rows (ports inferred when absent) merged
 * with file edges; file edges supersede legacy rows of the same (from,to).
 */
export async function edgesWithPorts(projectId: string): Promise<EdgeDTO[]> {
  const [dbEdges, fileEdges] = await Promise.all([
    db.edge.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    readFileEdges().filter((e) => e.projectId === projectId),
  ]);
  const jobs = await db.job.findMany({
    where: { projectId },
    select: { id: true, type: true },
  });
  const typeOf = new Map(jobs.map((j) => [j.id, j.type] as const));

  // self-heal: drop file edges whose endpoint jobs no longer exist
  // (deleting a job used to leave these as orphans in the sidecar)
  //
  // t325 — LOST-UPDATE FIX: the keep-set is derived from a FRESH read, not
  // from the stale snapshot taken before the awaited DB queries. The old
  // shape filtered the fresh file through `keepIds` computed over the
  // STALE list — an edge CONNECTED while this GET was awaiting its DB rows
  // failed both filter arms (its id ∉ keepIds, its projectId === this
  // project) and was EVICTED: the wire's sidecar entry vanished while its
  // DB mirror might have failed too (SQLite busy → the swallowed catch in
  // persistPortEdge) — leaving the pair connected NOWHERE: the canvas wire
  // gone and the engine's lineage EMPTY (a permanently pending consumer
  // over a lost-looking edge). The fresh filter only ever removes THIS
  // project's dead-endpoint edges — concurrent additions always survive.
  const liveEdges = fileEdges.filter(
    (e) => typeOf.has(e.fromJobId) && typeOf.has(e.toJobId)
  );
  if (liveEdges.length !== fileEdges.length) {
    const fresh = readPortFile();
    const before = fresh.edges.length;
    fresh.edges = fresh.edges.filter(
      (e) =>
        e.projectId !== projectId ||
        (typeOf.has(e.fromJobId) && typeOf.has(e.toJobId))
    );
    if (fresh.edges.length !== before) writePortFile(fresh);
  }

  // t325 — MIRROR BACKFILL: the DB row is the ENGINE's only view of an
  // edge (lineageFor + the pending-retry sweep query db.edge); the sidecar
  // entry alone draws the wire on the canvas. A mirror lost to a failed
  // create (the swallowed catch below) used to leave the pair VISIBLE but
  // dispatch-dead — the consumer's lineage came back empty and the pending
  // message lied ("runs automatically once ready" over a job with no
  // upstream). Every read now repairs the mirror before answering, so the
  // engine's view can never silently diverge from the canvas.
  const dbPairs = new Set(dbEdges.map((e) => `${e.fromJobId}→${e.toJobId}`));
  const unmirrored = liveEdges.filter((e) => !dbPairs.has(`${e.fromJobId}→${e.toJobId}`));
  for (const e of unmirrored) {
    try {
      await db.edge.create({
        data: {
          id: e.id,
          projectId: e.projectId,
          fromJobId: e.fromJobId,
          toJobId: e.toJobId,
        },
      });
      console.log(
        `edge-ports: backfilled the DB mirror for ${e.fromJobId}→${e.toJobId} (the sidecar edge had no engine row — t325 heal)`
      );
    } catch (err) {
      // t325-a (L2) — best-effort, but SPOKEN: a permanently failing create
      // (schema drift, a constraint) must not retry silently on every read
      // forever — the same honesty persistPortEdge learned in t325.
      console.warn(
        `edge-ports: DB mirror backfill failed for ${e.fromJobId}→${e.toJobId} (will retry on next read):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const fileByPair = new Set(liveEdges.map((e) => `${e.fromJobId}→${e.toJobId}`));
  const byId = new Map<string, FileEdge>(liveEdges.map((e) => [e.id, e]));

  const out: EdgeDTO[] = [];
  for (const e of dbEdges as Edge[]) {
    const pair = `${e.fromJobId}→${e.toJobId}`;
    if (fileByPair.has(pair)) continue; // superseded by port-aware edges
    const fileEdge = byId.get(e.id);
    if (fileEdge) {
      out.push({
        id: e.id,
        fromJobId: e.fromJobId,
        toJobId: e.toJobId,
        fromPort: fileEdge.fromPort,
        toPort: fileEdge.toPort,
      });
      byId.delete(e.id);
      continue;
    }
    const inferred = inferPorts(typeOf.get(e.fromJobId) ?? "", typeOf.get(e.toJobId) ?? "");
    out.push({
      id: e.id,
      fromJobId: e.fromJobId,
      toJobId: e.toJobId,
      fromPort: inferred.fromPort,
      toPort: inferred.toPort,
    });
  }
  for (const e of byId.values()) {
    out.push({
      id: e.id,
      fromJobId: e.fromJobId,
      toJobId: e.toJobId,
      fromPort: e.fromPort,
      toPort: e.toPort,
    });
  }
  return out;
}

/**
 * Persist a port-aware edge: file entry + best-effort DB mirror.
 * The mirror is skipped when the pair already exists in the DB (unique
 * constraint) — the engine still sees the pair through the existing row.
 */
export async function persistPortEdge(
  edge: FileEdge
): Promise<{ dbMirrored: boolean }> {
  upsertFileEdge(edge);
  try {
    const existing = await db.edge.findUnique({
      where: { fromJobId_toJobId: { fromJobId: edge.fromJobId, toJobId: edge.toJobId } },
    });
    if (existing) return { dbMirrored: false };
    await db.edge.create({
      data: {
        id: edge.id,
        projectId: edge.projectId,
        fromJobId: edge.fromJobId,
        toJobId: edge.toJobId,
      },
    });
    return { dbMirrored: true };
  } catch (err) {
    // t325 — the silent swallow is the bug's other half: a mirror that
    // failed to create left the engine blind to a wire the canvas drew.
    // Say it out loud — and the next GET /api/edges backfills the row
    // (see edgesWithPorts) so the divergence is transient, not permanent.
    console.warn(
      `edge-ports: DB mirror create failed for ${edge.fromJobId}→${edge.toJobId} (the sidecar edge renders; the engine backfills on next read):`,
      err instanceof Error ? err.message : err
    );
    return { dbMirrored: false };
  }
}

/** Delete an edge everywhere it might live (DB + sidecar). */
export async function deleteEdgeEverywhere(id: string): Promise<boolean> {
  let touched = existsSync(FILE);
  removeFileEdge(id);
  const dbEdge = await db.edge.findUnique({ where: { id } });
  if (dbEdge) {
    await db.edge.delete({ where: { id } });
    touched = true;
  }
  return touched;
}

/**
 * Adjacency (from → [to]) over DB + file edges — used for cycle checks.
 */
export async function allAdjacency(): Promise<Map<string, string[]>> {
  const [dbEdges, fileEdges] = await Promise.all([
    db.edge.findMany({ select: { fromJobId: true, toJobId: true } }),
    readFileEdges(),
  ]);
  const adj = new Map<string, string[]>();
  const add = (from: string, to: string) => {
    const list = adj.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    adj.set(from, list);
  };
  for (const e of dbEdges) add(e.fromJobId, e.toJobId);
  for (const e of fileEdges) add(e.fromJobId, e.toJobId);
  return adj;
}

/** Validate that a named port pair is compatible (server-side guard). */
export function portsValid(
  fromType: string,
  fromPort: string | undefined,
  toType: string,
  toPort: string | undefined
): boolean {
  const from = jobType(fromType);
  const to = jobType(toType);
  if (!from || !to) return false;
  if (!fromPort || !toPort) return true; // defaults are chosen downstream
  const o = from.outputs.find((p) => p.name === fromPort);
  const i = to.inputs.find((p) => p.name === toPort);
  if (!o || !i) return false;
  const accepts = i.accepts ?? ["*"];
  return accepts.includes("*") || (o.kind != null && accepts.includes(o.kind));
}

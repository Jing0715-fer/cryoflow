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

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import type { Edge, Job } from "@prisma/client";
import { db } from "@/lib/db";
import { defaultPorts, jobType } from "@/lib/workflow";
import type { EdgeDTO } from "@/lib/types";

const DATA_DIR = "/home/z/my-project/data";
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

function writePortFile(file: PortFile): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(file, null, 2));
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

  const fileByPair = new Set(fileEdges.map((e) => `${e.fromJobId}→${e.toJobId}`));
  const byId = new Map<string, FileEdge>(fileEdges.map((e) => [e.id, e]));

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
  } catch {
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

/**
 * CryoFlow — template-apply connection suggestions (Task 129).
 *
 * An applied template lands as a wired island BELOW the workspace's
 * content — its own wires came along, but nothing links it to its new
 * neighbors. The user's next manual step is almost always drawing the
 * upstream wire by hand. This engine proposes those wires:
 *
 *   - boundary inputs: applied nodes' input ports with NO incoming wire
 *   - donor outputs: same-workspace NON-applied nodes' output ports with
 *     NO outgoing wire (we never steal a port that already feeds
 *     something)
 *   - match: portsCompatible(donor, boundary) — the same predicate the
 *     manual wire drag enforces
 *   - pairing: nearest donor wins (canvas distance), one wire per donor
 *     output; capped at MAX_SUGGESTIONS
 *
 * The engine is PURE and client-safe (workflow.ts only) — the store
 * computes suggestions right after an apply lands, and the chip's
 * Connect button POSTs through the same /api/edges endpoint a manual
 * drag uses, so the server re-validates every pair authoritatively.
 */

import type { EdgeDTO, JobDTO } from "./types";
import { jobType, portsCompatible } from "./workflow";

export const MAX_SUGGESTIONS = 4;

export interface TemplateSuggestion {
  fromJobId: string;
  toJobId: string;
  fromPort: string;
  toPort: string;
  /** display names captured at SUGGESTION time — rows may rename later */
  fromName: string;
  toName: string;
  /** canvas distance between the two nodes (pairing quality signal) */
  distance: number;
}

export function suggestTemplateConnections(
  appliedIds: string[],
  jobs: JobDTO[],
  edges: EdgeDTO[]
): TemplateSuggestion[] {
  if (appliedIds.length === 0) return [];
  const applied = new Set(appliedIds);
  const appliedNodes = jobs.filter((j) => applied.has(j.id));
  if (appliedNodes.length === 0) return [];

  // the apply lands in ONE workspace — suggestions only reach nodes the
  // canvas actually renders there ("画布只渲染活跃工作区")
  const ws = appliedNodes[0].workspaceId ?? "";
  const neighbors = jobs.filter((j) => !applied.has(j.id) && (j.workspaceId ?? "") === ws);
  if (neighbors.length === 0) return [];

  // donors: free OUTPUT ports of non-applied same-workspace nodes
  const wiredFrom = new Set(edges.map((e) => `${e.fromJobId}:${e.fromPort ?? ""}`));
  const donors: { job: JobDTO; port: string }[] = [];
  for (const n of neighbors) {
    for (const o of jobType(n.type)?.outputs ?? []) {
      if (!wiredFrom.has(`${n.id}:${o.name}`)) donors.push({ job: n, port: o.name });
    }
  }
  if (donors.length === 0) return [];

  // boundary inputs: unwired INPUT ports of the applied nodes, walked in
  // layout order (leftmost/topmost first) so the pipeline's head gets
  // first pick of the donors
  const wiredTo = new Set(edges.map((e) => `${e.toJobId}:${e.toPort ?? ""}`));
  const inputs: { job: JobDTO; port: string }[] = [];
  for (const j of [...appliedNodes].sort((a, b) => a.x - b.x || a.y - b.y)) {
    for (const i of jobType(j.type)?.inputs ?? []) {
      if (!wiredTo.has(`${j.id}:${i.name}`)) inputs.push({ job: j, port: i.name });
    }
  }
  if (inputs.length === 0) return [];

  const usedDonors = new Set<string>(); // one wire per donor output
  const suggestions: TemplateSuggestion[] = [];
  for (const target of inputs) {
    let best: { donor: (typeof donors)[number]; d: number } | null = null;
    for (const donor of donors) {
      if (usedDonors.has(`${donor.job.id}:${donor.port}`)) continue;
      if (!portsCompatible(donor.job.type, donor.port, target.job.type, target.port)) continue;
      const d =
        (donor.job.x - target.job.x) ** 2 + (donor.job.y - target.job.y) ** 2;
      if (!best || d < best.d) best = { donor, d };
    }
    if (!best) continue;
    usedDonors.add(`${best.donor.job.id}:${best.donor.port}`);
    suggestions.push({
      fromJobId: best.donor.job.id,
      toJobId: target.job.id,
      fromPort: best.donor.port,
      toPort: target.port,
      fromName: best.donor.job.name,
      toName: target.job.name,
      distance: Math.round(Math.sqrt(best.d)),
    });
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }
  return suggestions;
}

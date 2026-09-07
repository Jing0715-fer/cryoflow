/**
 * CryoFlow — workflow export/import (.json) — the portable counterpart to
 * the PNG poster export and the built-in SPA template.
 *
 * FORMAT (cryoflow-workflow/1): a workspace-scoped snapshot of the GRAPH —
 * job type/name/canvas position/params + port-validated edges. Run state
 * (status/progress/results) is deliberately EXCLUDED: an imported workflow
 * lands idle, exactly like the SPA template scaffold. Edges reference jobs
 * by INDEX (stable within the file — names are display-only and may be
 * renamed on import when they collide).
 *
 * The client builds + validates the file for instant feedback; the server
 * (POST /api/workflow-import) re-validates EVERYTHING authoritatively —
 * types against the catalog, params against the spec schema, edges through
 * portsValid — and creates the graph in one all-or-nothing transaction.
 */

import type { EdgeDTO, JobDTO, ParamValue } from "./types";
import { jobType } from "./workflow";

export const WORKFLOW_FORMAT = "cryoflow-workflow";
export const WORKFLOW_VERSION = 1;

export interface WorkflowFileJob {
  type: string;
  name: string;
  x: number;
  y: number;
  params: Record<string, ParamValue>;
}

export interface WorkflowFile {
  format: string;
  version: number;
  exportedAt: string;
  /** informational — where it came from (not enforced on import) */
  project: string;
  workspace: string;
  jobs: WorkflowFileJob[];
  /** from/to are indexes into `jobs` */
  edges: { from: number; to: number; fromPort: string; toPort: string }[];
}

const SCALARS = new Set(["number", "string", "boolean"]);

/** Clone only the spec-visible scalar params (defense against odd values). */
function cleanParams(params: Record<string, ParamValue>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [k, v] of Object.entries(params)) {
    if (SCALARS.has(typeof v)) out[k] = v;
  }
  return out;
}

/**
 * Build a workflow file from the ACTIVE WORKSPACE graph (same render rule
 * as the canvas: edges kept when BOTH endpoints are visible). Empty graph
 * → null (caller toasts honestly).
 */
export function buildWorkflowFile(
  jobs: JobDTO[],
  edges: EdgeDTO[],
  project: string,
  workspace: string
): WorkflowFile | null {
  if (jobs.length === 0) return null;
  const index = new Map(jobs.map((j, i) => [j.id, i]));
  const fileJobs: WorkflowFileJob[] = jobs.map((j) => ({
    type: j.type,
    name: j.name,
    x: Math.round(j.x),
    y: Math.round(j.y),
    params: cleanParams(j.params ?? {}),
  }));
  const fileEdges: WorkflowFile["edges"] = [];
  for (const e of edges) {
    const from = index.get(e.fromJobId);
    const to = index.get(e.toJobId);
    if (from == null || to == null) continue; // cross-workspace or stale
    if (!e.fromPort || !e.toPort) continue; // legacy untyped edge — not portable
    fileEdges.push({ from, to, fromPort: e.fromPort, toPort: e.toPort });
  }
  return {
    format: WORKFLOW_FORMAT,
    version: WORKFLOW_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    workspace,
    jobs: fileJobs,
    edges: fileEdges,
  };
}

export interface ParsedImport {
  ok: boolean;
  error?: string;
  file?: WorkflowFile;
}

/**
 * Client-side pre-validation with LOUD, specific errors — the server
 * re-validates everything (it must not trust this parser), but failing
 * here gives instant feedback without a round-trip.
 */
export function parseWorkflowJson(text: string): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not valid JSON — is this a CryoFlow workflow file?" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Unexpected file shape (expected an object)" };
  }
  const r = raw as Record<string, unknown>;
  if (r.format !== WORKFLOW_FORMAT || r.version !== WORKFLOW_VERSION) {
    return { ok: false, error: `Unrecognized format — expected ${WORKFLOW_FORMAT}/v${WORKFLOW_VERSION}` };
  }
  if (!Array.isArray(r.jobs) || r.jobs.length === 0) {
    return { ok: false, error: "The file contains no jobs" };
  }
  if (r.jobs.length > 500) {
    return { ok: false, error: "Too many jobs (max 500 per workflow file)" };
  }
  const jobs: WorkflowFileJob[] = [];
  for (let i = 0; i < r.jobs.length; i++) {
    const j = r.jobs[i] as Record<string, unknown>;
    const type = typeof j.type === "string" ? j.type : "";
    if (!jobType(type)) {
      return { ok: false, error: `Job #${i + 1}: unknown type "${type}" (file from a different CryoFlow version?)` };
    }
    const x = typeof j.x === "number" && Number.isFinite(j.x) ? j.x : null;
    const y = typeof j.y === "number" && Number.isFinite(j.y) ? j.y : null;
    if (x == null || y == null) {
      return { ok: false, error: `Job #${i + 1} (${j.name ?? type}): bad canvas position` };
    }
    const params: Record<string, ParamValue> = {};
    if (j.params && typeof j.params === "object" && !Array.isArray(j.params)) {
      for (const [k, v] of Object.entries(j.params as Record<string, unknown>)) {
        if (SCALARS.has(typeof v)) params[k] = v as ParamValue;
      }
    }
    jobs.push({
      type,
      name: typeof j.name === "string" && j.name.trim() ? j.name.trim().slice(0, 120) : "",
      x,
      y,
      params,
    });
  }
  const edges: WorkflowFile["edges"] = [];
  if (Array.isArray(r.edges)) {
    for (let i = 0; i < r.edges.length; i++) {
      const e = r.edges[i] as Record<string, unknown>;
      const from = typeof e.from === "number" ? Math.round(e.from) : -1;
      const to = typeof e.to === "number" ? Math.round(e.to) : -1;
      if (from < 0 || from >= jobs.length || to < 0 || to >= jobs.length) {
        return { ok: false, error: `Link #${i + 1}: endpoint out of range` };
      }
      if (from === to) {
        return { ok: false, error: `Link #${i + 1}: a job cannot link to itself` };
      }
      const fromPort = typeof e.fromPort === "string" ? e.fromPort : "";
      const toPort = typeof e.toPort === "string" ? e.toPort : "";
      // ports exist in the two specs? (server enforces compatibility too)
      const fromSpec = jobType(jobs[from].type);
      const toSpec = jobType(jobs[to].type);
      if (!fromSpec?.outputs.some((p) => p.name === fromPort)) {
        return { ok: false, error: `Link #${i + 1}: "${fromPort}" is not an output of ${fromSpec?.label ?? jobs[from].type}` };
      }
      if (!toSpec?.inputs.some((p) => p.name === toPort)) {
        return { ok: false, error: `Link #${i + 1}: "${toPort}" is not an input of ${toSpec?.label ?? jobs[to].type}` };
      }
      edges.push({ from, to, fromPort, toPort });
    }
  }
  return {
    ok: true,
    file: {
      format: WORKFLOW_FORMAT,
      version: WORKFLOW_VERSION,
      exportedAt: typeof r.exportedAt === "string" ? r.exportedAt : "",
      project: typeof r.project === "string" ? r.project : "",
      workspace: typeof r.workspace === "string" ? r.workspace : "",
      jobs,
      edges,
    },
  };
}

export function workflowFileName(workspace: string): string {
  const slug =
    workspace
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `cryoflow-workflow-${slug}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/** Serialize + trigger the browser download. */
export function downloadWorkflowJson(file: WorkflowFile, fileName: string): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

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
import { JOB_TYPES, jobType } from "./workflow";

export const WORKFLOW_FORMAT = "cryoflow-workflow";
export const WORKFLOW_VERSION = 1;

/**
 * Forward/backward compatibility layer.
 *
 * Job-type ids are code identifiers — they occasionally get renamed between
 * CryoFlow versions (and files travel across versions: exported on v1,
 * imported on v2). The alias table maps every historical/legacy spelling to
 * the canonical id; normalizeTypeId() additionally tolerates cosmetic drift
 * (case, dashes, underscores) so "Class2D", "class-2d" and "classify_2d"
 * all land on "class2d".
 *
 * The map is intentionally small and evidence-based — RELION-style names
 * we have actually used or shipped in older catalogs — not speculative.
 */
export const TYPE_ALIASES: Record<string, string> = {
  // pre-catalog RELION-legacy spellings
  classify_2d: "class2d",
  classify_3d: "class3d",
  auto_pick: "autopick",
  auto_pick_v2: "autopick",
  ctf_find: "ctffind",
  ctffind4: "ctffind",
  motion_cor: "motioncorr",
  motioncor2: "motioncorr",
  motion_correction: "motioncorr",
  initial_model: "initialmodel",
  refine_3d: "refine3d",
  mask_create: "maskcreate",
  post_process: "postprocess",
  // renamed types
  import_movies: "import",
  importmovies: "import",
};

/** Alias keys normalized (underscores/case stripped) — lookup matches the way ids are normalized. */
const ALIAS_LOOKUP = new Map(
  Object.entries(TYPE_ALIASES).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), v])
);

/**
 * Normalize a job-type id from a foreign file: exact catalog hit first,
 * then cosmetic drift (trim/lowercase/strip non-alnum → "Class2D" and
 * "class-2d" both land on "class2d"), then the legacy alias table.
 * Returns the canonical id, or null when unrecognizable under any known
 * spelling.
 */
export function normalizeTypeId(rawId: string): string | null {
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) return null;
  if (jobType(id)) return id;
  const norm = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!norm) return null;
  if (jobType(norm)) return norm;
  const aliased = ALIAS_LOOKUP.get(norm);
  if (aliased && jobType(aliased)) return aliased;
  return null;
}

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
  /** non-fatal notice (e.g. "file from a newer CryoFlow") — surfaced in the import toast */
  warning?: string;
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
  if (r.format !== WORKFLOW_FORMAT) {
    return { ok: false, error: `Unrecognized format — expected ${WORKFLOW_FORMAT}` };
  }
  // version tolerance: any integer ≥ 1 parses — the per-job/per-edge
  // validation below is the real gate. A NEWER file still imports (unknown
  // extra fields are dropped, renamed types map through TYPE_ALIASES);
  // the caller surfaces a warning so users know provenance may be lossy.
  const version = typeof r.version === "number" && Number.isInteger(r.version) ? r.version : 0;
  if (version < 1) {
    return { ok: false, error: `Missing or invalid version field — expected an integer ≥ 1 (${WORKFLOW_FORMAT}/v${WORKFLOW_VERSION})` };
  }
  const warning =
    version > WORKFLOW_VERSION
      ? `File was exported by a newer CryoFlow (v${version} — this app reads v${WORKFLOW_VERSION}); imported best-effort and extra fields are dropped`
      : version < WORKFLOW_VERSION
        ? `File from an older CryoFlow (v${version}) — migrated to v${WORKFLOW_VERSION} on import`
        : undefined;
  if (!Array.isArray(r.jobs) || r.jobs.length === 0) {
    return { ok: false, error: "The file contains no jobs" };
  }
  if (r.jobs.length > 500) {
    return { ok: false, error: "Too many jobs (max 500 per workflow file)" };
  }
  const jobs: WorkflowFileJob[] = [];
  for (let i = 0; i < r.jobs.length; i++) {
    const j = r.jobs[i] as Record<string, unknown>;
    const rawType = typeof j.type === "string" ? j.type : "";
    const type = normalizeTypeId(rawType);
    if (!type || !jobType(type)) {
      return {
        ok: false,
        error: `Job #${i + 1}: unknown type "${rawType}" — this build knows ${jobTypeListPreview()}`,
      };
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
    warning,
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

/** "import, motioncorr, ctffind … (+N more)" — for unknown-type errors. */
function jobTypeListPreview(): string {
  const ids = JOB_TYPES.map((t) => t.key);
  const head = ids.slice(0, 6).join(", ");
  return ids.length > 6 ? `${head} … (+${ids.length - 6} more)` : head;
}

/** One parsed, valid workflow file queued for the import dialog. */
export interface ImportPreviewEntry {
  file: WorkflowFile;
  /** non-fatal version-compatibility notice — surfaced as a row chip */
  warning?: string;
  fileName: string;
}

/** One file that failed client-side parsing — shown in the dialog queue. */
export interface ImportFailure {
  fileName: string;
  error: string;
}

/**
 * Parse a PICKED FILE SELECTION (one or many) into the dialog's queue:
 * valid files become entries, unreadable ones become failures with their
 * specific parse error. The single shared funnel for BOTH import entry
 * points (canvas context-menu picker + command palette) — Task 83 doctrine:
 * every reader of a parse result must read the same one. All files are
 * parsed even when some fail, so the dialog can show the full picture.
 */
export async function parseWorkflowFiles(
  files: File[]
): Promise<{ entries: ImportPreviewEntry[]; failures: ImportFailure[] }> {
  const entries: ImportPreviewEntry[] = [];
  const failures: ImportFailure[] = [];
  for (const f of files) {
    try {
      const parsed = parseWorkflowJson(await f.text());
      if (parsed.ok && parsed.file) {
        entries.push({ file: parsed.file, warning: parsed.warning, fileName: f.name });
      } else {
        failures.push({ fileName: f.name, error: parsed.error ?? "Unreadable workflow file" });
      }
    } catch {
      failures.push({ fileName: f.name, error: "Unreadable workflow file" });
    }
  }
  return { entries, failures };
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

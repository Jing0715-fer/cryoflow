/**
 * CryoFlow — template export/import (.json) — the share leg of the
 * custom-template loop (Task 128; Task 127 built save + apply).
 *
 *   select → save → apply →  export  →  import (any project's shelf)
 *
 * FORMAT (cryoflow-template/1): a small NAMED wrapper around the saved
 * shape —
 *   { format, version, exportedAt, project?, name,
 *     payload: { jobs: [{type,dx,dy,params}], edges: [{from,to,fromPort?,toPort?}] } }
 * Edges reference jobs by INDEX (stable within the file — ids are minted
 * fresh at apply time); dx/dy are offsets from the bbox top-left. A
 * template is a shape, not a set of rows — exactly what the DB stores.
 * Run state has no place here by construction (a template never carried
 * it), so the file is pure geometry + wiring + parameters.
 *
 * The client pre-validates for instant feedback; POST /api/custom-template
 * re-validates EVERYTHING authoritatively (it must not trust the file or
 * this parser). Both callers share ONE validator — validateTemplatePayload
 * — so the two copies cannot drift apart (the workflow-io doctrine: every
 * reader of a parse result reads the same one).
 */

import type {
  CustomTemplateEdge,
  CustomTemplateJob,
  CustomTemplatePayload,
} from "./types";
import { jobType } from "./workflow";

export const TEMPLATE_FORMAT = "cryoflow-template";
export const TEMPLATE_VERSION = 1;

/** Sanity caps — must mirror the route's abuse guards (same validator). */
export const MAX_TEMPLATE_JOBS = 64;
export const MAX_TEMPLATE_EDGES = 256;
export const MAX_TEMPLATE_PAYLOAD_BYTES = 100_000;

export interface TemplateFile {
  format: string;
  version: number;
  exportedAt: string;
  /** informational provenance — the project the shape was saved in */
  project: string;
  name: string;
  payload: CustomTemplatePayload;
}

/**
 * THE shared payload validator — extracted from the custom-template route
 * (Task 128) so the save POST and the client-side import parser enforce
 * the exact same contract. Pure TypeScript: no db, no fs — importable
 * from both worlds. Returns either the cleaned payload or a specific
 * error message; both callers fail LOUDLY on bad input.
 */
export function validateTemplatePayload(
  raw: unknown
): { payload?: CustomTemplatePayload; error?: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Payload must be an object" };
  }
  const p = raw as Partial<CustomTemplatePayload>;
  if (!Array.isArray(p.jobs) || p.jobs.length === 0) {
    return { error: "Payload needs at least one job" };
  }
  if (p.jobs.length > MAX_TEMPLATE_JOBS) {
    return { error: `Too many jobs in one template (max ${MAX_TEMPLATE_JOBS})` };
  }
  if (p.edges != null && Array.isArray(p.edges) && p.edges.length > MAX_TEMPLATE_EDGES) {
    return { error: `Too many edges in one template (max ${MAX_TEMPLATE_EDGES})` };
  }

  const jobs: CustomTemplateJob[] = [];
  for (const [i, j] of p.jobs.entries()) {
    if (j == null || typeof j !== "object") {
      return { error: `Job #${i} is not an object` };
    }
    const type = typeof j.type === "string" ? j.type : "";
    if (!jobType(type)) {
      return { error: `Job #${i} references unknown job type: ${type || "(none)"}` };
    }
    const dx = typeof j.dx === "number" && Number.isFinite(j.dx) ? j.dx : NaN;
    const dy = typeof j.dy === "number" && Number.isFinite(j.dy) ? j.dy : NaN;
    if (Number.isNaN(dx) || Number.isNaN(dy)) {
      return { error: `Job #${i} has non-finite offsets` };
    }
    // params are re-filtered against the type's LIVE spec at APPLY time
    // (the schema may have drifted since the snapshot) — save keeps
    // scalars only, mirroring the jobs route's duplication contract
    const params: Record<string, number | string | boolean> = {};
    if (j.params != null && typeof j.params === "object" && !Array.isArray(j.params)) {
      for (const [k, v] of Object.entries(j.params as Record<string, unknown>)) {
        if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
          params[k] = v;
        }
      }
    }
    jobs.push({ type, dx, dy, params });
  }

  const edges: CustomTemplateEdge[] = [];
  const seen = new Set<string>();
  for (const [i, e] of (p.edges ?? []).entries()) {
    if (e == null || typeof e !== "object") {
      return { error: `Edge #${i} is not an object` };
    }
    const { from, to } = e as { from?: unknown; to?: unknown };
    if (
      typeof from !== "number" || !Number.isInteger(from) || from < 0 || from >= jobs.length ||
      typeof to !== "number" || !Number.isInteger(to) || to < 0 || to >= jobs.length
    ) {
      return { error: `Edge #${i} references a job index out of range` };
    }
    if (from === to) {
      return { error: `Edge #${i} is a self-loop` };
    }
    const key = `${from}->${to}`;
    if (seen.has(key)) continue; // dedupe — (from,to) is unique like the DB
    edges.push({
      from,
      to,
      ...(typeof e.fromPort === "string" && e.fromPort ? { fromPort: e.fromPort } : {}),
      ...(typeof e.toPort === "string" && e.toPort ? { toPort: e.toPort } : {}),
    });
  }

  return { payload: { jobs, edges } };
}

/**
 * Wrap a saved shape into the portable file. The payload is trusted to
 * have come from the server (GET ?id= re-serves what the POST validated).
 */
export function buildTemplateFile(
  name: string,
  payload: CustomTemplatePayload,
  project: string
): TemplateFile {
  return {
    format: TEMPLATE_FORMAT,
    version: TEMPLATE_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    name,
    payload,
  };
}

export interface ParsedTemplate {
  ok: boolean;
  error?: string;
  /** non-fatal notice (e.g. "file from a newer CryoFlow") — surfaced in the import toast */
  warning?: string;
  file?: TemplateFile;
}

/**
 * Client-side pre-validation with LOUD, specific errors — the server
 * (POST /api/custom-template) re-validates everything authoritatively,
 * but failing here gives instant feedback without a round-trip.
 *
 * The wrapper (format/version/name) is checked here; the payload goes
 * through the SHARED validator — the same function the POST route runs.
 * Port-pair COMPATIBILITY (which wiring is legal) stays server-only —
 * the client checks ports EXIST in the two specs, the server checks the
 * pair against the full compat rules (edge-ports is a server module).
 */
export function parseTemplateJson(text: string): ParsedTemplate {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not valid JSON — is this a CryoFlow template file?" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Unexpected file shape (expected an object)" };
  }
  const r = raw as Record<string, unknown>;
  if (r.format !== TEMPLATE_FORMAT) {
    return {
      ok: false,
      error: `Unrecognized format — expected ${TEMPLATE_FORMAT} (workflow files import through the workflow importer)`,
    };
  }
  // version tolerance mirrors workflow-io: any integer ≥ 1 parses — the
  // payload validation below is the real gate. A NEWER file still imports
  // best-effort (unknown extras are dropped by the validator); the caller
  // surfaces the warning so users know provenance may be lossy.
  const version = typeof r.version === "number" && Number.isInteger(r.version) ? r.version : 0;
  if (version < 1) {
    return {
      ok: false,
      error: `Missing or invalid version field — expected an integer ≥ 1 (${TEMPLATE_FORMAT}/v${TEMPLATE_VERSION})`,
    };
  }
  const warning =
    version > TEMPLATE_VERSION
      ? `File was exported by a newer CryoFlow (v${version} — this app reads v${TEMPLATE_VERSION}); imported best-effort`
      : undefined;

  const { payload, error } = validateTemplatePayload(r.payload);
  if (error || !payload) {
    return { ok: false, error: error ?? "Invalid template payload" };
  }

  const name =
    typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 80) : "Imported template";

  return {
    ok: true,
    warning,
    file: {
      format: TEMPLATE_FORMAT,
      version: TEMPLATE_VERSION,
      exportedAt: typeof r.exportedAt === "string" ? r.exportedAt : "",
      project: typeof r.project === "string" ? r.project : "",
      name,
      payload,
    },
  };
}

/** One parsed, valid template file queued for import. */
export interface TemplateImportEntry {
  file: TemplateFile;
  /** non-fatal version-compatibility notice — appended to the import toast */
  warning?: string;
  fileName: string;
}

/** One file that failed client-side parsing — named in the import toast. */
export interface TemplateImportFailure {
  fileName: string;
  error: string;
}

/**
 * Parse a PICKED FILE SELECTION (one or many) into the import funnel:
 * valid files become entries, unreadable ones become failures with their
 * specific parse error. All files are parsed even when some fail, so the
 * aggregate toast can show the full picture (parseWorkflowFiles doctrine).
 */
export async function parseTemplateFiles(
  files: File[]
): Promise<{ entries: TemplateImportEntry[]; failures: TemplateImportFailure[] }> {
  const entries: TemplateImportEntry[] = [];
  const failures: TemplateImportFailure[] = [];
  for (const f of files) {
    try {
      const parsed = parseTemplateJson(await f.text());
      if (parsed.ok && parsed.file) {
        entries.push({ file: parsed.file, warning: parsed.warning, fileName: f.name });
      } else {
        failures.push({ fileName: f.name, error: parsed.error ?? "Unreadable template file" });
      }
    } catch {
      failures.push({ fileName: f.name, error: "Unreadable template file" });
    }
  }
  return { entries, failures };
}

export function templateFileName(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "template";
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `cryoflow-template-${slug}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/** Serialize + trigger the browser download (downloadWorkflowJson's twin). */
export function downloadTemplateJson(file: TemplateFile, fileName: string): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

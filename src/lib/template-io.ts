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
 * Task 130 — the BUNDLE (cryoflow-template-bundle/1) is the export-ALL
 * container: one file, every template on the shelf —
 *   { format, version, exportedAt, project, templates: [<cryoflow-template/1>…] }
 * The bundle is a WRAPPER, not a new dialect: each inner entry is a full
 * single-template file re-validated with the same shared validator, so
 * "one file on the wire" costs no second payload contract.
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

/** Task 130 — the export-ALL container format (a wrapper, not a dialect). */
export const TEMPLATE_BUNDLE_FORMAT = "cryoflow-template-bundle";
export const TEMPLATE_BUNDLE_VERSION = 1;
/** Sanity cap for one bundle — the shelf is project-scoped and small. */
export const MAX_BUNDLE_TEMPLATES = 64;

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

/** Task 130 — the export-ALL container: one file, every template. */
export interface TemplateBundleFile {
  format: string;
  version: number;
  exportedAt: string;
  project: string;
  templates: TemplateFile[];
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

/**
 * Task 130 — wrap the shelf's files into the export-ALL bundle. Entries
 * are trusted (each came from GET ?all=1, which re-serves what POST
 * validated); size is sanity-capped by the parser on the way back in.
 */
export function buildTemplateBundle(
  templates: TemplateFile[],
  project: string
): TemplateBundleFile {
  return {
    format: TEMPLATE_BUNDLE_FORMAT,
    version: TEMPLATE_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    templates,
  };
}

export interface ParsedTemplate {
  ok: boolean;
  error?: string;
  /** non-fatal notice (e.g. "file from a newer CryoFlow") — surfaced in the import toast */
  warning?: string;
  file?: TemplateFile;
}

/** Task 130 — result of unwrapping one bundle file. */
export interface ParsedTemplateBundle {
  /** true when at least one inner template survived validation */
  ok: boolean;
  /** structural failure of the BUNDLE itself (version/shape/size) */
  error?: string;
  /** non-fatal bundle-level notice (newer-CryoFlow version) */
  warning?: string;
  /** valid inner templates, ready for the POST funnel */
  entries: { file: TemplateFile; warning?: string }[];
  /** inner templates that failed validation — named for the toast */
  invalid: { name: string; error: string }[];
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
  return parseTemplateRaw(raw);
}

/**
 * Object-level single-template parse — the shared body of parseTemplateJson
 * (string entry point) and the import funnel (which must JSON.parse first
 * to DETECT a bundle before dispatching). Same checks, same messages.
 */
function parseTemplateRaw(raw: unknown): ParsedTemplate {
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

/**
 * Task 130 — unwrap a BUNDLE: the wrapper gets format/version/size checks,
 * every inner entry then runs the SAME single-template parse (shared
 * validator, same messages). Partial survival is a feature: valid inners
 * import, broken ones are named in the toast — "all files are parsed even
 * when some fail" applies WITHIN a file too.
 */
export function parseTemplateBundleRaw(raw: unknown): ParsedTemplateBundle {
  const out: ParsedTemplateBundle = { ok: false, entries: [], invalid: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    out.error = "Unexpected bundle shape (expected an object)";
    return out;
  }
  const r = raw as Record<string, unknown>;
  const version = typeof r.version === "number" && Number.isInteger(r.version) ? r.version : 0;
  if (version < 1) {
    out.error = `Missing or invalid version field — expected an integer ≥ 1 (${TEMPLATE_BUNDLE_FORMAT}/v${TEMPLATE_BUNDLE_VERSION})`;
    return out;
  }
  if (version > TEMPLATE_BUNDLE_VERSION) {
    out.warning = `Bundle was exported by a newer CryoFlow (v${version} — this app reads v${TEMPLATE_BUNDLE_VERSION}); imported best-effort`;
  }
  if (!Array.isArray(r.templates) || r.templates.length === 0) {
    out.error = "Bundle has no templates";
    return out;
  }
  if (r.templates.length > MAX_BUNDLE_TEMPLATES) {
    out.error = `Too many templates in one bundle (max ${MAX_BUNDLE_TEMPLATES})`;
    return out;
  }
  for (const [i, inner] of (r.templates as unknown[]).entries()) {
    const obj = inner as Record<string, unknown> | null;
    const rawName =
      obj && typeof obj.name === "string" ? obj.name.trim() : "";
    const innerName = rawName ? rawName.slice(0, 80) : `template #${i + 1}`;
    const parsed = parseTemplateRaw(inner);
    if (parsed.ok && parsed.file) {
      // inner-specific notice wins; otherwise the bundle-level one rides along
      out.entries.push({ file: parsed.file, warning: parsed.warning ?? out.warning });
    } else {
      out.invalid.push({ name: innerName, error: parsed.error ?? "Invalid template" });
    }
  }
  out.ok = out.entries.length > 0;
  if (!out.ok && !out.error) {
    out.error = "Every template in the bundle failed validation";
  }
  return out;
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
      const raw: unknown = JSON.parse(await f.text());
      if (
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        (raw as Record<string, unknown>).format === TEMPLATE_BUNDLE_FORMAT
      ) {
        // Task 130 — a bundle EXPANDS: every valid inner becomes its own
        // import entry (POSTed exactly like a hand-saved template), every
        // broken inner is named in the toast with its specific error
        const bundle = parseTemplateBundleRaw(raw);
        for (const e of bundle.entries) {
          entries.push({ file: e.file, warning: e.warning, fileName: f.name });
        }
        for (const bad of bundle.invalid) {
          failures.push({ fileName: `${f.name} › ${bad.name}`, error: bad.error });
        }
        if (!bundle.ok && bundle.error) {
          failures.push({ fileName: f.name, error: bundle.error });
        }
      } else {
        const parsed = parseTemplateRaw(raw);
        if (parsed.ok && parsed.file) {
          entries.push({ file: parsed.file, warning: parsed.warning, fileName: f.name });
        } else {
          failures.push({ fileName: f.name, error: parsed.error ?? "Unreadable template file" });
        }
      }
    } catch {
      failures.push({ fileName: f.name, error: "Not valid JSON — is this a CryoFlow template file?" });
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
function downloadJsonBlob(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadTemplateJson(file: TemplateFile, fileName: string): void {
  downloadJsonBlob(file, fileName);
}

/** Task 130 — the export-ALL download (one bundle file). */
export function downloadTemplateBundleJson(bundle: TemplateBundleFile, fileName: string): void {
  downloadJsonBlob(bundle, fileName);
}

/** Bundle file name — count stays in the toast; the date disambiguates. */
export function templateBundleFileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `cryoflow-templates-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

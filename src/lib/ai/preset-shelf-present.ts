/**
 * t1149 — the user's preset shelf, the AGENT face: a PURE presenter.
 *
 * The user's hand-tuned parameter presets learned to speak in t713 (the
 * inspector's save/apply), t714 (the palette's "Add from your presets"
 * group) and t715 (the server mirror — one PresetShelf row behind
 * /api/param-presets). Thirty-four agent tools could read the job-type
 * roster (list_job_types), one job's live params (get_job_params) and
 * the whole world's health (get_world_health) — but none could quote
 * the USER'S OWN saved snapshots: a user asking 「用我常用的 2D 参数建一个
 * job」 or "what presets do I have?" forced the model to invent
 * parameter values. Inventing values for a shelf the user tuned by hand
 * is how a twin is born; the house law is one father per face, and this
 * module is the shelf's.
 *
 * Laws:
 *  - THE ONE TRUST DECISION RIDES THE FATHER — the row's bytes go
 *    through sanitizePresetShelf (t715's whitelist), never ad-hoc key
 *    checks here (a second gate is how two gates drift apart).
 *  - AN ABSENCE HAS ITS OWN WORD — a shelf never mirrored (no row),
 *    a synced-and-emptied shelf (the deletion's truth) and a corrupt
 *    row (unreadable bytes) are THREE different faces; the route's own
 *    empty-shelf semantics (the row's existence is the synced flag)
 *    are spoken, never collapsed into one bare "empty".
 *  - THE DISPLAY DIALECT IS THE UI'S — newest first (recentFirst, the
 *    palette's and the shelf dialog's own order), the count word is
 *    "knobs" (the cards' own word), the type speaks the JOB_TYPES label
 *    when one exists (the palette's jobType(p.type)?.label face) and a
 *    type no known job speaks is FLAGGED, never hidden (the t753 gated
 *    ask's law: the unknown-able type is shown and never resolved).
 *  - NO AGE JUDGMENT — a preset does not rot: the face speaks the
 *    created DATE, never a pace, never a Fresh/Marathon (the age
 *    fathers belong to the jobs' world; a second formatter here is how
 *    a twin is born). The module takes no clock at all.
 *  - THE SHELF IS THE USER'S, NOT THE PROJECT'S — one global row; the
 *    read takes no project scope and the summary says the shelf
 *    follows the user across browsers and projects.
 *  - PURE — no React, no store, no db, no clock.
 */

import {
  sanitizePresetShelf,
  type SanitizedPreset,
} from "@/lib/param-preset-sanitize";

/** Structurally the tools' AiToolResult — the pure module defines its
 *  own shape so it never imports the tool executor's world (db, prisma,
 *  the whole engine). */
export interface PresetShelfToolResult {
  ok: boolean;
  summary: string;
  detail?: unknown;
}

export interface KnownJobType {
  key: string;
  label: string;
}

export interface PresetShelfInput {
  /** False = the server has never seen a shelf row (never synced). */
  rowExists: boolean;
  /** The row's own bytes (PresetShelf.data). Null when the row is
   *  absent — the only door to the never-synced face. */
  raw: string | null;
  /** The row's updatedAt (ISO), null when absent — the shelf's own
   *  "last saved" stamp, spoken in the annex. */
  rowUpdatedAt: string | null;
  /** The JOB_TYPES vocabulary (key + label) — the type gate's words. */
  knownTypes: KnownJobType[];
}

export interface PresetShelfRow {
  name: string;
  type: string;
  /** The JOB_TYPES label when the type is known, null otherwise (the
   *  palette's own `t?.label ?? null` face). */
  typeLabel: string | null;
  typeKnown: boolean;
  /** The UI's own count word: a knob list IS the identity of a params
   *  snapshot (the cards' `{knobs} knobs` line). */
  knobs: number;
  /** The created stamp as an ISO date — a fact, never an age. */
  created: string;
  /** The FULL spec-key snapshot, byte for byte as the shelf holds it
   *  (no rounding, no re-formatting — the apply flow needs the exact
   *  values or the snapshot lies). */
  params: Record<string, number | string | boolean>;
}

/** t1149 — the shelf's agent face. Feed it the row's bytes and the
 *  job-type vocabulary; it returns the shelf's own rows (newest first,
 *  the UI's display dialect) plus a summary that names every preset so
 *  a skim answers "what presets do I have?" without opening the annex. */
export function presentPresetShelf(input: PresetShelfInput): PresetShelfToolResult {
  if (!input.rowExists) {
    return {
      ok: true,
      summary:
        "The user's preset shelf has never been written on this server — no browser has mirrored a save yet " +
        "(presets live per-browser in localStorage until their first save; the server cannot see local lists). " +
        "The developer-written curated presets still apply at add time from the command palette.",
      detail: { synced: false, corrupt: false, shelfUpdatedAt: null, presets: [] },
    };
  }

  let parsed: unknown = null;
  let corrupt = false;
  if (input.raw != null) {
    try {
      parsed = JSON.parse(input.raw);
    } catch {
      corrupt = true;
    }
  }
  if (corrupt) {
    return {
      ok: true,
      summary:
        "The shelf row exists but its bytes could not be parsed — the shelf reads as empty until the next save " +
        "rewrites the row (the route's own corrupt-row law). Quote nothing as a preset until then.",
      detail: { synced: true, corrupt: true, shelfUpdatedAt: input.rowUpdatedAt, presets: [] },
    };
  }

  // The ONE trust decision — t715's whitelist; junk rows drop here, not
  // in ad-hoc checks below.
  const presets: SanitizedPreset[] = sanitizePresetShelf(parsed);
  if (presets.length === 0) {
    return {
      ok: true,
      summary:
        "The shelf is synced and holds 0 presets — an emptied shelf is the deletion's truth (a deletion on " +
        "another browser propagates here), not a missing sync.",
      detail: { synced: true, corrupt: false, shelfUpdatedAt: input.rowUpdatedAt, presets: [] },
    };
  }

  const labelOf = (key: string): string | null =>
    input.knownTypes.find((t) => t.key === key)?.label ?? null;
  // The UI's display dialect: newest first (recentFirst, the palette's
  // and the shelf dialog's own order) — stable, non-mutating.
  const ordered = [...presets].sort((a, b) => b.createdAt - a.createdAt);
  const rows: PresetShelfRow[] = ordered.map((p) => {
    const label = labelOf(p.type);
    return {
      name: p.name,
      type: p.type,
      typeLabel: label,
      typeKnown: label != null,
      knobs: Object.keys(p.params).length,
      created: new Date(p.createdAt).toISOString(),
      params: p.params,
    };
  });

  const unknown = rows.filter((r) => !r.typeKnown);
  const types = new Set(presets.map((p) => p.type)).size;
  const listing = rows
    .map((r) => `"${r.name}" (${r.typeLabel ?? r.type}, ${r.knobs} knob${r.knobs === 1 ? "" : "s"})`)
    .join(", ");
  const summary =
    `The user's preset shelf holds ${rows.length} preset${rows.length === 1 ? "" : "s"} across ` +
    `${types} job type${types === 1 ? "" : "s"} (newest first): ${listing}. ` +
    (unknown.length > 0
      ? `${unknown.length === 1 ? "1 preset wears" : `${unknown.length} presets wear`} a type no known job ` +
        `speaks (${unknown.map((r) => `"${r.name}" → ${r.type}`).join(", ")}) — it can never legally land ` +
        "(the apply gate is structural). "
      : "") +
    "Wear one through create_job or update_job's params — a preset is a FULL spec-key snapshot (every spec " +
    "key replaced by the preset's value, legacy keys untouched). The shelf is the user's own, not the " +
    "project's: it follows the user across browsers and projects.";

  return {
    ok: true,
    summary,
    detail: {
      synced: true,
      corrupt: false,
      shelfUpdatedAt: input.rowUpdatedAt,
      presets: rows,
    },
  };
}

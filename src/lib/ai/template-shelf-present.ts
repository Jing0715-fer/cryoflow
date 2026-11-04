/**
 * t1150 — the user's template shelf, the AGENT face: a PURE presenter.
 *
 * The user's hand-built workflow shapes learned to speak in t127 (the
 * save: select jobs on the canvas, snapshot their types / relative
 * positions / params plus internal wires) and the apply door re-mints
 * the whole branch anywhere with one click (the route's own PUT —
 * placement contract, RELION numbering, ports re-validated). The shelf
 * has THREE UI faces (the canvas's save flow, the shelf dialog's rows
 * and the shape preview) and ONE server face (the custom-template rows
 * behind /api/custom-template), yet no agent tool could quote them: a
 * user asking 「我存过哪些模板」 or "which of my saved shapes fits
 * here?" forced the model to invent a pipeline — and inventing a shape
 * the user wired by hand is how a twin is born.
 *
 * Laws:
 *  - THE COUNTS RIDE THE ONE FATHER — templateCountsOf (lib/
 *    template-io.ts) is the SAME arithmetic the GET list route speaks;
 *    a second parser here is how the shelf's own numbers drift apart.
 *  - AN ABSENCE HAS ITS OWN WORD — an emptied shelf (0 rows) is the
 *    deletion's truth (a delete or the clear-shelf door propagates
 *    immediately; templates are server-native, there is no
 *    never-synced face), and a corrupt row is LISTED with 0 · 0 counts
 *    and says so aloud (the route's own law: keep it listed,
 *    deletable, honest about the counts — quote nothing from it).
 *  - THE DISPLAY DIALECT IS THE UI'S — newest first (the GET list's
 *    own createdAt desc), the count word is the dialog's own
 *    "{jobs} jobs · {wires} wires", the date is the row's ISO stamp.
 *  - NO AGE JUDGMENT — a template does not rot: the face speaks the
 *    saved DATE, never a pace. The module takes no clock at all.
 *  - THE SHELF IS THE PROJECT'S — templates live in the ACTIVE
 *    PROJECT's rows (the route's own where); unlike the user's param
 *    presets they do NOT follow the user across projects. The summary
 *    says so aloud (the cousin line drawn at the door).
 *  - THE SHAPE'S ONLY WRITER IS THE APPLY DOOR — read-only QUOTER: the
 *    agent names the shelf and the shapes; it NEVER re-mints a saved
 *    shape through build_pipeline/create_job (a chain rebuild drifts
 *    from the saved wiring's ports and the saved placement). The
 *    payload travels on apply only — the route's own law (the list
 *    stays light).
 *  - PURE — no React, no store, no db, no clock.
 */

import { templateCountsOf } from "@/lib/template-io";

/** Structurally the tools' AiToolResult — the pure module defines its
 *  own shape so it never imports the tool executor's world (db, prisma,
 *  the whole engine). */
export interface TemplateShelfToolResult {
  ok: boolean;
  summary: string;
  detail?: unknown;
}

/** One stored shelf row — the GET list route's own select shape, the
 *  payload as the raw stored bytes (the parse rides the counts father). */
export interface TemplateShelfRowInput {
  id: string;
  name: string;
  payload: string;
  /** The row's createdAt as ISO — the db feeds Date, the well maps. */
  createdAt: string;
}

export interface TemplateShelfInput {
  rows: TemplateShelfRowInput[];
}

export interface TemplateShelfRow {
  id: string;
  name: string;
  /** The dialog's own "{jobCount} jobs" count. */
  jobCount: number;
  /** The dialog's own "{edgeCount} wires" count. */
  edgeCount: number;
  /** The saved stamp as ISO — a fact, never an age. */
  created: string;
  /** True when the stored bytes could not be parsed — the row stays
   *  listed (deletable) with 0 · 0 counts, and the summary names it. */
  corrupt: boolean;
}

/** t1150 — the shelf's agent face. Feed it the stored rows (any order —
 *  the display order is pinned here); it returns the shelf's own rows
 *  (newest first, the dialog's own words) plus a summary that names
 *  every template so a skim answers "what templates do I have?" without
 *  opening the annex. */
export function presentTemplateShelf(input: TemplateShelfInput): TemplateShelfToolResult {
  // The display dialect: newest first (the GET list's own createdAt
  // desc) — stable, non-mutating, pinned in the source.
  const ordered = [...input.rows].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  );
  const rows: TemplateShelfRow[] = ordered.map((r) => {
    const counts = templateCountsOf(r.payload);
    return {
      id: r.id,
      name: r.name,
      jobCount: counts.jobCount,
      edgeCount: counts.edgeCount,
      created: r.createdAt,
      corrupt: !counts.parsed,
    };
  });

  if (rows.length === 0) {
    return {
      ok: true,
      summary:
        "The project's template shelf holds 0 templates — an emptied shelf is the deletion's truth (a delete " +
        "or the shelf's clear door propagates immediately), not a missing sync. Templates are saved from the " +
        "canvas: select jobs, choose the shelf's save door, and the shape lands here. The shelf belongs to " +
        "the ACTIVE PROJECT — it does not follow the user across projects (the param presets' cousin line).",
      detail: { templates: [] },
    };
  }

  const listing = rows
    .map(
      (r) =>
        `"${r.name}" (${r.jobCount} job${r.jobCount === 1 ? "" : "s"} · ${r.edgeCount} wire${r.edgeCount === 1 ? "" : "s"})`
    )
    .join(", ");
  const corrupt = rows.filter((r) => r.corrupt);
  const summary =
    `The project's template shelf holds ${rows.length} template${rows.length === 1 ? "" : "s"} (newest first): ` +
    `${listing}. ` +
    (corrupt.length > 0
      ? `${corrupt.length === 1 ? "1 row reads" : `${corrupt.length} rows read`} corrupt ` +
        `(${corrupt.map((r) => `"${r.name}"`).join(", ")}) — listed and deletable, but the counts say 0 · 0 ` +
        "and the shape cannot be quoted; quote nothing from it until the next save rewrites it. "
      : "") +
    "Wear one through the shelf dialog's one-click apply — it mints the branch below the workspace's content, " +
    "numbered in the project's RELION sequence, wired exactly as saved (ports re-validated). NEVER re-mint a " +
    "saved shape through build_pipeline or create_job: a chain rebuild drifts from the saved wiring. The shelf " +
    "is the ACTIVE PROJECT's — it does not follow the user across projects (the param presets' cousin line).";

  return {
    ok: true,
    summary,
    detail: { templates: rows },
  };
}

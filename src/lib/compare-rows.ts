/**
 * CryoFlow — the compare family's row sources (t469).
 *
 * The A/B verdict has THREE faces: the compare dialog (client, fetches
 * the routes), the routes themselves, and — since t469 — the agent's
 * compare_jobs tool. Two of those faces used to parse their own STAR
 * files: the row grammar lived INSIDE the ctf/motion route files, so
 * the tool would have either re-implemented the parse (a private read
 * path, t419's original sin) or fetched HTTP from inside the server
 * (a self-call). This module is the ONE row source under all faces:
 * the same block-aware parses, moved verbatim from the routes, called
 * by the routes AND the tool — one grammar, one drift.
 *
 * Laws (inherited from the routes, now stated once):
 *   - BLOCK-AWARE: the optics block shares every RELION star file; its
 *     rows must never leak into the data loop (freeze-on-first-row).
 *   - THE NAME IS THE BASENAME: the join key is the micrograph's file
 *     name — a run re-pathed between A and B still pairs by name.
 *   - SPOKEN DIALECTS ARE LIBERAL: motion's AccumMotion/AccumulatedMotion
 *     spelling split (t440) is honored here, where the routes used to.
 *   - COLD MIRRORS ARE EMPTY, NOT ERRORS: a workdir that does not exist
 *     yields zero rows — the callers speak the refusal (the route
 *     returns an empty response; the tool refuses honestly).
 */

import { existsSync, readdirSync } from "fs";
import path from "path";
import { cachedFileCompute } from "@/lib/relion/statcache";

/* ------------------------------------------------------------------ */
/* CTF — micrographs_ctf.star (moved verbatim from the ctf route)      */
/* ------------------------------------------------------------------ */

export interface CtfMicrograph {
  /** basename of _rlnMicrographName (display) */
  name: string;
  /** _rlnMicrographName as stored — relative to the job workdir (file API) */
  relPath: string;
  /** µm */
  defocusU: number;
  /** µm */
  defocusV: number;
  /** µm (|U − V|) */
  astigmatism: number;
  /** degrees */
  defocusAngle: number;
  /** ctffind figure of merit (0–1) */
  fom: number;
  /** Å, ctffind fit limit */
  maxResolution: number;
}

export function parseCtfStar(text: string): CtfMicrograph[] {
  // Block-aware parse: only data rows of the loop block that OWNS the
  // micrograph/defocus columns count — the optics block shares the file
  // and its rows (1 optGroup1 1.77 300 …) would otherwise leak in.
  // Columns are frozen when the FIRST data row of a loop arrives, so every
  // label of that loop is already known.
  const lines = text.split("\n");
  const rows: CtfMicrograph[] = [];

  let inLoop = false;
  let labels = new Map<string, number>();
  let cols: { name: number; u: number; v: number; astig: number; angle: number; fom: number; maxres: number } | null = null;

  const freeze = (): { name: number; u: number; v: number; astig: number; angle: number; fom: number; maxres: number } | null => {
    if (
      labels.has("_rlnMicrographName") &&
      labels.has("_rlnDefocusU") &&
      labels.has("_rlnDefocusV")
    ) {
      return {
        name: labels.get("_rlnMicrographName")!,
        u: labels.get("_rlnDefocusU")!,
        v: labels.get("_rlnDefocusV")!,
        astig: labels.get("_rlnCtfAstigmatism") ?? -1,
        angle: labels.get("_rlnDefocusAngle") ?? -1,
        fom: labels.get("_rlnCtfFigureOfMerit") ?? -1,
        maxres: labels.get("_rlnCtfMaxResolution") ?? -1,
      };
    }
    return null;
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (t === "loop_") {
      inLoop = true;
      labels = new Map();
      cols = null; // each loop is a fresh table
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      labels = new Map();
      cols = null;
      continue;
    }
    if (inLoop && t.startsWith("_")) {
      const m = /^(\S+)(?:\s+#?(\d+))?\s*$/.exec(t);
      if (m) labels.set(m[1], m[2] ? parseInt(m[2], 10) - 1 : labels.size);
      continue;
    }
    if (!t || t.startsWith("#")) continue;
    // first data row of this loop → try to freeze the column map
    if (inLoop && !cols) {
      cols = freeze();
      if (!cols) continue;
    }
    if (!cols) continue;
    const cells = t.split(/\s+/);
    if (cells.length <= Math.max(cols.name, cols.u, cols.v)) continue;
    const u = Number(cells[cols.u]);
    const v = Number(cells[cols.v]);
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    const name = cells[cols.name] ?? "";
    // RELION writes ctffind defocus (and astigmatism) in Ångström — a
    // single magnitude check keeps µm-native files untouched too.
    const inAngstrom = Math.abs(u) > 1000 || Math.abs(v) > 1000;
    const scale = inAngstrom ? 1 / 10_000 : 1;
    const astigRaw = cols.astig >= 0 ? Number(cells[cols.astig]) || Math.abs(u - v) : Math.abs(u - v);
    rows.push({
      name: name.split("/").pop() ?? name,
      relPath: name,
      defocusU: u * scale,
      defocusV: v * scale,
      astigmatism: astigRaw * scale,
      defocusAngle: cols.angle >= 0 ? Number(cells[cols.angle]) || 0 : 0,
      fom: cols.fom >= 0 ? Number(cells[cols.fom]) || 0 : 0,
      maxResolution: cols.maxres >= 0 ? Number(cells[cols.maxres]) || 0 : 0,
    });
  }
  return rows;
}

/** The ctf route's file hunt + cached parse, now shared. CtfFind writes
 *  micrographs_ctf.star at the workdir root; falls back to any nested
 *  *ctf*.star (ctf_refine / external layouts). [] on a cold mirror. */
export function ctfMicrographRows(workdir: string): CtfMicrograph[] {
  if (!workdir || !existsSync(workdir)) return [];
  const candidates: string[] = [];
  const root = path.join(workdir, "micrographs_ctf.star");
  if (existsSync(root)) candidates.push(root);
  if (candidates.length === 0) {
    for (const name of readdirSync(workdir)) {
      if (/ctf.*\.star$/i.test(name) && !/optimiser|data\.star/i.test(name)) {
        candidates.push(path.join(workdir, name));
      }
    }
  }
  if (candidates.length === 0) return [];
  // mtime-cached parse — callers must NOT mutate the cached array
  return cachedFileCompute(candidates[0], "ctf:micrographs-star", (text) => parseCtfStar(text)) ?? [];
}

/* ------------------------------------------------------------------ */
/* Motion — corrected_micrographs.star (moved verbatim from the route) */
/* ------------------------------------------------------------------ */

export interface MotionMicrograph {
  /** basename of _rlnMicrographName (display) */
  name: string;
  /** _rlnMicrographName as stored — relative to the job workdir (file API) */
  relPath: string;
  /** total accumulated drift over the whole movie, Å */
  total: number;
  /** drift accumulated over the early frames (before the stage settles), Å */
  early: number;
  /** drift accumulated over the late frames, Å */
  late: number;
}

/** Block-aware parse of corrected_micrographs.star's data loop. Columns
 *  freeze on the FIRST data row of the loop that owns the micrograph
 *  label — the optics block's rows can never leak in. */
export function parseMotionStar(text: string): MotionMicrograph[] {
  const lines = text.split("\n");
  const rows: MotionMicrograph[] = [];

  let inLoop = false;
  let labels = new Map<string, number>();
  let cols: { name: number; total: number; early: number; late: number } | null = null;

  const freeze = (): { name: number; total: number; early: number; late: number } | null => {
    const idx = (needle: string) => {
      for (const [label, i] of labels) {
        if (label === needle) return i;
      }
      return -1;
    };
    // t440 — the spelling had TWO variants and the parser picked the one
    // RELION does not write: corrected_micrographs.star carries
    // _rlnAccumMotion* (RELION 3/4/5 real columns), while some converted
    // / documented stars say _rlnAccumulatedMotion*. A parser locked to
    // one spelling read ZERO rows from every real file — the whole
    // motion face silently dead. Liberal match: real name first,
    // documented variant as fallback.
    const idx2 = (primary: string, fallback: string) => {
      const hit = idx(primary);
      return hit >= 0 ? hit : idx(fallback);
    };
    const name = idx("_rlnMicrographName");
    const total = idx2("_rlnAccumMotionTotal", "_rlnAccumulatedMotionTotal");
    if (name < 0 || total < 0) return null;
    return {
      name,
      total,
      early: idx2("_rlnAccumMotionEarly", "_rlnAccumulatedMotionEarly"),
      late: idx2("_rlnAccumMotionLate", "_rlnAccumulatedMotionLate"),
    };
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (t === "loop_") {
      inLoop = true;
      labels = new Map();
      cols = null;
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      cols = null;
      continue;
    }
    if (t.startsWith("#") || t.startsWith(";")) continue;
    if (t.startsWith("_")) {
      if (inLoop) {
        const m = /^(\S+)/.exec(t);
        if (m) labels.set(m[1], labels.size);
      }
      continue;
    }
    if (!inLoop) continue;
    if (!cols) {
      cols = freeze();
      if (!cols) {
        // a loop without the micrograph/motion columns — skip its rows
        cols = { name: -1, total: -1, early: -1, late: -1 };
      }
    }
    if (cols.name < 0) continue;
    const cells = t.split(/\s+/);
    const nameCell = cells[cols.name] ?? "";
    const total = parseFloat(cells[cols.total] ?? "");
    if (!nameCell || !Number.isFinite(total)) continue;
    const early = cols.early >= 0 ? parseFloat(cells[cols.early] ?? "") : NaN;
    const late = cols.late >= 0 ? parseFloat(cells[cols.late] ?? "") : NaN;
    rows.push({
      name: nameCell.split("/").pop() ?? nameCell,
      relPath: nameCell,
      total,
      early: Number.isFinite(early) ? early : Math.max(0, total / 2),
      late: Number.isFinite(late) ? late : Math.max(0, total / 2),
    });
  }
  return rows;
}

/** The motion route's catalogue read, now shared. [] + null source on a
 *  cold mirror — the callers speak what that means for their face. */
export function motionCatalogueRows(workdir: string): {
  sourceFile: string | null;
  micrographs: MotionMicrograph[];
} {
  const starPath = workdir ? path.join(workdir, "corrected_micrographs.star") : null;
  if (!starPath || !existsSync(starPath)) return { sourceFile: null, micrographs: [] };
  return {
    sourceFile: "corrected_micrographs.star",
    micrographs: cachedFileCompute(starPath, "motion:catalogue", parseMotionStar) ?? [],
  };
}

/**
 * CryoFlow — the star shape gate (t535), PURE module.
 *
 * Why pure (the t326/t327 recipe, extract-gate precedent): the dispatch
 * refusal and the bench must share ONE classification, so the verdict the
 * engine refuses on is exactly the verdict the bench asserts — no engine
 * (and its Prisma/fs spine) is needed to exercise it.
 *
 * WHY THIS EXISTS (the real-binary era, t534's ledger): the python stub
 * accepted any star; the REAL relion_run_motioncorr reads only a movies
 * star — data_movies with a _rlnMicrographMovieName column
 * (motioncorr_runner.cpp:257-263 hard-errors "does not contain the
 * rlnMicrographMovieName column. Are you sure you imported files as
 * movies…"). Feeding it the import's default micrographs star dies
 * mid-cluster as a cryptic "exit 1 (RELION reported an error)" — the
 * t268 fixture lived through five windows on stub indifference. The gate
 * reads the star's OWN bytes BEFORE dispatch and speaks the actionable
 * truth (the t195 law: evidence from bytes; the t416 law: the refusal
 * names the mechanism and the way out).
 */

import { readFileSync } from "node:fs";

export type StarMicDialect = "movies" | "micrographs" | null;

export interface StarMoviesShape {
  /** The data_ table that carries the micrograph-name column ("data_movies", "data_micrographs", …). */
  table: string | null;
  /** movies → _rlnMicrographMovieName present; micrographs → only _rlnMicrographName; null → neither. */
  dialect: StarMicDialect;
}

/**
 * Classify star TEXT: which data_ table carries the micrograph-name
 * column, and in which dialect. Label lines only (`_rln…` at line start,
 * optional ` #N` suffix) — a row value that merely CONTAINS the label
 * text (a path fragment) is not a column. The first table speaking
 * either dialect wins (stars carry one micrograph-shaped table; the
 * optics block speaks neither).
 */
export function starMoviesShapeOf(text: string): StarMoviesShape {
  let table: string | null = null;
  let dialect: StarMicDialect = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^data_\S+\s*$/.test(line)) {
      table = line;
      continue;
    }
    if (!table) continue;
    if (/^_rlnMicrographMovieName(\s|#|$)/.test(line)) {
      // movies wins the moment any table speaks it
      return { table, dialect: "movies" };
    }
    if (dialect === null && /^_rlnMicrographName(\s|#|$)/.test(line)) {
      dialect = "micrographs";
    }
  }
  return { table, dialect };
}

/**
 * The gate's file-side wrapper: honest null on ANY read failure — an
 * unreadable star is not a verdict, and the binary (or the staging
 * lane's own unreadable-star error) still speaks for it.
 */
export function readStarMoviesShape(starPath: string): StarMoviesShape | null {
  try {
    return starMoviesShapeOf(readFileSync(starPath, "utf8"));
  } catch {
    return null;
  }
}

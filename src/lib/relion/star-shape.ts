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
 *
 * t1168 — the read is a HEAD LADDER, not a whole-file read: a star's
 * labels live in its first kilobytes, so a 256 KB head answers almost
 * always (the file behind it can be gigabytes). When the head's evidence
 * is INCONCLUSIVE — no data_ table seen yet and bytes remain — the
 * ladder escalates (256 KB → 1 MB → 8 MB → whole file): memory bounded
 * for the real world, correctness preserved for the pathological one.
 * The honest-null contract is untouched (an unreadable star is not a
 * verdict). The classification itself (starMoviesShapeOf) is byte-for-
 * byte the same pure function — only the bytes it is HANDED changed.
 */

import { readTextHead } from "@/lib/fs-text";

/** The head ladder: the rungs the classification escalates through. */
const SHAPE_HEAD_LADDER = [256 * 1024, 1024 * 1024, 8 * 1024 * 1024, Number.POSITIVE_INFINITY];

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
 *
 * t1168 — the HEAD LADDER: the classification runs on progressively
 * larger heads until the DIALECT is decided (movies / micrographs / a
 * final whole-file null). Escalating on the dialect — never on "a data_
 * table was seen" — keeps parity with the old whole-read in every case:
 * a truncated head that only saw data_optics must NOT stop the ladder,
 * because the micrograph table may live beyond it (the parity law: the
 * bounded read answers exactly what the whole read answered, or it has
 * not answered yet). A head whose dialect IS decided is final (a later
 * block cannot un-speak _rlnMicrographMovieName — the classifier's own
 * first-win rule). The Infinity rung exists for parity on the
 * pathological file; real RELION stars decide within the first rung —
 * their labels precede their rows.
 *
 * One honest refinement on the table field: a "movies" verdict is exact
 * parity (the classifier itself early-returns at the win). A "micro-
 * graphs" verdict decided on a TRUNCATED head names the block that
 * spoke — for RELION output that is the file's last table anyway
 * (data_micrographs closes the star); a table AFTER the micrograph
 * block is not a RELION star, and naming the block that earned the
 * dialect is the truer answer.
 */
export function readStarMoviesShape(starPath: string): StarMoviesShape | null {
  for (const bytes of SHAPE_HEAD_LADDER) {
    const head = readTextHead(starPath, bytes);
    if (!head) return null;
    const shape = starMoviesShapeOf(head.text);
    if (shape.dialect !== null) return shape; // decided — a later block cannot un-speak it
    if (!head.truncated) return shape; // whole file seen, dialect absent: final null
  }
  return null;
}

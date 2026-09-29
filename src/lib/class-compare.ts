/**
 * CryoFlow — the class-compare domain module (t453).
 *
 * t439 built the CTF A/B verdict, t440 generalized the brain
 * (paired-compare.ts) and added the Motion face; t452 gave the verdict
 * its first consumer verb. This module is the THIRD domain: two 2D/3D
 * classification runs meet on the class number, and the verdict asks a
 * different question — not "did the number move" but "WHERE did the
 * particles go?". A class's occupancy share is a share of a population:
 * when one class gains, others lose — the vocabulary must not borrow
 * the micrograph domains' improved/regressed, which is why this module
 * also mints the verdict's words (gained / lost / held).
 *
 * The laws (domain-local):
 *   - THE PAIRING KEY IS THE CLASS NUMBER, spoken RELION's way: rows
 *     are named "Class 001"… so the shared join works unchanged — and
 *     the select verb can parse the numbers back out of the names it
 *     minted (the name IS the id, one law).
 *   - OCCUPANCY SPEAKS GAINED/LOST/HELD: direction-aware words owned
 *     here, defaulted by the core for the micrograph domains.
 *   - THE CENSUS STATES, IT NEVER JUDGES: the concentration line is a
 *     health check (like defocus agreement) — each run's own top-5
 *     share and its classes above the usability bar, arrow = A → B.
 *   - THE SELECT LIST IS SORTED AND DEDUPED: the dialog's gained rows
 *     parse back to class numbers; a set, never a log.
 */

import type { LensSpec, Pair } from "@/lib/paired-compare";

/** One class row of one classification run — the classes route's
 *  occupancy, renamed for the shared join (`name` is the key). */
export interface ClassRunRow {
  /** "Class 007" — the join key AND the select verb's payload. */
  name: string;
  /** 1-based RELION class number. */
  cls: number;
  /** Particles assigned to this class in this run. */
  count: number;
  /** Share of the run's total particles, 0–1. */
  fraction: number;
}

/** "Class 7" → "Class 007" — RELION's zero-padded dialect. */
export function classRowName(cls: number): string {
  return `Class ${String(cls).padStart(3, "0")}`;
}

/** Route occupancy → join row. */
export function classRunRow(c: {
  cls: number;
  count: number;
  fraction: number;
}): ClassRunRow {
  return { name: classRowName(c.cls), cls: c.cls, count: c.count, fraction: c.fraction };
}

/** The one lens a share has: percentages of the population. Higher IS
 *  better — but only per class, which is exactly why the verdict's
 *  words say gained/lost (a gain here is a loss somewhere else; the
 *  census line carries the distribution's own truth). */
export const CLASS_LENSES: Record<string, LensSpec<ClassRunRow>> = {
  share: {
    key: "share",
    label: "Occupancy share",
    unit: "%",
    higherIsBetter: true,
    digits: 1,
    value: (row) => row.fraction * 100,
  },
};

export const CLASS_DEFAULT_LENS = "share";

/* ------------------------------------------------------------------ */
/* The vocabulary law.                                                 */
/* ------------------------------------------------------------------ */

/** The verdict's words per domain: occupancy moves populations, not
 *  quality — "improved" would lie about a class that merely gained
 *  particles. Five fields: the chip/series verbs and the mover-list
 *  nouns. */
export interface VerdictWords {
  better: string;
  worse: string;
  same: string;
  betterNoun: string;
  worseNoun: string;
}

/** The class domain's own words (the face's default lives in the
 *  core's consumer — the micrograph domains keep improved/regressed). */
export const CLASS_WORDS: VerdictWords = {
  better: "gained",
  worse: "lost",
  same: "held",
  betterNoun: "gains",
  worseNoun: "losses",
};

/* ------------------------------------------------------------------ */
/* The concentration census — the pairing's own health check.          */
/* ------------------------------------------------------------------ */

/** Each side's top-K classes (its OWN ranking) speak the distribution's
 *  concentration; classes above the usability bar speak how many
 *  selections are worth making. */
export const TOP_CONCENTRATION = 5;
export const USABLE_SHARE = 0.01;

function topShare(rows: ClassRunRow[]): number {
  const top = [...rows].sort((x, y) => y.fraction - x.fraction).slice(0, TOP_CONCENTRATION);
  return top.reduce((s, r) => s + r.fraction, 0) * 100;
}

function usableCount(rows: ClassRunRow[]): number {
  return rows.filter((r) => r.fraction >= USABLE_SHARE).length;
}

/** "Concentration census: the top 5 classes hold 62.3% → 71.0% of the
 *  particles; classes above the 1% bar: 12 → 8, across 50 paired
 *  classes — the distribution's own health check." Null on an empty
 *  electorate (the trust line hides, it never hand-waves). */
export function concentrationCensus(
  pairs: Pair<ClassRunRow, ClassRunRow>[],
): string | null {
  if (pairs.length === 0) return null;
  const a = pairs.map((p) => p.a);
  const b = pairs.map((p) => p.b);
  const ta = topShare(a);
  const tb = topShare(b);
  const ua = usableCount(a);
  const ub = usableCount(b);
  return (
    `Concentration census: the top ${TOP_CONCENTRATION} classes hold ` +
    `${ta.toFixed(1)}% → ${tb.toFixed(1)}% of the particles; classes above ` +
    `the ${Math.round(USABLE_SHARE * 100)}% bar: ${ua} → ${ub}, across ` +
    `${pairs.length} paired classes — the distribution's own health check.`
  );
}

/* ------------------------------------------------------------------ */
/* The select verb's payload.                                          */
/* ------------------------------------------------------------------ */

/** The gained rows parse back to class numbers — the names this module
 *  minted ARE the ids (one law), so the verb needs no side channel.
 *  Sorted ascending, deduped: a selection is a set, never a log. */
export function gainedClassNumbers(gained: { name: string }[]): number[] {
  const out = new Set<number>();
  for (const row of gained) {
    const m = /^Class (\d+)$/.exec(row.name);
    if (m) out.add(parseInt(m[1], 10));
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * CryoFlow — the angle vaccine (t1136), PURE module.
 *
 * WHY THIS EXISTS (the t1135 law carried to the readers): the
 * classification family's books carried a malformed _rlnAngleTilt on every
 * row — "89.97.2", a float with two dots — because the stub writer's
 * f-string lost its colon ({90.0 - p:.2f} written as {90.0 - p}.2). The
 * writer is cured (t1135), but the world's already-written books stay
 * corrupt until their producing lane re-runs, and any reader that parses
 * them LENIENTLY spreads the lie: parseFloat("89.97.2") === 89.97 — a
 * partial acceptance that lets a corrupt book flow into fresh bytes with
 * plausible-looking angles, while a strict reader (real RELION's star
 * parser) refuses the whole file on exactly this shape.
 *
 * THE LAW (the corruption's own vaccine): a cell that parseFloat PARTIALLY
 * accepts but that fails the strict float grammar is a lie in waiting. The
 * book doors (symexpand, rebalance, select — the lanes that consume a
 * classification/refine data star) refuse the whole book BEFORE the
 * corruption spreads (the t416 law: the refusal names the mechanism and
 * the way out — re-run the producing job, whose writer now heals on
 * rewrite, or wire a clean book).
 *
 * PURE (the t535 star-shape recipe): no node:fs, no engine spine — the
 * dispatch path and the bench share ONE classification, so the verdict the
 * doors refuse on is exactly the verdict the unit asserts.
 */

/** The strict float grammar — the t1135 instrument's own shape. A RELION
 * book's angle cell must speak exactly this (plain decimal, optional
 * sign); anything else that parseFloat would PARTIALLY accept is the
 * corruption family's signature. */
export const STRICT_FLOAT_RE = /^-?\d+(\.\d+)?$/;

export interface VaccineCol {
  /** The star label the column was found under (e.g. "_rlnAngleTilt"). */
  label: string;
  /** Zero-based column index in a whitespace-split row. */
  col: number;
}

export interface CorruptCell {
  /** The star label the corrupt cell sits under. */
  label: string;
  /** The corrupt cell's raw bytes (e.g. "89.97.2"). */
  value: string;
}

/**
 * Classify ONE whitespace-split row's angle cells. Returns the FIRST
 * corrupt cell, or null when the row is clean.
 *
 * The classification is deliberately narrow — the parseFloat-lies class:
 *   - a cell that is empty or sign-only is NOT corrupt (the existing
 *     skip path — a row without orientation has always been skippable);
 *   - a cell parseFloat reads as NaN is NOT corrupt (the same skip path);
 *   - a cell parseFloat PARTIALLY accepts (finite) but that fails the
 *     strict grammar IS corrupt — the two-dot shape is this family's
 *     signature, and the vaccine refuses it on sight.
 * A row SHORTER than the column is not the vaccine's business (the
 * caller's own shape guard already skips it).
 */
export function corruptAngleCell(parts: string[], cols: VaccineCol[]): CorruptCell | null {
  for (const { label, col } of cols) {
    if (col < 0 || col >= parts.length) continue;
    const cell = parts[col];
    if (cell === "" || cell === "-" || cell === "+") continue;
    if (!Number.isFinite(parseFloat(cell))) continue;
    if (!STRICT_FLOAT_RE.test(cell)) return { label, value: cell };
  }
  return null;
}

/**
 * The refusal word (the t416 law — the mechanism AND the way out). One
 * mouth for every book door: symexpand, rebalance and select speak the
 * same sentence shape, parameterized by the door's own name.
 */
export function angleVaccineRefusal(
  bad: CorruptCell,
  door: string,
  inStar: string,
  lineNo: number
): string {
  return (
    `input STAR's ${bad.label} column speaks a malformed float on line ${lineNo}: ` +
    `"${bad.value}" (a lenient reader silently truncates it; a strict reader refuses the whole book) — ` +
    `the book was written by a pre-t1135 writer and ${door} would spread the corruption into fresh bytes. ` +
    `Re-run the producing job (the writer heals the book on rewrite) or wire a clean data star — ` +
    `the books must speak valid floats (t1135)`
  );
}

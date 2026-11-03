/**
 * CryoFlow — the STAR table's SHARED comparator (t872).
 *
 * t651 put the numeric-aware sort in the client component; t872 moves
 * the SAME semantics into one module both the client and the outputs
 * star route import, so the server can sort the WHOLE file before
 * slicing pages and the dialog can render that truth without a second
 * (drifting) implementation. One comparator, two consumers, zero
 * dialect drift — the one-implementation law the census keeps asking
 * for (t864's shared-ruler lesson, applied to the data layer).
 *
 * The semantics are t651's, verbatim:
 *   - a column is numeric when ≥ 80% of its first 50 filled cells
 *     parseFloat to a finite number (a numeric PREFIX counts —
 *     "000001@extract/particles.mrcs" sorts by its particle index,
 *     which is the meaningful key);
 *   - NaN/empty cells ride the TAIL in BOTH directions (an absence is
 *     not a value — a missing defocus is not "minus infinity");
 *   - ties break on the file's NATIVE index, so equal keys hold still
 *     across sorts and pages (no shimmer between clicks);
 *   - string columns compare as locale strings.
 *
 * The alignment predicate (isNumericAlignColumn) is deliberately
 * STRICTER than the sort's and answers a different question — "does
 * this column READ as numbers?" may not right-align a 39-character
 * path that happens to start with digits, so it demands WHOLLY numeric
 * cells (Number(), not parseFloat). One word, two semantics, two
 * verdicts — both live here now, side by side.
 */

export type StarSortDir = "asc" | "desc";

/** t651 — numeric-column detection by sampling. */
export function isNumericColumn(rows: string[][], col: number): boolean {
  if (rows.length === 0) return false;
  const sample = rows.slice(0, 50);
  let numeric = 0;
  let filled = 0;
  for (const row of sample) {
    const cell = row[col] ?? "";
    if (cell.trim() === "") continue;
    filled++;
    if (Number.isFinite(parseFloat(cell))) numeric++;
  }
  return filled > 0 && numeric / filled >= 0.8;
}

/** t652 — the ALIGNMENT predicate is stricter than the sort's. */
export function isNumericAlignColumn(rows: string[][], col: number): boolean {
  if (rows.length === 0) return false;
  const sample = rows.slice(0, 50);
  let numeric = 0;
  let filled = 0;
  for (const row of sample) {
    const cell = row[col] ?? "";
    if (cell.trim() === "") continue;
    filled++;
    if (Number.isFinite(Number(cell))) numeric++;
  }
  return filled > 0 && numeric / filled >= 0.8;
}

/**
 * t872 — sort a loop block SERVER-SIDE and return the rows' NATIVE
 * indices in display order. The caller slices pages out of this order;
 * the client maps each rendered row back to its native record number
 * (the t656 sticky # column stays the file's own map, now across pages).
 *
 * The comparator is t651's makeSorter with the pairs flattened to
 * indices — same empties-first-to-tail rule, same NaN tail, same
 * native-index tiebreak, same flip sign.
 */
export function sortStarRows(
  rows: string[][],
  col: number,
  dir: StarSortDir,
  numeric: boolean
): number[] {
  const keyed = rows.map((row, i) => ({ i, cell: row[col] ?? "" }));
  const flip = dir === "asc" ? 1 : -1;
  keyed.sort((a, b) => {
    const av = a.cell.trim();
    const bv = b.cell.trim();
    const aEmpty = av === "";
    const bEmpty = bv === "";
    if (aEmpty && bEmpty) return a.i - b.i;
    if (aEmpty) return 1; // empties always tail, even descending
    if (bEmpty) return -1;
    if (numeric) {
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      const aNaN = !Number.isFinite(an);
      const bNaN = !Number.isFinite(bn);
      if (aNaN && bNaN) return a.i - b.i;
      if (aNaN) return 1;
      if (bNaN) return -1;
      if (an !== bn) return (an - bn) * flip;
      return a.i - b.i;
    }
    const cmp = av.localeCompare(bv);
    if (cmp !== 0) return cmp * flip;
    return a.i - b.i;
  });
  return keyed.map((k) => k.i);
}

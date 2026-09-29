/**
 * t447 — the twin's name: a sibling, not a descendant.
 *
 * The family stays flat. Duplicating "X (copy)" mints "X (copy) 2", never
 * "X (copy) (copy)" — a chain of parens is a bloodline, and the twin has
 * none (t442: the twin is a NEW BRANCH — siblings read the original's
 * outputs, so the name must read as a sibling of the source's copy family,
 * not a child of the one member the user happened to duplicate). Exactly
 * one family suffix — " (copy)" or " (copy) N" — is stripped from the
 * source before numbering; every member then sits at the same depth, sorts
 * together, and greps together.
 *
 * Numbering is lowest-free-slot, not counting: a world that already holds
 * "X (copy)" and "X (copy) 3" (the 2 was deleted) hands the next twin
 * "X (copy) 2" — names belong to the world that still contains them, and
 * tombstones don't reserve seats.
 *
 * All pure brain — no store, no fetch, no React. The store wires it at
 * both duplicate doors (single + batch); the server persists whatever name
 * arrives, exactly as before.
 */

/** One trailing family suffix: " (copy)" or " (copy) <digits>", at the end
 *  of the string only. A mid-string "(copy)" ("X (copy) plus") or a foreign
 *  paren ("X (draft)") is part of the name, not a suffix. */
const COPY_FAMILY = /\s\(copy\)(?:\s+(\d+))?$/;

/** "X (copy) 2" → "X"; "X (copy)" → "X"; "X" → "X". Strips ONE suffix —
 *  the family is flat, so one strip always lands on the family root. */
export function baseNameOf(name: string): string {
  return name.replace(COPY_FAMILY, "");
}

/** The twin's name for `srcName` in a world where `taken` names are alive.
 *  The source's own name occupies the namespace too (a twin may not share
 *  its source's name even when the source IS a copy), so pass every live
 *  job's name — no exclusions. */
export function twinName(srcName: string, taken: Iterable<string>): string {
  const occupied = new Set(taken);
  const base = baseNameOf(srcName);
  let candidate = `${base} (copy)`;
  let n = 1;
  while (occupied.has(candidate)) {
    n += 1;
    candidate = `${base} (copy) ${n}`;
  }
  return candidate;
}

/** Batch naming with reservation. Every name a sibling twin claims blocks
 *  the next one from claiming it too — duplicating ["X", "X"] in one
 *  gesture yields "X (copy)" and "X (copy) 2", never a collision. Sources
 *  are named in list order; the reservation set starts from `taken`. */
export function twinNamesFor(
  sources: readonly { name: string }[],
  taken: Iterable<string>
): string[] {
  const occupied = new Set(taken);
  return sources.map(({ name }) => {
    const claimed = twinName(name, occupied);
    occupied.add(claimed);
    return claimed;
  });
}

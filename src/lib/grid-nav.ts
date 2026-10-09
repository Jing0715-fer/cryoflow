/**
 * CryoFlow — the grid arrow-key navigator (Task 777).
 *
 * The third sibling of the spatial contract. The canvas cards got theirs
 * in t775 (canvas-nav.ts — absolute positions, cone law); the class
 * gallery has spoken the same law since its roving tabindex landed
 * (half-tile tolerance, geometric neighbours). The results Maps & images
 * grid is a responsive CSS grid of thumbnail buttons — Tab walks them one
 * by one, but a results round can hold dozens of tiles, and the arrow
 * keys are how the eye actually moves. This module is the geometry brain
 * the gallery's inline law, extracted: the tile raises the intent, the
 * grid resolves the geometry and moves the DOM focus.
 *
 * Law (t775's door lineage, grid edition): arrows only MOVE, they never
 * act — Enter/Space keep the monopoly on enlarging a tile. Focus transfer
 * is the whole gesture. The law is measured, not guessed: neighbours are
 * resolved from real rects (no column-count arithmetic that a responsive
 * grid would silently break), the edge of the world returns null and the
 * focused tile honestly keeps the focus.
 */

/** Where the eye wants to go. The arrow key words map 1:1 in the grid. */
export type GridDir = "up" | "down" | "left" | "right" | "home" | "end";

/** One measurable tile: its viewport rect, plus the id focus should take. */
export interface GridEntry {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The tile an arrow key hands the focus to, or null when the edge of the
 * world is reached (no tile lies in that direction) — Home/End resolve to
 * the first/last entry in document order, which in a CSS grid IS the
 * reading order.
 *
 * Direction filter (the gallery's proven law, verbatim): a horizontal
 * move requires the neighbour's vertical center within half a tile height
 * of the current one (same VISUAL row, not same index) and strictly
 * beyond it on the travel axis with a 1px gutter against float dust; a
 * vertical move mirrors on columns. Ranking: nearest on the travel axis.
 * Holes (remote tiles that are not roving stops) are simply absent from
 * entries — geometry reads the world it is given.
 */
export function gridNeighbor(
  entries: GridEntry[],
  fromId: string | null,
  dir: GridDir
): string | null {
  if (entries.length === 0) return null;
  if (dir === "home") return entries[0].id;
  if (dir === "end") return entries[entries.length - 1].id;

  const cur = entries.find((en) => en.id === fromId);
  if (!cur) return null;

  const cx = cur.left + cur.width / 2;
  const cy = cur.top + cur.height / 2;
  const rowTol = cur.height / 2;
  const colTol = cur.width / 2;

  let target: GridEntry | undefined;
  switch (dir) {
    case "right":
      target = entries
        .filter(
          (en) =>
            en.left > cur.left + 1 &&
            Math.abs(en.top + en.height / 2 - cy) < rowTol
        )
        .sort((a, b) => a.left - b.left)[0];
      break;
    case "left":
      target = entries
        .filter(
          (en) =>
            en.left < cur.left - 1 &&
            Math.abs(en.top + en.height / 2 - cy) < rowTol
        )
        .sort((a, b) => b.left - a.left)[0];
      break;
    case "down":
      target = entries
        .filter(
          (en) =>
            en.top > cur.top + 1 &&
            Math.abs(en.left + en.width / 2 - cx) < colTol
        )
        .sort((a, b) => a.top - b.top)[0];
      break;
    case "up":
      target = entries
        .filter(
          (en) =>
            en.top < cur.top - 1 &&
            Math.abs(en.left + en.width / 2 - cx) < colTol
        )
        .sort((a, b) => b.top - a.top)[0];
      break;
  }
  return target ? target.id : null;
}

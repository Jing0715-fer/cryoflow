/**
 * CryoFlow — the canvas arrow-key navigator (Task 775).
 *
 * The canvas cards are absolutely positioned; Tab walks them in DOM
 * (creation) order, which is not the order the EYE sees. Arrow keys are
 * the spatial contract: from the focused card, the arrow points at the
 * direction the eye moves, and the nearest card in that direction takes
 * the focus. This module is the geometry brain; the card and the canvas
 * stay dumb (the card raises the intent, the canvas resolves the
 * geometry and moves the DOM focus).
 *
 * Law (t773's door lineage, keyboard edition): Enter/Space already ride
 * the select/inspect split — arrows only MOVE, they never act. Focus
 * transfer is the whole gesture; nothing else happens on the way.
 */
import { CARD_W, CARD_H } from "@/lib/workflow";
import type { JobDTO } from "@/lib/types";

export type NavDir = "up" | "down" | "left" | "right";

/** center of a card — the geometry every comparison is made on */
function center(job: { x: number; y: number }): { cx: number; cy: number } {
  return { cx: job.x + CARD_W / 2, cy: job.y + CARD_H / 2 };
}

/**
 * The card an arrow key hands the focus to, or null when the edge of the
 * world is reached (no card lies in that direction).
 *
 * Direction filter: the neighbor's center must sit in the arrow's
 * half-plane (strictly beyond the current center on the travel axis, and
 * within a 90° cone — the perpendicular offset may not exceed the travel
 * distance, so "down" never jumps to a card that is mostly sideways).
 * Ranking: primary = travel-axis distance, tiebreak = perpendicular
 * drift, final tiebreak = job id (stable across re-renders).
 */
export function nearestNeighbor(
  jobs: Pick<JobDTO, "id" | "x" | "y">[],
  fromId: string,
  dir: NavDir
): string | null {
  const from = jobs.find((j) => j.id === fromId);
  if (!from) return null;
  const fc = center(from);

  const axis = (p: { cx: number; cy: number }): number =>
    dir === "up" ? fc.cy - p.cy : dir === "down" ? p.cy - fc.cy : dir === "left" ? fc.cx - p.cx : p.cx - fc.cx;
  const perp = (p: { cx: number; cy: number }): number =>
    dir === "up" || dir === "down" ? Math.abs(p.cx - fc.cx) : Math.abs(p.cy - fc.cy);

  let best: { id: string; travel: number; drift: number } | null = null;
  for (const j of jobs) {
    if (j.id === fromId) continue;
    const c = center(j);
    const travel = axis(c);
    if (travel <= 0) continue; // not in the arrow's half-plane
    const drift = perp(c);
    if (drift > travel) continue; // outside the 90° cone — mostly sideways
    if (
      !best ||
      travel < best.travel ||
      (travel === best.travel && (drift < best.drift || (drift === best.drift && j.id < best.id)))
    ) {
      best = { id: j.id, travel, drift };
    }
  }
  return best?.id ?? null;
}

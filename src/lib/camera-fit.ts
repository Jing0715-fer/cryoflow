/**
 * camera-fit — the camera-fit door's decision core (t1145).
 *
 * The mol* embed's init fit read the scene once; the isosurface geometry
 * bakes async, so in a small strip viewport the first read can legitimately
 * be radius 0 — and the old code fell to Camera.Reset, whose default pose
 * has no opinion about the scene's actual extent. The map stayed invisible
 * and the camera never spoke again. The door now has patience (bounded
 * retries) and a fallback chain whose BRAIN lives here, pure and testable:
 *
 *   1. "visible" — the visible scene's bounding sphere has a real radius
 *      (the surface baked; frame it tight, ×0.7 with floor 1);
 *   2. "whole"   — nothing visible yet, but the whole-scene sphere (the
 *      map DATA's box, invisible surfaces included) does — frame on it;
 *   3. "reset"   — the scene is truly empty (or the numbers lie); the
 *      stock pose is the honest last resort.
 *
 * A garbage number (NaN, negative, zero, non-finite) reads as "no sphere" —
 * it must never steer the camera.
 */
export type SceneFitChoice = "visible" | "whole" | "reset";

export function sceneFitChoice(
  visibleRadius: number | null | undefined,
  wholeRadius: number | null | undefined,
): SceneFitChoice {
  const usable = (r: number | null | undefined): r is number =>
    typeof r === "number" && Number.isFinite(r) && r > 0;
  if (usable(visibleRadius)) return "visible";
  if (usable(wholeRadius)) return "whole";
  return "reset";
}

/** the fit's patience shape — how many beats the door waits for a fresh
 *  bake before falling through, and how long one beat lasts. The init
 *  ride waits long (the bake starts cold); the user-facing verb (the Fit
 *  button / the V key) waits shorter — the scene is already warm. */
export const FIT_PATIENCE = {
  init: { beats: 10, beatMs: 200 },
  verb: { beats: 3, beatMs: 150 },
} as const;

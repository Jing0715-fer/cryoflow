import type { MrcPolarity } from "./mrc";
import { lineageFor } from "./relion/dispatch";

/**
 * t380 — the import job's "negative stain" checkbox pins display polarity
 * for every downstream render of that dataset.
 *
 * Physics: cryo particles are NEGATIVE density (denser protein than ice →
 * dark in raw micrographs, below-mean in class averages) — the auto
 * heuristic flips them to the familiar bright-on-black. Negative-stain
 * particles are POSITIVE density (bright voids in the dark metal sea) —
 * the direct stretch already shows them bright, so the flip must never
 * fire. The checkbox exists so the user can TELL us which physics the
 * dataset has instead of trusting the auto-detect in ambiguous cases.
 */

const IMPORT_TYPES = new Set(["import", "tomo_import"]);

/** Parse the flag out of a job's stored params JSON (miss → "auto"). */
export function polarityFromParams(raw: string | null | undefined): MrcPolarity {
  try {
    const p = raw ? JSON.parse(raw) : {};
    if (p && typeof p === "object" && (p as Record<string, unknown>).negativeStain === true) {
      return "negativeStain";
    }
  } catch {
    // corrupt params JSON — the auto heuristic is the honest fallback
  }
  return "auto";
}

/**
 * Resolve the display polarity for a render request: the job's own params
 * when it IS the import, else the nearest import ancestor in the wired
 * lineage (same BFS micAngpix already uses). "auto" when no import speaks.
 *
 * Cheap by design: one lineageFor walk per route call (a couple of indexed
 * DB reads), and every PNG produced under it is cached by the iteration /
 * preview layers anyway.
 */
export async function displayPolarityFor(job: {
  id: string;
  type: string;
  params: string | null;
}): Promise<MrcPolarity> {
  if (IMPORT_TYPES.has(job.type)) return polarityFromParams(job.params);
  const lineage = await lineageFor(job.id);
  const imp = lineage.find((u) => IMPORT_TYPES.has(u.type));
  return imp ? polarityFromParams(JSON.stringify(imp.params ?? {})) : "auto";
}

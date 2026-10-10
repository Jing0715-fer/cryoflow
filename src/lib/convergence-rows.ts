/**
 * CryoFlow — the convergence reading's row grammar (t470).
 *
 * t454 built the convergence face, t456 the arc face — both read their
 * numbers through ROUTES (classes ?iter=, iterations, resolution-arc).
 * t469's law (one parse, many faces) now reaches the convergence family:
 * the agent's check_convergence reads the SAME rounds through the SAME
 * grammar, extracted here so the route and the tool cannot drift.
 *
 *   - THE LADDER IS THE MIRROR'S OWN: run_itNNN_data.star names, the
 *     iterations route's DATA_STAR_RE verbatim, ascending. No witness
 *     check on the ladder itself (the route's ladder has none either) —
 *     a half-written round fails its occupancy read honestly instead.
 *   - ONE ROUND'S OCCUPANCY IS THE PARTICLES LOOP: the same law the
 *     classes route and classStatsFromWorkdir speak — count rows inside
 *     the loop that owns _rlnClassNumber, never the optics rows above.
 *   - THE ARC IS THE ROUTE'S OWN SCAN: run_itNNN_half1_model.star (gold)
 *     / run_itNNN_model.star (serial), _rlnCurrentResolution per round —
 *     extracted verbatim from the resolution-arc route so the route slims
 *     to guard + shape and the tool inherits the identical points.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseStar } from "@/lib/starfile";
import { classRunRow, type ClassRunRow } from "@/lib/class-compare";
import {
  parseCurrentResolution,
  type ResolutionPoint,
} from "@/lib/resolution-arc";

/** The iterations route's ladder regex, mirrored verbatim. */
const DATA_STAR_RE = /^(?:run_it|_it)(\d+)_data\.star$/i;

/** The round ladder: every data star's iteration, ascending, deduped —
 *  the same list the iterations route serves its pickers. Empty when the
 *  workdir is missing or cold (an honest empty, never a guess). */
export function workdirRounds(workdir: string): number[] {
  let names: string[] = [];
  try {
    if (!existsSync(workdir)) return [];
    names = readdirSync(workdir);
  } catch {
    return [];
  }
  const rounds = new Set<number>();
  for (const n of names) {
    const m = DATA_STAR_RE.exec(n);
    if (m) rounds.add(Number(m[1]));
  }
  return [...rounds].sort((a, b) => a - b);
}

/** The exact data star of one round — the classes route's ?iter= lane
 *  speaks the same name dialect (run_itNNN and _itNNN both live in real
 *  mirrors). Null when the round never wrote a data star. */
export function roundDataStarName(
  names: string[],
  round: number,
): string | null {
  const re = new RegExp(
    `^(?:run_it|_it)${String(round).padStart(3, "0")}_data\\.star$`,
    "i",
  );
  return names.find((n) => re.test(n)) ?? null;
}

/** One round's occupancy — count _rlnClassNumber rows inside the loop
 *  that owns them (the optics-group row above the particles loop must
 *  never inflate a class). Rows speak ClassRunRow, the compare family's
 *  own shape, so the census brain joins them untouched. Null when the
 *  round has no data star (the caller says so honestly). */
export function roundOccupancy(
  workdir: string,
  round: number,
): { classes: ClassRunRow[]; total: number } | null {
  let names: string[] = [];
  try {
    names = readdirSync(workdir);
  } catch {
    return null;
  }
  const file = roundDataStarName(names, round);
  if (!file) return null;
  try {
    const parsed = parseStar(readFileSync(path.join(workdir, file), "utf8"));
    let loop: { columns: string[]; rows: string[][] } | null = null;
    for (const b of parsed.blocks) {
      if (b.loop && b.loop.columns.includes("_rlnClassNumber")) {
        loop = b.loop;
        break;
      }
    }
    if (!loop) {
      for (const b of parsed.blocks) {
        if (b.loop && b.loop.columns.some((c) => c.startsWith("_rlnClassNumber"))) {
          loop = b.loop;
          break;
        }
      }
    }
    if (!loop) return { classes: [], total: 0 };
    const col = loop.columns.findIndex((c) => c.startsWith("_rlnClassNumber"));
    const counts = new Map<number, number>();
    let total = 0;
    for (const row of loop.rows) {
      const cls = parseInt(row[col] ?? "", 10);
      if (Number.isFinite(cls) && cls > 0) {
        counts.set(cls, (counts.get(cls) ?? 0) + 1);
        total++;
      }
    }
    const classes = [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([cls, count]) =>
        classRunRow({ cls, count, fraction: total > 0 ? count / total : 0 }),
      );
    return { classes, total };
  } catch {
    /* an unreadable round speaks as empty — the census refuses honestly */
    return { classes: [], total: 0 };
  }
}

/** The resolution arc straight from the workdir — the resolution-arc
 *  route's scan, lib-shaped (t469's route-slimming law, third home).
 *  Gold half1 models outrank plain models round-by-round by the route's
 *  own regex; rounds without the estimate column never join. */
export function resolutionArcFromWorkdir(workdir: string): ResolutionPoint[] {
  if (!existsSync(workdir)) return [];
  const points: ResolutionPoint[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(workdir);
  } catch {
    return [];
  }
  for (const name of names) {
    const m = name.match(/^run_it(\d+)_(half1_)?model\.star$/i);
    if (!m) continue;
    try {
      const res = parseCurrentResolution(
        readFileSync(path.join(workdir, name), "utf8"),
      );
      if (res == null) continue;
      points.push({
        iteration: Number(m[1]),
        resolution: res,
        source: m[2] ? "half1" : "model",
      });
    } catch {
      /* an unreadable round is not an arc point */
    }
  }
  return points;
}

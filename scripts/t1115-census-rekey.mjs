/**
 * t1115 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 66
 * (t1111-direction-dial-unit) grows 29 → 38: the direction walk's
 * EXPORT closed the walk-page family's last honest gap — E1..E9 (the
 * filename grammar's computed calls, the fraction dialect born in,
 * the page-4 seats' third face, ONE button, the extent word, the
 * family's grid measures) + U4 re-key 2→3 (the ONE plan's third
 * rider), nine reasons named. The array is positional — seat 66's
 * value is the FIRST 29 in the tail "… 19 29 31 29)" (19 = seat 65
 * t1109, 29 = seat 66 t1111, 31 = seat 67 t1112, 29 = seat 68 t1113).
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const OLD_TAIL = "19 29 31 29)";
const NEW_TAIL = "19 38 31 29)";
const count = src.split(OLD_TAIL).length - 1;
if (count === 0 && src.includes(NEW_TAIL)) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}
if (count !== 1) {
  console.error(`FATAL: the anchor "… 19 29 31 29)" appears ${count} times (want 1)`);
  process.exit(1);
}

const REASON_OLD =
  "+seat 66 = t1111-direction-dial-unit (29 pins, the direction dial — the cut's azimuth ladder + the angular mark's wrap law);";
const REASON_NEW =
  "+seat 66 = t1111-direction-dial-unit (38 pins, the direction dial — the cut's azimuth ladder + the angular mark's wrap law; t1115 re-key 29→38: the direction walk's EXPORT closed the walk-page family's last honest gap — E1..E9 (the filename grammar's computed calls, the fraction dialect born in, the page-4 seats' third face, ONE button, the extent word, the family's grid measures) + U4 re-key 2→3 (the ONE plan's third rider — the dial, the paper, the document), nine reasons named);";

if (!src.includes(REASON_OLD)) {
  console.error("FATAL: the reason anchor is missing — the roster comment moved");
  process.exit(1);
}

const out = src.replace(OLD_TAIL, NEW_TAIL).replace(REASON_OLD, REASON_NEW);
writeFileSync(P, out);
console.log("re-keyed: seat 66 29 → 38, reason named");

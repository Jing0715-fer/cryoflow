#!/usr/bin/env node
/**
 * t1156 — the a11y census trio's re-key: t982 / t998 / t999 read the
 * SAME receipt t1002 reads (population + stateful), and the receipt
 * moved +2/+2 when the t1156 audit counted the untracked faces in
 * (the fleet trend card's gated rows). The text-surgery law: anchors
 * matched before replaced, idempotent by the new numbers' presence.
 */
import { readFileSync, writeFileSync } from "node:fs";

const TRIO = [
  ["scripts/t982-aria-refusal-unit.mjs", "A2", "A3"],
  ["scripts/t998-workspace-rename-unit.mjs", "B22", "B23"],
  ["scripts/t999-pointer-wall-echo-unit.mjs", "C2", "C3"],
];

const POP_NOTE = "; +2 the t1156 audit's untracked faces counted in — the fleet trend card's gated rows join the roster)";
const ST_NOTE = "; +2 from the t1156 audit's untracked faces (the fleet trend card's own stateful pair))";

for (const [f, popTag, stTag] of TRIO) {
  let s = readFileSync(f, "utf8");
  if (s.includes("population === 178") && s.includes("stateful === 156")) {
    console.log(`${f}: already re-keyed — idempotent exit`);
    continue;
  }
  const anchors = [
    [`${popTag} population = 176`, `${popTag} population = 178`],
    ["population === 176", "population === 178"],
    [`${stTag} stateful = 154`, `${stTag} stateful = 156`],
    ["stateful === 154", "stateful === 156"],
  ];
  for (const [oldA, newA] of anchors) {
    if (!s.includes(oldA)) {
      console.error(`${f}: anchor missing: ${oldA}`);
      process.exit(1);
    }
    s = s.replace(oldA, newA);
  }
  // the +2 confession rides each re-keyed label (the population note
  // lands inside the gate list's closing paren; the stateful note at
  // the state list's own close).
  s = s.replace(
    "the cut's density face rides behind its own disabled until the cut is on)",
    "the cut's density face rides behind its own disabled until the cut is on" + POP_NOTE
  );
  s = s.replace(
    "the t1129 sheet face's gated state)",
    "the t1129 sheet face's gated state" + ST_NOTE
  );
  writeFileSync(f, s);
  console.log(`${f}: re-keyed 176→178 · 154→156 (+2 confessions drawn)`);
}

#!/usr/bin/env node
/**
 * t1107 — THE WALK'S "YOU ARE HERE": the current mark.
 *
 * The walks sweep the axis's whole support, but nothing on the document
 * said where the reader was standing. The mark ties the walk back to
 * the live view: each strip rings the frame nearest the tile's own
 * current plane — on the plate's page 3 (the ring rides the AXIS_LABEL
 * father, decorative, the legend names it in words) and on the screen
 * export's canvas (the same seat, the header legend names it there).
 *
 * 22 pins in four bands:
 *   P the seat's math (10) — the exact hit, the nearest between stops,
 *     the tie resolving toward the face the walk reads first (the LOWER
 *     index — strictly-smaller-wins keeps it), the honest nulls (null,
 *     undefined, NaN, empty frames), the whole-ladder answer for the
 *     six-stop plan at the tile's own positions (0.5 default, the
 *     faces, the quarter planes), purity of the inputs.
 *   U the legend's words (3) — the byte form ("the colored ring marks
 *     each walk's current tile plane"), the ONE seat (no second legend
 *     dialect), the plate lib's purity (no fs / db / clock).
 *   W the wiring (9) — the panel speaks the seat exactly four times
 *     (three strips + the export's canvas — one decider, no inline
 *     nearest-math); the strips' mark rides positions (the tiles' own
 *     state, the t278 focus point); the ring rides the conditional
 *     border-2 with the AXIS_LABEL father's color (decorative,
 *     non-text — no new ink invented); the unmarked frame keeps the
 *     honest /15 border; the legend <p> rides the word fn; the export
 *     rides the tile's own pos (current={pos} — the live slider, the
 *     readout's own value); the canvas ring rides the same father;
 *     the canvas header names the mark ("ring marks the current
 *     plane"); the strip lib's purity (no fs / db / clock).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ORTHO_FILMSTRIP_FRAMES,
  orthoWalkCurrentIndex,
  planOrthoFilmstrip,
} from "@/lib/ortho-filmstrip";
import { orthoPlateWalkCurrentLegend } from "@/lib/ortho-plate";

let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    console.log(`  RED ${name}`);
  }
};

const ROOT = join(import.meta.dirname, "..");
const panelSrc = readFileSync(
  join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"),
  "utf8"
);
const stripLib = readFileSync(
  join(ROOT, "src/lib/ortho-filmstrip.ts"),
  "utf8"
);
const plateLib = readFileSync(join(ROOT, "src/lib/ortho-plate.ts"), "utf8");

// ---- P — the seat's math -----------------------------------------------

// P1 — the exact hit (a frame's own pos answers itself)
{
  const frames = [{ pos: 0 }, { pos: 0.5 }, { pos: 1 }];
  ok(
    "P1 the exact hit answers its own frame (pos 0.5 → index 1)",
    orthoWalkCurrentIndex(frames, 0.5) === 1
  );
}

// P2 — the nearest between stops, ties toward the earlier face (the
// six-stop ladder at the tile's default: 0.5 is EXACTLY the midpoint
// of 0.4/0.6 — the t1106 lesson ("the ladder has no midpoint") cut the
// OTHER way: the stops straddle 0.5, the mark resolves the tie by the
// walk's own reading direction — the lower index, P3's law)
{
  const plan = planOrthoFilmstrip("z", 64);
  ok(
    "P2 the nearest between stops (0.5 on the six-stop ladder → index 2 — 0.5 is the exact midpoint of 0.4/0.6, the tie rides the reading direction: the lower index, P3's law)",
    orthoWalkCurrentIndex(plan.frames, 0.5) === 2
  );
}

// P3 — the tie resolves toward the face the walk reads first (the
// LOWER index: strictly-smaller-wins keeps the earlier frame)
{
  const frames = [{ pos: 0.4 }, { pos: 0.6 }];
  ok(
    "P3 the tie (0.5 exactly between two stops) resolves toward the face the walk reads first (the lower index — 0)",
    orthoWalkCurrentIndex(frames, 0.5) === 0
  );
}

// P4 — the faces: a current plane at the box's edge answers the face
// frame
{
  const plan = planOrthoFilmstrip("y", 32);
  ok(
    "P4 the faces answer themselves (current 0 → the first frame, current 1 → the last)",
    orthoWalkCurrentIndex(plan.frames, 0) === 0 &&
      orthoWalkCurrentIndex(plan.frames, 1) === plan.frames.length - 1
  );
}

// P5 — the honest nulls: null, undefined and NaN current — no mark, no
// invented plane
{
  const frames = [{ pos: 0 }, { pos: 1 }];
  ok(
    "P5 the honest silences (null / undefined / NaN current → null — the mark never invents a plane)",
    orthoWalkCurrentIndex(frames, null) === null &&
      orthoWalkCurrentIndex(frames, undefined) === null &&
      orthoWalkCurrentIndex(frames, NaN) === null
  );
}

// P6 — the honest silence for an empty walk
ok(
  "P6 an empty walk stays unmarked (no frames → null)",
  orthoWalkCurrentIndex([], 0.5) === null
);

// P7 — the whole ladder, tile's own positions: the six answers at the
// quarter planes (each quarter rides its nearer stop)
{
  const plan = planOrthoFilmstrip("x", 64);
  const answers = [0, 0.25, 0.5, 0.75, 1].map((c) =>
    orthoWalkCurrentIndex(plan.frames, c)
  );
  ok(
    "P7 the ladder's answers at the quarter planes ([0,1,2,4,5] — each position rides its nearer stop, 0.5's tie rides the reading direction, the faces inclusive)",
    JSON.stringify(answers) === JSON.stringify([0, 1, 2, 4, 5])
  );
}

// P8 — the seat is pure: the frames it reads are never mutated
{
  const frames = [{ pos: 0 }, { pos: 1 }];
  const before = JSON.stringify(frames);
  orthoWalkCurrentIndex(frames, 0.9);
  ok(
    "P8 the seat is pure (the input frames survive byte-identical)",
    JSON.stringify(frames) === before
  );
}

// P9 — the mark rides the plan's OWN frame objects (the plan and the
// mark can never disagree about the ladder)
{
  const plan = planOrthoFilmstrip("z", 64);
  ok(
    "P9 the seat rides the plan's own frames (the same objects the captions speak — one ladder, no second geometry)",
    orthoWalkCurrentIndex(plan.frames, 0.2) === 1 &&
      plan.frames.length === ORTHO_FILMSTRIP_FRAMES
  );
}

// P10 — out-of-range currents still answer (a fraction the slider
// clamps before it reaches here; the seat itself stays total)
{
  const plan = planOrthoFilmstrip("z", 64);
  ok(
    "P10 out-of-range currents stay total (-0.4 → the first frame, 1.7 → the last — the slider's clamp is upstream, the seat does not guess)",
    orthoWalkCurrentIndex(plan.frames, -0.4) === 0 &&
      orthoWalkCurrentIndex(plan.frames, 1.7) === plan.frames.length - 1
  );
}

// ---- U — the legend's words --------------------------------------------

// U1 — the byte form (one sentence, the plate's own mono voice)
ok(
  'U1 the legend\'s byte form ("the colored ring marks each walk\'s current tile plane")',
  orthoPlateWalkCurrentLegend() ===
    "the colored ring marks each walk's current tile plane"
);

// U2 — the ONE legend seat (the plate lib speaks it once — no second
// legend dialect)
ok(
  "U2 the legend is the ONE seat (the plate lib speaks the sentence exactly once)",
  (plateLib.match(/the colored ring marks each walk's current tile plane/g) || [])
    .length === 1
);

// U3 — the plate lib stays pure (no fs / db / clock in the family the
// legend joins)
ok(
  "U3 the plate lib stays pure (no fs/db import in ortho-plate.ts — the words are words)",
  !/from ["']node:fs|from ["']fs|prisma|new Date\(\)/.test(plateLib)
);

// ---- W — the wiring ----------------------------------------------------

// W1 — the panel speaks the seat exactly four times: three strips +
// the export's canvas (ONE decider, no inline nearest-math)
ok(
  "W1 the seat is the ONE decider (orthoWalkCurrentIndex spoken exactly four times — three strips + the export's canvas)",
  (panelSrc.match(/orthoWalkCurrentIndex\(/g) || []).length === 4
);

// W2 — the strips' mark rides positions (the tiles' own state — the
// t278 focus point, no second channel)
ok(
  "W2 the mark rides the tiles' own state (positions.z / positions.y / positions.x — the t278 focus point)",
  /orthoWalkCurrentIndex\(axisWalkPlans\.z\.frames, positions\.z\)/.test(panelSrc) &&
    /orthoWalkCurrentIndex\(axisWalkPlans\.y\.frames, positions\.y\)/.test(panelSrc) &&
    /orthoWalkCurrentIndex\(axisWalkPlans\.x\.frames, positions\.x\)/.test(panelSrc)
);

// W3 — the ring rides the conditional border-2 (the marked frame wears
// the father's color; decorative, non-text — no new ink invented)
{
  const axisAt = panelSrc.indexOf("data-ortho-plate-axis-walks");
  const block = panelSrc.slice(axisAt, axisAt + 3200);
  ok(
    "W3 the ring rides the AXIS_LABEL father (borderColor: AXIS_LABEL[spec.axis] under the marked conditional — the strip border's sibling, no new ink)",
    /i === axisWalkCurrent\[spec\.axis\]/.test(block) &&
      /borderColor: AXIS_LABEL\[spec\.axis\]/.test(block)
  );
}

// W4 — the unmarked frame keeps the honest /15 border (the mark adds,
// it never takes)
{
  const axisAt = panelSrc.indexOf("data-ortho-plate-axis-walks");
  const block = panelSrc.slice(axisAt, axisAt + 3200);
  ok(
    'W4 the unmarked frame keeps the honest border ("border border-foreground/15" under the else face)',
    /: "border border-foreground\/15"/.test(block)
  );
}

// W5 — the legend <p> rides the word fn (no inline sentence)
{
  const axisAt = panelSrc.indexOf("data-ortho-plate-axis-walks");
  const block = panelSrc.slice(axisAt, axisAt + 800);
  ok(
    "W5 the legend rides the ONE word fn (orthoPlateWalkCurrentLegend() — the panel never re-states the sentence)",
    block.includes("{orthoPlateWalkCurrentLegend()}") &&
      !/the colored ring marks/.test(panelSrc.slice(panelSrc.indexOf("data-ortho-plate-axis-walks")))
  );
}

// W6 — the export rides the tile's own pos (the live slider's value —
// the readout's own number, no debounced shadow)
ok(
  "W6 the export rides the tile's own position (current={pos} — the live slider, the readout's own value)",
  panelSrc.includes(
    "<OrthoFilmstripButton jobId={jobId} path={path} spec={spec} dim={dim} current={pos} />"
  )
);

// W7 — the canvas rides the same seat (the plan's own frames + the
// prop — the export and the paper can never disagree)
ok(
  "W7 the canvas rides the ONE seat (orthoWalkCurrentIndex(plan.frames, current) before any pixel)",
  /orthoWalkCurrentIndex\(plan\.frames, current\)/.test(panelSrc)
);

// W8 — the canvas ring rides the same father (AXIS_LABEL under the
// marked conditional — the header's voice color)
ok(
  "W8 the canvas ring rides the AXIS_LABEL father (strokeStyle: AXIS_LABEL[spec.axis] under if (i === currentIdx))",
  /if \(i === currentIdx\) \{\s*ctx\.strokeStyle = AXIS_LABEL\[spec\.axis\]/.test(panelSrc)
);

// W9 — the canvas header names the mark (the standalone document tells
// its reader what the ring means)
ok(
  'W9 the canvas header names the mark ("ring marks the current plane" in the header line)',
  panelSrc.includes("ring marks the current plane") &&
    /frames\$\{currentIdx != null \? " \\u00b7 ring marks the current plane" : ""\}/.test(panelSrc)
);

// ---- receipts -----------------------------------------------------------

console.log(`\n${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

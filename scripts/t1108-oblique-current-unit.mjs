#!/usr/bin/env node
/**
 * t1108 — THE CUT WALK'S "YOU ARE HERE": the oblique current mark.
 *
 * t1107 taught the axis walks to name the reader's plane (page 3's
 * rings); the cut's own walk (page 2) stayed unmarked — the one page
 * whose answer is the most personal ("where am I on MY walk?"). The
 * mark: the frame nearest the cut's own offset wears the block's
 * violet, on the paper and on the export — the t1107 law re-derived in
 * the oblique dialect (the sibling walk libs mirror their laws, never
 * share code).
 *
 * 22 pins in three bands:
 *   P the seat's math (10) — the tie at the default (offset 0 is the
 *     exact midpoint of −0.2/+0.2 → the LOWER index 2, the reading
 *     direction's own answer), the exact hit (+0.2 → index 3), the
 *     quarters' whole-ladder answer ([0,1,2,4,5] — the ortho seat's own
 *     shape, mirrored), the faces (±1 inclusive), the out-of-range
 *     totality (the slider's clamp is upstream, the seat does not
 *     guess), the honest nulls (null / undefined / NaN / empty), the
 *     purity of the inputs.
 *   U the legend's words (3) — the byte form ("the colored ring marks
 *     the cut's own plane on this walk"), the ONE seat beside its
 *     t1107 sibling (two dialects, never one blurred word), the plate
 *     lib's purity (no fs / db / clock).
 *   W the wiring (9) — the panel speaks the seat exactly three times
 *     (page 2's wiring + the export's canvas + the t1109 walk dial —
 *     ONE decider, no inline nearest-math); the mark rides the cut's
 *     own offset under the
 *     walkPlan guard (no live cut → no page → no mark: the honest
 *     absence on both faces at once); the ring rides the conditional
 *     border-2 with EXPORT_OBLIQUE_ACCENT (the block's own violet — no
 *     new ink invented); the unmarked frame keeps the honest /15
 *     border; the legend <p> rides the word fn; the export rides
 *     live.offset / 100 (the t1109 re-key: the seat speaks the scene's
 *     fraction dialect, the slider speaks the block's percent dialect —
 *     the raw percent read the seat past the tie band); the canvas ring
 *     rides the same father under if (i === currentIdx); the canvas
 *     header names the mark ("ring marks the cut's plane"); the
 *     oblique lib's purity (no fs / db / clock).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FILMSTRIP_FRAMES,
  obliqueWalkCurrentIndex,
  planObliqueFilmstrip,
} from "@/lib/oblique-filmstrip";
import { orthoPlateObliqueCurrentLegend } from "@/lib/ortho-plate";

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
const obliqueLib = readFileSync(
  join(ROOT, "src/lib/oblique-filmstrip.ts"),
  "utf8"
);
const plateLib = readFileSync(join(ROOT, "src/lib/ortho-plate.ts"), "utf8");

// ---- P — the seat's math -----------------------------------------------

// P1 — the tie at the default: the cut's offset 0 is the EXACT midpoint
// of −0.2/+0.2 — the mark resolves toward the face the walk reads first
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  ok(
    "P1 the default cut (offset 0) marks index 2 (0 is the exact midpoint of −0.2/+0.2 — the tie rides the reading direction, the t1107 law's oblique mirror)",
    obliqueWalkCurrentIndex(plan.frames, 0) === 2
  );
}

// P2 — the exact hit (a frame's own frac answers itself)
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  ok(
    "P2 the exact hit answers its own frame (offset +0.2 → index 3)",
    obliqueWalkCurrentIndex(plan.frames, 0.2) === 3
  );
}

// P3 — the quarters' whole-ladder answer (the ortho seat's own shape,
// mirrored in the oblique dialect)
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  const answers = [-1, -0.5, 0, 0.5, 1].map((c) =>
    obliqueWalkCurrentIndex(plan.frames, c)
  );
  ok(
    "P3 the ladder's answers at the quarters ([0,1,2,4,5] — each offset rides its nearer stop, 0's tie rides the reading direction, the faces inclusive)",
    JSON.stringify(answers) === JSON.stringify([0, 1, 2, 4, 5])
  );
}

// P4 — the faces: the walk's own ends answer themselves
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  ok(
    "P4 the faces answer themselves (offset −1 → the first frame, +1 → the last — the ladder is face to face inclusive)",
    obliqueWalkCurrentIndex(plan.frames, -1) === 0 &&
      obliqueWalkCurrentIndex(plan.frames, 1) === plan.frames.length - 1
  );
}

// P5 — the honest nulls: null, undefined and NaN offset — no mark, no
// invented plane
{
  const frames = [{ frac: -1 }, { frac: 1 }];
  ok(
    "P5 the honest silences (null / undefined / NaN offset → null — the mark never invents a plane)",
    obliqueWalkCurrentIndex(frames, null) === null &&
      obliqueWalkCurrentIndex(frames, undefined) === null &&
      obliqueWalkCurrentIndex(frames, NaN) === null
  );
}

// P6 — the honest silence for an empty walk
ok(
  "P6 an empty walk stays unmarked (no frames → null)",
  obliqueWalkCurrentIndex([], 0) === null
);

// P7 — out-of-range offsets still answer (the slider clamps upstream;
// the seat itself stays total)
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  ok(
    "P7 out-of-range offsets stay total (−1.7 → the first frame, +1.7 → the last)",
    obliqueWalkCurrentIndex(plan.frames, -1.7) === 0 &&
      obliqueWalkCurrentIndex(plan.frames, 1.7) === plan.frames.length - 1
  );
}

// P8 — the seat is pure: the frames it reads are never mutated
{
  const frames = [{ frac: -0.2 }, { frac: 0.2 }];
  const before = JSON.stringify(frames);
  obliqueWalkCurrentIndex(frames, 0);
  ok(
    "P8 the seat is pure (the input frames survive byte-identical)",
    JSON.stringify(frames) === before
  );
}

// P9 — the mark rides the plan's OWN frame objects (the plan and the
// mark can never disagree about the ladder)
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  ok(
    "P9 the seat rides the plan's own frames (the same objects the captions speak — one ladder, no second geometry)",
    obliqueWalkCurrentIndex(plan.frames, -0.9) === 0 &&
      plan.frames.length === FILMSTRIP_FRAMES
  );
}

// P10 — the mark answers in the plan's own ORDER (index 4 = +60%: the
// caption the marked frame wears is the plan's own pct voice)
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  const idx = obliqueWalkCurrentIndex(plan.frames, 0.5);
  ok(
    "P10 the marked frame wears the plan's own voice (offset 0.5 → index 4, whose pctLabel is +60%)",
    idx === 4 && plan.frames[idx].pctLabel === "+60%"
  );
}

// ---- U — the legend's words --------------------------------------------

// U1 — the byte form (one sentence, the plate's own mono voice)
ok(
  'U1 the legend\'s byte form ("the colored ring marks the cut\'s own plane on this walk")',
  orthoPlateObliqueCurrentLegend() ===
    "the colored ring marks the cut's own plane on this walk"
);

// U2 — the ONE seat beside its t1107 sibling (two dialects — the tiles'
// sentence and the cut's sentence stay distinct words)
ok(
  "U2 the two legends are distinct seats (the oblique sentence never blurs into the tiles' sentence)",
  (plateLib.match(/the colored ring marks/g) || []).length === 2 &&
    plateLib.includes("the colored ring marks each walk's current tile plane")
);

// U3 — the plate lib stays pure (no fs / db / clock in the family the
// legend joins)
ok(
  "U3 the plate lib stays pure (no fs/db import in ortho-plate.ts — the words are words)",
  !/from ["']node:fs|from ["']fs|prisma|new Date\(\)/.test(plateLib)
);

// ---- W — the wiring ----------------------------------------------------

// W1 — the panel speaks the seat exactly THREE times: page 2's wiring +
// the export's canvas + the walk dial (the t1109 re-key: the ring's
// third face joins the ONE decider — three faces, one answer, no inline
// nearest-math)
ok(
  "W1 the seat is the ONE decider (obliqueWalkCurrentIndex spoken exactly three times — page 2's wiring + the export's canvas + the t1109 walk dial)",
  (panelSrc.match(/obliqueWalkCurrentIndex\(/g) || []).length === 3
);

// W2 — the mark rides the cut's own offset under the walkPlan guard
// (no live cut → no page → no mark: the honest absence on both faces)
ok(
  "W2 the mark rides the cut's own offset, guarded (walkPlan && plateOblique → the seat; else null)",
  /const walkCurrent =\s*\n\s*walkPlan && plateOblique\s*\n\s*\? obliqueWalkCurrentIndex\(walkPlan\.frames, plateOblique\.offset\)/.test(panelSrc)
);

// W3 — the ring rides the conditional border-2 with the block's own
// violet (EXPORT_OBLIQUE_ACCENT — the header's voice color, no new ink)
{
  const walkAt = panelSrc.indexOf("data-ortho-plate-walk");
  const block = panelSrc.slice(walkAt, walkAt + 3400);
  ok(
    "W3 the ring rides the violet father (borderColor: EXPORT_OBLIQUE_ACCENT under the marked conditional — the block's own ink)",
    /i === walkCurrent/.test(block) &&
      /borderColor: EXPORT_OBLIQUE_ACCENT/.test(block)
  );
}

// W4 — the unmarked frame keeps the honest /15 border (the mark adds,
// it never takes)
{
  const walkAt = panelSrc.indexOf("data-ortho-plate-walk");
  const block = panelSrc.slice(walkAt, walkAt + 3400);
  ok(
    'W4 the unmarked frame keeps the honest border ("border border-foreground/15" under the else face)',
    /: "border border-foreground\/15"/.test(block)
  );
}

// W5 — the legend <p> rides the word fn (no inline sentence)
{
  const walkAt = panelSrc.indexOf("data-ortho-plate-walk");
  const block = panelSrc.slice(walkAt, walkAt + 1200);
  ok(
    "W5 the legend rides the ONE word fn (orthoPlateObliqueCurrentLegend() — the panel never re-states the sentence)",
    block.includes("{orthoPlateObliqueCurrentLegend()}") &&
      !/the colored ring marks the cut's own plane/.test(
        panelSrc.slice(panelSrc.indexOf("data-ortho-plate-walk"))
      )
  );
}

// W6 — the export rides live.offset / 100 (the t1109 re-key: the seat
// speaks FRACTION (−1…+1), the block's live offset speaks PERCENT
// (−100…+100) — the raw percent misread the seat past the tie band (a
// cut at +12% wore the +100% frame's ring); the /100 is the boundary's
// own translation, the two-scales precedent (readout = voxel names,
// mark = fraction choices) landing in code)
ok(
  "W6 the canvas rides the block's own live offset through the fraction translation (obliqueWalkCurrentIndex(plan.frames, live.offset / 100) — the t1109 two-scales cure)",
  /obliqueWalkCurrentIndex\(plan\.frames, live\.offset \/ 100\)/.test(panelSrc)
);

// W7 — the canvas ring rides the same father under the marked
// conditional (EXPORT_OBLIQUE_ACCENT, 2px inside the tile's border)
ok(
  "W7 the canvas ring rides the violet father (strokeStyle: EXPORT_OBLIQUE_ACCENT under if (i === currentIdx))",
  /if \(i === currentIdx\) \{\s*ctx\.strokeStyle = EXPORT_OBLIQUE_ACCENT/.test(
    panelSrc
  )
);

// W8 — the canvas header names the mark (the standalone document tells
// its reader what the ring means)
ok(
  'W8 the canvas header names the mark ("ring marks the cut\'s plane" in the header line)',
  panelSrc.includes("ring marks the cut's plane") &&
    /frames\$\{currentIdx != null \? " \\u00b7 ring marks the cut's plane" : ""\}/.test(
      panelSrc
    )
);

// W9 — the oblique lib stays pure (no fs / db / clock in the lib the
// seat joins)
ok(
  "W9 the oblique lib stays pure (no fs/db import in oblique-filmstrip.ts — the walk's geometry is pure math)",
  !/from ["']node:fs|from ["']fs|prisma|new Date\(\)/.test(obliqueLib)
);

// ---- receipts -----------------------------------------------------------

console.log(`\n${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

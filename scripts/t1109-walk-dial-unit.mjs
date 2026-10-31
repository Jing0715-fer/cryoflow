/**
 * t1109 — the walk DIAL unit: the cut's walk gains its LIVE screen face
 * (the ring's third face), and the two-scales bug the dial's birth
 * exposed gets its cure and its autopsy.
 *
 * The story: t1108 gave the walk its "you are here" on the export
 * canvas and the paper's page 2 — both decided by ONE frac seat
 * (obliqueWalkCurrentIndex). But the export rode the block's raw live
 * offset — the slider's PERCENT dialect (−100…+100) — into a seat that
 * speaks the scene's FRACTION dialect (−1…+1). The t1108 QA escaped by
 * driving +2% only: at 0 the two scales agree (the tie), at the faces
 * they agree, and in between the raw percent dwarfs the fracs so the
 * seat answers the nearest FACE — the autopsy: raw percent answers
 * [2,5,5,5,5,5] for [0,2,12,40,60,100] (a cut at +12% wearing the
 * +100% frame's ring), while the translated dial answers
 * [2,3,3,3,4,5] — the ladder's own stops, every one true. This window:
 *   - the CURE: the export's seat call translates at the boundary
 *     (live.offset / 100 — the t1108 W6 pin re-keyed with the reason);
 *   - the DIAL: the strip's six stops join the offset slider's own
 *     neighborhood — a click walks the cut to that stop through
 *     scrubOffset (the slider's own door — no second channel), the
 *     current stop wears the block's violet (the t1108 mark's father,
 *     2px against the stops' 1px — the plate's marked/unmarked
 *     language mirrored onto the screen), the stops speak (each names
 *     its frame and its depth; the current one says so — aria-pressed
 *     + the "The cut's own plane" prefix);
 *   - the LAW: the stops ride the plan lib's own percent voice
 *     (f.offsetPct — ONE conversion, the lib's), the mark rides the
 *     hand's own offset through the boundary's translation, the seats
 *     are the ONE lib's two (planObliqueFilmstrip + the frac seat) —
 *     no inline ladder math, no new request dialect.
 *
 * Bands: P the two-scales law in numbers (the autopsy first — the
 * numbers computed before the pins, the t1107 lesson); U the cure's
 * receipts (the export's translation + the t1108 unit's re-key + the
 * dial's own translation); W the dial's wiring (group, speaking
 * stops, ring father, placement, seats, purity).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FILMSTRIP_FRAMES,
  obliqueWalkCurrentIndex,
  planObliqueFilmstrip,
} from "@/lib/oblique-filmstrip";

let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    console.log(`  RED ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const ROOT = join(import.meta.dirname, "..");
const panelSrc = readFileSync(
  join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"),
  "utf8"
);
const unit1108 = readFileSync(
  join(ROOT, "scripts/t1108-oblique-current-unit.mjs"),
  "utf8"
);

// ---- P — the two-scales law in numbers (the autopsy) --------------------

// P1 — the stops are the lib's own percent voice: ONE conversion, the
// lib's (Math.round(frac*100)), and the ladder is face-to-face inclusive
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  const pcts = plan.frames.map((f) => f.offsetPct);
  const fracs = plan.frames.map((f) => f.frac);
  ok(
    "P1 the stops ride the lib's own percent voice ([−100,−60,−20,20,60,100] — each Math.round(frac·100), the ladder's ends inclusive ±100)",
    FILMSTRIP_FRAMES === 6 &&
      JSON.stringify(pcts) === JSON.stringify([-100, -60, -20, 20, 60, 100]) &&
      fracs[0] === -1 &&
      fracs[fracs.length - 1] === 1 &&
      pcts.every((p, i) => p === Math.round(fracs[i] * 100))
  );
}

// P2 — the pct voices the stops print (the bytes the dial shows)
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  ok(
    'P2 the stops print the t907 pct voice bytes (["-100%","-60%","-20%","+20%","+60%","+100%"])',
    JSON.stringify(plan.frames.map((f) => f.pctLabel)) ===
      JSON.stringify(["-100%", "-60%", "-20%", "+20%", "+60%", "+100%"])
  );
}

// P3 — THE AUTOPSY: the raw percent misread the seat past the tie band.
// For every offset strictly between the faces and the tie the raw
// percent answers the nearest FACE — pinned as the bug's fingerprint,
// the shape that must never again live in a seat call.
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  const raw = [0, 2, 12, 40, 60, 100].map((p) =>
    obliqueWalkCurrentIndex(plan.frames, p)
  );
  ok(
    "P3 the raw percent's fingerprint ([2,5,5,5,5,5] for [0,2,12,40,60,100] — a cut at +12% wore the +100% frame's ring; only the tie and the faces agreed, which is how the +2%-only drive escaped)",
    JSON.stringify(raw) === JSON.stringify([2, 5, 5, 5, 5, 5])
  );
}

// P4 — the CURED answers: the boundary's translation (percent →
// fraction) makes every stop true — the ladder's own frames.
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  const dial = [0, 2, 12, 40, 60, 100].map((p) =>
    obliqueWalkCurrentIndex(plan.frames, p / 100)
  );
  ok(
    "P4 the translated answers ([2,3,3,3,4,5] — +2%/+12%/+40% all read +20%, +60% reads itself, the faces answer themselves; 0.4's tie rides the reading direction)",
    JSON.stringify(dial) === JSON.stringify([2, 3, 3, 3, 4, 5])
  );
}

// P5 — the negative side's mirror (the raw percent misread both ways)
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  const rawNeg = obliqueWalkCurrentIndex(plan.frames, -40);
  const dialNeg = obliqueWalkCurrentIndex(plan.frames, -40 / 100);
  ok(
    "P5 the negative mirror (−40% raw read −100% (index 0); translated reads −60% (index 1) — the honest −0.4 tie: |−0.6−(−0.4)| = |−0.2−(−0.4)|, the lower index wins)",
    rawNeg === 0 && dialNeg === 1
  );
}

// P6 — the tie at zero agrees in BOTH scales (why the t1108 default
// drive passed) — and the tie band's law: any offset in (0%, +20%) rides
// the +20% frame (the mark is coarser than the dial — the t1108 scale
// precedent's dial edition)
{
  const plan = planObliqueFilmstrip(45, 30, [32, 32, 32]);
  const band = [2, 4, 10, 18].map(
    (p) => obliqueWalkCurrentIndex(plan.frames, p / 100) === 3
  );
  ok(
    "P6 the tie at 0 agrees in both scales (index 2 either way); the (0%,+20%) band rides the +20% frame (the mark speaks the fraction scale — the t1108 precedent's own reading)",
    obliqueWalkCurrentIndex(plan.frames, 0) === 2 &&
      obliqueWalkCurrentIndex(plan.frames, 0) ===
        obliqueWalkCurrentIndex(plan.frames, 0 / 100) &&
      band.every(Boolean)
  );
}

// ---- U — the cure's receipts --------------------------------------------

// U1 — the export translates at the boundary (the t1109 cure): the seat
// call carries / 100, and the raw form is GONE
ok(
  "U1 the export's seat call carries the boundary translation (obliqueWalkCurrentIndex(plan.frames, live.offset / 100)) and the raw form is gone",
  /obliqueWalkCurrentIndex\(plan\.frames, live\.offset \/ 100\)/.test(panelSrc) &&
    !/obliqueWalkCurrentIndex\(plan\.frames, live\.offset\)/.test(panelSrc)
);

// U2 — the t1108 unit's W6 re-key receipt (the reason rides in the pin)
ok(
  "U2 the t1108 W6 pin is re-keyed with the two-scales reason (the unit's own receipt names the cure)",
  unit1108.includes("live\\.offset \\/ 100") &&
    unit1108.includes("the t1109 two-scales cure")
);

// U3 — the dial's mark rides the same translation (the hand's own
// offset, the boundary's law — born cured)
ok(
  "U3 the dial's mark translates at the boundary (obliqueWalkCurrentIndex(dialPlan.frames, offset / 100))",
  /obliqueWalkCurrentIndex\(dialPlan\.frames, offset \/ 100\)/.test(panelSrc)
);

// U4 — the stops ride the lib's own percent (scrubOffset(f.offsetPct) —
// ONE voice; no re-derived ladder: no f.frac * 100 anywhere in the panel)
ok(
  "U4 the stops walk through scrubOffset(f.offsetPct) — the lib's own percent, no re-derived ladder",
  /onClick=\{\(\) => scrubOffset\(f\.offsetPct\)\}/.test(panelSrc) &&
    !/f\.frac \* 100/.test(panelSrc)
);

// ---- W — the dial's wiring ----------------------------------------------

// W1 — the group speaks its sentence (role + data + aria-label naming
// the walk AND the ring)
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-walk-dial"');
  const block = at >= 0 ? panelSrc.slice(at - 220, at + 260) : "";
  ok(
    'W1 the dial is a named group (role="group" + aria-label naming the six stops and the ringed stop)',
    at >= 0 &&
      block.includes('role="group"') &&
      /aria-label="The cut's walk stops — six frames face to face along the normal; the ringed stop is the cut's own plane"/.test(
        block
      )
  );
}

// W2 — the state speaks: aria-pressed rides the mark's own conditional
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-walk-dial"');
  const block = at >= 0 ? panelSrc.slice(at, at + 1600) : "";
  ok(
    "W2 the stops' state speaks (aria-pressed={current} — the current stop says so)",
    /aria-pressed=\{current\}/.test(block)
  );
}

// W3 — the mark's name rides the current stop's label (the prefix) and
// every stop names its walk verb
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-walk-dial"');
  const block = at >= 0 ? panelSrc.slice(at, at + 1600) : "";
  ok(
    'W3 the current stop prefixes "The cut\'s own plane — " and every stop speaks the walk verb ("Walk the cut to … of the face-to-face span")',
    block.includes('"The cut\'s own plane — "') &&
      block.includes("Walk the cut to ${f.pctLabel} of the face-to-face span")
  );
}

// W4 — the ring rides the violet father (2px under the mark's
// conditional), the unmarked stops keep the 1px honest border — the
// plate's marked/unmarked language, zero new ink (no new hex)
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-walk-dial"');
  const block = at >= 0 ? panelSrc.slice(at, at + 1900) : "";
  ok(
    "W4 the ring is the violet father (border-2 border-violet-600 under current; unmarked keeps border-border/70; no new hex ink)",
    /current\s*\n\s*\?\s*"border-2 border-violet-600 bg-violet-600\/10 font-semibold text-violet-700 dark:text-violet-300"/.test(
      block
    ) &&
      block.includes("border-border/70") &&
      !/#[0-9a-fA-F]{3,8}/.test(block)
  );
}

// W5 — placement: the dial joins the offset slider's own neighborhood
// (after the oblique-offset Slider, before the action row's jump chip)
{
  const slider = panelSrc.indexOf('id="oblique-offset"');
  const dial = panelSrc.indexOf('data-canvas-ui="ortho-oblique-walk-dial"');
  const jump = panelSrc.indexOf('data-canvas-ui="ortho-oblique-jump"');
  ok(
    "W5 the dial lives in the offset slider's neighborhood (after the slider, before the action row)",
    slider >= 0 && dial > slider && jump > dial
  );
}

// W6 — the seats: the dial rides ONE plan (live θ/φ — the settled span)
// and the mark rides the hand's offset — the two ONE-lib seats, no
// inline ladder math in the panel
{
  const at = panelSrc.indexOf("const dialPlan");
  const block = at >= 0 ? panelSrc.slice(at, at + 340) : "";
  ok(
    "W6 the dial rides the ONE seats (planObliqueFilmstrip(live.theta, live.phi, dims) + the frac seat on offset / 100 — no inline ladder math)",
    /const dialPlan = planObliqueFilmstrip\(live\.theta, live\.phi, dims\)/.test(
      block
    ) &&
      /const dialCurrent = obliqueWalkCurrentIndex\(dialPlan\.frames, offset \/ 100\)/.test(
        block
      ) &&
      !/-1 \+ \(2 \* \w+\) \/ \(stops - 1\)/.test(panelSrc)
  );
}

// W7 — purity of the dial's face: no new request dialect, no new fetch
// (the stops walk the slider's own door; the doors' law — one channel)
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-walk-dial"');
  const end = panelSrc.indexOf('data-canvas-ui="ortho-oblique-jump"');
  const block = at >= 0 && end > at ? panelSrc.slice(at, end) : "";
  ok(
    "W7 the dial's face is channel-pure (no fetch, no /api/ — the walk rides scrubOffset only)",
    !/fetch\(/.test(block) && !/\/api\//.test(block)
  );
}

// W8 — the import family's receipt (the t1109 line grew on the
// oblique-filmstrip import)
ok(
  'W8 the import family grew the t1109 receipt ("t1109 — the walk dial rides the same two seats on the live screen")',
  panelSrc.includes("t1109 — the walk dial rides the same two seats on the live screen")
);

// W9 — the invitation speaks (the trace handles' wake language's word
// edition: the group's title names the export, the paper and the verb)
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-walk-dial"');
  const block = at >= 0 ? panelSrc.slice(at - 160, at + 420) : "";
  ok(
    'W9 the group\'s title speaks the invitation ("Click a stop to walk the cut there" — the frames the export prints and the paper wears)',
    block.includes("the frames the strip export prints and the paper's second page wear") &&
      block.includes("Click a stop to walk the cut there")
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

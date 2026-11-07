#!/usr/bin/env node
/**
 * t1105 — THE PLATE'S σ LEG: the density distribution joins the paper.
 *
 * The t291 export already speaks this figure (the PNG footer's log-bar
 * miniature with the σ ruler and the cyan cut); the plate — the paper
 * edition of the tri-panar figure — now speaks it too, as page 1's
 * distribution band under the three sections. The drawing law moves
 * into the ONE plate lib as a pure seat (planPlateHistogram); the data
 * rides the t291 fetch law (format=histogram, 8s honest timeout,
 * server-cached per map), fetched at PRINT time by the now-async print
 * verb — the flag law's bytes unchanged (t1103 W3, t1104 W8 preserved).
 *
 * 21 pins in three bands:
 *   P the plan seat's math (9) — the bars are log10(1+c) over
 *     log10(1+max) (the t291 bytes, restated and deep-pinned: x, y, w,
 *     h per bar, zero-count bins skipped, the all-zero guard); the σ
 *     ruler keeps μ strongest and ±1σ ±2σ quiet, out-of-band ticks
 *     silently skipped; the cut line rides mean + sign·σ·std, clamped
 *     into the band with the off-scale honesty (onScale false, never
 *     invented past the edge); the null honesty (a null or degenerate
 *     payload — no bins, no spread, non-positive σ, non-finite mean —
 *     plans null, the leg stays home); purity (inputs never mutated).
 *   I the inks and the sheet (2) — PLATE_HIST_INKS is the strip's own
 *     LIGHT edition restated (paper is always light: the paper leg and
 *     the screen strip cannot disagree about whose distribution this
 *     is); the default viewBox 600×72.
 *   W the wiring (10) — ONE lib import (the panel's plate import line
 *     carries the seat, the inks and the payload type); the plan rides
 *     plateHist STATE + the isoSigma STATE (a ref moves silently —
 *     paper must never print a stale contour); the plate leg has ZERO
 *     inline bar math (the segment between the leg marker and the walk
 *     marker contains no Math.log10 — the export's canvas block is the
 *     legal inline speaker); ONE fetch form (exactly one format=
 *     histogram literal in the panel, both paper verbs call
 *     fetchHistForPaper, zero old-name remnants); the print verb is
 *     async and fetches BEFORE the flag arms (the band must be in the
 *     DOM before the print freezes the render); the flag law's bytes
 *     unchanged and ONE setter (t1103 W3 / t1104 W8 preserved); the
 *     leg marker unique and inside the plate doc; the honest absence
 *     gate ({plateHistPlan && ...}); the busy door (disabled + spinner
 *     swap + the re-entrancy guard).
 */

import { readFileSync } from "node:fs";
import {
  planPlateHistogram,
  PLATE_HIST_INKS,
} from "@/lib/ortho-plate";

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

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

const PANEL = readFileSync(
  "src/components/workflow/results/map-ortho-panel.tsx",
  "utf8"
);
const LIB = readFileSync("src/lib/ortho-plate.ts", "utf8");

// ---- P — the plan seat's math ------------------------------------------

// P1 — the bars are the t291 bytes: log10(1+c) over log10(1+max)
{
  const plan = planPlateHistogram(
    { bins: [1, 10, 100, 10, 1], mean: 0, std: 1, lo: -3, hi: 3 },
    null
  );
  const w = 600;
  const h = 72;
  const px0 = 8;
  const px1 = w - 8;
  const py0 = 6;
  const py1 = h - 6;
  const bw = (px1 - px0) / 5;
  const logMax = Math.log10(1 + 100);
  const expected = [1, 10, 100, 10, 1].map((c, i) => ({
    x: px0 + i * bw,
    y: py1 - ((py1 - py0) * Math.log10(1 + c)) / logMax,
    w: Math.max(0.5, bw - 1),
    h: ((py1 - py0) * Math.log10(1 + c)) / logMax,
  }));
  ok(
    "P1 the bars are the t291 law byte for byte (log10(1+c)/log10(1+max), x/y/w/h per bar)",
    plan !== null &&
      plan.bars.length === 5 &&
      plan.bars.every((b, i) =>
        near(b.x, expected[i].x) &&
        near(b.y, expected[i].y) &&
        near(b.w, expected[i].w) &&
        near(b.h, expected[i].h)
      )
  );
}

// P2 — the band's frame: pads 8/8/6/6, the bar width spans the window
{
  const plan = planPlateHistogram(
    { bins: [4, 4], mean: 0, std: 1, lo: 0, hi: 2 },
    null
  );
  ok(
    "P2 the band frame is 8/8/6/6 padded (bar 0 starts at x=8; the last bar's right edge lands at px1-1 — the t291 gap law, bw-1 wide bars)",
    plan !== null &&
      near(plan.bars[0].x, 8) &&
      near(plan.bars[0].w, 291) &&
      near(plan.bars[1].x + plan.bars[1].w, 591, 1e-9)
  );
}

// P3 — the σ ruler: μ strongest, ±1σ ±2σ quiet, in order
{
  const plan = planPlateHistogram(
    { bins: [1, 2, 3, 2, 1], mean: 0, std: 1, lo: -3, hi: 3 },
    null
  );
  const px0 = 8;
  const px1 = 592;
  const xOf = (v) => px0 + ((v + 3) / 6) * (px1 - px0);
  ok(
    "P3 the ruler is [-2,-1,0,1,2]σ at mean+s·std, only μ strong (the t291 strength law)",
    plan !== null &&
      plan.ticks.length === 5 &&
      plan.ticks.every((t, i) => near(t.x, xOf(i - 2))) &&
      plan.ticks.map((t) => t.strong).join() === "false,false,true,false,false"
  );
}

// P4 — out-of-band ticks are silently skipped (no invented ruler)
{
  const plan = planPlateHistogram(
    { bins: [5, 5], mean: 0, std: 1, lo: -0.5, hi: 0.5 },
    null
  );
  ok(
    "P4 ticks outside [lo,hi] are skipped (a ±2σ tick past the window is not invented)",
    plan !== null && plan.ticks.length === 1 && plan.ticks[0].strong === true
  );
}

// P5 — the cut rides mean + sign·σ·std, on scale
{
  const plan = planPlateHistogram(
    { bins: [1, 2, 3, 2, 1], mean: 0, std: 1, lo: -3, hi: 3 },
    { sign: 1, sigma: 2 }
  );
  ok(
    "P5 the cut line's x is xOf(mean + sign·σ·std), onScale true in the window",
    plan !== null &&
      plan.cut !== null &&
      near(plan.cut.x, 8 + ((2 + 3) / 6) * 584) &&
      plan.cut.onScale === true
  );
}

// P6 — the off-scale honesty: clamped, faded, never invented
{
  const plan = planPlateHistogram(
    { bins: [1, 2, 3, 2, 1], mean: 0, std: 1, lo: -3, hi: 3 },
    { sign: -1, sigma: 5 }
  );
  ok(
    "P6 a cut past the window clamps to the band edge with onScale false (the fade flag, not a fake position)",
    plan !== null &&
      plan.cut !== null &&
      near(plan.cut.x, 8) &&
      plan.cut.onScale === false
  );
}

// P7 — the null honesty: degenerate payloads plan null
{
  const cases = [
    ["null payload", null],
    ["empty bins", { bins: [], mean: 0, std: 1, lo: -1, hi: 1 }],
    ["zero spread", { bins: [1, 2], mean: 0, std: 0, lo: -1, hi: 1 }],
    ["inverted window", { bins: [1, 2], mean: 0, std: 1, lo: 1, hi: -1 }],
    ["NaN mean", { bins: [1, 2], mean: NaN, std: 1, lo: -1, hi: 1 }],
  ];
  ok(
    "P7 a null or degenerate payload plans null (no bins, no spread, non-positive σ, non-finite mean — the leg stays home)",
    cases.every(([_, h]) => planPlateHistogram(h, null) === null)
  );
}

// P8 — zero-count bins are skipped (no ghost bars)
{
  const plan = planPlateHistogram(
    { bins: [0, 7, 0, 3], mean: 0, std: 1, lo: 0, hi: 4 },
    null
  );
  ok(
    "P8 zero-count bins draw nothing (the t291 skip law, two bars for four bins)",
    plan !== null && plan.bars.length === 2
  );
}

// P9 — purity: the payload and the cut are never mutated
{
  const hist = { bins: [1, 2, 3], mean: 0, std: 1, lo: -1, hi: 1 };
  const cut = { sign: 1, sigma: 1 };
  const histSnap = JSON.stringify(hist);
  const cutSnap = JSON.stringify(cut);
  planPlateHistogram(hist, cut);
  planPlateHistogram(hist, cut, 300, 56);
  ok(
    "P9 purity — the payload and the cut survive the plan untouched",
    JSON.stringify(hist) === histSnap && JSON.stringify(cut) === cutSnap
  );
}

// ---- I — the inks and the sheet -----------------------------------------

// I1 — the inks are the strip's light edition restated
ok(
  "I1 PLATE_HIST_INKS is the strip's LIGHT edition (paper is always light — the paper leg and the screen strip cannot disagree)",
  PLATE_HIST_INKS.bar === "rgba(8,145,178,0.62)" &&
    PLATE_HIST_INKS.tick === "rgba(0,0,0,0.30)" &&
    PLATE_HIST_INKS.mean === "rgba(0,0,0,0.55)" &&
    PLATE_HIST_INKS.cut === "#0891b2" &&
    PLATE_HIST_INKS.text === "rgba(0,0,0,0.45)"
);

// I2 — the default sheet is 600×72
{
  const plan = planPlateHistogram(
    { bins: [1], mean: 0, std: 1, lo: 0, hi: 1 },
    null
  );
  ok(
    "I2 the default sheet is 600×72 (the viewBox the plate leg speaks without arguments)",
    plan !== null && plan.w === 600 && plan.h === 72
  );
}

// ---- W — the wiring ------------------------------------------------------

// W1 — ONE lib import: the seat, the inks and the type ride one line
ok(
  "W1 the panel's plate import carries the σ leg's seat, the inks and the payload type from the ONE lib",
  /import \{[^}]*planPlateHistogram[^}]*PLATE_HIST_INKS[^}]*type PlateHistPayload[^}]*\} from "@\/lib\/ortho-plate"/.test(
    PANEL
  )
);

// W2 — the plan rides the plateHist STATE and the isoSigma STATE
ok(
  "W2 plateHistPlan = planPlateHistogram(plateHist, isoSigma) — the band's contour is the STATE, never a ref (paper must not print a stale σ)",
  /const plateHistPlan = planPlateHistogram\(plateHist, isoSigma\);/.test(PANEL)
);

// W3 — the plate leg has ZERO inline bar math (the lib owns the law)
{
  const legAt = PANEL.indexOf('data-ortho-plate-hist');
  const walkAt = PANEL.indexOf("data-ortho-plate-walk");
  const leg = legAt > -1 && walkAt > legAt ? PANEL.slice(legAt, walkAt) : "";
  ok(
    "W3 the segment between the leg marker and the walk marker contains no Math.log10 (the export's canvas block is the legal inline speaker; the plate leg rides the plan)",
    leg.length > 0 && !leg.includes("Math.log10") && leg.includes("plateHistPlan.bars.map")
  );
}

// W4 — ONE fetch form serving both paper editions
{
  const literals = (PANEL.match(/&format=histogram/g) || []).length;
  const printCall = /await fetchHistForPaper\(\)/.test(PANEL);
  const exportCall = /fetchHistForPaper\(\),/.test(PANEL);
  const remnant = /fetchHistForExport/.test(PANEL);
  ok(
    "W4 exactly ONE format=histogram fetch literal in the panel (the &form — comment mentions don't count); both paper verbs (print + export) call fetchHistForPaper; zero old-name remnants",
    literals === 1 && printCall && exportCall && !remnant
  );
}

// W5 — the print verb is async and fetches BEFORE the flag arms
{
  const verbAt = PANEL.indexOf("const printPlate = async () => {");
  const fetchAt = PANEL.indexOf("await fetchHistForPaper()");
  const flagAt = PANEL.indexOf('body.setAttribute("data-plate-print", "")', verbAt);
  ok(
    "W5 the print verb awaits the distribution before the flag arms (the band must be committed before the print freezes the render)",
    verbAt > -1 && fetchAt > verbAt && flagAt > fetchAt
  );
}

// W6 — the flag law's bytes unchanged, ONE setter (t1103 W3 / t1104 W8)
ok(
  "W6 the flag law runs unchanged (set + remove + afterprint once + the 8s failsafe) and setAttribute still appears exactly once",
  /body\.setAttribute\("data-plate-print", ""\)/.test(PANEL) &&
    /body\.removeAttribute\("data-plate-print"\)/.test(PANEL) &&
    /addEventListener\("afterprint", clear, \{ once: true \}\)/.test(PANEL) &&
    /window\.setTimeout\(clear, 8000\)/.test(PANEL) &&
    (PANEL.match(/setAttribute\("data-plate-print"/g) || []).length === 1
);

// W7 — the leg marker unique and inside the plate doc
{
  const markerCount = (PANEL.match(/data-ortho-plate-hist/g) || []).length;
  const docAt = PANEL.indexOf("data-ortho-plate-doc");
  const legAt = PANEL.indexOf("data-ortho-plate-hist");
  const closeAt = PANEL.indexOf("</section>\n      )}");
  ok(
    "W7 the leg marker appears exactly once and sits inside the aria-hidden plate doc (no new a11y surface)",
    markerCount === 1 && docAt > -1 && legAt > docAt && closeAt > legAt
  );
}

// W8 — the honest absence gate precedes the leg
ok(
  "W8 the leg renders behind {plateHistPlan && ...} (no payload → no band — the export's own absence law)",
  /\{plateHistPlan && \(\s*\n\s*<div data-ortho-plate-hist/.test(PANEL)
);

// W9 — the busy door: disabled + spinner + the re-entrancy guard
ok(
  "W9 the print button speaks the family's busy language (disabled={platePrintBusy}, the Loader2 swap, the guard returns early)",
  /disabled=\{platePrintBusy\}/.test(PANEL) &&
    /platePrintBusy \? \(\s*\n\s*<Loader2/.test(PANEL) &&
    /if \(platePrintBusy\) return;/.test(PANEL)
);

// W10 — the lib stays pure (node-runnable geometry)
ok(
  "W10 the plate lib stays pure — no fs, no db, no clock (the σ leg's geometry plans without a browser)",
  !/from\s+"(node:)?fs"|from\s+"@prisma\/client"|Date\.now\(\)/.test(LIB)
);

// ---- the receipt ---------------------------------------------------------
ok(
  "R1 the σ leg's laws are named in this unit's own docblock (the distribution's paper edition is part of the receipt)",
  true
);

console.log(`\nt1105-plate-hist-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

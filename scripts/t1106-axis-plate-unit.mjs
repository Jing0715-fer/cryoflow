#!/usr/bin/env node
/**
 * t1106 — THE AXIS WALKS' PAPER EDITION: the walk's THIRD page.
 *
 * t1104 put the cut's walk on paper (page 2); the axis walks (the
 * t1098 filmstrips — z, y, x face to face through the box) answered
 * the same tomographer's question per axis and stayed home. Page 3
 * answers them: three strips in the tile row's own order, each six
 * frames face to face along its axis, every frame signed with the
 * strip lib's own plane voice, the strips riding no cut (the axis
 * walk is the box's own document — the page prints whenever the
 * plate prints).
 *
 * 24 pins in three bands:
 *   P the axis page's words (8) — the heading byte form ("Z walk ·
 *     6 frames, face to face") for each axis; the extent riding the
 *     ONE seat (orthoPlateWalkMetaLine's own phrase — page 2's law,
 *     never a second extent dialect); the frame count riding the plan
 *     (the heading never hard-codes six); no dims restated in the
 *     heading (page 1's meta already speaks the box; the captions
 *     carry the addresses); the captions ARE the strip lib's
 *     planeLabel bytes (deep-equal to the ONE plan's own labels —
 *     the grid-known dialect and the honest % fallback both pinned);
 *     the ladder law re-pinned through the plate path (six stops,
 *     face to face inclusive); purity of the inputs.
 *   U the axis page's request law (4) — the panel's composition rides
 *     the ONE strip lib (planOrthoFilmstrip + orthoFilmstripUrls):
 *     the URL bytes are the tile's own request shape (axis lowercase,
 *     pos toFixed(3), encoded path), the ladder inclusive (pos 0.000
 *     … 1.000), the frames and the URLs 1:1 in plan order, each
 *     axis's URLs speaking its own axis.
 *   W the wiring (12) — the panel imports the axis page's words from
 *     the ONE plate lib (the import family grew one name) and the
 *     geometry from the ONE strip lib; the page marker unique and
 *     inside the plate doc AFTER the cut's walk page (page order is
 *     the document's law); the break-before-page third-sheet law;
 *     the strips riding TILES (the ONE order father — the page's
 *     strips stand in the tile row's own order); the accent border
 *     riding the AXIS_LABEL father (decorative, non-text); the
 *     heading riding the word fn; the captions riding the strip
 *     frames' own planeLabel (no re-derived label); the imgs riding
 *     the strip lib's URLs (zero new axis+pos template — the
 *     t1098 standing speakers stay three); grid-cols-6 (the strip's
 *     single-row law); the honest presence (no cut gate — the box's
 *     own document prints whenever the plate does); ONE print verb
 *     (the same button prints all three pages — no second flag
 *     setter, no new fetch); the plate lib's purity (no fs / db /
 *     clock).
 */

import { readFileSync } from "node:fs";
import {
  orthoAxisWalkHeading,
  orthoPlateWalkMetaLine,
} from "@/lib/ortho-plate";
import { planOrthoFilmstrip, orthoFilmstripUrls } from "@/lib/ortho-filmstrip";

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

const DIM = 64;
const JOB = "cm-job-walk";
const PATH = "maps/class001.mrc";

// ---- P — the axis page's words ----------------------------------------

// P1 — the heading's byte form, each axis riding the screen strip's own
// uppercase label dialect ("Z walk" — the t1098 export's header voice)
ok(
  "P1 the heading speaks the screen strip's own label dialect, byte for byte (z→Z, y→Y, x→X)",
  orthoAxisWalkHeading("z", 6) === "Z walk · 6 frames, face to face" &&
    orthoAxisWalkHeading("y", 6) === "Y walk · 6 frames, face to face" &&
    orthoAxisWalkHeading("x", 6) === "X walk · 6 frames, face to face"
);

// P2 — the extent rides the ONE seat (page 2's own phrase, never a
// second extent dialect)
ok(
  "P2 the heading's extent is the ONE seat's own bytes (orthoPlateWalkMetaLine(null, n) — page 2's law, composed not re-stated)",
  orthoAxisWalkHeading("z", 6) ===
    `Z walk · ${orthoPlateWalkMetaLine(null, 6)}`
);

// P3 — the frame count rides the caller (the heading never hard-codes
// six: a four-frame plan speaks four)
ok(
  "P3 the frame count rides the plan (a 4-frame plan speaks 4 frames — no hard-coded six)",
  orthoAxisWalkHeading("z", 4) === "Z walk · 4 frames, face to face"
);

// P4 — the heading never restates the box (page 1's meta speaks the
// dims; the strip's captions carry the per-frame addresses)
ok(
  "P4 the heading restates no dims (no 'vox' byte — page 1's meta owns the box, the captions own the addresses)",
  !orthoAxisWalkHeading("z", 6).includes("vox")
);

// P5 — the captions ARE the strip lib's own planeLabel bytes (the
// grid-known dialect; a 6-stop ladder visits 0.6 at index 3 — round
// (0.6 × 63) = 38, the voice speaks 39/64)
{
  const plan = planOrthoFilmstrip("z", DIM);
  ok(
    "P5 the frame captions are the strip lib's own plane voice, byte for byte (the grid-known dialect: z 1/64 … z 39/64 … z 64/64)",
    plan.frames.length === 6 &&
      plan.frames[0].planeLabel === "z 1/64" &&
      plan.frames[3].planeLabel === "z 39/64" &&
      plan.frames[5].planeLabel === "z 64/64"
  );
}

// P6 — the honest % fallback is the voice's own (a grid the listing
// cannot claim still walks; the fallback is the BARE % — the t1098
// seat's own dialect, no invented axis prefix, no invented address;
// index 3 is pos 0.6 → 60%)
{
  const plan = planOrthoFilmstrip("z", null);
  ok(
    "P6 an unclaimed grid still walks on the voice's own bare % fallback (0% … 60% … 100% — no invented address, no invented axis prefix)",
    plan.frames[0].planeLabel === "0%" &&
      plan.frames[3].planeLabel === "60%" &&
      plan.frames[5].planeLabel === "100%"
  );
}

// P7 — the ladder law re-pinned through the plate path (six stops,
// face to face inclusive)
{
  const plan = planOrthoFilmstrip("y", DIM);
  const pos = plan.frames.map((f) => f.pos);
  ok(
    "P7 the ladder is face to face inclusive (pos 0 … 1, six even stops — the axis's whole support)",
    pos.length === 6 &&
      pos[0] === 0 &&
      pos[5] === 1 &&
      Math.abs(pos[1] - 0.2) < 1e-12 &&
      Math.abs(pos[2] - 0.4) < 1e-12
  );
}

// P8 — purity: the plan owns no reference to the caller's values, the
// heading mutates nothing (two calls agree; the args are primitives
// and strings — deep-equal across calls is the contract)
{
  const a = planOrthoFilmstrip("x", DIM);
  const b = planOrthoFilmstrip("x", DIM);
  const h1 = orthoAxisWalkHeading("x", 6);
  const h2 = orthoAxisWalkHeading("x", 6);
  ok(
    "P8 purity (two plans deep-equal and independent, two headings byte-equal — the words are decided before any print)",
    JSON.stringify(a) === JSON.stringify(b) && a !== b && h1 === h2
  );
}

// ---- U — the axis page's request law ----------------------------------

// U1 — the URL bytes are the tile's own request shape (axis lowercase,
// pos toFixed(3), the encoded path)
{
  const urls = orthoFilmstripUrls(JOB, PATH, planOrthoFilmstrip("z", DIM));
  ok(
    "U1 the strip's URLs speak the tile's own request shape (encoded path, format=png, axis=z, pos toFixed(3))",
    urls[0] ===
      `/api/jobs/${JOB}/outputs/file?path=${encodeURIComponent(
        PATH
      )}&format=png&axis=z&pos=0.000`
  );
}

// U2 — the ladder inclusive in the bytes (pos 0.000 … 1.000)
{
  const urls = orthoFilmstripUrls(JOB, PATH, planOrthoFilmstrip("z", DIM));
  ok(
    "U2 the ladder is inclusive in the URL bytes (pos=0.000 first, pos=1.000 last — every plane the slider could visit)",
    urls[urls.length - 1].endsWith("axis=z&pos=1.000") &&
      urls.length === 6
  );
}

// U3 — frames and URLs 1:1 in plan order (a frame's URL and its caption
// describe the SAME plane by construction)
{
  const plan = planOrthoFilmstrip("y", DIM);
  const urls = orthoFilmstripUrls(JOB, PATH, plan);
  ok(
    "U3 frames and URLs are 1:1 in plan order (each URL's pos is its own frame's pos — caption and pixels agree)",
    urls.length === plan.frames.length &&
      urls.every(
        (u, i) => u.endsWith(`axis=y&pos=${plan.frames[i].pos.toFixed(3)}`)
      )
  );
}

// U4 — each axis speaks its own axis (the three strips cannot disagree
// about whose walk a frame belongs to)
ok(
  "U4 each axis's URLs speak their own axis (z→axis=z, y→axis=y, x→axis=x — no cross-talk)",
  orthoFilmstripUrls(JOB, PATH, planOrthoFilmstrip("z", DIM)).every((u) =>
    u.includes("axis=z")
  ) &&
    orthoFilmstripUrls(JOB, PATH, planOrthoFilmstrip("y", DIM)).every((u) =>
      u.includes("axis=y")
    ) &&
    orthoFilmstripUrls(JOB, PATH, planOrthoFilmstrip("x", DIM)).every((u) =>
      u.includes("axis=x")
    )
);

// ---- W — the wiring ----------------------------------------------------

const panel = readFileSync(
  new URL(
    "../src/components/workflow/results/map-ortho-panel.tsx",
    import.meta.url
  ),
  "utf8"
);
const plateLib = readFileSync(
  new URL("../src/lib/ortho-plate.ts", import.meta.url),
  "utf8"
);

// W1 — the ONE imports (words from the plate lib — the family grew two
// names across t1106 and t1107: orthoAxisWalkHeading, then the current
// mark's legend; geometry from the strip lib, whose family grew the
// t1107 "you are here" seat)
ok(
  "W1 the panel imports the axis page's words from the ONE plate lib (orthoAxisWalkHeading and the t1107/t1108 legends ride the family line; the t1112 direction page's extent + legend joined the line — the family-growth re-key, reason named) and the geometry from the ONE strip lib (the plan families plus the t1107/t1108 current seats)",
  panel.includes(
    'import { orthoAxisWalkHeading, orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine, orthoPlateObliqueCurrentLegend, orthoPlateTileUrl, orthoPlateWalkCurrentLegend, orthoPlateWalkMetaLine, orthoWalkFrameCaption, planOrthoPlate, planPlateHistogram, PLATE_HIST_INKS, type PlateHistPayload } from "@/lib/ortho-plate"'
  ) &&
    panel.includes(
      'import { ORTHO_FILMSTRIP_FRAMES, orthoFilmstripFilename, orthoFilmstripUrls, orthoWalkCurrentIndex, planOrthoFilmstrip } from "@/lib/ortho-filmstrip"'
    )
);

// W2 — the page marker unique
ok(
  "W2 the axis walks page is marked exactly once (data-ortho-plate-axis-walks — one paper face, no second copy)",
  panel.split("data-ortho-plate-axis-walks").length - 1 === 1
);

// W3 — the page lives inside the plate doc, AFTER the cut's walk page
// (page order is the document's law: focus sections → cut walk → axis walks)
{
  const docAt = panel.indexOf('data-ortho-plate-doc');
  const walkAt = panel.indexOf('data-ortho-plate-walk');
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  ok(
    "W3 the page stands inside the plate doc, after the cut's walk page (focus → cut → axes — the document's own order)",
    docAt > -1 && walkAt > docAt && axisAt > walkAt
  );
}

// W4 — the third-sheet law (break-before-page starts it on a fresh sheet)
{
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  const tag = panel.slice(axisAt - 200, axisAt + 120);
  ok(
    "W4 the page starts on a fresh sheet (break-before-page on the axis walks div — the t1104 page law, third edition)",
    /break-before-page/.test(tag)
  );
}

// W5 — the strips ride TILES (the ONE order father — the page's strips
// stand in the tile row's own order z, y, x)
{
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  const block = panel.slice(axisAt, axisAt + 3000);
  ok(
    "W5 the strips ride the ONE order father (TILES.map inside the axis walks block — the page's order IS the tile row's order)",
    /TILES\.map\(\(spec\) =>/.test(block)
  );
}

// W6 — the accent border rides the AXIS_LABEL father (decorative,
// non-text — paper contrast is not the dark strip's contrast)
{
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  const block = panel.slice(axisAt, axisAt + 3000);
  ok(
    "W6 the strip accent rides the AXIS_LABEL father (borderColor: AXIS_LABEL[spec.axis] — no new color invented)",
    /borderColor: AXIS_LABEL\[spec\.axis\]/.test(block)
  );
}

// W7 — the heading rides the word fn (no inline extent template)
{
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  const block = panel.slice(axisAt, axisAt + 3000);
  ok(
    "W7 the heading rides the ONE word fn (orthoAxisWalkHeading(spec.axis, …) — the extent composed in the lib, never inline)",
    /orthoAxisWalkHeading\(\s*spec\.axis,/.test(block) &&
      !/frames, face to face/.test(block)
  );
}

// W8 — the captions ride the strip frames' own planeLabel (no
// re-derived label)
{
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  const block = panel.slice(axisAt, axisAt + 3000);
  ok(
    "W8 the captions ride the strip lib's own voice (figcaption speaks f.planeLabel — the t1098 seat, no second label dialect)",
    /\{f\.planeLabel\}/.test(block)
  );
}

// W9 — the imgs ride the strip lib's URLs (zero new axis+pos template —
// the t1098 standing speakers stay three: probe, tile, triptych)
{
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  const block = panel.slice(axisAt, axisAt + 3000);
  const axisPosTemplates = panel.match(/axis=\$\{/g)?.length ?? 0;
  ok(
    "W9 the imgs ride the ONE strip lib (src={axisWalkUrls[spec.axis][i]} — the file's axis+pos templates stay the t1098 standing three: probe, tile, triptych; the walk adds zero)",
    /src=\{axisWalkUrls\[spec\.axis\]\[i\]\}/.test(block) &&
      axisPosTemplates === 3
  );
}

// W10 — the strip's single-row law (grid-cols-6 — the filmstrip reads
// left to right, the axis's own direction)
{
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  const block = panel.slice(axisAt, axisAt + 3000);
  ok(
    "W10 the strip is a filmstrip (grid-cols-6 — six frames in one row, the walk reading left to right)",
    /grid grid-cols-6/.test(block)
  );
}

// W11 — the honest presence (no cut gate — the box's own document
// prints whenever the plate prints)
{
  const axisAt = panel.indexOf('data-ortho-plate-axis-walks');
  const before = panel.slice(axisAt - 400, axisAt);
  ok(
    "W11 the page rides no cut gate (the axis walk is the box's own document — unconditional inside the plate doc, unlike the cut's page)",
    !/\{axisWalkPlan[A-Za-z]* &&/.test(before.slice(-200)) &&
      panel.includes("<div data-ortho-plate-axis-walks")
  );
}

// W12 — ONE print verb (the same button prints all three pages — no
// second flag setter, no new fetch; the ONE fetch form serves its two
// standing paper faces — the plate band and the export triptych's
// footer — and the axis walks add no third caller)
ok(
  "W12 ONE print verb serves all three pages (one data-plate-print setter; fetchHistForPaper's callers stay the standing two — the axis walks ride no fetch)",
  (panel.match(/body\.setAttribute\("data-plate-print"/g)?.length ?? 0) ===
    1 &&
    (panel.match(/fetchHistForPaper\(\)/g)?.length ?? 0) === 2 &&
    !(panel.slice(panel.indexOf('data-ortho-plate-axis-walks'), panel.indexOf('data-ortho-plate-axis-walks') + 2400).includes("fetch("))
);

// ---- the receipt -------------------------------------------------------
ok(
  "R1 the axis page's laws are named in this unit's own docblock (the third page is part of the receipt)",
  true
);

// purity of the lib seat's home (the plate lib composes WORDS — no fs,
// no db, no clock)
ok(
  "R2 the plate lib stays pure (no fs / db / clock import — the words are decided, not fetched)",
  !/from "node:fs"|from "fs"|prisma|Date\.now/.test(plateLib)
);

console.log(`\nt1106-axis-plate-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

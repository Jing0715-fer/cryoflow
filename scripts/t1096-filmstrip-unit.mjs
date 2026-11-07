#!/usr/bin/env node
// t1096 — THE CUT'S WALK unit: the oblique filmstrip (one cut swept face
// to face through the box along its own normal, one PNG document).
//
// The walk's geometry is BEHAVIORAL here (the t653 law — the meaning
// lives in lib, the unit imports the same seat the panel rides):
//   M the math (7)   — the ladder is face-to-face inclusive at even
//                      steps; the pct/depth labels are BIT-EQUAL to the
//                      t907 voices' own compositions; the unusable grid
//                      keeps the honest silence (pct speaks, voxels do
//                      not); degenerate frame counts fall back; the
//                      inputs are never mutated.
//   U the URLs (4)   — the request series obeys the block's own src law
//                      (plane=oblique, θ/φ toFixed(1), offset toFixed(3)
//                      per frame) — a frame and the screen can never
//                      disagree about what was rendered.
//   F the name (2)   — the document's naming grammar (the triptych's
//                      base-stripped, stamped shape).
//   W the wiring (7) — the panel rides the ONE lib (no inline
//                      re-derivation), the block wires the button, the
//                      button rides the one blob sink, the a11y voice
//                      names the walk.
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t1096-filmstrip-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FILMSTRIP_FRAMES,
  obliqueFilmstripFilename,
  obliqueFilmstripUrls,
  planObliqueFilmstrip,
} from "@/lib/oblique-filmstrip";
import {
  obliqueDepthVox,
  obliqueDepthVoice,
  obliqueOffsetPctVoice,
  obliqueSupportVox,
} from "@/lib/voxel-voice";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const ROOT = "/home/z/my-project";
const panelSrc = readFileSync(join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");

/* ------------------------------------------------------------------ */
/* M — the walk's math                                                 */
/* ------------------------------------------------------------------ */

const DIMS = [64, 64, 64];
const THETA = 45;
const PHI = 90;

const plan = planObliqueFilmstrip(THETA, PHI, DIMS);

ok("M1 default walk is six frames",
  plan.frames.length === FILMSTRIP_FRAMES && FILMSTRIP_FRAMES === 6,
  `got ${plan.frames.length}`);

const fracs = plan.frames.map((f) => f.frac);
ok("M2 ladder is face-to-face inclusive at even steps",
  fracs[0] === -1 && fracs[fracs.length - 1] === 1 &&
  fracs.every((f, i) => i === 0 || Math.abs(f - fracs[i - 1] - 0.4) < 1e-12),
  `got ${JSON.stringify(fracs)}`);

ok("M3 offsetPct ladder is the slider's dialect",
  JSON.stringify(plan.frames.map((f) => f.offsetPct)) ===
    JSON.stringify([-100, -60, -20, 20, 60, 100]),
  `got ${JSON.stringify(plan.frames.map((f) => f.offsetPct))}`);

ok("M4 pct labels are BIT-EQUAL to the pct voice",
  plan.frames.every((f) => f.pctLabel === obliqueOffsetPctVoice(f.frac)),
  "a label drifted from its voice");

const support = obliqueSupportVox(DIMS, THETA, PHI);
ok("M5 depth labels are BIT-EQUAL to the depth voice composition",
  plan.frames.every(
    (f) => f.depthLabel === obliqueDepthVoice(obliqueDepthVox(f.frac, support))
  ) && plan.supportVox === support,
  "a depth label drifted from the voice");

const bare = planObliqueFilmstrip(THETA, PHI, null);
ok("M6 unusable grid: pct speaks, voxels keep the honest silence",
  bare.supportVox === null &&
  bare.frames.every((f) => f.depthLabel === null && f.pctLabel === obliqueOffsetPctVoice(f.frac)),
  "the fallback must keep the % and drop the voxels");

const two = planObliqueFilmstrip(THETA, PHI, DIMS, 2);
const weird = planObliqueFilmstrip(THETA, PHI, DIMS, 1);
const frac2 = planObliqueFilmstrip(THETA, PHI, DIMS, 2.5);
const frozenDims = Object.freeze([32, 32, 32]);
const frozenIn = planObliqueFilmstrip(THETA, PHI, frozenDims);
frozenIn.frames[0].frac = 99; // mutate the OUTPUT freely — the lib owns it
ok("M7 degenerate counts fall back to six; two = the ends only; inputs unmutated",
  two.frames.length === 2 && two.frames[0].frac === -1 && two.frames[1].frac === 1 &&
  weird.frames.length === 6 && frac2.frames.length === 6 &&
  frozenIn.supportVox === obliqueSupportVox([32, 32, 32], THETA, PHI),
  `two=${two.frames.length} weird=${weird.frames.length} frac2=${frac2.frames.length}`);

/* ------------------------------------------------------------------ */
/* U — the request series                                              */
/* ------------------------------------------------------------------ */

const JOB = "job-123";
const PATH = "/data/maps/my map.mrc";
const urls = obliqueFilmstripUrls(JOB, PATH, plan);

ok("U1 every request is the oblique png door",
  urls.length === 6 && urls.every((u) => u.includes("format=png&plane=oblique")),
  urls[0]);

ok("U2 θ/φ ride toFixed(1) in every URL",
  urls.every((u) => u.includes(`theta=${THETA.toFixed(1)}`) && u.includes(`phi=${PHI.toFixed(1)}`)),
  "the src law's angle bytes");

ok("U3 offsets ride toFixed(3), distinct per frame",
  JSON.stringify(urls.map((u) => u.split("&offset=")[1])) ===
    JSON.stringify(["-1.000", "-0.600", "-0.200", "0.200", "0.600", "1.000"]),
  "got " + JSON.stringify(urls.map((u) => u.split("&offset=")[1])));

ok("U4 the path rides encodeURIComponent round-trip",
  urls.every((u) => u.includes(encodeURIComponent(PATH))) &&
  decodeURIComponent(urls[0].split("path=")[1].split("&")[0]) === PATH,
  "spaces survive the door");

/* ------------------------------------------------------------------ */
/* F — the document's name                                             */
/* ------------------------------------------------------------------ */

ok("F1 the name strips the map extension and carries the stamp",
  obliqueFilmstripFilename("/a/rec.mrc", "123456") === "oblique-filmstrip-rec-123456.png" &&
  obliqueFilmstripFilename("/a/rec.mrcs", "123456") === "oblique-filmstrip-rec-123456.png" &&
  obliqueFilmstripFilename("/a/rec.tif", "123456") === "oblique-filmstrip-rec.tif-123456.png",
  "the triptych's naming grammar");

ok("F2 a slash-less path names itself",
  obliqueFilmstripFilename("rec.mrc", "123456") === "oblique-filmstrip-rec-123456.png",
  "the split-fallback branch");

/* ------------------------------------------------------------------ */
/* W — the wiring                                                      */
/* ------------------------------------------------------------------ */

ok("W1 the panel rides the ONE lib (the import line)",
  panelSrc.includes('from "@/lib/oblique-filmstrip"'),
  "no inline re-derivation of the walk");

ok("W2 the block wires the button with the walk's inputs",
  /<ObliqueFilmstripButton\s*\n\s*jobId=\{jobId\}\s*\n\s*path=\{path\}\s*\n\s*dims=\{dims\}\s*\n\s*on=\{on\}\s*\n\s*live=\{live\}\s*\n\s*provenance=\{provenance\}\s*\/>/.test(panelSrc),
  "the five props ride the block's own live state");

ok("W3 the button rides the one blob sink with the lib's name",
  panelSrc.includes("downloadBlob(blob, obliqueFilmstripFilename(path, stamp))"),
  "the t646 law — one blob sink");

ok("W4 the walk's icon is the Film glyph",
  /^import \{[^\n]*\bFilm\b[^\n]*\} from "lucide-react";/m.test(panelSrc),
  "the filmstrip reads as a filmstrip");

ok("W5 the button carries its canvas-ui tag",
  panelSrc.includes('data-canvas-ui="ortho-oblique-filmstrip"'),
  "the QA seat");

ok("W6 the a11y voice names the walk; the gate is the block's own on",
  panelSrc.includes("Export the cut's walk") &&
  panelSrc.includes("${FILMSTRIP_FRAMES} frames from face to face along the normal") &&
  panelSrc.includes("disabled={!on || state === \"busy\"}"),
  "the keyboard hears the truth; the gate is the block's");

ok("W7 the trio imports together (plan, urls, filename)",
  panelSrc.includes("planObliqueFilmstrip") &&
  panelSrc.includes("obliqueFilmstripUrls") &&
  panelSrc.includes("obliqueFilmstripFilename") &&
  panelSrc.includes("FILMSTRIP_FRAMES"),
  "one father, every face rides it");

/* ------------------------------------------------------------------ */

console.log(`\nt1096-filmstrip-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

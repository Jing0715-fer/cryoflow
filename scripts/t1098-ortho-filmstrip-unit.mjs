#!/usr/bin/env node
// t1098 — THE WALK'S SIBLINGS unit: the ortho axis filmstrips (one axis
// swept face to face through the box, one PNG document per axis).
//
// The walk's geometry is BEHAVIORAL here (the t653 law — the meaning
// lives in lib, the unit imports the same seat the panel rides):
//   M the math (7)   — the ladder is face-to-face inclusive at even
//                      steps (pos 0→1); the labels are BIT-EQUAL to the
//                      t906 plane voice's own compositions ("z 33/64" /
//                      the bare "50%" fallback — no new silence invented);
//                      degenerate frame counts fall back; degenerate dims
//                      speak the % voice; the plan is pure and re-plans
//                      identically.
//   U the URLs (4)   — the request series obeys the TILE's own src law
//                      (axis lowercase, pos toFixed(3) per frame) — a
//                      frame and the screen can never disagree about what
//                      was rendered.
//   F the name (2)   — the document's naming grammar (the oblique walk's
//                      base-stripped, stamped shape, the axis named).
//   W the wiring (7) — the panel rides the ONE lib (no inline
//                      re-derivation), the three tiles wire the button,
//                      the a11y voice names the walk, the state machine
//                      and the one blob sink hold, the publishing palette
//                      rides the house's own AXIS_LABEL father.
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t1098-ortho-filmstrip-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ORTHO_FILMSTRIP_FRAMES,
  orthoFilmstripFilename,
  orthoFilmstripUrls,
  planOrthoFilmstrip,
} from "@/lib/ortho-filmstrip";
import { voxelPlaneVoice } from "@/lib/voxel-voice";

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

const DIM = 64;
const plan = planOrthoFilmstrip("z", DIM);

ok("M1 the ladder is face-to-face inclusive at even steps (pos 0→1, six stops)",
  plan.frames.length === 6 &&
  plan.frames[0].pos === 0 &&
  plan.frames[5].pos === 1 &&
  plan.frames.every((f, i) => Math.abs(f.pos - i / 5) < 1e-12),
  `n=${plan.frames.length} first=${plan.frames[0]?.pos} last=${plan.frames[5]?.pos}`);

ok("M2 the labels are BIT-EQUAL to the t906 plane voice (one father, no drift)",
  plan.frames.every((f, i) => f.planeLabel === voxelPlaneVoice(i / 5, "z", DIM)) &&
  plan.frames[0].planeLabel === "z 1/64" &&
  plan.frames[5].planeLabel === "z 64/64" &&
  plan.frames[2].planeLabel === "z 26/64",
  `first=${plan.frames[0]?.planeLabel} mid=${plan.frames[2]?.planeLabel} last=${plan.frames[5]?.planeLabel}`);

const planUnknown = planOrthoFilmstrip("y", null);
ok("M3 the unknown grid keeps the voice's own honest % fallback (no new silence invented)",
  planUnknown.frames.length === 6 &&
  planUnknown.frames.every((f, i) => f.planeLabel === voxelPlaneVoice(i / 5, "y", null)) &&
  planUnknown.frames[0].planeLabel === "0%" &&
  planUnknown.frames[5].planeLabel === "100%",
  `first=${planUnknown.frames[0]?.planeLabel} last=${planUnknown.frames[5]?.planeLabel}`);

ok("M4 degenerate frame counts fall back to the six-frame default",
  planOrthoFilmstrip("z", DIM, 1).frames.length === 6 &&
  planOrthoFilmstrip("z", DIM, 2.5).frames.length === 6 &&
  planOrthoFilmstrip("z", DIM, -3).frames.length === 6 &&
  ORTHO_FILMSTRIP_FRAMES === 6);

const planThree = planOrthoFilmstrip("y", 48, 3);
ok("M5 an honest stop count is honored (three stops: the faces and the middle)",
  planThree.frames.length === 3 &&
  planThree.frames[0].pos === 0 && planThree.frames[1].pos === 0.5 && planThree.frames[2].pos === 1 &&
  planThree.frames[0].planeLabel === "y 1/48" &&
  planThree.frames[1].planeLabel === "y 25/48" &&
  planThree.frames[2].planeLabel === "y 48/48",
  `${planThree.frames.map((f) => f.planeLabel).join(" · ")}`);

ok("M6 the plan is pure — the same inputs re-plan identically, own no references",
  JSON.stringify(planOrthoFilmstrip("z", DIM)) === JSON.stringify(plan) &&
  planOrthoFilmstrip("z", DIM) !== plan &&
  plan.dim === DIM);

ok("M7 degenerate dims speak the % voice (a one-voxel axis has no ladder of addresses)",
  planOrthoFilmstrip("z", 1).frames[2].planeLabel === "40%" &&
  planOrthoFilmstrip("z", 0).frames[2].planeLabel === "40%" &&
  planOrthoFilmstrip("z", undefined).frames[2].planeLabel === "40%",
  `${planOrthoFilmstrip("z", 1).frames[2].planeLabel}`);

/* ------------------------------------------------------------------ */
/* U — the URLs (the tile's own src law)                               */
/* ------------------------------------------------------------------ */

const PATH = "/home/z/my-project/data/relion/p/run_ctf_module.mrc";
const urls = orthoFilmstripUrls("job-1", PATH, plan);

ok("U1 one URL per frame, in plan order",
  urls.length === plan.frames.length &&
  urls.every((u, i) => u.includes(`pos=${plan.frames[i].pos.toFixed(3)}`)));

ok("U2 the bytes obey the tile's src law (axis lowercase, pos toFixed(3))",
  urls[0] === `/api/jobs/job-1/outputs/file?path=${encodeURIComponent(PATH)}&format=png&axis=z&pos=0.000` &&
  urls[5] === `/api/jobs/job-1/outputs/file?path=${encodeURIComponent(PATH)}&format=png&axis=z&pos=1.000` &&
  urls[1].includes("pos=0.200") && urls[3].includes("pos=0.600"),
  `first=${urls[0].slice(-40)}`);

ok("U3 the path rides encodeURIComponent (the product door's own escaping)",
  urls.every((u) => u.includes(`path=${encodeURIComponent(PATH)}`)));

const urlsY = orthoFilmstripUrls("job-1", PATH, planThree);
ok("U4 the walked axis rides lowercase as spoken",
  urlsY.every((u) => u.includes("axis=y") && !u.includes("axis=Y") && !u.includes("plane=")),
  urlsY[0].slice(-30));

/* ------------------------------------------------------------------ */
/* F — the document's name                                             */
/* ------------------------------------------------------------------ */

ok("F1 the name speaks the walk's grammar (axis named, base stripped, the moment stamped)",
  orthoFilmstripFilename(PATH, "z", "120304") === "ortho-filmstrip-z-run_ctf_module-120304.png",
  orthoFilmstripFilename(PATH, "z", "120304"));

ok("F2 the extension strip is the oblique walk's own (.mrcs, case-blind, bare base passes)",
  orthoFilmstripFilename("/a/b/particles.mrcs", "x", "090001") === "ortho-filmstrip-x-particles-090001.png" &&
  orthoFilmstripFilename("/a/b/Half.Map", "y", "090001") === "ortho-filmstrip-y-Half.Map-090001.png" &&
  orthoFilmstripFilename("/a/b/MAP.MRC", "y", "090001") === "ortho-filmstrip-y-MAP-090001.png");

/* ------------------------------------------------------------------ */
/* W — the wiring (the panel rides the ONE lib)                        */
/* ------------------------------------------------------------------ */

ok("W1 the panel imports the ONE lib — the geometry is never re-derived inline",
  panelSrc.includes(`from "@/lib/ortho-filmstrip"`) &&
  panelSrc.includes("planOrthoFilmstrip") &&
  panelSrc.includes("orthoFilmstripUrls") &&
  panelSrc.includes("orthoFilmstripFilename"));

ok("W2 the three tiles wire the button (the axis template, one mount with the tile's own handles)",
  panelSrc.includes("ortho-filmstrip-${spec.axis}") &&
  panelSrc.includes("<OrthoFilmstripButton jobId={jobId} path={path} spec={spec} dim={dim} />"));

ok("W3 the a11y voice names the walk (the plane, the frame count, the axis)",
  panelSrc.includes("frames from face to face along ${spec.axisLabel}") &&
  panelSrc.includes(`Export the \${spec.plane}'s walk`) &&
  panelSrc.includes("Exporting the walk\\u2026"));

ok("W4 the state machine is the walk family's own (idle/busy/ok/err, the 1600ms ok window)",
  panelSrc.includes('useState<"idle" | "busy" | "ok" | "err">("idle")') &&
  / OrthoFilmstripButton[\s\S]{0,2200}setTimeout\(\(\) => setState\("idle"\), 1600\)/.test(panelSrc));

ok("W5 the strip adds NO second src shape — the file's axis+pos templates stay the standing three (probe/tile/triptych; the walk rides the lib)",
  (panelSrc.match(/&axis=\$\{(spec|t)\.axis\}&pos=/g) || []).length === 3 &&
  /walk = async[\s\S]{0,400}orthoFilmstripUrls\(jobId, path, plan\)/.test(panelSrc));

ok("W6 the publishing palette rides the house's own father (AXIS_LABEL — header, frames, and the t1106 plate's accent border: three speakers, one father)",
  (panelSrc.match(/AXIS_LABEL\[spec\.axis\]/g) || []).length === 3 &&
  !panelSrc.includes("AXIS_ACCENT"));

ok("W7 the download rides the one blob sink and the lib's name (the t646 law)",
  /OrthoFilmstripButton[\s\S]{0,4200}downloadBlob\(blob, orthoFilmstripFilename\(path, spec\.axis, stamp\)\)/.test(panelSrc));

/* ------------------------------------------------------------------ */

console.log(`\n${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

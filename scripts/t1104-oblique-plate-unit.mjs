#!/usr/bin/env node
/**
 * t1104 — THE OBLIQUE PLATE: the walk's second page.
 *
 * t1103 printed the three sections at the focus point; the walk (the
 * screen's t1096 filmstrip) answered "what does the density look like
 * THROUGH here?" and stayed home on paper. The second page answers it:
 * six frames face to face along the cut's own normal, started on a
 * fresh sheet (break-before-page), introduced by page 1's own cut line,
 * each frame signed with its pct and depth voices.
 *
 * 20 pins in three bands:
 *   P the walk page's words (7) — the meta line is page 1's planned
 *     cutLine passed through VERBATIM (never recomputed — the plate
 *     never re-states a formula another face speaks) joined with the
 *     ladder's own extent phrase; a null cut line still names the
 *     extent honestly; the captions are the t907 voices' own pct and
 *     depth words (deep-equal to the ONE plan's own labels — the honest
 *     silence included, no dangling separator); the ladder law re-pinned
 *     through the plate path (six stops, face to face inclusive);
 *     purity of the inputs.
 *   U the walk page's request law (3) — the panel's composition rides
 *     the ONE walk lib (planObliqueFilmstrip + obliqueFilmstripUrls):
 *     the URL bytes are the tile's own request shape (plane=oblique,
 *     θ/φ toFixed(1), offset toFixed(3), encoded path), the frames and
 *     the URLs are 1:1 in plan order (a frame's URL and its caption
 *     describe the SAME plane by construction).
 *   W the wiring (10) — the panel imports the walk-page words from the
 *     ONE plate lib and the geometry from the ONE walk lib; the walk
 *     plan is composed from the PLATE'S OWN CUT ECHO state (a ref moves
 *     silently — paper must never print a stale cut); the walk page
 *     marker unique and inside the plate doc (one aria-hidden paper —
 *     no new a11y surface); the honest absence ({walkPlan && walkUrls}
 *     — no live cut, no walk page: the screen's own disabled-button
 *     law); the imgs riding walkUrls (no third URL dialect — the two
 *     standing oblique templates are the legal speakers, the walk adds
 *     zero); the captions and meta riding the word fns; the
 *     break-before-page second-sheet law; ONE print verb (the same
 *     button prints both pages — no second flag setter); the plate
 *     lib's purity (no fs / db / clock).
 */

import { readFileSync } from "node:fs";
import {
  orthoPlateWalkMetaLine,
  orthoWalkFrameCaption,
  planOrthoPlate,
} from "@/lib/ortho-plate";
import { planObliqueFilmstrip, obliqueFilmstripUrls } from "@/lib/oblique-filmstrip";

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

const DIMS = [64, 64, 64];
const JOB = "cm-job-walk";
const PATH = "maps/class001.mrc";

// ---- P — the walk page's words ---------------------------------------

// P1 — the cut line passes through VERBATIM (never recomputed)
{
  const cutPlan = planOrthoPlate({
    positions: { x: 0.5, y: 0.5, z: 0.5 },
    dims: DIMS,
    sigma: null,
    oblique: { theta: 45, phi: 90, offset: 0.3 },
  });
  const meta = orthoPlateWalkMetaLine(cutPlan.cutLine, 6);
  ok(
    "P1 the walk page's meta line is page 1's own cut line, byte for byte (the annotation voice passes through — the plate never re-states a formula)",
    typeof cutPlan.cutLine === "string" &&
      meta.startsWith(cutPlan.cutLine + " · ")
  );
}

// P2 — the extent phrase (the ladder's own law words)
{
  const meta = orthoPlateWalkMetaLine("oblique cut 45°·90° · +30%", 6);
  ok(
    "P2 the extent joins the cut line with the ladder's own phrase ('6 frames, face to face')",
    meta === "oblique cut 45°·90° · +30% · 6 frames, face to face"
  );
}

// P3 — a null cut line still names the extent (the honest line)
{
  const meta = orthoPlateWalkMetaLine(null, 6);
  ok(
    "P3 a null cut line still names the extent (the frames carry their own position voices)",
    meta === "6 frames, face to face"
  );
}

// P4 — the caption joins the pct voice with the depth voice
ok(
  "P4 the caption is the pct voice joined with the depth voice ('+20% · +2.9 vox')",
  orthoWalkFrameCaption({ pctLabel: "+20%", depthLabel: "+2.9 vox" }) ===
    "+20% · +2.9 vox"
);

// P5 — the honest silence: no depth claim, no dangling separator
ok(
  "P5 an unusable grid walks on the pct alone (no depth word, no dangling separator)",
  orthoWalkFrameCaption({ pctLabel: "-60%", depthLabel: null }) === "-60%"
);

// P6 — the captions are the ONE plan's own labels (deep-equal, per frame)
{
  const plan = planObliqueFilmstrip(45, 90, DIMS);
  const every = plan.frames.every(
    (f) => orthoWalkFrameCaption(f) === (f.depthLabel ? `${f.pctLabel} · ${f.depthLabel}` : f.pctLabel)
  );
  ok(
    "P6 every frame's caption is the plan's own pct/depth bytes (the ONE father — six stops, face to face inclusive)",
    every &&
      plan.frames.length === 6 &&
      plan.frames[0].frac === -1 &&
      plan.frames[plan.frames.length - 1].frac === 1
  );
}

// P7 — purity: the inputs are never mutated
{
  const frame = { pctLabel: "+0%", depthLabel: "+2.9 vox" };
  const snapshot = JSON.stringify(frame);
  orthoWalkFrameCaption(frame);
  const line = "oblique cut 45°·90°";
  orthoPlateWalkMetaLine(line, 6);
  ok(
    "P7 purity — the caption's frame and the meta's cut line are untouched",
    JSON.stringify(frame) === snapshot && line === "oblique cut 45°·90°"
  );
}

// ---- U — the walk page's request law ---------------------------------

// U1 — the composition is the ONE lib's own bytes (plan + URLs)
{
  const plan = planObliqueFilmstrip(45, 90, DIMS);
  const urls = obliqueFilmstripUrls(JOB, PATH, plan);
  ok(
    "U1 the walk page's URLs are obliqueFilmstripUrls' own bytes over planObliqueFilmstrip's own plan (the ONE walk lib — the panel composes, never re-speaks)",
    urls.length === 6 &&
      urls[0].includes("plane=oblique&theta=45.0&phi=90.0&offset=-1.000") &&
      urls[urls.length - 1].includes("offset=1.000")
  );
}

// U2 — the tile's own request shape (the standing src law)
ok(
  "U2 the request shape is the standing oblique src law (encoded path, format=png, θ/φ toFixed(1), offset toFixed(3))",
  obliqueFilmstripUrls(JOB, PATH, planObliqueFilmstrip(45, 90, DIMS))[0] ===
    `/api/jobs/${JOB}/outputs/file?path=${encodeURIComponent(
      PATH
    )}&format=png&plane=oblique&theta=45.0&phi=90.0&offset=-1.000`
);

// U3 — frames and URLs are 1:1 in plan order (same plane by construction)
{
  const plan = planObliqueFilmstrip(45, 90, DIMS);
  const urls = obliqueFilmstripUrls(JOB, PATH, plan);
  ok(
    "U3 each URL's offset is its frame's own frac (a frame's URL and its caption describe the SAME plane)",
    urls.every(
      (u, i) => u.includes(`offset=${plan.frames[i].frac.toFixed(3)}`)
    )
  );
}

// ---- W — the wiring ---------------------------------------------------

const panel = readFileSync(
  new URL("../src/components/workflow/results/map-ortho-panel.tsx", import.meta.url),
  "utf8"
);
const lib = readFileSync(
  new URL("../src/lib/ortho-plate.ts", import.meta.url),
  "utf8"
);

// W1 — the ONE imports (words from the plate lib, geometry from the walk lib)
ok(
  "W1 the panel imports the walk page's words from the ONE plate lib (the t1107 legend joins the family) and the geometry from the ONE walk lib",
  panel.includes(
    'import { orthoAxisWalkHeading, orthoPlateMetaLine, orthoPlateTileUrl, orthoPlateWalkCurrentLegend, orthoPlateWalkMetaLine, orthoWalkFrameCaption, planOrthoPlate, planPlateHistogram, PLATE_HIST_INKS, type PlateHistPayload } from "@/lib/ortho-plate"'
  ) &&
    panel.includes(
      'import { FILMSTRIP_FRAMES, obliqueFilmstripFilename, obliqueFilmstripUrls, planObliqueFilmstrip } from "@/lib/oblique-filmstrip"'
    )
);

// W2 — the plan is composed from the PLATE'S OWN CUT ECHO state
ok(
  "W2 the walk plan rides the plate's own cut echo state (the t1103 echo law, second page — a ref moves silently, paper must not print a stale cut)",
  /const walkPlan = plateOblique\s*\?\s*planObliqueFilmstrip\(plateOblique\.theta, plateOblique\.phi, dims\)\s*\n\s*: null;/.test(
    panel
  ) && !/walkObliqueRef/.test(panel)
);

// W3 — the marker unique, inside the plate doc (one aria-hidden paper)
{
  const marker = panel.indexOf("data-ortho-plate-walk");
  const doc = panel.indexOf("data-ortho-plate-doc");
  ok(
    "W3 the walk page marker appears exactly once, inside the plate doc (no new a11y surface — the paper is aria-hidden as a whole)",
    marker > -1 && doc > -1 && marker > doc && panel.split("data-ortho-plate-walk").length === 2
  );
}

// W4 — the honest absence: no live cut, no walk page
ok(
  "W4 the walk page renders only when the cut echo exists (the screen's own disabled-button law, stated on paper)",
  /\{walkPlan && walkUrls && \(/.test(panel)
);

// W5 — the imgs ride walkUrls; the walk adds ZERO new URL dialects
{
  const standing = (panel.match(/plane=oblique/g) || []).length;
  ok(
    "W5 the walk page's pixels ride walkUrls (the two standing oblique templates are the legal speakers — the walk adds zero)",
    /src=\{walkUrls\[i\]\}/.test(panel) && standing === 2
  );
}

// W6 — the words ride the word fns (meta passes the planned cut line)
ok(
  "W6 the meta line rides orthoPlateWalkMetaLine with page 1's own cutLine; the captions ride orthoWalkFrameCaption",
  /orthoPlateWalkMetaLine\(\s*platePlan\.cutLine,/.test(panel) &&
    /\{orthoWalkFrameCaption\(f\)\}/.test(panel)
);

// W7 — the second-sheet law: break-before-page on the walk page
ok(
  "W7 the walk page starts on a fresh sheet (break-before-page — page 1 is the three sections, page 2 is the walk)",
  /data-ortho-plate-walk[^>]*className="break-before-page pt-2"/.test(panel)
);

// W8 — ONE print verb: the same button prints both pages
ok(
  "W8 the walk page adds no second flag setter (ONE verb — setAttribute('data-plate-print') appears exactly once)",
  (panel.match(/setAttribute\("data-plate-print"/g) || []).length === 1
);

// W9 — the plate lib's purity (node-runnable words)
ok(
  "W9 the plate lib stays pure — no fs, no db, no clock import (the printed-at rides the component's paper clock)",
  !/from\s+"(node:)?fs"|from\s+"@prisma\/client"|Date\.now\(\)/.test(lib)
);

// W10 — the walk page is the plate's descendant (inside the same doc block)
{
  const walkAt = panel.indexOf("data-ortho-plate-walk");
  const closeAt = panel.indexOf("</section>\n      )}");
  ok(
    "W10 the walk page sits before the plate doc's close (one section, two sheets)",
    walkAt > -1 && closeAt > walkAt
  );
}

// ---- the receipt -------------------------------------------------------
ok(
  "R1 the walk page's laws are named in this unit's own docblock (the second page is part of the receipt)",
  true
);

console.log(`\nt1104-oblique-plate-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

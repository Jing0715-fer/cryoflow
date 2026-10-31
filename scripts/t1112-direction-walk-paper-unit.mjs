/**
 * t1112 — the direction walk's PAPER unit: the cut's second walk gains
 * its paper edition — the plate's fourth page, six azimuth stations
 * around the box at the cut's own θ and depth.
 *
 * The story: the direction dial (t1111) gave the cut's second degree
 * of freedom its live screen face. The paper answered nothing: page 2
 * walks the cut THROUGH the box (offset), page 3 walks the box's own
 * axes — the direction (φ) walked nowhere on paper. The fourth page
 * joins the plate: six frames around the box, each rendered by the
 * SAME server truth (the walk lib's azimuth URL edition — the block's
 * own src law with the varying axis rotated), the current direction
 * wearing the mark family's ring (the ANGULAR seat's answer — the
 * wrap law holds on paper), the words riding the plate lib's own new
 * seats: the direction extent ("6 frames, around the box" — face to
 * face is the offset walk's word, the direction walk circles instead
 * of crossing) and the direction legend (the third dialect of the
 * t1107/t1108 legend family). The numbers first (the t1107 lesson):
 * the URL bytes below were computed in node before they were pinned.
 *
 * Bands: P the words and requests in numbers (the extent's own bytes,
 * the legend's bytes, the URL series' law — θ and offset held, φ over
 * the ladder only, the honest fallback, the wrap law riding the same
 * print stops); U the wiring receipts (the ONE seats, the import
 * family, the page's gate and order, the ring father, the caption
 * bytes, the page-1 cut line passed through); W the libs' law (no
 * DOM, the mirror-not-share family, the words as ONE father,
 * node-runnable).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  obliqueAzimuthVoice,
  obliqueDirectionWalkCurrentIndex,
  obliqueDirectionWalkUrls,
  planObliqueDirectionWalk,
} from "@/lib/oblique-filmstrip";
import {
  orthoPlateDirectionCurrentLegend,
  orthoPlateDirectionWalkMetaLine,
  orthoPlateObliqueCurrentLegend,
  orthoPlateWalkCurrentLegend,
} from "@/lib/ortho-plate";

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
const walkLibSrc = readFileSync(
  join(ROOT, "src/lib/oblique-filmstrip.ts"),
  "utf8"
);
const plateLibSrc = readFileSync(join(ROOT, "src/lib/ortho-plate.ts"), "utf8");

/* ------------------------------------------------------------------ */
/* P — the words and requests in numbers (computed before pinned)      */
/* ------------------------------------------------------------------ */

const stops = planObliqueDirectionWalk();

// P1 — the extent's own bytes: "6 frames, around the box" — the
// direction walk's own word, never page 2's "face to face"
ok(
  'P1 the direction extent speaks its own word — "6 frames, around the box"',
  orthoPlateDirectionWalkMetaLine(null, 6) === "6 frames, around the box"
);

// P2 — the meta line rides page 1's cut line verbatim (a realistic
// annotation byte string passed through — never recomputed, never
// reordered)
ok(
  "P2 the meta line joins the cut line verbatim — \"oblique cut 45°·90° · +30% · +9.6 vox · 6 frames, around the box\"",
  orthoPlateDirectionWalkMetaLine(
    "oblique cut 45°·90° · +30% · +9.6 vox",
    6
  ) ===
    "oblique cut 45°·90° · +30% · +9.6 vox · 6 frames, around the box"
);

// P3 — the extent counts the stops it is given (a degenerate ladder
// honestly says so)
ok(
  'P3 the extent counts its own argument — 4 stations say "4 frames, around the box"',
  orthoPlateDirectionWalkMetaLine(null, 4) === "4 frames, around the box"
);

// P4 — the legend's bytes: the direction dialect of the family
ok(
  'P4 the direction legend speaks its sentence — "the colored ring marks the cut\'s own direction on this walk"',
  orthoPlateDirectionCurrentLegend() ===
    "the colored ring marks the cut's own direction on this walk"
);

// P5 — the legend family stays THREE sentences (page 3 marks the
// tiles' planes, page 2 the cut's plane, page 4 the cut's direction —
// never one blurred word)
ok(
  "P5 the legend family is three distinct sentences — no two dialects share bytes",
  new Set([
    orthoPlateWalkCurrentLegend(),
    orthoPlateObliqueCurrentLegend(),
    orthoPlateDirectionCurrentLegend(),
  ]).size === 3
);

// P6 — the URL series' law in exact bytes (computed in node first):
// plane=oblique, θ toFixed(1) held, φ per station toFixed(1), offset
// toFixed(3) held, the path encoded
const urls = obliqueDirectionWalkUrls(
  "J1",
  "maps/run_data.mrc",
  30.0,
  0.2,
  stops
);
ok(
  "P6 the URL series' exact bytes — first and last stations (computed before pinned)",
  urls.length === 6 &&
    urls[0] ===
      "/api/jobs/J1/outputs/file?path=maps%2Frun_data.mrc&format=png&plane=oblique&theta=30.0&phi=0.0&offset=0.200" &&
    urls[5] ===
      "/api/jobs/J1/outputs/file?path=maps%2Frun_data.mrc&format=png&plane=oblique&theta=30.0&phi=300.0&offset=0.200"
);

// P7 — θ and offset are the cut's own: EVERY frame holds them
ok(
  "P7 the held axes hold — all six URLs carry theta=30.0 and offset=0.200",
  urls.every(
    (u) => u.includes("theta=30.0") && u.includes("offset=0.200")
  )
);

// P8 — φ walks the ladder only: the six station azimuths in order, no
// φ 360 duplicate (the circle's own wrap, the ladder excludes it)
ok(
  "P8 φ varies over the ladder only — [0,60,120,180,240,300] in the URLs, 360 honestly absent",
  JSON.stringify(urls.map((u) => Number(u.match(/phi=([\d.]+)/)[1]))) ===
    "[0,60,120,180,240,300]"
);

// P9 — the honest fallback: non-finite θ/offset never print "NaN"
// bytes into a request (the defaults, not an invented plane)
ok(
  "P9 non-finite θ/offset fall back to zeros — no NaN bytes in a request",
  obliqueDirectionWalkUrls("J1", "p.mrc", NaN, 0.2, [{ phi: 0 }])[0].includes(
    "theta=0.0"
  ) &&
    obliqueDirectionWalkUrls("J1", "p.mrc", 30, NaN, [{ phi: 0 }])[0].includes(
      "offset=0.000"
    )
);

// P10 — purity: the URL seat never mutates the stops it rides
{
  const before = JSON.stringify(stops);
  obliqueDirectionWalkUrls("J1", "p.mrc", 10, 0.1, stops);
  ok(
    "P10 the URL seat is pure — the stops survive untouched",
    JSON.stringify(stops) === before
  );
}

// P11 — the wrap law rides the SAME print stops the paper marks with:
// a cut at 350° rings φ 0° on paper exactly as the screen dial does
// (one mark, one truth — the straight difference would say 300)
ok(
  "P11 the wrap law holds on paper's own stops — live 350 rings φ 0° (index 0)",
  obliqueDirectionWalkCurrentIndex(stops, 350) === 0
);

// P12 — the print stops are the dial's stations: the paper's frames
// and the screen's stops are the same ladder (one plan seat, no
// second station dialect)
ok(
  "P12 the print stops ARE the dial's ladder — six stations with the voice's own labels",
  stops.length === 6 && stops[1].label === "φ 60°"
);

// P13 — the voice father: the paper's captions and the dial's chips
// speak the same seat (obliqueAzimuthVoice's bytes)
ok(
  "P13 the station voice is the ONE seat's bytes — φ 0° and φ 300°",
  stops[0].label === obliqueAzimuthVoice(0) &&
    stops[5].label === obliqueAzimuthVoice(300)
);

/* ------------------------------------------------------------------ */
/* U — the wiring receipts                                             */
/* ------------------------------------------------------------------ */

// U1 — ONE extent seat: "around the box" is coined exactly once in the
// words lib (the template string is the coin; the comment prose quotes
// the father — the pin hunts COINS, not words), and the offset walk's
// "face to face" keeps its own seat (the two extents never share a
// phrase — mirror, not merge)
{
  const coins = plateLibSrc.match(/`[^`\n]*around the box[^`\n]*`/g) || [];
  ok(
    'U1 ONE extent seat — "around the box" coined once (the offset walk\'s "face to face" stays its own)',
    coins.length === 1 &&
      coins[0] === "`${frames} frames, around the box`" &&
      plateLibSrc.includes("frames, face to face")
  );
}

// U2 — ONE legend seat: the direction legend's bytes are coined once
ok(
  "U2 ONE legend seat — the direction sentence coined exactly once in the words lib",
  (plateLibSrc.match(/marks the cut's own direction on this walk/g) || [])
    .length === 1
);

// U3 — ONE URL seat: the azimuth URL edition is defined once in the
// walk lib and the direction page's frames ride the seat's array (the
// export canvas keeps its own inline builder — the t1096 face's own
// law, untouched; the pin hunts the DIRECTION page's src, not the
// whole panel's history)
ok(
  "U3 ONE URL seat — obliqueDirectionWalkUrls defined once, the direction page's img rides the seat array",
  (walkLibSrc.match(/export function obliqueDirectionWalkUrls/g) || [])
    .length === 1 &&
    /data-ortho-plate-direction-walk[\s\S]*?src=\{directionPrintUrls\[i\]\}/.test(
      panelSrc
    )
);

// U4 — the import family grew: the words line carries the two new
// seats, the walk line carries the URL edition (the family-growth
// re-key precedent — reason named in the re-keyed pins; the lines stay
// the file's own single-line form)
ok(
  "U4 the import receipts — orthoPlateDirectionWalkMetaLine + orthoPlateDirectionCurrentLegend + obliqueDirectionWalkUrls join the panel's import lines (the t1115 re-key: the extent word seat + the filename edition joined the same lines, the receipts speak the final bytes)",
  panelSrc.includes(
    "orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkExtentWord, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine"
  ) &&
    panelSrc.includes(
      "obliqueDirectionWalkCurrentIndex, obliqueDirectionWalkFilename, obliqueDirectionWalkUrls, obliqueFilmstripFilename"
    )
);

// U5 — the page exists exactly once: one marker, one aria-hidden paper
ok(
  "U5 the fourth page is ONE — data-ortho-plate-direction-walk appears exactly once",
  (panelSrc.match(/data-ortho-plate-direction-walk/g) || []).length === 1
);

// U6 — the gate rides the live cut echo: no cut → the page honestly
// stays home (page 2's own law, stated on paper again)
ok(
  "U6 the gate rides the plate's own cut echo — no live cut, no page",
  /\{plateOblique && directionPrintUrls && \(/.test(panelSrc)
);

// U7 — the page rides the plate's OWN seats: the ladder, the URLs and
// the mark are the lib's three seats composed in the panel — no
// inline station array, no inline index math
ok(
  "U7 the page rides the plate's own seats — planObliqueDirectionWalk + obliqueDirectionWalkUrls + obliqueDirectionWalkCurrentIndex",
  /const directionPrintStops = planObliqueDirectionWalk\(\);/.test(panelSrc) &&
    /obliqueDirectionWalkUrls\(\s*jobId,/.test(panelSrc) &&
    /obliqueDirectionWalkCurrentIndex\(directionPrintStops, plateOblique\.phi\)/.test(
      panelSrc
    )
);

// U8 — the ring father: the current station wears the cut's violet
// (EXPORT_OBLIQUE_ACCENT, page 2's own ring bytes — zero new ink) at
// 2px against the stops' 1px
ok(
  "U8 the ring rides the mark father — EXPORT_OBLIQUE_ACCENT borderColor on the current station, border-2 against 1px",
  /directionPrintCurrent\s*\?\s*"border-2"/.test(panelSrc) &&
    /i === directionPrintCurrent\s*\?\s*\{ borderColor: EXPORT_OBLIQUE_ACCENT \}/.test(
      panelSrc
    )
);

// U9 — the captions ride the station's voice: the figcaption prints
// the ladder's own label bytes, never a second caption dialect
ok(
  "U9 the captions ride the station's own voice — {s.label} in the direction page's figcaption",
  /data-ortho-plate-direction-walk[\s\S]*?\{s\.label\}/.test(panelSrc)
);

// U10 — the document order: the direction page sits AFTER the axis
// walks (page 3) and the oblique walk (page 2) — break-before-page
// follows the file's own order
{
  const i2 = panelSrc.indexOf("data-ortho-plate-walk");
  const i3 = panelSrc.indexOf("data-ortho-plate-axis-walks");
  const i4 = panelSrc.indexOf("data-ortho-plate-direction-walk");
  ok(
    "U10 the document order — page 2, page 3, page 4 in file order (break-before-page walks the file)",
    i2 > -1 && i3 > i2 && i4 > i3
  );
}

// U11 — the meta line rides page 1's cut line: the JSX passes
// platePlan.cutLine (the annotation voice's bytes — never recomputed)
ok(
  "U11 the meta rides page 1's cut line — platePlan.cutLine passed through, the extent counts the print stops",
  /orthoPlateDirectionWalkMetaLine\(platePlan\.cutLine, directionPrintStops\.length\)/.test(
    panelSrc
  )
);

// U12 — the header speaks the page's name: "Direction walk" (the
// family's naming: Oblique walk, Axis walks, Direction walk)
ok(
  'U12 the header names the page — "Direction walk"',
  panelSrc.includes(">Direction walk<")
);

// U13 — the legend prints on the page: the direction legend's seat is
// called in the direction page's own JSX
ok(
  "U13 the legend prints on its page — orthoPlateDirectionCurrentLegend() inside the direction page's JSX",
  /data-ortho-plate-direction-walk[\s\S]*?orthoPlateDirectionCurrentLegend\(\)/.test(
    panelSrc
  )
);

/* ------------------------------------------------------------------ */
/* W — the libs' law                                                   */
/* ------------------------------------------------------------------ */

// W1 — no DOM in the libs: the walk lib and the words lib decide
// everything before a pixel prints (prose "document." is not DOM —
// the pin hunts CALLS, not words)
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments (JSX {/* … */} included — prose quotes the father, code coins it)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
ok(
  "W1 the libs stay DOM-free — no document call in either lib's code (prose is not a call)",
  !/document\.\w+\(/.test(stripComments(walkLibSrc)) &&
    !/document\.\w+\(/.test(stripComments(plateLibSrc))
);

// W2 — the family mirrors, never shares: the azimuth URL edition is
// its own function beside obliqueFilmstripUrls (the t1098 precedent —
// sibling walks mirror their laws, no parameterized merge)
ok(
  "W2 the family mirrors — obliqueFilmstripUrls still its own seat, the azimuth edition beside it (no merge)",
  (walkLibSrc.match(/export function obliqueFilmstripUrls/g) || []).length ===
    1 &&
    (walkLibSrc.match(/export function obliqueDirectionWalkUrls/g) || [])
      .length === 1
);

// W3 — the words live in the ONE father: the extent phrase and the
// legend bytes are coined in the words lib only — the panel's code
// carries no extent coin of its own (the direction dial's aria-label
// prose "azimuths around the box" is the t1111 screen face's own
// words, not a coin — the pin hunts the extent SHAPE, not a substring)
{
  const panelCode = stripComments(panelSrc);
  ok(
    'W3 the words are the lib\'s ONE father — no "frames, around the box" coin and no legend coin in the panel\'s code',
    !panelCode.includes("frames, around the box") &&
      !panelCode.includes("marks the cut's own direction")
  );
}

// W4 — node-runnable: the words lib imports nothing browser-shaped
// (the unit itself is the proof — it ran in node to pin these bytes)
ok(
  "W4 the words lib stays node-runnable — no react, no browser module in its imports",
  !/from "(react|react-dom|next[^"]*)"/.test(plateLibSrc)
);

// W5 — the honest extent: the direction meta line returns the extent
// alone for a null cut line (the page says nothing about a cut it
// cannot see — the family's silence law)
ok(
  "W5 the honest extent — a null cut line still names the walk, says nothing about a cut",
  orthoPlateDirectionWalkMetaLine(null, 6) === "6 frames, around the box" &&
    !orthoPlateDirectionWalkMetaLine(null, 6).includes("oblique cut")
);

/* ------------------------------------------------------------------ */
/* the verdict                                                         */
/* ------------------------------------------------------------------ */

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

/**
 * t1111 — the direction DIAL unit: the cut's second walk gains its LIVE
 * screen face — the azimuth ladder (six stations around the box) with
 * the mark family's ANGULAR edition.
 *
 * The story: the cut's offset walk got its "you are here" three ways —
 * the export canvas and the paper's page 2 (t1108), then the live
 * dial (t1109). But the cut's OTHER degree of freedom — the direction
 * (θ, φ) — had no invitation face: a hand exploring orientations had
 * only the raw slider. The direction dial joins the φ slider's own
 * neighborhood: six stations (φ 0°…300° at 60° steps), a click walks
 * the cut to that azimuth through scrubPhi (the slider's own door —
 * no second channel; the dial IS a hand, so the t559 law reads it the
 * slider's way: the provenance revokes), and the current stop wears
 * the block's violet (the mark family's father — 2px against the
 * stops' 1px). The mark is ANGULAR: the wrap seat
 * (obliqueDirectionWalkCurrentIndex) measures min(|a−b|, 360−|a−b|)
 * — 350° stands nearer 0° than 300°, a straight difference would lie.
 * The numbers first (the t1107 lesson): the pins below were computed
 * in node before they were pinned.
 *
 * Bands: P the angular law in numbers (ladder shape, the wrap proof,
 * the tie law — the default φ 30°'s own mount reading, the honest
 * nulls, the voice's bytes); U the wiring receipts (ONE dial, ONE
 * door, the hand's phi, the group's words, the ring father,
 * placement, the import family); W the lib's law (purity, node-
 * runnable, the ladder's wrap excludes 360).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIRECTION_STATIONS,
  obliqueAzimuthVoice,
  obliqueDirectionWalkCurrentIndex,
  obliqueDirectionWalkFilename,
  planObliqueDirectionWalk,
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
const libSrc = readFileSync(
  join(ROOT, "src/lib/oblique-filmstrip.ts"),
  "utf8"
);

/* ------------------------------------------------------------------ */
/* P — the angular law in numbers (computed before pinned)             */
/* ------------------------------------------------------------------ */

const stops = planObliqueDirectionWalk();
const phis = stops.map((s) => s.phi);

// P1 — the ladder's shape: six ascending stations, 60° apart
ok(
  "P1 the ladder is six stations [0,60,120,180,240,300] ascending",
  DIRECTION_STATIONS === 6 &&
    JSON.stringify(phis) === "[0,60,120,180,240,300]" &&
    phis.every((v, i) => i === 0 || v > phis[i - 1])
);

// P2 — the wrap proof: 350° stands nearer φ 0° than φ 300°
ok(
  "P2 the mark wraps — live 350 rings φ 0° (index 0), the straight difference would say 300",
  obliqueDirectionWalkCurrentIndex(stops, 350) === 0
);

// P3 — the wrap TIE: 330° is exactly 30° from both φ 0° (around the
// seam) and φ 300°; the family's first-minimal law rings φ 0° (the
// ladder's own reading order — the ascending ladder makes first-
// minimal the tie pair's lower index)
ok(
  "P3 the wrap tie — live 330 (30° from both φ 0° and φ 300°) rings φ 0° (first minimal in ladder order)",
  obliqueDirectionWalkCurrentIndex(stops, 330) === 0
);

// P4 — the exact hit: a hand on a station rings it
ok(
  "P4 the exact hit — live 180 rings index 3",
  obliqueDirectionWalkCurrentIndex(stops, 180) === 3
);

// P5 — the mount reading: the default φ 30° is exactly the 0/60
// midpoint — the tie law's own reading, index 0 (the family's law on
// the screen at mount, the t1107/t1108 tie lineage's angular edition)
ok(
  "P5 the mount tie — the default φ 30° (exactly between φ 0° and φ 60°) rings φ 0°",
  obliqueDirectionWalkCurrentIndex(stops, 30) === 0
);

// P6 — the adjacent tie mirrors: 90° between 60 and 120 rings 60
ok(
  "P6 the adjacent tie mirrors — live 90 rings index 1 (φ 60°)",
  obliqueDirectionWalkCurrentIndex(stops, 90) === 1
);

// P7 — the near-face wrap: 355° is 5° around the seam from φ 0°
ok(
  "P7 the near-face wrap — live 355 rings φ 0° (5° around the seam)",
  obliqueDirectionWalkCurrentIndex(stops, 355) === 0
);

// P8 — the mid-band hit: 185° nearest 180°
ok(
  "P8 the mid-band hit — live 185 rings index 3 (φ 180°)",
  obliqueDirectionWalkCurrentIndex(stops, 185) === 3
);

// P9 — the out-of-range wrap: the seat does not police range — the
// circle answers 361° the circle's own way (361 ≡ 1 → φ 0°); the
// sliders clamp upstream
ok(
  "P9 out-of-range is not policed — live 361 wraps to φ 0°",
  obliqueDirectionWalkCurrentIndex(stops, 361) === 0
);

// P10 — the honest null family: no hand, no mark (and an empty ladder
// cannot ring anything)
ok(
  "P10 the honest null family — NaN/null/undefined and an empty ladder return null",
  obliqueDirectionWalkCurrentIndex(stops, NaN) === null &&
    obliqueDirectionWalkCurrentIndex(stops, null) === null &&
    obliqueDirectionWalkCurrentIndex(stops, undefined) === null &&
    obliqueDirectionWalkCurrentIndex([], 30) === null
);

// P11 — purity: the input is never mutated, the output owns no
// reference to it
{
  const before = JSON.stringify(stops);
  obliqueDirectionWalkCurrentIndex(stops, 350);
  const custom = planObliqueDirectionWalk(4);
  custom.push({ phi: 1, label: "x" });
  const fresh = planObliqueDirectionWalk(4);
  ok(
    "P11 purity — the stops are untouched and each plan call builds its own ladder",
    JSON.stringify(stops) === before &&
      JSON.stringify(fresh.map((s) => s.phi)) === "[0,90,180,270]"
  );
}

// P12 — the wrap law in the ladder itself: φ=360 is honestly absent
// (it IS φ=0 — the ladder never names the same plane twice)
ok(
  "P12 the ladder excludes 360 — the circle's duplicate is honestly absent",
  !phis.includes(360) && phis[phis.length - 1] === 300
);

// P13 — the voice's bytes: "φ 60°" — the φ prefix disambiguates the
// θ slider's degrees; the round law and the non-finite fallback
ok(
  "P13 the voice speaks 'φ 60°' — whole degrees, non-finite falls to φ 0°",
  obliqueAzimuthVoice(60) === "φ 60°" &&
    obliqueAzimuthVoice(59.6) === "φ 60°" &&
    obliqueAzimuthVoice(NaN) === "φ 0°"
);

// P14 — the degenerate counts fall back to six (a shrug is not a
// protractor)
ok(
  "P14 degenerate stop counts fall back to six — 1, 0 and non-integers",
  planObliqueDirectionWalk(1).length === 6 &&
    planObliqueDirectionWalk(0).length === 6 &&
    planObliqueDirectionWalk(2.5).length === 6
);

// P15 — the step law: even spacing, 360/n for every ladder
{
  const even = (arr) =>
    arr.every((v, i) => i === 0 || v - arr[i - 1] === 360 / arr.length);
  ok(
    "P15 the step law — even 360/n spacing for the six and the four ladders",
    even(planObliqueDirectionWalk(6).map((s) => s.phi)) &&
      even(planObliqueDirectionWalk(4).map((s) => s.phi))
  );
}

/* ------------------------------------------------------------------ */
/* U — the wiring receipts (the panel speaks the seats, once each)     */
/* ------------------------------------------------------------------ */

// U1 — ONE dial: the marker is unique (ONE invitation face, no
// second dial dialect)
ok(
  'U1 ONE dial — data-canvas-ui="ortho-oblique-direction-dial" appears exactly once',
  panelSrc.split('data-canvas-ui="ortho-oblique-direction-dial"').length === 2
);

// U2 — ONE door: the stations' clicks ride scrubPhi (the slider's
// own door — no second channel); the dial is a hand, so the t559 law
// reads it the slider's way (scrubPhi revokes the provenance). The
// map body appears ONCE and renders the six stops — the pin hunts
// the door, not the copies (the offset dial's own shape).
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-direction-dial"');
  const block = at >= 0 ? panelSrc.slice(at, at + 2200) : "";
  const clicks = block.match(/onClick=\{\(\) => scrubPhi\(/g) || [];
  ok(
    "U2 ONE door — ONE map body riding scrubPhi renders the six stops; no direct setPhi writer",
    clicks.length === 1 &&
      block.includes("directionStops.map(") &&
      !block.includes("setPhi(")
  );
}

// U3 — the mark rides the HAND's phi through the ONE angular seat: no
// live dialect, no percent translation (degrees speak degrees)
ok(
  "U3 the mark rides the hand's phi — ONE seat call, no translation",
  (panelSrc.match(/obliqueDirectionWalkCurrentIndex\(directionStops, phi\)/g) || [])
    .length === 1 &&
    !panelSrc.includes("obliqueDirectionWalkCurrentIndex(directionStops, live")
);

// U4 — the ladder rides the ONE plan: no inline station math (no
// literal azimuth array near the dial). The t1112 re-key: the call
// count grew 1 → 2 — the direction page's print seats ride the SAME
// ladder (the paper's fourth page plans its frames from the ONE plan
// seat, never a second station dialect), reason named. t1115 re-key
// 2 → 3 — the direction walk's EXPORT joins (the family's last honest
// gap closed): the export's compositor plans its frames from the SAME
// ONE seat — three faces of one ladder (the dial, the paper, the
// document), reason named.
ok(
  "U4 the ladder rides the ONE plan — planObliqueDirectionWalk() thrice (the dial + the t1112 print page + the t1115 export riding the same ONE seat), no inline azimuth array",
  (panelSrc.match(/planObliqueDirectionWalk\(\)/g) || []).length === 3 &&
    !panelSrc.includes("[0, 60, 120") &&
    !panelSrc.includes("[0,60,120")
);

// U5 — the speaking stops: aria-pressed on every station, the current
// one prefixed ("The cut's own direction — "), every station named
// ("of the azimuth circle"), the voice's bytes on the chip
ok(
  "U5 the stops speak — aria-pressed + the current prefix + the azimuth-circle name + data-direction-stop",
  panelSrc.includes('aria-pressed={current}') &&
    panelSrc.includes('"The cut\'s own direction — "') &&
    panelSrc.includes("of the azimuth circle") &&
    panelSrc.includes("data-direction-stop={s.label}")
);

// U6 — the group's words: the invitation names the circle and the
// ring ("six azimuths around the box; the ringed stop is the cut's
// own direction") and asks for the hand ("Click a stop to walk the
// cut there" — the wake language's word edition)
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-direction-dial"');
  const block = at >= 0 ? panelSrc.slice(at - 200, at + 500) : "";
  ok(
    "U6 the group's words — the aria-label names the ring, the title asks for the hand",
    block.includes("six azimuths around the box; the ringed stop is the cut's own direction") &&
      block.includes("Click a stop to walk the cut there")
  );
}

// U7 — the ring father: the current stop wears the block's violet
// (the mark family's father — zero new ink), 2px against 1px; the
// unmarked stops keep the hover language
{
  const at = panelSrc.indexOf('data-canvas-ui="ortho-oblique-direction-dial"');
  const block = at >= 0 ? panelSrc.slice(at, at + 1600) : "";
  ok(
    "U7 the ring father — border-2 border-violet-600 on the current stop, the hover language on the rest",
    block.includes("border-2 border-violet-600 bg-violet-600/10") &&
      block.includes("hover:border-violet-600/40")
  );
}

// U8 — the placement: the dial sits inside the φ slider's own div —
// the oblique-phi id before it, the oblique-offset id after it (the
// offset dial's placement law, mirrored)
{
  const phiAt = panelSrc.indexOf('id="oblique-phi"');
  const dialAt = panelSrc.indexOf('data-canvas-ui="ortho-oblique-direction-dial"');
  const offAt = panelSrc.indexOf('id="oblique-offset"');
  ok(
    "U8 the placement — the dial lives between the φ slider and the offset slider",
    phiAt > 0 && dialAt > phiAt && offAt > dialAt
  );
}

// U9 — the import family grew the t1111 receipt (the ONE lib line
// names the direction dial's seats)
ok(
  'U9 the import family grew the t1111 receipt ("t1111 — the direction dial rides the lib\'s azimuth ladder")',
  panelSrc.includes("t1111 — the direction dial rides the lib's azimuth ladder")
);

// U10 — the seats' comments ride the panel (the law's own words: the
// circle's law and the hand's law, where the code reads them)
ok(
  "U10 the dial's law comments live in the panel — the angular mark and the t559 hand reading",
  panelSrc.includes("350° stands nearer 0° than") &&
    panelSrc.includes("dial IS a hand, so the t559 law reads it the")
);

/* ------------------------------------------------------------------ */
/* W — the lib's law (node-runnable, pure, the family's mirror)        */
/* ------------------------------------------------------------------ */

// W1 — the lib stays node-runnable: no DOM usage (the plan and the
// mark are decided before a single click flies; the prose word
// "document" in a comment is not a DOM — the pin hunts the calls)
ok(
  "W1 the lib stays node-runnable — no DOM calls in oblique-filmstrip.ts",
  !libSrc.includes("window.") &&
    !libSrc.includes("document.createElement") &&
    !libSrc.includes("getContext")
);

// W2 — the family mirror: the direction seat mirrors the frac seat's
// law in its own body (never shares code — the t1098 precedent): the
// lib carries both seats, each with its own loop
ok(
  "W2 the family mirror — both mark seats live in the lib, each its own body",
  libSrc.includes("export function obliqueWalkCurrentIndex(") &&
    libSrc.includes("export function obliqueDirectionWalkCurrentIndex(")
);

// W3 — the t1111 section speaks its laws in the lib (the wrap, the
// wrap-excluded ladder, the mark's angular distance)
ok(
  "W3 the lib's section speaks the laws — the wrap law and the honest absence of 360",
  libSrc.includes("t1111 — the direction DIAL") &&
    libSrc.includes("min(|a−b|, 360−|a−b|)") &&
    libSrc.includes("φ=360 is honestly absent")
);

// W4 — the voice lives in the lib (ONE father: the stations carry its
// bytes; no second label dialect may grow elsewhere)
ok(
  "W4 the voice lives in the lib — obliqueAzimuthVoice is the stations' one father",
  libSrc.includes("export function obliqueAzimuthVoice(") &&
    libSrc.includes("label: obliqueAzimuthVoice(phi)")
);

/* ------------------------------------------------------------------ */
/* t1115 — the direction walk's EXPORT: the family's last honest gap.  */
/* The numbers first (the t1107 lesson): the filename grammar's pins   */
/* are computed calls, not string hopes.                               */
/* ------------------------------------------------------------------ */

// E1 — the filename's grammar: the walk family's own word, the base
// stripped of its map extension, the HHMMSS stamp
ok(
  "E1 the filename speaks the family grammar — oblique-direction-walk-cm_t982_class001-<stamp>.png",
  obliqueDirectionWalkFilename("/a/b/cm_t982_class001.mrc", "063000") ===
    "oblique-direction-walk-cm_t982_class001-063000.png"
);

// E2 — the .mrcs edge: the stack extension strips too (the grammar's
// own alternation — one name law for both map kinds)
ok(
  "E2 the filename strips .mrcs too — oblique-direction-walk-stack-<stamp>.png",
  obliqueDirectionWalkFilename("/x/stack.mrcs", "120001") ===
    "oblique-direction-walk-stack-120001.png"
);

// E3 — the lib owns the name (ONE father): the filename seat is the
// lib's export, not a panel-local string
ok(
  "E3 the name lives in the lib — obliqueDirectionWalkFilename is the lib's export",
  libSrc.includes("export function obliqueDirectionWalkFilename(") &&
    libSrc.includes("oblique-direction-walk-")
);

// E4 — the panel rides the lib's name (the import family grew; the
// panel never hardcodes the document's name)
ok(
  "E4 the panel rides the lib's name — the import family grew the filename seat",
  panelSrc.includes("obliqueDirectionWalkFilename")
);

// E5 — the URL's offset rides the /100 translation BORN IN (the t1109
// lesson): the slider's percent never crosses raw into the request
// dialect (the seat speaks the scene's fraction)
ok(
  "E5 the export's offset speaks the fraction dialect — live.offset / 100 rides the URL seat",
  panelSrc.includes(
    "obliqueDirectionWalkUrls(jobId, path, live.theta, live.offset / 100, plan)"
  )
);

// E6 — the export rides the SAME three lib seats the paper's page 4
// rides (the ONE plan, the azimuth URLs, the angular mark) — the
// sibling-walks mirror, never a second geometry
ok(
  "E6 the export rides the page-4 seats — the plan, the URLs and the mark are the ONE lib's",
  panelSrc.includes("const plan = planObliqueDirectionWalk();") &&
    panelSrc.includes("obliqueDirectionWalkCurrentIndex(plan, live.phi)")
);

// E7 — ONE export button: the direction export mounts exactly once,
// in the block's own header row, next to the offset walk's export
// (the family's own seat — no second invitation face)
ok(
  "E7 ONE direction export — data-canvas-ui=\"ortho-oblique-direction-export\" appears exactly once, beside the walk export",
  (panelSrc.match(/data-canvas-ui="ortho-oblique-direction-export"/g) || []).length === 1 &&
    panelSrc.indexOf("<ObliqueDirectionStripButton") <
      panelSrc.indexOf("</div>", panelSrc.indexOf("<ObliqueFilmstripButton"))
);

// E8 — the button speaks the extent's own word (the meta line's
// "frames, around the box" — the paper's fourth page's bytes) and the
// station count rides the lib's constant (no second six)
ok(
  "E8 the button rides the extent word's ONE father — orthoPlateDirectionWalkExtentWord(DIRECTION_STATIONS) in the aria, the words law's own shape (no coin in the panel's code; the t1115 words-cure re-key — the raw coin left the panel, the lib's seat speaks)",
  panelSrc.includes(
    "orthoPlateDirectionWalkExtentWord(DIRECTION_STATIONS)"
  ) && panelSrc.includes("orthoPlateDirectionWalkExtentWord(n)")
);

// E9 — the grid is the walk family's own measures: THREE compositor
// blocks now speak the same TILE/LABEL/HEAD/FOOT/GAP numbers (the
// offset walk, the axis walks, the direction walk — one publishing
// language, three documents)
ok(
  "E9 the family's grid measures — three compositor blocks, the same numbers",
  (panelSrc.match(/const TILE = 220;/g) || []).length === 3 &&
    (panelSrc.match(/const LABEL_H = 26;/g) || []).length === 3
);

console.log(`GREEN: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

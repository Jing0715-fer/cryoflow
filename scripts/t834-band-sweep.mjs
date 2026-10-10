#!/usr/bin/env node
/**
 * t834 — the sm-band audit's SECOND instrument: the live-sweep, persisted.
 *
 * Carried twice (the t832 and t833 tails both named it): the six-band
 * sweep that pinned the header's per-band numbers lived only in the
 * window that ran it — a session of agent-browser calls, unreproducible
 * by the next window. This script IS the instrument: one command drives
 * agent-browser through the six bands and re-witnesses the audit's
 * pinned numbers against the shipping build.
 *
 *   node scripts/t834-band-sweep.mjs
 *
 * Per band (375 / 640 / 768 / 1024 / 1280 / 1536) it measures, LIVE:
 *   - the left cluster (header child 0): its width AND each child's
 *     width (brand icon / wordmark / ViewSwitcher / middle tier) —
 *     the child-level truth the left-cluster closed form closes against;
 *   - the actions cluster (header child 1): width, visible seat count,
 *     AND each seat's own width (the t835 symmetric completion — the
 *     left got per-child anatomy, the right rides the same ruler);
 *   - the middle tier's internals at xl/2xl (midKids: the two triggers,
 *     the 2000px counters, the 2xl lens chip) and the PROJECT TRIGGER'S
 *     FLOOR BEHAVIOR — at the exact xl boundary the trigger rides its
 *     130px min-width floor while its wrapper yields below it, and the
 *     overflow PAINTS 2.7px into the RELION chip's box (the t510
 *     residue, filmed and pinned in section D — the fix window's
 *     ratchet: land the fix, move the pin);
 *   - horizontal overflow (scrollWidth vs innerWidth).
 *
 * Section E (t836): the t510 residue's ZONE FORMALIZATION — the t835
 * characterization ("zone [1280, ~1289], clear by 1290") measured in
 * 1px steps and pinned as assertions, so the fix window starts at the
 * verified zone, not at the rediscovery. The zone's laws, live-pinned:
 *   - LEFT-ANCHORED at xl: below 1280 the middle tier sleeps (hidden
 *     xl:flex) — the zone cannot start below 1280;
 *   - LINEAR with slope −0.4px/px: overlap(W) = 2.7 − 0.4×(W−1280)
 *     (the wrapper reclaims 0.4px per viewport px, the row's other
 *     yielders absorb 0.6);
 *   - the edge: last paint 1286 (+0.3), first clear 1287 (−0.1) — the
 *     t835 "clear by ~1290" was the named point (1290 = −1.3 exact),
 *     the measured edge is tighter;
 *   - NO RE-PAINT: from 1287 through 1440 the overlap stays ≤ 0
 *     (1366 = −12, 1440 = −33.1, the t835 named points);
 *   - the PAINT WITNESS: inside the band the topmost element is the
 *     CHIP (DOM-order hit-test) whose background is transparent — the
 *     trigger's edge paint shows through, and the chip owns the click.
 *     The fix window's option (a) (overflow-hidden) changes the paint,
 *     NOT the geometry — its ratchet needs a paint-honest witness
 *     (this one), not the raw rect delta alone.
 *
 * Section E grown (t841, the zone's second instrument): the measure
 * itself gained two teeth — the STACK witness (document.elementsFromPoint
 * at the band point: the residue's paint is real iff the TRIGGER is in
 * the stack; hit-testing respects overflow clipping, so the fix's flip
 * is a per-width measured delta) and the wrapper's computed overflow-x
 * (the fix's own fingerprint, watched in reverse). New assertions:
 *   - E9: the TRIGGER is in the stack at every PAINTED width (the paint
 *     is real across the zone, not just at the D4 pin's 1280);
 *   - E10: overflow-x 'visible' at every awake zone width — when the
 *     fix lands, E10 goes red FIRST and names the ratchet to flip.
 * The pre-fix rows ride the receipt with the stack aboard, so the
 * post-fix world is compared per-width against filmed truth.
 *
 * The receipt lands in shots-qa/t834-band-sweep.json (provenance: BUILD_ID
 * read from .next/BUILD_ID at run time). The assertions pin TODAY's truth:
 * left 68/114/264/266/608/864, right 236/334/460/628, seats 6/8/11/12/12/12,
 * hOv false everywhere — the same numbers the t832 probe (A3/A4) closes
 * against, now re-witnessable in one command.
 *
 * The instrument is also the audit's teacher: a FUTURE seat or tier cut
 * moves these numbers, and this script is where the drift surfaces first.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BANDS = [375, 640, 768, 1024, 1280, 1536];
const HEIGHT = 800;

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
};

const ab = (args) =>
  execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });

/** agent-browser eval prints the JSON string-encoded; unwrap (twice). */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") out = JSON.parse(out);
  return out;
};

/* ---------- provenance: the world this sweep witnesses ---------- */
const buildId = readFileSync(join(ROOT, ".next/BUILD_ID"), "utf8").trim();
console.log(`t834 band sweep — build ${buildId}, six bands, one command\n`);

/* the measure: child-level truth, one eval per band — single line, the
 * shell hands it to agent-browser verbatim (multi-line evals break) */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'header not found' }); const left = hdr.children[0]; const right = hdr.children[1]; const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const kids = [...left.children].map((c) => ({ cls: (c.className || '').slice(0, 60), w: kid(c) })); const vis = kids.filter((k) => k.w > 0); const rk = [...right.children].map((c) => ({ lbl: c.getAttribute('aria-label') || (c.className || '').slice(0, 30), w: kid(c) })); const rVis = rk.filter((k) => k.w > 0); const mid = left.children[3]; let midKids = null; let ps = null; if (mid && mid.getBoundingClientRect().width > 0) { midKids = [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || (c.className || '').slice(0, 30), w: kid(c) })); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = right.children[0]; if (psTrig && chip && chip.getBoundingClientRect().width > 0) { const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); ps = { trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10 }; } } const seats = rVis.length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats, kids, vis, rightKids: rVis, midKids, ps, innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth }); })()";

const rows = {};
for (const band of BANDS) {
  ab(`set viewport ${band} ${HEIGHT}`);
  ab("wait 350");
  const m = evalJson(MEASURE);
  if (m.error) {
    fail++;
    console.log(`  ✗ ${band}: ${m.error}`);
    continue;
  }
  rows[band] = m;
  console.log(
    `  ${band}: left ${m.leftW} / right ${m.rightW} / seats ${m.seats} / hOv ${m.scrollW > m.innerW}`
  );
}

/* restore the working band */
ab("set viewport 1280 800");

/* ---------- the pinned truth (provenance: the t832 sweep, re-witnessed here) ---------- */
console.log("\nA — the pinned numbers re-witnessed (the t832 audit's live half)");
const PINNED = {
  left: { 375: 68, 640: 114, 768: 264, 1024: 266, 1280: 608, 1536: 864 },
  right: { 375: 236, 640: 334, 768: 460, 1024: 460, 1280: 628, 1536: 628 },
  seats: { 375: 6, 640: 8, 768: 11, 1024: 11, 1280: 12, 1536: 12 },
};
// The pinned integers are the truth at rounding precision — the live
// DOM carries subpixels (the wordmark's text, the chip's 162.3). The
// instrument measures at 0.1px and closes within half a pixel.
const close = (a, b) => Math.abs(a - b) <= 0.5;
for (const band of BANDS) {
  const m = rows[band];
  if (!m) continue;
  ok(
    close(m.leftW, PINNED.left[band]),
    `B${band} left = ${PINNED.left[band]} (±0.5) — got ${m.leftW}`
  );
  ok(
    close(m.rightW, PINNED.right[band]),
    `B${band} right = ${PINNED.right[band]} (±0.5) — got ${m.rightW}`
  );
  ok(
    m.seats === PINNED.seats[band],
    `B${band} seats = ${PINNED.seats[band]} — got ${m.seats}`
  );
  ok(
    m.scrollW <= m.innerW,
    `B${band} no horizontal overflow (${m.scrollW} ≤ ${m.innerW})`
  );
}

console.log("\nB — the child-level witness (the left cluster's anatomy per band)");
// Below sm the brand icon is max-sm:hidden and the wordmark max-md:hidden:
// 375 = the ViewSwitcher ALONE; 640 = icon + switcher; 768+ adds the
// wordmark; 1280+ adds the middle tier (hidden xl:flex).
const visKids = (band) => rows[band] ? rows[band].kids.filter((k) => k.w > 0).length : -1;
ok(visKids(375) === 1, `375 shows one child (the ViewSwitcher) — got ${visKids(375)}`);
ok(visKids(640) === 2, `640 shows two children (icon + switcher) — got ${visKids(640)}`);
ok(visKids(768) === 3, `768 shows three (icon + wordmark + switcher) — got ${visKids(768)}`);
ok(visKids(1280) === 4, `1280 shows four (middle tier aboard) — got ${visKids(1280)}`);
if (rows[375] && rows[375].vis[0]) {
  ok(rows[375].vis[0].w === 68, `375 the ViewSwitcher alone is 68px — got ${rows[375].vis[0].w}`);
}
if (rows[640] && rows[640].vis[1]) {
  ok(rows[640].vis[0].w === 36, `640 the brand icon (size-9) is 36px — got ${rows[640].vis[0].w}`);
  ok(rows[640].vis[1].w === 68, `640 the ViewSwitcher (icons only) is 68px — got ${rows[640].vis[1].w}`);
}
if (rows[1280] && rows[1280].vis[2]) {
  ok(
    rows[1280].vis[2].w === 200.2,
    `1280 the ViewSwitcher at its label floor (min-content, no min-w-0) is 200.2px — got ${rows[1280].vis[2].w}`
  );
}

/* ---------- C — the right cluster's anatomy (the t835 symmetric completion) ---------- */
console.log("\nC — the right cluster's child-level anatomy (the same ruler the left got)");
// The cluster's own closed form, live at the CHILD level: the visible
// seats' widths + one gap-1.5 (6px) per seam must reassemble the
// cluster's measured width at EVERY band — the inventory that A1 of the
// t832 probe parses from source, here weighed seat by seat.
let selfCloseOk = true;
const selfCloseReport = [];
for (const band of BANDS) {
  const m = rows[band];
  if (!m || !m.rightKids) continue;
  const sum = m.rightKids.reduce((a, k) => a + k.w, 0) + 6 * (m.rightKids.length - 1);
  const delta = Math.round((sum - m.rightW) * 10) / 10;
  if (Math.abs(delta) > 0.5) selfCloseOk = false;
  selfCloseReport.push(`${band}:Σ${Math.round(sum * 10) / 10}`);
}
ok(selfCloseOk, `C1 the seats + gaps reassemble the cluster at every band (${selfCloseReport.join(" ")})`);
if (rows[375]) {
  ok(rows[375].seats === 6, `C2 375 shows six seats (the t828 tier law's narrow band) — got ${rows[375].seats}`);
  const palette = rows[375].rightKids.find((k) => k.lbl.includes("palette"));
  ok(palette && palette.w === 26, `C3 375 the palette rides its icon-only 26px — got ${palette && palette.w}`);
}
if (rows[1280]) {
  ok(rows[1280].seats === 12, `C4 1280 shows the full dozen — got ${rows[1280].seats}`);
  const chip = rows[1280].rightKids.find((k) => k.lbl.includes("xl:block"));
  ok(chip && close(chip.w, 162.3), `C5 1280 the RELION chip weighs 162.3px — got ${chip && chip.w}`);
  const palette = rows[1280].rightKids.find((k) => k.lbl.includes("palette"));
  ok(palette && palette.w === 40, `C6 1280 the palette rides its labeled 40px — got ${palette && palette.w}`);
  const icons = rows[1280].rightKids.filter((k) => k.w === 36).length;
  ok(icons === 10, `C7 1280 the ten icon seats weigh 36px each — got ${icons}`);
}

/* ---------- D — the middle tier's internals and the t510 residue ---------- */
console.log("\nD — the middle tier's internals (the t510 squeeze, filmed live)");
// The middle tier (hidden xl:flex) hosts the two triggers, the 2000px
// counters and the 2xl lens chip. At the exact xl boundary the row's
// squeeze reaches the project trigger's min-width floor: the trigger
// holds 130px while its wrapper yields below it, and the overflow
// PAINTS into the RELION chip's box — 2.7px at 1280, clear by ~1290.
// This pin is the RESIDUE the t510 re-cut left (its "626 ≤ 650" budget
// predated the right cluster's growth: the budget at 1280 is 608 today,
// the natural row 746 — the squeeze engages, the sliver follows). The
// t839 rehearsal measured the post-fix form: the GEOMETRY stays 2.7
// (option (a) changes the paint, not the layout), the STACK loses the
// trigger (E9), the wrapper's overflow-x flips (E10) — the fix window's
// ratchet is a measured flip, not a narration edit.
if (rows[1280] && rows[1280].midKids) {
  const mkVis = rows[1280].midKids.filter((k) => k.w > 0).length;
  ok(mkVis === 2, `D1 1280 the middle tier shows two children (triggers only; counters wait for 2000px, the chip for 2xl) — got ${mkVis}`);
  const ps = rows[1280].ps;
  ok(ps && ps.trigW === 130, `D2 1280 the project trigger rides its 130px name-worthy floor — got ${ps && ps.trigW}`);
  ok(ps && ps.wrapW < 130, `D3 1280 its wrapper yields below the floor (${ps && ps.wrapW}px, the min-w-0 shock absorber)`);
  ok(ps && ps.overlap === 2.7, `D4 1280 THE T510 RESIDUE: the trigger paints ${ps && ps.overlap}px into the RELION chip's box (pinned; the fix window moves this to ≤ 0)`);
} else {
  fail++;
  console.log("  ✗ D* 1280 the middle tier witness is missing (midKids null) — the instrument cannot see the squeeze");
}
if (rows[1536] && rows[1536].midKids) {
  const mkVis = rows[1536].midKids.filter((k) => k.w > 0).length;
  ok(mkVis === 3, `D5 1536 the lens chip is aboard (hidden 2xl:flex, the t510 yield-first law live) — got ${mkVis}`);
  const chipKid = rows[1536].midKids.find((k) => k.lbl.includes("Spotlight"));
  ok(chipKid && close(chipKid.w, 90.3), `D6 1536 the chip weighs 90.3px — got ${chipKid && chipKid.w}`);
  const ps = rows[1536].ps;
  ok(ps && ps.trigW <= ps.wrapW + 0.5, `D7 1536 no trigger overflow (trigger ${ps && ps.trigW} ≤ wrapper ${ps && ps.wrapW} — the floor sleeps above 2xl)`);
}

/* ---------- E — the zone formalization (the t836 stepwise pin) ---------- */
console.log("\nE — the t510 residue's zone, 1px steps around xl (the t836 formalization)");
// The probe (scripts/t836-zone-probe.mjs) measured the zone twice with
// bit-identical tables; these pins are its laws. The measure is the
// probe's: trigger right minus chip left at 0.1px, plus the paint
// witness (elementFromPoint in the band, the chip's computed bg).
const ZONE_MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const py = tr.top + tr.height / 2; const px = Math.min(tr.right - 0.5, cr.left + 0.5); const who = (el) => (el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : 'OTHER'); const lbl = (el) => el.getAttribute('aria-label') || String(el.className).slice(0, 30); const paintEl = document.elementFromPoint(px, py); const paint = paintEl ? who(paintEl) + '|' + lbl(paintEl) : 'null'; const stack = document.elementsFromPoint(px, py).slice(0, 8).map((el) => who(el) + '|' + lbl(el)); const cs = getComputedStyle(chip); const csW = getComputedStyle(psWrap); return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, chipBg: cs.backgroundColor, paintAt: paint, stack, wrapOverflowX: csW.overflowX }); })()";
const ZW = [
  1279, 1280, 1281, 1282, 1283, 1284, 1285, 1286, 1287, 1288, 1289, 1290,
  1291, 1292, 1294, 1366, 1440,
];
const zone = {};
for (const w of ZW) {
  ab(`set viewport ${w} ${HEIGHT}`);
  ab("wait 250");
  zone[w] = evalJson(ZONE_MEASURE);
}
ab("set viewport 1280 800");
const zOv = (w) => (zone[w] && zone[w].overlap !== undefined ? zone[w].overlap : null);

ok(
  zone[1279] && zone[1279].mid === false,
  `E1 1279 the middle tier is ASLEEP (hidden xl:flex) — the zone is left-anchored at 1280`
);
ok(zOv(1280) === 2.7, `E2 1280 the zone's left edge = the D4 pin (2.7) — got ${zOv(1280)}`);
// The slope law: overlap(W) = 2.7 − 0.4×(W−1280). The wrapper reclaims
// 0.4px per viewport px (the row's other yielders absorb the 0.6). The
// law closes within ±0.15 across the whole named range.
let maxDev = 0;
let law = "";
for (let w = 1280; w <= 1290; w++) {
  const ov = zOv(w);
  if (ov === null) continue;
  const dev = Math.abs(ov - (2.7 - 0.4 * (w - 1280)));
  if (dev > maxDev) maxDev = dev;
  law += `${w}:${ov} `;
}
ok(
  maxDev <= 0.15,
  `E3 the slope law overlap(W) = 2.7 − 0.4×(W−1280) closes ±0.15 over 1280..1290 (max dev ${Math.round(maxDev * 100) / 100}) [${law.trim()}]`
);
const lastPaint = [1286, 1285, 1284, 1283, 1282, 1281, 1280].find((w) => zOv(w) > 0);
const firstClear = [1287, 1288, 1289, 1290, 1291, 1292].find((w) => zOv(w) !== null && zOv(w) <= 0);
ok(
  lastPaint === 1286 && firstClear === 1287,
  `E4 the edge: last paint 1286 (+0.3), first clear 1287 (−0.1) — got last ${lastPaint} / first ${firstClear}`
);
ok(zOv(1290) === -1.3, `E5 1290 the t835 named point is exact (−1.3) — got ${zOv(1290)}`);
const repaint = ZW.filter((w) => w >= 1287 && zOv(w) !== null && zOv(w) > 0);
ok(
  repaint.length === 0,
  `E6 NO RE-PAINT above the edge (1287→1440 all ≤ 0)${repaint.length ? ` — RE-PAINT at ${repaint.join(",")}` : ""}`
);
ok(
  zOv(1366) === -12 && zOv(1440) === -33.1,
  `E7 the wide named points exact: 1366 = −12 (got ${zOv(1366)}), 1440 = −33.1 (got ${zOv(1440)})`
);
ok(
  zone[1280] &&
    typeof zone[1280].paintAt === "string" &&
    zone[1280].paintAt.startsWith("CHIP") &&
    zone[1280].chipBg === "rgba(0, 0, 0, 0)",
  `E8 the PAINT WITNESS: in-band topmost = CHIP (${zone[1280] && zone[1280].paintAt}), bg transparent (${zone[1280] && zone[1280].chipBg}) — the edge paint shows through, the chip owns the click`
);
// E9 — the STACK witness, permanent (the t841 growth): at every PAINTED
// width (overlap > 0) the trigger is IN the band's hit stack — the
// paint is real across the whole zone, not just at the D4 pin's 1280.
// Hit-testing respects overflow clipping, so the fix window's flip is a
// per-width MEASURED delta: each painted row loses the trigger.
const painted = ZW.filter((w) => zOv(w) !== null && zOv(w) > 0);
const stackFull =
  painted.length > 0 &&
  painted.every(
    (w) => zone[w].stack && zone[w].stack.some((s) => String(s).startsWith("TRIGGER"))
  );
ok(
  stackFull,
  `E9 the STACK witness at every painted width (${painted.join(",")}): the TRIGGER is in the band's hit stack — the paint is real across the zone, the fix's flip will be a per-width measured delta`
);
// E10 — the fix's FINGERPRINT, watched in reverse: the wrapper's
// computed overflow-x is 'visible' at every awake zone width. The build
// day's one-line fix flips it to 'hidden' — E10 goes red FIRST and
// names the ratchet to flip (D4's narration to the clipped truth, E8's
// fingerprint, E9's per-width delta), so the sweep can never be
// silently outlived by the src.
const midRows = ZW.filter((w) => zone[w] && zone[w].mid === true);
const ovxVisible =
  midRows.length > 0 && midRows.every((w) => zone[w].wrapOverflowX === "visible");
ok(
  ovxVisible,
  `E10 the fix's fingerprint ABSENT: overflow-x 'visible' at all ${midRows.length} awake zone widths — when the fix lands this goes red first and names the ratchet to flip`
);

/* ---------- G — the far edge (the t852 growth): the band layer's first
 * walk ABOVE the zone's neighborhood — 1366/1440/1536/1920, both layers
 * (the sweep's own MEASURE + the zone-form paint/wmW walk). The probe
 * (scripts/t852-far-edge-probe.mjs) rode the widths first; the pins
 * carry the measured values. ---------- */
const FAR_ZONE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const px = Math.min(tr.right - 0.5, cr.left + 0.5); const py = tr.top + tr.height / 2; const who = (el) => (el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : 'OTHER'); const paintEl = document.elementFromPoint(px, py); const wm = document.querySelector('div.min-w-0.leading-tight'); const wmW = wm ? Math.round(wm.getBoundingClientRect().width * 10) / 10 : null; return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, wmW, paintAt: paintEl ? who(paintEl) + '|' + (paintEl.getAttribute('aria-label') || String(paintEl.className).slice(0, 30)) : 'null' }); })()";
console.log("\nG — the far edge (above the zone: 1366/1440/1536/1920, the t852 growth)");
const FAR_W = [1366, 1440, 1536, 1920];
const farRows = {};
const farZone = {};
for (const w of FAR_W) {
  ab(`set viewport ${w} ${HEIGHT}`);
  ab("wait 350");
  farRows[w] = evalJson(MEASURE);
  farZone[w] = evalJson(FAR_ZONE);
}
ab("set viewport 1280 800");

const wrapKidAt = (w) => farRows[w].midKids.find((k) => String(k.lbl).startsWith("flex min-w-0"));
const chipKidAt = (w) => farRows[w].midKids.find((k) => String(k.lbl).includes("Spotlight"));
const lblKidAt = (w) => farRows[w].midKids.find((k) => k.lbl === "Active workspace");
ok(
  FAR_W.every((w) => wrapKidAt(w) && farRows[w].ps && wrapKidAt(w).w === farRows[w].ps.wrapW),
  `G1 the cross-layer identity is FAR-EDGE-PROOF: the band's wrapper kid == the zone's wrapW at 1366/1440/1536/1920 (${FAR_W.map((w) => wrapKidAt(w).w).join(" / ")}) — the twin survives 2xl and the third kid (the chip aboard at 1536+)`
);
ok(
  FAR_W.every((w) => farRows[w].rightW === 628.3 && farRows[w].seats === 12),
  `G2 the right cluster never moves at the far edge: rightW 628.3 and seats 12 at all four widths — no new seats above xl, the chip lives in the mid row`
);
ok(
  FAR_W.every((w) => farRows[w].ps && farRows[w].ps.trigW === farRows[w].ps.wrapW),
  `G3 the floor SLEEPS at the far edge: trigW == wrapW exactly at all four widths (${FAR_W.map((w) => farRows[w].ps.trigW).join(" / ")}) — the shock absorber retired, the trigger rides its natural width (149.2 → 170 → 205 → 220)`
);
ok(
  farRows[1366].ps.overlap === -12 && farRows[1440].ps.overlap === -33.1 &&
    farZone[1536].overlap === -110.3 && farZone[1920].overlap === -463.1,
  `G4 the named points hold and the gap runs away: 1366 = −12, 1440 = −33.1 (E7's zone rows agree — two walks, one number), then 1536 = −110.3, 1920 = −463.1 — the zone clears and never looks back`
);
ok(
  farRows[1366].leftW === 693.8 && farRows[1440].leftW === 746.7 &&
    farRows[1536].leftW === 863.8 && farRows[1920].leftW === 895 &&
    Math.abs(farRows[1536].leftW - PINNED.left[1536]) <= 0.5,
  `G5 the left row's far tier: 693.8 / 746.7 / 863.8 / 895 (tier-shaped, breakpoint-honest) — and 1536's 863.8 sits within the sweep's own ±0.5 rounding law of the MACRO pin 864`
);
ok(
  farRows[1366].midKids.filter((k) => k.w > 0).length === 2 && farRows[1440].midKids.filter((k) => k.w > 0).length === 2 &&
    farRows[1536].midKids.filter((k) => k.w > 0).length === 3 && farRows[1920].midKids.filter((k) => k.w > 0).length === 3 &&
    lblKidAt(1366).w === 143.6 && lblKidAt(1440).w === 160 && lblKidAt(1536).w === 150.9 && lblKidAt(1920).w === 160 &&
    chipKidAt(1536) && chipKidAt(1536).w === 90.3 && chipKidAt(1920) && chipKidAt(1920).w === 90.3,
  `G6 the mid row's far anatomy: two kids awake at 1366/1440, THREE at 1536/1920 (the chip wakes at 2xl); the label 143.6 / 160 / 150.9 / 160, the chip 90.3 at BOTH 2xl widths — the chip's weight is width-free above its tier`
);
ok(
  FAR_W.every((w) => farZone[w] && typeof farZone[w].paintAt === "string" && farZone[w].paintAt.startsWith("TRIGGER")),
  `G7 the residue is 1280-LOCAL: the paint witness rides the trigger's own box at every far width (no CHIP under the point) — the t510 overlap exists only where the floor binds`
);
ok(
  farZone[1366].wmW === 126.8 && farZone[1440].wmW === 142.5 &&
    farZone[1536].wmW === 135.4 && farZone[1920].wmW === 142.5,
  `G8 the wordmark's far form is TIER-SHAPED: 126.8 / 142.5 / 135.4 / 142.5 — the natural 142.5 recurs at 1440/1920, the squeeze never returns, no slope claim (pinned per width)`
);

/* ---------- H — the below zone (the t853 growth): the band layer's first
 * walk BELOW xl — 768/900/1024, both layers (the sweep's own MEASURE +
 * the zone-form walk), plus the below squeeze's EDGE ride (767-772).
 * The probe (scripts/t853-below-zone-probe.mjs) rode the widths first;
 * the pins carry the measured values. The discovery: the wordmark is
 * BORN SQUEEZED at md — the row needs 738.5 vs available 736 at 768 and
 * the min-w-0 wordmark pays the whole 2.5 (A4e-2's live form), and the
 * squeeze is a ZONE: linear at slope −1.0/px, [768, 770], clear by 771. ---------- */
const WM_BOX =
  "(() => { const hdr = document.querySelector('header'); const left = hdr.children[0]; const wm = left.querySelector('div.min-w-0.leading-tight'); if (!wm) return JSON.stringify({ wm: null, leftW: Math.round(left.getBoundingClientRect().width * 10) / 10 }); return JSON.stringify({ wm: Math.round(wm.getBoundingClientRect().width * 10) / 10, leftW: Math.round(left.getBoundingClientRect().width * 10) / 10 }); })()";
console.log("\nH — the below zone (below xl: 768/900/1024 + the edge ride, the t853 growth)");
const BELOW_W = [768, 900, 1024];
const belowRows = {};
const belowZone = {};
for (const w of BELOW_W) {
  ab(`set viewport ${w} ${HEIGHT}`);
  ab("wait 350");
  belowRows[w] = evalJson(MEASURE);
  belowZone[w] = evalJson(FAR_ZONE);
}
const EDGE_W = [767, 769, 770, 771, 772];
const edge = {};
for (const w of EDGE_W) {
  ab(`set viewport ${w} ${HEIGHT}`);
  ab("wait 300");
  edge[w] = evalJson(WM_BOX);
}
ab("set viewport 1280 800");

ok(
  BELOW_W.every((w) => belowRows[w].midKids === null && belowRows[w].ps === null) &&
    BELOW_W.every((w) => belowZone[w] && belowZone[w].mid === false),
  `H1 the mid row SLEEPS below xl at every named tier (768/900/1024): midKids null, ps null, the zone-form walk short-circuits (mid:false x3) — the twin has no counterpart below the zone, the identity vacuously at rest (E1's 1279 point now a cross-section)`
);
ok(
  BELOW_W.every((w) => belowZone[w].overlap === undefined && belowZone[w].trigW === undefined),
  `H2 the t510 residue has NO below-form: the zone walk returns no trigW/wrapW/overlap/paint below xl — the paint exists only where the floor binds (G7's below mirror)`
);
ok(
  belowRows[1024].vis.length === 3 && belowRows[1024].vis[0].w === 36 &&
    belowRows[1024].vis[1].w === 142.5 && belowRows[1024].vis[2].w === 68 &&
    belowRows[1024].leftW === 266.5,
  `H3 the below trio's child anatomy at 1024: icon 36 + wordmark 142.5 + switcher 68 = 266.5 natural (the B block's counts gain their weights; A4e-3's honest 142 re-proven live at 0.1px)`
);
ok(
  BELOW_W.every((w) => belowRows[w].rightW === 460 && belowRows[w].seats === 11) &&
    BELOW_W.every((w) => {
      const sum = belowRows[w].rightKids.reduce((a, k) => a + k.w, 0) + 6 * (belowRows[w].rightKids.length - 1);
      return Math.abs(sum - 460) <= 0.5;
    }),
  `H4 the right cluster's below plateau: rightW 460 and seats 11 at ALL THREE tiers, the closed form re-anchored below xl (36+40+36x9 + 10 gaps x6 = 460) — the plateau the C block knew per-band, now a cross-band fact`
);
ok(
  belowRows[768].vis[1].w === 140 && belowRows[768].leftW === 264,
  `H5 the wordmark is BORN SQUEEZED at md: the box is 140 (not the natural 142.5) and the row is 264 — needs 266.5+460+12 = 738.5 vs available 736, the 2.5 falls ENTIRELY on the min-w-0 wordmark (A4e-2's live form: the unit's integer 266>264 refined to 0.1px); the natural is not hypothetical — 900/1024 ride it live`
);
ok(
  edge[767].wm === 0 && edge[769].wm === 141 && edge[770].wm === 142 &&
    edge[771].wm === 142.5 && edge[772].wm === 142.5,
  `H6 the below squeeze's EDGE: 767 asleep (wm 0, the wordmark not yet born), 769 pays 1.5 (141), 770 pays 0.5 (142), 771 CLEAR (142.5) — squeeze(W) = 770.5 − W exactly, zone [768, 770], clear by 771, slope −1.0/px: the wordmark is the row's ONLY yielder below xl and absorbs every pixel (vs the 1280 zone's −0.4, where the row's other yielders take 0.6)`
);
ok(
  belowRows[900].vis[1].w === 142.5 && belowRows[900].leftW === 266.5 &&
    belowRows[1024].vis[1].w === 142.5 && belowRows[1024].leftW === 266.5,
  `H7 the interior is at rest: 900 rides the SAME natural form as 1024 (266.5 / 142.5) — the squeeze is 768-LOCAL, the below mirror of G7's 1280-locality`
);

/* ---------- the receipt ---------- */
const receipt = {
  instrument: "scripts/t834-band-sweep.mjs",
  build: buildId,
  date: new Date().toISOString(),
  bands: rows,
  zone: { widths: ZW, rows: zone, law: "overlap(W) = 2.7 − 0.4×(W−1280)", edge: { lastPaint: 1286, firstClear: 1287 } },
  farEdge: { widths: FAR_W, rows: farRows, zone: farZone, law: "the far edge (t852): the cross-layer identity (band wrapper kid == the zone's wrapW) holds at every width above the zone — 2xl and the third kid included; the floor sleeps (trigW == wrapW exactly), the right cluster never moves (rightW 628.3, seats 12), the chip is width-free above 2xl (90.3), and the residue is 1280-local (the paint witness rides the trigger's own box)" },
  belowZone: { widths: BELOW_W, rows: belowRows, zone: belowZone, edge, law: "the below zone (t853): the mid row sleeps below xl at every named tier (the twin vacuously at rest, E1's 1279 point now a cross-section) and the residue has no below-form; the wordmark is BORN SQUEEZED at md — the row needs 738.5 vs available 736 at 768 and the min-w-0 wordmark pays the whole 2.5 (A4e-2's live form) — in a LINEAR zone: squeeze(W) = 770.5 − W, slope −1.0/px (the row's only yielder absorbs every pixel), [768, 770], clear by 771; the interior (900/1024) rides the natural 266.5/142.5 — the squeeze is 768-local" },
  pinned: PINNED,
};
const out = join(ROOT, "shots-qa/t834-band-sweep.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nFLEET-SWEEP t834: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

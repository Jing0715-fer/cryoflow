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
 * The receipt lands in shots-qa/t834-band-sweep.json (provenance: the
 * world key — build id on build days, dev@src-hash otherwise, t859).
 * t861 — THE DRIFT LEDGER ABOARD (section L): the six bands ride
 * prev/live/drift/identical against the PREVIOUS receipt — the family's
 * shared law (scripts/drift-ledger.mjs), the standing regression net:
 * the pins measure the world's truth, the ledger its stability.
 * The assertions pin TODAY's truth:
 * left 68/114/264/266/608/864, right 236/334/460/628, seats 6/8/11/12/12/12,
 * hOv false everywhere — the same numbers the t832 probe (A3/A4) closes
 * against, now re-witnessable in one command.
 *
 * The instrument is also the audit's teacher: a FUTURE seat or tier cut
 * moves these numbers, and this script is where the drift surfaces first.
 *
 * t897 — THE COEFFICIENT FAMILIES' RE-CUT (the Geist world's laws): the
 * t895 font law moved every text metric and the t857-era coefficients
 * died with the fallback family. The re-cut, measure-first (the ride
 * plus the t897-far-plateau-probe cap hunt), pins the NEW laws:
 *   - THE T510 RESIDUE IS DEAD (D3/D4, E2–E9): at 1280 the trigger
 *     holds its 130 floor but the wrapper has SLACK (158.9 ≥ 130 — the
 *     shock absorber retired) and the chip's box begins 40.9px beyond
 *     the trigger's edge — a GAP, no paint, no zone edge (the old
 *     +2.7 / −0.4 slope / 1286-edge laws were the fallback's truth);
 *   - the GAP law: overlap(W) = −40.9 − 0.52×(W−1280) through 1290
 *     (the wrapper reclaims 0.52/px), named points 1290 = −46.1,
 *     1366 = −85.2, 1440 = −114.8;
 *   - the md birth-squeeze is DEAD (H5/H6): the wordmark wakes whole
 *     at 769 (133.2, the natural — no [768,770] zone below xl);
 *   - the wake survives as a POINT (J1/J2) with new anatomy: +1px
 *     delivers the chip +87 and the row +35 while the label pays 26.3,
 *     the wrapper 13.4, the wordmark dips 20.4;
 *   - the ramps cap at ~1646 (bracketed [1640, 1660] by the probe):
 *     wrap 322.8, label 160, trig 220, wordmark 133.2 — then the
 *     plateau: the gap constant −209.7 through the ramps, −1.0/px
 *     EXACT above the caps (−223.7 @1660 → −483.7 @1920, 260/260).
 * The E10 ratchet stays as a standing guard, but the fix window's
 * premise (a paint to clip) no longer exists in this world.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";

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
const world = worldIdentity(ROOT); // t859 — the world key: build id on build days, dev@src-hash otherwise (t858's dev-only world must not strand the battery)
const buildId = world.id;
console.log(`t834 band sweep — world ${world.mode}:${buildId}, six bands, one command\n`);

/* t861 — the drift ledger's comparator: the PREVIOUS receipt of THIS
 * instrument. The receipt is the natural comparator (t857's teaching,
 * t846's form, now the family's shared law in scripts/drift-ledger.mjs):
 * the pins measure the world's TRUTH, the ledger measures the world's
 * STABILITY — ride to ride, window to window. */
const cmp = loadComparator(ROOT, "shots-qa/t834-band-sweep.json", buildId);
console.log(
  cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${cmp.prev.date} (world ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "world MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n"
);

/* t895 — THE PINS' WORLD GATE: the pinned tables are not eternal truths,
 * they are ONE WORLD's truth. The annihilate taught it twice: the pins
 * encode a world's text, its font metrics, its seed's names — a restore,
 * a re-seed, a font fix, and the same DOM answers different numbers, all
 * of them honest. So the pins live in the RECEIPT (the fleet's memory)
 * with a PROVENANCE WORLD KEY, and the verdict consumes it:
 *   - pins live  (provenance === this world): the tables assert HARD —
 *     same world, same numbers, the ride-drift law.
 *   - pins moved (provenance missing or ≠ this world): BASELINE RIDE —
 *     every arm still runs and prints (the receipt stays comparable),
 *     but the reds are DRIFT vs the pins' world, the verdict says so,
 *     and the exit is 0. A baseline ride never fails the fleet; it
 *     NAMES the moved world instead.
 *   - --cut-pins: this ride's live tables become the new law (the
 *     receipt carries them, provenance-stamped; the next same-world
 *     ride asserts them bit-for-bit). The A-section tables cut
 *     mechanically; the coefficient families (D/E/G/J) re-cut with
 *     their own windows' work.
 * The t857-era built-in PINNED below stays as the fossil provenance
 * (used only when no receipt carries pins — itself baseline-classified). */
const CUT_PINS = process.argv.includes("--cut-pins");
const prevPins = cmp.prevFound && cmp.prev && typeof cmp.prev === "object" ? cmp.prev.pins ?? null : null;
const pinsProvenance = CUT_PINS ? buildId : (prevPins?.provenanceWorld ?? null);
const pinsLive = pinsProvenance === buildId;
if (CUT_PINS) {
  console.log(`pins: --cut-pins — this ride's A-section tables become the law (provenance ${buildId})\n`);
} else if (pinsLive) {
  console.log(`pins: LIVE (provenance ${pinsProvenance} === this world) — the tables assert hard\n`);
} else {
  console.log(`pins: BASELINE RIDE (provenance ${pinsProvenance ?? "none"} ≠ live ${buildId}) — reds are drift, not failures; exit 0\n`);
}

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
// t895 — the ACTIVE tables: the receipt's cut pins when they live in this
// world, else the t857-era fossil (a baseline ride measures the DRIFT).
const P = pinsLive && prevPins?.tables ? prevPins.tables : PINNED;
for (const band of BANDS) {
  const m = rows[band];
  if (!m) continue;
  ok(
    close(m.leftW, P.left[band]),
    `B${band} left = ${P.left[band]} (±0.5) — got ${m.leftW}`
  );
  ok(
    close(m.rightW, P.right[band]),
    `B${band} right = ${P.right[band]} (±0.5) — got ${m.rightW}`
  );
  ok(
    m.seats === P.seats[band],
    `B${band} seats = ${P.seats[band]} — got ${m.seats}`
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
    rows[1280].vis[2].w === 194.8,
    `1280 the ViewSwitcher at its label floor (min-content, no min-w-0) is 194.8px (the Geist world's label floor) — got ${rows[1280].vis[2].w}`
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
  ok(chip && close(chip.w, 156.3), `C5 1280 the RELION chip weighs 156.3px (the Geist world's weight) — got ${chip && chip.w}`);
  const palette = rows[1280].rightKids.find((k) => k.lbl.includes("palette"));
  ok(palette && palette.w === 40, `C6 1280 the palette rides its labeled 40px — got ${palette && palette.w}`);
  const icons = rows[1280].rightKids.filter((k) => k.w === 36).length;
  ok(icons === 10, `C7 1280 the ten icon seats weigh 36px each — got ${icons}`);
}

/* ---------- D — the middle tier's internals and the residue's tombstone ---------- */
console.log("\nD — the middle tier's internals (the t510 squeeze, filmed live)");
// The middle tier (hidden xl:flex) hosts the two triggers, the 2000px
// counters and the 2xl lens chip. The t857-era world squeezed the row
// until the trigger's overflow PAINTED 2.7px into the RELION chip's box
// (the t510 residue — the fix window's ratchet). The Geist world's row
// budget fits: the floor still BINDS at 1280 (the trigger holds 130)
// but the wrapper has SLACK (158.9 ≥ 130) and the chip's box begins
// 40.9px beyond the trigger's edge — THE RESIDUE IS DEAD (the t895
// retirement, pinned here at instrument level). The fix window's
// ratchet retires with it: there is no paint to clip in this world.
if (rows[1280] && rows[1280].midKids) {
  const mkVis = rows[1280].midKids.filter((k) => k.w > 0).length;
  ok(mkVis === 2, `D1 1280 the middle tier shows two children (triggers only; counters wait for 2000px, the chip for 2xl) — got ${mkVis}`);
  const ps = rows[1280].ps;
  ok(ps && ps.trigW === 130, `D2 1280 the project trigger rides its 130px name-worthy floor — got ${ps && ps.trigW}`);
  ok(ps && ps.wrapW >= 130, `D3 1280 the wrapper has SLACK over the floor-bound trigger (${ps && ps.wrapW}px ≥ 130 — the min-w-0 shock absorber retired: the squeeze no longer reaches past the trigger)`);
  ok(ps && ps.overlap <= 0, `D4 1280 THE RESIDUE IS DEAD: the trigger's edge sits ${ps && ps.overlap}px CLEAR of the RELION chip's box (a gap, no paint — the t895 retirement pinned; the old +2.7 was the fallback metrics' truth)`);
} else {
  fail++;
  console.log("  ✗ D* 1280 the middle tier witness is missing (midKids null) — the instrument cannot see the squeeze");
}
if (rows[1536] && rows[1536].midKids) {
  const mkVis = rows[1536].midKids.filter((k) => k.w > 0).length;
  ok(mkVis === 3, `D5 1536 the lens chip is aboard (hidden 2xl:flex, the t510 yield-first law live) — got ${mkVis}`);
  const chipKid = rows[1536].midKids.find((k) => k.lbl.includes("Spotlight"));
  ok(chipKid && close(chipKid.w, 87), `D6 1536 the lens chip weighs 87px (the Geist world's weight) — got ${chipKid && chipKid.w}`);
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
ok(zOv(1280) === -40.9, `E2 1280 the gap's birth value = the D4 pin (−40.9) — got ${zOv(1280)}`);
// The GAP law: overlap(W) = −40.9 − 0.52×(W−1280). The wrapper reclaims
// 0.52px per viewport px (the gap deepens at the same rate — the chip
// is fixed). The law closes within ±0.15 across the whole named range.
let maxDev = 0;
let law = "";
for (let w = 1280; w <= 1290; w++) {
  const ov = zOv(w);
  if (ov === null) continue;
  const dev = Math.abs(ov - (-40.9 - 0.52 * (w - 1280)));
  if (dev > maxDev) maxDev = dev;
  law += `${w}:${ov} `;
}
ok(
  maxDev <= 0.15,
  `E3 the GAP law overlap(W) = −40.9 − 0.52×(W−1280) closes ±0.15 over 1280..1290 (max dev ${Math.round(maxDev * 100) / 100}) [${law.trim()}]`
);
// The old edge (last paint 1286, first clear 1287) died with the
// fallback metrics: NO painted width exists anywhere in the zone — the
// gap is born with the zone and only deepens (−48.1 by 1294).
const anyPaint = ZW.filter((w) => w >= 1280 && w <= 1294 && zOv(w) !== null && zOv(w) > 0);
ok(
  anyPaint.length === 0 && zOv(1294) === -48.1,
  `E4 NO PAINT exists in the zone (1280..1294 all ≤ 0 — the old edge 1286/1287 is dead) and the gap only deepens (1294: ${zOv(1294)})${anyPaint.length ? ` — PAINT at ${anyPaint.join(",")}` : ""}`
);
ok(zOv(1290) === -46.1, `E5 1290 the named point is exact (−46.1) — got ${zOv(1290)}`);
const repaint = ZW.filter((w) => w >= 1287 && zOv(w) !== null && zOv(w) > 0);
ok(
  repaint.length === 0,
  `E6 NO RE-PAINT above the zone's birth (1287→1440 all ≤ 0, the standing guard)${repaint.length ? ` — RE-PAINT at ${repaint.join(",")}` : ""}`
);
ok(
  zOv(1366) === -85.2 && zOv(1440) === -114.8,
  `E7 the wide named points exact: 1366 = −85.2 (got ${zOv(1366)}), 1440 = −114.8 (got ${zOv(1440)})`
);
ok(
  zone[1280] &&
    typeof zone[1280].paintAt === "string" &&
    zone[1280].paintAt.startsWith("TRIGGER") &&
    zone[1280].chipBg === "rgba(0, 0, 0, 0)",
  `E8 the OWNERSHIP witness: the band point rides the TRIGGER's own box (${zone[1280] && zone[1280].paintAt}), chip bg transparent — the trigger owns its edge, nothing paints into the chip`
);
// E9 — the STACK witness, permanent (the t841 growth, re-cut t897): the
// residue's zone is GONE — zero painted widths exist in [1280..1440].
// The witness keeps its tooth on the gap world: the 1280 band point's
// stack LEADS with the trigger (the point sits just inside the
// trigger's own right edge — the DOM's topmost answer is the trigger,
// not a painted intrusion).
const painted = ZW.filter((w) => zOv(w) !== null && zOv(w) > 0);
ok(
  painted.length === 0 &&
    zone[1280] && zone[1280].stack && String(zone[1280].stack[0]).startsWith("TRIGGER"),
  `E9 the residue's zone is GONE: zero painted widths in [1280..1440], and the 1280 band point's stack leads with the TRIGGER (${zone[1280] && zone[1280].stack && zone[1280].stack[0]}) — the stack witness keeps its tooth on the gap world`
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

const wrapKidAt = (w) => farRows[w]?.midKids?.find((k) => String(k.lbl).startsWith("flex min-w-0"));
const chipKidAt = (w) => farRows[w]?.midKids?.find((k) => String(k.lbl).includes("Spotlight"));
const lblKidAt = (w) => farRows[w]?.midKids?.find((k) => k.lbl === "Active workspace");
ok(
  FAR_W.every((w) => wrapKidAt(w) && farRows[w].ps && wrapKidAt(w).w === farRows[w].ps.wrapW),
  `G1 the cross-layer identity is FAR-EDGE-PROOF: the band's wrapper kid == the zone's wrapW at 1366/1440/1536/1920 (${FAR_W.map((w) => wrapKidAt(w)?.w ?? "?").join(" / ")}) — the twin survives 2xl and the third kid (the chip aboard at 1536+)`
);
ok(
  FAR_W.every((w) => farRows[w].rightW === 622.3 && farRows[w].seats === 12),
  `G2 the right cluster never moves at the far edge: rightW 622.3 and seats 12 at all four widths — no new seats above xl, the chip lives in the mid row`
);
ok(
  FAR_W.every((w) => farRows[w].ps && farRows[w].ps.trigW <= farRows[w].ps.wrapW) &&
    farRows[1366].ps.trigW === 130 && farRows[1440].ps.trigW === 138.5 &&
    farRows[1536].ps.trigW === 156.6 && farRows[1920].ps.trigW === 220,
  `G3 the floor's far anatomy: trig 130 / 138.5 / 156.6 / 220 — the floor still BINDS at 1366 (the squeeze's last address: the row holds the trigger at its 130 floor) and sleeps above; the trigger no longer fills its wrapper (the slack is real: 130 in 203.2, 138.5 in 241.3, 156.6 in 259.4, 220 in 322.8) and never overflows it (trig ≤ wrap at all four)`
);
ok(
  farRows[1366].ps.overlap === -85.2 && farRows[1440].ps.overlap === -114.8 &&
    farZone[1536].overlap === -209.7 && farZone[1920].overlap === -483.7,
  `G4 the named points hold and the gap runs away: 1366 = −85.2, 1440 = −114.8 (E7's zone rows agree — two walks, one number), then 1536 = −209.7, 1920 = −483.7 — the gap is born at the zone and never looks back`
);
ok(
  farRows[1366].leftW === 699.8 && farRows[1440].leftW === 773.8 &&
    farRows[1536].leftW === 869.8 && farRows[1920].leftW === 979.8 &&
    Math.abs(farRows[1536].leftW - P.left[1536]) <= 0.5,
  `G5 the left row's far tier: 699.8 / 773.8 / 869.8 / 979.8 (tier-shaped, breakpoint-honest) — and 1536's 869.8 sits within the sweep's own ±0.5 rounding law of the ACTIVE pin ${P.left[1536]}`
);
ok(
  farRows[1366].midKids.filter((k) => k.w > 0).length === 2 && farRows[1440].midKids.filter((k) => k.w > 0).length === 2 &&
    farRows[1536].midKids.filter((k) => k.w > 0).length === 3 && farRows[1920].midKids.filter((k) => k.w > 0).length === 3 &&
    lblKidAt(1366).w === 125.8 && lblKidAt(1440).w === 144.5 && lblKidAt(1536).w === 133.7 && lblKidAt(1920).w === 160 &&
    chipKidAt(1536) && chipKidAt(1536).w === 87 && chipKidAt(1920) && chipKidAt(1920).w === 87,
  `G6 the mid row's far anatomy: two kids awake at 1366/1440, THREE at 1536/1920 (the chip wakes at 2xl); the label 125.8 / 144.5 / 133.7 / 160 (the wake's dip at 1536 — the label pays for the chip's birth, J2), the chip 87 at BOTH 2xl widths — the chip's weight is width-free above its tier`
);
ok(
  FAR_W.every((w) => farZone[w] && typeof farZone[w].paintAt === "string" && farZone[w].paintAt.startsWith("TRIGGER")),
  `G7 the floor's reach is 1280-LOCAL: the band point rides the trigger's own box at every far width (no CHIP under the point) — the floor binds at 1280..1366 and NO paint exists anywhere; the trigger owns its edge at every width (E8's far confirmation)`
);
ok(
  farZone[1366].wmW === 101.9 && farZone[1440].wmW === 119 &&
    farZone[1536].wmW === 112.8 && farZone[1920].wmW === 133.2,
  `G8 the wordmark's far form is TIER-SHAPED: 101.9 / 119 / 112.8 / 133.2 — the natural 133.2 is the 1920 cap, the 1536 dip (112.8 < 119) is the wake's transient squeeze (J2: the wordmark pays for the chip's birth), recovered by the ramps (the probe: 133.2 by 1660); no slope claim (pinned per width)`
);

/* ---------- H — the below zone (the t853 growth, re-cut t897): the band
 * layer's first walk BELOW xl — 768/900/1024, both layers (the sweep's
 * own MEASURE + the zone-form walk), plus the md edge ride (767-772).
 * The t853-era discovery (the wordmark BORN SQUEEZED at md, a [768,770]
 * zone at slope −1.0/px) died with the fallback metrics: the Geist row
 * budget fits at md, and the below-xl span is SQUEEZE-FREE end to end
 * (the below mirror of the dead residue — both shortages were the
 * fallback family's truth). ---------- */
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
    belowRows[1024].vis[1].w === 133.2 && belowRows[1024].vis[2].w === 68 &&
    belowRows[1024].leftW === 257.2,
  `H3 the below trio's child anatomy at 1024: icon 36 + wordmark 133.2 + switcher 68 = 257.2 natural (the B block's counts gain their weights; the Geist wordmark's natural is 133.2, re-proven live at 0.1px)`
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
  belowRows[768].vis[1].w === 133.2 && belowRows[768].leftW === 257.2,
  `H5 the wordmark is born FREE at md: 133.2 (the natural — the SAME value 900/1024 ride) and the row is 257.2 at 768 — the old birth-squeeze (the 2.5 the min-w-0 wordmark paid in the fallback world, 140 vs 142.5) died with the fallback metrics: the Geist row budget fits at md`
);
ok(
  edge[767].wm === 0 && edge[769].wm === 133.2 && edge[770].wm === 133.2 &&
    edge[771].wm === 133.2 && edge[772].wm === 133.2,
  `H6 the md edge ride: 767 asleep (wm 0, the wordmark not yet born), then 769/770/771/772 ALL 133.2 — NO squeeze zone below xl anymore (the old [768,770] zone at slope −1.0/px was the fallback world's shortage): the wordmark wakes whole at md, the below mirror of the dead residue`
);
ok(
  belowRows[900].vis[1].w === 133.2 && belowRows[900].leftW === 257.2 &&
    belowRows[1024].vis[1].w === 133.2 && belowRows[1024].leftW === 257.2,
  `H7 the interior is at rest: 900 rides the SAME natural form as 1024 (257.2 / 133.2) — the below-xl span is squeeze-free end to end (768's H5 form is the same numbers, the interior's confirmation)`
);

/* ---------- J — the wake edge (the t856 growth, re-cut t897): the far
 * edge's SECOND threshold — the stats chip's WAKE at 2xl. The probe
 * (scripts/t856-xl-chip-wake-probe.mjs) bracketed the wake first (last
 * asleep 1535, first awake 1536 — a POINT, not a zone); the re-cut
 * keeps the point and re-measures its anatomy. The NEW discovery: +1px
 * delivers the chip (born 87, constant forever) and the row's 2xl
 * grant (+35) while the label PAYS (−26.3: 160 → 133.7), the WRAPPER
 * pays (−13.4: 272.8 → 259.4) and the wordmark DIPS (−20.4: 133.2 →
 * 112.8); then THREE CAPPED RAMPS (1536 → ~1646) restore the yielders
 * — the wrap +0.575/px to its cap 322.8, the label +0.21/px back to
 * 160, the wordmark back to 133.2 (the probe brackets every cap's
 * landing in [1640, 1660]) — and above the caps the plateau: everything
 * constant to 1920 but the gap (overlap −1.0/px EXACT). ---------- */
console.log("\nJ — the wake edge (the far edge's second threshold: the chip wakes at 2xl, the t856 growth, re-cut t897)");
const WAKE_W = [1535, 1536, 1537, 1540, 1550, 1560, 1570, 1600, 1620, 1640, 1660, 1680];
const wakeRows = {};
const wakeZone = {};
for (const w of WAKE_W) {
  ab(`set viewport ${w} ${HEIGHT}`);
  ab("wait 350");
  wakeRows[w] = evalJson(MEASURE);
  wakeZone[w] = evalJson(FAR_ZONE);
}
ab("set viewport 1280 800");

ok(
  wakeRows["1535"].midKids[3].w === 0 && wakeRows["1536"].midKids[3].w === 87 &&
    wakeZone["1535"].wrapW === 272.8 && wakeZone["1536"].wrapW === 259.4,
  `J1 the chip WAKES AT 2xl — a POINT, not a zone: last asleep 1535 (kids [160, 272.8, 0, 0], wrap 272.8), first awake 1536 (the chip born 87, the wrap PAYS 13.4: 272.8 → 259.4) — the far mirror of the (now dead) below squeeze: the below world no longer yields through a shortage-zone, the far world still crosses a 1px THRESHOLD (a breakpoint, not a shortage)`
);
ok(
  wakeRows["1535"].midKids[0].w === 160 && wakeRows["1536"].midKids[0].w === 133.7 &&
    wakeZone["1535"].wmW === 133.2 && wakeZone["1536"].wmW === 112.8 &&
    wakeRows["1535"].leftW === 834.8 && wakeRows["1536"].leftW === 869.8,
  `J2 the wake's STEP anatomy: +1px of viewport delivers the chip +87 and the row's 2xl grant +35 (leftW 834.8 → 869.8) while the label PAYS 26.3 (160 → 133.7), the WRAPPER pays 13.4 (272.8 → 259.4) and the wordmark DIPS 20.4 (133.2 → 112.8) — the wake moment is funded by the row's own yielders, not by the viewport's new pixel`
);
ok(
  wakeZone["1536"].wrapW === 259.4 && wakeZone["1540"].wrapW === 261.7 &&
    wakeZone["1550"].wrapW === 267.5 && wakeZone["1560"].wrapW === 273.2 &&
    wakeZone["1570"].wrapW === 279 && wakeZone["1600"].wrapW === 296.3 &&
    wakeZone["1640"].wrapW === 319.3 && wakeZone["1660"].wrapW === 322.8,
  `J3 the wrap's CAPPED RAMP: 259.4 @1536 → 261.7 @1540 → 267.5 @1550 → 273.2 @1560 → 279 @1570 → 296.3 @1600 → 319.3 @1640, the cap 322.8 by 1660 (+0.575/px through the ramp; the probe brackets the landing in [1640, 1660] ≈ 1646) — the trigger's 2xl tier is a FLOOR, the wrap's growth is the row's slack: it runs until the caps land, then sleeps at 322.8 forever`
);
ok(
  wakeRows["1540"].midKids[0].w === 134.7 && wakeRows["1550"].midKids[0].w === 137 &&
    wakeRows["1570"].midKids[0].w === 141.8 && wakeRows["1600"].midKids[0].w === 149 &&
    wakeRows["1660"].midKids[0].w === 160 &&
    wakeZone["1570"].wmW === 119.1 && wakeZone["1660"].wmW === 133.2,
  `J4 the label's recovery and the wordmark's: the label rides its own ramp to the cap 160 (134.7 @1540, 137 @1550, 141.8 @1570, 149 @1600, 160 by 1660) and the wordmark to its natural 133.2 (119.1 @1570 → 133.2 by 1660) — both capped ≈1646 with the wrap; the wake's transient squeeze is fully repaid within ~110px of the threshold`
);
ok(
  WAKE_W.every((w) => wakeRows[w].midKids[3].w === (w === 1535 ? 0 : 87)) &&
    wakeRows["1536"].rightW === 622.3 && wakeRows["1600"].rightW === 622.3 &&
    wakeZone["1640"].overlap === -209.7 && wakeZone["1660"].overlap === -223.7 &&
    wakeZone["1680"].overlap === -243.7 && farZone[1920].overlap === -483.7,
  `J5 the plateau: the chip is CONSTANT 87 above the wake (born full-size, never grows), the right cluster 622.3, and the gap's law has TWO segments — constant −209.7 THROUGH the ramps (the wrap grows into the gap, the chip holds still) then −1.0/px EXACT above the caps (−223.7 @1660 → −243.7 @1680 → −483.7 @1920: 260px of viewport, 260px of gap — the t836 law's far form, the PS clears deeper as the viewport grows)`
);

/* ---------- the DRIFT LEDGER (t861): the family's propagation — the six
 * bands join t846's five faces. Per band: prev receipt's row vs this
 * ride's row, scalar = leftW (the row's primary ruler), identity = the
 * FULL row object (kids anatomy, seats, midKids, ps, overflow — the
 * whole band's truth). Three arms + the t859 jurisdiction clause:
 * bit-for-bit is demanded only on a frozen build-mode key; a dev@ same-key
 * ride records its stability as arm-2′ information. */
console.log("\nL — the drift ledger (t861: the family's propagation — six bands vs the previous receipt)");
const bandFaces = {};
for (const band of BANDS) {
  bandFaces[String(band)] = ledgerFace(
    cmp.prev && cmp.prev.bands ? cmp.prev.bands[String(band)] : null,
    rows[band],
    (m) => (m ? m.leftW : null)
  );
}
ok(
  Object.keys(bandFaces).length === BANDS.length &&
    Object.values(bandFaces).every((f) => "prev" in f && "live" in f && "drift" in f && "identical" in f) &&
    (cmp.prevFound ? typeof cmp.prev.date === "string" && typeof cmp.prevBuild === "string" : cmp.prevFound === false),
  `L1 the drift ledger is aboard: six bands, each carrying prev/live/drift/identical, the comparator's provenance recorded — ${cmp.prevFound ? `comparator ${cmp.prev.date} (world ${cmp.prevBuild})` : "first ride — no predecessor"}`
);
for (const band of BANDS) {
  const f = bandFaces[String(band)];
  const v = armVerdict(cmp, world, f);
  ok(
    v.ok,
    `L band ${band} ride-drift law (same key: bit-for-bit vs the previous receipt) — ${v.detail}`
  );
}

/* ---------- the receipt ---------- */
const receipt = {
  instrument: "scripts/t834-band-sweep.mjs",
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  bands: rows,
  zone: { widths: ZW, rows: zone, law: "the GAP law (t897 re-cut): overlap(W) = −40.9 − 0.52×(W−1280) — no paint exists anywhere in the zone; the t857-era residue law (2.7 − 0.4×(W−1280), edge 1286/1287) died with the fallback metrics", edge: { lastPaint: null, firstClear: null, note: "the edge is dead — the gap is born with the zone and only deepens (−48.1 by 1294)" } },
  farEdge: { widths: FAR_W, rows: farRows, zone: farZone,
    wake: { widths: WAKE_W, rows: wakeRows, zone: wakeZone, law: "the wake edge (t856, re-cut t897): the chip WAKES AT 2xl — a POINT (last asleep 1535, first awake 1536), not a zone; the wake is a STEP — +1px delivers the chip (born 87, constant forever) and the row's 2xl grant (+35) while the label pays 26.3 (160 → 133.7), the wrapper pays 13.4 (272.8 → 259.4) and the wordmark dips 20.4 (133.2 → 112.8); then THREE CAPPED RAMPS restore the yielders by ~1646 (the wrap +0.575/px to 322.8, the label to 160, the wordmark to 133.2 — the probe brackets the landing in [1640, 1660]) and above the caps the plateau holds to 1920 — everything constant but the gap (−1.0/px EXACT)" },
    law: "the far edge (t852, re-cut t897): the cross-layer identity (band wrapper kid == the zone's wrapW) holds at every width above the zone — 2xl and the third kid included; the floor still binds at 1366 (trig 130) and sleeps above (138.5 / 156.6 / 220), the trigger no longer fills its wrapper (the slack is real), the right cluster never moves (rightW 622.3, seats 12), the mid chip is width-free above 2xl (87), and no paint exists anywhere (the gap's law: −85.2 @1366, −114.8 @1440, −209.7 @1536, −483.7 @1920). The wake edge (t856, re-cut): the chip's birth is a 1px POINT at 2xl (1535/1536) with a step anatomy (chip +87, row +35, label −26.3, wrapper −13.4, wordmark −20.4), three capped ramps (by ~1646: wrap 322.8, label 160, wordmark 133.2), and a plateau to 1920 whose only moving part is the gap (−1.0/px EXACT)" },
  belowZone: { widths: BELOW_W, rows: belowRows, zone: belowZone, edge, law: "the below span (t853, re-cut t897): the mid row sleeps below xl at every named tier (the twin vacuously at rest, E1's 1279 point now a cross-section) and the residue has no below-form; the wordmark is born FREE at md — 133.2 (the natural) at 769, identical at 900/1024, row 257.2 throughout — the t853-era birth-squeeze (a [768,770] zone at slope −1.0/px) died with the fallback metrics: the below-xl span is squeeze-free end to end" },
  pinned: PINNED,
  pins: CUT_PINS
    ? {
        provenanceWorld: buildId,
        date: new Date().toISOString(),
        tables: {
          left: Object.fromEntries(BANDS.map((b) => [b, rows[b] ? Math.round(rows[b].leftW * 10) / 10 : PINNED.left[b]])),
          right: Object.fromEntries(BANDS.map((b) => [b, rows[b] ? Math.round(rows[b].rightW * 10) / 10 : PINNED.right[b]])),
          seats: Object.fromEntries(BANDS.map((b) => [b, rows[b] ? rows[b].seats : PINNED.seats[b]])),
        },
        note: "cut by --cut-pins from this ride's live rows (the A-section's ±0.5 closure); the coefficient families re-cut with their own windows' work",
      }
    : (prevPins ?? null),
  baseline: !pinsLive,
  driftLedger: {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevFound ? cmp.prevBuild : null,
    prevDate: cmp.prevFound ? cmp.prev.date : null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces: bandFaces,
  },
};
const out = join(ROOT, "shots-qa/t834-band-sweep.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
if (!pinsLive || CUT_PINS) {
  if (CUT_PINS) {
    console.log(
      `\nFLEET-SWEEP t834: ${pass}/${pass + fail} green — PINS CUT (provenance ${buildId}; the fossil tables rode this run and their reds are the old world speaking, not failures; the NEXT same-world ride asserts the new tables hard)`
    );
  } else {
    console.log(
      `\nFLEET-SWEEP t834: ${pass}/${pass + fail} green — BASELINE RIDE (the pins' world ${pinsProvenance ?? "none"} ≠ live ${buildId}; ${fail} red${fail === 1 ? "" : "s"} are drift vs the pins' world, not failures)`
    );
  }
  console.log("  re-ride at the same world for the hard verdict, or --cut-pins to make this world the law");
  process.exit(0);
}
console.log(`\nFLEET-SWEEP t834: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

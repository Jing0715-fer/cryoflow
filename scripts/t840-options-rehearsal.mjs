#!/usr/bin/env node
/**
 * t840 — the t510 build day's DECISION TABLE: every option's AFTER,
 * pre-filmed (the rehearsal's second seat — the throwaway-DOM harness
 * generalized).
 *
 * Carried from the t839 tail: the t839 rehearsal pre-filmed option (a)'s
 * AFTER (the clip: geometry held, the paint clipped). This probe films
 * the OTHER options' AFTERs the same way, so the build day picks with
 * every alternative already measured — and the audit's arithmetic
 * pricing (t836: "(a) cheapest; (b) re-cut the wordmark's xl width;
 * (c) drop the project trigger's xl tier from 170 to 150") meets the
 * experiment.
 *
 * The options, on fresh clones of the live 1280 world (each swap starts
 * from a fresh load — a clone of a mutated tree would inherit the
 * mutation):
 *   (a)  overflowX = 'hidden' on the PS wrapper — the t839 form, re-rid
 *        here for continuity (the ratchet's anchor row).
 *   (b)  maxWidth on the wordmark box, TWO rows: 138 (the literal
 *        "re-cut" — REFUTED as written: the wordmark is ALREADY squeezed
 *        to 101.3 at 1280, a cap above the squeeze does not bind, the
 *        row does not move) and 88 (binding: the zone CLEARS, −4.8, and
 *        the reclaim rate steepens — the t836 slope −0.4 becomes −0.55).
 *   (c)  width = 150px on the project trigger (the xl tier 170 → 150) —
 *        REFUTED: the trigger still hits its 130 floor, the freed demand
 *        is eaten upstream (the tier law's shock absorber recovers), the
 *        wrapper yields DEEPER (115.3 → 106.6) and the paint WORSENS to
 *        11.4. The arithmetic pricing assumed the freed width stays in
 *        the mid tier; the experiment shows the row sends it upstream.
 *
 * New witness aboard the ruler: the wordmark's own squeezed rect (wmW
 * 101.3 at 1280 — the t837 derivation's 142.46 natural, squeezed 41 by
 * the row; the number that explains WHY (b) at 138 is a no-op).
 *
 * The t836 law: two rides bit-identical per option before its pins.
 * Sections:
 *   T0  the BEFORE pair bit-identical (2.7 / 130 / 115.3 / wmW 101.3)
 *   T1  (a) the clip: geometry UNCHANGED, the stack loses the TRIGGER,
 *       the chip keeps the click — the t839 continuity row
 *   T2  (b@138) the no-op: nothing moves (the cap above the squeeze)
 *   T3  (b@88) the bind: the zone clears (−4.8), the steepened law
 *       holds (≈ −0.55/px: 1283 = −6.4, 1286 = −8.1 — the pins are the
 *       measured points)
 *   T4  (c) the backfire: the floor binds anyway, the wrapper yields
 *       deeper, the paint WORSENS to 11.4
 *   T5  the restore: fresh load back to the BEFORE truth — the world
 *       unharmed
 *
 * The fifth seat (t848): every option's clone carries the BAND layer —
 * the sweep's BAND walk (t839's BAND_MEASURE form) rides each clone right
 * after its zone pair, so the build day's decision table carries
 * band-layer AFTERs. The measured law: the band's EDGES never move
 * (left 607.8 / right 628.3 / seats 12 on every option — same as the live
 * band and t839's cloneBand); whatever the option, only the mid row's
 * awake children pay: (a)/(b138) bit-for-bit the live band; (b88) the two
 * awake kids EQUALIZE at 122.8; (c) they DIVERGE 121.3 / 106.6 — the
 * wrapper alone pays the deeper yield. Measure-first discipline: the
 * (b88)/(c) numbers were probed (t848-band-after-probe) before pinning.
 *
 * The seventh seat (t850): the (b88) slope rows (1283/1286) and the (c)
 * world gain BAND walks — the mid-row-pays law tested ACROSS WIDTHS on
 * the option worlds. Measured laws: the EDGES ride the live rulers at
 * every width on both option worlds (610.8 / 613.8, 628.3, 12 — width-free
 * PAINT generalized from the fix world to the decision table); the
 * wrapper kid == the option's zone wrapW at every width (the cross-layer
 * identity, width-indexed); and the surprise — the (b88) EQUALIZE is an
 * AT-A-WIDTH phenomenon (exact at 1280, the label then trails the
 * wrapper 0.3 by 1283 and 0.7 by 1286: their slopes differ), while the
 * (c) divergence is width-stable (14.7 → 14.5 → 14.4). Measure-first:
 * t850-option-across-probe rode the widths before any pin.
 *
 * Receipt: shots-qa/t840-options-rehearsal.json (bandAfter key = the
 * fifth seat: live/a/b138/b88/c/restored band walks, plus the seventh
 * seat's width walks b88_1283/b88_1286/c_1283/c_1286).
 *
 *   node scripts/t840-options-rehearsal.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
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

/** agent-browser eval unwrap — the t837 defensive form. */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance ---------- */
const buildId = readFileSync(join(ROOT, ".next/BUILD_ID"), "utf8").trim();
console.log(
  `t840 options rehearsal — build ${buildId}, band 1280, every option's AFTER pre-filmed on throwaway clones\n`
);

/* ---------- the ruler: the t839 walk + the wordmark's squeezed rect.
 * One line, sync IIFE; String(className) before slice (the t838 SVG
 * lesson). ---------- */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const px = Math.min(tr.right - 0.5, cr.left + 0.5); const py = tr.top + tr.height / 2; const who = (el) => (el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : el === psWrap || psWrap.contains(el) ? 'WRAP' : 'OTHER'); const lbl = (el) => el.getAttribute('aria-label') || String(el.className).slice(0, 26); const paintEl = document.elementFromPoint(px, py); const stack = document.elementsFromPoint(px, py).slice(0, 8).map((el) => who(el) + '|' + lbl(el)); const wm = document.querySelector('div.min-w-0.leading-tight'); const wmW = wm ? Math.round(wm.getBoundingClientRect().width * 10) / 10 : null; const csW = getComputedStyle(psWrap); return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, wmW, wmMax: wm ? getComputedStyle(wm).maxWidth : null, paintAt: paintEl ? who(paintEl) + '|' + lbl(paintEl) : 'null', stack, wrapOverflowX: csW.overflowX, innerW: window.innerWidth }); })()";

/* ---------- the band measure (the fifth seat, t848): t839's BAND walk
 * ported verbatim — the header's left/right rows, the seats, the mid
 * band's children. Rides each option's clone right after its zone pair. */
const BAND_MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const left = hdr.children[0]; const right = hdr.children[1]; const mid = left.children[3]; const midKids = mid && mid.getBoundingClientRect().width > 0 ? [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || String(c.className).slice(0, 30), w: kid(c) })) : null; const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats: seats, midKids: midKids, innerW: window.innerWidth }); })()";

/* ---------- the swaps, per option (same child walks as the sweep/t839;
 * each runs on a FRESH load so the clone is the unmutated world) ---------- */
const SWAP_A =
  "(() => { const hdr = document.querySelector('header'); const mid = hdr.children[0].children[3]; const cw = mid.children[1]; if (!cw) return JSON.stringify({ error: 'no psWrap' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cmid = clone.querySelector('header').children[0].children[3]; const tw = cmid.children[1]; if (!tw) return JSON.stringify({ error: 'clone walk failed' }); tw.style.overflowX = 'hidden'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true, fix: tw.style.overflowX }); })()";
const SWAP_B = (px) =>
  "(() => { const hdr = document.querySelector('header'); const cwm0 = hdr.querySelector('div.min-w-0.leading-tight'); if (!cwm0) return JSON.stringify({ error: 'no wm' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cwm = clone.querySelector('div.min-w-0.leading-tight'); if (!cwm) return JSON.stringify({ error: 'clone walk failed' }); cwm.style.maxWidth = '" +
  px +
  "px'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true, fix: cwm.style.maxWidth }); })()";
const SWAP_C =
  "(() => { const hdr = document.querySelector('header'); const mid = hdr.children[0].children[3]; const cw = mid.children[1]; const ctrig0 = cw && cw.querySelector('button, [role=combobox]'); if (!ctrig0) return JSON.stringify({ error: 'no trig' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cmid = clone.querySelector('header').children[0].children[3]; const ctw = cmid.children[1].querySelector('button, [role=combobox]'); if (!ctw) return JSON.stringify({ error: 'clone walk failed' }); ctw.style.width = '150px'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true, fix: ctw.style.width }); })()";

const fontsWait = () => {
  for (let i = 0; i < 6; i++) {
    const s = evalJson("document.fonts.status");
    if (s === "loaded") return true;
    ab("wait 400");
  }
  return false;
};

const freshLoad = () => {
  ab("open http://localhost:3000/");
  ab(`set viewport 1280 ${HEIGHT}`);
  ab("wait 500");
  return fontsWait();
};

const pair = () => {
  const r1 = evalJson(MEASURE);
  const r2 = evalJson(MEASURE);
  return [r1, r2, JSON.stringify(r1) === JSON.stringify(r2)];
};

/* ---------- T0: the BEFORE pair + the live band (the fifth seat's ruler) ---------- */
const fonts0 = freshLoad();
const [b1, b2, bitB] = pair();
const bandLive = evalJson(BAND_MEASURE);

/* ---------- T1: option (a) — the clip ---------- */
const swapA = evalJson(SWAP_A);
ab("wait 500");
const fontsA = fontsWait();
const [a1, a2, bitA] = pair();
const bandA = evalJson(BAND_MEASURE);

/* ---------- T2: option (b@138) — the literal re-cut ---------- */
const fontsB1 = freshLoad();
const swapB138 = evalJson(SWAP_B(138));
ab("wait 500");
const fontsB138 = fontsWait();
const [bl1, bl2, bitBL] = pair();
const bandBL = evalJson(BAND_MEASURE);

/* ---------- T3: option (b@88) — the binding re-cut ---------- */
const fontsB2 = freshLoad();
const swapB88 = evalJson(SWAP_B(88));
ab("wait 500");
const fontsB88 = fontsWait();
const [bb1, bb2, bitB88] = pair();
const bandB88 = evalJson(BAND_MEASURE);
ab("set viewport 1283 800");
ab("wait 300");
const bb1283 = evalJson(MEASURE);
const bandB88_1283 = evalJson(BAND_MEASURE);
ab("set viewport 1286 800");
ab("wait 300");
const bb1286 = evalJson(MEASURE);
const bandB88_1286 = evalJson(BAND_MEASURE);
ab(`set viewport 1280 ${HEIGHT}`);
ab("wait 300");

/* ---------- T4: option (c) — the tier drop ---------- */
const fontsC = freshLoad();
const swapC = evalJson(SWAP_C);
ab("wait 500");
const fontsC2 = fontsWait();
const [c1, c2, bitC] = pair();
const bandC = evalJson(BAND_MEASURE);
/* the seventh seat: (c) gains the same width walks the (b88) slope rows ride */
const cAcross = {};
for (const w of [1283, 1286]) {
  ab(`set viewport ${w} 800`);
  ab("wait 300");
  cAcross[String(w)] = { zone: evalJson(MEASURE), band: evalJson(BAND_MEASURE) };
}
ab(`set viewport 1280 ${HEIGHT}`);
ab("wait 300");

/* ---------- T5: the restore ---------- */
const fontsR = freshLoad();
const r1 = evalJson(MEASURE);
const bandR = evalJson(BAND_MEASURE);

/* ---------- the assertions ---------- */
console.log("");
ok(
  fonts0 && bitB && !b1.error && b1.overlap === 2.7 && b1.trigW === 130 && b1.wrapW === 115.3 && b1.wmW === 101.3,
  `T0 the BEFORE pair bit-identical: 2.7 / 130 / 115.3, the wordmark's squeezed 101.3 aboard${b1.error ? " — " + b1.error : ""}`
);
ok(
  swapA.swapped === true && fontsA && bitA && a1.wrapOverflowX === "hidden" &&
    a1.overlap === 2.7 && a1.trigW === 130 && a1.wrapW === 115.3 && a1.wmW === 101.3 &&
    Array.isArray(a1.stack) && !a1.stack.some((s) => s.startsWith("TRIGGER")) && a1.stack.some((s) => s.startsWith("CHIP")) &&
    typeof a1.paintAt === "string" && a1.paintAt.startsWith("CHIP"),
  `T1 (a) the clip, the t839 continuity row: geometry UNCHANGED (${a1.overlap} / ${a1.trigW} / ${a1.wrapW}), the stack loses the TRIGGER, the chip keeps the click`
);
ok(
  fontsB1 && swapB138.swapped === true && bitBL && bl1.wmMax === "138px" &&
    bl1.wmW === 101.3 && bl1.overlap === 2.7 && bl1.wrapW === 115.3,
  `T2 (b@138) the NO-OP: the cap sits above the squeeze (wmW stays ${bl1.wmW} < 138), nothing moves (${bl1.overlap} / ${bl1.wrapW}) — the audit's literal (b) is refuted as written`
);
ok(
  fontsB2 && swapB88.swapped === true && bitB88 && bb1.wmMax === "88px" && bb1.wmW === 88 &&
    bb1.wrapW === 122.8 && bb1.overlap === -4.8,
  `T3 (b@88) the bind: the zone CLEARS (overlap ${bb1.overlap}, wrapper 115.3 → ${bb1.wrapW}, the wordmark capped at ${bb1.wmW})`
);
ok(
  bb1283.overlap === -6.4 && bb1286.overlap === -8.1,
  `T3b (b@88) the steepened law holds: 1283 = ${bb1283.overlap}, 1286 = ${bb1286.overlap} (slope ≈ −0.55/px, was −0.4 — the reclaim rate changed too; the pins are the measured points)`
);
ok(
  fontsC && swapC.swapped === true && bitC && c1.trigW === 130 && c1.wrapW === 106.6 && c1.overlap === 11.4,
  `T4 (c) the BACKFIRE: the floor binds anyway (trigW ${c1.trigW}), the wrapper yields deeper (115.3 → ${c1.wrapW}), the paint WORSENS to ${c1.overlap} (+8.7) — the tier law eats the freed demand upstream, the arithmetic pricing refuted`
);
ok(
  fontsR && r1.overlap === 2.7 && r1.wrapOverflowX === "visible" && r1.wmW === 101.3,
  `T5 the restore: fresh load back to the BEFORE truth (${r1.overlap} / ${r1.wrapOverflowX} / wmW ${r1.wmW}) — the world unharmed`
);

/* ---------- the fifth seat (t848): the band layer on every option's clone ---------- */
const edgesHold = (band) =>
  band && !band.error && band.innerW === 1280 && band.seats === 12 &&
  band.leftW === 607.8 && band.rightW === 628.3 && Array.isArray(band.midKids) && band.midKids.length === 4;
ok(
  edgesHold(bandA) && JSON.stringify(bandA) === JSON.stringify(bandLive),
  `T6 (a) the band layer rides the clone bit-for-bit: left ${bandA.leftW} / right ${bandA.rightW} / seats ${bandA.seats} == the live band — PAINT, not geometry, proven on the options harness too (the fifth seat)`
);
ok(
  edgesHold(bandBL) && JSON.stringify(bandBL) === JSON.stringify(bandLive),
  `T7 (b@138) the no-op is a no-op at the BAND layer too: the clone band == the live band bit-for-bit — nothing moves anywhere`
);
ok(
  edgesHold(bandB88) && bandB88.midKids[1].w === bb1.wrapW && bandB88.midKids[0].w === bandB88.midKids[1].w,
  `T8 (b@88) the band's EDGES hold (left ${bandB88.leftW} / right ${bandB88.rightW} / seats ${bandB88.seats}) while the mid row pays: the two awake children EQUALIZE at ${bandB88.midKids[1].w} (== the zone's wrapW ${bb1.wrapW}) — the freed 13.3 flows into the mid band, the edges never move`
);
ok(
  edgesHold(bandC) && bandC.midKids[1].w === c1.wrapW && bandC.midKids[0].w === 121.3,
  `T9 (c) the edges hold, the mid row DIVERGES: ${bandC.midKids[0].w} / ${bandC.midKids[1].w} (== the zone's wrapW ${c1.wrapW}) — the wrapper alone pays the deeper yield, the workspace label stays fat`
);
ok(
  edgesHold(bandR) && JSON.stringify(bandR) === JSON.stringify(bandLive),
  `T10 the restore at the BAND layer: the fresh-load band == the live band bit-for-bit — the world unharmed at every layer the table measures`
);

/* ---------- the seventh seat (t850): the pays law across widths, on the
 * option worlds. The probe (t850-option-across-probe) rode the widths
 * first; these pins carry the measured values. ---------- */
const edgeAt = (band, w, leftW) =>
  band && !band.error && band.innerW === w && band.leftW === leftW &&
  band.rightW === 628.3 && band.seats === 12 && Array.isArray(band.midKids) && band.midKids.length === 4;
ok(
  edgeAt(bandB88_1283, 1283, 610.8) && bandB88_1283.midKids[1].w === bb1283.wrapW,
  `T11 (b@88) the pays law is WIDTH-INDEXED at 1283: the edges ride the live rulers (left ${bandB88_1283.leftW} / right ${bandB88_1283.rightW} / seats ${bandB88_1283.seats} — width-free PAINT generalized to the option world), the wrapper kid ${bandB88_1283.midKids[1].w} == the zone's wrapW ${bb1283.wrapW}`
);
ok(
  edgeAt(bandB88_1286, 1286, 613.8) && bandB88_1286.midKids[1].w === bb1286.wrapW,
  `T12 (b@88) at 1286 likewise: edges ${bandB88_1286.leftW} / ${bandB88_1286.rightW} / ${bandB88_1286.seats}, the wrapper kid ${bandB88_1286.midKids[1].w} == the zone's wrapW ${bb1286.wrapW} — two widths, one law`
);
ok(
  bandB88.midKids[0].w === bandB88.midKids[1].w &&
    bandB88_1283.midKids[0].w === 124.1 && bandB88_1283.midKids[0].w !== bandB88_1283.midKids[1].w &&
    bandB88_1286.midKids[0].w === 125.4 && bandB88_1286.midKids[0].w !== bandB88_1286.midKids[1].w,
  `T13 the (b88) EQUALIZE is AT-A-WIDTH: exact at 1280 (${bandB88.midKids[0].w} == ${bandB88.midKids[1].w}), then DECAYS — the label trails the wrapper by ${(bandB88_1283.midKids[1].w - bandB88_1283.midKids[0].w).toFixed(1)} @1283 (${bandB88_1283.midKids[0].w} vs ${bandB88_1283.midKids[1].w}) and ${(bandB88_1286.midKids[1].w - bandB88_1286.midKids[0].w).toFixed(1)} @1286 (${bandB88_1286.midKids[0].w} vs ${bandB88_1286.midKids[1].w}): the two kids' slopes differ (+0.43/px vs +0.55/px), the equalize was the zone's anchor coincidence`
);
ok(
  edgeAt(cAcross["1283"].band, 1283, 610.8) && cAcross["1283"].band.midKids[1].w === cAcross["1283"].zone.wrapW &&
    edgeAt(cAcross["1286"].band, 1286, 613.8) && cAcross["1286"].band.midKids[1].w === cAcross["1286"].zone.wrapW &&
    cAcross["1283"].band.midKids[0].w === 122.2 && cAcross["1286"].band.midKids[0].w === 123.2 &&
    Math.round((cAcross["1283"].band.midKids[0].w - cAcross["1283"].band.midKids[1].w) * 10) / 10 === 14.5 &&
    Math.round((cAcross["1286"].band.midKids[0].w - cAcross["1286"].band.midKids[1].w) * 10) / 10 === 14.4,
  `T14 (c) across widths — the DIVERGENCE is width-stable: edges ride the rulers (610.8 / 613.8, 628.3, 12), the wrapper kid == the zone's wrapW (${cAcross["1283"].zone.wrapW} / ${cAcross["1286"].zone.wrapW}), the label grows at the live label's own rate (${cAcross["1283"].band.midKids[0].w} / ${cAcross["1286"].band.midKids[0].w}) — the gap holds 14.7 → 14.5 → 14.4 while (b88)'s decayed: two options, two width forms`
);

/* ---------- the receipt ---------- */
const receipt = {
  instrument: "scripts/t840-options-rehearsal.mjs",
  build: buildId,
  date: new Date().toISOString(),
  viewport: { w: 1280, h: HEIGHT },
  harness: "the t839 throwaway-DOM clone generalized: one fresh load + one clone per option, two bit-identical rides per option before its pins",
  before: [b1, b2],
  optionA: { swap: swapA, rides: [a1, a2] },
  optionB138: { swap: swapB138, rides: [bl1, bl2], verdict: "no-op — the cap sits above the wordmark's squeezed 101.3" },
  optionB88: { swap: swapB88, rides1280: [bb1, bb2], at1283: bb1283, at1286: bb1286, verdict: "binds and clears (−4.8); the slope steepens −0.4 → −0.55" },
  optionC: { swap: swapC, rides: [c1, c2], verdict: "backfires — the floor binds anyway, the wrapper yields deeper, the paint worsens to 11.4" },
  bandAfter: { live: bandLive, a: bandA, b138: bandBL, b88: bandB88, c: bandC, restored: bandR,
    b88_1283: bandB88_1283, b88_1286: bandB88_1286, c_1283: cAcross["1283"].band, c_1286: cAcross["1286"].band,
    cZone: { "1283": cAcross["1283"].zone, "1286": cAcross["1286"].zone },
    law: "the band's EDGES never move (607.8 / 628.3 / 12 on every option); only the mid row's awake children pay — (a)/(b138) bit-for-bit the live band, (b88) equalize at 122.8, (c) diverge 121.3/106.6 (the fifth seat, t848). The seventh seat (t850): across widths the edges ride the live rulers on BOTH option worlds (610.8 @1283 / 613.8 @1286, 628.3, 12), the wrapper kid == the option's zone wrapW at every width, and the mid row's own laws re-scope: the (b88) equalize is AT-A-WIDTH (exact at 1280, decays to 0.3 @1283 and 0.7 @1286), the (c) divergence is width-stable (14.7 → 14.5 → 14.4)" },
  restored: r1,
  verdict:
    fail === 0
      ? "the decision table is measured at BOTH layers and ACROSS WIDTHS: (a) clips with the geometry intact and the band bit-for-bit (THE fix, per the t839 ratchet); (b) needs a cap at ~88 to matter (brand cost: the wordmark truncates harder) and steepens the reclaim law; (c) backfires (+8.7). The band layer's verdict (the fifth seat): the EDGES never move on any option — left 607.8 / right 628.3 / seats 12 — only the mid row pays ((b88) equalizes at 122.8, (c) the wrapper alone pays to 106.6). The seventh seat: the edges law generalizes to every width on the option worlds (610.8 @1283 / 613.8 @1286 on both), the wrapper kid == the zone wrapW at every width, and the mid row re-scopes — the (b88) equalize is AT-A-WIDTH (decays 0 → 0.3 → 0.7), the (c) divergence width-stable (14.7 → 14.5 → 14.4). The build day lands (a) as ONE grind — every alternative's AFTER is already filmed at both layers and three widths"
      : "RED — the table disagrees; re-measure before the build day",
};
const out = join(ROOT, "shots-qa/t840-options-rehearsal.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nOPTIONS-REHEARSAL t840: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

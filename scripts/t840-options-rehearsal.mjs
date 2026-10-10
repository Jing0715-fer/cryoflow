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
 * Receipt: shots-qa/t840-options-rehearsal.json.
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

/* ---------- T0: the BEFORE pair ---------- */
const fonts0 = freshLoad();
const [b1, b2, bitB] = pair();

/* ---------- T1: option (a) — the clip ---------- */
const swapA = evalJson(SWAP_A);
ab("wait 500");
const fontsA = fontsWait();
const [a1, a2, bitA] = pair();

/* ---------- T2: option (b@138) — the literal re-cut ---------- */
const fontsB1 = freshLoad();
const swapB138 = evalJson(SWAP_B(138));
ab("wait 500");
const fontsB138 = fontsWait();
const [bl1, bl2, bitBL] = pair();

/* ---------- T3: option (b@88) — the binding re-cut ---------- */
const fontsB2 = freshLoad();
const swapB88 = evalJson(SWAP_B(88));
ab("wait 500");
const fontsB88 = fontsWait();
const [bb1, bb2, bitB88] = pair();
ab("set viewport 1283 800");
ab("wait 300");
const bb1283 = evalJson(MEASURE);
ab("set viewport 1286 800");
ab("wait 300");
const bb1286 = evalJson(MEASURE);
ab(`set viewport 1280 ${HEIGHT}`);
ab("wait 300");

/* ---------- T4: option (c) — the tier drop ---------- */
const fontsC = freshLoad();
const swapC = evalJson(SWAP_C);
ab("wait 500");
const fontsC2 = fontsWait();
const [c1, c2, bitC] = pair();

/* ---------- T5: the restore ---------- */
const fontsR = freshLoad();
const r1 = evalJson(MEASURE);

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
  restored: r1,
  verdict:
    fail === 0
      ? "the decision table is measured: (a) clips with the geometry intact (THE fix, per the t839 ratchet); (b) needs a cap at ~88 to matter (brand cost: the wordmark truncates harder) and steepens the reclaim law; (c) backfires (+8.7). The build day lands (a) as ONE grind — every alternative's AFTER is already filmed"
      : "RED — the table disagrees; re-measure before the build day",
};
const out = join(ROOT, "shots-qa/t840-options-rehearsal.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nOPTIONS-REHEARSAL t840: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

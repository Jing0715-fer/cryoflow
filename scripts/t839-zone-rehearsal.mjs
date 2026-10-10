#!/usr/bin/env node
/**
 * t839 — the t510 residue fix's proof, PRE-FLIGHTED on a throwaway DOM
 * clone (zero src — the fix's rehearsal, not the fix).
 *
 * Carried from the t838 tail (third window running): the build-day fix is
 * option (a) `overflow-hidden` on the PS wrapper. The t836 pricing says
 * the fix changes the PAINT, not the geometry — the wrapper yields to
 * 115.3 while the trigger holds its 130px floor, so 14.7px of trigger
 * overflows the wrapper and 2.7px of it paints into the RELION chip's
 * box (chip.left = wrap.right + 12). Clipping the wrapper stops the
 * PAINT; the LAYOUT (trigger 130, wrapper 115.3, overlap 2.7) must not
 * move. Until now that pricing was arithmetic only — this probe makes it
 * an EXPERIMENT, so the build day lands the fix with its proof already
 * rehearsed and the ratchet's post-fix form written from measurement,
 * not guesswork.
 *
 * The instrument: the sweep's ZONE_MEASURE walk (mid = header's
 * children[0].children[3], psWrap = mid.children[1], chip =
 * header's children[1].children[0]) grown two honest teeth:
 *   - the STACK witness — document.elementsFromPoint at the band point
 *     (px = min(trig.right − 0.5, chip.left + 0.5)), ALL hit elements
 *     top-first. The residue's paint is real iff the TRIGGER is in the
 *     stack; clipped iff it leaves. Hit-testing respects overflow
 *     clipping, so the stack is the clipped-truth ruler the audit asked
 *     for ("the ratchet needs this paint witness, not the raw rect delta
 *     alone") — sharper than topmost alone, which the chip already owns.
 *   - the wrapper's computed overflow-x (the fix's own fingerprint).
 *
 * The fix rides a THROWAWAY documentElement clone: cloneNode(true),
 * overflowX = 'hidden' on the clone's psWrap (same child walk), then
 * document.replaceChild(clone, original). The clone is static — React's
 * root stays on the detached original, so nothing re-renders under the
 * ruler; the fresh `open` at the end restores the live world.
 *
 * The t836 law: two rides bit-identical BEFORE the pins, and again AFTER
 * the swap. Sections:
 *   R0  the BEFORE pair bit-identical (precondition)
 *   R1  the BEFORE geometry reproduces the D4 pin (2.7 / 130 / 115.3)
 *   R2  the BEFORE paint is real: topmost CHIP, the TRIGGER in the stack
 *   R3  the BEFORE wrapper overflow-x = visible (the fix absent)
 *   R4  the fix aboard the clone: overflow-x hidden, AFTER pair identical
 *   R5  the AFTER geometry UNCHANGED (2.7 / 130 / 115.3) — the pricing
 *       "paint, not geometry" VERIFIED by experiment
 *   R6  the AFTER paint clipped: the TRIGGER gone from the stack
 *   R7  the click owner unchanged: topmost still CHIP
 *   R8  the edge moves not on the clone (1286 = 0.3, 1287 = −0.1, both
 *       overflow hidden, the trigger clipped at both — the clip is total
 *       beyond the wrapper's edge)
 *   R9  the restore: fresh load back to the BEFORE truth — the world
 *       unharmed
 *
 * Receipt: shots-qa/t839-zone-rehearsal.json (provenance: BUILD_ID read
 * from .next/BUILD_ID at run time).
 *
 *   node scripts/t839-zone-rehearsal.mjs
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

/** agent-browser eval unwrap — the t837 defensive form: parse once, and
 * re-parse only an inner JSON object/array; a plain string IS the value
 * (the narrator law's second lesson, kept aboard). */
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
  `t839 zone rehearsal — build ${buildId}, band 1280 (the zone's left edge), the fix rehearsed on a throwaway clone\n`
);

/* ---------- the measure: the sweep's ZONE_MEASURE walk + the stack
 * witness + the wrapper's computed overflow-x. One line, sync IIFE
 * (the t834 lesson); String(className) before slice (the t838 SVG
 * lesson). ---------- */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const px = Math.min(tr.right - 0.5, cr.left + 0.5); const py = tr.top + tr.height / 2; const who = (el) => (el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : el === psWrap || psWrap.contains(el) ? 'WRAP' : 'OTHER'); const lbl = (el) => el.getAttribute('aria-label') || String(el.className).slice(0, 26); const paintEl = document.elementFromPoint(px, py); const stack = document.elementsFromPoint(px, py).slice(0, 8).map((el) => who(el) + '|' + lbl(el)); const cs = getComputedStyle(chip); const csW = getComputedStyle(psWrap); return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, chipBg: cs.backgroundColor, paintAt: paintEl ? who(paintEl) + '|' + lbl(paintEl) : 'null', stack, wrapOverflowX: csW.overflowX, innerW: window.innerWidth }); })()";

/* ---------- the fix, on the clone: same child walk, one style set, one
 * document.replaceChild (fallback remove+append). Sync, one eval. ---------- */
const SWAP =
  "(() => { const hdr = document.querySelector('header'); if (!hdr) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; const psWrap = mid && mid.children[1]; if (!psWrap) return JSON.stringify({ error: 'no psWrap' }); const before = getComputedStyle(psWrap).overflowX; const orig = document.documentElement; const clone = orig.cloneNode(true); const chdr = clone.querySelector('header'); const cmid = chdr && chdr.children[0] && chdr.children[0].children[3]; const cw = cmid && cmid.children[1]; if (!cw) return JSON.stringify({ error: 'clone walk failed' }); cw.style.overflowX = 'hidden'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true, before, fix: cw.style.overflowX, headerAboard: !!clone.querySelector('header') }); })()";

const fontsWait = () => {
  for (let i = 0; i < 6; i++) {
    const s = evalJson("document.fonts.status");
    if (s === "loaded") return true;
    ab("wait 400");
  }
  return false;
};

/* ---------- boot at the zone's left edge ---------- */
ab(`set viewport 1280 ${HEIGHT}`);
ab("wait 350");
const fonts1 = fontsWait();

/* ---------- BEFORE: two rides ---------- */
const b1 = evalJson(MEASURE);
const b2 = evalJson(MEASURE);
const bitB = JSON.stringify(b1) === JSON.stringify(b2);

/* ---------- THE FIX: clone & swap ---------- */
const swap = evalJson(SWAP);
ab("wait 600");
const fonts2 = fontsWait();

/* ---------- AFTER: two rides on the clone ---------- */
const a1 = evalJson(MEASURE);
const a2 = evalJson(MEASURE);
const bitA = JSON.stringify(a1) === JSON.stringify(a2);

/* ---------- the clone-zone: the edge must move not ---------- */
ab("set viewport 1286 800");
ab("wait 300");
const cz1286 = evalJson(MEASURE);
ab("set viewport 1287 800");
ab("wait 300");
const cz1287 = evalJson(MEASURE);
ab(`set viewport 1280 800`);
ab("wait 300");

/* ---------- the restore: a fresh load, the world unharmed ---------- */
ab("open http://localhost:3000/");
ab("wait 800");
const fonts3 = fontsWait();
const r1 = evalJson(MEASURE);

/* ---------- the assertions ---------- */
console.log("");
ok(
  fonts1 && bitB && !b1.error && b1.mid === true,
  `R0 the BEFORE pair rides bit-identical at 1280, fonts loaded${b1.error ? " — " + b1.error : ""}`
);
ok(
  b1.overlap === 2.7 && b1.trigW === 130 && b1.wrapW === 115.3,
  `R1 the BEFORE geometry reproduces the D4 pin: overlap ${b1.overlap} / trigger ${b1.trigW} / wrapper ${b1.wrapW}`
);
ok(
  typeof b1.paintAt === "string" &&
    b1.paintAt.startsWith("CHIP") &&
    Array.isArray(b1.stack) &&
    b1.stack.some((s) => s.startsWith("TRIGGER")),
  `R2 the BEFORE paint is real: topmost ${b1.paintAt}, the TRIGGER in the band's hit stack [${(b1.stack || []).slice(0, 3).join(" · ")}]`
);
ok(
  b1.wrapOverflowX === "visible",
  `R3 the BEFORE wrapper overflow-x = ${b1.wrapOverflowX} — the fix is absent, the residue live`
);
ok(
  swap.swapped === true && fonts2 && bitA && !a1.error && a1.wrapOverflowX === "hidden",
  `R4 the fix is aboard the clone: overflow-x ${a1.wrapOverflowX} (live was ${swap.before}), the AFTER pair bit-identical${swap.error ? " — " + swap.error : ""}`
);
ok(
  a1.overlap === 2.7 && a1.trigW === 130 && a1.wrapW === 115.3,
  `R5 the AFTER geometry UNCHANGED (${a1.overlap} / ${a1.trigW} / ${a1.wrapW}) — option (a) changes the PAINT, not the geometry: the t836 pricing VERIFIED`
);
ok(
  Array.isArray(a1.stack) &&
    !a1.stack.some((s) => s.startsWith("TRIGGER")) &&
    a1.stack.some((s) => s.startsWith("CHIP")),
  `R6 the AFTER paint is clipped: the TRIGGER gone from the hit stack, the CHIP remains [${(a1.stack || []).slice(0, 3).join(" · ")}]`
);
ok(
  typeof a1.paintAt === "string" && a1.paintAt.startsWith("CHIP"),
  `R7 the click owner unchanged: topmost still ${a1.paintAt}`
);
ok(
  cz1286.overlap === 0.3 &&
    cz1287.overlap === -0.1 &&
    cz1286.wrapOverflowX === "hidden" &&
    cz1287.wrapOverflowX === "hidden" &&
    Array.isArray(cz1286.stack) &&
    !cz1286.stack.some((s) => s.startsWith("TRIGGER")) &&
    Array.isArray(cz1287.stack) &&
    !cz1287.stack.some((s) => s.startsWith("TRIGGER")),
  `R8 the edge moves not on the clone: 1286 = ${cz1286.overlap}, 1287 = ${cz1287.overlap}, both overflow hidden, the trigger clipped at both — the clip is total beyond the wrapper's edge`
);
ok(
  fonts3 &&
    r1.overlap === 2.7 &&
    r1.wrapOverflowX === "visible" &&
    Array.isArray(r1.stack) &&
    r1.stack.some((s) => s.startsWith("TRIGGER")),
  `R9 the restore: fresh load back to the BEFORE truth (${r1.overlap} / ${r1.wrapOverflowX} / trigger aboard) — the world unharmed`
);

/* ---------- the receipt ---------- */
const receipt = {
  instrument: "scripts/t839-zone-rehearsal.mjs",
  build: buildId,
  date: new Date().toISOString(),
  viewport: { w: 1280, h: HEIGHT },
  fix: "option (a): overflowX = 'hidden' on the PS wrapper of a throwaway documentElement clone (document.replaceChild swap; React's root stays on the detached original)",
  ruler: "the sweep's ZONE_MEASURE walk + the elementsFromPoint STACK witness + the wrapper's computed overflow-x",
  before: [b1, b2],
  swap,
  after: [a1, a2],
  cloneZone: { "1286": cz1286, "1287": cz1287 },
  restored: r1,
  verdict:
    fail === 0
      ? "the fix's proof is rehearsed: the geometry held (2.7 / 130 / 115.3), the paint clipped (the trigger left the stack), the chip kept the click, the edge moved not — the build day lands option (a) with its ratchet's post-fix form already measured"
      : "RED — the rehearsal disagrees with the pricing; do not land the fix on this form",
};
const out = join(ROOT, "shots-qa/t839-zone-rehearsal.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nZONE-REHEARSAL t839: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

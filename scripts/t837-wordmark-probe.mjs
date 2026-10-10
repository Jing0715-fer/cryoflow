#!/usr/bin/env node
/**
 * t837 — the wordmark's width provenance: the audit's last open constant
 * DERIVED.
 *
 * Carried from the t836 tail: the band audit's closed form (A4e) had one
 * text-dependent pinned variable without its own derivation — the
 * wordmark's 142px, pinned from the t834 live sweep receipt but never
 * derived from anything. It is also the LOAD-BEARING constant: the 768
 * band's 2px squeeze law (A4e-2, natural 266 > available 264) hinges on
 * wm = 142 — if the true text width were 140, natural would be 264 and
 * the squeeze law would be void. A constant that decides a law owes the
 * law its own derivation.
 *
 * The instrument: font metrics. The wordmark box (header.tsx) is
 *
 *   <div className="min-w-0 leading-tight max-md:hidden">
 *     <p className="truncate text-sm font-semibold tracking-tight">CryoFlow</p>
 *     <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
 *       Cryo-EM Workflow Builder
 *     </p>
 *   </div>
 *
 * — two block lines, no padding, no border: the box's natural width is
 * max(line1, line2) at the band where the row does not squeeze (1024,
 * the audit's A4e-3). Each line's advance is measured on a canvas under
 * the element's OWN computed font, with the computed letter-spacing
 * applied (two independent models — canvas ctx.letterSpacing, and the
 * manual raw + ls×len under the CSS trailing-spacing rule — must agree).
 *
 * The same ride witnesses the audit's OTHER text constant: the two
 * ViewSwitcher tab labels (Dashboard / Workflow at text-xs font-medium,
 * the vsXl floor's 120).
 *
 * The t836 law applies: two rides, bit-identical, before any pin is
 * judged. The receipt lands in shots-qa/t837-wordmark-probe.json
 * (provenance: BUILD_ID read from .next/BUILD_ID at run time).
 *
 *   node scripts/t837-wordmark-probe.mjs
 *
 * Sections:
 *   W0  the two-ride bit-identity (the pin precondition)
 *   W1  the seat parses live (the audit's A4d-2, live half)
 *   W2  the two-line structure live (line 2 aboard at 1024 via sm:block)
 *   W3  the derivation closes: |max(lines) − rect| ≤ 0.5
 *   W4  the pin: |round(derived) − 142| ≤ 0.5 (derived, not bare)
 *   W5  the winner is line 2 — the derivation names the 142's carrier
 *   W6  the two letter-spacing models agree (canvas set ≡ manual)
 *   W7  the fonts precondition (document.fonts loaded before the ride)
 *   W8  the labels' 120 witnessed by the same ruler (±0.5)
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

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

/** agent-browser eval prints the JSON string-encoded; unwrap (twice).
 * One probe lesson paid en route (the t836 narrator law): agent-browser
 * prints a JSON-SHAPED string as-is but ENCODES a plain string ("loaded"
 * → "loaded" quoted) — so parse once, and re-parse only an inner
 * JSON object/array; a plain string IS the value, a second parse dies. */
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

/* ---------- provenance: the world this probe witnesses ---------- */
const buildId = readFileSync(join(ROOT, ".next/BUILD_ID"), "utf8").trim();
console.log(`t837 wordmark probe — build ${buildId}, band 1024 (natural, no squeeze)\n`);

/* viewport 1024: the audit's A4e-3 band — the wordmark sits at its
 * natural width here, the honest ruler for a natural-width constant */
ab("set viewport 1024 800");
ab("wait 350");

/* ---------- W7 first: the fonts precondition ---------- */
let fontStatus = "";
for (let i = 0; i < 5; i++) {
  fontStatus = evalJson("document.fonts.status");
  if (fontStatus === "loaded") break;
  ab("wait 400");
}
ok(
  fontStatus === "loaded",
  `W7 fonts loaded before the metrics ride (document.fonts.status: ${fontStatus})`
);

/* ---------- the measure: one line, sync IIFE (the t834 lesson) ----------
 * ctx.letterSpacing support probed once with a non-zero value (a 0px
 * probe cannot distinguish support from an expando property); the two
 * models measured per line; the labels measured off the tab spans'
 * computed fonts (display:none resolves fonts fine — no layout needed). */
const MEASURE =
  "(() => { const wm = document.querySelector('header div.min-w-0.leading-tight'); if (!wm) return JSON.stringify({ error: 'wordmark div not found' }); const ctx = document.createElement('canvas').getContext('2d'); let lsOK = true; try { ctx.letterSpacing = '2px'; lsOK = ctx.letterSpacing === '2px'; ctx.letterSpacing = '0px'; } catch (e) { lsOK = false; } const lsPx = (cs) => (cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0); const line = (p) => { const cs = getComputedStyle(p); const font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; ctx.font = font; const raw = ctx.measureText(p.textContent).width; const ls = lsPx(cs); let wSet = raw; if (lsOK) { ctx.letterSpacing = ls + 'px'; wSet = ctx.measureText(p.textContent).width; ctx.letterSpacing = '0px'; } const wMan = raw + ls * p.textContent.length; return { text: p.textContent, font, display: cs.display, ls: cs.letterSpacing, raw: Math.round(raw * 100) / 100, wSet: Math.round(wSet * 100) / 100, wMan: Math.round(wMan * 100) / 100 }; }; const lines = [...wm.querySelectorAll('p')].map(line); const vis = lines.filter((l) => l.display !== 'none'); const derived = vis.length ? Math.max(...vis.map((l) => (lsOK ? l.wSet : l.wMan))) : 0; const labels = [...document.querySelectorAll('header [role=tablist] [role=tab] span')].map((s) => { const cs = getComputedStyle(s); const c2 = document.createElement('canvas').getContext('2d'); c2.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; const ls = lsPx(cs); return { text: s.textContent, w: Math.round((c2.measureText(s.textContent).width + ls * s.textContent.length) * 100) / 100 }; }); const labelsSum = Math.round(labels.reduce((a, b) => a + b.w, 0) * 100) / 100; return JSON.stringify({ rect: Math.round(wm.getBoundingClientRect().width * 100) / 100, cls: wm.className, lsOK, lines, derived: Math.round(derived * 100) / 100, labels, labelsSum, innerW: window.innerWidth }); })()";

const run1 = evalJson(MEASURE);
const run2 = evalJson(MEASURE);
const bit = JSON.stringify(run1) === JSON.stringify(run2);

/* ---------- the assertions ---------- */
console.log("");
ok(
  bit && !run1.error,
  `W0 two rides bit-identical (the t836 law)${run1.error ? " — " + run1.error : ""}`
);
if (run1.error) {
  console.log(`\nFLEET-SWEEP t837: ${pass}/${pass + fail} green`);
  ab("set viewport 1280 800");
  process.exit(1);
}

const r = run1;
ok(
  r.cls === "min-w-0 leading-tight max-md:hidden",
  `W1 the seat parses live (the audit's A4d-2 half) — got "${r.cls}"`
);

const [l1, l2] = r.lines;
ok(
  l1 && l2 && l1.display === "block" && l2.display === "block",
  `W2 the two-line structure live at 1024 (line 2 aboard via sm:block) — got "${l1.display}" / "${l2.display}"`
);
ok(
  Math.abs(r.derived - r.rect) <= 0.5,
  `W3 the derivation closes: |max(lines) − rect| ≤ 0.5 — derived ${r.derived} vs rect ${r.rect}`
);
ok(
  Math.abs(Math.round(r.derived) - 142) <= 0.5,
  `W4 the pin stays, now DERIVED: round(${r.derived}) = ${Math.round(r.derived)} = the audit's wm 142`
);
ok(
  l2 && Math.max(l1.wSet, l2.wSet) === l2.wSet,
  `W5 the winner is line 2 "${l2.text}" (11px/400) — it carries the 142; line 1 "${l1.text}" rides ${l1.wSet}`
);
const modelsAgree = r.lines.every((l) => Math.abs(l.wSet - l.wMan) <= 0.1);
ok(
  r.lsOK && modelsAgree,
  `W6 the two letter-spacing models agree (canvas set ≡ manual, ±0.1) — lsOK ${r.lsOK}, line1 ${l1.wSet}/${l1.wMan}, line2 ${l2.wSet}/${l2.wMan}`
);
ok(
  Math.abs(r.labelsSum - 120) <= 0.5,
  `W8 the labels' 120 witnessed by the same ruler (±0.5) — sum ${r.labelsSum} (${r.labels.map((l) => `${l.text} ${l.w}`).join(" + ")})`
);

/* ---------- restore the working band ---------- */
ab("set viewport 1280 800");

/* ---------- the receipt ---------- */
const receipt = {
  provenance: {
    buildId,
    viewport: "1024x800 (the A4e-3 natural band)",
    instrument: "canvas measureText under the elements' own computed fonts, letter-spacing applied (two models), max-of-lines for the box",
    date: new Date().toISOString(),
  },
  bitIdentical: bit,
  runs: [run1, run2],
  verdict: fail === 0 ? "green" : "red",
};
writeFileSync(
  join(ROOT, "shots-qa/t837-wordmark-probe.json"),
  JSON.stringify(receipt, null, 2)
);
console.log(`\nreceipt: /home/z/my-project/shots-qa/t837-wordmark-probe.json`);

console.log(`\nFLEET-SWEEP t837: ${pass}/${pass + fail} green`);
process.exit(fail ? 1 : 0);

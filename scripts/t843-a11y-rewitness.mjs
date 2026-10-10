#!/usr/bin/env node
/**
 * t843 — the a11y census's cheap honesty pair, RE-WITNESSED live (zero src).
 *
 * docs/a11y-census.md swept the app's four faces once (t698 era) and found
 * the name layer 100% covered — "zero unnamed buttons" in a census that had
 * never seen one. Its own "What this census buys" paragraph promised the
 * re-witness would be free: "one eval per face, ~a minute". This window pays
 * that promise on the CHEAP HONESTY PAIR — the two faces reachable without
 * fragile interaction chains:
 *   C  the workflow canvas (:3000/, the app's root face)
 *   D  the dashboard (the exact-text 'Dashboard' switcher button, one click)
 *
 * The measure computes names the way the tree does (the census's method):
 * aria-label -> aria-labelledby (resolved) -> textContent, with img alt and
 * input value/placeholder as the tree's own fallbacks. Two rides per face,
 * bit-identical before the pins (the t836 law). Pins:
 *   A1  canvas rides bit-identical
 *   A2  canvas: zero unnamed buttons (the census's never-broken invariant)
 *   A3  canvas: zero unnamed form controls
 *   A4  canvas: the seat count vs the census's 142 recorded honestly (the
 *       DOM count is viewport-independent; the census's floor must hold)
 *   A5  the dashboard face actually arrived (its own heading, not the canvas's)
 *   A6  dashboard rides bit-identical
 *   A7  dashboard: zero unnamed buttons
 *   A8  dashboard: zero alt-less imgs — by hasAttribute, NOT by falsy alt:
 *       the exploratory ride read "3 alt-less" and the t695 negative-reading
 *       law caught the probe before it slandered the UI (all three carry the
 *       decorative alt="" — present, empty, CORRECT)
 *   A9  dashboard: the seat count vs the census's 114 recorded honestly
 *   A10 restore: fresh load back to the canvas, the switcher still aboard
 *
 * Receipt: shots-qa/t843-a11y-rewitness.json (provenance: BUILD_ID read from
 * .next/BUILD_ID at run time, viewport recorded live).
 *
 *   node scripts/t843-a11y-rewitness.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) =>
  execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });

/** agent-browser eval unwrap — the t837 defensive form: parse once, and
 * re-parse only an inner JSON object/array; a plain string IS the value. */
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
  `t843 a11y re-witness — build ${buildId}, the cheap honesty pair (canvas + dashboard), the census's zero-unnamed invariant re-walked live\n`
);

/* ---------- the measure: the census's name computation, one line sync IIFE */
const MEASURE =
  '(() => { const nameOf = (el) => { const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim(); const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\\s+/).map((id) => { const d = document.getElementById(id); return d ? (d.textContent || "").trim() : ""; }).join(" ").trim(); if (t) return t; } const tc = (el.textContent || "").trim(); if (tc) return tc; if (el.tagName === "IMG") { const a = el.getAttribute("alt"); if (a !== null && a.trim()) return a.trim(); } if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const v = (el.value || "").trim(); if (v) return v; const p = (el.getAttribute("placeholder") || "").trim(); if (p) return p; } return ""; }; const btns = Array.from(document.querySelectorAll("button")); const unBtns = btns.filter((b) => !nameOf(b)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); return JSON.stringify({ url: location.pathname, btns: btns.length, unBtns: unBtns.length, unBtnsWho: unBtns.slice(0, 5).map((b) => String(b.className).slice(0, 60)), imgs: imgs.length, altless: altless.length, ctrls: ctrls.length, unCtrls: unCtrls.length, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40), innerW: window.innerWidth, innerH: window.innerHeight }); })()';

/* ---------- Face C: the workflow canvas ---------- */
console.log("Face C — the workflow canvas (:3000/)");
ab("open http://localhost:3000");
execSync("sleep 3");
const c1 = evalJson(MEASURE);
const c2 = evalJson(MEASURE);
ok("A1 canvas rides bit-identical", JSON.stringify(c1) === JSON.stringify(c2), `btns=${c1.btns} imgs=${c1.imgs} ctrls=${c1.ctrls}`);
ok("A2 canvas zero unnamed buttons", c1.unBtns === 0, `unBtns=${c1.unBtns}${c1.unBtns ? " who=" + c1.unBtnsWho.join("|") : ""}`);
ok("A3 canvas zero unnamed form controls", c1.unCtrls === 0, `unCtrls=${c1.unCtrls}/${c1.ctrls}`);
ok("A4 canvas seat floor holds (census 142)", c1.btns >= 142, `live=${c1.btns} (census 142, drift +${c1.btns - 142})`);

/* ---------- Face D: the dashboard ---------- */
console.log("Face D — the dashboard (one exact-text click)");
const clickR = evalJson(
  '(() => { const t = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === "Dashboard"); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()'
);
ok("A5a the switcher clicked", clickR.clicked === true);
execSync("sleep 2");
const d1 = evalJson(MEASURE);
const d2 = evalJson(MEASURE);
ok("A5b the dashboard face arrived", d1.heading && d1.heading !== c1.heading && d1.btns !== c1.btns, `heading="${d1.heading}" btns=${d1.btns}`);
ok("A6 dashboard rides bit-identical", JSON.stringify(d1) === JSON.stringify(d2), `btns=${d1.btns} imgs=${d1.imgs}`);
ok("A7 dashboard zero unnamed buttons", d1.unBtns === 0, `unBtns=${d1.unBtns}${d1.unBtns ? " who=" + d1.unBtnsWho.join("|") : ""}`);
ok("A8 dashboard zero alt-less imgs (hasAttribute, not falsy)", d1.altless === 0, `imgs=${d1.imgs} altless=${d1.altless}`);
ok("A9 dashboard seat floor holds (census 114)", d1.btns >= 114, `live=${d1.btns} (census 114, drift +${d1.btns - 114})`);

/* ---------- A10 restore ---------- */
console.log("Restore — fresh load back to the canvas");
ab("open http://localhost:3000");
execSync("sleep 3");
const r1 = evalJson(MEASURE);
ok("A10 world unharmed (canvas back, switcher aboard)", r1.btns === c1.btns && r1.heading === c1.heading, `btns=${r1.btns} heading="${r1.heading}"`);

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the census's zero-unnamed invariant holds on the cheap honesty pair: ${c1.btns + d1.btns} button-views across two faces, none without a name; the seats grew +${c1.btns - 142}/+${d1.btns - 114} since the census and every newcomer still speaks; the decorative alt="" trap caught the probe once (the t695 law's second bite) and the UI walked clean`
  : `${fail} red — reconcile the a11y layer before any further UI work`;
const receipt = {
  instrument: "scripts/t843-a11y-rewitness.mjs",
  build: buildId,
  date: new Date().toISOString(),
  viewport: { w: c1.innerW, h: c1.innerH },
  faces: {
    canvas: { census: { btns: 142, unnamed: 0 }, live: [c1, c2] },
    dashboard: { census: { btns: 114, unnamed: 0, imgs: 3, altless: 0 }, live: [d1, d2], arrival: clickR },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
};
writeFileSync("shots-qa/t843-a11y-rewitness.json", JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nA11Y-RE-WITNESS t843: ${pass}/${pass + fail}${fail ? " RED" : " green"}`);
process.exit(fail ? 1 : 0);

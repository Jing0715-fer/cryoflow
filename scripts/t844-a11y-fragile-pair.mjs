#!/usr/bin/env node
/**
 * t844 — the a11y census's FRAGILE PAIR, walked with the census's own
 * method-artifact discipline (zero src — the rotation's second course).
 *
 * docs/a11y-census.md swept four faces; t843 re-walked the cheap honesty
 * pair (canvas + dashboard). The remaining two need interaction chains —
 * the census's method artifact was written exactly about this fragility
 * (its probe clicked the first /auto-refine/ match and opened the WRONG
 * dialog). This instrument rides the pair with that lesson aboard:
 *
 *   I  the JOB INSPECTOR — door: dashboard → the saved-view card whose
 *      textContent starts with 'Centered iso view' (the door the census's
 *      probe reached by ACCIDENT, now taken deliberately); pins: the
 *      dialog's aria-labelledby resolves and carries the tenant heading
 *      ("3D auto-refine — job inspector"), focus is trapped, two
 *      bit-identical page-wide rides, ZERO unnamed buttons, the census's
 *      180-button floor, the dialog subset clean, Escape closes.
 *   P  the ⌘K PALETTE — door: the t483 contract event
 *      ('cryoflow:open-palette', the SAME door the help guide uses —
 *      synthetic ⌘K keydown does not wake the React listener reliably,
 *      the contract event is the in-contract path); pins: the dialog +
 *      cmdk-input present, two bit-identical rides, ZERO unnamed, the
 *      census's 150-button floor, the input's name riding the placeholder
 *      (observation #2 holds — its aria-labelledby points at an EMPTY
 *      Radix styling label, so the tree falls through to the placeholder
 *      text; recorded, not fixed — same verdict as the census's).
 *
 * The name computation is the census's (aria-label → labelledby resolved
 * → textContent, img alt / input value / placeholder as the tree's own
 * fallbacks), two rides per state, bit-identical before the pins (the
 * t836 law).
 *
 * Receipt: shots-qa/t844-a11y-fragile-pair.json.
 *
 *   node scripts/t844-a11y-fragile-pair.mjs
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
const sleep = (s) => execSync(`sleep ${s}`);

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
  `t844 a11y fragile pair — build ${buildId}, the inspector + palette walked with the method artifact's discipline\n`
);

/* ---------- the measure: census name computation, one line sync IIFE.
 * NO ${} inside — the shell reads this string (the t844 lesson). */
const MEASURE =
  '(() => { const nameOf = (el) => { const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim(); const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\\s+/).map((id) => { const d = document.getElementById(id); return d ? (d.textContent || "").trim() : ""; }).join(" ").trim(); if (t) return t; } const tc = (el.textContent || "").trim(); if (tc) return tc; if (el.tagName === "IMG") { const a = el.getAttribute("alt"); if (a !== null && a.trim()) return a.trim(); } if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const v = (el.value || "").trim(); if (v) return v; const p = (el.getAttribute("placeholder") || "").trim(); if (p) return p; } return ""; }; const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const dlg = document.querySelector("[role=dialog]"); const dlgBtns = dlg ? Array.from(dlg.querySelectorAll("button")) : []; const dlgUn = dlgBtns.filter((b) => !nameOf(b)); const ip = document.querySelector("[cmdk-input]"); return JSON.stringify({ pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), hasDlg: !!dlg, dlgBtns: dlgBtns.length, dlgUnnamed: dlgUn.length, dlgFocus: dlg ? dlg.contains(document.activeElement) : null, dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null, ip: ip ? { aria: ip.getAttribute("aria-label"), ph: ip.getAttribute("placeholder") } : null }); })()';

/* ---------- baseline: the canvas ---------- */
console.log("Baseline — the canvas (the t843 floors still hold)");
ab("open http://localhost:3000");
sleep(3);
const c1 = evalJson(MEASURE);
const c2 = evalJson(MEASURE);
ok("A1 canvas rides bit-identical", JSON.stringify(c1) === JSON.stringify(c2), `btns=${c1.pageBtns}`);
ok("A2 canvas floor holds (census 142)", c1.pageBtns >= 142 && c1.pageUnnamed === 0, `live=${c1.pageBtns} unnamed=${c1.pageUnnamed}`);

/* ---------- Face I: the job inspector ---------- */
console.log("Face I — the job inspector (dashboard → saved-view card)");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { const t = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === "Dashboard"); if (t) t.click(); return "dash"; })()');
sleep(2);
let card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
if (!card.found) {
  sleep(3);
  card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
}
ok("A3 the saved-view card found and clicked", card.found === true, "the door the census reached by accident, taken deliberately");
sleep(2);
const i1 = evalJson(MEASURE);
const i2 = evalJson(MEASURE);
ok("A4 the inspector arrived: dialog + labelledby + tenant heading",
  i1.hasDlg && i1.dlgHeading && i1.dlgHeading.startsWith("3D auto-refine — job inspector"),
  `heading="${i1.dlgHeading}"`);
ok("A5 the inspector's focus is trapped in the dialog", i1.dlgFocus === true);
ok("A6 inspector rides bit-identical", JSON.stringify(i1) === JSON.stringify(i2), `page=${i1.pageBtns} dlg=${i1.dlgBtns}`);
ok("A7 inspector zero unnamed (page-wide)", i1.pageUnnamed === 0, `unnamed=${i1.pageUnnamed}${i1.pageUnnamed ? " who=" + i1.unWho.join("|") : ""}`);
ok("A8 inspector dialog subset clean", i1.dlgUnnamed === 0, `dlg=${i1.dlgBtns} unnamed=${i1.dlgUnnamed}`);
ok("A9 inspector floor holds (census 180)", i1.pageBtns >= 180, `live=${i1.pageBtns} (census 180, drift +${i1.pageBtns - 180})`);
evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1);
const i3 = evalJson(MEASURE);
ok("A10 Escape closed the inspector", i3.hasDlg === false, `dlg=${i3.hasDlg}`);

/* ---------- Face P: the ⌘K palette ---------- */
console.log("Face P — the ⌘K palette (the t483 contract door)");
evalJson('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "door"; })()');
sleep(1);
const p1 = evalJson(MEASURE);
const p2 = evalJson(MEASURE);
ok("A11 the palette arrived: dialog + cmdk input", p1.hasDlg && p1.ip && !!p1.ip.ph, `placeholder="${p1.ip ? p1.ip.ph : "?"}"`);
ok("A12 palette rides bit-identical", JSON.stringify(p1) === JSON.stringify(p2), `page=${p1.pageBtns}`);
ok("A13 palette zero unnamed (page-wide)", p1.pageUnnamed === 0, `unnamed=${p1.pageUnnamed}`);
ok("A14 the input's name rides the placeholder (observation #2 holds)",
  p1.ip && p1.ip.ph === "Jump to a job, add a type, run an action…" && !p1.ip.aria,
  `aria=${p1.ip ? p1.ip.aria : "?"} (the labelledby target is an empty Radix styling label — recorded, not fixed)`);
ok("A15 palette floor holds (census 150)", p1.pageBtns >= 150, `live=${p1.pageBtns} (census 150, drift +${p1.pageBtns - 150})`);

/* ---------- restore ---------- */
console.log("Restore — Escape, then a fresh canvas");
evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1);
ab("open http://localhost:3000");
sleep(3);
const r1 = evalJson(MEASURE);
ok("A16 world unharmed (canvas back, no dialog, floors hold)",
  !r1.hasDlg && r1.pageBtns === c1.pageBtns && r1.pageUnnamed === 0,
  `btns=${r1.pageBtns} dlg=${r1.hasDlg}`);

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the fragile pair walked clean with the method artifact's discipline: the inspector's tenant heading, trapped focus, ${i1.pageBtns} page-wide buttons zero unnamed (census 180, +${i1.pageBtns - 180} newcomers all named), the palette's contract door, ${p1.pageBtns} zero unnamed (census 150, +${p1.pageBtns - 150}), the input's placeholder name recorded as the census's observation #2 — the census's four faces are now ALL re-witnessed this cycle`
  : `${fail} red — reconcile the a11y layer before any further UI work`;
const receipt = {
  instrument: "scripts/t844-a11y-fragile-pair.mjs",
  build: buildId,
  date: new Date().toISOString(),
  doors: {
    inspector: "dashboard → saved-view card (textContent startsWith 'Centered iso view')",
    palette: "window.dispatchEvent(new Event('cryoflow:open-palette')) — the t483 contract door",
  },
  faces: {
    inspector: { census: { pageBtns: 180, unnamed: 0 }, live: [i1, i2], afterEscape: i3 },
    palette: { census: { pageBtns: 150, unnamed: 0, input: 1 }, live: [p1, p2] },
    baseline: { census: { pageBtns: 142, unnamed: 0 }, live: [c1, c2] },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
};
writeFileSync("shots-qa/t844-a11y-fragile-pair.json", JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nA11Y-FRAGILE-PAIR t844: ${pass}/${pass + fail}${fail ? " RED" : " green"}`);
process.exit(fail ? 1 : 0);

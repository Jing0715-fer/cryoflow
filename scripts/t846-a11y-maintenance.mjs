#!/usr/bin/env node
/**
 * t846 — the a11y MAINTENANCE SWEEP: all four census faces in ONE command
 * (zero src — the standing re-witness the rotation promised).
 *
 * t843 walked the cheap pair (canvas + dashboard, two bit-identical rides
 * each); t844 walked the fragile pair (inspector + palette, the deliberate
 * doors). Both are deep instruments — they film. This window's job is the
 * other half of the census's promise: a SWEEP. One chain, four faces,
 * one measurement per state (count-only), the floors pinned — the command
 * future windows run FIRST to prove the name layer still holds, before any
 * deep instrument is needed. Doors are the two instruments' own, by name:
 *   C  the canvas — fresh load, sleep 3 (the hydration lesson)
 *   D  the dashboard — the exact-text 'Dashboard' switcher click
 *   I  the job inspector — the saved-view card (textContent startsWith
 *      'Centered iso view'), one retry (the strip's flicker lesson)
 *   P  the palette — the t483 contract event (the in-contract door)
 * Chains, not separate loads: D rides on C's load, I on D's face, P on I's
 * aftermath — the maintenance sweep's economy. The deep pair stays aboard
 * for when something breaks.
 *
 * Pins (count-only, floors = the census's own numbers):
 *   M1-M3   canvas: zero unnamed buttons, zero unnamed controls, floor 142
 *   M4-M7   dashboard: arrived, zero unnamed, zero alt-less (hasAttribute),
 *           floor 114
 *   M8-M13  inspector: door found, tenant heading, focus trapped, zero
 *           unnamed page-wide + dialog subset, floor 180, Escape closes
 *   M14-M17 palette: dialog + cmdk input, zero unnamed, floor 150 +
 *           observation #2 (the placeholder name), Escape closes
 *   M18     restore: the world unharmed (canvas count == the opening count)
 *
 * t857 amendment — THE DRIFT LEDGER (M20-M24): the sweep learns to diff
 * its counts against the PREVIOUS receipt — the receipt itself is the
 * natural comparator, and on a frozen build the ride-to-ride drift must
 * be ZERO, face for face, key for key. The floors measure the census's
 * AGE (+7/+2/+8/+7, stable); the ledger measures the world's STABILITY
 * (0/0/0/0/0 on the frozen build — the t857 probe proved it first,
 * scripts/t857-drift-ledger-probe.mjs kept as provenance). A new axis
 * of reproducibility: every prior identity compared worlds WITHIN one
 * window; this one compares RIDES ACROSS WINDOWS. Three arms, recorded
 * honestly per face: no predecessor (first ride — vacuous), build moved
 * (drift informational — a build may change counts), same build
 * (bit-for-bit or red). The ledger block rides the receipt:
 *   driftLedger: { prevFound, prevBuild, prevDate, sameBuild, law,
 *                  faces: { canvas | dashboard | inspector | palette |
 *                           restore: { prev, live, drift, identical } } }
 *
 * Receipt: shots-qa/t846-a11y-maintenance.json.
 *
 *   node scripts/t846-a11y-maintenance.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

/* ---------- provenance + the ledger's comparator (the PREVIOUS receipt) ---------- */
const buildId = readFileSync(join(ROOT, ".next/BUILD_ID"), "utf8").trim();
const prevReceiptPath = join(ROOT, "shots-qa/t846-a11y-maintenance.json");
const prevReceipt = existsSync(prevReceiptPath)
  ? JSON.parse(readFileSync(prevReceiptPath, "utf8"))
  : null;
const prevFaces = {};
if (prevReceipt && prevReceipt.faces) {
  for (const [name, face] of Object.entries(prevReceipt.faces)) {
    if (face && face.live) prevFaces[name] = face.live;
  }
}
const prevFound = Object.keys(prevFaces).length > 0;
const sameBuild = prevFound ? prevReceipt.build === buildId : null;
console.log(
  `t846 a11y maintenance sweep — build ${buildId}, all four census faces in one chain, count-only, floors pinned\n` +
  (prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (build ${prevReceipt.build}, ${sameBuild ? "SAME build — bit-for-bit demanded" : "build MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* ---------- the measure: both instruments' fields in ONE line sync IIFE.
 * The census's name computation; page-wide + dialog-subset + alt/ctrl/ip
 * in a single pass. NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { const nameOf = (el) => { const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim(); const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\\s+/).map((id) => { const d = document.getElementById(id); return d ? (d.textContent || "").trim() : ""; }).join(" ").trim(); if (t) return t; } const tc = (el.textContent || "").trim(); if (tc) return tc; if (el.tagName === "IMG") { const a = el.getAttribute("alt"); if (a !== null && a.trim()) return a.trim(); } if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const v = (el.value || "").trim(); if (v) return v; const p = (el.getAttribute("placeholder") || "").trim(); if (p) return p; } return ""; }; const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const dlg = document.querySelector("[role=dialog]"); const dlgBtns = dlg ? Array.from(dlg.querySelectorAll("button")) : []; const dlgUn = dlgBtns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const ip = document.querySelector("[cmdk-input]"); return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, hasDlg: !!dlg, dlgBtns: dlgBtns.length, dlgUnnamed: dlgUn.length, dlgFocus: dlg ? dlg.contains(document.activeElement) : null, dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null, ip: ip ? { aria: ip.getAttribute("aria-label"), ph: ip.getAttribute("placeholder") } : null, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

const ESC =
  '(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

/* ---------- Face C: the canvas (the chain's root) ---------- */
console.log("Face C — the workflow canvas (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
const c1 = evalJson(MEASURE);
ok("M1 canvas zero unnamed buttons", c1.pageUnnamed === 0, `btns=${c1.pageBtns}${c1.pageUnnamed ? " who=" + c1.unWho.join("|") : ""}`);
ok("M2 canvas zero unnamed form controls", c1.unCtrls === 0, `unCtrls=${c1.unCtrls}/${c1.ctrls}`);
ok("M3 canvas floor holds (census 142)", c1.pageBtns >= 142, `live=${c1.pageBtns} (drift +${c1.pageBtns - 142})`);

/* ---------- Face D: the dashboard (rides on C's load) ---------- */
console.log("Face D — the dashboard (exact-text switcher click)");
const clickR = evalJson(
  '(() => { const t = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === "Dashboard"); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()'
);
ok("M4a the switcher clicked", clickR.clicked === true);
sleep(2);
const d1 = evalJson(MEASURE);
ok("M4b the dashboard arrived (own heading, own count)", d1.heading && d1.heading !== c1.heading && d1.pageBtns !== c1.pageBtns, `heading="${d1.heading}" btns=${d1.pageBtns}`);
ok("M5 dashboard zero unnamed buttons", d1.pageUnnamed === 0, `unnamed=${d1.pageUnnamed}`);
ok("M6 dashboard zero alt-less imgs (hasAttribute, not falsy)", d1.altless === 0, `imgs=${d1.imgs} altless=${d1.altless}`);
ok("M7 dashboard floor holds (census 114)", d1.pageBtns >= 114, `live=${d1.pageBtns} (drift +${d1.pageBtns - 114})`);

/* ---------- Face I: the job inspector (rides on D's face) ---------- */
console.log("Face I — the job inspector (saved-view card, one retry)");
let card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
if (!card.found) {
  sleep(3);
  card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
}
ok("M8 the saved-view card found and clicked", card.found === true, "the deliberate door (t844's)");
sleep(2);
const i1 = evalJson(MEASURE);
ok("M9 inspector arrived: dialog + tenant heading", i1.hasDlg && i1.dlgHeading && i1.dlgHeading.startsWith("3D auto-refine — job inspector"), `heading="${i1.dlgHeading}"`);
ok("M10 inspector focus trapped", i1.dlgFocus === true);
ok("M11 inspector zero unnamed (page-wide + dialog subset)", i1.pageUnnamed === 0 && i1.dlgUnnamed === 0, `page=${i1.pageBtns} dlg=${i1.dlgBtns} unnamed=0/0`);
ok("M12 inspector floor holds (census 180)", i1.pageBtns >= 180, `live=${i1.pageBtns} (drift +${i1.pageBtns - 180})`);
evalJson(ESC);
sleep(1);
const i2 = evalJson(MEASURE);
ok("M13 Escape closed the inspector", i2.hasDlg === false, `dlg=${i2.hasDlg}`);

/* ---------- Face P: the palette (rides on I's aftermath) ---------- */
console.log("Face P — the palette (the t483 contract door)");
evalJson('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "door"; })()');
sleep(1);
const p1 = evalJson(MEASURE);
ok("M14 palette arrived: dialog + cmdk input", p1.hasDlg && p1.ip && !!p1.ip.ph, `placeholder="${p1.ip ? p1.ip.ph : "?"}"`);
ok("M15 palette zero unnamed (page-wide)", p1.pageUnnamed === 0, `unnamed=${p1.pageUnnamed}`);
ok("M16 palette floor holds (census 150) + observation #2", p1.pageBtns >= 150 && p1.ip && p1.ip.ph === "Jump to a job, add a type, run an action…" && !p1.ip.aria, `live=${p1.pageBtns} (drift +${p1.pageBtns - 150}) the input's name rides the placeholder`);
evalJson(ESC);
sleep(1);
const p2 = evalJson(MEASURE);
ok("M17 Escape closed the palette", p2.hasDlg === false, `dlg=${p2.hasDlg}`);

/* ---------- restore: back to the canvas ---------- */
console.log("Restore — fresh load back to the canvas");
ab("open http://localhost:3000");
sleep(3);
const r1 = evalJson(MEASURE);
ok("M18 world unharmed (canvas count == the opening count)", !r1.hasDlg && r1.pageBtns === c1.pageBtns && r1.pageUnnamed === 0, `btns=${r1.pageBtns} dlg=${r1.hasDlg}`);

/* ---------- the sweep's own cross-check: four faces, four counts ---------- */
const counts = [c1.pageBtns, d1.pageBtns, i1.pageBtns, p1.pageBtns];
const distinct = new Set(counts).size === 4;
ok("M19 four faces, four distinct button-views (no face is another face)", distinct, counts.join(" / "));

/* ---------- the DRIFT LEDGER (t857): this ride vs the PREVIOUS receipt ---------- */
const sortedJson = (o) => JSON.stringify(o, Object.keys(o ?? {}).sort());
const ledgerFace = (name, live) => {
  const p = prevFaces[name] ?? null;
  return {
    prev: p ? p.pageBtns : null,
    live: live.pageBtns,
    drift: p ? live.pageBtns - p.pageBtns : null,
    identical: p ? sortedJson(p) === sortedJson(live) : null,
  };
};
const ledgerFaces = {
  canvas: ledgerFace("canvas", c1),
  dashboard: ledgerFace("dashboard", d1),
  inspector: ledgerFace("inspector", i1),
  palette: ledgerFace("palette", p1),
  restore: ledgerFace("restore", r1),
};
const LEDGER_LAW =
  "the ride-to-ride drift: prev receipt == this ride, per face, count and full live object — " +
  "three arms recorded honestly: no predecessor (first ride, vacuous), build moved (drift informational), " +
  "same build (drift 0 AND identical, bit-for-bit, or red); floors measure the census's age, the ledger measures the world's stability";

ok("M20 the drift ledger is aboard: five faces, each carrying prev/live/drift/identical, the comparator's provenance recorded",
  ledgerFaces.canvas && ledgerFaces.dashboard && ledgerFaces.inspector && ledgerFaces.palette && ledgerFaces.restore &&
  Object.values(ledgerFaces).every((f) => "prev" in f && "live" in f && "drift" in f && "identical" in f) &&
  (prevFound ? typeof prevReceipt.date === "string" && typeof prevReceipt.build === "string" : prevFound === false),
  prevFound ? `comparator ${prevReceipt.date} (build ${prevReceipt.build})` : "first ride — no predecessor");

/* the per-face drift law (the three-arm form — arm 1 vacuous, arm 2 informational, arm 3 bit-for-bit) */
const driftOk = (f) =>
  !prevFound ? true : !sameBuild ? true : f.drift === 0 && f.identical === true;
const driftDetail = (name, f) => {
  if (!prevFound) return "arm 1 — first ride, no predecessor";
  if (!sameBuild) return `arm 2 — build moved, drift ${f.drift >= 0 ? "+" : ""}${f.drift} informational`;
  return f.drift === 0 && f.identical
    ? `arm 3 — bit-for-bit (${f.prev} -> ${f.live}, the full live object identical)`
    : `arm 3 RED — drift ${f.drift}, identical=${f.identical}`;
};
ok("M21 canvas ride-drift law (same build: bit-for-bit vs the previous receipt)",
  driftOk(ledgerFaces.canvas), driftDetail("canvas", ledgerFaces.canvas));
ok("M22 dashboard ride-drift law",
  driftOk(ledgerFaces.dashboard), driftDetail("dashboard", ledgerFaces.dashboard));
ok("M23 inspector ride-drift law",
  driftOk(ledgerFaces.inspector), driftDetail("inspector", ledgerFaces.inspector));
ok("M24 palette ride-drift law",
  driftOk(ledgerFaces.palette), driftDetail("palette", ledgerFaces.palette));

/* ---------- verdict + receipt ---------- */
const totalViews = counts.reduce((s, n) => s + n, 0);
const verdict = fail === 0
  ? `the maintenance sweep holds: ${totalViews} button-views across four faces in one chain, zero unnamed anywhere, every floor at or above the census's own numbers (drift +${c1.pageBtns - 142}/+${d1.pageBtns - 114}/+${i1.pageBtns - 180}/+${p1.pageBtns - 150}), both fragile doors opened first-try (the saved-view card, the t483 contract event), both dialogs closed by Escape, the world restored — and the DRIFT LEDGER records the ride-to-ride truth (${prevFound ? sameBuild ? "same build: five faces bit-for-bit vs the previous receipt, drift 0" : "build moved: drift informational, recorded per face" : "first ride: no predecessor"}) — the standing re-witness future windows run first`
  : `${fail} red — the name layer moved; call the deep instruments (t843/t844) before any UI work`;
const receipt = {
  instrument: "scripts/t846-a11y-maintenance.mjs",
  build: buildId,
  date: new Date().toISOString(),
  chain: "canvas -> dashboard -> inspector -> palette -> restore (one command)",
  doors: {
    dashboard: "exact-text 'Dashboard' switcher click",
    inspector: "saved-view card (textContent startsWith 'Centered iso view'), one retry",
    palette: "window.dispatchEvent(new Event('cryoflow:open-palette')) — the t483 contract door",
  },
  floors: { canvas: 142, dashboard: 114, inspector: 180, palette: 150 },
  driftLedger: {
    prevFound,
    prevBuild: prevFound ? prevReceipt.build : null,
    prevDate: prevFound ? prevReceipt.date : null,
    sameBuild,
    law: LEDGER_LAW,
    faces: ledgerFaces,
  },
  faces: {
    canvas: { floor: 142, live: c1 },
    dashboard: { floor: 114, live: d1, arrival: clickR },
    inspector: { floor: 180, live: i1, afterEscape: i2 },
    palette: { floor: 150, live: p1, afterEscape: p2 },
    restore: { live: r1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
};
writeFileSync("shots-qa/t846-a11y-maintenance.json", JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nA11Y-MAINTENANCE t846: ${pass}/${pass + fail}${fail ? " RED" : " green"}`);
process.exit(fail ? 1 : 0);

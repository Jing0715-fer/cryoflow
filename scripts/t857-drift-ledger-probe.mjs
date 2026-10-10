#!/usr/bin/env node
/**
 * t857 — the drift ledger PROBE (kept as provenance): the maintenance
 * sweep's counts diffed against the PREVIOUS receipt, ride-to-ride.
 *
 * The t856 tail's candidate, measured before the instrument grows: the
 * maintenance sweep (t846) has always diffed its counts against the
 * CENSUS floors (canvas >= 142 ...) — a floor measures the census's AGE
 * (+7/+2/+8/+7 and stable). It has never diffed against the ride that
 * came before — the receipt ITSELF is the natural comparator, and on a
 * frozen build the drift must be ZERO, face for face, key for key.
 *
 * This probe runs the SAME chain as t846 (canvas -> dashboard ->
 * inspector -> palette -> restore, same MEASURE IIFE, same doors),
 * reads the previous receipt FIRST, and diffs per face:
 *   - pageBtns drift (the ledger's headline number);
 *   - FULL live-object identity (key-sorted JSON — every key the
 *     measure films, not just the count);
 * and demands, on the same build: drift 0 && identical, all five faces.
 * Three arms recorded honestly: no predecessor (first ride — vacuous),
 * build moved (drift informational, a build may change counts), same
 * build (bit-for-bit or red).
 *
 * A new axis of reproducibility: every prior identity (cross-load,
 * cross-instrument, cross-receipt) compared worlds WITHIN one window's
 * rides; this one compares RIDES ACROSS WINDOWS — the previous window's
 * receipt is the comparator. The instrument (t846) grows the ledger
 * after this probe proves the law holds.
 *
 *   node scripts/t857-drift-ledger-probe.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const RECEIPT = join(ROOT, "shots-qa/t846-a11y-maintenance.json");

/* ---------- the comparator: the PREVIOUS receipt ---------- */
if (!existsSync(RECEIPT)) {
  console.error("no previous receipt — the ledger's first ride cannot diff (run t846 once first)");
  process.exit(2);
}
const prev = JSON.parse(readFileSync(RECEIPT, "utf8"));
const prevBuild = prev.build;
const prevDate = prev.date;
const prevFaces = {};
for (const [name, face] of Object.entries(prev.faces ?? {})) {
  if (face && face.live) prevFaces[name] = face.live;
}
const prevNames = Object.keys(prevFaces);
console.log(`comparator: the receipt of ${prevDate} (build ${prevBuild}), faces: ${prevNames.join(", ")}\n`);

const sameBuild = prevBuild === readFileSync(join(ROOT, ".next/BUILD_ID"), "utf8").trim();

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);
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

/* the same MEASURE the sweep rides (verbatim shape — t846's own line) */
const MEASURE =
  '(() => { const nameOf = (el) => { const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim(); const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\\s+/).map((id) => { const d = document.getElementById(id); return d ? (d.textContent || "").trim() : ""; }).join(" ").trim(); if (t) return t; } const tc = (el.textContent || "").trim(); if (tc) return tc; if (el.tagName === "IMG") { const a = el.getAttribute("alt"); if (a !== null && a.trim()) return a.trim(); } if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const v = (el.value || "").trim(); if (v) return v; const p = (el.getAttribute("placeholder") || "").trim(); if (p) return p; } return ""; }; const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const dlg = document.querySelector("[role=dialog]"); const dlgBtns = dlg ? Array.from(dlg.querySelectorAll("button")) : []; const dlgUn = dlgBtns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const ip = document.querySelector("[cmdk-input]"); return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, hasDlg: !!dlg, dlgBtns: dlgBtns.length, dlgUnnamed: dlgUn.length, dlgFocus: dlg ? dlg.contains(document.activeElement) : null, dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null, ip: ip ? { aria: ip.getAttribute("aria-label"), ph: ip.getAttribute("placeholder") } : null, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

const ESC =
  '(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

const sorted = (o) => JSON.stringify(o, Object.keys(o ?? {}).sort());

/* ---------- the chain: identical doors, one ride ---------- */
console.log("Face C — the canvas (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
const c1 = evalJson(MEASURE);

console.log("Face D — the dashboard (exact-text switcher click)");
const clickR = evalJson(
  '(() => { const t = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === "Dashboard"); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()'
);
sleep(2);
const d1 = evalJson(MEASURE);

console.log("Face I — the job inspector (saved-view card, one retry)");
let card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
if (!card.found) {
  sleep(3);
  card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
}
sleep(2);
const i1 = evalJson(MEASURE);
evalJson(ESC);
sleep(1);

console.log("Face P — the palette (the t483 contract door)");
evalJson('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "door"; })()');
sleep(1);
const p1 = evalJson(MEASURE);
evalJson(ESC);
sleep(1);

console.log("Restore — fresh load back to the canvas");
ab("open http://localhost:3000");
sleep(3);
const r1 = evalJson(MEASURE);

/* ---------- the diff: per face, count + full identity ---------- */
const ride = { canvas: c1, dashboard: d1, inspector: i1, palette: p1, restore: r1 };
let red = 0;
console.log(`\nsameBuild: ${sameBuild} (disk ${sameBuild ? "==" : "!="} comparator)`);
for (const [name, live] of Object.entries(ride)) {
  const p = prevFaces[name];
  if (!p) {
    console.log(`  ${name}: NO PREDECESSOR in the previous receipt (arm 1 — vacuous)`);
    continue;
  }
  const drift = live.pageBtns - p.pageBtns;
  const identical = sorted(live) === sorted(p);
  const verdictArm = !sameBuild
    ? "arm 2 — build moved, drift informational"
    : drift === 0 && identical
      ? "arm 3 — bit-for-bit"
      : "arm 3 RED";
  if (sameBuild && (drift !== 0 || !identical)) red++;
  const firstDiff = identical ? "" : "  firstDiff: " + firstKeyDiff(p, live);
  console.log(`  ${name}: pageBtns ${p.pageBtns} -> ${live.pageBtns} (drift ${drift >= 0 ? "+" : ""}${drift}), identical=${identical}  [${verdictArm}]${firstDiff}`);
}

function firstKeyDiff(a, b) {
  const keys = Array.from(new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])).sort();
  for (const k of keys) {
    if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) return `${k}: ${JSON.stringify(a?.[k])} vs ${JSON.stringify(b?.[k])}`;
  }
  return "(none)";
}

console.log(`\nDRIFT-PROBE t857: ${red === 0 ? "the cross-RIDE identity holds on the frozen build" : red + " face(s) moved ride-to-ride"}`);
process.exit(red ? 1 : 0);

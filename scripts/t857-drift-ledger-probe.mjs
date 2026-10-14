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
 *
 * t864: the probe's MEASURE rides the SHARED RULER (scripts/shared-ruler.mjs)
 * — the inline name computation retired onto the one implementation. */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";
import { worldIdentity } from "./world-identity.mjs";
import { armVerdict } from "./drift-ledger.mjs";

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

const sameBuild = prevBuild === worldIdentity(ROOT).id;

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
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const dlg = document.querySelector("[role=dialog]"); const dlgBtns = dlg ? Array.from(dlg.querySelectorAll("button")) : []; const dlgUn = dlgBtns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const ip = document.querySelector("[cmdk-input]"); return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, hasDlg: !!dlg, dlgBtns: dlgBtns.length, dlgUnnamed: dlgUn.length, dlgFocus: dlg ? dlg.contains(document.activeElement) : null, dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null, ip: ip ? { aria: ip.getAttribute("aria-label"), ph: ip.getAttribute("placeholder") } : null, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

const ESC =
  '(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

const sorted = (o) => JSON.stringify(o, Object.keys(o ?? {}).sort());

/* t869 — the settled lens (the t864 false-settle lesson, finally wearing
 * t857's own clothes): the probe filmed every face after a RAW sleep and
 * the inspector face's film read 283/282 while the gate's deep-settled
 * lens read 289 — the discriminator (t869-inspector-settle-diff) settled
 * TWICE at 145 dlg buttons bit-for-bit, so the decay was the MOUNT
 * SCHEDULE, not the world. The probe is the gate's mini-me: its lens now
 * mirrors the gate's per face — C settled(16,2), D raw (the gate's D is
 * raw too), I deep(24,3), P settled(16,2), R settled(16,2). A ledger that
 * films mid-mount records mount noise as drift; the settled lens records
 * the world. */
const settle = (what, maxIter = 16, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxIter; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    /* t869 — the arrival guard (see t846's settle): a stable blank is
     * not a settled world; an empty page keeps the settle waiting. */
    const alive = next.pageBtns > 0;
    const same = alive && JSON.stringify(next) === JSON.stringify(m);
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need) break;
  }
  console.log(`  settled ${what} (${need}x stable)`);
  return m;
};

/* ---------- the chain: identical doors, one ride ---------- */
console.log("Face C — the canvas (fresh load, sleep 3, settled — the t869 lens cure)");
ab("open http://localhost:3000");
sleep(3);
const c1 = settle("the canvas");

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
const i1 = settle("the inspector (the analytics surfaces mount late — t860's probe)", 24, 3);
evalJson(ESC);
sleep(1);

console.log("Face P — the palette (the t483 contract door)");
evalJson('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "door"; })()');
sleep(1);
const p1 = settle("the palette");
evalJson(ESC);
sleep(1);

console.log("Restore — fresh load back to the canvas (settled — the same lens cure)");
ab("open http://localhost:3000");
sleep(3);
const r1 = settle("the restored canvas");

/* ---------- the diff: per face, count + full identity ----------
 * t864: the verdict is the FAMILY's shared law (drift-ledger.mjs armVerdict,
 * the t859 jurisdiction clause): bit-for-bit demanded ONLY from a frozen
 * build-mode key — a same dev@ key rides arm 2′ informational (the world is
 * unfrozen; the inspector's class-snapshot imgs arrive with data, the t860
 * probe's own filmed mechanism). The pre-clause inline arm-3-on-dev verdict
 * is retired here, the last of its generation (t862 retired t846's). */
const ride = { canvas: c1, dashboard: d1, inspector: i1, palette: p1, restore: r1 };
const world = worldIdentity(ROOT);
const cmp = { prevFound: true, sameBuild, prevBuild };
let red = 0;
console.log(`\nsameBuild: ${sameBuild} (disk ${sameBuild ? "==" : "!="} comparator), world mode ${world.mode}`);
for (const [name, live] of Object.entries(ride)) {
  const p = prevFaces[name];
  if (!p) {
    console.log(`  ${name}: NO PREDECESSOR in the previous receipt (arm 1 — vacuous)`);
    continue;
  }
  const drift = live.pageBtns - p.pageBtns;
  const identical = sorted(live) === sorted(p);
  const verdict = armVerdict(cmp, world, { drift, identical });
  if (verdict.bites && !verdict.ok) red++;
  const firstDiff = identical ? "" : "  firstDiff: " + firstKeyDiff(p, live);
  console.log(`  ${name}: pageBtns ${p.pageBtns} -> ${live.pageBtns} (drift ${drift >= 0 ? "+" : ""}${drift}), identical=${identical}  [${verdict.detail}]${firstDiff}`);
}

function firstKeyDiff(a, b) {
  const keys = Array.from(new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])).sort();
  for (const k of keys) {
    if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) return `${k}: ${JSON.stringify(a?.[k])} vs ${JSON.stringify(b?.[k])}`;
  }
  return "(none)";
}

console.log(`\nDRIFT-PROBE t857: ${red === 0 ? "the cross-RIDE identity holds (the family's shared law — arm 3 bites on frozen keys only)" : red + " face(s) violated the shared drift law"}`);
process.exit(red ? 1 : 0);

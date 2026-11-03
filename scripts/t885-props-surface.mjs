#!/usr/bin/env node
/* t885 — THE WRAP-ZERO SURFACE QUESTION (t884's first guidance item).
 *
 * The mystery t884 left: the fsc dialog's own onKeyDown handler demonstrably
 * RUNS (the spy's stack caught its compiled line), yet all 201 document-wide
 * mirror wraps + 19 fiber wraps counted ZERO calls while it ran. React's
 * getListener reads `stateNode[internalPropsKey]` (the mirror) — so the
 * dispatched listener SHOULD have come from a wrapped object.
 *
 * THE STALENESS HYPOTHESIS (this ride's bet): React REPLACES the mirror
 * (`domElement[internalPropsKey] = newProps`) on every commit that carries
 * new props — Radix Slot's mergeProps mints a fresh object each render, and
 * the fsc dialog commits after its chart fetch resolves. A wrap applied to
 * the mirror at time T is ORPHANED at the next commit; the dispatch reads
 * the fresh (unwrapped) object. Zero counters = instrument artifact, not
 * exotic dispatch surfaces.
 *
 * THE INSTRUMENT — a trap that survives replacement:
 *   trapA: defineProperty ACCESSOR for the `__reactProps$xxx` KEY on the fsc
 *          root element itself. getFiberCurrentPropsFromNode reads the key
 *          (GETTER -> mirrorReads++); React's updateFiberProps ASSIGNS it
 *          (SETTER -> sets++, and every incoming object gets wrapped).
 *   trapB: on each props object, an accessor for `onKeyDown` (keyReads++ on
 *          every read; returns a counting wrapper — calls++, first call's
 *          stack captured). If the props object is frozen, fall back to a
 *          value-wrap; if that is blocked too, freezeBlocked counts and the
 *          element-level mirrorReads still answers the surface question.
 *   census: every element's `__reactProps$` / `__reactFiber$` suffix — the
 *          distinct-suffix count is the second-React-copy check.
 *
 * Sequence: census BEFORE arm (the census's own reads must not hit trapA),
 * arm, settle 1s (sets-so-far = commits since arm — the staleness smoking
 * gun), fire ONE Escape at the t881 target, poll the peel, read counters,
 * restore the world fresh.
 *
 * Receipt: shots-qa/t885-props-surface.json.
 *
 *   node scripts/t885-props-surface.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const results = [];

const ok = (label, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`); }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch { /* a plain string */ }
  }
  return out;
};
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));

const FSC_PROBE =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const titleOf = (d) => ((d.querySelector("[data-slot=dialog-title]") || d.querySelector("h1,h2") || {}).textContent || "").trim(); const fsc = dgs.find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); return JSON.stringify({ dlgCount: dgs.length, dlgHeads: dgs.map(titleOf).map((t) => t.slice(0, 40)), fscOpen: !!fsc }); })()';

console.log("t885 — the wrap-zero surface question: a replacement-proof trap on the mirror key itself\n");

/* ---- the t881 door: fresh load -> workflow canvas -> 3D Refine card ->
 * inspector -> Results tab -> the fsc-compare door -> the two-dialog world */
ab(`open ${BASE}/?t=${Date.now()}`);
let m0 = evalJson(FSC_PROBE);
for (let i = 0; i < 60 && m0.dlgCount !== 0; i++) { zzz(1); m0 = evalJson(FSC_PROBE); }
const pageBtns0 = evalJson('(() => JSON.stringify({ n: document.querySelectorAll("button, [role=button]").length }))()').n;
ok("C1 the world dressed bare", pageBtns0 >= 100 && m0.dlgCount === 0, `pageBtns=${pageBtns0} dlgs=${m0.dlgCount}`);

const wf = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (wf.found && wf.clicked) zzz(2);
let cards = 0;
for (let i = 0; i < 20; i++) {
  cards = evalJson('(() => JSON.stringify({ c: document.querySelectorAll("div[role=button][aria-label]").length }))()').c;
  if (cards >= 10) break;
  zzz(1);
}
ok("C2 the workflow canvas holds the cards", cards >= 10, `cards=${cards}`);

const openHost = evalJson(`(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("3D Refine") !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()`);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson(FSC_PROBE);
  if (insp.dlgHeads.some((h) => h.startsWith("3D Refine"))) break;
}
ok("C3 the inspector arrived", insp && insp.dlgHeads.some((h) => h.startsWith("3D Refine")), `heads=[${(insp?.dlgHeads ?? []).join(" | ")}]`);

const resTab = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=dialog] [role=tab]")).find((x) => (x.textContent || "").indexOf("Results") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (resTab.found && resTab.clicked) zzz(3);
let doorOk = false;
for (let i = 0; i < 15; i++) {
  doorOk = evalJson('(() => JSON.stringify({ d: !!document.querySelector("[data-testid=fsc-compare-open]") }))()').d;
  if (doorOk) break;
  zzz(1);
}
ok("C4 the fsc door mounted", doorOk === true, `tab=${JSON.stringify(resTab)}`);
const door = evalJson(`(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()`);
let fsc = null;
for (let i = 0; i < 20; i++) {
  zzz(1);
  fsc = evalJson(FSC_PROBE);
  if (fsc.fscOpen === true && fsc.dlgCount === 2) break;
}
ok("C5 the fsc dialog floats over the inspector", fsc && fsc.fscOpen === true && fsc.dlgCount === 2, `dlgs=${fsc?.dlgCount}`);

/* ---- C6 THE CENSUS (before the arm — its reads must not hit trapA):
 * distinct `__reactProps$` / `__reactFiber$` suffixes document-wide; one
 * distinct suffix = one react-dom copy. */
const census = evalJson('(() => { const pkS = new Set(); const fkS = new Set(); let carriers = 0; document.querySelectorAll("*").forEach((el) => { Object.keys(el).forEach((k) => { if (k.indexOf("__reactProps$") === 0) { pkS.add(k.slice(14)); if (el[k] && typeof el[k].onKeyDown === "function") carriers++; } else if (k.indexOf("__reactFiber$") === 0) { fkS.add(k.slice(14)); } }); }); return JSON.stringify({ els: document.querySelectorAll("*").length, pkSuffixes: Array.from(pkS), fkSuffixes: Array.from(fkS), carriers: carriers }); })()');
console.log(`\n  census: els=${census.els} props-suffixes=[${census.pkSuffixes.join(", ")}] fiber-suffixes=[${census.fkSuffixes.join(", ")}] onKeyDown-carriers=${census.carriers}`);
ok("C6 one react-dom copy owns the document (single mirror-suffix family)", census.pkSuffixes.length === 1 && census.fkSuffixes.length === 1, `pk=${census.pkSuffixes.length} fk=${census.fkSuffixes.length}`);

/* ---- THE ARM (one eval, replacement-proof):
 * trapA on the fsc ROOT element's mirror KEY (getter/setter);
 * trapB on each incoming props object's onKeyDown (read counter + counting wrapper). */
const ARM =
  '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); if (!fsc) return JSON.stringify({ armed: false, why: "no fsc dialog" }); window.__t885 = { sets: 0, mirrorReads: 0, keyReads: 0, calls: 0, freezeBlocked: 0, stack: null }; const T = window.__t885; const wrap = (obj) => { try { if (!obj || typeof obj.onKeyDown !== "function" || obj.__t885w) return; obj.__t885w = true; const orig = obj.onKeyDown; const counting = function (e) { T.calls++; if (!T.stack) { T.stack = (new Error().stack || "").split("\\n").slice(1, 7).join(" << ").slice(0, 700); } return orig.call(this, e); }; try { delete obj.onKeyDown; Object.defineProperty(obj, "onKeyDown", { configurable: true, enumerable: true, get: function () { T.keyReads++; return counting; }, set: function (v) { return v; } }); obj.__t885acc = true; } catch (e2) { obj.onKeyDown = counting; obj.__t885acc = false; } } catch (err) { T.freezeBlocked++; } }; const pk = Object.keys(fsc).find((k) => k.indexOf("__reactProps$") === 0); if (!pk) return JSON.stringify({ armed: false, why: "no mirror key on fsc root" }); const fk = Object.keys(fsc).find((k) => k.indexOf("__reactFiber$") === 0); let stored = fsc[pk]; const frozen = Object.isFrozen(stored); wrap(stored); delete fsc[pk]; Object.defineProperty(fsc, pk, { configurable: true, enumerable: true, get: function () { T.mirrorReads++; return stored; }, set: function (v) { T.sets++; stored = v; wrap(v); } }); return JSON.stringify({ armed: true, pk: pk, fk: fk || null, propsFrozen: !!frozen, hadKeyDown: typeof stored.onKeyDown === "function" }); })()';

const arm = evalJson(ARM);
ok("C7 the replacement-proof trap armed on the fsc root", arm.armed === true && arm.hadKeyDown === true, `pk=${arm.pk} frozen=${arm.propsFrozen} freezeBlocked=${arm.freezeBlocked}`);

/* ---- the settle: 1s of world-time before the fire. Any commit that
 * replaces the mirror lands in trapA's setter — the staleness smoking gun. */
await zzz(1);
const settle = evalJson('(() => JSON.stringify({ sets: window.__t885.sets, mirrorReads: window.__t885.mirrorReads }))()');
ok("C8 the mirror was replaced since the arm (a commit minted fresh props)", settle.sets >= 1, `sets=${settle.sets} (pre-fire mirrorReads=${settle.mirrorReads})`);

/* ---- THE FIRE: one synthetic Escape at the t881 target. */
const fire = evalJson('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); if (!fsc) return JSON.stringify({ fired: false }); const t = (document.activeElement && fsc.contains(document.activeElement) && document.activeElement !== fsc) ? document.activeElement : (fsc.querySelector("[data-slot=dialog-content]") || fsc); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ fired: true, target: t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : "") }); })()');
ok("C9 the Escape fired", fire.fired === true, `target=${fire.target}`);

/* ---- the peel */
let landed = null;
for (let i = 1; i <= 12; i++) {
  await zzz(0.5);
  const m = evalJson(FSC_PROBE);
  if (m.fscOpen === false) { landed = i * 500; break; }
}
ok("C10 the peel landed", landed !== null, `atMs=${landed}`);

/* ---- THE READ: counters + the first call's stack. */
const read = evalJson('(() => JSON.stringify(window.__t885))()');
console.log(`\n  the trap's counters: sets=${read.sets} mirrorReads=${read.mirrorReads} keyReads=${read.keyReads} calls=${read.calls} freezeBlocked=${read.freezeBlocked}`);
if (read.stack) { console.log(`\n  the first call's stack:\n    ${String(read.stack).replace(/ << /g, "\n    ")}`); }
ok("C11 THE SURFACE: the dispatch read the element's mirror (trapA getter fired)", read.mirrorReads > 0, `mirrorReads=${read.mirrorReads}`);
ok("C12 THE CALL: the dispatched listener came from the trapped surface", read.calls > 0, `calls=${read.calls} keyReads=${read.keyReads}`);

/* ---- restore */
ab(`open ${BASE}/?t=${Date.now()}`);
zzz(3);
const after = evalJson(FSC_PROBE);
const pageBtns1 = evalJson('(() => JSON.stringify({ n: document.querySelectorAll("button, [role=button]").length }))()').n;
ok("C13 the world restored bare", after.dlgCount === 0 && pageBtns1 >= 100, `dlgs=${after.dlgCount} pageBtns=${pageBtns1}`);

console.log(`\nPROPS-SURFACE t885: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t885",
  window: "cron 2026-11-02 16:05:38 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021605)",
  purpose: "the wrap-zero surface question — a replacement-proof trap on the mirror KEY (accessor) + the onKeyDown accessor + the suffix census",
  census, arm, settle, fire, landed, read, checks: results, pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t885-props-surface.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t885-props-surface.json");
process.exit(fail === 0 ? 0 : 1);

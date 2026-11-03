#!/usr/bin/env node
/* t885b — THE FROZEN-MIRROR CLOSURE: the two-artifact theory, quantified,
 * and the call counted through a frozen-safe clone.
 *
 * t885's first pass answered the surface question (mirrorReads=10: the
 * dispatch reads `stateNode[__reactProps$…]`) and exposed TWO independent
 * instrument artifacts that together explain every prior wrap-zero:
 *   (a) STALENESS — React REPLACES the mirror (`domElement[propsKey] =
 *       newProps`) on commits (t885: sets=4 while armed); a wrap applied to
 *       the old props object is orphaned at the next commit.
 *   (b) FROZEN — the props objects are frozen (React dev freezes props);
 *       in agent-browser's SLOPPY-mode eval, `propsObj.onKeyDown = wrap` is
 *       a SILENT NO-OP (freezeBlocked=0 while frozen=true proved it: no
 *       throw, no wrap, no counter). Strict-mode node scripts would THROW
 *       instead — either way the wrap never lands on the live object.
 *
 * THE INSTRUMENT (frozen-safe): trapA stays on the ELEMENT's mirror KEY
 * (elements are not frozen), but the getter now returns a CACHED CLONE of
 * the stored props object whose onKeyDown is a counting wrapper around the
 * frozen original — getListener receives the clone, dispatch CALLS the
 * wrapper, calls++ lands, and the first call's stack names the dispatch
 * path. Behaviour preserved (the wrapper calls the real handler). The
 * clone cache is keyed by the stored object, so a replacement (setter)
 * re-clones the fresh object automatically.
 *
 * Discipline fixed from t885: the dress loop polls pageBtns>=100; the
 * fsc-compare selection keys are CLEARED and the app reloaded (t881's
 * clean-baseline law — t885 rode on a persisted autolive world); a frozen
 * census quantifies artifact (b) across all 201 carriers.
 *
 * Receipt: shots-qa/t885b-frozen-mirror.json.
 *
 *   node scripts/t885b-frozen-mirror.mjs
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

console.log("t885b — the frozen-mirror closure: the call counted through the clone\n");

/* ---- the clean dress: fresh load, CLEAR the fsc-compare selection keys,
 * reload so the app boots with the clean baseline (t881's law). */
ab(`open ${BASE}/?t=${Date.now()}`);
zzz(3);
evalJson('(() => { Object.keys(localStorage).filter((k) => k.indexOf("cryoflow.fsc-compare:") === 0 || k === "cryoflow.selectedJob.v1").forEach((k) => localStorage.removeItem(k)); return JSON.stringify({ cleared: true }); })()');
ab(`open ${BASE}/?t=${Date.now()}`);

let dress = null;
for (let i = 0; i < 60; i++) {
  zzz(1);
  dress = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const btns = document.querySelectorAll("button, [role=button]").length; return JSON.stringify({ dlgs: dgs, btns: btns }); })()');
  if (dress.dlgs === 0 && dress.btns >= 100) break;
}
ok("C1 the world dressed bare (clean baseline)", dress && dress.dlgs === 0 && dress.btns >= 100, `dlgs=${dress?.dlgs} btns=${dress?.btns}`);
const autolive = evalJson('(() => JSON.stringify({ v: localStorage.getItem("cryoflow.fsc-compare:autolive") }))()').v;
ok("C1b the autolive key is absent (the door will open by click, not memory)", autolive !== "true", `autolive=${JSON.stringify(autolive)}`);

/* ---- the door walk */
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
evalJson(`(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (b) b.click(); return JSON.stringify({ clicked: !!b }); })()`);
let fsc = null;
for (let i = 0; i < 20; i++) {
  zzz(1);
  fsc = evalJson(FSC_PROBE);
  if (fsc.fscOpen === true && fsc.dlgCount === 2) break;
}
ok("C5 the fsc dialog floats over the inspector", fsc && fsc.fscOpen === true && fsc.dlgCount === 2, `dlgs=${fsc?.dlgCount}`);

/* ---- the frozen census: how many of the carriers' props objects are
 * frozen (artifact b, quantified) + the suffix census (one react copy). */
const census = evalJson('(() => { const pkS = new Set(); const fkS = new Set(); let carriers = 0; let frozenC = 0; document.querySelectorAll("*").forEach((el) => { Object.keys(el).forEach((k) => { if (k.indexOf("__reactProps$") === 0) { pkS.add(k.slice(14)); if (el[k] && typeof el[k].onKeyDown === "function") { carriers++; if (Object.isFrozen(el[k])) frozenC++; } } else if (k.indexOf("__reactFiber$") === 0) { fkS.add(k.slice(14)); } }); }); return JSON.stringify({ els: document.querySelectorAll("*").length, pkSuffixes: Array.from(pkS), fkSuffixes: Array.from(fkS), carriers: carriers, frozenCarriers: frozenC }); })()');
console.log(`\n  census: els=${census.els} props-suffixes=[${census.pkSuffixes.join(", ")}] fiber-suffixes=[${census.fkSuffixes.join(", ")}] carriers=${census.carriers} frozen=${census.frozenCarriers}`);
ok("C6 one react-dom copy owns the document", census.pkSuffixes.length === 1 && census.fkSuffixes.length === 1, `pk=${census.pkSuffixes.length} fk=${census.fkSuffixes.length}`);
ok("C7 ARTIFACT (b) QUANTIFIED: the carriers' props objects are frozen (sloppy-eval wraps are silent no-ops)", census.frozenCarriers >= 1, `frozen ${census.frozenCarriers}/${census.carriers}`);

/* ---- THE ARM (frozen-safe): trapA on the element's mirror KEY; the getter
 * returns a cached CLONE whose onKeyDown counts and captures the stack. */
const ARM =
  '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); if (!fsc) return JSON.stringify({ armed: false, why: "no fsc dialog" }); window.__t885b = { sets: 0, mirrorReads: 0, calls: 0, clones: 0, stack: null }; const T = window.__t885b; const pk = Object.keys(fsc).find((k) => k.indexOf("__reactProps$") === 0); if (!pk) return JSON.stringify({ armed: false, why: "no mirror key" }); const fk = Object.keys(fsc).find((k) => k.indexOf("__reactFiber$") === 0); let stored = fsc[pk]; const cloneCache = new Map(); const cloneOf = (obj) => { if (!cloneCache.has(obj)) { const orig = obj.onKeyDown; const counting = function (e) { T.calls++; if (!T.stack) { T.stack = (new Error().stack || "").split("\\n").slice(1, 7).join(" << ").slice(0, 700); } return orig.call(this, e); }; const c = {}; for (const kk in obj) { c[kk] = obj[kk]; } c.onKeyDown = counting; Object.defineProperty(c, "onKeyDown", { enumerable: true, get: function () { return counting; } }); cloneCache.set(obj, c); T.clones++; } return cloneCache.get(obj); }; delete fsc[pk]; Object.defineProperty(fsc, pk, { configurable: true, enumerable: true, get: function () { T.mirrorReads++; return cloneOf(stored); }, set: function (v) { T.sets++; stored = v; } }); return JSON.stringify({ armed: true, pk: pk, fk: fk || null, rootPropsFrozen: Object.isFrozen(stored), hadKeyDown: typeof stored.onKeyDown === "function" }); })()';

const arm = evalJson(ARM);
ok("C8 the frozen-safe trap armed on the fsc root", arm.armed === true && arm.hadKeyDown === true, `pk=${arm.pk} rootPropsFrozen=${arm.rootPropsFrozen}`);

await zzz(1);
const settle = evalJson('(() => JSON.stringify({ sets: window.__t885b.sets, mirrorReads: window.__t885b.mirrorReads, clones: window.__t885b.clones }))()');
ok("C9 ARTIFACT (a) QUANTIFIED: the mirror was replaced since the arm (commits mint fresh props)", settle.sets >= 1, `sets=${settle.sets} (pre-fire mirrorReads=${settle.mirrorReads}, clones=${settle.clones})`);

const fire = evalJson('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); if (!fsc) return JSON.stringify({ fired: false }); const t = (document.activeElement && fsc.contains(document.activeElement) && document.activeElement !== fsc) ? document.activeElement : (fsc.querySelector("[data-slot=dialog-content]") || fsc); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ fired: true, target: t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : "") }); })()');
ok("C10 the Escape fired", fire.fired === true, `target=${fire.target}`);

let landed = null;
for (let i = 1; i <= 12; i++) {
  await zzz(0.5);
  const m = evalJson(FSC_PROBE);
  if (m.fscOpen === false) { landed = i * 500; break; }
}
ok("C11 the peel landed (behaviour preserved through the clone)", landed !== null, `atMs=${landed}`);

const read = evalJson('(() => JSON.stringify(window.__t885b))()');
console.log(`\n  the trap's counters: sets=${read.sets} mirrorReads=${read.mirrorReads} calls=${read.calls} clones=${read.clones}`);
if (read.stack) { console.log(`\n  the first call's stack:\n    ${String(read.stack).replace(/ << /g, "\n    ")}`); }
ok("C12 THE SURFACE (re-confirmed): the dispatch read the element's mirror", read.mirrorReads > 0, `mirrorReads=${read.mirrorReads}`);
ok("C13 THE CALL COUNTED: the dispatched listener was the clone's counting wrapper", read.calls > 0 && !!read.stack, `calls=${read.calls} stack=${read.stack ? "captured" : "none"}`);

/* ---- restore */
ab(`open ${BASE}/?t=${Date.now()}`);
let after = null;
for (let i = 0; i < 30; i++) {
  zzz(1);
  after = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const btns = document.querySelectorAll("button, [role=button]").length; return JSON.stringify({ dlgs: dgs, btns: btns }); })()');
  if (after.dlgs === 0 && after.btns >= 100) break;
}
ok("C14 the world restored bare", after && after.dlgs === 0 && after.btns >= 100, `dlgs=${after?.dlgs} btns=${after?.btns}`);

console.log(`\nFROZEN-MIRROR t885b: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t885b",
  window: "cron 2026-11-02 16:05:38 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021605)",
  purpose: "the wrap-zero mystery CLOSED — two artifacts quantified (staleness: mirror replaced on commits; frozen: sloppy-eval wraps are silent no-ops), the call counted through a frozen-safe clone, the dispatch path stack captured",
  census, arm, settle, fire, landed, read, checks: results, pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t885b-frozen-mirror.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t885b-frozen-mirror.json");
process.exit(fail === 0 ? 0 : 1);

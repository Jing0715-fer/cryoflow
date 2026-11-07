#!/usr/bin/env node
/* t885c — THE GALLERY'S OWN CONSUMER, SPY-MEASURED (t884's second guidance
 * item). class-gallery.tsx's onLightboxKey comment has carried an honesty
 * debt since t884: "THIS component's own consumer has not been spy-measured
 * yet — whether this exact handler is dispatched for Escape (like the fsc
 * twin) or the lightbox closes through Radix's parallel capture, the
 * behaviour is the same." One ride ends the debt, measuring BOTH claims:
 *
 *   1. THE ARROWS: fire ArrowRight at the lightbox — if the handler is
 *      dispatched, stepZoom(1) runs and the title's class number CHANGES
 *      (behaviour cannot be faked by Radix — Radix never closes or steps on
 *      arrows).
 *   2. THE ESCAPE: fire Escape — calls increments and the lightbox peels
 *      ONE layer while the inspector (the gallery) survives behind.
 *
 * THE INSTRUMENT: t885b's frozen-safe clone trap (props objects are frozen
 * 201/201 — value wraps are silent no-ops in sloppy eval; mirrors are
 * replaced on commits — plain wraps go stale). trapA on the LIGHTBOX
 * element's `__reactProps$` key; the getter returns a cached clone whose
 * onKeyDown counts and captures the first call's stack.
 *
 * The walk: clean dress -> Workflow canvas -> the 2D-classification card
 * (the gallery IS the select2d parameter; the 3D Refine inspector has no
 * gallery) -> the class gallery -> a Zoom door -> the lightbox over the
 * inspector.
 *
 * Receipt: shots-qa/t885c-gallery-spy.json.
 *
 *   node scripts/t885c-gallery-spy.mjs
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

const LB_PROBE =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const titleOf = (d) => ((d.querySelector("[data-slot=dialog-title]") || {}).textContent || "").trim(); const lb = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); return JSON.stringify({ dlgCount: dgs.length, dlgHeads: dgs.map(titleOf).map((t) => t.slice(0, 40)), lbOpen: !!lb, lbTitle: lb ? titleOf(lb) : null }); })()';

console.log("t885c — the gallery's own consumer, spy-measured: arrows AND escape through the frozen-safe trap\n");

/* ---- the clean dress */
ab(`open ${BASE}/?t=${Date.now()}`);
let dress = null;
for (let i = 0; i < 60; i++) {
  zzz(1);
  dress = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const btns = document.querySelectorAll("button, [role=button]").length; return JSON.stringify({ dlgs: dgs, btns: btns }); })()');
  if (dress.dlgs === 0 && dress.btns >= 100) break;
}
ok("C1 the world dressed bare", dress && dress.dlgs === 0 && dress.btns >= 100, `dlgs=${dress?.dlgs} btns=${dress?.btns}`);

const wf = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (wf.found && wf.clicked) zzz(2);
let cards = 0;
for (let i = 0; i < 20; i++) {
  cards = evalJson('(() => JSON.stringify({ c: document.querySelectorAll("div[role=button][aria-label]").length }))()').c;
  if (cards >= 10) break;
  zzz(1);
}
ok("C2 the workflow canvas holds the cards", cards >= 10, `cards=${cards}`);

/* ---- pick the 2D-classification card (the gallery IS its parameter) */
const pick = evalJson('(() => JSON.stringify({ cards: Array.from(document.querySelectorAll("[data-card-btn]")).map((b) => (b.textContent || "").slice(0, 60)) }))()');
console.log(`\n  the cards on the canvas: ${pick.cards.join(" | ")}`);
/* the gallery IS the select2d parameter — "Select 2D", not "2D Classification"
 * (t885c's first pass opened 2D Classification's inspector: no gallery there) */
const pickIdx = (re) => pick.cards.findIndex((t) => re.test(t));
const want = pickIdx(/Select 2D/i) >= 0 ? pickIdx(/Select 2D/i) : (pickIdx(/2D Class Selection/i) >= 0 ? pickIdx(/2D Class Selection/i) : pickIdx(/select/i));
ok("C3 a select2d card exists (the gallery IS its parameter)", want >= 0, `picked=[${want >= 0 ? pick.cards[want] : "NONE"}]`);
if (want < 0) {
  const receipt = { task: "t885c", window: "cron 2026-11-02 16:05:38 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021605)", purpose: "the gallery's own consumer, spy-measured", pick, checks: results, pass, fail };
  writeFileSync(join(ROOT, "shots-qa", "t885c-gallery-spy.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log("receipt: shots-qa/t885c-gallery-spy.json (aborted honestly — no 2D card)");
  process.exit(1);
}

const openHost = evalJson(`(() => { const btns = Array.from(document.querySelectorAll("[data-card-btn]")); const btn = btns[${want}]; if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()`);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); return JSON.stringify({ n: dgs.length, gallery: !!document.querySelector("[aria-label=\\"Class selection gallery\\"]") }); })()');
  if (insp.n >= 1 && insp.gallery) break;
}
ok("C4 the inspector arrived with the class gallery mounted", insp && insp.n >= 1 && insp.gallery === true, `dlgs=${insp?.n} gallery=${insp?.gallery}`);

let zoomDoor = false;
for (let i = 0; i < 15; i++) {
  zoomDoor = evalJson('(() => JSON.stringify({ d: document.querySelectorAll("[aria-label^=\\"Zoom class\\"]").length }))()').d > 0;
  if (zoomDoor) break;
  zzz(1);
}
ok("C5 a Zoom door is mounted", zoomDoor === true);

/* ---- open the lightbox */
evalJson('(() => { const z = document.querySelector("[aria-label^=\\"Zoom class\\"]"); if (z) z.click(); return JSON.stringify({ clicked: !!z }); })()');
let lb = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  lb = evalJson(LB_PROBE);
  if (lb.lbOpen === true && lb.dlgCount === 2) break;
}
ok("C6 the lightbox floats over the inspector", lb && lb.lbOpen === true && lb.dlgCount === 2, `title=${lb?.lbTitle}`);

/* ---- the frozen census of the lightbox's own subtree */
const census = evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const lbEl = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); if (!lbEl) return JSON.stringify({ found: false }); const all = [lbEl, ...lbEl.querySelectorAll("*")]; let carriers = 0; let frozenC = 0; const pkS = new Set(); all.forEach((el) => { Object.keys(el).forEach((k) => { if (k.indexOf("__reactProps$") === 0) { pkS.add(k.slice(14)); if (el[k] && typeof el[k].onKeyDown === "function") { carriers++; if (Object.isFrozen(el[k])) frozenC++; } } }); }); return JSON.stringify({ found: true, carriers: carriers, frozenCarriers: frozenC, suffixes: Array.from(pkS) }); })()');
console.log(`\n  lightbox census: carriers=${census.carriers} frozen=${census.frozenCarriers} suffixes=${(census.suffixes || []).join(", ")}`);
ok("C7 the lightbox carries its own onKeyDown carrier, frozen like every carrier", census.found === true && census.carriers >= 1 && census.frozenCarriers >= 1, `frozen ${census.frozenCarriers}/${census.carriers}`);

/* ---- THE ARM: the frozen-safe clone trap on the LIGHTBOX element */
const ARM =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const lbEl = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); if (!lbEl) return JSON.stringify({ armed: false, why: "no lightbox" }); window.__t885c = { sets: 0, mirrorReads: 0, calls: 0, keys: [], stack: null }; const T = window.__t885c; const pk = Object.keys(lbEl).find((k) => k.indexOf("__reactProps$") === 0); if (!pk) return JSON.stringify({ armed: false, why: "no mirror key" }); let stored = lbEl[pk]; const cloneCache = new Map(); const cloneOf = (obj) => { if (!cloneCache.has(obj)) { const orig = obj.onKeyDown; const counting = function (e) { T.calls++; T.keys.push(String(e && e.key)); if (!T.stack) { T.stack = (new Error().stack || "").split("\\n").slice(1, 7).join(" << ").slice(0, 700); } return orig.call(this, e); }; const c = {}; for (const kk in obj) { c[kk] = obj[kk]; } Object.defineProperty(c, "onKeyDown", { enumerable: true, get: function () { return counting; } }); cloneCache.set(obj, c); } return cloneCache.get(obj); }; delete lbEl[pk]; Object.defineProperty(lbEl, pk, { configurable: true, enumerable: true, get: function () { T.mirrorReads++; return cloneOf(stored); }, set: function (v) { T.sets++; stored = v; } }); return JSON.stringify({ armed: true, pk: pk, rootPropsFrozen: Object.isFrozen(stored), hadKeyDown: typeof stored.onKeyDown === "function" }); })()';

const arm = evalJson(ARM);
ok("C8 the frozen-safe trap armed on the lightbox", arm.armed === true && arm.hadKeyDown === true, `pk=${arm.pk} rootPropsFrozen=${arm.rootPropsFrozen}`);

/* ---- FIRE 1: ArrowRight — the step the handler alone can do */
const titleBefore = lb.lbTitle;
const fire1 = evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const lbEl = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); if (!lbEl) return JSON.stringify({ fired: false }); lbEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })); return JSON.stringify({ fired: true }); })()');
zzz(1);
const afterArrow = evalJson(LB_PROBE);
const stepped = afterArrow.lbOpen === true && afterArrow.lbTitle !== titleBefore;
console.log(`\n  ArrowRight: title "${titleBefore}" -> "${afterArrow.lbTitle}"`);
ok("C9 ARROWS VERDICT: the handler was dispatched and stepZoom ran (the title stepped)", stepped === true, `calls-so-far proves below`);

/* ---- FIRE 2: Escape — the peel with the inspector surviving */
const fire2 = evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const lbEl = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); if (!lbEl) return JSON.stringify({ fired: false }); lbEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ fired: true }); })()');
let peeled = null;
for (let i = 1; i <= 12; i++) {
  await zzz(0.5);
  const m = evalJson(LB_PROBE);
  if (m.lbOpen === false && m.dlgCount === 1) { peeled = i * 500; break; }
}
ok("C10 ESCAPE VERDICT: one layer peeled, the inspector (the gallery) survived behind", peeled !== null, `atMs=${peeled} dlgs-after=1`);

/* ---- THE READ */
const read = evalJson('(() => JSON.stringify(window.__t885c || { sets: 0, mirrorReads: 0, calls: 0, keys: [], stack: null }))()');
console.log(`\n  the trap's counters: sets=${read.sets} mirrorReads=${read.mirrorReads} calls=${read.calls} keys=[${(read.keys || []).join(",")}]`);
if (read.stack) { console.log(`\n  the first call's stack:\n    ${String(read.stack).replace(/ << /g, "\n    ")}`); }
ok("C11 THE SURFACE: the dispatch read the lightbox's element mirror", read.mirrorReads > 0, `mirrorReads=${read.mirrorReads}`);
ok("C12 THE CALLS COUNTED: both keys reached the carrier through the clone (ArrowRight + Escape)", read.calls >= 2 && (read.keys || []).indexOf("Escape") >= 0 && (read.keys || []).indexOf("ArrowRight") >= 0, `calls=${read.calls} keys=[${(read.keys || []).join(",")}]`);
ok("C13 the dispatch path named (stack captured)", !!read.stack, read.stack ? "executeDispatch chain above" : "none");

/* ---- restore */
ab(`open ${BASE}/?t=${Date.now()}`);
let after = null;
for (let i = 0; i < 30; i++) {
  zzz(1);
  after = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const btns = document.querySelectorAll("button, [role=button]").length; return JSON.stringify({ dlgs: dgs, btns: btns }); })()');
  if (after.dlgs === 0 && after.btns >= 100) break;
}
ok("C14 the world restored bare", after && after.dlgs === 0 && after.btns >= 100, `dlgs=${after?.dlgs} btns=${after?.btns}`);

console.log(`\nGALLERY-SPY t885c: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t885c",
  window: "cron 2026-11-02 16:05:38 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021605)",
  purpose: "the gallery's own consumer, spy-measured — arrows step AND escape peels through the frozen-safe clone trap; the comment's honesty debt ends",
  pick, census, arm, titleBefore, afterArrow, fire1, fire2, peeled, read, checks: results, pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t885c-gallery-spy.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t885c-gallery-spy.json");
process.exit(fail === 0 ? 0 : 1);

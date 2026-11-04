#!/usr/bin/env node
/* t886 — THE GALLERY SPY, RESUMED WITH THE MAP (t885's guidance item 2).
 * t885c's walk found the debt door but not the room: completed jobs open the
 * READ-ONLY report inspector (no params, no gallery), "Reset & edit" resets
 * the job to idle AND closes the dialog, and the idle card's click opened
 * "nothing visible". The edit surface was never a dialog — it is the RIGHT
 * SIDE PANEL (app-shell asides[1], desktop xl): idle + selected mounts
 * <JobPanel/> whose OUTER tabs are I/O / Params / Results / Log, whose
 * PARAMS tab hosts the spec's inner tabs (select2d's allTabs[0] = "Classes")
 * where <ClassGallery/> mounts (job-panel.tsx line 1522:
 * spec.key==="select2d" && t===allTabs[0]).
 *
 * THE WALK (each step validated live in this window's recon):
 *   dress -> Workflow canvas -> the "Select 2D" card -> the report inspector
 *   -> "Reset & edit" (world write, restore recipe: POST /api/jobs/[id]/run)
 *   -> the panel's Params tab (REAL click — Radix Tabs ignored the synthetic
 *   .click(); the instrument lesson: mark the element with an id and let
 *   agent-browser's trusted click land) -> Classes inner tab auto-selects
 *   (Tabs defaultValue=allTabs[0]) -> the gallery + 50 Zoom doors -> a Zoom
 *   door -> THE LIGHTBOX over the PANEL (dlgCount===1 — t885c's inspector
 *   world had 2; the panel is an aside, not a dialog) -> census -> ARM the
 *   frozen-safe clone trap (t885b's instrument, t885c's ARM verbatim) ->
 *   ArrowRight (the step only this handler can do) -> Escape (the peel with
 *   the gallery surviving) -> THE READ.
 *
 * THE VERDICT THIS RIDES FOR (class-gallery.tsx onLightboxKey's honesty
 * debt, open since t884): "this component's own consumer has not been
 * spy-measured yet — whether this exact handler is dispatched for Escape or
 * the lightbox closes through Radix's parallel capture". calls>=2 with keys
 * [ArrowRight, Escape] + the executeDispatch stack ENDS the debt: the
 * handler is ALIVE and dispatched for both keys, the one-layer guarantee is
 * two working hands agreeing, and the comment at its home gets corrected.
 *
 * Restore: POST the run (the recipe), poll completed, verify the world 15/15
 * and the card's receipt text. The dashboard floor (106) is verified by the
 * gate re-ride after this script.
 *
 *   node scripts/t886-gallery-edit-spy.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const SELECT2D_ID = "cmvyu55sk000ipm9bz6r4slcp";
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
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const titleOf = (d) => ((d.querySelector("[data-slot=dialog-title]") || {}).textContent || "").trim(); const lb = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); return JSON.stringify({ dlgCount: dgs.length, lbOpen: !!lb, lbTitle: lb ? titleOf(lb) : null }); })()';

console.log("t886 — the gallery spy, resumed with the map: the edit-mode door, the lightbox over the panel, arrows AND escape through the frozen-safe trap\n");

/* ---- C0: pre-flight idempotency — a previous ride's crash may have left
 * the select2d job idle (the reset is the walk's first world write). Restore
 * FIRST so the walk always starts from the receipted completed world. */
console.log("  pre-flight: ensure the select2d world is completed");
try {
  const out0 = execSync(`curl -s --max-time 10 -H "Origin: http://localhost:3000" ${BASE}/api/jobs`, { encoding: "utf8" });
  const d0 = JSON.parse(out0);
  const s20 = (d0.jobs || []).find((j) => j.id === SELECT2D_ID);
  if (!s20 || s20.status !== "completed" || !s20.ranParams) {
    console.log("    dirty world (status=" + (s20 ? s20.status : "missing") + ") — running the restore recipe first");
    execSync(`curl -s --max-time 30 -X POST -H "Origin: http://localhost:3000" ${BASE}/api/jobs/${SELECT2D_ID}/run`, { encoding: "utf8" });
    for (let i = 0; i < 90; i++) {
      await zzz(1);
      const o = JSON.parse(execSync(`curl -s --max-time 10 -H "Origin: http://localhost:3000" ${BASE}/api/jobs`, { encoding: "utf8" }));
      const s = (o.jobs || []).find((j) => j.id === SELECT2D_ID);
      if (s && s.status === "completed" && s.ranParams) break;
    }
  }
} catch { /* the poll below still verifies */ }

/* ---- C1: the clean dress (cache-buster forces a real navigation) */
ab(`open ${BASE}/?t=${Date.now()}`);
let dress = null;
for (let i = 0; i < 60; i++) {
  zzz(1);
  dress = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const btns = document.querySelectorAll("button, [role=button]").length; return JSON.stringify({ dlgs: dgs, btns: btns }); })()');
  if (dress.dlgs === 0 && dress.btns >= 100) break;
}
ok("C1 the world dressed bare", dress && dress.dlgs === 0 && dress.btns >= 100, `dlgs=${dress?.dlgs} btns=${dress?.btns}`);

/* ---- C2: the Workflow canvas and its cards */
const wf = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (wf.found && wf.clicked) zzz(2);
let cards = 0;
for (let i = 0; i < 20; i++) {
  cards = evalJson('(() => JSON.stringify({ c: document.querySelectorAll("[data-card-btn]").length }))()').c;
  if (cards >= 10) break;
  zzz(1);
}
ok("C2 the workflow canvas holds the cards", cards >= 10, `cards=${cards}`);

/* ---- C3: pick the Select 2D card (the gallery IS the select2d parameter) */
const pick = evalJson('(() => JSON.stringify({ cards: Array.from(document.querySelectorAll("[data-card-btn]")).map((b) => (b.textContent || "").slice(0, 60)) }))()');
const want = pick.cards.findIndex((t) => /Select 2D/i.test(t));
ok("C3 the Select 2D card exists (completed world)", want >= 0, `picked=[${want >= 0 ? pick.cards[want] : "NONE"}]`);
if (want < 0) {
  const receipt = { task: "t886", purpose: "the gallery spy resumed with the map", pick, checks: results, pass, fail };
  writeFileSync(join(ROOT, "shots-qa", "t886-gallery-edit-spy.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log("receipt: shots-qa/t886-gallery-edit-spy.json (aborted honestly — no Select 2D card)");
  process.exit(1);
}

/* ---- C4: open the report inspector (completed job) */
evalJson(`(() => { const btns = Array.from(document.querySelectorAll("[data-card-btn]")); const btn = btns[${want}]; const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ ok: true }); })()`);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const r = dgs.length ? dgs[0] : null; const tabs = r ? Array.from(r.querySelectorAll("[role=tab]")).map((t) => (t.textContent || "").trim()) : []; const reset = r ? Array.from(r.querySelectorAll("button")).some((b) => (b.textContent || "").indexOf("Reset & edit") !== -1) : false; return JSON.stringify({ n: dgs.length, tabs, reset }); })()');
  if (insp.n >= 1 && insp.reset) break;
}
ok("C4 the report inspector opened with its Reset & edit door", insp && insp.n >= 1 && insp.reset === true, `tabs=[${(insp?.tabs || []).join(", ")}]`);

/* ---- C5: the world write — "Reset & edit" (restore recipe armed) */
evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const btn = dgs.flatMap((d) => Array.from(d.querySelectorAll("button"))).find((b) => (b.textContent || "").indexOf("Reset & edit") !== -1); if (btn) btn.click(); return JSON.stringify({ clicked: !!btn }); })()');
let panel = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  panel = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const as = Array.from(document.querySelectorAll("aside")); const p = as.length > 1 ? as[1] : null; const head = p ? (p.textContent || "").slice(0, 120) : ""; return JSON.stringify({ dlgs: dgs, panel: !!p, idleHead: head.indexOf("idle") !== -1 || head.indexOf("Subset-selection") !== -1 }); })()');
  if (panel.dlgs === 0 && panel.panel && panel.idleHead) break;
}
ok("C5 reset landed: inspector gone, the RIGHT-SIDE PANEL is the edit surface", panel && panel.dlgs === 0 && panel.panel === true && panel.idleHead === true, `dlgs=${panel?.dlgs} panel=${panel?.panel}`);

/* ---- C6: the panel's Params tab (REAL click — Radix Tabs ignored the
 * synthetic .click(); mark the element, let agent-browser's trusted click land) */
const marked = evalJson('(() => { const as = Array.from(document.querySelectorAll("aside")); const p = as[1]; if (!p) return JSON.stringify({ found: false }); const t = Array.from(p.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").trim() === "Params"); if (!t) return JSON.stringify({ found: false }); t.id = "t886params"; return JSON.stringify({ found: true }); })()');
let galOk = false;
if (marked.found) {
  ab(`click '#t886params'`);
  for (let i = 0; i < 15; i++) {
    zzz(1);
    galOk = evalJson('(() => { const p = Array.from(document.querySelectorAll("aside"))[1]; return JSON.stringify({ g: !!p.querySelector("[aria-label=\\"Class selection gallery\\"]") }); })()').g;
    if (galOk) break;
  }
}
ok("C6 Params tab (trusted click) -> the Classes inner tab mounts the gallery", galOk === true);

/* ---- C7: the Zoom doors */
let zoomDoors = 0;
for (let i = 0; i < 15; i++) {
  zoomDoors = evalJson('(() => JSON.stringify({ d: document.querySelectorAll("[aria-label^=\\"Zoom class\\"]").length }))()').d;
  if (zoomDoors > 0) break;
  zzz(1);
}
ok("C7 the Zoom doors are mounted", zoomDoors > 0, `doors=${zoomDoors}`);

/* ---- C8: open the lightbox — ONE dialog over the PANEL */
evalJson('(() => { const z = document.querySelector("[aria-label^=\\"Zoom class\\"]"); if (z) z.click(); return JSON.stringify({ clicked: !!z }); })()');
let lb = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  lb = evalJson(LB_PROBE);
  if (lb.lbOpen === true && lb.dlgCount === 1) break;
}
ok("C8 the lightbox floats over the PANEL (one dialog — the panel is an aside)", lb && lb.lbOpen === true && lb.dlgCount === 1, `title=${lb?.lbTitle} dlgs=${lb?.dlgCount}`);

/* ---- C9: the frozen census of the lightbox's own subtree */
const census = evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const lbEl = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); if (!lbEl) return JSON.stringify({ found: false }); const all = [lbEl, ...lbEl.querySelectorAll("*")]; let carriers = 0; let frozenC = 0; all.forEach((el) => { Object.keys(el).forEach((k) => { if (k.indexOf("__reactProps$") === 0) { if (el[k] && typeof el[k].onKeyDown === "function") { carriers++; if (Object.isFrozen(el[k])) frozenC++; } } }); }); return JSON.stringify({ found: true, carriers: carriers, frozenCarriers: frozenC }); })()');
ok("C9 the lightbox carries its onKeyDown carrier, frozen like every carrier", census.found === true && census.carriers >= 1 && census.frozenCarriers >= 1, `frozen ${census.frozenCarriers}/${census.carriers}`);

/* ---- C10: THE ARM — the frozen-safe clone trap (t885b/t885c verbatim) */
const ARM =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const lbEl = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); if (!lbEl) return JSON.stringify({ armed: false, why: "no lightbox" }); window.__t886 = { sets: 0, mirrorReads: 0, calls: 0, keys: [], stack: null }; const T = window.__t886; const pk = Object.keys(lbEl).find((k) => k.indexOf("__reactProps$") === 0); if (!pk) return JSON.stringify({ armed: false, why: "no mirror key" }); let stored = lbEl[pk]; const cloneCache = new Map(); const cloneOf = (obj) => { if (!cloneCache.has(obj)) { const orig = obj.onKeyDown; const counting = function (e) { T.calls++; T.keys.push(String(e && e.key)); if (!T.stack) { T.stack = (new Error().stack || "").split("\\n").slice(1, 7).join(" << ").slice(0, 700); } return orig.call(this, e); }; const c = {}; for (const kk in obj) { c[kk] = obj[kk]; } Object.defineProperty(c, "onKeyDown", { enumerable: true, get: function () { return counting; } }); cloneCache.set(obj, c); } return cloneCache.get(obj); }; delete lbEl[pk]; Object.defineProperty(lbEl, pk, { configurable: true, enumerable: true, get: function () { T.mirrorReads++; return cloneOf(stored); }, set: function (v) { T.sets++; stored = v; } }); return JSON.stringify({ armed: true, rootPropsFrozen: Object.isFrozen(stored), hadKey: typeof stored.onKeyDown === "function" }); })()';

const arm = evalJson(ARM);
ok("C10 the frozen-safe trap armed on the lightbox", arm.armed === true && arm.hadKey === true, `rootPropsFrozen=${arm.rootPropsFrozen}`);

/* ---- C11: FIRE 1 — ArrowRight (the step only this handler can do) */
const titleBefore = lb.lbTitle;
evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const lbEl = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); lbEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })); return JSON.stringify({ fired: true }); })()');
zzz(1.5);
const afterArrow = evalJson(LB_PROBE);
const stepped = afterArrow.lbOpen === true && afterArrow.lbTitle !== titleBefore;
console.log(`\n  ArrowRight: title "${titleBefore}" -> "${afterArrow.lbTitle}"`);
ok("C11 ARROWS VERDICT: the handler was dispatched and stepZoom ran", stepped === true);

/* ---- C12: FIRE 2 — Escape (the peel with the gallery surviving) */
evalJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const lbEl = dgs.find((d) => !!d.querySelector("[aria-label=\\"Previous class\\"]")); lbEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ fired: true }); })()');
let peeled = null;
for (let i = 1; i <= 12; i++) {
  await zzz(0.5);
  const m = evalJson(LB_PROBE);
  if (m.lbOpen === false && m.dlgCount === 0) { peeled = i * 500; break; }
}
const survivor = evalJson('(() => { const p = Array.from(document.querySelectorAll("aside"))[1]; return JSON.stringify({ panel: !!p, gallery: !!p.querySelector("[aria-label=\\"Class selection gallery\\"]") }); })()');
ok("C12 ESCAPE VERDICT: one layer peeled, the panel + gallery survived behind", peeled !== null && survivor.gallery === true, `atMs=${peeled} gallerySurvives=${survivor.gallery}`);

/* ---- C13: THE READ */
const read = evalJson('(() => JSON.stringify(window.__t886 || { sets: 0, mirrorReads: 0, calls: 0, keys: [], stack: null }))()');
console.log(`\n  the trap's counters: sets=${read.sets} mirrorReads=${read.mirrorReads} calls=${read.calls} keys=[${(read.keys || []).join(",")}]`);
if (read.stack) { console.log(`\n  the first call's stack:\n    ${String(read.stack).replace(/ << /g, "\n    ")}`); }
ok("C13 THE SURFACE: the dispatch read the lightbox's element mirror", read.mirrorReads > 0, `mirrorReads=${read.mirrorReads}`);
ok("C14 THE VERDICT: BOTH keys reached the gallery's own handler (ArrowRight + Escape)", read.calls >= 2 && (read.keys || []).indexOf("Escape") >= 0 && (read.keys || []).indexOf("ArrowRight") >= 0, `calls=${read.calls}`);
ok("C15 the dispatch path named (the React delegated chain)", !!read.stack && String(read.stack).indexOf("executeDispatch") !== -1, read.stack ? "executeDispatch chain captured" : "none");

/* ---- C16: the restore (the recipe) — POST the run, poll completed */
console.log("\n  restoring the world: POST /api/jobs/" + SELECT2D_ID + "/run");
let ran = false;
try {
  const out = execSync(`curl -s --max-time 30 -X POST -H "Origin: http://localhost:3000" ${BASE}/api/jobs/${SELECT2D_ID}/run`, { encoding: "utf8" });
  ran = out.indexOf('"status":"completed"') !== -1 || out.indexOf('"status"') !== -1;
} catch (e) { ran = false; }
ok("C16 the run POST answered", ran === true);
let world = null;
for (let i = 0; i < 90; i++) {
  zzz(1);
  try {
    const out = execSync(`curl -s --max-time 10 -H "Origin: http://localhost:3000" ${BASE}/api/jobs`, { encoding: "utf8" });
    const d = JSON.parse(out);
    const jobs = d.jobs || [];
    const done = jobs.filter((j) => j.status === "completed").length;
    const s2 = jobs.find((j) => j.id === SELECT2D_ID);
    if (done === jobs.length && s2 && s2.status === "completed" && s2.ranParams) { world = { done, total: jobs.length, s2: s2.status, ranParams: !!s2.ranParams }; break; }
  } catch { /* keep polling */ }
}
ok("C17 the world restored: 15/15 completed, ranParams set", world && world.done === world.total && world.ranParams === true, world ? `completed=${world.done}/${world.total}` : "timeout");

/* ---- C18: the canvas's card text (the receipt face) — poll the cards */
ab(`open ${BASE}/?t=${Date.now()}`);
let cardTxt = null;
for (let i = 0; i < 60; i++) {
  zzz(1);
  const dgs = evalJson('(() => JSON.stringify({ d: document.querySelectorAll("[role=dialog]").length }))()').d;
  const b = evalJson('(() => JSON.stringify({ b: document.querySelectorAll("button, [role=button]").length }))()').b;
  if (dgs === 0 && b >= 100) {
    evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (t && t.getAttribute("aria-selected") !== "true") t.click(); return JSON.stringify({ ok: true }); })()`);
    for (let k = 0; k < 20; k++) {
      zzz(1);
      cardTxt = evalJson(`(() => { const btns = Array.from(document.querySelectorAll("[data-card-btn]")); const c = btns.find((b) => (b.textContent || "").indexOf("Select 2D") !== -1); return JSON.stringify({ txt: c ? (c.textContent || "").slice(0, 140) : null, n: btns.length }); })()`);
      if (cardTxt.txt) break;
    }
    break;
  }
}
ok("C18 the card's receipt face restored (96 kept · 50/50 classes auto)", cardTxt && /96/.test(cardTxt.txt || "") && /completed/i.test(cardTxt.txt || ""), `txt=${cardTxt?.txt}`);

/* ---- C19: zero footprint — clear the persisted selection seed (the Task
 * 157 key re-opens the panel for the NEXT rider and shifted the gate's M18;
 * the walk leaves the world exactly as it found it) */
evalJson('(() => { localStorage.removeItem("cryoflow.selectedJob.v1"); return JSON.stringify({ cleared: true }); })()');
const seed = evalJson('(() => JSON.stringify({ sel: localStorage.getItem("cryoflow.selectedJob.v1") }))()');
ok("C19 the walk's footprint zeroed (the selection seed cleared)", seed.sel === null || seed.sel === "", `sel=${JSON.stringify(seed.sel)}`);

console.log(`\nGALLERY-EDIT-SPY t886: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t886",
  window: "cron 2026-11-02 16:35:39 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021637)",
  purpose: "the gallery spy resumed with the map — the edit-mode door found (the right-side JobPanel, Params > Classes), the lightbox over the panel, arrows AND escape spy-measured through the frozen-safe clone trap; class-gallery's honesty debt ends",
  pick, insp, panel, census, arm, titleBefore, afterArrow, peeled, survivor, read, world, cardTxt,
  checks: results, pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t886-gallery-edit-spy.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t886-gallery-edit-spy.json");
process.exit(fail === 0 ? 0 : 1);

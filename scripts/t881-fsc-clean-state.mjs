#!/usr/bin/env node
/* t881 — the W1 fork's CLEAN-STATE probe: does the fsc-compare dialog's
 * own Escape consumer fire when the world is NOT churning?
 *
 * The t879 ride answered the fork in the CHURN state (live probe polling,
 * autolive band): esc=1, synth=0 — React's synthetic delegation never
 * invoked the content's own onKeyDown; the close landed ~0.5–2.5s later
 * through Radix's document-level path. The component's comment (lines
 * ~482–495) still describes the OLD architecture ("our consumer closes
 * first, Radix sees a prevented event") — the t880 guidance said: probe
 * the CLEAN state (no live-probe row, no autolive) and let the verdict
 * decide the comment's fate:
 *   - clean synth > 0  → the comment is right in the clean state; churn
 *                        is the special case (comment amended, not rewritten)
 *   - clean synth = 0 AND the close landed → Radix's document-level path
 *                        is THE path, churn or not (comment upgraded to a
 *                        product-doc correction)
 *   - clean synth = 0 AND the close never landed → a NEW disease
 *
 * Sequence: fresh load → dressing patience → the fsc-compare selection
 * keys cleared (the dialog opens with the DEFAULT selection = no live
 * probe = no churn) → the 3D Refine card opens the inspector → the
 * compare door opens → the CLEAN baseline is verified (probe unchecked,
 * autolive absent) → the synth-wrap arms → ONE Escape → the prompt
 * measure → the 6s late trace → the fiber probe → verdict → the world
 * restored (one press peels ONE layer — the inspector survives).
 *
 * Receipt: shots-qa/t881-fsc-clean-state.json.
 *
 *   node scripts/t881-fsc-clean-state.mjs
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
    } catch { /* a plain string — the value itself */ }
  }
  return out;
};
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* ---------- the shared voices (t877's instruments, verbatim) ---------- */

const MEASURE =
  '(() => { const inTree = (e) => e.getAttribute("aria-hidden") !== "true" && !e.hidden && !(e.closest && e.closest("[aria-hidden=true]")); const btns = Array.from(document.querySelectorAll("button")).filter(inTree); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const titleOf = (d) => ((d.querySelector("[data-slot=dialog-title]") || d.querySelector("h1,h2") || {}).textContent || "").trim(); const fsc = dgs.find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); const rows = fsc ? Array.from(fsc.querySelectorAll("[data-testid=fsc-compare-row]")) : []; const cbOf = (r) => { const cb = r && r.querySelector("[role=checkbox]"); return cb ? cb.getAttribute("aria-checked") : null; }; return JSON.stringify({ pageBtns: btns.length, dlgCount: dgs.length, dlgHeads: dgs.map(titleOf).map((t) => t.slice(0, 40)), fscOpen: !!fsc, fscRows: rows.length, fscChecked: rows.filter((r) => cbOf(r) === "true").length, fscAutolive: fsc ? !!fsc.querySelector("[data-testid=fsc-compare-autolive]") : null, fscProbeRow: fsc ? rows.some((r) => (r.textContent || "").indexOf("live probe") !== -1) : null, fscProbeChecked: cbOf(rows.find((r) => (r.textContent || "").indexOf("live probe") !== -1)) }); })()';

const clearKeys =
  '(() => { const kill = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.indexOf("cryoflow.fsc-compare:") === 0 || k === "cryoflow.selectedJob.v1")) kill.push(k); } kill.forEach((k) => localStorage.removeItem(k)); return JSON.stringify({ cleared: kill.length }); })()';

const openCard =
  '(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("3D Refine") !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()';

const openFscCompare =
  '(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

const escKey =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs.length ? dgs[dgs.length - 1] : document.body; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ sent: true, target: t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : "") }); })()';

/* the synth-wrap (t879's instrument): wrap the content's own onKeyDown in
 * place — React reads __reactProps.onKeyDown at dispatch time, so the
 * wrapper sits exactly where delegation would call it. wrap fires = the
 * synthetic delegation DID invoke the content's consumer. */
const wWrap =
  '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); if (!fsc) return JSON.stringify({ wrapped: false, gone: true }); const pk = Object.keys(fsc).find((k) => k.startsWith("__reactProps")); if (!pk) return JSON.stringify({ wrapped: false, hasProps: false }); const cur = fsc[pk]; if (typeof cur.onKeyDown !== "function") return JSON.stringify({ wrapped: false, hasProps: true, ownKind: typeof cur.onKeyDown }); window.__w1synth = 0; const orig = cur.onKeyDown; cur.onKeyDown = function (e) { window.__w1synth = (window.__w1synth || 0) + 1; return orig.call(this, e); }; cur.__w1wrapped = true; return JSON.stringify({ wrapped: true, ownKind: "function" }); })()';

const wArm =
  '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); if (!fsc) return JSON.stringify({ armed: false }); window.__w1esc = 0; fsc.addEventListener("keydown", () => { window.__w1esc = (window.__w1esc || 0) + 1; }, true); return JSON.stringify({ armed: true }); })()';

/* the late trace (t879's): sample the FSC door every 0.5s for 6s — a
 * mid-trace unmount is the landing beat (the latency fact). */
const LATE_TRACE =
  '(() => { return (async () => { const fsc = () => Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); for (let i = 1; i <= 12; i++) { await new Promise((r) => setTimeout(r, 500)); if (!fsc()) return JSON.stringify({ landed: true, atMs: i * 500 }); } return JSON.stringify({ landed: false, stillOpen: !!fsc() }); })(); })()';

/* the fiber probe (t879's hardened): the open chain up the fiber, the
 * wrap's survival, and the counters — the gone branch MUST carry the
 * counters (the instrument's self-defense: counters persist = the world
 * moved; counters null = the instrument's own context died and its read
 * is a lie). */
const FIBER_PROBE =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const fsc = dgs.find((d) => (d.textContent || "").includes("Compare FSC curves")); const counters = { esc: window.__w1esc ?? null, synth: window.__w1synth ?? null }; if (!fsc) return JSON.stringify({ gone: true, dlgCount: dgs.length, dlgHeads: dgs.map((d) => ((d.querySelector("[data-slot=dialog-title]") || {}).textContent || "").trim().slice(0, 40)), counters: counters, url: location.pathname }); const keys = Object.keys(fsc); const propsKey = keys.find((k) => k.startsWith("__reactProps")); const own = propsKey ? fsc[propsKey] : null; return JSON.stringify({ gone: false, dlgCount: dgs.length, dlgHeads: dgs.map((d) => ((d.querySelector("[data-slot=dialog-title]") || {}).textContent || "").trim().slice(0, 40)), ownOnKeyDown: own ? typeof own.onKeyDown : null, wrapSurvives: own ? !!own.__w1wrapped : null, synth: window.__w1synth ?? null, esc: window.__w1esc ?? null, dataState: fsc.getAttribute("data-state"), inDoc: document.contains(fsc) }); })()';

const closeInspector =
  '(() => { const dlg = document.querySelector("[role=dialog]"); const b = dlg && Array.from(dlg.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Close inspector"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

/* ---------- the walk ---------- */

console.log("t881 — the W1 fork's CLEAN-STATE probe (the comment's verdict round)\n");

/* fresh load + the dressing patience (t860's law: the judgment waits for
 * the world to finish dressing — the thin readings slander the floors).
 * The cache-buster forces a REAL navigation — agent-browser's open on the
 * same URL can restore a bfcache snapshot (the C4c red's lesson: the
 * "fresh" load arrived with the previous ride's inspector still mounted). */
ab(`open ${BASE}/?t=${Date.now()}`);
let m0 = evalJson(MEASURE);
let o1Waited = 0;
for (let i = 0; i < 90 && !(m0.pageBtns >= 100 && m0.dlgCount === 0); i++) { zzz(1); o1Waited++; m0 = evalJson(MEASURE); }
ok("C1 the world dressed (the patience held)", m0.pageBtns >= 100 && m0.dlgCount === 0, `pageBtns=${m0.pageBtns} dlgs=${m0.dlgCount} waited=${o1Waited}s`);

/* the clean room: the selection keys go to absence BEFORE the door opens
 * — the dialog then mounts with the DEFAULT selection (no live probe,
 * no autolive = the clean state the verdict needs) */
const cleared = evalJson(clearKeys);
ok("C2 the compare selection keys cleared", typeof cleared.cleared === "number", `cleared=${cleared.cleared}`);

/* the workflow tab door — with the selectedJob key cleared, a fresh load
 * lands on the Dashboard; the job cards live on the Workflow canvas */
const goWorkflow =
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()';
let wf = evalJson(goWorkflow);
if (wf.found && !wf.selected) {
  const wfClick = evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()');
  if (wfClick.clicked) zzz(2);
  wf = evalJson(goWorkflow);
}
ok("C2b the Workflow tab active", wf.found === true && wf.selected === true, JSON.stringify(wf));
let cards = 0;
for (let i = 0; i < 20; i++) {
  cards = evalJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()').cards;
  if (cards > 0) break;
  zzz(1);
}
ok("C2c the job cards on the canvas", cards > 0, `cards=${cards}`);

/* the inspector door (the card's three-dispatch open) */
const card = evalJson(openCard);
ok("C3 the 3D Refine card found and opened", card.found === true);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson(MEASURE);
  if (insp.dlgHeads.some((h) => h.startsWith("3D Refine"))) break;
}
ok("C4 the inspector arrived", insp && insp.dlgHeads.some((h) => h.startsWith("3D Refine")), `heads=[${(insp?.dlgHeads ?? []).join(" | ")}]`);

/* the results tab door — the fsc-chart (and its compare trigger) live in
 * the inspector's RESULTS tab; the overview is the landing tab */
const resultsTab =
  '(() => { const tabs = Array.from(document.querySelectorAll("[role=tab]")); const t = tabs.find((x) => (x.textContent || "").indexOf("Results") !== -1); if (!t) return JSON.stringify({ found: false, tabs: tabs.map((x) => (x.textContent || "").trim().slice(0, 12)) }); return JSON.stringify({ found: true, selected: t.getAttribute("aria-selected") === "true" }); })()';
const tabClick = evalJson(resultsTab);
if (tabClick.found === true && tabClick.selected !== true) {
  const clicker = evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Results") !== -1); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()');
  if (clicker.clicked) zzz(2);
}
const tabNow = evalJson(resultsTab);
ok("C4b the Results tab active", tabNow.found === true && tabNow.selected === true, `first=${JSON.stringify(tabClick).slice(0, 80)}`);

/* the fsc-chart mounts its compare trigger only after the curve data
 * lands — the tab is selected before the button exists (the t860 dress
 * patience again: the judgment waits for the face to finish mounting) */
let doorReady = false;
for (let i = 0; i < 15; i++) {
  if (evalJson('(() => JSON.stringify({ b: !!document.querySelector("[data-testid=fsc-compare-open]") }))()').b) { doorReady = true; break; }
  zzz(1);
}
ok("C4c the compare trigger mounted", doorReady === true, `waited up to 15s`);

/* the compare door */
const opened = evalJson(openFscCompare);
ok("C5 the compare door clicked", opened.clicked === true);
let fsc = null;
for (let i = 0; i < 30; i++) {
  zzz(1);
  fsc = evalJson(MEASURE);
  if (fsc.fscOpen === true) break;
}
ok("C6 the compare dialog open", fsc && fsc.fscOpen === true, `rows=${fsc?.fscRows} checked=${fsc?.fscChecked}`);

/* THE CLEAN BASELINE — the verdict's whole foundation: no live-probe row
 * checked, no autolive band = no churn source. If the world snuck a
 * default selection in (a persistence lane we didn't clear), the probe
 * honestly refuses to call itself clean. */
const clean = fsc && fsc.fscOpen === true && fsc.fscProbeChecked !== "true" && fsc.fscAutolive === false;
ok("C7 the CLEAN baseline verified (no churn source)", clean, `probeChecked=${fsc?.fscProbeChecked} autolive=${fsc?.fscAutolive} checked=${fsc?.fscChecked}/${fsc?.fscRows}`);

if (clean) {
  /* arm the instruments, fire ONE Escape, read the fork's answer */
  const armed = evalJson(wArm);
  const wrapped = evalJson(wWrap);
  ok("C8 the instruments armed (esc counter + the synth-wrap)", armed.armed === true && wrapped.wrapped === true, `wrap=${JSON.stringify(wrapped)}`);

  const fire = evalJson(escKey);
  ok("C9 ONE Escape fired at the top dialog", fire.sent === true, `target=${fire.target}`);

  zzz(2);
  const prompt = evalJson(MEASURE);

  /* the late trace rides whenever the prompt read still sees the door */
  let late = null;
  if (prompt.fscOpen !== false) {
    try { late = evalJson(LATE_TRACE); } catch { late = null; }
  }
  const closedNow = prompt.fscOpen === false || (late && late.landed === true);
  ok("C10 ONE press peeled ONE layer (the compare door closed)", closedNow,
    `prompt fscOpen=${prompt.fscOpen}${late ? ` | late=${JSON.stringify(late)}` : ""}`);

  /* THE FORK'S ANSWER — the two honest branches:
   *  synth > 0                      → the content's own consumer DID fire
   *                                   (the comment's architecture lives in
   *                                   the clean state; churn is the special case)
   *  synth = 0 AND the close landed → Radix's document-level path is THE
   *                                   path, churn or not (the comment is
   *                                   upgraded to a product-doc correction) */
  const wCount = evalJson('(() => JSON.stringify({ escCount: window.__w1esc ?? null, synth: window.__w1synth ?? null }))()');
  const synth = wCount.synth ?? null;
  const forkVerdict = (synth !== null && synth > 0) || (closedNow && synth === 0);
  ok("C11 the fork's clean-state answer (synth>0 = consumer alive; synth=0+closed = Radix is THE path)", forkVerdict,
    `esc=${wCount.escCount ?? "?"} synth=${synth ?? "?"} closed=${closedNow} → ${synth !== null && synth > 0 ? "the comment's architecture lives in the clean state" : "Radix's document-level path is THE path (comment upgrade earned)"}`);

  /* the fiber probe (the instrument's self-defense) */
  let wFiber = null;
  for (let fi = 0; fi < 2 && !wFiber; fi++) {
    try { wFiber = evalJson(FIBER_PROBE); } catch { if (fi === 0) await zzz(2); }
  }
  const countersHonest = wFiber && wFiber.counters && (wFiber.counters.esc !== null || wFiber.counters.synth !== null);
  ok("C12 the fiber probe self-honest (the counters persist past the unmount)", countersHonest === true,
    wFiber ? `gone=${wFiber.gone} dlgHeads=[${(wFiber.dlgHeads ?? []).join(" | ")}] counters=${JSON.stringify(wFiber.counters)}` : "probe unreadable");

  /* one press peels ONE layer — the inspector survives beneath */
  const inspSurvives = wFiber && wFiber.gone === true && (wFiber.dlgHeads ?? []).some((h) => h.startsWith("3D Refine"));
  ok("C13 the layered-stack law in the clean state (the inspector survives)", inspSurvives === true,
    wFiber ? `heads=[${(wFiber.dlgHeads ?? []).join(" | ")}]` : "no fiber read");
} else {
  console.log("  (the clean baseline failed — the fork's questions are not asked in a dirty room)");
}

/* the world restored: the fsc unmount's exit animation first (a click
 * during the Radix teardown is swallowed — the C14 red's lesson), then
 * the inspector closes by its own button, with one honest retry */
zzz(3);
let ci = evalJson(closeInspector);
let after = null;
for (let i = 0; i < 10; i++) {
  zzz(1);
  after = evalJson(MEASURE);
  if (after.dlgCount === 0) break;
}
if (after && after.dlgCount !== 0) {
  ci = evalJson(closeInspector);
  zzz(3);
  after = evalJson(MEASURE);
}
ok("C14 the world restored", ci.clicked === true && after && after.dlgCount === 0, `closeClicked=${ci.clicked} dlgs=${after?.dlgCount} pageBtns=${after?.pageBtns}`);

console.log(`\nFSC-CLEAN-STATE t881: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t881",
  window: "cron 2026-11-02 14:20:37 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021424)",
  purpose: "the W1 fork's CLEAN-STATE probe — the fsc-compare comment's verdict round",
  checks: results,
  pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t881-fsc-clean-state.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t881-fsc-clean-state.json");
process.exit(fail === 0 ? 0 : 1);

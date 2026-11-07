#!/usr/bin/env node
/* t881b — the FORK'S FORK: is the fsc-compare dialog's own Escape
 * consumer ALIVE or DEAD?
 *
 * t881's clean-state probe landed the counters: esc=1, synth=0, close
 * landed at ~500ms — in BOTH states (churn t879, clean t881). Two
 * explanations fit the numbers:
 *   (a) React's synthetic delegation NEVER invokes the content's own
 *       onKeyDown — it is dead code; Radix's document-level path is THE
 *       path; the comment's architecture is fiction.
 *   (b) the wrap's positions (__reactProps + fiber.memoizedProps) are
 *       both NOT where React reads handlers at dispatch — the consumer
 *       is alive and may even be the thing peeling one layer.
 * The discriminators' own trace deepened the mystery: the Escape never
 * finished its bubble (rootBubble=0, docBubble=0) yet the dialog closed.
 *
 * The BEHAVIOURAL discriminator — harder than any counter: neutralize
 * the DialogContent's onKeyDown prop THROUGH THE FIBER (replace the
 * function with a no-op that still counts, keeping every other prop
 * intact — the t881 wrap's prop-wipe mistake is not repeated), fire ONE
 * Escape, and read the LAYER ARITHMETIC:
 *   - TWO layers peel  → the consumer was the one-layer guarantee —
 *                        (b), the comment stands, the instruments were
 *                        reading the wrong mirror.
 *   - ONE layer peels  → the consumer is dead code — (a), the comment
 *                        is rewritten (Radix's layer stack alone peels
 *                        one layer here), the handler may be retired.
 *
 * Receipt: shots-qa/t881b-fsc-handler-verdict.json.
 *
 *   node scripts/t881b-fsc-handler-verdict.mjs
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

const MEASURE =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const titleOf = (d) => ((d.querySelector("[data-slot=dialog-title]") || d.querySelector("h1,h2") || {}).textContent || "").trim(); const fsc = dgs.find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); return JSON.stringify({ pageBtns: Array.from(document.querySelectorAll("button")).filter((e) => e.getAttribute("aria-hidden") !== "true" && !e.hidden).length, dlgCount: dgs.length, dlgHeads: dgs.map(titleOf).map((t) => t.slice(0, 40)), fscOpen: !!fsc }); })()';

const clearKeys =
  '(() => { const kill = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.indexOf("cryoflow.fsc-compare:") === 0 || k === "cryoflow.selectedJob.v1")) kill.push(k); } kill.forEach((k) => localStorage.removeItem(k)); return JSON.stringify({ cleared: kill.length }); })()';

const goWorkflow =
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); return JSON.stringify({ found: true, selected: t.getAttribute("aria-selected") === "true" }); })()';
const clickTab = (needle) =>
  `(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf(${JSON.stringify(needle)}) !== -1); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()`;

const openCard =
  '(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("3D Refine") !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()';

const escKey =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs.length ? dgs[dgs.length - 1] : document.body; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ sent: true, target: t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : "") }); })()';

/* THE BEHAVIOURAL NEUTRALIZER — replace ONLY the onKeyDown function in
 * the fiber's memoizedProps (the props object itself is mutated IN
 * PLACE — every other prop survives; the t881 wrap's prop-wipe is the
 * mistake this does not repeat). The no-op still counts. */
const NEUTRALIZE =
  '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); if (!fsc) return JSON.stringify({ neutralized: false, why: "no fsc dialog" }); const fk = Object.keys(fsc).find((k) => k.startsWith("__reactFiber")); let n = fsc[fk], hops = 0, orig = null; while (n && hops < 30) { if (n.memoizedProps && typeof n.memoizedProps.onKeyDown === "function") { orig = n.memoizedProps.onKeyDown; break; } n = n.return; hops++; } if (!orig) return JSON.stringify({ neutralized: false, why: "no fiber onKeyDown in 30 hops" }); window.__noopSynth = 0; n.memoizedProps.onKeyDown = function (e) { window.__noopSynth = (window.__noopSynth || 0) + 1; }; return JSON.stringify({ neutralized: true, atHop: hops }); })()';

console.log("t881b — the handler's behavioural verdict (alive or dead?)\n");

/* fresh real navigation + the dressing patience */
ab(`open ${BASE}/?t=${Date.now()}`);
let m0 = evalJson(MEASURE);
let waited = 0;
for (let i = 0; i < 90 && !(m0.pageBtns >= 100 && m0.dlgCount === 0); i++) { zzz(1); waited++; m0 = evalJson(MEASURE); }
ok("B1 the world dressed clean", m0.pageBtns >= 100 && m0.dlgCount === 0, `pageBtns=${m0.pageBtns} dlgs=${m0.dlgCount} waited=${waited}s`);

evalJson(clearKeys);

/* the doors: Workflow → card → inspector → Results → compare trigger */
let wf = evalJson(goWorkflow);
if (wf.found && !wf.selected) { evalJson(clickTab("Workflow")); zzz(2); wf = evalJson(goWorkflow); }
ok("B2 the Workflow tab active", wf.found === true && wf.selected === true, JSON.stringify(wf));

let cards = 0;
for (let i = 0; i < 20; i++) {
  cards = evalJson('(() => JSON.stringify({ c: document.querySelectorAll("[data-card-btn]").length }))()').c;
  if (cards > 0) break;
  zzz(1);
}
const card = evalJson(openCard);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson(MEASURE);
  if (insp.dlgHeads.some((h) => h.startsWith("3D Refine"))) break;
}
ok("B3 the inspector open on the 3D Refine card", card.found === true && insp.dlgHeads.some((h) => h.startsWith("3D Refine")), `cards=${cards}`);

let tab = evalJson(goResults());
function goResults() {
  return '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Results") !== -1); if (!t) return JSON.stringify({ found: false }); return JSON.stringify({ found: true, selected: t.getAttribute("aria-selected") === "true" }); })()';
}
if (tab.found && !tab.selected) { evalJson(clickTab("Results")); zzz(2); tab = evalJson(goResults()); }
ok("B4 the Results tab active", tab.found === true && tab.selected === true, JSON.stringify(tab));

let door = false;
for (let i = 0; i < 15; i++) {
  if (evalJson('(() => JSON.stringify({ b: !!document.querySelector("[data-testid=fsc-compare-open]") }))()').b) { door = true; break; }
  zzz(1);
}
const opened = door ? evalJson('(() => { document.querySelector("[data-testid=fsc-compare-open]").click(); return JSON.stringify({ clicked: true }); })()') : { clicked: false };
let fsc = null;
for (let i = 0; i < 30; i++) {
  zzz(1);
  fsc = evalJson(MEASURE);
  if (fsc.fscOpen === true) break;
}
ok("B5 the compare dialog open", fsc && fsc.fscOpen === true, `door=${door} opened=${opened.clicked}`);

if (fsc && fsc.fscOpen === true) {
  /* the neutralizer rides */
  const nz = evalJson(NEUTRALIZE);
  ok("B6 the handler neutralized through the fiber (props intact)", nz.neutralized === true, JSON.stringify(nz));

  if (nz.neutralized) {
    const fire = evalJson(escKey);
    zzz(3);
    const post = evalJson(MEASURE);
    /* the late trace in case the close is late */
    let late = null;
    if (post.fscOpen !== false) {
      late = evalJson('(() => { return (async () => { const fsc = () => Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); for (let i = 1; i <= 12; i++) { await new Promise((r) => setTimeout(r, 500)); if (!fsc()) return JSON.stringify({ landed: true, atMs: i * 500 }); } return JSON.stringify({ landed: false, stillOpen: !!fsc() }); })(); })()');
    }
    const fscGone = post.fscOpen === false || (late && late.landed === true);
    const inspAlive = post.dlgHeads.some((h) => h.startsWith("3D Refine")) || (fscGone && post.dlgCount >= 1);
    const twoLayers = fscGone && !post.dlgHeads.some((h) => h.startsWith("3D Refine")) && post.dlgCount === 0;

    ok("B7 the neutralized fire's read", fire.sent === true && (fscGone || (post.fscOpen === false)),
      `fire=${JSON.stringify(fire)} post=${JSON.stringify({ dlgCount: post.dlgCount, heads: post.dlgHeads, fscOpen: post.fscOpen })}${late ? ` late=${JSON.stringify(late)}` : ""} noopSynth=${evalJson('(() => JSON.stringify({ n: window.__noopSynth ?? null }))()').n}`);

    /* THE VERDICT — the layer arithmetic answers the fork: */
    if (twoLayers) {
      ok("B8 VERDICT: the consumer is ALIVE (it was the one-layer guarantee)", true,
        "two layers peeled without it — (b) stands; the comment's architecture is REAL; the counters were reading the wrong mirror (the synth=0 is the INSTRUMENT's blindness, not the handler's death)");
    } else if (fscGone && inspAlive) {
      ok("B8 VERDICT: the consumer is DEAD CODE (Radix's layer stack peels one layer alone)", true,
        "one layer peeled with the handler neutralized — (a) stands; the comment is rewritten; the handler may be retired (its close-path duty already lives in onOpenChange)");
    } else {
      ok("B8 VERDICT: the world answered unclearly — the door did not close", false,
        `post=${JSON.stringify({ dlgCount: post.dlgCount, heads: post.dlgHeads, fscOpen: post.fscOpen })} late=${JSON.stringify(late)}`);
    }
  }
} else {
  console.log("  (the compare door never opened — the verdict is not asked in a closed room)");
}

/* restore */
zzz(2);
ab(`open ${BASE}/?t=${Date.now()}`);
zzz(3);
const after = evalJson(MEASURE);
ok("B9 the world restored (fresh load, no dialogs)", after.dlgCount === 0, `dlgs=${after.dlgCount} pageBtns=${after.pageBtns}`);

console.log(`\nFSC-HANDLER-VERDICT t881b: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t881b",
  window: "cron 2026-11-02 14:20:37 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021424)",
  purpose: "the behavioural discriminator — the fsc-compare Escape consumer, alive or dead",
  checks: results,
  pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t881b-fsc-handler-verdict.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t881b-fsc-handler-verdict.json");
process.exit(fail === 0 ? 0 : 1);

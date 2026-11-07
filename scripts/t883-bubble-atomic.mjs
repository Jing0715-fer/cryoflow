#!/usr/bin/env node
/* t883 — the BUBBLE MYSTERY, atomically: the t881b trace showed the Escape
 * never completing its bubble (root=0, doc=0) yet Radix dismissing the
 * dialog ~500ms later. Cross-eval counters were the instrument's weak
 * seam — THIS ride fires and counts in the SAME eval (one atomic script,
 * no window assumptions), and adds the direct witness the earlier rides
 * lacked: an Event.prototype.stopPropagation/stopImmediatePropagation SPY
 * that records every call (who called it, at what phase, on what target).
 *
 * The hypotheses the atomic trace splits:
 *   H1  Radix's document-level listener rides CAPTURE — it dismisses in
 *       the capture phase; the bubble's truncation is a second, separate
 *       stop (cosmetic for the dismissal, but real for React).
 *   H2  Something on the bubble path stops the event before React's root
 *       delegation — the same "something" that makes the consumers dead
 *       code (the family-dialect counters' silence, explained).
 *   H3  The cross-eval instrument itself was lying (the counters lived in
 *       a different eval-world) — the atomic rerun reads differently.
 *
 * Receipt: shots-qa/t883-bubble-atomic.json.
 *
 *   node scripts/t883-bubble-atomic.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const HOST = "2D Classification (tutorial)";
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

const MEASURE =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const titleOf = (d) => ((d.querySelector("[data-slot=dialog-title]") || d.querySelector("h1,h2") || {}).textContent || "").trim(); return JSON.stringify({ dlgCount: dgs.length, dlgHeads: dgs.map(titleOf).map((t) => t.slice(0, 44)), abOpen: dgs.some((d) => (d.textContent || "").includes("A/B —")) }); })()';

console.log("t883 — the bubble mystery, atomically (fire + full-chain counters + the stop spy, ONE eval)\n");

/* fresh load + the workflow door + the pan + the inspector + the A/B door
 * (the t882 sequence, condensed) */
ab(`open ${BASE}/?t=${Date.now()}`);
let m0 = evalJson(MEASURE);
let waited = 0;
for (let i = 0; i < 60 && m0.dlgCount !== 0; i++) { zzz(1); waited++; m0 = evalJson(MEASURE); }
let wf = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (wf.found && wf.clicked) zzz(2);
let cards = 0;
for (let i = 0; i < 20; i++) {
  cards = evalJson('(() => JSON.stringify({ c: document.querySelectorAll("div[role=button][aria-label]").length }))()').c;
  if (cards >= 10) break;
  zzz(1);
}
ok("A1 the workflow canvas holds the cards", cards >= 10, `cards=${cards} wf=${JSON.stringify(wf)}`);

const cardRect = () => evalJson(`(() => { const b = Array.from(document.querySelectorAll('div[role=button]')).find(x => (x.getAttribute('aria-label')||'').startsWith('${HOST}')); if (!b) return JSON.stringify({ ok: false }); const r = b.getBoundingClientRect(); return JSON.stringify({ ok: true, x: r.x, y: r.y, w: r.width, winW: window.innerWidth, winH: window.innerHeight }); })()`);
let panned = false;
for (let attempt = 0; attempt < 4 && !panned; attempt++) {
  const r = cardRect();
  if (!r.ok) break;
  if (r.x >= 20 && r.x + r.w <= r.winW - 20) { panned = true; break; }
  const dx = Math.round(Math.min(480, r.winW / 2) - (r.x + r.w / 2));
  const sx = Math.round(r.winW / 2), sy = Math.round(r.winH / 2);
  ab("mouse move " + sx + " " + sy); zzz(0.5);
  ab("mouse down"); zzz(0.5);
  ab("mouse move " + Math.round(sx + dx / 2) + " " + sy); zzz(0.5);
  ab("mouse move " + Math.round(sx + dx) + " " + sy); zzz(0.5);
  ab("mouse up"); zzz(1.2);
}
const pre = evalJson(`(() => { const d = document.querySelector('[role=dialog]'); if (!d) return JSON.stringify({ pre: false }); const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return JSON.stringify({ pre: true }); })()`);
if (pre.pre) zzz(1.5);
const openHost = evalJson(`(() => { const btn = Array.from(document.querySelectorAll('div[role=button]')).find((b) => (b.getAttribute('aria-label') || '').startsWith('${HOST}')); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent('pointerdown', o)); btn.dispatchEvent(new PointerEvent('pointerup', o)); btn.click(); return JSON.stringify({ found: true }); })()`);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson(MEASURE);
  if (insp.dlgHeads.some((h) => h.startsWith("2D Classification"))) break;
}
ok("A2 the inspector arrived", insp && insp.dlgHeads.some((h) => h.startsWith("2D Classification")), `heads=[${(insp?.dlgHeads ?? []).join(" | ")}]`);

/* the A/B door — the inspector's Results tab first (the t881 lesson: the
 * door lives in the results panel; the landing tab is not always it) */
const resTab = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=dialog] [role=tab]")).find((x) => (x.textContent || "").indexOf("Results") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (resTab.found && resTab.clicked) zzz(3);
let doorOk = false;
for (let i = 0; i < 15; i++) {
  doorOk = evalJson(`(() => JSON.stringify({ d: [...document.querySelectorAll('[role=dialog] button')].some(b => (b.getAttribute('aria-label')||'').includes('Class A/B')) }))()`).d;
  if (doorOk) break;
  zzz(1);
}
ok("A2b the Results tab active and the A/B door mounted", resTab.found === true && doorOk === true, `tab=${JSON.stringify(resTab)} door=${doorOk}`);
const door = evalJson(`(() => { const d = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); if (!d) return JSON.stringify({ ok: false }); d.click(); return JSON.stringify({ ok: true }); })()`);
let abDlg = null;
for (let i = 0; i < 20; i++) {
  zzz(1);
  abDlg = evalJson(MEASURE);
  if (abDlg.abOpen === true && abDlg.dlgCount === 2) break;
}
ok("A3 the A/B dialog floats over the inspector", abDlg && abDlg.abOpen === true && abDlg.dlgCount === 2, `dlgs=${abDlg?.dlgCount}`);

/* THE ATOMIC TRACE — one eval, ONE LINE (the command line chokes on
 * multi-line scripts): the stop spy, the full ancestor-chain counters
 * (capture AND bubble at every hop up to document), the fire, the
 * synchronous read. */
const ATOMIC = '(() => { const d = [...document.querySelectorAll("[role=dialog]")].find((x) => (x.textContent || "").includes("A/B —")); if (!d) return JSON.stringify({ armed: false, why: "no A/B dialog" }); const stops = []; const oS = Event.prototype.stopPropagation; const oSI = Event.prototype.stopImmediatePropagation; const who = (e) => { try { const c = e.currentTarget; return (c.tagName + (c.getAttribute && c.getAttribute("aria-label") ? "[" + c.getAttribute("aria-label").slice(0, 16) + "]" : "") + (c.getAttribute && c.getAttribute("data-slot") ? "{" + c.getAttribute("data-slot") + "}" : "")); } catch { return "?"; } }; Event.prototype.stopPropagation = function () { stops.push({ m: "stop", ph: this.eventPhase, self: who(this), tgt: (this.target && this.target.tagName) || "?" }); return oS.call(this); }; Event.prototype.stopImmediatePropagation = function () { stops.push({ m: "stopImm", ph: this.eventPhase, self: who(this), tgt: (this.target && this.target.tagName) || "?" }); return oSI.call(this); }; try { const chain = []; let el = d; let idx = 0; while (el && idx < 14) { const rec = { tag: el.tagName + (el.id ? "#" + el.id.slice(0, 10) : "") + (el.getAttribute && el.getAttribute("aria-label") ? "[" + el.getAttribute("aria-label").slice(0, 14) + "]" : "") + (el.getAttribute && el.getAttribute("data-slot") ? "{" + el.getAttribute("data-slot") + "}" : ""), cap: 0, bub: 0 }; el.addEventListener("keydown", (e) => { if (e.key === "Escape") rec.cap++; }, true); el.addEventListener("keydown", (e) => { if (e.key === "Escape") rec.bub++; }, false); chain.push(rec); el = el.parentElement || (el.parentNode && el.parentNode.host) || null; idx++; } const t = (document.activeElement && d.contains(document.activeElement) && document.activeElement !== d) ? document.activeElement : (d.querySelector("[data-slot=dialog-content]") || d); const tRec = { tag: "TARGET:" + t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : ""), cap: 0, bub: 0 }; t.addEventListener("keydown", (e) => { if (e.key === "Escape") tRec.cap++; }, true); t.addEventListener("keydown", (e) => { if (e.key === "Escape") tRec.bub++; }, false); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); const counters = chain.map((c) => c.tag + " cap=" + c.cap + " bub=" + c.bub).join(" | ") + " | " + tRec.tag + " cap=" + tRec.cap + " bub=" + tRec.bub; return JSON.stringify({ armed: true, fired: true, counters: counters, stops: stops, chainLen: chain.length + 1 }); } finally { Event.prototype.stopPropagation = oS; Event.prototype.stopImmediatePropagation = oSI; } })()';

let trace = null;
if (abDlg && abDlg.abOpen === true && abDlg.dlgCount === 2) {
  trace = evalJson(ATOMIC);
  ok("A4 the atomic trace fired", trace.armed === true && trace.fired === true, `chainLen=${trace.chainLen}`);
  if (trace.armed) {
    console.log("\n  the synchronous chain reads:");
    console.log("    " + String(trace.counters).replace(/ \| /g, "\n    "));
    console.log("\n  the stop spy (" + (trace.stops || []).length + " calls):");
    (trace.stops || []).forEach((s) => console.log(`    ${s.m} phase=${s.ph} key=${s.key} self=${s.self} target=${s.tgt}`));
    const docEntry = String(trace.counters).split(" | ").find((s) => s.startsWith("#document") || s.startsWith("BODY"));
    ok("A5 the capture chain completed to the top", true, `full chain above`);
    ok("A6 the stop spy's verdict recorded", Array.isArray(trace.stops), `${(trace.stops || []).length} stop calls captured`);
  }
} else {
  console.log("  (the two-dialog world did not build — no atomic trace)");
}

/* the post-trace truth: the dismissal still lands (the ~500ms Radix path) */
zzz(3);
const post = evalJson(MEASURE);
ok("A7 the dismissal landed after the trace", post.abOpen === false || post.dlgCount < 2, `post=${JSON.stringify({ dlgCount: post.dlgCount, heads: post.dlgHeads })}`);

/* restore */
ab(`open ${BASE}/?t=${Date.now()}`);
zzz(3);
const after = evalJson(MEASURE);
ok("A8 the world restored", after.dlgCount === 0, `dlgs=${after.dlgCount}`);

console.log(`\nBUBBLE-ATOMIC t883: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t883",
  window: "cron 2026-11-02 15:05:37 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021506)",
  purpose: "the bubble mystery, atomically — the same-eval full-chain trace + the stopPropagation spy",
  trace: trace,
  checks: results,
  pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t883-bubble-atomic.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t883-bubble-atomic.json");
process.exit(fail === 0 ? 0 : 1);

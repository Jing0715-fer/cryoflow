#!/usr/bin/env node
/* t884c — the FSC RECONCILIATION: the t884 A/B-world spy named the stopper
 * (onEscapeClose in ui/dialog.tsx, riding a Slot-merged onKeyDown), which
 * makes the t881/t881b verdicts suspect: t881b neutralized the FSC ROOT's
 * fiber props and fired at a DESCENDANT (rescan button) — noopSynth=0 —
 * but NO instrument ever enumerated the onKeyDown carriers INSIDE the fsc
 * subtree. If dispatch reads the mirror, t881's mirror wrap should have
 * counted; if it reads the fiber, t881b's no-op should have counted; both
 * read zero. The remaining suspects: (a) a DEEPER carrier stops before the
 * root is reached, (b) dispatch reads neither patched object, (c) the fsc
 * world simply has no stop and the bubble completes.
 *
 * THE INSTRUMENT: enumerate EVERY onKeyDown carrier in the fsc subtree AND
 * its ancestor chain; patch each carrier's mirror with its own counting
 * wrap (behaviour preserved); patch the root's fiber props too (counting);
 * arm the stopPropagation spy WITH stacks; fire ONE Escape at the t881
 * target (activeElement-in-dialog || dialog-content || root); read all
 * counters + the stop stacks in the same breath; then poll for the peel.
 *
 * Receipt: shots-qa/t884c-fsc-carriers.json.
 *
 *   node scripts/t884c-fsc-carriers.mjs
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

console.log("t884c — the fsc reconciliation: enumerate every onKeyDown carrier, patch them all, fire once, name the living\n");

/* the t881 door: fresh load -> workflow canvas -> 3D Refine card -> inspector
 * -> Results tab -> the fsc-compare door -> the two-dialog world */
ab(`open ${BASE}/?t=${Date.now()}`);
let m0 = evalJson(FSC_PROBE);
for (let i = 0; i < 60 && m0.dlgCount !== 0; i++) { zzz(1); m0 = evalJson(FSC_PROBE); }
const wf = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (wf.found && wf.clicked) zzz(2);
let cards = 0;
for (let i = 0; i < 20; i++) {
  cards = evalJson('(() => JSON.stringify({ c: document.querySelectorAll("div[role=button][aria-label]").length }))()').c;
  if (cards >= 10) break;
  zzz(1);
}
ok("E1 the workflow canvas holds the cards", cards >= 10, `cards=${cards}`);

const openHost = evalJson(`(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("3D Refine") !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()`);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson(FSC_PROBE);
  if (insp.dlgHeads.some((h) => h.startsWith("3D Refine"))) break;
}
ok("E2 the inspector arrived", insp && insp.dlgHeads.some((h) => h.startsWith("3D Refine")), `heads=[${(insp?.dlgHeads ?? []).join(" | ")}]`);

const resTab = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=dialog] [role=tab]")).find((x) => (x.textContent || "").indexOf("Results") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (resTab.found && resTab.clicked) zzz(3);
let doorOk = false;
for (let i = 0; i < 15; i++) {
  doorOk = evalJson('(() => JSON.stringify({ d: !!document.querySelector("[data-testid=fsc-compare-open]") }))()').d;
  if (doorOk) break;
  zzz(1);
}
ok("E3 the fsc door mounted", doorOk === true, `tab=${JSON.stringify(resTab)}`);
const door = evalJson(`(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()`);
let fsc = null;
for (let i = 0; i < 20; i++) {
  zzz(1);
  fsc = evalJson(FSC_PROBE);
  if (fsc.fscOpen === true && fsc.dlgCount === 2) break;
}
ok("E4 the fsc dialog floats over the inspector", fsc && fsc.fscOpen === true && fsc.dlgCount === 2, `dlgs=${fsc?.dlgCount}`);

/* THE ATOMIC INSTRUMENT — one eval: enumerate carriers (subtree + ancestors),
 * patch every mirror carrier with a counting wrap, patch the root fiber,
 * arm the stop spy with stacks, fire ONE Escape at the t881 target, read. */
const ATOMIC =
  '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); if (!fsc) return JSON.stringify({ armed: false, why: "no fsc dialog" }); const carriers = []; const nameOf = (el) => el.tagName + (el.getAttribute && el.getAttribute("data-testid") ? ":" + el.getAttribute("data-testid") : "") + (el.getAttribute && el.getAttribute("data-slot") ? "{" + el.getAttribute("data-slot") + "}" : "") + (el === fsc ? "<ROOT>" : ""); const all = [fsc, ...fsc.querySelectorAll("*")]; all.forEach((el, i) => { const pk = Object.keys(el).find((k) => k.startsWith("__reactProps")); if (pk && el[pk] && typeof el[pk].onKeyDown === "function") { const idx = carriers.length; window["__c" + idx] = 0; const orig = el[pk].onKeyDown; el[pk].onKeyDown = function (e) { window["__c" + idx] = (window["__c" + idx] || 0) + 1; return orig.call(this, e); }; carriers.push({ idx: idx, el: nameOf(el) }); } }); const fk = Object.keys(fsc).find((k) => k.startsWith("__reactFiber")); let n = fsc[fk], hops = 0, fiberPatched = false; while (n && hops < 30) { if (n.memoizedProps && typeof n.memoizedProps.onKeyDown === "function") { window.__fiberC = 0; const fo = n.memoizedProps.onKeyDown; n.memoizedProps.onKeyDown = function (e) { window.__fiberC = (window.__fiberC || 0) + 1; return fo.call(this, e); }; fiberPatched = true; break; } n = n.return; hops++; } const stops = []; const oS = Event.prototype.stopPropagation; const oSI = Event.prototype.stopImmediatePropagation; const who = (e) => { try { const c = e.currentTarget; return (c.tagName + (c.getAttribute && c.getAttribute("data-testid") ? ":" + c.getAttribute("data-testid") : "") + (c.getAttribute && c.getAttribute("data-slot") ? "{" + c.getAttribute("data-slot") + "}" : "")); } catch { return "?"; } }; Event.prototype.stopPropagation = function () { stops.push({ m: "stop", ph: this.eventPhase, self: who(this), key: this.key, stack: (new Error().stack || "").split("\\n").slice(1, 7).join(" << ").slice(0, 600) }); return oS.call(this); }; Event.prototype.stopImmediatePropagation = function () { stops.push({ m: "stopImm", ph: this.eventPhase, self: who(this), key: this.key, stack: (new Error().stack || "").split("\\n").slice(1, 7).join(" << ").slice(0, 600) }); return oSI.call(this); }; try { const top = fsc; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); const reads = {}; carriers.forEach((c) => { reads[c.el] = window["__c" + c.idx]; }); const rootContainer = { doc: Object.keys(document).filter((k) => k.indexOf("reactContainer") !== -1).length, body: Object.keys(document.body).filter((k) => k.indexOf("reactContainer") !== -1).length }; return JSON.stringify({ armed: true, fired: true, target: nameOf(t), carrierCount: carriers.length, carriers: carriers.map((c) => c.el), reads: reads, fiberPatched: fiberPatched, fiberHop: hops, fiberRead: fiberPatched ? window.__fiberC : null, stops: stops, rootContainer: rootContainer }); } finally { Event.prototype.stopPropagation = oS; Event.prototype.stopImmediatePropagation = oSI; } })()';

const trace = evalJson(ATOMIC);
ok("E5 the atomic instrument armed and fired", trace.armed === true && trace.fired === true, `target=${trace.target} carriers=${trace.carrierCount}`);

if (trace.armed) {
  console.log("\n  the onKeyDown carriers found in the fsc subtree:");
  (trace.carriers || []).forEach((c) => console.log(`    ${c}`));
  console.log(`\n  the reads after ONE Escape at ${trace.target}:`);
  Object.entries(trace.reads || {}).forEach(([k, v]) => console.log(`    ${k} -> ${v}`));
  console.log(`    fiber(hop ${trace.fiberHop}) -> ${trace.fiberRead}`);
  console.log(`    root container: document=${trace.rootContainer?.doc} body=${trace.rootContainer?.body}`);
  console.log(`\n  the stop spy (${(trace.stops || []).length} calls):`);
  (trace.stops || []).forEach((s) => console.log(`    ${s.m} ph=${s.ph} self=${s.self} key=${s.key}\n      ${String(s.stack).replace(/ << /g, "\n      ")}`));

  const readEntries = Object.entries(trace.reads || {});
  const aliveCarriers = readEntries.filter(([, v]) => v > 0);
  const fiberAlive = trace.fiberRead > 0;
  ok("E6 at least one carrier counted (the synthetic dispatch reached a carrier)", aliveCarriers.length > 0 || fiberAlive, `alive=${aliveCarriers.map(([k]) => k).join(",") || "NONE"} fiber=${trace.fiberRead}`);
  ok("E7 the stop's owner named (stack captured)", trace.stops.length > 0 || (aliveCarriers.length > 0 && !trace.stops.length), trace.stops.length ? "stack above" : "no stop at all");
}

/* the peel */
let landed = null;
for (let i = 1; i <= 12; i++) {
  await zzz(0.5);
  const m = evalJson(FSC_PROBE);
  if (m.fscOpen === false) { landed = i * 500; break; }
}
ok("E8 the peel landed", landed !== null, `atMs=${landed}`);

/* restore */
ab(`open ${BASE}/?t=${Date.now()}`);
zzz(3);
const after = evalJson(FSC_PROBE);
ok("E9 the world restored", after.dlgCount === 0, `dlgs=${after.dlgCount}`);

console.log(`\nFSC-CARRIERS t884c: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t884c",
  window: "cron 2026-11-02 15:20:37 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021520)",
  purpose: "the fsc reconciliation — every onKeyDown carrier enumerated and counted in one breath; the stop's owner named by stack",
  trace, checks: results, pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t884c-fsc-carriers.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t884c-fsc-carriers.json");
process.exit(fail === 0 ? 0 : 1);

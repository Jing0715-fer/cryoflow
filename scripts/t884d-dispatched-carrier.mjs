#!/usr/bin/env node
/* t884d — the DISPATCHED CARRIER: t884c proved the fsc dialog's own Escape
 * handler IS executed (the stack named its compiled code) while every wrap
 * we installed on the fsc subtree read ZERO — and getListener provably reads
 * stateNode[internalPropsKey] (the mirror). The only surviving explanation:
 * the dispatched merged closure lives on an element OUTSIDE the fsc DOM
 * subtree — the fiber path from the rescan button climbs through the
 * PORTAL back into the React tree (the inspector's fibers), whose DOM
 * nodes no earlier instrument ever enumerated.
 *
 * THE INSTRUMENT: walk the ENTIRE DOCUMENT; find EVERY element whose
 * mirror carries onKeyDown; wrap them ALL (each with its own counter,
 * behaviour preserved); also patch the fsc root's fiber; arm the stop spy;
 * fire ONE Escape at the t881 target; read EVERY counter. The element
 * whose counter moved IS the dispatched carrier.
 *
 * Receipt: shots-qa/t884d-dispatched-carrier.json.
 *
 *   node scripts/t884d-dispatched-carrier.mjs
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

console.log("t884d — the dispatched carrier: wrap EVERY onKeyDown carrier in the whole document, fire once, count who moves\n");

/* the t881 door */
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
ok("D1 the workflow canvas holds the cards", cards >= 10, `cards=${cards}`);

const openHost = evalJson(`(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("3D Refine") !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()`);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson(FSC_PROBE);
  if (insp.dlgHeads.some((h) => h.startsWith("3D Refine"))) break;
}
ok("D2 the inspector arrived", insp && insp.dlgHeads.some((h) => h.startsWith("3D Refine")), `heads=[${(insp?.dlgHeads ?? []).join(" | ")}]`);

const resTab = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=dialog] [role=tab]")).find((x) => (x.textContent || "").indexOf("Results") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (resTab.found && resTab.clicked) zzz(3);
let doorOk = false;
for (let i = 0; i < 15; i++) {
  doorOk = evalJson('(() => JSON.stringify({ d: !!document.querySelector("[data-testid=fsc-compare-open]") }))()').d;
  if (doorOk) break;
  zzz(1);
}
const door = evalJson(`(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()`);
let fsc = null;
for (let i = 0; i < 20; i++) {
  zzz(1);
  fsc = evalJson(FSC_PROBE);
  if (fsc.fscOpen === true && fsc.dlgCount === 2) break;
}
ok("D3 the fsc dialog floats over the inspector", fsc && fsc.fscOpen === true && fsc.dlgCount === 2, `dlgs=${fsc?.dlgCount}`);

/* THE ATOMIC: document-wide carrier wrap + fire + read, one breath */
const ATOMIC =
  '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); if (!fsc) return JSON.stringify({ armed: false }); const nameOf = (el) => el.tagName + (el.getAttribute && el.getAttribute("data-testid") ? ":" + el.getAttribute("data-testid") : "") + (el.getAttribute && el.getAttribute("data-slot") ? "{" + el.getAttribute("data-slot") + "}" : "") + (el.getAttribute && el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : "") + (el.closest && el.contains(fsc) ? "<FSC-ANC>" : el === fsc ? "<FSC-ROOT>" : fsc.contains(el) ? "<FSC-DESC>" : el.contains(document.body) ? "<HTML-ROOT>" : ""); const all = [document.documentElement, document.body, ...document.querySelectorAll("*")]; const seen = new Set(); const carriers = []; all.forEach((el) => { if (!el || seen.has(el)) return; seen.add(el); const pk = Object.keys(el).find((k) => k.startsWith("__reactProps")); if (pk && el[pk] && typeof el[pk].onKeyDown === "function") { const idx = carriers.length; window["__k" + idx] = 0; const orig = el[pk].onKeyDown; const propsObj = el[pk]; propsObj.onKeyDown = function (e) { window["__k" + idx] = (window["__k" + idx] || 0) + 1; return orig.call(this, e); }; carriers.push({ idx, el: el, name: nameOf(el), inFscSubtree: fsc.contains(el) || el === fsc }); } }); const fk = Object.keys(fsc).find((k) => k.startsWith("__reactFiber")); let n = fsc[fk], hops = 0, fiberHits = []; while (n && hops < 60) { if (n.memoizedProps && typeof n.memoizedProps.onKeyDown === "function") { const idx2 = fiberHits.length; window["__f" + idx2] = 0; const fo = n.memoizedProps.onKeyDown; n.memoizedProps.onKeyDown = function (e) { window["__f" + idx2] = (window["__f" + idx2] || 0) + 1; return fo.call(this, e); }; fiberHits.push({ idx: idx2, hop: hops }); } n = n.return; hops++; } const stops = []; const oS = Event.prototype.stopPropagation; Event.prototype.stopPropagation = function () { stops.push({ ph: this.eventPhase, self: (this.currentTarget && this.currentTarget.tagName) || "?" , stack: (new Error().stack || "").split("\\n").slice(2, 5).join(" << ").slice(0, 300) }); return oS.call(this); }; try { const top = fsc; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); const reads = {}; carriers.forEach((c) => { reads["#" + c.idx + " " + c.name] = window["__k" + c.idx]; }); const fReads = {}; fiberHits.forEach((h) => { fReads["hop" + h.hop] = window["__f" + h.idx]; }); return JSON.stringify({ armed: true, fired: true, target: t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : ""), carrierTotal: carriers.length, carriers: carriers.map((c) => "#" + c.idx + " " + c.name + (c.inFscSubtree ? " [fsc]" : " [outside]")), reads: reads, fiberCarriers: fiberHits.length, fiberReads: fReads, stops: stops }); } finally { Event.prototype.stopPropagation = oS; } })()';

const trace = evalJson(ATOMIC);
ok("D4 the document-wide instrument armed and fired", trace.armed === true && trace.fired === true, `carriers=${trace.carrierTotal} fiberCarriers=${trace.fiberCarriers}`);

if (trace.armed) {
  console.log(`\n  the ${trace.carrierTotal} onKeyDown carriers in the whole document:`);
  (trace.carriers || []).forEach((c) => console.log(`    ${c}`));
  console.log(`\n  the reads after ONE Escape at ${trace.target}:`);
  Object.entries(trace.reads || {}).forEach(([k, v]) => { if (v > 0) console.log(`    ★ ${k} -> ${v}`); });
  const silent = Object.entries(trace.reads || {}).filter(([, v]) => v === 0);
  console.log(`    (${silent.length} carriers silent)`);
  console.log(`  the fiber-path reads (walking UP from the fsc root, ${trace.fiberCarriers} carriers):`);
  Object.entries(trace.fiberReads || {}).forEach(([k, v]) => console.log(`    ${k} -> ${v}`));
  console.log(`\n  the stop spy (${(trace.stops || []).length} calls):`);
  (trace.stops || []).forEach((s) => console.log(`    ph=${s.ph} self=${s.self}\n      ${String(s.stack).replace(/ << /g, "\n      ")}`));

  const alive = Object.entries(trace.reads || {}).filter(([, v]) => v > 0);
  ok("D5 the dispatched carrier identified", alive.length > 0, alive.map(([k]) => k).join(" ; ") || "NONE moved");
  const fAlive = Object.entries(trace.fiberReads || {}).filter(([, v]) => v > 0);
  ok("D6 the fiber-path carriers read", trace.fiberCarriers > 0, `fiber alive: ${fAlive.map(([k]) => k).join(",") || "none"}`);
}

let landed = null;
for (let i = 1; i <= 12; i++) {
  await zzz(0.5);
  const m = evalJson(FSC_PROBE);
  if (m.fscOpen === false) { landed = i * 500; break; }
}
ok("D7 the peel landed", landed !== null, `atMs=${landed}`);

ab(`open ${BASE}/?t=${Date.now()}`);
zzz(3);
const after = evalJson(FSC_PROBE);
ok("D8 the world restored", after.dlgCount === 0, `dlgs=${after.dlgCount}`);

console.log(`\nDISPATCHED-CARRIER t884d: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t884d",
  window: "cron 2026-11-02 15:20:37 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021520)",
  purpose: "the dispatched carrier — document-wide onKeyDown enumeration, all wrapped, one fire, the mover named",
  trace, checks: results, pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t884d-dispatched-carrier.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t884d-dispatched-carrier.json");
process.exit(fail === 0 ? 0 : 1);

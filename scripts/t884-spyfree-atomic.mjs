#!/usr/bin/env node
/* t884 — the A7 ISOLATION: t883's atomic trace fired, counted, and spied in
 * one breath, and its one honest red (A7: no dismissal under the spy) was
 * parked as "the instrument's own residue". This ride splits the instrument
 * into its three pieces and rebuilds the world fresh for EACH arm, so the
 * arms cannot contaminate each other:
 *
 *   ARM 1  pure fire          — no counters, no spy (the bare environment)
 *   ARM 2  chain counters     — the ancestor-chain listeners ONLY (no spy)
 *   ARM 3  the stop spy       — the stopPropagation/stopImmediate wrap ONLY
 *                                (now with STACK capture: the stack names the
 *                                BODY stop's owner, the t883 spy had no stack)
 *
 * The verdict arithmetic:
 *   1 lands, 3 dies   -> the spy is the killer (A7 = instrument, proven)
 *   1 lands, 2 dies   -> the chain counters kill (unlikely, would be strange)
 *   1 dies            -> the environment itself changed since t881 (bigger news)
 *   all land          -> A7 was nondeterministic (a world-state race in t883)
 *
 * Receipt: shots-qa/t884-spyfree-atomic.json.
 *
 *   node scripts/t884-spyfree-atomic.mjs
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

/* the t883 door sequence, factored: fresh load -> workflow canvas -> the
 * inspector -> the Results tab -> the A/B door -> the two-dialog world */
async function buildWorld(tag) {
  ab(`open ${BASE}/?t=${Date.now()}`);
  let m0 = evalJson(MEASURE);
  for (let i = 0; i < 60 && m0.dlgCount !== 0; i++) { zzz(1); m0 = evalJson(MEASURE); }
  const wf = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
  if (wf.found && wf.clicked) zzz(2);
  let cards = 0;
  for (let i = 0; i < 20; i++) {
    cards = evalJson('(() => JSON.stringify({ c: document.querySelectorAll("div[role=button][aria-label]").length }))()').c;
    if (cards >= 10) break;
    zzz(1);
  }
  if (cards < 10) return { ok: false, why: `cards=${cards}` };

  const cardRect = () => evalJson(`(() => { const b = Array.from(document.querySelectorAll('div[role=button]')).find(x => (x.getAttribute('aria-label')||'').startsWith('${HOST}')); if (!b) return JSON.stringify({ ok: false }); const r = b.getBoundingClientRect(); return JSON.stringify({ ok: true, x: r.x, y: r.y, w: r.width, winW: window.innerWidth, winH: window.innerHeight }); })()`);
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = cardRect();
    if (!r.ok) break;
    if (r.x >= 20 && r.x + r.w <= r.winW - 20) break;
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
  if (!insp || !insp.dlgHeads.some((h) => h.startsWith("2D Classification"))) {
    return { ok: false, why: `inspector=${JSON.stringify(insp)}` };
  }
  const resTab = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=dialog] [role=tab]")).find((x) => (x.textContent || "").indexOf("Results") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
  if (resTab.found && resTab.clicked) zzz(3);
  let doorOk = false;
  for (let i = 0; i < 15; i++) {
    doorOk = evalJson(`(() => JSON.stringify({ d: [...document.querySelectorAll('[role=dialog] button')].some(b => (b.getAttribute('aria-label')||'').includes('Class A/B')) }))()`).d;
    if (doorOk) break;
    zzz(1);
  }
  if (!doorOk) return { ok: false, why: `results door=${doorOk} tab=${JSON.stringify(resTab)}` };
  const door = evalJson(`(() => { const d = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); if (!d) return JSON.stringify({ ok: false }); d.click(); return JSON.stringify({ ok: true }); })()`);
  let abDlg = null;
  for (let i = 0; i < 20; i++) {
    zzz(1);
    abDlg = evalJson(MEASURE);
    if (abDlg.abOpen === true && abDlg.dlgCount === 2) break;
  }
  if (!abDlg || abDlg.abOpen !== true || abDlg.dlgCount !== 2) {
    return { ok: false, why: `abDialog=${JSON.stringify(abDlg)}` };
  }
  return { ok: true, world: `${tag}: cards=${cards} dlgs=2` };
}

/* fire + poll, shared: the fire eval is the ONLY eval between the world and
 * the poll — whatever it contains IS the arm's instrument */
const FIRE_PURE = '(() => { const d = [...document.querySelectorAll("[role=dialog]")].find((x) => (x.textContent || "").includes("A/B —")); if (!d) return JSON.stringify({ armed: false, why: "no A/B dialog" }); const t = (document.activeElement && d.contains(document.activeElement) && document.activeElement !== d) ? document.activeElement : (d.querySelector("[data-slot=dialog-content]") || d); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ armed: true, fired: true, instrument: "none" }); })()';

const FIRE_CHAIN = '(() => { const d = [...document.querySelectorAll("[role=dialog]")].find((x) => (x.textContent || "").includes("A/B —")); if (!d) return JSON.stringify({ armed: false, why: "no A/B dialog" }); const chain = []; let el = d; let idx = 0; while (el && idx < 14) { const rec = { tag: el.tagName + (el.getAttribute && el.getAttribute("data-slot") ? "{" + el.getAttribute("data-slot") + "}" : ""), cap: 0, bub: 0 }; el.addEventListener("keydown", (e) => { if (e.key === "Escape") rec.cap++; }, true); el.addEventListener("keydown", (e) => { if (e.key === "Escape") rec.bub++; }, false); chain.push(rec); el = el.parentElement || (el.parentNode && el.parentNode.host) || null; idx++; } const t = (document.activeElement && d.contains(document.activeElement) && document.activeElement !== d) ? document.activeElement : (d.querySelector("[data-slot=dialog-content]") || d); const tRec = { tag: "TARGET", cap: 0, bub: 0 }; t.addEventListener("keydown", (e) => { if (e.key === "Escape") tRec.cap++; }, true); t.addEventListener("keydown", (e) => { if (e.key === "Escape") tRec.bub++; }, false); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); const counters = chain.map((c) => c.tag + " cap=" + c.cap + " bub=" + c.bub).join(" | ") + " | " + tRec.tag + " cap=" + tRec.cap + " bub=" + tRec.bub; return JSON.stringify({ armed: true, fired: true, instrument: "chain", counters: counters }); })()';

const FIRE_SPY = '(() => { const d = [...document.querySelectorAll("[role=dialog]")].find((x) => (x.textContent || "").includes("A/B —")); if (!d) return JSON.stringify({ armed: false, why: "no A/B dialog" }); const stops = []; const oS = Event.prototype.stopPropagation; const oSI = Event.prototype.stopImmediatePropagation; const who = (e) => { try { const c = e.currentTarget; return (c.tagName + (c.getAttribute && c.getAttribute("data-slot") ? "{" + c.getAttribute("data-slot") + "}" : "")); } catch { return "?"; } }; Event.prototype.stopPropagation = function () { stops.push({ m: "stop", ph: this.eventPhase, self: who(this), key: this.key, stack: (new Error().stack || "").split("\\n").slice(1, 7).join(" << ").slice(0, 600) }); return oS.call(this); }; Event.prototype.stopImmediatePropagation = function () { stops.push({ m: "stopImm", ph: this.eventPhase, self: who(this), key: this.key, stack: (new Error().stack || "").split("\\n").slice(1, 7).join(" << ").slice(0, 600) }); return oSI.call(this); }; try { const t = (document.activeElement && d.contains(document.activeElement) && document.activeElement !== d) ? document.activeElement : (d.querySelector("[data-slot=dialog-content]") || d); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ armed: true, fired: true, instrument: "spy", stops: stops }); } finally { Event.prototype.stopPropagation = oS; Event.prototype.stopImmediatePropagation = oSI; } })()';

async function runArm(name, fireJs) {
  console.log(`\n— ARM ${name} —`);
  const world = await buildWorld(name);
  if (!world.ok) {
    ok(`B-${name} the two-dialog world built`, false, world.why);
    return { built: false };
  }
  ok(`B-${name} the two-dialog world built`, true, world.world);
  const fire = evalJson(fireJs);
  if (!fire || fire.armed !== true) {
    ok(`B-${name} the fire armed`, false, fire ? JSON.stringify(fire) : "no output");
    return { built: true, armed: false };
  }
  let landed = null;
  for (let i = 1; i <= 12; i++) {
    await zzz(0.5);
    const m = evalJson(MEASURE);
    if (m.abOpen === false || m.dlgCount < 2) { landed = i * 500; break; }
  }
  const post = evalJson(MEASURE);
  ok(`B-${name} the dismissal landed`, landed !== null, `atMs=${landed} post=${JSON.stringify({ dlgCount: post.dlgCount, abOpen: post.abOpen })}`);
  return { built: true, armed: true, fired: fire, landedMs: landed, post };
}

console.log("t884 — the A7 isolation: three arms, three fresh worlds, one question (instrument or environment?)\n");

const arm1 = await runArm("1-pure", FIRE_PURE);
const arm2 = await runArm("2-chain", FIRE_CHAIN);
const arm3 = await runArm("3-spy", FIRE_SPY);

/* the verdict arithmetic */
console.log("\n— the verdict arithmetic —");
const l1 = arm1.landedMs ?? null, l2 = arm2.landedMs ?? null, l3 = arm3.landedMs ?? null;
console.log(`  arm1 (pure)   landed=${l1}`);
console.log(`  arm2 (chain)  landed=${l2}`);
console.log(`  arm3 (spy)    landed=${l3}`);
let verdict;
if (l1 !== null && l2 !== null && l3 === null) verdict = "THE SPY IS THE KILLER — A7 was the instrument, proven by isolation";
else if (l1 !== null && l2 === null) verdict = "THE CHAIN COUNTERS KILL — strange, and now proven";
else if (l1 === null) verdict = "THE ENVIRONMENT CHANGED — the two-dialog world no longer dismisses untrusted Escape";
else verdict = "A7 WAS NONDETERMINISTIC — all arms land; the t883 red was a world-state race";
ok("B-V the verdict synthesised", true, verdict);

const spyStacks = arm3?.fired?.stops ?? [];
if (spyStacks.length) {
  console.log("\n  the spy's stops (with stacks — the owner's address):");
  spyStacks.forEach((s) => console.log(`    ${s.m} ph=${s.ph} self=${s.self} key=${s.key}\n      ${String(s.stack).replace(/ << /g, "\n      ")}`));
}
ok("B-S the spy's stack capture", spyStacks.length > 0 ? true : l3 !== null, `${spyStacks.length} stops${spyStacks.length ? " (stacks above)" : " (no stops — and the dismissal landed)"}`);

/* restore */
ab(`open ${BASE}/?t=${Date.now()}`);
zzz(3);
const after = evalJson(MEASURE);
ok("B-R the world restored", after.dlgCount === 0, `dlgs=${after.dlgCount}`);

console.log(`\nSPYFREE-ATOMIC t884: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t884",
  window: "cron 2026-11-02 15:20:37 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021520)",
  purpose: "the A7 isolation — three arms (pure / chain / spy), three fresh worlds; the spy now carries stacks",
  verdict,
  arms: { arm1, arm2, arm3 },
  checks: results,
  pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t884-spyfree-atomic.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t884-spyfree-atomic.json");
process.exit(fail === 0 ? 0 : 1);

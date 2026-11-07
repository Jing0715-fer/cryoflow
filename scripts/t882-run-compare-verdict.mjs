#!/usr/bin/env node
/* t882 — the RUN-COMPARE PUZZLE: if the fsc-compare Escape consumer is
 * DEAD CODE (t881b's behavioural verdict), why did run-compare's disease
 * (t874: ONE Escape peeled TWO layers) need a consumer to cure it?
 *
 * The two candidates:
 *   (a) run-compare's consumer IS alive (its behaviour differs from
 *       fsc-compare's) — then the two components carry a structural
 *       difference worth naming, and t874's fix was the real cure.
 *   (b) run-compare's consumer is ALSO dead — then t874's green face
 *       (the fix ride's 34/34) was cured by something else (a re-render
 *       the consumer's addition triggered? a Radix behaviour change?),
 *       and BOTH comments teach a fiction.
 *
 * THE INSTRUMENT (t881b's, reused verbatim): neutralize the DialogContent's
 * onKeyDown THROUGH THE FIBER (in-place mutation, every other prop kept),
 * fire ONE Escape, read the LAYER ARITHMETIC:
 *   - TWO layers peel (dlgs 2→0) → the consumer was the guarantee — (a)
 *   - ONE layer peels (dlgs 2→1, the inspector survives) → the consumer
 *     is dead here too — (b)
 *
 * The door (t874's P1, reused): fresh canvas → dynamic pan onto the
 * "2D Classification (tutorial)" card → the inspector → the "Class A/B"
 * door (aria-label carries the sibling count) → TWO dialogs.
 *
 * Receipt: shots-qa/t882-run-compare-verdict.json.
 *
 *   node scripts/t882-run-compare-verdict.mjs
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

const escKey =
  '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs.length ? dgs[dgs.length - 1] : document.body; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ sent: true, target: t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : "") }); })()';

/* the NEUTRALIZER (t881b's, on the A/B dialog): mutate the fiber's
 * memoizedProps.onKeyDown IN PLACE — every other prop survives. The
 * no-op counts (the control reading; no discriminative power, but the
 * honest mirror's third face). */
const NEUTRALIZE =
  '(() => { const d = [...document.querySelectorAll("[role=dialog]")].find((x) => (x.textContent || "").includes("A/B —")); if (!d) return JSON.stringify({ neutralized: false, why: "no A/B dialog" }); const fk = Object.keys(d).find((k) => k.startsWith("__reactFiber")); let n = d[fk], hops = 0, orig = null; while (n && hops < 30) { if (n.memoizedProps && typeof n.memoizedProps.onKeyDown === "function") { orig = n.memoizedProps.onKeyDown; break; } n = n.return; hops++; } if (!orig) return JSON.stringify({ neutralized: false, why: "no fiber onKeyDown in 30 hops" }); window.__rcNoop = 0; n.memoizedProps.onKeyDown = function (e) { window.__rcNoop = (window.__rcNoop || 0) + 1; }; return JSON.stringify({ neutralized: true, atHop: hops }); })()';

console.log("t882 — the run-compare puzzle: is ITS consumer alive?\n");

/* P0 the bare canvas (cache-buster — the bfcache lesson) */
ab(`open ${BASE}/?t=${Date.now()}`);
let m0 = evalJson(MEASURE);
let waited = 0;
for (let i = 0; i < 90 && !(m0.dlgCount === 0 && document_ready()); i++) { zzz(1); waited++; m0 = evalJson(MEASURE); }
function document_ready() { return true; }
ok("R1 the canvas opens bare", m0.dlgCount === 0, `waited=${waited}s`);

/* the workflow tab door (the t881 lesson: the fresh load lands on the
 * Dashboard when the selectedJob key is absent — the cards live on the
 * Workflow canvas) */
let wf = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); if (!t) return JSON.stringify({ found: false }); if (t.getAttribute("aria-selected") === "true") return JSON.stringify({ found: true, selected: true }); t.click(); return JSON.stringify({ found: true, clicked: true }); })()`);
if (wf.found && !wf.selected) { zzz(2); wf = evalJson(`(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((x) => (x.textContent || "").indexOf("Workflow") !== -1); return JSON.stringify({ found: !!t, selected: !!t && t.getAttribute("aria-selected") === "true" }); })()`); }
ok("R1b the Workflow tab active", wf.found === true && wf.selected === true, JSON.stringify(wf));
let cards = 0;
for (let i = 0; i < 20; i++) {
  cards = evalJson('(() => JSON.stringify({ c: document.querySelectorAll("div[role=button][aria-label]").length }))()').c;
  if (cards >= 10) break;
  zzz(1);
}
ok("R1c the job cards on the canvas", cards >= 10, `cards=${cards}`);

/* P1 the entrance (t874's pan, the card, the inspector) */
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
ok("R2 the canvas panned onto the host card", panned === true);

/* the defensive clear (the pan's down-up can land ON the card — the t880 teach) */
const pre = evalJson(`(() => { const d = document.querySelector('[role=dialog]'); if (!d) return JSON.stringify({ pre: false }); const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return JSON.stringify({ pre: true }); })()`);
if (pre.pre) zzz(1.5);

/* the card opens by its own DOM events (the t881 openCard hand — agent-
 * browser's click selector chokes on the label's parentheses) */
const openHost = evalJson(`(() => { const btn = Array.from(document.querySelectorAll('div[role=button]')).find((b) => (b.getAttribute('aria-label') || '').startsWith('${HOST}')); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent('pointerdown', o)); btn.dispatchEvent(new PointerEvent('pointerup', o)); btn.click(); return JSON.stringify({ found: true }); })()`);
ok("R2b the host card dispatched", openHost.found === true);
let insp = null;
for (let i = 0; i < 15; i++) {
  zzz(1);
  insp = evalJson(MEASURE);
  if (insp.dlgHeads.some((h) => h.startsWith(HOST.slice(0, 10)))) break;
}
ok("R3 the inspector arrived", insp && insp.dlgHeads.some((h) => h.startsWith("2D Classification")), `heads=[${(insp?.dlgHeads ?? []).join(" | ")}]`);

/* the A/B door */
const door = evalJson(`(() => { const d = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); return JSON.stringify({ ok: !!d, al: d ? d.getAttribute('aria-label') : null }); })()`);
ok("R4 the Class A/B door present", door.ok === true, `al="${door.al || ""}"`);
if (door.ok) {
  evalJson(`(() => { const d = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); d.click(); return "x"; })()`);
  let ab = null;
  for (let i = 0; i < 20; i++) {
    zzz(1);
    ab = evalJson(MEASURE);
    if (ab.abOpen === true) break;
  }
  ok("R5 the A/B dialog floats over the inspector (TWO dialogs)", ab && ab.abOpen === true && ab.dlgCount === 2, `dlgs=${ab?.dlgCount} heads=[${(ab?.dlgHeads ?? []).join(" | ")}]`);

  if (ab && ab.abOpen === true && ab.dlgCount === 2) {
    /* THE NEUTRALIZER rides */
    const nz = evalJson(NEUTRALIZE);
    ok("R6 the consumer neutralized through the fiber", nz.neutralized === true, JSON.stringify(nz));

    if (nz.neutralized) {
      const fire = evalJson(escKey);
      zzz(3);
      const post = evalJson(MEASURE);
      let late = null;
      if (post.abOpen !== false || post.dlgCount === 2) {
        late = evalJson('(() => { return (async () => { const ab = () => [...document.querySelectorAll("[role=dialog]")].find((d) => (d.textContent || "").includes("A/B —")); for (let i = 1; i <= 12; i++) { await new Promise((r) => setTimeout(r, 500)); if (!ab()) return JSON.stringify({ landed: true, atMs: i * 500 }); } return JSON.stringify({ landed: false, stillOpen: !!ab() }); })(); })()');
      }
      const abGone = post.abOpen === false || (late && late.landed === true);
      const inspAlive = (post.dlgHeads ?? []).some((h) => h.startsWith("2D Classification"));
      const oneLayer = abGone && inspAlive;
      const twoLayers = abGone && post.dlgCount === 0;

      ok("R7 the neutralized fire's read", fire.sent === true,
        `fire=${JSON.stringify(fire)} post=${JSON.stringify({ dlgCount: post.dlgCount, heads: post.dlgHeads })}${late ? ` late=${JSON.stringify(late)}` : ""} noopSynth=${evalJson('(() => JSON.stringify({ n: window.__rcNoop ?? null }))()').n}`);

      /* THE VERDICT — the layer arithmetic answers the puzzle: */
      if (twoLayers) {
        ok("R8 VERDICT: the consumer was ALIVE — the disease returns without it", true,
          "TWO layers peeled with the handler neutralized — (a) stands: run-compare's consumer IS the one-layer guarantee (its structure differs from fsc-compare's); t874's fix was the real cure");
      } else if (oneLayer) {
        ok("R8 VERDICT: the consumer is DEAD HERE TOO — t874's cure was something else", true,
          "ONE layer peeled with the handler neutralized — (b) stands: both consumers are dead code; the t874 fix's green face must be explained by its side effect (a re-render? a structural change?) — BOTH comments need the measured truth");
      } else {
        ok("R8 VERDICT: unclear — the door did not close", false,
          `post=${JSON.stringify({ dlgCount: post.dlgCount, heads: post.dlgHeads })} late=${JSON.stringify(late)}`);
      }
    }
  }
} else {
  console.log("  (the A/B door is absent — the class domain's sibling gate did not render)");
}

/* restore */
zzz(2);
ab(`open ${BASE}/?t=${Date.now()}`);
zzz(3);
const after = evalJson(MEASURE);
ok("R9 the world restored", after.dlgCount === 0, `dlgs=${after.dlgCount}`);

console.log(`\nRUN-COMPARE-VERDICT t882: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t882",
  window: "cron 2026-11-02 14:50:37 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021457)",
  purpose: "the run-compare puzzle — is its Escape consumer alive where fsc-compare's is dead?",
  checks: results,
  pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t882-run-compare-verdict.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t882-run-compare-verdict.json");
process.exit(fail === 0 ? 0 : 1);

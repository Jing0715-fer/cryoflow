/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t596 — QA probe + lane evidence: the selection-shrink reframe question.
 *
 * QA faces (world read-only): 12c/13e, console clean, mode=fit.
 * Lane evidence: t595 W4 asserted stage-1 (Escape collapses the
 * multi-selection) SNAPS. Candidate question left to this window: is
 * that snap the right voice, or is a keypress also a finger? Measure
 * the real delta of the stage-1 shrink in this world — is the snap a
 * visible jump (worth an answer) or sub-pixel furniture?
 *
 * Usage: node scripts/t596-qa-probe.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      if (typeof v === "string") {
        if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        else if (v === "true") v = true;
        else if (v === "false") v = false;
      }
      return v;
    } catch { await sleep(600); }
  }
  return null;
};
async function pollUntil(fn, timeoutMs = 120000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}

try {
  console.log(`[boot] close-all + open`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(1000);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(600);

  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length,
    mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode")
  })`);
  check("12c/13e + 12 dots, mode=fit", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12 && counts.mode === "fit", JSON.stringify(counts));

  /* ---- lane evidence: the stage-1 shrink, measured --------------------- */
  console.log(`\n[E] selection-shrink evidence — Ctrl+A then Escape #1`);
  const vbOf = `JSON.stringify((function(){
    var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    if (!svg) return {};
    var vb = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number);
    return { mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode"), x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  })())`;
  const v0 = await readJson(vbOf);
  check("fit box read", !!(v0 && v0.w > 0 && v0.mode === "fit"), JSON.stringify(v0));

  sh(`agent-browser press Control+a >/dev/null 2>&1`);
  await sleep(350);
  const vA = await readJson(vbOf);
  check("Ctrl+A arms sel mode", !!(vA && vA.mode === "sel"), JSON.stringify(vA));

  const shrinkSample = `(function(){
    var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    function vb(){ var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { x: p[0], y: p[1], w: p[2], h: p[3] }; }
    var pre = vb();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    var s40 = null, s120 = null;
    return new Promise(function(res){
      setTimeout(function(){ s40 = vb(); }, 40);
      setTimeout(function(){ s120 = vb(); }, 120);
      setTimeout(function(){ res(JSON.stringify({ pre: pre, s40: s40, s120: s120, post: vb() })); }, 240);
    });
  })()`;
  const shrink = await readJson(shrinkSample);
  check("shrink sample complete", !!(shrink && shrink.s40), "sampled @40/@120/post");
  if (shrink && shrink.s40) {
    const dW = Math.abs(shrink.pre.w - shrink.post.w);
    const snapped = shrink.s40.w === shrink.s120.w && shrink.s120.w === shrink.post.w;
    check("stage-1 shrink measured", true, `Δw=${dW.toFixed(0)} Δh=${Math.abs(shrink.pre.h - shrink.post.h).toFixed(0)} (all-${vA ? vA.w.toFixed(0) : "?"} → primary ${shrink.post.w.toFixed(0)})`);
    check("current voice = snap (t595 contract intact)", snapped, `@40=${shrink.s40.w.toFixed(1)} @120=${shrink.s120.w.toFixed(1)} post=${shrink.post.w.toFixed(1)}`);
    check("the jump is VISIBLE (not furniture)", dW > 100, `Δw=${dW.toFixed(0)} world units`);
  }

  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(350);
  const v2 = await readJson(vbOf);
  check("coercion lands back on fit", !!(v2 && v2.mode === "fit"), JSON.stringify(v2));

  /* ---- console clean ----------------------------------------------------- */
  let errs = "";
  try { errs = sh(`agent-browser errors 2>/dev/null`).trim(); } catch { /* */ }
  check("console clean", errs === "", errs ? errs.slice(0, 80) : "0 errors");

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);

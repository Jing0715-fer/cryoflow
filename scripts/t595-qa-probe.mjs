/**
 * t595 — QA probe + lane evidence: the minimap mode-switch reframe.
 *
 * QA faces (world read-only): 12c/13e, console clean, minimap present.
 * Lane evidence: the fit↔nodes toggle changes the map's world box (the
 * svg viewBox) in ONE frame — the whole projection (chips, edges, the
 * viewport rect) rescales instantly. Measure the real delta in this
 * world: is the reframe a visible event or sub-pixel furniture?
 *
 * Usage: node scripts/t595-qa-probe.mjs
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
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 map dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));

  /* ---- lane evidence: the mode-switch reframe --------------------------- */
  console.log(`\n[E] fit↔nodes toggle — the world box jump, measured live`);
  const readVb = `JSON.stringify((function(){
    var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    var root = svg ? svg.closest("[data-canvas-ui='minimap']") : null;
    if (!svg) return {};
    var vb = svg.getAttribute("viewBox").split(/[, ]+/).map(Number);
    return {
      mode: root ? root.getAttribute("data-mm-mode") : (svg.getAttribute("data-mm-mode") || "?"),
      x: vb[0], y: vb[1], w: vb[2], h: vb[3],
      pxH: svg.getAttribute("height"),
      setKey: !!(root || svg).querySelector('[data-mm-set]')
    };
  })())`;
  const v0 = await readJson(readVb);
  check("fit-mode map read", !!(v0 && v0.w > 0), JSON.stringify(v0));

  const toggle = (btn) => `(function(){
    var b = document.querySelector('[data-mm-btn="${btn}"]');
    if (!b) return JSON.stringify({ err: "no " + "${btn}" + " button" });
    b.click();
    return "clicked";
  })()`;

  await sleep(150);
  await readJson(toggle("nodes"));
  await sleep(350); // thumb settle (t591) is 200ms; let everything retire
  const v1 = await readJson(readVb);
  check("nodes-mode read", !!(v1 && v1.w > 0), JSON.stringify(v1));

  await readJson(toggle("fit"));
  await sleep(350);
  const v2 = await readJson(readVb);
  check("back to fit", !!(v2 && v2.w > 0), JSON.stringify(v2));

  if (v0 && v1) {
    const dW = Math.abs(v1.w - v0.w), dH = Math.abs(v1.h - v0.h);
    const dPxH = Math.abs((v1.pxH | 0) - (v0.pxH | 0));
    check("fit→nodes reframe measured", true, `Δw=${dW.toFixed(0)} Δh=${dH.toFixed(0)} ΔpxH=${dPxH} (mode ${v0.mode}→${v1.mode})`);
    check("reframe is a visible event (not sub-pixel)", dW > 10 || dH > 10 || dPxH > 2, `Δw=${dW.toFixed(0)}`);
  }

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

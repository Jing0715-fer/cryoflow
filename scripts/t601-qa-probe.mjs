/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t601 — opening QA probe (world read-only): the death-breath lane recon.
 *
 * QA faces: hydrate 12 cards, 12c/13e + 12 minimap dots, mode=fit,
 * console clean, lane recon — confirm the canvas has NO death machinery
 * today (no data-dying anywhere, no ghost layer): the lane's gap is real
 * in the served world, not just in source.
 *
 * Usage: node scripts/t601-qa-probe.mjs
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
      // bare scalar strings are truthy — coerce numeric/boolean leaves
      // (the t598 tuition: "0" must not read as a failure count)
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
    return typeof n === "number" && n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(600);

  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length,
    mode: document.querySelector("[data-mm-mode]") ? document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode") : null,
    dying: document.querySelectorAll("[data-dying]").length,
    ghosts: document.querySelectorAll("[data-death-ghost]").length
  })`);
  check("12c/13e + 12 dots, mode present", !!(counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12 && counts.mode), JSON.stringify(counts));
  check("no death machinery in served world", counts && counts.dying === 0 && counts.ghosts === 0, `dying=${counts && counts.dying} ghosts=${counts && counts.ghosts}`);

  const consoleErrs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean", consoleErrs === 0, `errors=${consoleErrs}`);

  console.log(`\n[recon] delete-flow source contract (read-only)`);
  const storeHasDeath = sh(`rg -c "deathGhosts" src/lib/store.ts 2>/dev/null || true`);
  check("lane gap confirmed in source (no deathGhosts yet)", storeHasDeath === "", storeHasDeath ? `already present: ${storeHasDeath}` : "clean slate");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
} catch (err) {
  console.error("probe crashed:", err && err.message);
  process.exit(1);
}

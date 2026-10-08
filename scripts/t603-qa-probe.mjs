/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t603 — opening QA probe (world read-only): the summoned-voice lane recon.
 *
 * QA faces: hydrate 12 cards, 12c/13e, mode=fit, console clean, roster 6
 * with EMPIAR active; lane recon — confirm the served world has NO summoned
 * entrance yet (hover faces pop: no data-summon, no summon keyframes): the
 * lane's gap is real in the served world, not just in source.
 *
 * Usage: node scripts/t603-qa-probe.mjs
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

  const counts = await readJson(`JSON.stringify((() => {
    const svg = document.querySelector("svg[data-canvas-edges], svg[aria-label*='edges'], svg");
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const dots = document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length;
    return { edges, dots, jobs: document.querySelectorAll("[data-job]").length };
  })())`);
  check("13 edges live", counts && counts.edges === 13, `got ${counts && counts.edges}`);
  check("12 minimap dots", counts && counts.dots === 12, `got ${counts && counts.dots}`);

  const lane = await readJson(`JSON.stringify((() => {
    const sheets = Array.from(document.styleSheets);
    let summonKeys = 0;
    for (const s of sheets) {
      let rules; try { rules = s.cssRules; } catch { continue; }
      if (!rules) continue;
      for (const r of rules) {
        const t = r.cssText || "";
        if (t.includes("summon-fade-in") || t.includes("summon-rise-in")) summonKeys++;
      }
    }
    return { edgeSvg: document.querySelectorAll("[data-edge-id]").length > 0, summonKeys };
  })())`);
  check("lane recon: no summon keyframes in served css", lane && lane.summonKeys === 0, `got ${lane && lane.summonKeys}`);

  const roster = sh(`curl -s -H "Origin: http://localhost:3000" http://localhost:3000/api/projects`);
  const rp = JSON.parse(roster);
  const projs = rp.projects || rp;
  const act = projs.find((p) => p.active);
  check("roster 6 projects, EMPIAR active", projs.length === 6 && act && act.id === "cmuro2ufe000mn5nb3qkwuy49",
    `${projs.length} projects, active=${act && act.name}`);

  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean", errs === 0, `errors=${errs}`);
} finally {
  console.log(`\n[result] ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

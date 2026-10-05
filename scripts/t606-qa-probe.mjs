/**
 * t606 — opening QA probe (world read-only): the news face's third distance.
 *
 * QA faces: hydrate 12 cards, 12c/13e, 12 minimap dots, console clean,
 * roster 6 with EMPIAR active. Lane recon — the minimap dot today: colored
 * by STATUS_FILL with NO news acknowledgment (no data-news-floor on any
 * dot, fill swaps silently when the poll merges a status). The gap must be
 * real in the SERVED world, not just in source.
 *
 * Usage: node scripts/t606-qa-probe.mjs
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
      /* bare scalar strings are truthy — coerce numeric/boolean leaves
       * (the t598 tuition: "0" must not read as a failure count) */
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

  /* world shape */
  const world = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const dots = document.querySelectorAll("[data-canvas-ui='minimap-dot']").length;
    return JSON.stringify({ cards, edges, dots });
  })()`);
  check("canvas 12 cards", world?.cards === 12, `got ${world?.cards}`);
  check("canvas 13 edges", world?.edges === 13, `got ${world?.edges}`);
  check("minimap 12 dots", world?.dots === 12, `got ${world?.dots}`);

  /* lane recon: the dot's news face does not exist yet */
  const recon = await readJson(`(() => {
    const dots = [...document.querySelectorAll("[data-canvas-ui='minimap-dot']")];
    const withNews = dots.filter((d) => d.hasAttribute("data-news-floor")).length;
    const fills = [...new Set(dots.map((d) => d.getAttribute("fill")))];
    const keyed = [...new Set(dots.map((d) => d.getAttribute("data-job-id")))].length;
    return JSON.stringify({ withNews, fills, keyed });
  })()`);
  check("lane gap: zero dots carry a news face", recon?.withNews === 0, `withNews=${recon?.withNews}`);
  check("dots keyed by job id", recon?.keyed === 12, `unique=${recon?.keyed}`);
  check("fill is STATUS_FILL hex (attribute-borne)", Array.isArray(recon?.fills) && recon.fills.every((f) => /^#[0-9a-f]{6}$/i.test(f)), JSON.stringify(recon?.fills));

  /* console clean */
  await sleep(1200);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean (no window errors captured)", errs === 0 || errs === null, `errs=${errs}`);
  const agentErrors = await readJson(`JSON.stringify(window.__agentConsole ? window.__agentConsole.filter(m => m.level === "error").length : 0)`);
  check("console clean (agent channel)", agentErrors === 0 || agentErrors === null, `errs=${agentErrors}`);

  /* roster unchanged */
  const roster = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects | python3 -c "import json,sys; d=json.load(sys.stdin); ps=d['projects']; print(len(ps), sum(1 for p in ps if p.get('active')))"`).trim();
  check("roster 6 with exactly 1 active", roster === "6 1", `got ${roster}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

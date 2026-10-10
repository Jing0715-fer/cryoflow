/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t609 — opening QA probe (world read-only): the key-numbers tally lane.
 *
 * QA faces: hydrate 12 cards, 12c/13e, 12 dots, console clean, roster 6/1.
 * Lane recon — the key-numbers strip is the counted face that leads BOTH
 * the Results view (t330: "the key numbers lead the Results view") and the
 * inspector's Overview (t347), with the run-receipt fallback strip beside
 * it (ReceiptCountStrip). The strip mounts the moment the summary fetch
 * lands (or the Overview tab mounts for the receipt face) — and today the
 * count pops in silently: the cards carry zero animations. The gap must
 * be real in the SERVED world, not just in source.
 *
 * Host recon (live API): extract = 2 stat cards (particles/micrographs),
 * class2d = 1 (classes); refine3d has summary null + a parsed result
 * receipt ("10,866 particles") — the fallback face's host.
 *
 * Usage: node scripts/t609-qa-probe.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* read-only lane needs a REAL click (open the inspector) — CDP dedicated
 * port 9328 (9323 = t578, 9324 = t584/t604, 9325 = t605, 9326 = t607,
 * 9327 = t608) + fresh profile */
const CDP_PORT = "9328";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t609-harness-chrome-profile";
const CDP_CLICK = "scripts/t604-cdp-shift-click.mjs";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
let chromeProc = null;
async function launchDesktopChrome() {
  chromeProc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--hide-scrollbars", "--window-size=1280,720",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
    "about:blank",
  ], { stdio: "ignore", detached: false });
  const ready = await pollUntil(() => {
    try { return sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200"; }
    catch { return false; }
  }, 15000, 300);
  return ready;
}
const applyShim = () => {
  try { return sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};
const cdpClick = (x, y, mod = 0) => {
  try { return sh(`node ${CDP_CLICK} ${CDP_PORT} ${x} ${y} ${mod} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};
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

let chromeUp = false;
try {
  console.log(`[boot] close-all + desktop Chrome on ${CDP_PORT}`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  chromeUp = await launchDesktopChrome();
  if (!chromeUp) {
    console.error("FATAL: desktop Chrome never opened its CDP port");
    process.exit(2);
  }
  await sleep(400);
  let connected = false;
  for (let i = 0; i < 3 && !connected; i++) {
    try {
      const out = sh(`agent-browser connect ${CDP_PORT} 2>&1`);
      connected = !/relaunched|failed|✗/i.test(out);
      if (!connected) console.log(`  … connect attempt ${i + 1}: ${out.slice(0, 80)}`);
    } catch { await sleep(800); }
    if (!connected) await sleep(800);
  }
  check("agent-browser connected to desktop Chrome", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  check("hover shim applied", applyShim());
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

  /* find the extract card (2 stat cards — the cascade's richest canonical
   * host; completed → Results is the smart default tab) */
  const extIdx = await readJson(`(() => {
    const cards = [...document.querySelectorAll("[data-job]")];
    return JSON.stringify(cards.findIndex((c) => /extract/i.test(c.textContent || "")));
  })()`);
  check("extract card present", typeof extIdx === "number" && extIdx >= 0, `idx=${extIdx}`);

  if (typeof extIdx === "number" && extIdx >= 0) {
    const box = await readJson(`(() => {
      const card = document.querySelectorAll("[data-job]")[${extIdx}];
      const r = card.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 60), inView: r.top >= 0 && r.bottom <= innerHeight });
    })()`);
    check("card center in viewport", !!(box && box.x && box.inView), JSON.stringify(box));
    const clicked = cdpClick(box.x, box.y, 0);
    check("real click on the extract card", clicked, `${box.x},${box.y}`);
    const dialogOpen = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
      return n === true ? n : null;
    }, 15000, 400);
    check("inspector dialog opened", dialogOpen === true);

    /* the strip arrives on the Results tab (smart default): watch its
     * mount + animation state — today: pop-in, zero manners */
    const strip = await pollUntil(async () => {
      const s = await readJson(`(() => {
        const el = document.querySelector("[role='dialog'] [data-key-numbers]");
        if (!el) return "null";
        const cards = [...el.querySelectorAll("[data-stat]")];
        return JSON.stringify({
          anims: el.getAnimations().length,
          cards: cards.map((c) => ({
            stat: c.getAttribute("data-stat"),
            anims: c.getAnimations().length,
            opacity: getComputedStyle(c).opacity,
            animationName: getComputedStyle(c).animationName,
            value: (c.querySelector("p")?.textContent || "").trim(),
          })),
          coverageNote: !!el.querySelector("[data-coverage-note]"),
        });
      })()`);
      return s && s !== "null" ? s : null;
    }, 25000, 400);
    check("key-numbers strip present on extract Results tab", !!strip && typeof strip === "object", JSON.stringify(strip));
    check("strip leads with 2 stat cards", strip?.cards?.length === 2, `cards=${strip?.cards?.length}`);
    check("card values are the counted facts", strip?.cards?.[0]?.value === "10,866" && strip?.cards?.[1]?.value === "5",
      JSON.stringify(strip?.cards?.map((c) => c.value)));
    check("lane gap: strip mounts with ZERO animations (silent count)", strip?.anims === 0 && strip?.cards?.every((c) => c.anims === 0),
      `section=${strip?.anims} cards=${JSON.stringify(strip?.cards?.map((c) => c.anims))}`);
    check("lane gap: opacity 1 at first sight (pop-in, no fade)", strip?.cards?.every((c) => c.opacity === "1"),
      JSON.stringify(strip?.cards?.map((c) => c.opacity)));
    check("lane gap: no arrival word on the cards", strip?.cards?.every((c) => c.animationName === "none"),
      JSON.stringify(strip?.cards?.map((c) => c.animationName)));

    /* leave the world as we found it */
    sh(`agent-browser key Escape >/dev/null 2>&1`);
    await sleep(500);
    const dialogClosed = await readJson(`JSON.stringify(!document.querySelector("[data-inspector-dialog]"))`);
    check("inspector closed (Escape)", dialogClosed === true);
  }

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
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

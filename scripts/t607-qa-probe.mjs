/**
 * t607 — opening QA probe (world read-only): the verdict arrival lane.
 *
 * QA faces: hydrate 12 cards, 12c/13e, 12 dots, console clean, roster 6/1.
 * Lane recon — open the class2d K5 inspector, click Results, and watch the
 * AI verdict stamp ARRIVE: today it is a conditional mount (null until the
 * fetch lands) with zero arrival manner — the opinion pops in silently.
 * Also: the FSC card's container has animate-rise but its curves are all
 * isAnimationActive={false} (the chart world is systemically muted).
 * The gap must be real in the SERVED world, not just in source.
 *
 * Usage: node scripts/t607-qa-probe.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* the verdict lane needs a REAL click (open the inspector) — CDP dedicated
 * port 9326 (9323 = t578, 9324 = t584/t604, 9325 = t605) + fresh profile */
const CDP_PORT = "9326";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t607-harness-chrome-profile";
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

  /* find the class2d card's index (the stamp's only tab host) */
  const cls2dIdx = await readJson(`(() => {
    const cards = [...document.querySelectorAll("[data-job]")];
    return JSON.stringify(cards.findIndex((c) => (c.textContent || "").includes("class2d")));
  })()`);
  check("class2d K5 card present", typeof cls2dIdx === "number" && cls2dIdx >= 0, `idx=${cls2dIdx}`);

  /* open its inspector with a REAL click (t605 W3's dance), then Results */
  if (typeof cls2dIdx === "number" && cls2dIdx >= 0) {
    const box = await readJson(`(() => {
      const card = document.querySelectorAll("[data-job]")[${cls2dIdx}];
      const r = card.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 60), inView: r.top >= 0 && r.bottom <= innerHeight });
    })()`);
    check("card center in viewport", !!(box && box.x && box.inView), JSON.stringify(box));
    const clicked = cdpClick(box.x, box.y, 0);
    check("real click on the class2d card", clicked, `${box.x},${box.y}`);
    const dialogOpen = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
      return n === true ? n : null;
    }, 15000, 400);
    check("inspector dialog opened", dialogOpen === true);

    const resultsClicked = await readJson(`(() => {
      const triggers = [...document.querySelectorAll("[role='dialog'] [role='tab']")];
      const t = triggers.find((el) => (el.textContent || "").trim().startsWith("Results"));
      if (!t) return "false";
      t.click();
      return "true";
    })()`);
    check("Results tab clicked", resultsClicked === "true", `got ${resultsClicked}`);

    /* the stamp arrives on the class2d tab: watch its mount + animation state */
    const stamp = await pollUntil(async () => {
      const s = await readJson(`(() => {
        const el = document.querySelector("[data-canvas-ui='ai-verdict-stamp']");
        if (!el) return "null";
        const anims = el.getAnimations().length;
        const cs = getComputedStyle(el);
        return JSON.stringify({
          anims,
          opacity: cs.opacity,
          animationName: cs.animationName,
          chips: el.querySelectorAll("span[title^='class ']").length,
          hasAdvice: !!el.querySelector("p[title]"),
          footerHasModel: (el.textContent || "").includes("glm-4"),
        });
      })()`);
      return s && s !== "null" ? s : null;
    }, 20000, 400);
    check("verdict stamp present on class2d Results tab", !!stamp && typeof stamp === "object", JSON.stringify(stamp));
    check("lane gap: stamp mounts with ZERO animations (silent arrival)", stamp?.anims === 0, `anims=${stamp?.anims}`);
    check("stamp opacity is 1 at first sight (pop-in, no fade)", stamp?.opacity === "1", `opacity=${stamp?.opacity}`);
    check("stamp carries 5 class chips", stamp?.chips === 5, `chips=${stamp?.chips}`);
    check("stamp carries advice + model footer", stamp?.hasAdvice === true && stamp?.footerHasModel === true);

    /* FSC chart card: container entrance vs muted curves */
    const fsc = await readJson(`(() => {
      const svg = document.querySelector("[role='dialog'] .recharts-wrapper svg");
      if (!svg) return "null";
      const paths = [...svg.querySelectorAll("path.recharts-curve.recharts-line-curve")];
      const animated = paths.filter((p) => p.getAnimations().length > 0).length;
      return JSON.stringify({ linePaths: paths.length, animated });
    })()`);
    check("FSC chart serves line curves", !!fsc && fsc !== "null" && fsc.linePaths >= 1, JSON.stringify(fsc));
    check("lane gap: curves carry zero animations (muted world)", fsc?.animated === 0, `animated=${fsc?.animated}`);

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

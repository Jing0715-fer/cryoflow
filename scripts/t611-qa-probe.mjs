/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t611 — opening QA probe (world read-only): the analytics innards' arrival lane.
 *
 * QA faces: hydrate 12 cards, 12c/13e, 12 dots, console clean, roster 6/1.
 * Lane recon — PipelineAnalytics (dashboard view, Shift+D) leads three
 * at-a-glance views (particle flow funnel / resolution ladder / session
 * timeline). The SECTION rises (animate-rise, t576 family), but the
 * INNARDS have never been scanned: flow rows pop, ladder steps pop,
 * counts included. The gap must be real in the SERVED world, not just
 * in source. The dashboard toggle is a plain window keydown listener
 * (Shift+D, non-Radix) — in-page dispatch is an honest finger here;
 * the view actually appearing is the proof.
 *
 * Host shape recon (for the witness + the budget arithmetic): flow row
 * count (widest cascade), ladder step count, ws chips presence (a
 * no-replay trigger), timeline rows.
 *
 * Usage: node scripts/t611-qa-probe.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* read-only lane needs a REAL navigation into the dashboard — CDP dedicated
 * port 9330 (9323 = t578, 9324 = t584/t604, 9325 = t605, 9326 = t607,
 * 9327 = t608, 9328 = t609, 9329 = t610) + fresh profile */
const CDP_PORT = "9330";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t611-harness-chrome-profile";
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
/* the dashboard toggle: Shift+D on a plain window keydown listener — a
 * synthetic DOM event is a first-class citizen here (not a Radix
 * controlled component); the view appearing is the proof */
const shiftD = () => readJson(`(() => {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "D", shiftKey: true, bubbles: true, cancelable: true }));
  return JSON.stringify(true);
})()`);

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

  /* open the dashboard view */
  const dispatched = await shiftD();
  check("Shift+D dispatched", dispatched === true);
  const dash = await pollUntil(async () => {
    const v = await readJson(`(() => {
      const sec = document.querySelector("section[aria-label='Pipeline analytics']");
      return JSON.stringify(!!sec);
    })()`);
    return v === true ? v : null;
  }, 30000, 400);
  check("dashboard view opened with analytics section", dash === true);

  /* host shape recon — the funnel, the ladder, the timeline, the chips */
  const shape = await readJson(`(() => {
    const sec = document.querySelector("section[aria-label='Pipeline analytics']");
    if (!sec) return "null";
    /* [class*=] avoids the CSS escape for the "group/flow" utility — a
     * backslash in the selector dies in shell transport (bash \\ → \) */
    const rows = [...sec.querySelectorAll("[class*='group/flow']")];
    const barIn = (r) => r.querySelector("div.relative > div.h-full");
    /* ladder reveal buttons end their title with the canvas phrase; the
     * timeline rows' titles continue with a status word (and carry
     * data-tl-row) — the two filters make the set unambiguous */
    const ladderBtns = [...sec.querySelectorAll("button[title$='on the canvas']")].filter((b) => !b.hasAttribute("data-tl-row"));
    const tlRows = [...sec.querySelectorAll("[data-tl-row]")];
    const chips = [...sec.querySelectorAll("[role='group'][aria-label='Filter analytics by workspace'] button")];
    const riseAnim = getComputedStyle(sec).animationName;
    return JSON.stringify({
      flowRows: rows.map((r) => ({
        label: (r.querySelector("span.w-20")?.textContent || "").trim(),
        count: (r.querySelector("span.w-16")?.textContent || "").trim(),
        barAnim: barIn(r) ? getComputedStyle(barIn(r)).animationName : "no-bar",
        rowAnim: getComputedStyle(r).animationName,
      })),
      ladderSteps: ladderBtns.map((b) => ({
        name: (b.querySelector("p")?.textContent || "").trim(),
        val: (b.querySelector("span.text-sm")?.textContent || "").trim(),
        anim: getComputedStyle(b).animationName,
      })),
      timeline: { rows: tlRows.length, anims: tlRows.map((r) => getComputedStyle(r).animationName) },
      wsChips: chips.map((c) => (c.textContent || "").trim()),
      sectionAnim: riseAnim,
    });
  })()`);
  check("analytics shape read", !!shape && typeof shape === "object", JSON.stringify(shape?.flowRows?.length));
  check("flow funnel present (>=2 rows)", (shape?.flowRows?.length || 0) >= 2,
    `${shape?.flowRows?.length} rows: ${JSON.stringify(shape?.flowRows?.map((r) => r.label + "=" + r.count))}`);
  check("lane gap: flow rows mount SILENT (no arrival word)", (shape?.flowRows || []).every((r) => r.rowAnim === "none"),
    JSON.stringify(shape?.flowRows?.map((r) => r.rowAnim)));
  check("lane gap: flow bars mount SILENT (no pour)", (shape?.flowRows || []).every((r) => r.barAnim === "none"),
    JSON.stringify(shape?.flowRows?.map((r) => r.barAnim)));
  check("resolution ladder present (>=1 step)", (shape?.ladderSteps?.length || 0) >= 1,
    `${shape?.ladderSteps?.length} steps: ${JSON.stringify(shape?.ladderSteps?.map((s) => s.name + "=" + s.val))}`);
  check("lane gap: ladder steps mount SILENT", (shape?.ladderSteps || []).every((s) => s.anim === "none"),
    JSON.stringify(shape?.ladderSteps?.map((s) => s.anim)));
  check("section rises (outer layer alive)", shape?.sectionAnim === "rise-in" || shape?.sectionAnim === "dash-enter",
    `anim=${shape?.sectionAnim}`);
  check("ws chips present (no-replay trigger available)", (shape?.wsChips?.length || 0) > 1,
    JSON.stringify(shape?.wsChips));
  check("timeline rows present", (shape?.timeline?.rows || 0) >= 1, `rows=${shape?.timeline?.rows}`);

  /* leave the dashboard the way we came */
  const back = await shiftD();
  await sleep(900);
  const closed = await readJson(`JSON.stringify(!document.querySelector("section[aria-label='Pipeline analytics']"))`);
  check("Shift+D returns to canvas", back === true && closed === true, `analytics gone=${closed}`);

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

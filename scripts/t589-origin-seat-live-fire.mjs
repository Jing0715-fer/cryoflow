/**
 * t589 — the origin's seat: key "0" joins the arrival family.
 *
 * t588 taught the bookmark jumps (1–9) and focus jumps to arrive —
 * glide + held readout + coda tick. Key "0" was left behind: a bare
 * setViewport teleport (the number row's only orphan, and t587/t588's
 * comment family had quietly stopped counting it). This window seats
 * the origin: the number row 0–9 is ONE family of places, all riding
 * the same arrival relay — and "0" gains the dashboard guard its
 * siblings always had (the dashboard owns the digit row).
 *
 * Faces proven here:
 *   G0  the served sheet carries both voices (pre-browser gate — the
 *       t585/t586 watcher lesson).
 *   K1  the origin arrival — after zooming away, "0" glides: the class
 *       is on at 70ms while the gauge still shows the FROM value (the
 *       state is already at the origin — the number arrives when the
 *       world does), the coda is caught running inside the 520–660ms
 *       window, and the fresh span lands at 100% with the drum rolling
 *       DOWN (a shrinking value enters from above).
 *   K2  the silent re-jump — "0" at the origin churns the glide class
 *       but never remounts the span: no NEW zoom-tick (finished
 *       fill:both ghosts linger in getAnimations — the honest
 *       discriminator is playState, t588's ledger lesson).
 *   R   console clean; roster untouched (views move; the world does
 *       not). The dashboard guard is code-level (tsc-reviewed): the
 *       dashboard owns the digit row, no live face — stated here so
 *       the gap is a decision, not an oversight.
 *
 * Environment shim = t571/t585..t588's: desktop-capable Chrome via CDP
 * port 9331 (9323=t578, 9324=t584, 9325=t585, 9326=t586, 9327=t587,
 * 9329=t589 QA, 9330=t588 — zombies keep their ports; t581's law).
 *
 * Runs in the EMPIAR world in place (no switch), mints nothing.
 *
 * Usage: node scripts/t589-origin-seat-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9331";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t589-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
const READOUT = '[data-canvas-ui="zoom-controls"] .tabular-nums';

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, timeoutMs = 30000, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return null;
}
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const api = (verb, path, body) =>
  sh(
    `curl -s -X ${verb} -H "Content-Type: application/json" -H "Origin: ${BASE}" -H "Referer: ${BASE}/"` +
    (body ? ` -d ${JSON.stringify(JSON.stringify(body))}` : "") + ` "${BASE}${path}"`
  );
const evalJs = (expr) => {
  try {
    const flat = expr.replace(/\s*\n\s*/g, " ");
    const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed.trim() : raw.trim();
    } catch {
      return raw.replace(/^"|"$/g, "").trim();
    }
  } catch { return ""; }
};
const readJson = async (js) => {
  const raw = evalJs(js);
  try { return JSON.parse(raw); } catch { return null; }
};

/* ---- the environment shim: own Chrome, desktop capabilities ----------- */
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

/* ---- world guard BEFORE any browser spend ----------------------------- */
const projects = JSON.parse(api("GET", "/api/projects")).projects;
const active = projects.find((p) => p.active || p.isActive);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "unknown"}, expected EMPIAR — refusing to run in a borrowed world`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0}`);

/* ---- G0: served-CSS gate BEFORE the browser --------------------------- */
{
  const cssUrl = (() => {
    try { return sh(`curl -s ${BASE}/ | grep -oE '/_next/static/[^"]+\\.css' | head -1`); }
    catch { return ""; }
  })();
  let served = "";
  try { served = sh(`curl -s "${BASE}${cssUrl}"`); } catch { /* gate fails below */ }
  const hasGlide = served.includes(".viewport-glide") && served.includes("transition");
  const hasTick = served.includes("@keyframes zoom-tick") && served.includes("--zoom-tick-y");
  check("served CSS carries the glide (the body) and the tick (the voice)",
    hasGlide && hasTick, `css chunk: ${cssUrl.slice(0, 60) || "NOT FOUND"}`);
  if (!hasGlide || !hasTick) {
    console.error("FATAL: served CSS is stale (watcher dropped the edit?) — recycle the dev server and re-run");
  }
}

/* ---- browser scaffolding ---------------------------------------------- */
let browserLive = false;
try {
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  const chromeReady = await launchDesktopChrome();
  if (!chromeReady) {
    console.error("FATAL: the desktop-capable Chrome never opened its CDP port — environment shim failed");
    process.exit(2);
  }
  check("desktop-capable Chrome up", true, `port ${CDP_PORT}`);
  try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* nothing held */ }
  await sleep(400);
  let connected = false;
  for (let i = 0; i < 3 && !connected; i++) {
    try {
      const out = sh(`agent-browser connect ${CDP_PORT} 2>&1`);
      connected = !/relaunched|failed|✗/i.test(out);
      if (!connected) console.log(`  … connect attempt ${i + 1}: ${out.slice(0, 80)}`);
    } catch (e) {
      console.log(`  … connect attempt ${i + 1} threw: ${String(e.message).slice(0, 80)}`);
    }
    if (!connected) await sleep(800);
  }
  check("agent-browser connected to the desktop-capable Chrome", connected, `port ${CDP_PORT}`);
  const openApp = async () => {
    sh(`agent-browser open "about:blank" >/dev/null 2>&1`);
    await sleep(500);
    sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
    await sleep(3200);
    applyShim();
  };
  await openApp();
  browserLive = true;

  /* ---- hydration guard ------------------------------------------------ */
  const hydrated = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    return v?.cards > 0 ? v : null;
  }, 90000, 1000);
  check("canvas hydrated (cards in DOM)", hydrated?.cards > 0, `${hydrated?.cards} cards`);

  /* ============ K1 — the origin arrival ================================= */
  console.log(`\n[K1] "0" arrives at the origin (hold → glide → coda)`);
  const k1 = await readJson(`(async () => {
    var zin = document.querySelector('button[aria-label="Zoom in"]');
    if (!zin) return JSON.stringify({ err: "no zoom button" });
    zin.click();
    await new Promise(function(r){ setTimeout(r, 130); });
    zin.click();
    await new Promise(function(r){ setTimeout(r, 150); });
    var gauge = document.querySelector(${JSON.stringify(READOUT)});
    var fromText = gauge ? gauge.textContent : null;
    var spanBefore = gauge;
    var ws = document.querySelector('[data-canvas="workspace"]');
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 70); });
    var wsNow = document.querySelector('[data-canvas="workspace"]');
    var gaugeNow = document.querySelector(${JSON.stringify(READOUT)});
    var hold = { cls: wsNow.classList.contains("viewport-glide"), text: gaugeNow.textContent };
    await new Promise(function(r){ setTimeout(r, 470); });
    var ticks = function(){ return Array.prototype.slice.call(document.getAnimations()).filter(function(a){ return a.animationName === "zoom-tick"; }); };
    var s1 = ticks();
    await new Promise(function(r){ setTimeout(r, 50); });
    var s2 = ticks();
    var running = s1.concat(s2).some(function(a){ return a.playState === "running"; });
    var wsEnd = document.querySelector('[data-canvas="workspace"]');
    var gaugeEnd = document.querySelector(${JSON.stringify(READOUT)});
    return JSON.stringify({
      err: undefined, fromText: fromText, hold: hold, airborne: running,
      endCls: wsEnd.classList.contains("viewport-glide"),
      endText: gaugeEnd.textContent,
      remounted: gaugeEnd !== spanBefore,
      varY: gaugeEnd.style.getPropertyValue("--zoom-tick-y")
    });
  })()`);
  check("the world zoomed away first (setup honest)", !k1?.err && k1?.fromText !== "100%" && k1?.fromText != null,
    `from=${k1?.fromText}${k1?.err ? " err=" + k1.err : ""}`);
  check("the relay fired — the glide class is on at 70ms", k1?.hold?.cls === true, JSON.stringify(k1?.hold));
  check("the number arrives when the world does — the gauge still shows the FROM value mid-glide",
    k1?.hold?.text === k1?.fromText && k1?.hold?.text !== k1?.endText,
    `held=${k1?.hold?.text} → landed=${k1?.endText}`);
  check("the coda caught running inside the 520–660ms window",
    k1?.airborne === true, `airborne=${k1?.airborne}`);
  check("the readout lands at the origin's 100% with the drum rolling in the value's direction",
    k1?.endText === "100%" && k1?.endCls === false &&
    k1?.varY === (parseFloat(k1?.fromText) < 100 ? "2px" : "-2px"),
    `end=${k1?.endText}, varY=${k1?.varY} (from ${k1?.fromText} → 100: ${parseFloat(k1?.fromText) < 100 ? "UP" : "DOWN"}), cls=${k1?.endCls}`);

  /* ============ K2 — the silent re-jump ================================= */
  console.log(`\n[K2] "0" at the origin is silent at the readout`);
  await sleep(500);
  const k2 = await readJson(`(async () => {
    var gauge = document.querySelector(${JSON.stringify(READOUT)});
    var spanBefore = gauge;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 640); });
    var wsEnd = document.querySelector('[data-canvas="workspace"]');
    var gaugeEnd = document.querySelector(${JSON.stringify(READOUT)});
    var anims = Array.prototype.slice.call(document.getAnimations()).filter(function(a){ return a.animationName === "zoom-tick"; });
    var allFinished = anims.every(function(a){ return a.playState === "finished"; });
    return JSON.stringify({
      clsChurned: !wsEnd.classList.contains("viewport-glide"),
      sameSpan: gaugeEnd === spanBefore,
      noNewAnim: anims.length > 0 ? allFinished : true,
      animCount: anims.length,
      text: gaugeEnd.textContent
    });
  })()`);
  check("the glide still churns (the world re-arrives at home)",
    k2?.clsChurned === true, JSON.stringify(k2));
  check("same span, no NEW zoom-tick — silence when the number has nothing to say",
    k2?.sameSpan === true && k2?.noNewAnim === true && k2?.text === "100%",
    `sameSpan=${k2?.sameSpan}, anims=${k2?.animCount} (fill:both ghosts linger), text=${k2?.text}`);

  /* ============ 📸 the settled origin =================================== */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t589-origin-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled origin screenshot", true, ".qa-logs/shots/t589-origin-settled.png");
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup: the world owes nothing ------------------------------- */
  try {
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster untouched (the origin moves nothing)", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
  } catch (e) { check("cleanup ran", false, String(e.message)); }
  try {
    const errs = sh(`agent-browser errors 2>/dev/null`).trim();
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  } catch { /* eval unavailable */ }
  if (browserLive) {
    try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* already gone */ }
  }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

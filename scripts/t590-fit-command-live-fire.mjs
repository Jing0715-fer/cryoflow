/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t590 — the third scale command finds its voice: "Zoom to fit" ticks.
 *
 * t587 gave the gauge its odometer tick and drew the surface: commands
 * (± / reset) speak, systemic fits (birth / memory restore / auto-arrange)
 * stay silent, arrivals ride the dialogue. t588–t589 taught the places to
 * glide; t589's ledger then named the last scale-command orphan: the
 * context menu's "Zoom to fit workflow" — a rescale of the view that
 * moved the world without a sound. This window wires the third throat:
 * fit joins ± and reset in the command family (instant world, tick at
 * launch, "no change, no sound" for free), and the voice boundary is
 * declared at the CALLERS of frameBounds, not inside it.
 *
 * Faces proven here:
 *   G0  the served sheet carries both voices (pre-browser gate — the
 *       t585/t586 watcher lesson; this window is TSX-only wiring, so the
 *       gate is chiefly a world-aliveness check).
 *   Q   world QA — 12 cards, 13 edges, find-bar smoke (13 chips, clean
 *       escape): the canvas is healthy before the command faces run.
 *   F1  the fit command's first word — zoom away, fit from the context
 *       menu: a zoom-tick caught running mid-flight, the drum direction
 *       derived from the world's own values (t589's law — the assertion
 *       compares the world's numbers, never the author's guess), the
 *       fresh span carrying data-zoom-tick, and the gauge back at the
 *       fitted percent.
 *   F2  no change, no sound — a second fit at the already-fitted zoom
 *       keeps the SAME span node and starts no new animation (finished
 *       fill:both ghosts linger in the ledger; playState is the honest
 *       discriminator, t588's lesson).
 *   F3  birth silence — after a reload the gauge span carries NO
 *       data-zoom-tick: the initial fit (and the memory restore) are
 *       systemic callers and never tick (the arming-edge law, t590's
 *       generalized boundary).
 *   F4  the newest voice wins — mid-glide ("0" already gliding home),
 *       fit reclaims the number: one launch tick (down, fitted < held),
 *       the pending arrival coda reads from == to and goes silent, the
 *       retract timer still removes the glide class, the gauge lands at
 *       the fitted percent.
 *   F5  the siblings still speak — ± ticks up, the menu's reset ticks
 *       down to 100%: wiring the third throat did not unplug the two
 *       that already had voices.
 *   R   console clean; roster untouched (views move; the world does not).
 *
 * Environment shim = t571/t585..t589's: desktop-capable Chrome via CDP
 * port 9332 (9323=t578, 9324=t584, 9325=t585, 9326=t586, 9327=t587,
 * 9328=t587 probe, 9329=t589 QA, 9330=t588, 9331=t589 — zombies keep
 * their ports; t581's law).
 *
 * Runs in the EMPIAR world in place (no switch), mints nothing.
 *
 * Usage: node scripts/t590-fit-command-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9332";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t590-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
const READOUT = '[data-canvas-ui="zoom-controls"] .tabular-nums';
const VIEWPORT = '[data-canvas="viewport"]';

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

  /* ============ Q — world QA ============================================ */
  console.log(`\n[Q] world QA — cards, edges, find-bar smoke`);
  const q = await readJson(`JSON.stringify({
    cards: document.querySelectorAll('[data-job]').length,
    edges: document.querySelectorAll('[data-edge-id]').length
  })`);
  check("canvas geometry: 12 cards, 13 lines",
    q?.cards === 12 && q?.edges === 13, `cards=${q?.cards}, edges=${q?.edges}`);
  const qf = await readJson(`(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true, cancelable: true }));
    await new Promise(function(r){ setTimeout(r, 450); });
    var bar = document.querySelector("[data-canvas-find-bar]");
    var chips = document.querySelectorAll("[data-find-chip]").length;
    return JSON.stringify({ opened: !!bar, chips: chips });
  })()`);
  // the close belongs to the input's onKeyDown — only a REAL key through
  // the focused field reaches it (synthetic document events never do),
  // so the close is fired the honest way: a CDP-level Escape press
  try { sh(`agent-browser press Escape >/dev/null 2>&1`); } catch { /* face fails below */ }
  await sleep(500);
  const qfClose = await readJson(`JSON.stringify({ closed: !document.querySelector("[data-canvas-find-bar]") })`);
  check("find bar smoke: opens with 13 chips, escapes clean",
    qf?.opened === true && qf?.chips === 13 && qfClose?.closed === true,
    `opened=${qf?.opened}, chips=${qf?.chips}, closed=${qfClose?.closed}`);

  /* ---- shared helpers for the command faces ---------------------------- */
  const openBgMenu = `var vp = document.querySelector(${JSON.stringify(VIEWPORT)});
    vp.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 640, clientY: 300 }));
    await new Promise(function(r){ setTimeout(r, 300); });
    var items = Array.prototype.slice.call(document.querySelectorAll('[role="menuitem"]'));`;
  const tickAnims = `Array.prototype.slice.call(document.getAnimations()).filter(function(a){ return a.animationName === "zoom-tick"; })`;

  /* ============ F1 — the fit command's first word ======================== */
  console.log(`\n[F1] "Zoom to fit workflow" speaks from the context menu`);
  await sleep(400);
  // zoom AWAY from the fitted value with two toolbar minus steps — the
  // world's own numbers (not the author's guess) will define the direction
  const f1 = await readJson(`(async () => {
    var zout = document.querySelector('button[aria-label="Zoom out"]');
    if (!zout) return JSON.stringify({ err: "no zoom-out button" });
    zout.click();
    await new Promise(function(r){ setTimeout(r, 150); });
    zout.click();
    await new Promise(function(r){ setTimeout(r, 200); });
    var away = document.querySelector(${JSON.stringify(READOUT)}).textContent;
    ${openBgMenu}
    var target = items.filter(function(i){ return i.textContent.indexOf("Zoom to fit") !== -1; })[0];
    if (!target) return JSON.stringify({ err: "no fit item", items: items.length });
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    target.click();
    await new Promise(function(r){ setTimeout(r, 45); });
    var spanA = document.querySelector(${JSON.stringify(READOUT)});
    var a = ${tickAnims};
    var midA = a.some(function(x){ return x.playState === "running"; });
    var varY = spanA ? spanA.style.getPropertyValue("--zoom-tick-y") : null;
    var hasAttr = spanA ? spanA.hasAttribute("data-zoom-tick") : false;
    await new Promise(function(r){ setTimeout(r, 55); });
    var b = ${tickAnims};
    var midB = b.some(function(x){ return x.playState === "running"; });
    await new Promise(function(r){ setTimeout(r, 500); });
    var spanEnd = document.querySelector(${JSON.stringify(READOUT)});
    return JSON.stringify({
      away: away, midRunning: midA || midB, varY: varY, hasAttr: hasAttr,
      fitted: spanEnd ? spanEnd.textContent : null
    });
  })()`);
  check("the command ticks — a zoom-tick caught running mid-flight",
    f1?.midRunning === true, `midRunning=${f1?.midRunning}`);
  const expectedVarY = f1 && parseFloat(f1.away) < parseFloat(f1.fitted) ? "2px" : "-2px";
  check("the drum rolls in the world's own direction",
    f1?.varY === expectedVarY, `varY=${f1?.varY} (from ${f1?.away} → ${f1?.fitted}: expected ${expectedVarY})`);
  check("the fresh span carries the tick attribute",
    f1?.hasAttr === true, `data-zoom-tick=${f1?.hasAttr}`);
  check("the gauge lands back at the fitted percent",
    f1?.fitted && f1?.fitted !== f1?.away && parseFloat(f1.fitted) > 0,
    `${f1?.away} → ${f1?.fitted}`);

  /* ============ F2 — no change, no sound ================================= */
  console.log(`\n[F2] a second fit at the fitted zoom is silent`);
  await sleep(400);
  const f2 = await readJson(`(async () => {
    var spanBefore = document.querySelector(${JSON.stringify(READOUT)});
    ${openBgMenu}
    var target = items.filter(function(i){ return i.textContent.indexOf("Zoom to fit") !== -1; })[0];
    if (!target) return JSON.stringify({ err: "no fit item", items: items.length });
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    target.click();
    await new Promise(function(r){ setTimeout(r, 650); });
    var spanAfter = document.querySelector(${JSON.stringify(READOUT)});
    var anims = ${tickAnims};
    var running = anims.some(function(x){ return x.playState === "running"; });
    return JSON.stringify({
      sameSpan: spanAfter === spanBefore, anyRunning: running,
      count: anims.length, text: spanAfter.textContent
    });
  })()`);
  check("same span node — the key never churned",
    f2?.sameSpan === true, `sameSpan=${f2?.sameSpan}`);
  check("no new animation — finished ghosts linger, running is empty",
    f2?.anyRunning === false && f2?.count > 0,
    `count=${f2?.count} (fill:both ghosts), running=${f2?.anyRunning}, text=${f2?.text}`);

  /* ============ F3 — birth silence ======================================= */
  console.log(`\n[F3] after a reload the initial fit never ticks`);
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3500);
  const f3 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    return v?.cards > 0 ? v : null;
  }, 90000, 1000);
  check("world rehydrated after reload", f3?.cards > 0, `${f3?.cards} cards`);
  await sleep(800);
  const f3v = await readJson(`JSON.stringify({
    hasAttr: !!document.querySelector(${JSON.stringify(READOUT)}) &&
             document.querySelector(${JSON.stringify(READOUT)}).hasAttribute("data-zoom-tick"),
    text: document.querySelector(${JSON.stringify(READOUT)}) ? document.querySelector(${JSON.stringify(READOUT)}).textContent : null
  })`);
  check("the birth is silent — no data-zoom-tick on the fresh readout",
    f3v?.hasAttr === false, `hasAttr=${f3v?.hasAttr}, text=${f3v?.text} (systemic fits never tick)`);

  /* ============ F4 — the newest voice wins =============================== */
  console.log(`\n[F4] fit mid-glide reclaims the number, the pending coda goes silent`);
  const f4 = await readJson(`(async () => {
    var zin = document.querySelector('button[aria-label="Zoom in"]');
    if (!zin) return JSON.stringify({ err: "no zoom-in button" });
    zin.click();
    await new Promise(function(r){ setTimeout(r, 200); });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 150); });
    var wsMid = document.querySelector('[data-canvas="workspace"]');
    var gliding = wsMid.classList.contains("viewport-glide");
    ${openBgMenu}
    var target = items.filter(function(i){ return i.textContent.indexOf("Zoom to fit") !== -1; })[0];
    if (!target) return JSON.stringify({ err: "no fit item", items: items.length });
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    target.click();
    await new Promise(function(r){ setTimeout(r, 45); });
    var spanA = document.querySelector(${JSON.stringify(READOUT)});
    var a = ${tickAnims};
    var launchRunning = a.some(function(x){ return x.playState === "running"; });
    var launchVarY = spanA ? spanA.style.getPropertyValue("--zoom-tick-y") : null;
    await new Promise(function(r){ setTimeout(r, 700); });
    var wsEnd = document.querySelector('[data-canvas="workspace"]');
    var spanEnd = document.querySelector(${JSON.stringify(READOUT)});
    var animsEnd = ${tickAnims};
    var runningEnd = animsEnd.filter(function(x){ return x.playState === "running"; }).length;
    return JSON.stringify({
      glidingAtFit: gliding, launchRunning: launchRunning, launchVarY: launchVarY,
      glideClassGone: !wsEnd.classList.contains("viewport-glide"),
      runningAtEnd: runningEnd, animsAtEnd: animsEnd.length,
      text: spanEnd.textContent
    });
  })()`);
  check("the world was mid-glide when the command fired",
    f4?.glidingAtFit === true, `glidingAtFit=${f4?.glidingAtFit}`);
  check("exactly one launch tick (down — fitted below the held value), no second from the coda",
    f4?.launchRunning === true && f4?.launchVarY === "-2px" && f4?.runningAtEnd === 0,
    `launchVarY=${f4?.launchVarY}, runningAtEnd=${f4?.runningAtEnd} (the coda read from == to)`);
  check("the retract timer still served the glide class, the gauge landed at the fitted percent",
    f4?.glideClassGone === true && f4?.text && f4?.text.indexOf("%") > 0,
    `glideClassGone=${f4?.glideClassGone}, text=${f4?.text}`);

  /* ============ F5 — the siblings still speak ============================ */
  console.log(`\n[F5] ± and reset keep their t587 voices`);
  await sleep(300);
  const f5 = await readJson(`(async () => {
    var zin = document.querySelector('button[aria-label="Zoom in"]');
    zin.click();
    await new Promise(function(r){ setTimeout(r, 45); });
    var spanA = document.querySelector(${JSON.stringify(READOUT)});
    var a = ${tickAnims};
    var plusTick = a.some(function(x){ return x.playState === "running"; });
    var plusVarY = spanA ? spanA.style.getPropertyValue("--zoom-tick-y") : null;
    await new Promise(function(r){ setTimeout(r, 400); });
    ${openBgMenu}
    var target = items.filter(function(i){ return i.textContent.indexOf("Reset view") !== -1; })[0];
    if (!target) return JSON.stringify({ err: "no reset item", items: items.length });
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    target.click();
    await new Promise(function(r){ setTimeout(r, 45); });
    var spanB = document.querySelector(${JSON.stringify(READOUT)});
    var b = ${tickAnims};
    var resetTick = b.some(function(x){ return x.playState === "running"; });
    await new Promise(function(r){ setTimeout(r, 500); });
    var spanEnd = document.querySelector(${JSON.stringify(READOUT)});
    return JSON.stringify({
      plusTick: plusTick, plusVarY: plusVarY, resetTick: resetTick,
      end: spanEnd.textContent
    });
  })()`);
  check("zoom-in still ticks up", f5?.plusTick === true && f5?.plusVarY === "2px",
    `plusVarY=${f5?.plusVarY}`);
  check("menu reset still ticks down to 100%",
    f5?.resetTick === true && f5?.end === "100%",
    `resetTick=${f5?.resetTick}, end=${f5?.end}`);

  /* ============ 📸 the settled canvas ==================================== */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t590-fit-command-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled canvas screenshot", true, ".qa-logs/shots/t590-fit-command-settled.png");
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup: the world owes nothing ------------------------------- */
  try {
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster untouched (the fit moves nothing)", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
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

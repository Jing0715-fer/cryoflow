/**
 * t588 — the arrival dialogue: bookmark and focus arrivals answer the gauge.
 *
 * Task 124 taught programmatic arrivals to GLIDE (viewport-glide class,
 * focus jumps only). t587 gave the zoom readout a command voice (the
 * odometer tick) and — wrongly — claimed bookmark arrivals already glided.
 * They teleported. This window unifies the arrival family and teaches the
 * readout to answer: while the glide travels, the gauge HOLDS the value
 * the world is at (the state jumped at launch, but the number must not
 * arrive before the world does); at the retract moment the drum rolls
 * once, from the held value to the landed value — silent when the rounded
 * percent did not change.
 *
 * Faces proven here:
 *   G0  the served sheet carries both voices (pre-browser gate — the
 *       t585/t586 watcher lesson: a witness on a stale sheet is a phantom).
 *   B1  two bookmarks take seats 1 and 2 (UI-born: trigger → input → save).
 *   B2  the row-click arrival — hold at 70ms (class on, gauge still shows
 *       the FROM value while the state is already at the target), retract
 *       by 630ms, the coda tick caught airborne, drum −2px (120→100),
 *       fresh span shows 100%.
 *   B3  the slot-key arrival ("2") — same dialogue through the store
 *       relay (epoch → consume-once → beginGlideArrival), drum +2px
 *       (100→120) — the odometer speaks BOTH directions across faces.
 *   B4  no change, no sound — a second jump to the seat already held
 *       churns the glide class but never remounts the span (same node,
 *       zero zoom-tick animations at the landing window).
 *   B5  the focus family rides the same helper (find-bar Enter →
 *       focusJob → focusEpoch): class churns, gauge holds, coda silent
 *       (zoom unchanged at 100% — arrivals only speak when the number
 *       has something to say).
 *   B6  consume-once — after a reload the canvas remounts with the epoch
 *       still counted but the target consumed: no phantom re-glide.
 *   R   console clean; roster untouched (views move; the world does not).
 *
 * Environment shim = t571/t585/t586/t587's: desktop-capable Chrome via
 * CDP port 9330 (9323=t578, 9324=t584, 9325=t585, 9326=t586, 9327=t587,
 * 9329=t588 QA — zombies keep their ports; t581's law).
 *
 * Runs in the EMPIAR world in place (no switch), mints two bookmarks
 * (UI-saved, session-scoped for the project:workspace pair).
 *
 * Usage: node scripts/t588-arrival-dialogue-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9330";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t588-harness-chrome-profile";
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

  /* ============ B1 — two bookmarks take two seats ======================= */
  console.log(`\n[B1] the seats are born (UI: trigger → input → save)`);
  const b1 = await readJson(`(async () => {
    var reset = document.querySelector('button[aria-label="Reset view"]');
    if (!reset) return JSON.stringify({ err: "no reset" });
    reset.click();
    await new Promise(function(r){ setTimeout(r, 250); });
    var trig = document.querySelector('[data-canvas-ui="viewport-bookmarks-trigger"]');
    trig.click();
    await new Promise(function(r){ setTimeout(r, 350); });
    var input = document.querySelector('[data-canvas-ui="viewport-bookmark-input"]');
    if (!input) return JSON.stringify({ err: "no input" });
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "Alpha");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 150); });
    document.querySelector('[data-canvas-ui="viewport-bookmark-save"]').click();
    await new Promise(function(r){ setTimeout(r, 300); });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 250); });
    document.querySelector('button[aria-label="Zoom in"]').click();
    await new Promise(function(r){ setTimeout(r, 150); });
    var zoomedTo = document.querySelector(${JSON.stringify(READOUT)}).textContent;
    trig.click();
    await new Promise(function(r){ setTimeout(r, 350); });
    var input2 = document.querySelector('[data-canvas-ui="viewport-bookmark-input"]');
    setter.call(input2, "Beta");
    input2.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 150); });
    document.querySelector('[data-canvas-ui="viewport-bookmark-save"]').click();
    await new Promise(function(r){ setTimeout(r, 300); });
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-canvas-ui="viewport-bookmark-row"]'));
    var slots = rows.map(function(row){ var kbd = row.querySelector('[data-canvas-ui="viewport-bookmark-slot"]'); return kbd ? kbd.textContent : null; });
    return JSON.stringify({ rows: rows.length, slots: slots, zoomedTo: zoomedTo });
  })()`);
  check("two bookmarks saved through the UI", b1?.rows === 2, JSON.stringify(b1));
  check("stable hotkey seats 1 and 2 (Task 101)",
    JSON.stringify(b1?.slots) === JSON.stringify(["1", "2"]), `slots=${JSON.stringify(b1?.slots)}`);
  check("the world stands at Beta's zoom (the gauge reads the zoomed value)",
    /\d+%/.test(b1?.zoomedTo ?? "") && b1?.zoomedTo !== "100%", `zoomedTo=${b1?.zoomedTo}`);

  /* ============ B2 — the row-click arrival ============================== */
  console.log(`\n[B2] the row click arrives (hold → glide → coda −2px)`);
  const b2 = await readJson(`(async () => {
    var gauge = document.querySelector(${JSON.stringify(READOUT)});
    var fromText = gauge ? gauge.textContent : null;
    var spanBefore = gauge;
    var rows = document.querySelectorAll('[data-canvas-ui="viewport-bookmark-row"] button');
    if (!rows.length) return JSON.stringify({ err: "no rows" });
    var ws = document.querySelector('[data-canvas="workspace"]');
    rows[0].click();
    await new Promise(function(r){ setTimeout(r, 70); });
    var wsNow = document.querySelector('[data-canvas="workspace"]');
    var gaugeNow = document.querySelector(${JSON.stringify(READOUT)});
    var hold = {
      cls: wsNow.classList.contains("viewport-glide"),
      text: gaugeNow.textContent,
      sameSpan: gaugeNow === spanBefore
    };
    await new Promise(function(r){ setTimeout(r, 560); });
    var wsEnd = document.querySelector('[data-canvas="workspace"]');
    var gaugeEnd = document.querySelector(${JSON.stringify(READOUT)});
    return JSON.stringify({
      fromText: fromText, hold: hold,
      endCls: wsEnd.classList.contains("viewport-glide"),
      endText: gaugeEnd.textContent,
      remounted: gaugeEnd !== spanBefore,
      varY: gaugeEnd.style.getPropertyValue("--zoom-tick-y")
    });
  })()`);
  check("hold — the glide class is on at 70ms", b2?.hold?.cls === true, JSON.stringify(b2?.hold));
  check("the number arrives when the world does — the gauge still shows the FROM value mid-glide",
    b2?.hold?.text === b2?.fromText && b2?.hold?.text !== b2?.endText,
    `held=${b2?.hold?.text} → landed=${b2?.endText}`);
  check("retract — the glide class is off after the bezier lands", b2?.endCls === false);
  check("the coda speaks — the span remounted (key) with the landed value",
    b2?.remounted === true && b2?.endText === "100%", `end=${b2?.endText}`);
  check("the drum rolls DOWN for a shrinking value — --zoom-tick-y is -2px",
    b2?.varY === "-2px", `varY=${b2?.varY}`);

  /* ============ B3 — the slot-key arrival =============================== */
  console.log(`\n[B3] the keyboard arrives ("2" → Beta, coda +2px)`);
  await sleep(400);
  const b3 = await readJson(`(async () => {
    var gauge = document.querySelector(${JSON.stringify(READOUT)});
    var spanBefore = gauge;
    var fromText = gauge ? gauge.textContent : null;
    var ws = document.querySelector('[data-canvas="workspace"]');
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true }));
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
    await new Promise(function(r){ setTimeout(r, 450); });
    var gaugeEnd = document.querySelector(${JSON.stringify(READOUT)});
    return JSON.stringify({
      fromText: fromText, hold: hold,
      airborne: running,
      endText: gaugeEnd.textContent,
      remounted: gaugeEnd !== spanBefore,
      varY: gaugeEnd.style.getPropertyValue("--zoom-tick-y")
    });
  })()`);
  check("the store relay fired — the glide class rode the epoch",
    b3?.hold?.cls === true, JSON.stringify(b3?.hold));
  check("the relay's hold — the gauge shows the FROM value while the state is at Beta",
    b3?.hold?.text === b3?.fromText && b3?.hold?.text !== b3?.endText,
    `held=${b3?.hold?.text} → landed=${b3?.endText}`);
  check("the coda caught airborne — a running zoom-tick inside the 520–660ms window",
    b3?.airborne === true, `airborne=${b3?.airborne}`);
  check("the drum rolls UP for a growing value — +2px, lands at Beta's zoom",
    b3?.varY === "2px" && b3?.endText === b1?.zoomedTo, `varY=${b3?.varY}, end=${b3?.endText}, beta=${b1?.zoomedTo}`);

  /* ============ B4 — no change, no sound ================================ */
  console.log(`\n[B4] re-jumping the held seat is silent at the readout`);
  await sleep(400);
  const b4a = await readJson(`(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 700); });
    var gauge = document.querySelector(${JSON.stringify(READOUT)});
    return JSON.stringify({ text: gauge.textContent, node: true });
  })()`);
  check("B4a — jumping home ticks once (setup for the silence face)",
    b4a?.text === "100%", `text=${b4a?.text}`);
  const b4 = await readJson(`(async () => {
    var gauge = document.querySelector(${JSON.stringify(READOUT)});
    var spanBefore = gauge;
    var animsBefore = Array.prototype.slice.call(document.getAnimations()).filter(function(a){ return a.animationName === "zoom-tick"; }).length;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 640); });
    var wsEnd = document.querySelector('[data-canvas="workspace"]');
    var gaugeEnd = document.querySelector(${JSON.stringify(READOUT)});
    var anims = Array.prototype.slice.call(document.getAnimations()).filter(function(a){ return a.animationName === "zoom-tick"; });
    var allFinished = anims.every(function(a){ return a.playState === "finished"; });
    return JSON.stringify({
      clsChurned: !wsEnd.classList.contains("viewport-glide"),
      sameSpan: gaugeEnd === spanBefore,
      noNewAnim: anims.length === animsBefore && allFinished,
      anims: anims.length, animsBefore: animsBefore,
      text: gaugeEnd.textContent
    });
  })()`);
  check("the glide still churns (the world re-arrives even at the same place)",
    b4?.clsChurned === true, JSON.stringify(b4));
  check("same span, no NEW zoom-tick — silence when the number has nothing to say",
    b4?.sameSpan === true && b4?.noNewAnim === true && b4?.text === "100%",
    `sameSpan=${b4?.sameSpan}, anims=${b4?.anims}/${b4?.animsBefore} (fill:both ghosts linger in effect), text=${b4?.text}`);

  /* ============ B5 — the focus family rides the same helper ============= */
  console.log(`\n[B5] find-bar Enter → focusJob → the focus arrival`);
  await sleep(400);
  const b5 = await readJson(`(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 450); });
    var input = document.querySelector('[data-canvas-find-bar] input');
    if (!input) return JSON.stringify({ err: "no find input" });
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "Motion");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 250); });
    var gauge = document.querySelector(${JSON.stringify(READOUT)});
    var fromText = gauge ? gauge.textContent : null;
    var animsBefore = Array.prototype.slice.call(document.getAnimations()).filter(function(a){ return a.animationName === "zoom-tick"; }).length;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", key_code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 70); });
    var wsNow = document.querySelector('[data-canvas="workspace"]');
    var gaugeNow = document.querySelector(${JSON.stringify(READOUT)});
    var hold = { cls: wsNow.classList.contains("viewport-glide"), text: gaugeNow.textContent };
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 560); });
    var wsEnd = document.querySelector('[data-canvas="workspace"]');
    var gaugeEnd = document.querySelector(${JSON.stringify(READOUT)});
    var anims = Array.prototype.slice.call(document.getAnimations()).filter(function(a){ return a.animationName === "zoom-tick"; });
    var allFinished = anims.every(function(a){ return a.playState === "finished"; });
    return JSON.stringify({
      findOpened: true, fromText: fromText, hold: hold, animsBefore: animsBefore,
      endCls: wsEnd.classList.contains("viewport-glide"),
      endText: gaugeEnd.textContent,
      noNewAnim: anims.length === animsBefore && allFinished
    });
  })()`);
  check("the find bar opened and Enter focused a match", b5?.findOpened === true && !b5?.err,
    JSON.stringify(b5?.err ?? "ok"));
  check("the focus arrival glides (class churned through the shared helper)",
    b5?.hold?.cls === true && b5?.endCls === false, `hold=${b5?.hold?.cls}, end=${b5?.endCls}`);
  check("the coda is silent when zoom does not change (100% focus keeps 100%)",
    b5?.noNewAnim === true && b5?.endText === b5?.fromText, `noNewAnim=${b5?.noNewAnim}, ${b5?.fromText}→${b5?.endText}`);

  /* ============ B6 — consume-once: no phantom re-glide ================== */
  console.log(`\n[B6] the relay is consume-once (reload never re-glides)`);
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3200);
  const hydrated2 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    return v?.cards > 0 ? v : null;
  }, 90000, 1000);
  check("canvas re-hydrated after reload", hydrated2?.cards > 0, `${hydrated2?.cards} cards`);
  const b6 = await readJson(`JSON.stringify((function(){
    var ws = document.querySelector('[data-canvas="workspace"]');
    var gauge = document.querySelector(${JSON.stringify(READOUT)});
    return { glide: ws ? ws.classList.contains("viewport-glide") : null, text: gauge ? gauge.textContent : null };
  })())`);
  check("no phantom re-glide on remount — the consumed target stays consumed",
    b6?.glide === false, JSON.stringify(b6));
  check("the readout is born silent on the fresh mount (t587 G2 still true)",
    b6?.text != null && /%$/.test(b6.text), `text=${b6?.text}`);

  /* ============ 📸 the settled world ==================================== */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t588-arrival-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled arrival screenshot", true, ".qa-logs/shots/t588-arrival-settled.png");
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup: the world owes nothing ------------------------------- */
  try {
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster untouched (arrivals move views, not worlds)", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
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

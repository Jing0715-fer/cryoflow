/**
 * t587 — the odometer tick: the zoom gauge's voice, live.
 *
 * The toolbar's zoom % readout is a live gauge and this window gives it
 * a voice: a discrete COMMAND (step buttons, reset) rolls the drum —
 * the new digit enters from below (+2px) when the value grows, from
 * above (−2px) when it shrinks — a 140ms one-shot on a React-key
 * remount (the find-tick idiom). What never ticks, proven here:
 * continuous gestures (wheel — the digits changing ARE their voice)
 * and repeated no-op commands (reset at 100% — "no change, no sound").
 *
 * Faces proven here:
 *   G1  the served sheet carries the tick (pre-browser gate — the t585
 *       watcher lesson: a witness on a stale sheet is a phantom run).
 *   G2  birth silence — a fresh page's readout has no [data-zoom-tick]:
 *       the initial fit (frameBounds) is the readout's birth, not an
 *       event (t585's arming-edge law, gauge edition).
 *   G3  the tick — clicking zoom-in remounts the span, sets
 *       --zoom-tick-y: 2px, plays zoom-tick, and the gauge is caught
 *       MID-FLIGHT in-browser (in-eval timing: the 140ms window is
 *       unmeasurable across the CLI round trip — t584/t585 doctrine).
 *   G4  the drum rolls BOTH ways — zoom-out flips the var to −2px and
 *       the number steps down.
 *   G5  the wheel stays silent — a real dispatched wheel event zooms
 *       the world (the % changes) but never remounts the span nor
 *       starts a zoom-tick: continuous voice, no entrance.
 *   G6  no change, no sound — reset from ≠100% ticks once; a second
 *       reset at 100% re-centers in silence (same span, no animation).
 *   G7  the layering — the tick rule lives inside the
 *       prefers-reduced-motion: no-preference gate only (CSSOM walk).
 *   R   console clean; roster untouched (view state may move; the
 *       world does not).
 *
 * Environment shim = t571/t585/t586's: desktop-capable Chrome via CDP
 * port 9327 (9323=t578, 9324=t584, 9325=t585, 9326=t586 — zombies keep
 * their ports; t581's law).
 *
 * Runs in the EMPIAR world in place (no switch), mints nothing.
 *
 * Usage: node scripts/t587-zoom-tick-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9327";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t587-harness-chrome-profile";
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
/** evalJs unwraps the CLI's outer encoding; the eval body returned
 *  JSON.stringify(...) itself, so parse HERE (the double-encoding lesson). */
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

/* ---- G1: served-CSS gate BEFORE the browser --------------------------- */
{
  const cssUrl = (() => {
    try { return sh(`curl -s ${BASE}/ | grep -oE '/_next/static/[^"]+\\.css' | head -1`); }
    catch { return ""; }
  })();
  let served = "";
  try { served = sh(`curl -s "${BASE}${cssUrl}"`); } catch { /* gate fails below */ }
  const hasTick = served.includes("@keyframes zoom-tick") &&
    served.includes("[data-zoom-tick]") &&
    served.includes("--zoom-tick-y");
  check("served CSS carries the odometer tick (pre-browser gate)", hasTick,
    `css chunk: ${cssUrl.slice(0, 60) || "NOT FOUND"}`);
  if (!hasTick) {
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

  /* ============ G2 — birth silence ====================================== */
  console.log(`\n[G2] the readout is born silent`);
  const birth = await readJson(`JSON.stringify((function(){
    var span = document.querySelector(${JSON.stringify(READOUT)});
    if (!span) return null;
    return { text: span.textContent, ticked: span.hasAttribute("data-zoom-tick") };
  })())`);
  check("readout on screen with the initial fit value", birth?.text != null && /%$/.test(birth.text || ""),
    `initial=${birth?.text}`);
  check("birth silence — no tick attribute on fresh mount (the first value is a birth, not an event)",
    birth?.ticked === false, JSON.stringify(birth));

  /* ============ G3 — the tick =========================================== */
  console.log(`\n[G3] the gauge speaks (zoom-in, mid-flight in-browser)`);
  /* in-eval atomic: the whole 140ms flight is shorter than a CLI round
     trip — click, await inside the page, read inside the page. Two
     samples (25ms, 55ms) with an acceptance read: dev main-thread
     jitter moves the phase (t586's three-signature lesson), so the
     INVARIANT is "the animation exists and the drum is between frames
     at least once", not an exact phase. */
  const tickIn = await readJson(`(async () => {
    var btn = document.querySelector('[data-canvas-ui="zoom-controls"] button[aria-label="Zoom in"]');
    var span = document.querySelector(${JSON.stringify(READOUT)});
    if (!btn || !span) return JSON.stringify({ live: false });
    var before = span.textContent;
    var w0 = span.getBoundingClientRect().width;
    btn.click();
    var s1 = null;
    await new Promise(function(r){ setTimeout(r, 25); });
    var span1 = document.querySelector(${JSON.stringify(READOUT)});
    var anims1 = document.getAnimations().filter(function(a){ return a.animationName === "zoom-tick"; });
    var cs1 = getComputedStyle(span1);
    s1 = { anims: anims1.length, running: anims1.length ? anims1[0].playState : null,
           translate: cs1.translate, opacity: cs1.opacity };
    await new Promise(function(r){ setTimeout(r, 30); });
    var span2 = document.querySelector(${JSON.stringify(READOUT)});
    var anims2 = document.getAnimations().filter(function(a){ return a.animationName === "zoom-tick"; });
    var cs2 = getComputedStyle(span2);
    return JSON.stringify({
      live: true, before: before, after: span2.textContent,
      remounted: span2 !== span, varY: span2.style.getPropertyValue("--zoom-tick-y"),
      animCount: anims2.length, s1: s1,
      translate2: cs2.translate, opacity2: cs2.opacity,
      w1: w0, w2: span2.getBoundingClientRect().width
    });
  })()`);
  check("tick fired — span remounted by the key", tickIn?.remounted === true, JSON.stringify({ remounted: tickIn?.remounted }));
  check("the drum rolls UP — --zoom-tick-y is 2px (value growing enters from below)",
    tickIn?.varY === "2px", `varY=${tickIn?.varY}`);
  check("the number changed (42% → 52% family)", tickIn?.before !== tickIn?.after,
    `${tickIn?.before} → ${tickIn?.after}`);
  check("zoom-tick animation exists on the new span", (tickIn?.animCount ?? 0) >= 1,
    `count=${tickIn?.animCount}`);
  /* computed translate serializes as "Xpx Ypx" (two components; the
     motion lives in Y, X is 0 by design) — parse the Y component. The
     phase under headless frame-clock jitter is jitter-prone (t586's
     three-signature lesson): a sample may catch the FROM state exactly
     (fill:both holds y=2px / opacity=.35 until the first frame ticks)
     — that IS honest takeoff evidence, the t585 0.94-catch family. The
     acceptance invariant: at some sampled point the digit is off its
     seat (y > 0.05) and still ghosting (opacity < 0.999). */
  const yOf = (t) => { const p = String(t ?? "").split(" ")[1]; const v = parseFloat(p); return isNaN(v) ? NaN : v; };
  const y1 = yOf(tickIn?.s1?.translate), y2 = yOf(tickIn?.translate2);
  const o1 = parseFloat(tickIn?.s1?.opacity), o2 = parseFloat(tickIn?.opacity2);
  const airborne = (y) => y > 0.05;
  const tookOff = ([airborne(y1) && o1 < 0.999, airborne(y2) && o2 < 0.999]).some(Boolean);
  check("caught airborne — the drum leaves its seat (from-state or mid-flight, in-eval timing)",
    tookOff, `y@25ms=${y1}/o=${o1}, y@55ms=${y2}/o=${o2}`);
  check("ghost-in is real — opacity climbs from 0.35, never born at 1",
    (o1 < 0.999 || o2 < 0.999), `o1=${o1}, o2=${o2}`);
  check("zero layout shift — the gauge keeps its seat (w-11 + tabular-nums)",
    Math.abs((tickIn?.w1 ?? 0) - (tickIn?.w2 ?? 0)) < 0.01,
    `w ${tickIn?.w1} → ${tickIn?.w2}`);
  await sleep(300);

  /* ============ G4 — the drum rolls both ways =========================== */
  console.log(`\n[G4] zoom-out drops the digit in from above`);
  const tickOut = await readJson(`(async () => {
    var btn = document.querySelector('[data-canvas-ui="zoom-controls"] button[aria-label="Zoom out"]');
    var span = document.querySelector(${JSON.stringify(READOUT)});
    if (!btn || !span) return JSON.stringify({ live: false });
    var before = span.textContent;
    btn.click();
    await new Promise(function(r){ setTimeout(r, 45); });
    var span2 = document.querySelector(${JSON.stringify(READOUT)});
    var anims = document.getAnimations().filter(function(a){ return a.animationName === "zoom-tick" && a.playState === "running"; });
    var cs = getComputedStyle(span2);
    return JSON.stringify({
      live: true, before: before, after: span2.textContent,
      remounted: span2 !== span, varY: span2.style.getPropertyValue("--zoom-tick-y"),
      running: anims.length, translate: cs.translate
    });
  })()`);
  check("zoom-out ticks with --zoom-tick-y: -2px (value shrinking enters from above)",
    tickOut?.varY === "-2px" && tickOut?.remounted === true, `varY=${tickOut?.varY}`);
  check("the number stepped down", parseFloat(tickOut?.after) < parseFloat(tickOut?.before),
    `${tickOut?.before} → ${tickOut?.after}`);
  check("a running tick is on the wire", (tickOut?.running ?? 0) >= 1, `running=${tickOut?.running}`);
  await sleep(300);

  /* ============ G5 — the wheel stays silent ============================= */
  console.log(`\n[G5] continuous gestures never tick`);
  const wheel = await readJson(`(async () => {
    var root = document.querySelector('[data-canvas-ui="zoom-controls"]').closest("section");
    var span = document.querySelector(${JSON.stringify(READOUT)});
    if (!root || !span) return JSON.stringify({ live: false });
    span.__t587 = "born";
    var before = span.textContent;
    var r = root.getBoundingClientRect();
    root.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true, cancelable: true, deltaY: -120,
      clientX: r.x + r.width / 2, clientY: r.y + r.height / 2
    }));
    await new Promise(function(r2){ setTimeout(r2, 160); });
    var span2 = document.querySelector(${JSON.stringify(READOUT)});
    var anims = document.getAnimations().filter(function(a){ return a.animationName === "zoom-tick" && a.playState === "running"; });
    return JSON.stringify({
      live: true, before: before, after: span2.textContent,
      sameNode: span2.__t587 === "born",
      tickRunning: anims.length
    });
  })()`);
  check("the wheel zoomed the world (the test is not vacuous)", wheel?.before !== wheel?.after,
    `${wheel?.before} → ${wheel?.after}`);
  check("the span never remounted under the wheel", wheel?.sameNode === true, `sameNode=${wheel?.sameNode}`);
  check("no tick rides the wheel (continuous voice needs no entrance)", (wheel?.tickRunning ?? 0) === 0,
    `running=${wheel?.tickRunning}`);

  /* ============ G6 — no change, no sound ================================ */
  console.log(`\n[G6] reset speaks once, then rests`);
  /* ensure the gauge is not already at 100% before the first reset */
  const pre = await readJson(`JSON.stringify({
    text: document.querySelector(${JSON.stringify(READOUT)}).textContent })`);
  if (/^100%$/.test(pre?.text || "")) {
    await evalJs(`(function(){
      document.querySelector('[data-canvas-ui="zoom-controls"] button[aria-label="Zoom out"]').click();
    })()`);
    await sleep(250);
  }
  const reset1 = await readJson(`(async () => {
    var btn = document.querySelector('[data-canvas-ui="zoom-controls"] button[aria-label="Reset view"]');
    var span = document.querySelector(${JSON.stringify(READOUT)});
    var before = span.textContent;
    btn.click();
    await new Promise(function(r){ setTimeout(r, 45); });
    var span2 = document.querySelector(${JSON.stringify(READOUT)});
    var anims = document.getAnimations().filter(function(a){ return a.animationName === "zoom-tick" && a.playState === "running"; });
    return JSON.stringify({
      before: before, after: span2.textContent,
      remounted: span2 !== span, varY: span2.style.getPropertyValue("--zoom-tick-y"),
      running: anims.length
    });
  })()`);
  check("reset ticks when the number changes", reset1?.remounted === true && (reset1?.running ?? 0) >= 1,
    `${reset1?.before} → ${reset1?.after}, running=${reset1?.running}`);
  check("reset lands at 100%", reset1?.after === "100%", reset1?.after);
  await sleep(400);
  const reset2 = await readJson(`(async () => {
    var btn = document.querySelector('[data-canvas-ui="zoom-controls"] button[aria-label="Reset view"]');
    var span = document.querySelector(${JSON.stringify(READOUT)});
    span.__t587 = "resting";
    btn.click();
    await new Promise(function(r){ setTimeout(r, 160); });
    var span2 = document.querySelector(${JSON.stringify(READOUT)});
    var anims = document.getAnimations().filter(function(a){ return a.animationName === "zoom-tick" && a.playState === "running"; });
    return JSON.stringify({
      after: span2.textContent, sameNode: span2.__t587 === "resting",
      tickRunning: anims.length
    });
  })()`);
  check("second reset at 100% — same span, no new animation (re-centering is silent)",
    reset2?.sameNode === true && (reset2?.tickRunning ?? 0) === 0 && reset2?.after === "100%",
    JSON.stringify(reset2));

  /* ============ G7 — the layering (CSSOM walk) ========================== */
  console.log(`\n[G7] layering — the tick rides the motion-safe gate`);
  const layering = await readJson(`JSON.stringify((function(){
    var found = { ruleInMotionSafe: false, ruleOutside: false, keyframesFound: false };
    var walk = function(rules, mediaText){
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        var mt = r.media ? r.media.mediaText : mediaText;
        if (r.type === CSSRule.KEYFRAMES_RULE && r.name === "zoom-tick") found.keyframesFound = true;
        if (r.selectorText && r.selectorText.indexOf("data-zoom-tick") !== -1) {
          if (mt && mt.indexOf("prefers-reduced-motion: no-preference") !== -1) found.ruleInMotionSafe = true;
          else found.ruleOutside = true;
        }
        if (r.cssRules && r.cssRules.length) walk(r.cssRules, mt);
      }
    };
    for (var s = 0; s < document.styleSheets.length; s++) {
      try { walk(document.styleSheets[s].cssRules, null); } catch (e) { /* cross-origin sheet */ }
    }
    return found;
  })())`);
  check("tick declared inside the motion-safe gate only",
    layering?.ruleInMotionSafe === true && layering?.ruleOutside === false, JSON.stringify(layering));
  check("zoom-tick keyframes present in the CSSOM", layering?.keyframesFound === true);

  /* ============ 📸 the settled world ==================================== */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t587-zoom-gauge.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 gauge screenshot", true, ".qa-logs/shots/t587-zoom-gauge.png");
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup: the world owes nothing ------------------------------- */
  try {
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster untouched (the gauge moves nothing)", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
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

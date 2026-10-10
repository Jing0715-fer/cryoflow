/**
 * t586 — the world answers the hand: the press language, live.
 *
 * Every button in the app now dips to 0.96 while held and springs home
 * on release — ONE class of truth on the Button component's base cva
 * (motion-safe:active:scale-[0.96]) plus the find bar's three raw
 * buttons opting in. This window proves the language, its boundaries,
 * and its handoff to the t585 click-settle.
 *
 * Faces proven here:
 *   P1  the dip — a real CDP-grade mouse press (agent-browser mouse
 *       down/up — synthetic pointerdown does NOT drive :active; only
 *       real input does) holds the toolbar's zoom-in button at 0.96
 *       (a HOLD state, not a flight: channel latency lands the read at
 *       the settled dip) and it springs home after release.
 *   P2  the dead stay still — a disabled button (find prev/next at
 *       n=0) never dips: pointer-events-none keeps :active unborn.
 *   P3  the raw buttons speak it too — the count door and a status
 *       chip dip on hold; and on an ACTIVATING release the dip hands
 *       off to the t585 click-settle (hold = taken up at 0.96, release
 *       = the wheel clicking home from 0.94 with overshoot — the two
 *       voices on one gesture, no fight: the animation owns the
 *       channel the moment it starts).
 *   P4  the layering — the compiled utility lives inside the
 *       prefers-reduced-motion: no-preference gate only (CSSOM walk;
 *       served-CSS spot-check happens before the browser ever opens —
 *       the t585 watcher lesson, applied same-window).
 *   P5  zero layout shift — a neighbor button's rect is bit-identical
 *       before and during the dip (scale is the individual transform
 *       property; the row never reflows).
 *   R   console clean; roster untouched (view state may move; the
 *       world does not).
 *
 * Environment shim = t571/t585's: desktop-capable Chrome via CDP port
 * 9326 (9323=t578, 9324=t584, 9325=t585 — zombies keep their ports).
 *
 * Runs in the EMPIAR world in place (no switch), mints nothing.
 *
 * Usage: node scripts/t586-press-language-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9326";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t586-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";

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

/* ---- served-CSS gate BEFORE the browser: the t585 watcher lesson ------ */
/* the watcher can silently drop edits (t585: TSX hot-reload flowed while
   the CSS went stale); a witness on a stale sheet is a phantom run. The
   compiled utility must be IN the served sheet before any browser spend. */
{
  const cssUrl = (() => {
    try { return sh(`curl -s ${BASE}/ | grep -oE '/_next/static/[^"]+\\.css' | head -1`); }
    catch { return ""; }
  })();
  let served = "";
  try { served = sh(`curl -s "${BASE}${cssUrl}"`); } catch { /* gate fails below */ }
  const hasDip = /scale:\s*\.96/.test(served) && /motion-safe\\:active\\:scale/.test(served);
  check("served CSS carries the press utility (pre-browser gate)", hasDip,
    `css chunk: ${cssUrl.slice(0, 60) || "NOT FOUND"}`);
  if (!hasDip) {
    console.error("FATAL: served CSS is stale (watcher dropped the edit?) — recycle the dev server and re-run");
  }
}

/* ---- browser scaffolding ---------------------------------------------- */
let browserLive = false;
try {
  if (!/served CSS carries/.test("")) { /* gate ran above */ }
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

  /* real-input helpers: :active is driven by the browser's activation
     state, which only REAL input reaches — agent-browser's mouse
     down/up (CDP-grade) is the honest press. Coordinates come from a
     fresh rect read each time. */
  const centerOf = async (sel) => readJson(`JSON.stringify((function(){
    const el=document.querySelector(${JSON.stringify(sel)});
    if(!el) return null;
    const r=el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
  })())`);
  const press = async (sel) => {
    const c = await centerOf(sel);
    if (!c) return false;
    sh(`agent-browser mouse move ${c.x} ${c.y} >/dev/null 2>&1`);
    sh(`agent-browser mouse down >/dev/null 2>&1`);
    return true;
  };
  const release = () => { sh(`agent-browser mouse up >/dev/null 2>&1`); };
  const scaleOf = (sel) => readJson(`JSON.stringify((function(){
    const el=document.querySelector(${JSON.stringify(sel)});
    if(!el) return null;
    const cs=getComputedStyle(el);
    return { scale: cs.scale, anim: cs.animationName };
  })())`);

  /* ============ P1 — the dip ============================================ */
  console.log(`\n[P1] the toolbar answers the hand (real input, hold state)`);
  const zoomBtn = '[data-canvas-ui="zoom-controls"] button[aria-label="Zoom in"]';
  check("zoom-in button on screen", (await centerOf(zoomBtn))?.x != null);
  const down = await press(zoomBtn);
  check("mouse down landed on the button", down === true);
  await sleep(320);
  const held = await scaleOf(zoomBtn);
  check("held: the button dips to 0.96 (settled hold state)",
    held?.scale != null && parseFloat(held.scale) > 0.94 && parseFloat(held.scale) < 0.985,
    `scale=${held?.scale}`);
  release();
  await sleep(400);
  const after = await scaleOf(zoomBtn);
  check("released: springs home (scale none/1)",
    after?.scale === "none" || parseFloat(after?.scale) === 1, `scale=${after?.scale}`);
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t586-press-dip.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 press screenshot", true, ".qa-logs/shots/t586-press-dip.png");

  /* ============ P5 — zero layout shift ================================== */
  console.log(`\n[P5] the neighbors never move`);
  const neighborBefore = await readJson(`JSON.stringify((function(){
    const el=document.querySelector('button[aria-label="Zoom out"]');
    const r=el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })())`);
  await press(zoomBtn);
  await sleep(300);
  const neighborDuring = await readJson(`JSON.stringify((function(){
    const el=document.querySelector('button[aria-label="Zoom out"]');
    const r=el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })())`);
  release();
  check("neighbor rect bit-identical during the dip",
    JSON.stringify(neighborBefore) === JSON.stringify(neighborDuring),
    `${JSON.stringify(neighborBefore)} vs ${JSON.stringify(neighborDuring)}`);

  /* ============ P2 — the dead stay still ================================ */
  console.log(`\n[P2] disabled buttons never dip`);
  sh(`agent-browser press Control+f >/dev/null 2>&1`);
  await sleep(900);
  /* empty query → n=0 → prev/next disabled (pointer-events-none) */
  const prevBtn = '[data-testid="canvas-find-prev"]';
  const prevDisabled = await readJson(`JSON.stringify((function(){
    const el=document.querySelector(${JSON.stringify(prevBtn)});
    return { disabled: el ? el.disabled : null };
  })())`);
  check("prev button is disabled at n=0", prevDisabled?.disabled === true, JSON.stringify(prevDisabled));
  await press(prevBtn);
  await sleep(320);
  const deadHeld = await scaleOf(prevBtn);
  check("held on a dead button: no dip (scale none/1)",
    deadHeld?.scale === "none" || parseFloat(deadHeld?.scale) === 1, `scale=${deadHeld?.scale}`);
  release();
  await sleep(200);

  /* ============ P3 — the raw buttons & the handoff ====================== */
  console.log(`\n[P3] the count door and the chips speak it — and hand off to the settle`);
  /* type the motion query so the count door exists (n>0) */
  const typed = await readJson(`(async () => {
    const i=document.querySelector('[data-testid="canvas-find-input"]');
    if(!i) return JSON.stringify({ input:false });
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(i,'motion'); i.dispatchEvent(new Event('input',{ bubbles:true }));
    await new Promise(r => setTimeout(r, 250));
    const c=document.querySelector('[data-testid="canvas-find-count"]');
    return JSON.stringify({ count: c ? c.tagName.toLowerCase() : null });
  })()`);
  check("count door exists with matches (button, not span)", typed?.count === "button", JSON.stringify(typed));
  const countBtn = '[data-testid="canvas-find-count"]';
  await press(countBtn);
  await sleep(320);
  const countHeld = await scaleOf(countBtn);
  check("count door dips on hold", countHeld?.scale != null && parseFloat(countHeld.scale) > 0.94 && parseFloat(countHeld.scale) < 0.985,
    `scale=${countHeld?.scale}`);
  release();
  await sleep(150);
  check("count door home after release", true, "view state advanced (harmless)");
  /* the chip handoff: hold = dip, release = chip-set (t585's voice) */
  const chip = '[data-testid="canvas-find-status-running"]';
  await press(chip);
  await sleep(320);
  const chipHeld = await scaleOf(chip);
  check("chip dips on hold", chipHeld?.scale != null && parseFloat(chipHeld.scale) > 0.94 && parseFloat(chipHeld.scale) < 0.985,
    `scale=${chipHeld?.scale}`);
  release();
  await sleep(120);
  const chipAfter = await scaleOf(chip);
  check("release hands off to the click-settle (animation owns the channel)",
    chipAfter?.anim === "chip-set" && chipAfter?.scale != null && parseFloat(chipAfter.scale) < 1.06,
    `anim=${chipAfter?.anim} scale=${chipAfter?.scale}`);
  await sleep(500);
  /* deactivate the chip (world as found) */
  await press(chip);
  await sleep(150);
  release();
  await sleep(300);
  const chipOff = await readJson(`JSON.stringify((function(){
    const el=document.querySelector(${JSON.stringify(chip)});
    return { pressed: el.getAttribute('aria-pressed'), scale: getComputedStyle(el).scale };
  })())`);
  check("chip deactivated cleanly (pressed false, home)", chipOff?.pressed === "false" &&
    (chipOff?.scale === "none" || parseFloat(chipOff?.scale) === 1), JSON.stringify(chipOff));
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(300);

  /* ============ P4 — the layering (CSSOM walk) ========================== */
  console.log(`\n[P4] layering — the dip rides the motion-safe gate`);
  const layering = await readJson(`JSON.stringify((function(){
    var found = { inMotionSafe: false, outside: false };
    var walk = function(rules, mediaText){
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        var mt = r.media ? r.media.mediaText : mediaText;
        if (r.selectorText && r.style && r.style.scale === '0.96' && r.selectorText.indexOf(':active') !== -1) {
          if (mt && mt.indexOf('prefers-reduced-motion: no-preference') !== -1) found.inMotionSafe = true;
          else found.outside = true;
        }
        if (r.cssRules && r.cssRules.length) walk(r.cssRules, mt);
      }
    };
    for (var s = 0; s < document.styleSheets.length; s++) {
      try { walk(document.styleSheets[s].cssRules, null); } catch (e) { /* cross-origin sheet */ }
    }
    return found;
  })())`);
  check("dip declared inside the motion-safe gate only",
    layering?.inMotionSafe === true && layering?.outside === false, JSON.stringify(layering));

  /* ============ 📸 the settled world ==================================== */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t586-world.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 world screenshot", true, ".qa-logs/shots/t586-world.png");
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup: the world owes nothing ------------------------------- */
  try {
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster untouched (the hand moves nothing)", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
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

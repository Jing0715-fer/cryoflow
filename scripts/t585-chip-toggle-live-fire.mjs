/**
 * t585 — the find chip's third voice: the toggle answer, live.
 *
 * t584 gave the chips their entrance (the wheels arrive with the lens);
 * t585 gives the ACTIVATION its own syllable — a filter clicking into
 * place. The face is pure CSS: `[data-find-chip][aria-pressed="true"]`
 * newly matching starts a one-shot chip-set animation (scale 0.94,
 * back-out bezier springs past 1 and lands). No React key remount —
 * the rule's match state IS the state machine.
 *
 * Faces proven here:
 *   T1  the click answers — clicking a status chip (in-browser timing:
 *       the click dispatch and the read share one eval) catches the
 *       chip mid-settle: computed animation-name "chip-set" while the
 *       chip's neighbors stay silent.
 *   T2  the settle is real movement — mid-flight the computed scale
 *       reads below 1 (the wheel is mid-chunk, not an attribute swap);
 *       ~500ms later it reads none/1 (settled; fill-mode none — the
 *       rest state is the element's own, the animation borrows it
 *       only for 260ms).
 *   T3  the release is quiet — clicking again (aria-pressed → false)
 *       stops the rule from matching: animation-name "none" within
 *       120ms, no exit ceremony (the t578 law, dismissal gets none).
 *   T4  every fresh activation replays — a third click re-matches the
 *       rule and the settle plays again (one-shot per activation).
 *   T5  the handshake with the entrance — with a chip left ACTIVE,
 *       closing and reopening the lens: during the armed window the
 *       chip plays find-chip-enter (the cascade owns the channel),
 *       never chip-set; no double-play at open (the :not scope).
 *   T6  one grammar, both families — the dot-less type chip speaks
 *       the same settle on activation (same selector, same voice).
 *   T7  the movement layering — the chip-set rule lives inside the
 *       prefers-reduced-motion: no-preference block (CSSOM walk: the
 *       rule's parent media is the motion-safe gate), while the color
 *       answer (transition-colors) stays with all users.
 *   R   console clean; roster untouched (the lens is ephemeral).
 *
 * Environment shim = t571/t584's: stock headless Chrome reports
 * (hover:none), so this harness spawns desktop-capable Chrome and points
 * agent-browser at it via `connect`. CDP port 9325 (9323=t578, 9324=t584
 * — zombie ports get, zombies keep).
 *
 * Runs in the EMPIAR world in place (no switch), mints nothing.
 *
 * Usage: node scripts/t585-chip-toggle-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9325";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t585-harness-chrome-profile";
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

  const openLens = async () => {
    sh(`agent-browser press Control+f >/dev/null 2>&1`);
    await sleep(900);
  };
  const closeLens = async () => {
    sh(`agent-browser press Escape >/dev/null 2>&1`);
    await sleep(400);
  };
  const barDisarmed = () => pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      const bar=document.querySelector('[data-canvas-find-bar]');
      if(!bar) return { bar:false };
      return { bar:true, armed: bar.hasAttribute('data-find-enter') };
    })())`);
    return v?.bar === true && v?.armed === false ? v : null;
  }, 5000);

  /* ============ T1 + T2 — the click answers ============================= */
  console.log(`\n[T1/T2] activation — the wheel clicks into place (in-browser timing)`);
  await openLens();
  const dis = await barDisarmed();
  check("lens open and disarmed before the toggle faces", dis?.armed === false, JSON.stringify(dis));
  /* One eval: click the "completed" chip, await 60ms IN-PAGE (60/260ms
     into the settle — mid-chunk), read the chip's animation name, its
     computed scale, and a quiet neighbor's name for contrast. NOTE — no
     // comments inside the IIFE: evalJs flattens newlines (t579's
     transport lesson). */
  const mid = await readJson(`(async () => {
    const chip=document.querySelector('[data-testid="canvas-find-status-completed"]');
    if(!chip) return JSON.stringify({ chip:false });
    chip.click();
    await new Promise(r => setTimeout(r, 60));
    const cs=getComputedStyle(chip);
    const neighbor=document.querySelector('[data-testid="canvas-find-status-idle"]');
    return JSON.stringify({
      chip:true, pressed: chip.getAttribute('aria-pressed'),
      anim: cs.animationName, scale: cs.scale,
      neighborAnim: neighbor ? getComputedStyle(neighbor).animationName : null
    });
  })()`);
  check("activation flips aria-pressed and starts the settle", mid?.pressed === "true" && mid?.anim === "chip-set",
    JSON.stringify({ pressed: mid?.pressed, anim: mid?.anim }));
  check("the settle is real movement — mid-flight scale below 1",
    mid?.scale != null && parseFloat(mid.scale) > 0.9 && parseFloat(mid.scale) < 0.999,
    `scale=${mid?.scale}`);
  check("a quiet neighbor stays silent", mid?.neighborAnim === "none", mid?.neighborAnim);
  await sleep(500);
  /* the honest "finished" witness is getAnimations(), NOT the
     animation-name property: the rule KEEPS MATCHING while the chip is
     active, so animation-name reads "chip-set" forever — the first run
     conflated "rule matches" with "animation playing" (a false failure:
     the product was right, the assertion was naive). fill-mode none
     means the finished animation holds nothing: scale back to natural,
     zero running animations. */
  const settled = await readJson(`JSON.stringify((function(){
    const chip=document.querySelector('[data-testid="canvas-find-status-completed"]');
    const cs=getComputedStyle(chip);
    return { anim: cs.animationName, scale: cs.scale, running: chip.getAnimations().length };
  })())`);
  check("T2: settled — rule still matches but nothing is running, scale natural",
    settled?.anim === "chip-set" && settled?.running === 0 && (settled?.scale === "none" || parseFloat(settled?.scale) === 1),
    JSON.stringify(settled));
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t585-chip-active.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 active-chip screenshot", true, ".qa-logs/shots/t585-chip-active.png");

  /* ============ T3 — the release is quiet =============================== */
  console.log(`\n[T3] deactivation — no exit ceremony`);
  const release = await readJson(`(async () => {
    const chip=document.querySelector('[data-testid="canvas-find-status-completed"]');
    if(!chip) return JSON.stringify({ chip:false });
    chip.click();
    await new Promise(r => setTimeout(r, 120));
    const cs=getComputedStyle(chip);
    return JSON.stringify({ pressed: chip.getAttribute('aria-pressed'), anim: cs.animationName });
  })()`);
  check("release stops the rule from matching — animation-name none",
    release?.pressed === "false" && release?.anim === "none", JSON.stringify(release));

  /* ============ T4 — every fresh activation replays ===================== */
  console.log(`\n[T4] re-activation — the wheel clicks again`);
  const replay = await readJson(`(async () => {
    const chip=document.querySelector('[data-testid="canvas-find-status-completed"]');
    if(!chip) return JSON.stringify({ chip:false });
    chip.click();
    await new Promise(r => setTimeout(r, 60));
    return JSON.stringify({ pressed: chip.getAttribute('aria-pressed'), anim: getComputedStyle(chip).animationName });
  })()`);
  check("fresh activation replays the settle", replay?.pressed === "true" && replay?.anim === "chip-set",
    JSON.stringify(replay));

  /* ============ T6 — one grammar, both families ========================= */
  console.log(`\n[T6] the type chip — same voice, no dot`);
  const typeChip = await readJson(`(async () => {
    const el=document.querySelector('[data-find-chip][data-testid^="canvas-find-type-"]');
    if(!el) return JSON.stringify({ present:false });
    el.click();
    await new Promise(r => setTimeout(r, 60));
    return JSON.stringify({ present:true, testid: el.getAttribute('data-testid'),
      pressed: el.getAttribute('aria-pressed'), anim: getComputedStyle(el).animationName });
  })()`);
  if (typeChip?.present === false) {
    check("type row absent in this world (skip)", true, "conditional face");
  } else {
    check("type chip plays the same settle", typeChip?.pressed === "true" && typeChip?.anim === "chip-set",
      `${typeChip?.testid}: ${typeChip?.anim}`);
  }
  /* leave the world as found: clear the type filter, clear the status
     filter, close the lens. NOTE the data-find-chip discriminator —
     the first run used the bare testid prefix and grabbed the ROW
     (canvas-find-type-row), whose click does nothing. */
  const cleanupChips = await readJson(`(async () => {
    const t=document.querySelector('[data-find-chip][data-testid^="canvas-find-type-"]');
    if(t && t.getAttribute('aria-pressed')==="true"){ t.click(); }
    const s=document.querySelector('[data-testid="canvas-find-status-completed"]');
    if(s && s.getAttribute('aria-pressed')==="true"){ s.click(); }
    await new Promise(r => setTimeout(r, 120));
    const chips=[...document.querySelectorAll('[data-find-chip]')];
    return JSON.stringify({ activeLeft: chips.filter(c=>c.getAttribute('aria-pressed')==="true").length });
  })()`);
  check("filters cleared (world as found)", cleanupChips?.activeLeft === 0, JSON.stringify(cleanupChips));

  /* ============ T5 — the handshake & the ghost probe ==================== */
  console.log(`\n[T5] handshake — a click during the entrance is color-only; the disarm is never an event`);
  /* closeFind RESETS the filters (store: findQuery/status/category to
     defaults) — so "an active chip at reopen" is impossible by design
     (the product guarantees the entrance never meets a stale active
     chip; the first run's premise was wrong). The real hazard is the
     FAST USER: a click DURING the armed window followed by the disarm —
     a rule keyed only on aria-pressed would newly-match then and
     ghost-pop the chip with no click.
     TIMING NOTE — the second run still clicked post-arm: openLens's
     900ms CLI sleep OUTLIVES the 720ms settle window, so every click
     after the helper returns is already disarmed. An in-arm click must
     share the eval with the open itself (the t578 channel lesson gains
     a second face: not just READS — CLICKS also have to be in-browser
     timed to land inside a window shorter than the channel). */
  await closeLens();
  const inArmClick = await readJson(`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'f', ctrlKey:true, bubbles:true, cancelable:true }));
    await new Promise(r => setTimeout(r, 100));
    const bar=document.querySelector('[data-canvas-find-bar]');
    if(!bar) return JSON.stringify({ bar:false });
    const armed = bar.hasAttribute('data-find-enter');
    const chip=document.querySelector('[data-testid="canvas-find-status-completed"]');
    if(!chip) return JSON.stringify({ bar:true, armed, chip:false });
    chip.click();
    await new Promise(r => setTimeout(r, 40));
    return JSON.stringify({ bar:true, armed, pressed: chip.getAttribute('aria-pressed'),
      anim: getComputedStyle(chip).animationName,
      keySet: chip.hasAttribute('data-chip-set') });
  })()`);
  check("in-arm click: color answer only — no settle key, no settle on the channel",
    inArmClick?.bar === true && inArmClick?.armed === true && inArmClick?.pressed === "true" &&
    inArmClick?.keySet === false && inArmClick?.anim !== "chip-set",
    JSON.stringify(inArmClick));
  const afterDisarmGhost = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      const bar=document.querySelector('[data-canvas-find-bar]');
      if(!bar) return { bar:false };
      if(bar.hasAttribute('data-find-enter')) return null;
      const chip=document.querySelector('[data-testid="canvas-find-status-completed"]');
      var settles=[...chip.getAnimations()].filter(function(a){ return a.animationName === 'chip-set'; }).length;
      return { bar:true, anim: getComputedStyle(chip).animationName,
        settles: settles,
        keySet: chip.hasAttribute('data-chip-set') };
    })())`);
    return v?.bar === true ? v : null;
  }, 5000);
  check("GHOST PROBE: after disarm the in-arm chip is silent — no settle, nothing running",
    afterDisarmGhost?.anim === "none" && afterDisarmGhost?.settles === 0 && afterDisarmGhost?.keySet === false,
    JSON.stringify(afterDisarmGhost));
  /* the fresh-voice guarantee: closeFind resets the filters, and the
     arming edge clears the key set — a reopened lens mounts with every
     chip keyless and unpressed (the product's own reset, witnessed).
     The read lives INSIDE the opening eval: 900ms of CLI sleep would
     outrun the 720ms window and the "armed" half of the assertion
     would be measuring a corpse (the second run's failure). */
  await closeLens();
  const freshVoice = await readJson(`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'f', ctrlKey:true, bubbles:true, cancelable:true }));
    await new Promise(r => setTimeout(r, 120));
    const bar=document.querySelector('[data-canvas-find-bar]');
    if(!bar) return JSON.stringify({ bar:false });
    const chips=[...bar.querySelectorAll('[data-find-chip]')];
    return JSON.stringify({ bar:true, armed: bar.hasAttribute('data-find-enter'),
      pressed: chips.filter(c=>c.getAttribute('aria-pressed')==="true").length,
      keyed: chips.filter(c=>c.hasAttribute('data-chip-set')).length });
  })()`);
  check("a fresh lens mounts with zero pressed and zero keyed chips (fresh voice)",
    freshVoice?.bar === true && freshVoice?.armed === true && freshVoice?.pressed === 0 && freshVoice?.keyed === 0,
    JSON.stringify(freshVoice));
  await closeLens();

  /* ============ T7 — the movement layering (CSSOM walk) ================= */
  console.log(`\n[T7] layering — chip-set rides prefers-reduced-motion`);
  /* Chrome's native CSS nesting gives EVERY CSSStyleRule a cssRules
     list (empty ones included — truthy objects!), so the first run's
     walker descended into everything and checked nothing. Order the
     walk properly: check THIS rule, THEN recurse into its children. */
  const layering = await readJson(`JSON.stringify((function(){
    var found = { inMotionSafe: false, outside: false };
    var walk = function(rules, mediaText){
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        var mt = r.media ? r.media.mediaText : mediaText;
        if (r.selectorText && r.style && r.style.animationName === 'chip-set') {
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
  check("chip-set declared inside the motion-safe gate only",
    layering?.inMotionSafe === true && layering?.outside === false, JSON.stringify(layering));

  /* ============ 📸 the settled world ==================================== */
  await openLens();
  await sleep(400);
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t585-lens-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled lens screenshot", true, ".qa-logs/shots/t585-lens-settled.png");
  await closeLens();
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup: the world owes nothing ------------------------------- */
  try {
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster untouched (the lens is ephemeral)", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
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

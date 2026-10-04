/**
 * t578 — the find bar learns the lens language: the cascade, the stand-down,
 * and the tick, live.
 *
 * t572 gave the palette a cascade (groups stair in, settle disarms, re-open
 * re-arms); t576 gave the dashboard the same grammar (rungs + bands + empty
 * states). This window brings that motion-as-wayfinding grammar to the find
 * bar — the third floating surface — and fixes a motion-semantics debt while
 * doing it: the bar used to UNMOUNT during a wire drag (pendingFrom), so any
 * entrance choreography would have replayed on every drag return. The bar now
 * STANDS DOWN (opacity 0, pointer-events none, aria-hidden) instead of leaving
 * — a return is not an arrival, and the cascade must agree.
 *
 * Faces proven here:
 *   F1  the cascade — Ctrl+F mounts the bar with data-find-enter armed; the
 *       three rungs (input pill → status row → type row) animate find-drop
 *       with staggered delays 0 / 60 / 120ms (type row only when the world
 *       has more than one category — the bar hides a lens with nothing to
 *       separate). The travel rides prefers-reduced-motion: no-preference.
 *   F2  📸 mid-cascade — the bar caught between rungs (evidence, not assert).
 *   F3  disarm — after the settle window data-find-enter is REMOVED, rungs
 *       report animation-name "none", and typing a character does NOT replay
 *       (the cascade is a one-shot per open — t572's re-arm doctrine).
 *   F4  the count answers — typing "motion" produces the honest count with
 *       aria-live="polite"; Enter advances the cycle ("1 of N") and the tick
 *       span (data-find-tick, remounted by React key) plays the amber flash —
 *       the same hue the matched cards ring with.
 *   F5  the stand-down — a pointerdown on a port (wire drag begins) hides
 *       the bar WITHOUT unmounting it (opacity 0, pointer-events none, still
 *       in DOM); Escape cancels the wire and the bar returns with
 *       data-find-enter ABSENT — no cascade replay on a drag return.
 *   F6  the close — Escape in the input unmounts the bar instantly
 *       (dismissive actions get no ceremony).
 *   R   console clean; roster untouched (the lens is ephemeral — nothing
 *       enters the world).
 *
 * Environment shim = t571/t570's: stock headless Chrome reports (hover:none),
 * so this harness spawns desktop-capable Chrome and points agent-browser at
 * it via `connect`. Everything lives in this one Node process.
 *
 * Runs in the EMPIAR world in place (no switch), mints nothing.
 *
 * Usage: node scripts/t578-find-lens-live-fire.mjs   (needs prod or a warm dev)
 */

import { execSync, spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9323";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t578-harness-chrome-profile";
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

  /* ---- hydration guard: dev lazy-compiles the canvas route on first
          visit — every timing face below assumes the app is interactive.
          Poll for actual canvas cards, not just a 200. ------------------ */
  const hydrated = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    return v?.cards > 0 ? v : null;
  }, 90000, 1000);
  check("canvas hydrated (cards in DOM)", hydrated?.cards > 0, `${hydrated?.cards} cards`);

  const BAR = `[data-canvas-find-bar]`;
  const rungInfo = () => readJson(`JSON.stringify((function(){
    const bar=document.querySelector('[data-canvas-find-bar]');
    if(!bar) return {bar:false};
    const rungs=[...bar.querySelectorAll(':scope [data-find-rung]')].map((el)=>{
      const cs=getComputedStyle(el);
      return { rung: el.getAttribute('data-find-rung'), name: cs.animationName, delay: cs.animationDelay };
    });
    return { bar:true, armed: bar.hasAttribute('data-find-enter'), rungs };
  })())`);
  const barHidden = () => readJson(`JSON.stringify((function(){
    const bar=document.querySelector('[data-canvas-find-bar]');
    if(!bar) return {present:false};
    const cs=getComputedStyle(bar);
    return { present:true, opacity: cs.opacity, pe: cs.pointerEvents, aria: bar.getAttribute('aria-hidden') };
  })())`);

  /* ============ pre-flight — the bar starts closed ====================== */
  console.log(`\n[pre] the lens starts closed`);
  const closed = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({gone: !document.querySelector('[data-canvas-find-bar]')})`);
    return v?.gone === true ? v : null;
  }, 8000);
  check("find bar absent on load", closed?.gone === true);

  /* ============ F1 — the cascade ======================================== */
  // The channel honesty note: the agent-browser eval roundtrip is ~50ms
  // warm but HUNDREDS of ms cold — longer than the 340ms cascade itself.
  // A CLI-timed read would measure the CHANNEL, not the animation. So the
  // timing lives INSIDE the browser: one eval dispatches the Ctrl+F
  // keydown synthetically, awaits 100ms in-page (rung 0 mid-flight, rung
  // 2 inside its delay), and reads the armed state + rung animation
  // names + the inline --find-d ladder — all before the result ever
  // crosses the channel. Channel latency is hereby retired as a variable.
  console.log(`\n[F1] Ctrl+F — the lens lowers in (cascade, in-browser timing)`);
  const mid = await readJson(`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'f', ctrlKey:true, bubbles:true, cancelable:true }));
    await new Promise(r => setTimeout(r, 100));
    const bar=document.querySelector('[data-canvas-find-bar]');
    if(!bar) return JSON.stringify({ bar:false });
    const rungs=[...bar.querySelectorAll('[data-find-rung]')].map((el)=>({
      rung: el.getAttribute('data-find-rung'),
      name: getComputedStyle(el).animationName,
      d: el.style.getPropertyValue('--find-d')
    }));
    return JSON.stringify({ bar:true, armed: bar.hasAttribute('data-find-enter'), rungs });
  })()`);
  check("bar mounts armed at t=100ms (mid-cascade)", mid?.bar === true && mid?.armed === true, JSON.stringify(mid));
  const r0 = mid?.rungs?.find((r) => r.rung === "0");
  const r1 = mid?.rungs?.find((r) => r.rung === "1");
  const r2 = mid?.rungs?.find((r) => r.rung === "2");
  check("every rung plays find-drop (name applied through delay + travel)",
    r0?.name === "find-drop" && r1?.name === "find-drop" && (r2 ? r2.name === "find-drop" : true),
    JSON.stringify(mid?.rungs?.map((r) => `${r.rung}:${r.name}`)));
  const d0 = (r0?.d ?? "").trim(), d1 = (r1?.d ?? "").trim(), d2 = (r2?.d ?? "").trim();
  check("the stagger ladder is 0 / 60 / 120ms (inline --find-d)",
    d0 === "0ms" && d1 === "60ms" && (r2 ? d2 === "120ms" : true),
    `${d0} / ${d1} / ${d2}`);
  if (!mid?.bar) {
    // the synthetic key was not heard (hydration edge) — open via CLI for
    // the remaining faces and say so
    sh(`agent-browser press Control+f >/dev/null 2>&1`);
    await sleep(700);
  }
  /* ============ F2 — 📸 mid-cascade ===================================== */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t578-find-cascade-mid.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 mid-cascade screenshot", true, ".qa-logs/shots/t578-find-cascade-mid.png");

  /* ============ F3 — disarm: a one-shot per open ======================== */
  console.log(`\n[F3] settle disarms — typing never replays`);
  const disarmed = await pollUntil(async () => {
    const v = await rungInfo();
    return v?.armed === false ? v : null;
  }, 4000);
  check("data-find-enter removed after the settle window", disarmed?.armed === false,
    `rungs still reporting: ${(disarmed?.rungs ?? []).length}`);
  const afterDisarm = disarmed?.rungs?.every((r) => r.name === "none") ?? false;
  check("rungs report animation-name none once disarmed", afterDisarm,
    JSON.stringify(disarmed?.rungs?.map((r) => `${r.rung}:${r.name}`)));
  // typing is a re-render, not a re-entrance: disarm must survive it.
  // The keystroke is synthetic-in-browser (native value setter + input
  // event — React's onChange reads it like a human's typing).
  const typed = await readJson(`(async () => {
    const i=document.querySelector('[data-testid="canvas-find-input"]');
    if(!i) return JSON.stringify({ input:false });
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(i,'m'); i.dispatchEvent(new Event('input',{ bubbles:true }));
    await new Promise(r => setTimeout(r, 150));
    const bar=document.querySelector('[data-canvas-find-bar]');
    const rungs=[...bar.querySelectorAll('[data-find-rung]')].map((el)=>getComputedStyle(el).animationName);
    return JSON.stringify({ input:true, armed: bar.hasAttribute('data-find-enter'), rungs });
  })()`);
  check("typing does NOT replay the cascade (still disarmed)", typed?.armed === false && (typed?.rungs ?? []).every((n) => n === "none"),
    `armed=${typed?.armed}`);

  /* ============ F4 — the count answers ================================== */
  console.log(`\n[F4] the count: aria-live + the amber tick (in-browser timing)`);
  // clear F3's 'm', type the motion query, read the honest count — one
  // in-browser sequence; the count derives from store state, so give the
  // render a beat before reading.
  const count1 = await readJson(`(async () => {
    const i=document.querySelector('[data-testid="canvas-find-input"]');
    if(!i) return JSON.stringify({ input:false });
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(i,''); i.dispatchEvent(new Event('input',{ bubbles:true }));
    setter.call(i,'motion'); i.dispatchEvent(new Event('input',{ bubbles:true }));
    await new Promise(r => setTimeout(r, 250));
    const c=document.querySelector('[data-testid="canvas-find-count"]');
    if(!c) return JSON.stringify({ count:false });
    return JSON.stringify({ text: c.textContent.trim(), live: c.getAttribute('aria-live') });
  })()`);
  check("count reports matches for 'motion'", count1?.text != null && /\d+ match/.test(count1.text), count1?.text);
  check("count is a polite live region", count1?.live === "polite", count1?.live);
  // the tick: dispatch Enter at the input, wait 80ms IN-PAGE (inside the
  // 480ms flash), read the remounted span's animation — the 480ms window
  // is huge when the clock is the browser's own.
  const tick = await readJson(`(async () => {
    const i=document.querySelector('[data-testid="canvas-find-input"]');
    if(!i) return JSON.stringify({ input:false });
    i.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
    await new Promise(r => setTimeout(r, 80));
    const c=document.querySelector('[data-testid="canvas-find-count"]');
    if(!c) return JSON.stringify({ count:false });
    const t=c.querySelector('[data-find-tick]');
    return JSON.stringify({ text: c.textContent.trim(), tick: !!t, anim: t ? getComputedStyle(t).animationName : null });
  })()`);
  check("Enter advances the cycle (k of N)", /\d+ of \d+/.test(tick?.text ?? ""), tick?.text);
  check("the tick span plays the amber flash", tick?.tick === true && tick?.anim === "find-tick", tick?.anim);

  /* ============ F5 — the stand-down ===================================== */
  console.log(`\n[F5] wire drag — the lens stands down WITHOUT leaving`);
  // take focus off the input so Escape belongs to the canvas ladder, not find
  await readJson(`JSON.stringify((function(){ if(document.activeElement) document.activeElement.blur(); return 1; })())`);
  await sleep(200);
  const port = await readJson(`JSON.stringify((function(){
    const p=document.querySelector('[data-port^="out:"]');
    if(!p) return null;
    const r=p.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  })())`);
  check("a port is on screen to grab", port?.x != null, JSON.stringify(port));
  const dragStart = await readJson(`JSON.stringify((function(){
    const p=document.querySelector('[data-port^="out:"]');
    if(!p) return {fired:false};
    p.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, button:0, pointerId:1, isPrimary:true,
      clientX:${port?.x ?? 0}, clientY:${port?.y ?? 0} }));
    return { fired:true };
  })())`);
  check("pointerdown fired on the port", dragStart?.fired === true);
  await sleep(420);
  const hidden = await barHidden();
  check("bar stands down: still in DOM, opacity 0, pointer-events none",
    hidden?.present === true && parseFloat(hidden?.opacity ?? "1") < 0.05 && hidden?.pe === "none",
    JSON.stringify(hidden));
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(500);
  const back = await barHidden();
  const backRung = await rungInfo();
  check("Escape cancels the wire — bar returns (opacity 1)",
    back?.present === true && parseFloat(back?.opacity ?? "0") > 0.95 && back?.pe !== "none",
    JSON.stringify(back));
  check("the return does NOT replay the cascade (disarm held)", backRung?.armed === false,
    `armed=${backRung?.armed}`);

  /* ============ F6 — the close ========================================== */
  console.log(`\n[F6] Escape in the input closes instantly (in-browser)`);
  const gone = await readJson(`(async () => {
    const i=document.querySelector('[data-testid="canvas-find-input"]');
    if(!i) return JSON.stringify({ input:false });
    i.focus();
    i.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
    await new Promise(r => setTimeout(r, 150));
    return JSON.stringify({ gone: !document.querySelector('[data-canvas-find-bar]') });
  })()`);
  check("bar unmounted (no exit ceremony)", gone?.gone === true, JSON.stringify(gone));

  /* ============ 📸 the settled lens ===================================== */
  // reopen once for the record: cascade → settled state with a query
  sh(`agent-browser press Control+f >/dev/null 2>&1`);
  await sleep(850);
  sh(`agent-browser keyboard type "motion" >/dev/null 2>&1`);
  await sleep(650);
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t578-find-lens-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled lens screenshot", true, ".qa-logs/shots/t578-find-lens-settled.png");
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(300);
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

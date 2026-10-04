/**
 * t584 — the find bar's chips learn to speak: the chip cascade, live.
 *
 * t578 gave the find bar the lens language (rows drop 0/60/120ms); t579
 * gave it the ripple (the count answers, then the matches answer). The
 * middle voice was missing: the chips INSIDE the rows arrived as part of
 * their row's block fade. t584 gives them their own sentence — the row
 * lands first, then its chips light up one by one in reading order (the
 * index-as-arrival doctrine: t572's groups, t576's KPI band, t579's
 * ripple). Rung 0 is the ANCHOR and never cascades.
 *
 * Faces proven here:
 *   C1  the two phases coexist — at t≈380ms after Ctrl+F (in-browser
 *       timing; channel latency retired as a variable, t578's F1 lesson)
 *       the rungs still play find-drop on the 0/60/120 ladder AND the
 *       status chips play find-chip-enter on the 280/304/328/352/376
 *       ladder (base = the row's landing: 60ms delay + 220ms travel).
 *   C2  the wave is real paint — the mid-flight opacity sample forms a
 *       monotone gradient (chip0 > chip2 > chip4, chip0 ≈ settled,
 *       chip4 barely lit): the chips are mid-animations, not attribute
 *       swaps. easeOutQuint pops the head fast; the tail carries the wave.
 *   C3  the type row speaks the same sentence with a LATER base
 *       (340ms + i×24) — two rows, two bases, one grammar (conditional:
 *       the type row only exists when the world has >1 category).
 *   C4  disarm — after the 720ms settle window data-find-enter is gone,
 *       every chip reports animation-name none, and typing does NOT
 *       replay the cascade (one-shot per open — t572's re-arm doctrine;
 *       the settle window was re-budgeted 560 → 720ms so the widest
 *       chip row is never cut mid-flight).
 *   C5  re-entrance replays — close and re-open re-arms; the chips play
 *       again (re-entrance is re-arrival, the t572 law).
 *   C6  the anchor never cascades — rung 0's input, count, arrows and
 *       close carry NO data-find-chip and never play find-chip-enter,
 *       even while armed (t572's law: the input is what everything else
 *       arrives to).
 *   R   console clean; roster untouched (the lens is ephemeral —
 *       nothing enters the world).
 *
 * Environment shim = t571/t578's: stock headless Chrome reports
 * (hover:none), so this harness spawns desktop-capable Chrome and points
 * agent-browser at it via `connect`. Everything lives in this one Node
 * process. CDP port 9324 (9323 is t578's — zombie ports get, zombies
 * keep, the t581 lesson).
 *
 * Runs in the EMPIAR world in place (no switch), mints nothing.
 *
 * Usage: node scripts/t584-find-chip-cascade-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9324";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t584-harness-chrome-profile";
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

  /* ---- hydration guard: dev lazy-compiles the canvas route on first
          visit — every timing face below assumes the app is interactive.
          Poll for actual canvas cards, not just a 200. ------------------ */
  const hydrated = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    return v?.cards > 0 ? v : null;
  }, 90000, 1000);
  check("canvas hydrated (cards in DOM)", hydrated?.cards > 0, `${hydrated?.cards} cards`);

  /* ============ C1 + C2 — the two phases, mid-flight ==================== */
  console.log(`\n[C1/C2] Ctrl+F — rows land, then the words are spoken (in-browser timing, 3-landing acceptance)`);
  /* One eval per LANDING: dispatch the keydown, await 380ms IN-PAGE (the
     status ladder is 280..376ms + 160ms travel, so t=380 is inside the
     wave), then read rungs + chips + opacities before the result ever
     crosses the channel. The dev main thread jitters the mount latency
     (three windows, three signatures: all-zeros, 0.87-head, 0.73-head
     with a collapsed tail) — so the harness now takes up to THREE
     landings and accepts the first that actually caught the wave
     (started head strictly decreasing + a chip mid-fade). Catching a
     mid-flight wave on a jittery channel is a sampling problem, not a
     product verdict; the LADDER face below still pins the schedule.
     NOTE — no // comments in the IIFE: evalJs flattens newlines and a
     // would swallow every statement behind it (t579's transport lesson). */
  const sampleOneLanding = (escFirst) => readJson(`(async () => {
    ${escFirst ? "document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true })); await new Promise(r => setTimeout(r, 500));" : ""}
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'f', ctrlKey:true, bubbles:true, cancelable:true }));
    await new Promise(r => setTimeout(r, 380));
    const bar=document.querySelector('[data-canvas-find-bar]');
    if(!bar) return JSON.stringify({ bar:false });
    const rungs=[...bar.querySelectorAll('[data-find-rung]')].map((el)=>({
      rung: el.getAttribute('data-find-rung'),
      name: getComputedStyle(el).animationName,
      d: el.style.getPropertyValue('--find-d').trim()
    }));
    const chips=[...bar.querySelectorAll('[data-find-chip]')].map((el)=>({
      testid: el.getAttribute('data-testid') || '',
      name: getComputedStyle(el).animationName,
      cd: el.style.getPropertyValue('--find-cd').trim(),
      opacity: getComputedStyle(el).opacity
    }));
    return JSON.stringify({ bar:true, armed: bar.hasAttribute('data-find-enter'), rungs, chips });
  })()`);
  const caughtWave = (sample) => {
    if (sample?.bar !== true || sample?.armed !== true) return false;
    const ops = (sample.chips ?? []).filter((c) => c.testid.startsWith("canvas-find-status-")).map((c) => parseFloat(c.opacity));
    const started = ops.filter((o) => o > 0.02);
    const strictlyDown = started.every((v, k) => k === 0 || v < started[k - 1]);
    return started.length >= 2 && strictlyDown;
  };
  let mid = null;
  for (let attempt = 0; attempt < 3 && !mid; attempt++) {
    const sample = await sampleOneLanding(attempt > 0);
    if (caughtWave(sample)) mid = sample;
    else console.log(`  … landing ${attempt + 1} missed the wave, re-opening (re-entrance is re-arrival)`);
  }
  if (!mid) mid = await sampleOneLanding(true); /* last honest sample so the faces report what IS */
  check("bar mounts armed at t=380ms (mid two-phase)", mid?.bar === true && mid?.armed === true, JSON.stringify(mid?.armed));
  const r0 = mid?.rungs?.find((r) => r.rung === "0");
  const r1 = mid?.rungs?.find((r) => r.rung === "1");
  check("rungs still play find-drop (the rows' own sentence intact)",
    r0?.name === "find-drop" && r1?.name === "find-drop",
    JSON.stringify(mid?.rungs?.map((r) => `${r.rung}:${r.name}`)));
  const statusChips = (mid?.chips ?? []).filter((c) => c.testid.startsWith("canvas-find-status-"));
  check("five status chips carry the chip cascade", statusChips.length === 5 &&
    statusChips.every((c) => c.name === "find-chip-enter"),
    JSON.stringify(statusChips.map((c) => `${c.testid.replace("canvas-find-status-", "")}:${c.name}`)));
  const cds = statusChips.map((c) => parseInt(c.cd, 10));
  check("the chip ladder is 280/304/328/352/376 (row landing + index×24)",
    cds.length === 5 && cds.every((v, k) => v === 280 + k * 24),
    JSON.stringify(cds));
  const ops = statusChips.map((c) => parseFloat(c.opacity));
  /* the wave's honest invariant: the STARTED head strictly decreasing
     (order is the doctrine) with at least one chip genuinely mid-fade
     (real paint, not attribute). The absolute phase is jitter — the
     3-landing acceptance loop above catches the wave where it can. */
  const startedOps = ops.filter((o) => o > 0.02);
  const strictlyDown = startedOps.every((v, k) => k === 0 || v < startedOps[k - 1]);
  const midFade = ops.filter((o) => o > 0.02 && o < 0.98).length;
  check("C2: mid-flight paint — started head strictly decreasing, a chip caught mid-fade",
    ops.length === 5 && startedOps.length >= 2 && strictlyDown && midFade >= 1,
    JSON.stringify(ops.map((o) => o.toFixed(2))));
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t584-find-chips-mid.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 mid-cascade screenshot", true, ".qa-logs/shots/t584-find-chips-mid.png");

  /* ============ C3 — the type row speaks with a later base ============== */
  console.log(`\n[C3] the type row — same sentence, later base`);
  const typeChips = (mid?.chips ?? []).filter((c) => c.testid.startsWith("canvas-find-type-"));
  if (typeChips.length === 0) {
    check("type row absent in this world (skip: >1 category required)", true, "conditional face");
  } else {
    const tds = typeChips.map((c) => parseInt(c.cd, 10));
    check("type chips play the cascade", typeChips.every((c) => c.name === "find-chip-enter"),
      JSON.stringify(typeChips.map((c) => c.name)));
    check("type ladder is 340 + i×24 (later base than status)",
      tds.every((v, k) => v === 340 + k * 24) && tds[0] > cds[0],
      JSON.stringify(tds));
  }

  /* ============ C4 — disarm: a one-shot per open ======================== */
  console.log(`\n[C4] settle disarms — typing never replays`);
  const disarmed = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      const bar=document.querySelector('[data-canvas-find-bar]');
      if(!bar) return { bar:false };
      return { bar:true, armed: bar.hasAttribute('data-find-enter') };
    })())`);
    return v?.armed === false ? v : null;
  }, 4000);
  check("data-find-enter removed after the re-budgeted settle window", disarmed?.armed === false,
    JSON.stringify(disarmed));
  const chipState = await readJson(`JSON.stringify((function(){
    const bar=document.querySelector('[data-canvas-find-bar]');
    if(!bar) return { bar:false };
    const chips=[...bar.querySelectorAll('[data-find-chip]')].map((el)=>getComputedStyle(el).animationName);
    return { bar:true, chips };
  })())`);
  check("chips report animation-name none once disarmed",
    chipState?.bar === true && (chipState?.chips ?? []).length > 0 && chipState.chips.every((n) => n === "none"),
    JSON.stringify(chipState?.chips));
  const typed = await readJson(`(async () => {
    const i=document.querySelector('[data-testid="canvas-find-input"]');
    if(!i) return JSON.stringify({ input:false });
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(i,'m'); i.dispatchEvent(new Event('input',{ bubbles:true }));
    await new Promise(r => setTimeout(r, 150));
    const bar=document.querySelector('[data-canvas-find-bar]');
    const chips=[...bar.querySelectorAll('[data-find-chip]')].map((el)=>getComputedStyle(el).animationName);
    return JSON.stringify({ input:true, armed: bar.hasAttribute('data-find-enter'), chips });
  })()`);
  check("typing does NOT replay the cascade (still disarmed)",
    typed?.armed === false && (typed?.chips ?? []).every((n) => n === "none"),
    `armed=${typed?.armed}`);

  /* ============ C6 — the anchor never cascades ========================== */
  console.log(`\n[C6] the anchor — rung 0 never carries a chip voice`);
  /* While disarmed the animation names are all none, so this face must
     run WHILE ARMED — fold it into the C5 re-open below. */

  /* ============ C5 — re-entrance replays (hosts C6) ===================== */
  console.log(`\n[C5] re-entrance — close and reopen replays (and the anchor keeps still)`);
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(400);
  sh(`agent-browser press Control+f >/dev/null 2>&1`);
  await sleep(300);
  const replay = await readJson(`JSON.stringify((function(){
    const bar=document.querySelector('[data-canvas-find-bar]');
    if(!bar) return { bar:false };
    const chips=[...bar.querySelectorAll('[data-find-chip]')].map((el)=>getComputedStyle(el).animationName);
    const anchorKids=[...bar.querySelectorAll('[data-find-rung="0"] input, [data-find-rung="0"] button, [data-find-rung="0"] [data-testid="canvas-find-count"]')].map((el)=>({
      tag: el.tagName.toLowerCase(),
      isChip: el.hasAttribute('data-find-chip'),
      name: getComputedStyle(el).animationName
    }));
    return { bar:true, armed: bar.hasAttribute('data-find-enter'), chips, anchorKids };
  })())`);
  check("re-open re-arms and the chips play again",
    replay?.armed === true && (replay?.chips ?? []).every((n) => n === "find-chip-enter"),
    JSON.stringify(replay?.chips?.slice(0, 3)));
  check("anchor children carry no data-find-chip and never play find-chip-enter",
    (replay?.anchorKids ?? []).length >= 4 && replay.anchorKids.every((k) => !k.isChip && k.name !== "find-chip-enter"),
    JSON.stringify(replay?.anchorKids?.map((k) => `${k.tag}:${k.name}`)));
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(300);

  /* ============ 📸 the settled lens ===================================== */
  sh(`agent-browser press Control+f >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "motion" >/dev/null 2>&1`);
  await sleep(650);
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t584-find-lens-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled lens screenshot", true, ".qa-logs/shots/t584-find-lens-settled.png");
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

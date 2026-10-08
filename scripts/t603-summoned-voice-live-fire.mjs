/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t603 — the summoned voice: live fire.
 *
 * Birth has a voice (t598 cards / t599 batch wires / t600 verb wires),
 * death has one (t601 cards / t602 wires). The THIRD way a thing appears
 * was still silent: hover asks a question and the answer POPPED into
 * existence. Now the wire's three summoned faces surface on the family
 * staircase (24ms): the halo ring is the answer's PLACE (0ms), the X
 * button is the answer's TOOL (24ms, rise 0.6→1), the tooltip is the
 * answer's NAME (48ms, opacity-only). Budget 48+140=188ms < 200ms.
 *
 *   G0  the source contract + the SERVED freshness gate
 *   Q   the world (12c/13e + 12 dots)
 *   W1  THE SUMMONED VOICE — a real hover mounts all three faces and
 *       each is seen mid-flight on the staircase; the settled state is
 *       read from the LIVE DOM; the answer follows the question (moving
 *       the finger away dismisses all three instantly — by design)
 *   W2  THE STATE SURFACE — selecting a card mounts the halo on its
 *       wires (touchesSelected) and the halo still surfaces (a state
 *       display deserves the same manners); the X and the tooltip stay
 *       home (the finger is on the card, not on the wire)
 *   R   the world owes nothing — no probes minted, roster 12→12,
 *       console clean, zero orphans
 *
 * The hover faces need a DESKTOP-capable browser (the t602 tuition: the
 * wire's hit corridor is mouse-ONLY by design — Task 176 — so under
 * (hover: none) nothing mounts). The t584 dance: own Chrome with the
 * blink-settings shim + the CDP media shim, agent-browser attached
 * through port 9324 (9323 is t578's; a dedicated port per harness).
 *
 * Usage: node scripts/t603-summoned-voice-live-fire.mjs
 */

import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
/* the canonical world's fingerprint (boot heal deletes anything else) */
const CANONICAL_IDS = new Set([
  "cmuro2ufm000qn5nbpldk6u5c", "cmuro2uim000sn5nbnaykzk4d",
  "cmuro5s30000un5nbuxfic7tb", "cmuro5ze3000wn5nbewxp1nl8",
  "cmurol4yc000yn5nbkb59th5d", "cmurpj2ty0010n5nba6fzs8qc",
  "cmurqlpn80012n5nbtoijfnvr", "cmurqs6g20014n5nb2d994z44",
  "cmurqymg50016n5nb7yawisow", "cmurqymr10018n5nbkd7q4tta",
  "cmut5n5xl0005n53mmejkvyal", "cmut5s9a00007n53m76xvi21e",
]);

/* the hover faces need a DESKTOP-capable browser */
const CDP_PORT = "9324";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t603-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const readJson = async (js, tries = 4) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      /* bare scalar strings are truthy — coerce the leaves (the t598
       * tuition, paid three times before anyone learns it for good) */
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
async function pollUntil(fn, timeoutMs = 60000, step = 400) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
const api = (path, method = "GET") =>
  JSON.parse(sh(`curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${BASE}${path}`));

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

/* the persistent in-page sampler: installed BEFORE the finger lands,
 * records the whole summoning at 30ms on the page's own clock. Three
 * summoned faces, one staircase: halo (place, 0ms) → X (tool, 24ms) →
 * tooltip (name, 48ms). */
const SAMPLER = `(function(){
  window.__t603 = { frames: [], t0: performance.now() };
  var last = "";
  window.__t603iv = setInterval(function(){
    if (!window.__t603) return;
    var x = document.querySelector('[data-canvas-ui="edge-delete"] [data-summon="rise"]');
    var tip = document.querySelector('[data-canvas-ui="edge-label"] [data-summon]');
    var halos = document.querySelectorAll('circle[data-summon]');
    var halo = halos.length ? halos[0] : null;
    var f = {
      t: Math.round(performance.now() - window.__t603.t0),
      x: x ? 1 : 0,
      xop: x ? getComputedStyle(x).opacity : null,
      xsc: x ? getComputedStyle(x).scale : null,
      tip: tip ? 1 : 0,
      top: tip ? getComputedStyle(tip).opacity : null,
      h: halos.length,
      hop: halo ? getComputedStyle(halo).opacity : null,
      e: document.querySelectorAll("[data-edge-id]").length,
      c: document.querySelectorAll("[data-job]").length
    };
    var key = JSON.stringify([f.x,f.xop,f.xsc,f.tip,f.top,f.h,f.hop,f.e,f.c]);
    if (key !== last) { last = key; window.__t603.frames.push(f); }
  }, 30);
  setTimeout(function(){ if (window.__t603iv) clearInterval(window.__t603iv); }, 8000);
  return JSON.stringify({ armed: true });
})()`;

const stopSampler = `JSON.stringify((function(){
  if (window.__t603iv) clearInterval(window.__t603iv);
  var s = window.__t603 || { frames: [] };
  window.__t603 = null;
  return { frames: s.frames };
})())`;

/* W2's sampler: the state surface — the halo on the SELECTED card's
 * wires; the X and the tooltip must stay home the whole time. */
const SAMPLER2 = `(function(){
  window.__t603w2 = { frames: [], t0: performance.now() };
  var last = "";
  window.__t603w2iv = setInterval(function(){
    if (!window.__t603w2) return;
    var halos = document.querySelectorAll('circle[data-summon]');
    var halo = halos.length ? halos[0] : null;
    var x = document.querySelector('[data-canvas-ui="edge-delete"]');
    var tip = document.querySelector('[data-canvas-ui="edge-label"]');
    var f = {
      t: Math.round(performance.now() - window.__t603w2.t0),
      h: halos.length,
      hop: halo ? getComputedStyle(halo).opacity : null,
      x: x ? 1 : 0,
      tip: tip ? 1 : 0,
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length
    };
    var key = JSON.stringify([f.h,f.hop,f.x,f.tip,f.c,f.e]);
    if (key !== last) { last = key; window.__t603w2.frames.push(f); }
  }, 30);
  setTimeout(function(){ if (window.__t603w2iv) clearInterval(window.__t603w2iv); }, 8000);
  return JSON.stringify({ armed: true });
})()`;

const stopSampler2 = `JSON.stringify((function(){
  if (window.__t603w2iv) clearInterval(window.__t603w2iv);
  var s = window.__t603w2 || { frames: [] };
  window.__t603w2 = null;
  return { frames: s.frames };
})())`;

/* a blank canvas point: outside every card/wire/minimap, inside the
 * workspace — for a real-mouse dismiss click (synthetic clicks don't
 * reach the pointer-sequence selectors, the t600 tuition) */
const BLANK_POINT = `(function(){
  for (var y = 80; y < innerHeight - 40; y += 24) {
    for (var x = 30; x < innerWidth - 40; x += 40) {
      var el = document.elementFromPoint(x, y);
      if (!el) continue;
      if (el.closest('[data-job],[data-edge-id],[data-canvas-ui="minimap"],[role="menu"],[role="dialog"]')) continue;
      if (!el.closest("[data-canvas]")) continue;
      return JSON.stringify({ x: x, y: y });
    }
  }
  return JSON.stringify({ x: null });
})()`;

/* pick a hoverable wire: bounding-rect center inside the viewport and
 * the elementFromPoint at that center lands inside the SAME edge group
 * (a straight horizontal bezier's box center is on the path itself) */
const PICK_WIRE = `(function(){
  var out = { found: null, candidates: 0 };
  var groups = document.querySelectorAll("[data-edge-id]");
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    var p = g.querySelector("path");
    if (!p) continue;
    var r = p.getBoundingClientRect();
    if (r.width < 8 && r.height < 8) continue;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 20 || cy < 70 || cx > innerWidth - 20 || cy > innerHeight - 20) continue;
    out.candidates++;
    var hit = document.elementFromPoint(cx, cy);
    if (hit && g.contains(hit)) {
      out.found = { id: g.getAttribute("data-edge-id"), cx: Math.round(cx), cy: Math.round(cy) };
      break;
    }
  }
  return JSON.stringify(out);
})()`;

try {
  /* ---- boot: world guard BEFORE any browser spend (the t584 discipline) */
  console.log(`[boot] world guard`);
  const projects0 = api("/api/projects").projects;
  const active0 = projects0.find((p) => p.active);
  if (!active0 || active0.id !== EMPIAR_ID) {
    console.error(`FATAL: active world is ${active0 ? active0.id : "unknown"}, expected EMPIAR — refusing to run in a borrowed world`);
    process.exit(2);
  }
  console.log(`[boot] world guard ok — EMPIAR active, roster ${active0.stats.total}`);

  console.log(`[boot] desktop-capable Chrome (the hover faces need it)`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  const chromeReady = await launchDesktopChrome();
  if (!chromeReady) {
    console.error("FATAL: the desktop-capable Chrome never opened its CDP port — environment shim failed");
    process.exit(2);
  }
  check("desktop-capable Chrome up", true, `port ${CDP_PORT}`);
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
  sh(`agent-browser open "about:blank" >/dev/null 2>&1`);
  await sleep(500);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  applyShim();

  const sentinel = await readJson(`JSON.stringify({ s: 40 + 2 })`);
  check("eval round-trip sentinel", sentinel && sentinel.s === 42, JSON.stringify(sentinel));

  /* heal before you measure (t597→t603): sweep this family's leftover
   * probes BEFORE the census gates anything — the t598 lesson: pollution
   * crosses windows */
  {
    const jobsNow = api("/api/jobs").jobs || [];
    const strangers = jobsNow.filter((j) => !CANONICAL_IDS.has(j.id));
    for (const j of strangers) api(`/api/jobs/${j.id}`, "DELETE");
    if (strangers.length > 0) {
      await sleep(1200);
      console.log(`  [heal] swept ${strangers.length} leftover probe(s)`);
    }
  }
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(800);
  const roster0 = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
  check("roster0 = 12 (healed baseline)", roster0 && roster0.stats.total === 12, roster0 ? `total=${roster0.stats.total}` : "no roster");

  /* ---- G0 — the source contract + the SERVED freshness gate --------------- */
  console.log(`\n[G0] source contract + served freshness`);
  {
    const faces = sh(`rg -c 'data-summon' src/components/workflow/edges-layer.tsx || true`);
    check("edges-layer: three summoned faces marked", parseInt(faces || "0", 10) === 3, `refs=${faces}`);
    const cds = sh(`rg -c 'summon-cd' src/components/workflow/edges-layer.tsx || true`);
    check("edges-layer: each face carries its staircase delay", parseInt(cds || "0", 10) === 3, `refs=${cds}`);
    const rise = sh(`rg -c 'data-summon="rise"' src/components/workflow/edges-layer.tsx || true`);
    check("edges-layer: the X is the one rising face", parseInt(rise || "0", 10) === 1, `refs=${rise}`);
    const keys = sh(`rg -c '@keyframes summon-fade-in|@keyframes summon-rise-in' src/app/globals.css || true`);
    check("css: both summon keyframes (fade + rise)", parseInt(keys || "0", 10) === 2, `refs=${keys}`);
    const scoped = sh(`rg -c '\\[data-edges-layer\\] \\[data-summon' src/app/globals.css || true`);
    check("css: scoped to the edges layer (2 rules)", parseInt(scoped || "0", 10) === 2, `refs=${scoped}`);
    const noPkill = sh(`rg -c 'prefers-reduced-motion: no-preference' src/app/globals.css || true`);
    check("css: the family media gate present", parseInt(noPkill || "0", 10) >= 1, `refs=${noPkill}`);
    const servedCss = sh(`rg -l "summon-rise-in" .next/dev/ 2>/dev/null | wc -l`);
    const servedJs = sh(`rg -l 'data-summon="rise"' .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | wc -l`);
    check("served artifacts carry the t603 signatures", parseInt(servedCss || "0", 10) >= 1 && parseInt(servedJs || "0", 10) >= 1, `css=${servedCss} js=${servedJs}`);
  }

  /* ---- Q — the world ------------------------------------------------------ */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));

  /* ---- W1 — THE SUMMONED VOICE -------------------------------------------- */
  console.log(`\n[W1] the summoned voice — hover asks, three answers surface`);
  const picked = await readJson(PICK_WIRE);
  check("W1 a hoverable wire picked", !!(picked && picked.found && picked.found.id),
    picked && picked.found ? `edge ${picked.found.id.slice(0, 8)} at (${picked.found.cx},${picked.found.cy}), ${picked.candidates} candidates` : `none of ${picked && picked.candidates}`);
  if (!(picked && picked.found && picked.found.id)) throw new Error("W1: no hoverable wire");
  const wireId = picked.found.id;

  await readJson(SAMPLER);
  const hovered = await pollUntil(async () => {
    try { sh(`agent-browser hover '[data-edge-id="${wireId}"] path' >/dev/null 2>&1`); } catch { /* retry */ }
    const v = await readJson(`JSON.stringify(!!document.querySelector('[data-canvas-ui="edge-delete"]'))`);
    return v === true ? v : null;
  }, 15000, 700);
  check("W1 the hover X mounted at the midpoint", hovered === true, "data-canvas-ui=edge-delete present");

  /* let the whole staircase play out inside the sampling window */
  await sleep(450);
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t603-summon-mid.png >/dev/null 2>&1`); } catch { /* opportunistic */ }
  await sleep(120);
  const f1 = await readJson(stopSampler, 6);
  const frames1 = Array.isArray(f1 && f1.frames) ? f1.frames : [];
  check("W1 sampler captured the summoning", frames1.length >= 3, `${frames1.length} frames`);

  const withX = frames1.filter((f) => f.x === 1);
  check("W1 the X is seen (the tool surfaced)", withX.length >= 2, `x frames=${withX.length}/${frames1.length}`);
  const midX = withX.filter((f) => f.xop !== null && parseFloat(f.xop) < 1);
  check("W1 ∃ mid-flight X frame (opacity < 1)", midX.length >= 1, `mid at t=${midX.map((f) => f.t).join(",") || "none"}`);
  const midXsc = withX.filter((f) => f.xsc !== null && f.xsc !== "none" && parseFloat(f.xsc) < 1);
  check("W1 ∃ rising X frame (scale < 1 — the rise is real)", midXsc.length >= 1, `scale at ${midXsc.map((f) => f.xsc).join(",") || "none"}`);
  const withTip = frames1.filter((f) => f.tip === 1);
  check("W1 the tooltip is seen (the name surfaced)", withTip.length >= 2, `tip frames=${withTip.length}/${frames1.length}`);
  const midTip = withTip.filter((f) => f.top !== null && parseFloat(f.top) < 1);
  check("W1 ∃ mid-fade tooltip frame", midTip.length >= 1, `mid at t=${midTip.map((f) => f.t).join(",") || "none"}`);
  const withHalo = frames1.filter((f) => f.h >= 1);
  check("W1 the halo is seen (the place surfaced)", withHalo.length >= 2, `halo frames=${withHalo.length}/${frames1.length}`);
  const midHalo = withHalo.filter((f) => f.hop !== null && parseFloat(f.hop) > 0 && parseFloat(f.hop) < 0.4);
  check("W1 ∃ mid-fade halo frame (strictly inside (0, 0.4))", midHalo.length >= 1, `mid at t=${midHalo.map((f) => f.t).join(",") || "none"}`);
  const worldSteady = frames1.every((f) => f.c === 12 && f.e === 13);
  check("W1 the summoning never touched the world (no mutation across any frame)", worldSteady, "no mutation, no cascade of anything else");

  /* the staircase delays — read from the LIVE computed style */
  const cds = await readJson(`JSON.stringify((function(){
    var x = document.querySelector('[data-canvas-ui="edge-delete"] [data-summon="rise"]');
    var tip = document.querySelector('[data-canvas-ui="edge-label"] [data-summon]');
    var h = document.querySelector('circle[data-summon]');
    return {
      x: x ? getComputedStyle(x).animationDelay : null,
      tip: tip ? getComputedStyle(tip).animationDelay : null,
      h: h ? getComputedStyle(h).animationDelay : null
    };
  })())`);
  check("W1 the staircase: halo 0s → X 24ms → tooltip 48ms",
    cds && cds.h === "0s" && cds.x === "0.024s" && cds.tip === "0.048s", JSON.stringify(cds));

  /* settled state — read from the LIVE DOM (the sampler freezes mid-breath
   * under load; the t596 frozen-window family) */
  const settled1 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      var x = document.querySelector('[data-canvas-ui="edge-delete"] [data-summon="rise"]');
      var tip = document.querySelector('[data-canvas-ui="edge-label"] [data-summon]');
      var h = document.querySelector('circle[data-summon]');
      if (!x || !tip || !h) return null;
      return {
        xop: parseFloat(getComputedStyle(x).opacity),
        top: parseFloat(getComputedStyle(tip).opacity),
        hop: parseFloat(getComputedStyle(h).opacity),
        xsc: getComputedStyle(x).scale
      };
    })())`);
    /* the retired rise reads "1" in this Chrome (fill-both ends at the
     * base value and the independent scale serializes as its number, not
     * "none" — the t602 tuition ③ mirrored: ask what the value looks
     * like when the mechanism is OVER, not only while it runs) */
    return v && v.xop === 1 && v.top === 1 && v.hop === 0.4 && (v.xsc === "none" || parseFloat(v.xsc) === 1) ? v : null;
  }, 8000, 300);
  check("W1 settled: X/tooltip fully present, halo at its 0.4 base, rise retired", !!settled1, JSON.stringify(settled1));
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t603-summon-settled.png >/dev/null 2>&1`); } catch { /* */ }

  /* the answer follows the question: move the finger away, all three
   * faces leave INSTANTLY — lingering would be the glitch, not manners */
  await readJson(`JSON.stringify((function(){
    window.__t603gone = { t0: performance.now() };
    return { armed: true };
  })())`);
  sh(`agent-browser mouse move 12 90 >/dev/null 2>&1 || true`);
  const dismissed = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({
      x: !!document.querySelector('[data-canvas-ui="edge-delete"]'),
      tip: !!document.querySelector('[data-canvas-ui="edge-label"]'),
      h: document.querySelectorAll('circle[data-summon]').length
    })`);
    return v && v.x === false && v.tip === false && v.h === 0 ? v : null;
  }, 6000, 250);
  check("W1 the answer follows the question (finger away → all three dismissed)", !!dismissed, JSON.stringify(dismissed));

  /* ---- W2 — THE STATE SURFACE --------------------------------------------- */
  console.log(`\n[W2] the state surface — selection lights the halo, the X stays home`);
  const jobsAll = api("/api/jobs").jobs || [];
  const idle = jobsAll.find((j) => j.status !== "completed");
  check("W2 an idle card exists to select", !!idle, idle ? `${idle.name} (${idle.status})` : "none");
  if (!idle) throw new Error("W2: no idle card");

  await readJson(SAMPLER2);
  sh(`agent-browser click '[data-job="${idle.id}"]' >/dev/null 2>&1 || true`);
  const haloOn = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(document.querySelectorAll('circle[data-summon]').length)`);
    return typeof v === "number" && v >= 1 ? v : null;
  }, 8000, 300);
  check("W2 selecting the card mounts the halo on its wires (touchesSelected)", typeof haloOn === "number" && haloOn >= 1, `halos=${haloOn}`);

  await sleep(400);
  const f2 = await readJson(stopSampler2, 6);
  const frames2 = Array.isArray(f2 && f2.frames) ? f2.frames : [];
  check("W2 sampler captured the state surface", frames2.length >= 3, `${frames2.length} frames`);
  const withHalo2 = frames2.filter((f) => f.h >= 1);
  check("W2 the halo is seen mounting", withHalo2.length >= 1, `halo frames=${withHalo2.length}/${frames2.length}`);
  const midHalo2 = withHalo2.filter((f) => f.hop !== null && parseFloat(f.hop) > 0 && parseFloat(f.hop) < 0.4);
  check("W2 ∃ mid-fade halo frame (the state display has the same manners)", midHalo2.length >= 1, `mid at t=${midHalo2.map((f) => f.t).join(",") || "none"}`);
  const stayHome = frames2.filter((f) => f.h >= 1).every((f) => f.x === 0 && f.tip === 0);
  check("W2 the X and the tooltip stay home (the finger is on the card, not the wire)", stayHome, "no hover faces during selection");

  /* borrowed must be returned: dismiss the selection with a real blank
   * click (Escape is not guaranteed to be wired to selection) */
  const blank = await readJson(BLANK_POINT);
  if (blank && blank.x !== null) {
    sh(`agent-browser mouse move ${blank.x} ${blank.y} >/dev/null 2>&1 || true`);
    await sleep(120);
    sh(`agent-browser mouse down >/dev/null 2>&1 || true`);
    await sleep(60);
    sh(`agent-browser mouse up >/dev/null 2>&1 || true`);
  }
  const dismissed2 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({
      h: document.querySelectorAll('circle[data-summon]').length,
      panel: !!document.querySelector('[data-canvas-ui="edge-label"]')
    })`);
    return v && v.h === 0 ? v : null;
  }, 6000, 300);
  check("W2 the selection returned (blank click → halo dismissed)", !!dismissed2, JSON.stringify(dismissed2));

  /* ---- R — the world owes nothing ----------------------------------------- */
  console.log(`\n[R] return everything`);
  const jobsEnd = (api("/api/jobs").jobs || []).length;
  const edgesEnd = (api("/api/edges").edges || []).length;
  const rosterEnd = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
  check("roster 12→12, jobs 12, edges 13 (a summoning mutates nothing)",
    rosterEnd && rosterEnd.stats.total === 12 && jobsEnd === 12 && edgesEnd === 13,
    rosterEnd ? `total=${rosterEnd.stats.total} jobs=${jobsEnd} edges=${edgesEnd}` : "no roster");
  const orphans = (api("/api/jobs").jobs || []).filter((j) => !CANONICAL_IDS.has(j.id)).length;
  check("zero orphan probes", orphans === 0, `orphans=${orphans}`);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean", errs === 0, `errors=${errs}`);
} catch (e) {
  fail++;
  console.error(`\n[fatal] ${e && e.message}`);
} finally {
  try { execSync(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
  console.log(`\n[result] ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

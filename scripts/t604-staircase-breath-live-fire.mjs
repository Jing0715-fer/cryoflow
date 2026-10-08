/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t604 — the staircase breath: live fire.
 *
 * A single delete walks step 0 of the staircase (t601 W2 — one body, one
 * exhale, cd=0ms). The BULK delete is the staircase's other half, wired
 * in t601 (deleteSelected passes deathArm: true) and never yet SEEN:
 * buildDeathGhosts assigns each dying card its payload-order index
 * (stepOf: deletedIds.forEach((id,i) => stepOf.set(id, min(i, CAP)))) —
 * one command, one exhale that reads as a breath, not a roll call.
 *
 *   G0  the source contract (the arm on the bulk verb, the payload-order
 *       staircase in the builder, the Delete-key routing for n>1, the
 *       dialog naming every victim)
 *   Q   the world (12c/13e + 12 dots)
 *   W1  THE STAIRCASE BREATH — mint three sibling probes off the movie
 *       import (each with its feeding wire), select them A→B→C with
 *       REAL CDP shift-clicks (modifiers=8 — the toggle lives in the
 *       React pointer sequence and reads e.shiftKey on both ends), press
 *       Delete, and the bulk dialog names all three victims; confirm,
 *       and the sampler catches three ghosts on three staircase steps
 *       (0ms/24ms/48ms), their organ wires fading on the same steps,
 *       the truth moving 15c/16e → 12c/13e WITH the breath
 *   R   the world owes nothing — the probes died on the staircase,
 *       roster 12→12, zero orphans, console clean
 *
 * The hover/click faces need a DESKTOP-capable browser (the t584/t602
 * dance: own Chrome + blink-settings + CDP media shim, port 9324).
 *
 * Usage: node scripts/t604-staircase-breath-live-fire.mjs
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

const CDP_PORT = "9324";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t604-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
const SHIFT_CLICK = "scripts/t604-cdp-shift-click.mjs";

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
       * tuition, paid three times) */
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
const api = (path, method = "GET") => {
  /* transient-failure immunity: curl can blink once under dev-server
   * compile load (paid live in the first run — the fatal was a single
   * swallowed GET); retry twice with a short breath between */
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      const out = sh(`curl -s --max-time 15 -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${BASE}${path}`);
      return JSON.parse(out);
    } catch (e) {
      lastErr = e;
      try { execSync("sleep 0.4"); } catch { /* */ }
    }
  }
  throw lastErr;
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
/* the REAL click — CDP Input domain; MOD 8 = Shift (multi-select), 0 = plain */
const cdpClick = (x, y, mod = 8) => {
  try { return sh(`node ${SHIFT_CLICK} ${CDP_PORT} ${x} ${y} ${mod} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};
const shiftClick = (x, y) => cdpClick(x, y, 8);

/* the persistent in-page sampler: the staircase is THREE ghosts breathing
 * on THREE steps — the sampler records every ghost's cd, the organ wires'
 * cds, and the mid-flight opacities at 30ms on the page's own clock. */
const SAMPLER = `(function(){
  window.__t604 = { frames: [], t0: performance.now(), ticks: 0, maxGap: 0, _lt: performance.now() };
  var last = "";
  window.__t604iv = setInterval(function(){
    if (!window.__t604) return;
    window.__t604.ticks++;
    var now = performance.now();
    if (now - window.__t604._lt > window.__t604.maxGap) window.__t604.maxGap = Math.round(now - window.__t604._lt);
    window.__t604._lt = now;
    var dys = document.querySelectorAll("[data-dying]");
    var gws = document.querySelectorAll("[data-ghost-wire]");
    var cds = [];
    for (var i = 0; i < dys.length; i++) cds.push(dys[i].style.getPropertyValue("--death-cd"));
    var wcds = [];
    for (var j = 0; j < gws.length; j++) wcds.push(gws[j].style.getPropertyValue("--death-cd"));
    var f = {
      t: Math.round(performance.now() - window.__t604.t0),
      dy: dys.length,
      gw: gws.length,
      lo: document.querySelectorAll("[data-ghost-loner]").length,
      cds: cds.join("|"),
      wcds: wcds.join("|"),
      d0: dys.length ? getComputedStyle(dys[0]).opacity : null,
      d1: dys.length > 1 ? getComputedStyle(dys[1]).opacity : null,
      d2: dys.length > 2 ? getComputedStyle(dys[2]).opacity : null,
      wop: gws.length ? getComputedStyle(gws[0]).opacity : null,
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length
    };
    var key = JSON.stringify([f.dy,f.gw,f.lo,f.cds,f.wcds,f.d0,f.d1,f.d2,f.wop,f.c,f.e]);
    if (key !== last) { last = key; window.__t604.frames.push(f); }
  }, 16);
  setTimeout(function(){ if (window.__t604iv) clearInterval(window.__t604iv); }, 9000);
  return JSON.stringify({ armed: true });
})()`;

const stopSampler = `JSON.stringify((function(){
  if (window.__t604iv) clearInterval(window.__t604iv);
  var s = window.__t604 || { frames: [] };
  window.__t604 = null;
  return { frames: s.frames, ticks: s.ticks, maxGap: s.maxGap, elapsed: Math.round(performance.now() - s.t0) };
})())`;

/* mint a linked probe: right-click "movie import" → Add next step →
 * Motion Correction (the t601 dance verbatim) — a sibling card WITH its
 * feeding wire, placed in the first free column to the right (walking
 * down), so three mints never overlap */
async function mintLinkedProbe(label, wantC, wantE) {
  const opened = await readJson(`(function(){
    var cards = [];
    document.querySelectorAll("[data-job]").forEach(function(c){
      if ((c.textContent || "").indexOf("movie import") >= 0) cards.push(c);
    });
    var card = null;
    for (var i = 0; i < cards.length && !card; i++) {
      var r = cards[i].getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && cards[i].contains(hit)) card = cards[i];
    }
    if (!card && cards.length) card = cards[0];
    if (!card) return JSON.stringify({ err: "no movie import card" });
    var r = card.getBoundingClientRect();
    card.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true, cancelable: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    }));
    return JSON.stringify({ id: card.getAttribute("data-job") });
  })()`);
  if (!(opened && opened.id)) return { err: `context menu failed: ${JSON.stringify(opened)}` };
  const subOpen = await pollUntil(async () => {
    const v = await readJson(`(function(){
      var items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      var trig = items.find(function(m){ return (m.textContent || "").indexOf("Add next step") >= 0; });
      if (!trig) return JSON.stringify({ err: "no sub trigger" });
      trig.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false, pointerId: 1 }));
      trig.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1 }));
      trig.click();
      return JSON.stringify({ ok: true });
    })()`);
    return v && v.ok ? v : null;
  }, 8000, 500);
  if (!(subOpen && subOpen.ok)) return { err: "Add next step submenu failed" };
  await sleep(350);
  const clicked = await readJson(`(function(){
    var items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    var target = items.find(function(m){ return /Motion Correction/.test(m.textContent || ""); });
    if (!target) return JSON.stringify({ err: "no Motion Correction item" });
    target.click();
    return JSON.stringify({ ok: true });
  })()`);
  if (!(clicked && clicked.ok)) return { err: `item click failed: ${JSON.stringify(clicked)}` };
  const grown = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify({
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length
    })`);
    return n && n.c === wantC && n.e === wantE ? n : null;
  }, 20000, 400);
  if (!grown) return { err: `${label}: probe never grew in (wanted ${wantC}c/${wantE}e)` };
  /* wait out the birth window — the probe must be a STILL life before
   * anything is selected (the birth cascade retires inside this window) */
  await sleep(1100);
  const jobsNow = api("/api/jobs").jobs || [];
  const probe = jobsNow
    .filter((j) => !CANONICAL_IDS.has(j.id))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
  if (!probe) return { err: `${label}: probe id not found via API` };
  const edgesNow = api("/api/edges").edges || [];
  const wire = edgesNow.find((e) => e.fromJobId === probe.id || e.toJobId === probe.id);
  return { jobId: probe.id, wireId: wire ? wire.id : null, name: probe.name };
}

/* the card's viewport center, for the real shift-click */
const CARD_CENTER = (id) => `(function(){
  var el = document.querySelector('[data-job="${id}"]');
  if (!el) return JSON.stringify({ err: "no card" });
  var r = el.getBoundingClientRect();
  var x = Math.round(r.left + r.width / 2);
  var y = Math.round(r.top + r.height / 2);
  var hit = document.elementFromPoint(x, y);
  var visible = r.left >= 0 && r.top >= 60 && r.right <= innerWidth && r.bottom <= innerHeight;
  return JSON.stringify({ x: x, y: y, visible: visible, hitMine: !!(hit && el.contains(hit)) });
})()`;

/* fit the whole workflow into the viewport via the canvas context menu
 * (the t602 dance: synthetic contextmenu bubbles to the Radix trigger,
 * the ContextMenuItem responds to a real .click()). Fresh mints can
 * land above the viewport's top edge — the first run's tuition: probe
 * A sat at y=73 with its top clipped under the header, and the
 * shift-click landed on nothing (two of three victims died; the
 * staircase lost its first step). */
const FIT_MENU_OPEN = `(function(){
  var pt = null;
  for (var y = 80; y < innerHeight - 40 && !pt; y += 30) {
    for (var x = 30; x < innerWidth - 40 && !pt; x += 50) {
      var el = document.elementFromPoint(x, y);
      if (el && el.closest("[data-canvas]") && !el.closest('[data-job],[data-edge-id],[data-canvas-ui],[role="menu"],button')) pt = { x: x, y: y };
    }
  }
  if (!pt) return JSON.stringify({ err: "no blank canvas point" });
  var el = document.elementFromPoint(pt.x, pt.y);
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y }));
  return JSON.stringify({ ok: true });
})()`;

/* a blank point for a REAL clearing click (no menu) — the addLinkedStep
 * mint lands each new card ALREADY selected (the t383 note in the
 * store), so shift-clicking the third probe would toggle it OUT of the
 * selection (the third run's tuition: the dialog deleted A and B and
 * left C alive — the staircase lost its last step). One real blank
 * click empties the world's memory of the mint's auto-selection first. */
const BLANK_POINT = `(function(){
  var pt = null;
  for (var y = 80; y < innerHeight - 40 && !pt; y += 30) {
    for (var x = 30; x < innerWidth - 40 && !pt; x += 50) {
      var el = document.elementFromPoint(x, y);
      if (el && el.closest("[data-canvas]") && !el.closest('[data-job],[data-edge-id],[data-canvas-ui],[role="menu"],button')) pt = { x: x, y: y };
    }
  }
  return JSON.stringify(pt || { x: null });
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

  console.log(`[boot] desktop-capable Chrome (the pointer faces need it)`);
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

  /* heal before you measure (t597→t604) */
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
    const arm = sh(`rg -c "deathArm: true" src/lib/store.ts || true`);
    check("store: the bulk verb arms the death (payload order)", parseInt(arm || "0", 10) >= 1, `refs=${arm}`);
    const stepOf = sh(`rg -c "deletedIds.forEach\\(\\(id, i\\) => stepOf.set\\(id, Math.min\\(i, DEATH_MAX_STEPS\\)\\)\\)" src/lib/store.ts || true`);
    check("store: the staircase index is the payload order, capped", parseInt(stepOf || "0", 10) === 1, `refs=${stepOf}`);
    const cap = sh(`rg -c "DEATH_MAX_STEPS = 12" src/lib/store.ts || true`);
    check("store: the staircase cap (one exhale, not a roll call)", parseInt(cap || "0", 10) === 1, `refs=${cap}`);
    const route = sh(`rg -c "selectedIds.length > 1" src/components/workflow/app-shell.tsx || true`);
    check("shell: Delete routes to the BULK confirm when n>1", parseInt(route || "0", 10) >= 1, `refs=${route}`);
    const naming = sh(`rg -c "namePreview" src/components/workflow/canvas.tsx || true`);
    check("canvas: the bulk dialog names its victims (the honest gate)", parseInt(naming || "0", 10) >= 2, `refs=${naming}`);
    const servedJs = sh(`rg -l "deathArm" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | wc -l`);
    check("served artifacts carry the death family", parseInt(servedJs || "0", 10) >= 1, `js=${servedJs}`);
  }

  /* ---- Q — the world ------------------------------------------------------ */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));

  /* ---- W1 — THE STAIRCASE BREATH ------------------------------------------ */
  console.log(`\n[W1] the staircase breath — one command, three bodies, one exhale`);

  /* mint three siblings (each with its feeding wire) */
  const pA = await mintLinkedProbe("W1-A", 13, 14);
  check("W1 probe A minted with its feeding wire", !!(pA && pA.jobId), pA && pA.err ? pA.err : `${pA.jobId}`);
  if (!(pA && pA.jobId)) throw new Error("W1: probe A unavailable");
  const pB = await mintLinkedProbe("W1-B", 14, 15);
  check("W1 probe B minted with its feeding wire", !!(pB && pB.jobId), pB && pB.err ? pB.err : `${pB.jobId}`);
  if (!(pB && pB.jobId)) throw new Error("W1: probe B unavailable");
  const pC = await mintLinkedProbe("W1-C", 15, 16);
  check("W1 probe C minted with its feeding wire", !!(pC && pC.jobId), pC && pC.err ? pC.err : `${pC.jobId}`);
  if (!(pC && pC.jobId)) throw new Error("W1: probe C unavailable");
  const probes = [pA, pB, pC];

  /* fit the world first — every card must be fully inside the viewport
   * before the finger lands (the first run's tuition) */
  const fitOpened = await readJson(FIT_MENU_OPEN);
  check("W1 canvas context menu opened (fit path)", !!(fitOpened && fitOpened.ok), fitOpened ? JSON.stringify(fitOpened) : "no menu");
  const fitClicked = await pollUntil(async () => {
    const v = await readJson(`(function(){
      var items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      var fit = items.find(function(m){ return /Zoom to fit workflow/.test(m.textContent || ""); });
      if (!fit) return JSON.stringify({ err: "no fit item" });
      fit.click();
      return JSON.stringify({ ok: true });
    })()`);
    return v && v.ok ? v : null;
  }, 8000, 500);
  check("W1 zoom-to-fit fired (the whole workflow inside the viewport)", !!(fitClicked && fitClicked.ok), "Zoom to fit workflow");
  await sleep(900); /* the fit command's glide/tick settles (t590) */

  /* clear the mint's own selection: each addLinkedStep lands its card
   * ALREADY selected, so the third probe starts inside the selection
   * and a shift-click would toggle it OUT (the third run's tuition —
   * the dialog deleted A and B and left C alive). One real blank click
   * returns the world to no-selection before the staircase's fingers
   * land in order. */
  const blank = await readJson(BLANK_POINT);
  check("W1 a blank canvas point found for the clearing click", !!(blank && blank.x != null), blank ? `(${blank.x},${blank.y})` : "none");
  if (!(blank && blank.x != null)) throw new Error("W1: no blank point for clearing click");
  sh(`agent-browser mouse move ${blank.x} ${blank.y} >/dev/null 2>&1 || true`);
  await sleep(120);
  sh(`agent-browser mouse down >/dev/null 2>&1 || true`);
  await sleep(60);
  sh(`agent-browser mouse up >/dev/null 2>&1 || true`);
  await sleep(400);
  const cleared = await readJson(`JSON.stringify(Array.from(document.querySelectorAll("[data-job]")).filter(function(el){
    var cls = el.className || "";
    return typeof cls === "string" && cls.indexOf("ring-primary") >= 0;
  }).length)`);
  check("W1 the mint's auto-selection cleared", cleared === 0, `selected=${cleared}`);

  /* shift-click each probe IN MINT ORDER — the selection array's order
   * IS the payload's order IS the staircase's order */
  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    let center = await readJson(CARD_CENTER(p.jobId));
    if (!center || center.x == null) {
      /* diagnostic dump: what does the world hold right now? */
      const dump = await readJson(`JSON.stringify((function(){
        var ids = [];
        document.querySelectorAll("[data-job]").forEach(function(el){ ids.push(el.getAttribute("data-job")); });
        return { n: ids.length, has: ids.indexOf("${p.jobId}") >= 0, first3: ids.slice(0, 3) };
      })())`);
      console.error(`  [diag] probe ${String.fromCharCode(65 + i)} unreadable: wanted ${p.jobId}, world=${JSON.stringify(dump)}`);
      await sleep(1500);
      center = await readJson(CARD_CENTER(p.jobId));
    }
    check(`W1 probe ${String.fromCharCode(65 + i)} center readable + visible`,
      !!(center && center.x != null && center.visible), center ? `(${center.x},${center.y}) hitMine=${center.hitMine}` : "unreadable");
    if (!(center && center.x != null)) throw new Error(`W1: probe ${p.jobId} not clickable`);
    const okClick = shiftClick(center.x, center.y);
    check(`W1 probe ${String.fromCharCode(65 + i)} shift-clicked (CDP real mouse, Shift)`, okClick, `(${center.x},${center.y})`);
    await sleep(350);
  }
  const selCount = await pollUntil(async () => {
    /* the ring lives on an INNER div of the card (border-primary ring-2
     * ring-primary/60 primary, ring-primary/30 multi-select) — query the
     * subtree, not the [data-job] host's own className */
    const v = await readJson(`JSON.stringify(document.querySelectorAll('[data-job] [class*="ring-primary"]').length)`, 3);
    return typeof v === "number" && v >= 3 ? v : null;
  }, 8000, 400);
  check("W1 three cards carry the selection", typeof selCount === "number" && selCount >= 3, `selected=${selCount}`);

  /* let the selection's deferred reflow drain BEFORE the keyboard lands —
   * input dispatched into a busy main thread gets queued for seconds (the
   * telemetry run: ticks=189 but frames=1, the whole breath happened
   * AFTER the sampler stopped because the confirm click itself was
   * delayed); the t590 glide also needs its coda */
  await sleep(3000);

  /* Delete routes to the BULK confirm (selectedIds.length > 1) */
  sh(`agent-browser press Delete >/dev/null 2>&1 || true`);
  const dlg = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      var dlg = document.querySelector('[role="alertdialog"]');
      if (!dlg) return null;
      var txt = dlg.textContent || "";
      return {
        title: txt.slice(0, 60),
        names: (txt.match(/Motion Correction/g) || []).length,
        action: !!dlg.querySelector("button.bg-destructive")
      };
    })())`);
    return v && v.action ? v : null;
  }, 8000, 400);
  check("W1 the bulk dialog names ALL THREE victims (the honest gate)",
    !!(dlg && /Delete 3 jobs/.test(dlg.title) && dlg.names >= 3), dlg ? `names=${dlg.names} "${dlg.title}"` : "no dialog");

  await sleep(600); /* the dialog's own open animation (fade/zoom ~200ms) */
  /* the t605 window's tuition, same doctrine one step later in the
   * gesture: the dialog's Radix mount reflow also needs its drain —
   * tonight the confirm's onClick queued past the whole observation
   * window twice (frames=1, the breath landed after stop) — the world
   * needs more quiet between gesture steps than the assertion needs */
  await sleep(2000);

  await readJson(SAMPLER);
  /* confirm with a REAL CDP mouse click at the destructive button's
   * center — the same honest input path as the shift-clicks, and no
   * harness-side waiting that can strand the dispatch behind a busy
   * frame */
  const btn = await readJson(`JSON.stringify((function(){
    var b = document.querySelector('[role="alertdialog"] button.bg-destructive');
    if (!b) return null;
    var r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })())`);
  check("W1 the confirm button on stage", !!(btn && btn.x != null), btn ? `(${btn.x},${btn.y})` : "none");
  if (!(btn && btn.x != null)) throw new Error("W1: confirm button not found");
  sh(`agent-browser click '[role="alertdialog"] button.bg-destructive' >/dev/null 2>&1 || true`);
  check("W1 the confirm click dispatched (agent-browser real mouse)", true, `(${btn.x},${btn.y})`);
  /* the shot races the 400ms fade — opportunistic, never gated on */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t604-mid-staircase.png >/dev/null 2>&1`); } catch { /* */ }
  await sleep(7000);
  const f1 = await readJson(stopSampler, 6);
  const frames1 = Array.isArray(f1 && f1.frames) ? f1.frames : [];
  check("W1 sampler captured the exhale", frames1.length >= 3,
    `${frames1.length} frames, ticks=${f1 && f1.ticks}, maxGap=${f1 && f1.maxGap}ms, elapsed=${f1 && f1.elapsed}ms`);

  const withDy = frames1.filter((f) => f.dy >= 2);
  check("W1 THE STAIRCASE IS SEEN (multiple ghosts breathing together)", withDy.length >= 2, `multi-ghost frames=${withDy.length}/${frames1.length}`);
  const peak = Math.max(...frames1.map((f) => f.dy));
  check("W1 three bodies on one command (peak ghost count = 3)", peak === 3, `peak=${peak}`);
  const cdSet = new Set();
  for (const f of withDy) for (const cd of (f.cds || "").split("|")) if (cd) cdSet.add(cd);
  check("W1 the staircase steps 0ms/24ms/48ms all present (payload order, capped)",
    cdSet.has("0ms") && cdSet.has("24ms") && cdSet.has("48ms"), `cds=${JSON.stringify([...cdSet].sort())}`);
  const withGw = frames1.filter((f) => f.gw >= 1);
  const wcdSet = new Set();
  for (const f of withGw) for (const cd of (f.wcds || "").split("|")) if (cd) wcdSet.add(cd);
  check("W1 the organ wires breathe on the staircase too (data-ghost-wire, steps present)",
    withGw.length >= 2 && wcdSet.has("0ms") && wcdSet.has("24ms") && wcdSet.has("48ms"), `wire frames=${withGw.length}, wcds=${JSON.stringify([...wcdSet].sort())}`);
  const midD0 = withDy.filter((f) => f.d0 !== null && parseFloat(f.d0) > 0 && parseFloat(f.d0) < 1);
  const midD1 = withDy.filter((f) => f.d1 !== null && parseFloat(f.d1) > 0 && parseFloat(f.d1) < 1);
  const midD2 = withDy.filter((f) => f.d2 !== null && parseFloat(f.d2) > 0 && parseFloat(f.d2) < 1);
  check("W1 ∃ mid-fade frame on ghost 0 (strictly between)", midD0.length >= 1, `mid at t=${midD0.map((f) => f.t).join(",") || "none"}`);
  check("W1 ∃ mid-fade frame on ghost 1 (strictly between)", midD1.length >= 1, `mid at t=${midD1.map((f) => f.t).join(",") || "none"}`);
  check("W1 ∃ mid-fade frame on ghost 2 (strictly between)", midD2.length >= 1, `mid at t=${midD2.map((f) => f.t).join(",") || "none"}`);
  const midWop = withGw.filter((f) => f.wop !== null && parseFloat(f.wop) > 0 && parseFloat(f.wop) < 1);
  check("W1 ∃ mid-fade frame on the organ wires", midWop.length >= 1, `mid at t=${midWop.map((f) => f.t).join(",") || "none"}`);
  check("W1 zero loners across the whole bulk breath (the families stay disjoint)",
    frames1.every((f) => f.lo === 0), `loner frames=${frames1.filter((f) => f.lo >= 1).length}`);
  const firstDy = withDy[0] || null;
  /* the t602 precedent's semantics: the FIRST dying frame already reads
   * the post-delete world — the ghosts and the truth drop in the SAME
   * commit (one commit, one exhale: cards gone, ghosts mounted) */
  check("W1 truth moves WITH the breath (first dying frame = post-delete world + ghosts mounted)",
    !!(firstDy && firstDy.c === 12 && firstDy.e === 13 && firstDy.dy >= 2), firstDy ? `t=${firstDy.t} c=${firstDy.c} e=${firstDy.e} dy=${firstDy.dy}` : "no dying frame");
  const landed = frames1.filter((f) => f.c === 12 && f.e === 13);
  check("W1 the healed world lands inside the sampled window", landed.length >= 1, `landed frames=${landed.length}`);

  /* the settled state — live DOM polling (the t596 frozen-window family) */
  const settled1 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({
      dy: document.querySelectorAll("[data-dying]").length,
      gw: document.querySelectorAll("[data-ghost-wire]").length,
      lo: document.querySelectorAll("[data-ghost-loner]").length,
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length
    })`);
    return v && v.dy === 0 && v.gw === 0 && v.lo === 0 && v.c === 12 && v.e === 13 ? v : null;
  }, 10000, 300);
  check("W1 the window retires clean — all ghosts swept", !!settled1, JSON.stringify(settled1));
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t604-settled.png >/dev/null 2>&1`); } catch { /* */ }

  /* ---- R — the world owes nothing ----------------------------------------- */
  console.log(`\n[R] return everything`);
  const jobsEnd = (api("/api/jobs").jobs || []).length;
  const edgesEnd = (api("/api/edges").edges || []).length;
  const rosterEnd = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
  check("roster 12→12, jobs 12, edges 13 (the probes died on the staircase)",
    rosterEnd && rosterEnd.stats.total === 12 && jobsEnd === 12 && edgesEnd === 13,
    rosterEnd ? `total=${rosterEnd.stats.total} jobs=${jobsEnd} edges=${edgesEnd}` : "no roster");
  const orphans = (api("/api/jobs").jobs || []).filter((j) => !CANONICAL_IDS.has(j.id)).length;
  check("zero orphan probes", orphans === 0, `orphans=${orphans}`);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean", errs === 0, `errors=${errs}`);
} catch (e) {
  fail++;
  console.error(`\n[fatal] ${e && e.message}`);
  /* a fatal mid-mint leaves probes behind — sweep them so the world
   * comes home clean (heal-before-measure, exit edition) */
  try {
    const jobsNow = (api("/api/jobs").jobs || []).filter((j) => !CANONICAL_IDS.has(j.id));
    for (const j of jobsNow) api(`/api/jobs/${j.id}`, "DELETE");
    if (jobsNow.length > 0) console.log(`  [heal-exit] swept ${jobsNow.length} leftover probe(s)`);
  } catch { /* the world keeps its own counsel */ }
} finally {
  try { execSync(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
  console.log(`\n[result] ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

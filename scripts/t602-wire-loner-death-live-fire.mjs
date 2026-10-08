/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t602 — THE LONER'S BREATH: the wire killed ALONE earns its own death
 * voice.
 *
 * t601 gave the card's delete a breath; its wires faded as ORGANS of the
 * body. But a wire can die alone — the hover X on the wire itself (the
 * canvas's most direct finger) and the I/O tab's remove chip (the named
 * chip's X) both called removeEdge, and the wire popped out of existence
 * with no figure. Now removeEdge freezes the geometry and arms a loner
 * ghost in the SAME commit (the t600 same-commit law, death edition);
 * the canvas renders it in the t601 ghost layer's svg, marked
 * data-ghost-loner, breathing the organ's own air (ghost-wire-exit) —
 * a lone wire has no gravity to sink with, it only fades, no staircase
 * (each click is its own command).
 *
 * Faces:
 *   G0  source contract (the freeze-before-arm, the same-commit set, the
 *       loner marker) + served freshness (js chunks + css stanza)
 *   Q   the world (12c/13e, roster0 captured after heal)
 *   W1  THE LONER'S BREATH — a linked probe is minted, its feeding wire
 *       is hovered (the X mounts at the path midpoint), the X is REALLY
 *       clicked: the wire dies, the loner breathes (data-ghost-loner,
 *       ∃ mid-fade frames, d === the living wire's own d — frozen from
 *       the living world), truth moves WITH the breath (edges drop the
 *       same commit, the body SURVIVES), retire sweeps, 13c/12e
 *   W3  THE NAMED CHIP — the second gesture family (the I/O tab's
 *       Remove-connection chip, its aria-label naming the feeder — the
 *       honest gate) reaches the same verb: the same loner breath from
 *       the panel's hand
 *   W2  ORGAN SUPREMACY — a probe CARD is deleted through the real
 *       dialog: its wire breathes as an ORGAN (data-ghost-wire, ∃
 *       mid-fade) and ZERO loners exist — the two ghost families are
 *       disjoint by construction (whichever verb removes the edge first
 *       is the only one that ever saw it)
 *   R   the world owes nothing — probe cards deleted, roster 12→12,
 *       edges 13, console clean, 📸
 *
 * Usage: node scripts/t602-wire-loner-death-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
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

/* the hover faces need a DESKTOP-capable browser: the wire's hit corridor
 * is mouse-ONLY by design (Task 176 — the 16px corridor stole touch taps),
 * so under (hover: none) it is DEAD and the hover X never mounts. The
 * t584 dance: own Chrome with the blink-settings shim + the CDP media
 * shim, agent-browser attached through port 9324 (9323 is t578's —
 * zombie ports get, zombies hold). */
const CDP_PORT = "9324";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t602-harness-chrome-profile";
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
      /* bare scalar strings are truthy — coerce the leaves or every
       * `=== 12` / `=== true` gate reads the STRING and never passes
       * (the t598 tuition, paid three times) */
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
 * records the whole breath at 30ms on the page's own clock. The loner's
 * frozen d is parked OUTSIDE the dedupe key (it never changes; the key
 * would bloat) — stopSampler hands it back alongside the frames. */
const SAMPLER = `(function(){
  window.__t602 = { frames: [], t0: performance.now(), d: null };
  var last = "";
  window.__t602iv = setInterval(function(){
    if (!window.__t602) return;
    var dy = document.querySelector("[data-dying]");
    var lo = document.querySelector("[data-ghost-loner]");
    var gw = document.querySelector("[data-ghost-wire]");
    var layer = document.querySelector("[data-death-ghost-layer]");
    if (lo && lo.getAttribute("d")) window.__t602.d = lo.getAttribute("d");
    var f = {
      t: Math.round(performance.now() - window.__t602.t0),
      dy: document.querySelectorAll("[data-dying]").length,
      lo: document.querySelectorAll("[data-ghost-loner]").length,
      gw: document.querySelectorAll("[data-ghost-wire]").length,
      layer: layer ? 1 : 0,
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length,
      dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length,
      lop: lo ? getComputedStyle(lo).opacity : null,
      wop: gw ? getComputedStyle(gw).opacity : null,
      dop: dy ? getComputedStyle(dy).opacity : null,
      cd: dy ? dy.style.getPropertyValue("--death-cd") : null,
      seatL: dy ? dy.style.left : null,
      seatT: dy ? dy.style.top : null
    };
    var key = JSON.stringify([f.dy,f.lo,f.gw,f.layer,f.c,f.e,f.dots,f.lop,f.wop,f.dop,f.cd,f.seatL,f.seatT]);
    if (key !== last) { last = key; window.__t602.frames.push(f); }
  }, 30);
  setTimeout(function(){ if (window.__t602iv) clearInterval(window.__t602iv); }, 8000);
  return JSON.stringify({ armed: true });
})()`;

const stopSampler = `JSON.stringify((function(){
  if (window.__t602iv) clearInterval(window.__t602iv);
  var s = window.__t602 || { frames: [], d: null };
  window.__t602 = null;
  return { frames: s.frames, d: s.d };
})())`;

/* mint a linked probe: right-click "movie import" → Add next step →
 * Motion Correction (the t601 dance verbatim) — a card WITH its feeding
 * wire, so a wire can die alone while the body lives on */
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
  /* wait out the birth window (the probe must be a STILL life before
   * anything dies — the death breath is its own event, not the birth's
   * tail: the card cascade AND the wire's draw-in both retire inside
   * this window) */
  await sleep(1100);
  /* ids via the API (the API is read from OUTSIDE the tab and cannot
   * die with it — the t601 law). The probe is the newest job outside
   * the canonical world; its feeding wire is the one edge touching it. */
  const jobsNow = api("/api/jobs").jobs || [];
  const probe = jobsNow
    .filter((j) => !CANONICAL_IDS.has(j.id))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
  if (!probe) return { err: `${label}: no probe in the API roster` };
  const edgesNow = api("/api/edges").edges || [];
  const wire = edgesNow.find((e) => e.fromJobId === probe.id || e.toJobId === probe.id);
  if (!wire) return { err: `${label}: probe has no feeding wire` };
  return {
    jobId: probe.id,
    wireId: wire.id,
    feederId: wire.fromJobId === probe.id ? wire.toJobId : wire.fromJobId,
    seatL: `${probe.x}px`,
    seatT: `${probe.y}px`,
  };
}

try {
  /* world guard BEFORE any browser spend (the t584 discipline): refuse
   * to run the death dance in a borrowed world */
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

  /* heal before you measure (t597→t601): sweep this family's leftover
   * probes BEFORE the census gates anything */
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
  const baselineJobIds = (api("/api/jobs").jobs || []).map((j) => j.id);
  const baselineEdges = (api("/api/edges").edges || []).map((e) => `${e.fromJobId.slice(0, 8)}|${e.toJobId.slice(0, 8)}`);

  /* ---- G0 — the source contract + the SERVED freshness gate --------------- */
  console.log(`\n[G0] source contract + served freshness`);
  {
    const ty = sh(`rg -c "interface DeathEdgeGhost" src/lib/store.ts || true`);
    check("store: the loner type exists", parseInt(ty || "0", 10) === 1, `refs=${ty}`);
    const arm = sh(`rg -c "computeEdgeGeoms\\(get\\(\\)\\.edges, get\\(\\)\\.jobs, null\\)" src/lib/store.ts || true`);
    check("store: the freeze happens BEFORE the arm, from the FULL living list (fan-true memory)", parseInt(arm || "0", 10) === 1, `refs=${arm}`);
    const organFull = sh(`rg -c "computeEdgeGeoms\\(edges, jobs, null\\)" src/lib/store.ts || true`);
    check("store: the organ builder freezes from the full list too (the t601 fix shared)", parseInt(organFull || "0", 10) === 1, `refs=${organFull}`);
    const sameCommit = sh(`rg -c "deathEdgeSeq: get\\(\\).deathEdgeSeq \\+ 1" src/lib/store.ts || true`);
    check("store: the arm rides the SAME set() as the removal", parseInt(sameCommit || "0", 10) === 1, `refs=${sameCommit}`);
    const verbs = sh(`rg -c "pruneDeathEdgeGhosts|retireDeathEdgeGhosts" src/lib/store.ts || true`);
    check("store: revival-prune + wholesale-retire verbs", parseInt(verbs || "0", 10) >= 4, `refs=${verbs}`);
    const restore = sh(`rg -c "death was revoked" src/lib/store.ts || true`);
    check("store: the failed-DELETE restore prunes the loner", parseInt(restore || "0", 10) >= 1, `refs=${restore}`);
    const loner = sh(`rg -c "data-ghost-loner" src/components/workflow/canvas.tsx || true`);
    check("canvas: the loner carries its DOM contract marker (element + layer comment)", parseInt(loner || "0", 10) === 2, `refs=${loner}`);
    const breathe = sh(`rg -c "breathingEdgeGhosts" src/components/workflow/canvas.tsx || true`);
    check("canvas: the render face + the layer condition read the loners", parseInt(breathe || "0", 10) >= 3, `refs=${breathe}`);
    const air = sh(`rg -c "ghost-wire-exit" src/app/globals.css || true`);
    check("css: the loner rides the organ's air (shared stanza, no new key)", parseInt(air || "0", 10) === 2, `refs=${air}`);
    const servedJs = sh(`rg -l "pruneDeathEdgeGhosts" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | wc -l`);
    const servedCanvas = sh(`rg -l "data-ghost-loner" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | rg canvas | wc -l`);
    const servedCss = sh(`rg -l "ghost-wire-exit" .next/dev/ 2>/dev/null | wc -l`);
    check("served artifacts carry ALL t602 signatures", parseInt(servedJs || "0", 10) >= 1 && parseInt(servedCanvas || "0", 10) >= 1 && parseInt(servedCss || "0", 10) >= 1, `js=${servedJs} canvas=${servedCanvas} css=${servedCss}`);
  }

  /* ---- Q — the world ------------------------------------------------------ */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));

  /* ---- W1 — THE LONER'S BREATH (the X on the wire itself) ------------------ */
  console.log(`\n[W1] the loner's breath — the hover X on the wire itself`);
  const p1 = await mintLinkedProbe("W1", 13, 14);
  check("W1 probe minted with its feeding wire", !!(p1 && p1.jobId), p1 && p1.err ? p1.err : `${p1.jobId} + wire ${p1.wireId}`);
  if (!(p1 && p1.jobId)) throw new Error("W1 probe unavailable");

  /* the living wire's own d — the memory must freeze exactly this */
  const liveD = await readJson(`JSON.stringify((function(){
    var el = document.querySelector('[data-edge-id="${p1.wireId}"] [data-e-main]');
    return el ? el.getAttribute("d") : null;
  })())`);
  check("W1 the living wire's geometry read", typeof liveD === "string" && liveD.length > 10, `${typeof liveD === "string" ? liveD.length + " chars" : "unreadable"}`);

  /* hover the hit corridor (the first path of the edge group) — the X
   * mounts at the path midpoint; REAL hover, the affordance is a React
   * hovered state, not a CSS :hover */
  const hovered = await pollUntil(async () => {
    try {
      sh(`agent-browser hover '[data-edge-id="${p1.wireId}"] path' >/dev/null 2>&1`);
    } catch { /* retry on the next tick */ }
    const v = await readJson(`JSON.stringify(!!document.querySelector('[data-canvas-ui="edge-delete"]'))`);
    return v === true ? v : null;
  }, 12000, 600);
  check("W1 the hover X mounted at the midpoint", hovered === true, "data-canvas-ui=edge-delete present");

  await readJson(SAMPLER);
  sh(`agent-browser click '[data-canvas-ui="edge-delete"]' >/dev/null 2>&1 || true`);
  /* the shot races the 400ms fade — opportunistic, never gated on */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t602-mid-breath.png >/dev/null 2>&1`); } catch { /* */ }
  await sleep(2500);
  const f1 = await readJson(stopSampler, 6);
  const frames1 = Array.isArray(f1 && f1.frames) ? f1.frames : [];
  check("W1 sampler captured the breath", frames1.length >= 3, `${frames1.length} frames`);
  const lo1 = frames1.filter((f) => f.lo >= 1);
  check("W1 THE LONER IS SEEN (the core)", lo1.length >= 2, `loner frames=${lo1.length}/${frames1.length}`);
  const midLo = lo1.filter((f) => f.lop !== null && parseFloat(f.lop) > 0 && parseFloat(f.lop) < 1);
  check("W1 ∃ mid-fade frame (strictly between)", midLo.length >= 1, `mid at t=${midLo.map((f) => f.t).join(",") || "none"}`);
  check("W1 the memory freezes the LIVING geometry (d === the wire's own d)", f1 && f1.d === liveD, f1 && f1.d ? `${(f1.d || "").length} chars vs ${String(liveD || "").length}` : "no d captured");
  const firstLo = lo1[0] || null;
  check("W1 truth moves WITH the breath (edges drop, the body SURVIVES)", !!(firstLo && firstLo.e === 13 && firstLo.c === 13), firstLo ? `t=${firstLo.t} c=${firstLo.c} e=${firstLo.e}` : "no loner frame");
  check("W1 no staircase — each click is its own command (layer mounts, cd n/a)", lo1.every((f) => f.c === 13), "cards stay 13 across the whole breath");
  const edgesApi1 = api("/api/edges").edges || [];
  check("W1 the API agrees (the wire row is gone)", edgesApi1.length === 13 && !edgesApi1.some((e) => e.id === p1.wireId), `api edges=${edgesApi1.length}`);
  /* the settled state is read from the LIVE DOM with a poll — the
   * sampler's frame log can freeze mid-breath (the t596 frozen-window
   * family); the retiring layer is a truth question, not a sampling one */
  const settled1 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({
      lo: document.querySelectorAll("[data-ghost-loner]").length,
      gw: document.querySelectorAll("[data-ghost-wire]").length,
      layer: !!document.querySelector("[data-death-ghost-layer]"),
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length
    })`);
    return v && v.lo === 0 && v.gw === 0 && v.layer === false && v.c === 13 && v.e === 13 ? v : null;
  }, 8000, 300);
  check("W1 the window retires — layer swept, world 13c/13e", !!settled1, JSON.stringify(settled1));
  const roster1 = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
  const jobs1 = (api("/api/jobs").jobs || []).length;
  check("W1 the wire's death never touched the JOBS (roster = 12 canonical + the living probe card)", roster1 && roster1.stats.total === 13 && jobs1 === 13, roster1 ? `total=${roster1.stats.total} jobs=${jobs1}` : "no roster");

  /* ---- W3 — THE NAMED CHIP (the panel's hand) ------------------------------ */
  console.log(`\n[W3] the named chip — the I/O tab's remove reaches the same verb`);
  const p3 = await mintLinkedProbe("W3", 14, 14);
  check("W3 probe minted with its feeding wire", !!(p3 && p3.jobId), p3 && p3.err ? p3.err : `${p3.jobId} + wire ${p3.wireId}`);
  if (!(p3 && p3.jobId)) throw new Error("W3 probe unavailable");

  /* select the idle probe — the panel opens (idle → onSelect, the t600
   * semantics: completed cards go to the Inspector, idle to the panel) */
  sh(`agent-browser click '[data-job="${p3.jobId}"]' >/dev/null 2>&1 || true`);
  await sleep(600);
  /* the I/O tab: a persisted tab memory could open params — click the
   * trigger whose text names I/O, then wait for the chip */
  const ioReady = await pollUntil(async () => {
    const v = await readJson(`(function(){
      var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
      var io = tabs.find(function(t){ return (t.textContent || "").indexOf("I/O") >= 0; });
      if (io && io.getAttribute("data-state") !== "active") io.click();
      var chips = Array.prototype.slice.call(document.querySelectorAll('button[aria-label^="Remove connection"]'));
      return chips.length > 0 ? { n: chips.length, label: chips[0].getAttribute("aria-label") } : null;
    })()`);
    return v && v.n > 0 ? v : null;
  }, 12000, 600);
  check("W3 the panel shows the named chip (the honest gate — it names the feeder)", !!(ioReady && ioReady.n >= 1), ioReady ? `${ioReady.n} chip(s): "${ioReady.label}"` : "no chip");

  await readJson(SAMPLER);
  sh(`agent-browser click 'button[aria-label^="Remove connection"]' >/dev/null 2>&1 || true`);
  await sleep(2500);
  const f3 = await readJson(stopSampler, 6);
  const frames3 = Array.isArray(f3 && f3.frames) ? f3.frames : [];
  const lo3 = frames3.filter((f) => f.lo >= 1);
  check("W3 THE SAME LONER BREATH from the chip's hand", lo3.length >= 2, `loner frames=${lo3.length}/${frames3.length}`);
  const midLo3 = lo3.filter((f) => f.lop !== null && parseFloat(f.lop) > 0 && parseFloat(f.lop) < 1);
  check("W3 ∃ mid-fade frame (strictly between)", midLo3.length >= 1, `mid at t=${midLo3.map((f) => f.t).join(",") || "none"}`);
  const firstLo3 = lo3[0] || null;
  check("W3 truth moves WITH the breath (edges drop, the body SURVIVES)", !!(firstLo3 && firstLo3.e === 13 && firstLo3.c === 14), firstLo3 ? `t=${firstLo3.t} c=${firstLo3.c} e=${firstLo3.e}` : "no loner frame");
  const edgesApi3 = api("/api/edges").edges || [];
  check("W3 the API agrees (the wire row is gone)", edgesApi3.length === 13 && !edgesApi3.some((e) => e.id === p3.wireId), `api edges=${edgesApi3.length}`);
  const settled3 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({
      lo: document.querySelectorAll("[data-ghost-loner]").length,
      gw: document.querySelectorAll("[data-ghost-wire]").length,
      layer: !!document.querySelector("[data-death-ghost-layer]"),
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length
    })`);
    return v && v.lo === 0 && v.gw === 0 && v.layer === false && v.c === 14 && v.e === 13 ? v : null;
  }, 8000, 300);
  check("W3 the window retires — world 14c/13e", !!settled3, JSON.stringify(settled3));

  /* ---- W2 — ORGAN SUPREMACY (the boundary between the two families) -------- */
  console.log(`\n[W2] organ supremacy — a card's wire breathes as an organ, never a loner`);
  const p2 = await mintLinkedProbe("W2", 15, 14);
  check("W2 probe minted with its feeding wire", !!(p2 && p2.jobId), p2 && p2.err ? p2.err : `${p2.jobId} + wire ${p2.wireId}`);
  if (!(p2 && p2.jobId)) throw new Error("W2 probe unavailable");

  sh(`agent-browser click '[data-job="${p2.jobId}"]' >/dev/null 2>&1 || true`);
  await sleep(350);
  sh(`agent-browser press Delete >/dev/null 2>&1 || true`);
  const dlg2 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      var dlg = document.querySelector('[role="alertdialog"]');
      if (!dlg) return null;
      return { title: (dlg.textContent || "").slice(0, 90) };
    })())`);
    return v && v.title ? v : null;
  }, 8000, 400);
  check("W2 the dialog names its victim (the honest gate)", !!(dlg2 && /Delete Motion Correction/.test(dlg2.title)), dlg2 ? dlg2.title : "no dialog");

  await readJson(SAMPLER);
  sh(`agent-browser click '[role="alertdialog"] button.bg-destructive' >/dev/null 2>&1 || true`);
  await sleep(2500);
  const f2 = await readJson(stopSampler, 6);
  const frames2 = Array.isArray(f2 && f2.frames) ? f2.frames : [];
  const dy2 = frames2.filter((f) => f.dy >= 1);
  check("W2 THE CARD BREATHES (the t601 voice still holds)", dy2.length >= 2, `dying frames=${dy2.length}/${frames2.length}`);
  const gw2 = frames2.filter((f) => f.gw >= 1);
  const midGw = gw2.filter((f) => f.wop !== null && parseFloat(f.wop) > 0 && parseFloat(f.wop) < 1);
  check("W2 THE WIRE FADES AS AN ORGAN (∃ mid-fade)", gw2.length >= 2 && midGw.length >= 1, `wire frames=${gw2.length}, mid at t=${midGw.map((f) => f.t).join(",") || "none"}`);
  check("W2 ORGAN SUPREMACY — zero loners across the whole body's breath (the families are disjoint by construction)", gw2.every((f) => f.lo === 0) && frames2.every((f) => f.lo === 0), `loner frames=${frames2.filter((f) => f.lo >= 1).length}`);
  const firstDy2 = dy2[0] || null;
  check("W2 truth moves WITH the breath (card AND its wire drop together)", !!(firstDy2 && firstDy2.c === 14 && firstDy2.e === 13), firstDy2 ? `t=${firstDy2.t} c=${firstDy2.c} e=${firstDy2.e}` : "no dying frame");
  const cd2 = Array.from(new Set(dy2.map((f) => f.cd).filter(Boolean)));
  check("W2 single delete walks step 0 of the staircase", cd2.length === 1 && cd2[0] === "0ms", `cds=${JSON.stringify(cd2)}`);
  const settled2 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({
      dy: document.querySelectorAll("[data-dying]").length,
      gw: document.querySelectorAll("[data-ghost-wire]").length,
      lo: document.querySelectorAll("[data-ghost-loner]").length,
      layer: !!document.querySelector("[data-death-ghost-layer]"),
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length
    })`);
    return v && v.dy === 0 && v.gw === 0 && v.lo === 0 && v.layer === false && v.c === 14 && v.e === 13 ? v : null;
  }, 8000, 300);
  check("W2 the window retires — world 14c/13e", !!settled2, JSON.stringify(settled2));

  /* ---- R — the net contract -------------------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  {
    /* the three killed wires were all MINTED this window (strangers) —
     * the canonical 13 were never touched: W1/W3's fingers killed the
     * probes' own feeding wires, W2's wire died with its body */
    const jobsNow = api("/api/jobs").jobs || [];
    const newJobs = jobsNow.filter((j) => baselineJobIds.indexOf(j.id) < 0);
    for (const j of newJobs) api(`/api/jobs/${j.id}`, "DELETE");
    await sleep(800);
    const edgesNow = api("/api/edges").edges || [];
    const pairKey = (e) => `${e.fromJobId.slice(0, 8)}|${e.toJobId.slice(0, 8)}`;
    const strangers = edgesNow.filter((e) => baselineEdges.indexOf(pairKey(e)) < 0);
    for (const s of strangers) api(`/api/edges/${s.id}`, "DELETE");
    await sleep(800);
    const roster = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
    check("roster 12→12 (the probes were borrowed, not kept)", roster && roster.stats.total === 12, `swept ${newJobs.length} card(s) + ${strangers.length} wire(s); 12 → ${roster ? roster.stats.total : "?"}`);
    const finalCount = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify({ c: document.querySelectorAll("[data-job]").length, e: document.querySelectorAll("[data-edge-id]").length })`);
      return n && n.c === 12 && n.e === 13 ? n : null;
    }, 20000, 500);
    check("canvas back to the 12c/13e world", !!finalCount, JSON.stringify(finalCount));
    let errs = "";
    try { errs = sh(`agent-browser errors 2>/dev/null`).trim(); } catch { /* */ }
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  }

  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t602-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled world screenshot", true, ".qa-logs/shots/t602-settled.png");

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
}
process.exit(fail === 0 ? 0 : 1);

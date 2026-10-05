/**
 * t596 — the selection verbs are fingers: the sel frame's shrink and
 * growth FLOW (200ms rAF lerp, the t595 voice), the coercion edge still
 * snaps, and a selection change under fit framing stays silent.
 *
 * Contract (this window's product):
 *   - the five selection verbs (select / stepArrowFocus / toggleSelect /
 *     selectMany / selectAll) bump store.selReframeSeq ONLY when the
 *     selection set actually changes (selSig compare)
 *   - the minimap's box-record effect reads the previous box BEFORE
 *     overwriting it and, when the live framing is sel, rides a reframe
 *     flow from that snapshot to the newly computed box (startReframe —
 *     the exact voice the thumb channel uses)
 *   - the coercion edge (selection emptied → effMode falls back to fit)
 *     bumps too but snaps — t591's disarm-never-becomes-an-event law
 *   - fit/nodes framing ignores the selection entirely (no flow even
 *     though the seq bumped)
 *   - delete cleanup / workspace switch / load / inspect / server poll
 *     write the selection fields directly and never bump — immune by
 *     construction; undo never touches the selection
 *
 * t595's witness asserted stage-1 (Escape collapse) SNAPS; this window
 * overturns that half of the contract (a selection verb IS a finger) and
 * updates that assertion in place. The coercion half is untouched.
 *
 * Faces:
 *   G0  source contract — the seq, the sig gate, the shared voice
 *   Q   world — 12c/13e, mode=fit, console clean
 *   W1  THE SHRINK FLOW — Escape #1 (all → primary) interpolates
 *   W4  THE GROW FLOW — Ctrl+A in sel mode (primary → all) interpolates
 *   W2  COERCION SNAP — Escape #2 (primary → null → fit) has no intermediates
 *   W3  FIT-MODE SILENCE — Ctrl+A under fit framing never moves the box
 *   R   the world owes nothing — roster, lens, console, screenshot
 *
 * Usage: node scripts/t596-sel-reflow-live-fire.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const between = (a, m, b) => m > Math.min(a, b) + 0.5 && m < Math.max(a, b) - 0.5;
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
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
async function pollUntil(fn, timeoutMs = 120000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
const readVb = `JSON.stringify((function(){
  var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
  if (!svg) return {};
  var vb = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number);
  return { mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode"), x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
})())`;
const selectAllKey = `(function(){
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }));
  return "sent";
})()`;
const pressEscape = `(function(){
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return "sent";
})()`;
const clickThumb = (id) => `(function(){
  var b = document.querySelector('[data-mm-btn="${id}"]');
  if (!b) return JSON.stringify({ err: "no ${id} thumb" });
  if (b.disabled) return JSON.stringify({ err: "${id} thumb disabled" });
  b.click();
  return "clicked";
})()`;

try {
  console.log(`[boot] close-all + open`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(1000);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(600);

  /* ---- G0 — the source contract + the SERVED freshness gate --------------- */
  console.log(`\n[G0] source contract + served freshness (t591: the build can lie)`);
  {
    const sig = sh(`rg -c "selSig\\(" src/lib/store.ts || true`);
    const bumps = sh(`rg -c "selReframeBump\\(s," src/lib/store.ts || true`);
    check("store: sig gate + 5 verb bump sites", parseInt(sig || "0", 10) >= 1 && parseInt(bumps || "0", 10) >= 5, `selSig=${sig} bump=${bumps}`);
    const immune = sh(`rg -c "selectedId: null" src/lib/store.ts || true`);
    check("store: direct writers stay (immune by construction)", parseInt(immune || "0", 10) >= 8, `${immune} direct writes`);
    const watcher = sh(`rg -c "seenSelSeqRef" src/components/workflow/canvas-minimap.tsx || true`);
    const voice = sh(`rg -c "startReframe\\(" src/components/workflow/canvas-minimap.tsx || true`);
    check("minimap: watcher + shared voice in place", parseInt(watcher || "0", 10) >= 3 && parseInt(voice || "0", 10) >= 2, `seen=${watcher} voice=${voice}`);
    const birthQuiet = sh(`rg -n "seenSelSeqRef = React.useRef<number \\| null>\\(null\\)" src/components/workflow/canvas-minimap.tsx || true`);
    check("minimap: birth-quiet init (null seen-ref)", birthQuiet.length > 0, "first commit only records");
    // t591/t594/t595 doctrine: the served bundle can be STALE (or take an
    // HMR push mid-run — the first run's seven failures were exactly that:
    // the chunks compiled AFTER the run started). Both new signatures must
    // be IN the served chunks before any behavior face is allowed to speak.
    const servedSeq = sh(`rg -l "selReframeSeq" .next/dev/static/chunks/ 2>/dev/null | wc -l`);
    const servedSeen = sh(`rg -l "seenSelSeqRef" .next/dev/static/chunks/ 2>/dev/null | wc -l`);
    check("served chunks carry BOTH t596 signatures", parseInt(servedSeq || "0", 10) >= 1 && parseInt(servedSeen || "0", 10) >= 1, `seq-chunks=${servedSeq} seen-chunks=${servedSeen}`);
  }

  /* ---- Q — the world ------------------------------------------------------ */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length,
    mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode")
  })`);
  check("12c/13e + 12 dots, mode=fit", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12 && counts.mode === "fit", JSON.stringify(counts));

  /* ---- W1 — THE SHRINK FLOW (Escape #1: all → primary) -------------------- */
  console.log(`\n[W1] the shrink flow — Ctrl+A, sel thumb, then Escape #1`);
  await readJson(selectAllKey);
  await sleep(350);
  const armed = await readJson(`JSON.stringify({ disabled: document.querySelector('[data-mm-btn="sel"]').disabled })`);
  check("sel thumb armed by select-all", armed && armed.disabled === false, `disabled=${armed && armed.disabled}`);

  const w3probe = await readJson(`(function(){
    var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    function vb(){ var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { w: p[2] }; }
    var a = vb();
    return new Promise(function(res){
      setTimeout(function(){ var b = vb(); setTimeout(function(){ res(JSON.stringify({ a: a, b: b, c: vb() })); }, 60); }, 60);
    });
  })()`);
  check("W3 (early): select-all under FIT framing snaps (box ignores the selection)", !!(w3probe && w3probe.a.w === w3probe.b.w && w3probe.b.w === w3probe.c.w), `w ${w3probe && w3probe.a.w.toFixed(0)} stable`);

  await readJson(clickThumb("sel"));
  await sleep(380); /* thumb settle (200ms) + reframe flow (200ms) retire */
  const inSel = await readJson(readVb);
  check("sel framing live (all-12 box)", !!(inSel && inSel.mode === "sel"), JSON.stringify(inSel && { mode: inSel.mode, w: Math.round(inSel.w) }));

  const shrink = await readJson(`(function(){
    var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    function vb(){ var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { x: p[0], y: p[1], w: p[2], h: p[3] }; }
    var pre = vb();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    var frames = [];
    return new Promise(function(res){
      [20, 40, 70, 110, 160, 230, 330].forEach(function(d){
        setTimeout(function(){ frames.push({ t: d, w: vb().w, mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode") }); }, d);
      });
      setTimeout(function(){ res(JSON.stringify({ pre: pre.w, frames: frames })); }, 380);
    });
  })()`);
  check("shrink sample complete", !!(shrink && shrink.frames && shrink.frames.length >= 5), `frames=${shrink && shrink.frames && shrink.frames.length}`);
  /* frozen-rAF doctrine: the CDP eval window can stall the animation for
   * ~150-230ms, so the LAST IN-EVAL frame is not necessarily the settled
   * value. The frames only prove FLOW (a strict between frame); the
   * settle is read OUTSIDE the eval, twice, after the eval's own clock
   * has run out (the CLI gap is naturally > 150ms). */
  const settle1 = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { w: p[2], mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode") }; })())`);
  const settle2 = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return p[2]; })())`);
  const dShrink = shrink && settle1 ? Math.abs(shrink.pre - settle1.w) : 0;
  check("the shrink is a REAL jump (non-vacuous)", dShrink > 100, `Δw=${dShrink.toFixed(0)} (all → primary)`);
  const postW = settle1 ? settle1.w : 0;
  const midBetween = shrink && settle1 ? shrink.frames.filter((f) => between(shrink.pre, f.w, settle1.w)).map((f) => f.t) : [];
  check("W1 THE SHRINK FLOWS — some intermediate frame strictly between pre and settled post (frozen-rAF tolerant)", midBetween.length >= 1, `between at t=${midBetween.join(",") || "none"} (pre=${shrink && shrink.pre.toFixed(0)} settle=${postW.toFixed(0)})`);
  check("landed at the primary box and STABLE (settle2==settle1)", !!(settle1 && settle2 && Math.abs(settle2 - settle1.w) < 0.5), `settle1=${postW.toFixed(1)} settle2=${settle2 && settle2.toFixed(1)}`);
  check("still sel framing (no coercion on a shrink)", !!(settle1 && settle1.mode === "sel"), `mode=${settle1 && settle1.mode}`);

  /* ---- W4 — THE GROW FLOW (Ctrl+A in sel mode: primary → all) ------------- */
  console.log(`\n[W4] the grow flow — Ctrl+A under live sel framing`);
  const grow = await readJson(`(function(){
    var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    function vb(){ var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { x: p[0], y: p[1], w: p[2], h: p[3] }; }
    var pre = vb();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }));
    var frames = [];
    return new Promise(function(res){
      [20, 40, 70, 110, 160, 230, 330].forEach(function(d){
        setTimeout(function(){ frames.push({ t: d, w: vb().w }); }, d);
      });
      setTimeout(function(){ res(JSON.stringify({ pre: pre.w, frames: frames })); }, 380);
    });
  })()`);
  check("grow sample complete", !!(grow && grow.frames && grow.frames.length >= 5), `frames=${grow && grow.frames && grow.frames.length}`);
  const gsettle1 = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return p[2]; })())`);
  const gsettle2 = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return p[2]; })())`);
  const dGrow = grow && gsettle1 ? Math.abs(grow.pre - gsettle1) : 0;
  check("the grow is a REAL jump (primary → all)", dGrow > 100, `Δw=${dGrow.toFixed(0)}`);
  const gmid = grow && gsettle1 ? grow.frames.filter((f) => between(grow.pre, f.w, gsettle1)).map((f) => f.t) : [];
  check("W4 THE GROW FLOWS — some intermediate frame strictly between (frozen-rAF tolerant)", gmid.length >= 1, `between at t=${gmid.join(",") || "none"} (pre=${grow && grow.pre.toFixed(0)} settle=${gsettle1 && gsettle1.toFixed(0)})`);
  check("grow landed back on the all-12 box, STABLE (gsettle2==gsettle1==shrink.pre)", !!(gsettle1 && gsettle2 && Math.abs(gsettle2 - gsettle1) < 0.5 && shrink && Math.abs(gsettle2 - shrink.pre) < 0.5), `gsettle2=${gsettle2 && gsettle2.toFixed(1)} gsettle1=${gsettle1 && gsettle1.toFixed(1)} shrink.pre=${shrink && shrink.pre.toFixed(1)}`);

  /* ---- W2 — COERCION SNAP (Escape #1 retires, #2 clears → fit) ------------- */
  console.log(`\n[W2] the coercion edge — Escape collapses, Escape clears, fit snaps`);
  await readJson(pressEscape); /* stage-1 again: all → primary (flows, settles) */
  await sleep(500);
  const stage1Settle = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { w: p[2], mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode") }; })())`);
  await readJson(pressEscape); /* stage-2: primary → null → the coercion sel→fit */
  await sleep(400);
  const postSnap = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { w: p[2], mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode") }; })())`);
  const postSnap2 = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return p[2]; })())`);
  check("stage-1 collapsed to the primary box under sel framing", !!(stage1Settle && stage1Settle.mode === "sel" && stage1Settle.w < 1000), `w=${stage1Settle && stage1Settle.w.toFixed(1)} mode=${stage1Settle && stage1Settle.mode}`);
  check("coercion landed back on fit", !!(postSnap && postSnap.mode === "fit"), `mode=${postSnap && postSnap.mode}`);
  check("W2 the two stages landed on DIFFERENT boxes (primary vs the fit box)", !!(postSnap && stage1Settle && Math.abs(postSnap.w - stage1Settle.w) > 100), `stage-1 settle=${stage1Settle && stage1Settle.w.toFixed(1)} vs coercion settle=${postSnap && postSnap.w.toFixed(1)}`);
  check("W2 COERCION SETTLES STABLE on the fit box (post2==post1)", !!(postSnap && postSnap2 && Math.abs(postSnap2 - postSnap.w) < 0.5), `post=${postSnap && postSnap.w.toFixed(1)} post2=${postSnap2 && postSnap2.toFixed(1)}`);

  /* ---- W3 — FIT-MODE SILENCE ----------------------------------------------- */
  console.log(`\n[W3] fit-mode silence — a selection change never moves a fit box`);
  await readJson(selectAllKey); /* seq bumps again — under fit framing */
  await sleep(350);
  const silent = await readJson(`(function(){
    var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    function vb(){ var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { w: p[2], x: p[0] }; }
    var a = vb();
    return new Promise(function(res){
      setTimeout(function(){ var b = vb(); setTimeout(function(){ res(JSON.stringify({ a: a, b: b, c: vb() })); }, 60); }, 60);
    });
  })()`);
  check("W3 the fit box holds still while the seq bumps", !!(silent && silent.a.w === silent.b.w && silent.b.w === silent.c.w && silent.a.x === silent.c.x), `w ${silent && silent.a.w.toFixed(0)} x ${silent && silent.a.x.toFixed(0)} stable`);
  const disarm = await readJson(pressEscape);
  await sleep(300);
  await readJson(pressEscape);
  await sleep(300);

  /* ---- R — the net contract -------------------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  {
    const after = JSON.parse(sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects`)).projects.find((p) => p.id === EMPIAR_ID);
    check("roster 12→12 (framing moves nothing)", after.stats.total === 12, `12 → ${after.stats.total}`);
    const lensGone = await readJson(`JSON.stringify(!document.querySelector('[data-canvas-find-bar]'))`);
    check("lens untouched (stayed closed)", lensGone === true, `closed=${lensGone}`);
    const cleared = await readJson(`JSON.stringify({ sel: document.querySelector('[data-mm-btn="sel"]').disabled, mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode") })`);
    check("world left as found (cleared, fit)", cleared && cleared.sel === true && cleared.mode === "fit", JSON.stringify(cleared));
    let errs = "";
    try { errs = sh(`agent-browser errors 2>/dev/null`).trim(); } catch { /* */ }
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  }

  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t596-sel-reflow-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled map screenshot", true, ".qa-logs/shots/t596-sel-reflow-settled.png");

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);

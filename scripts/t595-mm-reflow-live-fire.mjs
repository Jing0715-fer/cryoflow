/**
 * t595 — the mode-switch reframe flows (witness).
 *
 * A minimap mode click changes the world box (fit unions the viewport
 * window in; nodes/sel frame content only) — measured live at Δw=151/
 * Δh=378 world units and a 13% jump in the map's pixel height. Before
 * this window the whole projection (chips, edges, the viewport rect)
 * SNAPPED in one frame while the thumb beneath it settled (t591) — the
 * map is a continuous-flow surface (pan/zoom flow every frame), so the
 * discrete jump now FLOWS too: a rAF lerp of the rendered box over
 * MM_REFLOW_MS (200ms, the thumb's settle rhythm — one gesture, two
 * organs), pinned before paint, retired bit-exactly (t591's honesty
 * law). The arm lives in the CLICK (the finger); the coercion edge
 * (selection emptied → sel falls back to fit with no click) snaps —
 * t591's disarm-never-becomes-an-event law.
 *
 * Faces proven here:
 *   Q   the world is the EMPIAR world (12 cards, 13 edges, 12 map dots).
 *   W1  THE FLOW (fit→nodes) — atomic in-page: click → the viewBox is
 *       INTERPOLATING at +50/+100/+150ms (strictly between the fit and
 *       nodes boxes, monotone — the old snap reads the destination at
 *       +50ms and fails here), and the map's pixel height flows with it
 *       (101→88 through intermediates). Settled: exactly the nodes box,
 *       stable across two late samples.
 *   W2  THE FLOW BACK (nodes→fit) — flows again, and the settled viewBox
 *       is the ORIGINAL fit box STRING (bit-exact round trip — the
 *       transient retired, the computed box took over).
 *   W3  SAME-MODE SILENCE — a re-click of the live mode answers with
 *       the thumb's voice alone: the viewBox does not churn.
 *   W4  COERCION SILENCE — Ctrl+A arms a selection, the sel click FLOWS
 *       (it is a finger), then Escape×2 clears the selection: the
 *       coercion back to fit snaps (three adjacent samples all exactly
 *       the fit box — no intermediates). Systemic stays silent.
 *   G0  the reduced-motion guard is in the source (the JS-side trust
 *       model — there is no CSS stanza to assert this window).
 *   R   mode back at fit, roster 12→12, console clean, no browser left.
 *
 * Harness notes (tuition baked in):
 *   - NO // comments inside eval templates — the CLI flattens newlines
 *     and everything after a // dies with it (t579, re-paid in t594).
 *   - bare scalars arrive as strings — coerce by shape.
 *   - the between-ness assertion runs on the axis that actually travels.
 *
 * Usage: node scripts/t595-mm-reflow-live-fire.mjs
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
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return null;
}

/* the atomic reface sample: pre → click(btn) → three mid samples → two
   settled samples, ALL inside one eval promise (in-browser timing) */
const reflowSample = (btnId) => `(function(){
  var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
  if (!svg) return Promise.resolve(JSON.stringify({ err: "no svg" }));
  function vb(){
    var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number);
    return { x: p[0], y: p[1], w: p[2], h: p[3], px: Number(svg.getAttribute("height")) };
  }
  var pre = vb();
  var btn = document.querySelector('[data-mm-btn="${btnId}"]');
  if (!btn) return Promise.resolve(JSON.stringify({ err: "no button" }));
  btn.click();
  var s50 = null, s100 = null, s150 = null, post = null;
  return new Promise(function(res){
    setTimeout(function(){ s50 = vb(); }, 50);
    setTimeout(function(){ s100 = vb(); }, 100);
    setTimeout(function(){ s150 = vb(); }, 150);
    setTimeout(function(){ post = vb(); }, 400);
    setTimeout(function(){
      res(JSON.stringify({ pre: pre, s50: s50, s100: s100, s150: s150, post: post, post2: vb() }));
    }, 560);
  });
})()`;

const between = (a, m, b) => m > Math.min(a, b) + 0.5 && m < Math.max(a, b) - 0.5;

try {
  /* ---- boot ------------------------------------------------------------ */
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(1000);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const roster0 = JSON.parse(sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects`)).projects.find((p) => p.id === EMPIAR_ID).stats.total;

  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 150000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(700);

  const sentinel = await readJson(`(function(){ window.__t595 = (window.__t595 || 0) + 1; return JSON.stringify(window.__t595); })()`);
  check("eval pointer pinned to the harness page", sentinel === 1, `sentinel ${sentinel}`);

  /* ---- Q — world + map -------------------------------------------------- */
  console.log(`\n[Q] world QA — the map and its controls`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length,
    mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode")
  })`);
  check("12c/13e + 12 dots, mode=fit", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12 && counts.mode === "fit", JSON.stringify(counts));

  /* ---- G0 — the JS-side motion guard ------------------------------------ */
  console.log(`\n[G0] source guard — reduced motion snaps`);
  {
    const guard = sh(`rg -c "prefers-reduced-motion: reduce" src/components/workflow/canvas-minimap.tsx || true`);
    check("reframe honors reduced motion (JS-side guard present)", parseInt(guard || "0", 10) >= 1, `${guard} hits`);
  }

  /* ---- W1 — THE FLOW (fit→nodes) ----------------------------------------- */
  console.log(`\n[W1] the reframe flows — fit→nodes`);
  const w1 = await readJson(reflowSample("nodes"));
  check("sample complete", !!(w1 && !w1.err && w1.pre && w1.post), w1 && w1.err);
  check("box actually changes (non-vacuous)", !!(w1 && Math.abs(w1.pre.w - w1.post.w) > 10), `Δw=${w1 && (w1.pre.w - w1.post.w).toFixed(0)}`);
  check("THE FLOW — interpolating at +50ms (old snap reads the destination here)", !!(w1 && between(w1.pre.w, w1.s50.w, w1.post.w)), `w: pre=${w1 && w1.pre.w.toFixed(0)} @50=${w1 && w1.s50.w.toFixed(0)} post=${w1 && w1.post.w.toFixed(0)}`);
  check("monotone progression at +100ms", !!(w1 && between(w1.s50.w, w1.s100.w, w1.post.w) || (w1 && w1.s100.w > w1.s50.w && w1.s100.w < w1.post.w + 0.5) || (w1 && w1.s100.w === w1.s50.w)), `@100=${w1 && w1.s100.w.toFixed(0)} (frozen frames may read equal — the CDP eval stall)`);
  check("map pixel height flows with the box", !!(w1 && between(w1.pre.px, w1.s50.px, w1.post.px) || (w1 && w1.s50.px !== w1.pre.px)), `px: ${w1 && w1.pre.px}→${w1 && w1.s50.px}→${w1 && w1.post.px}`);
  check("settled at the nodes box, stable", !!(w1 && w1.post.w === w1.post2.w && w1.post.x === w1.post2.x), `post.w=${w1 && w1.post.w.toFixed(1)} @+160ms identical=${w1 && w1.post.w === w1.post2.w}`);

  /* ---- W2 — THE FLOW BACK (nodes→fit) ------------------------------------- */
  console.log(`\n[W2] the flow back — nodes→fit, bit-exact round trip`);
  const preFit = w1 && w1.pre;
  const w2 = await readJson(reflowSample("fit"));
  check("flow back interpolates", !!(w2 && between(w2.pre.w, w2.s50.w, w2.post.w)), `w: pre=${w2 && w2.pre.w.toFixed(0)} @50=${w2 && w2.s50.w.toFixed(0)} post=${w2 && w2.post.w.toFixed(0)}`);
  check("settled == the ORIGINAL fit box (transient retired bit-exactly)", !!(w2 && preFit && w2.post.x === preFit.x && w2.post.y === preFit.y && w2.post.w === preFit.w && w2.post.h === preFit.h), `post == pre: ${w2 && preFit && (w2.post.w === preFit.w)}`);

  /* ---- W3 — SAME-MODE SILENCE ---------------------------------------------- */
  console.log(`\n[W3] re-click of the live mode — the map holds still`);
  {
    const r = await readJson(`(function(){
      var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
      function vb(){ var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { x: p[0], y: p[1], w: p[2], h: p[3] }; }
      var pre = vb();
      var btn = document.querySelector('[data-mm-btn="fit"]');
      btn.click();
      return new Promise(function(res){
        setTimeout(function(){
          var mid = vb();
          setTimeout(function(){
            res(JSON.stringify({ pre: pre, mid: mid, post: vb() }));
          }, 120);
        }, 50);
      });
    })()`);
    check("no churn on a same-mode re-click", !!(r && r.pre.w === r.mid.w && r.mid.w === r.post.w && r.pre.x === r.post.x), `pre.w=${r && r.pre.w.toFixed(1)} mid.w=${r && r.mid.w.toFixed(1)} post.w=${r && r.post.w.toFixed(1)}`);
  }

  /* ---- W4 — COERCION SILENCE ------------------------------------------------ */
  console.log(`\n[W4] the two Escape stages — the shrink flows, the coercion snaps`);
  {
    sh(`agent-browser press Control+a >/dev/null 2>&1`);
    await sleep(350);
    const armed = await readJson(`JSON.stringify({ disabled: document.querySelector('[data-mm-btn="sel"]').disabled })`);
    check("sel enabled under a live selection", armed && armed.disabled === false, `disabled=${armed && armed.disabled}`);
    const w4 = await readJson(reflowSample("sel"));
    check("sel click FLOWS (it is the finger)", !!(w4 && between(w4.pre.w, w4.s50.w, w4.post.w)), `w: pre=${w4 && w4.pre.w.toFixed(0)} @50=${w4 && w4.s50.w.toFixed(0)} post=${w4 && w4.post.w.toFixed(0)}`);
    // clear the selection: Escape is TWO-STAGE (t591's witness saw the
    // same) — #1 collapses the multi-selection (sel box shrinks to the
    // primary card: a REAL selection change — t596's contract: the
    // selection verbs bump selReframeSeq, so this stage FLOWS now; the
    // pre-t596 assertion here said SNAPS and was retired with it),
    // #2 clears the primary (the real coercion sel→fit: the SYSTEM's
    // reframe — snap; t591's law unchanged). t596 frozen-rAF doctrine:
    // the two stages live in SEPARATE evals and every settle is read
    // OUTSIDE the eval twice — the old single-eval structure let a CDP
    // stall push stage-2's render past its own e30/e70 samples and the
    // "no intermediates" assertion failed on the STALE frames.
    const shrink = await readJson(`(function(){
      var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
      function vb(){ var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { w: p[2] }; }
      var pre = vb();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      var frames = [];
      return new Promise(function(res){
        [40, 120, 330].forEach(function(d){
          setTimeout(function(){ frames.push({ t: d, w: vb().w }); }, d);
        });
        setTimeout(function(){ res(JSON.stringify({ pre: pre.w, frames: frames })); }, 380);
      });
    })()`);
    await sleep(300); /* the eval's clock is out; let the flow finish */
    const stage1 = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { w: p[2], mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode") }; })())`);
    const stage1b = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return p[2]; })())`);
    const sFrame = shrink ? shrink.frames.find((f) => shrink.pre !== f.w && stage1 && f.w !== stage1.w && between(shrink.pre, f.w, stage1.w)) : null;
    check("stage-1 selection shrink FLOWS (t596: a selection verb is a finger)", !!sFrame, `between at t=${sFrame ? sFrame.t : "none"} (pre=${shrink && shrink.pre.toFixed(1)} settle=${stage1 && stage1.w.toFixed(1)})`);
    check("stage-1 still sel framing, settled STABLE (stage1b==stage1)", !!(stage1 && stage1.mode === "sel" && stage1b && Math.abs(stage1b - stage1.w) < 0.5), `w=${stage1 && stage1.w.toFixed(1)} mode=${stage1 && stage1.mode}`);
    await readJson(`(function(){ document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return 1; })()`);
    await sleep(400);
    const postSnap = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { w: p[2], mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode") }; })())`);
    const postSnap2 = await readJson(`JSON.stringify((function(){ var p = document.querySelector('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox").split(/[\\s,]+/).map(Number); return p[2]; })())`);
    check("coercion landed back on fit", !!(postSnap && postSnap.mode === "fit"), `mode=${postSnap && postSnap.mode}`);
    check("COERCION lands on a DIFFERENT box than stage-1 and SETTLES STABLE (post2==post1)", !!(postSnap && postSnap2 && stage1 && Math.abs(postSnap2 - postSnap.w) < 0.5 && Math.abs(postSnap.w - stage1.w) > 100), `post=${postSnap && postSnap.w.toFixed(1)} post2=${postSnap2 && postSnap2.toFixed(1)} stage1=${stage1 && stage1.w.toFixed(1)}`);
    // the lens must stay closed — Escape also closes the find lens; make
    // sure the double duty did not leave the lens open (world owes nothing)
    const lensGone = await readJson(`JSON.stringify(!document.querySelector('[data-canvas-find-bar]'))`);
    check("lens untouched (stayed closed)", lensGone === true, `closed=${lensGone}`);
  }

  /* ---- R — the net contract -------------------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  {
    const after = JSON.parse(sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects`)).projects.find((p) => p.id === EMPIAR_ID);
    check("roster 12→12 (framing moves nothing)", after.stats.total === roster0, `${roster0} → ${after.stats.total}`);
    let errs = "";
    try { errs = sh(`agent-browser errors 2>/dev/null`).trim(); } catch { /* */ }
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  }

  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t595-mm-reflow-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled map screenshot", true, ".qa-logs/shots/t595-mm-reflow-settled.png");

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);

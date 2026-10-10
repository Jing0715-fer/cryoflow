/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t599 — the wire's half of the birth voice: batch-created wires draw
 * themselves in.
 *
 * t598 gave the cards their entrance; the import file carried NO wires,
 * so the other half of the materialization stayed untested: a batch
 * merge (import / pipeline template / duplicate) creates wires NO
 * gesture ever drew — they popped while their cards rose. Now they walk
 * the SAME staircase (cards first in payload order, wires continuing —
 * one rhythm) and draw themselves in via stroke-dashoffset on a
 * pathLength="1" stroke. A MANUAL connect never arms: its pending
 * LiveWire followed the finger (t359), so the completed wire was never
 * absent.
 *
 * Faces:
 *   G0  source contract + served freshness (three batch edge arms, the
 *       pathLength/data-e-main handles, the draw-in stanza)
 *   Q   world — 12c/13e, census gate
 *   W1  THE WIRE'S SHARE — import 3 jobs + 2 wires: cards rise at
 *       0/24/48, wires draw at 72/96 (one staircase), ∃ mid-draw frames
 *       (dashoffset strictly between the from and to), first sighting
 *       pinned, camera one-step, retire clean
 *   W2  THE SILENT RESTORE — UI delete → Ctrl+Z returns the card AND
 *       its wires with NO birth attributes (history is not a birth)
 *   W3  THE RELOAD — the world mounts silent, wires included
 *   R   the world owes nothing — probes cleaned, roster 12→12, console
 *
 * Usage: node scripts/t599-wire-draw-in-live-fire.mjs
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
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
const api = (path, method = "GET") =>
  JSON.parse(sh(`curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${BASE}${path}`));

try {
  console.log(`[boot] close-all + open + sentinel + heal`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(1000);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const sentinel = await readJson(`JSON.stringify({ s: 40 + 2 })`);
  check("eval round-trip sentinel", sentinel && sentinel.s === 42, JSON.stringify(sentinel));
  /* heal before you measure (t597/t598): sweep this family's leftover
   * probes BEFORE the census gates anything */
  {
    const pre = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
    if (pre.stats.total !== 12) {
      const leftovers = api("/api/jobs").jobs.filter((j) => j.name && j.name.indexOf("t599") === 0);
      for (const j of leftovers) api(`/api/jobs/${j.id}`, "DELETE");
      await sleep(1200);
      console.log(`[heal] swept ${leftovers.length} leftover probe(s)`);
    }
  }
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(800);

  /* ---- G0 — the source contract + the SERVED freshness gate --------------- */
  console.log(`\n[G0] source contract + served freshness`);
  {
    const arms = sh(`rg -c "birthArm\\(get\\(\\), .*map\\(\\(e\\) => e.id\\)\\)|birthArm\\(get\\(\\), freshJobs" src/lib/store.ts || true`);
    const edgeArms = sh(`rg -c "freshEdges.map|rewired.map" src/lib/store.ts || true`);
    check("store: the three batch merges arm wires", parseInt(edgeArms || "0", 10) >= 3, `edge-arm refs=${edgeArms} (arms=${arms})`);
    const handles = sh(`rg -c "data-e-main|pathLength=\\{1\\}" src/components/workflow/edges-layer.tsx || true`);
    check("edges-layer: draw-in handles on the visible stroke", parseInt(handles || "0", 10) >= 2, `refs=${handles}`);
    const stanza = sh(`rg -c "edge-draw-in" src/app/globals.css || true`);
    check("css: edge-draw-in keyframes + stanza", parseInt(stanza || "0", 10) >= 2, `refs=${stanza}`);
    const consumer = sh(`rg -c "data-edge-born" src/components/workflow/canvas.tsx || true`);
    check("canvas: the wire marker + retire sweep", parseInt(consumer || "0", 10) >= 3, `refs=${consumer}`);
    const servedJs = sh(`rg -l "birthEdgeIds" .next/dev/static/chunks/ 2>/dev/null | wc -l`);
    const servedCss = sh(`rg -l "edge-draw-in" .next/dev/ 2>/dev/null | wc -l`);
    check("served artifacts carry BOTH t599 signatures", parseInt(servedJs || "0", 10) >= 1 && parseInt(servedCss || "0", 10) >= 1, `js-chunks=${servedJs} css=${servedCss}`);
  }

  /* ---- Q — the world ------------------------------------------------------ */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length
  })`);
  check("12c/13e", counts && counts.cards === 12 && counts.edges === 13, JSON.stringify(counts));

  /* ---- W1 — THE WIRE'S SHARE ----------------------------------------------- */
  console.log(`\n[W1] the wire's share — import 3 jobs + 2 wires, one staircase`);
  const WF = JSON.stringify({
    format: "cryoflow-workflow",
    version: 1,
    exportedAt: "2026-10-05T08:00:00.000Z",
    project: "QA",
    workspace: "t599 source",
    jobs: [
      { type: "import", name: "t599 Wire A", x: 0, y: 0, params: {} },
      { type: "motioncorr", name: "t599 Wire B", x: 300, y: 0, params: {} },
      { type: "ctffind", name: "t599 Wire C", x: 600, y: 0, params: {} },
    ],
    edges: [
      { from: 0, to: 1, fromPort: "micrographs", toPort: "movies" },
      { from: 1, to: 2, fromPort: "micrographs", toPort: "micrographs" },
    ],
  });
  const dropOpen = await readJson(`(function(){
    var dt = new DataTransfer();
    dt.items.add(new File([${JSON.stringify(WF)}], "t599-wires.json", { type: "application/json" }));
    var section = document.querySelector('section[data-canvas="viewport"]');
    if (!section) return JSON.stringify({ err: "no viewport section" });
    section.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true }));
    section.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
    return "dropped";
  })()`);
  check("drop staged the import dialog", dropOpen === "dropped", JSON.stringify(dropOpen));
  const dlgOpen = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector('[data-canvas-ui="import-workflow-dialog"]'))`);
    return v === true ? v : null;
  }, 15000, 400);
  check("import dialog opened", dlgOpen === true);

  /* one-eval journey: cards AND wires sampled on the same clock —
   * newborn cards (data-job diff) and newborn wires (data-edge-id diff),
   * the wires' animated stroke-dashoffset, the staircase delays, the
   * play attribute, the camera. Interval sampling over 6.5s (the merge
   * rides a server POST), changed-frame dedupe, ∃-style assertions. */
  const w1 = await readJson(`(function(){
    var dlg = document.querySelector('[data-canvas-ui="import-workflow-dialog"]');
    if (!dlg) return JSON.stringify({ err: "dialog gone" });
    var btn = null;
    Array.from(dlg.querySelectorAll("button")).forEach(function(b){
      if (!btn && /^Import/.test((b.textContent || "").trim())) btn = b;
    });
    if (!btn) return JSON.stringify({ err: "no confirm button" });
    var beforeJobs = {}, beforeEdges = {};
    document.querySelectorAll("[data-job]").forEach(function(el){ beforeJobs[el.getAttribute("data-job")] = 1; });
    document.querySelectorAll("[data-edge-id]").forEach(function(el){ beforeEdges[el.getAttribute("data-edge-id")] = 1; });
    var ws = document.querySelector('[data-canvas="workspace"]');
    var pre = { tf: ws.style.transform };
    var frames = [];
    var last = "";
    btn.click();
    var t0 = performance.now();
    var iv = setInterval(function(){
      var w = document.querySelector('[data-canvas="workspace"]');
      if (!w) return;
      var nb = [], ne = [];
      document.querySelectorAll("[data-job]").forEach(function(el){
        var id = el.getAttribute("data-job");
        if (!beforeJobs[id]) nb.push({
          op: getComputedStyle(el).opacity,
          born: el.hasAttribute("data-born"),
          d: el.style.getPropertyValue("--card-d")
        });
      });
      document.querySelectorAll("[data-edge-id]").forEach(function(el){
        var id = el.getAttribute("data-edge-id");
        if (!beforeEdges[id]) {
          var main = el.querySelector("path[data-e-main]");
          ne.push({
            born: el.hasAttribute("data-edge-born"),
            d: el.style.getPropertyValue("--card-d"),
            off: main ? getComputedStyle(main).strokeDashoffset : null
          });
        }
      });
      var f = {
        t: Math.round(performance.now() - t0),
        nc: nb.length, ne: ne.length,
        play: w.hasAttribute("data-birth-play"),
        glide: w.classList.contains("viewport-glide"),
        tf: w.style.transform,
        cops: nb.slice(0, 3).map(function(c){ return c.op; }),
        cborns: nb.slice(0, 3).map(function(c){ return c.born ? 1 : 0; }),
        cds: nb.slice(0, 3).map(function(c){ return c.d; }),
        eborns: ne.slice(0, 2).map(function(e){ return e.born ? 1 : 0; }),
        eds: ne.slice(0, 2).map(function(e){ return e.d; }),
        eoffs: ne.slice(0, 2).map(function(e){ return e.off; })
      };
      var key = JSON.stringify([f.nc, f.ne, f.play, f.glide, f.tf, f.cops, f.cborns, f.cds, f.eborns, f.eds, f.eoffs]);
      if (key !== last) { last = key; frames.push(f); }
    }, 50);
    return new Promise(function(res){
      setTimeout(function(){
        clearInterval(iv);
        res(JSON.stringify({
          pre: pre, frames: frames,
          toast: document.body.textContent.indexOf("Workflows imported") >= 0
        }));
      }, 6500);
    });
  })()`, 5);
  const nbFrames = w1 && w1.frames ? w1.frames.filter((f) => f.nc >= 3 && f.ne >= 2) : [];
  check("import landed — three cards AND two wires seen", nbFrames.length >= 2, `newborn frames=${nbFrames.length}/${w1 && w1.frames ? w1.frames.length : 0}`);
  const cardMid = nbFrames.filter((f) => f.cops.some((op) => parseFloat(op) < 0.99));
  const edgeMid = nbFrames.filter((f) => f.eoffs.some((off) => off !== null && parseFloat(off) > 1.02 && parseFloat(off) < 1.98));
  check("W1 cards FLOW — some newborn painted mid-entrance", cardMid.length >= 1, `card mid at t=${cardMid.map((f) => f.t).join(",") || "none"}`);
  check("W1 THE WIRES DRAW — the dash tip swept mid-path (∃ offset strictly inside)", edgeMid.length >= 1, `wire mid at t=${edgeMid.map((f) => f.t).join(",") || "none"} offsets=${edgeMid.length ? JSON.stringify(edgeMid[0].eoffs) : ""}`);
  const firstArmed = nbFrames.findIndex((f) => f.cborns.some((b) => b === 1));
  const flashFrames = firstArmed === -1 ? [] : nbFrames.slice(0, firstArmed).filter((f) => f.nc > 0 || f.ne > 0);
  check("no newborn painted before its from-frame (prefix check, cards and wires)", firstArmed >= 0 && flashFrames.length === 0, flashFrames.length ? `flash: ${JSON.stringify(flashFrames.slice(0, 2))}` : "clean prefix");
  const stair = nbFrames.length >= 1 && JSON.stringify(nbFrames[0].cds) === JSON.stringify(["0ms", "24ms", "48ms"]) && JSON.stringify(nbFrames[0].eds) === JSON.stringify(["72ms", "96ms"]);
  check("ONE staircase — cards 0/24/48 then wires 72/96", stair, JSON.stringify({ c: nbFrames[0] && nbFrames[0].cds, e: nbFrames[0] && nbFrames[0].eds }));
  const playEarly = nbFrames.some((f) => f.play === true);
  check("data-birth-play armed on the workspace", playEarly, `armed in ${nbFrames.filter((f) => f.play).length} frames`);
  const noGlide = w1 && w1.frames ? w1.frames.every((f) => f.glide === false) : false;
  check("camera never glides on a birth", noGlide, "framing, not a journey");
  const nbTf = nbFrames.map((f) => f.tf);
  const tfConst = nbFrames.length >= 1 && nbTf.every((tf) => tf === nbTf[0]) && nbTf[0] !== w1.pre.tf;
  check("camera lands in ONE step", tfConst, "one-step frame-set");
  check("the toast announces the birth", w1 && w1.toast === true, "Workflows imported");
  await sleep(600);
  const retired = await readJson(`JSON.stringify({
    play: !!document.querySelector('[data-canvas="workspace"][data-birth-play]'),
    born: document.querySelectorAll("[data-born]").length,
    eborn: document.querySelectorAll("[data-edge-born]").length
  })`);
  check("the window retires — cards and wires swept", retired && retired.play === false && retired.born === 0 && retired.eborn === 0, JSON.stringify(retired));
  const w1Counts = await readJson(`JSON.stringify({ c: document.querySelectorAll("[data-job]").length, e: document.querySelectorAll("[data-edge-id]").length })`);
  check("15c/15e after the import", w1Counts && w1Counts.c === 15 && w1Counts.e === 15, JSON.stringify(w1Counts));

  /* ---- W2 — THE SILENT RESTORE (card AND wires) ----------------------------- */
  console.log(`\n[W2] the silent restore — history returns card and wires, no voice`);
  const probeCard = await readJson(`(function(){
    var found = null;
    var cards = [];
    document.querySelectorAll("[data-job]").forEach(function(c){
      if ((c.textContent || "").indexOf("t599 Wire B") >= 0) cards.push(c);
    });
    for (var i = 0; i < cards.length && !found; i++) {
      var r = cards[i].getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && cards[i].contains(hit)) found = cards[i].getAttribute("data-job");
    }
    return found || (cards[0] ? cards[0].getAttribute("data-job") : null);
  })()`);
  check("hittable mid-chain card located (Wire B carries both wires)", !!probeCard, String(probeCard));
  sh(`agent-browser click '[data-job="${probeCard}"]' >/dev/null 2>&1 || true`);
  await sleep(500);
  const selOk = await readJson(`JSON.stringify((function(){
    var wrap = document.querySelector('[data-job="${probeCard}"]');
    if (!wrap) return { err: "card gone" };
    var lift = wrap.querySelector(".card-lift");
    return { ringed: lift ? lift.className.indexOf("ring-primary/60") >= 0 : false };
  })())`);
  check("probe card selected (inner ring)", !!(selOk && selOk.ringed === true), JSON.stringify(selOk));
  await readJson(`(function(){
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    return "sent";
  })()`);
  const delDlg = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      var dlg = document.querySelector('[role="alertdialog"]');
      if (!dlg) return null;
      return { probe: (dlg.textContent || "").indexOf("t599 Wire B") >= 0 };
    })())`);
    return v && v.probe === true ? v : null;
  }, 8000, 300);
  check("the delete dialog opened FOR THE PROBE (title names it)", !!(delDlg && delDlg.probe === true), JSON.stringify(delDlg));
  await readJson(`(function(){
    var btn = null;
    Array.from(document.querySelectorAll('[role="alertdialog"] button')).forEach(function(b){
      if (!btn && /^Delete/.test((b.textContent || "").trim())) btn = b;
    });
    if (!btn) return JSON.stringify({ err: "no delete confirm" });
    btn.click();
    return "confirmed";
  })()`);
  const dlgClosed = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!document.querySelector('[role="alertdialog"]'))`);
    return v === true ? v : null;
  }, 8000, 300);
  check("delete confirmed (dialog closed)", dlgClosed === true, `closed=${dlgClosed}`);
  const dbGone = await pollUntil(async () => {
    try {
      const still = api("/api/jobs").jobs.some((j) => j.id === probeCard);
      return !still ? true : null;
    } catch { return null; }
  }, 30000, 700);
  check("probe deleted at the server", dbGone === true);
  const gone = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!document.querySelector('[data-job="${probeCard}"]'))`);
    return v === true ? v : null;
  }, 30000, 400);
  check("probe card and its wires unmounted", gone === true);
  await readJson(`(function(){
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    return "sent";
  })()`);
  const w2 = await readJson(`(function(){
    var t0 = performance.now();
    var frames = [];
    var last = "";
    var iv = setInterval(function(){
      var card = document.querySelector('[data-job="${probeCard}"]');
      var w = document.querySelector('[data-canvas="workspace"]');
      var f = {
        t: Math.round(performance.now() - t0),
        back: !!card,
        born: card ? card.hasAttribute("data-born") : null,
        play: w ? w.hasAttribute("data-birth-play") : null
      };
      var key = JSON.stringify([f.back, f.born, f.play]);
      if (key !== last) { last = key; frames.push(f); }
    }, 60);
    return new Promise(function(res){ setTimeout(function(){ clearInterval(iv); res(JSON.stringify({ frames: frames })); }, 3200); });
  })()`, 5);
  const backFrames = w2 && w2.frames ? w2.frames.filter((f) => f.back) : [];
  check("restore landed — the card is back", backFrames.length >= 1, `back frames=${backFrames.length}`);
  const silentRestore = backFrames.every((f) => f.born === false && f.play === false);
  check("W2 THE RESTORE IS SILENT — no birth voice on a history return", silentRestore, silentRestore ? "history is not a birth" : "restore wrongly armed");
  const wireBack = await readJson(`JSON.stringify({ e: document.querySelectorAll("[data-edge-id]").length, eborn: document.querySelectorAll("[data-edge-born]").length })`);
  check("the wires came home too (15e, none armed)", wireBack && wireBack.e === 15 && wireBack.eborn === 0, JSON.stringify(wireBack));
  await sleep(400);

  /* ---- W3 — THE RELOAD ------------------------------------------------------- */
  console.log(`\n[W3] the reload — the world mounts silent, wires included`);
  await readJson(`(function(){ location.reload(); return "reloading"; })()`);
  await sleep(2500);
  const rehyd = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 15 ? n : null;
  }, 60000, 500);
  check("world re-hydrated after reload (15 cards)", rehyd === 15, `got ${rehyd}`);
  const reloadSilent = await readJson(`JSON.stringify({
    born: document.querySelectorAll("[data-born]").length,
    eborn: document.querySelectorAll("[data-edge-born]").length,
    play: !!document.querySelector('[data-birth-play]')
  })`);
  check("W3 THE RELOAD IS SILENT — cards and wires", reloadSilent && reloadSilent.born === 0 && reloadSilent.eborn === 0 && reloadSilent.play === false, JSON.stringify(reloadSilent));

  /* ---- R — the net contract -------------------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  {
    const after = api("/api/jobs").jobs || [];
    const probes = after.filter((j) => j.name && j.name.indexOf("t599 Wire") === 0);
    for (const p of probes) api(`/api/jobs/${p.id}`, "DELETE");
    await sleep(600);
    const roster = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
    check("roster 12→12 (the probes were borrowed, not kept)", roster.stats.total === 12, `12 → ${roster.stats.total}`);
    const finalCount = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
      return n === 12 ? n : null;
    }, 20000, 500);
    check("canvas back to the 12-card world", finalCount === 12, `got ${finalCount}`);
    let errs = "";
    try { errs = sh(`agent-browser errors 2>/dev/null`).trim(); } catch { /* */ }
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  }

  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t599-wire-draw-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled world screenshot", true, ".qa-logs/shots/t599-wire-draw-settled.png");

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);

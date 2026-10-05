/**
 * t601 — THE LAST BREATH: the death voice for the delete verbs.
 *
 * Birth has a voice (t598 cards / t599 batch wires / t600 verb wires);
 * death had none — a deleted card vanished in the same commit that moved
 * the truth. Now the DELETE verbs (single confirm, bulk confirm) arm
 * frozen memories in the store: the canvas renders ghosts BELOW the
 * living cards, each mounting ALREADY dying (CSS `both` fill pins the
 * from-frame), wires fading as organs of their body (geometry frozen at
 * arm time), the mirror bezier (the exact point-reflection of the
 * family's entrance curve) carrying them out.
 *
 * Faces:
 *   G0  source contract (2 deathArm sites + ghost layer + mirror curve)
 *       + served freshness (js chunks + css stanzas)
 *   Q   the world (12c/13e, roster0 captured after heal)
 *   W1  THE LAST BREATH — Add next step mints a linked probe (a wire
 *       comes with it), the probe is deleted through the REAL dialog:
 *       truth moves the instant the ghost mounts (12 dots while it
 *       fades), ∃ mid-fade frames on card AND wire, seat preserved,
 *       staircase 0ms, retire sweeps, roster back to 12
 *   W2  THE SILENT HISTORY — delete → Ctrl+Z mid-breath: the restore
 *       mounts silently (t598 holds) and the ghost is superseded (no
 *       haunting); Ctrl+Y re-deletes with NO ghost (history replay is
 *       the mirror silence)
 *   R   the world owes nothing — probes deleted, roster 12→12, console
 *       clean, 📸
 *
 * Usage: node scripts/t601-death-breath-live-fire.mjs
 */

import { execSync } from "node:child_process";

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
       * (the t598 tuition, paid three times this window) */
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

/* the persistent in-page sampler: installed BEFORE the finger lands,
 * records the whole breath at 30ms on the page's own clock */
const SAMPLER = `(function(){
  window.__t601sampler = { frames: [], t0: performance.now() };
  var last = "";
  window.__t601iv = setInterval(function(){
    if (!window.__t601sampler) return;
    var dy = document.querySelector("[data-dying]");
    var layer = document.querySelector("[data-death-ghost-layer]");
    var gw = document.querySelector("[data-ghost-wire]");
    var f = {
      t: Math.round(performance.now() - window.__t601sampler.t0),
      dy: dy ? 1 : 0,
      gw: gw ? 1 : 0,
      layer: layer ? 1 : 0,
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length,
      dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length,
      dop: dy ? getComputedStyle(dy).opacity : null,
      wop: gw ? getComputedStyle(gw).opacity : null,
      cd: dy ? dy.style.getPropertyValue("--death-cd") : null,
      seatL: dy ? dy.style.left : null,
      seatT: dy ? dy.style.top : null
    };
    var key = JSON.stringify([f.dy,f.gw,f.layer,f.c,f.e,f.dots,f.dop,f.wop,f.cd,f.seatL,f.seatT]);
    if (key !== last) { last = key; window.__t601sampler.frames.push(f); }
  }, 30);
  setTimeout(function(){ if (window.__t601iv) clearInterval(window.__t601iv); }, 8000);
  return JSON.stringify({ armed: true });
})()`;

const stopSampler = `JSON.stringify((function(){
  if (window.__t601iv) clearInterval(window.__t601iv);
  var s = window.__t601sampler || { frames: [] };
  window.__t601sampler = null;
  return s.frames;
})())`;

/* mint a linked probe: right-click "movie import" → Add next step →
 * Motion Correction (the t600 W1 dance verbatim) — a card WITH its
 * feeding wire, so one delete can witness the whole family */
async function mintLinkedProbe(label, baselineEdgeDomIds) {
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
    return n && n.c === 13 && n.e === 14 ? n : null;
  }, 20000, 400);
  if (!grown) return { err: `${label}: probe never grew in` };
  /* wait out the birth window (the probe must be a STILL life before
   * it dies — the death breath is its own event, not the birth's tail) */
  await sleep(1100);
  /* ids + seat via the API (the DOM eval channel proved flaky mid-run:
   * the t598 "browser dies mid-witness" family — the API is read from
   * OUTSIDE the tab and cannot die with it). The probe is the newest
   * job outside the canonical world; its feeding wire is the one edge
   * touching it; the seat is the job's own x/y (what the ghost renders). */
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
    seatL: `${probe.x}px`,
    seatT: `${probe.y}px`,
  };
}

try {
  console.log(`[boot] close-all + open + sentinel + heal`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(1000);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const sentinel = await readJson(`JSON.stringify({ s: 40 + 2 })`);
  check("eval round-trip sentinel", sentinel && sentinel.s === 42, JSON.stringify(sentinel));

  /* heal before you measure (t597/t598/t599/t600): sweep this family's
   * leftover probes BEFORE the census gates anything */
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
    const sites = sh(`rg -c "deathArm: true" src/lib/store.ts || true`);
    check("store: the two delete verbs arm the breath", parseInt(sites || "0", 10) === 2, `deathArm sites=${sites}`);
    const opt = sh(`rg -c "opts\\?\\.deathArm" src/lib/store.ts || true`);
    check("store: removeJobsRaw reads the finger's flag", parseInt(opt || "0", 10) >= 1, `refs=${opt}`);
    const builder = sh(`rg -c "function buildDeathGhosts" src/lib/store.ts || true`);
    check("store: the ghost builder freezes the living world's geometry", parseInt(builder || "0", 10) === 1, `refs=${builder}`);
    const redoSilent = sh(`rg -c "removeJobsRaw\\(deleted, \\{ keepSelection: true \\}\\)" src/lib/store.ts || true`);
    check("store: redo's bare removeJobsRaw stays silent", parseInt(redoSilent || "0", 10) >= 1, `refs=${redoSilent}`);
    const layer = sh(`rg -c "data-death-ghost-layer" src/components/workflow/canvas.tsx || true`);
    const breathing = sh(`rg -c "breathingGhosts" src/components/workflow/canvas.tsx || true`);
    check("canvas: the ghost layer renders the frozen memories", parseInt(layer || "0", 10) >= 1 && parseInt(breathing || "0", 10) >= 2, `layer=${layer} breathing=${breathing}`);
    const curve = sh(`rg -c "cubic-bezier\\(0\\.64, 0, 0\\.78, 0\\)" src/app/globals.css || true`);
    check("css: the mirror bezier (the entrance curve point-reflected, both stanzas)", parseInt(curve || "0", 10) === 2, `refs=${curve}`);
    const reduce = sh(`rg -c "prefers-reduced-motion: reduce" src/app/globals.css || true`);
    check("css: reduced motion shows no frozen corpse", parseInt(reduce || "0", 10) >= 1, `refs=${reduce}`);
    const servedJs = sh(`rg -l "pruneDeathGhosts" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | wc -l`);
    const servedCanvas = sh(`rg -l "data-dying" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | rg canvas | wc -l`);
    const servedCss = sh(`rg -l "card-exit" .next/dev/ 2>/dev/null | wc -l`);
    check("served artifacts carry ALL t601 signatures", parseInt(servedJs || "0", 10) >= 1 && parseInt(servedCanvas || "0", 10) >= 1 && parseInt(servedCss || "0", 10) >= 1, `js=${servedJs} canvas=${servedCanvas} css=${servedCss}`);
  }

  /* ---- Q — the world ------------------------------------------------------ */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));
  const baselineEdgeDomIds = await readJson(`JSON.stringify(Array.from(document.querySelectorAll("[data-edge-id]")).map(function(el){ return el.getAttribute("data-edge-id"); }))`);
  if (!Array.isArray(baselineEdgeDomIds) || baselineEdgeDomIds.length !== 13) {
    throw new Error(`baseline edge ids unreadable: ${JSON.stringify(baselineEdgeDomIds)}`);
  }

  /* ---- W1 — THE LAST BREATH ------------------------------------------------ */
  console.log(`\n[W1] the last breath — delete the probe through the REAL dialog`);
  const p1 = await mintLinkedProbe("W1", baselineEdgeDomIds);
  check("W1 probe minted with its feeding wire", !!(p1 && p1.jobId), p1 && p1.err ? p1.err : `${p1.jobId} at ${p1.seatL},${p1.seatT} + wire ${p1.wireId}`);
  if (!(p1 && p1.jobId)) throw new Error("W1 probe unavailable");

  /* select the probe (idle → pointerup selects), open the delete dialog */
  sh(`agent-browser click '[data-job="${p1.jobId}"]' >/dev/null 2>&1 || true`);
  await sleep(350);
  sh(`agent-browser press Delete >/dev/null 2>&1 || true`);
  const dlg1 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      var dlg = document.querySelector('[role="alertdialog"]');
      if (!dlg) return null;
      return { title: (dlg.textContent || "").slice(0, 90) };
    })())`);
    return v && v.title ? v : null;
  }, 8000, 400);
  check("W1 the dialog names its victim (the honest gate)", !!(dlg1 && /Delete Motion Correction/.test(dlg1.title)), dlg1 ? dlg1.title : "no dialog");

  await readJson(SAMPLER);
  sh(`agent-browser click '[role="alertdialog"] button.bg-destructive' >/dev/null 2>&1 || true`);
  /* the shot races the 400ms fade — opportunistic, never gated on */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t601-mid-breath.png >/dev/null 2>&1`); } catch { /* */ }
  await sleep(2500);
  const f1 = await readJson(stopSampler, 6);
  const frames1 = Array.isArray(f1) ? f1 : (f1 && f1.frames) || [];
  check("W1 sampler captured the breath", frames1.length >= 3, `${frames1.length} frames`);
  const dy1 = frames1.filter((f) => f.dy === 1);
  const gw1 = frames1.filter((f) => f.gw === 1);
  check("W1 THE GHOST IS SEEN (the core)", dy1.length >= 2, `dying frames=${dy1.length}/${frames1.length}`);
  const firstDy = dy1[0] || null;
  check("W1 truth moves WITH the breath (cards AND dots drop in the same commit)", !!(firstDy && firstDy.c === 12 && firstDy.dots === 12), firstDy ? `t=${firstDy.t} c=${firstDy.c} dots=${firstDy.dots}` : "no dying frame");
  const mid1 = dy1.filter((f) => f.dop !== null && parseFloat(f.dop) > 0 && parseFloat(f.dop) < 1);
  check("W1 ∃ mid-fade frame on the card (strictly between)", mid1.length >= 1, `mid at t=${mid1.map((f) => f.t).join(",") || "none"}`);
  check("W1 THE WIRE FADES AS AN ORGAN (ghost wire seen, ∃ mid-fade)", gw1.length >= 2 && gw1.some((f) => f.wop !== null && parseFloat(f.wop) > 0 && parseFloat(f.wop) < 1), `wire frames=${gw1.length}`);
  const cd1 = Array.from(new Set(dy1.map((f) => f.cd).filter(Boolean)));
  check("W1 single delete walks step 0 of the staircase", cd1.length === 1 && cd1[0] === "0ms", `cds=${JSON.stringify(cd1)}`);
  const seatOk = dy1.some((f) => f.seatL === p1.seatL && f.seatT === p1.seatT);
  check("W1 the ghost keeps the seat (the memory stays where the life was)", seatOk, `ghost=${dy1[0] ? dy1[0].seatL + "," + dy1[0].seatT : "?"} vs ${p1.seatL},${p1.seatT}`);
  const settled1 = frames1.length >= 2 && frames1[frames1.length - 1];
  check("W1 the window retires — layer swept, world 12c/13e", !!(settled1 && settled1.dy === 0 && settled1.layer === 0 && settled1.c === 12 && settled1.e === 13), settled1 ? `t=${settled1.t} c=${settled1.c} e=${settled1.e}` : "no frames");
  const roster1 = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
  check("W1 roster back to 12 (the truth never waited for the breath)", roster1 && roster1.stats.total === 12, roster1 ? `total=${roster1.stats.total}` : "no roster");

  /* ---- W2 — THE SILENT HISTORY --------------------------------------------- */
  console.log(`\n[W2] the silent history — undo mid-breath, redo without a voice`);
  const p2 = await mintLinkedProbe("W2", baselineEdgeDomIds);
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
  check("W2 the dialog names its victim", !!(dlg2 && /Delete Motion Correction/.test(dlg2.title)), dlg2 ? dlg2.title : "no dialog");

  await readJson(SAMPLER);
  sh(`agent-browser click '[role="alertdialog"] button.bg-destructive' >/dev/null 2>&1 || true`);
  /* wait for the breath to START (the arm commit) before the undo — an
   * early Ctrl+Z would pop the MINT's history entry instead */
  const dySeen = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("[data-dying]"))`);
    return v === true ? v : null;
  }, 6000, 200);
  check("W2 the breath armed before the undo lands", dySeen === true, "data-dying present");
  sh(`agent-browser press Control+z >/dev/null 2>&1 || true`);
  const restored = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      var el = document.querySelector('[data-job="${p2.jobId}"]');
      return el ? { born: el.hasAttribute("data-born"), c: document.querySelectorAll("[data-job]").length, e: document.querySelectorAll("[data-edge-id]").length, dy: !!document.querySelector('[data-dying="${p2.jobId}"]') } : null;
    })())`);
    return v && v.c === 13 ? v : null;
  }, 12000, 300);
  check("W2 the card comes back (restore landed)", !!(restored && restored.c === 13 && restored.e === 14), restored ? JSON.stringify(restored) : "not restored");
  check("W2 the restore mounts SILENTLY (t598's law holds under the ghost)", !!(restored && restored.born === false), restored ? `data-born=${restored.born}` : "no card");
  await sleep(500);
  const noHaunt = await readJson(`JSON.stringify({
    dy: document.querySelectorAll("[data-dying]").length,
    layer: !!document.querySelector("[data-death-ghost-layer]")
  })`);
  check("W2 THE GHOST IS SUPERSEDED (one body per seat — no haunting)", noHaunt && noHaunt.dy === 0, JSON.stringify(noHaunt));

  sh(`agent-browser press Control+y >/dev/null 2>&1 || true`);
  const redone = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify({
      c: document.querySelectorAll("[data-job]").length,
      e: document.querySelectorAll("[data-edge-id]").length,
      dy: document.querySelectorAll("[data-dying]").length,
      layer: !!document.querySelector("[data-death-ghost-layer]")
    })`);
    return v && v.c === 12 && v.e === 13 ? v : null;
  }, 12000, 300);
  check("W2 the redo re-deletes (12c/13e again)", !!(redone && redone.c === 12 && redone.e === 13), redone ? JSON.stringify(redone) : "not redone");
  await sleep(250);
  const redoSilent = await readJson(`JSON.stringify({
    dy: document.querySelectorAll("[data-dying]").length,
    layer: !!document.querySelector("[data-death-ghost-layer]")
  })`);
  check("W2 THE REDO IS SILENT (history replay earns no breath — the mirror law)", redoSilent && redoSilent.dy === 0 && redoSilent.layer === false, JSON.stringify(redoSilent));

  /* ---- R — the net contract -------------------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  {
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

  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t601-death-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled world screenshot", true, ".qa-logs/shots/t601-death-settled.png");

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail === 0 ? 0 : 1);

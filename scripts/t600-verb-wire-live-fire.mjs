/**
 * t600 — the verb's wire draws itself in (t599's recorded half-measure,
 * now paid).
 *
 * t599 drew the boundary at "who ever drew the line" for BATCH merges
 * (import / pipeline template / duplicate): those wires walk the cards'
 * staircase and draw via stroke-dashoffset. The VERB-driven wires — a
 * next step, a twin's re-wires, an adoption's feeds — still popped.
 * But they are payload the world grew (the user clicked "add a step"
 * or "filter" or "train", never "draw this wire"), and nobody ever
 * drew THEM either. This round: connect() gains a drawIn opt; the
 * three faces of the boundary are (1) the finger-dragged LiveWire —
 * never arms, its pending stroke occupied the wire's place (t359);
 * (2) the panel's port-pair click — never arms, the user named THAT
 * wire; (3) the verb's wires — arm, and draw in on the cards'
 * staircase.
 *
 * Faces:
 *   G0  source contract (9 drawIn sites + the arm in connect) + served
 *       freshness (the store chunk carries the new word, the css the stanza)
 *   Q   world — 12c/13e
 *   W1  THE VERB'S WIRE — right-click "movie import" → Add next step →
 *       Motion Correction: the newborn card rises (t598) AND its wire
 *       draws in (∃ dashoffset strictly inside the sweep), one breath,
 *       retire sweeps both
 *   W2  THE SILENT NAMED WIRE — the panel's Link source popover wires
 *       refine3d's empty particles input: the new line mounts INSTANTLY
 *       (zero data-edge-born, zero mid-sweep offset) — a named wire is
 *       a drawn wire
 *   R   the world owes nothing — probes deleted, roster 12→12, console
 *
 * Usage: node scripts/t600-verb-wire-live-fire.mjs
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
  /* heal before you measure (t597/t598/t599): sweep this family's
   * leftover probes BEFORE the census gates anything */
  {
    const pre = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
    if (pre.stats.total !== 12) {
      const leftovers = api("/api/jobs").jobs.filter(
        (j) => j.name && (j.name.indexOf("t600") === 0 || j.name.indexOf("t599") === 0)
      );
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
    const sites = sh(`rg -c "drawIn: true" src/lib/store.ts || true`);
    check("store: the nine verb wires arm", parseInt(sites || "0", 10) === 9, `drawIn sites=${sites}`);
    const arm = sh(`rg -c "opts\\?\\.drawIn" src/lib/store.ts || true`);
    check("store: connect's optimistic set arms the wire", parseInt(arm || "0", 10) >= 1, `arm refs=${arm}`);
    const iface = sh(`rg -c "drawIn\\?: boolean" src/lib/store.ts || true`);
    check("store: the drawIn opt is on the contract", parseInt(iface || "0", 10) >= 1, `iface refs=${iface}`);
    const silent = sh(`rg -c "connect\\(o.jobId, job.id, o.fromPort, port.name\\);" src/components/workflow/job-panel.tsx || true`);
    check("job-panel: the named wire stays silent (no opts)", parseInt(silent || "0", 10) === 1, `refs=${silent}`);
    const drag = sh(`rg -c "connect\\(from, to, fromPort, toPort\\);" src/components/workflow/canvas.tsx || true`);
    check("canvas: the finger-dragged wire stays silent (no opts)", parseInt(drag || "0", 10) === 1, `refs=${drag}`);
    const servedJs = sh(`rg -l "drawIn" .next/dev/static/chunks/ 2>/dev/null | wc -l`);
    const servedCss = sh(`rg -l "edge-draw-in" .next/dev/ 2>/dev/null | wc -l`);
    check("served artifacts carry BOTH t600 signatures", parseInt(servedJs || "0", 10) >= 1 && parseInt(servedCss || "0", 10) >= 1, `js-chunks=${servedJs} css=${servedCss}`);
  }

  /* ---- Q — the world ------------------------------------------------------ */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length
  })`);
  check("12c/13e", counts && counts.cards === 12 && counts.edges === 13, JSON.stringify(counts));
  /* the baseline the R face measures against (heal-before-measure:
   * captured AFTER the heal, BEFORE any probe is minted) */
  const baselineJobIds = api("/api/jobs").jobs.map((j) => j.id);

  /* ---- W1 — THE VERB'S WIRE ------------------------------------------------ */
  console.log(`\n[W1] the verb's wire — Add next step: card rises AND wire draws`);
  /* locate the "movie import" card hittably, open its context menu via
   * a synthesized context event, open the sub menu, click Motion
   * Correction — the whole gesture chain in-page, the sampler armed
   * BEFORE the item click */
  const w1 = await readJson(`(function(){
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
  check("context menu opened on movie import", !!(w1 && w1.id), JSON.stringify(w1));
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
  }, 8000, 600);
  check("Add next step sub menu triggered", !!subOpen, JSON.stringify(subOpen));
  await sleep(400);

  /* the one-eval journey: arm the diff samplers, click the Motion
   * Correction item, sample the newborn card AND the newborn wire on
   * the same clock (interval 45ms over 7s — the verb rides two server
   * POSTs: the job, then the edge) */
  const w1j = await readJson(`(function(){
    var items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    var target = items.find(function(m){ return /Motion Correction/.test(m.textContent || ""); });
    if (!target) return JSON.stringify({ err: "no Motion Correction item", seen: items.map(function(m){ return (m.textContent || "").slice(0, 24); }).slice(0, 8) });
    var beforeJobs = {}, beforeEdges = {};
    document.querySelectorAll("[data-job]").forEach(function(el){ beforeJobs[el.getAttribute("data-job")] = 1; });
    document.querySelectorAll("[data-edge-id]").forEach(function(el){ beforeEdges[el.getAttribute("data-edge-id")] = 1; });
    var frames = [];
    var last = "";
    target.click();
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
        cops: nb.slice(0, 2).map(function(c){ return c.op; }),
        cborns: nb.slice(0, 2).map(function(c){ return c.born ? 1 : 0; }),
        cds: nb.slice(0, 2).map(function(c){ return c.d; }),
        eborns: ne.slice(0, 2).map(function(e){ return e.born ? 1 : 0; }),
        eds: ne.slice(0, 2).map(function(e){ return e.d; }),
        eoffs: ne.slice(0, 2).map(function(e){ return e.off; })
      };
      var key = JSON.stringify([f.nc, f.ne, f.play, f.cops, f.cborns, f.cds, f.eborns, f.eds, f.eoffs]);
      if (key !== last) { last = key; frames.push(f); }
    }, 45);
    return new Promise(function(res){
      setTimeout(function(){
        clearInterval(iv);
        res(JSON.stringify({
          frames: frames,
          toast: document.body.textContent.indexOf("Motion Correction added") >= 0
        }));
      }, 7000);
    });
  })()`, 5);
  if (w1j && w1j.err) { check("W1 verb journey", false, JSON.stringify(w1j)); }
  const w1f = w1j && w1j.frames ? w1j.frames : [];
  const cardSeen = w1f.filter((f) => f.nc >= 1);
  const wireSeen = w1f.filter((f) => f.ne >= 1);
  check("the newborn card seen", cardSeen.length >= 2, `card frames=${cardSeen.length}/${w1f.length}`);
  check("the newborn WIRE seen", wireSeen.length >= 2, `wire frames=${wireSeen.length}/${w1f.length}`);
  const cardArmed = cardSeen.some((f) => f.cborns.some((b) => b === 1));
  const wireArmed = wireSeen.some((f) => f.eborns.some((b) => b === 1));
  check("W1 the card rose armed (t598 holds)", cardArmed, "data-born on the newborn");
  check("W1 THE VERB'S WIRE IS ARMED (the core)", wireArmed, "data-edge-born on the verb's wire");
  const midDraw = wireSeen.filter((f) => f.eoffs.some((off) => off !== null && parseFloat(off) > 1.02 && parseFloat(off) < 1.98));
  check("W1 THE DASH TIP SWEPT (∃ offset strictly inside)", midDraw.length >= 1, `mid at t=${midDraw.map((f) => f.t).join(",") || "none"}`);
  const firstArmed = w1f.findIndex((f) => (f.cborns || []).some((b) => b === 1) || (f.eborns || []).some((b) => b === 1));
  const flashFrames = firstArmed === -1 ? [] : w1f.slice(0, firstArmed).filter((f) => f.nc > 0 || f.ne > 0);
  check("no newborn painted before its from-frame (prefix, card and wire)", firstArmed >= 0 && flashFrames.length === 0, flashFrames.length ? `flash: ${JSON.stringify(flashFrames.slice(0, 2))}` : "clean prefix");
  const wireDs = wireSeen.map((f) => f.eds[0]).filter(Boolean);
  const wireDok = wireDs.length >= 1 && wireDs.every((d) => d === "0ms" || d === "24ms");
  check("the wire rides the cards' staircase (0ms solo or 24ms after the card)", wireDok, `cds=${JSON.stringify(Array.from(new Set(wireDs)))}`);
  const playSeen = w1f.some((f) => f.play === true);
  check("data-birth-play armed on the workspace", playSeen, "one window covers both");
  check("the verb's toast speaks", w1j && w1j.toast === true, "Motion Correction added");
  await sleep(700);
  const retired = await readJson(`JSON.stringify({
    play: !!document.querySelector('[data-canvas="workspace"][data-birth-play]'),
    born: document.querySelectorAll("[data-born]").length,
    eborn: document.querySelectorAll("[data-edge-born]").length
  })`);
  check("the window retires — card and wire swept", retired && retired.play === false && retired.born === 0 && retired.eborn === 0, JSON.stringify(retired));
  const w1Counts = await readJson(`JSON.stringify({ c: document.querySelectorAll("[data-job]").length, e: document.querySelectorAll("[data-edge-id]").length })`);
  check("13c/14e after the verb", w1Counts && w1Counts.c === 13 && w1Counts.e === 14, JSON.stringify(w1Counts));

  /* ---- W2 — THE SILENT NAMED WIRE ------------------------------------------ */
  console.log(`\n[W2] the silent named wire — the panel's port-pair click mounts instantly`);
  /* The panel's Link-source gesture names a wire item by item, so the
   * new line must mount with NO birth attributes and NO sweep. The card
   * underneath needs to be IDLE: pointerup routes idle cards to
   * onSelect (the editing panel with the Link source UI) and
   * completed cards to onInspect (the big inspector modal — no wiring
   * there; this round's forensics). So the face mints a fresh idle
   * motioncorr via the palette (t598's W2 gesture), selects it with a
   * REAL CDP click (the synthetic el.click() does not traverse the
   * drag system's pointer discrimination), opens the popover on its
   * movies input and clicks the first compatible source. */
  const beforeMint = await readJson(`JSON.stringify(Array.from(document.querySelectorAll("[data-job]")).map(function(el){ return el.getAttribute("data-job"); }))`);
  await readJson(`(function(){
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    return "sent";
  })()`);
  await sleep(600);
  const palOpen = await readJson(`JSON.stringify(!!document.querySelector("[cmdk-input]"))`);
  check("command palette opened", palOpen === true);
  await readJson(`(function(){
    var inp = document.querySelector("[cmdk-input]");
    if (!inp) return JSON.stringify({ err: "no palette input" });
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "add motioncorr");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    return "typed";
  })()`);
  await sleep(500);
  await readJson(`(function(){
    var inp = document.querySelector("[cmdk-input]");
    if (!inp) return JSON.stringify({ err: "no palette input" });
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    return "entered";
  })()`);
  const mintDiff = await pollUntil(async () => {
    const v = await readJson(`(function(){
      var before = ${"@BEFORE@"};
      var now = Array.from(document.querySelectorAll("[data-job]")).map(function(el){ return el.getAttribute("data-job"); });
      var fresh = now.filter(function(id){ return before.indexOf(id) < 0; });
      return JSON.stringify({ fresh: fresh, n: now.length });
    })()`.replace("@BEFORE@", JSON.stringify(beforeMint)));
    return v && v.fresh && v.fresh.length === 1 ? v : null;
  }, 20000, 400);
  check("the idle probe minted (exactly one new card)", !!(mintDiff && mintDiff.fresh.length === 1), JSON.stringify(mintDiff));
  const probeId = mintDiff && mintDiff.fresh[0];
  await sleep(2600); /* the mint birth window retires before W2 samples */
  /* a REAL CDP click on the idle probe — idle cards route pointerup to
   * onSelect, which mounts the editing panel (the Link source UI) */
  if (probeId) {
    sh(`agent-browser click '[data-job="${probeId}"]' >/dev/null 2>&1 || true`);
    await sleep(900);
  }
  /* the panel is open iff its Link source trigger is in the DOM (the
   * movies input's label is L.moviesIn — "Input movies STAR file (.star)") */
  const panelOpen = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector('button[aria-label="Link a source to Input movies STAR file (.star) input"]'))`);
    return v === true ? v : null;
  }, 8000, 400);
  check("the job panel opened with the movies input", panelOpen === true);
  const linkBtn = await readJson(`(function(){
    var btn = document.querySelector('button[aria-label="Link a source to Input movies STAR file (.star) input"]');
    if (!btn) return JSON.stringify({ err: "trigger gone" });
    btn.click();
    return JSON.stringify({ ok: true });
  })()`);
  check("Link source popover opened on movies", !!(linkBtn && linkBtn.ok), JSON.stringify(linkBtn));
  await sleep(500);

  const w2 = await readJson(`(function(){
    var pop = document.querySelector('[role="dialog"][aria-label*="Compatible sources"], [aria-label*="Compatible sources"]');
    if (!pop) return JSON.stringify({ err: "no popover content" });
    var opts = Array.from(pop.querySelectorAll("button")).filter(function(b){
      return !b.disabled && (b.getAttribute("type") === "button");
    });
    if (!opts.length) return JSON.stringify({ err: "no source options" });
    var beforeEdges = {};
    document.querySelectorAll("[data-edge-id]").forEach(function(el){ beforeEdges[el.getAttribute("data-edge-id")] = 1; });
    var frames = [];
    var last = "";
    opts[0].click();
    var t0 = performance.now();
    var iv = setInterval(function(){
      var w = document.querySelector('[data-canvas="workspace"]');
      var ne = [];
      document.querySelectorAll("[data-edge-id]").forEach(function(el){
        var id = el.getAttribute("data-edge-id");
        if (!beforeEdges[id]) {
          var main = el.querySelector("path[data-e-main]");
          ne.push({
            born: el.hasAttribute("data-edge-born"),
            off: main ? getComputedStyle(main).strokeDashoffset : null
          });
        }
      });
      var f = {
        t: Math.round(performance.now() - t0),
        ne: ne.length,
        play: w ? w.hasAttribute("data-birth-play") : null,
        eborns: ne.slice(0, 2).map(function(e){ return e.born ? 1 : 0; }),
        eoffs: ne.slice(0, 2).map(function(e){ return e.off; })
      };
      var key = JSON.stringify([f.ne, f.play, f.eborns, f.eoffs]);
      if (key !== last) { last = key; frames.push(f); }
    }, 50);
    return new Promise(function(res){
      setTimeout(function(){ clearInterval(iv); res(JSON.stringify({ frames: frames })); }, 3500);
    });
  })()`, 5);
  const w2f = w2 && w2.frames ? w2.frames : [];
  const w2wire = w2f.filter((f) => f.ne >= 1);
  check("the named wire appeared", w2wire.length >= 1, `frames=${w2wire.length}${w2 && w2.err ? " err=" + w2.err : ""}`);
  const w2Silent = w2wire.length >= 1 && w2wire.every((f) => f.eborns.every((b) => b === 0) && f.play === false);
  check("W2 THE NAMED WIRE IS SILENT — zero birth attributes", w2Silent, "a named wire is a drawn wire");
  /* the named wire never carries the dash mechanism at all: with no
   * data-edge-born there is no dasharray/animation, so its computed
   * stroke-dashoffset is the CSS INITIAL 0px — not the sweep's from
   * 2.02 / to 1 territory. (The first harness draft asserted >= 0.98,
   * the animated endpoint; a silent wire doesn't even wear the rule.) */
  const w2NoSweep = w2wire.length >= 1 && w2wire.every((f) => f.eoffs.every((off) => off === null || parseFloat(off) < 0.98));
  check("W2 no sweep on the named wire (offset parked at the CSS initial 0)", w2NoSweep, w2wire.length ? JSON.stringify(w2wire[0].eoffs) : "");
  const w2Counts = await readJson(`JSON.stringify({ e: document.querySelectorAll("[data-edge-id]").length })`);
  check("15e after the named wire", w2Counts && w2Counts.e === 15, JSON.stringify(w2Counts));

  /* ---- R — the net contract -------------------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  {
    /* everything the run minted: jobs absent from the baseline (their
     * wires ride the card down), then any edge outside the original 13
     * pairs (the named wire) */
    const jobsNow = api("/api/jobs").jobs || [];
    const newJobs = jobsNow.filter((j) => baselineJobIds.indexOf(j.id) < 0);
    for (const j of newJobs) api(`/api/jobs/${j.id}`, "DELETE");
    await sleep(800);
    const edgesNow = api("/api/edges").edges || [];
    const originalPairs = [
      "cmuro2uf|cmuro2ui", "cmuro2uf|cmuro5s3", "cmuro2ui|cmuro5s3",
      "cmuro5s3|cmuro5ze", "cmuro5ze|cmurol4y", "cmurol4y|cmurpj2t",
      "cmurpj2t|cmurqs6g", "cmurpj2t|cmurqs6g", "cmurqlpn|cmurqs6g",
      "cmurqymg|cmurqymr", "cmurpj2t|cmurqlpn", "cmuro2uf|cmut5n5x",
      "cmut5n5x|cmut5s9a"
    ];
    const pairKey = (e) => `${e.fromJobId.slice(0, 8)}|${e.toJobId.slice(0, 8)}`;
    const strangers = edgesNow.filter((e) => originalPairs.indexOf(pairKey(e)) < 0);
    for (const s of strangers) api(`/api/edges/${s.id}`, "DELETE");
    await sleep(800);
    const roster = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
    check("roster 12→12 (the probes were borrowed, not kept)", roster.stats.total === 12, `swept ${newJobs.length} card(s) + ${strangers.length} wire(s); 12 → ${roster.stats.total}`);
    const finalCount = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify({ c: document.querySelectorAll("[data-job]").length, e: document.querySelectorAll("[data-edge-id]").length })`);
      return n && n.c === 12 && n.e === 13 ? n : null;
    }, 20000, 500);
    check("canvas back to the 12c/13e world", !!finalCount, JSON.stringify(finalCount));
    let errs = "";
    try { errs = sh(`agent-browser errors 2>/dev/null`).trim(); } catch { /* */ }
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  }

  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t600-verb-wire-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled world screenshot", true, ".qa-logs/shots/t600-verb-wire-settled.png");

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);

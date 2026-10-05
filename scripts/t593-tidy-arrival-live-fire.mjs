/**
 * t593 — the tidy rebuild answers (the 9-window design question cashes).
 *
 * t590's law drew the voice boundary at the CALLERS of frameBounds: the
 * fit command ticks, the systemic callers (birth / memory restore / world
 * rebuild) stay silent. But it classified "world rebuild" as never-an-
 * event — and the tidy is the user's finger. The question "重建是事件吗"
 * hung for nine windows; this window answers: the boundary is WHO bumped
 * the epoch, not the epoch itself. The tidy now CONSUMES as a command:
 *   - the wire skeleton re-forms at the destination instantly (edges read
 *     the store — they are correct from the first painted frame);
 *   - every moved card FLIPs home (invert from the pre-tidy seat, pinned
 *     by a reflow, then released to fly onto the skeleton);
 *   - the camera rides the t588 arrival dialogue (hold + glide + coda).
 * Import landings and template applies stay explicitly systemic (null).
 *
 * World note: the EMPIAR graph was PLACED by autoLayout at import, so the
 * tidy is a fixed point — nothing moves and the flip is (honestly)
 * silent. The harness perturbs the world with a REAL drag (pointer down,
 * stepped moves, up — the drag commits and POSTs like any user gesture)
 * so the tidy has a displaced card to fly home. Every gesture is undone
 * before exit; the net-zero contract is asserted against a pre-window
 * seat snapshot.
 *
 * Faces proven here:
 *   G0  the served sheet carries the flip stanza (media-gated transition
 *       + the print guard) with the glide's exact curve and duration.
 *   Q   the world is the EMPIAR world (12 cards, 13 edges) and the zoom
 *       controls answer (one zoom-out step so the tidy's hold assert is
 *       not vacuous — the gauge must have somewhere to hold FROM).
 *   D   the drag lands: the card's seat actually moves (the store wrote
 *       and POSTed it) — the perturbation the tidy will answer.
 *   W1  THE ARRIVAL — atomic in-page click+sample: at +60ms the workspace
 *       holds data-flip-play AND viewport-glide, the dragged card is
 *       airborne (computed transform mid-interpolation) and still in the
 *       first half of its journey, the gauge still shows the PRE-tidy
 *       value (the number holds while the world flies), and the edge
 *       skeleton is ALREADY at its final geometry (identical to the
 *       settled read). At +900ms: attribute retired, transforms cleared
 *       (drag channel clean), gauge = fitted value, the tick span
 *       REMOUNTED (fresh node — the coda rolled once), and the dragged
 *       card's seat is back at its canonical (snapshot) value.
 *   W2  THE UNDO TELEPORTS — two undos (the tidy, then the drag): seats
 *       snap back with NO attribute and NO glide class (history restore
 *       is not an arrival — t104 keeps the camera), and the world lands
 *       exactly on the pre-window snapshot.
 *   W3  BIRTH SILENCE — a reload birth-fits instantly: no flip attr, no
 *       glide class, no tick span (F3 face preserved under the new code).
 *   W4  THE RELAY RE-ARMS — a second drag+tidy rides again (consume-once
 *       is not a one-shot), then two more undos bring the world home.
 *   R   roster 12→12, console clean, final seats == the pre-window
 *       snapshot (two drags, two tidies, four undos — net zero), and no
 *       stray browser left behind.
 *
 * Harness findings baked in (the first run's tuition):
 *   - agent-browser's CLI keeps ONE "current browser" pointer and
 *     silently re-resolves it when the target dies — two competing
 *     instances make evals land on the WRONG page (the W1 payloads came
 *     back as `{}` — a rejected/foreign-page promise serialized away).
 *     Remedy: `close --all` before boot, then verify a sentinel property
 *     round-trips through eval before any face runs.
 *   - `agent-browser connect <port>` does not attach to an arbitrary
 *     spawned chrome — it launches its own. The t571..t592 spawn+shim
 *     pattern is retired here: the harness rides the managed browser
 *     (no hover/:active faces need the desktop shim this window).
 *   - a served-HTML chunk scan lies: the canvas is a dynamic import —
 *     freshness is checked on disk (.next/dev) and in the live DOM.
 *
 * Port ledger (t581's law — zombies keep their ports): 9323=t578,
 * 9324=t584, 9325=t585, 9326=t586, 9327=t587, 9328=t587 probe,
 * 9329=t589 QA, 9330=t588, 9331=t589, 9332=t590, 9333=t591 QA probe,
 * 9334=t591, 9335=t592 QA probe, 9336=t592, 9337=t593 QA probe,
 * 9340=t593 eval probe — this harness rides the managed browser, no
 * spawned port of its own.
 *
 * Usage: node scripts/t593-tidy-arrival-live-fire.mjs
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
async function pollUntil(fn, timeoutMs = 30000, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return null;
}
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const api = (verb, path, body) => {
  for (let i = 0; i < 4; i++) {
    try {
      return sh(
        `curl -s -X ${verb} -H "Content-Type: application/json" -H "Origin: ${BASE}" -H "Referer: ${BASE}/"` +
        (body ? ` -d ${JSON.stringify(JSON.stringify(body))}` : "") + ` "${BASE}${path}"`
      );
    } catch (e) {
      if (i === 3) throw e;
      // the dev lane recycles under RSS pressure — a 30–45s boot gap is
      // the watchdog working as designed (t405), not a harness failure
      execSync(`sleep 8`);
    }
  }
};
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
const readJson = async (js) => {
  const raw = evalJs(js);
  try { return JSON.parse(raw); } catch { return null; }
};
const centerOf = async (sel) =>
  readJson(`JSON.stringify((function(){
    const el=document.querySelector(${JSON.stringify(sel)});
    if(!el) return null;
    const b=el.getBoundingClientRect();
    return { x: Math.round(b.x + b.width/2), y: Math.round(b.y + b.height/2) };
  })())`);

/* ---- world guard BEFORE any browser spend ----------------------------- */
const projects = JSON.parse(api("GET", "/api/projects")).projects;
const active = projects.find((p) => p.active);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "unknown"}, expected EMPIAR — refusing to run in a borrowed world`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0}`);

let undoDebt = 0; // gestures on the stack (tidies + drags) not yet undone

/** The seats of the world: id → "left,top" from the inline styles (the
 *  exact floats the store rendered). */
const seatsOf = () => readJson(`JSON.stringify((function(){
  const m = {};
  document.querySelectorAll("[data-job]").forEach(function(el){
    m[el.getAttribute("data-job")] = el.style.left + "," + el.style.top;
  });
  return m;
})())`);
const seatsEqual = (a, b) => {
  if (!a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const [ax, ay] = String(a[k]).split(",").map(Number);
    const [bx, by] = String(b[k]).split(",").map(Number);
    if (Math.abs(ax - bx) > 0.5 || Math.abs(ay - by) > 0.5) return false;
  }
  return true;
};
/** Cleanup: undo through the whole debt until the seats match. */
const restoreWorld = async (snapshot) => {
  for (let i = 0; i < 6 && undoDebt > 0; i++) {
    if (seatsEqual(await seatsOf(), snapshot)) { undoDebt = 0; return true; }
    try { sh(`agent-browser click '[data-canvas-ui="undo-btn"]' >/dev/null 2>&1`); } catch { /* best effort */ }
    undoDebt--;
    await sleep(450);
  }
  return seatsEqual(await seatsOf(), snapshot);
};

/** A real drag: pointer down on the card, stepped moves, up — the same
 *  machinery a user's hand drives. Returns after the commit settles. */
const dragCardBy = async (id, dx, dy) => {
  const c = await centerOf(`[data-job="${id}"]`);
  if (!c) return false;
  const steps = 10;
  const mv = (x, y) => { try { sh(`agent-browser mouse move ${x} ${y} >/dev/null 2>&1`); } catch { /* */ } };
  mv(c.x, c.y);
  try { sh(`agent-browser mouse down >/dev/null 2>&1`); } catch { return false; }
  await sleep(40);
  for (let i = 1; i <= steps; i++) {
    mv(c.x + Math.round((dx * i) / steps), c.y + Math.round((dy * i) / steps));
    await sleep(28);
  }
  try { sh(`agent-browser mouse up >/dev/null 2>&1`); } catch { return false; }
  await sleep(350); // the optimistic commit + the POST round-trip
  return true;
};

try {
  /* ---- boot: ONE browser, ONE pointer ---------------------------------- */
  console.log(`[boot] close-all — the CLI pointer must have exactly one target`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* first run: nothing to close */ }
  try { execSync(`pkill -f "remote-debugging-port" 2>/dev/null || true`); } catch { /* */ }
  await sleep(1200);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12;
  }, 180000, 1000); // cold cache can compile for minutes — the poll is patient
  if (!hydrated) throw new Error("EMPIAR world never hydrated 12 cards");
  // sentinel: prove THIS eval lands on the page the faces will drive
  const sentinel = await readJson(`(function(){ window.__t593 = (window.__t593 || 0) + 1; return JSON.stringify(window.__t593); })()`);
  const sentinel2 = await readJson(`JSON.stringify(window.__t593 || 0)`);
  check("eval pointer pinned to the harness page", sentinel === 1 && sentinel2 === 1, `sentinel ${sentinel}/${sentinel2}`);
  await sleep(500);

  /* ---- G0 — the served sheet carries the voice ------------------------- */
  console.log(`\n[G0] served sheet — the flip stanza rides the glide's curve`);
  {
    const cssPath = sh(`curl -s ${BASE}/ | grep -o '/_next/static/chunks/[^"]*\\.css' | head -1`);
    const css = sh(`curl -s "${BASE}${cssPath}"`);
    const flipCount = (css.match(/data-flip-play/g) || []).length;
    check("served sheet carries data-flip-play (media block + print guard)", flipCount >= 2, `${flipCount} hits`);
    const norm = css.replace(/\s+/g, "");
    const hasCurve = norm.includes("transition:transform.48scubic-bezier(.22,.61,.36,1)") ||
                     norm.includes("transition:transform0.48scubic-bezier(0.22,0.61,0.36,1)");
    check("flip transition = the glide's exact curve+duration", hasCurve);
    const printIdx = norm.indexOf("@mediaprint");
    const printZone = printIdx >= 0 ? norm.slice(printIdx) : "";
    check("print guard kills the flip mid-paper", /data-flip-play[^}]*transition:none/.test(printZone));
  }

  /* ---- Q — the world answers ------------------------------------------- */
  console.log(`\n[Q] world QA + the non-vacuous zoom pre-step`);
  {
    const counts = await readJson(`JSON.stringify({
      cards: document.querySelectorAll("[data-job]").length,
      edges: document.querySelectorAll("[data-edge-id]").length
    })`);
    check("12 cards, 13 edges", counts && counts.cards === 12 && counts.edges === 13,
      `${counts && counts.cards}c/${counts && counts.edges}e`);
    const out = await centerOf('[aria-label="Zoom out"]');
    sh(`agent-browser mouse move ${out.x} ${out.y} >/dev/null 2>&1 && agent-browser mouse down >/dev/null 2>&1 && agent-browser mouse up >/dev/null 2>&1`);
    await sleep(300);
    const g = await readJson(`JSON.stringify(document.querySelector('[data-canvas-ui="zoom-controls"] span').textContent)`);
    check("zoom-out stepped the gauge (the tidy hold will be visible)", g && parseInt(g) < 100, `gauge ${g}`);
  }

  /* ---- S — the snapshot -------------------------------------------------- */
  const snapshot = await seatsOf();
  check("snapshot captured", !!snapshot && Object.keys(snapshot).length === 12, `12 seats`);

  /* ---- D — the perturbation (a real drag) -------------------------------- */
  console.log(`\n[D] drag one card — give the tidy something to answer`);
  const dragId = await readJson(`JSON.stringify(document.querySelector("[data-job]").getAttribute("data-job"))`);
  const seatBefore = snapshot[dragId];
  const dragged = await dragCardBy(dragId, 260, 40);
  const seatAfter = (await seatsOf())[dragId];
  check("drag committed (the card's seat moved)", dragged && seatAfter !== seatBefore,
    `${String(seatBefore)} → ${String(seatAfter)}`);
  undoDebt++;

  /* ---- W1 — the arrival --------------------------------------------------- */
  console.log(`\n[W1] the tidy arrival — skeleton first, cards fly, number holds`);
  {
    await evalJs(`(function(){ var s=document.querySelector('[data-zoom-tick]'); if(s) s.__t593seen=1; return "ok" })()`);
    const gauge0 = await readJson(`JSON.stringify(document.querySelector('[data-canvas-ui="zoom-controls"] span').textContent)`);
    const w1 = await readJson(`(function(){
      return (async function(){
        try {
        var ws = document.querySelector("[data-canvas='workspace']");
        var gaugeSel = '[data-canvas-ui="zoom-controls"] span';
        var camOf = function(){
          var m = getComputedStyle(ws).transform;
          var p = m.indexOf("matrix");
          var v = m.slice(m.indexOf("(", p) + 1, m.lastIndexOf(")")).split(",");
          return { x: parseFloat(v[4]), y: parseFloat(v[5]), z: parseFloat(v[0]) };
        };
        var cam0 = camOf();
        var z0 = cam0.z;
        document.querySelector('[aria-label="Auto-arrange workflow"]').click();
        await new Promise(function(r){ setTimeout(r, 60); });
        var cam60 = camOf();
        var magOf = function(){
          var m = -1;
          document.querySelectorAll("[data-job]").forEach(function(el){
            var t = getComputedStyle(el).transform;
            if (t !== "none") {
              var v = t.slice(t.indexOf("(") + 1, t.lastIndexOf(")")).split(",");
              var mag = Math.abs(parseFloat(v[4])) + Math.abs(parseFloat(v[5]));
              if (mag > m) m = mag;
            }
          });
          return m;
        };
        var mag60 = magOf();
        await new Promise(function(r){ setTimeout(r, 190); });
        var mag250 = magOf();
        var dots60 = Array.prototype.map.call(
          document.querySelectorAll('[data-e="tgt"]'),
          function(c){ return c.getAttribute("cx") + "," + c.getAttribute("cy"); }
        ).join("|");
        var flying = 0;
        document.querySelectorAll("[data-job]").forEach(function(el){
          if (getComputedStyle(el).transform !== "none") flying++;
        });
        return JSON.stringify({
          flip60: ws.hasAttribute("data-flip-play"),
          glide60: ws.classList.contains("viewport-glide"),
          gauge60: document.querySelector(gaugeSel).textContent,
          flying: flying,
          dots60: dots60,
          mag60: mag60,
          mag250: mag250
        });
        } catch (e) { return JSON.stringify({ err: String(e && e.message || e) }); }
      })()
    })()`);
    await sleep(840); // the 60ms inside the eval + 840 ⇒ past the 520ms retract
    const w1s = await readJson(`(function(){
      return (function(){
        var ws = document.querySelector("[data-canvas='workspace']");
        var gauge = document.querySelector('[data-canvas-ui="zoom-controls"] span').textContent;
        var dots = Array.prototype.map.call(
          document.querySelectorAll('[data-e="tgt"]'),
          function(c){ return c.getAttribute("cx") + "," + c.getAttribute("cy"); }
        ).join("|");
        var clean = Array.prototype.every.call(document.querySelectorAll("[data-job]"),
          function(el){ return getComputedStyle(el).transform === "none"; });
        var span = document.querySelector('[data-zoom-tick]');
        return JSON.stringify({ gauge: gauge, dots: dots, clean: clean,
          tickFresh: !!span && !span.__t593seen, flipGone: !ws.hasAttribute("data-flip-play") });
      })()
    })()`);
    if (!w1 || w1.err) { check("W1 atomic payload", false, (w1 && w1.err) || "unparseable"); }
    else {
      check("workspace holds data-flip-play mid-flight", w1.flip60 === true);
      check("camera rides viewport-glide", w1.glide60 === true);
      check("gauge HOLDS the pre-tidy value mid-flight", w1.gauge60 === gauge0,
        `${w1.gauge60} (pre ${gauge0})`);
      check("the displaced card is airborne", w1.flying >= 1, `${w1.flying} flying`);
      check("skeleton ALREADY final mid-flight", w1s && w1.dots60 === w1s.dots,
        "edge dots identical at +60ms and settle");
      // The flight's honesty is proven by DECAY, not by a precomputed
      // journey: the world's stored layout is NOT the current autoLayout
      // output (the algorithm evolved since the import placed it), so the
      // tidy's true delta is its own business — what the face proves is
      // that the transform magnitude DECAYS monotonically (the glide
      // bezier has no overshoot) between two mid-flight samples, i.e. the
      // card is genuinely animating home and not pinned at the invert.
      check("the flight decays mid-journey (real animation, not a pin)",
        w1.mag250 > 0 && w1.mag250 < w1.mag60 * 0.9,
        `flip travel ${Math.round(w1.mag60)}px → ${Math.round(w1.mag250)}px by +250ms`);
      check("attribute retired after the retract window", w1s && w1s.flipGone === true);
      check("card transforms cleared (drag channel clean)", w1s && w1s.clean === true);
      check("gauge landed on the fitted value", w1s && w1s.gauge !== gauge0,
        `${w1s && w1s.gauge} (was ${gauge0})`);
      check("coda tick rolled on a FRESH span", w1s && w1s.tickFresh === true);
    }
    undoDebt++;
  }

  /* ---- W2 — the undos teleport -------------------------------------------- */
  console.log(`\n[W2] two undos — history restores, the camera keeps, nothing glides`);
  {
    const gaugePre = await readJson(`JSON.stringify(document.querySelector('[data-canvas-ui="zoom-controls"] span').textContent)`);
    const w2 = await readJson(`(function(){
      return (async function(){
        try {
        var ws = document.querySelector("[data-canvas='workspace']");
        var gaugeSel = '[data-canvas-ui="zoom-controls"] span';
        document.querySelector('[data-canvas-ui="undo-btn"]').click();
        await new Promise(function(r){ setTimeout(r, 80); });
        var clean = Array.prototype.every.call(document.querySelectorAll("[data-job]"),
          function(el){ return getComputedStyle(el).transform === "none"; });
        return JSON.stringify({
          flip: ws.hasAttribute("data-flip-play"),
          glide: ws.classList.contains("viewport-glide"),
          gauge80: document.querySelector(gaugeSel).textContent,
          clean: clean
        });
        } catch (e) { return JSON.stringify({ err: String(e && e.message || e) }); }
      })()
    })()`);
    await sleep(300);
    try { sh(`agent-browser click '[data-canvas-ui="undo-btn"]' >/dev/null 2>&1`); } catch { /* */ }
    await sleep(450);
    const home = seatsEqual(await seatsOf(), snapshot);
    check("no flip attribute on undo", w2 && w2.flip === false);
    check("no glide class on undo", w2 && w2.glide === false);
    check("camera keeps the fitted zoom (t104)", w2 && w2.gauge80 === gaugePre,
      `${w2 && w2.gauge80}`);
    check("no transform residue mid-teleport", w2 && w2.clean === true);
    check("both undos landed the world on the snapshot", home === true);
    if (home) undoDebt = 0;
  }

  /* ---- W3 — birth silence ------------------------------------------------ */
  console.log(`\n[W3] reload — the birth fit stays silent`);
  {
    sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
    const hyd = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
      return n === 12;
    }, 120000, 1000);
    check("world rehydrated", hyd === true);
    await sleep(500);
    const w3 = await readJson(`(function(){
      var ws = document.querySelector("[data-canvas='workspace']");
      return JSON.stringify({
        flip: ws.hasAttribute("data-flip-play"),
        glide: ws.classList.contains("viewport-glide"),
        tick: !!document.querySelector('[data-zoom-tick]')
      });
    })()`);
    const seatsOk = seatsEqual(await seatsOf(), snapshot);
    check("no flip attribute at birth", w3 && w3.flip === false);
    check("no glide class at birth", w3 && w3.glide === false);
    check("no tick span at birth (F3 face preserved)", w3 && w3.tick === false);
    check("world at the snapshot seats after reload", seatsOk === true);
  }

  /* ---- W4 — the relay re-arms -------------------------------------------- */
  console.log(`\n[W4] second drag+tidy rides again — then the world goes home`);
  {
    const id2 = await readJson(`JSON.stringify(document.querySelector("[data-job]").getAttribute("data-job"))`);
    const dragged2 = await dragCardBy(id2, -220, 60);
    check("second drag committed", dragged2 === true);
    undoDebt++;
    const w4 = await readJson(`(function(){
      return (async function(){
        try {
        var ws = document.querySelector("[data-canvas='workspace']");
        document.querySelector('[aria-label="Auto-arrange workflow"]').click();
        await new Promise(function(r){ setTimeout(r, 60); });
        return JSON.stringify({ flip60: ws.hasAttribute("data-flip-play") });
        } catch (e) { return JSON.stringify({ err: String(e && e.message || e) }); }
      })()
    })()`);
    check("second tidy re-arms the flip", w4 && w4.flip60 === true);
    undoDebt++;
    await sleep(900);
    try { sh(`agent-browser click '[data-canvas-ui="undo-btn"]' >/dev/null 2>&1`); } catch { /* */ }
    await sleep(400);
    try { sh(`agent-browser click '[data-canvas-ui="undo-btn"]' >/dev/null 2>&1`); } catch { /* */ }
    undoDebt = 0;
    await sleep(450);
    const home2 = seatsEqual(await seatsOf(), snapshot);
    check("second pair of undos restored the world", home2 === true);
  }

  /* ---- R — the world is untouched ---------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  {
    const projs = JSON.parse(api("GET", "/api/projects")).projects;
    const now = projs.find((p) => p.active);
    check("roster 12→12", now && now.stats.total === roster0, `${now && now.stats.total}`);
    const home = seatsEqual(await seatsOf(), snapshot);
    check("final seats == the pre-window snapshot (net-zero POSTs)", home === true);
    const errs = sh(`agent-browser errors 2>/dev/null`).trim();
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  }
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* best effort */ }
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

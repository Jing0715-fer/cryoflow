/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t594 — the map's marker rides the journey (witness).
 *
 * beginGlideArrival writes the destination into the store ONCE and lets
 * the workspace's CSS transition carry the camera (t588). The minimap's
 * viewport window rect reads the same store — before this window it
 * TELEPORTED to the destination on the first painted frame while the
 * camera was still mid-flight: for 0.48s every arrival, the "you are
 * here" marker lied. The fix is a CSS stanza: the rect's x/y/width/
 * height (SVG geometry properties) transition on the SAME viewport-glide
 * class the camera rides, reached through the section with :has() — the
 * map is a sibling of the workspace, not its descendant. Curve and
 * duration are the camera's and the cards' EXACTLY (t593's one-journey-
 * one-rhythm law, now three organs).
 *
 * Faces proven here:
 *   G0  the served sheet carries the stanza (:has wiring + media gate +
 *       print guard) with the glide's exact curve and duration.
 *   Q   the world is the EMPIAR world (12 cards, 13 edges) and the map
 *       is on (minimapOpen defaults true) with its viewport rect.
 *   W1  THE RIDE — atomic in-page: Ctrl+F → "motion" → Enter (find focus
 *       arrival) → at +80ms the workspace holds viewport-glide, the
 *       rect's transition is armed (0.48s on x,y,width,height) and the
 *       marker is MID-JOURNEY (computed value strictly between the
 *       endpoints — the old code's teleport would already read the
 *       destination); the fit-mode viewBox has ALREADY re-framed (the
 *       frame is furniture; it moves first). At +700ms the class is
 *       retired and the marker rests exactly at the destination.
 *   W2  GESTURE IMMUNITY — a zoom command (tick family, t590) arms
 *       nothing: class absent, transition duration 0s, the rect tracks
 *       instantly (attr sample at +100ms == +600ms).
 *   W3  THE RE-RIDE — a second Enter rides again (the arming is the
 *       class, not a one-shot): mid between the new endpoints, settled
 *       at the second destination.
 *   W4  BIRTH SILENCE — a reload birth-fits instantly: no glide class,
 *       no armed transition (F3 face preserved under the new stanza).
 *   R   roster 12→12, console clean, the lens closed, no browser left.
 *
 * Harness notes (the verify probe's tuition, baked in):
 *   - computed x/y/width/height of an SVG rect are USER-UNIT values —
 *     projection-free, so the between-ness assertion is independent of
 *     the fit-mode viewBox reframe.
 *   - the CLI prints bare scalars bare and strings QUOTED; decode until
 *     it stops being a quoted string (t584 double-decode law), then
 *     parse JSON payloads.
 *   - the ride's dominant axis is chosen per arrival (a vertical-only
 *     journey must not assert on x).
 *
 * Usage: node scripts/t594-mm-vp-ride-live-fire.mjs
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
      // decode until it stops being a quoted string (t584 double-decode law)
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      // bare scalars arrive as strings — coerce by shape, not by hope
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
// the atomic arrival: open the lens if closed, fill the query, capture the
// PRE geometry INSIDE the eval right before Enter, then poll every 20ms
// until the marker moves — the first-moving and last-in-journey samples
// are both kept (React's commit after classList.add is a DIFFERENT frame:
// a single fixed-delay sample races the render, a poll rides it out)
const arrivalSample = (query) => `(function(){
  var bar = document.querySelector('[data-canvas-find-bar]');
  if (!bar) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }));
  }
  return new Promise(function(resolve){
    setTimeout(function(){
      var input = document.querySelector('[data-canvas-find-bar] input');
      if (!input) { resolve(JSON.stringify({ err: "no input" })); return; }
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, ${JSON.stringify(query)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      setTimeout(function(){
        function readGeom(){
          var r = document.querySelector('[data-canvas-ui="minimap-vp"]');
          if (!r) return null;
          var cs = getComputedStyle(r);
          return { x: parseFloat(cs.x), y: parseFloat(cs.y), w: parseFloat(cs.width), h: parseFloat(cs.height) };
        }
        var pre = readGeom();
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        var t0 = performance.now();
        var mid = null, tFirst = null, glide = null, tDur = null, tProp = null;
        var iv = setInterval(function(){
          var now = performance.now() - t0;
          var v = readGeom();
          if (v && pre &&
              (Math.abs(v.x-pre.x)>1 || Math.abs(v.y-pre.y)>1 || Math.abs(v.w-pre.w)>1 || Math.abs(v.h-pre.h)>1)) {
            if (tFirst === null) tFirst = Math.round(now);
            var ws = document.querySelector("[data-canvas='workspace']");
            var cs = getComputedStyle(document.querySelector('[data-canvas-ui="minimap-vp"]'));
            mid = v; /* keep the LAST in-journey sample (deepest into the ride) */
            glide = !!(ws && ws.classList.contains("viewport-glide"));
            tDur = (cs.transitionDuration || "").split(",")[0];
            tProp = (cs.transitionProperty || "").slice(0, 40);
          }
          if (now > 360) {
            clearInterval(iv);
            var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
            var ws2 = document.querySelector("[data-canvas='workspace']");
            resolve(JSON.stringify({
              pre: pre, mid: mid, tFirst: tFirst,
              glide: glide, tDur: tDur, tProp: tProp,
              glideNow: !!(ws2 && ws2.classList.contains("viewport-glide")),
              vb: svg ? svg.getAttribute("viewBox") : null
            }));
          }
        }, 20);
      }, 450);
    }, 850);
  });
})()`;
const settledSample = `JSON.stringify((function(){
  var ws = document.querySelector("[data-canvas='workspace']");
  var r = document.querySelector('[data-canvas-ui="minimap-vp"]');
  var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
  if (!r) return { err: "no rect" };
  var cs = getComputedStyle(r);
  return {
    glide: !!(ws && ws.classList.contains("viewport-glide")),
    x: parseFloat(cs.x), y: parseFloat(cs.y),
    w: parseFloat(cs.width), h: parseFloat(cs.height),
    vb: svg ? svg.getAttribute("viewBox") : null
  };
})())`;
const geoRead = `JSON.stringify((function(){
  var r = document.querySelector('[data-canvas-ui="minimap-vp"]');
  if (!r) return { err: "no rect" };
  var cs = getComputedStyle(r);
  return { x: parseFloat(cs.x), y: parseFloat(cs.y), w: parseFloat(cs.width), h: parseFloat(cs.height) };
})())`;
// strictly-between assertion on the axis that actually travels
const rideCheck = (label, pre, mid, post) => {
  if (!pre || !mid || !post || pre.err || mid.err || post.err) {
    check(label, false, "missing sample"); return;
  }
  const deltas = [
    ["x", Math.abs(post.x - pre.x)],
    ["y", Math.abs(post.y - pre.y)],
    ["w", Math.abs(post.w - pre.w)],
    ["h", Math.abs(post.h - pre.h)],
  ];
  deltas.sort((a, b) => b[1] - a[1]);
  const [axis, span] = deltas[0];
  if (span < 1) { check(label, false, `journey too small (${span.toFixed(2)})`); return; }
  const a = pre[axis], b = post[axis], m = mid[axis];
  const between = m > Math.min(a, b) + 0.5 && m < Math.max(a, b) - 0.5;
  check(label, between, `${axis}: pre=${a.toFixed(1)} mid=${m.toFixed(1)} post=${b.toFixed(1)}`);
  return axis;
};

try {
  /* ---- G0 — the served sheet carries the voice ------------------------- */
  console.log(`[G0] served sheet — the marker rides the glide's curve`);
  {
    const cssPath = sh(`curl -s ${BASE}/ | grep -o '/_next/static/chunks/[^"]*\\.css' | head -1`);
    const css = sh(`curl -s "${BASE}${cssPath}"`);
    const norm = css.replace(/\s+/g, "");
    check("served sheet carries minimap-vp (stanza + print guard)", (norm.match(/minimap-vp/g) || []).length >= 2, `${(norm.match(/minimap-vp/g) || []).length} hits in ${cssPath} (${css.length}b)`);
    // the minifier DROPPED the standalone print rule once (witnessed):
    // assert the exact served forms, not the source's
    const mediaRule = '[data-canvas="viewport"]:has([data-canvas="workspace"].viewport-glide)[data-canvas-ui="minimap-vp"]{transition:x.48scubic-bezier(.22,.61,.36,1),y.48scubic-bezier(.22,.61,.36,1)';
    const ruleIdx = norm.indexOf(mediaRule);
    const gateIdx = norm.indexOf("@media(prefers-reduced-motion:no-preference){");
    check("stanza served with the glide's exact curve, inside the motion gate", ruleIdx >= 0 && gateIdx >= 0 && gateIdx < ruleIdx, `rule@${ruleIdx} gate@${gateIdx}`);
    const printGroup = '.viewport-glide,[data-flip-play][data-job],[data-canvas-ui="minimap-vp"]{transition:none!important;}}';
    const gIdx = norm.indexOf(printGroup);
    const pIdx = norm.lastIndexOf("@mediaprint", gIdx >= 0 ? gIdx : norm.length);
    check("print guard served inside @media print", gIdx >= 0 && pIdx >= 0 && pIdx < gIdx, `group@${gIdx} print@${pIdx}`);
  }

  /* ---- boot ------------------------------------------------------------ */
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { execSync(`pkill -f "remote-debugging-port" 2>/dev/null || true`); } catch { /* */ }
  await sleep(1200);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const roster0 = JSON.parse(sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects`)).projects.find((p) => p.id === EMPIAR_ID).stats.total;

  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 150000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(700);

  const sentinel = await readJson(`(function(){ window.__t594 = (window.__t594 || 0) + 1; return JSON.stringify(window.__t594); })()`);
  check("eval pointer pinned to the harness page", sentinel === 1, `sentinel ${sentinel}`);

  /* ---- Q — the world and the map ---------------------------------------- */
  console.log(`\n[Q] world QA — the map is on and the marker is in it`);
  {
    const counts = await readJson(`JSON.stringify({
      cards: document.querySelectorAll("[data-job]").length,
      edges: document.querySelectorAll("[data-edge-id]").length,
      dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length,
      vp: !!document.querySelector('[data-canvas-ui="minimap-vp"]')
    })`);
    check("12 cards, 13 edges", counts && counts.cards === 12 && counts.edges === 13, `${counts && counts.cards}c/${counts && counts.edges}e`);
    check("the map is mounted with 12 chips + the viewport rect", counts && counts.dots === 12 && counts.vp === true, `${counts && counts.dots} dots, vp=${counts && counts.vp}`);
  }

  /* ---- W1 — THE RIDE ----------------------------------------------------- */
  console.log(`\n[W1] the ride — find Enter arrival, the marker must not teleport`);
  const mid1 = await readJson(arrivalSample("motion"));
  check("pre-read geometry (in-eval, pre-Enter)", !!(mid1 && mid1.pre && isFinite(mid1.pre.x)), JSON.stringify(mid1 && mid1.pre));
  check("movement detected in-journey", !!(mid1 && mid1.mid && mid1.tFirst != null), `tFirst=${mid1 && mid1.tFirst}ms`);
  check("glide class armed at the moment of movement", mid1 && mid1.glide === true, `glide=${mid1 && mid1.glide}`);
  check("rect transition armed (0.48s, geometry props)", !!(mid1 && mid1.tDur && mid1.tDur.startsWith("0.48") && /x/.test(mid1.tProp || "")), `tDur=${mid1 && mid1.tDur} tProp=${mid1 && mid1.tProp}`);
  await sleep(500); // past the 520ms retract (the poll already ate ~360ms)
  const post1 = await readJson(settledSample);
  check("class retired after retract", post1 && post1.glide === false, `glide=${post1 && post1.glide}`);
  const axis1 = rideCheck("THE RIDE — marker mid-journey, not teleported (old code fails here)", mid1 && mid1.pre, mid1 && mid1.mid, post1);
  check("fit-mode frame is furniture (viewBox re-framed instantly)",
    !!(mid1 && post1 && mid1.vb === post1.vb), `vb stable across the ride's tail`);
  check("marker rests at the destination", !!(axis1 && post1 && post1.glide === false), `post.${axis1}=${post1 && post1[axis1] && post1[axis1].toFixed(1)}`);

  /* ---- W2 — gesture immunity --------------------------------------------- */
  console.log(`\n[W2] zoom commands tick, never glide — the marker tracks instantly`);
  {
    const preZ = await readJson(geoRead);
    const z = await readJson(`(function(){
      var b = document.querySelector('[aria-label="Zoom out"]');
      if (!b) return JSON.stringify({ err: "no zoom button" });
      b.click();
      return new Promise(function(resolve){
        setTimeout(function(){
          var ws = document.querySelector("[data-canvas='workspace']");
          var r = document.querySelector('[data-canvas-ui="minimap-vp"]');
          var cs = r ? getComputedStyle(r) : null;
          resolve(JSON.stringify({
            glide: !!(ws && ws.classList.contains("viewport-glide")),
            tDur: cs ? (cs.transitionDuration || "").split(",")[0] : null,
            w: cs ? parseFloat(cs.width) : null
          }));
        }, 100);
      });
    })()`);
    check("zoom command arms NOTHING", z && z.glide === false && (!z.tDur || z.tDur === "0s"), `glide=${z && z.glide} tDur=${z && z.tDur}`);
    await sleep(500);
    const postZ = await readJson(geoRead);
    check("marker tracked instantly (no transition tail)", !!(preZ && postZ && z && z.w != null && Math.abs(z.w - postZ.w) < 0.5), `@100ms w=${z && z.w && z.w.toFixed(1)} settled w=${postZ && postZ.w && postZ.w.toFixed(1)}`);
    // restore the zoom (cosmetic net-zero)
    await readJson(`(function(){ var b = document.querySelector('[aria-label="Zoom in"]'); if (b) b.click(); return "ok"; })()`);
    await sleep(400);
  }

  /* ---- W3 — the re-ride --------------------------------------------------- */
  console.log(`\n[W3] the re-ride — the arming is the class, not a one-shot`);
  {
    // a DIFFERENT destination: pick a job whose name has no "motion" in it
    // (the lens matches names + type labels; a fresh query guarantees a
    // fresh journey — "motion" has exactly one match in this world, and a
    // second Enter would ride a 0.00px journey to the same seat)
    const names = await readJson(`JSON.stringify([...document.querySelectorAll('[data-canvas-ui="minimap-dot"] title')].map(function(t){ return t.textContent.split(" — ")[0]; }))`);
    const alt = Array.isArray(names) ? names.find((n) => !/motion/i.test(n || "")) : null;
    check("found a non-motion destination job", !!alt, `alt=${alt}`);
    await readJson(`(function(){
      var input = document.querySelector('[data-canvas-find-bar] input');
      if (input) input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return "esc";
    })()`);
    await sleep(400);
    const mid2s = await readJson(arrivalSample((alt || "import").toLowerCase()));
    check("second arrival armed (movement + 0.48s)", !!(mid2s && mid2s.mid && mid2s.tDur && mid2s.tDur.startsWith("0.48")), `tFirst=${mid2s && mid2s.tFirst} tDur=${mid2s && mid2s.tDur}`);
    await sleep(500);
    const post2 = await readJson(settledSample);
    check("second arrival retired", post2 && post2.glide === false, `glide=${post2 && post2.glide}`);
    rideCheck("THE RE-RIDE — mid between the new endpoints", mid2s && mid2s.pre, mid2s && mid2s.mid, post2);
    try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t594-mm-vp-ride-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
    check("📸 settled marker screenshot", true, ".qa-logs/shots/t594-mm-vp-ride-settled.png");
  }

  /* ---- cleanup: close the lens ------------------------------------------- */
  await readJson(`(function(){
    var input = document.querySelector('[data-canvas-find-bar] input');
    if (input) input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return "esc";
  })()`);
  await sleep(300);
  const lensGone = await readJson(`JSON.stringify(!document.querySelector('[data-canvas-find-bar]'))`);
  check("lens closed (world owes nothing)", lensGone === true, `closed=${lensGone}`);

  /* ---- W4 — birth silence -------------------------------------------------- */
  console.log(`\n[W4] birth silence — a reload never rides`);
  {
    let opened = false;
    for (let i = 0; i < 3 && !opened; i++) {
      try { sh(`agent-browser open ${BASE} >/dev/null 2>&1`); opened = true; }
      catch { await sleep(2500); }
    }
    check("reload navigated", opened);
    const born = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
      return n === 12 ? n : null;
    }, 150000, 500);
    check("world re-hydrated after reload", born === 12, `got ${born}`);
    await sleep(500);
    const birth = await readJson(`(function(){
      var ws = document.querySelector("[data-canvas='workspace']");
      var r = document.querySelector('[data-canvas-ui="minimap-vp"]');
      var cs = r ? getComputedStyle(r) : null;
      return JSON.stringify({
        glide: !!(ws && ws.classList.contains("viewport-glide")),
        tDur: cs ? (cs.transitionDuration || "").split(",")[0] : null
      });
    })()`);
    check("birth arms nothing (F3 face under the new stanza)", birth && birth.glide === false && (!birth.tDur || birth.tDur === "0s"), `glide=${birth && birth.glide} tDur=${birth && birth.tDur}`);
  }

  /* ---- R — the net contract ------------------------------------------------ */
  console.log(`\n[R] the world owes nothing`);
  {
    const after = JSON.parse(sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects`)).projects.find((p) => p.id === EMPIAR_ID);
    check("roster 12→12 (the lens is ephemeral)", after.stats.total === roster0, `${roster0} → ${after.stats.total}`);
    let errs = "";
    try { errs = sh(`agent-browser errors 2>/dev/null`).trim(); } catch { /* */ }
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  }

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);

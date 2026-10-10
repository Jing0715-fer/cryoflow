/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t594 — live verification: does the map's marker RIDE?
 *
 * The gamble: CSS transitions on SVG geometry properties (x/y/width/height)
 * fired from a React ATTRIBUTE change, armed by a :has() selector that
 * starts matching in the SAME style recalc. Per the CSS transitions spec
 * the after-change style owns the transition — but the geometry-property
 * path through the attribute cascade must be proven live, not trusted.
 *
 * Sequence: served-freshness gate → open world → Ctrl+F → type "motion" →
 * Enter (find focus arrival) → atomic in-page samples at +80ms and +700ms.
 * At +80ms the OLD code's computed x would already equal the destination;
 * the RIDE means computed x is strictly between the endpoints.
 *
 * Usage: node scripts/t594-live-verify-ride.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();

try {
  /* ---- served freshness gate (t591 law: ask the PRODUCT first) --------- */
  console.log(`[G] served sheet freshness`);
  const cssPath = sh(`curl -s ${BASE}/ | grep -o '/_next/static/chunks/[^"]*\\.css' | head -1`);
  const css = sh(`curl -s "${BASE}${cssPath}"`);
  const norm = css.replace(/\s+/g, "");
  check(
    "served sheet carries the t594 minimap-vp stanza",
    norm.includes('minimap-vp') && norm.includes(":has"),
    `${cssPath} (${css.length}b)`,
  );

  /* ---- boot ------------------------------------------------------------ */
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(1000);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);

  const readJson = async (js, tries = 3) => {
    const flat = js.replace(/\n\s*/g, " ");
    for (let i = 0; i < tries; i++) {
      try {
        const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
        let v = t;
        for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
        if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
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

  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12;
  }, 120000, 500);
  check("world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(600);

  /* ---- the ride -------------------------------------------------------- */
  console.log(`\n[W] find Enter arrival — the marker must ride, not teleport`);
  // pre: capture the rect's geometry (user units — computed style, projection-free)
  const pre = await readJson(`(function(){
    var r = document.querySelector('[data-canvas-ui="minimap-vp"]');
    if (!r) return "{}";
    var cs = getComputedStyle(r);
    return JSON.stringify({ x: parseFloat(cs.x), y: parseFloat(cs.y), w: parseFloat(cs.width), h: parseFloat(cs.height) });
  })()`);
  check("pre-read geometry", !!(pre && isFinite(pre.x)), JSON.stringify(pre));

  // open find + type the query + Enter, ALL inside the browser, then the
  // +80ms sample lands in the SAME eval (in-browser timing law)
  const mid = await readJson(`(function(){
    var bar = document.querySelector('[data-canvas-find-bar]');
    if (!bar) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }));
    }
    return new Promise(function(resolve){
      setTimeout(function(){
        var input = document.querySelector('[data-canvas-find-bar] input');
        if (!input) { resolve(JSON.stringify({ err: "no input" })); return; }
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, "motion");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        setTimeout(function(){
          input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          var t0 = performance.now();
          setTimeout(function(){
            var ws = document.querySelector("[data-canvas='workspace']");
            var r = document.querySelector('[data-canvas-ui="minimap-vp"]');
            if (!r) { resolve(JSON.stringify({ err: "no rect" })); return; }
            var cs = getComputedStyle(r);
            var tDur = (cs.transitionDuration || "").split(",")[0];
            resolve(JSON.stringify({
              t: Math.round(performance.now() - t0),
              glide: !!(ws && ws.classList.contains("viewport-glide")),
              x: parseFloat(cs.x), y: parseFloat(cs.y),
              w: parseFloat(cs.width), h: parseFloat(cs.height),
              tProp: (cs.transitionProperty || "").slice(0, 40),
              tDur: tDur
            }));
          }, 80);
        }, 450);
      }, 850);
    });
  })()`);
  console.log("  mid-sample:", JSON.stringify(mid));
  check("glide class armed on workspace", !!(mid && mid.glide), mid && `glide=${mid.glide}`);
  check("rect transition armed (0.48s)", !!(mid && mid.tDur && mid.tDur.startsWith("0.48")), mid && `tDur=${mid.tDur} tProp=${mid.tProp}`);

  // settle: at +700ms the rect is at its destination and the class retired
  await sleep(620);
  const post = await readJson(`(function(){
    var ws = document.querySelector("[data-canvas='workspace']");
    var r = document.querySelector('[data-canvas-ui="minimap-vp"]');
    if (!r) return "{}";
    var cs = getComputedStyle(r);
    return JSON.stringify({ glide: !!(ws && ws.classList.contains("viewport-glide")), x: parseFloat(cs.x), y: parseFloat(cs.y) });
  })()`);
  check("class retired after retract", post && post.glide === false, post && `glide=${post.glide}`);
  // THE RIDE — mid strictly between pre and post on the dominant axis
  // (the old code's teleport would read mid == post at +80ms)
  if (pre && mid && post) {
    const dx = Math.abs(post.x - pre.x), dy = Math.abs(post.y - pre.y);
    const axis = dx >= dy ? "x" : "y";
    const a = pre[axis], b = post[axis], m = mid[axis];
    const between = m > Math.min(a, b) + 0.5 && m < Math.max(a, b) - 0.5;
    check(
      `THE RIDE — computed ${axis} is mid-journey (old code: already at destination)`,
      between,
      `pre=${a.toFixed(1)} mid=${m.toFixed(1)} post=${b.toFixed(1)}`,
    );
    check("marker settled at a NEW destination (and class retired)", Math.abs(b - a) > 1 && post.glide === false, `pre=${a.toFixed(1)} post=${b.toFixed(1)}`);
  }

  /* ---- cleanup: close the lens ----------------------------------------- */
  await readJson(`(function(){
    var input = document.querySelector('[data-canvas-find-bar] input');
    if (input) input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return "esc";
  })()`);
  await sleep(300);

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);

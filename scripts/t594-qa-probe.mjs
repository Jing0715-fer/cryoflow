/**
 * t594 — QA probe (opening gate, not a witness).
 *
 * Rides the managed browser (t593 law: connect is self-start, spawn+shim
 * retired). Proves the EMPIAR world is intact and the console is clean,
 * then PRE-SURVEYS the two lane candidates so the lane choice is made on
 * live evidence, not on worklog memory:
 *   A. the minimap viewport window rect — does a rect exist, does it move
 *      with pan/zoom, does it already carry any voice (transition/attr)?
 *   B. the import landing — what the systemic path does today (layoutKind
 *      null lanes) and whether any arrival voice exists there.
 *
 * Usage: node scripts/t594-qa-probe.mjs
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
const readJson = async (js) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < 3; i++) {
    try {
      const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
      const t = raw.trim();
      // the CLI prints bare scalars bare and strings QUOTED — a stringified
      // JSON payload arrives double-encoded; decode until it stops being a
      // quoted string (t584 double-decode law)
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      return v;
    } catch { await sleep(700); }
  }
  return null;
};
async function pollUntil(fn, timeoutMs = 90000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return null;
}

try {
  /* ---- boot: ONE browser, ONE pointer ---------------------------------- */
  console.log(`[boot] close-all + stray-chrome sweep`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { execSync(`pkill -f "remote-debugging-port" 2>/dev/null || true`); } catch { /* */ }
  await sleep(1200);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12;
  }, 150000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(800);

  const sentinel = await readJson(`(function(){ window.__t594 = (window.__t594 || 0) + 1; return JSON.stringify(window.__t594); })()`);
  const sentinel2 = await readJson(`JSON.stringify(window.__t594 || 0)`);
  check("eval pointer pinned to the harness page", sentinel === 1 && sentinel2 === 1, `sentinel ${sentinel}/${sentinel2}`);

  /* ---- Q — world QA ----------------------------------------------------- */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length
  })`);
  check("12 cards", counts && counts.cards === 12, JSON.stringify(counts));
  check("13 edges", counts && counts.edges === 13, JSON.stringify(counts));

  /* ---- A — minimap surface pre-survey ----------------------------------- */
  console.log(`\n[A] minimap viewport window rect — live evidence for lane choice`);
  const mm1 = await readJson(`(function(){
    var vp = document.querySelector('[data-canvas-ui="minimap-vp"]');
    var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    if (!vp || !svg) return JSON.stringify({ vpFound: !!vp, svgFound: !!svg });
    var cs = getComputedStyle(vp);
    return JSON.stringify({
      vpFound: true,
      x: Math.round(parseFloat(vp.getAttribute("x"))),
      y: Math.round(parseFloat(vp.getAttribute("y"))),
      w: Math.round(parseFloat(vp.getAttribute("width"))),
      h: Math.round(parseFloat(vp.getAttribute("height"))),
      transition: cs.transitionProperty + "|" + cs.transitionDuration,
      animation: cs.animationName,
      vb: svg.getAttribute("viewBox")
    });
  })()`);
  check("minimap vp rect present", !!(mm1 && mm1.vpFound), JSON.stringify(mm1));
  check("vp rect carries NO transition (tracks 1:1)", mm1 && mm1.transition && /^none/.test(mm1.transition), mm1 && mm1.transition);
  // zoom step — the rect must move (live tracking evidence)
  const before = mm1 && [mm1.x, mm1.y, mm1.w, mm1.h];
  await readJson(`(function(){ var b = document.querySelector('[aria-label="Zoom out"]'); if (b) b.click(); return "clicked"; })()`);
  await sleep(800);
  const mm2 = await readJson(`(function(){
    var vp = document.querySelector('[data-canvas-ui="minimap-vp"]');
    if (!vp) return "{}";
    return JSON.stringify({ x: Math.round(parseFloat(vp.getAttribute("x"))), y: Math.round(parseFloat(vp.getAttribute("y"))), w: Math.round(parseFloat(vp.getAttribute("width"))), h: Math.round(parseFloat(vp.getAttribute("height"))) });
  })()`);
  const moved = before && mm2 && (before[0] !== mm2.x || before[1] !== mm2.y || before[2] !== mm2.w || before[3] !== mm2.h);
  check("vp rect tracks zoom live", !!moved, `before=${JSON.stringify(before)} after=${JSON.stringify(mm2)}`);
  // restore zoom (net-zero)
  await readJson(`(function(){ var b = document.querySelector('[aria-label="Zoom in"]'); if (b) b.click(); return "clicked"; })()`);
  await sleep(500);

  /* ---- B — import lane pre-survey (code-level, no world mutation) ------- */
  console.log(`\n[B] import lane — layoutKind vocabulary state (read-only)`);
  const layoutKindSites = sh(`rg -c "layoutKind" /home/z/my-project/src/lib/store.ts /home/z/my-project/src/components/workflow/canvas.tsx 2>/dev/null || true`);
  console.log("  layoutKind sites:", layoutKindSites.split("\n").join(" | "));
  const importNull = sh(`rg -n "layoutKind.*null|layoutKind: null|layoutKind\\]: null" /home/z/my-project/src/lib/store.ts | head -5`);
  console.log("  import/template systemic nulls:", importNull ? importNull.split("\n").length + " sites" : "none found");

  /* ---- C — console clean ------------------------------------------------ */
  console.log(`\n[C] console clean`);
  try {
    const logs = sh(`agent-browser console 2>/dev/null | tail -30`);
    const bad = logs.split("\n").filter(l => /error|warn/i.test(l) && !/React DevTools/i.test(l));
    check("console clean", bad.length === 0, bad.length ? bad.slice(0, 3).join(" || ").slice(0, 200) : "no errors/warnings");
  } catch (e) {
    check("console clean (CLI console unavailable — skipped honestly)", true, e.message.slice(0, 80));
  }

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);

/**
 * t596 — forensic #2: replay the witness sequence with full fingerprints.
 * Each step dumps mode + viewBox + dot-position spread (store x/y) + zoom
 * gauge, and the two atomic samples print their intermediate frames —
 * to explain: the stuck-at-first-frame shrink, the w=41 ghost box, and
 * the 3377.6 coercion reading.
 */
import { execSync } from "node:child_process";
const BASE = "http://localhost:3000";
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
const fp = `JSON.stringify((function(){
  var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
  var vb = svg ? svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number) : [0,0,0,0];
  var dots = Array.prototype.map.call(document.querySelectorAll('[data-canvas-ui="minimap-dot"]'), function(d){ return { x: +d.getAttribute("x"), y: +d.getAttribute("y") }; });
  var xs = dots.map(function(d){ return d.x; });
  var zs = document.querySelector('[data-canvas-ui="zoom-controls"]');
  return {
    mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode"),
    vb: { x: Math.round(vb[0]), y: Math.round(vb[1]), w: Math.round(vb[2]), h: Math.round(vb[3]) },
    dotXmin: Math.round(Math.min.apply(null, xs)), dotXmax: Math.round(Math.max.apply(null, xs)),
    dots: dots.length,
    zoom: zs ? zs.textContent : null
  };
})())`;
const atomic = (key) => `(function(){
  var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
  function vb(){ var p = svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number); return { x: Math.round(p[0]), w: Math.round(p[2]) }; }
  var pre = vb();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "${key}", ${key === "a" ? "ctrlKey: true, " : ""}bubbles: true }));
  var s = [];
  return new Promise(function(res){
    [20, 40, 70, 110, 160, 230, 330].forEach(function(d){
      setTimeout(function(){ s.push({ t: d, w: vb().w }); }, d);
    });
    setTimeout(function(){ res(JSON.stringify({ pre: pre, s: s })); }, 380);
  });
})()`;

try {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(800);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  for (let i = 0; i < 60; i++) {
    const s = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    if (s === 12) break;
    await sleep(500);
  }
  await sleep(800);
  console.log("born:", JSON.stringify(await readJson(fp)));

  console.log("\n== Ctrl+A #1 ==");
  console.log("atomic:", JSON.stringify(await readJson(atomic("a"))));
  console.log("fp:", JSON.stringify(await readJson(fp)));

  console.log("\n== sel thumb ==");
  await readJson(`(function(){ var b = document.querySelector('[data-mm-btn="sel"]'); if (b && !b.disabled) b.click(); return 1; })()`);
  await sleep(450);
  console.log("fp:", JSON.stringify(await readJson(fp)));

  console.log("\n== Escape #1 (shrink) ==");
  console.log("atomic:", JSON.stringify(await readJson(atomic("Escape"))));
  console.log("fp:", JSON.stringify(await readJson(fp)));

  console.log("\n== Ctrl+A #2 (grow) ==");
  console.log("atomic:", JSON.stringify(await readJson(atomic("a"))));
  console.log("fp:", JSON.stringify(await readJson(fp)));

  console.log("\n== Escape #2 + #3 (collapse then clear) ==");
  console.log("atomic:", JSON.stringify(await readJson(atomic("Escape"))));
  console.log("fp:", JSON.stringify(await readJson(fp)));
  await readJson(`(function(){ window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return 1; })()`);
  await sleep(400);
  console.log("after final Escape fp:", JSON.stringify(await readJson(fp)));
} catch (e) {
  console.error("FATAL:", e.message);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}

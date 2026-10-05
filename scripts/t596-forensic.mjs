/**
 * t596 — forensic probe: the Escape/Ctrl+A timeline, fully printed.
 * Every step dumps mode + selIds count + viewBox — no assertions, just
 * the world's own words, to explain the W1/W4 anomalies.
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
const state = `JSON.stringify((function(){
  var svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
  var vb = svg ? svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number) : [0,0,0,0];
  var selBtn = document.querySelector('[data-mm-btn="sel"]');
  var cards = document.querySelectorAll("[data-job]");
  var selCards = document.querySelectorAll('[data-job][data-selected], [data-job].ring-2');
  return {
    mode: document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode"),
    selDisabled: selBtn ? selBtn.disabled : null,
    w: Math.round(vb[2]), x: Math.round(vb[0]),
    cards: cards.length,
    selCards: selCards.length
  };
})())`;

try {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(800);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  for (let i = 0; i < 60; i++) {
    const s = await readJson(state);
    if (s && s.cards === 12) break;
    await sleep(500);
  }
  await sleep(800);
  console.log("t0 (born):", JSON.stringify(await readJson(state)));

  await readJson(`(function(){ window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true })); return 1; })()`);
  await sleep(300);
  console.log("t1 (after Ctrl+A):", JSON.stringify(await readJson(state)));

  await readJson(`(function(){ var b = document.querySelector('[data-mm-btn="sel"]'); if (b && !b.disabled) b.click(); return 1; })()`);
  await sleep(450);
  console.log("t2 (after sel thumb):", JSON.stringify(await readJson(state)));

  await readJson(`(function(){ window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return 1; })()`);
  for (const d of [40, 80, 150, 250, 400, 700]) {
    await sleep(d === 40 ? 40 : d - [40, 80, 150, 250, 400, 700][[40, 80, 150, 250, 400, 700].indexOf(d) - 1]);
    console.log(`t3 Escape +${d}ms:`, JSON.stringify(await readJson(state)));
  }

  await readJson(`(function(){ window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true })); return 1; })()`);
  for (const d of [40, 150, 300]) {
    await sleep(d === 40 ? 40 : d - [40, 150, 300][[40, 150, 300].indexOf(d) - 1]);
    console.log(`t4 Ctrl+A +${d}ms:`, JSON.stringify(await readJson(state)));
  }
} catch (e) {
  console.error("FATAL:", e.message);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}

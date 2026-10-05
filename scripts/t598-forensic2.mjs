/**
 * t598 forensic2 — the delete face: after the confirm click, does the
 * dialog close (onClick ran), does the card leave the DOM, and when does
 * the SERVER see the delete? Samples at 300ms for 15s.
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
async function pollUntil(fn, timeoutMs = 60000, step = 400) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}

try {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(800);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const hy = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n >= 12 ? n : null;
  }, 90000, 400);
  console.log(`hydrated: ${hy}`);
  await sleep(800);

  /* mint a probe via API — the poll brings it in; the UI delete face then
   * runs against the probe, zero risk to the real world */
  sh(`curl -s -X POST -H "Origin: ${BASE}" -H "Content-Type: application/json" -d '{"type":"import","name":"t598 F2 Probe","x":0,"y":0}' ${BASE}/api/jobs -o /dev/null`);
  const target = await pollUntil(async () => {
    const id = await readJson(`JSON.stringify((function(){
      var el = null;
      document.querySelectorAll("[data-job]").forEach(function(c){ if (!el && (c.textContent || "").indexOf("t598 F2 Probe") >= 0) el = c; });
      return el ? el.getAttribute("data-job") : null;
    })())`);
    return id || null;
  }, 30000, 500);
  console.log(`target: ${target}`);
  await readJson(`(function(){
    var el = document.querySelector('[data-job="${target}"]');
    if (el) el.click();
    return "clicked";
  })()`);
  await sleep(500);
  const sel = await readJson(`JSON.stringify({
    sel: !!document.querySelector('[data-job="${target}"][data-selected]'),
    cls: (document.querySelector('[data-job="${target}"]') || {}).className || ""
  })`);
  console.log(`after click: ${JSON.stringify(sel).slice(0, 120)}`);
  await readJson(`(function(){
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    return "sent";
  })()`);
  await sleep(700);
  const dlg = await readJson(`JSON.stringify({
    open: !!document.querySelector('[role="alertdialog"]'),
    btns: Array.from(document.querySelectorAll('[role="alertdialog"] button')).map(function(b){ return (b.textContent || "").trim().slice(0, 14); })
  })`);
  console.log(`dialog: ${JSON.stringify(dlg)}`);

  const clicked = await readJson(`(function(){
    var btn = null;
    Array.from(document.querySelectorAll('[role="alertdialog"] button')).forEach(function(b){
      if (!btn && /^Delete/.test((b.textContent || "").trim())) btn = b;
    });
    if (!btn) return JSON.stringify({ err: "no button" });
    btn.click();
    return "clicked";
  })()`);
  console.log(`confirm: ${clicked}`);
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) {
    await sleep(700);
    const st = await readJson(`JSON.stringify({
      dlg: !!document.querySelector('[role="alertdialog"]'),
      card: !!document.querySelector('[data-job="${target}"]')
    })`);
    let server = "?";
    try {
      const jobs = JSON.parse(sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/jobs`)).jobs;
      server = jobs.some((j) => j.id === target) ? "alive" : "gone";
    } catch { server = "err"; }
    console.log(`t+${Math.round((Date.now() - t0) / 1000)}s dlg=${st && st.dlg} card=${st && st.card} server=${server}`);
    if (server === "gone" && st && st.card === false) break;
  }
  /* restore via Ctrl+Z to leave the world as found */
  await readJson(`(function(){
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    return "sent";
  })()`);
  await sleep(2500);
  const back = await readJson(`JSON.stringify(!!document.querySelector('[data-job="${target}"]'))`);
  console.log(`restored: ${back}`);
  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  console.log(`console: ${errs ? errs.slice(0, 300) : "clean"}`);
} catch (e) {
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(0);

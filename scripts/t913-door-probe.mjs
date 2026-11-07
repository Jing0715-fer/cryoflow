#!/usr/bin/env node
/** t913 door probe — the witness's openTargetInspector with per-round logging */
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, cwd: ROOT, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return `RAW:${String(out).slice(0, 80)}`; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

sh(`${AB} open about:blank`);
sh(`${AB} set viewport 320 800`);
sh(`${AB} open ${BASE}/`);
for (let i = 0; i < 20; i++) {
  const gate = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
  console.log(`gate ${i}: ${JSON.stringify(gate)}`);
  if (gate && gate.cards >= 4) break;
  await sleep(500);
}
for (let round = 0; round < 8; round++) {
  const cands = evalJson(`(() => { const out = []; for (const card of document.querySelectorAll('[data-job]')) { const btn = card.querySelector('[role="button"][tabindex]'); if (!btn) continue; const r = btn.getBoundingClientRect(); if (r.width === 0) continue; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); if (hit && btn.contains(hit)) out.push({ cx, cy }); } return JSON.stringify(out.slice(0, 4)); })()`);
  console.log(`round ${round} cands: ${JSON.stringify(cands)}`);
  if (!Array.isArray(cands) || cands.length === 0) { await sleep(1200); continue; }
  const pick = cands[round % cands.length];
  sh(`${AB} mouse move ${pick.cx} ${pick.cy}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  await sleep(2800);
  const dlg = evalJson(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return JSON.stringify({ dialog: false }); const el = [...d.querySelectorAll('span,code,div')].find(e => /topazdenoise_/.test(e.textContent || '') && (e.textContent || '').length < 200); return JSON.stringify({ dialog: true, title: (d.querySelector('[data-slot=dialog-title]')?.textContent || '').slice(0, 60), wd: el ? el.textContent.trim().slice(0, 110) : null }); })()`);
  console.log(`round ${round} dialog: ${JSON.stringify(dlg)}`);
  if (dlg && dlg.dialog && dlg.wd && /topazdenoise_/.test(dlg.wd)) { console.log("DOOR OPENED"); break; }
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(900);
}

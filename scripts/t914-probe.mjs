#!/usr/bin/env node
/** t914 probe — the Results-tab face + the 320 canvas mapping (one ride, read-only). */
import { execSync } from "node:child_process";
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const sh = (c) => execSync(c, { encoding: "utf8", timeout: 120_000 }).trim();
const evalJs = (e) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: e }).trim();
const evalJson = (e) => {
  let out = evalJs(e);
  const q = out.indexOf('"');
  if (q > 0) out = out.slice(q);
  try { const once = JSON.parse(out); return typeof once === "string" ? JSON.parse(once) : once; } catch { return out; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

sh(`${AB} open about:blank`);
sh(`${AB} set viewport 1280 800`);
sh(`${AB} open ${BASE}/`);
for (let i = 0; i < 24; i++) {
  const g = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
  if (g?.cards >= 4) break;
  await sleep(500);
}
// the mint card's rect + a visible demo card's rect + the canvas transform
const rect = evalJson(`(() => { const card = [...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('t914 stack mint')); if (!card) return null; const b = card.querySelector('[role="button"][tabindex]') || card; const r = b.getBoundingClientRect(); const job = card.getAttribute('data-job'); return JSON.stringify({ job, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }); })()`);
console.log("mint card rect @1280:", JSON.stringify(rect));
const visCards = evalJson(`(() => { const out = []; for (const c of document.querySelectorAll('[data-job]')) { const b = c.querySelector('[role="button"][tabindex]'); if (!b) continue; const r = b.getBoundingClientRect(); if (r.width === 0 || r.right < 0 || r.left > window.innerWidth) continue; out.push({ job: c.getAttribute('data-job'), x: Math.round(r.x), y: Math.round(r.y) }); } return JSON.stringify(out.slice(0, 6)); })()`);
console.log("visible cards @1280:", JSON.stringify(visCards));

// click the mint card, then inspect the tabs
const cx = rect.x + Math.floor(rect.w / 2), cy = rect.y + 8;
sh(`${AB} mouse move ${cx} ${cy}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
await sleep(2500);
const tabs = evalJson(`(() => { const ts = [...document.querySelectorAll('[role="tab"]')].map(t => (t.textContent || '').trim().slice(0, 24)); const dlg = document.querySelectorAll('[role="dialog"]').length; return JSON.stringify({ dlg, tabs: ts }); })()`);
console.log("tabs after inspector open:", JSON.stringify(tabs));
const tab = evalJson(`(() => { const t = [...document.querySelectorAll('[role="tab"]')].find(t => /^Results/.test((t.textContent || '').trim())); if (!t) return null; const r = t.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
console.log("Results tab center:", JSON.stringify(tab));
if (tab) {
  sh(`${AB} mouse move ${tab.x} ${tab.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  for (let i = 0; i < 20; i++) {
    const s = evalJson(`(() => { const secs = [...document.querySelectorAll('[role="dialog"] section[aria-label]')].map(s => s.getAttribute('aria-label')); const gal = document.querySelector('[data-canvas-ui="maps-gallery"]'); return JSON.stringify({ secs, gal: !!gal }); })()`);
    if (s?.gal) { console.log("gallery UP after", (i + 1) * 500, "ms"); break; }
    await sleep(500);
  }
  const final = evalJson(`(() => { const secs = [...document.querySelectorAll('[role="dialog"] section[aria-label]')].map(s => s.getAttribute('aria-label')); const gal = document.querySelector('[data-canvas-ui="maps-gallery"]'); const tiles = gal ? gal.querySelectorAll('button').length : 0; const caps = gal ? [...gal.querySelectorAll('button')].map(b => (b.textContent || '').trim().slice(0, 60)) : []; return JSON.stringify({ secs, tiles, caps }); })()`);
  console.log("sections after Results click:", JSON.stringify(final));
}
// the 320 mapping: visible demo cards at 320
sh(`${AB} set viewport 320 800`);
await sleep(2500);
const vis320 = evalJson(`(() => { const out = []; for (const c of document.querySelectorAll('[data-job]')) { const b = c.querySelector('[role="button"][tabindex]'); if (!b) continue; const r = b.getBoundingClientRect(); if (r.width === 0 || r.right < 0 || r.left > window.innerWidth || r.bottom < 0 || r.top > window.innerHeight) continue; out.push({ job: c.getAttribute('data-job'), x: Math.round(r.x), y: Math.round(r.y) }); } return JSON.stringify(out); })()`);
console.log("visible cards @320:", JSON.stringify(vis320));
const mint320 = evalJson(`(() => { const card = [...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('t914 stack mint')); if (!card) return null; const b = card.querySelector('[role="button"][tabindex]') || card; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x), y: Math.round(r.y) }); })()`);
console.log("mint card rect @320:", JSON.stringify(mint320));
sh(`${AB} close`);

// qa63-esc-diag — why does the Esc close assertion fail in the smoke?
// (v2: bare evalJs/unq like the smoke — the v2 pt() helper mangled escaping
// and made every probe lie, e.g. "NOCARD".includes("CARD") === true.)
import { execSync } from "node:child_process";
const AB = "agent-browser";
const B = "http://localhost:3000";
const sh = (c) => execSync(c, { encoding: "utf8", timeout: 60000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 60000, input: e }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const click = (findExpr) => {
  const coords = ev(`(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`);
  if (!coords || coords === "null") return "NO-ELEMENT";
  const c = JSON.parse(coords);
  sh(`${AB} mouse move ${c.x} ${c.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  return `clicked@${c.x},${c.y}`;
};

sh(`${AB} close`); await sleep(1000);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`);
await sleep(5000);

// canvas boot: only Shift+D when actually on the dashboard (h1 says so)
for (let i = 0; i < 8; i++) {
  const hasCard = unq(ev(`String([...document.querySelectorAll('[role=button]')].some(x => (x.textContent||'').includes('QA Post 320')))`,)) === "true";
  if (hasCard) break;
  const dash = unq(ev(`String((document.querySelector('h1')||{textContent:''}).textContent.includes('Dashboard'))`)) === "true";
  if (dash) ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
  await sleep(2200);
}

console.log("1. card click:", click(`[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('QA Post 320'))`));
await sleep(1600);
console.log("2. modal:", unq(ev(`String([...document.querySelectorAll('[role=dialog]')].some(d => (d.textContent||'').includes('QA Post 320')))`)));

console.log("3. compare chip:", click(`[...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('compare') || (b.title||'').includes('compare'))`));
await sleep(1800);
console.log("4. rows:", unq(ev(`String(document.querySelectorAll('[data-testid=fsc-compare-row]').length)`)));

console.log("5. esc dispatch:", unq(ev(`(() => {
  const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-testid=fsc-compare-list]'));
  if (!dl) return 'NO-DIALOG';
  dl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  return 'dispatched, data-state=' + dl.getAttribute('data-state');
})()`)));
await sleep(1300);

console.log("6. after esc:", unq(ev(`JSON.stringify({
  rows: document.querySelectorAll('[data-testid=fsc-compare-row]').length,
  compareList: !!document.querySelector('[data-testid=fsc-compare-list]'),
  dialogStates: [...document.querySelectorAll('[role=dialog]')].map(d => d.getAttribute('data-state')),
  inspAlive: [...document.querySelectorAll('[role=dialog]')].some(d => (d.textContent||'').includes('QA Post 320')),
})`)));

sh(`${AB} close`);

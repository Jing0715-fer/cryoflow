import { execSync } from "node:child_process";
const AB = "agent-browser";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: process.cwd() }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
const evalJson = (expr) => {
  let out = execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
  try { const q = out.indexOf('"'); if (q > 0) out = out.slice(q); const once = JSON.parse(out); return typeof once === "string" ? JSON.parse(once) : once; } catch { return out; }
};
sh(`${AB} open http://localhost:3000/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
const openState = evalJson(`(() => { const c = [...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('Motion Correction 1')); if (!c) return null; const b = c.querySelector('[role="button"][tabindex]'); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
if (openState?.x) { sh(`${AB} mouse move ${openState.x} ${openState.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); }
await sleep(2500);
const tabState = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('Motion Correction 1')); const t = d ? [...(d.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('Overview')) : null; if (!t) return null; const r = t.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
if (tabState?.x) { sh(`${AB} mouse move ${tabState.x} ${tabState.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); }
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const probe = evalJson(`(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('Motion Correction 1'));
  if (!dlg) return JSON.stringify({ err: 'no-dialog' });
  const panel = [...dlg.querySelectorAll('[role="tabpanel"]')].filter(p => p.getBoundingClientRect().width > 0)[0];
  if (!panel) return JSON.stringify({ err: 'no-panel' });
  const out = [];
  const walk = (el, depth, addr) => {
    if (depth > 22) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      const r = el.getBoundingClientRect();
      out.push({ addr, tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 90), sw: el.scrollWidth, cw: el.clientWidth, over: el.scrollWidth - el.clientWidth, w: Math.round(r.width), text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40), parentCls: String(el.parentElement?.className || '').slice(0, 60) });
    }
    for (let i = 0; i < el.children.length; i++) walk(el.children[i], depth + 1, addr + '/' + i);
  };
  walk(panel, 0, 'P');
  out.sort((a, b) => b.over - a.over);
  return JSON.stringify(out.slice(0, 8));
})()`);
console.log(JSON.stringify(probe, null, 1));

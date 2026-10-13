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
  const console1 = [...dlg.querySelectorAll('[data-log-console]')].filter(p => p.getBoundingClientRect().width > 0)[0];
  if (!console1) return JSON.stringify({ err: 'no-console' });
  const btn = console1.querySelector('button');
  if (!btn) return JSON.stringify({ err: 'no-btn' });
  const cs = getComputedStyle(btn);
  const kids = [...btn.childNodes].map(n => {
    if (n.nodeType === 1) { const r = n.getBoundingClientRect(); return { el: n.tagName.toLowerCase(), cls: String(n.className || '').slice(0, 50), w: Math.round(r.width), sw: n.scrollWidth }; }
    return { text: (n.textContent || '').trim().slice(0, 20) };
  });
  const ps = getComputedStyle(btn.parentElement);
  return JSON.stringify({
    btnSW: btn.scrollWidth, btnCW: btn.clientWidth, rectW: Math.round(btn.getBoundingClientRect().width),
    pad: cs.padding, gap: cs.gap, fs: cs.fontSize, minW: cs.minWidth, shrink: cs.flexShrink,
    kids, iconW: btn.querySelector('svg') ? Math.round(btn.querySelector('svg').getBoundingClientRect().width) : null,
    parentShrinkCtx: { display: ps.display, gap: ps.gap },
  });
})()`);
console.log(JSON.stringify(probe, null, 1));

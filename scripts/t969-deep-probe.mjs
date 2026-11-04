#!/usr/bin/env node
/** t969 deep-probe — WHO owns the 329px min-content inside the
 * two-column grid block? Walk the grid subtree at the fold and rank
 * every element by its RIGHT EDGE relative to the panel, and by its
 * own scrollWidth — the deepest leaf that sticks out is the cure's
 * real address. Plus: the presets row's nowrap leaf. */
import { execSync } from "node:child_process";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const NAME = "Motion Correction 1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: process.cwd() }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
function evalJs(expr) {
  try { return execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); }
  catch (e) { return String(e?.stdout ?? "") || "null"; }
}
function evalJson(expr) {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
}

sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
const openState = evalJson(`(() => { const c = [...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${NAME}')); if (!c) return JSON.stringify({ err: 'no-card' }); const b = c.querySelector('[role="button"][tabindex]'); if (!b) return JSON.stringify({ err: 'no-btn' }); const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
if (openState?.x) { sh(`${AB} mouse move ${openState.x} ${openState.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); }
await sleep(2500);
const tabState = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); if (!d) return JSON.stringify({ err: 'no-dialog' }); const t = [...(d.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('Overview')); if (!t) return JSON.stringify({ err: 'no-tab' }); const r = t.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
if (tabState?.x) { sh(`${AB} mouse move ${tabState.x} ${tabState.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); }
sh(`${AB} set viewport 320 640`);
await sleep(1500);

const probe = evalJson(`(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const panel = [...dlg.querySelectorAll('[role="tabpanel"]')].filter(p => p.getBoundingClientRect().width > 0)[0];
  if (!panel) return JSON.stringify({ err: "no-panel" });
  const twoCol = [...panel.querySelectorAll("div.grid")].find(g => g.classList.contains("lg:grid-cols-2"));
  if (!twoCol) return JSON.stringify({ err: "no-grid" });
  const panelLeft = panel.getBoundingClientRect().left;
  const rows = [];
  const walk = (el, depth, chain) => {
    if (depth > 18) return;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const ws = s.whiteSpace;
    rows.push({
      d: depth,
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 70),
      w: Math.round(r.width),
      right: Math.round(r.right - panelLeft),
      sw: el.scrollWidth,
      ws: ws === "nowrap" || ws === "pre" ? ws : undefined,
      over: el.scrollWidth > el.clientWidth + 1 ? el.scrollWidth - el.clientWidth : undefined,
      text: el.children.length === 0 ? (el.textContent || "").trim().slice(0, 44) : undefined,
      ch: chain,
    });
    for (const c of el.children) walk(c, depth + 1, chain + 1);
  };
  walk(twoCol, 0, 0);
  rows.sort((a, b) => (b.right ?? 0) - (a.right ?? 0));
  return JSON.stringify({ gridSW: twoCol.scrollWidth, gridCW: twoCol.clientWidth, top: rows.slice(0, 16) });
})()`);
console.log(JSON.stringify(probe, null, 1));

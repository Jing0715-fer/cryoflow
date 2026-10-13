#!/usr/bin/env node
/**
 * t965 — the leaf probe: the t965 fold rider's walk found six non-
 * self-clipping leaves over 6–8px inside the inspector dialog at 320.
 * The t964 law judges a leaf by WHAT CUTS IT: contained by a clipping
 * ancestor below the dialog = 良性; cut with content lost = disease.
 * This probe names each offender: its text, its role, the chain of
 * clipping ancestors between it and the dialog, and whether the cut
 * loses anything (scrollable = reachable, hidden = cut).
 */
import { execSync } from "node:child_process";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const NAME = "Remote Ledger Door (t963)";
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000 }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => { try { return execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); } catch (e) { return String(e?.stdout ?? "") || "null"; } };
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"'); if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};

sh(`${AB} set viewport 320 640`);
sh(`${AB} open ${BASE}/`);
await sleep(3000);

/* open the inspector via the canvas card */
const openExpr = `(() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME}')); const b = c?.querySelector('[role="button"][tabindex]'); if (!b) return 'no-card'; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`;
for (let i = 0; i < 5; i++) {
  const pos = evalJson(openExpr);
  if (pos?.x) { sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); }
  await sleep(1200);
  const opened = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return JSON.stringify({ open: !!d }); })()`);
  if (opened?.open) break;
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(500);
}
await sleep(1000);

/* the rider's walk ran with the FILES tab active — reproduce that face */
const tabClicked = (() => {
  const pos = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const t = [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('Files')); if (!t) return null; const r = t.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (pos?.x) { sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); return "clicked"; }
  return "no-tab";
})();
console.log(`(Files tab: ${tabClicked})`);
await sleep(1500);

const probe = `(() => {
  const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!d) return JSON.stringify({ open: false });
  const out = [];
  const chainInfo = (el) => {
    /* walk up from the offender to the dialog: name every ancestor that
       clips (scrollable or hidden) — containment law */
    const chain = [];
    let p = el.parentElement;
    while (p && p !== d) {
      const s = getComputedStyle(p);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        chain.push({ cls: String(p.className || '').slice(0, 70), ox: s.overflowX, oy: s.overflowY, scrollable: p.scrollWidth > p.clientWidth + 1 && (s.overflowX === 'auto' || s.overflowX === 'scroll') });
      }
      p = p.parentElement;
    }
    return chain;
  };
  const walk = (el, depth) => {
    if (depth > 24) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      const s = getComputedStyle(el);
      const selfClip = s.overflowX !== 'visible' || s.overflowY !== 'visible';
      if (!selfClip) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 70),
          over: el.scrollWidth - el.clientWidth,
          text: (el.textContent || '').trim().slice(0, 50),
          aria: el.getAttribute?.('aria-label') ?? null,
          title: el.getAttribute?.('title')?.slice(0, 40) ?? null,
          chain: chainInfo(el),
        });
      }
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(d, 0);
  out.sort((a, b) => b.over - a.over);
  return JSON.stringify({ open: true, dialogOverX: d.scrollWidth > d.clientWidth + 1, leaves: out.slice(0, 8) }, null, 1);
})()`;

const r = evalJson(probe);
console.log(JSON.stringify(r, null, 1));

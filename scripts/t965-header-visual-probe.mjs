#!/usr/bin/env node
/**
 * t965 — the header visual probe: the fold rider's walk listed seven
 * non-self-clipping header leaves (+6/+8px each, no clipping ancestor,
 * dialog overX false). Before judging them disease or artifact, this
 * probe asks the VISUAL plane: do header siblings' rects actually
 * INTERSECT (real overlap = disease), and what does the header look
 * like at 320 (screenshot for the record)?
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
await sleep(1500);

/* the header's own geometry: each face row's rect + sibling overlaps +
 * whether any leaf's content is actually cut (a nowrap child bleeding
 * over a SIBLING = overlap; bleeding into PADDING = cosmetic nothing) */
const probe = `(() => {
  const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!d) return JSON.stringify({ open: false });
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
  /* the dialog's content column = the padding box lines */
  const dR = rect(d);
  const overlaps = [];
  const all = [...d.querySelectorAll('*')].filter((el) => {
    const s = getComputedStyle(el);
    return s.overflowX === 'visible' && s.overflowY === 'visible' && el.scrollWidth > el.clientWidth + 1;
  }).slice(0, 12);
  for (const el of all) {
    const r = rect(el);
    /* siblings at the same vertical band */
    const parent = el.parentElement;
    const sibs = [...parent.children].filter((s) => s !== el).map(rect);
    const hit = sibs.find((s) => r.y < s.y + s.h && s.y < r.y + r.h && r.right > s.x + 1 && s.x + s.w > r.x + 1 && s.x >= r.right - 1 ? false : (r.right > s.x && s.x > r.right - 9));
    overlaps.push({ el: el.tagName + '.' + String(el.className).slice(0, 40), rect: r, parentCls: String(parent.className).slice(0, 50), nextSib: hit ?? null });
  }
  /* the walk's own seven, named, with the title's line situation */
  const title = [...d.querySelectorAll('div')].find((x) => (x.textContent || '').includes('— job inspector') && x.children.length <= 2);
  const actions = [...d.querySelectorAll('div')].find((x) => (x.textContent || '').trim().startsWith('Focus'));
  return JSON.stringify({
    open: true,
    dRect: dR,
    overflowers: all.map((el) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 44), sw: el.scrollWidth, cw: el.clientWidth, rect: rect(el) })),
    overlaps,
    titleRect: title ? rect(title) : null,
    actionsRect: actions ? rect(actions) : null,
  }, null, 1);
})()`;

const r = evalJson(probe);
console.log(JSON.stringify(r, null, 1));
sh(`${AB} screenshot shots-qa/t965-inspector-320-files.png`);
console.log("(screenshot saved: shots-qa/t965-inspector-320-files.png)");

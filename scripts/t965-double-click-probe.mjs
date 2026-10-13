#!/usr/bin/env node
/**
 * t965 — the DOUBLE-CLICK probe: the fold rider's one transient RED
 * (a door that went door-less with 603 never observed) matches the
 * stale-closure shape: two clicks inside one render tick both pass the
 * `loadingMore` state guard, two fetches fire (offsets 300, 600), the
 * ledger walks to 653 in ONE user gesture. This probe fires a REAL
 * double click (two down/up pairs 70ms apart) on the door and
 * transcripts the face — evidence before any cure.
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

const face = `(() => {
  const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!d) return JSON.stringify({ open: false });
  const btn = d.querySelector('[data-remote-more]');
  return JSON.stringify({ open: true, mounted: !!btn, rows: d.querySelectorAll('[data-files-table] tbody tr').length });
})()`;

sh(`${AB} set viewport 1280 800`);
sh(`${AB} open ${BASE}/`);
await sleep(3500);

/* open the inspector */
for (let i = 0; i < 5; i++) {
  const pos = evalJson(`(() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME}')); const b = c?.querySelector('[role="button"][tabindex]'); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (pos?.x) { sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); }
  await sleep(1200);
  if (evalJson(face)?.open) break;
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(500);
}
/* Files tab */
const tpos = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const t = [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('Files')); if (!t) return null; const r = t.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
if (tpos?.x) { sh(`${AB} mouse move ${tpos.x} ${tpos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); }
await sleep(1500);
console.log("before:", evalJson(face));

/* THE DOUBLE CLICK: two down/up pairs — the gap is argv[2] ms (default
 * 70 = synthetic-fast; 400 = human-fast). The diagnostic: WHICH offset
 * does the second fetch ride? 653 with the first fetch completed = the
 * door's LEGAL two-page walk (the second click landed on a re-enabled
 * door pointing at the next page); a second fetch at the SAME offset
 * would be the stale-closure disease — but the fresh-diff by path
 * dedupes even that to the same truth. */
const GAP = Number(process.argv[2] ?? 70);
const dpos = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const b = d?.querySelector('[data-remote-more]'); if (!b) return null; b.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), disabled: b.disabled }); })()`);
console.log("door at:", JSON.stringify(dpos), "gap:", GAP);
if (dpos?.x) {
  sh(`${AB} mouse move ${dpos.x} ${dpos.y}`);
  sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await sleep(GAP);
  const mid = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const b = d?.querySelector('[data-remote-more]'); return JSON.stringify({ mounted: !!b, disabled: b?.disabled ?? null, rows: d.querySelectorAll('[data-files-table] tbody tr').length }); })()`);
  console.log("at click2 time (mid):", JSON.stringify(mid));
  if (mid?.mounted && !mid.disabled) {
    sh(`${AB} mouse down`); sh(`${AB} mouse up`);
    console.log("(click2 fired — the door was re-enabled, a LEGAL second click)");
  } else {
    console.log("(click2 withheld — the door was disabled or gone; the guard or the browser swallowed it)");
  }
}
/* transcript: sample fast for 12s */
for (let i = 0; i < 24; i++) {
  const v = evalJson(face);
  console.log(`t${i}:`, JSON.stringify(v));
  if (v && !v.open) break;
  if (v && v.rows === 653) break;
  await sleep(500);
}

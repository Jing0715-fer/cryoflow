#!/usr/bin/env node
/**
 * t963 — the style round's BROWSER PROBE: the door-world gives the style
 * round its first REAL instrument (the deep-band door's loading state has
 * never been triggerable before — no capped world existed). Two measures:
 *
 *   m1  THE DOOR'S WIDTH JITTER — the button's resting width vs its
 *       loading width ("Fetching the ledger's next page…" is a shorter
 *       sentence than "Show 300 more from the cluster ledger"): if the
 *       button's box breathes during the fetch, the table below it and
 *       the note above it ride the jump (the classic layout-shift sin).
 *   m2  THE 320 FOLD — the whole inspector at a 320px viewport: the
 *       dialog's horizontal honesty (scrollWidth vs clientWidth), the
 *       files table's overflow face, the note's wrap.
 *
 *   node scripts/t963-style-probe.mjs
 */
import { execSync } from "node:child_process";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const NAME = "Remote Ledger Door (t963)";

const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
const evalJs = (expr) => {
  try { return execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); }
  catch (e) { return String(e?.stdout ?? "") || "null"; }
};
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* the door-world's jobId (the API knows it by name) */
const doorJobId = () => {
  try { return JSON.parse(sh(`curl -s -H "Origin: ${BASE}" "${BASE}/api/jobs"`)).jobs.find((j) => j.name === NAME)?.id ?? null; } catch { return null; }
};
/* the canvas's gesture system reads POINTER events (a DOM click() never
 * opens the card — the witness's real-mouse ride proved it), so the card
 * must be INSIDE the viewport for the real mouse. When it is not, move
 * it (PATCH the explicit x/y — the mint's own law), wait for the render. */
const placeCard = async (x, y) => {
  const id = doorJobId();
  if (!id) return false;
  sh(`curl -s -X PATCH -H "Origin: ${BASE}" -H "Content-Type: application/json" -d '{"x":${x},"y":${y}}' "${BASE}/api/jobs/${id}"`);
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(`(() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME}')); const b = c?.querySelector('[role="button"][tabindex]'); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), in: r.x >= 0 && r.right <= window.innerWidth && r.y >= 0 && r.bottom <= window.innerHeight }); })()`);
    if (pos?.in === true) return pos;
    await sleep(600);
    if (i === 5) { try { sh(`${AB} open ${BASE}/`); } catch {} }
  }
  return null;
};
/* open the door-world job's inspector: the REAL mouse on an in-view card
 * (the t944 fidelity; a DOM click() never opens the card — the canvas's
 * pointer-driven gesture system ignores it) */
const openDoor = async () => {
  const readPos = () => evalJson(`(() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME}')); const b = c?.querySelector('[role="button"][tabindex]'); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), in: r.x >= 0 && r.right <= window.innerWidth && r.y >= 0 && r.bottom <= window.innerHeight }); })()`);
  let pos = readPos();
  if (!pos?.in) pos = await placeCard(260, 140);
  if (!pos?.in) return false;
  sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await sleep(1600);
  return evalJson(`(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((x) => (x.textContent || '').includes('${NAME}')) }))()`)?.open === true;
};
/* the real-mouse click (the t944 fidelity): Radix owns pointer semantics —
 * a DOM click() opens NOTHING (the tabs' own panels included, the first
 * ride proved it: "clicked" with a face that never changed) */
const realClick = async (findExpr) => {
  const pos = evalJson(`(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0) return null; return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), in: r.x >= 0 && r.right <= window.innerWidth && r.y >= 0 && r.bottom <= window.innerHeight }); })()`);
  if (!pos?.in) return "OFF-VIEWPORT";
  sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  return `clicked@${pos.x},${pos.y}`;
};
const clickFilesTab = async (tries = 4) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('Files')) ?? null; })()`);
    await sleep(1500);
    const face = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); return JSON.stringify({ door: !!d?.querySelector('[data-remote-more]') }); })()`);
    if (face?.door === true) return `open@try${i}`;
    console.log(`  (files tab try ${i + 1}: ${clicked} door=${face?.door})`);
  }
  return "NEVER-OPEN";
};

console.log("== t963 style probe: the door's width jitter + the 320 fold ==");

/* m1 — the door's width, resting vs loading, at a comfortable viewport */
sh(`${AB} set viewport 900 800`);
sh(`${AB} open ${BASE}/`);
await sleep(2000);
if (!(await openDoor())) { console.log("(the door-world inspector would not open at 900)"); process.exit(1); }
if (!(await clickFilesTab())) { console.log("(the Files tab never opened)"); process.exit(1); }
const widths = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); const btn = d?.querySelector('[data-remote-more]'); if (!btn) return JSON.stringify({ err: "no door" }); const r1 = btn.getBoundingClientRect(); return JSON.stringify({ restW: Math.round(r1.width), restH: Math.round(r1.height), fullW: btn.parentElement ? Math.round(btn.parentElement.getBoundingClientRect().width) : null, btnClassWFull: btn.className.includes("w-full") }); })()`);
console.log(`m1 rest: ${JSON.stringify(widths)}`);

/* the loading width: fire the click (a plain React <button> — DOM click
 * fires its onClick honestly), sample every ~30ms for up to 3s */
const jitter = evalJson(`(async () => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); const btn = d?.querySelector('[data-remote-more]'); if (!btn) return JSON.stringify({ err: "no door" }); const restW = Math.round(btn.getBoundingClientRect().width); btn.click(); const seen = []; const t0 = performance.now(); while (performance.now() - t0 < 3000) { const b2 = d.querySelector('[data-remote-more]'); if (!b2) { seen.push({ gone: true }); break; } const r = b2.getBoundingClientRect(); const loading = (b2.textContent || "").includes("Fetching"); seen.push({ w: Math.round(r.width), h: Math.round(r.height), loading }); if (!loading && seen.length > 4) break; await new Promise((rr) => setTimeout(rr, 30)); } const ws = seen.filter((s) => s.w != null).map((s) => s.w); const loadingSeen = seen.filter((s) => s.loading); return JSON.stringify({ samples: seen.length, restW, minW: Math.min(...ws), maxW: Math.max(...ws), loadingCount: loadingSeen.length, loadingW: loadingSeen[0]?.w ?? null, loadingH: loadingSeen[0]?.h ?? null }); })()`);
console.log(`m1 jitter: ${JSON.stringify(jitter)}`);

/* restore: refresh folds the band back (the ride left the ledger walked) */
evalJs(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); const b = [...(d?.querySelectorAll('button') ?? [])].find((x) => (x.textContent || '').trim() === 'Refresh'); if (b) b.click(); return "refreshed"; })()`);
await sleep(1200);
try { sh(`${AB} press Escape`); } catch {}
await sleep(500);

/* m2 — the 320 fold: the whole inspector at the narrow viewport */
sh(`${AB} set viewport 320 640`);
sh(`${AB} open ${BASE}/`);
await sleep(2200);
const narrow = evalJson(`(() => { const doc = document.documentElement; const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME}')); if (!c) return JSON.stringify({ err: "no card at 320" }); const b = c.querySelector('[role="button"][tabindex]'); if (!b) return JSON.stringify({ err: "no card button" }); const r = b.getBoundingClientRect(); return JSON.stringify({ pageOverX: doc.scrollWidth > doc.clientWidth + 1, pageSW: doc.scrollWidth, cardX: Math.round(r.x), cardW: Math.round(r.width) }); })()`);
console.log(`m2 canvas at 320: ${JSON.stringify(narrow)}`);

if (narrow && narrow.cardX) {
  if (!(await openDoor())) { console.log("(the door-world inspector would not open at 320)"); }
  else if (!(await clickFilesTab())) { console.log("(the Files tab never opened at 320)"); }
  else {
    const fold = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); if (!d) return JSON.stringify({ open: false }); const note = d.querySelector('[data-listing-note]'); const offenders = []; const walk = (el, depth) => { if (depth > 18) return; const srOnly = typeof el.className === "string" && el.className.includes("sr-only"); if (!srOnly && el.scrollWidth > el.clientWidth + 1) { offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 90), sw: el.scrollWidth, cw: el.clientWidth, over: el.scrollWidth - el.clientWidth, text: (el.textContent || "").trim().slice(0, 50) }); } for (const c of el.children) walk(c, depth + 1); }; walk(d, 0); offenders.sort((a, b) => b.over - a.over); return JSON.stringify({ open: true, dialogW: Math.round(d.getBoundingClientRect().width), dialogOverX: d.scrollWidth > d.clientWidth + 1, dialogSW: d.scrollWidth, dialogCW: d.clientWidth, noteOverX: note ? note.scrollWidth > note.clientWidth + 1 : null, offenders: offenders.slice(0, 12) }); })()`);
    console.log(`m2 dialog at 320: ${JSON.stringify(fold, null, 1)}`);
    try { sh(`${AB} press Escape`); } catch {}
  }
}
console.log("== probe done (read the numbers, then decide the cures) ==");

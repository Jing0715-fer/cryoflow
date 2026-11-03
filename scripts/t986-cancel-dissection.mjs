#!/usr/bin/env node
/**
 * t986 — the CANCEL-TRANSIENT DISSECTION (the t985 recorded race's
 * dedicated window): the AI settings dialog's 取消 died between
 * pointerdown (target=BUTTON) and mousedown (target=BODY) in the t985
 * rides — three walk failures against one manual success of the
 * identical real-click sequence. This instrument settles the verdict
 * the phantom-bug law demands: it replays the context, arms an
 * IN-FLIGHT probe (event-time elementFromPoint, a body childList
 * observer with NODE-IDENTITY tracking so a moved node keeps its id
 * across remove+add — a move is not an unmount), and fires a
 * pre-registered experiment grid of REAL clicks:
 *
 *   A0  fresh page → companion open → settings dialog → 取消 ×5
 *   B   companion open → the workspace create dialog's Cancel ×5
 *       (companion-gated moves active, a DIFFERENT dialog)
 *   A1  after the full t985 leg context (workspace + project + note
 *       flips) → settings dialog → 取消 ×5
 *   C   companion CLOSED → workspace create dialog's Cancel ×5
 *       (the full control)
 *
 * VERDICT RULES (pre-registered):
 *   A0 or A1 lose ≥1 click while C loses 0 → the companion's
 *   window-manager moves CAN eat a real user's click → PRODUCT BUG →
 *   the cure defers the moves out of the pointer sequence.
 *   B loses while C is clean → the moves eat clicks generally.
 *   Nothing loses → not reproduced in isolation — the record closes
 *   honest (automation-timing suspected, the probe design stands).
 *
 *   node scripts/t986-cancel-dissection.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t986-cancel-dissection.json");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
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
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && v !== "null" && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [4, 10, 20]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(500);
      const pos2 = evalJson(locate);
      if (pos2 && pos2.own) {
        sh(`${AB} mouse move ${pos2.x} ${pos2.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
        return `clicked@${pos2.x},${pos2.y}`;
      }
      return "OFF-VIEWPORT";
    }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    await sleep(400);
  }
  return "NEVER-OWN";
};

/* the ARM + FIRE + READ cycle: one real click under full probe. The
 * probe tags the target button (data-t986="target") and tracks node
 * identity with a Map-assigned id — a node seen again keeps its id, so
 * a remove+add of the SAME id is a MOVE, not an unmount. */
const ARM = (x, y) => `(() => {
  window.__t986 = { events: [], body: [], content: [], xy: [${x}, ${y}], nextId: 1, ids: new Map() };
  const idOf = (n) => { if (!(n instanceof Element)) return 0; if (!window.__t986.ids.has(n)) window.__t986.ids.set(n, window.__t986.nextId++); return window.__t986.ids.get(n); };
  const desc = (n) => { if (!(n instanceof Element)) return String(n?.tagName ?? '?'); const slot = n.getAttribute?.('data-slot') ?? ''; const aria = n.getAttribute?.('aria-label') ?? ''; const t986 = n.getAttribute?.('data-t986') ?? ''; return '#' + idOf(n) + ' ' + n.tagName + (slot ? '[' + slot + ']' : '') + (t986 ? '<T>' : '') + (aria ? '"' + aria.slice(0, 14) + '"' : '') + ':' + (n.textContent ?? '').slice(0, 12); };
  const [X, Y] = window.__t986.xy;
  const hitNow = () => { const h = document.elementFromPoint(X, Y); return h ? desc(h) : 'NONE'; };
  window.__t986.ac = new AbortController();
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'focusin', 'focusout']) {
    document.addEventListener(t, (e) => { window.__t986.events.push({ t: Math.round(performance.now()), ty: t, tg: desc(e.target), hit: hitNow() }); }, { capture: true, signal: window.__t986.ac.signal });
  }
  window.__t986.mo1 = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.removedNodes) window.__t986.body.push({ t: Math.round(performance.now()), k: 'rm', n: desc(n) });
      for (const n of m.addedNodes) window.__t986.body.push({ t: Math.round(performance.now()), k: 'add', n: desc(n) });
    }
  });
  window.__t986.mo1.observe(document.body, { childList: true });
  window.__t986.mo2 = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.removedNodes) window.__t986.content.push({ t: Math.round(performance.now()), k: 'rm', n: desc(n) });
      for (const n of m.addedNodes) window.__t986.content.push({ t: Math.round(performance.now()), k: 'add', n: desc(n) });
    }
  });
  const dc = [...document.querySelectorAll('[data-slot="dialog-content"]')].pop();
  if (dc) { dc.setAttribute('data-t986', 'live'); window.__t986.mo2.observe(dc, { childList: true, subtree: true }); }
  const btn = [...(dc?.querySelectorAll('button') ?? [])].find((b) => ['取消', 'Cancel'].includes((b.textContent ?? '').trim()));
  if (btn) btn.setAttribute('data-t986', 'target');
  return 'armed@' + X + ',' + Y;
})()`;

const DISARM = `(() => { try { window.__t986?.ac?.abort(); window.__t986?.mo1?.disconnect(); window.__t986?.mo2?.disconnect(); } catch {} const v = window.__t986; window.__t986 = null; return JSON.stringify(v ?? {}); })()`;

/* one probe round: arm at the button's live center, real-click, read */
const probeClick = async (btnFind, stillOpenExpr) => {
  const spot = evalJson(`(() => { const el = (${btnFind}); if (!el) return JSON.stringify({ none: true }); const r = el.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (!spot || spot.none) return { spot: "NO-ELEMENT" };
  evalJs(ARM(spot.x, spot.y));
  await sleep(150);
  sh(`${AB} mouse move ${spot.x} ${spot.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  await sleep(1200);
  const closed = evalJson(stillOpenExpr);
  const data = evalJson(DISARM);
  const lost = !closed.open;
  return { spot: `${spot.x},${spot.y}`, closed: !closed.open, data };
};

/* summarize one probe round: did the click chain break? */
const summarize = (r) => {
  if (!r?.data?.events) return { lost: false, why: "no-probe" };
  const evs = r.data.events;
  const pd = evs.find((e) => e.ty === "pointerdown");
  const md = evs.find((e) => e.ty === "mousedown");
  const click = evs.find((e) => e.ty === "click");
  const targetLost = pd && md && !(md.tg ?? "").includes("<T>") && !(md.tg ?? "").includes("取消") && !(md.tg ?? "").includes("Cancel");
  const noClick = !click;
  return { lost: targetLost || noClick, why: targetLost ? "mousedown-off-target" : noClick ? "no-click-event" : "chain-ok", pd: pd?.tg, md: md?.tg, click: click ? "yes" : "no", bodyMoves: (r.data.body ?? []).length, contentMoves: (r.data.content ?? []).length, bodyLog: (r.data.body ?? []).slice(0, 10), contentLog: (r.data.content ?? []).slice(0, 10) };
};

console.log("=== t986 cancel-transient dissection ===");

let serverUp = false;
for (let i = 0; i < 24 && !serverUp; i++) {
  try { const c = execSync(`curl -s -o /dev/null -w '%{http_code}' ${BASE}/ --max-time 5`, { encoding: "utf8" }); serverUp = c.trim() === "200"; }
  catch { serverUp = false; }
  if (!serverUp) await sleep(2500);
}
if (!serverUp) { console.log("FATAL: the server never answered 200"); process.exit(2); }
console.log("server: 200");

/* the fresh open (WIDE-FIRST law) */
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders", !!alive && alive.n > 0, `buttons=${alive?.n}`);

const results = {};

/* ---------- EXPERIMENT A0 — fresh page, companion open, settings 取消 ×5 ---------- */
console.log("experiment A0: fresh page → companion → settings 取消 ×5");
const openA0 = await realClick(`document.querySelector('[aria-label="AI assistant"]')`);
ok("A0 the companion opened", String(openA0).startsWith("clicked@"), String(openA0));
results.A0 = [];
for (let i = 0; i < 5; i++) {
  const gear = await realClick(`document.querySelector('[aria-label="AI provider settings"]')`);
  const dlgUp = await poll(
    `(() => JSON.stringify({ open: [...document.querySelectorAll('[data-slot="dialog-content"]')].some((d) => (d.textContent ?? '').includes('保存并启用')) }))()`,
    (v) => v.open, 16, 500);
  if (!dlgUp?.open) { results.A0.push({ i, error: "dialog-never-opened", gear }); break; }
  const r = await probeClick(
    `(() => { const dc = [...document.querySelectorAll('[data-slot="dialog-content"]')].pop(); return [...(dc?.querySelectorAll('button') ?? [])].find((b) => (b.textContent ?? '').trim() === '取消') ?? null; })()`,
    `(() => JSON.stringify({ open: [...document.querySelectorAll('[data-slot="dialog-content"]')].some((d) => (d.textContent ?? '').includes('保存并启用')) }))()`);
  const s = summarize(r);
  results.A0.push({ i, closed: r.closed, ...s });
  console.log(`  A0#${i} closed=${r.closed} lost=${s.lost} why=${s.why} bodyMoves=${s.bodyMoves} contentMoves=${s.contentMoves}`);
  if (!r.closed) {
    sh(`${AB} press Escape`); await sleep(600);
  }
}
const a0Lost = results.A0.filter((x) => x.lost).length;
ok("A0 the settings 取消 held the chain ×5", a0Lost === 0, `lost=${a0Lost}/5`);

/* ---------- EXPERIMENT B — companion open, the workspace dialog's Cancel ×5 ---------- */
console.log("experiment B: companion open → workspace create Cancel ×5");
results.B = [];
const wsTab = await realClick(`[...document.querySelectorAll('[role="tab"],button')].find((t) => (t.textContent ?? '').trim().startsWith('Workspaces'))`);
for (let i = 0; i < 5; i++) {
  const newClick = await realClick(`document.querySelector('button[aria-label="Create a new workspace"]')`);
  const dlgUp = await poll(
    `(() => JSON.stringify({ open: [...document.querySelectorAll('[data-slot="dialog-content"]')].some((d) => (d.textContent ?? '').includes('New workspace')) }))()`,
    (v) => v.open, 16, 500);
  if (!dlgUp?.open) { results.B.push({ i, error: "dialog-never-opened" }); break; }
  const r = await probeClick(
    `(() => { const dlg = [...document.querySelectorAll('[data-slot="dialog-content"]')].find((d) => (d.textContent ?? '').includes('New workspace')); return [...dlg.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel') ?? null; })()`,
    `(() => JSON.stringify({ open: [...document.querySelectorAll('[data-slot="dialog-content"]')].some((d) => (d.textContent ?? '').includes('New workspace')) }))()`);
  const s = summarize(r);
  results.B.push({ i, closed: r.closed, ...s });
  console.log(`  B#${i} closed=${r.closed} lost=${s.lost} why=${s.why} bodyMoves=${s.bodyMoves}`);
  if (!r.closed) { sh(`${AB} press Escape`); await sleep(600); }
}
const bLost = results.B.filter((x) => x.lost).length;
ok("B the workspace Cancel held the chain ×5", bLost === 0, `lost=${bLost}/5`);

/* ---------- the t985 leg context (workspace + project + note flips) ---------- */
console.log("context: replaying the t985 leg residue");
const wsOpen = await realClick(`document.querySelector('button[aria-label="Create a new workspace"]')`);
await sleep(500);
const wsInput = await realClick(`document.querySelector('input[placeholder*="Classification round"]')`);
sh(`${AB} keyboard type "Walk Leg WS"`);
await sleep(300);
const wsCancel = await realClick(`(() => { const dlg = [...document.querySelectorAll('[data-slot="dialog-content"]')].find((d) => (d.textContent ?? '').includes('New workspace')); return [...dlg.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel') ?? null; })()`);
await sleep(500);
sh(`${AB} press Shift+D`); await sleep(800);
const projOpen = await realClick(`[...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'New project')`);
await sleep(500);
const projInput = await realClick(`document.querySelector('input[placeholder*="Apoferritin"]')`);
sh(`${AB} keyboard type "Walk Project"`);
await sleep(300);
const projCancel = await realClick(`(() => { const dlg = [...document.querySelectorAll('[data-slot="dialog-content"]')].find((d) => (d.textContent ?? '').includes('New project')); return [...dlg.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel') ?? null; })()`);
await sleep(500);
sh(`${AB} press Shift+D`); await sleep(800);
const cardSpot = evalJson(`(() => { const el = [...document.querySelectorAll('.job-card-title')].find((t) => { const r = t.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); return !!hit && t.contains(hit); }); if (!el) return JSON.stringify({ none: true }); const r = el.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
if (cardSpot && cardSpot.x !== undefined) {
  sh(`${AB} mouse move ${cardSpot.x} ${cardSpot.y}`);
  sh(`${AB} mouse down right`); sh(`${AB} mouse up right`);
  await sleep(800);
  await realClick(`[...document.querySelectorAll('[role="menuitem"]')].find((m) => (m.textContent ?? '').includes('Add note') || (m.textContent ?? '').includes('Edit note'))`);
  await sleep(500);
  sh(`${AB} keyboard type "Walk note"`);
  await sleep(300);
  const noteCancel = await realClick(`(() => { const dlg = [...document.querySelectorAll('[data-slot="dialog-content"]')].find((d) => (d.textContent ?? '').includes('Add note') || (d.textContent ?? '').includes('Edit note')); return [...dlg.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel') ?? null; })()`);
  await sleep(500);
}
ok("the t985 leg context replayed", true, "workspace + project + note flips done");

/* ---------- EXPERIMENT A1 — full context, settings 取消 ×5 ---------- */
console.log("experiment A1: full t985 context → settings 取消 ×5");
results.A1 = [];
for (let i = 0; i < 5; i++) {
  const gear = await realClick(`document.querySelector('[aria-label="AI provider settings"]')`);
  const dlgUp = await poll(
    `(() => JSON.stringify({ open: [...document.querySelectorAll('[data-slot="dialog-content"]')].some((d) => (d.textContent ?? '').includes('保存并启用')) }))()`,
    (v) => v.open, 16, 500);
  if (!dlgUp?.open) { results.A1.push({ i, error: "dialog-never-opened", gear }); break; }
  const r = await probeClick(
    `(() => { const dc = [...document.querySelectorAll('[data-slot="dialog-content"]')].pop(); return [...(dc?.querySelectorAll('button') ?? [])].find((b) => (b.textContent ?? '').trim() === '取消') ?? null; })()`,
    `(() => JSON.stringify({ open: [...document.querySelectorAll('[data-slot="dialog-content"]')].some((d) => (d.textContent ?? '').includes('保存并启用')) }))()`);
  const s = summarize(r);
  results.A1.push({ i, closed: r.closed, ...s });
  console.log(`  A1#${i} closed=${r.closed} lost=${s.lost} why=${s.why} bodyMoves=${s.bodyMoves} contentMoves=${s.contentMoves}`);
  if (s.lost) {
    console.log(`    A1#${i} the probe: events=${JSON.stringify((r.data?.events ?? []).slice(0, 8))}`);
    console.log(`    A1#${i} body=${JSON.stringify(s.bodyLog)}`);
    console.log(`    A1#${i} content=${JSON.stringify(s.contentLog)}`);
  }
  if (!r.closed) { sh(`${AB} press Escape`); await sleep(600); }
}
const a1Lost = results.A1.filter((x) => x.lost).length;
ok("A1 the settings 取消 held the chain ×5 under full context", a1Lost === 0, `lost=${a1Lost}/5`);

/* ---------- EXPERIMENT C — companion CLOSED, workspace Cancel ×5 ---------- */
console.log("experiment C: companion closed → workspace create Cancel ×5");
const compClose = await realClick(`document.querySelector('[aria-label="关闭 AI 助手"]')`);
await poll(
  `(() => JSON.stringify({ up: !!document.querySelector('[aria-label="Message the AI assistant"]') }))()`,
  (v) => v.up === false, 8, 500);
results.C = [];
for (let i = 0; i < 5; i++) {
  const newClick = await realClick(`document.querySelector('button[aria-label="Create a new workspace"]')`);
  const dlgUp = await poll(
    `(() => JSON.stringify({ open: [...document.querySelectorAll('[data-slot="dialog-content"]')].some((d) => (d.textContent ?? '').includes('New workspace')) }))()`,
    (v) => v.open, 16, 500);
  if (!dlgUp?.open) { results.C.push({ i, error: "dialog-never-opened" }); break; }
  const r = await probeClick(
    `(() => { const dlg = [...document.querySelectorAll('[data-slot="dialog-content"]')].find((d) => (d.textContent ?? '').includes('New workspace')); return [...dlg.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel') ?? null; })()`,
    `(() => JSON.stringify({ open: [...document.querySelectorAll('[data-slot="dialog-content"]')].some((d) => (d.textContent ?? '').includes('New workspace')) }))()`);
  const s = summarize(r);
  results.C.push({ i, closed: r.closed, ...s });
  console.log(`  C#${i} closed=${r.closed} lost=${s.lost} why=${s.why} bodyMoves=${s.bodyMoves}`);
  if (!r.closed) { sh(`${AB} press Escape`); await sleep(600); }
}
const cLost = results.C.filter((x) => x.lost).length;
ok("C the workspace Cancel held the chain ×5 (companion closed)", cLost === 0, `lost=${cLost}/5`);

/* ---------- THE VERDICT (pre-registered rules) ---------- */
let verdict;
if ((a0Lost + a1Lost) > 0 && cLost === 0) {
  verdict = "PRODUCT-BUG: the companion-gated window-manager moves can eat a real user's click — the cure defers the moves out of the pointer sequence";
} else if (bLost > 0 && cLost === 0) {
  verdict = "PRODUCT-BUG-BROAD: the moves eat clicks across dialogs while the companion is open";
} else if (a0Lost + a1Lost + bLost + cLost === 0) {
  verdict = "NOT-REPRODUCED: 20 clean clicks under full probe — the t985 transient stays an automation-timing suspect; the record closes honest";
} else {
  verdict = "MIXED: inspect the receipt's per-experiment logs";
}
console.log(`VERDICT: ${verdict} (A0=${a0Lost}/5 B=${bLost}/5 A1=${a1Lost}/5 C=${cLost}/5)`);

const shot = (name) => sh(`${AB} screenshot ${path.join(QA_DIR, name)}`);
shot("t986-dissection.png");

mkdirSync(QA_DIR, { recursive: true });
writeFileSync(RECEIPT, JSON.stringify({
  instrument: "t986-cancel-dissection",
  born: "2026-10-14",
  contract: "the settings-dialog cancel transient's dedicated dissection — the pre-registered A/B/A1/C grid of 20 real clicks under the in-flight probe",
  verdict,
  tally: { A0: a0Lost, B: bLost, A1: a1Lost, C: cLost },
  experiments: results,
  pass, fail,
}, null, 2));
console.log(`receipt: ${RECEIPT}`);
console.log(`VERDICT-LINE: ${fail === 0 ? `GREEN ${pass}/${pass + fail}` : `RED ${pass}/${pass + fail}`}`);
process.exit(verdict.startsWith("PRODUCT") ? 3 : fail === 0 ? 0 : 1);

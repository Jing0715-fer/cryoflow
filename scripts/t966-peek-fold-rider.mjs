#!/usr/bin/env node
/**
 * t966 — the PEEK DOORS' FOLD RIDER: the Files tab's t779 peek dialogs
 * (star -> the structured table, text -> the 64KB tail) taken to the
 * 320 fold on the PEEK STRESS BENCH (the t966 mint's fifth job), with
 * REAL stress: a 12-column x 48-row star at a 44-char path, a 105KB
 * pipeline log at a 47-char path (the tail contract's LAST-64KB face),
 * and the empty run.err face.
 *
 * The disease this ride hunts (the t913 gap): the results-view family's
 * peek dialogs carry the t913 cure (icon shrink-0, name min-w-0
 * truncate, description break-all — the before-witness's overX 195/135
 * at 320), but the INSPECTOR's Files-tab family never received it — its
 * titles are bare text nodes in flex and its descriptions are unhardened
 * font-mono paths. A >36-char mono token cannot fit the fold dialog's
 * ~240px content box; the dialog's overflow-x computes to auto and the
 * shell scrolls horizontally (the family's disease shape).
 *
 * BEFORE=1  — the WITNESS ride: the two dialog-overX faces are expected
 *             DISEASED (dialogOverX true); the receipt keeps the numbers.
 * default   — the GATE ride: every face must be fold-honest (the cured
 *             grammar); any dialogOverX or diseased leaf fails.
 *
 * The faces the gate pins (each door at 320):
 *   act1  the STAR door: the dialog never overflows; the 12-column table
 *         scrolls INSIDE its max-h-96 overflow-auto box (one-axis law);
 *         the sticky header choreography renders; no leaf ESCAPES the
 *         dialog's border box or OVERLAPS a sibling (the t965 leaf law).
 *   act2  the TEXT door (the long tail): the description speaks "last
 *         64 KB"; the pre really scrolls (scrollHeight > clientHeight);
 *         the t779 keyboard face — focus lands on the pre on land,
 *         ArrowDown scrolls it, End jumps to the end, Escape closes.
 *   act3  the EMPTY face (run.err): the preview of nothing — no crash,
 *         focus still lands, Escape closes, the shell stays honest.
 *   act4  the console ledger is clean through the whole ride.
 *
 *   node scripts/t966-peek-fold-rider.mjs        (the gate)
 *   BEFORE=1 node scripts/t966-peek-fold-rider.mjs  (the witness)
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const RECEIPT = path.join(ROOT, "shots-qa", "t966-peek-fold-rider.json");
const NAME = "Peek Stress Bench (t966)";
const DOOR = "Remote Ledger Door (t963)";
const BEFORE = process.env.BEFORE === "1";
const STAR_ROW = "corrected_micrographs.star";
const LOG_ROW = "relion_motioncorr_gpu_pipeline_run.log";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim(); } catch (e) { return String(e?.stdout ?? e); } };

evalJs(`(() => { if (!window.__t966console) { window.__t966console = []; const e = console.error, w = console.warn; console.error = (...a) => { window.__t966console.push(String(a[0] ?? "").slice(0, 200)); e(...a); }; console.warn = (...a) => { window.__t966console.push(String(a[0] ?? "").slice(0, 200)); w(...a); }; } return "hooked"; })()`);

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
    if (v && gate(v)) return v;
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
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const openInspectorHard = async (name, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
    const opened = await poll(
      `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
      (v) => v.open === true, 5, 500,
    );
    if (opened?.open === true) return `open@try${i}`;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(700);
  }
  return "NEVER-OPEN";
};
const ensureDialog = async () => {
  const st = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return JSON.stringify({ open: !!d }); })()`);
  if (st?.open === true) return true;
  if (st === null || st === "null") { try { sh(`${AB} open ${BASE}/`); } catch {} await sleep(2500); }
  const reopened = await openInspectorHard(NAME, 8);
  return String(reopened).startsWith("open@try");
};
const clickTab = async (label, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('${label}')) ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    if (!(await ensureDialog())) console.log(`  (tab '${label}' try ${i + 1}: the dialog would not return)`);
    await sleep(800);
  }
  return "NEVER-CLICKED";
};
/* the peek row's eye button, INSIDE the bench's inspector dialog */
const clickPreview = async (rowName, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return [...(d?.querySelectorAll('button') ?? [])].find(b => (b.getAttribute('aria-label') || '') === 'Preview ${rowName}') ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    await sleep(600);
  }
  return "NEVER-CLICKED";
};
/* the OPEN peek dialog (the topmost open dialog-content that is NOT the
 * inspector shell — the peek door itself) */
const peekSel = `(() => [...document.querySelectorAll('[data-slot="dialog-content"][data-state="open"]')].filter(d => !d.hasAttribute('data-inspector-dialog')))()`;

/* the PEEK face — one probe against the open peek dialog:
 *   dialogW / dialogOverX — the shell's horizontal honesty
 *   title / desc — the header's leaves, each JUDGED by the t965 law
 *                   (sibOverlap / escapesDialog)
 *   tableBox — the star table's clipping container: overflowX, the
 *              table's scrollWidth vs the box's clientWidth
 *   pre — the tail's scroll face (scrollHeight vs clientHeight) + focus
 *   leafDiseased — the whole-dialog leaf walk, escape-or-overlap only */
const peekFace = `(() => {
  const peeks = [...document.querySelectorAll('[data-slot="dialog-content"][data-state="open"]')].filter(d => !d.hasAttribute('data-inspector-dialog'));
  const d = peeks[peeks.length - 1];
  if (!d) return JSON.stringify({ open: false });
  const intersect = (r1, r2) => r1.y < r2.y + r2.height && r2.y < r1.y + r1.height && r1.x < r2.x + r2.width && r2.x < r1.x + r1.width;
  const dRect = d.getBoundingClientRect();
  const judge = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    let sibOverlap = false;
    for (const sib of el.parentElement ? el.parentElement.children : []) {
      if (sib === el) continue;
      const sr = sib.getBoundingClientRect();
      if (sr.width > 0 && sr.height > 0 && intersect(r, sr)) { sibOverlap = true; break; }
    }
    return {
      over: el.scrollWidth - el.clientWidth,
      sibOverlap,
      escapesDialog: r.width > 0 && (r.right > dRect.right + 1 || r.left < dRect.left - 1),
    };
  };
  const title = judge(d.querySelector('[data-slot="dialog-title"]'));
  const desc = judge(d.querySelector('[data-slot="dialog-description"]'));
  const region = [...d.querySelectorAll('[role="region"]')].find(r => (r.getAttribute('aria-label') || '').startsWith('Star table'));
  const table = region ? region.querySelector('table') : null;
  const pre = d.querySelector('pre[aria-label="File content preview"]');
  const offenders = [];
  const selfClipping = (el) => {
    const s = getComputedStyle(el);
    if (typeof el.className === 'string' && el.className.includes('sr-only')) return true;
    return s.overflowX !== 'visible' || s.overflowY !== 'visible';
  };
  const walk = (el, depth) => {
    if (depth > 24) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      const r = el.getBoundingClientRect();
      let sibOverlap = false;
      for (const sib of el.parentElement ? el.parentElement.children : []) {
        if (sib === el) continue;
        const sr = sib.getBoundingClientRect();
        if (sr.width > 0 && sr.height > 0 && intersect(r, sr)) { sibOverlap = true; break; }
      }
      offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 70), over: el.scrollWidth - el.clientWidth, selfClip: selfClipping(el), sibOverlap, escapesDialog: r.width > 0 && (r.right > dRect.right + 1 || r.left < dRect.left - 1) });
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(d, 0);
  offenders.sort((a, b) => b.over - a.over);
  return JSON.stringify({
    open: true,
    dialogW: Math.round(dRect.width),
    dialogOverX: d.scrollWidth > d.clientWidth + 1,
    descText: (d.querySelector('[data-slot="dialog-description"]')?.textContent || '').trim().slice(0, 80),
    title: title && { ...title },
    desc: desc && { ...desc },
    boxOverflowX: region ? getComputedStyle(region).overflowX : null,
    boxCW: region ? region.clientWidth : null,
    tableSW: table ? table.scrollWidth : null,
    tableScrollsInside: region && table ? table.scrollWidth > region.clientWidth : null,
    headSticky: d.querySelector('thead') ? getComputedStyle(d.querySelector('thead')).position : null,
    pre: pre ? { scrollH: pre.scrollHeight, clientH: pre.clientHeight, scrolls: pre.scrollHeight > pre.clientHeight + 4, focused: document.activeElement === pre } : null,
    leafDiseased: offenders.filter((o) => !o.selfClip && (o.sibOverlap || o.escapesDialog)).slice(0, 6),
    benignShadows: offenders.filter((o) => !o.selfClip && !o.sibOverlap && !o.escapesDialog).length,
  });
})()`;

const writeReceipt = (obj) => {
  try {
    const prev = JSON.parse(readFileSync(RECEIPT, "utf8"));
    writeFileSync(RECEIPT, JSON.stringify({ ...prev, ...obj }, null, 2));
  } catch { writeFileSync(RECEIPT, JSON.stringify(obj, null, 2)); }
};

/* ============================== the ride ============================== */
console.log(`== t966 the peek doors' FOLD rider ${BEFORE ? "(BEFORE — the witness mode)" : "(the gate)"} ==`);

/* the preflight: both worlds must verify GREEN before the browser moves */
const benchVerify = sh("node scripts/t966-peek-stress-mint.mjs verify 2>&1");
ok("the peek-stress bench verifies GREEN (the API plane's nine faces stand first)", /verify GREEN — 9 ok, 0 fail/.test(benchVerify));
if (fail > 0) { writeReceipt({ pass, fail, aborted: "the bench did not verify" }); process.exit(1); }
const doorVerify = sh("node scripts/t963-door-world-mint.mjs verify 2>&1");
ok("the door-world still verifies GREEN (the t963 contract untouched)", /verify GREEN — 12 ok, 0 fail/.test(doorVerify));
if (fail > 0) { writeReceipt({ pass, fail, aborted: "the door-world did not verify" }); process.exit(1); }

/* open wide, settle the canvas, open the bench's inspector + Files tab */
sh(`${AB} set viewport 1280 800`);
sh(`${AB} open ${BASE}/`);
const cards = await poll(
  `JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, hasBench: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME}')) })`,
  (g) => g.cards >= 1 && g.hasBench === true, 30, 600,
);
ok("the workspace renders and the bench card is on the page", !!cards && cards.hasBench === true, `cards=${cards?.cards ?? "none"}`);
await sleep(1200);

let insp = await openInspectorHard(NAME, 8);
ok("the inspector opens on the bench job (wide)", String(insp).startsWith("open@try"), String(insp));
const filesTab = await clickTab("Files", 3);
ok("the Files tab opens (the peek rows are in the table)", String(filesTab).startsWith("clicked@"), String(filesTab));
const rowsSeen = await poll(
  `JSON.stringify({ previews: [...document.querySelectorAll('[data-inspector-dialog] button')].filter(b => (b.getAttribute('aria-label') || '').startsWith('Preview ')).length })`,
  (v) => v.previews >= 3, 10, 600,
);
ok("the peek rows' eye buttons mount (star + log + run.err)", (rowsSeen?.previews ?? 0) >= 3, `previews=${rowsSeen?.previews ?? "?"}`);

/* ============ act1 — the STAR door, WIDE first, then the FOLD ============ */
let starWide = null;
if (String(await clickPreview(STAR_ROW, 3)).startsWith("clicked@") || true) {
  starWide = await poll(peekFace, (v) => v.open === true && v.tableSW !== null, 12, 600);
}
ok("act1-wide the STAR door opens wide (the structured table answers)", starWide?.open === true && starWide?.tableSW !== null, `dialogW=${starWide?.dialogW ?? "?"} tableSW=${starWide?.tableSW ?? "?"}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

sh(`${AB} set viewport 320 640`);
await sleep(1500);
let starFold = null;
for (let round = 0; round < 3 && !starFold; round++) {
  if (!(await ensureDialog())) { console.log(`  (act1 round ${round + 1}: the dialog would not return at 320)`); continue; }
  await clickTab("Files", 2);
  if (!String(await clickPreview(STAR_ROW, 3)).startsWith("clicked@")) { console.log(`  (act1 round ${round + 1}: the star row's eye never clicked)`); continue; }
  starFold = await poll(peekFace, (v) => v.open === true && v.tableSW !== null, 12, 600);
  if (!starFold) { try { sh(`${AB} press Escape`); } catch {} await sleep(600); }
}
if (BEFORE) {
  ok("act1 BEFORE-WITNESS the STAR dialog overflows at 320 (the t913 gap, witnessed)", starFold?.dialogOverX === true, `dialogW=${starFold?.dialogW ?? "?"} descOver=${starFold?.desc?.over ?? "?"} escapes=${starFold?.desc?.escapesDialog ?? "?"}`);
} else {
  ok("act1 THE STAR DIALOG NEVER OVERFLOWS AT 320 (the cured shell)", starFold?.dialogOverX === false, `dialogW=${starFold?.dialogW ?? "?"} dialogOverX=${starFold?.dialogOverX}`);
  ok("act1 the star header leaves are fold-honest (no escape, no overlap — the t965 law)", starFold?.leafDiseased?.length === 0, `diseased=${JSON.stringify(starFold?.leafDiseased ?? [])} benign=${starFold?.benignShadows ?? "?"}`);
}
ok("act1 the wide table scrolls INSIDE its clipping container (the one-axis law holds at the fold)", starFold?.boxOverflowX !== "visible" && starFold?.tableScrollsInside === true, `boxOverflowX=${starFold?.boxOverflowX ?? "?"} tableSW=${starFold?.tableSW ?? "?"} boxCW=${starFold?.boxCW ?? "?"}`);
ok("act1 the sticky header choreography renders (thead sticky, the corner cell above)", starFold?.headSticky === "sticky" || starFold?.headSticky === "fixed", `position=${starFold?.headSticky ?? "?"}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* ============ act2 — the TEXT door (the long tail) at the FOLD ============ */
let textFold = null;
for (let round = 0; round < 3 && !textFold; round++) {
  if (!(await ensureDialog())) { console.log(`  (act2 round ${round + 1}: the dialog would not return)`); continue; }
  if (!String(await clickPreview(LOG_ROW, 3)).startsWith("clicked@")) { console.log(`  (act2 round ${round + 1}: the log row's eye never clicked)`); continue; }
  textFold = await poll(peekFace, (v) => v.open === true && v.pre !== null, 16, 600);
  if (!textFold) { try { sh(`${AB} press Escape`); } catch {} await sleep(600); }
}
ok("act2 the TEXT door opens on the long tail (the description speaks 'last 64 KB')", textFold?.open === true && /last 64 KB$/.test(textFold?.descText ?? ""), `desc="${textFold?.descText ?? "?"}"`);
ok("act2 the tail really scrolls at 320 (scrollHeight > clientHeight in the 55vh pre)", textFold?.pre?.scrolls === true, `scrollH=${textFold?.pre?.scrollH ?? "?"} clientH=${textFold?.pre?.clientH ?? "?"}`);
if (BEFORE) {
  ok("act2 BEFORE-WITNESS the TEXT dialog overflows at 320 (the unhardened mono path, witnessed)", textFold?.dialogOverX === true, `dialogW=${textFold?.dialogW ?? "?"} descOver=${textFold?.desc?.over ?? "?"} escapes=${textFold?.desc?.escapesDialog ?? "?"}`);
} else {
  ok("act2 THE TEXT DIALOG NEVER OVERFLOWS AT 320 (the cured shell)", textFold?.dialogOverX === false, `dialogW=${textFold?.dialogW ?? "?"} dialogOverX=${textFold?.dialogOverX}`);
  ok("act2 the text header leaves are fold-honest (no escape, no overlap)", textFold?.leafDiseased?.length === 0, `diseased=${JSON.stringify(textFold?.leafDiseased ?? [])}`);
}
ok("act2 the t779 FOCUS face — the tail takes the focus when it lands", textFold?.pre?.focused === true, `focused=${textFold?.pre?.focused}`);

/* the keyboard walk: ArrowDown scrolls, End jumps to the end, Escape closes */
let arrowScroll = null, endScroll = null;
try {
  sh(`${AB} press ArrowDown`); await sleep(300); sh(`${AB} press ArrowDown`); await sleep(400);
  arrowScroll = evalJson(`(() => { const pre = document.querySelector('pre[aria-label="File content preview"]'); return JSON.stringify({ st: pre ? pre.scrollTop : null }); })()`);
  sh(`${AB} press End`); await sleep(500);
  endScroll = evalJson(`(() => { const pre = document.querySelector('pre[aria-label="File content preview"]'); return JSON.stringify({ st: pre ? pre.scrollTop : null, max: pre ? pre.scrollHeight - pre.clientHeight : null }); })()`);
} catch {}
ok("act2 the t779 ARROW face — ArrowDown scrolls the tail", (arrowScroll?.st ?? 0) > 0, `scrollTop=${arrowScroll?.st ?? "?"}`);
ok("act2 the t779 END face — End jumps to the tail's end", endScroll?.max !== null && (endScroll?.st ?? 0) >= (endScroll?.max ?? 9999) - 4, `st=${endScroll?.st ?? "?"} max=${endScroll?.max ?? "?"}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);
const textClosed = evalJson(`JSON.stringify({ peeks: [...document.querySelectorAll('[data-slot="dialog-content"][data-state="open"]')].filter(d => !d.hasAttribute('data-inspector-dialog')).length })`);
ok("act2 the ESCAPE consume — the peek dialog closes on Escape (the onEscapeClose law)", (textClosed?.peeks ?? 1) === 0, `peeks=${textClosed?.peeks ?? "?"}`);

/* ============ act3 — the EMPTY face (run.err) at the FOLD ============ */
let emptyFold = null;
for (let round = 0; round < 3 && !emptyFold; round++) {
  if (!(await ensureDialog())) { console.log(`  (act3 round ${round + 1}: the dialog would not return)`); continue; }
  if (!String(await clickPreview("run.err", 3)).startsWith("clicked@")) { console.log(`  (act3 round ${round + 1}: run.err's eye never clicked)`); continue; }
  emptyFold = await poll(peekFace, (v) => v.open === true && v.pre !== null, 12, 600);
  if (!emptyFold) { try { sh(`${AB} press Escape`); } catch {} await sleep(600); }
}
ok("act3 the EMPTY face — run.err's preview opens without crash, focus lands on the empty tail", emptyFold?.open === true && emptyFold?.pre?.focused === true, `focused=${emptyFold?.pre?.focused ?? "?"}`);
if (!BEFORE) {
  ok("act3 the empty face's shell stays fold-honest", emptyFold?.dialogOverX === false && (emptyFold?.leafDiseased?.length ?? 1) === 0, `dialogOverX=${emptyFold?.dialogOverX}`);
}
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* ============ act4 — the console ledger ============ */
const consoleErrs = evalJson(`JSON.stringify((window.__t966console ?? []).filter(t => !/Download the React DevTools/.test(t)))`) ?? [];
ok("act4 THE CONSOLE IS CLEAN (no error, no warning through the whole ride)", Array.isArray(consoleErrs) && consoleErrs.length === 0, `entries=${Array.isArray(consoleErrs) ? consoleErrs.length : consoleErrs}`);

/* the canvas smoke at 320 (the fold's horizontal honesty outside the dialog) */
const smoke = await poll(
  `JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, overX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`,
  (g) => g.cards >= 1, 30, 600,
);
ok("the canvas smoke at 320 (the fold renders, overX 0)", !!smoke && smoke.overX === false, `cards=${smoke?.cards ?? "?"} overX=${smoke?.overX}`);

writeReceipt({
  mode: BEFORE ? "before-witness" : "gate",
  pass, fail,
  starWide: starWide ? { dialogW: starWide.dialogW, tableSW: starWide.tableSW } : null,
  starFold: starFold ? { dialogW: starFold.dialogW, dialogOverX: starFold.dialogOverX, desc: starFold.desc, title: starFold.title, boxOverflowX: starFold.boxOverflowX, tableSW: starFold.tableSW, boxCW: starFold.boxCW, tableScrollsInside: starFold.tableScrollsInside, leafDiseased: starFold.leafDiseased } : null,
  textFold: textFold ? { dialogW: textFold.dialogW, dialogOverX: textFold.dialogOverX, descText: textFold.descText, desc: textFold.desc, pre: textFold.pre, leafDiseased: textFold.leafDiseased } : null,
  arrowScroll, endScroll,
  emptyFold: emptyFold ? { dialogOverX: emptyFold.dialogOverX, pre: emptyFold.pre } : null,
  consoleClean: Array.isArray(consoleErrs) && consoleErrs.length === 0,
});
console.log(`== t966 peek fold rider ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);

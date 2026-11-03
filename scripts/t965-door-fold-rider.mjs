#!/usr/bin/env node
/**
 * t965 — the DEEP-BAND DOOR's SECOND RIDER: the FOLD ride the t963
 * witness never took. The t963 witness measured the door's five ACTS at
 * a comfortable width; this rider takes the door ONE page at the 320
 * fold and pins the faces the t964 entry named:
 *
 *   act1  THE STANDING FACE AT 320 — the door mounts under the table,
 *         303 rows, the counts line reads 303.
 *   act2  THE NOTE'S WRAP FACE — the listing's honesty note (a long
 *         ledger's truncation sentence) WRAPS at 320: multi-line, zero
 *         horizontal escape. The note sits above the table and never
 *         scrolls away with the rows it speaks for (the t464 law).
 *   act3  THE TABLE'S HORIZONTAL HONESTY — the six-column table's
 *         min-width exceeds a 307px dialog, and that is FINE: the table
 *         scrolls horizontally INSIDE its overflow-y-auto container
 *         (self-clipping), the DIALOG itself never overflows (the t964
 *         law: the disease is only real when it leaves the container).
 *         The leaf judgment (the t965 extension the header ride earned):
 *         a non-self-clipping leaf is DISEASE only when its bleed
 *         ESCAPES the dialog's padding box or OVERLAPS a same-parent
 *         sibling — a bleed absorbed by the shell's own padding (the
 *         +6/+8px shadows the first ride found: content edges inside
 *         the padding, nextSib null) is invisible, not disease.
 *   act4  ONE CLICK, 300 MORE — AT 320 — the append works at the fold:
 *         603 rows, the merged counts truth, the door remains, and the
 *         dialog is STILL fold-honest after the append.
 *   act5  THE REFRESH COLLAPSE AT 320 — the wholesale reload folds back
 *         to the canonical first page and the door returns (the t956
 *         collapse law holds at the fold).
 *   act6  THE CONSOLE IS CLEAN.
 *
 *   The leaf law the ride banked (judged, not guessed — the visual
 *   probe rode first): sibOverlap = a same-parent sibling's rect
 *   intersects the leaf's rect; escapesDialog = the leaf's right edge
 *   passes the dialog's border box. Either = disease; neither = the
 *   padding-absorbed shadow the header carries at every width.
 *
 *   node scripts/t965-door-fold-rider.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const RECEIPT = path.join(ROOT, "shots-qa", "t965-door-fold-rider.json");
const NAME = "Remote Ledger Door (t963)";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim(); } catch (e) { return String(e?.stdout ?? e); } };

/* console ledger: installed before the ride reads, counted at act6 (the
 * t963 idiom verbatim) */
evalJs(`(() => { if (!window.__t965console) { window.__t965console = []; const e = console.error, w = console.warn; console.error = (...a) => { window.__t965console.push(String(a[0] ?? "").slice(0, 200)); e(...a); }; console.warn = (...a) => { window.__t965console.push(String(a[0] ?? "").slice(0, 200)); w(...a); }; } return "hooked"; })()`);

/* the transport law (the t944/t963 lesson, verbatim): a wedged renderer
 * reads as "no answer", never a dead script — the polls judge the world */
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
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
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

/* the FOLD face — everything the t964 entry's second rider owes, in one
 * probe against the inspector dialog (the door's own face + the note's
 * wrap face + the table's horizontal honesty + the dialog verdict):
 *   door     — [data-remote-more]: mounted, its text, its width vs dialog
 *   rows     — the rendered tbody rows
 *   counts   — the counts <p> (matched EXACTLY there, the t963 lesson:
 *              never in the dialog's whole textContent where the result
 *              sentence's "…file(s)…" neighbours shadow it)
 *   note     — [data-listing-note]: clientH (the wrap face), overX
 *   tableBox — the table's clipping container: computed overflowX, the
 *              table's scrollWidth vs the container's clientWidth
 *   dialog   — the inspector shell's own overX verdict + width
 *   nonClip  — non-self-clipping leaves, each JUDGED: sibOverlap /
 *              escapesDialog (the t965 law) — only diseased leaves fail */
const foldFace = `(() => {
  const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!d) return JSON.stringify({ open: false });
  const btn = d.querySelector('[data-remote-more]');
  const rows = d.querySelectorAll('[data-files-table] tbody tr').length;
  const cp = [...d.querySelectorAll('p')].map(x => (x.textContent || '').trim()).find(t => /^\\d[\\d,]* files?( of \\d+)?$/.test(t));
  const m = cp ? cp.match(/^\\d[\\d,]*/) : null;
  const note = d.querySelector('[data-listing-note]');
  const table = d.querySelector('[data-files-table]');
  const box = table ? [...(table.parentElement ? [table.parentElement] : [])].find(p => { const s = getComputedStyle(p); return s.overflowY !== 'visible'; }) ?? table.parentElement : null;
  const boxS = box ? getComputedStyle(box) : null;
  const offenders = [];
  const selfClipping = (el) => {
    const s = getComputedStyle(el);
    if (typeof el.className === 'string' && el.className.includes('sr-only')) return true;
    return s.overflowX !== 'visible' || s.overflowY !== 'visible';
  };
  const band = (r1, r2) => r1.y < r2.y + r2.height && r2.y < r1.y + r1.height;
  const intersect = (r1, r2) => band(r1, r2) && r1.x < r2.x + r2.width && r2.x < r1.x + r1.width;
  const dRect = d.getBoundingClientRect();
  const walk = (el, depth) => {
    if (depth > 24) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      const r = el.getBoundingClientRect();
      /* the t965 judgment: the bleed is DISEASE only when it overlaps a
       * same-parent sibling or escapes the dialog's border box — a bleed
       * that dies inside the shell's own padding is invisible at every
       * width (the visual probe's verdict, ridden before this law). */
      let sibOverlap = false;
      const pr = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
      if (pr && pr.width > 0 && r.width > 0) {
        for (const sib of el.parentElement.children) {
          if (sib === el) continue;
          const sr = sib.getBoundingClientRect();
          if (sr.width > 0 && sr.height > 0 && intersect(r, sr)) { sibOverlap = true; break; }
        }
      }
      const escapesDialog = r.width > 0 && (r.right > dRect.right + 1 || r.left < dRect.left - 1);
      offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 80), over: el.scrollWidth - el.clientWidth, selfClip: selfClipping(el), sibOverlap, escapesDialog });
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(d, 0);
  offenders.sort((a, b) => b.over - a.over);
  const dr = btn ? btn.getBoundingClientRect() : null;
  const noteH = note ? Math.round(note.getBoundingClientRect().height) : null;
  const noteOverX = note ? note.scrollWidth > note.clientWidth + 1 : null;
  return JSON.stringify({
    open: true,
    mounted: !!btn,
    doorText: btn ? (btn.textContent || '').trim().slice(0, 50) : null,
    doorW: dr ? Math.round(dr.width) : null,
    rows,
    counts: m ? m[0] : null,
    countsLine: cp ?? null,
    notePresent: !!note,
    noteH, noteOverX,
    boxOverflowX: boxS ? boxS.overflowX : null,
    tableSW: table ? table.scrollWidth : null,
    boxCW: box ? box.clientWidth : null,
    tableScrollsInside: box && table ? table.scrollWidth > box.clientWidth : null,
    dialogW: Math.round(dRect.width),
    dialogOverX: d.scrollWidth > d.clientWidth + 1,
    nonClip: offenders.filter((o) => !o.selfClip).slice(0, 8),
    clipCount: offenders.filter((o) => o.selfClip).length,
  });
})()`;

const writeReceipt = (obj) => {
  try {
    const prev = JSON.parse(readFileSync(RECEIPT, "utf8"));
    writeFileSync(RECEIPT, JSON.stringify({ ...prev, ...obj }, null, 2));
  } catch { writeFileSync(RECEIPT, JSON.stringify(obj, null, 2)); }
};

/* ============================== the ride ============================== */
console.log("== t965 the deep-band door's FOLD rider (the second rider) ==");

/* the preflight: the world must verify GREEN before the browser moves */
const mintVerify = sh("node scripts/t963-door-world-mint.mjs verify 2>&1");
ok("the door-world verifies GREEN (the API plane's five acts stand first)", /verify GREEN — \d+ ok, 0 fail/.test(mintVerify), (mintVerify.match(/== verify .*==/) ?? ["?"])[0]);
if (fail > 0) { writeReceipt({ pass, fail, aborted: "the world did not verify" }); process.exit(1); }

/* open wide, settle the canvas, mount the door at the comfortable width
 * first (the t963 acts stand there; the FOLD ride then takes over) */
sh(`${AB} set viewport 1280 800`);
sh(`${AB} open ${BASE}/`);
const cards = await poll(
  `JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, hasDoor: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME}')) })`,
  (g) => g.cards >= 1 && g.hasDoor === true, 30, 600,
);
ok("the workspace renders and the door-world card is on the page", !!cards && cards.hasDoor === true, `cards=${cards?.cards ?? "none"}`);
await sleep(1200);

let insp = await openInspectorHard(NAME, 8);
ok("the inspector opens on the door-world job (wide)", String(insp).startsWith("open@try"), String(insp));
let wide = null;
for (let round = 0; round < 3 && !wide; round++) {
  if (!(await ensureDialog())) { console.log(`  (wide round ${round + 1}: the dialog would not return)`); continue; }
  await clickTab("Files", 2);
  wide = await poll(foldFace, (v) => v.open === true && v.mounted === true && v.rows === 303, 12, 700);
  if (!wide) console.log(`  (wide round ${round + 1}: the door never mounted — re-opening)`);
}
ok("the standing face mounts wide (303 rows, the door speaks the ledger's words)", wide?.mounted === true && wide?.rows === 303, `rows=${wide?.rows ?? "?"} text=${wide?.doorText ?? "none"}`);

/* ==================== THE FOLD: 320 x 640 ==================== */
sh(`${AB} set viewport 320 640`);
await sleep(1500);

let f1 = null;
for (let round = 0; round < 3 && !f1; round++) {
  if (!(await ensureDialog())) { console.log(`  (act1 round ${round + 1}: the dialog would not return at 320)`); continue; }
  f1 = await poll(foldFace, (v) => v.open === true && v.mounted === true && v.rows === 303, 12, 700);
  if (!f1) { console.log(`  (act1 round ${round + 1}: the standing face never returned at 320)`); await clickTab("Files", 2); }
}
ok("act1 THE STANDING FACE AT 320 (door mounts, 303 rows, counts 303)", f1?.mounted === true && f1?.rows === 303 && f1?.counts === "303", `rows=${f1?.rows ?? "?"} counts=${f1?.counts ?? "?"} dialogW=${f1?.dialogW ?? "?"}`);

ok("act2 THE NOTE'S WRAP FACE — the honesty note is present and WRAPS (multi-line, no horizontal escape)", f1?.notePresent === true && f1?.noteOverX === false && (f1?.noteH ?? 0) >= 28, `noteH=${f1?.noteH ?? "none"} overX=${f1?.noteOverX}`);

ok("act3 THE TABLE'S HORIZONTAL HONESTY — the wide table scrolls INSIDE its clipping container, the dialog never overflows", f1?.boxOverflowX !== "visible" && f1?.tableScrollsInside === true && f1?.dialogOverX === false, `boxOverflowX=${f1?.boxOverflowX ?? "?"} tableSW=${f1?.tableSW ?? "?"} boxCW=${f1?.boxCW ?? "?"} dialogOverX=${f1?.dialogOverX}`);
const leafDisease = (f) => (Array.isArray(f?.nonClip) ? f.nonClip.filter((o) => o.sibOverlap || o.escapesDialog) : []);
ok("act3 the leaf judgment — no non-self-clipping leaf ESCAPES the dialog or OVERLAPS a sibling (the t965 law; padding-absorbed shadows are invisible, not disease)", leafDisease(f1).length === 0, `diseased=${JSON.stringify(leafDisease(f1))} benignShadows=${(f1?.nonClip ?? []).length - leafDisease(f1).length}`);
ok("act3 the DOOR fits its dialog at 320 (the affordance never props the shell)", (f1?.doorW ?? 9999) <= (f1?.dialogW ?? 0) + 1 && f1?.mounted === true, `doorW=${f1?.doorW ?? "?"} dialogW=${f1?.dialogW ?? "?"}`);

/* act4 — ONE CLICK, 300 MORE — AT 320 (with forensics: the face is
 * sampled every iteration, so a skipped 603 (e.g. a double-fire race
 * landing 653 past the gate) leaves its own transcript behind) */
let f2 = null;
let act4Trace = [];
for (let round = 0; round < 3 && !f2; round++) {
  if (!(await ensureDialog())) { console.log(`  (act4 round ${round + 1}: the dialog would not return)`); continue; }
  const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return d?.querySelector('[data-remote-more]') ?? null; })()`);
  if (!String(clicked).startsWith("clicked@")) { console.log(`  (act4 round ${round + 1}: the door click failed: ${clicked})`); continue; }
  for (let i = 0; i < 16 && !f2; i++) {
    const v = evalJson(foldFace);
    if (v && v.open) act4Trace.push(`t${i}:rows=${v.rows} mounted=${v.mounted} line=${JSON.stringify(v.countsLine ?? "?")}`);
    if (v && v.open === true && v.rows === 603) f2 = v;
    else await sleep(700);
  }
  if (!f2) console.log(`  (act4 round ${round + 1} transcript: ${act4Trace.slice(-6).join(" | ")})`);
}
ok("act4 ONE CLICK APPENDS 300 AT 320 (603 rows — the fold ride works)", f2?.rows === 603, `rows=${f2?.rows ?? "?"} counts=${f2?.counts ?? "?"}`);
ok("act4 the counts line reads the MERGED truth after the append (603 files — the of-tail absent, the merged law)", f2?.counts === "603" && f2?.countsLine === "603 files", `line="${f2?.countsLine ?? "?"}"`);
ok("act4 the door REMAINS at 320 (the ledger still holds a page)", f2?.mounted === true, `text=${f2?.doorText ?? "none"}`);
ok("act4 the dialog is STILL fold-honest after the append (dialogOverX 0, no diseased leaf)", f2?.dialogOverX === false && leafDisease(f2).length === 0, `dialogOverX=${f2?.dialogOverX} diseased=${JSON.stringify(leafDisease(f2))}`);

/* act5 — THE REFRESH COLLAPSE AT 320 */
let f3 = null;
for (let round = 0; round < 3 && !f3; round++) {
  if (!(await ensureDialog())) { console.log(`  (act5 round ${round + 1}: the dialog would not return)`); continue; }
  const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return [...(d?.querySelectorAll('button') ?? [])].find(b => (b.textContent || '').trim() === 'Refresh') ?? null; })()`);
  if (!String(clicked).startsWith("clicked@")) { console.log(`  (act5 round ${round + 1}: the Refresh click failed: ${clicked})`); continue; }
  f3 = await poll(foldFace, (v) => v.open === true && v.rows === 303 && v.mounted === true, 16, 700);
}
ok("act5 THE WHOLESALE RELOAD FOLDS BACK AT 320 (303 rows, the door returns)", f3?.rows === 303 && f3?.mounted === true, `rows=${f3?.rows ?? "?"} counts=${f3?.counts ?? "?"}`);

/* act6 — the console ledger */
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);
const consoleErrs = evalJson(`JSON.stringify((window.__t965console ?? []).filter(t => !/Download the React DevTools/.test(t)))`) ?? [];
ok("act6 THE CONSOLE IS CLEAN (no error, no warning through the whole fold ride)", Array.isArray(consoleErrs) && consoleErrs.length === 0, `entries=${Array.isArray(consoleErrs) ? consoleErrs.length : consoleErrs}`);

/* the canvas smoke at 320 (the fold's horizontal honesty outside the dialog too) */
const smoke = await poll(
  `JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, overX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`,
  (g) => g.cards >= 1, 30, 600,
);
ok("the canvas smoke at 320 (the fold renders, overX 0)", !!smoke && smoke.overX === false, `cards=${smoke?.cards ?? "?"} overX=${smoke?.overX}`);

writeReceipt({
  pass, fail,
  wide: { rows: wide?.rows ?? null, mounted: wide?.mounted === true },
  act4Trace,
  fold: {
    standing: f1 ? { rows: f1.rows, counts: f1.counts, dialogW: f1.dialogW, dialogOverX: f1.dialogOverX, noteH: f1.noteH, noteOverX: f1.noteOverX, boxOverflowX: f1.boxOverflowX, tableSW: f1.tableSW, boxCW: f1.boxCW, nonClip: f1.nonClip } : null,
    appended: f2 ? { rows: f2.rows, countsLine: f2.countsLine, mounted: f2.mounted, dialogOverX: f2.dialogOverX } : null,
    refreshed: f3 ? { rows: f3.rows, mounted: f3.mounted } : null,
  },
  consoleClean: Array.isArray(consoleErrs) && consoleErrs.length === 0,
});
console.log(`== t965 door fold rider ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);

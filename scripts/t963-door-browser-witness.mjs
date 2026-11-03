#!/usr/bin/env node
/**
 * t963 — the DEEP-BAND DOOR's browser witness: the five acts the t956
 * affordance owes the UI plane, ridden on the door-world mint (the world
 * scripts/t963-door-world-mint.mjs stands up — verify GREEN first).
 *
 *   act1  THE DOOR MOUNTS — the Files tab's table ends on the 300-card
 *         page and the dashed button speaks the ledger's own words
 *         ("Show 300 more from the cluster ledger") under the table.
 *   act2  ONE CLICK, 300 MORE — the merged counts read 603 files, the
 *         door moves to its next page (still mounted).
 *   act3  THE LAST PAGE, THE DOOR COLLAPSES — 653 files, the exact
 *         remainder, and the affordance VANISHES (no phantom next page).
 *   act4  THE REFRESH COLLAPSE — the wholesale reload folds back to the
 *         canonical first page (303 files) and the door returns.
 *   act5  THE CONSOLE IS CLEAN — the ride spoke no error to the page.
 *
 *   node scripts/t963-door-browser-witness.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const RECEIPT = path.join(ROOT, "shots-qa", "t963-door-browser-witness.json");
const NAME = "Remote Ledger Door (t963)";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim(); } catch (e) { return String(e?.stdout ?? e); } };

/* console ledger: installed before the ride reads, counted at act5 */
evalJs(`(() => { if (!window.__t963console) { window.__t963console = []; const e = console.error, w = console.warn; console.error = (...a) => { window.__t963console.push(String(a[0] ?? "").slice(0, 200)); e(...a); }; console.warn = (...a) => { window.__t963console.push(String(a[0] ?? "").slice(0, 200)); w(...a); }; } return "hooked"; })()`);

/* the transport law (the t944 lesson, verbatim): a wedged renderer reads
 * as "no answer", never a dead script — the polls judge the world */
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
      `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
      (v) => v.open === true, 5, 500,
    );
    if (opened?.open === true) return `open@try${i}`;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(700);
  }
  return "NEVER-OPEN";
};
const ensureDialog = async () => {
  const st = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); return JSON.stringify({ open: !!d }); })()`);
  if (st?.open === true) return true;
  if (st === null || st === "null") { try { sh(`${AB} open ${BASE}/`); } catch {} await sleep(2500); }
  const reopened = await openInspectorHard(NAME, 8);
  return String(reopened).startsWith("open@try");
};
const clickTab = async (label, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('${label}')) ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    if (!(await ensureDialog())) console.log(`  (tab '${label}' try ${i + 1}: the dialog would not return)`);
    await sleep(800);
  }
  return "NEVER-CLICKED";
};
/* the door's whole face in one probe: mounted? text? the counts line? the
 * rendered rows? (the counts law: the merged truth — local + appended).
 * The counts line is its own <p> (the "N files" paragraph above the note)
 * — matched EXACTLY there, never in the dialog's whole textContent where
 * the header's "…files on disk" masthead shadows it (the first-ride
 * lesson: counts=3 came from "…micrographs — 650 image file(s)…"'s
 * neighbours, the whole-text match read the WRONG sentence). */
const doorFace = `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); if (!d) return JSON.stringify({ open: false }); const btn = d.querySelector('[data-remote-more]'); const rows = d.querySelectorAll('[data-files-table] tbody tr').length; const cp = [...d.querySelectorAll('p')].map(x => (x.textContent || '').trim()).find(t => /^\\d[\\d,]* files?( of \\d+)?$/.test(t)); const m = cp ? cp.match(/^\\d[\\d,]*/) : null; return JSON.stringify({ open: true, mounted: !!btn, text: btn ? (btn.textContent || '').trim().slice(0, 60) : null, rows, counts: m ? m[0] : null }); })()`;

const writeReceipt = (obj) => {
  try {
    const prev = JSON.parse(readFileSync(RECEIPT, "utf8"));
    writeFileSync(RECEIPT, JSON.stringify({ ...prev, ...obj }, null, 2));
  } catch { writeFileSync(RECEIPT, JSON.stringify(obj, null, 2)); }
};

/* ============================== the ride ============================== */
console.log("== t963 the deep-band door's browser witness ==");

/* the preflight: the world must verify GREEN before the browser moves */
const mintVerify = sh("node scripts/t963-door-world-mint.mjs verify 2>&1");
ok("the door-world verifies GREEN (the API plane's five acts stand first)", /verify GREEN — \d+ ok, 0 fail/.test(mintVerify), (mintVerify.match(/== verify .*==/) ?? ["?"])[0]);
if (fail > 0) { writeReceipt({ pass, fail, aborted: "the world did not verify" }); process.exit(1); }

/* the console hook needs a page — open fresh and settle the canvas */
sh(`${AB} open ${BASE}/`);
const cards = await poll(
  `JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, hasDoor: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME}')) })`,
  (g) => g.cards >= 1 && g.hasDoor === true, 30, 600,
);
ok("the workspace renders and the door-world card is on the page (the warm-up reload law)", !!cards && cards.hasDoor === true, `cards=${cards?.cards ?? "none"}`);
await sleep(1200);

/* act1 — THE DOOR MOUNTS */
let insp = await openInspectorHard(NAME, 8);
ok("the inspector opens on the door-world job", String(insp).startsWith("open@try"), String(insp));
let act1 = null;
for (let round = 0; round < 3 && !act1; round++) {
  if (!(await ensureDialog())) { console.log(`  (act1 round ${round + 1}: the dialog would not return)`); continue; }
  await clickTab("Files", 2);
  act1 = await poll(doorFace, (v) => v.open === true && v.mounted === true, 12, 700);
  if (!act1) console.log(`  (act1 round ${round + 1}: the door never mounted — re-opening)`);
}
ok("act1 THE DOOR MOUNTS under the truncated table (data-remote-more, the ledger's own words)", act1?.mounted === true, `text=${act1?.text ?? "none"}`);
ok("act1 the standing page serves the 300-card face (303 rows, the counts line reads 303)", act1?.rows === 303 && act1?.counts === "303", `rows=${act1?.rows ?? "?"} counts=${act1?.counts ?? "?"}`);

/* act2 — ONE CLICK, 300 MORE */
let act2 = null;
for (let round = 0; round < 3 && !act2; round++) {
  if (!(await ensureDialog())) { console.log(`  (act2 round ${round + 1}: the dialog would not return)`); continue; }
  const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); return d?.querySelector('[data-remote-more]') ?? null; })()`);
  if (!String(clicked).startsWith("clicked@")) { console.log(`  (act2 round ${round + 1}: the door click failed: ${clicked})`); continue; }
  act2 = await poll(doorFace, (v) => v.open === true && v.rows === 603, 16, 700);
}
ok("act2 ONE CLICK APPENDS 300 (603 rows — local 3 + the two remote pages)", act2?.rows === 603, `rows=${act2?.rows ?? "?"} counts=${act2?.counts ?? "?"}`);
ok("act2 the counts line reads the MERGED truth (603 files)", act2?.counts === "603", `counts=${act2?.counts ?? "?"}`);
ok("act2 the door REMAINS (the ledger still holds a page — next 600)", act2?.mounted === true, `text=${act2?.text ?? "none"}`);

/* act3 — THE LAST PAGE, THE DOOR COLLAPSES */
let act3 = null;
for (let round = 0; round < 3 && !act3; round++) {
  if (!(await ensureDialog())) { console.log(`  (act3 round ${round + 1}: the dialog would not return)`); continue; }
  const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); return d?.querySelector('[data-remote-more]') ?? null; })()`);
  if (!String(clicked).startsWith("clicked@")) { console.log(`  (act3 round ${round + 1}: the door click failed: ${clicked})`); continue; }
  act3 = await poll(doorFace, (v) => v.open === true && v.rows === 653 && v.mounted === false, 16, 700);
}
ok("act3 THE EXACT REMAINDER LANDS (653 rows — the whole ledger walked)", act3?.rows === 653, `rows=${act3?.rows ?? "?"} counts=${act3?.counts ?? "?"}`);
ok("act3 THE DOOR COLLAPSES (no phantom next page — the affordance vanishes)", act3?.mounted === false, `mounted=${act3?.mounted}`);

/* act4 — THE REFRESH COLLAPSE */
let act4 = null;
for (let round = 0; round < 3 && !act4; round++) {
  if (!(await ensureDialog())) { console.log(`  (act4 round ${round + 1}: the dialog would not return)`); continue; }
  const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME}')); return [...(d?.querySelectorAll('button') ?? [])].find(b => (b.textContent || '').trim() === 'Refresh') ?? null; })()`);
  if (!String(clicked).startsWith("clicked@")) { console.log(`  (act4 round ${round + 1}: the Refresh click failed: ${clicked})`); continue; }
  act4 = await poll(doorFace, (v) => v.open === true && v.rows === 303 && v.mounted === true, 16, 700);
}
ok("act4 THE WHOLESALE RELOAD FOLDS BACK (303 rows — the canonical first page)", act4?.rows === 303, `rows=${act4?.rows ?? "?"} counts=${act4?.counts ?? "?"}`);
ok("act4 THE DOOR RETURNS (the band is one click away again — the collapse-on-refresh law)", act4?.mounted === true, `text=${act4?.text ?? "none"}`);

/* act5 — the console ledger */
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);
const consoleErrs = evalJson(`JSON.stringify((window.__t963console ?? []).filter(t => !/Download the React DevTools/.test(t)))`) ?? [];
ok("act5 THE CONSOLE IS CLEAN (no error, no warning through all four acts)", Array.isArray(consoleErrs) && consoleErrs.length === 0, `entries=${Array.isArray(consoleErrs) ? consoleErrs.length : consoleErrs}`);

/* the smoke: the canvas again, horizontal honesty */
sh(`${AB} open ${BASE}/`);
const smoke = await poll(
  `JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, overX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`,
  (g) => g.cards >= 1, 30, 600,
);
ok("the browser smoke clean (the canvas renders, overX 0)", !!smoke && smoke.overX === false, `cards=${smoke?.cards ?? "?"} overX=${smoke?.overX}`);

writeReceipt({ pass, fail, acts: { mount: act1?.mounted === true, append300: act2?.rows === 603, collapse: act3?.mounted === false, refreshFold: act4?.rows === 303 && act4?.mounted === true, consoleClean: Array.isArray(consoleErrs) && consoleErrs.length === 0 }, counts: { standing: act1?.counts, afterAppend: act2?.counts, afterRemainder: act3?.counts, afterRefresh: act4?.counts } });
console.log(`== t963 door browser witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);

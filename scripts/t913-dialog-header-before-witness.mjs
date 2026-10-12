#!/usr/bin/env node
/**
 * t913 — the BEFORE witness: at real-user path lengths, the results-view's
 * three dialog faces (STAR table / MRC image / text preview) overflow at
 * 320 — the defect reproduced HONESTLY, on real files (the t913 live-fire
 * mint: byte-copies under 54-61-char single-token names, listed by the
 * real walk, parsed by the real parsers).
 *
 * This instrument's GREEN IS THE RED: it passes when the long-named
 * dialogs overflow (overX > 1 / element rects beyond the dialog's inner
 * box) AND the seeded short-named STAR dialog does not (the contrast
 * face — the t912 S2 record stands). After the seat lands, this script
 * must FAIL the long faces (the overflow gone) — the after-witness is a
 * separate instrument with its own asserts; the pair is the causal chain.
 *
 * RIDE LAWS inherited: born-at-band (viewport FIRST, then open — a
 * dialog mounted before `set viewport` is a ghost after it); click-time
 * presence (vis AND own probed at the instant the mouse lands);
 * per-surface presence polls (a sibling's arrival is not a settle);
 * read-only (no mint, no PATCH — the live-fire files are the only world
 * change and they live outside this script's lifetime).
 *
 *   node scripts/t913-dialog-header-before-witness.mjs   (dev server :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t913-dialog-header-before-witness.json";
const TARGET = "wide"; // the mint covers every topazdenoise workdir
const LONG_STAR = "motioncorr_corrected_micrographs_stack_session2_full_run.star";
const LONG_MRC = "motioncorr_corrected_micrograph_stack_batch2_half1_full.mrc";
const LONG_OUT = "relion_motioncorr_run_protocol_session_verbose_log.out";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, cwd: ROOT, input: expr }).trim();
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
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); const vis = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); const own = !!hit && !!el.contains(hit); return JSON.stringify({ vis, own, x: cx, y: cy }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.vis && pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};

// the door: click canvas cards until ANY topazdenoise inspector opens —
// the mint is WIDE (every topazdenoise workdir carries the copies), so
// the door picks whatever card the narrow canvas shows first
const openTargetInspector = async () => {
  sh(`${AB} open ${BASE}/`);
  for (let i = 0; i < 20; i++) {
    const gate = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    if (gate && gate.cards >= 4) break;
    await sleep(500);
  }
  for (let round = 0; round < 20; round++) {
    const cands = evalJson(`(() => { const out = []; for (const card of document.querySelectorAll('[data-job]')) { const btn = card.querySelector('[role="button"][tabindex]'); if (!btn) continue; const r = btn.getBoundingClientRect(); if (r.width === 0) continue; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); if (hit && btn.contains(hit)) out.push({ cx, cy }); } return JSON.stringify(out.slice(0, 4)); })()`);
    console.log(`  [door r${round}] cands=${JSON.stringify(cands)}`);
    if (!Array.isArray(cands) || cands.length === 0) { await sleep(1200); continue; }
    const pick = cands[round % cands.length];
    sh(`${AB} mouse move ${pick.cx} ${pick.cy}`);
    sh(`${AB} mouse down`);
    sh(`${AB} mouse up`);
    await sleep(2800);
    const wd = evalJson(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return null; const el = [...d.querySelectorAll('span,code,div')].find(e => /data\\/relion\\/.+topazdenoise_/.test(e.textContent || '') && (e.textContent || '').length < 200); return el ? el.textContent.trim() : null; })()`);
    console.log(`  [door r${round}] wd=${JSON.stringify(wd)}`);
    if (wd && /topazdenoise_/.test(wd)) return wd;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(900);
  }
  return null;
};

const openResultsTab = async (presenceExpr) => {
  const clicked = await realClick(
    `[...document.querySelectorAll('[role="tab"]')].find(t => /^Results/.test((t.textContent || '').trim()))`
  );
  if (!String(clicked).startsWith("clicked@")) return { clicked };
  for (let i = 0; i < 24; i++) {
    const gate = evalJson(presenceExpr);
    if (gate && gate.found === true) return { clicked, landed: true };
    await sleep(500);
  }
  return { clicked, landed: false };
};

// one dialog's face: overflow + the title/description's own honesty
const faceOf = (idx) =>
  evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][${idx}]; if (!d) return null; const dr = d.getBoundingClientRect(); const t = d.querySelector('[data-slot=dialog-title]'); const desc = d.querySelector('[data-slot=dialog-description]'); const tr = t ? t.getBoundingClientRect() : null; const der = desc ? desc.getBoundingClientRect() : null; const innerRight = dr.right - 24; return JSON.stringify({ overX: d.scrollWidth - d.clientWidth, title: t ? { over: t.scrollWidth - t.clientWidth, h: Math.round(tr.height), rightBleed: Math.round(tr.right - innerRight) } : null, desc: desc ? { over: desc.scrollWidth - desc.clientWidth, h: Math.round(der.height), rightBleed: Math.round(der.right - innerRight), text: (desc.textContent || '').slice(0, 90) } : null }); })()`);

// open a section row by name text, poll the stacked dialog to presence
const openRowDialog = async (rowExpr, readyExpr) => {
  const row = await realClick(rowExpr);
  if (!String(row).startsWith("clicked@")) return { row };
  for (let i = 0; i < 24; i++) {
    const gate = evalJson(readyExpr);
    if (gate && gate.ready === true) return { row, ready: true };
    await sleep(500);
  }
  return { row, ready: false };
};

const closeTop = async () => {
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(700);
  const st = evalJson(`(() => { const dl = document.querySelectorAll('[role="dialog"]').length; const results = [...document.querySelectorAll('[role="tab"]')].find(t => /^Results/.test((t.textContent || '').trim())); const mapsRow = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('motioncorr_corrected_micrograph_stack_batch2_half1_full')); const starRow = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('${LONG_STAR}')); return JSON.stringify({ dl, resultsSel: results ? results.getAttribute('aria-selected') : null, mapsRow: !!mapsRow, starRow: !!starRow }); })()`);
  console.log(`  [post-Esc] ${JSON.stringify(st)}`);
};

let browserUp = false;
try {
  sh(`${AB} open about:blank`);
  browserUp = true;

  /* ONE ride — 320, born at its band */
  sh(`${AB} set viewport 320 800`);
  const wd = await openTargetInspector();
  ok("R1 320: a topazdenoise inspector opened (the mint is aboard)", !!wd, wd?.split("/").pop() ?? "none");
  if (wd) {
    const r = await openResultsTab(`(() => { const star = [...document.querySelectorAll('section')].find(s => s.getAttribute('aria-label') === 'STAR tables'); return JSON.stringify({ found: !!star }); })()`);
    ok("R1a the Results tab opened, sections fetched", r.landed === true);
    if (r.landed) {
      /* --- the LONG star dialog: the defect reproduced --- */
      const star = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('${LONG_STAR}') && b.closest('section[aria-label="STAR tables"]'))`,
        `JSON.stringify({ ready: ([...document.querySelectorAll('[role="dialog"]')][1] || { querySelectorAll: () => [] }).querySelectorAll('[data-star-idx-cell]').length > 0 })`
      );
      ok("B1 the LONG star row clicked, table rendered", star.ready === true, String(star.row));
      if (star.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        ok("B2 the LONG star dialog OVERFLOWS (the defect, reproduced)", f && f.overX > 1, `overX=${f?.overX}`);
        ok("B3 the title row paints beyond its box", f && f.title && (f.title.over > 1 || f.title.rightBleed > 1), `over=${f?.title?.over} bleed=${f?.title?.rightBleed}`);
        ok("B4 the description path paints beyond its box", f && f.desc && (f.desc.over > 1 || f.desc.rightBleed > 1), `over=${f?.desc?.over} bleed=${f?.desc?.rightBleed}`);
      }
      await closeTop();

      /* --- the LONG image dialog: the class, second face ---
       * NOTE: MRC tiles render friendlyLabel's fallback (the name WITHOUT
       * the extension — labels are mrc-only in the walk), so the finder
       * searches the extensionless caption. */
      const img = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('motioncorr_corrected_micrograph_stack_batch2_half1_full') && b.closest('section[aria-label="Maps and images"]'))`,
        `JSON.stringify({ ready: [...document.querySelectorAll('[role="dialog"]')].length >= 2 })`
      );
      ok("B5 the LONG image row clicked, dialog stacked", img.ready === true, String(img.row));
      if (img.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        ok("B6 the LONG image dialog OVERFLOWS (the class, face 2)", f && f.overX > 1, `overX=${f?.overX}`);
      }
      await closeTop();

      /* --- the LONG text dialog: the class, third face --- */
      const txt = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('${LONG_OUT}') && b.closest('section[aria-label="Logs and reports"]'))`,
        `JSON.stringify({ ready: [...document.querySelectorAll('[role="dialog"]')].length >= 2 })`
      );
      ok("B7 the LONG text row clicked, dialog stacked", txt.ready === true, String(txt.row));
      if (txt.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        ok("B8 the LONG text dialog OVERFLOWS (the class, face 3)", f && f.overX > 1, `overX=${f?.overX}`);
      }
      await closeTop();

      /* --- the SHORT star dialog: the contrast face (t912's record) --- */
      const short = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('denoised_micrographs.star') && b.closest('section[aria-label="STAR tables"]'))`,
        `JSON.stringify({ ready: ([...document.querySelectorAll('[role="dialog"]')][1] || { querySelectorAll: () => [] }).querySelectorAll('[data-star-idx-cell]').length > 0 })`
      );
      ok("B9 the SHORT star row clicked, table rendered", short.ready === true, String(short.row));
      if (short.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        ok("B10 the SHORT star dialog does NOT overflow (the world's own record)", f && f.overX <= 1, `overX=${f?.overX}`);
      }
    }
  }
} catch (e) {
  fail++;
  console.log(`  ✗ the ride threw: ${e.message?.slice(0, 200)}`);
} finally {
  if (browserUp) {
    try { sh(`${AB} press Escape`); } catch {}
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(500);
    try { sh(`${AB} close`); browserUp = false; } catch {}
  }
  console.log("\n  cleanup: the ride wrote nothing (read-only); the live-fire copies stay for the after-witness");
}

const receipt = {
  instrument: "t913-dialog-header-before-witness",
  band: 320,
  mint: "wide — every topazdenoise workdir carries the three long-named copies",
  pass, fail,
  note: "this instrument's green IS the red: the long-named dialogs must overflow",
  at: new Date().toISOString(),
};
try { writeFileSync(`${ROOT}/${RECEIPT}`, JSON.stringify(receipt, null, 2)); } catch {}
console.log(`\nDIALOG-HEADER-BEFORE t913: ${pass}/${pass + fail} ${fail === 0 ? "the defect stands reproduced — the seat may land" : "NOT reproduced — audit before fixing"}`);
process.exit(fail === 0 ? 0 : 1);

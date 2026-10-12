#!/usr/bin/env node
/**
 * t913 — the AFTER witness: the seat landed (results-view's three dialog
 * headers + the StarTable path line carry the Mol* grammar), so at
 * real-user path lengths (the live-fire mint's 54-61-char single-token
 * names) the three faces must now HOLD at 320:
 *
 *   H-xxx  per face (star 375+320 / image 320 / text 320):
 *     H1  NO horizontal overflow (dialog overX ≤ 1)
 *     H2  the title is ONE line and TRUNCATING (the long name ellipsizes —
 *         span scrollWidth > clientWidth — a title stays a heading)
 *     H3  the description WRAPS the full path (no overflow, ≥ 2 lines,
 *         textContent carries the whole path — provenance stays readable)
 *     H4  the StarTable path line truncates with hover (the star face):
 *         span scrollWidth > clientWidth, the line itself no overflow
 *   S-xxx  the seeded SHORT faces (star at 320): no overflow AND nothing
 *          truncates that fits — the cure must not tax the short world
 *          (title span fits, description one line, overX 0 — the t912
 *          record stands).
 *
 * RIDE LAWS inherited: born-at-band; click-time presence; per-surface
 * presence polls; read-only (the live-fire copies live outside this
 * script's lifetime; the cleanup is the mint's `remove`).
 *
 *   node scripts/t913-dialog-header-after-witness.mjs   (dev server :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t913-dialog-header-after-witness.json";
const LONG_STAR = "motioncorr_corrected_micrographs_stack_session2_full_run.star";
const LONG_STAR_STEM = "motioncorr_corrected_micrographs_stack_session2_full_run";
const LONG_MRC_STEM = "motioncorr_corrected_micrograph_stack_batch2_half1_full";
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

// the door: click canvas cards until ANY topazdenoise inspector opens
const openTopazInspector = async () => {
  sh(`${AB} open ${BASE}/`);
  for (let i = 0; i < 20; i++) {
    const gate = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    if (gate && gate.cards >= 4) break;
    await sleep(500);
  }
  for (let round = 0; round < 20; round++) {
    const cands = evalJson(`(() => { const out = []; for (const card of document.querySelectorAll('[data-job]')) { const btn = card.querySelector('[role="button"][tabindex]'); if (!btn) continue; const r = btn.getBoundingClientRect(); if (r.width === 0) continue; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); if (hit && btn.contains(hit)) out.push({ cx, cy }); } return JSON.stringify(out.slice(0, 4)); })()`);
    if (!Array.isArray(cands) || cands.length === 0) { await sleep(1200); continue; }
    const pick = cands[round % cands.length];
    sh(`${AB} mouse move ${pick.cx} ${pick.cy}`);
    sh(`${AB} mouse down`);
    sh(`${AB} mouse up`);
    await sleep(2800);
    const wd = evalJson(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return null; const el = [...d.querySelectorAll('span,code,div')].find(e => /data\\/relion\\/.+topazdenoise_/.test(e.textContent || '') && (e.textContent || '').length < 200); return el ? el.textContent.trim() : null; })()`);
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

/* one dialog face's honesty, measured in full:
   overX — the dialog paints nothing past its box
   title — one line, and truncating iff the name is long (span over > 1)
   desc  — no overflow, wraps (h ≥ 28 for a long path), full text aboard
   line  — the StarTable path line (star face): truncating iff long */
const faceOf = (idx) =>
  evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][${idx}]; if (!d) return null; const t = d.querySelector('[data-slot=dialog-title]'); const desc = d.querySelector('[data-slot=dialog-description]'); const span = t ? t.querySelector('span') : null; const line = d.querySelector('span[title]'); return JSON.stringify({ overX: d.scrollWidth - d.clientWidth, title: t ? { h: Math.round(t.getBoundingClientRect().height), spanOver: span ? span.scrollWidth - span.clientWidth : -1, text: (t.textContent || '').slice(0, 80) } : null, desc: desc ? { over: desc.scrollWidth - desc.clientWidth, h: Math.round(desc.getBoundingClientRect().height), text: (desc.textContent || '') } : null, line: line ? { over: line.scrollWidth - line.clientWidth, w: Math.round(line.getBoundingClientRect().width) } : null }); })()`);

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
};

/* the H arms for one face at one band */
const holdArms = (tag, f, { expectLine = false, fullText }) => {
  ok(`${tag} H1 the dialog has NO horizontal overflow`, f && f.overX <= 1, `overX=${f?.overX}`);
  ok(`${tag} H2 the title stays ONE line and truncates the long name`, f && f.title && f.title.h <= 24 && f.title.spanOver > 1, `h=${f?.title?.h} spanOver=${f?.title?.spanOver}`);
  ok(`${tag} H3 the description wraps the FULL path (no overflow, text aboard)`, f && f.desc && f.desc.over <= 1 && f.desc.h >= 28 && (f.desc.text || "").includes(fullText), `over=${f?.desc?.over} h=${f?.desc?.h}`);
  if (expectLine) {
    ok(`${tag} H4 the StarTable path line truncates with hover`, f && f.line && f.line.over > 1 && f.line.w > 0, `lineOver=${f?.line?.over}`);
  }
};

/* the SHORT contrast arms: nothing truncates that fits */
const shortArms = (tag, f) => {
  ok(`${tag} S1 the dialog has NO horizontal overflow`, f && f.overX <= 1, `overX=${f?.overX}`);
  ok(`${tag} S2 the title is ONE line and does NOT truncate what fits`, f && f.title && f.title.h <= 24 && f.title.spanOver <= 1, `h=${f?.title?.h} spanOver=${f?.title?.spanOver}`);
  ok(`${tag} S3 the description stays one line (the short path fits)`, f && f.desc && f.desc.over <= 1 && f.desc.h <= 20, `over=${f?.desc?.over} h=${f?.desc?.h}`);
};

let browserUp = false;
try {
  sh(`${AB} open about:blank`);
  browserUp = true;

  /* ride 1 — 375: the star face (the dish's namesake, both bands) */
  sh(`${AB} set viewport 375 800`);
  const wd1 = await openTopazInspector();
  ok("R1 375: a topazdenoise inspector opened", !!wd1, wd1?.split("/").pop() ?? "none");
  if (wd1) {
    const r = await openResultsTab(`(() => { const star = [...document.querySelectorAll('section')].find(s => s.getAttribute('aria-label') === 'STAR tables'); return JSON.stringify({ found: !!star }); })()`);
    ok("R1a the Results tab opened, sections fetched", r.landed === true);
    if (r.landed) {
      const star = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('${LONG_STAR}') && b.closest('section[aria-label="STAR tables"]'))`,
        `JSON.stringify({ ready: ([...document.querySelectorAll('[role="dialog"]')][1] || { querySelectorAll: () => [] }).querySelectorAll('[data-star-idx-cell]').length > 0 })`
      );
      ok("H-375 R the LONG star row clicked, table rendered", star.ready === true, String(star.row));
      if (star.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        holdArms("H-375", f, { expectLine: true, fullText: LONG_STAR });
      }
      await closeTop();
      /* the short contrast face at 375 too (cheap, same leg) */
      const short = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('denoised_micrographs.star') && b.closest('section[aria-label="STAR tables"]'))`,
        `JSON.stringify({ ready: ([...document.querySelectorAll('[role="dialog"]')][1] || { querySelectorAll: () => [] }).querySelectorAll('[data-star-idx-cell]').length > 0 })`
      );
      ok("S-375 R the SHORT star row clicked", short.ready === true, String(short.row));
      if (short.ready) {
        const f = faceOf(1);
        shortArms("S-375", f);
      }
    }
  }
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(700);
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(900);

  /* ride 2 — 320 (born at its band): star + image + text, long + short */
  sh(`${AB} set viewport 320 800`);
  const wd2 = await openTopazInspector();
  ok("R2 320: a topazdenoise inspector opened", !!wd2, wd2?.split("/").pop() ?? "none");
  if (wd2) {
    const r = await openResultsTab(`(() => { const star = [...document.querySelectorAll('section')].find(s => s.getAttribute('aria-label') === 'STAR tables'); return JSON.stringify({ found: !!star }); })()`);
    ok("R2a the Results tab opened, sections fetched", r.landed === true);
    if (r.landed) {
      /* LONG star at 320 */
      const star = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('${LONG_STAR}') && b.closest('section[aria-label="STAR tables"]'))`,
        `JSON.stringify({ ready: ([...document.querySelectorAll('[role="dialog"]')][1] || { querySelectorAll: () => [] }).querySelectorAll('[data-star-idx-cell]').length > 0 })`
      );
      ok("H-320 R the LONG star row clicked, table rendered", star.ready === true, String(star.row));
      if (star.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        holdArms("H-320", f, { expectLine: true, fullText: LONG_STAR });
      }
      await closeTop();

      /* SHORT star at 320 — the cure must not tax the short world */
      const short = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('denoised_micrographs.star') && b.closest('section[aria-label="STAR tables"]'))`,
        `JSON.stringify({ ready: ([...document.querySelectorAll('[role="dialog"]')][1] || { querySelectorAll: () => [] }).querySelectorAll('[data-star-idx-cell]').length > 0 })`
      );
      ok("S-320 R the SHORT star row clicked", short.ready === true, String(short.row));
      if (short.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        shortArms("S-320", f);
      }
      await closeTop();

      /* LONG image at 320 (the extensionless caption — mrc labels are
         friendlyLabel'd in the walk) */
      const img = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('${LONG_MRC_STEM}') && b.closest('section[aria-label="Maps and images"]'))`,
        `JSON.stringify({ ready: [...document.querySelectorAll('[role="dialog"]')].length >= 2 })`
      );
      ok("H-320 I the LONG image row clicked, dialog stacked", img.ready === true, String(img.row));
      if (img.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        holdArms("H-320-I", f, { fullText: LONG_MRC_STEM });
      }
      await closeTop();

      /* LONG text at 320 */
      const txt = await openRowDialog(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('${LONG_OUT}') && b.closest('section[aria-label="Logs and reports"]'))`,
        `JSON.stringify({ ready: [...document.querySelectorAll('[role="dialog"]')].length >= 2 })`
      );
      ok("H-320 T the LONG text row clicked, dialog stacked", txt.ready === true, String(txt.row));
      if (txt.ready) {
        const f = faceOf(1);
        console.log(`   face: ${JSON.stringify(f)}`);
        holdArms("H-320-T", f, { fullText: LONG_OUT });
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
  console.log("\n  cleanup: the ride wrote nothing (read-only); the mint's `remove` restores the world");
}

const receipt = {
  instrument: "t913-dialog-header-after-witness",
  bands: [375, 320],
  mint: "wide — every topazdenoise workdir carries the three long-named copies",
  pass, fail,
  at: new Date().toISOString(),
};
try { writeFileSync(`${ROOT}/${RECEIPT}`, JSON.stringify(receipt, null, 2)); } catch {}
console.log(`\nDIALOG-HEADER-AFTER t913: ${pass}/${pass + fail} ${fail === 0 ? "green — the headers hold at real-user path lengths" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * t912 — the RESULTS-tab narrow audit (the style round's next seat): the
 * t910 instrument pinned the inspector's OVERVIEW face and the image
 * dialog at the narrow bands; the RESULTS tab beneath them — the denoise
 * compare gallery and the STAR table dialog — has never been ridden at
 * 375/320. Both surfaces live in the same inspector for a topazdenoise
 * job (the t894 witness carries denoised_micrographs.star + a 4/4-paired
 * gallery, one ride serves both dishes).
 *
 * RIDE LAWS inherited (each paid for in a previous window):
 *   - born-at-band (t910): `set viewport` RELOADS the page — a dialog
 *     mounted before the dance is a ghost after it. Each band is its OWN
 *     ride: viewport FIRST, then open, click, measure.
 *   - click-time presence (t910): vis AND own re-probed in the same
 *     instant the mouse lands; scrollIntoView({block:center}) re-anchors
 *     each round (a fixed container scroll chases a growing layout).
 *   - read-only (t491/t910): no mint, no seed, no PATCH; the ride never
 *     touches the wipe range input (a drag would write a localStorage
 *     bucket through the t896 debounce — measuring, not moving).
 *   - settle law (t911): a world whose fetch has not landed is a rumor —
 *     every surface is polled to presence before any measure.
 *
 *   G-375 / G-320  the denoise compare gallery (the Results tab):
 *     G1  present (the self-hide contract did not fire — a paired run
 *         must render; its absence here would be the lie the contract
 *         forbids)
 *     G2  NO horizontal overflow (scrollWidth − clientWidth ≤ 1)
 *     G3  the header row wraps honestly: every direct child inside the
 *         row's rect (the t909 door-strip law, third family member)
 *     G4  every card's right edge inside the section (grid honesty)
 *     G5  the wipe control present: the range input + the divider grip
 *         visible in the first card
 *     G6  the footer hint <p> present (the teaching line rides along)
 *   S-375 / S-320  the STAR table dialog (the Results tab's STAR row):
 *     S1  the dialog opens above the inspector (two dialogs stacked)
 *     S2  NO horizontal overflow — the honest check on the header's
 *         un-truncated path line (a relative name in this world; the
 *         verdict records the fact for real-user hardening)
 *     S3  the StarTable scroll region present (aria-label "Star table")
 *     S4  the wide table CONTAINED: the region's client width ≤ the
 *         dialog's inner width + 2 — wide columns scroll INSIDE the
 *         region, they do not widen the dialog
 *     S5  the TSV export link visible (the footer's right edge inside)
 *     S6  the Esc keymap chip visible (the t832 star-keymap seat)
 *
 *   node scripts/t912-star-gallery-narrow-audit.mjs   (dev server :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t912-star-gallery-narrow-audit.json";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
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
  // t910's law: vis AND own re-probed AT click time; centering scroll
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

// the t910 door: click canvas cards until a topazdenoise inspector opens
const openTopazInspector = async () => {
  sh(`${AB} open ${BASE}/`);
  // the settle gate (t912's own law, first seated in t837 this window):
  // poll for the canvas cards, never a fixed sleep
  for (let i = 0; i < 20; i++) {
    const gate = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    if (gate && gate.cards >= 4) break;
    await sleep(500);
  }
  for (let round = 0; round < 8; round++) {
    const cands = evalJson(`(() => { const out = []; for (const card of document.querySelectorAll('[data-job]')) { const btn = card.querySelector('[role="button"][tabindex]'); if (!btn) continue; const r = btn.getBoundingClientRect(); if (r.width === 0) continue; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); if (hit && btn.contains(hit)) out.push({ cx, cy }); } return JSON.stringify(out.slice(0, 3)); })()`);
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

// the Results tab: click its trigger, then poll a section to presence
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

// one dialog's overflow verdict by index (the t910 dialogFace, extended)
const dialogFace = (idx) =>
  evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][${idx}]; if (!d) return null; const overX = d.scrollWidth - d.clientWidth; const head = d.querySelector('h2, [data-slot=dialog-title]'); const hr = head ? head.getBoundingClientRect() : null; return JSON.stringify({ overX, headVisible: hr ? hr.width > 0 && hr.height > 0 : false }); })()`);

const galleryArms = async (tag) => {
  /* the settle law, per-surface (the cold-compile lesson this window's
   * first ride paid): the gallery's denoise-pairs fetch lands on its own
   * schedule — the STAR button's arrival says nothing about it. Poll the
   * gallery to presence (bounded 12s) before any verdict; an honest
   * absence still fails, but after the poll, not in a race. */
  let g = null;
  for (let i = 0; i < 24; i++) {
    g = evalJson(`(() => { const s = document.querySelector('[data-denoise-gallery]'); if (!s) return JSON.stringify({ present: false }); const overX = s.scrollWidth - s.clientWidth; const sr = s.getBoundingClientRect(); const head = s.querySelector(':scope > div'); const hRect = head ? head.getBoundingClientRect() : null; const kids = head ? [...head.children].map(k => { const kr = k.getBoundingClientRect(); return kr.left >= hRect.left - 1 && kr.right <= hRect.right + 1 && kr.height > 0; }) : []; const cards = [...s.querySelectorAll('[data-denoise-card]')].map(c => c.getBoundingClientRect().right <= sr.right + 1); const range = s.querySelector('input[type=range]'); const grip = s.querySelector('.group.relative span svg'); const hint = [...s.querySelectorAll('p')].some(p => /drag the divider/.test(p.textContent || '')); return JSON.stringify({ present: true, overX, headKidsIn: kids.filter(Boolean).length, headKids: kids.length, cardsIn: cards.filter(Boolean).length, cardCount: cards.length, range: !!range, gripVisible: grip ? grip.getBoundingClientRect().width > 0 : false, hint }); })()`);
    if (g && g.present === true) break;
    await sleep(500);
  }
  ok(`${tag} G1 the denoise gallery renders (a paired run must not self-hide)`, g && g.present === true, g && g.present !== true ? "absent after the 12s presence poll" : "");
  if (!g || g.present !== true) return;
  ok(`${tag} G2 the gallery has NO horizontal overflow`, g.overX <= 1, `scrollW-clientW=${g.overX}`);
  ok(`${tag} G3 the header row wraps honestly — every child in-rect`, g.headKidsIn === g.headKids, `${g.headKidsIn}/${g.headKids}`);
  ok(`${tag} G4 every card inside the section's right edge`, g.cardsIn === g.cardCount, `${g.cardsIn}/${g.cardCount}`);
  ok(`${tag} G5 the wipe control present — range input + visible grip`, g.range === true && g.gripVisible === true);
  ok(`${tag} G6 the teaching footer line present`, g.hint === true);
};

const starArms = (tag) => {
  const face = dialogFace(1);
  ok(`${tag} S1 the STAR dialog opens above the inspector`, !!face);
  if (!face) return;
  ok(`${tag} S2 the STAR dialog has NO horizontal overflow`, face.overX <= 1, `scrollW-clientW=${face.overX}`);
  ok(`${tag} S2a the dialog's title visible`, face.headVisible === true);
  const t = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][1]; if (!d) return null; const region = d.querySelector('[aria-label^="Star table"]'); if (!region) return JSON.stringify({ region: false }); const inner = [...d.querySelectorAll('.rounded-lg, .rounded-md')].map(x => x.getBoundingClientRect().width); const dr = d.getBoundingClientRect(); const cells = d.querySelectorAll('[data-star-idx-cell]').length; const tsv = [...d.querySelectorAll('a')].find(a => /TSV/.test(a.textContent || '')); const tsvIn = tsv ? tsv.getBoundingClientRect().right <= dr.right + 1 : false; const km = d.querySelector('[data-canvas-ui="star-keymap"]'); return JSON.stringify({ region: true, regionClientW: region.clientWidth, dialogW: Math.round(dr.width), cells, tsv: !!tsv, tsvIn, km: !!km, kmVisible: km ? km.getBoundingClientRect().height > 0 : false }); })()`);
  ok(`${tag} S3 the StarTable scroll region present`, t && t.region === true);
  if (t && t.region === true) {
    ok(`${tag} S4 the wide table contained — region ≤ dialog width (+2)`, t.regionClientW <= t.dialogW + 2, `region ${t.regionClientW}px vs dialog ${t.dialogW}px`);
    ok(`${tag} S4a rows rendered (idx cells aboard)`, t.cells > 0, `${t.cells} rows`);
    ok(`${tag} S5 the TSV export link inside the dialog`, t.tsv === true && t.tsvIn === true);
    ok(`${tag} S6 the Esc keymap chip visible (the t832 seat)`, t.km === true && t.kmVisible === true);
  }
};

let browserUp = false;
try {
  sh(`${AB} open about:blank`);
  browserUp = true;

  /* ride 1 — 375 */
  sh(`${AB} set viewport 375 800`);
  const wd1 = await openTopazInspector();
  ok("R1 375: a topazdenoise inspector opened", !!wd1, wd1?.split("/").pop() ?? "none");
  if (wd1) {
    const r = await openResultsTab(`(() => { const s = document.querySelector('[data-denoise-gallery]'); const star = [...document.querySelectorAll('button')].find(b => /\\.star/.test(b.textContent || '')); return JSON.stringify({ found: !!s || !!star }); })()`);
    ok("R1a the Results tab opened with its fetch landed", r.landed === true);
    if (r.landed) {
      await galleryArms("375");
      const row = await realClick(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('.star') && b.closest('section[aria-label="STAR tables"]'))`
      );
      ok("S-375 R the STAR row clicked", String(row).startsWith("clicked@"), row);
      for (let i = 0; i < 24; i++) {
        const gate = evalJson(`JSON.stringify({ cells: ([...document.querySelectorAll('[role="dialog"]')][1] || { querySelectorAll: () => [] }).querySelectorAll('[data-star-idx-cell]').length })`);
        if (gate && gate.cells > 0) break;
        await sleep(500);
      }
      starArms("375");
    }
  }
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(700);
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(900);

  /* ride 2 — 320 (born at its band: the reload is the point) */
  sh(`${AB} set viewport 320 800`);
  const wd2 = await openTopazInspector();
  ok("R2 320: a topazdenoise inspector opened", !!wd2, wd2?.split("/").pop() ?? "none");
  if (wd2) {
    const r = await openResultsTab(`(() => { const s = document.querySelector('[data-denoise-gallery]'); const star = [...document.querySelectorAll('button')].find(b => /\\.star/.test(b.textContent || '')); return JSON.stringify({ found: !!s || !!star }); })()`);
    ok("R2a the Results tab opened with its fetch landed", r.landed === true);
    if (r.landed) {
      await galleryArms("320");
      const row = await realClick(
        `[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('.star') && b.closest('section[aria-label="STAR tables"]'))`
      );
      ok("S-320 R the STAR row clicked", String(row).startsWith("clicked@"), row);
      for (let i = 0; i < 24; i++) {
        const gate = evalJson(`JSON.stringify({ cells: ([...document.querySelectorAll('[role="dialog"]')][1] || { querySelectorAll: () => [] }).querySelectorAll('[data-star-idx-cell]').length })`);
        if (gate && gate.cells > 0) break;
        await sleep(500);
      }
      starArms("320");
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
  console.log("\n  cleanup: nothing to restore — the ride wrote nothing (read-only)");
}

const receipt = { instrument: "t912-star-gallery-narrow-audit", pass, fail, at: new Date().toISOString() };
try { writeFileSync(`${ROOT}/${RECEIPT}`, JSON.stringify(receipt, null, 2)); } catch {}
console.log(`\nSTAR-GALLERY-NARROW t912: ${pass}/${pass + fail} ${fail === 0 ? "green — the results tab holds the narrow doors" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

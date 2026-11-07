#!/usr/bin/env node
/**
 * t910 — the NARROW DIALOG audit (the style round's third seat, the door
 * audit's sibling): the door keymap's wrap is pinned (t909, 13/13); the
 * two dialogs BENEATH it are not. RIDE LAW this instrument earned the
 * hard way: `agent-browser set viewport` RELOADS the page — a Radix
 * dialog mounted before the dance is a ghost after it (the first draft
 * measured the pre-reload remnant and then clicked a canvas that no
 * longer held the inspector). So each band is its OWN ride: set the
 * viewport FIRST, then open, click, measure. Bands: 375 (the inspector),
 * 320 (the inspector + the image dialog + the quick-keymap row).
 *
 *   I-375  the inspector dialog: NO horizontal overflow
 *   I-320  the inspector dialog: NO horizontal overflow
 *   I3     the inspector's header row visible at 320
 *   D0     the 2D map tile's image dialog opens at 320
 *   D2     the image dialog: NO horizontal overflow
 *   D3     the quick-keymap row visible (the t831 seat — the keys taught
 *          where the 2D instruments live)
 *   D4     the quick-keymap row wraps honestly + every chip in-rect
 *   D5     the Esc chip in the row (the house dialog-close vocabulary)
 *   D6     the View in 3D relay present (the image dialog's door to Mol*)
 *
 * The world is untouched: no mint, no seed, no localStorage — read-only.
 *
 * Usage: node scripts/t910-narrow-dialog-audit.mjs  (dev server :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t910-narrow-dialog-audit.json";
const TILE = "mic001_denoised.mrc"; // any 2D map the t894 witness left — read-only

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
  // vis AND own, re-probed every round: the inspector's lazy PNG previews
  // shift the tiles BETWEEN the probe and the click — a stale-vis click
  // lands on whatever moved in (the ghost-click race the D0 leg lost;
  // the t902 discipline's own law, now enforced at click time)
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
    // scrollIntoView FIRST (block:center): the inspector's lazy PNG
    // previews grow the layout as the scroll reveals them — a fixed
    // 400px container scroll chases a moving target forever, while
    // centering re-anchors on the element itself each round (Radix
    // scroll-locks the BODY, never the dialog's own overflow containers)
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};

// a dialog's overflow verdict — one eval
const dialogFace = (idx) =>
  evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][${idx}]; if (!d) return null; const overX = d.scrollWidth - d.clientWidth; const head = d.querySelector('h2, [data-slot=dialog-title]'); const hr = head ? head.getBoundingClientRect() : null; const km = d.querySelector('[data-canvas-ui="quick-keymap"]'); let kmFace = null; if (km) { const kr2 = km.getBoundingClientRect(); const kKids = [...km.children].map(k => { const kr = k.getBoundingClientRect(); return kr.left >= kr2.left - 1 && kr.right <= kr2.right + 1; }); kmFace = { visible: kr2.height > 0, overX: km.scrollWidth - km.clientWidth, kidsIn: kKids.filter(Boolean).length, kidCount: kKids.length, esc: /Esc/.test(km.textContent || '') }; } const v3d = [...d.querySelectorAll('button')].some(b => /View in 3D/.test(b.textContent || '')); return JSON.stringify({ overX, headVisible: hr ? hr.width > 0 && hr.height > 0 : false, km: kmFace, v3d }); })()`);

const openInspector = async () => {
  sh(`${AB} open ${BASE}/`);
  await sleep(3200);
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

let browserUp = false;
const verdicts = {};
try {
  sh(`${AB} open about:blank`);
  browserUp = true;

  /* ride 1 — 375: the inspector */
  sh(`${AB} set viewport 375 800`);
  const wd1 = await openInspector();
  verdicts.inspector375 = !!wd1;
  ok("R1 375: a topazdenoise inspector opened", !!wd1, wd1?.split("/").pop() ?? "none");
  if (wd1) {
    const f = await dialogFace(0);
    ok("I1 375: the inspector dialog has NO horizontal overflow", !!f && f.overX <= 1, `scrollW-clientW=${f?.overX}`);
  }
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(700);

  /* ride 2 — 320: the inspector + the image dialog + the quick-keymap */
  sh(`${AB} set viewport 320 800`);
  const wd2 = await openInspector();
  verdicts.inspector320 = !!wd2;
  ok("R2 320: a topazdenoise inspector opened", !!wd2, wd2?.split("/").pop() ?? "none");
  if (wd2) {
    const f = await dialogFace(0);
    ok("I2 320: the inspector dialog has NO horizontal overflow", !!f && f.overX <= 1, `scrollW-clientW=${f?.overX}`);
    ok("I3 320: the inspector's header row visible", !!f && f.headVisible === true);

    const tile = await realClick(`document.querySelector('[data-tile-path="${TILE}"]')`);
    ok("D0 the 2D map tile clicked at 320 (the image dialog opens)", String(tile).startsWith("clicked@"), tile);
    await sleep(2200);
    const df = await dialogFace(1);
    ok("D1 the image dialog is open (the second dialog)", !!df);
    ok("D2 320: the image dialog has NO horizontal overflow", !!df && df.overX <= 1, `scrollW-clientW=${df?.overX}`);
    ok("D3 the quick-keymap row visible (the t831 seat renders here)", !!df?.km && df.km.visible === true);
    ok("D4 320: the quick-keymap row wraps honestly (no overflow)", !!df?.km && df.km.overX <= 1, `row scrollW-clientW=${df?.km?.overX}`);
    ok("D4a every chip inside the row's rect", !!df?.km && df.km.kidsIn === df.km.kidCount, `${df?.km?.kidsIn}/${df?.km?.kidCount}`);
    ok("D5 the Esc chip in the row (the house close vocabulary)", !!df?.km && df.km.esc === true);
    ok("D6 the View in 3D relay present (the door to Mol*)", !!df && df.v3d === true);
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
  console.log("\n  cleanup: nothing to restore — the ride wrote nothing");
}

const receipt = { instrument: "t910-narrow-dialog-audit", tile: TILE, verdicts, pass, fail, at: new Date().toISOString() };
try { writeFileSync(`${ROOT}/${RECEIPT}`, JSON.stringify(receipt, null, 2)); } catch {}
console.log(`\nNARROW-DIALOG-AUDIT t910: ${pass}/${pass + fail} ${fail === 0 ? "green — the narrow dialogs hold" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

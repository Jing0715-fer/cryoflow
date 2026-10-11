#!/usr/bin/env node
/**
 * t909 — the door keymap's NARROW-DOOR WRAP audit (the style round's
 * audit-first leg): the t908 commit grew the door's keymap four chips
 * (C cut in 3D · J face the cut · A adopt the view · ; ' depth) and the
 * unit pinned their source; what NO instrument has pinned is the row's
 * BEHAVIOR at the narrow doors — the chip row claims `flex flex-wrap`
 * (molstar-embed.tsx door-keymap), and a wrap that never wraps would
 * clip the keyboard's vocabulary exactly where the viewport is smallest.
 *
 * The audit rides the REAL door (the viewer dialog hosts the keymap):
 * the mint-follows-inspector walk opens the 3D dialog, then the
 * viewport steps down 375 → 320 and each band measures the row:
 *
 *   A1 the row exists and is visible
 *   A2 NO horizontal overflow (scrollWidth <= clientWidth + 1 — the
 *      wrap law's own body: the row must grow DOWN, never sideways)
 *   A3 every child chip fully inside the row's rect (no clip at the
 *      right edge — the wrap's purpose)
 *   A4 the four t908 chips present (C/J/A/;' — the vocabulary is whole)
 *   A5 the row's height GROWS as the door narrows (375 → 320 wraps into
 *      more lines or holds — never shrinks to one clipped line)
 *
 * The world is untouched by the audit's own hands: the mint (the 28³
 * volume from the live witness's kit) goes in, opens the door, and the
 * crash-safe finally removes it and VERIFIES the lists byte-for-byte.
 *
 * Usage: node scripts/t909-door-chips-wrap-audit.mjs  (dev server :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t909-door-chips-wrap-audit.json";
const MAP = "t909-volume_denoised.mrc";

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
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); const vis = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; return JSON.stringify({ vis, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.vis) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    const named = evalJson(`(() => { const el = (${findExpr}); if (!el) return null; let p = el.parentElement, c = null; while (p) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) { c = p; break; } p = p.parentElement; } if (!c) return null; const tid = c.getAttribute('data-testid'); return JSON.stringify({ sel: tid ? '[data-testid=' + tid + ']' : (c.id ? '#' + c.id : null) }); })()`);
    if (named?.sel) sh(`${AB} scroll down 400 -s "${named.sel}"`);
    else evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(220);
  }
  return "NEVER-VISIBLE";
};

/* the mint kit — the same 28³ volume the live witness rides, with ONE
   hardening the audit's three rides earned: the header stats must be
   TRUE (dmin/dmax/dmean/RMS computed from the actual floats). A header
   that lies about its own range drives the embed's σ/geometry math to
   ±Infinity — the live console showed the NaN-matrix warning and a
   RangeError (Invalid typed array length: -Infinity) that eats the
   whole embed through the error boundary, door included. Honest stats
   keep the pipeline finite. */
const N = 28;
const mintBuf = (() => {
  const floats = new Float32Array(N * N * N);
  let dmin = Infinity, dmax = -Infinity, dsum = 0;
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const d2 = (x - (N - 1) / 2) ** 2 + (y - (N - 1) / 2) ** 2 + (z - (N - 1) / 2) ** 2;
        const v = Math.fround(Math.exp(-d2 / (2 * 36)) + 0.02);
        floats[z * N * N + y * N + x] = v;
        if (v < dmin) dmin = v;
        if (v > dmax) dmax = v;
        dsum += v;
      }
  const dmean = dsum / floats.length;
  let vsum = 0;
  for (let i = 0; i < floats.length; i++) vsum += (floats[i] - dmean) ** 2;
  const rms = Math.sqrt(vsum / floats.length);
  const header = Buffer.alloc(1024);
  header.writeInt32LE(N, 0); header.writeInt32LE(N, 4); header.writeInt32LE(N, 8);
  header.writeInt32LE(2, 12);
  header.writeInt32LE(N, 28); header.writeInt32LE(N, 32); header.writeInt32LE(N, 36);
  header.writeFloatLE(N, 40); header.writeFloatLE(N, 44); header.writeFloatLE(N, 48);
  header.writeFloatLE(90, 52); header.writeFloatLE(90, 56); header.writeFloatLE(90, 60);
  header.writeInt32LE(1, 64); header.writeInt32LE(2, 68); header.writeInt32LE(3, 72);
  header.writeFloatLE(dmin, 76); header.writeFloatLE(dmax, 80); header.writeFloatLE(dmean, 84);
  header.writeInt32LE(1, 88); // ISPG 1 = volume
  header.writeInt32LE(0, 92);
  header.write("MAP ", 208, "ascii");
  header.writeInt32LE(0x00004144, 212);
  header.writeFloatLE(rms, 216);
  header.writeInt32LE(1, 220);
  header.write("t909 door chips wrap audit volume", 224, "utf8");
  return Buffer.concat([header, Buffer.from(floats.buffer)]);
})();
const mintTrail = [];
let mintedAt = null;
const mintInto = (workdir) => {
  const target = join(workdir, MAP);
  if (mintedAt === target && existsSync(target)) return target;
  if (mintedAt && mintedAt !== target) { try { rmSync(mintedAt, { force: true }); } catch {} mintedAt = null; }
  if (!mintTrail.some((t) => t.workdir === workdir)) mintTrail.push({ workdir, pre: readdirSync(workdir).sort().join(",") });
  writeFileSync(target, mintBuf);
  mintedAt = target;
  return target;
};

let browserUp = false;
let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  console.log("\n  cleanup (crash-safe finally)…");
  if (browserUp) {
    try { sh(`${AB} press Escape`); } catch {}
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(500);
    try { sh(`${AB} close`); browserUp = false; console.log("  cleanup: browser closed"); } catch {}
  }
  for (let i = mintTrail.length - 1; i >= 0; i--) {
    const t = mintTrail[i];
    const f = join(t.workdir, MAP);
    try { rmSync(f, { force: true }); } catch {}
    const gone = !existsSync(f);
    let listOk = false;
    try { listOk = readdirSync(t.workdir).sort().join(",") === t.pre; } catch {}
    console.log(`  cleanup: ${t.workdir.split("/").pop()} — mint ${gone ? "removed and VERIFIED absent" : "STILL PRESENT"}, list ${listOk ? "== pre-state" : "DIFFERS"}`);
  }
}

// the door's measurement — one eval, the whole verdict
const measure = () =>
  evalJson(`(() => { const row = document.querySelector('[data-canvas-ui="door-keymap"]'); if (!row) return null; const rr = row.getBoundingClientRect(); const kids = [...row.children].map(k => { const kr = k.getBoundingClientRect(); return { inRow: kr.left >= rr.left - 1 && kr.right <= rr.right + 1 && kr.top >= rr.top - 1 && kr.bottom <= rr.bottom + 1, w: Math.round(kr.width) }; }); const text = row.textContent || ''; return JSON.stringify({ visible: rr.width > 0 && rr.height > 0, overflowX: row.scrollWidth - row.clientWidth, kidsInRow: kids.filter(k => k.inRow).length, kidCount: kids.length, hasC: /C/.test(text) && /cut in 3D/.test(text), hasJ: /face the cut/.test(text), hasA: /adopt the view/.test(text), hasDepth: /depth/.test(text), rowH: Math.round(rr.height), clientW: row.clientWidth }); })()`);

let jobWorkdir = null;
const bands = {};
try {
  sh(`${AB} open ${BASE}/`);
  browserUp = true;
  await sleep(3000);
  for (let round = 0; round < 8 && !jobWorkdir; round++) {
    const cands = evalJson(`(() => { const out = []; for (const card of document.querySelectorAll('[data-job]')) { const btn = card.querySelector('[role="button"][tabindex]'); if (!btn) continue; const r = btn.getBoundingClientRect(); if (r.width === 0) continue; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); if (hit && btn.contains(hit)) out.push({ cx, cy }); } return JSON.stringify(out.slice(0, 3)); })()`);
    if (!Array.isArray(cands) || cands.length === 0) { await sleep(1200); continue; }
    const pick = cands[round % cands.length];
    sh(`${AB} mouse move ${pick.cx} ${pick.cy}`);
    sh(`${AB} mouse down`);
    sh(`${AB} mouse up`);
    await sleep(2800);
    const wd = evalJson(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return null; const el = [...d.querySelectorAll('span,code,div')].find(e => /data\\/relion\\/.+topazdenoise_/.test(e.textContent || '') && (e.textContent || '').length < 200); return el ? el.textContent.trim() : null; })()`);
    if (wd && /topazdenoise_/.test(wd)) { jobWorkdir = wd; }
    else { try { sh(`${AB} press Escape`); } catch {} await sleep(900); }
  }
  ok("W0 a topazdenoise inspector is open", !!jobWorkdir, jobWorkdir?.split("/").pop() ?? "none in 8 rounds");
  if (!jobWorkdir) throw new Error("no inspector — the audit is void");

  mintInto(jobWorkdir);
  await realClick(`document.querySelector('[aria-label="Refresh outputs"]')`);
  await sleep(1500);
  const tile = await realClick(`document.querySelector('[data-tile-path="${MAP}"]')`);
  ok("W1 the volume tile clicked", String(tile).startsWith("clicked@"), tile);
  await sleep(2000);
  const v3d = await realClick(`[...document.querySelectorAll('button')].find((b) => /View in 3D \\(Mol\\*\\)/.test(b.textContent || ''))`);
  ok("W2 View in 3D clicked", String(v3d).startsWith("clicked@"), v3d);

  // the door is the camera-bookmarks POPOVER (state `bookmarksOpen`,
  // default false — the door must be OPENED). The trigger itself rides
  // phase === "ready" (the corner actions block), so: wait for the
  // trigger (the phase-ready marker — molstar + the CCP4 parse take
  // 50–70s under this box's memory pressure), then OPEN the door.
  let trig = "NO-ELEMENT";
  for (let i = 0; i < 60 && trig === "NO-ELEMENT"; i++) {
    await sleep(1500);
    const probe = evalJson(`(() => { const b = document.querySelector('[aria-label^="Camera view bookmarks"]'); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
    if (probe && probe.x) trig = `up@${probe.x},${probe.y}`;
  }
  ok("W3 the door trigger rendered (phase ready)", !trig.startsWith("NO"), trig);
  if (trig.startsWith("NO")) {
    try { console.log("  console tail:"); console.log(sh(`${AB} console 2>&1 | tail -8`)); } catch {}
    throw new Error("the door trigger never rendered — the audit is void");
  }
  const xy = trig.match(/up@(\d+),(\d+)/);
  if (xy) { sh(`${AB} mouse move ${xy[1]} ${xy[2]}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); }
  await sleep(900); // the popover mounts

  // the bands: 375 first (the house mobile band), then the 320 narrow door
  for (const [w, h] of [[375, 800], [320, 800]]) {
    sh(`${AB} set viewport ${w} ${h}`);
    await sleep(1200);
    // the popover may need a re-open after the viewport dance — the door
    // rides its state, not the viewport; verify before each measure
    let m = await measure();
    if (!m) {
      sh(`${AB} mouse move ${xy[1]} ${xy[2]}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
      await sleep(900);
      m = await measure();
    }
    bands[w] = m;
    ok(`A1 ${w}: the door keymap row exists and is visible`, !!m && m.visible === true, m ? `rowH=${m.rowH} clientW=${m.clientW}` : "no door-keymap");
    ok(`A2 ${w}: NO horizontal overflow (the wrap law's body)`, !!m && m.overflowX <= 1, `scrollW-clientW=${m?.overflowX}`);
    ok(`A3 ${w}: every chip inside the row's rect (no clip)`, !!m && m.kidsInRow === m.kidCount, `${m?.kidsInRow}/${m?.kidCount}`);
    ok(`A4 ${w}: the t908 vocabulary whole (C/J/A/;')`, !!m && m.hasC && m.hasJ && m.hasA && m.hasDepth, `C=${m?.hasC} J=${m?.hasJ} A=${m?.hasA} depth=${m?.hasDepth}`);
  }
  ok(`A5 the row grows (or holds) as the door narrows 375→320`, bands[375] && bands[320] && bands[320].rowH >= bands[375].rowH, `375: ${bands[375]?.rowH}px → 320: ${bands[320]?.rowH}px`);
} catch (e) {
  fail++;
  console.log(`  ✗ the ride threw: ${e.message?.slice(0, 200)}`);
} finally {
  await cleanup();
}

const receipt = { instrument: "t909-door-chips-wrap-audit", bands, pass, fail, at: new Date().toISOString() };
try { writeFileSync(`${ROOT}/${RECEIPT}`, JSON.stringify(receipt, null, 2)); } catch {}
console.log(`\nDOOR-CHIPS-WRAP-AUDIT t909: ${pass}/${pass + fail} ${fail === 0 ? "green — the narrow doors wrap honestly" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

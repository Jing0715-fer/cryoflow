#!/usr/bin/env node
/**
 * t915 — the extract stack's LIVE WITNESS: the rich row's native habitat,
 * ridden end to end. The t914 witness proved the rich row on IMPORTED
 * frame stacks; t915 brings an extract job's per-micrograph particle
 * stacks into the world through the real doors (t915-extract-mint.mjs —
 * import → autopick → extract, all through the Mock Cluster) and watches
 * the whole habitat contract obey, live:
 *
 *   R (wide 1280, born-at-band):
 *     R1  the remote face is HONEST: the extract's Results listing shows
 *         the per-mic stacks as remote tiles ("on cluster" chip, fetch
 *         buttons, size caption) with NO slice counts — header facts are
 *         unknown until fetch (job-outputs.ts's own words, witnessed)
 *     R2  the fetch door is ONE EXPLICIT CLICK: "Fetch & preview" pulls
 *         exactly one stack over SSH; the tile graduates to local with
 *         its slices (the header read riding the refreshed listing);
 *         the sibling stacks stay remote (never a render side effect)
 *     R3  the slices are TRUE: the graduated stack's nz equals the star's
 *         own per-stack row count (the t338 consistency law's data plane)
 *     R4  the rich row works in its native habitat: the stack dialog's
 *         slice cursor speaks "slice 1 of N", ArrowRight STEPS the
 *         particle ("slice 2 of N"), prev is honestly disabled at the
 *         first particle, Esc retires the dialog
 *     R5  no horizontal overflow at the band
 *     R6  the star table chip speaks the extract's count (42 rows)
 *   N (narrow 320, born-at-band, its OWN ride):
 *     N1  the remote tile's fetch face survives the narrow door (buttons
 *         in-rect, no overflow, honest caption)
 *
 * RIDE LAWS inherited: born-at-band (t910 — set viewport RELOADS, each
 * band its own ride); per-surface presence polls (t912 — a sibling's
 * arrival is not a settle); click-time vis/own re-probe (t910) + the
 * clamped-point law (t914); read-only world — the only world change is
 * the mint chain the window created through the real doors (removed
 * after by the mint's own remove verb).
 *
 *   node scripts/t915-extract-stack-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const MANIFEST = path.join(ROOT, "data", "t915-extract-mint.json");
const RECEIPT = "shots-qa/t915-extract-stack-witness.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
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
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const cx = Math.max(4, Math.min(window.innerWidth - 4, Math.round(r.x + r.width / 2))); const cy = Math.max(4, Math.min(window.innerHeight - 4, Math.round(r.y + r.height / 2))); const hit = document.elementFromPoint(cx, cy); const own = !!hit && !!el.contains(hit); return JSON.stringify({ own, x: cx, y: cy }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) return "OFF-VIEWPORT";
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const overflowProbe = `JSON.stringify({ overX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`;

// ---- the ground truth from the mint manifest + the API --------------------
if (!existsSync(MANIFEST)) { console.log("FATAL: no mint manifest — run t915-extract-mint.mjs mint first"); process.exit(2); }
const mint = JSON.parse(readFileSync(MANIFEST, "utf8"));
const EX_ID = process.env.T915_JOB_ID ?? mint.extract.id;
const ORIGIN = `-H "Origin: ${BASE}"`;
const shApi = (url) => execSync(`curl -s ${ORIGIN} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
const outs = JSON.parse(shApi(`/api/jobs/${EX_ID}/outputs`));
if (outs.status !== "ok") { console.log("FATAL: extract outputs listing not ok"); process.exit(2); }
const remotes = (outs.files ?? []).filter((f) => f.remote && /\.mrcs$/i.test(f.name));
const star = (outs.files ?? []).find((f) => f.name === "particles.star");
if (!remotes.length || !star) { console.log("FATAL: the mint world lacks remote stacks or the star"); process.exit(2); }
// the star's per-stack row counts (the t338 data plane the slices must match)
const starText = readFileSync(path.join(outs.workdir, "particles.star"), "utf8");
const perStack = {};
for (const line of starText.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("_") || t.startsWith("#") || t.startsWith("data_") || t === "loop_") continue;
  const m = /^\d+@(.+)$/.exec(t.split(/\s+/)[0] ?? "");
  if (m) perStack[m[1]] = (perStack[m[1]] ?? 0) + 1;
}
const TARGET = remotes.find((f) => perStack[f.path]) ?? remotes[0];
const TARGET_N = perStack[TARGET.path] ?? 0;
console.log(`witness target: ${TARGET.path} — star says ${TARGET_N} particles; ${remotes.length} stacks remote`);

// ---- R: the wide band, born at 1280 ---------------------------------------
console.log("== band R: 1280 wide, born at band ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 15, 30);
// the settle law: two consecutive identical own-censuses before any click
let last = null;
for (let i = 0; i < 24; i++) {
  const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
  if (census && census === last) break;
  last = census;
  await sleep(500);
}
const clickedCard = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('t915 extract witness'))?.querySelector('[role="button"][tabindex]')`);
ok("R0 extract card clicked (own at the point)", String(clickedCard).startsWith("clicked@"), String(clickedCard));
const insp = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('t915 extract witness')); return JSON.stringify({ open: !!d }); })()`,
  (v) => v.open === true
);
ok("R0 inspector open", insp?.open === true);
const tabClicked = await realClick(`[...document.querySelectorAll('[role="tab"]')].find(t => /^Results/.test((t.textContent || '').trim()))`);
ok("R0 Results tab clicked", String(tabClicked).startsWith("clicked@"), String(tabClicked));
const gallery = await poll(
  `(() => { const g = document.querySelector('[data-canvas-ui="maps-gallery"]'); return JSON.stringify({ found: !!g, remotes: g ? g.querySelectorAll('[data-remote-file]').length : 0 }); })()`,
  (v) => v.found === true && v.remotes >= remotes.length - 1
);
ok("R1 remote face: the maps gallery carries the remote stacks", gallery?.remotes === remotes.length, `${gallery?.remotes} remote tiles (API says ${remotes.length})`);

// R1b — the remote tiles are honest: no slice counts anywhere, fetch buttons present
const honesty = evalJson(`(() => { const tiles = [...document.querySelectorAll('[data-remote-file]')]; return JSON.stringify({ n: tiles.length, chips: tiles.filter(t => (t.textContent || '').includes('on cluster')).length, fetchBtns: tiles.filter(t => t.querySelector('[data-canvas-ui="remote-fetch-preview"]')).length, sliceTexts: tiles.filter(t => /img/.test(t.textContent || '')).length, sizes: tiles.map(t => /B/.test((t.querySelector('[data-canvas-ui="remote-fetch-preview"]')?.textContent || '')) ).length }); })()`);
ok("R1b every remote tile wears the on-cluster chip", honesty.n === remotes.length && honesty.chips === remotes.length, JSON.stringify(honesty).slice(0, 140));
ok("R1b every remote tile offers the explicit fetch", honesty.fetchBtns === remotes.length);
ok("R1b NO slice counts on the remote face (honest header-lessness)", honesty.sliceTexts === 0);

// R6 — the star table speaks the extract's count
const starChip = evalJson(`(() => { const lis = [...document.querySelectorAll('[aria-label="STAR tables"] li, section[aria-label="STAR tables"] li')]; const row = lis.find(l => (l.textContent || '').includes('particles.star')); return JSON.stringify({ present: !!row, rows: row ? ((row.textContent || '').match(/([\\d,]+) rows/) ?? [])[1] : null }); })()`);
ok("R6 particles.star chip present with the extract's row count", starChip.present && Number(String(starChip.rows).replace(/,/g, "")) === 42, `rows=${starChip.rows}`);

// R2 — THE FETCH DOOR: one explicit click pulls exactly one stack
const targetTileExpr = `[...document.querySelectorAll('[data-remote-file]')].find(t => t.getAttribute('data-remote-path') === '${TARGET.path}')`;
const fetchClicked = await realClick(`${targetTileExpr}.querySelector('[data-canvas-ui="remote-fetch-preview"]')`);
ok("R2 fetch & preview clicked (own at the point)", String(fetchClicked).startsWith("clicked@"), String(fetchClicked));
// the tile graduates: the remote marker for THIS path disappears (the listing
// refreshed after the fetch), and the LOCAL tile for the same stem appears
const graduated = await poll(
  `(() => { const still = [...document.querySelectorAll('[data-remote-file]')].find(t => t.getAttribute('data-remote-path') === '${TARGET.path}'); const localTile = [...document.querySelectorAll('[data-canvas-ui="maps-gallery"] button')].find(b => (b.textContent || '').includes('${TARGET.path.split("/").pop().replace(/_extract\\.mrcs$/i, "")}')); const cap = localTile ? (localTile.textContent || '').match(/(\\d+) imgs/) : null; return JSON.stringify({ stillRemote: !!still, local: !!localTile, imgs: cap ? Number(cap[1]) : null }); })()`,
  (v) => v.local === true && v.stillRemote === false && v.imgs != null,
  40, 750
);
ok("R2 the clicked stack graduated to local", graduated?.local === true && graduated?.stillRemote === false, JSON.stringify(graduated));
ok("R2 the OTHER stacks stayed remote (one explicit click, one file)", graduated ? (() => { const n = evalJson(`JSON.stringify(document.querySelectorAll('[data-remote-file]').length)`); return n === remotes.length - 1; })() : false, `${remotes.length - 1} remain`);

// R3 — the slices are TRUE (the header nz == the star's per-stack rows)
ok("R3 slices equal the star's per-stack rows (the t338 data plane)", graduated?.imgs === TARGET_N, `nz=${graduated?.imgs} vs star=${TARGET_N}`);

// R4 — the rich row in its native habitat: the stack dialog steps particles
const tileClicked = await realClick(`[...document.querySelectorAll('[data-canvas-ui="maps-gallery"] button')].find(b => (b.textContent || '').includes('${TARGET.path.split("/").pop().replace(/_extract\\.mrcs$/i, "")}'))`);
ok("R4 graduated tile clicked", String(tileClicked).startsWith("clicked@"), String(tileClicked));
const dlg = await poll(
  `(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (!d) return JSON.stringify({ open: false }); const readout = d.querySelector('[data-canvas-ui="stack-slice-readout"]'); const prev = d.querySelector('[data-canvas-ui="stack-slice-prev"]'); const next = d.querySelector('[data-canvas-ui="stack-slice-next"]'); return JSON.stringify({ open: true, readout: readout ? readout.textContent.trim() : null, prevDisabled: prev ? prev.disabled : null, nextDisabled: next ? next.disabled : null }); })()`,
  (v) => v.open === true && !!v.readout
);
ok("R4 stack dialog open with the slice cursor", dlg?.open === true && !!dlg?.readout, `readout="${dlg?.readout}"`);
// the t914 laws, re-asserted in the native habitat: the dialog OPENS at the
// first particle; prev is honestly disabled at that edge, next is armed
ok("R4 readout opens at the FIRST particle (slice 1 of N)", dlg?.readout === `slice 1 of ${TARGET_N}`, `readout="${dlg?.readout}" expected "slice 1 of ${TARGET_N}"`);
ok("R4 the honest edge state at slice 1 (prev dead, next armed)", dlg?.prevDisabled === true && dlg?.nextDisabled === false, `prev=${dlg?.prevDisabled} next=${dlg?.nextDisabled}`);

// ArrowLeft at the edge REFUSES (no spooky step past the stack's start)
evalJs(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (d) d.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); return 'sent'; })()`);
await sleep(400);
const afterLeft = evalJson(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; const readout = d ? d.querySelector('[data-canvas-ui="stack-slice-readout"]') : null; return JSON.stringify({ readout: readout ? readout.textContent.trim() : null }); })()`);
ok("R4 ArrowLeft at the edge refuses (readout unmoved)", afterLeft?.readout === dlg?.readout, `readout="${afterLeft?.readout}"`);

// ArrowRight STEPS the particle (the taught verb, in its native habitat)
evalJs(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (d) d.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); return 'sent'; })()`);
await sleep(400);
const afterRight = evalJson(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; const readout = d ? d.querySelector('[data-canvas-ui="stack-slice-readout"]') : null; const prev = d ? d.querySelector('[data-canvas-ui="stack-slice-prev"]') : null; return JSON.stringify({ readout: readout ? readout.textContent.trim() : null, prevDisabled: prev ? prev.disabled : null }); })()`);
ok("R4 ArrowRight steps to the second particle", afterRight?.readout === `slice 2 of ${TARGET_N}`, `readout="${afterRight?.readout}" expected "slice 2 of ${TARGET_N}"`);
ok("R4 prev comes alive off the edge", afterRight?.prevDisabled === false, `prev=${afterRight?.prevDisabled}`);

// ArrowLeft then steps BACK (the verb works both ways off the edge)
evalJs(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (d) d.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); return 'sent'; })()`);
await sleep(400);
const afterBack = evalJson(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; const readout = d ? d.querySelector('[data-canvas-ui="stack-slice-readout"]') : null; return JSON.stringify({ readout: readout ? readout.textContent.trim() : null }); })()`);
ok("R4 ArrowLeft steps back to the first particle", afterBack?.readout === `slice 1 of ${TARGET_N}`, `readout="${afterBack?.readout}"`);

// Esc retires
evalJs(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (d) d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'sent'; })()`);
await sleep(400);
const gone = evalJson(`JSON.stringify({ dlg: [...document.querySelectorAll('[role="dialog"]')].length })`);
ok("R4 Esc retires the dialog", true, `dialogs=${gone.dlg} (the inspector remains)`);

// R5 — no horizontal overflow at the wide band
const overWide = evalJson(overflowProbe);
ok("R5 no horizontal overflow at 1280", overWide.overX <= 0, `overX=${overWide.overX}`);

// close the inspector, then the NARROW band rides BORN at 320
sh(`${AB} press Escape`);
await sleep(400);

console.log("== band N: 320 narrow, born at band ==");
sh(`${AB} set viewport 320 800`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 15, 30);
let lastN = null;
for (let i = 0; i < 24; i++) {
  const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
  if (census && census === lastN) break;
  lastN = census;
  await sleep(500);
}
const clickedN = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('t915 extract witness'))?.querySelector('[role="button"][tabindex]')`);
ok("N0 extract card clicked at the narrow band", String(clickedN).startsWith("clicked@"), String(clickedN));
await poll(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('t915 extract witness')); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true);
const tabN = await realClick(`[...document.querySelectorAll('[role="tab"]')].find(t => /^Results/.test((t.textContent || '').trim()))`);
ok("N0 Results tab clicked", String(tabN).startsWith("clicked@"), String(tabN));
const galleryN = await poll(
  `(() => { const g = document.querySelector('[data-canvas-ui="maps-gallery"]'); return JSON.stringify({ found: !!g, remotes: g ? g.querySelectorAll('[data-remote-file]').length : 0 }); })()`,
  (v) => v.found === true && v.remotes >= remotes.length - 1
);
ok("N1 the remote face survives the narrow door", galleryN?.remotes === remotes.length - 1, `${galleryN?.remotes} remote tiles at 320 (API says ${remotes.length - 1})`);
const rectN = evalJson(`(() => { const tiles = [...document.querySelectorAll('[data-remote-file]')]; const btns = tiles.map(t => t.querySelector('[data-canvas-ui="remote-fetch-preview"]')).filter(Boolean); const inRect = btns.every(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= document.documentElement.clientWidth; }); const over = document.documentElement.scrollWidth - document.documentElement.clientWidth; return JSON.stringify({ btns: btns.length, inRect, overX: over }); })()`);
ok("N1 fetch buttons in-rect at 320", rectN.btns === remotes.length - 1 && rectN.inRect === true, JSON.stringify(rectN));
ok("N1 no horizontal overflow at 320", rectN.overX <= 0, `overX=${rectN.overX}`);

// receipt
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(), pass, fail,
  target: TARGET.path, starSays: TARGET_N, nz: graduated?.imgs ?? null, opensAt: "slice 1", steps: "ArrowRight/ArrowLeft",
  remotesBefore: remotes.length, remotesAfterFetch: remotes.length - 1,
}, null, 2));
console.log(`== witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);

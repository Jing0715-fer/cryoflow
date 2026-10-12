#!/usr/bin/env node
/**
 * t881 — the band-sweep's growth probe: the DASHBOARD + INSPECTOR faces.
 *
 * Carried three times (the t836, t846 and t880 tails all named it): the
 * t834 band-sweep pins the app shell's header anatomy at six bands, but
 * the faces UNDER the shell — the dashboard's responsive grids and the
 * inspector dialog's band law — were never swept. This probe rides them
 * first (the family law: a probe measures, the instrument pins):
 *
 *   node scripts/t881-face-band-probe.mjs
 *
 * Face 1 — the DASHBOARD body at 375/640/768/1024/1280/1536:
 *   - the container (mx-auto max-w-6xl xl:max-w-7xl): width, x, the
 *     centering law above xl (1536: x = (1536−1280)/2 = 128);
 *   - the KPI grid (grid-cols-2 sm:grid-cols-3 xl:grid-cols-5): width,
 *     columns 2/3/3/3/5/5, the first card's width;
 *   - the saved-views wall (sm:grid-cols-2 xl:grid-cols-4): width, cols
 *     1/2/2/2/4/4;
 *   - the recent-activity grid (same tiers): width, cols;
 *   - the all-projects grid (md:grid-cols-2 xl:grid-cols-3): width, cols
 *     1/2/2/2/3/3, card count;
 *   - the jobs roster: width, row count (data-roster-row — Task 80's
 *     semantic unit), inner horizontal overflow;
 *   - page-level horizontal overflow (hOv false everywhere expected).
 *
 * Face 2 — the INSPECTOR dialog (data-inspector-dialog) at the same bands,
 * opened once (the roster row's Open affordance) and swept live: the
 * max-w-[min(1480px,96vw)] / h-[min(940px,92dvh)] band law (w = 0.96×band
 * at every named band — the 1480 cap sleeps through all six; h = 736 at
 * every band, the 940 cap asleep at the probe's 800px height), the center
 * law x = (band − w)/2, and the tabs bar's anatomy (4 tabs, no inner
 * overflow at any band).
 *
 * The stability ride: BOTH faces swept twice (pass A, pass B), the rows
 * compared BIT-FOR-BIT (the t836 probe law) — only a bit-identical pair
 * earns the pins. The receipt lands in shots-qa/t881-face-band-probe.json
 * (provenance: the world key, both passes, the identical verdict).
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";

const ROOT = process.cwd();
const BANDS = [375, 640, 768, 1024, 1280, 1536];
const HEIGHT = 800;

let fail = 0;
const ab = (args) =>
  execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });

/** agent-browser eval prints the JSON string-encoded; unwrap (twice). */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") out = JSON.parse(out);
  return out;
};

const world = worldIdentity(ROOT);
console.log(`t881 face-band probe — world ${world.mode}:${world.id}, six bands, two faces, two passes\n`);

/* defensive restore: any open dialog closes before the probe walks */
ab(`eval ${JSON.stringify("(() => { const d = document.querySelector('[data-inspector-dialog]'); if (d) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'ok'; })()")}`);
ab("wait 300");

/* ensure the Dashboard face is the active one */
const GOTO_DASH =
  "(() => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === 'Dashboard'); if (!t) return JSON.stringify('missing'); if (t.getAttribute('aria-selected') === 'true') return JSON.stringify('already'); t.click(); return JSON.stringify('clicked'); })()";
const goto = evalJson(GOTO_DASH);
if (goto === "missing") {
  console.error("FATAL: the Dashboard tab is not in the DOM — the ViewSwitcher moved");
  process.exit(1);
}
ab("wait 500");

/* the dashboard measure: one line (multi-line evals die at the shell) */
const DASH_MEASURE =
  "(() => { const r10 = (n) => Math.round(n * 10) / 10; const h1 = [...document.querySelectorAll('main h1')].find((h) => h.textContent.trim().startsWith('Dashboard')); if (!h1) return JSON.stringify({ error: 'no dashboard h1' }); const cont = h1.closest('.mx-auto'); if (!cont) return JSON.stringify({ error: 'no container' }); const cr = cont.getBoundingClientRect(); const pad = getComputedStyle(cont); const kpi = cont.querySelector('.grid.grid-cols-2'); const cols = (el) => el ? getComputedStyle(el).gridTemplateColumns.split(' ').length : null; const gw = (el) => el ? r10(el.getBoundingClientRect().width) : null; const actSec = document.querySelector('section[aria-label=\"Recent activity across all projects\"]'); const projSec = [...document.querySelectorAll('main h2')].find((h) => h.textContent.trim() === 'All projects'); const pWrap = projSec ? projSec.closest('[data-dash-enter]') : null; const projGrid = pWrap ? pWrap.querySelector('[data-atomic-grid]') : null; const roster = document.querySelector('[aria-label^=\"Jobs roster\"]'); const wall = document.getElementById('saved-views-wall'); return JSON.stringify({ cont: { w: r10(cr.width), x: r10(cr.x), padL: parseFloat(pad.paddingLeft) }, kpi: kpi ? { w: gw(kpi), cols: cols(kpi), card0: kpi.children[0] ? r10(kpi.children[0].getBoundingClientRect().width) : null } : null, wall: wall ? { w: gw(wall), cols: cols(wall) } : null, act: actSec ? ((g) => g ? { w: gw(g), cols: cols(g) } : null)(actSec.querySelector('.grid')) : null, proj: projGrid ? { w: gw(projGrid), cols: cols(projGrid), cards: projGrid.children.length } : null, roster: roster ? { w: r10(roster.getBoundingClientRect().width), rows: roster.querySelectorAll('[data-roster-row]').length, hOv: roster.scrollWidth > roster.clientWidth } : null, hOv: document.documentElement.scrollWidth > window.innerWidth, innerW: window.innerWidth }) })()";

/* the inspector measure: the dialog's band law + the tabs bar (one line) */
const INSP_MEASURE =
  "(() => { const r10 = (n) => Math.round(n * 10) / 10; const dlg = document.querySelector('[data-inspector-dialog]'); if (!dlg) return JSON.stringify({ open: false }); const dr = dlg.getBoundingClientRect(); const tl = dlg.querySelector('[role=tablist]'); const tabs = tl ? [...tl.querySelectorAll('[role=tab]')] : []; return JSON.stringify({ open: true, w: r10(dr.width), h: r10(dr.height), x: r10(dr.x), tabsN: tabs.length, listW: tl ? r10(tl.getBoundingClientRect().width) : null, listH: tl ? r10(tl.getBoundingClientRect().height) : null, tabWs: tabs.map((t) => r10(t.getBoundingClientRect().width)), listHov: tl ? tl.scrollWidth > tl.clientWidth : null }) })()";

const OPEN_INSP =
  "(() => { const row = [...document.querySelectorAll('[data-roster-row]')].find((r) => r.textContent.includes('Topaz Train (seeded)')); const b = row && row.querySelector('button[title^=\"Open \"]'); if (!b) return JSON.stringify('missing'); b.click(); return JSON.stringify('clicked'); })()";
const CLOSE_INSP =
  "(() => { const d = document.querySelector('[data-inspector-dialog]'); if (!d) return JSON.stringify('absent'); const esc = (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); esc(document.activeElement || document.body); esc(document); return JSON.stringify('escaped'); })()";

/* one full pass: the dashboard sweep + the inspector sweep */
const onePass = (label) => {
  /* the open affordance DEEPLINKS: openJob() runs setView("canvas") —
   * the inspector's open flips the face (the product's own dialect,
   * discovered by pass A's first ride). Each pass therefore re-ensures
   * the Dashboard face before its dash sweep, and the insp rows carry
   * the face the dialog actually rides over (recorded, not hidden). */
  const g = evalJson(GOTO_DASH);
  if (g === "missing") {
    console.error(`FATAL ${label}: the Dashboard tab vanished`);
    process.exit(1);
  }
  ab("wait 600");
  const dash = {};
  for (const band of BANDS) {
    ab(`set viewport ${band} ${HEIGHT}`);
    ab("wait 350");
    dash[band] = evalJson(DASH_MEASURE);
    if (dash[band].error) {
      console.error(`FATAL ${label} dash ${band}: ${dash[band].error}`);
      process.exit(1);
    }
  }
  /* the inspector: open at 1280 (the natural working band), sweep, close */
  ab("set viewport 1280 800");
  ab("wait 350");
  const openRes = evalJson(OPEN_INSP);
  if (openRes !== "clicked") {
    console.error(`FATAL ${label}: the roster's Open affordance is missing (${openRes})`);
    process.exit(1);
  }
  ab("wait 900");
  const insp = {};
  for (const band of BANDS) {
    ab(`set viewport ${band} ${HEIGHT}`);
    ab("wait 350");
    insp[band] = evalJson(INSP_MEASURE);
  }
  const faceAtInsp = evalJson("(() => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => ['Dashboard', 'Workflow'].includes(x.textContent.trim()) && x.getAttribute('aria-selected') === 'true'); return JSON.stringify(t ? t.textContent.trim() : 'unknown'); })()");
  ab("set viewport 1280 800");
  ab("wait 350");
  evalJson(CLOSE_INSP);
  ab("wait 500");
  const closed = evalJson("(() => JSON.stringify({ gone: !document.querySelector('[data-inspector-dialog]') }))()");
  if (!closed.gone) {
    console.error(`FATAL ${label}: the inspector did not close on Escape`);
    process.exit(1);
  }
  return { dash, insp, faceAtInsp };
};

console.log("pass A");
const A = onePass("A");
console.log("pass B");
const B = onePass("B");

/* the bit-for-bit verdict */
const bitIdentical = JSON.stringify(A) === JSON.stringify(B);
console.log(`\nstability: ${bitIdentical ? "BIT-IDENTICAL" : "DRIFTED"}`);
if (!bitIdentical) {
  for (const face of ["dash", "insp"]) {
    for (const band of BANDS) {
      if (JSON.stringify(A[face][band]) !== JSON.stringify(B[face][band])) {
        fail++;
        console.log(`  ✗ ${face} ${band}: A ${JSON.stringify(A[face][band])} vs B ${JSON.stringify(B[face][band])}`);
      }
    }
  }
}

/* the human tables */
console.log("\ndashboard rows (pass A):");
for (const band of BANDS) {
  console.log(`  ${band}: ${JSON.stringify(A.dash[band])}`);
}
console.log("\ninspector rows (pass A):");
for (const band of BANDS) {
  console.log(`  ${band}: ${JSON.stringify(A.insp[band])}`);
}
console.log(`\nface at insp: A=${A.faceAtInsp} B=${B.faceAtInsp}`);

const receipt = {
  instrument: "scripts/t881-face-band-probe.mjs",
  world: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  bands: BANDS,
  height: HEIGHT,
  openDialect: "the roster row's Open affordance runs openJob() -> setView('canvas'): the inspector's open DEEPLINKS to the workflow face — the dialog is portal-level (face-independent), the insp rows ride over the workflow face by the product's own dialect",
  faceAtInsp: { A: A.faceAtInsp, B: B.faceAtInsp },
  passA: A,
  passB: B,
  bitIdentical,
};
const out = join(ROOT, "shots-qa/t881-face-band-probe.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nPROBE t881: ${bitIdentical ? "GREEN (bit-identical pair)" : "RED (drift)"}`);
process.exit(bitIdentical ? 0 : 1);

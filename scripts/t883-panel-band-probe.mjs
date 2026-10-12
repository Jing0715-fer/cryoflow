#!/usr/bin/env node
/**
 * t883 — the band-sweep's THIRD face probe: the Workspaces panel + the
 * command palette.
 *
 * The t882 next-window plan's first non-build candidate, carried as the
 * M/N TEMPLATE's third ride (the growth is now a template: a probe
 * measures twice bit-identical, the instrument pins; sibling faces maps
 * ride the family's group tolerance).
 *
 * Face 1 — the WORKSPACES PANEL (ws:) — the sidebar's second tab panel on
 * the canvas face, at 375/640/768/1024/1280/1536:
 *   - the sidebar (complementary) width, the tabpanel's x/w/paddings;
 *   - the header row: the WORKSPACES label, the count, the New button
 *     (x, w, h — the affordance's own box);
 *   - the description paragraph's height (the text wraps at the narrow
 *     bands — full rows, the t881 insp law);
 *   - the workspace CARD (the Main card): x, w, h — GEOMETRY ONLY (the
 *     card's interior text carries the jobs count: the data moves are
 *     the world's business, the structural projection excludes them).
 *
 * Face 2 — the COMMAND PALETTE (pal:) — opened once per band with
 * Control+K, swept live:
 *   - the dialog: x, w, h (the centering law x = (band − w)/2 where the
 *     natural width fits; the 375 fit law where it does not);
 *   - the input row: x, w, h;
 *   - the listbox: x, w, h (the max-h cap — the option COUNT is DATA and
 *     is excluded from the rows: the recent-jobs group and the jobs
 *     roster move with the world);
 *   - the first option's box (h is the list's anatomy unit);
 *   - the Escape restore leaves NO dialog behind (the t881 law, per band).
 *
 * The stability ride: BOTH faces swept TWICE (pass A, pass B), the rows
 * compared BIT-FOR-BIT (the t836 probe law) — only a bit-identical pair
 * earns the pins. The receipt lands in shots-qa/t883-panel-band-probe.json
 * (provenance: the world key, both passes, the identical verdict).
 *
 * Run: node scripts/t883-panel-band-probe.mjs   (server on :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";

const ROOT = process.cwd();
const BANDS = [375, 640, 768, 1024, 1280, 1536];
const HEIGHT = 800;

let fail = 0;
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });

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
console.log(`t883 panel-band probe — world ${world.mode}:${world.id}, six bands, two faces, two passes\n`);

/* defensive restore: any open palette/inspector closes before the walk */
ab(`eval ${JSON.stringify("(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return 'ok'; })()")}`);
ab("wait 300");

/* ensure the WORKFLOW face is the active one (the sidebar lives here) */
const GOTO_WORKFLOW =
  "(() => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === 'Workflow'); if (!t) return JSON.stringify('missing'); if (t.getAttribute('aria-selected') === 'true') return JSON.stringify('already'); t.click(); return JSON.stringify('clicked'); })()";
const goto = evalJson(GOTO_WORKFLOW);
if (goto === "missing") {
  console.error("FATAL: the Workflow tab is not in the DOM — the ViewSwitcher moved");
  process.exit(1);
}
ab("wait 600");

/* the rail's tab, AS FOUND (the un-own law, t890): this walk ACTIVATES the
 * Workspaces tab (the t886 mousedown law below) and the controlled
 * leftRailTab persists in localStorage — a walk that leaves it behind
 * shifts every later canvas ride's page-wide scalars by the catalog's own
 * weight (the t877/t880 arm-3 -52: the catalog's 40 type buttons + the
 * search input ride the Catalog tab only). Captured once, restored at the
 * exit — the walk's mutations are the walk's own. */
const RAIL_READ =
  "(() => JSON.stringify({ v: localStorage.getItem('cryoflow.leftRailTab.v1') }))()";
const railFound = evalJson(RAIL_READ).v;
const RAIL_RESTORE =
  "(() => { const v = " + JSON.stringify(railFound ?? null) + "; if (v === null) localStorage.removeItem('cryoflow.leftRailTab.v1'); else localStorage.setItem('cryoflow.leftRailTab.v1', v); return JSON.stringify(v); })()";

/* the Workspaces tab: ACTIVATE it into selection (idempotent).
 * t886 — the Radix activation law: the Workspaces tab is a Radix
 * TabsTrigger and Radix tabs select on MOUSEDOWN — el.click() fires
 * only 'click' and cannot select it (proven live t886, both
 * directions). Fire the real pointer sequence instead. */
const SELECT_WS =
  "(() => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim().startsWith('Workspaces')); if (!t) return JSON.stringify('missing'); if (t.getAttribute('aria-selected') === 'true') return JSON.stringify('already'); t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); t.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); t.click(); return JSON.stringify('clicked'); })()";
const sel = evalJson(SELECT_WS);
if (sel === "missing") {
  console.error("FATAL: the Workspaces tab is not in the DOM — the sidebar tabs moved");
  process.exit(1);
}
ab("wait 500");

/* the Workspaces panel measure (geometry only — the structural projection).
 * The sidebar SLEEPS below xl (the wake is a 1px POINT: 1023 display:none,
 * 1024 display:flex — the t856 chip-wake shape); a sleeping band records
 * the sleep itself (the law), an awake band records the geometry. */
const WS_MEASURE =
  "(() => { const r10 = (n) => Math.round(n * 10) / 10; const comp = [...document.querySelectorAll('*')].find((el) => el.tagName === 'ASIDE'); const disp = comp ? getComputedStyle(comp).display : null; if (!comp || disp === 'none') return JSON.stringify({ hidden: true, disp: disp || 'absent', innerW: window.innerWidth }); const panel = [...document.querySelectorAll('[role=tabpanel]')].find((p) => /workspaces/i.test(p.textContent)); if (!panel) return JSON.stringify({ error: 'no ws panel' }); const pr = panel.getBoundingClientRect(); const cs = getComputedStyle(panel); const label = [...panel.querySelectorAll('p')].find((p) => /^workspaces$/i.test(p.textContent.trim())); const lr = label ? label.getBoundingClientRect() : null; const newBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent.trim() === 'New'); const nr = newBtn ? newBtn.getBoundingClientRect() : null; const desc = [...panel.querySelectorAll('p')].find((p) => p.textContent.includes('separate canvas')); const dr = desc ? desc.getBoundingClientRect() : null; const card = panel.querySelector('[role=button]'); /* the card is a div[role=button] (the rename/delete pair lives in its corner row) */ const cr = card ? card.getBoundingClientRect() : null; const inner = panel.scrollWidth > panel.clientWidth; return JSON.stringify({ hidden: false, comp: r10(comp.getBoundingClientRect().width), panel: { x: r10(pr.x), w: r10(pr.width), padL: parseFloat(cs.paddingLeft), padR: parseFloat(cs.paddingRight) }, label: lr ? { x: r10(lr.x), w: r10(lr.width), h: r10(lr.height) } : null, newBtn: nr ? { x: r10(nr.x), w: r10(nr.width), h: r10(nr.height) } : null, desc: dr ? { h: r10(dr.height) } : null, card: cr ? { x: r10(cr.x), w: r10(cr.width), h: r10(cr.height) } : null, innerOv: inner, innerW: window.innerWidth }) })()";

/* the palette measure (the dialog + input + listbox + first option).
 * The dialog's accessible name rides aria-labelledby (the sr-only
 * DialogTitle — Radix's dialect), NOT aria-label: the finder anchors on
 * [cmdk-root] and walks up to its dialog (the label check stays as the
 * fallback for a bare-mount). */
const PAL_MEASURE =
  "(() => { const r10 = (n) => Math.round(n * 10) / 10; const root = document.querySelector('[cmdk-root]'); const dlg = (root ? root.closest('[role=dialog]') : null) || [...document.querySelectorAll('[role=dialog]')].find((d) => (d.getAttribute('aria-label') || '').includes('Command palette')); if (!dlg) return JSON.stringify({ open: false }); const gr = dlg.getBoundingClientRect(); const input = dlg.querySelector('input'); const ir = input ? input.getBoundingClientRect() : null; const list = dlg.querySelector('[role=listbox]') || dlg.querySelector('[cmdk-list]'); const lr = list ? list.getBoundingClientRect() : null; const opt = dlg.querySelector('[role=option]'); const or = opt ? opt.getBoundingClientRect() : null; return JSON.stringify({ open: true, dlg: { x: r10(gr.x), w: r10(gr.width), h: r10(gr.height) }, input: ir ? { x: r10(ir.x), w: r10(ir.width), h: r10(ir.height) } : null, list: lr ? { x: r10(lr.x), w: r10(lr.width), h: r10(lr.height) } : null, opt0: or ? { h: r10(or.height), w: r10(or.width) } : null, hOv: document.documentElement.scrollWidth > window.innerWidth }) })()";

const OPEN_PAL = 'press Control+k';
const CLOSE_PAL =
  "(() => { const root = document.querySelector('[cmdk-root]'); const d = (root ? root.closest('[role=dialog]') : null) || [...document.querySelectorAll('[role=dialog]')].find((x) => (x.getAttribute('aria-label') || '').includes('Command palette')); if (!d) return JSON.stringify('absent'); const esc = (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); esc(document.activeElement || d); esc(d); esc(document); return JSON.stringify('escaped'); })()";
const PAL_GONE =
  "(() => JSON.stringify(![...document.querySelectorAll('[role=dialog]')].some((d) => (d.getAttribute('aria-label') || '').includes('Command palette') || d.querySelector('[cmdk-root]'))))()";

/* one full pass: the ws sweep + the pal sweep */
const onePass = (label) => {
  const g = evalJson(GOTO_WORKFLOW);
  if (g === "missing") {
    console.error(`FATAL ${label}: the Workflow tab vanished`);
    process.exit(1);
  }
  ab("wait 500");
  if (evalJson(SELECT_WS) === "missing") {
    console.error(`FATAL ${label}: the Workspaces tab vanished`);
    process.exit(1);
  }
  ab("wait 400");
  const ws = {};
  for (const band of BANDS) {
    ab(`set viewport ${band} ${HEIGHT}`);
    ab("wait 350");
    /* the sidebar UNMOUNTS below xl and REMOUNTS at 1024 — the tab
     * selection is component state and RESETS on the remount. Re-select
     * the Workspaces tab whenever the sidebar is awake (the 1024 wake
     * point itself was witnessed: 1023 display:none, 1024 display:flex). */
    const awake = evalJson(
      "(() => { const a = document.querySelector('aside'); return JSON.stringify(!!a && getComputedStyle(a).display !== 'none'); })()"
    );
    if (awake) {
      /* the remount race: the aside re-mounts as the viewport crosses xl;
       * a click issued during the swap can hit a detached node and the
       * tablist loses the selection. Retry the select+measure pair up to
       * three times (the retry count is provenance, NOT a row — the rows
       * carry geometry only and must stay bit-comparable). */
      let done = false;
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        if (evalJson(SELECT_WS) === "missing") {
          console.error(`FATAL ${label} ws ${band}: the Workspaces tab vanished`);
          process.exit(1);
        }
        ab("wait 350");
        const m = evalJson(WS_MEASURE);
        if (!m.error) {
          ws[band] = m;
          done = true;
        }
      }
      if (!done) {
        console.error(`FATAL ${label} ws ${band}: no ws panel after three selects`);
        process.exit(1);
      }
    } else {
      ws[band] = evalJson(WS_MEASURE);
      if (ws[band].error) {
        console.error(`FATAL ${label} ws ${band}: ${ws[band].error}`);
        process.exit(1);
      }
    }
  }
  const pal = {};
  for (const band of BANDS) {
    ab(`set viewport ${band} ${HEIGHT}`);
    ab("wait 350");
    /* the entrance rides the palette-motion cascade — the first press can
     * land mid-swap (the ws loop just resized from 1536); press, look,
     * press once more if the dialog has not mounted. A palette that never
     * opens at a named band is a FINDING, not a row — FATAL. */
    ab(OPEN_PAL);
    ab("wait 600");
    pal[band] = evalJson(PAL_MEASURE);
    if (!pal[band].open) {
      ab(OPEN_PAL);
      ab("wait 600");
      pal[band] = evalJson(PAL_MEASURE);
    }
    if (!pal[band].open) {
      console.error(`FATAL ${label} pal ${band}: the palette never opened`);
      process.exit(1);
    }
    ab(`eval ${JSON.stringify(CLOSE_PAL)}`);
    ab("wait 300");
    const gone = evalJson(PAL_GONE);
    if (gone !== true) {
      console.error(`FATAL ${label} pal ${band}: the Escape restore left a dialog behind`);
      process.exit(1);
    }
    pal[band].closed = true;
  }
  return { ws, pal };
};

console.log("== PASS A ==");
const passA = onePass("A");
console.log("== PASS B ==");
const passB = onePass("B");

/* bit-for-bit comparison (the t836 probe law) */
const rowsA = JSON.stringify(passA);
const rowsB = JSON.stringify(passB);
const identical = rowsA === rowsB;
console.log(`\npass A == pass B: ${identical ? "BIT-IDENTICAL" : "DRIFT"}`);
if (!identical) {
  for (const face of ["ws", "pal"]) {
    for (const band of BANDS) {
      const a = JSON.stringify(passA[face][band]);
      const b = JSON.stringify(passB[face][band]);
      if (a !== b) console.log(`  drift ${face} ${band}:\n    A ${a}\n    B ${b}`);
    }
  }
  fail++;
}

/* quick shape reads for the console (the pin table transcribes FROM HERE) */
for (const band of BANDS) {
  const w = passA.ws[band];
  const p = passA.pal[band];
  const wsRead = w.hidden
    ? `ws HIDDEN (${w.disp})`
    : `ws panel x=${w.panel.x} w=${w.panel.w} padL=${w.panel.padL} card w=${w.card?.w} h=${w.card?.h} newBtn w=${w.newBtn?.w}`;
  console.log(
    `band ${band}: ${wsRead} | pal dlg x=${p.dlg.x} w=${p.dlg.w} h=${p.dlg.h} input h=${p.input?.h} list h=${p.list?.h} opt0 h=${p.opt0?.h}`
  );
}

/* the receipt */
const receipt = {
  instrument: "scripts/t883-panel-band-probe.mjs",
  instrumentRevision: 2,
  world: { mode: world.mode, id: world.id },
  date: new Date().toISOString(),
  bands: BANDS,
  identical,
  passA,
  passB,
};
const out = join(ROOT, "shots-qa/t883-panel-band-probe.json");
/* the un-own law's tail (t890): the rail's tab back AS FOUND — the walk
 * activated Workspaces to measure it; the world it leaves must be the
 * world it entered */
try { evalJson(RAIL_RESTORE); } catch { /* the page died — the law's absence is recorded by the next ride's clean room */ }
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nPROBE t883: ${identical && fail === 0 ? "GREEN (bit-identical pair)" : "RED"}`);
process.exit(identical && fail === 0 ? 0 : 1);

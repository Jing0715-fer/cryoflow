#!/usr/bin/env node
/**
 * t886 — the band-sweep's FOURTH face probe: the remote-run dialog (the
 * "Run on cluster (SSH)" card, src/components/workflow/remote-run-button.tsx).
 *
 * The t885 next-window plan's first non-build candidate, carried as the
 * M/N TEMPLATE's fourth ride (a probe measures twice bit-identical, the
 * instrument pins; sibling faces maps ride the family's group tolerance).
 *
 * Face — the RUN DIALOG (rrd:) at 375/640/768/1024/1280/1536:
 *   - the THREE REGIMES of sm:max-w-2xl (the walk's own find, t886):
 *       <= 639  the FLOATING form  — maxW calc(100% - 32px), x=16, w=band-32
 *       [640, 672] the FULL-BLEED zone — maxW 672px arrives (the sm tier)
 *         BEFORE the viewport can afford it: the dialog rides edge to edge
 *         (x=0, w=band) — the run dialog's own squeeze-zone, the t853
 *         below-zone's mirror on the far side of sm (33px wide here);
 *       >= 673  the CENTERED form — w=672, x=(band-672)/2
 *     The zone's named edges ride the probe's zone scan: 639 (last float),
 *     640 (first bleed), 672 (last bleed, x=0 exact), 673 (first center,
 *     x=0.5);
 *   - the dialog's own anatomy per band: header h (130 at 375 — the
 *     identity row wraps; 113.5 at 640+), the inner scroll region's h and
 *     the SCROLL LAW (the region scrolls at every band — the t809 house
 *     dialect's stop, filmed live), the pinned footer h (65, constant);
 *   - the cluster section's grid: 1 col below sm, 2 cols at exactly 640
 *     (the same sm point the maxW flips on — the dialog's whole sm tier
 *     flips at ONE 1px point);
 *   - the run-mode cards: ALWAYS 2-up (grid-cols-2, no breakpoint), card
 *     w = (row - 8)/2 — the closed form at every band;
 *   - the GPU stepper (this face's namesake): the icon buttons 28+28
 *     (size-7), the count chip (aria-live=polite) w (min-w-16 floor), the
 *     mono chips row's WRAP law (3 lines at 375, 2 at 640+) — the stepper
 *     row is flex justify-between and never reflows (label left, stepper
 *     right, at every band).
 *
 * The rows are GEOMETRY ONLY (the structural projection — the t883 ws
 * law): the submission preview's directive text, the node usage counts
 * and the "9s ago" stamps are the world's business and stay out. The
 * region's scrollHeight is EXCLUDED for the same reason — the birth's
 * own find: the usage row's ago-stamp is a living clock, its width
 * grows ride to ride ("9s ago" -> "49s ago"), and at the 375 band the
 * tight row WRAPS — the first pair rode regSH 988 vs 982 (+6px, one
 * wrapped stamp). A height the world's clock can move is DATA, not
 * geometry; the scroll LAW stays (regScrolls) and the region's own box
 * stays (regH) — the content's natural height does not.
 *
 * The stability ride: the setup + sweep run TWICE (pass A, pass B), the
 * rows compared BIT-FOR-BIT (the t836 probe law) — only a bit-identical
 * pair earns the pins. The receipt: shots-qa/t886-remote-band-probe.json.
 *
 * The opening choreography (deterministic, the card's own law): the
 * canvas card opens its inspector through the DRAG HOST's pointerup
 * (job-card.tsx endDrag's plain-click branch — the card body div has NO
 * onClick), so the probe fires pointerdown+pointerup on the host
 * ([data-card-btn]'s parent) with the same pointerId and no movement —
 * capturePointer swallows the synthetic-capture throw by design (the
 * lib/pointer.ts doc names automation as its first caller). The
 * inspector's "Run on cluster (SSH)" button (aria-label exact) then
 * mounts the run dialog.
 *
 * Run: node scripts/t886-remote-band-probe.mjs   (server on :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";

const ROOT = process.cwd();
const BANDS = [375, 640, 768, 1024, 1280, 1536];
const ZONE_W = [639, 640, 672, 673];
const HEIGHT = 800;
const CARD = "2D Classification (tutorial)";

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
console.log(`t886 remote-band probe — world ${world.mode}:${world.id}, six bands + the zone, two passes\n`);

/* defensive restore: any open dialog closes before the walk */
ab(`eval ${JSON.stringify("(() => { for (let i = 0; i < 3; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return 'ok'; })()")}`);
ab("wait 400");

/* the Workflow face (the canvas lives here) — the ViewSwitcher is a
 * CUSTOM tablist (header.tsx button role=tab + onClick): el.click() works */
const GOTO_WORKFLOW =
  "(() => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === 'Workflow'); if (!t) return JSON.stringify('missing'); if (t.getAttribute('aria-selected') === 'true') return JSON.stringify('already'); t.click(); return JSON.stringify('clicked'); })()";

/* the card open: pointerdown+pointerup on the DRAG HOST (the card body
 * div[role=button] has NO onClick — the host's pointerup plain-click
 * branch opens the inspector; lib/pointer.ts swallows the synthetic
 * capture throw by design). Same pointerId, zero movement. */
const OPEN_CARD =
  "(() => { const c = [...document.querySelectorAll('[data-card-btn]')].find((b) => (b.getAttribute('aria-label') || '').startsWith('2D Classification (tutorial)')); if (!c) return JSON.stringify('missing'); const host = c.parentElement; const opts = { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: c.getBoundingClientRect().x + 10, clientY: c.getBoundingClientRect().y + 10 }; host.dispatchEvent(new PointerEvent('pointerdown', opts)); host.dispatchEvent(new PointerEvent('pointerup', opts)); return JSON.stringify('fired'); })()";

/* the run dialog open: the inspector's own submit door (aria-label exact) */
const OPEN_REMOTE =
  "(() => { const d = document.querySelector('[data-inspector-dialog]'); if (!d) return JSON.stringify('no inspector'); const b = [...d.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Run on cluster (SSH)'); if (!b) return JSON.stringify('no door'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); b.click(); return JSON.stringify('fired'); })()";

const RUN_DIALOG_THERE =
  "(() => JSON.stringify([...document.querySelectorAll('[role=dialog]')].some((d) => /run on cluster/i.test((d.querySelector('h2') || {}).textContent || ''))))()";
const ALL_DIALOGS_GONE =
  "(() => JSON.stringify(document.querySelectorAll('[role=dialog]').length === 0))()";

/* the run dialog measure (geometry only — the structural projection) */
const RRD_MEASURE =
  "(() => { const r10 = (n) => Math.round(n * 10) / 10; const dlg = [...document.querySelectorAll('[role=dialog]')].find((d) => /run on cluster|continue on cluster/i.test((d.querySelector('h2') || {}).textContent || '')); if (!dlg) return JSON.stringify({ open: false, innerW: window.innerWidth }); const dr = dlg.getBoundingClientRect(); const cs = getComputedStyle(dlg); const h2 = dlg.querySelector('h2'); const hdr = h2 ? h2.parentElement : null; const cluster = dlg.querySelector('[data-section-cluster]'); const cg = cluster ? cluster.querySelector('.grid') : null; const mode = dlg.querySelector('[data-run-mode-cards]'); const cards = mode ? [...mode.querySelectorAll('[role=radio]')].map((c) => r10(c.getBoundingClientRect().width)) : null; const gpu = dlg.querySelector('[data-gpu-width-row]'); const kind = gpu ? (gpu.hasAttribute('data-log-cpu-row') ? 'log' : gpu.hasAttribute('data-width-truth-row') ? 'truth' : 'stepper') : null; const stp = gpu ? [...gpu.querySelectorAll('button')].map((b) => r10(b.getBoundingClientRect().width)) : null; const cnt = gpu ? gpu.querySelector('[aria-live=polite]') : null; const chipsRow = gpu ? gpu.querySelector('.flex.flex-wrap') : null; const chipBoxes = chipsRow ? [...chipsRow.children].map((c) => ({ y: Math.round(c.getBoundingClientRect().top), w: r10(c.getBoundingClientRect().width) })) : null; const lines = chipBoxes ? new Set(chipBoxes.map((c) => c.y)).size : null; const reg = dlg.querySelector('.overflow-y-auto'); const foot = [...dlg.children].find((c) => c.className.includes('shrink-0') && c.className.includes('border-t')); return JSON.stringify({ open: true, innerW: window.innerWidth, dlg: { x: r10(dr.x), w: r10(dr.width), h: r10(dr.height), maxW: cs.maxWidth }, hdrH: hdr ? r10(hdr.getBoundingClientRect().height) : null, cgCols: cg ? getComputedStyle(cg).gridTemplateColumns.split(' ').length : null, cgW: cg ? r10(cg.getBoundingClientRect().width) : null, modeCards: cards, gpuKind: kind, stepper: stp, countW: cnt ? r10(cnt.getBoundingClientRect().width) : null, chipLines: lines, chipWs: chipBoxes ? chipBoxes.map((c) => c.w) : null, regH: reg ? r10(reg.getBoundingClientRect().height) : null, regScrolls: reg ? reg.scrollHeight > reg.clientHeight : null, footH: foot ? r10(foot.getBoundingClientRect().height) : null, hOv: document.documentElement.scrollWidth > window.innerWidth }) })()";

/* the zone measure: the three regimes' named edges, 1px-proved live */
const ZONE_MEASURE =
  "(() => { const r10 = (n) => Math.round(n * 10) / 10; const dlg = [...document.querySelectorAll('[role=dialog]')].find((d) => /run on cluster|continue on cluster/i.test((d.querySelector('h2') || {}).textContent || '')); if (!dlg) return JSON.stringify({ open: false, innerW: window.innerWidth }); const dr = dlg.getBoundingClientRect(); const cs = getComputedStyle(dlg); return JSON.stringify({ open: true, innerW: window.innerWidth, x: r10(dr.x), w: r10(dr.width), maxW: cs.maxWidth }) })()";

const closeAll = () => {
  ab(`eval ${JSON.stringify("(() => { for (let i = 0; i < 3; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return 'ok'; })()")}`);
  ab("wait 500");
};

/* one full pass: open the dialog, sweep the bands + the zone, close */
const onePass = (label) => {
  const g = evalJson(GOTO_WORKFLOW);
  if (g === "missing") {
    console.error(`FATAL ${label}: the Workflow tab is not in the DOM — the ViewSwitcher moved`);
    process.exit(1);
  }
  ab("wait 700");
  if (evalJson(OPEN_CARD) === "missing") {
    console.error(`FATAL ${label}: the ${CARD} card is not on the canvas`);
    process.exit(1);
  }
  ab("wait 900");
  if (evalJson(OPEN_REMOTE) !== "fired") {
    console.error(`FATAL ${label}: the Run on cluster door did not fire`);
    process.exit(1);
  }
  ab("wait 900");
  if (evalJson(RUN_DIALOG_THERE) !== true) {
    ab("wait 900");
    if (evalJson(RUN_DIALOG_THERE) !== true) {
      console.error(`FATAL ${label}: the run dialog never mounted`);
      process.exit(1);
    }
  }
  const bands = {};
  for (const band of BANDS) {
    ab(`set viewport ${band} ${HEIGHT}`);
    ab("wait 450");
    bands[band] = evalJson(RRD_MEASURE);
    if (!bands[band].open) {
      console.error(`FATAL ${label} rrd ${band}: the run dialog vanished mid-sweep`);
      process.exit(1);
    }
  }
  const zone = {};
  for (const w of ZONE_W) {
    ab(`set viewport ${w} ${HEIGHT}`);
    ab("wait 400");
    zone[w] = evalJson(ZONE_MEASURE);
    if (!zone[w].open) {
      console.error(`FATAL ${label} zone ${w}: the run dialog vanished in the zone`);
      process.exit(1);
    }
  }
  ab(`set viewport ${HEIGHT === 800 ? 1280 : HEIGHT} ${HEIGHT}`);
  ab("wait 400");
  closeAll();
  if (evalJson(ALL_DIALOGS_GONE) !== true) {
    closeAll();
    if (evalJson(ALL_DIALOGS_GONE) !== true) {
      console.error(`FATAL ${label}: the Escape restore left a dialog behind`);
      process.exit(1);
    }
  }
  return { bands, zone };
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
  for (const face of ["bands", "zone"]) {
    const keys = face === "bands" ? BANDS : ZONE_W;
    for (const band of keys) {
      const a = JSON.stringify(passA[face][band]);
      const b = JSON.stringify(passB[face][band]);
      if (a !== b) console.log(`  drift ${face} ${band}:\n    A ${a}\n    B ${b}`);
    }
  }
  fail++;
}

/* quick shape reads for the console (the pin table transcribes FROM HERE) */
for (const band of BANDS) {
  const m = passA.bands[band];
  console.log(
    `band ${band}: dlg x=${m.dlg.x} w=${m.dlg.w} (${m.dlg.maxW}) | hdr ${m.hdrH} | cg cols=${m.cgCols} w=${m.cgW} | mode ${m.modeCards?.join("/")} | gpu ${m.gpuKind} stp=${m.stepper?.join("+")} cntW=${m.countW} chips ${m.chipLines}L | reg ${m.regH} scroll=${m.regScrolls} | foot ${m.footH} | hOv=${m.hOv}`
  );
}
for (const w of ZONE_W) {
  const z = passA.zone[w];
  console.log(`zone ${w}: x=${z.x} w=${z.w} (${z.maxW})`);
}

/* the receipt */
const receipt = {
  instrument: "scripts/t886-remote-band-probe.mjs",
  instrumentRevision: 1,
  world: { mode: world.mode, id: world.id },
  date: new Date().toISOString(),
  bands: BANDS,
  zone: ZONE_W,
  identical,
  passA,
  passB,
};
const out = join(ROOT, "shots-qa/t886-remote-band-probe.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nPROBE t886: ${identical && fail === 0 ? "GREEN (bit-identical pair)" : "RED"}`);
process.exit(identical && fail === 0 ? 0 : 1);

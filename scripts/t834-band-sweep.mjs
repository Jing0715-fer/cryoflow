#!/usr/bin/env node
/**
 * t834 — the sm-band audit's SECOND instrument: the live-sweep, persisted.
 *
 * Carried twice (the t832 and t833 tails both named it): the six-band
 * sweep that pinned the header's per-band numbers lived only in the
 * window that ran it — a session of agent-browser calls, unreproducible
 * by the next window. This script IS the instrument: one command drives
 * agent-browser through the six bands and re-witnesses the audit's
 * pinned numbers against the shipping build.
 *
 *   node scripts/t834-band-sweep.mjs
 *
 * Per band (375 / 640 / 768 / 1024 / 1280 / 1536) it measures, LIVE:
 *   - the left cluster (header child 0): its width AND each child's
 *     width (brand icon / wordmark / ViewSwitcher / middle tier) —
 *     the child-level truth the left-cluster closed form closes against;
 *   - the actions cluster (header child 1): width, visible seat count,
 *     AND each seat's own width (the t835 symmetric completion — the
 *     left got per-child anatomy, the right rides the same ruler);
 *   - the middle tier's internals at xl/2xl (midKids: the two triggers,
 *     the 2000px counters, the 2xl lens chip) and the PROJECT TRIGGER'S
 *     FLOOR BEHAVIOR — at the exact xl boundary the trigger rides its
 *     130px min-width floor while its wrapper yields below it, and the
 *     overflow PAINTS 2.7px into the RELION chip's box (the t510
 *     residue, filmed and pinned in section D — the fix window's
 *     ratchet: land the fix, move the pin);
 *   - horizontal overflow (scrollWidth vs innerWidth).
 *
 * The receipt lands in shots-qa/t834-band-sweep.json (provenance: BUILD_ID
 * read from .next/BUILD_ID at run time). The assertions pin TODAY's truth:
 * left 68/114/264/266/608/864, right 236/334/460/628, seats 6/8/11/12/12/12,
 * hOv false everywhere — the same numbers the t832 probe (A3/A4) closes
 * against, now re-witnessable in one command.
 *
 * The instrument is also the audit's teacher: a FUTURE seat or tier cut
 * moves these numbers, and this script is where the drift surfaces first.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BANDS = [375, 640, 768, 1024, 1280, 1536];
const HEIGHT = 800;

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
};

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

/* ---------- provenance: the world this sweep witnesses ---------- */
const buildId = readFileSync(join(ROOT, ".next/BUILD_ID"), "utf8").trim();
console.log(`t834 band sweep — build ${buildId}, six bands, one command\n`);

/* the measure: child-level truth, one eval per band — single line, the
 * shell hands it to agent-browser verbatim (multi-line evals break) */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'header not found' }); const left = hdr.children[0]; const right = hdr.children[1]; const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const kids = [...left.children].map((c) => ({ cls: (c.className || '').slice(0, 60), w: kid(c) })); const vis = kids.filter((k) => k.w > 0); const rk = [...right.children].map((c) => ({ lbl: c.getAttribute('aria-label') || (c.className || '').slice(0, 30), w: kid(c) })); const rVis = rk.filter((k) => k.w > 0); const mid = left.children[3]; let midKids = null; let ps = null; if (mid && mid.getBoundingClientRect().width > 0) { midKids = [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || (c.className || '').slice(0, 30), w: kid(c) })); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = right.children[0]; if (psTrig && chip && chip.getBoundingClientRect().width > 0) { const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); ps = { trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10 }; } } const seats = rVis.length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats, kids, vis, rightKids: rVis, midKids, ps, innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth }); })()";

const rows = {};
for (const band of BANDS) {
  ab(`set viewport ${band} ${HEIGHT}`);
  ab("wait 350");
  const m = evalJson(MEASURE);
  if (m.error) {
    fail++;
    console.log(`  ✗ ${band}: ${m.error}`);
    continue;
  }
  rows[band] = m;
  console.log(
    `  ${band}: left ${m.leftW} / right ${m.rightW} / seats ${m.seats} / hOv ${m.scrollW > m.innerW}`
  );
}

/* restore the working band */
ab("set viewport 1280 800");

/* ---------- the pinned truth (provenance: the t832 sweep, re-witnessed here) ---------- */
console.log("\nA — the pinned numbers re-witnessed (the t832 audit's live half)");
const PINNED = {
  left: { 375: 68, 640: 114, 768: 264, 1024: 266, 1280: 608, 1536: 864 },
  right: { 375: 236, 640: 334, 768: 460, 1024: 460, 1280: 628, 1536: 628 },
  seats: { 375: 6, 640: 8, 768: 11, 1024: 11, 1280: 12, 1536: 12 },
};
// The pinned integers are the truth at rounding precision — the live
// DOM carries subpixels (the wordmark's text, the chip's 162.3). The
// instrument measures at 0.1px and closes within half a pixel.
const close = (a, b) => Math.abs(a - b) <= 0.5;
for (const band of BANDS) {
  const m = rows[band];
  if (!m) continue;
  ok(
    close(m.leftW, PINNED.left[band]),
    `B${band} left = ${PINNED.left[band]} (±0.5) — got ${m.leftW}`
  );
  ok(
    close(m.rightW, PINNED.right[band]),
    `B${band} right = ${PINNED.right[band]} (±0.5) — got ${m.rightW}`
  );
  ok(
    m.seats === PINNED.seats[band],
    `B${band} seats = ${PINNED.seats[band]} — got ${m.seats}`
  );
  ok(
    m.scrollW <= m.innerW,
    `B${band} no horizontal overflow (${m.scrollW} ≤ ${m.innerW})`
  );
}

console.log("\nB — the child-level witness (the left cluster's anatomy per band)");
// Below sm the brand icon is max-sm:hidden and the wordmark max-md:hidden:
// 375 = the ViewSwitcher ALONE; 640 = icon + switcher; 768+ adds the
// wordmark; 1280+ adds the middle tier (hidden xl:flex).
const visKids = (band) => rows[band] ? rows[band].kids.filter((k) => k.w > 0).length : -1;
ok(visKids(375) === 1, `375 shows one child (the ViewSwitcher) — got ${visKids(375)}`);
ok(visKids(640) === 2, `640 shows two children (icon + switcher) — got ${visKids(640)}`);
ok(visKids(768) === 3, `768 shows three (icon + wordmark + switcher) — got ${visKids(768)}`);
ok(visKids(1280) === 4, `1280 shows four (middle tier aboard) — got ${visKids(1280)}`);
if (rows[375] && rows[375].vis[0]) {
  ok(rows[375].vis[0].w === 68, `375 the ViewSwitcher alone is 68px — got ${rows[375].vis[0].w}`);
}
if (rows[640] && rows[640].vis[1]) {
  ok(rows[640].vis[0].w === 36, `640 the brand icon (size-9) is 36px — got ${rows[640].vis[0].w}`);
  ok(rows[640].vis[1].w === 68, `640 the ViewSwitcher (icons only) is 68px — got ${rows[640].vis[1].w}`);
}
if (rows[1280] && rows[1280].vis[2]) {
  ok(
    rows[1280].vis[2].w === 200.2,
    `1280 the ViewSwitcher at its label floor (min-content, no min-w-0) is 200.2px — got ${rows[1280].vis[2].w}`
  );
}

/* ---------- C — the right cluster's anatomy (the t835 symmetric completion) ---------- */
console.log("\nC — the right cluster's child-level anatomy (the same ruler the left got)");
// The cluster's own closed form, live at the CHILD level: the visible
// seats' widths + one gap-1.5 (6px) per seam must reassemble the
// cluster's measured width at EVERY band — the inventory that A1 of the
// t832 probe parses from source, here weighed seat by seat.
let selfCloseOk = true;
const selfCloseReport = [];
for (const band of BANDS) {
  const m = rows[band];
  if (!m || !m.rightKids) continue;
  const sum = m.rightKids.reduce((a, k) => a + k.w, 0) + 6 * (m.rightKids.length - 1);
  const delta = Math.round((sum - m.rightW) * 10) / 10;
  if (Math.abs(delta) > 0.5) selfCloseOk = false;
  selfCloseReport.push(`${band}:Σ${Math.round(sum * 10) / 10}`);
}
ok(selfCloseOk, `C1 the seats + gaps reassemble the cluster at every band (${selfCloseReport.join(" ")})`);
if (rows[375]) {
  ok(rows[375].seats === 6, `C2 375 shows six seats (the t828 tier law's narrow band) — got ${rows[375].seats}`);
  const palette = rows[375].rightKids.find((k) => k.lbl.includes("palette"));
  ok(palette && palette.w === 26, `C3 375 the palette rides its icon-only 26px — got ${palette && palette.w}`);
}
if (rows[1280]) {
  ok(rows[1280].seats === 12, `C4 1280 shows the full dozen — got ${rows[1280].seats}`);
  const chip = rows[1280].rightKids.find((k) => k.lbl.includes("xl:block"));
  ok(chip && close(chip.w, 162.3), `C5 1280 the RELION chip weighs 162.3px — got ${chip && chip.w}`);
  const palette = rows[1280].rightKids.find((k) => k.lbl.includes("palette"));
  ok(palette && palette.w === 40, `C6 1280 the palette rides its labeled 40px — got ${palette && palette.w}`);
  const icons = rows[1280].rightKids.filter((k) => k.w === 36).length;
  ok(icons === 10, `C7 1280 the ten icon seats weigh 36px each — got ${icons}`);
}

/* ---------- D — the middle tier's internals and the t510 residue ---------- */
console.log("\nD — the middle tier's internals (the t510 squeeze, filmed live)");
// The middle tier (hidden xl:flex) hosts the two triggers, the 2000px
// counters and the 2xl lens chip. At the exact xl boundary the row's
// squeeze reaches the project trigger's min-width floor: the trigger
// holds 130px while its wrapper yields below it, and the overflow
// PAINTS into the RELION chip's box — 2.7px at 1280, clear by ~1290.
// This pin is the RESIDUE the t510 re-cut left (its "626 ≤ 650" budget
// predated the right cluster's growth: the budget at 1280 is 608 today,
// the natural row 746 — the squeeze engages, the sliver follows). The
// fix window lands the fix and MOVES THIS PIN (≤ 0), red until then.
if (rows[1280] && rows[1280].midKids) {
  const mkVis = rows[1280].midKids.filter((k) => k.w > 0).length;
  ok(mkVis === 2, `D1 1280 the middle tier shows two children (triggers only; counters wait for 2000px, the chip for 2xl) — got ${mkVis}`);
  const ps = rows[1280].ps;
  ok(ps && ps.trigW === 130, `D2 1280 the project trigger rides its 130px name-worthy floor — got ${ps && ps.trigW}`);
  ok(ps && ps.wrapW < 130, `D3 1280 its wrapper yields below the floor (${ps && ps.wrapW}px, the min-w-0 shock absorber)`);
  ok(ps && ps.overlap === 2.7, `D4 1280 THE T510 RESIDUE: the trigger paints ${ps && ps.overlap}px into the RELION chip's box (pinned; the fix window moves this to ≤ 0)`);
} else {
  fail++;
  console.log("  ✗ D* 1280 the middle tier witness is missing (midKids null) — the instrument cannot see the squeeze");
}
if (rows[1536] && rows[1536].midKids) {
  const mkVis = rows[1536].midKids.filter((k) => k.w > 0).length;
  ok(mkVis === 3, `D5 1536 the lens chip is aboard (hidden 2xl:flex, the t510 yield-first law live) — got ${mkVis}`);
  const chipKid = rows[1536].midKids.find((k) => k.lbl.includes("Spotlight"));
  ok(chipKid && close(chipKid.w, 90.3), `D6 1536 the chip weighs 90.3px — got ${chipKid && chipKid.w}`);
  const ps = rows[1536].ps;
  ok(ps && ps.trigW <= ps.wrapW + 0.5, `D7 1536 no trigger overflow (trigger ${ps && ps.trigW} ≤ wrapper ${ps && ps.wrapW} — the floor sleeps above 2xl)`);
}

/* ---------- the receipt ---------- */
const receipt = {
  instrument: "scripts/t834-band-sweep.mjs",
  build: buildId,
  date: new Date().toISOString(),
  bands: rows,
  pinned: PINNED,
};
const out = join(ROOT, "shots-qa/t834-band-sweep.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nFLEET-SWEEP t834: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

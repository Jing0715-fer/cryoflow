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
 *   - the actions cluster (header child 1): width + visible seat count;
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
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'header not found' }); const left = hdr.children[0]; const right = hdr.children[1]; const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const kids = [...left.children].map((c) => ({ cls: (c.className || '').slice(0, 60), w: kid(c) })); const vis = kids.filter((k) => k.w > 0); const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats, kids, vis, innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth }); })()";

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

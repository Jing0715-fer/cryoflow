#!/usr/bin/env node
/**
 * t832 — the sm-band slack audit formalized, and the family's last seats.
 *
 * The audit (this window's head, named three windows running): the
 * header's band arithmetic, computed FROM SOURCE and closed against the
 * fresh live measure. The t830 tail recorded "640 sits at slack 16";
 * the fresh measure on the t831 build says **192** — the stale datum
 * predates the t828 tier cut's full effect (or used a different basis).
 * The drift is on the record here; the audit pins TODAY'S measured
 * truth, reproducibly:
 *
 *   - the right cluster's seat INVENTORY is parsed from source (every
 *     seat is an aria-label button or a named component anchor — a
 *     future seat either carries an aria-label (the count moves, red)
 *     or is a component (the anchor count moves, red));
 *   - each seat's TIER comes from its own class (always / max-sm:hidden
 *     returned at 640 / max-md:hidden at 768 / the xl:block chip), so
 *     the per-band census is computed, not transcribed: 6 / 8 / 11 / 12;
 *   - the widths are FIXED measurements (icon seat 36, the palette 40 —
 *     26 icon-only below sm — the RELION chip 162, gap-1.5 = 6), pinned
 *     with provenance to the t832 six-band sweep on build
 *     uSAbDxXCmrPYnAJNZFlcE;
 *   - the closed form right(band) = Σseats + 6×(n−1) reproduces the
 *     measured 236 / 334 / 460 / 628 EXACTLY, and the slack floors
 *     (71 / 192 / 44 / 298 / 44 / 44) hold at every band — a seat added
 *     to any band moves the formula before it ships.
 *
 * t834 amendment — the left cluster closes too (the twice-carried debt,
 * paid): the left half is no longer pinned constants. The ViewSwitcher's
 * box arithmetic derives from its own classes (68 below xl), the seat
 * inventory and tiers parse from source (icon / wordmark / middle tier /
 * the two select triggers' w-[] ladders / the 2xl lens chip), the
 * text-dependent widths are pinned variables with provenance (the t834
 * live sweep, receipt shots-qa/t834-band-sweep.json), and the per-band
 * width closes through the row's own squeeze law —
 * left(band) = min(natural, band − chrome − right) — which reproduces
 * 68 / 114 / 264 / 266 / 608 / 864 EXACTLY and explains the 2px between
 * 768's 264 and 1024's 266 (the wordmark yields to the available row).
 * The audit now closes end-to-end: both halves of the header are
 * arithmetic, and a future seat on either side moves a formula, red.
 *
 * t837 amendment — the text constants' provenance upgraded: the
 * wordmark 142 and the tab labels 120 are DERIVED, not bare pins (the
 * font-metrics probe's canvas advances under the elements' own computed
 * fonts, two bit-identical rides; A4e-5..7 close the receipt against
 * the pins). The audit's last open constant is closed.
 *
 * t838 amendment — the lens chip's 90 joins (A4e-8): the BOX derivation
 * (chrome 34 + icon 14 + the tabular count's advance + "noted"'s
 * advance) at the chip's own 2xl band — the pinned-width family is
 * COMPLETE: every width in the closed form is now source arithmetic,
 * source-parsed chrome, or a derived text constant.
 *
 * t839 amendment — the t510 residue fix's proof PRE-FLIGHTED (A4e-9..10):
 * the build day will land option (a) overflow-hidden on the PS wrapper,
 * and the ratchet's post-fix form is now measured on a throwaway clone
 * (the rehearsal probe), not guessed — the geometry held while the
 * paint clipped, the t836 pricing verified by experiment.
 *
 * The family's last seats (this window's feature): the star table and
 * the text preview dialogs join the keymap family — one quiet Esc line
 * each, the must-not-lie law's fourth application (they have exactly
 * one key, they teach exactly that key). Every results-view dialog now
 * speaks its keys in one voice.
 *
 * Sections:
 *   A  the sm-band slack audit (inventory from source, widths pinned,
 *      the closed form, the slack floors, the drift note)
 *   B  the star/text Esc seats (the family complete in results-view)
 *   C  regression guards (the t828-t831 laws untouched)
 *   D  the calibre (19 api entries)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
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
const src = (p) => readFileSync(join(ROOT, p), "utf8");

const header = src("src/components/workflow/header.tsx");
const rv = src("src/components/workflow/results/results-view.tsx");
const m = src("src/components/workflow/results/molstar-embed.tsx");
const panel = src("src/components/workflow/results/map-ortho-panel.tsx");

/* ---------- A — the sm-band slack audit ---------- */
console.log("A — the sm-band slack audit (the arithmetic from source, closed against the fresh measure)");

// A1 — the actions cluster block (everything between the cluster div and
// the session report dialog is a seat; the dialogs after it are not).
const clusterStart = header.indexOf('no-print flex shrink-0 items-center gap-1.5');
const clusterEnd = header.indexOf('<SessionReportDialog');
ok(clusterStart > 0 && clusterEnd > clusterStart, "A1a the actions cluster block located");
const cluster = header.slice(clusterStart, clusterEnd);

// The seat inventory, parsed from source. aria-label seats:
const ariaSeats = (cluster.match(/aria-label="/g) ?? []).length;
// component seats (no aria-label at this level): the palette trigger, the
// knock span, the remote door, the help popover, the theme toggle.
const componentSeats =
  (cluster.includes("<CommandPaletteTrigger />") ? 1 : 0) +
  (cluster.includes("<KnockSettingsButton />") ? 1 : 0) +
  (cluster.includes("<RemoteClusterButton />") ? 1 : 0) +
  (cluster.includes("<HelpPopover />") ? 1 : 0) +
  (cluster.includes("<ThemeToggle />") ? 1 : 0);
ok(ariaSeats === 6, `A1b the aria-label seat count is six (AI, storage, diagnostics, QC, print, github) — got ${ariaSeats}`);
ok(componentSeats === 5, `A1c the component seat count is five (palette, knock, remote, help, theme) — got ${componentSeats}`);
ok(ariaSeats + componentSeats + 1 === 12, `A1d the full inventory is 12 seats (11 + the RELION chip) — got ${ariaSeats + componentSeats + 1}`);

// A2 — the tier classes, byte-exact (the t828 law): each seat's own class
// decides its band. The census is COMPUTED from these classes.
const alwaysSeats = 6; // AI, palette, QC, remote, help, theme — no max-* class
const smSeats = (cluster.match(/max-sm:hidden/g) ?? []).length; // storage + the knock span
const mdSeats = (cluster.match(/max-md:hidden/g) ?? []).length; // diagnostics + print + github
const xlSeat = cluster.includes('hidden xl:block') ? 1 : 0; // the RELION chip
ok(smSeats === 2, `A2a two seats wait for sm (storage, knock) — got ${smSeats}`);
ok(mdSeats === 3, `A2b three seats wait for md (diagnostics, print, github) — got ${mdSeats}`);
ok(xlSeat === 1, `A2c one seat waits for xl (the RELION chip) — got ${xlSeat}`);
const census = { 375: alwaysSeats, 640: alwaysSeats + smSeats, 768: alwaysSeats + smSeats + mdSeats, 1280: alwaysSeats + smSeats + mdSeats + xlSeat };
ok(census[375] === 6 && census[640] === 8 && census[768] === 11 && census[1280] === 12,
  `A2d the per-band census computes to 6 / 8 / 11 / 12 (375 / 640 / 768 / 1280) — got ${census[375]} / ${census[640]} / ${census[768]} / ${census[1280]}`);

// A3 — the closed form. Widths pinned from the t832 six-band sweep on
// build uSAbDxXCmrPYnAJNZFlcE (provenance in the worklog): icon seat 36
// (shadcn size=icon w-9), the palette 40 (26 icon-only below sm), the
// RELION chip 162, gap-1.5 = 6. The formula must reproduce the measured
// right-cluster widths EXACTLY.
const W = { icon: 36, palette: 40, paletteSm: 26, relion: 162, gap: 6 };
const right = (n, paletteW, relionW = 0) => {
  const icons = n - 1 - (relionW > 0 ? 1 : 0); // the palette (and the chip, when aboard) are the non-icon seats
  return relionW + paletteW + icons * W.icon + (n - 1) * W.gap;
};
const measured = { 375: 236, 640: 334, 768: 460, 1280: 628 };
ok(right(census[375], W.paletteSm) === measured[375],
  `A3a the closed form reproduces 375's 236px — got ${right(census[375], W.paletteSm)}`);
ok(right(census[640], W.palette) === measured[640],
  `A3b the closed form reproduces 640's 334px — got ${right(census[640], W.palette)}`);
ok(right(census[768], W.palette) === measured[768],
  `A3c the closed form reproduces 768's 460px — got ${right(census[768], W.palette)}`);
ok(right(census[1280], W.palette, W.relion) === measured[1280],
  `A3d the closed form reproduces 1280's 628px (the chip aboard) — got ${right(census[1280], W.palette, W.relion)}`);

// A4 — the slack floors: band − left − closed-form right. The left
// cluster is NO LONGER pinned constants (the t834 amendment — carried
// twice, paid here): the fixed parts are DERIVED from source (the
// ViewSwitcher's box arithmetic, the brand icon's size-9, the gaps, the
// select triggers' w-[] tiers), the text-dependent parts are pinned
// variables with provenance (the wordmark's and lens chip's text), and
// the per-band width closes through the row's own squeeze law —
// left(band) = min(natural, band − chrome − right) — the law the source
// itself declares (min-w-0 + "the row itself compresses", t510). The
// 2px between 768's 264 and 1024's 266 is the LAW, not noise: at 768
// the natural 266 does not fit the 264 available and the wordmark
// yields 2px. The floor at 640 pins TODAY'S 192 (the tail's stale "16"
// noted in the header — the drift is part of the record).
const left = { 375: 68, 640: 114, 768: 264, 1024: 266, 1280: 608, 1536: 864 };
const bands = [
  { band: 375, rightW: measured[375], floor: 71 },
  { band: 640, rightW: measured[640], floor: 192 },
  { band: 768, rightW: measured[768], floor: 44 },
  { band: 1024, rightW: measured[768], floor: 298 },
  { band: 1280, rightW: measured[1280], floor: 44 },
  { band: 1536, rightW: measured[1280], floor: 44 },
];
let slackOk = true;
const slackReport = bands.map(({ band, rightW, floor }) => {
  const slack = band - left[band] - rightW;
  if (slack !== floor) slackOk = false;
  return `${band}:${slack}`;
});
ok(slackOk, `A4a the slack closes at the pinned floor in all six bands (${slackReport.join(" ")})`);
ok(Math.min(...bands.map(b => b.floor)) >= 44, "A4b the minimum slack floor is 44px (three bands tie at it — the tier law's honest margin)");

// A4c — the ViewSwitcher's box arithmetic, DERIVED from its own source
// (the family's doctrine: inventory from source, widths from the ruler,
// the formula agrees with both ends). The tablist container carries the
// border, p-0.5 and gap-0.5; each tab carries px-2 and the size-3.5
// icon; below xl the labels are hidden so the in-tab gap-1.5 sleeps.
//   VS = 2×border(1) + 2×p(2) + gap(2) + 2×(2×px(8) + icon(14)) = 68
const vsBlock = header.slice(header.indexOf("function ViewSwitcher"), header.indexOf("Note spotlight chip (Task 75)"));
const vsP = vsBlock.includes("p-0.5") ? 2 : 0;
const vsGap = vsBlock.includes("gap-0.5") ? 2 : 0;
const vsPx = vsBlock.includes("px-2") ? 8 : 0;
const vsIcon = vsBlock.includes("size-3.5") ? 14 : 0;
const vsBorder = /rounded-lg border/.test(vsBlock) ? 1 : 0;
const vsClosed = 2 * vsBorder + 2 * vsP + vsGap + 2 * (2 * vsPx + vsIcon);
ok(vsP === 2 && vsGap === 2 && vsPx === 8 && vsIcon === 14 && vsBorder === 1,
  "A4c-1 the ViewSwitcher's box classes parse from source (border, p-0.5, gap-0.5, px-2, size-3.5)");
ok(vsClosed === 68, `A4c-2 the ViewSwitcher below xl derives to 68px from source — got ${vsClosed}`);

// A4d — the left cluster's seats and tiers, parsed from source: the
// brand icon (size-9 = 36, max-sm:hidden), the wordmark (max-md:hidden),
// the ViewSwitcher, the middle tier (hidden xl:flex) with the workspace
// (w-[128px] sm:w-[160px]) and project (w-[150px] xl:w-[170px]
// 2xl:w-[220px]) triggers, and the lens chip (hidden ... 2xl:flex).
// The cluster div hosts the first three as DOM children; the selects and
// the chip ride as COMPONENT anchors whose definitions live elsewhere in
// this file — a future seat added to the cluster moves A4e's arithmetic.
const leftCluster = header.slice(
  header.indexOf('<div className="flex min-w-0 items-center gap-2.5">'),
  header.indexOf("no-print flex shrink-0")
);
ok(/size-9 shrink-0[^"]*max-sm:hidden/.test(leftCluster), "A4d-1 the brand icon seat parses (size-9, max-sm:hidden)");
ok(/min-w-0 leading-tight max-md:hidden/.test(leftCluster), "A4d-2 the wordmark seat parses (max-md:hidden)");
ok(/hidden min-w-0 items-center gap-2 xl:flex/.test(leftCluster), "A4d-3 the middle tier parses (hidden xl:flex)");
// The triggers' width tiers live in the components' own definitions
// (WorkspaceSelect / ProjectSwitcher, earlier in this file) — the seats
// ARE the components, so the components' source is the seat's source.
ok(/w-\[128px\] min-w-0[^"]*sm:w-\[160px\]/.test(header), "A4d-4 the workspace trigger's width tiers parse (128 / 160 from sm)");
ok(/w-\[150px\] min-w-\[130px\][^"]*xl:w-\[170px\] 2xl:w-\[220px\]/.test(header), "A4d-5 the project trigger's width tiers parse (150 / 170 at xl / 220 at 2xl)");
ok(/hidden h-8 items-center gap-1\.5 rounded-lg border px-2\.5[^"]*2xl:flex/.test(header), "A4d-6 the lens chip waits for 2xl (the t510 yield-first law)");

// A4e — the closed form. Fixed parts from source (A4c/A4d): icon 36,
// the cluster's gap-2.5 = 10, the middle tier's gap-2 = 8, the triggers'
// width tiers. Text-dependent parts: the wordmark 142 and the tab
// labels 120 are DERIVED constants (the t837 font-metrics probe,
// scripts/t837-wordmark-probe.mjs — canvas advances under the elements'
// own computed fonts, two bit-identical rides, receipt
// shots-qa/t837-wordmark-probe.json on build KtPKuXIbtB9d7uhItOOUS:
// the wordmark = max of its two lines' advances, line 2 "Cryo-EM
// Workflow Builder" at 11px carries it, 142.46 live vs rect 142.47;
// the labels sum 120.2). The lens chip 90 joins them (the t838 box
// derivation, the probe's section C at 1536: chrome 34 — border 2 +
// px-2.5 20 + gap-1.5 6×2 — + icon 14 + the tabular count's advance
// (its own live rect, variant-honest) + "noted"'s canvas advance;
// the fresh-load count is recorded so a future count explains its own
// drift). The pinned-width family is COMPLETE.
const L = {
  icon: 36, gap: 10, midGap: 8,
  wm: 142, labels: 120, chip: 90,
  ws: 160, ps: { base: 150, xl: 170, xxl: 220 },
};
const vsXl = vsClosed + 12 + L.labels; // the two gap-1.5 wake with the labels
const natural = (band) => {
  if (band < 640) return vsClosed; // the ViewSwitcher alone (the t828 tier law)
  if (band < 768) return L.icon + L.gap + vsClosed;
  if (band < 1280) return L.icon + L.gap + L.wm + L.gap + vsClosed;
  if (band < 1536) return L.icon + L.gap + L.wm + L.gap + vsXl + L.gap + L.ws + L.midGap + L.ps.xl;
  return L.icon + L.gap + L.wm + L.gap + vsXl + L.gap + L.ws + L.midGap + L.ps.xxl + L.midGap + L.chip;
};
const chrome = (band) => (band < 640 ? 24 : 32) + 12; // px-3 / sm:px-4, + the justify-between gap-3
const rightClosed = (band) =>
  band < 640 ? right(census[375], W.paletteSm)
  : band < 768 ? right(census[640], W.palette)
  : band < 1280 ? right(census[768], W.palette)
  : right(census[1280], W.palette, W.relion);
const leftClosed = (band) => Math.min(natural(band), band - chrome(band) - rightClosed(band));
const leftReport = bands.map(({ band }) => `${band}:${leftClosed(band)}`);
ok(
  bands.every(({ band }) => leftClosed(band) === left[band]),
  `A4e-1 the closed form reproduces the left cluster in all six bands (${leftReport.join(" ")})`
);
ok(
  natural(768) > 768 - chrome(768) - measured[768],
  "A4e-2 the 768 band SQUEEZES (natural 266 > available 264) — the 2px the law explains, the old pin could not"
);
ok(
  natural(1024) < 1024 - chrome(1024) - measured[768],
  "A4e-3 the 1024 band sits at its natural width (no squeeze) — the wordmark's honest 142"
);
ok(vsXl === 200, `A4e-4 the ViewSwitcher at its label floor derives to 200px (68 + the labels' 120 + the two gap-1.5) — got ${vsXl}`);

// A4e-5..7 — the text constants' provenance, upgraded from bare pins to
// derived constants (the t837 font-metrics probe): the receipt must be
// aboard with two bit-identical rides, and both numbers this audit
// uses must close against the pins. Division of honesty: the probe
// closes the derivation against the WORLD (the live rect); this unit
// closes the receipt against the PIN.
const wmReceiptPath = join(ROOT, "shots-qa/t837-wordmark-probe.json");
const wmReceipt = existsSync(wmReceiptPath)
  ? JSON.parse(readFileSync(wmReceiptPath, "utf8"))
  : null;
ok(
  wmReceipt && wmReceipt.bitIdentical === true && Array.isArray(wmReceipt.runs) && wmReceipt.runs.length === 2,
  "A4e-5 the t837 wordmark receipt is aboard (two bit-identical rides, BUILD_ID provenance)"
);
if (wmReceipt && Array.isArray(wmReceipt.runs) && wmReceipt.runs[0]) {
  const r0 = wmReceipt.runs[0];
  ok(
    Math.abs(Math.round(r0.derived) - L.wm) <= 0.5 && Math.abs(r0.derived - r0.rect) <= 0.5,
    `A4e-6 the wordmark's ${L.wm} is DERIVED (probe: max-of-lines ${r0.derived} vs rect ${r0.rect}, winner "${r0.lines[1].text}")`
  );
  ok(
    Math.abs(r0.labelsSum - L.labels) <= 0.5,
    `A4e-7 the labels' ${L.labels} is DERIVED (probe sum: ${r0.labelsSum})`
  );
  const c0 = wmReceipt.chip && Array.isArray(wmReceipt.chip.runs) ? wmReceipt.chip.runs[0] : null;
  ok(
    !!c0 && wmReceipt.chip.bitIdentical === true && Math.abs(Math.round(c0.derived) - L.chip) <= 0.5 && Math.abs(c0.derived - c0.rect) <= 0.5,
    `A4e-8 the lens chip's ${L.chip} is DERIVED (probe section C: box ${c0 ? c0.derived : "n/a"} vs rect ${c0 ? c0.rect : "n/a"} — chrome ${c0 ? c0.chrome : "n/a"} + icon ${c0 ? c0.iconW : "n/a"} + count "${c0 ? c0.count : "n/a"}" ${c0 ? c0.numRect : "n/a"} + noted ${c0 ? c0.notedCanvas : "n/a"} — the family complete)`
  );
}

// A4e-9..10 — the t510 residue fix's proof, PRE-FLIGHTED (the t839
// rehearsal probe): the build day lands option (a) overflow-hidden on
// the PS wrapper; the ratchet's post-fix form is measured on a
// throwaway clone, not guessed. Division of honesty, again: the probe
// closes the fix's behavior against the WORLD (the live band + the
// clone); this unit closes the receipt against the PRICING (paint
// moves, geometry does not).
const reReceiptPath = join(ROOT, "shots-qa/t839-zone-rehearsal.json");
const reReceipt = existsSync(reReceiptPath)
  ? JSON.parse(readFileSync(reReceiptPath, "utf8"))
  : null;
ok(
  reReceipt &&
    Array.isArray(reReceipt.before) && reReceipt.before.length === 2 &&
    Array.isArray(reReceipt.after) && reReceipt.after.length === 2 &&
    reReceipt.swap && reReceipt.swap.swapped === true &&
    reReceipt.before[0].wrapOverflowX === "visible" &&
    reReceipt.after[0].wrapOverflowX === "hidden" &&
    reReceipt.restored && reReceipt.restored.wrapOverflowX === "visible",
  "A4e-9 the t839 rehearsal receipt is aboard (before/after pairs, the swap, the restore — the fix on the clone, the world unharmed)"
);
if (
  reReceipt && Array.isArray(reReceipt.before) && reReceipt.before[0] &&
  Array.isArray(reReceipt.after) && reReceipt.after[0]
) {
  const bb = reReceipt.before[0];
  const aa = reReceipt.after[0];
  const stackHas = (row, who) =>
    Array.isArray(row.stack) && row.stack.some((s) => String(s).startsWith(who));
  ok(
    bb.overlap === 2.7 && aa.overlap === 2.7 && bb.trigW === aa.trigW && bb.wrapW === aa.wrapW &&
      stackHas(bb, "TRIGGER") && !stackHas(aa, "TRIGGER") && stackHas(aa, "CHIP"),
    `A4e-10 the pricing VERIFIED by experiment: geometry held (${bb.overlap} → ${aa.overlap}, ${bb.trigW}/${bb.wrapW} → ${aa.trigW}/${aa.wrapW}) while the paint clipped (TRIGGER ${stackHas(bb, "TRIGGER") ? "in" : "absent"} → ${stackHas(aa, "TRIGGER") ? "in" : "absent"}, the chip keeps the click) — the build day's ratchet is measured, not guessed`
  );
}

// A4e-11 — the build day's DECISION TABLE, measured (the t840 options
// rehearsal): every option's AFTER pre-filmed on throwaway clones —
// (a) the clip (the t839 continuity row), (b) refuted as written (the
// wordmark is already squeezed to 101.3; a cap must bind below it) but
// clearing at 88, (c) REFUTED (the tier law eats the freed demand, the
// paint worsens to 11.4). The audit's arithmetic pricing is now an
// experiment; the build day lands (a) with the whole table aboard.
const optPath = join(ROOT, "shots-qa/t840-options-rehearsal.json");
const optReceipt = existsSync(optPath)
  ? JSON.parse(readFileSync(optPath, "utf8"))
  : null;
if (optReceipt && optReceipt.before && optReceipt.before[0]) {
  const oa = optReceipt.optionA && optReceipt.optionA.rides ? optReceipt.optionA.rides[0] : null;
  const oc = optReceipt.optionC && optReceipt.optionC.rides ? optReceipt.optionC.rides[0] : null;
  const ob88 = optReceipt.optionB88 && optReceipt.optionB88.rides1280 ? optReceipt.optionB88.rides1280[0] : null;
  const stackHas = (row, who) =>
    row && Array.isArray(row.stack) && row.stack.some((s) => String(s).startsWith(who));
  ok(
    optReceipt.before[0].overlap === 2.7 &&
      oa && oa.overlap === 2.7 && oa.wrapOverflowX === "hidden" && !stackHas(oa, "TRIGGER") &&
      ob88 && ob88.overlap === -4.8 &&
      oc && oc.overlap === 11.4 && oc.wrapW === 106.6 &&
      optReceipt.restored && optReceipt.restored.overlap === 2.7,
    `A4e-11 the t840 decision table is aboard and closes: (a) clips with the geometry intact (${oa ? oa.overlap : "n/a"}, stack clean), (b@88) clears (${ob88 ? ob88.overlap : "n/a"}), (c) backfires (${oc ? oc.overlap : "n/a"}, wrapper ${oc ? oc.wrapW : "n/a"}), the world restored (${optReceipt.restored.overlap}) — the build day lands (a), the whole table filmed`
  );
}

// A4e-12 — the t842 FAMILY AUDIT: one arithmetic, three instruments.
// The t839 proof, the t840 decision table, and the sweep's live rows must
// tell the same story about the same 2.7px: the BEFORE quartet agrees, the
// AFTER pair agrees (the ratchet — delta(geometry)=0, flip(stack)=1 — filmed
// twice), the clone's edges equal the live edges, the law rides, and all
// three receipts speak the standing build. The fix window flips all three
// with one grind; this receipt is the pre-flip family portrait.
const famPath = join(ROOT, "shots-qa/t842-family-audit.json");
const famReceipt = existsSync(famPath)
  ? JSON.parse(readFileSync(famPath, "utf8"))
  : null;
if (famReceipt && famReceipt.checks) {
  ok(
    famReceipt.failed === 0 && famReceipt.passed === famReceipt.total && famReceipt.total >= 24 &&
      famReceipt.arithmetic && famReceipt.arithmetic.geometry === "130/115.3/2.7" &&
      famReceipt.arithmetic.ratchet && famReceipt.arithmetic.ratchet.dGeom === 0 &&
      famReceipt.arithmetic.ratchet.dStack === 1 &&
      Array.isArray(famReceipt.arithmetic.ratchet.filmedBy) &&
      famReceipt.arithmetic.ratchet.filmedBy.length === 2 &&
      famReceipt.sources && famReceipt.sources.t839 && famReceipt.sources.t840 && famReceipt.sources.sweep &&
      famReceipt.build === "KtPKuXIbtB9d7uhItOOUS",
    `A4e-12 the t842 family audit is aboard and green (${famReceipt.passed}/${famReceipt.total}): the t839 proof, the t840 table, and the sweep's live rows agree on one arithmetic — the ratchet (dGeom=${famReceipt.arithmetic ? famReceipt.arithmetic.ratchet.dGeom : "?"}, dStack=${famReceipt.arithmetic ? famReceipt.arithmetic.ratchet.dStack : "?"}) filmed twice, all three receipts on build ${famReceipt.build} — the fix window's flip is a per-width delta across the whole family`
  );
}

// A5 — the tier law's bytes: the seats that yield are yielded by CLASS,
// not by squeezing (the t828 contract), and the cluster never shrinks.
ok(/<div className="no-print flex shrink-0 items-center gap-1\.5">/.test(header),
  "A5a the cluster keeps its shrink-0 contract (the seats never squeeze — the left row absorbs)");
ok(/max-sm:hidden">\s*\n\s*<KnockSettingsButton \/>/.test(header),
  "A5b the knock seat still falls below sm (the t828 tier law's knock form byte-exact)");
ok(/className="hidden xl:block">/.test(header),
  "A5c the RELION chip still waits for xl");

/* ---------- B — the star/text Esc seats ---------- */
console.log("B — the keymap family's last seats (star + text join)");
ok(rv.includes('data-canvas-ui="star-keymap"'), "B1 the star table's keymap row exists (star-keymap)");
ok(rv.includes('data-canvas-ui="text-keymap"'), "B2 the text preview's keymap row exists (text-keymap)");
ok(
  (rv.match(/<Kbd>Esc<\/Kbd>/g) ?? []).length === 3,
  `B3 three Esc seats in results-view (quick, star, text) — got ${(rv.match(/<Kbd>Esc<\/Kbd>/g) ?? []).length}`
);
ok(
  /data-canvas-ui="star-keymap"\s*\n\s*className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-\[10px\] leading-tight text-muted-foreground"/.test(rv),
  "B4 the seats ride the family calibre (10px muted footer, one voice)"
);
ok(
  rv.includes("<Kbd>←</Kbd>") && rv.includes("step the slice"),
  "B5 the quick-look's slice family intact beside its Esc (the t831 seat untouched)"
);

/* ---------- C — regression guards ---------- */
console.log("C — regression guards (the earlier laws untouched)");
ok(m.includes('data-canvas-ui="door-keymap"') && m.includes("While the viewer is open:"),
  "C1 the t830 door chips + scope lead-in intact");
ok(
  /const topSurface = openTopSurface\(\);/.test(m) &&
    /if \(topSurface && !\(containerRef\.current && topSurface\.contains\(containerRef\.current\)\)\) return;/.test(m),
  "C2 the t831 z-order guard intact (the world behind a foreign modal stays silent)"
);
ok(panel.includes("step the cut — the line follows") && panel.includes("<Kbd>F</Kbd>"),
  "C3 the t831 ortho σ family intact (ten chips, the echo wire's words)");
ok(/\{open && isoSigma && \(/.test(panel),
  "C4 the ortho row's honesty gate unchanged");
ok(/e\.key === "ArrowLeft" && stackSlice > 0/.test(rv),
  "C5 the t831 stack arrow verbs intact");
ok(/title="Contour σ — \[ \/ \] step the level from the keyboard, F flips the density side"/.test(m),
  "C6 the t829 σ slider title still names its keys");
ok(
  (rv.match(/data-canvas-ui="(quick|star|text)-keymap"/g) ?? []).length === 3,
  "C7 the results-view family is exactly three rows (no drift, no duplicates)"
);

/* ---------- D — the calibre ---------- */
console.log("D — the calibre (census rotation)");
const apiDir = join(ROOT, "src/app/api");
const dirs = readdirSync(apiDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
const entries = dirs + (existsSync(join(apiDir, "route.ts")) ? 1 : 0);
ok(entries === 19, `D1 api entries = 19 (18 dirs + root route.ts) — got ${entries}`);

console.log(`\nFLEET-UNIT t832: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

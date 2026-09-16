#!/usr/bin/env node
/**
 * t223-e2e — the roster earns its first picture (ON THE WIRE).
 *
 * The Agreement r column compresses every owner's landscape into one
 * number; t223 lets the reader SEE the shape it was compressed from:
 * the wire's eighth column ("Shape") draws each owner's main landscape
 * (solid) over the winner's (dotted) in one inline SVG. The pictures
 * live ONLY on the wire — the markdown stays the seven-column facts,
 * the CSV stays numbers-only (a picture travels in neither grammar).
 * The probe builds the TIED world (t219's recipe: twin = byte-identical
 * copy of the divergent outlier) because coincidence is the picture's
 * hardest test — two rows that must draw the SAME line:
 *   S  setup — the divergent world + seed-twin.py (byte-identical twin)
 *   V  view — the wire speaks eight columns; three spark cells; the
 *      reference row's self-portrait coincides; the tied rows draw the
 *      same line (one landscape, twice drawn); the divergent shape
 *      separates from the winner's; the paper's bytes stay picture-free.
 *   H  hover — t224's magnifier: the glass is born with every picture
 *      and folds until the eye asks; hovering a cell opens exactly one
 *      glass whose owner/winner d bytes are IDENTICAL to the inline
 *      picture's (the same painting twice, never a re-derivation);
 *      three times the glass, the same coordinates; the tied rows'
 *      glasses magnify the same landscape; the eye leaves, the glass
 *      folds; and the glass never eats the click — the door opens
 *      through it (pointer-events:none, proven on the wire).
 *   K  keyboard — Tab reaches a door row and its glass opens
 *      (focus-visible is the keyboard's lens); the glass follows the
 *      keyboard one row at a time.
 *   T  teardown — DELETE the twin; the roster forgets, the disk remembers.
 *   Z  the untied world — the unique outlier's portrait still separates
 *      from the winner's (a picture is a lens, and the lens survives
 *      the tie's end); the magnifier exists there too; console clean
 *      across both visits.
 *   (t225-t233 grew M/C/D/E/F/G/P and the Z2* family: the addresses,
 *    the quarters, the hero's signatures and depth labels, the print
 *    tier, the CSV's second mouth.)
 *   W  the compass (t234) — the md's second surface: chips parsed from
 *      the SAME bytes the body renders (two surfaces, one father at the
 *      document layer), paired digit for digit by index; the jump lands
 *      BELOW the map (scroll-margin pays the strip's rent); the needle
 *      follows the reader; the TAIL LAW (the last section can never
 *      reach the line — at the bottom the reader IS there); P9 the map
 *      never prints; Z2l the untied world carries its own map.
 * Run: node scripts/t223-e2e.mjs   (server on :3000)
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const H = { "sec-fetch-site": "same-origin" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const jobs = async () =>
  (await (await fetch(BASE + "/api/jobs", { headers: H })).json()).jobs ?? [];

// t226: the inventory table's scope — the report now carries FOUR tables
// (inventory, comparison maps, local agreement, pairwise) and TWO of them
// draw pictures. The inventory's own counts must be scoped to the table
// that owns the doors, or the comparisons' portraits would be counted in
// them (a scope is a promise about WHAT is being counted).
const INV = '[data-report-body] table:has(tr[data-owner-door])';


/* ============ S: setup — the tied world (t219's recipe) ============ */
section("S: the divergent world, then its TWIN");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/qa67-seed-volume.py", { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
execSync("python3 scripts/seed-masked.py", { stdio: "pipe" });
execSync("python3 scripts/seed-outlier.py", { stdio: "pipe" });
const twinReceipt = execSync("python3 scripts/seed-twin.py", { encoding: "utf8" });
must(twinReceipt.includes("TWIN_READY"), "S1 the twin seeder ran and said TWIN_READY");
const twinId = (twinReceipt.match(/TWIN_READY id=(\S+)/) || [])[1];
must(!!twinId, "S2 the twin's id is on the receipt");

/* ============ V: the wire speaks the picture ============ */
section("V: the shape portrait, on the wire");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);

await page.locator('button[aria-label="Session QC report"]').click();
await sleep(1800);
for (let i = 0; i < 24 && (await page.locator("[data-report-body] tr[data-owner-door]").count()) !== 3; i++) await sleep(500);
// the sparks arrive with the merge (bins are the fourth surface) — wait
// for all three cells to stop being honest dashes and start drawing
for (let i = 0; i < 24 && (await page.locator(INV + ' td[data-shape-cell="spark"]').count()) !== 3; i++) await sleep(500);

const headCells = await page.locator("[data-report-body] table:has(tr[data-owner-door]) thead th").allTextContents();
must(JSON.stringify(headCells) === JSON.stringify(["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest", "Shape"]),
  `V1 the wire's head is the septet + Shape (${JSON.stringify(headCells)})`);
must((await page.locator(INV + ' td[data-shape-cell="spark"]').count()) === 3,
  "V2 all three owner rows carry a spark cell");
must((await page.locator(INV + " svg.report-spark").count()) === 3,
  "V3 each spark cell draws one inline SVG");
must((await page.locator(INV + " svg.report-spark > path.report-spark-winner").count()) === 3,
  "V4 every portrait lays the winner's dotted reference beneath the owner's line (the inline picture's own paths)");

const rows = page.locator("[data-report-body] tr[data-owner-door]");
const ownerPath = (row) => row.locator("svg.report-spark > path.report-spark-owner").getAttribute("d");
const winnerPath = (row) => row.locator("svg.report-spark > path.report-spark-winner").getAttribute("d");
const p0 = await ownerPath(rows.nth(0));
const p1 = await ownerPath(rows.nth(1));
const p2 = await ownerPath(rows.nth(2));
const w0 = await winnerPath(rows.nth(0));
must(!!p0 && !!p1 && !!p2 && !!w0, "V5 all four paths exist on the wire");
// the reference row's self-portrait: the winner against itself draws the
// same line twice — the picture's way of saying r = 1.00
must(p0 === w0, "V6 the reference row's self-portrait coincides (the picture of 1.00)");
// the tied rows: one landscape, twice drawn — the picture must agree with
// the D5b/D5c doctrine the numbers already speak
must(p1 === p2, "V7 the tied rows draw the SAME line — one landscape, twice drawn (D5's picture sibling)");
// the divergent shape separates: the relocated peak is visible, the same
// fact the negative r speaks — the picture and the number never disagree
must(p1 !== w0, "V8 the divergent portrait separates from the winner's line (the picture of a relocated peak)");

// the picture lives ONLY on the wire — the paper's bytes stay the
// seven-column facts, and the CSV stays numbers-only
const md = await page.locator("[data-report-doc]").getAttribute("data-md");
must(!!md && !md.includes("| Shape") && !md.includes("Shape |"),
  "V9 the markdown bytes stay picture-free (seven columns, no Shape)");
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 10000 }),
  page.locator('button[aria-label="Download map inventory CSV"]').click(),
]);
const csv = readFileSync(await download.path(), "utf8").trim().split("\n");
must(csv.length === 4 && csv[0] === "job,main_map,volumes,peak_pct,delta_winner,shape_r,thinnest",
  `V10 the CSV stays the machine grid (${csv.length - 1} rows, no picture column)`);

// the portrait earns its own frame — the first picture on the roster,
// together with the numbers it must never disagree with
await page.locator("[data-report-body] table:has(tr[data-owner-door])").first().scrollIntoViewIfNeeded();
await sleep(300);
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t223/t223-sparks-tie-2x.png", scale: "css" });

/* ============ H: the magnifier — the same picture, twice drawn ============ */
section("H: the hover magnifier (t224)");
const zoomSvg = (row) => row.locator("svg.report-spark-zoom");
const zoomOwner = (row) => row.locator("svg.report-spark-zoom > path.report-spark-owner");
const zoomWinner = (row) => row.locator("svg.report-spark-zoom > path.report-spark-winner");
const visibleZooms = () => page.locator("[data-report-body] svg.report-spark-zoom:visible").count();
must((await page.locator(INV + " svg.report-spark-zoom").count()) === 3,
  "H1 the magnifier is born with the picture — one glass per spark cell");
must((await visibleZooms()) === 0,
  "H2 before any eye arrives, every glass is folded (0 visible)");
const cell1 = rows.nth(1).locator('td[data-shape-cell="spark"]');
await cell1.hover();
await sleep(250);
must((await visibleZooms()) === 1, "H3 hovering one cell opens exactly one glass");
must((await zoomOwner(rows.nth(1)).getAttribute("d")) === p1,
  "H4 the glass magnifies THE picture — zoom owner d is byte-identical to the inline d (no second father)");
must((await zoomWinner(rows.nth(1)).getAttribute("d")) === w0,
  "H5 the glass's winner baseline is byte-identical too (the same dotted reference)");
must((await zoomSvg(rows.nth(1)).getAttribute("viewBox")) === "0 0 96 26" &&
     (await zoomSvg(rows.nth(1)).getAttribute("width")) === "288" &&
     (await zoomSvg(rows.nth(1)).getAttribute("height")) === "78",
  "H6 three times the glass, the SAME coordinates (viewBox 0 0 96 26 at 288x78)");
must((await zoomSvg(rows.nth(1)).getAttribute("aria-hidden")) === "true",
  "H7 the glass is silent in the ear — the row's own label already speaks the verdict");
// the magnifier earns its own frame — a hover state is invisible in the
// static top frame (t219's footnote-frame lesson)
await page.locator("[data-report-body] table:has(tr[data-owner-door])").first().scrollIntoViewIfNeeded();
await sleep(300);
await cell1.hover();
await sleep(250);
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t223/t223-spark-zoom-2x.png", scale: "css" });
// the tie sibling: the other tied row's glass magnifies the SAME landscape
const cell2 = rows.nth(2).locator('td[data-shape-cell="spark"]');
await cell2.hover();
await sleep(250);
must((await zoomOwner(rows.nth(2)).getAttribute("d")) === p1,
  "H8 the tied row's glass magnifies the same landscape (V7's zoom sibling)");
must((await visibleZooms()) === 1,
  "H9 one glass at a time — the previous glass folded when the eye moved");
await page.mouse.move(720, 80);
await sleep(250);
must((await visibleZooms()) === 0, "H10 the eye leaves, the glass folds");
// the glass never eats the click — the door opens through it
await cell1.hover();
await sleep(150);
await cell1.click();
await sleep(900);
must((await page.locator("[data-report-doc]").count()) === 0,
  "H11 the click passes through the glass — the owner's door opens (the report closed)");

/* ============ K: the keyboard gets the same glass ============ */
section("K: the keyboard parity");
// H11's click-through landed on the door — the job inspector is open
// now. The world resets the honest way (a fresh load, Z's own recipe):
// no dependence on anyone's Esc semantics.
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
await page.locator('button[aria-label="Session QC report"]').click();
await sleep(1800);
for (let i = 0; i < 24 && (await page.locator("[data-report-body] tr[data-owner-door]").count()) !== 3; i++) await sleep(500);
const rowInfo = () => page.evaluate(() => {
  const el = document.activeElement;
  const tr = el && el.closest ? el.closest("[data-report-body] tr[data-owner-door]") : null;
  if (!tr) return null;
  const rs = Array.from(document.querySelectorAll("[data-report-body] tr[data-owner-door]"));
  const zoom = tr.querySelector("svg.report-spark-zoom");
  return { idx: rs.indexOf(tr), zoomShown: !!zoom && getComputedStyle(zoom).display !== "none" };
});
let kb = null;
for (let i = 0; i < 40 && !kb; i++) { await page.keyboard.press("Tab"); await sleep(60); kb = await rowInfo(); }
must(!!kb, "K1 keyboard Tab reaches an owner door row");
must(!!kb && kb.zoomShown, `K2 the keyboard's focus opens its own glass (row ${kb ? kb.idx : "?"}) — focus-visible is the keyboard's lens`);
await page.keyboard.press("Tab");
await sleep(150);
const kb2 = await rowInfo();
must(!!kb2 && kb2.idx === (kb ? kb.idx : -9) + 1, `K3 Tab walks the roster (${kb && kb2 ? `row ${kb.idx} -> ${kb2.idx}` : "?"})`);
must(!!kb2 && kb2.zoomShown, "K4 the next row's glass opens as the keyboard arrives");
const prevFolded = await page.evaluate((idx) => {
  const rs = Array.from(document.querySelectorAll("[data-report-body] tr[data-owner-door]"));
  const zoom = rs[idx] && rs[idx].querySelector("svg.report-spark-zoom");
  return !!zoom && getComputedStyle(zoom).display === "none";
}, kb ? kb.idx : 0);
must(prevFolded, "K5 one glass follows the keyboard — the previous row's glass folded");

/* ============ M: the address marks — the Peak number drawn INTO the picture ============ */
section("M: the portrait earns its address");
// the world resets the honest way — a fresh load, no dependence on
// anyone's focus semantics (t224's recipe for crossing phases)
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(2500);
await page.locator('button[aria-label="Session QC report"]').click();
await sleep(1800);
for (let i = 0; i < 24 && (await page.locator("[data-report-body] tr[data-owner-door]").count()) !== 3; i++) await sleep(500);
for (let i = 0; i < 24 && (await page.locator(INV + ' td[data-shape-cell="spark"]').count()) !== 3; i++) await sleep(500);
const mRows = page.locator("[data-report-body] tr[data-owner-door]");
must((await page.locator(INV + " svg.report-spark > line.report-spark-mark-owner").count()) === 3,
  "M1 every portrait carries its owner's address mark");
must((await page.locator(INV + " svg.report-spark > line.report-spark-mark-winner").count()) === 3,
  "M2 every portrait carries the winner's address mark (the reference's own hairline)");
// the address lives in the numbers: the mark's x IS the paper's Peak
// pct — the same 1-decimal number the row's aria speaks — scaled onto
// the picture's fraction axis; never re-derived from the drawn path
const markXOf = (row, cls) => row.locator(`svg.report-spark > line.${cls}`).first().getAttribute("x1");
const peakPctOfAria = async (row) => {
  const label = await row.getAttribute("aria-label");
  const m = label && label.match(/peak ([0-9.]+)%/);
  return m ? parseFloat(m[1]) : null;
};
for (let i = 0; i < 3; i++) {
  const r = mRows.nth(i);
  const pct = await peakPctOfAria(r);
  const x = parseFloat(await markXOf(r, "report-spark-mark-owner"));
  must(pct != null && Number.isFinite(x) && Math.abs(x - (pct / 100) * 96) <= 1e-6,
    `M3 row ${i}'s mark sits at the paper's Peak address (aria ${pct}% -> x ${x})`);
}
// the glass magnifies THE mark too — attr identity across the two mounts
for (let i = 0; i < 3; i++) {
  const r = mRows.nth(i);
  const xi = await markXOf(r, "report-spark-mark-owner");
  const xz = await r.locator("svg.report-spark-zoom > line.report-spark-mark-owner").first().getAttribute("x1");
  must(xi != null && xi === xz, `M4 row ${i}: the glass's mark is THE mark (x1 ${xi} === zoom ${xz})`);
}
// tie-world geometry: the reference's two marks coincide (the address
// of 1.00); the tied rows' marks coincide with each other (one
// landscape, twice addressed) and separate from the winner's (the |Δ|
// as two hairlines)
const xRefO = await markXOf(mRows.nth(0), "report-spark-mark-owner");
const xRefW = await markXOf(mRows.nth(0), "report-spark-mark-winner");
must(xRefO != null && xRefO === xRefW,
  `M5 the reference's two marks coincide — the address of 1.00 (${xRefO})`);
const x1o = await markXOf(mRows.nth(1), "report-spark-mark-owner");
const x2o = await markXOf(mRows.nth(2), "report-spark-mark-owner");
must(x1o != null && x1o === x2o,
  `M6 the tied rows' marks coincide — one landscape, twice addressed (${x1o})`);
must(x1o != null && xRefW != null && Math.abs(parseFloat(x1o) - parseFloat(xRefW)) > 1e-6,
  `M7 the tied mark separates from the winner's — the |Δ| as two hairlines (${x1o} vs ${xRefW})`);
// the marks speak no words — the picture cell stays silent (t215 D7's
// guard, re-verified live with the marks in the box)
const mCellText = await mRows.nth(1).locator('td[data-shape-cell="spark"]').textContent();
must(mCellText === "", "M8 the marks add no words — the picture cell stays silent");
// the magnifier's mark earns its own frame — the two hairlines at 3x,
// the relocation visible without reading a single number
const mCell1 = mRows.nth(1).locator('td[data-shape-cell="spark"]');
await page.locator("[data-report-body] table:has(tr[data-owner-door])").first().scrollIntoViewIfNeeded();
await sleep(300);
await mCell1.hover();
await sleep(250);
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t223/t223-spark-mark-2x.png", scale: "css" });


/* ============ C: the comparisons earn their picture ============ */
section("C: the winner's own family draws the same portrait");
// the comparisons table is found by its own head word — "Bins" lives in
// no other table's head on this paper
const cmpTable = page.locator('[data-report-body] table:has(th:text-is("Bins"))');
const cmpRows = cmpTable.locator("tbody tr");
for (let i = 0; i < 24 && (await cmpTable.locator('td[data-shape-cell="spark"]').count()) !== 2; i++) await sleep(500);
must((await cmpRows.count()) === 2, `C1 the comparisons table speaks its two overlays (${await cmpRows.count()})`);
must((await cmpTable.locator("thead th").count()) === 6,
  "C2 the comparisons head grew the picture column on the wire (5 paper + Shape)");
must((await cmpTable.locator("svg.report-spark").count()) === 2,
  "C3 both comparison rows draw their inline portrait");
// the marks sit at the paper's own addresses: the row's Peak-at cell says
// the pct, the mark's x is that pct on the picture's fraction axis; and
// the mark separation IS the paper's peak difference (main pct read from
// the inventory's reference-row aria — the same winner, one well)
const mainPctC = await peakPctOfAria(mRows.nth(0));
for (let i = 0; i < 2; i++) {
  const r = cmpRows.nth(i);
  const peakTxt = (await r.locator("td").nth(2).textContent()) ?? "";
  const pct = parseFloat(peakTxt);
  const x = parseFloat(await r.locator("svg.report-spark > line.report-spark-mark-owner").getAttribute("x1"));
  must(Number.isFinite(pct) && Number.isFinite(x) && Math.abs(x - (pct / 100) * 96) <= 1e-6,
    `C4 comparison row ${i}'s mark sits at its paper Peak-at address (${peakTxt} -> x ${x})`);
  const xw = parseFloat(await r.locator("svg.report-spark > line.report-spark-mark-winner").getAttribute("x1"));
  must(Number.isFinite(xw) && Math.abs(Math.abs(x - xw) - (Math.abs(pct - mainPctC) / 100) * 96) <= 1e-6,
    `C5 comparison row ${i}'s mark separation IS the paper's peak difference (${peakTxt} vs ${mainPctC}%)`);
}
// the comparison portrait earns the SAME glass — hover opens exactly one
const cmpCell = cmpRows.nth(0).locator('td[data-shape-cell="spark"]');
await cmpTable.scrollIntoViewIfNeeded();
await sleep(300);
await cmpCell.hover();
await sleep(250);
must((await visibleZooms()) === 1, "C6 hovering a comparison cell opens exactly one glass (the same right to magnify)");
const dCmpIn = await cmpRows.nth(0).locator("svg.report-spark > path.report-spark-owner").getAttribute("d");
const dCmpZoom = await cmpRows.nth(0).locator("svg.report-spark-zoom > path.report-spark-owner").getAttribute("d");
must(!!dCmpIn && dCmpIn === dCmpZoom, "C7 the comparison glass magnifies THE picture (byte-identical d, no second father)");
must((await cmpRows.nth(1).locator('td[data-shape-cell="spark"]').textContent()) === "",
  "C8 the comparison pictures speak no words either (M8's guard, second table)");
// the bouncer worked: the OTHER two deep tables keep their paper widths
must((await page.locator('[data-report-body] table:has(th:text-is("Q1 (0\u201325%)"))').locator("thead th").count()) === 8,
  "C9 the local-agreement head grows to eight too (7 paper + Bands, t227)");
must((await page.locator('[data-report-body] table:has(th:text-is("Map A"))').locator("thead th").count()) === 5,
  "C10 the pairwise table stays five columns");
const mdC = await page.locator("[data-report-doc]").getAttribute("data-md");
must(!!mdC && mdC.includes("| Map | Bins | Peak at | Agreement r | Verdict |") &&
     !mdC.includes("| Map | Bins | Peak at | Agreement r | Verdict | Shape |"),
  "C11 the comparisons paper bytes stay five columns (the picture is rendered, never written)");
// the frame is a reviewer — the comparison glass earns its own portrait
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t223/t223-spark-cmp-2x.png", scale: "css" });


/* ============ D: the local agreement earns its strip ============ */
section("D: four quarters, four bars");
const locTable = page.locator('[data-report-body] table:has(th:text-is("Q1 (0\u201325%)"))');
const locRows = locTable.locator("tbody tr");
for (let i = 0; i < 24 && (await locTable.locator('td[data-shape-cell="spark"]').count()) !== 2; i++) await sleep(500);
must((await locRows.count()) === 2, `D1 the local table speaks its two overlays (${await locRows.count()})`);
must((await locTable.locator("thead th").count()) === 8,
  "D2 the local head grew the Bands column on the wire (7 paper + Bands)");
must((await locTable.locator("svg.report-band-strip").count()) === 2,
  "D3 both local rows draw their strip");
// each bar IS the paper's quarter: the Q cell's printed r (the 2dp grid,
// the same rounding the paper prints) sets the bar's length and sign —
// rising above the midline for agreement, dipping below for a betrayal;
// the k-th bar sits at the k-th quarter's center (the address lives in
// the numbers)
for (let i = 0; i < 2; i++) {
  const r = locRows.nth(i);
  for (let k = 0; k < 4; k++) {
    const qTxt = (await r.locator("td").nth(k + 1).textContent()) ?? "";
    const q = parseFloat(qTxt);
    const bar = r.locator("svg.report-band-strip > line.report-band").nth(k);
    const y1 = parseFloat(await bar.getAttribute("y1"));
    const y2 = parseFloat(await bar.getAttribute("y2"));
    const x = parseFloat(await bar.getAttribute("x1"));
    const expectedY2 = 13 - q * 11;
    const expectedX = k * 24 + 12;
    must(Number.isFinite(q) && Number.isFinite(y2) &&
         Math.abs(y2 - expectedY2) <= 1e-6 && Math.abs(y1 - 13) <= 1e-6 &&
         Math.abs(x - expectedX) <= 1e-6 && (q < 0 ? y2 > 13 : true),
      `D4 row ${i} Q${k + 1}: the bar sits at the paper's printed r (${qTxt} -> y2 ${y2} at x ${x})`);
  }
}
must((await locTable.locator("svg.report-band-strip > line.report-band-zero").count()) === 2,
  "D5 every strip carries the zero reference (the midline the bars read against)");
// the glass magnifies the strip too — same right, same mechanism, free
const locCell = locRows.nth(0).locator('td[data-shape-cell="spark"]');
await locTable.scrollIntoViewIfNeeded();
await sleep(300);
await locCell.hover();
await sleep(250);
must((await visibleZooms()) === 1, "D6 hovering a local cell opens exactly one glass");
const zLocIn = await locRows.nth(0).locator("svg.report-band-strip > line.report-band").first().getAttribute("y2");
const zLocZoom = await locRows.nth(0).locator("svg.report-spark-zoom > line.report-band").first().getAttribute("y2");
must(!!zLocIn && zLocIn === zLocZoom, `D7 the strip's glass magnifies THE bars (y2 ${zLocIn} === zoom ${zLocZoom})`);
must((await locRows.nth(1).locator('td[data-shape-cell="spark"]').textContent()) === "",
  "D8 the strips speak no words either (M8's guard, third table)");
// the bouncer holds across all four tables
must((await page.locator(INV + " thead th").count()) === 8, "D9 the inventory head stays eight columns");
must((await cmpTable.locator("thead th").count()) === 6, "D10 the comparisons head stays six columns");
must((await page.locator('[data-report-body] table:has(th:text-is("Map A"))').locator("thead th").count()) === 5,
  "D11 the pairwise head stays five columns");
const mdD = await page.locator("[data-report-doc]").getAttribute("data-md");
must(!!mdD && !mdD.includes("| Bands"),
  "D12 the local paper bytes stay seven columns (the strip is rendered, never written)");
// the frame is a reviewer — the strip's glass earns its own portrait
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t223/t223-band-strip-2x.png", scale: "css" });


/* ============ E: the section earns its hero ============ */
section("E: the hero landscape — the terrain made readable");
// admitted by the section head's EXACT words: one hero on the paper —
// the deep report's own "Map QC summary" head must mint nothing
for (let i = 0; i < 24 && (await page.locator("[data-report-body] [data-hero-landscape]").count()) !== 1; i++) await sleep(500);
must((await page.locator("[data-report-body] [data-hero-landscape]").count()) === 1,
  "E1 exactly one hero landscape on the paper (the deep summary head admits nothing)");
const heroSvg = page.locator("[data-report-body] [data-hero-landscape] svg.report-hero-landscape");
must((await heroSvg.count()) === 1,
  "E2 the hero is one svg with no glass inside it (the hero IS the large view the thumbnails promise)");
// the address law at hero scale: the main mark sits at the reference
// aria's own pct on the 480-wide fraction axis — the same well the
// roster quotes, five times the reach
const xHeroMain = parseFloat(await heroSvg.locator("line.report-hero-mark-main").getAttribute("x1"));
must(Number.isFinite(xHeroMain) && Math.abs(xHeroMain - (mainPctC / 100) * 480) <= 1e-6,
  `E3 the hero's main mark sits at the winner's paper address (${mainPctC}% -> x ${xHeroMain} on 480)`);
// overlay marks: every comparison row's Peak-at pct has its hairline on
// the hero — the family's addresses drawn once, large
for (let i = 0; i < 2; i++) {
  const peakTxt = (await cmpRows.nth(i).locator("td").nth(2).textContent()) ?? "";
  const pct = parseFloat(peakTxt);
  const x = parseFloat(await heroSvg.locator("line.report-hero-mark-overlay").nth(i).getAttribute("x1"));
  must(Number.isFinite(pct) && Number.isFinite(x) && Math.abs(x - (pct / 100) * 480) <= 1e-6,
    `E4 hero overlay mark ${i} sits at its paper Peak-at address (${peakTxt} -> x ${x})`);
}
must((await heroSvg.locator("path.report-hero-main").count()) === 1 &&
     (await heroSvg.locator("path.report-hero-overlay").count()) === 2,
  "E5 the hero draws the whole family (main solid + two overlays dotted)");
// the quarter grid: fixed fractions of depth — addresses with numbers,
// the Local agreement table's own cuts drawn into the protagonist terrain
const quarterXs = [];
for (let i = 0; i < 3; i++) quarterXs.push(parseFloat(await heroSvg.locator("line.report-hero-quarter").nth(i).getAttribute("x1")));
must(quarterXs.length === 3 && quarterXs.every((x, i) => Math.abs(x - (i + 1) * 0.25 * 480) <= 1e-6),
  `E6 the quarter grid stands at 25/50/75% of depth (${quarterXs.join(", ")})`);
// the figure speaks its own words — the aria quotes the wells, never guesses
const heroAria = (await heroSvg.getAttribute("aria-label")) ?? "";
must(heroAria.includes(`${mainPctC}% of depth`) && heroAria.includes("quarter grid"),
  `E7 the hero's aria speaks the addresses it drew ("${heroAria.slice(0, 80)}…")`);
// the paper bytes stay pure: the section head keeps its exact words
const mdE = await page.locator("[data-report-doc]").getAttribute("data-md");
must(!!mdE && mdE.split("\n").includes("## Map QC"),
  "E8 the section head keeps its exact paper words (the hero is rendered around them, never written)");

/* ============ F: the signatures — the hero signs itself ============ */
section("F: the signatures — names at addresses, rows for collisions");
// the wells the signatures must agree with: the aria's own quote, parsed
// into name/pct pairs — the labels are that speech drawn, never retyped.
// The figure's prefix ("Map QC hero landscape — ...") is speech furniture,
// not a name: slice past the em-dash before parsing (the \u2014 escape
// keeps the dash un-typed — the t227 heredoc lesson)
const dashAt = heroAria.indexOf("\u2014");
const quoteStr = dashAt >= 0 ? heroAria.slice(dashAt + 1) : heroAria;
const segs = [];
const segRe = /([^;]+?) peaks at ([0-9.]+)% of depth/g;
let sm;
while ((sm = segRe.exec(quoteStr))) segs.push({ name: sm[1].trim(), pct: parseFloat(sm[2]) });
must(segs.length === 3, `F1 the aria quotes the family (${segs.length} segments: main + two overlays)`);
const heroLabels = heroSvg.locator("text.report-hero-label");
must((await heroLabels.count()) === 3,
  "F2 exactly one signature per addressed line (three lines, three signatures)");
let sigOk = true;
for (let i = 0; i < 3; i++) {
  const txt = (await heroLabels.nth(i).textContent()) ?? "";
  const mm = txt.match(/^(.*) ([0-9.]+)%$/);
  const seg = mm ? segs.find((s) => s.name === mm[1] && Math.abs(s.pct - parseFloat(mm[2])) <= 1e-9) : null;
  if (!seg) { sigOk = false; break; }
}
must(sigOk, "F3 every signature speaks the aria's own words (name + pct from the same wells)");
for (let i = 0; i < 3; i++) {
  const txt = (await heroLabels.nth(i).textContent()) ?? "";
  const pct = parseFloat((txt.match(/ ([0-9.]+)%$/) ?? [])[1]);
  const lx = parseFloat(await heroLabels.nth(i).getAttribute("x"));
  must(Number.isFinite(pct) && Number.isFinite(lx) && Math.abs(lx - (pct / 100) * 480) <= 1e-6,
    `F4 signature ${i} rides its mark's address (${pct}% -> x ${lx})`);
}
must(Number.isFinite(segs[0]?.pct) && Math.abs(segs[0].pct - mainPctC) <= 1e-9,
  `F5 the hero's quote and the roster's quote agree on the winner's peak (${segs[0]?.pct} vs ${mainPctC})`);
// collision discipline: the winner and the overlay whose peak sits within
// 40px share no row — the address never moves, the signature's row does
const yMainSig = parseFloat(await heroLabels.filter({ hasText: `${segs[0].name} ${segs[0].pct}%` }).getAttribute("y"));
const nearOv = segs.slice(1).find((s) => Math.abs((s.pct / 100) * 480 - (segs[0].pct / 100) * 480) <= 40);
const farOv = segs.slice(1).find((s) => s !== nearOv);
must(!!nearOv && !!farOv, "F6 the demo world holds one colliding pair (winner + near-peak overlay)");
const yNear = parseFloat(await heroLabels.filter({ hasText: `${nearOv.name} ${nearOv.pct}%` }).getAttribute("y"));
const yFar = parseFloat(await heroLabels.filter({ hasText: `${farOv.name} ${farOv.pct}%` }).getAttribute("y"));
must(Number.isFinite(yMainSig) && yFar === yMainSig && yNear > yMainSig,
  `F7 the collision stacks deterministically (row0 y ${yMainSig}: ${segs[0].name} + ${farOv?.name}; row1 y ${yNear}: ${nearOv?.name})`);

/* ============ G: the depth labels — the grid signs its ticks ============ */
section("G: the depth labels — the ruler speaks, and never yields");
// the same fixed fractions the grid lines stand at: 25/50/75 -> 120/240/360
const depthLabels = heroSvg.locator("text.report-hero-depth");
must((await depthLabels.count()) === 3,
  "G1 exactly three depth labels (the ruler signs each of its ticks)");
const depthRead = [];
for (let i = 0; i < 3; i++) {
  const txt = (await depthLabels.nth(i).textContent()) ?? "";
  const pct = parseFloat((txt.match(/^([0-9.]+)%$/) ?? [])[1]);
  const lx = parseFloat(await depthLabels.nth(i).getAttribute("x"));
  const qx = parseFloat(await heroSvg.locator("line.report-hero-quarter").nth(i).getAttribute("x1"));
  const ly = parseFloat(await depthLabels.nth(i).getAttribute("y"));
  depthRead.push({ txt, pct, lx, qx, ly });
}
must(depthRead.every((d) => Number.isFinite(d.pct) && Math.abs(d.lx - (d.pct / 100) * 480) <= 1e-6),
  `G2 each label sits at its fixed fraction's address (${depthRead.map((d) => `${d.txt}->x ${d.lx}`).join(", ")})`);
must(depthRead.every((d) => Math.abs(d.lx - d.qx) <= 1e-6),
  "G3 label and grid line share one address (two surfaces of the same fraction, one father)");
must(depthRead.every((d) => d.txt === `${(d.pct)}%`) && heroAria.includes("25, 50 and 75% of depth"),
  "G4 the labels speak the aria's own quarter numbers (25, 50, 75)");
// the ruler does not yield: labels live in the bottom band, below every
// signature row — speech dodges, the address system itself never moves
const sigYs = [];
for (let i = 0; i < 3; i++) sigYs.push(parseFloat(await heroLabels.nth(i).getAttribute("y")));
const sigMaxY = Math.max(...sigYs.filter(Number.isFinite));
must(depthRead.every((d) => d.ly === 77) && depthRead.every((d) => d.ly > sigMaxY + 40),
  `G5 the ruler never yields into the signature rows (labels y 77 below sig max y ${sigMaxY})`);

/* ============ W: the compass — the md's second surface ============ */
// t234: the report's map. The TOC chips are PARSED from the same md
// bytes the body renders (reportTocOf) — two surfaces, one father, the
// HERO_QUARTERS law at the document layer. The pairings are proven by
// INDEX: chip i must speak exactly what heading i speaks.
section("W: the compass — the md's second surface");
const nav = page.locator("[data-report-toc]");
must((await nav.count()) === 1, "W1a the compass exists (a 62vh document deserves a map)");
const navPos = await nav.evaluate((el) => getComputedStyle(el).position);
must(navPos === "sticky", `W1b the map rides on top (position ${navPos})`);
const chips = nav.locator(".report-compass-chip");
const headEls = page.locator("[data-report-body] h2, [data-report-body] h3");
const chipN = await chips.count();
const headN = await headEls.count();
must(chipN === headN && chipN === 9,
  `W2 the compass and the document agree on the section count (${chipN} chips vs ${headN} headings)`);
let chipMismatch = null;
for (let i = 0; i < chipN; i++) {
  const c = ((await chips.nth(i).textContent()) ?? "").trim();
  const h = ((await headEls.nth(i).textContent()) ?? "").trim();
  if (c !== h) { chipMismatch = `#${i} chip "${c}" vs head "${h}"`; break; }
}
must(!chipMismatch,
  `W3 every chip speaks its heading's own words, digit for digit (${chipN} pairs — same well, two mouths)`);
const subN = await nav.locator(".report-compass-sub").count();
must(subN === 5,
  `W4 the outline's hierarchy survives inside the strip (${subN} sub chips — the ### level runs smaller)`);
// the jump: click a MIDDLE section (the tail can never reach the line —
// not enough paper below it; the middle CAN, and must land below the map)
await chips.nth(2).click();
let landed = null;
for (let i = 0; i < 20; i++) {
  await sleep(250);
  landed = await page.evaluate(() => {
    const body = document.querySelector("[data-report-body]");
    const nav2 = document.querySelector("[data-report-toc]");
    const here = nav2.querySelector(".report-compass-here");
    const heads2 = body.querySelectorAll("h2, h3");
    const cTop = body.getBoundingClientRect().top;
    const tTop = heads2[2].getBoundingClientRect().top - cTop;
    const hereIdx = Array.from(nav2.querySelectorAll(".report-compass-chip")).indexOf(here);
    return { tTop, hereIdx, atBottom: body.scrollTop + body.clientHeight >= body.scrollHeight - 4 };
  });
  if (landed.tTop >= 40 && landed.tTop < 140 && landed.hereIdx === 2) break;
}
must(landed && landed.tTop >= 40 && landed.tTop < 140,
  `W5 the jump lands the target BELOW the map (head top ${Math.round(landed?.tTop)}px — scroll-margin pays the strip's rent)`);
must(landed && landed.hereIdx === 2,
  `W6 the needle follows the reader (aria-current on chip ${landed?.hereIdx} after the jump)`);
// the tail law: scroll to the very bottom — the LAST section can never
// reach the compass line, and the needle must say so anyway
await page.evaluate(() => {
  const body = document.querySelector("[data-report-body]");
  body.scrollTop = body.scrollHeight;
});
let tailIdx = -1;
for (let i = 0; i < 16; i++) {
  await sleep(250);
  tailIdx = await page.evaluate(() => {
    const nav2 = document.querySelector("[data-report-toc]");
    return Array.from(nav2.querySelectorAll(".report-compass-chip")).indexOf(nav2.querySelector(".report-compass-here"));
  });
  if (tailIdx === chipN - 1) break;
}
must(tailIdx === chipN - 1,
  `W7 the tail law: at the bottom the needle points at the LAST chip (${tailIdx} of ${chipN - 1} — the last section never reaches the line, the reader is there anyway)`);
// t235: the map follows the needle — while the needle rode to the tail,
// the strip must have slid the last chip into ITS OWN viewport (before
// t235 the spy could point at a chip the map had scrolled out of sight:
// a compass that hides its own reading). Assert: the last chip is fully
// visible inside the strip's scroll window.
const follow = await page.evaluate(() => {
  const nav2 = document.querySelector("[data-report-toc]");
  const chip = nav2.querySelectorAll(".report-compass-chip")[nav2.querySelectorAll(".report-compass-chip").length - 1];
  const nLeft = nav2.getBoundingClientRect().left;
  const cLeft = chip.getBoundingClientRect().left;
  return {
    sl: nav2.scrollLeft,
    fullyVisible: cLeft - nLeft >= -1 && cLeft + chip.getBoundingClientRect().width - nLeft <= nav2.clientWidth + 1,
  };
});
must(follow.fullyVisible && follow.sl > 0,
  `W8 the map follows the needle (strip slid to ${follow.sl}px — the last chip fully visible in the map's own viewport)`);
// the keyboard's map walk: focus a chip, ArrowRight steps to the next,
// ArrowLeft wraps back — Tab reaches the strip in one stop, arrows walk it
await chips.nth(3).focus();
await page.keyboard.press("ArrowRight");
const walkR = await page.evaluate(() => document.activeElement?.textContent?.trim());
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
const walkL = await page.evaluate(() => document.activeElement?.textContent?.trim());
must(walkR === ((await chips.nth(4).textContent()) ?? "").trim(),
  `W9a ArrowRight steps the focus to the next chip ("${walkR}")`);
must(walkL === ((await chips.nth(2).textContent()) ?? "").trim(),
  `W9b ArrowLeft steps back (wrapping) ("${walkL}")`);
await page.evaluate(() => {
  const body = document.querySelector("[data-report-body]");
  body.scrollTop = 0;
});
await sleep(400);

/* ============ P: the print tier — paper inherits the hierarchy ============ */
section("P: the print tier — same ink, deeper plate");
// screen baseline first: the backlit values are the contract the paper
// tier must NOT touch (emulation is a lens, not a rewrite)
const sigScreen = await heroLabels.nth(0).evaluate((el) => getComputedStyle(el).fillOpacity);
const depthScreen = await depthLabels.nth(0).evaluate((el) => getComputedStyle(el).fillOpacity);
must(sigScreen === "0.62" && depthScreen === "0.5",
  `P0 the screen tier stands untouched on screen (sig ${sigScreen}, depth ${depthScreen})`);
await page.emulateMedia({ media: "print" });
await sleep(120);
const sigPrint = await heroLabels.nth(0).evaluate((el) => getComputedStyle(el).fillOpacity);
const depthPrint = await depthLabels.nth(0).evaluate((el) => getComputedStyle(el).fillOpacity);
must(sigPrint === "1" && depthPrint === "0.85",
  `P1 paper deepens the speech (sig ${sigPrint}, depth ${depthPrint} — 6px glyphs at 0.5 would wash out)`);
must(parseFloat(sigPrint) > parseFloat(depthPrint),
  "P2 the hierarchy survives the medium: names still speak louder than the ruler (1 > 0.85)");
const mainPrint = await heroSvg.locator("path.report-hero-main").evaluate((el) => getComputedStyle(el).strokeOpacity);
const ovPrint = await heroSvg.locator("path.report-hero-overlay").first().evaluate((el) => getComputedStyle(el).strokeOpacity);
const ovDash = await heroSvg.locator("path.report-hero-overlay").first().evaluate((el) => getComputedStyle(el).strokeDasharray);
must(mainPrint === "1" && ovPrint === "0.7" && ovDash.includes("3"),
  `P3 the terrain deepens, the dotted identity survives (main ${mainPrint}, overlay ${ovPrint} dash ${ovDash})`);
const qPrint = await heroSvg.locator("line.report-hero-quarter").nth(0).evaluate((el) => getComputedStyle(el).strokeOpacity);
must(qPrint === "0.3",
  `P4 the context survives paper (grid ${qPrint} — 0.14 would print as nothing)`);
const mmPrint = await heroSvg.locator("line.report-hero-mark-main").evaluate((el) => getComputedStyle(el).strokeOpacity);
const moPrint = await heroSvg.locator("line.report-hero-mark-overlay").first().evaluate((el) => getComputedStyle(el).strokeOpacity);
must(mmPrint === "0.85" && moPrint === "0.6",
  `P5 the addresses deepen in rank (mark main ${mmPrint} > mark overlay ${moPrint})`);
const sparkOwnerPrint = await page.locator(INV + " path.report-spark-owner").first().evaluate((el) => getComputedStyle(el).strokeOpacity);
const bandPrint = await locTable.locator("svg.report-band-strip > line.report-band").first().evaluate((el) => getComputedStyle(el).strokeOpacity);
must(sparkOwnerPrint === "1" && bandPrint === "0.9",
  `P6 the tables' ink rides the same tier (owner ${sparkOwnerPrint}, band ${bandPrint})`);
const zoomPrintDisplay = await page.locator(INV + " svg.report-spark-zoom").first().evaluate((el) => getComputedStyle(el).display);
must(zoomPrintDisplay === "none",
  "P7 the glass never prints (t224's guard re-pinned under emulation)");
await page.emulateMedia({ media: "screen" });
await sleep(120);
const sigBack = await heroLabels.nth(0).evaluate((el) => getComputedStyle(el).fillOpacity);
must(sigBack === "0.62",
  "P8 emulation is not a one-way door (screen tier restored after print)");
// the compass is a screen organ: paper keeps its own page order, the
// map retires (the .no-print roster, now carrying the TOC too)
await page.emulateMedia({ media: "print" });
await sleep(120);
const navPrintDisplay = await nav.evaluate((el) => getComputedStyle(el).display);
await page.emulateMedia({ media: "screen" });
await sleep(120);
must(navPrintDisplay === "none",
  `P9 the map never prints (compass display ${navPrintDisplay} on paper — the page order IS the paper's map)`);

// the frame is a reviewer — scroll the hero into the dialog's viewport
// (the body scrolls internally, the band frame's own lesson) and shoot
// the doc with the figure at the top: hero + the summary head it
// introduces, the tables' thumbnails in the same frame for scale
await page.mouse.move(8, 8);
await sleep(250);
await page.locator("[data-report-body] [data-hero-landscape]").first().scrollIntoViewIfNeeded();
await sleep(300);
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t223/t223-hero-2x.png", scale: "css" });

await browser.close();

/* ============ T: teardown — the twin goes home ============ */
section("T: DELETE the twin");
const del = await fetch(`${BASE}/api/jobs/${twinId}`, { method: "DELETE", headers: H });
must(del.ok, `T1 DELETE accepted (${del.status})`);
const rosterT = await jobs();
must(rosterT.length === 21 && !rosterT.find((j) => j.name === "QA Class2D Twin"),
  `T2 the roster is 21 again, twin gone (${rosterT.length})`);

/* ============ Z: the untied world — the lens survives ============ */
section("Z: the picture after the tie ends");
const browser2 = await chromium.launch();
const page2 = await browser2.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors2 = [];
page2.on("console", (m) => { if (m.type() === "error") consoleErrors2.push(m.text()); });
page2.on("pageerror", (e) => consoleErrors2.push(String(e)));
await page2.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
await page2.locator('button[aria-label="Session QC report"]').click();
await sleep(1800);
for (let i = 0; i < 24 && (await page2.locator("[data-report-body] tr[data-owner-door]").count()) !== 2; i++) await sleep(500);
for (let i = 0; i < 24 && (await page2.locator(INV + ' td[data-shape-cell="spark"]').count()) !== 2; i++) await sleep(500);
const rows2 = page2.locator("[data-report-body] tr[data-owner-door]");
const pOut = await rows2.nth(1).locator("svg.report-spark > path.report-spark-owner").getAttribute("d");
const wRef = await rows2.nth(0).locator("svg.report-spark > path.report-spark-winner").getAttribute("d");
must(!!pOut && !!wRef && pOut !== wRef,
  "Z1 the untied world: the unique outlier's portrait still separates from the winner's (the lens survives)");
must((await page2.locator("[data-report-body] blockquote").count()) === 0,
  "Z2 the tie note is gone with the tie — no note without a contested crown");
must((await page2.locator(INV + " svg.report-spark-zoom").count()) === 2,
  "Z2b the magnifier exists in the untied world too — born with every picture, tied or not");
must((await page2.locator(INV + " svg.report-spark > line.report-spark-mark-owner").count()) === 2,
  "Z2c the untied world's portraits carry their addresses too");
const xOut = parseFloat(await rows2.nth(1).locator("svg.report-spark > line.report-spark-mark-owner").getAttribute("x1"));
const xWin = parseFloat(await rows2.nth(1).locator("svg.report-spark > line.report-spark-mark-winner").getAttribute("x1"));
must(Number.isFinite(xOut) && Number.isFinite(xWin) && Math.abs(xOut - xWin) > 1e-6,
  `Z2d the outlier's address separates from the winner's (${xOut} vs ${xWin}) — the relocation wears its hairline`);
const cmpTable2 = page2.locator('[data-report-body] table:has(th:text-is("Bins"))');
must((await cmpTable2.locator("svg.report-spark").count()) === 2,
  "Z2e the comparisons portraits survive the tie's end too (the deep section keeps its pictures)");
must((await page2.locator('[data-report-body] table:has(th:text-is("Map A"))').locator("thead th").count()) === 5,
  "Z2f the pairwise table stays five columns in the untied world");
must((await page2.locator('[data-report-body] table:has(th:text-is("Q1 (0\u201325%)"))').locator("svg.report-band-strip").count()) === 2,
  "Z2g the strips survive the tie's end too (the local table keeps its bars)");
must((await page2.locator("[data-report-body] [data-hero-landscape]").count()) === 1,
  "Z2h the hero survives the tie's end too — the terrain figure rides the world, not the tie");
must((await page2.locator("[data-report-body] svg.report-hero-landscape text.report-hero-label").count()) === 3,
  "Z2i the untied world's hero signs itself too (three lines, three signatures)");
must((await page2.locator("[data-report-body] svg.report-hero-landscape text.report-hero-depth").count()) === 3,
  "Z2j the untied world's ruler signs its ticks too (three depth labels at the same fixed addresses)");
await page2.emulateMedia({ media: "print" });
await sleep(120);
const sigPrint2 = await page2.locator("[data-report-body] svg.report-hero-landscape text.report-hero-label").first().evaluate((el) => getComputedStyle(el).fillOpacity);
await page2.emulateMedia({ media: "screen" });
must(sigPrint2 === "1",
  `Z2k the print tier rides the world too (untied signature on paper ${sigPrint2})`);
// the compass rides the untied world too — same well, whatever the
// bytes turn out to be (fewer overlays, fewer sections, same law)
const nav2 = page2.locator("[data-report-toc]");
const chips2 = nav2.locator(".report-compass-chip");
const heads2 = page2.locator("[data-report-body] h2, [data-report-body] h3");
const chips2N = await chips2.count();
const heads2N = await heads2.count();
let untiedPairOk = chips2N === heads2N;
for (let i = 0; untiedPairOk && i < chips2N; i++) {
  const c = ((await chips2.nth(i).textContent()) ?? "").trim();
  const h = ((await heads2.nth(i).textContent()) ?? "").trim();
  if (c !== h) untiedPairOk = false;
}
must(chips2N > 0 && untiedPairOk,
  `Z2l the untied world carries its own map (${chips2N} chips paired digit for digit with ${heads2N} headings)`);
must(rosterT.length === 21, "Z3 roster identity (21) after the whole dance");
must(consoleErrors.length === 0 && consoleErrors2.length === 0,
  `Z4 console clean across both visits (${consoleErrors.length}/${consoleErrors2.length})`);
await browser2.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail) { fails.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }

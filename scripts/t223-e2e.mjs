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
for (let i = 0; i < 24 && (await page.locator('[data-report-body] td[data-shape-cell="spark"]').count()) !== 3; i++) await sleep(500);

const headCells = await page.locator("[data-report-body] table:has(tr[data-owner-door]) thead th").allTextContents();
must(JSON.stringify(headCells) === JSON.stringify(["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest", "Shape"]),
  `V1 the wire's head is the septet + Shape (${JSON.stringify(headCells)})`);
must((await page.locator('[data-report-body] td[data-shape-cell="spark"]').count()) === 3,
  "V2 all three owner rows carry a spark cell");
must((await page.locator("[data-report-body] svg.report-spark").count()) === 3,
  "V3 each spark cell draws one inline SVG");
must((await page.locator("[data-report-body] svg.report-spark > path.report-spark-winner").count()) === 3,
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
must((await page.locator("[data-report-body] svg.report-spark-zoom").count()) === 3,
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
for (let i = 0; i < 24 && (await page2.locator('[data-report-body] td[data-shape-cell="spark"]').count()) !== 2; i++) await sleep(500);
const rows2 = page2.locator("[data-report-body] tr[data-owner-door]");
const pOut = await rows2.nth(1).locator("svg.report-spark > path.report-spark-owner").getAttribute("d");
const wRef = await rows2.nth(0).locator("svg.report-spark > path.report-spark-winner").getAttribute("d");
must(!!pOut && !!wRef && pOut !== wRef,
  "Z1 the untied world: the unique outlier's portrait still separates from the winner's (the lens survives)");
must((await page2.locator("[data-report-body] blockquote").count()) === 0,
  "Z2 the tie note is gone with the tie — no note without a contested crown");
must((await page2.locator("[data-report-body] svg.report-spark-zoom").count()) === 2,
  "Z2b the magnifier exists in the untied world too — born with every picture, tied or not");
must(rosterT.length === 21, "Z3 roster identity (21) after the whole dance");
must(consoleErrors.length === 0 && consoleErrors2.length === 0,
  `Z4 console clean across both visits (${consoleErrors.length}/${consoleErrors2.length})`);
await browser2.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail) { fails.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }

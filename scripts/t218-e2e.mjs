#!/usr/bin/env node
/**
 * t218-e2e — the roster speaks CSV.
 *
 * The session report's map inventory grows a THIRD export door: "Download
 * CSV" hands the five-column roster (job, main map, volumes, peak %,
 * Δ winner) to spreadsheets and scripts as a machine grid. Doctrines
 * under test:
 *   S  setup — the DIVERGENT world (t215's recipe: winner orthovol ->
 *      outlier orthovol -> halves -> masked -> the DIVERGENT overwrite
 *      LAST; the probe rebuilds its own world, no accumulated reliance).
 *   X  source — inventoryCsv is defined ONCE in qc-report.ts, the CSV's
 *      delta cell comes from deltaVsWinner ITSELF (no re-derivation —
 *      twins fork, imports don't), the dialog imports and wires the door,
 *      the filename helper shares the report's timestamp grammar.
 *   D  dynamic — click the door, catch the download: the header row, the
 *      row count == the inventory's, the winner's +0.0, the outlier's
 *      -26.2, peak cells == wire, one row per owner. A pending peak is a
 *      BLANK cell — still-measuring in CSV grammar is empty, not a guess.
 *   Z  world hygiene — roster identity, console clean.
 */
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
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

const LIB = readFileSync("src/lib/qc-report.ts", "utf8");
const DLG = readFileSync("src/components/workflow/session-report-dialog.tsx", "utf8");

const jobs = async () =>
  (await (await fetch(BASE + "/api/jobs", { headers: H })).json()).jobs ?? [];

/* ============ S: setup — the divergent world, rebuilt ============ */
section("S: the world, rebuilt from the recipe (no accumulated reliance)");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/qa67-seed-volume.py", { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
execSync("python3 scripts/seed-masked.py", { stdio: "pipe" });
const outlierReceipt = execSync("python3 scripts/seed-outlier.py", { encoding: "utf8" });
must(outlierReceipt.includes("DIVERGENT"), "S1 the outlier seeder ran and said so");
const rosterS = await jobs();
const host = rosterS.find((j) => j.name === "QA Refine3D");
const second = rosterS.find((j) => j.name === "QA Class2D Source");
must(!!host && !!second, "S2 both owners in roster");

/* ============ X: the source, one father per cell ============ */
section("X: the CSV speaks with the paper's voice");
must((LIB.match(/export const inventoryCsv =/g) ?? []).length === 1, "X1 inventoryCsv defined ONCE");
must(
  LIB.includes("const delta = deltaVsWinner(o.peakPct, winnerPct) ?? \"\";") &&
  !/delta_winner[^;]*toFixed/.test(LIB.slice(LIB.indexOf("export const inventoryCsv"))),
  "X2 the CSV's delta cell IS deltaVsWinner — no re-derivation in the builder",
);
must(
  DLG.includes("inventoryCsv") && DLG.includes("inventoryCsvFilename") &&
  DLG.includes('aria-label="Download map inventory CSV"'),
  "X3 the dialog imports both helpers and wires the door by aria",
);
must(
  LIB.includes("export const inventoryCsvFilename = (): string =>") &&
  LIB.includes("session-map-inventory-"),
  "X4 the CSV travels under its OWN name (same timestamp grammar, own extension)",
);
must(
  LIB.includes('const peak = o.peakPct != null ? o.peakPct.toFixed(1) : "";'),
  "X5 a pending peak is a BLANK cell — still-measuring is empty, never a guess",
);

/* ============ D: the door, on the wire ============ */
section("D: click the door, read the grid");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);

await page.locator('button[aria-label="Session QC report"]').click();
await sleep(1800);
for (let i = 0; i < 20 && (await page.locator("[data-report-body] tr[data-outlier]").count()) !== 1; i++) await sleep(500);
must((await page.locator("[data-report-body] tr[data-outlier]").count()) === 1, "D1 the inventory settled (amber lens on)");

const door = page.locator('button[aria-label="Download map inventory CSV"]');
must((await door.count()) === 1, "D2 the CSV door exists, exactly one");
must(await door.isEnabled(), "D3 the door is enabled while the roster speaks");

const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 10000 }),
  door.click(),
]);
const fileName = download.suggestedFilename();
must(/^session-map-inventory-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/.test(fileName),
  `D4 the filename carries the export stamp (${fileName})`);
const csv = readFileSync(await download.path(), "utf8");
must(!!csv, "D5 the download has bytes");

const rows = csv.trim().split("\n");
must(rows[0] === "job,main_map,volumes,peak_pct,delta_winner,shape_r", "D6 the header is the machine grid (t221: shape_r joins — the roster's r fact travels)");
must(rows.length === 3, `D7 one row per owner, no more (${rows.length - 1})`);

// wire-relative doctrine: the CSV is the PAPER's machine translation —
// every cell is read from the rendered document's own markdown (data-md)
// and compared, never against a hard-coded yesterday.
const md = await page.locator("[data-report-doc]").getAttribute("data-md");
must(!!md, "D8 the rendered document's markdown is on the wire");
const paperRows = [...md.matchAll(/^\| (.+?) \| (.+?) \| (\d+) \| ([\d.]+%) \| ([+-][\d.]+) \| (-?[\d.]+) \|$/gm)].slice(0, 2);
must(paperRows.length === 2, `D9 the paper's inventory has two speakable rows (${paperRows.length})`);
const paperToCsv = paperRows.map(([, j, m, v, p, d, r]) => [j, m, v, p.replace(/%$/, ""), d, r].map((c) => (/[",\n]/.test(c) ? `"${c}"` : c)).join(","));
must(rows[1] === paperToCsv[0], `D10 the winner row == paper, cell for cell (${rows[1]})`);
must(rows[2] === paperToCsv[1], `D11 the second row == paper, cell for cell (${rows[2]})`);
must(paperToCsv[0].endsWith(",+0.0,1.00"), "D12 the reference row speaks +0.0 and self-r 1.00 in BOTH grammars");

// the portrait: the doors row with the emerald CSV sibling + the five-column
// inventory (the roster and its machine grid, one frame)
mkdirSync("scripts/shots-t218", { recursive: true });
const dialog = page.locator("[data-report-doc]").first();
await dialog.screenshot({ path: "scripts/shots-t218/t218-csv-door-2x.png", scale: "css" });

must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length})`);
await browser.close();

/* ============ Z: world hygiene ============ */
section("Z: the world after");
const rosterZ = await jobs();
must(rosterZ.length === 21, `Z1 roster identity (21) — got ${rosterZ.length}`);

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail) { fails.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }

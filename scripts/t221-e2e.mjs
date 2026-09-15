#!/usr/bin/env node
/**
 * t221-e2e — the roster speaks shape, and the palette names the door.
 *
 * Two increments, one probe:
 *   P  palette — the session QC report was the last surface with no name
 *      in the ⌘K palette (a door that exists only on the header strip is
 *      a door the keyboard cannot reach). The palette's "Canvas & app"
 *      group now carries "Open the session QC report", which closes the
 *      palette and dispatches SESSION_REPORT_EVENT; the header (the
 *      dialog's OWNER) listens and opens it — no second report mounted.
 *   R  roster — the inventory grew its sixth column, "Agreement r": every
 *      owner's main landscape correlated against the winner's (the SAME
 *      pearson-on-the-fraction-scale the deep report prints for the
 *      winner's own maps). The winner's row lands at 1.00 through the
 *      same path; a divergent owner speaks a LOW or negative r while its
 *      Δ column speaks the relocation — two columns, one story. The CSV
 *      (t218) grew the same fact as shape_r. Pinned cell-for-cell below
 *      by t215/t218/t219's migrations; this probe pins only the palette
 *      door's live wire and the paper's head (the migration probes own
 *      the arithmetic).
 * Run: node scripts/t221-e2e.mjs   (server on :3000)
 */
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

/* ============ S: the world, made divergent again ============ */
section("S: the divergent overwrite, re-asserted");
// the world is a DRIFT QUANTITY (t210's family recipe re-seeds standard
// shapes after t215/t219 leave the divergent world behind) — this probe
// owns its own world: the divergent overwrite is idempotent and LAST
// (nothing may re-seed that file afterwards, the t215 ordering doctrine)
import { execSync } from "node:child_process";
const outlierReceipt = execSync("python3 scripts/seed-outlier.py", { encoding: "utf8", cwd: process.cwd() });
must(outlierReceipt.includes("DIVERGENT"), "S1 the divergent seeder ran and said so (the probe owns its world)");

/* ============ P: the palette names the door ============ */
section("P: the palette opens the report");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);

await page.keyboard.press("ControlOrMeta+k");
await sleep(900);
must((await page.locator("[cmdk-dialog]").count()) > 0 || (await page.locator("[role='dialog']").count()) > 0,
  "P1 the palette opens (Ctrl+K)");
await page.keyboard.type("session qc");
await sleep(600);
const row = page.getByRole("option", { name: /Open the session QC report/i }).first();
must((await row.count()) > 0, "P2 the palette knows the report (fuzzy 'session qc' finds the row)");
await row.click();
await sleep(2200);
// one modal at a time: the palette is gone, the report is up
must((await page.locator("[data-report-doc]").count()) === 1,
  "P3 the report is open — the event hop landed on the OWNER (header), no second dialog mounted");
const mdP = await page.locator("[data-report-doc]").getAttribute("data-md");
must(!!mdP && mdP.includes("### Session map inventory"), "P4 the opened report is the real paper (inventory section present)");
await page.keyboard.press("Escape");
await sleep(600);

/* ============ R: the paper's head speaks six ============ */
section("R: the inventory head, on the wire");
await page.locator('button[aria-label="Session QC report"]').click();
await sleep(2200);
const headCells = await page.locator("[data-report-body] table:has(tr[data-owner-door]) thead th").allTextContents();
must(JSON.stringify(headCells) === JSON.stringify(["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest"]),
  `R1 the head is the septet (${JSON.stringify(headCells)})`);
const rows = await page.locator("[data-report-body] tr[data-owner-door]").count();
must(rows >= 2, `R2 the roster speaks (${rows} owner rows)`);
const rCells = (await page.locator("[data-report-body] tr[data-owner-door] td:nth-child(6)").allTextContents()).map((c) => c.trim());
must(rCells.every((c) => c === "—" || /^-?\d+\.\d{2}$/.test(c)), `R3 every r cell is a number on the 2-decimal grid or — (${JSON.stringify(rCells)})`);
must(rCells[0] === "1.00", `R4 the reference row speaks 1.00 — through the same path, no special case (${rCells[0]})`);
must(rCells.slice(1).some((c) => c !== "1.00"), "R5 at least one tail owner does NOT follow the winner — the column has something to say in this world");
const wCells = (await page.locator("[data-report-body] tr[data-owner-door] td:last-child").allTextContents()).map((c) => c.trim());
must(wCells.every((c) => c === "\u2014" || /^Q\d \(-?\d+\.\d{2}\)$/.test(c)), `R6 every Weakest cell is a short band address or — (${JSON.stringify(wCells)})`);
must(wCells[0] === "Q1 (1.00)", `R7 the reference row's thinnest quarter is perfect (${wCells[0]})`);

await page.keyboard.press("Escape");
await sleep(500);
const roster = await jobs();
must(roster.length === 21, `Z1 roster identity (${roster.length})`);
must(errors.length === 0, `Z2 console clean (${errors.length})`);
await browser.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail) { fails.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }

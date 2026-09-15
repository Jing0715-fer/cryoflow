#!/usr/bin/env node
/**
 * t219-e2e — a tie for the crown is no crown (ON THE WIRE).
 *
 * t215's lens (outlierRowIdx) carries a three-state comparator whose tie
 * branch was pinned only by a source oracle: the bare world has ONE
 * outlier, so no probe ever SAW a real tie. t219 builds that world:
 *   S  setup — the divergent world (t215's recipe) + seed-twin.py, a
 *      THIRD owner ("QA Class2D Twin") whose orthovol is BYTE-IDENTICAL
 *      to the outlier's divergent shape — same peak, same Δ, one shape,
 *      two fathers of NOTHING (a copy, not a re-derivation).
 *   W  wire — the walk hears THREE owners; the twin's profile == the
 *      outlier's profile (same landscape, read independently).
 *   D  dynamics — the inventory speaks three rows; the Δ column reads
 *      +0.0 / -X / -X (wire-relative, from the rendered markdown); and
 *      tr[data-outlier] count === 0 — THE TIE CROWNS NOBODY. t220: the
 *      paper EXPLAINS the silence — a tie footnote (from the SAME scan,
 *      contestedCrown) names both contenders and the shared |Δ| in the
 *      markdown source, so exports carry it too. The CSV door (t218)
 *      still speaks three rows, cell-for-cell with the paper.
 *   T  teardown — DELETE /api/jobs/:id clears the run record and the row;
 *      the roster returns to 21; the outputs route refuses the dead id.
 *   Z  world hygiene — console clean; t220's negative branch: the untied
 *      world speaks TWO rows, the amber edge returns, the note is gone.
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

const jobs = async () =>
  (await (await fetch(BASE + "/api/jobs", { headers: H })).json()).jobs ?? [];

/* ============ S: setup — the tied world ============ */
section("S: the divergent world, then its TWIN");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/qa67-seed-volume.py", { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
execSync("python3 scripts/seed-masked.py", { stdio: "pipe" });
execSync("python3 scripts/seed-outlier.py", { stdio: "pipe" });
const twinReceipt = execSync("python3 scripts/seed-twin.py", { encoding: "utf8" });
must(twinReceipt.includes("TWIN_READY"), "S1 the twin seeder ran and said TWIN_READY");
must(twinReceipt.includes("byte-identical=True"), "S2 the twin's volume is a COPY, byte-identical (one shape, no second father)");
const twinId = (twinReceipt.match(/TWIN_READY id=(\S+)/) || [])[1];
must(!!twinId, "S3 the twin's id is on the receipt");

/* ============ W: the wire — three owners, two landscapes ============ */
section("W: the walk hears three; the twin reads as its source");
const rosterW = await jobs();
const host = rosterW.find((j) => j.name === "QA Refine3D");
const second = rosterW.find((j) => j.name === "QA Class2D Source");
const twin = rosterW.find((j) => j.name === "QA Class2D Twin");
must(!!host && !!second && !!twin, "W1 all three owners in roster");
const prof = async (id, p) =>
  (await (await fetch(`${BASE}/api/jobs/${id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const maxIdx = (bins) => bins.reduce((b, v, i) => (v > bins[b] ? i : b), 0);
// the peak is a POSITION on the depth ruler (t215's grammar): the argmax
// bin's index over the bin count, not the density value it reaches
const pctAt = (bins, i) => Number(((i / Math.max(1, bins.length - 1)) * 100).toFixed(1));
const profT = await prof(twin.id, "orthovol.mrc");
const profS = await prof(second.id, "orthovol.mrc");
must(profT.bins && profS.bins && JSON.stringify(profT.bins) === JSON.stringify(profS.bins),
  "W2 the twin's landscape == the source's landscape, bin for bin (same wire, two owners)");
const peakT = pctAt(profT.bins, maxIdx(profT.bins));
const peakH = pctAt((await prof(host.id, "orthovol.mrc")).bins, maxIdx((await prof(host.id, "orthovol.mrc")).bins));
must(peakT < peakH, `W3 both tail owners sit BELOW the winner (${peakT} < ${peakH}) — the tie is for the crown, not the throne`);

/* ============ D: the dynamics — three rows, NO crown ============ */
section("D: the lens faces a real tie — and crowns nobody");
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
must((await page.locator("[data-report-body] tr[data-owner-door]").count()) === 3, "D1 the inventory speaks THREE door rows");
must((await page.locator("[data-report-body] tr[data-outlier]").count()) === 0, "D2 THE TIE CROWNS NOBODY — zero amber rows (the tie branch, alive on the wire)");

// t220: the lens explains its own silence — the paper's tie footnote.
// The note lives in the MARKDOWN source (data-md), so the exported
// bytes and the clipboard copy carry it too; the CSV stays numbers-only
// (D7's row count pins that). The footnote is the SAME scan's verdict
// (contestedCrown shares outlierRowIdx's walk), so its |Δ| is the
// paper's own arithmetic, not a second opinion.
const md = await page.locator("[data-report-doc]").getAttribute("data-md");
const tieAbs = (peakH - peakT).toFixed(1);
// order-agnostic: the inventory is newest-walk-first, and WHICH contender
// leads the footnote is the walk's business, not the assertion's — the
// note must name BOTH and the shared |Δ|, in either order
const noteLine = (md || "").split("\n").find((l) => l.startsWith("> The outlier lens is silent here:"));
must(!!noteLine && noteLine.includes("QA Class2D Source") && noteLine.includes("QA Class2D Twin") && noteLine.includes(`(${tieAbs} vs winner)`),
  `D2b the paper's footnote names BOTH contenders and the shared |Δ| (${tieAbs})`);
must(!!md && md.includes("a tie for the crown is no crown, so no row wears the amber edge"),
  "D2c the footnote speaks the t219 doctrine verbatim");
const noteCount = await page.locator("[data-report-body] blockquote").count();
const noteText = noteCount > 0
  ? await page.locator("[data-report-body] blockquote").first().textContent().catch(() => null)
  : null;
must(noteCount === 1 && !!noteText && noteText.includes("QA Class2D Source") && noteText.includes("QA Class2D Twin"),
  `D2d the rendered note is ONE blockquote naming both contenders (count ${noteCount})`);
// t220 portrait: the note deserves its own frame — the doc scrolled to
// the inventory's footnote, the amber silence and its explanation together
// (the top frame below the fold cannot show what the lens said)
await page.locator("[data-report-body] blockquote").first().scrollIntoViewIfNeeded();
await sleep(300);
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t219/t219-tie-note-2x.png", scale: "css" });
const paperRows = [...md.matchAll(/^\| (.+?) \| (.+?) \| (\d+) \| ([\d.]+%) \| ([+-][\d.]+) \|$/gm)].slice(0, 3);
must(paperRows.length === 3, `D3 the paper's inventory has three speakable rows (${paperRows.length})`);
const deltas = paperRows.map((r) => r[5]);
must(deltas[0] === "+0.0", "D4 the winner still reads against itself (+0.0)");
must(deltas[1] === deltas[2] && deltas[1].startsWith("-"),
  `D5 the tied rows speak the SAME delta (${deltas[1]} / ${deltas[2]}) — one landscape, twice owned`);
must(deltas[1] === `-${(peakH - peakT).toFixed(1)}` || Number(deltas[1]) === Number(((peakT - peakH).toFixed(1))),
  `D6 the tied delta is the paper's own arithmetic (${deltas[1]} = ${peakT} - ${peakH} on the depth ruler)`);

// the CSV door (t218) lives in the tied world too — three rows, cell-for-cell
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 10000 }),
  page.locator('button[aria-label="Download map inventory CSV"]').click(),
]);
const { readFileSync: rf } = await import("node:fs");
const csv = rf(await download.path(), "utf8");
const csvRows = csv.trim().split("\n");
must(csvRows.length === 4, `D7 the CSV speaks three data rows (${csvRows.length - 1})`);
const paperToCsv = paperRows.map(([, j, m, v, p, d]) => [j, m, v, p.replace(/%$/, ""), d].map((c) => (/[",\n]/.test(c) ? `"${c}"` : c)).join(","));
must(csvRows[1] === paperToCsv[0] && csvRows[2] === paperToCsv[1] && csvRows[3] === paperToCsv[2],
  "D8 the CSV == the paper, cell for cell, all three rows");

mkdirSync("scripts/shots-t219", { recursive: true });
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t219/t219-tie-2x.png", scale: "css" });
must(consoleErrors.length === 0, `D9 console clean (${consoleErrors.length})`);
await browser.close();

/* ============ T: teardown — the twin goes home ============ */
section("T: DELETE the twin — the roster forgets, the disk remembers (undo doctrine)");
const del = await fetch(`${BASE}/api/jobs/${twinId}`, { method: "DELETE", headers: H });
must(del.ok, `T1 DELETE accepted (${del.status})`);
const rosterT = await jobs();
must(rosterT.length === 21 && !rosterT.find((j) => j.name === "QA Class2D Twin"),
  `T2 the roster is 21 again, twin gone (${rosterT.length})`);
const deadProf = await fetch(`${BASE}/api/jobs/${twinId}/map-profile?path=orthovol.mrc&axis=z`, { headers: H });
must(deadProf.status === 404 || (await deadProf.json()).error, "T3 the outputs route refuses the dead id");
const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
must(!state[twinId], "T4 the run record left with the job (clearRunRecord, alive)");

/* ============ Z: world hygiene ============ */
section("Z: the world after");
must((await jobs()).length === 21, "Z1 roster identity (21) after the whole dance");

// t220: the negative branch on the wire — in the untied world the tie
// note is NEVER born (the amber edge already speaks), and with the twin
// gone the unique outlier wears it again. The lens explains only ITS
// silences, not every table.
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
for (let i = 0; i < 16 && (await page2.locator("[data-report-body] tr[data-outlier]").count()) !== 1; i++) await sleep(500);
must((await page2.locator("[data-report-body] tr[data-owner-door]").count()) === 2, "Z2 the untied world's inventory speaks TWO rows (winner + outlier)");
must((await page2.locator("[data-report-body] tr[data-outlier]").count()) === 1, "Z3 the unique outlier wears the amber edge again");
must((await page2.locator("[data-report-body] blockquote").count()) === 0, "Z4 the tie note is gone with the tie — no note without a contested crown");
must(consoleErrors2.length === 0, `Z5 console clean on the second visit (${consoleErrors2.length})`);
await browser2.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail) { fails.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }

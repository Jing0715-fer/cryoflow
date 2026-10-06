// t652 — the STAR table reads its own shape: typed column alignment
// (numeric columns right-align, header and cells; the row index joins
// the numeric grammar) + truncation is never a dead end (title hover
// reveal, help cursor, an honest footer hint that only speaks when a
// cell was actually cut).
//
// Probe contract:
//   A  API — unchanged baseline: the JSON lane keeps its preview
//      semantics, the export lane stays no-store (this window touched
//      the table only; the API must prove it was not dragged along).
//   B  UI real world — the census (t652-star-survey) says the demo
//      world's widest cell is 44 chars, so: ImageName column left,
//      AnglePsi column right, the # index right, headers matching
//      their columns, ZERO title attributes, and the footer hint
//      ABSENT (a hint for a problem that does not exist would be a
//      lie). Sorting still engages (regression: aria-sort flips).
//   C  UI intercepted world — page.route fulfills the star endpoint
//      with a >72-char ImageName value (no seeded world is polluted —
//      t632's archaeology stays clean): the visible cell is the 72-char
//      slice + ellipsis, the FULL value rides in title, the cursor is
//      help, the footer hint appears, and alignment grammar survives.
//   D  console hygiene.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const JOB = "cmuwipe635000class2d";
const STAR_PATH = "run_it012_data.star";
let PASS = 0;
let FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- A: API baseline ----------
{
  const hdrs = { "Origin": BASE, "Referer": `${BASE}/` };
  const json = await (await fetch(`${BASE}/api/jobs/${JOB}/outputs/star?path=${STAR_PATH}&rows=100`, { headers: hdrs })).json();
  must(json.columns?.length === 5 && json.rows?.length === 100 && json.rowCount === 240 && json.truncated === true,
    "A JSON lane keeps preview semantics (100 of 240, truncated)",
    `rows ${json.rows?.length}/${json.rowCount}`);
  const exp = await fetch(`${BASE}/api/jobs/${JOB}/outputs/star?path=${STAR_PATH}&export=tsv`, { headers: hdrs });
  must(exp.headers.get("cache-control") === "no-store", "A export lane untouched (no-store)");
}

// ---------- shared navigation (t651 recipe: roster rows are the
// collision-free path, the header switcher is the semantic door) ----------
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').click();
await sleep(1200);
const row = page.locator('[data-roster-row]', { hasText: "2D classification" }).first();
let found = false;
for (let i = 0; i < 10 && !found; i++) {
  if (await row.count() > 0 && await row.isVisible()) { found = true; break; }
  await sleep(1000);
}
must(found, "B dashboard roster row for 2D classification found");
await row.locator('button[title^="Open 2D classification"]').click();
await sleep(1500);
await page.locator('[role="tab"]', { hasText: /^Results$/ }).first().click();
await sleep(1500);
const starSection = page.locator('section[aria-label="STAR tables"]');
await starSection.scrollIntoViewIfNeeded().catch(() => {});
await starSection.locator("button").first().click();
await sleep(1500);
const dialog = page.locator('[role="dialog"]');
must(await dialog.count() > 0, "B STAR dialog opens");

// ---------- B: alignment grammar on the real world ----------
const alignOf = (loc) => loc.evaluate((el) => getComputedStyle(el).textAlign);
const firstRow = dialog.locator("tbody tr").first();

must((await alignOf(firstRow.locator("td").nth(0))) === "right",
  "B the # index cell joins the numeric grammar (right)");
must((await alignOf(firstRow.locator("td").nth(1))) === "left",
  "B ImageName (string column) keeps the left edge");
must((await alignOf(firstRow.locator("td").nth(5))) === "right",
  "B AnglePsi (numeric column) right-aligns");
must((await alignOf(dialog.locator('th[title="_rlnImageName"]'))) === "left",
  "B the ImageName HEADER matches its column (left)");
must((await alignOf(dialog.locator('th[title="_rlnAnglePsi"]'))) === "right",
  "B the AnglePsi HEADER matches its column (right)");

// census-backed negative anchors: nothing truncates in the seeded world
must((await dialog.locator("tbody td[title]").count()) === 0,
  "B zero title attributes (widest demo cell is 44 chars, cap never fires)");
must((await dialog.getByText(/hover truncated cells/).count()) === 0,
  "B the footer hint is absent when nothing was cut (honest hint)");

// sorting still engages (regression, compact: one full cycle)
const headerBtn = dialog.locator('th[title="_rlnAnglePsi"] button');
await headerBtn.click();
await sleep(600);
must((await dialog.locator('th[aria-sort]').getAttribute("aria-sort")) === "ascending",
  "B sort still engages (aria-sort=ascending after click)");
must((await alignOf(firstRow.locator("td").nth(5))) === "right",
  "B alignment survives sorting (numeric stays right)");
await headerBtn.click(); await sleep(400);
await headerBtn.click(); await sleep(400); // back to native
must((await dialog.locator("tbody tr").first().locator("td").nth(1).innerText()).startsWith("0000001@"),
  "B native order returns intact after the cycle");

// ---------- C: the intercepted long-path world ----------
await page.keyboard.press("Escape");
await sleep(800);

const LONG = "Import/job001/Movies/20190628_00025_frame_0000_grandparent_directory/particles_stack_000123.mrcs";
must(LONG.length > 72, "C fixture value genuinely exceeds the cap", `${LONG.length} chars`);
const routePattern = `**/api/jobs/*/outputs/star*`;
await page.route(routePattern, async (r) => {
  await r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      columns: ["_rlnImageName", "_rlnClassNumber", "_rlnAngleRot", "_rlnAngleTilt", "_rlnAnglePsi"],
      rows: [
        [LONG, "1", "215.469", "60.396", "329.378"],
        ["0000002@extract_0extract/particles.mrcs", "2", "-31.882", "45.120", "7.945"],
      ],
      rowCount: 2,
      truncated: false,
    }),
  });
});

await starSection.locator("button").first().click();
await sleep(1500);
must(await dialog.count() > 0, "C dialog reopens against the intercepted lane");

const cRow = dialog.locator("tbody tr").first();
const cFirst = cRow.locator("td").nth(1);
const expectedVisible = LONG.slice(0, 72) + "…";
const cText = await cFirst.innerText();
must(cText === expectedVisible,
  "C the visible cell is the 72-char slice + ellipsis",
  `"${cText.slice(0, 20)}…(${cText.length})"`);
must((await cFirst.getAttribute("title")) === LONG,
  "C the FULL value rides in title (hover reveal)");
must((await cFirst.evaluate((el) => getComputedStyle(el).cursor)) === "help",
  "C the truncated cell offers a help cursor");
must((await dialog.getByText(/hover truncated cells/).count()) === 1,
  "C the footer hint appears when a cell was cut");
must((await cFirst.evaluate((el) => getComputedStyle(el).textAlign)) === "left",
  "C alignment grammar survives in the intercepted world (ImageName left)");
must((await cRow.locator("td").nth(5).evaluate((el) => getComputedStyle(el).textAlign)) === "right",
  "C numeric column still right-aligns (intercepted world)");
must((await dialog.locator("tbody tr").nth(1).locator("td").nth(1).evaluate((el) => getComputedStyle(el).cursor)) === "auto",
  "C untruncated cells do not pose as help");

await page.screenshot({ path: ".qa-logs/t652-star-shape.png" });
await page.unroute(routePattern);

// ---------- D: console hygiene ----------
must(consoleErrors.length === 0, "D zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

mkdirSync(".qa-logs", { recursive: true });
console.log(`t652-e2e: ${PASS} pass / ${FAIL} fail`);
try {
  writeFileSync("/tmp/cryoflow-qa/t652-verdict.json", JSON.stringify({ PASS, FAIL, longLen: LONG.length, cText }, null, 2));
} catch {}
await b.close();
process.exit(FAIL === 0 ? 0 : 1);

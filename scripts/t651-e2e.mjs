// t651 — the STAR table becomes operable: numeric-aware three-state
// column sort + aria-sort contract + server-side full TSV export.
//
// Probe contract:
//   A  API — the JSON lane keeps its preview semantics (rows=100,
//      truncated flag), the export lane returns the FULL loop block
//      (241 lines = header + 240 rows for the fixture), tab-separated,
//      original _rln header names, attachment disposition with a
//      sanitized filename, no-store.
//   B  UI — the real path (roster row → job panel Results tab → STAR
//      card → dialog): headers are buttons, three-state cycle works
//      (asc → desc → native), aria-sort tracks the direction, the
//      native order returns intact (first row = the file's first
//      particle), the footer sort note appears and disappears, and the
//      export link carries ?export=tsv + the download attribute.
//   C  console hygiene.
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
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(300);
  }
};

// ---------- A: API ----------
{
  const hdrs = { "Origin": BASE, "Referer": `${BASE}/` };
  const json = await (await fetch(`${BASE}/api/jobs/${JOB}/outputs/star?path=${STAR_PATH}&rows=100`, { headers: hdrs })).json();
  must(json.columns?.length === 5 && json.rows?.length === 100 && json.rowCount === 240 && json.truncated === true,
    "A JSON lane keeps preview semantics (100 of 240, truncated)",
    `rows ${json.rows?.length}/${json.rowCount}`);

  const exp = await fetch(`${BASE}/api/jobs/${JOB}/outputs/star?path=${STAR_PATH}&export=tsv`, { headers: hdrs });
  const text = await exp.text();
  const lines = text.trimEnd().split("\n");
  must(exp.headers.get("content-type")?.includes("text/tab-separated-values"),
    "A export content-type is TSV", exp.headers.get("content-type"));
  must(/attachment; filename="run_it012_data\.tsv"/.test(exp.headers.get("content-disposition") ?? ""),
    "A export disposition attaches a sanitized filename", exp.headers.get("content-disposition"));
  must(exp.headers.get("cache-control") === "no-store", "A export is no-store");
  must(lines.length === 241, "A export carries the FULL loop block (241 = 1 header + 240 rows)", `${lines.length} lines`);
  must(lines[0].startsWith("_rlnImageName\t_rlnClassNumber"), "A header row keeps the original _rln names", lines[0].slice(0, 60));
  must(lines[1].startsWith("0000001@"), "A first data row is the file's native first particle");
}

// ---------- B: UI ----------
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// the project dashboard view (canvas cards of two seeded workspaces
// overlap — the dashboard's roster rows are the collision-free path);
// the header switcher is the semantic door (title = Shift+D toggle)
await page.locator('[role="tab"][title^="Project dashboard"]').click();
await sleep(1200);
const row = page.locator('[data-roster-row]', { hasText: "2D classification" }).first();
let found = false;
for (let i = 0; i < 10 && !found; i++) {
  if (await row.count() > 0 && await row.isVisible()) { found = true; break; }
  await sleep(1000);
}
must(found, "B dashboard roster row for 2D classification found (post-flip polling)");
await row.locator('button[title^="Open 2D classification"]').click();
await sleep(1500);

// job panel → Results tab
const resultsTab = page.locator('[role="tab"]', { hasText: /^Results$/ }).first();
must(await resultsTab.count() > 0, "B job panel Results tab exists");
await resultsTab.click();
await sleep(1500);

// STAR tables section → first card
const starSection = page.locator('section[aria-label="STAR tables"]');
await starSection.scrollIntoViewIfNeeded().catch(() => {});
const starCard = starSection.locator("button").first();
must(await starCard.count() > 0, "B STAR table card present in results");
await starCard.click();
await sleep(1500);

const dialog = page.locator('[role="dialog"]');
must(await dialog.count() > 0, "B STAR dialog opens");

// headers are buttons (keyboard operable) — the dialog's table hydrates
// after open, and under memory pressure that outlives any fixed sleep
// (three flap convictions across two windows); the poll is the honest form
// of "the button EXISTS", not "it exists within 1.5 s"
const headerBtn = dialog.locator('thead th[title="_rlnAnglePsi"] button');
const headerUp = await pollUntil(async () => (await headerBtn.count()) === 1 || null, 10000);
must(!!headerUp, "B the AnglePsi header is a button (keyboard reachable)");

const firstCellText = () => dialog.locator("tbody tr").first().locator("td").nth(1).innerText();
const ariaSortOf = () => dialog.locator('th[aria-sort]').getAttribute("aria-sort");
const sortNote = () => dialog.getByText(/sorted by/).count();

const nativeFirst = await firstCellText();
must(nativeFirst.startsWith("0000001@"), "B native order shows the file's first particle", nativeFirst.slice(0, 24));

// click 1 → ascending
await headerBtn.click();
await sleep(600);
must((await ariaSortOf()) === "ascending", "B aria-sort=ascending after first click");
const ascFirst = await firstCellText();
const sortNoteAsc = await sortNote();
must(sortNoteAsc === 1, "B footer sort note appears (asc)");

// click 2 → descending, first-row value flips the comparison
await headerBtn.click();
await sleep(600);
must((await ariaSortOf()) === "descending", "B aria-sort=descending after second click");
const descFirst = await firstCellText();
must(ascFirst !== descFirst, "B the top row actually changes between asc and desc", `${ascFirst.slice(0, 12)} → ${descFirst.slice(0, 12)}`);

// click 3 → back to native: aria-sort gone, first row restored
await headerBtn.click();
await sleep(600);
must((await dialog.locator('th[aria-sort]').count()) === 0, "B aria-sort retires after the third click (native)");
must((await firstCellText()) === nativeFirst, "B the native first particle returns intact");

// export link
const exportLink = dialog.locator('a[download][href*="export=tsv"]');
must(await exportLink.count() === 1, "B export link carries ?export=tsv + download attribute");
const href = await exportLink.getAttribute("href");
must(href?.includes(`path=${encodeURIComponent(STAR_PATH)}`), "B export href addresses this STAR file");

// C — console hygiene
must(consoleErrors.length === 0, "C zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t651-star-sort.png" });
console.log(`t651-e2e: ${PASS} pass / ${FAIL} fail`);
try {
  writeFileSync("/tmp/cryoflow-qa/t651-verdict.json", JSON.stringify({ PASS, FAIL, nativeFirst, ascFirst, descFirst }, null, 2));
} catch {}
await b.close();
process.exit(FAIL === 0 ? 0 : 1);

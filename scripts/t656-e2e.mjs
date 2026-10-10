// t656 — the index column learns to STAY. t652 shelved the sticky #
// column on a real design blocker (translucent zebra rows would bleed
// scrolled columns through a translucent sticky cell); t656 pays it:
// the sticky cell paints its own OPAQUE row color (color-mix composed
// over the dialog surface, theme-aware), the corner header sticks both
// ways, and # shows the row's NATIVE file index — under a sort the
// pinned column becomes the visible map of the scramble.
//
// Probe contract (real world, nothing planted):
//   A  anatomy — corner th sticky both ways above siblings; body # cell
//      sticky with an OPAQUE computed background (alpha 1 — the t652
//      blocker's tombstone); hairline gutter on the pinned cells.
//   B  physics — the table genuinely overflows horizontally; scrolling
//      right moves the data columns while the # cell stays pinned at
//      the container's left edge, its text intact.
//   C  scramble map — sorting reorders rows while # keeps the file's
//      record number: asc first-display-row # ≠ 1, native cycle back →
//      # = 1 again.
//   D  hover face — hovering a row repaints the sticky cell too (the
//      group-hover composed color), no dead stripe.
//   E  console hygiene + 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// the t651 semantic door: dashboard roster row → job panel → Results tab.
// t656 — the probe targets the POST-PROCESSING job: its postprocess.star
// carries four 44-char FSC column headers (whitespace-nowrap) — the one
// canonical file that genuinely overflows the dialog, i.e. the one where
// a pinned index column has a job to do. Cards are tried in order until
// the overflow is found (the selector comes from reality, not hope).
await page.locator('[role="tab"][title^="Project dashboard"]').click();
await sleep(1200);
const row = page.locator('[data-roster-row]', { hasText: "Post-processing" }).first();
let found = false;
for (let i = 0; i < 10 && !found; i++) {
  if (await row.count() > 0 && await row.isVisible()) { found = true; break; }
  await sleep(1000);
}
must(found, "B dashboard roster row for Post-processing found");
await row.locator('button[title^="Open Post-processing"]').click();
await sleep(1500);
await page.locator('[role="tab"]', { hasText: /^Results$/ }).first().click();
await sleep(1500);
const starSection = page.locator('section[aria-label="STAR tables"]');
await starSection.scrollIntoViewIfNeeded().catch(() => {});
const starCards = starSection.locator("button");
must((await starCards.count()) > 0, "B STAR table cards present in results");

let dialog = page.locator("[role='dialog']");
let scroller = dialog.locator("div.max-h-96");
let opened = false;
const nCards = await starCards.count();
for (let i = 0; i < nCards && !opened; i++) {
  await starCards.nth(i).click();
  await sleep(1200);
  if ((await dialog.count()) === 0) continue;
  scroller = dialog.locator("div.max-h-96");
  const geo = await scroller.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth })).catch(() => null);
  if (geo && geo.sw > geo.cw) { opened = true; break; }
  await page.keyboard.press("Escape");
  await sleep(600);
}
must(opened, "B a STAR file that overflows horizontally is on the table (real pin territory)");
const idxCells = dialog.locator('[data-star-idx-cell]');
const firstIdx = idxCells.first();

// --- A: anatomy ---
{
  const th = dialog.locator("thead th").first();
  const cs = await th.evaluate((el) => {
    const s = getComputedStyle(el);
    return { pos: s.position, left: s.left, z: s.zIndex, br: s.borderRightWidth };
  });
  must(cs.pos === "sticky" && cs.left === "0px" && Number(cs.z) >= 30,
    "A corner header sticks both ways, above its siblings", JSON.stringify(cs));
  const tds = await firstIdx.evaluate((el) => {
    const s = getComputedStyle(el);
    const c = s.backgroundColor.match(/rgba?\(([^)]+)\)/) ?? [];
    const parts = c[1]?.split(",").map(Number) ?? [];
    const alpha = parts.length === 4 ? parts[3] : 1;
    return { pos: s.position, left: s.left, alpha, br: s.borderRightWidth };
  });
  must(tds.pos === "sticky" && tds.left === "0px",
    "A body # cell is position-sticky left", JSON.stringify(tds));
  must(tds.alpha === 1,
    "A the sticky cell's background is OPAQUE (t652's blocker paid)", `alpha=${tds.alpha}`);
  must(Number(tds.br.replace("px", "")) > 0, "A a hairline gutter rides the pinned column");
}

// --- B: physics — overflow is real, the pin holds ---
{
  const geo = await scroller.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  must(geo.sw > geo.cw, "B the table genuinely overflows horizontally", `${geo.sw} > ${geo.cw}`);
  const before = await firstIdx.evaluate((el) => el.getBoundingClientRect().x);
  const dataCellBefore = await dialog.locator("tbody tr").first().locator("td").nth(1).evaluate((el) => el.getBoundingClientRect().x);
  await scroller.evaluate((el) => { el.scrollLeft = 300; });
  await sleep(400);
  const after = await firstIdx.evaluate((el) => el.getBoundingClientRect().x);
  const dataCellAfter = await dialog.locator("tbody tr").first().locator("td").nth(1).evaluate((el) => el.getBoundingClientRect().x);
  must(Math.abs(after - before) < 2, "B the # cell stays pinned while the scroll moves", `dx=${(after - before).toFixed(1)}px`);
  must(dataCellAfter < dataCellBefore - 100, "B the data columns actually moved under it", `dx=${(dataCellAfter - dataCellBefore).toFixed(1)}px`);
  must((await firstIdx.innerText()).trim() === "1", "B the pinned number survives the scroll");
  await page.screenshot({ path: ".qa-logs/t656-sticky-scrolled.png" });
  await scroller.evaluate((el) => { el.scrollLeft = 0; });
  await sleep(300);
}

// --- C: the scramble map — sort while the identity stays ---
{
  // any numeric column will do; try both directions until a sort actually
  // moves a different record to the front (FSC tables ship ascending, so
  // desc is the expected scrambler — but the probe reads, it does not hope)
  const headerBtn = dialog.locator("thead th button").nth(2);
  const nativeIdx = async () => Number((await firstIdx.innerText()).trim());
  must((await nativeIdx()) === 1, "C native order: first display row is file record #1");
  let scrambled = false, tried = [];
  for (const clicks of [1, 2, 1, 2]) {
    await headerBtn.click(); await sleep(500);
    const idx = await nativeIdx();
    tried.push(idx);
    if (idx > 1 && idx <= 100) { scrambled = true; break; }
  }
  must(scrambled, "C a sort moves a DIFFERENT record's # to the pinned column", JSON.stringify(tried));
  // return to native: cycle until aria-sort retires (max 3 clicks)
  for (let i = 0; i < 3; i++) {
    if ((await dialog.locator("th[aria-sort]").count()) === 0) break;
    await headerBtn.click(); await sleep(450);
  }
  must((await dialog.locator("th[aria-sort]").count()) === 0, "C aria-sort retires (native again)");
  must((await nativeIdx()) === 1, "C native cycle returns record #1 to the top");
  await page.screenshot({ path: ".qa-logs/t656-scramble-map.png" });
}

// --- D: the hover face reaches the pinned cell ---
{
  const tr = dialog.locator("tbody tr").first();
  const bgOf = () => firstIdx.evaluate((el) => getComputedStyle(el).backgroundColor);
  const before = await bgOf();
  await tr.hover(); await sleep(300);
  const after = await bgOf();
  must(before !== after, "D hover repaints the sticky cell (group-hover composed color)", `${before} → ${after}`);
  await page.mouse.move(0, 0); await sleep(300);
}

// --- E: console hygiene ---
must(consoleErrors.length === 0, "E zero console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt656-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

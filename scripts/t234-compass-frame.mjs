/**
 * t234-compass-frame.mjs — the compass's own portrait.
 *
 * The compass is a SCREEN organ (P9: it never prints), so its lens is
 * the screen itself — no print emulation here (the tool follows the
 * medium, t231's lesson). The frame shows the map at the top of the
 * document it maps: the sticky strip with its nine chips (the md's
 * second surface) over the document's own first words.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const H = { "sec-fetch-site": "same-origin" };

const twinReceipt = execSync("python3 scripts/seed-twin.py", { encoding: "utf8" });
const twinId = (twinReceipt.match(/TWIN_READY id=(\S+)/) || [])[1];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.locator('button[aria-label="Session QC report"]').click();
await page.waitForTimeout(1800);
for (let i = 0; i < 24 && (await page.locator("[data-report-body] tr[data-owner-door]").count()) !== 3; i++)
  await page.waitForTimeout(500);
// the map and the document's opening share one frame: no scroll —
// this is where a reader FIRST meets the compass
await page.mouse.move(8, 8);
await page.waitForTimeout(300);
await page.locator("[data-report-doc]").first().screenshot({
  path: "scripts/shots-t223/t234-compass-2x.png", scale: "css",
});
// the compass IN USE: click the last chip — the needle rides to the
// tail (the last section can never reach the line; the tail law puts
// the needle there anyway) and the target section lands BELOW the map
const chips = page.locator("[data-report-toc] .report-compass-chip");
await chips.nth(await chips.count() - 1).click();
await page.waitForTimeout(1200);
await page.locator("[data-report-doc]").first().screenshot({
  path: "scripts/shots-t223/t234-compass-jump-2x.png", scale: "css",
});
// t235: the compass FOLLOWING — a HAND scroll into the document's deep
// middle (no click): the needle lands on a chip the map had scrolled
// OUT of its own viewport, and the strip slides it back just enough
// (nearest: the chip kisses the strip's right edge) — W8's eyeball
// form. Deliberately NOT the tail (the jump frame already owns the
// right-edge resting state): the deep middle is where following earns
// its keep, the needle walking while the reader never touches the map.
await page.evaluate(() => {
  const body = document.querySelector("[data-report-body]");
  body.scrollTop = 0;
});
await page.waitForTimeout(600);
await page.evaluate(() => {
  const body = document.querySelector("[data-report-body]");
  body.scrollTop = body.scrollHeight * 0.72;
});
await page.waitForTimeout(1200);
await page.locator("[data-report-doc]").first().screenshot({
  path: "scripts/shots-t223/t235-compass-follow-2x.png", scale: "css",
});
console.log("compass frames shot (opening + jump + follow)");
await browser.close();

await fetch(`${BASE}/api/jobs/${twinId}`, { method: "DELETE", headers: H });
const roster = await (await fetch(`${BASE}/api/jobs`, { headers: H })).json();
console.log(`roster back to ${roster.jobs.length}`);

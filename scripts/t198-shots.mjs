/* t198 shots — the address's portrait. Opens the deterministic world
 * (QA Refine3D → orthovol → 3D → slice on → adopt half1 + half2 → copy
 * report), takes the 2x panel portrait (two terrains + two weakest-
 * quarter chips + the pairwise chip + the four doors), dumps the
 * carrier's actual bytes to sample-local-report.md, then removes BOTH
 * overlays (world restitution — leaves nothing behind). */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t198";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
const orthoTile = page.locator('button[aria-label="Enlarge orthovol"]');
if (await orthoTile.isVisible().catch(() => false)) await orthoTile.click();
else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }
await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
// self-heal any restored tenancy (conditional Escape — t196's doctrine)
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
if (await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false)) {
  await page.keyboard.press("Escape");
}
await sleep(600);
// the report doors live in the profile panel — slice must be ON first
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) break;
}
// adopt the pair
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
await page.locator('[data-testid^="map-choice-"][title*="half1"]').click();
await sleep(3000);
if (!(await page.locator('[data-testid^="map-choice-"][title*="half2"]').isVisible().catch(() => false))) {
  await page.locator('button[aria-label^="Overlay maps"]').click();
  await sleep(1100);
}
await page.locator('[data-testid^="map-choice-"][title*="half2"]').click();
for (let k = 0; k < 15; k++) {
  await sleep(1000);
  if (await page.locator('[data-overlay-terrain*="half2"]').isVisible().catch(() => false)) break;
}
await sleep(800);
// speak the report into the carrier
await page.locator('button[aria-label="Copy profile QC report"]').click();
await sleep(900);
const md = await page.locator('div[data-csv-carrier="profile"]').getAttribute("data-md").catch(() => null);
if (md) writeFileSync(`${OUT}/sample-local-report.md`, md);

await page.screenshot({ path: `${OUT}/t198-panel-2x.png` });
// wider world for context
await page.screenshot({ path: `${OUT}/t198-viewer-2x.png`, fullPage: false }).catch(() => {});

// world restitution: remove BOTH overlays, close nothing else
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
if (await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false)) {
  await page.keyboard.press("Escape");
}
await browser.close();
console.log("t198 shots done:", OUT);

/* t195 shots — the report doors' portrait. Opens the deterministic world
 * (QA Refine3D → Enlarge orthovol → 3D → slice on → adopt half1 → copy
 * report), then takes the 2x portraits and dumps the CARRIER's actual
 * bytes to sample-qc-report.md (the shipped document, not a re-derivation).
 * Cleans up after itself: removes the overlay so the world returns. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t195";
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
for (let k = 0; k < 30; k++) {
  await sleep(2000);
  if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break;
}
await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
await page.keyboard.press("Escape");
await sleep(600);

await page.locator('button[aria-label="Toggle cross-section plane"]').click();
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) break;
}
// adopt half1 so the report speaks a comparison table
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
await page.locator('[data-testid^="map-choice-"][title*="half1"]').click();
await sleep(3500);
// export: copy report (arms data-md on the carrier)
await page.locator('button[aria-label="Copy profile QC report"]').click();
await sleep(900);
const md = await page.locator('div[data-csv-carrier="profile"]').getAttribute("data-md");
if (md) writeFileSync(`${OUT}/sample-qc-report.md`, md);

// portrait 1: the instrument panel — landscape + overlay line + four doors
const panel = page.locator("div.mt-2\\.5.space-y-1\\.5.rounded-lg.border.border-cyan-600\\/25").first();
if (await panel.isVisible().catch(() => false)) {
  await panel.screenshot({ path: `${OUT}/t195-panel-2x.png` }).catch(() => {});
}
// portrait 2: the whole viewer
await page.screenshot({ path: `${OUT}/t195-viewer-2x.png` }).catch(() => {});
console.log("shots done; md bytes:", md?.length ?? 0);

// cleanup: remove the overlay so the world returns to canonical
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
await page.locator('button[aria-label="Remove overlay run_it020_half1"]').click();
await sleep(1200);
await page.keyboard.press("Escape");
await sleep(400);
await browser.close();
console.log("world restored");

/* t193 portrait at 2x — two terrains, one plane: the main map's cyan
 * landscape with the half-map's color-matched line beneath it. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t193";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
await page.locator('button[aria-label="Enlarge orthovol"]').click({ timeout: 5000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }
await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
// self-heal any restored overlays
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
await page.keyboard.press("Escape");
await sleep(500);
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
for (let k = 0; k < 12; k++) { await sleep(1000); if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) break; }
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1000);
await page.locator('[data-testid^="map-choice-"][title*="half1"]').click();
await sleep(3500);
for (let k = 0; k < 8; k++) { if (await page.locator("[data-overlay-terrain]").isVisible().catch(() => false)) break; await sleep(900); }
await page.keyboard.press("Escape");
await sleep(700);
await page.screenshot({ path: `${OUT}/t193-overlay-terrain-2x.png` });
console.log("shot: t193-overlay-terrain-2x");
// cleanup: remove the overlay so the world stays as the probe found it
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(800);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
await page.keyboard.press("Escape");
await browser.close();
console.log("portrait complete");

/* t192 final portraits — the ninth-time-deferred dark portrait, taken for
 * real. 2x deviceScaleFactor. Before-shot (the wound) already archived from
 * recon; this takes: (1) the FIXED dark viewer, (2) the light viewer —
 * proof the fix never touched light mode, (3) the dark canvas at 2x. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t192";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

// deterministic dark
const lightBtn = page.locator('button[aria-label="Switch to light theme"]');
if (await lightBtn.isVisible().catch(() => false)) { await lightBtn.click(); await sleep(500); }
await page.locator('button[aria-label="Switch to dark theme"]').click();
await sleep(800);

// dark canvas 2x
await sleep(600);
await page.screenshot({ path: `${OUT}/t192-dark-canvas-2x.png` });
console.log("shot: t192-dark-canvas-2x");

// open the viewer (dark)
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d)) break; }
// slice instrument ON for the portrait
await page.locator('button[aria-label="Toggle cross-section plane"]').click().catch(() => {});
await sleep(2600);
await page.screenshot({ path: `${OUT}/t192-dark-viewer-2x.png` });
console.log("shot: t192-dark-viewer-2x");
await page.keyboard.press("Escape");
await sleep(900);

// light viewer — the fix must be invisible in light mode
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Switch to light theme");
  b?.click();
});
await sleep(1000);
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1500);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1300);
await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d)) break; }
await page.locator('button[aria-label="Toggle cross-section plane"]').click().catch(() => {});
await sleep(2600);
await page.screenshot({ path: `${OUT}/t192-light-viewer-2x.png` });
console.log("shot: t192-light-viewer-2x");
await browser.close();
console.log("portraits complete");

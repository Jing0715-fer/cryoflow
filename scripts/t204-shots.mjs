/* t204 shots — the door's own portrait: press half1's bracket, catch the
 * plane sitting at the band's centre with the bracket bright, the chip
 * visiting and the receipt naming the door — one frame, three instruments
 * in agreement. API-staged world (adopt both halves BEFORE the viewer
 * opens) + the full re-entry chain (t203's shots lesson). */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const OUT = "scripts/shots-t204";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { "sec-fetch-site": "same-origin" };

execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const darkBtn = page.locator('button[aria-label="Switch to dark theme"]');
if (await darkBtn.isVisible().catch(() => false)) { await darkBtn.click(); await sleep(900); }
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
const ot = page.locator('button[aria-label="Enlarge orthovol"]');
if (await ot.isVisible().catch(() => false)) await ot.click();
await sleep(1000);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }
await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});

// clear any server-side overlay session, then adopt BOTH halves up front
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
const popUp = async () => await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false);
if (await popUp()) { await sleep(250); if (await popUp()) await page.keyboard.press("Escape"); }
await sleep(600);
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
for (let k = 0; k < 12; k++) { await sleep(1000); if (await page.locator('svg[role="slider"]').isVisible().catch(() => false)) break; }
const adopt = async (title) => {
  await page.locator('button[aria-label^="Overlay maps"]').click();
  await sleep(1100);
  const btn = page.locator(`[data-testid^="map-choice-"][title*="${title}"]`);
  if (!(await btn.isVisible().catch(() => false))) {
    await page.locator('button[aria-label^="Overlay maps"]').click();
    await sleep(1100);
  }
  await btn.click();
  await sleep(3500);
};
await adopt("half1");
await adopt("half2");

// END -> 100% (no band hosts), then PRESS half1's bracket — the door's
// own product: plane at 63%, bracket bright, chip visiting, receipt up
const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
await strip.focus(); await sleep(300);
await strip.press("End"); await sleep(700);
const br1 = page.locator('[data-band-bracket="run_it020_half1"]');
const box = await br1.boundingBox();
await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2);
await page.mouse.down(); await page.mouse.up();
await sleep(900);
await page.screenshot({ path: `${OUT}/t204-panel-jump-2x.png` }).catch(() => {});
const chipRow = page.locator('div[data-local-row="1"]');
await chipRow.screenshot({ path: `${OUT}/t204-chip-row-2x.png` }).catch(() => {});
await page.screenshot({ path: `${OUT}/t204-viewer-2x.png`, fullPage: false }).catch(() => {});

// world back: remove overlays, close the stack
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
for (let k = 0; k < 3; k++) {
  if (!(await page.locator('[data-slot="dialog-overlay"][data-state="open"]').first().isVisible().catch(() => false))) break;
  await page.keyboard.press("Escape");
  await sleep(900);
}
await browser.close();
console.log("t204 shots done");

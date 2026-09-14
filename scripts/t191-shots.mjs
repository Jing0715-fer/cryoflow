/* t191 shots — the instrument speaks (focused slider ring) and leaves
 * (export buttons + receipt). 2x deviceScaleFactor portraits. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t191";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
for (let i = 0; i < 10; i++) {
  if (await page.locator("h1", { hasText: "Dashboard" }).isVisible().catch(() => false)) {
    await page.keyboard.press("Shift+KeyD");
    await sleep(2200);
  } else if (await page.locator(`[data-job="${host.id}"]`).first().isVisible().catch(() => false)) break;
  await sleep(1500);
}
await page.locator(`[data-job="${host.id}"]`).first().click({ timeout: 4000, force: true }).catch(() => {});
await sleep(1800);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1500);
for (let i = 0; i < 5; i++) {
  await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 2500 }).catch(() => {});
  await sleep(1200);
  const v3d = page.locator("button", { hasText: "View in 3D" });
  if (await v3d.isVisible().catch(() => false)) {
    await v3d.click();
    await sleep(1500);
    if (await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false)) break;
    for (let k = 0; k < 20; k++) {
      await sleep(2500);
      if (await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false)) break;
    }
    break;
  }
}
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
await sleep(700);
const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
for (let i = 0; i < 12; i++) {
  if (await strip.isVisible().catch(() => false)) break;
  await sleep(1000);
}

// portrait 1: keyboard focus ring + nudged playhead + export receipt
await strip.focus();
for (let i = 0; i < 4; i++) { await page.keyboard.press("ArrowRight"); await sleep(350); }
await page.locator('button[aria-label="Copy profile as CSV"]').click();
await sleep(700);
await page.screenshot({ path: `${OUT}/t191-keyboard-export.png` });

// portrait 2: XYZ ghost rows expanded (adopt-a-second-axis overview)
await page.locator('button[aria-label="Toggle all-axis landscapes"]').click();
await sleep(2500);
await page.screenshot({ path: `${OUT}/t191-ghosts.png` });

await browser.close();
console.log("t191 shots saved");

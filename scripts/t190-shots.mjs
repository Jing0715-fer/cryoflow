/* t190 shots — the scrub bar with all three axes' landscapes. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t190";
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
    break;
  }
}
const toggle = page.locator('button[aria-label="Toggle cross-section plane"]');
let open = false;
for (let i = 0; i < 24 && !open; i++) {
  open = await toggle.isVisible().catch(() => false);
  if (!open) await sleep(2500);
}
await toggle.click();
await sleep(700);
const strip = page.locator('svg[aria-label^="Density profile along the"]');
for (let i = 0; i < 12 && !(await strip.isVisible().catch(() => false)); i++) await sleep(1000);
// scrub to ~62% and expand the XYZ overviews
const box = await strip.boundingBox();
await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.62, box.y + box.height / 2, { steps: 10 });
await page.mouse.up();
await page.locator('button[aria-label="Toggle all-axis landscapes"]').click();
await sleep(1400);
const panel = page.locator('svg[aria-label^="Density profile along the"]').locator("xpath=ancestor::div[contains(@class,'space-y-1.5')]");
await panel.screenshot({ path: `${OUT}/t190-scrub-xyz.png` });
await page.screenshot({ path: `${OUT}/t190-viewer.png` });
console.log("shots saved");
await browser.close();

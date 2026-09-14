/* t189 shots — the slice panel with its density landscape. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t189";
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
// park the playhead on the blob's mountain (z≈0.75 where the bump lives)
const box = await strip.boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await sleep(800);
}
// crop the slice panel: from the sigma slider area down through the strip
const panel = page.locator('svg[aria-label^="Density profile along the"]').locator("xpath=ancestor::div[contains(@class,'space-y-1.5')]");
await panel.screenshot({ path: `${OUT}/t189-landscape.png` });
await page.screenshot({ path: `${OUT}/t189-viewer.png` });
console.log("shots saved");
await browser.close();

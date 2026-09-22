/* t192 dark recon 2 — the deep surfaces: results tab (class gallery),
 * Mol* 3D viewer, help popover, import-workflow + path-browser dialogs,
 * params-diff, pipeline script. Canvas-painted light patches (Mol* bg,
 * RELION PNGs) evade computed-style audits — these portraits get EYEBALLED. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t192";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
if (!isDark) {
  await page.locator('button[aria-label="Switch to dark theme"]').click();
  await sleep(800);
}
// focus a completed 2D classification-ish job with results: QA Class Select
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const sel = jobs.find((j) => j.name === "QA Class Select") ?? jobs.find((j) => j.status === "completed");
await page.locator(`[data-job="${sel.id}"]`).first().click({ force: true });
await sleep(1500);

// results tab → class gallery
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(2200);
await page.screenshot({ path: `${OUT}/dark-results-gallery.png` });
console.log("shot: dark-results-gallery");

// help popover (header ? button)
await page.keyboard.press("Escape");
await sleep(500);
await page.locator('button[aria-label^="Help"]').first().click().catch(() => {});
await sleep(900);
await page.screenshot({ path: `${OUT}/dark-help-popover.png` });
console.log("shot: dark-help-popover");
await page.keyboard.press("Escape");
await sleep(400);

// import workflow dialog — via command palette (import command)
await page.keyboard.press("Control+k");
await sleep(800);
await page.keyboard.type("import");
await sleep(700);
await page.screenshot({ path: `${OUT}/dark-palette-import.png` });
console.log("shot: dark-palette-import");

// pipeline script dialog — via inspector if reachable, else palette "script"
await page.keyboard.press("Escape");
await sleep(400);
const scriptBtn = page.locator('button[aria-label*="script" i], button[aria-label*="Script" i]').first();
const viaInspector = await scriptBtn.isVisible().catch(() => false);
if (viaInspector) {
  await scriptBtn.click();
  await sleep(1300);
  await page.screenshot({ path: `${OUT}/dark-pipeline-script.png` });
  console.log("shot: dark-pipeline-script");
  await page.keyboard.press("Escape");
} else {
  console.log("pipeline script: no reachable door this pass");
}

// Mol* 3D viewer — from results of QA Refine3D with a volume (qa67 seeder)
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const host = jobs.find((j) => j.name === "QA Refine3D");
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1500);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1500);
await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1200);
const v3d = page.locator("button", { hasText: "View in 3D" });
if (await v3d.isVisible().catch(() => false)) {
  await v3d.click();
  await sleep(2000);
  for (let k = 0; k < 24; k++) {
    if (await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false)) break;
    await sleep(2500);
  }
  // turn ON the cross-section so the slice instrument is in the dark portrait too
  await page.locator('button[aria-label="Toggle cross-section plane"]').click().catch(() => {});
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/dark-molstar-viewer.png` });
  console.log("shot: dark-molstar-viewer");
  await page.keyboard.press("Escape");
} else {
  console.log("molstar: View in 3D not reachable this pass");
}

writeFileSync("/tmp/t192-recon2-done", "1");
await browser.close();
console.log("recon2 complete");

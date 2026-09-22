/* t188 shots 2 — zoomed crops: export header + receipt note (readable). */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t188";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const doorJob = jobs.filter((j) => j.status === "idle").sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
const dHpc = page.locator('button[aria-label="Generate Slurm sbatch script for this job"]').first();
for (let i = 0; i < 6; i++) {
  try { await page.locator(`[data-job="${doorJob.id}"]`).first().click({ timeout: 2500, force: i >= 3 }); } catch {}
  await sleep(1300);
  if (await dHpc.isVisible().catch(() => false)) break;
}
await dHpc.click();
await sleep(1400);
await page.locator('button[aria-label="Run queue simulation"]').click();
await sleep(1500);
await page.locator('button[aria-label="Compare cluster profiles"]').click();
await sleep(3000);
await page.locator('button[aria-label="Download comparison as CSV"]').click();
await sleep(800);

const comp = page.locator('[aria-label="Profile comparison"]');
await comp.screenshot({ path: `${OUT}/t188-comparison-receipt.png` });
const note = page.locator('[aria-label="Export status"]');
console.log("note visible:", await note.isVisible(), "| text:", (await note.textContent())?.trim().slice(0, 48));
await browser.close();

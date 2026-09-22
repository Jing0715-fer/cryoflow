/* t194 archive — dump the actual report bytes (data-md) as a sample .md */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t194";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2000);
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
await page.locator('button[aria-label="Download comparison as Markdown"]').click();
await sleep(800);
const md = await page.locator('[aria-label="Profile comparison"]').getAttribute("data-md");
writeFileSync(`${OUT}/sample-report.md`, md ?? "EMPTY");
console.log("sample bytes:", md?.length);
await page.keyboard.press("Escape");
await browser.close();

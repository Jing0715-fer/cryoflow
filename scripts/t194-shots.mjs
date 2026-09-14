/* t194 shots — the comparison block with its four export doors (CSV ×2,
   Report ×2) and a Markdown receipt in the note. 1x context + 2x portrait. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t194";
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
await page.locator('button[aria-label="Download comparison as Markdown"]').click();
await sleep(900);

const comp = page.locator('[aria-label="Profile comparison"]');
await comp.screenshot({ path: `${OUT}/t194-report-doors-2x.png` });
const note = page.locator('[aria-label="Export status"]');
console.log("note visible:", await note.isVisible(), "| text:", (await note.textContent())?.trim().slice(0, 60));

// world restored — the report is retired, the race is cleaned up
await page.keyboard.press("Escape");
await sleep(600);
await browser.close();
console.log("shots archived:", OUT);

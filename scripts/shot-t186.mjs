/* t186 beauty shots — the queue-simulation panel, collapsed and running. */
import { mkdirSync } from "fs";
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = "scripts/shots-t186";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const door = jobs.filter((j) => j.status === "idle").sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];

const hpc = page.locator('button[aria-label="Generate Slurm sbatch script for this job"]').first();
for (let i = 0; i < 6 && !(await hpc.isVisible().catch(() => false)); i++) {
  try { await page.locator(`[data-job="${door.id}"]`).first().click({ timeout: 2500, force: i >= 3 }); } catch {}
  await sleep(1300);
}
await hpc.click();
await sleep(1500);
await page.screenshot({ path: path.join(OUT, "t186-panel-collapsed.png") });

await page.locator('button[aria-label="Run queue simulation"]').click();
await sleep(1800);
// scroll the section into view for the full Gantt in frame
await page.locator('[aria-label="Simulation KPIs"]').scrollIntoViewIfNeeded().catch(() => {});
await sleep(400);
await page.screenshot({ path: path.join(OUT, "t186-panel-gantt.png") });

console.log("console errors:", errors.length, errors.slice(0, 3));
await browser.close();

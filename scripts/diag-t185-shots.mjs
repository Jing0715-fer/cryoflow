import { mkdirSync } from "fs";
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync("scripts/shots-t185", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const door = list.filter((j) => j.status === "idle").sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];

const hpc = page.locator('button[aria-label="Generate Slurm sbatch script for this job"]').first();
for (let i = 0; i < 6; i++) {
  try { await page.locator(`[data-job="${door.id}"]`).first().click({ timeout: 2500 }); } catch {}
  await sleep(1300);
  if (await hpc.isVisible().catch(() => false)) break;
}
await hpc.click();
await sleep(1500);
await page.screenshot({ path: "scripts/shots-t185/t185-sbatch-dialog.png" });

await page.locator('button[aria-label="Manage cluster profiles"]').click();
await sleep(1500);
await page.screenshot({ path: "scripts/shots-t185/t185-editor.png" });

// dirty state + flash states already probed; here capture the rail + form face
console.log("shots saved; console errors:", errs.length, errs.slice(0, 3));
await browser.close();

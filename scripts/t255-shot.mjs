// t255 shot — the send moment: clip ON, the send button, the note, and the
// new Import Map card beside its parent on the canvas.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);

const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
const host = jobs.jobs.find((j) => j.name === "QA Refine3D");

await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
const orthoTileBtn = page.locator('button[aria-label="Enlarge orthovol"]');
if (await orthoTileBtn.isVisible().catch(() => false)) await orthoTileBtn.click();
else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) {
  await sleep(2000);
  if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break;
}
const clipBtn = page.locator('button[aria-label="Toggle box clipping"]');
for (let k = 0; k < 9; k++) { if (await clipBtn.isVisible().catch(() => false)) break; await sleep(5000); }
await clipBtn.click();
await sleep(600);
const zSlider = page.locator('[role="slider"][aria-label="Clip position along the Z axis"]');
await zSlider.focus();
await page.keyboard.press("Home");
await sleep(120);
for (let i = 0; i < 18; i++) await page.keyboard.press("ArrowRight");
await sleep(700);

await page.locator('[data-testid="clip-send-job"]').click();
const note = page.locator('[data-testid="clip-send-note"]');
await note.waitFor({ state: "visible", timeout: 10000 });
await sleep(300);
await page.screenshot({ path: path.join(SHOTS, "t255-send-to-job-note-2x.png") });

// the canvas moment: close the viewer, find the new card beside its parent
await page.keyboard.press("Escape");
await sleep(800);
await page.keyboard.press("Escape");
await sleep(1500);
await page.screenshot({ path: path.join(SHOTS, "t255-send-to-job-canvas-2x.png") });

// cleanup: remove the probe job + crop so the world stays 21
const jobs2 = await (await fetch(`${BASE}/api/jobs`)).json();
for (const j of (jobs2.jobs ?? []).filter((x) => x.type === "mapimport")) {
  await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" });
}
const st = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
const wd = st[host.id]?.workdir;
if (wd && existsSync(path.join(wd, "SubVolumes"))) {
  rmSync(path.join(wd, "SubVolumes"), { recursive: true, force: true });
}
const jobs3 = await (await fetch(`${BASE}/api/jobs`)).json();
console.log("roster after cleanup:", jobs3.jobs.length);
await browser.close();
console.log("shots saved");

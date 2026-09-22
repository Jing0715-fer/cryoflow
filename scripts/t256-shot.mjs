// t256 shot — the identity card moment: an Import Map job opened on its
// Results tab, the teal card telling the map's whole story — file name,
// grid, voxel spacing, density stats, the sub-volume anchor inside its
// parent, and the "sent from the 3D viewer" provenance line.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

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
const st = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
const wd = st[host.id]?.workdir;

// crop OFF the origin so the anchor reads (16, 16, 0) on the card
const send = await page.evaluate(async ({ hostId }) => {
  const r = await fetch(`/api/jobs/${hostId}/outputs/subvolume-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "orthovol.mrc", x0: 0.25, x1: 0.75, y0: 0.25, y1: 0.75, z0: 0, z1: 0.2 }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}, { hostId: host.id });
if (send.status !== 201) {
  console.error("send failed:", send.status);
  await browser.close();
  process.exit(1);
}
const newJobId = send.body.job.id;

// run it — engine-native, synchronous (an Idle job's Results tab says
// "No results yet"; the card earns its stage after the run)
const run = await page.evaluate(async (id) => {
  const r = await fetch(`/api/jobs/${id}/run`, { method: "POST" });
  return r.status;
}, newJobId);
if (run !== 200 && run !== 201) {
  console.error("run failed:", run);
  await browser.close();
  process.exit(1);
}
await sleep(600);

// open the new card's Results tab — the identity card is the star
await page.locator(`[data-job="${newJobId}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1500);
const card = page.locator('[data-canvas-ui="map-identity"]');
if (!(await card.isVisible().catch(() => false))) {
  console.error("identity card not visible");
}
await page.screenshot({ path: path.join(SHOTS, "t256-map-identity-card-2x.png") });

// cleanup: the probe job + its crop leave, the world returns to 21
await fetch(`${BASE}/api/jobs/${newJobId}`, { method: "DELETE" });
if (wd && existsSync(path.join(wd, "SubVolumes"))) {
  rmSync(path.join(wd, "SubVolumes"), { recursive: true, force: true });
}
const jobs3 = await (await fetch(`${BASE}/api/jobs`)).json();
console.log("roster after cleanup:", jobs3.jobs.length);
await browser.close();
console.log("shot saved");

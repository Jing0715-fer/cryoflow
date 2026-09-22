/* t200 shots — the contour's portrait. Opens the deterministic world the
 * same door chain the probe walks (seed → QA Refine3D → orthovol → 3D →
 * slice on → API-staged half1+half2 tenancy → reopen → slice re-arm),
 * then takes the 2x panel portrait (two terrains + two weakest-quarter
 * chips, each wearing its sliding-window r sparkline) and a CLOSE-UP of
 * the chip row itself (the contour detail: dashed r=0, red negative
 * shading, and half2's honest gap where its head is flat). World
 * restitution: the staged tenancy is emptied server-side. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t200";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H2 = { "sec-fetch-site": "same-origin", "content-type": "application/json" };

execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
const stage = (paths) => fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, {
  method: "PUT", headers: H2,
  body: JSON.stringify({
    mode: "replace",
    entries: paths.map((p, i) => ({ path: p, name: p, color: i === 0 ? "#22d3ee" : "#a78bfa", alpha: 1, sigmaOffset: 0 })),
    removedPaths: [],
  }),
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
const orthoTile = page.locator('button[aria-label="Enlarge orthovol"]');
if (await orthoTile.isVisible().catch(() => false)) await orthoTile.click();
else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }

// API-staged world (the probe's doctrine): adopt half1+half2 through the
// overlay-session API, then reopen so the viewer RESTORES the tenancy
await stage([]);
await stage(["run_it020_half1.mrc", "run_it020_half2.mrc"]);
await page.keyboard.press("Escape").catch(() => {});
await sleep(1200);
await page.locator('button[aria-label="Enlarge orthovol"]').click().catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }
// the profile panel (and its chips) renders only while the slice is ON
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) break;
}
for (let k = 0; k < 20; k++) {
  if (await page.locator('[data-r-profile="run_it020_half2"]').isVisible().catch(() => false)) break;
  await sleep(1000);
}
await sleep(800);

await page.screenshot({ path: `${OUT}/t200-panel-2x.png` });
const row = page.locator('div[data-local-row="1"]');
if (await row.isVisible().catch(() => false)) {
  await row.screenshot({ path: `${OUT}/t200-chip-row-2x.png` });
}

// world restitution: the staged tenancy is emptied server-side
await stage([]);
const sess = await (await fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, { headers: H2 })).json();
await browser.close();
console.log(`t200 shots done: ${OUT} (session entries after restitution: ${(sess.entries ?? []).length})`);

/* t203 shots — the territory's portrait. Opens the deterministic world
 * (seed → QA Refine3D → orthovol → 3D → slice on → API-staged half1+half2
 * tenancy → reopen → slice re-arm), CLICKS half1's chip (the door), then
 * takes the 2x panel portrait (plane at 63%, half1's bracket BRIGHT inside
 * its own territory, half2's resting) and a strip close-up. Then Home
 * (0%) — the OTHER frame: half2's violet bracket bright, half1's resting.
 * World restitution: the staged tenancy is emptied server-side. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t203";
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
// dark room (the canonical portrait)
const darkBtn = page.locator('button[aria-label="Switch to dark theme"]');
if (await darkBtn.isVisible().catch(() => false)) { await darkBtn.click(); await sleep(900); }
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

await stage([]);
await stage(["run_it020_half1.mrc", "run_it020_half2.mrc"]);
// drain the dialog stack and re-walk the FULL door chain (job → Results →
// enlarge → 3D) so the viewer RESTORES the tenancy — a partial re-entry
// (enlarge without re-selecting) races the exited dialog's ghosts
for (let k = 0; k < 3; k++) {
  if (!(await page.locator('[data-slot="dialog-overlay"][data-state="open"]').first().isVisible().catch(() => false))) break;
  await page.keyboard.press("Escape");
  await sleep(900);
}
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
await page.locator('button[aria-label="Enlarge orthovol"]').click().catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) break;
}
for (let k = 0; k < 20; k++) {
  if (await page.locator('[data-band-bracket="run_it020_half2"]').isVisible().catch(() => false)) break;
  await sleep(1000);
}
await sleep(800);

// frame 1: the door's product — jump to half1's centre, its bracket bright
await page.locator('[data-local-chip="run_it020_half1"]').click();
await sleep(900);
await page.screenshot({ path: `${OUT}/t203-panel-jump-2x.png` });
const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
await strip.screenshot({ path: `${OUT}/t203-strip-half1-2x.png` }).catch(() => {});

// frame 2: the other territory — Home puts the plane inside half2's Q1
await strip.focus(); await sleep(250);
await strip.press("Home"); await sleep(800);
await strip.screenshot({ path: `${OUT}/t203-strip-half2-2x.png` }).catch(() => {});
await page.screenshot({ path: `${OUT}/t203-panel-home-2x.png` });

// world restitution: the staged tenancy is emptied server-side
await stage([]);
const sess = await (await fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, { headers: H2 })).json();
await browser.close();
console.log(`t203 shots done: ${OUT} (session entries after restitution: ${(sess.entries ?? []).length})`);

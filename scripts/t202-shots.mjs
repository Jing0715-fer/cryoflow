/* t202 shots — the door's portrait. Opens the deterministic world the
 * same door chain the probe walks (seed → QA Refine3D → orthovol → 3D →
 * slice on → API-staged half1+half2 tenancy → reopen → slice re-arm),
 * CLICKS half1's weakest-quarter chip (the t202 door: the plane obeys the
 * address, the receipt speaks the jump), then takes the 2x panel portrait
 * with the receipt visible and a CLOSE-UP of the chip row (the buttons —
 * sparkline + address in one door). Light room: the census shot (solid
 * --ring focus ring on the strip). World restitution: the staged tenancy
 * is emptied server-side. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t202";
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

// THE DOOR: click half1's chip — the plane jumps to the betrayal's centre
// and the receipt names the address
const chip1 = page.locator('[data-local-chip="run_it020_half1"]');
await chip1.click();
let receiptUp = false;
for (let k = 0; k < 12; k++) {
  await sleep(300);
  if ((await page.locator('div[role="status"][aria-label="Profile export status"]').textContent().catch(() => "") ?? "").includes("Plane moved to")) { receiptUp = true; break; }
}
console.log("receipt visible:", receiptUp);

await page.screenshot({ path: `${OUT}/t202-panel-2x.png` });
const row = page.locator('div[data-local-row="1"]');
if (await row.isVisible().catch(() => false)) {
  await row.screenshot({ path: `${OUT}/t202-chip-row-2x.png` });
}

// light room: the census portrait — focus the strip so the solid --ring
// shows, then capture the full viewer. Drain the dialog stack first (the
// enlarge dialog's overlay intercepts the header's theme button).
const lightBtn = page.locator('button[aria-label="Switch to light theme"]');
for (let k = 0; k < 3; k++) {
  if (!(await page.locator('[data-slot="dialog-overlay"][data-state="open"]').first().isVisible().catch(() => false))) break;
  await page.keyboard.press("Escape");
  await sleep(900);
}
await sleep(300);
if (await lightBtn.isVisible().catch(() => false)) { await lightBtn.click(); await sleep(900); }
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1500);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1300);
const ot2 = page.locator('button[aria-label="Enlarge orthovol"]');
if (await ot2.isVisible().catch(() => false)) await ot2.click();
await sleep(1000);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) break;
}
const stripL = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
await stripL.focus(); await sleep(300);
await stripL.press("Home"); await sleep(600);
await page.screenshot({ path: `${OUT}/t202-light-ring-2x.png` });

// world restitution: the staged tenancy is emptied server-side
await stage([]);
const sess = await (await fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, { headers: H2 })).json();
await browser.close();
console.log(`t202 shots done: ${OUT} (session entries after restitution: ${(sess.entries ?? []).length})`);

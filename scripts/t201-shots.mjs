/* t201 shots — the affordances' portraits. Opens the deterministic QA
 * world (seed → QA Refine3D → orthovol → View in 3D, dark room via the
 * app's own switch) and takes:
 *   t201-toolbar-stack-2x.png  the top-right corner: the app toolbar row
 *                              AND the full Mol* stack BELOW it — Reset
 *                              Zoom unburied, both rows fully visible
 *   t201-hover-2x.png          the pointer resting on Screenshot — the
 *                              chip lit (accent bg, cyan ink, hairline)
 *   t201-focus-ring-2x.png     keyboard focus (Tab) on Reset Zoom — the
 *                              solid accent outline the keyboard owns
 *   t201-dark-viewer-2x.png    the full dark panorama
 *   t201-light-viewer-2x.png   the light panorama — unbury holds in both
 *                              rooms (the layout fix's room-agnosticism) */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t201";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H2 = { "sec-fetch-site": "same-origin", "content-type": "application/json" };

execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
// world restitution: make sure no stale overlay tenancy decorates the shot
const jobs0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host0 = jobs0.find((j) => j.name === "QA Refine3D");
if (host0) await fetch(`${BASE}/api/jobs/${host0.id}/overlay-session`, { method: "PUT", headers: H2, body: JSON.stringify({ mode: "replace", entries: [], removedPaths: [] }) }).catch(() => {});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });

const openViewer = async () => {
  await page.locator(`[data-job="${host0?.id ?? (jobs0.find((j) => j.name === "QA Refine3D"))?.id}"]`).first().click({ force: true });
  await sleep(1600);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const orthoTile = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await orthoTile.isVisible().catch(() => false)) await orthoTile.click();
  else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(1100);
  await page.locator("button", { hasText: "View in 3D" }).click();
  for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) return true; }
  return false;
};

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const lightBtn = page.locator('button[aria-label="Switch to light theme"]');
if (await lightBtn.isVisible().catch(() => false)) { await lightBtn.click(); await sleep(500); }
await page.locator('button[aria-label="Switch to dark theme"]').click();
await sleep(900);

if (!(await openViewer())) { console.error("viewer failed to open"); process.exit(1); }
await sleep(1500);

// the corner: app toolbar row + the unburied stack
await page.screenshot({ path: `${OUT}/t201-toolbar-stack-2x.png`, clip: { x: 1000, y: 96, width: 440, height: 420 } }).catch(() => {});

// hover portrait: pointer on Screenshot
const shot = page.locator('.msp-viewport-controls-buttons button[title^="Screenshot"]');
{
  const r = await shot.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(r.x, r.y);
}
await sleep(450);
await page.screenshot({ path: `${OUT}/t201-hover-2x.png`, clip: { x: 1300, y: 140, width: 140, height: 320 } }).catch(() => {});
await page.mouse.move(4, 900);
await sleep(300);

// focus ring portrait: keyboard focus on Reset Zoom
const reset = page.locator('.msp-viewport-controls-buttons button[title="Reset Zoom"]');
await reset.focus().catch(() => {});
await sleep(200);
// programmatic focus does not always arm :focus-visible for buttons —
// press Shift+Tab then Tab to come back by the honest keyboard path
await page.keyboard.press("Shift+Tab");
await sleep(120);
for (let k = 0; k < 20; k++) {
  await page.keyboard.press("Tab");
  await sleep(80);
  const inStack = await page.evaluate(() => !!document.activeElement?.closest?.(".msp-viewport-controls-buttons"));
  if (inStack) break;
}
await sleep(250);
const ring = await page.evaluate(() => {
  const el = document.activeElement;
  return el?.closest(".msp-viewport-controls-buttons") ? getComputedStyle(el).outlineStyle : "not-in-stack";
});
console.log("focus ring state:", ring);
await page.screenshot({ path: `${OUT}/t201-focus-ring-2x.png`, clip: { x: 1300, y: 140, width: 140, height: 320 } }).catch(() => {});

await page.screenshot({ path: `${OUT}/t201-dark-viewer-2x.png` }).catch(() => {});

// light room: the unbury holds here too
await page.keyboard.press("Escape");
await sleep(900);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Switch to light theme");
  b?.click();
});
await sleep(1000);
if (await openViewer()) {
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/t201-light-viewer-2x.png` }).catch(() => {});
}
await browser.close();
console.log(`t201 shots done: ${OUT}`);

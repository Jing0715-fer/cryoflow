// probe-clip-scene — empirical A/B test of the Mol* clip machinery.
// Q1: does the SLIDER path (t253) actually cut the isosurface in the 3D
//     scene (not just the 2D echo / wireframe)?
// Q2: how many non-background pixels does Z=50% keep, and where?
// Opens the QA Refine3D host's orthovol.mrc via the gallery → image dialog
// → View in 3D path, screenshots the canvas before/after the clip, and
// counts non-background pixels per horizontal band.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none */ }
await sleep(400);

const jobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
if (!host) { console.log("no host"); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1500);
// open the map's image dialog → View in 3D
await page.locator('[data-canvas-ui="maps-gallery"] [data-canvas-ui^="gallery-tile"], [data-canvas-ui="maps-gallery"] img[alt*="orthovol"]').first().click({ timeout: 15_000 }).catch(async () => {
  // fallback: click the first gallery tile button
  await page.locator('[data-canvas-ui="maps-gallery"] button').first().click({ timeout: 15_000 });
});
await sleep(1200);
const dlg = page.locator('[role="dialog"]').last();
await dlg.locator('button:has-text("View in 3D")').first().click({ timeout: 10_000 });
await sleep(1000);
const vdlg = page.locator('[role="dialog"]').last();
await vdlg.locator("canvas").first().waitFor({ state: "visible", timeout: 20_000 });
await sleep(4000); // volume + surface settle

const grab = async (label) => {
  const buf = await page.screenshot();
  writeFileSync(`/home/z/my-project/shots-qa/probe-${label}.png`, buf);
  // count non-background pixels per horizontal band from the LIVE canvas
  return page.evaluate(() => {
    const c = document.querySelector('[role="dialog"]:last-of-type canvas');
    if (!c) return null;
    const w = c.width, h = c.height;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const ctx = off.getContext("2d");
    ctx.drawImage(c, 0, 0);
    const img = ctx.getImageData(0, 0, w, h).data;
    // background = the most common corner pixel
    const px = (x, y) => {
      const i = (y * w + x) * 4;
      return [img[i], img[i + 1], img[i + 2]];
    };
    const bg = px(4, 4);
    const isContent = (x, y) => {
      const [r, g, b] = px(x, y);
      return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 30;
    };
    let total = 0;
    const bands = [0, 0, 0, 0]; // quarters top→bottom
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        if (isContent(x, y)) {
          total++;
          bands[Math.min(3, Math.floor((y / h) * 4))]++;
        }
      }
    }
    return { total, bands, w, h };
  });
};

const A = await grab("a-plain");
console.log("A (no clip):", JSON.stringify(A));
await sleep(1500);
const A2 = await grab("a2-plain");
console.log("A2 (stability check):", JSON.stringify(A2), "stable:", Math.abs(A2.total - A.total) < 20);

// Clip ON via the toggle, then drive the Z slider to ~50% — t253's
// deterministic recipe: FOCUS the thumb (span[role=slider]), Home lands on
// min 0.02, ArrowRight steps 0.01. No clicking, no track geometry.
await vdlg.locator('button:has-text("Clip")').first().click();
await sleep(600);
const zSlider = vdlg.locator('[role="slider"][aria-label="Clip position along the Z axis"]');
await zSlider.focus();
await page.keyboard.press("Home");
await sleep(150);
for (let i = 0; i < 48; i++) { await page.keyboard.press("ArrowRight"); await sleep(12); }
await sleep(2500); // commitClip settles
console.log("z aria-valuenow:", await zSlider.getAttribute("aria-valuenow"));

const B = await grab("b-clip-z50");
console.log("B (clip Z 50%):", JSON.stringify(B));
console.log("ratio B/A:", A.total ? (B.total / A.total).toFixed(3) : "n/a");
console.log("pageerrors:", errors.length, errors[0] ?? "");
await browser.close();

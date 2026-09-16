// probe-clip-side — decisive experiment: does invert=false keep [0, frac]
// (reading A) or [frac, 1] (reading B)? Z=0.98: A ≈ full scene, B ≈ empty.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch {}
await sleep(400);
const jobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1500);
await page.locator('[aria-label*="Enlarge orthovol"]').click({ timeout: 15_000 });
await sleep(1200);
const dlg = page.locator('[role="dialog"]').last();
await dlg.locator('button:has-text("View in 3D")').first().click({ timeout: 10_000 });
await sleep(1000);
const vdlg = page.locator('[role="dialog"]').last();
await vdlg.locator("canvas").first().waitFor({ state: "visible", timeout: 20_000 });
await sleep(6000); // FULL settle

const grab = async (label) => {
  writeFileSync(`/home/z/my-project/shots-qa/probe-${label}.png`, await page.screenshot());
  return page.evaluate(() => {
    const c = document.querySelector('[role="dialog"]:last-of-type canvas');
    if (!c) return null;
    const w = c.width, h = c.height;
    const off = document.createElement("canvas"); off.width = w; off.height = h;
    const ctx = off.getContext("2d"); ctx.drawImage(c, 0, 0);
    const img = ctx.getImageData(0, 0, w, h).data;
    const px = (x, y) => { const i = (y * w + x) * 4; return [img[i], img[i + 1], img[i + 2]]; };
    const bg = px(4, 4);
    let total = 0;
    for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
      const [r, g, b] = px(x, y);
      if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 30) total++;
    }
    return total;
  });
};

const A = await grab("a2-plain");
await sleep(1000);
const A2 = await grab("a3-plain");
console.log("A:", A, "A2:", A2, "stable:", Math.abs(A2 - A) < 20);

await vdlg.locator('button:has-text("Clip")').first().click();
await sleep(600);
const zSlider = vdlg.locator('[role="slider"][aria-label="Clip position along the Z axis"]');
await zSlider.focus();
await page.keyboard.press("Home");
await sleep(200);
// End jumps to max (1.0) — two ArrowLeft steps land 0.98 without a
// keystroke storm (96 rapid intents crashed the page once already)
await page.keyboard.press("End");
await sleep(200);
for (let i = 0; i < 2; i++) { await page.keyboard.press("ArrowLeft"); await sleep(60); }
await sleep(2500);
console.log("z valuenow:", await zSlider.getAttribute("aria-valuenow"));
const D = await grab("d-clip-z98");
console.log("D (z=0.98):", D, "ratio D/A2:", (D / A2).toFixed(3));
await browser.close();

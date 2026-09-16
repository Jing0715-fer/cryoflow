// diagnose the t253 clip-off click interception — measure the geometry at
// the failure point: who owns the button's click point, where did the
// contour card / canvas / header actually land?
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });

const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
const host = (jobs.jobs ?? []).find((j) => j.name === "QA Refine3D");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
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
const stripBtn = page.locator('button[aria-expanded]', { hasText: "Orthogonal slices" }).first();
if ((await stripBtn.getAttribute("aria-expanded").catch(() => null)) === "false") {
  await stripBtn.click();
  await sleep(400);
}
const clipBtn = page.locator('button[aria-label="Toggle box clipping"]');
let clipUp = await clipBtn.isVisible().catch(() => false);
for (let k = 0; k < 9 && !clipUp; k++) { await sleep(5000); clipUp = await clipBtn.isVisible().catch(() => false); }
await clipBtn.click();
await sleep(600);

const zSlider = page.locator('[role="slider"][aria-label="Clip position along the Z axis"]');
await zSlider.focus();
await page.keyboard.press("Home");
await sleep(120);
for (let i = 0; i < 18; i++) await page.keyboard.press("ArrowRight");
await sleep(700);
// back to 80 like t253
await zSlider.focus();
await page.keyboard.press("Home");
await sleep(120);
for (let i = 0; i < 78; i++) await page.keyboard.press("ArrowRight");
await sleep(700);

// NOW measure — the moment before t253's failing clip-off click
const geo = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Toggle box clipping"]');
  const desc = document.querySelector('[data-slot="dialog-description"]');
  const canvas = document.querySelector("[data-canvas-ui] , .ms-plugin-viewport, canvas") ;
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const br = r(btn);
  const cx = br ? br.x + br.w / 2 : 0;
  const cy = br ? br.y + br.h / 2 : 0;
  const owner = document.elementFromPoint(cx, cy);
  // the strip + its images
  const stripBtn = Array.from(document.querySelectorAll("button[aria-expanded]")).find((b) => (b.textContent || "").includes("Orthogonal slices"));
  const stripPanel = stripBtn ? stripBtn.getAttribute("aria-controls") ? document.getElementById(stripBtn.getAttribute("aria-controls")) : null : null;
  const imgs = Array.from(document.querySelectorAll("[data-canvas-ui='ortho-tile-z'] img, [data-canvas-ui='ortho-tile-x'] img, [data-canvas-ui='ortho-tile-y'] img")).map((i) => ({ src: i.src.slice(-24), complete: i.complete, nw: i.naturalWidth, nh: i.naturalHeight, rect: r(i) }));
  const tiles = ["z", "x", "y"].map((ax) => r(document.querySelector(`[data-canvas-ui='ortho-tile-${ax}']`)));
  // the flex column: canvas wrapper + strip
  const contentCol = btn ? btn.closest("[data-slot='dialog-content'] > div, [data-slot='dialog-content']") : null;
  return {
    btn: br,
    btnCenter: { cx: Math.round(cx), cy: Math.round(cy) },
    desc: r(desc),
    canvas: r(canvas),
    ownerAtBtnCenter: owner ? `${owner.tagName}.${(owner.className || "").toString().slice(0, 60)} text=${(owner.textContent || "").slice(0, 40)}` : "none",
    viewport: { w: window.innerWidth, h: window.innerHeight },
    dialogH: r(document.querySelector("[data-slot='dialog-content']")),
    scrollH: document.querySelector("[data-slot='dialog-content']")?.scrollHeight,
    stripBtnRect: r(stripBtn),
    stripPanelRect: r(stripPanel),
    tiles,
    imgs,
    contentCol: r(contentCol),
  };
});
console.log(JSON.stringify(geo, null, 2));

await page.screenshot({ path: "/home/z/my-project/scripts/tmp-t254/diag-collapse.png" });

await browser.close();

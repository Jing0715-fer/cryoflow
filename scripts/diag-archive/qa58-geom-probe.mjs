// One-shot geometry probe: where are the zoom/note buttons per class card,
// and what actually sits at the zoom button's click point?
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
try { sh("pkill -f agent-browser"); } catch {}
sh("python3 /home/z/my-project/scripts/qa58-seed-gallery.py");

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const curView = () => p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
for (let i = 0; i < 8 && (await curView()) !== "canvas"; i++) {
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(1500);
}
await p.locator("[data-job]", { hasText: "QA Class Select" }).locator('[role="button"]').first().click({ timeout: 5000 });
await p.waitForTimeout(1500);
await p.locator("aside").nth(1).getByRole("tab", { name: "Params", exact: true }).click({ timeout: 5000 });
await p.waitForSelector('section[aria-label="Class selection gallery"]', { timeout: 8000 });
await p.waitForTimeout(500);
// hover a cell so the reveal state matches a real pointer
const out = await p.evaluate(() => {
  const zooms = [...document.querySelectorAll("[data-canvas-ui=class-zoom]")].slice(0, 3);
  return zooms.map((z) => {
    const zr = z.getBoundingClientRect();
    const label = z.getAttribute("aria-label");
    const cell = z.closest("[data-canvas-ui=class-cell]") || z.parentElement;
    const note = cell && cell.querySelector("[data-canvas-ui=class-note]");
    const nr = note ? note.getBoundingClientRect() : null;
    const cx = zr.x + zr.width / 2, cy = zr.y + zr.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      label: label && label.slice(0, 22),
      zoom: { x: Math.round(zr.x), y: Math.round(zr.y), w: Math.round(zr.width), h: Math.round(zr.height) },
      note: nr ? { x: Math.round(nr.x), y: Math.round(nr.y), w: Math.round(nr.width), h: Math.round(nr.height) } : null,
      atZoomCenter: top ? `${top.tagName}${top.getAttribute("data-canvas-ui") ? `[${top.getAttribute("data-canvas-ui")}]` : ""}` : "none",
      noted: note ? note.getAttribute("data-noted") : null,
    };
  });
});
console.log(JSON.stringify(out, null, 1));
await b.close();

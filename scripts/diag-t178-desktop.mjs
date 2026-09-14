import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = jobs.jobs ?? jobs;
const mj = list.find((j) => /^motioncorr$/i.test(j.type) && j.status === "completed");
// zoom in 3x first (t177 doctrine: the corridor eats small card bodies)
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => document.querySelector('button[aria-label="Zoom in"]')?.click());
  await sleep(450);
}
console.log("motion job:", mj.name);
for (let attempt = 0; attempt < 3; attempt++) {
  // spiral: find a point where elementFromPoint belongs to THIS card
  const spot = await page.evaluate((want) => {
    const card = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
    if (!card) return null;
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const offs = [];
    for (const dx of [-45, -30, -15, 0, 15, 30, 45]) for (const dy of [-15, -5, 5, 15]) offs.push([dx, dy]);
    for (const [dx, dy] of offs) {
      const px = Math.min(Math.max(cx + dx, r.left + 3), r.left + r.width - 3);
      const py = Math.min(Math.max(cy + dy, r.top + 3), r.top + r.height - 3);
      const el = document.elementFromPoint(px, py);
      if (el && el.closest(`[data-job="${want}"]`)) return { x: px, y: py, inVp: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
    }
    return null;
  }, mj.id);
  console.log(`attempt ${attempt}: spiral spot=${JSON.stringify(spot)}`);
  if (spot && spot.inVp) {
    await page.mouse.click(spot.x, spot.y);
    await sleep(2500);
    const state = await page.evaluate(() => {
      const dlg = document.querySelector("[data-inspector-dialog]");
      const h2 = dlg?.querySelector("h2")?.textContent ?? null;
      const panel = document.querySelector("[data-motion-panel]");
      return {
        dialog: !!dlg,
        title: h2,
        panel: !!panel,
        panelHTML: panel ? panel.querySelector("h3")?.textContent : null,
        bodyFirstDivs: [...document.querySelectorAll("[data-inspector-dialog] .space-y-6 > *")].slice(0, 12).map((d) => d.tagName + ":" + (d.className || "").toString().slice(0, 24)),
      };
    });
    console.log("after click:", JSON.stringify(state, null, 1).slice(0, 900));
    break;
  }
  // else pan toward it
  const delta = await page.evaluate((want) => {
    const card = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { dx: innerWidth * 0.55 - (r.left + r.width / 2), dy: innerHeight * 0.45 - (r.top + r.height / 2) };
  }, mj.id);
  if (!delta) break;
  const start = await page.evaluate(() => {
    for (const [fx, fy] of [[0.5, 0.42], [0.5, 0.66], [0.72, 0.42]]) {
      const sx = Math.round(innerWidth * fx), sy = Math.round(innerHeight * fy);
      const el = document.elementFromPoint(sx, sy);
      if (el && el.closest('[data-canvas="viewport"]') && !el.closest("[data-job]") && !el.closest("button")) return [sx, sy];
    }
    return null;
  });
  if (!start) { console.log("no pan start"); break; }
  await page.mouse.move(start[0], start[1]);
  await page.mouse.down();
  await page.mouse.move(start[0] + delta.dx, start[1] + delta.dy, { steps: 8 });
  await page.mouse.up();
  await sleep(900);
}
await browser.close();

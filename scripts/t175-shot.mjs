#!/usr/bin/env node
/** t175-shot.mjs — Task 175 beauty shots: the legibility round.
 *  ① destructive toast in LIGHT (white ink on one red)
 *  ② destructive toast in DARK (same contract)
 *  ③ the dark echo mid-drag (the shade that learned to be seen)
 *  ④ the grabber mid-nudge (the invitation that learned to move)
 */
import { chromium, devices } from "playwright";
import sharp from "sharp";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

// ① light destructive toast
await page.evaluate(() => {
  const canvas = document.querySelector('[data-canvas="viewport"]');
  const dt = new DataTransfer();
  dt.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
  canvas.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
});
await sleep(900);
await page.screenshot({ path: "/tmp/t175-toast-light.png" });
await page.locator("[toast-close]").click({ force: true });
await sleep(500);

// ② dark destructive toast
await page.evaluate(() => document.documentElement.classList.add("dark"));
await sleep(300);
await page.evaluate(() => {
  const canvas = document.querySelector('[data-canvas="viewport"]');
  const dt = new DataTransfer();
  dt.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
  canvas.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
});
await sleep(900);
await page.screenshot({ path: "/tmp/t175-toast-dark.png" });
await page.close();

// ③④ mobile: dark echo mid-drag + grabber mid-nudge
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
const m = await ctx.newPage();
await m.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
await m.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1400);
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const l = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idle = new Set(l.filter((j) => j.status === "idle").map((j) => j.id));
let card = null;
for (let a = 0; a < 8 && !card; a++) {
  const cards = await m.evaluate(() => {
    const mm = 30;
    return [...document.querySelectorAll("[data-job]")].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.getAttribute("data-job"),
        inVp: r.top >= mm && r.left >= 0 && r.bottom <= innerHeight - mm && r.right <= innerWidth,
        cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    });
  });
  card = cards.find((c) => idle.has(c.id || "") && c.inVp) || null;
  if (card) break;
  const px = 160 + (a % 3) * 30, py = 300 + (a % 2) * 40;
  await m.mouse.move(px, py); await m.mouse.down();
  await m.mouse.move(px - 180, py - (a % 2 ? 140 : 40), { steps: 6 });
  await m.mouse.up(); await sleep(700);
}
await m.evaluate(() => document.documentElement.classList.add("dark"));
await sleep(400);

// ④ mid-nudge: tap open, screenshot inside the nudge window
await m.touchscreen.tap(card.cx, card.cy);
await sleep(950);
await m.screenshot({ path: "/tmp/t175-nudge.png" });
await sleep(1700); // let it rest

// ③ dark echo mid-drag
const rect = await m.evaluate(() => {
  const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const sy = Math.min(rect.y + rect.h / 2, 480);
await m.mouse.move(rect.x + 60, sy);
await m.mouse.down();
await m.mouse.move(rect.x + 280, sy, { steps: 10 });
await sleep(150);
await m.screenshot({ path: "/tmp/t175-echo-dark.png" });
await m.mouse.up();
await sleep(600);

await ctx.close();
await browser.close();

// crop the toast corners + echo band for close-ups
const meta = await sharp("/tmp/t175-toast-light.png").metadata();
const w = meta.width, h = meta.height;
const corner = Math.min(560, Math.floor(w * 0.46));
await sharp("/tmp/t175-toast-light.png").extract({ left: w - corner, top: 0, width: corner, height: 170 }).toFile("/tmp/t175-toast-light-crop.png");
await sharp("/tmp/t175-toast-dark.png").extract({ left: w - corner, top: 0, width: corner, height: 170 }).toFile("/tmp/t175-toast-dark-crop.png");
const em = await sharp("/tmp/t175-echo-dark.png").metadata();
const bandW = Math.min(360, em.width);
await sharp("/tmp/t175-echo-dark.png").extract({ left: 0, top: Math.max(0, Math.floor(em.height / 2) - 200), width: bandW, height: 400 }).toFile("/tmp/t175-echo-crop.png");
console.log("shots done");

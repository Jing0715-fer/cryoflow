import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
// seed the mock motion catalogue
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = jobs.jobs ?? jobs;
const mj = list.find((j) => /^motioncorr$/i.test(j.type) && j.status === "completed");
const wd = state[mj.id]?.workdir;
const sf = wd + "/corrected_micrographs.star";
let cleanup = false;
if (!existsSync(sf)) { writeFileSync(sf, readFileSync("scripts/qa-fixtures/mock-motion.star", "utf8")); cleanup = true; }
await p.reload({ waitUntil: "networkidle" });
await sleep(2200);
for (let i = 0; i < 3; i++) { await p.evaluate(() => document.querySelector('button[aria-label="Zoom in"]')?.click()); await sleep(400); }
const spot = await p.evaluate((want) => {
  const card = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
  if (!card) return null;
  const r = card.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, mj.id);
await p.mouse.click(spot.x, spot.y);
await sleep(2200);
await p.locator('[data-inspector-dialog] [role="tab"]', { hasText: "Overview" }).first().click({ timeout: 4000 });
await sleep(1800);
await p.evaluate(() => { const el = document.querySelector("[data-motion-panel]"); el?.scrollIntoView({ block: "center" }); });
await sleep(600);
await p.screenshot({ path: "scripts/shots-t178/motion-panel.png" });
const badge = await p.evaluate(() => document.querySelector("[data-motion-offender-badge]")?.textContent?.trim() ?? null);
console.log("badge:", badge);
if (cleanup) unlinkSync(sf);
await browser.close();
console.log("DONE");

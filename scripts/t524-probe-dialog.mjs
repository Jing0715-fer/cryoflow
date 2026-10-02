/** t524 probe — click the eraser, then dump every dialog layer verbatim */
import { chromium } from "playwright";
const HOST_JOB = "QA Post 300";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 20000 });
await sleep(2500);
for (let i = 0; i < 8; i++) {
  const ready = await p.evaluate((h) => [...document.querySelectorAll("[data-job]")].some((x) => x.textContent.includes(h)), HOST_JOB);
  if (ready) break;
  await p.keyboard.press("Shift+D");
  await sleep(2200);
}
await p.keyboard.press("Control+f");
const fi = p.locator('[data-testid="canvas-find-input"]');
if (await fi.isVisible().catch(() => false)) {
  await fi.fill(HOST_JOB); await sleep(300);
  await p.keyboard.press("Enter"); await sleep(800);
  await p.keyboard.press("Escape"); await sleep(400);
}
let modal = false;
for (let i = 0; i < 5 && !modal; i++) {
  try {
    await p.locator("[data-job]", { hasText: HOST_JOB }).locator('[role="button"]').first().click({ timeout: 3000 });
    await sleep(1500);
    modal = await p.evaluate((h) => [...document.querySelectorAll("[role=dialog]")].some((d) => (d.textContent || "").includes(h)), HOST_JOB);
  } catch { await sleep(1500); }
}
console.log("inspector open:", modal);
const btn = p.locator('[role=dialog] [aria-label^="Clean intermediates"]').first();
console.log("eraser visible:", await btn.isVisible().catch(() => false));
await btn.click({ timeout: 3000 });
await sleep(2500);
const dump = await p.evaluate(() => JSON.stringify([...document.querySelectorAll("[role=dialog], [data-cleanup-confirm]")].map((d, i) => ({
  i,
  role: d.getAttribute("role"),
  cleanup: d.hasAttribute("data-cleanup-confirm"),
  head: (d.textContent || "").replace(/\s+/g, " ").slice(0, 150),
}))));
console.log("dialog layers:", dump);
await b.close();

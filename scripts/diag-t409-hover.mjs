// diag-t409-hover.mjs — does the hover preview open, and does the cluster line speak?
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// find a job whose DTO carries runRemote
const d = await (await fetch(`${BASE}/api/jobs`)).json();
const withRR = (d.jobs ?? []).filter((j) => j.runRemote);
console.log("jobs with runRemote:", withRR.length, "first:", withRR[0]?.name);
const jid = withRR[0].id;

const trigger = page.locator(`[data-job="${jid}"] [data-slot="hover-card-trigger"]`).first();
console.log("trigger visible:", await trigger.isVisible().catch(() => false));
const box = await trigger.boundingBox().catch(() => null);
console.log("trigger box:", JSON.stringify(box));
if (box) {
  const top = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? `${el.tagName}.${String(el.className).slice(0, 60)} dataSlot=${el.getAttribute("data-slot")}` : "none";
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  console.log("topmost element at trigger center:", top);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
}
await page.waitForTimeout(1800);
const ariaCount = await page.locator('[aria-label*="cluster" i]').count();
console.log("aria cluster labels on page:", ariaCount);
const labels = await page.locator('[aria-label*="cluster" i]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
console.log("labels:", JSON.stringify(labels).slice(0, 400));
// also dump any hover-card content present
const hc = await page.locator('[data-slot="hover-card-content"], [role="tooltip"]').count();
console.log("hover card contents:", hc);
await page.screenshot({ path: "/home/z/my-project/shots-qa/t409-hover.png" });
await browser.close();

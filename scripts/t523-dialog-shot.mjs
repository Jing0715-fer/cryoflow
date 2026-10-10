/** t523 — the cleanup dialog's history strip, photographed alive (t522's
 *  leftover #2: the bench + API double-proof was already on file; the UI
 *  screenshot got eaten by the harvest that window). qa63's click doctrine:
 *  real pointer events through playwright, Ctrl+F to reach any card. */
import { chromium } from "playwright";

const B = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(B, { waitUntil: "networkidle" });
await sleep(1500);

for (let i = 0; i < 10; i++) {
  const v = await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  if (v === "canvas" && (await p.locator(`[data-job]`, { hasText: "QA Post 300" }).count()) > 0) break;
  await p.keyboard.press("Shift+D");
  await sleep(2200);
}

await p.keyboard.press("Control+f");
const fi = p.locator('[data-testid="canvas-find-input"]');
if (await fi.isVisible().catch(() => false)) {
  await fi.fill("QA Post 300"); await sleep(300);
  await p.keyboard.press("Enter"); await sleep(800);
  await p.keyboard.press("Escape"); await sleep(400);
}

const card = p.locator("[data-job]", { hasText: "QA Post 300" }).locator('[role="button"]').first();
await card.click({ timeout: 5000 });
await sleep(1500);

const cleanBtn = p.locator('[role=dialog] button', { hasText: "Clean intermediates" }).first();
await cleanBtn.click({ timeout: 5000 });
await sleep(2000);

const dlg = p.locator('[role=dialog]', { hasText: /tier|scope|Recent cleanups/i }).last();
const info = await dlg.evaluate((d) => ({
  recent: d.textContent.includes("Recent cleanups"),
  hasLedgerRows: d.textContent.match(/dialog|agent/g)?.length ?? 0,
  snippet: d.textContent.slice(0, 300),
}));
console.log("history strip:", JSON.stringify(info));

await p.screenshot({ path: "/home/z/my-project/.qa-logs/t523-cleanup-dialog-history.png", fullPage: false });
console.log("screenshot saved");
await b.close();

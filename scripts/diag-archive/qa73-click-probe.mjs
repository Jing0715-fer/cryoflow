// qa73-click-probe — why didn't the card click open the inspector?
import { chromium } from "playwright";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
if (!(await p.evaluate(() => !!document.querySelector("[data-canvas=workspace]")))) {
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(2000);
}
const card = p.locator('[data-job="cmtt2sp6p0001p87b37kntqmj"]').first();
await card.scrollIntoViewIfNeeded().catch(() => {});
await p.waitForTimeout(400);
const box = await card.boundingBox();
console.log("box:", JSON.stringify(box));
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
await p.waitForTimeout(1500);
const state = await p.evaluate(() => ({
  dialogs: document.querySelectorAll("[role=dialog]").length,
  noteEditor: !!document.querySelector("[data-note-editor]"),
  selected: document.querySelectorAll("[data-job][data-selected=true]").length,
  selectedAttr: document.querySelector("[data-job]")?.getAttribute("data-selected"),
  dialogText: document.querySelector("[role=dialog]")?.textContent?.slice(0, 120) ?? null,
  canvasTransform: document.querySelector("[data-canvas=viewport]")?.style?.transform ?? null,
}));
console.log("after click:", JSON.stringify(state));
await b.close();

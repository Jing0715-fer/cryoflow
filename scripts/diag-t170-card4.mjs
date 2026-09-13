import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 2500));

const before = await page.evaluate(() => {
  const c = [...document.querySelectorAll("[data-job]")].find((x) => (x.textContent || "").includes("QA Post 300"));
  const r = c.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
});
console.log("before FIT:", JSON.stringify(before));

await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await new Promise((r) => setTimeout(r, 1600));

const after = await page.evaluate(() => {
  const c = [...document.querySelectorAll("[data-job]")].find((x) => (x.textContent || "").includes("QA Post 300"));
  const r = c.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
});
console.log("after FIT:", JSON.stringify(after));

try {
  await page.locator("[data-job]", { hasText: "QA Post 300" }).locator('[role="button"]').first().click({ timeout: 4000 });
  console.log("click after FIT: OK");
  await new Promise((r) => setTimeout(r, 1200));
  const dlg = await page.evaluate(() => [...document.querySelectorAll("[role=dialog]")].some((d) => (d.textContent || "").includes("QA Post 300")));
  console.log("inspector dialog:", dlg);
} catch (e) {
  console.log("click after FIT FAIL:", String(e).slice(0, 200));
}
await browser.close();

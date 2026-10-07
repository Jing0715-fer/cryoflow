// t673 diag — what actually happens when the pencil is clicked?
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const molLines = [];
page.on("console", (m) => { if (/olstar\]/.test(m.text())) molLines.push(m.text().slice(0, 100)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, t = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { const v = await fn().catch(() => null); if (v) return v; await sleep(400); } return null; };
const waitViewerReady = (t = 150000) => pollUntil(async () => {
  if (molLines.some((l) => l.includes("init failed"))) return "failed";
  if (molLines.some((l) => l.includes("] ready"))) return "ready";
  return null;
}, t);
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await pollUntil(async () => ((await page.locator('[role="tab"]').count()) > 0 && (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(1500);
const reRow = page.locator("[data-roster-row]", { hasText: "3D auto-refine" }).first();
await pollUntil(async () => (await reRow.count()) > 0 || null, 10000);
await reRow.locator('button[title^="Open 3D auto-refine"]').first().click().catch(() => {});
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
await sleep(1500);
await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
await sleep(1500);
const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
await pollUntil(async () => (await enlarge.count()) > 0 || null, 25000);
await enlarge.scrollIntoViewIfNeeded().catch(() => {});
await enlarge.click().catch(() => {});
await sleep(1200);
const v3d = page.locator("button", { hasText: "View in 3D" }).first();
await v3d.click().catch(() => {});
console.log("viewer:", await waitViewerReady());
await pollUntil(async () => (await page.locator('button[aria-label="Camera view bookmarks — 5 saved"]').count()) > 0 || null, 20000);
const trig = page.locator('button[aria-label^="Camera view bookmarks"]').first();
await trig.click().catch(() => {});
await sleep(900);
const pencils = page.locator('button[aria-label^="Rename bookmark"]');
console.log("pencil count:", await pencils.count());
for (let i = 0; i < await pencils.count(); i++) console.log(`  pencil[${i}]:`, await pencils.nth(i).getAttribute("aria-label"));
const alpha = page.locator('button[aria-label="Rename bookmark probe drill alpha"]');
console.log("alpha pencil count:", await alpha.count());
if (await alpha.count()) {
  await alpha.first().click();
  await sleep(1200);
  const inputs = page.locator('[data-testid="bm-rename-t673drill-a"]');
  console.log("input count after click:", await inputs.count());
  if (await inputs.count()) console.log("input value:", await inputs.first().inputValue());
  const anyInput = page.locator('[data-testid^="bm-rename-"]');
  console.log("any rename input on screen:", await anyInput.count());
  // dump the alpha row's outerHTML
  const row = page.locator("div.group\\/bm", { hasText: "probe drill alpha" }).first();
  console.log("row html head:", (await row.innerHTML().catch(() => "n/a")).slice(0, 500));
  await page.screenshot({ path: "/tmp/cryoflow-qa/t673-diag-pencil.png" }).catch(() => {});
}
await b.close();

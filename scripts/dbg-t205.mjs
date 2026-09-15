import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
page.on("console", (m) => { if (m.type() === "error") console.log("CERR:", m.text().slice(0, 120)); });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await sleep(2000);
await page.locator('button[aria-label="Switch to dark theme"]').click().catch(() => {});
await sleep(600);
const jobs = await (await fetch("http://localhost:3000/api/jobs")).json();
const host = jobs.jobs.find((j) => j.name === "QA Refine3D");
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
await page.locator('button[aria-label="Enlarge orthovol"]').click().catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { console.log("viewer up", (k + 1) * 2 + "s"); break; } }
await sleep(10000);
console.log("CONSOLE ERRORS SO FAR:", JSON.stringify([`${page.filters?.length ?? "?"}`]));
const diag1b = await page.evaluate(() => ({
  dialogs: Array.from(document.querySelectorAll('[role="dialog"], [data-slot="dialog-overlay"]')).map((d) => ({ state: d.getAttribute("data-state"), text: (d.textContent || "").slice(0, 120) })),
  bodyButtons: Array.from(document.querySelectorAll('button[aria-label]')).map((b) => b.getAttribute("aria-label")).filter((l) => l && (l.includes("Overlay") || l.includes("cross-section") || l.includes("Enlarge") || l.includes("3D"))).slice(0, 20),
  molstarCanvas: !!window.__molstar?.canvas3d,
}));
console.log("DIAG1b:", JSON.stringify(diag1b, null, 1));
await page.screenshot({ path: "scripts/shots-t205/diag-viewer.png" }).catch(() => {});
await sleep(1500);
const diag1 = await page.evaluate(() => ({
  overlayBtn: !!document.querySelector('button[aria-label^="Overlay maps"]'),
  toggleBtn: !!document.querySelector('button[aria-label="Toggle cross-section plane"]'),
  profilePanel: !!document.querySelector('div[data-md-carrier="profile"], div[data-csv-carrier="profile"]'),
}));
console.log("DIAG1:", JSON.stringify(diag1));
await page.locator('button[aria-label^="Overlay maps"]').click().catch(() => {});
await sleep(1200);
const diag2 = await page.evaluate(() => ({
  choices: Array.from(document.querySelectorAll('[data-testid^="map-choice-"]')).map((b) => ({ t: b.getAttribute("title"), v: !!(b.offsetParent || b.getClientRects().length) })),
  popoverVisible: !!document.querySelector('[data-testid^="map-choice-"]'),
}));
console.log("DIAG2:", JSON.stringify(diag2));
const half1 = page.locator('[data-testid^="map-choice-"][title*="half1"]');
if (await half1.isVisible().catch(() => false)) {
  await half1.click();
  console.log("clicked half1");
  await sleep(6000);
  const chips = await page.locator('[data-local-chip]').count();
  const localRow = await page.locator('div[data-local-row="1"]').count();
  console.log("AFTER ADOPT: chips=" + chips + " localRow=" + localRow);
  const md = await page.locator('div[data-md-carrier="profile"], div[data-csv-carrier="profile"]').first().getAttribute("data-md").catch(() => null);
  console.log("md present:", !!md, md ? md.length : 0);
} else {
  console.log("half1 choice NOT visible");
}
await page.screenshot({ path: "scripts/shots-t205/diag.png" }).catch(() => {});
await browser.close();

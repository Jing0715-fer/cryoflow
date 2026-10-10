// t675 smoke — can the palette open OVER the viewer dialog + bookmark
// popover (three radix layers)? The fourth-ear probe depends on this dance:
// embed list open → Control+k → palette rows visible → Escape → popover
// still alive. No mutations, no asserts-to-keep — just the wire check.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(300);
  }
};

mkdirSync(".qa-logs", { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const molLines = [];
page.on("console", (m) => { if (/olstar\]/.test(m.text())) molLines.push(m.text().slice(0, 120)); });
const waitViewerReady = (timeoutMs = 120000) => pollUntil(async () => {
  if (molLines.some((l) => l.includes("init failed"))) return "failed";
  if (molLines.some((l) => l.includes("] ready"))) return "ready";
  return null;
}, timeoutMs);

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(1500);

// open the refine job's inspector
const reRow = page.locator("[data-roster-row]", { hasText: "3D auto-refine" }).first();
await pollUntil(async () => (await reRow.count()) > 0 || null, 10000);
await reRow.locator('button[title^="Open 3D auto-refine"]').first().click().catch(() => {});
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
await sleep(1500);

// viewer dance
await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
await sleep(1500);
const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
await pollUntil(async () => (await enlarge.count()) > 0 || null, 25000);
await enlarge.scrollIntoViewIfNeeded().catch(() => {});
await enlarge.click().catch(() => {});
await sleep(1200);
const v3d = page.locator("button", { hasText: "View in 3D" }).first();
if (!(await v3d.count())) { console.log("SMOKE FAIL: no View in 3D"); process.exit(1); }
await v3d.click().catch(() => {});
const vr = await waitViewerReady();
console.log("· viewer:", vr);

// bookmark popover open
const fp = await pollUntil(async () =>
  (await page.locator('button[aria-label="Camera view bookmarks — 3 saved"]').count()) > 0 || null, 20000);
console.log("· fingerprint 3 saved:", !!fp);
const trig = page.locator('button[aria-label^="Camera view bookmarks"]').first();
await trig.click().catch(() => {});
await sleep(900);
const rows = await page.locator('button[aria-label^="Rename bookmark"]').count();
console.log("· popover rows:", rows);

// NOW: palette over everything
await page.keyboard.press("Control+k");
await sleep(1500);
const cmdk = await page.locator("[cmdk-item]").count();
const savedRows = await page.locator('[cmdk-item]', { hasText: "Saved view — " }).count();
console.log("· cmdk items over viewer+popover:", cmdk, "| saved-view rows:", savedRows);
await page.screenshot({ path: ".qa-logs/t675-smoke-overlay.png" });

// Escape closes the palette; the popover should survive (first Escape eats
// by the palette only)
await page.keyboard.press("Escape");
await sleep(900);
const cmdkAfter = await page.locator("[cmdk-item]").count();
const popoverAfter = await page.locator('button[aria-label^="Rename bookmark"]').count();
console.log("· after Escape: cmdk =", cmdkAfter, "| popover rows still =", popoverAfter);

await b.close();
console.log("SMOKE DONE");

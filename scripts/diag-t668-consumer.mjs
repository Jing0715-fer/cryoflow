// diag-t668 — why doesn't the embed consume the pending view?
// Instrument everything: pending state, camera-bookmarks fetch, molstar
// phase, toasts in DOM, and the fullscreen dialog's job identity.
import { chromium } from "playwright";

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

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const bmFetches = [];
page.on("response", (r) => {
  if (/\/camera-bookmarks/.test(r.url())) bmFetches.push(`${r.status()} ${r.url().slice(-40)}`);
});
const allConsole = [];
page.on("console", (m) => {
  const t = m.text();
  allConsole.push(`${m.type()}: ${t.slice(0, 140)}`);
  if (m.type() === "error" && !/webpack-hmr|Failed to load resource|Failed to load chunk/.test(t)) {
    console.log("  [console.error]", t.slice(0, 160));
  }
});
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 160)));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// arm the pending DIRECTLY (isolate the consumer from the palette)
await page.evaluate(() => {
  sessionStorage.setItem("cryoflow:pending-view", JSON.stringify({ jobId: "cmuwipe635000refine3d", bookmarkId: "seedview1" }));
});
console.log("pending armed");

// open the inspector from the roster (real click)
await page.locator('[role="tab"][title^="Project dashboard"]').first().click();
await sleep(1500);
await page.locator("[data-roster-row]", { hasText: "3D auto-refine" }).first()
  .locator("button[title^='Open 3D auto-refine']").first().click();
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
console.log("dialog:", await page.locator('[role="dialog"]').count());
await sleep(1500);

// enlarge → View in 3D (t662's proven form), but log which enlarge we hit
const enlarges = await page.locator('button[aria-label^="Enlarge"]').count();
console.log("enlarge candidates:", enlarges);
const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
await enlarge.scrollIntoViewIfNeeded().catch(() => {});
await enlarge.click();
await sleep(1200);
const v3d = page.locator("button", { hasText: "View in 3D" }).first();
console.log("view3d present:", await v3d.count());
await v3d.click();
const molReady = await pollUntil(async () =>
  (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) || null, 120000);
console.log("molstar ready:", molReady);

// give the bookmark-list effect its window (2.5s fetch cap + settle)
await sleep(6000);
const state = await page.evaluate(() => ({
  pending: sessionStorage.getItem("cryoflow:pending-view"),
  hasMol: !!window.__molstar?.canvas3d,
}));
console.log("camera-bookmarks fetches:", bmFetches.length ? bmFetches.join(" | ") : "NONE");
console.log("state:", JSON.stringify(state));
console.log("molstar lifecycle lines:");
for (const l of allConsole) {
  if (/olstar|ready|init|snapshot|camera/i.test(l)) console.log("   ", l);
}
await page.screenshot({ path: ".qa-logs/diag-t668.png" });
await b.close();

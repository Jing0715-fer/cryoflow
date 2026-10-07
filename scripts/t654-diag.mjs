// t654 diag — where does the import gallery live after "Open"?
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await new Promise((r) => setTimeout(r, 2500));
await page.locator('[role="tab"][title^="Project dashboard"]').click();
await new Promise((r) => setTimeout(r, 1200));
const row = page.locator('[data-roster-row]', { hasText: "EMPIAR mics import" }).first();
await row.locator('button[title^="Open EMPIAR mics import"]').click();
await new Promise((r) => setTimeout(r, 2500));

console.log("url:", page.url());
console.log("gallery sections:", await page.locator('section[aria-label="Source micrographs"]').count());
console.log("inspector/dialog:", await page.locator('[role="dialog"]').count());
console.log("tabs:", await page.locator('[role="tablist"] [role="tab"]').count());
const tabs = await page.locator('[role="tablist"] [role="tab"]').allInnerTexts();
console.log("tab labels:", tabs.slice(0, 12));
// any 'Source micrographs' text at all?
console.log("text hit:", await page.getByText("Source micrographs").count());
// what panels exist?
const heads = await page.locator("h3, h4").allInnerTexts();
console.log("headings:", heads.slice(0, 15).map(t => t.trim()).filter(Boolean));
await b.close();

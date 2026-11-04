// t231: the print tier's portrait — a print-emulated frame of the report
// doc. The screen frames cannot show this feature (print-only CSS, zero
// screen ink — the drift archaeology just proved it); the paper look
// needs its own lens. Emulate print media, shoot the doc, revert.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);
await page.locator('button[aria-label="Session QC report"]').click();
await sleep(1800);
for (let i = 0; i < 24 && (await page.locator("[data-report-body] [data-hero-landscape]").count()) !== 1; i++) await sleep(500);
await page.emulateMedia({ media: "print" });
await sleep(300);
await page.mouse.move(4, 4);
await sleep(200);
await page.locator("[data-report-body] [data-hero-landscape]").first().scrollIntoViewIfNeeded();
await sleep(300);
await page.locator("[data-report-doc]").first().screenshot({ path: "scripts/shots-t223/t231-print-tier-2x.png", scale: "css" });
await page.emulateMedia({ media: "screen" });
await browser.close();
console.log("PRINT FRAME SHOT");

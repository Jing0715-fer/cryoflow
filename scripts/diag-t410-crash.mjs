#!/usr/bin/env node
/**
 * diag-t410-crash.mjs — capture the REAL client-side exception on the landing page.
 * The page renders Next's generic "Application error" chrome; the actual stack lives
 * in the page's error event + console. This probe collects both, plus server log tail.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
const consoleMsgs = [];

page.on("pageerror", (err) => {
  errors.push(`[pageerror] ${err.message}\n${err.stack || "(no stack)"}`);
});
page.on("console", (msg) => {
  const t = msg.type();
  if (t === "error" || t === "warning") {
    consoleMsgs.push(`[console.${t}] ${msg.text()}`);
  }
});
page.on("requestfailed", (req) => {
  errors.push(`[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
});

await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => {
  errors.push(`[goto] ${e.message}`);
});
await page.waitForTimeout(4000);

const bodyText = (await page.textContent("body").catch(() => "")).slice(0, 300);

console.log("=== PAGE BODY (first 300 chars) ===");
console.log(bodyText);
console.log(`\n=== PAGE ERRORS (${errors.length}) ===`);
for (const e of errors) console.log(e + "\n");
console.log(`=== CONSOLE ERROR/WARN (${consoleMsgs.length}) ===`);
for (const m of consoleMsgs.slice(0, 30)) console.log(m);

await browser.close();

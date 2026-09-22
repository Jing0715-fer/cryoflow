// t232 diagnosis: where does the React #418 hydration text mismatch come from?
// Capture console errors WITH location, in phases: bare load -> dialog open.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    errs.push({ type: m.type(), text: m.text().slice(0, 300), loc: m.location() });
  }
});
page.on("pageerror", (e) => errs.push({ type: "pageerror", text: String(e).slice(0, 300) }));
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 4000));
console.log("=== PHASE 1: bare load ===");
errs.forEach((e) => console.log(JSON.stringify(e)));
errs.length = 0;
await page.locator('button[aria-label="Session QC report"]').click();
await new Promise((r) => setTimeout(r, 2500));
console.log("=== PHASE 2: report dialog open ===");
errs.forEach((e) => console.log(JSON.stringify(e)));
await browser.close();

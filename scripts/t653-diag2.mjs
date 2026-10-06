// t653 diag2 — the Enter leg: does pressing Enter in the find bar
// (go(1) → setCur + focusJob) trip the setState-in-render warning?
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const marks = [];
page.on("console", (m) => { if (m.type() === "error") marks.push(m.text().slice(0, 130)); });

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await new Promise((r) => setTimeout(r, 2500));
await page.locator('[role="tab"][title^="Workflow canvas"]').click();
await new Promise((r) => setTimeout(r, 2000));
await page.locator('[data-canvas-ui="find-toggle"]').click();
await new Promise((r) => setTimeout(r, 600));

const input = page.locator('[data-testid="canvas-find-input"]');
await input.fill("ctf"); // includes world, 1 match
await new Promise((r) => setTimeout(r, 900));
console.log("before Enter:", marks.length);
await input.press("Enter");
await new Promise((r) => setTimeout(r, 900));
console.log("after Enter #1:", marks.length);
await input.press("Enter");
await new Promise((r) => setTimeout(r, 900));
console.log("after Enter #2 (cycle wraps):", marks.length);
await input.fill("2dc");
await new Promise((r) => setTimeout(r, 800));
await input.press("Enter");
await new Promise((r) => setTimeout(r, 900));
console.log("after fuzzy + Enter:", marks.length);

console.log(marks);
await b.close();

// t653 diag — is the setState-in-render warning pre-existing (any query
// in the find bar) or fuzzy-specific (only the new dialect hits)?
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const marks = [];
page.on("console", (m) => {
  if (m.type() === "error") marks.push({ at: "console", text: m.text().slice(0, 120) });
});
page.on("pageerror", (e) => marks.push({ at: "pageerror", text: e.message.slice(0, 120) }));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await new Promise((r) => setTimeout(r, 2500));
await page.locator('[role="tab"][title^="Workflow canvas"]').click();
await new Promise((r) => setTimeout(r, 2000));
console.log("after canvas:", marks.length);

await page.locator('[data-canvas-ui="find-toggle"]').click();
await new Promise((r) => setTimeout(r, 600));
console.log("after open:", marks.length);

const input = page.locator('[data-testid="canvas-find-input"]');
await input.fill("ctf"); // pure includes query — the old world
await new Promise((r) => setTimeout(r, 900));
console.log("after includes query:", marks.length);

await input.fill("2dc"); // fuzzy dialect query
await new Promise((r) => setTimeout(r, 900));
console.log("after fuzzy query:", marks.length);

await input.fill(""); // clear
await new Promise((r) => setTimeout(r, 700));
console.log("after clear:", marks.length);

// reopen bar (closeFind then openFind) — the arming effect edge
await page.locator('[data-canvas-ui="find-toggle"]').click();
await new Promise((r) => setTimeout(r, 500));
await page.locator('[data-canvas-ui="find-toggle"]').click();
await new Promise((r) => setTimeout(r, 700));
console.log("after reopen:", marks.length);

console.log(marks);
await b.close();

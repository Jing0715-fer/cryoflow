// diag2 — capture the FULL hydration error from the dev server (:3001)
import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text());
});
p.on("pageerror", (e) => errs.push("PAGEERROR " + String(e)));
await p.goto("http://localhost:3001", { waitUntil: "networkidle" });
await sleep(1500);
if (!errs.length) {
  await p.reload({ waitUntil: "networkidle" });
  await sleep(1500);
}
const joined = errs.join("\n\n===== NEXT =====\n\n");
console.log(joined.slice(0, 6000) || "NO ERRORS");
await b.close();

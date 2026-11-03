// quick hydration repro — load /, capture pageerror + console error stacks
import { chromium } from "playwright";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(["PAGEERROR", String(e?.stack ?? e)]));
p.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errs.push([m.type().toUpperCase(), m.text()]);
});
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForTimeout(3500);
console.log("errors:", errs.length);
for (const [k, v] of errs) console.log(`\n[${k}]\n${v.slice(0, 1200)}`);
await b.close();

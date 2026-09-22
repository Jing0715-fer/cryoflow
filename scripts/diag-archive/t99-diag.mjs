// diag — locate the React #418 hydration text mismatch introduced this round
import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("console", (m) => {
  if (m.type() === "error") errs.push({ text: m.text().slice(0, 200), loc: m.location() });
});
p.on("pageerror", (e) => errs.push({ text: "PAGEERROR " + String(e).slice(0, 200), loc: {} }));
for (let round = 1; round <= 3; round++) {
  await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await sleep(1200);
  if (errs.length) break;
  await p.reload({ waitUntil: "networkidle" });
  await sleep(1200);
  if (errs.length) break;
}
console.log(JSON.stringify(errs, null, 2));
// snapshot hydration-sensitive text candidates: anything with digits/time
const suspects = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length === 0 && el.textContent && /\d/.test(el.textContent)) {
      const t = el.textContent.trim();
      if (t.length < 60) out.push(t);
    }
  }
  return out.slice(0, 40);
});
console.log("numeric leaf texts:", JSON.stringify(suspects, null, 2));
await b.close();

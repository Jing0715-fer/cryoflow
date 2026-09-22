import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let hits = 0, runs = 0;
for (let i = 0; i < 12; i++) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await sleep(600);
  await p.reload({ waitUntil: "networkidle" });
  await sleep(600);
  runs++;
  if (errs.some((e) => e.includes("418"))) hits++;
  await b.close();
}
console.log(`RESULT: ${hits}/${runs} runs hit React #418`);

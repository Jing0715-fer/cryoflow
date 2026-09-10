// diag3 — try to reproduce #418 under load on the DEV server for the full diff
import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.env.BASE ?? "http://localhost:3001";
let hits = 0, runs = 0;
const errsAll = [];
async function oneRound() {
  const b = await chromium.launch();
  const ps = [await b.newPage(), await b.newPage(), await b.newPage()]; // 3 tabs = load
  const perPage = ps.map(() => []);
  for (let i = 0; i < ps.length; i++) {
    p_on(ps[i], perPage[i]);
    await ps[i].goto(BASE, { waitUntil: "domcontentloaded" });
  }
  await sleep(700);
  for (const p of ps) {
    await p.reload({ waitUntil: "domcontentloaded" });
  }
  await sleep(700);
  for (const texts of perPage) {
    runs++;
    if (texts.some((e) => e.includes("418") || e.includes("hydrat"))) hits++;
    errsAll.push(...texts.filter((e) => e.includes("418") || e.includes("hydrat")));
  }
  await b.close();
}
function p_on(p, bucket) {
  p.on("pageerror", (e) => bucket.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") bucket.push(m.text()); });
}
for (let i = 0; i < 4; i++) await oneRound();
console.log(`RESULT: ${hits}/${runs} pages hit hydration error`);
if (errsAll.length) console.log(errsAll[0].slice(0, 4000));

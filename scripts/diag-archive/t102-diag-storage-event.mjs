import { chromium } from "playwright";
const b = await chromium.launch();
const p1 = await b.newPage();
const p2 = await b.newPage();
await p1.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p2.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
// arm a vanilla listener in p2
await p2.evaluate(() => {
  window.__events = [];
  window.addEventListener("storage", (e) => window.__events.push({ key: e.key, nv: e.newValue?.slice(0, 30) ?? null }));
});
await sleep(500);
await p1.evaluate(() => localStorage.setItem("probe.key", "hello"));
await sleep(800);
const events = await p2.evaluate(() => window.__events);
console.log("events seen in p2:", JSON.stringify(events));
// also test same-tab write (should NOT fire in p1)
const own = await p1.evaluate(() => window.__ownEvents ?? null);
await b.close();
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

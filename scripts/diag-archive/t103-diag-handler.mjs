// t103 diag — why didn't ArrowRight fire? Bisect the guard chain:
//   1. does the canvas keyboard handler work at all (press "0" resets)?
//   2. any listbox / open dialog guarding the arrow branch away?
//   3. does ArrowRight change anything (selection / viewport)?
//   4. what does the store see (selectedIds via DOM, jobs count in band)?
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
for (let i = 0; i < 4; i++) {
  const v = await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  if (v === "canvas") break;
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
// find the seeded E1 from the crashed t103 runs
const e1 = await p.evaluate(() => {
  const el = [...document.querySelectorAll("[data-job]")].find((el) =>
    el.textContent?.includes("t103 E1"));
  return el ? el.getAttribute("data-job") : null;
});
const ringState = () => p.evaluate(() => {
  const prim = [];
  const sec = [];
  for (const el of document.querySelectorAll("[data-job]")) {
    // the ring lives on the card BODY (role=button), not the [data-job] shell
    const body = el.querySelector('[role="button"]');
    if (!body) continue;
    if (body.className.includes("ring-primary/60")) prim.push(el.textContent?.slice(0, 12));
    else if (body.className.includes("ring-primary/30")) sec.push(el.textContent?.slice(0, 12));
  }
  return { prim, sec };
});
console.log("E1 rendered:", e1);
if (e1) {
  await p.locator(`[data-job="${e1}"]`).click();
  await sleep(400);
  console.log("after click, rings:", JSON.stringify(await ringState()));
  await p.keyboard.press("f");
  await sleep(500);
  console.log("after f, transform:", await p.evaluate(() =>
    document.querySelector('[data-canvas="workspace"]')?.style.transform));
  await p.keyboard.press("Escape");
  await sleep(400);
  console.log("guards: listbox =", await p.evaluate(() => document.querySelectorAll('[role="listbox"]').length),
    "| open dialog =", await p.evaluate(() => document.querySelectorAll('[role="dialog"][data-state="open"]').length),
    "| open menu =", await p.evaluate(() => document.querySelectorAll('[role="menu"][data-state="open"]').length));
  await p.keyboard.press("0");
  await sleep(400);
  console.log("after 0, transform:", await p.evaluate(() =>
    document.querySelector('[data-canvas="workspace"]')?.style.transform));
  await p.keyboard.press("ArrowRight");
  await sleep(400);
  console.log("after ArrowRight, rings:", JSON.stringify(await ringState()),
    "| transform:", await p.evaluate(() => document.querySelector('[data-canvas="workspace"]')?.style.transform));
}
console.log("pageerrors:", JSON.stringify(errs));
await b.close();

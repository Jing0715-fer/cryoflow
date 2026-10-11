// t81 palette diag — why is the Class notes group missing?
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
execSync("python3 scripts/qa58-seed-gallery.py", { encoding: "utf8", timeout: 120_000 });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(800);

// is the select2d card visible on the canvas (= its workspace is active)?
const canvasInfo = await p.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-job]")];
  const names = cards.map((c) => c.textContent?.slice(0, 24));
  return { n: cards.length, hasSelect: names.some((n) => n?.includes("QA Class Select")), names: names.slice(0, 6) };
});
console.log("canvas cards:", JSON.stringify(canvasInfo));

// workspace selector state from the DOM
const wsInfo = await p.evaluate(() => {
  const sel = document.querySelector("select") ?? null;
  const triggers = [...document.querySelectorAll("[role=combobox]")].map((x) => x.textContent?.trim());
  return { selectVal: sel?.value ?? null, combos: triggers.slice(0, 3) };
});
console.log("ws:", JSON.stringify(wsInfo));

await p.keyboard.press("Control+KeyK");
await p.waitForSelector("[cmdk-input]");
await sleep(500);
const dump = await p.evaluate(() => ({
  headings: [...document.querySelectorAll("[cmdk-group-heading]")].map((h) => h.textContent?.trim()),
  items: [...document.querySelectorAll("[cmdk-item]")].map((x) => x.textContent?.trim().slice(0, 40)),
}));
console.log("palette(no query):", JSON.stringify(dump, null, 1));
console.log("pageerrors:", errs);
await b.close();

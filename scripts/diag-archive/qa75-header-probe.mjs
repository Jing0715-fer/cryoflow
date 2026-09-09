// measure header child boxes at common widths to quantify the overlap
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
for (const width of [1280, 1366, 1440, 1536, 1600]) {
  const p = await b.newPage({ viewport: { width, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-canvas="viewport"]');
  await p.waitForTimeout(500);
  const boxes = await p.evaluate(() => {
    const header = document.querySelector("header");
    const kids = [...header.children].map((c) => {
      const r = c.getBoundingClientRect();
      return { cls: c.className.slice(0, 30), left: +r.left.toFixed(1), right: +r.right.toFixed(1) };
    });
    const chip = document.querySelector("[data-note-spotlight]");
    const chipR = chip?.getBoundingClientRect();
    // deepest informative children
    const left = header.children[0]?.getBoundingClientRect();
    const right = header.children[1]?.getBoundingClientRect();
    return {
      kids,
      chipRight: chipR ? +chipR.right.toFixed(1) : null,
      leftRight: left ? +left.right.toFixed(1) : null,
      rightLeft: right ? +right.left.toFixed(1) : null,
      gap: left && right ? +(right.left - left.right).toFixed(1) : null,
    };
  });
  console.log(`\n=== width ${width} ===`);
  console.log(JSON.stringify(boxes, null, 1));
  await p.close();
}
await b.close();

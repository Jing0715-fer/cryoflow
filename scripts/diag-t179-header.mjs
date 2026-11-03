// diag-t179-header.mjs — measure the header's free width at 280/390 to
// decide whether the palette trigger can come out of hiding (md:block).
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch();
for (const width of [280, 320, 390, 500, 640, 700, 768]) {
  const p = await b.newPage({ viewport: { width, height: 653 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const h = document.querySelector("header");
    const kids = [...h.children].map((c) => {
      const r = c.getBoundingClientRect();
      return { tag: c.tagName, w: Math.round(r.width) };
    });
    const trig = document.querySelector('[aria-label="Open command palette (Ctrl+K)"]');
    const trigVis = trig ? getComputedStyle(trig.closest("div") ?? trig).display : "absent";
    const trigW = trig ? Math.round(trig.getBoundingClientRect().width) : 0;
    return {
      scrollW: h.scrollWidth, clientW: h.clientWidth,
      over: h.scrollWidth - h.clientWidth, kids, trigVis, trigW,
    };
  });
  console.log(width, JSON.stringify(m));
  await p.close();
}
await b.close();

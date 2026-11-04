// diag-t111 — why can't the real click reach the QA Post 320 card?
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(1200);

const probe = await p.evaluate(() => {
  const card = [...document.querySelectorAll("[role=button]")].find((x) =>
    (x.textContent || "").includes("QA Post 320"),
  );
  if (!card) return { found: false };
  const r = card.getBoundingClientRect();
  const out = {
    found: true,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    hits: [],
  };
  const cands = [[0.5, 0.5], [0.5, 0.72], [0.35, 0.5], [0.5, 0.3]];
  for (const [fx, fy] of cands) {
    const x = Math.round(r.x + r.width * fx);
    const y = Math.round(r.y + r.height * fy);
    const top = document.elementFromPoint(x, y);
    out.hits.push({
      x, y,
      tag: top ? top.tagName : null,
      covered: top ? !card.contains(top) : null,
      desc: top ? `${top.getAttribute("data-canvas-ui") ?? top.getAttribute("data-testid") ?? top.className?.toString().slice(0, 60)}` : null,
    });
  }
  return out;
});
console.log(JSON.stringify(probe, null, 1));

// try the real click path anyway
if (probe.found) {
  const h = probe.hits.find((h) => !h.covered);
  if (h) {
    await p.mouse.click(h.x, h.y);
    await sleep(1500);
    const dlg = await p.evaluate(() => {
      const dl = [...document.querySelectorAll("[role=dialog]")].find((d) =>
        (d.textContent || "").includes("QA Post 320"),
      );
      return !!dl;
    });
    console.log("inspector opened?", dlg);
  } else {
    console.log("EVERY candidate point is covered — nothing to click");
  }
}
await b.close();

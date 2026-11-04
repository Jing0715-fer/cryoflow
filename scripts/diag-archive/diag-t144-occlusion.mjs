// diag-t144-occlusion.mjs — what is on top at QA Post 320's center?
import { chromium } from "playwright";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

const info = await p.evaluate(() => {
  const el = [...document.querySelectorAll('[role=button]')].find(
    (x) => (x.textContent || "").includes("QA Post 320"),
  );
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  const hit = document.elementFromPoint(cx, cy);
  const describe = (e) =>
    e
      ? `${e.tagName.toLowerCase()}${e.dataset?.canvasUi ? `[data-canvas-ui=${e.dataset.canvasUi}]` : ""}${e.dataset?.testid ? `[data-testid=${e.dataset.testid}]` : ""}${e.dataset?.job ? `[data-job]` : ""} cls="${(e.className?.baseVal ?? e.className ?? "").toString().slice(0, 90)}" txt="${(e.textContent || "").slice(0, 40)}"`
      : "null";
  // walk up from the hit to see which overlay owns it
  const chain = [];
  let cur = hit;
  for (let i = 0; cur && i < 6; i++) {
    chain.push(describe(cur));
    cur = cur.parentElement;
  }
  // also: is the card under any floating bar? bar rect:
  const kpi = document.querySelector('[data-canvas-ui="pipeline-kpi"]');
  const kr = kpi ? kpi.getBoundingClientRect() : null;
  return {
    found: true,
    cardRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    center: { cx, cy },
    hitDesc: describe(hit),
    chain,
    kpiRect: kr ? { x: Math.round(kr.x), y: Math.round(kr.y), w: Math.round(kr.width), h: Math.round(kr.height), right: Math.round(kr.right), bottom: Math.round(kr.bottom) } : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();

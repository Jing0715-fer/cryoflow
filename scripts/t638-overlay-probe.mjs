// t638 overlay probe — who intercepts the click point on the QA card?
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 20000 });
await p.waitForTimeout(3000);
const hit = await p.evaluate(() => {
  const out = {};
  const card = Array.from(document.querySelectorAll('[role="button"][aria-label]'))
    .find((c) => c.getAttribute("aria-label").startsWith("QA Class Select"));
  if (!card) return { err: "no card" };
  const r = card.getBoundingClientRect();
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  out.center = { cx: Math.round(cx), cy: Math.round(cy) };
  const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map((el) =>
    el.tagName +
    (el.getAttribute?.("aria-label") ? ` [${el.getAttribute("aria-label").slice(0, 50)}]` : "") +
    (el.className && typeof el.className === "string" ? ` .${el.className.split(" ").slice(0, 3).join(".")}` : "")
  );
  out.stack = stack;
  const cr = { l: r.x, t: r.y, r2: r.x + r.width, b: r.y + r.height };
  out.overlaps = Array.from(document.querySelectorAll('[role="button"][aria-label]'))
    .map((c) => ({ label: c.getAttribute("aria-label").slice(0, 40), r: c.getBoundingClientRect() }))
    .filter(({ r: o }) => o.left < cr.r2 && o.right > cr.l && o.top < cr.b && o.bottom > cr.t)
    .map(({ label, r: o }) => `${label} @(${Math.round(o.left)},${Math.round(o.top)}) ${Math.round(o.width)}x${Math.round(o.height)}`);
  return out;
});
console.log(JSON.stringify(hit, null, 1));
await b.close();

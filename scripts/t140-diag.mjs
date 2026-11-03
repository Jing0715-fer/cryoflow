// t140-diag — why does openInspector("QA Post 320") fail in t107/t108/t109?
// Boot the canvas, locate the QA Post 320 card, report:
//   1. its screen boundingBox + the world transform
//   2. what elementFromPoint(center) returns (occluder hunt)
//   3. whether a real click opens the inspector dialog
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1500);

const info = await p.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-job]")];
  const card = cards.find((el) => (el.textContent || "").includes("QA Post 320"));
  if (!card) return { found: false, cards: cards.length };
  const r = card.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const at = document.elementFromPoint(cx, cy);
  const chain = [];
  let n = at;
  while (n && chain.length < 6) {
    chain.push(
      `${n.tagName?.toLowerCase?.()}${n.getAttribute?.("data-canvas-ui") ? `[ui=${n.getAttribute("data-canvas-ui")}]` : ""}${n.getAttribute?.("data-job") ? `[job=${n.getAttribute("data-job").slice(0, 8)}]` : ""}${n.getAttribute?.("class") ? `.${String(n.getAttribute("class")).split(" ").slice(0, 3).join(".")}` : ""}`,
    );
    n = n.parentElement;
  }
  const ws = document.querySelector("[data-canvas='workspace']");
  const t = getComputedStyle(ws).transform;
  return {
    found: true,
    cards: cards.length,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    center: { cx: Math.round(cx), cy: Math.round(cy) },
    inViewport: cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight,
    hitIsCard: at ? !!at.closest("[data-job]") : false,
    hitChain: chain,
    transform: t,
  };
});
console.log(JSON.stringify(info, null, 2));

if (info.found && info.inViewport) {
  await p.mouse.click(info.center.cx, info.center.cy);
  await sleep(1500);
  const dlg = await p.evaluate(() => {
    const dl = [...document.querySelectorAll("[role=dialog]")].find((d) =>
      (d.textContent || "").includes("QA Post 320"),
    );
    return dl ? "MODAL" : "NONE";
  });
  console.log("after real mouse click at center → dialog:", dlg);
}

await b.close();

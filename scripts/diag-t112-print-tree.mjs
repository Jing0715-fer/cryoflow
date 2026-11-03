// t112 diagnosis — print-media tree geometry for the inspector report.
// Emulates print media via CDP and reads the layout the paper will see.
import { chromium } from "playwright";

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(B, { waitUntil: "networkidle" });
await p.waitForTimeout(4000);

// land on the canvas view (fresh profile opens the dashboard)
const onDash = await p.evaluate(() =>
  (document.querySelector("h1")?.textContent || "").includes("Dashboard")
);
if (onDash) {
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(1500);
}

// open the inspector on the seeded host job (completed → Results tab)
for (let i = 0; i < 8; i++) {
  const card = p.locator("[role=button]", { hasText: "QA Post 320" }).first();
  if ((await card.count()) > 0) {
    await card.click();
    await p.waitForTimeout(1800);
    if (await p.evaluate(() => !!document.querySelector("[data-inspector-dialog]"))) break;
  }
  await p.waitForTimeout(1500);
}
await p.waitForTimeout(1000);
await p.evaluate(() => {
  const t = [...document.querySelectorAll("[role=tab]")].find(
    (x) => x.textContent.trim() === "Results"
  );
  t?.click();
});
await p.waitForTimeout(2500);

await p.emulateMedia({ media: "print" });
await p.waitForTimeout(800);

const info = await p.evaluate(() => {
  const dl = document.querySelector('[data-inspector-dialog]');
  const ov = document.querySelector('[data-slot="dialog-overlay"]');
  const doc = document.querySelector('[data-inspector-print-doc]');
  const view = document.querySelector("[data-view]");
  const kids = dl ? [...dl.children].map((c) => {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return {
      tag: c.tagName.toLowerCase(),
      hook: c.getAttribute("data-inspector-print-doc") != null ? "PRINT-DOC" : (c.getAttribute("data-slot") || c.getAttribute("data-log-console") || ""),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      display: cs.display, position: cs.position,
    };
  }) : null;
  const strip = [...document.querySelectorAll("p")].find((x) => /CryoFlow job report · printed/.test(x.textContent || ""));
  return {
    viewDisplay: view ? getComputedStyle(view).display : "no-view",
    overlay: ov ? { position: getComputedStyle(ov).position, display: getComputedStyle(ov).display, w: ov.getBoundingClientRect().width } : null,
    dialog: dl ? {
      position: getComputedStyle(dl).position,
      display: getComputedStyle(dl).display,
      transform: getComputedStyle(dl).transform,
      height: getComputedStyle(dl).height,
      rect: (() => { const r = dl.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    } : null,
    masthead: doc ? {
      display: getComputedStyle(doc).display,
      rect: (() => { const r = doc.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      text: (doc.textContent || "").replace(/\s+/g, " ").slice(0, 120),
    } : null,
    strip: strip ? {
      position: getComputedStyle(strip).position,
      rect: (() => { const r = strip.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; })(),
      display: getComputedStyle(strip).display,
    } : null,
    kids,
    bodyScroll: { x: window.scrollX, y: window.scrollY, w: document.body.scrollWidth, h: document.body.scrollHeight },
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: "/home/z/my-project/.qa-logs/t112-print-emulated.png", fullPage: false });
await b.close();

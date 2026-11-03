// t249 probe — the paper evidence hearing (Task 249).
// The oldest standing verdict "hero 纸档叠印可读性 (维持, 依赖真实打印证据)"
// has waited for REAL paper evidence for eight windows. This probe
// manufactures it: the session report is the one dialog that IS a document
// (print CSS lives), so chromium's print emulation + page.pdf() IS the
// print pipeline. Quantify the overlap: every signature's bbox vs the
// terrain strokes it sits on — 7px full-ink text on a 1.25-wide line.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 940 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

await page.locator('header [aria-label="Session QC report"]').click();
await page.locator("[data-report-doc]").waitFor({ state: "visible", timeout: 15000 });
await page.waitForTimeout(2500);

const heroInfo = await page.evaluate(() => {
  const svg = document.querySelector("[data-report-body] svg.report-hero-landscape");
  if (!svg) return { hero: false };
  const labels = [...svg.querySelectorAll("text.report-hero-label")].map((t) => ({
    text: t.textContent,
    bbox: t.getBBox(),
  }));
  const paths = [...svg.querySelectorAll("path.report-hero-main, path.report-hero-overlay")].map(
    (p) => ({ cls: p.getAttribute("class"), d: p.getAttribute("d")?.slice(0, 40) }),
  );
  const marks = [...svg.querySelectorAll("line")].map((l) => ({
    cls: l.getAttribute("class"),
    x1: l.getAttribute("x1"),
  }));
  return { hero: true, labels, pathCount: paths.length, marks };
});
console.log("heroInfo:", JSON.stringify(heroInfo, null, 1).slice(0, 1600));

if (heroInfo.hero) {
  const hero = page.locator("[data-report-body] .report-hero");
  await hero.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await hero.screenshot({ path: `${SHOTS}/t249-probe-hero-screen-2x.png` });
  console.log("screen hero shot saved");
}

// quantified overlap: signature bbox vs terrain path ink
const overlap = await page.evaluate(() => {
  const svg = document.querySelector("[data-report-body] svg.report-hero-landscape");
  if (!svg) return null;
  const labels = [...svg.querySelectorAll("text.report-hero-label")];
  const strokes = [...svg.querySelectorAll("path.report-hero-main, path.report-hero-overlay")];
  // sample points along each stroke's d attribute are unavailable cheaply —
  // use getPointAtLength sampling on the path element
  const out = [];
  for (const t of labels) {
    const bb = t.getBBox();
    const pad = 0.5;
    const box = { x: bb.x - pad, y: bb.y - pad, w: bb.width + pad * 2, h: bb.height + pad * 2 };
    let crossings = 0;
    const perPath = [];
    for (const p of strokes) {
      const L = p.getTotalLength?.() ?? 0;
      let hit = 0;
      for (let i = 0; i <= 220; i++) {
        try {
          const pt = p.getPointAtLength((i / 220) * L);
          if (pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h) hit++;
        } catch { /* tiny path */ }
      }
      if (hit > 0) perPath.push({ cls: p.getAttribute("class"), samplesInBox: hit });
      crossings += hit;
    }
    out.push({ text: t.textContent, crossings, perPath });
  }
  return out;
});
console.log("overlap:", JSON.stringify(overlap, null, 1).slice(0, 2000));

// the print medium — the real paper pipeline
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(400);
const printTier = await page.evaluate(() => {
  const svg = document.querySelector("[data-report-body] svg.report-hero-landscape");
  if (!svg) return null;
  const g = (sel, prop) => {
    const el = svg.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : null;
  };
  return {
    labelOpacity: g("text.report-hero-label", "fillOpacity"),
    depthOpacity: g("text.report-hero-depth", "fillOpacity"),
    mainStroke: g("path.report-hero-main", "strokeOpacity"),
    overlayStroke: g("path.report-hero-overlay", "strokeOpacity"),
  };
});
console.log("printTier:", JSON.stringify(printTier));
if (heroInfo.hero) {
  const hero = page.locator("[data-report-body] .report-hero");
  await hero.screenshot({ path: `${SHOTS}/t249-probe-hero-print-2x.png` });
  console.log("print hero shot saved");
}

await page.pdf({ path: `${SHOTS}/t249-probe-paper.pdf`, format: "A4", printBackground: true });
console.log("paper PDF saved");

await browser.close();

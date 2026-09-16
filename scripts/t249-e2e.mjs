// t249 — the paper evidence hearing (Task 249).
// The oldest standing verdict in the backlog — "hero 纸档叠印可读性 (维持,
// 依赖真实打印证据)" — waited eight windows for REAL paper evidence. This
// suite manufactures it and rules on it. The session report is the one
// dialog that IS a document, so chromium's print emulation IS the print
// pipeline: the probe (t249-probe.mjs) quantified the overlap (all three
// demo signatures cross terrain strokes — 42 samples inside ONE bbox) and
// the print tier's own law convicted it: paper deepens EVERY ink to the
// same plate, so a 7px full-ink signature fuses with the full-ink 1.25
// line it sits on. VERDICT: the halo ban's first lawful breach — paper
// gets a stroke of PAPER painted under the signature's fill
// (paint-order: stroke), the terrain yields around the glyphs, the ink
// budget never grows. On screen the ban STANDS (0.62 ink vs deeper
// terrain is the whole hierarchy working as designed).
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  the evidence — the hero stands, its signatures cross the terrain
//      (the overlap is quantified live: stroke samples inside signature
//      bboxes), the print tier's opacity ladder is re-checked pair for
//      pair (t231's order survives)
//   C  the verdict — screen: the halo ban stands (no stroke, 0.62 ink);
//      print: the exception rides (paint-order stroke, paper-colored
//      stroke, fill still 1)
//   D  the dossier — the print-media hero frame + the real PDF artifact
//   E  console clean
//
// Run: node scripts/t249-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 940 }, deviceScaleFactor: 2 });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// ---- Phase A: demo truth ------------------------------------------------------
console.log("== PHASE A: demo truth ==");
const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
must(res.status() === 200, `homepage 200 (got ${res.status()})`);
await sleep(2500);
const roster = await page.evaluate(async () => {
  const r = await fetch("/api/jobs");
  return (await r.json()).jobs.length;
});
must(roster === 21, `roster identity 21 (got ${roster})`);

// ---- Phase B: the evidence -----------------------------------------------------
console.log("== PHASE B: the overlap, quantified ==");
await page.locator('header [aria-label="Session QC report"]').click();
const report = page.locator("[data-report-doc]");
await report.waitFor({ state: "visible", timeout: 15000 });
await sleep(2500); // the hero rides the mapQc fetch

const hero = page.locator("[data-report-body] .report-hero");
must((await hero.count()) === 1, "the hero landscape stands in the report");

// the overlap live: every signature's bbox vs the terrain strokes around it
const overlap = await page.evaluate(() => {
  const svg = document.querySelector("[data-report-body] svg.report-hero-landscape");
  if (!svg) return null;
  const labels = [...svg.querySelectorAll("text.report-hero-label")];
  const strokes = [
    ...svg.querySelectorAll("path.report-hero-main, path.report-hero-overlay"),
  ];
  return labels.map((t) => {
    const bb = t.getBBox();
    const pad = 0.5;
    let crossings = 0;
    for (const p of strokes) {
      const L = p.getTotalLength?.() ?? 0;
      for (let i = 0; i <= 220; i++) {
        try {
          const pt = p.getPointAtLength((i / 220) * L);
          if (
            pt.x >= bb.x - pad && pt.x <= bb.x + bb.width + pad &&
            pt.y >= bb.y - pad && pt.y <= bb.y + bb.height + pad
          ) crossings++;
        } catch { /* degenerate path */ }
      }
    }
    return { text: t.textContent, crossings };
  });
});
must((overlap?.length ?? 0) >= 1, `the hero signs itself (${overlap?.length} signatures)`);
const crossing = overlap?.filter((o) => o.crossings > 0) ?? [];
must(
  crossing.length >= 1,
  `the overlap is REAL — ${crossing.length}/${overlap?.length} signatures cross terrain strokes (${crossing.map((c) => `${c.text}: ${c.crossings}`).join(", ")})`,
);

// ---- Phase C: the verdict -------------------------------------------------------
console.log("== PHASE C: screen keeps the ban, paper takes the exception ==");
const inkOf = async (sel, prop) =>
  page
    .locator(`[data-report-body] svg.report-hero-landscape ${sel}`)
    .first()
    .evaluate((el, p) => getComputedStyle(el)[p], prop);

// SCREEN — the ban stands: no halo, the 0.62 ink is the hierarchy
const screenStroke = await inkOf("text.report-hero-label", "stroke");
const screenFill = await inkOf("text.report-hero-label", "fillOpacity");
must(
  (screenStroke === "none" || screenStroke === "rgba(0, 0, 0, 0)") && screenFill === "0.62",
  `SCREEN: the halo ban stands (stroke ${screenStroke}, ink ${screenFill})`,
);

// PRINT — the exception rides: paper under the glyphs, fill still full
await page.emulateMedia({ media: "print" });
await sleep(400);
const printStroke = await inkOf("text.report-hero-label", "stroke");
const printFill = await inkOf("text.report-hero-label", "fillOpacity");
const printPaintOrder = await inkOf("text.report-hero-label", "paintOrder");
must(
  printPaintOrder === "stroke",
  `PRINT: paint-order is stroke (got ${printPaintOrder})`,
);
must(
  printStroke !== "none" && printStroke !== "",
  `PRINT: the paper stroke rides (got ${printStroke})`,
);
must(printFill === "1", `PRINT: the signature's ink stays full (got ${printFill})`);

// t231's ladder re-checked pair for pair — the exception added no new rung
const ladder = {
  label: parseFloat(await inkOf("text.report-hero-label", "fillOpacity")),
  depth: parseFloat(await inkOf("text.report-hero-depth", "fillOpacity")),
  markOverlay: parseFloat(await inkOf("line.report-hero-mark-overlay", "strokeOpacity")),
  // the quarter grid draws as <line> elements (probe: x1 = 120/240/360),
  // not paths — the selector must speak the element's own truth
  quarter: parseFloat(await inkOf("line.report-hero-quarter", "strokeOpacity")),
};
must(
  ladder.label === 1 && ladder.depth === 0.85 && ladder.markOverlay === 0.6 && ladder.quarter === 0.3,
  `PRINT: t231's opacity ladder unchanged (label 1 > depth ${ladder.depth} > markOverlay ${ladder.markOverlay} > quarter ${ladder.quarter})`,
);

// ---- Phase D: the dossier --------------------------------------------------------
console.log("== PHASE D: the dossier ==");
const heroEl = page.locator("[data-report-body] .report-hero");
mkdirSync(SHOTS, { recursive: true });
await heroEl.screenshot({ path: `${SHOTS}/t249-paper-verdict-hero-2x.png` });
console.log(`  frame: ${SHOTS}/t249-paper-verdict-hero-2x.png`);
await page.pdf({ path: `${SHOTS}/t249-paper-verdict.pdf`, format: "A4", printBackground: true });
console.log(`  dossier: ${SHOTS}/t249-paper-verdict.pdf`);
await page.emulateMedia({ media: "screen" });

// ---- Phase E: console -------------------------------------------------------------
console.log("== PHASE E: console ==");
must(consoleErrors.length === 0, `console clean (got ${consoleErrors.length}: ${consoleErrors.join(" | ") || "—"})`);

await browser.close();
console.log(fail === 0 ? "t249: ALL PASS" : `t249: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

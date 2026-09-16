// t248 — the stray keys come home (Task 248).
// Task 247's testimony-badge law demanded an audit: which LIVE keys have no
// row in the shortcuts report? The audit walked every keydown handler in
// the app (page.tsx global, palette, canvas-find-bar, session-report,
// dashboard, gallery — the widget-level Enter/Space/Esc keys are not
// members of the app keyboard layer) and found exactly TWO undocumented
// live keys, both in the add-job palette:
//   "/"          focuses the palette search (window listener, alive while
//                the catalog tab is mounted)
//   Alt+←/→      reorders favorite chips — the palette's own comment calls
//                it "the keyboard twin of the drag"
// A live key with no row is a drift: this suite archives both rows in the
// canvas group (search beside find, reorder beside duplicate) and proves
// the KEYS still do what the rows say — the doc and the handlers are one
// keyboard layer, asserted live.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  "/" live — press / → the palette search owns focus; type filters
//      the catalog; Esc peels twice (clears the query, then blurs)
//   C  Alt+←/→ live — a synthetic favorites world (localStorage, context-
//      local so the demo box stays clean): three chips, Alt+ArrowRight
//      moves the first chip right, Alt+ArrowLeft brings it home; NO job is
//      ever added (moveFav writes localStorage only — roster stays 21)
//   D  the doc — the canvas group carries 17 rows with both new keys
//      seated beside their semantic siblings; filter "palette" shows the
//      three palette truths at once
//   E  console clean + the frame
//
// Run: node scripts/t248-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";
const FAV_KEY = "cryoflow-fav-types";
const FAVS = ["import", "motioncorr", "ctffind"];

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1480, height: 940 },
  deviceScaleFactor: 2,
});
// the synthetic favorites world rides the context's localStorage — it
// evaporates with the context, the demo box never sees it
await context.addInitScript(
  ([k, v]) => localStorage.setItem(k, v),
  [FAV_KEY, JSON.stringify(FAVS)],
);
const page = await context.newPage();
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

// ---- Phase B: "/" is alive -----------------------------------------------------
console.log("== PHASE B: / focuses the palette search ==");
const search = page.locator('input[aria-label="Search job types"]');
must((await search.count()) === 1, "the catalog tab's palette search is on the page");

await page.keyboard.press("/");
await sleep(300);
let focused = await page.evaluate(() => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement ? el.getAttribute("aria-label") : null;
});
must(focused === "Search job types", `/ focuses the palette search (focused: ${focused})`);

await page.keyboard.type("import");
await sleep(400);
const chipLabels = await page.evaluate(() =>
  [...document.querySelectorAll('[data-panelpalette-root] [data-slot]')].length,
);
const importChip = await page
  .locator('button', { hasText: "Import Movies / Micrographs" })
  .count();
must(importChip >= 1, `typing filters the catalog to the import chip (hits: ${importChip})`);
void chipLabels;

await page.keyboard.press("Escape"); // layer 1: clear the query
await sleep(250);
must(
  (await search.inputValue()) === "",
  "Esc layer 1 clears the query (the search's own peel law)",
);
await page.keyboard.press("Escape"); // layer 2: blur
await sleep(250);
focused = await page.evaluate(() =>
  document.activeElement instanceof HTMLInputElement
    ? document.activeElement.getAttribute("aria-label")
    : null,
);
must(focused !== "Search job types", `Esc layer 2 blurs the search (focused: ${focused})`);

// ---- Phase C: Alt+←/→ is alive --------------------------------------------------
console.log("== PHASE C: Alt+arrows reorder the favorites ==");
const chips = page.locator("[data-fav-chip]");
must((await chips.count()) === FAVS.length, `the synthetic favorites render ${FAVS.length} chips (got ${await chips.count()})`);

const chipLabel = async (i) =>
  (await chips.nth(i).getAttribute("data-testid"))?.replace("palette-fav-chip-", "") ?? "";

const first0 = await chipLabel(0);
must(first0 === FAVS[0], `seed order reads the type key (chip0 = "${first0}")`);

// focus the first chip WITHOUT clicking — a click would ADD the job
// (the chip's own add contract); the keyboard path needs focus only
await chips.nth(0).focus();
await page.keyboard.press("Alt+ArrowRight");
await sleep(350);
const first1 = await chipLabel(0);
must(
  first1 === FAVS[1],
  `Alt+→ moves chip0 right (chip0 = "${first1}" — the twin moved it)`,
);

await page.keyboard.press("Alt+ArrowLeft");
await sleep(350);
const first2 = await chipLabel(0);
must(
  first2 === FAVS[0],
  `Alt+← brings the chip home (chip0 = "${first2}")`,
);

const rosterAfter = await page.evaluate(async () => {
  const r = await fetch("/api/jobs");
  return (await r.json()).jobs.length;
});
must(rosterAfter === 21, `the reorder added NO job — roster still 21 (got ${rosterAfter})`);

// ---- Phase D: the doc -----------------------------------------------------------
console.log("== PHASE D: the rows are seated beside their siblings ==");
await page.keyboard.press("?");
await sleep(900);
const doc = page.locator('[role="dialog"]');
const canvasGroup = doc.locator('section[aria-label="Canvas shortcuts"]');
must((await canvasGroup.count()) === 1, "the Canvas group is present");

const rows = canvasGroup.locator("dl > div");
must((await rows.count()) === 17, `the group carries 17 rows (got ${await rows.count()})`);
const rowChips = await rows.evaluateAll((els) =>
  els.map((r) => [...r.querySelectorAll("dt kbd")].map((k) => k.textContent).join(" ")),
);
must(
  rowChips[2] === "/" && rowChips[3] === "← → ↑ ↓",
  `the "/" row seats beside find (row[2] = "${rowChips[2]}")`,
);
must(
  rowChips[10] === "Alt ← →" && rowChips[9] === "⌘/Ctrl D",
  `the reorder row seats beside duplicate (row[10] = "${rowChips[10]}")`,
);
const rowTexts = await rows.evaluateAll((els) =>
  els.map((r) => (r.querySelector("dd")?.textContent ?? "").replace(/\s+/g, " ").trim()),
);
must(
  rowTexts[2].includes("Focus the palette search"),
  `the "/" row speaks the truth (got "${rowTexts[2]}")`,
);
must(
  rowTexts[10].includes("keyboard twin of dragging"),
  `the Alt row speaks the palette's own law (got "${rowTexts[10]}")`,
);

// the three palette truths at once — filter "palette"
const filterInput = doc.locator("input[aria-label='Filter shortcuts']");
await filterInput.fill("palette");
await sleep(400);
const groupsVisible = await doc.locator("section").count();
must(groupsVisible === 3, `filter "palette" shows the Global, Not-in-⌘K and Canvas groups (got ${groupsVisible})`);
await page.keyboard.press("Escape");
await sleep(400);

// ---- Phase E: console + frame ---------------------------------------------------
console.log("== PHASE E: console + frame ==");
await page.keyboard.press("?");
await sleep(900);
const doc2 = page.locator('[role="dialog"]');
await doc2.locator("input[aria-label='Filter shortcuts']").fill("palette");
await sleep(400);
mkdirSync(SHOTS, { recursive: true });
await doc2.screenshot({ path: `${SHOTS}/t248-stray-keys-home-2x.png` });
console.log(`  frame: ${SHOTS}/t248-stray-keys-home-2x.png`);
must(consoleErrors.length === 0, `console clean (got ${consoleErrors.length}: ${consoleErrors.join(" | ") || "—"})`);

await browser.close();
console.log(fail === 0 ? "t248: ALL PASS" : `t248: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

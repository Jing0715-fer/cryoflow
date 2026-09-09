// t79 probe — dashboard print clipping diagnosis.
// Hypothesis: the dashboard root is `min-h-0 flex-1 overflow-y-auto` inside
// a `h-dvh` flex shell, and the Jobs roster is `max-h-80 overflow-y-auto`.
// In Chromium print, fixed-height ancestors + inner scroll containers clip
// the paper to one page and the roster to 320px. Task 74-78 print QA only
// ever targeted the CANVAS view; qa76's dashboard print leg asserts a name
// PRESENT, never that every row arrives. Measure, don't guess.
// Run: node scripts/t79-print-probe.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs/t79-dash-print.pdf";
rmSync(OUT, { force: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

// to dashboard
for (let i = 0; i < 4; i++) {
  const v = await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view"));
  if (v === "dashboard") break;
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(700);
}
const view = await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view"));
console.log(`view: ${view}`);

// SCREEN measurements
const screen = await p.evaluate(() => {
  const q = (sel) => document.querySelector(sel);
  // dashboard root = the flex-1 overflow-y-auto div (Direct Project management wrapper)
  const root = q('section[aria-label="Active project spotlight"]')?.closest("div.min-h-0.flex-1");
  const roster = q('section[aria-label="Active project spotlight"] .max-h-80');
  const rows = [...q('section[aria-label="Active project spotlight"]')?.querySelectorAll(".max-h-80 > *") ?? []];
  return {
    rootClient: root?.clientHeight ?? null,
    rootScroll: root?.scrollHeight ?? null,
    rosterClient: roster?.clientHeight ?? null,
    rosterScroll: roster?.scrollHeight ?? null,
    rowCount: rows.length,
    firstRow: rows[0]?.textContent?.slice(0, 40) ?? null,
    lastRow: rows[rows.length - 1]?.textContent?.slice(0, 40) ?? null,
  };
});
console.log("SCREEN:", JSON.stringify(screen, null, 2));

// PRINT emulation measurements
await p.emulateMedia({ media: "print" });
await p.waitForTimeout(300);
const print = await p.evaluate(() => {
  const q = (sel) => document.querySelector(sel);
  const root = q('section[aria-label="Active project spotlight"]')?.closest("div.min-h-0.flex-1");
  const roster = q('section[aria-label="Active project spotlight"] .max-h-80');
  return {
    rootClient: root?.clientHeight ?? null,
    rootScroll: root?.scrollHeight ?? null,
    rosterClient: roster?.clientHeight ?? null,
    rosterScroll: roster?.scrollHeight ?? null,
    bodyH: document.body.scrollHeight,
  };
});
console.log("PRINT:", JSON.stringify(print, null, 2));

await p.pdf({ path: OUT, printBackground: true, preferCSSPageSize: false, format: "A4" });
await p.emulateMedia({ media: "screen" });
await b.close();

const info = execSync(`pdfinfo ${OUT} 2>/dev/null || true`, { encoding: "utf8" });
const pages = info.match(/Pages:\s+(\d+)/)?.[1] ?? "?";
console.log(`PDF pages: ${pages}`);
const txt = execSync(`pdftotext ${OUT} -`, { encoding: "utf8" }).replace(/\s+/g, "").toLowerCase();
const first = screen.firstRow?.replace(/\s+/g, "").toLowerCase().slice(0, 24) ?? "";
const last = screen.lastRow?.replace(/\s+/g, "").toLowerCase().slice(0, 24) ?? "";
console.log(`first row on paper: ${first && txt.includes(first) ? "YES" : "NO"} (${first})`);
console.log(`last  row on paper: ${last && txt.includes(last) ? "YES" : "NO"} (${last})`);
console.log(`pageerrors: ${errs.length}`);

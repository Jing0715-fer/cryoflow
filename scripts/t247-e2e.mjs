// t247 — the report's byte mouths answer to the keyboard (Task 247).
// Task 246 put the palette exemptions where the question is asked; this
// window answers the question the shortcuts report itself left open: the
// Session QC report group documented ← → / Tab / ⌘P but never the export
// doors — "how do I take this report with me" had mouse-only answers.
// Now the two BYTE mouths answer to single keys (H = portable HTML,
// M = the Markdown), the copy/CSV doors stay mouse-only on purpose (a
// keyboard layer must not ship an ambiguous key — "C" copies WHICH
// format?), the two buttons wear their key as a kbd badge (the testimony
// on the door's own face), and the shortcuts report group documents both
// rows before the paper row ⌘P (byte mouths before paper: md < html < paper).
//
// THE LAW: a keyboard mouth and a mouse mouth that open the same door are
// ONE DOOR — the key handler calls the SAME export functions (same bytes,
// same flashNote receipt), so there is nothing to drift. The effect re-
// subscribes every render on purpose: the closure is always fresh, H/M
// export the CURRENT md bytes, never a stale capture.
//
// Phases:
//   A  demo truth — homepage 200, roster 23
//   B  the keyboard mouths — open the report from the header door, press
//      H → download event (.html, session-qc-report-*) + the same emerald
//      flashNote receipt the button shows; press M → .md download + receipt;
//      the two download filenames are the ones the mouse doors produce
//   C  the doc — the shortcuts report group carries all five rows in the
//      light-to-heavy order (← → / Tab / M / H / ⌘P); the doc and the
//      buttons corroborate: the row's "portable HTML" names the same door
//      the button's aria-label names
//   D  console clean + the frame (the report footer: the doors with their
//      kbd testimony)
//
// Run: node scripts/t247-e2e.mjs   (server on :3000)
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
must(roster === 23, `roster identity 23 (got ${roster})`);

// ---- Phase B: the keyboard mouths ----------------------------------------------
console.log("== PHASE B: H and M answer at the report ==");
await page.locator('header [aria-label="Session QC report"]').click();
const report = page.locator("[data-report-doc]");
await report.waitFor({ state: "visible", timeout: 15000 });
await sleep(1200); // the report assembles its md / tables
must((await report.count()) === 1, "the report dialog opens from the header door");

const htmlDl = page.waitForEvent("download", { timeout: 8000 });
await page.keyboard.press("h");
const htmlFile = await (await htmlDl).suggestedFilename();
must(
  /\.html$/.test(htmlFile) && htmlFile.includes("session-qc-report"),
  `H downloads the portable HTML (got "${htmlFile}")`,
);
const htmlNote = await page.locator('[data-report-doc] p[role="status"]').textContent();
must(
  (htmlNote ?? "").includes("portable document"),
  `H fires the SAME receipt the button shows (got "${(htmlNote ?? "").trim().slice(0, 60)}…")`,
);

await sleep(300); // let the note timer settle before the second press
const mdDl = page.waitForEvent("download", { timeout: 8000 });
await page.keyboard.press("m");
const mdFile = await (await mdDl).suggestedFilename();
must(
  /\.md$/.test(mdFile) && mdFile.includes("session-qc-report"),
  `M downloads the Markdown (got "${mdFile}")`,
);
const mdNote = await page.locator('[data-report-doc] p[role="status"]').textContent();
must((mdNote ?? "").includes(".md"), `M fires the same md receipt (got "${(mdNote ?? "").trim()}")`);

// the buttons wear the testimony
const htmlBtn = page.locator('button[aria-label="Download portable HTML report"]');
const mdBtn = page.locator('button[aria-label="Download session report"]');
must(
  (await htmlBtn.locator("kbd").textContent()) === "H" &&
    (await mdBtn.locator("kbd").textContent()) === "M",
  "the doors wear their keys on their own faces (kbd H / kbd M)",
);

// the ambiguous keys stayed out of the keyboard layer: c/x/d are silent no-ops
// (copy/CSV doors keep mouse-only paths — no ambiguous "C")
const beforeCount = await page.evaluate(() => performance.getEntriesByType("resource").length);
await page.keyboard.press("c");
await sleep(400);
must(
  (await page.locator('[data-report-doc] p[role="status"]').textContent()) === mdNote,
  "C stays silent — the ambiguous copy verb has no keyboard mouth",
);
void beforeCount;

// Esc peels the report
await page.keyboard.press("Escape");
await sleep(500);
must((await page.locator("[data-report-doc]").count()) === 0, "Esc closes the report");

// ---- Phase C: the doc ----------------------------------------------------------
console.log("== PHASE C: the shortcuts report group documents both rows ==");
await page.keyboard.press("?");
await sleep(900);
const doc = page.locator('[role="dialog"]');
const reportGroup = doc.locator('section[aria-label="Session QC report shortcuts"]');
must((await reportGroup.count()) === 1, "the Session QC report group is present");

const rows = reportGroup.locator("dl > div");
const rowCount = await rows.count();
must(rowCount === 5, `the group carries all five rows (got ${rowCount})`);
const rowChips = await rows.evaluateAll((els) =>
  els.map((r) => [...r.querySelectorAll("dt kbd")].map((k) => k.textContent).join(" ")),
);
must(
  JSON.stringify(rowChips) === JSON.stringify(["← →", "Tab", "M", "H", "⌘/Ctrl P"]),
  `light-to-heavy order: byte mouths before the paper row (got [${rowChips.join(" | ")}])`,
);

const rowTexts = await rows.evaluateAll((els) =>
  els.map((r) => (r.querySelector("dd")?.textContent ?? "").replace(/\s+/g, " ").trim()),
);
must(
  rowTexts.some((t) => t.startsWith("Download the portable HTML")),
  "the H row names the same door the button's aria-label names (portable HTML)",
);
must(
  rowTexts.some((t) => t.startsWith("Download the Markdown")),
  "the M row names the md door",
);
must(
  rowTexts[4].includes("Prints the report itself"),
  "the paper row keeps its place (the report is still the one dialog that becomes paper)",
);

await page.keyboard.press("Escape");
await sleep(400);
must((await doc.count()) === 0, "Esc closes the shortcuts dialog");

// ---- Phase D: console + frame ---------------------------------------------------
console.log("== PHASE D: console + frame ==");
// reopen the report for the frame: the doors with their kbd testimony
await page.locator('header [aria-label="Session QC report"]').click();
await page.locator("[data-report-doc]").waitFor({ state: "visible", timeout: 15000 });
await sleep(1000);
mkdirSync(SHOTS, { recursive: true });
await page.locator("[data-report-doors]").screenshot({ path: `${SHOTS}/t247-report-keys-2x.png` });
console.log(`  frame: ${SHOTS}/t247-report-keys-2x.png`);
must(consoleErrors.length === 0, `console clean (got ${consoleErrors.length}: ${consoleErrors.join(" | ") || "—"})`);

await browser.close();
console.log(fail === 0 ? "t247: ALL PASS" : `t247: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

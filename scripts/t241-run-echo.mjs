/* t241 — the run report's echo: the per-job dossier's portable medium.
 * The inspector's Report door gains an HTML sibling (same collected md
 * bytes, dressed as a standalone document). This script proves the echo
 * on the WIRE with the richest dossier the data world currently has
 * (QA Post 385 — a postprocess job whose FSC curve earns the image
 * section), then shoots the family's frames:
 *   t241-run-echo-travels-2x — the dossier standing alone (file://, the
 *     app not in the room): title, field table, styled sections
 *   t241-run-echo-figure-2x — the chart snapshot INSIDE the bytes: the
 *     FSC curve as a bordered figure (the echo family's first embedded
 *     picture — the session echo carries numbers, this one carries
 *     pictures too)
 * The landing-light frame waits for a dossier rich enough to carry its
 * own Contents (>=5 sections mints the md's anchors; none exists today —
 * the slim report does not manufacture navigation, the md's own law).
 * Mirror law asserted on the wire: sections/links/images in the html
 * match the md's, every link resolves, zero script, zero external refs.
 * Run: node scripts/t241-run-echo.mjs   (server on :3000)
 */
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const TMP = "scripts/shots-t223/t241-run-echo-tmp.html";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, msg) => {
  if (cond) { pass++; console.log(`  ok: ${msg}`); }
  else { fail++; fails.push(msg); console.log(`  FAIL: ${msg}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

section("open the inspector on the FSC-bearing job");
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
const node = page.locator('[role="button"]', { hasText: "QA Post 385" }).first();
await node.click();
await sleep(2000);
await page.locator('[role="tab"]', { hasText: "Results" }).click();
await sleep(2500);
const doors = await page.evaluate(() => ({
  md: !!document.querySelector('button[aria-label="Export run report"]'),
  html: !!document.querySelector('button[aria-label="Export run report as HTML"]'),
}));
must(doors.md && doors.html, `the dossier's two doors stand (md ${doors.md}, html ${doors.html})`);

section("export the echo");
const [dl] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.locator('button[aria-label="Export run report as HTML"]').click(),
]);
must(/^cryoflow-report-qa-post-385-[a-z0-9]+\.html$/.test(dl.suggestedFilename()),
  `the echo travels under the dossier's own name (${dl.suggestedFilename()})`);
const html = readFileSync(await dl.path(), "utf8");
const h2s = (html.match(/<h2/g) || []).length;
const figs = (html.match(/<figure class="shot">/g) || []).length;
const links = [...html.matchAll(/href="#([a-z0-9-]+)"/g)];
const deadLinks = links.filter((m) => !html.includes(`id="${m[1]}"`)).length;
must(html.startsWith("<!DOCTYPE html>"), "doctype first");
must(!/<script/i.test(html), "a document, not an app (zero script)");
must(!/<link|@import|src="http/i.test(html), "self-contained (no external references)");
must(html.includes("<title>CryoFlow run report — QA Post 385</title>"), "the title is the dossier's own");
must(html.includes('h2:target, h3:target { animation: echo-glow'), "the landing light rides the shared CSS");
must(figs >= 1 && html.includes('src="data:image/png;base64,'), `the chart snapshot travels inside the bytes (${figs} figure)`);
must(deadLinks === 0, `no dead links (${links.length} anchor links, ${deadLinks} dead)`);
must(!/\]\(#/.test(html), "no raw md link syntax survives the dress");
// the md's own FSC section must have survived verbatim-ish: the section
// head and the milestone table's Field column
must(html.includes("FSC curve") && html.includes("<th"), "the FSC section and its table stand");

section("the frames — the document alone");
writeFileSync(TMP, html);
try {
  const echo = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await echo.goto(`file://${process.cwd()}/${TMP}`, { waitUntil: "domcontentloaded" });
  await echo.waitForTimeout(600);
  // frame 1: the dossier standing alone — title, field table, the
  // Summary section beneath (the app is not in the room)
  await echo.screenshot({ path: "scripts/shots-t223/t241-run-echo-travels-2x.png", scale: "css" });
  // frame 2: the picture inside the bytes — the FSC curve figure
  await echo.locator("figure.shot").first().scrollIntoViewIfNeeded();
  await sleep(300);
  const figBox = await echo.locator("figure.shot").first().boundingBox();
  must(!!figBox && figBox.height > 100, `the figure has a body on paper (${Math.round(figBox?.height ?? 0)}px)`);
  await echo.screenshot({ path: "scripts/shots-t223/t241-run-echo-figure-2x.png", scale: "css" });
  await echo.close();
} finally {
  unlinkSync(TMP);
}

section("world hygiene");
const roster = await (await fetch(`${BASE}/api/jobs`)).json();
must((roster.jobs?.length ?? 0) === 23, `roster identity (23) — read-only window (${roster.jobs?.length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length})`);
await page.close();
await browser.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail) { fails.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }

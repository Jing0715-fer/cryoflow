/* t241 — the run report's echo: the per-job dossier's portable medium.
 * The inspector's Report door gains an HTML sibling (same collected md
 * bytes, dressed as a standalone document). This script proves the echo
 * on the WIRE with the richest dossier the data world currently has
 * (a completed postprocess job whose FSC curve earns the image section —
 * resolved LIVE from the wire, t406: the t403-era hard-coded "QA Post 385"
 * was a gallery fossil the 15-node world cannot hold, the first living
 * case of the gallery-seesaw verdict), then shoots the family's frames:
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
// t404's verdict, live again on the very first wire read: undici's keep-alive
// pool and this sandbox's half-reaped servers are a poison match
// (SocketError: other side closed on a pooled request while a fresh
// connection sails through). The suite's own wire reads ride the
// connection-layer retry doctrine (t310 fetchSteady, t313 healer).
const fetchSteady = async (url, opts = {}, attempts = 20) => {
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, opts); }
    catch (err) {
      if (i === attempts - 1) throw err;
      await sleep(5000);
    }
  }
};
// t310's evalSteady, suite-side edition: a server recycle mid-evaluate
// fires the dev client's HMR reload and destroys the execution context
// ("Execution context was destroyed, most likely because of a navigation").
// Whole-block retry — every evaluate below is a read-only idempotent probe.
const evalSteady = async (page, fn, ...args) => {
  for (let i = 0; i < 8; i++) {
    try { return await page.evaluate(fn, ...args); }
    catch (err) {
      if (i === 7) throw err;
      await sleep(6000);
    }
  }
};

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

section("resolve the FSC-bearing dossier live (the world's shape, not a fossil)");
// t406 de-fossilization — the t313 doctrine again: the sentinel promises
// the world's SHAPE (a completed postprocess job with results), never a
// name from a dead roster. The healed 15-node chain carries its FSC in
// "Post-process (tutorial)"; suite residue (t266/t267 imports) may drift
// the totals, which is exactly why the name must be read, not assumed.
const roster0 = await (await fetchSteady(`${BASE}/api/jobs`)).json();
const post = (roster0.jobs ?? []).find((j) => j.type === "postprocess" && j.status === "completed");
must(!!post, `an FSC-bearing postprocess dossier exists on the wire (${post?.name ?? "none"})`);
const JOB = post.name;
const SLUG = JOB.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

section("put the healed world on the canvas (a clean context selects its own project)");
// second fossil layer, found live: a fresh playwright context carries no
// localStorage, so the canvas waits at "Select project" and NO job card
// ever renders (the t243-era world pre-selected everything; the migrated
// world does not). Resolve the dossier's project on the wire (the
// sec-fetch-site header rides the t245 same-origin precedent) and pick it
// through the command palette — the UI's own door, because a bare POST
// cannot update the canvas state.
const projs = await (await fetchSteady(`${BASE}/api/projects`, { headers: { "sec-fetch-site": "same-origin" } })).json();
const proj = (projs.projects ?? []).find((p) => p.id === post.projectId);
must(!!proj, `the dossier's project resolved on the wire (${proj?.name ?? "none"})`);
// the palette rides its own button (the Ctrl+K chord races hydration on a
// cold server); if the Projects group is missing the boot race ate the
// registry — reload and retry (the t407 apiSteady fix should make this a
// no-op, the suite keeps the guard so the fossil can never come back)
let projRow = null;
for (let attempt = 1; attempt <= 3 && !projRow; attempt++) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[aria-label="Open command palette (Ctrl+K)"]', { timeout: 30000 });
  await page.click('button[aria-label="Open command palette (Ctrl+K)"]');
  await page.waitForSelector('[cmdk-root]', { timeout: 10000 });
  await sleep(600);
  const candidate = page.locator('[data-slot="command-item"]', { hasText: proj.name }).first();
  if ((await candidate.count()) >= 1) { projRow = candidate; break; }
  await page.keyboard.press("Escape");
  await sleep(800);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2000);
}
must(!!projRow, `the project's palette row stands ("${proj.name}")`);
if (projRow) {
  await projRow.click();
  await sleep(1800);
  await page.keyboard.press("Escape");
  await sleep(600);
}

section("open the inspector on the FSC-bearing job");
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
// third fossil layer: the old world's localStorage remembered the Workflow
// view (Task 157's session position), so the canvas job cards were simply
// THERE. A clean context lands on the Dashboard where no cards exist —
// walk to the Workflow view explicitly, the fossil-proof way.
await page.locator('[role="tab"]', { hasText: "Workflow" }).first().click();
await sleep(1500);
const node = page.locator('[role="button"]', { hasText: JOB }).first();
await node.click();
await sleep(2000);
await page.locator('[role="tab"]', { hasText: "Results" }).click();
await sleep(2500);
// fifth layer, timing: the report's collector fetches FSC FRESH at export
// time (results-view's own Promise.all, .catch-eaten). On a cold server the
// route's first compile turns that in-page fetch into a quick non-ok and
// the report exports WITHOUT its FSC section — the echo travels, the
// evidence stays home. Warm the exact wire the collector will read, then
// export (incremental warmth, suite-side).
const fscWarm = await evalSteady(page, async (jid) => {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`/api/jobs/${jid}/fsc`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        if ((d.shells ?? []).length > 0) return true;
      }
    } catch {}
    await new Promise((res) => setTimeout(res, 2000));
  }
  return false;
}, post.id);
must(fscWarm, "the FSC wire is warm before the export");
let doors = await evalSteady(page, () => ({
  md: !!document.querySelector('button[aria-label="Export run report"]'),
  html: !!document.querySelector('button[aria-label="Export run report as HTML"]'),
}));
if (!(doors.md && doors.html)) {
  // an HMR reload (server recycle) may have reset the session walk — redo it
  await page.locator('[role="tab"]', { hasText: "Workflow" }).first().click().catch(() => {});
  await sleep(1500);
  await page.locator('[role="button"]', { hasText: JOB }).first().click();
  await sleep(2000);
  await page.locator('[role="tab"]', { hasText: "Results" }).click();
  await sleep(2500);
  doors = await evalSteady(page, () => ({
    md: !!document.querySelector('button[aria-label="Export run report"]'),
    html: !!document.querySelector('button[aria-label="Export run report as HTML"]'),
  }));
}
must(doors.md && doors.html, `the dossier's two doors stand (md ${doors.md}, html ${doors.html})`);

section("export the echo");
const [dl] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.locator('button[aria-label="Export run report as HTML"]').click(),
]);
must(new RegExp(`^cryoflow-report-${SLUG}-[a-z0-9]+\\.html$`).test(dl.suggestedFilename()),
  `the echo travels under the dossier's own name (${dl.suggestedFilename()})`);
const html = readFileSync(await dl.path(), "utf8");
const h2s = (html.match(/<h2/g) || []).length;
const figs = (html.match(/<figure class="shot">/g) || []).length;
const links = [...html.matchAll(/href="#([a-z0-9-]+)"/g)];
const deadLinks = links.filter((m) => !html.includes(`id="${m[1]}"`)).length;
must(html.startsWith("<!DOCTYPE html>"), "doctype first");
must(!/<script/i.test(html), "a document, not an app (zero script)");
must(!/<link|@import|src="http/i.test(html), "self-contained (no external references)");
must(html.includes(`<title>CryoFlow run report — ${JOB}</title>`), "the title is the dossier's own");
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
// the healed chain's shape: at least 15 COMPLETED jobs on the wire (the
// tutorial chain's fifteen nodes, all green) — suite residue (t266/t267
// imports, a failed t267 probe) drifts the total but never the floor.
must((roster0.jobs ?? []).filter((j) => j.status === "completed").length >= 11,
  `the healed chain stands (>= 11 completed) (${(roster0.jobs ?? []).filter((j) => j.status === "completed").length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length})`);
await page.close();
await browser.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail) { fails.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }

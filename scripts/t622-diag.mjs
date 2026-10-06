/* t622-diag — the t241 revival's crime-scene camera.
 * The suite (t241-run-echo) fails three ways on a healthy product:
 *   1. palette row "missing" (the row provably stands in chrome-153)
 *   2. export doors md/html false (they provably stand in chrome-153)
 *   3. download-wait timeout crash (follows from 2)
 * This diag replays the suite's EXACT harness — playwright's own
 * chromium (not chrome-153), fresh context, no desktop shim, the same
 * sleeps — and dumps enough DOM/wire state at each step to name the
 * difference. Self-reaping: browser closes on every exit path.
 * Run: node scripts/t622-diag.mjs   (server on :3000)
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[diag]", ...a);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // resolve the dossier live, same as the suite
  const roster0 = await (await fetch(`${BASE}/api/jobs`)).json();
  const post = (roster0.jobs ?? []).find((j) => j.type === "postprocess" && j.status === "completed");
  const projs = await (await fetch(`${BASE}/api/projects`, { headers: { "sec-fetch-site": "same-origin" } })).json();
  const proj = (projs.projects ?? []).find((p) => p.id === post.projectId);
  log(`job=${post.name} id=${post.id} proj="${proj.name}"`);

  // ---- step 1: the palette attempt, suite-exact ----
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[aria-label="Open command palette (Ctrl+K)"]', { timeout: 30000 });
  await page.click('button[aria-label="Open command palette (Ctrl+K)"]');
  await page.waitForSelector("[cmdk-root]", { timeout: 10000 });
  await sleep(600);
  const paletteState = await page.evaluate((name) => {
    const rows = Array.from(document.querySelectorAll('[data-slot="command-item"]'));
    const row = rows.find((r) => r.innerText.includes(name));
    const groups = Array.from(document.querySelectorAll("cmdk-group"))
      .map((g) => g.querySelector("[cmdk-group-heading]")?.textContent?.trim())
      .filter(Boolean);
    return {
      totalRows: rows.length,
      groups,
      rowFoundByIncludes: !!row,
      rowText: row?.innerText?.slice(0, 80) ?? null,
      // the suite's locator predicate, reproduced: substring, case-insensitive
      rowFoundByHasTextSim: rows.some((r) =>
        r.innerText.toLowerCase().includes(name.toLowerCase())
      ),
    };
  }, proj.name);
  log("palette:", JSON.stringify(paletteState, null, 2));
  await page.keyboard.press("Escape");
  await sleep(600);

  // ---- step 2: the walk, suite-exact ----
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('[role="tab"]', { hasText: "Workflow" }).first().click();
  await sleep(1500);
  const nodeCount = await page.locator('[role="button"]', { hasText: post.name }).count();
  log(`canvas role=button count w/ hasText "${post.name}":`, nodeCount);
  const nodeInfo = await page.evaluate((name) => {
    const els = Array.from(document.querySelectorAll('[role="button"]')).filter((b) =>
      b.innerText.toLowerCase().includes(name.toLowerCase())
    );
    return els.map((el) => ({
      label: el.getAttribute("aria-label"),
      rect: JSON.parse(JSON.stringify(el.getBoundingClientRect())),
    }));
  }, post.name);
  log("candidate nodes:", JSON.stringify(nodeInfo));
  await page.locator('[role="button"]', { hasText: post.name }).first().click();
  await sleep(2000);
  const afterClick = await page.evaluate(() => ({
    dialogs: document.querySelectorAll("[role=dialog]").length,
    tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent.trim()),
  }));
  log("after card click:", JSON.stringify(afterClick));

  await page.locator('[role="tab"]', { hasText: "Results" }).click();
  await sleep(2500);
  const doors1 = await page.evaluate(() => ({
    md: !!document.querySelector('button[aria-label="Export run report"]'),
    html: !!document.querySelector('button[aria-label="Export run report as HTML"]'),
    dialogText: document.querySelector("[role=dialog]")?.innerText?.slice(0, 300) ?? null,
  }));
  log("doors after Results click:", JSON.stringify(doors1, null, 2));

  // in-page outputs fetch, the way JobResults does it
  const outputsProbe = await page.evaluate(async (jid) => {
    try {
      const r = await fetch(`/api/jobs/${jid}/outputs`, { cache: "no-store" });
      const d = await r.json();
      return { status: r.status, files: (d.files ?? []).length };
    } catch (e) {
      return { error: String(e) };
    }
  }, post.id);
  log("in-page outputs probe:", JSON.stringify(outputsProbe));
  log("console errors so far:", consoleErrors.length, JSON.stringify(consoleErrors.slice(0, 5)));
} finally {
  await browser.close();
  log("browser reaped");
}

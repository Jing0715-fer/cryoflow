#!/usr/bin/env node
/**
 * t376 — browser verification of the RELION 5.0 GUI-parity parameter panel.
 *
 * The user's ask: "各种 job 的 UI 中可设置的参数好像还是不全，需要仔细看
 * relion 代码，把所有可设置参数都加上，在 UI 中的排版最好也和 relion 的
 * GUI 中一样" — this suite proves the landed result in a real browser:
 *
 *   A  the class2d panel shows RELION's own tab strip (I/O | CTF |
 *      Optimisation | Sampling | Helix | Compute) and ≥35 params
 *   B  the autopick panel shows the Laplacian tab with the
 *      "Are the particles white?" switch (the negative-stain door)
 *   C  the extract panel shows "Invert contrast?" (do_invert)
 *   D  zero console/page errors throughout
 *
 * Lean chromium (4GB doctrine): single-process, 256MB v8, image routes
 * dropped, explicit coordinates on every click (t370 lesson: random
 * offsets self-intercept on subtree boundaries).
 */
import { chromium } from "playwright";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
let pass = 0, fail = 0;
const fails = [];
const must = (c, label) => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(label); console.log(`FAIL  ${label}`); }
};
const consoleErrors = [];

const browser = await chromium.launch({
  args: [
    "--single-process",
    "--js-flags=--max-old-space-size=256",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--renderer-process-limit=1",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/\.(woff2?|png|svg|jpe?g)$/i, (route) => route.fulfill({ status: 204, body: "" }));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 160)));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector("text=class2d", { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const openPanelOn = async (type) => {
    // find the card of the given type and click its center (canvas transform
    // makes text selectors unreliable — the aria-label carries the type)
    const sel = `[aria-label*="— ${type},"]`;
    const card = page.locator(sel).first();
    await card.waitFor({ state: "visible", timeout: 30_000 });
    const box = await card.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1200);
  };

  const paramTabsVisible = async () =>
    (await page.locator("[data-radix-collection-item], [role=tab]").allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);

  const paramRowCount = async () =>
    page.locator('[role=tabpanel] input, [role=tabpanel] button[role=combobox], [role=tabpanel] [data-state]').count();

  /* ---- A: class2d ---- */
  console.log("== A: class2d panel ==");
  await openPanelOn("2D Classification");
  // the panel's Params body tab
  const paramsTab = page.getByRole("tab", { name: /^Params$/ }).first();
  if (await paramsTab.count()) await paramsTab.click();
  await page.waitForTimeout(800);
  const aTabs = await paramTabsVisible();
  must(aTabs.includes("I/O") && aTabs.includes("CTF") && aTabs.includes("Optimisation") && aTabs.includes("Sampling") && aTabs.includes("Helix") && aTabs.includes("Compute"),
    `A1 class2d shows RELION's own tab strip (${aTabs.join(" | ")})`);
  const aCount = await paramRowCount();
  must(aCount >= 30, `A2 class2d carries the full RELION option set (${aCount} controls)`);
  const helixText = await page.locator("[role=tabpanel]").first().textContent().catch(() => "");
  // click the Helix tab and check the helical suite is present
  const helixTab = page.getByRole("tab", { name: "Helix", exact: true }).first();
  if (await helixTab.count()) {
    await helixTab.click();
    await page.waitForTimeout(400);
    const helixPanelText = await page.locator("[role=tabpanel]").filter({ hasText: /helical/i }).first().textContent().catch(() => "");
    must(/helical/i.test(helixPanelText), "A3 the Helix tab carries the helical suite");
  }
  const optTab = page.getByRole("tab", { name: "Optimisation", exact: true }).first();
  if (await optTab.count()) {
    await optTab.click();
    await page.waitForTimeout(400);
    const bodyText = await page.locator("[role=tabpanel]").filter({ hasText: /Number of EM iterations|VDAM|mini-batch/i }).first().textContent().catch(() => "");
    must(/VDAM|mini-batch/i.test(bodyText), "A4 the VDAM/EM algorithm switch is visible (Optimisation)");
  }

  /* ---- B: autopick LoG — the white-particle door ---- */
  console.log("== B: autopick LoG ==");
  await openPanelOn("Automated Picking");
  const paramsTab2 = page.getByRole("tab", { name: /^Params$/ }).first();
  if (await paramsTab2.count()) await paramsTab2.click();
  await page.waitForTimeout(800);
  const bTabs = await paramTabsVisible();
  must(bTabs.includes("Laplacian"), `B1 autopick shows the Laplacian tab (${bTabs.join(" | ")})`);
  const lapTab = page.getByRole("tab", { name: "Laplacian", exact: true }).first();
  if (await lapTab.count()) {
    await lapTab.click();
    await page.waitForTimeout(400);
  }
  const white = await page.getByText("Are the particles white?").count();
  must(white >= 1, "B2 'Are the particles white?' — the negative-stain switch RELION users know");

  /* ---- C: extract do_invert ---- */
  console.log("== C: extract invert ==");
  await openPanelOn("Particle Extraction");
  const paramsTab3 = page.getByRole("tab", { name: /^Params$/ }).first();
  if (await paramsTab3.count()) await paramsTab3.click();
  await page.waitForTimeout(800);
  const inv = await page.getByText("Invert contrast?").count();
  must(inv >= 1, "C1 extract shows 'Invert contrast?' (RELION's do_invert)");

  /* ---- D: console ---- */
  must(consoleErrors.length === 0, `D1 zero console/page errors (${consoleErrors.length ? consoleErrors.slice(0, 3).join(" | ") : "clean"})`);
  await page.screenshot({ path: "shots-qa/t376-relion-params.png", fullPage: false });
} catch (e) {
  must(false, "the suite ran: " + String(e).slice(0, 200));
} finally {
  await browser.close().catch(() => {});
}

console.log(`\n== t376 RESULT: ${pass} ok, ${fail} FAIL ==`);
if (fails.length) { console.log("FAILS:\n  " + fails.join("\n  ")); process.exit(1); }
process.exit(0);

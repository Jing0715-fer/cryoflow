// t654 — the import gallery learns the two next gestures: the lightbox
// walks (←/→, wrap, "i of n") and compare mode picks (ordered tray,
// ringed numbered thumbs, side-by-side dialog). All on the REAL import
// job (EMPIAR mics import, 10 local micrographs — the API said so).
//
// Probe contract:
//   B  UI real world —
//      lightbox: click thumb #1 → "1 of 10"; → → "2 of 10"; ← ← wraps
//      to "10 of 10"; → wraps back to "1 of 10"; Esc closes.
//      compare: toggle (aria-pressed) → two clicks land data-picked="1"
//      and "2" → Compare 2 enabled → dialog shows two panes in pick
//      order → Esc closes → un-picking one disables Compare (the
//      honest title swaps) → exiting the mode strips every pick.
//   C  console hygiene + 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
const resource404 = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  // t657 — the world upgrade: the seeder hard-links the REAL EMPIAR frames
  // into the import workdir, so the frames RENDER and outputs/file answers
  // 200 per frame. The old verdict ("bounded 404s, pre-existing, world
  // state") is retired: the precise contract is now JS errors = 0 AND
  // frame 404s = 0. t657-e2e holds the positive-face assertion.
  if (m.text().startsWith("Failed to load resource")) resource404.push(m.text());
  else consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// dashboard roster → open the import job (t651 recipe: rows are the
// collision-free path)
await page.locator('[role="tab"][title^="Project dashboard"]').click();
await sleep(1200);
const row = page.locator('[data-roster-row]', { hasText: "EMPIAR mics import" }).first();
let found = false;
for (let i = 0; i < 10 && !found; i++) {
  if (await row.count() > 0 && await row.isVisible()) { found = true; break; }
  await sleep(1000);
}
must(found, "B roster row for EMPIAR mics import found");
await row.locator('button[title^="Open EMPIAR mics import"]').click();
await sleep(1500);

// the gallery lives in the inspector's OVERVIEW tab (t315 mount); the
// inspector opens on results for a completed job — switch explicitly
await page.locator('[role="tablist"] [role="tab"]', { hasText: /^Overview/ }).first().click();
await sleep(1200);

// the gallery mounts lazily (results-lazy dynamic import)
const gallery = page.locator('section[aria-label="Source micrographs"]');
let gVisible = false;
for (let i = 0; i < 12 && !gVisible; i++) {
  if (await gallery.count() > 0 && await gallery.isVisible()) { gVisible = true; break; }
  await sleep(1000);
}
must(gVisible, "B import gallery mounted (lazy chunk arrived)");

const thumbs = gallery.locator('[data-gallery-ui="thumb"]');
const N = await thumbs.count();
must(N === 10, "B the canonical world hangs 10 micrographs", `n=${N}`);

// ---------- lightbox walk ----------
await thumbs.nth(0).click();
await sleep(1200);
const lightbox = page.locator('[data-gallery-ui="lightbox"]');
must(await lightbox.count() > 0, "B lightbox opens from thumb #1");
const posText = async () => (await lightbox.locator('[data-gallery-ui="walk-pos"]').innerText()).trim();
must((await posText()) === "1 of 10", "B the walk opens at 1 of 10", await posText());

await page.keyboard.press("ArrowRight");
await sleep(500);
must((await posText()) === "2 of 10", "B → advances to 2 of 10", await posText());

await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
await sleep(600);
must((await posText()) === "10 of 10", "B ← ← wraps to 10 of 10", await posText());

await page.keyboard.press("ArrowRight");
await sleep(500);
must((await posText()) === "1 of 10", "B → wraps back to 1 of 10", await posText());
await page.screenshot({ path: ".qa-logs/t654-lightbox-walk.png" });

await page.keyboard.press("Escape");
await sleep(700);
must((await lightbox.count()) === 0, "B Esc closes the lightbox");

// ---------- compare mode ----------
const toggle = gallery.locator('[data-gallery-ui="compare-toggle"]');
await toggle.click();
await sleep(400);
must((await toggle.getAttribute("aria-pressed")) === "true", "B compare mode engages (aria-pressed)");

await thumbs.nth(0).click();
await thumbs.nth(3).click();
await sleep(400);
must(await thumbs.nth(0).getAttribute("data-picked") === "1", "B thumb #1 wears tray number 1");
must(await thumbs.nth(3).getAttribute("data-picked") === "2", "B thumb #4 wears tray number 2 (pick order)");

const openBtn = gallery.locator('[data-gallery-ui="compare-open"]');
must((await openBtn.innerText()).trim() === "Compare 2", "B the tray button counts 2", await openBtn.innerText());
must(!(await openBtn.isDisabled()), "B Compare 2 is enabled");
await openBtn.click();
await sleep(900);

const dialog = page.locator('[data-gallery-ui="compare-dialog"]');
must(await dialog.count() > 0, "B compare dialog opens");
const panes = dialog.locator("figure");
must((await panes.count()) === 2, "B two side-by-side panes");
must((await panes.nth(0).locator("figcaption span").first().innerText()) === "1",
  "B pane order follows PICK order (pane 1 = first pick)");
await page.screenshot({ path: ".qa-logs/t654-compare.png" });

await page.keyboard.press("Escape");
await sleep(700);
must((await dialog.count()) === 0, "B Esc closes the compare dialog");

// un-pick one → Compare drops to 1 and disables (the honest button)
await thumbs.nth(3).click();
await sleep(400);
must(await thumbs.nth(3).getAttribute("data-picked") === null, "B re-click removes the pick");
must((await openBtn.innerText()).trim() === "Compare 1", "B the tray button counts 1", await openBtn.innerText());
must(await openBtn.isDisabled(), "B Compare 1 is disabled (a comparison needs two)");

// exit the mode → the tray is stripped (no stale picks behind the door)
await toggle.click();
await sleep(400);
must((await toggle.getAttribute("aria-pressed")) === "false", "B compare mode exits");
must((await gallery.locator('[data-picked]').count()) === 0, "B the tray is stripped on exit (no stale ring)");

// console hygiene — JS errors must be ZERO; the world now serves real
// frames, so frame 404s must ALSO be zero (the t657 world upgrade)
must(consoleErrors.length === 0, "C zero JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0,
  "C zero frame 404s (the world upgrade retired the bounded-404 verdict)",
  `${resource404.length}`);
if (resource404.length) console.log(resource404.slice(0, 5));

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt654-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

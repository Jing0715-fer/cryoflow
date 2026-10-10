// t657 — the world upgrade + the compare dialog learns what it compares.
//
// Backstory: the demo world's import workdir named the ten real EMPIAR
// Falcon frames in its star but never materialized them — every thumbnail
// answered 404 and the t654 verdict had to classify that as "world state".
// This window the seeder hard-links the REAL frames into the workdir
// (zero bytes copied, same inode) and the star carries the optics block.
// The verdict is upgraded from "bounded 404s" to a precise contract:
//   JS errors = 0 (always),  frame 404s = 0 (the world grew real bytes).
//
// Probe contract:
//   A  the world is real — API dims 10/10 (4096×4096, 67.1MB), optics
//      (1.77 Å / 300 kV / 2.7 mm / 0.1) on the gallery header, the
//      gallery footnote says 4096×4096 px, thumbnails actually RENDER
//      (naturalWidth > 0, zero "unavailable" faces).
//   B  pane stats — compare dialog: both panes wear the measured stats
//      row (4096×4096 px · 4.0 B/px), pane order follows pick order.
//   C  the precise console contract: 0 JS errors, 0 frame 404s. 📸×2.
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
const page = await b.newPage({ viewport: { width: 1600, height: 1200 } });
const consoleErrors = [];
const resource404 = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (m.text().startsWith("Failed to load resource")) resource404.push(m.text());
  else consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// ---------- A0: the API tells the truth about the frames ----------
const api = await page.evaluate(async () => {
  const r = await fetch("/api/jobs/cmuwipe63500import/micrographs", { cache: "no-store" });
  return r.json();
});
must(api.total === 10 && api.micrographs?.length === 10, "A API hangs 10 micrographs", `total=${api.total}`);
const withDims = (api.micrographs ?? []).filter((m) => m.nx === 4096 && m.ny === 4096);
must(withDims.length === 10, "A every frame carries the REAL header dims (4096×4096)", `${withDims.length}/10`);
const big = (api.micrographs ?? []).filter((m) => m.size > 67_000_000);
must(big.length === 10, "A every frame carries its real byte size (67.1MB)", `${big.length}/10`);
must(api.pixelSize === 1.77 && api.voltage === 300 && api.sphericalAberration === 2.7 && api.amplitudeContrast === 0.1,
  "A the optics block answers (1.77 Å · 300 kV · 2.7 mm · 0.1)",
  `${api.pixelSize}/${api.voltage}/${api.sphericalAberration}/${api.amplitudeContrast}`);

// dashboard roster → open the import job (the t651/t654 recipe)
await page.locator('[role="tab"][title^="Project dashboard"]').click();
await sleep(1200);
const row = page.locator('[data-roster-row]', { hasText: "EMPIAR mics import" }).first();
let found = false;
for (let i = 0; i < 10 && !found; i++) {
  if (await row.count() > 0 && await row.isVisible()) { found = true; break; }
  await sleep(1000);
}
must(found, "A roster row for EMPIAR mics import found");
await row.locator('button[title^="Open EMPIAR mics import"]').click();
await sleep(1500);

// gallery lives in the inspector's OVERVIEW tab (t315 mount)
await page.locator('[role="tablist"] [role="tab"]', { hasText: /^Overview/ }).first().click();
await sleep(1200);

const gallery = page.locator('section[aria-label="Source micrographs"]');
let gVisible = false;
for (let i = 0; i < 12 && !gVisible; i++) {
  if (await gallery.count() > 0 && await gallery.isVisible()) { gVisible = true; break; }
  await sleep(1000);
}
must(gVisible, "A import gallery mounted (lazy chunk arrived)");

// ---------- A1: the header's optics chips are fed by the star ----------
const headerText = (await gallery.locator("div.mb-1\\.5").first().innerText()).replace(/\n/g, " ");
must(/1\.77\s*Å/.test(headerText), "A header chip: pixel size 1.77 Å");
must(/300\s*kV/.test(headerText), "A header chip: HT 300 kV");
must(/2\.7\s*mm/.test(headerText), "A header chip: Cs 2.7 mm");
must(/0\.1/.test(headerText), "A header chip: Q0 0.1");

// ---------- A2: the footnote speaks real geometry ----------
const foot = (await gallery.locator("p.mt-1\\.5").first().innerText());
must(/4096×4096 px/.test(foot), "A footnote says 4096×4096 px detector frames", foot.slice(0, 60));

// ---------- A3: the thumbnails actually RENDER ----------
// first PNG render of a 4096² float32 frame takes ~0.5s server-side;
// the cache (t322) makes later visits cheap. Walk the wall to defeat
// loading=lazy, then give the renders room.
await page.evaluate(() => window.scrollBy(0, 600));
await sleep(4500);
const thumbs = gallery.locator('[data-gallery-ui="thumb"]');
const N = await thumbs.count();
must(N === 10, "A the canonical world hangs 10 micrographs", `n=${N}`);
const imgs = thumbs.locator("img");
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(2500);
let rendered = 0, unavailable = 0;
for (let i = 0; i < N; i++) {
  const t = thumbs.nth(i);
  if ((await t.locator("img").count()) === 0) { unavailable++; continue; }
  const nw = await t.locator("img").evaluate((el) => el.naturalWidth);
  if (nw > 0) rendered++;
  if ((await t.innerText().catch(() => "")).includes("unavailable")) unavailable++;
}
must(unavailable === 0, "A zero 'unavailable' faces on the wall", `${unavailable}`);
must(rendered >= 6, "A real pixels render on the wall (lazy viewport costs the tail)", `${rendered}/${N}`);
await page.screenshot({ path: ".qa-logs/t657-real-wall.png" });

// ---------- B: the compare dialog's measured stats ----------
const toggle = gallery.locator('[data-gallery-ui="compare-toggle"]');
await toggle.click();
await sleep(400);
must((await toggle.getAttribute("aria-pressed")) === "true", "B compare mode engages");
await thumbs.nth(0).click();
await thumbs.nth(3).click();
await sleep(400);
const openBtn = gallery.locator('[data-gallery-ui="compare-open"]');
must(!(await openBtn.isDisabled()), "B Compare 2 enabled");
await openBtn.click();
await sleep(2500);

const dialog = page.locator('[data-gallery-ui="compare-dialog"]');
must(await dialog.count() > 0, "B compare dialog opens");
const panes = dialog.locator("figure");
must((await panes.count()) === 2, "B two side-by-side panes");
must((await panes.nth(0).locator("figcaption span").first().innerText()) === "1",
  "B pane order follows PICK order (pane 1 = first pick)");

const stats = dialog.locator('[data-gallery-ui="pane-stats"]');
must((await stats.count()) === 2, "B both panes wear the stats row", `n=${await stats.count()}`);
const dims0 = await panes.nth(0).locator('[data-pane-stat="dims"]').innerText();
const dims1 = await panes.nth(1).locator('[data-pane-stat="dims"]').innerText();
must(dims0.trim() === "4096×4096 px" && dims1.trim() === "4096×4096 px",
  "B both panes report the real dims", `${dims0} / ${dims1}`);
const bpp0 = await panes.nth(0).locator('[data-pane-stat="bpp"]').innerText();
const bpp1 = await panes.nth(1).locator('[data-pane-stat="bpp"]').innerText();
must(bpp0.trim() === "4.0 B/px" && bpp1.trim() === "4.0 B/px",
  "B both panes report the measured density (67109888 / 4096² ≈ 4.0)", `${bpp0} / ${bpp1}`);
await page.screenshot({ path: ".qa-logs/t657-compare-stats.png" });

await page.keyboard.press("Escape");
await sleep(700);
must((await dialog.count()) === 0, "B Esc closes the compare dialog");
await toggle.click();
await sleep(400);

// ---------- C: the precise console contract ----------
must(consoleErrors.length === 0, "C zero JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0,
  "C zero frame 404s — the world grew real bytes (the t654 'bounded' verdict is retired)",
  `${resource404.length}`);
if (resource404.length) console.log(resource404.slice(0, 5));

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt657-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

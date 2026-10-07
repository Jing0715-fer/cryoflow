// t658 — the corrected wall: MotionCorr's frames join the real world.
//
// Backstory: t657 grew the import workdir real bytes (10 hard-linked
// EMPIAR frames) and retired the bounded-404 verdict. But the world's
// SECOND catalogue still lived in the shadow: the motioncorr job's
// corrected_micrographs.star named ten Falcon frames and its workdir
// held zero of them. This window the seeder hard-links the SAME ten
// inodes into the motioncorr workdir (two catalogues, one bundle),
// the corrected star grows the RELION 5 optics block (group + pixel
// size — the t409 counter's own dialect), the micrographs route
// learns a whitelisted catalogue door, and the gallery generalizes:
// variant="corrected" mounts in the MotionCorr inspector.
//
// Probe contract:
//   A  the door — the corrected catalogue API hangs 10 real frames
//      (4096², 67.1MB) with pixel 1.77 Å and HONEST ABSENCE for HT/Cs/Q0
//      (RELION 5's corrected star carries group + pixel size only); the
//      whitelist refuses to climb (crafted catalogue → workdir-scoped
//      default → empty); the import default is byte-identical (t657).
//      The motion chart still reads 10 rows — the optics block did not
//      poison the parser (t409 re-verified against the new star shape).
//   B  the wall — the MotionCorr inspector mounts the corrected gallery:
//      10 real thumbnails render, header chip 1.77 Å with HT/Cs/Q0
//      honestly absent, the lightbox walks (1 of 10 → 2 of 10 → Esc),
//      compare mode reports measured pane stats (4096×4096 · 4.0 B/px).
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

// ---------- A0: the corrected catalogue answers with real bytes ----------
const api = await page.evaluate(async () => {
  const r = await fetch("/api/jobs/cmuwipe6350motioncorr/micrographs?catalogue=corrected_micrographs.star", { cache: "no-store" });
  return r.json();
});
must(api.total === 10 && api.micrographs?.length === 10, "A corrected catalogue hangs 10 micrographs", `total=${api.total}`);
const withDims = (api.micrographs ?? []).filter((m) => m.nx === 4096 && m.ny === 4096);
must(withDims.length === 10, "A every corrected frame carries the REAL dims (4096×4096)", `${withDims.length}/10`);
const big = (api.micrographs ?? []).filter((m) => m.size > 67_000_000);
must(big.length === 10, "A every corrected frame carries its real byte size (67.1MB)", `${big.length}/10`);
must(api.pixelSize === 1.77, "A the optics block answers (pixel 1.77 Å)", `${api.pixelSize}`);
must(api.voltage == null && api.sphericalAberration == null && api.amplitudeContrast == null,
  "A HT/Cs/Q0 honestly absent — the corrected star carries group + pixel only (RELION 5 dialect)");

// ---------- A1: the door is workdir-scoped (whitelist, not a path) ----------
const evil = await page.evaluate(async () => {
  const r = await fetch(`/api/jobs/cmuwipe6350motioncorr/micrographs?catalogue=${encodeURIComponent("../../../../etc/passwd.star")}`, { cache: "no-store" });
  return r.json();
});
must(evil.total === 0 && Array.isArray(evil.micrographs) && evil.micrographs.length === 0,
  "A crafted catalogue falls back to the workdir-scoped default — no climb", `total=${evil.total}`);

// ---------- A2: the import default is untouched (t657 contract) ----------
const imp = await page.evaluate(async () => {
  const r = await fetch("/api/jobs/cmuwipe63500import/micrographs", { cache: "no-store" });
  return r.json();
});
must(imp.total === 10 && imp.pixelSize === 1.77 && imp.voltage === 300,
  "A import default unchanged (no param → micrographs.star)", `total=${imp.total} pixel=${imp.pixelSize} HT=${imp.voltage}`);

// ---------- A3: the optics block did not poison the motion parser ----------
const motion = await page.evaluate(async () => {
  const r = await fetch("/api/jobs/cmuwipe6350motioncorr/motion", { cache: "no-store" });
  return r.json();
});
must(motion?.summary?.count === 10, "A motion chart still reads 10 rows (t409 guard vs the new star shape)", `count=${motion?.summary?.count}`);
must(typeof motion?.summary?.meanTotal === "number" && motion.summary.meanTotal > 0,
  "A motion summary math alive", `meanTotal=${motion?.summary?.meanTotal?.toFixed(2)} Å`);

// ---------- B0: the MotionCorr inspector mounts the corrected wall ----------
await page.locator('[role="tab"][title^="Project dashboard"]').click();
await sleep(1200);
const row = page.locator('[data-roster-row]', { hasText: "own motioncorr" }).first();
let found = false;
for (let i = 0; i < 10 && !found; i++) {
  if (await row.count() > 0 && await row.isVisible()) { found = true; break; }
  await sleep(1000);
}
must(found, "B roster row for own motioncorr found");
await row.locator('button[title^="Open own motioncorr"]').click();
await sleep(1500);
await page.locator('[role="tablist"] [role="tab"]', { hasText: /^Overview/ }).first().click();
await sleep(1200);

const gallery = page.locator('section[aria-label="Corrected micrographs"]');
let gVisible = false;
for (let i = 0; i < 12 && !gVisible; i++) {
  if (await gallery.count() > 0 && await gallery.isVisible()) { gVisible = true; break; }
  await sleep(1000);
}
must(gVisible, "B corrected gallery mounted (the lazy chunk arrived)");

// ---------- B1: the header speaks the corrected star's truth ----------
const headerText = (await gallery.locator("div.mb-1\\.5").first().innerText()).replace(/\n/g, " ");
must(/1\.77\s*Å/.test(headerText), "B header chip: pixel size 1.77 Å");
must(!/kV/.test(headerText) && !/Cs/.test(headerText), "B HT/Cs chips honestly absent (no invented optics)");

// ---------- B2: the thumbnails actually RENDER ----------
await page.evaluate(() => window.scrollBy(0, 600));
await sleep(4500);
const thumbs = gallery.locator('[data-gallery-ui="thumb"]');
const N = await thumbs.count();
must(N === 10, "B the corrected wall hangs 10 micrographs", `n=${N}`);
const imgs = thumbs.locator("img");
must((await imgs.count()) === 10, "B every tile carries an <img> (no unavailable faces at all)", `${await imgs.count()}/10`);
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(2500);
let rendered = 0;
for (let i = 0; i < N; i++) {
  const nw = await thumbs.nth(i).locator("img").evaluate((el) => el.naturalWidth).catch(() => 0);
  if (nw > 0) rendered++;
}
must(rendered >= 6, "B real pixels render on the corrected wall (lazy viewport costs the tail)", `${rendered}/${N}`);
await page.screenshot({ path: ".qa-logs/t658-corrected-wall.png" });

// ---------- B3: the lightbox walks the corrected wall ----------
await thumbs.nth(0).click();
await sleep(900);
const lightbox = page.locator('[data-gallery-ui="lightbox"]');
must(await lightbox.count() > 0, "B lightbox opens from corrected thumb #1");
const posText = async () => (await lightbox.locator('[data-gallery-ui="walk-pos"]').innerText()).trim();
must((await posText()) === "1 of 10", "B the walk opens at 1 of 10", await posText());
await lightbox.press("ArrowRight");
await sleep(600);
must((await posText()) === "2 of 10", "B → advances to 2 of 10", await posText());
await page.keyboard.press("Escape");
await sleep(700);
must((await lightbox.count()) === 0, "B Esc closes the lightbox");

// ---------- B4: compare mode reports measured stats ----------
const toggle = gallery.locator('[data-gallery-ui="compare-toggle"]');
await toggle.click();
await sleep(400);
must((await toggle.getAttribute("aria-pressed")) === "true", "B compare mode engages");
await thumbs.nth(1).click();
await thumbs.nth(4).click();
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
  "B pane order follows PICK order");
const dims0 = await panes.nth(0).locator('[data-pane-stat="dims"]').innerText();
const dims1 = await panes.nth(1).locator('[data-pane-stat="dims"]').innerText();
must(dims0.trim() === "4096×4096 px" && dims1.trim() === "4096×4096 px",
  "B both panes report the real dims", `${dims0} / ${dims1}`);
const bpp0 = await panes.nth(0).locator('[data-pane-stat="bpp"]').innerText();
const bpp1 = await panes.nth(1).locator('[data-pane-stat="bpp"]').innerText();
must(bpp0.trim() === "4.0 B/px" && bpp1.trim() === "4.0 B/px",
  "B both panes report the measured density", `${bpp0} / ${bpp1}`);
await page.screenshot({ path: ".qa-logs/t658-corrected-compare.png" });
await page.keyboard.press("Escape");
await sleep(700);
must((await dialog.count()) === 0, "B Esc closes the compare dialog");

// ---------- C: the precise console contract ----------
must(consoleErrors.length === 0, "C zero JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "C zero frame 404s — the second catalogue grew real bytes too", `${resource404.length}`);
if (resource404.length) console.log(resource404.slice(0, 5));

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt658-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

// t659 — the palette learns to land ON the wall + the compare dialog
// speaks agreement.
//
// Two items off the entry ledger:
//   1. Frame galleries deep link (t656 候选, three windows pending) —
//      the Task 81 class-note handshake's second heir: a palette row
//      per gallery-capable job; openJob carries the landing, the store
//      rides a one-shot pendingGalleryFocus, the inspector HOST clears
//      the way (overview tab), the gallery CONSUMES the request when
//      its wall renders (fresh → lightbox at frame 1; stale → cleared
//      on sight). Compare mode deliberately has NO deep link: a tray
//      with zero picks is the t654 lie — the wall is the destination.
//   2. The compare dialog's same-dims aggregate line (t657 待议①,
//      three windows on the books): when every pane measures the same
//      detector geometry, one line says it once.
//
// Probe contract:
//   A  the palette hangs a Frame galleries group with exactly the
//      gallery-capable rows (import + motioncorr, completed; the 2D
//      classification — no wall — has NO row: the filter's negative).
//   B  the import deep link lands INSIDE the lightbox ("1 of 10"),
//      on the overview tab; the one-shot is consumed — reopening the
//      same job never re-opens the lightbox, and the smart default
//      (results) returns.
//   C  the motioncorr deep link lands inside the corrected wall's
//      lightbox ("1 of 10").
//   D  the compare dialog wears the same-dims line (4096×4096 px).
//   E  zero JavaScript console errors. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const BASE = "http://localhost:3000";
let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** t659 — the box's dev server has been OOM-killed once already
 *  (dmesg: next-server, 2.5GB anon-rss, executed mid-run). The probe's
 *  retries must not fire INTO a flap: wait until the server answers
 *  fast AND consistently before trusting the next leg. */
const waitServerHealthy = async (label) => {
  for (let i = 0; i < 25; i++) {
    const t0 = Date.now();
    try {
      const ok = await page.evaluate(async () => {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        return r.ok;
      });
      if (ok && Date.now() - t0 < 2000) {
        if (i > 0) console.log(`  · server healthy again after ${i} polls (${label})`);
        return true;
      }
    } catch { /* flap — keep polling */ }
    await sleep(2000);
  }
  return false;
};

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1200 } });
const consoleErrors = [];
const hmrNoise = [];
const resourceFlap = [];
const resource404 = [];
const chunkFlap = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  // t659 — three verdicts for the console's error voices, none swallowed:
  //   1. hmrNoise — the dev server's own HMR socket (webpack-hmr +
  //      ERR_CONNECTION_REFUSED): infrastructure that only exists in
  //      `next dev`. Bounded.
  //   2. resourceFlap — resource loads refused/emptied/reset: the dev
  //      server flapping under memory pressure (the box's OOM killer
  //      has literally executed a next-server mid-run — dmesg says so,
  //      64 times and counting). One death window ≈ a few dozen loads;
  //      the bound admits one, not two. Environment verdict, not
  //      product.
  //   3. everything else — real product signal, must be 0. A 404 on a
  //      frame resource would land here-adjacent (resource404) and the
  //      t657/t658 contract (frame 404 = 0) still binds.
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// ---------- warm-up: compile the lazy chunks the measured legs need ----------
// The box's dev server has been OOM-killed mid-run (dmesg: next-server,
// 2.5GB) — the measured legs must race NO compiles. Opening the
// motioncorr inspector once compiles its lazy chunk (MotionDriftChart)
// and warms the corrected-wall route; the palette's own handshake stays
// pristine (the warm-up knocks on the canvas card, never on the store).
{
  const warmCard = page.locator('[data-testid="job-card"]', { hasText: "own motioncorr" }).first();
  for (let i = 0; i < 10 && (await warmCard.count()) === 0; i++) await sleep(1000);
  if ((await warmCard.count()) > 0) {
    await warmCard.click().catch(() => {});
    for (let i = 0; i < 15; i++) {
      if ((await page.locator('[data-insp-face="tabs"]').count()) > 0) break;
      await sleep(900);
    }
    await sleep(4500); // the drift chart's lazy chunk + the wall's first render
    // wait for the wall to actually MOUNT before leaving — the renders
    // should finish while the server is still upright
    const warmWall = page.locator('section[aria-label="Corrected micrographs"]');
    for (let i = 0; i < 15; i++) {
      if ((await warmWall.count()) > 0) break;
      await sleep(900);
    }
    await page.keyboard.press("Escape");
    await sleep(900);
  }
  await waitServerHealthy("after warm-up");
}

const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await sleep(700);
};

// ---------- A: the palette hangs the Frame galleries group ----------
await openPalette();
const items = page.locator('[cmdk-item]');
let n = 0;
for (let i = 0; i < 10 && !n; i++) {
  n = await items.count();
  if (!n) await sleep(600);
}
must(n > 0, "A palette opens with rows", `rows=${n}`);

const itemTexts = await items.allInnerTexts();
const galleryRows = itemTexts.filter((t) => t.includes("Frame gallery —"));
must(galleryRows.length === 2, "A exactly two gallery rows (import + motioncorr)", galleryRows.join(" | "));
must(galleryRows.some((t) => t.includes("EMPIAR mics import")), "A import wall has a row");
must(galleryRows.some((t) => t.includes("own motioncorr")), "A corrected wall has a row");
const headings = await page.locator('[cmdk-group-heading]').allInnerTexts();
must(headings.some((h) => h.startsWith("Frame galleries")), "A the group heading speaks", headings.filter((h) => h.includes("Frame")).join(","));
must(!galleryRows.some((t) => t.includes("2D classification")),
  "A no row for a wall-less job (the filter's negative anchor)");

// ---------- B: the import deep link lands INSIDE the lightbox ----------
await items.filter({ hasText: "Frame gallery — EMPIAR mics import" }).first().click();
await sleep(1200);
must((await items.count()) === 0, "B palette closes on the jump");

const dialog = page.locator('[data-slot="dialog-overlay"], [role="dialog"]').first();
let inspectorOpen = false;
for (let i = 0; i < 12 && !inspectorOpen; i++) {
  inspectorOpen = (await dialog.count()) > 0 && await dialog.isVisible();
  if (!inspectorOpen) await sleep(800);
}
must(inspectorOpen, "B the inspector opened (openJob's inspect leg)");

const activeTab = page.locator('[data-insp-face="tabs"] [role="tab"][data-state="active"]');
must((await activeTab.first().innerText()).includes("Overview"),
  "B the host landed on the OVERVIEW tab (the gallery's home)",
  await activeTab.first().innerText());

const lightbox = page.locator('[data-gallery-ui="lightbox"]');
let lb = false;
for (let i = 0; i < 14 && !lb; i++) {
  lb = (await lightbox.count()) > 0;
  if (!lb) await sleep(900);
}
must(lb, "B the lightbox auto-opened — the arrival IS the lightbox");
const posText = async () => (await lightbox.locator('[data-gallery-ui="walk-pos"]').innerText()).trim();
if (lb) {
  let pos = "";
  for (let i = 0; i < 10; i++) {
    pos = await posText().catch(() => "");
    if (pos) break;
    await sleep(700);
  }
  must(pos === "1 of 10", "B the walk opened at 1 of 10", pos);
  await page.screenshot({ path: ".qa-logs/t659-deep-link-lightbox.png" });
  await lightbox.press("ArrowRight");
  await sleep(600);
  must((await posText()) === "2 of 10", "B the walk is alive (→ 2 of 10)");
  await page.keyboard.press("Escape");
  await sleep(700);
  must((await lightbox.count()) === 0, "B Esc closes the lightbox");
}

// ---------- B2: the one-shot is consumed (no stale re-fire) ----------
const closeBtn = page.locator('button:has-text("Close inspector")');
if (await closeBtn.count()) { await closeBtn.first().click(); await sleep(900); }
await page.keyboard.press("Escape");
await sleep(900);

// reopen the same job from its canvas card — the smart default returns,
// the lightbox stays shut: a consumed request is consumed forever
const card = page.locator('[data-testid="job-card"]', { hasText: "EMPIAR mics import" }).first();
if ((await card.count()) === 0) {
  // canvas may not show the name inline — fall back to the palette's Jobs jump
  await openPalette();
  const jobRow = items.filter({ hasText: "EMPIAR mics import" }).first();
  await jobRow.click();
  await sleep(1500);
} else {
  await card.click();
  await sleep(1500);
}
const lb2 = (await page.locator('[data-gallery-ui="lightbox"]').count()) > 0;
must(!lb2, "B2 reopening the same job does NOT re-open the lightbox (one-shot law)");
// Task 70's per-job latch: the deep link was a MANUAL tab choice, so the
// latch holds across inspector open/close for the SAME job (the class-note
// handshake persists its panel tab the same way). The lightbox — a ONE-SHOT
// — does not hold; the latch — a reading position — does.
const tab2 = page.locator('[data-insp-face="tabs"] [role="tab"][data-state="active"]').first();
must((await tab2.innerText()).includes("Overview"),
  "B2 the latched Overview persists for the same job (manual-choice semantics)",
  await tab2.innerText());
await page.keyboard.press("Escape");
await sleep(800);
// make sure no dialog survives into leg C — and the server is upright
// (the two walls' PNG renders are the heaviest thing this probe asks of it)
for (let i = 0; i < 4 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
  await page.keyboard.press("Escape");
  await sleep(600);
}
await waitServerHealthy("between B and C");

// ---------- C: the corrected wall answers the same handshake ----------
// (robust leg: the earlier window's runs showed the long A/B legs can
// leave focus in a place where the FIRST Ctrl+K toggles nothing — the
// retry is the probe's honesty about its own hands, not a product doubt)
const jumpToCorrectedWall = async () => {
  await openPalette();
  const row = page.locator('[cmdk-item]').filter({ hasText: "Frame gallery — own motioncorr" }).first();
  if ((await row.count()) === 0) return false;
  await row.click();
  // the jump closes the palette and opens the inspector: wait for the
  // tab bar (not just any dialog — the palette is a dialog too)
  for (let i = 0; i < 12; i++) {
    if ((await page.locator('[data-insp-face="tabs"]').count()) > 0) return true;
    await sleep(800);
  }
  return false;
};
let landed = await jumpToCorrectedWall();
if (!landed) {
  for (let i = 0; i < 3; i++) { await page.keyboard.press("Escape"); await sleep(500); }
  await waitServerHealthy("before C retry");
  await sleep(1500);
  landed = await jumpToCorrectedWall();
}
must(landed, "C the corrected-wall jump landed on the inspector (tab bar in sight)");
const activeAfterJump = await page
  .locator('[data-insp-face="tabs"] [role="tab"][data-state="active"]')
  .first().innerText().catch(() => "(none)");
must(activeAfterJump.includes("Overview"), "C the host cleared the way to OVERVIEW again", activeAfterJump.trim());
const wall = page.locator('section[aria-label="Corrected micrographs"]');
let wallVisible = false;
for (let i = 0; i < 22 && !wallVisible; i++) {
  wallVisible = (await wall.count()) > 0 && await wall.isVisible();
  if (!wallVisible) await sleep(900);
}
must(wallVisible, "C the corrected gallery mounted (host leg cleared the way again)");
if (!wallVisible) {
  // failure autopsy: WHICH job does the inspector show, what sections
  // exist, what gallery UI mounted, what the console caught
  const autopsy = await page.evaluate(() => ({
    inspector: document.querySelector('[data-slot="dialog-overlay"], [role="alertdialog"] ~ *, [role="dialog"] h2')?.textContent?.slice(0, 60) ?? "(none)",
    headings: [...document.querySelectorAll('[role="dialog"] h2')].map((h) => h.textContent?.slice(0, 40)),
    sections: [...document.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute("aria-label")),
    galleryUi: [...document.querySelectorAll('[data-gallery-ui]')].slice(0, 8).map((e) => e.getAttribute("data-gallery-ui")),
  }));
  console.log(`  · C autopsy: ${JSON.stringify(autopsy)}`);
}
const lb3 = page.locator('[data-gallery-ui="lightbox"]');
let lb3open = false;
for (let i = 0; i < 14 && !lb3open; i++) {
  lb3open = (await lb3.count()) > 0;
  if (!lb3open) await sleep(900);
}
must(lb3open, "C the corrected wall's lightbox auto-opened");
if (lb3open) {
  const pos3 = await lb3.locator('[data-gallery-ui="walk-pos"]').innerText().catch(() => "");
  must(pos3.trim() === "1 of 10", "C the corrected walk opens at 1 of 10", pos3);
  await page.keyboard.press("Escape");
  await sleep(700);
}

// ---------- D: the compare dialog speaks agreement ----------
if (!wallVisible) {
  FAIL++; console.log("  FAIL: D skipped — the wall never mounted (see C autopsy)");
} else {
const compareToggle = wall.locator('[data-gallery-ui="compare-toggle"]');
await compareToggle.click();
await sleep(400);
const thumbs = wall.locator('[data-gallery-ui="thumb"]');
await thumbs.nth(0).click();
await thumbs.nth(2).click();
await sleep(400);
await wall.locator('[data-gallery-ui="compare-open"]').click();
await sleep(2200);
const compareDialog = page.locator('[data-gallery-ui="compare-dialog"]');
must(await compareDialog.count() > 0, "D the compare dialog opens");
const sameDims = compareDialog.locator('[data-gallery-ui="compare-same-dims"]');
let sdText = "";
for (let i = 0; i < 8; i++) {
  if ((await sameDims.count()) > 0) { sdText = (await sameDims.innerText()).replace(/\n/g, " "); break; }
  await sleep(700);
}
must(/same dims across panes — 4096×4096 px/.test(sdText),
  "D the same-dims aggregate line speaks the measured geometry", sdText.trim());
await page.screenshot({ path: ".qa-logs/t659-same-dims.png" });
await page.keyboard.press("Escape");
await sleep(600);
}

// ---------- E: the console contract ----------
must(consoleErrors.length === 0, "E zero real JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "E zero frame 404s — the walls speak real bytes (t657/t658 contract)", `${resource404.length}`);
must(resourceFlap.length <= 60,
  "E server-flap resource failures bounded (one OOM death window's worth)",
  `${resourceFlap.length} refused/emptied loads`);
must(chunkFlap.length <= 5,
  "E lazy-chunk fetch flaps bounded (the loader's transient, self-healing voice)",
  `${chunkFlap.length} chunk retries`);
must(hmrNoise.length <= 10,
  "E dev-server HMR socket noise bounded (infrastructure self-voice, not product)",
  `${hmrNoise.length} refused handshakes`);

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt659-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

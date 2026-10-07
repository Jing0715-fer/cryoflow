// t667 — the deep-link family's cross-group consolidated audit. t659 (frames),
// t660 (class averages) and t665 (denoise) each proved their OWN arrival in
// their own window; no probe ever walked all three families in ONE session.
// The handshake's real contract is cross-family: a request issued for one wall
// must never open another wall's gesture, consuming one family must leave the
// others intact, and a consumed link stays consumed across tab switches and
// full inspector reopens (the Task 81 law, exercised three families deep).
//
// Probe contract:
//   A  the palette speaks all THREE gallery groups in one breath.
//   B  the first jump (frames) lands INSIDE the lightbox ("1 of 10"); the
//      one-shot law survives a Results→Overview tab dance.
//   C  the second jump (classes) lands on the teaser — and the frames
//      lightbox stays SHUT (cross-family isolation).
//   D  the third jump (denoise) lands on the results tab with the fuchsia
//      flash → fade — and the lightbox STILL never opened.
//   E  final hygiene: reopening the import job mounts a quiet wall (no
//      lightbox), reopening the denoise job mounts a wall with no re-flash.
//   F  the console contract — five buckets. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(300);
  }
};

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
const hmrNoise = [];
const resourceFlap = [];
const resource404 = [];
const chunkFlap = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const activeTab = page.locator('[data-insp-face="tabs"] [role="tab"][data-state="active"]');
const dashTab = page.locator('[role="tab"][title^="Project dashboard"]').first();
const backToRoster = async () => {
  // openJob forces the canvas view — the roster lives on the dashboard
  for (let i = 0; i < 8 && (await dashTab.count()) === 0; i++) await sleep(800);
  if ((await dashTab.count()) === 0) return false;
  await dashTab.click();
  await sleep(1500);
  return true;
};
const lightbox = page.locator('[data-gallery-ui="lightbox"]');
const openFromRoster = async (name, titlePrefix) => {
  const row = page.locator("[data-roster-row]", { hasText: name }).first();
  for (let i = 0; i < 10 && (await row.count()) === 0; i++) await sleep(900);
  if ((await row.count()) === 0) return false;
  const btn = row.locator(`button[title^="${titlePrefix}"]`).first();
  if ((await btn.count()) === 0) return false;
  await btn.click();
  return true;
};
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
/** the OOM ladder (t664/t665 doctrine): the roster click may land while the
 *  server is mid-restart — the dialog never opens and the leg looks dead.
 *  One reload + re-navigate + reopen gives the chunk cache its second chance
 *  (the first compile is the fragile one; a human refreshes too). */
const reopenWithRecovery = async (name, titlePrefix, settleMs) => {
  const dialogUp = async () => (await page.locator('[role="dialog"]').count()) > 0;
  if (await openFromRoster(name, titlePrefix)) {
    await sleep(settleMs);
    if (await dialogUp()) return true;
  }
  console.log("  · recovery ladder: dialog stranded — reload + re-navigate + reopen");
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitServerHealthy("recovery");
  await backToRoster();
  if (!(await openFromRoster(name, titlePrefix))) return false;
  await sleep(settleMs);
  return dialogUp();
};
const closeInsp = async () => {
  await page.keyboard.press("Escape");
  await sleep(900);
};
const jumpViaPalette = async (rowText) => {
  await waitServerHealthy(`before jump ${rowText.slice(0, 20)}`);
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
  const row = page.locator("[cmdk-item]", { hasText: rowText }).first();
  await pollUntil(async () => (await row.count()) > 0 || null, 10000);
  await row.click();
  await sleep(600);
};

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitServerHealthy("after goto");

// ---------- A: the palette speaks all THREE gallery groups ----------
await page.keyboard.press("Control+k");
await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
must((await page.locator("[cmdk-item]").count()) > 0, "A the palette opens with rows");
const frameRows = page.locator("[cmdk-item]", { hasText: "Frame gallery — " });
const classRows = page.locator("[cmdk-item]", { hasText: "Class averages — " });
const denoiseRows = page.locator("[cmdk-item]", { hasText: "Denoise compare — " });
await pollUntil(async () => (await frameRows.count()) >= 1 && (await denoiseRows.count()) >= 1 || null, 10000);
must((await frameRows.count()) >= 1, "A the Frame galleries group has its rows", `${await frameRows.count()}`);
must((await classRows.count()) >= 1, "A the Class averages group has its rows", `${await classRows.count()}`);
must((await denoiseRows.count()) >= 1, "A the Denoise compare group has its rows", `${await denoiseRows.count()}`);
must((await page.locator('[data-denoise-gallery][data-denoise-flash="on"]').count()) === 0,
  "A no flash anywhere before the first jump");
await page.keyboard.press("Escape");
await sleep(600);

// ---------- B: the FIRST jump (frames) lands inside the lightbox ----------
await jumpViaPalette("Frame gallery — EMPIAR mics import");
const lbArrived = await pollUntil(async () => (await lightbox.count()) > 0 || null, 20000);
must(!!lbArrived, "B the lightbox auto-opened — the arrival IS the lightbox");
const pos = await pollUntil(async () => {
  if ((await lightbox.count()) === 0) return null;
  const t = (await lightbox.locator('[data-gallery-ui="walk-pos"]').innerText().catch(() => "")).trim();
  return /^1\b/.test(t) || t === "1 / 10" || t.includes("1 of 10") ? t : null;
}, 10000);
must(!!pos, "B the arrival position is the FIRST frame", pos ?? "n/a");
mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t667-frames-arrival.png" });
await lightbox.press("Escape");
await pollUntil(async () => (await lightbox.count()) === 0 || null, 5000);
must((await lightbox.count()) === 0, "B Esc closes the lightbox");
// one-shot law across a tab dance: Results → Overview must NOT resurrect it
await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
await sleep(1400);
await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Overview/ }).first().click().catch(() => {});
await sleep(2200);
must((await lightbox.count()) === 0, "B the tab dance does not resurrect the link (one-shot)");
await closeInsp();

// ---------- C: the SECOND jump (classes) — cross-family isolation ----------
await jumpViaPalette("Class averages — ");
const teaserUp = await pollUntil(async () => {
  const t = page.locator("[data-class-teaser]");
  return (await t.count()) > 0 && (await t.isVisible()) || null;
}, 20000);
must(!!teaserUp, "C the class teaser is on screen (the tab IS the arrival)");
const tabTxt = await activeTab.first().innerText().catch(() => "");
must(tabTxt.includes("Overview"), "C the classes jump latches the Overview tab", tabTxt.trim());
must((await lightbox.count()) === 0,
  "C the frames lightbox stayed shut during a classes arrival (cross-family isolation)");
await closeInsp();

// ---------- D: the THIRD jump (denoise) — flash → fade, still isolated ----------
await jumpViaPalette("Denoise compare — ");
const gallery = page.locator('section[data-denoise-gallery][aria-label="Denoise compare"]');
const wallUp = await pollUntil(async () => (await gallery.count()) > 0 && (await gallery.isVisible()) || null, 20000);
must(!!wallUp, "D the denoise wall is on screen (results tab)");
let flashed = false;
for (let i = 0; i < 50 && !flashed; i++) {
  flashed = (await page.locator('[data-denoise-gallery][data-denoise-flash="on"]').count()) > 0;
  if (!flashed) await sleep(250);
}
must(flashed, "D the wall answers its link (fuchsia flash)");
await page.screenshot({ path: ".qa-logs/t667-denoise-arrival.png" });
let flashCleared = false;
for (let i = 0; i < 20 && !flashCleared; i++) {
  flashCleared = (await page.locator('[data-denoise-gallery][data-denoise-flash="on"]').count()) === 0;
  if (!flashCleared) await sleep(400);
}
must(flashCleared, "D the flash fades (a transient cue, not a permanent paint)");
must((await lightbox.count()) === 0,
  "D the frames lightbox STILL never opened (three jumps, zero cross-fire)");

// ---------- E: final hygiene — reopens mount quiet walls ----------
await closeInsp();
await waitServerHealthy("before E");
if (!(await backToRoster())) { must(false, "E back to the dashboard roster"); }
const impReopened = await reopenWithRecovery("EMPIAR mics import", "Open EMPIAR mics import", 2200);
if (impReopened) {
  // the smart default lands a completed job on Results — the wall mounts
  // on Overview (t659's reopen dance)
  const tabNow = await activeTab.first().innerText().catch(() => "");
  if (!tabNow.includes("Overview")) {
    await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Overview/ }).first().click().catch(() => {});
    await sleep(1500);
  }
  const thumbs = await pollUntil(async () => (await page.locator('[data-gallery-ui="thumb"]').count()) > 0 || null, 15000);
  must(!!thumbs, "E the import wall reopens mounted (a face, not a one-shot gesture)");
  must((await lightbox.count()) === 0,
    "E the import wall reopens QUIET (no lightbox — the link died in B, two jumps ago)");
  await closeInsp();
} else {
  must(false, "E the import job reopened from the roster");
}
const denReopened = await reopenWithRecovery("Topaz Denoise (seeded)", "Open Topaz Denoise (seeded)", 2500);
if (denReopened) {
  const tabNow = await activeTab.first().innerText().catch(() => "");
  if (!tabNow.includes("Results")) {
    await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
    await sleep(1500);
  }
  const gAgain = await pollUntil(async () => (await gallery.count()) > 0 && (await gallery.isVisible()) || null, 12000);
  must(!!gAgain, "E the denoise wall persists on reopen");
  must((await page.locator('[data-denoise-gallery][data-denoise-flash="on"]').count()) === 0,
    "E no re-flash on manual reopen (consumed is consumed forever)");
  await closeInsp();
} else {
  must(false, "E the denoise job reopened from the roster");
}

// ---------- F: the console contract ----------
must(consoleErrors.length === 0, "F zero real console errors",
  consoleErrors.slice(0, 3).join(" | ") || "0");
must(resource404.length <= 5, "F resource 404s bounded", `${resource404.length}`);
must(resourceFlap.length <= 5, "F connection flap bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "F chunk flap bounded", `${chunkFlap.length}`);
must(hmrNoise.length <= 5, "F hmr noise bounded", `${hmrNoise.length}`);

console.log(`\nt667-deeplink-family: ${PASS} pass / ${FAIL} fail`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);

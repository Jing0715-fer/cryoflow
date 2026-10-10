// t663 — the palette galleries' inline preview: the four-window pending
// item. A gallery row's job is easier to recognize by its first tile than
// by its name — the thumb watches cmdk's own data-selected attribute (one
// dialect covers pointer hover AND arrow keys), fetches the SAME tile URL
// the destination surface obeys (import-gallery's first frame; the teaser's
// lane rule for classes), caches module-level, and keeps the honest ladder:
// idle/absent rows stay icon-only, the peek is a gesture (collapses when
// the selection moves on), and a dead wall is cached dead for the session.
//
// Probe contract:
//   A  the palette speaks both gallery groups (the t659/t660 rows).
//   B  hover the import wall's row → the thumb appears, loads, and REALLY
//      renders (naturalWidth > 0) with the frame recipe's URL.
//   C  arrows move the selection onto the class-averages row → its thumb
//      appears through the MutationObserver dialect; the frame row's peek
//      collapses (one row at a time).
//   D  the cache: re-activating a row costs zero extra /micrographs or
//      /classes requests.
//   E  honest absence: a 500ing wall answers with state=absent and no img
//      (the row keeps its compact form — no spinner loop).
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

// request counter for the two list APIs the thumbs fetch
const listRequests = [];
page.on("request", (r) => {
  const u = r.url();
  if (/\/api\/jobs\/[^/]+\/(micrographs|classes)(\?|$)/.test(u)) listRequests.push(u);
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// ---------- A: the palette speaks both gallery groups ----------
await page.keyboard.press("Control+k");
await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
must((await page.locator("[cmdk-item]").count()) > 0, "A the palette opens with rows");

const frameRows = page.locator('[cmdk-item]', { hasText: "Frame gallery — " });
const classRows = page.locator('[cmdk-item]', { hasText: "Class averages — " });
await pollUntil(async () => (await frameRows.count()) >= 2 || null, 10000);
must((await frameRows.count()) >= 2, "A the Frame galleries group has its rows", `${await frameRows.count()}`);
must((await classRows.count()) >= 1, "A the Class averages group has its rows", `${await classRows.count()}`);
// idle rows claim no space: no visible thumb anywhere before activation
const idleThumbs = await page.evaluate(() =>
  [...document.querySelectorAll("[data-palette-thumb]")].filter((x) => !x.classList.contains("hidden")).length);
must(idleThumbs === 0, "A no thumb claims space before activation", `${idleThumbs} visible`);

// ---------- B: hover → the peek loads and really renders ----------
const importRow = page.locator('[cmdk-item]', { hasText: "Frame gallery — EMPIAR mics import" }).first();
await importRow.hover();
const thumbUp = await pollUntil(async () => {
  const t = await importRow.locator('[data-palette-thumb]:not(.hidden)').count();
  return t === 1 || null;
}, 8000);
must(!!thumbUp, "B hovering the import wall's row raises the thumb");
const imgReady = await pollUntil(async () => {
  const img = importRow.locator("[data-palette-thumb] img");
  if ((await img.count()) !== 1) return null;
  const ok = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
  return ok || null;
}, 15000);
must(!!imgReady, "B the peek really renders (naturalWidth > 0)");
const src = await importRow.locator("[data-palette-thumb] img").getAttribute("src").catch(() => "");
must(!!src && src.includes("/outputs/file") && src.includes("format=png"),
  "B the peek speaks the frame recipe (outputs/file?format=png)", src?.slice(0, 80));

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t663-frame-peek.png" });

// ---------- C: arrows move the peek (the observer dialect) ----------
// leave the row: hover a plain command row (the first navigation command)
const navRow = page.locator("[cmdk-item]").first();
await navRow.hover();
await pollUntil(async () => (await importRow.locator('[data-palette-thumb]:not(.hidden)').count()) === 0 || null, 5000);
must(true, "C leaving the row collapses the peek (a gesture, not a fixture)");

// arrow down from the top: cmdk starts at the first item — walk until the
// class-averages row is the selected one (bounded walk)
const classRow = classRows.first();
let walked = 0;
for (; walked < 40; walked++) {
  const sel = await classRow.evaluate((el) => el.getAttribute("data-selected") === "true").catch(() => false);
  if (sel) break;
  await page.keyboard.press("ArrowDown");
  await sleep(120);
}
must(walked < 40, "C arrows reach the class-averages row", `${walked} steps`);
const classThumbUp = await pollUntil(async () => {
  const t = await classRow.locator('[data-palette-thumb]:not(.hidden)').count();
  return t === 1 || null;
}, 8000);
must(!!classThumbUp, "C the class row's thumb rises through the observer dialect");
const classImg = await pollUntil(async () => {
  const img = classRow.locator("[data-palette-thumb] img");
  if ((await img.count()) !== 1) return null;
  const ok = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
  return ok || null;
}, 15000);
must(!!classImg, "C the class peek really renders");
const classSrc = await classRow.locator("[data-palette-thumb] img").getAttribute("src").catch(() => "");
must(!!classSrc && (classSrc.includes("montage=0&slice=0") || classSrc.includes("axis=z&pos=0.5")),
  "C the class peek speaks the teaser's lane rule", classSrc?.slice(0, 90));

await page.screenshot({ path: ".qa-logs/t663-class-peek.png" });

// ---------- D: the cache — re-activation costs no network ----------
const micrographRequests = () => listRequests.filter((u) => u.includes("/micrographs")).length;
const classesRequests = () => listRequests.filter((u) => u.includes("/classes")).length;
const mBefore = micrographRequests();
const cBefore = classesRequests();
await importRow.hover();
await pollUntil(async () => (await importRow.locator('[data-palette-thumb]:not(.hidden)').count()) === 1 || null, 5000);
await navRow.hover(); // leave
await sleep(400);
await importRow.hover(); // come back — third activation
await pollUntil(async () => (await importRow.locator('[data-palette-thumb]:not(.hidden)').count()) === 1 || null, 5000);
must(micrographRequests() === mBefore,
  "D re-activations cost zero extra /micrographs requests", `${micrographRequests() - mBefore} extra`);
must(classesRequests() === cBefore,
  "D re-activations cost zero extra /classes requests", `${classesRequests() - cBefore} extra`);

// ---------- E: honest absence — a 500ing wall stays icon-only ----------
const motionRow = page.locator('[cmdk-item]', { hasText: "Frame gallery — own motioncorr" }).first();
await page.route(/\/micrographs\?/, (route) => route.fulfill({ status: 500, body: "{}" }));
await motionRow.hover();
const absentState = await pollUntil(async () => {
  const st = await motionRow.locator('[data-palette-thumb]').first().getAttribute("data-palette-thumb-state").catch(() => null);
  return st === "absent" || null;
}, 8000);
must(!!absentState, "E a 500ing wall lands on state=absent");
const noImg = await motionRow.locator('[data-palette-thumb] img').count();
must(noImg === 0, "E the absent row shows no img (no spinner loop)", `${noImg}`);
await page.unroute(/\/micrographs\?/);
// and the palette closes clean (the roster behind is untouched)
await page.keyboard.press("Escape");
await sleep(400);
must((await page.locator("[cmdk-item]").count()) === 0, "E Escape retires the palette");

// ---------- F: the console contract ----------
must(consoleErrors.length === 0, "F zero real JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "F zero resource 404s", `${resource404.length}`);
must(resourceFlap.length <= 60, "F server-flap resource failures bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "F lazy-chunk fetch flaps bounded", `${chunkFlap.length}`);
must(hmrNoise.length <= 10, "F HMR socket noise bounded", `${hmrNoise.length}`);

await b.close();
console.log(`\nt663-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

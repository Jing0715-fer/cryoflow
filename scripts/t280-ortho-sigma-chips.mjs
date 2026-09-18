// t280 — σ walks over to the 2D side (Task 280).
//
// Two Task-279 leftovers close in one window:
//
// ① THE CONTOUR METADATA LINE: the triptych export's footer named the map,
//    the focus fractions and the moment — but not the CONTOUR the 3D view
//    was drawn at. A figure without its contour level is half a figure
//    (RELION's _display always prints σ alongside the map). The σ lived
//    only in the embed's state, behind no channel the panel could read.
//    The panel now pulls on mount (cryoflow:ortho-sigma-request) and the
//    embed answers from its ref — the same "what the screen shows right
//    now" source the bookmark capture reads — and pushes on every change
//    (cryoflow:ortho-sigma-state, echoing the [sigma, sign] effect that
//    also runs on mount). The header grows a quiet cyan chip; the export
//    footer gains `iso N.NN σ · ` ahead of the focus fractions. Absent σ
//    (nothing heard yet) keeps both honest: chipless header, footer
//    without the segment — a GUESSED default 2.00 would be a lie.
//
// ② THE FOCUS CHIP IN BOOKMARK ROWS: t279 froze the tri-planar focus
//    point into every saved view, but the row still showed only
//    σ / slice / clip — WHERE the inspection happened was invisible
//    until you restored the view. renderViewChips grows a fourth chip
//    (cyan — the ortho panel's own hue; the three plane accents are
//    taken): `focus 25/75/50%`. The import-preview dialog shares the
//    renderer, legacy rows without focus stay chipless.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — the request/response pair, the push in the σ
//      effect, the ref-sourced answer, the honest-absent chip and footer
//      segment, the focus chip branch
//   C  alive on the seeded 64³ world — the chip is live from the dialog's
//      first paint (pull channel), follows a preset click (push channel),
//      the saved view's row shows the focus chip, a view-without-focus
//      row stays chipless after reload, and the export (σ in the footer)
//      keeps the documented raster 1592×638 (t291: the footer grew the distribution)
//   Z  roster identity + console clean
//
// Run: node scripts/t280-ortho-sigma-chips.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// t280 run1/run5 lesson: a.click() fires the download event BEFORE the
// React setState("ok") commits to the DOM — an immediate getAttribute can
// still read "busy" (lost the race 2 of 5 runs). Poll instead: busy must
// RESOLVE to ok/idle, not be read atomically at saveAs-return time.
async function pollUntil(fn, deadlineMs, intervalMs = 250) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}
const near = (a, b, tol = 0.06) => typeof a === "number" && Math.abs(a - b) <= tol;

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

console.log("== PHASE A: demo truth ==");
await fetch(`${BASE}/`).then((r) => must(r.status === 200, `homepage 200 (got ${r.status})`));
const roster = await (await fetch(`${BASE}/api/jobs`)).json();
must((roster.jobs ?? []).length === 21, `roster 21 (got ${(roster.jobs ?? []).length})`);

console.log("== PHASE B: source ledger ==");
const orthoSrc = readFileSync("src/components/workflow/results/map-ortho-panel.tsx", "utf8");
must(orthoSrc.includes('ORTHO_SIGMA_STATE_EVENT = "cryoflow:ortho-sigma-state"'), "the σ push event exists (3D → 2D)");
must(orthoSrc.includes('ORTHO_SIGMA_REQUEST_EVENT = "cryoflow:ortho-sigma-request"'), "the σ pull event exists (2D → 3D)");
must(orthoSrc.includes("export interface OrthoSigmaState"), "the σ payload shape is a shared contract");
must(orthoSrc.includes("window.addEventListener(ORTHO_SIGMA_STATE_EVENT"), "the panel listens for contour pushes");
must(orthoSrc.includes("new CustomEvent(ORTHO_SIGMA_REQUEST_EVENT)"), "the panel pulls on mount (request dispatched)");
must(orthoSrc.includes("typeof d.sigma !== \"number\" || !Number.isFinite(d.sigma)"), "the pull answer is validated (malformed σ ignored)");
must(orthoSrc.includes('data-canvas-ui="ortho-sigma-chip"'), "the header chip carries its locator");
must(orthoSrc.includes("isoSigma && ("), "the chip is absent until a σ arrives (no guessed default)");
must(orthoSrc.includes("const sigmaSeg = isoSigma ?"), "the footer's σ segment is conditional (honest footer)");
must(orthoSrc.includes("iso ${isoSigma.sign < 0 ? \"-\" : \"\"}"), "the footer names the sign with the contour");

const embedSrc = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
must(embedSrc.includes("ORTHO_SIGMA_STATE_EVENT, ORTHO_SIGMA_REQUEST_EVENT"), "the embed imports the σ event pair");
must(embedSrc.includes("new CustomEvent(ORTHO_SIGMA_STATE_EVENT, { detail: { sigma, sign } })"), "every σ change pushes to the 2D side");
must(embedSrc.includes("detail: { sigma: sigmaRef.current, sign: signRef.current }"), "the pull answers from the refs (screen-truth, not stale state)");
must(embedSrc.includes("window.addEventListener(ORTHO_SIGMA_REQUEST_EVENT"), "the embed keeps the pull door open");
must(embedSrc.includes("{v.focus && ("), "the bookmark row's focus chip branches on the saved point");
must(embedSrc.includes("focus {Math.round(v.focus.x * 100)}/{Math.round(v.focus.y * 100)}/{Math.round(v.focus.z * 100)}%"), "the focus chip reads as fractions (25/75/50%)");
must(embedSrc.includes("bg-cyan-600/10 px-1 py-px"), "the focus chip wears the ortho panel's cyan");

console.log("== PHASE C: alive on the seeded world ==");
// the volume world (t253's recipe — idempotent, roster stays 21)
try {
  execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe", timeout: 120_000 });
  must(true, "the volume world is seeded (qa67-seed-volume)");
} catch (e) {
  must(false, `the volume world failed to seed: ${String(e).slice(0, 90)}`);
}
const jobsNow = await (await fetch(`${BASE}/api/jobs`)).json();
const host = (jobsNow.jobs ?? []).find((j) => j.name === "QA Refine3D");
must(!!host, "QA Refine3D in roster (the seeder's host)");

const browser = await chromium.launch();
const page = await browser.newPage({ acceptDownloads: true });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const bmUrl = `${BASE}/api/jobs/${host?.id}/camera-bookmarks`;

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(1800);
  await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
  await sleep(1600);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const orthoTileBtn = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await orthoTileBtn.isVisible().catch(() => false)) await orthoTileBtn.click();
  else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(1100);
  await page.locator("button", { hasText: "View in 3D" }).click();
  let viewerUp = false;
  for (let k = 0; k < 30; k++) {
    await sleep(2000);
    if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { viewerUp = true; break; }
  }
  must(viewerUp, "Mol* viewer live");

  // expand the ortho strip (default collapsed)
  const stripBtn = page.locator('button[aria-expanded]', { hasText: "Orthogonal slices" }).first();
  if ((await stripBtn.getAttribute("aria-expanded").catch(() => null)) === "false") {
    await stripBtn.click();
    await sleep(400);
  }
  must((await stripBtn.getAttribute("aria-expanded")) === "true", "the ortho strip is expanded");

  // C1 — the chip is live from the dialog's first paint: the panel pulled
  // on mount, the embed answered with the screen-truth σ (2.00 default)
  const chip = page.locator('[data-canvas-ui="ortho-sigma-chip"]');
  await chip.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  must(await chip.isVisible().catch(() => false), "the σ chip is visible (pull channel answered)");
  must((await chip.textContent().catch(() => ""))?.trim() === "iso 2.00 σ",
    `the chip reads the live contour ("${(await chip.textContent().catch(() => "") ?? "").trim()}")`);

  // C2 — the push channel: a preset click moves BOTH the 3D contour and
  // the 2D chip in the same breath
  await page.locator('button[aria-label="Set contour to 3 sigma"]').first().click();
  await sleep(700);
  must((await chip.textContent().catch(() => ""))?.trim() === "iso 3.00 σ",
    `the chip followed the preset push ("${(await chip.textContent().catch(() => "") ?? "").trim()}")`);

  // C3 — pick a focus point, save a view, the ROW shows the focus chip
  const xyImg = page.locator('[data-canvas-ui="ortho-tile-z"] .cursor-crosshair');
  const box = await xyImg.boundingBox();
  must(!!box && box.width > 40, "the XY image box is measurable (pick target real)");
  if (box) {
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.75);
    await sleep(600);
  }
  await page.locator('button[aria-label^="Camera view bookmarks"]').first().click({ force: true });
  await sleep(600);
  const pop = page.locator('[data-canvas-ui="camera-bookmarks"]');
  await pop.locator("input").fill("t280 Sigma");
  await pop.locator('button:has-text("Save")').click();
  await sleep(900);
  const saved = await (await fetch(bmUrl, { headers: SH })).json();
  const bm = (saved.bookmarks ?? []).find((x) => x.name === "t280 Sigma");
  must(!!bm, "the saved view landed server-side");
  must(bm?.view?.sigma === 3, `the view froze the CURRENT σ (got ${bm?.view?.sigma})`);
  must(near(bm?.view?.focus?.x, 0.25, 0.02) && near(bm?.view?.focus?.y, 0.75, 0.02),
    `the view carries the focus point (x ${bm?.view?.focus?.x}, y ${bm?.view?.focus?.y})`);
  const rowTxt = await pop.locator("text=t280 Sigma").locator("..").textContent().catch(() => "");
  must(!!rowTxt && /focus 25\/75\/50%/.test(rowTxt.replace(/\s+/g, " ")),
    `the row shows the focus chip ("${(rowTxt ?? "").replace(/\s+/g, " ").slice(0, 120)}")`);
  must(!!rowTxt && /3\.00 σ/.test(rowTxt.replace(/\s+/g, " ")), "the row shows the σ chip it was saved at");
  await page.screenshot({ path: `${SHOTS}/t280-sigma-chip-row.png` });
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);

  // C4 — the export carries the σ in its footer segment and keeps the
  // documented raster (the σ segment JOINED the line — no strip grew)
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.locator('[data-canvas-ui="ortho-export"]').click(),
  ]);
  mkdirSync(SHOTS, { recursive: true });
  const pngPath = `${SHOTS}/t280-triptych-sigma.png`;
  await download.saveAs(pngPath);
  const png = readFileSync(pngPath);
  must(png.length > 4 && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47,
    "the download is a real PNG (magic bytes)");
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  must(w === 1592, `the triptych width is unchanged (got ${w})`);
  must(h === 638, `the footer grew with the distribution (t291: 64px band, got ${h})`);
  const state = await pollUntil(async () => {
    const s = await page.locator('[data-canvas-ui="ortho-export"]').getAttribute("data-ortho-export-state");
    return s === "ok" || s === "idle" ? s : null;
  }, 8000);
  must(state === "ok" || state === "idle", `the export button reported success (state "${state}")`);

  // C5 — a view WITHOUT focus (t279-era shape) restores and stays
  // chipless: absent is honest
  const putLegacy = {
    bookmarks: [
      bm,
      {
        id: "qa-t280-nofocus",
        name: "t280 NoFocus",
        ts: Date.now(),
        snapshot: {
          position: [1, 1, 1], up: [0, 1, 0], target: [0, 0, 0],
          fov: 0.876, radius: 10, radiusMax: 100,
        },
        view: {
          sigma: 2, sign: 1,
          slice: { on: false, axis: "Z", pos: 0.5 },
          clip: { on: false, x: 1, y: 1, z: 1, invert: false },
        },
      },
    ],
  };
  const putRes = await fetch(bmUrl, {
    method: "PUT",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify(putLegacy),
  });
  must(putRes.ok, `the no-focus probe PUT is accepted (got ${putRes.status})`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2200);
  await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
  await sleep(1500);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1200);
  const orthoTileBtn2 = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await orthoTileBtn2.isVisible().catch(() => false)) await orthoTileBtn2.click();
  else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(1100);
  await page.locator("button", { hasText: "View in 3D" }).click();
  for (let k = 0; k < 30; k++) {
    await sleep(2000);
    if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break;
  }
  await page.locator('button[aria-label^="Camera view bookmarks"]').first().click({ force: true });
  await sleep(600);
  const pop2 = page.locator('[data-canvas-ui="camera-bookmarks"]');
  const legacyTxt = await pop2.locator("text=t280 NoFocus").locator("..").textContent().catch(() => "");
  must(!!legacyTxt && !/focus \d+\/\d+\/\d+%/.test(legacyTxt.replace(/\s+/g, " ")),
    "the no-focus row stays chipless (no guessed fractions)");
  const liveTxt = await pop2.locator("text=t280 Sigma").locator("..").textContent().catch(() => "");
  must(!!liveTxt && /focus 25\/75\/50%/.test(liveTxt.replace(/\s+/g, " ")),
    "the focus row still shows its chip after the reload");
} finally {
  try { await browser.close().catch(() => {}); } catch { /* gone */ }
  console.log("== cleanup ==");
  try {
    // empty list = the server drops the bookmark row entirely
    await fetch(bmUrl, {
      method: "PUT",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ bookmarks: [] }),
    });
  } catch { /* already gone */ }
  try {
    const gone = await (await fetch(bmUrl, { headers: SH })).json();
    must((gone.bookmarks ?? []).length === 0, "the bookmark row left with the witness");
  } catch { /* server said its piece */ }
  // the triptych stays in shots-qa as the window's mugshot
}

console.log("== PHASE Z: the world as it was ==");
const rosterEnd = await (await fetch(`${BASE}/api/jobs`)).json();
must((rosterEnd.jobs ?? []).length === 21, `roster 21 after the dance (got ${(rosterEnd.jobs ?? []).length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 80)}` : ""})`);

console.log(fail === 0 ? "\nt280: ALL PASS" : `\nt280: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

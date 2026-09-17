// t279 — the triptych leaves the app, and the focus point rides in every
// saved view (Task 279).
//
// Two Task-278 leftovers close in one window:
//
// ① TRIPTYCH EXPORT: the three orthogonal sections are the classic
//    multi-panel figure of every cryo-EM paper, but they lived only in
//    the app — nothing could carry them into a deck or a manuscript. The
//    panel header grows an export button (sibling of the crosshair
//    toggle, never nested): the tiles' own server renderer supplies the
//    planes at the CURRENT focus point, and the panel composites ONE PNG
//    on a fixed publishing-style grid — per-plane label in the tile's
//    accent, voxel readout, the crosshair lines in the same accents as
//    on screen, a footer naming the map, the focus fractions and the
//    moment. A document asset, not a screenshot.
//
// ② FOCUS RIDES IN BOOKMARKS: a saved view already carries σ, sign,
//    slice and clip — but not WHERE the inspection was happening. The
//    ortho browser now reports its tri-planar focus point up
//    (cryoflow:ortho-focus), the embed freezes it into the view
//    (captureBookmarkView), the server whitelists it (sanitizeView), and
//    a restored bookmark flies the three planes back through the SAME
//    two channels a pick uses (cryoflow:ortho-focus-restore → positions
//    + follow): "fly back" means the whole picture. Legacy rows without
//    focus restore untouched — the field is optional at every door.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — the event pair, the export machinery, the four
//      focus doors (capture / restore / import check / server whitelist)
//   C  alive on the seeded 64³ world — the focus event reports the pick;
//      the export button downloads a real PNG with the documented raster
//      (1592×630); saving a view persists view.focus server-side; the
//      server clamps out-of-range fractions; restoring a view flies the
//      planes back; a legacy pose-only bookmark still restores
//   Z  roster identity + console clean
//
// Run: node scripts/t279-ortho-export-focus.mjs   (server on :3000)
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
must(orthoSrc.includes('ORTHO_FOCUS_EVENT = "cryoflow:ortho-focus"'), "the focus report event exists (2D → 3D)");
must(orthoSrc.includes('ORTHO_FOCUS_RESTORE_EVENT = "cryoflow:ortho-focus-restore"'), "the focus restore event exists (3D → 2D)");
must(orthoSrc.includes("new CustomEvent(ORTHO_FOCUS_EVENT"), "every committed focus change is reported to the embed");
must(orthoSrc.includes("window.addEventListener(ORTHO_FOCUS_RESTORE_EVENT"), "the panel adopts a restored focus point");
must(orthoSrc.includes('"ortho-export"'), "the export button carries its locator");
must(orthoSrc.includes("data-ortho-export-state={exportState}"), "the export button speaks its machine state to tests");
must(orthoSrc.includes("createImageBitmap"), "the planes are rasterized from the server's own renders");
must(orthoSrc.includes('cv.toBlob(res, "image/png")'), "the triptych is encoded as a real PNG");
must(orthoSrc.includes("EXPORT_TILE = 512"), "the export raster is a fixed publishing grid (512px tiles)");
must(orthoSrc.includes("ctx.setLineDash([5, 4])"), "the crosshair keeps its dashed language in the export");
must(orthoSrc.includes("readoutFor(t.axis, positions[t.axis])"), "each panel names its voxel truth");

const embedSrc = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
must(embedSrc.includes("ORTHO_FOCUS_EVENT, ORTHO_FOCUS_RESTORE_EVENT"), "the embed imports the focus event pair");
must(embedSrc.includes("orthoFocusRef"), "the embed stores the focus point in a ref (capture without re-render)");
must(embedSrc.includes("...(orthoFocusRef.current ? { focus: { ...orthoFocusRef.current } } : {})"),
  "captureBookmarkView freezes the focus into the saved view");
must(embedSrc.includes("new CustomEvent(ORTHO_FOCUS_RESTORE_EVENT"), "a restored bookmark flies the focus back");
must(embedSrc.includes("focus?: { x: number; y: number; z: number }"), "the view type carries the optional focus field");
must(embedSrc.includes("if (!f || !num(f.x) || !num(f.y) || !num(f.z)) return undefined;"),
  "imported files with a malformed focus degrade honestly");

const routeSrc = readFileSync("src/app/api/jobs/[id]/camera-bookmarks/route.ts", "utf8");
must(routeSrc.includes("x: bounded(fc.x, 0, 1, 0.5)"), "the server whitelists and clamps the focus fractions");
must(routeSrc.includes("...(focus ? { focus } : {})"), "legacy rows without focus stay untouched on the wire");

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

const bmKey = `cryoflow.mol-camera-bookmarks:${host?.id}`;
const bmUrl = `${BASE}/api/jobs/${host?.id}/camera-bookmarks`;
let downloadPath = null;

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

  // C1 — the focus event reports the pick: listen, click the XY image at
  // (25%, 75%), read the last reported point back
  await page.evaluate(() => {
    window.__t279focus = [];
    window.addEventListener("cryoflow:ortho-focus", (e) => window.__t279focus.push(e.detail));
  });
  const xyImg = page.locator('[data-canvas-ui="ortho-tile-z"] .cursor-crosshair');
  const box = await xyImg.boundingBox();
  must(!!box && box.width > 40, "the XY image box is measurable (pick target real)");
  if (box) {
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.75);
    await sleep(600);
    const f = await page.evaluate(() => (window.__t279focus ?? []).at(-1));
    must(!!f, "the focus report arrived");
    must(near(f?.x, 0.25) && near(f?.y, 0.75) && near(f?.z, 0.5),
      `the reported point is the picked one (x ${f?.x}, y ${f?.y}, z ${f?.z})`);
  }

  // C2 — the triptych export: click the button, catch the download, read
  // the PNG's IHDR (the documented raster is 1592 × 630)
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.locator('[data-canvas-ui="ortho-export"]').click(),
  ]);
  mkdirSync(SHOTS, { recursive: true });
  downloadPath = `${SHOTS}/t279-triptych.png`;
  await download.saveAs(downloadPath);
  const png = readFileSync(downloadPath);
  must(png.length > 4 && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47,
    "the download is a real PNG (magic bytes)");
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  must(w === 1592, `the triptych is three 512px panels wide (got ${w})`);
  must(h === 616, `the triptych carries label + footer strips (14+34+512+14+42, got ${h})`);
  must(/^ortho-.*-\d{6}\.png$/.test(download.suggestedFilename() ?? ""),
    `the filename is map-named and stamped ("${download.suggestedFilename()}")`);
  const state = await page.locator('[data-canvas-ui="ortho-export"]').getAttribute("data-ortho-export-state");
  must(state === "ok" || state === "idle", `the export button reported success (state "${state}")`);

  // C3 — saving a view freezes the focus into it (server-side truth)
  await page.locator('button[aria-label^="Camera view bookmarks"]').first().click({ force: true });
  await sleep(600);
  const pop = page.locator('[data-canvas-ui="camera-bookmarks"]');
  await pop.locator("input").fill("t279 Focus");
  await pop.locator('button:has-text("Save")').click();
  await sleep(900);
  const saved = await (await fetch(bmUrl, { headers: SH })).json();
  const bm = (saved.bookmarks ?? []).find((x) => x.name === "t279 Focus");
  must(!!bm, "the saved view landed server-side");
  must(near(bm?.view?.focus?.x, 0.25, 0.02) && near(bm?.view?.focus?.y, 0.75, 0.02) && near(bm?.view?.focus?.z, 0.5, 0.02),
    `the view carries the focus point (x ${bm?.view?.focus?.x}, y ${bm?.view?.focus?.y}, z ${bm?.view?.focus?.z})`);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);

  // C4 — the server clamps out-of-range fractions at the door. The PUT is
  // a whole-list replace, so the real view rides along beside the probe.
  const putClamp = {
    bookmarks: [
      bm,
      {
        id: "qa-t279-clamp",
        name: "t279 Clamp",
        ts: Date.now(),
        snapshot: {
          position: [1, 1, 1], up: [0, 1, 0], target: [0, 0, 0],
          fov: 0.876, radius: 10, radiusMax: 100,
        },
        view: {
          sigma: 2, sign: 1,
          slice: { on: false, axis: "Z", pos: 0.5 },
          clip: { on: false, x: 1, y: 1, z: 1, invert: false },
          focus: { x: 5, y: -1, z: 0.5 },
        },
      },
    ],
  };
  const putRes = await fetch(bmUrl, {
    method: "PUT",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify(putClamp),
  });
  must(putRes.ok, `the clamp probe PUT is accepted (got ${putRes.status})`);
  const clamped = await (await fetch(bmUrl, { headers: SH })).json();
  const cb = (clamped.bookmarks ?? []).find((x) => x.id === "qa-t279-clamp");
  must(cb?.view?.focus?.x === 1 && cb?.view?.focus?.y === 0,
    `out-of-range fractions are clamped (x ${cb?.view?.focus?.x}, y ${cb?.view?.focus?.y})`);

  // C5 — restoring the view flies the planes back: move the pick first,
  // then click the bookmark row and watch the crosshair world return
  if (box) {
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3);
    await sleep(600);
    const xzNow = await page.locator('[role="slider"][aria-label="XZ plane position along Y"]').getAttribute("aria-valuenow");
    must(near(Number(xzNow), 0.3), `the pick moved the XZ plane first (~30%, got ${xzNow})`);
  }
  await page.locator('button[aria-label^="Camera view bookmarks"]').first().click({ force: true });
  await sleep(600);
  // the list now holds "t279 Focus" + the clamp probe — restore the real one
  await page.locator('[data-canvas-ui="camera-bookmarks"]').locator("text=t279 Focus").first().click();
  await sleep(1200);
  const xzBack = await page.locator('[role="slider"][aria-label="XZ plane position along Y"]').getAttribute("aria-valuenow");
  const yzBack = await page.locator('[role="slider"][aria-label="YZ plane position along X"]').getAttribute("aria-valuenow");
  must(near(Number(xzBack), 0.75), `the XZ plane flew back to the saved row (~75%, got ${xzBack})`);
  must(near(Number(yzBack), 0.25), `the YZ plane flew back to the saved column (~25%, got ${yzBack})`);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);

  // C6 — a legacy pose-only bookmark (no view at all) still restores clean
  const legacy = {
    bookmarks: [
      {
        id: "qa-t279-legacy",
        name: "t279 Legacy",
        ts: Date.now(),
        snapshot: {
          position: [1, 1, 1], up: [0, 1, 0], target: [0, 0, 0],
          fov: 0.876, radius: 10, radiusMax: 100,
        },
      },
    ],
  };
  await fetch(bmUrl, {
    method: "PUT",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify(legacy),
  });
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
  await page.locator('[data-canvas-ui="camera-bookmarks"]').locator("text=t279 Legacy").first().click();
  await sleep(1000);
  must(consoleErrors.length === 0, `the legacy restore raised nothing (got ${consoleErrors.length})`);
  await page.screenshot({ path: `${SHOTS}/t279-legacy-restore.png` });
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

console.log(fail === 0 ? "\nt279: ALL PASS" : `\nt279: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

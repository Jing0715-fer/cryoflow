// t296 — the big map's verdict (Task 296).
// Every map Mol* had ever been handed in this repo's live tests was toy-scale:
// the demo orthovol is 64³ (1 MB), the t293 planted borrow map 720×720×1
// (2 MB). The leftover note "remote-view-3d 大 map 的 Mol* 渲染实测" deferred
// nine windows in a row — this suite closes it. A REAL reconstruction-scale
// volume (256³ float32 = 64 MB, 64× the voxel count of the biggest 3D volume
// the test world had) walks the whole client pipeline the way a user's map
// does: mapimport → identity card (header stats, no scan) → View in 3D →
// fetch via the streaming raw route → ParseCcp4 → VolumeFromCcp4 →
// isosurface — with the wall clock measured at each gate, contour presets
// still interactive on 16.7M voxels, and the server-side histogram route
// (full-grid scan, LRU-cached) timed twice to witness the second-look-free
// contract on a map big enough for cache misses to matter.
//
// Phases:
//   A  demo truth — homepage 200, roster 23
//   B  the ledger — the streaming raw route (the 1.4 GB OOM lesson, in
//      source), the 4-stage loading overlay ("Building isosurface…"), the
//      ParseCcp4 volume chain, the mapimport volumes-only validation, the
//      contour slider contract
//   C  the live loop —
//      C0  deterministic 256³ float32 synthetic MRC (three gaussian blobs,
//          honest MRC2014 header stats — min/max/mean/rms computed, not faked)
//      C1  mapimport → native run → completed → model_mrc declared (64 MB)
//      C2  identity card shows the real dims chip → View in 3D → TIMED from
//          click to loading overlay detach → canvas alive, no error overlay
//      C3  contour preset (5σ) commits on the big map — no crash, no error
//          overlay; screenshot
//      C4  Esc closes the dialog
//      C5  histogram API on the big map — timed twice; second look is LRU-free
//   D  console clean
//
// Run: node scripts/t296-big-map-viewer.mjs   (server on :3000)

import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, lstatSync, writeSync, openSync, closeSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const BASE = "http://localhost:3000";
const TMP = "/home/z/my-project/scripts/tmp-t296";
const SHOTS = "/home/z/my-project/shots-qa";
const N = Number(process.env.T296_N ?? 256); // 256³ float32 = 64 MB
// same-origin headers for the API-direct checks — the file routes guard on
// browser-always-sent headers (isLocalRequest), bare Node fetch gets 403
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// ---- the map generator -----------------------------------------------------
// Deterministic (no RNG): three gaussian blobs, bounding-box evaluated (only
// voxels within 4σ of a blob's center pay the exp() — the other ~14M voxels
// are plain zeros), then ONE full pass for honest header stats. The header
// claims nothing the data doesn't back: dmin/dmax/dmean/rms are computed, so
// the identity card's chips and Mol*'s σ threshold both speak the truth.
function writeBigMrc(file, n) {
  const voxels = new Float32Array(n * n * n);
  const blobs = [
    { c: [n / 2, n / 2, n / 2], s: n * 0.09, a: 10 },
    { c: [n * 0.3, n * 0.62, n * 0.55], s: n * 0.05, a: 6 },
    { c: [n * 0.68, n * 0.4, n * 0.42], s: n * 0.06, a: 7 },
  ];
  const idx = (x, y, z) => (z * n + y) * n + x;
  for (const b of blobs) {
    const r = Math.ceil(b.s * 4);
    const x0 = Math.max(0, Math.floor(b.c[0] - r)), x1 = Math.min(n - 1, Math.ceil(b.c[0] + r));
    const y0 = Math.max(0, Math.floor(b.c[1] - r)), y1 = Math.min(n - 1, Math.ceil(b.c[1] + r));
    const z0 = Math.max(0, Math.floor(b.c[2] - r)), z1 = Math.min(n - 1, Math.ceil(b.c[2] + r));
    const inv2s2 = 1 / (2 * b.s * b.s);
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const dx = x - b.c[0], dy = y - b.c[1], dz = z - b.c[2];
          voxels[idx(x, y, z)] += b.a * Math.exp(-(dx * dx + dy * dy + dz * dz) * inv2s2);
        }
  }
  let mn = Infinity, mx = -Infinity, sum = 0;
  for (let i = 0; i < voxels.length; i++) {
    const v = voxels[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    sum += v;
  }
  const mean = sum / voxels.length;
  let sum2 = 0;
  for (let i = 0; i < voxels.length; i++) {
    const d = voxels[i] - mean;
    sum2 += d * d;
  }
  const rms = Math.sqrt(sum2 / voxels.length);

  const header = Buffer.alloc(1024);
  header.writeInt32LE(n, 0); header.writeInt32LE(n, 4); header.writeInt32LE(n, 8);
  header.writeInt32LE(2, 12); // mode 2 = float32
  header.writeInt32LE(0, 16); header.writeInt32LE(0, 20); header.writeInt32LE(0, 24); // nxstart…
  header.writeInt32LE(n, 28); header.writeInt32LE(n, 32); header.writeInt32LE(n, 36); // mx,my,mz
  header.writeFloatLE(n, 40); header.writeFloatLE(n, 44); header.writeFloatLE(n, 48); // cella → 1.0 Å/vox
  header.writeFloatLE(90, 52); header.writeFloatLE(90, 56); header.writeFloatLE(90, 60); // cellb
  header.writeInt32LE(1, 64); header.writeInt32LE(2, 68); header.writeInt32LE(3, 72); // mapc,mapr,maps
  header.writeFloatLE(mn, 76); header.writeFloatLE(mx, 80); header.writeFloatLE(mean, 84);
  header.writeInt32LE(0, 88);  // ispg
  header.writeInt32LE(0, 92);  // nsymbt
  header.writeFloatLE(0, 196); header.writeFloatLE(0, 200); header.writeFloatLE(0, 204); // ORIGIN
  header.write("MAP ", 208, "ascii");
  header[212] = 0x44; header[213] = 0x44; // machst little-endian
  header.writeFloatLE(rms, 216);
  header.writeInt32LE(1, 220); // nlabl

  const body = Buffer.from(voxels.buffer, voxels.byteOffset, voxels.byteLength);
  const fd = openSync(file, "w");
  try {
    writeSync(fd, header); writeSync(fd, body);
  } finally { closeSync(fd); }
  return { mn, mx, mean, rms, bytes: 1024 + voxels.byteLength };
}

// ---- browser ---------------------------------------------------------------
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const created = [];
mkdirSync(TMP, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const bigMapSrc = path.join(TMP, `bigmap_${N}.mrc`);

const pre = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (pre.jobs ?? []).length;

try {
  // ---- Phase A: demo truth -------------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 23, `roster identity 23 (got ${roster0})`);

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const embedSrc = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
  must(
    embedSrc.includes("fetch the raw map bytes through the (path-checked) outputs API"),
    "the embed's map bytes travel the path-checked outputs API (no direct fs URLs)"
  );
  must(embedSrc.includes("ParseCcp4") && embedSrc.includes("VolumeFromCcp4") && embedSrc.includes("VolumeRepresentation3D"),
    "the volume chain is RawData → ParseCcp4 → VolumeFromCcp4 → VolumeRepresentation3D");
  must(embedSrc.includes("Building isosurface…"), 'the 4-stage overlay names its last gate ("Building isosurface…")');
  must(embedSrc.includes('aria-label="Isosurface contour level in sigma"'), "the contour slider is a labelled contract");
  must(embedSrc.includes("const PRESETS = [1, 2, 3, 5];"), "contour presets stay [1, 2, 3, 5] — the test's preset speaks them");

  const fileRoute = readFileSync("src/app/api/jobs/[id]/outputs/file/route.ts", "utf8");
  must(
    fileRoute.includes("STREAMED, not readFileSync") && fileRoute.includes("700³"),
    "the raw route streams — the 1.4 GB OOM lesson is written where the fix lives"
  );

  const engineSrc = readFileSync("src/lib/relion/engine.ts", "utf8");
  must(
    engineSrc.includes("mapimport is for volumes"),
    "mapimport validates volumes-only (stacks refuse at the door)"
  );
  // t296 — the materialization doctrine: the mapimport's workdir copy must
  // be a HARDLINK (copy fallback), never an out-of-tree symlink — the file
  // routes' containment policy realpaths every fetch and an out-of-tree
  // symlink made every png/raw/histogram fetch answer 400 (found live by
  // this suite's first run: the identity card was honest, the viewer was
  // locked out — the exact gap nine windows of deferral were hiding).
  must(
    engineSrc.includes("linkSync(host, linked)"),
    "mapimport materializes the map with a HARDLINK (linkSync host → workdir)"
  );
  must(
    !engineSrc.includes("symlinkSync(host, linked)"),
    "no out-of-tree symlink at the mapimport site (the containment lockout is closed at the root)"
  );

  // ---- Phase C0: the big map is born ---------------------------------------
  console.log("== PHASE C0: generate the big map ==");
  const tGen = Date.now();
  const stats = writeBigMrc(bigMapSrc, N);
  const genMs = Date.now() - tGen;
  const sz = statSync(bigMapSrc).size;
  must(sz === stats.bytes, `the MRC on disk is exactly 1024 + n³·4 bytes (got ${sz}, expected ${stats.bytes})`);
  must(Math.abs(stats.rms) > 0 && stats.mx > stats.mn, `honest header stats: min ${stats.mn.toFixed(2)} / max ${stats.mx.toFixed(2)} / mean ${stats.mean.toFixed(4)} / σ ${stats.rms.toFixed(4)} (${genMs} ms to build)`);
  console.log(`  (map) ${N}³ float32 = ${(sz / 1024 / 1024).toFixed(1)} MB — 64× the voxels of the demo orthovol`);

  // ---- Phase C1: import → run → completed ----------------------------------
  console.log("== PHASE C1: mapimport walks the big map ==");
  const createRes = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "mapimport", name: "QA BigMap Import", params: { mapPath: bigMapSrc } }),
  });
  must([200, 201].includes(createRes.status), `the mapimport job is created (got ${createRes.status})`);
  const createdBody = await createRes.json();
  const importJob = createdBody.job ?? createdBody;
  created.push(importJob.id);
  must(!!importJob?.id && importJob.type === "mapimport", "the citizen is a mapimport");

  const runRes = await page.evaluate(async (id) => {
    const r = await fetch(`/api/jobs/${id}/run`, { method: "POST" });
    return r.status;
  }, importJob.id);
  must(runRes === 200, `the import run fires through the same-origin door (got ${runRes})`);
  let importDone = false;
  for (let i = 0; i < 60 && !importDone; i++) {
    await sleep(1000);
    const jobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
    importDone = jobs.find((j) => j.id === importJob.id)?.status === "completed";
  }
  must(importDone, "the import completes natively (64 MB link is still a link — fast)");
  const stAfter = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
  const refPath = stAfter[importJob.id]?.outputs?.model_mrc;
  must(!!refPath && existsSync(refPath), `the import declares model_mrc → ${path.basename(refPath ?? "")}`);
  must(statSync(refPath).size === stats.bytes, "the linked map is byte-identical in size (one copy on disk)");
  must(
    !lstatSync(refPath).isSymbolicLink(),
    "the workdir copy is a REAL file (hardlink), not an out-of-tree symlink — containment-compatible by construction"
  );

  // the exact request Mol* is about to make — API-direct, fast-fail with a
  // named error instead of a mystery error overlay inside the viewer
  {
    const mapName = path.basename(refPath);
    const tRaw = Date.now();
    const rres = await fetch(
      `${BASE}/api/jobs/${importJob.id}/outputs/file?path=${encodeURIComponent(mapName)}&format=raw`,
      { headers: SH }
    );
    const rawMs = Date.now() - tRaw;
    must(rres.status === 200, `raw serves the big map for Mol* (got ${rres.status}${rres.status !== 200 ? ` — ${(await rres.text()).slice(0, 120)}` : ""}) in ${rawMs} ms`);
    if (rres.status === 200) {
      const buf = await rres.arrayBuffer();
      must(buf.byteLength === stats.bytes, `raw streams the full ${stats.bytes} bytes (got ${buf.byteLength})`);
    }
  }

  // ---- Phase C2: identity card → View in 3D, TIMED --------------------------
  console.log("== PHASE C2: Mol* meets the big map (timed) ==");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator(`[data-job="${importJob.id}"]`).first().click({ force: true });
  await sleep(1500); // completed mapimport opens on Results by default
  const identityCard = page.locator('[data-canvas-ui="map-identity"]');
  must(await identityCard.isVisible().catch(() => false), "the mapimport's Results shows the identity card");
  const cardText = (await identityCard.innerText()) ?? "";
  must(cardText.includes(`${N} × ${N} × ${N} vox`), `the dims chip speaks the real grid (${N} × ${N} × ${N} vox)`);
  must(cardText.includes("σ "), "the identity card's σ chip rides the honest header rms (no scan)");

  const viewBtn = identityCard.locator('[data-testid="map-card-view-3d"]');
  must(await viewBtn.isVisible().catch(() => false), "the identity card's View in 3D button is there");

  const dlg = page.locator('[role="dialog"]').last();
  const t0 = Date.now();
  await viewBtn.click();
  await dlg.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  const canvasMs = Date.now() - t0;
  // the loading overlay span (aria-live) exists through all four stages and
  // unmounts with the overlay when the scene is committed
  const stageSpan = dlg.locator('span[aria-live="polite"]').first();
  await stageSpan.waitFor({ state: "visible", timeout: 5_000 }).catch(() => null);
  await stageSpan.waitFor({ state: "detached", timeout: 120_000 });
  const sceneMs = Date.now() - t0;
  must(true, `Mol* canvas mounted in ${canvasMs} ms — total fetch+parse+isosurface ${sceneMs} ms for ${N}³ (${(sz / 1024 / 1024).toFixed(0)} MB)`);
  must(sceneMs < 120_000, `the big map renders inside the 120 s verdict gate (took ${sceneMs} ms)`);
  must((await dlg.locator("text=3D viewer unavailable").count()) === 0, "no error overlay — the fallback slice was NOT needed");

  // ---- Phase C3: contour presets on 16.7M voxels ----------------------------
  console.log("== PHASE C3: contour on the big map ==");
  const preset5 = dlg.locator('[aria-label="Set contour to 5 sigma"]');
  must(await preset5.isVisible().catch(() => false), "the 5σ preset is on screen");
  if (await preset5.isVisible().catch(() => false)) {
    await preset5.click();
    await sleep(2500); // the commit is async (isoValue surgery, re-render)
    must((await dlg.locator("text=3D viewer unavailable").count()) === 0, "a 5σ contour commit on the big map does not crash the scene");
    await page.screenshot({ path: path.join(SHOTS, "t296-bigmap-viewer.png") });
    console.log("  (shot) t296-bigmap-viewer.png");
  }

  // ---- Phase C4: Esc closes -------------------------------------------------
  const dialogsBefore = await page.locator('[role="dialog"]').count();
  await page.keyboard.press("Escape");
  await sleep(800);
  must(
    (await page.locator('[role="dialog"]').count()) === dialogsBefore - 1,
    "Esc closes the shared Mol* dialog after the big-map session"
  );

  // ---- Phase C5: the histogram route on the big map --------------------------
  console.log("== PHASE C5: histogram route vs 64 MB ==");
  const mapName = path.basename(refPath);
  const hUrl = `${BASE}/api/jobs/${importJob.id}/outputs/file?path=${encodeURIComponent(mapName)}&format=histogram`;
  // same-origin headers — the file routes guard on browser-always-sent
  // headers; the first draft's bare Node fetch got 403 in 13 ms and the
  // "cold scan" was actually the guard's rejection (assertion's fault)
  const h0 = Date.now();
  const hres0 = await (await fetch(hUrl, { headers: SH })).json();
  const h0Ms = Date.now() - h0;
  must(Array.isArray(hres0.bins) && hres0.bins.length > 0, `histogram #1 serves real bins (${hres0.nTotal ?? "?"} voxels scanned) in ${h0Ms} ms`);
  must(hres0.nFinite === N * N * N, `the histogram counted the whole grid (nFinite ${hres0.nFinite} = ${N}³ — every voxel finite)`);
  const h1 = Date.now();
  const hres1 = await (await fetch(hUrl, { headers: SH })).json();
  const h1Ms = Date.now() - h1;
  must(
    h1Ms < h0Ms || h1Ms < 50,
    `histogram #2 is the LRU hit the doctrine promises (${h1Ms} ms vs ${h0Ms} ms) — the second look is free`
  );
} finally {
  // ---- cleanup: the big map dies with its citizen ---------------------------
  console.log("== cleanup ==");
  for (const id of created.reverse()) {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" });
  }
  rmSync(TMP, { recursive: true, force: true });
  const after = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
  must(after.length === 23, `roster restored to 23 (got ${after.length})`);
}

// ---- Phase D: console clean -------------------------------------------------
console.log("== PHASE D: console ==");
must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}: ${consoleErrors[0] ?? ""})`);

await browser.close();
console.log(fail === 0 ? "\nt296: ALL PASS" : `\nt296: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);

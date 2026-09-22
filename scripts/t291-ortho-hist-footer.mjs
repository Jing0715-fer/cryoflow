// t291 — THE FOOTER CARRIES THE DISTRIBUTION: the triptych export's
// footer grew a histogram. t280 taught the footer to NAME the contour
// ("iso 3.00 σ · focus …"); t291 makes the footer SHOW where that cut
// sits: the map's density distribution (the same format=histogram payload
// the live strip consumes — one server truth, now THREE consumers)
// drawn as a small log-scaled chart between the map name and the caption
// stats, with the σ ruler's quiet ticks and the contour's cyan cut line
// marked. A figure with its contour level AND its distribution — the
// reader sees at a glance that the cut lives in the particle tail, not
// in the noise peak.
//
// Honesty rules carried over from the live strip:
//   - a fetch that errs, times out (8s) or comes back malformed keeps
//     the one-line footer (absent is honest, guessed is a lie);
//   - the thumbnail shrinks to the span the caption texts leave and
//     skips entirely below 120px (a document layout never collides);
//   - the cut line fades when the contour lives off the visible range.
//
// Phases:
//   A  demo truth — homepage 200, roster 23
//   B  source ledger — the constants, the parallel fetch, the timeout
//      guard, the honest-absence branch, the shrink-then-skip guard,
//      the log-scaled bars, the σ ruler, the conditional cut, the caption
//   C  alive on the seeded 64³ world — C0 the histogram API speaks; C1
//      the export lands as a real PNG with the GROWN raster (1592×638 —
//      the footer band's own growth is visible in the file); C2 the
//      footer band is DECODED pixel-by-pixel (Node zlib): the slate bars
//      are on the canvas, the cyan cut line is a narrow vertical run in
//      the middle span, the raster grew by exactly the thumbnail's needs;
//      C3 the posed artifact (the triptych itself is the portrait)
//   Z  roster identity + console clean
//
// Run: node scripts/t291-ortho-hist-footer.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// t280's lesson: anything that races a render is POLLED, not read
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

// ---- a minimal PNG decoder (the triptych is RGBA 8-bit, non-interlaced;
// canvas output is predictable, but the decoder stays honest about what
// it refuses) ------------------------------------------------------------
function decodePng(buf) {
  let off = 8;
  let W = 0, H = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      W = data.readUInt32BE(0);
      H = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
    if (type === "IEND") break;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!bpp || bitDepth !== 8 || interlace !== 0)
    throw new Error(`unsupported png (depth ${bitDepth} color ${colorType} interlace ${interlace})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = W * bpp;
  const out = Buffer.alloc(H * stride);
  let p = 0;
  for (let y = 0; y < H; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= bpp && prev ? prev[x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { W, H, bpp, data: out };
}
const pxAt = (img, x, y) => {
  const i = (y * img.W + x) * img.bpp;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const near = (rgb, ref, tol) =>
  Math.abs(rgb[0] - ref[0]) <= tol && Math.abs(rgb[1] - ref[1]) <= tol && Math.abs(rgb[2] - ref[2]) <= tol;

console.log("== PHASE A: demo truth ==");
await fetch(`${BASE}/`).then((r) => must(r.status === 200, `homepage 200 (got ${r.status})`));
const roster = await (await fetch(`${BASE}/api/jobs`)).json();
must((roster.jobs ?? []).length === 23, `roster 23 (got ${(roster.jobs ?? []).length})`);

console.log("== PHASE B: source ledger ==");
const src = readFileSync("src/components/workflow/results/map-ortho-panel.tsx", "utf8");
must(src.includes("const EXPORT_FOOT_H = 64;"), "the footer band grew to 64 (the thumbnail's band)");
must(src.includes("const EXPORT_THUMB_W = 300;"), "the thumbnail has a fixed width (the grid owns the layout)");
must(src.includes("const EXPORT_THUMB_H = 40;"), "the thumbnail has a fixed height");
must(src.includes('EXPORT_BAR = "#64748b"'), "the bars wear the publishing slate");
must(src.includes('EXPORT_CUT = "#22d3ee"'), "the cut wears the strip's cyan");
must(src.includes("fetchHistForExport"), "the export fetches the map's histogram");
must(src.includes("format=histogram"), "the fetch speaks the strip's own endpoint (one server truth)");
must(src.includes("setTimeout(() => ac.abort(), 8000)"), "the fetch carries an 8s timeout (the export must not hang on it)");
must(src.includes("// aborted or failed — the footer stays honest by omission"), "honest absence: any failure keeps the one-line footer");
must(src.includes("Array.isArray(d.bins)"), "the payload is validated before it can be drawn");
must(src.includes("hist && thumbW >= 120"), "shrink-then-skip: no room for a legible chart means no chart");
must(src.includes("Math.log10(1 + maxC)"), "the bars are log-scaled (the strip's own visual language)");
must(src.includes("EXPORT_MEAN_TICK"), "the σ ruler's μ tick is drawn");
must(src.includes("hist.mean + isoSigma.sign * isoSigma.sigma * hist.std"), "the cut sits AT the contour (mean ± σ·std)");
must(src.includes('"density (log)"'), "the thumbnail carries its caption");
must(src.includes("ctx.measureText(base).width"), "the name is measured before anything is placed");
must(src.includes("ctx.measureText(f).width"), "the stats are measured before anything is placed");
must(src.includes("const [planeBitmaps, hist] = await Promise.all(["), "planes and histogram are fetched in ONE parallel breath");
must(src.includes("crosshair and density footer included"), "the export button's title admits the new cargo");

console.log("== PHASE C: alive on the seeded world ==");
// the volume world (t253/t280's recipe — idempotent, roster stays 23)
try {
  execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe", timeout: 120_000 });
  must(true, "the volume world is seeded (qa67-seed-volume)");
} catch (e) {
  must(false, `the volume world failed to seed: ${String(e).slice(0, 90)}`);
}
const jobsNow = await (await fetch(`${BASE}/api/jobs`)).json();
const host = (jobsNow.jobs ?? []).find((j) => j.name === "QA Refine3D");
must(!!host, "QA Refine3D in roster (the seeder's host)");

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

// C0 — the histogram API speaks for orthovol (the fetch the export makes)
const outputs = host
  ? await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`, { headers: SH, cache: "no-store" })).json()
  : null;
const vol = (outputs?.files ?? []).find((x) => (x.path || "").toLowerCase().endsWith(".mrc") && !(x.path || "").toLowerCase().endsWith(".mrcs"));
must(!!vol, "the host owns a volume output (orthovol)");
const histUrl = vol
  ? `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent(vol.path)}&format=histogram`
  : null;
const histApi = histUrl ? await (await fetch(histUrl, { headers: SH })).json() : null;
must(!!histApi && Array.isArray(histApi.bins) && histApi.bins.length === 256,
  `the histogram API serves 256 bins (got ${histApi?.bins?.length ?? "none"})`);
must(!!histApi && histApi.nTotal === 64 * 64 * 64,
  `the histogram speaks for the whole grid (nTotal ${histApi?.nTotal})`);

const browser = await chromium.launch();
const page = await browser.newPage({ acceptDownloads: true });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));

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

  // a deterministic contour: the 3σ preset (the cut lands in the right
  // tail — away from the noise peak, exactly where a figure wants it)
  const chip = page.locator('[data-canvas-ui="ortho-sigma-chip"]');
  await chip.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  must(await chip.isVisible().catch(() => false), "the σ chip is visible (the contour channel is alive)");
  await page.locator('button[aria-label="Set contour to 3 sigma"]').first().click();
  await sleep(700);
  must((await chip.textContent().catch(() => ""))?.trim() === "iso 3.00 σ",
    `the contour is parked at 3σ ("${(await chip.textContent().catch(() => "") ?? "").trim()}")`);

  // C1 — the export lands, with the GROWN raster: 14+34+512+14+64
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.locator('[data-canvas-ui="ortho-export"]').click(),
  ]);
  mkdirSync(SHOTS, { recursive: true });
  const pngPath = `${SHOTS}/t291-footer-thumb.png`;
  await download.saveAs(pngPath);
  const png = readFileSync(pngPath);
  must(png.length > 4 && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47,
    "the download is a real PNG (magic bytes)");
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  must(w === 1592, `the triptych width is unchanged (got ${w})`);
  must(h === 638, `the raster grew by the footer's growth (14+34+512+14+64, got ${h})`);
  const state = await pollUntil(async () => {
    const s = await page.locator('[data-canvas-ui="ortho-export"]').getAttribute("data-ortho-export-state");
    return s === "ok" || s === "idle" ? s : null;
  }, 8000);
  must(state === "ok" || state === "idle", `the export button reported success (state "${state}")`);

  // C2 — the footer band, decoded pixel-by-pixel (Node zlib, no deps):
  // the distribution is ON the canvas and the cut is a narrow line
  const img = decodePng(png);
  must(img.W === 1592 && img.H === 638, "the decoder agrees with the IHDR (1592×638 RGBA)");
  const BAR = [100, 116, 139]; // EXPORT_BAR #64748b
  const CUT = [34, 211, 238]; // EXPORT_CUT #22d3ee
  const y0 = img.H - 64; // the footer band
  let barCount = 0;
  const cyanPerCol = new Map();
  for (let y = y0; y < img.H; y++) {
    for (let x = 0; x < img.W; x++) {
      const rgb = pxAt(img, x, y);
      if (near(rgb, BAR, 22)) barCount++;
      if (near(rgb, CUT, 45)) cyanPerCol.set(x, (cyanPerCol.get(x) ?? 0) + 1);
    }
  }
  must(barCount >= 150, `the bars are on the canvas (${barCount} slate pixels in the footer band)`);
  const cyanCols = [...cyanPerCol.entries()].filter(([, n]) => n >= 15).map(([x]) => x).sort((a, b) => a - b);
  must(cyanCols.length >= 1 && cyanCols.length <= 10,
    `the cut line is a narrow vertical run (${cyanCols.length} cyan columns with ≥15 px)`);
  const cxMid = cyanCols.length ? cyanCols[Math.floor(cyanCols.length / 2)] : -1;
  must(cxMid > img.W * 0.25 && cxMid < img.W * 0.8,
    `the cut sits in the middle span, between name and stats (x≈${cxMid})`);

  // C3 — the artifact is the portrait: the triptych itself is saved
  must(png.length > 100_000, `the document has real weight (${Math.round(png.length / 1024)} KiB)`);
} finally {
  await browser.close();
}

console.log("== PHASE Z: the world as it was ==");
const rosterZ = await (await fetch(`${BASE}/api/jobs`)).json();
must((rosterZ.jobs ?? []).length === 23, `roster 23 after the dance (got ${(rosterZ.jobs ?? []).length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 120)}` : ""})`);

console.log(fail === 0 ? "t291: ALL PASS" : `t291: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

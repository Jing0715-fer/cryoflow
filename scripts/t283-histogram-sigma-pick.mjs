// t283 — the DENSITY HISTOGRAM: the volume's whole density distribution
// as an interactive strip under the ortho tiles. The classic instrument
// behind every "where should the contour cut?" decision — RELION's
// _display, IMOD and ChimeraX all show the histogram — now with a σ
// ruler, the current contour as a cyan cut line, and CLICK-TO-SET-σ:
// the density under the cursor BECOMES the contour.
//
// Server side: `format=histogram` on the outputs/file route — the SAME
// containment chain as png/raw/text/value, but the payload is the
// distribution: readMrcHistogram walks the file in chunks, TWICE (pass 1
// min/max/mean/σ accumulators, pass 2 binning over the known range) with
// O(1) memory, and caches per (path, mtime, size) — panel-open
// frequency, not hover frequency.
//
// Client side: the strip draws log-scaled bars (cryo-EM histograms are a
// noise spike with particle tails — linear y flattens everything else),
// σ ticks the stats actually span, and an honest off-scale arrowhead
// when the threshold lives beyond [min, max]. Clicking dispatches
// ORTHO_SIGMA_SET — the SET channel that completes the σ family (STATE
// echoes 3D→2D, REQUEST pulls 2D→3D, SET commands 2D→3D); the sign
// follows the clicked side of the mean (picking a NEGATIVE contour from
// the histogram is the inverted-contrast door, one click away).
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — the chunked two-pass reader (O(1) memory, cache
//      key mtime+size, LRU cap, non-finite skip), the route branch (same
//      containment chain, refusals), the strip (log bars, σ ruler, cut
//      line, off-scale honesty, stats hooks), the SET channel (embed
//      listener, slider clamp [0.05, 10])
//   C  alive on the seeded 64³ world — C1 the API speaks the whole
//      distribution (nTotal 262144 = the grid, Σbins = nFinite, finite
//      stats); C2 the cache (second fetch, bit-identical payload); C3
//      the domain wall (.star refuses); C4 the centre probe lands INSIDE
//      [min,max] (the probe and the histogram read one file); C5 the UI:
//      toggle → strip → ready, stats hooks speak μ/σ/lo/hi; C6
//      CLICK-TO-SET: clicking mean+3σ turns the chip into "iso 3.00 σ"
//      (the loop closure, witnessed); C7 the negative side: mean−1.5σ
//      flips the sign ("iso -1.50 σ" — the inversion door); C8 the far
//      edge clamps honestly (iso 10.00 σ); C9 the posed screenshot
//   Z  roster identity + console clean
//
// Run: node scripts/t283-histogram-sigma-pick.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";

let fail = 0;
// declared at the top level — the Z phase reads it no matter where C ended
const consoleErrors = [];
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// t280's lesson (2/5 runs read "busy" before the React commit) lives on:
// anything that races a render is POLLED, not read atomically.
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

// same-origin headers the guarded routes demand (the SH discipline)
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "User-Agent": "Mozilla/5.0",
};

console.log("== PHASE A: demo truth ==");
const home = await fetch(`${BASE}/`, { headers: SH });
must(home.status === 200, `homepage 200 (got ${home.status})`);
const jobs0 = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobs0.jobs ?? []).length === 21, `roster 21 at the start (got ${(jobs0.jobs ?? []).length})`);

console.log("== PHASE B: source ledger ==");
const mrcSrc = await import("node:fs").then((fs) => fs.readFileSync("src/lib/mrc.ts", "utf8"));
must(mrcSrc.includes("export function readMrcHistogram"), "mrc.ts grows readMrcHistogram (the whole-volume distribution)");
must(mrcSrc.includes("HIST_CHUNK_VOXELS = 1 << 18"), "the reader walks the file in ~1 MB chunks (memory stays flat)");
must(mrcSrc.includes("sumsq += v * v"), "pass 1 accumulates mean/σ while it finds [min,max]");
must(mrcSrc.includes("Math.trunc((v - min) * scale)"), "pass 2 bins over the now-known range");
must(mrcSrc.includes("if (!Number.isFinite(v)) continue;"), "NaN/Inf voxels skip the stats and the bins (honest nFinite)");
must(mrcSrc.includes("st.mtimeMs"), "the cache key carries mtime (a re-rendered map is a new histogram)");
must(mrcSrc.includes("HIST_CACHE_MAX = 8"), "the cache is LRU-capped (maps come and go)");
must(mrcSrc.includes("if (b >= HIST_BINS) b = HIST_BINS - 1"), "v === max lands in the last bin (no droppable voxel)");

const routeSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/app/api/jobs/[id]/outputs/file/route.ts", "utf8")
);
must(routeSrc.includes('format === "histogram"'), "the route grows the format=histogram branch");
must(routeSrc.includes("The density histogram is for MRC maps only"), "non-MRC files refuse the histogram");
must(routeSrc.includes("Stacks histogram per slice — pass &slice=N"), ".mrcs stacks histogram PER SLICE (t287: an unnamed stack is a blur with no subject — the refusal says how to comply)");
must(routeSrc.includes("readMrcHistogram(abs, slice)"), "the branch runs AFTER the containment chain resolves abs (t287: the slice rides along)");
must(routeSrc.includes("isLocalRequest(request)"), "the route sits BEHIND the local-request guard");

const orthoSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/components/workflow/results/map-ortho-panel.tsx", "utf8")
);
// t284 moved the strip's code to density-histogram.tsx (ONE drawing
// truth, two consumers) — the DRAWING assertions follow the code there;
// the panel keeps the toggle, the uiPrefix and the σ dispatch.
const histSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/components/workflow/results/density-histogram.tsx", "utf8")
);
must(orthoSrc.includes('ORTHO_SIGMA_SET_EVENT = "cryoflow:ortho-sigma-set"'), "the SET event completes the σ family (STATE/REQUEST/SET)");
must(histSrc.includes("Math.log10(1 + c)"), "bars are LOG-scaled (a noise spike must not flatten the tails)");
must(histSrc.includes("HIST_SIGMA_TICKS = [-3, -2, -1, 0, 1, 2, 3]"), "the σ ruler marks ±1/2/3σ");
must(histSrc.includes("data.mean + cutSigma.sign * cutSigma.sigma * data.std"), "the cut line resolves the contour against the SAME stats");
must(histSrc.includes("arrowhead"), "an off-scale threshold is drawn honestly (a faded arrowhead at the edge)");
must(histSrc.includes("resolvedTheme === \"dark\""), "the strip repaints with the theme (an instrument readable in both)");
must(orthoSrc.includes('uiPrefix="ortho-hist"') && histSrc.includes("data-canvas-ui={uiPrefix}"), "the strip carries its test hook (panel passes the prefix)");
must(orthoSrc.includes('data-canvas-ui="ortho-hist-toggle"'), "the toggle carries its hook (sibling of export, never nested)");
must(histSrc.includes("data-canvas-ui={`${uiPrefix}-stats`}"), "the stats row carries its hook (prefix-composed)");
must(histSrc.includes('data-hist-state={state}'), "the strip speaks its machine state (loading/ready/err)");
must(orthoSrc.includes("ORTHO_SIGMA_SET_EVENT, { detail: { sigma, sign } }"), "a click dispatches the SET (density → σ)");
must(histSrc.includes("raw < 0 ? -1 : 1"), "the sign follows the clicked side of the mean (the inversion door)");
must(histSrc.includes("Math.min(10, Math.max(0.05, Math.abs(raw)))"), "the picked σ clamps to the slider's own bounds");
must(orthoSrc.includes("onPickSigma={(sigma, sign)"), "the panel wires the pick to the σ dispatch");

const embedSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8")
);
must(embedSrc.includes("ORTHO_SIGMA_SET_EVENT"), "the embed listens for the SET");
must(embedSrc.includes("const s = Math.min(10, Math.max(0.05, d.sigma));"), "the embed applies the same clamp the slider's restore path speaks");
must(embedSrc.includes("if (signRef.current !== sg) setSign(sg);"), "the SET flips the sign when the pick demands it");

console.log("== PHASE C: the histogram, alive ==");
// the volume world (t253/t278/t281's recipe — idempotent, roster stays 21)
try {
  execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe", timeout: 120_000 });
  must(true, "the volume world is seeded (qa67-seed-volume)");
} catch (e) {
  must(false, `the volume world failed to seed: ${String(e).slice(0, 90)}`);
}
const jobsNow = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
const host = (jobsNow.jobs ?? []).find((j) => j.name === "QA Refine3D");
must(!!host, "QA Refine3D in roster (the seeder's host)");
if (host) {
  const histUrl = `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("orthovol.mrc")}&format=histogram`;
  const shFetch = (u) => fetch(u, { headers: SH });

  // C1 — the API speaks the whole distribution
  const c1 = await shFetch(histUrl);
  must(c1.status === 200, `the histogram answers 200 (got ${c1.status})`);
  const c1d = await c1.json().catch(() => null);
  must(c1d && c1d.nTotal === 64 * 64 * 64, `nTotal is the whole 64³ grid (got ${c1d && c1d.nTotal})`);
  must(c1d && Array.isArray(c1d.bins) && c1d.bins.length === 256, `256 bins (got ${c1d && c1d.bins && c1d.bins.length})`);
  const binSum = c1d && Array.isArray(c1d.bins) ? c1d.bins.reduce((a, b) => a + b, 0) : -1;
  must(binSum === (c1d && c1d.nFinite), `Σbins = nFinite (got Σ${binSum} vs ${c1d && c1d.nFinite}) — every finite voxel is binned exactly once`);
  must(c1d && Number.isFinite(c1d.min) && Number.isFinite(c1d.max) && c1d.max > c1d.min, "min/max are finite and ordered");
  must(c1d && c1d.mean > c1d.min && c1d.mean < c1d.max && c1d.std > 0, "μ inside [min,max], σ > 0");
  must(c1d && c1d.jobId === host.id && c1d.file === "orthovol.mrc", "the receipt names the job and the file");

  // C2 — the cache: a second fetch returns the BIT-IDENTICAL payload
  const c2d = await (await shFetch(histUrl)).json().catch(() => null);
  must(!!c2d && JSON.stringify(c2d) === JSON.stringify(c1d), "the second fetch is the cached payload (bit-identical)");

  // C3 — the domain wall
  const c3 = await shFetch(
    `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("no-such-file.star")}&format=histogram`
  );
  must(c3.status >= 400 && c3.status < 500, `a .star path refuses the histogram (got ${c3.status})`);

  // C4 — the probe and the histogram read ONE file: the centre voxel's
  // value (t281's instrument) must fall inside the histogram's [min,max]
  // and inside [mean−10σ, mean+10σ] (a genuine voxel is never an outlier
  // beyond the ruler's end on this map)
  const c4d = await (
    await shFetch(`${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("orthovol.mrc")}&format=value&axis=z&pos=0.5&fx=0.5&fy=0.5`)
  ).json().catch(() => null);
  must(c4d && typeof c4d.value === "number",
    `the centre probe speaks (got ${c4d && c4d.value})`);
  must(c4d && c1d && c4d.value >= c1d.min && c4d.value <= c1d.max,
    `the probe's voxel lives inside the histogram's range (${c4d && c4d.value} ∈ [${c1d && c1d.min.toFixed(4)}, ${c1d && c1d.max.toFixed(4)}])`);

  // C5 — the UI: toggle → strip → ready, stats hooks speak
  const browser = await chromium.launch();
  const page = await browser.newPage();
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
      if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) {
        viewerUp = true;
        break;
      }
    }
    must(viewerUp, "Mol* viewer live");

    // expand the ortho strip (default collapsed)
    const stripBtn = page.locator('button[aria-expanded]', { hasText: "Orthogonal slices" }).first();
    if ((await stripBtn.getAttribute("aria-expanded").catch(() => null)) === "false") {
      await stripBtn.click();
      await sleep(400);
    }
    must((await stripBtn.getAttribute("aria-expanded")) === "true", "the ortho strip is expanded");

    // toggle the histogram on
    const histToggle = page.locator('[data-canvas-ui="ortho-hist-toggle"]');
    must(await histToggle.isVisible().catch(() => false), "the histogram toggle is visible (sibling of the export button)");
    must((await histToggle.getAttribute("aria-pressed")) === "false", "the strip starts OFF (the first look is an explicit ask)");
    await histToggle.click();
    const histReady = await pollUntil(async () => {
      const strip = page.locator('[data-canvas-ui="ortho-hist"]');
      if (!(await strip.isVisible().catch(() => false))) return null;
      const st = await strip.getAttribute("data-hist-state");
      return st === "ready" ? st : null;
    }, 12000);
    must(histReady === "ready", `the strip reaches ready (got ${histReady})`);

    // the stats hooks — the numbers the click math will be built on
    const stats = page.locator('[data-canvas-ui="ortho-hist-stats"]');
    const mean = Number(await stats.getAttribute("data-hist-mean"));
    const std = Number(await stats.getAttribute("data-hist-std"));
    const lo = Number(await stats.getAttribute("data-hist-lo"));
    const hi = Number(await stats.getAttribute("data-hist-hi"));
    const nStr = await stats.getAttribute("data-hist-n");
    must(Number.isFinite(mean) && Number.isFinite(std) && std > 0, `the stats hooks speak μ/σ (μ=${mean.toFixed(4)}, σ=${std.toFixed(4)})`);
    must(Number.isFinite(lo) && Number.isFinite(hi) && hi > lo, `the range hooks speak [lo,hi] (${lo.toFixed(3)}, ${hi.toFixed(3)})`);
    must(nStr === "262144", `the n hook is the whole grid (got ${nStr})`);
    must((await stats.getAttribute("data-hist-mean")) === (c1d ? c1d.mean.toFixed(6) : null),
      "the UI's μ is the API's μ (one server truth, two consumers)");

    // the chip before the dance: the default contour
    const chip = page.locator('[data-canvas-ui="ortho-sigma-chip"]');
    const chipBefore = await chip.textContent().catch(() => null);
    must(!!chipBefore && /iso .* σ/.test(chipBefore), `the σ chip is alive before the dance ("${(chipBefore ?? "").trim()}")`);

    const canvas = page.locator('[data-canvas-ui="ortho-hist"] canvas');
    await canvas.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(400);
    const box = await canvas.boundingBox();
    must(!!box && box.width > 100, `the histogram canvas is visible (got ${box && `${Math.round(box.width)}px`})`);

    // the click→σ math mirrors the panel's own: pads 6/6, x maps [lo,hi]
    const PAD_L = 6;
    const PAD_R = 6;
    const xForValue = (v, b) =>
      b.x + PAD_L + ((v - lo) / (hi - lo)) * (b.width - PAD_L - PAD_R);

    if (box) {
      const clickAt = async (v) => {
        const b2 = await canvas.boundingBox(); // re-read — scroll may move it
        const x = xForValue(v, b2);
        const y = b2.y + b2.height / 2;
        await page.mouse.click(x, y);
        return x;
      };
      const chipSigma = async () => {
        const t = await pollUntil(async () => {
          const txt = await chip.textContent().catch(() => null);
          const m = txt && txt.match(/iso (-?)([\d.]+) σ/);
          return m ? Number(m[2]) * (m[1] ? -1 : 1) : null;
        }, 6000);
        return t;
      };

      // C6 — CLICK-TO-SET at mean+3σ (fall back inward if the ruler ends
      // first): the chip must echo the clicked σ — the loop closure
      const sPos = [3, 2, 1].find((s) => mean + s * std <= hi) ?? null;
      must(sPos !== null, "a positive σ target fits inside [lo,hi]");
      if (sPos !== null) {
        await clickAt(mean + sPos * std);
        const got = await chipSigma();
        must(got !== null && Math.abs(got - sPos) <= 0.3,
          `CLICK-TO-SET: the chip echoes the clicked contour (clicked ${sPos}σ, chip ${got}) — the loop closes`);
        must(got !== null && got > 0, "the positive side keeps the positive sign");
      }

      // C7 — the negative side: the SIGN FOLLOWS THE PICK. The seeded
      // map's noise floor is 0 (min ≥ 0, no negative tail), so a negative
      // CLICK is unreachable on this world — the suite says so honestly
      // and witnesses the sign flip one level down instead: a direct
      // ORTHO_SIGMA_SET with sign −1 (the embed's flip branch, alive).
      // The click→sign bridge itself lives in the ledger (raw < 0 ? -1 : 1).
      const negReachable = mean - 1.5 * std >= lo || mean - std >= lo;
      if (negReachable) {
        const sNeg = [1.5, 1].find((s) => mean - s * std >= lo);
        await clickAt(mean - sNeg * std);
        const got = await chipSigma();
        must(got !== null && Math.abs(got + sNeg) <= 0.3,
          `the SIGN FOLLOWS THE CLICKED SIDE: clicked ${-sNeg}σ, chip ${got}`);
      } else {
        must(c1d && c1d.min >= 0,
          `the seeded map has no negative tail (min ${c1d && c1d.min.toFixed(4)} ≥ 0) — the negative CLICK is honestly unreachable here`);
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent("cryoflow:ortho-sigma-set", { detail: { sigma: 1.5, sign: -1 } }));
        });
        const gotNeg = await chipSigma();
        must(gotNeg !== null && Math.abs(gotNeg + 1.5) <= 0.05,
          `the SET channel flips the sign ALIVE: SET −1.5σ, chip ${gotNeg} (the inversion door, witnessed)`);
      }

      // C8 — the far right edge clamps honestly: σ = (hi−μ)/σ or the 10
      // ceiling, whichever the slider's bounds speak first
      const b3 = await canvas.boundingBox();
      await page.mouse.click(b3.x + b3.width - 2, b3.y + b3.height / 2);
      const edgeExpected = Math.min(10, Math.max(0.05, (hi - mean) / std));
      const gotEdge = await chipSigma();
      must(gotEdge !== null && Math.abs(gotEdge - edgeExpected) <= 0.3,
        `the far edge clamps honestly (expected ≤ ${edgeExpected.toFixed(2)}, chip ${gotEdge})`);

      // C9 — the posed screenshot (strip + chip + tiles in one frame)
      await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5, { steps: 3 });
      await sleep(400);
      mkdirSync(SHOTS, { recursive: true });
      await canvas.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(400);
      await page.screenshot({ path: `${SHOTS}/t283-histogram-strip.png` });
    }
  } finally {
    try { await browser.close().catch(() => {}); } catch { /* gone */ }
  }
}

console.log("== PHASE Z: the world as it was ==");
const jobsEnd = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobsEnd.jobs ?? []).length === 21, `roster 21 after the dance (got ${(jobsEnd.jobs ?? []).length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0]?.slice(0, 90)}` : ""})`);

console.log(fail === 0 ? "\nt283: ALL PASS" : `\nt283: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

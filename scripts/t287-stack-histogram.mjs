// t287 — THE STACK SPEAKS: t283 gave volumes a histogram (where does the
// density live), t284 carried it into the quick look, t286 let the
// histogram COMMAND the display — but the .mrcs stack branch stayed mute
// (a montage and a caption; the route refused stacks outright). Yet the
// FIRST question a stack begs is per-image: "is THIS particle even
// usable?" — and that is answered by THAT image's distribution, not the
// stack-wide blur of thousands of them.
//
// t287 closes the family's fourth chapter:
//   server: readMrcHistogram accepts a slice (one z section — for a
//     .mrcs that is one particle image; the chunked two-pass read with
//     O(1) memory narrows its scope, the cache keys by slice); the route
//     REQUIRES slice for stacks (an un-named stack histogram would be
//     exactly that blur — a number with no subject) and REFUSES slice
//     for volumes (a volume's histogram is the whole grid — silently
//     ignoring the parameter would be a lie); the payload echoes the
//     slice it spoke.
//   client: the stack dialog grows a slice cursor (prev/next + a range
//     slider + a readout) driving ONE slice view and the SAME histogram
//     instrument — slice rides the fetch deps, the toggle survives the
//     step (the reader's intent does), and the display WINDOW resets
//     (a different image is a different distribution — the old lo/hi
//     pair would be a stale command over new pixels).
// The evidence stack is DETERMINISTIC: 4 sections × 32×32, section s
// carries v = s·10 + ((x+y) % 4)·0.5 — four values, each exactly 256
// times (32 % 4 == 0), so μ_s = s·10 + 0.75 and σ = √0.3125 are
// arithmetic, not sampling.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — the slice in the reader (offset, cache key), the
//      route's stack/volume slice policy (require + refuse + echo), the
//      strip's slice prop riding the fetch deps, the dialog's cursor
//      hooks + slice-view URL + window reset on step
//   C  alive — C1 the API: per-slice histograms match ARITHMETIC
//      (μ_0 0.75 … μ_3 30.75), the slice echo, the honest 400s (missing /
//      negative / out-of-range-with-the-real-nz / fractional / volume+slice);
//      C2 the dialog: cursor steps, the slice view follows, the histogram
//      μ follows, the toggle survives the step, ±1σ windows the slice
//      view, stepping CLEARS the window; C3 reopening resets the cursor
//   Z  roster identity + console clean
//
// Run: node scripts/t287-stack-histogram.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";

let fail = 0;
const consoleErrors = [];
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// t280's lesson lives on: anything that races a render is POLLED, not read
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
const mrcSrc = readFileSync("src/lib/mrc.ts", "utf8");
must(
  mrcSrc.includes("export function readMrcHistogram(file: string, slice?: number)"),
  "the reader accepts a slice (one z section — for a stack, one particle image)"
);
must(
  mrcSrc.includes("sliceOffset = s * h.nx * h.ny") && mrcSrc.includes("count = h.nx * h.ny"),
  "the slice narrows the read's scope (offset + one plane of voxels)"
);
must(
  mrcSrc.includes("if (s < 0 || s >= h.nz) return null;"),
  "an out-of-range slice returns null (the route turns it into an actionable 400)"
);
must(
  mrcSrc.includes('s${slice === undefined ? "all" : Math.trunc(slice)}'),
  "the cache keys by slice (a per-image histogram is not the whole-grid one)"
);
must(
  mrcSrc.includes("for a .mrcs stack that is one particle IMAGE"),
  "the per-image semantics are documented WHERE the slice resolves"
);

const routeSrc = readFileSync("src/app/api/jobs/[id]/outputs/file/route.ts", "utf8");
must(
  routeSrc.includes("Stacks histogram per slice — pass &slice=N"),
  "the route REQUIRES a slice for stacks (an unnamed one is a blur with no subject)"
);
must(
  routeSrc.includes("slice out of range — this stack holds"),
  "an out-of-range slice 400s WITH the real nz (actionable, not generic)"
);
must(
  routeSrc.includes("slice is for stacks — a volume's histogram is the whole grid"),
  "a VOLUME with a slice is refused (silently ignoring a parameter is a lie)"
);
must(
  routeSrc.includes("!Number.isFinite(s) || !Number.isInteger(s)"),
  "a fractional slice is refused (an index is an integer)"
);
must(
  routeSrc.includes("readMrcHistogram(abs, slice)"),
  "the route threads the slice into the reader"
);
must(
  routeSrc.includes("slice: slice ?? null"),
  "the payload echoes the slice it spoke (one payload, one truth)"
);

const sharedSrc = readFileSync("src/components/workflow/results/density-histogram.tsx", "utf8");
must(
  (sharedSrc.match(/slice\?: number/g) ?? []).length === 2,
  "both the strip and the dialog section accept a slice (2 props)"
);
must(
  sharedSrc.includes("(slice !== undefined ? `&slice=${slice}` : \"\")"),
  "the fetch carries &slice= only when a slice is spoken"
);
must(
  sharedSrc.includes("[jobId, path, slice]"),
  "slice rides the fetch deps (stepping a stack re-asks the same instrument)"
);
must(
  sharedSrc.includes("slice ${slice + 1}'s density distribution"),
  "the toggle row names the slice it is speaking (no silent scope)"
);

const rvSrc = readFileSync("src/components/workflow/results/results-view.tsx", "utf8");
must(rvSrc.includes("const [stackSlice, setStackSlice] = useState(0)"), "the dialog holds a slice cursor (0-based)");
must(
  rvSrc.includes('data-canvas-ui="stack-slice-prev"') &&
    rvSrc.includes('data-canvas-ui="stack-slice-next"') &&
    rvSrc.includes('data-canvas-ui="stack-slice-range"') &&
    rvSrc.includes('data-canvas-ui="stack-slice-readout"'),
  "the cursor's four controls are machine-findable (prev/next/range/readout)"
);
must(
  rvSrc.includes("`&format=png&montage=0&scale=large&slice=${stackSlice}`"),
  "the single view renders the CURSOR's slice (montage=0 — the overview stays separate)"
);
must(
  rvSrc.includes("slice={stackSlice}"),
  "the histogram speaks the cursor's slice too (one cursor, two consumers)"
);
must(
  rvSrc.includes("[imgPath, stackSlice]"),
  "stepping the slice resets the display window (a different image is a different distribution)"
);
must(
  rvSrc.includes("disabled={stackSlice <= 0}") &&
    rvSrc.includes("disabled={stackSlice >= (imageFile.slices ?? 1) - 1}"),
  "the cursor cannot leave the stack (prev/next clamp at the ends)"
);
must(
  rvSrc.includes("montageWin && imgWindow"),
  "the montage overview follows the window only via the explicit toggle (t288 — the auto-overview contract holds BY DEFAULT, the toggle is the exception)"
);
must(
  rvSrc.includes("Particle image {stackSlice + 1}"),
  "the slice view names what it shows (1-based to the human, 0-based to the server)"
);

console.log("== PHASE C: the stack speaks, alive ==");
// the volume world (t283's recipe — idempotent, roster stays 21)
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
  const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
  const wd = state[host.id]?.workdir;
  must(!!wd, "the host's workdir is registered in engine-state");
  if (wd) {
    // the standing world is ACCOUNTED FOR by t212 (the host owns FOUR
    // volumes). t287stack is C-phase EVIDENCE, not a resident: rm first
    // (a crashed earlier run must not poison the world), rm again in the
    // finally — the world returns as it was found.
    rmSync(`${wd}/t287stack.mrcs`, { force: true });
    try {
      // C0 — the DETERMINISTIC stack: 4 sections × 32×32 float32,
      // section s carries v = s·10 + ((x + y) % 4)·0.5. (x+y) % 4 is
      // uniform because 32 % 4 == 0, so each of the four values appears
      // exactly 256 times per section: μ_s = s·10 + 0.75, σ = √0.3125.
      const N = 32, NZ = 4;
      const vals = new Float32Array(N * N * NZ);
      for (let z = 0; z < NZ; z++)
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++)
            vals[(z * N + y) * N + x] = z * 10 + ((x + y) % 4) * 0.5;
      const head = Buffer.alloc(1024);
      head.writeInt32LE(N, 0); head.writeInt32LE(N, 4); head.writeInt32LE(NZ, 8);
      head.writeInt32LE(2, 12); // mode float32
      head.writeInt32LE(N, 28); head.writeInt32LE(N, 32); head.writeInt32LE(NZ, 36);
      head.writeFloatLE(1.0, 40); head.writeFloatLE(1.0, 44); head.writeFloatLE(1.0, 48);
      head.writeInt32LE(1, 64); head.writeInt32LE(2, 68); head.writeInt32LE(3, 72);
      head.writeFloatLE(0, 76); head.writeFloatLE(31.5, 80); head.writeFloatLE(15.75, 84);
      head.writeInt32LE(0, 88); // ispg 0 — an image stack
      head.writeInt32LE(0, 92);
      head.write("MAP ", 208, "ascii");
      head.writeInt32LE(16777214, 212);
      writeFileSync(`${wd}/t287stack.mrcs`, Buffer.concat([head, Buffer.from(vals.buffer)]));
      must(true, "t287stack.mrcs written (4×32×32, four sections at μ 0.75/10.75/20.75/30.75)");

      const fileUrl = (q) =>
        `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("t287stack.mrcs")}&${q}`;

      // C1 — per-slice histograms ARE arithmetic
      const MU = [0.75, 10.75, 20.75, 30.75];
      const c1 = await fetch(fileUrl("format=histogram&slice=0"), { headers: SH });
      must(c1.status === 200, `slice 0's histogram answers 200 (got ${c1.status})`);
      const c1d = await c1.json().catch(() => null);
      must(!!c1d && c1d.nTotal === N * N, `nTotal is ONE 32×32 image (got ${c1d && c1d.nTotal})`);
      must(!!c1d && Math.abs(c1d.mean - MU[0]) < 1e-4, `slice 0's μ is 0.75 by arithmetic (got ${c1d && c1d.mean})`);
      must(!!c1d && Math.abs(c1d.std - Math.sqrt(0.3125)) < 1e-4, `slice 0's σ is √0.3125 ≈ 0.559 (got ${c1d && c1d.std})`);
      must(!!c1d && c1d.slice === 0, "the payload echoes the slice it spoke");
      const c1b = await fetch(fileUrl("format=histogram&slice=3"), { headers: SH }).then((r) => r.json()).catch(() => null);
      must(!!c1b && Math.abs(c1b.mean - MU[3]) < 1e-4, `slice 3's μ is 30.75 by arithmetic (got ${c1b && c1b.mean})`);
      must(!!c1b && c1b.slice === 3 && c1b.mean !== c1d.mean, "each image speaks its OWN distribution (not the stack blur)");

      // the honest 400s
      const noSlice = await fetch(fileUrl("format=histogram"), { headers: SH });
      must(noSlice.status === 400, `a stack without a slice is refused (got ${noSlice.status})`);
      must((await noSlice.json().catch(() => null))?.error?.includes("pass &slice=N"), "the refusal says HOW to comply");
      const negSlice = await fetch(fileUrl("format=histogram&slice=-1"), { headers: SH });
      must(negSlice.status === 400, `a negative slice is refused (got ${negSlice.status})`);
      const bigSlice = await fetch(fileUrl("format=histogram&slice=4"), { headers: SH });
      must(bigSlice.status === 400, `slice 4 of 4 is refused (got ${bigSlice.status})`);
      must(
        (await bigSlice.json().catch(() => null))?.error?.includes("holds 4 images"),
        "the out-of-range refusal names the real nz (holds 4 images)"
      );
      const fracSlice = await fetch(fileUrl("format=histogram&slice=1.5"), { headers: SH });
      must(fracSlice.status === 400, `a fractional slice is refused (got ${fracSlice.status})`);
      const volSlice = await fetch(
        `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("orthovol.mrc")}&format=histogram&slice=1`,
        { headers: SH }
      );
      must(volSlice.status === 400, `a volume with a slice is refused (got ${volSlice.status})`);
      must(
        (await volSlice.json().catch(() => null))?.error?.includes("a volume's histogram is the whole grid"),
        "the volume refusal keeps the whole-grid semantics"
      );

      // C2 — the dialog, alive: cursor → view → histogram → window
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

        // gallery labels: friendlyLabel gives a .mrcs at the workdir root
        // "Stack <name>" — match by the file's stem, robust to the label form
        const tile = page.locator('button[aria-label*="t287stack"]').first();
        if (!(await tile.isVisible().catch(() => false))) {
          must(false, 'the stack tile "Enlarge t287stack" is visible');
        } else {
          must(true, "the stack tile is visible in the maps gallery");
          await tile.click();
          await sleep(1000);
        }
        const readout = page.locator('[data-canvas-ui="stack-slice-readout"]');
        must(
          await page.getByText("Stack of 4 particle images").first().isVisible().catch(() => false),
          "the dialog opens on the stack (montage overview + caption)"
        );
        must((await readout.textContent())?.trim() === "slice 1 of 4", `the cursor starts at slice 1 of 4 (got ${(await readout.textContent())?.trim()})`);
        must(
          await page.locator('[data-canvas-ui="stack-slice-prev"]').isDisabled().catch(() => true),
          "prev is disabled at the first image (the cursor cannot leave the stack)"
        );
        const sliceImg = () => page.locator('img[alt*="particle image"]').first();
        let s0 = await sliceImg().getAttribute("src");
        must(!!s0 && s0.includes("slice=0"), "the single view renders slice 0 (0-based to the server)");

        // step NEXT → slice 2 of 4; the view follows; the window is not yet born
        await page.locator('[data-canvas-ui="stack-slice-next"]').click();
        await sleep(600);
        must((await readout.textContent())?.trim() === "slice 2 of 4", `next steps to slice 2 of 4 (got ${(await readout.textContent())?.trim()})`);
        const s1 = await pollUntil(async () => {
          const s = await sliceImg().getAttribute("src");
          return s && s.includes("slice=1") ? s : null;
        }, 8000);
        must(!!s1, "the single view followed the cursor (slice=1 in the URL)");

        // the histogram speaks the CURSOR's slice — μ must be 10.75
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').scrollIntoViewIfNeeded().catch(() => {});
        await sleep(350);
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').click();
        const st1 = await pollUntil(async () => {
          const strip = page.locator('[data-canvas-ui="quick-hist"]');
          if (!(await strip.isVisible().catch(() => false))) return null;
          const st = await strip.getAttribute("data-hist-state");
          return st === "ready" ? st : null;
        }, 12000);
        must(st1 === "ready", `the strip reaches ready (got ${st1})`);
        const muTxt = await page.locator('[data-canvas-ui="quick-hist-stats"]').textContent();
        must(!!muTxt && muTxt.includes("10.75"), `the histogram's μ is slice 2's 10.75 (stats: ${muTxt?.slice(0, 40)}…)`);

        // the toggle row names the slice it is speaking
        must(
          await page.getByText("slice 2's density distribution").first().isVisible().catch(() => false),
          "the toggle row says WHICH slice's distribution it is"
        );

        // ±1σ presets the window — the SLICE VIEW answers (one window, the
        // slice's own pixels)
        const winRow = () => page.locator('[data-canvas-ui="quick-hist-win"]');
        await winRow().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(300);
        await page.locator('[data-win-preset="1"]').first().click();
        const custom = await pollUntil(async () => {
          const s = await winRow().getAttribute("data-win-state");
          return s === "custom" ? s : null;
        }, 8000);
        must(custom === "custom", "±1σ sets the window (state hook: custom)");
        const s2 = await pollUntil(async () => {
          const s = await sliceImg().getAttribute("src");
          return s && s.includes("&lo=") ? s : null;
        }, 8000);
        must(!!s2, "the slice view's URL carries &lo=&hi= (the render answers to the strip)");
        if (s2) {
          const u = new URL(s2, BASE);
          const uLo = parseFloat(u.searchParams.get("lo") ?? "nan");
          const uHi = parseFloat(u.searchParams.get("hi") ?? "nan");
          must(Math.abs(uLo - (10.75 - Math.sqrt(0.3125))) < 1e-3 && Math.abs(uHi - (10.75 + Math.sqrt(0.3125))) < 1e-3,
            `the window IS slice 2's μ±σ (lo ${uLo.toFixed(4)}, hi ${uHi.toFixed(4)})`);
        }
        mkdirSync(SHOTS, { recursive: true });
        await sliceImg().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(400);
        await page.screenshot({ path: `${SHOTS}/t287-stack-slice-histogram.png` });
        must(true, "the windowed slice view is posed (t287-stack-slice-histogram.png)");

        // step again → the window CLEARS (a different image is a different
        // distribution — the stale lo/hi pair would command new pixels),
        // but the toggle SURVIVES (the reader's intent does)
        await page.locator('[data-canvas-ui="stack-slice-next"]').click();
        await sleep(600);
        must((await readout.textContent())?.trim() === "slice 3 of 4", `the cursor steps to slice 3 of 4 (got ${(await readout.textContent())?.trim()})`);
        const s3 = await pollUntil(async () => {
          const s = await sliceImg().getAttribute("src");
          return s && s.includes("slice=2") && !s.includes("&lo=") ? s : null;
        }, 8000);
        must(!!s3, "stepping cleared the window (slice=2, no &lo= — AUTO for the new image)");
        const winState = await winRow().getAttribute("data-win-state").catch(() => null);
        must(winState === "auto", `the strip's window state snapped back to auto (got ${winState})`);
        must(
          (await page.locator('[data-canvas-ui="quick-hist-toggle"]').getAttribute("aria-pressed")) === "true",
          "the histogram toggle SURVIVED the step (the reader's intent does)"
        );
        const st3 = await pollUntil(async () => {
          const strip = page.locator('[data-canvas-ui="quick-hist"]');
          const st = await strip.getAttribute("data-hist-state").catch(() => null);
          return st === "ready" ? st : null;
        }, 12000);
        must(st3 === "ready", `the strip is ready again (got ${st3})`);
        const mu3 = await page.locator('[data-canvas-ui="quick-hist-stats"]').textContent();
        must(!!mu3 && mu3.includes("20.75"), `the histogram now speaks slice 3's μ 20.75 (stats: ${mu3?.slice(0, 40)}…)`);

        // C3 — reopening the file restarts the cursor at slice 1
        await page.keyboard.press("Escape");
        await sleep(500);
        await page.locator('button[aria-label*="t287stack"]').first().click();
        await sleep(1000);
        must(
          (await page.locator('[data-canvas-ui="stack-slice-readout"]').textContent())?.trim() === "slice 1 of 4",
          "reopening the stack restarts the cursor at slice 1 (a window belongs to where it was drawn)"
        );
        must(
          (await page.locator('[data-canvas-ui="quick-hist-toggle"]').getAttribute("aria-pressed")) === "false",
          "and the toggle is OFF again (per-file reset, t284's contract)"
        );
        await page.keyboard.press("Escape");
        await sleep(300);
      } finally {
        try { await browser.close().catch(() => {}); } catch { /* gone */ }
      }
    } finally {
      // the evidence leaves: the world returns EXACTLY as t212 accounts it
      rmSync(`${wd}/t287stack.mrcs`, { force: true });
    }
  }
}

console.log("== PHASE Z: the world as it was ==");
const jobsEnd = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobsEnd.jobs ?? []).length === 21, `roster 21 after the dance (got ${(jobsEnd.jobs ?? []).length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0]?.slice(0, 90)}` : ""})`);

console.log(fail === 0 ? "\nt287: ALL PASS" : `\nt287: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

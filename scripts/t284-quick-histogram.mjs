// t284 — THE QUICK LOOK SPEAKS DISTRIBUTIONS: the histogram instrument
// leaves the ortho panel and lands in the quick-look dialog (the first
// glance at ANY image output — a corrected micrograph, a half-map, a
// movie stack). t283's strip was born inside map-ortho-panel.tsx; t284
// lifts it into density-histogram.tsx as ONE drawing truth with two
// consumers:
//   - the ortho panel: interactive (live contour cut line + click→σ→SET)
//   - the quick-look dialog: READ-ONLY (a dialog has no contour context
//     to cut — honest absence) but the hover readout and the stats row
//     still turn the first glance quantitative. "Is this micrograph good"
//     now has the same answer as "where should the contour cut": the
//     distribution, not a squint.
//
// Default OFF at both call sites: the first look walks the whole file on
// the server (chunked two-pass, O(1) memory) — the toggle makes that an
// explicit ask, and the (path, mtime, size) cache makes the rest free.
// key={path} resets the toggle when another file opens.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — the shared module (one draw core, two consumers),
//      the read-only gate (no onPickSigma → no click→σ), the default-OFF
//      toggle, the per-file reset, the panel keeps the σ dispatch, the
//      route still refuses stacks
//   C  alive on the seeded world — C1 the API serves the single-section
//      micrograph's histogram (nTotal = the 64×64 grid); C2 the dialog on
//      the volume: toggle OFF → on → ready, μ = API μ (one server truth,
//      THREE consumers now); C3 the dialog on the micrograph: "single
//      section" + the whole 4096-voxel distribution; C4 the per-file
//      reset (reopen volume → toggle OFF again); C5 the posed screenshot
//   Z  roster identity + console clean
//
// Run: node scripts/t284-quick-histogram.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";

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
const sharedSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/components/workflow/results/density-histogram.tsx", "utf8")
);
must(sharedSrc.includes("export function DensityHistogramStrip"), "the strip lives in ONE shared module");
must(sharedSrc.includes("export function QuickHistSection"), "the dialog's toggle+strip section ships beside it");
must(sharedSrc.includes("useState(false)"), "the quick look starts OFF (the first look is an explicit ask)");
must(sharedSrc.includes("if (!onPickSigma) return;"), "a read-only strip ignores clicks (the honest gate)");
must(sharedSrc.includes("cursor-crosshair") && sharedSrc.includes("cursor-default"), "the cursor says which mode the strip is in");
must(sharedSrc.includes("onPickSigma ? interactiveTitle"), "the title only promises the cut when the cut is possible");
must(sharedSrc.includes("data-canvas-ui={uiPrefix}") && sharedSrc.includes("data-canvas-ui={`${uiPrefix}-stats`}"), "both consumers carry machine-findable hooks");
must(sharedSrc.includes("Math.min(10, Math.max(0.05, Math.abs(raw)))"), "the shared pick clamps to the slider's own bounds");
must(sharedSrc.includes("key={path} resets the toggle") || sharedSrc.includes("Mount with key={path}"), "the per-file reset is documented where it is implemented");

const rvSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/components/workflow/results/results-view.tsx", "utf8")
);
must(rvSrc.includes('QuickHistSection key={imageFile.path}'), "the dialog mounts the section per file (key reset)");
must(rvSrc.includes("max-h-[90dvh] max-w-2xl overflow-y-auto"), "the quick-look dialog SCROLLS (t284 exposed the pre-existing clip: tall content was unreachable — no max-height, no overflow on the dialog)");
must(!rvSrc.includes("onPickSigma"), "the dialog NEVER passes a pick handler (read-only by construction, not by luck)");
must(rvSrc.includes('from "./density-histogram"'), "the dialog imports the shared instrument");

const orthoSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/components/workflow/results/map-ortho-panel.tsx", "utf8")
);
must(orthoSrc.includes('uiPrefix="ortho-hist"') && orthoSrc.includes("onPickSigma={(sigma, sign)"), "the panel keeps the interactive wiring (cut + SET dispatch)");
must(!orthoSrc.includes("QuickHistSection"), "the panel does not speak the dialog's hooks (one truth, distinct consumers)");

const routeSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/app/api/jobs/[id]/outputs/file/route.ts", "utf8")
);
must(routeSrc.includes("The density histogram is for 3D volumes"), "the route still refuses stacks (the dialog rides the SAME containment chain)");

console.log("== PHASE C: the quick look, alive ==");
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
  // C0 — a single-section MICROGRAPH lands beside the volume: 64×64×1
  // float32, a Gaussian particle over a noisy floor — the headline case
  // (the first glance at a motioncorr output is exactly this file shape)
  const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
  const wd = state[host.id]?.workdir;
  must(!!wd, "the host's workdir is registered in engine-state");
  if (wd) {
    // the standing world is ACCOUNTED FOR by t212 (S2: the host owns FOUR
    // volumes — orthovol + both halves + masked). qamic is C-phase EVIDENCE,
    // not a resident: rm first (a crashed earlier run must not poison the
    // world), rm again in the finally — the world returns as it was found.
    rmSync(`${wd}/qamic.mrc`, { force: true });
    try {
      const N = 64;
      const vals = new Float32Array(N * N);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const dx = x - 32, dy = y - 20;
          vals[y * N + x] = 0.02 + Math.random() * 0.015 + 0.9 * Math.exp(-(dx * dx + dy * dy) / (2 * 6 * 6));
        }
      }
      const head = Buffer.alloc(1024);
      head.writeInt32LE(N, 0);      // nx
      head.writeInt32LE(N, 4);      // ny
      head.writeInt32LE(1, 8);      // nz — ONE section: a micrograph, not a volume
      head.writeInt32LE(2, 12);     // mode float32
      head.writeInt32LE(N, 28); head.writeInt32LE(N, 32); head.writeInt32LE(1, 36);
      head.writeFloatLE(1.0, 40); head.writeFloatLE(1.0, 44); head.writeFloatLE(1.0, 48);
      head.writeInt32LE(1, 64); head.writeInt32LE(2, 68); head.writeInt32LE(3, 72);
      head.writeFloatLE(0.0, 76); head.writeFloatLE(0.95, 80); head.writeFloatLE(0.05, 84);
      head.writeInt32LE(0, 88);     // ispg 0 — an image
      head.writeInt32LE(0, 92);     // nsymbt
      head.write("MAP ", 208, "ascii");
      head.writeInt32LE(16777214, 212);
      writeFileSync(`${wd}/qamic.mrc`, Buffer.concat([head, Buffer.from(vals.buffer)]));
      must(true, "qamic.mrc written (64×64×1 — the micrograph shape)");

      // C1 — the API serves the single-section distribution
      const c1 = await fetch(
        `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("qamic.mrc")}&format=histogram`,
        { headers: SH }
      );
      must(c1.status === 200, `the micrograph's histogram answers 200 (got ${c1.status})`);
      const c1d = await c1.json().catch(() => null);
      must(c1d && c1d.nTotal === 64 * 64 * 1, `nTotal is the one 64×64 plane (got ${c1d && c1d.nTotal})`);
      must(c1d && c1d.std > 0 && c1d.max > c1d.mean && c1d.mean > c1d.min, "the particle rides above the floor (ordered stats)");

      // the volume's histogram too (μ equality with the dialog below)
      const cV = await fetch(
        `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("orthovol.mrc")}&format=histogram`,
        { headers: SH }
      ).then((r) => r.json()).catch(() => null);
      must(!!cV && cV.nTotal === 64 * 64 * 64, "the volume's histogram still speaks (262144 voxels)");

      // C2/C3 — the dialog, alive: open the volume, then the micrograph
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

        const openFile = async (name) => {
          // gallery labels carry NO extension (f.label ?? f.name → "orthovol")
          const tile = page.locator(`button[aria-label="Enlarge ${name}"]`).first();
          if (await tile.isVisible().catch(() => false)) await tile.click();
          else throw new Error(`tile "Enlarge ${name}" not visible`);
          await sleep(900);
        };
        const toggleState = async () =>
          page.locator('[data-canvas-ui="quick-hist-toggle"]').getAttribute("aria-pressed");
        // the poll maps non-ready to null — pollUntil returns the FIRST
        // truthy value, and "loading" is truthy (t283's C5 lesson, re-earned)
        const waitReady = async () =>
          pollUntil(async () => {
            const strip = page.locator('[data-canvas-ui="quick-hist"]');
            if (!(await strip.isVisible().catch(() => false))) return null;
            const st = await strip.getAttribute("data-hist-state");
            return st === "ready" ? st : null;
          }, 12000);

        // — the VOLUME in the quick look —
        await openFile("orthovol");
        must(await page.getByText("Central slice").first().isVisible().catch(() => false),
          "the volume dialog is open (central-slice view)");
        const tg1 = await toggleState();
        must(tg1 === "false", `the histogram starts OFF (aria-pressed=${tg1})`);
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').click();
        const st1 = await waitReady();
        must(st1 === "ready", `the strip reaches ready (got ${st1})`);

        // one server truth, THREE consumers now (API, panel strip, dialog strip)
        const stats1 = page.locator('[data-canvas-ui="quick-hist-stats"]');
        const uiMean = await stats1.getAttribute("data-hist-mean");
        must(uiMean === (cV ? cV.mean.toFixed(6) : null),
          `the dialog's μ is the API's μ (${uiMean}) — one server truth, three consumers`);
        const uiN = await stats1.getAttribute("data-hist-n");
        must(uiN === "262144", `the n hook is the whole grid (got ${uiN})`);

        // hover the strip (the readout is drawn INTO the canvas — the pose
        // is the evidence; the numbers already spoke through the hooks)
        const canvas1 = page.locator('[data-canvas-ui="quick-hist"] canvas');
        // the dialog's inner scroll region hides the strip below the fold —
        // FORCE it to the viewport center (IfNeeded no-ops on partial visibility)
        await canvas1.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(400);
        const box1 = await canvas1.boundingBox();
        if (box1) {
          await page.mouse.move(box1.x + box1.width * 0.42, box1.y + box1.height * 0.5, { steps: 3 });
          await sleep(400);
        }
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/t284-quick-hist-volume.png` });
        must(true, "the volume quick look is posed (t284-quick-hist-volume.png)");
        await page.keyboard.press("Escape");
        await sleep(500);

        // — the MICROGRAPH in the quick look —
        await openFile("qamic");
        must(await page.getByText("single section").first().isVisible().catch(() => false),
          "the micrograph dialog is open (single section)");
        const tg2 = await toggleState();
        must(tg2 === "false", `a fresh file, a fresh OFF (aria-pressed=${tg2})`);
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').click();
        const st2 = await waitReady();
        must(st2 === "ready", `the micrograph strip reaches ready (got ${st2})`);
        const stats2 = page.locator('[data-canvas-ui="quick-hist-stats"]');
        const uiN2 = await stats2.getAttribute("data-hist-n");
        must(uiN2 === "4096", `the micrograph's n is its one 64×64 plane (got ${uiN2})`);
        const uiMean2 = await stats2.getAttribute("data-hist-mean");
        must(uiMean2 === (c1d ? c1d.mean.toFixed(6) : null), "the micrograph's μ is the API's μ too");

        const canvas2 = page.locator('[data-canvas-ui="quick-hist"] canvas');
        await canvas2.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(400);
        const box2 = await canvas2.boundingBox();
        if (box2) {
          await page.mouse.move(box2.x + box2.width * 0.35, box2.y + box2.height * 0.5, { steps: 3 });
          await sleep(400);
        }
        await page.screenshot({ path: `${SHOTS}/t284-quick-hist-micrograph.png` });
        must(true, "the micrograph quick look is posed (t284-quick-hist-micrograph.png)");
        await page.keyboard.press("Escape");
        await sleep(400);

        // C4 — the per-file reset: reopen the volume, the toggle is OFF again
        await openFile("orthovol");
        const tg3 = await toggleState();
        must(tg3 === "false", `reopening the volume starts OFF again (aria-pressed=${tg3})`);
        await page.keyboard.press("Escape");
        await sleep(300);
      } finally {
        try { await browser.close().catch(() => {}); } catch { /* gone */ }
      }
    } finally {
      // the evidence leaves: the world returns EXACTLY as t212 accounts it
      rmSync(`${wd}/qamic.mrc`, { force: true });
    }
  }
}

console.log("== PHASE Z: the world as it was ==");
const jobsEnd = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobsEnd.jobs ?? []).length === 21, `roster 21 after the dance (got ${(jobsEnd.jobs ?? []).length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0]?.slice(0, 90)}` : ""})`);

console.log(fail === 0 ? "\nt284: ALL PASS" : `\nt284: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

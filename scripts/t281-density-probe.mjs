// t281 — the DENSITY PROBE: hovering an ortho tile reads the density
// value under the cursor. The instrument every medical-imaging viewer
// and RELION's _display window carry: "is this blob particle or noise"
// wants a NUMBER, not a squint.
//
// Server side: `format=value` on the outputs/file route — the SAME
// containment chain as png/raw/text, but the payload is a NUMBER: a
// single-voxel pread (readMrcVoxel) at the offset the MRC layout gives
// for the probed voxel. The fractions resolve with the renderer's own
// rounding (round(p*(dim-1))), so the number belongs to the pixel the
// cursor is on.
//
// Client side: the tile's mousemove draws a SOLID sky cursor-crosshair
// (the t278 focus lines are DASHED accent-coloured — the two instruments
// never blur) and chases the value on a throttle; a corner chip speaks
// "value @ x,y,z" (1-based, same convention as "z 33/64").
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — the reader, the route branch (same containment
//      chain, .mrcs refused), the probe wiring (throttle, abort, solid
//      lines, corner chip, 1-based address)
//   C  alive on the seeded 64³ world — C1 the API probes a value; C2 the
//      THREE AXES AGREE on the same voxel (the mapping proof: axis=z
//      pos=.5 fx=.5 fy=.5 and axis=y and axis=x all resolve to voxel
//      (32,32,32) and must return the SAME number); C3 corner clamping
//      (fx 0→voxel 0, fx 1→voxel 63); C4 malformed fractions fall back
//      honestly (200, centre); C5 non-MRC files refuse to probe; C6-C9
//      the UI: hover shows lines + chip, the lines FOLLOW the cursor,
//      leave clears, and a hover does not hijack the pick (the sibling
//      planes still fly to a click); C10 the posed screenshot
//   Z  roster identity + console clean
//
// Run: node scripts/t281-density-probe.mjs   (server on :3000)
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
must(mrcSrc.includes("export function readMrcVoxel"), "mrc.ts grows readMrcVoxel (the single-voxel pread)");
must(mrcSrc.includes("1024 + h.nsymbt + ((iz * h.ny + iy) * h.nx + ix) * h.bytesPerVoxel"),
  "the reader walks the MRC layout (x fastest, z slowest)");
must(mrcSrc.includes("Math.round(v * (dim - 1))"), "fractional resolution uses the renderer's rounding");
must(mrcSrc.includes("Number.isFinite"), "non-finite fractions return null (the chip stays silent, not zero)");

const routeSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/app/api/jobs/[id]/outputs/file/route.ts", "utf8")
);
must(routeSrc.includes('format === "value"'), "the route grows the format=value branch");
must(routeSrc.includes("Density probing is for MRC maps only"), "non-MRC files refuse to probe");
must(routeSrc.includes("Density probing is for 3D volumes"), ".mrcs stacks refuse to probe (stacks browse with slice/montage)");
must(routeSrc.includes("isLocalRequest(request)"), "the value branch sits BEHIND the local-request guard");
must(routeSrc.includes("? { fx, fy, fz: pos }"), "the axis→(hAxis,vAxis) map: z rides (x,y)");
must(routeSrc.includes("jobId: job.id"), "the probe names its job (the receipt)");

const orthoSrc = await import("node:fs").then((fs) =>
  fs.readFileSync("src/components/workflow/results/map-ortho-panel.tsx", "utf8")
);
must(orthoSrc.includes("PROBE_THROTTLE_MS"), "the probe throttles its fetches (mousemove fires at pointer rate)");
must(orthoSrc.includes("TRAILING throttle"), "the throttle is TRAILING (a cursor that stops gets its final position probed)");
must(orthoSrc.includes("probeAbort.current?.abort()"), "stale probe fetches are aborted (no out-of-order values)");
must(orthoSrc.includes("onMouseMove={moveProbe}"), "the image container speaks mousemove");
must(orthoSrc.includes("onMouseLeave={leaveProbe}"), "and clears the probe on leave");
must(orthoSrc.includes('data-ortho-probe="h"') && orthoSrc.includes('data-ortho-probe="v"'),
  "the cursor crosshair carries its test hooks (h/v lines)");
must(orthoSrc.includes('data-canvas-ui="ortho-probe-readout"'), "the corner chip carries its hook");
must(orthoSrc.includes("1px solid ${PROBE_COLOR}"), "the probe lines are SOLID (the focus lines are dashed)");
must(orthoSrc.includes("dashed ${AXIS_COLOR[src]}"), "the focus lines stay DASHED accent-coloured (the two instruments never blur)");
must(orthoSrc.includes("probe.voxel.x + 1"), "the chip's address is 1-based (same convention as z 33/64)");
must(orthoSrc.includes("format=value&axis="), "the probe fetch speaks format=value with the axis");
must(orthoSrc.includes("pos=${rendered.toFixed(3)}"), "the probe reads the RENDERED plane (the number belongs to the pixels on screen)");

console.log("== PHASE C: the probe, alive ==");
// the volume world (t253/t278's recipe — idempotent, roster stays 21)
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
  // C1 — the API probes a value
  const probeUrl = (axis, pos, fx, fy) =>
    `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("orthovol.mrc")}&format=value&axis=${axis}&pos=${pos}&fx=${fx}&fy=${fy}`;
  const shFetch = (u) => fetch(u, { headers: SH });
  const c1 = await shFetch(probeUrl("z", 0.5, 0.5, 0.5));
  must(c1.status === 200, `the probe answers 200 (got ${c1.status})`);
  const c1d = await c1.json().catch(() => null);
  must(c1d && typeof c1d.value === "number" && Number.isFinite(c1d.value),
    `the probe speaks a finite number (got ${c1d && JSON.stringify(c1d).slice(0, 80)})`);
  must(c1d && c1d.jobId === host.id, "the receipt names the job");
  must(c1d && c1d.voxel && c1d.voxel.x === 32 && c1d.voxel.y === 32 && c1d.voxel.z === 32,
    `centre fractions resolve to voxel (32,32,32) of 64³ (got ${c1d && JSON.stringify(c1d.voxel)})`);

  // C2 — THE MAPPING PROOF: the three axes agree on the same voxel.
  // axis=z pos=.5 → z=32, fx=.5→x=32, fy=.5→y=32; axis=y pos=.5 → y=32,
  // fy=.5→z=32; axis=x pos=.5 → x=32, fx=.5→y=32. All three must return
  // the SAME number — three different code paths, one voxel, one truth.
  const c2y = await (await shFetch(probeUrl("y", 0.5, 0.5, 0.5))).json().catch(() => null);
  const c2x = await (await shFetch(probeUrl("x", 0.5, 0.5, 0.5))).json().catch(() => null);
  must(c2y && c2y.voxel && c2y.voxel.x === 32 && c2y.voxel.y === 32 && c2y.voxel.z === 32,
    `axis=y resolves the same voxel (got ${c2y && JSON.stringify(c2y.voxel)})`);
  must(c2x && c2x.voxel && c2x.voxel.x === 32 && c2x.voxel.y === 32 && c2x.voxel.z === 32,
    `axis=x resolves the same voxel (got ${c2x && JSON.stringify(c2x.voxel)})`);
  must(c1d && c2y && c2x && c1d.value === c2y.value && c2y.value === c2x.value,
    `THE THREE AXES AGREE: one voxel, one truth (z=${c1d?.value}, y=${c2y?.value}, x=${c2x?.value})`);

  // C3 — corner clamping: fractions land on the extreme voxels
  const c3a = await (await shFetch(probeUrl("z", 0, 0, 0))).json().catch(() => null);
  const c3b = await (await shFetch(probeUrl("z", 1, 1, 1))).json().catch(() => null);
  must(c3a && c3a.voxel && c3a.voxel.x === 0 && c3a.voxel.y === 0 && c3a.voxel.z === 0,
    "corner (0,0,0) clamps to voxel (0,0,0)");
  must(c3b && c3b.voxel && c3b.voxel.x === 63 && c3b.voxel.y === 63 && c3b.voxel.z === 63,
    "corner (1,1,1) clamps to voxel (63,63,63)");

  // C4 — malformed fractions fall back honestly (centre), not explode
  const c4 = await shFetch(probeUrl("z", 0.5, "abc", 0.5));
  must(c4.status === 200, `a malformed fraction falls back to centre, 200 (got ${c4.status})`);
  const c4d = await c4.json().catch(() => null);
  must(c4d && c4d.voxel && c4d.voxel.x === 32, "the fallback landed on the centre voxel");

  // C5 — non-MRC files refuse to probe (the format's own domain wall)
  const c5 = await shFetch(
    `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("no-such-file.star")}&format=value&axis=z&pos=0.5&fx=0.5&fy=0.5`
  );
  must(c5.status >= 400 && c5.status < 500, `a .star path refuses to probe (got ${c5.status})`);

  // C6 — the UI: hover shows the lines + the chip
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

    const xyTile = page.locator('[data-canvas-ui="ortho-tile-z"] .cursor-crosshair');
    const box = await xyTile.boundingBox();
    must(!!box && box.width > 40, `the XY tile's image is visible (got ${box && `${Math.round(box.width)}px`})`);
    if (box) {
      // hover at (25%, 75%)
      const hx = box.x + box.width * 0.25;
      const hy = box.y + box.height * 0.75;
      await page.mouse.move(hx, hy, { steps: 4 });
      await sleep(150);
      const lines = await page.locator('[data-canvas-ui="ortho-tile-z"] [data-ortho-probe]').count();
      must(lines === 2, `hovering draws the two cursor lines (got ${lines})`);
      const squash = (s) => (s ?? "").replace(/\s+/g, "");
      // mouse coordinates land on DEVICE pixels — fx=0.25 of a 356px box
      // serializes as 24.9% or 25.0% depending on the box's fractional
      // origin; parse and tolerate ±1.5% (the lesson: the CSSOM string is
      // a serialization, not an equality target)
      const cssPct = (s, prop) => {
        const m = squash(s).match(new RegExp(`${prop}:(-?[\\d.]+)%`));
        return m ? Number.parseFloat(m[1]) : null;
      };
      const hLine = await page.locator('[data-canvas-ui="ortho-tile-z"] [data-ortho-probe="h"]').getAttribute("style");
      const hPct = cssPct(hLine, "left");
      must(hPct !== null && Math.abs(hPct - 25) <= 1.5, `the vertical line rides the cursor's column (${hPct}%)`);
      must(squash(hLine).includes("56,189,248"), "the probe lines speak sky (the σ chip's cyan family)");
      const vLine = await page.locator('[data-canvas-ui="ortho-tile-z"] [data-ortho-probe="v"]').getAttribute("style");
      const vPct = cssPct(vLine, "top");
      must(vPct !== null && Math.abs(vPct - 75) <= 1.5, `the horizontal line rides the cursor's row (${vPct}%)`);

      // the value chases on the throttle — poll for the corner chip's number
      const chipText = await pollUntil(async () => {
        const chip = page.locator('[data-canvas-ui="ortho-probe-readout"]');
        if (!(await chip.isVisible().catch(() => false))) return null;
        const t = await chip.textContent();
        return t && /-?\d+\.\d{3}/.test(t) ? t : null;
      }, 6000);
      must(!!chipText, `the probe chip speaks a number ("${(chipText ?? "").trim()}")`);
      must(chipText && chipText.includes("@ 17,48,33"),
        `the chip's address is the probed voxel, 1-based ("${(chipText ?? "").trim()}")`);

      // C7 — the lines FOLLOW the cursor (move to (70%, 30%))
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 4 });
      await sleep(200);
      const hLine2 = await page.locator('[data-canvas-ui="ortho-tile-z"] [data-ortho-probe="h"]').getAttribute("style");
      const h2Pct = cssPct(hLine2, "left");
      must(h2Pct !== null && Math.abs(h2Pct - 70) <= 1.5, `the vertical line followed the cursor to 70% (${h2Pct}%)`);

      // C8 — leave clears the instrument
      await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 3 });
      await sleep(250);
      const linesAfter = await page.locator('[data-canvas-ui="ortho-tile-z"] [data-ortho-probe]').count();
      must(linesAfter === 0, `leaving the tile clears the cursor lines (got ${linesAfter})`);
      must(!(await page.locator('[data-canvas-ui="ortho-probe-readout"]').isVisible().catch(() => false)),
        "leaving clears the chip too");

      // C9 — a hover does not hijack the pick: hover again, then CLICK —
      // the sibling planes must still fly to the clicked fractions
      await page.mouse.move(hx, hy, { steps: 3 });
      await sleep(200);
      const linesBack = await page.locator('[data-canvas-ui="ortho-tile-z"] [data-ortho-probe]').count();
      must(linesBack === 2, "the instrument re-arms on re-entry");
      await page.mouse.click(hx, hy);
      await sleep(600);
      const xzNow = await page.locator('[role="slider"][aria-label="XZ plane position along Y"]').getAttribute("aria-valuenow");
      const yzNow = await page.locator('[role="slider"][aria-label="YZ plane position along X"]').getAttribute("aria-valuenow");
      must(near(Number(xzNow), 0.75), `the click still PICKS: XZ plane flew to 0.75 (got ${xzNow})`);
      must(near(Number(yzNow), 0.25), `the click still PICKS: YZ plane flew to 0.25 (got ${yzNow})`);
      // the focus crosshair (dashed) and the probe (solid) coexist
      const focusLines = await page.locator('[data-canvas-ui="ortho-tile-z"][data-ortho-cross], [data-ortho-on="z"][data-ortho-cross]').count();
      must(focusLines === 2, `the focus crosshair survived the hover dance (got ${focusLines})`);

      // C10 — the posed screenshot (probe + focus both lit)
      await page.mouse.move(hx, hy, { steps: 3 });
      await sleep(500);
      mkdirSync(SHOTS, { recursive: true });
      await xyTile.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(400);
      await page.screenshot({ path: `${SHOTS}/t281-density-probe.png` });
    }
  } finally {
    try { await browser.close().catch(() => {}); } catch { /* gone */ }
  }
}

console.log("== PHASE Z: the world as it was ==");
const jobsEnd = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobsEnd.jobs ?? []).length === 21, `roster 21 after the dance (got ${(jobsEnd.jobs ?? []).length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0]?.slice(0, 90)}` : ""})`);

console.log(fail === 0 ? "\nt281: ALL PASS" : `\nt281: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

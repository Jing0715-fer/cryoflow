// t664 — two shadows of agreement, one per lane:
//   1. the compare dialog's SECOND aggregate line (same B/px across
//      panes — t659's same-dims doctrine extended to the storage mode),
//   2. the oblique cut's 2D shadow: while ✂ mirrors the plane into the
//      3D isosurface (t661), every ortho tile draws the LINE where that
//      plane crosses its own slice — with the scissors badge binding it
//      to the toggle that created it.
//
// Probe contract:
//   A  the corrected wall's compare dialog speaks BOTH aggregates; the
//      B/px line's value equals the per-pane rows' value (no contradiction
//      at the resolution the wall speaks), and a third pick keeps it.
//   B  the 3D dance lands, the oblique block turns on — and NO trace
//      appears (the oblique VIEW is not the CUT; only ✂ cuts).
//   C  ✂ on: traces mount on all three tiles; the Z tile's drawn line
//      equals obliqueTraceOnTile's mirror formula (endpoints read from
//      the DOM in viewBox units) with the REAL listing dims; the badge
//      sits at the line's midpoint (the tile center at offset 0, pos 0.5).
//   D  a θ scrub moves the drawn line (mirror formula follows to 50°);
//      chip clear retires EVERY tile's trace (the ACK wire); ✂ again
//      revives them at the adopted angles.
//   E  the console contract — five buckets, real JS errors 0. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const BASE = "http://localhost:3000";
const MOTION_ID = "cmuwipe6350motioncorr";
const REFINE3D_ID = "cmuwipe635000refine3d";
const MAP_PATH = "run_it020_half1.mrc";
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
    await sleep(500);
  }
};

// ---- the trace mirror (verbatim math from map-ortho-panel.tsx) ----
const OBLIQUE_DEG = Math.PI / 180;
function obliqueFrame(dims, thetaDeg, phiDeg, offsetFrac) {
  const [nx, ny, nz] = dims;
  const t = thetaDeg * OBLIQUE_DEG;
  const p = phiDeg * OBLIQUE_DEG;
  const normal = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const c = [(nx - 1) / 2, (ny - 1) / 2, (nz - 1) / 2];
  let support = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    const d = [(i ? nx - 1 : 0) - c[0], (j ? ny - 1 : 0) - c[1], (k ? nz - 1 : 0) - c[2]];
    support = Math.max(support, Math.abs(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2]));
  }
  return { normal, support, offsetVox: offsetFrac * support };
}
function expectedTraceZ(dims, theta, phi, offset, pos) {
  // the Z tile: axis z, hAxis x, vAxis y — the e2e only draws on Z
  const { normal: n, support, offsetVox } = obliqueFrame(dims, theta, phi, offset);
  const c = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
  const d0 = n[0] * c[0] + n[1] * c[1] + n[2] * c[2] + offsetVox;
  const A = n[0] * (dims[0] - 1);
  const B = n[1] * (dims[1] - 1);
  const D = d0 - n[2] * pos * (dims[2] - 1);
  if (Math.hypot(A, B) < 1e-9) return null;
  const pts = [];
  const consider = (h, v) => {
    if (h >= -1e-6 && h <= 1 + 1e-6 && v >= -1e-6 && v <= 1 + 1e-6)
      pts.push([Math.min(1, Math.max(0, h)), Math.min(1, Math.max(0, v))]);
  };
  if (Math.abs(B) > 1e-12) { consider(0, D / B); consider(1, (D - A) / B); }
  if (Math.abs(A) > 1e-12) { consider(D / A, 0); consider((D - B) / A, 1); }
  const uniq = [];
  for (const q of pts)
    if (!uniq.some((r) => Math.abs(r[0] - q[0]) < 1e-6 && Math.abs(r[1] - q[1]) < 1e-6)) uniq.push(q);
  if (uniq.length !== 2) return null;
  return { x1: uniq[0][0] * 100, y1: uniq[0][1] * 100, x2: uniq[1][0] * 100, y2: uniq[1][1] * 100 };
}
const lineNear = (got, exp, tol = 0.6) =>
  !!got && !!exp &&
  Math.min(
    Math.max(Math.abs(got.x1 - exp.x1), Math.abs(got.y1 - exp.y1)) +
    Math.max(Math.abs(got.x2 - exp.x2), Math.abs(got.y2 - exp.y2)),
    Math.max(Math.abs(got.x1 - exp.x2), Math.abs(got.y1 - exp.y2)) +
    Math.max(Math.abs(got.x2 - exp.x1), Math.abs(got.y2 - exp.y1))
  ) <= tol;

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1200 } });
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

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitServerHealthy("initial");

// ---------- A: the compare dialog's second aggregate ----------
await page.locator('[role="tab"][title^="Project dashboard"]').click();
await sleep(1200);
const row = page.locator('[data-roster-row]', { hasText: "own motioncorr" }).first();
const rowUp = await pollUntil(async () => (await row.count()) > 0 && (await row.isVisible()) || null, 15000);
must(!!rowUp, "A roster row for own motioncorr found");
await row.locator('button[title^="Open own motioncorr"]').click();
await sleep(1500);
await page.locator('[role="tablist"] [role="tab"]', { hasText: /^Overview/ }).first().click();
await sleep(1200);

const gallery = page.locator('section[aria-label="Corrected micrographs"]');
const gVisible = await pollUntil(async () =>
  (await gallery.count()) > 0 && (await gallery.isVisible()) || null, 14000);
must(!!gVisible, "A the corrected gallery mounted");

const compareDialog = page.locator('[data-gallery-ui="compare-dialog"]');
const openCompareWith = async (picks) => {
  await gallery.locator('[data-gallery-ui="compare-toggle"]').click();
  await sleep(400);
  const thumbs = gallery.locator('[data-gallery-ui="thumb"]');
  for (const i of picks) { await thumbs.nth(i).click(); await sleep(350); }
  await gallery.locator('[data-gallery-ui="compare-open"]').click();
  await pollUntil(async () => (await compareDialog.count()) > 0 || null, 8000);
  await sleep(800);
};
await openCompareWith([0, 2]);
must(await compareDialog.count() > 0, "A the compare dialog opens with two picks");

const sameDims = compareDialog.locator('[data-gallery-ui="compare-same-dims"]');
const sdText = (await sameDims.innerText().catch(() => "")).replace(/\n/g, " ");
must(/same dims across panes — \d+×\d+ px/.test(sdText),
  "A the same-dims line still speaks (t659 contract continuation)", sdText.trim());

const sameBpp = compareDialog.locator('[data-gallery-ui="compare-same-bpp"]');
const sbText = (await sameBpp.innerText().catch(() => "")).replace(/\n/g, " ");
must(/same B\/px across panes — \d+(\.\d+)? B\/px/.test(sbText),
  "A the same-bpp aggregate line speaks the storage mode", sbText.trim());

// the aggregate's value equals the per-pane rows' value — the line can
// never contradict a row at the resolution the wall speaks
const paneBpps = await compareDialog.locator('[data-pane-stat="bpp"]').allInnerTexts();
const allSame = paneBpps.length >= 2 && paneBpps.every((v) => v === paneBpps[0]);
const valueInLine = paneBpps.length >= 2 && sbText.includes(paneBpps[0].trim());
must(allSame && valueInLine, "A the aggregate's value equals every pane's row",
  `panes=[${paneBpps.map((v) => v.trim()).join(", ")}] line="${sbText.trim()}"`);

await page.screenshot({ path: ".qa-logs/t664-same-bpp.png" });
await page.keyboard.press("Escape");
await sleep(600);

// a third pick keeps both aggregates honest (n=3)
await gallery.locator('[data-gallery-ui="thumb"]').nth(4).click();
await sleep(400);
await gallery.locator('[data-gallery-ui="compare-open"]').click();
await pollUntil(async () => (await compareDialog.count()) > 0 || null, 8000);
await sleep(800);
const sbText3 = (await compareDialog.locator('[data-gallery-ui="compare-same-bpp"]').innerText().catch(() => "")).replace(/\n/g, " ");
must(/same B\/px across panes/.test(sbText3), "A the same-bpp line survives a third pick", sbText3.trim());
await page.keyboard.press("Escape");
await sleep(500);
await page.keyboard.press("Escape");
await sleep(500);
await page.keyboard.press("Escape");
await sleep(900);

// ---------- B: the 3D dance — and the VIEW is not the CUT ----------
// one `openViewerToStrip` pass = inspector open → Results → dance to
// molstar → ortho panel up → strip expanded. Extracted because the box's
// OOM killer executes next-server mid-session (three kills this window,
// dmesg) and the dead dialog's ChunkLoadError is the symptom — the honest
// recovery is the human one: reload the page and re-dance (the chunks are
// compiled+cached by then; only the FIRST compile is at risk).
const openViewerToStrip = async (label) => {
  // the motioncorr inspector may still be animating out — make sure the
  // roster is in sight before the force-click (a click into a dying
  // overlay opens nothing, and "no-enlarge" twice is the symptom)
  let inspectorUp = false;
  for (let i = 0; i < 3 && !inspectorUp; i++) {
    const refineRow = page.locator(`[data-job="${REFINE3D_ID}"]`).first();
    if (!(await refineRow.isVisible().catch(() => false))) {
      await page.keyboard.press("Escape");
      await sleep(1000);
      continue;
    }
    await refineRow.click({ force: true });
    await sleep(1500);
    inspectorUp = !!(await pollUntil(async () =>
      (await page.locator('[role="tab"]', { hasText: "Results" }).count()) > 0 || null, 6000));
    if (!inspectorUp) { await page.keyboard.press("Escape"); await sleep(1200); }
  }
  if (!inspectorUp) return "no-inspector";
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1500);

  const runDance = async () => {
    const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
    const enlUp = await pollUntil(async () => (await enlarge.count()) > 0 || null, 12000);
    if (!enlUp) return "no-enlarge";
    await enlarge.scrollIntoViewIfNeeded().catch(() => {});
    await enlarge.click().catch(() => {});
    await sleep(1200);
    const v3d = page.locator("button", { hasText: "View in 3D" }).first();
    if (!(await v3d.count())) return "no-view3d";
    await v3d.click().catch(() => {});
    const mol = await pollUntil(async () =>
      (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) || null, 120000);
    return mol ? "molstar" : "molstar-dead";
  };
  let exportBtn = page.locator('[data-canvas-ui="ortho-export"]');
  if (!(await exportBtn.count())) {
    const r1 = await runDance();
    console.log(`  ${label} dance #1: ${r1}`);
    if (r1 !== "molstar") { const r2 = await runDance(); console.log(`  ${label} dance #2: ${r2}`); }
    exportBtn = page.locator('[data-canvas-ui="ortho-export"]');
  }
  const orthoUp = await pollUntil(async () => (await exportBtn.count()) > 0 || null, 15000);
  if (!orthoUp) return "no-viewer";

  const stripBtn = page.locator('button[aria-expanded]', { hasText: "Orthogonal slices" }).first();
  await stripBtn.scrollIntoViewIfNeeded().catch(() => {});
  if ((await stripBtn.getAttribute("aria-expanded").catch(() => null)) === "false") {
    await stripBtn.click();
  }
  const expanded = await pollUntil(async () =>
    (await stripBtn.getAttribute("aria-expanded").catch(() => "")) === "true" || null, 6000);
  return expanded ? "ready" : "no-strip";
};

let stage = await openViewerToStrip("B");
must(stage === "ready", "B the 3D viewer with its ortho strip is open", stage);

const oblique = page.locator('[data-canvas-ui="ortho-oblique"]');
// two recovery ladders, each honest about what it fixes:
//   1. dims' bounded retry burned inside a flap window → re-arm the strip
//      (open→false→true re-fires the effect — t662's move);
//   2. the dialog itself died (ChunkLoadError from an OOM restart) →
//      reload + full re-dance — the chunks are cached by then.
let obliqueUp = await pollUntil(async () => (await oblique.count()) > 0 || null, 30000);
if (!obliqueUp && stage === "ready") {
  console.log("  · oblique block absent — re-arming the strip (t662 recovery)");
  const stripBtn = page.locator('button[aria-expanded]', { hasText: "Orthogonal slices" }).first();
  await stripBtn.scrollIntoViewIfNeeded().catch(() => {});
  if ((await stripBtn.getAttribute("aria-expanded").catch(() => "")) === "true") {
    await stripBtn.click();
    await sleep(900);
  }
  if ((await stripBtn.getAttribute("aria-expanded").catch(() => "")) === "false") {
    await stripBtn.click();
  }
  obliqueUp = await pollUntil(async () => (await oblique.count()) > 0 || null, 30000);
}
for (let rd = 1; !obliqueUp && rd <= 2; rd++) {
  console.log(`  · stage lost — full recovery pass #${rd} (reload + re-dance)`);
  await waitServerHealthy("recovery");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(2500);
  stage = await openViewerToStrip(`R${rd}`);
  if (stage !== "ready") continue;
  obliqueUp = await pollUntil(async () => (await oblique.count()) > 0 || null, 30000);
}
must(!!obliqueUp, "B the oblique block is present under the strip");
if (!obliqueUp) {
  // bail with the autopsy, not a crash: what did the dialog hold, what
  // did the console catch (the t662 bail branch's shape)
  const autopsy = await page.evaluate(() => ({
    tiles: [...document.querySelectorAll('[data-canvas-ui^="ortho-tile-"]')].length,
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    sections: [...document.querySelectorAll('section[aria-label]')].slice(0, 8).map((s) => s.getAttribute("aria-label")),
  }));
  console.log(`  · B autopsy: ${JSON.stringify(autopsy)}`);
  must(consoleErrors.length === 0, "E (bail) zero real JavaScript console errors", `${consoleErrors.length}`);
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
  mkdirSync(".qa-logs", { recursive: true });
  await page.screenshot({ path: ".qa-logs/t664-bail.png" });
  await b.close();
  console.log(`\nt664-e2e: ${PASS} pass / ${FAIL} fail`);
  process.exit(FAIL ? 1 : 0);
}
await oblique.scrollIntoViewIfNeeded().catch(() => {});
if ((await oblique.getAttribute("data-oblique-state").catch(() => null)) === "off") {
  await oblique.locator("button").first().click();
}
await pollUntil(async () => (await oblique.getAttribute("data-oblique-state").catch(() => "")) === "on" || null, 6000);
must((await oblique.getAttribute("data-oblique-state")) === "on", "B the oblique VIEW is on");
await sleep(900);
must((await page.locator('[data-canvas-ui="ortho-oblique-trace-z"]').count()) === 0,
  "B the VIEW alone draws NO trace (only the CUT does)");

// the tile must sit at its default slice for the geometry contract
const zReadout = await page.locator('[data-canvas-ui="ortho-tile-z"] .font-mono').first().innerText().catch(() => "");
must(zReadout.trim().startsWith("z 33/"), "B the Z tile rests at its default slice", zReadout.trim());

// ---------- C: ✂ on — the cut's shadow lands on every tile ----------
const cutBtn = page.locator('[data-canvas-ui="ortho-oblique-cut3d"]');
await cutBtn.scrollIntoViewIfNeeded().catch(() => {});
await cutBtn.click();
const traceZ = page.locator('[data-canvas-ui="ortho-oblique-trace-z"]');
const traceUp = await pollUntil(async () => (await traceZ.count()) > 0 || null, 10000);
must(!!traceUp, "C ✂ on: the Z tile draws the cut's trace");
must((await page.locator('[data-canvas-ui="ortho-oblique-trace-x"]').count()) === 1,
  "C the X tile draws its trace too");
must((await page.locator('[data-canvas-ui="ortho-oblique-trace-y"]').count()) === 1,
  "C the Y tile draws its trace too");

// the drawn line equals the mirror formula with the REAL listing dims
const listingDims = await page.evaluate(async (id) => {
  const r = await fetch(`/api/jobs/${id}/outputs`, { cache: "no-store" });
  if (!r.ok) return null;
  const d = await r.json();
  const f = (d.files ?? []).find((x) => x.path === "run_it020_half1.mrc");
  return f?.dims ?? null;
}, REFINE3D_ID);
must(Array.isArray(listingDims) && listingDims.every((d) => d > 1),
  "C the listing carries the map's dims", JSON.stringify(listingDims));

if (listingDims) {
  const readLine = async () => page.evaluate(() => {
    const el = document.querySelector('[data-canvas-ui="ortho-oblique-trace-z"] line');
    if (!el) return null;
    return {
      x1: parseFloat(el.getAttribute("x1") ?? ""),
      y1: parseFloat(el.getAttribute("y1") ?? ""),
      x2: parseFloat(el.getAttribute("x2") ?? ""),
      y2: parseFloat(el.getAttribute("y2") ?? ""),
      stroke: el.getAttribute("stroke"),
    };
  });
  const drawn45 = await pollUntil(readLine, 6000);
  const exp45 = expectedTraceZ(listingDims, 45, 30, 0, 0.5);
  must(lineNear(drawn45, exp45), "C the drawn Z line equals the mirror formula (θ45·φ30·off0·pos0.5)",
    drawn45 && exp45 ? `drawn (${drawn45.x1?.toFixed(2)},${drawn45.y1?.toFixed(2)})↔(${drawn45.x2?.toFixed(2)},${drawn45.y2?.toFixed(2)}) vs exp (${exp45.x1.toFixed(2)},${exp45.y1.toFixed(2)})↔(${exp45.x2.toFixed(2)},${exp45.y2.toFixed(2)})` : "null");
  must(drawn45?.stroke === "#7c3aed", "C the trace wears the ✂ chip's violet", drawn45?.stroke);

  const badge = page.locator('[data-canvas-ui="ortho-oblique-badge-z"]');
  must((await badge.count()) === 1, "C the scissors badge rides the Z trace");
  const badgeStyle = await badge.getAttribute("style").catch(() => "");
  must(/left:\s*50(\.0)?%/.test(badgeStyle ?? "") && /top:\s*50(\.0)?%/.test(badgeStyle ?? ""),
    "C the badge sits at the line's midpoint (the tile center at offset 0)", (badgeStyle ?? "").slice(0, 60));
}

await page.screenshot({ path: ".qa-logs/t664-oblique-trace.png" });

// ---------- D: the shadow follows, retires, and revives ----------
const thetaThumb = page.getByRole("slider", { name: "Polar angle of the plane normal" }).first();
await thetaThumb.scrollIntoViewIfNeeded().catch(() => {});
await thetaThumb.focus();
await page.keyboard.press("Home");
await sleep(150);
for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight"); // 0 → 50°
await sleep(1400);
const thetaNow = await thetaThumb.getAttribute("aria-valuenow");
must(thetaNow === "50", "D the θ slider lands at 50°", `aria-valuenow=${thetaNow}`);

// GEOMETRY NOTE (the probe's own lesson, first draft got it wrong): at
// pos=0.5 with offset=0 the intersection line passes through the tile
// center and its DIRECTION depends only on φ — θ is analytically cancelled
// (h(v) = ½ + tanφ/2 − tanφ·v), so the θ50 line LEGITIMATELY equals the
// θ45 line here. The mirror formula says so too. θ's shadow only moves on
// an OFF-CENTER slice — so move the slice, then measure.
let zPos = 0.5;
if (listingDims) {
  const zSlider = page.getByRole("slider", { name: "XY plane position along Z" }).first();
  await zSlider.scrollIntoViewIfNeeded().catch(() => {});
  await zSlider.focus();
  await page.keyboard.press("Home");
  await sleep(150);
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight"); // 0 → 12/63
  await sleep(700);
  const zRead = await page.locator('[data-canvas-ui="ortho-tile-z"] .font-mono').first().innerText().catch(() => "");
  must(zRead.trim().startsWith("z 13/"), "D the Z slice moved off center (voxel 13)", zRead.trim());
  zPos = 12 / 63;

  const moved = await pollUntil(async () => {
    const l = await page.evaluate(() => {
      const el = document.querySelector('[data-canvas-ui="ortho-oblique-trace-z"] line');
      if (!el) return null;
      return {
        x1: parseFloat(el.getAttribute("x1") ?? ""),
        y1: parseFloat(el.getAttribute("y1") ?? ""),
        x2: parseFloat(el.getAttribute("x2") ?? ""),
        y2: parseFloat(el.getAttribute("y2") ?? ""),
      };
    });
    return lineNear(l, expectedTraceZ(listingDims, 50, 30, 0, zPos)) ? l : null;
  }, 8000);
  const expMoved = expectedTraceZ(listingDims, 50, 30, 0, zPos);
  must(!!moved && !!expMoved, "D the shadow followed the SLICE move (θ50, pos 12/63)",
    moved && expMoved ? `(${moved.x1.toFixed(2)},${moved.y1.toFixed(2)})↔(${moved.x2.toFixed(2)},${moved.y2.toFixed(2)}) vs exp (${expMoved.x1.toFixed(2)},${expMoved.y1.toFixed(2)})↔(${expMoved.x2.toFixed(2)},${expMoved.y2.toFixed(2)})` : "no match");
  const expCenter = expectedTraceZ(listingDims, 50, 30, 0, 0.5);
  must(!lineNear(moved, expCenter), "D the off-center slice measurably moved the line");
}

const clearBtn = page.locator('[data-testid="clip-oblique-clear"]');
await clearBtn.scrollIntoViewIfNeeded().catch(() => {});
await clearBtn.click();
const tracesGone = await pollUntil(async () =>
  (await page.locator('[data-canvas-ui="ortho-oblique-trace-z"]').count()) === 0 &&
  (await page.locator('[data-canvas-ui="ortho-oblique-trace-x"]').count()) === 0 &&
  (await page.locator('[data-canvas-ui="ortho-oblique-trace-y"]').count()) === 0 || null, 8000);
must(!!tracesGone, "D chip clear retires EVERY tile's trace (the ACK wire)");

await cutBtn.click(); // ✂ again — the sliders' adopted state revives
const tracesBack = await pollUntil(async () =>
  (await page.locator('[data-canvas-ui="ortho-oblique-trace-z"]').count()) === 1 || null, 8000);
must(!!tracesBack, "D ✂ again revives the trace");
if (listingDims && tracesBack) {
  const back = await pollUntil(async () => {
    const l = await page.evaluate(() => {
      const el = document.querySelector('[data-canvas-ui="ortho-oblique-trace-z"] line');
      if (!el) return null;
      return {
        x1: parseFloat(el.getAttribute("x1") ?? ""),
        y1: parseFloat(el.getAttribute("y1") ?? ""),
        x2: parseFloat(el.getAttribute("x2") ?? ""),
        y2: parseFloat(el.getAttribute("y2") ?? ""),
      };
    });
    return lineNear(l, expectedTraceZ(listingDims, 50, 30, 0, zPos)) ? true : null;
  }, 8000);
  must(!!back, "D the revived trace speaks the adopted θ50 plane");
}

// ---------- E: the console contract ----------
must(consoleErrors.length === 0, "E zero real JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "E zero resource 404s — the shadow speaks real geometry", `${resource404.length}`);
must(resourceFlap.length <= 60, "E server-flap resource failures bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "E lazy-chunk fetch flaps bounded", `${chunkFlap.length}`);
must(hmrNoise.length <= 10, "E HMR socket noise bounded", `${hmrNoise.length}`);

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt664-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

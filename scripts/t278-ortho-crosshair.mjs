// t278 — the three planes learn to share a point, and the résumé card
// stops lying about its rows (Task 278).
//
// Two leftovers close in one window:
//
// ① The tri-planar FOCUS POINT (the "3D viewer 体积截面" line's missing
//    classic): the three ortho tiles previously scrubbed in isolation —
//    nothing told you where the sibling planes cut through the image you
//    are looking at. Now every tile reports its position up, the panel
//    feeds sibling positions back down, and each tile draws the OTHER two
//    planes as dashed crosshair lines in the marked plane's accent (on
//    the XY tile: a vertical amber line where the YZ plane cuts, a
//    horizontal violet one where the XZ plane cuts). Clicking an image
//    PICKS a focus point — the two sibling planes move to the clicked
//    fractions (the RELION _display / medical-viewer navigation). The
//    slider steps one VOXEL when the grid is known (step = 1/(dim-1),
//    same for its arrow keys), and ‹ › buttons click-step a voxel.
//    A panel-level toggle (never nested inside the expand button —
//    existing locators survive) switches the crosshair off.
//
// ② The résumé card's helper line said "click one to open its job's
//    inspector" — a lie over a wall of gone rows (t277's third state).
//    The helper now adapts to the record shape: live (no gone rows — the
//    original text verbatim), mixed (gone rows present but live ones
//    remain — "click a LIVE one"), history (every row gone — "nothing
//    left to open"). data-resume-helper={live|mixed|history} speaks it
//    to tests.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — crosshair machinery (AXIS_COLOR, data-ortho-cross,
//      cursor-crosshair pick, stepFrac, Focus toggle, positions lift) +
//      the helper's three branches + data-resume-helper, at source
//   C  the focus point, alive — seed the volume world (t253's recipe),
//      open the 3D viewer, expand the ortho strip: three crosshair line
//      pairs exist; keyboard-stepping a plane MOVES the matching line on
//      the sibling tiles; clicking the XY image at (25%, 75%) moves the
//      XZ/YZ planes to those fractions (readouts speak voxels); the
//      toggle hides and restores the lines; ‹ › step exactly one voxel
//      on a 64³ grid; the frame
//   D  the helper adapts, alive — the t277 injection recipe, LIGHTENED
//      (no second canvas: records are hand-injected into the GLOBAL
//      engine-state under a probeless connection): round 1 one record
//      pointing at a REAL roster job → exists=true → helper "live";
//      round 2 add a fabricated dead-job record → "mixed"; round 3 only
//      the dead record → "history" + the gone row re-speaks t277's
//      badge. finally: state keys restored, connection gone.
//   Z  roster identity + console clean
//
// Run: node scripts/t278-ortho-crosshair.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

async function pollUntil(fn, deadlineMs, intervalMs = 1200) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

// Phase D rig state — hoisted so the finally can always clean up
let connId = `qa-t278-${Date.now().toString(36)}`;
let stateSnapshot = null; // the state file BEFORE any injection (restored key-wise)
let realJobId = null;
let deadId = `qa-t278-dead-${Date.now().toString(36)}`;

const stateRuns = () => {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
};
const readConns = async () => {
  const d = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
  return d.connections ?? d ?? [];
};

console.log("== PHASE A: demo truth ==");
await fetch(`${BASE}/`).then((r) => must(r.status === 200, `homepage 200 (got ${r.status})`));
const roster = await (await fetch(`${BASE}/api/jobs`)).json();
must((roster.jobs ?? []).length === 21, `roster 21 (got ${(roster.jobs ?? []).length})`);

console.log("== PHASE B: source ledger ==");
const orthoSrc = readFileSync("src/components/workflow/results/map-ortho-panel.tsx", "utf8");
must(orthoSrc.includes("AXIS_COLOR"), "AXIS_COLOR — the per-axis crosshair palette exists");
for (const c of ["rgba(245,158,11", "rgba(139,92,246", "rgba(20,184,166"]) {
  must(orthoSrc.includes(c), `crosshair palette speaks the accent family ${c.slice(0, 16)}…`);
}
must(orthoSrc.includes("data-ortho-cross"), "crosshair lines carry data-ortho-cross test hooks");
must(orthoSrc.includes("data-ortho-on"), "each line names the tile it lies on (data-ortho-on)");
must(orthoSrc.includes("cursor-crosshair"), "the pickable image wears the crosshair cursor");
must(orthoSrc.includes("pickFocus"), "the pick handler exists (click → sibling planes follow)");
must(orthoSrc.includes("onPositionChange?.(pos)"), "tiles report their position upward");
must(orthoSrc.includes("1 / (dim - 1)"), "voxel-true step: stepFrac = 1/(dim-1) when the grid is known");
must(orthoSrc.includes("ortho-crosshair-toggle"), "the panel-level crosshair toggle exists");
must(orthoSrc.includes("Focus"), "the toggle wears the Focus glyph");
must(orthoSrc.includes("setPositions((prev) => ({ ...prev, [axis]: d.pos as number }))"),
  "3D-driven plane moves ride into the focus point");
must(orthoSrc.includes("ortho-step-"), "‹ › voxel-step buttons carry data-canvas-ui hooks");

const dlgSrc = readFileSync("src/components/workflow/remote-cluster-dialog.tsx", "utf8");
must(dlgSrc.includes("data-resume-helper={helperVariant}"), "the helper line carries the variant hook");
must(dlgSrc.includes('helperVariant === "live"'), "branch 1: live (original text)");
must(dlgSrc.includes('helperVariant === "mixed"'), "branch 2: mixed (click a LIVE one)");
must(dlgSrc.includes('"Runs this connection once dispatched, kept as history'), "branch 3: history (nothing left to open)");
must(dlgSrc.includes("click a live one to open"), "the mixed text no longer lies about gone rows");
must(dlgSrc.includes("nothing left to open"), "the history text says the door is gone");
must(dlgSrc.includes("e.exists === false).length"), "the variant is computed from the rows' exists shape");

console.log("== PHASE C: the focus point, alive ==");
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
const page = await browser.newPage();
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

  // C1 — three crosshair line pairs exist (each tile draws the OTHER two)
  for (const tile of ["z", "y", "x"]) {
    const n = await page.locator(`[data-ortho-on="${tile}"][data-ortho-cross]`).count();
    must(n === 2, `the ${tile}-normal tile draws its two sibling lines (got ${n})`);
  }
  // the marked plane's accent: on the XY tile the x-line is amber, the y-line violet
  // (CSSOM serializes colors with spaces — the probe strips them)
  const squash = (s) => (s ?? "").replace(/\s+/g, "");
  const xyX = await page.locator('[data-ortho-on="z"][data-ortho-cross="x"]').getAttribute("style");
  must(squash(xyX).includes("245,158,11"), `the XY tile's x-line speaks the YZ plane's amber ("${(xyX ?? "").slice(0, 60)}…")`);
  const xyY = await page.locator('[data-ortho-on="z"][data-ortho-cross="y"]').getAttribute("style");
  must(squash(xyY).includes("139,92,246"), "the XY tile's y-line speaks the XZ plane's violet");
  must(xyX?.includes("border-left") ?? false, "the x-line is VERTICAL (it marks a column cut)");
  must(xyY?.includes("border-top") ?? false, "the y-line is HORIZONTAL (it marks a row cut)");

  // C2 — keyboard-stepping a plane moves the sibling lines: focus the XZ
  // tile's slider (normal y) and ArrowRight — the y-lines on XY and YZ move
  const yLineOnXy = page.locator('[data-ortho-on="z"][data-ortho-cross="y"]');
  const topBefore = await yLineOnXy.evaluate((el) => el.style.top);
  const xzSlider = page.locator('[role="slider"][aria-label="XZ plane position along Y"]');
  await xzSlider.focus();
  await page.keyboard.press("End");
  await sleep(250);
  await page.keyboard.press("Home");
  await sleep(250);
  await page.keyboard.press("ArrowRight");
  await sleep(500);
  const topAfter = await yLineOnXy.evaluate((el) => el.style.top);
  must(topBefore !== topAfter, `the y-line follows the Y plane (${topBefore} → ${topAfter})`);

  // C3 — clicking the XY image PICKS a focus point: the XZ/YZ planes move,
  // the picked tile's OWN plane stays put
  const xyImg = page.locator('[data-canvas-ui="ortho-tile-z"] .cursor-crosshair');
  const box = await xyImg.boundingBox();
  must(!!box && box.width > 40, "the XY image box is measurable (pick target real)");
  if (box) {
    const zBefore = await page.locator('[role="slider"][aria-label="XY plane position along Z"]').getAttribute("aria-valuenow");
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.75);
    await sleep(500);
    const xzNow = await page.locator('[role="slider"][aria-label="XZ plane position along Y"]').getAttribute("aria-valuenow");
    const yzNow = await page.locator('[role="slider"][aria-label="YZ plane position along X"]').getAttribute("aria-valuenow");
    must(!!xzNow && Math.abs(Number(xzNow) - 0.75) <= 0.05, `the XZ plane jumped to the picked row (~75%, got ${xzNow})`);
    must(!!yzNow && Math.abs(Number(yzNow) - 0.25) <= 0.05, `the YZ plane jumped to the picked column (~25%, got ${yzNow})`);
    const zNow = await page.locator('[role="slider"][aria-label="XY plane position along Z"]').getAttribute("aria-valuenow");
    must(zNow === zBefore, `the picked tile's own plane stayed put (Z ${zBefore} → ${zNow})`);
  }

  // C4 — the toggle hides and restores the crosshair
  const toggle = page.locator('[data-canvas-ui="ortho-crosshair-toggle"]');
  must((await toggle.getAttribute("aria-pressed")) === "true", "the crosshair starts ON");
  await toggle.click();
  await sleep(250);
  must((await page.locator("[data-ortho-cross]").count()) === 0, "toggle off — every line is gone");
  await toggle.click();
  await sleep(250);
  must((await page.locator("[data-ortho-cross]").count()) === 6, "toggle on — all six lines return");

  // C5 — voxel-true stepping: on the 64³ grid one ‹ › click is exactly one
  // voxel (step = 1/63); the readout speaks "z N/64"
  const xySlider = page.locator('[role="slider"][aria-label="XY plane position along Z"]');
  await xySlider.focus();
  await page.keyboard.press("Home");
  await sleep(250);
  const z0 = await page.locator('[data-canvas-ui="ortho-tile-z"] .tabular-nums').first().textContent();
  await page.locator('[data-canvas-ui="ortho-step-z-inc"]').click();
  await sleep(250);
  await page.locator('[data-canvas-ui="ortho-step-z-inc"]').click();
  await sleep(250);
  const z2 = await page.locator('[data-canvas-ui="ortho-tile-z"] .tabular-nums').first().textContent();
  must(!!z0 && /1\/64/.test(z0), `the readout speaks voxel truth from Home (got "${(z0 ?? "").trim()}")`);
  must(!!z2 && /3\/64/.test(z2), `two ‹› clicks = exactly two voxels (got "${(z2 ?? "").trim()}")`);

  // C6 — Escape closes the 3D viewer, the page under it survives
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(800);

  console.log("== PHASE D: the helper adapts, alive (light injection rig) ==");
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t278 Helper",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);

  // a REAL roster job (exists=true) and a fabricated dead one (exists=false)
  realJobId = (roster.jobs ?? []).find((j) => j.type === "import")?.id ?? null;
  must(!!realJobId, `a real roster job carries the live record (${realJobId ?? "?"})`);

  const record = (jobId) => ({
    jobId,
    projectId: "qa-t278-witness",
    type: "import",
    pid: null,
    cmd: "t278-injected: the helper's witness record",
    workdir: `/home/z/my-project/data/relion/t278/${jobId}`,
    logFile: `/home/z/my-project/data/relion/t278/${jobId}/run.out`,
    errFile: `/home/z/my-project/data/relion/t278/${jobId}/run.err`,
    startedAt: new Date().toISOString(),
    done: true,
    exitCode: 0,
    remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct", stagedMs: 900, syncMs: 2100, syncedFiles: 2, syncedBytes: 2048 },
  });

  // inject round records — the baseline is the ORIGINAL snapshot each time
  // (only the two witness keys are touched; the rest of the world stands)
  const inject = (wantLive, wantDead) => {
    if (!stateSnapshot) stateSnapshot = readFileSync(STATE_FILE, "utf8");
    const obj = JSON.parse(stateSnapshot);
    const put = (id, on) => {
      if (on) obj[id] = record(id);
      else if (!(id in JSON.parse(stateSnapshot))) delete obj[id]; // only delete keys we added
    };
    put(realJobId, wantLive);
    put(deadId, wantDead);
    writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2));
  };

  const assertRound = async (variant, textProbe) => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(2200);
    await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
    await sleep(1100);
    const helper = page.locator("[data-resume-helper]").last();
    await helper.waitFor({ state: "attached", timeout: 8000 }).catch(() => {});
    const seen = await helper.getAttribute("data-resume-helper").catch(() => null);
    const txt = (await helper.textContent().catch(() => "")) ?? "";
    must(seen === variant, `the helper speaks variant "${variant}" (got ${seen})`);
    must(txt.includes(textProbe), `the "${variant}" text says "${textProbe}"`);
  };

  // round 1 — one live record → "live"
  inject(true, false);
  const r1 = await pollUntil(async () => {
    const list = await readConns();
    const c = list.find((x) => x.id === connId);
    return c?.resume?.recent?.find((e) => e.jobId === realJobId)?.exists === true ? c : null;
  }, 8000);
  must(!!r1, "the DTO grades the real-job record exists=true (with projectName)");
  await assertRound("live", "click one to open");

  // round 2 — live + dead → "mixed"
  inject(true, true);
  const r2 = await pollUntil(async () => {
    const list = await readConns();
    const c = list.find((x) => x.id === connId);
    const gone = c?.resume?.recent?.find((e) => e.jobId === deadId);
    const live = c?.resume?.recent?.find((e) => e.jobId === realJobId);
    return gone?.exists === false && live?.exists === true ? c : null;
  }, 8000);
  must(!!r2, "the DTO grades the fabricated record exists=false beside the live one");
  await assertRound("mixed", "click a live one");

  // round 3 — only the dead record → "history" (t277's gone row re-speaks)
  inject(false, true);
  const r3 = await pollUntil(async () => {
    const list = await readConns();
    const c = list.find((x) => x.id === connId);
    const rec = c?.resume?.recent ?? [];
    return rec.length >= 1 && rec.every((e) => e.jobId === deadId && e.exists === false) ? c : null;
  }, 8000);
  must(!!r3, "the history round leaves exactly the gone record");
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2200);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1100);
  const goneRow = page.locator(`[data-resume-entry="${deadId}"]`).first();
  await goneRow.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  must((await goneRow.getAttribute("data-resume-gone").catch(() => null)) === "gone",
    "the gone row still wears t277's data-resume-gone badge");
  const helper3 = page.locator("[data-resume-helper]").last();
  must((await helper3.getAttribute("data-resume-helper").catch(() => null)) === "history",
    'the helper speaks variant "history"');
  must(((await helper3.textContent()) ?? "").includes("nothing left to open"),
    "the history text closes the door the old copy pretended existed");
  await goneRow.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/t278-resume-helper-history.png` });
} finally {
  try { await browser.close().catch(() => {}); } catch { /* gone */ }
  console.log("== cleanup ==");
  // the injection rig un-mines itself: the connection first, then the state keys
  try {
    await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH });
  } catch { /* already gone */ }
  try {
    if (stateSnapshot) {
      const snap = JSON.parse(stateSnapshot);
      const cur = stateRuns();
      for (const id of [realJobId, deadId]) {
        if (!id) continue;
        if (id in snap) cur[id] = snap[id]; // restore the baseline value
        else delete cur[id];                // remove a key we added
      }
      writeFileSync(STATE_FILE, JSON.stringify(cur, null, 2));
    }
  } catch { /* nothing injected */ }
}

console.log("== PHASE Z: the world as it was ==");
const rosterEnd = await (await fetch(`${BASE}/api/jobs`)).json();
must((rosterEnd.jobs ?? []).length === 21, `roster 21 after the dance (got ${(rosterEnd.jobs ?? []).length})`);
const connsEnd = await readConns();
must(!connsEnd.find((x) => x.id === connId), "the probeless connection left with the witness");
must(stateRuns()[deadId] === undefined, "the fabricated dead record left the global state");
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 80)}` : ""})`);

console.log(fail === 0 ? "\nt278: ALL PASS" : `\nt278: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

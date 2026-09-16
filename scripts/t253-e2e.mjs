// t253 — the recital retires, and the clip learns to speak 2D (Task 253).
// The cron text has recited two feature directions for many windows:
// "3D viewer 体积截面工具" and "Topaz wrapper". This window audits BOTH —
// and both are BUILT: the embed carries the full cross-section toolset
// (density-image Slice with axis/scrub/landscape, ChimeraX-style box Clip
// with per-axis sliders + invert + a projected wireframe with draggable
// faces), the picking UI offers Topaz with its own parameter tab, and the
// topaz-training route + lib exist. The recital's last live items are gone;
// this suite pins the retirement with source assertions AND live evidence.
//
// The BUILD half: the box clip lived only in the 3D scene — the 2D
// orthogonal tiles below the canvas kept showing the FULL box with no
// idea a crop had happened. t253 wires the missing echo: the embed
// dispatches cryoflow:clip-state on every clip intent, and each tile
// speaks its slice of the story — the kept region drawn as a violet
// outline on surviving planes (renderer-truthful: axis 0 is the top row
// and the left column in readMrcOrthoSlice, so kept intervals map onto
// the overlay with no flip), and a quiet "clipped" badge + dimmed image
// on planes the crop removed entirely.
//
// Phases:
//   A  demo truth — homepage 200, roster 21 (seeders idempotent)
//   B  the recital's ledger — Topaz wrapper (params + training lib/route),
//      the cross-section toolset (slice + clip intents), the t251/t252
//      gates on disk, statcache + batched BFS — all asserted at source
//   C  the clip learns 2D — seed the volume world, open the 3D viewer,
//      toggle Clip, drive the Z slider: XY tile flips to "clipped" (its
//      normal axis cropped past the viewed plane), XZ/YZ tiles draw the
//      kept band (Z 0–20%); slider back to 80% — the badge clears, the
//      outlines re-speak; Clip off — the tiles go silent
//   D  console clean + the frame (clip overlays visible on the tiles)
//
// Run: node scripts/t253-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// seed the volume world (t210's recipe — idempotent, roster stays 21)
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });

const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
const roster = (jobs.jobs ?? []).length;
const host = (jobs.jobs ?? []).find((j) => j.name === "QA Refine3D");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1720, height: 940 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// ---- Phase A: demo truth ------------------------------------------------------
console.log("== PHASE A: demo truth ==");
const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
must(res.status() === 200, `homepage 200 (got ${res.status()})`);
await sleep(2500);
must(roster === 21, `roster identity 21 (got ${roster})`);
must(!!host, "QA Refine3D in roster (the seeder's host)");

// ---- Phase B: the recital's ledger — both feature directions are BUILT --------
console.log("== PHASE B: the recital's ledger ==");
const workflow = readFileSync("src/lib/workflow.ts", "utf8");
must(workflow.includes('"Topaz"') && workflow.includes("topazNrParticles"), "Topaz lives in the picking UI (method + its own parameter tab)");
must(
  existsSync("src/lib/relion/topaz-training.ts") && existsSync("src/app/api/jobs/[id]/topaz-training/route.ts"),
  "the Topaz training lib + route exist (self-trained model path)"
);
const embed = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
must(
  embed.includes("applySliceIntent") && embed.includes("applyClipIntent") && embed.includes("ORTHO_CLIP_STATE_EVENT"),
  "the cross-section toolset is live (slice + clip intents + the t253 clip echo)"
);
must(
  existsSync("scripts/t251-hardening-gates.mjs") && existsSync("scripts/t252-write-gates.mjs"),
  "the t251 read-ring + t252 write-door gates are on disk (Task 13's recital, pinned)"
);
must(
  readFileSync("src/app/api/jobs/[id]/fsc/route.ts", "utf8").includes("cachedFileCompute"),
  "the chart hot path rides the statcache (recital #7, fixed)"
);
must(
  /ONE edge query|batched/i.test(readFileSync("src/app/api/jobs/[id]/particles/route.ts", "utf8")),
  "particles BFS is batched (recital #8, fixed)"
);

// ---- Phase C: the clip learns 2D ----------------------------------------------
console.log("== PHASE C: the clip speaks on the 2D tiles ==");
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

const clipBtn = page.locator('button[aria-label="Toggle box clipping"]');
let clipUp = await clipBtn.isVisible().catch(() => false);
for (let k = 0; k < 9 && !clipUp; k++) { await sleep(5000); clipUp = await clipBtn.isVisible().catch(() => false); }
must(clipUp, "the Clip toggle is on the contour row");
await clipBtn.click();
await sleep(600);
must((await clipBtn.getAttribute("aria-pressed")) === "true", "box clipping is ON");

// drive the Z slider deterministically — keyboard on the focused thumb:
// Home lands on the min (0.02), then ArrowRight steps by 0.01. No viewport
// geometry, no track-vs-thumb ambiguity.
const zSlider = page.locator('[role="slider"][aria-label="Clip position along the Z axis"]');
const setClipZ = async (frac) => {
  await zSlider.focus();
  await page.keyboard.press("Home");
  await sleep(120);
  const steps = Math.max(0, Math.round(frac * 100) - 2);
  for (let i = 0; i < steps; i++) await page.keyboard.press("ArrowRight");
  await sleep(700);
};
await setClipZ(0.2);
const readoutZ = await zSlider.getAttribute("aria-valuenow");
must(readoutZ !== null && Math.abs(Number(readoutZ) - 0.2) <= 0.03, `Z clip lands at ~20% (got ${readoutZ})`);

// the XY tile's NORMAL axis is Z — its viewed plane (50%) is now cropped away
const xyTile = page.locator('[data-canvas-ui="ortho-tile-z"]');
must((await xyTile.locator("text=clipped").count()) === 1, "the XY tile wears the clipped badge (its plane is cropped away)");
must((await xyTile.locator('[role="img"][aria-label^="Clip keeps"]').count()) === 0, "no kept-outline lies on a removed plane");

// the XZ/YZ tiles survive; their vertical axis is Z — the kept band 0–20%
const band = page.locator('[role="img"][aria-label^="Clip keeps X 0 to 100 percent, Z 0 to 20 percent"]');
must((await band.count()) === 1, `the XZ tile speaks the kept band (Z 0–20%)`);
const band2 = page.locator('[role="img"][aria-label^="Clip keeps Y 0 to 100 percent, Z 0 to 20 percent"]');
must((await band2.count()) === 1, `the YZ tile speaks the kept band (Z 0–20%)`);

// the frame — clip overlays visible on the tiles (before any un-clipping)
mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: `${SHOTS}/t253-clip-speaks-2d-2x.png` });

// slider back to 80% — the XY plane survives again, the badge clears
await setClipZ(0.8);
must((await xyTile.locator("text=clipped").count()) === 0, "the badge clears when the plane survives (Z 80%)");
const band3 = page.locator('[role="img"][aria-label^="Clip keeps X 0 to 100 percent, Z 0 to 80 percent"]');
must((await band3.count()) === 1, "the XZ tile re-speaks at Z 0–80%");

// Clip off — the tiles go silent
await clipBtn.click();
await sleep(600);
must((await page.locator('[role="img"][aria-label^="Clip keeps"]').count()) === 0, "Clip off — no kept-outlines remain");
must((await page.locator("text=clipped").count()) === 0, "Clip off — no badges remain");

// ---- Phase D: console -----------------------------------------------------------
console.log("== PHASE D: console ==");
must(consoleErrors.length === 0, `console clean (got ${consoleErrors.length}: ${consoleErrors.slice(0, 2).join(" | ")})`);

await browser.close();
console.log(fail === 0 ? "t253: ALL PASS" : `t253: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

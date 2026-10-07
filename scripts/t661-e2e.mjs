// t661 — the oblique cut's 3D half: the isosurface opens along the 2D
// block's plane (the volume cross-section tool's missing lane).
//
// Backstory: the ortho block's plane family (t555) has had TWO 3D halves —
// ⌖ flies the camera face-on (t556), ⤸ adopts the orbit (t557) — but the
// plane itself never entered the 3D scene: Mol*'s slice representation is
// axis-aligned only. This window the third half lands: the block's ✂
// toggle mirrors the settled plane over cryoflow:oblique-clip into the
// embed, and the ISOSURFACE's pixel-clip planes (which take ANY normal)
// open the surface along the tile's exact geometry. The chip in the
// viewer speaks the committed plane live; flip chooses the kept half;
// clear retires it and the ACK echo turns the block's ✂ dark — no scrub
// can resurrect a cut the viewer dismissed. The plane math is pinned by
// t661-oblique-plane-test (20 anchors, shader semantics mirrored).
//
// Probe contract:
//   A  the world — refine3d carries a real map and the server's oblique
//      route renders the SAME plane family (θ45·φ30 PNG).
//   B  the mirror — ✂ on: the 3D chip appears speaking the block's plane
//      (θ 45° · φ 30° · +0%); a θ scrub follows the chip live.
//   C  the 3D-local controls — flip chooses the kept half (aria-pressed);
//      clear retires the cut AND the block's ✂ goes dark with it (the
//      ACK loop, asserted from the 2D side).
//   D  coexistence — the cut rides ALONGSIDE the box-clip language: Z
//      slider at 20% keeps the chip (crop + section intersect).
//   E  the console contract — four buckets, real JS errors 0. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
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

// ---------- A: the world answers ----------
must(await page.evaluate(async (id) => {
  const r = await fetch(`/api/jobs`, { cache: "no-store" });
  const d = await r.json();
  return (d.jobs ?? []).some((j) => j.id === id && j.type === "refine3d" && j.status === "completed");
}, REFINE3D_ID), "A the refine3d job exists and completed");

const obliquePng = await page.evaluate(async ({ id, p }) => {
  const r = await fetch(`/api/jobs/${id}/outputs/file?path=${encodeURIComponent(p)}&format=png&plane=oblique&theta=45&phi=30&offset=0`, { cache: "no-store" });
  return { ok: r.ok, type: r.headers.get("content-type") };
}, { id: REFINE3D_ID, p: MAP_PATH });
must(obliquePng.ok && (obliquePng.type ?? "").includes("image/png"),
  "A the server's oblique route renders θ45·φ30 as a PNG", obliquePng.type ?? "none");

// ---------- open the 3D viewer (t291's dance, probe-proven form) ----------
await page.locator(`[data-job="${REFINE3D_ID}"]`).first().click({ force: true });
await sleep(1500);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1500);

let exportBtn = page.locator('[data-canvas-ui="ortho-export"]');
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
    (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) || null, 60000);
  return mol ? "molstar" : "molstar-dead";
};
if (!(await exportBtn.count())) {
  const r1 = await runDance();
  console.log(`  dance #1: ${r1}`);
  if (r1 !== "molstar") { const r2 = await runDance(); console.log(`  dance #2: ${r2}`); }
  exportBtn = page.locator('[data-canvas-ui="ortho-export"]');
}
const orthoUp = await pollUntil(async () => {
  const attached = await exportBtn.count();
  return attached > 0 || null;
}, 15000);
must(!!orthoUp, "the 3D viewer with its ortho panel is open");

// expand the ortho strip (the oblique block mounts under it)
const stripBtn = page.locator('button[aria-expanded]', { hasText: "Orthogonal slices" }).first();
await stripBtn.scrollIntoViewIfNeeded().catch(() => {});
if ((await stripBtn.getAttribute("aria-expanded").catch(() => null)) === "false") {
  await stripBtn.click();
}
await pollUntil(async () => (await stripBtn.getAttribute("aria-expanded").catch(() => "")) === "true" || null, 6000);
must((await stripBtn.getAttribute("aria-expanded").catch(() => "")) === "true", "the ortho strip is expanded");

// ---------- B: the mirror — ✂ on, chip speaks the block's plane ----------
const oblique = page.locator('[data-canvas-ui="ortho-oblique"]');
const obliqueUp = await pollUntil(async () => (await oblique.count()) > 0 || null, 12000);
must(!!obliqueUp, "B the oblique block is present under the strip");
await oblique.scrollIntoViewIfNeeded().catch(() => {});
if ((await oblique.getAttribute("data-oblique-state").catch(() => null)) === "off") {
  await oblique.locator("button").first().click();
}
await pollUntil(async () => (await oblique.getAttribute("data-oblique-state").catch(() => "")) === "on" || null, 6000);
must((await oblique.getAttribute("data-oblique-state")) === "on", "B the oblique block is ON");

const cutBtn = page.locator('[data-canvas-ui="ortho-oblique-cut3d"]');
must((await cutBtn.count()) === 1, "B the ✂ cut-in-3D toggle is on the block's control row");
await cutBtn.click();
must((await cutBtn.getAttribute("aria-pressed")) === "true", "B the ✂ toggle is pressed");

const chip = page.locator('[data-testid="clip-oblique-chip"]');
const chipUp = await pollUntil(async () => (await chip.count()) > 0 && (await chip.isVisible()) || null, 10000);
must(!!chipUp, "B the 3D cut chip appears in the viewer's control card");

const readout = page.locator('[data-testid="clip-oblique-readout"]');
const roText = (await readout.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
must(roText.includes("θ 45°") && roText.includes("φ 30°"),
  "B the chip speaks the block's default plane", roText);

// a θ scrub follows the chip LIVE (the settle debounce bounds the lag)
const thetaThumb = page.getByRole("slider", { name: "Polar angle of the plane normal" }).first();
await thetaThumb.scrollIntoViewIfNeeded().catch(() => {});
await thetaThumb.focus();
await page.keyboard.press("Home");
await sleep(150);
for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight"); // 0 → 50°
await sleep(1200); // the 140ms settle + one pump commit
const thetaNow = await thetaThumb.getAttribute("aria-valuenow");
must(thetaNow === "50", "B the θ slider lands at 50°", `aria-valuenow=${thetaNow}`);
const roText2 = (await readout.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
must(roText2.includes("θ 50°"), "B the chip's readout followed the scrub live", roText2);
must((await cutBtn.getAttribute("aria-pressed")) === "true", "B the ✂ stays lit through its own scrub");

await page.screenshot({ path: ".qa-logs/t661-oblique-cut.png" });

// ---------- C: the 3D-local controls — flip + clear (with ACK) ----------
const flipBtn = page.locator('[data-testid="clip-oblique-flip"]');
await flipBtn.click();
await sleep(400);
must((await flipBtn.getAttribute("aria-pressed")) === "true", "C flip keeps the +n half (aria-pressed)");
await flipBtn.click();
await sleep(400);
must((await flipBtn.getAttribute("aria-pressed")) === "false", "C flip back to the camera-facing half");

const clearBtn = page.locator('[data-testid="clip-oblique-clear"]');
await clearBtn.click();
const chipGone = await pollUntil(async () => (await chip.count()) === 0 || null, 8000);
must(!!chipGone, "C clear retires the chip");
const scissorsDark = await pollUntil(async () =>
  (await cutBtn.getAttribute("aria-pressed").catch(() => "")) === "false" || null, 8000);
must(!!scissorsDark, "C the block's ✂ went dark with it (the ACK echo crosses the wire)");

// and a scrub while dark does NOT resurrect the dismissed cut
await thetaThumb.focus();
await page.keyboard.press("ArrowRight");
await sleep(900);
must((await chip.count()) === 0, "C a scrub while ✂ is dark never resurrects the cut");

// ---------- D: coexistence — cut + box crop compose ----------
await cutBtn.click(); // ✂ back on (θ51·φ30 — the adopted slider state)
const chipBack = await pollUntil(async () => (await chip.count()) > 0 || null, 8000);
must(!!chipBack, "D ✂ on again — the chip returns");

const clipToggle = page.locator('button[aria-label="Toggle box clipping"]');
await clipToggle.scrollIntoViewIfNeeded().catch(() => {});
await clipToggle.click();
await sleep(700);
must((await clipToggle.getAttribute("aria-pressed")) === "true", "D box clipping is ON");
const zSlider = page.locator('[role="slider"][aria-label="Clip position along the Z axis"]');
await zSlider.focus();
await page.keyboard.press("Home");
await sleep(120);
for (let i = 0; i < 18; i++) await page.keyboard.press("ArrowRight"); // 0.02 → 0.20
await sleep(900);
must((await chip.count()) === 1, "D the oblique cut survives the crop (they intersect)",
  (await readout.innerText().catch(() => "")).replace(/\s+/g, " ").trim());
const roText3 = (await readout.innerText().catch(() => "").then((t) => (t ?? "").replace(/\s+/g, " ").trim()));
must(roText3.includes("φ 30°"), "D the chip still speaks the same plane family", roText3);
// restore: clip off (the oblique cut stays for the closing shot)
await clipToggle.click();
await sleep(500);
must((await clipToggle.getAttribute("aria-pressed")) === "false", "D box clipping is OFF again");

// ---------- E: the console contract ----------
must(consoleErrors.length === 0, "E zero real JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "E zero resource 404s — the cut speaks real geometry", `${resource404.length}`);
must(resourceFlap.length <= 60, "E server-flap resource failures bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "E lazy-chunk fetch flaps bounded", `${chunkFlap.length}`);
must(hmrNoise.length <= 10, "E HMR socket noise bounded", `${hmrNoise.length}`);

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t661-cut-chip.png" });
await b.close();
console.log(`\nt661-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

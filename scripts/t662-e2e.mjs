// t662 — the oblique cut's 3D guide: the plane's trace (plane ∩ box) and
// the kept-side tick, drawn as a camera-projected SVG overlay above the
// Mol* canvas (the wireframe treatment the box clip has had since t253).
//
// Backstory: t661 opened the isosurface along the 2D block's oblique plane,
// but the plane itself stayed invisible in 3D — a pixel-clip plane has no
// pixels of its own, so the eye had only the chip's θ·φ readout to reason
// about where the cut sits. This window the plane gets its body back: the
// guide draws WHERE the cut crosses the volume (the trace polygon) and
// WHICH half survives (the tick, flipped by the chip's flip). The plane
// math is pinned by t662-oblique-guide-test (43 anchors: coplanarity,
// boundary, winding, anisotropy, degeneracy, anchor identity).
//
// Probe contract:
//   A  the world — refine3d carries a real map; the server's oblique route
//      renders the same plane family (θ45·φ30 PNG).
//   B  the guide — ✂ on: the SVG overlay mounts, the trace is a real
//      polygon (≥ 3 vertices, in-bounds), the tick grows from inside the
//      trace toward the kept half (point-in-polygon invariant at offset 0),
//      and a θ scrub keeps the guide live on the plane's new geometry. 📸
//   C  the tick obeys the flip — the trace is untouched, the tick mirrors;
//      clear retires the whole overlay and a scrub while dark never
//      resurrects it.
//   D  coexistence — the oblique trace and the box-clip outline ride the
//      same overlay layer without stealing each other's DOM. 📸
//   E  the console contract — five buckets, real JS errors 0.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

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

// guide readers — run in the page, return the overlay's live geometry
const readGuide = () => {
  const svg = document.querySelector('[data-oblique-guide="true"]');
  if (!svg) return null;
  const poly = svg.querySelector("path");
  const tick = svg.querySelector("line");
  const tip = svg.querySelector("circle");
  return {
    polyD: poly?.getAttribute("d") ?? "",
    tick: tick ? {
      x1: +tick.getAttribute("x1"), y1: +tick.getAttribute("y1"),
      x2: +tick.getAttribute("x2"), y2: +tick.getAttribute("y2"),
    } : null,
    tipR: tip ? +(tip.getAttribute("r") ?? "0") : 0,
    w: svg.clientWidth,
    h: svg.clientHeight,
  };
};
const pathPoints = (d) => {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
};
// even-odd point-in-polygon over the projected trace
const inPolygon = (pt, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
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

// the ortho-export button is a PRESENCE PROBE for the viewer's ortho panel —
// the dance itself is enlarge → "View in 3D" → __molstar ready (t661's form)
let exportBtn = page.locator('[data-canvas-ui="ortho-export"]');
const molReady = () =>
  pollUntil(async () =>
    (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) || null, 120000);
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
  // mol* compiles lazily — after an OOM restart the cold compile can
  // legitimately outlive a minute, so the readiness poll gets two minutes
  return (await molReady()) ? "molstar" : "molstar-dead";
};
if (!(await exportBtn.count())) {
  const r1 = await runDance();
  console.log(`  dance #1: ${r1}`);
  if (r1 !== "molstar") {
    // the compile may still be in flight from attempt #1 — one more
    // readiness window before re-walking the whole dance
    const late = await molReady();
    if (!late) {
      const r2 = await runDance();
      console.log(`  dance #2: ${r2}`);
    } else {
      console.log("  dance #1 recovered late: molstar");
    }
  }
  exportBtn = page.locator('[data-canvas-ui="ortho-export"]');
}
const orthoUp = await pollUntil(async () => {
  const attached = await exportBtn.count();
  return attached > 0 || null;
}, 15000);
must(!!orthoUp, "A the 3D viewer with its ortho panel is open");

// expand the ortho strip (the oblique block mounts under it)
const stripBtn = page.locator('button[aria-expanded]', { hasText: "Orthogonal slices" }).first();
await stripBtn.scrollIntoViewIfNeeded().catch(() => {});
if ((await stripBtn.getAttribute("aria-expanded").catch(() => null)) === "false") {
  await stripBtn.click();
}
await pollUntil(async () => (await stripBtn.getAttribute("aria-expanded").catch(() => "")) === "true" || null, 6000);
must((await stripBtn.getAttribute("aria-expanded").catch(() => "")) === "true", "A the ortho strip is expanded");

const oblique = page.locator('[data-canvas-ui="ortho-oblique"]');
// the block mounts only after the dims listing lands — t661's bounded retry
// (~14s) can exhaust itself entirely during a server flap window (the honest
// absence then never retries), so a failed window gets ONE re-expand: the
// same recovery a human does by collapsing and reopening the strip (the
// open→false→true toggle re-fires the dims effect)
let obliqueUp = null;
for (let attempt = 0; attempt < 2 && !obliqueUp; attempt++) {
  if (attempt > 0) {
    console.log("  · re-expanding the ortho strip (dims retry window exhausted)");
    await stripBtn.click().catch(() => {});
    await sleep(800);
    await stripBtn.click().catch(() => {});
    await sleep(800);
  }
  obliqueUp = await pollUntil(async () => (await oblique.count()) > 0 || null, 25000);
}
must(!!obliqueUp, "A the oblique block is present under the strip");
if (!obliqueUp) {
  const diag = await page.evaluate(() => {
    const strips = [...document.querySelectorAll("button[aria-expanded]")]
      .filter((x) => (x.textContent ?? "").includes("Orthogonal slices"))
      .map((s) => ({ expanded: s.getAttribute("aria-expanded"), visible: !!s.offsetParent }));
    const panels = document.querySelectorAll('[data-canvas-ui="ortho-export"]').length;
    const tiles = document.querySelectorAll('[data-canvas-ui^="ortho-tile"]').length;
    const hist = document.querySelectorAll('[data-canvas-ui^="ortho-hist"]').length;
    return { strips, panels, tiles, hist, dialogs: document.querySelectorAll('[role="dialog"]').length };
  });
  const dimsApi = await page.evaluate(async () => {
    try {
      const r = await fetch("/api/jobs/cmuwipe635000refine3d/outputs", { cache: "no-store" });
      const d = await r.json();
      const f = (d.files ?? []).find((x) => x.path === "run_it020_half1.mrc");
      return { status: r.status, dims: f?.dims ?? null, files: (d.files ?? []).length };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log("  diag:", JSON.stringify(diag));
  console.log("  dims api:", JSON.stringify(dimsApi));
  console.log(`\nt662-e2e: ${PASS} pass / ${FAIL + 1} fail (bail — the block never mounted)`);
  mkdirSync(".qa-logs", { recursive: true });
  await page.screenshot({ path: ".qa-logs/t662-bail.png" });
  await b.close();
  process.exit(1);
}
if ((await oblique.getAttribute("data-oblique-state").catch(() => null)) === "off") {
  await oblique.locator("button").first().click();
}
await pollUntil(async () => (await oblique.getAttribute("data-oblique-state").catch(() => "")) === "on" || null, 6000);
must((await oblique.getAttribute("data-oblique-state")) === "on", "A the oblique block is ON");

const cutBtn = page.locator('[data-canvas-ui="ortho-oblique-cut3d"]');
must((await cutBtn.count()) === 1, "B the ✂ cut-in-3D toggle is on the block's control row");
await cutBtn.click();
must((await cutBtn.getAttribute("aria-pressed")) === "true", "B the ✂ toggle is pressed");
const chip = page.locator('[data-testid="clip-oblique-chip"]');
await pollUntil(async () => (await chip.count()) > 0 && (await chip.isVisible()) || null, 10000);
must((await chip.count()) > 0, "B the 3D cut chip appears");

// ---------- B: the guide draws the plane's body ----------
const guideUp = await pollUntil(async () => {
  const g = await page.evaluate(readGuide);
  return g && g.polyD.length > 0 && g.tick && g.tipR > 0 ? g : null;
}, 15000);
must(!!guideUp, "B the oblique guide overlay mounts with a live trace + tick");
if (guideUp) {
  const mCount = (guideUp.polyD.match(/M/g) ?? []).length;
  must(mCount >= 3 && mCount <= 6,
    "B the trace is a box-plane polygon (3..6 vertices)", `M-count=${mCount}`);
  const pts = pathPoints(guideUp.polyD);
  must(pts.every(([x, y]) => x >= -1 && x <= guideUp.w + 1 && y >= -1 && y <= guideUp.h + 1),
    "B every trace vertex is inside the viewport", `${guideUp.w}×${guideUp.h}`);
  const t = guideUp.tick;
  must(Math.hypot(t.x2 - t.x1, t.y2 - t.y1) > 4,
    "B the kept-side tick has visible length", `${(t.x2 - t.x1).toFixed(1)}, ${(t.y2 - t.y1).toFixed(1)}`);
  must(inPolygon([t.x1, t.y1], pts),
    "B the tick grows from inside the trace (the anchor IS the plane's center at offset 0)");
}

await page.screenshot({ path: ".qa-logs/t662-oblique-guide.png" });

// a θ scrub keeps the guide honest on the plane's new geometry
const thetaThumb = page.getByRole("slider", { name: "Polar angle of the plane normal" }).first();
await thetaThumb.scrollIntoViewIfNeeded().catch(() => {});
await thetaThumb.focus();
await page.keyboard.press("Home");
await sleep(150);
for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight"); // 0 → 50°
await sleep(1200);
must((await thetaThumb.getAttribute("aria-valuenow")) === "50", "B the θ slider lands at 50°");
const scrubbed = await pollUntil(async () => {
  const g = await page.evaluate(readGuide);
  return g && g.polyD.length > 0 && g.polyD !== guideUp.polyD ? g : null;
}, 10000);
must(!!scrubbed, "B the trace followed the scrub (new plane, new polygon)");

// ---------- C: the tick obeys the flip; clear retires the overlay ----------
const flipBtn = page.locator('[data-testid="clip-oblique-flip"]');
await flipBtn.click();
await sleep(500);
const flipped = await page.evaluate(readGuide);
must(!!flipped && flipped.polyD.length > 0, "C the guide survives the flip");
if (flipped && scrubbed) {
  must(flipped.polyD === scrubbed.polyD,
    "C the flip moves the tick, not the plane (trace untouched)");
  must(Math.hypot(flipped.tick.x2 - flipped.tick.x1, flipped.tick.y2 - flipped.tick.y1) > 4,
    "C the flipped tick still has visible length");
  must(Math.abs(flipped.tick.x1 - scrubbed.tick.x1) < 0.6 && Math.abs(flipped.tick.y1 - scrubbed.tick.y1) < 0.6,
    "C the tick's anchor stayed put through the flip");
  must(Math.hypot(flipped.tick.x2 - scrubbed.tick.x2, flipped.tick.y2 - scrubbed.tick.y2) > 2,
    "C the tick's tip mirrored to the other side",
    `Δ=(${(flipped.tick.x2 - scrubbed.tick.x2).toFixed(1)}, ${(flipped.tick.y2 - scrubbed.tick.y2).toFixed(1)})`);
}
await flipBtn.click();
await sleep(500);

const clearBtn = page.locator('[data-testid="clip-oblique-clear"]');
await clearBtn.click();
const guideGone = await pollUntil(async () => (await page.evaluate(readGuide)) === null || null, 8000);
must(!!guideGone, "C clear retires the guide overlay with the chip");
await thetaThumb.focus();
await page.keyboard.press("ArrowRight");
await sleep(900);
must((await page.evaluate(readGuide)) === null,
  "C a scrub while ✂ is dark never resurrects the overlay");

// ---------- D: coexistence — the trace and the box outline share the layer ----------
await cutBtn.click(); // ✂ back on (θ51·φ30 — the adopted slider state)
await pollUntil(async () => (await chip.count()) > 0 || null, 8000);
const clipToggle = page.locator('button[aria-label="Toggle box clipping"]');
await clipToggle.scrollIntoViewIfNeeded().catch(() => {});
await clipToggle.click();
await sleep(700);
must((await clipToggle.getAttribute("aria-pressed")) === "true", "D box clipping is ON");
const bothUp = await pollUntil(async () => {
  const box = await page.evaluate(() => !!document.querySelector('[data-clip-guide="true"]'));
  const ob = await page.evaluate(readGuide);
  return box && ob && ob.polyD.length > 0 ? { box, ob } : null;
}, 10000);
must(!!bothUp, "D the box outline and the oblique trace are both live");
await page.screenshot({ path: ".qa-logs/t662-guide-coexist.png" });
await clipToggle.click();
await sleep(500);
must((await clipToggle.getAttribute("aria-pressed")) === "false", "D box clipping is OFF again");

// ---------- E: the console contract ----------
must(consoleErrors.length === 0, "E zero real JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "E zero resource 404s — the guide speaks real geometry", `${resource404.length}`);
must(resourceFlap.length <= 60, "E server-flap resource failures bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "E lazy-chunk fetch flaps bounded", `${chunkFlap.length}`);
must(hmrNoise.length <= 10, "E HMR socket noise bounded", `${hmrNoise.length}`);

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt662-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

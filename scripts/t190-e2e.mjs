/* t190 — the landscape becomes a scrub bar (drag) + all-axes overviews.
 *
 * Task 189 put a density landscape under the slice slider; Task 190 makes
 * it a true instrument in two moves:
 *  1. DRAG-SCRUB — pointer-down jumps, pointer-move drags the plane
 *     through the mountains with capture. The intent applier's pump
 *     coalesces in-flight commits, so a fast scrub lands on the latest
 *     position, not every pixel of the path.
 *  2. XYZ OVERVIEWS — an "XYZ" chip expands two ghost rows (the other
 *     axes' landscapes, muted, h-4). Clicking a ghost ADOPTS that axis
 *     AND jumps to the clicked position in ONE intent. Ghosts share the
 *     per-axis cache: expanding refetches only the axes never measured,
 *     a ghost that later becomes active renders instantly, and collapse
 *     + re-expand hits the cache (zero new calls).
 *
 * X pins both moves in source; D drives the UI (drag 30%→60%, ghost
 * adoption Y+40%, collapse); the wire-level profile contract itself is
 * t189's turf and is not re-litigated here. Z proves read-only.
 */
import { readFileSync } from "fs";
import path from "path";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");
const HOST_JOB = "QA Refine3D";

let pass = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}
function section(name) {
  console.log(`== ${name} ==`);
}

/* ================= S — baseline + fixture ================= */
section("S: baseline world + seeded volume");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);
const host = jobs0.find((j) => j.name === HOST_JOB && j.status === "completed");
must(!!host, `S2 the volume host job exists (${HOST_JOB})`);
try {
  execSync(`QA_VOL_HOST="${HOST_JOB}" python3 scripts/qa67-seed-volume.py`, { cwd: path.resolve("."), stdio: "pipe", timeout: 60_000 });
  must(true, "S3 volume seeding ran (idempotent)");
} catch (e) {
  must(false, `S3 volume seeding ran (${e.message?.slice(0, 60)})`);
}

/* ================= X — source oracles ================= */
section("X: the scrub bar is written once");
const embSrc = src("src/components/workflow/results/molstar-embed.tsx");

must(
  embSrc.includes("onLandscapePointerDown") && embSrc.includes("setPointerCapture"),
  "X1 drag-scrub captures the pointer (the drag survives leaving the strip)"
);
must(
  embSrc.includes("onLandscapePointerMove") && embSrc.includes("if (!scrubbing.current) return;"),
  "X2 moves only scrub while a drag is live (hover never moves the plane)"
);
must(
  embSrc.includes("touch-none select-none"),
  "X3 the strip opts out of touch gestures and text selection (scrub, not scroll)"
);
must(
  embSrc.includes("drag to scrub the plane"),
  "X4 the strip's own name teaches the drag (an instrument labels its grip)"
);
must(
  embSrc.includes('aria-label="Toggle all-axis landscapes"'),
  "X5 the XYZ chip exists with its own name"
);
must(
  embSrc.includes("jumpToGhost") && embSrc.includes("axis: axis.toUpperCase() as SliceAxis, pos:"),
  "X6 a ghost click adopts the axis AND jumps the position in ONE intent"
);
must(
  embSrc.includes("Ghost landscape of the"),
  "X7 ghost rows carry their own names (the overview is addressable)"
);
must(
  embSrc.includes("animate-pulse rounded bg-muted/50"),
  "X8 an unmeasured ghost shows a quiet skeleton, never a blank lie"
);
must(
  embSrc.includes("g[ax] ? g :") || embSrc.includes("profileCache.current.get(ax)"),
  "X9 ghosts share the per-axis cache (expanding refetches only never-measured axes)"
);
must(
  embSrc.includes('className="w-3.5 shrink-0 rounded bg-muted'),
  "X10 each ghost row has an explicit adopt-axis button (two doors: letter = adopt, strip = adopt+jump)"
);

/* ================= D — the UI loop ================= */
section("D: drag the mountains, adopt a ghost");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
const profileUrls = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("response", (r) => {
  const u = r.url();
  if (u.includes("/map-profile")) profileUrls.push(`${u.match(/axis=(\w)/)?.[1] ?? "?"}:${r.status()}`);
});
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  if (await page.locator("h1", { hasText: "Dashboard" }).isVisible().catch(() => false)) {
    await page.keyboard.press("Shift+KeyD");
    await sleep(2200);
  } else if (await page.locator(`[data-job="${host.id}"]`).first().isVisible().catch(() => false)) {
    onCanvas = true;
  } else await sleep(1800);
}
must(onCanvas, "D1 the canvas renders");
let inResults = false;
for (let i = 0; i < 6 && !inResults; i++) {
  await page.locator(`[data-job="${host.id}"]`).first().click({ timeout: 3000, force: i >= 3 }).catch(() => {});
  await sleep(1600);
  const tab = page.locator('[role="tab"]', { hasText: "Results" });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await sleep(1400);
    inResults = await page.locator('section[aria-label="Maps and images"]').isVisible().catch(() => false);
  }
}
must(inResults, "D2 the inspector opens on Results");

let viewerOpen = false;
for (let i = 0; i < 5 && !viewerOpen; i++) {
  await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 2500 }).catch(() => {});
  await sleep(1200);
  const v3d = page.locator("button", { hasText: "View in 3D" });
  if (await v3d.isVisible().catch(() => false)) {
    await v3d.click();
    await sleep(1500);
    viewerOpen = await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false);
    for (let k = 0; k < 20 && !viewerOpen; k++) {
      await sleep(2500);
      viewerOpen = await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false);
    }
  }
}
must(viewerOpen, "D3 the Mol* viewer opens");

if (viewerOpen) {
  await page.locator('button[aria-label="Toggle cross-section plane"]').click();
  await sleep(700);
  const strip = page.locator('svg[aria-label^="Density profile along the"]');
  let stripOk = false;
  for (let i = 0; i < 12 && !stripOk; i++) {
    stripOk = (await strip.isVisible().catch(() => false)) && !!(await strip.boundingBox().catch(() => null));
    if (!stripOk) await sleep(1000);
  }
  must(stripOk, "D4 the landscape renders");

  // ---- drag-scrub: down at 30%, sweep to 60%, release ----
  const box = await strip.boundingBox();
  const readout = () =>
    page
      .locator("span", { hasText: /^plane \d+%$/ })
      .last()
      .textContent()
      .catch(() => "");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await sleep(900);
  const ro1 = (await readout()) ?? "";
  must(/plane 60%/.test(ro1), `D5 the drag lands on the release position (${ro1.trim()})`);
  const playX = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg[aria-label^="Density profile along the"]')][0];
    const dot = svg?.querySelector("circle[cx]");
    return dot ? Number(dot.getAttribute("cx")) : NaN;
  });
  must(Math.abs(playX - 60) < 3, `D6 the playhead follows the drag (cx ${playX}, target 60)`);

  // ---- XYZ overviews ----
  await page.locator('button[aria-label="Toggle all-axis landscapes"]').click();
  await sleep(400);
  const ghostSvgs = page.locator('svg[aria-label^="Ghost landscape of the"]');
  let ghostCount = 0;
  for (let i = 0; i < 10; i++) {
    ghostCount = await ghostSvgs.count().catch(() => 0);
    if (ghostCount >= 2) break;
    await sleep(900);
  }
  must(ghostCount === 2, `D7 both ghost landscapes render (${ghostCount})`);
  const beforeExpand = profileUrls.length;
  const activeAxis0 = /along the (\w) axis/.exec(((await strip.getAttribute("aria-label").catch(() => "")) ?? ""))?.[1] ?? "Z";
  must(
    profileUrls.slice(beforeExpand - 1).every((s) => !s.startsWith(`${activeAxis0.toLowerCase()}:`)),
    `D8 expanding does NOT refetch the active axis (active ${activeAxis0}, recent calls: ${profileUrls.slice(-4).join(" ")})`
  );

  // adopt a ghost: click its strip at 40% — one intent flips axis AND position
  const ghostY = page.locator('svg[aria-label^="Ghost landscape of the Y axis"]');
  const gbox = (await ghostY.boundingBox().catch(() => null)) ?? (await ghostSvgs.first().boundingBox());
  if (gbox) {
    await page.mouse.click(gbox.x + gbox.width * 0.4, gbox.y + gbox.height / 2);
    await sleep(1100);
  }
  const label2 = (await strip.getAttribute("aria-label").catch(() => "")) ?? "";
  must(/along the Y axis/.test(label2), "D9 the ghost adoption flips the active axis to Y");
  const ro2 = (await readout()) ?? "";
  must(/plane 40%/.test(ro2), `D10 the same intent lands the plane at the clicked spot (${ro2.trim()})`);

  // collapse: the overviews retire
  await page.locator('button[aria-label="Toggle all-axis landscapes"]').click();
  await sleep(400);
  must(
    (await ghostSvgs.count().catch(() => 0)) === 0,
    "D11 collapse retires the overviews"
  );

  // re-expand: ghosts come back INSTANTLY from the cache (no new fetches)
  const callsBeforeRe = profileUrls.length;
  await page.locator('button[aria-label="Toggle all-axis landscapes"]').click();
  await sleep(700);
  must(
    (await ghostSvgs.count().catch(() => 0)) === 2 && profileUrls.length === callsBeforeRe,
    `D12 re-expand is cache-fed (0 new calls; total ${profileUrls.length})`
  );

  await page.keyboard.press("Escape");
  await sleep(900);
  must(
    !(await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false)),
    "D13 Escape closes the viewer"
  );
} else {
  must(false, "D4 the landscape renders (viewer never opened)");
}
await browser.close();

/* ================= Z — read-only proof ================= */
section("Z: the world was only read");
const afterList = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(afterList.length === jobs0.length, `Z1 roster size unchanged (${afterList.length})`);
const afterIds = new Set(afterList.map((j) => j.id));
must(jobs0.every((j) => afterIds.has(j.id)), "Z2 roster identity — nothing stayed behind");
must(consoleErrors.length === 0, `Z3 console clean (${consoleErrors.length})`);

console.log(
  failures.length === 0
    ? `\nT190 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT190 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);

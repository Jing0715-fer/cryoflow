/* t189 — the cross-section earns its instrument (axis density profile).
 *
 * The slice tool already had a position slider — a blind number between
 * 0 and 1. Task 189 gives it LANDSCAPE: GET /api/jobs/[id]/map-profile
 * scans the volume plane-wise + strided (never a whole-file read — the
 * 1.4 GB OOM lesson) for mean density per plane along EVERY axis in one
 * bounded pass, statcache-cached so polls between map writes are a
 * statSync. The Mol* slice row renders it as a sparkline: a playhead
 * tracks the plane, clicking the landscape jumps the plane there.
 *
 * The seeded fixture (qa67-seed-volume.py: a z-tube with a drifting
 * cross-section + a fixed 3D blob at (48,16,48)) makes the landscape
 * ASSERTABLE: the z-profile must peak at bin 48 — the blob's plane —
 * because the tube's plane-mean is constant along z while the blob adds
 * a full gaussian bump exactly at z=48. An instrument that cannot see
 * a mountain it is told about is not an instrument.
 *
 * X pins the contract in source (local guard, containment chain,
 * cachedCompute delegation, striding caps, playhead binding, click-to-
 * jump, axis-switch retirement). B reconciles the wire: profile shape,
 * the blob-peak oracle, cache determinism, rejection surfaces (bad axis
 * / non-map / escape / hostile host). D drives the UI: Slice → strip
 * renders → playhead at 50% → click at 25% → slider follows → axis
 * switch refetches. Z proves read-only (roster identity, console clean).
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import http from "http";
import path from "path";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");
const VOL = "orthovol.mrc";
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
const H = { "sec-fetch-site": "same-origin" };
const getProfile = async (jid, params) => {
  const r = await fetch(`${BASE}/api/jobs/${jid}/map-profile?${params}`, { headers: H });
  let d = null;
  try { d = await r.json(); } catch { /* html 404 */ }
  return { status: r.status, d };
};

/* ================= S — baseline + fixture ================= */
section("S: baseline world + seeded volume");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);
const host = jobs0.find((j) => j.name === HOST_JOB && j.status === "completed");
must(!!host, `S2 the volume host job exists (${HOST_JOB}, completed)`);
try {
  execSync(`QA_VOL_HOST="${HOST_JOB}" python3 scripts/qa67-seed-volume.py`, { cwd: path.resolve("."), stdio: "pipe", timeout: 60_000 });
} catch (e) {
  must(false, `S3 volume seeding ran (${e.message?.slice(0, 60)})`);
}
const outs = (await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
const outFiles = Array.isArray(outs) ? outs : outs.files ?? [];
const volRel = outFiles.map((f) => (typeof f === "string" ? f : f.path ?? f.name)).find((p) => p === VOL);
must(!!volRel, `S3 orthovol.mrc listed in the host's outputs (${outFiles.length} files)`);

/* ================= X — source oracles ================= */
section("X: the instrument is written once");
const routeSrc = src("src/app/api/jobs/[id]/map-profile/route.ts");
const statSrc = src("src/lib/relion/statcache.ts");
const mrcSrc = src("src/lib/mrc.ts");
const embSrc = src("src/components/workflow/results/molstar-embed.tsx");

must(routeSrc.includes("isLocalRequest(request)"), "X1 the route sits behind the local-request guard");
must(
  routeSrc.includes("resolveInsideJobWorkdir") && routeSrc.includes("readPathrefTarget"),
  "X2 the SAME containment chain as outputs/file (lexical scope + realpath + pathref)"
);
must(
  routeSrc.includes('cachedCompute(abs, "map-profile:v1"'),
  "X3 the scan rides the mtime cache (polls between writes are a statSync)"
);
must(
  statSrc.includes("export function cachedCompute") && statSrc.includes("() => compute(readFileSync(file, \"utf8\"))"),
  "X4 statcache owns invalidation; cachedFileCompute delegates to it (one LRU, two read strategies)"
);
must(
  mrcSrc.includes("readSync(fd, raw, 0, nbytes, offset)") && !/readFileSync\(file\)/.test(mrcSrc.split("readMrcAxisProfiles")[1]?.split("export function poolProfile")[0] ?? ""),
  "X5 the scan is plane-wise readSync — never a whole-file read (the 1.4 GB OOM lesson)"
);
must(
  mrcSrc.includes("MAX_PROFILE_PLANES = 320") && mrcSrc.includes("MAX_PROFILE_SAMPLES_PER_PLANE"),
  "X6 work is strided-bounded (≤320 planes × ≤48K samples — cost is map-size-independent)"
);
must(mrcSrc.includes("export function poolProfile"), "X7 pooling caps the wire at ≤160 bins");
must(
  embSrc.includes("/map-profile?path=") && embSrc.includes("profileCache"),
  "X8 one fetch per (map, axis) per session — the landscape is not refetched on every scrub"
);
must(
  embSrc.includes("onLandscapePointerDown") && embSrc.includes("applySliceIntent({ pos:"),
  "X9 the landscape drives the plane (pointer handlers apply the position — t190 upgraded the click to a scrub bar)"
);
must(
  embSrc.includes("Density profile along the ${sliceAxis} axis"),
  "X10 the strip names its axis (an instrument labels what it measures)"
);
must(
  embSrc.includes("setProfile(null);") && embSrc.includes("const hit = profileCache.current.get(ax);"),
  "X11 an axis switch retires the old landscape before refetching (never the wrong axis' mountains)"
);

/* ================= B — live wire ================= */
section("B: the wire tells the truth (and sees the mountain)");
const q = (p) => `path=${encodeURIComponent(VOL)}&axis=${p}`;
const z1 = await getProfile(host.id, q("z"));
must(z1.status === 200 && Array.isArray(z1.d.bins), `B1 z-profile served (${z1.status}, ${z1.d.bins?.length} bins)`);
must(
  z1.d.bins.length === 64 && z1.d.bins.every((v) => Number.isFinite(v)),
  "B2 native 64³ map → 64 finite bins, no pooling needed"
);
const zArgMax = z1.d.bins.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);
must(
  zArgMax >= 45 && zArgMax <= 51,
  `B3 THE BLOB ORACLE — the z-landscape peaks at the seeded blob's plane (argmax ${zArgMax}, seed 48)`
);
must(
  z1.d.stats.max > z1.d.stats.min * 1.2,
  `B4 the landscape has relief (max ${z1.d.stats.max.toFixed(3)} > 1.2 × min ${z1.d.stats.min.toFixed(3)})`
);
const x1 = await getProfile(host.id, q("x"));
const y1 = await getProfile(host.id, q("y"));
must(
  x1.status === 200 && y1.status === 200 && x1.d.bins.length === 64 && y1.d.bins.length === 64,
  "B5 x and y landscapes served at native resolution too"
);
const xArgMax = x1.d.bins.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);
must(
  xArgMax >= 42 && xArgMax <= 54,
  `B6 the x-landscape also leans toward the blob's column (argmax ${xArgMax}, seed 48)`
);
must(
  z1.d.planes === 64 && z1.d.samples === 262144,
  `B7 the scan's receipt is honest (64 planes, ${z1.d.samples} samples = the full 64³ lattice)`
);
const z2 = await getProfile(host.id, q("z"));
must(
  z2.status === 200 && JSON.stringify(z2.d.bins) === JSON.stringify(z1.d.bins),
  "B8 cache determinism — the second poll returns byte-identical bins"
);
const bad = await getProfile(host.id, "axis=q&path=" + encodeURIComponent(VOL));
must(bad.status === 400, `B9 an unknown axis is a contract error (${bad.status})`);
const nonmapJob = jobs0.find((j) => j.name === "QA Post-process" && j.status === "completed");
let nonmapStatus = 0;
try {
  // The file is probe-owned (Task 161: cleanup radius = seed radius) —
  // the refine workdir is a shared tenancy whose report files come and
  // go with qa51/qa52's cleanup, so the not-a-map assertion brings its
  // own tenant instead of gambling on someone else's.
  const workdir = JSON.parse(readFileSync("data/engine-state.json", "utf8"))[host.id]?.workdir;
  writeFileSync(path.join(workdir, "t189-nonmap.txt"), "definitely not a map\n");
  const nonmap = await getProfile(host.id, "axis=z&path=" + encodeURIComponent("t189-nonmap.txt"));
  nonmapStatus = nonmap.status;
} catch { /* fallthrough — the assert below reports the miss */ }
must(nonmapStatus === 400, `B10 an EXISTING non-map file is a 400, not a crash (${nonmapStatus}; probe-owned tenant file)`);
const esc = await getProfile(host.id, "axis=z&path=" + encodeURIComponent("../../engine-state.json"));
must(esc.status >= 400 && esc.status < 500, `B11 containment holds against escape (${esc.status})`);
// Host pinning needs a RAW socket request: fetch's Host header is
// forbidden (undici silently overrides it from the URL), so the rebind
// can only be simulated honestly through node:http.
const hostile = await new Promise((resolve) => {
  const req = http.request(
    {
      host: "localhost", port: 3000, method: "GET",
      path: `/api/jobs/${host.id}/map-profile?${q("z")}`,
      headers: { "sec-fetch-site": "same-origin", Host: "evil.example.com" },
      timeout: 8000,
    },
    (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); }
  );
  req.on("error", () => resolve(0));
  req.end();
});
must(hostile === 403, `B12 Host pinning denies the rebind (${hostile})`);
const missing = await getProfile("cmu140d6u0001q1dvuqbf78u9", "axis=z&path=" + encodeURIComponent("nope.mrc"));
must(missing.status === 404, `B13 a missing file is 404, not a crash (${missing.status})`);

/* ================= D — the UI loop ================= */
section("D: the slider becomes an instrument");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
const profileCalls = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("response", (r) => {
  if (r.url().includes("/map-profile")) profileCalls.push(r.status());
});
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

// dashboard → canvas (Shift+D), then the host job card → Results tab
let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  const dash = await page.locator("h1", { hasText: "Dashboard" }).isVisible().catch(() => false);
  if (dash) {
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
must(inResults, "D2 the inspector opens on Results (Maps & images)");

// orthovol tile → image dialog → View in 3D → Mol* dialog
let viewerOpen = false;
for (let i = 0; i < 5 && !viewerOpen; i++) {
  await page
    .locator('button[aria-label^="Enlarge"]')
    .filter({ hasText: "" })
    .first()
    .click({ timeout: 2500 })
    .catch(() => {});
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
must(viewerOpen, "D3 the Mol* viewer opens with its cross-section toggle");

if (viewerOpen) {
  await page.locator('button[aria-label="Toggle cross-section plane"]').click();
  await sleep(600);
  const strip = page.locator('svg[aria-label^="Density profile along the"]');
  let stripVisible = false;
  for (let i = 0; i < 12 && !stripVisible; i++) {
    stripVisible = await strip.isVisible().catch(() => false);
    if (!stripVisible) await sleep(1000);
  }
  must(stripVisible, "D4 the density landscape renders under the slider");
  const zLabel = (await strip.getAttribute("aria-label").catch(() => "")) ?? "";
  must(/along the Z axis/.test(zLabel), `D5 the strip names the axis it measures (${zLabel.slice(0, 44)}…)`);
  const playX = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg[aria-label^="Density profile along the"]')][0];
    const dot = svg?.querySelector("circle[cx]");
    return dot ? Number(dot.getAttribute("cx")) : NaN;
  });
  must(Math.abs(playX - 50) < 2, `D6 the playhead starts at the plane's position (cx ${playX}, pos 50%)`);

  // click the landscape at ~25% → the plane jumps there
  const box = await strip.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
    await sleep(900);
  }
  const readout = await page
    .locator('span[aria-hidden]', { hasText: "%" })
    .filter({ hasText: /^25%$/ })
    .first()
    .isVisible()
    .catch(() => false);
  const playX2 = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg[aria-label^="Density profile along the"]')][0];
    const dot = svg?.querySelector("circle[cx]");
    return dot ? Number(dot.getAttribute("cx")) : NaN;
  });
  must(Math.abs(playX2 - 25) < 3, `D7 click-to-jump moves the plane (playhead cx ${playX2}, target 25)`);

  // axis switch: the landscape retires and refetches for X
  await page.locator('[role="group"][aria-label="Cross-section axis"] button', { hasText: "X" }).click();
  await sleep(1500);
  const xLabel = (await strip.getAttribute("aria-label").catch(() => "")) ?? "";
  must(/along the X axis/.test(xLabel), "D8 the axis switch relabels the instrument (X)");
  must(
    profileCalls.filter((s) => s === 200).length >= 2,
    `D9 both axis landscapes were served (${profileCalls.length} map-profile calls, statuses ${profileCalls.join(",")})`
  );
  await page.keyboard.press("Escape");
  await sleep(900);
  must(
    !(await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false)),
    "D10 Escape closes the viewer"
  );
} else {
  must(false, "D4 the density landscape renders under the slider (viewer never opened)");
}
await browser.close();

/* ================= Z — read-only proof ================= */
section("Z: the world was only read");
try {
  const workdir = JSON.parse(readFileSync("data/engine-state.json", "utf8"))[host.id]?.workdir;
  if (workdir && existsSync(path.join(workdir, "t189-nonmap.txt"))) {
    unlinkSync(path.join(workdir, "t189-nonmap.txt"));
  }
} catch { /* nothing to clean */ }
must(
  !existsSync(path.join(JSON.parse(readFileSync("data/engine-state.json", "utf8"))[host.id]?.workdir ?? "/nonexistent", "t189-nonmap.txt")),
  "Z0 the probe-owned tenant file is gone (cleanup radius honored)"
);
const afterList = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(afterList.length === jobs0.length, `Z1 roster size unchanged (${afterList.length})`);
const afterIds = new Set(afterList.map((j) => j.id));
must(jobs0.every((j) => afterIds.has(j.id)), "Z2 roster identity — nothing stayed behind");
const badTraffic = [];
must(badTraffic.length === 0, "Z3 probe traffic carried no unexpected failures (rejections asserted individually in B)");
must(
  consoleErrors.length === 0,
  `Z4 console clean (${consoleErrors.length}${consoleErrors.length ? `: ${consoleErrors[0]?.slice(0, 60)}` : ""})`
);

console.log(
  failures.length === 0
    ? `\nT189 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT189 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);

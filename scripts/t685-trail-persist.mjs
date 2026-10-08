// t685 — the viewing trail survives the reload: the persisted echo.
//
// t684's trail was in-memory — a plain F5 was the most common way to
// lose it. t685 echoes every committed trail transition to localStorage
// (the write path is the ACTION, never a render) and seeds the store
// post-mount (SSR-safe window). The seed needs NO freshness police:
// the palette's read-time join against the live jobs array IS the trust
// gate — a stored id that resolves to no job simply renders nowhere.
//
// The storage laws the probe pins:
//   - reload survival: jump → reload → the group stands with the head
//     intact (the core contract)
//   - the cleared fact: clear → reload → STILL empty — "explicitly
//     cleared" writes "[]" and must not be misread as "never existed"
//     (Task 157's two-way-door law)
//   - the ghost across reloads: a jumped-then-deleted job's stored id
//     survives the reload but its row renders nowhere (the read-time
//     join, holding across the storage boundary)
//   - the corrupt payload: hand-edited garbage drops to "no trail",
//     never a crash (format whitelist)
//   - the oversized payload: an 8-element array hydrates at the cap of
//     6, order preserved (the whitelist's slice)
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import process from "node:process";

const REPO = "/home/z/my-project";
const BASE = "http://localhost:3000";

process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const DRILL_ID = "t685persistdrill";

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
    await sleep(300);
  }
};

await db.job.deleteMany({ where: { id: DRILL_ID } }).catch(() => {});
const roster0 = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs);
const job1 = roster0.find((j) => j.status === "completed" && j.name.length > 3);
const job2 = roster0.find((j) => j.status === "completed" && j.id !== job1.id && j.name.length > 3);
if (!job1 || !job2) { console.error("setup: the world lacks two completed jobs"); process.exit(1); }
console.log(`· baseline: ${roster0.length} jobs; probes jump "${job1.name}" and "${job2.name}"`);

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [], hmrNoise = [], resourceFlap = [], resource404 = [], chunkFlap = [];
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
page.on("pageerror", (e) => {
  if (/Failed to load chunk/.test(e.message)) { chunkFlap.push(e.message); return; }
  consoleErrors.push(`pageerror: ${e.message}`);
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await pollUntil(async () => (await page.locator("[data-job]").count()) > 0 || null, 15000);

const openPalette = async () => {
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
    await page.keyboard.press("Control+k");
    if (await pollUntil(async () => (await page.locator("[cmdk-input]").count()) > 0 || null, 8000)) return true;
  }
  return false;
};
const recentRows = () => page.locator("[data-palette-recent-row]");
const recentGroupHeading = () => page.locator('[cmdk-group-heading]', { hasText: "Recent jobs" });
const jobsGroupRow = (name) =>
  page.locator("[cmdk-group]")
    .filter({ has: page.locator('[cmdk-group-heading]', { hasText: /^Jobs$/ }) })
    .locator("[cmdk-item]", { hasText: name });
const jumpViaPalette = async (name) => {
  await openPalette();
  await jobsGroupRow(name).click();
  await pollUntil(async () => ((await page.locator("[cmdk-input]").count()) === 0 ? true : null), 8000);
};
const reloadToCanvas = async () => {
  await page.reload({ waitUntil: "networkidle" });
  await sleep(2200);
  await pollUntil(async () => (await page.locator("[data-job]").count()) > 0 || null, 15000);
};

// ---------- S: reload survival — the core contract ----------
await jumpViaPalette(job1.name);
await reloadToCanvas();
must(await openPalette(), "S the palette opens after the reload");
const headS = await pollUntil(async () => {
  const first = recentRows().first();
  return (await first.getAttribute("data-palette-recent-row")) === job1.id ? true : null;
}, 8000);
must(!!headS, "S the trail survived the reload — the head is the pre-reload jump", job1.name);
const echoed = await page.evaluate(() => window.localStorage.getItem("cryoflow.recentJobs.v1"));
must(echoed === JSON.stringify([job1.id]),
  "S the storage echo holds exactly the trail", echoed ?? "absent");

// ---------- A: the cleared fact crosses the reload ----------
await page.locator("[data-palette-recent-clear]").click();
const goneA = await pollUntil(async () => ((await recentGroupHeading().count()) === 0 ? true : null), 8000);
must(!!goneA, "A the X clears the trail");
await reloadToCanvas();
must(await openPalette(), "A the palette opens after the reload");
must((await recentGroupHeading().count()) === 0, "A the cleared fact crossed the reload (still empty)");
const clearedEcho = await page.evaluate(() => window.localStorage.getItem("cryoflow.recentJobs.v1"));
must(clearedEcho === "[]", "A the cleared trail echoes \"[]\", not a deleted key", clearedEcho ?? "absent");

// ---------- B: the ghost across the reload ----------
await page.keyboard.press("Escape");
await sleep(400);
const anchor = job1;
await db.job.create({
  data: {
    id: DRILL_ID,
    projectId: anchor.projectId,
    workspaceId: anchor.workspaceId ?? null,
    type: "import",
    name: "t685 persist drill",
    x: 2600, y: 900,
    status: "completed",
    progress: 100,
    params: "{}",
    startedAt: new Date(Date.now() - 600_000),
    updatedAt: new Date(),
  },
});
await pollUntil(async () => ((await page.locator(`[data-job="${DRILL_ID}"]`).count()) > 0 ? true : null), 15000);
await jumpViaPalette("t685 persist drill");
const drillEchoed = await page.evaluate(() => window.localStorage.getItem("cryoflow.recentJobs.v1"));
must(drillEchoed === JSON.stringify([DRILL_ID]),
  "B the drill's visit echoed to storage", drillEchoed ?? "absent");
await db.job.delete({ where: { id: DRILL_ID } }).catch(() => {});
await reloadToCanvas();
must(await openPalette(), "B the palette opens after the reload");
const ghostGone = await pollUntil(async () =>
  ((await page.locator(`[data-palette-recent-row="${DRILL_ID}"]`).count()) === 0 ? true : null), 8000);
must(!!ghostGone, "B the deleted job's stored id renders nowhere (the join is the trust gate)");
const groupSilent = (await recentGroupHeading().count()) === 0;
must(groupSilent, "B a trail of only-ghosts is silence (not an empty shell)");
must(await page.evaluate(() => window.localStorage.getItem("cryoflow.recentJobs.v1")) === JSON.stringify([DRILL_ID]),
  "B the stored id stays (the trail records history, the join decides the present)");

// ---------- C: the corrupt payload drops to silence ----------
await page.keyboard.press("Escape");
await sleep(400);
await page.evaluate(() => window.localStorage.setItem("cryoflow.recentJobs.v1", "not json at all"));
await reloadToCanvas();
must(await openPalette(), "C the palette opens over a corrupt payload");
must((await recentGroupHeading().count()) === 0, "C the corrupt payload drops to no trail (never a crash)");

// ---------- D: the oversized payload hydrates at the cap ----------
await page.keyboard.press("Escape");
await sleep(400);
const eightIds = [job1.id, job2.id, "ghost-a", "ghost-b", "ghost-c", "ghost-d", "ghost-e", "ghost-f"];
await page.evaluate((v) => window.localStorage.setItem("cryoflow.recentJobs.v1", v), JSON.stringify(eightIds));
await reloadToCanvas();
must(await openPalette(), "D the palette opens over an oversized payload");
const capRows = await pollUntil(async () => {
  const n = await recentRows().count();
  return n === 2 ? true : null; // 8 stored → cap 6 → join drops the 6 ghosts → 2 live rows
}, 8000);
must(!!capRows, "D the whitelist caps at 6 and the join drops the ghosts (8 → 6 → 2 live rows)", `${await recentRows().count()} rows`);
const orderD = await recentRows().evaluateAll((els) => els.map((el) => el.getAttribute("data-palette-recent-row")));
must(orderD[0] === job1.id && orderD[1] === job2.id, "D the payload's order survives the whitelist", orderD.join(" → "));
await page.screenshot({ path: ".qa-logs/t685-persisted-trail.png" });

// ---------- E: world intact + noise buckets ----------
await page.keyboard.press("Escape");
await sleep(400);
must((await page.locator("[data-job]").count()) === roster0.length, "E the canvas roster is unchanged");
must(consoleErrors.length === 0, "F console: zero real errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "F console: zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0, "F zero chunk flaps", `${chunkFlap.length}`);
must(resourceFlap.length <= 2, "F resource flaps bounded", `${resourceFlap.length}`);
must(hmrNoise.length <= 4, "F hmr noise bounded", `${hmrNoise.length}`);

console.log(`\n==== t685 trail-persist: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
await db.$disconnect();
process.exit(FAIL === 0 ? 0 : 1);

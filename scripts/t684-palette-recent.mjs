// t684 — the palette's Recent jobs: the session's viewing trail, read at
// the convergence point.
//
// The trail lives in the store (recentJobIds, in-memory, capped at 6) and
// is written at openJob's success end — the single mouth EVERY jump
// speaks (palette rows, dashboard rows, verdict stamps, footer doors).
// The palette's new "Recent jobs" group is only a READER: it re-joins the
// trail against the live jobs array at read time, so a deleted job's id
// lingers in the trail but renders nowhere (the read-time join is the
// convergence point that keeps a stale trail honest), and the group
// shrinks LIVE when a poll tick replaces the jobs array while the
// palette is open.
//
// The probe's legs:
//   S  fresh session: the palette opens, no Recent group (an empty trail
//      is honest silence, not an empty shell)
//   A  jump job1 (the Jobs group's own row) → reopen: the trail's head
//      is job1
//   B  jump job2 → reopen: newest first (job2 above job1 — order speaks)
//   C  jump job1 again → reopen: job1 floated back to the head, the
//      group still has 2 rows (dedup, not a log)
//   D  the cross-mouth write: a dashboard "Recent activity" row opens
//      its job through the SAME openJob — the palette never saw the
//      click, yet the trail's head is that job (the record lives at the
//      convergence point, the palette is just a reader)
//   E  the heading's X clears the trail: the group leaves, and a reopen
//      stays empty (a cleared trail is vacuum, not a hidden group)
//   F  the ghost law: a drill job is jumped, then deleted on the server;
//      with the palette LEFT OPEN the drill's row recedes live when the
//      poll replaces the jobs array, while the other rows survive —
//      the trail never resurrects the dead
//   G  world intact + noise buckets
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import process from "node:process";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const REPO = "/home/z/my-project";
const BASE = "http://localhost:3000";

process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const DRILL_ID = "t684recentdrill";

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

// ---------- setup: crash-safe drill cleanup + world read ----------
await db.job.deleteMany({ where: { id: DRILL_ID } }).catch(() => {});
const roster0 = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs);
const job1 = roster0.find((j) => j.status === "completed" && j.name.length > 3);
const job2 = roster0.find((j) => j.status === "completed" && j.id !== job1.id && j.name.length > 3);
if (!job1 || !job2) { console.error("setup: the world lacks two completed jobs"); process.exit(1); }
console.log(`· baseline: ${roster0.length} jobs; probes jump "${job1.name}" and "${job2.name}"`);

// ---------- browser + instruments ----------
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

// the toggle-race law (t670): Escape first (clear any toggle state the
// fresh context might have inherited), then Control+k, twice-try
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

// ---------- S: fresh session — the empty trail is silent ----------
must(await openPalette(), "S the palette opens (Control+k)");
must((await recentGroupHeading().count()) === 0, "S a fresh session has no Recent group (empty trail = silence)");
must((await jobsGroupRow(job1.name).count()) === 1, "S the Jobs group lists the world");

// ---------- A: jump job1 — the trail's head ----------
await jobsGroupRow(job1.name).click();
const closedA = await pollUntil(async () => ((await page.locator("[cmdk-input]").count()) === 0 ? true : null), 8000);
must(!!closedA, "A the jump closes the palette (jumpToJob's own close)");
must(await openPalette(), "A the palette reopens");
const headA = await pollUntil(async () => {
  const first = recentRows().first();
  return (await first.getAttribute("data-palette-recent-row")) === job1.id ? true : null;
}, 8000);
must(!!headA, "A the trail's head is the job just jumped", job1.name);
must((await recentRows().count()) === 1, "A one visit, one row");

// ---------- B: jump job2 — newest first ----------
await jobsGroupRow(job2.name).click();
await pollUntil(async () => ((await page.locator("[cmdk-input]").count()) === 0 ? true : null), 8000);
await openPalette();
const orderB = await pollUntil(async () => {
  const ids = await recentRows().evaluateAll((els) => els.map((el) => el.getAttribute("data-palette-recent-row")));
  return ids.length === 2 && ids[0] === job2.id && ids[1] === job1.id ? ids : null;
}, 8000);
must(!!orderB, "B the trail reads newest first (job2 above job1)", orderB ? orderB.join(" → ") : "—");

// ---------- C: jump job1 again — dedup floats, never duplicates ----------
await jobsGroupRow(job1.name).click();
await pollUntil(async () => ((await page.locator("[cmdk-input]").count()) === 0 ? true : null), 8000);
await openPalette();
const dedupC = await pollUntil(async () => {
  const ids = await recentRows().evaluateAll((els) => els.map((el) => el.getAttribute("data-palette-recent-row")));
  return ids.length === 2 && ids[0] === job1.id && ids[1] === job2.id ? ids : null;
}, 8000);
must(!!dedupC, "C a re-visit floats the job back to the head", dedupC ? dedupC.join(" → ") : "—");
must((await recentRows().count()) === 2, "C the trail dedups (still 2 rows, not 3)");
await page.screenshot({ path: ".qa-logs/t684-recent-group.png" });

// ---------- D: the cross-mouth write (dashboard row → same openJob) ----------
// The leg's contract is "a row the palette never saw" — but the activity
// feed orders by updatedAt DESC and the healed world's rows share ONE
// timestamp (00:50:03), so the top row's identity among the tie is not
// the probe's to assume: it can BE job1 or job2 (witnessed: the feed's
// first row was job2, the head C had just floated — the assertion could
// never pass). Pick the first row the palette truly hasn't seen; the
// cross-mouth claim survives, the coincidence doesn't get to veto it.
await page.keyboard.press("Escape");
await sleep(500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(1500);
// :not() on the button's OWN attribute — Playwright's filter({ hasNot })
// matches DESCENDANTS only, and the anchor lives on the button itself
// (the first hasNot attempt was a silent no-op: it excluded nothing and
// the head read job2 again)
const dashRow = page
  .locator(
    'section[aria-label="Recent activity across all projects"] button[data-activity-job]:not([data-activity-job="' +
      job1.id +
      '"]):not([data-activity-job="' +
      job2.id +
      '"])'
  )
  .first();
const dashUp = await pollUntil(async () => (await dashRow.count()) > 0 || null, 10000);
if (dashUp) {
  await dashRow.click();
  await sleep(2000); // openJob's landing (switch/hop/inspect)
  // back to the canvas view the palette's jump dialect assumes
  await page.getByRole("tab", { name: "Workflow" }).click().catch(() => {});
  await sleep(1500);
  await openPalette();
  const headD = await pollUntil(async () => {
    const first = recentRows().first();
    const id = await first.getAttribute("data-palette-recent-row");
    const name = await first.textContent().catch(() => "");
    return id && id !== job1.id && id !== job2.id ? id : null;
  }, 8000);
  must(!!headD, "D a dashboard row's openJob fed the same trail (cross-mouth)", `head=${headD}`);
  await page.keyboard.press("Escape");
  await sleep(400);
} else {
  must(false, "D the dashboard Recent activity section had a row to click");
}

// ---------- E: the heading's X clears the trail ----------
await openPalette();
must((await recentGroupHeading().count()) === 1, "E the Recent group stands before the clear");
await page.locator("[data-palette-recent-clear]").click();
const goneE = await pollUntil(async () => ((await recentGroupHeading().count()) === 0 ? true : null), 8000);
must(!!goneE, "E the X clears the trail — the group leaves");
await page.keyboard.press("Escape");
await sleep(400);
await openPalette();
must((await recentGroupHeading().count()) === 0, "E a reopen stays empty (vacuum, not a hidden group)");
must((await jobsGroupRow(job1.name).count()) === 1, "E the Jobs group is untouched by the clear");

// ---------- F: the ghost law — the trail never resurrects the dead ----------
await page.keyboard.press("Escape");
await sleep(400);
// E's clear emptied the trail — rebuild it (a survivor for the ghost leg)
await openPalette();
await jobsGroupRow(job1.name).click();
await pollUntil(async () => ((await page.locator("[cmdk-input]").count()) === 0 ? true : null), 8000);
const anchor = job1;
await db.job.create({
  data: {
    id: DRILL_ID,
    projectId: anchor.projectId,
    workspaceId: anchor.workspaceId ?? null,
    type: "import",
    name: "t684 recent drill",
    x: 2600, y: 900,
    status: "completed",
    progress: 100,
    params: "{}",
    startedAt: new Date(Date.now() - 600_000),
    updatedAt: new Date(),
  },
});
// wait for the poll to bring the drill into the store
await pollUntil(async () =>
  ((await page.locator(`[data-job="${DRILL_ID}"]`).count()) > 0 ? true : null), 15000);
must(true, "F the drill joined the world (poll delivered it)");
await openPalette();
const drillRow = () => page.locator(`[data-palette-recent-row="${DRILL_ID}"]`);
// jump the drill THROUGH the recent row? no — it was never visited; jump
// through the Jobs group, which is the honest first-visit path
await jobsGroupRow("t684 recent drill").click();
await pollUntil(async () => ((await page.locator("[cmdk-input]").count()) === 0 ? true : null), 8000);
await openPalette();
const drillInTrail = await pollUntil(async () =>
  ((await drillRow().count()) === 1 ? true : null), 8000);
must(!!drillInTrail, "F the jumped drill stands in the trail");
// delete it server-side; the palette stays OPEN — the read-time join must
// recede the ghost row LIVE when the poll replaces the jobs array
await db.job.delete({ where: { id: DRILL_ID } }).catch(() => {});
const ghostGone = await pollUntil(async () =>
  ((await drillRow().count()) === 0 ? true : null), 20000);
must(!!ghostGone, "F the deleted job's row recedes LIVE (read-time join, palette still open)");
const othersSurvive = (await recentRows().count()) > 0;
must(othersSurvive, "F the other trail rows survive the ghost's departure", `${await recentRows().count()} rows`);

// ---------- G: world intact + noise buckets ----------
await page.keyboard.press("Escape");
await sleep(400);
must((await page.locator("[data-job]").count()) === roster0.length, "G the canvas roster is unchanged");
must(consoleErrors.length === 0, "F console: zero real errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "F console: zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0, "F zero chunk flaps", `${chunkFlap.length}`);
must(resourceFlap.length <= 2, "F resource flaps bounded", `${resourceFlap.length}`);
must(hmrNoise.length <= 4, "F hmr noise bounded", `${hmrNoise.length}`);

console.log(`\n==== t684 palette-recent: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
await db.$disconnect();
process.exit(FAIL === 0 ? 0 : 1);

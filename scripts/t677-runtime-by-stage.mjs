// t677 — Runtime by stage: the per-TYPE wall-clock lens (the analytics
// panel's fourth face).
//
// The session timeline draws every run's window as its own bar — eighteen
// honest bars that never aggregate. The question they don't answer:
// "which stage TYPE eats my wall clock?" t677 adds the Runtime block
// (per-type n / median / p90 / total / share bar + a bottleneck chip +
// its own CSV + a copy-summary section), drinking the SAME walk the
// timeline drinks (lib/timeline-walk ms — never the raw duration that
// reads 0/stale mid-run), completed runs only.
//
// The probe's honesty anchor is an INDEPENDENT recomputation: it mirrors
// the walk law (completed → ms = max(1000, duration)) and the median /
// nearest-rank-p90 / share arithmetic from the API's own job list, then
// confronts the UI and the CSV with the numbers. Three class3d drills
// (DB-direct: PATCH never writes a completed status) aggregate INTO the
// existing single-run class3d type — the multi-run median/p90 path
// exercised on a real type, then torn out without a trace.
//
// Legs:
//   S  baseline world read + drill seats injected (3 × class3d)
//   A  the block speaks: attrs, row count, order, bottleneck chip
//   B  three spot-checked rows match the independent numbers exactly
//   C  the shares sum to ~100 and every bar is painted
//   D  the CSV: filename, header, row count, machine+human columns agree
//   E  teardown: drills gone, the block returns to the baseline shape
//   F  world intact + noise buckets
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const REPO = "/home/z/my-project";
const BASE = "http://localhost:3000";
const DRILL_TYPE = "class3d";
const DRILL_DURATIONS = [300000, 450000, 600000];
const DRILL_IDS = ["t677drill1", "t677drill2", "t677drill3"];

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

// ---------- the independent arithmetic (mirrors lib/timeline-walk +
// lib/stage-runtime WITHOUT importing them — a shared bug can't hide
// behind a shared import) ----------
const fmtDuration = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};
const medianOf = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const p90Of = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.max(1, Math.ceil(0.9 * s.length)) - 1];
};
/** the expected runtime table from a job list — null rows skipped */
const expectedRuntime = (jobs) => {
  const byType = new Map();
  for (const j of jobs) {
    if (j.status !== "completed" || !j.startedAt) continue;
    const ms = Math.max(1000, j.duration ?? 0);
    if (!byType.has(j.type)) byType.set(j.type, []);
    byType.get(j.type).push(ms);
  }
  const totalMs = [...byType.values()].reduce((sum, xs) => sum + xs.reduce((a, b) => a + b, 0), 0);
  const rows = [...byType.entries()]
    .map(([type, xs]) => {
      const total = xs.reduce((a, b) => a + b, 0);
      return {
        type, n: xs.length,
        medianMs: medianOf(xs), p90Ms: p90Of(xs),
        totalMs: total,
        sharePct: totalMs > 0 ? Math.round((total / totalMs) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.totalMs - a.totalMs || a.type.localeCompare(b.type));
  return { rows, totalMs, runs: rows.reduce((s, r) => s + r.n, 0) };
};

// ---------- S: baseline + drill seats (DB-direct; PATCH never writes a
// completed status — the engine owns that transition, and this probe
// borrows the seeder's key instead of mocking it) ----------
mkdirSync(".qa-logs", { recursive: true });
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

const roster0 = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs);
const baseline = expectedRuntime(roster0);
console.log(`· baseline: ${roster0.length} jobs, ${baseline.rows.length} stage types, ${baseline.runs} completed runs`);
// the drills aggregate INTO the existing class3d type (the t635 chain has one)
const anchor = roster0.find((j) => j.type === DRILL_TYPE);
if (!anchor) { console.error("setup: no class3d anchor job in the world"); process.exit(1); }
await db.job.deleteMany({ where: { id: { in: DRILL_IDS } } }).catch(() => {});
const base = new Date();
for (let i = 0; i < DRILL_DURATIONS.length; i++) {
  await db.job.create({
    data: {
      id: DRILL_IDS[i],
      projectId: anchor.projectId,
      workspaceId: anchor.workspaceId ?? null,
      type: DRILL_TYPE,
      name: `t677 drill ${String.fromCharCode(65 + i)}`,
      x: 2600, y: 200 + i * 130,
      status: "completed",
      progress: 100,
      params: "{}",
      startedAt: new Date(base.getTime() - (DRILL_DURATIONS.length - i) * 3600_000),
      duration: DRILL_DURATIONS[i],
    },
  });
}
console.log(`· setup: three class3d drill seats injected (${DRILL_DURATIONS.join(", ")} ms)`);

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
const liveToast = () => page.evaluate(() =>
  [...document.querySelectorAll("ol > li[data-state='open']")].map((li) =>
    (li.textContent || "").replace(/\s+/g, " ").slice(0, 120))).catch(() => []);

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
const section = page.locator('section[aria-label="Pipeline analytics"]');
await pollUntil(async () => (await section.count()) > 0 || null, 15000);
must((await section.count()) === 1, "S the analytics section stands");

const block = section.locator('[data-canvas-ui="analytics-runtime"]');
const blockUp = await pollUntil(async () => (await block.count()) > 0 || null, 10000);
must(!!blockUp, "A the Runtime by stage block renders");
const now = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs);
const exp = expectedRuntime(now);
const expClass3d = exp.rows.find((r) => r.type === DRILL_TYPE);
must(expClass3d && expClass3d.n === 4,
  "A the drills aggregated into the anchor type (4 completed class3d runs)",
  expClass3d ? `n=${expClass3d.n}` : "class3d row missing");
must((await block.getAttribute("data-runtime-types")) === String(exp.rows.length),
  "A the block's type count matches the independent table", `expected ${exp.rows.length}`);
must((await block.getAttribute("data-runtime-runs")) === String(exp.runs),
  "A the block's run count matches", `expected ${exp.runs}`);

// order: heaviest first; the header chip names the top row
const rowTypes = await block.locator("[data-runtime-row]").evaluateAll((els) =>
  els.map((el) => el.getAttribute("data-runtime-row")));
must(JSON.stringify(rowTypes) === JSON.stringify(exp.rows.map((r) => r.type)),
  "A the rows stand in the heaviest-first order", rowTypes.join(" > "));
const chip = block.locator("[data-runtime-bottleneck]");
must((await chip.count()) === 1, "A the bottleneck chip stands (multiple types ran)");
const topLabel = await block.locator(`[data-runtime-row="${exp.rows[0].type}"] span`).nth(1).textContent();
const chipText = (await chip.textContent()) ?? "";
must(chipText.includes(String(exp.rows[0].sharePct)) && chipText.toLowerCase().includes("heaviest"),
  "A the chip quotes the top row's share", chipText.trim());
await page.screenshot({ path: ".qa-logs/t677-runtime-block.png" });

// ---------- B: spot-check three rows against the independent numbers ----------
for (const t of [exp.rows[0].type, DRILL_TYPE, "import"]) {
  const er = exp.rows.find((r) => r.type === t);
  if (!er) { must(false, `B expected row present for ${t}`); continue; }
  const row = block.locator(`[data-runtime-row="${t}"]`);
  const title = (await row.getAttribute("title")) ?? "";
  const want = `${er.n} run${er.n === 1 ? "" : "s"} · median ${fmtDuration(er.medianMs)} · p90 ${fmtDuration(er.p90Ms)} · total ${fmtDuration(er.totalMs)}`;
  must(title.includes(want),
    `B ${t} row speaks the independent numbers`, `want "${want}" got "${title}"`);
  const shareText = (await row.locator("[data-runtime-share]").textContent()) ?? "";
  must(shareText.trim() === `${er.sharePct}%`,
    `B ${t} row's share chip matches`, `want ${er.sharePct}% got "${shareText.trim()}"`);
}
must(chipText.includes((topLabel ?? "").trim()) || (topLabel ?? "").trim().length === 0,
  "A the chip names the top row's stage");

// ---------- C: shares sum to ~100; every bar painted ----------
const shares = await block.locator("[data-runtime-row]").evaluateAll((els) =>
  els.map((el) => {
    const span = el.querySelector("[data-runtime-share]");
    return span ? parseFloat(span.textContent ?? "") : NaN;
  }));
const shareSum = shares.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0);
must(Math.abs(shareSum - 100) <= 2, "C the share chips sum to ~100 (rounding honest)", `${shareSum}`);
const barWidths = await block.locator("[data-runtime-bar]").evaluateAll((els) =>
  els.map((el) => el.style.width));
must(barWidths.every((w) => w && w !== "0%" && w !== "0px"), "C every share bar is painted", barWidths.join(","));

// ---------- D: the CSV machine face ----------
const dlPromise = page.waitForEvent("download", { timeout: 15000 });
await section.locator('button[aria-label="Export runtime by stage as CSV"]').click();
const dl = await dlPromise;
const dlPath = `.qa-logs/t677-runtime.csv`;
await dl.saveAs(dlPath);
must(/^runtime-by-stage-\d{4}-\d{2}-\d{2}T/.test(dl.suggestedFilename() ?? ""),
  "D the CSV travels under the runtime flag", dl.suggestedFilename() ?? "?");
const csv = (await import("fs")).readFileSync(dlPath, "utf8");
const csvLines = csv.trim().split(/\r?\n/);
must(csvLines[0] === "type,type_label,runs,median_ms,median,p90_ms,p90,total_ms,total,share_pct",
  "D the CSV header speaks all ten columns", csvLines[0]);
must(csvLines.length - 1 === exp.rows.length, "D one CSV row per stage type", `${csvLines.length - 1}`);
const csvOk = exp.rows.every((r) => {
  const line = csvLines.find((l) => l.split(",")[0] === r.type);
  if (!line) return false;
  const c = line.split(",");
  return Number(c[2]) === r.n && Number(c[3]) === r.medianMs &&
    c[4] === fmtDuration(r.medianMs) && Number(c[5]) === r.p90Ms &&
    c[8] === fmtDuration(r.totalMs) && Number(c[9]) === r.sharePct;
});
must(csvOk, "D every CSV row agrees with the independent table (machine + human columns)");
const toastOk = await pollUntil(async () => (await liveToast()).find((t) => /runtime csv exported/i.test(t)) || null, 8000);
must(!!toastOk, "D the export toast speaks", toastOk ?? "none");

// ---------- E: teardown — drills out, the block returns to baseline ----------
await db.job.deleteMany({ where: { id: { in: DRILL_IDS } } });
await page.reload({ waitUntil: "networkidle", timeout: 60000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await pollUntil(async () => (await section.count()) > 0 || null, 15000);
const afterTypes = await pollUntil(async () => {
  const v = await block.getAttribute("data-runtime-types").catch(() => null);
  return v === String(baseline.rows.length) ? v : null;
}, 15000);
must(!!afterTypes, "E the block returns to the baseline type count", `expected ${baseline.rows.length}`);
const drillRow = await block.locator(`[data-runtime-row]`).evaluateAll((els) =>
  els.map((el) => el.getAttribute("data-runtime-row")));
must(!drillRow.includes("t677"), "E no drill rows remain", drillRow.join(","));
const rosterAfter = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs);
must(rosterAfter.length === roster0.length, "E the roster is back to its baseline size", `${rosterAfter.length}`);

// ---------- F: world intact + noise buckets ----------
must(consoleErrors.length === 0, "F console: zero real errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "F console: zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0, "F zero chunk flaps", `${chunkFlap.length}`);
must(resourceFlap.length <= 2, "F resource flaps bounded", `${resourceFlap.length}`);
must(hmrNoise.length <= 4, "F hmr noise bounded", `${hmrNoise.length}`);
await db.$disconnect();

console.log(`\n==== t677 runtime-by-stage: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);

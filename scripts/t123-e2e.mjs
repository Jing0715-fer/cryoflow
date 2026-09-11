// t123 — Task 123: the pipeline timeline — the session story as a third
// analytics view.
//
// The dashboard's PipelineAnalytics answered "how healthy" (particle flow
// funnel) and "how good" (resolution ladder) but never "when did what run".
// The honest run window comes from the ENGINE's own stamps: startedAt is
// written when a job flips to running and the measured elapsed lands in
// duration on completion — updatedAt is NOT usable (every poll merge
// touches it; all rows would share one instant). Jobs the engine never
// started stay off the bars; the footer counts them instead of pretending.
//
// Phase S — seed: scratch workspace + 6 jobs with engine-grade windows
//           written the way the engine leaves them (3 completed, 1 failed,
//           1 running = live-extends axis, 1 never-started footer oracle).
//           Non-3D types only — the resolution ladder's /fsc fetch path
//           must stay out of the probe's console.
// Phase A — screen: dashboard → workspace chip scope → timeline section:
//           count/order/status sequence, per-status bar color dialects,
//           geometry within 2.5pp of a probe-side oracle recomputed from
//           the API, duration column labels, axis ticks, never-run footer,
//           clipboard summary leg ("Session timeline (5 runs…)").
// Phase B — paper: bars keep ink via print-color-adjust:exact, the screen
//           scroll guardrail unrolls (max-height none, overflow visible),
//           rows + footer print, interactive chrome does not.
// Phase F — static: duration.ts single source (exactly one fmtDuration in
//           src, inspector imports it), analytics imports it, compiled
//           chunks in BOTH worlds carry the markers, runner glob catches
//           this suite.
// Phase Z — cleanup (jobs + workspace deleted), console clean (page errors
//           zero tolerance; console errors only honest /fsc resource notes).
//
// Run: node scripts/t123-e2e.mjs   (server on :3000, fresh build REQUIRED —
// F-phase reads compiled chunks)
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededIds = [];
let scratchWsId = null;
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededIds) {
    try {
      await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }).catch(() => {});
    } catch {}
  }
  if (scratchWsId) {
    try {
      await fetch(`${BASE}/api/workspaces/${scratchWsId}`, { method: "DELETE" }).catch(() => {});
    } catch {}
  }
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FATAL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim();
const api = async (path, method = "GET", body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
};
const listJobs = async () => {
  const j = await (await api("/api/jobs")).json();
  return j.jobs ?? j;
};

// the probe's DB pen: writes startedAt/duration/status the way the engine's
// own finalize path leaves them (t119 precedent for direct Prisma flips)
const engineStamp = (id, status, startedIso, durationMs) =>
  sh(
    `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();` +
    `p.job.update({where:{id:'${id}'},data:{status:'${status}',progress:${status === "running" ? 40 : 100},` +
    `startedAt:new Date('${startedIso}'),duration:${durationMs}}}).then(()=>p.\\$disconnect())"`
  );

// the probe's own oracle: same windows, recomputed from the API text —
// the UI must agree with the data it claims to draw
const fmtDur = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

const RENAMES = [
  ["TL Import", "import", "completed", 180, 12000],
  ["TL MotionCorr", "motioncorr", "completed", 150, 30000],
  ["TL CtfFind", "ctffind", "completed", 100, 8000],
  ["TL Extract", "extract", "failed", 60, 25000],
  ["TL Class2d", "class2d", "running", 15, 99999],
  ["TL Select", "select", "idle", null, null],
];

async function main() {
  step("=== t123 — pipeline timeline: the session story ===");

  /* ---------------- Phase S — seed ---------------- */
  step("--- Phase S: seed scratch workspace + 6 engine-stamped jobs ---");
  const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(wsList.length >= 1, "a project with at least one workspace exists");
  const maxY = (await listJobs()).reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  const createdWs = await (
    await api("/api/workspaces", "POST", { name: "TL123 tl" })
  ).json();
  scratchWsId = createdWs?.workspace?.id ?? createdWs?.id ?? null;
  must(!!scratchWsId, "scratch workspace created");

  const nowMs = Date.now();
  const expect = [];
  let y = maxY + 240;
  for (const [name, type, status, agoSec, dur] of RENAMES) {
    const created = await (
      await api("/api/jobs", "POST", {
        type, name, workspaceId: scratchWsId, x: 140, y,
      })
    ).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created via POST /api/jobs`);
    y += 240;
    if (agoSec != null) {
      engineStamp(j.id, status, new Date(nowMs - agoSec * 1000).toISOString(), dur);
    }
    seededIds.push(j.id);
    expect.push({ id: j.id, name, status, agoSec, dur });
  }
  // verify the stamps through the SAME api the dashboard reads
  const after = await listJobs();
  const t5 = after.find((j) => j.id === expect[4].id);
  must(t5?.startedAt && t5?.status === "running", "running stamp visible via /api/jobs");
  const t1 = after.find((j) => j.id === expect[0].id);
  must(t1?.startedAt && t1?.duration === 12000, "completed stamp visible via /api/jobs");

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  // dashboard view via the header switcher
  await p.click('button[role="tab"][title*="Project dashboard"]');
  await p.waitForSelector('section[aria-label="Pipeline analytics"]', { timeout: 30000 });
  step("dashboard open, analytics section present");

  // scope to the scratch workspace chip (isolates counts from demo jobs)
  await p.click('button:has-text("TL123 tl")');
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  step("scoped to TL123 tl — timeline visible");

  /* ---------------- Phase A — screen ---------------- */
  step("--- Phase A: screen contract ---");
  const sec = p.locator('[data-canvas-ui="analytics-timeline"]');
  must((await sec.getAttribute("data-tl-count")) === "5", "A1 data-tl-count=5");

  const rows = sec.locator('[data-tl-row]');
  must((await rows.count()) === 5, "A2a five rows");
  const rowNames = await rows.locator("span.w-28").allTextContents();
  const namesInOrder = expect.slice(0, 5).map((e) => e.name);
  must(
    JSON.stringify(rowNames) === JSON.stringify(namesInOrder),
    `A2b chronological order (${rowNames.join(" → ")})`
  );
  const rowStatuses = await Promise.all(
    (await rows.all()).map((r) => r.getAttribute("data-status"))
  );
  must(
    JSON.stringify(rowStatuses) === JSON.stringify(["completed", "completed", "completed", "failed", "running"]),
    "A3 status sequence completed×3 → failed → running"
  );

  const barCls = (i) =>
    rows.nth(i).locator('[data-tl-bar]').getAttribute("class");
  must((await barCls(0)).includes("bg-emerald-500/80"), "A4a completed bar emerald");
  must((await barCls(3)).includes("bg-rose-500/85"), "A4b failed bar rose");
  const runCls = await barCls(4);
  must(runCls.includes("bg-amber-500") && runCls.includes("animate-soft-pulse"),
    "A4c running bar amber + soft-pulse");

  // geometry vs the probe's own oracle (±2.5pp absorbs now-drift between
  // page render and this evaluation — span is live via the running row)
  const oracle = expect.slice(0, 4).map((e) => {
    const start = nowMs - e.agoSec * 1000;
    return { name: e.name, start, ms: e.dur };
  });
  const pageNow = Date.now(); // both sides read live now; drift stays small
  const span = pageNow - oracle[0].start;
  for (let i = 0; i < 4; i++) {
    const bar = rows.nth(i).locator('[data-tl-bar]');
    const style = await bar.getAttribute("style");
    const left = parseFloat(/left:\s*([\d.]+)%/.exec(style)?.[1] ?? "NaN");
    const width = parseFloat(/width:\s*([\d.]+)%/.exec(style)?.[1] ?? "NaN");
    const expLeft = ((oracle[i].start - oracle[0].start) / span) * 100;
    const expWidth = Math.max((oracle[i].ms / span) * 100, 0.75);
    must(
      Number.isFinite(left) && Math.abs(left - expLeft) <= 2.5,
      `A5${"abcd"[i]}a ${oracle[i].name} left ${left.toFixed(1)}% ≈ ${expLeft.toFixed(1)}%`
    );
    must(
      Number.isFinite(width) && Math.abs(width - expWidth) <= 2.5,
      `A5${"abcd"[i]}b ${oracle[i].name} width ${width.toFixed(1)}% ≈ ${expWidth.toFixed(1)}%`
    );
  }

  const durTexts = await Promise.all(
    (await rows.all()).map((r) => r.locator("span.w-14").textContent())
  );
  must(durTexts[0] === "12s" && durTexts[1] === "30s", `A6a completed durations (${durTexts[0]}, ${durTexts[1]})`);
  must(durTexts[2] === "8s" && durTexts[3] === "25s", `A6b failed duration (${durTexts[2]}, ${durTexts[3]})`);
  must(/^\d+s$/.test(durTexts[4] ?? ""), `A6c running duration live (${durTexts[4]})`);

  const tickTexts = await sec.locator("div.relative.mt-1 span").allTextContents();
  must(tickTexts.length >= 3 && tickTexts.length <= 7, `A7a tick count sane (${tickTexts.length})`);
  must(tickTexts[0] === "0s", "A7b axis starts at 0s");
  must(tickTexts.some((t) => t === "3m"), `A7c three-minute tick present (${tickTexts.join(",")})`);

  const never = await sec.locator("[data-tl-never]").textContent();
  must(never.includes("1 of 6"), `A8 never-run footer counts the honest absentees (${never.trim().slice(0, 40)}…)`);

  // clipboard summary leg — capture writeText the headless-honest way
  await p.evaluate(() => {
    const w = window;
    w.__tlSummary = null;
    navigator.clipboard.writeText = (t) => { w.__tlSummary = t; return Promise.resolve(); };
  });
  await p.click('button[aria-label="Copy pipeline summary"]');
  await sleep(400);
  const summary = await p.evaluate(() => window.__tlSummary);
  must(!!summary && summary.includes("Session timeline (5 runs"), "A9a summary names the timeline block");
  // row offsets carry fmtDuration's composite precision — the tick-label
  // fmtOffset would collapse CtfFind's 80s→88s into "+1m → +1m", which
  // contradicts its own (completed, 8s) tail
  must(!!summary && summary.includes("TL CtfFind: +1m 20s → +1m 28s (completed, 8s)"),
    `A9b summary offsets keep sub-minute precision — got: ${JSON.stringify(summary?.split("\n").filter((l) => l.includes("TL") || l.includes("timeline")).join(" | "))}`);
  // the first run starts AT t0 — "+—" (fmtDuration's zero sentinel) would
  // read as a glitch; the zero offset is data and says "+0s"
  must(!!summary && summary.includes("TL Import: +0s → +12s (completed, 12s)"),
    "A9c zero offset prints as +0s, not the em-dash sentinel");

  /* ---------------- Phase B — paper ---------------- */
  step("--- Phase B: paper contract ---");
  await p.emulateMedia({ media: "print" });
  await sleep(300);
  const bar = rows.nth(1).locator('[data-tl-bar]');
  const barBox = await bar.boundingBox();
  must(!!barBox && barBox.width > 3, `B1a bar keeps width on paper (${barBox?.width?.toFixed(1)}px)`);
  const adjust = await bar.evaluate((el) => getComputedStyle(el).printColorAdjust);
  must(adjust === "exact", `B1b print-color-adjust exact (${adjust})`);
  const scroller = sec.locator("div.max-h-72");
  const scrollCls = (await scroller.getAttribute("class")) ?? "";
  must(scrollCls.includes("print:max-h-none") && scrollCls.includes("print:overflow-visible"),
    "B2 guardrail unrolls on paper (max-h-none + overflow-visible)");
  must((await sec.locator("[data-tl-never]").count()) === 1, "B3a footer prints");
  const chromeGone = await p.locator('div[role="group"][aria-label="Export analytics"]').isVisible();
  must(!chromeGone, "B4 interactive chrome stays off the paper");
  await p.screenshot({ path: ".next/t123-paper.png", fullPage: false });
  await p.emulateMedia({ media: "screen" });

  /* ---------------- Phase F — static ---------------- */
  step("--- Phase F: static contract ---");
  must(existsSync("src/lib/duration.ts"), "F1 lib/duration.ts exists");
  const libSrc = readFileSync("src/lib/duration.ts", "utf8");
  must(
    /export function fmtDuration/.test(libSrc) &&
      /export function fmtClock/.test(libSrc) &&
      /export function fmtAgo/.test(libSrc),
    "F1b lib exports the three formatters"
  );
  const defCount = Number(
    sh(`rg -c "function fmtDuration" src/ || true`).split("\n").filter(Boolean).length
  );
  must(defCount === 1, `F2 exactly one fmtDuration definition in src (${defCount})`);
  const insp = readFileSync("src/components/workflow/job-inspector.tsx", "utf8");
  must(
    insp.includes('import { fmtAgo, fmtClock, fmtDuration } from "@/lib/duration"'),
    "F3a inspector imports the lib"
  );
  must(!/function fmtDuration/.test(insp), "F3b inspector has no local twin");
  const ana = readFileSync("src/components/workflow/pipeline-analytics.tsx", "utf8");
  must(
    ana.includes('import { fmtClock, fmtDuration } from "@/lib/duration"'),
    "F4 analytics imports the lib"
  );
  const clientHit = sh("rg -l 'data-tl-bar' .next/static/chunks/ | head -1");
  must(clientHit.length > 0, "F5a client chunk carries data-tl-bar");
  const serverHit = sh("rg -l 'Session timeline' .next/server/chunks/ssr/ | head -1");
  must(serverHit.length > 0, "F5b server chunk carries Session timeline");
  const runner = readFileSync("scripts/run-matrix.sh", "utf8");
  must(runner.includes("t1[0-9][0-9]-e2e.mjs"), "F6 runner glob auto-includes t123");

  /* ---------------- Phase Z — cleanup + console ---------------- */
  step("--- Phase Z: cleanup + console ---");
  const realPageErrors = pageErrors;
  must(realPageErrors.length === 0, `Z1 zero page errors (${realPageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => /Failed to load resource.*\/fsc/.test(t) || /Failed to load resource.*404/.test(t)
  );
  must(
    consoleErrors.length === honest.length,
    `Z2 console errors are honest resource notes only (${consoleErrors.length} total, ${honest.length} honest)`
  );

  await cleanup();
  console.log(`T123 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => {
  console.error(e);
  void cleanup().then(() => process.exit(1));
});

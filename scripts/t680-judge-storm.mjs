/**
 * t680 — the judge STORM's live half (the ledger's entry ③, waited-for
 * "stable night" finally arrived).
 *
 * t574 built the worker: a finished classification no longer waits for
 * someone to ask — the background tick scans, plans (pure planner, 8
 * gates), and stamps a two-pass VLM opinion onto the job. Its DESIGN
 * already owns the storm: one judge per tick (the politeness ceiling)
 * turns a completion burst into a queue, and the watermark keeps the
 * back catalog from ever being re-judged. What has never been flown LIVE
 * is the queue itself — two classifications completing in the same
 * window, the worker draining them one tick at a time, oldest first.
 *
 * The storm's minimal live shape:
 *   seat A = the world's own class3d (cmuwipe635000class3d) — its
 *            updatedAt is re-written to NOW (the DB pen, the seeder's
 *            borrowed key — the engine's PATCH never writes completed,
 *            so the drill borrows the same door t677 did);
 *   seat B = a drill class3d (t680stormclass3db) with the demo class3d's
 *            materials copied into its derived workdir, created with an
 *            updatedAt two seconds YOUNGER than A's;
 *   expectation: the planner's oldest-first sort judges A on one tick,
 *            then B on the NEXT tick (one judge per tick), both stamps
 *            land on disk, both cards wear the Sparkles badge, and the
 *            teardown returns the world to exactly what it was.
 *
 * Honest-risk note: this is a LIVE VLM call (the builtin GLM provider,
 * the same provider whose glm-4-plus verdict already sits on the demo
 * class2d from the t574 era). If the provider declines or errors, the
 * probe reports it as it saw it — a live drill that fakes its verdict
 * would be a rehearsal of nothing.
 *
 * Crash safety: the pre-state (A's updatedAt, the stamps file bytes) is
 * persisted to .qa-logs/t680-state.json BEFORE anything mutates; a
 * defensive restore runs at the top of every flight, so a killed run
 * leaves the world healable by re-running the probe.
 *
 * Legs:
 *   S — the worker's face (mounted / autoJudge / providerOk), the world's
 *       stamp baseline (class2d stamped, class3d not), the materials.
 *   A — seat A's verdict arrives (judged[] + stamp + hasVerdict).
 *   B — seat B's verdict arrives on a LATER tick (queue semantics:
 *       oldest-first order, stamps in order).
 *   C — the canvas face: two new Sparkles badges, aria-said.
 *   D — the world intact: teardown (updatedAt back → drill gone →
 *       stamps restored), roster 17, class2d's old stamp survives,
 *       zero real console errors.
 */

import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor(); // t709 — the reader-door routes (judge-worker status) reject headerless clients (the door's language)
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, copyFileSync } from "node:fs";
import { renameSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO = "/home/z/my-project";
const BASE = "http://localhost:3000";
const QA = path.join(REPO, ".qa-logs");
mkdirSync(QA, { recursive: true });

const WORLD_CLASS3D = "cmuwipe635000class3d";
const DRILL_ID = "t680stormclass3db";
const DRILL_IDS = [DRILL_ID];
const DRILL_WORKDIR = path.join(REPO, "data", "relion", "cmuwipe6350000demoproject", `class3d_${DRILL_ID.slice(-8)}`);
const STAMPS_FILE = path.join(REPO, "data", "ai-verdicts.json");
const STATE_FILE = path.join(QA, "t680-state.json");
const WORKDIR_SRC = path.join(REPO, "data", "relion", "cmuwipe6350000demoproject", "class3d_0class3d");
const MATERIALS = ["run_it003_class001.mrc", "run_it003_class002.mrc", "run_it003_class003.mrc", "run_it003_data.star", "run_it003_model.star"];

process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

/* ------------------------------------------------------------------ */
/* small honest helpers                                                */
/* ------------------------------------------------------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(msg) { pass++; console.log(`  ok: ${msg}`); }
function bad(msg) { fail++; console.log(`  FAIL: ${msg}`); }
function check(cond, msg) { (cond ? ok : bad)(msg); }

async function workerStatus() {
  const r = await fetch(`${BASE}/api/ai/judge-worker`).catch(() => null);
  if (!r || !r.ok) return null;
  return r.json();
}
async function roster() {
  const r = await fetch(`${BASE}/api/jobs`);
  const j = await r.json();
  return j.jobs ?? j;
}
function stampsNow() {
  try { return JSON.parse(readFileSync(STAMPS_FILE, "utf8")).stamps ?? []; }
  catch { return []; }
}

/* ------------------------------------------------------------------ */
/* defensive restore — a killed earlier flight leaves the world        */
/* healable (the pre-state rides in .qa-logs/t680-state.json)          */
/* ------------------------------------------------------------------ */
async function defensiveRestore() {
  if (!existsSync(STATE_FILE)) return;
  try {
    const st = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (typeof st.class3dUpdatedAt === "string") {
      await db.job.update({ where: { id: WORLD_CLASS3D }, data: { updatedAt: new Date(st.class3dUpdatedAt) } }).catch(() => {});
    }
    if (st.stampsBytes) {
      const tmp = `${STAMPS_FILE}.restore-${Date.now().toString(36)}`;
      writeFileSync(tmp, Buffer.from(st.stampsBytes, "base64"));
      renameSync(tmp, STAMPS_FILE);
    }
    await db.job.deleteMany({ where: { id: { in: DRILL_IDS } } }).catch(() => {});
    rmSync(DRILL_WORKDIR, { recursive: true, force: true });
    rmSync(STATE_FILE, { force: true });
    console.log("· defensive restore: a previous flight's state healed");
  } catch (e) {
    console.log(`· defensive restore failed (continuing, world may carry scars): ${e.message}`);
  }
}
await defensiveRestore();

/* ------------------------------------------------------------------ */
/* S — the worker's face + the world's baseline                        */
/* ------------------------------------------------------------------ */
console.log("\n== S: the worker is alive and the world's baseline is known ==");
const s0 = await workerStatus();
check(s0 != null, "S the judge-worker status route answers");
check(s0?.mounted === true, "S the worker is mounted (the boot loop lives)");
check(s0?.autoJudge === true && s0?.providerOk === true, "S autoJudge on and a provider is configured (builtin GLM)");

const stampIds0 = new Set(stampsNow().map((x) => x.jobId));
check(!stampIds0.has(WORLD_CLASS3D), "S the world's class3d carries NO stamp yet (a clean candidate)");
check(stampIds0.has("cmuwipe635000class2d"), "S the world's class2d carries its t574-era stamp (the baseline opinion)");

const roster0 = await roster();
const anchor = roster0.find((j) => j.id === WORLD_CLASS3D);
check(anchor != null && anchor.status === "completed", "S the world's class3d seat exists and is completed");
const badgeBaseline = roster0.filter((j) => j.hasVerdict).length;
console.log(`· baseline: ${roster0.length} jobs, ${badgeBaseline} wearing hasVerdict`);

const missingMaterials = MATERIALS.filter((f) => !existsSync(path.join(WORKDIR_SRC, f)));
check(missingMaterials.length === 0, `S the demo class3d workdir carries all judge materials${missingMaterials.length ? ` (missing: ${missingMaterials.join(", ")})` : ""}`);

/* ------------------------------------------------------------------ */
/* the storm setup — persist pre-state, then mutate                    */
/* ------------------------------------------------------------------ */
const stampsBytesBefore = readFileSync(STAMPS_FILE, "utf8");
writeFileSync(STATE_FILE, JSON.stringify({
  class3dUpdatedAt: anchor.updatedAt,
  stampsBytes: Buffer.from(stampsBytesBefore, "utf8").toString("base64"),
}));
console.log("· pre-state persisted (crash-safe)");

const nowA = Date.now();
await db.job.update({ where: { id: WORLD_CLASS3D }, data: { updatedAt: new Date(nowA) } });
await db.job.deleteMany({ where: { id: { in: DRILL_IDS } } }).catch(() => {});
cpSync(WORKDIR_SRC, DRILL_WORKDIR, { recursive: true });
for (const f of MATERIALS) {
  if (!existsSync(path.join(DRILL_WORKDIR, f))) copyFileSync(path.join(WORKDIR_SRC, f), path.join(DRILL_WORKDIR, f));
}
await db.job.create({
  data: {
    id: DRILL_ID,
    projectId: anchor.projectId,
    workspaceId: anchor.workspaceId ?? null,
    type: "class3d",
    name: "t680 storm drill",
    x: 2600, y: 560,
    status: "completed",
    progress: 100,
    params: "{}",
    startedAt: new Date(nowA - 3600_000),
    updatedAt: new Date(nowA + 2000),
  },
});
console.log(`· storm armed: seat A (world class3d) updatedAt=${nowA}, seat B (drill) updatedAt=${nowA + 2000} — oldest first means A drains first`);

/* ------------------------------------------------------------------ */
/* browser — collecting console for the whole flight                   */
/* ------------------------------------------------------------------ */
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1560, height: 950 } });
const consoleReal = [];
page.on("console", (m) => {
  const t = m.text?.() ?? "";
  if (m.type() === "error" && !/net::ERR_FAILED|Failed to load resource/.test(t)) consoleReal.push(t);
});
page.on("pageerror", (e) => consoleReal.push(`pageerror: ${e.message?.slice(0, 200)}`));

/* ------------------------------------------------------------------ */
/* A — seat A's verdict arrives (the queue's first cell)               */
/* ------------------------------------------------------------------ */
console.log("\n== A: the worker drains seat A (the world's class3d) ==");
let judgedA = null, stampA = null, hasA = false;
const deadlineA = Date.now() + 240_000; // one tick (30s) + a two-pass VLM's honest length
while (Date.now() < deadlineA) {
  const st = await workerStatus();
  judgedA = st?.judged?.find((x) => x.jobId === WORLD_CLASS3D) ?? null;
  stampA = stampsNow().find((x) => x.jobId === WORLD_CLASS3D) ?? null;
  if (judgedA && stampA) break;
  await sleep(4000);
}
check(judgedA != null, `A the worker's judged[] records seat A${judgedA ? ` (ok=${judgedA.ok})` : " (never arrived)"}`);
check(stampA != null, "A the stamp landed on disk (ai-verdicts.json knows seat A)");
check(hasA = !!((await roster()).find((j) => j.id === WORLD_CLASS3D)?.hasVerdict), "A the jobs API joins hasVerdict for seat A");
check(judgedA?.ok === true, `A the live VLM judge SUCCEEDED (ok=true)${judgedA && judgedA.ok !== true ? ` — honest decline: ${judgedA.summary?.slice(0, 160)}` : ""}`);
check(!!(judgedA?.summary ?? "").trim() || !!(stampA?.advice ?? "").trim(), "A the verdict says something (a summary or an advice sentence exists)");

/* ------------------------------------------------------------------ */
/* B — seat B's verdict arrives (the queue's second cell)              */
/* ------------------------------------------------------------------ */
console.log("\n== B: the worker drains seat B on a LATER tick (the queue's point) ==");
let judgedB = null, stampB = null;
const deadlineB = Date.now() + 300_000; // A already drained; B waits for the NEXT tick + its own VLM
while (Date.now() < deadlineB) {
  const st = await workerStatus();
  judgedB = st?.judged?.find((x) => x.jobId === DRILL_ID) ?? null;
  stampB = stampsNow().find((x) => x.jobId === DRILL_ID) ?? null;
  if (judgedB && stampB) break;
  await sleep(4000);
}
check(judgedB != null, `B the worker's judged[] records seat B${judgedB ? ` (ok=${judgedB.ok})` : " (never arrived)"}`);
check(stampB != null, "B the stamp landed on disk for the drill seat");
check(judgedB?.ok === true, `B the live VLM judge SUCCEEDED for the drill too${judgedB && judgedB.ok !== true ? ` — honest decline: ${judgedB.summary?.slice(0, 160)}` : ""}`);
check(!!((await roster()).find((j) => j.id === DRILL_ID)?.hasVerdict), "B the drill seat wears hasVerdict through the jobs API");
check(
  stampA != null && stampB != null && (stampA.at ?? 0) <= (stampB.at ?? 0),
  "B the queue drained OLDEST FIRST (seat A's stamp precedes seat B's)"
);

/* ------------------------------------------------------------------ */
/* C — the canvas face: two new Sparkles badges                        */
/* ------------------------------------------------------------------ */
console.log("\n== C: the canvas shows the worker's work (the badge) ==");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-job]', { timeout: 30_000 }).catch(() => {});
await sleep(2500);
// the roster the canvas reads may need one refetch to learn the fresh hasVerdict flags
await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForSelector('[data-job]', { timeout: 30_000 }).catch(() => {});
await sleep(2500);
const badgeCount = await page.locator('[data-canvas-ui="job-verdict-badge"]').count();
check(badgeCount >= badgeBaseline + 2, `C the canvas wears ${badgeCount} verdict badges (baseline ${badgeBaseline} + the storm's 2)`);
const drillNode = page.locator(`[data-job="${DRILL_ID}"]`);
const drillBadge = await drillNode.locator('[data-canvas-ui="job-verdict-badge"]').count().catch(() => 0);
check(drillBadge >= 1, "C the drill seat's own card wears the Sparkles badge (icon-only face, aria says the sentence)");
const badgeAria = await page.locator('[data-canvas-ui="job-verdict-badge"]').first().getAttribute("aria-label").catch(() => null);
check(badgeAria === "AI verdict ready", 'C the badge speaks its aria sentence ("AI verdict ready")');
await page.screenshot({ path: path.join(QA, "t680-judge-storm.png") });
console.log("· 📸 t680-judge-storm.png — the storm's face: two fresh verdicts on the canvas");

/* ------------------------------------------------------------------ */
/* D — teardown + the world intact                                     */
/* ------------------------------------------------------------------ */
console.log("\n== D: teardown returns the world, the world answers honestly ==");
// restore order matters for the smallest window: A's updatedAt back (the
// freshness gate then holds it), drill gone, stamps file restored last.
await db.job.update({ where: { id: WORLD_CLASS3D }, data: { updatedAt: new Date(anchor.updatedAt) } }).catch(() => {});
await db.job.deleteMany({ where: { id: { in: DRILL_IDS } } }).catch(() => {});
{
  const tmp = `${STAMPS_FILE}.restore-${Date.now().toString(36)}`;
  writeFileSync(tmp, stampsBytesBefore, "utf8");
  renameSync(tmp, STAMPS_FILE);
}
rmSync(DRILL_WORKDIR, { recursive: true, force: true });
rmSync(STATE_FILE, { force: true });
console.log("· teardown: seat A's clock back, drill seat + workdir gone, stamps restored");

const roster1 = await roster();
check(roster1.length === roster0.length, `D the roster returns to ${roster0.length} seats (${roster1.length})`);
check(!roster1.find((j) => j.id === DRILL_ID), "D the drill seat is gone from the world");
check(!roster1.find((j) => j.id === WORLD_CLASS3D)?.hasVerdict, "D the world class3d's hasVerdict falls back (its stamp was the drill's, now restored away)");
check(stampsNow().some((x) => x.jobId === "cmuwipe635000class2d"), "D the class2d's t574-era stamp survives the restore (the baseline opinion untouched)");
check(!existsSync(DRILL_WORKDIR), "D the drill workdir is gone from the tree");
check(consoleReal.length === 0, `D zero real console errors (${consoleReal.length}${consoleReal.length ? `: "${consoleReal[0].slice(0, 120)}"` : ""})`);

await b.close();
await db.$disconnect?.().catch(() => {});

console.log(`\n==== t680 judge-storm: ${pass} pass / ${fail} fail ====`);
process.exit(fail === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * t878 — THE JUDGE-WORKER FAMILY'S PORT (the t876 map's debt walk
 * t680-judge-storm gets its first LIVING host): the AI stamp's own
 * surfaces — the judge-worker status route, the autoJudge boot, the
 * clean-candidate/carrying-stamp world states, and the storm's queue —
 * one instrument, born in the family idiom (the measure, the census
 * invariant, the drift ledger aboard from birth, the stamp).
 *
 * THE HOST IS MEASURED, NEVER PINNED: t680 pinned the cmuwipe world
 * (cmuwipe635000class3d + the demo project's workdir tree) and t574
 * pinned the EMPIAR world — both are gone from the roster (the t874
 * audit's census; both walks shadowed-alive, exit 3). The port measures
 * its seats from the LIVING world: the stamped class3d whose workdir
 * carries judge materials is READ from the roster at run time; the
 * drill seats are minted, never borrowed from history.
 *
 * THE STORM WITHOUT A PIN: t680's storm re-wrote the WORLD class3d's
 * updatedAt (the DB pen) and copied the demo workdir's materials. The
 * port mints TWO class3d drill seats (t878stormcell3da/b, updatedAt
 * two seconds apart), each with the LATEST iteration's materials copied
 * from the measured host workdir (~tens of KB), and lets the LIVE
 * worker drain them — one judge per tick, oldest first. The world's
 * real jobs are never mutated: the port's mutations are the port's,
 * and the exit returns everything (the un-own law).
 *
 * THE QUEUE'S TWO WITNESSES: the LIVE storm proves the queue on real
 * verdicts (the oldest-first drain, the second seat on a LATER tick —
 * t680's own discovery: the watermark advances to the JUDGED seat's
 * updatedAt, not the scan clock, or the queue's second cell never
 * comes up for air); the BENCH re-ride (t578, spawned) pins the
 * planner's eight gates bare — the cap, the fairness, the mirror
 * invisibility, the watermark honesty. Live proves the world, bench
 * proves the policy; the port refuses to conflate them.
 *
 * THE WALK (one command):
 *   S  the status route's face (t680's three labels + the growth):
 *      the route answers, the worker is mounted (the boot loop lives),
 *      autoJudge on and a provider configured, the escape hatch quiet,
 *      the boot loop ACTUALLY ticking (lastTickAt fresh), the watermark
 *      persisted (the per-ERA memory), the judged ledger bounded.
 *   W  the world's stamp states: the carrying-stamp pair measured from
 *      the roster (class2d + class3d wear hasVerdict), their ai-verdict
 *      routes available with shaped stamps (classes[] enum verdicts, a
 *      named model, a finite at), the stamps file agreeing with the
 *      routes, the materials host present (the storm's source).
 *   Q  the queue's bench witness: t578 re-ridden by spawn (exit 0, the
 *      storm's semantics pinned bare).
 *   L  the LIVE storm: two drill seats armed (clean candidates:
 *      completed, unstamped, fresh, not mirrors) -> the worker drains
 *      seat A (the verdict arrives WITHOUT anyone asking), then seat B
 *      on a LATER tick -> stamps land on disk, hasVerdict joins through
 *      the jobs API, the canvas grows the Sparkles badges (aria says
 *      the sentence), the screenshot rides.
 *   P  the policy gates LIVE (rev 2 — the port's second half, the t574
 *      Face C shape on the living host): the toggle's door speaks (PUT
 *      off -> the status reflects the gate) -> a clean candidate armed
 *      NOW stays SILENT across 2+ ticks (no stamp, no judged record,
 *      the ledger untouched) -> the off-period completion is swept
 *      BEFORE the re-arm (the race made impossible, the t574 law) ->
 *      the toggle restored and the re-arm storms nothing -> the MIRROR
 *      gate LIVE and ISOLATED (a fresh LINKED drill, armed post-water-
 *      mark, stays invisible across 2+ ticks while the original keeps
 *      its one opinion) -> the mirror swept, the settings door restored
 *      (the file's state == the door's — existed->bytes, absent->the
 *      absence).
 *   B  world back: the drills swept, the stamps byte-for-byte, the
 *      roster bit-for-bit, the canvas back at baseline, the worker
 *      still mounted and armed, zero real console errors (the page's
 *      own error events — the agent-browser errors channel carries
 *      empty-message artifacts; the port reads the page, not the
 *      channel).
 *
 * Ledger aboard from birth (the t861 birthright): FOUR faces — statusFace /
 * stampStates / worldBack (+ policyFace since revision 2, the port's
 * second half) — the arm-3 chain closed bit-for-bit on the second ride.
 * Registered at birth into A4e-28 (the family's shape).
 *
 * Receipt: shots-qa/t878-judge-worker-family.json (+ PNG archived).
 *
 *   node scripts/t878-judge-worker-family.mjs
 */

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const RECEIPT = "shots-qa/t878-judge-worker-family.json";
const SHOT = "shots-qa/t878-storm-canvas.png";
const RECEIPT_REVISION = 3; // rev 3 — the policy gates LIVE + the face-wiring fix (P1's const shadowed the outer offReflected — the face under-reported the gate's own witness; the t872 law: fix the ruler, the revision tells the ledger the comparator predates the fix)
const QA_DIR = join(ROOT, ".qa-logs");
const STATE_FILE = join(QA_DIR, "t878-state.json");
const STAMPS_FILE = join(ROOT, "data", "ai-verdicts.json");
const WATERMARK_FILE = join(ROOT, "data", "judge-worker.json");
const SETTINGS_FILE = join(ROOT, "data", "ai-settings.json");
const SEAT_A = "t878stormcell3da";
const SEAT_B = "t878stormcell3db";
const SEAT_IDS = [SEAT_A, SEAT_B];
const POLICY_ID = "t878policycell3d";
const MIRROR_ID = "t878mirrorcell3d";
const DEFENSE_IDS = [...SEAT_IDS, POLICY_ID, MIRROR_ID];
const JUDGE_ENUMS = ["keep", "maybe", "reject"];

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

/* ---------- the agent-browser + api mouths (the t877 idiom) ---------- */
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};
const shot = (rel) => execSync(`agent-browser screenshot ${rel}`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });

/* same-origin metadata — the API reads/writes are same-origin gates (the
 * t708 door's language; the judge-worker status route rejects headerless
 * clients) */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
const api = async (method, url, body) => {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: SH,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let b = null;
  try {
    b = await r.json();
  } catch {
    b = null;
  }
  return { status: r.status, body: b };
};
const roster = async () => {
  const b = (await api("GET", "/api/jobs")).body;
  return b?.jobs ?? b ?? [];
};
const workerStatus = async () => (await api("GET", "/api/ai/judge-worker")).body;
const stampsNow = () => {
  try {
    return JSON.parse(readFileSync(STAMPS_FILE, "utf8")).stamps ?? [];
  } catch {
    return [];
  }
};
const stampsBytes = () => (existsSync(STAMPS_FILE) ? readFileSync(STAMPS_FILE, "utf8") : "");

/* ---------- the DB pen (the seeder's borrowed key, the t680 door) ---------- */
process.env.DATABASE_URL = `file:${ROOT}/db/cryoflow.db`;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

const workdirOf = (id) => join(ROOT, "data", "relion", PROJECT_ID, `class3d_${id.slice(-8)}`);
let PROJECT_ID = null; // measured at the door
const JUDGEABLE = ["class2d", "class3d"];

/* latest iteration's materials in a class3d workdir (the judge's own
 * dialect — discoverClassVolumes reads the SAME regex; the port copies
 * the latest iteration's class volumes + its data/model stars) */
function latestIterationMaterials(dir) {
  const names = readdirSync(dir);
  let best = -1;
  for (const n of names) {
    const m = /^(?:run_it|_it)(\d+)_class(\d+)\.mrc$/i.exec(n);
    if (m) best = Math.max(best, Number(m[1]));
  }
  if (best < 0) return null;
  const clsRe = new RegExp(`^(?:run_it|_it)0*${best}_class\\d+\\.mrc$`, "i");
  const dataRe = new RegExp(`^(?:run_it|_it)0*${best}_data\\.star$`, "i");
  const modelRe = new RegExp(`^(?:run_it|_it)0*${best}_model\\.star$`, "i");
  const files = names.filter((n) => clsRe.test(n) || dataRe.test(n) || modelRe.test(n));
  return { iteration: best, files };
}

/* ---------- defensive restore — a killed earlier flight heals ---------- */
async function defensiveRestore() {
  if (!existsSync(STATE_FILE)) return;
  try {
    const st = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (typeof st.stampsBytes === "string") {
      const tmp = `${STAMPS_FILE}.restore-${Date.now().toString(36)}`;
      writeFileSync(tmp, Buffer.from(st.stampsBytes, "base64"));
      renameSync(tmp, STAMPS_FILE);
    }
    await db.job.deleteMany({ where: { id: { in: DEFENSE_IDS } } }).catch(() => {});
    for (const id of DEFENSE_IDS) {
      if (st.projectId) rmSync(join(ROOT, "data", "relion", st.projectId, `class3d_${id.slice(-8)}`), { recursive: true, force: true });
    }
    rmSync(STATE_FILE, { force: true });
    console.log("· defensive restore: a previous flight's state healed");
  } catch (e) {
    console.log(`· defensive restore failed (continuing, world may carry scars): ${e.message?.slice(0, 160)}`);
  }
}

/* ---------- the walk ---------- */
const world = worldIdentity(ROOT);
console.log(`t878 — the judge-worker family's port (world ${world.id}, mode ${world.mode})`);
mkdirSync(QA_DIR, { recursive: true });
await defensiveRestore();

/* ---- S — the status route's face ---- */
console.log("\n== S: the status route's face (the boot loop's own introspection) ==");
const s0 = await workerStatus();
ok("S the judge-worker status route answers", s0 != null && typeof s0 === "object");
ok("S the worker is mounted (the boot loop lives)", s0?.mounted === true, s0 ? `startedAt ${new Date(s0.startedAt).toISOString()}` : "no body");
ok("S autoJudge on and a provider is configured (builtin GLM)", s0?.autoJudge === true && s0?.providerOk === true, s0 ? `autoJudge=${s0.autoJudge} providerOk=${s0.providerOk}` : "");
ok("S the escape hatch is quiet (the reaper's symmetry)", s0?.disabled === false, s0 ? `disabled=${s0.disabled}` : "");
const tickFresh = s0?.lastTickAt != null && Date.now() - s0.lastTickAt < 2.5 * (s0.tickMs ?? 30_000);
ok("S the boot loop actually ticks (lastTickAt fresh within 2.5 ticks)", tickFresh,
  s0?.lastTickAt ? `${Math.round((Date.now() - s0.lastTickAt) / 1000)}s ago (tick ${s0.tickMs}ms)` : "no lastTickAt");
const wmFile = existsSync(WATERMARK_FILE) ? JSON.parse(readFileSync(WATERMARK_FILE, "utf8")).watermark ?? null : null;
ok("S the watermark is persisted (the per-ERA memory)", typeof s0?.watermark === "number" && Number.isFinite(s0.watermark) && typeof wmFile === "number",
  `status ${s0?.watermark ?? "?"} / file ${wmFile ?? "?"}`);
const judged0 = Array.isArray(s0?.judged) ? s0.judged : [];
ok("S the judged ledger is bounded and honest",
  judged0.length <= 20 && judged0.every((r) => typeof r.jobId === "string" && typeof r.ok === "boolean" && typeof r.at === "number" && typeof r.summary === "string"),
  `${judged0.length} record${judged0.length === 1 ? "" : "s"}`);
const LEDGER_LEN_AT_DOOR = judged0.length;
const LEDGER_IDS_AT_DOOR = new Set(judged0.map((r) => r.jobId));
const LEDGER_AT_DOOR = JSON.stringify(judged0); // the prepend-only invariant's comparator

/* ---- W — the world's stamp states (measured, never pinned) ---- */
console.log("\n== W: the world's stamp states (the carrying-stamp pair) ==");
const J0 = (await roster()).length;
const roster0 = await roster();
const judgeables = roster0.filter((j) => JUDGEABLE.includes(j.type) && j.status === "completed");
const stampedJobs = judgeables.filter((j) => j.hasVerdict === true);
const stamped2d = stampedJobs.find((j) => j.type === "class2d") ?? null;
const stamped3d = stampedJobs.find((j) => j.type === "class3d") ?? null;
ok("W the world carries stamped classifications (measured from the roster)", stamped2d != null && stamped3d != null,
  stamped2d && stamped3d ? `${stamped2d.id.slice(-6)} (2d) + ${stamped3d.id.slice(-6)} (3d) of ${judgeables.length} judgeable` : "a type missing");

async function stampShape(jobRow, label) {
  if (!jobRow) {
    ok(label, false, "no carrying job");
    return null;
  }
  const v = (await api("GET", `/api/jobs/${jobRow.id}/ai-verdict`)).body;
  const st = v?.stamp ?? {};
  const shaped =
    v?.available === true &&
    typeof st.model === "string" && st.model.length > 0 &&
    Array.isArray(st.classes) && st.classes.length > 0 &&
    st.classes.every((c) => JUDGE_ENUMS.includes(c.verdict) && Number.isInteger(c.cls)) &&
    typeof st.at === "number" && Number.isFinite(st.at);
  ok(label, shaped,
    shaped ? `${st.model}, ${st.classes.length} classes (${st.classes.map((c) => `${c.cls}:${c.verdict}`).join(" ")})` : `available=${v?.available} model=${st.model ?? "?"}`);
  return v;
}
const v2d = await stampShape(stamped2d, "W the class2d's stamp speaks (available, shaped, model named)");
const v3d = await stampShape(stamped3d, "W the class3d's stamp speaks (available, shaped, model named)");
const diskIds = new Set(stampsNow().map((x) => x.jobId));
ok("W the stamps file agrees with the routes",
  (stamped2d ? diskIds.has(stamped2d.id) : false) && (stamped3d ? diskIds.has(stamped3d.id) : false),
  `${diskIds.size} stamps on disk`);

/* the storm's source: the measured class3d host workdir + its materials */
let HOST_WORKDIR = null;
let HOST_MATERIALS = null;
if (stamped3d) {
  PROJECT_ID = stamped3d.projectId;
  const dir = join(ROOT, "data", "relion", PROJECT_ID, `class3d_${stamped3d.id.slice(-8)}`);
  if (existsSync(dir)) {
    const found = latestIterationMaterials(dir);
    if (found && found.files.length >= 3) {
      HOST_WORKDIR = dir;
      HOST_MATERIALS = found;
    }
  }
}
ok("W the materials host stands (the measured class3d workdir carries the latest iteration's judge materials)",
  HOST_WORKDIR != null && HOST_MATERIALS != null,
  HOST_MATERIALS ? `it${String(HOST_MATERIALS.iteration).padStart(3, "0")}: ${HOST_MATERIALS.files.length} files` : "no materials found");

/* the opening face: the canvas's badge baseline */
const openCanvas = () => {
  ab("open http://localhost:3000");
  sleep(2500);
  ab('wait "[data-job]"');
  sleep(2000);
  return evalJson('(() => JSON.stringify({ jobs: document.querySelectorAll("[data-job]").length, badges: document.querySelectorAll(\'[data-canvas-ui="job-verdict-badge"]\').length, aria: (document.querySelector(\'[data-canvas-ui="job-verdict-badge"]\') || {}).getAttribute ? document.querySelector(\'[data-canvas-ui="job-verdict-badge"]\').getAttribute("aria-label") : null }))()');
};
const w0 = openCanvas();
ok("W the canvas baseline wears the world's stamps (the Sparkles badges)", w0.badges >= stampedJobs.length && w0.aria === "AI verdict ready",
  `${w0.badges} badges on ${w0.jobs} cards, aria "${w0.aria}"`);
const BADGE_BASELINE = w0.badges;

/* ---- Q — the queue's bench witness (t578 re-ridden) ---- */
console.log("\n== Q: the queue's bench witness (t578's storm, spawned) ==");
{
  const q = spawnSync("node", ["scripts/t578-storm-test.mjs"], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
  const tail = (q.stdout ?? "").trim().split("\n").pop() ?? "";
  ok("Q the bench holds the queue's semantics (exit 0)", q.status === 0, tail);
  ok("Q the bench's storm is whole (18 faces)", /18 passed, 0 failed/.test(q.stdout ?? ""), tail);
}

/* ---- the storm's pre-state (crash-safe) ---- */
const bytesBefore = stampsBytes();
writeFileSync(STATE_FILE, JSON.stringify({
  projectId: PROJECT_ID,
  stampsBytes: Buffer.from(bytesBefore, "utf8").toString("base64"),
}));
console.log("· pre-state persisted (crash-safe)");

/* ---- L — the LIVE storm (two clean candidates, oldest first) ---- */
console.log("\n== L: the live storm (the worker drains the queue, one per tick) ==");
let recA = null, recB = null, stA = null, stB = null;
let armedAt = null, drainedAat = null, drainedBat = null;
let hasVerdictCheck = null;
if (!HOST_WORKDIR || !PROJECT_ID) {
  console.error("FATAL: no materials host — the storm cannot arm (honest red)");
  fail++;
} else {
  const nowA = Date.now();
  const hostRow = stamped3d;
  for (const [idx, seatId] of SEAT_IDS.entries()) {
    const wd = workdirOf(seatId);
    mkdirSync(wd, { recursive: true });
    for (const f of HOST_MATERIALS.files) copyFileSync(join(HOST_WORKDIR, f), join(wd, f));
    await db.job.create({
      data: {
        id: seatId,
        projectId: PROJECT_ID,
        workspaceId: hostRow?.workspaceId ?? null,
        type: "class3d",
        name: idx === 0 ? "t878 storm cell A" : "t878 storm cell B",
        x: 2600, y: idx === 0 ? 700 : 860,
        status: "completed",
        progress: 100,
        params: "{}",
        startedAt: new Date(nowA - 3600_000),
        updatedAt: new Date(nowA + idx * 2000),
      },
    });
  }
  console.log(`· storm armed: seat A updatedAt=${nowA}, seat B updatedAt=${nowA + 2000} — oldest first means A drains first`);

  armedAt = Date.now();
  const deadline = armedAt + 780_000; // two tick boundaries + two two-pass VLM calls, honestly long
  let beats = 0;
  while (Date.now() < deadline) {
    const st = await workerStatus();
    const led = Array.isArray(st?.judged) ? st.judged : [];
    recA = recA ?? led.find((r) => r.jobId === SEAT_A && r.at > armedAt) ?? null;
    recB = recB ?? led.find((r) => r.jobId === SEAT_B && r.at > armedAt) ?? null;
    const stamps = stampsNow();
    stA = stA ?? stamps.find((x) => x.jobId === SEAT_A) ?? null;
    stB = stB ?? stamps.find((x) => x.jobId === SEAT_B) ?? null;
    if (recA && recB && stA && stB) break;
    if (++beats % 6 === 0) console.log(`· polling ${Math.round((Date.now() - armedAt) / 1000)}s — A judged=${!!recA} stamped=${!!stA}, B judged=${!!recB} stamped=${!!stB}`);
    await sleep(5000);
  }
  drainedAat = recA?.at ?? null;
  drainedBat = recB?.at ?? null;
  ok("L the seats armed as clean candidates (completed, unstamped, fresh, not mirrors)", true,
    `A@+0ms B@+2000ms, workdir it${String(HOST_MATERIALS.iteration).padStart(3, "0")}`);
  ok("L seat A's verdict arrived WITHOUT anyone asking (the worker's own ledger)", recA != null,
    recA ? `ok=${recA.ok}, ${Math.round(((drainedAat ?? armedAt) - armedAt) / 1000)}s after arming` : "never arrived within 780s");
  ok("L seat A's stamp landed on disk (ai-verdicts.json knows the seat)", stA != null, stA ? `at ${new Date(stA.at).toISOString()}` : "");
  ok("L seat A's live VLM judge SUCCEEDED (ok=true)",
    recA?.ok === true,
    recA ? (recA.ok ? (recA.summary ?? "").slice(0, 110) : `honest decline: ${(recA.summary ?? "").slice(0, 140)}`) : "no record");
  ok("L the verdict says something (a summary sentence exists)", !!(recA?.summary ?? "").trim() || !!(stA?.advice ?? "").trim());
  ok("L seat B's verdict arrived on a LATER tick (the queue's second cell)", recB != null,
    recB ? `ok=${recB.ok}, ${Math.round(((drainedBat ?? armedAt) - (drainedAat ?? armedAt)) / 1000)}s after seat A` : "never arrived within 780s");
  ok("L seat B's stamp landed on disk", stB != null, stB ? `at ${new Date(stB.at).toISOString()}` : "");
  ok("L seat B's live VLM judge SUCCEEDED (ok=true)",
    recB?.ok === true,
    recB ? (recB.ok ? (recB.summary ?? "").slice(0, 110) : `honest decline: ${(recB.summary ?? "").slice(0, 140)}`) : "no record");
  ok("L the queue drained OLDEST FIRST (seat A's stamp precedes seat B's)",
    stA != null && stB != null && stA.at < stB.at,
    stA && stB ? `Δ ${((stB.at - stA.at) / 1000).toFixed(1)}s` : "");
  {
    const stEnd = await workerStatus();
    const led = Array.isArray(stEnd?.judged) ? stEnd.judged : [];
    const iA = led.findIndex((r) => r.jobId === SEAT_A);
    const iB = led.findIndex((r) => r.jobId === SEAT_B);
    ok("L the ledger's order agrees (newest-first: B's record precedes A's)", iB >= 0 && iA >= 0 && iB < iA,
      `judged[${iB}]=B, judged[${iA}]=A (unshift newest-first)`);
    ok("L the ledger grew by exactly the storm (no other job judged during the window)",
      led[0]?.jobId === SEAT_B && led[1]?.jobId === SEAT_A &&
      led.length === Math.min(LEDGER_LEN_AT_DOOR + 2, 20) &&
      (() => { const doorLedger = JSON.parse(LEDGER_AT_DOOR); const tail = led.slice(2); return tail.length <= doorLedger.length && doorLedger.slice(0, tail.length).every((r, i) => JSON.stringify(r) === JSON.stringify(tail[i])); })(),
      `${LEDGER_LEN_AT_DOOR} -> ${led.length} (prepend-only: the storm's two on top, the door's ledger's prefix beneath — the worker's 20-cap may tail-truncate, the prefix holds)`);
  }
  hasVerdictCheck = async () => {
    const j = await roster();
    const a = j.find((x) => x.id === SEAT_A);
    const b = j.find((x) => x.id === SEAT_B);
    ok("L the seats wear hasVerdict through the jobs API", a?.hasVerdict === true && b?.hasVerdict === true,
      a && b ? `A=${a.hasVerdict} B=${b.hasVerdict}` : "seat missing from the roster");
  };
}

/* ---- the canvas face (the roster join rides the fresh page) ---- */
console.log("\n== C: the canvas shows the storm's work (the badges) ==");
if (hasVerdictCheck) await hasVerdictCheck();
const w1 = openCanvas();
ok("C the canvas wears the storm's badges (baseline + 2)", w1.badges >= BADGE_BASELINE + 2,
  `${w1.badges} badges (opening ${BADGE_BASELINE})`);
{
  const bA = evalJson(`(() => { const c = document.querySelector('[data-job="${SEAT_A}"]'); const b = c && c.querySelector('[data-canvas-ui="job-verdict-badge"]'); return JSON.stringify({ present: !!b, aria: b ? b.getAttribute("aria-label") : null }); })()`);
  const bB = evalJson(`(() => { const c = document.querySelector('[data-job="${SEAT_B}"]'); const b = c && c.querySelector('[data-canvas-ui="job-verdict-badge"]'); return JSON.stringify({ present: !!b, aria: b ? b.getAttribute("aria-label") : null }); })()`);
  ok("C the storm cells' own cards wear the Sparkles badge, aria says the sentence",
    bA.present === true && bB.present === true && bA.aria === "AI verdict ready" && bB.aria === "AI verdict ready",
    `A aria "${bA.aria}" / B aria "${bB.aria}"`);
}
shot(SHOT);
console.log(`· 📸 ${SHOT} — the storm's face: two fresh verdicts on the canvas`);

/* ---- P — the policy gates LIVE (rev 2, the port's second half) ---- */
console.log("\n== P: the policy gates LIVE (the off silence, the mirror gate) ==");
let offReflected = false, policySilent = false, reArmQuiet = false, mirrorSilent = false, originalUntouched = false, settingsRestored = false;
const settingsExisted = existsSync(SETTINGS_FILE);
const settingsDoorBytes = settingsExisted ? readFileSync(SETTINGS_FILE, "utf8") : null;
const originalStampAt = stamped3d ? (stampsNow().find((x) => x.jobId === stamped3d.id)?.at ?? null) : null;
console.log(`· settings door: the file ${settingsExisted ? "EXISTS (bytes snapshotted)" : "is ABSENT (the defaults hold the state — the absence IS the door)"}`);
try {
  if (!PROJECT_ID || !stamped3d) throw new Error("no measured host — the policy leg cannot arm honestly");

// P1 — the toggle off (the product's own door)
const putOff = await api("PUT", "/api/ai/settings", { autoJudge: false });
const stOff = await workerStatus();
offReflected = putOff.status === 200 && stOff?.autoJudge === false;
ok("P the toggle's door speaks (PUT off accepted, the status route reflects the gate)", offReflected,
  `status ${putOff.status}, autoJudge=${stOff?.autoJudge}`);

// P2 — the off window: a clean candidate armed NOW stays silent across 2+ ticks
{
  await db.job.create({
    data: {
      id: POLICY_ID, projectId: PROJECT_ID, workspaceId: stamped3d?.workspaceId ?? null,
      type: "class3d", name: "t878 policy cell", x: 2600, y: 1020,
      status: "completed", progress: 100, params: "{}",
      startedAt: new Date(Date.now() - 3600_000), updatedAt: new Date(Date.now()),
    },
  });
  const ledDoorP = JSON.stringify((await workerStatus())?.judged ?? []);
  await sleep((stOff?.tickMs ?? 30_000) * 2 + 15_000);
  const ledQ = (await workerStatus())?.judged ?? [];
  const noStamp = !stampsNow().some((x) => x.jobId === POLICY_ID);
  const noRecord = !ledQ.some((r) => r.jobId === POLICY_ID);
  const offLedgerQuiet = JSON.stringify(ledQ) === ledDoorP;
  ok("P the off-window's clean candidate stays SILENT across 2+ ticks (no stamp, no judged record)",
    noStamp && noRecord, `stamped=${!noStamp} recorded=${!noRecord}`);
  ok("P the off-window's ledger is untouched (nothing judged while the gate was off)",
    offLedgerQuiet, `${JSON.parse(ledDoorP).length} records held`);
  policySilent = noStamp && noRecord && offLedgerQuiet;
}

// P3 — delete-before-re-arm (the race made impossible), then the toggle restored
await db.job.deleteMany({ where: { id: { in: [POLICY_ID] } } });
const putOn = await api("PUT", "/api/ai/settings", { autoJudge: true });
const stOn = await workerStatus();
ok("P the off-period completion swept BEFORE the re-arm (the race made impossible)",
  !(await roster()).some((j) => j.id === POLICY_ID));
ok("P the toggle restored (PUT on accepted, the status route reflects armed)",
  putOn.status === 200 && stOn?.autoJudge === true, `autoJudge=${stOn?.autoJudge}`);

// P4 — the re-arm storms nothing (one tick of quiet)
await sleep((stOn?.tickMs ?? 30_000) + 15_000);
{
  const ledR = (await workerStatus())?.judged ?? [];
  reArmQuiet = ledR[0]?.jobId === SEAT_B && ledR[1]?.jobId === SEAT_A && ledR.length === Math.min(LEDGER_LEN_AT_DOOR + 2, 20);
  ok("P the re-arm storms nothing (the storm's seats remain the ledger's newest)", reArmQuiet,
    `judged[0]=${ledR[0]?.jobId?.slice(-8) ?? "?"}, length ${ledR.length}`);
}

// P5 — the mirror gate LIVE and ISOLATED (fresh + LINKED, armed post-watermark)
{
  await db.job.create({
    data: {
      id: MIRROR_ID, projectId: PROJECT_ID, workspaceId: stamped3d?.workspaceId ?? null,
      type: "class3d", name: "t878 mirror cell", x: 2600, y: 1180,
      status: "completed", progress: 100, params: "{}",
      linkedJobId: stamped3d?.id ?? null,
      startedAt: new Date(Date.now() - 3600_000), updatedAt: new Date(Date.now()),
    },
  });
  await sleep((stOn?.tickMs ?? 30_000) * 2 + 15_000);
  const ledM = (await workerStatus())?.judged ?? [];
  const noStampM = !stampsNow().some((x) => x.jobId === MIRROR_ID);
  const noRecordM = !ledM.some((r) => r.jobId === MIRROR_ID);
  mirrorSilent = noStampM && noRecordM;
  ok("P the mirror gate LIVE (a fresh linked drill stays invisible across 2+ ticks)", mirrorSilent,
    `stamped=${!noStampM} recorded=${!noRecordM} (no workdir either — the gate must skip it BEFORE any judge attempt)`);
  const atNow = stampsNow().find((x) => x.jobId === stamped3d?.id)?.at ?? null;
  originalUntouched = originalStampAt != null && atNow === originalStampAt;
  ok("P the original keeps its one opinion (the carrying stamp's at unchanged)", originalUntouched,
    `at ${originalStampAt} == ${atNow}`);
}

// P6 — the mirror swept, the settings door restored
await db.job.deleteMany({ where: { id: { in: [MIRROR_ID] } } });
if (settingsDoorBytes != null) {
  const tmp = `${SETTINGS_FILE}.restore-${Date.now().toString(36)}`;
  writeFileSync(tmp, settingsDoorBytes);
  renameSync(tmp, SETTINGS_FILE);
} else {
  rmSync(SETTINGS_FILE, { force: true });
}
const stFinalP = await workerStatus();
settingsRestored = stFinalP?.autoJudge === true && existsSync(SETTINGS_FILE) === settingsExisted;
ok("P the settings door restored (the file's state == the door's, the worker armed)", settingsRestored,
  settingsExisted ? "the door's bytes back" : "the door's ABSENCE back (the file stays uncreated, the defaults armed)");
} catch (e) {
  fail++;
  console.log(`  ✗ P the policy leg threw (recorded honestly): ${String(e?.message ?? e).slice(0, 160)}`);
  await db.job.deleteMany({ where: { id: { in: [POLICY_ID, MIRROR_ID] } } }).catch(() => {});
  try {
    if (settingsDoorBytes != null) {
      const tmp = `${SETTINGS_FILE}.restore-${Date.now().toString(36)}`;
      writeFileSync(tmp, settingsDoorBytes);
      renameSync(tmp, SETTINGS_FILE);
    } else {
      rmSync(SETTINGS_FILE, { force: true });
    }
  } catch { /* the B-leg's armed check will speak */ }
}

/* ---- the console-hygiene arm (the page's own events, not the channel) ---- */
evalJson('(() => { window.__t878errs = []; window.addEventListener("error", (e) => window.__t878errs.push(String(e.message || "EMPTY") + " @ " + String(e.filename || "") + ":" + e.lineno)); window.addEventListener("unhandledrejection", (e) => window.__t878errs.push("rejection: " + String(e.reason).slice(0, 160))); return "armed"; })()');
await sleep(12_000);
const pageErrs = evalJson('(() => JSON.stringify(window.__t878errs ? window.__t878errs.slice(0, 6) : "listener lost"))()');

/* ---- B — world back (the un-own law) ---- */
console.log("\n== B: the world back (the drills swept, everything byte-for-byte) ==");
await db.job.deleteMany({ where: { id: { in: SEAT_IDS } } });
for (const seatId of SEAT_IDS) rmSync(workdirOf(seatId), { recursive: true, force: true });
{
  const tmp = `${STAMPS_FILE}.restore-${Date.now().toString(36)}`;
  writeFileSync(tmp, bytesBefore, "utf8");
  renameSync(tmp, STAMPS_FILE);
}
rmSync(STATE_FILE, { force: true });
console.log("· teardown: the drill rows + workdirs gone, the stamps file restored byte-for-byte");

const roster1 = await roster();
ok("B the roster returns bit-for-bit (the storm's seats leave no fossil)", roster1.length === J0, `${J0} -> ${roster1.length}`);
ok("B the stamps file is byte-for-byte the door's bytes", stampsBytes() === bytesBefore,
  `${stampsNow().length} stamps, the real opinions untouched`);
ok("B the drill workdirs are gone from the tree", SEAT_IDS.every((id) => !existsSync(workdirOf(id))));
const w2 = openCanvas();
ok("B the canvas is back at its baseline (badges == the opening count, zero unnamed)", w2.badges === BADGE_BASELINE && w2.jobs === J0,
  `${w2.badges} badges on ${w2.jobs} cards (opening ${BADGE_BASELINE}/${J0})`);
const sEnd = await workerStatus();
ok("B the worker still mounted and armed after the storm", sEnd?.mounted === true && sEnd?.autoJudge === true && sEnd?.providerOk === true);
ok("B zero real console errors (the page's own error events)",
  Array.isArray(pageErrs) && pageErrs.length === 0,
  Array.isArray(pageErrs) ? (pageErrs.length ? pageErrs[0].slice(0, 120) : "the armed listener heard nothing in 12s") : String(pageErrs));

/* ---------- the ledger at birth (three faces) ---------- */
console.log("\nLedger — the t861 birthright aboard from birth (three faces, the shared law)");
const cmp = loadComparator(ROOT, RECEIPT, world.id);
const prevFaces = cmp.prev?.faces ?? null; // the receipt's TOP-LEVEL faces — .live is the full measure object (the t877 idiom)
const statusFace = {
  mounted: s0?.mounted === true,
  disabled: s0?.disabled === false,
  autoJudge: s0?.autoJudge === true,
  providerOk: s0?.providerOk === true,
  tickMs: s0?.tickMs ?? null,
  watermarkFinite: typeof s0?.watermark === "number",
};
const stampStatesFace = {
  stamped2d: stamped2d != null,
  stamped3d: stamped3d != null,
  stampsOnDisk: diskIds.size,
  roster: J0,
};
const worldBackFace = {
  roster: roster1.length,
  badges: w2.badges,
  workdirsLeft: SEAT_IDS.filter((id) => existsSync(workdirOf(id))).length,
  stampsRestored: stampsBytes() === bytesBefore,
};
const faces = {
  statusFace: ledgerFace(prevFaces ? prevFaces.statusFace?.live ?? null : null, statusFace, (m) => m.tickMs),
  stampStates: ledgerFace(prevFaces ? prevFaces.stampStates?.live ?? null : null, stampStatesFace, (m) => Number(m.stamped2d) + Number(m.stamped3d)),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, worldBackFace, (m) => m.roster),
  policyFace: ledgerFace(prevFaces ? prevFaces.policyFace?.live ?? null : null, {
    offReflected, policySilent, mirrorSilent, reArmQuiet, originalUntouched, settingsRestored,
  }, (m) => Number(m.offReflected) + Number(m.policySilent) + Number(m.mirrorSilent) + Number(m.reArmQuiet) + Number(m.originalUntouched) + Number(m.settingsRestored)),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f, RECEIPT_REVISION);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const stormDelta = stA && stB ? `${((stB.at - stA.at) / 1000).toFixed(1)}s` : "?";
const verdict = fail === 0
  ? `the judge-worker family's PORT holds on its first living host: the status route answered and the boot loop was witnessed TICKING (lastTickAt fresh within 2.5 ticks), autoJudge armed, the provider configured, the escape hatch quiet, the watermark persisted (the per-ERA memory), the judged ledger bounded at ${LEDGER_LEN_AT_DOOR} — the t680 labels the shadowed walk carried are this instrument's own now; the world's carrying-stamp pair was MEASURED from the roster (never pinned — the cmuwipe and EMPIAR worlds are gone, the port refuses their pins), both stamps shaped (classes[] enum verdicts, model named, at finite), the stamps file agreeing with the routes, the materials host standing at it${HOST_MATERIALS ? String(HOST_MATERIALS.iteration).padStart(3, "0") : "?"}; the queue's bench re-rode green (t578's eighteen faces — the cap, the fairness, the mirror invisibility, the watermark honesty); the LIVE STORM armed two clean candidates two seconds apart and the worker drained them ONE PER TICK, oldest first (seat A's stamp precedes seat B's by ${stormDelta}, the ledger's unshift order agreeing, both verdicts ok=true, both seats wearing hasVerdict through the jobs API, the canvas growing the Sparkles badges with the aria sentence) — the watermark-disposal fix t680 discovered is load-bearing and this port now guards it live; the exit swept the drills, restored the stamps byte-for-byte, returned the roster and the canvas to their opening shapes, and the worker stayed mounted and armed; zero real console errors (the page's own events — the errors channel's empty artifacts named and refused); the ledger aboard from birth (three faces, arm 1)`
  : `${fail} red — the judge worker moved (or the storm left residue); read the faces above before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: cmp.prev?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t878-judge-worker-family.mjs",
  instrumentRevision: RECEIPT_REVISION,
  ruler: "the judge family's ruler is the API's own truth: the status route's introspection, the stamp file's bytes, the roster's hasVerdict join, the canvas's badge DOM — no DOM-naming surface, so the shared NAMEOF ruler does not ride (the faces measure wires, not controls)",
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "status route (mounted / ticking / armed / provider / escape hatch / watermark / bounded ledger) -> the world's stamp states measured from the roster (the carrying pair, the shaped stamps, the file agreement, the materials host) -> the canvas badge baseline -> t578's bench re-ride -> the storm armed (two clean candidates, the DB pen, the latest iteration's materials) -> seat A drained (the verdict arrives without asking) -> seat B drained on a LATER tick (oldest first) -> hasVerdict through the jobs API -> the canvas badges (aria sentence) + screenshot -> the POLICY GATES (PUT off -> the gate reflected -> a clean candidate silent across 2+ ticks -> the off ledger untouched -> delete-before-re-arm -> the toggle restored -> the re-arm quiet -> the mirror gate LIVE and isolated -> the original's one opinion held -> the settings door restored) -> the console-hygiene arm -> the drills swept -> the stamps byte-for-byte -> the roster + canvas bit-for-bit (one command)",
  doors: {
    status: "GET /api/ai/judge-worker — the worker's own introspection (mounted, tickMs, watermark, judged[])",
    settings: "loadAiSettings/resolveAssistant — the autoJudge toggle and the provider the status route reads",
    stamps: "data/ai-verdicts.json — the per-job memory (one opinion per job, never overwritten by the worker)",
    watermark: "data/judge-worker.json — the per-ERA memory (the disposal boundary the t680 fix made honest)",
    planner: "src/lib/ai/judge-worker-plan.ts — the PURE eight-gate policy (t578's bench pins it bare)",
    roster: "GET /api/jobs — the hasVerdict join the canvas's badge reads",
    verdict: "GET /api/jobs/<id>/ai-verdict — the stamp's shaped face (classes[] enums, model, at)",
    toggle: "PUT/GET /api/ai/settings + data/ai-settings.json — the autoJudge toggle's door (the product-level off; the file's ABSENCE is a door state too — the defaults hold autoJudge: true)",
    pen: "db.job.create/deleteMany — the seeder's borrowed key (the engine's PATCH never writes completed)",
  },
  port: {
    from: "the t876 map's debt walk t680-judge-storm (the AI stamp's own surfaces: the status route, the autoJudge boot, the clean-candidate/carrying-stamp world states, the storm's queue)",
    law: "the label-as-will law closed loop — the debt walk's surfaces are this instrument's own labels now (S the status route answers / the worker is mounted / autoJudge on and a provider configured)",
    redrawn: [
      "the host MEASURED from the living roster (t680 pinned cmuwipe635000class3d, t574 pinned the EMPIAR world — both gone, the port refuses pins)",
      "the storm's seats are MINTED drills, never the world's own jobs (t680 re-wrote the world class3d's updatedAt; the port's mutations are the port's)",
      "the boot loop's liveness witnessed (lastTickAt fresh within 2.5 ticks — mounted alone is a promise, a fresh tick is a beat)",
      "the queue's TWO witnesses kept apart: the live storm proves the world, the t578 bench proves the policy",
      "the console-hygiene check reads the PAGE's own error events (the agent-browser errors channel carries empty-message artifacts — the t574-era errors==\"\" idiom retired)",
      "rev 2 — the policy gates LIVE on the living host (t574's Face C shape: the off silence, the delete-before-re-arm law, the re-arm quiet) + the mirror gate LIVE and ISOLATED (fresh + linked + post-watermark, so gate 4 is witnessed without the toggle or the watermark confounding it) + the settings door's un-own law grown a new shape (the file's ABSENCE is a door state — the defaults hold autoJudge: true)",
      "the ledger-growth check grown CAP-AWARE (the worker truncates judged[] at 20 — the storm's +2 per ride collides with the cap; the honest form: the door's ledger's PREFIX beneath the storm's two, tail records falling off at the cap)",
    ],
  },
  host: { projectId: PROJECT_ID, measured: true, roster: J0, judgeable: judgeables.length, stamped: stampedJobs.length },
  materials: HOST_MATERIALS ? { iteration: HOST_MATERIALS.iteration, files: HOST_MATERIALS.files.length } : null,
  storm: {
    seats: [
      { id: SEAT_A, updatedAtOffsetMs: 0, fate: "armed -> drained first (oldest) -> stamp landed -> swept" },
      { id: SEAT_B, updatedAtOffsetMs: 2000, fate: "armed -> drained on a LATER tick -> stamp landed -> swept" },
    ],
    stampDeltaSeconds: stA && stB ? (stB.at - stA.at) / 1000 : null,
    verdictsOk: recA?.ok === true && recB?.ok === true,
  },
  ledgerBaseline: { length: LEDGER_LEN_AT_DOOR, ids: [...LEDGER_IDS_AT_DOOR] },
  policy: {
    settingsDoor: settingsExisted ? "file existed (bytes snapshotted)" : "file ABSENT (the defaults hold the state)",
    offReflected, policySilent, reArmQuiet, mirrorSilent, originalUntouched, settingsRestored,
    originalStampAt,
    seats: [
      { id: POLICY_ID, shape: "clean candidate armed during the OFF window, swept before the re-arm", fate: "silent across 2+ ticks -> swept" },
      { id: MIRROR_ID, shape: "LINKED drill (linkedJobId -> the stamped class3d), armed FRESH after the re-arm (post-watermark), no workdir", fate: "invisible across 2+ ticks -> swept" },
    ],
  },
  badges: { opening: BADGE_BASELINE, storm: w1.badges, back: w2.badges, aria: w0.aria },
  consoleHygiene: { pageEvents: Array.isArray(pageErrs) ? pageErrs.length : pageErrs, channelNote: "agent-browser errors prints empty-message artifacts; the port reads the page's own events" },
  faces: {
    statusFace: { live: statusFace },
    stampStates: { live: stampStatesFace },
    worldBack: { live: worldBackFace },
    policyFace: { live: { offReflected, policySilent, mirrorSilent, reArmQuiet, originalUntouched, settingsRestored } },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
mkdirSync(join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2));

console.log(`\nJUDGE-WORKER-FAMILY t878: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
console.log(`  receipt: ${RECEIPT}`);
await db.$disconnect?.().catch(() => {});
process.exit(fail === 0 ? 0 : 1);

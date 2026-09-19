/* t186 — the simulate route earns its face (queue simulation, visible).
 *
 * POST /api/hpc/simulate has stood complete since the HPC layer landed:
 * a Slurm-shaped scheduler replaying the ACTIVE project's real job graph
 * (afterok dependency edges, GPU strategy table, array shards, REAL
 * measured durations scaled by the profile speedup) — with ZERO UI
 * consuming it. Task 186 mounts HpcQueueSim inside the sbatch dialog:
 * a run form (GPUs/nodes/array-conc/speedup), a KPI band (makespan, GPU
 * util, avg wait, GPU-hours) and a Gantt of the schedule, one row per
 * job with array shards as segments on the shared row.
 *
 * Contract notes the probe pins:
 *   - "Server view shown" (Task 185 doctrine, second appearance): the
 *     numeric inputs are re-synced from the RESPONSE — the UI shows what
 *     the server kept (clamps included), never what was sent.
 *   - The Gantt is a scheduler oracle, not a picture: a bar never starts
 *     before all of its wire dependencies have ended, and the GPU pool is
 *     never oversubscribed at any instant (squeue semantics made checkable).
 *   - Durations scale: a ×500 cluster shrinks the makespan vs a ×1 cluster.
 * B reads the REAL wire (default POST, hostile-clamp POST, speedup pair),
 * D drives the REAL dialog through the loop at desktop width, Z proves
 * the whole thing was read-only (roster identity, default world intact).
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");
const PROFILE_FILE = path.resolve("data/hpc-profiles.json");

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
const post = async (body) => {
  const r = await fetch(BASE + "/api/hpc/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return { status: r.status, d: await r.json() };
};
const parseMin = (s) => {
  const m = /(?:(\d+)h)?\s*(\d+(?:\.\d+)?)m/.exec(s ?? "");
  if (!m) return NaN;
  return (Number(m[1] ?? 0) * 60) + Number(m[2]);
};

const browser = await chromium.launch();
const consoleErrors = [];
const failedUrls = [];
function trackConsole(pageRef, label) {
  pageRef.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ label, text: msg.text() });
  });
  pageRef.on("response", (res) => {
    if (res.status() >= 400) failedUrls.push({ label, url: res.url(), status: res.status() });
  });
}

/* ================= S — baseline ================= */
section("S: baseline world");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
must(jobs0.length === 23, `S1 roster 23 jobs (${jobs0.length})`);
const idleJobs = jobs0.filter((j) => j.status === "idle");
must(idleJobs.length > 0, `S2 idle jobs exist for the aside door (${idleJobs.length})`);
const doorJob = idleJobs.slice().sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
must(!!doorJob, `S3 door job picked (${doorJob?.name ?? "none"})`);
must(!existsSync(PROFILE_FILE), "S4 canonical default world — no hpc-profiles.json persisted");
const sim0 = await post({});
must(sim0.status === 200 && Array.isArray(sim0.d.bars), `S5 simulate reachable — ${sim0.d?.bars?.length ?? 0} bars`);

/* ================= X — source oracles ================= */
section("X: the route's face is written once");
const simSrc = src("src/components/workflow/hpc-queue-sim.tsx");
const sbatchSrc = src("src/components/workflow/hpc-sbatch-dialog.tsx");

must(simSrc.includes('fetch("/api/hpc/simulate"') && simSrc.includes('method: "POST"'), "X1 the panel consumes the simulate route");
must(simSrc.includes('from "@/lib/workflow"') && simSrc.includes("jobType("), "X2 Gantt labels speak the job-type registry (not raw keys)");
must(
  simSrc.includes('"Makespan"') && simSrc.includes('"GPU util"') && simSrc.includes('"Avg wait"') && simSrc.includes('"GPU hours"'),
  "X3 the KPI band carries all four scheduler facts"
);
must(
  simSrc.includes("d.cluster?.gpus") && simSrc.includes("d.speedup") && simSrc.includes("setParams(echoed)"),
  "X4 server view shown — inputs re-sync from the RESPONSE echo"
);
must(simSrc.includes("clamped to the server"), "X5 the clamp footnote names the contract");
must(
  simSrc.includes("gpusTouched") && simSrc.includes("gpusPerNode"),
  "X6 the profile's node shape prefills the pool — a user-typed value wins"
);
must(
  simSrc.includes("Math.max(0.6, span)") && simSrc.includes("(s.start / makespan) * 100"),
  "X7 Gantt segments position on the shared time scale with a visible floor"
);
must(simSrc.includes('state === "PENDING"'), "X8 pending episodes are counted, not swallowed");
must(
  sbatchSrc.includes("<HpcQueueSim") && sbatchSrc.includes("gpusPerNode={profiles.find"),
  "X9 the sbatch dialog mounts the panel with the selected profile's node shape"
);
must(
  (simSrc.match(/const TYPE_COLOR[^=]*= \{[\s\S]*?\n\};/) ?? [""])[0].split(":").length >= 11 && simSrc.includes("FALLBACK_COLOR"),
  "X10 every pipeline family has a bar color — unknown types fall back"
);

/* ================= B — live wire ================= */
section("B: the scheduler speaks Slurm semantics");
const def = sim0.d;
must(def.bars.length >= 20, `B1 ${def.bars.length} bars — 26 jobs plus array shards`);
must(def.events.length >= def.bars.length, `B2 events ≥ bars (${def.events.length} ≥ ${def.bars.length})`);
must(def.makespanMin > 0, `B3 makespan ${def.makespanMin}m > 0`);
must(def.gpuUtilization > 0 && def.gpuUtilization <= 1, `B4 GPU util ${Math.round(def.gpuUtilization * 100)}% in (0,100]`);
must(def.avgWaitMin >= 0, `B5 avg wait ${def.avgWaitMin}m ≥ 0`);
must(def.totalGpuHours > 0, `B6 ${def.totalGpuHours} GPU-hours > 0`);
must(
  def.cluster?.gpus === 8 && def.cluster?.nodes === 4 && def.cluster?.arrayConcurrency === 8 && def.speedup === 25,
  "B7 the response echoes the default cluster shape (8/4/8/×25)"
);
must(
  Number.isFinite(def.data?.micrographs) && def.data.micrographs >= 1 &&
  Number.isFinite(def.data?.particles) && def.data.particles >= 100,
  `B8 data counts sane (${def.data?.micrographs} micros / ${def.data?.particles} particles)`
);
must(/Simulation/.test(def.note ?? ""), "B9 the note names itself a simulation");

const hostile = await post({ clusterGpus: 999, nodes: 999, arrayConcurrency: -3, gpuSpeedup: 100000 });
must(
  hostile.d.cluster?.gpus === 64 && hostile.d.cluster?.nodes === 16 &&
  hostile.d.cluster?.arrayConcurrency === 1 && hostile.d.speedup === 500,
  "B10 hostile shape clamped to the contract (64/16/1/×500)"
);

const fast = await post({ gpuSpeedup: 500 });
const slow = await post({ gpuSpeedup: 1 });
must(
  fast.d.makespanMin < slow.d.makespanMin,
  `B11 a ×500 cluster beats ×1 (${fast.d.makespanMin}m < ${slow.d.makespanMin}m)`
);

// Scheduler oracle 1 — dependency semantics: no bar starts before all of
// its wire dependencies have ended (afterok made checkable).
const projId = def.project.id;
const edges = (await (await fetch(`${BASE}/api/edges?projectId=${projId}`)).json()).edges ?? [];
const maxEnd = new Map();
const minStart = new Map();
for (const b of def.bars) {
  maxEnd.set(b.key, Math.max(maxEnd.get(b.key) ?? -Infinity, b.end));
  minStart.set(b.key, Math.min(minStart.get(b.key) ?? Infinity, b.start));
}
let depViolations = 0;
for (const e of edges) {
  if (!def.bars.some((b) => b.key === e.toJobId)) continue;
  const depEnd = maxEnd.get(e.fromJobId);
  if (depEnd === undefined) continue;
  if ((minStart.get(e.toJobId) ?? 0) < depEnd - 1e-6) depViolations++;
}
must(
  edges.length > 0 && depViolations === 0,
  `B12 dependency semantics — ${edges.length} wire edges, ${depViolations} afterok violations`
);

// Scheduler oracle 2 — the GPU pool is never oversubscribed at any instant.
const pool = def.cluster.gpus;
let poolPeak = 0;
for (const t of def.bars.map((b) => b.start)) {
  const busy = def.bars
    .filter((b) => b.start <= t && t < b.end)
    .reduce((acc, b) => acc + Math.max(0, b.gpus), 0);
  poolPeak = Math.max(poolPeak, busy);
}
must(poolPeak <= pool, `B13 GPU pool respected — peak ${poolPeak} ≤ ${pool}`);
must(
  Math.abs(Math.max(...def.bars.map((b) => b.end)) - def.makespanMin) <= 0.5,
  "B14 the makespan IS the last bar's end (one truth, ±rounding)"
);

/* ================= D — the UI loop ================= */
section("D: the door, the form, the Gantt");
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await dctx.newPage();
trackConsole(dpage, "desktop");
await dpage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const dHpc = dpage.locator('button[aria-label="Generate Slurm sbatch script for this job"]').first();
let dPanel = false;
for (let i = 0; i < 6 && !dPanel; i++) {
  const card = dpage.locator(`[data-job="${doorJob.id}"]`).first();
  try {
    await card.click({ timeout: 2500, force: i >= 3 });
  } catch { /* retry */ }
  await sleep(1300);
  dPanel = await dHpc.isVisible().catch(() => false);
}
must(dPanel, "D1 the aside opens and the HPC entry shows");
if (dPanel) {
  await dHpc.click();
  await sleep(1400);
  must(
    await dpage.getByText("Queue simulation").first().isVisible().catch(() => false),
    "D2 the queue-simulation section header shows in the dialog"
  );
  await dpage.locator('button[aria-label="Run queue simulation"]').click();
  await sleep(1600);
  // The controls mount with the expanded section; the value in the box is
  // the server's echo of the POST body — "4" proves the profile's node
  // shape prefilled the pool before the run (default state is 8).
  const gpuInput = dpage.locator('section[aria-label="Queue simulation"] input[aria-label="GPUs"]');
  const prefill = await gpuInput.inputValue().catch(() => "");
  must(prefill === "4", `D3 the pool prefills from the profile's node shape (${prefill} = slurm-gpu-cluster's 4, echoed)`);

  const kpi = dpage.locator('[aria-label="Simulation KPIs"]');
  must(await kpi.isVisible().catch(() => false), "D4 the KPI band renders after Run");
  const kpiText = (await kpi.textContent().catch(() => "")) ?? "";
  must(
    /Makespan/.test(kpiText) && /GPU util/.test(kpiText) && /Avg wait/.test(kpiText) && /GPU hours/.test(kpiText),
    "D5 all four KPI cells speak"
  );
  const m4 = parseMin((await dpage.locator('[aria-label^="Makespan"]').getAttribute("aria-label").catch(() => "")) ?? "");
  must(Number.isFinite(m4) && m4 > 0, `D6 makespan parses from the DOM (${m4}m)`);

  const gantt = dpage.locator('[aria-label="Simulated schedule (Gantt)"]');
  must(await gantt.isVisible().catch(() => false), "D7 the Gantt renders");
  const segs = gantt.locator('div[title*="×GPU"], div[title*="CPU"]');
  const segCount = await segs.count().catch(() => 0);
  must(segCount >= 20, `D8 ${segCount} schedule segments render with slurm-style tooltips`);
  const firstSegTitle = (await segs.first().getAttribute("title").catch(() => "")) ?? "";
  must(
    /_?\d+ · .+ · (GPU|CPU)|\d{4}/.test(firstSegTitle) && /·/.test(firstSegTitle),
    `D9 a segment tooltip carries slurmId · label · resources (“${firstSegTitle.slice(0, 44)}”)`
  );

  // server view shown, live: an out-of-contract pool comes back as the
  // server's answer, and the clamp footnote names the contract.
  await gpuInput.fill("999");
  await dpage.locator('button[aria-label="Run queue simulation"]').click();
  await sleep(1600);
  const echoed = await gpuInput.inputValue().catch(() => "");
  must(echoed === "64", `D10 the input re-syncs to the server's clamp (${echoed} = 64)`);
  must(
    await dpage.getByText("clamped to the server").isVisible().catch(() => false),
    "D11 the clamp footnote speaks"
  );

  // one GPU serializes the GPU jobs — the makespan must grow vs the ×4 pool
  await gpuInput.fill("1");
  await dpage.locator('button[aria-label="Run queue simulation"]').click();
  await sleep(1600);
  const m1 = parseMin((await dpage.locator('[aria-label^="Makespan"]').getAttribute("aria-label").catch(() => "")) ?? "");
  must(Number.isFinite(m1) && m1 > m4, `D12 pool 1 stretches the makespan (${m1}m > ${m4}m)`);

  await dpage.keyboard.press("Escape");
  await sleep(900);
  must(
    !(await dpage.getByText("Queue simulation").first().isVisible().catch(() => false)),
    "D13 Escape closes the dialog"
  );
}
await dctx.close();

/* ================= Z — roster identity + read-only proof ================= */
section("Z: the world was only read");
const afterList = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(afterList.length === jobs0.length, `Z1 roster size unchanged (${afterList.length})`);
const afterIds = new Set(afterList.map((j) => j.id));
must(jobs0.every((j) => afterIds.has(j.id)), "Z2 roster identity — nothing stayed behind");
must(!existsSync(PROFILE_FILE), "Z3 the registry file was never written");
const badTraffic = failedUrls.filter((u) => (u.status ?? 0) >= 500 || u.status === 404);
must(badTraffic.length === 0, `Z4 no 5xx/404 browser traffic (${badTraffic.length})`);
must(consoleErrors.length === 0, `Z5 console clean (${consoleErrors.length})`);

console.log(
  failures.length === 0
    ? `\nT186 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT186 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);

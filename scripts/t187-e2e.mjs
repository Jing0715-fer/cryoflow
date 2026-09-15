/* t187 — the sweep closes the loop (same graph, every hardware class).
 *
 * Task 186 gave the simulate route a single-shape face; Task 187 adds
 * the comparison: "Compare profiles" races every GPU profile with ITS
 * OWN declared shape — pool = nodes × GPUs/node, its own array throttle,
 * its own speed multiplier — never the form's numbers. The fastest wears
 * the crown; clicking a row ADOPTS its shape into the form and re-runs
 * the single Gantt (compare → adopt → inspect, one loop).
 *
 * The default registry makes an honest race: slurm-gpu-cluster (4 nodes
 * × 4 A100 = 16 GPUs, %16, ×25) vs slurm-h100-hub (2 nodes × 8 H100 =
 * 16 GPUs, %32, ×40) — same pool size, different multiplier and
 * throttle, so H100 must win on makespan and spend fewer GPU-hours.
 * local-workstation (0 GPUs/node) is excluded by the sweep's filter.
 *
 * X pins the loop in source (filter, shape derivation, progressive
 * rows, winner reduce, adopt's gpusTouched guard, MODEL_BADGE single
 * definition). B posts both shapes at the wire and asserts the race
 * outcome PLUS the dependency oracle still holds under the sweep shapes.
 * D drives compare → crown → adopt → form echo → Gantt re-run. Z proves
 * read-only (roster identity, registry file never written).
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
must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);
const idleJobs = jobs0.filter((j) => j.status === "idle");
must(idleJobs.length > 0, `S2 idle jobs exist for the aside door (${idleJobs.length})`);
const doorJob = idleJobs.slice().sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
must(!!doorJob, `S3 door job picked (${doorJob?.name ?? "none"})`);
const profiles0 = (await (await fetch(BASE + "/api/hpc/profiles")).json()).profiles ?? [];
const gpuProfiles = profiles0.filter((p) => p.gpusPerNode >= 1);
must(
  !existsSync(PROFILE_FILE) && profiles0.length === 3 && gpuProfiles.length === 2,
  `S4 default world — trio registry, ${gpuProfiles.length} GPU profiles race-ready`
);

/* ================= X — source oracles ================= */
section("X: the sweep is written once");
const simSrc = src("src/components/workflow/hpc-queue-sim.tsx");

must(simSrc.includes('aria-label="Compare cluster profiles"'), "X1 the Compare trigger exists with its own name");
must(simSrc.includes("gpusPerNode >= 1"), "X2 the sweep filter excludes GPU-less profiles (workstation stays home)");
must(
  simSrc.includes("clusterGpus: p.gpusPerNode * p.nodes"),
  "X3 each row's pool is the profile's OWN declared shape (nodes × GPUs/node)"
);
must(
  simSrc.includes("arrayConcurrency: p.arrayConcurrency") && simSrc.includes("gpuSpeedup: p.gpuSpeedup"),
  "X4 throttle and multiplier come from the profile, never the form"
);
must(simSrc.includes("setSweep([...rows])"), "X5 rows land progressively — the race renders as it runs");
must(
  simSrc.includes("r.r!.makespanMin < w.r!.makespanMin"),
  "X6 the crown is a min-makespan reduce (ties keep the first)"
);
must(
  simSrc.includes("gpusTouched.current = true") && simSrc.includes("void run({"),
  "X7 adopt owns the shape (prefill can never stomp it) and re-runs through the override"
);
must(
  simSrc.includes('import { MODEL_BADGE } from "./hpc-profiles-editor"'),
  "X8 GPU badges speak one definition (imported from the editor)"
);

/* ================= B — live wire ================= */
section("B: the race is real at the wire");
const a100 = await post({ clusterGpus: 16, arrayConcurrency: 16, gpuSpeedup: 25 });
must(
  a100.status === 200 && a100.d.cluster?.gpus === 16 && a100.d.cluster?.arrayConcurrency === 16 && a100.d.speedup === 25,
  "B1 the A100 shape echoes intact (16 GPUs · %16 · ×25)"
);
const h100 = await post({ clusterGpus: 16, arrayConcurrency: 32, gpuSpeedup: 40 });
must(
  h100.status === 200 && h100.d.cluster?.gpus === 16 && h100.d.cluster?.arrayConcurrency === 32 && h100.d.speedup === 40,
  "B2 the H100 shape echoes intact (16 GPUs · %32 · ×40)"
);
must(
  h100.d.makespanMin <= a100.d.makespanMin,
  `B3 H100 beats or ties A100 on the same 16-GPU pool (${h100.d.makespanMin}m ≤ ${a100.d.makespanMin}m)`
);
must(
  h100.d.totalGpuHours <= a100.d.totalGpuHours,
  `B4 the faster multiplier also spends fewer GPU-hours (${h100.d.totalGpuHours}h ≤ ${a100.d.totalGpuHours}h)`
);
const edges = (await (await fetch(`${BASE}/api/edges?projectId=${h100.d.project.id}`)).json()).edges ?? [];
const maxEnd = new Map();
const minStart = new Map();
for (const b of h100.d.bars) {
  maxEnd.set(b.key, Math.max(maxEnd.get(b.key) ?? -Infinity, b.end));
  minStart.set(b.key, Math.min(minStart.get(b.key) ?? Infinity, b.start));
}
let depViolations = 0;
for (const e of edges) {
  if (!h100.d.bars.some((b) => b.key === e.toJobId)) continue;
  const depEnd = maxEnd.get(e.fromJobId);
  if (depEnd === undefined) continue;
  if ((minStart.get(e.toJobId) ?? 0) < depEnd - 1e-6) depViolations++;
}
must(
  edges.length > 0 && depViolations === 0,
  `B5 the dependency oracle holds under sweep shapes too (${edges.length} edges, ${depViolations} violations)`
);
let poolPeak = 0;
for (const t of h100.d.bars.map((b) => b.start)) {
  const busy = h100.d.bars
    .filter((b) => b.start <= t && t < b.end)
    .reduce((acc, b) => acc + Math.max(0, b.gpus), 0);
  poolPeak = Math.max(poolPeak, busy);
}
must(poolPeak <= 16, `B6 the 16-GPU pool is never oversubscribed (peak ${poolPeak})`);

/* ================= D — the UI loop ================= */
section("D: compare → crown → adopt → inspect");
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
    "D2 the queue-simulation section header shows"
  );
  await dpage.locator('button[aria-label="Run queue simulation"]').click();
  await sleep(1600);
  const m4 = parseMin((await dpage.locator('[aria-label="Simulation KPIs"] [aria-label^="Makespan"]').getAttribute("aria-label").catch(() => "")) ?? "");
  must(Number.isFinite(m4) && m4 > 0, `D3 the single-shape run lands (${m4}m at the prefilled pool)`);

  await dpage.locator('button[aria-label="Compare cluster profiles"]').click();
  await sleep(2600);
  const comp = dpage.locator('[aria-label="Profile comparison"]');
  must(await comp.isVisible().catch(() => false), "D4 the comparison block renders");
  must(
    await dpage.getByText("2/2 simulated").isVisible().catch(() => false),
    "D5 both GPU profiles raced (2/2 simulated)"
  );
  const crownCount = await dpage.locator('span:has-text("fastest")').count().catch(() => 0);
  must(crownCount === 1, `D6 exactly one profile wears the crown (${crownCount})`);

  const rows = dpage.locator('button[aria-label^="Adopt"]');
  const rowCount = await rows.count().catch(() => 0);
  must(rowCount === 2, `D7 two adoptable rows render (${rowCount})`);
  const byName = {};
  for (let i = 0; i < rowCount; i++) {
    const label = (await rows.nth(i).getAttribute("aria-label").catch(() => "")) ?? "";
    const m = parseMin(/—\s*(.+?)\s+makespan/.exec(label)?.[1] ?? "");
    if (/H100/i.test(label)) byName.h100 = m;
    else if (/A100/i.test(label)) byName.a100 = m;
  }
  must(
    Number.isFinite(byName.h100) && Number.isFinite(byName.a100) && byName.h100 <= byName.a100,
    `D8 the crown sits on the faster row (H100 ${byName.h100}m ≤ A100 ${byName.a100}m)`
  );

  // adopt the A100 row: the form takes the profile's shape and the
  // single Gantt re-runs on it
  const a100Row = rows.filter({ hasText: "A100" }).first();
  await a100Row.click();
  await sleep(1800);
  const gpuVal = await dpage.locator('section[aria-label="Queue simulation"] input[aria-label="GPUs"]').inputValue().catch(() => "");
  must(gpuVal === "16", `D9 adoption lands in the form (GPUs = ${gpuVal})`);
  const mAdopted = parseMin((await dpage.locator('[aria-label="Simulation KPIs"] [aria-label^="Makespan"]').getAttribute("aria-label").catch(() => "")) ?? "");
  must(
    Number.isFinite(mAdopted) && mAdopted !== m4,
    `D10 the schedule re-ran on the adopted shape (${m4}m → ${mAdopted}m)`
  );

  await dpage.keyboard.press("Escape");
  await sleep(900);
  must(
    !(await dpage.getByText("Queue simulation").first().isVisible().catch(() => false)),
    "D11 Escape closes the dialog"
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
    ? `\nT187 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT187 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);

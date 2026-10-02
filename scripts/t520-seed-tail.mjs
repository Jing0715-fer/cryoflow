/**
 * t520 world-seed tail — finishes what the reaped t474ui seed started.
 *
 * The seed's poller was reaped mid-run, but the class2d dispatch it fired
 * lives on the product's engine (the run is the server's, not the
 * poller's). This tail waits for that class2d to reach its terminal state,
 * then performs the seed's remaining steps verbatim:
 *   · the select2d job (the 2D-selection gallery's feed)
 *   · the two edges (particles + classAverages)
 *   · the STACKLESS surgery (mirror classes.mrcs removed, preview cache
 *     cold — the user's field-report world)
 *   · the state file the browser phase reads
 *
 * Run: node scripts/t520-seed-tail.mjs   (server + mock cluster must be up)
 */
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const DATA_DIR = path.join(ROOT, "data");
const PREVIEW_LIVE = path.join(DATA_DIR, "remote-preview", "live");
const STATE_OUT = path.join(DATA_DIR, "qa-t474ui-state.json");
const CONN = "qa-t474ui";

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. locate the seeded world (the project the dead seed left mid-flight)
  const { body: projList } = await api("/api/projects", { headers: SH });
  const proj = (projList?.projects ?? []).find((p) => p.name === "QA t474 UI gallery");
  if (!proj) throw new Error("project 'QA t474 UI gallery' not found — the seed's head never landed");
  const projectId = proj.id;
  const { body: jobsBody } = await api("/api/jobs", { headers: SH });
  const jobs = jobsBody?.jobs ?? [];
  const importJob = jobs.find((j) => j.type === "import" && j.projectId === projectId);
  const clsJob = jobs.find((j) => j.type === "class2d" && j.projectId === projectId);
  if (!importJob || !clsJob) throw new Error("import/class2d jobs not found in the seeded project");
  console.log(`world: project=${projectId} import=${importJob.id}(${importJob.status}) class2d=${clsJob.id}(${clsJob.status})`);

  // 2. wait for the class2d to settle (the mock's 200 iterations)
  let done = null;
  const end = Date.now() + 420_000;
  while (Date.now() < end) {
    const { body } = await api("/api/jobs", { headers: SH });
    const j = (body?.jobs ?? []).find((x) => x.id === clsJob.id);
    if (j && j.status !== "running" && j.status !== "pending") { done = j; break; }
    process.stdout.write(`\r  class2d ${j?.progress ?? "?"}% (${j?.status ?? "?"})   `);
    await sleep(3000);
  }
  console.log("");
  if (done?.status !== "completed") throw new Error(`class2d did not complete: ${done?.status ?? "timeout"}`);

  // 3. the select2d job (the seed's exact placement)
  if (jobs.some((j) => j.type === "select2d" && j.projectId === projectId)) {
    console.log("select2d already wired — idempotent exit");
  } else {
    const { body: mk } = await api("/api/jobs", {
      method: "POST", headers: SHJ,
      body: JSON.stringify({ projectId, type: "select2d", name: "2D Class Selection", x: 780, y: 260 }),
    });
    const selJob = mk?.job;
    if (!selJob?.id) throw new Error(`select2d creation failed: ${JSON.stringify(mk)?.slice(0, 200)}`);
    await api("/api/edges", {
      method: "POST", headers: SH,
      body: JSON.stringify({ fromJobId: clsJob.id, toJobId: selJob.id, fromPort: "particles", toPort: "particles" }),
    });
    await api("/api/edges", {
      method: "POST", headers: SH,
      body: JSON.stringify({ fromJobId: clsJob.id, toJobId: selJob.id, fromPort: "classAverages", toPort: "classes" }),
    });
  }

  // 4. THE USER'S WORLD: stacks only on the cluster, preview cache cold
  const mirror = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
  const removed = readdirSync(mirror).filter((f) => /classes\.mrcs?$/i.test(f));
  for (const f of removed) rmSync(path.join(mirror, f), { force: true });
  rmSync(path.join(PREVIEW_LIVE, clsJob.id), { recursive: true, force: true });

  writeFileSync(STATE_OUT, JSON.stringify({
    projectId, connId: CONN,
    importId: importJob.id, class2dId: clsJob.id,
    selectId: (await api("/api/jobs", { headers: SH })).body?.jobs
      ?.find((j) => j.type === "select2d" && j.projectId === projectId)?.id ?? null,
    mirror, removedStacks: removed.length,
  }, null, 2));
  console.log(`SEEDED (tail): class2d=${clsJob.id} — removed ${removed.length} mirror stacks — state: ${STATE_OUT}`);
}

main().catch((e) => {
  console.error("t520 seed-tail failed:", e);
  process.exit(1);
});

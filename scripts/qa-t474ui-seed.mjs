/**
 * SEED t474-ui — reproduce the user's field report:
 * 「选 cluster 运行的 2D 分类时图片加载不出来，每个框都显示 no image，
 *   并且每个框大小不是完全一致」
 *
 * The user's world (from the report):
 *   · a CLUSTER-run 2D classification — "2D Classification 1 · iter 200"
 *     (200 iterations — a long, real run)
 *   · occupancy data PRESENT (Kept only · 9 — auto kept 9 classes)
 *   · every thumbnail card = "no image"
 *   · cards not exactly the same size
 *
 * Leaves in place (no cleanup — the browser phase inspects it):
 *   · a completed REMOTE class2d (200 iterations, 12 classes) whose mirror
 *     is STACKLESS (the key-files world: the .mrcs live only on the mock
 *     cluster, the data stars home)
 *   · a select job wired to it (the 2D-selection gallery's feed)
 */
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "fs";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t474ui";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const DATA_DIR = path.join(ROOT, "data");
const PREVIEW_LIVE = path.join(DATA_DIR, "remote-preview", "live");

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 60_000,
  }).stdout?.trim() ?? "";
const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const awaitTerminal = async (id, deadlineMs) => {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    const { body } = await api("/api/jobs", { headers: SH });
    const j = (body?.jobs ?? []).find((x) => x.id === id);
    if (j && j.status !== "running" && j.status !== "pending") return j;
    await sleep(1500);
  }
  return null;
};

const createdJobs = [];
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  return b?.job;
};

const STATE_OUT = path.join(ROOT, "data", "qa-t474ui-state.json");

async function main() {
  // connection
  await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t474 UI", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t474 UI gallery", mode: "remote", remoteConnectionId: CONN }),
  });
  const projectId = proj.body?.project?.id;

  // fixtures — a 24-particle stack with real blobs
  const stackB64 = (() => {
    const data = Buffer.alloc(1024);
    data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
    return data.toString("base64");
  })();
  client(
    "mkdir -p /data2/t474ui-particles; " +
      `echo ${stackB64} | base64 -d > /data2/t474ui-particles/stack24.mrcs; ` +
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t474ui-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/t474ui-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t474ui-particles/particles.star; done"
  );

  const importParts = await mkJob({
    projectId, type: "import", name: "t474 particles", x: 140, y: 260,
    params: { micrographsPath: "/data2/t474ui-particles/particles.star", nodeType: "particles" },
  });
  await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  await awaitTerminal(importParts.id, 60_000);

  const clsJob = await mkJob({
    projectId, type: "class2d", name: "2D Classification 1", x: 460, y: 260,
    params: { iterations: 200, numClasses: 12 },
  });
  await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId: importParts.id, toJobId: clsJob.id, fromPort: "particles", toPort: "particles" }),
  });
  console.log("dispatching class2d (200 iterations ≈ 3 min on the mock)…");
  await api(`/api/jobs/${clsJob.id}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
  });
  const done = await awaitTerminal(clsJob.id, 400_000);
  if (done?.status !== "completed") throw new Error(`class2d did not complete: ${done?.status}`);

  // the select2d job (the 2D-selection gallery host)
  const selJob = await mkJob({
    projectId, type: "select2d", name: "2D Class Selection", x: 780, y: 260,
  });
  await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId: clsJob.id, toJobId: selJob.id, fromPort: "particles", toPort: "particles" }),
  });
  await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId: clsJob.id, toJobId: selJob.id, fromPort: "classAverages", toPort: "classes" }),
  });

  // THE USER'S WORLD: stacks only on the cluster, preview cache cold
  const mirror = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
  const removed = readdirSync(mirror).filter((f) => /classes\.mrcs?$/i.test(f));
  for (const f of removed) rmSync(path.join(mirror, f), { force: true });
  rmSync(path.join(PREVIEW_LIVE, clsJob.id), { recursive: true, force: true });

  const { writeFileSync } = await import("fs");
  writeFileSync(STATE_OUT, JSON.stringify({
    projectId, connId: CONN,
    importId: importParts.id, class2dId: clsJob.id, selectId: selJob.id,
    mirror, removedStacks: removed.length,
  }, null, 2));
  console.log(`SEEDED: project=${projectId} class2d=${clsJob.id} select=${selJob.id} (removed ${removed.length} mirror stacks)`);
  console.log(`state: ${STATE_OUT}`);
}

main().catch((e) => {
  console.error("SEED t474-ui failed:", e);
  process.exit(1);
});

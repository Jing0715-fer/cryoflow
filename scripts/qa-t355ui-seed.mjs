/**
 * SEED t355-ui — the browser-verification stage for the cluster-gallery fix.
 *
 * Leaves in place (no cleanup — the browser phase inspects it, the harvest
 * step removes it):
 *   · a completed REMOTE class2d whose mirror is STACKLESS (the key-files
 *     world: the .mrcs live only on the mock cluster, the data stars home)
 *   · a select job wired to it (the 2D-selection gallery's feed)
 *
 * Prints the ids the browser phase needs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "fs";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t355ui";
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
    await sleep(700);
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

// the state file the browser phase + harvest read
const STATE_OUT = path.join(ROOT, "data", "qa-t355ui-state.json");

async function main() {
  // connection
  await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t355 UI", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t355 UI gallery", mode: "remote", remoteConnectionId: CONN }),
  });
  const projectId = proj.body?.project?.id;

  // fixtures
  const stackB64 = (() => {
    const data = Buffer.alloc(1024);
    data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
    return data.toString("base64");
  })();
  client(
    "mkdir -p /data2/t355ui-particles; " +
      `echo ${stackB64} | base64 -d > /data2/t355ui-particles/stack24.mrcs; ` +
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t355ui-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/t355ui-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t355ui-particles/particles.star; done"
  );

  const importParts = await mkJob({
    projectId, type: "import", name: "t355 particles", x: 140, y: 260,
    params: { micrographsPath: "/data2/t355ui-particles/particles.star", nodeType: "particles" },
  });
  await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  await awaitTerminal(importParts.id, 60_000);

  const clsJob = await mkJob({
    projectId, type: "class2d", name: "t355 cluster 2D", x: 460, y: 260,
    params: { iterations: 8, numClasses: 3 },
  });
  await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId: importParts.id, toJobId: clsJob.id, fromPort: "particles", toPort: "particles" }),
  });
  await api(`/api/jobs/${clsJob.id}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
  });
  const done = await awaitTerminal(clsJob.id, 150_000);
  if (done?.status !== "completed") throw new Error(`class2d did not complete: ${done?.status}`);

  // the select2d job (the 2D-selection gallery host — its Params tab IS the gallery)
  const selJob = await mkJob({
    projectId, type: "select2d", name: "t355 class selection", x: 780, y: 260,
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
  for (const f of removed) rmSync(path.join(mirror, f));
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
  console.error("SEED t355-ui failed:", e);
  process.exit(1);
});

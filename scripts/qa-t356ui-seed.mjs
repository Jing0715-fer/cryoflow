/**
 * SEED t356-ui — the browser-verification stage for the PROACTIVE render
 * pipeline (the user's「下载 mrcs 到本地，再转成图片」architecture).
 *
 * Leaves in place (no cleanup — the browser phase inspects it, the harvest
 * removes it):
 *   · a completed REMOTE class2d whose finalize pipeline rendered every
 *     round into the LOCAL preview cache, then whose mirror stacks were
 *     deleted (the key-files world: .mrcs only on the cluster — the
 *     images live in the local PNG cache)
 *   · a RELION 5 final unmasked stack planted on the cluster (the select
 *     gallery's preferred source)
 *   · a select job wired to it (the 2D-selection gallery's feed)
 *
 * Prints the ids the browser phase needs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t356ui";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const DATA_DIR = path.join(ROOT, "data");
const PREVIEW_LIVE = path.join(DATA_DIR, "remote-preview", "live");
const STATE_OUT = path.join(ROOT, "data", "qa-t356ui-state.json");

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
const renderedRounds = (jobId) => {
  const dir = path.join(PREVIEW_LIVE, jobId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => {
    try {
      const inner = path.join(dir, n);
      if (!statSync(inner).isDirectory()) return false;
      const files = readdirSync(inner);
      return (files.includes(".done") || files.includes("sheet.png"))
        && files.some((f) => /^slice\d{4}\.png$/.test(f));
    } catch {
      return false;
    }
  });
};

const createdJobs = [];
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  return b?.job;
};

async function main() {
  await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t356 UI", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t356 UI proactive", mode: "remote", remoteConnectionId: CONN }),
  });
  const projectId = proj.body?.project?.id;
  // t353's lesson: the ACTIVE-project pointer decides which project the run
  // route speaks — pin it explicitly so the import rides THIS project's
  // remote lane (a stale pointer sent it engine-native against host paths)
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });

  // fixtures — the header-only probe stack (the import's sniffer reads the
  // 1024-byte header; the mock refine writes its OWN real class stacks per
  // round). A full-voxel stack would put a ~300 KB base64 payload on one
  // exec line — over the channel's command limit, and the WHOLE fixture
  // write dies silently (the seed's first attempt never wrote the star)
  const stackB64 = (() => {
    const data = Buffer.alloc(1024);
    data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
    return data.toString("base64");
  })();
  client(
    "mkdir -p /data2/t356ui-particles; " +
      `echo ${stackB64} | base64 -d > /data2/t356ui-particles/stack24.mrcs; ` +
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t356ui-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/t356ui-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t356ui-particles/particles.star; done"
  );

  const importParts = await mkJob({
    projectId, type: "import", name: "t356 particles", x: 140, y: 260,
    params: { micrographsPath: "/data2/t356ui-particles/particles.star", nodeType: "particles" },
  });
  await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  await awaitTerminal(importParts.id, 60_000);

  const clsJob = await mkJob({
    projectId, type: "class2d", name: "t356 cluster 2D", x: 460, y: 260,
    params: { iterations: 6, numClasses: 3 },
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

  // THE PIPELINE: wait for the finalize render (the browser phase then
  // never needs a single cluster byte)
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000 && renderedRounds(clsJob.id).length < 6) {
    await sleep(600);
  }
  const rounds = renderedRounds(clsJob.id);
  if (rounds.length < 6) throw new Error(`the finalize pipeline only rendered ${rounds.length}/6 rounds`);

  // RELION 5's final unmasked stack on the cluster (the select gallery's
  // preferred source — small enough for the exec-line payload)
  const wd = `/projects/cryoflow/${projectId}/class2d_${clsJob.id.slice(-8)}`;
  const finalB64 = (() => {
    const nx = 16, ny = 16, nz = 3;
    const data = Buffer.alloc(nx * ny * nz * 4);
    for (let k = 0; k < nx * ny * nz; k++) data.writeFloatLE(((k * 7) % 23) / 23 - 0.5, k * 4);
    const hdr = Buffer.alloc(1024);
    hdr.writeInt32LE(nx, 0); hdr.writeInt32LE(ny, 4); hdr.writeInt32LE(nz, 8); hdr.writeInt32LE(2, 12);
    return Buffer.concat([hdr, data]).toString("base64");
  })();
  client(`echo ${finalB64} | base64 -d > ${wd}/run_unmasked_classes.mrcs`);

  // the select2d job (the 2D-selection gallery host)
  const selJob = await mkJob({
    projectId, type: "select2d", name: "t356 class selection", x: 780, y: 260,
  });
  await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId: clsJob.id, toJobId: selJob.id, fromPort: "particles", toPort: "particles" }),
  });
  await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId: clsJob.id, toJobId: selJob.id, fromPort: "classAverages", toPort: "classes" }),
  });

  // THE USER'S WORLD on top: the mirror has NO stacks (the key-files caps
  // left them on the cluster) — the images live in the LOCAL render cache
  const mirror = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
  const removed = readdirSync(mirror).filter((f) => /classes\.mrcs?$/i.test(f));
  for (const f of removed) rmSync(path.join(mirror, f));

  writeFileSync(STATE_OUT, JSON.stringify({
    projectId, connId: CONN,
    importId: importParts.id, class2dId: clsJob.id, selectId: selJob.id,
    mirror, removedStacks: removed.length, renderedRounds: rounds.length,
  }, null, 2));
  console.log(`SEEDED: project=${projectId} class2d=${clsJob.id} select=${selJob.id}`);
  console.log(`pipeline rendered ${rounds.length}/6 rounds; removed ${removed.length} mirror stacks (images now cache-local)`);
  console.log(`state: ${STATE_OUT}`);
}

main().catch((e) => {
  console.error("SEED t356-ui failed:", e);
  process.exit(1);
});

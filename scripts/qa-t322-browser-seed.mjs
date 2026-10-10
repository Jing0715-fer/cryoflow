#!/usr/bin/env node
/**
 * t322 browser-live seeder — stages the exact world the user's receipt
 * came from, via the API (the browser then only has to SHOW it):
 *   1. connection qa-t322b + remote project
 *   2. 60 real-pixel micrographs on the mock cluster (1024², the ladder
 *      has real voxels to thin)
 *   3. import (run to completion — the gallery source)
 *   4. motioncorr + ctffind jobs with edges import→motioncorr→ctffind
 * Leaves the jobs UNDISPATCHED — the choreography dispatches them while
 * the browser watches (motioncorr first, ctffind while the parent lives
 * → the queued receipt).
 *
 * Usage:
 *   node scripts/qa-t322-browser-seed.mjs seed     # stage, prints ids
 *   node scripts/qa-t322-browser-seed.mjs dispatch # motioncorr then ctffind
 *   node scripts/qa-t322-browser-seed.mjs clean    # tear everything down
 */
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const CONN = "qa-t322b";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};
const SHJ = { ...SH, "Content-Type": "application/json" };
const N_MICS = 60;

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 90_000,
  }).stdout?.trim() ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const stateFile = path.join(ROOT, "data", ".qa-t322-browser.json");
const loadState = () => {
  try {
    return JSON.parse(spawnSync("cat", [stateFile], { encoding: "utf8" }).stdout || "{}");
  } catch {
    return {};
  }
};
const saveState = (s) => spawnSync("bash", ["-c", `mkdir -p ${ROOT}/data && echo '${JSON.stringify(s)}' > ${stateFile}`]);

const [cmd] = process.argv.slice(2);

if (cmd === "seed") {
  await (async () => {
    const mk = await api("/api/remote/connections", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({
        id: CONN,
        name: "QA t322 browser",
        host: "127.0.0.1",
        port: 3022,
        username: "cryo",
        password: "demo",
        authMethod: "password",
        remoteRoot: "/projects/cryoflow",
      }),
    });
    if (mk.status !== 200 && mk.status !== 201) throw new Error(`connection upsert ${mk.status}`);

    const proj = await api("/api/projects", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({ name: "QA t322 browser live", mode: "remote", remoteConnectionId: CONN }),
    });
    const projectId = proj.body?.project?.id;
    if (!projectId) throw new Error("no project id");

    const fx = client(`python3 - <<'CFX'
import struct, os
os.makedirs('/data2/t322-browser', exist_ok=True)
def mkrow(nx):
    b = bytearray()
    for x in range(nx):
        v = ((x * 7) % 251) * 0.5 - 60.0 + (900.0 if x % 17 == 0 else 0.0)
        b += struct.pack('<f', v)
    return bytes(b)
base = mkrow(1024)
for i in range(${N_MICS}):
    with open('/data2/t322-browser/mic_%03d.mrc' % (i + 1), 'wb') as f:
        f.write(struct.pack('<4i', 1024, 1024, 1, 2))
        f.seek(28); f.write(struct.pack('<3i', 1024, 1024, 1))
        f.seek(92); f.write(struct.pack('<i', 0))
        f.seek(1024)
        for y in range(1024):
            s = (y * 7) % 1024
            f.write(base[s:] + base[:s])
print('fixtures ok')
CFX`);
    if (!/fixtures ok/.test(fx)) throw new Error(`fixtures failed: ${fx.slice(0, 200)}`);

    const mkJob = async (body) =>
      (
        await api("/api/jobs", { method: "POST", headers: SHJ, body: JSON.stringify(body) })
      ).body?.job;
    const importJob = await mkJob({
      projectId,
      type: "import",
      name: "Browser import",
      params: {
        micrographsPath: Array.from({ length: N_MICS }, (_, i) => `/data2/t322-browser/mic_${String(i + 1).padStart(3, "0")}.mrc`).join("\n"),
        pixelSize: 0.93,
        voltage: 300,
      },
    });
    const mcJob = await mkJob({
      projectId,
      type: "motioncorr",
      name: "Browser motioncorr",
      params: { patchX: 5, patchY: 5 },
    });
    const ctfJob = await mkJob({
      projectId,
      type: "ctffind",
      name: "Browser ctffind",
      params: {},
    });
    await api("/api/edges", { method: "POST", headers: SHJ, body: JSON.stringify({ fromJobId: importJob.id, toJobId: mcJob.id, fromPort: "micrographs", toPort: "movies" }) });
    await api("/api/edges", { method: "POST", headers: SHJ, body: JSON.stringify({ fromJobId: mcJob.id, toJobId: ctfJob.id, fromPort: "micrographs", toPort: "micrographs" }) });

    const run = await api(`/api/jobs/${importJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
    if (run.status >= 300) throw new Error(`import run ${run.status}`);
    let done = null;
    for (let i = 0; i < 90 && !done; i++) {
      await sleep(1000);
      const j = await jobById(importJob.id);
      if (j?.status === "completed" || j?.status === "failed") done = j;
    }
    if (done?.status !== "completed") throw new Error(`import did not complete: ${done?.status} ${String(done?.result ?? "").slice(0, 120)}`);

    saveState({ projectId, importId: importJob.id, mcId: mcJob.id, ctfId: ctfJob.id });
    console.log(JSON.stringify({ ok: true, projectId, importId: importJob.id, mcId: mcJob.id, ctfId: ctfJob.id }));
  })().catch((e) => {
    console.log(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
    process.exit(1);
  });
} else if (cmd === "dispatch") {
  await (async () => {
    const s = loadState();
    if (!s.mcId) throw new Error("no state — seed first");
    const body = JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 } });
    const d1 = await api(`/api/jobs/${s.mcId}/run`, { method: "POST", headers: SHJ, body });
    if (d1.status >= 300 || d1.body?.error) throw new Error(`motioncorr dispatch: ${d1.status} ${String(d1.body?.error ?? "")}`);
    // wait for the sweep's word: RUNNING (the dependency needs the parent live)
    let up = false;
    for (let i = 0; i < 20 && !up; i++) {
      await sleep(1000);
      const j = await jobById(s.mcId);
      if (j?.runRemote?.slurmState === "RUNNING") up = true;
    }
    if (!up) throw new Error("motioncorr never reached RUNNING");
    const d2 = await api(`/api/jobs/${s.ctfId}/run`, { method: "POST", headers: SHJ, body });
    if (d2.status >= 300 || d2.body?.error) throw new Error(`ctffind dispatch: ${d2.status} ${String(d2.body?.error ?? "")}`);
    console.log(JSON.stringify({ ok: true, dispatched: [s.mcId, s.ctfId] }));
  })().catch((e) => {
    console.log(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
    process.exit(1);
  });
} else if (cmd === "clean") {
  const s = loadState();
  for (const id of [s.ctfId, s.mcId, s.importId]) {
    if (id) await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  if (s.projectId) {
    client(`rm -rf /projects/cryoflow/${s.projectId}`);
    try {
      rmSync(path.join(ROOT, "data/relion", s.projectId), { recursive: true, force: true });
    } catch {}
    await api(`/api/projects/${s.projectId}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  client("rm -rf /data2/t322-browser");
  try {
    for (const f of readdirSync(path.join(ROOT, "data/remote-preview"))) {
      rmSync(path.join(ROOT, "data/remote-preview", f), { force: true });
    }
  } catch {}
  try {
    rmSync(stateFile, { force: true });
  } catch {}
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
  console.log(JSON.stringify({ ok: true }));
} else {
  console.log("usage: seed | dispatch | clean");
}

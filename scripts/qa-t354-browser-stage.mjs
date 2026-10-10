/**
 * QA t354 — browser STAGING: leave a completed mock-cluster class2d in the
 * ACTIVE project so agent-browser can exercise the iteration-sheets UI.
 * No cleanup — the browser pass is the consumer (delete the project after).
 */
import { spawnSync } from "node:child_process";
import net from "node:net";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const CONN = "qa-t354ui";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 60_000,
  }).stdout?.trim() ?? "";
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

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

if (!(await mockListening())) { console.error("mock cluster down"); process.exit(1); }

await api("/api/remote/connections", {
  method: "POST", headers: SHJ,
  body: JSON.stringify({
    id: CONN, name: "QA t354 UI", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  }),
});

const proj = await api("/api/projects", {
  method: "POST", headers: SHJ,
  body: JSON.stringify({ name: "QA t354 UI sheets", mode: "remote", remoteConnectionId: CONN }),
});
const projectId = proj.body?.project?.id;
await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
console.log("project:", projectId);

const stackB64 = (() => {
  const b = Buffer.alloc(1024);
  b.writeInt32LE(48, 0); b.writeInt32LE(48, 4); b.writeInt32LE(24, 8); b.writeInt32LE(2, 12);
  return b.toString("base64");
})();
client(
  "mkdir -p /data2/t354ui-particles; " +
    `echo ${stackB64} | base64 -d > /data2/t354ui-particles/stack24.mrcs; ` +
    "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t354ui-particles/particles.star; " +
    "for i in $(seq 1 24); do printf '%d@/data2/t354ui-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t354ui-particles/particles.star; done"
);

const mkJob = (body) => api("/api/jobs", { method: "POST", headers: SHJ, body: JSON.stringify(body) });
const imp = (await mkJob({
  projectId, type: "import", name: "t354 UI particles",
  params: { micrographsPath: "/data2/t354ui-particles/particles.star", nodeType: "particles" },
})).body?.job;
await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
await awaitTerminal(imp.id, 60_000);

const cls = (await mkJob({
  projectId, type: "class2d", name: "t354 UI class2d",
  params: { iterations: 8, numClasses: 3 },
})).body?.job;
await api("/api/edges", {
  method: "POST", headers: SHJ,
  body: JSON.stringify({ fromJobId: imp.id, toJobId: cls.id, fromPort: "particles", toPort: "particles" }),
});
await api(`/api/jobs/${cls.id}/run`, {
  method: "POST", headers: SHJ,
  body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
});
const done = await awaitTerminal(cls.id, 150_000);
console.log("class2d:", done?.status);
// park the card in the visible canvas area (the t353 recipe)
await api(`/api/jobs/${cls.id}`, {
  method: "PATCH", headers: SHJ, body: JSON.stringify({ x: 420, y: 260 }),
});
console.log("JOB_ID=" + cls.id);
console.log("PROJECT_ID=" + projectId);

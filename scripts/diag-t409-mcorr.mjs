// diag-t409-mcorr.mjs — one-shot probe for the t264 "7 micrographs" + argv profile.
// Dispatches import (6 mics) → motioncorr (do_own_motioncor=false) on the mock
// cluster and KEEPS EVERYTHING ALIVE (no cleanup) so the consumed star, the
// stub's count and the record's cmd can be read after the fact.
import { writeFileSync, mkdirSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const MICS_DIR = "/home/z/my-project/data/relion/t409-diag-mics";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Content-Type": "application/json" };

rmSync(MICS_DIR, { recursive: true, force: true });
mkdirSync(MICS_DIR, { recursive: true });
for (let i = 1; i <= 6; i++) {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let j = 0; j < W * H; j++) buf.writeFloatLE(Math.sin(j / 7) * 0.1, 1024 + j * 4);
  writeFileSync(`${MICS_DIR}/mic_0${i}.mrc`, buf);
}
console.log("fabricated 6 mics");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function jfetch(url, body, method = "POST") {
  const r = await fetch(url, { method, headers: SH, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

const proj = (await (await fetch(`${BASE}/api/projects`, { headers: SH })).json()).projects?.[0];
console.log("project:", proj?.id, proj?.name);

const imp = await jfetch(`${BASE}/api/jobs`, {
  projectId: proj.id, type: "import", name: "t409-diag import",
  params: { micrographsPath: MICS_DIR, pixelSize: 1.77, nodeType: "movies" },
});
const impJob = imp.body.job ?? imp.body;
console.log("import job:", imp.status, impJob?.id);
const run1 = await jfetch(`${BASE}/api/jobs/${impJob.id}/run`, {});
console.log("import run:", run1.status, JSON.stringify(run1.body).slice(0, 120));

let done = null;
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  const list = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json().catch(() => null);
  const j = list?.jobs?.find((x) => x.id === impJob.id);
  if (j?.status === "completed" || j?.status === "failed") { done = j; break; }
}
console.log("import terminal:", done?.status, (done?.result ?? "").slice(0, 100));
if (done?.status !== "completed") process.exit(1);

// the import's star — read it from the job workdir
const starPath = `/home/z/my-project/data/relion/${proj.id}/import_${impJob.id.slice(-8)}/micrographs.star`;
const fs = await import("node:fs");
try {
  const star = fs.readFileSync(starPath, "utf8");
  console.log("=== import star (first 22 lines) ===");
  console.log(star.split("\n").slice(0, 22).join("\n"));
  console.log("=== data_ blocks:", star.split("\n").filter((l) => l.startsWith("data_")).join(", "));
} catch (e) {
  console.log("star read failed:", e.message);
}

const mc = await jfetch(`${BASE}/api/jobs`, {
  projectId: proj.id, type: "motioncorr", name: "t409-diag motioncorr",
  params: { do_own_motioncor: false },
});
const mcJob = mc.body.job ?? mc.body;
console.log("motioncorr job:", mc.status, mcJob?.id);

// the mock-cluster connection (same shape the t262 suite speaks)
const connId = "qa-t409-diag";
await jfetch(`${BASE}/api/remote/connections/${connId}`, null, "DELETE").catch(() => {});
const conn = await jfetch(`${BASE}/api/remote/connections`, {
  id: connId, name: "QA t409 Mock", host: "127.0.0.1", port: 3022,
  username: "cryo", password: "demo", authMethod: "password",
  remoteRoot: "/projects/cryoflow",
});
console.log("connection:", conn.status);
const edge = await jfetch(`${BASE}/api/edges`, {
  projectId: proj.id, fromJobId: impJob.id, toJobId: mcJob.id, fromPort: "micrographs", toPort: "movies",
});
console.log("edge:", edge.status, JSON.stringify(edge.body).slice(0, 120));
const run2 = await jfetch(`${BASE}/api/jobs/${mcJob.id}/run`, { remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } });
console.log("motioncorr run:", run2.status, JSON.stringify(run2.body).slice(0, 200));

done = null;
for (let i = 0; i < 90; i++) {
  await sleep(1000);
  const list = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json().catch(() => null);
  const j = list?.jobs?.find((x) => x.id === mcJob.id);
  if (j?.status === "completed" || j?.status === "failed") { done = j; break; }
}
console.log("motioncorr terminal:", done?.status, (done?.result ?? "").slice(0, 120));

const state = JSON.parse(fs.readFileSync("/home/z/my-project/data/engine-state.json", "utf8"));
const rec = state[mcJob.id];
console.log("=== record cmd ===");
console.log(String(rec?.cmd ?? "(absent)").slice(0, 400));

// cleanup the diag jobs (keep the dirs for now — printed above)
await jfetch(`${BASE}/api/jobs/${mcJob.id}`, null, "DELETE");
await jfetch(`${BASE}/api/jobs/${impJob.id}`, null, "DELETE");
console.log("diag jobs deleted (dirs left for inspection)");

#!/usr/bin/env node
/** t923-D diagnosis — why did CTF-A's re-run eat 6 rows instead of the
 *  filter's 3? Reproduces the D band with full instrumentation. */
import { execSync } from "node:child_process";
import fs from "node:fs";

const api = (m, u, b) =>
  JSON.parse(execSync(
    `curl -s -X ${m} -H "Origin: http://localhost:3000" -H "Content-Type: application/json" ${b ? `-d '${JSON.stringify(b)}'` : ""} "http://localhost:3000${u}"`,
    { encoding: "utf8", timeout: 30000 }
  ));
const jobs = () => api("GET", "/api/jobs").jobs ?? [];
const edges = () => api("GET", "/api/edges").edges ?? [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const led = () => JSON.parse(fs.readFileSync("data/engine-state.json", "utf8"));

const mcA = jobs().find((j) => j.name === "Motion Correction 1");
const mcB = jobs().find((j) => j.name === "Motion Correction 2 (t922)");
const ctfA = jobs().find((j) => j.name === "CTF Estimation 1");
let f = jobs().find((j) => j.type === "excludemg");
if (!f) {
  f = api("POST", "/api/jobs", { type: "excludemg", name: "Exclude Micrographs (t923)", params: { excludeNames: "mic_002.mrc, mic_004.mrc, mic_006.mrc" } }).job;
  console.log("filter minted", f.id);
}
if (!edges().some((e) => e.fromJobId === mcB.id && e.toJobId === f.id)) {
  const r = api("POST", "/api/edges", { fromJobId: mcB.id, toJobId: f.id });
  console.log("feed:", r.edge?.id ?? r.error);
}
if (!edges().some((e) => e.fromJobId === f.id && e.toJobId === ctfA.id)) {
  const r = api("POST", "/api/edges", { fromJobId: f.id, toJobId: ctfA.id });
  console.log("rewire:", r.edge?.id ?? r.error);
}
api("POST", `/api/jobs/${f.id}/run`);
let st = "";
for (let i = 0; i < 20; i++) {
  st = jobs().find((j) => j.id === f.id).status;
  if (["completed", "failed"].includes(st)) break;
  await sleep(1500);
}
console.log("filter:", st, "·", jobs().find((j) => j.id === f.id).result);
console.log("filter outputs:", JSON.stringify(led()[f.id]?.outputs));
console.log("filter done/exit:", led()[f.id]?.done, led()[f.id]?.exitCode);

const before = led()[ctfA.id]?.startedAt;
const conn = api("GET", "/api/remote/connections").connections.find((c) => c.name === "Mock Cluster");
api("POST", `/api/jobs/${ctfA.id}/run`, { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } });
for (let i = 0; i < 60; i++) {
  const l = led();
  const moved = l[ctfA.id]?.startedAt !== before;
  const settled = ["completed", "failed"].includes(jobs().find((j) => j.id === ctfA.id).status);
  if (moved && settled) break;
  await sleep(2500);
}
console.log("ctfA:", jobs().find((j) => j.id === ctfA.id).status);
console.log("ctfA cmd:", led()[ctfA.id]?.cmd?.slice(0, 200));
const rows = api("GET", `/api/jobs/${ctfA.id}/ctf`).micrographs ?? [];
console.log("ctfA rows:", rows.length, rows.map((r) => String(r.name).split("/").pop()).sort().join(","));

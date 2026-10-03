#!/usr/bin/env node
/**
 * t536 — the movies gate's REMOTE half, live-fired.
 *
 * The buildArgv gate (t535) reads the CLUSTER twin path on the remote lane —
 * a path that never exists on THIS machine — so readStarMoviesShape's honest
 * null skipped the gate and the real binary died mid-cluster as a cryptic
 * "exit 1 (RELION reported an error)". The t269 suite lived through it. The
 * fix rides the remote-run pre-staging block: classify the LOCAL source star,
 * refuse the REQUEST (fail(requestError)) before one byte is staged.
 *
 * This script proves the refusal fires NOW, on the live standalone:
 *   1. a stub-era import (single-frame micrographs, no nodeType) completes locally
 *   2. a motioncorr job wired micrographs→movies dispatches to the mock cluster
 *   3. the refusal arrives FAST (no staging window) and speaks the actionable
 *      truth — "Import the frame stacks with Node type = Movies"
 *
 * Cleanup: deletes the jobs it created (the world-guard law — leave no trace).
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ROOT = "/home/z/my-project";
const MICS_DIR = `${ROOT}/data/relion/t536-gate-fire/mics`;
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

const createdJobs = [];
const must = (ok, msg) => {
  console.log(`  ${ok ? "ok" : "FAIL"}: ${msg}`);
  if (!ok) process.exitCode = 1;
};

// 1 — the stub-era fixture: SINGLE-frame 64×64 micrographs (the pre-t535 shape)
mkdirSync(MICS_DIR, { recursive: true });
for (let i = 1; i <= 3; i++) {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let p = 0; p < W * H; p++) buf.writeFloatLE(Math.sin(p / 7) * 0.1, 1024 + p * 4);
  writeFileSync(join(MICS_DIR, `mic_${String(i).padStart(3, "0")}.mrc`), buf);
}
must(existsSync(join(MICS_DIR, "mic_001.mrc")), "three single-frame micrographs fabricated (the stub-era shape)");

const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const b = await r.json();
  if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
  return b.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await fetch(`${BASE}/api/edges`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
  });
  return r.status;
};
const readJob = async (id) => {
  const d = await (await fetch(`${BASE}/api/jobs`)).json();
  return (d.jobs ?? []).find((x) => x.id === id) ?? null;
};

// 2 — the stub-era import: NO nodeType → micrographs star
const importJob = await mkJob({
  type: "import", name: "t536 Gate Fire Import",
  params: { micrographsPath: MICS_DIR, pixelSize: 1.77 },
});
must(!!importJob?.id, "the stub-era import exists (no nodeType — micrographs dialect)");
await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}" });
const t0 = Date.now();
const importDone = await (async () => {
  for (let i = 0; i < 40; i++) {
    const j = await readJob(importJob.id);
    if (j?.status === "completed") return j;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
})();
must(!!importDone, "the local import completed (engine-native)");

// 3 — a probeless connection to the mock cluster
const connId = `qa-t536-${Date.now().toString(36)}`;
const mk = await fetch(`${BASE}/api/remote/connections`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({
    id: connId, name: "QA t536 Gate Fire", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  }),
});
must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);

// 4 — the stub-era wiring: micrographs star → motioncorr, remote dispatch
const jobM = await mkJob({ type: "motioncorr", name: "t536 Gate Fire MC" });
const eM = await mkEdge(importJob.id, jobM.id, "micrographs", "movies");
must(eM === 200 || eM === 201, `import → motioncorr wired the stub-era way (${eM})`);
const fireT0 = Date.now();
const disp = await fetch(`${BASE}/api/jobs/${jobM.id}/run`, {
  method: "POST", headers: { "Content-Type": "application/json", ...SH },
  body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
});
const dispBody = await disp.json().catch(() => ({}));
const fireMs = Date.now() - fireT0;
must(disp.status === 200 && !!dispBody.error, `the dispatch is REFUSED with a request error (${disp.status}, err set: ${!!dispBody.error})`);
must(
  typeof dispBody.error === "string" && dispBody.error.includes("MotionCorr reads only MOVIES stars"),
  `the refusal speaks the movies dialect ("${String(dispBody.error ?? "").slice(0, 80)}…")`
);
must(fireMs < 15_000, `the refusal fired BEFORE staging (${fireMs}ms — a staged run would take longer)`);

// the job row must NOT be flipped to failed (requestError teaches via toast)
const rowAfter = await readJob(jobM.id);
must(rowAfter?.status !== "failed", `the job row is not failed (${rowAfter?.status} — the wiring mistake is a request refusal, not a run)`);

// cleanup — jobs first (the API DELETE also sweeps the workdir), then the connection
for (const id of createdJobs) {
  await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => {});
}
await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH }).catch(() => {});
console.log("  (cleanup: jobs + connection deleted)");
console.log(process.exitCode ? "t536 gate live-fire: FAIL" : "t536 gate live-fire: ALL PASS");

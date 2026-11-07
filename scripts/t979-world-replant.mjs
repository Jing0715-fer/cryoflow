#!/usr/bin/env node
/**
 * t979-world-replant — the t955/t967 ritual, scripted for the fork-landing.
 *
 * THIS sandbox was a stale fork (t867-era tar revival) that hard-landed on
 * origin/main (the t418 doctrine); its db/cryoflow.db was a 0-byte corpse
 * and the auto-seed door had just born the 3-node starter. This script
 * walks the re-plant ritual's living steps through the product's own doors:
 *
 *   1. registry upsert at the ORIGINAL id conn-mv6a23lx (the t963 mint's
 *      hardcoded remote block depends on it)
 *   2. project bound (PATCH {remoteConnectionId})
 *   3. the seed import re-pointed at the mock cluster's own mics with the
 *      t535 feed law's key (nodeType:"movies" — MotionCorr's remote gate
 *      refuses micrographs stars)
 *   4. import → MotionCorr → CTF through the real run doors, each polled
 *      to COMPLETED
 *
 * After this script: run the mint fleet with MINT_PROJECT_ID=<the printed
 * id> (t963 door, t966 bench, t970 failed face, t972 walltime face,
 * t976 cancelled face, t978 select-rider world), then the doctor + census.
 */
const ORIGIN = "http://localhost:3000";
const HEADERS = { "Content-Type": "application/json", Origin: ORIGIN };

async function api(method, path, body) {
  const res = await fetch(ORIGIN + path, {
    method,
    headers: HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function waitFor(jobId, label, timeoutMs = 240_000) {
  const t0 = Date.now();
  for (;;) {
    const jobs = await api("GET", "/api/jobs");
    const job = jobs.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error(`job ${jobId} vanished`);
    if (job.status === "completed") {
      console.log(`  ${label}: COMPLETED (${Math.round((Date.now() - t0) / 1000)}s)`);
      return job;
    }
    if (job.status === "failed") {
      const log = await fetch(`${ORIGIN}/api/jobs/${jobId}/log`, { headers: HEADERS })
        .then((r) => r.text()).catch(() => "");
      throw new Error(`${label} FAILED — log tail: ${log.slice(-400)}`);
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`${label} timed out at status=${job.status}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const project = (await api("GET", "/api/project")).project;
console.log(`world: project ${project.id} "${project.name}"`);

// 1. the registry at the ORIGINAL id (client-supplied id upsert)
const conn = await api("POST", "/api/remote/connections", {
  id: "conn-mv6a23lx",
  host: "127.0.0.1",
  port: 3022,
  username: "cryo",
  password: "demo",
  remoteRoot: "/projects/cryoflow",
  useSlurm: true,
});
console.log(`registry: ${conn.connection.id} at ${conn.connection.host} (useSlurm=${conn.connection.useSlurm})`);

// 2. bind the project
await api("PATCH", `/api/projects/${project.id}`, { remoteConnectionId: "conn-mv6a23lx" });
console.log("project bound to conn-mv6a23lx");

// 3. the seed import re-pointed (the t535 feed law: nodeType movies)
const { jobs } = await api("GET", "/api/jobs");
const byType = (t) => jobs.filter((j) => j.type === t).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const [imp, mc, ctf] = [byType("import")[0], byType("motioncorr")[0], byType("ctffind")[0]];
if (!imp || !mc || !ctf) throw new Error(`starter incomplete: import=${!!imp} mc=${!!mc} ctf=${!!ctf}`);
await api("PATCH", `/api/jobs/${imp.id}`, {
  params: {
    nodeType: "movies",
    micrographsPath: "/home/z/my-project/services/mock-cluster/fs/data2/micrographs",
  },
});
console.log(`import re-pointed: nodeType=movies, feeds the mock cluster's own mics`);

// 4. the seed trio through the real doors (each reset to idle first —
//    the ritual is idempotent: a prior failed attempt re-runs clean)
for (const [job, label] of [[imp, "import"], [mc, "motioncorr"], [ctf, "ctffind"]]) {
  if (job.status !== "idle") await api("PATCH", `/api/jobs/${job.id}`, { status: "idle" });
}
await api("POST", `/api/jobs/${imp.id}/run`);
await waitFor(imp.id, "import");
await api("POST", `/api/jobs/${mc.id}/run`);
await waitFor(mc.id, "motioncorr (remote lane)");
await api("POST", `/api/jobs/${ctf.id}/run`);
await waitFor(ctf.id, "ctffind (remote lane)");

console.log(`\nREPLANT SEED OK — mint fleet: MINT_PROJECT_ID=${project.id}`);
console.log(`  node scripts/t963-door-world-mint.mjs`);
console.log(`  node scripts/t966-peek-stress-mint.mjs`);
console.log(`  node scripts/t970-failed-face-mint.mjs`);
console.log(`  node scripts/t972-negative-face-mint.mjs`);
console.log(`  node scripts/t976-cancelled-face-mint.mjs`);
console.log(`  node scripts/t978-select-rider-world-mint.mjs`);

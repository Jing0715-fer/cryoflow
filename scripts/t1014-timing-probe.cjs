// t1014 — the timing probe: how long does a twin import's RUNNING window hold?
// mints a twin via the API, triggers the run detached, samples the DB status
// column every 20ms (the source of truth — no HTTP sampling perturbation),
// prints the flip timeline, then deletes the twin + its workdir (self-restoring).
// usage: node scripts/t1014-timing-probe.cjs <sourceJobName> [twinName]
const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const sourceName = process.argv[2] ?? "Import Movies 1";
const twinName = process.argv[3] ?? "t1014 timing probe twin";

const api = (method, url, body) => execSync(
  `curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`,
  { encoding: "utf8", timeout: 30_000 });

(async () => {
  const jobs = JSON.parse(api("GET", "/api/jobs")).jobs ?? JSON.parse(api("GET", "/api/jobs"));
  const src = (Array.isArray(jobs) ? jobs : jobs.jobs).find((j) => j.name === sourceName);
  if (!src) { console.error("source not found:", sourceName); process.exit(1); }
  const mint = JSON.parse(api("POST", "/api/jobs", {
    type: src.type, name: twinName, workspaceId: src.workspaceId, x: 760, y: 320,
  })).job;
  console.log("twin minted:", mint.id, `(${mint.name})`);

  // detached run trigger — the probe keeps sampling while the run flies
  const child = spawn("curl", ["-s", "-X", "POST", "-H", `Origin: ${BASE}`,
    `${BASE}/api/jobs/${mint.id}/run`], { stdio: "ignore", detached: true });
  child.unref();

  const t0 = Date.now();
  const seen = [];
  let last = null;
  while (Date.now() - t0 < 15000) {
    const row = await p.job.findUnique({ where: { id: mint.id }, select: { status: true } });
    const s = row ? row.status : "GONE";
    if (s !== last) { seen.push({ at: Date.now() - t0, status: s }); last = s; }
    if (s === "completed" || s === "failed" || s === "GONE") break;
    await new Promise((r) => setTimeout(r, 20));
  }
  console.log("timeline:", seen.map((e) => `${e.at}ms:${e.status}`).join(" → "));
  const flips = seen.length;
  const runningSpan = (() => {
    const i = seen.findIndex((e) => e.status === "running");
    if (i < 0) return null;
    const end = seen[i + 1];
    return end ? end.at - seen[i].at : null;
  })();
  console.log("running window:", runningSpan == null ? "NOT OBSERVED" : `${runningSpan}ms (sampled at 20ms)`);

  // self-restore: delete the twin + its workdir
  try { api("DELETE", `/api/jobs/${mint.id}`); } catch {}
  const wd = path.join(ROOT, "data/relion", "cmv8nhqxo0000sy8934xli45t", `import_${mint.id.slice(-8)}`);
  try { fs.rmSync(wd, { recursive: true, force: true }); console.log("workdir swept:", path.basename(wd)); } catch {}
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });

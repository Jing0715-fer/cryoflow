// t624 diag — print the W1 DB row's actual words (who overwrote the
// confirmed sentence?). Same craft as the witness's W1, verbose read.
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const CONN = "conn-t624-diag";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Content-Type": "application/json" };
const api = async (m, p, b) => {
  const r = await fetch(`${BASE}${p}`, { method: m, headers: SH, ...(b ? { body: JSON.stringify(b) } : {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const client = (c) => execFileSync("node", ["services/mock-cluster/test-client.mjs", c], { cwd: ROOT, encoding: "utf8", timeout: 30_000 });
const db = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/cryoflow.db" } } });
const snap0 = readFileSync(STATE_FILE, "utf8");
let jobId = null;
try {
  const mk = await api("POST", "/api/projects", { name: "t624 diag" });
  const projId = mk.body?.project?.id;
  const j = await api("POST", "/api/jobs", { projectId: projId, type: "import", name: "diag w1", x: 90, y: 90, params: { empiarData: true, micrographsPath: "" } });
  jobId = j.body?.job?.id;
  const sub = client('mkdir -p /projects/cryoflow/t624diag && printf "#!/usr/bin/env bash\\nsleep 300\\n" > /projects/cryoflow/t624diag/d.sh && sbatch /projects/cryoflow/t624diag/d.sh');
  const sid = Number(/Submitted batch job (\d+)/.exec(sub)?.[1]);
  console.log("slurmId:", sid);
  await new Promise((r) => setTimeout(r, 2500));
  const raw = JSON.parse(snap0); const runs = raw.runs ?? raw;
  runs[jobId] = {
    jobId, projectId: projId, type: "import", pid: null, cmd: "t624 diag", workdir: `${ROOT}/data/relion/t624diag`,
    logFile: `${ROOT}/data/relion/t624diag/run.out`, errFile: `${ROOT}/data/relion/t624diag/run.err`,
    startedAt: new Date().toISOString(), done: false,
    remote: { connectionId: CONN, connectionName: "t624 diag", host: "127.0.0.1:3022", user: "cryo", module: "", mode: "slurm", remoteRoot: "/projects/cryoflow", remoteWorkdir: "/projects/cryoflow/t624diag/wd", pid: null, slurmId: String(sid), phase: "running" },
  };
  writeFileSync(STATE_FILE, JSON.stringify(raw, null, 2));
  const mkc = await api("POST", "/api/remote/connections", { id: CONN, name: "t624 diag", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" });
  console.log("conn:", mkc.status);
  await db.job.update({ where: { id: jobId }, data: { status: "running", progress: 10 } });
  const stopRes = await api("POST", `/api/jobs/${jobId}/stop`, {});
  console.log("stop:", stopRes.status, "stopped:", stopRes.body?.stopped, "outcome:", stopRes.body?.outcome, "settled:", stopRes.body?.settled);
  for (const ms of [0, 500, 1500, 3000]) {
    await new Promise((r) => setTimeout(r, ms));
    const row = await db.job.findUnique({ where: { id: jobId } });
    const rec = (JSON.parse(readFileSync(STATE_FILE, "utf8"))?.runs ?? {})[jobId];
    console.log(`t+${ms} ROW.result:`, JSON.stringify(row?.result));
    console.log(`t+${ms} REC:`, rec ? `done=${rec.done} exit=${rec.exitCode} result=${JSON.stringify(rec.result)}` : "GONE");
  }
  console.log("cleanup:", String(await api("DELETE", `/api/jobs/${jobId}`).then(r=>r.status)), String(await api("DELETE", `/api/projects/${projId}`).then(r=>r.status)), String(await api("DELETE", `/api/remote/connections/${CONN}`).then(r=>r.status)));
} catch (e) {
  console.error("diag error:", e.message);
  try { writeFileSync(STATE_FILE, snap0); } catch {}
} finally {
  try { if (jobId) { const raw = JSON.parse(snap0); const runs = raw.runs ?? raw; if (runs[jobId]) { delete runs[jobId]; writeFileSync(STATE_FILE, JSON.stringify({ ...(raw, runs) }, null, 2)); } } } catch {}
  try { client('rm -rf /projects/cryoflow/t624diag; rm -f "$HOME/.slurm/"job-*.cancelled'); } catch {}
  try { await db.$disconnect(); } catch {}
}

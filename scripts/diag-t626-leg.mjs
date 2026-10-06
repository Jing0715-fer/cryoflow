// t626 diag — the outputs ledger leg's minimal probe: plant ONE done record
// carrying the flag on the real mock connection, drive three passes, read
// the server log's t626diag lines, restore the world. Chrome-less, ~40s.
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const CONN = "conn-t626-diag";
const SH = {
  Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors", "Content-Type": "application/json",
};
const api = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: SH, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const stateRuns = () => {
  try { const s = JSON.parse(readFileSync(STATE_FILE, "utf8")); return s.runs ?? s; } catch { return {}; }
};
const writeStateRuns = (runs) => {
  const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  writeFileSync(STATE_FILE, JSON.stringify(raw.runs ? { ...raw, runs } : runs, null, 2));
};
const envUrl = readFileSync(`${ROOT}/.env`, "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const db = new PrismaClient({ datasources: { db: { url: envUrl ?? `file:${ROOT}/db/cryoflow.db` } } });
const snap0 = readFileSync(STATE_FILE, "utf8");
let projId = null, jobId = null, prevActiveId = null;

try {
  // the t624/t626 law: POST /api/projects SETS ACTIVE — record the pointer's
  // owner before the theft and put it back in the finally, or the world's
  // canonical project silently loses the pointer to this probe's fixture.
  prevActiveId = ((await api("GET", "/api/projects")).body?.projects ?? []).find((p) => p.active)?.id ?? null;
  const mk = await api("POST", "/api/projects", { name: "t626 diag" });
  projId = mk.body?.project?.id;
  const rj = await api("POST", "/api/jobs", {
    projectId: projId, type: "import", name: "t626 diag leg", x: 100, y: 100,
    params: { empiarData: true, micrographsPath: "" },
  });
  jobId = rj.body?.job?.id;
  const mkc = await api("POST", "/api/remote/connections", {
    id: CONN, name: "QA t626 diag", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  });
  console.log(`fixture: proj=${projId} job=${jobId} conn=${mkc.status}`);
  mkdirSync(`${ROOT}/data/relion/t626-diag/wd`, { recursive: true });
  const runs = { ...stateRuns() };
  runs[jobId] = {
    jobId, projectId: projId, type: "import", pid: null, cmd: "t626 diag",
    workdir: `${ROOT}/data/relion/t626-diag/wd`,
    logFile: `${ROOT}/data/relion/t626-diag/wd/run.out`,
    errFile: `${ROOT}/data/relion/t626-diag/wd/run.err`,
    startedAt: new Date().toISOString(), done: true, exitCode: 137,
    result: "stopped by user",
    remote: {
      connectionId: CONN, connectionName: "QA t626 diag", host: "127.0.0.1:3022",
      user: "cryo", module: "", mode: "slurm", remoteRoot: "/projects/cryoflow",
      remoteWorkdir: "/projects/cryoflow/t626-diag/wd", pid: null, slurmId: null,
      phase: "running", outputsLedgerPending: true,
    },
  };
  writeStateRuns(runs);
  await db.job.update({ where: { id: jobId }, data: { status: "failed", progress: 0 } });
  for (let i = 0; i < 3; i++) {
    await api("GET", "/api/jobs").catch(() => null);
    await new Promise((r) => setTimeout(r, 3000));
    const r = stateRuns()[jobId];
    console.log(`pass ${i + 1}: flag=${r?.remote?.outputsLedgerPending} at=${r?.remote?.outputsLedgerAt}`);
  }
} finally {
  try { if (snap0) writeStateRuns(JSON.parse(snap0).runs ?? JSON.parse(snap0)); } catch {}
  try { if (prevActiveId && prevActiveId !== projId) await api("POST", "/api/projects/switch", { id: prevActiveId }); } catch {}
  try { if (jobId) await api("DELETE", `/api/jobs/${jobId}`); } catch {}
  try { if (projId) await api("DELETE", `/api/projects/${projId}`); } catch {}
  try { await api("DELETE", `/api/remote/connections/${CONN}`); } catch {}
  try { rmSync(`${ROOT}/data/relion/t626-diag`, { recursive: true, force: true }); } catch {}
  try { await db.$disconnect(); } catch {}
}
console.log("diag done");

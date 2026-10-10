// t623 — the stop receipt's live fire (t618's feat docket, delivered).
//
// The stop route used to speak ONE boolean and pre-write "stopped by user"
// even when the kill missed — the UI guessed ("Job already idle") while the
// ledger claimed a user-stop that never happened, and the cluster-ledger
// heal that followed LOOKED like a flip from "stopped" to "completed" (the
// pre-written lie speaking twice). The receipt contract (this window's
// feat): the response carries `outcome: killed | missed | already-ended`
// and the LEDGER honors it — a missed kill claims NOTHING (no 137, no
// "stopped by user").
//
//   W0  the world's baseline — roster floor >= 12 (t527's total-sum law)
//   W1  already-ended (local LAW-1): record says done, DB says running —
//       the stop door refuses to act on the past; "stopped by user" is
//       never claimed; the record is untouched
//   W2  missed (local): a record pointing at a dead pid — nothing is
//       killed, the interim result names the miss
//   W3  missed (remote): a remote record whose connection is GONE — the
//       kill is unreachable; the ledger record lands done WITHOUT the 137
//       stamp, the interim result names the miss, the cluster ledger
//       decides the final state when the run's records come home
//   W4  killed (local, REAL): a genuine live process (a sleep the suite
//       spawned) behind a crafted record — the SIGTERM actually flows, the
//       receipt says killed, the process dies, the engine finalizes the
//       record itself (exit -1, "stopped by user"), the job lands failed
//       with the user-stop sentence
//   R   world hygiene: state file restored, fixture project deleted, the
//       spawned sleep reaped, roster back at the floor
//
// Authority composition: the product's own doors for ACTIONS (HTTP API,
// t415's same-origin helper), the seed's authority for STATE (Prisma
// direct write — check-fixture-prisma.mjs lineage) and the ledger's own
// file for RECORDS (t294's engine-state.json snapshot/craft/restore).
// Chrome-less, mock-cluster-less: the remote receipt under witness is the
// unreachable-connection class, which needs no SSH at all.
//
// Run: node scripts/t623-stop-receipt-live-fire.mjs   (server on :3000)
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// same-origin metadata — what every same-origin browser fetch carries
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Content-Type": "application/json",
};

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: SH,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const b = await res.json().catch(() => ({}));
  return { status: res.status, body: b };
}

// ---- the ledger's own file (t294 lineage) --------------------------------
const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};
const writeStateRuns = (runs) => {
  const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const next = raw.runs ? { ...raw, runs } : runs;
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
};
const readRecord = (jobId) => stateRuns()[jobId] ?? null;

const worldJobs = (body) =>
  (body?.projects ?? []).reduce((a, p) => a + (p.stats?.total ?? 0), 0);

// the seed's authority for STATE — pinned to the CANONICAL DB the dev
// server itself speaks (.env's DATABASE_URL). Two lessons in one pin:
// a bare `node` process does NOT inherit Next's env loading (an unpinned
// PrismaClient lands on an empty sqlite — "main.Job does not exist"),
// and the SHELL's exported DATABASE_URL is a LIAR here (this box exports
// custom.db — a different sqlite without the Job table). The .env is the
// server's actual config source; the shell is not.
const CANONICAL_DB = "file:/home/z/my-project/db/cryoflow.db";
const envUrl = (() => {
  try {
    const m = readFileSync("/home/z/my-project/.env", "utf8").match(/^DATABASE_URL=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
})();
const db = new PrismaClient({
  datasources: { db: { url: envUrl ?? CANONICAL_DB } },
});
let snap0 = null; // the pre-suite ledger truth (finally restores it)
let projId = null;
const jobIds = {};
let sleepChild = null;

try {
  // ---- W0: the world's baseline ------------------------------------------
  console.log("== W0: the world's baseline ==");
  const roster0 = worldJobs((await api("GET", "/api/projects")).body);
  must(roster0 >= 12, `roster identity >= 12 (got ${roster0})`);

  // ---- the fixture: one project, four jobs, through the product's doors --
  const mk = await api("POST", "/api/projects", { name: "t623 stop receipt" });
  projId = mk.body?.project?.id;
  must(mk.status === 201 && !!projId, "the fixture project exists");
  for (const [slot, name] of [
    ["w1", "t623 already-ended local"],
    ["w2", "t623 missed local"],
    ["w3", "t623 missed remote"],
    ["w4", "t623 killed real"],
  ]) {
    const r = await api("POST", "/api/jobs", {
      projectId: projId,
      type: "import",
      name,
      x: 120,
      y: 120 + Object.keys(jobIds).length * 180,
      params: { empiarData: true, micrographsPath: "" },
    });
    must(r.status === 201 && !!r.body?.job?.id, `${slot}: the fixture job exists`);
    jobIds[slot] = r.body?.job?.id;
  }

  // ---- the ledger snapshot BEFORE any crafting ---------------------------
  snap0 = readFileSync(STATE_FILE, "utf8"); // pre-suite truth

  const setRunning = async (id) => {
    await db.job.update({ where: { id }, data: { status: "running", progress: 10 } });
  };
  const stopJob = async (id) => api("POST", `/api/jobs/${id}/stop`, {});
  const jobRow = async (id) => (await db.job.findUnique({ where: { id } }));

  // ---- W1: already-ended (local LAW-1) ------------------------------------
  console.log("== W1: already-ended — the past tense is not stoppable ==");
  writeStateRuns({
    ...stateRuns(),
    [jobIds.w1]: {
      jobId: jobIds.w1,
      projectId: projId,
      type: "import",
      pid: 4242,
      cmd: "t623: a LOCAL record that already ended",
      workdir: "/tmp/t623-w1",
      logFile: "/tmp/t623-w1/run.out",
      errFile: "/tmp/t623-w1/run.err",
      startedAt: new Date().toISOString(),
      done: true,
      exitCode: 0,
      result: "completed",
    },
  });
  await setRunning(jobIds.w1);
  const s1 = await stopJob(jobIds.w1);
  must(s1.status === 200, `W1 the stop lands (${s1.status})`);
  must(s1.body?.stopped === false, "W1 the receipt says stopped:false");
  must(s1.body?.outcome === "already-ended", `W1 the receipt's class is already-ended (got ${s1.body?.outcome})`);
  must(
    (s1.body?.job?.result ?? "").includes("already ended"),
    `W1 the interim result names the past tense ("${s1.body?.job?.result ?? ""}")`
  );
  must(!(s1.body?.job?.result ?? "").includes("stopped by user"), "W1 no user-stop is claimed");
  must((await jobRow(jobIds.w1))?.status === "failed", "W1 the job lands terminal");
  const rec1 = readRecord(jobIds.w1);
  must(rec1?.done === true && rec1?.exitCode === 0, "W1 the record is untouched (exit 0 kept)");

  // ---- W2: missed (local) --------------------------------------------------
  console.log("== W2: missed local — nothing lives behind the pid ==");
  writeStateRuns({
    ...stateRuns(),
    [jobIds.w2]: {
      jobId: jobIds.w2,
      projectId: projId,
      type: "import",
      pid: 999999,
      cmd: "t623: a LOCAL record pointing at a dead pid",
      workdir: "/tmp/t623-w2",
      logFile: "/tmp/t623-w2/run.out",
      errFile: "/tmp/t623-w2/run.err",
      startedAt: new Date().toISOString(),
      done: false,
    },
  });
  await setRunning(jobIds.w2);
  const s2 = await stopJob(jobIds.w2);
  must(s2.status === 200, `W2 the stop lands (${s2.status})`);
  must(s2.body?.stopped === false, "W2 the receipt says stopped:false");
  must(s2.body?.outcome === "missed", `W2 the receipt's class is missed (got ${s2.body?.outcome})`);
  must(
    (s2.body?.message ?? "").includes("no live process"),
    `W2 the message names the miss ("${s2.body?.message ?? ""}")`
  );
  must(
    (s2.body?.job?.result ?? "").includes("stop missed"),
    `W2 the interim result names the miss ("${s2.body?.job?.result ?? ""}")`
  );
  must(!(s2.body?.job?.result ?? "").includes("stopped by user"), "W2 no user-stop is claimed");
  must((await jobRow(jobIds.w2))?.status === "failed", "W2 the job lands terminal");
  must(readRecord(jobIds.w2)?.done === false, "W2 the record is untouched (nothing was killed)");

  // ---- W3: missed (remote) — the 137 stamp must NOT land ------------------
  console.log("== W3: missed remote — the ledger claims nothing ==");
  writeStateRuns({
    ...stateRuns(),
    [jobIds.w3]: {
      jobId: jobIds.w3,
      projectId: projId,
      type: "motioncorr",
      cmd: "t623: a REMOTE record whose connection is gone",
      workdir: "/tmp/t623-w3",
      logFile: "/tmp/t623-w3/run.out",
      errFile: "/tmp/t623-w3/run.err",
      startedAt: new Date().toISOString(),
      done: false,
      remote: {
        connectionId: "qa-t623-gone-connection",
        connectionName: "t623-gone-cluster",
        host: "t623.mock.cluster",
        user: "t623",
        remoteWorkdir: "/projects/cryoflow/t623",
        module: "relion/5.0.1",
        mode: "direct",
      },
    },
  });
  await setRunning(jobIds.w3);
  const s3 = await stopJob(jobIds.w3);
  must(s3.status === 200, `W3 the stop lands (${s3.status})`);
  must(s3.body?.stopped === false, "W3 the receipt says stopped:false");
  must(s3.body?.outcome === "missed", `W3 the receipt's class is missed (got ${s3.body?.outcome})`);
  must(
    (s3.body?.message ?? "").includes("connection"),
    `W3 the message names the unreachable killer ("${s3.body?.message ?? ""}")`
  );
  must(
    (s3.body?.job?.result ?? "").includes("stop missed"),
    `W3 the interim result names the miss ("${s3.body?.job?.result ?? ""}")`
  );
  must(
    (s3.body?.job?.result ?? "").includes("cluster ledger"),
    "W3 the interim result points at the cluster ledger's authority"
  );
  must(!(s3.body?.job?.result ?? "").includes("stopped by user"), "W3 no user-stop is claimed");
  must((await jobRow(jobIds.w3))?.status === "failed", "W3 the job lands terminal");
  const rec3 = readRecord(jobIds.w3);
  must(rec3?.done === true, "W3 the record is finalized (no ghost-block for re-runs)");
  must(
    rec3?.exitCode === undefined,
    `W3 NO 137 stamp on a missed kill (exitCode ${JSON.stringify(rec3?.exitCode)})`
  );
  must(
    (rec3?.result ?? "").includes("stop missed"),
    `W3 the record's own words name the miss ("${rec3?.result ?? ""}")`
  );

  // ---- W4: killed (local, REAL) — the SIGTERM actually flows --------------
  console.log("== W4: killed real — a live tree receives the signal ==");
  sleepChild = spawn("sleep", ["300"], { stdio: "ignore" });
  const spid = sleepChild.pid;
  must(Number.isFinite(spid) && spid > 1, `W4 the sleep lives (pid ${spid})`);
  writeStateRuns({
    ...stateRuns(),
    [jobIds.w4]: {
      jobId: jobIds.w4,
      projectId: projId,
      type: "import",
      pid: spid,
      cmd: `sleep 300`,
      workdir: "/tmp/t623-w4",
      logFile: "/tmp/t623-w4/run.out",
      errFile: "/tmp/t623-w4/run.err",
      startedAt: new Date().toISOString(),
      done: false,
    },
  });
  await setRunning(jobIds.w4);
  const s4 = await stopJob(jobIds.w4);
  must(s4.status === 200, `W4 the stop lands (${s4.status})`);
  must(s4.body?.stopped === true, "W4 the receipt says stopped:true");
  must(s4.body?.outcome === "killed", `W4 the receipt's class is killed (got ${s4.body?.outcome})`);
  must(
    (s4.body?.message ?? "").includes("stopped pid"),
    `W4 the message names the kill ("${s4.body?.message ?? ""}")`
  );
  await sleep(600); // the engine's own finalize + the route's 400ms reflect
  let dead = true;
  try {
    process.kill(spid, 0);
    dead = false;
  } catch {
    dead = true;
  }
  must(dead, "W4 the sleep is actually DEAD (the SIGTERM flowed)");
  must(
    (s4.body?.job?.result ?? "").startsWith("stopped by user"),
    `W4 a confirmed kill earns the user-stop sentence ("${s4.body?.job?.result ?? ""}")`
  );
  must((await jobRow(jobIds.w4))?.status === "failed", "W4 the job lands terminal");
  const rec4 = readRecord(jobIds.w4);
  must(
    rec4?.done === true && rec4?.exitCode === -1,
    `W4 the engine finalized the record (exit -1, got ${JSON.stringify(rec4?.exitCode)})`
  );

  // ---- R: world hygiene ----------------------------------------------------
  console.log("== R: world hygiene ==");
} finally {
  console.log("== cleanup ==");
  if (sleepChild) {
    try {
      sleepChild.kill("SIGKILL");
    } catch {
      /* already dead — W4's own doing */
    }
  }
  if (snap0) {
    writeFileSync(STATE_FILE, snap0);
    console.log("  (cleanup) state file restored to the pre-suite truth");
  }
  if (projId) {
    const del = await api("DELETE", `/api/projects/${projId}`);
    console.log(`  (cleanup) fixture project deleted (${del.status})`);
  }
  await db.$disconnect().catch(() => {});
  const rosterEnd = worldJobs((await api("GET", "/api/projects")).body);
  console.log(`  (cleanup) roster after: ${rosterEnd}`);
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

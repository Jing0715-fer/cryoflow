// t624 — the teardown confirmation window's live fire (t623's docket, step 2).
//
// The stop receipt contract (t618) made the API say what HAPPENED, not what
// the click wished — but for slurm runs "killed" still meant only "scancel
// exited 0", and scancel exiting 0 means the scheduler ACCEPTED the
// cancellation, not that the tree is dead: for seconds the ranks keep
// flushing (COMPLETING, in squeue-speak). t624 wires t418's
// awaitSlurmTeardown onto the single-job stop door (bounded 8s) and carries
// the verdict as `settled` on the response; the DB row and the toast speak
// the difference instead of claiming "stopped" flatly in every case.
//
//   W0  the world's baseline — roster floor >= 12; the mock cluster alive
//   W1  settled TRUE: a REAL mock slurm job (a bare sleep behind sbatch) —
//       scancel kills the launcher's group, squeue goes silent on the first
//       poll, the receipt says "teardown confirmed — the job left the
//       queue", the DB row says the same, the record lands 137 + user-stop
//   W2  settled FALSE: a crafted mock job whose pid file points at an
//       UNKILLABLE GROUP-SCOPED target (a root-owned kernel thread that
//       leads a root-only group — the kills fail EPERM in the dark, the
//       cancel is still ACCEPTED: the .cancelled marker and the accounting
//       row land) — squeue keeps saying RUNNING through the whole 8s
//       window, the receipt says "teardown NOT confirmed ... the cluster
//       ledger decides the final state", the DB row speaks the humble
//       sentence, and the record still earns 137 (the scheduler DID
//       accept). THE FIRST CRAFT POINTED AT PID 1 AND NUKED THE WORLD:
//       POSIX kill grammar makes kill(-1) the "every process the caller
//       may signal" WILDCARD, not "group 1" — the mock's scancel TERMed
//       the whole z universe (server, mock, witness, tool shell) and the
//       window's own ceremony died twice before the autopsy. The scout
//       below refuses any target <= 1.
//   W3  settled NULL: the direct (pid-group) remote kill — the question
//       never applied; the legacy words ("cluster-side session killed")
//       survive verbatim, the sleeper dies for real
//   R   world hygiene: ledger snapshot restored, fixture project deleted,
//       the connection deleted, the mock's ledger files and accounting
//       restored, roster back at the floor
//
// Authority composition (t623's three-layer law): ACTIONS through the
// product's doors (HTTP with same-origin headers, t415 lineage); STATE
// through the seed's authority (Prisma direct write pinned to the .env DB —
// the bare-node and lying-shell lessons of t623); RECORDS through the
// ledger's own file (engine-state.json snapshot/craft/restore, t294
// lineage); the MOCK's side through its own stub grammar (sbatch/squeue/
// scancel files under the mock's $HOME/.slurm, t299 lineage).
//
// Run: node scripts/t624-stop-teardown-live-fire.mjs   (server on :3000)
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import net from "node:net";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const CONN = "conn-t624-teardown";
const MOCK_W2_ID = 990246; // a slurm id the mock has never minted

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, deadlineMs = 10_000, gapMs = 500) => {
  const end = Date.now() + deadlineMs;
  for (;;) {
    const v = await fn();
    if (v !== null && v !== undefined && v !== false) return v;
    if (Date.now() >= end) return null;
    await sleep(gapMs);
  }
};

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

// ---- the mock cluster's own doors (t299 lineage) --------------------------
const client = (cmd) =>
  execFileSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000,
  });
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
const squeueState = (id) => {
  try {
    return client(`squeue -j ${id} -h -o %T`).trim();
  } catch {
    return "";
  }
};

// ---- the seed's authority for STATE (t623's env pin) ----------------------
const CANONICAL_DB = "file:/home/z/my-project/db/cryoflow.db";
const envUrl = (() => {
  try {
    const m = readFileSync(`${ROOT}/.env`, "utf8").match(/^DATABASE_URL=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
})();
const db = new PrismaClient({
  datasources: { db: { url: envUrl ?? CANONICAL_DB } },
});

const worldJobs = (body) =>
  (body?.projects ?? []).reduce((a, p) => a + (p.stats?.total ?? 0), 0);

let snap0 = null;
let projId = null;
const jobIds = {};
const sbatchIds = [];
let accPre = "NO";
let weLaunchedMock = false;

/** plant a running slurm/direct record pointing at the REAL connection. */
const plant = (jobId, slurmId, remoteWd, localWd, mode = "slurm", pid = null) => {
  const runs = { ...stateRuns() };
  runs[jobId] = {
    jobId,
    projectId: projId,
    type: "import",
    pid: null,
    cmd: `t624: planted witness (${mode})`,
    workdir: localWd,
    logFile: `${localWd}/run.out`,
    errFile: `${localWd}/run.err`,
    startedAt: new Date().toISOString(),
    done: false,
    remote: {
      connectionId: CONN,
      connectionName: "QA t624 Teardown",
      host: "127.0.0.1:3022",
      user: "cryo",
      module: "",
      mode,
      remoteRoot: "/projects/cryoflow",
      remoteWorkdir: remoteWd,
      pid,
      slurmId: slurmId != null ? String(slurmId) : null,
      phase: "running",
    },
  };
  writeStateRuns(runs);
};

try {
  // ---- W0: the world's baseline ------------------------------------------
  console.log("== W0: the world's baseline ==");
  const roster0 = worldJobs((await api("GET", "/api/projects")).body);
  must(roster0 >= 12, `roster identity >= 12 (got ${roster0})`);
  if (!(await mockListening())) {
    execSyncSafe("bash services/mock-cluster/launch.sh");
    for (let i = 0; i < 40 && !(await mockListening()); i++) await sleep(500);
    weLaunchedMock = true;
  }
  must(await mockListening(), "the mock cluster answers on :3022");

  // ---- the fixture: one project, three jobs, through the product doors ---
  const mk = await api("POST", "/api/projects", { name: "t624 stop teardown" });
  projId = mk.body?.project?.id;
  must(mk.status === 201 && !!projId, "the fixture project exists");
  for (const [slot, name] of [
    ["w1", "t624 confirmed kill"],
    ["w2", "t624 accepted unconfirmed"],
    ["w3", "t624 direct kill"],
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

  // ---- snapshots BEFORE any crafting -------------------------------------
  snap0 = readFileSync(STATE_FILE, "utf8");
  try {
    accPre = client('test -f "$HOME/.slurm/accounting" && echo YES || echo NO').trim();
    if (accPre === "YES")
      client('cp "$HOME/.slurm/accounting" "$HOME/.slurm/accounting.t624snap"');
  } catch { accPre = "NO"; }

  // ---- the connection the planted records ride ---------------------------
  const mkc = await api("POST", "/api/remote/connections", {
    id: CONN, name: "QA t624 Teardown", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  });
  must(mkc.status === 201 || mkc.status === 200, `the mock connection exists (${mkc.status})`);

  const stopJob = async (id) => api("POST", `/api/jobs/${id}/stop`, {});
  const jobRow = async (id) => db.job.findUnique({ where: { id } });
  const setRunning = (id) =>
    db.job.update({ where: { id }, data: { status: "running", progress: 10 } });

  // ---- W1: settled TRUE — the tree is GONE -------------------------------
  console.log("== W1: settled true — a real sbatch'd sleep, scancel'd for real ==");
  client('mkdir -p /projects/cryoflow/t624 && printf "#!/usr/bin/env bash\\nsleep 300\\n" > /projects/cryoflow/t624/w1.sh');
  const sub = client("sbatch /projects/cryoflow/t624/w1.sh");
  const w1slurm = Number(/Submitted batch job (\d+)/.exec(sub)?.[1]);
  must(Number.isFinite(w1slurm) && w1slurm > 0, `the mock minted a real job (${w1slurm})`);
  if (Number.isFinite(w1slurm) && w1slurm > 0) sbatchIds.push(w1slurm);
  const w1launcher = Number(
    client(`awk '{print $2}' "$HOME/.slurm/job-${w1slurm}.pid"`).trim()
  );
  must(Number.isFinite(w1launcher) && w1launcher > 0, `the launcher pid is on file (${w1launcher})`);
  const w1running = await pollUntil(() => (squeueState(w1slurm) === "RUNNING" ? "RUNNING" : null), 15_000, 700);
  must(w1running === "RUNNING", "the mock job reached RUNNING before the stop");
  const w1wdRemote = "/projects/cryoflow/t624/wd1";
  const w1wdLocal = `${ROOT}/data/relion/t624-teardown/wd1`;
  client(`mkdir -p ${w1wdRemote}`);
  plant(jobIds.w1, w1slurm, w1wdRemote, w1wdLocal);
  await setRunning(jobIds.w1);

  const r1 = await stopJob(jobIds.w1);
  must(r1.status === 200, `the stop door answered (${r1.status})`);
  must(r1.body?.stopped === true, "the receipt says stopped (W1)");
  must(r1.body?.outcome === "killed", "the receipt's class is killed (W1)");
  must(r1.body?.settled === true, "the receipt's verdict is settled TRUE — the job left the queue");
  must(
    String(r1.body?.message ?? "").includes("teardown confirmed — the job left the queue"),
    "the message names the confirmation"
  );
  const row1 = await pollUntil(async () => {
    const r = await jobRow(jobIds.w1);
    return r && String(r.result ?? "").includes("cluster-side session killed; teardown confirmed") ? r : null;
  }, 4_000, 500);
  must(row1?.status === "failed", "the DB row landed failed (W1)");
  must(
    !!row1,
    "the DB row speaks the confirmed sentence"
  );
  const rec1 = stateRuns()[jobIds.w1];
  must(rec1?.done === true && rec1?.exitCode === 137 && rec1?.result === "stopped by user",
    "the record earned the 137 user-stop stamp (W1)");
  const w1dead = await pollUntil(() => {
    try {
      const v = client(`kill -0 ${w1launcher} 2>/dev/null && echo ALIVE || echo DEAD`).trim();
      return v === "DEAD" ? "DEAD" : null;
    } catch { return null; }
  }, 10_000, 600);
  must(w1dead === "DEAD", "the launcher's tree is actually dead (kill -0)");
  must(squeueState(w1slurm) === "", "squeue no longer knows the job (the teardown, verbatim)");

  // ---- W2: settled FALSE — accepted, but the tree is still leaving -------
  console.log("== W2: settled false — accepted; the ledger decides the final state ==");
  // the craft: a pid file pointing at an UNKILLABLE GROUP-SCOPED target —
  // see the header's live lesson: pid 1 (or any pid <= 1) rides the
  // kill(-1) wildcard and TERMs the whole world. The scout picks a root
  // kernel thread that leads a root-only group: scancel's liveness check
  // passes, every kill lands EPERM (silenced), the cancel is ACCEPTED.
  const psRows = execFileSync("ps", ["-eo", "pid,pgid,user"], { encoding: "utf8" })
    .trim().split("\n").slice(1)
    .map((l) => { const f = l.trim().split(/\s+/); return { pid: Number(f[0]), pgid: Number(f[1]), user: f[2] }; });
  let target = null;
  for (const p of psRows.sort((a, b) => a.pid - b.pid)) {
    if (p.pid <= 1 || p.user !== "root" || p.pgid !== p.pid) continue;
    if (psRows.filter((r) => r.pgid === p.pid).some((m) => m.user !== "root")) continue;
    try {
      const st = execFileSync("awk", ["{print $22}", `/proc/${p.pid}/stat`], { encoding: "utf8" }).trim();
      if (!/^\d+$/.test(st)) continue;
      target = { pid: p.pid, st };
      break;
    } catch { continue; }
  }
  must(!!target, `an unkillable group-scoped target exists (pid ${target?.pid ?? "none"})`);
  must(!!target && target.pid > 1, "the target outranks the kill(-1) wildcard (pid > 1)");
  client(
    `printf '${MOCK_W2_ID} ${target.pid} ${target.st}\\n' > "$HOME/.slurm/job-${MOCK_W2_ID}.pid"`
  );
  must(squeueState(MOCK_W2_ID) === "RUNNING", "the crafted job reads RUNNING (the stub's own grammar)");
  const w2wdRemote = "/projects/cryoflow/t624/wd2";
  const w2wdLocal = `${ROOT}/data/relion/t624-teardown/wd2`;
  client(`mkdir -p ${w2wdRemote}`);
  plant(jobIds.w2, MOCK_W2_ID, w2wdRemote, w2wdLocal);
  await setRunning(jobIds.w2);

  const t2 = Date.now();
  const r2 = await stopJob(jobIds.w2);
  const took2 = Date.now() - t2;
  must(r2.status === 200, `the stop door answered (${r2.status})`);
  must(r2.body?.stopped === true, "the receipt says stopped — the cancel was ACCEPTED (W2)");
  must(r2.body?.outcome === "killed", "the receipt's class is killed (W2 — nothing was missed)");
  must(r2.body?.settled === false, "the receipt's verdict is settled FALSE — still leaving at the deadline");
  must(took2 >= 7_500, `the 8s window actually ran (took ${Math.round(took2 / 100) / 10}s)`);
  must(
    String(r2.body?.message ?? "").includes("teardown NOT confirmed") &&
      String(r2.body?.message ?? "").includes("the cluster ledger decides the final state"),
    "the message names the miss and hands the final word to the ledger"
  );
  const row2 = await pollUntil(async () => {
    const r = await jobRow(jobIds.w2);
    return r && String(r.result ?? "").includes("the cluster ledger decides the final state") ? r : null;
  }, 4_000, 500);
  must(row2?.status === "failed", "the DB row landed failed (W2)");
  must(
    !!row2 && String(row2.result ?? "").includes("cluster-side cancellation accepted"),
    "the DB row speaks the humble sentence"
  );
  const rec2 = stateRuns()[jobIds.w2];
  must(rec2?.done === true && rec2?.exitCode === 137 && rec2?.result === "stopped by user",
    "the record still earns 137 — the scheduler DID accept (W2)");
  must(squeueState(MOCK_W2_ID) === "RUNNING", "squeue STILL says RUNNING — the unconfirmed truth, verbatim");
  must(client(`test -f "$HOME/.slurm/job-${MOCK_W2_ID}.cancelled" && echo YES || echo NO`).trim() === "YES",
    "the mock's own testimony: the cancel marker landed (accepted)");
  const tline = execFileSync("ps", ["-o", "pid=,pgid=,user=", "-p", String(target.pid)], { encoding: "utf8" }).trim().split(/\s+/);
  must(
    tline[0] === String(target.pid) && tline[1] === String(target.pid) && tline[2] === "root",
    "the crafted target survived the EPERM kills untouched"
  );

  // ---- W3: settled NULL — the direct kill never asks the scheduler -------
  console.log("== W3: settled null — the direct (pid-group) kill, legacy words intact ==");
  const w3wdRemote = "/projects/cryoflow/t624/wd3";
  const w3wdLocal = `${ROOT}/data/relion/t624-teardown/wd3`;
  // setsid from a backgrounded child never forks → $! IS the sleeper's pid,
  // and it leads its own session/group — exactly what the stop's kill
  // script (kill -- -$P) expects to find via .cf-pid.
  client(
    `mkdir -p ${w3wdRemote} && cd ${w3wdRemote} && ` +
      `{ setsid bash -c 'sleep 300' > /dev/null 2>&1 < /dev/null & echo $! > .cf-pid; }`
  );
  const w3pid2 = await pollUntil(() => {
    try {
      const v = Number(client(`cat ${w3wdRemote}/.cf-pid`).trim());
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch { return null; }
  }, 8_000, 400);
  must(Number.isFinite(w3pid2) && w3pid2 > 0, `the remote sleeper is alive on record (${w3pid2})`);
  plant(jobIds.w3, null, w3wdRemote, w3wdLocal, "direct", w3pid2);
  await setRunning(jobIds.w3);

  const r3 = await stopJob(jobIds.w3);
  must(r3.status === 200, `the stop door answered (${r3.status})`);
  must(r3.body?.stopped === true, "the receipt says stopped (W3)");
  must(r3.body?.outcome === "killed", "the receipt's class is killed (W3)");
  must(r3.body?.settled === null, "the verdict is null — the question never applied");
  must(
    String(r3.body?.message ?? "").includes("sent SIGTERM+SIGKILL to the cluster-side session"),
    "the legacy message survives verbatim"
  );
  const row3 = await jobRow(jobIds.w3);
  must(
    String(row3?.result ?? "") ===
      "stopped by user (cluster-side session killed) — re-run resumes from the last synced checkpoint",
    "the DB row's legacy sentence survives verbatim"
  );
  const w3dead = await pollUntil(() => {
    try {
      const v = client(`kill -0 ${w3pid2} 2>/dev/null && echo ALIVE || echo DEAD`).trim();
      return v === "DEAD" ? "DEAD" : null;
    } catch { return null; }
  }, 10_000, 600);
  must(w3dead === "DEAD", "the remote sleeper actually died (kill -0)");

  // ---- R: world hygiene ---------------------------------------------------
  console.log("== R: the world restored ==");
  const roster1 = worldJobs((await api("GET", "/api/projects")).body);
  must(roster1 >= 12, `roster intact with fixtures aboard (got ${roster1})`);
} finally {
  console.log("== cleanup ==");
  // records first (the t272 order law): restore the ledger snapshot, THEN
  // delete the rows — clearRunRecord finds nothing, no ghosts.
  try {
    if (snap0 != null) writeStateRuns(JSON.parse(snap0).runs ?? JSON.parse(snap0));
  } catch { /* best effort */ }
  for (const id of Object.values(jobIds).reverse()) {
    try { await api("DELETE", `/api/jobs/${id}`); } catch { /* best effort */ }
  }
  try { await api("DELETE", `/api/projects/${projId}`); } catch { /* best effort */ }
  try { await api("DELETE", `/api/remote/connections/${CONN}`); } catch { /* best effort */ }
  // mock side: my job files, the crafted W2 files, the accounting, the dirs
  try {
    const parts = ["rm -rf /projects/cryoflow/t624"];
    for (const id of sbatchIds)
      parts.push(`rm -f "$HOME/.slurm/job-${id}."* "$HOME/.slurm/.launch-${id}.sh"`);
    parts.push(`rm -f "$HOME/.slurm/job-${MOCK_W2_ID}."*`);
    if (accPre === "YES") {
      parts.push('mv "$HOME/.slurm/accounting.t624snap" "$HOME/.slurm/accounting" 2>/dev/null || true');
    } else {
      parts.push('rm -f "$HOME/.slurm/accounting"');
    }
    parts.push('rm -f "$HOME/.slurm/accounting.t624snap"');
    client(parts.join("; "));
  } catch { /* best effort */ }
  try { rmSync(`${ROOT}/data/relion/t624-teardown`, { recursive: true, force: true }); } catch { /* gone */ }
  if (weLaunchedMock) {
    try {
      execFileSync("pkill", ["-f", "mock-cluster/server.mjs"], { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
  await sleep(1000);
  try {
    const n = worldJobs((await api("GET", "/api/projects")).body);
    must(n >= 12, `roster restored to the floor (got ${n})`);
  } catch { /* server busy */ }
  try { await db.$disconnect(); } catch { /* best effort */ }
}

console.log(fail === 0 ? "\nt624: ALL PASS" : `\nt624: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;

function execSyncSafe(cmd) {
  try { execFileSync("bash", ["-c", cmd], { cwd: ROOT, stdio: "pipe", timeout: 30_000 }); } catch { /* noop */ }
}

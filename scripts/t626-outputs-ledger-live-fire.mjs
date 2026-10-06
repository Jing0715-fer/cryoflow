// t626 — the outputs ledger leg's live fire (the receipt's fourth level,
// first slice — the t625 docket's step ④, scoped down to what tonight's
// memory budget can witness).
//
// The accounting landing (t625) closed the receipt's WORD question — but it
// also EXPOSED a second question: a healed run's row says completed/100
// while the sync-back never ran for it. No local mirror, and crucially NO
// REMOTE MANIFEST — the exact-entry authorization source the Files tab,
// the t424 batch bring-home, and the t289 lazy fetch all read. The
// on-demand policy exists but is DEAD for a landed job: the route "cannot
// be talked into fetching anything the ledger does not already name", and
// the ledger names nothing. The sweep's new leg answers with ONE
// manifest-only SSH round per landed record (the same find grammar the
// sync-back opens with — t289's own "ledger first" doctrine): no
// downloads, no per-class split, no dispatch.
//
//   W0  the world's baseline — roster floor >= 12; the mock cluster alive
//   W1  the LANDING'S QUESTION: a real mock sbatch'd sleep, stopped through
//       the product door, the journal crafted COMPLETED (t625's own W1
//       choreography) — the consult lands, and the landing OPENS the
//       outputs question (outputsLedgerPending). The next sweep pass's leg
//       runs the find against the mock's REAL bash (the mock exec is a real
//       shell over a real FS — the planted workdir files are really
//       enumerated), and the manifest lands in the LOCAL workdir: it names
//       the planted files (root + nested), carries the connection id and
//       remote workdir, and the record closes its question with
//       outputsLedgerAt stamped. The record's words are untouched by the
//       leg — the manifest names, it never speaks verdicts.
//   W3  the WORKDIR GONE: a done record carrying the flag whose LOCAL
//       workdir no longer exists (cleanup took it) — the leg closes the
//       question deterministically (ledger-side, no SSH): flag cleared, no
//       outputsLedgerAt, no manifest, no crash. An aged-into-a-per-tick-
//       rescan question is exactly what this branch refuses to become.
//   W2  the THREE STRIKES: a done record carrying the flag on the live
//       connection, with the mock's exec-slow-ms lever set to torture every
//       `find` past the app's 15s timeout (20000ms on a substring only the
//       manifest find speaks). Three silent rounds — three tries — and the
//       question CLOSES exhausted: flag cleared, NO outputsLedgerAt, NO
//       manifest, and the record's receipt words (137 / "stopped by user")
//       stand exactly as the stop left them — the leg names files, it
//       never rewrites verdicts.
//   R   world hygiene: ledger snapshot restored, fixture jobs + project +
//       connection deleted, the mock's journal/job files/lever files
//       restored, local workdirs removed, roster back at the floor, the
//       ACTIVE POINTER back to its pre-fixture owner (the t624 lesson, the
//       t625 R-phase law).
//
// Authority composition (t623's three-layer law, t625's choreography):
// ACTIONS through the product doors (HTTP, same-origin headers); STATE
// through the seed's authority (Prisma pinned to the .env DB); RECORDS
// through the ledger's own file (engine-state.json craft/restore); the
// MOCK's side through its own bash (real find, real files, the ~/.slurm
// lever convention).
//
// Run: node scripts/t626-outputs-ledger-live-fire.mjs   (server on :3000)
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import net from "node:net";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const CONN = "conn-t626-outputs";
const LOCAL_WDS = `${ROOT}/data/relion/t626-ledger`;
const MANIFEST_NAME = ".cf-remote-manifest.json";
const LEVER = 'printf "20000 maxdepth 1" > "$HOME/.slurm/exec-slow-ms"';
const LEVER_RM = 'rm -f "$HOME/.slurm/exec-slow-ms"';

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
let prevActiveId = null;
const jobIds = {};
const sbatchIds = [];
let accPre = "NO";
let weLaunchedMock = false;

/** plant a DONE record already carrying (or not) the outputs question. */
const plantDone = (jobId, opts) => {
  const runs = { ...stateRuns() };
  runs[jobId] = {
    jobId,
    projectId: projId,
    type: "import",
    pid: null,
    cmd: `t626: planted witness (${opts.label})`,
    workdir: opts.localWd,
    logFile: `${opts.localWd}/run.out`,
    errFile: `${opts.localWd}/run.err`,
    startedAt: new Date().toISOString(),
    done: true,
    exitCode: opts.exitCode ?? 137,
    result: opts.result ?? "stopped by user",
    remote: {
      connectionId: opts.connectionId,
      connectionName: "QA t626 outputs",
      host: "127.0.0.1:3022",
      user: "cryo",
      module: "",
      mode: "slurm",
      remoteRoot: "/projects/cryoflow",
      remoteWorkdir: opts.remoteWd,
      pid: null,
      slurmId: opts.slurmId != null ? String(opts.slurmId) : null,
      phase: "running",
      ...(opts.flag ? { outputsLedgerPending: true } : {}),
    },
  };
  writeStateRuns(runs);
};

/** plant a RUNNING slurm record (the t625 choreography's opening). */
const plantRunning = (jobId, connectionId, slurmId, remoteWd, localWd) => {
  const runs = { ...stateRuns() };
  runs[jobId] = {
    jobId,
    projectId: projId,
    type: "import",
    pid: null,
    cmd: `t626: planted witness (slurm ${slurmId})`,
    workdir: localWd,
    logFile: `${localWd}/run.out`,
    errFile: `${localWd}/run.err`,
    startedAt: new Date().toISOString(),
    done: false,
    remote: {
      connectionId,
      connectionName: "QA t626 outputs",
      host: "127.0.0.1:3022",
      user: "cryo",
      module: "",
      mode: "slurm",
      remoteRoot: "/projects/cryoflow",
      remoteWorkdir: remoteWd,
      pid: null,
      slurmId: slurmId != null ? String(slurmId) : null,
      phase: "running",
    },
  };
  writeStateRuns(runs);
};

/** append a terminal row to the mock's accounting journal (its own grammar). */
const craftAccounting = (id, state, exit, sig) => {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 42;
  client(
    `printf '${id}|${state}|${exit}:${sig}|${end}|${start}|\\n' >> "$HOME/.slurm/accounting"`
  );
};

try {
  // ---- W0: the world's baseline ------------------------------------------
  console.log("== W0: the world's baseline ==");
  const projBody0 = (await api("GET", "/api/projects")).body;
  const roster0 = worldJobs(projBody0);
  must(roster0 >= 12, `roster identity >= 12 (got ${roster0})`);
  const prevActive = (projBody0?.projects ?? []).find((p) => p.active)?.id ?? null;
  prevActiveId = prevActive;
  must(!!prevActiveId, `the pre-fixture active project is on record (${prevActiveId})`);
  if (!(await mockListening())) {
    execSyncSafe("bash services/mock-cluster/launch.sh");
    for (let i = 0; i < 40 && !(await mockListening()); i++) await sleep(500);
    weLaunchedMock = true;
  }
  must(await mockListening(), "the mock cluster answers on :3022");

  // ---- the fixture: one project, three jobs, through the product doors ---
  const mk = await api("POST", "/api/projects", { name: "t626 outputs ledger" });
  projId = mk.body?.project?.id;
  must(mk.status === 201 && !!projId, "the fixture project exists");
  for (const [slot, name] of [
    ["w1", "t626 landing opens the outputs question"],
    ["w3", "t626 workdir gone closes it unasked"],
    ["w2", "t626 three strikes close it exhausted"],
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
      client('cp "$HOME/.slurm/accounting" "$HOME/.slurm/accounting.t626snap"');
  } catch { accPre = "NO"; }

  // ---- the connection the records ride -----------------------------------
  const mkc = await api("POST", "/api/remote/connections", {
    id: CONN, name: "QA t626 outputs", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  });
  must(mkc.status === 201 || mkc.status === 200, `the mock connection exists (${mkc.status})`);

  const stopJob = async (id) => api("POST", `/api/jobs/${id}/stop`, {});
  const jobRow = async (id) => db.job.findUnique({ where: { id } });
  const setRunning = (id) =>
    db.job.update({ where: { id }, data: { status: "running", progress: 10 } });
  const setFailed = (id) =>
    db.job.update({ where: { id }, data: { status: "failed", progress: 0 } });
  // the DRIVE leg: the fixture project is active (POST /api/projects sets
  // active), so every GET /api/jobs fires the sweep over the planted
  // records — the UI's own cadence, the product door, no background-tick
  // dependency (t625's lesson: the tick holds the module it booted with).
  const drive = async () => {
    try { await api("GET", "/api/jobs"); } catch { /* best effort */ }
  };
  const manifest = (localWd) => {
    try {
      return JSON.parse(readFileSync(`${localWd}/${MANIFEST_NAME}`, "utf8"));
    } catch {
      return null;
    }
  };

  // ---- W1: the LANDING OPENS THE QUESTION — and the leg answers it -------
  console.log("== W1: the landing's outputs question, answered by one find ==");
  // the REMOTE workdir is real (the mock execs a real bash over a real FS):
  // root files (run.out, run_data.star, note.txt) + one nested round file —
  // the find's band a/b/c/d grammar gets all four families to chew on.
  client(
    'mkdir -p /projects/cryoflow/t626/wd1/rounds && ' +
    'printf "hello t626 out\\n" > /projects/cryoflow/t626/wd1/run.out && ' +
    'printf "hello t626 err\\n" > /projects/cryoflow/t626/wd1/run.err && ' +
    'printf "data_star\\n" > /projects/cryoflow/t626/wd1/run_data.star && ' +
    'printf "note\\n" > /projects/cryoflow/t626/wd1/note.txt && ' +
    'printf "round\\n" > /projects/cryoflow/t626/wd1/rounds/it001.rdelog'
  );
  // the LOCAL workdir must exist (the leg's existsSync guard) but stay
  // EMPTY — the leg pulls nothing; its whole product is the manifest.
  execSyncSafe(`mkdir -p ${LOCAL_WDS}/wd1`);
  const w1wdLocal = `${LOCAL_WDS}/wd1`;

  client('mkdir -p /projects/cryoflow/t626 && printf "#!/usr/bin/env bash\\nsleep 300\\n" > /projects/cryoflow/t626/w1.sh');
  const sub1 = client("sbatch /projects/cryoflow/t626/w1.sh");
  const w1slurm = Number(/Submitted batch job (\d+)/.exec(sub1)?.[1]);
  must(Number.isFinite(w1slurm) && w1slurm > 0, `the mock minted a real job (${w1slurm})`);
  if (Number.isFinite(w1slurm) && w1slurm > 0) sbatchIds.push(w1slurm);
  await pollUntil(() => (squeueState(w1slurm) === "RUNNING" ? "RUNNING" : null), 15_000, 700);
  plantRunning(jobIds.w1, CONN, w1slurm, "/projects/cryoflow/t626/wd1", w1wdLocal);
  await setRunning(jobIds.w1);

  const r1 = await stopJob(jobIds.w1);
  must(r1.status === 200 && r1.body?.outcome === "killed", `the receipt says killed (${r1.body?.outcome})`);

  // the ledger's LAST row wins (the mock's requeue grammar) — the landing
  // the stop-time receipt could not have known (t625's own choreography).
  craftAccounting(w1slurm, "COMPLETED", 0, 0);

  const landed = await pollUntil(() => {
    void drive();
    const r = stateRuns()[jobIds.w1];
    return r?.done &&
      r?.exitCode === 0 &&
      !r?.remote?.accountingPending &&
      r?.remote?.outputsLedgerPending === true
      ? r
      : null;
  }, 90_000, 2_000);
  must(
    !!landed,
    "the consult landed AND the landing opened the outputs question (W1)"
  );
  must(
    !!landed && landed.remote?.slurmState === "COMPLETED",
    "the record carries the ledger's word (W1, t625's contract intact)"
  );

  const m1 = await pollUntil(() => {
    void drive();
    const r = stateRuns()[jobIds.w1];
    return r?.remote && r.remote.outputsLedgerPending == null && r.remote.outputsLedgerAt > 0
      ? manifest(w1wdLocal)
      : null;
  }, 60_000, 2_000);
  must(!!m1, "the leg answered — the manifest landed in the local workdir (W1)");
  must(
    !!m1 && Array.isArray(m1.files) && m1.files.some((f) => f.path === "run_data.star"),
    "the manifest names the final star family (W1)"
  );
  must(
    !!m1 && m1.files.some((f) => f.path === "run.out") && m1.files.some((f) => f.path === "note.txt"),
    "the manifest names the root's non-star files (W1)"
  );
  must(
    !!m1 && m1.files.some((f) => f.path === "rounds/it001.rdelog"),
    "the manifest names the nested round files (W1, band d)"
  );
  must(
    !!m1 && m1.connectionId === CONN && m1.remoteWorkdir === "/projects/cryoflow/t626/wd1",
    "the manifest carries the cluster address (W1)"
  );
  const rec1 = stateRuns()[jobIds.w1];
  must(
    rec1?.exitCode === 0 &&
      rec1?.result ===
        "the cluster ledger recorded the run COMPLETED (exit 0:0) — the stop's cancellation arrived after the run had finished",
    "the record's WORDS are untouched by the leg — the manifest names, it never rewrites verdicts (W1)"
  );
  const localAfter = execSyncSafe2(`ls -A ${w1wdLocal}`);
  must(
    localAfter.trim().split("\n").filter(Boolean).every((n) => n === MANIFEST_NAME),
    "the leg pulled NOTHING home — its whole product is the manifest (W1)"
  );

  // ---- W3: the WORKDIR GONE closes the question unasked -------------------
  console.log("== W3: the local workdir gone — the question closes unasked ==");
  plantDone(jobIds.w3, {
    label: "workdir gone",
    connectionId: CONN,
    remoteWd: "/projects/cryoflow/t626/wd3",
    localWd: `${LOCAL_WDS}/wd3-gone`, // deliberately never created
    flag: true,
  });
  await setFailed(jobIds.w3);
  const rec3 = await pollUntil(() => {
    void drive();
    const r = stateRuns()[jobIds.w3];
    return r?.remote && r.remote.outputsLedgerPending == null && r.remote.outputsLedgerAt == null
      ? r
      : null;
  }, 30_000, 2_000);
  must(!!rec3, "the question closed unasked (the flag cleared, W3)");
  must(
    !existsSync(`${LOCAL_WDS}/wd3-gone/${MANIFEST_NAME}`),
    "no manifest was served to a workdir that does not exist (W3)"
  );

  // ---- W2: THREE STRIKES close the question exhausted ---------------------
  console.log("== W2: three silent rounds — the question closes exhausted ==");
  // the lever: every exec whose command contains "maxdepth 1" (only the
  // manifest find speaks it) sleeps 20s — past the app's 15s round timeout.
  // SLOW, not broken; persistent across the three tries by design.
  client(LEVER);
  execSyncSafe(`mkdir -p ${LOCAL_WDS}/wd2`);
  plantDone(jobIds.w2, {
    label: "three strikes",
    connectionId: CONN,
    remoteWd: "/projects/cryoflow/t626/wd2",
    localWd: `${LOCAL_WDS}/wd2`,
    exitCode: 137,
    result: "stopped by user",
    flag: true,
  });
  await setFailed(jobIds.w2);
  const rec2 = await pollUntil(() => {
    void drive();
    const r = stateRuns()[jobIds.w2];
    return r?.remote && r.remote.outputsLedgerPending == null && r.remote.outputsLedgerAt == null
      ? r
      : null;
  }, 150_000, 3_000);
  must(!!rec2, "the question closed after three silent rounds (the flag cleared, W2)");
  must(
    !existsSync(`${LOCAL_WDS}/wd2/${MANIFEST_NAME}`),
    "no manifest was served from a cluster that cannot answer (W2)"
  );
  must(
    rec2?.exitCode === 137 && rec2?.result === "stopped by user",
    "the receipt's own words stand — the leg never touches verdicts (W2)"
  );
  // the lever dies NOW — it must never torture a later window's traffic.
  client(LEVER_RM);
  must(
    !client('test -f "$HOME/.slurm/exec-slow-ms" && echo YES || echo NO').includes("YES"),
    "the torture lever is dismantled (W2 hygiene)"
  );

  // ---- R: world hygiene ---------------------------------------------------
  console.log("== R: the world restored ==");
  const roster1 = worldJobs((await api("GET", "/api/projects")).body);
  must(roster1 >= 12, `roster intact with fixtures aboard (got ${roster1})`);
} finally {
  console.log("== cleanup ==");
  client(LEVER_RM); // unconditional — a failed window must not leave the trap armed
  // records first (the t272 order law): restore the ledger snapshot, THEN
  // delete the rows — clearRunRecord finds nothing, no ghosts.
  try {
    if (snap0 != null) writeStateRuns(JSON.parse(snap0).runs ?? JSON.parse(snap0));
  } catch { /* best effort */ }
  // the active pointer back to its pre-fixture owner BEFORE the fixture
  // project dies (the t624/t625 R-phase law)
  if (prevActiveId && prevActiveId !== projId) {
    try { await api("POST", "/api/projects/switch", { id: prevActiveId }); } catch { /* best effort */ }
  }
  for (const id of Object.values(jobIds).reverse()) {
    try { await api("DELETE", `/api/jobs/${id}`); } catch { /* best effort */ }
  }
  try { await api("DELETE", `/api/projects/${projId}`); } catch { /* best effort */ }
  try { await api("DELETE", `/api/remote/connections/${CONN}`); } catch { /* best effort */ }
  // mock side: my dirs, the sbatch artifacts, the accounting snapshot
  try {
    const parts = ["rm -rf /projects/cryoflow/t626"];
    for (const id of sbatchIds)
      parts.push(`rm -f "$HOME/.slurm/job-${id}."* "$HOME/.slurm/.launch-${id}.sh"`);
    if (accPre === "YES") {
      parts.push('mv "$HOME/.slurm/accounting.t626snap" "$HOME/.slurm/accounting" 2>/dev/null || true');
    } else {
      parts.push('rm -f "$HOME/.slurm/accounting"');
    }
    parts.push('rm -f "$HOME/.slurm/accounting.t626snap"');
    client(parts.join("; "));
  } catch { /* best effort */ }
  try { rmSync(`${ROOT}/data/relion/t626-ledger`, { recursive: true, force: true }); } catch { /* gone */ }
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
    const act = ((await api("GET", "/api/projects")).body?.projects ?? []).find((p) => p.active)?.id;
    must(act === prevActiveId || !prevActiveId, `the active pointer restored (${act})`);
  } catch { /* server busy */ }
  try { await db.$disconnect(); } catch { /* best effort */ }
}

console.log(fail === 0 ? "\nt626: ALL PASS" : `\nt626: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;

function execSyncSafe(cmd) {
  try { execFileSync("bash", ["-c", cmd], { cwd: ROOT, stdio: "pipe", timeout: 30_000 }); } catch { /* noop */ }
}
function execSyncSafe2(cmd) {
  try { return execFileSync("bash", ["-c", cmd], { cwd: ROOT, encoding: "utf8", timeout: 30_000 }); } catch { return ""; }
}

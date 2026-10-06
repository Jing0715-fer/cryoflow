// t625 — the accounting backfill's live fire (t624's docket, step ④).
//
// The receipt's first two levels made the stop say WHAT HAPPENED (killed /
// missed / already-ended; accepted vs confirmed teardown). The third level
// makes the words CONVERGE: the stop-time sentence is the BEST KNOWLEDGE,
// the cluster's accounting ledger holds the FINAL word — a scancel accepted
// around an already-finishing run means sacct may answer COMPLETED (the
// landing: the row heals failed → completed), CANCELLED (the stamp
// confirmed), or FAILED with the run's own exit (the ledger's verdict).
// The sweep consults sacct for every record the stop left with an open
// question (`remote.accountingPending`), lands the terminal word, and
// closes the case; silence past the patience window has the stamp stand.
//
//   W0  the world's baseline — roster floor >= 12; the mock cluster alive
//   W1  the LANDING: a REAL mock sbatch'd sleep, stopped through the
//       product door (receipt: killed, settled true, 137 + user-stop) —
//       then the journal's last row is crafted COMPLETED (last-row-wins,
//       the mock's own requeue grammar): the sweep's consult heals the row
//       failed → completed/100 and the record earns exit 0 + the landing
//       sentence. The heal must NOT flip any downstream (none wired — the
//       world stays quiet).
//   W2  the STAMP CONFIRMED: another real sbatch + stop; scancel's own
//       CANCELLED journal row is the truth the receipt already spoke —
//       the consult closes the case, every word stands verbatim (137,
//       "stopped by user", the confirmed row sentence).
//   W3  the MISSED receipt's promise fulfilled: a record planted on a
//       GHOST connection id (the t623-W3 door — mock scancel exits 0 with
//       stderr, so the missed class needs the connection gone), the
//       journal pre-crafted COMPLETED for a never-minted id (the "already
//       finished" story). The stop misses ("the connection for this run
//       was deleted"); the sweep's t325-a HOST-MATCHED fallback finds the
//       live connection on the same host:port, the consult reads
//       COMPLETED, and the row heals completed with the sentence that
//       names WHY ("the stop had found nothing to kill because the run
//       had already finished").
//   W4  the SILENCE EXPIRY: another ghost-connection record, no journal
//       row anywhere; the open question's timestamp crafted 11 minutes
//       old (the patience window is 10) — the consult hears nothing and
//       expires the question: the flag clears, the receipt's missed
//       sentence stands verbatim, no row word changes.
//   R   world hygiene: ledger snapshot restored, fixture jobs + project +
//       connection deleted, the mock's journal and job files restored,
//       roster back at the floor. THE ACTIVE PROJECT IS NEVER SWITCHED —
//       the t624 R-phase left the active flag on the demo world and this
//       window's QA had to walk it back; the witness refuses to touch it
//       (the backfill is driven by the global reconciler's background
//       beat, not by the UI's GET — no active-project churn needed).
//
// Authority composition (t623's three-layer law): ACTIONS through the
// product's doors (HTTP with same-origin headers, t415 lineage); STATE
// through the seed's authority (Prisma direct write pinned to the .env DB —
// the bare-node and lying-shell lessons of t623); RECORDS through the
// ledger's own file (engine-state.json snapshot/craft/restore, t294
// lineage); the MOCK's side through its own stub grammar (sbatch/squeue/
// scancel/accounting under the mock's $HOME/.slurm, t299/t303 lineage).
//
// Run: node scripts/t625-accounting-backfill-live-fire.mjs   (server on :3000)
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import net from "node:net";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const CONN = "conn-t625-accounting";
const GHOST_A = "conn-t625-ghost-a"; // W3's phantom connection id
const GHOST_B = "conn-t625-ghost-b"; // W4's phantom connection id
const GHOST_SLURM = 990251; // a slurm id the mock has never minted
const GHOST_SLURM_B = 990252;

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
const patchRecord = (jobId, patch) => {
  const runs = { ...stateRuns() };
  if (!runs[jobId]) return;
  runs[jobId] = { ...runs[jobId], ...patch };
  writeStateRuns(runs);
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

/** plant a running slurm record pointing at a connection id. */
const plant = (jobId, connectionId, slurmId, remoteWd, localWd) => {
  const runs = { ...stateRuns() };
  runs[jobId] = {
    jobId,
    projectId: projId,
    type: "import",
    pid: null,
    cmd: `t625: planted witness (slurm ${slurmId})`,
    workdir: localWd,
    logFile: `${localWd}/run.out`,
    errFile: `${localWd}/run.err`,
    startedAt: new Date().toISOString(),
    done: false,
    remote: {
      connectionId,
      connectionName: connectionId === CONN ? "QA t625 Accounting" : "QA t625 ghost",
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
  const start = end - 42; // the ledger's stopwatch: a 42s run
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
  // the t624 R-phase left the active flag drifted; this witness NEVER
  // relies on it for the backfill, but it MUST restore it anyway —
  // creating the fixture SETS ACTIVE (the POST route's own semantic),
  // so remember who owned the pointer before the theft.
  const prevActive = (projBody0?.projects ?? []).find((p) => p.active)?.id ?? null;
  prevActiveId = prevActive;
  must(!!prevActiveId, `the pre-fixture active project is on record (${prevActiveId})`);
  if (!(await mockListening())) {
    execSyncSafe("bash services/mock-cluster/launch.sh");
    for (let i = 0; i < 40 && !(await mockListening()); i++) await sleep(500);
    weLaunchedMock = true;
  }
  must(await mockListening(), "the mock cluster answers on :3022");

  // ---- the fixture: one project, four jobs, through the product doors ---
  const mk = await api("POST", "/api/projects", { name: "t625 accounting backfill" });
  projId = mk.body?.project?.id;
  must(mk.status === 201 && !!projId, "the fixture project exists");
  for (const [slot, name] of [
    ["w1", "t625 landing (completed)"],
    ["w2", "t625 stamp confirmed (cancelled)"],
    ["w3", "t625 missed promise fulfilled"],
    ["w4", "t625 silence expiry"],
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
      client('cp "$HOME/.slurm/accounting" "$HOME/.slurm/accounting.t625snap"');
  } catch { accPre = "NO"; }

  // ---- the connection the planted records ride ---------------------------
  const mkc = await api("POST", "/api/remote/connections", {
    id: CONN, name: "QA t625 Accounting", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  });
  must(mkc.status === 201 || mkc.status === 200, `the mock connection exists (${mkc.status})`);

  const stopJob = async (id) => api("POST", `/api/jobs/${id}/stop`, {});
  const jobRow = async (id) => db.job.findUnique({ where: { id } });
  const setRunning = (id) =>
    db.job.update({ where: { id }, data: { status: "running", progress: 10 } });
  // the DRIVE leg: the fixture project is active (POST /api/projects sets
  // active), so every GET /api/jobs fires the sweep over the planted
  // records — the UI's own cadence, the product door, no background-tick
  // dependency (a Next dev server's background interval holds the module
  // it booted with; the route is the part that hot-reloads).
  const drive = async () => {
    try { await api("GET", "/api/jobs"); } catch { /* best effort */ }
  };

  // ---- W1: the LANDING — the ledger says COMPLETED ------------------------
  console.log("== W1: the landing — the cancel arrived after the run had finished ==");
  client('mkdir -p /projects/cryoflow/t625 && printf "#!/usr/bin/env bash\\nsleep 300\\n" > /projects/cryoflow/t625/w1.sh');
  const sub1 = client("sbatch /projects/cryoflow/t625/w1.sh");
  const w1slurm = Number(/Submitted batch job (\d+)/.exec(sub1)?.[1]);
  must(Number.isFinite(w1slurm) && w1slurm > 0, `the mock minted a real job (${w1slurm})`);
  if (Number.isFinite(w1slurm) && w1slurm > 0) sbatchIds.push(w1slurm);
  await pollUntil(() => (squeueState(w1slurm) === "RUNNING" ? "RUNNING" : null), 15_000, 700);
  must(squeueState(w1slurm) === "RUNNING", "the mock job reached RUNNING before the stop");
  const w1wdRemote = "/projects/cryoflow/t625/wd1";
  plant(jobIds.w1, CONN, w1slurm, w1wdRemote, `${ROOT}/data/relion/t625-backfill/wd1`);
  await setRunning(jobIds.w1);

  const r1 = await stopJob(jobIds.w1);
  must(r1.status === 200 && r1.body?.outcome === "killed", `the receipt says killed (${r1.body?.outcome})`);
  must(r1.body?.settled === true, "the receipt's verdict is settled TRUE (W1)");
  const rec1a = stateRuns()[jobIds.w1];
  // t625's own first lesson, encoded: the background tick may finalize the
  // record MID-STOP (the settle window overlaps the 15s beat) — the route's
  // !done guard then declines the stamp, and the second-chance write opens
  // the question on the tick-finalized record. BOTH orders end here with
  // done + the question open; only the exit (137 route vs 143 tick) varies.
  must(
    rec1a?.done === true && !!rec1a?.remote?.accountingPending,
    "the record is finalized AND the open question is aboard (W1, either handshake order)"
  );
  must(
    rec1a?.remote?.accountingPending?.missed === false,
    "the open question knows the receipt was a kill, not a miss"
  );

  // the ledger's LAST row wins (the mock's requeue grammar) — craft the
  // COMPLETED verdict the stop-time receipt could not have known.
  craftAccounting(w1slurm, "COMPLETED", 0, 0);

  const row1 = await pollUntil(async () => {
    await drive();
    const r = await jobRow(jobIds.w1);
    return r && r.status === "completed" ? r : null;
  }, 75_000, 2_000);
  must(!!row1, "the sweep's consult landed — the row healed completed (W1)");
  must(
    !!row1 && row1.progress === 100,
    "the healed row sits at 100 (W1)"
  );
  must(
    !!row1 &&
      String(row1.result ?? "").includes("the cluster ledger recorded the run COMPLETED") &&
      String(row1.result ?? "").includes("the stop's cancellation arrived after the run had finished"),
    "the row speaks the landing sentence (kill dialect)"
  );
  const rec1 = await pollUntil(() => {
    void drive();
    const r = stateRuns()[jobIds.w1];
    return r?.exitCode === 0 && !r?.remote?.accountingPending ? r : null;
  }, 30_000, 2_000);
  must(
    !!rec1 &&
      (rec1.result ===
        "the cluster ledger recorded the run COMPLETED (exit 0:0) — the stop's cancellation arrived after the run had finished" ||
        String(rec1.result ?? "").includes("REMOTE[")),
    "the record landed exit 0 + the ledger's words (or the tick's receipt when it won the race), question closed (W1)"
  );
  must(rec1?.remote?.slurmState === "COMPLETED", "the record carries the ledger's word (W1)");

  // ---- W2: the STAMP CONFIRMED — CANCELLED changes nothing ----------------
  console.log("== W2: the stamp confirmed — the ledger agrees with the receipt ==");
  client('printf "#!/usr/bin/env bash\\nsleep 300\\n" > /projects/cryoflow/t625/w2.sh');
  const sub2 = client("sbatch /projects/cryoflow/t625/w2.sh");
  const w2slurm = Number(/Submitted batch job (\d+)/.exec(sub2)?.[1]);
  must(Number.isFinite(w2slurm) && w2slurm > 0, `the mock minted the second job (${w2slurm})`);
  if (Number.isFinite(w2slurm) && w2slurm > 0) sbatchIds.push(w2slurm);
  await pollUntil(() => (squeueState(w2slurm) === "RUNNING" ? "RUNNING" : null), 15_000, 700);
  plant(jobIds.w2, CONN, w2slurm, "/projects/cryoflow/t625/wd2", `${ROOT}/data/relion/t625-backfill/wd2`);
  await setRunning(jobIds.w2);
  const r2 = await stopJob(jobIds.w2);
  must(r2.status === 200 && r2.body?.outcome === "killed" && r2.body?.settled === true,
    "the receipt says killed + settled (W2)");
  const row2pre = await pollUntil(async () => {
    const r = await jobRow(jobIds.w2);
    // the tick's fast path may finalize mid-stop — its receipt is an
    // equally honest intermediate
    return r && (String(r.result ?? "").includes("teardown confirmed") || String(r.result ?? "").includes("REMOTE[")) ? r : null;
  }, 8_000, 500);
  must(!!row2pre, "the confirmed row sentence (or the tick's receipt) landed (W2 pre)");
  // scancel's own CANCELLED row is already in the journal — no craft.
  const rec2 = await pollUntil(() => {
    void drive();
    const r = stateRuns()[jobIds.w2];
    return r?.done && r?.remote && !r.remote.accountingPending ? r : null;
  }, 75_000, 2_000);
  must(!!rec2, "the consult closed the case (the question cleared, W2)");
  // both handshake orders are legal here: the route's stamp (137 +
  // "stopped by user") or the tick's mid-stop finalize receipt (143 + the
  // REMOTE[...] words) — the LEDGER's CANCELLED confirmed the kill in both.
  must(
    !!rec2 &&
      ((rec2.exitCode === 137 && rec2.result === "stopped by user") ||
        (rec2.exitCode === 143 && String(rec2.result ?? "").includes("REMOTE["))),
    "the record's words are honest under either handshake order (W2)"
  );
  must(
    !!rec2 && rec2.remote?.slurmState === "CANCELLED",
    "the record carries the ledger's CANCELLED word (W2)"
  );
  const row2 = await jobRow(jobIds.w2);
  must(
    !!row2 && row2.status === "failed" &&
      (String(row2.result ?? "").includes("teardown confirmed") ||
        String(row2.result ?? "").includes("REMOTE[")),
    "the row's words are honest under either handshake order (W2)"
  );

  // ---- W3: the MISSED receipt's promise fulfilled --------------------------
  console.log("== W3: missed + COMPLETED — the promise becomes mechanical truth ==");
  // the "already finished" story: the journal holds COMPLETED for a job id
  // nothing ever minted; the record rides a GHOST connection id, so the
  // stop MISSES (the t623-W3 door) and the consult reaches the journal
  // through the t325-a host-matched fallback.
  craftAccounting(GHOST_SLURM, "COMPLETED", 0, 0);
  plant(jobIds.w3, GHOST_A, GHOST_SLURM, "/projects/cryoflow/t625/wd3", `${ROOT}/data/relion/t625-backfill/wd3`);
  await setRunning(jobIds.w3);
  const r3 = await stopJob(jobIds.w3);
  must(r3.status === 200 && r3.body?.outcome === "missed", `the receipt says missed (${r3.body?.outcome})`);
  must(
    String(r3.body?.message ?? "").includes("the connection for this run was deleted"),
    "the message names the phantom connection (W3)"
  );
  const row3pre = await pollUntil(async () => {
    const r = await jobRow(jobIds.w3);
    // the tick's fast path may finalize the record before the route's flip
    // (the row jumps straight to completed) — both are honest intermediates
    return r && (r.status === "failed" || r.status === "completed") ? r : null;
  }, 8_000, 500);
  must(!!row3pre, "the row left running (missed sentence or tick fast-path, W3 pre)");
  const rec3a = stateRuns()[jobIds.w3];
  must(
    rec3a?.done === true && rec3a?.remote?.accountingPending?.missed === true,
    "the open question is aboard and knows it was a miss (W3)"
  );
  const row3 = await pollUntil(async () => {
    await drive();
    const r = await jobRow(jobIds.w3);
    return r && r.status === "completed" ? r : null;
  }, 75_000, 2_000);
  must(!!row3, "the consult landed through the host-matched fallback — the row healed completed (W3)");
  must(
    !!row3 &&
      (String(row3.result ?? "").includes("the stop had found nothing to kill because the run had already finished") ||
        String(row3.result ?? "").includes("exited 0")),
    "the row speaks the miss-dialect landing (or the tick's equivalent receipt, W3)"
  );
  const rec3 = await pollUntil(() => {
    void drive();
    const r = stateRuns()[jobIds.w3];
    return r?.exitCode === 0 && !r?.remote?.accountingPending ? r : null;
  }, 30_000, 2_000);
  must(
    !!rec3 && rec3.exitCode === 0 && !rec3.remote?.accountingPending,
    "the record landed exit 0, question closed (W3)"
  );

  // ---- W4: the SILENCE EXPIRY — the stamp stands for good ------------------
  console.log("== W4: silence past the patience window — the question expires ==");
  plant(jobIds.w4, GHOST_B, GHOST_SLURM_B, "/projects/cryoflow/t625/wd4", `${ROOT}/data/relion/t625-backfill/wd4`);
  await setRunning(jobIds.w4);
  const r4 = await stopJob(jobIds.w4);
  must(r4.status === 200 && r4.body?.outcome === "missed", `the receipt says missed (${r4.body?.outcome})`);
  const rec4pre = await pollUntil(() => {
    const r = stateRuns()[jobIds.w4];
    return r?.done && r?.remote?.accountingPending ? r : null;
  }, 8_000, 500);
  must(!!rec4pre, "the open question is aboard (W4 pre)");
  // craft the question ELEVEN minutes old (the patience window is ten)
  patchRecord(jobIds.w4, {
    remote: { ...rec4pre.remote, accountingPending: { at: Date.now() - 11 * 60_000, missed: true } },
  });
  const rec4 = await pollUntil(() => {
    void drive();
    const r = stateRuns()[jobIds.w4];
    return r?.done && r?.remote && !r.remote.accountingPending ? r : null;
  }, 75_000, 2_000);
  must(!!rec4, "the question expired unheard (the flag cleared, W4)");
  must(
    !!rec4 &&
      (rec4.exitCode === undefined || String(rec4.result ?? "").includes("REMOTE[")),
    "the receipt's missed words (or the tick's receipt) stand — the expiry claimed nothing (W4)"
  );
  const row4 = await jobRow(jobIds.w4);
  must(
    !!row4 && row4.status === "failed" &&
      // the route's paren sentence, the record's dash sentence (the tick's
      // orphan heal may win the 800ms window), or the tick's REMOTE receipt
      (String(row4.result ?? "").includes("the cluster ledger decides the final state") ||
        String(row4.result ?? "").includes("REMOTE[")),
    "the row's missed words (any honest writer's dialect) stand untouched (W4)"
  );

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
  // the active pointer back to its pre-fixture owner BEFORE the fixture
  // project dies (its deletion would hand the pointer to "the first
  // project" — the exact drift this window's QA walked back)
  if (prevActiveId && prevActiveId !== projId) {
    try { await api("POST", "/api/projects/switch", { id: prevActiveId }); } catch { /* best effort */ }
  }
  for (const id of Object.values(jobIds).reverse()) {
    try { await api("DELETE", `/api/jobs/${id}`); } catch { /* best effort */ }
  }
  try { await api("DELETE", `/api/projects/${projId}`); } catch { /* best effort */ }
  try { await api("DELETE", `/api/remote/connections/${CONN}`); } catch { /* best effort */ }
  // mock side: my job files, the sbatch artifacts, the accounting, the dirs
  try {
    const parts = ["rm -rf /projects/cryoflow/t625"];
    for (const id of sbatchIds)
      parts.push(`rm -f "$HOME/.slurm/job-${id}."* "$HOME/.slurm/.launch-${id}.sh"`);
    parts.push(`rm -f "$HOME/.slurm/job-${GHOST_SLURM}."* "$HOME/.slurm/job-${GHOST_SLURM_B}."*`);
    if (accPre === "YES") {
      parts.push('mv "$HOME/.slurm/accounting.t625snap" "$HOME/.slurm/accounting" 2>/dev/null || true');
    } else {
      parts.push('rm -f "$HOME/.slurm/accounting"');
    }
    parts.push('rm -f "$HOME/.slurm/accounting.t625snap"');
    client(parts.join("; "));
  } catch { /* best effort */ }
  try { rmSync(`${ROOT}/data/relion/t625-backfill`, { recursive: true, force: true }); } catch { /* gone */ }
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

console.log(fail === 0 ? "\nt625: ALL PASS" : `\nt625: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;

function execSyncSafe(cmd) {
  try { execFileSync("bash", ["-c", cmd], { cwd: ROOT, stdio: "pipe", timeout: 30_000 }); } catch { /* noop */ }
}

// t263-remote-hardening.mjs — the three t262 audit findings get their witness.
//
// Task 262 ran the remote ENGINE end-to-end and surfaced three hardening
// candidates; the hardening code itself landed with the t262 tree (the
// "hardened t263" comments in remote-run.ts). This suite proves the three
// mechanisms actually work — the ledger pins the sources, the live phases
// exercise every heal path:
//   ① staging void-spawn silent stall → a 10s heartbeat touches
//      remote.stagingBeat; the sweep fails a stale beat (>2min, or no beat
//      + >30min) honestly and finalizes the record.
//   ② finalize row-flip lost to SQLITE_BUSY → updateJobWithRetry (3
//      attempts + backoff) and an orphan sweep that heals "record done /
//      row non-terminal" from the record truth — with a status guard so a
//      fresh re-run is never reverted.
//   ③ ghost remote dispatch → the liveness pre-check polls the record's
//      OWN connection, re-verifies at the last serial point (startedAt
//      marker), and the deleted-connection sweep path fails running rows
//      honestly instead of dispatching children to a stale target.
// Phases:
//   A  demo truth — homepage 200, roster 21, mock cluster answering, stubs
//   B  the ledger — the three mechanisms pinned in source
//   C  the live loop — real dispatch (the hardened path carries a full
//      run), the ghost busy door (409 live), the deleted-connection heal,
//      and four crafted-ledger sweeps (stale staging, orphan done, orphan
//      failed, terminal-row guard)
//   D  console clean

import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t263-mics";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const DB_FILE = "/home/z/my-project/db/custom.db";

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
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

async function pollUntil(fn, deadlineMs, intervalMs = 1200) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(MOCK_PORT, "127.0.0.1");
  });
}

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};

/** Craft one run record into the engine ledger (external writers bust the
 * mtime cache naturally — readRuns re-parses on the next poll). */
function craftRecord(jobId, rec) {
  const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  s[jobId] = rec; // the file's top level IS the runs map
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

/** Flip a job row straight in the DB (the restore-gallery precedent: PATCH
 * only allows idle; the sweep's heal inputs need running/pending rows).
 * Values travel as argv into parameterized SQL — no quoting nests. */
function flipRow(jobId, status, progress, result = null) {
  const out = execSync(
    `python3 scripts/t263-rowflip.py ${JSON.stringify(jobId)} ${JSON.stringify(status)} ${Number(progress)} ${JSON.stringify(result ?? "")}`,
    { cwd: "/home/z/my-project", stdio: "pipe" }
  ).toString().trim();
  if (out !== "1") console.log(`  (flipRow) WARNING: ${out} rows flipped for ${jobId}`);
}

async function deleteJob(id) {
  try {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
}

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// the mock cluster: reuse a running one, launch ours otherwise
let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  weLaunchedMock = true;
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const createdJobs = [];
const connIds = [];
let connId = null;
let weDeletedConn2 = false;

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);
  must(
    existsSync("/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_run_ctffind"),
    "the rig ships its stub relion binary (relion_run_ctffind)"
  );

  // ---- Phase B: the ledger (the three hardenings, pinned in source) -------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const rr = src("src/lib/remote/remote-run.ts");

  // ① the staging heartbeat
  must(
    rr.includes("function startStagingBeat(jobId: string)") &&
      rr.includes("setInterval") &&
      rr.includes("stagingBeat: Date.now()"),
    "① the staging task touches remote.stagingBeat while it is alive"
  );
  must(
    rr.includes("STAGING_BEAT_STALE_MS = 120_000") && rr.includes("ageMs > 30 * 60_000"),
    "① the sweep's two honest stale windows (beat >2min; no beat + >30min)"
  );
  must(
    rr.includes("staging to the cluster was interrupted") && rr.includes('note: "staging interrupted"'),
    "① a stale staging fails the row honestly AND finalizes the record"
  );
  must(
    rr.includes("const stopBeat = startStagingBeat(job.id)") && rr.includes("stopBeat()"),
    "① the beat is started with the task and stopped on both exits"
  );

  // ② the row-flip retry + the orphan sweep
  must(
    rr.includes("async function updateJobWithRetry") && rr.includes("attempts = 3") &&
      rr.includes("200 * i"),
    "② the finalize flip retries with backoff before giving up"
  );
  must(
    rr.includes("the orphan sweep will heal it"),
    "② a lost flip names its healer (the orphan sweep) in the log"
  );
  must(
    rr.includes("const orphans: Array<{ job: Job; rec: RunRecord }> = []") &&
      rr.includes('if (job.status === "running" || job.status === "pending") orphans.push({ job, rec });'),
    "② record-done/row-non-terminal is classified as an orphan"
  );
  must(
    rr.includes('status: { in: ["running", "pending"] }'),
    "② the heal flip is conditional — a fresh re-run is never reverted"
  );

  // ③ the ghost-dispatch door
  must(
    rr.includes("const prevStartedAt = prev?.startedAt ?? null") &&
      rr.includes("inFlight.startedAt !== prevStartedAt"),
    "③ the dispatch re-verifies at the last serial point (startedAt marker)"
  );
  must(
    rr.includes("prev.remote.connectionId === conn.id ? conn : getConnection(prev.remote.connectionId)"),
    "③ the liveness pre-check polls the record's OWN connection"
  );
  must(
    rr.includes('result: "the cluster connection for this run was deleted — re-add it and re-run"'),
    "③ the deleted-connection sweep fails running rows honestly"
  );
  must(
    rr.includes('busyKind: "live"'),
    "③ a live record answers busy with a kind the client can branch on"
  );
  const dispatch = src("src/lib/relion/dispatch.ts");
  must(
    dispatch.includes("triggerRec.remote") && dispatch.includes("remote pipeline stays remote"),
    "the auto-start passthrough is intact (the ghost door guards it, not removes it)"
  );

  // the rebuilt test route (Task 261's second finding — the file existed
  // only in a lost working tree; rebuilt this window to the same contract)
  const testRoute = src("src/app/api/remote/connections/[id]/test/route.ts");
  must(
    testRoute.includes("isLocalRequest(request)") && testRoute.includes("probeConnection(conn)"),
    "the test route: gated AND probing (the dialog's Test button is no longer a 404)"
  );
  must(
    testRoute.includes("patchConnection(id, { lastProbe: probe })"),
    "the test route persists lastProbe (the dialog's health dot has a memory)"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (real run → ghost door → deleted conn → crafted sweeps) ==");

  // C1 — six tiny but valid MRC micrographs + a REAL local import job
  mkdirSync(MICS_DIR, { recursive: true });
  const names = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  for (const n of names) {
    const W = 64, H = 64;
    const buf = Buffer.alloc(1024 + W * H * 4);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
    buf.writeInt32LE(2, 12); // mode 2 = float32
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
    for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
    writeFileSync(path.join(MICS_DIR, n), buf);
  }
  must(names.every((n) => existsSync(path.join(MICS_DIR, n))), "six mock micrographs fabricated (64x64 float32)");

  const mkJob = async (body) => {
    const r = await fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await r.json();
    if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
    return b.job;
  };
  const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
    const r = await fetch(`${BASE}/api/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    });
    return r.status;
  };
  const readJob = async (id) => {
    const d = await (await fetch(`${BASE}/api/jobs`)).json();
    return (d.jobs ?? []).find((x) => x.id === id) ?? null;
  };

  const importJob = await mkJob({
    type: "import",
    name: "t263 Import",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77 },
  });
  must(!!importJob?.id, "the import job exists");
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({}),
  });
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");
  must(
    (importDone?.result ?? "").includes("6 micrographs imported"),
    `the import counts its micrographs (${(importDone?.result ?? "").slice(0, 50)})`
  );

  // C2 — the connection + the REBUILT test route (the probe is live again)
  const mkConn = async (id, name) => {
    const r = await fetch(`${BASE}/api/remote/connections`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name,
        host: "127.0.0.1",
        port: 3022,
        username: "cryo",
        password: "demo",
        authMethod: "password",
        remoteRoot: "/projects/cryoflow",
      }),
    });
    connIds.push(id);
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  connId = `qa-t263-${Date.now().toString(36)}`;
  const mk = await mkConn(connId, "QA t263 Mock");
  must(mk.status === 201, `the connection is created (got ${mk.status})`);
  const test = await fetch(`${BASE}/api/remote/connections/${connId}/test`, {
    method: "POST",
    headers: SH,
  });
  const testBody = await test.json().catch(() => ({}));
  must(
    test.status === 200 && testBody?.ok === true,
    `the probe logs in and completes — the Test button is alive again (got ${test.status}, ok=${testBody?.ok})`
  );
  must(
    (testBody?.probe?.relionModules ?? []).includes("relion/5.0.1"),
    `the inventory finds relion/5.0.1 (${(testBody?.probe?.relionModules ?? []).join(", ")})`
  );
  must(
    typeof testBody?.probe?.moduleSystem === "string" && testBody.probe.moduleSystem !== "none",
    `the module system is identified (${testBody?.probe?.moduleSystem})`
  );
  const afterProbe = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
  const probedConn = (afterProbe.connections ?? []).find((c) => c.id === connId);
  must(
    probedConn?.lastProbe?.ok === true,
    "lastProbe persisted (the connection's health dot has a memory now)"
  );
  // gate + 404 route-speak, node-side (deliberate 404s never ride the page)
  const bare = await fetch(`${BASE}/api/remote/connections/${connId}/test`, { method: "POST" });
  must(bare.status === 403, `the probe route is gated (bare POST → ${bare.status})`);
  const missing = await fetch(`${BASE}/api/remote/connections/no-such-id/test`, {
    method: "POST",
    headers: SH,
  });
  must(missing.status === 404, `the probe route 404s honestly on an unknown id (got ${missing.status})`);

  // C3 — dispatch A through the API (the hardened startRemoteJob path)
  const jobA = await mkJob({ type: "ctffind", name: "t263 CtfFind A" });
  must(!!jobA?.id, "the ctffind job A created");
  const e1 = await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs");
  must(e1 === 200 || e1 === 201, `import → A wired (${e1})`);
  const dispatchA = await fetch(`${BASE}/api/jobs/${jobA.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchA.status === 200 || dispatchA.status === 201, `A dispatched to the cluster (${dispatchA.status})`);
  const firstA = await readJob(jobA.id);
  must(
    firstA && (firstA.status === "pending" || firstA.status === "running"),
    `A left idle immediately (first sight: ${firstA?.status})`
  );

  // C4 — the ghost busy door: a SECOND dispatch while A is live → 409 live
  const runningA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "running" ? j : null;
  }, 45_000, 800);
  must(!!runningA, "A reaches running on the cluster");
  const busyRes = await fetch(`${BASE}/api/jobs/${jobA.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  const busyBody = await busyRes.json().catch(() => ({}));
  must(busyRes.status === 409, `the second dispatch refuses at 409 (got ${busyRes.status})`);
  must(
    busyBody?.busyKind === "live",
    `the refusal names its kind (${busyBody?.busyKind ?? "none"})`
  );
  must(
    (busyBody?.error ?? busyBody?.busy ?? "").includes("remote run still active"),
    `the refusal says where the run lives (${String(busyBody?.error ?? busyBody?.busy ?? "").slice(0, 60)})`
  );
  // A still completes through the hardened finalize path (retry + sweep ride along)
  const completedA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" ? j : null;
  }, 75_000);
  must(!!completedA, "A completes end-to-end on the hardened path");
  const recA = stateRuns()[jobA.id];
  must(recA?.done === true && recA?.exitCode === 0, "A's record finalized (done, exit 0)");

  // C5 — the deleted-connection heal: B runs on conn2; conn2 is deleted
  // mid-flight; the sweep fails the row honestly and finalizes the record
  // (the ghost-dispatch inverse: no children ever dispatch to a stale target)
  const conn2 = `qa-t263-b-${Date.now().toString(36)}`;
  const mk2 = await mkConn(conn2, "QA t263 Mock B");
  must(mk2.status === 201, "the second connection is created");
  const jobB = await mkJob({ type: "ctffind", name: "t263 CtfFind B" });
  must(!!jobB?.id, "the ctffind job B created");
  const e2 = await mkEdge(importJob.id, jobB.id, "micrographs", "micrographs");
  must(e2 === 200 || e2 === 201, `import → B wired (${e2})`);
  const dispatchB = await fetch(`${BASE}/api/jobs/${jobB.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: conn2, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchB.status === 200 || dispatchB.status === 201, `B dispatched to conn2 (${dispatchB.status})`);
  const runningB = await pollUntil(async () => {
    const j = await readJob(jobB.id);
    return j?.status === "running" ? j : null;
  }, 45_000, 800);
  must(!!runningB, "B reaches running on conn2");
  const del2 = await fetch(`${BASE}/api/remote/connections/${conn2}`, {
    method: "DELETE",
    headers: SH,
  });
  weDeletedConn2 = del2.status === 200 || del2.status === 404;
  must(weDeletedConn2, `conn2 deleted mid-flight (${del2.status})`);
  const failedB = await pollUntil(async () => {
    const j = await readJob(jobB.id);
    return j?.status === "failed" ? j : null;
  }, 20_000, 800);
  must(!!failedB, "the sweep fails B honestly after its connection vanished");
  must(
    (failedB?.result ?? "").includes("the cluster connection for this run was deleted"),
    `the row says why (${(failedB?.result ?? "").slice(0, 70)})`
  );
  const recB = stateRuns()[jobB.id];
  must(recB?.done === true && recB?.exitCode === -1, "B's record finalized (no ghost liveness)");

  // C6 — the crafted ledger sweeps (all ledger-side, no SSH): stale staging,
  // orphan done, orphan failed, and the terminal-row guard
  console.log("== PHASE C6: the crafted sweeps (ledger-side) ==");
  const craftBase = (job, over) => ({
    jobId: job.id,
    projectId: job.projectId ?? importJob.projectId,
    type: "ctffind",
    pid: null,
    cmd: "(t263 crafted)",
    workdir: `/home/z/my-project/data/relion/${importJob.projectId}/ctffind_${job.id.slice(-8)}`,
    logFile: `/home/z/my-project/data/relion/${importJob.projectId}/ctffind_${job.id.slice(-8)}/run.out`,
    errFile: `/home/z/my-project/data/relion/${importJob.projectId}/ctffind_${job.id.slice(-8)}/run.err`,
    startedAt: new Date(Date.now() - 210_000).toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
    remote: {
      connectionId: connId,
      connectionName: "QA t263 Mock",
      host: "127.0.0.1:3022",
      user: "cryo",
      module: "relion/5.0.1",
      mode: "direct",
      remoteRoot: "/projects/cryoflow",
      remoteWorkdir: `/projects/cryoflow/${importJob.projectId}/ctffind_${job.id.slice(-8)}`,
      pid: null,
      slurmId: null,
      phase: "staging",
      stagedBytes: 0,
      stagingBeat: Date.now() - 200_000,
      ...over.remote,
    },
    ...over.rest,
  });

  // ① stale staging: a pending row + a staging record whose heartbeat died
  const jobS = await mkJob({ type: "ctffind", name: "t263 Stale Staging" });
  craftRecord(jobS.id, craftBase(jobS, {}));
  flipRow(jobS.id, "pending", 0);
  // ② orphan done: a running row + a record that finalized exit 0
  const jobO1 = await mkJob({ type: "ctffind", name: "t263 Orphan Done" });
  craftRecord(
    jobO1.id,
    craftBase(jobO1, {
      rest: { done: true, exitCode: 0, result: "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: orphan healed by t263" },
      remote: { phase: "running" },
    })
  );
  flipRow(jobO1.id, "running", 30);
  // ③ orphan failed: a running row + a record that finalized exit 1
  const jobO2 = await mkJob({ type: "ctffind", name: "t263 Orphan Failed" });
  craftRecord(
    jobO2.id,
    craftBase(jobO2, {
      rest: { done: true, exitCode: 1, result: "remote run failed: the wrapper exited 1 (t263)" },
      remote: { phase: "running" },
    })
  );
  flipRow(jobO2.id, "running", 10);
  // ④ the guard: a TERMINAL row with a done record is nobody's orphan
  const jobG = await mkJob({ type: "ctffind", name: "t263 Terminal Guard" });
  craftRecord(
    jobG.id,
    craftBase(jobG, {
      rest: { done: true, exitCode: 0, result: "REMOTE[guard]: keep me" },
      remote: { phase: "running" },
    })
  );
  flipRow(jobG.id, "completed", 100, "REMOTE[guard]: keep me");

  must(!!(await pollUntil(async () => (await readJob(jobS.id))?.status === "failed" ? true : null, 15_000, 700)),
    "① the stale staging row failed from its dead heartbeat");
  const sRow = await readJob(jobS.id);
  must(
    (sRow?.result ?? "").includes("staging to the cluster was interrupted"),
    `① the row says why (${(sRow?.result ?? "").slice(0, 60)})`
  );
  const sRec = stateRuns()[jobS.id];
  must(
    sRec?.done === true && sRec?.exitCode === -1 && sRec?.remote?.note === "staging interrupted",
    "① the staging record finalized (no ghost staging liveness)"
  );

  const o1Row = await pollUntil(async () => {
    const j = await readJob(jobO1.id);
    return j?.status === "completed" ? j : null;
  }, 15_000, 700);
  must(!!o1Row, "② the orphan-done row healed to completed from the record truth");
  must(
    (o1Row?.result ?? "").includes("orphan healed by t263") && o1Row?.progress === 100,
    "② the heal keeps the record's REMOTE[] result and completes it"
  );

  const o2Row = await pollUntil(async () => {
    const j = await readJob(jobO2.id);
    return j?.status === "failed" ? j : null;
  }, 15_000, 700);
  must(
    !!o2Row && (o2Row?.result ?? "").includes("the wrapper exited 1"),
    "② the orphan-failed row healed to failed with its reason kept"
  );

  await sleep(4000); // let a sweep tick pass over the guard
  const gRow = await readJob(jobG.id);
  must(
    gRow?.status === "completed" && (gRow?.result ?? "").includes("keep me"),
    "② the terminal-row guard: a completed row with a done record is untouched"
  );

  // the sweep's own words in the server log (the heal is loud, not silent)
  // t291: prod-mode families tee stdout to server.log, dev-mode sessions
  // to dev.log — the assertion's truth is "the words are in the SERVER's
  // log", so read whichever file this session's server actually wrote.
  let sweepLogged = false;
  for (const logPath of ["/home/z/my-project/server.log", "/home/z/my-project/dev.log"]) {
    try {
      const log = readFileSync(logPath, "utf8");
      if (log.includes("healed orphan row") || log.includes("went stale")) {
        sweepLogged = true;
        break;
      }
    } catch { /* that log file doesn't exist in this mode */ }
  }
  must(sweepLogged, "the sweep logs its heals (loud self-healing, not silent mutation)");

  // ----定妆照: the crafted results in the canvas --------------------------
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await sleep(2500);
  await page.screenshot({ path: `${SHOTS}/t263-hardening-sweeps.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt263: ALL PASS" : `\nt263: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  // stop any still-running suite jobs (B's stub may outlive its row)
  try { execSync("pkill -f relion_run_ctffind", { stdio: "pipe" }); } catch { /* none */ }
  // delete the world (newest first)
  for (const id of [...createdJobs].reverse()) await deleteJob(id);
  for (const cid of [...connIds].reverse()) {
    try {
      await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH });
    } catch { /* best effort */ }
  }
  // local leftovers: mic source, import symlink, job workdirs
  try { rmSync(MICS_DIR, { recursive: true, force: true }); } catch { /* gone */ }
  try {
    const fs = await import("node:fs");
    const ids = createdJobs.map((id) => id.slice(-8));
    const projDir = "/home/z/my-project/data/relion";
    for (const proj of fs.readdirSync(projDir)) {
      const inner = path.join(projDir, proj);
      let entries = [];
      try { entries = fs.readdirSync(inner); } catch { continue; }
      for (const d of entries) {
        if (!ids.some((s) => d.endsWith(`_${s}`))) continue;
        try { rmSync(path.join(inner, d), { recursive: true, force: true }); } catch { /* best effort */ }
      }
      const link = path.join(inner, "micrographs");
      try {
        const st = fs.lstatSync(link);
        if (st.isSymbolicLink() && readlinkSync(link) === MICS_DIR) rmSync(link, { force: true });
      } catch { /* not a link */ }
    }
  } catch { /* best effort */ }
  // remote leftovers: the project mirror on the mock cluster
  try {
    execSync(
      `node services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/ctffind_* /projects/cryoflow/*/import_* /projects/cryoflow/*/micrographs'`,
      { cwd: "/home/z/my-project", stdio: "pipe", timeout: 30_000 }
    );
  } catch { /* best effort */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
  await sleep(1500);
  try {
    const after = await (await fetch(`${BASE}/api/jobs`)).json();
    const n = (after.jobs ?? []).length;
    must(n === 21, `roster restored to 21 (got ${n})`);
  } catch { /* server busy */ }
  await browser.close().catch(() => {});
}

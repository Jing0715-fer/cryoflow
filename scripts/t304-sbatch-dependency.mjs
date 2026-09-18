/**
 * t304 — the pipeline handoff, scheduler-side: sbatch --dependency=afterok.
 *
 * The story: a child dispatched while its upstream is STILL in flight on the
 * same cluster used to have two dishonest exits — either the dispatch was
 * refused outright ("Waiting for upstream…"), or (multi-provider graphs: an
 * older completed provider satisfies input resolution) the child RAN
 * IMMEDIATELY off the older output while the graph said it should wait. The
 * scheduler always knew how to order a pipeline; the product never asked.
 *
 * t304 closes it: when a job's direct parents include LIVE remote runs on
 * the SAME connection (unfinished record + slurmId), the submission carries
 *
 *   #SBATCH --dependency=afterok:<id>[:<id>…]
 *   #SBATCH --kill-on-invalid-dep=yes
 *
 * so the child sits PENDING — a word the sweep already speaks — until every
 * parent lands, and is cancelled the moment one fails. The record carries
 * slurmDependsOn, the strip says "waits on <ids>", the console log names the
 * chain. No live upstream → no directive, byte-identical submissions.
 *
 * The MOCK grew the same teeth (a real cluster's contract, held): its sbatch
 * parses the dependency directive, holds the launcher in PENDING (the state
 * file is not touched), polls sacct until every upstream journals COMPLETED,
 * and journals its own CANCELLED row the moment one fails (or 600s pass) —
 * the kill-on-invalid-dep contract, so a stranded PENDING child is never a
 * lie the sweep has to guess about.
 *
 * Phases:
 *   A   the demo truth (app alive, roster identity 21, mock listening)
 *   B   the ledger (source assertions on remote-run / types / strip / mock)
 *   C   the live loop (all through the REAL run route + REAL sweep):
 *       C1  dispatch under a live parent → the script carries the directive,
 *           the record names the chain, the mock HOLDS the job PENDING, the
 *           strip speaks "waits on"; the parent lands → the child releases
 *           → completes with the scheduler's own word and stopwatch
 *       C2  the parent FAILS → the mock journals CANCELLED for the child →
 *           the sweep maps 143 + the word (kill-on-invalid-dep, witnessed)
 *       C3  the control: no live upstream → no directive, runs immediately
 *   D   console clean + roster restored to 21
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import { chromium } from "playwright";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const SHOTS = `${ROOT}/shots-qa`;
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};
const SHJ = { ...SH, "Content-Type": "application/json" };
const CONN = "qa-t304-dep";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 1500) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000,
  }).stdout?.trim() ?? "";

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

try { execSync("pkill -f agent-browser"); } catch { /* none */ }
await sleep(500);

let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: ROOT, stdio: "pipe" });
  for (let i = 0; i < 40 && !(await mockListening()); i++) await sleep(500);
  weLaunchedMock = true;
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const createdJobs = [];
const sbatchIds = [];
let connOk = false;
let snap0 = null;
let accPre = "NO";
const getJobs = async () =>
  (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs ?? [];

const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  const b = await r.json();
  if (b.job?.id) createdJobs.push(b.job.id);
  return b.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await fetch(`${BASE}/api/edges`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
  });
  return r.status;
};
const flipRunning = (id) =>
  execSync(
    `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:process.argv[1]},data:{status:'running',progress:5,startedAt:new Date()}}).then(()=>p.\\$disconnect()).catch(e=>{console.error(e.message);process.exit(1);})" ${id}`,
    { cwd: ROOT, stdio: "pipe", timeout: 30_000 }
  );

/** bare sbatch on the mock (no .cf wrapper — the parent IS the scheduler's own) */
const bareSbatch = (name, body) => {
  client(
    `mkdir -p /projects/cryoflow/t304-dep && printf '${body}' > /projects/cryoflow/t304-dep/${name}.sh`
  );
  const sub = client(`sbatch /projects/cryoflow/t304-dep/${name}.sh`);
  const id = Number(/Submitted batch job (\d+)/.exec(sub)?.[1]);
  if (id) sbatchIds.push(id);
  return id;
};
const journalWord = (id) => {
  try {
    return client(`sacct -j ${id} -n -P -o State,ExitCode`).trim();
  } catch {
    return "";
  }
};
const waitJournal = async (id, want, deadlineMs = 30_000) =>
  pollUntil(() => (journalWord(id).startsWith(want) ? journalWord(id) : null), deadlineMs, 700);

/** plant a running slurm record pointing at a REAL mock sbatch job */
let wdSeq = 0;
const plant = (jobId, projectId, slurmId) => {
  const n = ++wdSeq;
  const remoteWd = `/projects/cryoflow/t304-dep/wd-${n}`;
  const localWd = `${ROOT}/data/relion/t304-dep/wd-${n}`;
  mkdirSync(localWd, { recursive: true });
  client(`mkdir -p ${remoteWd}`);
  const runs = { ...stateRuns() };
  runs[jobId] = {
    jobId, projectId, type: "motioncorr", pid: null,
    cmd: "t304: planted live parent (the dependency door must see it)",
    workdir: localWd, logFile: `${localWd}/run.out`, errFile: `${localWd}/run.err`,
    startedAt: new Date().toISOString(), done: false,
    remote: {
      connectionId: CONN, connectionName: "QA t304 Dep", host: "127.0.0.1:3022",
      user: "cryo", module: "", mode: "slurm", remoteRoot: "/projects/cryoflow",
      remoteWorkdir: remoteWd, pid: null, slurmId: String(slurmId), phase: "running",
    },
  };
  writeStateRuns(runs);
};

/** dispatch a job through the REAL run route (the door the UI uses) */
const dispatch = async (jobId, connId) => {
  const r = await fetch(`${BASE}/api/jobs/${jobId}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "slurm" } }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

try {
  // ---- Phase A: the demo truth ------------------------------------------------
  console.log("== PHASE A: the demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), "the mock cluster answers on :3022");

  snap0 = readFileSync(STATE_FILE, "utf8");
  try {
    accPre = client('test -f "$HOME/.slurm/accounting" && echo YES || echo NO').trim();
    if (accPre === "YES") client('cp "$HOME/.slurm/accounting" "$HOME/.slurm/accounting.t304snap"');
  } catch { accPre = "NO"; }

  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t304 Dep", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  connOk = mk.status === 201 || mk.status === 200;
  must(connOk, `the probeless connection exists (${mk.status})`);

  // ---- Phase B: the ledger ----------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  must(
    src.includes("`#SBATCH --dependency=${dependency}`") &&
      src.includes('"#SBATCH --kill-on-invalid-dep=yes"'),
    "B: the sbatch script grows the dependency directive + the kill-on-invalid contract"
  );
  must(
    src.includes("db.edge.findMany({ where: { toJobId: job.id }"),
    "B: the dispatch walks the graph's direct parents (db.edge)"
  );
  must(
    src.includes("pr?.remote && !pr.done && pr.remote.connectionId === conn.id &&") &&
      src.includes("pr.remote.slurmId != null"),
    "B: only a LIVE remote parent on the SAME connection contributes (done records and other clusters stay out)"
  );
  must(
    src.includes("`afterok:${depIds.join(\":\")}`"),
    "B: the chain is afterok-joined (the scheduler's own grammar)"
  );
  must(
    src.includes("slurmDependsOn: depIds"),
    "B: the record names the chain for the UI"
  );
  const tt = readFileSync(`${ROOT}/src/lib/remote/types.ts`, "utf8");
  must(
    (tt.match(/slurmDependsOn\?: string\[\]/g) ?? []).length === 2,
    "B: the DTO + the engine state carry slurmDependsOn (RemoteRunInfo + RemoteRunState)"
  );
  must(
    src.includes("slurmDependsOn: r.slurmDependsOn"),
    "B: the projection lets the chain ride to the client"
  );
  const insp = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  must(
    insp.includes("waits on ${job.runRemote.slurmDependsOn.join(\", \")}"),
    "B: the strip speaks the handoff ('waits on <ids>')"
  );
  const sb = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/sbatch`, "utf8");
  must(
    sb.includes("--dependency=afterok:") && sb.includes("__deps"),
    "B: the mock sbatch parses the dependency directive"
  );
  must(
    sb.includes('__failed" != "0"') && sb.includes('"CANCELLED"'),
    "B: a failed/capped wait journals its own CANCELLED row (kill-on-invalid-dep, not a stranded PENDING)"
  );
  must(
    sb.includes("__waited") && sb.includes("-ge 600"),
    "B: the wait is bounded (600s cap — the mock cannot leak a sleeping launcher)"
  );

  // ---- Phase C: the live loop -------------------------------------------------
  // the completed provider: a LOCAL import (native — writes micrographs.star
  // instantly) so the child's input resolution passes while the parent runs
  const micsDir = `${ROOT}/data/relion/t304-dep/mics`;
  mkdirSync(micsDir, { recursive: true });
  execSync(
    `node -e "const fs=require('fs');const b=Buffer.alloc(1024+64,0);b.write('mrc ',208);b.writeInt32LE(64,0);b.writeInt32LE(64,4);b.writeInt32LE(1,8);b.writeInt32LE(0,16);b.writeInt32LE(4,92);fs.writeFileSync('${micsDir}/mic-1.mrc',b)"`,
    { cwd: ROOT, stdio: "pipe" }
  );
  const a0 = await mkJob({ type: "import", name: "t304 Import A0", params: { micrographsPath: micsDir, pixelSize: 1.77 }, x: 80, y: 80 });
  const runA0 = await fetch(`${BASE}/api/jobs/${a0.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runA0.status === 200, `A0 imports locally (${runA0.status})`);
  const a0done = await pollUntil(async () => (await getJobs()).find((j) => j.id === a0.id)?.status, 30_000);
  must(a0done === "completed", `A0 completed — the provider A0 has real outputs (got ${a0done})`);

  // C1 — dispatch under a LIVE parent: held PENDING, then released
  console.log("== PHASE C1: held by the scheduler, released by the parent ==");
  const p1 = await mkJob({ type: "motioncorr", name: "t304 Parent P1", x: 340, y: 80 });
  const child1 = await mkJob({
    type: "ctffind", name: "t304 Child C1",
    params: { box: 128, resMin: 30, resMax: 5, voltage: 300, cs: 2.7, ampContrast: 0.1 },
    x: 600, y: 80,
  });
  // t304 FIX: the edge API validates ports against the WORKFLOW registry
  // (workflow.ts), whose port name is "micrographs" — the engine's
  // record-outputs key ("micrographs_star") is a DIFFERENT vocabulary. The
  // first draft asked for micrographs_star edges, got 400 Port mismatch, and
  // the old `!== 0` assertion waved it through (any status except literal 0
  // passes — a vacuous witness); every downstream phase then starved at
  // resolveInputs with "not-ready". Assertions now demand the real 201.
  must(await mkEdge(a0.id, child1.id, "micrographs", "micrographs") === 201, "C1: the provider edge (A0 → C1) stands (201)");
  must(await mkEdge(p1.id, child1.id, "micrographs", "micrographs") === 201, "C1: the parent edge (P1 → C1) stands (201)");
  const live1 = bareSbatch("p1", "#!/usr/bin/env bash\\nsleep 30\\n");
  must(Number.isFinite(live1) && live1 > 0, `C1: the live parent's sbatch job is on the scheduler (${live1})`);
  flipRunning(p1.id);
  plant(p1.id, p1.projectId, live1);

  const disp1 = await dispatch(child1.id, CONN);
  // t304 FIX: a REMOTE dispatch that goes to staging answers 200 +
  // waiting:"not-ready" (the client's "pending (staging)" toast) — that IS
  // the success shape. The refusal the suite originally feared lives in
  // body.error (resolveInputs' missing message), not in waiting.
  must(disp1.status === 200 && !disp1.body?.error,
    `C1: the child dispatched (status ${disp1.status}, err=${disp1.body?.error ?? "-"}, wait=${disp1.body?.waiting ?? "-"})`);
  const rec1 = await pollUntil(() => {
    const r = stateRuns()[child1.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  must(!!rec1, "C1: the child has a scheduler id (staging + submission went through)");
  const cSlurmId = rec1?.remote?.slurmId;
  must(
    JSON.stringify(rec1?.remote?.slurmDependsOn) === JSON.stringify([String(live1)]),
    `C1: the record names the chain (slurmDependsOn ${JSON.stringify(rec1?.remote?.slurmDependsOn)}, want ["${live1}"])`
  );
  const scriptTxt = client(`cat /projects/cryoflow/${child1.projectId}/ctffind_${child1.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);
  must(
    scriptTxt.includes(`#SBATCH --dependency=afterok:${live1}`) &&
      scriptTxt.includes("#SBATCH --kill-on-invalid-dep=yes"),
    "C1: the submitted script carries the directive + the kill-on-invalid contract"
  );
  const heldState = client(`squeue -j ${cSlurmId} -h -o %T`);
  must(heldState === "PENDING", `C1: the mock HOLDS the child (squeue says ${heldState}) — the scheduler's ordering is real`);
  const stripShot = await pollUntil(async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    const card = page.locator("[data-job]", { hasText: "t304 Child C1" }).locator('[role="button"]').first();
    try { await card.click({ timeout: 6000, force: true }); } catch { return null; }
    await sleep(1200);
    const body = await page.locator("body").innerText();
    // t304 FIX — the strip renders the GPU width between the id and the
    // state word ('Slurm job 61 · 6 GPU(s) · queued · waits on 60' — the
    // ctffind child requests 6 GPUs and the strip speaks them); the first
    // draft's regex assumed the id was followed by the state directly and
    // never matched a green strip.
    return /Slurm job \d+(?: · \d+ GPU\(s\))? · queued · waits on \d+/.test(body) ? body : null;
  }, 45_000, 2500);
  must(!!stripShot, "C1: the strip speaks the handoff ('· queued · waits on <id>')");
  if (!stripShot) {
    // diagnostic: what did the page ACTUALLY say at the last attempt?
    try { await page.goto(BASE, { waitUntil: "domcontentloaded" }); await sleep(2000); } catch { /* dead */ }
    try {
      const card = page.locator("[data-job]", { hasText: "t304 Child C1" }).locator('[role="button"]').first();
      await card.click({ timeout: 6000, force: true });
      await sleep(1500);
      const body = await page.locator("body").innerText();
      writeFileSync("/tmp/t304-strip-debug.txt", body.slice(0, 4000));
      console.log("  (strip debug: /tmp/t304-strip-debug.txt)");
    } catch { /* best effort */ }
  }
  await page.screenshot({ path: `${SHOTS}/t304-dependency-held.png` }).catch(() => {});

  const parentLanded = await waitJournal(live1, "COMPLETED", 30_000);
  must(parentLanded.startsWith("COMPLETED"), `C1: the parent landed (${parentLanded})`);
  // t304 FIX — pollUntil resolves on the FIRST TRUTHY value, and a job's
  // status is ALWAYS truthy ("pending"/"running"): the raw status poll used
  // to return on tick zero, so every terminal-state assertion read the
  // dispatch-time status and "failed" while the machinery was actually
  // working (the mock's CANCELLED row landed, the sweep finalized after the
  // suite had already given up). Status polls must WAIT FOR THE TARGET.
  const done1 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === child1.id)?.status;
    return s === "completed" ? s : null;
  }, 90_000);
  must(done1 === "completed", `C1: the child RELEASED and completed (got ${done1 ?? "still queued/running"})`);
  const rec1b = stateRuns()[child1.id];
  // t304 FIX — the verdict contract, stated honestly: the SCHEDULER's word
  // lives in the accounting ledger (waitJournal below); the RECORD carries
  // done + exit 0 + the stopwatch. The record's slurmState word stays the
  // last ALIVE state (RUNNING) when the wrapper's .cf-exit wins the race —
  // t303's own law: on the EXIT path the word is not overwritten (first-
  // served wins), only the fallback path promotes the word. Demanding
  // COMPLETED on the record was over-asserting past the product's contract.
  const childWord = await waitJournal(cSlurmId, "COMPLETED", 30_000);
  must(childWord.startsWith("COMPLETED"), `C1: the scheduler's own word for the child is COMPLETED (${childWord})`);
  must(
    rec1b?.done === true && rec1b?.exitCode === 0 &&
      typeof rec1b?.remote?.slurmElapsedMs === "number" && rec1b.remote.slurmElapsedMs >= 0,
    `C1: the record finalized with the stopwatch (done ${rec1b?.done}, exit ${rec1b?.exitCode}, elapsed ${rec1b?.remote?.slurmElapsedMs}ms)`
  );

  // C2 — the parent FAILS: the child is cancelled, not stranded
  console.log("== PHASE C2: kill-on-invalid-dep, witnessed ==");
  const p2 = await mkJob({ type: "motioncorr", name: "t304 Parent P2", x: 340, y: 300 });
  const child2 = await mkJob({
    type: "ctffind", name: "t304 Child C2",
    params: { box: 128, resMin: 30, resMax: 5, voltage: 300, cs: 2.7, ampContrast: 0.1 },
    x: 600, y: 300,
  });
  must(await mkEdge(a0.id, child2.id, "micrographs", "micrographs") === 201, "C2: the provider edge (A0 → C2) stands (201)");
  must(await mkEdge(p2.id, child2.id, "micrographs", "micrographs") === 201, "C2: the parent edge (P2 → C2) stands (201)");
  const failing = bareSbatch("p2", "#!/usr/bin/env bash\\nsleep 3\\nexit 3\\n");
  must(Number.isFinite(failing) && failing > 0, `C2: the failing parent's sbatch job (${failing})`);
  flipRunning(p2.id);
  plant(p2.id, p2.projectId, failing);
  const disp2 = await dispatch(child2.id, CONN);
  must(disp2.status === 200 && !disp2.body?.error, `C2: the child dispatched (${disp2.status})`);
  const done2 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === child2.id)?.status;
    return s === "failed" ? s : null;
  }, 120_000);
  must(done2 === "failed", `C2: the child failed honestly (got ${done2 ?? "still queued"})`);
  const rec2 = stateRuns()[child2.id];
  must(rec2?.exitCode === 143, `C2: CANCELLED maps to the stop contract 143 (got ${rec2?.exitCode})`);
  must(rec2?.remote?.slurmState === "CANCELLED", "C2: the word CANCELLED is on the record");
  must(!/interrupted remotely/.test(rec2?.result ?? ""), "C2: no false interrupted-remotely tombstone");

  // C3 — the control: no live upstream → byte-identical submission path
  console.log("== PHASE C3: the control — no live upstream, no directive ==");
  const child3 = await mkJob({
    type: "ctffind", name: "t304 Child C3",
    params: { box: 128, resMin: 30, resMax: 5, voltage: 300, cs: 2.7, ampContrast: 0.1 },
    x: 600, y: 520,
  });
  must(await mkEdge(a0.id, child3.id, "micrographs", "micrographs") === 201, "C3: the provider edge (A0 → C3) stands (201)");
  const disp3 = await dispatch(child3.id, CONN);
  must(disp3.status === 200 && !disp3.body?.error, `C3: the child dispatched (${disp3.status})`);
  const rec3 = await pollUntil(() => {
    const r = stateRuns()[child3.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  must(!!rec3 && rec3.remote.slurmDependsOn === undefined,
    `C3: no live upstream → no chain on the record (${JSON.stringify(rec3?.remote?.slurmDependsOn)})`);
  const script3 = client(`cat /projects/cryoflow/${child3.projectId}/ctffind_${child3.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);
  must(
    !script3.includes("--dependency=") && !script3.includes("kill-on-invalid-dep"),
    "C3: no directive in the script either (the submission path is unchanged when nothing waits)"
  );
  // 180s: the mock's ctffind end to end (staging → queue → run → sync-back)
  // measured ~123s in t262's engine e2e — 60s was a deadline the control
  // could honestly miss while still running.
  const done3 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === child3.id)?.status;
    return s === "completed" ? s : null;
  }, 180_000);
  must(done3 === "completed", `C3: the control completed (got ${done3 ?? "still running"})`);

  // ---- Phase D: console + roster ----------------------------------------------
  console.log("== PHASE D: console + roster ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt304: ALL PASS" : `\nt304: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  try {
    if (snap0 != null) writeStateRuns(JSON.parse(snap0).runs ?? JSON.parse(snap0));
  } catch { /* best effort */ }
  for (const id of [...createdJobs].reverse()) {
    try {
      await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
    } catch { /* best effort */ }
  }
  try {
    await fetch(`${BASE}/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
  try {
    const parts = ["rm -rf /projects/cryoflow/t304-dep"];
    for (const id of sbatchIds) {
      parts.push(`rm -f "$HOME/.slurm/job-${id}."* "$HOME/.slurm/.launch-${id}.sh"`);
    }
    parts.push('rm -f "$HOME/.slurm/"job-*.cancelled');
    if (accPre === "YES") {
      parts.push('mv "$HOME/.slurm/accounting.t304snap" "$HOME/.slurm/accounting" 2>/dev/null || true');
    } else {
      parts.push('rm -f "$HOME/.slurm/accounting"');
    }
    parts.push('rm -f "$HOME/.slurm/accounting.t304snap"');
    client(parts.join("; "));
  } catch { /* best effort */ }
  try { rmSync(`${ROOT}/data/relion/t304-dep`, { recursive: true, force: true }); } catch { /* gone */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
  await sleep(1200);
  try {
    const n = (await getJobs()).length;
    must(n === 21, `roster restored to 21 (got ${n})`);
  } catch { /* server busy */ }
  await browser.close().catch(() => {});
}

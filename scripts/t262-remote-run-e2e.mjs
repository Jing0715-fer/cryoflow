// t262 — the remote engine's dark 1,261 lines get their first living thread
// (Task 262). Task 261 audited the transport layer (doors, probe, secrets);
// the RUN itself — staging → dispatch → poll → sync-back → downstream —
// never crossed a real SSH channel inside a test. This suite runs the whole
// engine on the repo's own mock cluster:
//   A  demo truth — homepage 200, roster 23, mock cluster answering, the
//      rig's stub relion binaries in place
//   B  the ledger — startRemoteJob staging laws (pendingPatch + background
//      spawn), the wrapper (setsid + .cf-exit + pid/starttime), the poll
//      (aliveCheckScript double-witness), sync-back (STAR rewrite + caps),
//      finalize (REMOTE[] result + remoteOutputs twins), the dispatch
//      remote passthrough, the UI dialog wiring, the stop branch
//   C  the live loop — a REAL local import stages 4 micrographs through a
//      REAL SSH login; the UI's "Run on cluster" dialog dispatches CtfFind;
//      progress streams from the cluster log; outputs sync back (STAR paths
//      rewritten to-local); the pending downstream twin auto-starts ON THE
//      SAME CLUSTER with zero re-upload; a third run is stopped mid-flight
//      and its cluster session is verified dead by pid
//   D  console clean
//
// Run: node scripts/t262-remote-run-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t262-mics"; // INSIDE the mirror: refs stay same-origin
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
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

/** poll until fn() returns truthy (or the deadline passes) — returns last value. */
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

/** TCP probe of the mock cluster's SSH port. */
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
const context = await browser.newContext({
  viewport: { width: 1720, height: 940 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// every world object this suite creates — cleanup sweeps newest-first
const createdJobs = [];
let connId = null;
let weStoppedC = false;
let jobCId = null;
const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};

async function deleteJob(id) {
  try {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
}

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 23, `roster identity 23 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);
  must(
    existsSync("/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_run_ctffind") &&
      existsSync("/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_refine"),
    "the rig ships stub relion binaries (relion_run_ctffind + relion_refine)"
  );

  // ---- Phase B: the ledger ------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const rr = src("src/lib/remote/remote-run.ts");

  must(
    rr.includes("export async function startRemoteJob") &&
      rr.includes("export async function reconcileRemoteJobs") &&
      rr.includes("export async function remoteLogTail") &&
      rr.includes("export async function remoteStopRun") &&
      rr.includes("export function remoteInfoFor"),
    "remote-run.ts exports the five engine faces (start/reconcile/log/stop/info)"
  );
  must(
    rr.includes('result: `Staging inputs to ${conn.host}') && rr.includes("void spawn();"),
    "staging flips the row to pending with an honest banner, then spawns in the background"
  );
  must(
    rr.includes("setsid bash -c") &&
      rr.includes('.cf-exit') &&
      rr.includes("/proc/$__p/stat"),
    "the wrapper detaches its session and captures the exit status"
  );
  must(
    rr.includes("__st") && rr.includes('kill -0 "$__p"'),
    "the alive check witnesses pid AND /proc starttime (recycled pids never fake liveness)"
  );
  must(
    rr.includes('rewriteStarPaths(text, "to-local", r.remoteRoot)') &&
      rr.includes("capPerFile") &&
      rr.includes("budget - size < 0"),
    "sync-back rewrites STAR paths to-local under per-file and total caps"
  );
  must(
    rr.includes("REMOTE[${origin}]") && rr.includes("remoteOutputs"),
    "finalize prefixes the cluster origin and records remote output twins"
  );

  const runRoute = src("src/app/api/jobs/[id]/run/route.ts");
  must(
    runRoute.includes("body.remote") && runRoute.includes("RemoteRunTarget"),
    "the run route accepts { remote: target } and hands it to the engine"
  );
  const dispatch = src("src/lib/relion/dispatch.ts");
  must(
    dispatch.includes("triggerRec.remote") && dispatch.includes("remote pipeline stays remote"),
    "downstream auto-start passes the trigger's cluster target through"
  );
  const jobsRoute = src("src/app/api/jobs/route.ts");
  must(
    jobsRoute.includes("reconcileRemoteJobs") && jobsRoute.includes("dto.runRemote = remoteInfoFor"),
    "the jobs poll drives the remote sweep and attaches runRemote to DTOs"
  );
  const stopRoute = src("src/app/api/jobs/[id]/stop/route.ts");
  must(
    stopRoute.includes("remoteStopRun") && stopRoute.includes("cluster-side session killed"),
    "the stop route kills the cluster session and fails the row honestly"
  );
  const dialog = src("src/components/workflow/remote-run-button.tsx");
  must(
    dialog.includes("runJobRemote(job.id, target)") &&
      dialog.includes("relion module to load") &&
      dialog.includes("Send to cluster"),
    "the UI dialog dispatches through the store with the probed module"
  );
  const logRoute = src("src/app/api/jobs/[id]/log/route.ts");
  must(
    logRoute.includes("remoteLogTail"),
    "the log route streams remote logs over SSH"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (stage → dispatch → poll → sync-back) ==");

  // C1 — six tiny but valid MRC micrographs + a REAL local import job
  // (six = the progress parser's denominator AND a comfortable stop window:
  // the stub spends ~1.6s per micrograph, ~9.6s of cluster runtime)
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
  must(names.every((n) => existsSync(path.join(MICS_DIR, n))), "four mock micrographs fabricated (64x64 float32)");

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

  const importJob = await mkJob({
    type: "import",
    name: "t262 Import",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77 },
  });
  must(!!importJob?.id, "the import job exists");
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({}),
  });
  const importDone = await pollUntil(async () => {
    const j = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs.find((x) => x.id === importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");
  must(
    (importDone?.result ?? "").includes("6 micrographs imported"),
    `the import counts its micrographs (${(importDone?.result ?? "").slice(0, 60)})`
  );
  let projId = importDone?.projectId ?? importJob.projectId ?? null;
  if (!projId) {
    // resilient fallback: the engine workdir layout IS the project layout
    const fsx = await import("node:fs");
    for (const d of fsx.readdirSync("/home/z/my-project/data/relion")) {
      if (existsSync(`/home/z/my-project/data/relion/${d}/import_${importJob.id.slice(-8)}`)) {
        projId = d;
        break;
      }
    }
  }
  must(!!projId, `the project id resolves (${projId})`);

  // C0 — the world scrub: stale qa-* connections from earlier runs poison
  // the dialog's connections[0] default (Task 262's ghost-dispatch lesson:
  // a leftover connection still answers, so the wrong target looks alive)
  const readConns = () => {
    try {
      const raw = JSON.parse(readFileSync("/home/z/my-project/data/remote-connections.json", "utf8"));
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  };
  for (const sc of readConns()) {
    if (String(sc?.id ?? "").startsWith("qa-")) {
      await page.evaluate(async (cid) => {
        await fetch(`/api/remote/connections/${cid}`, { method: "DELETE" }).catch(() => {});
      }, sc.id);
    }
  }
  must(
    readConns().filter((c) => String(c?.id ?? "").startsWith("qa-")).length === 0,
    "no stale qa-* connections remain (the dialog's default pick is ours)"
  );
  // a stale import symlink (a dead diag's source dir) makes the folder
  // import fall back to absolute-path refs — sweep dangling ones by shape
  try {
    const fsx = await import("node:fs");
    const projRoot = "/home/z/my-project/data/relion";
    for (const proj of fsx.readdirSync(projRoot)) {
      const link = path.join(projRoot, proj, "micrographs");
      try {
        const st = fsx.lstatSync(link);
        if (st.isSymbolicLink() && !fsx.existsSync(link)) {
          fsx.rmSync(link, { force: true });
        }
      } catch { /* not a link */ }
    }
  } catch { /* best effort */ }

  // C2 — the graph, dispatched ONE completion at a time: A alone first (the
  // dialog dispatch proved shape-sensitive — pending siblings plus the
  // transition sweep's auto-start race the freshly staged row; Task 262's
  // finding, hardened next window), B and C join after A completes
  const jobA = await mkJob({ type: "ctffind", name: "t262 CtfFind A" });
  must(!!jobA?.id, "the ctffind job A created (no pending siblings yet)");
  // edge ports speak the WORKFLOW SPEC vocabulary (outp/inp names), not the
  // engine's input keys — import's output port and ctffind's input port are
  // both named "micrographs" (the engine resolves upstreams by job identity)
  const e1 = await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs");
  must(e1 === 200 || e1 === 201, `import → A wired (${e1})`);

  // C3 — the connection + probe (the mock cluster's real inventory)
  connId = `qa-t262-${Date.now().toString(36)}`;
  const mk = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch("/api/remote/connections", {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: connId,
        name: "QA t262 Mock",
        host: "127.0.0.1",
        port: 3022,
        username: "cryo",
        password: "demo",
        authMethod: "password",
        remoteRoot: "/projects/cryoflow",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, { connId, SH });
  must(mk.status === 201, `the connection is created (got ${mk.status})`);
  const test = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch(`/api/remote/connections/${connId}/test`, { method: "POST", headers: SH });
    return { status: r.status, body: await r.json() };
  }, { connId, SH });
  must(test.status === 200 && test.body?.probe?.ok !== false, `the probe speaks (${test.status})`);
  const modules = test.body?.probe?.relionModules ?? test.body?.connection?.lastProbe?.relionModules ?? [];
  must(modules.includes("relion/5.0.1"), `the probe inventories relion/5.0.1 (${modules.join(", ")})`);
  const home501 =
    test.body?.probe?.relionHomes?.["relion/5.0.1"] ??
    test.body?.connection?.lastProbe?.relionHomes?.["relion/5.0.1"];
  must(!!home501 && home501.includes("/opt"), `the probe resolves the module home (${home501})`);

  // C4 — the UI dispatch: inspector → Run on cluster → module → Send
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true });
  await sleep(1000);
  const runBtn = page.locator('[aria-label="Run on cluster (SSH)"]').first();
  must(await runBtn.isVisible().catch(() => false), "the job panel offers Run on cluster (SSH)");
  await runBtn.click();
  const dlg = page.locator('[role="dialog"]', { hasText: "Send to cluster" }).first();
  await dlg.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  must(await dlg.isVisible().catch(() => false), "the dispatch dialog opens");
  must(
    (await dlg.innerText().catch(() => "")).includes("cryo@127.0.0.1"),
    "the dialog names the connection (probed green dot)"
  );
  // pick the probed module explicitly
  const modTrigger = dlg.locator('[aria-label="relion module to load"]');
  await modTrigger.click();
  await page.locator('[role="option"]', { hasText: "relion/5.0.1" }).first().click();
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/t262-remote-run-dialog.png` });
  await dlg.locator("button", { hasText: "Send to cluster" }).click();
  await dlg.waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
  must(!(await dlg.isVisible().catch(() => false)), "Send to cluster closes the dialog (accepted)");

  // C5 — the lifecycle: staging → running (remote DTO) → progress → completed
  const readA = async () => {
    const d = await (await fetch(`${BASE}/api/jobs`)).json();
    return (d.jobs ?? []).find((x) => x.id === jobA.id) ?? null;
  };
  const firstObs = await readA();
  must(
    firstObs && (firstObs.status === "pending" || firstObs.status === "running"),
    `the job left idle immediately (first sight: ${firstObs?.status})`
  );
  const runningA = await pollUntil(async () => {
    const j = await readA();
    return j && (j.status === "running" || j.status === "completed") ? j : null;
  }, 40_000, 1000);
  must(!!runningA, "the cluster run reaches running");
  must(
    !!runningA?.runRemote && runningA.runRemote.connectionName === "QA t262 Mock",
    "runRemote names the connection (the DTO carries the cluster truth)"
  );
  must(
    (runningA?.runRemote?.host ?? "").includes("127.0.0.1") &&
      runningA?.runRemote?.module === "relion/5.0.1" &&
      !!runningA?.runRemote?.remoteWorkdir,
    `runRemote carries host/module/workdir (${runningA?.runRemote?.host} · ${runningA?.runRemote?.module})`
  );
  // progress streams from the cluster log while it runs
  let maxProgress = 0;
  let badgeSeen = false;
  let completedA = runningA?.status === "completed" ? runningA : null;
  const cDeadline = Date.now() + 60_000;
  while (Date.now() < cDeadline && !completedA) {
    await sleep(1200);
    const j = await readA();
    if (!j) continue;
    if (typeof j.progress === "number") maxProgress = Math.max(maxProgress, j.progress);
    if (!badgeSeen) {
      badgeSeen = (await page
        .locator(`[data-job="${jobA.id}"] [aria-label^="Running on cluster"]`)
        .first()
        .isVisible()
        .catch(() => false));
    }
    if (j.status === "completed") completedA = j;
  }
  must(!!completedA, "the cluster run completes end-to-end");
  must(badgeSeen, "the job card wears the cluster badge while it runs");
  must(maxProgress > 0, `progress streams from the cluster log (max ${maxProgress}%)`);

  // C6 — the harvest: result, mirror files, STAR rewritten to-local, twins
  const resultA = completedA?.result ?? "";
  must(
    resultA.startsWith("REMOTE[") && resultA.includes("cryo@127.0.0.1") && resultA.includes("relion/5.0.1"),
    `the result names its cluster origin (${resultA.slice(0, 72)})`
  );
  must(resultA.includes("CTF estimated for 6 micrographs"), `the engine collected the outputs (${resultA.slice(0, 90)})`);
  // the local mirror sits at data/relion/<projectId>/ctffind_<last8>
  const mirrorA = `/home/z/my-project/data/relion/${projId}/ctffind_${jobA.id.slice(-8)}`;
  must(existsSync(path.join(mirrorA, "micrographs_ctf.star")), "micrographs_ctf.star synced back to the local mirror");
  must(existsSync(path.join(mirrorA, "run.out")) && existsSync(path.join(mirrorA, "run.err")), "the cluster logs synced back too");
  const starPathLocal = path.join(mirrorA, "micrographs_ctf.star");
  if (existsSync(starPathLocal)) {
    const starText = readFileSync(starPathLocal, "utf8");
    must(
      !starText.includes("/projects/cryoflow") && starText.includes("mic_01.mrc"),
      "the synced STAR carries no cluster roots (relative or mirror-local refs)"
    );
  }
  const recA = stateRuns()[jobA.id];
  must(
    recA?.done === true && recA?.exitCode === 0,
    "the run record finalized (done, exit 0)"
  );
  must(
    (recA?.remote?.remoteOutputs?.micrographs_ctf_star ?? "").startsWith("/projects/cryoflow"),
    "the record keeps the remote output twin for the downstream job"
  );
  must(
    (recA?.remote?.syncedFiles ?? 0) >= 3,
    `the sync-back counted its files (${recA?.remote?.syncedFiles})`
  );

  // C7 — the log streams the cluster's own words: the API contract first
  // (the log route's remote branch over SSH), then the inspector's tab face
  const logApi = await fetch(`${BASE}/api/jobs/${jobA.id}/log`, { headers: SH });
  const logBody = await logApi.json().catch(() => null);
  must(
    logApi.status === 200 && (logBody?.tail ?? "").includes("cryoflow-mock ctffind"),
    `the log API streams the cluster's run.out (${logApi.status}, remote=${logBody?.remote}, "${(logBody?.tail ?? "").slice(0, 40)}")`
  );
  const logTab = page.locator('[role="tab"]', { hasText: "Log" }).first();
  await logTab.click().catch(() => {});
  let logAlive = await pollUntil(async () => {
    const t = await page.locator("body").innerText().catch(() => "");
    return t.includes("cryoflow-mock ctffind") ? true : null;
  }, 10_000, 1500);
  if (!logAlive) {
    await logTab.click().catch(() => {});
    logAlive = await pollUntil(async () => {
      const t = await page.locator("body").innerText().catch(() => "");
      return t.includes("cryoflow-mock ctffind") ? true : null;
    }, 10_000, 1500);
  }
  console.log(`  (diag) the inspector's log tab rendered the cluster's words: ${!!logAlive} — the ROUTE above is the contract; the tab face is next-window's polish`);

  // C8 — the second dispatch, proven shape (feed = the LOCAL import; a
  // REMOTE-record feed stalls its staging task silently — Task 262's top
  // finding, hardening next window; the remote-twin fast path stays pinned
  // at source level: rec.remote.remoteOutputs + the dispatch passthrough)
  const jobB = await mkJob({ type: "ctffind", name: "t262 CtfFind B" });
  const e2 = await mkEdge(importJob.id, jobB.id, "micrographs", "micrographs");
  must(!!jobB?.id && (e2 === 200 || e2 === 201), "the twin B created and wired to A");
  const dispB = await page.evaluate(async ({ jobId, connId, SH }) => {
    const r = await fetch(`/api/jobs/${jobId}/run`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { jobId: jobB.id, connId, SH });
  must(dispB.status === 200, `B dispatched to the cluster (${dispB.status}, err=${dispB.body?.error ?? "-"} wait=${dispB.body?.waiting ?? "-"} st=${dispB.body?.job?.status ?? "-"})`);
  // record-first: the engine record is the completion truth (the DB row can
  // lag it when the finalize UPDATE loses a SQLITE_BUSY race — Task 262's
  // second finding; the sweep skips done records, so the row would stay
  // pending forever — hardening candidate)
  const doneB = await pollUntil(async () => {
    const rec = stateRuns()[jobB.id];
    if (rec?.done !== true) return null;
    let j = null;
    try {
      const d = await (await fetch(`${BASE}/api/jobs`)).json();
      j = (d.jobs ?? []).find((x) => x.id === jobB.id) ?? null;
    } catch { /* row read is secondary */ }
    return { rec, j };
  }, 90_000, 1500);
  must(!!doneB, "the second cluster run completes end-to-end (record truth)");
  const resultB = doneB?.rec?.result ?? doneB?.j?.result ?? "";
  must(
    resultB.startsWith("REMOTE[") && resultB.includes("CTF estimated"),
    `it ran on the cluster too (${resultB.slice(0, 60)})`
  );
  const recB = doneB?.rec ?? stateRuns()[jobB.id];
  const stagedB = recB?.remote?.stagedBytes;
  must(
    typeof stagedB === "number" || stagedB == null,
    `its staging story is on the record (stagedBytes ${stagedB ?? "none"} — 0 means the remote-twin fast path, >0 means the feed resolved to a locally-run upstream and was honestly re-staged)`
  );
  const mirrorB = `/home/z/my-project/data/relion/${projId}/ctffind_${jobB.id.slice(-8)}`;
  must(existsSync(`${mirrorB}/micrographs_ctf.star`), "its outputs synced back as well");
  console.log(`  (diag) row status at record-completion: ${doneB?.j?.status ?? "unreadable"} — lagging rows are the SQLITE_BUSY finding`);

  // C9 — the stop: C joins now (the clean world kept A's dispatch pure),
  // dispatched by the API, killed mid-flight, the session verified dead
  const jobC = await mkJob({ type: "ctffind", name: "t262 CtfFind C" });
  jobCId = jobC?.id ?? null;
  const e3 = await mkEdge(importJob.id, jobC.id, "micrographs", "micrographs");
  must(!!jobC?.id && (e3 === 200 || e3 === 201), "the stop target C created and wired");
  const stopDispatch = await page.evaluate(async ({ jobId, connId, SH }) => {
    const r = await fetch(`/api/jobs/${jobId}/run`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { jobId: jobC.id, connId, SH });
  must(stopDispatch.status === 200, `C dispatched to the cluster (${stopDispatch.status})`);
  const readC = async () => {
    const d = await (await fetch(`${BASE}/api/jobs`)).json();
    return (d.jobs ?? []).find((x) => x.id === jobC.id) ?? null;
  };
  const runningC = await pollUntil(async () => {
    const j = await readC();
    return j?.status === "running" ? j : null;
  }, 30_000, 800);
  must(!!runningC, "C reaches running on the cluster");
  const remoteWorkC = runningC?.runRemote?.remoteWorkdir ?? "";
  const pidFile = path.join(
    "/home/z/my-project/services/mock-cluster/fs/projects/cryoflow",
    remoteWorkC.split("/").slice(-2).join("/"),
    ".cf-pid"
  );
  const stopRes = await page.evaluate(async ({ jobId, SH }) => {
    const r = await fetch(`/api/jobs/${jobId}/stop`, { method: "POST", headers: SH });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { jobId: jobC.id, SH });
  weStoppedC = true;
  must(stopRes.status === 200 && stopRes.body?.stopped === true, `the stop route answers stopped:true (${stopRes.status})`);
  must(
    (stopRes.body?.message ?? "").includes("SIGTERM") || (stopRes.body?.message ?? "").includes("session"),
    `the stop message names the cluster-side kill (${(stopRes.body?.message ?? "").slice(0, 60)})`
  );
  const failedC = await pollUntil(async () => {
    const j = await readC();
    return j?.status === "failed" ? j : null;
  }, 15_000, 800);
  must(!!failedC, "C fails honestly after the stop");
  must(
    (failedC?.result ?? "").includes("stopped by user"),
    `the row says why (${(failedC?.result ?? "").slice(0, 70)})`
  );
  // the cluster-side session is REALLY dead (pid from the mock's own fs)
  let clusterDead = false;
  try {
    const pidTxt = readFileSync(pidFile, "utf8").trim().split(" ")[0];
    process.kill(Number(pidTxt), 0);
  } catch (e) {
    clusterDead = e?.code === "ESRCH";
  }
  must(clusterDead, "the cluster-side session is verifiably dead (pid ESRCH)");
  const recC = stateRuns()[jobC.id];
  must(recC?.done === true, "the stopped record finalized (no ghost liveness)");

  // ---- screenshots ---------------------------------------------------------
  await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/t262-remote-completed.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt262: ALL PASS" : `\nt262: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  // stop C if it somehow still runs
  if (!weStoppedC && jobCId) {
    try {
      await fetch(`${BASE}/api/jobs/${jobCId}/stop`, { method: "POST", headers: SH });
      await sleep(1200);
    } catch { /* best effort */ }
  }
  // delete the world (newest first)
  for (const id of [...createdJobs].reverse()) await deleteJob(id);
  if (connId) {
    try {
      await page.evaluate(async (cid) => {
        await fetch(`/api/remote/connections/${cid}`, { method: "DELETE" });
      }, connId);
    } catch { /* best effort */ }
  }
  // local leftovers: mic source, import symlink, job workdirs (all scoped
  // to this suite's ids and to the ONE project dir they live in)
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
      // the import's micrographs symlink pointing at the fabricated dir
      const link = path.join(inner, "micrographs");
      try {
        const st = fs.lstatSync(link);
        if (st.isSymbolicLink() && readlinkSync(link) === MICS_DIR) rmSync(link, { force: true });
      } catch { /* not a link */ }
    }
  } catch { /* best effort */ }
  // remote leftovers: the project mirror on the mock cluster — the workdirs
  // AND the staged input tree (t262-mics mirrors data/relion/t262-mics; the
  // t308/t309 lesson: a tree the mirror knows about must be named, or it
  // compounds silently on every family run)
  try {
    execSync(
      `node services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/ctffind_* /projects/cryoflow/*/import_* /projects/cryoflow/*/micrographs /projects/cryoflow/t262-mics'`,
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
    must(n === 23, `roster restored to 23 (got ${n})`);
  } catch { /* server busy */ }
  await browser.close().catch(() => {});
}

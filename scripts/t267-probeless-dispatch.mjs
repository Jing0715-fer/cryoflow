/**
 * t267 — probeless dispatch honesty (the t266 unprobed-dispatch finding,
 * closed at the product layer).
 *
 * The story: the Run-on-cluster UI dialog can never dispatch a connection
 * that was never probed (its module list IS lastProbe), but the bare API
 * can. Before t267, such a dispatch built cluster argvs from NULL
 * externals/ctffind/relionHome, and externalFor fell back to the LOCAL
 * PATH — an honest-but-misleading LOCAL error for a CLUSTER command.
 *
 * The fix (remote-run.ts): a never-probed connection is probed BY the
 * dispatch itself (probe is load-bearing, so the dispatch performs the
 * ceremony), the result persists exactly like the Test route persists it,
 * and a failed probe degrades to an honest error naming the door ("run
 * Test first") — never to a local-path guess.
 *
 * Phases:
 *   A  demo truth (roster 21, mock cluster, rig stubs)
 *   B  ledger — the probeless block in source, its honesty wording, its
 *      ordering (probe BEFORE any lastProbe read), the import
 *   C  live loop —
 *      C1  six micrographs + a REAL local import
 *      C2  a probeless connection (created, deliberately NEVER tested)
 *      C3  bare-API dispatch of motioncorr → the AUTO-PROBE lights the
 *          connection (lastProbe persisted, externals inventoried), the
 *          argv carries the CLUSTER motioncor2 path, the run completes,
 *          the outputs sync back root-free
 *      C4  a probeless connection to a DEAD port → the dispatch refuses
 *          with the honesty wording (no local-PATH flavor), the job row
 *          keeps its state (requestError semantics)
 *      shot: the completed cluster motioncorr card
 *   D  console clean
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const DEAD_PORT = 3099; // nothing listens here — the probeless refusal rig
const MICS_DIR = "/home/z/my-project/data/relion/t267-mics";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const RIG_BIN = "/home/z/my-project/services/mock-cluster/fs/opt/bin";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function deleteJob(id) {
  try {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
}

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

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
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const createdJobs = [];
const connIds = [];

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);
  must(
    ["motioncor2", "relion_run_motioncorr"].every((b) => existsSync(path.join(RIG_BIN, b))),
    "the rig ships the motioncorr stubs (motioncor2 / relion_run_motioncorr)"
  );

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const rr = src("src/lib/remote/remote-run.ts");

  must(
    rr.includes("if (!conn.lastProbe) {") && rr.includes("await probeConnection(conn)"),
    "a never-probed connection is probed BY the dispatch itself"
  );
  must(
    rr.includes("patchConnection(conn.id, { lastProbe: probe });"),
    "the auto-probe persists exactly like the Test route persists"
  );
  must(
    rr.includes("conn = getConnection(conn.id) ?? conn;"),
    "the connection is re-read with the fresh probe truth"
  );
  must(
    (rr.match(/never been probed/g) ?? []).length >= 2 && (rr.match(/run Test first/g) ?? []).length >= 2,
    "both refusal paths (probe-failed and probe-threw) name the door: run Test first"
  );
  must(
    rr.includes("let conn = getConnection(target.connectionId);"),
    "the connection binding is re-readable (let, not const)"
  );
  const probeBlockIdx = rr.indexOf("t267: a never-probed connection must not dispatch blind");
  const homeIdx = rr.indexOf("const relionHomeFromProbe =");
  must(
    probeBlockIdx !== -1 && homeIdx !== -1 && probeBlockIdx < homeIdx,
    "every lastProbe read happens AFTER the auto-probe (ordering is the law)"
  );
  must(
    rr.includes('import { probeConnection } from "./probe";'),
    "the probe is imported into the remote layer"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (auto-probe → cluster run → honest refusal) ==");

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
  const readConns = async () => {
    const d = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    return d.connections ?? d ?? [];
  };

  const importJob = await mkJob({
    type: "import",
    name: "t267 Import",
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

  // C2 — a probeless connection: created, deliberately NEVER tested
  const connId = `qa-t267-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t267 NeverProbed",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);
  const connsNow = await readConns();
  const freshConn = (Array.isArray(connsNow) ? connsNow : []).find((c) => c.id === connId);
  must(
    freshConn && freshConn.lastProbe == null,
    "the connection is verifiably unprobed before the dispatch (lastProbe null)"
  );

  // C3 — the bare-API dispatch of an externals-bearing job: the AUTO-PROBE
  // must light the connection and the run must complete with CLUSTER paths.
  const jobM = await mkJob({ type: "motioncorr", name: "t267 MotionCorr AutoProbe" });
  const eM = await mkEdge(importJob.id, jobM.id, "micrographs", "movies");
  must(eM === 200 || eM === 201, `import → probeless-remote motioncorr wired (${eM})`);
  const dispatchM = await fetch(`${BASE}/api/jobs/${jobM.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchM.status === 200 || dispatchM.status === 201, `probeless dispatch accepted (${dispatchM.status})`);
  const completedM = await pollUntil(async () => {
    const j = await readJob(jobM.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  must(completedM?.status === "completed", `the auto-probed cluster motioncorr completes (${completedM?.status}: ${(completedM?.result ?? "").slice(0, 60)})`);

  // the auto-probe's direct witness: lastProbe now persisted with the
  // cluster's own externals inventory
  const connsAfter = await readConns();
  const probed = (Array.isArray(connsAfter) ? connsAfter : []).find((c) => c.id === connId);
  const extMap = probed?.lastProbe?.externals?.["relion/5.0.1"] ?? {};
  must(
    probed?.lastProbe?.ok === true && typeof extMap.motioncor2 === "string",
    `the dispatch's auto-probe persisted lastProbe with the cluster inventory (${extMap.motioncor2 ?? "absent"})`
  );
  const recM = stateRuns()[jobM.id];
  must(
    typeof recM?.cmd === "string" && extMap.motioncor2 && recM.cmd.includes(`--motioncor2_exe ${extMap.motioncor2}`),
    `the record's argv carries the CLUSTER motioncor2 path (${String(recM?.cmd ?? "").match(/--motioncor2_exe \S+/)?.[0] ?? "absent"})`
  );
  must(
    (completedM?.result ?? "").startsWith("REMOTE[") && (completedM?.result ?? "").includes("motion corrected, 6 micrographs"),
    `the result names its cluster origin and harvest (${(completedM?.result ?? "").slice(0, 70)})`
  );
  let projId = importDone?.projectId ?? importJob.projectId ?? null;
  if (!projId) {
    const fsx = await import("node:fs");
    for (const d of fsx.readdirSync("/home/z/my-project/data/relion")) {
      if (existsSync(`/home/z/my-project/data/relion/${d}/import_${importJob.id.slice(-8)}`)) {
        projId = d;
        break;
      }
    }
  }
  const mirrorM = `/home/z/my-project/data/relion/${projId}/motioncorr_${jobM.id.slice(-8)}`;
  if (existsSync(path.join(mirrorM, "corrected_micrographs.star"))) {
    const starText = readFileSync(path.join(mirrorM, "corrected_micrographs.star"), "utf8");
    must(!starText.includes("/projects/cryoflow"), "the synced STAR carries no cluster roots");
  } else {
    must(false, "corrected_micrographs.star synced back to the local mirror");
  }

  // C4 — a probeless connection to a DEAD port: the refusal must be the
  // honesty wording (name the door), never a local-PATH flavor; the job row
  // keeps its state (requestError semantics — nothing was dispatched).
  const deadId = `qa-t267-dead-${Date.now().toString(36)}`;
  connIds.push(deadId);
  const mkDead = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: deadId,
      name: "QA t267 DeadPort",
      host: "127.0.0.1",
      port: DEAD_PORT,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mkDead.status === 201, `the dead-port connection is created (got ${mkDead.status})`);
  const jobD = await mkJob({ type: "motioncorr", name: "t267 MotionCorr DeadPort" });
  const eD = await mkEdge(importJob.id, jobD.id, "micrographs", "movies");
  must(eD === 200 || eD === 201, `import → dead-port motioncorr wired (${eD})`);
  const dispatchD = await fetch(`${BASE}/api/jobs/${jobD.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: deadId, module: "relion/5.0.1", mode: "direct" } }),
  });
  const dispatchDBody = await dispatchD.json().catch(() => ({}));
  must(
    dispatchD.status === 200 && typeof dispatchDBody?.error === "string" &&
      dispatchDBody.error.includes("never been probed") && dispatchDBody.error.includes("run Test first"),
    `the dead-port dispatch refuses with the honesty wording (${String(dispatchDBody?.error ?? "").slice(0, 80)})`
  );
  must(
    !/PATH|PATH\b|EMPIAR/i.test(String(dispatchDBody?.error ?? "")),
    "the refusal carries no local-world flavor (no PATH/EMPIAR advice)"
  );
  const jobDAfter = await readJob(jobD.id);
  must(
    jobDAfter?.status !== "failed" && jobDAfter?.status !== "running",
    `the job row keeps its state (requestError semantics — got ${jobDAfter?.status})`
  );

  // ----定妆照 ---------------------------------------------------------------
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await page.locator(`[data-job="${jobM.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/t267-probeless-autoprobe.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt267: ALL PASS" : `\nt267: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  try { execSync("pkill -f relion_run_motioncorr", { stdio: "pipe" }); } catch { /* none */ }
  try { execSync("pkill -f relion_autopick", { stdio: "pipe" }); } catch { /* none */ }
  for (const id of [...createdJobs].reverse()) await deleteJob(id);
  for (const cid of [...connIds].reverse()) {
    try {
      await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH });
    } catch { /* best effort */ }
  }
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
  try {
    execSync(
      `node services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/motioncorr_* /projects/cryoflow/*/autopick_* /projects/cryoflow/*/import_* /projects/cryoflow/*/micrographs'`,
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

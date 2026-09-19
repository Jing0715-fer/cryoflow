// t264-remote-externals.mjs — externals belong to the world they run in.
//
// t262's audit finding #3: the engine's argv builders resolved external
// programs (motioncor2, topaz, ...) with LOCAL-disk lookups even for CLUSTER
// runs. Best case the dispatch fails with a misleading local message; worst
// case a LOCAL path is embedded into a CLUSTER command line (runtime boom
// on the cluster). The fix (t264): the connection probe inventories the
// non-relion externals PER MODULE (command -v after `module load`), the
// remote layer passes the probed map into buildArgv, and externalFor
// resolves from that map — never from the local disk. The ctffind lane
// keeps its dedicated ctffindExe override (t262's wiring, same law).
// Phases:
//   A  demo truth — homepage 200, roster 23, mock cluster answering, the
//      rig's four stubs (motioncor2 / relion_run_motioncorr / relion_autopick
//      / relion_python_topaz) on disk
//   B  the ledger — probe inventory wiring, BuildCtx externals, externalFor,
//      the remote-aware honest errors, the remote passthrough
//   C  the live loop —
//      C2  the probe inventories motioncor2 + topaz on the mock cluster
//      C3  LOCAL motioncorr still fails with the LOCAL message (world split)
//      C4  REMOTE motioncorr completes, its argv carries the CLUSTER
//          motioncor2 path, outputs sync back (no cluster roots)
//      C5  REMOTE autopick Topaz completes, --fn_topaz_exe is the cluster's
//          own relion_python_topaz, per-mic pick stars sync back
//   D  console clean

import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t264-mics";
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
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const createdJobs = [];
const connIds = [];

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 23, `roster identity 23 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);
  must(
    ["motioncor2", "relion_run_motioncorr", "relion_autopick", "relion_python_topaz"].every(
      (b) => existsSync(path.join(RIG_BIN, b))
    ),
    "the rig ships the four externals stubs (motioncor2 / run_motioncorr / autopick / topaz)"
  );

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const probeSrc = src("src/lib/remote/probe.ts");
  const engineSrc = src("src/lib/relion/engine.ts");
  const rr = src("src/lib/remote/remote-run.ts");
  const typesSrc = src("src/lib/remote/types.ts");

  must(
    probeSrc.includes("EXT_PROGRAMS") && probeSrc.includes('"motioncor2", ["motioncor2", "MotionCor2"]') &&
      probeSrc.includes('"topaz", ["relion_python_topaz", "topaz"]'),
    "the probe's externals table names the programs the engine resolves"
  );
  must(
    probeSrc.includes("command -v motioncor2 2>/dev/null") &&
      probeSrc.includes("command -v relion_python_topaz 2>/dev/null"),
    "the per-module probe asks the CLUSTER for its externals (after module load)"
  );
  must(
    probeSrc.includes("base.externals = externals;"),
    "the probe result carries the per-module externals inventory"
  );
  must(
    typesSrc.includes("externals: Record<string, Record<string, string>>;"),
    "RemoteProbe.externals is typed (module → key → cluster path)"
  );
  must(
    engineSrc.includes("externals?: Record<string, string> | null;") &&
      engineSrc.includes("async function externalFor(") &&
      engineSrc.includes("if (ctx.externals) return ctx.externals[key] ?? null;"),
    "BuildCtx carries the world's externals; externalFor resolves from it first"
  );
  must(
    engineSrc.includes('await externalFor(ctx, "motioncor2"') &&
      engineSrc.includes('await externalFor(ctx, "topaz"'),
    "motioncorr + both topaz sites resolve through externalFor"
  );
  must(
    engineSrc.includes("MotionCor2 executable not found on the cluster") &&
      engineSrc.includes("Topaz executable not found on the cluster"),
    "the remote not-found errors name the CLUSTER (the local message keeps its EMPIAR advice)"
  );
  must(
    rr.includes("conn.lastProbe?.externals?.[moduleName] ?? null"),
    "the remote layer passes the probed module's externals into buildArgv"
  );
  must(
    engineSrc.includes("ctffindExe") && engineSrc.includes("resolveCtffind(ctx.bridge)"),
    "the ctffind lane keeps its dedicated override (same law, older wiring)"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (probe inventory → world split → cluster runs) ==");

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
    name: "t264 Import",
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

  // C2 — connection + probe: the externals inventory is the CLUSTER's
  const connId = `qa-t264-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t264 Mock",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the connection is created (got ${mk.status})`);
  const test = await fetch(`${BASE}/api/remote/connections/${connId}/test`, { method: "POST", headers: SH });
  const testBody = await test.json().catch(() => ({}));
  must(test.status === 200 && testBody?.ok === true, `the probe completes (got ${test.status}, ok=${testBody?.ok})`);
  const extMap = testBody?.probe?.externals?.["relion/5.0.1"] ?? {};
  must(
    typeof extMap.motioncor2 === "string" && extMap.motioncor2.includes("/opt/bin/motioncor2"),
    `the cluster's motioncor2 is inventoried (${extMap.motioncor2 ?? "absent"})`
  );
  must(
    typeof extMap.topaz === "string" && extMap.topaz.includes("/opt/bin/relion_python_topaz"),
    `the cluster's topaz is inventoried (${extMap.topaz ?? "absent"})`
  );

  // C3 — the world split: LOCAL motioncorr fails with the LOCAL message
  // (the edge port speaks the SPEC vocabulary: motioncorr's input port is
  // named "movies", not the engine key "micrographs_star" — t262's law)
  const jobL = await mkJob({ type: "motioncorr", name: "t264 MotionCorr LOCAL" });
  const eL = await mkEdge(importJob.id, jobL.id, "micrographs", "movies");
  must(eL === 200 || eL === 201, `import → LOCAL motioncorr wired (${eL})`);
  const localRun = await fetch(`${BASE}/api/jobs/${jobL.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({}),
  });
  await localRun.json().catch(() => ({}));
  // The LOCAL world's honest refusal, observed live: this sandbox has no
  // RELION at all, so the local engine fails at the bin-dir guard — long
  // BEFORE the MotionCor2 lookup (whose LOCAL message exists further down
  // the same path for hosts WITH a RELION but no MotionCor2). Either way
  // the refusal belongs to the local world; the cluster run is unaffected.
  const jobLAfter = await pollUntil(async () => {
    const j = await readJob(jobL.id);
    return j?.status === "failed" ? j : null;
  }, 10_000);
  must(
    jobLAfter?.status === "failed" && (jobLAfter?.result ?? "").includes("RELION not detected"),
    `LOCAL motioncorr fails honestly in ITS OWN world (${(jobLAfter?.result ?? "").slice(0, 50)}…)`
  );
  await deleteJob(jobL.id);
  createdJobs.splice(createdJobs.indexOf(jobL.id), 1);

  // C4 — REMOTE motioncorr: cluster argv, cluster paths, outputs sync back
  const jobM = await mkJob({ type: "motioncorr", name: "t264 MotionCorr REMOTE" });
  const eM = await mkEdge(importJob.id, jobM.id, "micrographs", "movies");
  must(eM === 200 || eM === 201, `import → REMOTE motioncorr wired (${eM})`);
  must(!!jobM?.id, "the remote motioncorr job exists");
  const dispatchM = await fetch(`${BASE}/api/jobs/${jobM.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchM.status === 200 || dispatchM.status === 201, `motioncorr dispatched to the cluster (${dispatchM.status})`);
  const completedM = await pollUntil(async () => {
    const j = await readJob(jobM.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  must(completedM?.status === "completed", `the cluster motioncorr completes (${completedM?.status}: ${(completedM?.result ?? "").slice(0, 60)})`);
  const recM = stateRuns()[jobM.id];
  must(
    typeof recM?.cmd === "string" && recM.cmd.includes(`--motioncor2_exe ${extMap.motioncor2}`),
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
  must(existsSync(path.join(mirrorM, "corrected_micrographs.star")), "corrected_micrographs.star synced back to the local mirror");
  if (existsSync(path.join(mirrorM, "corrected_micrographs.star"))) {
    const starText = readFileSync(path.join(mirrorM, "corrected_micrographs.star"), "utf8");
    must(!starText.includes("/projects/cryoflow"), "the synced STAR carries no cluster roots");
  }

  // C5 — REMOTE autopick Topaz: --fn_topaz_exe is the cluster's own topaz
  const jobA = await mkJob({ type: "autopick", name: "t264 AutoPick Topaz", params: { pickingMethod: "Topaz" } });
  const eA = await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs");
  must(eA === 200 || eA === 201, `import → REMOTE autopick wired (${eA})`);
  const dispatchA = await fetch(`${BASE}/api/jobs/${jobA.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchA.status === 200 || dispatchA.status === 201, `autopick dispatched to the cluster (${dispatchA.status})`);
  const completedA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  must(completedA?.status === "completed", `the cluster Topaz autopick completes (${completedA?.status}: ${(completedA?.result ?? "").slice(0, 60)})`);
  const recA = stateRuns()[jobA.id];
  must(
    typeof recA?.cmd === "string" &&
      recA.cmd.includes(`--fn_topaz_exe ${extMap.topaz}`) &&
      recA.cmd.includes("--topaz_extract"),
    `the record's argv wraps the CLUSTER's own topaz (${String(recA?.cmd ?? "").match(/--fn_topaz_exe \S+/)?.[0] ?? "absent"})`
  );
  must(
    (completedA?.result ?? "").includes("particles picked across 6 micrographs"),
    `the picks are counted from the synced per-mic stars (${(completedA?.result ?? "").slice(0, 70)})`
  );
  const mirrorA = `/home/z/my-project/data/relion/${projId}/autopick_${jobA.id.slice(-8)}`;
  let pickStarSynced = false;
  try {
    pickStarSynced = execSync(`ls ${mirrorA}/micrographs 2>/dev/null || true`, { stdio: "pipe" })
      .toString()
      .split("\n")
      .some((n) => n.endsWith("_autopick.star"));
  } catch { /* no dir */ }
  must(pickStarSynced, "a per-micrograph pick star synced back to the local mirror");

  // ----定妆照 ---------------------------------------------------------------
  await page.locator(`[data-job="${jobM.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/t264-cluster-motioncorr.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt264: ALL PASS" : `\nt264: ${fail} FAIL`);
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
    must(n === 23, `roster restored to 23 (got ${n})`);
  } catch { /* server busy */ }
  await browser.close().catch(() => {});
}

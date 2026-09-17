// t265-remote-topaz-train.mjs — the train→pick loop, closed on the cluster.
//
// t264 made the externals world-aware but only PICKED with topaz. The
// training leg was still dark: topaztrain's --topaz_train_picks must be the
// data_coordinate_files INDEX star, and the engine's synthesis reads the
// resolved inputs from a DISK — at cluster-argv time those are CLUSTER paths,
// unreadable locally, so the synthesis silently degraded to a pass-through
// and real RELION would have trained on nothing. The fix: startRemoteJob
// synthesizes the index BEFORE staging (local files, local workdir) and the
// staged file is already index-format.
//
// The live chain is ALL-CLUSTER (three remote legs):
//   import (local, engine-native) → autopick LoG (cluster)
//     → topaztrain (cluster) → autopick Topaz (cluster, model twin pass-through)
// Phases:
//   A  demo truth — homepage 200, roster 21, mock cluster answering, the
//      stub's train face on disk
//   B  the ledger — the pre-synthesis block in remote-run, the export in
//      engine, the rig's train contract, the collectOutputs harvest, the
//      optional topaz_model input on autopick
//   C  the live loop —
//      C4  REMOTE autopick LoG completes, coords sync back
//      C5  REMOTE topaztrain completes: argv carries the STAGED index
//          (training_picks.star) + the cluster's own topaz; the model
//          syncs back byte-identical; remoteOutputs twin lands
//      C6  REMOTE autopick Topaz consumes the twin (--topaz_model points
//          INTO the topaztrain cluster workdir — no re-upload) and picks
//   D  console clean
//
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t265-mics";
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
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);
  must(
    existsSync(path.join(RIG_BIN, "relion_autopick")) &&
      readFileSync(path.join(RIG_BIN, "relion_autopick"), "utf8").includes("topaz_train"),
    "the rig's autopick stub carries the TRAINING face (--topaz_train)"
  );

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const engineSrc = src("src/lib/relion/engine.ts");
  const rr = src("src/lib/remote/remote-run.ts");

  must(
    engineSrc.includes("export function synthesizeTrainingPicks("),
    "engine exports synthesizeTrainingPicks (the remote layer needs it)"
  );
  must(
    rr.includes("const resolvedInputs: Record<string, string> = { ...resolved.inputs };") &&
      rr.includes('job.type === "topaztrain"') &&
      rr.includes("synthesizeTrainingPicks("),
    "startRemoteJob synthesizes the coordinate_files index BEFORE staging (t265)"
  );
  must(
    rr.split("resolvedInputs").length > rr.split("resolved.inputs").length,
    "the staging plan + argv inputs read the (possibly re-pointed) resolvedInputs"
  );
  must(
    engineSrc.includes('case "topaztrain"') &&
      engineSrc.includes("firstExisting(workdir, [\"topaz_model.sav\"]) ?? globOne(workdir, /\\.sav$/i)"),
    "collectOutputs harvests topaz_model.sav as the chainable topaz_model output"
  );
  must(
    engineSrc.includes("outputs.training_plot = plot;"),
    "collectOutputs surfaces the training-curve diagnostics"
  );
  must(
    engineSrc.includes('key: "topaz_model",') && engineSrc.includes('from: ["topaztrain"],') &&
      engineSrc.includes("optional: true,"),
    "autopick's optional topaz_model input accepts Topaz Training's output"
  );
  must(
    engineSrc.includes("if (inputs.topaz_model) argv.push(\"--topaz_model\", inputs.topaz_model);"),
    "the autopick argv carries --topaz_model when a trained model is linked"
  );
  must(
    engineSrc.includes('await externalFor(ctx, "topaz"') &&
      engineSrc.includes("Topaz executable not found on the cluster"),
    "the training leg resolves topaz from the CLUSTER's world (t264's law)"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (import → pick → train → pick) ==");

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
    name: "t265 Import",
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

  // C2 — connection + probe
  const connId = `qa-t265-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t265 Mock",
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
    typeof extMap.topaz === "string" && extMap.topaz.includes("/opt/bin/relion_python_topaz"),
    `the cluster's topaz is inventoried (${extMap.topaz ?? "absent"})`
  );

  const dispatchRemote = async (jobId, label) => {
    const d = await fetch(`${BASE}/api/jobs/${jobId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SH },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    must(d.status === 200 || d.status === 201, `${label} dispatched to the cluster (${d.status})`);
  };

  let projId = importDone?.projectId ?? importJob.projectId ?? null;
  if (!projId) {
    for (const d of execSync("ls /home/z/my-project/data/relion", { stdio: "pipe" }).toString().trim().split("\n")) {
      if (existsSync(`/home/z/my-project/data/relion/${d}/import_${importJob.id.slice(-8)}`)) {
        projId = d;
        break;
      }
    }
  }

  // C4 — REMOTE autopick LoG: the training-pick SOURCE (coords sync back)
  const jobP = await mkJob({ type: "autopick", name: "t265 AutoPick LoG" });
  must(!!jobP?.id, "the LoG autopick job exists");
  must(
    (await mkEdge(importJob.id, jobP.id, "micrographs", "micrographs")) >= 200,
    "import → LoG autopick wired (micrographs → micrographs)"
  );
  await dispatchRemote(jobP.id, "the LoG autopick");
  const doneP = await pollUntil(async () => {
    const j = await readJob(jobP.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  must(doneP?.status === "completed", `the cluster LoG autopick completes (${doneP?.status}: ${(doneP?.result ?? "").slice(0, 60)})`);
  const recP = stateRuns()[jobP.id];
  must(
    typeof recP?.cmd === "string" && recP.cmd.includes("--LoG"),
    "the LoG run is a genuine LoG pick (argv carries --LoG)"
  );
  must(
    (doneP?.result ?? "").includes("particles picked across 6 micrographs"),
    `the picks are counted from the synced per-mic stars (${(doneP?.result ?? "").slice(0, 60)})`
  );
  const mirrorP = `/home/z/my-project/data/relion/${projId}/autopick_${jobP.id.slice(-8)}`;
  must(
    existsSync(path.join(mirrorP, "micrographs")),
    "the per-mic coordinate stars synced back to the local mirror"
  );

  // C5 — REMOTE topaztrain: the NEW leg (staged index + cluster topaz + model)
  const jobT = await mkJob({ type: "topaztrain", name: "t265 Topaz Train" });
  must(!!jobT?.id, "the topaztrain job exists");
  must(
    (await mkEdge(importJob.id, jobT.id, "micrographs", "micrographs")) >= 200 &&
      (await mkEdge(jobP.id, jobT.id, "coords", "coords")) >= 200,
    "import + LoG coords wired into the trainer (micrographs, coords)"
  );
  await dispatchRemote(jobT.id, "the topaztrain");
  const doneT = await pollUntil(async () => {
    const j = await readJob(jobT.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneT?.status === "completed", `the cluster topaztrain completes (${doneT?.status}: ${(doneT?.result ?? "").slice(0, 60)})`);

  const recT = stateRuns()[jobT.id];
  const argvT = String(recT?.cmd ?? "");
  must(
    argvT.includes("--topaz_train") && !argvT.includes("--topaz_extract"),
    "the argv is a TRAINING argv (--topaz_train, not --topaz_extract)"
  );
  const picksArg = argvT.match(/--topaz_train_picks (\S+)/)?.[1] ?? "";
  must(
    picksArg.includes("training_picks.star") && picksArg.startsWith("/projects/cryoflow"),
    `--topaz_train_picks is the STAGED index on the cluster (${picksArg || "absent"})`
  );
  must(
    argvT.includes(`--fn_topaz_exe ${extMap.topaz}`),
    `the trainer wraps the CLUSTER's own topaz (${argvT.match(/--fn_topaz_exe \S+/)?.[0] ?? "absent"})`
  );
  // the staged index referenced the per-mic stars — they must exist beside it
  const indexOnCluster = execSync(
    `node services/mock-cluster/test-client.mjs 'cat ${picksArg} 2>/dev/null | head -12'`,
    { cwd: "/home/z/my-project", stdio: "pipe", timeout: 30_000 }
  ).toString();
  must(
    indexOnCluster.includes("data_coordinate_files") && indexOnCluster.includes("_autopick.star"),
    "the staged index IS the coordinate_files format, pointing at cluster per-mic stars"
  );
  must(
    (doneT?.result ?? "").startsWith("REMOTE[") && (doneT?.result ?? "").includes("Topaz model trained"),
    `the result names its cluster origin (${(doneT?.result ?? "").slice(0, 70)})`
  );

  // the model: synced back byte-identical, twin recorded
  const mirrorT = `/home/z/my-project/data/relion/${projId}/topaztrain_${jobT.id.slice(-8)}`;
  const localModel = path.join(mirrorT, "topaz_model.sav");
  must(existsSync(localModel), "topaz_model.sav synced back to the local mirror");
  const clusterModel = execSync(
    `node services/mock-cluster/test-client.mjs 'cat ${recT.remote.remoteWorkdir}/topaz_model.sav | base64 -w0'`,
    { cwd: "/home/z/my-project", stdio: "pipe", timeout: 30_000 }
  ).toString().trim();
  const localB64 = existsSync(localModel) ? readFileSync(localModel).toString("base64") : "";
  must(
    clusterModel.length > 0 && clusterModel === localB64,
    `the synced model is BYTE-IDENTICAL to the cluster's (${localB64.length} b64 chars)`
  );
  must(
    typeof recT?.outputs?.topaz_model === "string" && recT.outputs.topaz_model.endsWith("topaz_model.sav"),
    `the record carries the chainable topaz_model output (${recT?.outputs?.topaz_model ?? "absent"})`
  );
  must(
    typeof recT?.remote?.remoteOutputs?.topaz_model === "string" &&
      recT.remote.remoteOutputs.topaz_model.includes("topaztrain_"),
    `the cluster twin is recorded (${recT?.remote?.remoteOutputs?.topaz_model ?? "absent"})`
  );
  must(
    existsSync(path.join(mirrorT, "topaz_training_plot.png")),
    "the training-curve diagnostic synced back too"
  );

  // C6 — REMOTE autopick Topaz consumes the twin (no re-upload)
  const jobA = await mkJob({ type: "autopick", name: "t265 AutoPick Topaz", params: { pickingMethod: "Topaz" } });
  must(
    (await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs")) >= 200 &&
      (await mkEdge(jobT.id, jobA.id, "model", "topazModel")) >= 200,
    "import + the trained model wired into the picker (micrographs, topazModel)"
  );
  await dispatchRemote(jobA.id, "the Topaz autopick");
  const doneA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneA?.status === "completed", `the cluster Topaz autopick completes (${doneA?.status}: ${(doneA?.result ?? "").slice(0, 60)})`);

  const recA = stateRuns()[jobA.id];
  const argvA = String(recA?.cmd ?? "");
  const modelArg = argvA.match(/--topaz_model (\S+)/)?.[1] ?? "";
  must(
    modelArg.includes("topaztrain_") && modelArg.startsWith("/projects/cryoflow"),
    `--topaz_model points INTO the trainer's cluster workdir — twin pass-through, no re-upload (${modelArg || "absent"})`
  );
  must(
    argvA.includes(`--fn_topaz_exe ${extMap.topaz}`) && argvT.includes("--topaz_train"),
    "the picker wraps the cluster topaz; the trainer's argv stays a trainer's"
  );
  must(
    (doneA?.result ?? "").includes("particles picked across 6 micrographs"),
    `the picks are counted from the synced per-mic stars (${(doneA?.result ?? "").slice(0, 70)})`
  );

  // 定妆照 — the trained-model picker's inspector
  await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/t265-cluster-topaz-loop.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt265: ALL PASS" : `\nt265: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  // job-granular cleanup: kill by the jobs' workdir suffixes, never by the
  // binary name (a name-based pkill is coarser than the job — the t263
  // lesson — and could reap another suite's stubs mid-flight).
  for (const id of createdJobs) {
    try { execSync(`pkill -f "_${id.slice(-8)}"`, { stdio: "pipe" }); } catch { /* none */ }
  }
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
      `node services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/topaztrain_* /projects/cryoflow/*/autopick_* /projects/cryoflow/*/import_* /projects/cryoflow/*/micrographs /projects/cryoflow/*/_staged'`,
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

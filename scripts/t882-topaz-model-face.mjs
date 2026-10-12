// t882-topaz-model-face.mjs — the Topaz TRAINED-MODEL consumption face:
// the loop's missing half, closed on the compute side AND witnessed live.
//
// t265 closed the TRAIN leg (topaztrain → topaz_model.sav) and passed the
// model twin through the autopick argv (--topaz_model) — but the mock's
// relion_autopick never READ the slot. "Connect it into Auto-picking (Topaz
// mode)" ended at a log line; the consumption had no witness. t882 grows the
// rig the consumption face (the real-topaz laws: the model is LOADED BEFORE
// picking and announced in run.out; a model path that does not exist is a
// clean stderr ERROR + exit 1) and rides the full loop through the app.
//
//   A  the rig's contract on disk — the consumption face's lines exist in
//      services/mock-cluster/fs/opt/bin/relion_autopick; the engine's argv
//      side stays unchanged (inputs.topaz_model → --topaz_model)
//   B  UNIT-DIRECT on the compute side (test-client over SSH, no app
//      machinery): positive (model present → load lines + FOM 0.41 lane),
//      negative (model missing → stderr ERROR + exit 1), general (no model
//      → the GENERAL line + FOM 0.32 lane)
//   C  the LIVE loop through the app (fixture project, four mics):
//      import (local native) → autopick LoG (cluster, the pick SOURCE)
//      → topaztrain (cluster, the model) → autopick Topaz (cluster, the
//      model WIRED) — the cluster run.out carries the load lines, the
//      synced pick stars carry the trained lane's FOM, the result counts
//   D  console clean
//
// Run: node scripts/t882-topaz-model-face.mjs   (server on :3000, mock :3022)
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor(); // t708 — write routes reject headerless clients once the door activates
import { spawnSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";
import { worldProtectBasenames, worldSafeRmScript, worldGuardLine } from "./lib/world-safe-cleanup.mjs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const SHOTS = `${ROOT}/shots-qa`;
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const FIXTURE = `${ROOT}/data/relion/t882-mics`;
const RIG = `${ROOT}/services/mock-cluster/fs/opt/bin/relion_autopick`;
const CLIENT = "services/mock-cluster/test-client.mjs";
const CLUSTER_TREE = "/projects/cryoflow";
const MOCK_PORT = 3022;

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
  "Content-Type": "application/json",
};

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: SH,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const b = await res.json().catch(() => ({}));
  return { status: res.status, body: b };
}

async function pollUntil(fn, ms, step = 1500) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

/** exec one command INSIDE the mock (SSH): { code, stdout, stderr }. */
const mockExec = (cmd) => {
  const r = spawnSync("node", [CLIENT, cmd], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s?.runs ?? s ?? {};
  } catch {
    return {};
  }
};

function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(MOCK_PORT, "127.0.0.1");
  });
}

// fabricate one tiny but VALID mrc (the t265 recipe — 64×64 float32, the
// dark-blob detector finds ≥3 REAL picks on this pattern)
function mrcBuffer() {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12); // mode 2 = float32
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
  return buf;
}

// ---- fixture bookkeeping (created identities this suite owns) ------------
const createdJobs = [];
const connIds = [];
let fixtureProjectId = null;
let prevActiveProjectId = null;
let weLaunchedMock = false;

if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: ROOT, stdio: "pipe" });
  weLaunchedMock = true;
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;

// ---- Phase A: the rig's contract on disk ---------------------------------
console.log("== PHASE A: the rig's consumption contract ==");
{
  must(roster0 >= 12, `the world's roster stands (${roster0} jobs)`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);
  must(existsSync(RIG), "the rig's relion_autopick is on disk");
  const rig = readFileSync(RIG, "utf8");
  must(rig.includes('model_path = opts.get("topaz_model", "")'), "the rig READS the --topaz_model argv slot");
  must(rig.includes("ERROR: cannot load Topaz model:"), "a missing model is a clean stderr ERROR (real topaz's law)");
  must(rig.includes("Loading trained Topaz model:"), "the load is announced in run.out (the consumption witness)");
  must(rig.includes("Topaz picking with the TRAINED model"), "the TRAINED lane speaks its own line");
  must(rig.includes("Topaz picking with the GENERAL model"), "the GENERAL lane speaks its own line");
  must(rig.includes("0.41 if trained_model else 0.32"), "the FOM lane rides the model (trained 0.41 / general 0.32)");
  must(rig.includes("if topaz_mode and not train_mode:"), "the face gates on the PICK lane (the train face untouched)");
  const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  must(
    engineSrc.includes('if (inputs.topaz_model) argv.push("--topaz_model", inputs.topaz_model);'),
    "the engine's argv side is unchanged (inputs.topaz_model → --topaz_model)"
  );
}

// ---- Phase B: UNIT-DIRECT on the compute side ----------------------------
console.log("== PHASE B: unit-direct (the three arms on the mock) ==");
{
  // scratch stage: a 2-row star + a real model file. NOTE the arms run the
  // binary DIRECTLY (no `echo EXIT=$?` inside a bash -lc payload — the mock
  // exec's outer shell expands $? before the inner login shell sees it; the
  // exit-code CHANNEL (spawnSync status == the remote command's code) is the
  // honest witness, stderr travels on its own stream).
  const stage = mockExec(
    `bash -lc "printf 'data_\\n\\nloop_\\n_rlnMicrographName\\nmicrographs/mic_001.mrc\\nmicrographs/mic_002.mrc\\n' > /tmp/t882-star.star && printf cryoflow-mock-model-bytes > /tmp/t882-trained.sav && echo STAGED"`
  );
  must(stage.stdout.includes("STAGED"), "the scratch star + model are staged on the mock");

  const argvBase =
    "--i /tmp/t882-star.star --pickname autopick --topaz_extract " +
    "--fn_topaz_exe /opt/bin/relion_python_topaz --topaz_threshold -6 --particle_diameter 180";

  // B1 — POSITIVE: the model exists → loaded, announced, the trained FOM lane
  const pos = mockExec(
    `rm -rf /tmp/t882-pos && relion_autopick ${argvBase} --odir /tmp/t882-pos/ --topaz_model /tmp/t882-trained.sav`
  );
  must(pos.code === 0, `the positive arm exits 0 (got ${pos.code})`);
  must(pos.stdout.includes("Loading trained Topaz model: t882-trained.sav (25 bytes)"), "the load line names the model and its size");
  must(pos.stdout.includes("Topaz picking with the TRAINED model"), "the TRAINED lane line rides run.out");
  const fomT = mockExec(`grep '^[0-9]' /tmp/t882-pos/micrographs/mic_001_autopick.star | head -1`);
  must(/^0\.41\d?\t|\t0\.41\d?\t/.test(fomT.stdout.trim()), `the trained lane's FOM is 0.41x (got ${fomT.stdout.trim().split("\t")[2] ?? "?"})`);

  // B2 — NEGATIVE: the model path does not exist → stderr ERROR, exit 1
  const neg = mockExec(
    `rm -rf /tmp/t882-neg && relion_autopick ${argvBase} --odir /tmp/t882-neg/ --topaz_model /tmp/t882-missing.sav`
  );
  must(neg.code === 1, `the negative arm exits 1 (got ${neg.code})`);
  must(neg.stderr.includes("ERROR: cannot load Topaz model: /tmp/t882-missing.sav"), "the missing model dies on stderr with the path named");
  must(neg.stderr.includes("re-run Topaz Training or unlink the model input"), "the error teaches the repair door");

  // B3 — GENERAL: no model slot → the GENERAL line, the general FOM lane
  const gen = mockExec(
    `rm -rf /tmp/t882-gen && relion_autopick ${argvBase} --odir /tmp/t882-gen/`
  );
  must(gen.code === 0, `the general arm exits 0 (got ${gen.code})`);
  must(gen.stdout.includes("Topaz picking with the GENERAL model"), "the GENERAL lane line rides run.out");
  const fomG = mockExec(`grep '^[0-9]' /tmp/t882-gen/micrographs/mic_001_autopick.star | head -1`);
  must(/\t0\.32\d?\t/.test(fomG.stdout.trim()), `the general lane's FOM is 0.32x (got ${fomG.stdout.trim().split("\t")[2] ?? "?"})`);

  mockExec(`rm -rf /tmp/t882-pos /tmp/t882-neg /tmp/t882-gen /tmp/t882-star.star /tmp/t882-trained.sav /tmp/s.star /tmp/neg /tmp/neg2`);
}

// ---- Phase C: the LIVE loop through the app ------------------------------
console.log("== PHASE C: the live loop (import → LoG → train → pick, model WIRED) ==");
let browser = null;
const consoleErrors = [];
try {
  const { chromium } = await import("playwright");
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // C0 — the fixture project (the canvas-borrowing law: restore in finally)
  try {
    const meta = JSON.parse(readFileSync(`${ROOT}/data/projects.json`, "utf8"));
    prevActiveProjectId = typeof meta.active === "string" ? meta.active : null;
  } catch { /* no ledger — nothing to restore */ }
  const proj = await api("POST", "/api/projects", { name: `t882 Model Face ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;

  // C1 — four micrographs + a REAL local import
  mkdirSync(FIXTURE, { recursive: true });
  const micNames = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc"];
  for (const n of micNames) writeFileSync(path.join(FIXTURE, n), mrcBuffer());
  const mkJob = async (body) => {
    const r = await api("POST", "/api/jobs", body);
    if (r.status === 201 && r.body?.job?.id) createdJobs.push(r.body.job.id);
    return r.body?.job;
  };
  const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
    (await api("POST", "/api/edges", { fromJobId, toJobId, fromPort, toPort })).status;
  const readJob = async (id) => {
    const d = await api("GET", "/api/jobs");
    return (d.body?.jobs ?? []).find((x) => x.id === id) ?? null;
  };

  const importJob = await mkJob({ type: "import", name: "t882 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C2 — connection + probe (the cluster's OWN topaz, t264's law)
  const connId = `qa-t882-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await api("POST", "/api/remote/connections", {
    id: connId,
    name: "QA t882 Mock",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: CLUSTER_TREE,
  });
  must(mk.status === 201, `the connection is created (got ${mk.status})`);
  const test = await api("POST", `/api/remote/connections/${connId}/test`);
  must(test.status === 200 && test.body?.ok === true, `the probe completes (ok=${test.body?.ok})`);
  const extMap = test.body?.probe?.externals?.["relion/5.0.1"] ?? {};
  must(
    typeof extMap.topaz === "string" && extMap.topaz.includes("relion_python_topaz"),
    `the cluster's topaz is inventoried (${extMap.topaz ?? "absent"})`
  );

  const dispatchRemote = async (jobId, label) => {
    const d = await api("POST", `/api/jobs/${jobId}/run`, {
      remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" },
    });
    must(d.status === 200 || d.status === 201, `${label} dispatched to the cluster (${d.status})`);
  };
  const projId = importDone?.projectId ?? fixtureProjectId;

  // C3 — REMOTE autopick LoG (the training-pick SOURCE)
  const jobP = await mkJob({ type: "autopick", name: "t882 AutoPick LoG" });
  must(!!jobP?.id, "the LoG autopick job exists");
  must((await mkEdge(importJob.id, jobP.id, "micrographs", "micrographs")) >= 200, "import → LoG wired");
  await dispatchRemote(jobP.id, "the LoG autopick");
  const doneP = await pollUntil(async () => {
    const j = await readJob(jobP.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneP?.status === "completed", `the cluster LoG autopick completes (${doneP?.status}: ${(doneP?.result ?? "").slice(0, 60)})`);

  // C4 — REMOTE topaztrain (the model)
  const jobT = await mkJob({ type: "topaztrain", name: "t882 Topaz Train" });
  must(!!jobT?.id, "the topaztrain job exists");
  must((await mkEdge(importJob.id, jobT.id, "micrographs", "micrographs")) >= 200, "import → train wired (micrographs)");
  must((await mkEdge(jobP.id, jobT.id, "coords", "coords")) >= 200, "LoG picks → train wired (the training-pick SOURCE, t265's port pair)");
  await dispatchRemote(jobT.id, "the topaz train");
  const doneT = await pollUntil(async () => {
    const j = await readJob(jobT.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneT?.status === "completed", `the cluster topaztrain completes (${doneT?.status}: ${(doneT?.result ?? "").slice(0, 60)})`);
  const recT = stateRuns()[jobT.id];
  const mirrorT = `/home/z/my-project/data/relion/${projId}/topaztrain_${jobT.id.slice(-8)}`;
  must(existsSync(path.join(mirrorT, "topaz_model.sav")), "topaz_model.sav synced back to the local mirror");

  // C5 — REMOTE autopick Topaz with the model WIRED (the consumption leg)
  const jobA = await mkJob({ type: "autopick", name: "t882 AutoPick Topaz", params: { pickingMethod: "Topaz" } });
  must(!!jobA?.id, "the Topaz autopick job exists");
  must((await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs")) >= 200, "import → topaz picker wired (micrographs)");
  must((await mkEdge(jobT.id, jobA.id, "model", "topazModel")) >= 200, "the TRAINED model wired into the picker (topazModel)");
  await dispatchRemote(jobA.id, "the Topaz autopick");
  const doneA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneA?.status === "completed", `the cluster Topaz autopick completes (${doneA?.status}: ${(doneA?.result ?? "").slice(0, 60)})`);

  // THE CONSUMPTION WITNESS — the cluster run.out carries the load lines
  const recA = stateRuns()[jobA.id];
  const argvA = String(recA?.cmd ?? "");
  must(
    /--topaz_model \S*topaztrain_\S+\/topaz_model\.sav/.test(argvA),
    `the argv carries the trainer's model (${argvA.match(/--topaz_model (\S+)/)?.[1] ?? "absent"})`
  );
  const remoteWd = recA?.remote?.remoteWorkdir ?? null;
  const runOut = remoteWd ? mockExec(`bash -lc "cat ${remoteWd}/run.out 2>/dev/null"`).stdout : "";
  must(runOut.includes("Loading trained Topaz model: topaz_model.sav"), "THE WITNESS: the cluster run.out announces the trained model's load");
  must(runOut.includes("Topaz picking with the TRAINED model"), "THE WITNESS: the TRAINED lane line rides the live run");
  // the per-mic lines speak the trained dialect on BOTH branches: the REAL
  // detection branch carries "(trained Topaz model, cryo polarity)", the
  // synthetic fallback carries "(trained model)" — this fixture's staged
  // mics ride the synthetic branch on the cluster lane (the local lane's
  // REAL-detection receipt is t380/t382's own witness)
  must(
    /particles picked \(trained model\)|REAL dark-blob picks \(trained Topaz model/.test(runOut),
    "the per-mic lines speak the trained dialect"
  );
  must(
    (doneA?.result ?? "").includes("particles picked across 4 micrographs"),
    `the picks are counted from the synced per-mic stars (${(doneA?.result ?? "").slice(0, 70)})`
  );

  // the synced pick stars carry the trained lane's FOM (0.41x)
  const mirrorA = `/home/z/my-project/data/relion/${projId}/autopick_${jobA.id.slice(-8)}/micrographs`;
  const starFile = existsSync(mirrorA) ? (await import("node:fs")).readdirSync(mirrorA).find((f) => f.endsWith("_autopick.star")) : null;
  let fomOk = false;
  let fomGot = "?";
  if (starFile) {
    const row = readFileSync(path.join(mirrorA, starFile), "utf8")
      .split("\n").find((l) => /^[0-9]/.test(l.trim()));
    fomGot = row?.split("\t")[2] ?? "?";
    fomOk = /^0\.41\d?$/.test(fomGot ?? "");
  }
  must(fomOk, `the synced pick stars ride the trained FOM lane (got ${fomGot})`);

  // the inspector's face — the picker's command line names the model
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true }).catch(() => {});
    await sleep(1200);
    await page.screenshot({ path: `${SHOTS}/t882-topaz-model-face.png` });
    must(existsSync(`${SHOTS}/t882-topaz-model-face.png`), "the trained-model picker's inspector photographed");
  } catch (e) {
    must(false, `the inspector ride failed: ${String(e).slice(0, 80)}`);
  }

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);
} catch (e) {
  must(false, `the live loop crashed: ${String(e).slice(0, 160)}`);
} finally {
  console.log("== cleanup ==");
  if (browser) { try { await browser.close(); } catch { /* gone */ } }
  try {
    if (prevActiveProjectId) {
      await fetch(`${BASE}/api/projects/switch`, { method: "POST", headers: SH, body: JSON.stringify({ id: prevActiveProjectId }) }).catch(() => {});
    }
    if (fixtureProjectId) {
      await fetch(`${BASE}/api/projects/${fixtureProjectId}`, { method: "DELETE", headers: SH }).catch(() => {});
    }
    for (const id of [...createdJobs].reverse()) {
      await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => {});
    }
    for (const cid of [...connIds].reverse()) {
      await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH }).catch(() => {});
    }
    let worldProtect = [];
    try {
      const wj = await api("GET", "/api/jobs");
      worldProtect = worldProtectBasenames(wj.body?.jobs ?? [], createdJobs);
    } catch { /* the API is gone — the glob degrades to plain rm */ }
    console.log(worldGuardLine(worldProtect.length));
    const parts = [
      worldSafeRmScript([`${CLUSTER_TREE}/*/topaztrain_*`, `${CLUSTER_TREE}/*/autopick_*`], worldProtect),
      fixtureProjectId ? `rm -rf ${CLUSTER_TREE}/${fixtureProjectId} 2>/dev/null || true` : ": no project shell",
    ];
    mockExec(`bash -lc "${parts.join("; ").replace(/"/g, '\\"')}"`);
  } catch { /* best effort */ }
  try { rmSync(FIXTURE, { recursive: true, force: true }); } catch { /* gone */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
}

console.log(fail === 0 ? "\nt882: ALL PASS" : `\nt882: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;

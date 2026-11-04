// t884-topaz-pick-delta.mjs — the Topaz deepening's next cut: the TRAINED
// MODEL's PICK DELTA (the recall lift), the count dialect keyed to the
// trained lane.
//
// t882 closed the consumption face: the model is LOADED and announced, the
// FOM lane lifts 0.32 -> 0.41, a missing model dies clean. But the COUNT
// was lane-blind — the same number of picks under the general model and the
// trained one. A trained CNN's virtue is RECALL: it recovers picks the
// general model misses. t884 grows the rig the pick delta: on the synthetic
// fallback the trained lane recovers +2 picks per micrograph (folded INTO
// `picks`, so the done-line total rides the same variable on both branches
// — same star, two lanes, delta = lift x n_mics); the REAL-detection branch
// keeps t882's own law (same blobs, higher scores — a model does not invent
// blobs it cannot see, it scores them).
//
//   A  the rig's contract on disk — the lift line, the fold, the real
//      branch untouched, the t882 dialect substrings intact
//   B  UNIT-DIRECT on the compute side (test-client over SSH, no app
//      machinery): the DELTA design on a 3-mic synthetic star (general
//      total T, trained total T + 2*3, per-mic +2 exactly, the appended
//      rows ride the FOM formula's continuation), the load-face recall
//      announcement, and the REAL-branch arm (a blob-field mic generated
//      on the mock: SAME count both lanes, the FOM lane shifts)
//   C  the LIVE loop through the app (fixture project, four mics, the
//      t882 shape): the cluster run.out carries the three-line witness
//      (load / TRAINED lane / recall lift), the rig's done line carries
//      76 (= 68 + 2x4), the app's own result string carries the lifted
//      count, the synced stars ride 19+22+16+19 with the 0.410 first row
//   D  console clean
//
// Run: node scripts/t884-topaz-pick-delta.mjs   (server on :3000, mock :3022)
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor(); // t708 — write routes reject headerless clients once the door activates
import { spawnSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";
import { worldProtectBasenames, worldSafeRmScript, worldGuardLine } from "./lib/world-safe-cleanup.mjs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const SHOTS = `${ROOT}/shots-qa`;
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const FIXTURE = `${ROOT}/data/relion/t884-mics`;
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

// ---- Phase A: the rig's contract on disk ----------------------------------
console.log("== PHASE A: the rig's pick-delta contract ==");
{
  const src = readFileSync(RIG, "utf8");
  must(src.includes('print("Trained-model recall lift: +2 picks per micrograph over the general model")'),
    "the load-face carries the recall-lift announcement");
  must(/if trained_model:\n\s+picks \+= 2/.test(src),
    "the lift folds INTO picks on the synthetic branch (the done-line total rides the same variable)");
  must(src.includes("picks = len(real_picks)"),
    "the REAL branch's count is still the detection's own (picks = len(real_picks))");
  must(!/picks = len\(real_picks\)[\s\S]{0,200}\+= 2/.test(src),
    "the REAL branch carries NO lift (a model does not invent blobs it cannot see)");
  must(src.includes('f"Micrograph {n}/{len(mics)}: {base} — {picks} particles picked"'),
    "the synthetic per-mic line keeps the t882 dialect shape");
  must(src.includes('" (trained model)" if trained_model'),
    "the (trained model) suffix survives — the t882 pin's substring is intact");
  must(src.includes("0.41 if trained_model else 0.32"),
    "the t882 FOM lane law still rides both branches");
  must(src.includes('print(f"autopick done: {total} particles across {len(mics)} micrographs")'),
    "the done line is the count witness's shape");
}

// ---- Phase B: unit-direct on the compute side (the mock) ------------------
console.log("== PHASE B: unit-direct (the delta design on the mock) ==");
{
  // the exit-code channel law (t882's comment-law): run the binary DIRECTLY,
  // never echo $? through a nested bash -lc — the spawnSync status IS the
  // remote command's code, stderr travels on its own stream.
  const stage = mockExec(
    `bash -lc "printf 'data_\\n\\nloop_\\n_rlnMicrographName\\nmicrographs/mic_001.mrc\\nmicrographs/mic_002.mrc\\nmicrographs/mic_003.mrc\\n' > /tmp/t884-star.star && printf cryoflow-mock-model-bytes > /tmp/t884.sav && echo STAGED"`
  );
  must(stage.stdout.includes("STAGED"), "the scratch star + model are staged on the mock");

  const argvBase =
    "--i /tmp/t884-star.star --pickname autopick --topaz_extract " +
    "--fn_topaz_exe /opt/bin/relion_python_topaz --topaz_threshold -6 --particle_diameter 180";

  const rowsOf = (dir, mic) =>
    mockExec(`grep -c '^[0-9]' /tmp/${dir}/micrographs/${mic}_autopick.star`).stdout.trim();
  const firstFom = (dir, mic) =>
    mockExec(`grep '^[0-9]' /tmp/${dir}/micrographs/${mic}_autopick.star | head -1`).stdout.trim().split("\t")[2] ?? "?";

  // B1 — the GENERAL lane: the baseline counts
  const gen = mockExec(`rm -rf /tmp/t884-gen && relion_autopick ${argvBase} --odir /tmp/t884-gen/`);
  must(gen.code === 0, `the general arm exits 0 (got ${gen.code})`);
  must(gen.stdout.includes("Topaz picking with the GENERAL model"), "the GENERAL lane line rides run.out");
  must(!gen.stdout.includes("recall lift"), "the general lane announces NO recall lift");
  const genTotal = Number((gen.stdout.match(/autopick done: (\d+) particles/) ?? [])[1] ?? -1);
  const genCounts = ["mic_001", "mic_002", "mic_003"].map((m) => Number(rowsOf("t884-gen", m)));
  must(genTotal === genCounts.reduce((a, b) => a + b, 0),
    `the general done line agrees with the star rows (${genTotal} = ${genCounts.join("+")})`);
  must(firstFom("t884-gen", "mic_001").startsWith("0.32"), `the general FOM lane is 0.32x (got ${firstFom("t884-gen", "mic_001")})`);

  // B2 — the TRAINED lane on the SAME star: +2 per mic, appended rows ride
  // the FOM formula's continuation, the first row keeps k=0
  const trn = mockExec(`rm -rf /tmp/t884-trn && relion_autopick ${argvBase} --odir /tmp/t884-trn/ --topaz_model /tmp/t884.sav`);
  must(trn.code === 0, `the trained arm exits 0 (got ${trn.code})`);
  must(trn.stdout.includes("Loading trained Topaz model: t884.sav"), "the load line names the model");
  must(trn.stdout.includes("Trained-model recall lift: +2 picks per micrograph over the general model"),
    "THE WITNESS: the recall-lift announcement rides the load face");
  const trnTotal = Number((trn.stdout.match(/autopick done: (\d+) particles/) ?? [])[1] ?? -1);
  must(trnTotal === genTotal + 2 * 3,
    `THE COUNT WITNESS: ${genTotal} -> ${trnTotal} = lift x 3 mics (+2 each)`);
  const trnCounts = ["mic_001", "mic_002", "mic_003"].map((m) => Number(rowsOf("t884-trn", m)));
  must(
    trnCounts.every((c, i) => c === genCounts[i] + 2),
    `every micrograph recovers exactly +2 (${genCounts.join("+")} -> ${trnCounts.join("+")})`
  );
  must(trnCounts.reduce((a, b) => a + b, 0) === trnTotal, "the trained star rows sum to the trained done line");
  must(firstFom("t884-trn", "mic_001").startsWith("0.41"), `the trained FOM lane is 0.41x (got ${firstFom("t884-trn", "mic_001")})`);
  // the APPENDED rows (k = genCounts[0], genCounts[0]+1) continue the formula:
  // fom = 0.41 + 0.05 * (k % 5)
  const appRows = mockExec(
    `grep '^[0-9]' /tmp/t884-trn/micrographs/mic_001_autopick.star | sed -n '${genCounts[0] + 1},${genCounts[0] + 2}p'`
  ).stdout.trim().split("\n");
  const wantFoms = [genCounts[0], genCounts[0] + 1].map((k) => (0.41 + 0.05 * (k % 5)).toFixed(3));
  const gotFoms = appRows.map((r) => r.split("\t")[2]);
  must(
    appRows.length === 2 && gotFoms.every((f, i) => f === wantFoms[i]),
    `the appended rows ride the FOM formula's continuation (want ${wantFoms.join(",")}, got ${gotFoms.join(",")})`
  );
  must(/particles picked \(trained model\)/.test(trn.stdout), "the per-mic trained dialect survives the growth");

  // B3 — the REAL-branch arm: a blob-field mic generated ON the mock
  // (numpy + cf_cryo live in the rig's world). The law: SAME count both
  // lanes — a model does not invent blobs it cannot see, it scores them.
  const genPy = [
    "import sys",
    // the mock's /opt/bin is a TEXT translation, not a mount — there is no
    // literal /opt/bin on this host; the rig's own relion_autopick imports
    // cf_cryo via its __file__ dir, and the generator walks the same
    // physical path the PATH translation maps /opt/bin onto
    `sys.path.insert(0, '${ROOT}/services/mock-cluster/fs/opt/bin')`,
    "import cf_cryo, numpy as np",
    "NX = NY = 256",
    "rng = np.random.default_rng(884)",
    "img = rng.normal(100.0, 14.0, (NY, NX))",
    "for (cx, cy) in [(60,50),(170,70),(110,130),(200,170),(45,200),(150,220),(90,30),(230,110),(30,110)]:",
    "    yy, xx = np.mgrid[0:NY, 0:NX]",
    "    r2 = (xx-cx)**2 + (yy-cy)**2",
    "    img += (-98.0)*np.exp(-r2/(2*16.0**2))",
    "cf_cryo.write_mrc('/tmp/t884-real.mrc', NX, NY, 1, img.astype(np.float32), angpix=1.77)",
    "open('/tmp/t884-real.star','w').write('data_\\n\\nloop_\\n_rlnMicrographName\\n/tmp/t884-real.mrc\\n')",
    "print('STAGED-884')",
  ].join("\n");
  // the quoted heredoc — the shipping this mock proved this very window (the
  // b64 pipe decoded to a 0-byte file once; the heredoc has no encoding
  // layer to fail, and the quoted delimiter keeps python's quotes intact)
  const shp = mockExec(`python3 - <<'PYEOF'\n${genPy}\nPYEOF`);
  must(shp.stdout.includes("STAGED-884"), "the blob-field mic is generated on the mock");
  const realArgv =
    "--i /tmp/t884-real.star --pickname autopick --topaz_extract " +
    "--fn_topaz_exe /opt/bin/relion_python_topaz --particle_diameter 180";
  const rgen = mockExec(`rm -rf /tmp/t884-rgen && relion_autopick ${realArgv} --odir /tmp/t884-rgen/`);
  const rtrn = mockExec(`rm -rf /tmp/t884-rtrn && relion_autopick ${realArgv} --odir /tmp/t884-rtrn/ --topaz_model /tmp/t884.sav`);
  must(rgen.code === 0 && rtrn.code === 0, `both real-branch arms exit 0 (${rgen.code}/${rtrn.code})`);
  const rGenN = Number((rgen.stdout.match(/(\d+) REAL dark-blob picks/) ?? [])[1] ?? -1);
  const rTrnN = Number((rtrn.stdout.match(/(\d+) REAL dark-blob picks/) ?? [])[1] ?? -1);
  must(rGenN >= 3, `the real mic carries real detections (${rGenN} picks)`);
  must(rGenN === rTrnN, `THE REAL-BRANCH LAW: same blobs, same count (${rGenN} = ${rTrnN})`);
  must(/REAL dark-blob picks \(LoG .* cryo polarity\)/.test(rgen.stdout), "the general real line keeps the LoG dialect");
  must(/REAL dark-blob picks \(trained Topaz model, cryo polarity\)/.test(rtrn.stdout), "the trained real line keeps the t882 dialect");
  const rGenFom = mockExec(`grep '^[0-9]' /tmp/t884-rgen/micrographs/t884-real_autopick.star | head -1`).stdout.trim().split("\t")[2];
  const rTrnFom = mockExec(`grep '^[0-9]' /tmp/t884-rtrn/micrographs/t884-real_autopick.star | head -1`).stdout.trim().split("\t")[2];
  must(rGenFom?.startsWith("0.32") && rTrnFom?.startsWith("0.41"),
    `the real branch's FOM lane still shifts (${rGenFom} -> ${rTrnFom})`);

  mockExec("rm -rf /tmp/t884-gen /tmp/t884-trn /tmp/t884-rgen /tmp/t884-rtrn /tmp/t884-star.star /tmp/t884.sav /tmp/t884gen.py /tmp/t884-real.mrc /tmp/t884-real.star");
}

// ---- Phase C: the LIVE loop through the app -------------------------------
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
  const proj = await api("POST", "/api/projects", { name: `t884 Pick Delta ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;
  console.log(`  (live) fixture project ${fixtureProjectId}; prevActive at C0 = ${prevActiveProjectId}`);

  // C1 — four micrographs + a REAL local import
  mkdirSync(FIXTURE, { recursive: true });
  const micNames = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc"];
  for (const n of micNames) {
    // the t265 recipe — 64x64 float32 (fixture mics ride the SYNTHETIC
    // fallback on the cluster lane, where the recall lift lives)
    const W = 64, H = 64;
    const buf = Buffer.alloc(1024 + W * H * 4);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
    buf.writeInt32LE(2, 12);
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
    for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
    writeFileSync(path.join(FIXTURE, n), buf);
  }
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

  const importJob = await mkJob({ type: "import", name: "t884 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C2 — connection (the cluster's OWN topaz, t264's law)
  const connId = `qa-t884-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await api("POST", "/api/remote/connections", {
    id: connId,
    name: "QA t884 Mock",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: CLUSTER_TREE,
  });
  must(mk.status === 201, `the connection is created (got ${mk.status})`);
  const dispatchRemote = async (jobId, label) => {
    const d = await api("POST", `/api/jobs/${jobId}/run`, {
      remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" },
    });
    must(d.status === 200 || d.status === 201, `${label} dispatched to the cluster (${d.status})`);
  };
  const projId = importDone?.projectId ?? fixtureProjectId;

  // C3 — REMOTE autopick LoG (the training-pick SOURCE, t265's port pair)
  const jobP = await mkJob({ type: "autopick", name: "t884 AutoPick LoG" });
  must(!!jobP?.id, "the LoG autopick job exists");
  must((await mkEdge(importJob.id, jobP.id, "micrographs", "micrographs")) >= 200, "import → LoG wired");
  await dispatchRemote(jobP.id, "the LoG autopick");
  const doneP = await pollUntil(async () => {
    const j = await readJob(jobP.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneP?.status === "completed", `the cluster LoG autopick completes (${doneP?.status}: ${(doneP?.result ?? "").slice(0, 60)})`);

  // C4 — REMOTE topaztrain (the model)
  const jobT = await mkJob({ type: "topaztrain", name: "t884 Topaz Train" });
  must(!!jobT?.id, "the topaztrain job exists");
  must((await mkEdge(importJob.id, jobT.id, "micrographs", "micrographs")) >= 200, "import → train wired (micrographs)");
  must((await mkEdge(jobP.id, jobT.id, "coords", "coords")) >= 200, "LoG picks → train wired (the training-pick SOURCE, t265's port pair)");
  await dispatchRemote(jobT.id, "the topaz train");
  const doneT = await pollUntil(async () => {
    const j = await readJob(jobT.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneT?.status === "completed", `the cluster topaztrain completes (${doneT?.status}: ${(doneT?.result ?? "").slice(0, 60)})`);
  const mirrorT = `/home/z/my-project/data/relion/${projId}/topaztrain_${jobT.id.slice(-8)}`;
  must(existsSync(path.join(mirrorT, "topaz_model.sav")), "topaz_model.sav synced back to the local mirror");

  // C5 — REMOTE autopick Topaz with the model WIRED (the delta's live leg)
  const jobA = await mkJob({ type: "autopick", name: "t884 AutoPick Topaz", params: { pickingMethod: "Topaz" } });
  must(!!jobA?.id, "the Topaz autopick job exists");
  must((await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs")) >= 200, "import → topaz picker wired (micrographs)");
  must((await mkEdge(jobT.id, jobA.id, "model", "topazModel")) >= 200, "the TRAINED model wired into the picker (topazModel)");
  await dispatchRemote(jobA.id, "the Topaz autopick");
  const doneA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneA?.status === "completed", `the cluster Topaz autopick completes (${doneA?.status}: ${(doneA?.result ?? "").slice(0, 60)})`);

  // THE THREE-LINE WITNESS in the cluster run.out (load / TRAINED / lift)
  const recA = stateRuns()[jobA.id];
  const argvA = String(recA?.cmd ?? "");
  must(
    /--topaz_model \S*topaztrain_\S+\/topaz_model\.sav/.test(argvA),
    `the argv carries the trainer's model (${argvA.match(/--topaz_model (\S+)/)?.[1] ?? "absent"})`
  );
  const remoteWd = recA?.remote?.remoteWorkdir ?? null;
  const runOut = remoteWd ? mockExec(`bash -lc "cat ${remoteWd}/run.out 2>/dev/null"`).stdout : "";
  must(runOut.includes("Loading trained Topaz model: topaz_model.sav"), "the load line rides the live run.out");
  must(runOut.includes("Topaz picking with the TRAINED model"), "the TRAINED lane line rides the live run.out");
  must(runOut.includes("Trained-model recall lift: +2 picks per micrograph over the general model"),
    "THE WITNESS: the recall-lift announcement rides the LIVE run");
  must(/particles picked \(trained model\)/.test(runOut), "the per-mic trained dialect rides the live run.out");
  must(runOut.includes("autopick done: 76 particles across 4 micrographs"),
    `THE COUNT WITNESS (cluster side): 76 = 68 + 2x4 (${(runOut.match(/autopick done: \d+ particles across \d+ micrographs/) ?? ["absent"])[0]})`);

  // THE COUNT WITNESS (app side) — the app's own result string carries the
  // lifted total counted from the synced per-mic stars (t882's receipt was 68)
  must(
    (doneA?.result ?? "").includes("76 particles picked across 4 micrographs"),
    `THE COUNT WITNESS (app side): the result carries the lifted total (${(doneA?.result ?? "").slice(0, 70)})`
  );

  // the synced pick stars: per-mic 19+22+16+19, first-row FOM 0.410
  const mirrorA = `/home/z/my-project/data/relion/${projId}/autopick_${jobA.id.slice(-8)}/micrographs`;
  const stars = existsSync(mirrorA) ? readdirSync(mirrorA).filter((f) => f.endsWith("_autopick.star")).sort() : [];
  must(stars.length === 4, `the four synced pick stars exist (${stars.length})`);
  const perMic = stars.map((f) =>
    readFileSync(path.join(mirrorA, f), "utf8").split("\n").filter((l) => /^[0-9]/.test(l)).length
  );
  must(
    JSON.stringify(perMic) === JSON.stringify([19, 22, 16, 19]),
    `THE PER-MIC WITNESS: 19+22+16+19 = 76 (got ${perMic.join("+")})`
  );
  if (stars.length) {
    const row = readFileSync(path.join(mirrorA, stars[0]), "utf8").split("\n").find((l) => /^[0-9]/.test(l));
    const fom = row?.split("\t")[2] ?? "?";
    must(/^0\.41\d?$/.test(fom), `the first row keeps k=0's FOM 0.410 (got ${fom})`);
  }

  // the inspector's face — the picker's receipt photographed
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true }).catch(() => {});
    await sleep(1200);
    await page.screenshot({ path: `${SHOTS}/t884-topaz-pick-delta.png` });
    must(existsSync(`${SHOTS}/t884-topaz-pick-delta.png`), "the trained-model picker's inspector photographed");
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
      const sw = await fetch(`${BASE}/api/projects/switch`, { method: "POST", headers: SH, body: JSON.stringify({ id: prevActiveProjectId }) }).catch((e) => ({ status: -1, err: String(e) }));
      console.log(`  (cleanup) switch -> ${prevActiveProjectId}: ${sw.status}`);
    }
    if (fixtureProjectId) {
      /* t893 — the cleanup's own honesty: a silent 200 was a lie the
       * reaper could write (t892's residue wave: three fixtures left by
       * cleanups that printed 200 or -1 and moved on). Retry the delete
       * (the burn-then-ride law reaches the cleanup), then VERIFY the
       * registry no longer holds the fixture — the residue names itself
       * loudly so the next window's start can sweep it. */
      let dp = { status: -1 };
      for (let attempt = 1; attempt <= 3 && dp.status !== 200; attempt++) {
        dp = await fetch(`${BASE}/api/projects/${fixtureProjectId}`, { method: "DELETE", headers: SH }).catch((e) => ({ status: -1, err: String(e) }));
        if (dp.status !== 200) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
      console.log(`  (cleanup) delete fixture project: ${dp.status}${dp.status !== 200 ? ` (${dp.err ?? "non-200"})` : ""}`);
      if (dp.status === 200) {
        const reg = await fetch(`${BASE}/api/projects`, { headers: SH }).catch(() => null);
        const regBody = reg && reg.ok ? await reg.json().catch(() => null) : null;
        const stillThere = (regBody?.projects ?? []).some((p) => p.id === fixtureProjectId);
        if (stillThere) console.log(`  (cleanup) RESIDUE LEFT: fixture ${fixtureProjectId} survived the delete — sweep before the next ride`);
        else console.log(`  (cleanup) VERIFIED: fixture gone from the registry`);
      } else {
        console.log(`  (cleanup) RESIDUE LEFT: fixture ${fixtureProjectId} not deleted — sweep before the next ride`);
      }
    }
    for (const id of [...createdJobs].reverse()) {
      const dj = await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch((e) => ({ status: -1, err: String(e) }));
      if (dj.status !== 200 && dj.status !== 404) console.log(`  (cleanup) delete job ${id}: ${dj.status}`);
    }
    for (const cid of [...connIds].reverse()) {
      const dc = await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH }).catch((e) => ({ status: -1, err: String(e) }));
      if (dc.status !== 200 && dc.status !== 404) console.log(`  (cleanup) delete conn ${cid}: ${dc.status}`);
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

console.log(fail === 0 ? "\nt884: ALL PASS" : `\nt884: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;

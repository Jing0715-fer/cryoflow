// t888-topaz-train-conversation.mjs — THE TRAIN CONVERSATION'S OWN LEG.
//
// t887 walked the PICK conversation: the rig spawns <topaz_exe> extract
// per micrograph and the rows are born in the wrapper. But the module's
// TRAIN face — reachable through the bin wrapper's door since that same
// window — was still called by NOBODY: the rig's train mode simulated its
// five epochs in its own body. t888 walks the choreography real RELION's
// trainTopaz (autopicker.cpp:2957) composes:
//
//     <fn_topaz_exe> train -n <nr> -r <radius> -o <odir>model_training.txt
//     --train-images <star> --train-targets <coords index>
//     --save-prefix <odir>model
//
// the rig spawns, the wrapper (the module's train face, keyed on
// --train-images AND --train-targets) trains, and the epoch dialect, the
// model bytes, the plot and the closing line are born across the boundary;
// the rig forwards the subprocess's stdout into run.out and verifies the
// model landed (exit 0 <=> the model exists — the app's topazSilentFail
// gate reads the same contract from the other side). THE MIGRATION'S LAW,
// one process further out: every number crosses BYTE-IDENTICALLY — the
// conversation's model and the bare in-body model are cmp-equal, so the
// t265-era contract (entries/mics/loss header + the 768-byte body), the
// app's collectOutputs, the training parser and the silent-fail gate all
// read the same bytes they always have.
//
//   A  the conversation's contract on disk — the rig's spawn/forward/verify
//      + the bare-train fallback, the module's conversation keying + the
//      standalone face, the wrapper's dual routing (t887), AND the t887
//      pick-lane pins re-asserted (that conversation untouched)
//   B  UNIT-DIRECT on the compute side (test-client over SSH): B1 the
//      conversation arm (exit 0, the wrapper's filler + five epoch pairs +
//      the closing line forwarded, the model header entries=3 mics=3
//      loss=0.1200, the modelepochN.sav checkpoints, model_training.txt,
//      the plot), B2 the bare in-body arm ((bare topaz) head line, no
//      filler) + THE CROSS-BOUNDARY BYTE LAW (cmp: model AND plot
//      identical), B3 the honest deaths (a nonexistent exe exits 1 naming
//      it; a missing picks file exits 1 before any spawn)
//   C  the LIVE leg through the app (fixture project, import 4 mics → LoG
//      autopick → topaztrain, the t882 wiring): the cluster run.out
//      carries the WRAPPER'S VOICE (the filler + the epochs — the
//      subprocess actually ran on the cluster), the mirror's topaz_model.sav
//      header parses entries=… mics=4 loss=0.1200 (the numbers born in the
//      wrapper), the plot syncs back, the checkpoints exist remotely, the
//      inspector photographed
//   D  console clean
//
// Run: node scripts/t888-topaz-train-conversation.mjs   (server :3000, mock :3022)
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
const FIXTURE = `${ROOT}/data/relion/t888-mics`;
const RIG = `${ROOT}/services/mock-cluster/fs/opt/bin/relion_autopick`;
const WRAP = `${ROOT}/services/mock-cluster/fs/opt/bin/relion_python_topaz`;
const MOD = `${ROOT}/services/mock-cluster/fs/opt/pythons/topaz/main.py`;
const CLIENT = "services/mock-cluster/test-client.mjs";
const CLUSTER_TREE = "/projects/cryoflow";
const MOCK_PORT = 3022;

let fail = 0;
let pass = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (cond) pass++;
  else fail++;
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
  const r = spawnSync("node", [CLIENT, cmd], { cwd: ROOT, encoding: "utf8", timeout: 90_000 });
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
  spawnSync("node", ["services/mock-cluster/server.mjs"], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
  });
  weLaunchedMock = true;
  for (let i = 0; i < 40; i++) {
    if (await mockListening()) break;
    await sleep(250);
  }
}

console.log("== PHASE A: the conversation's contract on disk ==");
{
  must(existsSync(RIG), "the rig's relion_autopick is on disk");
  must(existsSync(WRAP), "the bin wrapper relion_python_topaz is on disk");
  must(existsSync(MOD), "the topaz module main.py is on disk");
  const rig = readFileSync(RIG, "utf8");
  const wrap = readFileSync(WRAP, "utf8");
  const mod = readFileSync(MOD, "utf8");

  // the rig: the train conversation itself
  must(rig.includes("def _topaz_train_conversation():"), "the rig walks the train conversation (the function exists)");
  must(rig.includes('exe, "train",'), "the spawn composes the exe's train subcommand");
  must(rig.includes('"--train-images", star_in'), "the images handle rides --train-images (real trainTopaz's own argv)");
  must(rig.includes('"--train-targets", _picks'), "the targets handle rides --train-targets (the coords index)");
  must(rig.includes('"--save-prefix", os.path.join(odir, "model")'), "the save-prefix composes <odir>model (real topaz's checkpoint shape)");
  must(rig.includes('os.path.join(odir, "model_training.txt")'), "the -o table rides model_training.txt (real trainTopaz's own name)");
  must(rig.includes('f"{float(opts.get(\'particle_diameter\', \'200\') or 200) / 2.0:.1f}"'), "the radius is the diameter's half (-r, real trainTopaz's shape)");
  must(rig.includes("print(cp.stdout, end=\"\")") || rig.includes("print(cp.stdout, end='')"), "the subprocess's stdout is forwarded (the wrapper's voice rides run.out)");
  must(rig.includes("ERROR: topaz train finished but no model landed"), "THE BOUNDARY GATE: exit 0 only when the model exists (the topazSilentFail law from the rig's side)");

  // the bare-train fallback: the in-body face survives, byte-identical
  must(rig.includes("if topaz_exe:\n        _topaz_train_conversation()\n        sys.exit(0)"), "the conversation gates on the exe's presence");
  must(rig.includes("loss = 0.62"), "the bare train keeps the in-body face (the standalone shape)");
  must(rig.includes('f"entries={entries} mics={len(mics)} loss={loss:.4f}\\n"'), "the in-body model header keeps the rig's own byte law");
  must(rig.includes("b\"CRYOFLOW-MOCK-TOPAZ-MODEL-v1\\n\""), "the model's magic line rides both faces");
  must(rig.includes('"89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"'), "the plot's PNG hex stays (the conversation writes the same bytes)");

  // the shared resolver: ONE definition, above both conversations
  must(rig.split("def _resolve_topaz_exe():").length === 2, "the exe resolver is defined exactly once (shared by both conversations)");
  must(rig.indexOf("def _resolve_topaz_exe():") < rig.indexOf("# ---- TRAINING face"), "the resolver lives ABOVE the training face (both conversations reach it)");

  // the module: the conversation keying + the standalone face
  must(mod.includes('if a == "--train-images" and i + 1 < len(argv):'), "the module parses --train-images");
  must(mod.includes('if a == "--train-targets" and i + 1 < len(argv):'), "the module parses --train-targets");
  must(mod.includes("conversation = train_images is not None and train_targets is not None"), "THE KEYING: the conversation lane rides both handles (real RELION always composes them)");
  must(mod.includes('f"entries={entries} mics={mics} loss={loss:.4f}\\n".encode()'), "the conversation header carries the rig's byte law (entries/mics/loss)");
  must(mod.includes("loss = rows[-1][2]"), "the loss is the last epoch's (0.1200 after five)");
  must(mod.includes('"cryoflow-mock topaz train: cannot write'), "a failed model write dies loud (the model is the run's product)");
  must(mod.includes('"-n", "--num-particles", "-r", "--particle-radius",'), "the harmless flags parse and step over (-n/-r, the extract face's own law)");
  must(mod.includes("elif model and not os.path.exists(model):"), "the standalone face writes only when absent (t534 byte-exact)");
  must(mod.includes('print("Topaz model trained (5 epochs) — connect it into Auto-picking (Topaz mode)")'), "the closing line rides the module's voice (both lanes)");

  // the wrapper: the dual routing (t887) still holds
  must(wrap.includes('args[0] in ("extract", "train", "denoise")'), "the wrapper routes extract AND train to the module (t887's door, now walked; t889: denoise joined)");
  must(wrap.includes("from topaz.main import main as module_main"), "the delegation is a thin exec of the module (the real conda wrapper's shape)");

  // the t887 pick-lane pins STILL hold (that conversation untouched)
  must(rig.includes("if topaz_mode and topaz_exe and not train_mode:"), "the t887 pin: the PICK conversation gates on the pick lane");
  must(rig.includes("def _topaz_extract_conversation("), "the t887 pin: the extract conversation survives");
  must(mod.includes("nr = 14 + ((rank * 3) % 9) + (2 if model else 0)"), "the t887 pin: THE COUNT LAW lives in the wrapper");
  must(mod.includes("1.0 - k / float(nr)"), "the t887 pin: the standalone t535 extract face is byte-exact");
}

// ---- Phase B: unit-direct on the compute side ----------------------------
console.log("== PHASE B: unit-direct (the conversation's arms on the mock) ==");
{
  const stage = mockExec(
    `bash -lc "printf 'data_\\n\\nloop_\\n_rlnMicrographName\\nmic_001.mrc\\nmic_002.mrc\\nmic_003.mrc\\n' > /tmp/t888-star.star && printf 'data_\\n\\nloop_\\n_rlnCoordinateFile\\nmic_001_autopick.star\\nmic_002_autopick.star\\nmic_003_autopick.star\\n' > /tmp/t888-picks.star && echo STAGED"`
  );
  must(stage.stdout.includes("STAGED"), "the scratch star + picks index are staged on the mock");
  const argvBase =
    "--i /tmp/t888-star.star --odir /tmp/t888-conv/ --pickname autopick --topaz_train " +
    "--fn_topaz_exe /opt/bin/relion_python_topaz --topaz_train_picks /tmp/t888-picks.star " +
    "--topaz_nr_particles 100 --topaz_threshold -6 --particle_diameter 180 --topaz_test_ratio 0.2";

  // B1 — the CONVERSATION arm: the epochs, the model and the plot born
  // across the boundary
  const conv = mockExec(`rm -rf /tmp/t888-conv && relion_autopick ${argvBase}`);
  must(conv.code === 0, `the conversation arm exits 0 (got ${conv.code})`);
  must(conv.stdout.includes("cryoflow-mock autopick: topaz TRAIN via /opt/bin/relion_python_topaz — 3 micrograph(s), 3 coordinate-file entr(ies), nr_particles=100, test_ratio=0.2"),
    "the rig's head line rides first (the rig's own voice, the argv reading)");
  must(conv.stdout.includes("topaz training session (cryoflow-mock)"),
    "THE CONVERSATION WITNESS: the wrapper's filler line rides (the subprocess actually ran)");
  must((conv.stdout.match(/## epoch \d+ training loss=/g) ?? []).length === 5,
    "five epoch pairs speak the wild shape (the dialect is the module's own)");
  must((conv.stdout.match(/## test loss=/g) ?? []).length === 5, "the held-out split rides on its own ## test lines");
  must(conv.stdout.includes("Topaz model trained (5 epochs) — connect it into Auto-picking (Topaz mode)"),
    "the closing line rides the wrapper's voice (forwarded, not re-spoken)");
  const hdr = mockExec(`bash -lc "head -2 /tmp/t888-conv/topaz_model.sav | tr '\\n' '|'"`).stdout;
  must(hdr.startsWith("CRYOFLOW-MOCK-TOPAZ-MODEL-v1|entries=3 mics=3 loss=0.1200|"),
    `THE NUMBER WITNESS: the model header carries entries=3 mics=3 loss=0.1200 (got ${hdr.slice(0, 60)})`);
  const msz = mockExec(`wc -c < /tmp/t888-conv/topaz_model.sav`).stdout.trim();
  must(msz === "826", `the model's body is the 768-byte law (29 + 29 + 768 = 826, got ${msz})`);
  const files = mockExec(`bash -lc "ls /tmp/t888-conv/ | sort | tr '\\n' ' '"`).stdout.trim();
  must(files === "model_training.txt modelepoch0.sav modelepoch1.sav modelepoch2.sav modelepoch3.sav modelepoch4.sav topaz_model.sav topaz_training_plot.png",
    `the conversation's artifacts all landed (got ${files})`);
  const tbl = mockExec(`bash -lc "grep -c '## epoch' /tmp/t888-conv/model_training.txt"`).stdout.trim();
  must(tbl === "5", `the -o table carries the training curve (5 epochs, got ${tbl})`);
  const png = mockExec(`bash -lc "head -c 4 /tmp/t888-conv/topaz_training_plot.png | od -An -tx1 | tr -d ' \\n'"`).stdout.trim();
  must(png === "89504e47", `the plot is a real PNG (magic ${png})`);

  // B2 — the BARE arm: the in-body face, byte-identical (THE CROSS-BOUNDARY
  // BYTE LAW)
  const bare = mockExec(
    `rm -rf /tmp/t888-bare && relion_autopick --i /tmp/t888-star.star --odir /tmp/t888-bare/ --pickname autopick --topaz_train ` +
    `--topaz_train_picks /tmp/t888-picks.star --topaz_nr_particles 100 --particle_diameter 180 --topaz_test_ratio 0.2`
  );
  must(bare.code === 0, `the bare arm exits 0 (got ${bare.code})`);
  must(bare.stdout.includes("topaz TRAIN via (bare topaz)"), "the bare head line names its own lane ((bare topaz))");
  must(!bare.stdout.includes("topaz training session (cryoflow-mock)"),
    "the bare arm speaks no filler (the in-body face's own shape)");
  must((bare.stdout.match(/## epoch \d+ training loss=/g) ?? []).length === 5, "the bare arm still speaks the five epoch pairs (the dialect unchanged)");
  const cmpModel = mockExec(`cmp /tmp/t888-conv/topaz_model.sav /tmp/t888-bare/topaz_model.sav && echo IDENTICAL`);
  must(cmpModel.code === 0 && cmpModel.stdout.includes("IDENTICAL"),
    "ONE PHYSICS, TWO MOUTHS: the conversation's model and the in-body's are cmp-IDENTICAL");
  const cmpPlot = mockExec(`cmp /tmp/t888-conv/topaz_training_plot.png /tmp/t888-bare/topaz_training_plot.png && echo IDENTICAL`);
  must(cmpPlot.code === 0 && cmpPlot.stdout.includes("IDENTICAL"), "the plot crosses byte-identically too (the same PNG on both sides)");

  // B3 — the honest deaths
  const dead = mockExec(`rm -rf /tmp/t888-dead && relion_autopick --i /tmp/t888-star.star --odir /tmp/t888-dead/ --pickname autopick --topaz_train --fn_topaz_exe /opt/bin/topaz_that_is_not --topaz_train_picks /tmp/t888-picks.star`);
  must(dead.code === 1, `a nonexistent exe exits 1 (got ${dead.code})`);
  must(dead.stderr.includes("does not exist on this host"), "the death names the missing exe (the honest diagnosis)");
  const nopicks = mockExec(`rm -rf /tmp/t888-nop && relion_autopick --i /tmp/t888-star.star --odir /tmp/t888-nop/ --pickname autopick --topaz_train --fn_topaz_exe /opt/bin/relion_python_topaz --topaz_train_picks /tmp/t888-absent.star`);
  must(nopicks.code === 1, `a missing picks file exits 1 (got ${nopicks.code})`);
  must(nopicks.stderr.includes("cannot read training picks"), "the pre-spawn death names the missing index (the rig's own law, preserved)");
}

// ---- Phase C: the LIVE leg through the app ------------------------------
console.log("== PHASE C: the live leg (import → LoG picks → topaztrain, the t882 wiring) ==");
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
  const proj = await api("POST", "/api/projects", { name: `t888 Train Conversation ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;
  console.log(`  (live) fixture project ${fixtureProjectId}; prevActive at C0 = ${prevActiveProjectId}`);

  // C1 — four micrographs + a REAL local import (the t887 recipe)
  mkdirSync(FIXTURE, { recursive: true });
  const micNames = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc"];
  for (const n of micNames) {
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

  const importJob = await mkJob({ type: "import", name: "t888 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C2 — connection (the cluster's OWN topaz, t264's law)
  const connId = `qa-t888-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await api("POST", "/api/remote/connections", {
    id: connId,
    name: "QA t888 Mock",
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

  // C3 — REMOTE autopick LoG (the training-pick SOURCE, t882's wiring)
  const jobP = await mkJob({ type: "autopick", name: "t888 AutoPick LoG" });
  must(!!jobP?.id, "the LoG autopick job exists");
  must((await mkEdge(importJob.id, jobP.id, "micrographs", "micrographs")) >= 200, "import → LoG wired");
  await dispatchRemote(jobP.id, "the LoG autopick");
  const doneP = await pollUntil(async () => {
    const j = await readJob(jobP.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneP?.status === "completed", `the cluster LoG autopick completes (${doneP?.status}: ${(doneP?.result ?? "").slice(0, 60)})`);

  // C4 — REMOTE topaztrain (THE CONVERSATION'S LIVE LEG)
  const jobT = await mkJob({ type: "topaztrain", name: "t888 Topaz Train" });
  must(!!jobT?.id, "the topaztrain job exists");
  must((await mkEdge(importJob.id, jobT.id, "micrographs", "micrographs")) >= 200, "import → train wired (micrographs)");
  must((await mkEdge(jobP.id, jobT.id, "coords", "coords")) >= 200, "LoG picks → train wired (the training-pick SOURCE, t265's port pair)");
  await dispatchRemote(jobT.id, "the topaz train");
  const doneT = await pollUntil(async () => {
    const j = await readJob(jobT.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneT?.status === "completed", `the cluster topaztrain completes (${doneT?.status}: ${(doneT?.result ?? "").slice(0, 60)})`);
  must((doneT?.result ?? "").includes("Topaz model trained"),
    "the result carries the trained verdict (the t265-era contract, unchanged)");

  // THE CONVERSATION WITNESS in the live run.out: the wrapper's own voice
  const recT = stateRuns()[jobT.id];
  const remoteWd = recT?.remote?.remoteWorkdir ?? null;
  const runOut = remoteWd ? mockExec(`bash -lc "cat ${remoteWd}/run.out 2>/dev/null"`).stdout : "";
  must(runOut.includes("topaz training session (cryoflow-mock)"),
    "THE LIVE WITNESS: the wrapper's filler line rides the cluster run.out (the subprocess ran ON the cluster)");
  must((runOut.match(/## epoch \d+ training loss=/g) ?? []).length === 5,
    "five epoch pairs ride the live run.out (the training parser's dialect, born in the wrapper)");
  must(runOut.includes("Topaz model trained (5 epochs) — connect it into Auto-picking (Topaz mode)"),
    "the closing line rides the live run.out (forwarded through the rig)");
  must(/topaz TRAIN via \S*relion_python_topaz/.test(runOut), "the rig's head line names the cluster's own topaz (the probe's login-shell resolution: the physical fs path, basename law — t882's C2 pin)");
  const ckpt = remoteWd ? mockExec(`bash -lc "ls ${remoteWd}/modelepoch*.sav 2>/dev/null | wc -l"`).stdout.trim() : "0";
  must(ckpt === "5", `the five epoch checkpoints exist on the cluster (real topaz's own shape, got ${ckpt})`);

  // THE BOUNDARY'S RECEIPT: the synced-back model header carries the
  // numbers born in the wrapper (mics=4 — the import's four mic rows)
  const mirrorT = `/home/z/my-project/data/relion/${projId}/topaztrain_${jobT.id.slice(-8)}`;
  must(existsSync(path.join(mirrorT, "topaz_model.sav")), "topaz_model.sav synced back to the local mirror");
  const mirrorHdr = readFileSync(path.join(mirrorT, "topaz_model.sav"), "utf8").split("\n").slice(0, 2);
  must(mirrorHdr[0] === "CRYOFLOW-MOCK-TOPAZ-MODEL-v1", `the mirror model's magic line rides (${mirrorHdr[0]})`);
  must(/^entries=\d+ mics=4 loss=0\.1200$/.test(mirrorHdr[1] ?? ""),
    `THE HEADER WITNESS: entries=<n> mics=4 loss=0.1200 — the numbers born across the boundary (got "${mirrorHdr[1] ?? "?"}")`);
  must(existsSync(path.join(mirrorT, "topaz_training_plot.png")), "the training plot synced back (the module's PNG, same bytes)");

  // the inspector's face — the conversation's train receipt photographed
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await page.locator(`[data-job="${jobT.id}"]`).first().click({ force: true }).catch(() => {});
    await sleep(1200);
    await page.screenshot({ path: `${SHOTS}/t888-topaz-train-conversation.png` });
    must(existsSync(`${SHOTS}/t888-topaz-train-conversation.png`), "the conversation's train inspector photographed");
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
      worldSafeRmScript([`${CLUSTER_TREE}/*/autopick_*`, `${CLUSTER_TREE}/*/topaztrain_*`], worldProtect),
      fixtureProjectId ? `rm -rf ${CLUSTER_TREE}/${fixtureProjectId} 2>/dev/null || true` : ": no project shell",
    ];
    mockExec(`bash -lc "${parts.join("; ").replace(/"/g, '\\"')}"`);
    mockExec(`rm -rf /tmp/t888-conv /tmp/t888-bare /tmp/t888-dead /tmp/t888-nop /tmp/t888-star.star /tmp/t888-picks.star /tmp/t888-bare.out`);
  } catch { /* best effort */ }
  try { rmSync(FIXTURE, { recursive: true, force: true }); } catch { /* gone */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
}

console.log(`\nt888: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

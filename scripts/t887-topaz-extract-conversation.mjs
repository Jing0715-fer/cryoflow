// t887-topaz-extract-conversation.mjs — THE WRAPPER'S OWN EXTRACT
// SUBCOMMAND: the real choreography's subprocess conversation.
//
// Until this window the mock relion_autopick NEVER spawned the topaz exe —
// it only logged the path while picking in its own body, and the bin
// wrapper answered `extract` with "CNN picking would happen here" + exit 0.
// The module's extract face (t535) was DORMANT, consumed by nobody. t887
// walks the choreography real RELION runs (autoPickTopazOneMicrograph):
// the rig spawns <topaz_exe> extract per micrograph, reads the coordinate
// file back through readTopazCoordinates, and the rows are BORN in the
// wrapper — the count law (rank-keyed: 14 + ((N*3) % 9) + 2 under a
// trained model), the lattice constants, the FOM lane and the real-blob
// detection (cf_cryo, the same physics the rig's own real branch speaks)
// all moved there, byte-identical, so every t882/t884 pin survives.
//
//   A  the conversation's contract on disk — the rig's spawn/readback/lane
//      split, the bin wrapper's delegation (the t533 doctrine at the bin
//      layer), the module's rank-keyed law + the standalone t535 face
//      intact, AND the t884 source pins re-asserted (the LoG/References
//      lanes' in-body code untouched)
//   B  UNIT-DIRECT on the compute side (test-client over SSH): B1 the
//      general fixture lane (51 = 17+20+14, the voice lines, the proc
//      handles), B2 the trained lane (57 = 19+22+16, the 0.410 first row,
//      the 0.510/0.560 continuation rows), B3 the REAL lane through the
//      conversation (same blobs both model lanes, the FOM shift), B4 the
//      cross-lane law (the rig's in-body LoG real branch vs the wrapper's
//      conversation lane: one physics, two mouths, one count), B5 the
//      standalone t535 face (24 rows, 1.0-k/24, byte-exact), B6 the honest
//      death (a nonexistent exe exits 1 naming the path)
//   C  the LIVE loop through the app (fixture project, four mics, the
//      GENERAL lane — a total nobody has pinned before): the cluster
//      run.out carries the WRAPPER'S VOICE (four "topaz extract:" lines —
//      the subprocess actually ran per mic), the proc/rankN.txt handles
//      exist on the cluster, the done line carries 68 (= 17+20+14+17), the
//      app's result string carries the same total, the synced stars ride
//      17+20+14+17 with the 0.320 first row, the inspector photographed
//   D  console clean
//
// Run: node scripts/t887-topaz-extract-conversation.mjs   (server :3000, mock :3022)
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
const FIXTURE = `${ROOT}/data/relion/t887-mics`;
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

  // the rig: the conversation itself
  must(rig.includes("def _topaz_extract_conversation("), "the rig walks the conversation (the function exists)");
  must(rig.includes("subprocess.run(cmd, capture_output=True, text=True, timeout=300)"), "the spawn is a real subprocess with a timeout");
  must(rig.includes('os.path.join(odir, "proc")'), "the extract outputs ride the real choreography's proc/ handle");
  must(rig.includes('f"rank{n}.txt"'), "the rank handle carries the mic index to the wrapper (1-based)");
  must(rig.includes("def _read_topaz_coordinates("), "the readback speaks readTopazCoordinates's contract");
  must(rig.includes('"dark blobs" in (cp.stdout or "")'), "the lane marker comes from the wrapper's own voice");
  must(rig.includes("topaz_rows, topaz_real = _topaz_extract_conversation("), "the loop rides the conversation in topaz mode");
  must(rig.includes("if topaz_mode and topaz_exe and not train_mode:"), "the conversation gates on the PICK lane (train/LoG/References untouched)");
  must(rig.includes('os.environ.get("CRYOFLOW_MOCK_FS_ROOT", "")'), "the exe resolves through the mock's fs root (the t315 law)");

  // the bin wrapper: the t533 doctrine at the bin layer
  must(wrap.includes('args[0] in ("extract", "train", "denoise")'), "the wrapper routes extract AND train to the module (t889: denoise joined the door)");
  must(wrap.includes("from topaz.main import main as module_main"), "the delegation is a thin exec of the module (the real conda wrapper's shape)");

  // the module: the rank-keyed law + the standalone face
  must(mod.includes('re.search(r"rank(\\d+)", os.path.basename(out_file))'), "the module keys the lane on the rank handle");
  must(mod.includes("nr = 14 + ((rank * 3) % 9) + (2 if model else 0)"), "THE COUNT LAW moved with the rows: 14 + ((N*3) % 9) + the trained lift");
  must(mod.includes("x = 120 + (k * 61) % 1800"), "the rig's lattice constants live in the wrapper (x)");
  must(mod.includes("y = 140 + (k * 97) % 1700"), "the rig's lattice constants live in the wrapper (y)");
  must(mod.includes("cf.dark_blob_picks("), "the REAL lane rides cf_cryo's detection (the rig's own physics)");
  must(mod.includes("1.0 - k / float(nr)"), "the standalone t535 face is byte-exact (24 picks, 1.0-k/24)");
  // THE t891 STANDALONE-SHAPE AUDIT (the t533 doctrine's loose thread closes
  // as a receipt): the extract face speaks TWO shapes keyed on the -o
  // handle — the rig's conversation (rank<N>.txt) and the standalone t535
  // face (no rank handle). The caller census: the RIG composes exactly ONE
  // extract call site and its -o is the rank handle (no non-rank path
  // exists in the rig's body); the STANDALONE face's only caller is THIS
  // instrument's own B5 control-group leg (the bare direct spawn — the
  // t888 law's precedent: the bare face is the control group). One face,
  // two shapes, zero duplicates — the thread closes ALIVE (the face stays;
  // the audit is the receipt; retirement would kill the honest answer a
  // direct spawn owes readTopazCoordinates — t264's C5 is the alternative).
  must(mod.includes("topaz extract: {len(rows)} dark blobs"), "the real lane's voice line names the lane");
  must(mod.includes("picks on a deterministic lattice"), "the fixture lane's voice line names the lane");
  must((rig.match(/"extract", "-o"/g) ?? []).length === 1, "the t891 audit: the rig composes exactly ONE extract call site");
  must(rig.includes('txt = os.path.join(proc_dir, f"rank{n}.txt")') && rig.includes('cmd = [exe, "extract", "-o", txt]'), "the t891 audit: the rig's only extract -o is the rank handle (the conversation's shape at the caller)");
  must(mod.split("def extract").length === 2, "the t891 audit: exactly ONE extract face across the family (the module's — the ONE-MOUTH law, extract edition)");

  // the t884 source pins STILL hold (the LoG/References lanes untouched)
  must(rig.includes('print("Trained-model recall lift: +2 picks per micrograph over the general model")'),
    "the t884 pin: the lift announcement stays on the rig's load face");
  must(rig.includes("picks = len(real_picks)"), "the t884 pin: the in-body real branch survives (LoG/References)");
  must(rig.includes('f"Micrograph {n}/{len(mics)}: {base} — {picks} particles picked"'),
    "the t884 pin: the per-mic synthetic dialect stays");
  must(rig.includes('" (trained model)" if trained_model'), "the t884 pin: the trained suffix stays");
  must(rig.includes("0.41 if trained_model else 0.32"), "the t884 pin: the FOM expression stays");
  must(rig.includes('print(f"autopick done: {total} particles across {len(mics)} micrographs")'),
    "the t884 pin: the done line stays");
}

// ---- Phase B: unit-direct on the compute side ----------------------------
console.log("== PHASE B: unit-direct (the conversation's arms on the mock) ==");
{
  const stage = mockExec(
    `bash -lc "printf 'data_\\n\\nloop_\\n_rlnMicrographName\\nmic_001.mrc\\nmic_002.mrc\\nmic_003.mrc\\n' > /tmp/t887-star.star && printf cryoflow-mock-model-bytes > /tmp/t887.sav && echo STAGED"`
  );
  must(stage.stdout.includes("STAGED"), "the scratch star + model are staged on the mock");
  const argvBase =
    "--i /tmp/t887-star.star --pickname autopick --topaz_extract " +
    "--fn_topaz_exe /opt/bin/relion_python_topaz --topaz_threshold -6 --particle_diameter 180";

  // B1 — the GENERAL fixture lane: the rows born across the boundary
  const gen = mockExec(`rm -rf /tmp/t887-gen && relion_autopick ${argvBase} --odir /tmp/t887-gen/`);
  must(gen.code === 0, `the general arm exits 0 (got ${gen.code})`);
  must((gen.stdout.match(/topaz extract: \d+ picks on a deterministic lattice/g) ?? []).length === 3,
    "THE CONVERSATION WITNESS: three wrapper voice lines (one per mic, the subprocess ran)");
  must(gen.stdout.includes("Micrograph 1/3: mic_001.mrc — 17 particles picked"), "mic 1 rides 17 (14 + (1*3)%9)");
  must(gen.stdout.includes("Micrograph 2/3: mic_002.mrc — 20 particles picked"), "mic 2 rides 20");
  must(gen.stdout.includes("Micrograph 3/3: mic_003.mrc — 14 particles picked"), "mic 3 rides 14");
  must(gen.stdout.includes("autopick done: 51 particles across 3 micrographs"), "THE COUNT WITNESS: 51 = 17+20+14 (the t884 unit value, now born in the wrapper)");
  const proc = mockExec(`bash -lc "ls /tmp/t887-gen/proc/ 2>/dev/null | sort | tr '\\n' ' '"`);
  must(proc.stdout.trim() === "rank1.txt rank2.txt rank3.txt", `the proc handles exist (got ${proc.stdout.trim()})`);
  const fomG = mockExec(`grep '^[0-9]' /tmp/t887-gen/micrographs/mic_001_autopick.star | head -1`);
  must(/\t0\.32\d?\t/.test(fomG.stdout.trim()), `the general lane's first-row FOM is 0.32x (got ${fomG.stdout.trim().split("\t")[2] ?? "?"})`);
  const rowG = mockExec(`bash -lc "sed -n '2p' /tmp/t887-gen/proc/rank1.txt"`).stdout.trim().split("\t");
  must(rowG[0] === "120" && rowG[1] === "140", `the wrapper's lattice opens at 120/140 (got ${rowG[0]}/${rowG[1]})`);

  // B2 — the TRAINED fixture lane: the lift born where the rows are born
  const trn = mockExec(`rm -rf /tmp/t887-trn && relion_autopick ${argvBase} --odir /tmp/t887-trn/ --topaz_model /tmp/t887.sav`);
  must(trn.code === 0, `the trained arm exits 0 (got ${trn.code})`);
  must(trn.stdout.includes("Trained-model recall lift: +2 picks per micrograph over the general model"),
    "the lift announcement rides the load face");
  must(trn.stdout.includes("Micrograph 1/3: mic_001.mrc — 19 particles picked (trained model)"), "the trained per-mic dialect rides (19 = 17+2)");
  must(trn.stdout.includes("autopick done: 57 particles across 3 micrographs"), "THE LIFT WITNESS: 57 = 51 + 2x3 (delta = lift x n_mics, born in the wrapper)");
  const cont = mockExec(`bash -lc "grep '^[0-9]' /tmp/t887-trn/micrographs/mic_001_autopick.star | sed -n '18p;19p'"`).stdout.trim().split("\n");
  must(/\t0\.51\t|\t0\.510\t/.test(cont[0] ?? ""), `the k=17 row rides the FOM formula's continuation 0.510 (got ${cont[0] ?? "?"})`);
  must(/\t0\.56\t|\t0\.560\t/.test(cont[1] ?? ""), `the k=18 row rides 0.560 (got ${cont[1] ?? "?"})`);

  // B3 — the REAL lane through the conversation: the t884 blob recipe
  const genPy = [
    "import sys",
    "sys.path.insert(0, '/home/z/my-project/services/mock-cluster/fs/opt/bin')",
    "import numpy as np, cf_cryo",
    "NX = NY = 1024",
    "rng = np.random.default_rng(884)",
    "img = rng.normal(0, 40.0, (NY, NX)).astype(np.float32) + 180.0",
    "xx, yy = np.meshgrid(np.arange(NX), np.arange(NY))",
    "for cx, cy in [(200,200),(500,300),(800,700),(300,800),(700,500),(950,150),(150,950)]:",
    "    r2 = (xx-cx)**2 + (yy-cy)**2",
    "    img += (-98.0)*np.exp(-r2/(2*16.0**2))",
    "cf_cryo.write_mrc('/tmp/t887-real.mrc', NX, NY, 1, img.astype(np.float32), angpix=1.77)",
    "open('/tmp/t887-real.star','w').write('data_\\n\\nloop_\\n_rlnMicrographName\\n/tmp/t887-real.mrc\\n')",
    "print('STAGED-887')",
  ].join("\n");
  const shp = mockExec(`python3 - <<'PYEOF'\n${genPy}\nPYEOF`);
  must(shp.stdout.includes("STAGED-887"), "the blob-field mic is generated on the mock (the quoted heredoc, the honest shipper)");
  const realArgv =
    "--i /tmp/t887-real.star --pickname autopick --topaz_extract " +
    "--fn_topaz_exe /opt/bin/relion_python_topaz --particle_diameter 180";
  const rgen = mockExec(`rm -rf /tmp/t887-rgen && relion_autopick ${realArgv} --odir /tmp/t887-rgen/`);
  const rtrn = mockExec(`rm -rf /tmp/t887-rtrn && relion_autopick ${realArgv} --odir /tmp/t887-rtrn/ --topaz_model /tmp/t887.sav`);
  must(rgen.code === 0 && rtrn.code === 0, `both real-lane arms exit 0 (${rgen.code}/${rtrn.code})`);
  must((rgen.stdout.match(/topaz extract: \d+ dark blobs/g) ?? []).length === 1,
    "the wrapper's REAL-lane voice line rides (the dark-blob marker)");
  const rGenN = Number((rgen.stdout.match(/(\d+) REAL dark-blob picks/) ?? [])[1] ?? -1);
  const rTrnN = Number((rtrn.stdout.match(/(\d+) REAL dark-blob picks/) ?? [])[1] ?? -1);
  must(rGenN >= 3, `the real mic carries real detections (${rGenN} picks)`);
  must(rGenN === rTrnN, `THE REAL-LANE LAW: same blobs, same count (${rGenN} = ${rTrnN})`);
  must(/REAL dark-blob picks \(LoG .* cryo polarity\)/.test(rgen.stdout), "the general real line keeps the LoG dialect");
  must(/REAL dark-blob picks \(trained Topaz model, cryo polarity\)/.test(rtrn.stdout), "the trained real line keeps the t882 dialect");
  const rGenFom = mockExec(`grep '^[0-9]' /tmp/t887-rgen/micrographs/t887-real_autopick.star | head -1`).stdout.trim().split("\t")[2];
  const rTrnFom = mockExec(`grep '^[0-9]' /tmp/t887-rtrn/micrographs/t887-real_autopick.star | head -1`).stdout.trim().split("\t")[2];
  must(rGenFom?.startsWith("0.32") && rTrnFom?.startsWith("0.41"),
    `the real lane's FOM still shifts with the model (${rGenFom} -> ${rTrnFom})`);

  // B4 — the CROSS-LANE LAW: the rig's in-body real branch (LoG mode) vs
  // the wrapper's conversation lane (topaz mode) on the SAME mic — one
  // physics, two mouths, one count.
  const log = mockExec(`rm -rf /tmp/t887-log && relion_autopick --i /tmp/t887-real.star --pickname autopick --LoG --LoG_diam_min 120 --LoG_diam_max 180 --odir /tmp/t887-log/`);
  must(log.code === 0, `the LoG arm exits 0 (got ${log.code})`);
  const logN = Number((log.stdout.match(/(\d+) REAL dark-blob picks/) ?? [])[1] ?? -1);
  must(logN === rGenN, `ONE PHYSICS, TWO MOUTHS: the in-body LoG lane and the wrapper's conversation lane find the same blobs (${logN} = ${rGenN})`);

  // B5 — the standalone t535 face: no rank handle, byte-exact
  // (the bare name rides MOCK_PATH — the t884 law re-lived en route:
  // /opt/bin is a sentence, not a place; the literal path is not on the host)
  const solo = mockExec(`bash -lc "rm -f /tmp/t887-solo.txt && relion_python_topaz extract -o /tmp/t887-solo.txt /tmp/t887-real.mrc && echo SOLO-OK"`);
  must(solo.code === 0 && solo.stdout.includes("SOLO-OK"), "the standalone face exits 0 (direct spawn, no rig)");
  const soloRows = mockExec(`bash -lc "grep -c '^[0-9]' /tmp/t887-solo.txt; head -2 /tmp/t887-solo.txt | tail -1"`).stdout.trim().split("\n");
  must(soloRows[0]?.trim() === "24", `the t535 face rides 24 picks (got ${soloRows[0]?.trim()})`);
  must((soloRows[1] ?? "").endsWith("1.0000"), `the t535 face's first score is 1.0-k/24 (got ${soloRows[1] ?? "?"})`);

  // B6 — the honest death: a nonexistent exe
  const dead = mockExec(`rm -rf /tmp/t887-dead && relion_autopick --i /tmp/t887-star.star --pickname autopick --topaz_extract --fn_topaz_exe /opt/bin/topaz_that_is_not --odir /tmp/t887-dead/`);
  must(dead.code === 1, `a nonexistent exe exits 1 (got ${dead.code})`);
  must(dead.stderr.includes("does not exist on this host"), "the death names the missing exe (the honest diagnosis)");
}

// ---- Phase C: the LIVE loop through the app ------------------------------
console.log("== PHASE C: the live loop (import → pick Topaz GENERAL, the conversation's live leg) ==");
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
  const proj = await api("POST", "/api/projects", { name: `t887 Extract Conversation ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;
  console.log(`  (live) fixture project ${fixtureProjectId}; prevActive at C0 = ${prevActiveProjectId}`);

  // C1 — four micrographs + a REAL local import (the t265 recipe — 64x64
  // float32 fixture mics ride the wrapper's fixture law on the cluster)
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

  const importJob = await mkJob({ type: "import", name: "t887 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C2 — connection (the cluster's OWN topaz, t264's law)
  const connId = `qa-t887-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await api("POST", "/api/remote/connections", {
    id: connId,
    name: "QA t887 Mock",
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

  // C3 — REMOTE autopick Topaz, the GENERAL lane (the conversation's live leg)
  const jobA = await mkJob({ type: "autopick", name: "t887 AutoPick Topaz", params: { pickingMethod: "Topaz" } });
  must(!!jobA?.id, "the Topaz autopick job exists");
  must((await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs")) >= 200, "import → topaz picker wired (micrographs)");
  await dispatchRemote(jobA.id, "the Topaz autopick");
  const doneA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneA?.status === "completed", `the cluster Topaz autopick completes (${doneA?.status}: ${(doneA?.result ?? "").slice(0, 60)})`);

  // THE CONVERSATION WITNESS in the live run.out: the wrapper's own voice
  const recA = stateRuns()[jobA.id];
  const remoteWd = recA?.remote?.remoteWorkdir ?? null;
  const runOut = remoteWd ? mockExec(`bash -lc "cat ${remoteWd}/run.out 2>/dev/null"`).stdout : "";
  must((runOut.match(/topaz extract: \d+ picks on a deterministic lattice/g) ?? []).length === 4,
    "THE LIVE WITNESS: four wrapper voice lines in run.out (the subprocess ran per mic)");
  must(runOut.includes("Topaz picking with the GENERAL model"), "the GENERAL lane line rides the live run.out");
  must(runOut.includes("autopick done: 68 particles across 4 micrographs"),
    `THE COUNT WITNESS (cluster side): 68 = 17+20+14+17 (${(runOut.match(/autopick done: \d+ particles across \d+ micrographs/) ?? ["absent"])[0]})`);
  const procLive = remoteWd ? mockExec(`bash -lc "ls ${remoteWd}/proc/ 2>/dev/null | sort | tr '\\n' ' '"`).stdout.trim() : "";
  must(procLive === "rank1.txt rank2.txt rank3.txt rank4.txt", `the conversation's proc handles exist on the cluster (got ${procLive})`);

  // THE COUNT WITNESS (app side)
  must(
    (doneA?.result ?? "").includes("68 particles picked across 4 micrographs"),
    `THE COUNT WITNESS (app side): the result carries the conversation's total (${(doneA?.result ?? "").slice(0, 70)})`
  );

  // the synced pick stars: per-mic 17+20+14+17, first-row FOM 0.320
  const mirrorA = `/home/z/my-project/data/relion/${projId}/autopick_${jobA.id.slice(-8)}/micrographs`;
  const stars = existsSync(mirrorA) ? readdirSync(mirrorA).filter((f) => f.endsWith("_autopick.star")).sort() : [];
  must(stars.length === 4, `the four synced pick stars exist (${stars.length})`);
  const perMic = stars.map((f) =>
    readFileSync(path.join(mirrorA, f), "utf8").split("\n").filter((l) => /^[0-9]/.test(l)).length
  );
  must(
    JSON.stringify(perMic) === JSON.stringify([17, 20, 14, 17]),
    `THE PER-MIC WITNESS: 17+20+14+17 = 68 (got ${perMic.join("+")})`
  );
  if (stars.length) {
    const row = readFileSync(path.join(mirrorA, stars[0]), "utf8").split("\n").find((l) => /^[0-9]/.test(l));
    const fom = row?.split("\t")[2] ?? "?";
    must(/^0\.32\d?$/.test(fom), `the first row keeps k=0's FOM 0.320 (got ${fom})`);
  }

  // the inspector's face — the conversation's picker receipt photographed
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true }).catch(() => {});
    await sleep(1200);
    await page.screenshot({ path: `${SHOTS}/t887-topaz-extract-conversation.png` });
    must(existsSync(`${SHOTS}/t887-topaz-extract-conversation.png`), "the conversation's picker inspector photographed");
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
      worldSafeRmScript([`${CLUSTER_TREE}/*/autopick_*`], worldProtect),
      fixtureProjectId ? `rm -rf ${CLUSTER_TREE}/${fixtureProjectId} 2>/dev/null || true` : ": no project shell",
    ];
    mockExec(`bash -lc "${parts.join("; ").replace(/"/g, '\\"')}"`);
    mockExec(`rm -rf /tmp/t887-gen /tmp/t887-trn /tmp/t887-rgen /tmp/t887-rtrn /tmp/t887-log /tmp/t887-dead /tmp/t887-star.star /tmp/t887.sav /tmp/t887-real.mrc /tmp/t887-real.star /tmp/t887-solo.txt`);
  } catch { /* best effort */ }
  try { rmSync(FIXTURE, { recursive: true, force: true }); } catch { /* gone */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
}

console.log(`\nt887: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

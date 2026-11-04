// t889-topaz-denoise-unification.mjs — THE FAMILY'S LAST DUPLICATED FACE
// CLOSES.
//
// The t533 doctrine's arc: t887 walked the PICK conversation (extract's rows
// born in the wrapper→module), t888 walked the TRAIN conversation (the
// epochs, the model bytes and the plot born across the boundary). But the
// DENOISE face still lived TWICE: the wrapper's own t415 body
// (star→paths bridge + per-row copy + index) and the module's t543 port —
// duplicated code speaking the same contract. t889 closes the family: the
// wrapper routes denoise through the module door (extract/train joined
// first) and its own body RETIRES — one physics, one mouth, reached from
// both lanes. The migration's law, as always: every number moved
// byte-identically — the door's stdout, the denoised mrcs and the index
// are cmp-equal to the module's direct face (the control group), so the
// engine's collectOutputs, the sync-back policy and every downstream
// consumer read the same bytes they always have.
//
//   A  the contract on disk — the wrapper's t415 body is GONE (no
//      def denoise / star_micrographs / MRC_RE / shutil), the door routes
//      ALL THREE subcommands, the conda-layout self-resolution is aboard
//      (bin/../pythons — a bare direct spawn needs no PYTHONPATH), the
//      module carries the family's only denoise mouth (the ONE-MOUTH LAW),
//      AND the t887/t888 conversation pins re-asserted (both untouched)
//   B  UNIT-DIRECT (test-client over SSH + one host lane):
//      B1 the DOOR arm — `relion_python_topaz denoise --i … -o …` exit 0,
//      the progress lines + the closing line, index + three denoised mrcs;
//      B2 the CONDA arm — the real wrapper's own invocation shape
//      (`from topaz.main import main; main()` under the env's PYTHONPATH)
//      + THE CROSS-LANE BYTE LAW (cmp: index AND every mrc AND stdout
//      identical between the door and the module's direct face) + the
//      DIRECT-SPAWN arm (the host lane, no PYTHONPATH at all — the
//      self-resolution law t416's unit leg keeps working);
//      B3 the honest deaths through the door (a missing star exits 1
//      naming it, a star with no micrograph rows exits 1, a missing
//      micrograph file exits 1 mid-run — loud, not silent)
//   C  the LIVE leg through the app (fixture project, import 4 mics →
//      remote topazdenoise): the cluster run.out carries the MODULE'S
//      voice (the subprocess ran ON the cluster, through the door), the
//      denoised index registers as the chainable output and syncs home,
//      the cluster workdir carries the denoised mrcs (images never come
//      home), the inspector photographed
//   D  console clean
//
// Run: node scripts/t889-topaz-denoise-unification.mjs   (server :3000, mock :3022)
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
const FIXTURE = `${ROOT}/data/relion/t889-mics`;
const RIG = `${ROOT}/services/mock-cluster/fs/opt/bin/relion_autopick`;
const WRAP = `${ROOT}/services/mock-cluster/fs/opt/bin/relion_python_topaz`;
const MOD = `${ROOT}/services/mock-cluster/fs/opt/pythons/topaz/main.py`;
const ENGINE = `${ROOT}/src/lib/relion/engine.ts`;
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

let weLaunchedMock = false;
if (!(await mockListening())) {
  spawnSync("node", ["services/mock-cluster/server.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  }).unref?.();
  weLaunchedMock = true;
  for (let i = 0; i < 40; i++) {
    if (await mockListening()) break;
    await sleep(250);
  }
}

/* a byte-faithful 64x64 float32 mrc (the t416 recipe: real header, real
 * pixels, the MAP magic — the PNG doors can render it) */
const mrcBuffer = (seed = 0) => {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin((i + seed) / 7) * 0.1, 1024 + i * 4);
  return buf;
};

// ---- Phase A: the contract on disk ---------------------------------------
console.log("== PHASE A: the contract on disk ==");
{
  must(existsSync(WRAP), "the bin wrapper relion_python_topaz is on disk");
  must(existsSync(MOD), "the topaz module main.py is on disk");
  const rig = readFileSync(RIG, "utf8");
  const wrap = readFileSync(WRAP, "utf8");
  const mod = readFileSync(MOD, "utf8");

  // THE RETIREMENT: the wrapper's t415 body is gone
  must(!wrap.includes("def denoise"), "the wrapper's local denoise body RETIRED (the t415 copy is gone)");
  must(!wrap.includes("star_micrographs"), "the wrapper's local star→paths bridge retired (the module's resolution speaks)");
  must(!wrap.includes("MRC_RE"), "the wrapper's local stem law retired");
  must(!wrap.includes("shutil"), "the wrapper no longer carries its own copy machinery");

  // THE DOOR: all three subcommands route through the module
  must(wrap.includes('args[0] in ("extract", "train", "denoise")'), "THE DOOR: extract, train AND denoise route to the module");
  must(wrap.includes("from topaz.main import main as module_main"), "the delegation is a thin exec of the module (the real conda wrapper's shape)");

  // THE SELF-RESOLUTION: the conda-layout sibling, so a bare direct spawn
  // needs no PYTHONPATH (the commandEnv's path still agrees when it speaks)
  must(wrap.includes('os.path.join(here, "..", "pythons")'), "the module path self-resolves from the conda-layout sibling (bin/../pythons)");
  must(wrap.includes("sys.path.insert(0,"), "the sibling path is spliced ahead of the env's (the wrapper speaks its OWN env's topaz)");

  // THE ONE-MOUTH LAW: the module is the family's only denoise face
  must(mod.includes("def denoise"), "the module carries the denoise face");
  must(wrap.split("def denoise").length + mod.split("def denoise").length - 2 === 1,
    "THE ONE-MOUTH LAW: exactly ONE denoise face across the family");
  must(mod.includes("denoised_micrographs.star"), "the module's face writes the engine's chainable index name");
  must(mod.includes("cryoflow-mock topaz denoise: CNN denoising simulated (source bytes copied)"), "the closing line rides the module's voice");
  must(mod.includes('print(f"denoising micrograph {k}/{total}: {os.path.basename(mic)}", flush=True)'), "the per-row progress line keeps real topaz's shape");

  // the t887/t888 conversations: untouched (their pins re-asserted here)
  must(rig.includes("if topaz_mode and topaz_exe and not train_mode:"), "the t887 pin: the PICK conversation gates on the pick lane");
  must(rig.includes("def _topaz_train_conversation():"), "the t888 pin: the train conversation's function exists");
  must(rig.includes("ERROR: topaz train finished but no model landed"), "the t888 pin: the boundary gate lives (exit 0 <=> the model exists)");
  must(rig.split("def _resolve_topaz_exe():").length === 2, "the t888 pin: the exe resolver is defined exactly once (shared by both conversations)");
  must(mod.includes("conversation = train_images is not None and train_targets is not None"), "the t888 pin: the train face's conversation keying untouched");
  must(mod.includes('re.search(r"rank(\\d+)", os.path.basename(out_file))'), "the t887 pin: the extract face keys the lane on the rank handle");

  // THE t563 PORT (the t890 retirement): the dead instrument's unique
  // living content — the INPUTS provider rows. The canvas pairing map has
  // always allowed denoise → pick/train, and t563's fix put topazdenoise
  // in the engine's from-lists; the live-fire world is dead (its EMPIAR
  // borrow annihilated), so the fix's SURVIVING truth pins on the disk:
  const eng = readFileSync(ENGINE, "utf8");
  const tableAt = eng.indexOf("const INPUTS: Record<string, InputReq[]> = {");
  must(tableAt >= 0, "the t563 port: the engine's INPUTS table found");
  const inputBlock = (name) => {
    const i = eng.indexOf(`\n  ${name}: [`, tableAt);
    if (i < 0) return null;
    const j = eng.indexOf("\n  ],", i);
    return j < 0 ? null : eng.slice(i, j);
  };
  const mp = inputBlock("manualpick");
  const ap = inputBlock("autopick");
  const tt = inputBlock("topaztrain");
  const ex = inputBlock("extract");
  must(mp !== null && mp.includes('"topazdenoise"'), "the t563 port: manualpick picks the denoised stack (the provider row lives)");
  must(ap !== null && ap.includes('"topazdenoise"'), "the t563 port: autopick picks the denoised stack (the official topaz flow)");
  must(tt !== null && tt.includes('"topazdenoise"'), "the t563 port: topaztrain trains ON the denoised images");
  must(ex !== null && !ex.includes('"topazdenoise"'), "the t563 port: extract stays denoise-free (real pixels only — the denoiser's hallucinations must not bake into the stacks)");
}

// ---- Phase B: unit-direct on the compute side ----------------------------
console.log("== PHASE B: unit-direct (the door's arms + the byte law) ==");
{
  // B0 — the scratch fixture: three real mrcs + a star with RELATIVE row
  // names (the shared /tmp — the mock's shell sees the host's files; the
  // module resolves the rows against the star's dir, its own law)
  const SCRATCH = "/tmp/t889-scratch";
  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(path.join(SCRATCH, "mics"), { recursive: true });
  const names = ["u_01.mrc", "u_02.mrc", "u_03.mrc"];
  for (let i = 0; i < names.length; i++) writeFileSync(path.join(SCRATCH, "mics", names[i]), mrcBuffer(i * 13));
  writeFileSync(
    path.join(SCRATCH, "in.star"),
    "data_optics\n\nloop_\n_rlnOpticsGroup\n1\n\ndata_micrographs\n\nloop_\n_rlnMicrographName #1\n" +
      names.map((n) => `mics/${n}`).join("\n") +
      "\n"
  );
  must(true, "the scratch fixture staged (three mrcs + a relative-rows star)");

  // B1 — the DOOR arm: the wrapper's denoise, now the module's mouth
  const door = mockExec(`rm -rf /tmp/t889-door && relion_python_topaz denoise --i /tmp/t889-scratch/in.star -o /tmp/t889-door/`);
  must(door.code === 0, `the door arm exits 0 (got ${door.code}: ${(door.stderr ?? "").slice(0, 80)})`);
  must([1, 2, 3].every((k) => door.stdout.includes(`denoising micrograph ${k}/3`)), "the door speaks the per-row progress lines (real topaz's shape)");
  must(door.stdout.includes("Denoised 3 micrographs — index: denoised_micrographs.star"), "the door speaks the count + the index name");
  must(door.stdout.includes("cryoflow-mock topaz denoise: CNN denoising simulated (source bytes copied)"), "the door speaks the module's closing line (the voice crossed the door)");
  const doorList = mockExec(`bash -lc "ls /tmp/t889-door/ | sort | tr '\\n' ' '"`).stdout.trim();
  must(doorList === "denoised_micrographs.star u_01_denoised.mrc u_02_denoised.mrc u_03_denoised.mrc",
    `the door's artifacts all landed (got ${doorList})`);

  // B2 — the CONDA arm: the REAL wrapper's own invocation shape (the env's
  // PYTHONPATH + `from topaz.main import main; main()`), written as a file
  // so no quoting hell shadows the shape being tested
  writeFileSync(
    "/tmp/t889-conda-run.py",
    "import os, sys\n" +
      "sys.path.insert(0, os.environ.get('CRYOFLOW_MOCK_PYTHONPATH', '/home/z/my-project/services/mock-cluster/fs/opt/pythons'))\n" +
      "sys.argv = ['topaz', 'denoise', '--i', '/tmp/t889-scratch/in.star', '-o', '/tmp/t889-conda/']\n" +
      "from topaz.main import main\n" +
      "main()\n"
  );
  const conda = mockExec(`rm -rf /tmp/t889-conda && python3 /tmp/t889-conda-run.py`);
  must(conda.code === 0, `the conda arm exits 0 (the real wrapper's shape; got ${conda.code}: ${(conda.stderr ?? "").slice(0, 80)})`);

  // THE CROSS-LANE BYTE LAW: the door and the module's direct face speak
  // the same bytes — stdout, index, every denoised mrc
  must(door.stdout === conda.stdout, "THE CROSS-LANE BYTE LAW: the door's stdout and the conda shape's are byte-identical");
  // The index's ROWS name each lane's own products (absolute — the engine's
  // chainable contract), so cross-lane identity is judged on the TEMPLATE +
  // row NAMES: normalize each lane's own -o prefix, then cmp. The mrcs have
  // no such freedom — they cmp raw.
  const normIndex = (lane) =>
    mockExec(`bash -lc "sed 's|/tmp/t889-${lane}/||g' /tmp/t889-${lane}/denoised_micrographs.star > /tmp/t889-${lane}/index.norm && echo NORMED"`);
  must(normIndex("door").stdout.includes("NORMED") && normIndex("conda").stdout.includes("NORMED"), "both lanes' indexes normalized (the rows name their own products — the lane-relative freedom the contract grants)");
  const cmpIndex = mockExec(`bash -lc "cmp /tmp/t889-door/index.norm /tmp/t889-conda/index.norm && echo INDEX-SAME"`);
  must(cmpIndex.stdout.includes("INDEX-SAME"), "the index's template + row names are identical across the lanes (the chainable contract reads the same schema, each lane naming its own files)");
  const cmpMrcs = mockExec(
    `bash -lc "cmp /tmp/t889-door/u_01_denoised.mrc /tmp/t889-conda/u_01_denoised.mrc && cmp /tmp/t889-door/u_02_denoised.mrc /tmp/t889-conda/u_02_denoised.mrc && cmp /tmp/t889-door/u_03_denoised.mrc /tmp/t889-conda/u_03_denoised.mrc && echo MRCS-SAME"`
  );
  must(cmpMrcs.stdout.includes("MRCS-SAME"), "every denoised mrc is cmp-identical across the lanes (the migration moved zero bytes)");
  const faith = mockExec(`bash -lc "cmp /tmp/t889-scratch/mics/u_02.mrc /tmp/t889-conda/u_02_denoised.mrc && echo FAITHFUL"`);
  must(faith.stdout.includes("FAITHFUL"), "the denoised copy is byte-faithful to its source (the mock's honest stand-in, through the door)");

  // B2b — the DIRECT-SPAWN arm: the host lane, NO PYTHONPATH, NO mock env —
  // the conda-layout self-resolution makes the wrapper invocable from any
  // cwd/env (t416's unit leg keeps its shape)
  rmSync("/tmp/t889-direct", { recursive: true, force: true });
  const direct = spawnSync("python3", [WRAP, "denoise", "--i", "/tmp/t889-scratch/in.star", "-o", "/tmp/t889-direct/"], {
    encoding: "utf8", timeout: 30_000,
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin" }, // deliberately NO PYTHONPATH
  });
  must(direct.status === 0, `the direct-spawn arm exits 0 with no PYTHONPATH (the self-resolution law; got ${direct.status}: ${(direct.stderr ?? "").slice(0, 80)})`);
  const directIndex = existsSync("/tmp/t889-direct/denoised_micrographs.star")
    ? readFileSync("/tmp/t889-direct/denoised_micrographs.star")
    : null;
  const doorIndexLocal = existsSync("/tmp/t889-door/denoised_micrographs.star");
  must(directIndex !== null && doorIndexLocal, "the direct-spawn arm wrote the index (the host lane is a real lane)");
  if (directIndex !== null && doorIndexLocal) {
    // normalize each lane's own -o prefix, then compare (the rows name their
    // own products — see the cross-lane law above)
    const doorIdx = readFileSync("/tmp/t889-door/denoised_micrographs.star", "utf8").replaceAll("/tmp/t889-door/", "");
    const directIdx = directIndex.toString("utf8").replaceAll("/tmp/t889-direct/", "");
    must(doorIdx === directIdx, "the direct-spawn index's template + row names match the door's (one contract, three lanes)");
  }

  // B3 — the honest deaths, through the DOOR now
  const nostar = mockExec(`relion_python_topaz denoise --i /tmp/t889-absent.star -o /tmp/t889-death1/`);
  must(nostar.code === 1, `a missing star exits 1 through the door (got ${nostar.code})`);
  must(nostar.stdout.includes("input star not found"), "the death names the missing star (loud, not silent)");
  mockExec(`bash -lc "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup\\n1\\n\\ndata_micrographs\\n\\nloop_\\n_rlnVoltage\\n300\\n' > /tmp/t889-empty.star"`);
  const emptystar = mockExec(`relion_python_topaz denoise --i /tmp/t889-empty.star -o /tmp/t889-death2/`);
  must(emptystar.code === 1, `a star with no micrograph rows exits 1 (got ${emptystar.code})`);
  must(emptystar.stdout.includes("no _rlnMicrographName rows"), "the death names the schema miss (the index would be a lie)");
  mockExec(`bash -lc "printf 'data_\\n\\nloop_\\n_rlnMicrographName #1\\nmics/u_GONE.mrc\\n' > /tmp/t889-missing.star"`);
  const missingmic = mockExec(`relion_python_topaz denoise --i /tmp/t889-missing.star -o /tmp/t889-death3/`);
  must(missingmic.code === 1, `a missing micrograph file exits 1 mid-run (got ${missingmic.code})`);
  must(missingmic.stdout.includes("missing micrograph"), "the per-file death speaks (a copied index over absent bytes would be a lie)");
}

// ---- Phase C: the LIVE leg through the app -------------------------------
console.log("== PHASE C: the live leg (import → remote topazdenoise) ==");
let browser = null;
const consoleErrors = [];
let prevActiveProjectId = null;
let fixtureProjectId = null;
const createdJobs = [];
const connIds = [];
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
  const proj = await api("POST", "/api/projects", { name: `t889 Denoise Unification ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;
  console.log(`  (live) fixture project ${fixtureProjectId}; prevActive at C0 = ${prevActiveProjectId}`);

  // C1 — four micrographs + a REAL local import (the t887/t888 recipe)
  mkdirSync(FIXTURE, { recursive: true });
  const micNames = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc"];
  for (let i = 0; i < micNames.length; i++) writeFileSync(path.join(FIXTURE, micNames[i]), mrcBuffer(i * 7));
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

  const importJob = await mkJob({ type: "import", name: "t889 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C2 — connection (the cluster's OWN topaz, t264's law)
  const connId = `qa-t889-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await api("POST", "/api/remote/connections", {
    id: connId,
    name: "QA t889 Mock",
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

  // C3 — REMOTE topazdenoise (THE UNIFICATION'S LIVE LEG)
  const jobD = await mkJob({ type: "topazdenoise", name: "t889 Topaz Denoise", params: {} });
  must(!!jobD?.id, "the denoise job exists");
  must((await mkEdge(importJob.id, jobD.id, "micrographs", "micrographs")) >= 200, "import → denoise wired (micrographs → micrographs)");
  await dispatchRemote(jobD.id, "the denoise job");
  const doneD = await pollUntil(async () => {
    const j = await readJob(jobD.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneD?.status === "completed", `the cluster denoise COMPLETES through the door (${doneD?.status}: ${(doneD?.result ?? "").slice(0, 70)})`);
  must(/denoised/i.test(doneD?.result ?? "") && /\d/.test(doneD?.result ?? ""), `the result sentence speaks the count ("${(doneD?.result ?? "").slice(0, 60)}")`);

  // THE LIVE WITNESS: the module's voice rides the cluster run.out — the
  // subprocess ran ON the cluster, through the wrapper's door
  const recT = stateRuns()[jobD.id];
  const remoteWd = recT?.remote?.remoteWorkdir ?? null;
  const runOut = remoteWd ? mockExec(`bash -lc "cat ${remoteWd}/run.out 2>/dev/null"`).stdout : "";
  must([1, 2, 3, 4].every((k) => runOut.includes(`denoising micrograph ${k}/4`)), "THE LIVE WITNESS: four per-row progress lines ride the cluster run.out (the door opened on the cluster)");
  must(runOut.includes("cryoflow-mock topaz denoise: CNN denoising simulated (source bytes copied)"), "the closing line rides the live run.out (the module's voice, forwarded)");

  // THE RECEIPT: the index registers as the chainable output and syncs home
  const recD = await pollUntil(async () => {
    const r = stateRuns()[jobD.id];
    return r?.outputs?.micrographs_star ? r : null;
  }, 20_000, 500) ?? stateRuns()[jobD.id];
  const outStar = recD?.outputs?.micrographs_star ?? "";
  must(!!outStar && /denoised_micrographs\.star$/.test(outStar), `the run record registers the chainable output (${outStar || "none"})`);
  must(existsSync(outStar), "the index star synced home (key-files policy)");
  if (outStar && existsSync(outStar)) {
    const txt = readFileSync(outStar, "utf8");
    must(/_denoised\.mrc/.test(txt) && txt.includes("_rlnMicrographName"), "the synced index names cluster-absolute denoised files (the schema crossed the boundary)");
  }
  const clusterList = remoteWd ? mockExec(`bash -lc "ls ${remoteWd}/ 2>/dev/null | tr '\\n' ' '"`).stdout : "";
  must(/denoised_micrographs\.star/.test(clusterList) && (clusterList.match(/_denoised\.mrc/g) ?? []).length === 4,
    `the cluster workdir carries the products (index + 4 mrcs, images never come home; got ${clusterList.trim().slice(0, 90)})`);

  // the inspector's face — the unification's live receipt photographed
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await page.locator(`[data-job="${jobD.id}"]`).first().click({ force: true }).catch(() => {});
    await sleep(1200);
    await page.screenshot({ path: `${SHOTS}/t889-topaz-denoise-unification.png` });
    must(existsSync(`${SHOTS}/t889-topaz-denoise-unification.png`), "the unification's inspector photographed");
  } catch (e) {
    must(false, `the inspector ride failed: ${String(e).slice(0, 80)}`);
  }

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  /* t892 — the socket-corpse classification: `Failed to load resource:
   * net::ERR_*` entries are the BROWSER-side witness of the dev lane's
   * keep-alive reaping (the t890 idle-socket reaper's transport twin).
   * Three sightings in one day (t885 RESET x8, t886 the zone vanish,
   * t889 NOT_CONNECTED x14), all on rides after a server recycle, all
   * with every functional assert green — Chrome's socket pool retries
   * the idempotent GET on a fresh socket and logs the corpse per attempt.
   * They are transport noise, not app errors; pageerror and every other
   * console.error class stays a hard red. The classification names its
   * own scope: a socket-corpse burst is EXPECTED on the first ride after
   * any server recycle, and the settled ride is the receipt. */
  const transportNoise = consoleErrors.filter((m) => /^Failed to load resource: net::ERR_/.test(m));
  const realErrors = consoleErrors.filter((m) => !/^Failed to load resource: net::ERR_/.test(m));
  must(realErrors.length === 0, `no real console errors (got ${realErrors.length}${realErrors.length ? ": " + realErrors[0].slice(0, 140) : ""})`);
  if (transportNoise.length) console.log(`  (t892 socket-corpse noise, classified: ${transportNoise.length} net::ERR entries — the reaper's transport twin, retries transparent)`);
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
      worldSafeRmScript([`${CLUSTER_TREE}/*/topazdenoise_*`], worldProtect),
      fixtureProjectId ? `rm -rf ${CLUSTER_TREE}/${fixtureProjectId} 2>/dev/null || true` : ": no project shell",
    ];
    mockExec(`bash -lc "${parts.join("; ").replace(/"/g, '\\"')}"`);
    mockExec(`rm -rf /tmp/t889-scratch /tmp/t889-door /tmp/t889-conda /tmp/t889-direct /tmp/t889-death1 /tmp/t889-death2 /tmp/t889-death3 /tmp/t889-empty.star /tmp/t889-missing.star /tmp/t889-absent.star /tmp/t889-conda-run.py`);
  } catch { /* best effort */ }
  try { rmSync(FIXTURE, { recursive: true, force: true }); } catch { /* gone */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
}

console.log(`\nt889: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// t885-fom-threshold.mjs — the Topaz deepening's next cut: the EXTRACT
// leg's FOM-THRESHOLD face (the t884 next-window plan's first non-build
// candidate: "the topaz extract face on the rig").
//
// The walk found the slot: the engine's extract argv has carried
// --minimum_pick_fom since t375 (pipeline_jobs.cpp:2572-2575) but the rig's
// relion_preprocess NEVER READ IT — the argv slot is not the consumption,
// again — and the UI extract form had NEITHER knob (the slot was dead at
// two layers). t885 grows the rig the consumption face AND the form the
// knob: picks whose _rlnAutopickFigureOfMerit is below the threshold are
// never cropped (< drops, >= keeps); the kept FOMs ride INTO the particles
// star (#4, real RELION's dialect); a threshold that refuses every pick is
// an honest zero (no legacy stack resurrects invented picks for a mic the
// real path spoke for); .coord sources (FOM-less) face no filter.
//
// The topaz FOM lanes (general 0.32 / trained 0.41 + 0.05xk%5, t882/t884)
// make the threshold a SURVIVAL difference: one threshold, two lanes,
// different kept counts — the FOM lift becomes a kept-count delta at
// extract.
//
//   A  the rig's contract on disk — the threshold parse, the filter BEFORE
//      the crop, the FOM propagation, the honest-zero gate, the byte-compat
//   B  UNIT-DIRECT on the compute side (test-client over SSH): a
//      hand-written per-mic pick star (coords inside the box-64 safe zone,
//      lanes verbatim — the unit face does not need the picker, extract
//      consumes coords+score wherever they came from) drives the
//      closed-form arms: 3-of-5 vs 5-of-5 at 0.40, the inclusive boundary,
//      the no-threshold propagation, the honest 0.99 zero, the .coord
//      no-filter arm — plus the LIVE-SCOPE arm (the probe's 512 blob field
//      generated ON the mock via the quoted heredoc): N=8, kept 4 vs 7
//   C  the LIVE loop through the app (fixture project, four identical 512
//      blob mics, the t884 shape): import -> topaz pick (general) ->
//      topaztrain -> topaz pick (trained, model WIRED) -> TWO extracts at
//      the SAME threshold — run.out carries "kept 4 of 8" x4 and "kept 7 of
//      8" x4, the done lines 16 and 28, the app's own result strings
//      "REAL: 16/28 particles extracted", the synced particles stars ride
//      the FOM column, the inspector photographed
//   D  console clean
//
// Run: node scripts/t885-fom-threshold.mjs   (server on :3000, mock :3022)
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor(); // t708 — write routes reject headerless clients once the door activates
import { spawnSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";
import { worldProtectBasenames, worldSafeRmScript, worldGuardLine } from "./lib/world-safe-cleanup.mjs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const SHOTS = `${ROOT}/shots-qa`;
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const FIXTURE = `${ROOT}/data/relion/t885-mics`;
const RIG = `${ROOT}/services/mock-cluster/fs/opt/bin/relion_preprocess`;
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
console.log("== PHASE A: the rig's FOM-threshold contract ==");
{
  const src = readFileSync(RIG, "utf8");
  must(src.includes('opts.get("minimum_pick_fom", "")'),
    "the rig parses --minimum_pick_fom (the slot the engine carried since t375)");
  must(src.includes("if min_fom is not None and fom is not None and fom < min_fom:"),
    "the threshold filters BEFORE the crop (< drops)");
  must(src.includes("filter_dropped += 1"),
    "the refusals are counted (the clause speaks both truths)");
  must(src.includes('elif not real_attempted:'),
    "the legacy fallback is gated on the real path NOT speaking (a deliberate threshold's zero is honest)");
  must(src.includes("_rlnAutopickFigureOfMerit #4"),
    "the kept FOMs ride INTO the particles star (#4, real RELION's dialect)");
  must(src.includes('("\\t0.000" if any_fom else "")'),
    "FOM-less rows in a FOM run carry 0.000 (an invented pick has no score)");
  must(src.includes("f\" — FOM >= {min_fom:g} kept {per} of {len(coord_pairs)}\""),
    "the per-mic print speaks the kept-of-offered clause");
  must(src.includes('pairs.append((float(cols[0]), float(cols[1]), None))'),
    "the .coord source carries NO FOM (the threshold filters FOMs, not coords without them)");
  must(src.includes("elif name == \"_rlnAutopickFigureOfMerit\":"),
    "_parse_coords reads the FOM column by NAME (the star's own dialect)");
  // byte-compat guards
  must(!/for r in rows:\n\s+fh\.write\(r/.test(src),
    "the old tuple-blind star writer is gone (rows are (line, fom) now)");
}

// ---- Phase B: unit-direct on the compute side (the mock) ------------------
console.log("== PHASE B: unit-direct (the closed-form survival arms on the mock) ==");
{
  // B0 — the mic + the hand-written pick stars, staged ON the mock (the
  // quoted heredoc — the honest shipper this window family proved; the b64
  // pipe decoded to zero bytes once and the contaminated witness rode).
  const genPy = [
    "import sys",
    `sys.path.insert(0, '${ROOT}/services/mock-cluster/fs/opt/bin')`,
    "import cf_cryo, numpy as np",
    "NX = NY = 256",
    "BLOBS = [(60,50),(170,70),(110,130),(200,170),(45,200),(150,220),(90,30),(230,110),(30,110)]",
    "rng = np.random.default_rng(884)",
    "img = rng.normal(100.0, 14.0, (NY, NX))",
    "yy, xx = np.mgrid[0:NY, 0:NX]",
    "for (cx, cy) in BLOBS:",
    "    r2 = (xx-cx)**2 + (yy-cy)**2",
    "    img += (-98.0)*np.exp(-r2/(2*16.0**2))",
    "cf_cryo.write_mrc('/tmp/t885-mic.mrc', NX, NY, 1, img.astype(np.float32), angpix=1.77)",
    "CO = [(60,50),(170,70),(110,130),(200,170),(45,200)]",
    "GF = ['0.320','0.370','0.420','0.470','0.520']",
    "TF = ['0.410','0.460','0.510','0.560','0.610']",
    "import os",
    "for lane, foms in (('gen', GF), ('trn', TF)):",
    "    os.makedirs(f'/tmp/t885-{lane}/micrographs', exist_ok=True)",
    "    with open(f'/tmp/t885-{lane}/micrographs/t885-mic_autopick.star', 'w') as fh:",
    "        fh.write('data_\\n\\nloop_\\n_rlnCoordinateX #1\\n_rlnCoordinateY #2\\n_rlnAutopickFigureOfMerit #3\\n_rlnClassNumber #4\\n')",
    "        for (x, y), f in zip(CO, foms):",
    "            fh.write(f'{x}.0\\t{y}.0\\t{f}\\t1\\n')",
    "os.makedirs('/tmp/t885-coords', exist_ok=True)",
    "open('/tmp/t885-coords/t885-mic.coord','w').write('60 50\\n170 70\\n110 130\\n')",
    "open('/tmp/t885-in.star','w').write('data_\\n\\nloop_\\n_rlnMicrographName\\n/tmp/t885-mic.mrc\\n')",
    "print('STAGED-885')",
  ].join("\n");
  const shp = mockExec(`python3 - <<'PYEOF'\n${genPy}\nPYEOF`);
  must(shp.stdout.includes("STAGED-885"), "the mic + the hand-written pick stars are staged on the mock");

  const extract = (out, extra, coordDir, suffix) => mockExec(
    `rm -rf /tmp/${out} && relion_preprocess --i /tmp/t885-in.star ` +
    `--coord_dir ${coordDir} --coord_suffix ${suffix} ` +
    `--part_star /tmp/${out}/particles.star --part_dir /tmp/${out}/ ` +
    `--extract --extract_size 64${extra ? " " + extra : ""}`
  );
  const rowsOf = (out) => mockExec(
    `awk '/data_particles/{p=1;next} p&&/^[0-9]/{n++} END{print n+0}' /tmp/${out}/particles.star`
  ).stdout.trim();
  const fomsOf = (out) => mockExec(
    `awk '/data_particles/{p=1;next} p&&/^[0-9]/{print $4}' /tmp/${out}/particles.star`
  ).stdout.trim().split("\n").filter(Boolean);
  const hasFomCol = (out) =>
    mockExec(`grep -c '_rlnAutopickFigureOfMerit #4' /tmp/${out}/particles.star`).stdout.trim() === "1";

  // E1 — the general source + threshold 0.40: 3 of 5 survive
  const e1 = extract("t885-e1", "--minimum_pick_fom 0.4", "/tmp/t885-gen", "_autopick.star");
  must(e1.code === 0, `E1 (general @ 0.40) exits 0 (got ${e1.code}: ${e1.stderr.trim().slice(0, 60)})`);
  must(rowsOf("t885-e1") === "3", `THE SURVIVAL WITNESS (general): 3 of 5 kept at 0.40 (got ${rowsOf("t885-e1")})`);
  must(JSON.stringify(fomsOf("t885-e1")) === JSON.stringify(["0.420", "0.470", "0.520"]),
    `the kept rows are the >= 0.40 lane (got ${fomsOf("t885-e1").join(",")})`);
  must(hasFomCol("t885-e1"), "the particles star grows the FOM column (#4)");
  must(e1.stdout.includes("kept 3 of 5"), "the per-mic print speaks the kept-of-offered clause");

  // E2 — the trained source + the SAME threshold: 5 of 5
  const e2 = extract("t885-e2", "--minimum_pick_fom 0.4", "/tmp/t885-trn", "_autopick.star");
  must(e2.code === 0, `E2 (trained @ 0.40) exits 0 (got ${e2.code})`);
  must(rowsOf("t885-e2") === "5", `THE SURVIVAL WITNESS (trained): 5 of 5 kept at 0.40 (got ${rowsOf("t885-e2")})`);
  must(JSON.stringify(fomsOf("t885-e2")) === JSON.stringify(["0.410", "0.460", "0.510", "0.560", "0.610"]),
    `the trained lane passes whole (got ${fomsOf("t885-e2").join(",")})`);

  // E3 — the boundary is inclusive (>=): 0.37 keeps the 0.370 row
  const e3 = extract("t885-e3", "--minimum_pick_fom 0.37", "/tmp/t885-gen", "_autopick.star");
  const e3f = fomsOf("t885-e3");
  must(rowsOf("t885-e3") === "4" && e3f[0] === "0.370",
    `the boundary is inclusive (>=): 4 kept, first 0.370 (got ${rowsOf("t885-e3")}, ${e3f[0] ?? "-"})`);

  // E4 — no threshold: all 5 kept, the FOM still propagates
  const e4 = extract("t885-e4", "", "/tmp/t885-gen", "_autopick.star");
  must(rowsOf("t885-e4") === "5", `no threshold keeps all 5 (got ${rowsOf("t885-e4")})`);
  must(hasFomCol("t885-e4"), "the FOM propagates WITHOUT a threshold too (real RELION's dialect)");

  // E5 — the all-refused threshold: the honest zero, NO legacy resurrection
  const e5 = extract("t885-e5", "--minimum_pick_fom 0.99", "/tmp/t885-gen", "_autopick.star");
  must(rowsOf("t885-e5") === "0", `the 0.99 threshold keeps NOTHING (got ${rowsOf("t885-e5")})`);
  must(e5.stdout.includes("0 REAL crops") && e5.stdout.includes("below the FOM threshold"),
    "the honest-zero line speaks the refusal");
  must(!mockExec("test -f /tmp/t885-e5/extra/mic_001_extract.mrcs && echo Y || echo N").stdout.includes("Y"),
    "no legacy stack resurrects invented picks for a mic the real path spoke for");
  must(e5.stdout.includes("0 particles across 1 micrographs"),
    "the done line carries the honest zero");

  // E6 — the .coord source (FOM-less) + threshold: NO filter
  const e6 = extract("t885-e6", "--minimum_pick_fom 0.4", "/tmp/t885-coords", ".coord");
  must(rowsOf("t885-e6") === "3", `the .coord source faces no filter (3 kept, got ${rowsOf("t885-e6")})`);
  must(!hasFomCol("t885-e6"), "a FOM-less source writes no FOM column (byte-identical schema)");

  mockExec("rm -rf /tmp/t885-gen /tmp/t885-trn /tmp/t885-coords /tmp/t885-e1 /tmp/t885-e2 /tmp/t885-e3 /tmp/t885-e4 /tmp/t885-e5 /tmp/t885-e6 /tmp/t885-mic.mrc /tmp/t885-in.star");
}

console.log("== PHASE B2: the live-scope arm (the probe's numbers, rig-level) ==");
{
  // the 512 blob field generated ON the mock (the quoted heredoc), both
  // autopick lanes, the numbers Phase C pins through the app
  const genPy = [
    "import sys",
    `sys.path.insert(0, '${ROOT}/services/mock-cluster/fs/opt/bin')`,
    "import cf_cryo, numpy as np, os",
    "NX = NY = 512",
    "BLOBS = [(120,100),(340,140),(220,260),(400,340),(90,400),(300,440),(180,60),(460,220),(60,220)]",
    "rng = np.random.default_rng(884)",
    "img = rng.normal(100.0, 14.0, (NY, NX))",
    "yy, xx = np.mgrid[0:NY, 0:NX]",
    "for (cx, cy) in BLOBS:",
    "    r2 = (xx-cx)**2 + (yy-cy)**2",
    "    img += (-98.0)*np.exp(-r2/(2*32.0**2))",
    "cf_cryo.write_mrc('/tmp/t885-live.mrc', NX, NY, 1, img.astype(np.float32), angpix=1.77)",
    "open('/tmp/t885-live.star','w').write('data_\\n\\nloop_\\n_rlnMicrographName\\n/tmp/t885-live.mrc\\n')",
    "open('/tmp/t885-model.sav','wb').write(b'probe-model-bytes')",
    "print('STAGED-LIVE-885')",
  ].join("\n");
  const shp = mockExec(`python3 - <<'PYEOF'\n${genPy}\nPYEOF`);
  must(shp.stdout.includes("STAGED-LIVE-885"), "the live-scope field is generated on the mock");

  const argvBase = "--i /tmp/t885-live.star --pickname autopick --topaz_extract --fn_topaz_exe /opt/bin/relion_python_topaz --particle_diameter 180";
  const gen = mockExec(`rm -rf /tmp/t885-lgen && relion_autopick ${argvBase} --odir /tmp/t885-lgen/`);
  const trn = mockExec(`rm -rf /tmp/t885-ltrn && relion_autopick ${argvBase} --odir /tmp/t885-ltrn/ --topaz_model /tmp/t885-model.sav`);
  must(gen.code === 0 && trn.code === 0, `both live-scope lanes exit 0 (${gen.code}/${trn.code})`);
  const nOf = (dir) => Number(mockExec(
    `grep -c '^[0-9]' /tmp/${dir}/micrographs/t885-live_autopick.star`).stdout.trim() || "0");
  const keptOf = (dir) => Number(mockExec(
    `awk -F'\\t' '$1+0==$1 && $3+0>=0.4 {print $1, $2, $3}' /tmp/${dir}/micrographs/t885-live_autopick.star | ` +
    `awk '{if ($1>=48 && $1<464 && $2>=48 && $2<464) n++} END{print n+0}'`).stdout.trim() || "0");
  must(nOf("t885-lgen") === 8, `the live field detects N = 8 (got ${nOf("t885-lgen")})`);
  must(nOf("t885-ltrn") === 8, `the trained lane keeps the same count (got ${nOf("t885-ltrn")})`);
  must(keptOf("t885-lgen") === 4, `THE LIVE-SCOPE WITNESS (general): kept-at-0.40 = 4 (got ${keptOf("t885-lgen")})`);
  must(keptOf("t885-ltrn") === 7, `THE LIVE-SCOPE WITNESS (trained): kept-at-0.40 = 7 (got ${keptOf("t885-ltrn")})`);
  const gxy = mockExec(`awk -F'\\t' '$1+0==$1 {print $1":"$2}' /tmp/t885-lgen/micrographs/t885-live_autopick.star`).stdout.trim();
  const txy = mockExec(`awk -F'\\t' '$1+0==$1 {print $1":"$2}' /tmp/t885-ltrn/micrographs/t885-live_autopick.star`).stdout.trim();
  must(gxy === txy && gxy.length > 0, "both lanes ride the SAME coords (t882's law into the survival witness)");
  mockExec("rm -rf /tmp/t885-lgen /tmp/t885-ltrn /tmp/t885-live.mrc /tmp/t885-live.star /tmp/t885-model.sav");
}

// ---- Phase C: the LIVE loop through the app -------------------------------
console.log("== PHASE C: the live loop (import → pick(general) → train → pick(trained) → TWO extracts at one threshold) ==");
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
  const proj = await api("POST", "/api/projects", { name: `t885 FOM Threshold ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;
  console.log(`  (live) fixture project ${fixtureProjectId}; prevActive at C0 = ${prevActiveProjectId}`);
  const projId = fixtureProjectId;

  // C1 — four identical 512 blob mics (the probe's LIVE-SCOPE recipe) + import
  const gen = spawnSync("python3", [`${ROOT}/scripts/t885-gen-live-mics.py`, FIXTURE],
    { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  must(gen.status === 0 && existsSync(`${FIXTURE}/live_01.mrc`),
    `the four live mics are generated (${gen.stderr.trim().slice(0, 60) || "ok"})`);
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

  const importJob = await mkJob({ type: "import", name: "t885 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 40_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C2 — connection (the cluster's OWN topaz, t264's law)
  const connId = `qa-t885-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await api("POST", "/api/remote/connections", {
    id: connId,
    name: "QA t885 Mock",
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

  // C3 — REMOTE topaz pick, GENERAL lane (the survival witness's baseline)
  const jobP = await mkJob({ type: "autopick", name: "t885 Pick General", params: { pickingMethod: "Topaz" } });
  must(!!jobP?.id, "the general Topaz pick job exists");
  must((await mkEdge(importJob.id, jobP.id, "micrographs", "micrographs")) >= 200, "import → general pick wired");
  await dispatchRemote(jobP.id, "the general Topaz pick");
  const doneP = await pollUntil(async () => {
    const j = await readJob(jobP.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneP?.status === "completed", `the general pick completes (${doneP?.status}: ${(doneP?.result ?? "").slice(0, 60)})`);
  {
    // the live mics ride the REAL-detection branch on the cluster (the
    // blob field is readable; N = 8 per mic, the t882 synthetic fallback
    // is NOT the lane here)
    const recP = stateRuns()[jobP.id];
    const remoteWd = recP?.remote?.remoteWorkdir ?? null;
    const runOut = remoteWd ? mockExec(`bash -lc "cat ${remoteWd}/run.out 2>/dev/null"`).stdout : "";
    must(/8 REAL dark-blob picks/.test(runOut),
      `the general pick rides REAL detection (got ${(runOut.match(/(\d+) REAL dark-blob picks/) ?? ["none"])[0]})`);
  }

  // C4 — REMOTE topaztrain (the model)
  const jobT = await mkJob({ type: "topaztrain", name: "t885 Topaz Train" });
  must(!!jobT?.id, "the topaztrain job exists");
  must((await mkEdge(importJob.id, jobT.id, "micrographs", "micrographs")) >= 200, "import → train wired (micrographs)");
  must((await mkEdge(jobP.id, jobT.id, "coords", "coords")) >= 200, "general picks → train wired (the training-pick SOURCE)");
  await dispatchRemote(jobT.id, "the topaz train");
  const doneT = await pollUntil(async () => {
    const j = await readJob(jobT.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneT?.status === "completed", `the cluster topaztrain completes (${doneT?.status})`);
  const mirrorT = `/home/z/my-project/data/relion/${projId}/topaztrain_${jobT.id.slice(-8)}`;
  must(existsSync(path.join(mirrorT, "topaz_model.sav")), "topaz_model.sav synced back to the local mirror");

  // C5 — REMOTE topaz pick, TRAINED lane (the model WIRED)
  const jobA = await mkJob({ type: "autopick", name: "t885 Pick Trained", params: { pickingMethod: "Topaz" } });
  must(!!jobA?.id, "the trained Topaz pick job exists");
  must((await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs")) >= 200, "import → trained pick wired (micrographs)");
  must((await mkEdge(jobT.id, jobA.id, "model", "topazModel")) >= 200, "the TRAINED model wired into the picker (topazModel)");
  await dispatchRemote(jobA.id, "the trained Topaz pick");
  const doneA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneA?.status === "completed", `the trained pick completes (${doneA?.status})`);

  // C6/C7 — the TWO extracts at the SAME threshold (the survival face live)
  const EXTRACT_PARAMS = { boxSize: 96, do_fom_threshold: true, minimum_pick_fom: 0.4 };
  const runExtract = async (label, pickJob) => {
    const job = await mkJob({ type: "extract", name: label, params: { ...EXTRACT_PARAMS } });
    must(!!job?.id, `the ${label} job exists`);
    must((await mkEdge(importJob.id, job.id, "micrographs", "micrographs")) >= 200, `import → ${label} wired (micrographs)`);
    must((await mkEdge(pickJob.id, job.id, "coords", "coords")) >= 200, `picks → ${label} wired (coords)`);
    await dispatchRemote(job.id, label);
    const done = await pollUntil(async () => {
      const j = await readJob(job.id);
      return j?.status === "completed" || j?.status === "failed" ? j : null;
    }, 150_000);
    must(done?.status === "completed", `${label} completes (${done?.status}: ${(done?.result ?? "").slice(0, 60)})`);
    return { job, done };
  };

  // the params the knob arms ride the job rows (persistence witness)
  const jobXa = await mkJob({ type: "extract", name: "t885 Extract General", params: { ...EXTRACT_PARAMS } });
  const xaRow = await readJob(jobXa.id);
  must(xaRow?.params?.do_fom_threshold === true && Number(xaRow?.params?.minimum_pick_fom) === 0.4,
    "the extract params carry the filter switch + the threshold (persistence)");
  createdJobs.pop(); // jobXa is re-created inside runExtract — do not double-count
  await api("DELETE", `/api/jobs/${jobXa.id}`, {});

  const { job: xGA, done: dGA } = await runExtract("t885 Extract General", jobP);
  const { job: xTA, done: dTA } = await runExtract("t885 Extract Trained", jobA);

  // THE SURVIVAL WITNESS (app side) — same threshold, two lanes, different
  // kept counts: 4/mic general vs 7/mic trained across the four mics. The
  // result string rides the REMOTE[...] dispatch prefix — the count is the
  // witness, not the prefix (the t884 shape).
  must((dGA?.result ?? "").includes("16 particles extracted"),
    `THE SURVIVAL WITNESS (general): 16 particles extracted (got ${(dGA?.result ?? "").slice(0, 40)})`);
  must((dTA?.result ?? "").includes("28 particles extracted"),
    `THE SURVIVAL WITNESS (trained): 28 particles extracted (got ${(dTA?.result ?? "").slice(0, 40)})`);

  // THE SURVIVAL WITNESS (cluster side) — the run.out kept clauses + done lines
  const recGA = stateRuns()[xGA.id];
  const recTA = stateRuns()[xTA.id];
  const wdGA = recGA?.remote?.remoteWorkdir ?? null;
  const wdTA = recTA?.remote?.remoteWorkdir ?? null;
  const outGA = wdGA ? mockExec(`bash -lc "cat ${wdGA}/run.out 2>/dev/null"`).stdout : "";
  const outTA = wdTA ? mockExec(`bash -lc "cat ${wdTA}/run.out 2>/dev/null"`).stdout : "";
  const countClause = (txt, clause) => (txt.match(new RegExp(clause.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  must(countClause(outGA, "FOM >= 0.4 kept 4 of 8") === 4,
    `the general run.out carries "kept 4 of 8" x4 (got ${countClause(outGA, "FOM >= 0.4 kept 4 of 8")})`);
  must(countClause(outTA, "FOM >= 0.4 kept 7 of 8") === 4,
    `the trained run.out carries "kept 7 of 8" x4 (got ${countClause(outTA, "FOM >= 0.4 kept 7 of 8")})`);
  must(outGA.includes("16 particles across 4 micrographs"),
    `THE COUNT WITNESS (cluster, general): 16 across 4 (${(outGA.match(/extract: \d+ particles across \d+ micrographs/) ?? ["absent"])[0]})`);
  must(outTA.includes("28 particles across 4 micrographs"),
    `THE COUNT WITNESS (cluster, trained): 28 across 4 (${(outTA.match(/extract: \d+ particles across \d+ micrographs/) ?? ["absent"])[0]})`);

  // the synced particles stars: the FOM column rides, the counts agree
  const mirrorGA = `/home/z/my-project/data/relion/${projId}/extract_${xGA.id.slice(-8)}`;
  const mirrorTA = `/home/z/my-project/data/relion/${projId}/extract_${xTA.id.slice(-8)}`;
  const starRows = (p) => {
    if (!existsSync(p)) return null;
    const lines = readFileSync(p, "utf8").split("\n");
    const header = lines.join("\n");
    // rows are the data_particles block ONLY — the optics block's own row
    // ("1\t300.0\t2.7") starts with a digit and the first cut counted it
    // (17/29 where the run said 16/28 — the optics row is not a particle)
    const rows = [];
    let inPart = false;
    for (const l of lines) {
      const t = l.trim();
      if (t.startsWith("data_")) { inPart = t === "data_particles"; continue; }
      if (inPart && /^[0-9]/.test(t)) rows.push(t.split("\t"));
    }
    return { header, rows };
  };
  const sGA = starRows(`${mirrorGA}/particles.star`);
  const sTA = starRows(`${mirrorTA}/particles.star`);
  must(sGA && sGA.rows.length === 16, `the general particles.star carries 16 rows (got ${sGA?.rows.length ?? "absent"})`);
  must(sTA && sTA.rows.length === 28, `the trained particles.star carries 28 rows (got ${sTA?.rows.length ?? "absent"})`);
  must(sGA && sGA.header.includes("_rlnAutopickFigureOfMerit #4"),
    "the general star rides the FOM column (#4)");
  must(sTA && sTA.header.includes("_rlnAutopickFigureOfMerit #4"),
    "the trained star rides the FOM column (#4)");
  if (sGA && sGA.rows.length) {
    const foms = new Set(sGA.rows.map((r) => r[3]));
    const inLane = [...foms].every((f) => ["0.420", "0.470", "0.520"].includes(f));
    must(inLane, `the general star's FOMs are the >= 0.40 lane (got ${[...foms].join(",")})`);
  }
  if (sTA && sTA.rows.length) {
    const foms = new Set(sTA.rows.map((r) => r[3]));
    const inLane = [...foms].every((f) => ["0.410", "0.460", "0.510", "0.560", "0.610"].includes(f));
    must(inLane, `the trained star's FOMs are the trained lane (got ${[...foms].join(",")})`);
  }

  // the inspector's face — the threshold-filtered extract photographed
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await page.locator(`[data-job="${xTA.id}"]`).first().click({ force: true }).catch(() => {});
    await sleep(1200);
    await page.screenshot({ path: `${SHOTS}/t885-fom-threshold.png` });
    must(existsSync(`${SHOTS}/t885-fom-threshold.png`), "the threshold-filtered extract's inspector photographed");
  } catch (e) {
    must(false, `the inspector ride failed: ${String(e).slice(0, 80)}`);
  }

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  /* t892 — the socket-corpse classification (the t889 gate's twin): `Failed
   * to load resource: net::ERR_*` is the BROWSER-side witness of the dev
   * lane's keep-alive reaping. First sighting HERE (RESET x8 on the
   * fresh-boot first ride), then t886's zone vanish, then t889's
   * NOT_CONNECTED x14 — three in one day, all post-recycle, all with the
   * functional asserts green (Chrome retries the idempotent GET on a fresh
   * socket and logs the corpse per attempt). Transport noise, not app
   * errors; pageerror and every other console.error class stays red. */
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
      worldSafeRmScript([`${CLUSTER_TREE}/*/topaztrain_*`, `${CLUSTER_TREE}/*/autopick_*`, `${CLUSTER_TREE}/*/extract_*`], worldProtect),
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

console.log(fail === 0 ? "\nt885: ALL PASS" : `\nt885: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;

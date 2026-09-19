// t308 — the array pipeline's DOWNSTREAM: class2d eats the merged particle
// star on the cluster (Task 308). t306 taught the dispatch to slice and
// merge; t307 taught it the rows/coords dialects; but no downstream RELION
// job ever CONSUMED a merged shard product on the cluster — the split's
// story ended at the canonical star. This suite closes the loop end to end:
//
//   A   the demo truth (homepage 200, roster 21, mock cluster answering)
//   B   the ledger — the mock's relion_refine grew star-aware teeth (t307
//       did this for preprocess; the refine fake still wrote 40 fake rows
//       and a `--nt` default of 1500 particles the engine never even
//       passes): reads --i, counts the LAST data block's rows (the optics
//       row is never a particle), audits every referenced stack relative to
//       the STAR'S OWN DIR (a torn merge lands headerless or drifted from
//       its extra/ tree — real RELION dies inside HealpixSampling::readStar
//       on exactly this shape), echoes the input ImageName rows into
//       run_data.star with a class column (provenance), and refuses to
//       invent particles. Plus: the twin pass-through that lets a downstream
//       submission reference a merged shard product BY CLUSTER PATH.
//   C0  the sandbox — the fake's four teeth exercised directly (happy
//       provenance echo / missing --i / torn headerless star / drifted
//       stacks), no cluster needed
//   C1  the array pipeline: import (local) → autopick (array 1-3%4) →
//       extract (array 1-2%4), both on the mock cluster — the merged
//       particles.star lands with every referenced stack on disk
//   C2  class2d on the SAME connection, NO split: the submitted script
//       carries --i pointing at the CLUSTER TWIN of the merged star (zero
//       re-upload, no _staged/, no local path leak) and no --array (an
//       ineligible type rides no split); the fake CONSUMES the merged star
//       live — the record's result names the consumed particle count, the
//       output data star echoes the merged star's ImageName rows in order,
//       classes_mrc + particles_star harvest with remote twins
//   C3  the strips on the real page (the downstream terminal word + the
//       upstream split word) + the keepsake shot
//   D   console clean + roster identity
//
// Run: node scripts/t308-array-downstream.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const SHOTS = `${ROOT}/shots-qa`;
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const FAKE = `${ROOT}/services/mock-cluster/fs/opt/bin/relion_refine`;
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};
const SHJ = { ...SH, "Content-Type": "application/json" };
const CONN = "qa-t308-downstream";
const MICS = 12; // 12 micrographs: 4/shard at shards=3, 6/shard at shards=2

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 1500) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000,
  }).stdout?.trim() ?? "";

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};
const writeStateRuns = (runs) => {
  const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const next = raw.runs ? { ...raw, runs } : runs;
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
};

try { execSync("pkill -f agent-browser"); } catch { /* none */ }
await sleep(500);

let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: ROOT, stdio: "pipe" });
  for (let i = 0; i < 40 && !(await mockListening()); i++) await sleep(500);
  weLaunchedMock = true;
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
const badResponses = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("response", (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
});

const createdJobs = [];
const remoteWorkdirs = []; // cluster-side trees this suite created (burned in finally)
const sbatchIds = [];
let connOk = false;
let snap0 = null;
let accPre = "NO";
const getJobs = async () =>
  (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs ?? [];

const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  const b = await r.json();
  if (b.job?.id) createdJobs.push(b.job);
  return b.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await fetch(`${BASE}/api/edges`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
  });
  return r.status;
};

const dispatch = async (jobId, connId, extra = {}) => {
  const r = await fetch(`${BASE}/api/jobs/${jobId}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "slurm", ...extra } }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const journalWord = (id) => {
  try {
    return client(`sacct -j ${id} -n -P -o State,ExitCode`).trim();
  } catch {
    return "";
  }
};
const waitJournal = async (id, want, deadlineMs = 45_000) =>
  pollUntil(() => (journalWord(id).startsWith(want) ? journalWord(id) : null), deadlineMs, 700);

const starDataRows = (txt) =>
  txt
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("data_") && !t.startsWith("loop_") && !t.startsWith("_") && !t.startsWith("#");
    });

try {
  // ---- Phase A: the demo truth ------------------------------------------------
  console.log("== PHASE A: the demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), "the mock cluster answers on :3022");

  snap0 = readFileSync(STATE_FILE, "utf8");
  try {
    accPre = client('test -f "$HOME/.slurm/accounting" && echo YES || echo NO').trim();
    if (accPre === "YES") client('cp "$HOME/.slurm/accounting" "$HOME/.slurm/accounting.t308snap"');
  } catch { accPre = "NO"; }

  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t308 Downstream", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  connOk = mk.status === 201 || mk.status === 200;
  must(connOk, `the probeless connection exists (${mk.status})`);

  // ---- Phase B: the ledger ----------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const fake = readFileSync(FAKE, "utf8");
  const preproc = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/relion_preprocess`, "utf8");
  const src = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const engine = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");

  must(
    preproc.includes("def write_mrc_stack") &&
      preproc.includes('struct.pack_into("<i", header, 4, 2)') &&
      preproc.includes('header[208:212] = b"MAP "'),
    "B: the extract fake writes REAL (renderable) MRC stacks — a stack that exists but cannot be read is a lie the inspector pays for in console errors"
  );

  must(
    fake.includes("if not star_in or not os.path.exists(star_in):") &&
      fake.includes("sys.exit(1)") &&
      fake.includes("refusing to invent particles"),
    "B: the refine fake reads --i and refuses honestly when the input star is absent"
  );
  must(
    fake.includes("rows = blocks[-1] if blocks else []") &&
      fake.includes('if s.startswith("data_"):'),
    "B: the particles are the LAST data block (the optics row is never counted as a particle)"
  );
  must(
    fake.includes("particle stacks are missing relative to the star's dir") &&
      fake.includes("os.path.join(star_dir, stack)") &&
      fake.includes('img.split("@", 1)[1]'),
    "B: the merge-integrity audit resolves every @stack relative to the STAR'S OWN DIR"
  );
  must(
    fake.includes("particles={npart}") &&
      !fake.includes('opts.get("nt"'),
    "B: the header names the REAL consumed count — the --nt default lie (1500 particles the engine never passes) is dead"
  );
  must(
    fake.includes("img = r.split(\"\\t\")[0]") &&
      fake.includes("_rlnClassNumber #2"),
    "B: run_data.star echoes the INPUT rows' ImageName + a class column (provenance, chainable)"
  );
  must(
    engine.includes("class2d: [") &&
      /class2d: \[\s*\{ key: "particles_star", accepts: \["particles_star"\], from: \["extract"/.test(engine),
    "B: the engine's class2d accepts particles_star from extract (the edge contract the chain rides)"
  );
  must(
    src.includes("upstreamRemoteTwins.set(localTw.split(path.sep).join(\"/\"), remoteTw)") &&
      src.includes("if (twin) continue; // already on the cluster (upstream ran there)"),
    "B: the twin pass-through lets a downstream submission reference an upstream output BY CLUSTER PATH (zero re-upload)"
  );

  // ---- Phase C0: the sandbox — the fake's four teeth, no cluster --------------
  console.log("== PHASE C0: the sandbox — four teeth, no cluster ==");
  const box = `${ROOT}/data/relion/t308-sandbox`;
  rmSync(box, { recursive: true, force: true });
  mkdirSync(path.join(box, "extra"), { recursive: true });
  const runFake = (args) =>
    spawnSync("python3", [FAKE, ...args], { cwd: box, encoding: "utf8", timeout: 30_000 });
  // the merged-shape star: optics block (1 row) + particles block (3 rows,
  // ImageName relative to the star's dir — the shape the rows merge writes)
  writeFileSync(
    path.join(box, "merged.star"),
    "data_optics\n\nloop_\n_rlnOpticsGroup #1\n_rlnVoltage #2\n1\t300\n\ndata_particles\n\nloop_\n_rlnImageName #1\n_rlnCoordinateX #2\n_rlnCoordinateY #3\n" +
      [
        "000001@extra/mic-01_extract.mrcs\t10\t20",
        "000002@extra/mic-02_extract.mrcs\t30\t40",
        "000003@extra/mic-01_extract.mrcs\t50\t60",
      ].join("\n") + "\n"
  );
  for (const s of ["mic-01_extract.mrcs", "mic-02_extract.mrcs"]) {
    writeFileSync(path.join(box, "extra", s), "x");
  }
  const happy = runFake(["--i", "merged.star", "--o", "./run", "--K", "2", "--iter", "1"]);
  must(happy.status === 0 && happy.stdout.includes("particles=3 iters=1"),
    `C0: the fake consumes the merged-shape star — optics row NOT counted (particles=3, exit ${happy.status})`);
  const echoed = existsSync(path.join(box, "run_data.star"))
    ? starDataRows(readFileSync(path.join(box, "run_data.star"), "utf8"))
    : [];
  must(
    echoed.length === 3 && echoed.every((l) => l.includes("@extra/")) && /@extra\/\S+\t[12]\t/.test(echoed[0]),
    "C0: the output data star echoes the input ImageName rows with a class column (provenance)"
  );
  const noInput = runFake(["--o", "./x"]);
  must(noInput.status === 1 && noInput.stderr.includes("refusing to invent particles"),
    "C0: a missing --i refuses to invent particles (exit 1, honest stderr)");
  writeFileSync(path.join(box, "torn.star"), "000001@extra/mic-01_extract.mrcs\t10\t20\n000002@extra/mic-02_extract.mrcs\t30\t40\n");
  const torn = runFake(["--i", "torn.star", "--o", "./x"]);
  must(torn.status === 1 && torn.stderr.includes("no particle rows"),
    "C0: a torn headerless star (the t307 flock-race shape) refuses with a legible word");
  writeFileSync(path.join(box, "drift.star"), "data_particles\n\nloop_\n_rlnImageName #1\n000001@extra/mic-99_extract.mrcs\t10\t20\n000002@extra/mic-98_extract.mrcs\t30\t40\n");
  const drift = runFake(["--i", "drift.star", "--o", "./x"]);
  must(drift.status === 1 && drift.stderr.includes("particle stacks are missing relative to the star's dir"),
    "C0: a star drifted from its extra/ tree is audited, not silently classified");

  // ---- Phase C1: the array pipeline — pick in 3 shards, extract in 2 ----------
  console.log("== PHASE C1: pick in 3 shards, extract in 2 ==");
  const micsDir = `${ROOT}/data/relion/t308-array/mics`;
  mkdirSync(micsDir, { recursive: true });
  for (let i = 1; i <= MICS; i++) {
    execSync(
      `node -e "const fs=require('fs');const b=Buffer.alloc(1024+64,0);b.write('mrc ',208);b.writeInt32LE(64,0);b.writeInt32LE(64,4);b.writeInt32LE(1,8);b.writeInt32LE(0,16);b.writeInt32LE(4,92);fs.writeFileSync('${micsDir}/mic-${String(i).padStart(2, "0")}.mrc',b)"`,
      { cwd: ROOT, stdio: "pipe" }
    );
  }
  const a0 = await mkJob({ type: "import", name: "t308 Import A0", params: { micrographsPath: micsDir, pixelSize: 1.77 }, x: 80, y: 80 });
  remoteWorkdirs.push(`/projects/cryoflow/${a0.projectId}/import_${a0.id.slice(-8)}`);
  const runA0 = await fetch(`${BASE}/api/jobs/${a0.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runA0.status === 200, `A0 imports locally (${runA0.status})`);
  const a0done = await pollUntil(async () => (await getJobs()).find((j) => j.id === a0.id)?.status, 30_000);
  must(a0done === "completed", `A0 completed — the provider has ${MICS} micrographs (got ${a0done})`);

  const p1 = await mkJob({ type: "autopick", name: "t308 Pick P1", params: { pickingMethod: "Laplacian of Gaussian" }, x: 340, y: 80 });
  remoteWorkdirs.push(`/projects/cryoflow/${p1.projectId}/autopick_${p1.id.slice(-8)}`);
  must(await mkEdge(a0.id, p1.id, "micrographs", "micrographs") === 201, "P1: the provider edge stands (201)");
  const disp1 = await dispatch(p1.id, CONN, { shards: 3 });
  must(disp1.status === 200 && !disp1.body?.error,
    `P1: the split dispatch went through (status ${disp1.status}, err=${disp1.body?.error ?? "-"})`);
  const rec1 = await pollUntil(() => {
    const r = stateRuns()[p1.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  must(!!rec1, "P1: the submission has a scheduler id");
  const sId1 = rec1?.remote?.slurmId;
  sbatchIds.push(Number(sId1));
  const master1 = await waitJournal(sId1, "COMPLETED", 60_000);
  must((master1 ?? "").startsWith("COMPLETED"), `P1: the MASTER row is COMPLETED (${master1 ?? "no row"})`);
  const done1 = await pollUntil(async () => (await getJobs()).find((j) => j.id === p1.id)?.status === "completed" ? "completed" : null, 90_000);
  must(done1 === "completed", `P1: the sweep finalized the array (got ${done1 ?? "still running"})`);
  const rec1b = stateRuns()[p1.id];
  must(rec1b?.done === true && rec1b?.exitCode === 0 && String(rec1b?.result ?? "").includes(`across ${MICS} micrographs`),
    `P1: the record finalized with all ${MICS} micrographs picked (result ${String(rec1b?.result).slice(0, 50)})`);

  const e2 = await mkJob({ type: "extract", name: "t308 Extract E2", params: { boxSize: 128, downsampleTo: 0 }, x: 600, y: 80 });
  remoteWorkdirs.push(`/projects/cryoflow/${e2.projectId}/extract_${e2.id.slice(-8)}`);
  must(await mkEdge(a0.id, e2.id, "micrographs", "micrographs") === 201, "E2: the micrographs edge stands (201)");
  must(await mkEdge(p1.id, e2.id, "coords", "coords") === 201, "E2: the coords edge from the SPLIT pick stands (201)");
  const disp2 = await dispatch(e2.id, CONN, { shards: 2 });
  must(disp2.status === 200 && !disp2.body?.error,
    `E2: the split dispatch went through (status ${disp2.status}, err=${disp2.body?.error ?? "-"})`);
  const rec2 = await pollUntil(() => {
    const r = stateRuns()[e2.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  const sId2 = rec2?.remote?.slurmId;
  sbatchIds.push(Number(sId2));
  must(!!rec2, "E2: the submission has a scheduler id");
  const master2 = await waitJournal(sId2, "COMPLETED", 60_000);
  must((master2 ?? "").startsWith("COMPLETED"), `E2: the MASTER row is COMPLETED (${master2 ?? "no row"})`);
  const done2 = await pollUntil(async () => (await getJobs()).find((j) => j.id === e2.id)?.status === "completed" ? "completed" : null, 90_000);
  must(done2 === "completed", `E2: the sweep finalized the array (got ${done2 ?? "still running"})`);
  const rec2b = stateRuns()[e2.id];
  must(rec2b?.done === true && rec2b?.exitCode === 0, `E2: the record finalized done/exit 0 (exit ${rec2b?.exitCode})`);
  // the merged star's honesty (t307's own witnesses, replayed as the setup):
  // expected rows from the fake's per-mic formula (n = index WITHIN a
  // shard's slice — 6 mics per shard here), stacks all on disk, zero ../
  const perMic = (n) => 8 + ((n * 2) % 5);
  const perShard = 6;
  const expectRows = 2 * Array.from({ length: perShard }, (_, i) => perMic(i + 1)).reduce((a, b) => a + b, 0);
  const mergedLocal = rec2b?.outputs?.particles_star;
  let mergedRowsTxt = "";
  let mergedRows = -1;
  if (mergedLocal && existsSync(mergedLocal)) {
    mergedRowsTxt = readFileSync(mergedLocal, "utf8");
    mergedRows = starDataRows(mergedRowsTxt).filter((l) => l.includes("@")).length;
  }
  must(
    mergedRows === expectRows,
    `C1: the merged particles.star lists ALL ${expectRows} particles across ${MICS} mics (got ${mergedRows})`
  );
  must(
    mergedRowsTxt && !starDataRows(mergedRowsTxt).some((l) => l.includes("@../")),
    "C1: NO ../ survives the rows merge (paths are relative to the star's own dir)"
  );
  const mergedImages = mergedRowsTxt
    ? starDataRows(mergedRowsTxt).filter((l) => l.includes("@")).map((l) => l.split("\t")[0])
    : [];

  // ---- Phase C2: class2d on the SAME connection — the merged star is eaten ----
  console.log("== PHASE C2: class2d consumes the merged star on the cluster ==");
  const c3 = await mkJob({
    type: "class2d", name: "t308 Class2D C3",
    params: { numClasses: 4, iterations: 3 },
    x: 860, y: 80,
  });
  remoteWorkdirs.push(`/projects/cryoflow/${c3.projectId}/class2d_${c3.id.slice(-8)}`);
  must(await mkEdge(e2.id, c3.id, "particles", "particles") === 201,
    "C3: the particles edge from the SPLIT extract stands (201 — the REGISTRY's port name, not the engine key)");
  const disp3 = await dispatch(c3.id, CONN);
  must(disp3.status === 200 && !disp3.body?.error,
    `C3: the plain dispatch went through (status ${disp3.status}, err=${disp3.body?.error ?? "-"})`);
  const rec3 = await pollUntil(() => {
    const r = stateRuns()[c3.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  must(!!rec3, "C3: the submission has a scheduler id");
  const sId3 = rec3?.remote?.slurmId;
  sbatchIds.push(Number(sId3));
  must(rec3?.remote?.slurmArray === undefined, "C3: the record carries NO slurmArray (an ineligible type rides no split)");
  const script3 = client(`cat /projects/cryoflow/${c3.projectId}/class2d_${c3.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);
  const mergedTwin = `/projects/cryoflow/${c3.projectId}/extract_${e2.id.slice(-8)}/particles.star`;
  must(
    script3.includes(`--i ${mergedTwin}`) || script3.includes(`--i '${mergedTwin}'`) || script3.includes(mergedTwin),
    "C3: the SUBMITTED script's --i is the CLUSTER TWIN of the merged star (by reference)"
  );
  must(!script3.includes("/_staged/"), "C3: the merged star was NOT re-uploaded (no _staged/ detour)");
  must(!script3.includes("data/relion"),
    "C3: the command carries no LOCAL twin path (the mock's sbatch rewrites cluster paths to its host fs — that is the mock's dialect, not a leak; a twin-map failure would leak data/relion)");
  must(!script3.includes("#SBATCH --array="), "C3: the submission carries NO array directive");
  const master3 = await waitJournal(sId3, "COMPLETED", 60_000);
  must((master3 ?? "").startsWith("COMPLETED"), `C3: the MASTER row is COMPLETED — the fake consumed the star and lived (${master3 ?? "no row"})`);
  const done3 = await pollUntil(async () => (await getJobs()).find((j) => j.id === c3.id)?.status === "completed" ? "completed" : null, 90_000);
  must(done3 === "completed", `C3: the sweep finalized the run (got ${done3 ?? "still running"})`);
  const rec3b = stateRuns()[c3.id];
  must(rec3b?.done === true && rec3b?.exitCode === 0, `C3: the record finalized done/exit 0 (exit ${rec3b?.exitCode})`);
  must(
    typeof rec3b?.result === "string" && rec3b.result.includes(`${expectRows} particles`),
    `C3: the record's result names the CONSUMED count — ${expectRows} particles classified (got ${String(rec3b?.result).slice(0, 80)})`
  );
  must(
    !!rec3b?.outputs?.classes_mrc && existsSync(rec3b.outputs.classes_mrc),
    `C3: classes_mrc harvested + synced home (${rec3b?.outputs?.classes_mrc ?? "absent"})`
  );
  must(
    !!rec3b?.outputs?.particles_star && existsSync(rec3b.outputs.particles_star),
    "C3: the classified data star harvested as a chainable particles_star"
  );
  must(
    !!rec3b?.remote?.remoteOutputs?.classes_mrc && !!rec3b?.remote?.remoteOutputs?.particles_star,
    "C3: the remote output twins exist (a downstream remote job could chain by reference)"
  );
  // the deep honesty witness: the classified star echoes the merged star's
  // ImageName rows — same count, same order (provenance across the split
  // boundary: pick shards → coords collection → extract shards → rows merge
  // → classification)
  let classImages = [];
  if (rec3b?.outputs?.particles_star && existsSync(rec3b.outputs.particles_star)) {
    classImages = starDataRows(readFileSync(rec3b.outputs.particles_star, "utf8"))
      .filter((l) => l.includes("@"))
      .map((l) => l.split("\t")[0]);
  }
  must(
    classImages.length === expectRows,
    `C3: the classified star lists ${expectRows} particles (got ${classImages.length})`
  );
  must(
    classImages.length > 0 && classImages.join("\n") === mergedImages.join("\n"),
    "C3: PROVENANCE — the classified rows are the merged star's rows, in order (pick → extract → classify, one identity)"
  );

  // ---- Phase C3: the strips on the real page -----------------------------------
  console.log("== PHASE C3: the strips speak ==");
  const strip = await pollUntil(async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    const card = page.locator("[data-job]", { hasText: "t308 Class2D C3" }).locator('[role="button"]').first();
    try { await card.click({ timeout: 6000, force: true }); } catch { return null; }
    await sleep(1200);
    const body = await page.locator("body").innerText();
    return body.includes("Ran on the cluster") && body.includes("Slurm COMPLETED") ? body : null;
  }, 45_000, 2500);
  must(!!strip, "C3: the downstream terminal strip speaks ('Ran on the cluster · Slurm COMPLETED')");
  must(!!strip && strip.includes("2D classification finished"), "C3: the inspector also speaks the class summary");
  await page.screenshot({ path: `${SHOTS}/t308-downstream-strip.png` }).catch(() => {});
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" }); // fresh page — the class2d inspector must not swallow the click
    await sleep(2200);
    const card2 = page.locator("[data-job]", { hasText: "t308 Extract E2" }).locator('[role="button"]').first();
    await card2.click({ timeout: 6000, force: true });
    await sleep(1200);
    const body2 = await page.locator("body").innerText();
    must(body2.includes("array 1-2%4"), "C3: the upstream extract strip still speaks the split ('· array 1-2%4')");
    await page.screenshot({ path: `${SHOTS}/t308-extract-array-strip.png` }).catch(() => {});
  } catch { /* best effort */ }

  // ---- Phase D: the hygiene ----------------------------------------------------
  console.log("== PHASE D: the hygiene ==");
  must(consoleErrors.length === 0, `console errors 0 (got ${consoleErrors.length}${consoleErrors.length ? `: ${consoleErrors[0]}` : ""})`);
  if (consoleErrors.length > 0) {
    const idType = new Map(createdJobs.map((j) => [j.id, j.type ?? "?"]));
    const counts = badResponses.reduce((m, u) => {
      const key = u.startsWith(`${BASE}/api/jobs/`)
        ? u.replace(`${BASE}/api/jobs/`, "").replace(/[a-z0-9]{20,30}/, (mm) => idType.get(mm) ?? mm)
        : u;
      m.set(key, (m.get(key) ?? 0) + 1);
      return m;
    }, new Map());
    for (const [u, n] of counts) console.log(`    (probe) ${n}× ${u}`);
    // replay the first failing URL from Node — the route's own error body
    // names the refusal (the console only says "400")
    const first = badResponses[0].replace(/^\d+ /, "");
    try {
      const rr = await fetch(first, { headers: SH });
      console.log(`    (replay) ${rr.status} ${await rr.text()}`);
    } catch (e) {
      console.log(`    (replay) transport failure: ${e.message}`);
    }
  }
} finally {
  console.log("== cleanup ==");
  try {
    if (snap0 != null) writeStateRuns(JSON.parse(snap0).runs ?? JSON.parse(snap0));
  } catch { /* best effort */ }
  for (const j of [...createdJobs].reverse()) {
    try {
      await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE", headers: SH });
    } catch { /* best effort */ }
  }
  try {
    await fetch(`${BASE}/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
  try {
    const parts = [
      // BOTH trees the suite touches cluster-side (the t309 correction of
      // t308's own comment: the workdirs live under the PROJECT id — a
      // /projects/cryoflow/t308-array rm never matched them — BUT the same
      // path is ALSO the STAGED INPUT MIRROR of data/relion/t308-array, and
      // THAT is real: this window found it still on disk with all 12 mics.
      // the API job delete cleans the LOCAL twin only; the mirror rm was
      // dropped along with the aspirational one and the residue compounded)
      "rm -rf /projects/cryoflow/t308-array",
      ...remoteWorkdirs.map((wd) => `rm -rf ${wd}`),
      // + the staged provider copies — every dispatch stages its input chain
      // at the provider's mapped path (import_* dirs), the t30 batch's own
      // residue proved no suite burned those (the t309 lesson, upgraded)
      "rm -rf /projects/cryoflow/*/autopick_* /projects/cryoflow/*/extract_* /projects/cryoflow/*/class2d_* /projects/cryoflow/*/import_*",
    ];
    for (const id of sbatchIds) {
      parts.push(`rm -f "$HOME/.slurm/job-${id}."* "$HOME/.slurm/.launch-${id}.sh"`);
      parts.push(`rm -f "$HOME/.slurm/job-${id}_"* 2>/dev/null`);
    }
    parts.push('rm -f "$HOME/.slurm/"job-*.cancelled');
    if (accPre === "YES") {
      parts.push('mv "$HOME/.slurm/accounting.t308snap" "$HOME/.slurm/accounting" 2>/dev/null || true');
    } else {
      parts.push('rm -f "$HOME/.slurm/accounting"');
    }
    parts.push('rm -f "$HOME/.slurm/accounting.t308snap"');
    // dead bookkeeping sweep — accounting and next-id are the mock's MEMORY
    // and stay (the t309 lesson)
    parts.push('rm -f "$HOME/.slurm/"job-*.sh "$HOME/.slurm/"job-*.pid "$HOME/.slurm/"job-*.name "$HOME/.slurm/"job-*.start "$HOME/.slurm/"job-*.state "$HOME/.slurm/".launch-*.sh 2>/dev/null || true');
    // the project shell leaves only if WE emptied it (rmdir, never rm -rf)
    parts.push(...[...new Set(remoteWorkdirs.map((wd) => wd.replace(/\/[^/]+$/, "")))]
      .map((p) => `rmdir ${p} 2>/dev/null || true`));
    client(parts.join("; "));
    // the residue guard: loud, not load-bearing (the t309 lesson)
    const leftover = client("ls -A /projects/cryoflow 2>/dev/null");
    if (leftover) console.log(`  (cleanup) RESIDUE left on the cluster: ${leftover.split(/\s+/).filter(Boolean).join(", ")}`);
  } catch { /* best effort */ }
  try { rmSync(`${ROOT}/data/relion/t308-array`, { recursive: true, force: true }); } catch { /* gone */ }
  try { rmSync(`${ROOT}/data/relion/t308-sandbox`, { recursive: true, force: true }); } catch { /* gone */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
  await sleep(1200);
  try {
    const n = (await getJobs()).length;
    must(n === 21, `roster restored to 21 (got ${n})`);
  } catch { /* server busy */ }
  await browser.close().catch(() => {});
}

console.log(fail === 0 ? "\nT308 ALL PASS" : `\nT308 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

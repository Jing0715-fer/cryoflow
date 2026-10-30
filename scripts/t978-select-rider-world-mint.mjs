#!/usr/bin/env node
/**
 * t978 — the SELECT-RIDER WORLD mint (mint|verify|remove): the completed
 * classification pair that arms the HIDDEN SELECT RIDER's browser
 * witness (the t975 recorded-not-cured ①, the (d′) candidate — the
 * t954 unit pins the gate's logic node-only; until this mint the
 * CURRENT world had never seen a completed class job at all).
 *
 * THE WORLD'S NINTH and TENTH jobs (+ two idle children — the
 * select-shaped graph the t975 note asked for):
 *
 *   NINTH  class2d "2D Classification 1 (t978)" completed, K=4
 *          (1200 particles: 480/300/240/180 → .40/.25/.20/.15)
 *   TENTH  class3d "3D Classification 1 (t978)" completed, K=3
 *          (the same 1200: 420/540/240 → .35/.45/.20)
 *   C      "Classes Consumer (t978)" select2d IDLE —
 *          NINTH.classAverages → C.classes (the t952 classes-mouth
 *          shape: the class2d host's rider plan REFUSES it — the
 *          all-refused disabled speech's seat)
 *   P      "Particles Consumer (t978)" select2d IDLE —
 *          TENTH.particles → P.particles (the t954 friendly twin:
 *          the class3d host's ONLY downstream wire, which the rider's
 *          mint plan would MOVE — the counter-proof, live)
 *
 * THE TWO FACES the pair arms (the totals are EQUAL — one population,
 * classified in 2D and in 3D — so the join pairs cleanly and the only
 * difference between the faces is the GATE, never the data):
 *
 *   · host = NINTH (class2d): improved = {Class 002} (0.25 → 0.45) —
 *     selectWired TRUE, plan refuses C's classes-mouth wire (the mint
 *     declares ONE output, particles) → the rider RENDERS DISABLED,
 *     title verbatim "All 1 downstream wire(s) refused — port".
 *   · host = TENTH (class3d): improved = {Class 001} (0.35 → 0.40) —
 *     improvedSeries.length > 0 AND selectWired FALSE (class3d has no
 *     references2d output — the classes mouth starves) → the rider's
 *     SEAT IS ABSENT while the plan would enable (the t954 M-pin's
 *     live twin: moves=1 on P's wire, refused=0). THE SHARPEST
 *     ABSENCE — the hiding is the mouth-coverage gate's choice, not a
 *     data verdict.
 *
 * The workdirs speak the ROUTES' own dialects: run_it002_data.star
 * (the occupancy route's class-count source, optics block included),
 * run_it002_model.star + run_it002_optimiser.star (the settled-round
 * witnesses latestIterationDataStar demands), run_it002_classes.mrcs
 * (the class2d gallery's combined-stack lane, 4 slices) and
 * run_it002_classNNN.mrc (the class3d t402b per-class volume lane).
 * One iteration only — the convergence door's two-round ladder is
 * another face, deliberately un-armed.
 *
 *   node scripts/t978-select-rider-world-mint.mjs mint|verify|remove
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME_A = "2D Classification 1 (t978)";
const NAME_B = "3D Classification 1 (t978)";
const NAME_C = "Classes Consumer (t978)";
const NAME_P = "Particles Consumer (t978)";
const SUFFIX_RE = /\(t978\)$/;
const PROJECT_ID = process.env.MINT_PROJECT_ID ?? "cmv6ml09e0000kn9mgxrsun5w"; // the standing world (the doctor's ACTIVE)
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");
const MANIFEST = path.join(process.cwd(), "data", "t978-select-rider-world.json");
const TOTAL = 1200;

/* the occupancy law — the pair's whole arithmetic. Both runs classify
 * the SAME 1200-particle population; the fractions are exact decimal
 * shares (count/1200), so the join's deltas are the numbers below. */
const A_COUNTS = { 1: 480, 2: 300, 3: 240, 4: 180 }; // class2d K=4
const B_COUNTS = { 1: 420, 2: 540, 3: 240 }; // class3d K=3

const RESULT_A =
  "2D classification completed: 1200 particles into 4 classes over 2 iterations (the t978 select-rider world's class2d face)";
const RESULT_B =
  "3D classification completed: 1200 particles into 3 classes over 2 iterations (the t978 select-rider world's class3d face)";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass += 1; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail += 1; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const near = (x, y, eps = 1e-9) => Math.abs(x - y) < eps;

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim(); }
  catch (e) { return `ERR:${String(e.message).slice(0, 300)}`; }
};
const api = (method, url, body) => {
  const out = execSync(
    `curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`,
    { encoding: "utf8", timeout: 60_000 }
  );
  try { return JSON.parse(out); } catch { return { raw: String(out).slice(0, 200) }; }
};
const jobs = () => {
  const body = api("GET", "/api/jobs");
  return (Array.isArray(body) ? body : body.jobs ?? []);
};
const edges = () => {
  const body = api("GET", "/api/edges");
  return (Array.isArray(body) ? body : body.edges ?? []);
};
const jobByName = (name) => jobs().find((j) => j.name === name) ?? null;

/* --------------------------------------------------------------- stars */
/* the data star's two-block RELION dialect: the optics block first (one
 * group), then the particles loop — the classes route scopes its count
 * to the loop that owns _rlnClassNumber (the optics row never inflates
 * a class), and the label hunt is by NAME, not position. Rows interleave
 * the classes round-robin (particle order, not block order). */
function dataStar(counts) {
  const rows = [];
  const classes = Object.keys(counts).map(Number).sort((x, y) => x - y);
  const remaining = new Map(classes.map((c) => [c, counts[c]]));
  let left = classes.reduce((s, c) => s + counts[c], 0);
  let i = 0;
  while (left > 0) {
    for (const c of classes) {
      const r = remaining.get(c) ?? 0;
      if (r <= 0) continue;
      i += 1;
      remaining.set(c, r - 1);
      left -= 1;
      rows.push(`${String(i).padStart(6, "0")}@Extract/job017/particles_extract.star\t${c}\t${(8000 + ((i * 37) % 900)).toFixed(0)}`);
    }
  }
  return [
    "data_optics",
    "",
    "loop_",
    "_rlnOpticsGroup #1",
    "_rlnOpticsGroupName #2",
    "_rlnAmplitudeContrast #3",
    "_rlnVoltage #4",
    "1\t opticsGroup1\t0.144\t300",
    "",
    "data_particles",
    "",
    "loop_",
    "_rlnImageName #1",
    "_rlnClassNumber #2",
    "_rlnDefocusU #3",
    ...rows,
    "",
  ].join("\n");
}

/* the settled-round witnesses latestIterationDataStar demands (optimiser
 * OR model OR half1_model next to the data star). The model star speaks
 * the class table's honest minimal shape. */
const modelStar = (counts) => {
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  const rows = Object.keys(counts).map(Number).sort((x, y) => x - y)
    .map((c) => `${c}\t${(counts[c] / total).toFixed(5)}\t${(3 + c * 0.7).toFixed(2)}\t${(0.8 + c * 0.2).toFixed(2)}`);
  return [
    "data_model_classes",
    "",
    "loop_",
    "_rlnClassIndex #1",
    "_rlnClassDistribution #2",
    "_rlnAccuracyRotations #3",
    "_rlnAccuracyTranslationsAngstrom #4",
    ...rows,
    "",
  ].join("\n");
};
const optimiserStar = (iter) => [
  "data_model_general",
  "",
  "loop_",
  "_rlnIterationNumber #1",
  String(iter),
  "",
].join("\n");

/* a minimal but VALID MRC2014 map (the parser's own geometry: mode 2 =
 * float32, nsymbt 0, the data block exactly nx·ny·nz·4 bytes) — the
 * class2d gallery's combined stack (nz = K slices) and the class3d
 * t402b per-class volumes (a cube each). */
function mrcFile(nx, ny, nz) {
  const buf = Buffer.alloc(1024 + nx * ny * nz * 4);
  buf.writeInt32LE(nx, 0);
  buf.writeInt32LE(ny, 4);
  buf.writeInt32LE(nz, 8);
  buf.writeInt32LE(2, 12); // mode float32
  buf.writeInt32LE(0, 16); buf.writeInt32LE(0, 20); buf.writeInt32LE(0, 24); // start
  buf.writeFloatLE(64.0, 40); buf.writeFloatLE(64.0, 44); buf.writeFloatLE(64.0, 48); // cella
  buf.writeFloatLE(-1.0, 76); buf.writeFloatLE(1.0, 80); buf.writeFloatLE(0.0, 84);
  buf.writeInt32LE(0, 92); // nsymbt
  buf.write("MAP ", 208, "ascii");
  buf.write("DA", 212, "ascii");
  buf.writeFloatLE(0.5, 216); // rms
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const v = Math.sin((x + 1) * 0.7 + z * 1.3) * Math.cos((y + 1) * 0.5);
        buf.writeFloatLE(v, 1024 + (z * ny + y) * nx * 4 + x * 4);
      }
    }
  }
  return buf;
}

/* the completed faces' honest chatter — NO signature-pattern words (the
 * mirror's 16 patterns stay silent by construction on a completed run) */
const runOutFor = (kind, k, iter) => [
  `RELION: ${kind === "class2d" ? "2D" : "3D"} classification (the t978 select-rider world)`,
  `  command: mpirun -n 2 relion_refine_mpi --o ${kind === "class2d" ? "Class2D" : "Class3D"}/job018 --K ${k} --iter ${iter}`,
  `  1,200 particles in the input star · ${k} classes · 2 MPI ranks x 3 threads · one GPU device per rank`,
  "",
  "[2026-10-13 21:30:02.114] MPI rank 000: loading 1200 particles ... done (0.4 GB resident per rank)",
  "[2026-10-13 21:30:44.890] MPI rank 000: reference read (box 64, angpix 1.24) — low-pass filtered to 40 A for the first round",
  "",
  "[2026-10-13 21:30:45.010] === Iteration 1 of " + iter + " ===",
  "  0.01/0.05 hrs — Expectation step: 1200/1200 particles assigned (100%)",
  "[2026-10-13 21:31:12.400] class distribution written (run_it001_data.star)",
  "",
  "[2026-10-13 21:31:20.060] === Iteration 2 of " + iter + " ===",
  "  0.05/0.11 hrs — Expectation step: 1200/1200 particles assigned (100%)",
  "[2026-10-13 21:31:58.770] class distribution written (run_it002_data.star)",
  "[2026-10-13 21:32:03.150] current resolution at gold-standard FSC=0.143: 18.4 A",
  "[2026-10-13 21:32:05.002] Done — wrote run_it002_data.star, run_it002_model.star, run_it002_optimiser.star",
  "",
].join("\n");

/* ---------------------------------------------------------- records */
const writeRunRecord = (jobId, type, workdir, result) => {
  const record = {
    jobId,
    projectId: PROJECT_ID,
    type,
    pid: null,
    cmd: `mpirun -n 2 relion_refine_mpi --K ${type === "class2d" ? 4 : 3}  # the t978 select-rider world`,
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date(Date.now() - 130_000).toISOString(),
    outputs: {},
    done: true,
    exitCode: 0,
    result,
  };
  const runs = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  runs[jobId] = record;
  const tmp = `${STATE_FILE}.t978.tmp`;
  writeFileSync(tmp, JSON.stringify(runs, null, 2));
  execSync(`mv "${tmp}" "${STATE_FILE}"`); // rename defeats the half-written read (the t963 lesson)
  return record;
};

const flipRow = (jobId, result) =>
  spawnSync(
    "node",
    [
      "-e",
      `const { PrismaClient } = require("@prisma/client");
       const db = new PrismaClient();
       db.job.update({
         where: { id: process.argv[1] },
         data: { status: "completed", progress: 100, result: process.env.T978_RESULT },
       }).then(() => db.$disconnect()).catch((e) => { console.error(String(e)); process.exit(1); });`,
      jobId,
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${process.cwd()}/db/cryoflow.db`, T978_RESULT: result },
      encoding: "utf8",
      timeout: 30_000,
    }
  );

/* ------------------------------------------------------------ shared */
const classesOf = (id) => api("GET", `/api/jobs/${id}/classes`);
const nearFrac = (got, want) => near(got, want, 1e-6);

const checkClassesRoute = (jobId, counts, expect) => {
  const body = classesOf(jobId);
  ok(`${expect.label} classes route answers`, !body.error && Array.isArray(body.classes), `${body.classes?.length ?? 0} classes`);
  const list = body.classes ?? [];
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  ok(`${expect.label} total ${total}`, body.total === total, String(body.total));
  const ks = Object.keys(counts).map(Number).sort((x, y) => x - y);
  ok(`${expect.label} speaks ${ks.length} classes`, list.length === ks.length, list.map((c) => c.cls).join(","));
  for (const k of ks) {
    const row = list.find((c) => c.cls === k);
    ok(`${expect.label} class ${k} count ${counts[k]}`, !!row && row.count === counts[k], row ? String(row.count) : "missing");
    ok(`${expect.label} class ${k} fraction ${(counts[k] / total).toFixed(2)}`, !!row && nearFrac(row.fraction, counts[k] / total), row ? row.fraction.toFixed(4) : "missing");
  }
  if (expect.stack) {
    ok(`${expect.label} names the combined stack (${expect.stackName})`, body.classesFile === expect.stackName, body.classesFile ?? "null");
    ok(`${expect.label} stack slices ${expect.stackSlices}`, body.classesSlices === expect.stackSlices, String(body.classesSlices));
  }
  if (expect.volumes) {
    ok(`${expect.label} speaks the per-class volume lane (${expect.volumes.length} volumes)`,
      Array.isArray(body.volumeFiles) && body.volumeFiles.length === expect.volumes.length,
      (body.volumeFiles ?? []).join(","));
  }
  return body;
};

const workdirOf = (type, jobId) => path.join(DATA_ROOT, `${type}_${jobId.slice(-8)}`);

/* ------------------------------------------------------------ guards */
let PRE_EDGES = 0;
let PRE_JOBS = 0;
function guards() {
  const probe = api("GET", "/api/jobs");
  ok("guard: server answers", !probe.error && (Array.isArray(probe) || Array.isArray(probe.jobs)));
  PRE_EDGES = edges().length;
  const stale = jobs().filter((j) => SUFFIX_RE.test(j.name ?? ""));
  ok("guard: no stale t978 mints", stale.length === 0, stale.length ? stale.map((s) => s.name).join(", ") : "");
  if (stale.length) { console.log("FATAL: singular-world guard — remove first"); process.exit(2); }
  ok("guard: the world holds 12 jobs pre-mint (the t1075 replant re-key — 3 starter + the nine standing faces)", jobs().length === 12, String(jobs().length));
  PRE_JOBS = jobs().length;
  if (fail > 0) { console.log("FATAL: guards failed"); process.exit(2); }
}

/* ------------------------------------------------------------ mint */
if (process.argv[2] === "mint") {
  console.log("== t978 select-rider world mint — mint ==");
  guards();

  // 1. NINTH — the class2d face
  // (the t1077 lesson: (1960,1600) is the t995 custom-error face's own
  // seat — the birth-world's rider stacked on a standing face and the
  // later-DOM rider ATE the face's clicks (the walks' realClick hit the
  // rider's inspector). The rider seats at (1960,1440): the free slot
  // between the t976 cancelled face (1320) and the t995 face (1600) —
  // same column, no collision, the rider grid intact.)
  const madeA = api("POST", "/api/jobs", { type: "class2d", name: NAME_A, x: 1960, y: 1440 });
  ok("NINTH (class2d) created", !!madeA.job?.id, madeA.job?.id?.slice(-8));
  if (!madeA.job?.id) process.exit(2);
  const a = madeA.job;

  // 2. TENTH — the class3d face
  const madeB = api("POST", "/api/jobs", { type: "class3d", name: NAME_B, x: 1960, y: 1880 });
  ok("TENTH (class3d) created", !!madeB.job?.id, madeB.job?.id?.slice(-8));
  if (!madeB.job?.id) process.exit(2);
  const b = madeB.job;

  // 3. the workdirs — the routes' own dialects
  const wdA = workdirOf("class2d", a.id);
  mkdirSync(wdA, { recursive: true });
  writeFileSync(path.join(wdA, "run_it002_data.star"), dataStar(A_COUNTS));
  writeFileSync(path.join(wdA, "run_it002_model.star"), modelStar(A_COUNTS));
  writeFileSync(path.join(wdA, "run_it002_optimiser.star"), optimiserStar(2));
  writeFileSync(path.join(wdA, "run_it002_classes.mrcs"), mrcFile(64, 64, 4)); // the combined stack — 4 slices
  writeFileSync(path.join(wdA, "run.out"), runOutFor("class2d", 4, 2));
  writeFileSync(path.join(wdA, "run.err"), "");
  writeRunRecord(a.id, "class2d", wdA, RESULT_A);
  ok("NINTH workdir written (data + model + optimiser + classes.mrcs)", true, wdA.replace(process.cwd() + "/", ""));

  const wdB = workdirOf("class3d", b.id);
  mkdirSync(wdB, { recursive: true });
  writeFileSync(path.join(wdB, "run_it002_data.star"), dataStar(B_COUNTS));
  writeFileSync(path.join(wdB, "run_it002_model.star"), modelStar(B_COUNTS));
  writeFileSync(path.join(wdB, "run_it002_optimiser.star"), optimiserStar(2));
  for (const k of [1, 2, 3]) {
    writeFileSync(path.join(wdB, `run_it002_class00${k}.mrc`), mrcFile(32, 32, 32)); // the t402b volume lane
  }
  writeFileSync(path.join(wdB, "run.out"), runOutFor("class3d", 3, 2));
  writeFileSync(path.join(wdB, "run.err"), "");
  writeRunRecord(b.id, "class3d", wdB, RESULT_B);
  ok("TENTH workdir written (data + model + optimiser + 3 class volumes)", true, wdB.replace(process.cwd() + "/", ""));

  // 4. the row flips — completed at 100
  for (const [j, res, label] of [[a, RESULT_A, "NINTH"], [b, RESULT_B, "TENTH"]]) {
    const flip = flipRow(j.id, res);
    if (flip.status !== 0) { console.log(`FATAL: the ${label} row flip failed: ${(flip.stderr ?? "").slice(0, 200)}`); process.exit(2); }
  }
  let sa = "", sb = "";
  for (let i = 0; i < 12; i++) {
    sa = jobByName(NAME_A)?.status ?? ""; sb = jobByName(NAME_B)?.status ?? "";
    if (sa === "completed" && sb === "completed") break;
    execSync("sleep 1");
  }
  ok("NINTH row is completed", sa === "completed", `status=${sa}`);
  ok("TENTH row is completed", sb === "completed", `status=${sb}`);

  // 5. the select-shaped graph — the two IDLE children (the plan reads
  //    the graph, not the statuses — the t949 law)
  const madeC = api("POST", "/api/jobs", { type: "select2d", name: NAME_C, x: 2320, y: 1600 });
  ok("C (Classes Consumer) created idle", !!madeC.job?.id, madeC.job?.id?.slice(-8));
  if (!madeC.job?.id) process.exit(2);
  const c = madeC.job;
  const eC = api("POST", "/api/edges", { fromJobId: a.id, toJobId: c.id, fromPort: "classAverages", toPort: "classes" });
  ok("edge NINTH.classAverages → C.classes (the classes mouth)", !eC.error, JSON.stringify(eC).slice(0, 90));

  const madeP = api("POST", "/api/jobs", { type: "select2d", name: NAME_P, x: 2320, y: 1880 });
  ok("P (Particles Consumer) created idle", !!madeP.job?.id, madeP.job?.id?.slice(-8));
  if (!madeP.job?.id) process.exit(2);
  const p = madeP.job;
  const eP = api("POST", "/api/edges", { fromJobId: b.id, toJobId: p.id, fromPort: "particles", toPort: "particles" });
  ok("edge TENTH.particles → P.particles (the friendly twin)", !eP.error, JSON.stringify(eP).slice(0, 90));

  // 6. the routes answer the minted dialects
  checkClassesRoute(a.id, A_COUNTS, { label: "NINTH (class2d)", stack: true, stackName: "run_it002_classes.mrcs", stackSlices: 4 });
  checkClassesRoute(b.id, B_COUNTS, { label: "TENTH (class3d)", volumes: [1, 2, 3] });

  // 7. the graph grew exactly 2 edges
  const es = edges();
  ok("the world grew exactly 2 edges", es.length === PRE_EDGES + 2, `${es.length} vs ${PRE_EDGES}+2`);

  // 8. the manifest
  writeFileSync(MANIFEST, JSON.stringify({
    writtenAt: new Date().toISOString(),
    preJobs: PRE_JOBS, preEdges: PRE_EDGES,
    a: { id: a.id, name: NAME_A, type: "class2d", workdir: wdA, counts: A_COUNTS, total: TOTAL },
    b: { id: b.id, name: NAME_B, type: "class3d", workdir: wdB, counts: B_COUNTS, total: TOTAL },
    c: { id: c.id, name: NAME_C, edge: "NINTH.classAverages→C.classes" },
    p: { id: p.id, name: NAME_P, edge: "TENTH.particles→P.particles" },
  }, null, 2));
  console.log(`  manifest written: ${MANIFEST}`);
  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ verify */
if (process.argv[2] === "verify") {
  console.log("== t978 select-rider world mint — verify ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to verify"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const list = jobs();

  const a = list.find((j) => j.id === m.a?.id);
  const b = list.find((j) => j.id === m.b?.id);
  const c = list.find((j) => j.id === m.c?.id);
  const p = list.find((j) => j.id === m.p?.id);
  ok("NINTH alive and completed", !!a && a.status === "completed", a?.status ?? "missing");
  ok("TENTH alive and completed", !!b && b.status === "completed", b?.status ?? "missing");
  ok("C alive and idle", !!c && c.status === "idle", c?.status ?? "missing");
  ok("P alive and idle", !!p && p.status === "idle", p?.status ?? "missing");
  ok("job count matches pre-state + 4", list.length === (m.preJobs ?? 8) + 4, `${list.length} vs ${m.preJobs}+4`);

  // the routes still answer the minted dialects
  checkClassesRoute(m.a.id, m.a.counts, { label: "NINTH (class2d)", stack: true, stackName: "run_it002_classes.mrcs", stackSlices: 4 });
  checkClassesRoute(m.b.id, m.b.counts, { label: "TENTH (class3d)", volumes: [1, 2, 3] });

  // the graph still speaks the select shape
  const es = edges();
  const eC = es.find((e) => e.toJobId === m.c.id);
  const eP = es.find((e) => e.toJobId === m.p.id);
  ok("C's wire rides the CLASSES mouth (classAverages→classes)", !!eC && eC.fromPort === "classAverages" && eC.toPort === "classes" && eC.fromJobId === m.a.id, eC ? `${eC.fromPort}→${eC.toPort}` : "missing");
  ok("P's wire rides the PARTICLES mouth (particles→particles)", !!eP && eP.fromPort === "particles" && eP.toPort === "particles" && eP.fromJobId === m.b.id, eP ? `${eP.fromPort}→${eP.toPort}` : "missing");
  ok("C and P each single-fed", es.filter((e) => e.toJobId === m.c.id).length === 1 && es.filter((e) => e.toJobId === m.p.id).length === 1);

  // the run records still hold the workdirs
  try {
    const runs = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    ok("NINTH run record done:true exitCode 0", runs[m.a.id]?.done === true && runs[m.a.id]?.exitCode === 0);
    ok("TENTH run record done:true exitCode 0", runs[m.b.id]?.done === true && runs[m.b.id]?.exitCode === 0);
    ok("the workdirs still exist", existsSync(m.a.workdir) && existsSync(m.b.workdir));
  } catch (e) {
    ok("run records readable", false, String(e).slice(0, 120));
  }

  // THE LIVE PLAN MATH — the jiti ride over the REAL catalog, the same
  // brain the dialog renders with (the mint's API-tier counter-proof)
  const { pathToFileURL } = await import("node:url");
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") }, interopDefault: true });
  const { jobType } = await jiti.import(pathToFileURL(path.join(process.cwd(), "src/lib/workflow.ts")).href);
  const { planAdoption } = await jiti.import(pathToFileURL(path.join(process.cwd(), "src/lib/adopt-branch.ts")).href);

  const selectWired = (hostType) => {
    const hostOutKinds = (jobType(hostType)?.outputs ?? []).map((o) => o.kind).filter(Boolean);
    const selIns = jobType("select2d")?.inputs ?? [];
    return selIns.every((i) => !i.accepts?.length || i.accepts.some((k) => hostOutKinds.includes(k)));
  };
  ok("selectWired(class2d) — the class2d host RENDERS the rider", selectWired("class2d") === true);
  ok("selectWired(class3d) — the class3d host HIDES the rider", selectWired("class3d") === false);

  const liveJobs = list.map((j) => ({ id: j.id, type: j.type, name: j.name }));
  const portsOf = (type) => (jobType(type)?.outputs ?? []).map((pp) => pp.name);
  const planA = planAdoption({ edges: es, jobs: liveJobs, fromRunId: m.a.id, toRunId: m.b.id, mintTargetType: "select2d", outputPortsOf: portsOf });
  const planB = planAdoption({ edges: es, jobs: liveJobs, fromRunId: m.b.id, toRunId: m.a.id, mintTargetType: "select2d", outputPortsOf: portsOf });
  const plainB = planAdoption({ edges: es, jobs: liveJobs, fromRunId: m.b.id, toRunId: m.a.id, outputPortsOf: portsOf });

  ok("host=NINTH: the plan REFUSES C's classes-mouth wire (moves=0, refused=1 port)",
    planA.moves.length === 0 && planA.refused.length === 1 && planA.refused[0]?.reason === "port",
    `moves=${planA.moves.length} refused=${planA.refused.map((r) => r.reason).join(",")}`);
  ok("host=TENTH: the plan would MOVE P's particles wire (moves=1, refused=0 — the M-pin live)",
    planB.moves.length === 1 && planB.refused.length === 0,
    `moves=${planB.moves.length} edge=${planB.moves[0]?.edge?.id?.slice(-8) ?? "?"}`);
  ok("host=TENTH: the plain verb moves P honestly too (moves=1, refused=0)", plainB.moves.length === 1 && plainB.refused.length === 0);

  // THE SHARPEST ABSENCE: improved > 0 on BOTH hosts, the gate hides ONE
  const { joinByName, pairedDeltas } = await jiti.import(pathToFileURL(path.join(process.cwd(), "src/lib/paired-compare.ts")).href);
  const { classRunRow, CLASS_LENSES } = await jiti.import(pathToFileURL(path.join(process.cwd(), "src/lib/class-compare.ts")).href);
  const lens = CLASS_LENSES.share;
  const rowsOf = (id) => (classesOf(id).classes ?? []).map(classRunRow);
  const deltasA = pairedDeltas(joinByName(rowsOf(m.a.id), rowsOf(m.b.id)).pairs, lens);
  const deltasB = pairedDeltas(joinByName(rowsOf(m.b.id), rowsOf(m.a.id)).pairs, lens);
  const impA = deltasA.filter((d) => d.kind === "improved").map((d) => d.name);
  const impB = deltasB.filter((d) => d.kind === "improved").map((d) => d.name);
  ok("host=NINTH: improved = [Class 002] (0.25 → 0.45)", JSON.stringify(impA) === JSON.stringify(["Class 002"]), impA.join(","));
  ok("host=TENTH: improved = [Class 001] (0.35 → 0.40)", JSON.stringify(impB) === JSON.stringify(["Class 001"]), impB.join(","));
  ok("THE SHARPEST ABSENCE (the face's whole honesty in one pin): improved > 0 on BOTH hosts while the gate hides ONLY the class3d one",
    impA.length > 0 && impB.length > 0 && selectWired("class2d") === true && selectWired("class3d") === false);
  ok("the totals agree (one population, classified in 2D and 3D)", (classesOf(m.a.id).total ?? 0) === (classesOf(m.b.id).total ?? 0) && (classesOf(m.a.id).total ?? 0) === 1200);

  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ remove */
if (process.argv[2] === "remove") {
  console.log("== t978 select-rider world mint — remove ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to remove"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  // children first, then the runs (the t951 law)
  for (const [label, id] of [["C the classes consumer", m.c?.id], ["P the particles consumer", m.p?.id], ["TENTH (class3d)", m.b?.id], ["NINTH (class2d)", m.a?.id]]) {
    if (!id) continue;
    const d = api("DELETE", `/api/jobs/${id}`);
    const gone = !d.error || /not found/i.test(String(d.error));
    ok(`${label} deleted (the hard door)`, gone, JSON.stringify(d).slice(0, 80));
  }
  // the run records
  try {
    const runs = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    let touched = false;
    for (const id of [m.a?.id, m.b?.id]) {
      if (id && runs[id]) { delete runs[id]; touched = true; }
    }
    if (touched) {
      const tmp = `${STATE_FILE}.t978.tmp`;
      writeFileSync(tmp, JSON.stringify(runs, null, 2));
      execSync(`mv "${tmp}" "${STATE_FILE}"`);
      console.log("  run records removed");
    }
  } catch {}
  // the workdirs
  for (const wd of [m.a?.workdir, m.b?.workdir]) {
    if (wd && existsSync(wd)) {
      try { rmSync(wd, { recursive: true, force: true }); console.log(`  rm ${wd.replace(process.cwd() + "/", "")}`); }
      catch (e) { console.log(`  ✗ rm failed for ${wd}: ${e.message}`); fail++; }
    }
  }
  // no orphaned class2d_/class3d_/select2d_ dirs carrying the t978 ids
  for (const id of [m.a?.id, m.b?.id, m.c?.id, m.p?.id].filter(Boolean)) {
    const suffix = id.slice(-8);
    for (const type of ["class2d", "class3d", "select2d"]) {
      const dir = path.join(DATA_ROOT, `${type}_${suffix}`);
      if (existsSync(dir)) {
        try { rmSync(dir, { recursive: true, force: true }); console.log(`  rm residue ${type}_${suffix}`); }
        catch { fail++; }
      }
    }
  }
  const list = jobs();
  ok("world restored: pre-state job count", list.length === (m.preJobs ?? 8), `${list.length} vs ${m.preJobs}`);
  ok("no t978 residue", list.every((j) => !SUFFIX_RE.test(j.name ?? "")));
  if (fail === 0) {
    rmSync(MANIFEST, { force: true });
  } else {
    console.log("  (the manifest STAYS — a RED remove must not eat the retry's key)");
  }
  console.log(`== remove ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

console.log("usage: node scripts/t978-select-rider-world-mint.mjs mint|verify|remove");
process.exit(2);

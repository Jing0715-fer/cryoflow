/**
 * SEED t531 — the OLD WORLD, persistent. (t522 遗留③ finally coded.)
 *
 * Why this exists: the demo world — "β-Galactosidase Tutorial (demo)" — is
 * the app's canonical showcase and the fixture bed of a dozen family suites
 * (t313/t219/t256/t258/t260 …). Twice it has been annihilated in place:
 * the files STAY but their bytes are replaced with x-spill ("ASCII text, no
 * line terminators" — witnessed live on extract.star/particles.xmipp), the
 * engine-state outputs maps go empty, and the directory trees go hollow.
 * Every sweep costs another manual repair pass (t522 fixed the extract
 * manifest once; the next sweep un-fixed it). This seeder makes the repair
 * a COMMAND: idempotent, deterministic, re-runnable after any wipe.
 *
 * What it rebuilds (the full canonical chain, 13 links):
 *   import → motioncorr → ctffind → autopick → extract → class2d →
 *   select2d → select → class3d → symexpand → rebalance → refine3d →
 *   postprocess   (+ the workflow pair initialmodel/maskcreate + 4 edges)
 *
 * Laws it obeys:
 *   - IDs are adopted, not invented: the chain resolves by WALKING the DB
 *     edges among completed jobs (the canonical chain is the completed
 *     edge-path, not "first job of each type" — the world carries rerun
 *     history: 3 postprocesses, 3 refines, one idle branch). Only a
 *     post-wipe empty DB gets hard-id creation (the t521 pattern).
 *   - Refs are PROJECT-RELATIVE (the t311 relocation law); rebaseParticleRefs
 *     is a no-op on live project-relative refs (verified in engine.ts), so
 *     the select2d re-run (t313 Phase D) keeps them.
 *   - Real data rides: the 10 Falcon micrographs in /home/z/empiar-10017
 *     are REAL EMPIAR frames (4096² mode 2, t527 fetch) — the seeder never
 *     pollutes them with synthetics; the stars name those 10 mics.
 *     t657 — the stars stop being a text-only promise: the import workdir
 *     now HARD-LINKS the 10 frames into micrographs/ (a directory entry
 *     each, zero bytes copied, zero bytes mutated — the same inode), so
 *     the gallery renders real pixels and the MRC headers carry real
 *     dims. Linking is referencing, not polluting.
 *   - The manifest (data/old-world.json) is the CONTRACT: suites resolve
 *     the old world through it instead of the active-pointer-scoped
 *     /api/jobs list (t530 moved the active pointer to the exam world and
 *     t313's resolution died — that flaw dies with this manifest).
 *   - Honest numbers only: the FSC/Guinier curves are the t521 port
 *     (seed 42), the class occupancy is deliberately skewed so the
 *     select2d "auto" selection (occupancy ≥ 0.5× best) keeps classes
 *     {1,2} — the t313 Phase D re-run goes green on physics, not luck.
 *
 * Usage:
 *   node scripts/qa-t531-old-world-seed.mjs           # seed (idempotent)
 *   node scripts/qa-t531-old-world-seed.mjs --check   # verify only, exit 0/1
 *
 * Run it after any world sweep, BEFORE the family. The prod server picks
 * up engine-state writes live (readRuns is mtime-keyed — no restart).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, linkSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

const CHECK = process.argv.includes("--check");
const PROJECT_NAME_SNIPPET = "β-Galactosidase";
const EMPIAR_DIR = "/home/z/empiar-10017/micrographs";
const STATE = path.join(REPO, "data", "engine-state.json");
const MANIFEST = path.join(REPO, "data", "old-world.json");
const DATA_ROOT = path.join(REPO, "data", "relion");

const CHAIN = [
  "import", "motioncorr", "ctffind", "autopick", "extract", "class2d",
  "select2d", "select", "class3d", "symexpand", "rebalance", "refine3d",
  "postprocess",
];
const WORKFLOW = [
  { type: "initialmodel", id: "cmututold000initialmodel", name: "InitialModel (seeded)" },
  { type: "maskcreate", id: "cmututold00000maskcreate", name: "MaskCreate (seeded)" },
];

let rngState = 42;
function rng() {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
const uniform = (a, b) => a + (b - a) * rng();

/* ---------- curve math — ported verbatim from qa-t521 (seed 42) ---------- */

const F0 = 0.01, F1 = 0.35, N = 40;
const fscCurve = (f) => 0.97 / (1.0 + Math.exp((f - 0.28) / 0.0226)) + 0.005;
const G0 = 0.001, G1 = 0.12, GN = 36;

function buildPostprocessStar() {
  const lines = [
    "data_general",
    "",
    "_rlnOptimisationSetOriginalHalfMap            refine3d/run_it020_half1_class001_unfil.mrc",
    "_rlnOptimisationSetOriginalHalfMap2           refine3d/run_it020_half2_class001_unfil.mrc",
    "_rlnFinalResolution                           3.120000",
    "_rlnBfactorUsedForSharpening                  -52.400000",
    "_rlnUnfilteredMapHalf1                        run_postprocess_it020_half1_class001.mrc",
    "_rlnMaskName                                  maskcreate/mask.mrc",
    "",
    "data_fsc",
    "",
    "loop_",
    "_rlnResolution #1",
    "_rlnAngstromResolution #2",
    "_rlnFourierShellCorrelationCorrected #3",
    "_rlnCorrectedFourierShellCorrelationPhaseRandomizedMaskedMaps #4",
    "_rlnFourierShellCorrelationUnmaskedMaps #5",
    "_rlnFourierShellCorrelationMaskedMaps #6",
  ];
  for (let i = 0; i < N; i++) {
    const f = F0 + ((F1 - F0) * i) / (N - 1);
    const c = fscCurve(f);
    const un = Math.min(0.99, c * 1.04 + 0.01 + uniform(-0.004, 0.004));
    const ma = Math.min(0.99, c * 1.12 + 0.02 + uniform(-0.004, 0.004));
    const ph = Math.max(0.0, 0.008 + 0.06 * f + uniform(-0.003, 0.003));
    const ang = i === 0 ? 999.0 : 1.0 / f;
    lines.push(`${f.toFixed(9)}  ${ang.toFixed(6)}  ${c.toFixed(6)}  ${ph.toFixed(6)}  ${un.toFixed(6)}  ${ma.toFixed(6)}`);
  }
  lines.push(
    "",
    "data_guinier",
    "",
    "loop_",
    "_rlnResolutionSquared #1",
    "_rlnLogAmplitudesOriginal #2",
    "_rlnInterceptResidual #3",
    "_rlnLogAmplitudesSharpened #4",
    "_rlnLogAmplitudesWeighted #5"
  );
  for (let i = 0; i < GN; i++) {
    const x = G0 + ((G1 - G0) * i) / (GN - 1);
    const orig = 2.2 - 2.8 * x + uniform(-0.01, 0.01);
    const intercept = 2.2 - 0.35 * x;
    const sharp = orig + 0.5 + 12.0 * x;
    const weighted = (orig + sharp) / 2.0;
    lines.push(`${x.toFixed(7)}  ${orig.toFixed(6)}  ${intercept.toFixed(6)}  ${sharp.toFixed(6)}  ${weighted.toFixed(6)}`);
  }
  return lines.join("\n") + "\n";
}

function buildModelStar(res, withGoldFsc) {
  const lines = [
    "data_model_general",
    "",
    `_rlnCurrentResolution   ${res.toFixed(6)}`,
    "_rlnSolventMaskFSCVolumeFraction   0.212000",
    "",
  ];
  if (withGoldFsc) {
    lines.push(
      "data_model_half_map_fsc",
      "",
      "loop_",
      "_rlnResolution #1",
      "_rlnAngstromResolution #2",
      "_rlnGoldStandardFsc #3"
    );
    for (let i = 0; i < 30; i++) {
      const f = 0.01 + (0.3 - 0.01) * (i / 29);
      const g = 0.95 * Math.exp(-f * 4) + 0.02;
      lines.push(`${f.toFixed(9)}  ${(1 / f).toFixed(6)}  ${g.toFixed(6)}`);
    }
  }
  return lines.join("\n") + "\n";
}

/* ---------- the old world's own dialects --------------------------------- */

function buildImportStar(mics) {
  // t657 — the optics block the gallery header's chips read back
  // (pixel/HT/Cs/Q0): the same numbers the t635 import params carry, so
  // the star, the job form and the UI all speak one physics.
  const lines = [
    "data_optics", "", "loop_",
    "_rlnOpticsGroup #1", "_rlnMicrographPixelSize #2", "_rlnVoltage #3",
    "_rlnSphericalAberration #4", "_rlnAmplitudeContrast #5",
    "1  1.77  300  2.7  0.1",
    "",
    "data_micrographs", "", "loop_", "_rlnMicrographName #1",
  ];
  for (const m of mics) lines.push(`micrographs/${m}`);
  return lines.join("\n") + "\n";
}

/** t657 — the import workdir's frames ride as HARD LINKS to the real
 *  EMPIAR bundle: one directory entry per frame, the same inode (zero
 *  bytes copied on a 4GB-disk box, zero bytes mutated — linkSync refuses
 *  to create a divergent copy by construction). Re-running skips frames
 *  already on the wall (idempotent like every plan here). */
function linkPlan() {
  return micNames.map((m) => ({
    src: path.join(EMPIAR_DIR, m),
    dst: path.join(wd.import, "micrographs", m),
  }));
}

function buildMotionStar(mics) {
  const lines = [
    "data_micrographs", "", "loop_",
    "_rlnMicrographName #1", "_rlnAccumMotionTotal #2", "_rlnAccumMotionEarly #3", "_rlnAccumMotionLate #4",
  ];
  mics.forEach((m, i) => {
    const total = 5.9 - i * 0.16 + uniform(-0.15, 0.15);
    const early = total * 0.62 + uniform(-0.05, 0.05);
    const late = total - early;
    lines.push(`${m}  ${total.toFixed(3)}  ${early.toFixed(3)}  ${late.toFixed(3)}`);
  });
  return lines.join("\n") + "\n";
}

function buildCtfStar(mics) {
  const lines = [
    "data_optics", "", "loop_", "_rlnOpticsGroup #1", "_rlnImagePixelSize #2", "1  0.93", "",
    "data_micrographs", "", "loop_",
    "_rlnMicrographName #1", "_rlnDefocusU #2", "_rlnDefocusV #3", "_rlnDefocusAngle #4",
    "_rlnCtfAstigmatism #5", "_rlnCtfFigureOfMerit #6", "_rlnCtfMaxResolution #7",
  ];
  mics.forEach((m, i) => {
    const u = 14800 - ((i * 7 + 5) % 10) * 210 + uniform(-120, 120);
    const v = u - (140 + uniform(0, 160));
    const angle = uniform(0, 180);
    const astig = 40 + uniform(0, 260);
    const fom = 0.34 - i * 0.006 + uniform(-0.01, 0.01);
    const maxres = 3.4 + (i % 7) * 0.85 + uniform(-0.1, 0.1);
    lines.push(`${m}  ${u.toFixed(1)}  ${v.toFixed(1)}  ${angle.toFixed(2)}  ${astig.toFixed(1)}  ${fom.toFixed(4)}  ${maxres.toFixed(2)}`);
  });
  return lines.join("\n") + "\n";
}

function buildPicksStar(mics, perMic = 17) {
  const lines = [
    "loop_",
    "_rlnMicrographName #1", "_rlnCoordinateX #2", "_rlnCoordinateY #3", "_rlnAutopickFigureOfMerit #4",
  ];
  for (const m of mics) {
    for (let k = 0; k < perMic; k++) {
      const x = 120 + ((k * 271) % 3800);
      const y = 140 + ((k * 433) % 3800);
      const fom = 0.9 - k * 0.02 + uniform(-0.02, 0.02);
      lines.push(`${m}  ${x.toFixed(1)}  ${y.toFixed(1)}  ${fom.toFixed(4)}`);
    }
  }
  return lines.join("\n") + "\n";
}

/** The particle-universe star: 240 particles on the REAL stack (one frame
 *  per particle), refs PROJECT-RELATIVE (the t311 law — rebaseParticleRefs
 *  leaves live project-relative refs untouched, verified in engine.ts). */
const EXTRACT_N = 240;
const STACK_REF = "extract_STACK/particles.mrcs";

function particleRows(n, classOf, ref) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const cls = classOf(i);
    const rot = (cls % 2 === 0 ? 30 : 210) + uniform(-15, 15) + cls * 3;
    const tilt = (cls % 2 === 0 ? 40 : 60) + uniform(-10, 10);
    const psi = uniform(0, 360);
    lines.push(
      `${String(i + 1).padStart(7, "0")}@${ref}  ${cls}  ${rot.toFixed(3)}  ${tilt.toFixed(3)}  ${psi.toFixed(3)}`
    );
  }
  return lines;
}

function buildParticlesStar(rows, withAngles = true) {
  const cols = withAngles
    ? ["_rlnImageName #1", "_rlnClassNumber #2", "_rlnAngleRot #3", "_rlnAngleTilt #4", "_rlnAnglePsi #5"]
    : ["_rlnImageName #1", "_rlnOpticsGroup #2"];
  const lines = ["data_particles", "", "loop_", ...cols, ...rows];
  return lines.join("\n") + "\n";
}

/** extract's own dialect: image + optics group ONLY (classification comes
 *  later in the chain — the class2d star carries the class columns). */
function buildExtractStar(n, ref) {
  const lines = ["data_particles", "", "loop_", "_rlnImageName #1", "_rlnOpticsGroup #2"];
  for (let i = 0; i < n; i++) lines.push(`${String(i + 1).padStart(7, "0")}@${ref}  1`);
  return lines.join("\n") + "\n";
}

/** Class occupancy: c1 96, c2 72 (both ≥ 0.5×96 → kept by "auto"),
 *  c3-c8 the sparse tail. Sum = 240. The t313 Phase D physics. */
const CLASS_SKEW = [96, 72, 24, 12, 12, 9, 9, 6];
function skewedClassOf(i) {
  let acc = 0;
  for (let c = 0; c < CLASS_SKEW.length; c++) {
    acc += CLASS_SKEW[c];
    if (i < acc) return c + 1;
  }
  return CLASS_SKEW.length;
}
const KEPT_CLASSES = { kept: 2 }; // c1 + c2 at the 0.5 cutoff
const KEPT_N = CLASS_SKEW[0] + CLASS_SKEW[1];

function filterKeptRows(rows) {
  // keep only classes 1-2 of a 5-column particles row
  return rows.filter((l) => {
    const cls = parseInt(l.split(/\s+/)[1] ?? "", 10);
    return cls === 1 || cls === 2;
  });
}

/** A REAL stacked MRC: mode 2 float32, frame × frame × frames — small but
 *  every header word honest (the size check demands the bytes). */
function buildMrcStack(frame = 64, frames = EXTRACT_N) {
  const header = Buffer.alloc(1024);
  header.writeInt32LE(frame, 0);
  header.writeInt32LE(frame, 4);
  header.writeInt32LE(frames, 8);
  header.writeInt32LE(2, 12); // mode = float32
  header.writeInt32LE(0, 92); // nsymbt
  return Buffer.concat([header, Buffer.alloc(frame * frame * 4 * frames)]);
}

/** A single-image MRC (class averages): mode 2, 256×256×1. */
function buildMrcSingle(size = 64) {
  const header = Buffer.alloc(1024);
  header.writeInt32LE(size, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(1, 8);
  header.writeInt32LE(2, 12);
  header.writeInt32LE(0, 92);
  return Buffer.concat([header, Buffer.alloc(size * size * 4)]);
}

/* ---------- the world itself --------------------------------------------- */

let pass = 0, fail = 0;
const ok = (c, label) => {
  if (c) { pass++; if (CHECK) console.log(`  ok  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}`); }
};

function writeAtomic(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".seed-tmp";
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

function workdirOf(projId, type, id) {
  return path.join(DATA_ROOT, projId, `${type}_${id.slice(-8)}`);
}

/** Canonical chain = the COMPLETED edge-path (adopted, not invented).
 *  Type-driven walk: at each hop pick the edge whose target HAS the
 *  expected type (prefer completed — select2d sits idle in the DB while
 *  its completion lives only in the engine ledger; the seeder is what
 *  makes it done, so "any status, prefer completed" is the honest law). */
async function resolveChain() {
  const projs = await db.project.findMany();
  const proj = projs.find((p) => p.name?.includes(PROJECT_NAME_SNIPPET));
  if (!proj) return { proj: null, chain: {} };
  const jobs = await db.job.findMany({ where: { projectId: proj.id } });
  const edges = await db.edge.findMany({
    where: { OR: [{ fromJobId: { in: jobs.map((j) => j.id) } }, { toJobId: { in: jobs.map((j) => j.id) } }] },
  });
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const completed = jobs.filter((j) => j.status === "completed");
  const chain = {};
  let cur = completed.find((j) => j.type === "import");
  for (const t of CHAIN) {
    if (!cur || cur.type !== t) break;
    chain[t] = cur.id;
    const candidates = edges.filter((e) => e.fromJobId === cur.id && byId.get(e.toJobId)?.type === CHAIN[CHAIN.indexOf(t) + 1]);
    const next = candidates.find((e) => byId.get(e.toJobId)?.status === "completed") ?? candidates[0];
    cur = next ? byId.get(next.toJobId) : null;
  }
  return { proj, chain };
}

async function ensureWorkflowNodes(proj, chain) {
  if (CHECK) return {};
  const wf = {};
  const sample = await db.job.findFirst({ where: { projectId: proj.id } });
  for (const node of WORKFLOW) {
    const existing = await db.job.findUnique({ where: { id: node.id } });
    if (existing) { wf[node.type] = existing.id; continue; }
    const created = await db.job.create({
      data: {
        id: node.id, projectId: proj.id, type: node.type, name: node.name,
        x: 160, y: 320, status: "completed", progress: 100, params: "{}",
        ...(sample?.workspaceId ? { workspaceId: sample.workspaceId } : {}),
      },
    });
    wf[node.type] = created.id;
  }
  const want = [
    [chain.select, wf.initialmodel],
    [wf.initialmodel, chain.class3d],
    [chain.refine3d, wf.maskcreate],
    [wf.maskcreate, chain.postprocess],
  ].filter(([a, b]) => a && b);
  for (const [fromJobId, toJobId] of want) {
    // raw INSERT — the checked-in client's Edge model is stale (relation-only
    // spelling) while the schema carries the scalar columns; SQL sidesteps
    // the mismatch without regenerating anything.
    const row = await db.$queryRawUnsafe(
      `SELECT id FROM Edge WHERE fromJobId = ? AND toJobId = ?`, fromJobId, toJobId
    );
    if (row.length === 0) {
      await db.$executeRawUnsafe(
        `INSERT INTO Edge (id, projectId, fromJobId, toJobId, createdAt) VALUES (?, ?, ?, ?, ?)`,
        `edge_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`,
        proj.id, fromJobId, toJobId, new Date().toISOString()
      );
    }
  }
  return wf;
}

/* ---------- main ---------------------------------------------------------- */

const { proj, chain } = await resolveChain();
ok(!!proj, `the demo project exists (${proj?.name ?? "MISSING"})`);
if (!proj) {
  console.log("the demo world is gone entirely — post-wipe creation is the t521 seeder's law; extend it for the demo if this ever fires.");
  process.exit(1);
}
ok(CHAIN.every((t) => chain[t]), `the canonical chain resolves by edge-walk (${CHAIN.filter((t) => !chain[t]).join(",") || "all 13"})`);
if (fail > 0) {
  console.log("cannot seed a half-resolvable world — inspect the DB first");
  process.exit(1);
}

const PDIR = path.join(DATA_ROOT, proj.id);
const micNames = readdirSync(EMPIAR_DIR).filter((f) => f.endsWith(".mrc")).sort();
ok(micNames.length >= 5, `the real EMPIAR bundle stands (${micNames.length} Falcon frames)`);

const wf = CHECK ? {} : await ensureWorkflowNodes(proj, chain);
const stackRef = STACK_REF.replace("extract_STACK", `extract_${chain.extract.slice(-8)}`);
const stackPath = path.join(PDIR, stackRef);
const wd = Object.fromEntries(CHAIN.map((t) => [t, workdirOf(proj.id, t, chain[t])]));

// rows of the particle universe (240) and its derivatives
rngState = 42; // every run reproduces the same universe
const universe = particleRows(EXTRACT_N, skewedClassOf, stackRef);
const class2dRows = universe; // 8 skewed classes
const keptRows = filterKeptRows(class2dRows); // 168 — the "auto" verdict
const class3dRows = particleRows(KEPT_N, (i) => (i < 100 ? 1 : i < 150 ? 2 : 3), stackRef);

/** what gets materialized per link: [fileRelToWorkdir, content] */
function filePlan() {
  const plan = [];
  plan.push([wd.import, "micrographs.star", buildImportStar(micNames)]);
  plan.push([wd.motioncorr, "corrected_micrographs.star", buildMotionStar(micNames)]);
  plan.push([wd.ctffind, "micrographs_ctf.star", buildCtfStar(micNames)]);
  plan.push([wd.autopick, "coords.star", buildPicksStar(micNames)]);
  plan.push([wd.extract, "extract.star", buildExtractStar(EXTRACT_N, stackRef)]);
  plan.push([wd.extract, "particles.mrcs", buildMrcStack(64, EXTRACT_N)]);
  plan.push([wd.class2d, "run_it012_data.star", buildParticlesStar(class2dRows, true)]);
  plan.push([wd.class2d, "run_it012_model.star", buildModelStar(3.18, true)]);
  // t532 — the class averages live OUTSIDE every job workdir
  // (_fixtures/classes/): the map-inventory walk reads each job workdir's
  // mrcs and its main-map law (MAIN_MAP_RE half0|postprocess.mrc, else fs
  // order) made class001.mrc the class2d row's MAIN — hijacking the
  // t219 tie world (the second row profiled class001, the twin profiled
  // orthovol, the byte-identical tie died). The classes gallery reads
  // them through the record's outputs paths — the ledger, not the
  // workdir, is the address book.
  for (let c = 1; c <= 8; c++) plan.push([path.join(PDIR, "_fixtures", "classes"), `class00${c}.mrc`, buildMrcSingle(64)]);
  plan.push([wd.select2d, "particles_select2d.star", buildParticlesStar(keptRows, true)]);
  plan.push([wd.select, "selected.star", buildParticlesStar(keptRows, true)]);
  plan.push([wd.class3d, "run_it003_data.star", buildParticlesStar(class3dRows, true)]);
  plan.push([wd.class3d, "run_it003_model.star", buildModelStar(3.62, false)]);
  plan.push([wd.symexpand, "particles_symexp.star", buildParticlesStar(keptRows.map((l) => l.replace(/(\d+\.\d{3})$/, (d) => (parseFloat(d) + 0.5).toFixed(3))), true)]);
  plan.push([wd.rebalance, "particles_rebalanced.star", buildParticlesStar(keptRows, true)]);
  plan.push([wd.refine3d, "run_it020_model.star", buildModelStar(3.62, true)]);
  // the ledger claims the gold-standard half pair — write what
  // outputsPlan asserts (the "real outputs" law; the t636 re-run
  // exposed the claim-without-write gap once the third world split
  // lost the snapshot's copies of these files)
  plan.push([wd.refine3d, "run_it020_half1.mrc", buildMrcSingle(64)]);
  plan.push([wd.refine3d, "run_it020_half2.mrc", buildMrcSingle(64)]);
  plan.push([wd.postprocess, "postprocess.star", buildPostprocessStar()]);
  return plan;
}

/** the ledger each link must carry: outputs keys → real paths */
function outputsPlan() {
  const rel = (abs) => abs;
  return {
    import: { micrographs_star: rel(path.join(wd.import, "micrographs.star")) },
    motioncorr: { micrographs_star: rel(path.join(wd.motioncorr, "corrected_micrographs.star")) },
    ctffind: { micrographs_star: rel(path.join(wd.ctffind, "micrographs_ctf.star")) },
    autopick: { coords_star: rel(path.join(wd.autopick, "coords.star")) },
    extract: { particles_star: rel(path.join(wd.extract, "extract.star")) },
    class2d: {
      particles_star: rel(path.join(wd.class2d, "run_it012_data.star")),
      classes_mrc: Array.from({ length: 8 }, (_, i) => path.join(PDIR, "_fixtures", "classes", `class00${i + 1}.mrc`)),
    },
    select2d: { particles_star: rel(path.join(wd.select2d, "particles_select2d.star")) },
    select: { particles_star: rel(path.join(wd.select, "selected.star")) },
    class3d: { particles_star: rel(path.join(wd.class3d, "run_it003_data.star")) },
    symexpand: { particles_star: rel(path.join(wd.symexpand, "particles_symexp.star")) },
    rebalance: { particles_star: rel(path.join(wd.rebalance, "particles_rebalanced.star")) },
    refine3d: {
      half1_model: path.join(wd.refine3d, "run_it020_half1.mrc"),
      half2_model: path.join(wd.refine3d, "run_it020_half2.mrc"),
      model_star: rel(path.join(wd.refine3d, "run_it020_model.star")),
    },
    postprocess: {
      postprocess_star: rel(path.join(wd.postprocess, "postprocess.star")),
      fsc_star: rel(path.join(wd.postprocess, "postprocess.star")),
    },
  };
}

const RESULTS = {
  import: "10 real EMPIAR micrographs imported (hard-linked in place — zero upload, zero copy)",
  motioncorr: "10 micrographs aligned (own motioncorr, patch 3×3)",
  ctffind: "10 micrographs CTF-fitted — defocus family 14.6-12.7k Å",
  autopick: "170 particles picked across 10 micrographs (LoG)",
  extract: "240 particles extracted — key-files law: STAR comes home, stack stays project-side",
  class2d: "2D classification finished — 8 classes · 240 particles · top: class 1 40%, class 2 30%",
  select2d: "168 of 240 particles kept · 2/8 classes (auto — occupancy ≥ 0.5× best)",
  select: "168 particles selected from the gallery (classes 1-2)",
  class3d: "3D classification finished — 3 classes · 168 particles",
  symexpand: "168 particles symmetry-expanded (C1 — identity)",
  rebalance: "168 particles rebalanced across optics groups",
  refine3d: "3D refinement finished — gold-standard FSC at 3.62 Å · half-maps on disk",
  postprocess: "postprocess finished — masked, sharpened · final resolution 3.12 Å (FSC=0.143)",
};

function seedEngineRecords() {
  const state = JSON.parse(readFileSync(STATE, "utf8"));
  const outs = outputsPlan();
  const now = new Date().toISOString();
  for (const t of CHAIN) {
    state[chain[t]] = {
      jobId: chain[t],
      projectId: proj.id,
      type: t,
      pid: null,
      cmd: `seeded:${t}`,
      workdir: wd[t],
      logFile: path.join(wd[t], "run.log"),
      errFile: path.join(wd[t], "run.err"),
      startedAt: now,
      outputs: outs[t],
      done: true,
      exitCode: 0,
      result: RESULTS[t],
    };
  }
  writeAtomic(STATE, JSON.stringify(state, null, 2));
}

function seedLogs() {
  for (const t of CHAIN) {
    writeAtomic(path.join(wd[t], "run.log"), `seeded by qa-t531-old-world-seed — ${RESULTS[t]}\n`);
    writeAtomic(path.join(wd[t], "run.err"), "");
  }
  // t532 — stale-fixture sweep: the class averages used to live IN the
  // class2d workdir (the main-map hijack, see filePlan's note); an
  // idempotent re-seed must remove the old copies or the hijack returns.
  for (let c = 1; c <= 8; c++) {
    const stale = path.join(wd.class2d, `class00${c}.mrc`);
    if (existsSync(stale)) unlinkSync(stale);
  }
}

function writeManifest(wf) {
  writeAtomic(MANIFEST, JSON.stringify({
    seededAt: new Date().toISOString(),
    seeder: "scripts/qa-t531-old-world-seed.mjs",
    project: { id: proj.id, name: proj.name },
    roster: rosterCount,
    chain, workflow: wf,
    empiar: { dir: EMPIAR_DIR, micrographs: micNames.length },
    note: "suites resolve the old world HERE — /api/jobs is active-pointer-scoped and lies when another world is active",
  }, null, 2));
}

let rosterCount = 0;
async function countRoster() {
  rosterCount = await db.job.count({ where: { projectId: proj.id } });
  return rosterCount;
}

/* ---------- run or check --------------------------------------------------- */

if (!CHECK) {
  const plan = filePlan();
  for (const [dir, name, content] of plan) {
    const file = path.join(dir, name);
    writeAtomic(file, content);
    console.log(`  wrote ${path.relative(REPO, file)} (${content.length}B)`);
  }
  // t657 — the frames: hard-link, never copy. Skip what's already linked
  // (re-running the seeder must not churn directory entries).
  for (const { src, dst } of linkPlan()) {
    if (existsSync(dst)) continue;
    mkdirSync(path.dirname(dst), { recursive: true });
    try {
      linkSync(src, dst);
      console.log(`  linked ${path.relative(REPO, dst)} ← bundle`);
    } catch (err) {
      fail++;
      console.log(`  FAIL  link ${path.relative(REPO, dst)} (${err.code ?? err.message})`);
    }
  }
  seedLogs();
  seedEngineRecords();
  console.log("  engine-state records: 13 chain links (done · exitCode 0 · real outputs)");
  await countRoster();
  writeManifest(wf);
  console.log(`  manifest: ${path.relative(REPO, MANIFEST)} (roster ${rosterCount})`);
  console.log("seed complete — re-run with --check to verify");
} else {
  // ---- check mode: verify every contract, no writes ----
  const plan = filePlan();
  for (const [dir, name] of plan) {
    const file = path.join(dir, name);
    ok(existsSync(file), `${path.relative(REPO, file)}`);
  }
  // t657 — every frame on the wall is the REAL bundle inode (same dev +
  // ino as the source, not a copy): the “real data rides” law, verified.
  for (const { src, dst } of linkPlan()) {
    const okLink = existsSync(dst) && existsSync(src);
    let same = false;
    if (okLink) {
      const a = statSync(src);
      const b = statSync(dst);
      same = a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.size > 0;
    }
    ok(same, `frame hard-linked (same inode): ${path.basename(dst)}`);
  }
  const state = JSON.parse(readFileSync(STATE, "utf8"));
  for (const t of CHAIN) {
    const r = state[chain[t]];
    ok(r?.done === true && r?.exitCode === 0, `engine record ${t}: done + exit 0`);
    ok(Object.keys(r?.outputs ?? {}).length > 0 && Object.values(r?.outputs).flat().every((f) => existsSync(f)), `engine record ${t}: outputs live`);
  }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  ok(m.project?.id === proj.id && Object.keys(m.chain ?? {}).length === 13, "manifest: project + 13 chain ids");
  const selText = readFileSync(path.join(wd.select, "selected.star"), "utf8");
  const firstRef = /@(\S+)/.exec(selText)?.[1] ?? "";
  const stack = path.join(PDIR, firstRef);
  ok(existsSync(stack), `the select star's stack resolves project-relative (${path.relative(REPO, stack)})`);
  ok(firstRef.startsWith("extract_") && !firstRef.startsWith("extra/"), `select star refs project-relative (${firstRef})`);
  await countRoster();
  ok(rosterCount >= 15, `roster ≥ 15 (${rosterCount})`);
}

console.log(fail === 0 ? (CHECK ? "CHECK PASS" : "SEED OK") : `${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
await db.$disconnect();

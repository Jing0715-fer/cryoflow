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
 *     t658 — the corrected wall joins the real world: the MotionCorr
 *     workdir hard-links the SAME 10 inodes (two catalogues, one
 *     bundle), and its corrected star grows the RELION 5 optics block.
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

import { deflateSync } from "node:zlib";
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
  // t665 — the denoise branch joins the canonical world: Topaz Denoise
  // hangs off MotionCorr (the provider the denoise-pairs route itself
  // picks — first DONE upstream carrying an existing micrographs star),
  // and its arrival lights the two shipped-dark surfaces (the t542
  // before/after wall, the t559 pick handoff) plus the palette's third
  // image-surface group. The id is a CONSTANT: adopt-or-create by it,
  // so seed / check / re-seed all resolve the same node.
  { type: "topazdenoise", id: "cmututold000topazdenoise", name: "Topaz Denoise (seeded)" },
  // t666 — the training branch joins the family: Topaz Train hangs off the
  // denoise node (the t563 gesture's outcome made permanent — the official
  // flow trains ON the denoised stack), and its arrival lights the last
  // two shipped-dark Topaz surfaces (the t266 training curve, the t558
  // train→pick handoff card) — both gated on a COMPLETED topaztrain job
  // the world never grew until now. Constant id, adopt-or-create like
  // every branch above.
  { type: "topaztrain", id: "cmututold000topaztrain", name: "Topaz Train (seeded)" },
];
const DENOISE_ID = "cmututold000topazdenoise";
const TRAIN_ID = "cmututold000topaztrain";

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
 *  already on the wall (idempotent like every plan here).
 *  t658 — the corrected wall rides the same law: the MotionCorr workdir
 *  gets its own directory entries pointing at the SAME inodes. Two
 *  catalogues, one bundle — the demo world never stores a frame twice. */
function linkPlan() {
  return micNames.flatMap((m) => [
    { src: path.join(EMPIAR_DIR, m), dst: path.join(wd.import, "micrographs", m) },
    { src: path.join(EMPIAR_DIR, m), dst: path.join(wd.motioncorr, "micrographs", m) },
  ]);
}

function buildMotionStar(mics) {
  // t658 — the corrected wall speaks the RELION 5 dialect the engine's
  // own counter expects (t409: data_optics = group number + pixel size,
  // skipped BY NAME so the count stays 10) and the micrographs route's
  // parseOptics reads (_rlnMicrographPixelSize → the pixel chip). The
  // physics matches the import star (1.77 Å — same detector, same
  // project): star, form and UI keep saying one thing.
  const lines = [
    "data_optics", "", "loop_",
    "_rlnOpticsGroup #1", "_rlnMicrographPixelSize #2",
    "1  1.77",
    "",
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

/* ---------- t665 — the Topaz denoise leg ----------------------------------
 *  The wrapper's output dialect: <stem>_denoised.mrc beside a
 *  denoised_micrographs.star indexing them (bare names — the flat style).
 *  The pixels are DERIVED from the real EMPIAR frames the run consumed:
 *  a 16×16 box average downsample to 256². That is a REAL noise reduction
 *  (variance ∝ 1/N), so the t542 wipe compare shows the physics — the
 *  nearest-neighbour PNG renderer keeps the original's full-noise σ while
 *  the averaged side is visibly smoother, and the divider drag means
 *  something. Headers honest (finishMrcHeader): dims 256, pixel
 *  28.32 Å (1.77 × 16), MAP/MACHST, DMIN/DMAX/DMEAN counted from the
 *  data, never guessed. Reads are sequential, one 64 MB frame at a
 *  time — the box never holds two frames. */
const DENOISE_POOL = 16;

function buildDenoisedStar() {
  const lines = ["data_micrographs", "", "loop_", "_rlnMicrographName #1"];
  for (const m of micNames) lines.push(m.replace(/\.mrc$/i, "_denoised.mrc"));
  return lines.join("\n") + "\n";
}

/* t666 — the training curve's diary: topaz's per-epoch table, in the CSV
 * dialect the tolerant parser (src/lib/relion/topaz-training.ts, pass A)
 * reads — header names it + train/test loss + precision/recall, numeric
 * rows below. Same synthetic family as the FSC curve: the job DECLARES
 * "training happened, here is its loss", so a hand-authored table with
 * the classic shape (both losses falling, test flattening while train
 * keeps improving — the overfit gap the chart's stop-here story
 * narrates, best epoch marked) is an honest answer, not a forgery.
 * Deterministic constants — every seed produces the same diary. */
function buildTopazTrainingLog() {
  const header =
    "seeded by qa-t531-old-world-seed — Topaz model trained on the denoised stack (general-model flow)\n";
  const rows = [
    [0, 0.912, 0.934, 0.31, 0.24],
    [1, 0.847, 0.881, 0.36, 0.29],
    [2, 0.771, 0.812, 0.41, 0.35],
    [3, 0.698, 0.744, 0.47, 0.41],
    [4, 0.633, 0.689, 0.52, 0.46],
    [5, 0.574, 0.631, 0.56, 0.51],
    [6, 0.521, 0.586, 0.61, 0.55],
    [7, 0.478, 0.549, 0.64, 0.59],
    [8, 0.441, 0.521, 0.67, 0.62],
    [9, 0.411, 0.494, 0.69, 0.65],
    [10, 0.386, 0.497, 0.71, 0.67],
    [11, 0.366, 0.501, 0.72, 0.68],
  ]
    .map((r) => r.join(","))
    .join("\n");
  return `${header}\n# it,train_loss,test_loss,precision,recall\n${rows}\n`;
}

/* the trained-model artifact: topaz train writes a pickled CNN
 * (topaz_model.sav family); nothing in the demo world consumes its
 * bytes — the outputs ledger and the handoff card need its EXISTENCE,
 * so existence (with a truthful label) is what it claims. */
function buildTopazModelStub() {
  return [
    "CryoFlow seeded world — Topaz model artifact (topaz_model.sav family).",
    "This stub stands where topaz train writes its pickled CNN.",
    "Nothing consumes its bytes; the outputs ledger and the train→pick",
    "handoff need its existence, so existence is what it claims.",
    "",
  ].join("\n");
}

function buildDenoisedFrame(srcPath) {
  const raw = readFileSync(srcPath);
  const nx = raw.readInt32LE(0);
  const ny = raw.readInt32LE(4);
  const mode = raw.readInt32LE(12);
  if (mode !== 2) throw new Error(`unexpected MRC mode ${mode} in ${srcPath} — the denoise leg derives from mode-2 float32 frames`);
  const nsymbt = raw.readInt32LE(92);
  const data = new Float32Array(raw.buffer, raw.byteOffset + 1024 + nsymbt, nx * ny);
  const ox = nx / DENOISE_POOL, oy = ny / DENOISE_POOL;
  if (!Number.isInteger(ox) || !Number.isInteger(oy)) throw new Error(`frame ${nx}×${ny} does not pool by ${DENOISE_POOL}`);
  const out = new Float32Array(ox * oy);
  let dmin = Infinity, dmax = -Infinity, sum = 0;
  for (let y = 0; y < oy; y++) {
    for (let x = 0; x < ox; x++) {
      let s = 0;
      for (let dy = 0; dy < DENOISE_POOL; dy++) {
        const row = (y * DENOISE_POOL + dy) * nx + x * DENOISE_POOL;
        for (let dx = 0; dx < DENOISE_POOL; dx++) s += data[row + dx];
      }
      const v = s / (DENOISE_POOL * DENOISE_POOL);
      out[y * ox + x] = v;
      if (v < dmin) dmin = v;
      if (v > dmax) dmax = v;
      sum += v;
    }
  }
  const header = Buffer.alloc(1024);
  header.writeInt32LE(ox, 0);
  header.writeInt32LE(oy, 4);
  header.writeInt32LE(1, 8);
  header.writeInt32LE(2, 12);
  finishMrcHeader(header, ox, oy, 1, 1.77 * DENOISE_POOL, dmin, dmax, sum / out.length);
  return Buffer.concat([header, Buffer.from(out.buffer)]);
}

function filterKeptRows(rows) {
  // keep only classes 1-2 of a 5-column particles row
  return rows.filter((l) => {
    const cls = parseInt(l.split(/\s+/)[1] ?? "", 10);
    return cls === 1 || cls === 2;
  });
}

/** Shared honest-header finishing: the CCP4/MRC2000 words a real parser
 *  reads. t661 — Mol*'s ParseCcp4 hard-requires the "MAP " magic (byte 208)
 *  and a MACHST machine stamp (byte 212), and derives the grid→cartesian
 *  transform from MX/MY/MZ + CELLA — the zero-filled stubs were refused at
 *  load ("ccp4 format error"), leaving the 3D viewer's isosurface a zombie
 *  whose every update died with "No suitable parent found". pixel = Å/voxel
 *  (the world's 1.77 — the same number the star files and the import
 *  params speak). Byte offsets follow the standard CCP4 layout:
 *  MX/MY/MZ 28/32/36 · CELLA 40/44/48 · angles 52/56/60 · MAPC/R/S
 *  64/68/72 · DMIN/DMAX/DMEAN 76/80/84 · NSYMBT 92 · ORIGIN 196 · MAP 208
 *  · MACHST 212. */
function finishMrcHeader(header, nx, ny, nz, pixel, dmin, dmax, dmean) {
  header.writeInt32LE(nx, 28); // MX
  header.writeInt32LE(ny, 32); // MY
  header.writeInt32LE(nz, 36); // MZ
  header.writeFloatLE(nx * pixel, 40); // CELLA x (Å)
  header.writeFloatLE(ny * pixel, 44); // CELLA y
  header.writeFloatLE(nz * pixel, 48); // CELLA z
  header.writeFloatLE(90, 52); // alpha
  header.writeFloatLE(90, 56); // beta
  header.writeFloatLE(90, 60); // gamma
  header.writeInt32LE(1, 64); // MAPC = 1 (X fastest)
  header.writeInt32LE(2, 68); // MAPR = 2 (Y)
  header.writeInt32LE(3, 72); // MAPS = 3 (Z slowest)
  header.writeFloatLE(dmin, 76); // DMIN
  header.writeFloatLE(dmax, 80); // DMAX
  header.writeFloatLE(dmean, 84); // DMEAN
  header.writeInt32LE(0, 88); // ISORT
  header.writeInt32LE(0, 92); // NSYMBT
  header.writeFloatLE(0, 96); // RMS
  header.writeInt32LE(0, 196); // ORIGIN x
  header.writeInt32LE(0, 200); // ORIGIN y
  header.writeInt32LE(0, 204); // ORIGIN z
  header.write("MAP ", 208, "ascii"); // the magic Mol* refuses to load without
  header.writeInt32LE(0x4144, 212); // MACHST little-endian ("DA")
  return header;
}

/** A REAL stacked MRC: mode 2 float32, frame × frame × frames — small but
 *  every header word honest (the size check demands the bytes). */
function buildMrcStack(frame = 64, frames = EXTRACT_N) {
  const header = Buffer.alloc(1024);
  header.writeInt32LE(frame, 0);
  header.writeInt32LE(frame, 4);
  header.writeInt32LE(frames, 8);
  header.writeInt32LE(2, 12); // mode = float32
  finishMrcHeader(header, frame, frame, frames, 1.77, 0, 0, 0);
  return Buffer.concat([header, Buffer.alloc(frame * frame * 4 * frames)]);
}

/** A single-image MRC (class averages): mode 2, 256×256×1. */
function buildMrcSingle(size = 64) {
  const header = Buffer.alloc(1024);
  header.writeInt32LE(size, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(1, 8);
  header.writeInt32LE(2, 12);
  finishMrcHeader(header, size, size, 1, 1.77, 0, 0, 0);
  return Buffer.concat([header, Buffer.alloc(size * size * 4)]);
}

/** A REAL 3D volume (t661): mode 2 float32, size³, carrying a Gaussian
 *  blob phantom at the box center — the demo family's honest synthetic
 *  (the class-average stacks are phantoms too). The nz=1 stubs this
 *  replaces were header-only zero fills: Mol* refused to build an
 *  isosurface on them (console errors from the state tree), the ortho
 *  x/y tiles 400'd, and the oblique world stayed dark — a 3D viewer
 *  world needs a volume with three live axes. 1 MB per map. */
function buildMrcVolume(size = 64) {
  const header = Buffer.alloc(1024);
  header.writeInt32LE(size, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size, 8);
  header.writeInt32LE(2, 12);
  const data = Buffer.alloc(size * size * size * 4);
  const c = (size - 1) / 2;
  const sigma = size / 8;
  let o = 0;
  let sum = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2;
        const v = 100 * Math.exp(-r2 / (2 * sigma * sigma));
        data.writeFloatLE(v, o);
        sum += v;
        o += 4;
      }
    }
  }
  // honest stats words: the phantom's own numbers, counted not guessed
  finishMrcHeader(header, size, size, size, 1.77, 0, 100, sum / (size * size * size));
  return Buffer.concat([header, data]);
}

/* ---------- t668 — the saved-view family: a real thumbnail derived from
 * the REAL volume bytes (a Z-axis maximum-intensity projection of the
 * same Gaussian blob the 3D viewer renders — the thumb declares "what
 * this world looks like", and it is counted, not guessed). A minimal
 * grayscale PNG encoder (zlib is built in; no canvas in Node) keeps the
 * data-URL budget tiny (~1KB against the 48KB whitelist ceiling). ---- */

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

/** 8-bit grayscale PNG from a w×h byte matrix (no filters — every
 *  scanline speaks filter 0; deflate does the compression). */
function grayscalePng(pixels, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = pixels[y * w + x];
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

/** Z-axis MIP of the float32 volume (header at 1024, mode 2), gamma-
 *  lifted so the blob's mid-tones survive the 8-bit window. */
function buildVolumeMipThumb(volumeBuf, size = 64) {
  const px = Buffer.alloc(size * size);
  const amp = 100;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let m = 0;
      for (let z = 0; z < size; z++) {
        const v = volumeBuf.readFloatLE(1024 + 4 * (z * size * size + y * size + x));
        if (v > m) m = v;
      }
      const t = Math.max(0, Math.min(1, m / amp));
      px[y * size + x] = Math.round(255 * Math.pow(t, 0.6));
    }
  }
  return `data:image/png;base64,${grayscalePng(px, size, size).toString("base64")}`;
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
    // t665 — the denoise branch hangs off MotionCorr on the CANVAS too:
    // placed below-right of its provider, not on the shared default spot
    // (three nodes on one coordinate would render as one blob).
    let x = 160, y = 320;
    if (node.type === "topazdenoise" && chain.motioncorr) {
      const mc = await db.job.findUnique({ where: { id: chain.motioncorr } });
      if (mc) { x = (mc.x ?? 160) + 40; y = (mc.y ?? 320) + 170; }
    }
    // t666 — the training node hangs off the denoise node on the CANVAS
    // too (below-right of its provider, never two nodes on one spot).
    // Runs after the denoise entry in WORKFLOW order, so wf.topazdenoise
    // is resolved here by creation or adoption alike.
    if (node.type === "topaztrain" && wf.topazdenoise) {
      const dn = await db.job.findUnique({ where: { id: wf.topazdenoise } });
      if (dn) { x = (dn.x ?? 160) + 40; y = (dn.y ?? 320) + 170; }
    }
    const created = await db.job.create({
      data: {
        id: node.id, projectId: proj.id, type: node.type, name: node.name,
        x, y, status: "completed", progress: 100, params: "{}",
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
    [chain.motioncorr, wf.topazdenoise],
    // t666 — the official topaz flow: train ON the denoised stack (the
    // t563 gesture's outcome made permanent). The DB row is portless;
    // GET /api/edges infers micrographs→micrographs from the types, which
    // is exactly the toPort the train→pick handoff hunts for its feed.
    [wf.topazdenoise, wf.topaztrain],
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
wd.denoise = workdirOf(proj.id, "topazdenoise", DENOISE_ID);
wd.train = workdirOf(proj.id, "topaztrain", TRAIN_ID);

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
  // t660 — the class-averages stack moves INTO the workdir: RELION 5's
  // final unmasked stack (run_unmasked_classes.mrcs, one 64px slice per
  // class) is the file the /classes route's pickStackName looks for, and
  // without it the inspector's class-averages teaser has shipped DARK
  // (the self-hide contract answered "neither lane" every window). The
  // _fixtures/classes/ copies stay (the t532 map-inventory law reads
  // them); the workdir stack is the teaser's own address.
  plan.push([wd.class2d, "run_unmasked_classes.mrcs", buildMrcStack(64, 8)]);
  // t660 — class3d speaks per-class volumes (run_itNNN_class00K.mrc —
  // the route's volume lane, iteration matching the run_it003_data.star
  // already planted here): three classes, three central-z planes.
  plan.push([wd.class3d, "run_it003_class001.mrc", buildMrcSingle(64)]);
  plan.push([wd.class3d, "run_it003_class002.mrc", buildMrcSingle(64)]);
  plan.push([wd.class3d, "run_it003_class003.mrc", buildMrcSingle(64)]);
  // t665 — the denoise wall's world leg: the index + ten DERIVED frames
  // (16×16 box average of the run's own real inputs — see the builders'
  // note). Files land in the denoise workdir root, the star names them
  // bare — the wrapper's own flat dialect.
  plan.push([wd.denoise, "denoised_micrographs.star", buildDenoisedStar()]);
  for (const m of micNames) {
    plan.push([wd.denoise, m.replace(/\.mrc$/i, "_denoised.mrc"), buildDenoisedFrame(path.join(wd.motioncorr, "micrographs", m))]);
  }
  // t666 — the training branch's world leg: the per-epoch diary inside
  // run.log (the engine record's logFile — the loader's first, winning
  // source) and the model artifact the outputs ledger registers.
  plan.push([wd.train, "run.log", buildTopazTrainingLog()]);
  plan.push([wd.train, "topaz_model.sav", buildTopazModelStub()]);
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
  // lost the snapshot's copies of these files). t661 — real 3D
  // volumes now: the nz=1 zero-fill stubs broke the 3D viewer world
  // (Mol* isosurface refused, ortho x/y tiles 400'd, oblique dark).
  plan.push([wd.refine3d, "run_it020_half1.mrc", buildMrcVolume(64)]);
  plan.push([wd.refine3d, "run_it020_half2.mrc", buildMrcVolume(64)]);
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
    // t665 — the key the denoise-pairs route reads FIRST (the on-disk
    // fallback is the same path — the ledger and the layout agree).
    topazdenoise: { micrographs_star: rel(path.join(wd.denoise, "denoised_micrographs.star")) },
    // t666 — the key the engine itself speaks (outputs.topaz_model) and
    // the port the autopick Topaz mode's model mouth accepts.
    topaztrain: { topaz_model: rel(path.join(wd.train, "topaz_model.sav")) },
  };
}

const RESULTS = {
  import: "10 real EMPIAR micrographs imported (hard-linked in place — zero upload, zero copy)",
  motioncorr: "10 micrographs aligned (own motioncorr, patch 3×3)",
  ctffind: "10 micrographs CTF-fitted — defocus family 14.9-12.7k Å",
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
  topazdenoise: "10 micrographs denoised (Topaz) — 16×16 box average · 256² at 28.32 Å/px, derived from the run's own frames",
  topaztrain: "Topaz model trained on the denoised stack — 12 epochs, best test loss 0.494 at epoch 9 · connect into Auto-picking (Topaz mode)",
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
  // t665 — the denoise branch carries its own ledger record (the route's
  // registered-output leg reads outputs.micrographs_star from HERE).
  state[DENOISE_ID] = {
    jobId: DENOISE_ID,
    projectId: proj.id,
    type: "topazdenoise",
    pid: null,
    cmd: "seeded:topazdenoise",
    workdir: wd.denoise,
    logFile: path.join(wd.denoise, "run.log"),
    errFile: path.join(wd.denoise, "run.err"),
    startedAt: now,
    outputs: outs.topazdenoise,
    done: true,
    exitCode: 0,
    result: RESULTS.topazdenoise,
  };
  // t666 — the training branch carries its own ledger record: the chart
  // loader reads logFile (run.log, the diary inside), the handoff card
  // reads done + exitCode, the pick mint reads nothing but the type.
  state[TRAIN_ID] = {
    jobId: TRAIN_ID,
    projectId: proj.id,
    type: "topaztrain",
    pid: null,
    cmd: "seeded:topaztrain",
    workdir: wd.train,
    logFile: path.join(wd.train, "run.log"),
    errFile: path.join(wd.train, "run.err"),
    startedAt: now,
    outputs: outs.topaztrain,
    done: true,
    exitCode: 0,
    result: RESULTS.topaztrain,
  };
  writeAtomic(STATE, JSON.stringify(state, null, 2));
}

/** t668 — the saved-view family: the refine3d half-maps' world gets THREE
 *  named camera bookmarks (the dashboard's Saved views wall and — new —
 *  the palette's Saved views group both read them through
 *  /api/views/gallery; the jump itself rides the PENDING_VIEW_KEY
 *  handshake the dashboard card already owns). Fixed ids: a re-seed
 *  OVERWRITES the same three views — a bookmark is a named snapshot, and
 *  idempotency is the seeder's own law. Camera poses speak the same
 *  number family the product's own saves were observed writing (qa48's
 *  proven-against-restore shape); the view half carries one plain iso
 *  view, one Z-slice, one front-clip — the chips get something to say. */
function buildSeedBookmarks() {
  const thumb = buildVolumeMipThumb(buildMrcVolume(64));
  const pose = (position, radius) => ({
    mode: "camera",
    fov: 0.876,
    position,
    up: [0, 1, 0],
    target: [0.1, 0.2, 0.3],
    radius,
    radiusMax: 120,
    fog: 0,
    clipFar: 0,
    minNear: 0,
    minFar: 0,
  });
  const now = Date.now();
  return [
    {
      id: "seedview1",
      name: "Centered iso view",
      ts: now - 3000,
      thumb,
      snapshot: pose([12.3, -4.5, 30.1], 52.4),
      view: { sigma: 3, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
    },
    {
      id: "seedview2",
      name: "Top-down slice",
      ts: now - 2000,
      thumb,
      snapshot: pose([2, 28, 6], 60),
      view: { sigma: 2, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
    },
    {
      id: "seedview3",
      name: "Front half clipped",
      ts: now - 1000,
      thumb,
      snapshot: pose([30, 2, 4], 55),
      view: { sigma: 1.8, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: true, x: 0.5, y: 1, z: 1, invert: false } },
    },
  ];
}

async function seedBookmarkSession() {
  const data = JSON.stringify(buildSeedBookmarks());
  await db.bookmarkSession.upsert({
    where: { jobId: chain.refine3d },
    update: { data },
    create: { jobId: chain.refine3d, data },
  });
  console.log("  bookmark session: 3 saved views on the refine3d half-map world");
}

function seedLogs() {
  for (const t of CHAIN) {
    writeAtomic(path.join(wd[t], "run.log"), `seeded by qa-t531-old-world-seed — ${RESULTS[t]}\n`);
    writeAtomic(path.join(wd[t], "run.err"), "");
  }
  writeAtomic(path.join(wd.denoise, "run.log"), `seeded by qa-t531-old-world-seed — ${RESULTS.topazdenoise}\n`);
  writeAtomic(path.join(wd.denoise, "run.err"), "");
  // t666 — the training diary lives INSIDE run.log (the loader's first
  // and winning source); the generic loop above would have flattened it
  // to a header line, so the training branch writes its own.
  writeAtomic(path.join(wd.train, "run.log"), buildTopazTrainingLog());
  writeAtomic(path.join(wd.train, "run.err"), "");
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
  // t673 — the LINKS come before the PLAN. filePlan()'s denoise leg
  // (buildDenoisedFrame, t665) READS the motioncorr workdir's corrected
  // frames — which only exist once linkPlan() has laid its hard links.
  // On every world since t665 the links predated the seeder (they
  // survived the sweeps it was built to repair), so the read-before-link
  // ordering slept; the first post-total-wipe run (this window: db +
  // data/relion + engine-state + the EMPIAR bundle all gone at once)
  // hit the ENOENT live. Inputs before plans — the same law the engine
  // itself obeys (a run reads what its provider's workdir holds).
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
  const plan = filePlan();
  for (const [dir, name, content] of plan) {
    const file = path.join(dir, name);
    writeAtomic(file, content);
    console.log(`  wrote ${path.relative(REPO, file)} (${content.length}B)`);
  }
  seedLogs();
  seedEngineRecords();
  await seedBookmarkSession();
  console.log("  engine-state records: 13 chain links + topazdenoise + topaztrain branches (done · exitCode 0 · real outputs)");
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
  // t665 — the denoise branch: ledger, index, and every derived frame on
  // disk (the pairing leg the route rides: bare rows → starDir direct hit).
  const dr = state[DENOISE_ID];
  ok(dr?.done === true && dr?.exitCode === 0 && dr?.type === "topazdenoise", "engine record topazdenoise: done + exit 0");
  ok(dr && Object.values(dr.outputs ?? {}).flat().every((f) => existsSync(f)), "engine record topazdenoise: outputs live");
  const denStar = readFileSync(path.join(wd.denoise, "denoised_micrographs.star"), "utf8");
  const denRows = denStar.split(/\r?\n/).filter((l) => /_denoised\.mrc$/i.test(l.trim()));
  ok(denRows.length === micNames.length, `denoised index: ${denRows.length} rows for ${micNames.length} frames`);
  for (const row of denRows) {
    ok(existsSync(path.join(wd.denoise, row.trim().split(/\s+/)[0])), `denoised frame on disk: ${row.trim().split(/\s+/)[0]}`);
  }
  // t666 — the training branch: ledger, model artifact, and the diary's
  // epoch rows (the shape the tolerant parser's pass A reads — the chart
  // needs ≥ 2 epochs to call it a curve).
  const tr = state[TRAIN_ID];
  ok(tr?.done === true && tr?.exitCode === 0 && tr?.type === "topaztrain", "engine record topaztrain: done + exit 0");
  ok(tr && Object.values(tr.outputs ?? {}).flat().every((f) => existsSync(f)), "engine record topaztrain: outputs live");
  ok(tr?.logFile === path.join(wd.train, "run.log") && existsSync(tr.logFile), "engine record topaztrain: logFile on disk");
  const trainLog = readFileSync(path.join(wd.train, "run.log"), "utf8");
  const epochRows = trainLog.split(/\r?\n/).filter((l) => /^\d+,[\d.]+,[\d.]+,[\d.]+,[\d.]+$/.test(l.trim()));
  ok(epochRows.length === 12, `training diary: ${epochRows.length} epoch rows`);
  ok(/^# it,train_loss,test_loss,precision,recall$/m.test(trainLog), "training diary: parser-dialect header");
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  ok(m.project?.id === proj.id && Object.keys(m.chain ?? {}).length === 13, "manifest: project + 13 chain ids");
  const selText = readFileSync(path.join(wd.select, "selected.star"), "utf8");
  const firstRef = /@(\S+)/.exec(selText)?.[1] ?? "";
  const stack = path.join(PDIR, firstRef);
  ok(existsSync(stack), `the select star's stack resolves project-relative (${path.relative(REPO, stack)})`);
  ok(firstRef.startsWith("extract_") && !firstRef.startsWith("extra/"), `select star refs project-relative (${firstRef})`);
  await countRoster();
  ok(rosterCount >= 17, `roster ≥ 17 (${rosterCount})`);
  // t668 — the saved-view family: the session row parses, three entries
  // carry the three vec3s that ARE the pose, the thumbs are honest data
  // URLs derived from the world's own volume, and the view half speaks
  // the chips' language (sigma / slice / clip).
  const bmRow = await db.bookmarkSession.findUnique({ where: { jobId: chain.refine3d } });
  ok(bmRow != null, "bookmark session: row exists for the refine3d job");
  let bmList = [];
  try { bmList = JSON.parse(bmRow?.data ?? "[]"); } catch { /* corrupt — the anchors below speak */ }
  ok(Array.isArray(bmList) && bmList.length === 3, `bookmark session: 3 entries (${bmList.length})`);
  ok(bmList.every((b) =>
    typeof b.id === "string" && typeof b.name === "string" &&
    Array.isArray(b.snapshot?.position) && b.snapshot.position.length === 3 &&
    Array.isArray(b.snapshot?.up) && Array.isArray(b.snapshot?.target) &&
    Number.isFinite(b.snapshot?.radius)),
    "bookmark session: every entry carries the pose vec3s + radius");
  // t700 — the honesty criterion is the BYTES, not the codec: the app's
  // save path (molstar-embed.tsx L1923) deliberately writes JPEG thumbs
  // (toDataURL "image/jpeg", 0.72 — a size-conscious choice, comment says
  // "small JPEG thumbnail") while the seed's own thumbs are grayscale
  // PNGs. Both are honest rasters; a human re-saving a view through the
  // app is the world working, not the world breaking. The png-only prefix
  // check was the probe's vocabulary being narrower than the app's real
  // contract. The upgraded assertion is STRICTER, not looser: the decoded
  // payload must carry the magic bytes of the codec it declares (PNG
  // 89 50 4E 47, JPEG FF D8 FF) — a data URL that lies about its own
  // format is exactly the dishonesty this check exists to catch.
  ok(bmList.every((b) => {
    if (typeof b.thumb !== "string") return false;
    const m = b.thumb.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return false;
    const h = Buffer.from(m[2], "base64").subarray(0, 3);
    return m[1] === "png"
      ? h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e
      : h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  }),
    "bookmark session: thumbs are honest data-URL rasters (magic bytes match the declared codec)");
  ok(bmList.filter((b) => b.view?.slice?.on).length === 1 && bmList.filter((b) => b.view?.clip?.on).length === 1,
    "bookmark session: one slice view + one clip view (the chips have something to say)");
}

console.log(fail === 0 ? (CHECK ? "CHECK PASS" : "SEED OK") : `${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
await db.$disconnect();

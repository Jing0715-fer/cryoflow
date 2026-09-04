/**
 * CryoFlow — REAL RELION 5 execution engine (SERVER ONLY).
 *
 * Spawns the actual RELION CLI programs (command shapes extracted from
 * /home/z/relion-build/pipeline_jobs.cpp — RELION 5.0.1 getCommands* builders).
 * Engine state (pid / workdir / log / outputs) lives in data/engine-state.json
 * so it survives Next.js dev-server hot reloads (the Prisma schema is frozen).
 *
 * Three job classes:
 *  - engine-native (import / manualpick / select): no RELION binary needed,
 *    writes RELION-5 style STAR files directly.
 *  - real CLI jobs: spawn relion_* binaries with faithful argv.
 *  - external jobs: honest failure when the external binary is absent.
 */

import type { ChildProcess } from "child_process";
import { execFile, spawn } from "child_process";
import {
  appendFileSync,
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import path from "path";
import type { Job } from "@prisma/client";
import { db } from "@/lib/db";
import { detectRelion } from "./system";

/* ------------------------------------------------------------------ */
/* Paths & constants                                                    */
/* ------------------------------------------------------------------ */

const DATA_DIR = "/home/z/my-project/data";
const STATE_FILE = path.join(DATA_DIR, "engine-state.json");
const RELION_ROOT = path.join(DATA_DIR, "relion");
const EMPIAR_DIR = "/home/z/empiar-10017/micrographs";
const MPICH_BIN = "/home/z/relion-build/deps/mpich/bin";
const MPICH_LIB = "/home/z/relion-build/deps/mpich/lib";
const FFTW_LIB = "/home/z/relion-build/deps/fftw/lib";
const CTFFIND_EXE = "/home/z/relion-build/deps/ctffind/bin/ctffind";

const MPI_PARALLEL_TYPES = new Set(["class2d", "class3d", "refine3d"]);

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface RunRecord {
  jobId: string;
  projectId: string;
  type: string;
  pid: number | null;
  cmd: string;
  workdir: string;
  logFile: string;
  errFile: string;
  startedAt: string;
  outputs: Record<string, string>;
  done: boolean;
  exitCode: number | null;
  result?: string | null;
}

export interface EngineJobRef {
  id: string;
  projectId: string;
  type: string;
  params: Record<string, number | string | boolean>;
}

export interface UpstreamRef {
  id: string;
  type: string;
  params?: Record<string, number | string | boolean>;
}

export interface RunOutcome {
  ok: boolean;
  /** true when the job completed synchronously (engine-native). */
  native?: boolean;
  pid?: number;
  error?: string;
  result?: string;
  /** Set when an interrupted refine-family run was resumed via --continue
   * (the iteration number it picked up from). */
  resumedFrom?: number;
}

/** Live child processes (lost on server restart — reconcile handles that). */
const live = new Map<string, ChildProcess>();

/* ------------------------------------------------------------------ */
/* State file                                                           */
/* ------------------------------------------------------------------ */

export function readRuns(): Record<string, RunRecord> {
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, RunRecord>;
    }
  } catch {
    // ENOENT / corrupt → fresh state
  }
  return {};
}

export function writeRuns(map: Record<string, RunRecord>): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(map, null, 2));
}

export function getRun(jobId: string): RunRecord | null {
  return readRuns()[jobId] ?? null;
}

/**
 * Forget a job's run record (used by the explicit user reset). The next
 * run then starts FRESH instead of resuming from a leftover checkpoint —
 * "Reset & edit" semantically means "discard this run".
 */
export function clearRunRecord(jobId: string): void {
  const runs = readRuns();
  if (!(jobId in runs)) return;
  delete runs[jobId];
  writeRuns(runs);
}

/* ------------------------------------------------------------------ */
/* Environment                                                          */
/* ------------------------------------------------------------------ */

/** Environment for spawning RELION binaries (PATH + libs + RELION_HOME). */
export function relionEnv(binDir: string): NodeJS.ProcessEnv {
  const pathParts: string[] = [binDir];
  if (existsSync(MPICH_BIN)) pathParts.push(MPICH_BIN);
  const libParts = [MPICH_LIB, FFTW_LIB].filter((p) => existsSync(p));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: pathParts.join(":") + ":" + (process.env.PATH ?? ""),
    RELION_HOME: binDir.replace(/\/bin\/?$/, ""),
  };
  // relion_run_ctffind does NOT search PATH — it needs an explicit executable
  if (existsSync(CTFFIND_EXE)) env.RELION_CTFFIND_EXECUTABLE = CTFFIND_EXE;
  env.LD_LIBRARY_PATH =
    libParts.length > 0
      ? libParts.join(":") + ":" + (process.env.LD_LIBRARY_PATH ?? "")
      : (process.env.LD_LIBRARY_PATH ?? "");
  return env;
}

function workdirFor(job: EngineJobRef): string {
  return path.join(RELION_ROOT, job.projectId, `${job.type}_${job.id.slice(-8)}`);
}

/**
 * RELION "project root" directory — all real CLI jobs run with this as CWD
 * (mirrors how the RELION GUI/pipeliner launches jobs from the pipeline root),
 * so STAR files can use project-relative micrograph paths. ctffind_runner
 * symlinks micrographs as (cwd + star-path) → output-dir + path, which only
 * resolves when CWD is this directory.
 */
function projectDirFor(job: EngineJobRef): string {
  return path.join(RELION_ROOT, job.projectId);
}

/* ------------------------------------------------------------------ */
/* Param helpers                                                        */
/* ------------------------------------------------------------------ */

function num(job: EngineJobRef, key: string, fallback: number): number {
  const v = job.params[key];
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function str(job: EngineJobRef, key: string, fallback: string): string {
  const v = job.params[key];
  return v === undefined || v === null ? fallback : String(v);
}

function flag(job: EngineJobRef, key: string): boolean {
  return String(job.params[key] ?? "false") === "true";
}

/** Particle pixel size: import pixel × (extract box / downsample). */
function particlePixel(job: EngineJobRef, upstream: UpstreamRef[]): number {
  const importUp = upstream.find((u) => u.type === "import" || u.type === "tomo_import");
  const extractUp = upstream.find((u) => u.type === "extract");
  const pixel =
    importUp?.params && typeof importUp.params.pixelSize === "number"
      ? importUp.params.pixelSize
      : 1.77;
  if (extractUp?.params) {
    const box = typeof extractUp.params.boxSize === "number" ? extractUp.params.boxSize : 128;
    const down =
      typeof extractUp.params.downsampleTo === "number" ? extractUp.params.downsampleTo : 0;
    if (down > 0 && down < box) return (pixel * box) / down;
  }
  return pixel;
}

/* ------------------------------------------------------------------ */
/* Input resolution (upstream runs' outputs)                            */
/* ------------------------------------------------------------------ */

interface InputReq {
  /** Canonical key under which the resolved path is stored. */
  key: string;
  /** Upstream output keys that satisfy this requirement (first match wins). */
  accepts: string[];
  /** Upstream job types allowed to provide it. */
  from: string[];
  /** Human label used in honest-failure messages. */
  label: string;
}

const INPUTS: Record<string, InputReq[]> = {
  ctffind: [
    { key: "micrographs_star", accepts: ["micrographs_star"], from: ["import", "motioncorr"], label: "micrographs.star (run Import first)" },
  ],
  motioncorr: [
    { key: "micrographs_star", accepts: ["micrographs_star"], from: ["import"], label: "micrographs.star (run Import first)" },
  ],
  manualpick: [
    { key: "micrographs_star", accepts: ["micrographs_star"], from: ["import", "motioncorr", "ctffind"], label: "micrographs.star (run Import first)" },
  ],
  autopick: [
    { key: "micrographs_star", accepts: ["micrographs_star", "micrographs_ctf_star"], from: ["import", "motioncorr", "ctffind"], label: "micrographs.star (run Import first)" },
    { key: "refs_mrc", accepts: ["classes_mrc", "model_mrc"], from: ["class2d", "initialmodel", "class3d"], label: "2D reference templates (run Class2D first)" },
  ],
  extract: [
    { key: "micrographs_star", accepts: ["micrographs_star", "micrographs_ctf_star"], from: ["import", "motioncorr", "ctffind"], label: "micrographs.star (run Import first)" },
    { key: "coords_dir", accepts: ["coords_dir", "coords_star"], from: ["manualpick", "autopick"], label: "particle coordinates (run ManualPick/AutoPick first)" },
  ],
  select: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "class2d", "select", "joinstar"], label: "particles.star (run Extract first)" },
  ],
  class2d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d", "joinstar"], label: "particles.star (run Extract first)" },
  ],
  initialmodel: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d", "joinstar"], label: "particles.star (run Extract first)" },
  ],
  class3d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d", "initialmodel"], label: "particles.star (run Extract first)" },
    { key: "model_mrc", accepts: ["model_mrc", "classes_mrc"], from: ["initialmodel", "class3d", "class2d"], label: "reference map (run InitialModel first)" },
  ],
  refine3d: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d", "joinstar", "initialmodel"], label: "particles.star (run Extract first)" },
    { key: "model_mrc", accepts: ["model_mrc", "classes_mrc"], from: ["initialmodel", "class3d", "class2d"], label: "reference map (run InitialModel first)" },
  ],
  multibody: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "select", "class2d"], label: "particles.star (run Extract first)" },
    { key: "optimiser_star", accepts: ["optimiser_star"], from: ["refine3d", "class3d"], label: "optimiser.star (run Refine3D first)" },
  ],
  maskcreate: [
    { key: "map_mrc", accepts: ["half1_mrc", "model_mrc", "map_mrc"], from: ["refine3d", "initialmodel", "class3d", "postprocess", "localres"], label: "3D map (run Refine3D first)" },
  ],
  postprocess: [
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["refine3d"], label: "half1 map (run Refine3D first)" },
    { key: "half2_mrc", accepts: ["half2_mrc"], from: ["refine3d"], label: "half2 map (run Refine3D first)" },
    { key: "mask_mrc", accepts: ["mask_mrc"], from: ["maskcreate"], label: "solvent mask (run MaskCreate first)" },
  ],
  localres: [
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["refine3d"], label: "half1 map (run Refine3D first)" },
    { key: "mask_mrc", accepts: ["mask_mrc"], from: ["maskcreate"], label: "solvent mask (run MaskCreate first)" },
  ],
  polish: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "refine3d", "class2d"], label: "particles.star (run Extract first)" },
    { key: "postprocess_star", accepts: ["postprocess_star"], from: ["postprocess"], label: "postprocess.star (run PostProcess first)" },
    { key: "micrographs_star", accepts: ["micrographs_star", "corrected_micrographs_star"], from: ["motioncorr", "import"], label: "corrected micrographs.star (run MotionCorr first)" },
  ],
  ctfrefine: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "refine3d", "class2d"], label: "particles.star (run Extract first)" },
    { key: "postprocess_star", accepts: ["postprocess_star"], from: ["postprocess"], label: "postprocess.star (run PostProcess first)" },
  ],
  dynamight: [
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "refine3d", "class2d"], label: "particles.star (run Extract first)" },
    { key: "model_mrc", accepts: ["model_mrc", "map_mrc"], from: ["refine3d", "postprocess"], label: "consensus map (run Refine3D first)" },
  ],
  modelangelo: [
    { key: "map_mrc", accepts: ["map_mrc", "model_mrc"], from: ["postprocess", "refine3d"], label: "sharpened map (run PostProcess first)" },
  ],
  subtract: [
    { key: "optimiser_star", accepts: ["optimiser_star"], from: ["refine3d", "class3d"], label: "optimiser.star (run Refine3D first)" },
    { key: "mask_mrc", accepts: ["mask_mrc"], from: ["maskcreate"], label: "mask of signal to subtract (run MaskCreate first)" },
    { key: "particles_star", accepts: ["particles_star"], from: ["extract", "refine3d"], label: "particles.star (run Extract first)" },
  ],
  tomo_import: [],
  tomo_aligntiltseries: [
    { key: "tilt_series_star", accepts: ["tilt_series_star", "tilt_series_ctf_star"], from: ["tomo_import", "tomo_exclude"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_tomograms: [
    { key: "tilt_series_star", accepts: ["aligned_tilt_series_star", "tilt_series_star"], from: ["tomo_aligntiltseries", "tomo_import"], label: "aligned tilt series (run Tomo: Align Tilt Series first)" },
  ],
  tomo_ctfrefine: [
    { key: "particles_star", accepts: ["particles_star"], from: ["tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["tomo_reconstruct", "refine3d"], label: "reference half-map (run Tomo: Reconstruct first)" },
  ],
  tomo_exclude: [
    { key: "tilt_series_star", accepts: ["tilt_series_star"], from: ["tomo_import", "tomo_aligntiltseries"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_polish: [
    { key: "particles_star", accepts: ["particles_star"], from: ["tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
    { key: "half1_mrc", accepts: ["half1_mrc"], from: ["tomo_reconstruct", "refine3d"], label: "reference half-map (run Tomo: Reconstruct first)" },
  ],
  tomo_reconstruct: [
    { key: "particles_star", accepts: ["particles_star"], from: ["tomo_extract", "tomo_picks"], label: "particles.star (run Tomo: Extract first)" },
  ],
  tomo_denoise: [
    { key: "tomograms_star", accepts: ["tomograms_star"], from: ["tomo_tomograms"], label: "tomograms.star (run Tomo: Reconstruct Tomograms first)" },
  ],
  tomo_picks: [
    { key: "tilt_series_star", accepts: ["tilt_series_star", "aligned_tilt_series_star"], from: ["tomo_aligntiltseries", "tomo_import"], label: "tilt_series.star (run Tomo: Import first)" },
  ],
  tomo_extract: [
    { key: "particles_star", accepts: ["particles_star"], from: ["tomo_picks"], label: "picks (run Tomo: Picking first)" },
  ],
  external: [],
};

/** Requirements a type can NEVER resolve through the graph → generic fail. */
const GENERIC_REQUIREMENTS: Record<string, string> = {
  multibody: "a body STAR file (bodies.star with multi-body masks)",
  joinstar: "two or more particle STAR files wired as inputs (joinstar combines them)",
  tomo_import: "SerialEM tilt-series movies + .mdoc files (no tilt data present in this project)",
  external: "a custom run.sh script inside the job directory",
};

/**
 * Resolve required inputs from upstream completed runs.
 * `missing` is a human-readable failure message (null on success).
 */
function resolveInputs(
  type: string,
  upstream: UpstreamRef[]
): { inputs: Record<string, string>; missing: string | null } {
  const reqs = INPUTS[type] ?? [];
  const runs = readRuns();
  const inputs: Record<string, string> = {};

  for (const req of reqs) {
    let resolved: string | null = null;
    // upstream arrives in INPUT-PRIORITY order from lineageFor(): BFS by
    // graph distance (direct parents first) with newest-first within a
    // layer — scan forward and take the first provider that has the output.
    for (const up of upstream) {
      if (!req.from.includes(up.type)) continue;
      const state = runs[up.id];
      if (!state || !state.done || state.exitCode !== 0) continue;
      for (const key of req.accepts) {
        const p = state.outputs[key];
        if (p && existsSync(p)) {
          resolved = p;
          break;
        }
      }
      if (resolved) break;
    }
    if (!resolved) {
      return { inputs: {}, missing: `Waiting for upstream output: ${req.label}` };
    }
    inputs[req.key] = resolved;
  }
  return { inputs, missing: null };
}

/* ------------------------------------------------------------------ */
/* Command templates (all 32 types — for reference/UI)                  */
/* ------------------------------------------------------------------ */

/**
 * Canonical RELION 5.0.1 command templates (extracted from pipeline_jobs.cpp).
 * <...> placeholders are substituted with real paths/params by buildArgv().
 */
export const COMMAND_TEMPLATES: Record<string, string> = {
  import: "engine-native: write micrographs.star (RELION 5 optics format)",
  motioncorr: "relion_run_motioncorr --i <micrographs.star> --o <outdir>/ --use_motioncor2 --motioncor2_exe <mc2> --bin_factor <bf> --bfactor <bfac> --dose_per_frame <dose> --patch_x <px> --patch_y <py> --j <n>",
  ctffind: "relion_run_ctffind --i <micrographs.star> --o <outdir>/ --Box <box> --ResMin <rmin> --ResMax <rmax> --dFMin <dmin> --dFMax <dmax> --FStep 500 --dAst 0 --is_ctffind4 --fast_search [--ctffind_exe <ctffind>]",
  manualpick: "engine-native: import Henderson .coord picks → manualpick.star (_rlnCoordinateX/Y + _rlnMicrographName)",
  autopick: "relion_autopick --i <micrographs.star> --odir <outdir>/ --pickname autopick --particle_diameter <dia> --threshold <thr> --lowpass <lp> --ref <refs.mrc>",
  extract: "relion_preprocess --i <micrographs_ctf.star> --coord_list <coords.star> --part_star <outdir>/particles.star --part_dir <outdir>/ --extract --extract_size <box> [--scale <down>] --norm --bg_radius <bgr> --white_dust 3 --black_dust -3",
  select: "engine-native: particle selection — class-aware occupancy pruning when input has _rlnClassNumber, else first-N",
  class2d: "mpirun -n 2 relion_refine --i <particles.star> --o <outdir>/run --K <K> --tau2_fudge 1 --particle_diameter <dia> --ctf --pad 2 --iter <it> --flatten_solvent --zero_mask",
  initialmodel: "relion_refine --grad --denovo_3dref --i <particles.star> --o <outdir>/run --K <K> --particle_diameter <dia> --sym <sym> --ctf --iter <it> --flatten_solvent --zero_mask",
  class3d: "mpirun -n 2 relion_refine --i <particles.star> --ref <ref.mrc> --o <outdir>/run --K <K> --tau2_fudge 4 --particle_diameter <dia> --sym <sym> --ctf --pad 2 --iter <it> --flatten_solvent",
  refine3d: "mpirun -n 3 relion_refine --i <particles.star> --ref <ref.mrc> --o <outdir>/run --sym <sym> --particle_diameter <dia> --ctf --pad <pad> --firstiter_cc --ini_high <iniHigh> --trust_ref_size --split_random_halves [--auto_refine | --iter <it> --tau2_fudge 1]",
  multibody: "mpirun -n 2 relion_refine --continue <optimiser.star> --o <outdir>/run --solvent_correct_fsc --multibody_masks <bodies.star> --oversampling 1",
  maskcreate: "relion_mask_create --i <half1.mrc> --o <outdir>/mask.mrc --lowpass <lp> --angpix <pix> --ini_threshold <thr> --extend_inimask <ext> --width_soft_edge <soft> --j 4",
  joinstar: "relion_star_handler --combine --i <parts1.star parts2.star ...> --check_duplicates rlnImageName --o <outdir>/join_particles.star",
  subtract: "relion_particle_subtract --i <optimiser.star> --mask <mask.mrc> --data <particles.star> --o <outdir>/ [--recenter_on_mask] [--float16] [--new_box <box>]",
  postprocess: "relion_postprocess --i <half1.mrc> --o <outdir>/postprocess --mask <mask.mrc> --angpix <pix> [--auto_bfac --autob_lowres <lr>]",
  localres: "relion_postprocess --locres --i <half1.mrc> --o <outdir>/relion --angpix <pix> --adhoc_bfac <bfac> [--mask <mask.mrc>]",
  polish: "relion_motion_refine --i <particles.star> --f <postprocess.star> --corr_mic <corrected_micrographs.star> --first_frame <f> --last_frame <l> --o <outdir>/ --eval_frac <ef>",
  ctfrefine: "relion_ctf_refine --i <particles.star> --f <postprocess.star> --o <outdir>/ --fit_defocus --kmin_defocus <kmin>",
  dynamight: "relion_python_dynamight optimize-deformations --refinement-star-file <particles.star> --output-directory <outdir>/ --initial-model <map.mrc> --n-gaussians <ng> --regularization-factor <rf> --n-threads <nt>",
  modelangelo: "model_angelo build_no_seq -v <map.mrc> -o <outdir>/ -d <gpu>",
  tomo_import: "relion_python_tomo_import SerialEM --tilt-image-movie-pattern <movies> --mdoc-file-pattern <mdocs> --nominal-tilt-axis-angle <angle> --nominal-pixel-size <pix> --voltage <kV> --spherical-aberration <Cs> --amplitude-contrast <Q0> --dose-per-tilt-image <dose> --output-directory <outdir>/",
  tomo_aligntiltseries: "relion_align_tiltseries --i <tilt_series.star> --o <outdir>/ --tomogram_thickness <thick> --aretomo2 --aretomo_exe <aretomo> --gpu <gpu>",
  tomo_tomograms: "relion_tomo_reconstruct_tomogram --t <aligned_tilt_series.star> --o <outdir>/ --w <xdim> --h <ydim> --d <zdim> --binned_angpix <binned> --j <n>",
  tomo_ctfrefine: "relion_tomo_refine_ctf --i <particles.star> --ref1 <half1.mrc> --ref2 <half2.mrc> --b <box> --focus_range <range> --o <outdir>/",
  tomo_exclude: "relion_python_tomo_exclude_tilt_images --tilt-series-star-file <tilt_series.star> --cache-size <cache> --output-directory <outdir>/",
  tomo_polish: "relion_tomo_align --ref1 <half1.mrc> --ref2 <half2.mrc> --theme classic --o <outdir>/ --b <box> --r <maxerr> [--shift_only]",
  tomo_reconstruct: "relion_tomo_reconstruct_particle --i <particles.star> --theme classic --o <outdir>/ --b <box> --bin <bin> --j <n> --sym C1",
  tomo_denoise: "relion_python_tomo_denoise cryoCARE:<train|predict> --tomogram-star-file <tomograms.star> --output-directory <outdir>/ --gpu <gpu>",
  tomo_picks: "relion_python_tomo_pick <mode> --tilt-series-star-file <tilt_series.star> --output-directory <outdir>/ && relion_python_tomo_get_particle_poses <mode> --annotations-directory <outdir>/annotations --output-directory <outdir>/",
  tomo_extract: "relion_tomo_subtomo --i <particles.star> --theme classic --o <outdir>/ --b <box> --bin <bin> --stack2d --float16 --j <n>",
  external: "bash <outdir>/run.sh (user-provided script, RELION metadata exported as env vars)",
};

/* ------------------------------------------------------------------ */
/* STAR file helpers                                                    */
/* ------------------------------------------------------------------ */

interface StarBlock {
  /** "data_xxx" header line. */
  header: string;
  /** All following lines (including loop_/labels/rows). */
  lines: string[];
}

function parseStarBlocks(text: string): StarBlock[] {
  const blocks: StarBlock[] = [];
  let current: StarBlock | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^data_/.test(line.trim())) {
      current = { header: line.trim(), lines: [] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return blocks;
}

/** Micrograph names from a micrographs.star (first column after the loop header). */
function micrographNames(starPath: string): string[] {
  const blocks = parseStarBlocks(readFileSync(starPath, "utf8"));
  const micBlock = blocks.find(
    (b) => b.header === "data_micrographs" || b.lines.some((l) => l.includes("_rlnMicrographName"))
  );
  if (!micBlock) return [];
  const names: string[] = [];
  for (const line of micBlock.lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t === "loop_" || t.startsWith("_rln") || t.startsWith("data_")) {
      continue;
    }
    const first = t.split(/\s+/)[0];
    if (first) names.push(first);
  }
  return names;
}

/* ------------------------------------------------------------------ */
/* Engine-native jobs                                                   */
/* ------------------------------------------------------------------ */

interface NativeResult {
  ok: boolean;
  result?: string;
  error?: string;
}

function recordNativeRun(
  job: EngineJobRef,
  workdir: string,
  cmd: string,
  outputs: Record<string, string>,
  result: string,
  logText: string
): void {
  const logFile = path.join(workdir, "run.out");
  const errFile = path.join(workdir, "run.err");
  appendFileSync(logFile, logText);
  writeFileSync(errFile, "");
  const runs = readRuns();
  runs[job.id] = {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    pid: null,
    cmd,
    workdir,
    logFile,
    errFile,
    startedAt: new Date().toISOString(),
    outputs,
    done: true,
    exitCode: 0,
    result,
  };
  writeRuns(runs);
}

/** Import: writes a RELION 5 optics-group micrographs.star (EMPIAR or empty). */
async function runImportNative(job: EngineJobRef): Promise<NativeResult> {
  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const projectDir = projectDirFor(job);
  mkdirSync(projectDir, { recursive: true });

  const pixel = num(job, "pixelSize", 1.77);
  const kV = num(job, "voltage", 300);
  const cs = num(job, "cs", 2.7);
  const q0 = num(job, "ampContrast", 0.1);
  const empiar = String(job.params.empiarData ?? "") === "true";

  const starPath = path.join(workdir, "micrographs.star");
  const lines: string[] = [
    "data_optics",
    "",
    "loop_",
    "_rlnOpticsGroup #1",
    "_rlnOpticsGroupName #2",
    "_rlnMicrographPixelSize #3",
    "_rlnVoltage #4",
    "_rlnSphericalAberration #5",
    "_rlnAmplitudeContrast #6",
    `1 optGroup1 ${pixel} ${kV} ${cs} ${q0}`,
    "",
    "data_micrographs",
    "",
    "loop_",
    "_rlnMicrographName #1",
    "_rlnOpticsGroup #2",
  ];

  let result: string;
  if (empiar) {
    const mrcs = existsSync(EMPIAR_DIR)
      ? readdirSync(EMPIAR_DIR)
          .filter((f) => f.endsWith(".mrc"))
          .sort()
      : [];
    if (mrcs.length === 0) {
      return { ok: false, error: `EMPIAR directory not found: ${EMPIAR_DIR}` };
    }
    // Project-relative paths + a symlink so every downstream RELION job (run
    // with CWD = projectDir) can open "micrographs/<name>.mrc". This mirrors
    // the RELION pipeliner: STAR paths are project-root-relative.
    const micLink = path.join(projectDir, "micrographs");
    if (!existsSync(micLink)) symlinkSync(EMPIAR_DIR, micLink);
    // Also expose the micrographs inside the import job's own workdir so the
    // Files tab + gallery can serve PNG previews through outputs/file.
    const micLinkInWorkdir = path.join(workdir, "micrographs");
    if (!existsSync(micLinkInWorkdir)) symlinkSync(EMPIAR_DIR, micLinkInWorkdir);
    for (const m of mrcs) lines.push(`micrographs/${m} 1`);
    result = `${mrcs.length} micrographs imported · EMPIAR-10017 (pixel ${pixel} Å)`;
  } else {
    result = "Import job completed (no source data configured)";
  }

  writeFileSync(starPath, lines.join("\n") + "\n");
  const logText = [
    `CryoFlow engine-native import ${new Date().toISOString()}`,
    `pixel=${pixel} Å  voltage=${kV} kV  Cs=${cs} mm  Q0=${q0}`,
    empiar ? `source: EMPIAR-10017 ${EMPIAR_DIR}` : "source: (none configured)",
    `output: ${starPath}`,
    result,
    "",
  ].join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: write micrographs.star (RELION 5 optics format)",
    { micrographs_star: starPath },
    result,
    logText
  );
  return { ok: true, result };
}

/** ManualPick: import Henderson .coord files as a RELION pick STAR. */
async function runManualPickNative(job: EngineJobRef, upstream: UpstreamRef[]): Promise<NativeResult> {
  const resolved = resolveInputs("manualpick", upstream);
  if (resolved.missing) return { ok: false, error: resolved.missing };
  const micStar = resolved.inputs.micrographs_star;

  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const starPath = path.join(workdir, "manualpick.star");

  const mics = micrographNames(micStar);
  if (mics.length === 0) {
    return { ok: false, error: `No micrographs found in ${micStar} (run Import first)` };
  }
  const projectDir = projectDirFor(job);
  // Star paths are project-root-relative — resolve to absolute for FS access.
  const toAbs = (mic: string) => (mic.startsWith("/") ? mic : path.join(projectDir, mic));

  const lines: string[] = [
    "data_particles",
    "",
    "loop_",
    "_rlnCoordinateX #1",
    "_rlnCoordinateY #2",
    "_rlnMicrographName #3",
  ];
  let total = 0;
  const missing: string[] = [];
  // Also write plain .coord files (RELION extract consumes them via
  // --coord_dir/--coord_suffix) — readCoordinates() parses "x y" ASCII.
  const coordsDir = path.join(workdir, "micrographs");
  mkdirSync(coordsDir, { recursive: true });
  const coordText: string[] = [];
  for (const mic of mics) {
    const micAbs = toAbs(mic);
    const coord = micAbs.replace(/\.mrcs?$/i, "") + ".coord";
    if (!existsSync(coord)) {
      missing.push(path.basename(coord));
      continue;
    }
    const rows = readFileSync(coord, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    const outRows: string[] = [];
    for (const row of rows) {
      const parts = row.split(/\s+/);
      if (parts.length >= 2) {
        // keep the project-relative micrograph name (matches import star)
        lines.push(`${parts[0]} ${parts[1]} ${mic}`);
        outRows.push(`${parts[0]} ${parts[1]}`);
        total++;
      }
    }
    if (outRows.length > 0) {
      const base = path.basename(mic).replace(/\.mrcs?$/i, "");
      writeFileSync(path.join(coordsDir, base + ".coord"), outRows.join("\n") + "\n");
      coordText.push(`  ${base}.coord (${outRows.length} picks)`);
    }
  }
  if (total === 0) {
    return {
      ok: false,
      error: `No .coord pick files found beside the micrographs (expected Henderson picks in ${EMPIAR_DIR}) — missing: ${missing.join(", ")}`,
    };
  }

  writeFileSync(starPath, lines.join("\n") + "\n");
  const result = `${total} picks imported from Henderson .coord files`;
  const logText = [
    `CryoFlow engine-native manualpick ${new Date().toISOString()}`,
    `micrographs: ${mics.length} (from ${micStar})`,
    ...coordText,
    `output: ${starPath} (${total} coordinates)`,
    `coord files: ${coordsDir}/*.coord (consumed by relion_preprocess --coord_dir)`,
    result,
    "",
  ].join("\n");
  recordNativeRun(
    job,
    workdir,
    "engine-native: import Henderson .coord picks",
    { coords_star: starPath, coords_dir: workdir },
    result,
    logText
  );
  return { ok: true, result };
}

/** Select: class-aware or first-N subset of upstream particles.star (engine-native).
 *
 * When the input STAR carries `_rlnClassNumber` (e.g. the run_data.star of a
 * Class2D/Class3D job) and classCutoff > 0, classes whose occupancy is below
 * cutoff × (largest class occupancy) are pruned — the programmatic equivalent
 * of RELION's "select good 2D classes by occupancy" workflow.
 * Otherwise: first-N subset.
 */
async function runSelectNative(job: EngineJobRef, upstream: UpstreamRef[]): Promise<NativeResult> {
  const resolved = resolveInputs("select", upstream);
  if (resolved.missing) return { ok: false, error: resolved.missing };
  const inStar = resolved.inputs.particles_star;

  const workdir = workdirFor(job);
  mkdirSync(workdir, { recursive: true });
  const outStar = path.join(workdir, "particles_select.star");

  const text = readFileSync(inStar, "utf8");
  const blocks = parseStarBlocks(text);
  const outLines: string[] = [];
  let total = 0;
  let kept = 0;
  const maxN = Math.max(1, Math.round(num(job, "maxParticles", 1000)));
  const cutoff = Math.max(0, Math.min(1, num(job, "classCutoff", 0.5)));
  const classStats: { cls: string; count: number; kept: boolean }[] = [];
  let keptClasses = 0;

  for (const block of blocks) {
    outLines.push(block.header, "");
    const lines = block.lines;
    // find the loop header boundary
    let i = 0;
    const isParticles = lines.some((l) => l.trim().startsWith("_rlnImageName"));
    if (!isParticles) {
      for (const l of lines) outLines.push(l);
      outLines.push("");
      continue;
    }
    // header lines until the first data row
    while (
      i < lines.length &&
      (lines[i].trim() === "" ||
        lines[i].trim() === "loop_" ||
        lines[i].trim().startsWith("_rln") ||
        lines[i].trim().startsWith("#"))
    ) {
      if (lines[i].trim() !== "") outLines.push(lines[i]);
      i++;
    }

    // class-aware mode: find the _rlnClassNumber column index
    const classCol = labelColumn(lines, i, "_rlnClassNumber");

    let keepClasses: Set<number> | null = null;
    if (classCol >= 0 && cutoff > 0) {
      // first pass: occupancy per class
      const counts = new Map<number, number>();
      for (let r = i; r < lines.length; r++) {
        const t = lines[r].trim();
        if (!t) continue;
        const cells = t.split(/\s+/);
        const cls = parseInt(cells[classCol] ?? "", 10);
        if (Number.isFinite(cls)) counts.set(cls, (counts.get(cls) ?? 0) + 1);
      }
      const maxCount = Math.max(0, ...counts.values());
      keepClasses = new Set<number>();
      for (const [cls, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
        const ok = count >= cutoff * maxCount;
        classStats.push({ cls: String(cls), count, kept: ok });
        if (ok) {
          keepClasses.add(cls);
          keptClasses++;
        }
      }
    }

    for (let r = i; r < lines.length; r++) {
      const t = lines[r].trim();
      if (!t) continue;
      total++;
      let keep = kept < maxN;
      if (keep && keepClasses) {
        const cells = t.split(/\s+/);
        const cls = parseInt(cells[classCol] ?? "", 10);
        keep = Number.isFinite(cls) && keepClasses.has(cls);
      }
      if (keep) {
        outLines.push(t);
        kept++;
      }
    }
    outLines.push("");
  }

  writeFileSync(outStar, outLines.join("\n") + "\n");
  const result =
    classStats.length > 0
      ? `${kept} of ${total} particles selected · kept ${keptClasses}/${classStats.length} classes (occupancy ≥ ${cutoff}× best)`
      : `${kept} of ${total} particles selected`;
  const logText = [
    `CryoFlow engine-native select ${new Date().toISOString()}`,
    `input:  ${inStar} (${total} particles)`,
    ...(classStats.length > 0
      ? [
          "class occupancy (count · kept):",
          ...classStats
            .sort((a, b) => b.count - a.count)
            .map((c) => `  class ${c.cls}: ${c.count} · ${c.kept ? "kept" : "PRUNED"}`),
        ]
      : [`mode: first-N (no _rlnClassNumber column or classCutoff=0)`]),
    `output: ${outStar} (${kept} particles)`,
    result,
    "",
  ].join("\n");
  recordNativeRun(job, workdir, "engine-native: particle selection (class-aware)", { particles_star: outStar }, result, logText);
  return { ok: true, result };
}

/* ------------------------------------------------------------------ */
/* CLI argv builders (faithful to pipeline_jobs.cpp)                    */
/* ------------------------------------------------------------------ */

interface BuildCtx {
  binDir: string;
  workdir: string;
  inputs: Record<string, string>;
  job: EngineJobRef;
  upstream: UpstreamRef[];
}

function outPath(ctx: BuildCtx, name: string): string {
  return path.join(ctx.workdir, name);
}

async function externalOnPath(binDir: string, names: string[]): Promise<string | null> {
  for (const n of names) {
    if (existsSync(path.join(binDir, n))) return path.join(binDir, n);
    const found = await new Promise<string | null>((resolve) => {
      execFile("which", [n], { timeout: 2000 }, (err, stdout) => {
        const out = String(stdout ?? "").trim();
        resolve(!err && out.includes("/") ? out : null);
      });
    });
    if (found) return found;
  }
  return null;
}

/**
 * Build the real argv for a type. Returns argv (WITHOUT mpirun prefix —
 * that is decided by the caller) or an honest-failure message.
 */
async function buildArgv(ctx: BuildCtx): Promise<string[] | { error: string }> {
  const { job, inputs, binDir } = ctx;
  const type = job.type;

  switch (type) {
    case "ctffind": {
      const argv = [
        path.join(binDir, "relion_run_ctffind"),
        "--i", inputs.micrographs_star,
        "--o", ctx.workdir + "/",
        "--Box", String(num(job, "box", 512)),
        "--ResMin", String(num(job, "resMin", 30)),
        "--ResMax", String(num(job, "resMax", 5)),
        "--dFMin", String(num(job, "dFMin", 5000)),
        "--dFMax", String(num(job, "dFMax", 50000)),
        "--FStep", "500",
        "--dAst", "0",
        "--is_ctffind4",
        "--fast_search",
      ];
      if (existsSync(CTFFIND_EXE)) argv.push("--ctffind_exe", CTFFIND_EXE);
      return argv;
    }

    case "extract": {
      const box = Math.round(num(job, "boxSize", 128));
      const down = Math.round(num(job, "downsampleTo", 64));
      const doScale = down > 0 && down < box;
      // bg radius: 0.75 × effective box / 2 (RELION default when bgDiameter < 0)
      const bgDiam = num(job, "bgDiameter", -1);
      const effBox = doScale ? down : box;
      const bg = bgDiam > 0 ? Math.round((bgDiam * effBox) / box / 2) : Math.round(0.375 * effBox);
      // Coordinate source: manualpick writes <workdir>/micrographs/*.coord —
      // relion_preprocess composes fn_coord = coord_dir + fn_post + suffix,
      // where fn_post is the mic path minus extension ("micrographs/X") —
      // so coord_dir points at the manualpick JOB dir (contains micrographs/).
      const coordsInput = inputs.coords_dir;
      const isCoordDir =
        existsSync(coordsInput) && statSync(coordsInput).isDirectory();
      const coordDir = isCoordDir ? coordsInput + "/" : path.dirname(coordsInput) + "/";
      const coordSuffix = isCoordDir ? ".coord" : path.extname(coordsInput) || ".star";
      const argv = [
        path.join(binDir, "relion_preprocess"),
        "--i", inputs.micrographs_star,
        "--coord_dir", coordDir,
        "--coord_suffix", coordSuffix,
        "--part_star", outPath(ctx, "particles.star"),
        "--part_dir", ctx.workdir + "/",
        "--extract",
        "--extract_size", String(box),
      ];
      if (doScale) argv.push("--scale", String(down));
      argv.push(
        "--norm", "--bg_radius", String(bg),
        "--white_dust", "3",
        "--black_dust", "-3"
      );
      return argv;
    }

    case "class2d": {
      const argv = [
        path.join(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 10))),
        "--tau2_fudge", String(num(job, "tau2Fudge", 1)),
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--ctf",
        "--pad", "2",
        "--iter", String(Math.round(num(job, "iterations", 25))),
        // finer in-plane angular sampling → sharper class averages
        "--psi_step", String(num(job, "psiSampling", 6)),
        "--flatten_solvent",
        "--zero_mask",
      ];
      // optional cap on alignment resolution (0 = unlimited)
      const hl = num(job, "highresLimit", 0);
      if (hl > 0) argv.push("--highres_limit", String(hl));
      return argv;
    }

    case "initialmodel": {
      // VDAM gradient refinement — no MPI (RELION forbids --grad with MPI)
      return [
        path.join(binDir, "relion_refine"),
        "--grad", "--denovo_3dref",
        "--i", inputs.particles_star,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 4))),
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--sym", str(job, "symmetry", "D2"),
        "--ctf",
        "--iter", String(Math.round(num(job, "iterations", 50))),
        "--flatten_solvent",
        "--zero_mask",
        // memory: VDAM allocates K reference + gradient volumes at padded box
        // size; pad 1 (128³ instead of 256³ grids) cuts RSS from ~1.7GB to
        // under 1GB — de-novo models only need ~30 Å detail, where the
        // un-padded FFT grid is more than sufficient (RELION default pad is 2).
        "--pad", "1",
        // fewer particles pooled per task → smaller E-step working set
        "--pool", "3",
      ];
    }

    case "class3d": {
      return [
        path.join(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--ref", inputs.model_mrc,
        "--o", outPath(ctx, "run"),
        "--K", String(Math.round(num(job, "numClasses", 4))),
        "--tau2_fudge", "4",
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--sym", str(job, "symmetry", "C1"),
        "--ctf",
        "--pad", "2",
        "--iter", String(Math.round(num(job, "iterations", 25))),
        "--flatten_solvent",
      ];
    }

    case "refine3d": {
      const argv = [
        path.join(binDir, "relion_refine"),
        "--i", inputs.particles_star,
        "--ref", inputs.model_mrc,
        "--o", outPath(ctx, "run"),
        "--sym", str(job, "symmetry", "D2"),
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--ctf",
        "--pad", String(Math.round(num(job, "padding", 2))),
        "--firstiter_cc",
        "--ini_high", String(num(job, "iniHigh", 30)),
        // the reference may come from a different-box job (e.g. a low-res
        // InitialModel) — RELION resizes it to the particles' optics group
        "--trust_ref_size",
        "--split_random_halves",
      ];
      if (flagAutoRefine(job)) argv.push("--auto_refine");
      else argv.push("--iter", String(Math.round(num(job, "iterations", 15))), "--tau2_fudge", "1");
      return argv;
    }

    case "maskcreate": {
      return [
        path.join(binDir, "relion_mask_create"),
        "--i", inputs.map_mrc,
        "--o", outPath(ctx, "mask.mrc"),
        "--lowpass", String(num(job, "lowpass", 15)),
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
        "--ini_threshold", String(num(job, "threshold", 0.02)),
        "--extend_inimask", String(Math.round(num(job, "extend", 3))),
        "--width_soft_edge", String(Math.round(num(job, "softEdge", 6))),
        "--j", "4",
      ];
    }

    case "postprocess": {
      const argv = [
        path.join(binDir, "relion_postprocess"),
        "--i", inputs.half1_mrc,
        "--o", outPath(ctx, "postprocess"),
        "--mask", inputs.mask_mrc,
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
      ];
      if (flag(job, "autoBfac")) {
        argv.push("--auto_bfac", "--autob_lowres", String(num(job, "autobLowres", 10)));
      }
      const randomizeFrom = num(job, "randomizeFrom", 0);
      if (randomizeFrom > 0) argv.push("--randomize_at", String(randomizeFrom));
      return argv;
    }

    case "motioncorr": {
      const mc2 = await externalOnPath(binDir, ["motioncor2", "MotionCor2"]);
      if (!mc2) {
        return {
          error:
            "MotionCor2 executable not found — EMPIAR-10017 images are pre-averaged anyway (import them as micrographs and skip MotionCorr)",
        };
      }
      return [
        path.join(binDir, "relion_run_motioncorr"),
        "--i", inputs.micrographs_star,
        "--o", ctx.workdir + "/",
        "--use_motioncor2",
        "--motioncor2_exe", mc2,
        "--bin_factor", "1",
        "--bfactor", String(num(job, "bfactor", 150)),
        "--dose_per_frame", String(num(job, "dosePerFrame", 1.28)),
        "--patch_x", String(Math.round(num(job, "patchX", 5))),
        "--patch_y", String(Math.round(num(job, "patchY", 5))),
        "--j", "4",
      ];
    }

    case "autopick": {
      return [
        path.join(binDir, "relion_autopick"),
        "--i", inputs.micrographs_star,
        "--odir", ctx.workdir + "/",
        "--pickname", "autopick",
        "--particle_diameter", String(num(job, "particleDiameter", 180)),
        "--threshold", String(num(job, "threshold", 0.4)),
        "--lowpass", String(num(job, "lowpass", 20)),
        "--ref", inputs.refs_mrc,
      ];
    }

    case "localres": {
      const argv = [
        path.join(binDir, "relion_postprocess"),
        "--locres",
        "--i", inputs.half1_mrc,
        "--o", outPath(ctx, "relion"),
        "--angpix", String(Number(particlePixel(job, ctx.upstream).toFixed(3))),
        "--adhoc_bfac", String(num(job, "adhocBfac", -100)),
      ];
      if (inputs.mask_mrc) argv.push("--mask", inputs.mask_mrc);
      return argv;
    }

    case "polish": {
      return [
        path.join(binDir, "relion_motion_refine"),
        "--i", inputs.particles_star,
        "--f", inputs.postprocess_star,
        "--corr_mic", inputs.micrographs_star,
        "--first_frame", String(Math.round(num(job, "firstFrame", 1))),
        "--last_frame", String(Math.round(num(job, "lastFrame", 24))),
        "--o", ctx.workdir + "/",
        "--eval_frac", String(num(job, "evalFrac", 0.5)),
      ];
    }

    case "ctfrefine": {
      const argv = [
        path.join(binDir, "relion_ctf_refine"),
        "--i", inputs.particles_star,
        "--f", inputs.postprocess_star,
        "--o", ctx.workdir + "/",
      ];
      if (flag(job, "fitDefocus")) {
        argv.push("--fit_defocus", "--kmin_defocus", String(num(job, "minres", 20)));
      }
      if (flag(job, "fitAstig")) argv.push("--fit_astig");
      return argv;
    }

    case "dynamight": {
      const exe = await externalOnPath(binDir, ["relion_python_dynamight", "dynamight"]);
      if (!exe) {
        return { error: "DynaMight requires python + torch (relion_python_dynamight not found on PATH)" };
      }
      return [
        exe,
        "optimize-deformations",
        "--refinement-star-file", inputs.particles_star,
        "--output-directory", ctx.workdir + "/",
        "--initial-model", inputs.model_mrc,
        "--n-gaussians", String(Math.round(num(job, "nGaussians", 10000))),
        "--regularization-factor", String(num(job, "regFactor", 1)),
        "--n-threads", String(Math.round(num(job, "nThreads", 4))),
      ];
    }

    case "modelangelo": {
      const exe = await externalOnPath(binDir, ["model_angelo", "modelangelo"]);
      if (!exe) {
        return { error: "ModelAngelo requires a python environment with model_angelo installed (not found on PATH)" };
      }
      const argv = [exe, str(job, "buildMode", "build_no_seq"), "-v", inputs.map_mrc, "-o", ctx.workdir + "/", "-d", str(job, "gpuId", "0")];
      return argv;
    }

    case "joinstar": {
      // gather ALL upstream particle stars (need ≥2)
      const runs = readRuns();
      const stars: string[] = [];
      for (const up of ctx.upstream) {
        const state = runs[up.id];
        if (state?.done && state.exitCode === 0 && state.outputs.particles_star && existsSync(state.outputs.particles_star)) {
          stars.push(state.outputs.particles_star);
        }
      }
      if (stars.length < 2) {
        return { error: GENERIC_REQUIREMENTS[type] };
      }
      const dupLabel = str(job, "selectKind", "particles") === "micrographs" ? "rlnMicrographName" : str(job, "selectKind", "particles") === "movies" ? "rlnMicrographMovieName" : "rlnImageName";
      return [
        path.join(binDir, "relion_star_handler"),
        "--combine",
        "--i", stars.join(" "),
        "--check_duplicates", dupLabel,
        "--o", outPath(ctx, "join_particles.star"),
      ];
    }

    case "subtract": {
      const argv = [
        path.join(binDir, "relion_particle_subtract"),
        "--i", inputs.optimiser_star,
        "--mask", inputs.mask_mrc,
        "--o", ctx.workdir + "/",
      ];
      if (inputs.particles_star) argv.push("--data", inputs.particles_star);
      if (flag(job, "recenter")) argv.push("--recenter_on_mask");
      if (flag(job, "float16")) argv.push("--float16");
      const nb = Math.round(num(job, "newBox", -1));
      if (nb > 0) argv.push("--new_box", String(nb));
      return argv;
    }

    case "multibody":
      return { error: `Command template for multibody requires ${GENERIC_REQUIREMENTS.multibody}` };

    /* ---------------- TOMO ---------------- */
    case "tomo_import":
      return { error: `Command template for tomo_import requires ${GENERIC_REQUIREMENTS.tomo_import}` };

    case "tomo_aligntiltseries": {
      const method = str(job, "method", "AreTomo2");
      const argv = [
        path.join(binDir, "relion_align_tiltseries"),
        "--i", inputs.tilt_series_star,
        "--o", ctx.workdir + "/",
        "--tomogram_thickness", String(num(job, "thickness", 300)),
      ];
      if (method === "AreTomo2") argv.push("--aretomo2", "--aretomo_exe", "AreTomo2");
      else if (method === "IMOD fiducials")
        argv.push("--imod_fiducials", "--fiducial_diameter", String(num(job, "fiducialDiameter", 10)), "--batchtomo_exe", "batchruntomo");
      else argv.push("--imod_patchtrack", "--patch_size", "100", "--patch_overlap", "50", "--batchtomo_exe", "batchruntomo");
      return argv;
    }

    case "tomo_tomograms": {
      return [
        path.join(binDir, "relion_tomo_reconstruct_tomogram"),
        "--t", inputs.tilt_series_star,
        "--o", ctx.workdir + "/",
        "--w", String(Math.round(num(job, "xdim", 1024))),
        "--h", String(Math.round(num(job, "xdim", 1024))),
        "--d", String(Math.round(num(job, "zdim", 300))),
        "--binned_angpix", String(num(job, "binnedAngpix", 10)),
        "--j", "4",
      ];
    }

    case "tomo_ctfrefine": {
      const half2 = inputs.half1_mrc.replace("half1", "half2");
      return [
        path.join(binDir, "relion_tomo_refine_ctf"),
        "--i", inputs.particles_star,
        "--ref1", inputs.half1_mrc,
        "--ref2", existsSync(half2) ? half2 : inputs.half1_mrc,
        "--b", String(Math.round(num(job, "boxSize", 128))),
        "--focus_range", String(num(job, "focusRange", 3000)),
        "--o", ctx.workdir + "/",
      ];
    }

    case "tomo_exclude": {
      return [
        path.join(binDir, "relion_python_tomo_exclude_tilt_images"),
        "--tilt-series-star-file", inputs.tilt_series_star,
        "--cache-size", String(Math.round(num(job, "cacheSize", 5))),
        "--output-directory", ctx.workdir + "/",
      ];
    }

    case "tomo_polish": {
      const half2 = inputs.half1_mrc.replace("half1", "half2");
      const argv = [
        path.join(binDir, "relion_tomo_align"),
        "--i", inputs.particles_star,
        "--ref1", inputs.half1_mrc,
        "--ref2", existsSync(half2) ? half2 : inputs.half1_mrc,
        "--theme", "classic",
        "--o", ctx.workdir + "/",
        "--b", String(Math.round(num(job, "boxSize", 128))),
        "--r", String(num(job, "maxError", 5)),
      ];
      if (str(job, "motionMode", "motion") === "shift_only") argv.push("--shift_only");
      return argv;
    }

    case "tomo_reconstruct": {
      return [
        path.join(binDir, "relion_tomo_reconstruct_particle"),
        "--i", inputs.particles_star,
        "--theme", "classic",
        "--o", ctx.workdir + "/",
        "--b", String(Math.round(num(job, "boxSize", 128))),
        "--bin", String(num(job, "binning", 1)),
        "--j", "4",
        "--sym", "C1",
      ];
    }

    case "tomo_denoise": {
      const exe = await externalOnPath(binDir, ["relion_python_tomo_denoise"]);
      if (!exe) {
        return { error: "cryoCARE requires a python environment (relion_python_tomo_denoise not found on PATH)" };
      }
      const mode = str(job, "mode", "cryoCARE:train");
      return [
        exe,
        mode,
        "--tomogram-star-file", inputs.tomograms_star,
        "--output-directory", ctx.workdir + "/",
        "--gpu", "0",
      ];
    }

    case "tomo_picks": {
      const pick = await externalOnPath(binDir, ["relion_python_tomo_pick"]);
      if (!pick) {
        return { error: "Napari picking requires a python environment (relion_python_tomo_pick not found on PATH)" };
      }
      return [
        pick,
        str(job, "pickMode", "particles"),
        "--tilt-series-star-file", inputs.tilt_series_star,
        "--output-directory", ctx.workdir + "/",
      ];
    }

    case "tomo_extract": {
      return [
        path.join(binDir, "relion_tomo_subtomo"),
        "--i", inputs.particles_star,
        "--theme", "classic",
        "--o", ctx.workdir + "/",
        "--b", String(Math.round(num(job, "boxSize", 128))),
        "--bin", String(num(job, "binning", 1)),
        "--stack2d",
        "--float16",
        "--j", "4",
      ];
    }

    case "external": {
      const script = path.join(ctx.workdir, "run.sh");
      if (!existsSync(script)) {
        return { error: `Command template for external requires ${GENERIC_REQUIREMENTS.external}` };
      }
      return [str(job, "interpreter", "bash"), script];
    }

    default:
      return { error: `Command template for ${type} requires input data (no builder implemented)` };
  }
}

function flagAutoRefine(job: EngineJobRef): boolean {
  return String(job.params.autoRefine ?? "false") === "true";
}

/* ------------------------------------------------------------------ */
/* Completion checks & output harvesting                                */
/* ------------------------------------------------------------------ */

function firstExisting(dir: string, candidates: string[]): string | null {
  for (const c of candidates) {
    const p = path.join(dir, c);
    if (existsSync(p)) return p;
  }
  return null;
}

function globOne(dir: string, pattern: RegExp): string | null {
  try {
    const hit = readdirSync(dir).find((f) => pattern.test(f));
    return hit ? path.join(dir, hit) : null;
  } catch {
    return null;
  }
}

/** Iteration number encoded in a RELION per-iteration file name (it000 → 0). */
function iterOf(name: string): number {
  const m = /it(\d+)/.exec(name);
  return m ? parseInt(m[1], 10) : -1;
}

/** Like globOne but deterministic: prefers the HIGHEST iteration, then name order. */
function globLatest(dir: string, pattern: RegExp): string | null {
  try {
    const hits = readdirSync(dir)
      .filter((f) => pattern.test(f))
      .sort((a, b) => iterOf(b) - iterOf(a) || a.localeCompare(b));
    return hits.length > 0 ? path.join(dir, hits[0]) : null;
  } catch {
    return null;
  }
}

/** Resolve the 0-based data-row column of a label inside the loop header [0, headerEnd).
 * Handles both "_rlnX 3" (explicit index) and "_rlnX #3" (RELION 5 position
 * comment — 1-based running position of _rln labels inside the loop). */
function labelColumn(lines: string[], headerEnd: number, label: string): number {
  let pos = 0; // 1-based running position of labels in the current loop
  let inLoop = false;
  for (let h = 0; h < headerEnd; h++) {
    const t = lines[h].trim();
    if (t === "loop_") {
      inLoop = true;
      pos = 0;
      continue;
    }
    if (!inLoop || !t.startsWith("_")) continue;
    const name = t.split(/\s+/)[0];
    pos++;
    if (name === label) {
      const m = /#\s*(\d+)\s*$/.exec(t) ?? /^_\S+\s+(\d+)\s*$/.exec(t);
      return m ? parseInt(m[1], 10) - 1 : pos - 1;
    }
  }
  return -1;
}

/** Most populated _rlnClassNumber in a data star (or null). */
function bestClassFromData(starPath: string): number | null {
  const dist = classDistributionFromData(starPath);
  if (!dist) return null;
  let best: number | null = null;
  let bestCount = -1;
  for (const [cls, count] of dist.counts) {
    if (count > bestCount) {
      bestCount = count;
      best = cls;
    }
  }
  return best;
}

/**
 * Class occupancy from a RELION data.star (counts of _rlnClassNumber).
 * Used to summarize 2D classification quality in the job result line.
 */
function classDistributionFromData(
  starPath: string
): { counts: Map<number, number>; total: number } | null {
  try {
    const text = readFileSync(starPath, "utf8");
    const lines = text.split("\n");
    const classCol = labelColumn(lines, lines.length, "_rlnClassNumber");
    if (classCol < 0) return null;
    const counts = new Map<number, number>();
    let total = 0;
    for (const raw of lines) {
      const t = raw.trim();
      if (!t || t.startsWith("#") || t.startsWith("_") || t === "loop_" || t.startsWith("data_")) continue;
      const cells = t.split(/\s+/);
      if (cells.length <= classCol) continue;
      const cls = parseInt(cells[classCol], 10);
      if (Number.isFinite(cls)) {
        counts.set(cls, (counts.get(cls) ?? 0) + 1);
        total++;
      }
    }
    return total > 0 ? { counts, total } : null;
  } catch {
    return null;
  }
}

function countStarRows(starPath: string): number {
  try {
    const blocks = parseStarBlocks(readFileSync(starPath, "utf8"));
    let n = 0;
    for (const b of blocks) {
      // only count loop_ blocks with _rln labels; skip optics rows (first token opt*)
      if (!b.lines.some((l) => l.trim() === "loop_")) continue;
      for (const line of b.lines) {
        const t = line.trim();
        if (!t || t === "loop_" || t.startsWith("#") || t.startsWith("_rln") || t.startsWith("data_")) {
          continue;
        }
        const first = t.split(/\s+/)[0] ?? "";
        if (/^opt(ics|ic|group)/i.test(first)) continue;
        n++;
      }
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * After a CLI job exits 0: verify expected outputs exist, harvest output
 * paths and build the human result string.
 */
function collectOutputs(type: string, workdir: string): { outputs: Record<string, string>; result: string } {
  const outputs: Record<string, string> = {};
  let result = `REAL: ${type} exited 0`;

  switch (type) {
    case "ctffind": {
      const star = firstExisting(workdir, ["micrographs_ctf.star"]);
      if (star) {
        outputs.micrographs_ctf_star = star;
        result = `REAL: CTF estimated for ${countStarRows(star)} micrographs`;
      }
      break;
    }
    case "motioncorr": {
      const star = firstExisting(workdir, ["corrected_micrographs.star"]);
      if (star) {
        outputs.micrographs_star = star;
        result = `REAL: motion corrected, ${countStarRows(star)} micrographs`;
      }
      break;
    }
    case "autopick": {
      const star = firstExisting(workdir, ["autopick.star"]);
      if (star) {
        outputs.coords_star = star;
        result = "REAL: autopick coordinates written";
      }
      break;
    }
    case "extract": {
      const star = firstExisting(workdir, ["particles.star"]);
      if (star) {
        outputs.particles_star = star;
        result = `REAL: ${countStarRows(star)} particles extracted`;
      }
      break;
    }
    case "class2d": {
      // RELION 5 writes class stacks with the .mrcs extension
      const classes =
        firstExisting(workdir, ["run_unmasked_classes.mrcs", "run_classes.mrcs", "run_classes.mrc"]) ??
        globLatest(workdir, /^run_it\d+_classes\.mrcs?$/);
      if (classes) {
        outputs.classes_mrc = classes;
        // the per-iteration data star carries assignments/offsets — chainable
        const data = globLatest(workdir, /^run_it\d+_data\.star$/) ?? firstExisting(workdir, ["run_data.star"]);
        if (data) outputs.particles_star = data;
        result = "REAL: 2D classification finished — class averages written";
        // class occupancy summary — the quality signal for 2D results
        const dist = data ? classDistributionFromData(data) : null;
        if (dist) {
          const ranked = [...dist.counts.entries()].sort((a, b) => b[1] - a[1]);
          const top = ranked
            .slice(0, 3)
            .map(([cls, n]) => `class ${cls} ${Math.round((100 * n) / dist.total)}%`)
            .join(", ");
          result = `REAL: 2D classification finished — ${dist.counts.size} classes · ${dist.total.toLocaleString()} particles · top: ${top}`;
        }
      }
      break;
    }
    case "initialmodel": {
      // VDAM writes per-iteration class volumes; the reference for downstream
      // jobs is the most populated class of the FINAL iteration
      const finalIter = globLatest(workdir, /^run_it\d+_class\d+\.mrc$/);
      let model =
        finalIter ??
        globLatest(workdir, /class\d+\.mrcs?$/i) ??
        firstExisting(workdir, ["run_model.mrc", "run_model.mrcs", "run_classes.mrcs"]);
      if (finalIter) {
        const m = /^run_it(\d+)_class(\d+)\.mrc$/.exec(path.basename(finalIter));
        if (m) {
          const iterStr = String(parseInt(m[1], 10)).padStart(3, "0");
          const best = bestClassFromData(path.join(workdir, `run_it${iterStr}_data.star`));
          if (best != null) {
            const candidate = path.join(workdir, `run_it${iterStr}_class${String(best).padStart(3, "0")}.mrc`);
            if (existsSync(candidate)) model = candidate;
          }
        }
      }
      if (model) {
        outputs.model_mrc = model;
        // VDAM writes run_it<XXX>_data.star — NOT chained as particles output:
        // a de-novo 3D initial model is a low-res SEED; downstream refinements
        // should consume the curated particles.star instead.
        const data = globLatest(workdir, /^run_it\d+_data\.star$/);
        if (data) outputs.refine_data_star = data;
        result = "REAL: de-novo 3D initial model generated";
      }
      break;
    }
    case "class3d":
    case "refine3d": {
      // RELION 5 writes per-iteration half maps: run_it<N>_half1/2_class<K>.mrc
      // (RELION <=4 named the final maps run_half1_class001_unfil.mrc)
      const half1 =
        globLatest(workdir, /^run_it\d+_half1_class\d+\.mrc$/) ??
        firstExisting(workdir, ["run_half1_class001_unfil.mrc"]);
      const half2 =
        globLatest(workdir, /^run_it\d+_half2_class\d+\.mrc$/) ??
        firstExisting(workdir, ["run_half2_class001_unfil.mrc"]);
      const model = half1 ?? firstExisting(workdir, ["run_class001.mrc"]) ?? globLatest(workdir, /^run_it\d+_class\d+\.mrc$/);
      if (model) {
        outputs.model_mrc = model;
        if (half1 && half2) {
          outputs.half1_mrc = half1;
          outputs.half2_mrc = half2;
        }
        const opt = firstExisting(workdir, ["run_optimiser.star"]);
        if (opt) outputs.optimiser_star = opt;
        const data = firstExisting(workdir, ["run_data.star"]);
        if (data) outputs.refine_data_star = data;
        result = parseRefineResult(workdir) ?? `REAL: ${type === "class3d" ? "3D classification" : "3D refinement"} finished`;
      }
      break;
    }
    case "maskcreate": {
      const mask = firstExisting(workdir, ["mask.mrc"]);
      if (mask) {
        outputs.mask_mrc = mask;
        result = "REAL: soft-edged mask created";
      }
      break;
    }
    case "postprocess": {
      const map = firstExisting(workdir, ["postprocess.mrc"]);
      const star = firstExisting(workdir, ["postprocess.star"]);
      if (map) {
        outputs.map_mrc = map;
        if (star) outputs.postprocess_star = star;
        const res = parseFinalResolution(path.join(workdir, "run.out"));
        result = res ? `REAL: sharpened map · FSC(0.143) = ${res} Å` : "REAL: postprocessed map written";
      }
      break;
    }
    case "localres": {
      const locres = firstExisting(workdir, ["relion_locres.mrc"]);
      if (locres) {
        outputs.map_mrc = locres;
        result = "REAL: local resolution map written";
      }
      break;
    }
    case "joinstar": {
      const star = firstExisting(workdir, ["join_particles.star", "join_mics.star", "join_movies.star"]);
      if (star) {
        outputs.particles_star = star;
        result = `REAL: joined STAR (${countStarRows(star)} rows)`;
      }
      break;
    }
    case "subtract": {
      const star = firstExisting(workdir, ["particles_subtracted.star"]);
      if (star) {
        outputs.particles_star = star;
        result = `REAL: ${countStarRows(star)} particles subtracted`;
      }
      break;
    }
    case "polish": {
      const star = firstExisting(workdir, ["shiny.star", "particles_polished.star"]);
      if (star) {
        outputs.particles_star = star;
        result = "REAL: Bayesian polishing finished";
      }
      break;
    }
    case "ctfrefine": {
      const star = firstExisting(workdir, ["particles_ctf_refine.star"]);
      if (star) {
        outputs.particles_star = star;
        result = "REAL: CTF refinement finished";
      }
      break;
    }
    case "tomo_aligntiltseries": {
      const star = firstExisting(workdir, ["aligned_tilt_series.star"]);
      if (star) {
        outputs.aligned_tilt_series_star = star;
        outputs.tilt_series_star = star;
        result = "REAL: tilt series aligned";
      }
      break;
    }
    case "tomo_tomograms":
    case "tomo_denoise": {
      const star = firstExisting(workdir, ["tomograms.star"]);
      if (star) {
        outputs.tomograms_star = star;
        result = `REAL: ${type === "tomo_tomograms" ? "tomograms reconstructed" : "tomograms denoised"}`;
      }
      break;
    }
    case "tomo_reconstruct": {
      const map = firstExisting(workdir, ["merged.mrc"]);
      if (map) {
        outputs.model_mrc = map;
        result = "REAL: subtomogram reconstruction written";
      }
      break;
    }
    case "tomo_picks":
    case "tomo_extract":
    case "tomo_ctfrefine": {
      const star = firstExisting(workdir, ["particles.star"]);
      if (star) {
        outputs.particles_star = star;
        result = `REAL: ${type} particles written`;
      }
      break;
    }
    case "tomo_exclude": {
      const star = firstExisting(workdir, ["selected_tilt_series.star"]);
      if (star) {
        outputs.tilt_series_star = star;
        result = "REAL: tilt images excluded";
      }
      break;
    }
    default:
      break;
  }
  return { outputs, result };
}

/** "FINAL RESOLUTION" style lines from relion logs. */
function parseFinalResolution(logFile: string): string | null {
  try {
    const tail = readTail(logFile, 8192);
    const m = tail.match(/final\s+resolution[^0-9\-]*([0-9]+\.?[0-9]*)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function parseRefineResult(workdir: string): string | null {
  const res = parseFinalResolution(path.join(workdir, "run.out"));
  return res ? `REAL: refined — FSC(0.143) = ${res} Å` : null;
}

/* ------------------------------------------------------------------ */
/* Log helpers                                                          */
/* ------------------------------------------------------------------ */

function readTail(file: string, bytes: number): string {
  const stat = statSync(file);
  const fd = openSync(file, "r");
  try {
    const len = Math.min(bytes, stat.size);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, Math.max(0, stat.size - len));
    return buf.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

export interface LogPayload {
  /** Collapsed (\r-safe) text of the requested window. */
  text: string;
  /** Total collapsed line count of the FULL combined log. */
  totalLines: number;
  /** True when `text` covers fewer lines than totalLines (tail window). */
  truncated: boolean;
}

/** Combined run.out + run.err for log views.
 * RELION rewrites progress bars with \r — collapse each line to its final
 * frame (what a terminal would show) so \r spam doesn't eat the line budget.
 *
 * The whole (small, ≤8MB) file is always read so `totalLines`/`truncated`
 * stay honest — the "tail" window only shrinks the RESPONSE payload, never
 * the line accounting (RELION run.out files are hundreds of KB at most and
 * page-cached, so the 1.5s live poll stays cheap).
 *
 * Tail mode (default): last 600 lines — cheap for live polling.
 * Full mode: the entire log. */
export function getLogTail(jobId: string, opts?: { full?: boolean }): LogPayload | null {
  const state = readRuns()[jobId];
  if (!state) return null;
  const full = opts?.full === true;
  const parts: string[] = [];
  let overCap = false;
  try {
    if (existsSync(state.logFile)) {
      const st = statSync(state.logFile);
      parts.push(readTail(state.logFile, 8 * 1024 * 1024));
      if (st.size > 8 * 1024 * 1024) overCap = true;
    }
  } catch {
    /* ignore */
  }
  try {
    if (existsSync(state.errFile)) {
      const err = readTail(state.errFile, 1 * 1024 * 1024);
      if (err.trim().length > 0) parts.push("\n----- stderr -----\n" + err);
    }
  } catch {
    /* ignore */
  }
  const text = parts.join("\n");
  const collapse = (s: string) =>
    s
      .split("\n")
      .map((line) => {
        const idx = line.lastIndexOf("\r");
        return (idx >= 0 ? line.slice(idx + 1) : line).replace(/\s+$/, "");
      });
  const allLines = collapse(text);
  const totalLines = allLines.length;
  if (full) {
    return {
      text: allLines.join("\n").slice(-8 * 1024 * 1024),
      totalLines,
      truncated: overCap,
    };
  }
  const tailLines = allLines.slice(-600);
  return {
    text: tailLines.join("\n"),
    totalLines,
    truncated: totalLines > tailLines.length,
  };
}

/* ------------------------------------------------------------------ */
/* Progress parsing                                                     */
/* ------------------------------------------------------------------ */

export function parseProgress(
  type: string,
  logFile: string,
  params: Record<string, number | string | boolean>
): number | null {
  try {
    if (!existsSync(logFile)) return null;
    const tail = readTail(logFile, 4096);
    const totalIter = Number(params.iterations ?? 25);
    if (Number.isFinite(totalIter) && totalIter > 0) {
      const itMatches = [...tail.matchAll(/(?:^|\s)it\s*\[?\s*(\d+)/gi)].map((m) => parseInt(m[1], 10));
      const iterMatches = [...tail.matchAll(/iteration\s*:?\s*(\d+)/gi)].map((m) => parseInt(m[1], 10));
      const all = [...itMatches, ...iterMatches];
      if (all.length > 0) {
        const current = Math.max(...all);
        return Math.min(99, Math.round((current / totalIter) * 100));
      }
    }
    // per-micrograph jobs: fraction of 6 EMPIAR micrographs seen in the log
    if (type === "ctffind" || type === "extract" || type === "motioncorr") {
      const micLines = tail.split("\n").filter((l) => /micrograph/i.test(l)).length;
      if (micLines > 0) return Math.min(99, Math.round((micLines / 6) * 100));
    }
    return null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                     */
/* ------------------------------------------------------------------ */

const NATIVE_TYPES = new Set(["import", "manualpick", "select"]);

/**
 * Run a job with the REAL engine.
 * - import / manualpick / select: engine-native (no RELION needed)
 * - everything else: detect RELION (fresh, no cache), resolve inputs,
 *   spawn the CLI with the faithful argv.
 */
/* ------------------------------------------------------------------ */
/* Shared spawn + state tracking (fresh runs AND --continue resumes)   */
/* ------------------------------------------------------------------ */

/**
 * Record the run, spawn argv, pipe run.out/run.err (append) and attach the
 * exit handler that finalizes state + DB. Shared by the fresh-run path and
 * the resume path so both get identical bookkeeping.
 */
function spawnTrackedRun(
  job: EngineJobRef,
  argv: string[],
  workdir: string,
  binDir: string,
  resumedFrom?: number
): RunOutcome {
  const logFile = path.join(workdir, "run.out");
  const errFile = path.join(workdir, "run.err");
  const cmd = argv.join(" ");
  const record: RunRecord = {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    pid: null,
    cmd,
    workdir,
    logFile,
    errFile,
    startedAt: new Date().toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
  };
  const runs = readRuns();
  runs[job.id] = record;
  writeRuns(runs);

  // CWD = RELION "project root": STAR paths are relative to it and ctffind_runner
  // symlinks micrographs as (cwd + star-path). The per-job workdir still holds
  // run.out / run.err and the output artifacts (via absolute --o/--part_dir).
  const projectDir = projectDirFor(job);
  mkdirSync(projectDir, { recursive: true });
  const child = spawn(argv[0], argv.slice(1), {
    cwd: projectDir,
    env: relionEnv(binDir),
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  live.set(job.id, child);

  if (child.stdout) {
    const out = createWriteStream(logFile, { flags: "a" });
    child.stdout.pipe(out);
  }
  if (child.stderr) {
    const err = createWriteStream(errFile, { flags: "a" });
    child.stderr.pipe(err);
  }

  record.pid = child.pid ?? null;
  const runsNow = readRuns();
  runsNow[job.id] = { ...record };
  writeRuns(runsNow);

  attachExitHandler(job, child, record.startedAt);

  return {
    ok: true,
    pid: child.pid ?? undefined,
    ...(resumedFrom != null ? { resumedFrom } : {}),
  };
}

/**
 * Newest run_itXXX_optimiser.star checkpoint in a workdir (RELION's
 * --continue entry point), or null when none exists.
 */
function resumableOptimiser(workdir: string): { file: string; iteration: number } | null {
  try {
    const matches = readdirSync(workdir)
      .map((n) => {
        const m = n.match(/^run_it(\d+)_optimiser\.star$/i);
        return m ? { file: path.join(workdir, n), iteration: Number(m[1]) } : null;
      })
      .filter((x): x is { file: string; iteration: number } => x != null);
    matches.sort((a, b) => b.iteration - a.iteration);
    return matches[0] ?? null;
  } catch {
    return null;
  }
}

/** Refine-family job types that support RELION's --continue. */
const RESUMABLE_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel", "multibody"]);

export async function runRealJob(job: EngineJobRef, upstream: UpstreamRef[]): Promise<RunOutcome> {
  // ---- engine-native jobs -------------------------------------------
  if (job.type === "import") {
    const r = await runImportNative(job);
    return r.ok ? { ok: true, native: true, result: r.result } : { ok: false, error: r.error };
  }
  if (job.type === "manualpick") {
    const r = await runManualPickNative(job, upstream);
    return r.ok ? { ok: true, native: true, result: r.result } : { ok: false, error: r.error };
  }
  if (job.type === "select") {
    const r = await runSelectNative(job, upstream);
    return r.ok ? { ok: true, native: true, result: r.result } : { ok: false, error: r.error };
  }

  // ---- RELION required ------------------------------------------------
  const status = await detectRelion(true);
  if (!status.found || !status.path) {
    return { ok: false, error: "RELION 5 not detected — build/install RELION or set RELION_HOME" };
  }
  if (status.execution !== "native") {
    // RELION found, but only inside WSL on a host that cannot spawn distro
    // paths directly — fail honestly instead of ENOENT-ing on a Linux path.
    return {
      ok: false,
      error: `RELION ${status.version ?? ""} detected inside WSL (${status.wsl.distro ?? "default"}) at ${status.path}, but this app cannot spawn distro-internal binaries directly. Run CryoFlow inside the WSL distro (or install RELION on this host) to execute jobs.`,
    };
  }
  const binDir = status.path;

  // ---- resume an interrupted refine-family run ---------------------------
  // If a previous run of THIS job crashed/was interrupted (record exists,
  // never finished) and the workdir holds RELION iteration checkpoints,
  // --continue picks up from the newest one instead of starting over —
  // hours saved on long auto-refinements. Upstream re-validation is skipped:
  // the checkpoint STAR files already reference the validated inputs.
  const workdir = workdirFor(job);
  const prevRun = readRuns()[job.id];
  if (
    RESUMABLE_TYPES.has(job.type) &&
    prevRun &&
    prevRun.done === false &&
    prevRun.jobId === job.id
  ) {
    const checkpoint = resumableOptimiser(workdir);
    const mpiBin = path.join(binDir, "relion_refine_mpi");
    if (checkpoint && existsSync(mpiBin) && existsSync(path.join(MPICH_BIN, "mpirun"))) {
      // gold-standard halves need leader + 2 half-mappers
      const nranks = job.type === "refine3d" ? 3 : 2;
      // --o MUST point at the SAME output root the checkpoint was written
      // to (RELION in continue mode still checks the output dir from --o;
      // omitting it defaults to ./run relative to cwd → "output directory
      // does not exist" abort on the follower ranks).
      const resumeArgv = [
        "mpirun",
        "-n",
        String(nranks),
        mpiBin,
        "--continue",
        checkpoint.file,
        "--o",
        path.join(workdir, "run"),
      ];
      return spawnTrackedRun(job, resumeArgv, workdir, binDir, checkpoint.iteration);
    }
  }

  // ---- resolve inputs --------------------------------------------------
  const resolved = resolveInputs(job.type, upstream);
  if (resolved.missing) {
    return { ok: false, error: resolved.missing };
  }
  const inputs = resolved.inputs;

  // ---- workdir ----------------------------------------------------------
  mkdirSync(workdir, { recursive: true });

  // ---- build argv ---------------------------------------------------------
  const ctx: BuildCtx = { binDir, workdir, inputs, job, upstream };
  const built = await buildArgv(ctx);
  if ("error" in built) {
    return { ok: false, error: built.error };
  }
  let argv = built;

  // ---- MPI prefix for parallel types --------------------------------------
  if (MPI_PARALLEL_TYPES.has(job.type) && existsSync(path.join(MPICH_BIN, "mpirun"))) {
    // RELION ships serial AND _mpi builds — mpirun must launch the MPI build
    // (a serial binary under mpirun runs N independent copies: no parallelism,
    // and --split_random_halves hard-errors without MPI).
    const target = argv[0] as string;
    if (target.startsWith("/") && existsSync(target + "_mpi")) argv[0] = target + "_mpi";
    // --split_random_halves (gold-standard FSC) needs leader + 2 half-mappers
    const nranks = job.type === "refine3d" ? 3 : 2;
    argv = ["mpirun", "-n", String(nranks), ...argv];
  }

  // ---- target binary sanity (partial installs fail honestly) --------------
  const target = argv[0] === "mpirun" ? argv[4] : argv[0];
  if (target && target.startsWith("/") && !existsSync(target)) {
    return {
      ok: false,
      error: `RELION binary ${path.basename(target)} not present in ${binDir} (incomplete RELION install)`,
    };
  }

  return spawnTrackedRun(job, argv, workdir, binDir);
}

/* ------------------------------------------------------------------ */
/* Exit handling (state file + Prisma update)                           */
/* ------------------------------------------------------------------ */

function attachExitHandler(
  job: EngineJobRef,
  child: ChildProcess,
  startedAt: string
): void {
  child.on("exit", (code) => {
    live.delete(job.id);
    const runs = readRuns();
    const state = runs[job.id];
    // A newer run may have replaced this record — only handle our own.
    if (!state || state.startedAt !== startedAt) return;

    const exitCode = code ?? -1;
    let outputs: Record<string, string> = {};
    let result: string | null = null;

    if (exitCode === 0) {
      const collected = collectOutputs(job.type, state.workdir);
      outputs = collected.outputs;
      result = collected.result;
    } else {
      result = `exit ${exitCode} — ${tailText(state.errFile, 300)}`;
    }

    runs[job.id] = { ...state, done: true, exitCode, outputs, result };
    writeRuns(runs);

    const elapsed = Date.now() - new Date(state.startedAt).getTime();
    void db.job
      .update({
        where: { id: job.id },
        data:
          exitCode === 0
            ? { status: "completed", progress: 100, result, duration: Math.max(1000, elapsed) }
            : { status: "failed", progress: 0, result },
      })
      .catch((err) => console.error("engine: DB update on exit failed:", err));
  });

  child.on("error", (err) => {
    live.delete(job.id);
    const runs = readRuns();
    const state = runs[job.id];
    if (!state || state.startedAt !== startedAt) return;
    runs[job.id] = {
      ...state,
      done: true,
      exitCode: -1,
      result: `spawn failed — ${err.message}`,
    };
    writeRuns(runs);
    void db.job
      .update({
        where: { id: job.id },
        data: { status: "failed", progress: 0, result: `spawn failed — ${err.message}` },
      })
      .catch((e) => console.error("engine: DB update on spawn error failed:", e));
  });
}

function tailText(file: string, maxChars: number): string {
  try {
    if (!existsSync(file)) return "";
    const text = readTail(file, maxChars * 2);
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.slice(-maxChars);
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Reconciliation (GET /api/jobs)                                       */
/* ------------------------------------------------------------------ */

export function parseJobParams(raw: string): Record<string, number | string | boolean> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number | string | boolean>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

/**
 * Reconcile 'running' jobs that belong to the REAL engine:
 *  - pid alive → derive progress from the log tail
 *  - pid dead + not done → interrupted (server restart etc.) → failed
 *  - done + exit 0 (DB stale) → completed with the recorded result
 * Read-mostly; DB writes only in the interrupted/stale cases (idempotent).
 * Sim jobs (no run record) are left untouched for reconcileRunning().
 */
export async function reconcileRealJobs(jobs: Job[]): Promise<Job[]> {
  const runs = readRuns();
  const out: Job[] = [];

  for (const job of jobs) {
    if (job.status !== "running") {
      out.push(job);
      continue;
    }
    const state = runs[job.id];
    if (!state) {
      out.push(job); // sim job — handled by the sim reconciler
      continue;
    }
    const alive = state.pid != null && existsSync(`/proc/${state.pid}`);

    if (alive) {
      const progress = parseProgress(job.type, state.logFile, parseJobParams(job.params));
      out.push(progress != null ? { ...job, progress } : job);
      continue;
    }

    if (!state.done) {
      const updated = await db.job
        .update({
          where: { id: job.id },
          data: { status: "failed", progress: 0, result: "interrupted (exit unknown) — re-run" },
        })
        .catch(() => null);
      out.push(updated ?? { ...job, status: "failed", progress: 0, result: "interrupted (exit unknown) — re-run" });
      continue;
    }

    if (state.exitCode === 0) {
      // job.status is 'running' here (narrowed above); the DB update is
      // idempotent — the exit handler may already have written this.
      const updated = await db.job
        .update({
          where: { id: job.id },
          data: { status: "completed", progress: 100, result: state.result ?? "completed" },
        })
        .catch(() => null);
      out.push(updated ?? { ...job, status: "completed", progress: 100, result: state.result ?? "completed" });
      continue;
    }

    if (state.exitCode !== null) {
      const updated = await db.job
        .update({
          where: { id: job.id },
          data: { status: "failed", progress: 0, result: state.result ?? `exit ${state.exitCode}` },
        })
        .catch(() => null);
      out.push(updated ?? { ...job, status: "failed", progress: 0, result: state.result ?? `exit ${state.exitCode}` });
      continue;
    }

    out.push(job);
  }
  return out;
}

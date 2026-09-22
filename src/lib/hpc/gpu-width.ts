/**
 * CryoFlow — the Slurm WIDTH truth (CLIENT-SAFE pure module, t326).
 *
 * The run dialog's redesign promised "every flag the preview shows is one
 * the dispatch writes" — and the live check caught the old hint (and the
 * first preview draft) overstating: the sbatch honors the GPU-stepper
 * width ONLY for the MPI-multi-GPU types (relion_refine splits
 * particles across worker ranks — class2d/class3d/refine3d/
 * initialmodel/multibody; t349 adds the dedicated CPU master, so the
 * rank count is width + 1 while --gres stays the raw width). Everything else the dispatch sizes by its OWN strategy:
 * motioncorr and References-picking run ONE GPU per task, ctffind/extract
 * and the LoG picker run CPU tasks, Topaz/DynaMight-style trainers are
 * single-GPU, postprocessing is CPU. A stepper promising "6 × GPU —
 * --gres=gpu:6, mpirun -n 6" on a job whose script will carry
 * `--gres=gpu:1 --ntasks=1` is not a knob, it is a trap (t320's own
 * doctrine, applied to the width).
 *
 * So the width truth lives HERE — one pure table both sides import: the
 * run dialog renders it (stepper where the width is real, honest state
 * boxes where it is not), and hpc/slurm.ts's gpuStrategyFor derives its
 * mode from it (the strategy keeps its own planning floor for the
 * simulator; the DISPATCH honors the raw width, so THIS module returns
 * the raw width — the script's truth, not the plan's).
 *
 * Mirrors remote-run.ts's GPU adaptation block (gresWidth/ntasks/mpirun)
 * and hpc/slurm.ts's strategy table. Zero imports — client/server/test
 * share the same implementation (the t320 log-autopick doctrine).
 */

/**
 * relion_refine_mpi types: ONE job, N MPI ranks pinned to N GPUs.
 *
 * t349 — initialmodel LEFT this set: the engine's template is VDAM
 * (`relion_refine --grad --denovo_3dref` — engine.ts's own comment: RELION
 * forbids --grad with MPI), so a width ≥2 submission used to hand mpirun a
 * binary that refuses to run under it. It runs SINGLE now (one GPU, no
 * mpirun) — the honest width for the argv we actually write.
 */
export const MULTI_GPU_TYPES = new Set([
  "class2d",
  "class3d",
  "refine3d",
  "multibody",
]);

/**
 * Deep-learning wrappers that train/infer on exactly one GPU.
 *
 * t349 — tomo_denoise joined: its engine argv carries `--gpu 0` (cryoCARE
 * trains on CUDA) but the width table used to file it as a 0-GPU array
 * type — a job that ASKS for a card the submission never requests. Under
 * this set it gets --gres=gpu:1 + the t341 grant pin + the t342 refusal.
 * initialmodel joined for the VDAM reason above.
 */
export const SINGLE_GPU_TYPES = new Set([
  "topaztrain",
  "dynamight",
  "modelangelo",
  "tomo_ctfrefine",
  "tomo_polish",
  "tomo_denoise",
  "initialmodel",
]);

/**
 * Array-flavor types whose shards each get one GPU (the strategy's table).
 *
 * t349 — tomo_aligntiltseries joined: the command template carries `--gpu`
 * (AreTomo2 does its alignment on CUDA), but the argv used to omit it and
 * the width said 0 — the engine now passes `--gpu 0` and the shard asks for
 * a card like motioncorr's shards do.
 */
const ARRAY_ONE_GPU_TYPES = new Set(["motioncorr", "autopick", "tomo_aligntiltseries"]);

export type SlurmWidthMode = "multi-gpu" | "single" | "array" | "cpu";

export interface SlurmWidth {
  mode: SlurmWidthMode;
  /** The GPU width the sbatch will actually carry for this type. */
  gpus: number;
}

/**
 * The width the dispatch writes for a Slurm submission of this job type.
 *
 * - "multi-gpu": the submission width is the USER's pick (t349: one
 *   WORKER rank per GPU plus a dedicated CPU master — `mpirun -n N+1`,
 *   `--ntasks=N+1`, `--gres=gpu:N`; width 1 runs a single task, no MPI
 *   split). NOTE: this is the RAW width — the strategy's simulator
 *   floor (never plan < 2) is a planning choice, not a dispatch
 *   constraint.
 * - "single": exactly 1 GPU (`--gres=gpu:1 --ntasks=1`, `--gpu 0`, no
 *   mpirun) — the width knob is not real.
 * - "array": embarrassingly parallel per micrograph; gpus says the shard's
 *   GPU width (1 for motioncorr/References-picking, 0 for ctffind/extract
 *   and the LoG picker) and the ARRAY SPLIT is the real parallelism knob.
 * - "cpu": no GPU at all.
 *
 * `logAutopick` is the t320 LoG predicate's word (the caller that KNOWS
 * the pick method passes it — the table cannot see job params).
 */
export function slurmWidthFor(
  type: string,
  opts: { gpus?: number; logAutopick?: boolean } = {}
): SlurmWidth {
  const gpus = Math.max(1, opts.gpus ?? 2);
  if (MULTI_GPU_TYPES.has(type)) return { mode: "multi-gpu", gpus };
  if (SINGLE_GPU_TYPES.has(type)) return { mode: "single", gpus: 1 };
  const isAutoPick = type === "autopick";
  if (
    type === "motioncorr" ||
    type === "ctffind" ||
    type === "extract" ||
    isAutoPick ||
    type.startsWith("tomo_aligntiltseries") ||
    type === "tomo_tomograms" ||
    type === "tomo_reconstruct" ||
    type === "tomo_extract" ||
    type === "tomo_denoise"
  ) {
    // t320 — the LoG picker is CPU-only, FULL STOP (RELION's autopicker.cpp
    // hard-errors on do_gpu && do_LoG); the caller that knows the pick
    // method passes logAutopick and gets the honest width: zero.
    if (isAutoPick && opts.logAutopick) return { mode: "array", gpus: 0 };
    return { mode: "array", gpus: ARRAY_ONE_GPU_TYPES.has(type) ? 1 : 0 };
  }
  return { mode: "cpu", gpus: 0 };
}

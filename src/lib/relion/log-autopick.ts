/**
 * t320 — the Laplacian-of-Gaussian picker's CPU-only contract, as ONE pure
 * predicate shared by every layer that decides GPUs for an Auto-picking job.
 *
 * The receipt (the user's real cluster, stderr + backtrace into
 * /data2/home/relion5/relion2/relion-master/build/bin/relion_autopick):
 *
 *     in: src/autopicker.cpp, line 146
 *     ERROR:
 *     The Laplacian-of-Gaussian picker does not support GPU acceleration.
 *     Please remove --gpu option.
 *
 * Verified against RELION master (src/autopicker.cpp, read()):
 *
 *     do_gpu = parser.checkOption("--gpu", ...);
 *     ...
 *     do_LoG = parser.checkOption("--LoG", ...);
 *     ...
 *     if (do_gpu && do_LoG)
 *         REPORT_ERROR("The Laplacian-of-Gaussian picker does not support
 *                       GPU acceleration. Please remove --gpu option.");
 *
 * So the refusal is a property of the FLAG PAIR, not of the job type — yet
 * every GPU decision in this app is type-driven (gpuStrategyFor, the run
 * dialog's stepper). This module closes that gap: the pick METHOD rides the
 * job's params, and LoG (the default) means no --gpu, no --gres, no GPU
 * stepper — References (template matching) and Topaz (the CNN wrapper) keep
 * their GPUs, exactly as RELION's own GUI allows.
 *
 * Pure by design: no fs/db/node imports, accepts the params in BOTH shapes
 * the app carries them (the client's parsed Record, the prisma Job's JSON
 * string) — the run dialog, the remote dispatch, the sbatch export and the
 * e2e unit phase all import this one truth.
 */

/** The workflow's canonical pick-method value for Laplacian-of-Gaussian
 *  (workflow.ts sel() option #1, job-presets.ts, engine.ts's own default). */
export const LOG_PICK_METHOD = "Laplacian of Gaussian";

/**
 * True when this job is an Auto-picking run whose picking method lands in
 * the CPU-only Laplacian-of-Gaussian branch.
 *
 * t321 — the classification MIRRORS the argv builder byte-for-byte: engine
 * buildArgv reads the method with `str()` (undefined/null → the LoG default,
 * else `String(v)` — no trim, no case-folding) and dispatches to exactly two
 * NAMED branches ("References", "Topaz"); everything else — absent, empty,
 * padded, lower-cased, a number, garbage — falls to the `--LoG` else-branch.
 * The first cut of this predicate matched `=== LOG_PICK_METHOD` exactly,
 * which disagreed with the builder on every non-canonical form ("LoG",
 * "laplacian of gaussian", " References ") and would have handed those
 * dispatches a GPU the picker refuses (the review's HIGH). The mirror is
 * the contract: whatever the builder would send `--LoG` for, the GPU
 * decision must treat as CPU-only.
 */
export function isLogAutopick(type: string, params: unknown): boolean {
  if (type !== "autopick") return false;
  let raw: unknown = params;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return true; // unparseable params → the builder's LoG default (safe side)
    }
  }
  const rec = (raw ?? {}) as Record<string, unknown>;
  // engine str(): undefined/null → fallback, else String(v) — verbatim
  const v = rec.pickingMethod;
  const method = v === undefined || v === null ? LOG_PICK_METHOD : String(v);
  return method !== "References" && method !== "Topaz";
}

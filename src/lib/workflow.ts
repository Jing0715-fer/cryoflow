/**
 * CryoFlow — job type catalog (RELION 5: 21 SPA + 10 TOMO + External = 32),
 * shared by client and server.
 * Pure data: NO React imports. Lucide icons are referenced by NAME string
 * and resolved through the client-side iconMap (src/components/workflow/icons.tsx).
 *
 * Command-line authority: /home/z/relion-build/pipeline_jobs.cpp (RELION 5.0.1
 * getCommands*Job builders) — mirrored by the real engine in src/lib/relion/engine.ts.
 */

import type { JobTier, JobTypeSpec, ParamSchema } from "./types";

/** Fixed job card geometry (px, in workspace coordinates). */
export const CARD_W = 220;
export const CARD_H = 96;

/** Canvas workspace size (px, in workspace coordinates). */
export const CANVAS_W = 2400;
export const CANVAS_H = 1600;

/** Zoom limits for the canvas viewport. */
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.1;

const num = (
  key: string,
  label: string,
  def: number,
  extra?: Partial<ParamSchema>
): ParamSchema => ({ key, label, type: "number", default: def, ...extra });

const sel = (
  key: string,
  label: string,
  def: string,
  options: string[]
): ParamSchema => ({ key, label, type: "select", default: def, options });

const symmetryOptions = ["C1", "C2", "C4", "D2", "T", "I"];

/** Color fragment families (no indigo/blue anywhere). */
const COLORS = {
  teal: {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500",
    border: "border-teal-500",
    soft: "bg-teal-500/10",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500",
    border: "border-violet-500",
    soft: "bg-violet-500/10",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500",
    border: "border-amber-500",
    soft: "bg-amber-500/10",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500",
    border: "border-rose-500",
    soft: "bg-rose-500/10",
  },
  orange: {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500",
    border: "border-orange-500",
    soft: "bg-orange-500/10",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500",
    border: "border-emerald-500",
    soft: "bg-emerald-500/10",
  },
  green: {
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-500",
    border: "border-green-500",
    soft: "bg-green-500/10",
  },
  cyan: {
    text: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500",
    border: "border-cyan-500",
    soft: "bg-cyan-500/10",
  },
  slate: {
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500",
    border: "border-slate-500",
    soft: "bg-slate-500/10",
  },
  pink: {
    text: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-500",
    border: "border-pink-500",
    soft: "bg-pink-500/10",
  },
} as const;

type ColorName = keyof typeof COLORS;

const spec = (
  key: string,
  label: string,
  icon: string,
  color: ColorName,
  description: string,
  duration: number,
  params: ParamSchema[],
  resultTemplate: string,
  tier: JobTier,
  group = "SPA"
): JobTypeSpec => ({
  key,
  label,
  group,
  icon,
  color: COLORS[color],
  description,
  duration,
  params,
  resultTemplate,
  tier,
});

export const JOB_TYPES: JobTypeSpec[] = [
  /* ------------------------------------------------------------------ */
  /* SPA (single-particle analysis) — 21 + shared External               */
  /* ------------------------------------------------------------------ */
  spec(
    "import",
    "Import Movies / Micrographs",
    "FolderInput",
    "teal",
    "Ingest movies or micrograph metadata into the project as a RELION 5 optics-group STAR file.",
    2000,
    [
      num("pixelSize", "Pixel size", 1.77, { unit: "Å", min: 0.1, step: 0.01 }),
      num("voltage", "Voltage", 300, { unit: "kV" }),
      num("cs", "Spherical aberration", 2.7, { unit: "mm", step: 0.1 }),
      num("ampContrast", "Amplitude contrast", 0.1, { step: 0.01, min: 0.01, max: 0.3 }),
    ],
    "{n} micrographs imported",
    "core"
  ),
  spec(
    "motioncorr",
    "Motion Correction",
    "Wind",
    "violet",
    "Correct beam-induced specimen motion with MotionCor2 patch-based alignment (external binary).",
    9000,
    [
      num("patchX", "Patches X", 5, { min: 1 }),
      num("patchY", "Patches Y", 5, { min: 1 }),
      num("bfactor", "B-factor", 150, { step: 10 }),
      num("dosePerFrame", "Dose per frame", 1.28, { unit: "e⁻/Å²", step: 0.01 }),
    ],
    "{n} movies corrected",
    "external"
  ),
  spec(
    "ctffind",
    "CTF Estimation",
    "Aperture",
    "amber",
    "Estimate the contrast transfer function per micrograph with CTFFIND-4.x power-spectrum fits.",
    5000,
    [
      num("box", "Box size", 512, { step: 32, min: 64, max: 2048 }),
      num("resMin", "Min resolution", 30, { unit: "Å", min: 5, max: 100 }),
      num("resMax", "Max resolution", 5, { unit: "Å", min: 1, max: 30 }),
      num("dFMin", "Min defocus", 5000, { unit: "Å", step: 500 }),
      num("dFMax", "Max defocus", 50000, { unit: "Å", step: 500 }),
    ],
    "CTF fitted, {n} micrographs",
    "core"
  ),
  spec(
    "manualpick",
    "Manual Picking",
    "Crosshair",
    "rose",
    "Pick particles manually on micrographs (Henderson-style .coord files are imported natively).",
    2500,
    [
      num("particleDiameter", "Particle diameter", 180, { unit: "Å", step: 5 }),
      num("lowpass", "Lowpass filter", 20, { unit: "Å", step: 5 }),
      num("sigmaContrast", "Sigma contrast", 3, { step: 0.5 }),
    ],
    "{n} particles picked",
    "core"
  ),
  spec(
    "autopick",
    "Automated Picking",
    "Search",
    "rose",
    "Detect particles automatically with reference templates, Laplacian-of-Gaussian or Topaz.",
    7000,
    [
      num("particleDiameter", "Particle diameter", 180, { unit: "Å", step: 5 }),
      num("threshold", "Picking threshold", 0.4, { step: 0.05, min: 0, max: 1 }),
      num("lowpass", "Lowpass filter", 20, { unit: "Å", step: 5 }),
    ],
    "{n} particles picked",
    "cmd"
  ),
  spec(
    "extract",
    "Particle Extraction",
    "Crop",
    "orange",
    "Box picked particles out of micrographs, normalize and optionally downscale the stacks.",
    3000,
    [
      num("boxSize", "Box size", 128, { step: 8, min: 32, max: 512, unit: "px" }),
      num("downsampleTo", "Downsample to", 64, { step: 8, min: 0, max: 512, unit: "px" }),
      num("bgDiameter", "Background diameter", -1, { unit: "px", hint: "-1 = 0.75 × box" }),
    ],
    "{n} particles extracted",
    "core"
  ),
  spec(
    "select",
    "Particle Selection",
    "ListFilter",
    "orange",
    "Select a particle subset from a larger STAR file (class-based, statistics or first-N).",
    1500,
    [
      num("maxParticles", "Max particles", 1000, { step: 100, min: 1 }),
      num("discardSigma", "Discard sigma", 4, { step: 0.5, min: 1, max: 10 }),
      num("duplicateThreshold", "Min inter-particle distance", 30, { unit: "Å", step: 5 }),
    ],
    "{n} particles selected",
    "core"
  ),
  spec(
    "class2d",
    "2D Classification",
    "LayoutGrid",
    "emerald",
    "Multi-reference 2D class averaging (relion_refine) to separate good particles from junk.",
    12000,
    [
      num("numClasses", "Number of classes", 10, { step: 1, min: 1, max: 200 }),
      num("iterations", "Iterations", 12, { step: 1, min: 1, max: 50 }),
      num("particleDiameter", "Particle diameter", 180, { unit: "Å", step: 5 }),
      num("tau2Fudge", "Tau2 fudge factor", 1, { step: 0.5, min: 0.5 }),
    ],
    "{n} class averages",
    "core"
  ),
  spec(
    "initialmodel",
    "3D Initial Model",
    "Layers",
    "green",
    "Generate ab-initio 3D references with the gradient-driven VDAM de-novo algorithm.",
    14000,
    [
      num("numClasses", "Number of classes", 4, { min: 1, max: 20 }),
      sel("symmetry", "Symmetry", "D2", symmetryOptions),
      num("iterations", "Iterations", 50, { step: 5, min: 5, max: 300 }),
      num("particleDiameter", "Particle diameter", 180, { unit: "Å", step: 5 }),
    ],
    "{n} initial models",
    "core"
  ),
  spec(
    "class3d",
    "3D Classification",
    "Boxes",
    "green",
    "Sort particles into 3D conformational classes against a reference map.",
    14000,
    [
      num("numClasses", "Number of classes", 4, { min: 1, max: 20 }),
      sel("symmetry", "Symmetry", "C1", symmetryOptions),
      num("iterations", "Iterations", 25, { step: 5, min: 5, max: 100 }),
      num("particleDiameter", "Particle diameter", 180, { unit: "Å", step: 5 }),
    ],
    "{n} 3D classes",
    "cmd"
  ),
  spec(
    "refine3d",
    "3D Auto-Refine",
    "Gem",
    "cyan",
    "Gold-standard angular refinement (relion_refine) with FSC-driven auto-stopping or fixed iters.",
    16000,
    [
      sel("symmetry", "Symmetry", "D2", symmetryOptions),
      num("particleDiameter", "Particle diameter", 180, { unit: "Å", step: 5 }),
      sel("autoRefine", "Auto-refine", "false", ["false", "true"]),
      num("iterations", "Iterations", 15, { step: 1, min: 1, max: 50, hint: "used when auto-refine is off" }),
    ],
    "Refined to {n} Å",
    "core"
  ),
  spec(
    "multibody",
    "Multi-Body Refinement",
    "Combine",
    "cyan",
    "Refine bodies of a multi-domain complex independently against body masks.",
    18000,
    [
      num("numBodies", "Number of bodies", 2, { min: 1, max: 20 }),
      sel("symmetry", "Symmetry", "C1", symmetryOptions),
      num("particleDiameter", "Particle diameter", 180, { unit: "Å", step: 5 }),
    ],
    "{n} bodies refined",
    "cmd"
  ),
  spec(
    "maskcreate",
    "Mask Creation",
    "CircleDot",
    "slate",
    "Build a soft-edged 3D mask around the density (relion_mask_create) for FSC and validation.",
    2500,
    [
      num("threshold", "Initial threshold", 0.02, { step: 0.01, min: 0.001 }),
      num("softEdge", "Soft edge width", 6, { unit: "px", min: 1 }),
      num("lowpass", "Lowpass filter", 15, { unit: "Å", step: 5 }),
      num("extend", "Extend initial mask", 3, { unit: "px", min: 0 }),
    ],
    "Mask created",
    "core"
  ),
  spec(
    "joinstar",
    "Join STAR Files",
    "Merge",
    "teal",
    "Combine multiple particle, micrograph or movie STAR files into one (relion_star_handler).",
    2000,
    [
      sel("selectKind", "File type", "particles", ["particles", "micrographs", "movies"]),
      sel("randomize", "Randomise order", "false", ["false", "true"]),
      sel("removeDuplicates", "Remove duplicates", "false", ["false", "true"]),
    ],
    "{n} items joined",
    "cmd"
  ),
  spec(
    "subtract",
    "Signal Subtraction",
    "Scissors",
    "amber",
    "Subtract masked signal from particles for focused classification/refinement.",
    5000,
    [
      num("newBox", "New box size", -1, { unit: "px", step: 32, hint: "-1 keeps box" }),
      sel("recenter", "Re-center on mask", "true", ["true", "false"]),
      sel("float16", "Write float16", "true", ["true", "false"]),
    ],
    "{n} particles subtracted",
    "cmd"
  ),
  spec(
    "postprocess",
    "Post-Processing",
    "Sparkles",
    "pink",
    "Sharpen, mask and B-factor weight the refined half-maps (relion_postprocess) for deposition.",
    4000,
    [
      sel("autoBfac", "Auto B-factor", "true", ["true", "false"]),
      num("autobLowres", "Auto-B low-res limit", 10, { unit: "Å", step: 1 }),
      num("randomizeFrom", "Randomize phases from", 10, { unit: "Å", step: 1 }),
    ],
    "Sharpened map, {n} Å",
    "core"
  ),
  spec(
    "localres",
    "Local Resolution",
    "Gauge",
    "pink",
    "Estimate per-voxel resolution with RELION's sliding-window postprocess or ResMap.",
    9000,
    [
      sel("method", "Method", "Relion", ["Relion", "ResMap"]),
      num("adhocBfac", "Ad-hoc B-factor", -100, { step: 25 }),
      num("pval", "P-value", 0.05, { step: 0.01, min: 0.01, max: 0.5 }),
    ],
    "Local resolution to {n} Å",
    "cmd"
  ),
  spec(
    "polish",
    "Bayesian Polishing",
    "Wand2",
    "violet",
    "Per-particle motion correction and radiation-damage weighting (relion_motion_refine).",
    15000,
    [
      num("evalFrac", "Fourier eval fraction", 0.5, { step: 0.05, min: 0.1, max: 0.9 }),
      num("firstFrame", "First frame", 1, { min: 1 }),
      num("lastFrame", "Last frame", 24, { min: 1 }),
    ],
    "Polished to {n} Å",
    "cmd"
  ),
  spec(
    "ctfrefine",
    "CTF Refinement",
    "Focus",
    "amber",
    "Per-particle defocus, astigmatism and higher-order aberration refinement (relion_ctf_refine).",
    10000,
    [
      num("minres", "Fit from resolution", 20, { unit: "Å", step: 5 }),
      sel("fitDefocus", "Fit defocus", "true", ["true", "false"]),
      sel("fitAstig", "Fit astigmatism", "false", ["false", "true"]),
    ],
    "CTF refined, {n} particles",
    "cmd"
  ),
  spec(
    "dynamight",
    "DynaMight",
    "Waves",
    "violet",
    "Continuous-flexibility analysis with the DynaMight neural network (python + torch required).",
    20000,
    [
      num("nGaussians", "Number of Gaussians", 10000, { step: 1000, min: 1000 }),
      num("regFactor", "Regularization factor", 1, { step: 0.1, min: 0.2 }),
      num("nThreads", "Threads", 4, { min: 1, max: 32 }),
    ],
    "{n} deformations optimised",
    "external"
  ),
  spec(
    "modelangelo",
    "ModelAngelo",
    "Dna",
    "violet",
    "De-novo atomic model building into a cryo-EM map with ModelAngelo (python required).",
    22000,
    [
      sel("buildMode", "Build mode", "build_no_seq", ["build_no_seq", "build"]),
      sel("gpuId", "GPU", "0", ["0", "1", "2", "3"]),
      sel("hhsearch", "HMM sequence search", "false", ["false", "true"]),
    ],
    "{n} residues built",
    "external"
  ),

  /* ------------------------------------------------------------------ */
  /* Tomography — 10                                                     */
  /* ------------------------------------------------------------------ */
  spec(
    "tomo_import",
    "Tomo: Import",
    "FolderOpen",
    "teal",
    "Import tilt series (SerialEM mdocs) and build the tomography STAR hierarchy.",
    2500,
    [
      num("pixelSize", "Nominal pixel size", 1.35, { unit: "Å", step: 0.01 }),
      num("voltage", "Voltage", 300, { unit: "kV" }),
      num("cs", "Spherical aberration", 2.7, { unit: "mm", step: 0.1 }),
      num("ampContrast", "Amplitude contrast", 0.1, { step: 0.01, min: 0.01, max: 0.3 }),
      num("doseRate", "Dose per tilt image", 3, { unit: "e⁻/Å²", step: 0.1 }),
    ],
    "{n} tilt series imported",
    "cmd",
    "Tomography"
  ),
  spec(
    "tomo_aligntiltseries",
    "Tomo: Align Tilt Series",
    "Move3d",
    "cyan",
    "Align tilt series with IMOD fiducials, IMOD patch-tracking or AreTomo2.",
    12000,
    [
      sel("method", "Method", "AreTomo2", ["AreTomo2", "IMOD fiducials", "IMOD patch-track"]),
      num("thickness", "Tomogram thickness", 300, { unit: "nm", step: 10 }),
      num("fiducialDiameter", "Fiducial diameter", 10, { unit: "nm", step: 1 }),
    ],
    "{n} tilt series aligned",
    "cmd",
    "Tomography"
  ),
  spec(
    "tomo_tomograms",
    "Tomo: Reconstruct Tomograms",
    "Box",
    "cyan",
    "Back-project aligned tilt series into 3D tomograms (relion_tomo_reconstruct_tomogram).",
    15000,
    [
      num("binnedAngpix", "Binned pixel size", 10, { unit: "Å", step: 1, min: 1 }),
      num("xdim", "Width (x)", 1024, { step: 64, min: 256 }),
      num("zdim", "Thickness (z)", 300, { unit: "px", step: 50, min: 50 }),
    ],
    "{n} tomograms reconstructed",
    "cmd",
    "Tomography"
  ),
  spec(
    "tomo_ctfrefine",
    "Tomo: CTF Refinement",
    "Focus",
    "amber",
    "Refine tilt-series defoci and signal scale against reference maps (relion_tomo_refine_ctf).",
    12000,
    [
      num("boxSize", "Box size for estimation", 128, { step: 16, min: 32 }),
      num("focusRange", "Defocus search range", 3000, { unit: "Å", step: 500 }),
      sel("doRegDef", "Defocus regularisation", "false", ["false", "true"]),
    ],
    "CTF refined for {n} tilt series",
    "cmd",
    "Tomography"
  ),
  spec(
    "tomo_exclude",
    "Tomo: Exclude Tilt Images",
    "EyeOff",
    "slate",
    "Interactively exclude bad tilt images (Napari-based relion_python_tomo_exclude_tilt_images).",
    3000,
    [
      num("cacheSize", "Cached tilt series", 5, { min: 1, max: 10 }),
      num("maxTilt", "Exclude above tilt", 60, { unit: "°", step: 5 }),
      num("minFrames", "Minimum frames kept", 1, { min: 1, max: 40 }),
    ],
    "{n} tilt images excluded",
    "cmd",
    "Tomography"
  ),
  spec(
    "tomo_polish",
    "Tomo: Polishing",
    "Wand2",
    "violet",
    "Frame-series alignment / per-particle motion polishing (relion_tomo_align).",
    16000,
    [
      num("boxSize", "Box size", 128, { step: 16, min: 32 }),
      num("maxError", "Max alignment error", 5, { unit: "px", step: 1 }),
      sel("motionMode", "Motion mode", "motion", ["motion", "shift_only"]),
    ],
    "Polished {n} particles",
    "cmd",
    "Tomography"
  ),
  spec(
    "tomo_reconstruct",
    "Tomo: Reconstruct Subtomos",
    "Layers",
    "cyan",
    "Reconstruct pseudo-subtomograms from aligned tilt series (relion_tomo_reconstruct_particle).",
    18000,
    [
      num("boxSize", "Box size", 128, { step: 16, min: 32 }),
      num("binning", "Binning factor", 1, { step: 0.5, min: 0.5, max: 16 }),
      num("snr", "SNR", 0.001, { step: 0.001, min: 0.0001 }),
    ],
    "{n} subtomograms reconstructed",
    "cmd",
    "Tomography"
  ),
  spec(
    "tomo_denoise",
    "Tomo: Denoise",
    "Brush",
    "violet",
    "Denoise tomograms with cryoCARE train/predict (external python environment).",
    14000,
    [
      sel("mode", "Mode", "cryoCARE:train", ["cryoCARE:train", "cryoCARE:predict"]),
      num("subvolumeDimensions", "Sub-volume size", 72, { unit: "px", step: 8, min: 64 }),
      num("trainingSubvolumes", "Sub-volumes per tomo", 1200, { step: 100, min: 100 }),
    ],
    "{n} tomograms denoised",
    "external",
    "Tomography"
  ),
  spec(
    "tomo_picks",
    "Tomo: Picking",
    "Crosshair",
    "rose",
    "Pick particles/filaments on tomograms in Napari (relion_python_tomo_pick + get_particle_poses).",
    8000,
    [
      sel("pickMode", "Pick mode", "particles", ["particles", "filaments", "surfaces", "spheres"]),
      num("spacing", "Spacing", 20, { unit: "Å", step: 5, min: 5 }),
      num("cacheSize", "Cached tilt series", 5, { min: 1, max: 10 }),
    ],
    "{n} picks imported",
    "external",
    "Tomography"
  ),
  spec(
    "tomo_extract",
    "Tomo: Extract Subtomos",
    "Crop",
    "orange",
    "Extract pseudo-subtomogram boxes at picked positions (relion_tomo_subtomo).",
    9000,
    [
      num("boxSize", "Box size", 128, { step: 16, min: 32 }),
      num("binning", "Binning factor", 1, { step: 0.5, min: 0.5, max: 16 }),
      num("maxDose", "Maximum dose", 60, { unit: "e⁻/Å²", step: 5 }),
    ],
    "{n} subtomos extracted",
    "cmd",
    "Tomography"
  ),

  /* ------------------------------------------------------------------ */
  /* External (shared) — grouped with SPA                                */
  /* ------------------------------------------------------------------ */
  spec(
    "external",
    "External (custom)",
    "Terminal",
    "slate",
    "Run any external command line inside the pipeline, exporting RELION metadata as variables.",
    5000,
    [
      sel("interpreter", "Interpreter", "bash", ["bash", "sh"]),
      num("timeout", "Timeout", 3600, { unit: "s", step: 60, min: 60 }),
      sel("exportMeta", "Export metadata", "true", ["true", "false"]),
    ],
    "External command done",
    "cmd"
  ),
];

/** Ordered group labels for the palette. */
export const JOB_GROUPS: string[] = ["SPA", "Tomography"];

const TYPE_MAP = new Map(JOB_TYPES.map((t) => [t.key, t]));

export function jobType(key: string): JobTypeSpec | undefined {
  return TYPE_MAP.get(key);
}

/** Default parameter map for a job type (used by seeding + forms). */
export function defaultParams(key: string): Record<string, number | string> {
  const t = jobType(key);
  if (!t) return {};
  const out: Record<string, number | string> = {};
  for (const p of t.params) out[p.key] = p.default;
  return out;
}

/** Types whose simulated result resolves to a resolution string. */
const RESOLUTION_TYPES = new Set([
  "refine3d",
  "postprocess",
  "localres",
  "polish",
]);

/**
 * Deterministic result string for a completed job (sim engine).
 * Pseudo-count derived from a string hash of the job id:
 * counts in [800, 4200]; refine/post types resolve to a resolution in [3.1, 8.5] Å.
 */
export function resultFor(typeKey: string, jobId: string): string {
  const t = jobType(typeKey);
  const template = t?.resultTemplate ?? "{n} items";
  let h = 0;
  for (let i = 0; i < jobId.length; i++) {
    h = (h * 31 + jobId.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(h);
  if (RESOLUTION_TYPES.has(typeKey)) {
    const res = (310 + (abs % 540)) / 100; // 3.10 – 8.49 Å
    return template.replace("{n}", res.toFixed(2));
  }
  const n = 800 + (abs % 3401); // 800 – 4200
  return template.replace("{n}", String(n));
}

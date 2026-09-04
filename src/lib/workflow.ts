/**
 * CryoFlow — job type catalog (RELION 5: 21 SPA + 10 TOMO + External = 32),
 * shared by client and server.
 * Pure data: NO React imports. Lucide icons are referenced by NAME string
 * and resolved through the client-side iconMap (src/components/workflow/icons.tsx).
 *
 * Fidelity sources (RELION 5.0.1 sources in /home/z/relion-build/):
 *  - pipeline_jobs.cpp  — getCommands*Job builders (command-line authority)
 *  - gui_jobwindow.cpp  — job-window tabs / labels / defaults (GUI authority)
 * Tab names below ("Optimisation", "Sampling", "CTFFIND-4.1", "Polish", …)
 * are lifted verbatim from gui_jobwindow.cpp.
 */

import type { JobTier, JobTypeSpec, ParamSchema, ParamValue, PortKind, PortSpec } from "./types";

/** Fixed job card geometry (px, in workspace coordinates). */
export const CARD_W = 220;
export const CARD_H = 96;

/**
 * INFINITE CANVAS — the workspace is unbounded: job coordinates may be
 * negative or arbitrarily large, the dot grid follows the viewport, and
 * the edge/minimap layers size themselves to the content. These bounds
 * are pure defensive guards against pathological values (NaN traps,
 * database overflow), not a usable canvas limit — ±20,000 px is ~90
 * screens of panning in every direction.
 */
export const WORLD_MIN = -20_000;
export const WORLD_MAX = 20_000;

/** Zoom limits for the canvas viewport (free zoom-to-cursor canvas). */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2.2;
export const ZOOM_STEP = 0.1;

/* ------------------------------------------------------------------ */
/* Param shorthands                                                    */
/* ------------------------------------------------------------------ */

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
  options: string[],
  extra?: Partial<ParamSchema>
): ParamSchema => ({ key, label, type: "select", default: def, options, ...extra });

const bool = (
  key: string,
  label: string,
  def: boolean,
  extra?: Partial<ParamSchema>
): ParamSchema => ({ key, label, type: "bool", default: def, ...extra });

const symmetryOptions = ["C1", "C2", "C4", "D2", "T", "I"];
const psiOptions = ["30", "15", "7.5", "3.75", "1.875"];

/* ------------------------------------------------------------------ */
/* Palette categories (RELION job-browser tree)                        */
/* ------------------------------------------------------------------ */

export interface JobCategory {
  key: string;
  label: string;
  hint: string;
}

export const JOB_CATEGORIES: JobCategory[] = [
  { key: "import", label: "Import", hint: "Movies · micrographs · particles" },
  { key: "motion", label: "Motion", hint: "Beam-induced motion correction" },
  { key: "ctf", label: "CTF", hint: "Estimation & refinement" },
  { key: "picking", label: "Picking", hint: "Manual & automated detection" },
  { key: "extract", label: "Extraction", hint: "Boxing · rescaling · subtraction" },
  { key: "select", label: "Selection", hint: "Subsets & STAR handling" },
  { key: "class2d", label: "2D Classification", hint: "Multi-reference averaging" },
  { key: "class3d", label: "3D Classification", hint: "Initial models & sorting" },
  { key: "refine", label: "3D Refinement", hint: "Auto-refine · multibody" },
  { key: "postprocess", label: "3D Postprocess", hint: "Masks · sharpening · local res" },
  { key: "polish", label: "Polish & CTF", hint: "Per-particle refinements" },
  { key: "tomo", label: "Tomography", hint: "Tilt series · subtomograms" },
  { key: "external", label: "External", hint: "Custom & deep-learning tools" },
];

/* ------------------------------------------------------------------ */
/* Port colors by data kind (no blue/indigo anywhere)                  */
/* ------------------------------------------------------------------ */

export const PORT_COLORS: Record<PortKind, { dot: string; label: string; text: string }> = {
  movies: { dot: "bg-cyan-500", label: "text-cyan-700 dark:text-cyan-300", text: "Cyan" },
  micrographs: { dot: "bg-teal-500", label: "text-teal-700 dark:text-teal-300", text: "Teal" },
  coords: { dot: "bg-amber-500", label: "text-amber-700 dark:text-amber-300", text: "Amber" },
  particles: { dot: "bg-violet-500", label: "text-violet-700 dark:text-violet-300", text: "Violet" },
  references2d: { dot: "bg-rose-500", label: "text-rose-700 dark:text-rose-300", text: "Rose" },
  volume: { dot: "bg-orange-500", label: "text-orange-700 dark:text-orange-300", text: "Orange" },
  halfmap: { dot: "bg-pink-500", label: "text-pink-700 dark:text-pink-300", text: "Pink" },
  mask: { dot: "bg-emerald-500", label: "text-emerald-700 dark:text-emerald-300", text: "Emerald" },
  star: { dot: "bg-slate-500", label: "text-slate-700 dark:text-slate-300", text: "Slate" },
  tiltseries: { dot: "bg-cyan-500", label: "text-cyan-700 dark:text-cyan-300", text: "Cyan" },
  tomograms: { dot: "bg-teal-500", label: "text-teal-700 dark:text-teal-300", text: "Teal" },
};

/** Port shorthands. */
const inp = (name: string, label: string, accepts: (PortKind | "*")[], multiple = false): PortSpec => ({
  name,
  label,
  accepts,
  multiple,
});

const outp = (name: string, label: string, kind: PortKind): PortSpec => ({ name, label, kind });

/** Standard port labels (RELION wording). */
const L = {
  moviesIn: "Input movies STAR file (.star)",
  micIn: "Input micrographs STAR file (.star)",
  particlesIn: "Input images STAR file (.star)",
  coordsOut: "Picked coordinates (.coord)",
  particlesOut: "Particles STAR file (.star)",
  optParticlesOut: "Optimised particles STAR file (.star)",
  classAveragesOut: "Class averages (.mrcs)",
  mapIn: "Reference map (.mrc)",
  mapOut: "Refined map (.mrc)",
  half1In: "Unfiltered half-map 1 (.mrc)",
  half2In: "Unfiltered half-map 2 (.mrc)",
  maskIn: "Solvent mask (.mrc)",
  maskOut: "Output mask (.mrc)",
  tiltIn: "Input tilt-series STAR file (.star)",
  tiltOut: "Aligned tilt-series STAR file (.star)",
  tomoIn: "Input tomograms STAR file (.star)",
  tomoOut: "Tomograms STAR file (.star)",
};

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

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

interface SpecOpts {
  category?: string;
  group?: string;
  tabs?: string[];
  inputs?: PortSpec[];
  outputs?: PortSpec[];
}

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
  opts: SpecOpts = {}
): JobTypeSpec => ({
  key,
  label,
  group: opts.group ?? "SPA",
  category: opts.category ?? "external",
  icon,
  color: COLORS[color],
  description,
  duration,
  tabs: opts.tabs ?? [],
  inputs: opts.inputs ?? [],
  outputs: opts.outputs ?? [],
  params,
  resultTemplate,
  tier,
});

/* ------------------------------------------------------------------ */
/* The catalog                                                         */
/* ------------------------------------------------------------------ */

export const JOB_TYPES: JobTypeSpec[] = [
  /* ---------------- Import ------------------------------------------ */
  spec(
    "import",
    "Import Movies / Micrographs",
    "FolderInput",
    "teal",
    "Ingest movies or micrograph metadata into the project as a RELION 5 optics-group STAR file.",
    2000,
    [
      num("pixelSize", "Pixel size", 1.77, { unit: "Å", min: 0.1, step: 0.01, tab: "Movies/mics" }),
      num("voltage", "Voltage", 300, { unit: "kV", tab: "Movies/mics" }),
      num("cs", "Spherical aberration", 2.7, { unit: "mm", step: 0.1, tab: "Movies/mics" }),
      num("ampContrast", "Amplitude contrast", 0.1, { step: 0.01, min: 0.01, max: 0.3, tab: "Movies/mics" }),
      num("totalDose", "Total exposure dose", 25, { unit: "e⁻/Å²", step: 0.5, advanced: true, tab: "Movies/mics" }),
    ],
    "{n} micrographs imported",
    "core",
    {
      category: "import",
      tabs: ["Movies/mics"],
      inputs: [],
      outputs: [outp("micrographs", "Micrographs STAR file (.star)", "micrographs")],
    }
  ),

  /* ---------------- Motion ------------------------------------------ */
  spec(
    "motioncorr",
    "Motion Correction",
    "Wind",
    "violet",
    "Correct beam-induced specimen motion with MotionCor2 patch-based alignment (external binary).",
    9000,
    [
      num("patchX", "Patch X", 5, { min: 1, tab: "Motion" }),
      num("patchY", "Patch Y", 5, { min: 1, tab: "Motion" }),
      num("bfactor", "B-factor", 150, { step: 10, tab: "Motion", advanced: true }),
      num("dosePerFrame", "Dose per frame", 1.28, { unit: "e⁻/Å²", step: 0.01, tab: "Motion" }),
    ],
    "{n} movies corrected",
    "external",
    {
      category: "motion",
      tabs: ["Motion", "Compute"],
      inputs: [inp("movies", L.moviesIn, ["movies", "micrographs"])],
      outputs: [outp("micrographs", "Corrected micrographs STAR (.star)", "micrographs")],
    }
  ),

  /* ---------------- CTF --------------------------------------------- */
  spec(
    "ctffind",
    "CTF Estimation",
    "Aperture",
    "amber",
    "Estimate the contrast transfer function per micrograph with CTFFIND-4.x power-spectrum fits.",
    5000,
    [
      num("box", "CTF box size", 512, { step: 32, min: 64, max: 2048, unit: "px", tab: "CTFFIND-4.1" }),
      num("resMin", "Minimum resolution", 30, { unit: "Å", min: 5, max: 100, tab: "CTFFIND-4.1" }),
      num("resMax", "Maximum resolution", 5, { unit: "Å", min: 1, max: 30, tab: "CTFFIND-4.1" }),
      num("dFMin", "Defocus search lower limit", 5000, { unit: "Å", step: 500, tab: "CTFFIND-4.1" }),
      num("dFMax", "Defocus search upper limit", 50000, { unit: "Å", step: 500, tab: "CTFFIND-4.1" }),
      bool("fitAstig", "Find astigmatism", true, { tab: "CTFFIND-4.1", advanced: true }),
      bool("phaseShift", "Estimate phase shifts", false, { tab: "CTFFIND-4.1", advanced: true }),
    ],
    "CTF fitted, {n} micrographs",
    "core",
    {
      category: "ctf",
      tabs: ["CTFFIND-4.1"],
      inputs: [inp("micrographs", L.micIn, ["micrographs"])],
      outputs: [outp("micrographs", "CTF-estimated micrographs STAR", "micrographs")],
    }
  ),

  /* ---------------- Picking ----------------------------------------- */
  spec(
    "manualpick",
    "Manual Picking",
    "Crosshair",
    "rose",
    "Pick particles manually on micrographs (Henderson-style .coord files are imported natively).",
    2500,
    [
      num("particleDiameter", "Particle diameter for picking", 180, { unit: "Å", step: 5, tab: "Display" }),
      num("lowpass", "Lowpass filter", 20, { unit: "Å", step: 5, tab: "Display" }),
      num("sigmaContrast", "Sigma contrast black ring", 3, { step: 0.5, tab: "Display" }),
      num("particleDiameterScale", "Particle diameter scale", 1, { step: 0.1, min: 0.5, max: 3, tab: "Display", advanced: true }),
    ],
    "{n} particles picked",
    "core",
    {
      category: "picking",
      tabs: ["Display", "Colors"],
      inputs: [inp("micrographs", L.micIn, ["micrographs"])],
      outputs: [outp("coords", L.coordsOut, "coords")],
    }
  ),
  spec(
    "autopick",
    "Automated Picking",
    "Search",
    "rose",
    "Detect particles automatically with reference templates, Laplacian-of-Gaussian or Topaz.",
    7000,
    [
      num("particleDiameter", "LoG blob diameter", 180, { unit: "Å", step: 5, tab: "Laplacian" }),
      num("lowpass", "Lowpass filter for references", 20, { unit: "Å", step: 5, tab: "References" }),
      num("threshold", "Picking threshold", 0.4, { step: 0.05, min: 0, max: 1, tab: "autopicking" }),
      num("minDistance", "Minimum inter-particle distance", 100, { unit: "Å", step: 10, min: 0, tab: "autopicking", advanced: true }),
      num("maxStddevNoise", "Maximum stddev of noise", 0, { step: 0.05, min: 0, tab: "autopicking", advanced: true }),
    ],
    "{n} particles picked",
    "cmd",
    {
      category: "picking",
      tabs: ["Laplacian", "References", "autopicking", "Topaz"],
      inputs: [
        inp("micrographs", L.micIn, ["micrographs"]),
        inp("references", "2D references (.mrcs)", ["references2d"]),
      ],
      outputs: [outp("coords", L.coordsOut, "coords")],
    }
  ),

  /* ---------------- Extraction -------------------------------------- */
  spec(
    "extract",
    "Particle Extraction",
    "Crop",
    "orange",
    "Box picked particles out of micrographs, normalize and optionally downscale the stacks.",
    3000,
    [
      num("boxSize", "Particle box size", 128, { step: 8, min: 32, max: 512, unit: "px", tab: "extract" }),
      num("downsampleTo", "Rescale to box size", 64, { step: 8, min: 0, max: 512, unit: "px", tab: "extract", hint: "0 = keep original box" }),
      num("bgDiameter", "Diameter background circle", -1, { unit: "px", tab: "extract", hint: "-1 = 0.75 × box" }),
      bool("norm", "Normalise particles", true, { tab: "extract", advanced: true }),
    ],
    "{n} particles extracted",
    "core",
    {
      category: "extract",
      tabs: ["extract"],
      inputs: [
        inp("micrographs", L.micIn, ["micrographs"]),
        inp("coords", "Particle coordinates (.coord)", ["coords"]),
      ],
      outputs: [outp("particles", L.particlesOut, "particles")],
    }
  ),
  spec(
    "subtract",
    "Signal Subtraction",
    "Scissors",
    "amber",
    "Subtract masked signal from particles for focused classification/refinement.",
    5000,
    [
      num("newBox", "New box size", -1, { unit: "px", step: 32, tab: "Reference", hint: "-1 keeps box" }),
      bool("recenter", "Re-center on mask", true, { tab: "Reference" }),
      bool("float16", "Write output in float16", true, { tab: "Reference", advanced: true }),
    ],
    "{n} particles subtracted",
    "cmd",
    {
      category: "extract",
      tabs: ["Reference"],
      inputs: [
        inp("particles", L.particlesIn, ["particles"]),
        inp("reference", "3D map to subtract (.mrc)", ["volume"]),
      ],
      outputs: [outp("particles", "Subtracted particles STAR", "particles")],
    }
  ),

  /* ---------------- Selection --------------------------------------- */
  spec(
    "select",
    "Particle Selection",
    "ListFilter",
    "orange",
    "Select a particle subset from a larger STAR file (class-based, statistics or first-N).",
    1500,
    [
      num("maxParticles", "Max particles", 1000, { step: 100, min: 1, tab: "Subsets" }),
      num("classCutoff", "Class occupancy cutoff", 0.5, {
        step: 0.05, min: 0, max: 1, tab: "Subsets",
        hint: "when input has _rlnClassNumber: keep classes with ≥ this fraction of the largest class occupancy (0 = keep all classes)",
      }),
      num("discardSigma", "Discard sigma", 4, { step: 0.5, min: 1, max: 10, tab: "Subsets", advanced: true }),
      num("duplicateThreshold", "Min inter-particle distance", 30, { unit: "Å", step: 5, tab: "Duplicates", advanced: true }),
    ],
    "{n} particles selected",
    "core",
    {
      category: "select",
      tabs: ["Subsets", "Duplicates"],
      inputs: [inp("particles", "Input STAR file(s)", ["particles", "micrographs", "movies"], true)],
      outputs: [outp("particles", "Selected particles STAR", "particles")],
    }
  ),
  spec(
    "joinstar",
    "Join STAR Files",
    "Merge",
    "teal",
    "Combine multiple particle, micrograph or movie STAR files into one (relion_star_handler).",
    2000,
    [
      sel("selectKind", "File type", "particles", ["particles", "micrographs", "movies"], { tab: "I/O" }),
      bool("randomize", "Randomise order", false, { tab: "Duplicates", advanced: true }),
      bool("removeDuplicates", "Remove duplicates", false, { tab: "Duplicates" }),
    ],
    "{n} items joined",
    "cmd",
    {
      category: "select",
      tabs: ["I/O", "Duplicates"],
      inputs: [inp("inputs", "Input STAR files (any)", ["particles", "micrographs", "movies", "star"], true)],
      outputs: [outp("output", "Joined STAR file", "star")],
    }
  ),

  /* ---------------- 2D classification ------------------------------- */
  spec(
    "class2d",
    "2D Classification",
    "LayoutGrid",
    "emerald",
    "Multi-reference 2D class averaging (relion_refine) to separate good particles from junk.",
    12000,
    [
      num("numClasses", "Number of classes (K)", 10, { step: 1, min: 1, max: 200, tab: "Optimisation" }),
      num("iterations", "Number of iterations", 12, { step: 1, min: 1, max: 50, tab: "Optimisation" }),
      num("particleDiameter", "Circular mask diameter", 180, { unit: "Å", step: 5, tab: "Optimisation" }),
      num("tau2Fudge", "Regularisation factor T", 1, { step: 0.5, min: 0.5, tab: "Optimisation", advanced: true }),
      bool("doZeroMask", "Zero the mask", true, { tab: "Optimisation", advanced: true }),
      sel("psiSampling", "In-plane sampling step", "7.5", psiOptions, { tab: "Sampling", advanced: true }),
      num("highresLimit", "High-res limit (Å)", 0, { step: 0.5, min: 0, tab: "Optimisation", advanced: true, hint: "0 = no limit" }),
    ],
    "{n} class averages",
    "core",
    {
      category: "class2d",
      tabs: ["CTF", "Optimisation", "Sampling", "Compute"],
      inputs: [inp("particles", L.particlesIn, ["particles"])],
      outputs: [
        outp("classAverages", L.classAveragesOut, "references2d"),
        outp("particles", L.optParticlesOut, "particles"),
      ],
    }
  ),

  /* ---------------- 3D classification & initial models -------------- */
  spec(
    "initialmodel",
    "3D Initial Model",
    "Layers",
    "green",
    "Generate ab-initio 3D references with the gradient-driven VDAM de-novo algorithm.",
    14000,
    [
      num("numClasses", "Number of classes (K)", 4, { min: 1, max: 20, tab: "Optimisation" }),
      sel("symmetry", "Symmetry", "D2", symmetryOptions, { tab: "Optimisation" }),
      num("iterations", "Number of VDAM iterations", 50, { step: 5, min: 5, max: 300, tab: "Optimisation" }),
      num("particleDiameter", "Circular mask diameter", 180, { unit: "Å", step: 5, tab: "Sampling" }),
      num("tau2Fudge", "Regularisation factor T", 1, { step: 0.5, min: 0.5, tab: "Optimisation", advanced: true }),
    ],
    "{n} initial models",
    "core",
    {
      category: "class3d",
      tabs: ["Optimisation", "Sampling", "Compute"],
      inputs: [inp("particles", L.particlesIn, ["particles"])],
      outputs: [outp("model", "Initial model(s) (.mrc)", "volume")],
    }
  ),
  spec(
    "class3d",
    "3D Classification",
    "Boxes",
    "green",
    "Sort particles into 3D conformational classes against a reference map.",
    14000,
    [
      num("numClasses", "Number of classes (K)", 4, { min: 1, max: 20, tab: "Optimisation" }),
      sel("symmetry", "Symmetry", "C1", symmetryOptions, { tab: "Reference" }),
      num("iterations", "Number of iterations", 25, { step: 5, min: 5, max: 100, tab: "Optimisation" }),
      num("particleDiameter", "Circular mask diameter", 180, { unit: "Å", step: 5, tab: "Sampling" }),
      num("tau2Fudge", "Regularisation factor T", 1, { step: 0.5, min: 0.5, tab: "Optimisation", advanced: true }),
    ],
    "{n} 3D classes",
    "cmd",
    {
      category: "class3d",
      tabs: ["Reference", "CTF", "Optimisation", "Sampling", "Compute"],
      inputs: [
        inp("particles", L.particlesIn, ["particles"]),
        inp("reference", L.mapIn, ["volume", "halfmap"]),
      ],
      outputs: [
        outp("model", "Class volumes (.mrc)", "volume"),
        outp("particles", L.optParticlesOut, "particles"),
      ],
    }
  ),

  /* ---------------- 3D refinement ------------------------------------ */
  spec(
    "refine3d",
    "3D Auto-Refine",
    "Gem",
    "cyan",
    "Gold-standard angular refinement (relion_refine) with FSC-driven auto-stopping or fixed iters.",
    16000,
    [
      sel("symmetry", "Symmetry", "D2", symmetryOptions, { tab: "Reference" }),
      num("iniHigh", "Initial low-pass on reference", 30, {
        unit: "Å", step: 1, min: 5, max: 60, tab: "Reference",
        hint: "reference is filtered to this resolution before the first iteration",
      }),
      num("particleDiameter", "Circular mask diameter", 180, { unit: "Å", step: 5, tab: "Sampling" }),
      bool("autoRefine", "Perform auto-refinement", false, { tab: "Auto-sampling" }),
      num("iterations", "Number of iterations", 15, { step: 1, min: 1, max: 50, tab: "Optimisation", hint: "used when auto-refine is off" }),
      num("samplingStep", "Angular sampling step", 7.5, { step: 0.5, unit: "°", min: 0.5, max: 30, tab: "Auto-sampling", advanced: true }),
      num("tau2Fudge", "Regularisation factor T", 1, { step: 0.5, min: 0.5, tab: "Optimisation", advanced: true }),
      num("padding", "Padding factor", 2, {
        step: 1, min: 1, max: 2, tab: "Compute", advanced: true,
        hint: "FFT padding 2 = accurate interpolation, 1 = 4× faster (large boxes)",
      }),
    ],
    "Refined to {n} Å",
    "core",
    {
      category: "refine",
      tabs: ["Reference", "Optimisation", "Sampling", "Auto-sampling", "Compute"],
      inputs: [
        inp("particles", L.particlesIn, ["particles"]),
        inp("reference", L.mapIn, ["volume", "halfmap"]),
      ],
      outputs: [
        outp("half1", "Unfiltered half-map 1 (.mrc)", "halfmap"),
        outp("half2", "Unfiltered half-map 2 (.mrc)", "halfmap"),
        outp("map", L.mapOut, "volume"),
        outp("particles", L.optParticlesOut, "particles"),
      ],
    }
  ),
  spec(
    "multibody",
    "Multi-Body Refinement",
    "Combine",
    "cyan",
    "Refine bodies of a multi-domain complex independently against body masks.",
    18000,
    [
      num("numBodies", "Number of bodies", 2, { min: 1, max: 20, tab: "Optimisation" }),
      sel("symmetry", "Symmetry", "C1", symmetryOptions, { tab: "Reference" }),
      num("particleDiameter", "Circular mask diameter", 180, { unit: "Å", step: 5, tab: "Sampling" }),
      num("offsetStep", "Offset search step", 2, { unit: "px", step: 1, min: 1, max: 10, tab: "Sampling", advanced: true }),
    ],
    "{n} bodies refined",
    "cmd",
    {
      category: "refine",
      tabs: ["Reference", "Optimisation", "Sampling", "Compute"],
      inputs: [
        inp("particles", L.particlesIn, ["particles"]),
        inp("reference", L.mapIn, ["volume", "halfmap"]),
      ],
      outputs: [
        outp("bodies", "Body volumes (.mrc)", "volume"),
        outp("particles", L.optParticlesOut, "particles"),
      ],
    }
  ),

  /* ---------------- 3D postprocess ----------------------------------- */
  spec(
    "maskcreate",
    "Mask Creation",
    "CircleDot",
    "slate",
    "Build a soft-edged 3D mask around the density (relion_mask_create) for FSC and validation.",
    2500,
    [
      num("threshold", "Initial binarisation threshold", 0.02, { step: 0.01, min: 0.001, tab: "Mask" }),
      num("softEdge", "Soft edge width", 6, { unit: "px", min: 1, tab: "Mask" }),
      num("lowpass", "Lowpass filter", 15, { unit: "Å", step: 5, tab: "Mask", advanced: true }),
      num("extend", "Extend initial mask", 3, { unit: "px", min: 0, tab: "Mask" }),
    ],
    "Mask created",
    "core",
    {
      category: "postprocess",
      tabs: ["Mask"],
      inputs: [inp("map", "Input map (.mrc)", ["volume", "halfmap"])],
      outputs: [outp("mask", L.maskOut, "mask")],
    }
  ),
  spec(
    "postprocess",
    "Post-Processing",
    "Sparkles",
    "pink",
    "Sharpen, mask and B-factor weight the refined half-maps (relion_postprocess) for deposition.",
    4000,
    [
      bool("autoBfac", "Estimate B-factor automatically", true, { tab: "Sharpening" }),
      num("autobLowres", "Auto-B low-res limit", 10, { unit: "Å", step: 1, tab: "Sharpening" }),
      num("adhocBfac", "Ad-hoc B-factor", -100, { step: 25, unit: "Å²", tab: "Sharpening", advanced: true, hint: "used when auto-B is off" }),
      num("randomizeFrom", "Randomize phases from", 10, { unit: "Å", step: 1, tab: "Sharpening", advanced: true }),
    ],
    "Sharpened map, {n} Å",
    "core",
    {
      category: "postprocess",
      tabs: ["Sharpening"],
      inputs: [
        inp("half1", L.half1In, ["halfmap", "volume"]),
        inp("half2", L.half2In, ["halfmap", "volume"]),
        inp("mask", L.maskIn, ["mask"]),
      ],
      outputs: [outp("map", "Sharpened map (.mrc)", "volume")],
    }
  ),
  spec(
    "localres",
    "Local Resolution",
    "Gauge",
    "pink",
    "Estimate per-voxel resolution with RELION's sliding-window postprocess or ResMap.",
    9000,
    [
      sel("method", "Method", "Relion", ["Relion", "ResMap"], { tab: "Relion" }),
      num("adhocBfac", "Ad-hoc B-factor", -100, { step: 25, tab: "Relion" }),
      num("pval", "P-value", 0.05, { step: 0.01, min: 0.01, max: 0.5, tab: "Relion", advanced: true }),
    ],
    "Local resolution to {n} Å",
    "cmd",
    {
      category: "postprocess",
      tabs: ["Relion"],
      inputs: [
        inp("half1", L.half1In, ["halfmap", "volume"]),
        inp("half2", L.half2In, ["halfmap", "volume"]),
        inp("mask", L.maskIn, ["mask"]),
      ],
      outputs: [outp("map", "Local-resolution map (.mrc)", "volume")],
    }
  ),

  /* ---------------- Polish & CTF refinement -------------------------- */
  spec(
    "polish",
    "Bayesian Polishing",
    "Wand2",
    "violet",
    "Per-particle motion correction and radiation-damage weighting (relion_motion_refine).",
    15000,
    [
      num("evalFrac", "Fourier-eval fraction", 0.5, { step: 0.05, min: 0.1, max: 0.9, tab: "Polish" }),
      num("firstFrame", "First frame", 1, { min: 1, tab: "Polish", advanced: true }),
      num("lastFrame", "Last frame", 24, { min: 1, tab: "Polish", advanced: true }),
    ],
    "Polished to {n} Å",
    "cmd",
    {
      category: "polish",
      tabs: ["Polish", "Optimisation"],
      inputs: [
        inp("particles", L.particlesIn, ["particles"]),
        inp("reference", "Postprocessed map (.mrc)", ["volume"]),
      ],
      outputs: [outp("particles", "Polished (shiny) particles STAR", "particles")],
    }
  ),
  spec(
    "ctfrefine",
    "CTF Refinement",
    "Focus",
    "amber",
    "Per-particle defocus, astigmatism and higher-order aberration refinement (relion_ctf_refine).",
    10000,
    [
      num("minres", "Minimum resolution to fit", 20, { unit: "Å", step: 5, tab: "CTF" }),
      bool("fitDefocus", "Fit per-particle defocus", true, { tab: "CTF" }),
      bool("fitAstig", "Fit per-particle astigmatism", false, { tab: "CTF" }),
      bool("beamtilt", "Fit beam tilt", false, { tab: "CTF", advanced: true }),
    ],
    "CTF refined, {n} particles",
    "cmd",
    {
      category: "polish",
      tabs: ["CTF", "Optimisation", "Compute"],
      inputs: [
        inp("particles", L.particlesIn, ["particles"]),
        inp("reference", L.mapIn, ["volume", "halfmap"]),
      ],
      outputs: [outp("particles", "CTF-refined particles STAR", "particles")],
    }
  ),

  /* ---------------- External / deep learning ------------------------- */
  spec(
    "dynamight",
    "DynaMight",
    "Waves",
    "violet",
    "Continuous-flexibility analysis with the DynaMight neural network (python + torch required).",
    20000,
    [
      num("nGaussians", "Number of Gaussians", 10000, { step: 1000, min: 1000, tab: "Optimisation" }),
      num("regFactor", "Regularization factor", 1, { step: 0.1, min: 0.2, tab: "Optimisation" }),
      num("nThreads", "Threads", 4, { min: 1, max: 32, tab: "Compute" }),
    ],
    "{n} deformations optimised",
    "external",
    {
      category: "external",
      tabs: ["Optimisation", "Compute"],
      inputs: [inp("particles", L.particlesIn, ["particles"])],
      outputs: [outp("particles", "Displacement-encoded particles STAR", "particles")],
    }
  ),
  spec(
    "modelangelo",
    "ModelAngelo",
    "Dna",
    "violet",
    "De-novo atomic model building into a cryo-EM map with ModelAngelo (python required).",
    22000,
    [
      sel("buildMode", "Build mode", "build_no_seq", ["build_no_seq", "build"], { tab: "Build" }),
      sel("gpuId", "GPU", "0", ["0", "1", "2", "3"], { tab: "Compute" }),
      bool("hhsearch", "HMM sequence search", false, { tab: "Build", advanced: true }),
    ],
    "{n} residues built",
    "external",
    {
      category: "external",
      tabs: ["Build", "Compute"],
      inputs: [inp("tomograms", "Input map / tomogram (.mrc)", ["tomograms", "volume", "halfmap"])],
      outputs: [outp("models", "Built models (mmCIF/PDB)", "star")],
    }
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
      num("pixelSize", "Nominal pixel size", 1.35, { unit: "Å", step: 0.01, tab: "Tilt series" }),
      num("voltage", "Voltage", 300, { unit: "kV", tab: "Tilt series" }),
      num("cs", "Spherical aberration", 2.7, { unit: "mm", step: 0.1, tab: "Tilt series" }),
      num("ampContrast", "Amplitude contrast", 0.1, { step: 0.01, min: 0.01, max: 0.3, tab: "Tilt series" }),
      num("doseRate", "Dose per tilt image", 3, { unit: "e⁻/Å²", step: 0.1, tab: "Tilt series" }),
    ],
    "{n} tilt series imported",
    "cmd",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["Tilt series"],
      inputs: [],
      outputs: [outp("tiltseries", "Tilt-series STAR file (.star)", "tiltseries")],
    }
  ),
  spec(
    "tomo_aligntiltseries",
    "Tomo: Align Tilt Series",
    "Move3d",
    "cyan",
    "Align tilt series with IMOD fiducials, IMOD patch-tracking or AreTomo2.",
    12000,
    [
      sel("method", "Method", "AreTomo2", ["AreTomo2", "IMOD fiducials", "IMOD patch-track"], { tab: "Motion" }),
      num("thickness", "Tomogram thickness", 300, { unit: "nm", step: 10, tab: "Motion" }),
      num("fiducialDiameter", "Fiducial diameter", 10, { unit: "nm", step: 1, tab: "Motion" }),
    ],
    "{n} tilt series aligned",
    "cmd",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["Motion"],
      inputs: [inp("tiltseries", L.tiltIn, ["tiltseries"])],
      outputs: [outp("tiltseries", L.tiltOut, "tiltseries")],
    }
  ),
  spec(
    "tomo_tomograms",
    "Tomo: Reconstruct Tomograms",
    "Box",
    "cyan",
    "Back-project aligned tilt series into 3D tomograms (relion_tomo_reconstruct_tomogram).",
    15000,
    [
      num("binnedAngpix", "Binned pixel size", 10, { unit: "Å", step: 1, min: 1, tab: "Reconstruct" }),
      num("xdim", "Width (x)", 1024, { step: 64, min: 256, tab: "Reconstruct" }),
      num("zdim", "Thickness (z)", 300, { unit: "px", step: 50, min: 50, tab: "Reconstruct" }),
    ],
    "{n} tomograms reconstructed",
    "cmd",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["Reconstruct"],
      inputs: [inp("tiltseries", L.tiltIn, ["tiltseries"])],
      outputs: [outp("tomograms", L.tomoOut, "tomograms")],
    }
  ),
  spec(
    "tomo_ctfrefine",
    "Tomo: CTF Refinement",
    "Focus",
    "amber",
    "Refine tilt-series defoci and signal scale against reference maps (relion_tomo_refine_ctf).",
    12000,
    [
      num("boxSize", "Box size for estimation", 128, { step: 16, min: 32, tab: "CTF" }),
      num("focusRange", "Defocus search range", 3000, { unit: "Å", step: 500, tab: "CTF" }),
      bool("doRegDef", "Defocus regularisation", false, { tab: "CTF", advanced: true }),
    ],
    "CTF refined for {n} tilt series",
    "cmd",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["CTF", "Optimisation"],
      inputs: [
        inp("tiltseries", L.tiltIn, ["tiltseries"]),
        inp("reference", "Reference 3D map", ["volume", "halfmap"]),
      ],
      outputs: [outp("tiltseries", "CTF-refined tilt-series STAR", "tiltseries")],
    }
  ),
  spec(
    "tomo_exclude",
    "Tomo: Exclude Tilt Images",
    "EyeOff",
    "slate",
    "Interactively exclude bad tilt images (Napari-based relion_python_tomo_exclude_tilt_images).",
    3000,
    [
      num("cacheSize", "Cached tilt series", 5, { min: 1, max: 10, tab: "Others" }),
      num("maxTilt", "Exclude above tilt", 60, { unit: "°", step: 5, tab: "Others" }),
      num("minFrames", "Minimum frames kept", 1, { min: 1, max: 40, tab: "Others" }),
    ],
    "{n} tilt images excluded",
    "cmd",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["Others"],
      inputs: [inp("tiltseries", L.tiltIn, ["tiltseries"])],
      outputs: [outp("tiltseries", "Filtered tilt-series STAR", "tiltseries")],
    }
  ),
  spec(
    "tomo_polish",
    "Tomo: Polishing",
    "Wand2",
    "violet",
    "Frame-series alignment / per-particle motion polishing (relion_tomo_align).",
    16000,
    [
      num("boxSize", "Box size", 128, { step: 16, min: 32, tab: "Polish" }),
      num("maxError", "Max alignment error", 5, { unit: "px", step: 1, tab: "Polish" }),
      sel("motionMode", "Motion mode", "motion", ["motion", "shift_only"], { tab: "Polish" }),
    ],
    "Polished {n} particles",
    "cmd",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["Polish"],
      inputs: [
        inp("tiltseries", L.tiltIn, ["tiltseries"]),
        inp("particles", "Subtomogram particles", ["particles"]),
      ],
      outputs: [outp("tiltseries", "Polished tilt-series STAR", "tiltseries")],
    }
  ),
  spec(
    "tomo_reconstruct",
    "Tomo: Reconstruct Subtomos",
    "Layers",
    "cyan",
    "Reconstruct pseudo-subtomograms from aligned tilt series (relion_tomo_reconstruct_particle).",
    18000,
    [
      num("boxSize", "Box size", 128, { step: 16, min: 32, tab: "Reconstruct" }),
      num("binning", "Binning factor", 1, { step: 0.5, min: 0.5, max: 16, tab: "Reconstruct" }),
      num("snr", "SNR", 0.001, { step: 0.001, min: 0.0001, tab: "Reconstruct", advanced: true }),
    ],
    "{n} subtomograms reconstructed",
    "cmd",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["Reconstruct"],
      inputs: [
        inp("tiltseries", L.tiltIn, ["tiltseries"]),
        inp("coords", "Particle picks / poses", ["coords", "particles"]),
      ],
      outputs: [outp("particles", "Subtomogram STAR (.star + .mrcs)", "particles")],
    }
  ),
  spec(
    "tomo_denoise",
    "Tomo: Denoise",
    "Brush",
    "violet",
    "Denoise tomograms with cryoCARE train/predict (external python environment).",
    14000,
    [
      sel("mode", "Mode", "cryoCARE:train", ["cryoCARE:train", "cryoCARE:predict"], { tab: "Denoise" }),
      num("subvolumeDimensions", "Sub-volume size", 72, { unit: "px", step: 8, min: 64, tab: "Denoise" }),
      num("trainingSubvolumes", "Sub-volumes per tomo", 1200, { step: 100, min: 100, tab: "Denoise" }),
    ],
    "{n} tomograms denoised",
    "external",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["Denoise"],
      inputs: [inp("tomograms", L.tomoIn, ["tomograms"])],
      outputs: [outp("tomograms", "Denoised tomograms STAR", "tomograms")],
    }
  ),
  spec(
    "tomo_picks",
    "Tomo: Picking",
    "Crosshair",
    "rose",
    "Pick particles/filaments on tomograms in Napari (relion_python_tomo_pick + get_particle_poses).",
    8000,
    [
      sel("pickMode", "Pick mode", "particles", ["particles", "filaments", "surfaces", "spheres"], { tab: "Picking" }),
      num("spacing", "Spacing", 20, { unit: "Å", step: 5, min: 5, tab: "Picking" }),
      num("cacheSize", "Cached tilt series", 5, { min: 1, max: 10, tab: "Picking", advanced: true }),
    ],
    "{n} picks imported",
    "external",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["Picking"],
      inputs: [inp("tomograms", L.tomoIn, ["tomograms"])],
      outputs: [outp("coords", "Picked positions (poses)", "coords")],
    }
  ),
  spec(
    "tomo_extract",
    "Tomo: Extract Subtomos",
    "Crop",
    "orange",
    "Extract pseudo-subtomogram boxes at picked positions (relion_tomo_subtomo).",
    9000,
    [
      num("boxSize", "Box size", 128, { step: 16, min: 32, tab: "extract" }),
      num("binning", "Binning factor", 1, { step: 0.5, min: 0.5, max: 16, tab: "extract" }),
      num("maxDose", "Maximum dose", 60, { unit: "e⁻/Å²", step: 5, tab: "extract" }),
    ],
    "{n} subtomos extracted",
    "cmd",
    {
      category: "tomo",
      group: "Tomography",
      tabs: ["extract"],
      inputs: [
        inp("tomograms", L.tomoIn, ["tomograms"]),
        inp("coords", "Particle picks / poses", ["coords"]),
      ],
      outputs: [outp("particles", "Subtomogram particles STAR", "particles")],
    }
  ),

  /* ------------------------------------------------------------------ */
  /* External (shared)                                                   */
  /* ------------------------------------------------------------------ */
  spec(
    "external",
    "External (custom)",
    "Terminal",
    "slate",
    "Run any external command line inside the pipeline, exporting RELION metadata as variables.",
    5000,
    [
      sel("interpreter", "Interpreter", "bash", ["bash", "sh"], { tab: "Running" }),
      num("timeout", "Timeout", 3600, { unit: "s", step: 60, min: 60, tab: "Running" }),
      bool("exportMeta", "Export metadata", true, { tab: "Others", advanced: true }),
    ],
    "External command done",
    "cmd",
    {
      category: "external",
      tabs: ["Running", "Others"],
      inputs: [inp("input", "Any input (optional)", ["*"], true)],
      outputs: [outp("output", "External output", "star")],
    }
  ),
];

/** Ordered group labels for stats. */
export const JOB_GROUPS: string[] = ["SPA", "Tomography"];

const TYPE_MAP = new Map(JOB_TYPES.map((t) => [t.key, t]));

export function jobType(key: string): JobTypeSpec | undefined {
  return TYPE_MAP.get(key);
}

/** Default parameter map for a job type (used by seeding + forms). */
export function defaultParams(key: string): Record<string, ParamValue> {
  const t = jobType(key);
  if (!t) return {};
  const out: Record<string, ParamValue> = {};
  for (const p of t.params) out[p.key] = p.default;
  return out;
}

/** All tabs declared by the spec + any param tabs, in order, deduped. */
export function tabsFor(t: JobTypeSpec | undefined): string[] {
  if (!t) return [];
  const tabs: string[] = [];
  for (const name of [...t.tabs, ...t.params.map((p) => p.tab ?? "")]) {
    if (name && !tabs.includes(name)) tabs.push(name);
  }
  return tabs.length > 0 ? tabs : ["Parameters"];
}

/* ------------------------------------------------------------------ */
/* Port helpers                                                        */
/* ------------------------------------------------------------------ */

/** Y coordinate of the i-th port (of count) on a card edge. */
export function portY(i: number, count: number): number {
  if (count <= 1) return CARD_H / 2;
  return (CARD_H * (i + 1)) / (count + 1);
}

/** Can the output port of one job type feed the input port of another? */
export function portsCompatible(
  fromType: string,
  fromPort: string,
  toType: string,
  toPort: string
): boolean {
  const from = jobType(fromType);
  const to = jobType(toType);
  const o = from?.outputs.find((p) => p.name === fromPort);
  const i = to?.inputs.find((p) => p.name === toPort);
  if (!o || !i) return false;
  const accepts = i.accepts ?? ["*"];
  return accepts.includes("*") || (o.kind != null && accepts.includes(o.kind));
}

/**
 * Default (first compatible) output→input port pair between two job types.
 * Used to give legacy DB edges a sensible port mapping.
 */
export function defaultPorts(
  fromType: string,
  toType: string
): { fromPort?: string; toPort?: string } {
  const from = jobType(fromType);
  const to = jobType(toType);
  if (!from || !to) return {};
  for (const o of from.outputs) {
    for (const i of to.inputs) {
      const accepts = i.accepts ?? ["*"];
      if (accepts.includes("*") || (o.kind != null && accepts.includes(o.kind))) {
        return { fromPort: o.name, toPort: i.name };
      }
    }
  }
  return {
    fromPort: from.outputs[0]?.name,
    toPort: to.inputs[0]?.name,
  };
}

/* ------------------------------------------------------------------ */
/* Legacy param coercion                                               */
/* ------------------------------------------------------------------ */

/**
 * Coerce a stored raw value into the schema-typed value. Handles legacy
 * "true"/"false" strings for bool params and stringified numbers.
 */
export function coerceParam(p: ParamSchema, raw: unknown): ParamValue {
  if (p.type === "bool") {
    if (typeof raw === "boolean") return raw;
    if (raw === "true") return true;
    return p.default;
  }
  if (p.type === "number") {
    const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
    return Number.isFinite(n) ? n : p.default;
  }
  if (typeof raw === "string" && p.options?.includes(raw)) return raw;
  return p.default;
}

/** spec defaults overlaid with stored params (coerced). */
export function mergedParams(
  typeKey: string,
  stored: Record<string, ParamValue> | null | undefined
): Record<string, ParamValue> {
  const t = jobType(typeKey);
  const out: Record<string, ParamValue> = {};
  for (const p of t?.params ?? []) {
    out[p.key] = coerceParam(p, stored?.[p.key]);
  }
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

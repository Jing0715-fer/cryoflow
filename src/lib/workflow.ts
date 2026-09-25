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

import type { JobTier, JobTypeSpec, ParamSchema, ParamType, ParamValue, PortKind, PortSpec } from "./types";

/**
 * Fixed job card geometry (px, in workspace coordinates).
 *
 * t349 — 240×112 (was 220×96): the card grew one comfortable line of
 * height so the result/error line can wrap (a truncated single line hid
 * the failure reason — the one fact the user needs when a card turns
 * rose) and 20px of width for the name and the status band. Saved
 * layouts stay readable: auto-arrange pitch is CARD_W+GAP_X (100) /
 * CARD_H+GAP_Y (48), so grown cards still leave 80px/32px corridors.
 * Every consumer (ports, wires, minimap, print fit, spotlight cone,
 * band select, focus math) derives from these constants — nothing else
 * hardcodes the size.
 */
export const CARD_W = 240;
export const CARD_H = 112;

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

/** Free-form text parameter (comma lists, names, engine directives). */
const txt = (
  key: string,
  label: string,
  def: string,
  extra?: Partial<ParamSchema>
): ParamSchema => ({ key, label, type: "text", default: def, ...extra });

/** Filesystem folder parameter — rendered with a native Browse… dialog. */
const pth = (
  key: string,
  label: string,
  extra?: Partial<ParamSchema>
): ParamSchema => ({ key, label, type: "path", default: "", ...extra });

const symmetryOptions = ["C1", "C2", "C4", "D2", "T", "I"];
// t386 — "6" joins the list: RELION's own psi_sampling GUI default is the
// free-form 6° (pipeline_jobs.cpp:3240), so the curated select offers it and
// defaults to it.
const psiOptions = ["30", "15", "7.5", "6", "3.75", "1.875"];

/** t352 — healpix angular-sampling options exactly as RELION's own GUI lists
 * them (pipeline_jobs.h job_sampling_options): the value is the DEGREE step,
 * the order RELION wants on the command line is the list index + 1. */
const healpixOptions = ["30", "15", "7.5", "3.7", "1.8", "0.9", "0.5"];
const samplingSel = (key: string, label: string, def: string, extra?: Partial<ParamSchema>): ParamSchema =>
  sel(key, label, def, ["auto", ...healpixOptions], extra);

/** t352 — the GUI-parity compute-tab trio + scratch companion, shared verbatim
 * by every refine-family spec (labels mirror RELION's Compute tab; the flags
 * each one toggles are noted in the label so the preview stays honest). */
const computeParity = (tab = "Compute"): ParamSchema[] => [
  num("keepFreeScratch", "Keep free on scratch (GB, --keep_free_scratch)", 0, {
    step: 1, min: 0, max: 200, tab, advanced: true,
    hint: "only with a scratch dir set — RELION refuses to fill the scratch volume beyond this free floor (RELION's own default is 10 GB)",
  }),
  bool("parallelDiscIo", "Parallel disc I/O", true, {
    tab, advanced: true,
    hint: "off = --no_parallel_disc_io — all ranks read the particle stacks through one stream (sometimes kinder to a strangled NFS server)",
  }),
  bool("prereadImages", "Pre-read particles into RAM (--preread_images)", false, {
    tab, advanced: true,
    hint: "all particle images are read into RAM once — a big win on slow NFS, needs roughly the size of the data set free RAM",
  }),
  bool("combineThruDisc", "Combine weights via disc", false, {
    tab, advanced: true,
    hint: "RELION's own GUI default is OFF (it emits --dont_combine_weights_via_disc) — weights are combined through memory, saving disc round-trips on shared filesystems",
  }),
  txt("extraArgs", "Additional RELION arguments", "", {
    tab, advanced: true,
    hint: "space-separated --flag value tokens appended verbatim (e.g. --verb 1) — anything the RELION GUI exposes that this panel doesn't name. Validated against RELION 5.0's verified relion_refine option set: a typo fails the run before it burns GPU hours",
  }),
];
const scratchHint =
  "empty = off. A compute-node-local path — e.g. /ssd_cache (a node-local SSD) or /tmp — RELION copies the particle stacks there once, sparing every iteration the NFS re-read. Often the largest I/O lever on NFS-backed clusters. Needs ~10 GB free (RELION's own --keep_free_scratch floor)";

/**
 * t381 — the 3D Helix tab, RELION 5 master's own dialect (gui_jobwindow.cpp
 * initialiseClass3DWindow / initialiseAutorefineWindow, pipeline_jobs.cpp
 * lines 3741-3802 + the argv construction at 4031-4110): the do_helix gate,
 * the tube/angular family, the nested do_apply_helical_symmetry group with
 * its twist/rise/z-percentage trio, and the doubly-nested local-symmetry
 * search ranges. Defaults are RELION's verbatim (-1 diameters, "15"/"10"
 * angular ranges, z 30%, search bounds "0").
 */
const helicalParams = (): ParamSchema[] => [
  bool("doHelical", "Do helical reconstruction?", false, {
    tab: "Helix",
    hint: "RELION GUI's Helix tab (--helix) — 3D helical reconstruction: the reference is a helical segment and symmetry is applied along Z",
  }),
  num("helicalTubeInnerDiameter", "Tube diameter — inner (Å)", -1, {
    step: 1, tab: "Helix",
    showIf: { param: "doHelical", equals: true },
    hint: "inner diameter of the reconstructed helix across Z (--helical_inner_diameter); -1 = RELION's default (a full box)",
  }),
  num("helicalTubeOuterDiameter", "Tube diameter — outer (Å)", -1, {
    step: 1, tab: "Helix",
    showIf: { param: "doHelical", equals: true },
    hint: "outer diameter of the reconstructed helix across Z (--helical_outer_diameter)",
  }),
  num("rangeRotHelical", "Angular search range — rot (°)", -1, {
    step: 1, tab: "Helix", advanced: true,
    showIf: { param: "doHelical", equals: true },
    hint: "local rot searches within ± this (--sigma_rot = value/3); -1 = RELION's default",
  }),
  num("rangeTiltHelical", "Angular search range — tilt (°)", 15, {
    step: 1, tab: "Helix", advanced: true,
    showIf: { param: "doHelical", equals: true },
    hint: "local tilt searches within ± this (--sigma_tilt = value/3) — helical segments arrive with strong tilt priors",
  }),
  num("rangePsiHelical3d", "Angular search range — psi (°)", 10, {
    step: 1, tab: "Helix", advanced: true,
    showIf: { param: "doHelical", equals: true },
    hint: "local psi searches within ± this (--sigma_psi = value/3)",
  }),
  num("helicalRangeDistance", "Range factor of local averaging", -1, {
    step: 0.1, min: 1, max: 5, tab: "Helix", advanced: true,
    showIf: { param: "doHelical", equals: true },
    hint: "local averaging of orientations/translations within ± this × box size; segments from the same tube also share polarity (--helical_sigma_distance = value/3); -1 = off",
  }),
  bool("keepTiltPriorFixed", "Keep tilt-prior fixed", true, {
    tab: "Helix", advanced: true,
    showIf: { param: "doHelical", equals: true },
    hint: "the tilt prior never moves during optimisation (--helical_keep_tilt_prior_fixed); No lets it follow each segment's optimal tilt",
  }),
  bool("doApplyHelicalSymmetry", "Apply helical symmetry?", true, {
    tab: "Helix",
    showIf: { param: "doHelical", equals: true },
    hint: "apply helical symmetry every iteration; No = --ignore_helical_symmetry (a project just started, symmetry unknown)",
  }),
  num("helicalNrAsu", "Number of unique asymmetrical units", 1, {
    step: 1, min: 1, max: 100, tab: "Helix",
    showIf: { param: "doApplyHelicalSymmetry", equals: true },
    hint: "helical ASUs per segment box (--helical_nr_asu); the inter-box distance from picking should equal rise × ASUs / pixel size",
  }),
  num("helicalTwistInitial", "Initial helical twist (°)", 0, {
    step: 0.01, tab: "Helix",
    showIf: { param: "doApplyHelicalSymmetry", equals: true },
    hint: "positive = right-handed (--helical_twist_initial)",
  }),
  num("helicalRiseInitial", "Initial helical rise (Å)", 0, {
    step: 0.01, tab: "Helix",
    showIf: { param: "doApplyHelicalSymmetry", equals: true },
    hint: "positive value in Angstroms (--helical_rise_initial)",
  }),
  num("helicalZPercentage", "Central Z length (%)", 30, {
    step: 1, min: 5, max: 80, tab: "Helix", advanced: true,
    showIf: { param: "doApplyHelicalSymmetry", equals: true },
    hint: "the central Z slice of the box that carries real signal (--helical_z_percentage); orientation-search inaccuracies degrade the rest",
  }),
  bool("doLocalSearchHelicalSymmetry", "Do local searches of symmetry?", false, {
    tab: "Helix",
    showIf: { param: "doApplyHelicalSymmetry", equals: true },
    hint: "search twist and rise locally within the ranges below (--helical_symmetry_search) instead of fixing them at the initial values",
  }),
  num("helicalTwistMin", "Helical twist search — Min (°)", 0, {
    step: 0.01, tab: "Helix",
    showIf: { param: "doLocalSearchHelicalSymmetry", equals: true },
    hint: "--helical_twist_min",
  }),
  num("helicalTwistMax", "Helical twist search — Max (°)", 0, {
    step: 0.01, tab: "Helix",
    showIf: { param: "doLocalSearchHelicalSymmetry", equals: true },
    hint: "--helical_twist_max",
  }),
  num("helicalTwistInistep", "Helical twist search — Step (°)", 0, {
    step: 0.01, tab: "Helix", advanced: true,
    showIf: { param: "doLocalSearchHelicalSymmetry", equals: true },
    hint: "initial search step (--helical_twist_inistep); 0 = RELION's default",
  }),
  num("helicalRiseMin", "Helical rise search — Min (Å)", 0, {
    step: 0.01, tab: "Helix",
    showIf: { param: "doLocalSearchHelicalSymmetry", equals: true },
    hint: "--helical_rise_min",
  }),
  num("helicalRiseMax", "Helical rise search — Max (Å)", 0, {
    step: 0.01, tab: "Helix",
    showIf: { param: "doLocalSearchHelicalSymmetry", equals: true },
    hint: "--helical_rise_max",
  }),
  num("helicalRiseInistep", "Helical rise search — Step (Å)", 0, {
    step: 0.01, tab: "Helix", advanced: true,
    showIf: { param: "doLocalSearchHelicalSymmetry", equals: true },
    hint: "initial search step (--helical_rise_inistep); 0 = RELION's default",
  }),
];

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
  { key: "orientation", label: "Orientation", hint: "Symmetry expansion · rebalancing" },
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
  model: { dot: "bg-fuchsia-500", label: "text-fuchsia-700 dark:text-fuchsia-300", text: "Fuchsia" },
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

const outp = (
  name: string,
  label: string,
  kind: PortKind,
  when?: (params: Record<string, ParamValue>) => boolean
): PortSpec => ({ name, label, kind, ...(when ? { when } : {}) });

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
    "Import Movies / Micrographs / Particles",
    "FolderInput",
    "teal",
    "Ingest movies, micrographs or a particles STAR into the project as a RELION 5 optics-group STAR file.",
    2000,
    [
      sel("nodeType", "Node type", "micrographs", ["micrographs", "movies", "particles"], {
        hint: "RELION-style: what are these files? Micrographs (motion-corrected, CTF-ready) feed CTF directly; Movies (raw frame stacks) need MotionCorr first; Particles imports an existing particles .star.",
        tab: "Movies/mics",
      }),
      pth("micrographsPath", "Files — folder, pattern or file list", {
        hint: "RELION-style: pick a folder (imports every image inside), a wildcard pattern (/data/movies/*.tiff — * and ? allowed), Browse → Files to multi-select, or — with Node type Particles — a particles .star. Local drives and WSL paths both work (/mnt/c/… or C:\\…).",
        tab: "Movies/mics",
        filePick: true,
      }),
      num("pixelSize", "Pixel size", 1.77, { unit: "Å", min: 0.1, step: 0.01, tab: "Movies/mics" }),
      num("voltage", "Voltage", 300, { unit: "kV", tab: "Movies/mics" }),
      num("cs", "Spherical aberration", 2.7, { unit: "mm", step: 0.1, tab: "Movies/mics" }),
      num("ampContrast", "Amplitude contrast", 0.1, { step: 0.01, min: 0.01, max: 0.3, tab: "Movies/mics" }),
      num("totalDose", "Total exposure dose", 25, { unit: "e⁻/Å²", step: 0.5, advanced: true, tab: "Movies/mics" }),
      bool("negativeStain", "Negative-stain images (particles appear white)", false, {
        tab: "Movies/mics",
        hint: "Cryo (default): protein is denser than ice — particles are DARK in micrographs and below-mean in class averages, so displays AUTO-INVERT them to the familiar white-on-black (RELION convention). Negative stain: heavy metal darkens the background and particles stay BRIGHT — checking this pins every downstream gallery, particle and map render to the no-flip polarity.",
      }),
    ],
    "{n} micrographs imported",
    "core",
    {
      category: "import",
      tabs: ["Movies/mics"],
      inputs: [],
      // t315 — one visible output port per Node type (RELION's import
      // semantics): Micrographs → CTF can consume directly; Movies → only
      // MotionCorr accepts (CTF's port refuses the movies kind, exactly as
      // RELION's pipeline typing does); Particles → the classification and
      // selection family consumes it.
      outputs: [
        outp(
          "micrographs",
          "Micrographs STAR (motion-corrected)",
          "micrographs",
          (p) => p.nodeType !== "movies" && p.nodeType !== "particles"
        ),
        outp("movies", "Movies STAR (raw frame stacks)", "movies", (p) => p.nodeType === "movies"),
        outp("particles", "Particles STAR", "particles", (p) => p.nodeType === "particles"),
      ],
    }
  ),

  /* ---------------- Import Map -------------------------------------- */
  spec(
    "mapimport",
    "Import Map",
    "Box",
    "teal",
    "Import a 3D map (.mrc) as a reference for classification or refinement — RELION's import-map workflow, and the landing pad for sub-volume crops sent from the 3D viewer (the box-subregion chain: crop → focused processing).",
    500,
    [
      pth("mapPath", "Map file (.mrc)", {
        hint: "Pick the map to import — a standalone .mrc volume, or a sub-volume crop that lives in another job's SubVolumes folder (the 3D viewer's send-to-new-job writes there).",
        tab: "Map",
        filePick: true,
      }),
    ],
    "map imported",
    "core",
    {
      category: "import",
      tabs: ["Map"],
      // the port says what the crop IS derived from (a refined map), not
      // what the job consumes at run time — the map arrives via the
      // mapPath param, engine-native, no resolveInputs gate in the way
      inputs: [inp("map", L.mapIn, ["volume"])],
      outputs: [outp("model_mrc", "Reference map (.mrc)", "volume")],
    }
  ),

  /* ---------------- CryoSPARC → RELION (t336) ----------------------- */
  spec(
    "cs2star",
    "CryoSPARC → RELION",
    "ArrowLeftRight",
    "teal",
    "Convert a CryoSPARC job's .cs particle dataset into a RELION 5 particles.star — alignments (Rodrigues → Euler), CTF, optics — and link ONLY the referenced particle stacks (.mrc → .mrcs names) on the cluster, so every downstream job consumes them directly. On a cluster connection the conversion runs ON the cluster itself: the parameters are set here, a self-contained converter script (the same pyem-verified field mapping, needs only python3+numpy) runs there, and the star is written straight to its cluster home — the .cs datasets and the star never cross the wire. Clusters without python3+numpy fall back to the engine-native lane (download → convert locally → upload).",
    3000,
    [
      pth("csPath", "CryoSPARC job folder (J###) or particles.cs", {
        hint: "On a cluster project: the CryoSPARC job folder (the J### directory holding extracted_particles.cs / cryosparc_*_particles.cs — its newest particles.cs + first passthrough are used) or a .cs file directly. The referenced stacks are linked under this project's micrographs/ tree — only the ones the star actually references, not every .mrc in the extract dir.",
        tab: "Source",
        filePick: true,
      }),
      bool("invertY", "Invert particle Y coordinates", false, {
        tab: "Source",
        hint: "CryoSPARC's coordinate origin is bottom-left, RELION's top-left. OFF matches the reference script's --inverty behavior (particles imported INTO cryoSPARC from RELION coordinates already speak RELION's convention); turn ON for sets picked inside cryoSPARC whose coordinates look mirrored.",
      }),
      num("pixelSize", "Pixel size fallback", 1, { unit: "Å", min: 0.1, step: 0.01, advanced: true, tab: "Source", hint: "Used only when the .cs carries no blob/psize_A field" }),
      num("voltage", "Voltage fallback", 300, { unit: "kV", advanced: true, tab: "Source", hint: "Used only when the .cs carries no ctf/accel_kv" }),
      num("cs", "Spherical aberration fallback", 2.7, { unit: "mm", step: 0.1, advanced: true, tab: "Source" }),
      num("ampContrast", "Amplitude contrast fallback", 0.1, { step: 0.01, min: 0.01, max: 0.3, advanced: true, tab: "Source" }),
    ],
    "{n} particles converted",
    "core",
    {
      category: "import",
      tabs: ["Source"],
      inputs: [],
      outputs: [outp("particles", "Particles STAR (converted)", "particles")],
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
    "Reference-free Laplacian-of-Gaussian picking, template matching with 2D references, or deep-learning picking with the Topaz wrapper (general or self-trained model).",
    7000,
    [
      sel("pickingMethod", "Picking method", "Laplacian of Gaussian", ["Laplacian of Gaussian", "References", "Topaz"], {
        tab: "autopicking",
        hint: "LoG needs no references — pick straight after CTF; it is CPU-only (RELION refuses --gpu on it, so the cluster dispatch requests no GPUs). References needs Class2D averages and runs on GPU. Topaz is a CNN picker (needs the topaz python module in RELION's env).",
      }),
      num("logDiamMin", "LoG min particle diameter", 150, { unit: "Å", step: 5, tab: "Laplacian", hint: "smallest blob the DoG filter responds to — the tutorial's 150 Å" }),
      num("logDiamMax", "LoG max particle diameter", 180, { unit: "Å", step: 5, tab: "Laplacian", hint: "largest blob the DoG filter responds to — the tutorial's 180 Å" }),
      num("logAdjustThreshold", "LoG adjust threshold", 0, { step: 0.05, tab: "Laplacian", hint: "positive picks fewer, negative picks more" }),
      num("logUpperThreshold", "LoG upper threshold limit", 999, { step: 1, min: 999, tab: "Laplacian", advanced: true, hint: "RELION's own default 999 = effectively disabled (discards picks whose LoG response is this many σ above the mean)" }),
      bool("logInvert", "Particles are white (not black)", false, { tab: "Laplacian", advanced: true }),
      num("particleDiameter", "Particle diameter (pick mask)", 180, { unit: "Å", step: 5, tab: "References" }),
      num("lowpass", "Lowpass filter for references", 20, { unit: "Å", step: 5, tab: "References" }),
      num("threshold", "Picking threshold (References mode)", 0.05, { step: 0.01, min: 0, max: 1, tab: "autopicking", hint: "RELION's own default — lower picks more (and more junk)" }),
      num("minDistance", "Minimum inter-particle distance", 100, { unit: "Å", step: 10, min: 0, tab: "autopicking", advanced: true }),
      num("maxStddevNoise", "Maximum stddev of noise", 1.1, { step: 0.02, min: 0.9, max: 1.5, tab: "autopicking", advanced: true, hint: "RELION's own default — rejects picks in carbon / noisy areas" }),
      num("topazNrParticles", "Topaz: expected particles per micrograph", 300, { step: 10, min: 1, tab: "Topaz", hint: "the tutorial's recall target — steers the CNN's threshold calibration" }),
      num("topazThreshold", "Topaz: picking threshold", -6, { step: 0.5, tab: "Topaz", hint: "lower (more negative) picks more candidates" }),
      num("topazDiameter", "Topaz: particle diameter", 180, { unit: "Å", step: 5, min: 0, tab: "Topaz", hint: "sets the extract radius together with the pixel size" }),
      num("topazDownscale", "Topaz: downscale factor", -1, { step: 1, min: -1, tab: "Topaz", advanced: true, hint: "-1 = automatic (from particle size)" }),
      num("topazWorkers", "Topaz: workers", 1, { step: 1, min: 1, tab: "Topaz", advanced: true }),
      txt("topazArgs", "Topaz: extra arguments", "", { tab: "Topaz", advanced: true, hint: "raw extras passed to the topaz wrapper, e.g. --device cpu" }),
    ],
    "{n} particles picked",
    "cmd",
    {
      category: "picking",
      tabs: ["Laplacian", "References", "autopicking", "Topaz"],
      inputs: [
        inp("micrographs", L.micIn, ["micrographs"]),
        inp("references", "2D references (References mode)", ["references2d"]),
        inp("topazModel", "Trained Topaz model (optional — Topaz mode)", ["model"]),
      ],
      outputs: [outp("coords", L.coordsOut, "coords")],
    }
  ),
  spec(
    "topaztrain",
    "Topaz Training",
    "GraduationCap",
    "rose",
    "Train a Topaz CNN picking model on manually picked coordinates (cross-validated train/test split), then connect the trained model into Auto-picking's Topaz mode to replace the general model.",
    60000,
    [
      num("topazNrParticles", "Topaz: expected particles per micrograph", 200, { step: 10, min: 1, tab: "Training", hint: "recall target used while extracting training windows" }),
      num("topazThreshold", "Topaz: picking threshold", -6, { step: 0.5, tab: "Training", hint: "candidate threshold for training-window extraction" }),
      num("topazDiameter", "Topaz: particle diameter", 180, { unit: "Å", step: 5, min: 0, tab: "Training", hint: "sets the extraction radius together with the pixel size" }),
      num("topazTestRatio", "Topaz: test-set ratio", 0.2, { step: 0.05, min: 0, max: 0.9, tab: "Training", hint: "fraction of picks held out for cross-validation — the loss curve on this set tells you when to stop" }),
      num("topazDownscale", "Topaz: downscale factor", -1, { step: 1, min: -1, tab: "Advanced", advanced: true, hint: "-1 = automatic (from particle size)" }),
      num("topazWorkers", "Topaz: workers", 1, { step: 1, min: 1, tab: "Advanced", advanced: true, hint: "parallel topaz train workers" }),
      txt("topazArgs", "Topaz: extra arguments", "", { tab: "Advanced", advanced: true, hint: "raw extras passed to topaz train, e.g. --num-epochs 30 --device cpu" }),
    ],
    "Topaz model trained — connect it into Auto-picking (Topaz mode)",
    "external",
    {
      category: "picking",
      tabs: ["Training", "Advanced"],
      inputs: [
        inp("micrographs", L.micIn, ["micrographs"]),
        inp("coords", "Training picks (hand-picked coordinates)", ["coords"]),
      ],
      outputs: [outp("model", "Trained Topaz model (.sav)", "model")],
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
  // t386 — the whole spec's initial defaults are RELION's own (RELION 5
  // pipeline_jobs.cpp initialiseClass2DJob) with the tutorial's pedagogical
  // overrides where the GUI's placeholder is useless: K=50 is the tutorial's
  // first-pass class count (the GUI's own default of 1 class is nobody's
  // classification), VDAM is RELION 5's default algorithm (do_grad=true),
  // T=2 / mask 200 Å / psi 6° / offsets 5+1 px / pool 3 are the GUI's own
  // pre-fills, and 25 EM iterations is nr_iter_em's default for the dialect
  // switch back to EM.
  spec(
    "class2d",
    "2D Classification",
    "LayoutGrid",
    "emerald",
    "Multi-reference 2D class averaging (relion_refine) to separate good particles from junk.",
    12000,
    [
      num("numClasses", "Number of classes (K)", 50, { step: 1, min: 1, max: 200, tab: "Optimisation", hint: "the RELION tutorial's first-pass count — more classes separate views more finely at linear cost" }),
      sel("algorithm", "Algorithm", "vdam", ["em", "vdam"], {
        tab: "Optimisation",
        hint: "RELION 5's two 2D-classification algorithms (the GUI's \"Use EM algorithm?\" / \"Use VDAM algorithm?\" pair, one knob): EM — the classic expectation-maximization, the default before relion-4.0; VDAM — variable-metric gradient descent with adaptive moments, RELION 5's own default and much faster on large data sets.",
      }),
      num("iterations", "Number of EM iterations", 25, {
        step: 1, min: 1, max: 50, tab: "Optimisation",
        showIf: { param: "algorithm", equals: "em" },
        hint: "number of EM iterations (--iter) — RELION's own nr_iter_em default",
      }),
      num("miniBatches", "Number of VDAM mini-batches", 200, {
        step: 10, min: 50, max: 500, tab: "Optimisation",
        showIf: { param: "algorithm", equals: "vdam" },
        hint: "number of mini-batches for the VDAM algorithm (--iter) — RELION's own GUI default 200: good results on many data sets; the tutorial uses 100 to run faster at some quality cost",
      }),
      num("particleDiameter", "Circular mask diameter", 200, { unit: "Å", step: 5, tab: "Optimisation", hint: "RELION's own default and the tutorial's value — larger than the particle's longest dimension, not smaller" }),
      bool("doCtf", "Do CTF-correction (--ctf)", true, {
        tab: "CTF",
        hint: "CTF correction inside the refinement — needs CTF info in the particles STAR (CryoFlow imports carry it)",
      }),
      bool("ctfIntactFirstPeak", "Ignore CTFs until first peak (--ctf_intact_first_peak)", false, {
        tab: "CTF", advanced: true,
        hint: "don't boost the lowest spatial frequencies — less low-res contrast, better high-res detail",
      }),
      num("tau2Fudge", "Regularisation factor T", 2, { step: 0.5, min: 0.5, tab: "Optimisation", advanced: true, hint: "RELION's own 2D default (T=2-3 typical for cryo-EM 2D, lower for negative stain)" }),
      bool("doZeroMask", "Mask individual particles with zeros (--zero_mask)", true, { tab: "Optimisation", advanced: true }),
      bool("doCenter", "Centre class averages (--center_classes)", true, {
        tab: "Optimisation",
        hint: "every iteration the class averages are centred on their centre-of-mass — RELION's own GUI default; only makes sense for positive (white) signals",
      }),
      bool("skipAlign", "Skip alignment (--skip_align)", false, {
        tab: "Optimisation", advanced: true,
        hint: "skip the in-plane alignment search — orientations must already be in the STAR (e.g. re-classifying refined particles)",
      }),
      sel("psiSampling", "In-plane sampling step", "6", psiOptions, { tab: "Sampling", advanced: true, hint: "RELION's own default (6°); finer steps sharpen class averages at compute cost" }),
      num("offsetRange", "Offset search range (px)", 5, {
        step: 1, min: 1, max: 30, tab: "Sampling", advanced: true,
        hint: "translation circle radius in pixels — RELION's own GUI default 5",
      }),
      num("offsetStep", "Offset search step (px)", 1, {
        step: 0.5, min: 0.5, max: 5, tab: "Sampling", advanced: true,
        hint: "translation sampling step — RELION's own GUI default 1",
      }),
      bool("allowCoarser", "Allow coarser sampling (--allow_coarser_sampling)", false, {
        tab: "Sampling", advanced: true,
        hint: "use coarser angular/translational sampling in early iterations while assignment accuracies are still low — faster",
      }),
      num("oversampling", "Adaptive oversampling (--oversampling)", 1, {
        step: 1, min: 0, max: 2, tab: "Sampling", advanced: true,
        hint: "1 = RELION default (oversampled adaptive grid); 0 = off; 2 = two levels",
      }),
      num("highresLimit", "E-step resolution limit (Å)", 0, {
        step: 0.5, min: 0, tab: "Optimisation", advanced: true,
        hint: "RELION --strict_highres_exp — caps the alignment search resolution; 0 = unlimited. A real speed lever for early classifications (e.g. 15–20 Å)",
      }),
      num("batchSize", "Pooled particles (--pool)", 3, {
        step: 1, min: 1, max: 16, tab: "Compute", advanced: true,
        hint: "images pooled per thread task — RELION 5's own GUI default (3; GUI range 1–16). Batches of pool × threads are read together: fewer disc round-trips, more VRAM — lower it if the GPU reports out-of-memory",
      }),
      txt("scratchDir", "Node-local scratch dir (--scratch_dir)", "", {
        tab: "Compute", advanced: true,
        hint: scratchHint,
      }),
      ...computeParity(),
      num("threads", "Threads (--j)", 4, {
        step: 1, min: 1, max: 32, tab: "Compute",
        hint: "relion_refine runs single-rank (MPI stacks under WSL are fragile) — this is the parallelism knob",
      }),
      // ---- Helix tab (t381) — RELION 5's own 2D-helix dialect, verbatim ----
      bool("doHelical2d", "Classify 2D helical segments?", false, {
        tab: "Helix",
        hint: "RELION GUI's Helix tab for 2D classification: set to Yes to classify 2D helical segments — the segments should come with priors on their psi angles (a helical picking run).",
      }),
      num("helicalTubeOuterDiameter2d", "Tube diameter (Å)", 200, {
        step: 10, min: 100, max: 1000, tab: "Helix",
        showIf: { param: "doHelical2d", equals: true },
        hint: "outer diameter of the helical tubes (--helical_outer_diameter)",
      }),
      bool("doBimodalPsi", "Do bimodal angular searches?", true, {
        tab: "Helix",
        showIf: { param: "doHelical2d", equals: true },
        hint: "bimodal search for psi angles (--bimodal_psi) — the up/down ambiguity of a helical segment",
      }),
      num("rangePsiHelical", "Angular search range — psi (°)", 6, {
        step: 1, min: 3, max: 30, tab: "Helix",
        showIf: { param: "doHelical2d", equals: true },
        hint: "local psi searches within ± this many degrees (--sigma_psi = value/3)",
      }),
      bool("doRestrictXoff", "Restrict helical offsets to rise", true, {
        tab: "Helix",
        showIf: { param: "doHelical2d", equals: true },
        hint: "restrict translational offsets ALONG the helix to the rise below — No allows free conventional offsets",
      }),
      num("helicalRise2d", "Helical rise (Å)", 1, {
        step: 0.01, min: 0, max: 100, tab: "Helix",
        showIf: { param: "doRestrictXoff", equals: true },
        hint: "the rise restricting the x-offsets (--helix --helical_rise_initial)",
      }),
    ],
    "{n} class averages",
    "core",
    {
      category: "class2d",
      tabs: ["CTF", "Optimisation", "Sampling", "Helix", "Compute"],
      inputs: [inp("particles", L.particlesIn, ["particles"])],
      outputs: [
        outp("classAverages", L.classAveragesOut, "references2d"),
        outp("particles", L.optParticlesOut, "particles"),
      ],
    }
  ),
  spec(
    "select2d",
    "2D Class Selection",
    "Grid2x2Check",
    "orange",
    "Subset-selection on a 2D classification run: pick good classes from the gallery (or auto-select by occupancy) — only particles in the kept classes continue downstream.",
    900,
    [
      txt("selectedClasses", "Selected classes", "auto", {
        tab: "Classes",
        hint: "'auto' keeps classes with occupancy ≥ cutoff × best · or an explicit comma list like 1,2,5 — driven by the gallery below",
      }),
      txt("classNotes", "Class notes", "{}", {
        tab: "Classes",
        advanced: true,
        hint: 'per-class annotations as a JSON map ({"3":"text"}) — edited from the gallery\'s note affordance, inert to the engine',
      }),
      num("occupancyCutoff", "Auto-mode occupancy cutoff", 0.5, {
        step: 0.05, min: 0, max: 1, tab: "Classes",
        hint: "auto-selection: keep classes whose particle count is at least this fraction of the largest class",
      }),
    ],
    "{n} particles kept",
    "core",
    {
      category: "class2d",
      tabs: ["Classes"],
      inputs: [
        // t356 — classes sits at the TOP (port 0): its canonical source is
        // class2d's FIRST output (classAverages, also port 0/top), so the
        // two wires class2d→select2d run parallel instead of crossing.
        // Edges reference ports BY NAME, so this is a pure geometry fix —
        // existing wiring is untouched.
        inp("classes", "2D class averages (gallery)", ["references2d"]),
        inp("particles", "Classified particles STAR (run 2D Classification first)", ["particles"]),
      ],
      outputs: [outp("particles", "Selected particles STAR file (.star)", "particles")],
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
      // t386 — RELION 5's inimodel GUI defaults: K=1, T=4, 200 mini-batches,
      // mask 200 Å; the tutorial's D2 stays (the tutorial sample AND the
      // user's are the same β-gal dataset)
      num("numClasses", "Number of classes (K)", 1, { min: 1, max: 20, tab: "Optimisation", hint: "RELION's own and the tutorial's default — one de-novo reference" }),
      sel("symmetry", "Symmetry", "D2", symmetryOptions, { tab: "Optimisation" }),
      num("iterations", "Number of VDAM mini-batches", 200, { step: 10, min: 50, max: 500, tab: "Optimisation", hint: "RELION's own nr_iter default (the tutorial uses 100 to run faster)" }),
      num("particleDiameter", "Circular mask diameter", 200, { unit: "Å", step: 5, tab: "Sampling", hint: "RELION's own default and the tutorial's value" }),
      num("tau2Fudge", "Regularisation factor T", 4, { step: 0.5, min: 0.5, tab: "Optimisation", advanced: true, hint: "RELION's own inimodel default (T=4, like 3D work)" }),
      bool("doCtf", "Do CTF-correction (--ctf)", true, {
        tab: "CTF",
        hint: "CTF correction inside the de-novo refinement — needs CTF info in the particles STAR",
      }),
      bool("ctfIntactFirstPeak", "Ignore CTFs until first peak (--ctf_intact_first_peak)", false, {
        tab: "CTF", advanced: true,
        hint: "don't boost the lowest spatial frequencies — less low-res contrast, better high-res detail",
      }),
      num("batchSize", "Pooled particles (--pool)", 3, {
        step: 1, min: 1, max: 16, tab: "Compute", advanced: true,
        hint: "images pooled per thread task — RELION 5's own GUI default (3)",
      }),
      txt("scratchDir", "Node-local scratch dir (--scratch_dir)", "", {
        tab: "Compute", advanced: true,
        hint: scratchHint,
      }),
      ...computeParity(),
    ],
    "{n} initial models",
    "core",
    {
      category: "class3d",
      tabs: ["CTF", "Optimisation", "Sampling", "Compute"],
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
      num("numClasses", "Number of classes (K)", 4, { min: 1, max: 20, tab: "Optimisation", hint: "the tutorial's heterogeneity screen — the GUI's own default is 1" }),
      sel("symmetry", "Symmetry", "C1", symmetryOptions, { tab: "Reference", hint: "the tutorial classifies in C1 first — bad particles break symmetry, and the point group can be verified on the classes" }),
      num("iterations", "Number of iterations", 25, { step: 5, min: 5, max: 100, tab: "Optimisation" }),
      num("particleDiameter", "Circular mask diameter", 200, { unit: "Å", step: 5, tab: "Sampling", hint: "RELION's own default and the tutorial's value" }),
      bool("doCtf", "Do CTF-correction (--ctf)", true, {
        tab: "CTF",
        hint: "CTF correction inside the refinement — needs CTF info in the particles STAR",
      }),
      bool("ctfIntactFirstPeak", "Ignore CTFs until first peak (--ctf_intact_first_peak)", false, {
        tab: "CTF", advanced: true,
        hint: "don't boost the lowest spatial frequencies — less low-res contrast, better high-res detail",
      }),
      num("tau2Fudge", "Regularisation factor T", 4, {
        step: 0.5, min: 0.5, tab: "Optimisation", advanced: true,
        hint: "RELION's own Class3D GUI default is 4 — higher T = sharper classes; this value now actually rides the command line (it was hardcoded 4 before t352)",
      }),
      bool("doBlush", "Blush regularisation (--blush)", false, {
        tab: "Optimisation",
        hint: "RELION 5's neural-network regulariser — regularisation by denoising at every iteration instead of the smoothness prior. Often converges to better maps from fewer particles. Off = the standard Tikhonov/smoothness prior (the T above)",
      }),
      bool("doZeroMask", "Mask individual particles with zeros (--zero_mask)", true, {
        tab: "Optimisation", advanced: true,
        hint: "RELION's own GUI default — the solvent region outside the particle is zeroed",
      }),
      bool("doFastSubsets", "Use fast subsets (--fast_subsets)", false, {
        tab: "Optimisation", advanced: true,
        hint: "the first iterations run on K×1500-particle random subsets, then K×4500, 30%, and finally all — for very large data sets",
      }),
      samplingSel("sampling", "Angular sampling step (healpix)", "7.5", {
        tab: "Sampling", advanced: true,
        hint: "RELION's own GUI default (7.5° — the tutorial keeps it for all but high-symmetry particles); the number passed to relion_refine is the healpix order",
      }),
      num("offsetRange", "Offset search range (px)", 5, {
        step: 1, min: 1, max: 30, tab: "Sampling", advanced: true,
        hint: "translation circle radius in pixels — RELION's own GUI default 5",
      }),
      num("offsetStep", "Offset search step (px)", 1, {
        step: 0.5, min: 0.5, max: 5, tab: "Sampling", advanced: true,
        hint: "translation sampling step — RELION's own GUI default 1",
      }),
      bool("allowCoarser", "Allow coarser sampling (--allow_coarser_sampling)", false, {
        tab: "Sampling", advanced: true,
        hint: "use coarser angular/translational sampling in early iterations while assignment accuracies are still low — faster",
      }),
      num("localSigmaAng", "Local angular search range (°, 0 = global)", 0, {
        step: 0.5, min: 0, max: 30, tab: "Sampling", advanced: true,
        hint: ">0 restricts angular searches to a cone around the input orientations — RELION --sigma_ang receives value/3, exactly like the RELION GUI",
      }),
      num("relaxSym", "Relax symmetry (--relax_sym)", 0, {
        step: 1, min: 0, max: 24, tab: "Sampling", advanced: true,
        hint: "0 = off — allow the point-group symmetry to be broken by this many degrees",
      }),
      num("padding", "Padding factor (--pad)", 2, {
        step: 1, min: 1, max: 2, tab: "Compute", advanced: true,
        hint: "FFT padding 2 = accurate interpolation (RELION default), 1 = 4× faster but corners may fold back signal",
      }),
      num("batchSize", "Pooled particles (--pool)", 0, {
        step: 1, min: 0, max: 16, tab: "Compute", advanced: true,
        hint: "images pooled per thread task — 0 = RELION 5's own GUI default (3; GUI range 1–16). Large boxes may need 1–2 to fit VRAM",
      }),
      txt("scratchDir", "Node-local scratch dir (--scratch_dir)", "", {
        tab: "Compute", advanced: true,
        hint: scratchHint,
      }),
      ...computeParity(),
      ...helicalParams(),
      num("threads", "Threads (--j)", 4, {
        step: 1, min: 1, max: 32, tab: "Compute",
        hint: "per-rank CPU threads (the RELION GUI's own --j)",
      }),
    ],
    "{n} 3D classes",
    "cmd",
    {
      category: "class3d",
      tabs: ["Reference", "CTF", "Optimisation", "Sampling", "Helix", "Compute"],
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
      num("iniHigh", "Initial low-pass on reference", 50, {
        unit: "Å", step: 1, min: 5, max: 60, tab: "Reference",
        hint: "the tutorial's value — a class3d/inimodel reference is low-res, so filter it hard before the first iteration",
      }),
      bool("doCtf", "Do CTF-correction (--ctf)", true, {
        tab: "CTF",
        hint: "CTF correction inside the refinement — needs CTF info in the particles STAR",
      }),
      bool("ctfIntactFirstPeak", "Ignore CTFs until first peak (--ctf_intact_first_peak)", false, {
        tab: "CTF", advanced: true,
        hint: "don't boost the lowest spatial frequencies — less low-res contrast, better high-res detail",
      }),
      num("particleDiameter", "Circular mask diameter", 200, { unit: "Å", step: 5, tab: "Sampling", hint: "RELION's own default and the tutorial's value" }),
      bool("autoRefine", "Perform auto-refinement", true, { tab: "Auto-sampling", hint: "RELION's own Refine3D always auto-refines (gold-standard FSC stop — the tutorial's whole point for this job); off keeps a fixed iteration count" }),
      num("iterations", "Number of iterations", 15, { step: 1, min: 1, max: 50, tab: "Optimisation", hint: "used when auto-refine is off" }),
      num("tau2Fudge", "Regularisation factor T", 1, {
        step: 0.5, min: 0.5, tab: "Optimisation", advanced: true,
        hint: "used when auto-refine is off (auto-refine derives its regularisation from the gold-standard FSC)",
      }),
      bool("doBlush", "Blush regularisation (--blush)", false, {
        tab: "Optimisation",
        hint: "RELION 5's neural-network regulariser — regularisation by denoising at every iteration instead of the smoothness prior. Often converges to better maps from fewer particles. Off = the standard prior",
      }),
      bool("doZeroMask", "Mask individual particles with zeros (--zero_mask)", true, {
        tab: "Optimisation", advanced: true,
        hint: "RELION's own GUI default — the solvent region outside the particle is zeroed",
      }),
      bool("doSolventFsc", "Solvent-flattened FSCs (--solvent_correct_fsc)", false, {
        tab: "Optimisation", advanced: true,
        hint: "use the solvent-corrected FSC in the gold-standard resolution estimate",
      }),
      samplingSel("samplingStep", "Initial angular sampling (healpix)", "7.5", {
        tab: "Auto-sampling", advanced: true,
        hint: "RELION's own GUI default — the tutorial: 7.5° for everything short of octahedral/icosahedral symmetry; the number passed to relion_refine is the healpix order",
      }),
      samplingSel("autoLocalSampling", "Local searches from auto-sampling", "1.8", {
        tab: "Auto-sampling", advanced: true,
        hint: "the sampling auto-refine switches down to for the local searches (RELION --auto_local_healpix_order) — RELION's own GUI default 1.8°",
      }),
      bool("autoFaster", "Use finer angular sampling faster", false, {
        tab: "Auto-sampling", advanced: true,
        hint: "RELION's own expert option — adds --auto_ignore_angles --auto_resol_angles, letting auto-refine proceed to finer sampling sooner",
      }),
      num("offsetRange", "Initial offset range (px)", 5, {
        step: 1, min: 1, max: 30, tab: "Auto-sampling", advanced: true,
        hint: "translation circle radius in pixels — RELION's own GUI default 5",
      }),
      num("offsetStep", "Initial offset step (px)", 1, {
        step: 0.5, min: 0.5, max: 5, tab: "Auto-sampling", advanced: true,
        hint: "translation sampling step — RELION's own GUI default 1",
      }),
      num("relaxSym", "Relax symmetry (--relax_sym)", 0, {
        step: 1, min: 0, max: 24, tab: "Auto-sampling", advanced: true,
        hint: "0 = off — allow the point-group symmetry to be broken by this many degrees",
      }),
      num("padding", "Padding factor", 2, {
        step: 1, min: 1, max: 2, tab: "Compute", advanced: true,
        hint: "FFT padding 2 = accurate interpolation, 1 = 4× faster (large boxes)",
      }),
      num("batchSize", "Pooled particles (--pool)", 0, {
        step: 1, min: 0, max: 16, tab: "Compute", advanced: true,
        hint: "images pooled per thread task — 0 = RELION 5's own GUI default (3; GUI range 1–16). Large boxes may need 1–2 to fit VRAM",
      }),
      txt("scratchDir", "Node-local scratch dir (--scratch_dir)", "", {
        tab: "Compute", advanced: true,
        hint: scratchHint,
      }),
      ...computeParity(),
      ...helicalParams(),
      num("threads", "Threads (--j)", 4, {
        step: 1, min: 1, max: 32, tab: "Compute",
        hint: "per-rank CPU threads (the RELION GUI's own --j)",
      }),
    ],
    "Refined to {n} Å",
    "core",
    {
      category: "refine",
      tabs: ["Reference", "CTF", "Optimisation", "Sampling", "Auto-sampling", "Helix", "Compute"],
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
      num("particleDiameter", "Circular mask diameter", 200, { unit: "Å", step: 5, tab: "Sampling", hint: "RELION's own default" }),
      num("offsetStep", "Offset search step", 0.75, { unit: "px", step: 0.05, min: 0.1, max: 10, tab: "Sampling", advanced: true, hint: "RELION's own multibody GUI default (0.75 px)" }),
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

  /* ---------------- Orientation: symmetry expansion & rebalancing --- */
  spec(
    "symexpand",
    "Symmetry Expansion",
    "Orbit",
    "cyan",
    "Expand particles across a point group's asymmetric units — every row is replicated |G|× with composed Euler angles (icosahedral subsets included). Ports the Jing0715-fer/icosahedral-symmetry-expander algorithm; a superset of relion_particle_symmetry_expand.",
    2500,
    [
      sel("symmetryGroup", "Point group", "I", [
        "I", "O", "T", "C2", "C3", "C4", "C5", "C6", "D1", "D2", "D3", "D4", "D5", "D6",
      ], {
        tab: "Symmetry",
        hint: "I = icosahedral (60 asymmetric units) · O = octahedral (24) · T = tetrahedral (12) · Cn/Dn cyclic & dihedral",
      }),
      sel("icoSubset", "Icosahedral subset (I only)", "full", ["full", "vertex", "face", "edge", "non_edge", "hemisphere"], {
        tab: "Symmetry",
        hint: "vertex 12 · face 20 · edge 30 · non_edge 42 · hemisphere 30 · full 60 rotations — subsets only apply to group I",
      }),
      bool("deduplicate", "Deduplicate rotations", true, {
        tab: "Symmetry",
        advanced: true,
        hint: "collapse numerically-identical group elements (matters for degenerate Cn/Dn specs)",
      }),
    ],
    "{n} particles expanded",
    "core",
    {
      category: "orientation",
      tabs: ["Symmetry"],
      inputs: [inp("particles", L.particlesIn, ["particles"])],
      outputs: [outp("particles", "Symmetry-expanded particles STAR", "particles")],
    }
  ),
  spec(
    "rebalance",
    "Orientation Rebalancer",
    "Scale",
    "cyan",
    "Balance the viewing-direction distribution of a particle stack: Fibonacci-sphere binning, 3DFSC-style resolution estimates and per-bin percentile trimming (loglik/maxprob/ncc/random exclusion). Ports the Jing0715-fer/Orient-Rebalancer algorithm.",
    2000,
    [
      num("numBins", "Orientation bins (Fibonacci sphere)", 200, {
        min: 20, max: 1000, step: 10, tab: "Binning",
        hint: "equal-area bins over the viewing sphere — more bins = finer anisotropy resolution",
      }),
      num("percentile", "Trim threshold percentile", 90, {
        unit: "%", min: 5, max: 100, step: 5, tab: "Trimming",
        hint: "per-bin keep-count = this percentile of non-empty bin counts (over-populated bins are trimmed down to it)",
      }),
      sel("exclusionCriterion", "Exclusion criterion", "loglik", ["loglik", "maxprob", "ncc", "random"], {
        tab: "Trimming",
        hint: "which per-particle score decides who leaves an over-populated bin: _rlnLogLikeliContribution, _rlnMaxValueProbDistribution, _rlnNormCorrection or seeded random (fallback when columns are absent)",
      }),
      sel("mode", "Threshold mode", "standard", ["standard", "resolution"], {
        tab: "Trimming",
        hint: "resolution mode scales per-bin thresholds by the 3DFSC estimate — bins BETTER than the median lose more, flattening the resolution field",
      }),
      num("resolutionWeight", "Resolution weight α", 1, {
        step: 0.1, min: 0, max: 5, tab: "Trimming", advanced: true,
        hint: "threshold_i = base × (res_i / medianRes)^α (resolution mode only)",
      }),
      num("seed", "Random seed", 1, { min: 0, step: 1, tab: "Trimming", advanced: true, hint: "reproducible random exclusion" }),
    ],
    "{n} particles rebalanced",
    "core",
    {
      category: "orientation",
      tabs: ["Binning", "Trimming"],
      inputs: [inp("particles", "Oriented particles STAR (rot/tilt angles)", ["particles"])],
      outputs: [outp("particles", "Rebalanced particles STAR", "particles")],
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
      num("threshold", "Initial binarisation threshold", 0.02, { step: 0.01, min: 0.001, tab: "Mask", hint: "the tutorial's spot-check guidance: 0.002–0.02 — the threshold where the low-passed map shows no noisy spots outside the protein" }),
      num("softEdge", "Soft edge width", 8, { unit: "px", min: 1, tab: "Mask", hint: "the tutorial's 8-px soft edge — gradual falloff keeps FSCs honest at the mask rim" }),
      num("lowpass", "Lowpass filter", 15, { unit: "Å", step: 5, tab: "Mask", advanced: true }),
      num("extend", "Extend initial mask", 3, { unit: "px", min: 0, tab: "Mask", hint: "RELION's own default (the tutorial keeps it)" }),
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
      num("adhocBfac", "Ad-hoc B-factor", -1000, { step: 50, unit: "Å²", tab: "Sharpening", advanced: true, hint: "used when auto-B is off — RELION's own default (-1000 Ų; stronger sharpening than -100)" }),
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
      num("lastFrame", "Last frame", -1, { min: -1, tab: "Polish", advanced: true, hint: "RELION's own default: -1 = all frames" }),
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

/* ------------------------------------------------------------------ */
/* t374 — RELION 5.0 GUI parity: the full option-table merge            */
/*                                                                      */
/* Every JOB_TYPES spec gains the COMPLETE set of RELION's own GUI      */
/* options for its type: the label/tab/default/min/max/radio/help are  */
/* lifted verbatim from RELION 5.0.0's pipeline_jobs.cpp (option        */
/* definitions) and gui_jobwindow.cpp (tab layout + expert toggles) —  */
/* so a RELION user reads the same knobs in the same tabs in the same  */
/* order with the same defaults.                                        */
/*                                                                      */
/* Merge rules (safety first):                                          */
/*  1. existing curated keys are NEVER replaced — they stay the wired   */
/*     controls (engine's builders + presets + stored DB params)        */
/*  2. a RELION key that is a DECLARED ALIAS of a curated key (same     */
/*     flag, different key name) is skipped — one control per knob      */
/*  3. a RELION option whose label matches an existing curated label    */
/*     (modulo ':'/'?') is treated as the same knob (skipped)          */
/*  4. RELION "node" options (input STAR files wired via edges) are    */
/*     skipped — cryoflow wires inputs through ports, not pickers      */
/*  5. SPA specs skip tomo-only placements and vice versa (RELION's     */
/*     if (is_tomo) branches in the window)                             */
/*  6. C++ placeholder defaults (std::string(""), LABEL_*) sanitize    */
/*     to ""                                                            */
/* ------------------------------------------------------------------ */

import { RELION_OPTIONS, RELION_ALIASES } from "./relion/option-tables";

function relionLabelKey(s: string): string {
  return s.toLowerCase().replace(/[?:*]/g, "").replace(/\s+/g, " ").trim();
}

/** First ~2 sentences of a RELION helptext, capped for tooltip use. */
function relionHint(help: string): string | undefined {
  const clean = help.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).length > 260) break;
    out += s + " ";
    if (out.length > 260) break;
  }
  out = out.trim() || clean.slice(0, 260);
  return out.length > 300 ? out.slice(0, 297) + "…" : out;
}

function applyRelionParamTable(): void {
  for (const spec of JOB_TYPES) {
    const table = RELION_OPTIONS[spec.key];
    if (!table) continue;
    const isTomo = spec.group === "Tomography";
    const skipWorld = isTomo ? "spa" : "tomo";
    // t386 — alias values may be ARRAYS (one curated composite knob owning
    // several raw options, e.g. class2d's algorithm → do_em + do_grad), so
    // the skip-set flattens before use
    const aliased = new Set(
      Object.values(RELION_ALIASES[spec.key] ?? {}).flatMap((v) =>
        Array.isArray(v) ? v : [v]
      )
    );
    const have = new Set(spec.params.map((p) => p.key));
    const labelTwin = new Set(spec.params.map((p) => relionLabelKey(p.label)));

    const relionTabOrder: string[] = [];
    for (const tab of table.tabs) {
      let populated = spec.params.some((p) => p.tab === tab.label);
      for (const o of tab.options) {
        if (o.world === skipWorld) continue;
        if (have.has(o.key) || aliased.has(o.key)) continue;
        const def = table.options[o.key];
        if (!def) continue;
        // rule 3: same label under a curated name — one knob, one control
        if (labelTwin.has(relionLabelKey(def.label))) continue;
        // rule 4: RELION "node" options (the pipeline input STAR pickers —
        // fn_img/fn_mic/fn_*_star …) are the EDGE-wired inputs in cryoflow;
        // fn_cont belongs to cryoflow's own resume system. Everything else
        // named fn_* is a real user-picked file (MTF curve, gain ref …) and
        // stays as a path param.
        if (
          def.type === "path" &&
          def.key.startsWith("fn_") &&
          (def.key.endsWith("_star") ||
            ["fn_img", "fn_mic", "fn_mics", "fn_movies", "fn_ref", "fn_cont", "fn_mask", "fn_half1", "fn_half2"].includes(def.key) ||
            /^fn_(part|mic|mov)\d$/.test(def.key))
        ) {
          continue;
        }
        let dv: ParamValue;
        if (typeof def.default === "string") {
          // C++ placeholder defaults → ""
          dv = /^(std::|LABEL_|CURRENT_|NODE_)/.test(def.default) ? "" : def.default;
        } else {
          dv = def.default;
        }
        const radioOptions =
          def.type === "select" && def.radio && def.radio.length > 0 ? def.radio : undefined;
        const schemaType: ParamType =
          def.type === "select" && radioOptions
            ? "select"
            : def.type === "bool"
              ? "bool"
              : def.type === "number"
                ? "number"
                : def.type === "path"
                  ? "path"
                  : "text";
        if (schemaType === "select" && !radioOptions) continue;
        spec.params.push({
          key: def.key,
          label: def.label,
          type: schemaType,
          default: dv,
          min: def.min,
          max: def.max,
          step: def.step,
          options: radioOptions,
          tab: tab.label,
          advanced: o.expert,
          hint: relionHint(def.help),
        });
        have.add(def.key);
        populated = true;
      }
      if (populated && !relionTabOrder.includes(tab.label)) relionTabOrder.push(tab.label);
    }
    // tab order = RELION's own window order, with any curated-only tabs
    // appended where they already were (relative order preserved)
    const merged = [
      ...relionTabOrder,
      ...spec.tabs.filter((t) => !relionTabOrder.includes(t)),
    ];
    spec.tabs.length = 0;
    spec.tabs.push(...merged);
  }
}

applyRelionParamTable();

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

/**
 * t315 — the output ports a SPECIFIC job renders: the spec's outputs minus
 * any port whose `when` predicate (evaluated against the job's own params)
 * says otherwise. The Import job's port is one-of-three by Node type; every
 * port-listing surface (card, wiring drawer) goes through here so the
 * visible truth and the compatible truth stay the same truth.
 */
export function visibleOutputs(
  spec: JobTypeSpec | undefined,
  params: Record<string, ParamValue> | undefined
): PortSpec[] {
  const outputs = spec?.outputs ?? [];
  if (params == null) return outputs;
  return outputs.filter((p) => !p.when || p.when(params));
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

/* ------------------------------------------------------------------ */
/* Quick next-step suggestions (t383; curated in t384)                 */
/* ------------------------------------------------------------------ */

/**
 * One candidate "continue this pipeline" step: the target job type plus
 * the port pair the auto-wire will use.
 */
export interface NextStep {
  /** Target job type key (JOB_TYPES entry). */
  type: string;
  /** Human label (same string the palette shows). */
  label: string;
  /** Lucide icon NAME (resolved through <TypeIcon>). */
  icon: string;
  /** Source output port name (evaluated against the live params). */
  fromPort: string;
  /** Target input port name. */
  toPort: string;
  /** Short port-pair caption for the menu row (e.g. "micrographs → CTF"). */
  caption: string;
}

/**
 * t384 — the CURATED next-step universe. t383 derived the menu by scanning
 * every job type's `accepts` against the source's outputs, which produced
 * port-legal but pipeline-absurd candidates (CTF → MotionCorr backwards,
 * SPA → Tomography crossings, Import Map after a classification, the
 * External/JoinSTAR utilities…). The user's rule: 「job类型要符合下一步
 * 可用的job，如果是下一步不会出现的不要放进去」— the menu must offer
 * exactly what a RELION user would reach for next, in RELION's own
 * pipeline order.
 *
 * The lists below are that canon (SPA tutorial order; the tomo chain runs
 * its own universe — SPA sources never suggest tomo steps and vice versa).
 * Every entry STILL goes through the live port-pair matcher in
 * nextStepsFor, so: (a) an entry whose ports cannot pair is skipped
 * defensively, (b) the caption names the actual wire, and (c) Import's
 * node-type split happens by which of its live output ports exists — no
 * separate branching needed for the wiring itself.
 */
const NEXT_STEPS: Record<string, string[]> = {
  // import is special-cased in nextStepsFor (its successors depend on the
  // live Node type — see IMPORT_NEXT_STEPS below)
  import: [],
  mapimport: ["class3d", "refine3d", "maskcreate"],
  cs2star: ["class2d", "select", "initialmodel", "class3d", "refine3d"],
  motioncorr: ["ctffind", "manualpick", "autopick"],
  ctffind: ["manualpick", "autopick"],
  manualpick: ["extract"],
  autopick: ["extract"],
  topaztrain: ["autopick"],
  extract: ["class2d", "select", "initialmodel", "class3d", "refine3d"],
  subtract: ["class2d", "select", "class3d", "refine3d"],
  select: ["class2d", "initialmodel", "class3d", "refine3d"],
  joinstar: [],
  class2d: ["select2d", "initialmodel", "class3d", "refine3d"],
  select2d: ["initialmodel", "class3d", "refine3d"],
  initialmodel: ["class3d", "refine3d"],
  // same-type chaining stays: re-classification / progressive refinement
  // are standard RELION moves (the source can consume its own output)
  class3d: ["select", "class3d", "refine3d"],
  refine3d: [
    "maskcreate", "postprocess", "localres", "ctfrefine", "polish",
    "multibody", "class3d", "refine3d",
  ],
  multibody: ["maskcreate", "class3d", "refine3d"],
  symexpand: ["select", "class3d", "refine3d"],
  rebalance: ["class3d", "refine3d"],
  maskcreate: ["postprocess", "localres"],
  postprocess: [], // terminal — nothing canonical consumes a sharpened map
  localres: [], // terminal
  polish: ["class3d", "refine3d"],
  ctfrefine: ["polish", "class3d", "refine3d"],
  dynamight: ["class3d", "refine3d"],
  modelangelo: [], // terminal (mmCIF models out)
  // the tomography chain — one universe, never crossing into SPA
  tomo_import: ["tomo_aligntiltseries"],
  tomo_aligntiltseries: ["tomo_ctfrefine", "tomo_polish", "tomo_tomograms"],
  tomo_ctfrefine: ["tomo_tomograms"],
  tomo_exclude: ["tomo_tomograms"],
  tomo_polish: ["tomo_tomograms"],
  tomo_tomograms: ["tomo_denoise", "tomo_picks"],
  tomo_denoise: ["tomo_picks"],
  tomo_picks: ["tomo_extract"],
  tomo_extract: ["tomo_reconstruct"],
  tomo_reconstruct: [],
  external: [],
};

/**
 * Import's successors split by the live Node type — the three data
 * universes an import can land in (the port matcher enforces the same
 * truth for hand-drawn wires; this list just keeps the MENU honest, e.g.
 * Particle Selection never appears under a Movies import even though the
 * select port technically accepts the movies kind).
 */
const IMPORT_NEXT_STEPS: Record<string, string[]> = {
  movies: ["motioncorr"],
  micrographs: ["ctffind", "manualpick", "autopick"],
  particles: ["class2d", "select", "initialmodel", "class3d", "refine3d"],
};

/**
 * Every job type that can legally consume this job type's (current)
 * outputs — the card context menu's "Add next step…" list. The source's
 * `when` predicates run against the LIVE params, so an Import set to
 * "Movies" only offers MotionCorr, exactly like dragging a wire out of
 * the port by hand. Candidates come from the curated NEXT_STEPS canon
 * (t384) — list order = RELION pipeline order = menu order.
 */
export function nextStepsFor(
  fromType: string,
  params?: Record<string, ParamValue>
): NextStep[] {
  const from = jobType(fromType);
  if (!from) return [];
  const outs = visibleOutputs(from, params);
  if (outs.length === 0) return [];
  // the curated successor list: Import picks its lane by the live Node
  // type (default micrographs — the spec's own default), everything else
  // reads the canon; unknown sources get nothing (honest emptiness)
  const successors =
    fromType === "import"
      ? IMPORT_NEXT_STEPS[
          typeof params?.nodeType === "string" && params.nodeType in IMPORT_NEXT_STEPS
            ? params.nodeType
            : "micrographs"
        ] ?? []
      : NEXT_STEPS[fromType] ?? [];
  const steps: NextStep[] = [];
  for (const type of successors) {
    const candidate = jobType(type);
    if (!candidate) continue;
    let hit: { fromPort: string; toPort: string; caption: string } | null = null;
    for (const o of outs) {
      for (const i of candidate.inputs) {
        const accepts = i.accepts ?? ["*"];
        if (accepts.includes("*") || (o.kind != null && accepts.includes(o.kind))) {
          hit = { fromPort: o.name, toPort: i.name, caption: `${o.name} → ${i.name}` };
          break;
        }
      }
      if (hit) break;
    }
    if (hit) {
      steps.push({
        type: candidate.key,
        label: candidate.label,
        icon: candidate.icon,
        fromPort: hit.fromPort,
        toPort: hit.toPort,
        caption: hit.caption,
      });
    }
  }
  return steps;
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
  if (p.type === "path" || p.type === "text") {
    if (typeof raw === "string") return raw;
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

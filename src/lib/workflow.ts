/**
 * CryoFlow — job type catalog, shared by client and server.
 * Pure data: NO React imports. Lucide icons are referenced by NAME string
 * and resolved through the client-side iconMap (src/components/workflow/icons.tsx).
 */

import type { JobTypeSpec, ParamSchema } from "./types";

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

export const JOB_TYPES: JobTypeSpec[] = [
  {
    key: "import",
    label: "Import Movies",
    group: "Data Import",
    icon: "FolderInput",
    color: {
      text: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-500",
      border: "border-teal-500",
      soft: "bg-teal-500/10",
    },
    description:
      "Ingest raw cryo-EM movie stacks and micrograph metadata into the project.",
    duration: 2500,
    params: [
      num("pixelSize", "Pixel size", 1.06, { unit: "Å", min: 0.1, step: 0.01 }),
      num("voltage", "Voltage", 300, { unit: "kV" }),
      num("sAberration", "Spherical aberration", 2.7, { unit: "mm" }),
    ],
    resultTemplate: "{n} micrographs imported",
  },
  {
    key: "motion",
    label: "Motion Correction",
    group: "Motion",
    icon: "Wind",
    color: {
      text: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500",
      border: "border-violet-500",
      soft: "bg-violet-500/10",
    },
    description:
      "Correct beam-induced specimen motion with patch-based alignment.",
    duration: 9000,
    params: [
      num("patchX", "Patches X", 5),
      num("patchY", "Patches Y", 5),
      num("dosePerFrame", "Dose per frame", 1.28, {
        unit: "e⁻/Å²",
        step: 0.01,
      }),
      num("bfactor", "B-factor", 150),
    ],
    resultTemplate: "{n} movies corrected",
  },
  {
    key: "ctf",
    label: "CTF Estimation",
    group: "CTF",
    icon: "Aperture",
    color: {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500",
      border: "border-amber-500",
      soft: "bg-amber-500/10",
    },
    description:
      "Fit the contrast transfer function per micrograph with band-limited power spectra.",
    duration: 5000,
    params: [
      num("boxSize", "Box size", 512, { step: 32, min: 64, max: 2048 }),
      num("minRes", "Min resolution", 30, { unit: "Å" }),
      num("maxRes", "Max resolution", 5, { unit: "Å" }),
      num("ampContrast", "Amplitude contrast", 0.1, {
        step: 0.01,
        min: 0.01,
        max: 0.3,
      }),
    ],
    resultTemplate: "CTF fitted, {n} micrographs",
  },
  {
    key: "picking",
    label: "Particle Picking",
    group: "Picking",
    icon: "Crosshair",
    color: {
      text: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500",
      border: "border-rose-500",
      soft: "bg-rose-500/10",
    },
    description:
      "Detect single particles on micrographs with template matching or deep picking.",
    duration: 7000,
    params: [
      sel("method", "Method", "autopick", ["autopick", "topaz", "manual"]),
      num("diameter", "Particle diameter", 180, { unit: "Å", step: 5 }),
      num("threshold", "Picking threshold", 0.4, {
        step: 0.05,
        min: 0,
        max: 1,
      }),
    ],
    resultTemplate: "{n} particles picked",
  },
  {
    key: "extract",
    label: "Particle Extraction",
    group: "Picking",
    icon: "Crop",
    color: {
      text: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500",
      border: "border-orange-500",
      soft: "bg-orange-500/10",
    },
    description:
      "Box picked particles from micrographs and normalize the stacks.",
    duration: 3000,
    params: [
      num("boxSize", "Box size", 128, { step: 8, min: 32, max: 512, unit: "px" }),
      num("downsampleTo", "Downsample to", 64, { step: 8 }),
    ],
    resultTemplate: "{n} particles extracted",
  },
  {
    key: "class2d",
    label: "2D Classification",
    group: "Classification",
    icon: "LayoutGrid",
    color: {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500",
      border: "border-emerald-500",
      soft: "bg-emerald-500/10",
    },
    description:
      "Multi-reference 2D class averaging to separate good particles from junk.",
    duration: 11000,
    params: [
      num("numClasses", "Number of classes", 50, { step: 5, min: 2, max: 200 }),
      num("maskDiameter", "Mask diameter", 200, { unit: "Å" }),
      num("iterations", "Iterations", 25, { step: 5 }),
    ],
    resultTemplate: "{n} class averages",
  },
  {
    key: "class3d",
    label: "3D Classification",
    group: "Classification",
    icon: "Boxes",
    color: {
      text: "text-green-600 dark:text-green-400",
      bg: "bg-green-500",
      border: "border-green-500",
      soft: "bg-green-500/10",
    },
    description:
      "Sort particles into 3D conformational classes against a reference map.",
    duration: 11000,
    params: [
      num("numClasses", "Number of classes", 4, { min: 1, max: 20 }),
      sel("symmetry", "Symmetry", "C1", symmetryOptions),
      num("iterations", "Iterations", 25, { step: 5 }),
    ],
    resultTemplate: "{n} 3D classes",
  },
  {
    key: "refine",
    label: "3D Refinement",
    group: "Refinement",
    icon: "Gem",
    color: {
      text: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-500",
      border: "border-cyan-500",
      soft: "bg-cyan-500/10",
    },
    description:
      "Gold-standard angular refinement to sharpen the final reconstruction.",
    duration: 12000,
    params: [
      sel("symmetry", "Symmetry", "C1", symmetryOptions),
      sel("sampling", "Angular sampling", "auto", [
        "auto",
        "7.5°",
        "3.7°",
        "1.8°",
        "0.9°",
      ]),
      num("innerMask", "Inner mask radius", 40, { unit: "Å" }),
    ],
    resultTemplate: "Refined to {n} Å",
  },
  {
    key: "post",
    label: "Post-Processing",
    group: "Post",
    icon: "Sparkles",
    color: {
      text: "text-pink-600 dark:text-pink-400",
      bg: "bg-pink-500",
      border: "border-pink-500",
      soft: "bg-pink-500/10",
    },
    description:
      "Sharpen, mask and B-factor weight the refined half-maps for deposition.",
    duration: 4000,
    params: [
      num("bFactor", "Sharpening B-factor", -150),
      num("randomizeFrom", "Randomize phases from", 10, { unit: "Å" }),
    ],
    resultTemplate: "Sharpened map, {n} Å",
  },
  {
    key: "mask",
    label: "Mask Creation",
    group: "Post",
    icon: "CircleDot",
    color: {
      text: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-500",
      border: "border-slate-500",
      soft: "bg-slate-500/10",
    },
    description:
      "Build a soft-edged 3D mask around the density for FSC and validation.",
    duration: 2500,
    params: [
      num("threshold", "Density threshold", 0.02, { step: 0.01 }),
      num("softEdge", "Soft edge width", 6, { unit: "px" }),
      num("extend", "Extend distance", 3, { unit: "px" }),
    ],
    resultTemplate: "Mask created",
  },
];

/** Ordered group labels for the palette. */
export const JOB_GROUPS: string[] = [
  "Data Import",
  "Motion",
  "CTF",
  "Picking",
  "Classification",
  "Refinement",
  "Post",
];

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

/**
 * Deterministic result string for a completed job.
 * Pseudo-count derived from a string hash of the job id:
 * counts in [800, 4200]; refine/post resolve to a resolution in [3.1, 8.5] Å.
 */
export function resultFor(typeKey: string, jobId: string): string {
  const t = jobType(typeKey);
  const template = t?.resultTemplate ?? "{n} items";
  let h = 0;
  for (let i = 0; i < jobId.length; i++) {
    h = (h * 31 + jobId.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(h);
  if (typeKey === "refine" || typeKey === "post") {
    const res = (310 + (abs % 540)) / 100; // 3.10 – 8.49 Å
    return template.replace("{n}", res.toFixed(2));
  }
  const n = 800 + (abs % 3401); // 800 – 4200
  return template.replace("{n}", String(n));
}

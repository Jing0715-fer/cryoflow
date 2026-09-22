/**
 * CryoFlow — curated per-type parameter presets (command palette "Add with
 * preset").
 *
 * A preset is a PARTIAL param override on top of the type's spec defaults:
 * the POST /api/jobs body accepts a `params` object which the server
 * scalar-filters against the type's schema (unknown keys and non-scalars
 * are dropped there), so a preset key that drifts from the spec degrades
 * to "that knob stays default" — never a 500, never an arbitrary field.
 *
 * Every preset here has been checked against the live spec keys in
 * workflow.ts; values respect each field's declared min/max/enum (symmetry
 * is limited to the same option list the inspector's select uses). The
 * defaults themselves are NOT presets — the plain "Add job type" entries
 * already produce them; a preset only exists when it changes something.
 */

export interface JobTypePreset {
  /** job type key (JOB_TYPES key) */
  type: string;
  /** short preset name shown in the palette */
  preset: string;
  /** partial param override — scalar values only, spec keys only */
  params: Record<string, number | string | boolean>;
  /** one-line "what this is for" shown as the muted trailing text */
  note: string;
}

export const JOB_PRESETS: JobTypePreset[] = [
  /* ---------------- Motion ------------------------------------------ */
  {
    type: "motioncorr",
    preset: "Super-res patches 7×7",
    params: { patchX: 7, patchY: 7, bfactor: 250 },
    note: "small pixels / high magnification movies",
  },

  /* ---------------- CTF --------------------------------------------- */
  {
    type: "ctffind",
    preset: "Fast screen (256 box)",
    params: { box: 256, resMax: 8 },
    note: "quick per-mic pass before committing to full fits",
  },

  /* ---------------- Picking ----------------------------------------- */
  {
    type: "autopick",
    preset: "LoG 120–180 Å",
    params: { pickingMethod: "Laplacian of Gaussian", logDiamMin: 120, logDiamMax: 180 },
    note: "reference-free picking straight after CTF",
  },
  {
    type: "autopick",
    preset: "Topaz — general model",
    params: { pickingMethod: "Topaz", topazNrParticles: 300, topazThreshold: -6 },
    note: "CNN picking, ~300 particles per micrograph",
  },
  {
    type: "autopick",
    preset: "References from Class2D",
    params: { pickingMethod: "References", threshold: 0.4 },
    note: "template matching with your own 2D averages",
  },

  /* ---------------- Extraction --------------------------------------- */
  {
    type: "extract",
    preset: "Small particles 96 → 48",
    params: { boxSize: 96, downsampleTo: 48 },
    note: "keeps 2D/3D fast on <150 Å particles",
  },
  {
    type: "extract",
    preset: "No downscale 256",
    params: { boxSize: 256, downsampleTo: 0 },
    note: "full-resolution boxes — big particles / polished maps",
  },

  /* ---------------- 2D classification -------------------------------- */
  {
    type: "class2d",
    preset: "Deep pass K50 · 25 it",
    params: { numClasses: 50, iterations: 25 },
    note: "fine sorting when 10 classes smear distinct views",
  },
  {
    type: "class2d",
    preset: "Junk screen K20 · 8 it",
    params: { numClasses: 20, iterations: 8 },
    note: "fast cull before the real classification run",
  },

  /* ---------------- Initial model ------------------------------------ */
  {
    type: "initialmodel",
    preset: "Single model C1 fast",
    params: { numClasses: 1, symmetry: "C1", iterations: 30 },
    note: "ab-initio reference for an asymmetric particle",
  },
  {
    type: "initialmodel",
    preset: "K8 D2",
    params: { numClasses: 8, symmetry: "D2" },
    note: "heterogeneous sample with D2 point group",
  },

  /* ---------------- 3D refinement ------------------------------------ */
  {
    type: "refine3d",
    preset: "C1 auto-refine 15 Å",
    params: { symmetry: "C1", iniHigh: 15, autoRefine: true },
    note: "gold-standard FSC stop, no symmetry imposed",
  },
  {
    type: "refine3d",
    preset: "D2 fixed 15 it",
    params: { symmetry: "D2", autoRefine: false, iterations: 15 },
    note: "predictable runtime for a known point group",
  },
  {
    type: "refine3d",
    preset: "C4 high-sym auto",
    params: { symmetry: "C4", iniHigh: 20, autoRefine: true },
    note: "symmetry-expanded refinement converges much faster",
  },

  /* ---------------- Selection ---------------------------------------- */
  {
    type: "select",
    preset: "Top 5000 particles",
    params: { maxParticles: 5000 },
    note: "cap the stack for a pilot classification",
  },
];

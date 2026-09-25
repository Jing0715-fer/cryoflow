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
    note: "tighter blobs than the tutorial's 150–180 — for smaller particles",
  },
  {
    type: "autopick",
    preset: "Topaz — general model",
    params: { pickingMethod: "Topaz", topazThreshold: -6 },
    note: "CNN picking with the pretrained general model (the tutorial then retrains on your own picks)",
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
  // t386 — the type defaults are now the tutorial's own (VDAM, K=50, 200
  // mini-batches), so the presets are the DELIBERATE deviations from it
  {
    type: "class2d",
    preset: "Fast screen K20 · 100 batches",
    params: { numClasses: 20, miniBatches: 100 },
    note: "quick cull before the real classification run — the tutorial's own speed trade-off",
  },
  {
    type: "class2d",
    preset: "Classic EM · 25 it",
    params: { algorithm: "em", iterations: 25 },
    note: "the pre-relion-4.0 expectation-maximization dialect — slower, occasionally better on small sets",
  },

  /* ---------------- Initial model ------------------------------------ */
  {
    type: "initialmodel",
    preset: "Single model C1 fast",
    params: { symmetry: "C1", iterations: 100 },
    note: "C1 search without the D2 prior, 100 mini-batches — the tutorial's faster inimodel",
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

  /* ---------------- Import (t336) ------------------------------------ */
  {
    type: "cs2star",
    preset: "Refined 3D particles",
    params: { invertY: false },
    note: "a CryoSPARC refinement/export job's .cs — Rodrigues angles, CTF and optics all carry over",
  },
  {
    type: "cs2star",
    preset: "Picked-only set",
    params: { invertY: true },
    note: "coordinates from cryoSPARC's own picker (bottom-left origin) — Y flipped for RELION, no alignments yet",
  },
];

#!/usr/bin/env node
/**
 * CryoFlow codegen — RELION 5.0.0 option table → src/lib/relion/option-tables.ts
 *
 * Input:  /home/z/relion-options.json  (from relion-src/parse_options.py)
 * Output: src/lib/relion/option-tables.ts
 *
 * The table is the VERBATIM RELION GUI authority (pipeline_jobs.cpp option
 * definitions + gui_jobwindow.cpp tab layout, both of the 5.0.0 tag):
 *  - tabs: the exact tab names in the exact window order (minus "Running",
 *          which cryoflow's own run dialog owns)
 *  - options: key/label/type/default/min/max/step/radio/help (+ the
 *          command-line flag extracted from getCommands*Job)
 *
 * Consumers:
 *  - workflow.ts applyRelionParamTable(): appends the missing ParamSchemas
 *    and the RELION tab list onto each JOB_TYPES spec
 *  - engine.ts appendRelionFlags(): emits --flag tokens for non-default
 *    params whose flag isn't already on the argv line
 *
 * Re-run after RELION source updates: python3 relion-src/parse_options.py
 * && node scripts/gen-relion-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const IN = "/home/z/relion-options.json";
const OUT = new URL("../src/lib/relion/option-tables.ts", import.meta.url).pathname;

const raw = JSON.parse(readFileSync(IN, "utf8"));

// cryoflow type keys that have no RELION counterpart (custom lanes)
const SKIP = new Set(["cs2star", "rebalance", "mapimport", "select2d"]);

// Hand-curated ALIASES: cryoflow's curated param key ↔ RELION joboption key
// for the SAME underlying flag/semantics (labels often differ). When the
// RELION key is an alias of an existing curated key, the generated
// ParamSchema is NOT appended (the curated one stays the single control)
// and the engine's generic layer skips it (the curated builder already
// emits its flag — reading EITHER key so old DB rows keep working).
//
// t375 — the curated reads that consume each alias live in
// src/lib/relion/engine.ts (search "aliasNum" / "either-key").
const ALIASES = {
  class2d: {
    numClasses: "nr_classes", tau2Fudge: "tau_fudge",
    particleDiameter: "particle_diameter", psiSampling: "psi_sampling",
    doCtf: "do_ctf_correction", doZeroMask: "do_zero_mask", doCenter: "do_center",
    ctfIntactFirstPeak: "ctf_intact_first_peak", allowCoarser: "allow_coarser",
    offsetRange: "offset_range", offsetStep: "offset_step",
    skipAlign: "dont_skip_align", // INVERTED twin: --skip_align rides when either is the "skip" side
    iterations: "nr_iter_em", highresLimit: "highres_limit",
    batchSize: "nr_pool", scratchDir: "scratch_dir",
    prereadImages: "do_preread_images", parallelDiscIo: "do_parallel_discio",
    combineThruDisc: "do_combine_thru_disc",
  },
  initialmodel: {
    numClasses: "nr_classes", symmetry: "sym_name",
    particleDiameter: "particle_diameter", iterations: "nr_iter",
    tau2Fudge: "tau_fudge", doCtf: "do_ctf_correction",
    ctfIntactFirstPeak: "ctf_intact_first_peak", batchSize: "nr_pool",
    scratchDir: "scratch_dir", prereadImages: "do_preread_images",
    parallelDiscIo: "do_parallel_discio", combineThruDisc: "do_combine_thru_disc",
  },
  class3d: {
    numClasses: "nr_classes", tau2Fudge: "tau_fudge", iterations: "nr_iter",
    particleDiameter: "particle_diameter", symmetry: "sym_name",
    padding: "do_pad1", doCtf: "do_ctf_correction",
    ctfIntactFirstPeak: "ctf_intact_first_peak", doBlush: "do_blush",
    doZeroMask: "do_zero_mask", doFastSubsets: "do_fast_subsets",
    highresLimit: "highres_limit", sampling: "sampling",
    offsetRange: "offset_range", offsetStep: "offset_step",
    allowCoarser: "allow_coarser", localSigmaAng: "sigma_angles",
    relaxSym: "relax_sym", batchSize: "nr_pool", scratchDir: "scratch_dir",
    prereadImages: "do_preread_images", parallelDiscIo: "do_parallel_discio",
    combineThruDisc: "do_combine_thru_disc", skipAlign: "dont_skip_align",
  },
  refine3d: {
    symmetry: "sym_name", particleDiameter: "particle_diameter",
    iniHigh: "ini_high", padding: "do_pad1", doCtf: "do_ctf_correction",
    ctfIntactFirstPeak: "ctf_intact_first_peak", doBlush: "do_blush",
    doZeroMask: "do_zero_mask", doSolventFsc: "do_solvent_fsc",
    samplingStep: "sampling", autoLocalSampling: "auto_local_sampling",
    autoFaster: "auto_faster", iterations: "nr_iter", tau2Fudge: "tau_fudge",
    offsetRange: "offset_range", offsetStep: "offset_step", relaxSym: "relax_sym",
    batchSize: "nr_pool", scratchDir: "scratch_dir",
    prereadImages: "do_preread_images", parallelDiscIo: "do_parallel_discio",
    combineThruDisc: "do_combine_thru_disc",
  },
  extract: {
    boxSize: "extract_size", downsampleTo: "rescale", bgDiameter: "bg_diameter",
    norm: "do_norm",
  },
  ctffind: {
    // t375 — the curated CTFFIND knobs and their RELION twins (initialiseCtffind
    // Job, pipeline_jobs.cpp:1733-1738); phaseShift is do_phaseshift's twin.
    resMin: "resmin", resMax: "resmax", dFMin: "dfmin", dFMax: "dfmax",
    phaseShift: "do_phaseshift",
  },
  autopick: {
    logDiamMin: "log_diam_min", logDiamMax: "log_diam_max",
    logAdjustThreshold: "log_adjust_thr", logUpperThreshold: "log_upper_thr",
    logInvert: "log_invert", threshold: "threshold_autopick",
    minDistance: "mindist_autopick", maxStddevNoise: "maxstddevnoise_autopick",
    lowpass: "lowpass", topazDiameter: "topaz_particle_diameter",
    topazNrParticles: "topaz_nr_particles",
  },
  motioncorr: {
    dosePerFrame: "dose_per_frame", bfactor: "bfactor",
    patchX: "patch_x", patchY: "patch_y",
  },
  maskcreate: {
    lowpass: "lowpass_filter", threshold: "inimask_threshold",
    extend: "extend_inimask", softEdge: "width_mask_edge",
  },
  postprocess: {
    autoBfac: "do_auto_bfac", autobLowres: "autob_lowres",
    adhocBfac: "adhoc_bfac",
  },
  localres: {
    adhocBfac: "adhoc_bfac", // RELION's localres default is also -100
  },
  polish: {
    evalFrac: "eval_frac", firstFrame: "first_frame", lastFrame: "last_frame",
  },
  ctfrefine: {
    beamtilt: "do_tilt",
  },
  subtract: {
    recenter: "do_center_mask", float16: "do_float16", newBox: "new_box",
  },
  multibody: {
    offsetStep: "offset_step",
  },
  dynamight: {
    nGaussians: "nr_gaussians", regFactor: "reg_factor",
  },
  modelangelo: {
    hhsearch: "do_hhmer",
  },
  tomo_aligntiltseries: {
    thickness: "tomogram_thickness", fiducialDiameter: "fiducial_diameter",
  },
  tomo_tomograms: {
    binnedAngpix: "binned_angpix",
  },
  tomo_ctfrefine: {
    boxSize: "box_size", focusRange: "focus_range", doRegDef: "do_reg_def",
  },
  tomo_polish: {
    boxSize: "box_size", maxError: "max_error",
  },
  tomo_reconstruct: {
    boxSize: "box_size",
  },
  tomo_extract: {
    boxSize: "box_size",
  },
  tomo_denoise: {
    subvolumeDimensions: "subvolume_dimensions",
    trainingSubvolumes: "number_training_subvolumes",
  },
  // (an un-aliased RELION key that shares a flag with a curated key is still
  //  safe: the engine layer dedupes by flag token, and the UI shows both —
  //  the alias pass below removes obvious label twins)
};

// t375 — FLAG FIXES. The codegen's flag extraction is heuristic; for the
// options below the extracted flag is WRONG (it belongs to a different
// option, is gated behind a mode dispatcher, or needs a value transform).
// null = "GUI-only/dispatcher": the schema (label/help/default) stays in the
// table for the UI, but the generic engine layer never emits it — the
// curated builder in engine.ts owns the emission, mirroring the
// getCommands*Job lines quoted at each entry.
const FLAG_FIXES = {
  class2d: {
    do_bimodal_psi: null,             // pipeline_jobs.cpp:3317 — only under do_helix
    do_restrict_xoff: null,            // :3327-3329 — pushes --helix --helical_rise_initial
    helical_rise: null,                // :3329 — rides --helical_rise_initial under do_restrict_xoff
    helical_tube_outer_diameter: null, // :3313 — under do_helix
    use_gpu: null, gpu_ids: null,      // cryoflow's run dialog owns GPU allocation
  },
  initialmodel: {
    do_run_C1: null,                   // :3520-3527 — --sym C1 + the align_symmetry post-step
    sigma_tilt: null,                  // :3492 — tomo-only branch
    use_gpu: null, gpu_ids: null,
  },
  class3d: {
    ref_correct_greyscale: null,       // :3916-3917 — INVERTED: --firstiter_cc rides when FALSE
    do_local_ang_searches: null,       // :4003 — gates --sigma_ang <sigma_angles/3>
    sigma_angles: null,                // :4005 — value/3 transform
    do_apply_helical_symmetry: null,   // :4043 — gates the asu/twist/rise/z% suite
    do_local_search_helical_symmetry: null, // :4053
    keep_tilt_prior_fixed: null,       // :4075 — under do_helix
    helical_z_percentage: null,        // :4049-4051 — value/100 transform
    helical_nr_asu: null, helical_twist_initial: null, helical_rise_initial: null,
    helical_twist_min: null, helical_twist_max: null, helical_twist_inistep: null,
    helical_rise_min: null, helical_rise_max: null, helical_rise_inistep: null,
    helical_tube_inner_diameter: null, helical_tube_outer_diameter: null, // :4035-4042, under do_helix
    helical_range_distance: null,      // :4097-4100 — value/3 transform
    range_rot: null, range_tilt: null, range_psi: null, // :4079-4095 — clamp/3 transforms
    do_pad1: null,                     // aliased to curated `padding`
    use_gpu: null, gpu_ids: null,
  },
  refine3d: {
    ref_correct_greyscale: null,       // :4406-4407 — INVERTED: --firstiter_cc rides when FALSE
    auto_faster: null,                 // :4440-4443 — PAIR --auto_ignore_angles --auto_resol_angles
    do_solvent_fsc: null,              // :4469-4470 — gated by fn_mask presence
    do_apply_helical_symmetry: null,   // :4525
    do_local_search_helical_symmetry: null, // :4535
    keep_tilt_prior_fixed: null,       // :4585
    helical_z_percentage: null,        // :4531-4533
    helical_nr_asu: null, helical_twist_initial: null, helical_rise_initial: null,
    helical_twist_min: null, helical_twist_max: null, helical_twist_inistep: null,
    helical_rise_min: null, helical_rise_max: null, helical_rise_inistep: null,
    helical_tube_inner_diameter: null, helical_tube_outer_diameter: null,
    helical_range_distance: null, range_rot: null, range_tilt: null, range_psi: null,
    do_pad1: null, use_gpu: null, gpu_ids: null,
  },
  extract: {
    do_rescale: null,                  // :2588 — gates --scale <rescale>
    do_fom_threshold: null,            // :2572 — gates --minimum_pick_fom
    minimum_pick_fom: null,             // :2574 — under the same gate
    do_recenter: null, do_reset_offsets: null, // :2501-2521 — do_reextract only
    recenter_x: null, recenter_y: null, recenter_z: null,
    helical_bimodal_angular_priors: null, // :2618 — under do_extract_helix
    do_extract_helical_tubes: null,       // :2620 — under do_extract_helix
    do_cut_into_segments: null,          // :2623 — under tubes
    helical_nr_asu: null, helical_rise: null, // :2626-2630 — under cut_into_segments
    helical_tube_outer_diameter: null,    // :2617 — under do_extract_helix
  },
  autopick: {
    do_refs: null, do_log: null, do_topaz: null, // I/O-tab method radios (:2158-2166)
    do_ctf_autopick: null,              // :2341-2346 — References mode only
    do_ignore_first_ctfpeak_autopick: null, // :2344
    do_invert_refs: null,               // :2338-2339 — References mode only
    shrink: null,                       // :2349 — References mode only
    psi_sampling_autopick: null,        // :2347 — References mode only
    angpix_ref: null,                   // :2362 — References mode only
    highpass: null,                     // :2354 — References mode only
    minavgnoise_autopick: null,         // :2374 — References mode only
    helical_nr_asu: null, helical_rise: null, // :2366-2368 — --min_distance <asu*rise> composition
    topaz_filament_threshold: null,     // :2254 — do_topaz_filaments only
    topaz_hough_length: null,           // :2257 — do_topaz_filaments only
    log_maxres: null,                   // :2286 — PAIR --shrink 0 --lowpass (mis-extracted as --shrink)
    do_topaz_filaments: null,           // :2251-2259 — gates --helix + --topaz_threshold
    do_pick_helical_segments: null,     // :2367-2387 — composes --min_distance, gates --helix
    do_amyloid: null,                   // :2382-2383 — nested under helical segments
    use_gpu: null, gpu_ids: null,
  },
  ctffind: {
    slow_search: null,                  // :1838-1842 — INVERTED: --fast_search rides when NOT slow_search
  },
  motioncorr: {
    do_save_noDW: null,                // :1644-1647 — under do_dose_weighting
    gpu_ids: null,                     // cryoflow's run dialog owns GPU allocation
    fn_motioncor2_exe: null,           // :1581 — the curated builder resolves the exe (probe/user value)
    other_motioncor2_args: null,       // :1589-1590 — motioncor2 lane only (quoted wrapper arg)
  },
  postprocess: {
    do_adhoc_bfac: null,               // :5364-5367 — gates --adhoc_bfac <value>
    do_skip_fsc_weighting: null,       // :5370-5374 — PAIR --skip_fsc_weighting --low_pass
    fn_mtf: null, mtf_angpix: null,    // :5354-5358 — PAIR --mtf --mtf_angpix
    low_pass: null,                    // :5373 — rides only inside the skip-FSC pair
  },
  localres: {
    pval: null, minres: null, maxres: null, stepres: null, // :5492-5495 — ResMap-wrapper CLI flags
  },
  polish: {
    do_polish: null, do_own_params: null, // :5932-5948 — mode/gate flags
    sigma_vel: null, sigma_div: null, sigma_acc: null, // :5937-5939 — under do_own_params
    extract_size: null, rescale: null, // :5967-5987 — PAIR --window/--scale with the both-or-neither check
    optim_min_part: null,              // :5915 — do_param_optim (training) mode only
  },
  ctfrefine: {
    do_ctf: null,                      // :6116-6133 — gates --fit_defocus --kmin_defocus --fit_mode
    minres: null,                      // :6105/6118/6140 — becomes kmin_mag / kmin_defocus / kmin_tilt per mode
    do_trefoil: null,                  // :6142-6145 — under do_tilt
    do_tilt: null,                     // :6137-6140 — PAIR --fit_beamtilt --kmin_tilt
    do_4thorder: null,                 // :6148-6151 — under !do_aniso_mag
    do_aniso_mag: null,                // :6100-6105 — PAIR --fit_aniso --kmin_mag (exclusive with the rest)
  },
  maskcreate: {
    helical_z_percentage: null,        // :4962-4965 — --z_percentage <value/100> under do_helix
    do_helix: null,                    // :4962-4964 — PAIR with the z_percentage (composes in one line)
  },
  subtract: {
    do_center_xyz: null,               // :5243-5248 — gates --center_x/y/z (mis-extracted as --center_x)
    center_x: null, center_y: null, center_z: null, // :5245-5247 — under do_center_xyz
    fn_fliplabel: null,               // :5197 — --revert under do_fliplabel only
    do_float16: null, new_box: null,   // aliased (float16/newBox) — curated builder owns them
  },
  joinstar: {
    fn_part1: null, fn_mic1: null, fn_mov1: null, // :5047/5081/5115 — --combine (mis-extracted; the builder owns it)
  },
  multibody: {
    // the whole table is the builder's: the actual command is relion_refine
    // --continue + relion_flex_analyse (getCommandsMultiBodyJob,
    // pipeline_jobs.cpp:4694-4902) — half the table's flags belong to the
    // SECOND command and would poison the first.
    fn_bodies: null,                   // :4746 — --multibody_masks (mis-extracted as --bodies)
    fn_cont: null, fn_in: null,        // :4735/4743 — --continue (the builder owns the optimiser input)
    sampling: null,                   // :4754-4763 — healpix-1 composition with oversampling 1
    offset_range: null, offset_step: null, // :4766-4768 — step is ×2^iover
    do_pad1: null,                     // :4788-4791 — --pad 1|2 VALUE (flag extraction lost the value)
    do_combine_thru_disc: null,        // :4779-4780 — INVERTED --dont_combine_weights_via_disc
    do_parallel_discio: null,         // :4781-4782 — INVERTED --no_parallel_disc_io
    do_preread_images: null, scratch_dir: null, // :4783-4786 — either/or with scratch
    nr_pool: null,                     // :4787 — --pool
    do_blush: null, do_subtracted_bodies: null, // :4772-4776
    do_analyse: null, nr_movies: null,  // :4808-4852 — flex_analyse command flags
    do_select: null, select_eigenval: null, eigenval_min: null, eigenval_max: null, // :4856-4872
    use_gpu: null, gpu_ids: null,      // cryoflow's run dialog owns GPU allocation
  },
  modelangelo: {
    E: null, F1: null, F2: null, F3: null, // :5791-5794 — hmm_search command flags (2nd command)
    do_hhmer: null, fn_lib: null, alphabet: null, // :5774-5788 — the hmm_search gate
  },
  dynamight: {
    halfset: null,                     // :5632 — explore-latent-space mode only
    nr_epochs: null,                   // :5643 — optimize-inverse-deformations mode only
    backproject_batchsize: null,       // :5657 — deformable-backprojection mode only
    fn_checkpoint: null,               // :5634/5645/5659 — the three analysis modes (not optimize-deformations)
    do_store_deform: null,             // :5648-5649 — inverse mode only
    do_visualize: null, do_inverse: null, do_reconstruct: null, // :5628-5656 — sub-command radios
  },
  tomo_aligntiltseries: {
    do_aretomo_phaseshift: null,       // :6640-6642 — nested under do_aretomo_ctf
    fn_aretomo_exe: null,              // :6624 — the curated builder resolves AreTomo2
    fn_batchtomo_exe: null,            // :6617/6643 — the builder resolves batchruntomo
    other_aretomo_args: null,          // :6666 — AreTomo2 lane only (quoted wrapper arg)
    gpu_ids: null,                     // :6667 — the builder owns --gpu (t349 doctrine)
  },
  tomo_tomograms: {
    generate_split_tomograms: null,    // :6729-6738 — gates --generate_split_tomograms (exclusive with do_fourier)
  },
  tomo_ctfrefine: {
    focus_range: null,                  // :7250-7251 — PAIR --d0 <-X> --d1 <X> under do_defocus
    lambda: null,                       // :7253-7254 — PAIR --do_reg_defocus --lambda (mis-extracted as --do_reg_defocus)
    do_defocus: null,                  // :7247-7251 — gates the d0/d1 pair
    do_reg_def: null,                   // :7253-7254 — gates --lambda
    do_scale: null,                     // :7257-7268 — gates per_frame/per_tomo
    do_frame_scale: null, do_tomo_scale: null, // :7260-7266 — under do_scale
  },
  tomo_polish: {
    shift_align_type: null,            // :7406-7411 — --shift_only_by_particles under do_shift_align (mis-extracted)
    do_shift_align: null, do_motion: null, // :7393-7422 — mode radios
    sigma_vel: null, sigma_div: null, do_sq_exp_ker: null, // :7413-7422 — under do_motion
  },
  tomo_reconstruct: {
    do_helix: null,                    // :7516-7521 — gates --nr_helical_asu/--helical_twist/--helical_rise (mis-extracted as --nr_helical_asu)
    helical_z_percentage: null,        // :7553 — helix_toolbox --impose step (2nd command), value/100
    helical_tube_outer_diameter: null, // :7554 — impose step --cyl_outer_diameter (2nd command)
  },
  tomo_denoise: {
    do_cryocare_predict: null,         // :6850-6853 — mode radio (mis-extracted as --do_cryocare_train)
    ntiles_x: null, ntiles_y: null, ntiles_z: null, // :6900-6902 — TRIPLE --n-tiles x y z under predict
    care_denoising_model: null,        // :6896-6899 — predict mode only
    denoising_tomo_name: null,         // :6892-6894 — predict mode only
    number_training_subvolumes: null,  // :6886-6891 — train mode only (aliased)
    subvolume_dimensions: null,        // :6890 — train mode only (aliased)
    tomograms_for_training: null,      // :6888 — train mode only
  },
  tomo_picks: {
    in_star_file: null,                // :6939-6948 — belongs to the particles-from-star PRE-step
    particle_spacing: null,            // :6989-6991 — belongs to the get_particle_poses POST-step
  },
  tomo_extract: {
    max_dose: null, min_frames: null, crop_size: null, // :7102-7112 — >0 gates (generic ≠-1 would ride 0)
  },
};

// t375 — RADIO FIXES. RELION declares some radios through named C++ arrays
// (pipeline_jobs.h:119-160); the codegen saw only the identifier and fell
// back to a junk text default ("job_gain_rotation_options"). Substitute the
// real option lists so the UI renders proper radios. The list is verbatim
// from pipeline_jobs.h; the DEFAULT index is 0 unless RADIO_JOB_DEFAULTS
// says otherwise (RELION's own JobOption constructor index).
const RADIO_FIXES = {
  job_gain_rotation_options: ["No rotation (0)", "90 degrees (1)", "180 degrees (2)", "270 degrees (3)"],
  job_gain_flip_options: ["No flipping (0)", "Flip upside down (1)", "Flip left to right (2)"],
  job_ctffit_options: ["No", "Per-micrograph", "Per-particle"],
  job_sampling_options: ["30 degrees", "15 degrees", "7.5 degrees", "3.7 degrees", "1.8 degrees", "0.9 degrees", "0.5 degrees", "0.2 degrees", "0.1 degrees"],
  job_modelangelo_alphabet_options: ["amino", "DNA", "RNA"],
  job_tomo_align_shiftonly_options: ["Entire micrographs", "Only particles"],
  job_tomo_pick_mode: ["particles", "spheres", "surfaces", "filaments"],
};

// t375 — RELION's default INDEX into a named radio array, per job type +
// option key (the codegen's raw default loses the index):
//   multibody sampling: index 4 = "1.8 degrees"  (pipeline_jobs.cpp:4737+)
//   tomo_picks pick_mode: index 1 = "spheres"    (:6919)
const RADIO_JOB_DEFAULTS = {
  multibody: { sampling: 4 },
  tomo_picks: { pick_mode: 1 },
};

function tsType(t) {
  switch (t) {
    case "bool": return '"bool"';
    case "number": return '"number"';
    case "radio": return '"select"';
    case "node":
    case "filename": return '"path"';
    default: return '"text"';
  }
}

function esc(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\\n")
    .slice(0, 900);
}

const lines = [];
lines.push(`/* eslint-disable */
/**
 * AUTO-GENERATED from RELION 5.0.0 sources (tag 5.0.0):
 *   - src/pipeline_jobs.cpp  (option definitions + getCommands flag mapping)
 *   - src/gui_jobwindow.cpp  (tab layout: names, order, expert toggles)
 * by scripts/gen-relion-options.mjs — DO NOT EDIT BY HAND.
 *
 * Tabs are RELION's own window tabs in RELION's own order (the "Running"
 * tab is omitted: cryoflow's run dialog owns MPI/threads/GPU/queue).
 * "world": "spa" | "tomo" | "both" — options placed inside an
 * if (is_tomo) / if (!is_tomo) branch of the RELION window.
 */
export type RelionOptionType = "bool" | "number" | "text" | "path" | "select";

export interface RelionOptionSpec {
  key: string;
  label: string;
  type: RelionOptionType;
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  radio?: string[];
  help: string;
  /** command-line flag (from getCommandsXXXJob); absent = GUI-only/dispatcher */
  flag?: string;
}

export interface RelionTabSpec {
  label: string;
  options: { key: string; expert: boolean; world: "spa" | "tomo" | "both" }[];
}

export interface RelionJobOptions {
  tabs: RelionTabSpec[];
  options: Record<string, RelionOptionSpec>;
}

export const RELION_OPTIONS: Record<string, RelionJobOptions> = {`);

for (const jk of Object.keys(raw).sort()) {
  if (SKIP.has(jk)) continue;
  const e = raw[jk];
  const flagFixes = FLAG_FIXES[jk] ?? {};
  lines.push(`  ${JSON.stringify(jk)}: {`);
  lines.push(`    tabs: [`);
  for (const t of e.tabs) {
    lines.push(`      { label: ${JSON.stringify(t.label)}, options: [`);
    for (const o of t.options) {
      lines.push(
        `        { key: ${JSON.stringify(o.key)}, expert: ${o.expert ? "true" : "false"}, world: ${JSON.stringify(o.world === "spaOnly" ? "spa" : o.world === "tomoOnly" ? "tomo" : o.world)} },`
      );
    }
    lines.push(`      ] },`);
  }
  lines.push(`    ],`);
  lines.push(`    options: {`);
  for (const [k, o] of Object.entries(e.options)) {
    // t375 — named-array radios (job_gain_rotation_options …) become real
    // radios; the junk identifier default becomes RELION's own default entry
    // (RADIO_JOB_DEFAULTS carries the constructor's index where it isn't 0).
    let radioOpts = Array.isArray(o.radio) ? o.radio : null;
    if (!radioOpts && typeof o.default === "string" && RADIO_FIXES[o.default]) {
      radioOpts = RADIO_FIXES[o.default];
      o.type = "radio";
      const defIdx = RADIO_JOB_DEFAULTS[jk]?.[k] ?? 0;
      o.default = radioOpts[Math.min(defIdx, radioOpts.length - 1)];
    }
    const parts = [
      `key: ${JSON.stringify(k)}`,
      `label: ${JSON.stringify(String(o.label).slice(0, 120))}`,
      `type: ${tsType(o.type)}`,
      `default: ${JSON.stringify(o.default ?? "")}`,
    ];
    if (o.min != null && o.type === "number") parts.push(`min: ${o.min}`);
    if (o.max != null && o.type === "number" && o.max > o.min) parts.push(`max: ${o.max}`);
    if (o.step != null && o.type === "number") parts.push(`step: ${o.step}`);
    if (radioOpts) parts.push(`radio: ${JSON.stringify(radioOpts)}`);
    // t375 — the flag-fix pass: null drops a wrongly-extracted/gated flag
    // (dispatcher → curated builder owns it); unknown keys are inert.
    const fixedFlag = flagFixes[k];
    if (fixedFlag !== undefined) {
      if (fixedFlag !== null) parts.push(`flag: ${JSON.stringify(fixedFlag)}`);
    } else if (o.flag) {
      parts.push(`flag: ${JSON.stringify(o.flag.trim())}`);
    }
    parts.push(`help: ${"`" + esc(o.help) + "`"}`);
    lines.push(`      ${JSON.stringify(k)}: { ${parts.join(", ")} },`);
  }
  lines.push(`    },`);
  lines.push(`  },`);
}
lines.push(`};`);

lines.push(`
/**
 * Curated alias map: cryoflow's curated param key → the RELION joboption key
 * it already controls (same flag, same semantics). Used by the spec merge so
 * the RELION twin of an existing control is not appended a second time.
 */
export const RELION_ALIASES: Record<string, Record<string, string>> = ${JSON.stringify(ALIASES, null, 2)};
`);

writeFileSync(OUT, lines.join("\n"));
console.log(`wrote ${OUT} (${lines.length} lines, ${Object.keys(raw).filter((k) => !SKIP.has(k)).length} jobs)`);

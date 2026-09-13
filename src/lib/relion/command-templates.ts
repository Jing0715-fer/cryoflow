/**
 * Canonical RELION 5.0.1 command templates (extracted from pipeline_jobs.cpp).
 * <...> placeholders are substituted with real paths/params by buildArgv().
 *
 * Task 170 — this table moved OUT of engine.ts (server-only: child_process
 * imports) into a client-safe module so the inspector can speak the shape of
 * the command BEFORE the first launch: a never-run job's "Command line"
 * section renders this template as an honest preview ("the shape the engine
 * will run — paths substitute at launch") instead of rendering nothing. The
 * engine re-exports it for backward compatibility; server consumers keep
 * importing from engine, client consumers import from here.
 *
 * Engine-native types (import / manualpick / select / select2d / symexpand /
 * rebalance) never reach buildArgv — their entries read "engine-native: …"
 * and the preview shows the native description verbatim (the same dialect
 * runRealJob's native branch speaks).
 */
export const COMMAND_TEMPLATES: Record<string, string> = {
  import: "engine-native: write micrographs.star (RELION 5 optics format)",
  motioncorr: "relion_run_motioncorr --i <micrographs.star> --o <outdir>/ --use_motioncor2 --motioncor2_exe <mc2> --bin_factor <bf> --bfactor <bfac> --dose_per_frame <dose> --patch_x <px> --patch_y <py> --j <n>",
  ctffind: "relion_run_ctffind --i <micrographs.star> --o <outdir>/ --Box <box> --ResMin <rmin> --ResMax <rmax> --dFMin <dmin> --dFMax <dmax> --FStep 500 --dAst 0 --is_ctffind4 --fast_search [--ctffind_exe <ctffind>]",
  manualpick: "engine-native: import Henderson .coord picks → manualpick.star (_rlnCoordinateX/Y + _rlnMicrographName)",
  autopick: "relion_autopick --i <micrographs.star> --odir <outdir>/ --pickname autopick [--LoG --LoG_diam_min <Å> --LoG_diam_max <Å> --LoG_adjust_threshold <t> | --ref <refs.mrc> --particle_diameter <dia> --threshold <thr> --lowpass <lp> | --topaz_extract --fn_topaz_exe <topaz> --topaz_nr_particles <n> --topaz_threshold <t> --particle_diameter <Å> [--topaz_model <trained.sav>]]",
  topaztrain: "relion_autopick --i <micrographs.star> --odir <outdir>/ --topaz_train --fn_topaz_exe <topaz> --topaz_train_picks <picked_coords.star> --topaz_nr_particles <n> --topaz_threshold <t> --particle_diameter <Å> --topaz_test_ratio <r> → topaz_model.sav",
  extract: "relion_preprocess --i <micrographs_ctf.star> --coord_list <coords.star> --part_star <outdir>/particles.star --part_dir <outdir>/ --extract --extract_size <box> [--scale <down>] --norm --bg_radius <bgr> --white_dust 3 --black_dust -3",
  select: "engine-native: particle selection — class-aware occupancy pruning when input has _rlnClassNumber, else first-N",
  select2d: "engine-native: 2D class selection — keep particles whose _rlnClassNumber is in the selected set (gallery picks or auto occupancy ≥ cutoff × best) → particles_select2d.star",
  class2d: "relion_refine --i <particles.star> --o <outdir>/run --K <K> --tau2_fudge 1 --particle_diameter <dia> --ctf --pad 2 --iter <it> --flatten_solvent --zero_mask --j 4",
  initialmodel: "relion_refine --grad --denovo_3dref --i <particles.star> --o <outdir>/run --K <K> --particle_diameter <dia> --sym <sym> --ctf --iter <it> --flatten_solvent --zero_mask",
  class3d: "mpirun -n 2 relion_refine --i <particles.star> --ref <ref.mrc> --o <outdir>/run --K <K> --tau2_fudge 4 --particle_diameter <dia> --sym <sym> --ctf --pad 2 --iter <it> --flatten_solvent",
  refine3d: "mpirun -n 3 relion_refine --i <particles.star> --ref <ref.mrc> --o <outdir>/run --sym <sym> --particle_diameter <dia> --ctf --pad <pad> --firstiter_cc --ini_high <iniHigh> --trust_ref_size --split_random_halves [--auto_refine | --iter <it> --tau2_fudge 1]",
  multibody: "mpirun -n 2 relion_refine --continue <optimiser.star> --o <outdir>/run --solvent_correct_fsc --multibody_masks <bodies.star> --oversampling 1",
  symexpand: "engine-native: point-group expansion — every particle row replicated |G|× with composed ZYZ Euler angles → particles_symexpand.star (icosahedral-symmetry-expander algorithm)",
  rebalance: "engine-native: orientation balancing — fib-sphere binning + 3DFSC estimates + per-bin percentile trimming (Orient-Rebalancer core) → particles_rebalance.star + rebalance_report.json",
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

/**
 * The types runRealJob executes through its NATIVE branches (no RELION
 * binary, no buildArgv). Kept beside the table because the preview route
 * and the inspector's preview both need the same split: native types
 * answer with the template's "engine-native: …" description verbatim,
 * CLI types upgrade to the real argv when inputs resolve.
 */
export const ENGINE_NATIVE_TYPES: ReadonlySet<string> = new Set([
  "import",
  "manualpick",
  "select",
  "select2d",
  "symexpand",
  "rebalance",
]);

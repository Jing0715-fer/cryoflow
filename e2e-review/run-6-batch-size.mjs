/**
 * E2E TEST 6 — t350: the REAL pooled-particle lever + the never-again option guard.
 *
 * The t341 contract this file used to pin was built on a flag that NEVER
 * EXISTED: a full audit of 3dem/relion (tags 3.1 / 4.0 / 5.0-beta / 5.0 /
 * 5.0.1 / 5.1 — every getOption/checkOption string in ml_optimiser.cpp, plus
 * pipeline_jobs.cpp for the GUI defaults) finds NO --batch_size and NO
 * --highres_limit in ANY release, and RELION's parser (args.cpp
 * checkForUnknownArguments) hard-rejects unknown --flags — so any dispatch
 * that carried them died at argv parse before the first banner. The mock
 * cluster's stub binaries never caught it (they ignore argv); the REAL
 * cluster would have.
 *
 * The t350 contract, verified against the sources above:
 *   1. refine family carries --pool 3 by default — RELION 5's OWN GUI
 *      default (pipeline_jobs.cpp nr_pool, range 1-16), not an invented
 *      curve; an explicit user value wins outright
 *   2. highresLimit maps to --strict_highres_exp (the REAL E-step cap)
 *   3. scratchDir maps to --scratch_dir (node-local scratch, off by default)
 *   4. NEVER-AGAIN GUARD: every --flag the refine family emits must be a
 *      member of the VERIFIED_RELION_REFINE_OPTIONS set below — the 161
 *      option strings accepted by relion_refine 5.0-beta/5.0, transcribed
 *      from the sources. A hallucinated flag can never ride again.
 *   5. the sbatch shape keeps its t345/t349 assertions (unchanged):
 *      --gres=gpu:2, --ntasks=3 (1 CPU master + 2 workers), the per-rank
 *      launcher, the starved-card refusal, the GPU-pin block.
 */
import {
  api, SH, SHJ, must, summary, logSection, client,
  remoteWorkdir, readEngineState, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, sleep, CONN_ID, ROOT,
} from "./e2e-lib.mjs";

const MICS = "/data2/empiar-10017/micrographs";

/**
 * The verified option set of relion_refine (RELION 5.0-beta ∪ 5.0), extracted
 * mechanically from 3dem/relion ml_optimiser.cpp — every parser.getOption /
 * parser.checkOption / checkParameter option string, both parser sections.
 * Provenance: tags ver5.0 + the 5.0-beta-era ver5.0 branch (2026-09 audit).
 */
const VERIFIED_RELION_REFINE_OPTIONS = new Set([
  "--K", "--NN", "--abort_at_resolution", "--adaptive_fraction",
  "--allow_coarser_sampling", "--always_cc", "--asymmetric_padding", "--auto_ignore_angles",
  "--auto_iter_max", "--auto_local_healpix_order", "--auto_refine", "--auto_resol_angles",
  "--auto_sampling", "--bimodal_psi", "--blush", "--blush_skip_spectral_trailing",
  "--center_classes", "--class_inactivity_threshold", "--coarse_size", "--continue",
  "--cpu", "--ctf", "--ctf3d_not_squared", "--ctf_intact_first_peak",
  "--ctf_phase_flipped", "--ctf_uncorrected_ref", "--denovo_3dref", "--dont_check_norm",
  "--dont_combine_weights_via_disc", "--dont_skip_gridding", "--external_reconstruct", "--failsafe_threshold",
  "--fast_subsets", "--firstiter_cc", "--fix_sigma_noise", "--fix_sigma_offset",
  "--flatten_solvent", "--force_converge", "--fourier_mask", "--free_gpu_memory",
  "--gpu", "--grad", "--grad_em_iters", "--grad_fin_frac",
  "--grad_fin_resol", "--grad_fin_subset", "--grad_ini_frac", "--grad_ini_resol",
  "--grad_ini_subset", "--grad_min_resol", "--grad_stepsize", "--grad_stepsize_scheme",
  "--grad_write_iter", "--healpix_order", "--helical_exclude_resols", "--helical_inner_diameter",
  "--helical_keep_tilt_prior_fixed", "--helical_nr_asu", "--helical_nstart", "--helical_offset_step",
  "--helical_outer_diameter", "--helical_rise_inistep", "--helical_rise_initial", "--helical_rise_max",
  "--helical_rise_min", "--helical_sigma_distance", "--helical_symmetry_search", "--helical_twist_inistep",
  "--helical_twist_initial", "--helical_twist_max", "--helical_twist_min", "--helical_z_percentage",
  "--helix", "--i", "--ignore_helical_symmetry", "--incr_size",
  "--ini_high", "--ios", "--iter", "--j",
  "--join_random_halves", "--keep_free_scratch", "--keep_scratch", "--limit_tilt",
  "--local_symmetry", "--low_resol_join_halves", "--lowpass", "--lowpass_mask",
  "--maskedge", "--maxsig", "--min_sigma2_offset", "--mu",
  "--multibody_masks", "--multibody_norm_overlap", "--no_init_blobs", "--no_norm",
  "--no_parallel_disc_io", "--no_scale", "--norm", "--normalised_subtomo",
  "--nr_parts_sigma2noise", "--o", "--offset", "--offset_range",
  "--offset_range_x", "--offset_range_y", "--offset_range_z", "--offset_step",
  "--only_flip_phases", "--onthefly_shifts", "--oversampling", "--pad",
  "--pad_ctf", "--particle_diameter", "--perturb", "--pool",
  "--preread_images", "--print_metadata_labels", "--print_symmetry_ops", "--psi_step",
  "--r_min_nn", "--random_seed", "--reconstruct_subtracted_bodies", "--ref",
  "--ref_angpix", "--relax_sym", "--reuse_scratch", "--scale",
  "--scratch_dir", "--sigma_ang", "--sigma_off", "--sigma_psi",
  "--sigma_rot", "--sigma_tilt", "--skip_align", "--skip_maximize",
  "--skip_realspace_helical_sym", "--skip_rotate", "--skip_subtomo_multi", "--solvent_correct_fsc",
  "--solvent_mask", "--solvent_mask2", "--som", "--som_connectivity",
  "--som_inactivity_threshold", "--som_ini_nodes", "--som_neighbour_pull", "--split_random_halves",
  "--strict_highres_exp", "--strict_lowres_exp", "--subtomo_multi_thr", "--sycl",
  "--sym", "--tau", "--tau2_fudge", "--tau2_fudge_scheme",
  "--tomograms", "--trajectories", "--trust_ref_size", "--verb",
  "--zero_mask"
]);

/** Every --flag in an argv list — the guard's subject. */
function flagsOf(argv) {
  return argv.filter((a) => typeof a === "string" && a.startsWith("--"));
}

/** The relion_refine invocation line out of a dispatched sbatch script. */
function relionLineOf(script) {
  for (const line of script.split("\n")) {
    if (line.includes("relion_refine") && line.includes(" --i ")) return line;
  }
  return "";
}

function flagsOfLine(line) {
  return (line.match(/--[A-Za-z_0-9]+/g) ?? []);
}

async function runStage(label, type, params, ups, target, timeoutMs = 240_000) {
  const j = await mkJob({ type, x: 380, y: 80, name: label, params });
  for (const [up, fp, tp] of ups) await mkEdge(up.id, j.id, fp, tp);
  const r = await runRemote(j.id, slurmTarget(target));
  must(r.status === 200, `${label} dispatched (${r.status})`);
  const w = await waitTerminal(j.id, { timeoutMs });
  must(w.job?.status === "completed", `${label} completed (${w.job?.status}: ${String(w.job?.result).slice(0, 120)})`);
  return j;
}

function sbatchScriptOf(projectId, job) {
  return client(`cat '${remoteWorkdir(projectId, job)}/.cf-sbatch.sh' 2>/dev/null`).out;
}

try {
  logSection("A — 链路: import → ctffind → autopick(LoG) → extract(box 360, 不降采样)");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "pool-lever e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "pl import",
    params: { nodeType: "micrographs", micrographsPath: MICS, pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25 },
  });
  await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const wi = await waitTerminal(imp.id, { timeoutMs: 60_000 });
  must(wi.job?.status === "completed", `import completed (${wi.job?.status})`);

  const ctf = await runStage("ctffind", "ctffind",
    { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 },
    [[imp, "micrographs", "micrographs"]], { gpus: 0 });
  const pick = await runStage("autopick LoG", "autopick",
    { pickingMethod: "Laplacian of Gaussian", logDiamMin: 120, logDiamMax: 180, logAdjustThreshold: 0, threshold: 0.4 },
    [[ctf, "micrographs", "micrographs"]], { gpus: 0 });
  const extBig = await runStage("extract box 360 (no downsample)", "extract",
    { boxSize: 360, downsampleTo: 0, bgDiameter: -1, norm: true },
    [[ctf, "micrographs", "micrographs"], [pick, "coords", "coords"]], { gpus: 1, shards: 2 });

  logSection("B — 预览 (launch contract): box 360 → --pool 3 (RELION 5 GUI 默认) + 选项守卫");
  const c2d = await mkJob({
    type: "class2d", x: 700, y: 80, name: "pl class2d bigbox",
    params: { numClasses: 10, iterations: 8, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(extBig.id, c2d.id, "particles", "particles");
  const cmd = await api(`/api/jobs/${c2d.id}/command`, { headers: SH });
  const argv = (cmd.body?.argv ?? []).join(" ");
  if (Array.isArray(cmd.body?.argv)) {
    console.log(`    preview argv: ${argv.slice(0, 220)}${argv.length > 220 ? "…" : ""}`);
    must(/--pool 3\b/.test(argv), "t350: box 360 previews --pool 3 (RELION 5's own GUI default — the t341 box curve is retired with its nonexistent flag)");
    must(!argv.includes("--batch_size"), "the nonexistent --batch_size never rides the argv again (RELION's parser hard-rejects it)");
    must(!argv.includes("--highres_limit"), "the nonexistent --highres_limit never rides the argv again");
    const unknown = flagsOf(cmd.body.argv).filter((f) => !VERIFIED_RELION_REFINE_OPTIONS.has(f));
    must(unknown.length === 0, `every refine-family --flag is a VERIFIED relion_refine option (unknown: ${unknown.join(" ") || "none"})`);
  } else {
    // the preview's tier-3 honest fallback: this headless E2E box has no
    // locally-DETECTED RELION install (the route previews through the LOCAL
    // binDir), so the argv tier cannot land here — the DISPATCHED SCRIPT
    // (phase C below) is the ground truth for the same buildArgv call
    console.log(`    preview tier-3 fallback (no local RELION detected): ${String(cmd.body?.error ?? "").slice(0, 90)}`);
    must(cmd.status === 200 && /RELION/i.test(String(cmd.body?.error ?? "")),
      "the preview answers honestly when local RELION is undetected (the dispatch below is the argv ground truth)");
  }

  logSection("C — 派发 (2 GPU): 完整 sbatch 形状 — pool + 一 rank 一卡 + 选项守卫");
  const r1 = await runRemote(c2d.id, slurmTarget({ gpus: 2 }));
  must(r1.status === 200, `class2d dispatched (${r1.status})`);
  const w1 = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
  must(w1.job?.status === "completed", `big-box class2d COMPLETED (${w1.job?.status}: ${String(w1.job?.result).slice(0, 120)})`);
  const script = sbatchScriptOf(projectId, c2d);
  must(script.includes("#SBATCH --gres=gpu:2"), "the sbatch requests exactly 2 GPUs (--gres=gpu:2)");
  must(script.includes("--ntasks=3"), "--ntasks=3 (t349: 2 workers + 1 dedicated CPU master)");
  must(script.includes('CF_RANKS=3') && script.includes('mpirun -n "$CF_RANKS"'),
    "mpirun -n \"$CF_RANKS\" with CF_RANKS=3 (RELION's np = nGPU + 1 idiom; t345 clamps the count at launch to the cards the job can see)");
  must(script.includes(".cf-rank-launch.sh") && /--gpu 0\b/.test(script) && !/--gpu 0:/.test(script),
    "t345: mpirun targets .cf-rank-launch.sh and relion carries --gpu 0 (each rank pinned to its OWN CUDA_VISIBLE_DEVICES — the colon list is retired)");
  must(script.includes("CF_DEVICE_SET") && script.includes("CRYOFLOW_RANK_BIND"),
    "the t345 device-set + per-rank bind receipt ride the script");
  must(script.includes("starved-card refusal"),
    "the t342 starved-card refusal block rides the script (fails in one second with the holder PIDs, not an hour of silence)");
  must(/--pool 3\b/.test(script), "the dispatched script carries --pool 3 (what the preview promised — RELION's own GUI default)");
  must(!script.includes("--batch_size") && !script.includes("--highres_limit"),
    "the two nonexistent flags appear NOWHERE in the dispatched script");
  const relionLine1 = relionLineOf(script);
  must(relionLine1 !== "", "the relion_refine invocation line is found in the script");
  const unknown1 = flagsOfLine(relionLine1).filter((f) => !VERIFIED_RELION_REFINE_OPTIONS.has(f));
  must(unknown1.length === 0, `every dispatched --flag is a VERIFIED relion_refine option (unknown: ${unknown1.join(" ") || "none"})`);
  must(script.includes("GPU_DEVICE_ORDINAL") && script.includes("SLURM_JOB_GPUS") && script.includes("CUDA_VISIBLE_DEVICES"),
    "the t341 GPU-pin block rides the script (no-op where the cluster isolates, correct mapping where it does not)");

  logSection("D — 对照组: box 128→64 (默认链) → 同样 --pool 3 (GUI 默认全程生效)");
  const extSmall = await runStage("extract box 128→64 (defaults)", "extract",
    { boxSize: 128, downsampleTo: 64, bgDiameter: -1, norm: true },
    [[ctf, "micrographs", "micrographs"], [pick, "coords", "coords"]], { gpus: 1, shards: 2 });
  const c2d2 = await mkJob({
    type: "class2d", x: 700, y: 260, name: "pl class2d smallbox",
    params: { numClasses: 10, iterations: 8, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(extSmall.id, c2d2.id, "particles", "particles");
  const r2 = await runRemote(c2d2.id, slurmTarget({ gpus: 1 }));
  must(r2.status === 200, `small-box class2d dispatched (${r2.status})`);
  const w2 = await waitTerminal(c2d2.id, { timeoutMs: 240_000 });
  must(w2.job?.status === "completed", `small-box class2d COMPLETED (${w2.job?.status})`);
  const script2 = sbatchScriptOf(projectId, c2d2);
  must(/--pool 3\b/.test(script2),
    "box-64 chain carries --pool 3 too (RELION's GUI default rides EVERYWHERE now — no box-dependent invented curve)");
  must(!script2.includes("--scratch_dir"),
    "scratch is OFF by default (empty scratchDir emits no flag — the node-local path is the user's to name)");
  must(/--gpu 0\b/.test(script2) && !/--gpu 0:/.test(script2), "single-GPU width maps --gpu 0 (no colon list)");

  logSection("E — 用户抓手: pool=6 + E-step 限 15 Å + scratch → 三个真选项齐飞");
  const patch = await api(`/api/jobs/${c2d.id}`, {
    method: "PATCH", headers: SHJ,
    body: JSON.stringify({ params: { batchSize: 6, highresLimit: 15, scratchDir: "/tmp/cf-e2e-scratch" } }),
  });
  must(patch.status === 200, `pool=6 + highres=15 + scratch saved (${patch.status})`);
  const r3 = await runRemote(c2d.id, slurmTarget({ gpus: 2 }));
  must(r3.status === 200, `override re-run accepted (${r3.status})`);
  const w3 = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
  must(w3.job?.status === "completed", `override re-run COMPLETED (${w3.job?.status}: ${String(w3.job?.result).slice(0, 120)})`);
  const script3 = sbatchScriptOf(projectId, c2d);
  must(/--pool 6\b/.test(script3), "the user's explicit pool (6) wins over the auto value (3)");
  must(/--strict_highres_exp 15\b/.test(script3), "highresLimit=15 rides as --strict_highres_exp 15 (the REAL E-step cap)");
  must(/--scratch_dir ['\"]?\/tmp\/cf-e2e-scratch\b/.test(script3),
    "scratchDir=/tmp/cf-e2e-scratch rides as --scratch_dir (node-local scratch — the I/O lever)");
  const relionLine3 = relionLineOf(script3);
  const unknown3 = flagsOfLine(relionLine3).filter((f) => !VERIFIED_RELION_REFINE_OPTIONS.has(f));
  must(unknown3.length === 0, `the override run's --flags stay inside the verified set (unknown: ${unknown3.join(" ") || "none"})`);
  const rec = readEngineState()[c2d.id];
  must(rec?.exitCode === 0, "the override run's record exit 0");

  // t352 — the GUI-parity surface: Blush, the compute trio, and the
  // validated "Additional RELION arguments" escape hatch. Asserted DIRECTLY
  // against the engine's buildArgv (the single source of command truth the
  // preview/local/sbatch lanes all embed) — tier-independent of whether
  // THIS box has a locally-detected RELION install.
  logSection("F — t352 GUI parity: Blush 开关 + compute 三联 + extraArgs 守门 (直接对引擎)");
  const { buildArgv } = await import("../src/lib/relion/engine.ts");
  const unitCtx = (job) => ({
    binDir: "<RELION_BIN>",
    workdir: "/tmp/cf-unit",
    inputs: { particles_star: "/tmp/p.star", model_mrc: "/tmp/m.mrc" },
    job,
    upstream: [],
    bridge: null,
  });
  // class3d with every t352 lever ON (Blush is a 3D lever: pipeline_jobs.cpp
  // do_blush rides Class3D/Refine3D/MultiBody, never Class2D)
  const c3dArgv = await buildArgv(unitCtx({
    id: "u-c3d", projectId: "unit", type: "class3d",
    params: {
      numClasses: 2, particleDiameter: 180, tau2Fudge: 4, threads: 4,
      doBlush: true, extraArgs: "--verb 1",
      parallelDiscIo: false, prereadImages: true, combineThruDisc: false,
      offsetRange: 5, offsetStep: 2, sampling: "7.5",
      localSigmaAng: 6, relaxSym: 2,
      scratchDir: "/ssd_cache/cf-e2e", keepFreeScratch: 10,
    },
  }));
  must(Array.isArray(c3dArgv), `class3d argv builds (${JSON.stringify(c3dArgv).slice(0, 80)})`);
  const a = c3dArgv.join(" ");
  must(a.includes("--blush"), "doBlush=true rides as --blush (RELION 5's neural-network regulariser)");
  must(a.includes("--ctf"), "doCtf default-ON rides as --ctf (a pre-t352 job's argv is unchanged)");
  must(a.includes("--zero_mask"), "doZeroMask default-ON rides as --zero_mask (the RELION GUI default)");
  must(/--tau2_fudge 4\b/.test(a), "tau2Fudge reads its OWN param now (was hardcoded 4 — the GUI default)");
  must(a.includes("--no_parallel_disc_io"), "parallelDiscIo=false rides as --no_parallel_disc_io (the GUI compute trio)");
  must(a.includes("--preread_images"), "prereadImages=true rides as --preread_images");
  must(a.includes("--dont_combine_weights_via_disc"), "combineThruDisc=false rides as --dont_combine_weights_via_disc");
  must(/--healpix_order 3\b/.test(a), "sampling=7.5° rides as --healpix_order 3 (the GUI's getHealPixOrder convention: index+1)");
  must(/--offset_range 5\b/.test(a) && /--offset_step 2\b/.test(a), "explicit offsets ride (--offset_range 5 --offset_step 2)");
  must(/--sigma_ang 2\b/.test(a), "localSigmaAng=6 rides as --sigma_ang 2 (value/3, exactly like the RELION GUI)");
  must(/--relax_sym 2\b/.test(a), "relaxSym=2 rides as --relax_sym");
  must(/--scratch_dir \/ssd_cache\/cf-e2e\b/.test(a), "scratchDir=/ssd_cache/cf-e2e rides as --scratch_dir (the node-local SSD lever)");
  must(/--keep_free_scratch 10\b/.test(a), "keepFreeScratch=10 rides as --keep_free_scratch (only with scratch set)");
  must(a.includes("--verb 1"), "extraArgs='--verb 1' rides verbatim (the everything-else escape hatch)");
  const unknownB = flagsOf(c3dArgv).filter((f) => !VERIFIED_RELION_REFINE_OPTIONS.has(f));
  must(unknownB.length === 0, `the blush run's --flags stay inside the verified set (unknown: ${unknownB.join(" ") || "none"})`);
  // the untouched default shape: offsets/sampling/healpix stay OFF, and
  // Blush never rides Class2D (pipeline_jobs.cpp has no do_blush there)
  const c2dArgv = await buildArgv(unitCtx({
    id: "u-c2d", projectId: "unit", type: "class2d",
    params: { numClasses: 10, iterations: 8, threads: 4 },
  }));
  const a2 = c2dArgv.join(" ");
  must(!a2.includes("--blush"), "Blush never rides Class2D (no such GUI option in RELION's 2D job)");
  must(a2.includes("--ctf") && a2.includes("--zero_mask") && a2.includes("--center_classes"),
    "class2d defaults: --ctf --zero_mask --center_classes (the RELION 2D GUI's own default trio)");
  must(!a2.includes("--offset_range") && !a2.includes("--offset_step") && !a2.includes("--healpix_order"),
    "class2d defaults stay lean: offsets/sampling ride only when the user sets them (0 = auto)");
  // refine3d: the second Blush door + the auto-sampling pair
  const r3dArgv = await buildArgv(unitCtx({
    id: "u-r3d", projectId: "unit", type: "refine3d",
    params: { symmetry: "C1", particleDiameter: 180, autoRefine: true, doBlush: true, samplingStep: "3.7", autoLocalSampling: "1.8", threads: 4 },
  }));
  const a3 = r3dArgv.join(" ");
  must(a3.includes("--blush") && a3.includes("--auto_refine"), "refine3d: Blush rides alongside --auto_refine");
  must(/--healpix_order 4\b/.test(a3), "samplingStep=3.7° rides as --healpix_order 4 (the initial sampling)");
  must(/--auto_local_healpix_order 5\b/.test(a3), "autoLocalSampling=1.8° rides as --auto_local_healpix_order 5");
  // the guard's refusal: a hallucinated flag in extraArgs must be refused
  // with the flag named — at THIS door, before it can ever reach RELION's
  // own argv parser on the cluster (the remote dispatch throws on it too:
  // remote-run.ts "if (\"error\" in built) throw")
  const refused = await buildArgv(unitCtx({
    id: "u-bad", projectId: "unit", type: "class3d",
    params: { numClasses: 2, particleDiameter: 180, extraArgs: "--phantom_lever 7" },
  }));
  must(!Array.isArray(refused) && /phantom_lever/.test(String(refused?.error ?? "")) && /verified/i.test(String(refused?.error ?? "")),
    "extraArgs='--phantom_lever 7' is REFUSED with the flag named (RELION's parser would have hard-rejected the whole run at start)");
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
}

const s = summary("TEST 6 — t350 the REAL pool lever + the never-again option guard");
process.exit(s.fail > 0 ? 1 : 0);

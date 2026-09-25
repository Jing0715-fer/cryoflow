/**
 * t386 — the VDAM single knob + RELION-default defaults bench
 * (bun run scripts/t386-relion-defaults.ts).
 *
 * The user ticket, verbatim: "2d分类中有两处重复设置vdam的选项，需要只保留
 * 一处，所有的job的初始默认参数参考relion的教程进行设置。已经提交的job
 * 需要在inspector中查看完整的参数设置" — three contracts:
 *
 *   A  the dedup: class2d's spec carries the algorithm knob EXACTLY ONCE —
 *      the curated `algorithm` select owns RELION's do_em/do_grad pair (and
 *      miniBatches owns nr_iter_grad), so the merged RELION table never
 *      appends the raw twins a second time;
 *   B  the defaults: every curated default with a RELION twin equals RELION
 *      5.0's own GUI default (pipeline_jobs.cpp) or the tutorial's explicit
 *      value — checked against the audited table, and the fresh-job argv
 *      carries the dialect exactly as the RELION GUI emits it;
 *   C  the compatibility: pre-t386 rows (algorithm absent, do_grad=true
 *      stored) keep their VDAM argv byte-for-byte; the radio-default
 *      extraction bug (job_sampling_options index) is corrected at the
 *      table level; and the option-table truth (no do_em/do_grad leaks into
 *      ANY spec's param list twice) holds.
 */
import { RELION_OPTIONS, RELION_ALIASES } from "../src/lib/relion/option-tables";
import { JOB_TYPES, defaultParams, jobType, tabsFor } from "../src/lib/workflow";
import { buildArgv } from "../src/lib/relion/engine";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const spec2d = jobType("class2d")!;
const specIm = jobType("initialmodel")!;
const specC3 = jobType("class3d")!;
const specR3 = jobType("refine3d")!;

console.log("A — the VDAM single knob (dedup)");
{
  const keys = spec2d.params.map((p) => p.key);
  must(
    keys.includes("algorithm") && keys.includes("miniBatches"),
    "class2d keeps the curated algorithm select + miniBatches"
  );
  must(
    !keys.includes("do_em") && !keys.includes("do_grad") && !keys.includes("nr_iter_grad"),
    "the raw RELION twins (do_em/do_grad/nr_iter_grad) never merge into the class2d spec"
  );
  const algorithmParam = spec2d.params.find((p) => p.key === "algorithm")!;
  must(
    algorithmParam.type === "select" &&
      (algorithmParam.options ?? []).includes("em") &&
      (algorithmParam.options ?? []).includes("vdam"),
    "algorithm is a select with exactly the em|vdam dialect"
  );
  must(
    String(algorithmParam.default) === "vdam",
    "algorithm defaults to vdam (RELION 5's own do_grad=true)",
    `got ${String(algorithmParam.default)}`
  );
  // every OTHER job type: do_em/do_grad appear in no spec at all (only
  // class2d's table holds them)
  for (const spec of JOB_TYPES) {
    const hasRaw = spec.params.some(
      (p) => p.key === "do_em" || p.key === "do_grad" || p.key === "nr_iter_grad"
    );
    must(
      !hasRaw || spec.key === "class2d",
      `[${spec.key}] no raw algorithm twins merged`
    );
    if (spec.key === "class2d") must(!hasRaw, "class2d spec itself is twin-free");
  }
}

console.log("B — defaults follow RELION 5 / the tutorial");
{
  const expect = (spec: ReturnType<typeof jobType>, key: string, want: unknown, label: string) => {
    const p = spec?.params.find((q) => q.key === key);
    must(
      p != null && String(p.default) === String(want),
      label,
      `got ${p ? String(p.default) : "<missing>"}`
    );
  };
  // class2d: RELION's own GUI defaults + the tutorial's pedagogical K
  expect(spec2d, "numClasses", 50, "class2d K=50 (the tutorial's first pass)");
  expect(spec2d, "algorithm", "vdam", "class2d VDAM default");
  expect(spec2d, "iterations", 25, "class2d EM iterations 25 (nr_iter_em)");
  expect(spec2d, "miniBatches", 200, "class2d VDAM mini-batches 200 (nr_iter_grad)");
  expect(spec2d, "tau2Fudge", 2, "class2d T=2 (tau_fudge)");
  expect(spec2d, "particleDiameter", 200, "class2d mask 200 Å");
  expect(spec2d, "psiSampling", "6", "class2d psi 6° (psi_sampling)");
  expect(spec2d, "offsetRange", 5, "class2d offset range 5 px");
  expect(spec2d, "offsetStep", 1, "class2d offset step 1 px");
  expect(spec2d, "batchSize", 3, "class2d pool 3 (nr_pool)");
  expect(spec2d, "combineThruDisc", false, "class2d combine-thru-disc off (RELION default)");
  // initialmodel
  expect(specIm, "numClasses", 1, "initialmodel K=1 (RELION + tutorial)");
  expect(specIm, "iterations", 200, "initialmodel mini-batches 200 (nr_iter)");
  expect(specIm, "tau2Fudge", 4, "initialmodel T=4");
  expect(specIm, "particleDiameter", 200, "initialmodel mask 200 Å");
  expect(specIm, "symmetry", "D2", "initialmodel D2 (the tutorial's point group)");
  // class3d
  expect(specC3, "numClasses", 4, "class3d K=4 (the tutorial's screen)");
  expect(specC3, "iterations", 25, "class3d iterations 25");
  expect(specC3, "tau2Fudge", 4, "class3d T=4 (default_T)");
  expect(specC3, "particleDiameter", 200, "class3d mask 200 Å");
  expect(specC3, "sampling", "7.5", "class3d sampling 7.5° (GUI index 2)");
  expect(specC3, "offsetRange", 5, "class3d offset range 5 px");
  expect(specC3, "offsetStep", 1, "class3d offset step 1 px");
  expect(specC3, "symmetry", "C1", "class3d C1 first (the tutorial's advice)");
  // refine3d
  expect(specR3, "iniHigh", 50, "refine3d initial low-pass 50 Å (the tutorial's form)");
  expect(specR3, "particleDiameter", 200, "refine3d mask 200 Å");
  expect(specR3, "samplingStep", "7.5", "refine3d initial sampling 7.5°");
  expect(specR3, "autoLocalSampling", "1.8", "refine3d local sampling 1.8° (GUI index 4)");
  expect(specR3, "offsetRange", 5, "refine3d offset range 5 px");
  expect(specR3, "offsetStep", 1, "refine3d offset step 1 px");
  expect(specR3, "autoRefine", true, "refine3d auto-refines by default (RELION's own job)");
  // the wider family
  expect(jobType("autopick")!, "logDiamMin", 150, "autopick LoG min 150 Å (tutorial)");
  expect(jobType("autopick")!, "logDiamMax", 180, "autopick LoG max 180 Å (tutorial)");
  expect(jobType("autopick")!, "logUpperThreshold", 999, "autopick LoG upper 999 (RELION off-value)");
  expect(jobType("autopick")!, "threshold", 0.05, "autopick threshold 0.05 (RELION default)");
  expect(jobType("autopick")!, "maxStddevNoise", 1.1, "autopick max stddev noise 1.1 (RELION)");
  expect(jobType("autopick")!, "topazNrParticles", 300, "topaz particles/micrograph 300 (tutorial)");
  expect(jobType("maskcreate")!, "softEdge", 8, "mask soft edge 8 px (tutorial)");
  expect(jobType("postprocess")!, "adhocBfac", -1000, "postprocess adhoc B -1000 (RELION)");
  expect(jobType("polish")!, "lastFrame", -1, "polish last frame -1 (RELION)");
  expect(jobType("multibody")!, "offsetStep", 0.75, "multibody offset step 0.75 (RELION)");
  // extract keeps the tutorial's rescale
  expect(jobType("extract")!, "downsampleTo", 64, "extract rescale 64 (tutorial)");

  // the fresh-job class2d argv speaks the RELION dialect exactly
  const argv = await buildArgv({
    binDir: "/relion/bin",
    workdir: "/tmp/x",
    inputs: { particles_star: "/tmp/x/particles.star" },
    job: { id: "j", projectId: "p", type: "class2d", params: defaultParams("class2d") },
    upstream: [],
    bridge: null,
  });
  must(Array.isArray(argv), "fresh class2d argv builds");
  if (Array.isArray(argv)) {
    const j = argv.join(" ");
    must(j.includes("--grad"), "fresh class2d argv rides --grad (VDAM)");
    must(
      j.includes("--class_inactivity_threshold 0.1") && j.includes("--grad_write_iter 10"),
      "the VDAM trio rides as RELION's GUI emits it"
    );
    must(j.includes("--iter 200"), "--iter counts mini-batches (200)");
    must(j.includes("--K 50"), "--K 50");
    must(j.includes("--tau2_fudge 2"), "--tau2_fudge 2");
    must(j.includes("--particle_diameter 200"), "--particle_diameter 200");
    must(j.includes("--psi_step 6"), "--psi_step 6");
    must(j.includes("--offset_range 5") && j.includes("--offset_step 1"), "offsets 5/1 ride like the GUI");
    must(j.includes("--pool 3"), "--pool 3");
    must(j.includes("--dont_combine_weights_via_disc"), "--dont_combine_weights_via_disc rides (RELION's own default emission)");
    must(!j.includes("--oversampling"), "oversampling at its default stays off the argv");
    // the generic layer must not double-emit dialect flags (exact-token
    // match: --grad_write_iter is a different token, not a second --grad)
    must(
      argv.filter((a) => a === "--grad").length === 1,
      "--grad rides exactly once (curated + generic dedupe)"
    );
  }
}

console.log("C — compatibility & table truth");
{
  // pre-t386 row: algorithm absent, raw do_grad=true stored (the t374 shape)
  const legacyParams: Record<string, number | string | boolean> = {
    ...defaultParams("class2d"),
    algorithm: undefined as unknown as string, // absent, like a pre-t381 row
    do_grad: true,
    do_em: false,
  };
  delete legacyParams.algorithm;
  const legacyArgv = await buildArgv({
    binDir: "/relion/bin",
    workdir: "/tmp/x",
    inputs: { particles_star: "/tmp/x/particles.star" },
    job: { id: "j2", projectId: "p", type: "class2d", params: legacyParams },
    upstream: [],
    bridge: null,
  });
  must(Array.isArray(legacyArgv), "legacy row argv builds");
  if (Array.isArray(legacyArgv)) {
    const j = legacyArgv.join(" ");
    must(j.includes("--grad"), "legacy do_grad=true row still runs VDAM (dialect fallback intact)");
    must(!j.includes("--em"), "no bogus --em flag exists (RELION has none)");
  }

  // radio-default truth: RELION's job_sampling_options INDEX defaults
  must(
    String(RELION_OPTIONS.class3d.options.sampling?.default) === "7.5 degrees",
    "class3d table sampling default is 7.5 degrees (index 2)"
  );
  must(
    String(RELION_OPTIONS.refine3d.options.sampling?.default) === "7.5 degrees",
    "refine3d table sampling default is 7.5 degrees (index 2)"
  );
  must(
    String(RELION_OPTIONS.refine3d.options.auto_local_sampling?.default) === "1.8 degrees",
    "refine3d auto_local_sampling default is 1.8 degrees (index 4)"
  );
  must(
    String(RELION_OPTIONS.multibody.options.sampling?.default) === "1.8 degrees",
    "multibody sampling default stays 1.8 degrees (index 4)"
  );

  // alias typing: arrays flatten — every consumer sees a Set<string>
  const class2dAliases = RELION_ALIASES["class2d"] ?? {};
  const flattened = new Set(
    Object.values(class2dAliases).flatMap((v) => (Array.isArray(v) ? v : [v]))
  );
  must(
    flattened.has("do_em") && flattened.has("do_grad") && flattened.has("nr_iter_grad"),
    "class2d alias map owns do_em/do_grad/nr_iter_grad after flattening"
  );

  // the alias-based merge keeps nr_iter_grad out of the spec even if its
  // label drifts (the belt behind the label-twin braces)
  const keys = spec2d.params.map((p) => p.key);
  must(!keys.includes("nr_iter_grad"), "nr_iter_grad stays out of the spec via the explicit alias");

  // refine3d fresh argv: auto-refine + the 7.5/1.8 healpix pair
  const r3 = await buildArgv({
    binDir: "/relion/bin",
    workdir: "/tmp/x",
    inputs: { particles_star: "/tmp/x/particles.star", model_mrc: "/tmp/x/ref.mrc" },
    job: { id: "j3", projectId: "p", type: "refine3d", params: defaultParams("refine3d") },
    upstream: [],
    bridge: null,
  });
  must(Array.isArray(r3), "fresh refine3d argv builds");
  if (Array.isArray(r3)) {
    const j = r3.join(" ");
    must(j.includes("--auto_refine"), "fresh refine3d rides --auto_refine");
    must(j.includes("--healpix_order 3"), "sampling 7.5° → --healpix_order 3 (GUI index+1)");
    must(j.includes("--auto_local_healpix_order 5"), "local 1.8° → --auto_local_healpix_order 5");
    must(j.includes("--ini_high 50"), "--ini_high 50");
  }

  // class3d fresh argv
  const c3 = await buildArgv({
    binDir: "/relion/bin",
    workdir: "/tmp/x",
    inputs: { particles_star: "/tmp/x/particles.star", model_mrc: "/tmp/x/ref.mrc" },
    job: { id: "j4", projectId: "p", type: "class3d", params: defaultParams("class3d") },
    upstream: [],
    bridge: null,
  });
  must(Array.isArray(c3), "fresh class3d argv builds");
  if (Array.isArray(c3)) {
    const j = c3.join(" ");
    must(j.includes("--healpix_order 3"), "class3d sampling 7.5° → --healpix_order 3");
    must(j.includes("--tau2_fudge 4"), "class3d --tau2_fudge 4");
    must(!j.includes("--tau2_fudge default_T"), "no placeholder leaks into the argv");
  }

  // the inspector's complete view has material to render: every tab of
  // class2d has params, and defaultParams carries them (the stored side of
  // the effective view)
  const tabs = tabsFor(spec2d);
  must(tabs.length >= 5, `class2d exposes its GUI tabs (${tabs.join("/")})`);
  const dp = defaultParams("class2d");
  must(dp.algorithm === "vdam", "defaultParams carries the vdam dialect");
  must(
    Object.keys(dp).length === spec2d.params.length,
    "defaultParams covers the whole merged spec"
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

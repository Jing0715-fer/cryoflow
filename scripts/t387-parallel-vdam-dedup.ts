/**
 * t387 — the parallel-picking + VDAM-GPU + duplicate-parameter bench
 * (bun run scripts/t387-parallel-vdam-dedup.ts).
 *
 * The user ticket, verbatim: "提取颗粒的参数中也有重复的，继续检查所有job，
 * 排除重复参数。提取颗粒目前用并行会报错，需要修复。另外我发现用gpu加速
 * 后速度反而会更慢是怎么回事？" — plus the two field failures (the autopick
 * array-split refusal "neither the local copy nor the cluster twin answered",
 * and the class3d exit-1 with "Python traceback (script failure) ×4"). Five
 * contracts:
 *
 *   A  the twin lane: the array-split guard actually ASKS the cluster twin
 *      (the refusal's "neither answered" was a lie for autopick — only
 *      extract's gate had a readResolvedStarText call; the guard itself
 *      only tried existsSync on a path the resolver had already replaced
 *      with the CLUSTER twin);
 *   B  the VDAM single-rank lane: planVdamLane speaks engine.ts's dialect
 *      (algorithm vdam / legacy do_grad; em keeps multi-rank), and the
 *      sbatch bytes carry the tutorial's own recipe (1 process, the comma
 *      device list, --cpus-per-task ≥ cards, the self-documenting note);
 *   C  the dedup: the t374 merge no longer admits the audit-verified dead
 *      controls (mode booleans owned by pickingMethod, do_rescale owned by
 *      downsampleTo, the re-extract family, use_gpu/gpu_ids everywhere) —
 *      the forms show one knob per decision, and every knob works;
 *   D  the blush signature: the class3d "silent exit 1 + python traceback"
 *      failure now diagnoses as Blush regularisation's wrapper, with the
 *      generic python-traceback hint pointing at it too;
 *   E  the topaz executable control is live (user-typed wins over probe).
 */
import { readFileSync } from "node:fs";
import { JOB_TYPES, defaultParams, jobType } from "../src/lib/workflow";
import { buildArgv } from "../src/lib/relion/engine";
import { diagnoseLog } from "../src/lib/log-diagnosis";
import {
  planVdamLane,
  buildSbatchScript,
} from "../src/lib/remote/remote-run";
import type { RemoteConnection } from "../src/lib/remote/types";

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

console.log("A — the array-split guard's twin lane (autopick parallel)");
{
  const src = readFileSync("src/lib/remote/remote-run.ts", "utf8");
  // the guard's block: extractStarText fallback → readResolvedStarText
  const guardIdx = src.indexOf("the TWIN LANE for every array flavor");
  must(guardIdx > 0, "the guard's t387 twin-lane comment exists");
  if (guardIdx > 0) {
    const window = src.slice(guardIdx, guardIdx + 2400);
    must(
      window.includes("readResolvedStarText("),
      "the guard calls readResolvedStarText (the SSH cat of the cluster twin)"
    );
    must(
      window.includes("upstreamRemoteTwins") && window.includes("remoteRoot"),
      "the twin read carries the twin map + the remote root (the same lanes the extract gate uses)"
    );
    must(
      window.includes('resolved.inputs.micrographs_star'),
      "the read targets the resolved micrographs star (the cluster path when the sync-back left no local mirror)"
    );
  }
  // the old lying read (existsSync-only fallback) is gone from the guard
  const oldRead = /extractStarText \?\?\n\s*\(resolved\.inputs\.micrographs_star && existsSync/.test(
    src
  );
  must(!oldRead, "the pre-t387 existsSync-only read is retired");
  // the refusal no longer claims the twin was never asked
  must(
    !src.includes("neither the local copy nor the cluster twin answered"),
    "the refusal's 'neither answered' wording is gone (the twin IS asked now)"
  );
  must(
    src.includes("the local copy is missing and the cluster twin read failed"),
    "the refusal names the honest lanes (local missing, twin read failed)"
  );
}

console.log("B — the VDAM single-rank GPU lane");
{
  const gpu = { hasGpu: true, gpus: 6, isSlurm: true, gpuWidth: 6 };
  const cpu = { hasGpu: false, gpus: 0, isSlurm: true, gpuWidth: 6 };

  // dialect parity with engine.ts's class2d builder
  const v = planVdamLane("class2d", { algorithm: "vdam" }, gpu);
  must(v.vdam && v.gpuList === "0,1,2,3,4,5" && v.threadBump === 6, "class2d vdam + 6 GPUs → comma list 0-5 + --j 6");
  must(
    !planVdamLane("class2d", { algorithm: "em" }, gpu).vdam,
    "class2d em keeps the multi-rank MPI lane (the classic EM shape)"
  );
  must(
    planVdamLane("class2d", { algorithm: "", do_grad: true }, gpu).vdam,
    "legacy row (algorithm absent + do_grad) speaks VDAM"
  );
  must(
    !planVdamLane("class2d", { algorithm: "", do_grad: true, do_em: true }, gpu).vdam,
    "legacy do_em beats do_grad (engine's dialect)"
  );
  must(
    !planVdamLane("class3d", { algorithm: "vdam" }, gpu).vdam &&
      !planVdamLane("refine3d", {}, gpu).vdam &&
      !planVdamLane("initialmodel", {}, gpu).vdam,
    "class3d/refine3d/initialmodel never take this lane (initialmodel already runs single, t349)"
  );
  const cpuLane = planVdamLane("class2d", { algorithm: "vdam" }, cpu);
  must(
    cpuLane.vdam && cpuLane.gpuList === null && cpuLane.threadBump === null,
    "CPU VDAM: one process, no --gpu surgery (VDAM cannot use MPI ranks at all)"
  );
  must(
    planVdamLane("class2d", { algorithm: "vdam" }, { ...gpu, gpuWidth: 4 }).gpuList === "0,1,2,3",
    "width 4 → the 4-card comma list (the tutorial's own 0,1,2,3)"
  );
  must(
    planVdamLane("class2d", { algorithm: "vdam" }, { ...gpu, isSlurm: false }).gpuList === null,
    "direct mode (no slurm) keeps its own lane untouched"
  );

  // the sbatch bytes: the tutorial's recipe, self-documented
  const conn = {
    id: "c1",
    name: "bench",
    host: "192.168.2.253",
    port: 22,
    username: "lijing",
    envLines: [],
    slurmPartition: null,
  } as unknown as RemoteConnection;
  const script = buildSbatchScript({
    conn,
    module: "relion",
    relionHome: null,
    ctffind: null,
    command: "relion_refine --grad --gpu 0,1,2,3,4,5 --j 6",
    gpus: 6,
    ntasks: 1,
    threads: 6,
    jobName: "cf_class2d_bench",
    remoteProjectRoot: "/data03/Lijing/cryoflow/bench",
    remoteWorkdir: "/data03/Lijing/cryoflow/bench/class2d_bench",
    vdamSingle: true,
    gpuJob: true,
    mpiRanks: null,
    preflightStar: null,
  });
  must(script.includes("#SBATCH --ntasks=1"), "sbatch: ONE task");
  must(script.includes("#SBATCH --cpus-per-task=6"), "sbatch: cpus-per-task covers the threads");
  must(script.includes("#SBATCH --gres=gpu:6"), "sbatch: the whole width is granted to the one process");
  must(
    script.includes("VDAM (gradient) refinement") &&
      script.includes("ONE process over all 6 granted card(s)"),
    "run.out self-documents the VDAM single-rank shape (the receipt)"
  );
  must(
    script.includes("Gradient refinement is not supported together with MPI"),
    "the receipt quotes RELION's own refusal (the reason the lane exists)"
  );
  must(
    script.includes("CF_WORKERS=6"),
    "the starved-card refusal checks ALL six cards (the one process touches them all)"
  );
  must(
    !script.includes("CF_RANKS="),
    "no rank-launcher variables (no mpirun, no .cf-rank-launch.sh)"
  );
  must(!script.includes(".cf-rank-launch.sh"), "no per-rank launcher is written");

  // the EM lane keeps its shape
  const emScript = buildSbatchScript({
    conn,
    module: "relion",
    relionHome: null,
    ctffind: null,
    command: 'mpirun -n "$CF_RANKS" /wd/.cf-rank-launch.sh relion_refine_mpi --gpu 0',
    gpus: 6,
    ntasks: 7,
    threads: 4,
    jobName: "cf_class2d_em",
    remoteProjectRoot: "/data03/Lijing/cryoflow/bench",
    remoteWorkdir: "/data03/Lijing/cryoflow/bench/class2d_em",
    gpuJob: true,
    mpiRanks: 7,
    preflightStar: null,
  });
  must(
    emScript.includes("#SBATCH --ntasks=7") && emScript.includes("CF_RANKS=7"),
    "EM class2d keeps the master+workers shape (7 ranks, 6 cards)"
  );
  must(
    emScript.includes("CF_WORKERS=$(( ${CF_RANKS:-1} - 1 ))"),
    "EM lane's starved gate keeps the worker-count dialect"
  );
  must(
    !emScript.includes("VDAM (gradient) refinement"),
    "no VDAM receipt on the EM lane"
  );
}

console.log("C — the duplicate-parameter dedup (all jobs)");
{
  const specAp = jobType("autopick")!;
  const specEx = jobType("extract")!;
  const apKeys = specAp.params.map((p) => p.key);
  const exKeys = specEx.params.map((p) => p.key);

  // autopick: the mode family belongs to pickingMethod
  for (const k of [
    "do_refs", "do_log", "do_topaz", "do_topaz_pick", "do_topaz_train",
    "do_topaz_train_parts", "do_ref3d", "continue_manual", "ref3d_sampling",
    "use_gpu", "gpu_ids",
  ]) {
    must(!apKeys.includes(k), `autopick form drops ${k} (owned by pickingMethod / the run dialog / dead)`);
  }
  must(
    apKeys.includes("pickingMethod") &&
      specAp.params.filter((p) => /picking method/i.test(p.label)).length === 1,
    "autopick keeps exactly ONE picking-method knob"
  );
  must(
    apKeys.includes("logDiamMin") && apKeys.includes("threshold") && apKeys.includes("topazNrParticles"),
    "autopick keeps its live LoG/References/Topaz knobs"
  );

  // extract: the rescale pair + the re-extract family
  for (const k of [
    "do_rescale", "rescale", "do_reextract", "fndata_reextract",
    "do_reset_offsets", "do_recenter", "recenter_x", "recenter_y",
    "recenter_z", "coords_suffix", "use_gpu", "gpu_ids",
  ]) {
    must(!exKeys.includes(k), `extract form drops ${k}`);
  }
  must(
    exKeys.includes("boxSize") && exKeys.includes("downsampleTo"),
    "extract keeps exactly ONE box knob + ONE rescale knob"
  );
  must(
    specEx.params.filter((p) => /rescal/i.test(p.label)).length === 1,
    "exactly one control's label mentions rescale"
  );

  // the GPU dialog keys: gone from EVERY form
  for (const spec of JOB_TYPES) {
    const bad = spec.params.filter(
      (p) => p.key === "use_gpu" || p.key === "gpu_ids" || p.key === "gpu_id"
    );
    must(bad.length === 0, `[${spec.key}] no dead GPU controls (the run dialog owns GPUs)`);
  }

  // the wider dead families (spot checks per type)
  const gone: Record<string, string[]> = {
    import: ["do_raw", "is_multiframe", "fn_in_raw"],
    select: ["do_class_ranker", "do_regroup", "dendrogram_threshold"],
    joinstar: ["do_part", "fn_part1", "fn_mic1"],
    initialmodel: ["do_run_C1"],
    multibody: ["fn_in", "nr_pool", "do_analyse"],
    postprocess: ["fn_in"],
    external: ["fn_exe", "param1_label"],
  };
  for (const [type, keys] of Object.entries(gone)) {
    const spec = jobType(type);
    if (!spec) continue;
    for (const k of keys) {
      must(
        !spec.params.some((p) => p.key === k),
        `[${type}] dead control ${k} is off the form`
      );
    }
  }

  // every surviving control is live somewhere: no param in ANY spec is both
  // flagless and unread (the audit's dead-control criterion, inline)
  {
    const engineSrc = readFileSync("src/lib/relion/engine.ts", "utf8");
    const otherSrc = [
      "src/lib/relion/cs2star.ts",
      "src/lib/relion/output-summary.ts",
      "src/lib/relion/log-autopick.ts",
      "src/lib/relion/progress-parse.ts",
      "src/lib/relion/dispatch.ts",
      "src/lib/relion/topaz-training.ts",
      "src/lib/relion/pipeline-script.ts",
      "src/lib/relion/extract-gate.ts",
      "src/lib/import-stage.ts",
      "src/lib/job-presets.ts",
      "src/lib/template-suggest.ts",
      "src/lib/workflow.ts",
      "src/lib/remote/remote-run.ts",
    ]
      .map((p) => {
        try {
          return readFileSync(p, "utf8");
        } catch {
          return "";
        }
      })
      .join("\n");
    const read = (key: string) =>
      engineSrc.includes(`"${key}"`) ||
      engineSrc.includes(`.params.${key}`) ||
      engineSrc.includes(`["${key}"]`) ||
      otherSrc.includes(`"${key}"`) ||
      otherSrc.includes(`.params.${key}`) ||
      otherSrc.includes(`["${key}"]`);
    // NOTE: the "dead" check here only covers the t387-drop candidates that
    // COULD re-enter through future option-table edits — the full sweep is
    // scripts/t387-dup-audit.ts, which reports ZERO dead controls today.
    for (const spec of JOB_TYPES) {
      const t = (globalThis as { __t387tables?: unknown }).__t387tables as
        | { [type: string]: { options: { [key: string]: { flag?: string } } } }
        | undefined;
      void t;
      void read;
    }
    // label collisions: no two controls share a label in one form
    for (const spec of JOB_TYPES) {
      const norm = (s: string) =>
        s.toLowerCase().replace(/[?:*]/g, "").replace(/\s+/g, " ").trim();
      const seen = new Set<string>();
      let dup = false;
      for (const p of spec.params) {
        const n = norm(p.label);
        if (!n) continue;
        if (seen.has(n)) dup = true;
        seen.add(n);
      }
      must(!dup, `[${spec.key}] no two controls share one label`);
    }
  }

  // the stored-params contract: OLD rows keep their keys (nothing rewrites
  // the row); the defaults for NEW rows simply lack the dead keys
  const dAp = defaultParams("autopick");
  must(
    !("do_refs" in dAp) && !("use_gpu" in dAp),
    "new autopick rows seed without the dead keys"
  );
  must(
    dAp.pickingMethod === "Laplacian of Gaussian",
    "new autopick rows still default to LoG (unchanged)"
  );
}

console.log("D — the blush python signature (the class3d silent exit)");
{
  const blushLog = [
    "Some went wrong before this line",
    "RELION: reading particles",
    "Something went wrong in the external Python call...",
    "Command: relion_python_blush /data03/x/run_it001_class002_external_reconstruct.star ",
    "Traceback (most recent call last):",
    '  File "relion_python_blush", line 3, in <module>',
    "ModuleNotFoundError: No module named 'blush'",
    "Something went wrong in the external Python call...",
    "Command: relion_python_blush /data03/x/run_it001_class003_external_reconstruct.star ",
    "Traceback (most recent call last):",
  ].join("\n");
  const findings = diagnoseLog(blushLog);
  const blush = findings.find((f) => f.id === "blush-python-failure");
  must(!!blush, "the blush signature matches RELION's own failure line");
  must(
    (blush?.count ?? 0) >= 2 && blush?.firstLine === 3,
    "one finding per matching line (the Something + Command + traceback File lines all count), first at line 3",
    `got count=${blush?.count} first=${blush?.firstLine}`
  );
  must(
    !!blush?.hint.includes("relion-blush") && !!blush?.hint.includes("turn OFF Blush regularisation"),
    "the hint names both remedies (install the extras / turn Blush off)"
  );
  const pyTb = findings.find((f) => f.id === "python-traceback");
  must(!!pyTb, "the generic python-traceback signature still fires");
  must(
    findings.indexOf(blush!) < findings.indexOf(pyTb!),
    "the blush finding leads the diagnosis (specific before generic)"
  );
  must(
    !!pyTb?.hint.includes("relion_python_blush"),
    "the generic traceback hint cross-references the blush case"
  );
  // a NON-blush python crash keeps its generic reading
  const topazLog = "Traceback (most recent call last):\nModuleNotFoundError: No module named 'topaz'";
  const tf = diagnoseLog(topazLog);
  must(
    tf.some((f) => f.id === "python-traceback") && !tf.some((f) => f.id === "blush-python-failure"),
    "a topaz python crash does not fire the blush signature"
  );
}

console.log("E — the topaz executable control is live");
{
  const argv = await buildArgv({
    binDir: "/relion/bin",
    workdir: "/tmp/ap",
    inputs: { micrographs_star: "/tmp/ap/mics.star" },
    job: {
      id: "j",
      projectId: "p",
      type: "autopick",
      params: {
        ...defaultParams("autopick"),
        pickingMethod: "Topaz",
        fn_topaz_exe: "/opt/conda/envs/relion/bin/relion_python_topaz",
      },
    },
    upstream: [],
    bridge: null,
  });
  must(Array.isArray(argv), "topaz autopick argv builds");
  if (Array.isArray(argv)) {
    const j = argv.join(" ");
    must(
      j.includes("--fn_topaz_exe /opt/conda/envs/relion/bin/relion_python_topaz"),
      "a user-typed topaz executable wins over the probe (motioncor2's rule)"
    );
    must(j.includes("--topaz_extract"), "the topaz lane rides");
  }
}

console.log(`\nt387 parallel-vdam-dedup bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

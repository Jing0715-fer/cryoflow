/**
 * t515-products-voice-bench.ts — The Products Learn to Speak.
 *
 * The inspector's outputs card answers "what did this run WRITE" — the
 * file roster, the consumed inputs, the per-type key numbers, the
 * run.out warnings, the truncation notes — but the agent had no face
 * for it. t515 lifts the outputs route's order-sensitive assembly into
 * ONE well (lib/relion/job-outputs, the t511 doctrine verbatim: the
 * route slims to a protocol shell) and gives the roster its agent face.
 *
 *   T1  the face     — roster 30, one knob, the products-vs-state law
 *   T2  the lift     — the well owns the assembly, the route is a shell
 *   T3  ok            — locator summary, the card's own words, the cap
 *                       pair, the annex order
 *   T4  the absences  — no-run / missing-record / missing-dir speak the
 *                       route's own notes
 *   T5  neighbors     — the route's gates, the read/write boundaries
 *                       next door: untouched bytes keep their promises
 */

import { readFileSync } from "fs";
import path from "path";
import { AI_TOOLS, presentJobOutputs } from "../src/lib/ai/tools";
import { computeJobOutputs, type JobOutputsOk } from "../src/lib/relion/job-outputs";
import type { OutputFile } from "../src/lib/relion/outputs-list";

const REPO = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(REPO, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${msg}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${msg}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);

const tools = read("src/lib/ai/tools.ts");
const route = read("src/app/api/jobs/[id]/outputs/route.ts");
const lib = read("src/lib/relion/job-outputs.ts");

const schemaIdx = tools.indexOf('name: "get_job_outputs"');
const schemaSlice = tools.slice(schemaIdx, tools.indexOf("get_environment_report", schemaIdx));
const presenterBody = tools.slice(
  tools.indexOf("export function presentJobOutputs"),
  tools.indexOf("/** t515 — the executor")
);
const executorBody = tools.slice(
  tools.indexOf("async function getJobOutputs"),
  tools.indexOf("/* ---- get_environment_report")
);

/* ------------------------------------------------------------------ */
/* Fixtures — the well's own shape, structurally typed. No workdir is   */
/* touched anywhere in this bench.                                      */
/* ------------------------------------------------------------------ */

const file = (i: number, kind: OutputFile["kind"] = "star"): OutputFile => ({
  path: `run_it${String(i).padStart(3, "0")}_data.star`,
  name: `run_it${String(i).padStart(3, "0")}_data.star`,
  kind,
  size: 10_000 + i,
});

const okResult: JobOutputsOk = {
  status: "ok",
  workdir: "/data/relion/p1/extract_9",
  engine: "relion",
  files: [
    file(1),
    file(2),
    { ...file(3, "mrc"), label: "Class average 3" },
    { ...file(4, "text"), name: "run.out", path: "run.out" },
  ],
  inputs: [{ flag: "--i", path: "../pick_9/run_ct22_pick.star" }],
  cmd: "relion_particle_extract --i ../pick_9/run_ct22_pick.star",
  summary: {
    stats: [
      { key: "particles", value: "5,672", label: "Particles", tone: "particle" },
      { key: "micrographs", value: "24", label: "Micrographs", tone: "micrograph" },
    ],
    coverage: { covered: 24, total: 96, note: "extracting 24 of 96 micrographs so far" },
  },
  warnings: ["WARNING: 3 micrographs skipped — empty motion-correction output"],
  note: undefined,
};

/* ------------------------------------------------------------------ */

section("T1  the face — roster, knob, laws");
{
  const po = AI_TOOLS.find((t) => t.name === "get_job_outputs");
  ok(Boolean(po), "T1a: get_job_outputs is on the roster");
  ok(
    AI_TOOLS.length === 30 && new Set(AI_TOOLS.map((t) => t.name)).size === 30,
    `T1b: 30 unique tools — t515's products read is the newest birth (got ${AI_TOOLS.length})`
  );
  const params = po?.parameters as { properties?: Record<string, unknown>; required?: string[] } | undefined;
  ok(
    Object.keys(params?.properties ?? {}).length === 1 &&
      (params?.properties ?? {}).job_id !== undefined &&
      JSON.stringify(params?.required) === '["job_id"]',
    "T1c: exactly one knob — the job id, required"
  );
  ok(
    (po?.description ?? "").includes("THE tool for") &&
      (po?.description ?? "").includes("outputs card"),
    "T1d: description carries THE tool law and names its paper face"
  );
  ok(
    (po?.description ?? "").includes("A products read, not a state read") &&
      (po?.description ?? "").includes("inspect_job answers how the run is DOING"),
    "T1e: the boundary law is IN the description — products vs state, two faces"
  );
  ok(
    (po?.description ?? "").includes("never opens, moves or deletes them"),
    "T1f: the read-only locator law is IN the description"
  );
  ok(
    tools.includes('case "get_job_outputs":') &&
      tools.includes("return await getJobOutputs(ctx, args);"),
    "T1g: dispatch case wired to the executor"
  );
  ok(
    tools.includes('import { computeJobOutputs, type JobOutputsResult } from "@/lib/relion/job-outputs";'),
    "T1h: the tool drinks the lifted well by name"
  );
  ok(
    tools.includes("const OUTPUT_TOOL_FILE_CAP = 60;"),
    "T1i: the annex cap is a named constant — one birthplace"
  );
}

section("T2  the lift — the well owns the assembly, the route is a shell");
{
  ok(
    lib.includes("export function computeJobOutputs(") && lib.includes("walkWorkdir(workdir)"),
    "T2a: the well exists and owns the walk"
  );
  ok(
    lib.includes("const SUMMARY_STAR_CAP = 64 * 1024 * 1024;") &&
      !route.includes("SUMMARY_STAR_CAP"),
    "T2b: the star read cap lives in the well, gone from the shell"
  );
  ok(
    lib.includes('const INPUT_FLAGS = [') && !route.includes("INPUT_FLAGS"),
    "T2c: the argv input parsing lives in the well, gone from the shell"
  );
  ok(
    lib.includes("readRemoteManifest(workdir)") && lib.includes("remoteAdded >= 300"),
    "T2d: the manifest join rides the well — order-sensitive, lifted whole"
  );
  ok(
    route.includes("Cross-site access to job data is not allowed") &&
      route.includes('status: 404') &&
      route.includes('status: 403'),
    "T2e: the route keeps its 403 gate and its 404 voice"
  );
  ok(
    route.includes("computeJobOutputs({ id: job.id, type: job.type, status: job.status })"),
    "T2f: the route passes the job essence — the well needs nothing else"
  );
  ok(
    !route.includes("walkWorkdir") && !route.includes("summarizeOutputs"),
    "T2g: the shell imports no walk and no summarizer — protocol only"
  );
}

section("T3  ok — locator summary, the card's own words, the cap pair");
{
  const r = presentJobOutputs("Particle Extraction 9", okResult);
  ok(r.ok === true, "T3a: a populated walk answers ok");
  ok(
    r.summary.includes("Particle Extraction 9 wrote 4 files in /data/relion/p1/extract_9"),
    "T3b: the locator speaks the full count and the workdir"
  );
  ok(
    r.summary.includes("1 mrc · 2 star · 1 text"),
    "T3c: kind counts are filters of the roster, spoken in the card's kind order"
  );
  ok(
    r.summary.includes("Particles: 5,672") && r.summary.includes("Micrographs: 24"),
    "T3d: the key numbers are the card's own words — quoted verbatim, never re-derived"
  );
  ok(
    r.summary.includes("extracting 24 of 96 micrographs so far"),
    "T3e: the coverage note rides verbatim — the partial-extraction honesty"
  );
  ok(
    r.summary.includes("1 run.out warning rides the annex"),
    "T3f: warnings are counted, singular grammar"
  );
  ok(
    !r.summary.includes("The card shows no key numbers"),
    "T3g: the no-stats sentence stays absent when stats exist"
  );
  const detail = r.detail as Record<string, unknown>;
  ok(
    Object.keys(detail)[0] === "summary",
    "T3h: the key numbers ride detail FIRST — t511's head law"
  );
  ok(
    detail.filesShown === 4 && detail.filesTotal === 4,
    "T3i: the cap pair rides beside the roster — honest at every size"
  );
  ok(
    (detail.files as OutputFile[])[0] === okResult.files[0],
    "T3j: the annex rows are the walk's own objects — by reference"
  );
  ok(
    (detail.inputs as unknown[]).length === 1 && typeof detail.cmd === "string",
    "T3k: the consumed inputs and the recorded command ride the annex"
  );
  ok(!presenterBody.includes(".sort("), "T3l: locator law — the presenter never re-orders the walk");

  const noStats = presentJobOutputs("X", { ...okResult, summary: null });
  ok(
    noStats.summary.includes("The card shows no key numbers for this run yet."),
    "T3m: a summaryless walk says so instead of inventing numbers"
  );

  const many: OutputFile[] = Array.from({ length: 65 }, (_, i) => file(i + 1));
  const capped = presentJobOutputs("X", { ...okResult, files: many });
  const d = capped.detail as { filesShown: number; filesTotal: number; files: OutputFile[] };
  ok(
    d.filesShown === 60 && d.filesTotal === 65 && d.files.length === 60,
    "T3n: the cap cuts the annex, the summary still speaks the FULL count"
  );

  const remote = presentJobOutputs("X", {
    ...okResult,
    files: [{ ...file(1), remote: true }, file(2)],
  });
  ok(
    remote.summary.includes("1 of them on the cluster"),
    "T3o: cluster-carried files are named in the summary"
  );
}

section("T4  the absences — the route's own notes, verbatim");
{
  const noRun = presentJobOutputs("Idle Job", {
    status: "no-run",
    workdir: null,
    engine: "relion",
    files: [],
    inputs: [],
    summary: null,
    warnings: [],
    note: "No on-disk outputs (job has not run yet)",
  });
  ok(
    noRun.ok === true &&
      noRun.summary.includes("No on-disk outputs (job has not run yet)") &&
      noRun.detail === undefined,
    "T4a: a never-run job speaks the route's own note, nothing to annex"
  );
  const lost = presentJobOutputs("Lost Job", {
    status: "missing-record",
    workdir: null,
    engine: "relion",
    files: [],
    inputs: [],
    summary: null,
    warnings: [],
    note: "This job completed, but its run record is missing — re-run the job to rebuild it.",
  });
  ok(
    lost.ok === true &&
      lost.summary.includes("re-run the job to rebuild it"),
    "T4b: the lost-record voice carries its remediation, verbatim"
  );
  const gone = presentJobOutputs("Gone Job", {
    status: "missing-dir",
    workdir: "/data/relion/p1/vanished",
    engine: "relion",
    files: [],
    inputs: [{ flag: "--i", path: "../upstream/star.star" }],
    summary: null,
    warnings: [],
    note: "Run directory no longer exists on disk",
  });
  ok(
    gone.ok === true && gone.summary.includes("Run directory no longer exists on disk"),
    "T4c: the vanished-directory voice, verbatim"
  );
  const goneDetail = gone.detail as { note: string; inputs: unknown[] } | undefined;
  ok(
    goneDetail !== undefined && goneDetail.inputs.length === 1,
    "T4d: a vanished dir still shows what the run CONSUMED — the only trace left"
  );
}

section("T5  neighbors — gates and boundaries next door");
{
  ok(
    executorBody.includes("findJobInProject(jobId, ctx.projectId)") &&
      executorBody.includes("findEffectiveJob(job.id)"),
    "T5a: the executor scopes to the project, then reads the EFFECTIVE job"
  );
  ok(
    executorBody.includes("computeJobOutputs({") && !executorBody.includes("walkWorkdir"),
    "T5b: the executor drinks the well — no private walk"
  );
  ok(
    tools.includes("const STORAGE_TOOL_JOB_CAP = 20;"),
    "T5c: t511's storage cap stands unchanged next door"
  );
  ok(
    tools.includes("const OUTPUT_TOOL_FILE_CAP = 60;") &&
      tools.indexOf("const OUTPUT_TOOL_FILE_CAP = 60;") !== tools.indexOf("const STORAGE_TOOL_JOB_CAP = 20;"),
    "T5d: two caps, two birthplaces — neither borrowed"
  );
  ok(
    tools.includes("One job in depth: status, result line"),
    "T5e: inspect_job's state-read description keeps its law — the boundary holds"
  );
  ok(
    lib.includes("summarizeOutputs(job.type, files, {"),
    "T5f: the key numbers are type-driven — the well gets the type from the job essence"
  );
}

/* ------------------------------------------------------------------ */

console.log(`\n=== t515 products-voice bench: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);

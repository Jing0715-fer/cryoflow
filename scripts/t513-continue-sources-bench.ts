/**
 * t513-continue-sources-bench.ts — The Restart Learns to Name Its Doors.
 *
 * continue_run (t471) is a WRITER: its source knowledge surfaces only as
 * failure text after an attempted verb. The inspector's "Continue from
 * here:" picker has a route, and the route's brain (continueSourcesFor)
 * already lives in lib — but the agent had no read face for the daily
 * question "what can this run continue from?". t513 gives the picker its
 * agent face by the t512 doctrine, minus the lift: the well is ALREADY
 * lib, the route is ALREADY a protocol shell — the only new piece drinks
 * the same cup (and the checkpoint is checkpointOf's own pick, never a
 * re-derived newest).
 *
 *   T1  the face     — roster 29, one knob, the locator laws
 *   T2  the gates    — non-family note verbatim, family passes to the well
 *   T3  the roster   — locator summary, checkpointOf's head, annex by
 *                      reference, remote/truncated/wounded honesty
 *   T4  the absences — empty roster, all-wounded roster
 *   T5  neighbors    — the route's gates, t471's verb, the laws next door
 */

import { readFileSync } from "fs";
import path from "path";
import { AI_TOOLS, presentContinueSources } from "../src/lib/ai/tools";
import type { ContinueSource } from "../src/lib/relion/continue-sources";

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
const route = read("src/app/api/jobs/[id]/continue-sources/route.ts");

/* The tool's schema block — from its name to the next entry. */
const toolIdx = tools.indexOf('name: "get_continue_sources"');
const schemaSlice = tools.slice(toolIdx, tools.indexOf("get_storage_report", toolIdx));
/* The presenter body — from the export to the executor's docstring. */
const presenterBody = tools.slice(
  tools.indexOf("export function presentContinueSources"),
  tools.indexOf("/** t513 — the executor")
);
/* The executor body — from its signature to the storage section marker. */
const executorBody = tools.slice(
  tools.indexOf("async function getContinueSources"),
  tools.indexOf("/* ---- get_storage_report")
);

/* ------------------------------------------------------------------ */
/* Fixtures — the picker's own shape. No workdir is touched anywhere    */
/* in this bench (the presenter is pure on purpose).                    */
/* ------------------------------------------------------------------ */

const round = (iter: number, complete: boolean, opts?: { archived?: boolean }) => ({
  iteration: iter,
  name: `run_it${String(iter).padStart(3, "0")}_optimiser.star`,
  path: `/data/relion/p1/refine3d_x/run_it${String(iter).padStart(3, "0")}_optimiser.star`,
  size: 48_000 + iter,
  complete,
  missing: complete ? [] : [`run_it${String(iter).padStart(3, "0")}_data.star`],
  newest: iter === 12,
  ...(opts?.archived ? {} : { mtimeMs: 1_700_000_000_000 + iter }),
});

const selfSource: ContinueSource = {
  jobId: "job-self-1",
  jobName: "3D Refine (auto)",
  jobType: "refine3d",
  relation: "self",
  lane: "local",
  workdir: "/data/relion/p1/refine3d_x",
  entries: [
    { ...round(12, true), path: "/data/relion/p1/refine3d_x/run_it012_optimiser.star" },
    { ...round(9, true), path: "/data/relion/p1/refine3d_x/run_it009_optimiser.star" },
    { ...round(6, false), path: "/data/relion/p1/refine3d_x/run_it006_optimiser.star" },
  ],
};

const upstreamSource: ContinueSource = {
  jobId: "job-up-1",
  jobName: "Class3D upstream",
  jobType: "class3d",
  relation: "upstream",
  lane: "remote",
  connectionId: "conn-hpc-1",
  workdir: "/scratch/p1/class3d_u",
  truncated: true,
  entries: [
    { ...round(25, true), path: "/scratch/p1/class3d_u/run_it025_optimiser.star" },
  ],
};

/* ------------------------------------------------------------------ */

section("T1  the face — roster, knob, laws");
{
  const cs = AI_TOOLS.find((t) => t.name === "get_continue_sources");
  ok(Boolean(cs), "T1a: get_continue_sources is on the roster");
  ok(
    AI_TOOLS.length === 30 && new Set(AI_TOOLS.map((t) => t.name)).size === 30,
    `T1b: 30 unique tools — t515's products read is the newest birth (got ${AI_TOOLS.length})`
  );
  const params = cs?.parameters as { properties?: Record<string, unknown>; required?: string[] } | undefined;
  ok(
    Object.keys(params?.properties ?? {}).length === 1 &&
      (params?.properties ?? {}).job_id !== undefined &&
      JSON.stringify(params?.required) === '["job_id"]',
    "T1c: exactly one knob — the job id, required"
  );
  ok(
    (cs?.description ?? "").includes("THE tool for") &&
      (cs?.description ?? "").includes("Continue from here:"),
    "T1d: description carries THE tool law and names its paper face"
  );
  ok(
    (cs?.description ?? "").includes("continue_run is the verb that opens one"),
    "T1e: the read-only locator law is IN the description — doors are named, verbs open"
  );
  ok(
    (cs?.description ?? "").includes("never re-derived") &&
      (cs?.description ?? "").includes("the picker's own pick"),
    "T1f: the no-re-derivation law is IN the description — the picker's own pick"
  );
  ok(
    tools.includes('case "get_continue_sources":') &&
      tools.includes("return await getContinueSources(ctx, args);"),
    "T1g: dispatch case wired to the executor"
  );
  ok(
    executorBody.includes("await continueSourcesFor({") &&
      executorBody.includes("CONTINUE_FAMILY_TYPES.has(job.type)"),
    "T1h: the executor drinks the picker's well, behind the family gate"
  );
  ok(
    !executorBody.includes("{ refresh: true }") && !executorBody.includes("refresh"),
    "T1i: the read never forces a refresh — the picker's TTL cache stands"
  );
}

section("T2  the gates — family note verbatim, non-family never scans");
{
  const r = presentContinueSources({ name: "MotionCorr 2", type: "motioncorr" }, []);
  ok(r.ok === true, "T2a: a non-family read still answers (the read succeeded)");
  ok(
    r.summary.includes('have no "Continue from here:"') &&
      r.summary.includes("(class2d, class3d, refine3d, initialmodel, multibody)") &&
      r.summary.includes("carries fn_cont"),
    "T2b: the family note is the route's own sentence, verbatim"
  );
  ok(
    r.summary.includes("MotionCorr 2"),
    "T2c: the summary names the job it read"
  );
  ok(r.detail === undefined, "T2d: nothing to annex for a type that cannot continue");
  const present = presentContinueSources({ name: "X", type: "postprocess" }, [selfSource]);
  ok(
    present.summary.includes("postprocess jobs have no") && !present.summary.includes("legal --continue round"),
    "T2e: the gate fires before any roster arithmetic"
  );
}

section("T3  the roster — locator summary, checkpointOf's head, annex by reference");
{
  const r = presentContinueSources({ name: "3D Refine (auto)", type: "refine3d" }, [
    selfSource,
    upstreamSource,
  ]);
  ok(r.ok === true, "T3a: a populated roster answers ok");
  ok(
    r.summary.includes("2 continue sources (1 self · 1 upstream)") &&
      r.summary.includes("3 legal --continue rounds"),
    "T3b: the locator speaks row and round counts as filters of the roster"
  );
  ok(
    r.summary.includes("Checkpoint (the picker's own pick): iteration 12"),
    "T3c: the checkpoint is the arc's head — checkpointOf's pick, spoken"
  );
  ok(
    !r.summary.includes("archived generation"),
    "T3d: a live-tree checkpoint says nothing about archives"
  );
  ok(
    r.summary.includes("1 remote row speaks CLUSTER paths"),
    "T3e: the path-coordinate law rides the summary when a remote row exists"
  );
  ok(
    r.summary.includes("1 listing hit their cap"),
    "T3f: a capped listing admits it is a floor"
  );
  const detail = r.detail as { checkpoint: { iteration: number; archived: boolean }; sources: ContinueSource[] };
  ok(
    detail.checkpoint.iteration === 12 && detail.checkpoint.archived === false,
    "T3g: the annex's head IS checkpointOf's object (live tree, iteration 12)"
  );
  ok(
    Object.keys(r.detail as object)[0] === "checkpoint",
    "T3h: the arc's head rides detail FIRST — t511's head law, continue edition"
  );
  ok(
    detail.sources.length === 2 && detail.sources[0] === selfSource && detail.sources[1] === upstreamSource,
    "T3i: the annex is the roster BY REFERENCE — zero clone, zero re-order"
  );
  ok(!presenterBody.includes(".sort("), "T3j: locator law — the presenter never re-orders the picker's rows");

  const archived = presentContinueSources({ name: "A", type: "refine3d" }, [
    {
      ...selfSource,
      archived: true,
      entries: [{ ...round(7, true), path: "/data/relion/p1/refine3d_x/.cryoflow_prev/run_it007_optimiser.star" }],
    },
  ]);
  ok(
    archived.summary.includes("iteration 7 — from the archived generation") &&
      (archived.detail as { checkpoint: { archived: boolean } }).checkpoint.archived === true,
    "T3k: an archived checkpoint says so — the live tree held no complete round"
  );

  const upstreamOnly = presentContinueSources({ name: "B", type: "class3d" }, [upstreamSource]);
  ok(
    upstreamOnly.summary.includes("No self checkpoint — the legal rounds live on upstream rows only."),
    "T3l: an upstream-only world names the fact instead of inventing a self arc"
  );

  const allIncomplete = presentContinueSources({ name: "C", type: "refine3d" }, [
    { ...selfSource, entries: [round(3, false), round(5, false)] },
  ]);
  ok(
    allIncomplete.summary.includes("0 legal --continue rounds") &&
      allIncomplete.summary.includes("every round on disk is missing siblings"),
    "T3m: rounds shown but never legal — the zero-continuable world is said"
  );

  const rowsNoRounds = presentContinueSources({ name: "Hollow Refine", type: "refine3d" }, [
    { ...selfSource, entries: [] },
  ]);
  ok(
    rowsNoRounds.summary.includes("No optimiser round exists on disk yet") &&
      !rowsNoRounds.summary.includes("missing siblings"),
    "T3n: rows without rounds are said precisely — 'missing siblings' would lie about an empty disk (the live QA fixture's own shape)"
  );
}

section("T4  the absences — empty roster, all-wounded roster");
{
  const r = presentContinueSources({ name: "Fresh Refine", type: "refine3d" }, []);
  ok(r.ok === true, "T4a: an empty roster is a successful read");
  ok(
    r.summary.includes("No continue sources for Fresh Refine") &&
      r.summary.includes("run_it001_optimiser.star"),
    "T4b: the absence is said, and the first-round name teaches when it changes"
  );
  const wounded = presentContinueSources({ name: "Wounded Refine", type: "refine3d" }, [
    {
      ...selfSource,
      entries: [],
      error: "workdir /data/relion/p1/refine3d_x vanished mid-scan",
    },
  ]);
  ok(wounded.ok === false, "T4c: an all-wounded roster cannot answer as healthy");
  ok(
    wounded.summary.includes("workdir /data/relion/p1/refine3d_x vanished mid-scan"),
    "T4d: the scan's own error line rides the summary VERBATIM"
  );
  ok(
    ((wounded.detail as { sources: ContinueSource[] }).sources ?? []).length === 1,
    "T4e: the wounded row still rides the annex — a dropped contestant lies"
  );
}

section("T5  neighbors — the route, the verb, the laws next door");
{
  ok(
    route.includes("Cross-site access to job data is not allowed") &&
      route.includes('searchParams.get("refresh") === "1"'),
    "T5a: the picker route's 403 gate and refresh door untouched"
  );
  ok(
    route.includes('only the refine family (class2d, class3d, refine3d, initialmodel, multibody) carries fn_cont'),
    "T5b: the route's family note is the sentence T2b quotes — one law, two faces"
  );
  ok(
    tools.includes("NO CHECKPOINT, NO VERB; NO KNOB, NO VERB"),
    "T5c: t471's verb keeps its laws — the read never blurs into the write"
  );
  ok(
    tools.includes("const STORAGE_TOOL_JOB_CAP = 20;"),
    "T5d: t511's storage cap stands unchanged next door"
  );
  ok(
    !executorBody.includes("run_job") && !executorBody.includes("startJob"),
    "T5e: the executor is a pure read — no dispatch lane in sight"
  );
}

/* ------------------------------------------------------------------ */

console.log(`\n=== t513 continue-sources bench: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);

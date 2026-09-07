/**
 * CryoFlow — workflow-import compatibility test.
 *
 * Validates the forward-compat layer in workflow-io.ts against the LIVE
 * catalog in workflow.ts:
 *   1. every canonical JOB_TYPES id passes normalizeTypeId unchanged;
 *   2. every TYPE_ALIASES target is a real canonical id (no typos in the
 *      map — an alias pointing nowhere would silently fail imports);
 *   3. cosmetic drift ("Class2D", "class-2d", " REFINE3D ") normalizes to
 *      the canonical id;
 *   4. legacy aliases resolve ("classify_2d" → "class2d", …);
 *   5. genuinely unknown ids stay null (loud failure, never silent skip);
 *   6. parseWorkflowJson version policy: v0/v-negative rejected, current
 *      accepted, future versions accepted WITH a warning, old-format
 *      header rejected;
 *   7. an aliased-type file round-trips: parse maps the type and keeps
 *      edges valid.
 *
 * Run: bun scripts/test-workflow-compat.ts
 */

import { JOB_TYPES } from "../src/lib/workflow";
import {
  TYPE_ALIASES,
  WORKFLOW_FORMAT,
  WORKFLOW_VERSION,
  normalizeTypeId,
  parseWorkflowJson,
  type WorkflowFile,
} from "../src/lib/workflow-io";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};
const pass = (msg: string) => console.log(`  ✓ ${msg}`);
const check = (cond: boolean, msg: string) => (cond ? pass(msg) : fail(msg));

console.log("1. canonical ids survive normalization");
for (const t of JOB_TYPES) {
  const out = normalizeTypeId(t.key);
  if (out !== t.key) fail(`"${t.key}" → ${out} (expected identity)`);
}
console.log(`  (${JOB_TYPES.length} types checked)`);

console.log("2. alias targets are canonical ids");
{
  const canonical = new Set(JOB_TYPES.map((t) => t.key));
  for (const [alias, target] of Object.entries(TYPE_ALIASES)) {
    if (!canonical.has(target)) fail(`alias "${alias}" points at unknown type "${target}"`);
    if (canonical.has(alias)) fail(`alias "${alias}" shadows a canonical id`);
  }
  pass(`checked ${Object.keys(TYPE_ALIASES).length} aliases`);
}

console.log("3. cosmetic drift");
{
  const cases: [string, string][] = [
    ["Class2D", "class2d"],
    ["class-2d", "class2d"],
    ["  REFINE3D  ", "refine3d"],
    ["Import", "import"],
  ];
  for (const [raw, want] of cases) {
    const got = normalizeTypeId(raw);
    check(got === want, `"${raw}" → ${got} (want ${want})`);
  }
}

console.log("4. legacy aliases");
{
  const cases: [string, string][] = [
    ["classify_2d", "class2d"],
    ["classify_3d", "class3d"],
    ["auto_pick", "autopick"],
    ["ctf_find", "ctffind"],
    ["motion_cor", "motioncorr"],
    ["MotionCor2", "motioncorr"],
    ["initial_model", "initialmodel"],
    ["refine_3d", "refine3d"],
    ["mask_create", "maskcreate"],
    ["post_process", "postprocess"],
    ["import_movies", "import"],
  ];
  for (const [raw, want] of cases) {
    const got = normalizeTypeId(raw);
    check(got === want, `"${raw}" → ${got} (want ${want})`);
  }
}

console.log("5. unknown ids stay null");
for (const raw of ["", "   ", "!!!" , "topaz_pick", "class2dv3", "unknown_job"]) {
  const got = normalizeTypeId(raw);
  check(got === null, `"${raw}" → ${got} (want null)`);
}

const fileOf = (over: Partial<WorkflowFile> = {}): string => {
  const base: WorkflowFile = {
    format: WORKFLOW_FORMAT,
    version: WORKFLOW_VERSION,
    exportedAt: "2026-09-07T00:00:00.000Z",
    project: "t",
    workspace: "Main",
    jobs: [
      { type: "extract", name: "Extract 1", x: 0, y: 0, params: {} },
      { type: "class2d", name: "Class2D 1", x: 200, y: 0, params: {} },
    ],
    edges: [{ from: 0, to: 1, fromPort: "particles", toPort: "particles" }],
  };
  return JSON.stringify({ ...base, ...over });
};

console.log("6. version policy");
{
  const v0 = parseWorkflowJson(fileOf({ version: 0 }));
  check(!v0.ok && !!v0.error, `v0 rejected (${v0.error})`);
  const vCur = parseWorkflowJson(fileOf());
  check(vCur.ok && !vCur.warning, "current version accepted, no warning");
  const vNext = parseWorkflowJson(fileOf({ version: WORKFLOW_VERSION + 1 }));
  check(vNext.ok && !!vNext.warning, `future version accepted WITH warning (${vNext.warning ?? "none"})`);
  const vOld = parseWorkflowJson(fileOf({ version: 1 }));
  check(vOld.ok && !vOld.warning, "v1 (== current) accepted");
  const badFormat = parseWorkflowJson(fileOf({ format: "other-tool/export" as never }));
  check(!badFormat.ok, `foreign format rejected (${badFormat.error})`);
}

console.log("7. aliased-type file round-trips");
{
  const raw = fileOf({
    jobs: [
      { type: "MotionCor2", name: "Legacy MC", x: 10, y: 20, params: {} },
      { type: "classify_2d", name: "Legacy 2D", x: 210, y: 20, params: {} },
    ],
    edges: [{ from: 0, to: 1, fromPort: "micrographs", toPort: "particles" }],
  });
  const parsed = parseWorkflowJson(raw);
  check(parsed.ok, `parsed (${parsed.error ?? "ok"})`);
  if (parsed.ok && parsed.file) {
    check(parsed.file.jobs[0].type === "motioncorr", `job1 type mapped → ${parsed.file.jobs[0].type}`);
    check(parsed.file.jobs[1].type === "class2d", `job2 type mapped → ${parsed.file.jobs[1].type}`);
    check(parsed.file.edges.length === 1, "edge preserved");
  }
  const unknown = parseWorkflowJson(fileOf({ jobs: [{ type: "quantum_fold", name: "X", x: 0, y: 0, params: {} }] } as never));
  check(!unknown.ok && (unknown.error ?? "").includes("quantum_fold"), `unknown type error names the type (${unknown.error})`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

#!/usr/bin/env node
// t1138-agent-mouth-unit.mjs — the agent's mouth on the push door, the
// census's 76th instrument.
//
// THE LAW (the one-well law's agent face): t1137 built the twin-refresh
// push door (route + planner + witness); t1138 gives the AI shelf its
// MOUTH on that door — refresh_cluster_twin, the 38th tool. The mouth
// drinks the ONE well (resolvePushWitness / pushBooksToTwin /
// planPush — no forked classification), speaks the family's honest
// refusals, and its plan_only face reads the classification without
// pushing. THE BIRTH RIPPLES THE ROSTER: the shelf-count pins across
// the census-absent bench family re-key 34/35/37 → 38, paying the
// count-debt t1087's cure paid halfway (t503 only).
//
// This instrument runs a FABRICATED micro-world (the t481 shape — temp
// DATA_DIR + temp DB, the real mock cluster as the SSH well) and pins,
// in six bands:
//   A. the roster — 38 unique tools, the schema's shape, the executor
//      case wired to the ONE function, and the FAMILY RIPPLE: every
//      AI_TOOLS.length pin in scripts/ reads 38;
//   B. the mouth's honest refusals — the missing-id word, the not-found
//      word, and the no-witness word (source x-ray);
//   C. the live plan_only face — the classification spoken without
//      pushing: the t396 address matches the formula, the witness names
//      its explicit source, and the binary-book skip fires LIVE on a
//      fabricated image stack;
//   D. the LIVE ride — three books ride through the mouth to a scratch
//      twin on the real mock cluster (SSH, remoteUpload's head -c
//      integrity), byte-equal on arrival; the scratch is the bench's
//      own product and is removed by the bench, named;
//   E. the subset refusals — a path outside the take-list is refused
//      with the word that names the take-list AND the honest refusals;
//   F. the skips face — the push bar's classification details (the
//      per-skip rows, the why badge, the word) by source x-ray.

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ---------- the isolated world FIRST (env before any src import) ----- */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t1138-agent-mouth-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
const WORKDIR = path.join(TMP, "workdir", "select_mouthpro1");
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(path.join(WORKDIR, "sub"), { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.CRYOFLOW_DISABLE_BUILTIN_AI = "1";
execSync("bunx prisma db push --skip-generate", {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: "pipe",
});

// the fabricated books: three text books (the take family) + one image
// stack (the binary-book skip's live witness)
writeFileSync(path.join(WORKDIR, "particles_select.star"), "data_star\nloop_\n1 2 3\n");
writeFileSync(path.join(WORKDIR, "run.out"), "the run's own words\n");
writeFileSync(path.join(WORKDIR, "sub", "notes.log"), "a nested book\n");
writeFileSync(path.join(WORKDIR, "img.mrcs"), "BINARY-FACE-NOT-A-BOOK");

// the connection registry: clone the REAL mock-cluster row (the well the
// whole family rides — the credentials never leave this machine)
const realRegistry = JSON.parse(
  readFileSync("/home/z/my-project/data/remote-connections.json", "utf8")
);
const realConn = realRegistry.find((c) => c.id === "conn-mvbjhms6");
if (!realConn) {
  console.error("the real mock-cluster connection row is missing — the ride cannot run honestly");
  process.exit(2);
}
writeFileSync(
  path.join(DATA_DIR, "remote-connections.json"),
  JSON.stringify([realConn], null, 2)
);

/* ---------- imports (after env) -------------------------------------- */

const { executeAiTool, AI_TOOLS } = await import("../src/lib/ai/tools");
const { db } = await import("../src/lib/db");
const { upsertRun } = await import("../src/lib/relion/engine");
const { remoteWorkdirForJob } = await import("../src/lib/relion/workdir");

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? "ok" : "FAIL"}: ${label}`);
};
const md5 = (p) => createHash("md5").update(readFileSync(p)).digest("hex");

/* ---------- fixture: project + job + run record ---------------------- */

const project = await db.project.create({ data: { name: "t1138 agent mouth" } });
const ws = await db.workspace.create({ data: { projectId: project.id, name: "Main" } });
const job = await db.job.create({
  data: {
    projectId: project.id,
    workspaceId: ws.id,
    type: "select",
    name: "Twin Mouth Probe",
    x: 100,
    y: 200,
    status: "completed",
    progress: 100,
    params: JSON.stringify({}),
    duration: 1000,
  },
});
upsertRun(job.id, {
  jobId: job.id,
  projectId: project.id,
  type: "select",
  pid: null,
  cmd: "engine-native: particle selection (class-aware)",
  workdir: WORKDIR,
  logFile: path.join(WORKDIR, "run.out"),
  errFile: path.join(WORKDIR, "run.err"),
  startedAt: new Date().toISOString(),
  outputs: {},
  done: true,
  exitCode: 0,
});
const ctx = { projectId: project.id };
const EXPECTED_TWIN = remoteWorkdirForJob(
  realConn.remoteRoot,
  project.id,
  "select",
  job.id
);
const SCRATCH_TWIN = `/home/z/my-project/services/mock-cluster/fs${EXPECTED_TWIN}`;

console.log("== A. the roster (38 unique, the schema, the family ripple) ==");
{
  ok(AI_TOOLS.length === 38, `the shelf holds 38 tools (${AI_TOOLS.length})`);
  ok(new Set(AI_TOOLS.map((t) => t.name)).size === 38, "all 38 names unique");
  const t = AI_TOOLS.find((x) => x.name === "refresh_cluster_twin");
  ok(t != null, "refresh_cluster_twin is on the roster");
  ok(t?.parameters?.required?.[0] === "job_id", "job_id is the required knob");
  const props = t?.parameters?.properties ?? {};
  ok(props.plan_only && props.paths && props.connection_id, "plan_only, paths and connection_id are the optional knobs");
  ok((t?.description ?? "").includes("STALE"), "the description names the staleness the door cures");

  const toolsSrc = readFileSync("/home/z/my-project/src/lib/ai/tools.ts", "utf8");
  ok(/case "refresh_cluster_twin":/.test(toolsSrc) && /refreshClusterTwin\(ctx, args\)/.test(toolsSrc), "the executor case is wired to the ONE function");
  ok(/resolvePushWitness/.test(toolsSrc) && /pushBooksToTwin/.test(toolsSrc) && /planPush/.test(toolsSrc), "the mouth drinks the ONE well (the twin-push libs, no forked classification)");

  // the FAMILY RIPPLE: every bench pin in scripts/ reads 38
  const scriptsDir = "/home/z/my-project/scripts";
  const pins = [];
  for (const f of readdirSync(scriptsDir)) {
    if (!/\.ts$/.test(f) && !/\.mjs$/.test(f)) continue;
    if (f === "t1138-agent-mouth-unit.mjs") continue;
    const src = readFileSync(path.join(scriptsDir, f), "utf8");
    for (const m of src.matchAll(/AI_TOOLS\.length === (\d+)/g)) pins.push([f, m[1]]);
  }
  ok(pins.length >= 20, `the family's pin census found the pins (${pins.length} across the benches)`);
  ok(pins.every(([, n]) => n === "38"), `every pin reads 38 (${pins.filter(([, n]) => n !== "38").map(([f, n]) => `${f}:${n}`).join(", ") || "no stragglers"})`);
}

console.log("== B. the mouth's honest refusals ==");
{
  const noId = await executeAiTool("refresh_cluster_twin", {}, ctx);
  ok(noId.ok === false && noId.summary.includes("needs a job id"), "a missing job_id is refused with its own word");

  const noJob = await executeAiTool("refresh_cluster_twin", { job_id: "no-such-job" }, ctx);
  ok(noJob.ok === false && noJob.summary.includes("No job"), "a not-found job is refused and points at get_workflow_state");

  const toolsSrc = readFileSync("/home/z/my-project/src/lib/ai/tools.ts", "utf8");
  ok(toolsSrc.includes("the push leg rides a witness"), "the no-witness word names the way out (list_clusters or one remote run)");
  ok(toolsSrc.includes("has no local workdir"), "a workdir-less job has its own honest word");
}

console.log("== C. the live plan_only face (the classification without the push) ==");
{
  const probe = await executeAiTool(
    "refresh_cluster_twin",
    { job_id: job.id, plan_only: true, connection_id: realConn.id },
    ctx
  );
  ok(probe.ok === true, `plan_only answers ok (${probe.ok})`);
  ok(probe.summary.includes("3 book(s) would ride"), `the summary counts the take-list (${probe.summary.slice(0, 90)}...)`);
  ok(probe.summary.includes("1 file(s) stay home by policy"), "the summary counts the skip");
  ok(probe.detail?.twin_workdir === EXPECTED_TWIN, `the address is the t396 formula's answer (${probe.detail?.twin_workdir})`);
  ok(probe.detail?.witness?.source === "explicit", "the witness names its explicit source (the connection_id arg)");
  const take = (probe.detail?.take ?? []).map((e) => e.rel).sort();
  ok(JSON.stringify(take) === JSON.stringify(["particles_select.star", "run.out", "sub/notes.log"]), `the take-list is the three text books (${take.join(", ")})`);
  const skips = probe.detail?.skips ?? [];
  ok(skips.length === 1 && skips[0].rel === "img.mrcs" && skips[0].why === "binary-book", "the image stack skips with the binary-book verdict, LIVE");
  ok((skips[0]?.word ?? "").includes("t1137"), "the skip's word carries the law's name");
  ok(!existsSync(SCRATCH_TWIN), "plan_only pushed NOTHING (the scratch twin does not exist)");
}

console.log("== D. the LIVE ride (three books through the mouth to the mock cluster) ==");
{
  const push = await executeAiTool(
    "refresh_cluster_twin",
    { job_id: job.id, connection_id: realConn.id },
    ctx
  );
  ok(push.ok === true, `the push answers ok (${push.ok})`);
  ok(push.summary.startsWith("3 book(s) rode to"), `the summary names the ride (${push.summary.slice(0, 100)}...)`);
  ok(push.summary.includes("explicit witness"), "the summary names the witness kind");
  ok(push.summary.includes("binary-book") || push.summary.includes("stayed home by policy"), "the summary speaks the skip's policy line");
  ok(push.detail?.pushed === 3, `the receipt counts 3 pushed (${push.detail?.pushed})`);
  ok(existsSync(SCRATCH_TWIN), "the scratch twin exists on the mock cluster (the writer's product)");
  for (const rel of ["particles_select.star", "run.out", "sub/notes.log"]) {
    const twinFile = path.join(SCRATCH_TWIN, rel);
    ok(existsSync(twinFile) && md5(twinFile) === md5(path.join(WORKDIR, rel)), `byte-equal on arrival: ${rel}`);
  }
  ok(!existsSync(path.join(SCRATCH_TWIN, "img.mrcs")), "the image stack did NOT ride (the policy held on the wire)");
  // the IDEMPOTENCE face: a second ride rewrites byte-identical books
  const push2 = await executeAiTool(
    "refresh_cluster_twin",
    { job_id: job.id, connection_id: realConn.id },
    ctx
  );
  ok(push2.ok === true && push2.detail?.pushed === 3, "the second ride is idempotent (3 rode again, byte-identical)");
  // THE BENCH'S OWN PRODUCT, REMOVED BY THE BENCH: the scratch twin dir
  // under the mock cluster's project root was minted by THIS bench with
  // fabricated ids — no living writer targets it, so leaving it would
  // seed the very fossil this family retires. The rm below is the
  // bench's own receipt, not a world edit.
  rmSync(path.dirname(SCRATCH_TWIN), { recursive: true, force: true });
  ok(!existsSync(SCRATCH_TWIN), "the scratch twin removed by the bench (named: the bench's own product)");
}

console.log("== E. the subset refusals (paths outside the take-list) ==");
{
  const bad = await executeAiTool(
    "refresh_cluster_twin",
    { job_id: job.id, connection_id: realConn.id, paths: ["img.mrcs"] },
    ctx
  );
  ok(bad.ok === false && bad.summary.includes("would not ride under the policy"), "a binary path is refused with the policy word");
  ok(bad.summary.includes("particles_select.star"), "the refusal names the take-list");

  const ghost = await executeAiTool(
    "refresh_cluster_twin",
    { job_id: job.id, connection_id: realConn.id, paths: ["nope.star"] },
    ctx
  );
  ok(ghost.ok === false && ghost.summary.includes("nope.star"), "an unknown path is refused by name");
  ok(ghost.summary.includes("image data"), "the refusal names the honest refusals too");
}

console.log("== F. the skips face (the push bar's classification details) ==");
{
  const src = readFileSync("/home/z/my-project/src/components/workflow/results/results-view.tsx", "utf8");
  ok(/probe\.skips\.length > 0 && !running && settled === 0/.test(src), "the skips face gates on a settled, un-pushed state");
  ok(/<details className="mt-1 text-\[10px][^"]*"/.test(src) && src.includes("show the classification"), "the classification opens in a details element (the +N more earns its expansion)");
  ok(/probe\.skips\.map\(\(s\) =>/.test(src), "every skip gets its own row");
  ok(/s\.why === "binary-book"/.test(src) && src.includes("bg-muted text-muted-foreground"), "the binary-book badge wears the muted class (a policy, not a warning)");
  ok(src.includes("bg-amber-500/10 text-amber-700"), "a capped skip wears the amber badge (a cap the user can raise)");
  ok(/\{s\.word\}/.test(src), "each row speaks its own honest word");
  ok(/formatBytes\(s\.size\)/.test(src), "each row carries the book's size");
}

/* ---------- cleanup: the temp world ---------------------------------- */

rmSync(TMP, { recursive: true, force: true });

console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
process.exit(0);

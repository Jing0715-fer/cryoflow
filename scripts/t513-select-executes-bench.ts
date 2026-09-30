/**
 * t513 — the selection that actually executes.
 *
 * The user's two complaints, as bench doors:
 *   A. select_classes (the AI tool) created a select2d but never RAN it —
 *      the selection never executed. Now: create AND run (engine-native,
 *      sub-second), honest run note in the summary, kept-particle count in
 *      the result.
 *   B. a birth-selected select2d (classStarSelection from the gallery or
 *      the AI, selectedClasses unset) dispatched on the LOCAL lane fell to
 *      "auto" occupancy — keeping the WRONG set. Now:
 *      explicitSelectionOf answers from the birth selection.
 *   C. the explicit string param still wins over the birth selection
 *      (the panel's edited list is the user's latest word).
 *
 * Run: bun scripts/t513-select-executes.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t513-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.CRYOFLOW_DISABLE_BUILTIN_AI = "1";

execSync("bunx prisma db push --skip-generate", {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: "pipe",
});

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

const { db } = await import("../src/lib/db");
const { ensureActiveProject } = await import("../src/lib/seed");
const { executeAiTool } = await import("../src/lib/ai/tools");
const { startJob } = await import("../src/lib/relion/dispatch");
const { defaultParams } = await import("../src/lib/workflow");

/* ------------------------------------------------------------------ */
/* The world: a class2d whose workdir holds a settled round             */
/* ------------------------------------------------------------------ */

const active = await ensureActiveProject();
must(active != null, "world: the isolated project exists");
const projectId = active!.project.id;

const clsJob = await db.job.create({
  data: {
    projectId,
    type: "class2d",
    name: "2D Classification 1",
    x: 200,
    y: 200,
    params: JSON.stringify(defaultParams("class2d")),
    status: "completed",
  },
});
must(clsJob != null, "world: the class2d row exists");

const workdir = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
mkdirSync(workdir, { recursive: true });
{
  const rows: string[] = [];
  for (let i = 0; i < 300; i++) rows.push(`1 mic_${i}.mrcs`);
  for (let i = 0; i < 200; i++) rows.push(`2 mic_${i}.mrcs`);
  for (let i = 0; i < 100; i++) rows.push(`3 mic_${i}.mrcs`);
  writeFileSync(
    path.join(workdir, "run_it002_data.star"),
    `data_particles\n\nloop_\n_rlnClassNumber #1\n_rlnImageName #2\n${rows.join("\n")}\n\n`
  );
  // the witness latestIterationDataStar demands before trusting a round
  writeFileSync(
    path.join(workdir, "run_it002_model.star"),
    `data_model_general\n\n_rlnCurrentResolution 4.2\n_rlnPixelSize 1.0\n\n`
  );
}
must(existsSync(path.join(workdir, "run_it002_data.star")), "world: the settled data star is seeded (600 particles, 300/200/100)");

const ctx = { projectId };

/* ------------------------------------------------------------------ */
/* A. select_classes creates AND runs the select2d                      */
/* ------------------------------------------------------------------ */

console.log("A. select_classes: create + run");

const rA = await executeAiTool("select_classes", { job_id: clsJob.id, classes: [1, 2] }, ctx);
must(rA.ok === true, `A1: the tool answers ok (got ${rA.ok})`);
const jobIdA = (rA.detail as { jobId?: string } | undefined)?.jobId ?? "";
must(jobIdA.length > 0, "A2: the created job id rides the detail");

const jobA = await db.job.findUnique({ where: { id: jobIdA } });
must(jobA?.type === "select2d", "A3: the created job is a select2d");
must(jobA?.status === "completed", `A4: the selection EXECUTED — status completed (got ${jobA?.status})`);
must(
  typeof jobA?.result === "string" && /500 of 600 particles kept/.test(jobA.result),
  `A5: the result speaks the honest count (got ${jobA?.result})`
);
must(
  typeof rA.summary === "string" && /RAN/.test(rA.summary),
  `A6: the tool summary carries the run note (got ${rA.summary})`
);
const paramsA = JSON.parse(jobA?.params ?? "{}");
must(
  paramsA.selectedClasses === "1, 2",
  `A7: selectedClasses baked for the local lane (got ${JSON.stringify(paramsA.selectedClasses)})`
);
must(
  paramsA.classStarSelection?.jobId === clsJob.id && paramsA.classStarSelection?.classes.join() === "1,2",
  "A8: classStarSelection rides for the remote lane"
);
const outStarA = path.join(DATA_DIR, "relion", projectId, `select2d_${jobIdA.slice(-8)}`, "particles_select2d.star");
must(existsSync(outStarA), "A9: particles_select2d.star landed on disk");
if (existsSync(outStarA)) {
  const kept = readFileSync(outStarA, "utf8")
    .split("\n")
    .filter((l) => /^\d+\s/.test(l.trim()) && !l.trim().startsWith("_")).length;
  must(kept === 500, `A10: exactly 500 rows in the output star (got ${kept})`);
}
const edgeA = await db.edge.findUnique({
  where: { fromJobId_toJobId: { fromJobId: clsJob.id, toJobId: jobIdA } },
});
must(edgeA != null, "A11: class2d → select2d edge wired");

/* ------------------------------------------------------------------ */
/* B. the gallery-born shape: ONLY classStarSelection, no string param   */
/* ------------------------------------------------------------------ */

console.log("B. birth selection on the local lane (gallery shape)");

const jobB = await db.job.create({
  data: {
    projectId,
    type: "select2d",
    name: "2D Class Selection (gallery-born)",
    x: 600,
    y: 200,
    params: JSON.stringify({
      ...defaultParams("select2d"), // selectedClasses stays "auto"
      classStarSelection: { jobId: clsJob.id, classes: [1, 2] },
    }),
  },
});
await db.edge.create({
  data: { projectId, fromJobId: clsJob.id, toJobId: jobB.id },
});
const outcomeB = await startJob(jobB, {});
must(!outcomeB.error && !outcomeB.busy && !outcomeB.waiting, `B1: the gallery-born select2d runs (error=${outcomeB.error ?? "none"})`);
const jobBAfter = await db.job.findUnique({ where: { id: jobB.id } });
must(jobBAfter?.status === "completed", `B2: completed (got ${jobBAfter?.status})`);
must(
  typeof jobBAfter?.result === "string" && /500 of 600 particles kept/.test(jobBAfter.result),
  `B3: the BIRTH set [1,2] was selected, not auto occupancy (got ${jobBAfter?.result})`
);
must(
  typeof jobBAfter?.result === "string" && /birth selection/.test(jobBAfter.result),
  `B4: the mode line names the birth selection (got ${jobBAfter?.result})`
);
// auto occupancy at cutoff 0.5 would have kept classes 1+2 anyway (300,200 ≥ 150)
// — so the DISCRIMINATOR is class 3 vs auto: pick [3] next.
const jobB2 = await db.job.create({
  data: {
    projectId,
    type: "select2d",
    name: "2D Class Selection (gallery-born, [3])",
    x: 600,
    y: 420,
    params: JSON.stringify({
      ...defaultParams("select2d"),
      classStarSelection: { jobId: clsJob.id, classes: [3] },
    }),
  },
});
await db.edge.create({
  data: { projectId, fromJobId: clsJob.id, toJobId: jobB2.id },
});
const outcomeB2 = await startJob(jobB2, {});
const jobB2After = await db.job.findUnique({ where: { id: jobB2.id } });
must(
  !outcomeB2.error && jobB2After?.status === "completed" && /100 of 600 particles kept/.test(jobB2After?.result ?? ""),
  `B5: birth selection [3] keeps exactly class 3's 100 — auto would have said 500 (got ${jobB2After?.result})`
);

/* ------------------------------------------------------------------ */
/* C. the explicit string param wins over the birth selection            */
/* ------------------------------------------------------------------ */

console.log("C. the panel's edited list is the latest word");

const jobC = await db.job.create({
  data: {
    projectId,
    type: "select2d",
    name: "2D Class Selection (edited)",
    x: 600,
    y: 640,
    params: JSON.stringify({
      ...defaultParams("select2d"),
      selectedClasses: "3",
      classStarSelection: { jobId: clsJob.id, classes: [1, 2] },
    }),
  },
});
await db.edge.create({
  data: { projectId, fromJobId: clsJob.id, toJobId: jobC.id },
});
const outcomeC = await startJob(jobC, {});
const jobCAfter = await db.job.findUnique({ where: { id: jobC.id } });
must(
  !outcomeC.error && jobCAfter?.status === "completed" && /100 of 600 particles kept/.test(jobCAfter?.result ?? ""),
  `C1: selectedClasses "3" beats the birth [1,2] (got ${jobCAfter?.result})`
);

/* ------------------------------------------------------------------ */
/* D. heavier target types stay unstarted                                */
/* ------------------------------------------------------------------ */

console.log("D. heavy targets are created, not run");

const rD = await executeAiTool(
  "select_classes",
  { job_id: clsJob.id, classes: [1, 2], target_type: "class3d" },
  ctx
);
must(rD.ok === true, "D1: the class3d target answers ok");
const jobIdD = (rD.detail as { jobId?: string } | undefined)?.jobId ?? "";
const jobD = await db.job.findUnique({ where: { id: jobIdD } });
must(jobD?.type === "class3d" && jobD?.status === "idle", `D2: the class3d is created idle, NOT auto-run (got ${jobD?.status})`);
must(
  typeof rD.summary === "string" && /created unstarted/.test(rD.summary),
  `D3: the summary says unstarted honestly (got ${rD.summary})`
);

/* ------------------------------------------------------------------ */

console.log(`\nt513 select-executes: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);

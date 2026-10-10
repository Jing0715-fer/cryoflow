/**
 * t522 — the ledger learns to remember.
 *
 * The cleanup family's third member: the PAST tense. t517 gave the shovel
 * a menu (get_cleanup_plan), t518 gave it a write face shared by two doors
 * (cleanup_job_files + the dialog's Clean button), and nothing remembered
 * any of it — the dialog closes, the agent's card scrolls away, and "what
 * was deleted here?" had no face. This window adds the ledger
 * (lib/relion/cleanup-history — append + read, cap 50, atomic writes,
 * refusals journaled beside executions) and the 33rd tool
 * get_cleanup_history, whose face speaks the t518 voice (fmtBytes the
 * only bytes, singular/plural verbs, the empty answer that names the
 * doors that would fill it).
 *
 * Bench doors:
 *   T1  the face — roster 33, the history verb's zero-knob contract.
 *   T2  the well — the cap law (53 appended → 50 kept), newest-first.
 *   T3  the empty answer — names both doors, ok:true (empty is an answer).
 *   T4  the real journal — both doors sign one ledger (door attribution),
 *       a refusal rides its reason verbatim, the verdict's own numbers.
 *   T5  the read face — census math, newest-first, fmtBytes voice,
 *       singular/plural, REFUSED lines, the job filter (with the honest
 *       per-job empty), the annex by reference.
 *   T6  the family — prompt law 2, the plan/shovel descriptions, the
 *       route's thin shell, the dialog strip.
 *
 * Run: bun scripts/t522-cleanup-history-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t522-"));
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

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(path.join(REPO, p), "utf8");

const { db } = await import("../src/lib/db");
const { ensureActiveProject } = await import("../src/lib/seed");
const { executeAiTool, presentCleanupHistory, AI_TOOLS } = await import("../src/lib/ai/tools");
const { defaultParams } = await import("../src/lib/workflow");
const { writeRuns } = await import("../src/lib/relion/engine");
const { fmtBytes } = await import("../src/lib/relion/disk-usage");
const { runCleanupExclusive } = await import("../src/lib/relion/cleanup-execute");
const cleanupHistory = await import("../src/lib/relion/cleanup-history");
const { appendCleanupExecution, readCleanupHistory, CLEANUP_HISTORY_MAX } = cleanupHistory;
type CleanupHistoryEntry = import("../src/lib/relion/cleanup-history").CleanupHistoryEntry;

/* ------------------------------------------------------------------ */
/* T1 — the face                                                        */
/* ------------------------------------------------------------------ */

console.log("T1. the face (roster 33, the history verb's contract)");

must(
  AI_TOOLS.length === 34 && new Set(AI_TOOLS.map((t) => t.name)).size === 34,
  `T1a: the roster holds 34 unique tools (got ${AI_TOOLS.length})`
);
const face = AI_TOOLS.find((t) => t.name === "get_cleanup_history");
must(face != null, "T1b: get_cleanup_history sits in the roster");
const props = (face?.parameters.properties ?? {}) as Record<string, { type?: string }>;
must(
  face != null &&
    (!face.parameters.required || (face.parameters.required as string[]).length === 0) &&
    Object.keys(props).length === 1 &&
    props.job_id?.type === "string",
  "T1c: zero required knobs — one optional job filter, nothing else"
);
must(
  face != null &&
    face.description.includes("THE tool for") &&
    face.description.includes("Reads the same ledger both doors write") &&
    face.description.includes("read-only") &&
    face.description.includes("清理历史"),
  "T1d: the description names its family role and reads the zh asker's words"
);

/* ------------------------------------------------------------------ */
/* T2 — the well (cap law, newest-first)                                */
/* ------------------------------------------------------------------ */

console.log("T2. the well (cap, order, atomic lines)");

must(CLEANUP_HISTORY_MAX === 50, "T2a: the ledger keeps a cap of 50 (the t464 law)");
const stamp = (i: number): CleanupHistoryEntry => ({
  at: new Date(Date.UTC(2026, 9, 3, 12, 0, i)).toISOString(),
  jobId: `job-${i}`,
  jobName: `Job ${i}`,
  projectId: "proj-x",
  door: i % 2 === 0 ? "dialog" : "agent",
  scopes: { local: true, remote: false },
  tiers: ["safe"],
  ok: true,
});
for (let i = 0; i < 53; i++) appendCleanupExecution(stamp(i));
const all = readCleanupHistory(200);
must(
  all.length === CLEANUP_HISTORY_MAX,
  `T2b: 53 appends leave exactly ${CLEANUP_HISTORY_MAX} entries (got ${all.length})`
);
must(
  all[0]?.jobId === "job-52" && all[all.length - 1]?.jobId === "job-3",
  "T2c: the read face speaks newest-first (the oldest fell off the front)"
);
must(
  existsSync(path.join(DATA_DIR, "cleanup-history.json")) &&
    JSON.parse(readFileSync(path.join(DATA_DIR, "cleanup-history.json"), "utf8")).version === 1,
  "T2d: the file parses — every write lands whole (atomic rename)"
);
rmSync(path.join(DATA_DIR, "cleanup-history.json")); // clean slate for the real world below

/* ------------------------------------------------------------------ */
/* T3 — the empty answer                                                */
/* ------------------------------------------------------------------ */

console.log("T3. the empty answer (an answer, not an apology)");

const rEmpty = await executeAiTool("get_cleanup_history", {}, { projectId: "proj-x" });
must(
  rEmpty.ok === true && rEmpty.summary.includes("The cleanup ledger is empty"),
  "T3a: an empty ledger answers ok with its own sentence"
);
must(
  rEmpty.summary.includes("cleanup_job_files") &&
    rEmpty.summary.includes("Storage dialog"),
  "T3b: the empty face names both doors that would fill it"
);
must(
  ((rEmpty.detail as { entries: unknown[] }).entries ?? []).length === 0,
  "T3c: the annex rides empty, not undefined"
);

/* ------------------------------------------------------------------ */
/* T4 — the real journal (both doors, one ledger)                       */
/* ------------------------------------------------------------------ */

console.log("T4. the real journal (door attribution, refusals, verdict numbers)");

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
const mcJob = await db.job.create({
  data: {
    projectId,
    type: "motioncorr",
    name: "Motion Correction 1",
    x: 440,
    y: 200,
    params: JSON.stringify(defaultParams("motioncorr")),
    status: "completed",
  },
});
must(clsJob != null && mcJob != null, "world: two job rows exist");

const workdir = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
mkdirSync(path.join(workdir, "shard_1"), { recursive: true });
writeFileSync(path.join(workdir, ".cf-shard-abc"), "x".repeat(11));
writeFileSync(path.join(workdir, "scratch.tmp"), "x".repeat(22));
writeFileSync(path.join(workdir, "shard_1", "parts.star"), "x".repeat(33));
writeFileSync(path.join(workdir, "run_it001_data.star"), "x".repeat(44));
writeFileSync(path.join(workdir, "run_it002_data.star"), "x".repeat(55));
writeFileSync(path.join(workdir, "class2d_001.out.star"), "x".repeat(100));
symlinkSync("/nonexistent/particles.mrcs", path.join(workdir, "input.mrcs"));

writeRuns({
  [clsJob.id]: {
    jobId: clsJob.id,
    projectId,
    type: "class2d",
    pid: null,
    cmd: "qa-fixture (bench)",
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date().toISOString(),
    outputs: { particles_star: path.join(workdir, "class2d_001.out.star") },
    done: true,
    exitCode: 0,
    result: "bench fixture — completed",
  } as never,
});

// door one: the dialog swings it — the verdict and the entry must agree
const vDialog = await runCleanupExclusive(clsJob.id, { local: true, remote: false }, ["safe"], "dialog");
must(vDialog.ok === true && (vDialog.local?.deleted ?? 0) > 0, "T4a: the dialog door really deleted safe files");
const ledgerNow = readCleanupHistory(50);
const eDialog = ledgerNow.find((e) => e.jobId === clsJob.id);
must(
  eDialog != null &&
    eDialog.door === "dialog" &&
    eDialog.ok === true &&
    eDialog.jobName === "2D Classification 1" &&
    eDialog.projectId === projectId &&
    JSON.stringify(eDialog.tiers) === JSON.stringify(["safe"]) &&
    eDialog.local?.deleted === vDialog.local?.deleted &&
    eDialog.local?.freedBytes === vDialog.local?.freedBytes &&
    eDialog.local?.failures === 0,
  "T4b: the dialog door signed the ledger with the verdict's own numbers"
);

// door two: the agent's verb — same ledger, its own name on the line
const vAgent = await runCleanupExclusive(clsJob.id, { local: true, remote: false }, ["safe"], "agent");
must(vAgent.ok === true, "T4c: the agent door answers ok (a second pass may confess zero)");
const eAgent = readCleanupHistory(50).find((e) => e.jobId === clsJob.id && e.door === "agent");
must(
  eAgent != null && eAgent.ok === true,
  "T4d: the agent door signed the same ledger under its own name"
);

// a refusal is journaled beside the executions — with its reason verbatim
const vRefused = await runCleanupExclusive(mcJob.id, { local: true, remote: false }, ["safe"], "agent");
must(vRefused.ok === false, "T4e: a job with no run directory is refused");
const eRefused = readCleanupHistory(50).find((e) => e.jobId === mcJob.id);
must(
  eRefused != null &&
    eRefused.ok === false &&
    eRefused.error === vRefused.error &&
    typeof eRefused.error === "string" &&
    eRefused.error.length > 0,
  "T4f: the refusal rides the ledger with its reason verbatim"
);

must(
  readCleanupHistory(50).length === 3,
  "T4g: two doors + one refusal — three verdicts in one ledger"
);

/* ------------------------------------------------------------------ */
/* T5 — the read face (verb over the real ledger)                       */
/* ------------------------------------------------------------------ */

console.log("T5. the read face (census, voice, filter)");

const rFace = await executeAiTool("get_cleanup_history", {}, { projectId });
must(rFace.ok === true, "T5a: the verb reads the ledger ok");
const faceSummary = rFace.summary as string;
must(
  faceSummary.includes("3 cleanup attempts in the ledger (newest first) — 2 executed, 1 refused"),
  "T5b: the census math speaks (plural attempts, executed vs refused)"
);
must(
  faceSummary.indexOf("Motion Correction 1") < faceSummary.indexOf("2D Classification 1"),
  "T5c: newest-first order holds on the face (the refusal is the newest)"
);
must(
  faceSummary.includes("REFUSED:") && faceSummary.includes(vRefused.error ?? ""),
  "T5d: the refusal line speaks the reason verbatim"
);
must(
  faceSummary.includes(`1 file, ${fmtBytes(vDialog.local?.freedBytes ?? 0)} freed`) ||
    faceSummary.includes(`0 files, 0 B`),
  "T5e: the side phrase speaks fmtBytes lookups and singular/plural files"
);
must(
  !/\b\d{7,}\b/.test(faceSummary),
  "T5f: no raw byte digits leak into the summary — fmtBytes is the only voice"
);
const faceEntries = (rFace.detail as { entries: CleanupHistoryEntry[] }).entries;
must(
  Array.isArray(faceEntries) && faceEntries.length === 3 && faceEntries[0].jobId === mcJob.id,
  "T5g: the annex rides the full entries, newest first"
);

const rFiltered = await executeAiTool("get_cleanup_history", { job_id: clsJob.id }, { projectId });
const filteredEntries = (rFiltered.detail as { entries: CleanupHistoryEntry[] }).entries ?? [];
must(
  (rFiltered.summary as string).includes("2 cleanup attempts") &&
    filteredEntries.length === 2 &&
    filteredEntries.every((e) => e.jobId === clsJob.id),
  "T5h: the job filter answers with ONLY this job's attempts (2 of the 3)"
);

const rGhost = await executeAiTool("get_cleanup_history", { job_id: "cm-ghost" }, { projectId });
must(
  (rGhost.summary as string).includes("cm-ghost"),
  "T5i: an unknown id's empty names the id it was asked for"
);

/* ------------------------------------------------------------------ */
/* T6 — the family law                                                  */
/* ------------------------------------------------------------------ */

console.log("T6. the family (prompt, neighbors, the route shell, the strip)");

const promptSrc = read("src/lib/ai/prompt.ts");
must(
  promptSrc.includes("这台机器最近清过什么？") &&
    /get_cleanup_history/.test(promptSrc),
  "T6a: law 2's read list and zh questions carry the new door"
);
const planFace = AI_TOOLS.find((t) => t.name === "get_cleanup_plan");
const shovelFace = AI_TOOLS.find((t) => t.name === "cleanup_job_files");
must(
  planFace != null &&
    shovelFace != null &&
    planFace.description.includes("both doors signing the same ledger that get_cleanup_history reads") &&
    shovelFace.description.includes("get_cleanup_history reads it back"),
  "T6b: the plan and the shovel teach the ledger in their own laws"
);
const routeBody = read("src/app/api/cleanup-history/route.ts");
must(
  routeBody.includes("readCleanupHistory") &&
    routeBody.includes("isLocalRequest") &&
    !routeBody.includes("readFileSync") &&
    !routeBody.includes("JSON.parse"),
  "T6c: the route is a thin guard+json shell — the ledger's parse never leaks into it"
);
const dialogSrc = read("src/components/workflow/cleanup-dialog.tsx");
must(
  dialogSrc.includes('data-cleanup-history=""') &&
    dialogSrc.includes('fetch("/api/cleanup-history"') &&
    dialogSrc.includes("e.jobId === job.id") &&
    dialogSrc.includes("Recent cleanups on this job"),
  "T6d: the dialog strip fetches the ledger face and filters to its own job"
);
must(
  dialogSrc.includes("refused —") &&
    dialogSrc.includes("e.door"),
  "T6e: the strip speaks refusals and door badges — the audit rides with the ask"
);

await db.$disconnect();
console.log(`\nt522 cleanup-history bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

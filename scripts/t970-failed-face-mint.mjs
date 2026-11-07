#!/usr/bin/env node
/**
 * t970 — the FAILED DIAGNOSIS FACE: the world's sixth job, minted honest so
 * the ResultSummary's failed branch — the "Job failed" card with the Task
 * 120/121 diagnosis teaser (count + the ovd chips) — gets its FIRST
 * measured fold ride. The t969 note's ① cashed in: the chip row's
 * 258-vs-231 number was recorded on this face and never ridden.
 *
 * The mint is ADDITIVE (the t966 grammar verbatim): a separate job, a
 * separate workdir, no remote manifest, removable without touching the
 * seed trio / the door / the bench. The face's story is a REAL motioncor2
 * death — the classic cascade: CUDA out of memory on GPU 0, the CPU retry,
 * the kernel's OOM killer finishes it (exit 137). Its run.out therefore
 * matches TWO known signatures (gpu-oom ×2, oom-kill ×2) — the teaser
 * renders two chips, both with the ×N count spans, which is the point:
 * the first measured ride should see every shape the teaser can speak.
 *
 * The mint rides three established precedents:
 *   · t966  — API job creation + workdir files + engine-state.json direct
 *             write (atomic rename defeats the reader's half-read)
 *   · t263  — the row flip (PATCH only allows idle; suites write rows
 *             straight in the db, values travel as bindings)
 *   · t318/t323 — the log contract: run.out is non-empty (the negative
 *             state stays null), the log ends on a signature match (the
 *             silent-death autopsy stays out of the way)
 *
 *   node scripts/t970-failed-face-mint.mjs mint|verify|remove
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME = "Failed Diagnosis Face (t970)";
const PROJECT_ID = process.env.MINT_PROJECT_ID ?? "cmv6ml09e0000kn9mgxrsun5w"; // the standing world (the doctor's ACTIVE) — env-overridable so a re-seeded world re-keys without an edit
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");
const RESULT_SENTENCE =
  "motioncor2 exited 137 — CUDA error: out of memory on GPU 0; the CPU retry was killed by the kernel's OOM killer (the t970 failed diagnosis face)";

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) { pass += 1; console.log(`ok ${pass} — ${label}${detail ? ` (${detail})` : ""}`); }
  else { fail += 1; console.log(`FAIL ${fail} — ${label}${detail ? ` (${detail})` : ""}`); }
};

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", timeout: 60_000 }); } catch (e) { return String(e?.stdout ?? e); }
};
const api = (method, url, body) => {
  const out = execSync(
    `curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`,
    { encoding: "utf8", timeout: 60_000 }
  );
  try { return JSON.parse(out); } catch { return { raw: out }; }
};
const jobByName = () => {
  const body = api("GET", "/api/jobs");
  const arr = Array.isArray(body) ? body : body.jobs ?? [];
  return arr.find((j) => j.name === NAME) ?? null;
};
const workdirOf = (jobId) => path.join(DATA_ROOT, `motioncorr_${jobId.slice(-8)}`);

/* the failed face's run.out — a REAL motioncor2 death, not a signature
 * dump: honest header lines, twelve honest per-movie progress lines, the
 * CUDA allocation failure, the CPU fallback, the kernel's kill. The two
 * gpu-oom lines and the two oom-kill lines are the shapes a real OOM
 * cascade leaves in a log; every other line matches nothing. */
const failedRunOut = () =>
  [
    "RELION motioncorr (t970 failed diagnosis face)",
    "  command: relion_motioncorr --i Movies/*.mrcs --o . --j 8 --gpu 0 --dose_weighting",
    "  84 movies found in the import's micrographs.star",
    "  threads: 8 · gpu: 0 · patch: 5x5",
    "",
    "[2026-10-13 20:55:01.112] motioncor2: frame alignment started (84 movies)",
    "[2026-10-13 20:55:09.431] motioncor2: movie 0001 aligned — shift (2.31, -1.87) px",
    "[2026-10-13 20:55:11.208] motioncor2: movie 0002 aligned — shift (1.92, -1.10) px",
    "[2026-10-13 20:55:13.044] motioncor2: movie 0003 aligned — shift (2.05, -0.88) px",
    "[2026-10-13 20:55:15.331] motioncor2: movie 0004 aligned — shift (1.44, -1.62) px",
    "[2026-10-13 20:55:17.702] motioncor2: movie 0005 aligned — shift (0.98, -1.35) px",
    "[2026-10-13 20:55:19.918] motioncor2: movie 0006 aligned — shift (1.71, -0.94) px",
    "[2026-10-13 20:55:22.305] motioncor2: movie 0007 aligned — shift (2.18, -1.23) px",
    "[2026-10-13 20:55:24.587] motioncor2: movie 0008 aligned — shift (1.35, -1.78) px",
    "[2026-10-13 20:55:26.941] motioncor2: movie 0009 aligned — shift (1.07, -1.02) px",
    "[2026-10-13 20:55:29.263] motioncor2: movie 0010 aligned — shift (1.88, -1.41) px",
    "[2026-10-13 20:55:31.690] motioncor2: movie 0011 aligned — shift (2.02, -0.76) px",
    "[2026-10-13 20:55:34.114] motioncor2: movie 0012 aligned — shift (1.29, -1.55) px",
    "[2026-10-13 20:55:36.402] motioncor2: cudaMalloc returned out of memory for the full-frame stack (device 0)",
    "[2026-10-13 20:55:36.403] motioncor2: GPU 0 has 4.2 GB free, the dose-weighting stack needs 6.5 GB — the batch is too large for this card",
    "[2026-10-13 20:55:36.404] CUDA error: out of memory (tried to allocate 6.50 GB on device 0)",
    "[2026-10-13 20:55:36.410] motioncor2: falling back to CPU alignment (threads 8, patch 5x5)",
    "[2026-10-13 20:55:44.517] motioncor2: CPU path started on movie 0013",
    "[  8423.117664] oom-killer: invoked oom-killer: gfp_mask=0x100cca(GFP_HIGHUSER_MOVABLE), order=4",
    "[  8423.117901] Tasks state (memory values in pages): the CPU retry's 8 threads touched 39.1 GB resident",
    "bash: line 1:  84231 Killed                  relion_motioncorr --i Movies/*.mrcs --o . --j 8 --gpu 0 --dose_weighting",
    "",
  ].join("\n");

/* the run record — the t966 grammar verbatim, with the failed run's
 * honest fields: done:true, exitCode 137 (128+9, the SIGKILL exit), no
 * outputs. readRuns re-parses on the external write (mtime cache busted). */
const writeRunRecord = (jobId, workdir) => {
  const record = {
    jobId,
    projectId: PROJECT_ID,
    type: "motioncorr",
    pid: null,
    cmd: "relion_motioncorr --i Movies/*.mrcs --o . --j 8 --gpu 0  # t970 failed diagnosis face",
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date(Date.now() - 3_620_000).toISOString(),
    outputs: {},
    done: true,
    exitCode: 137,
    result: RESULT_SENTENCE,
  };
  const raw = readFileSync(STATE_FILE, "utf8");
  const runs = JSON.parse(raw);
  runs[jobId] = record;
  const tmp = `${STATE_FILE}.t970.tmp`;
  writeFileSync(tmp, JSON.stringify(runs, null, 2));
  // rename defeats the reader's half-written read (the t963 lesson)
  execSync(`mv "${tmp}" "${STATE_FILE}"`);
  return record;
};

/* the row flip — the t966/t263 grammar: Prisma bindings, the canonical db,
 * status/progress/result in one update. The orphan heal ignores failed
 * rows the same way it ignores completed ones (no upstream to heal). */
const flipRow = (jobId) =>
  spawnSync(
    "node",
    [
      "-e",
      `const { PrismaClient } = require("@prisma/client");
       const db = new PrismaClient();
       db.job.update({
         where: { id: process.argv[1] },
         data: { status: "failed", progress: 37, result: process.env.T970_RESULT },
       }).then(() => db.$disconnect()).catch((e) => { console.error(String(e)); process.exit(1); });`,
      jobId,
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${process.cwd()}/db/cryoflow.db`, T970_RESULT: RESULT_SENTENCE },
      encoding: "utf8",
      timeout: 30_000,
    }
  );

/* ------------------------------------------------------------ mint */
const stage = process.argv[2] ?? "mint";

if (stage === "mint") {
  console.log("== t970 failed-face mint ==");
  const probe = sh(`curl -s -o /dev/null -w "%{http_code}" ${ORIGIN} "${BASE}/api/jobs" --max-time 8`);
  if (probe !== "200") {
    console.log(`FATAL: the server did not answer 200 (${probe}) — the lane must be alive to mint`);
    process.exit(2);
  }

  let job = jobByName();
  if (job) {
    console.log(`(the failed face already exists: ${job.id} — reusing, files re-stamped)`);
  } else {
    // mints pass explicit x/y (the law) — the bench's column, below it:
    // (2400 put the card past the canvas's fitted width and the card rode
    // out of the 1280 viewport — the BEFORE ride's first lesson)
    const made = api("POST", "/api/jobs", { type: "motioncorr", name: NAME, x: 1960, y: 760 });
    job = made?.job ?? made;
    if (!job?.id) {
      console.log(`FATAL: job creation refused: ${JSON.stringify(made).slice(0, 300)}`);
      process.exit(2);
    }
    console.log(`job minted: ${job.id}`);
  }

  const workdir = workdirOf(job.id);
  mkdirSync(workdir, { recursive: true });
  writeFileSync(path.join(workdir, "run.out"), failedRunOut());
  writeFileSync(path.join(workdir, "run.err"), ""); // the t966 face4 shape — stderr silent, the story lives in run.out
  writeRunRecord(job.id, workdir);
  console.log(`workdir + failed log + run record written: ${workdir}`);

  const flip = flipRow(job.id);
  if (flip.status !== 0) {
    console.log(`FATAL: the row flip failed: ${(flip.stderr ?? "").slice(0, 300)}`);
    process.exit(2);
  }

  let status = "";
  for (let i = 0; i < 10; i++) {
    status = jobByName()?.status ?? "";
    if (status === "failed") break;
    execSync("sleep 1");
  }
  ok(status === "failed", "the face's row is FAILED (the minted row-flip)", `status=${status}`);

  const outBytes = existsSync(path.join(workdir, "run.out")) ? readFileSync(path.join(workdir, "run.out")).length : 0;
  ok(outBytes > 1500 && outBytes < 8 * 1024 * 1024, "the failed run.out is on disk (non-empty — the t318 law)", `${outBytes}B`);

  // the log route must answer for the face — the teaser's fetch rides it
  const log = api("GET", `/api/jobs/${job.id}/log?full=1`);
  const text = typeof log?.tail === "string" ? log.tail : typeof log?.text === "string" ? log.text : "";
  ok(text.length > 0, "the log route answers the face's full log", `${text.length}B`);
  ok(/CUDA error: out of memory/i.test(text), "the log carries the gpu-oom signature (line 1 of 2)");
  ok(/cudaMalloc returned out of memory/i.test(text), "the log carries the gpu-oom signature (line 2 of 2)");
  ok(/\bKilled\b/.test(text), "the log carries the oom-kill signature (the shell's report)");
  ok(/oom-killer: invoked oom-killer/i.test(text), "the log carries the oom-kill signature (the kernel's report)");
  ok(log?.truncated === false, "the log is under the 8MB cap (truncated false)");

  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ verify */
if (stage === "verify") {
  console.log("== t970 failed-face verify ==");
  const job = jobByName();
  ok(!!job, "the failed face exists", job ? job.id : "missing");
  if (!job) process.exit(1);
  ok(job.status === "failed", "the face's status is failed", `status=${job.status}`);

  const log = api("GET", `/api/jobs/${job.id}/log?full=1`);
  const text = typeof log?.tail === "string" ? log.tail : typeof log?.text === "string" ? log.text : "";
  ok(text.length > 0, "the log route still answers", `${text.length}B`);
  ok((text.match(/\bKilled\b/g) ?? []).length >= 1, "the oom-kill signature survives");

  // the whole teaser chain on the LIVE routes: the tail route (600 lines)
  // must carry the signatures too — the Log console's strip counts the
  // tail window, the teaser counts the full log; both must speak.
  const tail = api("GET", `/api/jobs/${job.id}/log`);
  const tailText = typeof tail?.tail === "string" ? tail.tail : "";
  ok(tailText.length > 0, "the tail route answers (the Log tab's window)", `${tailText.length}B`);

  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ remove */
if (stage === "remove") {
  console.log("== t970 failed-face remove ==");
  const job = jobByName();
  if (job) {
    const del = api("DELETE", `/api/jobs/${job.id}`);
    console.log(`job removed: ${job.id} (${JSON.stringify(del).slice(0, 120)})`);
  } else {
    console.log("(no failed face — nothing to remove)");
  }
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    const runs = JSON.parse(raw);
    if (job?.id && runs[job?.id]) {
      delete runs[job.id];
      const tmp = `${STATE_FILE}.t970.tmp`;
      writeFileSync(tmp, JSON.stringify(runs, null, 2));
      execSync(`mv "${tmp}" "${STATE_FILE}"`);
      console.log(`  run record removed: ${job.id}`);
    }
  } catch { /* state file untouched — fine */ }
  if (job?.id) {
    const wd = workdirOf(job.id);
    if (existsSync(wd)) {
      rmSync(wd, { recursive: true, force: true });
      console.log(`  workdir removed: ${path.basename(wd)}`);
    }
  }
  console.log("== remove done ==");
  process.exit(0);
}

console.log("usage: node scripts/t970-failed-face-mint.mjs mint|verify|remove");
process.exit(1);

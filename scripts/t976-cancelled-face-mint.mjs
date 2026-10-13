#!/usr/bin/env node
/**
 * t976 — the CANCELLED DIAGNOSIS FACE: the world's EIGHTH job, minted
 * honest so the Task 121 negative teaser keeps a face after the t976
 * walltime flip. The t972 face WAS the negative teaser's witness — but
 * its log carried SLURM's own "DUE TO TIME LIMIT", so the t976 ride
 * added the walltime-limit row and the t972 face flipped positive. The
 * negative leg needed a NEW face: a death the log narrates WITHOUT
 * naming a cause.
 *
 * The face's story: an operator scancel (the queue admin's nightly
 * sweep, a preemption — the log does not say). SLURM records the kill
 * in its own words — "slurmstepd: error: *** JOB 483077 CANCELLED AT
 * … ***" — with NO reason suffix, bash reports the child "Terminated"
 * (NOT "Killed" — that word is the OOM killer's signature and the
 * oom-kill row would steal the face), and RELION — alive the whole
 * time — prints no error at all. The t323 silent-death autopsy must
 * ALSO stay silent: it fires when the log's last three non-empty lines
 * include a live progress frame, so this log ends on three honest
 * non-frame lines (the slurmd SIGTERM notice, the bash Terminated
 * report, the slurmstepd CANCELLED record). Result:
 * diagnoseFailureLog(full run.out) === [] by construction — the
 * negative teaser renders "0 findings", the Log console renders NO
 * strip (the findings.length > 0 gate), and the log itself is the
 * answer (the user reads the CANCELLED line and goes asking the
 * admin). The plain-CANCELLED line deliberately does NOT match the
 * walltime row: "DUE TO TIME LIMIT" is the discriminator between a
 * narrated walltime death (the t972 face, now positive) and an
 * unnamed external cancel (this face, the negative leg's new home).
 *
 * The mint rides the t970/t972 grammar verbatim (API job creation +
 * workdir files + engine-state.json direct write + the t263 row flip),
 * ADDITIVE and removable without touching the seed trio / the door /
 * the bench / the t970 face / the t972 face. Its verify carries an
 * INLINE MIRROR of the signature table (transcribed from
 * src/lib/log-diagnosis.ts, the t976 walltime row included — 16 rows)
 * so the mint proves the zero-match property at the API tier; the UI
 * walk (scripts/t976-walltime-flip-walk.mjs) is the ground truth, and
 * the t970 unit's N-band pins the lib's response to the same story.
 *
 *   node scripts/t976-cancelled-face-mint.mjs mint|verify|remove
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME = "Cancelled Diagnosis Face (t976)";
const PROJECT_ID = process.env.MINT_PROJECT_ID ?? "cmv6ml09e0000kn9mgxrsun5w"; // the standing world (the doctor's ACTIVE)
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");
const RESULT_SENTENCE =
  "the run ended in an external cancellation SLURM recorded without a reason (*** CANCELLED AT … *** — an operator scancel or a preemption; the log names no cause) mid-iteration 4 of 25 — the log carries no failure signature by design (the t976 cancelled diagnosis face)";

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
const workdirOf = (jobId) => path.join(DATA_ROOT, `class3d_${jobId.slice(-8)}`);

/* the cancelled face's run.out — an UNNAMED external cancel, honest
 * RELION class3d chatter the whole way down: header, the reference
 * load, three settled iterations with their class tables and time bars
 * (the worm dialect mid-log is fine — the t323 autopsy only reads the
 * TAIL), iteration 4's start, and then the operator's scancel landing.
 * Every line is checked against the mirror table below; none may
 * match — the CANCELLED line's missing "DUE TO TIME LIMIT" is what
 * keeps the walltime row out of this face. */
const cancelledRunOut = () =>
  [
    "RELION: 3D classification (t976 cancelled diagnosis face)",
    "  command: mpirun -n 2 relion_refine_mpi --i Particles/job014/particles.star --o Class3D/job049 --ref InitialModel/job041/initial_model.mrc --K 4 --tau2_fudge 4 --iter 25 --pad 1 --particle_diameter 180 --angpix 1.24 --healpix 15 --offset_range 5 --offset_step 2",
    "  38,940 particles in the input star · 4 classes · 2 MPI ranks x 3 threads · one GPU device per rank",
    "  symmetry: C1 · reference angular sampling: 15 degrees · queue: gpu-standard",
    "",
    "[2026-10-13 18:22:41.107] MPI rank 000: loading 38,940 particles ... done (66.8 GB resident per rank)",
    "[2026-10-13 18:23:15.662] MPI rank 000: reference initial_model.mrc read (box 200, angpix 1.24) — low-pass filtered to 40 A for the first round",
    "[2026-10-13 18:23:18.030] MPI rank 001: ready — waiting for the first workspace",
    "",
    "[2026-10-13 18:23:18.552] === Iteration 1 of 25 ===",
    "  0.02/0.29 hrs — Expectation step: 38940/38940 particles assigned (100%)",
    "[2026-10-13 18:32:52.377] class distribution: class1 9,553 (24.53%) · class2 9,876 (25.36%) · class3 9,742 (25.02%) · class4 9,769 (25.09%)",
    "[2026-10-13 18:32:59.918] current resolution at gold-standard FSC=0.143: 30.8 A — writing run_it001_data.star + run_it001_model.star",
    "",
    "[2026-10-13 18:33:09.244] === Iteration 2 of 25 ===",
    "  0.29/0.70 hrs — Expectation step: 38940/38940 particles assigned (100%)",
    "[2026-10-13 18:48:03.516] class distribution: class1 10,021 (25.73%) · class2 9,702 (24.92%) · class3 9,884 (25.38%) · class4 9,333 (23.97%)",
    "[2026-10-13 18:48:11.082] current resolution at gold-standard FSC=0.143: 21.9 A",
    "",
    "[2026-10-13 18:48:21.663] === Iteration 3 of 25 ===",
    "  0.70/1.16 hrs — Expectation step: 38940/38940 particles assigned (100%)",
    "[2026-10-13 19:05:44.903] angular sampling raised: 15 -> 7.5 degrees (the auto-refine schedule)",
    "[2026-10-13 19:05:52.712] current resolution at gold-standard FSC=0.143: 14.2 A",
    "",
    "[2026-10-13 19:06:02.188] === Iteration 4 of 25 ===",
    "[2026-10-13 21:57:44.310] MPI rank 000: Expectation step — 38,940 particles across 4 classes (the round sat behind two longer jobs in the queue)",
    "  3.54/3.96 hrs — Maximisation step starting (4 reconstructions, tau_fudge 1.0)",
    "[2026-10-13 21:58:01.556] MPI rank 001: per-class reconstruction workspaces written",
    "slurmd[compute-0-3]: sending SIGTERM to the job's allocation",
    "bash: line 1:  48312 Terminated              mpirun -n 2 relion_refine_mpi --i Particles/job014/particles.star --o Class3D/job049 --ref InitialModel/job041/initial_model.mrc --K 4",
    "slurmstepd: error: *** JOB 483077 CANCELLED AT 2026-10-13T21:58:03 *** on compute-0-3",
    "",
  ].join("\n");

/* ---------------------------------------------------------------
 * the MIRROR TABLE — transcribed from src/lib/log-diagnosis.ts
 * (the 16 signature patterns, t976's walltime row included). The
 * mint proves the zero-match property at the API tier; the UI walk
 * is the ground truth; the t970 unit's N-band pins the lib's
 * response to the same story. If the lib's table grows, THIS
 * mirror must be re-keyed in the same commit — the unit's N10 is
 * the tripwire that catches the desync BEFORE the mint lies.
 * --------------------------------------------------------------- */
const MIRROR_PATTERNS = [
  ["oom-kill", /\bKilled\b|oom-kill(?:er)?\b/i],
  ["gpu-oom", /cuda[\w: ]*(?:error|out of memory)|out of memory|hipError|std::bad_alloc/i],
  ["disk-full", /no space left on device|disk quota exceeded|read-only file system/i],
  ["missing-input", /no such file or directory/i],
  ["permission", /permission denied/i],
  ["segfault", /segmentation fault|\bcore dumped\b/i],
  ["mpi-abort", /MPI_ABORT was invoked/i],
  ["blush-python-failure", /Something went wrong in the external Python call|relion_python_blush/i],
  ["python-traceback", /Traceback \(most recent call last\)/],
  ["autopick-log-gpu", /Laplacian-of-Gaussian picker does not support GPU acceleration/i],
  ["extract-stack-size-clash", /write: target and source objects have different size/i],
  ["readmrc-exceeds-stack", /readMRC: Image number \d+ exceeds stack size \d+/i],
  ["ctffind-no-fit", /failed to estimate CTF parameters for any micrograph|cannot get CTF values for/i],
  ["gpu-free-memory-warning", /Ignoring required free GPU memory amount of \d+ MB/i],
  ["walltime-limit", /\bDUE TO TIME LIMIT\b/i],
  ["gpu-starved-refusal", /CRYOFLOW_ERR: only \d+ MB free on the GPU/i],
];
/* t323's live progress frame — the autopsy fires only if the log's last
 * three non-empty lines include one of these (without " yum!") */
const LIVE_FRAME_RE = /~~\(,_,">|\[oo\]|\/\d+(?:\.\d+)?\/(?:\d+(?:\.\d+)?|\?\?\?)\s*(?:sec|min|hrs)\b/;

const mirrorViolations = (text) => {
  const lines = text.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (const [id, re] of MIRROR_PATTERNS) {
      if (re.test(lines[i])) hits.push(`L${i + 1}:${id}`);
    }
  }
  return hits;
};
const tailHasLiveFrame = (text) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.slice(-3).some((l) => LIVE_FRAME_RE.test(l) && !/yum!/.test(l));
};

/* the run record — the t966/t970 grammar, with the cancelled run's
 * honest fields: done:true, exitCode 143 (128+15, the SIGTERM death),
 * no outputs. readRuns re-parses on the external write. */
const writeRunRecord = (jobId, workdir) => {
  const record = {
    jobId,
    projectId: PROJECT_ID,
    type: "class3d",
    pid: null,
    cmd: "mpirun -n 2 relion_refine_mpi --i Particles/job014/particles.star --o Class3D/job049 --K 4  # t976 cancelled diagnosis face",
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date(Date.now() - 10_020_000).toISOString(),
    outputs: {},
    done: true,
    exitCode: 143,
    result: RESULT_SENTENCE,
  };
  const raw = readFileSync(STATE_FILE, "utf8");
  const runs = JSON.parse(raw);
  runs[jobId] = record;
  const tmp = `${STATE_FILE}.t976.tmp`;
  writeFileSync(tmp, JSON.stringify(runs, null, 2));
  // rename defeats the reader's half-written read (the t963 lesson)
  execSync(`mv "${tmp}" "${STATE_FILE}"`);
  return record;
};

/* the row flip — the t966/t263 grammar: Prisma bindings, the canonical
 * db, status/progress/result in one update. */
const flipRow = (jobId) =>
  spawnSync(
    "node",
    [
      "-e",
      `const { PrismaClient } = require("@prisma/client");
       const db = new PrismaClient();
       db.job.update({
         where: { id: process.argv[1] },
         data: { status: "failed", progress: 16, result: process.env.T976_RESULT },
       }).then(() => db.$disconnect()).catch((e) => { console.error(String(e)); process.exit(1); });`,
      jobId,
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${process.cwd()}/db/cryoflow.db`, T976_RESULT: RESULT_SENTENCE },
      encoding: "utf8",
      timeout: 30_000,
    }
  );

/* ------------------------------------------------------------ shared checks */
const checkLogContract = (jobId) => {
  const full = api("GET", `/api/jobs/${jobId}/log?full=1`);
  const text = typeof full?.tail === "string" ? full.tail : typeof full?.text === "string" ? full.text : "";
  ok(text.length > 1500, "the log route answers the face's full log (non-empty — the t318 law)", `${text.length}B`);
  ok(full?.truncated === false, "the log is under the 8MB cap (truncated false)");

  const violations = mirrorViolations(text);
  ok(violations.length === 0, "ZERO signature matches across the full log (the 16-pattern mirror)", violations.slice(0, 4).join(",") || "clean");
  ok(!tailHasLiveFrame(text), "the tail's last three non-empty lines carry no live frame (the t323 autopsy stays silent)");

  const tail = api("GET", `/api/jobs/${jobId}/log`);
  const tailText = typeof tail?.tail === "string" ? tail.tail : "";
  ok(tailText.length > 0, "the tail route answers (the Log tab's window)", `${tailText.length}B`);
  ok(mirrorViolations(tailText).length === 0, "the tail window is signature-free too (teaser and strip would agree)");
  return text;
};

/* ------------------------------------------------------------ mint */
if (process.argv[2] === "mint") {
  console.log("== t976 cancelled-face mint ==");
  const probe = sh(`curl -s -o /dev/null -w "%{http_code}" ${ORIGIN} "${BASE}/api/jobs" --max-time 8`);
  if (probe !== "200") {
    console.log(`FATAL: the server did not answer 200 (${probe}) — the lane must be alive to mint`);
    process.exit(2);
  }

  let job = jobByName();
  if (job) {
    console.log(`(the cancelled face already exists: ${job.id} — reusing, files re-stamped)`);
  } else {
    // mints pass explicit x/y (the law) — one row below the t972 face
    // (1960,1040); the t970 face sits at (1960,760)
    const made = api("POST", "/api/jobs", { type: "class3d", name: NAME, x: 1960, y: 1320 });
    job = made?.job ?? made;
    if (!job?.id) {
      console.log(`FATAL: job creation refused: ${JSON.stringify(made).slice(0, 300)}`);
      process.exit(2);
    }
    console.log(`job minted: ${job.id}`);
  }

  const workdir = workdirOf(job.id);
  mkdirSync(workdir, { recursive: true });
  writeFileSync(path.join(workdir, "run.out"), cancelledRunOut());
  writeFileSync(path.join(workdir, "run.err"), ""); // stderr silent — the story lives in run.out (the t970 face4 shape)
  writeRunRecord(job.id, workdir);
  console.log(`workdir + cancelled log + run record written: ${workdir}`);

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
  ok(outBytes > 1500 && outBytes < 8 * 1024 * 1024, "the run.out is on disk (non-empty — the t318 law)", `${outBytes}B`);

  checkLogContract(job.id);

  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ verify */
if (process.argv[2] === "verify") {
  console.log("== t976 cancelled-face verify ==");
  const job = jobByName();
  ok(!!job, "the cancelled face exists", job ? job.id : "missing");
  if (!job) process.exit(1);
  ok(job.status === "failed", "the face's status is failed", `status=${job.status}`);
  checkLogContract(job.id);
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ remove */
if (process.argv[2] === "remove") {
  console.log("== t976 cancelled-face remove ==");
  const job = jobByName();
  if (job) {
    const del = api("DELETE", `/api/jobs/${job.id}`);
    console.log(`job removed: ${job.id} (${JSON.stringify(del).slice(0, 120)})`);
  } else {
    console.log("(no cancelled face — nothing to remove)");
  }
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    const runs = JSON.parse(raw);
    if (job?.id && runs[job?.id]) {
      delete runs[job.id];
      const tmp = `${STATE_FILE}.t976.tmp`;
      writeFileSync(tmp, JSON.stringify(runs, null, 2));
      execSync(`mv "${tmp}" "${STATE_FILE}"`);
      console.log("run record removed");
    }
  } catch {}
  if (job?.id) {
    try { rmSync(workdirOf(job.id), { recursive: true, force: true }); console.log("workdir removed"); } catch {}
  }
  console.log("== remove done ==");
  process.exit(0);
}

console.log("usage: node scripts/t976-cancelled-face-mint.mjs mint|verify|remove");
process.exit(2);

#!/usr/bin/env node
/**
 * t995 — THE NEGATIVE TEASER'S RE-HOME MINT: the N19 story made flesh.
 * The t994 flip left the Task 121 negative teaser with NO live face in
 * this world (the t972 walltime face and the t976 cancelled face both
 * flipped positive; the teaser's ZERO contract survived only as the
 * t970 unit's synthetic story N19). This mint re-homes it: a
 * WRAPPER-LEVEL death — the modulefile's RELION build retired by a
 * storage migration, so the node's shell answers "command not found"
 * and the wrapper narrates the 127 exit in its own voice — whose full
 * log matches ZERO signature rows AND ends on no live progress frame,
 * so diagnoseFailureLines answers ZERO end to end and the Overview
 * speaks the zinc negative card again ("no known signature — the cause
 * is custom to this job, the log is the truth").
 *
 * The face's story, honest down every line: preflight checked the
 * modulefile (which answered OK — the MODULE is registered), the
 * launch line assembled, the shell ran — and the binary the modulefile
 * named was not on the node's PATH (the module's install root was
 * retired). bash reports "command not found" (NOT "No such file or
 * directory" — that errno text is the missing-input row and it must
 * NOT match), the step returns 127 in under a second, and the wrapper
 * — CryoFlow's own launcher voice, deliberately NOT the
 * CRYOFLOW_ERR:…-free-GPU dialect (the gpu-starved-refusal row) —
 * closes the log with the exit narration. The tail's last three
 * non-empty lines carry no RELION frame (no worm, no owl, no time
 * bar), so the t323 silent-run-death autopsy stays silent too: the
 * ZERO contract holds at BOTH gates (the table and the autopsy), the
 * exact shape the unit's N19 story pins in-process.
 *
 * The mint rides the t970/t972/t976 grammar verbatim (API job creation
 * + workdir files + engine-state.json direct write + the t263 row
 * flip), ADDITIVE and removable without touching the seed trio / the
 * door / the bench / the earlier faces. Its verify carries the SAME
 * INLINE MIRROR of the signature table (17 rows — the table did NOT
 * grow: this face exercises the ZERO branch, no new row) and asserts
 * the OPPOSITE of its siblings: EXACTLY ZERO matches, the teaser's
 * own contract. The UI walk (scripts/t995-teaser-rehome-walk.mjs) is
 * the ground truth; the t970 unit's N-band pins the lib's response.
 *
 *   node scripts/t995-custom-error-mint.mjs mint|verify|remove
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME = "Custom Error Face (t995)";
// the world's identity is the pointer, not the script's memory — the
// default is the standing world (the doctor's ACTIVE); re-arms pass
// MINT_PROJECT_ID explicitly (the t994 lesson)
const PROJECT_ID = process.env.MINT_PROJECT_ID ?? "cmv79wd4e0000usbucn0sncqa";
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");
const RESULT_SENTENCE =
  "the wrapper died before RELION started — the modulefile named a RELION build the node no longer has (bash answered 'command not found', the step exited 127); the signature table answered ZERO — the teaser's negative leg re-homed (no known signature, the cause is custom to this job, the log is the truth)";

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

/* the custom-error face's run.out — a WRAPPER-LEVEL death, honest
 * RELION-launch chatter down to the shell's own refusal: preflight,
 * staging, the allocation, the assembled launch line, then the binary
 * the modulefile named missing from the node's PATH. Every line is
 * checked against the mirror table below; EXACTLY ZERO may match —
 * the teaser's own contract (the t972/t976 faces carry the ONE-match
 * contract on their rows; this face is the negative leg's home). The
 * missing "No such file or directory" is what keeps the missing-input
 * row out of this face (the errno discriminator's other side), and
 * the wrapper's voice stays clear of the CRYOFLOW_ERR free-GPU
 * dialect so the gpu-starved-refusal row stays out too. */
const customErrorRunOut = () =>
  [
    "CryoFlow wrapper: class3d launch on node compute-0-5 (the t995 custom-error face)",
    "CryoFlow wrapper: staging workdir /scratch/cryoflow/class3d_t995 — 38,940 particles, 4 classes, tau2_fudge 4",
    "CryoFlow wrapper: sbatch answered 483201; the allocation came up on compute-0-5 (1 node, 2 GPU, 8 threads per rank)",
    "CryoFlow wrapper: srun step began at 2026-10-14T09:11:58 — environment: RELION_MODULE=relion/5.0, CUDA_MODULE=cuda/12.4",
    "CryoFlow wrapper: module load relion/5.0 — the modulefile answered OK on the login node's preflight",
    "[2026-10-14 09:12:00.000] wrapper: preflight done — inputs resolved: Particles/job014/particles.star (38,940 rows, optics group 1)",
    "[2026-10-14 09:12:00.412] wrapper: reference InitialModel/job041/initial_model.mrc staged (box 200, angpix 1.24)",
    "[2026-10-14 09:12:00.903] wrapper: launch line assembled — mpirun -n 2 relion_refine_mpi --i Particles/job014/particles.star --o Class3D/job050 --ref InitialModel/job041/initial_model.mrc --K 4 --tau2_fudge 4 --iter 25 --pad 1 --particle_diameter 180 --angpix 1.24 --healpix 15 --offset_range 5 --offset_step 2",
    "[2026-10-14 09:12:01.117] wrapper: the step's stdout/stderr streams opened; the log below is the node's own voice",
    "bash: line 1: relion_refine_mpi: command not found",
    "[2026-10-14 09:12:01.540] wrapper: the step returned exit 127 in 0.4s — the shell never found the binary",
    "CryoFlow wrapper: the job's process exited with code 127 before RELION started (the modulefile's install root was retired in the cluster's storage migration — preflight checked the modulefile, the node's PATH never carried the binary)",
    "CryoFlow wrapper: no RELION output was produced; the wrapper's own narration above is the whole story",
    "",
  ].join("\n");

/* ---------------------------------------------------------------
 * the MIRROR TABLE — transcribed from src/lib/log-diagnosis.ts
 * (the 17 signature patterns; UNCHANGED by this window — the
 * custom-error face exercises the ZERO branch, no new row). The mint
 * proves the ZERO-match property at the API tier; the UI walk is the
 * ground truth; the t970 unit's N-band pins the lib's response to the
 * same story. If the lib's table grows, THIS mirror must be re-keyed
 * in the same commit — the unit's N10c is the tripwire that catches
 * the desync BEFORE the mint lies.
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
  ["scheduler-cancelled", /\*\*\* JOB \d+ CANCELLED AT \S+ \*\*\*/],
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

/* the run record — the t966/t970 grammar, with the wrapper death's
 * honest fields: done:true, exitCode 127 (the shell's own code for a
 * command it could not find — NOT the SIGTERM 143 the t972/t976
 * scheduler deaths carry; the wrapper died before RELION existed to
 * be signalled), no outputs. readRuns re-parses on the external
 * write. */
const writeRunRecord = (jobId, workdir) => {
  const record = {
    jobId,
    projectId: PROJECT_ID,
    type: "class3d",
    pid: null,
    cmd: "mpirun -n 2 relion_refine_mpi --i Particles/job014/particles.star --o Class3D/job050 --K 4  # t995 custom-error face",
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date(Date.now() - 600_000).toISOString(),
    outputs: {},
    done: true,
    exitCode: 127,
    result: RESULT_SENTENCE,
  };
  const raw = readFileSync(STATE_FILE, "utf8");
  const runs = JSON.parse(raw);
  runs[jobId] = record;
  const tmp = `${STATE_FILE}.t995.tmp`;
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
         data: { status: "failed", progress: 4, result: process.env.T995_RESULT },
       }).then(() => db.$disconnect()).catch((e) => { console.error(String(e)); process.exit(1); });`,
      jobId,
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${process.cwd()}/db/cryoflow.db`, T995_RESULT: RESULT_SENTENCE },
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
  ok(violations.length === 0,
    "EXACTLY ZERO signature matches across the full log — the teaser's contract (the 17-pattern mirror; the negative leg re-homed, the cause is custom to this job)",
    violations.join(",") || "clean");
  ok(!tailHasLiveFrame(text), "the tail's last three non-empty lines carry no live frame (the t323 autopsy stays silent — the ZERO contract's second gate)");

  const tail = api("GET", `/api/jobs/${jobId}/log`);
  const tailText = typeof tail?.tail === "string" ? tail.tail : "";
  ok(tailText.length > 0, "the tail route answers (the Log tab's window)", `${tailText.length}B`);
  const tailViolations = mirrorViolations(tailText);
  ok(tailViolations.length === 0,
    "the tail window carries ZERO hits too (teaser and Log tab would agree — no strip by design)",
    tailViolations.join(",") || "clean");
  return text;
};

/* ------------------------------------------------------------ mint */
if (process.argv[2] === "mint") {
  console.log("== t995 custom-error-face mint ==");
  const probe = sh(`curl -s -o /dev/null -w "%{http_code}" ${ORIGIN} "${BASE}/api/jobs" --max-time 8`);
  if (probe !== "200") {
    console.log(`FATAL: the server did not answer 200 (${probe}) — the lane must be alive to mint`);
    process.exit(2);
  }

  let job = jobByName();
  if (job) {
    console.log(`(the custom-error face already exists: ${job.id} — reusing, files re-stamped)`);
  } else {
    // mints pass explicit AND VISIBLE x/y (the law) — one row below the
    // t976 face (1960,1320); the t972 face sits at (1960,1040), the
    // t970 face at (1960,760)
    const made = api("POST", "/api/jobs", { type: "class3d", name: NAME, x: 1960, y: 1600 });
    job = made?.job ?? made;
    if (!job?.id) {
      console.log(`FATAL: job creation refused: ${JSON.stringify(made).slice(0, 300)}`);
      process.exit(2);
    }
    console.log(`job minted: ${job.id}`);
  }

  const workdir = workdirOf(job.id);
  mkdirSync(workdir, { recursive: true });
  writeFileSync(path.join(workdir, "run.out"), customErrorRunOut());
  writeFileSync(path.join(workdir, "run.err"), ""); // stderr silent — the story lives in run.out (the t970 face4 shape)
  writeRunRecord(job.id, workdir);
  console.log(`workdir + custom-error log + run record written: ${workdir}`);

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
  console.log("== t995 custom-error-face verify ==");
  const job = jobByName();
  ok(!!job, "the custom-error face exists", job ? job.id : "missing");
  if (!job) process.exit(1);
  ok(job.status === "failed", "the face's status is failed", `status=${job.status}`);
  checkLogContract(job.id);
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ remove */
if (process.argv[2] === "remove") {
  console.log("== t995 custom-error-face remove ==");
  const job = jobByName();
  if (job) {
    const del = api("DELETE", `/api/jobs/${job.id}`);
    console.log(`job removed: ${job.id} (${JSON.stringify(del).slice(0, 120)})`);
  } else {
    console.log("(no custom-error face — nothing to remove)");
  }
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    const runs = JSON.parse(raw);
    if (job?.id && runs[job?.id]) {
      delete runs[job.id];
      const tmp = `${STATE_FILE}.t995.tmp`;
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

console.log("usage: node scripts/t995-custom-error-mint.mjs mint|verify|remove");
process.exit(2);

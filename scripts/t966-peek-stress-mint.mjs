#!/usr/bin/env node
/**
 * t966 — the PEEK STRESS BENCH: the world's fifth job, minted honest so
 * the Files tab's peek doors (the t779 star/text dialogs) can be ridden
 * at the 320 fold with REAL stress instead of the door-world's short
 * rows. The door-world (t963) keeps its 303-row contract untouched —
 * the bench is additive, a separate workdir, no remote manifest.
 *
 * The bench's four faces (all REAL files on disk, all REAL RELION-ish
 * shapes):
 *   face1  MotionCorr/job002/corrected_micrographs.star — the WIDE star:
 *          12 columns x 48 rows of real rln names; the path is 44 chars
 *          (the t913 before-witness's disease shape: a >36-char mono
 *          token cannot fit the fold dialog's 240px content box).
 *   face2  LogFiles/relion_motioncorr_gpu_pipeline_run.log — the LONG
 *          tail: ~96KB of log lines (> the 64KB tail contract, so the
 *          backend answers the LAST 64KB); the path is 47 chars.
 *   face3  run.out — the small base log (the doors' everyday shape).
 *   face4  run.err — the EMPTY tail (0 bytes): the preview of nothing.
 *
 *   node scripts/t966-peek-stress-mint.mjs mint|verify|remove
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME = "Peek Stress Bench (t966)";
const PROJECT_ID = process.env.MINT_PROJECT_ID ?? "cmv6ml09e0000kn9mgxrsun5w"; // the standing world (the doctor's ACTIVE) — env-overridable so a re-seeded world re-keys without an edit
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const WIDE_STAR_REL = "MotionCorr/job002/corrected_micrographs.star";
const LONG_LOG_REL = "LogFiles/relion_motioncorr_gpu_pipeline_run.log";
const LOG_LINES = 1400;

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

/* the wide star: 12 real rln columns, 48 rows, wide decimals — the table's
 * min-content far exceeds the fold dialog's content box, so the sticky
 * choreography scrolls INSIDE its clipping container (the one-axis law). */
const wideStar = () => {
  const cols = [
    "_rlnImageName",
    "_rlnMicrographName",
    "_rlnDefocusU",
    "_rlnDefocusV",
    "_rlnDefocusAngle",
    "_rlnPhaseShift",
    "_rlnCtfFigureOfMerit",
    "_rlnLogLikeliContribution",
    "_rlnNormCorrection",
    "_rlnClassNumber",
    "_rlnCoordinateX",
    "_rlnCoordinateY",
  ];
  const rows = [];
  for (let i = 1; i <= 48; i++) {
    const mm = String(Math.floor(i / 60) % 60).padStart(2, "0");
    const ss = String(i % 60).padStart(2, "0");
    const idx = String(i).padStart(2, "0");
    rows.push(
      [
        `${String(i).padStart(6, "0")}@micrographs/Falcon_2012_06_12-08_${mm}_${ss}_${idx}.mrc`,
        `micrographs/Falcon_2012_06_12-08_${mm}_${ss}_${idx}.mrc`,
        (15234 + i * 37.418).toFixed(6),
        (15002 + i * 41.117).toFixed(6),
        ((i * 17) % 180).toFixed(2),
        ((i * 7) % 359).toFixed(3),
        (0.32 + (i % 13) * 0.041).toFixed(5),
        (38412.55 + i * 213.884).toFixed(4),
        (0.88 + (i % 9) * 0.013).toFixed(4),
        String((i % 4) + 1),
        (1024 + i * 11.5).toFixed(1),
        (2048 - i * 9.25).toFixed(1),
      ].join("  ")
    );
  }
  return ["data_", "", "loop_", ...cols.map((c, i) => `${c} #${i + 1}`), ...rows, ""].join("\n");
};

/* the long tail: ~700 realistic RELION log lines (~96KB) — the backend's
 * 64KB tail contract answers the LAST chunk; the tail's first visible
 * line is a marker so the ride can read which part landed. */
const longLog = () => {
  const lines = [];
  for (let i = 1; i <= LOG_LINES; i++) {
    if (i % 50 === 0) {
      lines.push(
        `[2025-12-06 ${String(8 + Math.floor(i / 360)).padStart(2, "0")}:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.441] INFO  motioncorr: processed ${i * 3} micrographs — dose-weighted, gpu ${i % 6}, average gain refined to ${(0.991 + (i % 7) * 0.0011).toFixed(4)}`
      );
    } else if (i % 17 === 0) {
      lines.push(`[frame ${String(i).padStart(4, "0")}] WARN  drift above threshold on micrograph batch ${Math.floor(i / 17)} — motion model re-fit (b-factor ${(180 + (i % 11) * 13).toFixed(1)})`);
    } else {
      lines.push(`[frame ${String(i).padStart(4, "0")}] debug alignment window 384x384, patch 5x5, bore ${(7.2 + (i % 5) * 0.3).toFixed(2)} A/frame`);
    }
  }
  lines.push(`[2025-12-06 11:59:59.999] INFO  motioncorr: the tail ends here — last line ${LOG_LINES} of ${LOG_LINES}`);
  lines.push("done.");
  lines.push("");
  return lines.join("\n");
};

const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");

const writeRunRecord = (jobId, workdir) => {
  const record = {
    jobId,
    projectId: PROJECT_ID,
    type: "motioncorr",
    pid: null,
    cmd: "relion_motioncorr --i Movies/*.motiontrk --o . --j 6  # t966 peek-stress bench",
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date(Date.now() - 1823_000).toISOString(),
    outputs: {},
    done: true,
    exitCode: 0,
    result: RESULT_SENTENCE,
  };
  const raw = readFileSync(STATE_FILE, "utf8");
  const runs = JSON.parse(raw);
  runs[jobId] = record;
  const tmp = `${STATE_FILE}.t966.tmp`;
  writeFileSync(tmp, JSON.stringify(runs, null, 2));
  // rename defeats the reader's half-written read (the t963 lesson)
  execSync(`mv "${tmp}" "${STATE_FILE}"`);
  return record;
};

const RESULT_SENTENCE =
  "RELION motioncorr finished (the t966 peek-stress bench): 2100 micrographs motion corrected — the workdir carries a wide STAR table and a long pipeline log so the Files tab's peek doors have real stress to ride at the fold";

/* -------------------------------------------------------------- mint */
const stage = process.argv[2] ?? "mint";

if (stage === "mint") {
  console.log("== t966 peek-stress mint ==");
  const probe = sh(`curl -s -o /dev/null -w "%{http_code}" ${ORIGIN} "${BASE}/api/jobs" --max-time 8`);
  if (probe !== "200") {
    console.log(`FATAL: the server did not answer 200 (${probe}) — the lane must be alive to mint`);
    process.exit(2);
  }

  let job = jobByName();
  if (job) {
    console.log(`(the bench job already exists: ${job.id} — reusing, files re-stamped)`);
  } else {
    const made = api("POST", "/api/jobs", { type: "motioncorr", name: NAME, x: 1960, y: 480 });
    job = made?.job ?? made;
    if (!job?.id) {
      console.log(`FATAL: job creation refused: ${JSON.stringify(made).slice(0, 300)}`);
      process.exit(2);
    }
    console.log(`job minted: ${job.id}`);
  }

  const workdir = workdirOf(job.id);
  mkdirSync(path.join(workdir, "MotionCorr", "job002"), { recursive: true });
  mkdirSync(path.join(workdir, "LogFiles"), { recursive: true });
  writeFileSync(path.join(workdir, WIDE_STAR_REL), wideStar());
  writeFileSync(path.join(workdir, LONG_LOG_REL), longLog());
  writeFileSync(
    path.join(workdir, "run.out"),
    [
      "RELION motioncorr (t966 peek-stress bench)",
      "  the bench's small base log — the doors' everyday shape.",
      "done.",
      "",
    ].join("\n")
  );
  writeFileSync(path.join(workdir, "run.err"), "");
  writeRunRecord(job.id, workdir);
  console.log(`workdir + stress files + run record written: ${workdir}`);

  // the face: completed + progress 100 + the result sentence (the t963
  // row-flip grammar verbatim — the orphan heal ignores completed rows)
  const flip = spawnSync(
    "node",
    [
      "-e",
      `const { PrismaClient } = require("@prisma/client");
       const db = new PrismaClient();
       db.job.update({
         where: { id: process.argv[1] },
         data: { status: "completed", progress: 100, result: process.env.T966_RESULT },
       }).then(() => db.$disconnect()).catch((e) => { console.error(String(e)); process.exit(1); });`,
      job.id,
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${process.cwd()}/db/cryoflow.db`, T966_RESULT: RESULT_SENTENCE },
      encoding: "utf8",
      timeout: 30_000,
    }
  );
  if (flip.status !== 0) {
    console.log(`FATAL: the row flip failed: ${(flip.stderr ?? "").slice(0, 300)}`);
    process.exit(2);
  }

  let status = "";
  for (let i = 0; i < 10; i++) {
    status = jobByName()?.status ?? "";
    if (status === "completed") break;
    execSync("sleep 1");
  }
  ok(status === "completed", "the bench's face is COMPLETED (the minted row-flip)", `status=${status}`);

  const starBytes = existsSync(path.join(workdir, WIDE_STAR_REL))
    ? readFileSync(path.join(workdir, WIDE_STAR_REL)).length
    : 0;
  const logBytes = existsSync(path.join(workdir, LONG_LOG_REL))
    ? readFileSync(path.join(workdir, LONG_LOG_REL)).length
    : 0;
  ok(starBytes > 8000 && starBytes < 2 * 1024 * 1024, "the wide star is on disk (12 cols x 48 rows)", `${starBytes}B`);
  ok(logBytes > 90 * 1024, "the long log is on disk (beyond the 64KB tail contract)", `${logBytes}B`);
  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ verify */
if (stage === "verify") {
  console.log("== t966 peek-stress verify ==");
  const job = jobByName();
  ok(!!job, "the bench job exists", job ? job.id : "missing");
  if (!job) process.exit(1);

  const outs = api("GET", `/api/jobs/${job.id}/outputs`);
  const files = Array.isArray(outs?.files) ? outs.files : [];
  const byPath = (p) => files.find((f) => f.path === p);
  const star = byPath(WIDE_STAR_REL);
  const log = byPath(LONG_LOG_REL);
  const runOut = byPath("run.out");
  const runErr = byPath("run.err");
  ok(files.length === 4, "the bench lists exactly its four faces (no remote manifest)", `got ${files.length}`);
  ok(star?.kind === "star" && star?.rows === 48, "the wide star is a star row with 48 rows", star ? `rows=${star.rows}` : "missing");
  ok(log?.kind === "text", "the long log is a text row", log ? `size=${log.size}` : "missing");
  ok(runOut?.kind === "text" && runErr?.kind === "text", "run.out and run.err are text rows", "base + empty");

  // the tail contract on the LIVE route: the answer is the LAST 64KB
  const tail = api("GET", `/api/jobs/${job.id}/outputs/file?path=${encodeURIComponent(LONG_LOG_REL)}&format=text`);
  const tailText = typeof tail === "string" ? tail : tail.raw ?? "";
  ok(
    typeof tailText === "string" && tailText.length > 60 * 1024 && tailText.length <= 66 * 1024,
    "the tail contract answers the LAST ~64KB of the long log",
    typeof tailText === "string" ? `${tailText.length}B` : "no string"
  );
  ok(
    typeof tailText === "string" && tailText.includes(`last line ${LOG_LINES} of ${LOG_LINES}`),
    "the tail carries the log's final marker (the LAST chunk, not the head)"
  );

  // the star route on the LIVE route: 12 columns, 48 rows
  const starResp = api("GET", `/api/jobs/${job.id}/outputs/star?path=${encodeURIComponent(WIDE_STAR_REL)}&rows=100`);
  ok(
    Array.isArray(starResp?.columns) && starResp.columns.length === 12,
    "the star route answers 12 columns",
    starResp?.columns ? `got ${starResp.columns.length}` : "no columns"
  );
  ok(
    Array.isArray(starResp?.rows) && starResp.rows.length === 48,
    "the star route answers 48 rows",
    starResp?.rows ? `got ${starResp.rows.length}` : "no rows"
  );
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ remove */
if (stage === "remove") {
  console.log("== t966 peek-stress remove ==");
  const job = jobByName();
  if (job) {
    const del = api("DELETE", `/api/jobs/${job.id}`);
    console.log(`job removed: ${job.id} (${JSON.stringify(del).slice(0, 120)})`);
  } else {
    console.log("(no bench job — nothing to remove)");
  }
  const dirPrefix = `motioncorr_`;
  if (existsSync(DATA_ROOT)) {
    for (const dir of existsSync(DATA_ROOT) ? execSync(`ls ${DATA_ROOT}`, { encoding: "utf8" }).trim().split("\n") : []) {
      if (dir.startsWith(dirPrefix) && dir !== `motioncorr_${NAME}`) {
        const wd = path.join(DATA_ROOT, dir);
        // only remove dirs that carry the bench's LogFiles signature
        if (existsSync(path.join(wd, "LogFiles")) && !existsSync(path.join(wd, ".cf-remote-manifest.json"))) {
          rmSync(wd, { recursive: true, force: true });
          console.log(`  workdir removed: ${dir}`);
        }
      }
    }
  }
  console.log("== remove done ==");
  process.exit(0);
}

console.log("usage: node scripts/t966-peek-stress-mint.mjs mint|verify|remove");
process.exit(1);

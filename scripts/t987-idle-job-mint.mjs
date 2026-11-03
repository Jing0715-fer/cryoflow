#!/usr/bin/env node
/**
 * t987 — the IDLE-JOB MINT: the world's SEVENTEENTH job, minted honest so
 * the idle plane — the plane every one of the standing sixteen has grown
 * out of and none of them can show — gets its first measured ride.
 *
 * WHY AN IDLE JOB (the t986 entry's carried candidate ③): the standing
 * world is 15 completed + 1 failed. Every lifecycle face that speaks
 * BEFORE a job's first run is dead in that world:
 *   · the Run button's first-run face — "Run", straight through, no
 *     confirm-rerun dialog (completed/failed jobs say "Re-run" and gate
 *     the click behind the wipe warning);
 *   · the pending face, the running face (Reset-to-idle disabled under
 *     the pointer), the completed-then-reset return;
 *   · the job-panel Reset flip (A42) exercised on a job whose params are
 *     still the MINT defaults — the shape a real user first meets;
 *   · the path-browser family (A43–A45) opened from an idle job's io tab
 *     — the dialog's roots view is the FIRST plane an idle job sees.
 *
 * The mint is ADDITIVE (the t970/t966 grammar verbatim): one separate job
 * at explicit VISIBLE coordinates (the bench column, below the t970 face),
 * default status idle, params {}, no workdir, no run record, no engine
 * state — the lifecycle walk's own Run click is what creates those, and
 * the remove verb sweeps whatever the walk left behind.
 *
 *   node scripts/t987-idle-job-mint.mjs mint|verify|remove
 *
 * The type is IMPORT (not motioncorr): the idle plane's ride needs the
 * job whose params tab carries a CATALOG path param — the pth() row with
 * its Browse door (A43-A45's host). The option-table merge
 * (applyRelionParamTable) keeps the catalog's pth() params, and the
 * import is the type whose micrographsPath rides empty on a fresh face —
 * so the path-browser opens ON THE ROOTS VIEW, the A45 plane, with no
 * navigation needed first.
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME = "Idle Shape Face (t987)";
const PROJECT_ID = process.env.MINT_PROJECT_ID ?? "cmv79wd4e0000usbucn0sncqa"; // the standing world (the doctor's ACTIVE)
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");
// the bench column, below the t970 face (1960, 760) — explicit AND VISIBLE
const MINT_X = 1960;
const MINT_Y = 880;

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
const workdirOf = (jobId) => path.join(DATA_ROOT, `import_${jobId.slice(-8)}`);

/* ------------------------------------------------------------ mint */
const stage = process.argv[2] ?? "mint";

if (stage === "mint") {
  console.log("== t987 idle-job mint ==");
  const probe = sh(`curl -s -o /dev/null -w "%{http_code}" ${ORIGIN} "${BASE}/api/jobs" --max-time 8`);
  if (probe !== "200") {
    console.log(`FATAL: the server did not answer 200 (${probe}) — the lane must be alive to mint`);
    process.exit(2);
  }

  let job = jobByName();
  if (job) {
    console.log(`(the idle face already exists: ${job.id} — reusing)`);
  } else {
    // mints pass explicit x/y (the law) — the bench's column, below the
    // t970 face; the default status IS idle (the schema's own default)
    const made = api("POST", "/api/jobs", { type: "import", name: NAME, x: MINT_X, y: MINT_Y });
    job = made?.job ?? made;
    if (!job?.id) {
      console.log(`FATAL: job creation refused: ${JSON.stringify(made).slice(0, 300)}`);
      process.exit(2);
    }
    console.log(`job minted: ${job.id}`);
  }

  // the face's honest shape: idle, never ran, nothing to answer for
  // (there is no GET /api/jobs/[id] — the LIST route is the single truth)
  const j = jobByName();
  ok(j?.status === "idle", "the face's row is IDLE (the schema's own default)", `status=${j?.status}`);
  ok(j?.ranParams == null, "ranParams is null (no run ever refreshed the recipe)", `ranParams=${JSON.stringify(j?.ranParams)}`);
  ok(j?.result == null, "result is null (an idle job has no result for a recipe to answer for)", `result=${JSON.stringify(j?.result)}`);
  ok(Math.round(j?.x ?? -1) === MINT_X && Math.round(j?.y ?? -1) === MINT_Y, "the face sits at its explicit visible coordinates", `x=${j?.x} y=${j?.y}`);
  const body = api("GET", "/api/jobs");
  const arr = Array.isArray(body) ? body : body.jobs ?? [];
  ok(arr.length === 16, "the world now carries SIXTEEN jobs (the t1075 replant re-key — the t979 world's steady census: 3 starter + nine standing faces + the t978 rider world of four; the t1003 22-world's db died in the epoch rollback and the t979 replant is the successor)", `rows=${arr.length}`);
  ok(!existsSync(workdirOf(job.id)), "no workdir yet (the walk's own Run click creates it)", workdirOf(job.id));

  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ verify */
if (stage === "verify") {
  console.log("== t987 idle-job verify ==");
  const job = jobByName();
  ok(!!job, "the idle face exists", job ? job.id : "missing");
  if (!job) process.exit(1);
  ok(job.status === "idle", "the face's status is idle", `status=${job.status}`);
  ok(job.ranParams == null && job.result == null, "no run evidence (ranParams + result both null)");
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ remove */
if (stage === "remove") {
  console.log("== t987 idle-job remove ==");
  const job = jobByName();
  if (job) {
    const del = api("DELETE", `/api/jobs/${job.id}`);
    console.log(`job removed: ${job.id} (${JSON.stringify(del).slice(0, 120)})`);
  } else {
    console.log("(no idle face — nothing to remove)");
  }
  // sweep whatever the lifecycle walk left: the run record + the workdir
  try {
    const fs = await import("node:fs");
    if (job?.id) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const runs = JSON.parse(raw);
      if (runs[job.id]) {
        delete runs[job.id];
        const tmp = `${STATE_FILE}.t987.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(runs, null, 2));
        execSync(`mv "${tmp}" "${STATE_FILE}"`);
        console.log(`  run record removed: ${job.id}`);
      }
      const wd = workdirOf(job.id);
      if (existsSync(wd)) {
        rmSync(wd, { recursive: true, force: true });
        console.log(`  workdir removed: ${path.basename(wd)}`);
      }
    }
  } catch { /* state file untouched — fine */ }
  console.log("== remove done ==");
  process.exit(0);
}

console.log("usage: node scripts/t987-idle-job-mint.mjs mint|verify|remove");
process.exit(1);

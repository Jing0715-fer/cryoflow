#!/usr/bin/env node
/**
 * t988 — the CONTINUE-FACE MINT: the world's EIGHTEENTH job, minted honest
 * so the A44 witness carries (the t987 entry's recorded-not-faked ①): the
 * "Use this path" refusal lives in the path-browser's singleFile branch,
 * and its only host is the continue-picker's Browse — the "Browse for an
 * optimiser.star" icon-button on the ContinueField row. No idle job in
 * the standing world carried a continue field (the completed jobs jump to
 * the inspector) — this mint adds one: a REFINED-class face (type
 * refine3d, whose merged spec carries fn_cont) sitting at IDLE, so the
 * edit panel hosts the picker and the browser's singleFile plane opens.
 *
 * The face also carries the t397 label dialect's own ride: with fn_cont
 * empty the Run button says "Run"; with a continue target it says
 * "Continue" — the label plane the standing sixteen cannot show.
 *
 * The mint is ADDITIVE (the t970/t987 grammar): one separate job at
 * explicit VISIBLE coordinates (the bench column, below the t987 face),
 * default status idle, params {}, no workdir, no run record — the walk's
 * own gestures (the A44 pick, the row-flip lifecycle) create whatever
 * they need, and the remove verb sweeps the leavings.
 *
 *   node scripts/t988-continue-face-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME = "Continue Face (t988)";
const PROJECT_ID = process.env.MINT_PROJECT_ID ?? "cmv79wd4e0000usbucn0sncqa"; // the standing world (the doctor's ACTIVE)
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");
// the bench column, below the t987 face (1960, 880) — explicit AND VISIBLE
const MINT_X = 1960;
const MINT_Y = 1000;

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
const workdirOf = (jobId) => path.join(DATA_ROOT, `refine3d_${jobId.slice(-8)}`);

/* ------------------------------------------------------------ mint */
const stage = process.argv[2] ?? "mint";

if (stage === "mint") {
  console.log("== t988 continue-face mint ==");
  const probe = sh(`curl -s -o /dev/null -w "%{http_code}" ${ORIGIN} "${BASE}/api/jobs" --max-time 8`);
  if (probe !== "200") {
    console.log(`FATAL: the server did not answer 200 (${probe}) — the lane must be alive to mint`);
    process.exit(2);
  }

  let job = jobByName();
  if (job) {
    console.log(`(the continue face already exists: ${job.id} — reusing)`);
  } else {
    // mints pass explicit x/y (the law) — the bench's column, below the t987 face
    const made = api("POST", "/api/jobs", { type: "refine3d", name: NAME, x: MINT_X, y: MINT_Y });
    job = made?.job ?? made;
    if (!job?.id) {
      console.log(`FATAL: job creation refused: ${JSON.stringify(made).slice(0, 300)}`);
      process.exit(2);
    }
    console.log(`job minted: ${job.id}`);
  }

  // the face's honest shape: idle, never ran, no continue target
  // (there is no GET /api/jobs/[id] — the LIST route is the single truth)
  const j = jobByName();
  ok(j?.status === "idle", "the face's row is IDLE (the schema's own default)", `status=${j?.status}`);
  ok(j?.ranParams == null, "ranParams is null (no run ever refreshed the recipe)", `ranParams=${JSON.stringify(j?.ranParams)}`);
  ok(j?.result == null, "result is null (an idle job has no result for a recipe to answer for)", `result=${JSON.stringify(j?.result)}`);
  ok(!j?.params?.fn_cont, "fn_cont is empty (no continue target — the label plane rests on \"Run\")", `fn_cont=${JSON.stringify(j?.params?.fn_cont)}`);
  ok(Math.round(j?.x ?? -1) === MINT_X && Math.round(j?.y ?? -1) === MINT_Y, "the face sits at its explicit visible coordinates", `x=${j?.x} y=${j?.y}`);
  const body = api("GET", "/api/jobs");
  const arr = Array.isArray(body) ? body : body.jobs ?? [];
  ok(arr.length === 22, "the world now carries TWENTY-TWO jobs (the t1003 restoration re-key — the fleet restored: 15 demo + seven standing faces)", `rows=${arr.length}`);
  ok(!existsSync(workdirOf(job.id)), "no workdir yet (the walk's own gestures create what they need)", workdirOf(job.id));

  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ verify */
if (stage === "verify") {
  console.log("== t988 continue-face verify ==");
  const job = jobByName();
  ok(!!job, "the continue face exists", job ? job.id : "missing");
  if (!job) process.exit(1);
  ok(job.status === "idle", "the face's status is idle", `status=${job.status}`);
  ok(job.ranParams == null && job.result == null, "no run evidence (ranParams + result both null)");
  ok(!job.params?.fn_cont, "fn_cont is empty (the label plane rests on \"Run\")");
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ remove */
if (stage === "remove") {
  console.log("== t988 continue-face remove ==");
  const job = jobByName();
  if (job) {
    const del = api("DELETE", `/api/jobs/${job.id}`);
    console.log(`job removed: ${job.id} (${JSON.stringify(del).slice(0, 120)})`);
  } else {
    console.log("(no continue face — nothing to remove)");
  }
  // sweep whatever the walk left: the run record + the workdir
  try {
    const fs = await import("node:fs");
    if (job?.id) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const runs = JSON.parse(raw);
      if (runs[job.id]) {
        delete runs[job.id];
        const tmp = `${STATE_FILE}.t988.tmp`;
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

console.log("usage: node scripts/t988-continue-face-mint.mjs mint|verify|remove");
process.exit(1);

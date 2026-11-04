#!/usr/bin/env node
/**
 * t989 — the ROUNDS-FACE MINT: the world's NINETEENTH job, minted honest
 * so the continue-picker's ROUND POPOVER face finally gets its live read
 * (the t988 entry's recorded-not-faked ①): the popover's faces — the
 * never-ran refusal, the no-checkpoints empty face, the upstream settled
 * read (a REMOTE lane's cluster rounds over SSH), the incomplete-round
 * disabled refusal, the pick click, the Start-fresh door — all live on
 * ONE idle refine3d-class face hosting the ContinueField row.
 *
 * The t988 continue face stays pristine: this mint adds its OWN face
 * ("Rounds Face (t989)", the bench column below it) and the walk's own
 * gestures (the class2d upstream edge, the run record, the crafted
 * rounds, the workdir) create whatever the faces need — the remove verb
 * sweeps the leavings, the walk itself deletes the edge.
 *
 * The mint is ADDITIVE (the t970/t987/t988 grammar): one separate job at
 * explicit VISIBLE coordinates (the bench column, below the t988 face),
 * default status idle, params {}, no workdir, no run record.
 *
 *   node scripts/t989-rounds-face-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME = "Rounds Face (t989)";
const PROJECT_ID = process.env.MINT_PROJECT_ID ?? "cmv79wd4e0000usbucn0sncqa"; // the standing world (the doctor's ACTIVE)
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");
// the bench column, below the t988 face (1960, 1000) — explicit AND VISIBLE
const MINT_X = 1960;
const MINT_Y = 1120;

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
const jobsArr = () => {
  const body = api("GET", "/api/jobs");
  return Array.isArray(body) ? body : body.jobs ?? [];
};
const jobByName = () => jobsArr().find((j) => j.name === NAME) ?? null;
const workdirOf = (jobId) => path.join(DATA_ROOT, `refine3d_${jobId.slice(-8)}`);

/* ------------------------------------------------------------ mint */
const stage = process.argv[2] ?? "mint";

if (stage === "mint") {
  console.log("== t989 rounds-face mint ==");
  const probe = sh(`curl -s -o /dev/null -w "%{http_code}" ${ORIGIN} "${BASE}/api/jobs" --max-time 8`);
  if (probe !== "200") {
    console.log(`FATAL: the server did not answer 200 (${probe}) — the lane must be alive to mint`);
    process.exit(2);
  }

  let job = jobByName();
  if (job) {
    console.log(`(the rounds face already exists: ${job.id} — reusing)`);
  } else {
    // mints pass explicit x/y (the law) — the bench's column, below the t988 face
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
  ok(j?.type === "refine3d", "the face's type is refine3d (the merged spec carries fn_cont)", `type=${j?.type}`);
  ok(Math.round(j?.x ?? -1) === MINT_X && Math.round(j?.y ?? -1) === MINT_Y, "the face sits at its explicit visible coordinates", `x=${j?.x} y=${j?.y}`);
  const arr = jobsArr();
  ok(arr.length === 16, "the world now carries SIXTEEN jobs (the t1075 replant re-key — the t979 world's steady census: 3 starter + nine standing faces + the t978 rider world of four; the t1003 22-world's db died in the epoch rollback and the t979 replant is the successor)", `rows=${arr.length}`);
  ok(!existsSync(workdirOf(job.id)), "no workdir yet (the walk's own gestures create what they need)", workdirOf(job.id));

  // the picker's refusal face answers the API lane BEFORE any browser ride
  const src = api("GET", `/api/jobs/${job.id}/continue-sources`);
  const self = Array.isArray(src?.sources) ? src.sources.find((s) => s.relation === "self") : null;
  ok(self?.error === "has never run — no checkpoints exist yet", "the picker's API lane speaks the never-ran refusal", `error=${JSON.stringify(self?.error)}`);

  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ verify */
if (stage === "verify") {
  console.log("== t989 rounds-face verify ==");
  const job = jobByName();
  ok(!!job, "the rounds face exists", job ? job.id : "missing");
  if (!job) process.exit(1);
  ok(job.status === "idle", "the face's status is idle", `status=${job.status}`);
  ok(job.ranParams == null && job.result == null, "no run evidence (ranParams + result both null)");
  ok(!job.params?.fn_cont, "fn_cont is empty (the label plane rests on \"Run\")");
  ok(job.type === "refine3d", "the face's type is refine3d");
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------ remove */
if (stage === "remove") {
  console.log("== t989 rounds-face remove ==");
  const job = jobByName();
  if (job) {
    // the walk deletes its own edge; the remove sweeps any survivor edge
    // touching the face (both directions), then the job row itself
    try {
      const edges = api("GET", "/api/edges");
      const list = Array.isArray(edges) ? edges : edges.edges ?? [];
      for (const e of list) {
        if (e.fromJobId === job.id || e.toJobId === job.id) {
          api("DELETE", `/api/edges/${e.id}`);
          console.log(`  edge removed: ${e.id}`);
        }
      }
    } catch { /* edges route untouched — fine */ }
    const del = api("DELETE", `/api/jobs/${job.id}`);
    console.log(`job removed: ${job.id} (${JSON.stringify(del).slice(0, 120)})`);
  } else {
    console.log("(no rounds face — nothing to remove)");
  }
  // sweep whatever the walk left: the run record + the workdir (the
  // crafted rounds die with it)
  try {
    const fs = await import("node:fs");
    if (job?.id) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const runs = JSON.parse(raw);
      if (runs[job.id]) {
        delete runs[job.id];
        const tmp = `${STATE_FILE}.t989.tmp`;
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

console.log("usage: node scripts/t989-rounds-face-mint.mjs mint|verify|remove");
process.exit(1);

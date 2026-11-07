#!/usr/bin/env node
/**
 * t1081 — THE INTERRUPT DOOR WALK: a live native run whose pid dies through
 * a keeper recycle, filmed through the product's own doors (the t1079/t1080
 * staging's lead candidate, finally ridden).
 *
 * THE CONTRACT UNDER CAMERA (src/lib/relion/engine.ts):
 *   · the sweep — a running row whose RunRecord holds done===false with no
 *     exit handler (the server died mid-run) goes, per type:
 *       - ORPHAN_COMPLETABLE (ctffind/motioncorr/extract/autopick/refine3d)
 *         with the atomic outputs LANDED by the orphaned child →
 *         "orphaned-but-finished": the record finalizes completed, the DB
 *         row flips completed (the heal face);
 *       - everything else (class2d/class3d stay excluded — their
 *         per-iteration semantics) → status failed + interruptedResult:
 *         "interrupted (exit unknown) — re-run" + the stderr tail + the
 *         command + the logs paths (the interrupt face);
 *   · the resume — a re-run of the interrupted job computes `interrupted`
 *     from the record (done===false), finds resumableOptimiser's newest
 *     complete run_itNNN_optimiser.star and continues from it WITHOUT
 *     upstream re-validation (the checkpoint contract's face).
 *
 * THE FUEL (the walk's own lesson, first ride): the native lane honestly
 * refuses cluster-absolute rows ("8 of 8 rows live on the CLUSTER — they
 * are not on this machine" — the zero-upload semantics speaking), so the
 * fuel import reads the REAL EMPIAR-10017 mirror's LOCAL paths
 * (/home/z/empiar-10017/micrographs — the t527 identity-law asset). The
 * class2d's resolver accepts import as a particles producer outright
 * (engine.ts:1682 — from: ["import", "extract", …]) — the walk rides the
 * product's own wiring table, no fixture surgery anywhere. The binaries
 * are the mock-cluster's own stand-ins run NATIVELY (RELION_HOME rides the
 * guarded tree — dance-scoped, the operator's explicit choice;
 * detectRelion answers found/RELION_HOME and the walk asserts that before
 * anything mints).
 *
 * THE PHASES (--upto N):
 *   1  mint the walk project + a NATIVE import (local mirror) + a NATIVE
 *      ctffind, kill the SERVER mid-run — the orphaned ctffind finishes,
 *      the new server's sweep heals it (orphaned-but-finished, completed).
 *   2  mint a native class2d (the interrupt target — excluded from the
 *      heal set on purpose), let it land 2+ checkpoints, kill the server
 *      AND the wrapper — the sweep speaks the interrupt face. LEAVES the
 *      face on the canvas for the camera (agent-browser films it before
 *      phase 3 runs).
 *   3  re-run the interrupted class2d (local door) — the checkpoint
 *      contract resumes it to completion — then CLEANUP: the walk
 *      project deleted, the workdir trees removed, the runs entries
 *      popped, the pointer returned home (the t1080 pointer restore law,
 *      obeyed by the walk itself).
 *
 * Usage:
 *   node scripts/t1081-interrupt-door-walk.mjs --upto 2   # mint + both faces
 *   node scripts/t1081-interrupt-door-walk.mjs --upto 3   # resume + cleanup
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const uptoIdx = process.argv.indexOf("--upto");
const UPTO = uptoIdx >= 0 ? Number(process.argv[uptoIdx + 1] ?? 3) : 3;
// t1082 — the camera hold: the resume receipt chip (the Log toolbar's new
// face) needs a window BETWEEN Act 3's completion and the cleanup — the hold
// skips the cleanup and writes the walkId to a state file; `--cleanup-only`
// (a later invocation, camera done) reads it and runs the SAME cleanup block
// (the pointer restore law included). No residue by either exit.
const HOLD = process.argv.includes("--hold-after-resume");
const CLEANUP_ONLY = process.argv.includes("--cleanup-only");
const HOLD_FILE = path.join(ROOT, "shots-qa/.t1082-walk-hold.json");
const CONN_ID = "conn-mv6a23lx";
const MIRROR = "/home/z/empiar-10017/micrographs";
const PROJECT_NAME_RE = /^Interrupt Door Walk t1081/;

let pass = 0;
let fail = 0;
const failures = [];
function must(cond, label, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; failures.push(label); console.log(`  ✗ FAIL: ${label}${extra ? ` — ${String(extra).slice(0, 300)}` : ""}`); }
  return !!cond;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url, init) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try { r = await fetch(`${BASE}${url}`, init); } catch { await sleep(2000); continue; }
    const text = await r.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* the html */ }
    return { status: r.status, body, text };
  }
  return { status: 0, body: null, text: "server unreachable after 3 attempts" };
}
const jobsArr = (b) => (Array.isArray(b) ? b : b?.jobs ?? []);

async function waitTerminal(jobId, { timeoutMs = 180_000 } = {}) {
  const seen = [];
  const t0 = Date.now();
  for (;;) {
    const { body } = await api(`/api/jobs?jobId=${jobId}`, { headers: SH });
    const job = jobsArr(body).find((j) => j.id === jobId);
    if (job && !seen.includes(job.status)) { seen.push(job.status); console.log(`      status: ${job.status}`); }
    if (job && (job.status === "completed" || job.status === "failed" || job.status === "idle")) return { job, seen, timeout: false };
    if (Date.now() - t0 > timeoutMs) return { job: job ?? null, seen, timeout: true };
    await sleep(2000);
  }
}

/** wait for the server to come back after the dance's kill — the keeper
 *  reboots it (the env rides the guarded tree); poll with Origin. */
async function waitServer({ timeoutMs = 150_000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const { status } = await api("/api/jobs", { headers: SH });
    if (status === 200) return true;
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(3000);
  }
}

const killServer = () => {
  // the dance's hands: the keeper recycles what we kill — its boot()
  // carries the RELION_HOME env through the guarded tree
  try { execSync('pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null', { shell: "/bin/bash" }); } catch { /* already dead */ }
};

/** the wrapper kill, VERIFIED: the first ride's pkill raced the wrapper's
 *  own next iteration (the verdict's tail grew it[007]→it[010] between
 *  phases — the orphan lived on and the continue-receipt vanished into a
 *  completed fresh run's log). The dance now proves the death: pkill, then
 *  poll pgrep until empty.
 *  t1082 — the SELF-MATCH cure: pgrep/pkill -f match their own execSync
 *  bash wrapper's cmdline (the pattern rides /bin/bash -c verbatim), so
 *  the verify NEVER went empty and the check timed out on every ride
 *  (t1081 named it "the race" — the bracket-class spelling is the honest
 *  fix: `relion_refin[e]` cannot match its own literal text). */
async function killWrapperVerified({ timeoutMs = 20_000 } = {}) {
  try { execSync('pkill -f "bin/relion_refin[e]" 2>/dev/null', { shell: "/bin/bash" }); } catch { /* already dead */ }
  const t0 = Date.now();
  for (;;) {
    let alive = "";
    try { alive = execSync('pgrep -f "bin/relion_refin[e]" 2>/dev/null | head -1', { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { alive = ""; }
    if (!alive) return true;
    if (Date.now() - t0 > timeoutMs) return false;
    try { execSync('pkill -9 -f "bin/relion_refin[e]" 2>/dev/null', { shell: "/bin/bash" }); } catch { /* raced */ }
    await sleep(1000);
  }
}

/** the shared cleanup — the walk's own exit AND the --cleanup-only rider
 *  both land here (one body, no drift). */
async function cleanupWalk(walkId, entryActive) {
  console.log("\n━━━ cleanup — the walk leaves no residue ━━━");
  const del = await api(`/api/projects/${walkId}`, { method: "DELETE", headers: SHJ });
  must(del.status < 300, "the walk project deletes (the jobs cascade)");
  try { rmSync(path.join(ROOT, "data/relion", walkId), { recursive: true, force: true }); } catch { /* gone */ }
  try { rmSync(path.join(ROOT, "services/mock-cluster/fs/projects/cryoflow", walkId), { recursive: true, force: true }); } catch { /* gone */ }
  try { rmSync("/tmp/t1081-walk-fuel", { recursive: true, force: true }); } catch { /* gone */ }
  // pop the walk's runs entries (the qa60 take-home pattern)
  try {
    const statePath = path.join(ROOT, "data/engine-state.json");
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      const bag = state.jobs ?? state;
      let popped = 0;
      for (const k of Object.keys(bag)) {
        const rec = bag[k];
        if (rec?.projectId === walkId || k.includes(walkId)) { delete bag[k]; popped++; }
      }
      if (popped > 0) writeFileSync(statePath, JSON.stringify(state, null, 2));
      console.log(`    runs entries popped: ${popped}`);
    }
  } catch (e) { console.log(`    runs pop warn: ${String(e).slice(0, 120)}`); }
  // the pointer's home: the hold left the WALK project active, so the
  // rider derives the home as the one project that is NOT the walk (the
  // standing world is single-project); an explicit --home overrides.
  let home = entryActive;
  const homeIdx = process.argv.indexOf("--home");
  if (homeIdx >= 0) home = process.argv[homeIdx + 1] ?? null;
  if (!home) {
    const list = await api("/api/projects", { headers: SH });
    home = list.body?.projects?.find?.((p) => p.id !== walkId)?.id ?? null;
  }
  if (home && home !== walkId) {
    const back = await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: home }) });
    must(back.status < 300, "the pointer returns home (the t1080 law, obeyed)");
  }
  try { rmSync(HOLD_FILE, { force: true }); } catch { /* gone */ }
}

async function main() {
  console.log(`t1081 interrupt-door walk — upto act ${UPTO}${HOLD ? " (hold after resume)" : ""}${CLEANUP_ONLY ? " (cleanup-only rider)" : ""}`);

  /* ---------- the cleanup-only rider (camera done) ---------- */
  if (CLEANUP_ONLY) {
    let walkId = null;
    let entryActive = null;
    try {
      const held = JSON.parse(readFileSync(HOLD_FILE, "utf8"));
      walkId = held.walkId ?? null;
    } catch { walkId = null; }
    if (!walkId) {
      const list = await api("/api/projects", { headers: SH });
      walkId = list.body?.projects?.find?.((p) => PROJECT_NAME_RE.test(p.name ?? ""))?.id ?? null;
    }
    if (!must(walkId != null, "the held walk project is findable", HOLD_FILE)) process.exit(1);
    await cleanupWalk(walkId, entryActive);
    console.log(`\n===== t1081 cleanup-only rider: ${pass} passed, ${fail} failed =====`);
    process.exit(fail === 0 ? 0 : 1);
  }

  /* ---------- preflight ---------- */
  must(existsSync(MIRROR), "the REAL EMPIAR mirror is home (the t527 identity-law asset)", MIRROR);
  const sys = await api("/api/system", { headers: SH });
  must(sys.body?.found === true && sys.body?.source === "RELION_HOME",
    "the dance env stands (detectRelion found via RELION_HOME — the mock binaries arm the native lane)",
    JSON.stringify(sys.body?.source));
  if (fail > 0) { console.log("PREFLIGHT FAILED — the walk needs the RELION_HOME boot; see the worklog for the env"); process.exit(1); }

  const projList = await api("/api/projects", { headers: SH });
  const entryActive = projList.body?.projects?.find?.((p) => p.active)?.id ?? null;

  /* ---------- the walk project (idempotent) ---------- */
  let walk = projList.body?.projects?.find?.((p) => PROJECT_NAME_RE.test(p.name ?? ""));
  if (!walk) {
    const mk = await api("/api/projects", { method: "POST", headers: SHJ, body: JSON.stringify({ name: `Interrupt Door Walk t1081 ${new Date().toISOString().slice(11, 19)}`, mode: "spa", remoteConnectionId: CONN_ID }) });
    if (!must(mk.status < 300, "the walk project creates", mk.text.slice(0, 120))) process.exit(1);
    walk = mk.body?.project;
  }
  const walkId = walk.id;
  const sw = await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: walkId }) });
  must(sw.status < 300, "the walk project activates");
  console.log(`    walk project: ${walkId} (entry pointer: ${entryActive})`);

  const allJobs = async () => jobsArr((await api("/api/jobs", { headers: SH })).body).filter((j) => j.projectId === walkId);
  const byName = async (n) => (await allJobs()).find((j) => j.name === n);

  /* ---------- the fuel: a NATIVE import on the LOCAL mirror ---------- */
  let imp = UPTO >= 1 ? await byName("Walk Import") : null;
  if (UPTO >= 1 && !imp) {
    console.log("\n━━━ the fuel — a NATIVE import on the REAL mirror's local paths ━━━");
    const mk = await api("/api/jobs", { method: "POST", headers: SHJ, body: JSON.stringify({ type: "import", params: { nodeType: "micrographs", micrographsPath: MIRROR, pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25, negativeStain: false }, name: "Walk Import" }) });
    if (!must(mk.status < 300, "the native import mints", JSON.stringify(mk.body).slice(0, 160))) process.exit(1);
    imp = mk.body?.job ?? mk.body;
  }
  if (UPTO >= 1 && imp && imp.status !== "completed") {
    const run = await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify({ local: true }) });
    if (!must(run.status === 200 && !run.body?.error, "the native import dispatches (local door, local files)", JSON.stringify(run.body).slice(0, 220))) process.exit(1);
    const res = await waitTerminal(imp.id);
    must(res.job?.status === "completed", "the native import completes (the star's rows are LOCAL absolute paths)", String(res.job?.result).slice(0, 140));
    imp = res.job;
  }
  if (UPTO >= 1) must(imp?.status === "completed", "the fuel import stands", imp?.status);

  /* ---------- ACT 1 — the orphaned-but-finished heal (native ctffind) ---------- */
  if (UPTO >= 1) {
    console.log("\n━━━ ACT 1 — the orphan heal (native ctffind, server killed mid-run) ━━━");
    let ctf = await byName("Walk Native Ctffind");
    if (!ctf) {
      const mk = await api("/api/jobs", { method: "POST", headers: SHJ, body: JSON.stringify({ type: "ctffind", params: { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 }, name: "Walk Native Ctffind" }) });
      must(mk.status < 300, "the native ctffind mints", JSON.stringify(mk.body).slice(0, 160));
      ctf = mk.body?.job ?? mk.body;
      const e = await api("/api/edges", { method: "POST", headers: SHJ, body: JSON.stringify({ fromJobId: imp.id, toJobId: ctf.id, fromPort: "micrographs", toPort: "micrographs" }) });
      must(e.status < 300, "the micrographs edge wires (import → ctffind)");
    }
    const rerun = await api(`/api/jobs/${ctf.id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify({ local: true }) });
    must(rerun.status === 200 && !rerun.body?.error, "Act 1: the native ctffind dispatches (local door, the t317 explicit choice)", JSON.stringify(rerun.body).slice(0, 200));
    await sleep(3500); // the mock ctffind is mid-flight (8 mics × ~1-2s)
    const mid = await api(`/api/jobs?jobId=${ctf.id}`, { headers: SH });
    const midJob = jobsArr(mid.body).find((j) => j.id === ctf.id);
    console.log(`    at kill time: ${midJob?.status}`);
    if (!must(midJob?.status === "running", "Act 1: the run is LIVE at kill time (the dance needs a running row)")) {
      // a second chance with the next dispatch — the walk refuses to fake
      // the face: kill now would film nothing
    }
    killServer();
    console.log("    the server is dead — the keeper reboots it, the orphaned ctffind keeps running");
    const up = await waitServer();
    must(up, "Act 1: the server returns (the keeper's boot carried the env)");
    const res = await waitTerminal(ctf.id, { timeoutMs: 150_000 });
    must(res.job?.status === "completed", "Act 1: THE ORPHAN-HEAL FACE — the sweep finalized the orphaned run completed", JSON.stringify({ status: res.job?.status, result: String(res.job?.result).slice(0, 160) }));
    must(/CTF estimated|completed/i.test(String(res.job?.result ?? "")), "Act 1: the healed result carries the collected outputs' words", String(res.job?.result).slice(0, 200));
  }

  /* ---------- ACT 2 — the interrupt face (native class2d, server + wrapper killed) ---------- */
  let target = null;
  if (UPTO >= 2) {
    console.log("\n━━━ ACT 2 — the interrupt face (native class2d, the whole tree killed) ━━━");
    // the fuel: a particles import through the product's own door ("Particles
    // imports an existing particles .star") — real EMPIAR pixels cropped at
    // the deposited coords (scripts/t1081-fuel-fixture.py), so the edge is
    // the LEGAL particles→particles socket pair (the first ride's lesson:
    // the edge layer validates port pairings, the import's micrographs
    // out-port is not a particles socket)
    if (!existsSync("/tmp/t1081-walk-fuel/particles.star")) {
      try { execSync("python3 scripts/t1081-fuel-fixture.py", { encoding: "utf8", shell: "/bin/bash", timeout: 120_000 }); } catch (e) { console.log(String(e).slice(0, 200)); }
    }
    must(existsSync("/tmp/t1081-walk-fuel/particles.star"), "Act 2: the fuel fixture stands (18 real particles, absolute local rows)");
    let pimp = await byName("Walk Particles Import");
    if (!pimp) {
      const mk = await api("/api/jobs", { method: "POST", headers: SHJ, body: JSON.stringify({ type: "import", params: { nodeType: "particles", micrographsPath: "/tmp/t1081-walk-fuel/particles.star", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1 }, name: "Walk Particles Import" }) });
      must(mk.status < 300, "Act 2: the particles import mints (the product's own particles door)", JSON.stringify(mk.body).slice(0, 160));
      pimp = mk.body?.job ?? mk.body;
    }
    if (pimp && pimp.status !== "completed") {
      const run = await api(`/api/jobs/${pimp.id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify({ local: true }) });
      must(run.status === 200 && !run.body?.error, "Act 2: the particles import dispatches", JSON.stringify(run.body).slice(0, 200));
      const res = await waitTerminal(pimp.id);
      must(res.job?.status === "completed", "Act 2: the particles import completes", String(res.job?.result).slice(0, 140));
      pimp = res.job;
    }
    target = await byName("Walk Class2D");
    if (!target) {
      const mk = await api("/api/jobs", { method: "POST", headers: SHJ, body: JSON.stringify({ type: "class2d", params: { numClasses: 4, iterations: 12, particleDiameter: 180, tau2Fudge: 1, threads: 2 }, name: "Walk Class2D" }) });
      must(mk.status < 300, "Act 2: the class2d mints", JSON.stringify(mk.body).slice(0, 160));
      target = mk.body?.job ?? mk.body;
      const e = await api("/api/edges", { method: "POST", headers: SHJ, body: JSON.stringify({ fromJobId: pimp.id, toJobId: target.id, fromPort: "particles", toPort: "particles" }) });
      must(e.status < 300, "Act 2: the particles edge wires (import[particles] → class2d, the legal socket pair)", JSON.stringify(e.body).slice(0, 160));
    }
    const run = await api(`/api/jobs/${target.id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify({ local: true }) });
    must(run.status === 200 && !run.body?.error, "Act 2: the native class2d dispatches", JSON.stringify(run.body).slice(0, 200));
    await sleep(7000); // 2+ checkpoints land (the mock writes run_itNNN per iteration)
    const mid = await api(`/api/jobs?jobId=${target.id}`, { headers: SH });
    const midJob = jobsArr(mid.body).find((j) => j.id === target.id);
    console.log(`    at kill time: ${midJob?.status}`);
    killServer();
    const dead = await killWrapperVerified();
    must(dead, "Act 2: the wrapper's death is VERIFIED (pgrep empty — the orphan cannot outlive the dance)");
    console.log("    the server AND the wrapper are dead — the checkpoints stay, the exit handler is lost");
    const up = await waitServer();
    must(up, "Act 2: the server returns");
    const res = await waitTerminal(target.id, { timeoutMs: 150_000 });
    must(res.job?.status === "failed", "Act 2: THE INTERRUPT FACE — the sweep marked the run failed", JSON.stringify({ status: res.job?.status }));
    must(String(res.job?.result ?? "").startsWith("interrupted (exit unknown) — re-run"),
      "Act 2: the verdict's own words open the result", String(res.job?.result).slice(0, 120));
    must(/command: .+/.test(String(res.job?.result ?? "")) && /logs: .+/.test(String(res.job?.result ?? "")),
      "Act 2: the verdict carries the command + the logs paths (the honest tail)", String(res.job?.result).slice(0, 400));
    // the checkpoints really exist (the resume contract's fuel)
    let ck = 0;
    try {
      ck = Number(execSync(`ls data/relion/${walkId}/class2d_${target.id.slice(-8)}/run_it0*_optimiser.star 2>/dev/null | wc -l`, { encoding: "utf8", shell: "/bin/bash" }).trim());
    } catch { ck = 0; }
    must(ck >= 1, `Act 2: the mid-flight checkpoints stand (${ck} × run_itNNN_optimiser.star)`);
    writeFileSync(path.join(ROOT, "shots-qa/.t1081-interrupted-face.json"), JSON.stringify({
      jobId: target.id, walkId, status: res.job?.status, result: res.job?.result, checkpoints: ck, at: new Date().toISOString(),
    }, null, 2));
    console.log(`\n    THE INTERRUPTED CARD STANDS FOR THE CAMERA: ${target.id}`);
    console.log(`    verdict: ${String(res.job?.result).slice(0, 220)}`);
  }

  /* ---------- ACT 3 — the checkpoint contract (the resume) ---------- */
  if (UPTO >= 3) {
    console.log("\n━━━ ACT 3 — the resume (the checkpoint contract) ━━━");
    target = await byName("Walk Class2D");
    if (!must(target != null && target.status === "failed", "Act 3: the interrupted card still stands (film it before this phase)", JSON.stringify(target?.status))) {
      process.exit(1);
    }
    // the record's own state BEFORE the re-run: the resume branch rides
    // done===false + resumableOptimiser's newest checkpoint — both asserted
    // from the files, not assumed
    let rec = null;
    try {
      const state = JSON.parse(readFileSync(path.join(ROOT, "data/engine-state.json"), "utf8"));
      rec = (state.jobs ?? state)[target.id] ?? null;
    } catch { rec = null; }
    must(rec != null && rec.done === false, "Act 3: the run record holds done===false (the resume branch's precondition)", JSON.stringify(rec ? { done: rec.done, exitCode: rec.exitCode } : null));
    let ckFiles = [];
    try {
      ckFiles = execSync(`ls data/relion/${walkId}/class2d_${target.id.slice(-8)}/run_it0*_optimiser.star 2>/dev/null`, { encoding: "utf8", shell: "/bin/bash" }).trim().split("\n").filter(Boolean);
    } catch { ckFiles = []; }
    must(ckFiles.length >= 1, `Act 3: the checkpoints stand on disk (${ckFiles.length})`);
    const run = await api(`/api/jobs/${target.id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify({ local: true }) });
    must(run.status === 200 && !run.body?.error, "Act 3: the re-run dispatches (the resume branch)", JSON.stringify(run.body).slice(0, 200));
    const res = await waitTerminal(target.id, { timeoutMs: 240_000 });
    must(res.job?.status === "completed", "Act 3: THE RESUME FACE — the checkpoint contract carried the run to completion", JSON.stringify({ status: res.job?.status, result: String(res.job?.result).slice(0, 160) }));
    // the resume's receipts, read BEFORE any cleanup touches the world
    // t1082 — the mock's REAL continue dialect is "CONTINUE from
    // run_itNNN_optimiser.star" (its own print, relion_refine:244);
    // "mode=continue" was this check's invention (t1081 named the
    // instrumentation error). The stronger assert: the binary's marker
    // must name EXACTLY the checkpoint the record's resumedFrom computes
    // — engine record, argv target and binary witness all agree.
    let contFrom = null;
    let recAfter = null;
    try {
      const out = execSync(`cat data/relion/${walkId}/class2d_${target.id.slice(-8)}/run.out 2>/dev/null`, { encoding: "utf8", shell: "/bin/bash" });
      const m = out.match(/CONTINUE from (run_it\d+_optimiser\.star)/);
      contFrom = m ? m[1] : null;
    } catch { contFrom = null; }
    try {
      const state = JSON.parse(readFileSync(path.join(ROOT, "data/engine-state.json"), "utf8"));
      recAfter = (state.jobs ?? state)[target.id] ?? null;
    } catch { recAfter = null; }
    must(contFrom != null, "Act 3: the mock's run.out speaks CONTINUE from (the --continue landed on the binary)", String(contFrom));
    must(recAfter != null && recAfter.resumedFrom != null, "Act 3: the record carries resumedFrom (the iteration the contract picked up)", JSON.stringify(recAfter ? { resumedFrom: recAfter.resumedFrom, done: recAfter.done } : null));
    if (contFrom != null && recAfter?.resumedFrom != null) {
      must(contFrom === `run_it${String(recAfter.resumedFrom).padStart(3, "0")}_optimiser.star`,
        "Act 3: THREE-WITNESS AGREEMENT — the record's resumedFrom, the argv's --continue target and the binary's CONTINUE-from marker name the same checkpoint",
        `${contFrom} vs resumedFrom=${recAfter.resumedFrom}`);
    }
    writeFileSync(path.join(ROOT, "shots-qa/.t1081-resume-receipt.json"), JSON.stringify({
      jobId: target.id, status: res.job?.status, result: res.job?.result, contFrom, record: recAfter, at: new Date().toISOString(),
    }, null, 2));
    if (HOLD) {
      // t1082 — the camera hold: the chip's face is filmed through the
      // product's own inspector BEFORE any cleanup touches the world; the
      // rider (--cleanup-only) runs the same cleanup body afterward.
      writeFileSync(HOLD_FILE, JSON.stringify({ walkId, jobId: target.id, at: new Date().toISOString() }, null, 2));
      console.log(`\n    HELD AFTER RESUME — the walk project ${walkId} stands for the camera`);
      console.log(`    film the Log tab's resume chip on job ${target.id}, then:`);
      console.log("    node scripts/t1081-interrupt-door-walk.mjs --cleanup-only");
    }
  }

  /* ---------- CLEANUP (the walk obeys the pointer restore law) ---------- */
  if (UPTO >= 3 && !HOLD) {
    await cleanupWalk(walkId, entryActive);
  }

  console.log(`\n===== t1081 interrupt-door walk [upto ${UPTO}]: ${pass} passed, ${fail} failed =====`);
  if (failures.length) failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(fail === 0 ? 0 : 1);
}

mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
main().catch((e) => { console.error("t1081 walk aborted:", e); process.exit(1); });

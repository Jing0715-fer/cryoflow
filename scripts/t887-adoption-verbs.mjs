#!/usr/bin/env node
/* t887 — THE ADOPTION VERBS, FILMED (t874's guidance, parked four times):
 * the compare family's world-mutating verbs were never pressed — correctly
 * (both mutate the graph), which is exactly why their flight paths (mint +
 * wire + adopt, the three round trips) remained un-filmed at the UI level.
 * The t871 lesson's inverse: a door pinned and never pressed is only
 * half-filmed; the other half needs a world it can spend.
 *
 * THE THROWAWAY WORLD (not the demo's healed 15):
 *   POST /api/projects (sandbox, set active) -> POST /api/pipeline-template
 *   (10 pre-wired SPA jobs) -> PATCH the import to the EMPIAR lane ->
 *   ONE run POST (the engine's cascade auto-starts every pending
 *   downstream) -> then the side world: an excludemg filter between the
 *   import and a SECOND MotionCorr run (the filter drops one movie, the
 *   stub's per-index motion values shift, and the A/B verdict grows a REAL
 *   regression list for the exclude rider to bake), a class3d sibling off
 *   the initialmodel (the class domain's dramatic verdict: 4 paired, all
 *   gained, the tutorial's own shape), and a select2d child on run A
 *   (the adoption's re-wire target).
 *
 * THE THREE FLIGHTS (each: the verb's honest enabled state -> the click ->
 * the receipt toast -> the GRAPH truth via the API):
 *   1. THE PLAIN ADOPT — "Continue downstream from run B": run A's wires
 *      re-parent onto run B (POST-new + DELETE-old per move, the refetch
 *      re-pin, one toast speaking for the whole gesture).
 *   2. THE SELECT RIDER — "Continue downstream, selecting these (N)":
 *      mints a 2D Class Selection consuming run B (the gained class numbers
 *      baked at birth into selectedClasses), wires BOTH of run B's mouths,
 *      re-parents run A's downstream onto the MINT (t453's own-plan law).
 *   3. THE EXCLUDE RIDER — "Continue downstream, excluding these (N)":
 *      mints an Exclude Micrographs filter consuming run B (the regressed
 *      names baked at birth into excludeNames), re-parents run A's
 *      downstream onto the FILTER (t454's law, ridden home).
 *   Plus the honest absences: the class dialog has no exclude rider (the
 *   verb gate), the motion dialog has no select rider, and after both
 *   adoptions run A's door speaks "no downstream jobs to re-wire".
 *
 * THE TEARDOWN: DELETE /api/projects/<sandbox> (stops live runs, removes
 * the jobs and edges), switch back to the tutorial project, verify the standing shape —
 * the spent world leaves no residue in the demo.
 *
 *   node scripts/t887-adoption-verbs.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const JSONH = `${ORIGIN} -H "Content-Type: application/json"`;
let pass = 0, fail = 0;
const results = [];

const ok = (label, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`); }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
/* the SOFT open: a navigate whose page compiles for tens of seconds makes
 * the daemon's own read fail EAGAIN ("it may or may not have run") — the
 * navigation itself proceeds. The film's opens retry once and ride soft;
 * the DRESS POLL is the hard verification (the canvas must actually speak
 * or V1/T4 fail honestly). */
const abSoft = (args, attempt = 0) => {
  try { return ab(args); } catch (e) {
    if (String(e).includes("may or may not have run") && attempt < 2) { return abSoft(args, attempt + 1); }
    if (String(e).includes("may or may not have run")) return "";
    throw e;
  }
};
/* a best-effort eval: a tab mid-navigation (or stuck on about:blank) can
 * refuse localStorage outright — the caller's own check is the verdict */
const evalSoft = (js) => { try { return evalJson(js); } catch { return null; } };
/* OPEN → poll until the canvas speaks → if it never did, open AGAIN (the
 * daemon's navigation can be lost outright inside a 40s compile window;
 * the retry lands on the warm compile in seconds) */
const openAndDress = async (minCards, rounds = 3) => {
  let dress = null;
  for (let round = 0; round < rounds; round++) {
    abSoft(`open ${BASE}/?t=${Date.now()}`);
    for (let i = 0; i < 30; i++) {
      await zzz(1);
      dress = evalSoft('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const cards = document.querySelectorAll("[data-card-btn]").length; return JSON.stringify({ dlgs: dgs, cards }); })()');
      if (dress && dress.dlgs === 0 && dress.cards >= minCards) return dress;
    }
  }
  return dress;
};
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch { /* a plain string */ }
  }
  return out;
};
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));

/** API helper — curl with the http-guard's Origin; the JSON body MUST be
 * single-quoted or the shell eats its double quotes (the W1 lesson). */
const api = (method, path, body) => {
  const bodyArg = body !== undefined ? ` -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'` : "";
  const out = execSync(`curl -s --max-time 30 -X ${method} ${JSONH}${bodyArg} ${BASE}${path}`, { encoding: "utf8" });
  try { return JSON.parse(out); } catch { return { raw: out }; }
};
const jobsOf = async () => api("GET", "/api/jobs").jobs || [];
const waitJobs = async (ids, wantStatus, budgetS) => {
  const want = new Set(ids);
  for (let i = 0; i < budgetS; i++) {
    await zzz(2);
    const jobs = await jobsOf();
    const done = jobs.filter((j) => want.has(j.id) && j.status === wantStatus).length;
    const bad = jobs.filter((j) => want.has(j.id) && ["failed", "cancelled"].includes(j.status));
    if (bad.length > 0) return { done, total: want.size, bad: bad.map((j) => `${j.name}:${j.status}`) };
    if (done === want.size) return { done, total: want.size, bad: [] };
  }
  return { done: -1, total: want.size, bad: ["timeout"] };
};
const newId = () => globalThis.crypto.randomUUID();

/* t1172 — THE CHUNKED FILM: the mock's honest pace (the K-classes pixel
 * renders take minutes; class2d alone ran ~3 min on the first ride) exceeds
 * one tool call's budget, and the boundary reaper forbids background rides.
 * The t412 pattern (the healer's chunked healing) comes to the film: each
 * chunk is a foreground call that boots its own server; completed stages
 * keep their products; a stage left "running" by a killed chunk is reset
 * through the PATCH idle door (which kills the dead tree first) and re-run.
 *   --chunk=mint      Phase 0 + the world mint-or-adopt + the template chain
 *   --chunk=side      Phase 0 + the side world (filter, subset MC, K=10 twin)
 *   --chunk=flights   Phase 0 + the browser walk (the three flights)
 *   --chunk=teardown  Phase 0 + the teardown (the spent world leaves no residue)
 *   (no flag)         the whole film in one call — the original shape
 * The receipt MERGES by chunk (a fresh chunk rewrites only its own key), so
 * the finished film's receipt carries every chunk's checks. */
const CHUNK = (process.argv.find((a) => a.startsWith("--chunk=")) || "").split("=")[1] || "all";
const inChunk = (...ns) => CHUNK === "all" || ns.includes(CHUNK);
console.log(`film chunk: ${CHUNK}`);

/* the ids the later phases need — filled by whichever chunk runs */
let sandboxId, tutorialProjectId, excludeName = null;
let byType = {}, tplJobs = [], tplEdges = [];
let sandboxJobs = [], A, MA, MB, CTF, B, exJob, mcB;

const findSandbox = async () =>
  (api("GET", "/api/projects").projects || []).find((p) => (p.name || "").includes("t887-adoption"));

/* re-derive the world's ids from the API truth (the adopt path's eyes):
 * unique types map by first sighting; the twins discriminate by their WIRE
 * (MB hangs off the excludemg filter; B carries numClasses=10) */
const deriveWorld = async () => {
  sandboxJobs = await jobsOf();
  byType = {};
  for (const j of sandboxJobs) if (!(j.type in byType)) byType[j.type] = j;
  const edges = api("GET", "/api/edges").edges || [];
  exJob = sandboxJobs.find((j) => j.type === "excludemg");
  const mcs = sandboxJobs.filter((j) => j.type === "motioncorr");
  MA = exJob ? mcs.find((m) => !edges.some((e) => e.fromJobId === exJob.id && e.toJobId === m.id)) : mcs[0];
  MB = exJob ? mcs.find((m) => m !== MA && edges.some((e) => e.fromJobId === exJob.id && e.toJobId === m.id)) : mcs[1];
  const c2ds = sandboxJobs.filter((j) => j.type === "class2d");
  B = c2ds.find((c) => String(c.params?.numClasses ?? "") === "10");
  A = c2ds.find((c) => c !== B);
  CTF = byType.ctffind;
  return sandboxJobs;
};

/* a job to completion, resumably: completed stays; a killed chunk's
 * "running" orphan is reset through the idle door (the tree kill is the
 * door's own first act) and re-run */
/* the SETTLED READ: a single jobs-GET can flicker (the boot's reconciler
 * sweep, the active-project handoff mid-switch) — poll until the world
 * reads healthy or the settles run out; three settled reads that still
 * disagree are an honest FAIL */
const settledJobs = async (want, budgetS = 3, gapS = 4) => {
  let js = await jobsOf();
  for (let i = 0; i < budgetS; i++) {
    if (want(js)) return js;
    await zzz(gapS);
    js = await jobsOf();
  }
  return js;
};

const runToCompletion = async (job, budgetS) => {
  if (job.status === "completed") { console.log(`    ${job.type}: already completed (chunked resume)`); return { done: 1, bad: [] }; }
  if (job.status === "running") {
    console.log(`    ${job.type}: orphan of a killed chunk — reset through the idle door`);
    api("PATCH", `/api/jobs/${job.id}`, { status: "idle" });
    await zzz(1);
  }
  api("POST", `/api/jobs/${job.id}/run`);
  return waitJobs([job.id], "completed", budgetS);
};

console.log("t887 — the adoption verbs, filmed on a throwaway world: mint + wire + adopt, three round trips per verb\n");

/* ================= PHASE 0 — the pre-flight ================= */
console.log("Phase 0 — pre-flight");

/* P0 — the ZOMBIE-TAB NEUTER (t1172, the whale's third mouth): the browser
 * daemon's tab may still sit on the canvas from a previous window's QA —
 * when THIS ride's server boots, the stale tab's HMR reconnect fires a full
 * page reload, the canvas page's dev compile (~3 GB residency) starts, and
 * the whale + this ride's mock-cluster jobs together tip the 4 GB box (the
 * first ride died exactly this way: dmesg `Killed process 8129 … anon-rss:
 * 2873124kB`, the server starved mid-compile, waitJobs read a refused
 * socket). Neuter the tab FIRST — about:blank has no HMR socket, so the
 * boot finds no mouth to feed. The orchestrator's own pre-boot neuter is
 * the belt; this is the suspenders. */
try { ab("open about:blank"); ok("P0 the daemon's tab neutered (no zombie reload can compile the whale)", true); }
catch (e) { ok("P0 the daemon's tab neutered", false, String(e).slice(0, 120)); }

/* P1 — the ACTIVE project must be the tutorial BEFORE any world read: a
 * crashed prior ride can leave the sandbox active (its jobs then masquerade
 * as "the world" — the first ride's P2 captured the sandbox id and the
 * teardown nearly switched to a deleted project). The tutorial is found by
 * NAME in the projects list, switched active, THEN read. */
if (inChunk("mint")) {
  const projsP1 = api("GET", "/api/projects");
  const tutorialProj = (projsP1.projects || []).find((p) => /tutorial/i.test(p.name || ""));
  if (tutorialProj && !tutorialProj.active) {
    api("POST", "/api/projects/switch", { id: tutorialProj.id });
    await zzz(2);
  }
  /* the switch's truth lives in a FRESH read: the pre-switch snapshot's
   * .active is exactly what the switch was for (t1182's own ride — the
   * sandbox was active, the switch landed, and the stale flag still said
   * false; the film's own P1 red was a stale read, not a dead switch) */
  const tutorialProjNow = (api("GET", "/api/projects").projects || []).find((p) => p.id === (tutorialProj || {}).id) || tutorialProj;
  /* the demo world's STANDING shape (the t1179 stale-premise closure, now
   * the film's own premise): 15 jobs, 13 completed, and symexpand/rebalance
   * idle BY DESIGN — the demo chain never runs them. Wanting 15/15 here
   * made every earlier mint chunk carry one dishonest red (t1172's 8/9). */
  const demoJobs = await settledJobs((js) => js.length === 15 && js.filter((j) => j.status === "completed").length === 13 && js.every((j) => j.status === "completed" || j.status === "idle"));
  const demoIdle = demoJobs.filter((j) => j.status === "idle").map((j) => j.type);
  ok("P1 the demo world at its standing shape (15 jobs · 13 completed · the 2 idle by design) and active", demoJobs.length === 15 && demoJobs.filter((j) => j.status === "completed").length === 13 && !!tutorialProjNow?.active, `jobs=${demoJobs.length} idle=[${demoIdle.join(",")}] active=${tutorialProjNow?.name || "?"}`);
  tutorialProjectId = tutorialProjNow?.id;
  ok("P2 the tutorial project captured (by name, not by active-guess)", !!tutorialProjectId, `id=${tutorialProjectId}`);
} else if (inChunk("side", "flights")) {
  /* the adopt chunks: the tutorial's health was the mint chunk's business;
   * here the SANDBOX is the workpiece — switch active so the canvas and
   * jobsOf() speak the throwaway world */
  tutorialProjectId = ((api("GET", "/api/projects").projects || []).find((p) => /tutorial/i.test(p.name || "")) || {}).id;
}
const staleNow = (api("GET", "/api/projects").projects || []).find((p) => (p.name || "").includes("t887-adoption"));
const adopting = !!staleNow && (CHUNK === "mint" || CHUNK === "all" ? true : true); /* every chunk adopts; only a HOLLOW shell is re-minted below */
ok("P3 the sandbox state resolved (adopt-or-mint)", true, adopting && staleNow ? `existing sandbox ${staleNow.id}` : "none yet — the mint will create it");

/* P4 — the compute reality: cluster-type jobs (motioncorr/class2d/…) need a
 * LOCAL RELION install (the engine's dispatch gate, engine.ts:9467). The
 * sandbox has none — the mock cluster's python stubs ARE this rig's compute
 * (the SSH lane runs them remotely; the local lane can run the SAME stubs
 * directly). Install them at the detection's known-path candidate
 * /home/z/relion-install/bin (NOT the t528 recipe tree — that prefix's
 * stamp files are the build-progress readout) and force the re-detect.
 * Idempotent: a previous ride's install is reused. No symlink — the
 * sandbox refuses ln -s (the Task 177 lesson). */
const { mkdirSync, copyFileSync, readdirSync: rds } = await import("node:fs");
const STUB_SRC = join(ROOT, "services", "mock-cluster", "fs", "opt", "bin");
const STUB_DST = "/home/z/relion-install/bin";
let stubs = 0;
try {
  mkdirSync(STUB_DST, { recursive: true });
  for (const f of rds(STUB_SRC)) {
    if (f === "__pycache__") continue;
    copyFileSync(join(STUB_SRC, f), join(STUB_DST, f));
    stubs++;
  }
  execSync(`chmod +x ${STUB_DST}/* 2>/dev/null`);
} catch { /* the re-detect verdict below is the assert */ }
if (inChunk("mint", "side")) {
  const det = api("GET", "/api/system?force=1");
  const dstat = det.status || det;
  ok("P4 the compute lane detected (the mock stubs as the local RELION install)", dstat.found === true && String(dstat.path || "").includes("relion-install"), `stubs=${stubs} found=${dstat.found} path=${dstat.path}`);
}

/* ================= PHASE 1 — the throwaway world (the mint chunk) ==== */
const readExcludeName = () => {
  try {
    const projDir = join(ROOT, "data", "relion", sandboxId);
    if (!existsSync(projDir)) return null;
    const impDir = readdirSync(projDir).find((d) => d.startsWith("import_"));
    if (!impDir) return null;
    const starPath = join(projDir, impDir, "micrographs.star");
    const starTxt = existsSync(starPath) ? readFileSync(starPath, "utf8") : "";
    const movieNames = Array.from(starTxt.matchAll(/micrographs\/(mic_\d+\.mrc)/g)).map((m) => m[1]);
    return movieNames.length >= 4 ? movieNames[3] : null;
  } catch { return null; }
};

if (inChunk("mint")) {
  console.log("\nPhase 1 — the throwaway world");
  let existing = await findSandbox();
  if (existing && process.argv.includes("--fresh")) {
    console.log(`    --fresh: the spent sandbox ${existing.id} deleted (a flown world's shapes never fit a second flight)`);
    api("DELETE", `/api/projects/${existing.id}`);
    existing = null;
  }
  if (existing) {
    api("POST", "/api/projects/switch", { id: existing.id });
    await zzz(2);
    if ((await jobsOf()).length === 0) {
      console.log(`    hollow sandbox ${existing.id} (0 jobs) — re-minting`);
      api("DELETE", `/api/projects/${existing.id}`);
      existing = null;
    } else {
      sandboxId = existing.id;
      await deriveWorld();
      ok("W1a the sandbox ADOPTED (chunked resume)", !!sandboxId && sandboxJobs.length > 0, `id=${sandboxId} jobs=${sandboxJobs.length}`);
    }
  }
  if (!existing) {
    const created = api("POST", "/api/projects", { name: "t887-adoption-throwaway" });
    sandboxId = created.project?.id;
    ok("W1 the sandbox project created (set active)", !!sandboxId, `id=${sandboxId}`);

    const tpl = api("POST", "/api/pipeline-template", {});
    tplJobs = tpl.jobs || [];
    tplEdges = tpl.edges || [];
    ok("W2 the template chain created", tplJobs.length === 10 && tplEdges.length === 13, `jobs=${tplJobs.length} edges=${tplEdges.length} (the template's own 13-wire chain)`);
    byType = {};
    for (const j of tplJobs) byType[j.type] = j;
  }

  /* the import needs the EMPIAR lane (the tutorial's own door; idempotent) */
  api("PATCH", `/api/jobs/${byType.import.id}`, { params: { nodeType: "movies", empiarData: "true" } });

  console.log("    running the template chain (SEQUENTIAL, resumable — completed stages keep their products, a killed chunk's orphan resets through the idle door)…");
  const chainOrder = ["import", "motioncorr", "ctffind", "autopick", "extract", "class2d", "initialmodel", "refine3d", "maskcreate", "postprocess"];
  let chainBad = [];
  for (const t of chainOrder) {
    const w = await runToCompletion(byType[t], 240);
    if (w.done !== 1) { chainBad.push(`${t}:${w.bad.join(",") || "timeout"}`); break; }
  }
  ok("W3 the template chain completed (each stage run in RELION order)", chainBad.length === 0, chainBad.length ? chainBad.join(" | ") : "10/10");

  /* the movies star on disk — the exclude name comes from REAL rows */
  excludeName = readExcludeName();
  ok("W4 the import's movies star read from disk, an exclude name picked", !!excludeName, `pick=${excludeName}`);
}

/* the side world: import -> excludemg -> motioncorrB (the side chunk) */
if (inChunk("side")) {
  console.log("\nPhase 1.5 — the side world");
  if (!sandboxId || !A) {
    const sb = await findSandbox();
    if (!sb) { ok("S0 the sandbox exists (run --chunk=mint first)", false, "no t887-adoption sandbox"); process.exit(1); }
    sandboxId = sb.id;
    api("POST", "/api/projects/switch", { id: sandboxId });
    await zzz(2);
    await deriveWorld();
  }
  /* the star re-read (the mint chunk already proved it once) */
  excludeName = readExcludeName();
  ok("W4b the movies star re-read on the side chunk", !!excludeName, `pick=${excludeName}`);

  const projEdges = api("GET", "/api/edges").edges || [];
  const hasE = (from, to) => projEdges.some((x) => x.fromJobId === from && x.toJobId === to);
  if (!exJob) {
    const exPlace = { x: byType.motioncorr.x + 40, y: byType.motioncorr.y + 260 };
    exJob = api("POST", "/api/jobs", { type: "excludemg", x: exPlace.x, y: exPlace.y, params: { excludeNames: excludeName } }).job;
  }
  if (!mcB) {
    const exPlace = { x: byType.motioncorr.x + 40, y: byType.motioncorr.y + 260 };
    mcB = api("POST", "/api/jobs", { type: "motioncorr", x: exPlace.x + 300, y: exPlace.y }).job;
  }
  const impEdge = projEdges.find((x) => x.fromJobId === byType.import.id && x.toJobId === MA.id);
  const edgeDefs = [
    { id: newId(), fromJobId: byType.import.id, toJobId: exJob.id, fromPort: impEdge.fromPort, toPort: "micrographs" },
    { id: newId(), fromJobId: exJob.id, toJobId: mcB.id, fromPort: "micrographs", toPort: impEdge.toPort },
  ];
  let edgesOk = true;
  for (const def of edgeDefs) {
    if (hasE(def.fromJobId, def.toJobId)) continue; /* the resume's idempotency */
    const r = api("POST", "/api/edges", def);
    if (r.error) { edgesOk = false; console.log(`    edge refused: ${JSON.stringify(r).slice(0, 140)}`); }
  }
  ok("W5 the exclude filter wired: import -> excludemg -> MotionCorr (subset run)", edgesOk && !!exJob?.id && !!mcB?.id, `filter=${exJob?.id?.slice(-6)} mcB=${mcB?.id?.slice(-6)}`);

/* the class2d TWIN with a different K — the stub's class assignment is
 * (p*7+it)%K+1, so K=10 spreads the same 100 particles 10-per-class where
 * A's K=50 spreads them 2-per-class: every paired class GAINS a real,
 * deterministic margin, and run B being a class2d means BOTH of the
 * selection's mouths can be fed (class3d has no classAverages output —
 * the t453 wiring gate would honestly refuse the mint). */
if (!B) {
  B = api("POST", "/api/jobs", { type: "class2d", x: byType.class2d.x + 300, y: byType.class2d.y + 260, params: { numClasses: 10 } }).job;
  const projEdges2 = api("GET", "/api/edges").edges || [];
  if (!projEdges2.some((x) => x.fromJobId === byType.extract.id && x.toJobId === B.id)) {
    await api("POST", "/api/edges", { id: newId(), fromJobId: byType.extract.id, toJobId: B.id, fromPort: "particles", toPort: "particles" });
  }
}
ok("W6 the class2d twin wired off the extract (K=10 — real gains, both mouths feedable)", !!B?.id, `B=${B?.id?.slice(-6)} K=10`);

console.log("    running the side world (resumable)…");
const exWait = await runToCompletion(exJob, 60);
const mcBWait = await runToCompletion(mcB, 120);
const bWait = await runToCompletion(B, 180);
ok("W7 the side world completed (filter, subset MotionCorr, K=10 class2d)", exWait.done === 1 && mcBWait.done === 1 && bWait.done === 1, `filter=${exWait.done} mcB=${mcBWait.done} class2dB=${bWait.done}`);

sandboxJobs = await jobsOf();
const completedSandbox = sandboxJobs.filter((j) => j.status === "completed").length;
ok("W8 the throwaway world stands: every job completed", sandboxJobs.length === 13 && completedSandbox === sandboxJobs.length, `jobs=${sandboxJobs.length} completed=${completedSandbox}`);
}

/* ================= PHASE 2 — the browser walk (the flights chunk) ==== */
if (inChunk("flights")) {
console.log("\nPhase 2 — the browser walk (the three flights)");
if (!sandboxId || !A || !B || !exJob) {
  const sb = await findSandbox();
  if (!sb) { ok("V0 the sandbox exists (run mint+side first)", false, "no t887-adoption sandbox"); process.exit(1); }
  sandboxId = sb.id;
  api("POST", "/api/projects/switch", { id: sandboxId });
  await zzz(2);
  await deriveWorld();
}
ok("V0 the walk's world adopted (ids re-derived from the API truth)", !!A && !!B && !!MA && !!MB && !!exJob && !!CTF && !!byType.initialmodel && !!byType.refine3d, `jobs=${sandboxJobs.length} A=${A?.id?.slice(-6)} B=${B?.id?.slice(-6)}`);

const flightsReady = !!A && !!B && !!MA && !!MB && !!exJob && !!CTF;
ok("V0b the side world present (the twins, the filter, the CTF) — the flights' workpiece", flightsReady, `A=${!!A} B=${!!B} MA=${!!MA} MB=${!!MB} ex=${!!exJob} CTF=${!!CTF}`);
if (!flightsReady) {
  console.log("    flights skipped — run --chunk=side first (the receipt lands honest)");
} else {
  const dress = await openAndDress(12);
  evalSoft('(() => { localStorage.removeItem("cryoflow.selectedJob.v1"); return 1; })()');
  ok("V1 the browser rides the throwaway world", dress && dress.dlgs === 0 && dress.cards >= 12, `cards=${dress?.cards}`);

  const findCard = (nameRe) => evalJson(`(() => { const b = Array.from(document.querySelectorAll("[data-card-btn]")).find((x) => ${nameRe}.test(x.textContent || "")); if (!b) return JSON.stringify({ found: false }); const r = b.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; b.dispatchEvent(new PointerEvent("pointerdown", o)); b.dispatchEvent(new PointerEvent("pointerup", o)); b.click(); return JSON.stringify({ found: true }); })()`);

  const openInspector = async (nameRe, label) => {
    findCard(nameRe);
    let insp = null;
    for (let i = 0; i < 15; i++) {
      zzz(1);
      insp = evalJson('(() => JSON.stringify({ n: document.querySelectorAll("[role=dialog]").length }))()');
      if (insp.n >= 1) break;
    }
    /* the A/B door may live on the Results tab — ride it if the door is late */
    let door = null;
    for (let i = 0; i < 20; i++) {
      zzz(1);
      door = evalJson(`(() => { let d = document.querySelector("[aria-label^=\\"${label} A/B\\"]"); if (!d) { const t = Array.from(document.querySelectorAll("[role=dialog] [role=tab]")).find((x) => (x.textContent || "").trim().startsWith("Results")); if (t) t.click(); } d = document.querySelector("[aria-label^=\\"${label} A/B\\"]"); return JSON.stringify({ found: !!d, siblings: d ? (d.getAttribute("aria-label").match(/\\((\\d+)/) || [])[1] : null }); })()`);
      if (door.found) break;
    }
    return door;
  };

  const openCompare = async (nameRe, label) => {
    const door = await openInspector(nameRe, label);
    if (!door.found) return { door };
    evalSoft(`(() => { document.querySelector("[aria-label^=\\"${label} A/B\\"]").click(); return 1; })()`);
    let dlg = null;
    for (let i = 0; i < 15; i++) {
      zzz(1);
      dlg = evalJson('(() => { const r = document.querySelector("[role=dialog] [role=region][aria-label*=verdict]"); return JSON.stringify({ open: !!r, text: r ? (r.textContent || "").slice(0, 260) : null }); })()');
      if (dlg.open) break;
    }
    return { door, dlg };
  };

  const closeAnyCompare = async () => {
    evalSoft('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }); d.dispatchEvent(k); } return 1; })()');
    await zzz(1.5);
  };

  /* the riders' ready signal (t1182's cure of the t1172 flights' two reds):
   * the verdict region renders the MOMENT the dialog opens — waiting on it
   * proves nothing about the verbs (t1172's flight read the exclude rider
   * ABSENT while the paired fetch was still in the air, and the select
   * rider DISABLED while the store's poll — 8 s idle cadence — had not yet
   * carried the back-door-wired child in; the product's gates were honest
   * both times). The film now polls the RIDER itself until it speaks an
   * honest state: enabled, or its aria-label sentence held stable for 10 s —
   * and RECORDS that sentence either way (the
   * t1172 hunt item: the gate's truth is one read away). */
  const riderRead = (testid) => evalSoft(`(() => { const el = document.querySelector("[data-testid=\\"${testid}\\"]"); return JSON.stringify({ present: !!el, disabled: el ? el.disabled : null, label: el ? (el.getAttribute("aria-label") || "") : "" }); })()`);
  const riderReady = async (testid, opts = {}) => {
    /* want="enabled" (the default: every flight expects its verb live) waits
     * out the store's 8 s idle poll for back-door wiring to land; the
     * stabilized sentence is only believed after it has held stableS — two
     * reads 1 s apart proved nothing (t1182's own first ride: the
     * stabilization fired inside the pre-tick window and the gate looked
     * shut while the poll was still in flight). want="disabled" (the spent
     * state's F4) returns on the first disabled read. */
    const { budgetS = 30, want = "enabled", stableS = 10 } = opts;
    let last = null, stableSince = 0;
    for (let i = 0; i < budgetS; i++) {
      await zzz(1);
      const v = riderRead(testid);
      if (!v) continue; /* a mid-compile eval refused — the poll absorbs it */
      if (v.present && v.disabled === false && want === "enabled") return { ...v, ready: true };
      if (v.present && v.disabled === true && want === "disabled") return { ...v, ready: true };
      if (v.present && last && v.label === last.label) {
        if (!stableSince) stableSince = Date.now();
        if (Date.now() - stableSince >= stableS * 1000) return { ...v, ready: false };
      } else { stableSince = 0; }
      last = v;
    }
    return { ...(last || { present: false, disabled: null, label: "" }), ready: false };
  };
  const riderVerdict = (v, tag) => (v.present ? (v.disabled === false ? `${tag} ENABLED · ` : `${tag} UNAVAILABLE · `) : "ABSENT · ") + (v.label || "rider never rendered").slice(0, 110);

  /* the app's toasts are RADIX (ui/toaster), not sonner — the viewport is an
   * <ol>, each toast an <li data-state> with Title/Description inside (the
   * sonner selector never matched anything; the t1172 ride proved the point
   * by reading "none" while the graph had already re-wired). t1183: the li's
   * firstElementChild is the t826 HOURGLASS bar (div.toast-hourglass, drawn
   * whenever the card has a close timer — by default always), whose text
   * is empty — the titles never read because the reader was reading the
   * bar. The content wrapper is the li's first NON-hourglass div
   * (toaster.tsx's <div class=grid gap-1>), and the Title is its own
   * first child; :scope > div:not(.toast-hourglass) holds in both shapes
   * (an immortal duration-0 card draws no bar and shifts nothing). */
  const toastOf = async () => {
    for (let i = 0; i < 16; i++) {
      await zzz(0.5);
      const t = evalSoft('(() => { const lis = Array.from(document.querySelectorAll("ol > li[data-state]")); const vs = lis.filter((x) => x.closest("ol")); return JSON.stringify({ n: vs.length, titles: vs.map((x) => { const w = x.querySelector(":scope > div:not(.toast-hourglass)"); return ((w && w.firstElementChild && w.firstElementChild.textContent) || "").slice(0, 90); }), texts: vs.map((x) => (x.textContent || "").slice(0, 220)) }); })()');
      if (t && t.n > 0) return t;
    }
    return { n: 0, titles: [], texts: [] };
  };

  const edgesNow = () => api("GET", "/api/edges").edges || [];
  const hasEdge = (edges, from, to) => edges.some((e) => e.fromJobId === from && e.toJobId === to);
  /* t1183 — the graph-settle poll (the riderReady shape borrowed): a
   * one-shot edgesNow() read raced the adoption's refetch and judged a
   * graph that was still moving. Poll until the EXPECTED shape holds (the
   * caller's own predicate — the arrivals, not the assertions); the
   * budget spent returns the last read honestly, the ok() still the judge. */
  const edgesSettle = async (check, budgetS = 20) => {
    let edges = [];
    for (let i = 0; i < budgetS; i++) {
      await zzz(1);
      edges = edgesNow();
      if (check(edges)) break;
    }
    return edges;
  };

  /* ---- FLIGHT 1: the plain adopt on (class2d A -> class3d B) ---- */
  console.log("\n  FLIGHT 1 — the plain adopt (Continue downstream from run B)");
  const f1 = await openCompare(/^2D Classification/, "Class");
  ok("F1.1 the Class A/B door found (1 sibling)", f1.door?.found === true && f1.door?.siblings === "1", `siblings=${f1.door?.siblings}`);
  ok("F1.2 the compare dialog opened with the verdict region", f1.dlg?.open === true, (f1.dlg?.text || "").slice(0, 90));
  const f1adopt = await riderReady("adopt-downstream");
  const f1sel = await riderReady("adopt-with-select");
  const f1exPresent = evalJson('(() => JSON.stringify({ present: !!document.querySelector("[data-testid=\\"adopt-with-exclude\\"]") }))()').present;
  ok("F1.3 the plain adopt ENABLED with its move count", f1adopt.present && f1adopt.disabled === false, riderVerdict(f1adopt, "plain"));
  ok("F1.4 the select rider PRESENT and ENABLED (K=10 twin: every paired class gained)", f1sel.present && f1sel.disabled === false, riderVerdict(f1sel, "select"));
  ok("F1.5 the exclude rider ABSENT (the class verdict has no micrographs to exclude)", f1exPresent === false);
  evalSoft('(() => { document.querySelector("[data-testid=\\"adopt-downstream\\"]").click(); return 1; })()');
  const f1toast = await toastOf();
  ok("F1.6 the adoption receipt spoke (the toast names the re-wire)", f1toast.n > 0 && /re-wired|adopted/i.test(f1toast.texts.join(" | ")), (f1toast.titles[0] || "none").slice(0, 60));
  const f1edges = await edgesSettle((e) => hasEdge(e, B.id, byType.initialmodel.id), 10);
  ok("F1.7 THE GRAPH TRUTH: both template wires re-parented onto run B", hasEdge(f1edges, B.id, byType.initialmodel.id) && hasEdge(f1edges, B.id, byType.refine3d.id) && !hasEdge(f1edges, A.id, byType.initialmodel.id) && !hasEdge(f1edges, A.id, byType.refine3d.id), `B->initialmodel=${hasEdge(f1edges, B.id, byType.initialmodel.id)} B->refine3d=${hasEdge(f1edges, B.id, byType.refine3d.id)}`);

  /* ---- FLIGHT 2: the select rider (mint + wire + adopt) ---- */
  console.log("\n  FLIGHT 2 — the select rider (mint the selection, wire both mouths, adopt)");
  const c1 = api("POST", "/api/jobs", { type: "select2d", x: A.x + 300, y: A.y + 260, params: {} }).job;
  const c1edge = api("POST", "/api/edges", { id: newId(), fromJobId: A.id, toJobId: c1.id, fromPort: "particles", toPort: "particles" });
  ok("F2.1 a fresh select2d child wired on run A (the re-wire target)", !!c1?.id && !c1edge.error, `child=${c1?.id?.slice(-6)}`);
  await closeAnyCompare();
  const f2 = await openCompare(/^2D Classification/, "Class");
  const f2verbs = await riderReady("adopt-with-select");
  ok("F2.2 the select rider ENABLED on the re-opened dialog (the store's poll carried the fresh child; the gate's sentence recorded either way)", f2verbs.present === true && f2verbs.disabled === false, riderVerdict(f2verbs, "select"));
  if (f2verbs.disabled === false) {
    evalSoft('(() => { document.querySelector("[data-testid=\\"adopt-with-select\\"]").click(); return 1; })()');
  } else { console.log("    the gate held — the fire is skipped, F2.3+ read the honest reds"); }
  const f2toast = await toastOf();
  ok("F2.3 the adoption receipt spoke (the selection as the new provider)", f2toast.n > 0 && /re-wired|adopted|select/i.test(f2toast.texts.join(" | ")), (f2toast.titles[0] || "none").slice(0, 60));
  let mint = null;
  for (let i = 0; i < 12; i++) {
    await zzz(1);
    const js = await jobsOf();
    /* t1183: the find demands the mint's own birthmark — a numeric
     * selectedClasses baked at birth (the ghost's "auto" child was a
     * select2d too, and the loose find crowned it) */
    mint = js.find((j) => j.type === "select2d" && j.id !== c1.id && /^\d+[\d, ]*$/.test(j.params?.selectedClasses || ""));
    if (mint) break;
  }
  ok("F2.4 THE MINT: a 2D Class Selection born with the gained classes baked", !!mint && /^\d+[\d, ]*$/.test(mint.params?.selectedClasses || ""), `id=${mint?.id?.slice(-6)} selectedClasses="${mint?.params?.selectedClasses}"`);
  const f2edges = await edgesSettle((e) => e.filter((x) => x.fromJobId === B.id && x.toJobId === mint?.id).length >= 2);
  const mintMouths = f2edges.filter((e) => e.fromJobId === B.id && e.toJobId === mint?.id).length;
  ok("F2.5 THE WIRE: run B feeds the mint through BOTH mouths (classes + particles)", mintMouths >= 2, `B->mint edges=${mintMouths}`);
  ok("F2.6 THE ADOPT: run A's child re-parented onto the MINT", mint && hasEdge(f2edges, mint.id, c1.id) && !hasEdge(f2edges, A.id, c1.id), `mint->child=${mint ? hasEdge(f2edges, mint.id, c1.id) : false} A->child=${hasEdge(f2edges, A.id, c1.id)}`);

  /* ---- FLIGHT 3: the exclude rider (mint + wire + adopt, micrograph dialect) ---- */
  console.log("\n  FLIGHT 3 — the exclude rider (mint the filter, wire, adopt)");
  await closeAnyCompare();
  const f3 = await openCompare(/^Motion Correction/, "Motion");
  ok("F3.1 the Motion A/B door found (1 sibling)", f3.door?.found === true, `found=${f3.door?.found}`);
  const f3ex = await riderReady("adopt-with-exclude");
  const f3selPresent = evalJson('(() => JSON.stringify({ p: !!document.querySelector("[data-testid=\\"adopt-with-select\\"]") }))()').p;
  ok("F3.2 the exclude rider PRESENT and ENABLED (the paired fetch landed — the rider's own ready signal, not the always-open verdict region)", f3ex.present === true && f3ex.disabled === false, riderVerdict(f3ex, "exclude"));
  ok("F3.3 the select rider ABSENT (the motion verdict has no classes to select)", f3selPresent === false);
  if (f3ex.disabled === false) {
    evalSoft('(() => { document.querySelector("[data-testid=\\"adopt-with-exclude\\"]").click(); return 1; })()');
  } else { console.log("    the gate held — the fire is skipped, F3.4+ read the honest reds"); }
  const f3toast = await toastOf();
  ok("F3.4 the adoption receipt spoke (the filter as the new provider)", f3toast.n > 0 && /re-wired|adopted|exclud/i.test(f3toast.texts.join(" | ")), (f3toast.titles[0] || "none").slice(0, 60));
  let filter = null;
  for (let i = 0; i < 12; i++) {
    await zzz(1);
    const js = await jobsOf();
    filter = js.find((j) => j.type === "excludemg" && j.id !== exJob.id && /mic_\d+/.test(j.params?.excludeNames || ""));
    if (filter) break;
  }
  ok("F3.5 THE MINT: an Exclude Micrographs filter born with the regressions baked", !!filter && /mic_\d+/.test(filter.params?.excludeNames || ""), `id=${filter?.id?.slice(-6)} excludeNames="${(filter?.params?.excludeNames || "").slice(0, 60)}"`);
  const f3edges = await edgesSettle((e) => !!filter && hasEdge(e, MB.id, filter.id) && hasEdge(e, filter.id, CTF.id));
  ok("F3.6 THE WIRE + THE ADOPT: run B feeds the filter; CTF now consumes the FILTER", filter && hasEdge(f3edges, MB.id, filter.id) && hasEdge(f3edges, filter.id, CTF.id) && !hasEdge(f3edges, MA.id, CTF.id), `B->filter=${filter ? hasEdge(f3edges, MB.id, filter.id) : false} filter->ctf=${filter ? hasEdge(f3edges, filter.id, CTF.id) : false} A->ctf=${hasEdge(f3edges, MA.id, CTF.id)}`);

  /* ---- the honest absence: run A spent, the door says so ---- */
  await closeAnyCompare();
  const f4d = await openCompare(/^2D Classification/, "Class");
  const f4 = await riderReady("adopt-downstream", { want: "disabled" });
  ok("F4 the spent run speaks the honest disabled state (no downstream left)", f4.present === true && f4.disabled === true && /no downstream/i.test(f4.label || ""), riderVerdict(f4, "spent"));
  await closeAnyCompare();
}
} /* the flights chunk's gate */

/* ================= PHASE 3 — the teardown (the teardown chunk) ====== */
if (inChunk("teardown")) {
console.log("\nPhase 3 — the teardown (the spent world leaves no residue)");
if (!sandboxId) {
  const sb = await findSandbox();
  sandboxId = sb?.id ?? null;
}
if (!tutorialProjectId) {
  tutorialProjectId = ((api("GET", "/api/projects").projects || []).find((p) => /tutorial/i.test(p.name || "")) || {}).id;
}
if (!sandboxId) {
  ok("T1 the sandbox already gone (a prior teardown's work)", true, "nothing to delete");
} else {
const del = api("DELETE", `/api/projects/${sandboxId}`);
ok("T1 the sandbox deleted (live runs stopped, jobs and edges removed)", !del.error && !del.raw?.includes("error"), del.raw ? String(del.raw).slice(0, 60) : "ok");
}
/* the switch target comes from the CURRENT projects list — the name-derived
 * id captured at P2 could be stale if a prior ride's sandbox masqueraded */
const projsT = api("GET", "/api/projects");
const tProj = (projsT.projects || []).find((p) => /tutorial/i.test(p.name || "")) || { id: tutorialProjectId };
const sw = api("POST", "/api/projects/switch", { id: tProj.id });
ok("T2 the tutorial project active again", !sw.error && !!tProj.id, tProj.name || tProj.id);
const demoAfter = await settledJobs((js) => js.length === 15 && js.filter((j) => j.status === "completed").length === 13 && js.every((j) => j.status === "completed" || j.status === "idle"));
ok("T3 the demo world untouched: the standing 13/2 shape holds", demoAfter.length === 15 && demoAfter.filter((j) => j.status === "completed").length === 13, `jobs=${demoAfter.length} completed=${demoAfter.filter((j) => j.status === "completed").length}`);

/* the browser back on the demo world, the seed cleared */
const t4 = await openAndDress(14);
evalSoft('(() => { localStorage.removeItem("cryoflow.selectedJob.v1"); return 1; })()');
ok("T4 the browser rides the demo world again (15 cards, bare)", t4 && t4.dlgs === 0 && t4.cards >= 14, `cards=${t4?.cards}`);
} /* the teardown chunk's gate */

console.log(`\nADOPTION-VERBS t887 [${CHUNK}]: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

/* the receipt MERGES by chunk — a chunked film's receipt carries every
 * chunk's checks; a re-run chunk rewrites only its own key */
const receiptPath = join(ROOT, "shots-qa", "t887-adoption-verbs.json");
let prior = null;
try { prior = JSON.parse(readFileSync(receiptPath, "utf8")); } catch { /* first chunk */ }
const thisChunk = { chunk: CHUNK, at: new Date().toISOString(), checks: results, pass, fail };
const chunks = [...((prior && prior.chunks) || []).filter((c) => c.chunk !== CHUNK), thisChunk];
const totPass = chunks.reduce((n, c) => n + (c.pass || 0), 0);
const totFail = chunks.reduce((n, c) => n + (c.fail || 0), 0);
const receipt = {
  task: "t887",
  window: "cron 2026-11-03/04 (Job 362852), the chunked film (t1172)",
  purpose: "the compare family's adoption verbs filmed: the plain adopt, the select rider (mint + wire both mouths + adopt), the exclude rider (the subset run's real regressions baked) — each with the receipt toast and the graph truth via the API; the throwaway world spent and deleted; the demo untouched",
  chunk: CHUNK,
  chunks,
  totals: { pass: totPass, fail: totFail },
  sandboxId, tutorialProjectId, excludeName,
  counts: { templateJobs: tplJobs?.length ?? null, sandboxJobs: sandboxJobs.length, excludeName },
};
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(`receipt: shots-qa/t887-adoption-verbs.json (film totals: ${totPass} pass / ${totFail} fail across ${chunks.length} chunks)`);
process.exit(fail === 0 ? 0 : 1);

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
 * the jobs and edges), switch back to the tutorial project, verify 15/15 —
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

console.log("t887 — the adoption verbs, filmed on a throwaway world: mint + wire + adopt, three round trips per verb\n");

/* ================= PHASE 0 — the pre-flight ================= */
console.log("Phase 0 — pre-flight");

/* P1 — the ACTIVE project must be the tutorial BEFORE any world read: a
 * crashed prior ride can leave the sandbox active (its jobs then masquerade
 * as "the world" — the first ride's P2 captured the sandbox id and the
 * teardown nearly switched to a deleted project). The tutorial is found by
 * NAME in the projects list, switched active, THEN read. */
const projsP1 = api("GET", "/api/projects");
const tutorialProj = (projsP1.projects || []).find((p) => /tutorial/i.test(p.name || ""));
if (tutorialProj && !tutorialProj.active) {
  api("POST", "/api/projects/switch", { id: tutorialProj.id });
  await zzz(2);
}
const demoJobs = await jobsOf();
ok("P1 the demo world is 15/15 completed (and active)", demoJobs.length === 15 && demoJobs.every((j) => j.status === "completed") && !!tutorialProj?.active, `jobs=${demoJobs.length} active=${tutorialProj?.name || "?"}`);
const tutorialProjectId = tutorialProj?.id;
ok("P2 the tutorial project captured (by name, not by active-guess)", !!tutorialProjectId, `id=${tutorialProjectId}`);

const projs0 = api("GET", "/api/projects");
const stale = (projs0.projects || []).filter((p) => (p.name || "").includes("t887-adoption"));
for (const s of stale) {
  console.log(`    stale sandbox ${s.id} from a crashed ride — deleting`);
  api("DELETE", `/api/projects/${s.id}`);
}
ok("P3 no leftover t887 sandbox", stale.length === 0, `removed=${stale.length}`);

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
const det = api("GET", "/api/system?force=1");
const dstat = det.status || det;
ok("P4 the compute lane detected (the mock stubs as the local RELION install)", dstat.found === true && String(dstat.path || "").includes("relion-install"), `stubs=${stubs} found=${dstat.found} path=${dstat.path}`);

/* ================= PHASE 1 — the throwaway world ================= */
console.log("\nPhase 1 — the throwaway world");

const created = api("POST", "/api/projects", { name: "t887-adoption-throwaway" });
const sandboxId = created.project?.id;
ok("W1 the sandbox project created (set active)", !!sandboxId, `id=${sandboxId}`);

const tpl = api("POST", "/api/pipeline-template", {});
const tplJobs = tpl.jobs || [];
const tplEdges = tpl.edges || [];
ok("W2 the template chain created", tplJobs.length === 10 && tplEdges.length === 13, `jobs=${tplJobs.length} edges=${tplEdges.length} (the template's own 13-wire chain)`);
const byType = {};
for (const j of tplJobs) byType[j.type] = j;

/* the import needs the EMPIAR lane (the tutorial's own door) */
api("PATCH", `/api/jobs/${byType.import.id}`, { params: { nodeType: "movies", empiarData: "true" } });

console.log("    running the template chain (SEQUENTIAL — the template's jobs are born idle, and the cascade only fires PENDING downstream)…");
const chainOrder = ["import", "motioncorr", "ctffind", "autopick", "extract", "class2d", "initialmodel", "refine3d", "maskcreate", "postprocess"];
let chainBad = [];
for (const t of chainOrder) {
  api("POST", `/api/jobs/${byType[t].id}/run`);
  const w = await waitJobs([byType[t].id], "completed", 240);
  if (w.done !== 1) { chainBad.push(`${t}:${w.bad.join(",") || "timeout"}`); break; }
}
ok("W3 the template chain completed (each stage run in RELION order)", chainBad.length === 0, chainBad.length ? chainBad.join(" | ") : "10/10");

/* the movies star on disk — the exclude name comes from REAL rows */
const projDir = join(ROOT, "data", "relion", sandboxId);
const impDir = readdirSync(projDir).find((d) => d.startsWith("import_"));
const starPath = join(projDir, impDir, "micrographs.star");
const starTxt = existsSync(starPath) ? readFileSync(starPath, "utf8") : "";
const movieNames = Array.from(starTxt.matchAll(/micrographs\/(mic_\d+\.mrc)/g)).map((m) => m[1]);
const excludeName = movieNames.length >= 4 ? movieNames[3] : null;
ok("W4 the import's movies star read from disk, an exclude name picked", !!excludeName, `movies=${movieNames.length} pick=${excludeName}`);

/* the side world: import -> excludemg -> motioncorrB (the subset run) */
const exPlace = { x: byType.motioncorr.x + 40, y: byType.motioncorr.y + 260 };
const exJob = api("POST", "/api/jobs", { type: "excludemg", x: exPlace.x, y: exPlace.y, params: { excludeNames: excludeName } }).job;
const mcB = api("POST", "/api/jobs", { type: "motioncorr", x: exPlace.x + 300, y: exPlace.y }).job;
const impEdge = tplEdges.find((e) => e.fromJobId === byType.import.id && e.toJobId === byType.motioncorr.id);
const edgeDefs = [
  { id: newId(), fromJobId: byType.import.id, toJobId: exJob.id, fromPort: impEdge.fromPort, toPort: "micrographs" },
  { id: newId(), fromJobId: exJob.id, toJobId: mcB.id, fromPort: "micrographs", toPort: impEdge.toPort },
];
let edgesOk = true;
for (const def of edgeDefs) {
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
const B = api("POST", "/api/jobs", { type: "class2d", x: byType.class2d.x + 300, y: byType.class2d.y + 260, params: { numClasses: 10 } }).job;
const bEdge = api("POST", "/api/edges", { id: newId(), fromJobId: byType.extract.id, toJobId: B.id, fromPort: "particles", toPort: "particles" });
ok("W6 the class2d twin wired off the extract (K=10 — real gains, both mouths feedable)", !!B?.id && !bEdge.error, `B=${B?.id?.slice(-6)} K=10`);

console.log("    running the side world…");
api("POST", `/api/jobs/${exJob.id}/run`);
const exWait = await waitJobs([exJob.id], "completed", 60);
api("POST", `/api/jobs/${mcB.id}/run`);
const mcBWait = await waitJobs([mcB.id], "completed", 120);
api("POST", `/api/jobs/${B.id}/run`);
const bWait = await waitJobs([B.id], "completed", 180);
ok("W7 the side world completed (filter, subset MotionCorr, K=10 class2d)", exWait.done === 1 && mcBWait.done === 1 && bWait.done === 1, `filter=${exWait.done} mcB=${mcBWait.done} class2dB=${bWait.done}`);

const sandboxJobs = await jobsOf();
const completedSandbox = sandboxJobs.filter((j) => j.status === "completed").length;
ok("W8 the throwaway world stands: every job completed", sandboxJobs.length === 13 && completedSandbox === sandboxJobs.length, `jobs=${sandboxJobs.length} completed=${completedSandbox}`);

/* the ids the walk needs */
const A = byType.class2d, MA = byType.motioncorr, MB = mcB, CTF = byType.ctffind;

/* ================= PHASE 2 — the browser walk ================= */
console.log("\nPhase 2 — the browser walk (the three flights)");

ab(`open ${BASE}/?t=${Date.now()}`);
let dress = null;
for (let i = 0; i < 60; i++) {
  zzz(1);
  dress = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const cards = document.querySelectorAll("[data-card-btn]").length; return JSON.stringify({ dlgs: dgs, cards }); })()');
  if (dress.dlgs === 0 && dress.cards >= 12) break;
}
evalJson('(() => { localStorage.removeItem("cryoflow.selectedJob.v1"); return 1; })()');
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
  evalJson(`(() => { document.querySelector("[aria-label^=\\"${label} A/B\\"]").click(); return 1; })()`);
  let dlg = null;
  for (let i = 0; i < 15; i++) {
    zzz(1);
    dlg = evalJson('(() => { const r = document.querySelector("[role=dialog] [role=region][aria-label*=verdict]"); return JSON.stringify({ open: !!r, text: r ? (r.textContent || "").slice(0, 260) : null }); })()');
    if (dlg.open) break;
  }
  return { door, dlg };
};

const closeAnyCompare = async () => {
  evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }); d.dispatchEvent(k); } return 1; })()');
  await zzz(1.5);
};

const toastOf = async () => {
  for (let i = 0; i < 16; i++) {
    await zzz(0.5);
    const t = evalJson('(() => { const ts = Array.from(document.querySelectorAll("[data-sonner-toast]")); return JSON.stringify({ n: ts.length, titles: ts.map((x) => ((x.querySelector("[data-title]") || x).textContent || "").slice(0, 80)), descs: ts.map((x) => (x.textContent || "").slice(0, 200)) }); })()');
    if (t.n > 0) return t;
  }
  return { n: 0, titles: [], descs: [] };
};

const edgesNow = () => api("GET", "/api/edges").edges || [];
const hasEdge = (edges, from, to) => edges.some((e) => e.fromJobId === from && e.toJobId === to);

/* ---- FLIGHT 1: the plain adopt on (class2d A -> class3d B) ---- */
console.log("\n  FLIGHT 1 — the plain adopt (Continue downstream from run B)");
const f1 = await openCompare(/^2D Classification/, "Class");
ok("F1.1 the Class A/B door found (1 sibling)", f1.door?.found === true && f1.door?.siblings === "1", `siblings=${f1.door?.siblings}`);
ok("F1.2 the compare dialog opened with the verdict region", f1.dlg?.open === true, (f1.dlg?.text || "").slice(0, 90));
const f1verbs = evalJson('(() => { const q = (t) => document.querySelector(`[data-testid="${t}"]`); const ad = q("adopt-downstream"); const as = q("adopt-with-select"); const ax = q("adopt-with-exclude"); return JSON.stringify({ adopt: ad ? { disabled: ad.disabled, label: (ad.textContent || "").trim().slice(0, 60) } : null, select: as ? { disabled: as.disabled, label: (as.textContent || "").trim().slice(0, 60) } : null, excludePresent: !!ax }); })()');
ok("F1.3 the plain adopt ENABLED with its move count", f1verbs.adopt && f1verbs.adopt.disabled === false, f1verbs.adopt?.label);
ok("F1.4 the select rider PRESENT and ENABLED (K=10 twin: every paired class gained)", f1verbs.select && f1verbs.select.disabled === false, f1verbs.select?.label);
ok("F1.5 the exclude rider ABSENT (the class verdict has no micrographs to exclude)", f1verbs.excludePresent === false);
evalJson('(() => { document.querySelector("[data-testid=\\"adopt-downstream\\"]").click(); return 1; })()');
const f1toast = await toastOf();
ok("F1.6 the adoption receipt spoke (the toast names the re-wire)", f1toast.n > 0 && /re-wired|adopted/i.test(f1toast.descs.join(" ")), (f1toast.titles[0] || "none").slice(0, 60));
let f1edges = [];
for (let i = 0; i < 10; i++) {
  await zzz(1);
  f1edges = edgesNow();
  if (hasEdge(f1edges, B.id, byType.initialmodel.id)) break;
}
ok("F1.7 THE GRAPH TRUTH: both template wires re-parented onto run B", hasEdge(f1edges, B.id, byType.initialmodel.id) && hasEdge(f1edges, B.id, byType.refine3d.id) && !hasEdge(f1edges, A.id, byType.initialmodel.id) && !hasEdge(f1edges, A.id, byType.refine3d.id), `B->initialmodel=${hasEdge(f1edges, B.id, byType.initialmodel.id)} B->refine3d=${hasEdge(f1edges, B.id, byType.refine3d.id)}`);

/* ---- FLIGHT 2: the select rider (mint + wire + adopt) ---- */
console.log("\n  FLIGHT 2 — the select rider (mint the selection, wire both mouths, adopt)");
const c1 = api("POST", "/api/jobs", { type: "select2d", x: A.x + 300, y: A.y + 260, params: {} }).job;
const c1edge = api("POST", "/api/edges", { id: newId(), fromJobId: A.id, toJobId: c1.id, fromPort: "particles", toPort: "particles" });
ok("F2.1 a fresh select2d child wired on run A (the re-wire target)", !!c1?.id && !c1edge.error, `child=${c1?.id?.slice(-6)}`);
await closeAnyCompare();
const f2 = await openCompare(/^2D Classification/, "Class");
const f2verbs = evalJson('(() => { const as = document.querySelector("[data-testid=\\"adopt-with-select\\"]"); return JSON.stringify({ present: !!as, disabled: as ? as.disabled : null, label: as ? (as.textContent || "").trim().slice(0, 70) : null }); })()');
ok("F2.2 the select rider ENABLED on the re-opened dialog (the plan re-derived)", f2verbs.present === true && f2verbs.disabled === false, f2verbs.label);
evalJson('(() => { document.querySelector("[data-testid=\\"adopt-with-select\\"]").click(); return 1; })()');
const f2toast = await toastOf();
ok("F2.3 the adoption receipt spoke (the selection as the new provider)", f2toast.n > 0 && /re-wired|adopted|select/i.test(f2toast.descs.join(" ")), (f2toast.titles[0] || "none").slice(0, 60));
let mint = null;
for (let i = 0; i < 12; i++) {
  await zzz(1);
  const js = await jobsOf();
  mint = js.find((j) => j.type === "select2d" && j.id !== c1.id);
  if (mint) break;
}
ok("F2.4 THE MINT: a 2D Class Selection born with the gained classes baked", !!mint && /^\d+[\d, ]*$/.test(mint.params?.selectedClasses || ""), `id=${mint?.id?.slice(-6)} selectedClasses="${mint?.params?.selectedClasses}"`);
const f2edges = edgesNow();
const mintMouths = f2edges.filter((e) => e.fromJobId === B.id && e.toJobId === mint?.id).length;
ok("F2.5 THE WIRE: run B feeds the mint through BOTH mouths (classes + particles)", mintMouths >= 2, `B->mint edges=${mintMouths}`);
ok("F2.6 THE ADOPT: run A's child re-parented onto the MINT", mint && hasEdge(f2edges, mint.id, c1.id) && !hasEdge(f2edges, A.id, c1.id), `mint->child=${mint ? hasEdge(f2edges, mint.id, c1.id) : false} A->child=${hasEdge(f2edges, A.id, c1.id)}`);

/* ---- FLIGHT 3: the exclude rider (mint + wire + adopt, micrograph dialect) ---- */
console.log("\n  FLIGHT 3 — the exclude rider (mint the filter, wire, adopt)");
await closeAnyCompare();
const f3 = await openCompare(/^Motion Correction/, "Motion");
ok("F3.1 the Motion A/B door found (1 sibling)", f3.door?.found === true, `found=${f3.door?.found}`);
const f3verbs = evalJson('(() => { const ax = document.querySelector("[data-testid=\\"adopt-with-exclude\\"]"); const as = document.querySelector("[data-testid=\\"adopt-with-select\\"]"); const reg = document.querySelectorAll("[data-testid=\\"adopt-with-exclude\\"]") ? (document.body.textContent || "").match(/Biggest regressions?/i) : null; return JSON.stringify({ exclude: ax ? { disabled: ax.disabled, label: (ax.textContent || "").trim().slice(0, 70) } : null, selectPresent: !!as }); })()');
ok("F3.2 the exclude rider PRESENT and ENABLED (the subset run grew real regressions)", f3verbs.exclude && f3verbs.exclude.disabled === false, f3verbs.exclude?.label);
ok("F3.3 the select rider ABSENT (the motion verdict has no classes to select)", f3verbs.selectPresent === false);
evalJson('(() => { document.querySelector("[data-testid=\\"adopt-with-exclude\\"]").click(); return 1; })()');
const f3toast = await toastOf();
ok("F3.4 the adoption receipt spoke (the filter as the new provider)", f3toast.n > 0 && /re-wired|adopted|exclud/i.test(f3toast.descs.join(" ")), (f3toast.titles[0] || "none").slice(0, 60));
let filter = null;
for (let i = 0; i < 12; i++) {
  await zzz(1);
  const js = await jobsOf();
  filter = js.find((j) => j.type === "excludemg" && j.id !== exJob.id);
  if (filter) break;
}
ok("F3.5 THE MINT: an Exclude Micrographs filter born with the regressions baked", !!filter && /mic_\d+/.test(filter.params?.excludeNames || ""), `id=${filter?.id?.slice(-6)} excludeNames="${(filter?.params?.excludeNames || "").slice(0, 60)}"`);
const f3edges = edgesNow();
ok("F3.6 THE WIRE + THE ADOPT: run B feeds the filter; CTF now consumes the FILTER", filter && hasEdge(f3edges, MB.id, filter.id) && hasEdge(f3edges, filter.id, CTF.id) && !hasEdge(f3edges, MA.id, CTF.id), `B->filter=${filter ? hasEdge(f3edges, MB.id, filter.id) : false} filter->ctf=${filter ? hasEdge(f3edges, filter.id, CTF.id) : false} A->ctf=${hasEdge(f3edges, MA.id, CTF.id)}`);

/* ---- the honest absence: run A spent, the door says so ---- */
await closeAnyCompare();
const f4 = await openCompare(/^2D Classification/, "Class");
const f4verbs = evalJson('(() => { const ad = document.querySelector("[data-testid=\\"adopt-downstream\\"]"); return JSON.stringify({ disabled: ad ? ad.disabled : null, title: ad ? ad.getAttribute("title") : null }); })()');
ok("F4 the spent run speaks the honest disabled state (no downstream left)", f4verbs.disabled === true && /no downstream/i.test(f4verbs.title || ""), f4verbs.title?.slice(0, 70));
await closeAnyCompare();

/* ================= PHASE 3 — the teardown ================= */
console.log("\nPhase 3 — the teardown (the spent world leaves no residue)");

const del = api("DELETE", `/api/projects/${sandboxId}`);
ok("T1 the sandbox deleted (live runs stopped, jobs and edges removed)", !del.error && !del.raw?.includes("error"), del.raw ? String(del.raw).slice(0, 60) : "ok");
/* the switch target comes from the CURRENT projects list — the name-derived
 * id captured at P2 could be stale if a prior ride's sandbox masqueraded */
const projsT = api("GET", "/api/projects");
const tProj = (projsT.projects || []).find((p) => /tutorial/i.test(p.name || "")) || { id: tutorialProjectId };
const sw = api("POST", "/api/projects/switch", { id: tProj.id });
ok("T2 the tutorial project active again", !sw.error && !!tProj.id, tProj.name || tProj.id);
const demoAfter = await jobsOf();
ok("T3 the demo world untouched: 15/15 completed", demoAfter.length === 15 && demoAfter.every((j) => j.status === "completed"), `jobs=${demoAfter.length}`);

/* the browser back on the demo world, the seed cleared */
ab(`open ${BASE}/?t=${Date.now()}`);
let t4 = null;
for (let i = 0; i < 60; i++) {
  zzz(1);
  t4 = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const cards = document.querySelectorAll("[data-card-btn]").length; return JSON.stringify({ dlgs: dgs, cards }); })()');
  if (t4.dlgs === 0 && t4.cards >= 14) break;
}
evalJson('(() => { localStorage.removeItem("cryoflow.selectedJob.v1"); return 1; })()');
ok("T4 the browser rides the demo world again (15 cards, bare)", t4 && t4.dlgs === 0 && t4.cards >= 14, `cards=${t4?.cards}`);

console.log(`\nADOPTION-VERBS t887: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t887",
  window: "cron 2026-11-02 17:05:40 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021705)",
  purpose: "the compare family's adoption verbs filmed: the plain adopt, the select rider (mint + wire both mouths + adopt), the exclude rider (the subset run's real regressions baked) — each with the receipt toast and the graph truth via the API; the throwaway world spent and deleted; the demo untouched",
  sandboxId, tutorialProjectId, excludeName,
  counts: { templateJobs: tplJobs.length, sandboxJobs: sandboxJobs.length, excludeName },
  checks: results, pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t887-adoption-verbs.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t887-adoption-verbs.json");
process.exit(fail === 0 ? 0 : 1);

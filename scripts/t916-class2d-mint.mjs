#!/usr/bin/env node
/**
 * t916 — the class2d mint: the world has NEVER carried a class2d job, so
 * the whole class2d results family (ClassAveragesTeaser, the occupancy
 * bars, the select2d gallery — the gallery IS the parameter) has never
 * been witnessed on a real run. The t915 law applies: the world lacks the
 * variable — MINT it through the REAL doors, nothing hand-planted:
 *
 *   import (already in the world, completed, 4 real mic001-004.mrc)
 *     → autopick  (POST /api/jobs {type:"autopick"} + edge import→autopick,
 *                  bare run → t317 → the project's Mock Cluster binding)
 *     → extract   (POST /api/jobs {type:"extract"} + edges autopick→extract
 *                  and import→extract, bare run → the Mock Cluster)
 *     → class2d   (POST /api/jobs {type:"class2d"} + edge extract→class2d,
 *                  EM dialect, K=4, 2 iterations — the mock's stub sleeps
 *                  0.9s/round; the assignment formula is (p*7+it)%K+1)
 *     → select2d  (POST /api/jobs {type:"select2d"} + edge class2d→select2d,
 *                  NEVER run — the gallery reads the upstream's /classes)
 *
 * THE AUDIT'S LAW this mint rides under (read before writing a line):
 * class2d ∉ BULK_TYPES (cleanup.ts: motioncorr/extract/polish only), so
 * the sync-back is NOT metadata-only — every product under the 16MB
 * key-file cap COMES HOME (the mock's classes.mrcs is ~KB; even the
 * 1MB half-maps land). The class gallery therefore answers from the LOCAL
 * mirror by design; the t355 remote fill (12s-TTL SSH round) is the lane
 * for real-world over-cap stacks. The witness's Act 2 exercises that lane
 * honestly by removing the mint's OWN local workdir (the mint owns the
 * artifact; the cluster fs holds the originals) — never by touching the
 * connection's caps.
 *
 * Verbs (the t913/t914/t915 mint contract — the manifest is the restore's
 * law):
 *   mint    build the chain, run it, verify the products, write manifest.json
 *   verify  re-check every manifest claim against the live world
 *   remove  delete the minted jobs (the hard door, downstream first),
 *           sweep the LOCAL workdirs by id suffix, sweep the MOCK-CLUSTER
 *           side the t915 remove missed (autopick_ejm3prp5 +
 *           extract_6kraftqq are still there — t915's restore swept the
 *           local tree only; this verb completes that restore too),
 *           verify the pre-state job count and the untouched binding
 *
 *   node scripts/t916-class2d-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const MANIFEST = path.join(process.cwd(), "data", "t916-class2d-mint.json");
const MOCK_PROJECTS = path.join(process.cwd(), "services", "mock-cluster", "fs", "projects", "cryoflow");
// the t915 orphans on the mock side (their jobs were deleted last window;
// the cluster half was the restore's missed leg — swept by THIS verb, only
// after the live world proves nothing references their id suffixes)
const T915_ORPHANS = ["autopick_ejm3prp5", "extract_6kraftqq"];

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim(); }
  catch (e) { return `ERR:${String(e.message).slice(0, 300)}`; }
};
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  const out = sh(cmd);
  try { return JSON.parse(out); } catch { return { error: out.slice(0, 200) }; }
};

const jobs = () => api("GET", "/api/jobs").jobs ?? [];
const findType = (t) => jobs().filter((j) => j.type === t);
const binding = () => {
  try {
    const reg = JSON.parse(readFileSync(path.join(process.cwd(), "data", "projects.json"), "utf8"));
    return reg.projects?.[reg.active]?.remote?.connectionId ?? null;
  } catch { return null; }
};

/** poll a job to a terminal state (the mock lane is fast; the cap is honest) */
async function pollUntil(jobId, want, timeoutMs = 240_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
}

const preCount = () => jobs().length;

/** t921 — the run lane: the resolved Mock Cluster body rides EVERY run
 *  explicitly (the resurrect precedent); a bare POST would take the LOCAL
 *  lane on an unbound world and the chain would die at the input gate. */
let REMOTE_BODY = null;
const runJob = (id) => api("POST", `/api/jobs/${id}/run`, REMOTE_BODY);

/** the mock stub's assignment law: row p (0-based among @-rows) lands in
 *  class ((p*7 + it) % K) + 1 of iteration it. The EXPECTED occupancy is
 *  computed from the input star's own row count — the instrument measures
 *  the law, never its author's memory (the t915 lesson). */
function expectedOccupancy(inputStarPath, K, iterations) {
  let rows = 0;
  const text = readFileSync(inputStarPath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("_") || t.startsWith("#") || t.startsWith("data_") || t === "loop_") continue;
    if (/@/.test(t.split(/\s+/)[0] ?? "")) rows++;
  }
  const perIter = {};
  for (const it of iterations) {
    const counts = Object.fromEntries(Array.from({ length: K }, (_, i) => [i + 1, 0]));
    for (let p = 0; p < rows; p++) counts[((p * 7 + it) % K) + 1] += 1;
    perIter[String(it)] = counts;
  }
  return { rows, perIter };
}

// ---- the world guards (the t914/t915 lessons, both applied) ----------------
/** t921 — the Mock Cluster resolves BY NAME, not by a hard-coded id: the
 *  world re-seeds and the connection's id re-keys with it (conn-mv3y5x8f
 *  was ONE world's binding, not a law). Missing? Create it — the same
 *  shape demo-chain-resurrect.mjs has always used (the seed's designed
 *  stand-in cluster). The binding assert then follows the resolved id. */
function mockClusterConn() {
  const conns = api("GET", "/api/remote/connections").connections ?? [];
  let conn = conns.find((c) => c.name === "Mock Cluster");
  if (conn) return { conn, created: false };
  const mk = api("POST", "/api/remote/connections", {
    name: "Mock Cluster",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: "/projects/cryoflow",
    useSlurm: true,
    defaultModule: "relion/5.0.1",
  });
  return { conn: mk.connection ?? mk.job ?? null, created: true };
}
function guards() {
  ok("guard: server answers", Array.isArray(jobs()));
  const stale = [...findType("autopick"), ...findType("extract"), ...findType("class2d"), ...findType("select2d")]
    .filter((j) => (j.name ?? "").includes("t916"));
  ok("guard: no stale t916 mints", stale.length === 0,
    stale.length ? `${stale.length} stale — run remove first` : "");
  if (stale.length) { console.log("FATAL: singular-world guard — remove first"); process.exit(2); }
  const imports = findType("import").filter((j) => j.status === "completed");
  ok("guard: a completed import exists (the chain's root)", imports.length >= 1);
  const { conn, created } = mockClusterConn();
  ok("guard: Mock Cluster connection present", !!conn?.id, `${created ? "created" : "reused"} ${conn?.id?.slice(0, 14) ?? "NONE"}`);
  if (!conn?.id) { console.log("FATAL: no Mock Cluster connection — cannot ride"); process.exit(2); }
  // t921 — the BINDING is not required: a fresh world has none, and the
  // mint's runs carry the remote body EXPLICITLY (the demo-chain-resurrect
  // shape) — the product's own run door, no registry surgery. A world that
  // IS bound still rides the same lane (the body matches the binding).
  ok("guard: the project's binding (informational)", true, `binding=${binding() ?? "none — runs carry the remote body explicitly"}`);
  REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };
  if (fail > 0) { console.log("FATAL: guards failed — the mint refuses to ride"); process.exit(2); }
  return imports[0];
}

// ---- mint -----------------------------------------------------------------
async function mint() {
  console.log("== t916 class2d mint — mint ==");
  const root = guards();
  const before = preCount();
  console.log(`  pre-state: ${before} jobs; chain root: import ${root.id.slice(-8)} "${root.name}"`);

  // 1. autopick node + edge import→autopick
  const pick = api("POST", "/api/jobs", { type: "autopick", name: "t916 pick witness" });
  ok("autopick node created", !!pick.job?.id, pick.job?.id?.slice(-8));
  if (!pick.job?.id) process.exit(2);
  const e1 = api("POST", "/api/edges", { fromJobId: root.id, toJobId: pick.job.id });
  ok("edge import→autopick", !e1.error, JSON.stringify(e1).slice(0, 120));

  // 2. bare run
  const r1 = runJob(pick.job.id);
  ok("autopick run accepted", !r1.error, r1.error ?? r1.job?.status);
  const pickDone = await pollUntil(pick.job.id);
  ok("autopick completed", pickDone.status === "completed", `status=${pickDone.status} ${String(pickDone.result ?? "").slice(0, 90)}`);
  if (pickDone.status !== "completed") { console.log("FATAL: autopick did not complete — remove and inspect"); process.exit(2); }

  // 3. extract node + edges
  const ex = api("POST", "/api/jobs", { type: "extract", name: "t916 extract witness" });
  ok("extract node created", !!ex.job?.id, ex.job?.id?.slice(-8));
  if (!ex.job?.id) process.exit(2);
  const e2 = api("POST", "/api/edges", { fromJobId: pick.job.id, toJobId: ex.job.id });
  ok("edge autopick→extract", !e2.error, JSON.stringify(e2).slice(0, 120));
  const e3 = api("POST", "/api/edges", { fromJobId: root.id, toJobId: ex.job.id });
  ok("edge import→extract", !e3.error, JSON.stringify(e3).slice(0, 120));

  // 4. bare run
  const r2 = runJob(ex.job.id);
  ok("extract run accepted", !r2.error, r2.error ?? r2.job?.status);
  const exDone = await pollUntil(ex.job.id);
  ok("extract completed", exDone.status === "completed", `status=${exDone.status} ${String(exDone.result ?? "").slice(0, 90)}`);
  if (exDone.status !== "completed") { console.log("FATAL: extract did not complete — remove and inspect"); process.exit(2); }

  // 5. the expected occupancy, computed from the extract's OWN star
  const exOuts = api("GET", `/api/jobs/${ex.job.id}/outputs`);
  ok("extract outputs listing ok", exOuts.status === "ok", exOuts.workdir ?? "no workdir");
  const particlesStar = path.join(exOuts.workdir, "particles.star");
  ok("extract particles.star home", existsSync(particlesStar));
  const K = 4, ITERS = [1, 2];
  const expect = expectedOccupancy(particlesStar, K, ITERS);
  ok("expected occupancy computed from the input star", expect.rows > 0, `${expect.rows} input rows · it002 map ${JSON.stringify(expect.perIter["2"])}`);

  // 6. class2d node + edge extract→class2d; EM dialect, K=4, 2 iterations
  const c2d = api("POST", "/api/jobs", {
    type: "class2d",
    name: "t916 class2d witness",
    params: { algorithm: "em", iterations: 2, numClasses: K },
  });
  ok("class2d node created", !!c2d.job?.id, c2d.job?.id?.slice(-8));
  if (!c2d.job?.id) process.exit(2);
  const e4 = api("POST", "/api/edges", { fromJobId: ex.job.id, toJobId: c2d.job.id });
  ok("edge extract→class2d", !e4.error, JSON.stringify(e4).slice(0, 120));

  // 7. bare run — the mock sleeps 0.9s/round + startup; the cap is honest
  const r3 = runJob(c2d.job.id);
  ok("class2d run accepted", !r3.error, r3.error ?? r3.job?.status);
  const c2dDone = await pollUntil(c2d.job.id, null, 300_000);
  ok("class2d completed", c2dDone.status === "completed", `status=${c2dDone.status} ${String(c2dDone.result ?? "").slice(0, 140)}`);
  if (c2dDone.status !== "completed") { console.log("FATAL: class2d did not complete — remove and inspect"); process.exit(2); }

  // 8. verify the products — the non-bulk law's face: EVERYTHING comes home
  const outs = api("GET", `/api/jobs/${c2d.job.id}/outputs`);
  ok("class2d outputs listing ok", outs.status === "ok", outs.workdir ? String(outs.workdir).replace(process.cwd() + "/", "") : "no workdir");
  const files = outs.files ?? [];
  const classesStack = files.find((f) => /^run_it\d+_classes\.mrcs$/i.test(f.name));
  ok("class-averages stack in the listing (local)", !!classesStack && !classesStack.remote, classesStack?.name ?? "missing");
  const dataStars = files.filter((f) => /^run_it\d+_data\.star$/i.test(f.name));
  ok("per-iteration data stars came home", dataStars.length >= ITERS.length, dataStars.map((f) => f.name).join(", "));
  const classStars = files.filter((f) => /^particles_class\d+\.star$/i.test(f.name));
  ok("per-class stars home (the finalize-time split rode the .star policy)", classStars.length === K, classStars.map((f) => f.name).join(", "));
  const remoteTiles = files.filter((f) => f.remote);
  ok("NOTHING stayed remote (class2d is not a bulk producer)", remoteTiles.length === 0, remoteTiles.length ? remoteTiles.map((f) => f.name).join(", ") : "all local");
  ok("the receipt speaks the populated/K phrase", /classes populated/.test(String(c2dDone.result ?? "")), String(c2dDone.result ?? "").slice(0, 120));

  // 9. the classes route — occupancy measured against the LAW (the formula)
  const cls = api("GET", `/api/jobs/${c2d.job.id}/classes`);
  ok("classes route answers", !cls.error && Array.isArray(cls.classes), `total=${cls.total} iteration=${cls.iteration}`);
  ok("classesFile named (the mirror holds the stack)", !!cls.classesFile, cls.classesFile ?? "null");
  ok("classesSlices = K (the stack's nz)", cls.classesSlices === K, `slices=${cls.classesSlices}`);
  ok("iteration = the highest data star (2)", cls.iteration === 2, `iter=${cls.iteration}`);
  ok("total = the input star's row count", cls.total === expect.rows, `total=${cls.total} vs ${expect.rows}`);
  const got = Object.fromEntries((cls.classes ?? []).map((c) => [c.cls, c.count]));
  ok("occupancy matches the (p*7+it)%K+1 law exactly", JSON.stringify(got) === JSON.stringify(expect.perIter["2"]),
    `got ${JSON.stringify(got)} want ${JSON.stringify(expect.perIter["2"])}`);

  // 10. select2d node + edge class2d→select2d (NEVER run — the gallery reads
  // the upstream's /classes; the gallery IS the parameter)
  const sel = api("POST", "/api/jobs", { type: "select2d", name: "t916 select witness" });
  ok("select2d node created", !!sel.job?.id, sel.job?.id?.slice(-8));
  if (!sel.job?.id) process.exit(2);
  const e5 = api("POST", "/api/edges", { fromJobId: c2d.job.id, toJobId: sel.job.id });
  ok("edge class2d→select2d", !e5.error, JSON.stringify(e5).slice(0, 120));

  // 11. the mock-side class2d workdir (Act 2's original + the remove's sweep)
  const projectId = (outs.workdir ?? "").match(/data[\/\\]relion[\/\\]([^\/\\]+)/)?.[1] ?? null;
  const c2dSuffix = c2d.job.id.slice(-8);
  const mockC2dDir = projectId ? path.join(MOCK_PROJECTS, projectId, `class2d_${c2dSuffix}`) : null;
  ok("mock-cluster side holds the class2d workdir (the original)", !!mockC2dDir && existsSync(mockC2dDir), mockC2dDir ? String(mockC2dDir).replace(process.cwd() + "/", "") : "unknown project");

  // 12. the restore's law — write the manifest
  mkdirSync(path.dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    writtenAt: new Date().toISOString(),
    preJobs: before,
    binding: binding(),
    root: { id: root.id, name: root.name },
    pick: { id: pick.job.id, name: pick.job.name },
    extract: { id: ex.job.id, name: ex.job.name },
    class2d: { id: c2d.job.id, name: c2d.job.name },
    select2d: { id: sel.job.id, name: sel.job.name },
    workdirs: { extract: exOuts.workdir ?? null, class2d: outs.workdir ?? null },
    mockSide: { projectId, class2d: mockC2dDir },
    K, iterations: ITERS,
    expect: { rows: expect.rows, perIter: expect.perIter },
    classesFile: cls.classesFile ?? null,
  }, null, 2));
  console.log(`  manifest written: ${MANIFEST}`);
  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---- verify ---------------------------------------------------------------
function verify() {
  console.log("== t916 class2d mint — verify ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to verify"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const list = jobs();
  ok("class2d job alive", list.some((j) => j.id === m.class2d.id && j.type === "class2d"));
  ok("select2d job alive (idle, never run)", list.some((j) => j.id === m.select2d.id && j.type === "select2d" && j.status === "idle"));
  ok("extract + autopick alive", list.some((j) => j.id === m.extract.id) && list.some((j) => j.id === m.pick.id));
  ok("import root alive", list.some((j) => j.id === m.root.id));
  ok("job count matches pre-state + 4", list.length === m.preJobs + 4, `${list.length} vs ${m.preJobs}+4`);
  const cls = api("GET", `/api/jobs/${m.class2d.id}/classes`);
  ok("classes route still answers", cls.classesSlices === m.K && cls.total === m.expect.rows, `total=${cls.total} slices=${cls.classesSlices}`);
  const got = Object.fromEntries((cls.classes ?? []).map((c) => [c.cls, c.count]));
  ok("occupancy still matches the law", JSON.stringify(got) === JSON.stringify(m.expect.perIter["2"]), JSON.stringify(got));
  ok("local class2d workdir present", !!m.workdirs.class2d && existsSync(m.workdirs.class2d));
  ok("mock-side class2d workdir present", !!m.mockSide.class2d && existsSync(m.mockSide.class2d));
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---- remove ---------------------------------------------------------------
function sweepLocal(m, suffixes, typeRe) {
  const base = path.join(process.cwd(), "data", "relion");
  try {
    for (const proj of readdirSync(base)) {
      for (const dir of readdirSync(path.join(base, proj))) {
        if (suffixes.some((s) => dir.endsWith(s)) && typeRe.test(dir)) {
          const p = path.join(base, proj, dir);
          try { rmSync(p, { recursive: true, force: true }); console.log(`  rm ${path.relative(process.cwd(), p)}`); }
          catch (e) { console.log(`  ✗ rm failed for ${p}: ${e.message}`); fail++; }
        }
      }
    }
  } catch { /* the base may not exist — nothing to sweep */ }
  for (const wd of [m.workdirs?.extract, m.workdirs?.class2d]) {
    if (wd && existsSync(wd)) {
      try { rmSync(wd, { recursive: true, force: true }); console.log(`  rm ${wd.replace(process.cwd() + "/", "")}`); }
      catch (e) { console.log(`  ✗ rm failed for ${wd}: ${e.message}`); fail++; }
    }
  }
}

function sweepMockSide(m, entries) {
  if (!existsSync(MOCK_PROJECTS)) return;
  for (const proj of readdirSync(MOCK_PROJECTS)) {
    const projDir = path.join(MOCK_PROJECTS, proj);
    for (const dir of readdirSync(projDir)) {
      if (!entries.some(([typeRe, suffix]) => typeRe.test(dir) && dir.endsWith(suffix))) continue;
      const p = path.join(projDir, dir);
      try { rmSync(p, { recursive: true, force: true }); console.log(`  rm (cluster) ${path.relative(process.cwd(), p)}`); }
      catch (e) { console.log(`  ✗ rm (cluster) failed for ${p}: ${e.message}`); fail++; }
    }
  }
}

function remove() {
  console.log("== t916 class2d mint — remove ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to remove"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  // downstream first: the select2d dies before its class2d feed, the
  // class2d before its extract feed
  for (const [label, id] of [["select2d", m.select2d?.id], ["class2d", m.class2d?.id], ["extract", m.extract?.id], ["autopick", m.pick?.id]]) {
    if (!id) continue;
    const d = api("DELETE", `/api/jobs/${id}`);
    ok(`${label} job deleted (the hard door)`, !d.error, JSON.stringify(d).slice(0, 80));
  }
  // workdir leftovers — the t915 lesson: the poll DTO carries NO workdir,
  // so sweep BOTH type dirs by the minted jobs' id suffixes (local), then
  // the manifest's entries as the belt-and-braces second pass.
  const suffixes = [m.class2d?.id, m.select2d?.id, m.extract?.id, m.pick?.id].filter(Boolean).map((id) => id.slice(-8));
  sweepLocal(m, suffixes, /^(autopick_|extract_|class2d_|select2d_)/);
  // THE CLUSTER SIDE — the leg t915's restore missed. The mock's fs holds
  // the originals (metadata-only sync left the extract stacks there BY
  // DESIGN; DELETE leaves cluster files alone BY DESIGN — remote-cleanup
  // is the separate door). The mint's restore law is stricter: leave NO
  // trace of the mint anywhere. Sweep this mint's three remote workdirs,
  // THEN the t915 orphans — only after the live world proves nothing
  // references their id suffixes (the jobs died last window).
  const list = jobs();
  const orphanUnreferenced = T915_ORPHANS.every((name) => {
    const suffix = name.split("_")[1];
    return !list.some((j) => j.id.endsWith(suffix));
  });
  ok("t915 orphans unreferenced by the live world", orphanUnreferenced, T915_ORPHANS.join(", "));
  if (orphanUnreferenced) {
    sweepMockSide(m, [
      [/^autopick_/, m.pick?.id?.slice(-8) ?? "____"],
      [/^extract_/, m.extract?.id?.slice(-8) ?? "____"],
      [/^class2d_/, m.class2d?.id?.slice(-8) ?? "____"],
      [/^autopick_/, "ejm3prp5"],
      [/^extract_/, "6kraftqq"],
    ]);
  }
  const after = jobs();
  ok("world restored: pre-state job count", after.length === m.preJobs, `${after.length} vs ${m.preJobs}`);
  ok("no t916 residue", after.every((j) => !(j.name ?? "").includes("t916")));
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  rmSync(MANIFEST, { force: true });
  console.log(`== remove ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

const verb = process.argv[2];
if (verb === "mint") await mint();
else if (verb === "verify") verify();
else if (verb === "remove") remove();
else { console.log("usage: t916-class2d-mint.mjs mint|verify|remove"); process.exit(1); }

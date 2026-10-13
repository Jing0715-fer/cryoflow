#!/usr/bin/env node
/**
 * t952 — the CLASS WORLD mint (mint|verify|remove): the multi-input
 * class graph the select rider's live twin rides. The t949 mint
 * preview's dup-skip law has an exclude-side live twin (the wired child
 * AP moved onto the filter, the both-wires law through the mint's
 * fire); the SELECT side has never had a world where a child ALREADY
 * consumes the sibling (run B) through a matching port pair — the t929
 * world hung its children off the host and left the sibling
 * childless. This mint grows that world:
 *
 *   seed import → autopick → extract (the t951 shape, the particles)
 *     extract → class2d A  "2D Classification 1 (t952)"  K=4, 2 iters
 *              (the stub's (p*7+it)%K+1 law → every class total/4)
 *     extract → class2d B  "2D Classification 2 (t952)"  K=3, 2 iters
 *              (every class total/3 — every PAIRED class gained)
 *     A.particles → X "Selection Consumer (t952)" ← B.particles TOO
 *              (THE MULTI-INPUT FACT through the particles mouth —
 *              the t949 cure's own seat: the old stand-in filed X under
 *              alreadyWired; the mint preview makes it MOVE)
 *     A.classAverages → C "Classes Consumer (t952)"
 *              (the classes mouth — the mint (a 2D Class Selection)
 *              declares ONE output, particles — C is the PORT REFUSAL)
 *
 *   The SPLIT FACE the world arms: the plain verb (planning against B)
 *   moves C and leaves X as is (the t948 wired clause, class-domain
 *   first); the select rider (the mint preview) moves X and refuses C
 *   (the t931 refusal clause, the t949 dup-skip count). One world,
 *   two fires, opposite per-child choices, each speech honest.
 *
 *   node scripts/t952-class-world-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const MANIFEST = path.join(process.cwd(), "data", "t952-class-world.json");
const MOCK_PROJECTS = path.join(process.cwd(), "services", "mock-cluster", "fs", "projects", "cryoflow");
const SUFFIX_TYPES = /^(autopick_|extract_|class2d_|select2d_)/;

const NAME_A = "2D Classification 1 (t952)";
const NAME_B = "2D Classification 2 (t952)";
const NAME_X = "Selection Consumer (t952)";
const NAME_C = "Classes Consumer (t952)";

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
// the t946 law: the API plane is armored against the dev server's own
// recompile windows — a refused read is noise, not a dead world. Retry.
const api = (method, url, body) => {
  for (let i = 0; i < 6; i++) {
    let out = null;
    try {
      out = execSync(`curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
    } catch { sleep(2500); continue; }
    try { return JSON.parse(out); } catch {
      if (out && out.length > 0) return { error: out.slice(0, 200) };
      sleep(2500); continue;
    }
  }
  return { error: "the route never answered through six windows" };
};

const jobs = () => api("GET", "/api/jobs").jobs ?? [];
const edges = () => api("GET", "/api/edges").edges ?? [];
const binding = () => {
  try {
    const reg = JSON.parse(readFileSync(path.join(process.cwd(), "data", "projects.json"), "utf8"));
    return reg.projects?.[reg.active]?.remote?.connectionId ?? null;
  } catch { return null; }
};

async function pollUntil(jobId, timeoutMs = 400_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
}

/** the t921 law: the Mock Cluster resolves BY NAME, never by a hard id */
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

let REMOTE_BODY = null;
const runJob = (id) => api("POST", `/api/jobs/${id}/run`, REMOTE_BODY);

/** one minted node + its edge(s), run, polled — the chain's unit step */
async function step(label, type, name, params, edgesIn, timeoutMs = 400_000) {
  const made = api("POST", "/api/jobs", { type, name, ...(params ? { params } : {}) });
  ok(`${label} node created`, !!made.job?.id, made.job?.id?.slice(-8));
  if (!made.job?.id) process.exit(2);
  for (const [from, ports, tag] of edgesIn) {
    const e = api("POST", "/api/edges", { fromJobId: from, toJobId: made.job.id, ...(ports ?? {}) });
    ok(`edge ${tag}`, !e.error, JSON.stringify(e).slice(0, 100));
  }
  const r = runJob(made.job.id);
  ok(`${label} run accepted`, !r.error, r.error ?? r.job?.status);
  const done = await pollUntil(made.job.id, timeoutMs);
  ok(`${label} completed`, done.status === "completed", `status=${done.status} ${String(done.result ?? "").slice(0, 110)}`);
  if (done.status !== "completed") { console.log(`FATAL: ${label} did not complete — remove and inspect`); process.exit(2); }
  return made.job;
}

/** a minted node + explicit-port edges, NO run — the plan reads the
 *  graph, not the statuses (the t949 law) */
function hangChild(label, type, name, edgesIn) {
  const made = api("POST", "/api/jobs", { type, name });
  ok(`${label} node created (idle)`, !!made.job?.id, made.job?.id?.slice(-8));
  if (!made.job?.id) process.exit(2);
  for (const [from, ports, tag] of edgesIn) {
    const e = api("POST", "/api/edges", { fromJobId: from, toJobId: made.job.id, ...(ports ?? {}) });
    ok(`edge ${tag}`, !e.error && !!e.edge?.id, e.error ?? e.edge?.id?.slice(-8));
  }
  return made.job;
}

const outsOf = (id) => api("GET", `/api/jobs/${id}/outputs`);
const classesOf = (id) => api("GET", `/api/jobs/${id}/classes`);

// ---- guards ----------------------------------------------------------------
let PRE_EDGES = 0;
function guards() {
  ok("guard: server answers", Array.isArray(jobs()));
  PRE_EDGES = edges().length;
  const stale = jobs().filter((j) => (j.name ?? "").includes("(t952)"));
  ok("guard: no stale t952 mints", stale.length === 0,
    stale.length ? `${stale.length} stale — run remove first` : "");
  if (stale.length) { console.log("FATAL: singular-world guard — remove first"); process.exit(2); }
  const staleSel = jobs().filter((j) => j.type === "select2d" && /^(2D Class Selection \d+)/.test(j.name ?? ""));
  ok("guard: no stale default-named selections (a crashed ride's mint)", staleSel.length === 0,
    staleSel.length ? staleSel.map((s) => s.name).join(", ") : "");
  const imports = jobs().filter((j) => j.type === "import" && j.status === "completed");
  ok("guard: a completed import exists (the chain's root)", imports.length >= 1);
  const { conn, created } = mockClusterConn();
  ok("guard: Mock Cluster connection present", !!conn?.id, `${created ? "created" : "reused"} ${conn?.id?.slice(0, 14) ?? "NONE"}`);
  if (!conn?.id) { console.log("FATAL: no Mock Cluster connection — cannot ride"); process.exit(2); }
  REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };
  if (fail > 0) { console.log("FATAL: guards failed — the mint refuses to ride"); process.exit(2); }
  return imports[0];
}

/** the occupancy law the whole ride rests on: A's four classes split the
 *  particles evenly (total/4), B's three (total/3) — every PAIRED class
 *  strictly gained, Class 004 unpaired (only in A) */
function pinOccupancy(aId, bId) {
  const a = classesOf(aId);
  const b = classesOf(bId);
  ok("A classes route answers", !a.error && Array.isArray(a.classes), `${a.classes?.length ?? 0} classes, total ${a.total}`);
  ok("B classes route answers", !b.error && Array.isArray(b.classes), `${b.classes?.length ?? 0} classes, total ${b.total}`);
  const listA = a.classes ?? [], listB = b.classes ?? [];
  ok("A speaks FOUR classes (K=4)", listA.length === 4, listA.map((c) => c.cls).join(","));
  ok("B speaks THREE classes (K=3)", listB.length === 3, listB.map((c) => c.cls).join(","));
  ok("the totals agree (one extract feeds both)", a.total === b.total && a.total > 0, String(a.total));
  ok("the total is divisible by 12 (both uniform splits exact)", a.total % 12 === 0, String(a.total));
  const uniA = listA.every((c) => c.count === a.total / 4);
  const uniB = listB.every((c) => c.count === b.total / 3);
  ok("A's occupancy uniform (the (p*7+it)%K+1 law)", uniA, listA.map((c) => c.count).join("/"));
  ok("B's occupancy uniform", uniB, listB.map((c) => c.count).join("/"));
  const byClsB = new Map(listB.map((c) => [c.cls, c]));
  const paired = [1, 2, 3].every((k) => {
    const bb = byClsB.get(k);
    const aa = listA.find((c) => c.cls === k);
    return bb && aa && bb.fraction > aa.fraction;
  });
  ok("every PAIRED class strictly gained (0.25 → 0.33)", paired);
  ok("Class 4 unpaired (only in A — the amber chip's ground truth)", !byClsB.has(4) && listA.some((c) => c.cls === 4));
  return { aTotal: a.total, aCounts: listA.map((c) => c.count), bCounts: listB.map((c) => c.count) };
}

// ---- mint ------------------------------------------------------------------
async function mint() {
  console.log("== t952 class world mint — mint ==");
  const root = guards();
  const before = jobs().length;
  console.log(`  pre-state: ${before} jobs; chain root: import ${root.id.slice(-8)} "${root.name}"`);

  // 1-2. autopick → extract (the t951 shape verbatim — the particles)
  const pick = await step("autopick", "autopick", "t952 pick witness", null, [[root.id, null, "import→autopick"]]);
  const ex = await step("extract", "extract", "t952 extract witness", null, [
    [pick.id, null, "autopick→extract"], [root.id, null, "import→extract"],
  ]);
  const exOuts = outsOf(ex.id);
  ok("extract outputs listing ok", exOuts.status === "ok", exOuts.workdir ?? "no workdir");
  ok("extract particles.star home", !!exOuts.workdir && existsSync(path.join(exOuts.workdir, "particles.star")));

  // 3-4. the two class2d siblings — SAME extract, DIFFERENT K
  const a = await step("class2d A", "class2d", NAME_A,
    { algorithm: "em", iterations: 2, numClasses: 4 }, [[ex.id, null, "extract→A"]]);
  const b = await step("class2d B", "class2d", NAME_B,
    { algorithm: "em", iterations: 2, numClasses: 3 }, [[ex.id, null, "extract→B"]]);

  // 5. THE MULTI-INPUT CHILD (idle — the plan reads the graph): X eats
  //    A.particles AND B.particles through the SAME port pair
  const x = hangChild("X the selection consumer", "select2d", NAME_X, [
    [a.id, { fromPort: "particles", toPort: "particles" }, "A.particles→X.particles"],
    [b.id, { fromPort: "particles", toPort: "particles" }, "B.particles→X.particles (THE MULTI-INPUT FACT)"],
  ]);

  // 6. THE CLASSES-MOUTH CHILD (idle): the mint's port refusal
  const c = hangChild("C the classes consumer", "select2d", NAME_C, [
    [a.id, { fromPort: "classAverages", toPort: "classes" }, "A.classAverages→C.classes"],
  ]);

  // 7. THE OCCUPANCY LAW — the gained math's ground truth
  const occ = pinOccupancy(a.id, b.id);

  // 8. the graph's own shape: 8 new edges (2 chain edges, 2 class2d feeds,
  //    X's dual feed, C's single feed), X dual-fed
  const es = edges();
  ok("the world grew exactly 8 edges", es.length === PRE_EDGES + 8, `${es.length} vs ${PRE_EDGES}+8`);
  ok("X is dual-fed (A + B through the same port pair)",
    es.filter((e) => e.toJobId === x.id && e.fromPort === "particles" && e.toPort === "particles").length === 2);
  ok("C is single-fed (A's classAverages mouth only)",
    es.filter((e) => e.toJobId === c.id).length === 1 &&
      es.find((e) => e.toJobId === c.id)?.fromPort === "classAverages");

  // 9. the workdir ledger for the restore
  const aOuts = outsOf(a.id);
  const bOuts = outsOf(b.id);
  const projectId = (aOuts.workdir ?? "").match(/data[\/\\]relion[\/\\]([^\/\\]+)/)?.[1] ?? null;
  ok("mock-cluster side holds A's workdir (the original)", !!projectId &&
    existsSync(path.join(MOCK_PROJECTS, projectId, `class2d_${a.id.slice(-8)}`)),
    projectId ?? "unknown");

  // 10. the manifest
  mkdirSync(path.dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    writtenAt: new Date().toISOString(),
    preJobs: before,
    binding: binding(),
    import: { id: root.id, name: root.name },
    pick: { id: pick.id, name: pick.name },
    extract: { id: ex.id, name: ex.name },
    a: { id: a.id, name: NAME_A },
    b: { id: b.id, name: NAME_B },
    x: { id: x.id, name: NAME_X },
    c: { id: c.id, name: NAME_C },
    workdirs: { extract: exOuts.workdir ?? null, a: aOuts.workdir ?? null, b: bOuts.workdir ?? null },
    mockSide: { projectId },
    occupancy: occ,
  }, null, 2));
  console.log(`  manifest written: ${MANIFEST}`);
  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---- verify ----------------------------------------------------------------
function verify() {
  console.log("== t952 class world mint — verify ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to verify"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const list = jobs();
  for (const [label, key, wantCompleted] of [
    ["class2d A", "a", true], ["class2d B", "b", true],
    ["X the selection consumer", "x", false], ["C the classes consumer", "c", false],
    ["extract", "extract", true], ["autopick", "pick", true],
  ]) {
    const j = list.find((x) => x.id === m[key]?.id);
    ok(`${label} alive${wantCompleted ? " and completed" : ""}`,
      !!j && (!wantCompleted || j.status === "completed"), j ? j.status : "missing");
  }
  ok("job count matches pre-state + 6", list.length === m.preJobs + 6, `${list.length} vs ${m.preJobs}+6`);
  const occ = pinOccupancy(m.a.id, m.b.id);
  ok("occupancy unchanged", occ.aTotal === m.occupancy?.aTotal, `${occ.aTotal} vs ${m.occupancy?.aTotal}`);
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---- remove ----------------------------------------------------------------
function sweepTree(tree, suffixes, typeRe, label) {
  if (!existsSync(tree)) return;
  for (const proj of readdirSync(tree)) {
    const projDir = path.join(tree, proj);
    let dirs = [];
    try { dirs = readdirSync(projDir); } catch { continue; }
    for (const dir of dirs) {
      if (!typeRe.test(dir) || !suffixes.some((s) => dir.endsWith(s))) continue;
      const p = path.join(projDir, dir);
      try { rmSync(p, { recursive: true, force: true }); console.log(`  rm (${label}) ${path.relative(process.cwd(), p)}`); }
      catch (e) { console.log(`  ✗ rm (${label}) failed for ${p}: ${e.message}`); fail++; }
    }
  }
}

function remove() {
  console.log("== t952 class world mint — remove ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to remove"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  // children first, then the runs, then the chain — the t951 law
  const order = [
    ["X the selection consumer", m.x?.id], ["C the classes consumer", m.c?.id],
    ["class2d B", m.b?.id], ["class2d A", m.a?.id],
    ["extract", m.extract?.id], ["autopick", m.pick?.id],
  ];
  for (const [label, id] of order) {
    if (!id) continue;
    const d = api("DELETE", `/api/jobs/${id}`);
    // the idempotent verdict (the t933 law): "Job not found" IS the goal
    const gone = !d.error || /not found/i.test(String(d.error));
    ok(`${label} job deleted (the hard door)`, gone, JSON.stringify(d).slice(0, 80));
  }
  const suffixes = order.map(([, id]) => id).filter(Boolean).map((id) => id.slice(-8));
  sweepTree(path.join(process.cwd(), "data", "relion"), suffixes, SUFFIX_TYPES, "local");
  for (const wd of [m.workdirs?.extract, m.workdirs?.a, m.workdirs?.b]) {
    if (wd && existsSync(wd)) {
      try { rmSync(wd, { recursive: true, force: true }); console.log(`  rm ${wd.replace(process.cwd() + "/", "")}`); }
      catch (e) { console.log(`  ✗ rm failed for ${wd}: ${e.message}`); fail++; }
    }
  }
  sweepTree(MOCK_PROJECTS, suffixes, SUFFIX_TYPES, "cluster");
  const after = jobs();
  ok("world restored: pre-state job count", after.length === m.preJobs, `${after.length} vs ${m.preJobs}`);
  ok("no t952 residue", after.every((j) => !(j.name ?? "").includes("(t952)")));
  ok("no default-named selection residue", after.every((j) => !/^(2D Class Selection \d+)/.test(j.name ?? "")));
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  // the manifest is the RETRY's law (the t932 finding): only a GREEN
  // remove consumes the manifest
  if (fail === 0) {
    rmSync(MANIFEST, { force: true });
  } else {
    console.log("  (the manifest STAYS — a RED remove must not eat the retry's key)");
  }
  console.log(`== remove ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

const verb = process.argv[2];
if (verb === "mint") await mint();
else if (verb === "verify") verify();
else if (verb === "remove") remove();
else { console.log("usage: t952-class-world-mint.mjs mint|verify|remove"); process.exit(1); }

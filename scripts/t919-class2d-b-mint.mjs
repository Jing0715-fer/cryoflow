#!/usr/bin/env node
/**
 * t919 — the SECOND class2d mint: the run-compare dialog's Class A/B
 * door (t453's third domain) has never been ridden live because the
 * world has never carried TWO completed class2d runs. The t916 mint
 * (import → autopick → extract → class2d K=4 → select2d) is the proven
 * chain — this mint adds the variable the A/B verdict needs: a SECOND
 * class2d fed by the SAME extract, different K:
 *
 *   extract (the t916 chain's, already completed, 42 particles)
 *     → class2d B  (POST /api/jobs {type:"class2d"}, EM dialect,
 *                   K=6, 2 iterations — the mock's assignment law
 *                   (p*7+it)%K+1 answers {1..6: 7} at it002)
 *
 * K=6 against the K=4 run is the richest legal pair: classes 1–4 pair
 * by number, classes 5–6 are B-only — the unpaired chip ("only in B")
 * is part of the face. The DIRECTION of the verdict is the witness's
 * to flip (the host leads): host K4 sees all-lost (its shares are
 * fatter), host K6 sees all-gained — both orientations of the same
 * join, one mint.
 *
 * RESTORE ORDER (the two-manifest law): this B hangs off the t916
 * chain's extract, so the world unwinds DOWNSTREAM-FIRST ACROSS BOTH
 * manifests — `t919-class2d-b-mint.mjs remove` FIRST (B has no
 * downstream of its own), THEN `t916-class2d-mint.mjs remove` (the
 * chain: select2d → class2d → extract → autopick). Each remove sweeps
 * its own workdirs on BOTH sides (local data/relion + the mock-cluster
 * fs) by id suffix.
 *
 *   node scripts/t919-class2d-b-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const T916_MANIFEST = path.join(process.cwd(), "data", "t916-class2d-mint.json");
const MANIFEST = path.join(process.cwd(), "data", "t919-class2d-b-mint.json");
const MOCK_PROJECTS = path.join(process.cwd(), "services", "mock-cluster", "fs", "projects", "cryoflow");
const K = 6, ITERS = [1, 2];

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
const binding = () => {
  try {
    const reg = JSON.parse(readFileSync(path.join(process.cwd(), "data", "projects.json"), "utf8"));
    return reg.projects?.[reg.active]?.remote?.connectionId ?? null;
  } catch { return null; }
};

/** t929 — THE RUN LANE (the t921 law, carried home): the resolved Mock
 *  Cluster body rides EVERY run explicitly (the t916 mint's shape). A
 *  bare POST takes the LOCAL lane on an unbound world and dies at the
 *  RELION gate — exactly what the first t929 re-ride caught. */
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
async function pollUntil(jobId, timeoutMs = 300_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
}

/** the mock stub's assignment law — computed from the input star's own
 *  row count (the instrument measures the law, never its author's memory). */
function expectedOccupancy(inputStarPath, k, iterations) {
  let rows = 0;
  const text = readFileSync(inputStarPath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("_") || t.startsWith("#") || t.startsWith("data_") || t === "loop_") continue;
    if (/@/.test(t.split(/\s+/)[0] ?? "")) rows++;
  }
  const perIter = {};
  for (const it of iterations) {
    const counts = Object.fromEntries(Array.from({ length: k }, (_, i) => [i + 1, 0]));
    for (let p = 0; p < rows; p++) counts[((p * 7 + it) % k) + 1] += 1;
    perIter[String(it)] = counts;
  }
  return { rows, perIter };
}

async function mint() {
  console.log("== t919 class2d-B mint — mint ==");
  if (!existsSync(T916_MANIFEST)) { console.log("FATAL: no t916 manifest — run t916-class2d-mint.mjs mint first"); process.exit(2); }
  const t916 = JSON.parse(readFileSync(T916_MANIFEST, "utf8"));
  const list = jobs();
  ok("guard: t916 chain alive (extract completed)", list.some((j) => j.id === t916.extract.id && j.status === "completed"));
  ok("guard: t916 class2d A alive (the A/B sibling)", list.some((j) => j.id === t916.class2d.id && j.type === "class2d" && j.status === "completed"));
  const stale = list.filter((j) => (j.name ?? "").includes("t919"));
  ok("guard: no stale t919 mints", stale.length === 0, stale.length ? `${stale.length} stale — remove first` : "");
  ok("guard: binding untouched", binding() === t916.binding, `binding=${binding()}`);
  const { conn, created } = mockClusterConn();
  ok("guard: Mock Cluster connection present", !!conn?.id, `${created ? "created" : "reused"} ${conn?.id?.slice(0, 14) ?? "NONE"}`);
  if (!conn?.id) { console.log("FATAL: no Mock Cluster connection — cannot ride"); process.exit(2); }
  REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };
  if (fail > 0) { console.log("FATAL: guards failed"); process.exit(2); }

  const before = list.length;
  console.log(`  pre-state: ${before} jobs; extract host: ${t916.extract.id.slice(-8)}`);

  // the expected occupancy from the extract's OWN star (the manifest's
  // workdir holds the local mirror — the input the run actually read)
  const inputStar = path.join(t916.workdirs.extract, "particles.star");
  const expect = expectedOccupancy(inputStar, K, ITERS);
  ok("expected occupancy computed from the input star", expect.rows === t916.expect.rows, `${expect.rows} rows · it002 map ${JSON.stringify(expect.perIter["2"])}`);

  const b = api("POST", "/api/jobs", {
    type: "class2d",
    name: "t919 class2d second witness",
    params: { algorithm: "em", iterations: 2, numClasses: K },
  });
  ok("class2d B node created", !!b.job?.id, b.job?.id?.slice(-8));
  if (!b.job?.id) process.exit(2);
  const e1 = api("POST", "/api/edges", { fromJobId: t916.extract.id, toJobId: b.job.id });
  ok("edge extract→class2d B", !e1.error, JSON.stringify(e1).slice(0, 120));

  const r1 = runJob(b.job.id);
  ok("class2d B run accepted (remote lane — the t921 law)", !r1.error, r1.error ?? r1.job?.status);
  const done = await pollUntil(b.job.id);
  ok("class2d B completed", done.status === "completed", `status=${done.status} ${String(done.result ?? "").slice(0, 140)}`);
  if (done.status !== "completed") { console.log("FATAL: class2d B did not complete — remove and inspect"); process.exit(2); }

  // products — the non-bulk law: everything comes home
  const outs = api("GET", `/api/jobs/${b.job.id}/outputs`);
  ok("class2d B outputs listing ok", outs.status === "ok", outs.workdir ? String(outs.workdir).replace(process.cwd() + "/", "") : "no workdir");
  const files = outs.files ?? [];
  const classStars = files.filter((f) => /^particles_class\d+\.star$/i.test(f.name));
  ok("per-class stars home: K of them", classStars.length === K, classStars.map((f) => f.name).join(", "));
  const remoteTiles = files.filter((f) => f.remote);
  ok("NOTHING stayed remote (class2d is not a bulk producer)", remoteTiles.length === 0);

  // the classes route — the law, on the B run
  const cls = api("GET", `/api/jobs/${b.job.id}/classes`);
  ok("classes route answers for B", !cls.error && Array.isArray(cls.classes), `total=${cls.total} iteration=${cls.iteration}`);
  ok("classesSlices = 6", cls.classesSlices === K, `slices=${cls.classesSlices}`);
  ok("total = the input star's rows", cls.total === expect.rows, `total=${cls.total}`);
  const got = Object.fromEntries((cls.classes ?? []).map((c) => [c.cls, c.count]));
  ok("occupancy matches the (p*7+it)%6+1 law exactly", JSON.stringify(got) === JSON.stringify(expect.perIter["2"]),
    `got ${JSON.stringify(got)} want ${JSON.stringify(expect.perIter["2"])}`);

  // the mock-side workdir (the original)
  const projectId = (outs.workdir ?? "").match(/data[\/\\]relion[\/\\]([^\/\\]+)/)?.[1] ?? null;
  const bSuffix = b.job.id.slice(-8);
  const mockBDir = projectId ? path.join(MOCK_PROJECTS, projectId, `class2d_${bSuffix}`) : null;
  ok("mock-cluster side holds class2d B's workdir", !!mockBDir && existsSync(mockBDir), mockBDir ? String(mockBDir).replace(process.cwd() + "/", "") : "unknown");

  mkdirSync(path.dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    writtenAt: new Date().toISOString(),
    preJobs: before,
    binding: binding(),
    t916Manifest: T916_MANIFEST,
    extract: { id: t916.extract.id, name: t916.extract.name },
    class2dB: { id: b.job.id, name: b.job.name },
    workdirs: { class2dB: outs.workdir ?? null },
    mockSide: { projectId, class2dB: mockBDir },
    K, iterations: ITERS,
    expect: { rows: expect.rows, perIter: expect.perIter },
    classesFile: cls.classesFile ?? null,
  }, null, 2));
  console.log(`  manifest written: ${MANIFEST}`);
  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

function verify() {
  console.log("== t919 class2d-B mint — verify ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to verify"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const list = jobs();
  ok("class2d B alive + completed", list.some((j) => j.id === m.class2dB.id && j.type === "class2d" && j.status === "completed"));
  ok("job count = preJobs + 1", list.length === m.preJobs + 1, `${list.length} vs ${m.preJobs}+1`);
  const cls = api("GET", `/api/jobs/${m.class2dB.id}/classes`);
  ok("classes route still answers (K=6)", cls.classesSlices === m.K && cls.total === m.expect.rows, `total=${cls.total}`);
  const got = Object.fromEntries((cls.classes ?? []).map((c) => [c.cls, c.count]));
  ok("occupancy still matches the law", JSON.stringify(got) === JSON.stringify(m.expect.perIter["2"]), JSON.stringify(got));
  ok("local workdir present", !!m.workdirs.class2dB && existsSync(m.workdirs.class2dB));
  ok("mock-side workdir present", !!m.mockSide.class2dB && existsSync(m.mockSide.class2dB));
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

function sweepBothSides(m, suffix, typeRe) {
  const base = path.join(process.cwd(), "data", "relion");
  try {
    for (const proj of readdirSync(base)) {
      for (const dir of readdirSync(path.join(base, proj))) {
        if (dir.endsWith(suffix) && typeRe.test(dir)) {
          const p = path.join(base, proj, dir);
          try { rmSync(p, { recursive: true, force: true }); console.log(`  rm ${path.relative(process.cwd(), p)}`); }
          catch (e) { console.log(`  ✗ rm failed for ${p}: ${e.message}`); fail++; }
        }
      }
    }
  } catch { /* nothing to sweep */ }
  const wd = m.workdirs?.class2dB;
  if (wd && existsSync(wd)) {
    try { rmSync(wd, { recursive: true, force: true }); console.log(`  rm ${wd.replace(process.cwd() + "/", "")}`); }
    catch (e) { console.log(`  ✗ rm failed for ${wd}: ${e.message}`); fail++; }
  }
  if (!existsSync(MOCK_PROJECTS)) return;
  for (const proj of readdirSync(MOCK_PROJECTS)) {
    const projDir = path.join(MOCK_PROJECTS, proj);
    for (const dir of readdirSync(projDir)) {
      if (!(typeRe.test(dir) && dir.endsWith(suffix))) continue;
      const p = path.join(projDir, dir);
      try { rmSync(p, { recursive: true, force: true }); console.log(`  rm (cluster) ${path.relative(process.cwd(), p)}`); }
      catch (e) { console.log(`  ✗ rm (cluster) failed for ${p}: ${e.message}`); fail++; }
    }
  }
}

function remove() {
  console.log("== t919 class2d-B mint — remove (run BEFORE the t916 remove) ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to remove"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const d = api("DELETE", `/api/jobs/${m.class2dB.id}`);
  ok("class2d B job deleted (the hard door)", !d.error, JSON.stringify(d).slice(0, 80));
  sweepBothSides(m, m.class2dB.id.slice(-8), /^class2d_/);
  const after = jobs();
  ok("world restored: pre-state job count", after.length === m.preJobs, `${after.length} vs ${m.preJobs}`);
  ok("no t919 residue", after.every((j) => !(j.name ?? "").includes("t919")));
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  rmSync(MANIFEST, { force: true });
  console.log(`== remove ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

const verb = process.argv[2];
if (verb === "mint") await mint();
else if (verb === "verify") verify();
else if (verb === "remove") remove();
else { console.log("usage: t919-class2d-b-mint.mjs mint|verify|remove"); process.exit(1); }

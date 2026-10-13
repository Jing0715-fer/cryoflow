#!/usr/bin/env node
/**
 * t951 — the FSC deep mint: the world has NEVER carried a completed
 * postprocess with a real corrected-FSC table, so the verdict dialog's
 * door (the ShieldCheck in the inspector's footer) has never once opened
 * in a browser — the family's only unit-pinned-only sheet (t946's unit
 * pins its paper face to the source, but no live ride ever saw it).
 * The t915/t916 law applies: the world lacks the variable — MINT it
 * through the REAL doors, nothing hand-planted:
 *
 *   import (already in the world, completed, the seed's real mrcs)
 *     → autopick  (POST /api/jobs {type:"autopick"} + edge, remote run)
 *     → extract   (POST /api/jobs {type:"extract"} + 2 edges, remote run)
 *     → class2d   (EM dialect, K=4, 2 iterations — the (p*7+it)%K+1 law)
 *     → select2d  (POST + edge class2d→select2d, THEN RUN — engine-native,
 *                  instant: particles_select2d.star. The t916 seat NEVER
 *                  ran — the gallery IS the parameter — but the deep chain
 *                  needs the selection star, so this mint's own select2d
 *                  carries the wire forward)
 *     → initialmodel (VDAM de-novo, K=1, 2 iterations — the stub's
 *                  --grad --denovo_3dref dialect → model_mrc)
 *     → refine3d  (particles from select2d, reference from initialmodel,
 *                  2 gold iterations — half1_mrc + half2_mrc)
 *     → maskcreate (map from refine3d → mask.mrc)
 *     → postprocess (half1 + half2 + mask → postprocess.star with the
 *                  corrected data_fsc + data_general trio)
 *
 * The crown the mint verifies: GET /api/jobs/<pp>/fsc answers
 * source === "postprocess" with ≥2 corrected shells — the exact bytes
 * postprocessVerdictOf eats, the exact bytes that open the door.
 *
 * Verbs (the t913/t914/t915/t916 mint contract — the manifest is the
 * restore's law):
 *   mint    build the chain, run it, verify the products, write manifest.json
 *   verify  re-check every manifest claim against the live world
 *   remove  delete the minted jobs (the hard door, downstream first),
 *           sweep the LOCAL workdirs by id suffix, sweep the MOCK-CLUSTER
 *           side, verify the pre-state job count and the untouched binding
 *
 *   node scripts/t951-fsc-deep-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const MANIFEST = path.join(process.cwd(), "data", "t951-fsc-deep-mint.json");
const MOCK_PROJECTS = path.join(process.cwd(), "services", "mock-cluster", "fs", "projects", "cryoflow");
const SUFFIX_TYPES = /^(autopick_|extract_|class2d_|select2d_|initialmodel_|refine3d_|maskcreate_|postprocess_)/;

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
const findType = (t) => jobs().filter((j) => j.type === t);
const binding = () => {
  try {
    const reg = JSON.parse(readFileSync(path.join(process.cwd(), "data", "projects.json"), "utf8"));
    return reg.projects?.[reg.active]?.remote?.connectionId ?? null;
  } catch { return null; }
};

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
async function step(label, type, name, params, edges, timeoutMs = 300_000) {
  const made = api("POST", "/api/jobs", { type, name, ...(params ? { params } : {}) });
  ok(`${label} node created`, !!made.job?.id, made.job?.id?.slice(-8));
  if (!made.job?.id) process.exit(2);
  for (const [from, tag] of edges) {
    const e = api("POST", "/api/edges", { fromJobId: from, toJobId: made.job.id });
    ok(`edge ${tag}`, !e.error, JSON.stringify(e).slice(0, 100));
  }
  const r = runJob(made.job.id);
  ok(`${label} run accepted`, !r.error, r.error ?? r.job?.status);
  const done = await pollUntil(made.job.id, timeoutMs);
  ok(`${label} completed`, done.status === "completed", `status=${done.status} ${String(done.result ?? "").slice(0, 110)}`);
  if (done.status !== "completed") { console.log(`FATAL: ${label} did not complete — remove and inspect`); process.exit(2); }
  return made.job;
}

const outsOf = (id) => api("GET", `/api/jobs/${id}/outputs`);

// ---- guards ----------------------------------------------------------------
function guards() {
  ok("guard: server answers", Array.isArray(jobs()));
  const stale = jobs().filter((j) => (j.name ?? "").includes("t951"));
  ok("guard: no stale t951 mints", stale.length === 0,
    stale.length ? `${stale.length} stale — run remove first` : "");
  if (stale.length) { console.log("FATAL: singular-world guard — remove first"); process.exit(2); }
  const imports = findType("import").filter((j) => j.status === "completed");
  ok("guard: a completed import exists (the chain's root)", imports.length >= 1);
  const { conn, created } = mockClusterConn();
  ok("guard: Mock Cluster connection present", !!conn?.id, `${created ? "created" : "reused"} ${conn?.id?.slice(0, 14) ?? "NONE"}`);
  if (!conn?.id) { console.log("FATAL: no Mock Cluster connection — cannot ride"); process.exit(2); }
  REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };
  if (fail > 0) { console.log("FATAL: guards failed — the mint refuses to ride"); process.exit(2); }
  return imports[0];
}

// ---- mint ------------------------------------------------------------------
async function mint() {
  console.log("== t951 FSC deep mint — mint ==");
  const root = guards();
  const before = jobs().length;
  console.log(`  pre-state: ${before} jobs; chain root: import ${root.id.slice(-8)} "${root.name}"`);

  // 1-2. autopick → extract (the t916 shape verbatim)
  const pick = await step("autopick", "autopick", "t951 pick witness", null, [[root.id, "import→autopick"]]);
  const ex = await step("extract", "extract", "t951 extract witness", null, [
    [pick.id, "autopick→extract"], [root.id, "import→extract"],
  ]);
  const exOuts = outsOf(ex.id);
  ok("extract outputs listing ok", exOuts.status === "ok", exOuts.workdir ?? "no workdir");
  const particlesStar = path.join(exOuts.workdir ?? "", "particles.star");
  ok("extract particles.star home", existsSync(particlesStar));

  // 3. class2d — EM, K=4, 2 iterations (the (p*7+it)%K+1 law)
  const c2d = await step("class2d", "class2d", "t951 class2d witness",
    { algorithm: "em", iterations: 2, numClasses: 4 }, [[ex.id, "extract→class2d"]], 400_000);

  // 4. select2d — the t916 seat never ran (the gallery IS the parameter);
  // this mint's own seat RUNS: the deep chain needs the selection star.
  // Engine-native — the run lands instantly and the output registers.
  const sel = await step("select2d", "select2d", "t951 select witness", null, [[c2d.id, "class2d→select2d"]], 120_000);
  const selOuts = outsOf(sel.id);
  const selStar = (selOuts.files ?? []).find((f) => /^particles_select2d\.star$/i.test(f.name));
  ok("select2d wrote particles_select2d.star (the wire's cargo)", !!selStar && !selStar.remote, selStar?.name ?? "missing");

  // 5. initialmodel — VDAM de-novo, K=1, 2 iterations (the stub's
  // --grad --denovo_3dref dialect). The seed for refine3d.
  const im = await step("initialmodel", "initialmodel", "t951 initialmodel witness",
    { iterations: 2, numClasses: 1 }, [[sel.id, "select2d→initialmodel"]], 300_000);
  const imOuts = outsOf(im.id);
  // the outputs route exposes TILES (files[]), not the run record's
  // outputs map (the first ride's lesson — the check reads the listing
  // like the product's own Files tab does)
  const imModel = (imOuts.files ?? []).find((f) => /class\d+(_unfil)?\.mrc$/i.test(f.name));
  ok("initialmodel left a class volume (the model_mrc cargo)", !!imModel && !imModel.remote,
    imModel?.name ?? "missing");

  // 6. refine3d — particles from select2d, reference from initialmodel,
  // 12 gold iterations (arc_resolution(12) = 7.12 A → the postprocess's
  // estimate lands on the box floor 2.2×angpix ≈ 7.8 A — a LADDER the
  // verdict face can space, not a 20 A strawman)
  const r3d = await step("refine3d", "refine3d", "t951 refine3d witness",
    { iterations: 12 }, [[sel.id, "select2d→refine3d"], [im.id, "initialmodel→refine3d"]], 500_000);
  const r3dOuts = outsOf(r3d.id);
  const h1 = (r3dOuts.files ?? []).find((f) => /half1_class\d+(_unfil)?\.mrc$/i.test(f.name));
  const h2 = (r3dOuts.files ?? []).find((f) => /half2_class\d+(_unfil)?\.mrc$/i.test(f.name));
  ok("refine3d left a half1 map (the postprocess's --i)", !!h1 && !h1.remote, h1?.name ?? "missing");
  ok("refine3d left a half2 map (the partner)", !!h2 && !h2.remote, h2?.name ?? "missing");
  ok("refine3d left run_model.star (the postprocess estimate's father)",
    !!(r3dOuts.files ?? []).some((f) => /^run_model\.star$/i.test(f.name)));

  // 7. maskcreate — the map from refine3d → the solvent mask
  const mk = await step("maskcreate", "maskcreate", "t951 maskcreate witness",
    null, [[r3d.id, "refine3d→maskcreate"]], 200_000);
  const mkOuts = outsOf(mk.id);
  const mkMask = (mkOuts.files ?? []).find((f) => /^mask\.mrc$/i.test(f.name));
  ok("maskcreate left mask.mrc (the solvent)", !!mkMask && !mkMask.remote, mkMask?.name ?? "missing");

  // 8. postprocess — half1 + half2 + mask → postprocess.star
  const pp = await step("postprocess", "postprocess", "t951 postprocess witness",
    null, [[r3d.id, "refine3d→postprocess"], [mk.id, "maskcreate→postprocess"]], 200_000);
  const ppOuts = outsOf(pp.id);
  const ppStarTile = (ppOuts.files ?? []).find((f) => /^postprocess\.star$/i.test(f.name));
  const ppMapTile = (ppOuts.files ?? []).find((f) => /^postprocess\.mrc$/i.test(f.name));
  ok("postprocess left postprocess.star (the corrected table)", !!ppStarTile && !ppStarTile.remote, ppStarTile?.name ?? "missing");
  ok("postprocess left postprocess.mrc (the sharpened map)", !!ppMapTile && !ppMapTile.remote, ppMapTile?.name ?? "missing");

  // 9. THE CROWN — the FSC route answers the verdict door's exact question
  const fsc = api("GET", `/api/jobs/${pp.id}/fsc`);
  ok("fsc route answers", !fsc.error, fsc.error ?? `source=${fsc.source}`);
  ok("source === postprocess (the verdict door's law)", fsc.source === "postprocess", `got ${fsc.source}`);
  const corrected = (fsc.shells ?? []).filter((s) => s.correctedFsc != null && Number.isFinite(s.correctedFsc));
  ok("corrected shells ≥ 2 (postprocessVerdictOf's gate)", corrected.length >= 2, `${corrected.length}/${(fsc.shells ?? []).length}`);
  ok("resolutionAt143 non-null (the official crossing lives)", fsc.resolutionAt143 != null, String(fsc.resolutionAt143));
  ok("postprocessGeneral carries the trio", !!fsc.postprocessGeneral,
    fsc.postprocessGeneral ? `R=${fsc.postprocessGeneral.finalResolution} B=${fsc.postprocessGeneral.bfactor} a=${fsc.postprocessGeneral.angpix}` : "missing");
  ok("data_general's finalResolution agrees with the crossing (±0.3 Å)",
    fsc.postprocessGeneral?.finalResolution != null && fsc.resolutionAt143 != null &&
      Math.abs(fsc.postprocessGeneral.finalResolution - fsc.resolutionAt143) < 0.3,
    fsc.postprocessGeneral?.finalResolution != null && fsc.resolutionAt143 != null
      ? `${fsc.postprocessGeneral.finalResolution} vs ${fsc.resolutionAt143}` : "missing");

  // 10. the local workdir ledger for the restore
  const projectId = (ppOuts.workdir ?? "").match(/data[\/\\]relion[\/\\]([^\/\\]+)/)?.[1] ?? null;
  const ppSuffix = pp.id.slice(-8);
  const mockPpDir = projectId ? path.join(MOCK_PROJECTS, projectId, `postprocess_${ppSuffix}`) : null;
  ok("mock-cluster side holds the postprocess workdir (the original)", !!mockPpDir && existsSync(mockPpDir),
    mockPpDir ? String(mockPpDir).replace(process.cwd() + "/", "") : "unknown project");

  // 11. the restore's law — write the manifest
  mkdirSync(path.dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    writtenAt: new Date().toISOString(),
    preJobs: before,
    binding: binding(),
    root: { id: root.id, name: root.name },
    pick: { id: pick.id, name: pick.name },
    extract: { id: ex.id, name: ex.name },
    class2d: { id: c2d.id, name: c2d.name },
    select2d: { id: sel.id, name: sel.name },
    initialmodel: { id: im.id, name: im.name },
    refine3d: { id: r3d.id, name: r3d.name },
    maskcreate: { id: mk.id, name: mk.name },
    postprocess: { id: pp.id, name: pp.name },
    workdirs: { extract: exOuts.workdir ?? null, postprocess: ppOuts.workdir ?? null },
    mockSide: { projectId, postprocess: mockPpDir },
    fsc: { source: fsc.source, shells: fsc.shells?.length ?? 0, corrected: corrected.length, resolutionAt143: fsc.resolutionAt143 },
  }, null, 2));
  console.log(`  manifest written: ${MANIFEST}`);
  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---- verify ---------------------------------------------------------------
function verify() {
  console.log("== t951 FSC deep mint — verify ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to verify"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const list = jobs();
  for (const [label, key] of [["autopick", "pick"], ["extract", "extract"], ["class2d", "class2d"], ["select2d", "select2d"], ["initialmodel", "initialmodel"], ["refine3d", "refine3d"], ["maskcreate", "maskcreate"], ["postprocess", "postprocess"]]) {
    const j = list.find((x) => x.id === m[key]?.id);
    ok(`${label} job alive and completed`, !!j && j.status === "completed", j ? j.status : "missing");
  }
  ok("job count matches pre-state + 8", list.length === m.preJobs + 8, `${list.length} vs ${m.preJobs}+8`);
  const fsc = api("GET", `/api/jobs/${m.postprocess.id}/fsc`);
  ok("fsc route still answers source=postprocess", fsc.source === "postprocess", `got ${fsc.source}`);
  const corrected = (fsc.shells ?? []).filter((s) => s.correctedFsc != null && Number.isFinite(s.correctedFsc));
  ok("corrected shells still ≥ 2", corrected.length >= 2, `${corrected.length}`);
  ok("local postprocess workdir present", !!m.workdirs.postprocess && existsSync(m.workdirs.postprocess));
  ok("mock-side postprocess workdir present", !!m.mockSide.postprocess && existsSync(m.mockSide.postprocess));
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---- remove ---------------------------------------------------------------
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
  console.log("== t951 FSC deep mint — remove ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to remove"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  // downstream first: the postprocess dies before its mask and halves, ...
  const order = [
    ["postprocess", m.postprocess?.id], ["maskcreate", m.maskcreate?.id],
    ["refine3d", m.refine3d?.id], ["initialmodel", m.initialmodel?.id],
    ["select2d", m.select2d?.id], ["class2d", m.class2d?.id],
    ["extract", m.extract?.id], ["autopick", m.pick?.id],
  ];
  for (const [label, id] of order) {
    if (!id) continue;
    const d = api("DELETE", `/api/jobs/${id}`);
    // the idempotent verdict (the t933 law): "Job not found" IS the goal
    // state on a retry — the delete's second honest word
    const gone = !d.error || /not found/i.test(String(d.error));
    ok(`${label} job deleted (the hard door)`, gone, JSON.stringify(d).slice(0, 80));
  }
  const suffixes = order.map(([, id]) => id).filter(Boolean).map((id) => id.slice(-8));
  // local workdir leftovers + the manifest's belt-and-braces second pass
  sweepTree(path.join(process.cwd(), "data", "relion"), suffixes, SUFFIX_TYPES, "local");
  for (const wd of [m.workdirs?.extract, m.workdirs?.postprocess]) {
    if (wd && existsSync(wd)) {
      try { rmSync(wd, { recursive: true, force: true }); console.log(`  rm ${wd.replace(process.cwd() + "/", "")}`); }
      catch (e) { console.log(`  ✗ rm failed for ${wd}: ${e.message}`); fail++; }
    }
  }
  // the cluster side: the mock's fs holds the originals
  sweepTree(MOCK_PROJECTS, suffixes, SUFFIX_TYPES, "cluster");
  const after = jobs();
  ok("world restored: pre-state job count", after.length === m.preJobs, `${after.length} vs ${m.preJobs}`);
  ok("no t951 residue", after.every((j) => !(j.name ?? "").includes("t951")));
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
else { console.log("usage: t951-fsc-deep-mint.mjs mint|verify|remove"); process.exit(1); }

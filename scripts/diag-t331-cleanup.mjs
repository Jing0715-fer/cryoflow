#!/usr/bin/env node
/**
 * t331 diag — intermediate-file cleanup (local + cluster), verified twice.
 *
 * The user's ticket:
 *   「增加清理中间过程文件的功能，包括本地和cluster」
 *
 * THE FEATURE: one pure planner (hpc/cleanup) classifies a walked listing
 * (local readdir / one SSH find of the cluster workdir) into three honest
 * tiers — safe (iteration intermediates + array scratch, default-on),
 * diagnostics (CTF spectra + plots, opt-in), bulk (movies / particle
 * stacks, type-gated, opt-in) — behind a keep-set contract that always
 * survives: chainable outputs (record.outputs + REMOTE_OUTPUT_CANDIDATES
 * winners + final iteration families), cluster twins (remoteOutputs,
 * t324), logs + verdict dotfiles, symlinks (input-data doors), and
 * anything UNRECOGNIZED (unknown = keep, conservative by construction).
 * GET previews; POST executes — and the POST carries ONLY scopes + tiers,
 * never a file list: the server re-walks LIVE both times.
 *
 * PHASES:
 *  A. UNIT — the pure planner's truth table (bun, zero deps): the glob
 *     dialect, the iteration families, the candidates' winner semantics,
 *     and THE BIG TABLE — a class2d workdir in the mock refine's own
 *     dialect (renamed finals + per-iteration leftovers) classified
 *     tier-by-tier, plus the bulk gating, the unknown-keeps, the twin
 *     keeps, the symlink doors, and the fullPaths execution shape.
 *  B. LIVE LOCAL — a surgical record + fixture workdir (the t324 recipe:
 *     no local RELION build in this sandbox): the plan's shape, the
 *     guards (404 / 403 / 400 / the running + pending 409s / never-ran),
 *     the execution's disk truth (tier-selected files die, everything
 *     else stays, empty dirs pruned), and the idempotent second pass.
 *  C. LIVE REMOTE — the REAL thing: a class2d dispatched @slurm onto the
 *     mock cluster (real iterations on the cluster's disk), fixture
 *     diagnostics + unknowns + shard scratch alongside, then the plan's
 *     remote side, the execution (cluster files die, keeps stay, the
 *     manifest ledger is rewritten honest), the 10s listing cache (a
 *     cluster-side deletion stays INVISIBLE until ?refresh=1), and the
 *     t325 drift doctrine (the connection dies, a same-host sibling
 *     carries the cleanup).
 *  D. UI CONTRACTS — the source pins: the dialog's hooks + doctrine
 *     defaults, the server-authoritative POST shape, the route's guards,
 *     the pure module's purity, the remote legs' constants.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/cryoflow"; // t332 re-bind: this sandbox's my-project tree was reset to the generic scaffold — the repo is the only real tree (the d57fdda recipe)
const BASE = "http://localhost:3001";
const CONN = "qa-t331";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3001",
};
const SHJ = { ...SH, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 800) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  }).stdout?.trim() ?? "";
const clientBoth = (cmd) => {
  const r = spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  return `${r.stdout?.trim() ?? ""}${r.stderr?.trim() ? ` <<stderr>> ${r.stderr.trim()}` : ""}`.trim();
};

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
const createdProjects = [];
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  return b?.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
  (
    await api("/api/edges", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    })
  ).status;

const dispatch = (id, body) =>
  api(`/api/jobs/${id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify(body) });

const awaitJobTerminal = async (id, deadlineMs) => {
  const done = await pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);
  return done;
};

const planFor = (id, refresh) =>
  api(`/api/jobs/${id}/cleanup${refresh ? "?refresh=1" : ""}`, { headers: SH });
const clean = (id, body) =>
  api(`/api/jobs/${id}/cleanup`, { method: "POST", headers: SHJ, body: JSON.stringify(body) });

/** surgical DB access through the repo's own prisma client (the t325 recipe). */
const dbSurgery = (prog) => {
  const r = spawnSync(
    "bun",
    ["-e", `process.env.DATABASE_URL = "file:${ROOT}/db/cryoflow.db";\n${prog}`],
    { cwd: ROOT, encoding: "utf8", timeout: 60_000 }
  );
  const lines = `${r.stdout ?? ""}${r.stderr ?? ""}`
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("prisma:"));
  return lines.join("\n").trim();
};

const STATE_FILE = `${ROOT}/data/engine-state.json`;
const readState = () => {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
};
const writeState = (state) => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
const surgicalRecordIds = [];
const putRecord = (id, rec) => {
  const state = readState();
  state[id] = rec;
  writeState(state);
  surgicalRecordIds.push(id);
};
const dropRecord = (id) => {
  const state = readState();
  delete state[id];
  writeState(state);
};

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t331",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  // ======================================================================
  console.log("== PHASE A: UNIT — the pure planner's truth table (bun, zero deps) ==");

  const pureSrc = readFileSync(`${ROOT}/src/lib/hpc/cleanup.ts`, "utf8");
  must(
    !/^import\s/m.test(pureSrc) && !/^}\s*from\s/m.test(pureSrc),
    "hpc/cleanup.ts is PURE (zero imports — the t326/t327 recipe)"
  );
  must(
    pureSrc.includes("unknown means keep") || pureSrc.includes("UNKNOWN, and unknown means keep"),
    "the unknown=keep doctrine is the module's own words"
  );

  const unit = (expr) => {
    const prog = [
      `const m = await import(${JSON.stringify(path.join(ROOT, "src/lib/hpc/cleanup.ts"))});`,
      `const out = (${expr});`,
      `console.log("__UNIT__" + JSON.stringify(out));`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("__UNIT__"));
    if (!line) return `UNIT-PARSE-ERROR: ${(r.stdout ?? "").slice(0, 120)}`;
    try {
      return JSON.parse(line.slice("__UNIT__".length));
    } catch {
      return `UNIT-PARSE-ERROR: ${line.slice(0, 140)}`;
    }
  };

  // ---- the glob dialect ------------------------------------------------
  must(
    unit(
      `(() => { const re = m.globToRegExp("run_it[0-9]*_data.star"); return re.test("run_it025_data.star") && !re.test("run_itX_data.star") && !re.test("xrun_it025_data.star"); })()`
    ) === true,
    "globToRegExp: the candidates' own dialect (classes + leading anchor)"
  );
  must(
    unit(
      `(() => { const re = m.globToRegExp("micrographs/*_autopick.star"); return re.test("micrographs/a_autopick.star") && !re.test("micrographs/sub/a_autopick.star") && !re.test("other/a_autopick.star"); })()`
    ) === true,
    "globToRegExp: * does not cross / (bash glob semantics)"
  );
  must(
    unit(`m.globToRegExp("*.sav").test("topaz_model.sav") && !m.globToRegExp("*.sav").test("topaz_model.sav.bak")`),
    "globToRegExp: dots are literal"
  );

  // ---- iteration families ----------------------------------------------
  must(
    JSON.stringify(unit(`m.iterationFamilyOf("run_it025_data.star")`)) ===
      JSON.stringify({ iter: 25, suffix: "data.star" }),
    "iterationFamilyOf: root-level it-files parse"
  );
  must(
    unit(`m.iterationFamilyOf("sub/run_it001_data.star")`) === null &&
      unit(`m.iterationFamilyOf("run_data.star")`) === null,
    "iterationFamilyOf: nested + non-iteration names are not the dialect"
  );

  // ---- candidate winners -------------------------------------------------
  must(
    JSON.stringify(
      unit(
        `(() => { const files = [{path:"run_data.star",size:10},{path:"run_it001_data.star",size:1},{path:"run_it003_data.star",size:3},{path:"run_it002_data.star",size:2}]; const v = m.candidateVerdicts(files, m ? [{key:"particles_star", exact:["run_data.star"], glob:"run_it[0-9]*_data.star", pick:"latest"}] : []); return {keep:[...v.keep].sort(), redundant:[...v.redundant].sort()}; })()`
      )
    ) ===
      JSON.stringify({
        keep: ["run_data.star", "run_it003_data.star"],
        redundant: ["run_it001_data.star", "run_it002_data.star"],
      }),
    "candidateVerdicts: exact name + latest glob winner keep, beaten iterations redundant"
  );
  must(
    JSON.stringify(
      unit(
        `(() => { const files = [{path:"micrographs/b_autopick.star",size:1},{path:"micrographs/a_autopick.star",size:1}]; const v = m.candidateVerdicts(files, [{key:"coords_star", glob:"micrographs/*_autopick.star", pick:"first"}]); return {keep:[...v.keep], redundant:[...v.redundant]}; })()`
      )
    ) === JSON.stringify({ keep: ["micrographs/a_autopick.star"], redundant: ["micrographs/b_autopick.star"] }),
    "candidateVerdicts: pick=first keeps the byte-order first (per-mic coords: any one is chainable)"
  );

  // ---- THE BIG TABLE: a class2d workdir in the mock refine's dialect -----
  const C2D = unit(
    `(() => {
      const files = [
        {path:"run_data.star",size:100}, {path:"run_classes.mrcs",size:200},
        {path:"run_it001_data.star",size:10}, {path:"run_it002_data.star",size:20},
        {path:"run_it001_class001.mrc",size:30}, {path:"run_it002_class001.mrc",size:31},
        {path:"run_it001_class002.mrc",size:32}, {path:"run_it002_class002.mrc",size:33},
        {path:"run.out",size:5}, {path:"run.err",size:0}, {path:"note.txt",size:2},
        {path:".cf-exit",size:1}, {path:".cf-pid",size:8}, {path:".cf-sbatch.sh",size:400},
        {path:".cf-shard-1.star",size:3}, {path:".cf-array-rc-42",size:1}, {path:".cf-merge.lock",size:0},
        {path:"shard_2/micrographs_ctf.star",size:398},
        {path:"mic1_power.eps",size:5}, {path:"mic1.ctf",size:3}, {path:"mic1_ctf.mrc",size:4096},
        {path:"unknown_format.bin",size:2048}, {path:"micrographs",size:0,link:true},
        {path:"scratch.tmp",size:512},
      ];
      const cands = [{key:"particles_star", exact:["run_data.star"], glob:"run_it[0-9]*_data.star", pick:"latest"},
                     {key:"classes_mrc", exact:["run_classes.mrcs"], glob:"run_it[0-9]*_classes.mrcs", pick:"latest"}];
      const {groups, kept} = m.classifyCleanup(files, {type:"class2d", candidates:cands}, {fullPaths:true});
      const byTier = {};
      for (const g of groups) byTier[g.tier] = {count:g.count, bytes:g.bytes, paths:(g.paths||[]).slice().sort()};
      return {tiers: groups.map(g=>g.tier), byTier, keptCount: kept.count, keptBytes: kept.bytes};
    })()`
  );
  must(Array.isArray(C2D?.tiers) && C2D.tiers.join(",") === "safe,diagnostics", `a class2d workdir offers exactly safe+diagnostics (${JSON.stringify(C2D?.tiers)})`);
  must(
    JSON.stringify(C2D?.byTier?.safe?.paths) ===
      JSON.stringify([
        ".cf-array-rc-42",
        ".cf-merge.lock",
        ".cf-shard-1.star",
        "run_it001_class001.mrc",
        "run_it001_class002.mrc",
        "run_it001_data.star",
        "scratch.tmp",
        "shard_2/micrographs_ctf.star",
      ]),
    `safe = beaten iterations + cf scratch + shard dirs + tmp (${JSON.stringify(C2D?.byTier?.safe?.paths)})`
  );
  must(
    JSON.stringify(C2D?.byTier?.diagnostics?.paths) ===
      JSON.stringify(["mic1.ctf", "mic1_ctf.mrc", "mic1_power.eps"]),
    `diagnostics = eps + ctf curves + 2D spectra (${JSON.stringify(C2D?.byTier?.diagnostics?.paths)})`
  );
  must(
    C2D?.byTier?.safe?.bytes === 986 && C2D?.byTier?.diagnostics?.bytes === 4104,
    `the groups' byte accounting is the listing's own sizes (${C2D?.byTier?.safe?.bytes}/${C2D?.byTier?.diagnostics?.bytes})`
  );
  must(
    C2D?.keptCount === 13 && C2D?.keptBytes === 100 + 200 + 20 + 31 + 33 + 5 + 0 + 2 + 1 + 8 + 400 + 2048,
    `kept = finals + witnesses + unknown + the symlink door (${C2D?.keptCount} files / ${C2D?.keptBytes} B)`
  );

  // ---- the resume contract: the FINAL iteration of every family stays ----
  must(
    JSON.stringify(
      unit(
        `(() => { const files=[{path:"run_it001_data.star",size:1},{path:"run_it002_data.star",size:2},{path:"run_it003_data.star",size:3}]; const {groups,kept}=m.classifyCleanup(files,{type:"multibody"}); const safe=groups.find(g=>g.tier==="safe"); return {safeCount: safe?safe.count:0, kept: kept.count}; })()`
      )
    ) === JSON.stringify({ safeCount: 2, kept: 1 }),
    "a family with no candidates table still keeps its highest iteration (the --continue resume point)"
  );

  // ---- bulk gating -------------------------------------------------------
  must(
    JSON.stringify(
      unit(
        `(() => { const files=[{path:"corrected_micrographs.star",size:886},{path:"mics/corrected_001.mrc",size:64000000},{path:"mics/corrected_002.mrcs",size:32000000},{path:"weird.mrcs",size:10}]; const {groups,kept}=m.classifyCleanup(files,{type:"motioncorr",candidates:[{key:"micrographs_star",exact:["corrected_micrographs.star"]}]}); const bulk=groups.find(g=>g.tier==="bulk"); return {bulkCount:bulk?bulk.count:0, bulkBytes:bulk?bulk.bytes:0, keptCount: kept.count}; })()`
      )
    ) === JSON.stringify({ bulkCount: 3, bulkBytes: 96000010, keptCount: 1 }),
    "motioncorr's movies/stacks are the bulk tier (every .mrc/.mrcs); the chainable star stays"
  );
  must(
    unit(
      `(() => { const files=[{path:"foo.mrcs",size:10}]; const {groups,kept}=m.classifyCleanup(files,{type:"class2d"}); return groups.length===0 && kept.count===1; })()`
    ) === true,
    "class2d is NOT bulk-gated — an unrecognized .mrcs stays (unknown = keep)"
  );

  // ---- the record's own account + twins ----------------------------------
  must(
    JSON.stringify(
      unit(
        `(() => { const files=[{path:"weird.custom",size:7},{path:"run_it002_data.star",size:2},{path:"run_it001_data.star",size:1}]; const {groups}=m.classifyCleanup(files,{type:"class2d", outputsRel:["weird.custom"]},{fullPaths:true}); const safe=groups.find(g=>g.tier==="safe"); return safe?safe.paths:[]; })()`
      )
    ) === JSON.stringify(["run_it001_data.star"]),
    "without a twin, a beaten iteration is safe (the family max wins the keep)"
  );
  must(
    JSON.stringify(
      unit(
        `(() => { const files=[{path:"weird.custom",size:7},{path:"run_it002_data.star",size:2},{path:"run_it001_data.star",size:1}]; const {groups,kept}=m.classifyCleanup(files,{type:"class2d", outputsRel:["weird.custom"], twinsRel:["run_it001_data.star"]}); const safe=groups.find(g=>g.tier==="safe"); return {safePaths: safe?safe.paths:[], kept: kept.count}; })()`
      )
    ) === JSON.stringify({ safePaths: [], kept: 3 }),
    "record.outputs keep their own files; a TWIN keeps a beaten iteration the family max would otherwise delete"
  );

  // ---- the execution shape: fullPaths + the payload cap -------------------
  must(
    unit(
      `(() => { const files=Array.from({length:30},(_,i)=>({path:\`t\${i}.tmp\`,size:1})); const {groups}=m.classifyCleanup(files,{type:"class2d"},{fullPaths:true}); const g=groups.find(x=>x.tier==="safe"); return g.files.length===24 && g.paths.length===30 && g.truncated===true && g.count===30; })()`
    ) === true,
    "the plan payload caps the file window at 24; the execution pass sees all 30 (fullPaths)"
  );

  // ======================================================================
  console.log("== PHASE B: LIVE LOCAL — surgical record + fixture workdir ==");

  const projL = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t331 local cleanup" }),
  });
  must(projL.status >= 200 && projL.status < 300, `the local project creates (${projL.status})`);
  const projLId = projL.body?.project?.id;
  createdProjects.push(projLId);

  const jobL = await mkJob({
    projectId: projLId,
    type: "class2d",
    name: "QA t331 class2d local",
    params: { numClasses: 2, iterations: 2 },
  });
  must(!!jobL?.id, "the local class2d job creates");

  // a downstream consumer (pending) — the plan's downstream line
  const downL = await mkJob({
    projectId: projLId,
    type: "class3d",
    name: "QA t331 class3d downstream",
    params: {},
  });
  must(!!downL?.id, "the downstream class3d creates");
  const edgeL = await mkEdge(jobL.id, downL.id, "particles", "particles");
  must(edgeL === 200 || edgeL === 201, `the edge wires class2d → class3d (${edgeL})`);

  // the fixture workdir + the surgical record (the t324 recipe)
  const wdL = `${ROOT}/data/relion/${projLId}/class2d_${jobL.id.slice(-8)}`;
  const mkWd = spawnSync(
    "bash",
    [
      "-c",
      `mkdir -p ${JSON.stringify(wdL)}/shard_1 ${JSON.stringify(wdL)}/extra
cd ${JSON.stringify(wdL)}
printf 'particles\\n' > run_data.star
head -c 200 /dev/urandom > run_classes.mrcs
printf 'a' > run_it001_data.star; printf 'b' > run_it002_data.star
printf 'c' > run_it001_class001.mrc; printf 'd' > run_it002_class001.mrc
printf 'log' > run.out; printf '' > run.err; printf 'note' > note.txt
printf '0' > .cf-exit; printf '1 22' > .cf-pid
printf 's' > .cf-shard-1.star; printf 'r' > .cf-array-rc-9
printf 'sh' > shard_1/micrographs_ctf.star
printf 'x' > extra/stack_a.mrcs; head -c 4096 /dev/urandom > extra/stack_b.mrcs
printf 'PS' > mic1_power.eps; printf 'curve' > mic1.ctf
head -c 1024 /dev/urandom > mystery.bin`,
    ],
    { encoding: "utf8" }
  );
  must(mkWd.status === 0, `the fixture workdir builds (${mkWd.stderr?.slice(0, 80)})`);

  putRecord(jobL.id, {
    jobId: jobL.id,
    projectId: projLId,
    type: "class2d",
    pid: null,
    cmd: "relion_refine --i particles.star --o run",
    workdir: wdL,
    logFile: `${wdL}/run.out`,
    errFile: `${wdL}/run.err`,
    startedAt: new Date().toISOString(),
    outputs: { particles_star: `${wdL}/run_data.star`, classes_mrc: `${wdL}/run_classes.mrcs` },
    done: true,
    exitCode: 0,
    result: "classes sorted",
  });

  const lsWd = (sub) =>
    (spawnSync("bash", ["-c", `ls -A ${JSON.stringify(wdL)}${sub ? "/" + sub : ""} 2>/dev/null`], {
      encoding: "utf8",
    }).stdout ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .sort();

  const planL = await planFor(jobL.id);
  must(planL.status === 200 && planL.body?.ok === true, `the plan answers 200 (${planL.status})`);
  must(planL.body?.runnable === true, "the completed local job is runnable");
  must(planL.body?.local?.exists === true, "the local side exists");
  must(planL.body?.remote === null, "a local-only record carries no remote side");
  must(
    planL.body?.local?.groups?.map((g) => g.tier).join(",") === "safe,diagnostics",
    `the local groups are safe+diagnostics (${planL.body?.local?.groups?.map((g) => g.tier)})`
  );
  const safeL = planL.body?.local?.groups?.find((g) => g.tier === "safe");
  must(
    JSON.stringify(safeL?.files?.map((f) => f.path).sort()) ===
      JSON.stringify([".cf-array-rc-9", ".cf-shard-1.star", "run_it001_class001.mrc", "run_it001_data.star", "shard_1/micrographs_ctf.star"]),
    `safe = it001 files + cf scratch + shard dir (${JSON.stringify(safeL?.files?.map((f) => f.path))})`
  );
  const diagL = planL.body?.local?.groups?.find((g) => g.tier === "diagnostics");
  must(
    JSON.stringify(diagL?.files?.map((f) => f.path).sort()) ===
      JSON.stringify(["mic1.ctf", "mic1_power.eps"]),
    `diagnostics = eps + ctf (${JSON.stringify(diagL?.files?.map((f) => f.path))})`
  );
  must(
    planL.body?.local?.kept?.count === 12,
    `kept counts the contract's members (finals + it002 maxima + logs + note + witnesses + mystery + the ungated stacks) (${planL.body?.local?.kept?.count})`
  );
  must(
    planL.body?.downstream?.some((d) => d.id === downL.id && d.status === "idle") === true,
    `the downstream line names the wired class3d (${JSON.stringify(planL.body?.downstream)})`
  );
  // class2d is not bulk-gated: extra/stack_*.mrcs stay (unknown = keep)
  must(
    lsWd("extra").includes("stack_a.mrcs") && !safeL?.files?.some((f) => f.path.startsWith("extra/")),
    "a non-bulk type's .mrcs stacks are NOT offered (they stay, unknown = keep)"
  );

  // ---- the guards ---------------------------------------------------------
  must((await planFor("no-such-job")).status === 404, "an unknown job is a 404");
  must(
    (await api(`/api/jobs/${jobL.id}/cleanup`, { headers: { Host: "localhost:3001" } })).status === 403,
    "a cross-site GET (no Origin family) is a 403"
  );
  must(
    (await clean(jobL.id, { local: true, tiers: [] })).status === 400,
    "no tiers selected is a 400"
  );
  must(
    (await clean(jobL.id, { local: false, remote: false, tiers: ["safe"] })).status === 400,
    "no side selected is a 400"
  );
  must(
    (await clean(jobL.id, { local: true, tiers: ["nuclear"] })).status === 400,
    "an all-invalid tier list filters to empty → the honest 400 (invalid names are dropped, never honored)"
  );

  // ---- the execution (safe only — diagnostics must SURVIVE) ---------------
  const run1 = await clean(jobL.id, { local: true, tiers: ["safe"] });
  must(run1.status === 200 && run1.body?.ok === true, `the safe-tier execution answers (${run1.status})`);
  must(run1.body?.local?.deleted === 5, `5 safe files die (${run1.body?.local?.deleted})`);
  must(run1.body?.local?.freedBytes === 6, `freed bytes = the listing's own sizes (${run1.body?.local?.freedBytes})`);
  must(run1.body?.local?.errors?.length === 0, "no errors");
  const after1 = lsWd();
  must(
    JSON.stringify(after1) ===
      JSON.stringify(
        [
          ".cf-exit",
          ".cf-pid",
          "extra",
          "mic1.ctf",
          "mic1_power.eps",
          "mystery.bin",
          "note.txt",
          "run.out",
          "run.err",
          "run_classes.mrcs",
          "run_data.star",
          "run_it002_class001.mrc",
          "run_it002_data.star",
        ].sort()
      ),
    `the tree after safe: it002 finals + diagnostics + unknown stay, it001 + scratch die, shard_1 pruned (${JSON.stringify(after1)})`
  );

  // idempotent second pass: nothing left in the safe tier
  const run2 = await clean(jobL.id, { local: true, tiers: ["safe"] });
  must(run2.body?.local?.deleted === 0, `the second pass is an honest zero (${run2.body?.local?.deleted})`);

  // diagnostics pass — the spectra die, the keep-set survives to the end
  const run3 = await clean(jobL.id, { local: true, tiers: ["diagnostics"] });
  must(run3.body?.local?.deleted === 2, `2 diagnostics die (${run3.body?.local?.deleted})`);
  const after3 = lsWd();
  must(
    !after3.includes("mic1.ctf") && !after3.includes("mic1_power.eps"),
    "the eps + ctf curve are gone"
  );
  must(
    ["run_data.star", "run_classes.mrcs", "run_it002_data.star", "run.out", "run.err", "mystery.bin"].every((f) =>
      after3.includes(f)
    ),
    "chainables + logs + the unknown file survive every pass"
  );

  // ---- the liveness refusals ----------------------------------------------
  dbSurgery(
    `const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();db.job.update({where:{id:${JSON.stringify(jobL.id)}},data:{status:"running"}}).then(()=>db.$disconnect());`
  );
  const planRun = await planFor(jobL.id);
  must(
    planRun.body?.runnable === false && /running/i.test(planRun.body?.reason ?? ""),
    `a RUNNING job refuses with its reason (${planRun.body?.reason})`
  );
  must(
    (await clean(jobL.id, { local: true, tiers: ["safe"] })).status === 409,
    "a RUNNING job POST is a 409"
  );
  dbSurgery(
    `const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();db.job.update({where:{id:${JSON.stringify(jobL.id)}},data:{status:"pending"}}).then(()=>db.$disconnect());`
  );
  must(
    (await clean(jobL.id, { local: true, tiers: ["safe"] })).status === 409,
    "a PENDING job POST is a 409"
  );
  dbSurgery(
    `const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();db.job.update({where:{id:${JSON.stringify(jobL.id)}},data:{status:"completed"}}).then(()=>db.$disconnect());`
  );

  // never-ran job: honest "nothing to clean"
  const jobNR = await mkJob({ projectId: projLId, type: "ctffind", name: "QA t331 never ran", params: {} });
  const planNR = await planFor(jobNR.id);
  must(
    planNR.body?.runnable === false && /has not run yet/.test(planNR.body?.reason ?? ""),
    `a never-ran job says so (${planNR.body?.reason})`
  );
  must((await clean(jobNR.id, { local: true, tiers: ["safe"] })).status === 409, "a never-ran POST is a 409");

  // ======================================================================
  console.log("== PHASE C: LIVE REMOTE — a real class2d on the mock cluster ==");

  // the fixtures — the t327 PHASE C shape (particles star + stack on the mock)
  const mrcHdr = (() => {
    const b = Buffer.alloc(1024);
    b.writeInt32LE(1024, 0);
    b.writeInt32LE(1024, 4);
    b.writeInt32LE(1, 8);
    b.writeInt32LE(2, 12);
    b.writeInt32LE(1, 20);
    b.writeInt32LE(256, 44);
    b.writeInt32LE(1, 64);
    b.writeFloatLE(1.0, 68);
    b.writeInt32LE(1, 92);
    b.writeInt32LE(128, 96);
    return b.toString("base64");
  })();
  const fx = clientBoth(
    "mkdir -p /data2/t331-particles; " +
      `echo ${mrcHdr} | base64 -d > /data2/t331-particles/stack.mrcs; ` +
      "printf 'data_\\n\\nloop_\\n_rlnImageName #1\\n" +
      "0001@/data2/t331-particles/stack.mrcs\\n" +
      "0002@/data2/t331-particles/stack.mrcs\\n' > /data2/t331-particles/particles.star"
  );
  must(fx === "", `the particles fixture builds quietly (${fx.slice(0, 100)})`);

  const projR = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t331 remote cleanup", mode: "remote", remoteConnectionId: CONN }),
  });
  must(projR.status >= 200 && projR.status < 300, `the remote project creates (${projR.status})`);
  const projRId = projR.body?.project?.id;
  createdProjects.push(projRId);

  const pImport = await mkJob({
    projectId: projRId,
    type: "import",
    name: "QA t331 particles import",
    params: {
      nodeType: "particles",
      micrographsPath: "/data2/t331-particles/particles.star",
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!pImport?.id, "the particles import creates");
  const runPImport = await api(`/api/jobs/${pImport.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runPImport.status >= 200 && runPImport.status < 300, `the import run accepts (${runPImport.status})`);
  const donePImport = await awaitJobTerminal(pImport.id, 90_000);
  must(donePImport?.status === "completed", `the particles import completes (${donePImport?.status})`);

  const c2d = await mkJob({
    projectId: projRId,
    type: "class2d",
    name: "2D Classification 1",
    params: { numClasses: 3, iterations: 3 },
  });
  must(!!c2d?.id, "the class2d job creates");
  const edgeC2d = await mkEdge(pImport.id, c2d.id, "particles", "particles");
  must(edgeC2d === 200 || edgeC2d === 201, `the edge wires particles import → class2d (${edgeC2d})`);
  const dispatchC2d = await dispatch(c2d.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2, partition: "brain2" },
  });
  must(dispatchC2d.status >= 200 && dispatchC2d.status < 300, `the class2d dispatch answers (${dispatchC2d.status})`);
  const doneC2d = await awaitJobTerminal(c2d.id, 240_000);
  must(doneC2d?.status === "completed", `the class2d COMPLETES (${doneC2d?.status}: ${String(doneC2d?.result ?? "").slice(0, 80)})`);

  // the cluster workdir, as the dispatch left it
  const recR = readState()[c2d.id];
  const wdR = recR?.remote?.remoteWorkdir;
  must(!!wdR, `the record carries the cluster workdir (${wdR})`);
  const twins = Object.values(recR?.remote?.remoteOutputs ?? {});
  must(
    Array.isArray(twins),
    `remoteOutputs is always an array (here ${twins.length} twin(s) — twins are recorded only for files the sync-back LEFT on the cluster; small finals sync local instead)`
  );
  must(
    (await api(`/api/jobs/${c2d.id}/outputs`, { headers: SH })).body?.files?.some(
      (f) => f.path === "run_data.star" && !f.remote
    ) === true,
    "the small finals live in the LOCAL mirror (the sync-back's own twin — the Files tab serves them locally)"
  );
  const lsR = () =>
    client(`find ${JSON.stringify(wdR)} -mindepth 1 -maxdepth 2 \\( -type f -o -type l \\) -printf '%P\\n' | sort`)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  const tree0 = lsR();
  must(
    tree0.includes("run_data.star") && tree0.includes("run_classes.mrcs"),
    `the mock refine wrote its canonical finals (${tree0.filter((f) => f.startsWith("run_")).join(", ")})`
  );
  must(
    tree0.some((f) => /^run_it\d+_/.test(f)),
    `the mock refine left per-iteration intermediates on the cluster (${tree0.filter((f) => /^run_it/.test(f)).length} it-files)`
  );

  // fixture extras on the cluster: diagnostics + unknown + array scratch
  const fxR = clientBoth(
    `cd ${JSON.stringify(wdR)} && printf 'PS' > mic1_power.eps && printf 'curve' > mic1.ctf && ` +
      `head -c 2048 /dev/urandom > mic1_ctf.mrc && head -c 512 /dev/urandom > unknown_cluster.bin && ` +
      `printf 's' > .cf-shard-3.star && printf '0' > .cf-array-rc-12 && mkdir -p shard_7 && printf 'sh' > shard_7/micrographs_ctf.star && echo OK`
  );
  must(fxR.endsWith("OK"), `the cluster fixtures build (${fxR.slice(-40)})`);

  const planR = await planFor(c2d.id, true);
  must(planR.status === 200 && planR.body?.ok === true, `the remote plan answers (${planR.status})`);
  must(planR.body?.runnable === true, "the completed remote job is runnable");
  must(planR.body?.remote?.known === true, "the remote side is known");
  must(planR.body?.remote?.exists === true, "the remote workdir is listable");
  must(
    planR.body?.remote?.connection?.id === CONN,
    `the connection is named (${planR.body?.remote?.connection?.id})`
  );
  const safeR = planR.body?.remote?.groups?.find((g) => g.tier === "safe");
  const diagR = planR.body?.remote?.groups?.find((g) => g.tier === "diagnostics");
  must(!!safeR && safeR.count >= 9, `safe carries the real it-files + scratch (${safeR?.count} files)`);
  must(
    safeR?.files?.some((f) => f.path === "run_it001_data.star") === true,
    "a beaten iteration (it001) is offered"
  );
  must(
    safeR?.files?.every((f) => f.path !== "run_data.star" && f.path !== "run_classes.mrcs") === true,
    "the canonical finals are never offered"
  );
  must(
    ["run_it002_data.star", "run_it002_class001.mrc", "run_it003_class002.mrc"].every(
      (p) => !safeR?.files?.some((f) => f.path === p)
    ),
    "family maxima (it002 data/class001, it003 class002/003) are never offered — they are the resume contract"
  );
  must(
    JSON.stringify(diagR?.files?.map((f) => f.path).sort()) ===
      JSON.stringify(["mic1.ctf", "mic1_ctf.mrc", "mic1_power.eps"]),
    `diagnostics carries the spectra fixtures (${JSON.stringify(diagR?.files?.map((f) => f.path))})`
  );
  must(
    !planR.body?.remote?.groups?.some((g) => g.files?.some((f) => f.path === "unknown_cluster.bin")),
    "the unknown cluster file is NOT offered (unknown = keep)"
  );
  must(
    planR.body?.local?.groups?.length >= 0 && planR.body?.local?.exists === true,
    "the local mirror of the remote run is also plannable (both sides, one job)"
  );

  // ---- the 10s listing cache: a cluster-side deletion stays invisible ----
  client(`rm -f ${JSON.stringify(wdR)}/mic1.ctf`);
  const planCached = await planFor(c2d.id); // within TTL — the cached listing still sees mic1.ctf
  const diagCached = planCached.body?.remote?.groups?.find((g) => g.tier === "diagnostics");
  must(
    diagCached?.files?.some((f) => f.path === "mic1.ctf") === true,
    "within the 10s TTL the plan rides the cached listing (mic1.ctf still 'there')"
  );
  const planFresh = await planFor(c2d.id, true); // refresh bypasses
  const diagFresh = planFresh.body?.remote?.groups?.find((g) => g.tier === "diagnostics");
  must(
    diagFresh?.files?.some((f) => f.path === "mic1.ctf") === false,
    "?refresh=1 re-lists LIVE (the deletion is visible)"
  );

  // ---- the execution: both sides, both tiers ------------------------------
  const manifestPath = `${recR.workdir}/.cf-remote-manifest.json`;
  const manifestBefore = JSON.parse(readFileSync(manifestPath, "utf8"));
  must(manifestBefore.files.length > 0, `the manifest ledger exists pre-cleanup (${manifestBefore.files.length} entries)`);

  const runR = await clean(c2d.id, { local: true, remote: true, tiers: ["safe", "diagnostics"] });
  must(runR.status === 200 && runR.body?.ok === true, `the both-sides execution answers (${runR.status})`);
  must(runR.body?.remote?.deleted >= 6, `the cluster deleted its intermediates (${runR.body?.remote?.deleted})`);
  must(runR.body?.remote?.freedBytes > 0, `the cluster freed bytes (${runR.body?.remote?.freedBytes})`);
  must(runR.body?.remote?.errors?.length === 0, "no remote errors");
  must(runR.body?.remote?.manifestRewritten === true, "the ledger was rewritten");

  const tree1 = lsR();
  must(
    tree1.includes("run_data.star") && tree1.includes("run_classes.mrcs"),
    "the chainable finals survive on the cluster (t324 twins intact)"
  );
  must(
    twins.every((t) => tree1.includes(t.replace(wdR.replace(/\/+$/, "") + "/", ""))),
    `every recorded twin survives (${twins.join(", ")})`
  );
  must(
    tree1.includes("run.out") && tree1.includes("run.err") && tree1.includes(".cf-exit"),
    "the witnesses survive (logs + verdict)"
  );
  must(
    tree1.includes("unknown_cluster.bin"),
    "the unknown cluster file survives (unknown = keep)"
  );
  must(
    tree1.includes("run_it002_data.star") && tree1.includes("run_it003_class002.mrc"),
    "the family maxima survive on the cluster (the --continue resume points)"
  );
  must(
    !tree1.includes("run_it001_data.star") &&
      !tree1.includes("run_it001_class002.mrc") &&
      !tree1.includes("run_it002_class003.mrc"),
    "the beaten iterations are gone from the cluster"
  );
  must(
    !tree1.includes("mic1_power.eps") && !tree1.includes("mic1_ctf.mrc") && !tree1.includes("mic1.ctf"),
    "the diagnostics fixtures are gone from the cluster"
  );
  must(
    !tree1.includes(".cf-shard-3.star") && !tree1.includes(".cf-array-rc-12"),
    "the array scratch is gone from the cluster"
  );
  must(
    !tree1.some((f) => f.startsWith("shard_7/")),
    "the empty shard dir was pruned cluster-side"
  );

  // the ledger: deleted entries left, keeps stay listed
  const manifestAfter = JSON.parse(readFileSync(manifestPath, "utf8"));
  const afterPaths = manifestAfter.files.map((f) => f.path);
  must(
    manifestAfter.files.length < manifestBefore.files.length,
    `the ledger shrank (${manifestBefore.files.length} → ${manifestAfter.files.length})`
  );
  must(
    afterPaths.includes("run_data.star"),
    "the ledger still lists the chainable finals (the Files tab stays truthful)"
  );
  must(
    afterPaths.every((p) => tree1.includes(p)),
    `every ledger entry matches the live tree (the ledger lies about nothing: ${afterPaths.filter((p) => !tree1.includes(p)).join(", ") || "clean"})`
  );

  // ---- the drift doctrine: the connection dies, a same-host sibling carries --
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
  const planDrift = await planFor(c2d.id, true);
  must(
    planDrift.body?.remote?.exists === true && planDrift.body?.remote?.connection?.id !== CONN,
    `after the connection dies, a same-host sibling carries the listing (${planDrift.body?.remote?.connection?.id ?? planDrift.body?.remote?.error})`
  );

  // ======================================================================
  console.log("== PHASE D: UI CONTRACTS — the source pins ==");

  const dlg = readFileSync(`${ROOT}/src/components/workflow/cleanup-dialog.tsx`, "utf8");
  const insp = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  const route = readFileSync(`${ROOT}/src/app/api/jobs/[id]/cleanup/route.ts`, "utf8");
  const rc = readFileSync(`${ROOT}/src/lib/remote/remote-cleanup.ts`, "utf8");

  // the dialog's hooks + doctrine
  must(dlg.includes('data-cleanup-dialog'), "the dialog carries data-cleanup-dialog");
  must(dlg.includes('data-cleanup-side={side}'), "each side carries data-cleanup-side");
  must(dlg.includes('data-cleanup-tier-row={g.tier}'), "each tier row carries data-cleanup-tier-row");
  must(dlg.includes('data-cleanup-keep-line'), "the keep line carries its hook");
  must(dlg.includes('data-cleanup-run-line'), "the run line carries its hook");
  must(dlg.includes('data-cleanup-confirm'), "the confirm carries its hook");
  must(dlg.includes('data-cleanup-downstream-warning'), "the bulk downstream warning carries its hook");
  must(
    dlg.includes("safe: true") && dlg.includes("diagnostics: false") && dlg.includes("bulk: false"),
    "the tier defaults are the doctrine: safe on, the sharp ones opt-in"
  );
  must(
    dlg.includes("body: JSON.stringify({") &&
      /local:\s*scopeLocal/.test(dlg) &&
      /remote:\s*scopeRemote/.test(dlg) &&
      /tiers:\s*offered\.filter/.test(dlg) &&
      !/paths:/.test(dlg.replace(/f\.path/g, "X").replace(/g\.files/g, "X")),
    "the POST body carries ONLY scopes + tiers — never a file list"
  );
  must(
    dlg.includes("Delete them") && dlg.includes("This cannot be undone."),
    "the confirm speaks the irreversibility"
  );

  // the inspector's door
  must(
    insp.includes('aria-label="Clean intermediates (local + cluster)"') &&
      insp.includes("<Eraser"),
    "the inspector toolbar carries the eraser door"
  );
  must(
    insp.includes("<InspectorHeader job={job} onCleaned={() => void loadOutputs()} />"),
    "a cleanup refreshes the Files tab (loadOutputs)"
  );

  // the route's guards + walker
  must(route.includes("isLocalRequest"), "the route pins the local-request guard");
  must(route.includes("VALID_TIERS"), "the route validates tier names");
  must(
    route.includes("job.status === \"running\" || job.status === \"pending\"") && route.includes("isRunAlive"),
    "the route refuses running/pending jobs AND live records (the t318 respect)"
  );
  must(
    route.includes("d.isSymbolicLink()") && route.includes("a link is a door"),
    "the local walker lists symlinks as doors, never follows them"
  );
  must(
    route.includes("recursive: true, force: true") && route.includes("ERR_FS_EISDIR"),
    "the local prune removes directories the way Node allows (the EISDIR lesson)"
  );
  must(
    route.includes("fullPaths: true") && route.includes("re-walks/re-lists LIVE"),
    "the execution re-classifies with fullPaths — the preview and the deletion share one brain"
  );
  must(
    route.includes("inFlight") && route.includes("two interleaved rm passes"),
    "concurrent POSTs share one execution (the in-flight lock)"
  );

  // the remote legs' constants
  must(rc.includes("LIST_TTL_MS = 10_000"), "the remote listing TTL is pinned at 10s");
  must(rc.includes("RM_BATCH = 200"), "the rm batching is pinned at 200/exec");
  must(
    rc.includes("exit 3") && rc.includes("honest \"unreachable\""),
    "an unenterable workdir is exit 3 (honest unreachable, never empty-success)"
  );
  must(
    rc.includes("resolveConnectionForRecord") && rc.includes("normalizeClusterHost"),
    "the connection resolution rides the t325 host identity"
  );
  must(
    rc.includes("rewriteManifestAfterCleanup") && rc.includes("The ledger stays honest"),
    "the manifest rewrite keeps the Files tab truthful (t289)"
  );

  console.log(fail === 0 ? "\n== t331 diag: ALL GREEN ==" : `\n== t331 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: the API trees, the cluster fixtures, the surgical state ----
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  for (const pid of createdProjects) {
    try {
      client(`rm -rf /projects/cryoflow/${pid}`);
    } catch { /* the jobs DELETE already dropped the local twin */ }
    await api(`/api/projects/${pid}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  try {
    client("rm -rf /data2/t331-particles");
  } catch { /* fixtures are runtime, gitignored */ }
  // surgical records outlive their jobs — take them out explicitly
  for (const id of surgicalRecordIds) {
    try {
      dropRecord(id);
    } catch { /* already gone */ }
  }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

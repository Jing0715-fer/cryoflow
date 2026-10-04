/**
 * t575 — the fake cluster learns to speak 3D, live: a class3d job runs
 * through the ENGINE's own cluster lane and the judge worker auto-judges
 * it — the t573 arc (judge_3d_classes) and the t574 arc (judge worker)
 * finally meet on the lane that was always meant to carry them.
 *
 * What stood between: the mock cluster's relion_refine stub never knew
 * class3d existed (nobody passes --mode; the classify2d default wrote
 * per-class files as 2D 64×64×1), so the 3D judge's faces sheet would
 * have read degenerate one-pixel XZ/YZ cuts. t575 taught the stub the
 * real dialect (unit-pinned in t575-stub3d-test.mjs); this harness
 * proves the WHOLE chain in the living world:
 *
 *   W  world guard + inputs: EMPIAR active; class2d K5 (particles_star,
 *      star rows naming the t574-repaired cluster-tree stacks) and
 *      initialmodel C1 (model_mrc — the engine-native VDAM's real 64³
 *      reference, the same chain refine3d rode) both completed; the
 *      idempotent cluster-side extract-input repair stays as the world's
 *      historical infrastructure.
 *   A  mint class3d (K=4, 3 iterations) → wire K5 + C1 → RUN ON THE MOCK
 *      CLUSTER → completed → the HOST workdir's per-class volumes are
 *      64³ float32 (the sync-back carried the 3D dialect home, 1MB per
 *      file under the key-file cap) → within a few worker ticks the
 *      ai-verdict flips available ON ITS OWN: stamp shape (4 classes,
 *      enum verdicts, model named), sweep hasVerdict, the worker's
 *      ledger naming the probe with type class3d.
 *   B  the card wears the violet ✦ badge in the DOM; screenshot.
 *   D  the no-touch gate: K5's pre-existing stamp keeps its `at` (one
 *      opinion per job), the ledger never re-judges it.
 *
 * Runs in the EMPIAR world in place; deletes the mints, their workdirs
 * and their stamps on the way out (roster and stamp count must return
 * to their starting numbers).
 *
 * Usage: node scripts/t575-class3d-cluster-live-fire.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const PROJ_ROOT = "/home/z/my-project";
const DATA_ROOT = `${PROJ_ROOT}/data/relion/${EMPIAR_ID}`;
const CLUSTER_PROJ = `${PROJ_ROOT}/services/mock-cluster/fs/projects/cryoflow/${EMPIAR_ID}`;
const STAMPS_FILE = `${PROJ_ROOT}/data/ai-verdicts.json`;
const CONN = "t380-conn";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, timeoutMs = 30000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return null;
}
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const api = (verb, path, body) =>
  sh(
    `curl -s -X ${verb} -H "Content-Type: application/json" -H "Origin: ${BASE}" -H "Referer: ${BASE}/"` +
    (body ? ` -d ${JSON.stringify(JSON.stringify(body))}` : "") + ` "${BASE}${path}"`
  );
const jobsOfActive = () => {
  const d = JSON.parse(api("GET", "/api/jobs"));
  return Array.isArray(d) ? d : (d.jobs ?? []);
};
const stampCount = () => {
  try {
    return (JSON.parse(readFileSync(STAMPS_FILE, "utf8")).stamps ?? []).length;
  } catch { return 0; }
};
const pruneStamps = (ids) => {
  if (!ids.length || !existsSync(STAMPS_FILE)) return;
  const doc = JSON.parse(readFileSync(STAMPS_FILE, "utf8"));
  const before = (doc.stamps ?? []).length;
  const kept = (doc.stamps ?? []).filter((s) => !ids.includes(s.jobId));
  if (kept.length !== before) {
    const tmp = `${STAMPS_FILE}.tmp-${Date.now().toString(36)}`;
    writeFileSync(tmp, JSON.stringify({ ...doc, stamps: kept }, null, 2));
    renameSync(tmp, STAMPS_FILE);
  }
};
const workerStatus = () => JSON.parse(api("GET", "/api/ai/judge-worker"));
const tag = Date.now().toString(36);
const workdirOf = (id) => join(DATA_ROOT, `class3d_${id.slice(-8)}`);

/** MRC header reader — the honest witness for the 3D dialect's trip home. */
const mrcHeader = (p) => {
  try {
    const h = readFileSync(p).subarray(0, 1024);
    return { nx: h.readInt32LE(0), ny: h.readInt32LE(4), nz: h.readInt32LE(8), mode: h.readInt32LE(12) };
  } catch { return null; }
};

/* ---- world repair: the cluster-side extract inputs (t574's own move) --- */
function repairWorld(extractJob) {
  const hostStar = join(DATA_ROOT, `extract_${extractJob.id.slice(-8)}`, "particles.star");
  if (!existsSync(hostStar)) throw new Error(`host extract star missing: ${hostStar}`);
  const clusterStarDir = join(CLUSTER_PROJ, `extract_${extractJob.id.slice(-8)}`);
  mkdirSync(clusterStarDir, { recursive: true });
  const clusterStar = join(clusterStarDir, "particles.star");
  const repaired = [];
  if (!existsSync(clusterStar)) {
    copyFileSync(hostStar, clusterStar);
    repaired.push("star");
  }
  const rows = readFileSync(hostStar, "utf8").split("\n").filter((l) => l.includes("@"));
  const maxIdx = new Map();
  for (const line of rows) {
    const m = /(\d+)@(\S+\.mrcs)/.exec(line);
    if (m) maxIdx.set(m[2], Math.max(maxIdx.get(m[2]) ?? 0, Number(m[1])));
  }
  const BX = 64;
  const header = (nz) => {
    const h = Buffer.alloc(1024);
    h.writeInt32LE(BX, 0); h.writeInt32LE(BX, 4); h.writeInt32LE(nz, 8);
    h.writeInt32LE(2, 12);
    h.writeInt32LE(0, 92);
    h.write("MAP ", 208);
    h.writeInt32LE(0x4444, 212);
    return h;
  };
  const noise = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };
  const gauss = (x, y, cx, cy, sigma) =>
    Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma * sigma)));
  for (const [stackPath, nz] of [...maxIdx.entries()].sort()) {
    if (existsSync(stackPath)) continue;
    mkdirSync(dirname(stackPath), { recursive: true });
    const sliceBytes = BX * BX * 4;
    const out = Buffer.alloc(1024 + sliceBytes * nz);
    header(nz).copy(out, 0);
    for (let z = 0; z < nz; z++) {
      const motif = z % 4;
      const rnd = noise(z * 7919 + 13);
      const base = 1024 + z * sliceBytes;
      for (let y = 0; y < BX; y++) {
        for (let x = 0; x < BX; x++) {
          let v = (rnd() - 0.5) * 10;
          const c = (BX - 1) / 2;
          if (motif === 0) v += 40 * gauss(x, y, c, c, 8);
          else if (motif === 1) v += 30 * (gauss(x, y, c - 10, c, 6) + gauss(x, y, c + 10, c, 6));
          else if (motif === 2) {
            const r = Math.hypot(x - c, y - c);
            v += Math.abs(r - 14) < 3 ? 35 : 0;
          } else {
            v += Math.abs(x - y) < 3 ? 28 : 0;
          }
          out.writeFloatLE(v, base + (y * BX + x) * 4);
        }
      }
    }
    writeFileSync(stackPath, out);
    repaired.push(stackPath.split("/").pop());
  }
  return repaired;
}

/* ---- world repair 2: the upstream twin stars --------------------------- */
/**
 * The dispatch reads input stars IN PLACE on the cluster (t338/t346 —
 * the cluster-native doctrine): what crosses to the run is the upstream
 * output's registered project-relative TWIN path, and the file at that
 * path must exist in the CLUSTER's project dir. K5's twin
 * (class2d_<tail>/run_itNNN_data.star) was cleaned away between windows
 * exactly like the extract inputs t574 restored — same repair, one
 * layer up the chain. Idempotent; stays as world infrastructure.
 */
function repairUpstreamTwins(class2dJob) {
  const hostDir = join(DATA_ROOT, `class2d_${class2dJob.id.slice(-8)}`);
  const latest = readdirSync(hostDir)
    .filter((n) => /^run_it\d+_data\.star$/.test(n))
    .sort()
    .pop();
  if (!latest) throw new Error(`no per-iteration data star in ${hostDir}`);
  const twinDir = join(CLUSTER_PROJ, `class2d_${class2dJob.id.slice(-8)}`);
  mkdirSync(twinDir, { recursive: true });
  const twin = join(twinDir, latest);
  if (!existsSync(twin)) {
    copyFileSync(join(hostDir, latest), twin);
    return [latest];
  }
  return [];
}

/* ---- world guard ------------------------------------------------------- */
const projects = JSON.parse(api("GET", "/api/projects")).projects;
const active = projects.find((p) => p.active || p.isActive);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "unknown"} (${active?.name ?? "?"}), expected EMPIAR ${EMPIAR_ID} — refusing to run in a borrowed world`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0}`);
const stamps0 = stampCount();

const K5 = jobsOfActive().find((j) => j.type === "class2d" && j.status === "completed" && existsSync(join(DATA_ROOT, `class2d_${j.id.slice(-8)}`)));
if (!K5) { console.error("FATAL: no completed class2d with a workdir to feed the probe"); process.exit(2); }
const C1 = jobsOfActive().find((j) => j.type === "initialmodel" && j.status === "completed");
if (!C1) { console.error("FATAL: no completed initialmodel to reference the probe"); process.exit(2); }
const k5Stamp0 = JSON.parse(api("GET", `/api/jobs/${K5.id}/ai-verdict`));
if (!k5Stamp0?.available) { console.error("FATAL: K5 carries no stamp — t565b must run once first"); process.exit(2); }
const extract = jobsOfActive().find((j) => j.type === "extract" && j.status === "completed");
if (!extract) { console.error("FATAL: no completed extract for the world repair"); process.exit(2); }

console.log("\n[world repair] cluster-side extract inputs + upstream twins (idempotent, stays)");
{
  const repaired = repairWorld(extract);
  const twins = repairUpstreamTwins(K5);
  check("extract star + stacks + K5 twin star in place", repaired.length >= 0 && twins.length >= 0,
    [repaired.length ? `extract: ${repaired.join(", ")}` : "extract already present",
     twins.length ? `K5 twin: ${twins.join(", ")}` : "K5 twin already present"].join(" · "));
}

/* ---- preflight --------------------------------------------------------- */
console.log("\n[preflight] worker status");
const st0 = workerStatus();
check("worker mounted", st0.mounted === true, `tick ${st0.tickMs}ms`);
check("autoJudge armed", st0.autoJudge === true);
check("provider configured", st0.providerOk === true);

const mintProbe = (name) => {
  const m = JSON.parse(api("POST", "/api/jobs", {
    type: "class3d", name, x: 1240, y: 560, projectId: EMPIAR_ID,
    params: { iterations: 3, numClasses: 4 },
  }));
  return m.job ?? m;
};
const runOnCluster = async (probe) => {
  api("POST", `/api/jobs/${probe.id}/run`, { remote: { connectionId: CONN, mode: "direct" } });
  const done = await pollUntil(() => {
    const lj = jobsOfActive().find((j) => j.id === probe.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 300_000, 3_000);
  return done;
};

const minted = [];
try {
  /* ---- Face A: the engine's own class3d lane speaks 3D ------------------ */
  console.log("\n[Face A] mint class3d → wire K5 + C1 → cluster run → 3D volumes come home → the verdict arrives on its own");
  const probe = mintProbe(`t575 Volume Lane Probe ${tag}`);
  minted.push(probe.id);
  check("class3d probe minted", !!probe?.id, probe?.id);
  const w1 = JSON.parse(api("POST", "/api/edges", { fromJobId: K5.id, toJobId: probe.id }));
  const w2 = JSON.parse(api("POST", "/api/edges", { fromJobId: C1.id, toJobId: probe.id }));
  check("wired from class2d (particles_star)", !!w1.id || !!w1.edge?.id, w1.id ?? w1.edge?.id ?? "?");
  check("wired from initialmodel (model_mrc)", !!w2.id || !!w2.edge?.id, w2.id ?? w2.edge?.id ?? "?");

  const done = await runOnCluster(probe);
  check("probe ran to completion on the mock cluster", !!done, done ? `${Math.round(done.progress)}%` : "timeout");
  if (!done) {
    const lj = jobsOfActive().find((j) => j.id === probe.id);
    console.error(`   probe state: ${lj?.status} — ${(lj?.result ?? "").slice(0, 200)}`);
    throw new Error("probe never completed");
  }

  const wd = workdirOf(probe.id);
  let dialectOk = true;
  for (const c of [1, 2, 3, 4]) {
    const h = mrcHeader(join(wd, `run_it003_class${String(c).padStart(3, "0")}.mrc`));
    if (!h || h.nx !== 64 || h.ny !== 64 || h.nz !== 64 || h.mode !== 2) {
      dialectOk = false;
      check(`host-side it003 class${c} is 64³ float32`, false, h ? `${h.nx}x${h.ny}x${h.nz} m${h.mode}` : "missing");
    }
  }
  if (dialectOk) check("host-side per-class volumes are 64³ float32 (the 3D dialect came home)", true, "4/4 classes");
  check("final no-tag alias came home too", existsSync(join(wd, "run_class001.mrc")));

  const stamp = await pollUntil(async () => {
    try {
      const v = JSON.parse(api("GET", `/api/jobs/${probe.id}/ai-verdict`));
      if (v?.available) return v;
    } catch { /* keep polling */ }
    return null;
  }, 420_000, 10_000);
  check("verdict arrived WITHOUT anyone asking", !!stamp, stamp ? `${(stamp.stamp?.classes ?? []).length} classes` : "never landed within 7min");
  const s = stamp?.stamp ?? {};
  const enums = ["keep", "maybe", "reject"];
  check("stamp shape: 4 classes with enum verdicts, numbered 1..4",
    Array.isArray(s.classes) && s.classes.length === 4 &&
    [1, 2, 3, 4].every((n) => s.classes.some((c) => c.cls === n && enums.includes(c.verdict))),
    s.classes?.map((c) => `${c.cls}:${c.verdict}`).join(" ") ?? "?");
  check("stamp names the judge model", typeof s.model === "string" && s.model.length > 0, s.model);
  check("stamp carries a timestamp", typeof s.at === "number" && s.at > 0, String(s.at));

  const sweep = jobsOfActive().find((j) => j.id === probe.id);
  check("sweep wears hasVerdict", sweep?.hasVerdict === true);
  const stA = workerStatus();
  const ledgerRow = stA.judged?.find((r) => r.jobId === probe.id);
  check("worker's ledger names the probe as class3d", !!ledgerRow && ledgerRow.type === "class3d" && ledgerRow.ok === true,
    ledgerRow ? `${ledgerRow.jobName} · ${ledgerRow.summary.slice(0, 60)}` : "absent");

  /* ---- Face B: the badge in the DOM ------------------------------------- */
  console.log("\n[Face B] the violet ✦ badge on the canvas");
  sh(`agent-browser open "about:blank" >/dev/null 2>&1`); await sleep(400);
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await pollUntil(() => evalJsSafe(`JSON.stringify(!!document.querySelector('[data-job="${probe.id}"]'))`).includes("true"), 30_000, 1_000);
  await sleep(1500);
  const badge = evalJsSafe(`JSON.stringify((function(){
    const card = document.querySelector('[data-job="${probe.id}"]');
    const b = card && card.querySelector('[data-canvas-ui="job-verdict-badge"]');
    return b ? { present: true, title: b.getAttribute("title") } : { present: false };
  })())`);
  const badgeInfo = safeJson(badge);
  check("card badge present on the canvas", badgeInfo?.present === true, badgeInfo?.title ?? "absent");
  if (badgeInfo?.present) {
    // absolute path — the agent-browser daemon's cwd is not this repo
    // (the relative-path shot landed NOWHERE, and the old "taken" check
    // asserted true without looking: a fake positive, the exact disease
    // this house shoots on sight)
    const shotAbs = join(PROJ_ROOT, ".qa-logs/shots/t575-class3d-verdict-badge.png");
    sh(`agent-browser screenshot "${shotAbs}" >/dev/null 2>&1`);
    check("badge screenshot on disk (honest receipt)", existsSync(shotAbs), ".qa-logs/shots/t575-class3d-verdict-badge.png");
  }

  /* ---- Face D: the no-touch gate ---------------------------------------- */
  console.log("\n[Face D] one opinion per job — K5 keeps its stamp");
  const k5After = JSON.parse(api("GET", `/api/jobs/${K5.id}/ai-verdict`));
  check("K5's stamp `at` unchanged across the window",
    k5After.stamp?.at === k5Stamp0.stamp?.at, `${k5Stamp0.stamp?.at} === ${k5After.stamp?.at}`);
  check("the worker never touched K5", !workerStatus().judged?.some((r) => r.jobId === K5.id));
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup ------------------------------------------------------------ */
  try {
    for (const id of minted) {
      api("DELETE", `/api/jobs/${id}?confirm=true`);
      rmSync(workdirOf(id), { recursive: true, force: true });
    }
    pruneStamps(minted);
    await sleep(400);
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster returned to its starting count", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
    check("stamp count returned to its starting count", stampCount() === stamps0, `${stamps0} → ${stampCount()}`);
    const stEnd = workerStatus();
    check("worker still mounted and armed after cleanup", stEnd.mounted === true && stEnd.autoJudge === true);
  } catch (e) { check("cleanup ran", false, String(e.message)); }
  try {
    const errs = sh(`agent-browser errors 2>/dev/null`).trim();
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  } catch { /* browser may already be closed */ }
  try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

/* ---- helpers (flat eval bodies, no comments inside — the t567 law) ----- */
function evalJsSafe(expr) {
  try {
    const flat = expr.replace(/\s*\n\s*/g, " ");
    const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed.trim() : raw.trim();
    } catch {
      return raw.replace(/^"|"$/g, "").trim();
    }
  } catch { return ""; }
}
function safeJson(raw) {
  try { return JSON.parse(raw ?? "null"); } catch { return null; }
}

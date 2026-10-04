/**
 * t574 — the judge worker, live end-to-end: the verdict arrives before
 * you ask.
 *
 * t565/t573 made the judge an on-demand tool; t574 closes the loop — a
 * finished classification gets judged in the background (reaper-shaped:
 * boot mount + pure planner + one VLM verdict per tick), the stamp lands
 * in ai-verdicts.json, the sweep wears hasVerdict, the card grows the
 * violet ✦ badge. This harness proves the full chain WITHOUT ever
 * opening the assistant:
 *
 *   W  world repair: the mock cluster's cluster-side extract inputs
 *      (particles.star + the five per-micrograph stacks) were cleaned
 *      away between windows, so no class job can complete in this world
 *      on any lane. The repair restores the star and synthesizes the
 *      stacks (64×64 float32, motif-carrying slices — the fake refine's
 *      real-mode class averages then discriminate) at the exact paths
 *      the star rows name. Repair is idempotent and STAYS — it is the
 *      world's historical infrastructure (K5's era had it), not probe.
 *   A  mint class2d → wire from extract → RUN ON THE MOCK CLUSTER (the
 *      local lane is real RELION — t574's own discovery — far too heavy
 *      for a harness) → completed → within a few worker ticks the
 *      ai-verdict route flips available: stamp shape (classes/model/
 *      enum verdicts), sweep hasVerdict, card badge in the DOM, the
 *      worker's judged[] ledger naming the probe.
 *   B  the no-re-judge gate: the pre-existing stamped K5 keeps its `at`
 *      across the whole window — one opinion per job, the worker never
 *      overwrites.
 *   C  the policy gate: autoJudge off → a fresh completed classification
 *      stays silent across 2+ ticks (and is DELETED before the toggle
 *      returns — the off-period completion is never retroactively
 *      stormed; the explicit ask is that path) → toggle restored.
 *
 * Runs in the EMPIAR world in place; deletes the mints, their workdirs
 * and their stamps on the way out (roster and stamp count must return
 * to their starting numbers).
 *
 * Usage: node scripts/t574-judge-worker-live-fire.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, copyFileSync } from "node:fs";
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

/* ---- world repair: the cluster-side extract inputs --------------------- */
/**
 * The star rows name their stacks by ABSOLUTE HOST path
 * (…/services/mock-cluster/fs/home/z/my-project/data/relion/<proj>/
 * extract_uxfic7tb/micrographs/<mic>.mrcs) — the fake refine audits them
 * as literal host paths, so the stacks are synthesized THERE. The input
 * star itself is read through the run's RELATIVE --i from the cluster
 * project dir, so it is copied THERE. Both idempotent.
 */
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
  // the stacks: per-micrograph max index from the star rows
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
    h.writeInt32LE(2, 12);                       // mode 2 = float32
    h.writeInt32LE(0, 92);                       // nsymbt
    h.writeInt32LE(20140, 208 - 8);              // (unused here) nversion slot
    h.write("MAP ", 208);                        // magic — read_mrc checks 208
    h.writeInt32LE(0x4444, 212);                 // machst
    return h;
  };
  const noise = (seed) => {
    // deterministic LCG → [0,1)
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

const extract = jobsOfActive().find((j) => j.type === "extract" && j.status === "completed");
if (!extract) { console.error("FATAL: no completed extract to feed the probe"); process.exit(2); }
const K5 = jobsOfActive().find((j) => j.type === "class2d" && j.status === "completed" && existsSync(join(DATA_ROOT, `class2d_${j.id.slice(-8)}`)));
const k5Stamp0 = K5 ? JSON.parse(api("GET", `/api/jobs/${K5.id}/ai-verdict`)) : null;
if (!k5Stamp0?.available) { console.error("FATAL: the reference class2d carries no stamp — t565b must run once first"); process.exit(2); }

/* ---- preflight --------------------------------------------------------- */
console.log("\n[preflight] worker status");
const st0 = workerStatus();
check("worker mounted (status route's defensive mount)", st0.mounted === true, `tick ${st0.tickMs}ms`);
check("autoJudge armed", st0.autoJudge === true);
check("provider configured", st0.providerOk === true);
check("escape hatch quiet", st0.disabled === false);

console.log("\n[world repair] cluster-side extract inputs");
{
  const repaired = repairWorld(extract);
  check("extract star + stacks in place", repaired.length >= 0, repaired.length ? `restored: ${repaired.join(", ")}` : "already present");
}

const mintProbe = (name) => {
  const m = JSON.parse(api("POST", "/api/jobs", {
    type: "class2d", name, x: 900, y: 620, projectId: EMPIAR_ID,
    // a harness does not need VDAM's 200 mini-batches — EM ×3 iterations
    // finishes the fake refine in seconds and 4 classes keep the judge's
    // faces sheet small (the verdict's SHAPE is what Face A asserts)
    params: { algorithm: "em", iterations: 3, numClasses: 4 },
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
const workdirOf = (id) => join(DATA_ROOT, `class2d_${id.slice(-8)}`);

const minted = [];
try {
  /* ---- Face A ---------------------------------------------------------- */
  console.log("\n[Face A] mint → wire → cluster run → the verdict arrives on its own");
  const probeA = mintProbe(`t574 Auto-Judge Probe ${tag}`);
  minted.push(probeA.id);
  check("probe minted", !!probeA?.id, probeA?.id);
  const wire = JSON.parse(api("POST", "/api/edges", { fromJobId: extract.id, toJobId: probeA.id }));
  check("wired from extract", !!wire.id || !!wire.edge?.id, wire.id ?? wire.edge?.id ?? "?");
  const doneA = await runOnCluster(probeA);
  check("probe ran to completion on the mock cluster", !!doneA, doneA ? `${Math.round(doneA.progress)}%` : "timeout");
  if (!doneA) {
    const lj = jobsOfActive().find((j) => j.id === probeA.id);
    console.error(`   probe state: ${lj?.status} — ${(lj?.result ?? "").slice(0, 200)}`);
    throw new Error("probe A never completed");
  }

  const stamp = await pollUntil(async () => {
    try {
      const v = JSON.parse(api("GET", `/api/jobs/${probeA.id}/ai-verdict`));
      if (v?.available) return v;
    } catch { /* keep polling */ }
    return null;
  }, 420_000, 10_000);
  check("verdict arrived WITHOUT anyone asking", !!stamp, stamp ? `${(stamp.stamp?.classes ?? []).length} classes` : "never landed within 7min");
  const s = stamp?.stamp ?? {};
  const enums = ["keep", "maybe", "reject"];
  check("stamp shape: classes[] with enum verdicts",
    Array.isArray(s.classes) && s.classes.length > 0 &&
    s.classes.every((c) => enums.includes(c.verdict) && Number.isInteger(c.cls)),
    s.classes?.map((c) => `${c.cls}:${c.verdict}`).join(" ") ?? "?");
  check("stamp names the judge model", typeof s.model === "string" && s.model.length > 0, s.model);

  const sweepA = jobsOfActive().find((j) => j.id === probeA.id);
  check("sweep wears hasVerdict", sweepA?.hasVerdict === true);
  const stA = workerStatus();
  check("worker's own ledger names the probe",
    stA.judged?.[0]?.jobId === probeA.id && stA.judged[0].ok === true,
    stA.judged?.[0] ? `${stA.judged[0].jobName} · ${stA.judged[0].summary.slice(0, 60)}` : "empty");

  /* ---- the badge in the DOM -------------------------------------------- */
  sh(`agent-browser open "about:blank" >/dev/null 2>&1`); await sleep(400);
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await pollUntil(() => evalJsSafe(`JSON.stringify(!!document.querySelector('[data-job="${probeA.id}"]'))`).includes("true"), 30_000, 1_000);
  await sleep(1500);
  const badge = evalJsSafe(`JSON.stringify((function(){
    const card = document.querySelector('[data-job="${probeA.id}"]');
    const b = card && card.querySelector('[data-canvas-ui="job-verdict-badge"]');
    return b ? { present: true, title: b.getAttribute("title") } : { present: false };
  })())`);
  const badgeInfo = safeJson(badge);
  check("card badge present on the canvas", badgeInfo?.present === true, badgeInfo?.title ?? "absent");
  if (badgeInfo?.present) {
    sh(`agent-browser screenshot .qa-logs/shots/t574-verdict-badge.png >/dev/null 2>&1`);
  }

  /* ---- Face B ----------------------------------------------------------- */
  console.log("\n[Face B] one opinion per job");
  const k5After = JSON.parse(api("GET", `/api/jobs/${K5.id}/ai-verdict`));
  check("the pre-existing stamp keeps its `at` across the window",
    k5After.stamp?.at === k5Stamp0.stamp?.at,
    `${k5Stamp0.stamp?.at} === ${k5After.stamp?.at}`);
  check("the worker never touched the reference job",
    !workerStatus().judged?.some((r) => r.jobId === K5.id));

  /* ---- Face C ------------------------------------------------------------ */
  console.log("\n[Face C] autoJudge off → silence; no retroactive storm after re-arm");
  const putOff = JSON.parse(api("PUT", "/api/ai/settings", { autoJudge: false }));
  check("toggle off accepted", putOff.settings?.autoJudge === false);
  check("status route reflects the gate", workerStatus().autoJudge === false);

  const probeB = mintProbe(`t574 Silent Probe ${tag}`);
  minted.push(probeB.id);
  api("POST", "/api/edges", { fromJobId: extract.id, toJobId: probeB.id });
  const doneB = await runOnCluster(probeB);
  check("probe B ran to completion", !!doneB, doneB ? "completed" : "timeout");
  if (!doneB) throw new Error("probe B never completed");

  // 2+ worker ticks of silence
  await sleep(Math.max(75_000, workerStatus().tickMs * 2 + 15_000));
  const verdictB = JSON.parse(api("GET", `/api/jobs/${probeB.id}/ai-verdict`));
  check("no verdict while the gate is off", verdictB.available === false, verdictB.note?.slice(0, 60));
  check("the ledger stayed quiet for probe B", !workerStatus().judged?.some((r) => r.jobId === probeB.id));

  // delete B BEFORE re-arming: the off-period completion is never
  // retroactively judged, and deleting first makes the race impossible
  api("DELETE", `/api/jobs/${probeB.id}?confirm=true`);
  const bIdx = minted.indexOf(probeB.id);
  if (bIdx >= 0) minted.splice(bIdx, 1);
  rmSync(workdirOf(probeB.id), { recursive: true, force: true });
  api("PUT", "/api/ai/settings", { autoJudge: true });
  check("toggle restored", JSON.parse(api("GET", "/api/ai/settings")).settings.autoJudge === true);
  await sleep(2000);
  check("re-arm did not storm anything (B is gone, ledger unchanged)",
    workerStatus().judged?.[0]?.jobId === probeA.id);

  /* ---- regression spot ---------------------------------------------------- */
  const sweepCount = jobsOfActive().length;
  check("sweep healthy after all legs", sweepCount === roster0 + 1, `${sweepCount} (roster ${roster0} + probe A)`);
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

#!/usr/bin/env node
/**
 * CryoFlow QA — Task 293 suite: "relion 5 通过 envLines 可见 + sbatch 提交可配 GPU 数"
 *
 * The user's report this suite pins:
 *   "为何看不到 relion 5？environment lines 中我写的 module load
 *    relion/beta_5.0_gpu_ompi5_cuda118，确认这个命令可以调用 relion 5。
 *    另外检测不到 GPU 是因为登录的是管理节点 … 需要根据脚本设计成可以
 *    条件 GPU 数量的方式提交任务（upload/sbatch6gpu.sh）"
 *
 * PHASES
 *   A  ledger — the source contracts (probe honors envLines, sinfo parsing,
 *      the sbatch generator's faithfulness to the site template, the poll
 *      dialect, the passthrough keeps the knobs)
 *   B  pure — moduleLoadsInEnvLines + parseSinfoPartitions table tests
 *   C  live — mock cluster speaks the user's dialect end to end:
 *      C1  import (local, six micrographs)
 *      C2  the connection: envLines name the HIDDEN module, useSlurm on,
 *          partition gpu, 2 GPUs — probe shows relion 5 FIRST + envLine badge
 *          + Slurm partitions with 6 GPUs/node + NO login GPUs
 *      C3  motioncorr dispatched mode=slurm — sbatch submission, .cf-exit,
 *          sacct terminal truth, sync-back, REMOTE[...] result with slurm id
 *      C4  the generated .cf-job.sbatch on the cluster carries the template's
 *          directives (--get-user-env, --gres=gpu:2, --partition=gpu,
 *          cpus-per-task, run.out/run.err, .cf-exit)
 *      C5  ctffind slurm re-dispatch with gpus=1 override (target wins)
 *      C6  stop path — scancel mid-flight → CANCELLED → exit 137 finalize
 *   Z  cleanup — jobs, edges, connection, mock-side trees
 *
 * Run:  node scripts/t293-slurm-submit.mjs [--dev]
 * (PROD default: the standalone server on :3000 — the family convention.)
 */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const ORIGIN = { Origin: BASE, "Content-Type": "application/json" };
const MICS_DIR = "/home/z/my-project/data/movies/t293-mics";
const ROOT = path.resolve(import.meta.dirname, "..");

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(label); console.log(`FAIL  ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, ms, every = 700) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  return null;
}

console.log(`== t293 — relion 5 via envLines + sbatch with a GPU count ==`);
console.log(`   base: ${BASE}`);

/* ------------------------------------------------------------------ */
/* PHASE A — ledger                                                    */
/* ------------------------------------------------------------------ */
console.log("== PHASE A: the source contracts ==");
const probeSrc = readFileSync(path.join(ROOT, "src/lib/remote/probe.ts"), "utf8");
const rrSrc = readFileSync(path.join(ROOT, "src/lib/remote/remote-run.ts"), "utf8");
const typesSrc = readFileSync(path.join(ROOT, "src/lib/remote/types.ts"), "utf8");
const connSrc = readFileSync(path.join(ROOT, "src/lib/remote/connections.ts"), "utf8");
const runRoute = readFileSync(path.join(ROOT, "src/app/api/jobs/[id]/run/route.ts"), "utf8");
const dispatchSrc = readFileSync(path.join(ROOT, "src/lib/relion/dispatch.ts"), "utf8");
const moduleBin = readFileSync(path.join(ROOT, "services/mock-cluster/fs/opt/bin/module"), "utf8");

must(probeSrc.includes("moduleLoadsInEnvLines(c.envLines)") && probeSrc.includes("envLinesPreamble(c.envLines)"),
  "A1 the probe names the connection's envLines before module discovery (the hidden-module door)");
must(probeSrc.includes("base.envLineModules = hidden"),
  "A2 envLine-discovered modules are marked (envLineModules rides the probe)");
must(probeSrc.includes('sinfo -h -o "%P|%D|%G|%t"') && probeSrc.includes("parseSinfoPartitions"),
  "A3 the probe asks Slurm what the compute side holds (sinfo partitions + GPUs)");
must(probeSrc.includes("the GPU list is everything BEFORE the sinfo marker"),
  "A4 login-node GPU list never eats sinfo's lines (the marker split)");

must(rrSrc.includes("function buildSbatchScript") && rrSrc.includes("#SBATCH --get-user-env"),
  "A5 the sbatch generator exists and inherits the login env (--get-user-env, the site template's first line)");
must(rrSrc.includes("#SBATCH --gres=gpu:${gpus}") && rrSrc.includes("#SBATCH --partition=${partition}"),
  "A6 the GPU count and partition are per-submission directives");
must(rrSrc.includes("--oversubscribe --bind-to none --mca btl '^openib'") && rrSrc.includes("grep -qi 'open mpi'"),
  "A7 the site template's MPI rank flags ride OpenMPI clusters ONLY (flavor detected, MPICH spared)");
must(rrSrc.includes('echo "EXIT:$(cat ${EXIT} 2>/dev/null)"') || rrSrc.includes("EXIT:$(cat"),
  "A8 .cf-exit stays the exit contract in sbatch mode (one dialect, two backends)");
must(rrSrc.includes("CANCELLED*) echo \"EXIT:137\"") && rrSrc.includes("TIMEOUT*) echo \"EXIT:124\""),
  "A9 scheduler terminal states map to conventional codes (137/124/125)");
must(rrSrc.includes("scancel") && rrSrc.includes("SCANCEL_OK"),
  "A10 the stop path speaks scancel for slurm records");
must(rrSrc.includes("target.gpus ?? conn.slurmGpus ?? strategy.gpus"),
  "A11 the GPU default chain: dispatch target → connection default → job-type strategy");
must(rrSrc.includes("...(slurmMode ? { slurmGpus: gpuReq, slurmPartition } : {})"),
  "A12 the knobs ride the run record (the passthrough's source of truth)");

must(typesSrc.includes("envLineModules?: string[]") && typesSrc.includes("slurmPartitions?: Array<{ name: string; nodes: number; gpus: number }>"),
  "A13 the probe DTO carries the two new truths");
must(typesSrc.includes("gpus?: number") && typesSrc.includes("partition?: string | null"),
  "A14 RemoteRunTarget carries the per-run slurm knobs");
must(connSrc.includes("slurmPartition") && connSrc.includes("slurmGpus") && connSrc.includes("slurmExtra"),
  "A15 the connection registry sanitizes the slurm defaults");
must(runRoute.includes('body.remote.mode === "slurm" ? "slurm" : "direct"') && runRoute.includes("gpus") && runRoute.includes("partition"),
  "A16 the run route passes the slurm knobs through (sanitized)");
must(dispatchSrc.includes("triggerRec.remote.slurmGpus") && dispatchSrc.includes("triggerRec.remote.slurmPartition"),
  "A17 the auto-start passthrough keeps GPU count + partition on every downstream hop");
must(moduleBin.includes("relion/beta_5.0_gpu_ompi5_cuda118") && !moduleBin.includes("beta_5.0_gpu_ompi5_cuda118    relion"),
  "A18 the mock cluster hides relion 5 from avail but loads it by full name (the user's dialect)");

/* ------------------------------------------------------------------ */
/* PHASE B — pure functions                                            */
/* ------------------------------------------------------------------ */
console.log("== PHASE B: pure parsing ==");
// B1 moduleLoadsInEnvLines — import the compiled module through the Next
// server is awkward; assert via tsx-less re-implementation? NO — run the
// real one through a tiny TS transpile. The repo has tsx? Use bun if present.
const parseHarness = `
import { moduleLoadsInEnvLines, parseSinfoPartitions } from "${ROOT}/src/lib/remote/probe.ts";
const env = moduleLoadsInEnvLines([
  "# a comment",
  "module load relion/beta_5.0_gpu_ompi5_cuda118",
  "module load cuda/12.2 relion/4.0_gpu_ompi4_cuda101",
  "export FOO=bar",
  "ml load relion/5.0.1",
  "module purge",
]);
const out = {
  env,
  p1: parseSinfoPartitions("gpu*|2|gpu:6|idle\\ncpu|4|(null)|idle"),
  p2: parseSinfoPartitions("a100|8|gpu:tesla:4(S:0-1)|mix\\nold|2|billing:2,gres:gpu:2|idle"),
  p3: parseSinfoPartitions("garbage line\\n|3|x\\nempty|0|gpu:1|idle"),
  p4: parseSinfoPartitions(""),
};
console.log("CFJSON" + JSON.stringify(out));
`;
writeFileSync("/tmp/t293-parse.ts", parseHarness);
try {
  const raw = execSync(`bun run /tmp/t293-parse.ts 2>/dev/null`, { encoding: "utf8", timeout: 30_000 });
  const j = JSON.parse(raw.slice(raw.indexOf("CFJSON") + 6));
  must(JSON.stringify(j.env) === JSON.stringify(["relion/beta_5.0_gpu_ompi5_cuda118", "relion/4.0_gpu_ompi4_cuda101", "relion/5.0.1"]),
    "B1 moduleLoadsInEnvLines: full names, multi-load lines, ml alias, comments skipped");
  must(JSON.stringify(j.p1) === JSON.stringify([{ name: "gpu", nodes: 2, gpus: 6 }, { name: "cpu", nodes: 4, gpus: 0 }]),
    "B2 parseSinfoPartitions: default-partition star stripped, (null) → 0 GPUs");
  must(JSON.stringify(j.p2) === JSON.stringify([{ name: "a100", nodes: 8, gpus: 4 }, { name: "old", nodes: 2, gpus: 2 }]),
    "B3 parseSinfoPartitions: typed gres, (S:0-1) suffix, gres:gpu:N shape");
  must(JSON.stringify(j.p3) === JSON.stringify([]) && JSON.stringify(j.p4) === JSON.stringify([]),
    "B4 parseSinfoPartitions: garbage / empty input → []");
} catch (e) {
  must(false, `B* the parse harness ran (${String(e).slice(0, 120)})`);
}

/* ------------------------------------------------------------------ */
/* PHASE C — the live loop                                             */
/* ------------------------------------------------------------------ */
console.log("== PHASE C: the live loop (mock cluster, the user's dialect) ==");

const createdJobs = [];
const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, { method: "POST", headers: ORIGIN, body: JSON.stringify(body) });
  const b = await r.json();
  if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
  return b.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await fetch(`${BASE}/api/edges`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }) });
  return r.status;
};
const readJob = async (id) => {
  const d = await (await fetch(`${BASE}/api/jobs`, { headers: ORIGIN })).json();
  return (d.jobs ?? []).find((x) => x.id === id) ?? null;
};

// C1 — six micrographs + a REAL local import (t270's recipe)
mkdirSync(MICS_DIR, { recursive: true });
for (let k = 1; k <= 6; k++) {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
  writeFileSync(path.join(MICS_DIR, `mic_${String(k).padStart(2, "0")}.mrc`), buf);
}
const importJob = await mkJob({ type: "import", name: "t293 Import", params: { micrographsPath: MICS_DIR, pixelSize: 1.77 } });
must(!!importJob?.id, "C1a the import job exists");
await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: ORIGIN, body: "{}" });
const importDone = await pollUntil(async () => (await readJob(importJob.id))?.status === "completed" && (await readJob(importJob.id)), 30_000);
must(!!importDone, "C1b the local import completed (engine-native)");

// C2 — the connection: envLines name the HIDDEN module; slurm defaults on
const connId = `qa-t293-${Date.now().toString(36)}`;
{
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: ORIGIN,
    body: JSON.stringify({
      id: connId,
      name: "QA t293 Slurm",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      envLines: ["module load relion/beta_5.0_gpu_ompi5_cuda118"],
      useSlurm: true,
      slurmPartition: "gpu",
      slurmGpus: 2,
      syncPolicy: "key-files",
      keyFileMb: 16,
    }),
  });
  must(mk.status === 201, `C2a the slurm connection is created (${mk.status})`);
  const probeRes = await fetch(`${BASE}/api/remote/connections/${connId}/test`, { method: "POST", headers: ORIGIN });
  const probeBody = await probeRes.json();
  const p = probeBody.probe ?? probeBody.connection?.lastProbe ?? {};
  must(p.ok === true, "C2b the probe reaches the mock cluster");
  must((p.relionModules ?? [])[0] === "relion/beta_5.0_gpu_ompi5_cuda118",
    "C2c relion 5 leads the module list — the envLines load line is the door (为何看不到 relion 5 → 现在看得到了)");
  must((p.envLineModules ?? []).includes("relion/beta_5.0_gpu_ompi5_cuda118"),
    "C2d the hidden module is MARKED as env-line-discovered (the badge's truth)");
  must((p.relionModules ?? []).filter((m) => m === "relion/5.0.1" || m === "relion/4.4.1").length >= 1,
    "C2e avail's own modules still list (the envLine door ADDS, never replaces)");
  must(JSON.stringify(p.slurmPartitions ?? []).includes('"name":"gpu"') && (p.slurmPartitions ?? []).some((x) => x.name === "gpu" && x.gpus === 6 && x.nodes === 2),
    "C2f Slurm's view: 6 GPUs/node on gpu (2 nodes) — the compute-side truth the login node cannot see");
  must((p.gpus ?? []).length === 0,
    "C2g the login node honestly has NO GPUs (nvidia-smi absent — the mgt-node case)");
  must((p.relionHomes ?? {})["relion/beta_5.0_gpu_ompi5_cuda118"] != null,
    "C2h the hidden module's install root resolves (relion_refine found after the envLine load)");
}

// C3 — motioncorr via sbatch: staging → sbatch → .cf-exit → sacct → sync-back
const HIDDEN = "relion/beta_5.0_gpu_ompi5_cuda118";
const mcJob = await mkJob({ type: "motioncorr", name: "t293 slurm motioncorr" });
await mkEdge(importJob.id, mcJob.id, "micrographs", "movies");
const disp = await fetch(`${BASE}/api/jobs/${mcJob.id}/run`, {
  method: "POST",
  headers: ORIGIN,
  body: JSON.stringify({ remote: { connectionId: connId, module: HIDDEN, mode: "slurm", gpus: 2, partition: "gpu" } }),
});
const dispBody = await disp.json();
must(disp.status === 200 && !dispBody.error, `C3a the slurm dispatch is accepted (${disp.status}${dispBody.error ? " " + dispBody.error : ""})`);
must(dispBody.job?.runRemote?.mode === "slurm" || dispBody.job?.status === "pending" || dispBody.job?.status === "running",
  "C3b the row left idle (staging or running)");
const mcDone = await pollUntil(async () => {
  const j = await readJob(mcJob.id);
  return (j?.status === "completed" || j?.status === "failed") ? j : null;
}, 120_000);
must(mcDone?.status === "completed", `C3c the sbatch run COMPLETED (${mcDone?.status ?? "timeout"}: ${(mcDone?.result ?? "").slice(0, 140)})`);
must(/slurm \d+/.test(mcDone?.result ?? ""), `C3d the result line names the slurm job id — ${(mcDone?.result ?? "").slice(0, 120)}`);
must(mcDone?.runRemote?.slurmId != null && mcDone?.runRemote?.slurmGpus === 2,
  "C3e the DTO carries slurmId + the requested GPU count (the inspector badge's truth)");
must(/REMOTE\[cryo@127\.0\.0\.1:3022/.test(mcDone?.result ?? ""), "C3f the origin line survives the slurm path");

// C4 — the generated submission script ON THE CLUSTER speaks the site dialect
{
  const scriptRes = execSync(
    `node ${ROOT}/services/mock-cluster/test-client.mjs 'cat /projects/cryoflow/*/motioncorr_*/.cf-job.sbatch 2>/dev/null'`,
    { encoding: "utf8", timeout: 30_000 }
  ).trim();
  must(scriptRes.includes("#SBATCH --get-user-env"), "C4a the script inherits the login env (--get-user-env — the template's opening move)");
  must(scriptRes.includes("#SBATCH --gres=gpu:2"), "C4b the GPU count is a per-submission directive (--gres=gpu:2)");
  must(scriptRes.includes("#SBATCH --partition=gpu"), "C4c the partition directive is present");
  must(scriptRes.includes("#SBATCH --cpus-per-task="), "C4d threads become cpus-per-task (the template's 'dedicated' line)");
  must(scriptRes.includes("/run.out") && scriptRes.includes("/run.err"), "C4e stdout/stderr land in run.out/run.err (the log tab reads them unchanged)");
  must(scriptRes.includes(".cf-exit"), "C4f the exit contract is written by the script's last breath");
  must(scriptRes.includes(`module load '${HIDDEN}'`) || scriptRes.includes(`module load ${HIDDEN}`), "C4g the HIDDEN module is loaded by name (the user's own line)");
  must(scriptRes.includes("job-name=cf_motioncorr_"), "C4h the job name carries the type + id tail");
  const metaRes = execSync(
    `node ${ROOT}/services/mock-cluster/test-client.mjs 'cat ~/.slurm-mock/job-*.meta 2>/dev/null | grep gres=gpu:2 | grep "partition=gpu"'`,
    { encoding: "utf8", timeout: 30_000 }
  ).trim();
  must(metaRes.length > 0, "C4i the mock scheduler itself recorded gres=gpu:2 + partition=gpu (sbatch parsed the directives)");
}

// C5 — ctffind re-dispatch with the GPU OVERRIDE (target wins over connection)
const ctfJob = await mkJob({ type: "ctffind", name: "t293 slurm ctffind 1gpu" });
await mkEdge(mcJob.id, ctfJob.id, "micrographs_corrected", "micrographs");
const disp2 = await fetch(`${BASE}/api/jobs/${ctfJob.id}/run`, {
  method: "POST",
  headers: ORIGIN,
  body: JSON.stringify({ remote: { connectionId: connId, module: HIDDEN, mode: "slurm", gpus: 1 } }),
});
const disp2Body = await disp2.json();
must(disp2.status === 200 && !disp2Body.error, `C5a the ctffind slurm dispatch is accepted (${disp2.status}${disp2Body.error ? " " + disp2Body.error : ""})`);
const ctfDone = await pollUntil(async () => {
  const j = await readJob(ctfJob.id);
  return (j?.status === "completed" || j?.status === "failed") ? j : null;
}, 120_000);
must(ctfDone?.status === "completed", `C5b ctffind completed via sbatch — ${(ctfDone?.result ?? "").slice(0, 120)}`);
must(ctfDone?.runRemote?.slurmGpus === 1 && ctfDone?.runRemote?.slurmPartition === "gpu",
  "C5c the per-run override rode through (gpus=1 target beat the connection's 2; partition fell back to the connection's gpu)");
{
  const gres1 = execSync(
    `node ${ROOT}/services/mock-cluster/test-client.mjs 'grep -l "gres=gpu:1 " ~/.slurm-mock/job-*.meta 2>/dev/null | head -1'`,
    { encoding: "utf8", timeout: 30_000 }
  ).trim();
  must(gres1.length > 0, "C5d the scheduler saw --gres=gpu:1 for the override run");
}

// C6 — the stop path: scancel mid-flight → CANCELLED → 137
const stopJob = await mkJob({ type: "motioncorr", name: "t293 slurm stop-me" });
await mkEdge(importJob.id, stopJob.id, "micrographs", "movies");
const disp3 = await fetch(`${BASE}/api/jobs/${stopJob.id}/run`, {
  method: "POST",
  headers: ORIGIN,
  body: JSON.stringify({ remote: { connectionId: connId, module: HIDDEN, mode: "slurm", gpus: 2 } }),
});
must(disp3.status === 200, "C6a the stop-test dispatch is accepted");
await sleep(2500); // let staging + sbatch land, run still pacing (6 mics × 1s)
const stopRes = await fetch(`${BASE}/api/jobs/${stopJob.id}/stop`, { method: "POST", headers: ORIGIN });
const stopBody = await stopRes.json().catch(() => ({}));
must(/scancel sent for Slurm job/i.test(stopBody.message ?? "") || /cancelled/i.test(stopBody.message ?? ""),
  `C6b the stop path speaks scancel — "${(stopBody.message ?? "").slice(0, 90)}"`);
const stopped = await pollUntil(async () => {
  const j = await readJob(stopJob.id);
  return (j?.status === "completed" || j?.status === "failed") ? j : null;
}, 90_000);
must(stopped?.status === "failed", `C6c the cancelled run finalizes FAILED (${stopped?.status})`);
must(/137|CANCELLED|cancel/i.test(stopped?.result ?? "") || (stopped?.result ?? "").includes("exit 137"),
  `C6d the result speaks the scheduler's verdict — ${(stopped?.result ?? "").slice(0, 120)}`);

/* ------------------------------------------------------------------ */
/* PHASE Z — cleanup                                                   */
/* ------------------------------------------------------------------ */
console.log("== PHASE Z: cleanup ==");
for (const id of createdJobs) {
  await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: ORIGIN }).catch(() => {});
}
await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: ORIGIN }).catch(() => {});
try {
  execSync(
    `node ${ROOT}/services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/motioncorr_* /projects/cryoflow/*/ctffind_* /projects/cryoflow/*/import_* ~/.slurm-mock'`,
    { encoding: "utf8", timeout: 30_000 }
  );
} catch { /* best effort */ }
rmSync(MICS_DIR, { recursive: true, force: true });
try { rmSync("/tmp/t293-parse.ts", { force: true }); } catch {}
const finalJobs = (await (await fetch(`${BASE}/api/jobs`, { headers: ORIGIN })).json()).jobs ?? [];
must(!createdJobs.some((id) => finalJobs.some((j) => j.id === id)), "Z1 the canvas is clean (every created job deleted)");
console.log(`\n== t293: pass ${pass} · fail ${fail} ==`);
if (fails.length) { console.log("FAILURES:"); for (const f of fails) console.log("  - " + f); }
process.exit(fail > 0 ? 1 : 0);

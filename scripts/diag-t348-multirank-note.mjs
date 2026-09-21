/**
 * t348 live verification — the multi-rank note + the t345/t346 stack on the
 * pulled tree, against the REAL dev server (:3000) and the REAL mock SSH
 * cluster (:3022).
 *
 * The field report this answers: a healthy 6-rank 2D classification whose
 * run.out read as 「几个GPU重复执行了同一个任务」. The chain below proves:
 *   1. the pulled tree's remote lane still dispatches end-to-end
 *      (import → ctffind → LoG autopick → extract → class2d @slurm);
 *   2. width 6 → six CRYOFLOW_RANK_BIND receipts on six DISTINCT cards;
 *   3. the NEW t348 note prints with the post-clamp count (starting 6 MPI
 *      ranks) BEFORE the interleaved banners begin;
 *   4. single-rank GPU jobs do NOT get the note (no noise).
 */
import {
  api, SH, SHJ, must, summary, logSection, client,
  remoteWorkdir, waitTerminal, sleep,
  mkJob, mkEdge, runRemote, slurmTarget, CONN_ID,
} from "./t348-lib.mjs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const MICS = "/data2/empiar-10017/micrographs";

/** Self-sufficiency: the suite needs micrographs on the mock; when the
 * real EMPIAR fixtures are absent, three valid little-endian MRC2014
 * micrographs (512x512, mode 2, nz=1 — single-section, CTF-ready shape)
 * are generated into the mock's fs. Deterministic noise, no science in
 * them — the mock's RELION stubs speak the product dialect, not pixels. */
function ensureFixtures() {
  const dir = path.join(ROOT_MOCK, "fs/data2/empiar-10017/micrographs");
  if (existsSync(path.join(dir, "Falcon_2012_06_12-14_33_35_0.mrc"))) return;
  mkdirSync(dir, { recursive: true });
  const W = 512, H = 512;
  for (const name of ["Falcon_2012_06_12-14_33_35_0.mrc", "Falcon_2012_06_12-14_57_34_0.mrc", "Falcon_2012_06_12-15_07_41_0.mrc"]) {
    const head = Buffer.alloc(1024);
    head.writeInt32LE(W, 0); head.writeInt32LE(H, 4); head.writeInt32LE(1, 8); head.writeInt32LE(2, 12);
    head.writeInt32LE(W, 28); head.writeInt32LE(H, 32); head.writeInt32LE(1, 36);
    head.writeFloatLE(1.77, 40); head.writeFloatLE(1.77, 44); head.writeFloatLE(1.77, 48);
    head.writeInt32LE(1, 64); head.writeInt32LE(2, 68); head.writeInt32LE(3, 72);
    head.write("MAP ", 208); head.writeUInt32LE(0x00004144, 212); head.writeInt32LE(20140, 104);
    const data = Buffer.alloc(W * H * 4);
    let s = name.length * 7919;
    for (let i = 0; i < W * H; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      data.writeFloatLE(((s % 20000) / 20000 - 0.5) * 4, i * 4);
    }
    writeFileSync(path.join(dir, name), Buffer.concat([head, data]));
  }
  console.log("  (synthetic micrograph fixtures generated on the mock)");
}
const ROOT_MOCK = "/home/z/my-project/services/mock-cluster";

function sbatchScriptOf(projectId, job) {
  return client(`cat '${remoteWorkdir(projectId, job)}/.cf-sbatch.sh' 2>/dev/null`).out;
}
function runOutOf(projectId, job) {
  return client(`cat '${remoteWorkdir(projectId, job)}/run.out' 2>/dev/null`).out;
}
function lever(name, value) {
  client(`mkdir -p ~/.slurm && echo '${value}' > ~/.slurm/${name}`);
}
function leverRm(...names) {
  client(`rm -f ~/.slurm/${names.join(" ~/.slurm/")}`);
}

async function runStage(label, type, params, ups, target, timeoutMs = 240_000) {
  const j = await mkJob({ type, x: 380, y: 80, name: label, params });
  for (const [up, fp, tp] of ups) await mkEdge(up.id, j.id, fp, tp);
  const r = await runRemote(j.id, slurmTarget(target));
  must(r.status === 200, `${label} dispatched (${r.status})`);
  const w = await waitTerminal(j.id, { timeoutMs });
  must(w.job?.status === "completed", `${label} completed (${w.job?.status}: ${String(w.job?.result).slice(0, 160)})`);
  return j;
}

function rankBinds(runout) {
  const out = [];
  for (const m of runout.matchAll(/CRYOFLOW_RANK_BIND: rank (\d+) -> CUDA_VISIBLE_DEVICES=(\S+)/g)) {
    out.push({ rank: Number(m[1]), dev: m[2] });
  }
  return out;
}

try {
  ensureFixtures();
  logSection("A — connection + levers (8 cards, rank emulation ON)");
  const mkc = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN_ID, name: "t348 mock", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow", defaultModule: "relion/5.0.1",
      useSlurm: true, slurmPartition: "brain2",
    }),
  });
  must(mkc.status === 200 || mkc.status === 201, `the connection upserts (${mkc.status})`);
  const test = await api(`/api/remote/connections/${CONN_ID}/test`, { method: "POST", headers: SHJ });
  must(test.body?.ok === true, `Test & probe succeeds`);
  leverRm("gpu-count", "gpu-free-mb", "mpi-emulate-ranks", "mpi-strip-env", "squeue-blind", "sacct-blind", "cat-slow-ms", "cat-channel-close");
  lever("mpi-emulate-ranks", "1");
  must(client("nvidia-smi -L").out.split("\n").filter(Boolean).length === 8,
    "the mock node exposes 8 GPUs");

  logSection("B — 链路: import → ctffind → LoG autopick → extract");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "t348 multi-rank note e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "t348 import",
    params: { nodeType: "micrographs", micrographsPath: MICS, pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25 },
  });
  await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const wi = await waitTerminal(imp.id, { timeoutMs: 60_000 });
  must(wi.job?.status === "completed", `import completed (${wi.job?.status}: ${String(wi.job?.result).slice(0, 160)})`);
  const ctf = await runStage("t348 ctffind", "ctffind",
    { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 },
    [[imp, "micrographs", "micrographs"]], { gpus: 0 });
  const pick = await runStage("t348 autopick LoG", "autopick",
    { pickingMethod: "Laplacian of Gaussian", logDiamMin: 120, logDiamMax: 180, logAdjustThreshold: 0, threshold: 0.4 },
    [[ctf, "micrographs", "micrographs"]], { gpus: 0 });
  const ext = await runStage("t348 extract", "extract",
    { boxSize: 128, downsampleTo: 64, bgDiameter: -1, norm: true },
    [[ctf, "micrographs", "micrographs"], [pick, "coords", "coords"]], { gpus: 1, shards: 2 });

  logSection("C — THE FIELD SHAPE: width-6 class2d → 6 rank / 6 cards + the t348 note");
  {
    const c2d = await mkJob({
      type: "class2d", x: 700, y: 80, name: "t348 class2d w6",
      params: { numClasses: 4, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
    });
    await mkEdge(ext.id, c2d.id, "particles", "particles");
    const r = await runRemote(c2d.id, slurmTarget({ gpus: 6 }));
    must(r.status === 200, `width-6 class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `width-6 class2d COMPLETED (${w.job?.status}: ${String(w.job?.result).slice(0, 160)})`);

    const script = sbatchScriptOf(projectId, c2d);
    must(script.includes("CF_RANKS=6") && script.includes('mpirun -n "$CF_RANKS"'),
      "the script carries CF_RANKS=6 and mpirun -n \"$CF_RANKS\"");
    must(script.includes(".cf-rank-launch.sh") && /--gpu 0\b/.test(script) && !/--gpu 0:/.test(script),
      "t345: mpirun targets the per-rank launcher; relion carries --gpu 0; no colon list");

    const runout = runOutOf(projectId, c2d);
    const binds = rankBinds(runout);
    must(binds.length === 6, `6 CRYOFLOW_RANK_BIND receipts (got ${binds.length})`);
    const devs = binds.map((b) => b.dev);
    must(new Set(devs).size === 6, `every rank a DIFFERENT card: ${devs.join(",")}`);
    must(!/clamping the rank count/.test(runout), "no clamp note (8 cards ≥ 6 ranks)");
    must(!/cannot see any GPU/.test(runout), "no blind note");

    // ---- THE NEW t348 NOTE ----
    const noteMatch = runout.match(/CRYOFLOW_NOTE: starting (\d+) MPI ranks, one per card[^\n]*/);
    must(!!noteMatch, "the t348 note prints in run.out");
    must(noteMatch && noteMatch[1] === "6", `the note speaks the post-clamp count (starting ${noteMatch?.[1]} MPI ranks)`);
    must(noteMatch && /SPLIT across ranks/.test(noteMatch[0]) && /NOT repeated/.test(noteMatch[0]),
      "the note explains the split (particles in Expectation, classes in Maximization)");
    must(noteMatch && /private CUDA_VISIBLE_DEVICES world/.test(noteMatch[0]),
      "the note explains the per-rank 'device 0' semantics");
    const bindIdx = runout.indexOf("CRYOFLOW_RANK_BIND");
    const noteIdx = runout.indexOf("CRYOFLOW_NOTE: starting ");
    must(noteIdx !== -1 && bindIdx !== -1 && noteIdx < bindIdx,
      "the note lands BEFORE the first rank receipt (readable preamble)");
  }

  logSection("D — 单 rank GPU 作业不付注释噪声");
  {
    const c2d = await mkJob({
      type: "class2d", x: 700, y: 120, name: "t348 class2d w1",
      params: { numClasses: 4, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
    });
    await mkEdge(ext.id, c2d.id, "particles", "particles");
    const r = await runRemote(c2d.id, slurmTarget({ gpus: 1 }));
    must(r.status === 200, `width-1 class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `width-1 class2d COMPLETED (${w.job?.status}: ${String(w.job?.result).slice(0, 160)})`);
    const runout = runOutOf(projectId, c2d);
    must(!/CRYOFLOW_NOTE: starting \d+ MPI ranks/.test(runout),
      "single-rank jobs do NOT print the multi-rank note");
  }

  leverRm("mpi-emulate-ranks");
} catch (e) {
  console.error("DIAG t348 crashed:", e);
  process.exitCode = 1;
} finally {
  summary("t348 live verification");
}

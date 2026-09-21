/**
 * E2E TEST 10 — t345: the per-rank card pin (one rank, one card — for
 * real this time) + the star preflight read that must not lie about a
 * live file.
 *
 * 用户工单 (真实集群, 第二次同样形状): 2D 分类 mpirun 多 rank 启动后
 *   - 六份 rank 横幅全部写着 "Will distribute threads over devices 0"
 *   - 同一张卡被逐 rank 吃干: 156 → 40 → 37 → 34 MB free
 *   - stderr: out of memory (custom_allocator.cuh:436, setupTunableSizedObjects)
 * 节点卡够 (钳制没触发) — t342 的 "--gpu 0:1:…" 冒号列表在这个 RELION
 * 构建上根本没按 rank 分卡。t345 退役冒号列表: sbatch 脚本现场写一个
 * per-rank launcher (.cf-rank-launch.sh), 每个 MPI rank 拿到自己的
 * CUDA_VISIBLE_DEVICES, relion 在"只看得见一张卡"的世界里跑 --gpu 0。
 *
 * 同一份工单的前半: "particles star unreadable … timeout after 15000ms"
 * — 文件在、路径对 (relion 自己在集群上读到并跑起来了), 饿死的是我们
 * 预检的 SSH cat (15s 预算 + 半死的池化连接)。t345: 90s 预算 + 断线
 * 重拨再试一次 + 超时专属措辞 (不再让用户去"重新生成"一个没丢的文件)。
 *
 * Scenes:
 *   A — lever self-check (8 cards, rank emulation on)
 *   B — the chain (import → ctffind → LoG autopick → extract), reused below
 *   C — THE FIELD SHAPE: width 6 over 8 cards → 6 ranks, 6 DISTINCT cards
 *       (the CRYOFLOW_RANK_BIND receipts), no clamp, no pile
 *   D — quietest-first: card 1 starved (100 MB) and 8 cards visible → the
 *       6 ranks land on {0,2,3,4,5,6} — the starved card is never picked
 *   E — the clamp: 2 cards visible, width 6 asked → 2 ranks, named NOTE
 *   F — the blind node: nvidia-smi answers nothing → ONE rank + the blind
 *       NOTE (a pile-up needs two)
 *   G — the slow wire: cat-slow-ms=20000 on particles.star (> the old 15s
 *       budget, < the new 90s) → the gate READS it, receipt says
 *       "read in place", job completes
 *   H — the dead channel: one-shot channel-close on the gate's first cat →
 *       the redial retry lands it, job completes
 *   I — static source anchors (the budget, the redial, the timeout advice,
 *       the launcher's own refusal contracts)
 */
import {
  api, SH, SHJ, must, summary, logSection, client,
  remoteWorkdir, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, CONN_ID,
} from "./e2e-lib.mjs";
import { readFileSync } from "node:fs";

const MICS = "/data2/empiar-10017/micrographs";

async function runStage(label, type, params, ups, target, timeoutMs = 240_000) {
  const j = await mkJob({ type, x: 380, y: 80, name: label, params });
  for (const [up, fp, tp] of ups) await mkEdge(up.id, j.id, fp, tp);
  const r = await runRemote(j.id, slurmTarget(target));
  must(r.status === 200, `${label} dispatched (${r.status})`);
  const w = await waitTerminal(j.id, { timeoutMs });
  must(w.job?.status === "completed", `${label} completed (${w.job?.status}: ${String(w.job?.result).slice(0, 120)})`);
  return j;
}

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
function catLeverLogText() {
  return client("cat ~/.slurm/cat-lever.log 2>/dev/null").out;
}

/** All RANK_BIND receipts in a run.out: [{rank, dev}] */
function rankBinds(runout) {
  const out = [];
  for (const m of runout.matchAll(/CRYOFLOW_RANK_BIND: rank (\d+) -> CUDA_VISIBLE_DEVICES=(\S+)/g)) {
    out.push({ rank: Number(m[1]), dev: m[2] });
  }
  return out;
}

async function mkClass2d(name, ext, gpus) {
  const j = await mkJob({
    type: "class2d", x: 700, y: 80, name,
    params: { numClasses: 4, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(ext.id, j.id, "particles", "particles");
  const r = await runRemote(j.id, slurmTarget({ gpus }));
  return { j, r };
}

try {
  logSection("A — 杠杆自检: 8 卡 + mpi-emulate-ranks 开");
  leverRm("gpu-count", "gpu-free-mb", "gpu-holders", "mpi-emulate-ranks", "cat-slow-ms", "cat-channel-close", "exec-slow-ms", "exec-channel-close", "mpi-strip-env", "squeue-blind", "sacct-blind");
  client("rm -f ~/.slurm/cat-lever.log ~/.slurm/exec-lever.log");
  lever("mpi-emulate-ranks", "1");
  must(client("nvidia-smi -L").out.split("\n").filter(Boolean).length === 8,
    "the mock node exposes 8 GPUs (the default inventory)");
  const qrows = client("nvidia-smi --query-gpu=index,memory.free --format=csv,noheader,nounits").out
    .split("\n").map((l) => l.trim()).filter(Boolean);
  must(qrows.length === 8 && qrows.every((l) => /^\d+, \d+$/.test(l)),
    `the stub answers the t345 index,memory.free query with 8 "index, free" rows (got ${qrows.length}: ${qrows[0] ?? "—"})`);

  logSection("B — 链路: import → ctffind → LoG autopick → extract (后续场景共用)");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "rank-card-pin e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "rcp import",
    params: { nodeType: "micrographs", micrographsPath: MICS, pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25 },
  });
  await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const wi = await waitTerminal(imp.id, { timeoutMs: 60_000 });
  must(wi.job?.status === "completed", `import completed (${wi.job?.status})`);
  const ctf = await runStage("ctffind", "ctffind",
    { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 },
    [[imp, "micrographs", "micrographs"]], { gpus: 0 });
  const pick = await runStage("autopick LoG", "autopick",
    { pickingMethod: "Laplacian of Gaussian", logDiamMin: 120, logDiamMax: 180, logAdjustThreshold: 0, threshold: 0.4 },
    [[ctf, "micrographs", "micrographs"]], { gpus: 0 });
  const ext = await runStage("extract", "extract",
    { boxSize: 128, downsampleTo: 64, bgDiameter: -1, norm: true },
    [[ctf, "micrographs", "micrographs"], [pick, "coords", "coords"]], { gpus: 1, shards: 2 });

  logSection("C — 现场形状复刻: 宽度 6 / 8 卡可见 → 6 rank 各自一张卡 (不再全钉 device 0)");
  {
    const { j: c2d, r } = await mkClass2d("rcp class2d w6", ext, 6);
    must(r.status === 200, `width-6 class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `width-6 class2d COMPLETED (${w.job?.status}: ${String(w.job?.result).slice(0, 120)})`);
    const script = sbatchScriptOf(projectId, c2d);
    must(script.includes("CF_RANKS=6") && script.includes('mpirun -n "$CF_RANKS"'),
      "the script carries CF_RANKS=6 and mpirun -n \"$CF_RANKS\"");
    must(script.includes(".cf-rank-launch.sh") && /--gpu 0\b/.test(script) && !/--gpu 0:/.test(script) && !script.includes("CF_GPU_LIST"),
      "t345: mpirun targets the per-rank launcher; relion carries --gpu 0; the colon list is GONE");
    must(script.includes("CRYOFLOW_RANK_BIND"), "the launcher's per-rank receipt is in the script");
    const runout = runOutOf(projectId, c2d);
    const binds = rankBinds(runout);
    must(binds.length === 6, `6 CRYOFLOW_RANK_BIND receipts (one per rank — got ${binds.length})`);
    const devs = binds.map((b) => b.dev);
    must(new Set(devs).size === 6, `every rank got a DIFFERENT card (the pile-up is dead): ${devs.join(",")}`);
    must(devs.every((d) => /^[0-6]$/.test(d)), `the pinned cards are real indices from the device set: ${devs.join(",")}`);
    must(binds.every((b, i) => b.rank === i), "the receipts are ranked 0..5 (the emulated launcher ran one copy per rank)");
    must(!/clamping the rank count/.test(runout), "no clamp note — 8 cards ≥ 6 ranks, the width was honest");
    must(!/cannot see any GPU/.test(runout), "no blind note — the node answered nvidia-smi");
  }

  logSection("D — 空闲优先: 卡 1 只剩 100 MB → 6 rank 落在 {0,2,3,4,5,6}, 饥饿卡被绕开");
  {
    lever("gpu-free-mb", "20000,100,20000,20000,20000,20000,20000,20000");
    const { j: c2d, r } = await mkClass2d("rcp class2d quiet-first", ext, 6);
    must(r.status === 200, `quiet-first class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `quiet-first class2d COMPLETED (${w.job?.status})`);
    const runout = runOutOf(projectId, c2d);
    const binds = rankBinds(runout);
    must(binds.length === 6, `6 rank receipts (got ${binds.length})`);
    const devs = binds.map((b) => b.dev).sort();
    must(JSON.stringify(devs) === JSON.stringify(["0", "2", "3", "4", "5", "6"]),
      `the starved card 1 is NEVER picked — the device set is quietest-first: ${devs.join(",")}`);
    must(!/refusing to launch/.test(runout), "no starved refusal — the selected cards are the free ones");
    leverRm("gpu-free-mb");
  }

  logSection("E — 钳制: 只暴露 2 卡而要 6 rank → 钳到 2, NOTE 点名");
  {
    lever("gpu-count", 2);
    const { j: c2d, r } = await mkClass2d("rcp class2d clamp", ext, 6);
    must(r.status === 200, `clamp class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `clamp class2d COMPLETED (${w.job?.status})`);
    const runout = runOutOf(projectId, c2d);
    must(/CRYOFLOW_NOTE: this job asked for 6 MPI rank\(s\) but only 2 GPU\(s\) are visible to it/.test(runout),
      "run.out narrates the clamp: 6 asked, 2 visible");
    const binds = rankBinds(runout);
    must(binds.length === 2 && JSON.stringify(binds.map((b) => b.dev).sort()) === JSON.stringify(["0", "1"]),
      `exactly 2 ranks ran, on cards 0 and 1 (got ${JSON.stringify(binds)})`);
    leverRm("gpu-count");
  }

  logSection("F — 盲节点: nvidia-smi 哑火 → 单 rank + 盲 NOTE (堆卡需要两个 rank)");
  {
    lever("gpu-count", 0);
    const { j: c2d, r } = await mkClass2d("rcp class2d blind", ext, 6);
    must(r.status === 200, `blind class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `blind class2d COMPLETED (${w.job?.status})`);
    const runout = runOutOf(projectId, c2d);
    must(/CRYOFLOW_NOTE: this job cannot see any GPU from inside the allocation/.test(runout) &&
      /running ONE rank instead of 6/.test(runout),
      "run.out narrates the blind case: ONE rank, not six onto an unknown card");
    const binds = rankBinds(runout);
    must(binds.length === 1 && binds[0].dev === "<as",
      `a single unpinned rank ran, its receipt says so (got ${JSON.stringify(binds)})`);
    leverRm("gpu-count");
  }

  logSection("G — 慢线: 读星 20s (> 旧 15s 预算) → t346 census (awk 原地) 扛住, 收据 in-place, 作业完成");
  {
    // t346 — the star read is a CLUSTER-SIDE awk census now (not a cat):
    // the generic exec lever slows whatever the current code speaks
    lever("exec-slow-ms", "20000 particles.star");
    const t0 = Date.now();
    const { j: c2d, r } = await mkClass2d("rcp class2d slowread", ext, 2);
    must(r.status === 200, `slow-read class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `slow-read class2d COMPLETED (${w.job?.status}: ${String(w.job?.result).slice(0, 100)})`);
    const took = Date.now() - t0;
    const runout = runOutOf(projectId, c2d);
    must(!/particles star unreadable/.test(runout),
      "no 'particles star unreadable' — the 90s budget carried the 20s census read that the old 15s one starved on");
    must(/censed IN PLACE on the cluster/.test(runout),
      "the receipt names the lane: the star was censed IN PLACE on the cluster (zero star bytes crossed the wire)");
    must(/verified against their own MRC headers/.test(runout),
      "the stack-size consistency check RAN (the poison the field burned GPU time on would have been caught here)");
    const leverLog = client("cat ~/.slurm/exec-lever.log 2>/dev/null").out;
    must(/slow 20000ms on particles\.star/.test(leverLog),
      "the exec-lever witness proves the torture actually fired (a green job alone could mean the lever never matched)");
    must(took >= 20_000, `the dispatch really paid the 20s read (${(took / 1000).toFixed(1)}s)`);
    leverRm("exec-slow-ms");
  }

  logSection("H — 死通道: census 首试通道无退出口关闭 → 断线重拨, 第二次读到, 作业完成");
  {
    lever("exec-channel-close", "particles.star");
    const { j: c2d, r } = await mkClass2d("rcp class2d chanclose", ext, 2);
    must(r.status === 200, `channel-close class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `channel-close class2d COMPLETED (${w.job?.status}: ${String(w.job?.result).slice(0, 100)})`);
    const runout = runOutOf(projectId, c2d);
    must(!/particles star unreadable/.test(runout),
      "no unreadable receipt — attempt 1 died on the closed channel, the redial landed attempt 2");
    const leverLog = client("cat ~/.slurm/exec-lever.log 2>/dev/null").out;
    must(/channel-close on particles\.star/.test(leverLog),
      "the one-shot lever witness: the census's first exec really closed without an exit");
    leverRm("exec-channel-close");
  }

  logSection("I — 静态源锚点: 预算/重拨/超时措辞/launcher 自身的拒发契约");
  {
    const src = readFileSync(new URL("../src/lib/remote/remote-run.ts", import.meta.url), "utf8");
    must(src.includes("timeoutMs: 90_000") && /dropConnection\(conn\.id\)/.test(src),
      "catRemote: the 90s budget + the dropConnection redial are in the source");
    must(src.includes("the read TIMED OUT — the SSH wire was slow"),
      "the timeout receipt has its own advice (the file was NOT reported missing)");
    must(src.includes("could not read its MPI rank index"),
      "the launcher refuses to guess a missing rank index (every rank guessing 0 IS the pile-up)");
    must(src.includes("names no card for rank"),
      "the launcher refuses an unpinned multi-rank run (no device, no launch)");
    must(!src.includes("CF_GPU_LIST"),
      "CF_GPU_LIST is retired from the source entirely (the colon grammar died in the field)");
    // t346 — the census anchors
    must(src.includes("clusterParticleRefCensus") && src.includes("zero star bytes crossed the wire"),
      "t346: the cluster-side star census exists and its receipt speaks the zero-byte doctrine");
    must(src.includes("export -p >") && src.includes("command -v --"),
      "t346: the rank-env dump + the launcher's binary resolution are in the generated script");
  }
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
} finally {
  // the levers are test-only world state — never leak them into other suites
  leverRm("gpu-count", "gpu-free-mb", "gpu-holders", "mpi-emulate-ranks", "cat-slow-ms", "cat-channel-close");
}

const s = summary("TEST 10 — t345 per-rank card pin (one rank, one card) + the star read that must not lie");
process.exit(s.fail > 0 ? 1 : 0);

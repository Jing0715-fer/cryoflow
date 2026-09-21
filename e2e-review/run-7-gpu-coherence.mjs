/**
 * E2E TEST 7 — t342: rank↔GPU coherence + the starved-card refusal +
 * the cluster-aware star read.
 *
 * 用户工单 (真实集群 follow-up): 降到 50 类后不再 OOM,但作业冻在
 * "Expectation iteration 1 of 20" 不动 — RELION 自己的
 *   WARNING: Ignoring required free GPU memory amount of 800 MB, due to
 *   space insufficiency.
 * 且日志里两份 rank 横幅都写着 "Will distribute threads over devices 0"
 * — 2 个 MPI rank 全被钉在同一张卡上 (#SBATCH --gres 是请求, 集群没有
 * gres 记账时不强制), 卡上还压着上一次 OOM 尝试的残留分配。本套验证
 * 三件套:
 *   1. rank 钳制: 节点只暴露 1 张卡 (mock nvidia-smi 杠杆 gpu-count=1)
 *      而 dispatch 宽度 2 → 脚本运行时把 mpirun 钳到 1 rank, 打出
 *      CRYOFLOW_NOTE, 作业干净完成 (不再两 rank 挤一张卡)
 *   2. 饥饿卡拒发: gpu-free-mb=400 + 假 holder PID → 启动前拒绝
 *      (exit 98), run.out 列出占卡 PID — 一秒内带名字地失败, 而不是
 *      一小时无声地挂死
 *   3. 无本地副本的 particles.star: 删除本地镜像副本后 dispatch 消费端
 *      作业 → t338 gate 通过集群 twin 读到 star 并逐栈校验
 *      (收据 "verified", 不再是 "unreadable — the check did not run")
 */
import {
  api, SH, SHJ, must, summary, logSection, client,
  remoteWorkdir, readEngineState, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, sleep, CONN_ID,
} from "./e2e-lib.mjs";
import { rmSync } from "node:fs";

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

try {
  logSection("A — 杠杆: 节点只暴露 1 张 GPU (gpu-count=1)");
  lever("gpu-count", 1);
  must(client("nvidia-smi -L").out.split("\n").filter(Boolean).length === 1,
    "the mock node now exposes exactly 1 GPU to nvidia-smi -L");

  logSection("B — 链路 + class2d @ 宽度 2 → 运行时钳到 1 rank, 干净完成");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "gpu-coherence e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "gc import",
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

  const c2d = await mkJob({
    type: "class2d", x: 700, y: 80, name: "gc class2d w2",
    params: { numClasses: 4, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(ext.id, c2d.id, "particles", "particles");
  const r1 = await runRemote(c2d.id, slurmTarget({ gpus: 2 }));
  must(r1.status === 200, `width-2 class2d dispatched (${r1.status})`);
  const w1 = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
  must(w1.job?.status === "completed", `width-2 class2d COMPLETED on the 1-GPU node (${w1.job?.status}: ${String(w1.job?.result).slice(0, 120)})`);

  const script = sbatchScriptOf(projectId, c2d);
  must(script.includes("CF_RANKS=2") && script.includes('mpirun -n "$CF_RANKS"'),
    "the script carries mpirun -n \"$CF_RANKS\" with CF_RANKS=2 (the width as asked)");
  must(script.includes(".cf-rank-launch.sh") && /--gpu 0\b/.test(script) && !/--gpu 0:/.test(script),
    "t345: mpirun targets the per-rank launcher and relion carries --gpu 0 (the colon list is retired — it put every rank on device 0 in the field)");
  const runout1 = runOutOf(projectId, c2d);
  must(/CRYOFLOW_NOTE: this job asked for 2 MPI rank\(s\) but only 1 GPU\(s\) are visible to it/.test(runout1),
    "run.out narrates the clamp: 2 ranks asked, 1 GPU visible → clamped to the visible cards");
  must(/CRYOFLOW_RANK_BIND: rank 0 -> CUDA_VISIBLE_DEVICES=\<as the node left it\>/.test(runout1),
    "the single surviving rank names its own binding (the launcher's CRYOFLOW_RANK_BIND receipt)");
  must(!/Expectation iteration 1 of 20[\s\S]*?devices\s+0\b[\s\S]*?devices\s+0\b/.test(runout1),
    "no two-rank pile-up on one device (the frozen-iteration shape is structurally impossible now)");

  logSection("C — 饥饿卡: gpu-free-mb=400 + 假 holder → 启动前拒绝 (exit 98)");
  lever("gpu-free-mb", 400);
  client(`printf '31337, /opt/bin/relion_refine, 9000 MiB\\n' > ~/.slurm/gpu-holders`);
  const c2d2 = await mkJob({
    type: "class2d", x: 700, y: 260, name: "gc class2d starved",
    params: { numClasses: 4, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(ext.id, c2d2.id, "particles", "particles");
  const r2 = await runRemote(c2d2.id, slurmTarget({ gpus: 1 }));
  must(r2.status === 200, `starved class2d dispatched (${r2.status}) — the refusal is the SCRIPT's word, the submission itself is honest`);
  const w2 = await waitTerminal(c2d2.id, { timeoutMs: 180_000 });
  must(w2.job?.status === "failed", `the starved run FAILED fast (${w2.job?.status}) — not an hour of frozen iterations`);
  const exitFile = client(`cat '${remoteWorkdir(projectId, c2d2)}/.cf-exit' 2>/dev/null`).out.trim();
  must(exitFile === "98", `the refusal's own exit contract (.cf-exit=98, got '${exitFile}')`);
  const runout2 = runOutOf(projectId, c2d2);
  must(/CRYOFLOW_ERR: only 400 MB free on the GPU\(s\) this job would use/.test(runout2),
    "run.out names the starvation with the number (only 400 MB free)");
  must(runout2.includes("31337"), "run.out lists the holder PID (nvidia-smi --query-compute-apps) — the stale run is NAMED, not guessed");
  must(/CRYOFLOW_ERR: refusing to launch/.test(runout2),
    "run.out says the refusal outright (fail in one second, not an hour of silence)");

  logSection("D — 杠杆复原 + 无本地副本的 star → gate 通过集群 twin 校验");
  leverRm("gpu-count", "gpu-free-mb", "gpu-holders");
  const extRec = readEngineState()[ext.id] ?? {};
  const localStar = extRec?.outputs?.particles_star ?? null;
  must(!!localStar && !!extRec?.remote?.remoteOutputs?.particles_star,
    "the extract's record knows its particles.star both sides (the local mirror copy AND the verified cluster twin)");
  if (localStar) { try { rmSync(localStar); } catch { /* already gone */ } }
  const c2d3 = await mkJob({
    type: "class2d", x: 700, y: 440, name: "gc class2d no-local-star",
    params: { numClasses: 4, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(ext.id, c2d3.id, "particles", "particles");
  const r3 = await runRemote(c2d3.id, slurmTarget({ gpus: 1 }));
  must(r3.status === 200, `no-local-star class2d dispatched (${r3.status})`);
  const w3 = await waitTerminal(c2d3.id, { timeoutMs: 240_000 });
  must(w3.job?.status === "completed", `no-local-star class2d COMPLETED (${w3.job?.status}: ${String(w3.job?.result).slice(0, 120)})`);
  const runout3 = runOutOf(projectId, c2d3);
  must(!/particles star unreadable/.test(runout3),
    "the receipt no longer says 'particles star unreadable' — the gate read the cluster's own copy (t342)");
  must(/verified against their own MRC headers/.test(runout3),
    "the receipt says the stacks were verified — the census + header check RAN on the cluster's own bytes");
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
} finally {
  // the levers are test-only world state — never leak them into other suites
  leverRm("gpu-count", "gpu-free-mb", "gpu-holders");
}

const s = summary("TEST 7 — t342 rank↔GPU coherence + starved-card refusal + cluster-aware star read");
process.exit(s.fail > 0 ? 1 : 0);

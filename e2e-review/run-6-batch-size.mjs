/**
 * E2E TEST 6 — t341: 大 box Class2D 的 memory-aware batch + sbatch 形状.
 *
 * 用户工单 (真实集群): 2D Classification 30s 静默死亡 — prterun rank exit 1,
 * 诊断 strip = "Out-of-memory error (GPU/RAM allocator)"。修复三件套的本端验证:
 *   1. refineAutoBatch: box > 200 的 2D 曲线 → --batch_size 32 (box 360);
 *      box ≤ 200 → 不带 flag (RELION 默认, 零行为变化);
 *      显式 batchSize 参数 > 一切 (用户工单的直接抓手)
 *   2. sbatch: --gres=gpu:2 + mpirun -n 2 + --gpu 0:1 (一 rank 一卡)
 *   3. sbatch: t341 GPU pin 块 (GPU_DEVICE_ORDINAL / SLURM_JOB_GPUS →
 *      CUDA_VISIBLE_DEVICES, 仅在集群未隔离时生效)
 */
import {
  api, SH, SHJ, must, summary, logSection, client,
  remoteWorkdir, readEngineState, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, sleep, CONN_ID, ROOT,
} from "./e2e-lib.mjs";

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

try {
  logSection("A — 链路: import → ctffind → autopick(LoG) → extract(box 360, 不降采样)");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "batch-size e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "bs import",
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
  const extBig = await runStage("extract box 360 (no downsample)", "extract",
    { boxSize: 360, downsampleTo: 0, bgDiameter: -1, norm: true },
    [[ctf, "micrographs", "micrographs"], [pick, "coords", "coords"]], { gpus: 1, shards: 2 });

  logSection("B — 预览 (launch contract): box 360 → --batch_size 32 (2D 曲线)");
  const c2d = await mkJob({
    type: "class2d", x: 700, y: 80, name: "bs class2d bigbox",
    params: { numClasses: 10, iterations: 8, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(extBig.id, c2d.id, "particles", "particles");
  const cmd = await api(`/api/jobs/${c2d.id}/command`, { headers: SH });
  const argv = (cmd.body?.argv ?? []).join(" ");
  if (Array.isArray(cmd.body?.argv)) {
    console.log(`    preview argv: ${argv.slice(0, 220)}${argv.length > 220 ? "…" : ""}`);
    must(/--batch_size 32\b/.test(argv),
      "t341: box 360 previews --batch_size 32 (memory-aware 2D curve: 128×(200/360)² → floor8 → 32)");
    must(!/--batch_size (?!32\b)/.test(argv), "no other batch value sneaks in");
  } else {
    // the preview's tier-3 honest fallback: this headless E2E box has no
    // locally-DETECTED RELION install (the route previews through the LOCAL
    // binDir), so the argv tier cannot land here — the DISPATCHED SCRIPT
    // (phase C below) is the ground truth for the same buildArgv call
    console.log(`    preview tier-3 fallback (no local RELION detected): ${String(cmd.body?.error ?? "").slice(0, 90)}`);
    must(cmd.status === 200 && /RELION/i.test(String(cmd.body?.error ?? "")),
      "the preview answers honestly when local RELION is undetected (the dispatch below is the argv ground truth)");
  }

  logSection("C — 派发 (2 GPU): 完整 sbatch 形状 — batch + 一 rank 一卡 + GPU pin 块");
  const r1 = await runRemote(c2d.id, slurmTarget({ gpus: 2 }));
  must(r1.status === 200, `class2d dispatched (${r1.status})`);
  const w1 = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
  must(w1.job?.status === "completed", `big-box class2d COMPLETED (${w1.job?.status}: ${String(w1.job?.result).slice(0, 120)})`);
  const script = sbatchScriptOf(projectId, c2d);
  must(script.includes("#SBATCH --gres=gpu:2"), "the sbatch requests exactly 2 GPUs (--gres=gpu:2)");
  must(script.includes("--ntasks=2"), "--ntasks=2 (one MPI rank per GPU)");
  must(/mpirun -n 2\b/.test(script), "mpirun -n 2 (the sbatch6gpu.sh idiom)");
  must(/--gpu 0:1\b/.test(script), "--gpu 0:1 (rank 0 → card 0, rank 1 → card 1)");
  must(/--batch_size 32\b/.test(script), "the dispatched script carries --batch_size 32 (what the preview promised)");
  must(script.includes("GPU_DEVICE_ORDINAL") && script.includes("SLURM_JOB_GPUS") && script.includes("CUDA_VISIBLE_DEVICES"),
    "the t341 GPU-pin block rides the script (no-op where the cluster isolates, correct mapping where it does not)");

  logSection("D — 对照组: box 128→64 (默认链) → 不带 --batch_size (RELION 默认, 零行为变化)");
  const extSmall = await runStage("extract box 128→64 (defaults)", "extract",
    { boxSize: 128, downsampleTo: 64, bgDiameter: -1, norm: true },
    [[ctf, "micrographs", "micrographs"], [pick, "coords", "coords"]], { gpus: 1, shards: 2 });
  const c2d2 = await mkJob({
    type: "class2d", x: 700, y: 260, name: "bs class2d smallbox",
    params: { numClasses: 10, iterations: 8, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(extSmall.id, c2d2.id, "particles", "particles");
  const r2 = await runRemote(c2d2.id, slurmTarget({ gpus: 1 }));
  must(r2.status === 200, `small-box class2d dispatched (${r2.status})`);
  const w2 = await waitTerminal(c2d2.id, { timeoutMs: 240_000 });
  must(w2.job?.status === "completed", `small-box class2d COMPLETED (${w2.job?.status})`);
  const script2 = sbatchScriptOf(projectId, c2d2);
  must(!script2.includes("--batch_size"),
    "box-64 chain carries NO --batch_size (RELION's own default rides — the auto lever never fires below the safe edge)");
  must(/--gpu 0\b/.test(script2) && !/--gpu 0:/.test(script2), "single-GPU width maps --gpu 0 (no colon list)");

  logSection("E — 用户抓手: 显式 batchSize=24 覆盖 auto → 重跑带上 24");
  const patch = await api(`/api/jobs/${c2d.id}`, {
    method: "PATCH", headers: SHJ,
    body: JSON.stringify({ params: { batchSize: 24 } }),
  });
  must(patch.status === 200, `batchSize=24 saved (${patch.status})`);
  const r3 = await runRemote(c2d.id, slurmTarget({ gpus: 2 }));
  must(r3.status === 200, `override re-run accepted (${r3.status})`);
  const w3 = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
  must(w3.job?.status === "completed", `override re-run COMPLETED (${w3.job?.status}: ${String(w3.job?.result).slice(0, 120)})`);
  const script3 = sbatchScriptOf(projectId, c2d);
  must(/--batch_size 24\b/.test(script3), "the user's explicit batch (24) wins over the auto value — the one-knob fix for the OOM ticket");
  const rec = readEngineState()[c2d.id];
  must(rec?.exitCode === 0, "the override run's record exit 0");
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
}

const s = summary("TEST 6 — t341 memory-aware Class2D batch + sbatch shape");
process.exit(s.fail > 0 ? 1 : 0);

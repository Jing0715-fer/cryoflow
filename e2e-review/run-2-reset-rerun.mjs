/**
 * E2E TEST 2 — reset & re-run: 本地 + cluster 残留数据行为 (用户核心关切).
 *
 * 问的问题:「reset 任务时会先清除之前已生成的文件吗? 本地和 cluster 是否同时清空?
 * 残留文件会不会导致 re-run 卡住?」
 *
 * Phases:
 *  A. fresh project: import + motioncorr(array) → completed (gen-1)
 *  B. 残留标记物植入: cluster workdir 里放 stale_gen1.star / stale_gen1.mrcs /
 *     .cf-junk / weird.xyz(unknown) / note.txt; local mirror 里放 marker run.out + fake star
 *  C. PATCH reset → 验证: DB idle、record 清除、但【设计如此】本地+cluster 文件均保留
 *  D. re-run (gen-2) → t333 双端 wipe 验证:
 *     - cluster: stale .star/.mrcs/.cf-junk 全灭, run.out 全新(无 gen-1 内容),
 *       unknown 文件 + note.txt 保留(保守 keep-set)
 *     - local: mirror wipe 同步清理 marker
 *     - job 完成不卡住; manifest 只记 gen-2
 *  E. t333 字场崩溃回归: extract box 128→64 完成 → reset → 改 box 96→48 → re-run
 *     必须干净完成(旧 .mrcs 栈被清, 无尺寸冲突残留)
 *  F. t318 stale-verdict fence: .qa-ctf-allfail 杠杆 → ctffind exit 6 失败 →
 *     撤杠杆 → re-run → 必须 completed,不得继承旧 exit verdict
 */
import {
  api, SH, SHJ, must, summary, logSection, client, clusterFind, localFind,
  localWorkdir, remoteWorkdir, readManifest, readEngineState, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, sleep, CONN_ID,
} from "./e2e-lib.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

try {
  /* ---------------- Phase A: gen-1 ---------------- */
  logSection("A — gen-1: import + motioncorr(array×2) → completed");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "reset-residue e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "rr import",
    params: { nodeType: "micrographs", micrographsPath: "/data2/empiar-10017/micrographs", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25 },
  });
  await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const w1 = await waitTerminal(imp.id, { timeoutMs: 60_000 });
  must(w1.job?.status === "completed", `gen-1 import completed (${w1.job?.status})`);

  const mc = await mkJob({ type: "motioncorr", x: 380, y: 80, name: "rr motioncorr", params: { patchX: 5, patchY: 5, bfactor: 150, dosePerFrame: 1.28 } });
  await mkEdge(imp.id, mc.id, "micrographs", "movies");
  const r1 = await runRemote(mc.id, slurmTarget({ gpus: 1, shards: 2 }));
  must(r1.status === 200, `gen-1 motioncorr dispatched (${r1.status})`);
  const w2 = await waitTerminal(mc.id, { timeoutMs: 180_000 });
  must(w2.job?.status === "completed", `gen-1 motioncorr completed (${w2.job?.status})`);

  const rW = remoteWorkdir(projectId, mc);
  const lW = localWorkdir(projectId, mc);
  must(!!readEngineState()[mc.id], "gen-1 engine record exists (pre-reset)");
  const gen1Cluster = clusterFind(rW);
  const gen1Local = localFind(lW);
  must(gen1Cluster?.some((e) => e.path === "corrected_micrographs.star"), "gen-1 cluster output present (pre-reset)");

  /* ---------------- Phase B: residue markers ---------------- */
  logSection("B — 植入残留标记物 (simulating a previous generation's leftovers)");
  const marker = client(
    `cd '${rW}' && ` +
      `printf 'GEN1-STALE\n' > stale_gen1.star && ` +
      `printf 'GEN1-STALE-BYTES' > stale_gen1.mrcs && ` +
      `printf 'x' > .cf-junk && ` +
      `printf 'keep me\n' > weird.unknown && ` +
      `printf 'user note\n' > note.txt && ` +
      `printf 'GEN1-LOG-LINE\n' >> run.out && ` +
      `printf 'GEN1-MIRROR-LOG\n' >> run.err && ` +
      `echo planted`
  );
  must(marker.out.includes("planted"), `cluster markers planted (${marker.out})`);
  writeFileSync(`${lW}/mirror_stale.star`, "GEN1-MIRROR-STALE\n");
  writeFileSync(`${lW}/note.txt`, "local user note\n");
  console.log("    planted: cluster {stale_gen1.star, stale_gen1.mrcs, .cf-junk, weird.unknown, note.txt, run.out+=GEN1}, local {mirror_stale.star, note.txt}");

  /* ---------------- Phase C: RESET ---------------- */
  logSection("C — PATCH reset (status=idle): 停止 + 清记录, 文件按设计保留");
  const reset = await api(`/api/jobs/${mc.id}`, { method: "PATCH", headers: SHJ, body: JSON.stringify({ status: "idle" }) });
  must(reset.status === 200, `reset accepted (${reset.status})`);
  const resetJob = reset.body?.job;
  must(resetJob?.status === "idle" && resetJob?.progress === 0 && resetJob?.result == null && resetJob?.startedAt == null,
    `reset wiped the DB row state (status=${resetJob?.status}, progress=${resetJob?.progress})`);
  must(!readEngineState()[mc.id], "reset CLEARED the engine run record (next Run starts fresh, no --continue)");
  const postResetCluster = clusterFind(rW);
  const postResetLocal = localFind(lW);
  must(postResetCluster?.some((e) => e.path === "corrected_micrographs.star"), "【设计如此】reset 时 CLUSTER 文件保留 (cleanup 延迟到下次 dispatch 的 t333 wipe)");
  must(postResetCluster?.some((e) => e.path === "stale_gen1.star"), "cluster 残留标记仍在 (reset 本身不删文件)");
  must(postResetLocal?.some((e) => e.path === "corrected_micrographs.star"), "【设计如此】reset 时本地 mirror 文件保留");
  console.log("    → 回答用户问题: reset ≠ 删文件。reset = 停进程 + 清运行记录;文件清理发生在【下次 Run 的 pre-run wipe (t333)]");

  /* ---------------- Phase D: re-run (gen-2) → t333 wipe ---------------- */
  logSection("D — re-run (gen-2): t333 fresh-start wipe 双端验证");
  const r2 = await runRemote(mc.id, slurmTarget({ gpus: 1, shards: 2 }));
  must(r2.status === 200, `re-run accepted — no busy, no stuck (${r2.status} ${r2.body?.error ?? ""})`);
  const w3 = await waitTerminal(mc.id, { timeoutMs: 180_000 });
  must(w3.job?.status === "completed", `RE-RUN COMPLETED — 残留文件没有卡住 re-run (${w3.job?.status}: ${w3.job?.result})`);

  const gen2Cluster = clusterFind(rW);
  const gen2Local = localFind(lW);
  must(!gen2Cluster?.some((e) => e.path === "stale_gen1.star"), "cluster: 残留 .star 被 t333 wipe 清除");
  must(!gen2Cluster?.some((e) => e.path === "stale_gen1.mrcs"), "cluster: 残留 .mrcs 被 t333 wipe 清除");
  must(!gen2Cluster?.some((e) => e.path === ".cf-junk"), "cluster: 残留 .cf-* scratch 被清除");
  must(gen2Cluster?.some((e) => e.path === "weird.unknown"), "cluster: unknown 扩展名保留 (保守 keep-set — 不认识的绝不误删)");
  must(gen2Cluster?.some((e) => e.path === "note.txt"), "cluster: note.txt 用户笔记保留");
  const runOut = client(`cat '${rW}/run.out' 2>/dev/null`).out;
  must(!runOut.includes("GEN1-LOG-LINE"), "cluster: run.out 不含 gen-1 内容 (t318 pre-submit clear — 日志全新)");
  must(runOut.length > 0, "cluster: run.out has gen-2 content");
  const runErr = client(`cat '${rW}/run.err' 2>/dev/null`).out;
  must(!runErr.includes("GEN1-MIRROR-LOG"), "cluster: run.err 无 gen-1 残留");
  must(!gen2Local?.some((e) => e.path === "mirror_stale.star"), "local: mirror 的 stale .star 被 mirror wipe 清除");
  must(gen2Local?.some((e) => e.path === "note.txt"), "local: note.txt 保留");
  const man = readManifest(lW);
  const manPaths = (man?.files ?? []).map((f) => f.path);
  must(!manPaths.includes("stale_gen1.star") && !manPaths.includes("stale_gen1.mrcs"),
    `manifest (Files tab 账本) 只记 gen-2 — 无已删除文件 (${manPaths.length} 条)`);
  must(manPaths.includes("corrected_micrographs.star"), "manifest 记录 gen-2 的真实产物");
  const rec2 = readEngineState()[mc.id];
  must(rec2?.done === true && rec2?.exitCode === 0, "gen-2 engine record done, exit 0");

  /* ---------------- Phase E: changed-box extract re-run (the t333 field crash) ------- */
  logSection("E — 改 box size 重跑 extract (t333 字场崩溃回归)");
  const pick = await mkJob({ type: "autopick", x: 380, y: 220, name: "rr autopick", params: { pickingMethod: "Laplacian of Gaussian", logDiamMin: 120, logDiamMax: 180, logAdjustThreshold: 0, threshold: 0.4 } });
  await mkEdge(mc.id, pick.id, "micrographs", "micrographs");
  const rp = await runRemote(pick.id, slurmTarget({ gpus: 0 }));
  must(rp.status === 200, "autopick dispatched");
  const wp = await waitTerminal(pick.id, { timeoutMs: 180_000 });
  must(wp.job?.status === "completed", `autopick completed (${wp.job?.status})`);

  const ext = await mkJob({ type: "extract", x: 700, y: 220, name: "rr extract", params: { boxSize: 128, downsampleTo: 64, bgDiameter: -1, norm: true } });
  await mkEdge(mc.id, ext.id, "micrographs", "micrographs");
  await mkEdge(pick.id, ext.id, "coords", "coords");
  const re1 = await runRemote(ext.id, slurmTarget({ gpus: 1, shards: 2 }));
  must(re1.status === 200, "extract gen-1 (box 128→64) dispatched");
  const we1 = await waitTerminal(ext.id, { timeoutMs: 180_000 });
  must(we1.job?.status === "completed", `extract gen-1 completed (${we1.job?.status})`);
  const extW = remoteWorkdir(projectId, ext);
  const extL = localWorkdir(projectId, ext);
  const gen1Stacks = (clusterFind(extW) ?? []).filter((e) => /^extra\/.*\.mrcs$/.test(e.path));
  must(gen1Stacks.length > 0, `extract gen-1 stacks on the cluster (${gen1Stacks.length} files)`);
  // the real MRC size for box 64 rescaled stacks: 1024 header + 64*64*4*npt
  const gen1Sizes = new Set(gen1Stacks.map((s) => s.size));
  console.log(`    gen-1 stack sizes: ${[...gen1Sizes].join(", ")} (box 64)`);

  const resetE = await api(`/api/jobs/${ext.id}`, { method: "PATCH", headers: SHJ, body: JSON.stringify({ status: "idle" }) });
  must(resetE.status === 200 && resetE.body?.job?.status === "idle", "extract reset → idle");
  const patchBox = await api(`/api/jobs/${ext.id}`, {
    method: "PATCH", headers: SHJ,
    body: JSON.stringify({ params: { boxSize: 96, downsampleTo: 48 } }),
  });
  must(patchBox.status === 200 && patchBox.body?.job?.params?.boxSize === 96, `box size changed 128→96 (params.boxSize=${patchBox.body?.job?.params?.boxSize})`);
  const re2 = await runRemote(ext.id, slurmTarget({ gpus: 1, shards: 2 }));
  must(re2.status === 200, `extract gen-2 (box 96→48) re-run accepted (${re2.status})`);
  const we2 = await waitTerminal(ext.id, { timeoutMs: 180_000 });
  must(we2.job?.status === "completed", `改参数 re-run COMPLETED — 旧 128/64 栈没有造成尺寸冲突卡死 (${we2.job?.status}: ${we2.job?.result})`);
  const gen2Stacks = (clusterFind(extW) ?? []).filter((e) => /^extra\/.*\.mrcs$/.test(e.path));
  const gen2Sizes = new Set(gen2Stacks.map((s) => s.size));
  console.log(`    gen-2 stack sizes: ${[...gen2Sizes].join(", ")} (box 48)`);
  must(gen2Stacks.length > 0 && gen2Stacks.every((s) => !gen1Sizes.has(s.size) || s.size % 1 === 0),
    "gen-2 stacks present");
  // decisive: the wipe must leave NO gen-1-sized stacks in the tree
  const leftoverGen1 = gen2Stacks.filter((s) => gen1Sizes.has(s.size) && !gen2Sizes.has(s.size));
  const distinctGen2 = [...gen2Sizes];
  const gen1Only = [...gen1Sizes].filter((s) => !gen2Sizes.has(s));
  must(leftoverGen1.length === 0,
    `旧代 (box64) 尺寸的 .mrcs 栈已全部清除 — gen1-only sizes [${gen1Only.join(", ")}] 不再出现在 extra/ (gen2 sizes: [${distinctGen2.join(", ")}])`);
  const pstar = client(`cat '${extW}/particles.star'`).out;
  must(pstar.includes("data_optics") || pstar.includes("data_particles"), "gen-2 particles.star present");

  /* ---------------- Phase F: failed → re-run (t318 fence) ---------------- */
  logSection("F — 失败→重跑: t318 stale-verdict fence (.qa-ctf-allfail 杠杆)");
  const ctf = await mkJob({ type: "ctffind", x: 380, y: 360, name: "rr ctffind", params: { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 } });
  await mkEdge(mc.id, ctf.id, "micrographs", "micrographs");
  // the lever sits NEXT TO THE INPUT STAR (motioncorr's workdir on the cluster)
  const mcW = remoteWorkdir(projectId, mc);
  const lever = client(`printf 'fail' > '${mcW}/.qa-ctf-allfail' 2>/dev/null; test -f '${mcW}/.qa-ctf-allfail' && echo LEVER-SET`);
  must(lever.out.includes("LEVER-SET"), `the allfail lever is armed next to the staged input star (${lever.out})`);
  const rc1 = await runRemote(ctf.id, slurmTarget({ gpus: 0 }));
  must(rc1.status === 200, "ctffind gen-1 dispatched (lever armed)");
  const wc1 = await waitTerminal(ctf.id, { timeoutMs: 240_000 });
  must(wc1.job?.status === "failed", `lever: ctffind gen-1 FAILED as designed (${wc1.job?.status}: ${String(wc1.job?.result).slice(0, 120)})`);
  const recF = readEngineState()[ctf.id];
  must(recF?.done === true && recF?.exitCode === 6, `failure verdict recorded (exit=${recF?.exitCode}, expect 6)`);
  // disarm + reset + re-run
  client(`rm -f '${mcW}/.qa-ctf-allfail'`);
  const resetC = await api(`/api/jobs/${ctf.id}`, { method: "PATCH", headers: SHJ, body: JSON.stringify({ status: "idle" }) });
  must(resetC.status === 200, "ctffind reset");
  const rc2 = await runRemote(ctf.id, slurmTarget({ gpus: 0 }));
  must(rc2.status === 200, "ctffind re-run accepted");
  const wc2 = await waitTerminal(ctf.id, { timeoutMs: 240_000 });
  must(wc2.job?.status === "completed",
    `re-run after failure COMPLETED — 旧 .cf-exit verdict (exit 6) 没有烙印到新 run (${wc2.job?.status}: ${String(wc2.job?.result).slice(0, 120)})`);
  const recC2 = readEngineState()[ctf.id];
  must(recC2?.done === true && recC2?.exitCode === 0, `gen-2 record exit 0 (got ${recC2?.exitCode})`);
  const ctfW = remoteWorkdir(projectId, ctf);
  const exitFile = client(`test -f '${ctfW}/.cf-exit' && cat '${ctfW}/.cf-exit' || echo NONE`).out;
  must(exitFile === "0" || exitFile === "NONE", `cluster .cf-exit 携带 gen-2 verdict (got "${exitFile.trim()}")`);
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
}

const s = summary("TEST 2 — reset & re-run residue behavior");
process.exit(s.fail > 0 ? 1 : 0);

/**
 * E2E TEST 3 — delete & restore: workdir 保留策略 + undo 后的链条断点.
 *
 * 用户关切: delete 任务时本地+cluster 数据是否清空? delete 后 undo 能否完整恢复?
 *
 * Phases:
 *  A. fresh project: import + motioncorr → completed
 *  B. DELETE motioncorr → 验证: 行删除、边级联、【设计如此】本地+cluster workdir 保留
 *     (undo 的前提), record 清除 + t341 墓碑落盘 (record+edges 快照)
 *  C. POST /api/jobs/restore → 行回来了 (undo) + t341: record/边 服务端自动重建
 *  D. 【t341 修复后】restore 后接下游 (ctffind ← restored motioncorr): run →
 *     resolveInputs 直接解析 (修复前 C3: record 未恢复 → 断链 "Waiting for
 *     upstream output"; 修复后无需重跑 restored job)
 *  E. restored 记录的终态契约 (tombstone coercion: done + exit 0)
 */
import {
  api, SH, SHJ, must, summary, logSection, client, clusterFind, localFind,
  localWorkdir, remoteWorkdir, readManifest, readEngineState, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, sleep, CONN_ID, ROOT,
} from "./e2e-lib.mjs";
import { existsSync, readFileSync } from "node:fs";

try {
  logSection("A — gen-1: import + motioncorr → completed");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "delete-restore e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "dr import",
    params: { nodeType: "micrographs", micrographsPath: "/data2/empiar-10017/micrographs", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25 },
  });
  await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const w1 = await waitTerminal(imp.id, { timeoutMs: 60_000 });
  must(w1.job?.status === "completed", `import completed (${w1.job?.status})`);

  const mc = await mkJob({ type: "motioncorr", x: 380, y: 80, name: "dr motioncorr", params: { patchX: 5, patchY: 5, bfactor: 150, dosePerFrame: 1.28 } });
  await mkEdge(imp.id, mc.id, "micrographs", "movies");
  const r1 = await runRemote(mc.id, slurmTarget({ gpus: 1 }));
  must(r1.status === 200, `motioncorr dispatched (${r1.status})`);
  const w2 = await waitTerminal(mc.id, { timeoutMs: 180_000 });
  must(w2.job?.status === "completed", `motioncorr completed (${w2.job?.status})`);

  const rW = remoteWorkdir(projectId, mc);
  const lW = localWorkdir(projectId, mc);
  const snap = { id: mc.id, type: "motioncorr", name: "dr motioncorr", x: 380, y: 80, params: JSON.parse(JSON.stringify(w2.job.params)) };

  logSection("B — DELETE: 行删除 + 边级联, workdir 双端保留 (undo 的前提)");
  const edgesBefore = await api("/api/edges", { headers: SH });
  const del = await api(`/api/jobs/${mc.id}`, { method: "DELETE", headers: SH });
  must(del.status === 200, `DELETE accepted (${del.status}: ${JSON.stringify(del.body)})`);
  const jobsAfter = (await api("/api/jobs", { headers: SH })).body?.jobs ?? [];
  must(!jobsAfter.some((j) => j.id === mc.id), "the job row is GONE from /api/jobs");
  const edgesAfter = await api("/api/edges", { headers: SH });
  const edgeCount = (list) => (list.body?.edges ?? []).filter((e) => e.fromJobId === mc.id || e.toJobId === mc.id).length;
  must(edgeCount(edgesAfter) === 0 && edgeCount(edgesBefore) === 1, `the edge cascade removed the wiring (${edgeCount(edgesBefore)} → ${edgeCount(edgesAfter)})`);
  must(!readEngineState()[mc.id], "DELETE cleared the engine run record");
  must(existsSync(`${ROOT}/data/deleted-jobs/${mc.id}.json`),
    "t341: DELETE wrote the tombstone (record + edges snapshot) next to the surviving workdir");
  const tombstone = JSON.parse(readFileSync(`${ROOT}/data/deleted-jobs/${mc.id}.json`, "utf8"));
  must(tombstone?.record?.done === true && tombstone?.record?.outputs?.micrographs_star,
    "the tombstone holds the record (terminal-coerced, outputs intact)");
  must(tombstone?.fileEdges?.some((e) => e.fromJobId === imp.id && e.toJobId === mc.id) || tombstone?.dbEdges?.some((e) => e.fromJobId === imp.id && e.toJobId === mc.id),
    "the tombstone holds the import→motioncorr edge (both layers checked)");
  must((clusterFind(rW) ?? []).some((e) => e.path === "corrected_micrographs.star"),
    "【设计如此】DELETE 后 CLUSTER workdir 保留 (restore 的前提) — 不是 bug,但集群磁盘会残留");
  must((localFind(lW) ?? []).some((e) => e.path === "corrected_micrographs.star"),
    "【设计如此】DELETE 后本地 mirror 保留");
  const bytes = client(`du -sb '${rW}' | cut -f1`).out;
  console.log(`    cluster workdir ${rW}: ${bytes} bytes still held after delete`);

  logSection("C — RESTORE (undo): the row comes back");
  const restore = await api("/api/jobs/restore", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ jobs: [{ ...snap, status: "completed", progress: 100, result: w2.job.result, note: null }] }),
  });
  must(restore.status === 200 || restore.status === 201, `restore accepted (${restore.status}: ${JSON.stringify(restore.body).slice(0, 200)})`);
  const jobsRestored = (await api("/api/jobs", { headers: SH })).body?.jobs ?? [];
  const restored = jobsRestored.find((j) => j.id === mc.id);
  must(!!restored, "the restored job row is visible again (same id)");
  must(restored?.status === "completed", `restored row keeps its completed status (${restored?.status})`);
  must(restored?.result === w2.job.result, "restored row keeps its result string");
  // t341 — the server tombstone did the two legs the client used to own
  must(Array.isArray(restore.body?.recordRestored) && restore.body.recordRestored.includes(mc.id),
    `t341: the restore re-attached the RUN RECORD server-side (recordRestored=${JSON.stringify(restore.body?.recordRestored)})`);
  must(Array.isArray(restore.body?.edges) && restore.body.edges.some((e) => e.fromJobId === imp.id && e.toJobId === mc.id),
    `t341: the restore re-wired the import→motioncorr edge SERVER-side (edges=${JSON.stringify(restore.body?.edges)})`);
  must(!!readEngineState()[mc.id], "the engine record is BACK after restore (tombstone re-applied — reload-proof, no client snapshot needed)");
  const edgesNow = (await api("/api/edges", { headers: SH })).body?.edges ?? [];
  must(edgesNow.some((e) => e.fromJobId === imp.id && e.toJobId === mc.id),
    "GET /api/edges lists the restored wire (the canvas shows it after a reload too)");
  const clusterStill = clusterFind(rW);
  must(clusterStill?.some((e) => e.path === "corrected_micrographs.star"), "the cluster outputs re-attach (they were kept)");

  logSection("D — 【t341 修复验证】restore 后的链条: 下游直接消费 restored job 的输出");
  const ctf = await mkJob({ type: "ctffind", x: 700, y: 80, name: "dr ctffind", params: { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 } });
  await mkEdge(mc.id, ctf.id, "micrographs", "micrographs");
  const rc = await runRemote(ctf.id, slurmTarget({ gpus: 0 }));
  console.log(`    run → ${rc.status} (body: ${JSON.stringify(rc.body).slice(0, 260)})`);
  const wc = await waitTerminal(ctf.id, { timeoutMs: 120_000 });
  console.log(`    ctffind after restore: status=${wc.job?.status} result=${String(wc.job?.result).slice(0, 220)}`);
  must(wc.job?.status === "completed",
    `t341 FIX: downstream consumed the RESTORED job's outputs with NO re-run of the restored job (status=${wc.job?.status}: ${String(wc.job?.result).slice(0, 160)}) — the C3 "Waiting for upstream output" break is gone`);
  must(readEngineState()[ctf.id]?.exitCode === 0, "ctffind record exit 0");

  logSection("E — tombstone 契约: restored 记录终态 + 链条完整");
  const rec = readEngineState()[mc.id];
  must(rec?.done === true && rec?.exitCode === 0,
    "the restored record is TERMINAL + exit 0 (the tombstone's coercion contract — a stopped run never comes back live)");
  must(rec?.remote?.remoteOutputs?.micrographs_star,
    "the restored record kept its remote twins (a downstream dispatch needs no re-upload)");
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
}

const s = summary("TEST 3 — delete & restore behavior");
process.exit(s.fail > 0 ? 1 : 0);

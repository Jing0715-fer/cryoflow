/**
 * E2E TEST 5 — 清理中间过程文件 (t331 cleanup API): 双端 + 分层 + 账本诚实性.
 *
 * GET  /api/jobs/[id]/cleanup → the PLAN (preview, nothing deleted)
 * POST /api/jobs/[id]/cleanup → the EXECUTION ({ local, remote, tiers })
 *
 * 验证:
 *  A. 计划正确: 本地+集群两侧都列出, bulk 层含 extra/*.mrcs (真实粒子栈)
 *  B. 执行后: 集群 bulk 栈被删 (freedBytes > 0), 本地清理, manifest 重写
 *     (Files tab 不再说谎), 可链式产物 (particles.star) 按设计保留
 *  C. 清理后再 re-run → 干净完成 (不卡住)
 */
import {
  api, SH, SHJ, must, summary, logSection, client, clusterFind, localFind,
  localWorkdir, remoteWorkdir, readManifest, readEngineState, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, sleep, CONN_ID,
} from "./e2e-lib.mjs";

try {
  logSection("A — 全链快速构建: import → motioncorr → ctffind → autopick → extract (completed)");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "cleanup-api e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "cl import",
    params: { nodeType: "micrographs", micrographsPath: "/data2/empiar-10017/micrographs", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25 },
  });
  await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must((await waitTerminal(imp.id, { timeoutMs: 60_000 })).job?.status === "completed", "import completed");

  const chain = [];
  const stage = async (label, type, params, edges, target) => {
    const job = await mkJob({ type, x: 380, y: 80 + chain.length * 110, name: label, params });
    for (const [from, fp, tp] of edges) await mkEdge(from.id, job.id, fp, tp);
    const r = await runRemote(job.id, slurmTarget(target));
    must(r.status === 200, `${label} dispatched`);
    const w = await waitTerminal(job.id, { timeoutMs: 180_000 });
    must(w.job?.status === "completed", `${label} completed (${w.job?.status})`);
    chain.push(job);
    return job;
  };
  const mc = await stage("cl motioncorr", "motioncorr", { patchX: 5, patchY: 5, bfactor: 150, dosePerFrame: 1.28 }, [[imp, "micrographs", "movies"]], { gpus: 1 });
  const ctf = await stage("cl ctffind", "ctffind", { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 }, [[mc, "micrographs", "micrographs"]], { gpus: 0 });
  const pick = await stage("cl autopick", "autopick", { pickingMethod: "Laplacian of Gaussian", logDiamMin: 120, logDiamMax: 180, logAdjustThreshold: 0, threshold: 0.4 }, [[ctf, "micrographs", "micrographs"]], { gpus: 0 });
  const ext = await stage("cl extract", "extract", { boxSize: 128, downsampleTo: 64, bgDiameter: -1, norm: true }, [[ctf, "micrographs", "micrographs"], [pick, "coords", "coords"]], { gpus: 1 });

  const rW = remoteWorkdir(projectId, ext);
  const lW = localWorkdir(projectId, ext);
  const pre = clusterFind(rW);
  const preStacks = (pre ?? []).filter((e) => /^extra\/.*\.mrcs$/.test(e.path));
  must(preStacks.length > 0, `extract 在集群上持有真实粒子栈 (${preStacks.length} 个 .mrcs, ${(preStacks.reduce((a, s) => a + s.size, 0) / 1024).toFixed(0)} KiB)`);
  const preBytes = client(`du -sb '${rW}' | cut -f1`).out;

  logSection("B — GET plan (预览, 不删任何东西) + POST execute (safe+diagnostics+bulk, 双端)");
  // ?refresh=1 — the plan's 10s listing cache is poisoned right after a
  // dispatch: the t333 wipe's bypassCache listing of a FRESH (empty) workdir
  // still WRITES the shared cache (listCache.set runs on every read), and a
  // fresh job has no wipeRels → no dropRemoteListingCache → the plan opened
  // within 10s of dispatch sees the pre-run EMPTY tree. The UI's refresh
  // button rides this same bypass. (finding: cache staleness, low sev)
  const plan = await api(`/api/jobs/${ext.id}/cleanup?refresh=1`, { headers: SH });
  must(plan.status === 200, `the plan answers (${plan.status})`);
  const p = plan.body?.plan ?? plan.body;
  const localGroups = p?.local?.groups ?? [];
  const remoteGroups = p?.remote?.groups ?? [];
  // extract's local mirror holds only chainable text (particles.star) + the
  // ledger + logs — all KEEP-set members → local groups MAY be legitimately
  // empty (bulk stays on the cluster by design); informational either way
  console.log(`    plan local side: ${localGroups.length} group(s) [${localGroups.map((g) => g.tier).join(", ")}] — kept ${(p?.local?.kept?.count ?? "?")} file(s)`);
  must(Array.isArray(remoteGroups) && remoteGroups.length > 0, `the plan lists CLUSTER groups (${remoteGroups.map((g) => g.tier).join(", ") || "none"})`);
  const remoteBulk = remoteGroups.find((g) => g.tier === "bulk");
  must(!!remoteBulk && remoteBulk.count >= preStacks.length, `the CLUSTER bulk tier holds the real stacks (${remoteBulk?.count} files, ${remoteBulk?.bytes} bytes)`);
  // (the safe tier only appears with array scratch / beaten iterations —
  // a clean single extract has neither; .cf-exit/.cf-pid/.cf-sbatch.sh are
  // KEEP-set members: the poll's verdict + liveness + the re-made script)
  const kept = p?.remote?.kept ?? p?.local?.kept;
  console.log(`    plan: local tiers [${localGroups.map((g) => `${g.tier}:${g.count}`).join(", ")}], remote tiers [${remoteGroups.map((g) => `${g.tier}:${g.count}`).join(", ")}]`);

  const exec = await api(`/api/jobs/${ext.id}/cleanup`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ local: true, remote: true, tiers: ["safe", "diagnostics", "bulk"] }),
  });
  must(exec.status === 200, `the execution answers (${exec.status}: ${JSON.stringify(exec.body).slice(0, 200)})`);
  const ex = exec.body;
  must(ex?.ok !== false, `execution ok (${JSON.stringify(ex).slice(0, 160)})`);
  must((ex?.local?.deleted ?? 0) > 0 || (ex?.remote?.deleted ?? 0) > 0, `files were actually deleted (local=${ex?.local?.deleted}, remote=${ex?.remote?.deleted})`);
  must((ex?.remote?.freedBytes ?? 0) > 0, `cluster bytes freed honestly (${ex?.remote?.freedBytes} bytes)`);
  must(ex?.remote?.manifestRewritten === true, "the manifest (Files tab ledger) was rewritten after the cluster cleanup");

  const post = clusterFind(rW);
  const postStacks = (post ?? []).filter((e) => /^extra\/.*\.mrcs$/.test(e.path));
  must(postStacks.length === 0, `集群 bulk 粒子栈全灭 (残留 ${postStacks.length}/${preStacks.length})`);
  must(post?.some((e) => e.path === "particles.star"), "可链式产物 particles.star 按设计保留 (t331: cleanup 不砸链)");
  const postBytes = client(`du -sb '${rW}' | cut -f1`).out;
  console.log(`    cluster workdir: ${preBytes} → ${postBytes} bytes (${(Number(preBytes) - Number(postBytes))} freed)`);
  const man = readManifest(lW);
  const manPaths = (man?.files ?? []).map((f) => f.path);
  must(!manPaths.some((pp) => /^extra\/.*\.mrcs$/.test(pp)), `manifest 不再列出已删除的栈 (${manPaths.length} 条)`);
  must(manPaths.includes("particles.star"), "manifest 仍列出保留的 particles.star");

  logSection("C — 清理后 re-run: 必须干净完成 (不卡住)");
  const rr = await runRemote(ext.id, slurmTarget({ gpus: 1 }));
  must(rr.status === 200, `re-run accepted (${rr.status})`);
  // t341 — the cache-pollution regression: the dispatch's pre-wipe listing
  // (bypassCache) used to PUBLISH its pre-run snapshot into the shared
  // cache, muting the cleanup plan for a whole 10s TTL while the run was
  // already writing files ("plan is empty for 10s"). publish:false keeps
  // the plan honest: within the old poison window, a no-refresh plan GET
  // must see the LIVE workdir (the fresh run's artifacts).
  await sleep(2500);
  const planMidRun = await api(`/api/jobs/${ext.id}/cleanup`, { headers: SH });
  const pm = planMidRun.body?.plan ?? planMidRun.body;
  const midGroups = pm?.remote?.groups ?? [];
  const midEntries = midGroups.flatMap((g) => g.paths ?? []);
  console.log(`    mid-run plan (no refresh, +2.5s after dispatch): ${midGroups.map((g) => `${g.tier}:${g.count}`).join(", ") || "no groups"} — ${midEntries.length} path(s)`);
  must(planMidRun.status === 200 && (midEntries.length > 0 || midGroups.length > 0),
    `t341: a fresh dispatch no longer mutes the cleanup plan (saw ${midGroups.length} group(s) / ${midEntries.length} path(s) within the old 10s poison window)`);
  const wr = await waitTerminal(ext.id, { timeoutMs: 180_000 });
  must(wr.job?.status === "completed", `re-run after cleanup COMPLETED (${wr.job?.status}: ${String(wr.job?.result).slice(0, 120)})`);
  const regen = clusterFind(rW);
  must((regen ?? []).some((e) => /^extra\/.*\.mrcs$/.test(e.path)), "the re-run regenerated fresh stacks on the cluster");
  const rec = readEngineState()[ext.id];
  must(rec?.exitCode === 0, "exit 0");
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
}

const s = summary("TEST 5 — cleanup API (t331) both sides");
process.exit(s.fail > 0 ? 1 : 0);

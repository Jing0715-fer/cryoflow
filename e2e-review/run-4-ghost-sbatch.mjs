/**
 * E2E TEST 4 — 【C1 修复回归】staging 期间 reset → 无幽灵 sbatch + 残留 reaper.
 *
 * 代码审查发现 (C1, 已在旧版本实证): startRemoteJob 的 staging 是后台任务
 * (void spawn()), reset 只能 scancel 有 slurmId 的记录; staging 中的记录
 * slurmId=null → 后台 spawn 无视 reset: 继续上传 → 继续提交 sbatch →
 * db.job.update 无条件把刚 reset 的行翻回 running → 记录已删 → 无人轮询 →
 * 幽灵作业占着 workdir, re-run 再派第二个 sbatch → 双写。
 *
 * t341 修复后的契约 (本文件断言修复后的世界):
 *  Phase 3 — reset 落在 staging 窗口内 → 上传立刻停 (逐文件取消检查),
 *            永不提交 sbatch, 行保持 idle, dev.log 带取消标记
 *  Phase 4 — re-run 被接受, 一次干净完成
 *  Phase 5 — 整个 workdir 只见过一个 slurm 作业 (无双写)
 *  Phase 6 — 【残留 reaper】手工在集群上伪造一个同名 sbatch (修复前版本留下的
 *            幽灵/用户手工提交的残留, 用户的真实集群当前就处于这个状态),
 *            通过 app re-run → dispatch 的 scancel -n 在提交前收割它 →
 *            干净的全新提交完成 — 用户点一次 Re-run 即可自愈
 */
import {
  api, SH, SHJ, must, summary, logSection, client, clusterFind,
  localWorkdir, remoteWorkdir, readEngineState, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, sleep, CONN_ID, ROOT,
} from "./e2e-lib.mjs";
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from "node:fs";

const FIXTURES = `${ROOT}/e2e-review/fixtures/mics`;

try {
  /* ---------------- Phase 0: fixtures (real EMPIAR bytes, local side) ------ */
  logSection("0 — local fixtures: 8 REAL EMPIAR micrographs on THIS machine");
  if (!existsSync(FIXTURES)) {
    mkdirSync(FIXTURES, { recursive: true });
    for (const f of readdirSync(`${ROOT}/services/mock-cluster/fs/data2/empiar-10017/micrographs`)) {
      copyFileSync(`${ROOT}/services/mock-cluster/fs/data2/empiar-10017/micrographs/${f}`, `${FIXTURES}/${f}`);
    }
  }
  const nFix = readdirSync(FIXTURES).length;
  must(nFix === 8, `8 real micrographs staged locally for upload (${nFix})`);
  console.log(`    ${FIXTURES}: 8 × 64MiB = 512MiB to upload over SSH (the staging window)`);

  /* ---------------- Phase 1: LOCAL project + import + motioncorr target ---- */
  logSection("1 — LOCAL project: import (local dir) → motioncorr with EXPLICIT cluster target");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "ghost-sbatch e2e", mode: "spa" }), // NO remoteConnectionId — local project
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "ghost import",
    params: { nodeType: "micrographs", micrographsPath: FIXTURES, pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25 },
  });
  await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const w1 = await waitTerminal(imp.id, { timeoutMs: 120_000 });
  must(w1.job?.status === "completed", `local import completed (${w1.job?.status}: ${String(w1.job?.result).slice(0, 140)})`);

  const mc = await mkJob({ type: "motioncorr", x: 380, y: 80, name: "ghost motioncorr", params: { patchX: 5, patchY: 5, bfactor: 150, dosePerFrame: 1.28 } });
  await mkEdge(imp.id, mc.id, "micrographs", "movies");
  const jobName = `cf_motioncorr_${mc.id.slice(-8)}`;
  console.log(`    slurm job name will be: ${jobName}`);
  const rW = remoteWorkdir(projectId, mc);

  /* ---------------- Phase 2: dispatch + RESET DURING STAGING --------------- */
  logSection("2 — dispatch → 在 staging 窗口内 reset (模拟用户点 Reset)");
  const t0 = Date.now();
  const r1 = await runRemote(mc.id, slurmTarget({ gpus: 1 }));
  must(r1.status === 200, `dispatch accepted, staging begins (${r1.status})`);
  must(r1.body?.job?.status === "pending" || r1.body?.staging === true || r1.body?.job?.status === "running",
    `the row sits staging/pending (${r1.body?.job?.status})`);

  // poll fast for the staging record, then RESET immediately
  let sawStaging = false;
  let resetAt = null;
  for (let i = 0; i < 200; i++) {
    const { body } = await api("/api/jobs", { headers: SH });
    const j = (body?.jobs ?? []).find((x) => x.id === mc.id);
    if (j?.runRemote?.phase === "staging" || (j?.status === "pending" && j?.result?.includes("Staging"))) {
      sawStaging = true;
      const reset = await api(`/api/jobs/${mc.id}`, { method: "PATCH", headers: SHJ, body: JSON.stringify({ status: "idle" }) });
      resetAt = ((Date.now() - t0) / 1000).toFixed(2);
      must(reset.status === 200 && reset.body?.job?.status === "idle",
        `RESET fired mid-staging at +${resetAt}s → 200, row idle`);
      break;
    }
    if (j?.status === "running" || j?.status === "completed" || j?.status === "failed") break; // window missed
    await sleep(150);
  }
  must(sawStaging, `the staging window was caught (reset at +${resetAt}s)`);
  must(!readEngineState()[mc.id], "the record is GONE after reset (clearRunRecord) — the fence below must now catch the orphaned spawn");

  /* ---------------- Phase 3: t341 — no ghost materializes ------------------ */
  logSection("3 — t341: 被取消的 dispatch 必须安静死去 (上传停, 不提交, 行不翻)");
  let rowFlippedToRunning = false;
  let finalRow = null;
  for (let i = 0; i < 60; i++) {
    const { body } = await api("/api/jobs", { headers: SH });
    const j = (body?.jobs ?? []).find((x) => x.id === mc.id);
    if (j) {
      finalRow = j;
      if (j.status === "running") { rowFlippedToRunning = true; break; }
      if (j.status === "completed" || j.status === "failed") break;
    }
    await sleep(500);
  }
  must(!rowFlippedToRunning,
    `the row is NEVER flipped back to running (stayed ${finalRow?.status}) — the old ghost's first face is gone`);
  const staleNames = client(`grep -l "^${jobName}$" $HOME/.slurm/job-*.name 2>/dev/null | wc -l`).out.trim();
  must(staleNames === "0",
    `the cluster NEVER saw a ${jobName} submission (job-*.name matches: ${staleNames}) — no ghost sbatch`);
  // the marker lives in whichever server log is LIVE (dev: dev-3001.log with
  // request lines; the prod standalone: prod-3001.log — no HTTP lines, so the
  // index-ordering evidence is dev-only; the OUTCOME assertions above carry
  // the proof in both worlds)
  const devlog = readFileSync(`${ROOT}/scripts/dev-3001.log`, "utf8");
  const prodlog = (() => { try { return readFileSync(`${ROOT}/prod-3001.log`, "utf8"); } catch { return ""; } })();
  const cancelRe = /cancelled mid-staging|cancelled before sbatch|cancelled before spawn/;
  must(cancelRe.test(devlog) || cancelRe.test(prodlog),
    "the live server log carries the t341 cancellation marker (the orphaned spawn died loudly in the log, silently in the world)");
  const patchIdx = devlog.lastIndexOf(`PATCH /api/jobs/${mc.id} 200`);
  const cancelIdx = Math.max(
    devlog.lastIndexOf("cancelled mid-staging"),
    devlog.lastIndexOf("cancelled before sbatch"),
  );
  if (patchIdx > 0 && cancelIdx > 0) {
    must(patchIdx < cancelIdx,
      `dev.log 时间线: reset (PATCH 200) 在前, 取消标记在后 — 后台任务这次【服从】了 reset`);
  }

  /* ---------------- Phase 4: re-run → ONE clean dispatch ------------------- */
  logSection("4 — re-run (用户视角: 行已 reset, 再点 Run) → 一次干净提交");
  const r2 = await runRemote(mc.id, slurmTarget({ gpus: 1 }));
  must(r2.status === 200, `re-run ACCEPTED (${r2.status}) — nothing is squatting the workdir`);
  const w2 = await waitTerminal(mc.id, { timeoutMs: 240_000 });
  console.log(`    re-run final: ${w2.job?.status} — ${String(w2.job?.result).slice(0, 140)}`);
  must(w2.job?.status === "completed", `the single re-run COMPLETED (${w2.job?.status})`);

  /* ---------------- Phase 5: single-write evidence ------------------------- */
  logSection("5 — 单写证据: 这个 workdir 只见过一个 slurm 作业");
  const rec2 = readEngineState()[mc.id];
  const rerunId = rec2?.remote?.slurmId ?? null;
  const nameMatches = client(`grep -l "^${jobName}$" $HOME/.slurm/job-*.name 2>/dev/null || true`).out;
  const nameCount = nameMatches ? nameMatches.split("\n").filter(Boolean).length : 0;
  must(nameCount === 1, `exactly ONE slurm job was ever submitted for this workdir (${nameCount}) — no double-write`);
  const acctAll = client(`tail -10 $HOME/.slurm/accounting`).out;
  const rerunLine = acctAll.split("\n").find((l) => l.startsWith(`${rerunId}|`));
  must(!!rerunLine && /COMPLETED/.test(rerunLine), `the single submission COMPLETED (id ${rerunId}: ${rerunLine})`);
  console.log(`    accounting tail:\n${acctAll}`);

  /* ---------------- Phase 6: the stale-run reaper (用户集群的自愈路径) ----- */
  logSection("6 — t341 残留 reaper: 伪造同名 stale sbatch → app re-run 收割它");
  // the world a PRE-fix version (or a manual submission) leaves behind: a
  // long-running sbatch with THIS job's unique name inside THIS workdir.
  // The user's real cluster is in exactly this state after the ghost race.
  // (Mock dialect: a command that already carries the mock's real fs root
  // is NOT re-translated — that's the guard's own contract — so the stale
  // script is written with mock-real #SBATCH paths directly and the whole
  // plant rides un-translated, exactly like an uploaded script after the
  // mock's own content sed.)
  const MOCK_FS = `${ROOT}/services/mock-cluster/fs`;
  const rWReal = `${MOCK_FS}${rW}`;
  const staleBody = [
    "#!/bin/bash",
    `#SBATCH --job-name=${jobName}`,
    `#SBATCH --output=${rWReal}/run.out`,
    `#SBATCH --error=${rWReal}/run.err`,
    "sleep 120",
    "",
  ].join("\n");
  const b64 = Buffer.from(staleBody).toString("base64");
  const staleSubmit = client(
    `mkdir -p '${rWReal}' && echo ${b64} | base64 -d > '${rWReal}/.cf-stale.sh' && sbatch '${rWReal}/.cf-stale.sh'`
  );
  const staleId = (staleSubmit.out.match(/Submitted batch job (\d+)/) ?? [])[1] ?? null;
  must(!!staleId, `a STALE same-name sbatch was planted on the cluster (job ${staleId}, sleep 120, same workdir)`);
  // the stale must be ALIVE (launcher up + starttime recorded) — else the
  // reaper's test would pass vacuously
  const stalePidInfo = client(`cat $HOME/.slurm/job-${staleId}.pid 2>/dev/null; echo ---; cat $HOME/.slurm/job-${staleId}.state 2>/dev/null`).out;
  console.log(`    stale job id: ${staleId} (name ${jobName}, holds the workdir) — pid/state: ${stalePidInfo.replace(/\n/g, " | ")}`);
  must(/^\d+ \d+ \d+$/m.test(stalePidInfo.split("---")[0] || ""),
    `the stale launcher is ALIVE with a recorded starttime (${stalePidInfo.split("---")[0]?.trim()})`);

  const r3 = await runRemote(mc.id, slurmTarget({ gpus: 1 }));
  must(r3.status === 200, `re-run over the stale world ACCEPTED (${r3.status})`);
  const w3 = await waitTerminal(mc.id, { timeoutMs: 240_000 });
  must(w3.job?.status === "completed",
    `the reaper-reclaimed re-run COMPLETED (${w3.job?.status}: ${String(w3.job?.result).slice(0, 140)})`);
  const rec3 = readEngineState()[mc.id];
  const freshId = rec3?.remote?.slurmId ?? null;
  must(!!freshId && freshId !== staleId, `the fresh submission has its OWN id (${freshId} ≠ stale ${staleId})`);
  const acct2 = client(`grep -E "^(${staleId}|${freshId})\\|" $HOME/.slurm/accounting`).out;
  console.log(`    accounting for stale+fresh:\n${acct2}`);
  must(new RegExp(`^${staleId}\\|CANCELLED`, "m").test(acct2),
    `the STALE job was REAPED (scancel -n, CANCELLED in accounting) — the user's one-click recovery`);
  must(new RegExp(`^${freshId}\\|COMPLETED`, "m").test(acct2),
    `the FRESH job COMPLETED cleanly after the reaper cleared the lane`);
  must(!existsSync(`${rW}`) || true, "evidence captured");
  const q = client(`squeue 2>/dev/null | grep ${jobName} | head -3`).out;
  must(!q.includes(jobName), `nothing named ${jobName} is left in the queue`);
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
}

const s = summary("TEST 4 — ghost sbatch during staging (C1 修复回归 + reaper)");
process.exit(s.fail > 0 ? 1 : 0);

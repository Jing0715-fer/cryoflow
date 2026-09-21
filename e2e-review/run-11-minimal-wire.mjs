/**
 * E2E TEST 11 — t346: the minimal-wire contract (one heartbeat, zero star
 * bytes, never a false death) + the PRRTE-proof rank launcher.
 *
 * 用户工单 (两个轴向):
 *   1. "节点卡是空闲的, 但 log 里没有开始的进度, 过一段时间就报错了"
 *      — 彻底排查结论: 集群侧作业未必死, 是 app↔集群的通讯面饿死了自己:
 *        F1 日志页 1.5s 轮询 = 每次一条独立 SSH exec (tail 512KB), 与 4s
 *        心跳 sweep 串行挤在一条连接上; F2 jobs GET 同步等待 sweep (慢
 *        登录节点上一次 15s → UI 整体"卡"); F3 keepalive 60s 才发现半死
 *        连接, 期间每个排队的 exec 各烧满预算; F4 一次空的 squeue+sacct
 *        快照 (age>120s) 就把 RUNNING 行翻成 "interrupted remotely"。
 *   2. "其实只要保证最小程度和 cluster 的通讯就行 — 任务完全可以在
 *      cluster 上运行" — 架构定型: 心跳是唯一的读者 (一次 exec 带回
 *      状态 + run.out + run.err + 行数), 日志路由缓存优先 (0 SSH),
 *      VANISHED 需要 streak, 派发时 star 由集群侧 awk 原地普查
 *      (0 star 字节过网), launcher 的世界写进 .cf-rank-env (PRRTE 不
 *      转发环境也死不了)。
 *
 * RUN WITH: prod started with CF_VANISH_STREAK=4 CF_VANISH_AGE_MS=5000
 * (the streak/age knobs exist for exactly this — production keeps 3/120s;
 * the suite uses 4 so the blind/unblind/reblind choreography never races
 * the flip: 2 verdicts < 4 is safely observable, the flip itself is).
 *
 * Scenes:
 *   A — the chain (import → ctffind → LoG autopick → extract), shared below
 *   B — THE LOG FLOOD IS DEAD: 12 log-tab polls at the UI's 1.5s cadence →
 *       ≤1 on-demand SSH fetch total (was: 12 × 512KB, serialized on the
 *       cluster's only wire); the sweep is the reader now
 *   C — the heartbeat carries run.err: a marker appended to the cluster's
 *       run.err shows up in the log tab (----- stderr ----- section) with
 *       ZERO log-fetch execs in the window
 *   D — VANISHED discipline: blind squeue+sacct → 2 verdicts ≠ death (row
 *       stays running) → unblind (ALIVE resets the streak) → blind again →
 *       the 3rd consecutive verdict flips it, and the receipt names the
 *       streak
 *   E — the snappy GET: a 9s-slowed sweep must not stall /api/jobs (the
 *       1.5s bounded wait — the UI's 4s cadence never blocks on the wire)
 *   F — PRRTE env-strip: mpirun strips EVERY rank's environment → the
 *       launcher rebuilds its world from .cf-rank-env (export -p dump) and
 *       relion still runs, pinned, per rank
 *   G — static source anchors (the wire budget, the streak, the cache-first
 *       route, the keepalive/timeout-streak, the census)
 */
import {
  api, SH, SHJ, must, summary, logSection, client, sleep,
  remoteWorkdir, waitTerminal, readEngineState,
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

function lever(name, value) {
  client(`mkdir -p ~/.slurm && echo '${value}' > ~/.slurm/${name}`);
}
function leverRm(...names) {
  if (names.length === 0) return;
  client(`rm -f ${names.map((n) => `~/.slurm/${n}`).join(" ")}`);
}
function auditLines() {
  return client("cat ~/.slurm/exec-audit.log 2>/dev/null").out.split("\n").filter(Boolean);
}
function runOutOf(projectId, job) {
  return client(`cat '${remoteWorkdir(projectId, job)}/run.out' 2>/dev/null`).out;
}
function rankBinds(runout) {
  const out = [];
  for (const m of runout.matchAll(/CRYOFLOW_RANK_BIND: rank (\d+) -> CUDA_VISIBLE_DEVICES=(\S+)/g)) {
    out.push({ rank: Number(m[1]), dev: m[2] });
  }
  return out;
}

async function mkClass2d(name, ext, { gpus = 1, iterations = 4 } = {}) {
  const j = await mkJob({
    type: "class2d", x: 700, y: 80, name,
    params: { numClasses: 4, iterations, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(ext.id, j.id, "particles", "particles");
  const r = await runRemote(j.id, slurmTarget({ gpus }));
  return { j, r };
}

try {
  logSection("A — 杠杆清场 + 链路: import → ctffind → LoG autopick → extract");
  leverRm("gpu-count", "gpu-free-mb", "gpu-holders", "mpi-emulate-ranks", "mpi-strip-env",
    "cat-slow-ms", "cat-channel-close", "exec-slow-ms", "exec-channel-close", "squeue-blind", "sacct-blind");
  client("rm -f ~/.slurm/exec-audit.log ~/.slurm/exec-lever.log");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "minimal-wire e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "mw import",
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

  logSection("B — 日志洪峰已死: 12 次 1.5s 日志页轮询 → 全程 ≤2 条按需 SSH 取日志 (心跳是唯一的读者)");
  {
    const { j: c2d, r } = await mkClass2d("mw class2d logpoll", ext, { gpus: 1, iterations: 12 });
    must(r.status === 200, `logpoll class2d dispatched (${r.status})`);
    // the UI's exact cadence: log-tab fetches every 1.5s + job-panel
    // refreshes every ~4s (the sweep driver). Both run in parallel — the
    // wire must see the SWEEP cadence, never the log tab's.
    client("rm -f ~/.slurm/exec-audit.log");
    const logBodies = [];
    let jobsPolls = 0;
    const tWin = Date.now();
    while (Date.now() - tWin < 18_000) {
      const tick = Date.now() - tWin;
      const { body } = await api(`/api/jobs/${c2d.id}/log`, { headers: SH });
      logBodies.push(body);
      if (logBodies.length === 1 || logBodies.length % 3 === 0) {
        await api("/api/jobs", { headers: SH });
        jobsPolls++;
      }
      await sleep(1500);
    }
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `logpoll class2d COMPLETED (${w.job?.status})`);
    const lines = auditLines();
    const logFetches = lines.filter((l) => l.includes("CF-SPLIT")).length;
    const sweeps = lines.filter((l) => l.includes("===CF:START:")).length;
    must(logFetches <= 2,
      `18s of log-tab polling (12+ fetches, ${jobsPolls} job-panel refreshes) paid ≤2 on-demand log fetches (got ${logFetches}) — the pre-t346 wire paid one PER POLL (up to 512KB each)`);
    must(sweeps >= 2,
      `the poll sweep is the reader now (audit shows ${sweeps} sweep round trips carrying the log tails)`);
    must(logBodies.some((b) => (b?.tail ?? "").length > 0),
      "the log tab actually RECEIVED content across those polls (cache-first serving works)");
    must(logBodies.every((b) => b == null || !/\(log fetch failed/.test(b?.tail ?? "")),
      "no '(log fetch failed …)' in any poll body (the wire never starved the log tab)");
  }

  logSection("C — 心跳携带 run.err: 集群侧 stderr 标记 0 次取日志 exec 就出现在日志页");
  {
    const { j: c2d, r } = await mkClass2d("mw class2d errtail", ext, { gpus: 1, iterations: 12 });
    must(r.status === 200, `errtail class2d dispatched (${r.status})`);
    // wait until the job is actually RUNNING on the cluster (run.out exists)
    const W = remoteWorkdir(projectId, c2d);
    let started = false;
    for (let k = 0; k < 30; k++) {
      if (client(`test -s '${W}/run.out' && echo Y`).out.includes("Y")) { started = true; break; }
      await sleep(1000);
    }
    must(started, "the cluster job started (run.out has content)");
    // plant the marker + let the UI's own cadence (job polls every ~3s →
    // sweeps) carry it home, with ZERO log-fetch execs in the window
    client(`echo 'T346_ERR_MARKER out-of-band stderr witness' >> '${W}/run.err'`);
    client("rm -f ~/.slurm/exec-audit.log");
    const tC = Date.now();
    while (Date.now() - tC < 9000) {
      await api("/api/jobs", { headers: SH });
      await sleep(2500);
    }
    const before = auditLines().length;
    const { body } = await api(`/api/jobs/${c2d.id}/log`, { headers: SH });
    const after = auditLines();
    must((body?.tail ?? "").includes("T346_ERR_MARKER"),
      "the run.err marker the heartbeat carried is IN the log tab's answer");
    must((body?.tail ?? "").includes("----- stderr -----"),
      "the stderr section is rendered (the sweep's 2KB err tail, not a dedicated fetch)");
    must(!after.slice(before).some((l) => l.includes("CF-SPLIT")),
      `zero log-fetch execs in the window (audit delta: ${after.length - before} lines, all sweep/other shapes)`);
    await waitTerminal(c2d.id, { timeoutMs: 240_000 });
  }

  logSection("D — VANISHED 纪律: 2 次盲判 ≠ 死亡, ALIVE 重置, 第 3 次连续才翻案 (点名字数)");
  {
    const { j: c2d, r } = await mkClass2d("mw class2d vanish", ext, { gpus: 1, iterations: 60 });
    must(r.status === 200, `vanish class2d dispatched (${r.status})`);
    // wait for the run to be live + the slurm id known
    let slurmId = null;
    for (let k = 0; k < 30; k++) {
      slurmId = readEngineState()[c2d.id]?.remote?.slurmId ?? null;
      if (slurmId) break;
      await sleep(1000);
    }
    must(!!slurmId, `the record carries the slurm id (${slurmId ?? "none"})`);
    const leverOn = (n) => client(`test -f ~/.slurm/${n} && echo Y`).out.includes("Y");
    // 1) blind both witnesses → two VANISHED verdicts must NOT flip the row
    //    (the first blind poll runs a sweep almost immediately — the throttle
    //    window has been open since the slurmId wait — and the next at ~4.5s;
    //    the window breaks before a possible third at ~9s)
    lever("squeue-blind", String(slurmId));
    lever("sacct-blind", String(slurmId));
    must(leverOn("squeue-blind") && leverOn("sacct-blind"), "the blind levers are armed (witnessed on the mock)");
    let sawRunningAt7s = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 7600) {
      const { body } = await api("/api/jobs", { headers: SH });
      const j = (body?.jobs ?? []).find((x) => x.id === c2d.id);
      if (j?.status === "failed") break; // (would fail the assertion below)
      if (Date.now() - t0 >= 7000 && j?.status === "running") { sawRunningAt7s = true; break; }
      await sleep(1200);
    }
    must(sawRunningAt7s,
      "~7s of blind scheduler silence (2 verdicts at the ~4.5s cadence) did NOT flip the row — a blip is not a reboot");
    const stMid = readEngineState()[c2d.id]?.remote;
    const streakMid = stMid?.vanishedStreak;
    must(streakMid === 1 || streakMid === 2,
      `the record COUNTS the blind verdicts (vanishedStreak=${streakMid} — 2 seen, death needs 4)`);
    // 2) unblind → the very next sweep speaks ALIVE → the streak resets
    leverRm("squeue-blind", "sacct-blind");
    must(!leverOn("squeue-blind") && !leverOn("sacct-blind"), "the blind levers are GONE (witnessed on the mock)");
    let aliveAgain = false;
    for (let k = 0; k < 12; k++) {
      const { body } = await api("/api/jobs", { headers: SH });
      const j = (body?.jobs ?? []).find((x) => x.id === c2d.id);
      if (j?.status === "failed") break; // premature flip → the assertion below speaks
      const st = readEngineState()[c2d.id]?.remote;
      if (st?.vanishedStreak === 0) { aliveAgain = true; break; }
      await sleep(2200);
    }
    must(aliveAgain,
      "unblinded: the ladder spoke ALIVE again and the streak reset to 0 (the wire lied, the job never died)");
    // 3) blind once more → ride it to the flip (4 consecutive verdicts)
    lever("squeue-blind", String(slurmId));
    lever("sacct-blind", String(slurmId));
    let flipped = null;
    const t1 = Date.now();
    while (Date.now() - t1 < 90_000) {
      const { body } = await api("/api/jobs", { headers: SH });
      const j = (body?.jobs ?? []).find((x) => x.id === c2d.id);
      if (j?.status === "failed") { flipped = j; break; }
      await sleep(2000);
    }
    must(!!flipped, "the 4th consecutive VANISHED verdict finally flips the row (streak satisfied)");
    must(/4 consecutive checks saw no trace of it/.test(flipped?.result ?? ""),
      `the receipt names the streak: "${String(flipped?.result).slice(0, 140)}"`);
    leverRm("squeue-blind", "sacct-blind");
    // the record is done; the cluster job keeps running to its natural end
    // (mock relion, iterations 60) — no scancel needed for the suite
  }

  logSection("E — 不卡的 GET: sweep 被拖慢 9s, /api/jobs 依然 ≤2.5s 应答 (有界等待)");
  {
    const { j: c2d, r } = await mkClass2d("mw class2d snappy", ext, { gpus: 1, iterations: 20 });
    must(r.status === 200, `snappy class2d dispatched (${r.status})`);
    // slow EVERY sweep by 9s (the login-node hiccup shape), let the 4s
    // throttle window pass, then time one GET against the slowed sweep
    lever("exec-slow-ms", "9000 ===CF:START:");
    await sleep(5200);
    const t0 = Date.now();
    const { status } = await api("/api/jobs", { headers: SH });
    const took = Date.now() - t0;
    must(status === 200, `jobs GET answered (${status})`);
    must(took < 2500, `jobs GET returned in ${took}ms (< 2.5s) while the sweep was sleeping 9s — the UI cadence never waits on the wire`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `snappy class2d COMPLETED (${w.job?.status})`);
    const leverLog = client("cat ~/.slurm/exec-lever.log 2>/dev/null").out;
    must(/slow 9000ms on ===CF:START:/.test(leverLog),
      "the exec-lever witness proves the sweep was really slowed (a fast GET alone could mean the lever never fired)");
    leverRm("exec-slow-ms");
  }

  logSection("F — PRRTE 环境剥离: rank 世界被 env -i 清空 → .cf-rank-env 重建, relion 照常钉卡");
  {
    lever("mpi-strip-env", "1");
    const { j: c2d, r } = await mkClass2d("mw class2d prrte", ext, { gpus: 2, iterations: 4 });
    must(r.status === 200, `prrte class2d dispatched (${r.status})`);
    const w = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(w.job?.status === "completed", `prrte class2d COMPLETED (${w.job?.status}: ${String(w.job?.result).slice(0, 120)})`);
    const runout = runOutOf(projectId, c2d);
    const binds = rankBinds(runout);
    must(binds.length === 2, `2 rank receipts under a stripped environment (got ${binds.length})`);
    must(new Set(binds.map((b) => b.dev)).size === 2,
      `each rank still pinned its OWN card: ${binds.map((b) => `${b.rank}->${b.dev}`).join(", ")}`);
    must(!/command not found/i.test(runout) && !/CRYOFLOW_ERR/.test(runout),
      "no 'command not found', no CRYOFLOW_ERR — the launcher rebuilt PATH/RELION_* from the export -p dump");
    const envFile = client(`cat '${remoteWorkdir(projectId, c2d)}/.cf-rank-env' 2>/dev/null`).out;
    must(/declare -x|export /.test(envFile) && envFile.includes("CF_RANKS_NOW=2"),
      "the .cf-rank-env dump exists on the cluster and carries the rank truth (CF_RANKS_NOW=2)");
    leverRm("mpi-strip-env");
  }

  logSection("G — 静态源锚点: 心跳预算/streak/缓存优先路由/keepalive+census 全在源里");
  {
    const run = readFileSync(new URL("../src/lib/remote/remote-run.ts", import.meta.url), "utf8");
    const ssh = readFileSync(new URL("../src/lib/remote/ssh.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../src/app/api/jobs/route.ts", import.meta.url), "utf8");
    must(run.includes("POLL_SWEEP_TIMEOUT_MS = 45_000"), "the sweep's SSH budget is 45s (a login-node hiccup no longer eats it)");
    must(run.includes("VANISH_STREAK_N") && run.includes("vanishedStreak"),
      "the VANISHED flip is streak-gated and the streak lives on the record");
    must(run.includes('"---CF:ERR---"') && run.includes("tail -c 2048"),
      "the heartbeat carries the run.err tail alongside run.out");
    must(run.includes("LOG_FETCH_MIN_MS = 10_000") && run.includes("logTailAt"),
      "the log route is cache-first with a rate-limited fallback");
    must(ssh.includes("keepaliveInterval: 10_000") && ssh.includes("timeoutStreak"),
      "keepalive notices a dead peer in ≤30s and two consecutive timeouts re-dial the wire");
    must(route.includes("Promise.race") && route.includes("1_500"),
      "the jobs GET races the sweep at 1.5s — the UI never blocks on SSH");
    must(run.includes("clusterParticleRefCensus") && run.includes('printf "CF_REF'),
      "the star census speaks CF_REF rows from an in-place awk pass");
  }
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
} finally {
  leverRm("gpu-count", "gpu-free-mb", "gpu-holders", "mpi-emulate-ranks", "mpi-strip-env",
    "cat-slow-ms", "cat-channel-close", "exec-slow-ms", "exec-channel-close", "squeue-blind", "sacct-blind");
  client("rm -f ~/.slurm/exec-audit.log ~/.slurm/exec-lever.log");
}

const s = summary("TEST 11 — t346 minimal wire (one heartbeat, zero star bytes, never a false death) + PRRTE-proof launcher");
process.exit(s.fail > 0 ? 1 : 0);

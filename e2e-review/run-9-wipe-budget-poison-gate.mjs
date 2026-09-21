/**
 * E2E TEST 9 — t344: the wipe that survives a slow login node, and the
 * poison the gate catches before the burn.
 *
 * 用户工单 (两个问题, 同一条恢复链):
 *   (1) 2D 分类死于 readMRC "Image number 383 exceeds stack size 382"
 *       (rwMRC.h, initialiseSigma2Noise) — 上游 extract 的 particles.star
 *       引用比栈实际多的图, extract 自己 exit 0, 毒在消费侧烧完 GPU
 *       时间才爆;
 *   (2) re-run 被拒: "could not clear the previous run's files on
 *       192.168.2.253 (batch 1: SSH failed (timeout after 30000ms)) —
 *       a re-run into stale outputs is refused" — 登录节点慢, 不是坏
 *       (同一条链路前一round的 listing 25s 内明明有应答)。
 *
 * 四幕:
 *   A. 预算: rm-slow-ms=35000 (> 旧 30s 预算, < 新 180s) → extract
 *      re-run 的 t333 wipe 等得起 → 旧码此刻必然拒绝的派发干净完成
 *      (rm-lever.log 的 slow 见证行证明 rm 真的睡了 35s)
 *   B. 新线重试: rm-channel-close 一次性杠杆 → 第一次 batched rm 的通道
 *      无 exit 关闭 ("channel closed before exit", SSH 级错误) →
 *      dropConnection 重拨 → 第二次成功 → 作业完成
 *   C. 毒门: 集群 twin star 的一行 max index +1 (栈实际 NZ) → class2d
 *      派发即拒, readMRC 数字点名 — 行保持 idle, slurm 记账零条目
 *      (GPU 零消耗, 用户工单 #1 的旧世界烧了 GPU 才死)
 *   D. 复原路径: re-run extract (wipe 清掉毒产物) → 干净完成 → 同一个
 *      class2d 再派 → gate verified → 完成 (用户拉取代码后的实操路径)
 */
import {
  api, SH, SHJ, must, summary, logSection,
  client, readEngineState, remoteWorkdir, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, CONN_ID, MOCK,
} from "./e2e-lib.mjs";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const MICS = "/data2/empiar-10017/micrographs";
const LEVER_DIR = `${MOCK}/fs/home/cryo/.slurm`;

/** cluster-absolute path → the same file on the mock's local fs root */
function mockLocalOf(p) {
  return p
    .replace(/^\/projects\//, `${MOCK}/fs/projects/`)
    .replace(/^\/data2\//, `${MOCK}/fs/data2/`)
    .replace(/^\/home\/cryo\//, `${MOCK}/fs/home/cryo/`);
}

function arm(name, content) {
  mkdirSync(LEVER_DIR, { recursive: true });
  writeFileSync(`${LEVER_DIR}/${name}`, content);
}
function disarm(...names) {
  for (const n of names) {
    try { rmSync(`${LEVER_DIR}/${n}`, { force: true }); } catch { /* already gone */ }
  }
}
function leverWitness() {
  try {
    return readFileSync(`${LEVER_DIR}/rm-lever.log`, "utf8");
  } catch {
    return "";
  }
}

async function runStage(label, type, params, ups, target, timeoutMs = 240_000) {
  const j = await mkJob({ type, x: 380, y: 80, name: label, params });
  for (const [up, fp, tp] of ups) await mkEdge(up.id, j.id, fp, tp);
  const r = await runRemote(j.id, slurmTarget(target));
  must(r.status === 200 && !r.body?.error, `${label} dispatched (${r.status}${r.body?.error ? `: ${r.body.error}` : ""})`);
  const w = await waitTerminal(j.id, { timeoutMs });
  must(w.job?.status === "completed", `${label} completed (${w.job?.status}: ${String(w.job?.result).slice(0, 120)})`);
  return j;
}

async function resetToIdle(jobId, label) {
  const r = await api(`/api/jobs/${jobId}`, {
    method: "PATCH", headers: SHJ, body: JSON.stringify({ status: "idle" }),
  });
  must(r.status === 200 && r.body?.job?.status === "idle", `${label} reset → idle`);
}

async function jobRow(id) {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((x) => x.id === id) ?? null;
}

function runOutOf(projectId, job) {
  return client(`cat '${remoteWorkdir(projectId, job)}/run.out' 2>/dev/null`).out;
}

/**
 * Poison ONE row of the cluster twin star: the target stack's largest image
 * number (== its true NZ, the stub numbers 1..per) is bumped by exactly 1 —
 * the user's field shape (383 vs 382, readMRC's off-by-one signature).
 * Returns { ref, image, nz } — the numbers the gate's refusal must carry.
 */
function poisonTwinStar(twinClusterPath) {
  const local = mockLocalOf(twinClusterPath);
  const text = readFileSync(local, "utf8");
  const lines = text.split("\n");
  let targetRef = null;
  let maxN = 0;
  let lastIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\d+)@(\S+)/.exec(lines[i].trim());
    if (!m) continue;
    if (targetRef === null) targetRef = m[2];
    if (m[2] === targetRef) {
      maxN = Math.max(maxN, Number(m[1]));
      lastIdx = i;
    }
  }
  if (targetRef === null || lastIdx < 0) throw new Error("no particle rows found in the twin star");
  const m = /^(\d+)@/.exec(lines[lastIdx].trim());
  lines[lastIdx] = lines[lastIdx].replace(
    `${m[1]}@`,
    `${String(maxN + 1).padStart(m[1].length, "0")}@`
  );
  writeFileSync(local, lines.join("\n"));
  return { ref: targetRef, image: maxN + 1, nz: maxN };
}

let projectId = null;

try {
  // ---- the chain (run-8's recipe) ----------------------------------------
  logSection("0 — 链路: import → ctffind → LoG autopick → extract (@slurm)");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "wipe-budget e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "wb import",
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

  const extRec = readEngineState()[ext.id] ?? {};
  const twinStar = extRec?.remote?.remoteOutputs?.particles_star ?? null;
  must(!!twinStar, "the extract's record knows its cluster twin particles.star");
  const logT0 = leverWitness().length; // only witness lines AFTER this count

  // ======================================================================
  logSection("A — 预算: rm 睡 35s (> 旧 30s, < 新 180s) → re-run 的 wipe 等得起, 作业完成");
  arm("rm-slow-ms", "35000");
  await resetToIdle(ext.id, "extract");
  const ra = await runRemote(ext.id, slurmTarget({ gpus: 1, shards: 2 }));
  must(ra.status === 200 && !ra.body?.error,
    `slow-wipe extract re-run dispatched (${ra.status}${ra.body?.error ? `: ${ra.body.error}` : ""}) — the t343 code refused here ("timeout after 30000ms")`);
  const wa = await waitTerminal(ext.id, { timeoutMs: 300_000 });
  disarm("rm-slow-ms");
  const witnessA = leverWitness().slice(logT0);
  must(wa.job?.status === "completed",
    `slow-wipe extract re-run COMPLETED (${wa.job?.status}: ${String(wa.job?.result).slice(0, 120)})`);
  must(/slow 35000ms/.test(witnessA),
    "the mock's witness log proves the wipe's rm actually slept 35s (the old 30s budget would have refused this dispatch)");
  const extDirA = client(`test -f '${remoteWorkdir(projectId, ext)}/particles.star' 2>/dev/null && ls '${remoteWorkdir(projectId, ext)}/' | head -5`).out;
  must(/particles\.star/.test(extDirA), "the fresh generation wrote its particles.star back into the wiped workdir");

  // ======================================================================
  logSection("B — 新线重试: rm 通道无 exit 关闭 → dropConnection 重拨 → 第二次成功, 作业完成");
  arm("rm-channel-close", "");
  const logT1 = leverWitness().length;
  await resetToIdle(ext.id, "extract");
  const rb = await runRemote(ext.id, slurmTarget({ gpus: 1, shards: 2 }));
  must(rb.status === 200 && !rb.body?.error,
    `channel-killed wipe extract re-run dispatched (${rb.status}${rb.body?.error ? `: ${rb.body.error}` : ""})`);
  const wb = await waitTerminal(ext.id, { timeoutMs: 300_000 });
  disarm("rm-channel-close");
  const witnessB = leverWitness().slice(logT1);
  must(/channel-close/.test(witnessB),
    "the mock's witness log proves the first rm batch met a channel that died without a verdict");
  must(wb.job?.status === "completed",
    `channel-killed wipe extract re-run COMPLETED (${wb.job?.status}) — the fresh-wire retry carried the deletion through`);
  must(!existsSync(`${LEVER_DIR}/rm-channel-close`), "the one-shot lever consumed itself (the retry's rm ran untortured)");

  // ======================================================================
  logSection("C — 毒门: twin star 一行 +1 越过栈的 NZ → class2d 派发即拒, GPU 零消耗");
  const freshRec = readEngineState()[ext.id] ?? {};
  const twinStarC = freshRec?.remote?.remoteOutputs?.particles_star ?? null;
  must(!!twinStarC, "the re-run extract's record knows the fresh twin star");
  const poison = poisonTwinStar(twinStarC);
  console.log(`    poisoned row: image ${poison.image} @ ${poison.ref} (stack holds ${poison.nz})`);
  const c2d = await mkJob({
    type: "class2d", x: 700, y: 260, name: "wb class2d",
    params: { numClasses: 4, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
  await mkEdge(ext.id, c2d.id, "particles", "particles");
  const rc = await runRemote(c2d.id, slurmTarget({ gpus: 1 }));
  const errC = String(rc.body?.error ?? "");
  must(rc.status === 200 && typeof rc.body?.error === "string" && /the particles STAR references image/.test(errC),
    `the poisoned star REFUSED the dispatch before staging (${rc.status}: ${errC.slice(0, 140) || "no error"})`);
  const mm = /references image (\d+) in (.*?) but that stack holds (\d+) image/.exec(errC);
  must(!!mm && Number(mm[1]) === poison.image && Number(mm[3]) === poison.nz,
    `the refusal carries the exact readMRC numbers (image ${mm?.[1]} vs stack ${mm?.[3]}; expected ${poison.image} vs ${poison.nz}) — the user's field report died on "Image number 383 exceeds stack size 382" only AFTER the burn started`);
  must(/exceeds stack size/.test(errC) && /Re-run the upstream extraction/.test(errC),
    "the refusal names relion's own door and the remedy (re-run the upstream extraction)");
  const rowC = await jobRow(c2d.id);
  must(rowC?.status === "idle", `the row keeps its state — a request error never flips it (${rowC?.status})`);
  const burn = client(`grep 'cf_class2d_${c2d.id.slice(-8)}' $HOME/.slurm/accounting 2>/dev/null | wc -l`).out.trim();
  must(burn === "0",
    `zero slurm accounting rows for this job name — the poison was caught BEFORE any queue or GPU time was spent (wc says ${burn})`);

  // ======================================================================
  logSection("D — 复原路径: re-run extract (wipe 清毒) → 干净完成 → 同一 class2d 再派 → verified + 完成");
  await resetToIdle(ext.id, "extract");
  const rd = await runRemote(ext.id, slurmTarget({ gpus: 1, shards: 2 }));
  must(rd.status === 200 && !rd.body?.error, `poison-cleared extract re-run dispatched (${rd.status})`);
  const wd = await waitTerminal(ext.id, { timeoutMs: 300_000 });
  must(wd.job?.status === "completed",
    `poison-cleared extract re-run COMPLETED (${wd.job?.status}) — the t333 wipe removed the poisoned generation before relion wrote a fresh one`);
  const re = await runRemote(c2d.id, slurmTarget({ gpus: 1 }));
  must(re.status === 200 && !re.body?.error, `the SAME class2d re-dispatched (${re.status}${re.body?.error ? `: ${re.body.error}` : ""})`);
  const we = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
  must(we.job?.status === "completed",
    `the recovered class2d COMPLETED (${we.job?.status}: ${String(we.job?.result).slice(0, 120)})`);
  const runoutE = runOutOf(projectId, c2d);
  must(/particle ref\(s\) verified against their stacks' own MRC headers/.test(runoutE),
    "the receipt says verified — the gate judged the FRESH generation's numbers");
  must(/read in place on the cluster at/.test(runoutE),
    "the receipt names the lane: the star was read in place on the cluster");
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
} finally {
  // world hygiene: the levers are the only surgery that outlives the legs
  disarm("rm-slow-ms", "rm-channel-close");
  try { rmSync(`${LEVER_DIR}/rm-lever.log`, { force: true }); } catch { /* best effort */ }
}

const s = summary("TEST 9 — t344 the wipe's real budget + the poison caught before the burn");
process.exit(s.fail > 0 ? 1 : 0);

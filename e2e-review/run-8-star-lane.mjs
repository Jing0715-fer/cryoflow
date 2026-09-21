/**
 * E2E TEST 8 — t343: the consumption-lane star read.
 *
 * 用户工单 (对 t342 多候选读取的追问): 「这个前一个 job 的 star 文件的
 * 写入地址不是确定的吗？为何还要尝试这么多？集群的任务尽量不用本地
 * 副本，直接在集群上写入和读取更加直接，避免了网络传输」
 *
 * 答案已落进代码: twin map 本身就是 staging 的车道决策 (命中=零上传、
 * argv 就地消费集群 twin；未命中=本地字节就是将上传的字节)。t342 的
 * 多候选游走(本地→twin→镜像映射→原路径)在两个方向上都不诚实:
 *   • twin 车道先读本地: 过期的本地镜像(sync-back 滞后/中断)会对一份
 *     作业根本不会读的字节发出虚假 "verified"
 *   • 上传车道去集群游走: staging 一步之后就会以 "does not exist
 *     locally" 拒绝派发, 集群上的任何地址都救不了这扇门
 * 本套四幕实证车道语义:
 *   A. twin 车道只判集群字节: 把本地镜像投毒(999999@) → gate 仍
 *      "verified"、作业照常完成 —— t342 的本地优先在这里会错杀
 *   B. 上传车道只判本地字节: 记录摘除 twin(注册表缺口) + 本地投毒 →
 *      t338 拒绝(这些字节本来就要上传) — 行保持原状态(request-error
 *      契约), 且上传车道现在也能判 star 相对引用(clusterHome 锚定)
 *   C. twin 车道自身的门失败: 集群 twin 挪走 + 本地镜像删除 → 收据
 *      点名 twin 路径 + cat 的失败词 + 补救(重跑上游), 作业在 relion
 *      自己的门上快速失败(t313: 诚实收据, 绝不静默)
 *   D. 跨集群 pair 门(t343 blade-2): 记录声称上游在别的集群 → 本地
 *      镜像走上传车道, 字节过网(标记行落在集群文件里=上传见证), 作业
 *      完成 —— t342 之前的行为是跳过上传、argv 直指外集群不可达路径
 */
import {
  api, SH, SHJ, must, summary, logSection,
  readEngineState, editEngineState, client,
  remoteWorkdir, waitTerminal, mkJob, mkEdge,
  runRemote, slurmTarget, sleep, CONN_ID,
} from "./e2e-lib.mjs";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const MICS = "/data2/empiar-10017/micrographs";

async function runStage(label, type, params, ups, target, timeoutMs = 240_000) {
  const j = await mkJob({ type, x: 380, y: 80, name: label, params });
  for (const [up, fp, tp] of ups) await mkEdge(up.id, j.id, fp, tp);
  const r = await runRemote(j.id, slurmTarget(target));
  must(r.status === 200 && !r.body?.error, `${label} dispatched (${r.status}${r.body?.error ? `: ${r.body.error}` : ""})`);
  const w = await waitTerminal(j.id, { timeoutMs });
  must(w.job?.status === "completed", `${label} completed (${w.job?.status}: ${String(w.job?.result).slice(0, 120)})`);
  return j;
}

async function mkClass2d(name, y) {
  return mkJob({
    type: "class2d", x: 700, y, name,
    params: { numClasses: 4, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
  });
}

function runOutOf(projectId, job) {
  return client(`cat '${remoteWorkdir(projectId, job)}/run.out' 2>/dev/null`).out;
}

async function jobRow(id) {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((x) => x.id === id) ?? null;
}

const MARKER = "# t343-legD-upload-witness marker";

// lane-surgery state (the finally restores the world even on abort)
let extId = null;
let twinStarPath = null;
let localStarPath = null;
let pristineStarText = null;
let origRemoteSnapshot = null;

try {
  // ---- the chain (same recipe as TEST 7) --------------------------------
  logSection("0 — 链路: import → ctffind → LoG autopick → extract (@slurm)");
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "star-lane e2e", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  const projectId = proj.body.project.id;
  await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "sl import",
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

  // the extract's record knows the star BOTH sides (the t343 lane inputs)
  const extRec = readEngineState()[ext.id] ?? {};
  const localStar = extRec?.outputs?.particles_star ?? null;
  const twinStar = extRec?.remote?.remoteOutputs?.particles_star ?? null;
  must(!!localStar && !!twinStar,
    "the extract's record knows its particles.star both sides (the local mirror copy AND the verified cluster twin)");
  const pristineLocal = localStar ? readFileSync(localStar, "utf8") : "";
  const origRemote = JSON.parse(JSON.stringify(extRec.remote ?? {}));
  // pristine twin backup ON the cluster (legs C/D restore from it)
  client(`cp '${twinStar}' /tmp/t343-twin.bak`);
  const poison = (text) => text.replace(/\d+@/g, "999999@");
  extId = ext.id;
  twinStarPath = twinStar;
  localStarPath = localStar;
  pristineStarText = pristineLocal;
  origRemoteSnapshot = origRemote;

  // ======================================================================
  logSection("A — twin 车道只判集群字节: 本地镜像投毒 → gate 仍 verified, 作业完成");
  writeFileSync(localStar, poison(pristineLocal));
  const a = await mkClass2d("sl class2d poisoned-mirror", 260);
  await mkEdge(ext.id, a.id, "particles", "particles");
  const ra = await runRemote(a.id, slurmTarget({ gpus: 1 }));
  must(ra.status === 200 && !ra.body?.error, `poisoned-mirror class2d dispatched (${ra.status}${ra.body?.error ? `: ${ra.body.error}` : ""})`);
  const wa = await waitTerminal(a.id, { timeoutMs: 240_000 });
  must(wa.job?.status === "completed",
    `poisoned-mirror class2d COMPLETED (${wa.job?.status}: ${String(wa.job?.result).slice(0, 120)}) — the poisoned LOCAL mirror was never the judge`);
  const runoutA = runOutOf(projectId, a);
  must(/particle ref\(s\) verified against their stacks' own MRC headers/.test(runoutA),
    "the receipt says verified — the gate judged the CLUSTER twin's healthy numbers");
  must(/read in place on the cluster at/.test(runoutA),
    "the receipt names the lane: the star was read in place on the cluster (the copy this job consumes)");
  must(!/the particles STAR references image/.test(runoutA),
    "no t338 refusal — the t342 local-first order would have refused on bytes the job never reads (the healthy receipt's own \"exceeds stack size\" door-name quote is not a refusal)");
  writeFileSync(localStar, pristineLocal); // hygiene

  // ======================================================================
  logSection("B — 上传车道只判本地字节: 记录摘除 twin + 本地投毒 → t338 拒绝, 行保持原状态");
  editEngineState((st) => { delete st[ext.id].remote.remoteOutputs.particles_star; });
  writeFileSync(localStar, poison(pristineLocal));
  const b = await mkClass2d("sl class2d upload-lane-poison", 380);
  await mkEdge(ext.id, b.id, "particles", "particles");
  const rb = await runRemote(b.id, slurmTarget({ gpus: 1 }));
  must(rb.status === 200 && typeof rb.body?.error === "string" && /the particles STAR references image 999999/.test(rb.body.error),
    `the upload lane REFUSED on the LOCAL poison (${String(rb.body?.error ?? rb.status).slice(0, 120)}) — these exact bytes would have shipped`);
  must(/exceeds stack size/.test(String(rb.body?.error)), "the refusal carries the readMRC numbers (the t338 wording)");
  const rowB = await jobRow(b.id);
  must(rowB?.status === "idle", `the row keeps its state — a request error never flips it (${rowB?.status})`);
  editEngineState((st) => { st[ext.id].remote.remoteOutputs.particles_star = twinStar; });
  writeFileSync(localStar, pristineLocal); // hygiene

  // ======================================================================
  logSection("C — twin 车道自身的门失败: twin 挪走 + 镜像删除 → 收据点名门, relion 自己的门上快速失败");
  client(`mv '${twinStar}' '${twinStar}.t343-aside'`);
  rmSync(localStar);
  const c = await mkClass2d("sl class2d twin-gone", 500);
  await mkEdge(ext.id, c.id, "particles", "particles");
  const rc = await runRemote(c.id, slurmTarget({ gpus: 1 }));
  must(rc.status === 200 && !rc.body?.error,
    `twin-gone class2d dispatched (${rc.status}) — the t313 rule: an unreadable check degrades to the note, never a block`);
  const wc = await waitTerminal(c.id, { timeoutMs: 180_000 });
  must(wc.job?.status === "failed", `the twin-gone run FAILED fast (${wc.job?.status}) — relion's own missing-input door, not an hour of silence`);
  const runoutC = runOutOf(projectId, c);
  must(/particles star unreadable on the cluster/.test(runoutC), "the note names the door: unreadable ON THE CLUSTER");
  must(/this job reads it in place at/.test(runoutC) && runoutC.includes(twinStar),
    `the note names the exact cluster address this job would have read (${twinStar})`);
  must(/No such file/.test(runoutC), "the note carries the cat's own failure word");
  must(/the stack-size consistency check did not run/.test(runoutC), "the note discloses the check did not run");
  must(/re-run the upstream job to regenerate it/.test(runoutC), "the note names the remedy");
  const exitC = client(`cat '${remoteWorkdir(projectId, c)}/.cf-exit' 2>/dev/null`).out.trim();
  must(exitC === "1", `relion's own refusal exit contract (.cf-exit=1, got '${exitC}')`);
  client(`mv '${twinStar}.t343-aside' '${twinStar}'`);
  writeFileSync(localStar, pristineLocal); // hygiene

  // ======================================================================
  logSection("D — 跨集群 pair 门: 记录声称上游在别的集群 → 本地镜像走上传车道, 字节过网, 作业完成");
  editEngineState((st) => {
    st[ext.id].remote.connectionId = "t343-foreign-conn";
    st[ext.id].remote.host = "foreign.example:22";
    st[ext.id].remote.remoteOutputs.particles_star = `/foreign/unreachable${twinStar}`;
  });
  writeFileSync(localStar, `${pristineLocal}\n${MARKER}\n`);
  const d = await mkClass2d("sl class2d foreign-upstream", 620);
  await mkEdge(ext.id, d.id, "particles", "particles");
  const rd = await runRemote(d.id, slurmTarget({ gpus: 1 }));
  must(rd.status === 200 && !rd.body?.error, `foreign-upstream class2d dispatched (${rd.status}${rd.body?.error ? `: ${rd.body.error}` : ""})`);
  const wd = await waitTerminal(d.id, { timeoutMs: 240_000 });
  must(wd.job?.status === "completed",
    `foreign-upstream class2d COMPLETED (${wd.job?.status}: ${String(wd.job?.result).slice(0, 120)}) — the LOCAL mirror uploaded to the target cluster (the t342 behavior pointed the argv at a foreign path)`);
  const clusterStar = client(`cat '${twinStar}'`).out;
  must(clusterStar.includes("t343-legD-upload-witness"),
    "the upload witness: the LOCAL bytes crossed the wire — the cluster file now carries the marker line");
  const runoutD = runOutOf(projectId, d);
  must(/particle ref\(s\) verified against their stacks' own MRC headers/.test(runoutD),
    "the refs were verified — the upload lane's star-dir anchor (clusterHome) can finally judge the star-relative dialect too");
  must(/read from the local copy this dispatch uploads/.test(runoutD),
    "the receipt names the lane: the local copy this dispatch uploads");
  // hygiene: the record + the cluster file + the local mirror all back to pristine
  editEngineState((st) => { st[ext.id].remote = origRemote; });
  client(`cp /tmp/t343-twin.bak '${twinStar}'`);
  client("rm -f /tmp/t343-twin.bak");
  writeFileSync(localStar, pristineLocal);
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
} finally {
  // last-resort world hygiene: the twin back home, the record honest, the
  // mirror pristine — later suites share this mock world
  try {
    if (twinStarPath) {
      client(`test -f '${twinStarPath}.t343-aside' && mv '${twinStarPath}.t343-aside' '${twinStarPath}' || true`);
      client(`test -f /tmp/t343-twin.bak && cp /tmp/t343-twin.bak '${twinStarPath}' || true`);
      client("rm -f /tmp/t343-twin.bak");
    }
    if (localStarPath && pristineStarText != null) {
      try { writeFileSync(localStarPath, pristineStarText); } catch { /* the mirror may be legitimately gone */ }
    }
    if (extId && origRemoteSnapshot) {
      editEngineState((st) => {
        if (st[extId]?.remote) st[extId].remote = origRemoteSnapshot;
      });
    }
  } catch { /* best effort — the legs' own hygiene normally already ran */ }
}

const s = summary("TEST 8 — t343 the consumption-lane star read (one map, one lane, one address)");
process.exit(s.fail > 0 ? 1 : 0);

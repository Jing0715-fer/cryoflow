#!/usr/bin/env node
/**
 * t332 diag — the usage list's rows became PICKS, verified live.
 *
 * The user's ticket:
 *   「增加支持从检测到的节点使用情况的列表中直接选择相应的节点」
 *   — click a node in the Live node usage list (t327's panel) and the
 *     submission pins to THAT node (--nodelist), the pick the partition
 *     dropdown could never express (one node inside a multi-host group).
 *
 * THE FEATURE, four layers:
 *   1. UI — the panel's rows are buttons (aria-pressed, keyboard native);
 *      the pinned row wears the pin (ring + MapPin), the ask line
 *      re-scopes to THAT node's free GPUs, unavailable rows refuse the
 *      click honestly, and a later partition change that would strand the
 *      pin releases it (never compose a --partition/--nodelist
 *      contradiction).
 *   2. DIALOG — pickedNode state; the stepper's ceiling becomes the
 *      node's own GPUs; the preview shows the real --nodelist; the
 *      submit body carries it.
 *   3. ROUTE/ENGINE — nodelist sanitized like partition; the explicit
 *      pick WINS over the t300 single-host derivation; an explicit pin
 *      with NO picked partition SUPPRESSES the connection's default
 *      partition (--partition=normal + --nodelist=brain3 is a real
 *      controller's submit-time refusal — the node's own partition is
 *      where it lands).
 *   4. MOCK — sbatch journals the pin (5th field of job-<id>.req) and
 *      scontrol accounts the job on THAT node, wherever its partition
 *      would have routed it.
 *
 * PHASES:
 *  A. CONTRACTS — source pins on all five files (the grammar the browser
 *     flows and the LIVE legs both ride).
 *  B. LIVE — the user's flow on the mock: a class2d dispatched with
 *     nodelist=node03 (multi-host gpu group, conn default partition
 *     "normal" WAITING to contradict it) → the script carries
 *     --nodelist=node03 and NO --partition; node03 shows 3/6 GPUs held
 *     while it runs (1 baseline + 2 live) and node01 — the partition
 *     default's own routing — holds NOTHING; then the precedence leg
 *     (partition=brain2 + nodelist=node03 → BOTH flags, the explicit pin
 *     wins over the derived brain2 host), and the degradation leg (a
 *     malformed hostname never reaches #SBATCH --nodelist=).
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t332";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3001",
};
const SHJ = { ...SH, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 800) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  }).stdout?.trim() ?? "";

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
let projectId = null;
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  if (b?.job?.projectId) projectId = b.job.projectId;
  return b?.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
  (
    await api("/api/edges", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    })
  ).status;

const dispatch = (id, body) =>
  api(`/api/jobs/${id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify(body) });

const awaitJobTerminal = async (id, deadlineMs) => {
  const done = await pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);
  return done;
};

const usage = (bypass) =>
  api(`/api/remote/connections/${CONN}/usage${bypass ? "?refresh=1" : ""}`, { headers: SH });

const scriptOf = (job) =>
  client(`cat /projects/cryoflow/${job.projectId}/${job.type}_${job.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);

const newestReq = () => client(`ls -t ~/.slurm/job-*.req 2>/dev/null | head -1`);

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  // the connection: slurmPartition deliberately "normal" — the default
  // that MUST be suppressed when an explicit node pin speaks (a
  // --partition=normal + --nodelist=node03 combo would be refused on a
  // real controller; node03 lives in gpu)
  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t332",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      slurmPartition: "normal",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);
  must(mk.body?.connection?.slurmPartition === "normal", "the connection's default partition is normal (the suppression witness)");

  const probeRes = await api(`/api/remote/connections/${CONN}/test`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({}),
  });
  must(probeRes.status >= 200 && probeRes.status < 300, `the probe answers (${probeRes.status})`);
  must(probeRes.body?.probe?.slurm === true, "the probe sees the Slurm client");

  // ======================================================================
  console.log("== PHASE A: CONTRACTS — the five layers' source pins ==");

  const typesSrc = readFileSync(`${ROOT}/src/lib/remote/types.ts`, "utf8");
  const routeSrc = readFileSync(`${ROOT}/src/app/api/jobs/[id]/run/route.ts`, "utf8");
  const engineSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const panelSrc = readFileSync(`${ROOT}/src/components/workflow/cluster-usage-panel.tsx`, "utf8");
  const uiSrc = readFileSync(`${ROOT}/src/components/workflow/remote-run-button.tsx`, "utf8");
  const mockSbatch = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/sbatch`, "utf8");
  const mockScontrol = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/scontrol`, "utf8");

  // --- the wire: the target carries the pick ---
  must(
    typesSrc.includes("nodelist?: string | null;") && /t332 — the exact NODE/.test(typesSrc),
    "RemoteRunTarget.nodelist exists with the t332 contract"
  );
  must(
    routeSrc.includes("body.remote.nodelist") &&
      routeSrc.includes("const nodelist = /^[A-Za-z0-9_.-]{1,64}$/.test(nodelistRaw) ? nodelistRaw : null;") &&
      routeSrc.includes("...(nodelist ? { nodelist } : {}),"),
    "the run route sanitizes nodelist with the SAME charset gate as partition (a malformed hostname never reaches #SBATCH --nodelist=)"
  );

  // --- the engine: precedence + suppression ---
  must(
    engineSrc.includes("const explicitNode =") &&
      engineSrc.includes("const nodelistPin = explicitNode ?? derivedNodePin;"),
    "the engine's explicit pick WINS over the t300 single-host derivation"
  );
  must(
    engineSrc.includes("isSlurm &&\n    typeof target.nodelist === \"string\"") ||
      /isSlurm &&\s*\n?\s*typeof target\.nodelist === "string"/.test(engineSrc),
    "the explicit pin is slurm-only (direct mode has no scheduler to pin)"
  );
  must(
    engineSrc.includes("const effectivePartition =\n    nodelist && partition == null ? null : (partition ?? conn.slurmPartition ?? null);") ||
      /const effectivePartition =\s*\n?\s*nodelist && partition == null \? null : \(partition \?\? conn\.slurmPartition \?\? null\);/.test(engineSrc),
    "the builder suppresses the connection's default partition under an explicit pin with no picked group"
  );

  // --- the panel: the rows are picks ---
  must(
    panelSrc.includes("pinnedNode?: string | null;") &&
      panelSrc.includes("onPickNode?: (node: SlurmNodeUsage | null) => void;"),
    "the panel takes pinnedNode + onPickNode (read-only callers keep the old shape)"
  );
  must(
    panelSrc.includes("onClick={pickable ? () => onPickNode?.(pinned ? null : n) : undefined}") &&
      panelSrc.includes("aria-pressed={pinned}") &&
      panelSrc.includes("disabled={!pickable}"),
    "each row is a real button: click toggles the pin, aria-pressed speaks it, unavailable rows refuse honestly"
  );
  must(
    panelSrc.includes("const pickable = !!onPickNode && !unavailable;") &&
      panelSrc.includes("const unavailable = nodeUnavailable({ state: n.state });"),
    "DRAIN/DOWN rows are never clickable (a doomed sbatch is not composed from this list)"
  );
  must(
    panelSrc.includes("data-usage-pick-hint=\"\"") &&
      /Click a node to pin this submission to it/.test(panelSrc),
    "the picking hint names the mechanism (--nodelist) and the release (click again)"
  );
  must(
    /if \(pinned && !pinned\.partitions\.includes\(partition\)\) onPickNode\(null\);/.test(panelSrc),
    "the mismatch guard releases a pin a later partition change would strand"
  );
  must(
    panelSrc.includes("<MapPin") && /pinned \? "text-primary" : "text-foreground\/90"/.test(panelSrc),
    "the pinned row wears the pin (MapPin + primary name)"
  );
  must(
    /Your ask: \$\{need\} pinned to \$\{pinnedRow\.node\}/.test(panelSrc) &&
      /that node reports NO GPUs/.test(panelSrc),
    "the ask line re-scopes to the pinned node (and names a 0-GPU contradiction honestly)"
  );

  // --- the dialog: the pick rides the whole submission shape ---
  must(
    uiSrc.includes("const [pickedNode, setPickedNode] = React.useState<SlurmNodeUsage | null>(null);") &&
      /setPickedNode\(null\);\s*\n\s*\}\), \[conn\?\.id\]\);/.test(uiSrc) ||
      (uiSrc.includes("setPickedNode(null);") && uiSrc.includes("[conn?.id]")),
    "the dialog holds the picked node and drops it when the connection changes (another cluster's nodes are another world)"
  );
  must(
    uiSrc.includes("pinnedNode={nodePin}") && uiSrc.includes("onPickNode={setPickedNode}"),
    "the panel is wired with the pick (the t327 connection/partition/ask wiring intact)"
  );
  must(
    uiSrc.includes("if (nodePin) sbatchDirectives.push(`--nodelist=${nodePin}`);") &&
      uiSrc.includes("...(nodePin ? { nodelist: nodePin } : {}),"),
    "the preview AND the submit body both carry the real --nodelist (the preview is a promise the sbatch keeps)"
  );
  must(
    /partition !== PARTITION_AUTO\s*\n?\s*\? partition\s*\n?\s*: nodePin\s*\n?\s*\? null\s*\n?\s*: \(conn\?\.slurmPartition \?\? null\)/.test(uiSrc),
    "the preview's partition mirrors the engine's suppression (pin speaks; connection default stands down)"
  );
  must(
    /pickedNode && pickedNode\.gpuTotal > 0\s*\n?\s*\? pickedNode\.gpuTotal/.test(uiSrc),
    "the stepper's ceiling becomes the pinned node's own GPUs (scontrol's word, not the group's widest)"
  );
  must(
    /Or click a node in the live usage list below to pin that exact node/.test(uiSrc),
    "the partition picker's note points at the usage list's own pick"
  );

  // --- the mock: the journal grew the pin ---
  must(
    /node_req="\$\(grep -m1 -oP '\(\?<=#SBATCH --nodelist=\)\.\*' "\$script" \|\| true\)"/.test(mockSbatch),
    "the mock sbatch parses #SBATCH --nodelist out of the script"
  );
  must(
    mockSbatch.includes("printf '%s|%s|%s|%s|%s\\n' \"${partition:-}\" \"${gres_req:-0}\" \"${ntasks_req:-1}\" \"$conc_eff\" \"${node_req:-}\" > \"$SLURM_DIR/job-$id.req\""),
    "the journal's 5th field carries the pin (t327's four fields ride unchanged ahead of it)"
  );
  must(
    mockScontrol.includes('rnode="$(echo "$req" | cut -d\'|\' -f5)"') &&
      mockScontrol.includes('if [ -n "$rnode" ]; then node="$rnode"; else node="$(part_node "$rpart")"; fi'),
    "scontrol accounts a pinned job on THAT node (the partition mapping stands only without a pin)"
  );

  // ======================================================================
  console.log("== PHASE B: LIVE — the user's flow: click a node, the sbatch follows ==");

  // the fixtures — the t327 recipe (particles star + stack on the mock)
  const mrcHdr = (() => {
    const b = Buffer.alloc(1024);
    b.writeInt32LE(1024, 0);
    b.writeInt32LE(1024, 4);
    b.writeInt32LE(4, 8); // NZ=4 — one section per referenced image (t338: the consumer gate refuses a star that outruns its stack)
    b.writeInt32LE(2, 12);
    b.writeInt32LE(1, 20);
    b.writeInt32LE(256, 44);
    b.writeInt32LE(1, 64);
    b.writeFloatLE(1.0, 68);
    b.writeInt32LE(1, 92);
    b.writeInt32LE(128, 96);
    return b.toString("base64");
  })();
  const fx = client(
    "mkdir -p /data2/t332-particles; " +
      `echo ${mrcHdr} | base64 -d > /data2/t332-particles/stack.mrcs; ` +
      "printf 'data_\\n\\nloop_\\n_rlnImageName #1\\n" +
      "0001@/data2/t332-particles/stack.mrcs\\n" +
      "0002@/data2/t332-particles/stack.mrcs\\n" +
      "0003@/data2/t332-particles/stack.mrcs\\n" +
      "0004@/data2/t332-particles/stack.mrcs\\n' > /data2/t332-particles/particles.star"
  );
  must(fx === "", `the particles fixture builds quietly (${fx.slice(0, 100)})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t332 node pick", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  const pImport = await mkJob({
    projectId,
    type: "import",
    name: "QA t332 particles import",
    params: {
      nodeType: "particles",
      micrographsPath: "/data2/t332-particles/particles.star",
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!pImport?.id, "the particles import creates");
  const runPImport = await api(`/api/jobs/${pImport.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runPImport.status >= 200 && runPImport.status < 300, `the import run accepts (${runPImport.status})`);
  const donePImport = await awaitJobTerminal(pImport.id, 90_000);
  must(donePImport?.status === "completed", `the particles import completes (${donePImport?.status})`);

  // --- B1: THE PICK — node03 out of gpu's eight, no partition picked ---
  // iterations: 15 — the mock's relion_refine sleeps 0.9s per iteration,
  // so the RUNNING window the live-accounting assertions must observe is
  // iterations × 0.9s. At 2 iterations the window is ~2s and a single
  // slow SSH exec can straddle it whole (two runs missed it — the job
  // ran, the journal spoke node03, but no sample landed inside). 15
  // iterations gives ~14s — the observation is of the SAME live truth,
  // held open long enough to see.
  const c1 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 1",
    params: { numClasses: 4, iterations: 15 },
  });
  must(!!c1?.id, "the class2d job creates");
  const e1 = await mkEdge(pImport.id, c1.id, "particles", "particles");
  must(e1 === 200 || e1 === 201, `the edge wires import → class2d (${e1})`);

  const d1 = await dispatch(c1.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2, nodelist: "node03" },
  });
  must(d1.status >= 200 && d1.status < 300, `the pinned dispatch answers (${d1.status})`);
  must(!d1.body?.error, `the pinned dispatch is ACCEPTED (${String(d1.body?.error ?? "").slice(0, 120)})`);

  // the script's own words: the pin rides, the connection's default
  // partition (normal) does NOT — the suppression the engine promises
  const script1 = await pollUntil(async () => {
    const s = scriptOf(c1);
    return s.includes("#SBATCH --nodelist=node03") ? s : null;
  }, 60_000, 1500);
  must(
    script1?.includes("#SBATCH --nodelist=node03"),
    "the submitted script pins --nodelist=node03 (the usage-list pick, byte-shaped)"
  );
  must(
    !/#SBATCH --partition=/.test(script1 ?? ""),
    "NO --partition rides (the connection's default 'normal' is suppressed under the explicit pin)"
  );
  must(
    /# connection: .* · node node03/.test(script1 ?? ""),
    "the script's header comment witnesses the node (the log dialect)"
  );

  // the LIVE window FIRST (the run is short — the script and journal
  // polls must not eat it): the moment the script is on disk the job is
  // seconds from RUNNING, so the usage poll starts immediately after and
  // watches node03 climb to 3/6. The journal assert moves AFTER
  // completion — the .req file persists (only the .state goes silent),
  // so its byte-shape is just as provable then.
  const sawLive = await pollUntil(async () => {
    const r = await usage(true);
    const n3 = (r.body?.nodes ?? []).find((n) => n.node === "node03");
    return n3 && n3.gpuAlloc === 3 ? n3 : null;
  }, 120_000, 1000);
  must(
    sawLive && sawLive.gpuAlloc === 3,
    `while the pinned class2d RUNS, node03 shows 3/6 GPUs held (1 baseline + 2 live) (got ${JSON.stringify(sawLive?.gpuAlloc)})`
  );
  must(
    sawLive && sawLive.cpuAlloc === 6,
    `and 6/64 CPUs (4 baseline + 2 MPI ranks) (got ${JSON.stringify(sawLive?.cpuAlloc)})`
  );
  const during1 = await usage(true);
  const n01 = (during1.body?.nodes ?? []).find((n) => n.node === "node01");
  must(
    n01 && n01.gpuAlloc === 0 && n01.cpuAlloc === 0,
    `node01 (the partition-less fallback's route) holds NOTHING — the accounting followed the PIN (got ${n01?.gpuAlloc}/${n01?.cpuAlloc})`
  );

  const doneC1 = await awaitJobTerminal(c1.id, 180_000);
  must(doneC1?.status === "completed", `the pinned class2d COMPLETES (${doneC1?.status}: ${String(doneC1?.result ?? "").slice(0, 90)})`);
  const after1 = await usage(true);
  const n3After = (after1.body?.nodes ?? []).find((n) => n.node === "node03");
  must(
    n3After && n3After.gpuAlloc === 1 && n3After.cpuAlloc === 4,
    `when it lands, node03 releases everything (back to 1/6 GPU · 4/64 CPU) (got ${n3After?.gpuAlloc}/${n3After?.cpuAlloc})`
  );
  // the journal (post-completion — the file persists): partition empty,
  // node node03 — the accounting's own source
  const req1 = await pollUntil(async () => {
    const newest = newestReq();
    return newest && client(`cut -d'|' -f1,5 ${newest}`) === "|node03" ? newest : null;
  }, 30_000, 1500);
  must(!!req1, `the journal's own row: partition empty · node node03 (${req1 ?? "not seen"})`);

  // --- B2: PRECEDENCE — an explicit pick beats the single-host derivation ---
  // partition=brain2 (a single-host group: pre-t332 code derived
  // --nodelist=brain2 from it); with an explicit node03 BOTH flags ride
  // and the PIN is node03 — the user's later, more specific choice speaks
  const c2 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 2",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c2?.id, "the second class2d creates");
  const e2 = await mkEdge(pImport.id, c2.id, "particles", "particles");
  must(e2 === 200 || e2 === 201, `the edge wires import → class2d 2 (${e2})`);

  const d2 = await dispatch(c2.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2, partition: "brain2", nodelist: "node03" },
  });
  must(d2.status >= 200 && d2.status < 300, `the partition+pin dispatch answers (${d2.status})`);
  const script2 = await pollUntil(async () => {
    const s = scriptOf(c2);
    return s.includes("#SBATCH --partition=brain2") ? s : null;
  }, 60_000, 1500);
  must(
    script2?.includes("#SBATCH --partition=brain2") && script2?.includes("#SBATCH --nodelist=node03"),
    "precedence: partition=brain2 + explicit node03 → BOTH flags, and the pin is node03 (the derivation's brain2 loses)"
  );
  const doneC2 = await awaitJobTerminal(c2.id, 180_000);
  must(doneC2?.status === "completed", `the second class2d COMPLETES (${doneC2?.status})`);

  // --- B3: DEGRADATION — a malformed hostname never reaches the script ---
  // the charset gate drops it at the route; with no partition the
  // connection default (normal) rides again — the t300 behavior, intact
  const c3 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 3",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c3?.id, "the third class2d creates");
  const e3 = await mkEdge(pImport.id, c3.id, "particles", "particles");
  must(e3 === 200 || e3 === 201, `the edge wires import → class2d 3 (${e3})`);

  const d3 = await dispatch(c3.id, {
    remote: {
      connectionId: CONN,
      module: "relion/5.0.1",
      mode: "slurm",
      gpus: 2,
      nodelist: "node03; touch /tmp/cf-pwn",
    },
  });
  must(d3.status >= 200 && d3.status < 300, `the malformed-pin dispatch answers (${d3.status})`);
  const script3 = await pollUntil(async () => {
    const s = scriptOf(c3);
    return s.includes("#SBATCH") ? s : null;
  }, 60_000, 1500);
  must(
    !/#SBATCH --nodelist=/.test(script3 ?? ""),
    "a malformed hostname is dropped BEFORE the script (no --nodelist line — the charset gate held)"
  );
  must(
    /#SBATCH --partition=normal/.test(script3 ?? ""),
    "with the pick gone, the connection's default partition rides again (the t300 lane, intact)"
  );
  const pwn = client("test -f /tmp/cf-pwn && echo PWNED || echo clean");
  must(pwn === "clean", `the malicious suffix never executed (${pwn})`);
  const doneC3 = await awaitJobTerminal(c3.id, 180_000);
  must(doneC3?.status === "completed", `the third class2d COMPLETES (${doneC3?.status})`);

  console.log(fail === 0 ? "\n== t332 diag: ALL GREEN ==" : `\n== t332 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side fixtures ----
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  if (projectId) {
    try {
      client(`rm -rf /projects/cryoflow/${projectId}`);
    } catch { /* the jobs DELETE already dropped the local twin */ }
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  try {
    client("rm -rf /data2/t332-particles /tmp/cf-pwn");
  } catch { /* best effort */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

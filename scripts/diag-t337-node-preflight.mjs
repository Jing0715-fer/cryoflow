#!/usr/bin/env node
/**
 * t337 diag — the node-pin pre-flight, verified live.
 *
 * The user's receipt:
 *   Job failed
 *   sbatch refused the submission: sbatch: error: Batch job submission
 *   failed: Requested node configuration is not available · login-shell
 *   noise from the cluster (your ~/.bashrc, not the submission):
 *   /data2/home/lijing/.bashrc: line 35: /home/guozhenqian/app/relion/
 *   relion.sh: No such file or directory
 *
 * …a pinned submission the controller refused AT SUBMIT TIME, with no word
 * about WHY. The engine could compose exactly that verdict three ways
 * before t337 (the t311 width clamp only spoke for the PICKED partition):
 *   (a) --gres=gpu:W beyond the PINNED node's own GPUs — the t332 explicit
 *       pin suppresses the partition, so NOTHING clamped against the node
 *       (their cluster: normal carries 5 GPUs; the dialog's default width
 *       is 6, the sbatch6gpu.sh idiom);
 *   (b) a node that went DOWN/DRAIN between the usage list's pick and the
 *       submit (the panel polls every 30s — the rows refuse the click, but
 *       the state can age);
 *   (c) a node scontrol does not know (stale list, renamed host).
 *
 * THE FIX (four blades, all verified here):
 *   1. ENGINE PRE-FLIGHT — one SSH round (`scontrol show node <pin> -o`,
 *      the SAME pure parser the usage route rides) before a byte stages:
 *      unknown node → teaching refusal; DOWN/DRAIN → teaching refusal;
 *      a 0-GPU node under a GPU job → teaching refusal; a narrower node →
 *      the width CLAMPS to the node's own GPUs (the t311 dialect, node
 *      word instead of partition word). A probe that cannot RUN degrades
 *      to the old behavior — monitoring never blocks a dispatch.
 *   2. THE DEFAULT-PARTITION CLAMP — the width gate now consults the
 *      partition the script will ACTUALLY carry (picked OR the
 *      connection's default — "auto" + 6 on a 5-GPU default group used
 *      to ride straight into the refusal).
 *   3. THE TRANSLATION — when sbatch STILL refuses (the drift window), the
 *      error names what was requested (pin · partition · GPU width) and
 *      the three moves that fix it, instead of quoting Slurm's one-liner.
 *   4. THE DIALOG — AUTO's stepper ceiling is the connection-default
 *      group's own GPUs (not the inventory's first group).
 *
 * PHASES:
 *  A. CONTRACTS — source pins on the engine, the dialog, and both mock
 *     binaries (the grammar every live leg rides).
 *  B. LIVE — seven legs on the mock:
 *     B1  THE USER'S RECEIPT, healed at the source: class2d pinned to
 *         "normal" (5 GPUs) at width 6 → the pre-flight clamps 6→5, the
 *         script carries --nodelist=normal --gres=gpu:5 --ntasks=5 and NO
 *         --partition, and the job COMPLETES (the old engine composed the
 *         refusal the user pasted);
 *     B2  THE AUTO HOLE: no pin, no picked partition, width 6 → the
 *         connection's default (normal, 5 GPUs) clamps the width; the
 *         script carries --partition=normal --gres=gpu:5 and COMPLETES;
 *     B3  THE DRAINED NODE: the node-override lever flips brain3 DOWN →
 *         the dispatch is REFUSED with the state named (the row stays
 *         queued, nothing stages); the lever releases → the SAME dispatch
 *         completes (the refusal was the state, not the pin);
 *     B4  THE UNKNOWN NODE: "ghost-node" → refused with "not known to
 *         Slurm";
 *     B5  THE 0-GPU NODE: node05 (long group, Gres=(null)) under a GPU
 *         job → refused with the contradiction named;
 *     B6  THE RESIDUAL TRANSLATION: a probe-blind 4-GPU partition
 *         (debugx) at width 6 rides into the mock controller's own
 *         refusal → the job row's failure names what was requested and
 *         the bashrc noise stays labeled as noise;
 *     B7  THE HEALTHY PIN (t332 regression): node03 out of gpu's eight at
 *         width 2 → the pre-flight does NOT over-refuse; the script pins
 *         --nodelist=node03 with NO --partition and completes.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import net from "node:net";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t337";
const PROD_LOG = `${ROOT}/prod-3001.log`;
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

/** the prod log grown since `from` (byte offset) — the clamp witnesses. */
const logSince = (from) => {
  try {
    const st = statSync(PROD_LOG);
    if (st.size <= from) return "";
    return readFileSync(PROD_LOG).toString("utf8", from, st.size);
  } catch {
    return "";
  }
};
const logSize = () => {
  try {
    return statSync(PROD_LOG).size;
  } catch {
    return 0;
  }
};

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  // the connection: slurmPartition deliberately "normal" (5 GPUs/node) —
  // the 6-wide default's narrowest possible host, both for the pin leg
  // (B1) and the auto leg (B2)
  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t337",
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
  must(mk.body?.connection?.slurmPartition === "normal", "the connection's default partition is normal (the 5-GPU witness)");

  const probeRes = await api(`/api/remote/connections/${CONN}/test`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({}),
  });
  must(probeRes.status >= 200 && probeRes.status < 300, `the probe answers (${probeRes.status})`);
  must(probeRes.body?.probe?.slurm === true, "the probe sees the Slurm client");

  // no stale override from an earlier run — the lever starts clean
  client("rm -f ~/.slurm/node-override");

  // ======================================================================
  console.log("== PHASE A: CONTRACTS — the four blades' source pins ==");

  const engineSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const uiSrc = readFileSync(`${ROOT}/src/components/workflow/remote-run-button.tsx`, "utf8");
  const mockSbatch = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/sbatch`, "utf8");
  const mockScontrol = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/scontrol`, "utf8");

  // --- blade 1: the pre-flight ---
  must(
    engineSrc.includes("loginShellScript(`scontrol show node ${shQuote(nodelistPin)} -o`)") &&
      engineSrc.includes("parseScontrolNodes(r.stdout).find((n) => n.node === nodelistPin) ?? null"),
    "the pre-flight reads the pinned node's OWN scontrol row (the usage route's parser, reused)"
  );
  must(
    engineSrc.includes("nodeProbeRan = !r.error && r.code !== 127") &&
      engineSrc.includes("/* SSH blip — the old behavior stands */"),
    "a probe that cannot run degrades to the old behavior (monitoring never blocks a dispatch)"
  );
  must(
    engineSrc.includes("is not known to Slurm on ${conn.host}") &&
      engineSrc.includes("nodeUnavailable(nodeLive)") &&
      engineSrc.includes("${nodelistPin} is ${nodeLive.state} on ${conn.host} right now"),
    "unknown nodes and DOWN/DRAIN nodes refuse with the cause named, before a byte stages"
  );
  must(
    engineSrc.includes("has no GPUs (scontrol says Gres=(null))"),
    "a 0-GPU pinned node under a GPU job refuses with the contradiction named"
  );
  must(
    engineSrc.includes("node ${nodelistPin} offers ${nodeLive.gpuTotal} GPU(s) per its live scontrol row"),
    "the width clamps to the pinned node's own GPUs (the t311 dialect, the node's word)"
  );

  // --- blade 2: the default-partition clamp ---
  must(
    engineSrc.includes(
      "const clampPartition =\n        nodelistPin && partitionOverride == null\n          ? null // the pin suppresses the partition — nothing else to consult\n          : (partitionOverride ?? conn.slurmPartition ?? null);"
    ),
    "the width gate consults the partition the script will ACTUALLY carry (picked OR the connection's default)"
  );

  // --- blade 3: the translation ---
  must(
    engineSrc.includes("const cfgHelp = /node configuration is not available/i.test(why)") &&
      engineSrc.includes("what was requested: ${composition}") &&
      engineSrc.includes("Pick a different node in the live usage list, click the pinned row again to release the pin, or lower the GPU width."),
    "the sbatch refusal is TRANSLATED: what was requested + the three moves that fix it"
  );

  // --- blade 4: the dialog's AUTO ceiling ---
  must(
    uiSrc.includes("const autoGroup = conn?.slurmPartition") &&
      uiSrc.includes("selectedGroup?.gpusPerNode ?? autoGroup?.gpusPerNode ?? partitionInventory[0]?.gpusPerNode ?? 8"),
    "AUTO's stepper ceiling is the connection-default group's own GPUs (not the inventory's first group)"
  );

  // --- the mock: the node-keyed gate + the drained-node lever ---
  must(
    mockSbatch.includes('echo "sbatch: error: Invalid node name $node_req" >&2'),
    "the mock sbatch refuses an unknown --nodelist with real Slurm's own dialect"
  );
  must(
    mockSbatch.includes('awk -v n="$node_req" \'$1==n{print $2; exit}\' "$HOME/.slurm/node-override"') &&
      mockSbatch.includes("DOWN|DRAIN|DRAINING|FAIL)"),
    "the mock sbatch keys its refusal on the node-override lever (the drained-node world)"
  );
  must(
    /node01\|node02\|node03\|node04\) node_gpus=6 ;;/.test(mockSbatch) &&
      /normal\)   node_gpus=5 ;;/.test(mockSbatch),
    "the mock sbatch's node table mirrors scontrol's own (normal 5 · brain 6 · node01-04 6 · node05-08 0)"
  );
  must(
    mockSbatch.includes("debugx)   node_mem=64; node_gpus=4 ;;"),
    "the residual-path lever exists (a probe-blind 4-GPU partition for the translation leg)"
  );
  must(
    mockScontrol.includes('ov="$(awk -v n="$name" \'$1==n{print $2; exit}\' "$SLURM_DIR/node-override" 2>/dev/null)"') &&
      mockScontrol.includes('[ -n "$ov" ] && state="$ov"'),
    "the mock scontrol honors the same override (pre-flight, panel and gate read ONE world)"
  );

  // ======================================================================
  console.log("== PHASE B: LIVE — the receipt, healed at the source ==");

  // the fixtures — the t327/t332 recipe (particles star + stack on the mock)
  const mrcHdr = (() => {
    const b = Buffer.alloc(1024);
    b.writeInt32LE(1024, 0);
    b.writeInt32LE(1024, 4);
    b.writeInt32LE(1, 8);
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
    "mkdir -p /data2/t337-particles; " +
      `echo ${mrcHdr} | base64 -d > /data2/t337-particles/stack.mrcs; ` +
      "printf 'data_\\n\\nloop_\\n_rlnImageName #1\\n" +
      "0001@/data2/t337-particles/stack.mrcs\\n" +
      "0002@/data2/t337-particles/stack.mrcs\\n" +
      "0003@/data2/t337-particles/stack.mrcs\\n" +
      "0004@/data2/t337-particles/stack.mrcs\\n' > /data2/t337-particles/particles.star"
  );
  must(fx === "", `the particles fixture builds quietly (${fx.slice(0, 100)})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t337 node pre-flight", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  const pImport = await mkJob({
    projectId,
    type: "import",
    name: "QA t337 particles import",
    params: {
      nodeType: "particles",
      micrographsPath: "/data2/t337-particles/particles.star",
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!pImport?.id, "the particles import creates");
  const runPImport = await api(`/api/jobs/${pImport.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runPImport.status >= 200 && runPImport.status < 300, `the import run accepts (${runPImport.status})`);
  const donePImport = await awaitJobTerminal(pImport.id, 90_000);
  must(donePImport?.status === "completed", `the particles import completes (${donePImport?.status})`);

  // ---------------------------------------------------------------- B1 --
  console.log("== B1: the user's receipt — a 5-GPU node pinned at width 6 ==");
  const log0 = logSize();
  const c1 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 1",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c1?.id, "the pinned class2d creates");
  const e1 = await mkEdge(pImport.id, c1.id, "particles", "particles");
  must(e1 === 200 || e1 === 201, `the edge wires import → class2d (${e1})`);

  const d1 = await dispatch(c1.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 6, nodelist: "normal" },
  });
  must(d1.status >= 200 && d1.status < 300, `the pinned dispatch answers (${d1.status})`);
  must(!d1.body?.error, `the pinned dispatch is ACCEPTED — the width clamps, no refusal (${String(d1.body?.error ?? "").slice(0, 120)})`);

  const script1 = await pollUntil(async () => {
    const s = scriptOf(c1);
    return s.includes("#SBATCH") ? s : null;
  }, 60_000, 1500);
  must(
    script1?.includes("#SBATCH --nodelist=normal"),
    "the submitted script pins --nodelist=normal (the usage-list pick, byte-shaped)"
  );
  must(
    !/#SBATCH --partition=/.test(script1 ?? ""),
    "NO --partition rides (the t332 suppression holds under the pre-flight)"
  );
  must(
    script1?.includes("#SBATCH --gres=gpu:5") && script1?.includes("#SBATCH --ntasks=5"),
    "the width CLAMPED 6 → 5 (the node's own scontrol word — the script requests 5, not the refused 6)"
  );
  must(
    script1?.includes("mpirun -n 5") && script1?.includes("--gpu 0:1:2:3:4"),
    "the MPI shape follows the clamped width (5 ranks, GPUs 0-4)"
  );
  const reqRow1 = await pollUntil(async () => {
    const f = newestReq();
    if (!f) return null;
    const row = client(`cat ${f}`);
    return /^\|5\|5\|1\|normal$/.test(row.trim()) ? row : null;
  }, 30_000, 1000);
  must(
    /^\|5\|5\|1\|normal$/.test(String(reqRow1 ?? "").trim()),
    `the journal row speaks the clamped width on the pinned node — partition EMPTY (suppressed), gres 5, node normal (got: ${String(reqRow1 ?? "").trim()})`
  );
  const clampLog1 = await pollUntil(
    () => (logSince(log0).includes("clamping GPU width 6 → 5 (node normal offers 5 GPU(s)") ? true : null),
    30_000, 1000
  );
  must(clampLog1, "the server log witnesses the node-keyed clamp (the t311 dialect, the node's word)");
  const doneC1 = await awaitJobTerminal(c1.id, 180_000);
  must(doneC1?.status === "completed", `the pinned class2d COMPLETES at width 5 (${doneC1?.status})`);

  // ---------------------------------------------------------------- B2 --
  console.log("== B2: the AUTO hole — no pin, no picked partition, width 6 ==");
  const log1 = logSize();
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
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 6 },
  });
  must(d2.status >= 200 && d2.status < 300, `the auto dispatch answers (${d2.status})`);
  must(!d2.body?.error, `the auto dispatch is ACCEPTED (${String(d2.body?.error ?? "").slice(0, 120)})`);

  const script2 = await pollUntil(async () => {
    const s = scriptOf(c2);
    return s.includes("#SBATCH") ? s : null;
  }, 60_000, 1500);
  must(
    script2?.includes("#SBATCH --partition=normal"),
    "the connection's default partition rides (auto = the connection's own group)"
  );
  must(
    script2?.includes("#SBATCH --gres=gpu:5") && script2?.includes("#SBATCH --ntasks=5"),
    "the width clamped 6 → 5 by the DEFAULT partition's inventory (the t337 hole closed)"
  );
  const clampLog2 = await pollUntil(
    () => (logSince(log1).includes("clamping GPU width 6 → 5 (partition normal offers 5/node") ? true : null),
    30_000, 1000
  );
  must(clampLog2, "the server log witnesses the default-partition clamp");
  const doneC2 = await awaitJobTerminal(c2.id, 180_000);
  must(doneC2?.status === "completed", `the auto class2d COMPLETES at width 5 (${doneC2?.status})`);

  // ---------------------------------------------------------------- B3 --
  console.log("== B3: the drained node — DOWN at submit, named honestly ==");
  client("mkdir -p ~/.slurm && printf 'brain3 DOWN\\n' > ~/.slurm/node-override");
  const uDown = await usage(true);
  const b3row = (uDown.body?.nodes ?? []).find((n) => n.node === "brain3");
  must(b3row?.state === "DOWN", `the usage route SEES the override (brain3 DOWN, got ${JSON.stringify(b3row?.state)})`);

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
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 4, nodelist: "brain3" },
  });
  must(d3.status >= 200 && d3.status < 300, `the drained-node dispatch answers (${d3.status})`);
  must(
    (d3.body?.error ?? "").includes("node brain3 is DOWN"),
    `the refusal NAMES the node and its state (${String(d3.body?.error ?? "").slice(0, 140)})`
  );
  must(
    (d3.body?.error ?? "").includes("Pick another node in the live usage list"),
    "the refusal teaches the fix (pick another node / release the pin)"
  );
  const row3 = d3.body?.job ?? null;
  must(
    row3?.status === "idle" || row3?.status === "queued",
    `a request-error refusal leaves the row untouched (idle), not failed (got ${row3?.status})`
  );
  await sleep(1500);
  must(
    scriptOf(c3) === "",
    "NOTHING staged to the cluster for the refused dispatch (no workdir, no script)"
  );

  // the lever releases → the SAME dispatch completes (the refusal was the
  // node's state, not the pin itself)
  client("rm -f ~/.slurm/node-override");
  const d3b = await dispatch(c3.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 4, nodelist: "brain3" },
  });
  must(d3b.status >= 200 && d3b.status < 300 && !d3b.body?.error, `the same dispatch re-submits once the node heals (${String(d3b.body?.error ?? "").slice(0, 120)})`);
  const script3 = await pollUntil(async () => {
    const s = scriptOf(c3);
    return s.includes("#SBATCH") ? s : null;
  }, 60_000, 1500);
  must(
    script3?.includes("#SBATCH --nodelist=brain3") && script3?.includes("#SBATCH --gres=gpu:4"),
    "the healed dispatch pins brain3 at its full requested width (6-GPU node, 4 requested)"
  );
  const doneC3 = await awaitJobTerminal(c3.id, 180_000);
  must(doneC3?.status === "completed", `the re-submitted class2d COMPLETES (${doneC3?.status})`);

  // ---------------------------------------------------------------- B4 --
  console.log("== B4: the unknown node — scontrol lists no such host ==");
  const c4 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 4",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c4?.id, "the fourth class2d creates");
  const e4 = await mkEdge(pImport.id, c4.id, "particles", "particles");
  must(e4 === 200 || e4 === 201, `the edge wires import → class2d 4 (${e4})`);

  const d4 = await dispatch(c4.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2, nodelist: "ghost-node" },
  });
  must(
    (d4.body?.error ?? "").includes("node ghost-node is not known to Slurm"),
    `the unknown-node refusal names the host (${String(d4.body?.error ?? "").slice(0, 140)})`
  );
  must(
    (d4.body?.error ?? "").includes("the usage list may be stale"),
    "the refusal points at the stale-list cause"
  );
  must((d4.body?.job ?? null)?.status !== "failed", "the row stays untouched (request error, not a failure)");

  // ---------------------------------------------------------------- B5 --
  console.log("== B5: the 0-GPU node — a GPU job cannot land there ==");
  const c5 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 5",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c5?.id, "the fifth class2d creates");
  const e5 = await mkEdge(pImport.id, c5.id, "particles", "particles");
  must(e5 === 200 || e5 === 201, `the edge wires import → class2d 5 (${e5})`);

  const d5 = await dispatch(c5.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2, nodelist: "node05" },
  });
  must(
    (d5.body?.error ?? "").includes("node node05 has no GPUs"),
    `the 0-GPU refusal names the contradiction (${String(d5.body?.error ?? "").slice(0, 140)})`
  );
  must(
    (d5.body?.error ?? "").includes("would request 2 GPU"),
    "the refusal states the width the job would have requested there"
  );
  must((d5.body?.job ?? null)?.status !== "failed", "the row stays untouched (request error, not a failure)");

  // ---------------------------------------------------------------- B6 --
  console.log("== B6: the residual path — sbatch's own refusal, translated ==");
  const c6 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 6",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c6?.id, "the sixth class2d creates");
  const e6 = await mkEdge(pImport.id, c6.id, "particles", "particles");
  must(e6 === 200 || e6 === 201, `the edge wires import → class2d 6 (${e6})`);

  // debugx: 4 GPUs on the controller, invisible to the probe's inventory —
  // the width gate has no word for it, the script rides --gres=gpu:6 into
  // the controller's own refusal, and the TRANSLATION must speak
  const d6 = await dispatch(c6.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 6, partition: "debugx" },
  });
  must(d6.status >= 200 && d6.status < 300, `the residual dispatch answers (${d6.status})`);
  const doneC6 = await awaitJobTerminal(c6.id, 180_000);
  must(doneC6?.status === "failed", `the controller's refusal fails the job honestly (${doneC6?.status})`);
  const res6 = String(doneC6?.result ?? "");
  must(
    res6.includes("sbatch refused the submission") &&
      res6.includes("Requested node configuration is not available"),
    `the failure carries Slurm's own verdict (${res6.slice(0, 100)})`
  );
  must(
    res6.includes("what was requested: partition debugx · 6 GPU(s)"),
    "the TRANSLATION names what was requested (the composition the script actually carried)"
  );
  must(
    res6.includes("Pick a different node in the live usage list"),
    "the translation teaches the three moves"
  );
  must(
    res6.includes("login-shell noise from the cluster (your ~/.bashrc, not the submission)"),
    "the bashrc noise stays labeled as noise (the t311 split survives the translation)"
  );

  // ---------------------------------------------------------------- B7 --
  console.log("== B7: the healthy pin — the pre-flight does not over-refuse ==");
  const c7 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 7",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c7?.id, "the seventh class2d creates");
  const e7 = await mkEdge(pImport.id, c7.id, "particles", "particles");
  must(e7 === 200 || e7 === 201, `the edge wires import → class2d 7 (${e7})`);

  const d7 = await dispatch(c7.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2, nodelist: "node03" },
  });
  must(d7.status >= 200 && d7.status < 300 && !d7.body?.error, `the healthy pinned dispatch is ACCEPTED (${String(d7.body?.error ?? "").slice(0, 120)})`);
  const script7 = await pollUntil(async () => {
    const s = scriptOf(c7);
    return s.includes("#SBATCH") ? s : null;
  }, 60_000, 1500);
  must(
    script7?.includes("#SBATCH --nodelist=node03") && !/#SBATCH --partition=/.test(script7 ?? ""),
    "node03 out of gpu's eight pins with NO partition (the t332 lane rides the pre-flight untouched)"
  );
  must(
    script7?.includes("#SBATCH --gres=gpu:2"),
    "the healthy 6-GPU node keeps the full requested width (no over-clamp)"
  );
  const doneC7 = await awaitJobTerminal(c7.id, 180_000);
  must(doneC7?.status === "completed", `the healthy pinned class2d COMPLETES (${doneC7?.status})`);

  console.log(fail === 0 ? "\n== t337 diag: ALL GREEN ==" : `\n== t337 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side fixtures + the lever ----
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
    client("rm -rf /data2/t337-particles; rm -f ~/.slurm/node-override");
  } catch { /* best effort */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

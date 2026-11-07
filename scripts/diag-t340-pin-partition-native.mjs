#!/usr/bin/env bun
/**
 * t340 diag — TWO field reports, one root each:
 *
 * 1. THE PIN'S PARTITION — 「从node使用情况列表选择node时报错，但是
 *    从node的下拉菜单选择node时可以正常运行（两种选择方式即使选同一
 *    个node，但是node框中显示也不一样）」. The usage-list pin suppressed
 *    --partition entirely (t332's "the node's own partition is where it
 *    lands"), so the job fell to the cluster's DEFAULT partition — and a
 *    GPU node that does not live there is refused at submit time with
 *    "Requested node configuration is not available". The dropdown channel
 *    carried --partition=<group> and worked. THE FIX: the pin now resolves
 *    the node's OWN partition (scontrol's Partitions=, the probe's hostlist
 *    second) and writes --partition + --nodelist — the same composition a
 *    group pick writes. The mock controller grew the membership verdict so
 *    this world is rehearsed, not assumed.
 *
 * 2. THE NATIVE MARATHON'S FALSE FAILED — 「运行时先出现了失败（超时了
 *    没有返回log？），之后又成功了？」. A 325k-particle cs → star
 *    conversion runs IN-PROCESS for minutes; the run record only existed
 *    at the very END, so the reconcile sweep's 120 s no-record flip marked
 *    the row FAILED mid-run (no log existed yet), then COMPLETED when the
 *    promise landed. THE FIX: beginNativeRun writes an IN-FLIGHT record
 *    (pid = the server, alive by construction) + live phase lines into
 *    run.out from second zero.
 *
 * PHASES:
 *  A. CONTRACTS — source pins on the engine, the dialog, the css, and the
 *     mock controller (the grammar every live leg rides).
 *  B. LIVE — on the mock:
 *     B1  the user's receipt REPRODUCED: a hand-crafted bare pin
 *         (--nodelist, no --partition) is refused by the controller;
 *     B2  the same node + its own partition submits fine (the dropdown's
 *         shape — the shape the app must now write);
 *     B3  THE APP's usage-list pin writes BOTH lines and completes;
 *     B4  the dropdown channel writes the SAME two lines (equivalence);
 *     B5  the cs → star native leaves phase lines in run.out and the log
 *         route answers while it runs;
 *     B6  THE SWEEP WINDOW: a stale no-record row still flips (control),
 *         an in-flight record survives the same age (the fix).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";

process.env.DATABASE_URL = "file:/home/z/cryoflow/db/cryoflow.db";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t340";
const MODULE = "relion/5.0.1";
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

const awaitJobTerminal = async (id, deadlineMs) => {
  const done = await pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);
  return done;
};

const dispatch = (id, remote) =>
  api(`/api/jobs/${id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ remote }),
  });

/* ================================================================== */
/* The cs2star fixture — t336's minimal CS project (3 particles,      */
/* foo/bar referenced, baz the unreferenced witness)                   */
/* ================================================================== */

const F = (name, dtype, shape) => ({ name, dtype, shape: shape ?? null });
function npyBuffer(fields, rows) {
  const descr = fields.map((f) =>
    f.shape ? `('${f.name}', '${f.dtype}', (${f.shape.join(",")},))` : `('${f.name}', '${f.dtype}')`
  );
  let header = `{'descr': [${descr.join(", ")}], 'fortran_order': False, 'shape': (${rows.length},), }`;
  let pad = 64 - ((10 + header.length + 1) % 64);
  if (pad < 0) pad += 64;
  header += " ".repeat(pad) + "\n";
  const headLen = Buffer.alloc(2);
  headLen.writeUInt16LE(header.length);
  const out = [Buffer.from([0x93]), Buffer.from("NUMPY"), Buffer.from([1, 0]), headLen, Buffer.from(header, "latin1")];
  for (const row of rows) {
    for (const f of fields) {
      const v = row[f.name];
      const m = /^([<>|])?([biufSUV])(\d+)$/.exec(f.dtype);
      const kind = m[2];
      const n = Number(m[3]);
      if (kind === "U") {
        const b = Buffer.alloc(4 * n);
        const s = String(v);
        for (let i = 0; i < Math.min(s.length, n); i++) b.writeUInt32LE(s.codePointAt(i) ?? 0, 4 * i);
        out.push(b);
      } else if (kind === "S") {
        const b = Buffer.alloc(n);
        b.write(String(v), 0, n, "utf8");
        out.push(b);
      } else {
        const prod = f.shape ? f.shape.reduce((a, b) => a * b, 1) : 1;
        const b = Buffer.alloc(n * prod);
        const vals = Array.isArray(v) ? v : [v];
        for (let i = 0; i < prod; i++) {
          const val = Number(vals[i] ?? 0);
          if (kind === "f") {
            if (n === 4) b.writeFloatLE(val, i * 4);
            else b.writeDoubleLE(val, i * 8);
          } else if (kind === "i" && n === 8) b.writeBigInt64LE(BigInt(Math.round(val)), i * 8);
          else if (kind === "i" && n === 4) b.writeInt32LE(Math.round(val), i * 4);
        }
        out.push(b);
      }
    }
  }
  return Buffer.concat(out);
}

const PRIMARY_FIELDS = [
  F("uid", "<i8"),
  F("blob/path", "<U64"),
  F("blob/idx", "<i4"),
  F("blob/shape", "<i4", [2]),
  F("alignments3D/pose", "<f4", [3]),
  F("alignments3D/shift", "<f4", [2]),
  F("alignments3D/class", "<i4"),
  F("alignments3D/split", "<i4"),
  F("alignments3D/overall_score", "<f4"),
];
const PT_FIELDS = [
  F("uid", "<i8"),
  F("blob/psize_A", "<f8"),
  F("ctf/df1_A", "<f8"),
  F("ctf/df2_A", "<f8"),
  F("ctf/df_angle_rad", "<f4"),
  F("ctf/phase_shift_rad", "<f4"),
  F("ctf/accel_kv", "<f4"),
  F("ctf/cs_mm", "<f4"),
  F("ctf/amp_contrast", "<f4"),
  F("ctf/exp_group_id", "<i4"),
  F("location/center_x_frac", "<f4"),
  F("location/center_y_frac", "<f4"),
  F("location/micrograph_path", "<U64"),
  F("location/micrograph_shape", "<i4", [2]),
];
const PRIMARY_ROWS = [
  { uid: 101, "blob/path": "J42/extract/foo_particles.mrc", "blob/idx": 0, "blob/shape": [128, 128], "alignments3D/pose": [0, 0, 0], "alignments3D/shift": [1.5, -2.0], "alignments3D/class": 0, "alignments3D/split": 0, "alignments3D/overall_score": 0.9 },
  { uid: 102, "blob/path": "J42/extract/foo_particles.mrc", "blob/idx": 1, "blob/shape": [128, 128], "alignments3D/pose": [0, 0, 0], "alignments3D/shift": [0, 0], "alignments3D/class": 0, "alignments3D/split": 0, "alignments3D/overall_score": 0.8 },
  { uid: 103, "blob/path": "J42/extract/bar_particles.mrc", "blob/idx": 0, "blob/shape": [128, 128], "alignments3D/pose": [0, 0, 0], "alignments3D/shift": [0, 0], "alignments3D/class": 0, "alignments3D/split": 0, "alignments3D/overall_score": 0.7 },
];
const PT_ROWS = PRIMARY_ROWS.map((r) => ({
  uid: r.uid,
  "blob/psize_A": 0.93,
  "ctf/df1_A": 12000,
  "ctf/df2_A": 12500,
  "ctf/df_angle_rad": 0,
  "ctf/phase_shift_rad": 0,
  "ctf/accel_kv": 300,
  "ctf/cs_mm": 2.7,
  "ctf/amp_contrast": 0.07,
  "ctf/exp_group_id": 0,
  "location/center_x_frac": 0.5,
  "location/center_y_frac": 0.5,
  "location/micrograph_path": "J12/imported/mic_01.mrc",
  "location/micrograph_shape": [4000, 5000],
}));

/* ================================================================== */

let prisma = null;
const STATE_FILE = "/home/z/cryoflow/data/engine-state.json";

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  /* ================================================================== */
  console.log("== PHASE A: CONTRACTS — the source pins ==");

  const engineSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const engineCore = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  const dialogSrc = readFileSync(`${ROOT}/src/components/workflow/remote-run-button.tsx`, "utf8");
  const cssSrc = readFileSync(`${ROOT}/src/app/globals.css`, "utf8");
  const giSrc = readFileSync(`${ROOT}/.gitignore`, "utf8");
  const mockSbatch = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/sbatch`, "utf8");

  must(
    engineSrc.includes("nodeLive?.partitions?.[0] ?? probePartitionOfHost(target.connectionId, explicitNode)"),
    "A1 the pin resolves its OWN partition (scontrol first, the probe's hostlist second)"
  );
  must(
    engineSrc.includes("!nodeLive.partitions.includes(partitionOverride)"),
    "A2 a picked partition the pinned node does not live in is refused pre-staging"
  );
  must(
    engineSrc.includes("partition: partitionOverride ?? pinPartition,"),
    "A3 the sbatch call site carries the resolved pin partition"
  );
  must(
    engineSrc.includes("const effectivePartition =\n    suppressPartition || (nodelist && partition == null)"),
    "A4 the builder names the pin's partition; only an unknown home stays bare (suppressPartition)"
  );
  must(
    engineSrc.includes("const noPartitionNote ="),
    "A5 the refusal translation names the no-partition trap (the default decided)"
  );
  must(
    engineCore.includes("function beginNativeRun(") && engineCore.includes("function abortNativeRun("),
    "A6 the native in-flight record helpers exist (begin/abort)"
  );
  must(
    engineCore.includes('beginNativeRun(job, "engine-native: cryosparc cs \u2192 star (selective links)")'),
    "A7 the cs2star dispatch opens its in-flight record BEFORE the runner"
  );
  must(
    engineCore.includes('beginNativeRun(job, "engine-native: import (write micrographs.star)")'),
    "A8 the import dispatch opens its in-flight record BEFORE the runner"
  );
  must(
    engineCore.includes("pid: process.pid,\n    cmd: `${label} (in flight)`"),
    "A9 the in-flight record's pid is the SERVER process (alive by construction — the sweep's liveness word)"
  );
  must(
    engineCore.includes("function nativePhaseLog(") && engineCore.includes("phase(`discovered:"),
    "A10 the cs2star runner speaks phase lines into run.out as it goes"
  );
  must(
    dialogSrc.includes("? (pickedNode?.partitions?.[0] ?? null)"),
    "A11 the dialog's preview names the pinned node's own partition (the same grammar as the server)"
  );
  must(
    dialogSrc.includes("{pickedNode?.partitions?.[0] ? (") || dialogSrc.includes("pickedNode?.partitions?.[0] ? ("),
    "A12 the mirror item shows the node's partition chip (the two channels display one grammar)"
  );
  must(cssSrc.includes('@source not "../../data";'), "A13 Tailwind stops scanning the runtime data tree");
  must(cssSrc.includes('@source not "../../db";'), "A14 and the SQLite db tree");
  must(/^data\/$/m.test(giSrc), "A15 .gitignore excludes the runtime data tree");
  must(
    mockSbatch.includes('eff_part="${partition:-gpu}"'),
    "A16 the mock controller resolves the effective partition (script's, else the cluster default)"
  );
  must(
    /if \[ -n "\$np" \] && \[ "\$np" != "\$eff_part" \];/.test(mockSbatch),
    "A17 the mock controller enforces the membership verdict on pins"
  );

  /* ================================================================== */
  console.log("== PHASE B: LIVE — the receipt, reproduced and healed ==");

  // ---- the stage: connection (slurm, default partition normal), project,
  // a particles import the class2d legs can consume -----------------------
  const mkConn = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t340",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      useSlurm: true,
      slurmPartition: "normal",
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);

  const mrcHdr = (() => {
    const b = Buffer.alloc(1024);
    b.writeInt32LE(1024, 0);
    b.writeInt32LE(1024, 4);
    b.writeInt32LE(4, 8);
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
    "mkdir -p /data2/t340-particles; " +
      `echo ${mrcHdr} | base64 -d > /data2/t340-particles/stack.mrcs; ` +
      "printf 'data_\\n\\nloop_\\n_rlnImageName #1\\n" +
      "0001@/data2/t340-particles/stack.mrcs\\n" +
      "0002@/data2/t340-particles/stack.mrcs\\n" +
      "0003@/data2/t340-particles/stack.mrcs\\n" +
      "0004@/data2/t340-particles/stack.mrcs\\n' > /data2/t340-particles/particles.star"
  );
  must(fx === "", `the particles fixture builds quietly (${fx.slice(0, 100)})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t340 pin + native", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  const pImport = await mkJob({
    projectId,
    type: "import",
    name: "QA t340 particles import",
    params: {
      nodeType: "particles",
      micrographsPath: "/data2/t340-particles/particles.star",
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!pImport?.id, "the particles import creates");
  const runPImport = await api(`/api/jobs/${pImport.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runPImport.status >= 200 && runPImport.status < 300, `the import run accepts (${runPImport.status})`);
  const donePImport = await awaitJobTerminal(pImport.id, 90_000);
  must(donePImport?.status === "completed", `the import completes (${donePImport?.status})`);

  // ---- B1: the user's receipt, REPRODUCED at the controller --------------
  // A bare pin (no --partition) names a node the cluster's DEFAULT
  // partition does not hold → the exact submit-time refusal.
  const bareScript = client(
    "mkdir -p /data2/t340-bare; " +
      "printf '#!/bin/bash\\n#SBATCH --job-name=barepin\\n#SBATCH --nodelist=brain2\\n#SBATCH --output=/data2/t340-bare/out.log\\n#SBATCH --error=/data2/t340-bare/err.log\\nsleep 1\\n' > /data2/t340-bare/bare.sh; " +
      "sbatch /data2/t340-bare/bare.sh 2>&1; echo RC=$?"
  );
  must(
    /Requested node configuration is not available/.test(bareScript) && /RC=1/.test(bareScript),
    `B1 the BARE pin (no --partition) is refused at submit time — the user's receipt, now modeled (${bareScript.replace(/\n/g, " | ").slice(0, 160)})`
  );

  // ---- B2: the same node WITH its own partition submits fine -------------
  const partScript = client(
    "printf '#!/bin/bash\\n#SBATCH --job-name=partpin\\n#SBATCH --partition=brain2\\n#SBATCH --nodelist=brain2\\n#SBATCH --output=/data2/t340-bare/out2.log\\n#SBATCH --error=/data2/t340-bare/err2.log\\nsleep 1\\n' > /data2/t340-bare/part.sh; " +
      "sbatch /data2/t340-bare/part.sh 2>&1; echo RC=$?"
  );
  must(
    /Submitted batch job \d+/.test(partScript) && /RC=0/.test(partScript),
    `B2 the same node + its own partition submits (the dropdown's shape — what the app must now write) (${partScript.replace(/\n/g, " | ").slice(0, 120)})`
  );

  // ---- B3: THE APP's usage-list pin writes BOTH lines and completes ------
  const newestScript = () => {
    const p = client("find /projects/cryoflow -name .cf-sbatch.sh 2>/dev/null | xargs ls -t 2>/dev/null | head -1");
    return p ? client(`cat ${p}`) : "";
  };

  const c1 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 1",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c1?.id, "the first class2d creates");
  await api("/api/edges", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ fromJobId: pImport.id, toJobId: c1.id, fromPort: "particles", toPort: "particles" }),
  });
  const d1 = await dispatch(c1.id, {
    connectionId: CONN, module: MODULE, mode: "slurm", gpus: 2, nodelist: "brain2",
  });
  must(d1.status >= 200 && d1.status < 300 && !d1.body?.error, `B3a the pinned dispatch is ACCEPTED (${String(d1.body?.error ?? "").slice(0, 140)})`);
  const s1 = await pollUntil(() => {
    const c = newestScript();
    return c.includes(`cf_class2d_${c1.id.slice(-8)}`) && c.includes("#SBATCH") ? c : null;
  }, 60_000, 1500);
  must(
    /#SBATCH --partition=brain2\b/.test(s1 ?? "") && /#SBATCH --nodelist=brain2\b/.test(s1 ?? ""),
    `B3b the pin's script carries BOTH lines (--partition=brain2 + --nodelist=brain2 — the dropdown's composition, healed) (${(s1 ?? "").split("\n").filter((l) => l.includes("SBATCH --partition") || l.includes("SBATCH --nodelist")).join(" · ")})`
  );
  const done1 = await awaitJobTerminal(c1.id, 180_000);
  must(done1?.status === "completed", `B3c the pinned class2d COMPLETES (${done1?.status}: ${String(done1?.result ?? "").slice(0, 90)})`);

  // ---- B4: the dropdown channel writes the SAME two lines ----------------
  const c2 = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 2",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c2?.id, "the second class2d creates");
  await api("/api/edges", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ fromJobId: pImport.id, toJobId: c2.id, fromPort: "particles", toPort: "particles" }),
  });
  const d2 = await dispatch(c2.id, {
    connectionId: CONN, module: MODULE, mode: "slurm", gpus: 2, partition: "brain2",
  });
  must(d2.status >= 200 && d2.status < 300 && !d2.body?.error, `B4a the group dispatch is ACCEPTED (${String(d2.body?.error ?? "").slice(0, 120)})`);
  const s2 = await pollUntil(() => {
    const c = newestScript();
    return c.includes(`cf_class2d_${c2.id.slice(-8)}`) && c.includes("#SBATCH --nodelist=brain2") ? c : null;
  }, 60_000, 1500);
  must(
    /#SBATCH --partition=brain2\b/.test(s2 ?? "") && /#SBATCH --nodelist=brain2\b/.test(s2 ?? ""),
    "B4b the dropdown's script carries the SAME two lines (one grammar, two doors)"
  );
  const done2 = await awaitJobTerminal(c2.id, 180_000);
  must(done2?.status === "completed", `B4c the dropdown class2d COMPLETES (${done2?.status})`);

  // ---- B5: the cs → star native marathon leaves a LIVE trail -------------
  const b64 = (b) => b.toString("base64");
  const primaryCs = npyBuffer(PRIMARY_FIELDS, PRIMARY_ROWS);
  const ptCs = npyBuffer(PT_FIELDS, PT_ROWS);
  const csfx = client(
    "mkdir -p /data2/csproj-t340/J42/extract; " +
      `echo ${b64(primaryCs)} | base64 -d > /data2/csproj-t340/J42/cryosparc_J42_particles.cs; ` +
      `echo ${b64(ptCs)} | base64 -d > /data2/csproj-t340/J42/J42_passthrough_particles.cs; ` +
      "for s in foo bar baz; do printf 'x' > /data2/csproj-t340/J42/extract/${s}_particles.mrc; done; " +
      "ls -1 /data2/csproj-t340/J42/extract/"
  );
  must(/foo_particles\.mrc/.test(csfx) && /baz_particles\.mrc/.test(csfx), `B5a the CS fixtures build (${csfx.replace(/\n/g, " ")})`);

  const csJob = await mkJob({
    projectId,
    type: "cs2star",
    name: "CryoSPARC → RELION t340",
    params: { csPath: "/data2/csproj-t340/J42", invertY: false },
  });
  must(!!csJob?.id, "B5b the cs2star job creates");

  // catch the run MID-FLIGHT: the log route must answer with the phase
  // trail while the row is still running (the old code had NO log file
  // until the very end — 「没有返回log」)
  // natives complete INSIDE the POST (startJob awaits the runner), so the
  // run fires WITHOUT awaiting — the poll below watches the row while the
  // in-process marathon is still executing. The DETERMINISTIC witness is the
  // workdir's own run.out (beginNativeRun opened it from second zero): read
  // straight off the local disk while the POST is still pending; the log
  // ROUTE check rides along best-effort (the mock's conversion is fast, the
  // HTTP poll can miss the window — the file cannot).
  const workdirRun = `${ROOT}/data/relion/${projectId}/cs2star_${csJob.id.slice(-8)}/run.out`;
  const runCsPromise = api(`/api/jobs/${csJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  let caughtLive = false;
  let liveLog = "";
  let routeLive = false;
  for (let i = 0; i < 60; i++) {
    try {
      const text = readFileSync(workdirRun, "utf8");
      if (text.includes("— started") || text.includes("discovered:")) {
        caughtLive = true;
        liveLog = text;
        // best-effort: the ROUTE answering mid-run is the bonus witness
        const lg = await api(`/api/jobs/${csJob.id}/log`, { headers: SH });
        if (String(lg.body?.tail ?? "").includes("— started")) routeLive = true;
        break;
      }
    } catch {
      /* not yet — the record + log land within the first SSH round */
    }
    await sleep(100);
  }
  const runCs = await runCsPromise;
  must(runCs.status >= 200 && runCs.status < 300, `B5c the cs2star run accepts (${runCs.status})`);
  must(
    caughtLive,
    `B5d run.out carries the phase trail WHILE the POST is still pending (the in-flight record + log existed from second zero${routeLive ? " — and the log ROUTE answered mid-run too" : ""}) (log head: ${liveLog.slice(0, 120).replace(/\n/g, " | ")})`
  );

  const doneCs = await awaitJobTerminal(csJob.id, 120_000);
  must(doneCs?.status === "completed", `B5e the conversion completes (${doneCs?.status}: ${String(doneCs?.result ?? "").slice(0, 120)})`);
  const finalLog = await api(`/api/jobs/${csJob.id}/log`, { headers: SH });
  const logText = String(finalLog.body?.tail ?? "");
  must(/— started/.test(logText) && /discovered:/.test(logText) && /downloaded:/.test(logText), `B5f the final log carries the phase trail (started/discovered/downloaded) (${logText.slice(0, 200).replace(/\n/g, " | ")})`);
  must(/converted: 3 particles/.test(logText) && /linking: 2 stack/.test(logText), "B5g the conversion + selective-link phases speak their numbers");

  // ---- B6: THE SWEEP WINDOW — control flips, in-flight survives ----------
  prisma = (await import("@prisma/client")).PrismaClient
    ? new (await import("@prisma/client")).PrismaClient()
    : null;
  must(!!prisma, "B6a the suite can speak to the same SQLite DB (the sweep's own stage)");

  // control: a running row with NO record and an old startedAt flips
  const cCtl = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification sweep-control",
    params: { numClasses: 4, iterations: 2 },
  });
  await prisma.job.update({
    where: { id: cCtl.id },
    data: { status: "running", startedAt: new Date(Date.now() - 4 * 60_000), progress: 0 },
  });
  await sleep(300);
  const afterCtl = await jobById(cCtl.id);
  must(
    afterCtl?.status === "failed" && /stale running state \(no engine record\)/.test(String(afterCtl?.result ?? "")),
    `B6b CONTROL: a stale no-record row still flips to failed (the sweep is alive) (${afterCtl?.status}: ${String(afterCtl?.result ?? "").slice(0, 80)})`
  );

  // the fix: the SAME age, but an in-flight record (pid = a live process)
  // keeps the row running — beginNativeRun's exact shape
  const stateBefore = existsSync(STATE_FILE)
    ? JSON.parse(readFileSync(STATE_FILE, "utf8"))
    : {};
  const fakeWorkdir = "/home/z/cryoflow/data/relion/does-not-matter";
  stateBefore[cCtl.id] = {
    jobId: cCtl.id,
    projectId,
    type: "class2d",
    pid: process.pid,
    cmd: "engine-native: sweep-witness (in flight)",
    workdir: fakeWorkdir,
    logFile: `${fakeWorkdir}/run.out`,
    errFile: `${fakeWorkdir}/run.err`,
    startedAt: new Date().toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
    result: null,
  };
  writeFileSync(STATE_FILE, JSON.stringify(stateBefore, null, 2));
  await prisma.job.update({
    where: { id: cCtl.id },
    data: { status: "running", startedAt: new Date(Date.now() - 4 * 60_000), progress: 0, result: null },
  });
  await sleep(300);
  const afterFix = await jobById(cCtl.id);
  must(
    afterFix?.status === "running",
    `B6c THE FIX: the same stale row with an in-flight record SURVIVES the sweep (a marathon native no longer flips to a false FAILED) (${afterFix?.status})`
  );

  // cleanup: reset the control row, remove the witness record (read-modify-
  // write on the CURRENT truth — the anti-time-travel doctrine)
  const stateNow = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
  delete stateNow[cCtl.id];
  writeFileSync(STATE_FILE, JSON.stringify(stateNow, null, 2));
  await prisma.job.update({
    where: { id: cCtl.id },
    data: { status: "idle", progress: 0, result: null, startedAt: null },
  }).catch(() => {});
} catch (err) {
  fail++;
  console.error("diag crashed:", err);
} finally {
  try { await prisma?.$disconnect(); } catch {}
  console.log(fail === 0 ? "\n== t340 diag: ALL GREEN ==" : `\n== t340 diag: ${fail} FAIL ==`);
  process.exit(fail === 0 ? 0 : 1);
}

#!/usr/bin/env node
/**
 * t327 diag — live node usage in the Run-on-cluster dialog, verified twice.
 *
 * The user's ticket:
 *   「能否在提交任务时查看节点gpu和cpu的占用情况？你可以自己设计，
 *     也可以参考我们使用的脚本show_free_gpu.sh」
 *   — with their script's own dialect on the table:
 *     scontrol show nodes <node> | grep Gres      (totals)
 *     scontrol show nodes <node> | grep AllocTRES (what is spoken for)
 *
 * THE FEATURE: ONE SSH exec of `scontrol show nodes -o` → the pure
 * slurm-usage parser → /api/remote/connections/[id]/usage (15s TTL) →
 * the dialog's Live node usage panel under the partition picker, with an
 * ask line that compares THIS submission's need to the picked
 * partition's free GPUs. The mock cluster grew an scontrol that speaks
 * the user's byte dialect (AllocTRES= empty for idle nodes — exactly
 * their sample) and accounts LIVE sbatch jobs onto their nodes.
 *
 * PHASES:
 *  A. UNIT — the parser's truth table (bun, zero deps): the helpers'
 *     grammars (Gres segments, AllocTRES shares, state words), the
 *     USER'S OWN TABLE reproduced from their script's numbers in BOTH
 *     scontrol dialects (-o one-liners AND the long form their script
 *     greps), and the edge shapes (typed GRES, mid-line AllocTRES,
 *     multi-partition nodes, CPUAlloc fallback).
 *  B. LIVE API — the route's own contract against the mock: the full
 *     node table with the user's exact numbers, GPU-first ordering, the
 *     15s cache (same checkedAt twice, refresh=1 bypasses), 404 for
 *     unknown ids, the cross-site guard, and honest degradation.
 *  C. LIVE JOBS — the honesty centerpiece: a class2d dispatched through
 *     the app @ 3 GPUs on brain2 shows up in usage WHILE IT RUNS
 *     (brain2 4/8 GPUs = 1 baseline + 3 live, +3 CPUs) and releases
 *     them when it lands; the record's gpusRequested=3 is the same
 *     number the ask line speaks.
 *  D. UI CONTRACTS — the panel's source pins: the hooks the browser
 *     flows target, the ask line's math (width truth × array %4), the
 *     informational-only doctrine (the Send button's disabled predicate
 *     untouched by the panel), the route's TTL, the mock's journal.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t327";
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
const clientBoth = (cmd) => {
  const r = spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  return `${r.stdout?.trim() ?? ""}${r.stderr?.trim() ? ` <<stderr>> ${r.stderr.trim()}` : ""}`.trim();
};

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

/** the mock's own scontrol through the app's SSH lane (dialect witness) */
const scontrolOnMock = (args) => client(`scontrol ${args}`);

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t327",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  // ======================================================================
  console.log("== PHASE A: UNIT — the parser's truth table (bun, zero deps) ==");

  const usageSrc = readFileSync(`${ROOT}/src/lib/hpc/slurm-usage.ts`, "utf8");
  must(
    !/^import\s/m.test(usageSrc) && !/^}\s*from\s/m.test(usageSrc),
    "slurm-usage.ts is PURE (zero imports — the t326 gpu-width recipe)"
  );

  const unit = (expr) => {
    const prog = [
      `const m = await import(${JSON.stringify(path.join(ROOT, "src/lib/hpc/slurm-usage.ts"))});`,
      `const out = (${expr});`,
      `console.log("__UNIT__" + JSON.stringify(out));`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 160)}`;
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("__UNIT__"));
    if (!line) return `UNIT-PARSE-ERROR: ${(r.stdout ?? "").slice(0, 120)}`;
    try {
      return JSON.parse(line.slice("__UNIT__".length));
    } catch {
      return `UNIT-PARSE-ERROR: ${line.slice(0, 140)}`;
    }
  };

  // --- the Gres= grammar (totals) ---
  const gresCases = [
    ["gpu:5", 5],
    ["gpu:A100:5", 5], // typed GRES
    ["gpu:2,gpu:4", 6], // mixed segments sum
    ["gpu:5(S:0-1)", 5], // slot-map suffix stripped
    ["(null)", 0],
    ["gpu", 0], // countless
    ["shard:8", 0], // not a gpu
    ["", 0],
  ];
  for (const [gres, want] of gresCases) {
    must(
      unit(`m.gresGpuTotal(${JSON.stringify(gres)})`) === want,
      `gresGpuTotal — "${gres}" → ${want}`
    );
  }

  // --- the AllocTRES= grammar (what is spoken for) ---
  const tresGpuCases = [
    ["cpu=2,gres/gpu=1", 1],
    ["gres/gpu:rtx3090=2,mem=8G", 2], // typed share
    ["cpu=4,gres/gpu=2", 2],
    ["gres/gpu=1,gres/gpu:rtx=1", 2], // two shares sum
    ["mem=800G", 0],
    ["", 0],
  ];
  for (const [tres, want] of tresGpuCases) {
    must(
      unit(`m.allocTresGpus(${JSON.stringify(tres)})`) === want,
      `allocTresGpus — "${tres}" → ${want}`
    );
  }
  must(unit(`m.allocTresCpus("cpu=2,gres/gpu=1")`) === 2, "allocTresCpus — cpu=2 → 2");
  must(unit(`m.allocTresCpus("mem=8G")`) === null, "allocTresCpus — no cpu= share → null");
  must(unit(`m.allocTresCpus("")`) === null, "allocTresCpus — empty → null (the fallback stands)");

  // --- the State word grammar ---
  must(unit(`m.stateWord("IDLE+DRAIN")`) === "IDLE", "stateWord — IDLE+DRAIN → IDLE");
  must(unit(`m.stateWord("MIXED*")`) === "MIXED", "stateWord — MIXED* → MIXED");
  must(unit(`m.stateWord("down")`) === "DOWN", "stateWord — case-normalized");

  // --- THE USER'S OWN TABLE, both dialects ---
  // Their script's rows (partition · Total CPU · Gres · AllocTRES), as the
  // -o dialect the app runs…
  const userOneline = [
    "NodeName=gpu01 Arch=x86_64 CoresPerSocket=10 CPUAlloc=0 CPUErr=0 CPUTot=80 CPULoad=0.00 Gres=gpu:5 NodeAddr=gpu01 NodeHostName=gpu01 Version=19.05.7 Partitions=normal State=IDLE ThreadsPerCore=2 TmpDisk=0 Weight=1 Owner=N/A MCS_label=N/A AllocTRES=",
    "NodeName=gpu02 Arch=x86_64 CoresPerSocket=8 CPUAlloc=0 CPUErr=0 CPUTot=64 CPULoad=0.00 Gres=gpu:6 NodeAddr=gpu02 NodeHostName=gpu02 Version=19.05.7 Partitions=brain State=IDLE ThreadsPerCore=2 TmpDisk=0 Weight=1 Owner=N/A MCS_label=N/A AllocTRES=",
    "NodeName=gpu03 Arch=x86_64 CoresPerSocket=10 CPUAlloc=0 CPUErr=0 CPUTot=80 CPULoad=0.00 Gres=gpu:8 NodeAddr=gpu03 NodeHostName=gpu03 Version=19.05.7 Partitions=normal02 State=IDLE ThreadsPerCore=2 TmpDisk=0 Weight=1 Owner=N/A MCS_label=N/A AllocTRES=",
    "NodeName=gpu06 Arch=x86_64 CoresPerSocket=16 CPUAlloc=2 CPUErr=0 CPUTot=128 CPULoad=1.20 Gres=gpu:8 NodeAddr=gpu06 NodeHostName=gpu06 Version=19.05.7 Partitions=brain2_gpu06 State=MIXED ThreadsPerCore=2 TmpDisk=0 Weight=1 Owner=N/A MCS_label=N/A AllocTRES=cpu=2,gres/gpu=1",
    "NodeName=gpu07 Arch=x86_64 CoresPerSocket=16 CPUAlloc=0 CPUErr=0 CPUTot=128 CPULoad=0.00 Gres=gpu:8 NodeAddr=gpu07 NodeHostName=gpu07 Version=19.05.7 Partitions=brain4_gpu07 State=IDLE ThreadsPerCore=2 TmpDisk=0 Weight=1 Owner=N/A MCS_label=N/A AllocTRES=",
    "NodeName=gpu05 Arch=x86_64 CoresPerSocket=12 CPUAlloc=4 CPUErr=0 CPUTot=48 CPULoad=0.50 Gres=gpu:6 NodeAddr=gpu05 NodeHostName=gpu05 Version=19.05.7 Partitions=brain3 State=MIXED ThreadsPerCore=2 TmpDisk=0 Weight=1 Owner=N/A MCS_label=N/A AllocTRES=cpu=4,gres/gpu=2",
  ].join("\n");
  // …and the long form their script actually greps (t327's own fixture of
  // the user's world: brain2_gpu06 = 128 CPU / gpu:8 / cpu=2,gres/gpu=1)
  const userLong = `NodeName=gpu06 Arch=x86_64 CoresPerSocket=16
   CPUAlloc=2 CPUErr=0 CPUTot=128 CPULoad=1.20
   AvailableFeatures=(null) ActiveFeatures=(null)
   Gres=gpu:8
   NodeAddr=gpu06 NodeHostName=gpu06 Version=19.05.7
   RealMemory=253000 AllocMem=2000 FreeMem=251000 Sockets=2 Boards=1
   Partitions=brain2_gpu06
   State=MIXED ThreadsPerCore=2 TmpDisk=0 Weight=1 Owner=N/A MCS_label=N/A
   BootTime=2026-09-01T00:00:00 SlurmdStartTime=2026-09-01T00:00:00
   CfgTRES=cpu=128,gres/gpu=8,mem=253000M
   AllocTRES=cpu=2,gres/gpu=1
`;
  const userRows = unit(`m.parseScontrolNodes(${JSON.stringify(userOneline)})`);
  must(Array.isArray(userRows) && userRows.length === 6, `the -o dialect parses all six nodes (${userRows.length})`);
  const byNode = Object.fromEntries((userRows ?? []).map((n) => [n.node, n]));
  const expect = {
    gpu01: { cpuTotal: 80, gpuTotal: 5, cpuAlloc: 0, gpuAlloc: 0, state: "IDLE", part: "normal" },
    gpu02: { cpuTotal: 64, gpuTotal: 6, cpuAlloc: 0, gpuAlloc: 0, state: "IDLE", part: "brain" },
    gpu03: { cpuTotal: 80, gpuTotal: 8, cpuAlloc: 0, gpuAlloc: 0, state: "IDLE", part: "normal02" },
    gpu06: { cpuTotal: 128, gpuTotal: 8, cpuAlloc: 2, gpuAlloc: 1, state: "MIXED", part: "brain2_gpu06" },
    gpu07: { cpuTotal: 128, gpuTotal: 8, cpuAlloc: 0, gpuAlloc: 0, state: "IDLE", part: "brain4_gpu07" },
    gpu05: { cpuTotal: 48, gpuTotal: 6, cpuAlloc: 4, gpuAlloc: 2, state: "MIXED", part: "brain3" },
  };
  for (const [node, e] of Object.entries(expect)) {
    const n = byNode[node] ?? {};
    must(
      n.cpuTotal === e.cpuTotal &&
        n.gpuTotal === e.gpuTotal &&
        n.cpuAlloc === e.cpuAlloc &&
        n.gpuAlloc === e.gpuAlloc &&
        n.state === e.state &&
        n.partitions?.[0] === e.part,
      `the user's table — ${node}: ${e.part} · CPU ${e.cpuAlloc}/${e.cpuTotal} · GPU ${e.gpuAlloc}/${e.gpuTotal} · ${e.state} (got ${JSON.stringify(n)})`
    );
  }
  const longRows = unit(`m.parseScontrolNodes(${JSON.stringify(userLong)})`);
  const lgpu06 = (longRows ?? []).find?.((n) => n.node === "gpu06");
  must(
    lgpu06 &&
      lgpu06.cpuTotal === 128 && lgpu06.gpuTotal === 8 &&
      lgpu06.cpuAlloc === 2 && lgpu06.gpuAlloc === 1 &&
      lgpu06.state === "MIXED" && lgpu06.partitions?.[0] === "brain2_gpu06",
    `the LONG form (their script's grep dialect) parses identically (got ${JSON.stringify(lgpu06)})`
  );

  // --- the edge shapes ---
  const edgeCases = unit(
    `m.parseScontrolNodes(${JSON.stringify(
      [
        // typed GRES + multi-partition node
        "NodeName=alpha Partitions=work,debug State=MIXED CPUTot=32 CPUAlloc=0 Gres=gpu:rtx3090:2 AllocTRES=gres/gpu:rtx3090=1",
        // AllocTRES mid-line followed by another token (21.08's shape)
        "NodeName=beta Partitions=work State=IDLE CPUTot=16 CPUAlloc=0 Gres=gpu:1 AllocTRES= Weight=1",
        // no AllocTRES at all (ancient slurm) — CPUAlloc stands in
        "NodeName=gamma Partitions=work State=ALLOCATED CPUTot=8 CPUAlloc=8 Gres=(null)",
      ].join("\n")
    )})`
  );
  const alpha = (edgeCases ?? []).find?.((n) => n.node === "alpha");
  const beta = (edgeCases ?? []).find?.((n) => n.node === "beta");
  const gamma = (edgeCases ?? []).find?.((n) => n.node === "gamma");
  must(
    alpha && alpha.gpuTotal === 2 && alpha.gpuAlloc === 1 &&
      alpha.partitions.length === 2 && alpha.cpuAlloc === 0,
    `edge — typed GRES + multi-partition + TRES-only cpu=0 (got ${JSON.stringify(alpha)})`
  );
  must(
    beta && beta.gpuAlloc === 0 && beta.cpuAlloc === 0,
    `edge — EMPTY AllocTRES mid-line stops at the next token (got ${JSON.stringify(beta)})`
  );
  must(
    gamma && gamma.cpuAlloc === 8 && gamma.gpuTotal === 0,
    `edge — no AllocTRES field: CPUAlloc stands in (got ${JSON.stringify(gamma)})`
  );

  // --- free math + ordering ---
  must(
    unit(`m.nodeFreeGpus({gpuTotal: 8, gpuAlloc: 10})`) === 0,
    "nodeFreeGpus clamps at zero (a stray TRES cannot invent capacity)"
  );
  const sorted = unit(
    `m.sortNodesForDisplay([{node:"a",partitions:[],state:"",stateRaw:"",cpuTotal:8,cpuAlloc:0,gpuTotal:0,gpuAlloc:0},{node:"b",partitions:[],state:"",stateRaw:"",cpuTotal:64,cpuAlloc:0,gpuTotal:6,gpuAlloc:0},{node:"c",partitions:[],state:"",stateRaw:"",cpuTotal:128,cpuAlloc:0,gpuTotal:8,gpuAlloc:0}]).map(n=>n.node).join("")`
  );
  must(sorted === "cba", `sortNodesForDisplay — GPU nodes first, widest first (got "${sorted}")`);

  // ======================================================================
  console.log("== PHASE B: LIVE API — the route's own contract against the mock ==");

  // the probe first — the UI flow's precondition (slurm client, brain2 group)
  const probeRes = await api(`/api/remote/connections/${CONN}/test`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({}),
  });
  must(probeRes.status >= 200 && probeRes.status < 300, `the probe answers (${probeRes.status})`);
  must(probeRes.body?.probe?.slurm === true, "the probe sees the Slurm client");

  // the mock's own dialect, witnessed through the app's SSH lane
  const longForm = scontrolOnMock("show nodes brain2");
  must(/Gres=gpu:8/.test(longForm), "the mock's LONG form greps Gres=gpu:8 (the user's script dialect)");
  must(/AllocTRES=cpu=2,gres\/gpu=1/.test(longForm), "the mock's LONG form greps the brain2 AllocTRES (their live sample)");
  const idleForm = scontrolOnMock("show nodes normal");
  must(/^\s*AllocTRES=$/m.test(idleForm), "the mock's idle nodes print EMPTY AllocTRES= (their sample's exact shape — indented long form)");

  // the route
  const u1 = await usage(true);
  must(u1.status === 200, `GET usage answers 200 (${u1.status})`);
  const payload1 = u1.body ?? {};
  must(payload1.ok === true, "the payload speaks ok:true");
  must(payload1.command === "scontrol show nodes -o", `the payload names its command (${payload1.command})`);
  const nodes = payload1.nodes ?? [];
  must(nodes.length >= 14, `every mock node answers (${nodes.length} rows)`);

  const find = (name) => nodes.find((n) => n.node === name);
  const brain2 = find("brain2");
  must(
    brain2 && brain2.cpuTotal === 128 && brain2.gpuTotal === 8 &&
      brain2.cpuAlloc === 2 && brain2.gpuAlloc === 1 && brain2.state === "MIXED",
    `brain2 — the user's live sample exactly: 128 CPU (2 used) · 8 GPU (1 used) · MIXED (got ${JSON.stringify(brain2)})`
  );
  const brain3 = find("brain3");
  must(
    brain3 && brain3.cpuTotal === 48 && brain3.gpuTotal === 6 &&
      brain3.cpuAlloc === 4 && brain3.gpuAlloc === 2,
    `brain3 — their sample's other row: 48 CPU (4 used) · 6 GPU (2 used) (got ${JSON.stringify(brain3)})`
  );
  const normal = find("normal");
  must(
    normal && normal.cpuTotal === 80 && normal.gpuTotal === 5 &&
      normal.cpuAlloc === 0 && normal.gpuAlloc === 0 && normal.state === "IDLE",
    `normal — their table's first row: 80 CPU · 5 GPU, nothing spoken for (got ${JSON.stringify(normal)})`
  );
  must(
    nodes[0].gpuTotal >= nodes[nodes.length - 1].gpuTotal &&
      find("brain2") != null && nodes[0].gpuTotal === 8,
    "the rows arrive GPU-first (widest offer first — the dialog's display order is the route's)"
  );

  // the cache: same checkedAt twice, refresh=1 bypasses
  const c1 = await usage(false);
  const c2 = await usage(false);
  must(
    c1.body?.checkedAt === c2.body?.checkedAt,
    "the 15s TTL — two back-to-back GETs share one checkedAt (no SSH storm)"
  );
  await sleep(50);
  const c3 = await usage(true);
  must(
    c3.body?.checkedAt !== c1.body?.checkedAt,
    "refresh=1 bypasses the cache (the manual button's own lane)"
  );

  // honest degradation + the guards
  const unknown = await api(`/api/remote/connections/no-such-conn/usage`, { headers: SH });
  must(unknown.status === 404, `an unknown connection answers 404 route-speak (${unknown.status})`);
  const crossSite = await fetch(`${BASE}/api/remote/connections/${CONN}/usage`);
  must(crossSite.status === 403, `a cross-site GET (no origin headers) is refused (${crossSite.status})`);

  // ======================================================================
  console.log("== PHASE C: LIVE JOBS — a dispatched job holds its GPUs, then releases them ==");

  // the fixtures — the t326 PHASE C shape (particles star + stack on the mock)
  const mrcHdr = (() => {
    // a minimal single-section MRC header, the t326 recipe
    const b = Buffer.alloc(1024);
    b.writeInt32LE(1024, 0); // NX
    b.writeInt32LE(1024, 4); // NY
    b.writeInt32LE(1, 8); // NZ
    b.writeInt32LE(2, 12); // MODE float32
    b.writeInt32LE(1, 20); // NXSTART
    b.writeInt32LE(256, 44); // NXYZSTART-ish
    b.writeInt32LE(1, 64); // Z length word
    b.writeFloatLE(1.0, 68); // scale
    b.writeInt32LE(1, 92); // ISPG data block
    b.writeInt32LE(128, 96); // bad pad
    return b.toString("base64");
  })();
  const fx = clientBoth(
    "mkdir -p /data2/t327-particles; " +
      `echo ${mrcHdr} | base64 -d > /data2/t327-particles/stack.mrcs; ` +
      "printf 'data_\\n\\nloop_\\n_rlnImageName #1\\n" +
      "0001@/data2/t327-particles/stack.mrcs\\n" +
      "0002@/data2/t327-particles/stack.mrcs\\n" +
      "0003@/data2/t327-particles/stack.mrcs\\n" +
      "0004@/data2/t327-particles/stack.mrcs\\n' > /data2/t327-particles/particles.star"
  );
  must(fx === "", `the particles fixture builds quietly (${fx.slice(0, 100)})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t327 live usage", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  const projRoot = `/projects/cryoflow/${projectId}`;

  const pImport = await mkJob({
    projectId,
    type: "import",
    name: "QA t327 particles import",
    params: {
      nodeType: "particles",
      micrographsPath: "/data2/t327-particles/particles.star",
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!pImport?.id, "the particles import creates");
  const runPImport = await api(`/api/jobs/${pImport.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runPImport.status >= 200 && runPImport.status < 300, `the import run accepts (${runPImport.status})`);
  const donePImport = await awaitJobTerminal(pImport.id, 90_000);
  must(donePImport?.status === "completed", `the particles import completes (${donePImport?.status})`);

  // the class2d — the user's own dialog shape: MPI type, 3 GPUs, brain2.
  // The ask line will speak "3 GPU(s) on brain2"; the live usage must SHOW
  // those 3 GPUs held on brain2 while it runs.
  const c2d = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 1",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c2d?.id, "the class2d job creates");
  const edgeC2d = await mkEdge(pImport.id, c2d.id, "particles", "particles");
  must(edgeC2d === 200 || edgeC2d === 201, `the edge wires particles import → class2d (${edgeC2d})`);

  const dispatchC2d = await dispatch(c2d.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 3, partition: "brain2" },
  });
  must(dispatchC2d.status >= 200 && dispatchC2d.status < 300, `the class2d dispatch answers (${dispatchC2d.status})`);
  must(!dispatchC2d.body?.error, `the class2d dispatch is ACCEPTED (${String(dispatchC2d.body?.error ?? "").slice(0, 120)})`);

  // the RUNNING window: brain2 must show baseline(1) + live(3) = 4/8 GPUs
  const sawLive = await pollUntil(async () => {
    const r = await usage(true);
    const b2 = (r.body?.nodes ?? []).find((n) => n.node === "brain2");
    return b2 && b2.gpuAlloc === 4 ? b2 : null;
  }, 120_000, 1500);
  must(
    sawLive && sawLive.gpuAlloc === 4,
    `while the class2d RUNS, brain2 shows 4/8 GPUs held (1 baseline + 3 live) (got ${JSON.stringify(sawLive?.gpuAlloc)})`
  );
  must(
    sawLive && sawLive.cpuAlloc === 5,
    `while it runs, brain2's CPUs grow by the 3 ranks (2 baseline + 3 = 5/128) (got ${JSON.stringify(sawLive?.cpuAlloc)})`
  );
  must(
    sawLive && (sawLive.state === "MIXED" || sawLive.state === "ALLOCATED"),
    `the node's state stays honest while partially held (${sawLive?.state})`
  );

  const doneC2d = await awaitJobTerminal(c2d.id, 180_000);
  must(doneC2d?.status === "completed", `the class2d COMPLETES (${doneC2d?.status}: ${String(doneC2d?.result ?? "").slice(0, 90)})`);

  // released: back to the baseline
  const after = await usage(true);
  const b2After = (after.body?.nodes ?? []).find((n) => n.node === "brain2");
  must(
    b2After && b2After.gpuAlloc === 1 && b2After.cpuAlloc === 2,
    `when it lands, brain2 releases everything (back to 1/8 GPU · 2/128 CPU) (got ${b2After?.gpuAlloc}/${b2After?.cpuAlloc})`
  );
  const recC2d = doneC2d?.runRemote ?? {};
  must(recC2d.gpusRequested === 3, `the record speaks gpusRequested=3 — the ask line's own number (${String(recC2d.gpusRequested)})`);

  // ======================================================================
  console.log("== PHASE D: UI CONTRACTS — the panel's source pins ==");

  const ui = readFileSync(`${ROOT}/src/components/workflow/remote-run-button.tsx`, "utf8");
  const panel = readFileSync(`${ROOT}/src/components/workflow/cluster-usage-panel.tsx`, "utf8");
  const route = readFileSync(`${ROOT}/src/app/api/remote/connections/[id]/usage/route.ts`, "utf8");
  const mockScontrol = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/scontrol`, "utf8");
  const mockSbatch = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/sbatch`, "utf8");

  // the integration: the panel rides the slurm panel, under the picker
  must(
    ui.includes('import { ClusterUsagePanel } from "./cluster-usage-panel"'),
    "the dialog imports the panel"
  );
  must(
    /<ClusterUsagePanel\s[^>]*connectionId=\{conn\.id\}/.test(ui) &&
      ui.includes("partition={partition === PARTITION_AUTO ? null : partition}") &&
      ui.includes("ask={usageAsk}"),
    "the panel is wired with the connection, the picked partition, and the ask"
  );
  const pickerPos = ui.indexOf('data-node-picker-row=""');
  const panelPos = ui.indexOf("<ClusterUsagePanel");
  const widthPos = ui.indexOf('data-gpu-width-row=""');
  must(
    pickerPos > 0 && panelPos > pickerPos && widthPos > panelPos,
    "the panel sits BETWEEN the partition picker and the GPU width (the occupancy informs the pick)"
  );

  // the ask line's math: the width truth × the array's %4 concurrency
  must(
    ui.includes("const perTask = logPick ? 0 : widthIsReal ? gpus : widthTruth.gpus;") &&
      ui.includes("Math.min(shards, 4)"),
    "the ask derives from the SHARED width truth + the %4 array concurrency (never the stepper alone)"
  );

  // the panel's own DOM contract
  for (const hook of [
    'data-cluster-usage-panel=""',
    'data-usage-node={n.node}',
    'data-usage-ask-line=""',
    'data-usage-age=""',
    'aria-label="Refresh live node usage"',
    'role="list"',
    'aria-label="Node GPU and CPU usage"',
  ]) {
    must(panel.includes(hook), `panel hook — ${hook} exists`);
  }
  must(panel.includes("Live node usage"), "the panel's headline is 'Live node usage'");
  must(
    /The\s+submit\s+button\s+still\s+works/.test(panel),
    "the failure state SAYS it is informational (the submit still works)"
  );
  must(
    panel.includes("show_free_gpu.sh"),
    "the attribution line names the user's own script's dialect"
  );
  must(
    panel.includes("30_000"),
    "the auto-refresh is the 30s interval (the server TTL dedupes the SSH load)"
  );
  must(
    panel.includes("max-h-56") && panel.includes("overflow-y-auto") && panel.includes("nice-scroll"),
    "long node lists scroll inside a capped area (the long-list doctrine)"
  );
  must(
    panel.includes("disabled={refreshing || loading || !connectionId}"),
    "the refresh button degrades honestly (disabled without a connection)"
  );
  // the ask line's tones carry meaning; the bars never decorate
  must(
    panel.includes('"tight"') && panel.includes("will queue until GPUs release"),
    "the tight ask speaks the honest consequence (queue, not refusal)"
  );

  // the informational doctrine: the Send button's predicate is untouched
  must(
    ui.includes("disabled={pending || !conn || (mode === \"slurm\" && !slurmAvailable)}"),
    "the Send button's disabled predicate is UNCHANGED (usage never gates a dispatch)"
  );

  // the route's contract
  must(route.includes("CACHE_TTL_MS = 15_000"), "the route's TTL is pinned at 15s");
  must(route.includes("MAX_NODES = 128"), "the route caps rows at 128");
  must(
    route.includes("ok: false") && route.includes("is NOT a 500"),
    "the route degrades honestly (ok:false shapes, never a 500)"
  );
  must(
    route.includes('searchParams.get("refresh") === "1"'),
    "the refresh=1 lane exists in the route"
  );

  // the mock's contract
  must(
    mockScontrol.includes("AllocTRES=") && mockScontrol.includes("Gres=gpu:"),
    "the mock scontrol speaks the user's dialect (Gres= + AllocTRES= fields)"
  );
  must(
    /job-\$id\.req/.test(mockSbatch) && mockSbatch.includes("t327 — the request journal"),
    "the mock sbatch journals job-<id>.req (the live accounting's source)"
  );
  must(
    mockScontrol.includes("only RUNNING holds resources"),
    "the mock counts RUNNING jobs only (PENDING waits — it does not allocate)"
  );

  console.log(fail === 0 ? "\n== t327 diag: ALL GREEN ==" : `\n== t327 diag: ${fail} FAIL ==`);
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
    client("rm -rf /data2/t327-particles /tmp/.t327-*.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

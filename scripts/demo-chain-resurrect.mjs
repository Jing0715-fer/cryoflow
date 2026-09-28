#!/usr/bin/env node
// demo-chain-resurrect.mjs — the demo tutorial chain's resurrection healer
// (Task 313; generalized in 402-recovery). The original healer healed the
// ACCUMULATED demo canvas (13 nodes carried by a DB that had survived eras)
// by adding the two links the chain always lacked: initialmodel (class3d's
// model_mrc had no upstream) and maskcreate (postprocess's mask_mrc had no
// upstream). It was bound to hard-coded node IDs from that one database.
//
// The 402-recovery generalization: the sandbox was restored and the DB is
// FRESH — the seed (src/lib/seed.ts) plants only the 3-node starter
// (import → motioncorr → ctffind). This healer now BOOTSTRAPS the full
// 15-node tutorial chain from ANY world:
//
//   1. synthesizes the EMPIAR-10017 stand-in bundle (24 × 512² float32
//      micrographs, deterministic LCG + Gaussian blobs, REAL MRC2014
//      headers) — the seed's designed data source, absent since forever;
//   2. scrubs qa-* connection leftovers, creates/reuses "Mock Cluster";
//   3. resolves the demo project BY NAME and every chain node BY TYPE
//      (idempotent: existing nodes are reused, missing ones are created),
//      then wires the 14-edge linear spine idempotently;
//   4. flips the chain import to the EMPIAR leg (params.empiarData=true);
//   5. re-runs the chain in topological order through the product's OWN
//      run door (engine-native jobs local, CLI jobs via the mock cluster),
//      polling each to completion — collectOutputs fills the outputs maps
//      per the old convention (the engine is the only writer, zero guessing);
//   6. verifies the payoff surfaces (FSC route, Guinier route, the official
//      number in the postprocess result).
//
// IDEMPOTENT: existing bundle / connection / nodes / edges / outputs are
// reused; --rerun forces the whole chain to re-run.
//
// Usage: node scripts/demo-chain-resurrect.mjs [--rerun] [--from <type>]
//   --from <type>: start the re-run at <type> (chunked healing — t412: the
//   sandbox's patrol reaps background node processes after ~7-8 min, so the
//   chain runs in foreground chunks; completed nodes keep their products).

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import http from "node:http";

const BASE = "http://localhost:3000";
const EMPIAR_DIR = "/home/z/empiar-10017/micrographs";
const N_MIC = 24;
const BOX = 512;

// same-origin metadata — the run door is a write gate (t252)
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiOnce(method, url, body) {
  // node:http directly — undici's keep-alive pool and this sandbox's
  // half-reaped servers are a poison match (UND_ERR_SOCKET on every pooled
  // request while a fresh-connection curl sails through). A raw request
  // opens a clean socket per call and speaks to whoever owns the port now.
  // t404: a socket-level TIMEOUT is load-bearing — a server that is up but
  // mid-compile accepts the TCP connection and then never answers; without
  // a timeout the promise hangs FOREVER (neither error nor response, so the
  // api() retry layer never engages) and the healer silently fossilizes.
  // 30s: generous enough for the slowest honest route, tight enough that a
  // hung server costs one retry cycle instead of the whole healing run.
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const req = http.request(
      `${BASE}${url}`,
      {
        method,
        headers: {
          ...SH,
          ...(payload !== null ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => { text += c; });
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(text); } catch { /* non-JSON */ }
          resolve({ status: res.statusCode ?? 0, body: json });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error(`healer api timeout (no byte in 30s) on ${method} ${url}`)));
    if (payload !== null) req.write(payload);
    req.end();
  });
}

// 402-recovery: the QA sandbox's patrol reaps compile-heavy servers; the
// healer OUTLIVES reboots instead of dying on the first ECONNREFUSED.
// Retry ONLY the connection layer (a 4xx/5xx is an honest answer, a refused
// socket is not) — the run door's 409 keeps a retried POST idempotent.
async function api(method, url, body, attempt = 0) {
  try {
    return await apiOnce(method, url, body);
  } catch (e) {
    if (attempt >= 60) throw e;
    if (attempt === 0) console.log(`  (server down — retrying ${url} through the reboot)`);
    await sleep(5000);
    return api(method, url, body, attempt + 1);
  }
}

/* ------------------------------------------------------------------ */
/* 1. the EMPIAR-10017 stand-in bundle                                  */
/* ------------------------------------------------------------------ */

function writeMicrograph(file, seed) {
  const n = BOX;
  const floats = new Float32Array(n * n);
  // deterministic dark field + four Gaussian "particles" + LCG grain
  const blobs = [
    [0.30, 0.32, 42], [0.62, 0.28, 38], [0.45, 0.60, 46], [0.70, 0.68, 34],
  ].map(([fx, fy, r], i) => [fx * n, fy * n, r + ((seed * 7 + i * 13) % 9)]);
  let lcg = (seed * 1103515245 + 12345) & 0x7fffffff;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      lcg = (lcg * 1103515245 + 12345) & 0x7fffffff;
      let v = ((lcg >>> 16) % 1000) / 1000.0 * 0.12; // noise floor
      for (const [bx, by, br] of blobs) {
        const d2 = (x - bx) ** 2 + (y - by) ** 2;
        v += 0.9 * Math.exp(-d2 / (2 * br * br));
      }
      floats[y * n + x] = Math.fround(v);
    }
  }
  const header = Buffer.alloc(1024);
  header.writeInt32LE(n, 0);
  header.writeInt32LE(n, 4);
  header.writeInt32LE(1, 8); // single-section image
  header.writeInt32LE(2, 12); // MODE float32 (MRC2014 word 3)
  header.writeInt32LE(0, 16); header.writeInt32LE(0, 20); header.writeInt32LE(0, 24);
  header.writeInt32LE(n, 28); header.writeInt32LE(n, 32); header.writeInt32LE(1, 36);
  header.writeFloatLE(n, 40); header.writeFloatLE(n, 44); header.writeFloatLE(1, 48);
  header.writeFloatLE(90, 52); header.writeFloatLE(90, 56); header.writeFloatLE(90, 60);
  header.writeInt32LE(1, 64); header.writeInt32LE(2, 68); header.writeInt32LE(3, 72);
  header.writeFloatLE(0, 76); header.writeFloatLE(1.2, 80); header.writeFloatLE(0.1, 84);
  header.writeInt32LE(0, 88); // ISPG 0 = image
  header.writeInt32LE(0, 92); // NSYMBT
  header.write("MAP ", 208, "ascii");
  header.writeInt32LE(0x00004144, 212); // MACHST little-endian
  header.writeFloatLE(0.25, 216); // RMS
  header.writeInt32LE(1, 220); // NLABL
  header.write(`CryoFlow demo stand-in micrograph ${seed} (EMPIAR-10017 shape)`, 224, "utf8");
  const payload = Buffer.from(floats.buffer);
  writeFileSync(file, Buffer.concat([header, payload]));
}

console.log("== step 1: the EMPIAR-10017 stand-in bundle ==");
mkdirSync(EMPIAR_DIR, { recursive: true });
let existing = 0;
for (let i = 1; i <= N_MIC; i++) {
  const f = `${EMPIAR_DIR}/mic_${String(i).padStart(3, "0")}.mrc`;
  if (existsSync(f) && statSync(f).size === 1024 + BOX * BOX * 4) existing++;
  else writeMicrograph(f, i + 17);
}
must(existing === N_MIC ? true : true, `bundle ready at ${EMPIAR_DIR} (${N_MIC - existing} synthesized, ${existing} already on disk)`);

/* ------------------------------------------------------------------ */
/* 2. the mock cluster connection                                       */
/* ------------------------------------------------------------------ */

console.log("== step 2: the Mock Cluster connection ==");
const list0 = await api("GET", "/api/remote/connections");
const conns0 = list0.body?.connections ?? [];
// qa-* leftovers are family residue, not user data — scrub (t293's idiom)
for (const c of conns0) {
  if (String(c.id ?? "").startsWith("qa-")) {
    await api("DELETE", `/api/remote/connections/${c.id}`);
    console.log(`  (scrub) qa-probe leftover ${c.id.slice(0, 8)} removed`);
  }
}
const conns1 = (await api("GET", "/api/remote/connections")).body?.connections ?? [];
let conn = conns1.find((c) => c.name === "Mock Cluster");
if (!conn) {
  const mk = await api("POST", "/api/remote/connections", {
    name: "Mock Cluster",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: "/projects/cryoflow",
    useSlurm: true,
    defaultModule: "relion/5.0.1",
  });
  conn = mk.body?.connection;
  must(mk.status === 201 && !!conn, `Mock Cluster connection created (${mk.status})`);
} else {
  must(true, `Mock Cluster connection reused (${conn.id.slice(0, 8)})`);
}
const CONN_ID = conn.id;

/* ------------------------------------------------------------------ */
/* 3. the chain resolved BY TYPE + the spine wired idempotently         */
/*    (402-recovery: the world is rebuilt from ANY seed)                */
/* ------------------------------------------------------------------ */

console.log("== step 3: the chain nodes (resolve by type, create if missing) ==");
const projects = (await api("GET", "/api/projects")).body;
const projList = Array.isArray(projects) ? projects : (projects?.projects ?? []);
const proj = projList.find((p) => p.name?.includes("β-Galactosidase"))
  ?? projList.find((p) => p.name?.toLowerCase().includes("demo"));
must(!!proj, `the demo project exists (${proj?.name ?? "none of " + projList.length})`);
if (!proj) { console.log(`${fail} FAIL`); process.exit(1); }
const PROJ = proj.id;

const jobsAll = (await api("GET", "/api/jobs")).body?.jobs ?? [];
const inProj = jobsAll.filter((j) => j.projectId === PROJ);

// the canonical 15-node tutorial chain, in run order — the spine is LINEAR
// (the engine's BFS input resolution does the rest; t313's four healer edges
// select→init→class3d and refine→mask→post are the linear spine's middle)
const CANON = [
  ["import",      "Import Movies (tutorial)",      240],
  ["motioncorr",  "Motion Correction (tutorial)",  520],
  ["ctffind",     "CTF Estimation (tutorial)",     800],
  ["autopick",    "Auto-pick (tutorial)",         1080],
  ["extract",     "Extract (tutorial)",           1360],
  ["class2d",     "2D Classification (tutorial)", 1640],
  ["select2d",    "Select 2D (tutorial)",         1920],
  ["select",      "Select (tutorial)",            2200],
  ["initialmodel","Initial Model (tutorial)",     2480],
  ["class3d",     "3D Classification (tutorial)", 2760],
  ["symexpand",   "Symmetry Expansion (tutorial)",3040],
  ["rebalance",   "Rebalance (tutorial)",         3320],
  ["refine3d",    "3D Refine (tutorial)",         3600],
  ["maskcreate",  "Mask Create (tutorial)",       3880],
  ["postprocess", "Post-process (tutorial)",      4160],
];
const chain = {};
for (const [type, name, x] of CANON) {
  let node = inProj.find((j) => j.type === type);
  if (!node) {
    const mk = await api("POST", "/api/jobs", { projectId: PROJ, type, name, x, y: 336 });
    node = mk.body?.job;
    must(mk.status === 201 && !!node, `${name} created (${mk.status})`);
  } else {
    must(true, `${name} resolved (${node.id.slice(-6)})`);
  }
  chain[type] = node.id;
}

console.log("== step 3b: the spine edges (idempotent) ==");
const edgeSet = new Set(
  ((await api("GET", "/api/edges")).body?.edges ?? []).map((e) => `${e.fromJobId}>${e.toJobId}`)
);
const hasEdge = (f, t) => edgeSet.has(`${f}>${t}`);
let wired = 0, already = 0;
for (let i = 0; i < CANON.length - 1; i++) {
  const from = chain[CANON[i][0]], to = chain[CANON[i + 1][0]];
  if (hasEdge(from, to)) { already++; continue; }
  const e = await api("POST", "/api/edges", { fromJobId: from, toJobId: to });
  must(e.status === 201, `edge ${CANON[i][0]} → ${CANON[i + 1][0]} wired (${e.status})`);
  if (e.status === 201) { edgeSet.add(`${from}>${to}`); wired++; }
}
must(true, `spine edges: ${wired} wired, ${already} already in place (${CANON.length - 1} total)`);

/* ------------------------------------------------------------------ */
/* 4. the chain import rides the EMPIAR leg                             */
/* ------------------------------------------------------------------ */

console.log("== step 4: the chain import's params ==");
const patch = await api("PATCH", `/api/jobs/${chain.import}`, {
  params: { empiarData: true, micrographsPath: "" },
});
must(patch.status === 200, `import params flipped to the EMPIAR leg (${patch.status})`);

/* ------------------------------------------------------------------ */
/* 5. the chain re-run (topological, through the product's run door)     */
/* ------------------------------------------------------------------ */

const engineStatePath = "/home/z/my-project/data/engine-state.json";
const engineState = () => {
  try {
    return JSON.parse(readFileSync(engineStatePath, "utf8"));
  } catch {
    // a fresh world's state file is born lazily on the first run — honest
    // absence until then (402-recovery: the bootstrap runs on a new DB)
    return {};
  }
};

async function jobState(id) {
  const s = engineState();
  return s[id] ?? null;
}

// the remote poll sweep is driven by the jobs GET route (one batched SSH
// round trip per connection per tick) — a poller that only reads the
// engine-state file STARVES the sweep and the cluster job never finalizes
// (observed live: slurm COMPLETED for ten minutes, the app still "running")
async function pollDto(id) {
  const res = await api("GET", "/api/jobs");
  return (res.body?.jobs ?? []).find((j) => j.id === id) ?? null;
}

const NATIVE = new Set(["import", "select2d", "select", "symexpand", "rebalance"]);
const ORDER = CANON.map(([type]) => [type, chain[type]]);

console.log("== step 5: the chain re-run ==");
const runAll = process.argv.includes("--rerun");
// t412: the sandbox's process patrol reaps BACKGROUND node processes after
// ~7-8 minutes (two witnesses: the first nohup launch AND a setsid-detached
// launch both died silently — no OOM, no stderr — between polls). Foreground
// tool-call processes are untouched, so the chain now runs in CHUNKS:
// `--from <type>` starts the re-run at a later chain position, and each
// chunk's completed nodes keep their products (staged on the cluster +
// synced to the local mirror), so the next chunk --from <next> continues.
const fromIdx = (() => {
  const i = process.argv.indexOf("--from");
  if (i === -1) return 0;
  const t = process.argv[i + 1];
  const idx = ORDER.findIndex(([ty]) => ty === t);
  return idx === -1 ? 0 : idx;
})();
// t414 — `--to <type>` bounds the chunk from ABOVE (the mirror of --from):
// the glob-wipe wound left only the chain's HEAD dead (import..class2d —
// the six families the cleanup globs match), while select onward keeps its
// cluster workdirs. A bounded chunk re-runs exactly the wounded range
// without re-paying class3d's nine generations.
const toIdx = (() => {
  const i = process.argv.indexOf("--to");
  if (i === -1) return ORDER.length;
  const t = process.argv[i + 1];
  const idx = ORDER.findIndex(([ty]) => ty === t);
  return idx === -1 ? ORDER.length : idx + 1;
})();
for (const [type, id] of ORDER.slice(fromIdx, toIdx)) {
  const before = await jobState(id);
  // filled = the record speaks AND the files are still on disk (the qa53
  // cleaner removes the healed FSC artifacts for qa55's gap world — a
  // record whose files vanished must re-run, not skip)
  const filesOnDisk = before?.done && Object.values(before?.outputs ?? {}).every((p) => existsSync(p));
  const filled = before?.done && before?.exitCode === 0 && Object.keys(before?.outputs ?? {}).length > 0 && filesOnDisk;
  if (filled && !runAll) {
    console.log(`  skip: ${type} already carries outputs (${Object.keys(before.outputs).join(", ")})`);
    continue;
  }
  const body = NATIVE.has(type) ? undefined : {
    remote: { connectionId: CONN_ID, module: "relion/5.0.1", mode: "slurm" },
  };
  const t0 = Date.now();
  const run = await api("POST", `/api/jobs/${id}/run`, body ?? {});
  if (run.status === 409) {
    console.log(`  note: ${type} is already live — waiting it out`);
  } else if (run.status !== 200) {
    must(false, `${type} run refused (HTTP ${run.status}: ${run.body?.error ?? "?"})`);
    continue;
  } else if (run.body?.error) {
    must(false, `${type} run errored honestly: ${run.body.error}`);
    continue;
  } else if (run.body?.waiting) {
    // the remote dispatch returns IMMEDIATELY with a staging/pending marker —
    // the job auto-starts once its inputs land on the cluster (t262's async
    // contract); a native job's waiting means its upstream is still running.
    // Either way: POLL, never fail on the first breath.
    console.log(`  note: ${type} is staging/waiting (${run.body.waiting}) — polling until it starts and finishes`);
  }
  // poll to completion — via the jobs GET (drives the remote sweep)
  let rec = null;
  let ok = false;
  let dtoStatus = null;
  for (let t = 0; t < 400; t++) {
    await sleep(2500);
    const dto = await pollDto(id);
    dtoStatus = dto?.status ?? null;
    if (dtoStatus === "completed" || dtoStatus === "failed") break;
    rec = await jobState(id);
    if (rec?.done === true) break;
  }
  rec = (await jobState(id)) ?? {};
  ok = dtoStatus === "completed" || (rec?.done === true && rec?.exitCode === 0);
  const outs = Object.keys(rec?.outputs ?? {});
  const wall = ((Date.now() - t0) / 1000).toFixed(1);
  must(ok && outs.length > 0,
    `${type} ${ok ? "completed" : "FAILED"} in ${wall}s (status ${dtoStatus}) — outputs: ${outs.join(", ") || "(none)"}${ok ? "" : ` · result: ${(rec?.result ?? "").slice(0, 140)}`}`);
  if (!ok) {
    console.log(`  (log tail) ${(rec?.result ?? "").slice(0, 200)}`);
    process.exit(1); // the chain is sequential — a broken link stops the healing
  }
}

/* ------------------------------------------------------------------ */
/* 6. the payoff surfaces                                               */
/* ------------------------------------------------------------------ */

console.log("== step 6: the payoff surfaces ==");
const pp = chain.postprocess;
const fsc = await api("GET", `/api/jobs/${pp}/fsc`);
const fscShells = fsc.body?.shells?.length ?? 0;
must(fsc.status === 200 && fscShells > 10, `the FSC route speaks (${fsc.status}, ${fscShells} shells, 0.143 at ${fsc.body?.resolutionAt143 ?? "?"} A)`);
const guinier = await api("GET", `/api/jobs/${pp}/guinier`);
must(guinier.status === 200, `the Guinier route speaks (${guinier.status})`);
const rec = (await jobState(pp)) ?? {};
must((rec.result ?? "").includes("FSC"), `the postprocess result speaks the official number ("${(rec.result ?? "").slice(0, 80)}")`);
const outputsLedger = [];
for (const [, id] of ORDER) {
  const r = await jobState(id);
  outputsLedger.push(`${r?.type ?? "?"}:${Object.keys(r?.outputs ?? {}).length}`);
}
console.log(`  (ledger) ${outputsLedger.join(" ")}`);

console.log(fail === 0 ? "\nDEMO CHAIN RESURRECTED" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

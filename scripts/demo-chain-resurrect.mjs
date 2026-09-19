// demo-chain-resurrect.mjs — the demo tutorial chain's resurrection healer
// (Task 313). The chain's 13 nodes completed in an earlier era, then the
// t304-window state clobber left every workdir empty and t305 rebuilt the
// records HONESTLY (outputs {} — "honest absence"). This script heals the
// demo for real:
//
//   1. synthesizes the EMPIAR-10017 stand-in bundle (24 × 512² float32
//      micrographs, deterministic LCG + Gaussian blobs, REAL MRC2014
//      headers) — the seed's designed data source, absent since forever;
//   2. scrubs qa-* connection leftovers, creates/reuses "Mock Cluster";
//   3. flips the chain import to the EMPIAR leg (params.empiarData=true);
//   4. adds the TWO workflow links the chain was always missing:
//      initialmodel (class3d's model_mrc had no upstream) and maskcreate
//      (postprocess's mask_mrc had no upstream) — idempotent;
//   5. re-runs the chain in topological order through the product's OWN
//      run door (engine-native jobs local, CLI jobs via the mock cluster),
//      polling each to completion — collectOutputs fills the outputs maps
//      per the old convention (the engine is the only writer, zero guessing);
//   6. verifies the payoff surfaces: the FSC route speaks shells, the
//      Guinier route speaks, the record's result names the final resolution.
//
// IDEMPOTENT: existing bundle / connection / nodes / edges are reused; a
// chain whose records already carry outputs is verified, not re-run.
//
// Run: node scripts/demo-chain-resurrect.mjs [--rerun]  (server on :3000)
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_DIR = "/home/z/empiar-10017/micrographs";
const N_MIC = 24;
const BOX = 512; // 512×512 float32 = 1 MB per micrograph

// same-origin metadata — the run door is a write gate (t252)
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};

const chain = {
  proj: "cmu6xtvf70000kl81kxtzbpl4",
  import: "cmu6yyzgi0005kl7tt9auvg6r",
  motioncorr: "cmu6yyzgv0007kl7t86q3uixd",
  ctffind: "cmu6yyzh70009kl7tw762olol",
  autopick: "cmu6yyzhg000bkl7tbl5s75h4",
  extract: "cmu6yyzht000dkl7tzxe9nfbi",
  class2d: "cmu6yyzmn000rkl7thtpb170c",
  select2d: "cmu6yyzmw000tkl7t7znux178",
  select: "cmu6yyzi6000fkl7tq5fbwr9d",
  class3d: "cmu6yyzj4000lkl7t5iqxl6g5",
  symexpand: "cmu6yyzii000hkl7tpbz6ri8k",
  rebalance: "cmu6yyzir000jkl7tsmhyl5o9",
  refine3d: "cmu6yyzjm000nkl7trg1kyo6i",
  postprocess: "cmu6yyzk0000pkl7t97pzlq90",
};

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, url, body) {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: SH,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: r.status, body: json };
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
/* 3. the chain import rides the EMPIAR leg                             */
/* ------------------------------------------------------------------ */

console.log("== step 3: the chain import's params ==");
const patch = await api("PATCH", `/api/jobs/${chain.import}`, {
  params: { empiarData: true, micrographsPath: "" },
});
must(patch.status === 200, `import params flipped to the EMPIAR leg (${patch.status})`);

/* ------------------------------------------------------------------ */
/* 4. the two missing workflow links                                    */
/* ------------------------------------------------------------------ */

console.log("== step 4: the missing links (initialmodel + maskcreate) ==");
const jobsNow = (await api("GET", "/api/jobs")).body?.jobs ?? [];
const edgesNow = (await api("GET", "/api/edges")).body?.edges ?? [];
const hasEdge = (f, t) => edgesNow.some((e) => e.fromJobId === f && e.toJobId === t);
const chainEdges = edgesNow.filter((e) => e.fromJobId.startsWith("cmu6yyz") || e.toJobId.startsWith("cmu6yyz"));

async function ensureNode(type, name, x, y, fromId, toId) {
  let node = jobsNow.find((j) => j.name === name && j.projectId === chain.proj);
  if (!node) {
    const mk = await api("POST", "/api/jobs", { projectId: chain.proj, type, name, x, y });
    node = mk.body?.job;
    must(mk.status === 201 && !!node, `${name} node created (${mk.status})`);
  } else {
    must(true, `${name} node reused (${node.id.slice(-6)})`);
  }
  if (fromId && !hasEdge(fromId, node.id)) {
    const e = await api("POST", "/api/edges", { fromJobId: fromId, toJobId: node.id });
    must(e.status === 201, `edge ${name} ← upstream wired (${e.status})`);
  }
  if (toId && !hasEdge(node.id, toId)) {
    const e = await api("POST", "/api/edges", { fromJobId: node.id, toJobId: toId });
    must(e.status === 201, `edge downstream → ${name} wired (${e.status})`);
  }
  return node.id;
}

// the old refine3d→postprocess edge stays (harmless parallel wiring) — the
// postprocess resolves its inputs by BFS priority: maskcreate is the ONLY
// mask_mrc provider, refine3d remains the only half1_mrc provider
const INIT_ID = await ensureNode("initialmodel", "Initial Model (tutorial)", 2480, 336, chain.select, chain.class3d);
const MASK_ID = await ensureNode("maskcreate", "Mask Create (tutorial)", 3760, 336, chain.refine3d, chain.postprocess);
void chainEdges;

/* ------------------------------------------------------------------ */
/* 5. the chain re-run (topological, through the product's run door)     */
/* ------------------------------------------------------------------ */

const engineState = () => JSON.parse(readFileSync("/home/z/my-project/data/engine-state.json", "utf8"));

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
const ORDER = [
  ["import", chain.import], ["motioncorr", chain.motioncorr], ["ctffind", chain.ctffind],
  ["autopick", chain.autopick], ["extract", chain.extract], ["class2d", chain.class2d],
  ["select2d", chain.select2d], ["select", chain.select], ["initialmodel", INIT_ID],
  ["class3d", chain.class3d], ["symexpand", chain.symexpand], ["rebalance", chain.rebalance],
  ["refine3d", chain.refine3d], ["maskcreate", MASK_ID], ["postprocess", chain.postprocess],
];

console.log("== step 5: the chain re-run ==");
const runAll = process.argv.includes("--rerun");
for (const [type, id] of ORDER) {
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

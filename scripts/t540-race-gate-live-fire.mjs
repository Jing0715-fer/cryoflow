/** t540 — the not-ready-upstream exam: what the product ACTUALLY does, pinned.
 *
 *  The t534 exam convicted "remote dispatch has no gate for a not-ready
 *  upstream" and its own evolution narrowed the shape. This window dug to
 *  the bedrock and found the REAL answer, which this exam pins:
 *
 *    FRONT LINE — the resolver's done-only rule. resolveInputs never
 *            resolves from a provider whose record is not
 *            done && exitCode===0 (a running provider's outputs are
 *            mid-flight, not data), and the lazy heal only probes done
 *            records. A child whose ONLY provider is running therefore
 *            PARKS ("Waiting for upstream output … runs automatically
 *            once ready") — it never races.
 *    AMBIGUITY — when a child has TWO providers (one finalized, one
 *            running), the resolver speaks for the FINALIZED one: the
 *            child runs on its output. Concurrent execution on FINALIZED
 *            data is legal (the t534 exam-leg-① shape: "B would just run
 *            on the import's star").
 *    ORDERING — the t304 afterok door is CONNECTION-SCOPED: an in-flight
 *            parent on the SAME connection contributes its slurmId to
 *            --dependency=afterok (the scheduler orders the handoff); the
 *            same parent on a RE-CREATED same-host connection (t325) does
 *            NOT (depIds never matches) — the child runs immediately, on
 *            the finalized provider's data.
 *    DEFENSE-IN-DEPTH — the twin-provenance race gate in remote-run (a
 *            not-finalized contributor's twin is refused at staging
 *            unless the scheduler orders it) is the invariant's second
 *            line: unreachable through today's resolver by design, kept
 *            so a future resolver loosening cannot silently reintroduce
 *            the stale-read race.
 *
 *  The exam plants a LIVE ctffind U (t304's surgery pattern) on connection
 *  X, wires two autopick children to BOTH the completed import and U, then:
 *    D1 on connection Y (same host, re-created) → runs on the IMPORT's
 *        star, NO dependency (the connection-scoping gap, documented);
 *    D2 on connection X (same conn)            → afterok rides U's id.
 *
 * Run: node scripts/t540-race-gate-live-fire.mjs   (server :3000, mock :3022)
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import net from "node:net";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const SH = { Origin: BASE };
const SHJ = { ...SH, "Content-Type": "application/json" };
const CONN_X = `qa-t540-race-a`;
const CONN_Y = `qa-t540-race-b`;
const MOCK_FS = `${ROOT}/services/mock-cluster/fs/projects/cryoflow`;
const createdJobs = [];
const createdConns = [];
const projectIdRef = { current: null };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
const KEEP = process.env.T540_KEEP === "1";
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
  if (!KEEP) cleanup();
  process.exit(1);
};
const ok = (cond, msg) => {
  if (!cond) fail(msg);
  pass++;
  console.log(`ok: ${msg}`);
};

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};
const writeStateRuns = (runs) => {
  const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const next = raw.runs ? { ...raw, runs } : runs;
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
};

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  const b = await r.json();
  if (b.job?.id) createdJobs.push(b.job.id);
  return b.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await fetch(`${BASE}/api/edges`, {
    method: "POST", headers: SHJ, body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
  });
  return r.status;
};
const getJobs = async () => {
  const r = await fetch(`${BASE}/api/jobs?limit=300`, { headers: SH });
  const b = await r.json();
  return Array.isArray(b) ? b : b.jobs ?? [];
};
const dispatch = async (jobId, connId, mode = "slurm") => {
  const r = await fetch(`${BASE}/api/jobs/${jobId}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode } }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const deleteConn = async (id) => {
  try {
    await fetch(`${BASE}/api/remote/connections/${id}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
};

/** plant a LIVE ctffind record on connection X — running, NO outputs (the
 *  honest shape: today's product never persists outputs into a running
 *  record; the heal only touches done records). Its slurmId is a REAL mock
 *  sbatch job so the same-connection leg's afterok is a live directive. */
function plantLiveParent(u, projectId) {
  const remoteWd = `/projects/cryoflow/${projectId}/ctffind_${u.id.slice(-8)}`;
  const localWd = `${ROOT}/data/relion/${projectId}/ctffind_${u.id.slice(-8)}`;
  mkdirSync(localWd, { recursive: true });
  mkdirSync(join(MOCK_FS, projectId, `ctffind_${u.id.slice(-8)}`), { recursive: true });

  const runs = { ...stateRuns() };
  runs[u.id] = {
    jobId: u.id, projectId, type: "ctffind", pid: null,
    cmd: "t540: planted live parent (the front line must park, not race)",
    workdir: localWd, logFile: `${localWd}/run.out`, errFile: `${localWd}/run.err`,
    startedAt: new Date().toISOString(), done: false, exitCode: null,
    outputs: {},
    remote: {
      connectionId: CONN_X, connectionName: "QA t540 Race A", host: "127.0.0.1:3022",
      user: "cryo", module: "relion/5.0.1", mode: "slurm", remoteRoot: "/projects/cryoflow",
      remoteWorkdir: remoteWd, pid: null, slurmId: "540001", phase: "running",
    },
  };
  writeStateRuns(runs);
  return { remoteWd };
}

function cleanup() {
  // the exam project's records ride the project DELETE (t272 law)
  if (projectIdRef.current) {
    try {
      execSync(
        `curl -s -X DELETE ${BASE}/api/projects/${projectIdRef.current} -H "Origin: ${BASE}"`,
        { stdio: "pipe", timeout: 15_000 }
      );
    } catch { /* best effort */ }
  }
  for (const id of createdConns) deleteConn(id);
  try { rmSync(`${ROOT}/data/relion/t540-race`, { recursive: true, force: true }); } catch { /* gone */ }
}

async function main() {
  // ---- Phase A: the world ------------------------------------------------
  ok(await mockListening(), "the mock cluster answers on :3022");
  ok((await (await fetch(`${BASE}/`, { headers: SH })).status) === 200, "the app answers on :3000");

  // two connections to the SAME host — the t325 re-created-connection shape
  for (const [id, name] of [[CONN_X, "QA t540 Race A"], [CONN_Y, "QA t540 Race B"]]) {
    const r = await fetch(`${BASE}/api/remote/connections`, {
      method: "POST", headers: SHJ,
      body: JSON.stringify({ id, name, host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }),
    });
    ok(r.status === 201, `connection ${name} created (${r.status})`);
    createdConns.push(id);
  }

  const proj = await (await fetch(`${BASE}/api/projects`, {
    method: "POST", headers: SHJ, body: JSON.stringify({ name: "QA t540 race gate" }),
  })).json();
  const projectId = proj?.project?.id ?? proj?.id ?? null;
  ok(!!projectId, `the exam project exists (${projectId ?? "none"})`);
  if (!projectId) fail("no project — the exam cannot run");
  projectIdRef.current = projectId;

  // six toy micrographs (the children never reach the binary — the exam
  // pins dispatch-time decisions — but the import leg wants real files)
  const micsDir = `${ROOT}/data/relion/t540-race/mics`;
  mkdirSync(micsDir, { recursive: true });
  for (let k = 1; k <= 6; k++) {
    const W = 64, H = 64;
    const buf = Buffer.alloc(1024 + W * H * 4);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
    buf.writeInt32LE(2, 12);
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
    for (let i = 0; i < W * H; i++) buf.writeFloatLE(0.1, 1024 + i * 4);
    writeFileSync(join(micsDir, `mic_${String(k).padStart(2, "0")}.mrc`), buf);
  }
  ok(Array.from({ length: 6 }, (_, i) => i + 1).every((k) => existsSync(join(micsDir, `mic_${String(k).padStart(2, "0")}.mrc`))),
    "six toy micrographs fabricated");

  const imp = await mkJob({ type: "import", name: "t540 Import", params: { micrographsPath: micsDir, pixelSize: 1.77 }, x: 80, y: 80 });
  const u = await mkJob({ type: "ctffind", name: "t540 CtfFind U", params: { use_given_ps: false, box: 64 }, x: 320, y: 200 });
  const d1 = await mkJob({ type: "autopick", name: "t540 Pick D1 (cross-conn)", params: { pickingMethod: "Laplacian of Gaussian" }, x: 560, y: 40 });
  const d2 = await mkJob({ type: "autopick", name: "t540 Pick D2 (same-conn)", params: { pickingMethod: "Laplacian of Gaussian" }, x: 560, y: 120 });
  ok(!!imp?.id && !!u?.id && !!d1?.id && !!d2?.id, "the exam graph exists (import, U, D1, D2)");
  // BOTH providers feed each child — the t534 exam-leg-① ambiguity: the
  // finalized import and the running U both accept the micrographs key.
  ok((await mkEdge(u.id, d1.id, "micrographs", "micrographs")) === 201, "U → D1 wired");
  ok((await mkEdge(u.id, d2.id, "micrographs", "micrographs")) === 201, "U → D2 wired");

  // the import completes (real files, real lane) — the FINALIZED provider
  const runImp = await fetch(`${BASE}/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  ok(runImp.status === 200, `the import dispatched (${runImp.status})`);
  let impDone = false;
  for (let i = 0; i < 60 && !impDone; i++) {
    await sleep(1000);
    impDone = (await getJobs()).find((j) => j.id === imp.id)?.status === "completed";
  }
  ok(impDone, "the import completed (the finalized provider exists)");
  const importStar = stateRuns()[imp.id]?.outputs?.micrographs_star ?? null;
  ok(!!importStar && existsSync(importStar), "the import's micrographs star is on disk");

  // wire the import to the children AFTER it completed (the resolver's
  // provider scan is lineage-order based; the wiring order here mirrors
  // the t304 C1 shape: a completed provider + a live parent edge)
  ok((await mkEdge(imp.id, d1.id, "micrographs", "micrographs")) === 201, "import → D1 wired (the finalized provider)");
  ok((await mkEdge(imp.id, d2.id, "micrographs", "micrographs")) === 201, "import → D2 wired");

  // plant the LIVE parent: running on conn X, honest empty outputs
  plantLiveParent(u, projectId);
  ok(stateRuns()[u.id]?.done === false && Object.keys(stateRuns()[u.id]?.outputs ?? {}).length === 0,
    "U stands planted: running on conn X, no outputs (the honest mid-flight shape)");

  // ---- Phase B: the SOLE-PROVIDER park (the front line, live) ------------
  console.log("== FRONT LINE: a child whose only provider is running PARKS ==");
  const d3 = await mkJob({ type: "autopick", name: "t540 Pick D3 (parked)", params: { pickingMethod: "Laplacian of Gaussian" }, x: 800, y: 200 });
  ok((await mkEdge(u.id, d3.id, "micrographs", "micrographs")) === 201, "U → D3 wired (U is D3's ONLY provider)");
  const disp3 = await dispatch(d3.id, CONN_X, "slurm");
  const d3Row = (await getJobs()).find((j) => j.id === d3.id);
  ok(disp3.status === 200 && !disp3.body?.error, `D3's dispatch answered 200 without error (status ${disp3.status})`);
  ok(d3Row?.status === "pending", `D3 PARKED pending (got ${d3Row?.status}) — it never raced`);
  ok(/Waiting for upstream output/i.test(String(d3Row?.result ?? "")),
    `D3's receipt speaks the honest wait (${String(d3Row?.result ?? "").slice(0, 70)}…)`);
  ok(!stateRuns()[d3.id], "D3 has NO run record (nothing staged, nothing raced)");

  // ---- Phase C: the ambiguity — the resolver speaks for the finalized ----
  console.log("== AMBIGUITY: two providers — the finalized one feeds the child ==");
  const disp1 = await dispatch(d1.id, CONN_Y, "slurm");
  ok(disp1.status === 200 && !disp1.body?.error,
    `D1 dispatched on the re-created connection (status ${disp1.status}, err=${disp1.body?.error ?? "-"})`);
  const rec1 = stateRuns()[d1.id];
  ok(!!rec1, "D1 has a run record (staging went through)");
  ok(
    !rec1?.remote?.slurmDependsOn || (rec1.remote.slurmDependsOn ?? []).length === 0,
    `D1 carries NO dependency — U is on the OTHER connection (depIds is connection-scoped: the t325 gap, documented)`
  );
  // the consumption proof: poll for the submitted script (staging is
  // async — the sbatch lands a beat after the 200), then assert the --i
  // NEVER points into U's workdir (which has no output — no mid-flight
  // byte can be born). The import's star rides the staged/upload spelling,
  // so the positive form only checks "not U".
  const script1 = await (async () => {
    const p = `${MOCK_FS}/${projectId}/autopick_${d1.id.slice(-8)}/.cf-sbatch.sh`;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      if (existsSync(p)) return readFileSync(p, "utf8");
    }
    return "";
  })();
  ok(script1.length > 0, "D1's sbatch script landed on the mock fs");
  ok(!script1.includes(`ctffind_${u.id.slice(-8)}`),
    "D1's command never points into U's workdir (the resolver spoke for the finalized provider; no mid-flight byte can be born)");
  try { await fetch(`${BASE}/api/jobs/${d1.id}/stop`, { method: "POST", headers: SHJ, body: "{}" }); } catch { /* best effort */ }

  // ---- Phase D: the t304 door on the SAME connection ----------------------
  console.log("== ORDERING: the same-connection parent rides afterok ==");
  const disp2 = await dispatch(d2.id, CONN_X, "slurm");
  ok(disp2.status === 200 && !disp2.body?.error, `D2 dispatched on conn X (status ${disp2.status})`);
  // the dependency rides the record at SUBMISSION time (staging is async)
  let rec2 = null;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    rec2 = stateRuns()[d2.id] ?? null;
    if (rec2?.remote?.slurmDependsOn?.length) break;
  }
  ok(!!rec2, "D2 has a run record (staging went through)");
  ok(
    JSON.stringify(rec2?.remote?.slurmDependsOn) === JSON.stringify(["540001"]),
    `D2's afterok names the live parent (slurmDependsOn ${JSON.stringify(rec2?.remote?.slurmDependsOn ?? null)})`
  );
  try { await fetch(`${BASE}/api/jobs/${d2.id}/stop`, { method: "POST", headers: SHJ, body: "{}" }); } catch { /* best effort */ }

  console.log(`\nT540 NOT-READY-UPSTREAM EXAM: ${pass} assertions, all pass`);
  cleanup();
  process.exit(0);
}

main().catch((e) => {
  console.error("exam crashed:", e);
  cleanup();
  process.exit(1);
});

#!/usr/bin/env node
/**
 * t325 diag — the cluster is a HOST, not a connection id; the wire outlives
 * its mirror; the pending message stops lying.
 *
 * The user's ticket (the real cluster, post-t324 — the SECOND week of the
 * same pending 2D):
 *   "还是一直pending … extraction到2d分类的连线在UI中有时会消失，
 *    但是input中的内容还在，2d还是一直pending跑不起来，
 *    还是通过cluster上运行的"
 *   — extract COMPLETED on the cluster, the 2D consumer PENDING forever,
 *   and the Extract→2D wire flickering on the canvas.
 *
 * THE ANATOMY (three defects, all reproduced live before the fix):
 *   1. CONNECTION DRIFT — every twin gate (resolveInputs' acceptance, the
 *      lazy heal's eligibility, the staging plan's identity map) compared
 *      the bare connectionId. Re-create the connection while debugging
 *      (delete + re-add the same host) and the retry sweep dispatches with
 *      the NEW id: the heal refuses the old record, the twin is refused,
 *      and the consumer pendings FOREVER over a file sitting on the very
 *      cluster it was about to run on — with the generic "Waiting for
 *      upstream output" lie on top. Reproduced: 50s of heartbeat, zero
 *      movement (the scratch receipt).
 *   2. THE LOST MIRROR — an edge lives in BOTH the DB (the ENGINE's only
 *      view: lineageFor + the pending-retry sweep query db.edge) and the
 *      sidecar file (the CANVAS' view). edgesWithPorts' self-heal
 *      rewrote the sidecar through a keep-set computed over a STALE
 *      snapshot (read before the awaited DB queries) applied to the FRESH
 *      file — an edge CONNECTED during an in-flight GET failed both filter
 *      arms and was EVICTED. Combined with a DB mirror create that failed
 *      silently (the swallowed catch in persistPortEdge), the pair ended
 *      connected NOWHERE: wire gone from the canvas, lineage EMPTY, the
 *      consumer pending with a promise ("runs automatically") that cannot
 *      fire without an edge. Non-atomic sidecar writes added the torn-read
 *      flicker (a cross-process reader parsing a half-written file →
 *      edges: [] → every sidecar wire vanishes for one response).
 *   3. THE LYING MESSAGE — "Waiting for upstream output: particles.star
 *      (run Extract first) — runs automatically once ready" fired for
 *      shapes where that advice is a lie: a lineage with NO eligible
 *      provider wired at all (the lost edge — nothing to wait for, no
 *      retry will ever fire), and a completed remote provider whose key
 *      is accounted NOWHERE (the pre-t324 record — "run Extract first"
 *      over a run that already succeeded).
 *
 * THE FIX (four blades):
 *   1. Cluster identity is (connectionId, host) — sameClusterTarget()
 *      shared by all three twin gates; a re-created connection to the
 *      same host still heals, still accepts twins, still skips staging.
 *   2. The sidecar layer: atomic writes (tmp + rename), a FRESH-read
 *      keep-set (concurrent additions always survive the self-heal), and
 *      a MIRROR BACKFILL on every read (a sidecar edge with no DB row
 *      regains it — the engine's view can never silently diverge from
 *      the canvas).
 *   3. Honest pending dialects: "No upstream job is wired that produces
 *      X — connect one…" (the lost-edge receipt) and "Upstream X
 *      completed on the cluster, but where its Y lives is not on record
 *      — send this job to the cluster…" (the pre-t324 record receipt).
 *   4. The auto-start round survives its worst member (per-id try/catch
 *      — one throwing consumer used to abort every sibling behind it).
 *
 * t325-a (the read-only review's residuals, closed):
 *   M1 — the registry-stale dialect only fires for PROBE-ABLE provider
 *        types (candidates for an accepted key) — it never promises a
 *        probe the heal cannot deliver;
 *   M2 — the poll sweep falls back to a HOST-MATCHED live connection
 *        before failing a RUNNING record (drift mid-flight no longer
 *        finalizes exitCode -1 and disqualifies the heal);
 *   L1/L2 — the tmp file is reaped on every exit path; a failing
 *        backfill is spoken;
 *   L5 — host identity is normalized (case / trailing FQDN dot; an
 *        IP-vs-DNS alias deliberately fails closed);
 *   N1 — "accounted" is existsSync-aware, agreeing with the heal's own
 *        worklist (a recorded-but-deleted file counts as unaccounted).
 *
 * PHASES:
 *  A. UNIT (bun, the engine import chain + a fixture state file) —
 *     sameClusterTarget's truth table, the host-matched twin acceptance,
 *     the foreign-host refusal, the not-wired dialect, the registry-stale
 *     dialect, the no-record base message (the surviving t324 contract).
 *  B. LIVE A — the user's ticket, end to end: the full chain on the mock
 *     cluster (import → LoG autopick → extract, the star REALLY stays
 *     behind the sync cap), surgery to the pre-t324 record, connection A
 *     deleted, connection B re-created on the SAME host, the project
 *     re-bound — then the ~20s retry heartbeat recovers the 2D through
 *     the host-matched lazy heal and it COMPLETES against the cluster
 *     copy (zero manual clicks after the opt-in).
 *  C. LIVE B — the lost mirror: wire X→Y, delete ONLY the DB row
 *     (surgery), the honest not-wired receipt on the dispatch door, then
 *     GET /api/edges backfills the mirror and the SAME dispatch door
 *     flips to the ordinary waiting message (the engine sees the edge
 *     again) — plus the log witness and the no-duplicate wire contract.
 *  D. LEDGER — every source contract pinned.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN_A = "qa-t325a";
const CONN_B = "qa-t325b";
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
const createdProjects = [];
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
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

/** the engine's own ledger, read straight off the server's state file */
const stateFile = () => path.join(ROOT, "data/engine-state.json");
const readRecord = (jobId) => {
  try {
    const st = JSON.parse(readFileSync(stateFile(), "utf8"));
    return st[jobId] ?? null;
  } catch {
    return null;
  }
};

/** the recorded launch command (what the inspector's command line shows) */
const recordedCmd = async (id) => {
  const { body } = await api(`/api/jobs/${id}/outputs`, { headers: SH });
  return String(body?.cmd ?? "");
};

/** t325 — the server log witness, read from the offset this suite started at */
const logFile = () => path.join(ROOT, "prod-3001.log");
let logStart = 0;
const logSince = () => {
  try {
    const fd = readFileSync(logFile(), "utf8");
    return fd.slice(logStart);
  } catch {
    return "";
  }
};

/** surgical DB access through the repo's own prisma client (bun + tsconfig paths). The client logs every query (log:['query']) — strip that noise before the verdict. */
const dbSurgery = (prog) => {
  const r = spawnSync(
    "bun",
    ["-e", `process.env.DATABASE_URL = "file:${ROOT}/db/cryoflow.db";\n${prog}`],
    { cwd: ROOT, encoding: "utf8", timeout: 60_000 }
  );
  const lines = `${r.stdout ?? ""}${r.stderr ?? ""}`
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("prisma:"));
  return lines.join("\n").trim();
};

const mrcHdr = (() => {
  const b = Buffer.alloc(64);
  b.writeInt32LE(1024, 0);
  b.writeInt32LE(1024, 4);
  b.writeInt32LE(1, 8); // NZ=1 — single-section
  b.writeInt32LE(2, 12);
  return b.toString("base64");
})();

let projectId = null;

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");
  try {
    logStart = readFileSync(logFile(), "utf8").length;
  } catch {
    logStart = 0;
  }

  const mkConn = (id, name) =>
    api("/api/remote/connections", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({
        id,
        name,
        host: "127.0.0.1",
        port: 3022,
        username: "cryo",
        password: "demo",
        authMethod: "password",
        remoteRoot: "/projects/cryoflow",
        maxFileMb: 1, // the tight cap: the padded star (1.4 MB) REALLY stays behind
        maxTotalMb: 16,
      }),
    });
  const mkA = await mkConn(CONN_A, "QA t325 A (original)");
  must(mkA.status === 200 || mkA.status === 201, `the original connection upserts (${mkA.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t325 drift chain", mode: "remote", remoteConnectionId: CONN_A }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  if (projectId) createdProjects.push(projectId);
  must(!!projectId, "the project id rides the response");

  // the mock's star-pad lever: extract writes a VALID star padded past the
  // per-file cap with comment lines (every parser in the family skips #)
  client("echo 1 > ~/.cf-mock-star-pad");
  must(
    client("test -e ~/.cf-mock-star-pad && echo ARMED").includes("ARMED"),
    "the star-pad lever arms in the mock HOME"
  );

  // ======================================================================
  console.log("== PHASE A: UNIT — cluster identity + the honest dialects ==");

  const unit = (() => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "t325-unit-"));
    const mkRec = (over = {}) => ({
      jobId: "j1",
      projectId: "pA",
      type: "extract",
      pid: null,
      cmd: "x",
      workdir: path.join(tmp, "extract_w"),
      logFile: path.join(tmp, "extract_w/run.out"),
      errFile: path.join(tmp, "extract_w/run.err"),
      startedAt: "2026-09-20T00:00:00.000Z",
      outputs: {},
      done: true,
      exitCode: 0,
      remote: {
        connectionId: "cA",
        connectionName: "original",
        host: "h:22",
        user: "u",
        module: "",
        mode: "slurm",
        remoteRoot: "/home/u/cryoflow",
        remoteWorkdir: "/home/u/cryoflow/pA/extract_00000001",
        pid: null,
        slurmId: "1",
        phase: "running",
        remoteOutputs: { particles_star: "/home/u/cryoflow/pA/extract_00000001/particles.star" },
      },
      ...over,
    });
    const state = {
      // the drift record: twins recorded under the ORIGINAL connection
      jDrift: mkRec(),
      // the registry-stale record: completed remotely, key accounted NOWHERE
      jStale: mkRec({ remote: { ...mkRec().remote, remoteOutputs: undefined } }),
      // t325-a (M1): a candidate-LESS provider type (select has no
      // REMOTE_OUTPUT_CANDIDATES entries) — the registry-stale dialect
      // must NOT promise a probe it cannot deliver
      jSelect: mkRec({
        type: "select",
        remote: { ...mkRec().remote, remoteOutputs: undefined },
      }),
      // t325-a (N1): recorded-but-deleted local copy + no twin — "accounted"
      // must be existsSync-aware, agreeing with the heal's own worklist
      jGhostFile: mkRec({
        outputs: { particles_star: path.join(tmp, "gone", "particles.star") },
        remote: { ...mkRec().remote, remoteOutputs: undefined },
      }),
    };
    writeFileSync(path.join(tmp, "engine-state.json"), JSON.stringify(state));
    const prog = `
process.env.CRYOFLOW_DATA_DIR = ${JSON.stringify(tmp)};
const m = await import(${JSON.stringify(path.join(ROOT, "src/lib/relion/engine.ts"))});
const up = (id, type, status) => ({ id, type, status, name: "Particle Extraction 1" });
const out = {};
out.identity = {
  sameId: m.sameClusterTarget({ connectionId: "cA", host: "h:22" }, { connectionId: "cA" }),
  driftSameHost: m.sameClusterTarget({ connectionId: "cA", host: "h:22" }, { connectionId: "cB", host: "h:22" }),
  driftOtherHost: m.sameClusterTarget({ connectionId: "cA", host: "h:22" }, { connectionId: "cB", host: "OTHER:22" }),
  driftNoHost: m.sameClusterTarget({ connectionId: "cA", host: "h:22" }, { connectionId: "cB" }),
  bare: m.sameClusterTarget({ connectionId: "cA", host: "h:22" }, {}),
  normCase: m.sameClusterTarget({ connectionId: "cA", host: "Brain2." }, { connectionId: "cB", host: "brain2" }),
  normAlias: m.sameClusterTarget({ connectionId: "cA", host: "10.0.0.9:22" }, { connectionId: "cB", host: "cluster9:22" }),
};
out.remoteSameHost = m.resolveInputs("class2d", [up("jDrift", "extract", "completed")], undefined, { remote: true, connectionId: "cB", host: "h:22" });
out.remoteOtherHost = m.resolveInputs("class2d", [up("jDrift", "extract", "completed")], undefined, { remote: true, connectionId: "cB", host: "OTHER:22" });
out.remoteForeignNoHost = m.resolveInputs("class2d", [up("jDrift", "extract", "completed")], undefined, { remote: true, connectionId: "cB" });
out.notWired = m.resolveInputs("class2d", []);
out.registryStale = m.resolveInputs("class2d", [up("jStale", "extract", "completed")]);
out.registryStaleNoCandidates = m.resolveInputs("class2d", [up("jSelect", "select", "completed")]);
out.registryStaleGhostFile = m.resolveInputs("class2d", [up("jGhostFile", "extract", "completed")]);
out.base = m.resolveInputs("class2d", [up("jNothing", "extract", "completed")]);
console.log("CFUNIT" + JSON.stringify(out));
`;
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    rmSync(tmp, { recursive: true, force: true });
    if (r.status !== 0) return { error: (r.stderr ?? "").slice(0, 300) };
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("CFUNIT"));
    try {
      return JSON.parse(line.slice("CFUNIT".length));
    } catch {
      return { error: `parse: ${String(r.stdout).slice(0, 200)}` };
    }
  })();

  must(!unit.error, `the unit leg imports the engine cleanly (${unit.error ?? "ok"})`);
  if (!unit.error) {
    const idt = unit.identity ?? {};
    must(
      idt.sameId === true && idt.bare === true,
      "sameClusterTarget: the same connection (and the bare flavor) always pass"
    );
    must(
      idt.driftSameHost === true,
      "sameClusterTarget: a DIFFERENT connection id on the SAME host passes (the drift fix)"
    );
    must(
      idt.driftOtherHost === false && idt.driftNoHost === false,
      "sameClusterTarget: a different host (or no host to compare) still refuses"
    );
    must(
      unit.remoteSameHost?.missing == null &&
        unit.remoteSameHost?.inputs?.particles_star === "/home/u/cryoflow/pA/extract_00000001/particles.star",
      "REMOTE lane: the twin resolves through a RE-CREATED connection to the same host (the user's ticket, unit-level)"
    );
    must(
      /ran on a different cluster/.test(String(unit.remoteOtherHost?.missing)),
      "REMOTE lane: a genuinely different host is refused with the cross-cluster story"
    );
    must(
      /ran on a different cluster/.test(String(unit.remoteForeignNoHost?.missing)),
      "REMOTE lane: a foreign connection with no host to compare keeps the t324 refusal"
    );
    must(
      String(unit.notWired?.missing) ===
        "No upstream job is wired that produces particles.star — connect one (drag a wire from its output port to this job); it then starts automatically once its inputs are ready",
      "the LOST-EDGE dialect: an empty lineage speaks 'connect one' instead of the auto-start promise"
    );
    must(
      /completed on the cluster \(h\), but where its particles\.star lives is not on record/.test(
        String(unit.registryStale?.missing)
      ) &&
        /connect a cluster profile for h/.test(String(unit.registryStale?.missing)),
      "the REGISTRY-STALE dialect (LOCAL lane, NO live route): a completed remote run with an unaccounted key names the host and the door — t328 retired the local lane's 'send this job to the cluster' click-imperative (a promise that lane never kept)"
    );
    must(
      String(unit.base?.missing) ===
        "Waiting for upstream output: particles.star (run Extract first) — runs automatically once ready",
      "the NO-RECORD base message survives verbatim (the t324 contract — nothing anywhere, the honest ceiling)"
    );
    must(
      idt.normCase === true,
      "t325-a: host normalization — case + trailing FQDN dot never block a genuine re-creation (Brain2. === brain2)"
    );
    must(
      idt.normAlias === false,
      "t325-a: an IP-vs-DNS alias still FAILS CLOSED into the cross-cluster refusal (the honest side of the miss)"
    );
    must(
      String(unit.registryStaleNoCandidates?.missing) ===
        "Waiting for upstream output: particles.star (run Extract first) — runs automatically once ready",
      "t325-a (M1): a candidate-LESS provider type (select) keeps the generic message — the registry-stale dialect never promises a probe the heal cannot deliver"
    );
    must(
      /completed on the cluster \(h\), but where its particles\.star lives is not on record/.test(
        String(unit.registryStaleGhostFile?.missing)
      ),
      "t325-a (N1): a RECORDED-but-deleted local copy counts as unaccounted (existsSync-aware — the message and the heal's worklist agree)"
    );
  }

  // ---- t325-a (L3): a BEHAVIORAL unit for the atomic sidecar write ------
  // The ledger pins the source shape; this drives the real function: two
  // upserts through edge-ports' own writePortFile, then the file must
  // PARSE, carry BOTH edges, and leave ZERO .tmp debris behind.
  const sidecarUnit = (() => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "t325-sc-"));
    const prog = `
process.env.CRYOFLOW_DATA_DIR = ${JSON.stringify(tmp)};
const ep = await import(${JSON.stringify(path.join(ROOT, "src/lib/edge-ports.ts"))});
const now = new Date().toISOString();
ep.upsertFileEdge({ id: "e1", projectId: "p1", fromJobId: "a", toJobId: "b", createdAt: now });
ep.upsertFileEdge({ id: "e2", projectId: "p1", fromJobId: "b", toJobId: "c", createdAt: now });
const fs = await import("node:fs");
const path = await import("node:path");
const parsed = JSON.parse(fs.readFileSync(path.join(${JSON.stringify(tmp)}, "edge-ports.json"), "utf8"));
const debris = fs.readdirSync(${JSON.stringify(tmp)}).filter((f) => f.includes(".tmp-"));
console.log("CFSC" + JSON.stringify({ edges: (parsed.edges ?? []).map((e) => e.id), debris }));
`;
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    const out = {
      error: r.status !== 0 ? (r.stderr ?? "").slice(0, 300) : null,
      raw: r.stdout ?? "",
    };
    rmSync(tmp, { recursive: true, force: true });
    if (out.error) return out;
    const line = out.raw.split("\n").find((l) => l.startsWith("CFSC"));
    try {
      return JSON.parse(line.slice("CFSC".length));
    } catch {
      return { error: `parse: ${out.raw.slice(0, 200)}` };
    }
  })();
  must(!sidecarUnit.error, `the sidecar unit imports edge-ports cleanly (${sidecarUnit.error ?? "ok"})`);
  if (!sidecarUnit.error) {
    must(
      JSON.stringify(sidecarUnit.edges) === JSON.stringify(["e1", "e2"]),
      "t325-a (L3): two upserts land BOTH edges in a PARSEABLE sidecar file (the atomic write's behavioral pin)"
    );
    must(
      JSON.stringify(sidecarUnit.debris) === JSON.stringify([]),
      "t325-a (L1): ZERO .tmp debris after the writes (every exit path reaps the tmp file)"
    );
  }

  // ======================================================================
  console.log("== PHASE B: LIVE A — connection drift, the retry heartbeat recovers ==");

  const fx = clientBoth(
    "mkdir -p /data2/t325-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t325-mic.mrc; ` +
      "for i in $(seq 1 4); do cp /tmp/.t325-mic.mrc /data2/t325-mics/mic_$(printf %02d $i).mrc; done"
  );
  must(fx === "", `the 4 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t325 import",
    params: {
      micrographsPath: Array.from({ length: 4 }, (_, i) => `/data2/t325-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!importJob?.id, "the import job creates");
  await api(`/api/jobs/${importJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneImport = await awaitJobTerminal(importJob.id, 90_000);
  must(doneImport?.status === "completed", `the import completes (${doneImport?.status})`);

  const autopickJob = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t325 autopick LoG",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractJob = await mkJob({
    projectId,
    type: "extract",
    name: "QA t325 extract",
    params: { boxSize: 128 },
  });
  const clsJob = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t325 class2d",
    params: { iterations: 2 },
  });
  must(
    !!autopickJob?.id && !!extractJob?.id && !!clsJob?.id,
    "the autopick/extract/class2d jobs create"
  );
  const eAP = await mkEdge(importJob.id, autopickJob.id, "micrographs", "micrographs");
  const eEXm = await mkEdge(importJob.id, extractJob.id, "micrographs", "micrographs");
  const eEXc = await mkEdge(autopickJob.id, extractJob.id, "coords", "coords");
  const eCL = await mkEdge(extractJob.id, clsJob.id, "particles", "particles");
  must(
    [eAP, eEXm, eEXc, eCL].every((s) => s === 200 || s === 201),
    `the DAG wires import → autopick → extract → class2d (${eAP}/${eEXm}/${eEXc}/${eCL})`
  );

  // extract opts in (auto-starts when autopick lands, through the passthrough)
  await dispatch(extractJob.id, { local: true });

  const dispatchAP = await dispatch(autopickJob.id, {
    remote: { connectionId: CONN_A, module: MODULE, mode: "slurm", gpus: 1 },
  });
  must(dispatchAP.status >= 200 && dispatchAP.status < 300, `the LoG autopick dispatch answers (${dispatchAP.status})`);
  must(!dispatchAP.body?.error, `the LoG autopick is ACCEPTED (${String(dispatchAP.body?.error ?? "").slice(0, 100)})`);
  const doneAP = await awaitJobTerminal(autopickJob.id, 180_000);
  must(doneAP?.status === "completed", `the LoG autopick completes (${doneAP?.status})`);

  const doneEx = await awaitJobTerminal(extractJob.id, 240_000);
  must(
    doneEx?.status === "completed",
    `the extract auto-starts and completes via the passthrough (${doneEx?.status}: ${String(doneEx?.result ?? "").slice(0, 110)})`
  );
  must(
    /stayed on the cluster \(verified there\)/.test(String(doneEx?.result ?? "")),
    "the extract receipt says the star STAYED on the cluster (verified there)"
  );

  // ---- surgery: the pre-t324 record (no twins, no stamp, no local copy) --
  const exRec = readRecord(extractJob.id);
  must(!!exRec?.remote, "the extract record is in the ledger");
  const localStar = path.join(String(exRec?.workdir ?? ""), "particles.star");
  rmSync(localStar, { force: true });
  {
    const st = JSON.parse(readFileSync(stateFile(), "utf8"));
    const rec = st[extractJob.id];
    rec.outputs = {};
    delete rec.remote.remoteOutputs;
    delete rec.remote.outputProbeAt;
    writeFileSync(stateFile(), JSON.stringify(st, null, 2));
  }
  must(!existsSync(localStar), "surgery: the local star is gone (the pre-t324 stay-behind shape)");
  must(
    readRecord(extractJob.id)?.remote?.remoteOutputs == null,
    "surgery: the record lost its twins (the pre-t324 ledger)"
  );

  // ---- THE DRIFT: connection A dies, connection B (SAME HOST) takes over -
  const del = await api(`/api/remote/connections/${CONN_A}`, { method: "DELETE", headers: SH });
  must(del.status === 200 || del.status === 204, `the original connection deletes (${del.status})`);
  const mkB = await mkConn(CONN_B, "QA t325 B (re-created)");
  must(mkB.status === 200 || mkB.status === 201, `the re-created connection upserts (${mkB.status})`);
  const rebind = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: SHJ,
    body: JSON.stringify({ remoteConnectionId: CONN_B }),
  });
  must(rebind.status >= 200 && rebind.status < 300, `the project re-binds to the new connection (${rebind.status})`);

  // the consumer opts in through the LOCAL door (the user's manual Run
  // click on the pending 2D): the registry-stale dialect — honest about a
  // completed run whose key is unaccounted, pointing at the cluster door
  const pendCls = await dispatch(clsJob.id, { local: true });
  must(pendCls.body?.waiting === "not-ready", "the class2d pendings through the local door (not-ready)");
  const msgCls = String(pendCls.body?.job?.result ?? pendCls.body?.error ?? "");
  must(
    /completed on the cluster, but where its particles\.star lives is not on record/.test(msgCls) &&
      /starts by itself on 127\.0\.0\.1 on the next retry heartbeat/.test(msgCls),
    "the local door speaks the registry-stale dialect — t328: a LIVE profile reaches the record's host, so the promise is the HEARTBEAT's own dispatch (no 'run Extract first' lie, no click-imperative either)"
  );
  must(
    !/Waiting for upstream output: particles\.star \(run Extract first\)/.test(msgCls),
    "the generic lie is GONE for the drift shape (the message the user stared at for two weeks)"
  );

  // ---- the retry heartbeat: nobody dispatches this job again — the ~20s
  // sweep fires the auto-start through the PROJECT binding (connection B),
  // the host-matched lazy heal probes the cluster, and the job must
  // COMPLETE against the cluster copy. Under the pre-t325 code this poll
  // watched a pending row FOREVER (the scratch receipt: 50s, zero movement).
  const doneCls = await awaitJobTerminal(clsJob.id, 300_000);
  must(
    doneCls?.status === "completed",
    `the class2d COMPLETES via the retry sweep + the host-matched heal (${doneCls?.status}: ${String(doneCls?.result ?? "").slice(0, 110)})`
  );

  const exRecAfter = readRecord(extractJob.id);
  const twinHealed = String(exRecAfter?.remote?.remoteOutputs?.particles_star ?? "");
  must(
    /particles\.star$/.test(twinHealed),
    "the heal PATCHED the drifted record: the twin is back on the ledger (through the re-created connection)"
  );
  must(
    exRecAfter?.remote?.outputProbeAt != null,
    "the heal stamped outputProbeAt (the negative-probe rate limit is armed)"
  );
  const cmdCls = await recordedCmd(clsJob.id);
  must(
    twinHealed.length > 0 &&
      new RegExp(`--i ${twinHealed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(cmdCls),
    `the class2d's recorded command consumes the healed twin (--i ${twinHealed})`
  );
  must(
    !existsSync(localStar),
    "the heal NEVER re-downloads — the local mirror still has no particles.star"
  );

  // the server's own log tells the same story
  const log = logSince();
  must(
    /remote passthrough recovered a live same-host connection \("QA t325 B \(re-created\)"\) for "QA t325 extract"/.test(log) &&
      /its recorded profile "QA t325 A \(original\)" is gone, the cluster itself is not \(t328\)/.test(log),
    "t328: the server log witnessed the SAME-HOST PASSTHROUGH RECOVERY (the drift no longer drops the target — the wire outlives its mirror at the target door too)"
  );
  must(
    /probing 1 upstream record\(s\) on 127\.0\.0\.1 .*t324 heal/.test(log) &&
      /verified on the cluster \(t324\)/.test(log),
    "the server log witnessed the host-matched lazy heal + its verdict"
  );

  // disarm the pad lever — LIVE B wants nothing skewed
  client("rm -f ~/.cf-mock-star-pad");
  must(
    !client("test -e ~/.cf-mock-star-pad && echo ARMED").includes("ARMED"),
    "the star-pad lever disarms"
  );

  // ======================================================================
  console.log("== PHASE C: LIVE B — the lost mirror, the backfill, the honest dialect ==");

  // a fresh pair, wired through the REAL door (sidecar + DB mirror)
  const provJob = await mkJob({
    projectId,
    type: "extract",
    name: "QA t325 extract (mirror probe)",
    params: { boxSize: 128 },
  });
  const consJob = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t325 class2d (mirror probe)",
    params: { iterations: 2 },
  });
  must(!!provJob?.id && !!consJob?.id, "the mirror-probe jobs create");
  const eWire = await mkEdge(provJob.id, consJob.id, "particles", "particles");
  must(eWire === 200 || eWire === 201, `the pair wires through the real door (${eWire})`);

  // surgery: ONLY the DB row dies (the mirror-loss shape: a failed create,
  // a manual edit — the sidecar entry survives)
  const cut = dbSurgery(`
const { db } = await import("${ROOT}/src/lib/db.ts");
const n = await db.edge.deleteMany({ where: { fromJobId: "${provJob.id}", toJobId: "${consJob.id}" } });
console.log("CUT" + n.count);
`);
  must(/^CUT1$/.test(cut), `surgery: exactly the DB mirror row dies (${cut.slice(0, 80)})`);

  // the dispatch door BEFORE the backfill: the engine is edge-blind — the
  // honest LOST-EDGE dialect (the user's "the wire disappeared" receipt)
  const pendBlind = await dispatch(consJob.id, { local: true });
  must(pendBlind.body?.waiting === "not-ready", "the blind dispatch pendings (not-ready)");
  const msgBlind = String(pendBlind.body?.job?.result ?? pendBlind.body?.error ?? "");
  must(
    msgBlind ===
      "No upstream job is wired that produces particles.star — connect one (drag a wire from its output port to this job); it then starts automatically once its inputs are ready",
    "the blind door speaks the LOST-EDGE dialect (nothing is wired — no auto-start promise over an empty lineage)"
  );

  // the canvas still draws the wire (the sidecar entry renders) AND exactly
  // one wire for the pair (no duplicate from the merged view)
  const edgesBlind = await api("/api/edges", { headers: SH });
  const pairBlind = (edgesBlind.body?.edges ?? []).filter(
    (e) => e.fromJobId === provJob.id && e.toJobId === consJob.id
  );
  must(pairBlind.length === 1, `the canvas still draws the wire (sidecar renders, ${pairBlind.length} for the pair)`);

  // the backfill: ANY read of the edge layer repairs the engine's mirror
  const edgesHealed = await api("/api/edges", { headers: SH });
  const pairHealed = (edgesHealed.body?.edges ?? []).filter(
    (e) => e.fromJobId === provJob.id && e.toJobId === consJob.id
  );
  must(pairHealed.length === 1, "after the backfill read: still exactly ONE wire (no duplicate)");
  const backCount = dbSurgery(`
const { db } = await import("${ROOT}/src/lib/db.ts");
const rows = await db.edge.findMany({ where: { fromJobId: "${provJob.id}", toJobId: "${consJob.id}" } });
console.log("ROWS" + rows.length);
`);
  must(
    /^ROWS1$/.test(backCount),
    `the DB mirror is BACK after one read (the backfill healed the engine's view — ${backCount.slice(0, 60)})`
  );

  // the SAME dispatch door now sees the upstream: the message flips from
  // "nothing is wired" to the ordinary waiting dialect (the engine's
  // lineage resolved through the restored row)
  const pendSeen = await dispatch(consJob.id, { local: true });
  const msgSeen = String(pendSeen.body?.job?.result ?? pendSeen.body?.error ?? "");
  must(
    /Waiting for upstream output: particles\.star/.test(msgSeen) &&
      !/No upstream job is wired/.test(msgSeen),
    "after the backfill: the dispatch door sees the upstream again (the ordinary waiting dialect)"
  );
  must(
    new RegExp(`backfilled the DB mirror for ${provJob.id}\u2192${consJob.id}`).test(
      logSince()
    ),
    "the server log witnessed the backfill (edge-ports: backfilled the DB mirror … t325 heal)"
  );

  // ======================================================================
  console.log("== PHASE D: LEDGER — the source contracts, pinned ==");

  const engineSrc = readFileSync(path.join(ROOT, "src/lib/relion/engine.ts"), "utf8");
  const remoteSrc = readFileSync(path.join(ROOT, "src/lib/remote/remote-run.ts"), "utf8");
  const edgePortsSrc = readFileSync(path.join(ROOT, "src/lib/edge-ports.ts"), "utf8");
  const dispatchSrc = readFileSync(path.join(ROOT, "src/lib/relion/dispatch.ts"), "utf8");

  must(
    /export function sameClusterTarget/.test(engineSrc) &&
      /opts\.host != null &&\s*\n\s*normalizeClusterHost\(rec\.host\) === normalizeClusterHost\(opts\.host\)/.test(engineSrc),
    "cluster identity is (connectionId, host) — the shared predicate with the (normalized) host arm"
  );
  must(
    /sameClusterTarget\(twinRemote, opts\)/.test(engineSrc) &&
      /registryStale/.test(engineSrc),
    "resolveInputs: the twin gate rides the shared predicate; the registry-stale shape is tracked"
  );
  must(
    /No upstream job is wired that produces/.test(engineSrc),
    "the lost-edge dialect lives in the engine (providers-empty branch)"
  );
  must(
    /completed on the cluster, but where its/.test(engineSrc) &&
      /lives is not on record/.test(engineSrc),
    "the registry-stale dialect lives in the engine (the pre-t324-record receipt)"
  );
  must(
    /const connHostPort = `\$\{conn\.host\}:\$\{conn\.port\}`/.test(remoteSrc) &&
      /sameClusterTarget\(st\.remote, \{ connectionId: target\.connectionId, host: connHostPort \}\)/.test(remoteSrc),
    "the lazy heal's eligibility rides the host-matched predicate (the drift fix)"
  );
  must(
    /sameClusterTarget\(rec\.remote, \{ connectionId: conn\.id, host: connHostPort \}\)/.test(remoteSrc),
    "the staging plan's identity-twin map rides the same predicate"
  );
  must(
    /renameSync\(tmp, FILE\)/.test(edgePortsSrc) && /\.tmp-/.test(edgePortsSrc),
    "sidecar writes are ATOMIC (tmp + rename — no torn reads across processes)"
  );
  must(
    /const fresh = readPortFile\(\)/.test(edgePortsSrc) &&
      /const keepIds = new Set/.test(edgePortsSrc) === false,
    "the self-heal filters a FRESH read (the stale keep-set eviction is extinct)"
  );
  must(
    /backfilled the DB mirror/.test(edgePortsSrc) &&
      /const unmirrored = liveEdges\.filter/.test(edgePortsSrc),
    "the mirror backfill heals the engine's view on every edge-layer read"
  );
  must(
    /DB mirror create failed/.test(edgePortsSrc),
    "a failed mirror create is SPOKEN (no more silent engine-blindness)"
  );
  must(
    /the round continues/.test(dispatchSrc),
    "the auto-start round survives a throwing consumer (per-id isolation)"
  );
  // ---- t325-a (the review's residuals), pinned -------------------------
  must(
    /export function normalizeClusterHost/.test(engineSrc) &&
      /normalizeClusterHost\(rec\.host\) === normalizeClusterHost\(opts\.host\)/.test(engineSrc),
    "t325-a (L5): host identity is NORMALIZED (case / trailing FQDN dot) on both sides of the gate"
  );
  must(
    /REMOTE_OUTPUT_CANDIDATES\[up\.type\] \?\? \[\]\)\.some\(\(c\) =>/.test(engineSrc) &&
      /!\(state\.outputs\[k\] && existsSync\(state\.outputs\[k\]\)\)/.test(engineSrc),
    "t325-a (M1+N1): the registry-stale dialect only fires for PROBE-ABLE provider types, with an existsSync-aware 'accounted' (agreeing with the heal's worklist)"
  );
  must(
    /loadConnections\(\)\.find\(/.test(remoteSrc) &&
      /normalizeClusterHost\(`\$\{c\.host\}:\$\{c\.port\}`\) === wanted/.test(remoteSrc) &&
      /the run keeps its life/.test(remoteSrc),
    "t325-a (M2): the poll sweep falls back to a HOST-MATCHED live connection before failing a RUNNING record (drift no longer disqualifies the heal)"
  );
  must(
    /} finally \{\s*\n\s*rmSync\(tmp, \{ force: true \}\)/.test(edgePortsSrc),
    "t325-a (L1): the tmp file is reaped on EVERY exit path (no debris)"
  );
  must(
    /DB mirror backfill failed/.test(edgePortsSrc),
    "t325-a (L2): a failing backfill is SPOKEN (no silent forever-retry)"
  );

  console.log(fail === 0 ? "\n== t325 diag: ALL GREEN ==" : `\n== t325 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side shells + the levers ----
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  for (const pid of [projectId]) {
    if (!pid) continue;
    try {
      client(`rm -rf /projects/cryoflow/${pid}`);
    } catch { /* the jobs DELETE already dropped the local twin */ }
    try {
      rmSync(path.join(ROOT, "data/relion", pid), { recursive: true, force: true });
    } catch { /* may not exist */ }
    await api(`/api/projects/${pid}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  try {
    client("rm -rf /data2/t325-mics /tmp/.t325-mic.mrc ~/.cf-mock-star-pad");
  } catch { /* fixtures are runtime, gitignored */ }
  for (const c of [CONN_A, CONN_B]) {
    await api(`/api/remote/connections/${c}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
}

process.exit(fail === 0 ? 0 : 1);

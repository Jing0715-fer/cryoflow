#!/usr/bin/env node
/**
 * t328 diag — the heartbeat heals on its own: the probe's outcome becomes
 * information, and the drift no longer beheads the dispatch target.
 *
 * The user's ticket (the real cluster, post-t325 — the THIRD week of the
 * same pending 2D, now wearing the honest dialect):
 *   "Waiting as pending
 *    Upstream "Particle Extraction 1" completed on the cluster, but where
 *    its particles.star lives is not on record — send this job to the
 *    cluster (the dispatch probes the upstream's workdir there and chains
 *    off the copy in place), or re-run the upstream to refresh its record
 *    The job did not fail — it starts AUTOMATICALLY the moment its
 *    upstream inputs are ready. No further clicks needed."
 *
 * THE ANATOMY (why the honest dialect still hung): the message is written
 * by a dispatch attempt that did NOT heal, and the message NEVER CHANGES
 * regardless of why. Three field shapes produce exactly this receipt:
 *   1. THE DOUBLY-DEAD TARGET — the passthrough door still matched the
 *      trigger's connection by BARE ID (t317's hard fork). After drift
 *      (delete + re-add the same cluster) with a stale project binding,
 *      BOTH refs are dead: the passthrough drops, the project fallback
 *      nulls, and every ~20s heartbeat dispatched the 2D LOCALLY over
 *      inputs that only exist on the cluster — the local lane has NO
 *      lazy heal, so the row pendings forever, rewriting a message whose
 *      advice ("send this job to the cluster") the app was never going to
 *      act on itself. The banner's "No further clicks needed" and the
 *      dialect's "send this job" contradicted each other in the same box.
 *   2. THE SILENT VERDICT — when the probe DID run (live target) and
 *      found NOTHING (the workdir genuinely lacks the file), the record
 *      stamped outputProbeAt and the message stayed VERBATIM: "the
 *      dispatch probes the upstream's workdir" — over a probe that had
 *      already run and come back empty. The user cannot tell "not there"
 *      from "never checked" from "cannot reach the cluster"; every
 *      heartbeat delivers zero new information (days of it).
 *   3. THE UNREACHABLE PROBE — an SSH blip during the heal left no stamp,
 *      no twin, and the same message — the probe's FAILURE was invisible.
 *
 * THE FIX (three blades):
 *   1. sameClusterTarget's doctrine lands at the TARGET DOOR: the
 *      passthrough recovers a LIVE same-host connection when the record's
 *      own profile is gone (trigger conn → same-host conn → project
 *      binding → local). The doubly-dead shape now dispatches to the
 *      cluster and heals by itself.
 *   2. The probe's verdict is PERSISTED and SPOKEN: outputProbeAbsent on
 *      the record (per-key, cleared on re-find) drives a NEW dialect —
 *      "not in its workdir on <host> either (checked there) — the output
 *      is genuinely gone; re-run the upstream to regenerate it".
 *   3. The LOCAL lane stopped promising probes it never runs: with a live
 *      route to the record's host it promises the HEARTBEAT ("this job
 *      starts by itself on <host> on the next retry heartbeat"); with no
 *      route it names the door ("connect a cluster profile for <host>").
 *      A probe that could not RUN at all appends the honest suffix
 *      ("the cluster could not be reached to check just now; the retry
 *      heartbeat tries again by itself").
 *
 * PHASES:
 *  A. UNIT — liveConnectionForHost's truth table + the dialect matrix
 *     (registry-stale local/remote/absent, stay-behind local
 *     route/no-route, stay-behind remote cross-cluster).
 *  B. LIVE A — the user's doubly-dead receipt, end to end: the full chain
 *     on the mock (import → LoG autopick → extract, the star stays behind
 *     the sync cap), surgery to the pre-t324 record, connection A
 *     deleted, connection B re-created on the SAME host, the project
 *     binding left STALE (pointing at the dead A) — the exact shape that
 *     dispatched locally forever under pre-t328 code. The ~20s retry
 *     heartbeat recovers the same-host target, probes, and the 2D
 *     COMPLETES against the cluster copy (zero manual clicks).
 *  C. LIVE B — the absent verdict: the mock-side star moves aside, the
 *     heal probes, the pending message flips to "checked there — the
 *     output is genuinely gone" with outputProbeAbsent persisted, the log
 *     says "verified ABSENT"; the star moves BACK, the stamp ages out
 *     (surgery compresses the 10-minute window), the re-probe re-finds
 *     it, the absent list clears, and the job completes.
 *  D. LIVE C — the unreachable probe: the mock cluster STOPS, the heal's
 *     probe cannot run, the message gains the honest suffix; the mock
 *     restarts, the unstamped probe retries by itself, and the job
 *     completes.
 *  E. LEDGER — every source contract pinned.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN_A = "qa-t328a";
const CONN_B = "qa-t328b";
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
let projectId = null;
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

/** surgery on the engine's ledger: regress a record to the pre-t324 shape */
const surgeryPreT324 = (jobId) => {
  const st = JSON.parse(readFileSync(stateFile(), "utf8"));
  const rec = st[jobId];
  rec.outputs = {};
  delete rec.remote.remoteOutputs;
  delete rec.remote.outputProbeAt;
  delete rec.remote.outputProbeAbsent;
  writeFileSync(stateFile(), JSON.stringify(st, null, 2));
};

/** surgery: age the probe stamp out (compress the 10-minute freshness window) */
const surgeryAgeStamp = (jobId) => {
  const st = JSON.parse(readFileSync(stateFile(), "utf8"));
  const rec = st[jobId];
  delete rec.remote.outputProbeAt;
  writeFileSync(stateFile(), JSON.stringify(st, null, 2));
};

/** the recorded launch command (what the inspector's command line shows) */
const recordedCmd = async (id) => {
  const { body } = await api(`/api/jobs/${id}/outputs`, { headers: SH });
  return String(body?.cmd ?? "");
};

/** the server log witness, read from the offset this suite started at */
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

const mrcHdr = (() => {
  const b = Buffer.alloc(64);
  b.writeInt32LE(1024, 0);
  b.writeInt32LE(1024, 4);
  b.writeInt32LE(1, 8); // NZ=1 — single-section
  b.writeInt32LE(2, 12);
  return b.toString("base64");
})();

/** the mock cluster's process, stopped and restarted from THIS suite */
const stopMock = () => {
  spawnSync("bash", ["-c", "pkill -f 'mock-cluster/server.mjs' || true"], { timeout: 15_000 });
};
const startMock = () => {
  const child = spawn("bun", ["services/mock-cluster/server.mjs"], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
};

let extractJobId = null;

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
  const mkA = await mkConn(CONN_A, "QA t328 A (original)");
  must(mkA.status === 200 || mkA.status === 201, `the original connection upserts (${mkA.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t328 heartbeat heal", mode: "remote", remoteConnectionId: CONN_A }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");

  // the mock's star-pad lever: extract writes a VALID star padded past the
  // per-file cap with comment lines (every parser in the family skips #)
  client("echo 1 > ~/.cf-mock-star-pad");
  must(
    client("test -e ~/.cf-mock-star-pad && echo ARMED").includes("ARMED"),
    "the star-pad lever arms in the mock HOME"
  );

  // ======================================================================
  console.log("== PHASE A: UNIT — the route table + the dialect matrix ==");

  const unit = (() => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "t328-unit-"));
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
      },
      ...over,
    });
    const state = {
      // the registry-stale record: completed remotely, key accounted NOWHERE
      jStale: mkRec(),
      // t328 — the probed-and-absent record: the verdict is ON the record
      jAbsent: mkRec({
        remote: {
          ...mkRec().remote,
          outputProbeAbsent: ["particles_star"],
        },
      }),
      // the stay-behind record: twins recorded, local copy missing
      jStay: mkRec({
        remote: {
          ...mkRec().remote,
          remoteOutputs: { particles_star: "/home/u/cryoflow/pA/extract_00000001/particles.star" },
        },
      }),
    };
    writeFileSync(path.join(tmp, "engine-state.json"), JSON.stringify(state));
    // NOTE: NO remote-connections.json yet — the no-route dialects first;
    // the ROUTE cases write one mid-program (below).
    const prog = `
process.env.CRYOFLOW_DATA_DIR = ${JSON.stringify(tmp)};
const fs = await import("node:fs");
const path = await import("node:path");
const m = await import(${JSON.stringify(path.join(ROOT, "src/lib/relion/engine.ts"))});
const up = (id) => ({ id, type: "extract", status: "completed", name: "Particle Extraction 1" });
const out = {};
// ---- the route table (no registry file: nothing is live) ----
out.routeNone = m.liveConnectionForHost("h:22");
// write a registry: cLive reaches h:22, cOther reaches another host
const reg = [
  { id: "cOther", name: "other", host: "other.example", port: 22, username: "u", authMethod: "password" },
  { id: "cLive", name: "live", host: "h", port: 22, username: "u", authMethod: "password" },
];
fs.writeFileSync(path.join(${JSON.stringify(tmp)}, "remote-connections.json"), JSON.stringify(reg));
out.routeLive = m.liveConnectionForHost("h:22");
out.routeCase = m.liveConnectionForHost("H:22");
out.routeDot = m.liveConnectionForHost("h:22.");
out.routeOtherPort = m.liveConnectionForHost("h:23");
out.routeAlias = m.liveConnectionForHost("alias:22");
// ---- the dialect matrix ----
// no-route lane ran BEFORE the registry existed: capture it now by removing the file
fs.rmSync(path.join(${JSON.stringify(tmp)}, "remote-connections.json"));
out.staleLocalNoRoute = m.resolveInputs("class2d", [up("jStale")]);
fs.writeFileSync(path.join(${JSON.stringify(tmp)}, "remote-connections.json"), JSON.stringify(reg));
out.staleLocalRoute = m.resolveInputs("class2d", [up("jStale")]);
out.staleRemote = m.resolveInputs("class2d", [up("jStale")], undefined, { remote: true, connectionId: "cB", host: "h:22" });
out.absentLocal = m.resolveInputs("class2d", [up("jAbsent")]);
out.absentRemote = m.resolveInputs("class2d", [up("jAbsent")], undefined, { remote: true, connectionId: "cB", host: "h:22" });
out.stayLocalRoute = m.resolveInputs("class2d", [up("jStay")]);
fs.rmSync(path.join(${JSON.stringify(tmp)}, "remote-connections.json"));
out.stayLocalNoRoute = m.resolveInputs("class2d", [up("jStay")]);
fs.writeFileSync(path.join(${JSON.stringify(tmp)}, "remote-connections.json"), JSON.stringify(reg));
out.stayRemoteForeign = m.resolveInputs("class2d", [up("jStay")], undefined, { remote: true, connectionId: "cB", host: "OTHER:22" });
out.stayRemoteSameHost = m.resolveInputs("class2d", [up("jStay")], undefined, { remote: true, connectionId: "cB", host: "h:22" });
console.log("CFUNIT" + JSON.stringify(out));
`;
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    rmSync(tmp, { recursive: true, force: true });
    if (r.status !== 0) return { error: (r.stderr ?? "").slice(0, 400) };
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("CFUNIT"));
    try {
      return JSON.parse(line.slice("CFUNIT".length));
    } catch {
      return { error: `parse: ${String(r.stdout).slice(0, 200)}` };
    }
  })();

  must(!unit.error, `the unit leg imports the engine cleanly (${unit.error ?? "ok"})`);
  if (!unit.error) {
    const S = (v) => String(v ?? "");
    // ---- liveConnectionForHost's truth table ----
    must(unit.routeNone === null, "route: no registry at all → no live route (null)");
    must(
      unit.routeLive?.id === "cLive",
      "route: a registry profile for the record's host:port IS a live route (the drift fix at the registry level)"
    );
    must(
      unit.routeCase?.id === "cLive" && unit.routeDot?.id === "cLive",
      "route: host identity is NORMALIZED (case + trailing FQDN dot never block a genuine re-creation)"
    );
    must(
      unit.routeOtherPort == null && unit.routeAlias == null,
      "route: a different port (or an alias) finds nothing — fail-closed, never a wrong cluster"
    );
    // ---- the registry-stale dialect matrix ----
    must(
      /completed on the cluster \(h\), but where its particles\.star lives is not on record/.test(S(unit.staleLocalNoRoute?.missing)) &&
        /connect a cluster profile for h/.test(S(unit.staleLocalNoRoute?.missing)),
      "registry-stale LOCAL, NO route: names the host and the door (the local lane never promises a probe)"
    );
    must(
      /this job starts by itself on h on the next retry heartbeat/.test(S(unit.staleLocalRoute?.missing)) &&
        /the upstream's workdir is probed there/.test(S(unit.staleLocalRoute?.missing)),
      "registry-stale LOCAL, LIVE route: the promise is the HEARTBEAT's own dispatch (no click-imperative)"
    );
    must(
      /send this job to the cluster \(the dispatch probes the upstream's workdir there and chains off the copy in place\)/.test(
        S(unit.staleRemote?.missing)
      ),
      "registry-stale REMOTE: the t325 text survives verbatim (this lane DOES probe — the promise is real)"
    );
    // ---- the absent verdict dialect (lane-independent: the record knows) ----
    for (const [k, lane] of [
      ["absentLocal", "LOCAL"],
      ["absentRemote", "REMOTE"],
    ]) {
      must(
        /is not in its workdir on h either \(checked there\)/.test(S(unit[k]?.missing)) &&
          /the output is genuinely gone; re-run the upstream to regenerate it/.test(S(unit[k]?.missing)),
        `registry-stale ABSENT verdict (${lane}): the message reports the probe's OUTCOME — 'checked there, not present' instead of re-promising the probe that already ran`
      );
    }
    // ---- the stay-behind dialect matrix ----
    must(
      /stayed there \(over the sync caps\) — this job starts by itself on h on the next retry heartbeat \(it chains off the cluster copy in place\)/.test(
        S(unit.stayLocalRoute?.missing)
      ),
      "stay-behind LOCAL, LIVE route: the heartbeat dispatches to the cluster by itself (the old 'send this job' imperative retired)"
    );
    must(
      /stayed there \(over the sync caps\) — connect a cluster profile for h/.test(S(unit.stayLocalNoRoute?.missing)) &&
        /raise the sync caps/.test(S(unit.stayLocalNoRoute?.missing)),
      "stay-behind LOCAL, NO route: names the door AND keeps the sync-caps remediation"
    );
    must(
      /ran on a different cluster and its particles\.star stayed there/.test(S(unit.stayRemoteForeign?.missing)),
      "stay-behind REMOTE, foreign cluster: the t324 cross-cluster refusal survives verbatim"
    );
    must(
      unit.stayRemoteSameHost?.missing == null &&
        unit.stayRemoteSameHost?.inputs?.particles_star === "/home/u/cryoflow/pA/extract_00000001/particles.star",
      "stay-behind REMOTE, same host: the twin still resolves (the t324/t325 contract untouched)"
    );
  }

  // ======================================================================
  console.log("== PHASE B: LIVE A — the doubly-dead target, the heartbeat heals ==");

  const fx = clientBoth(
    "mkdir -p /data2/t328-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t328-mic.mrc; ` +
      "for i in $(seq 1 4); do cp /tmp/.t328-mic.mrc /data2/t328-mics/mic_$(printf %02d $i).mrc; done"
  );
  must(fx === "", `the 4 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t328 import",
    params: {
      micrographsPath: Array.from({ length: 4 }, (_, i) => `/data2/t328-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
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
    name: "QA t328 autopick LoG",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractJob = await mkJob({
    projectId,
    type: "extract",
    name: "QA t328 extract",
    params: { boxSize: 128 },
  });
  const clsJob = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t328 class2d",
    params: { iterations: 2 },
  });
  must(
    !!autopickJob?.id && !!extractJob?.id && !!clsJob?.id,
    "the autopick/extract/class2d jobs create"
  );
  extractJobId = extractJob.id;
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
  surgeryPreT324(extractJob.id);
  must(!existsSync(localStar), "surgery: the local star is gone (the pre-t324 stay-behind shape)");
  must(
    readRecord(extractJob.id)?.remote?.remoteOutputs == null,
    "surgery: the record lost its twins (the pre-t324 ledger)"
  );

  // ---- THE DOUBLE DEATH: connection A dies; connection B (SAME HOST) is
  // re-created; the project binding is left STALE on the dead A. Under
  // pre-t328 code every heartbeat dispatched LOCALLY (passthrough dropped,
  // project fallback null) — the registry-stale message forever, zero
  // probes. t328: the same-host recovery keeps the wire alive.
  const del = await api(`/api/remote/connections/${CONN_A}`, { method: "DELETE", headers: SH });
  must(del.status === 200 || del.status === 204, `the original connection deletes (${del.status})`);
  const mkB = await mkConn(CONN_B, "QA t328 B (re-created)");
  must(mkB.status === 200 || mkB.status === 201, `the re-created connection upserts (${mkB.status})`);
  must(
    readRecord(extractJob.id)?.remote?.connectionId === CONN_A,
    "the record still names the DEAD connection (the drift shape — no rebind, no surgery on the id)"
  );

  // the consumer opts in through the LOCAL door (the user's manual Run click
  // on the pending 2D): with a LIVE profile for the record's host, the LOCAL
  // lane promises the heartbeat instead of a click
  const pendCls = await dispatch(clsJob.id, { local: true });
  must(pendCls.body?.waiting === "not-ready", "the class2d pendings through the local door (not-ready)");
  const msgCls = String(pendCls.body?.job?.result ?? pendCls.body?.error ?? "");
  must(
    /completed on the cluster, but where its particles\.star lives is not on record/.test(msgCls) &&
      /this job starts by itself on 127\.0\.0\.1 on the next retry heartbeat/.test(msgCls),
    "the local door speaks the registry-stale dialect with the HEARTBEAT promise (the doubly-dead field shape)"
  );
  must(
    !/send this job to the cluster/.test(msgCls),
    "the click-imperative is GONE from the local lane (the banner's 'no further clicks' and the dialect finally agree)"
  );

  // ---- the retry heartbeat: the passthrough recovers the same-host target,
  // the lazy heal probes, and the job COMPLETES against the cluster copy.
  const doneCls = await awaitJobTerminal(clsJob.id, 300_000);
  must(
    doneCls?.status === "completed",
    `the class2d COMPLETES via the same-host passthrough recovery + the lazy heal (${doneCls?.status}: ${String(doneCls?.result ?? "").slice(0, 110)})`
  );

  const exRecAfter = readRecord(extractJob.id);
  const twinHealed = String(exRecAfter?.remote?.remoteOutputs?.particles_star ?? "");
  must(
    /particles\.star$/.test(twinHealed),
    "the heal PATCHED the drifted record: the twin is back on the ledger (through the re-created connection)"
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
  const logA = logSince();
  must(
    /remote passthrough recovered a live same-host connection \("QA t328 B \(re-created\)"\) for "QA t328 extract"/.test(logA) &&
      /its recorded profile "QA t328 A \(original\)" is gone, the cluster itself is not \(t328\)/.test(logA),
    "the server log witnessed the SAME-HOST PASSTHROUGH RECOVERY (the doubly-dead target came back to life)"
  );
  must(
    /probing 1 upstream record\(s\) on 127\.0\.0\.1 .*t324 heal/.test(logA) &&
      /verified on the cluster \(t324\)/.test(logA),
    "the server log witnessed the lazy heal + its verdict"
  );

  // ======================================================================
  console.log("== PHASE C: LIVE B — the probe's absent verdict, spoken + recoverable ==");

  const clsB = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t328 class2d (absent verdict)",
    params: { iterations: 2 },
  });
  must(!!clsB?.id, "the absent-verdict class2d creates");
  await mkEdge(extractJob.id, clsB.id, "particles", "particles");

  // the star MOVES ASIDE on the cluster (a cleaned workdir, a broken run):
  const workdir = String(readRecord(extractJob.id)?.remote?.remoteWorkdir ?? "");
  must(workdir.length > 0, "the extract record carries its cluster workdir");
  const mvOut = clientBoth(`mv ${workdir}/particles.star ${workdir}/particles.star.hold`);
  must(mvOut === "", `the cluster-side star moves aside quietly (${mvOut.slice(0, 80)})`);

  // surgery back to the probeable shape; the local door opts the job in
  surgeryPreT324(extractJob.id);
  const pendB = await dispatch(clsB.id, { local: true });
  must(pendB.body?.waiting === "not-ready", "the absent-verdict class2d pendings through the local door");

  // the heartbeat probes: the file is NOT there → the verdict flips the
  // message to the ABSENT dialect (the row STAYS pending — honestly)
  const absentMsg = await pollUntil(async () => {
    const j = await jobById(clsB.id);
    return j && /not in its workdir on 127\.0\.0\.1 either \(checked there\)/.test(String(j.result ?? ""))
      ? String(j.result ?? "")
      : null;
  }, 90_000);
  must(
    absentMsg != null &&
      /the output is genuinely gone; re-run the upstream to regenerate it/.test(absentMsg),
    `the pending message reports the probe's OUTCOME: checked on the cluster, not present (zero new information → the honest verdict: ${String(absentMsg).slice(0, 90)})`
  );
  must(
    !/send this job to the cluster \(the dispatch probes/.test(absentMsg ?? ""),
    "the probe promise is GONE once the probe RAN and found nothing (no re-promising a verdict already in hand)"
  );
  const recAbsent = readRecord(extractJob.id);
  must(
    Array.isArray(recAbsent?.remote?.outputProbeAbsent) &&
      recAbsent.remote.outputProbeAbsent.includes("particles_star"),
    "the record PERSISTS the absent verdict (outputProbeAbsent carries the key)"
  );
  must(recAbsent?.remote?.outputProbeAt != null, "the verdict is stamped (the 10-minute negative-probe rate limit armed)");
  must(
    /verified ABSENT on the cluster \(t328\)/.test(logSince()),
    "the server log witnessed the honest negative (… verified ABSENT … (t328))"
  );

  // ---- the recovery: the star moves BACK, the stamp ages out (surgery
  // compresses the 10-minute window), the re-probe re-finds it, the absent
  // list CLEARS per-key, and the job completes
  const mvBack = clientBoth(`mv ${workdir}/particles.star.hold ${workdir}/particles.star`);
  must(mvBack === "", `the cluster-side star moves back quietly (${mvBack.slice(0, 80)})`);
  surgeryAgeStamp(extractJob.id);
  const doneB = await awaitJobTerminal(clsB.id, 300_000);
  must(
    doneB?.status === "completed",
    `after the recovery the class2d COMPLETES (${doneB?.status}: ${String(doneB?.result ?? "").slice(0, 100)})`
  );
  const recRecovered = readRecord(extractJob.id);
  must(
    /particles\.star$/.test(String(recRecovered?.remote?.remoteOutputs?.particles_star ?? "")) &&
      (recRecovered?.remote?.outputProbeAbsent ?? []).length === 0,
    "the re-probe re-found the star: the twin is back AND the absent list is CLEARED per-key"
  );

  // ======================================================================
  console.log("== PHASE D: LIVE C — the unreachable probe, the honest suffix + self-retry ==");

  const clsC = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t328 class2d (unreachable probe)",
    params: { iterations: 2 },
  });
  must(!!clsC?.id, "the unreachable-probe class2d creates");
  await mkEdge(extractJob.id, clsC.id, "particles", "particles");

  // surgery to the probeable shape; the local door opts the job in
  surgeryPreT324(extractJob.id);
  const pendC = await dispatch(clsC.id, { local: true });
  must(pendC.body?.waiting === "not-ready", "the unreachable-probe class2d pendings through the local door");

  // ---- the mock cluster STOPS: the heal's probe cannot run at all ----
  stopMock();
  const mockDown = await pollUntil(async () => !(await mockListening()), 15_000);
  must(mockDown === true, "the mock cluster is DOWN (the SSH door is closed)");

  // the heartbeat attempts the heal; the probe fails to RUN; the message
  // gains the honest suffix instead of pretending nothing happened
  const unreachableMsg = await pollUntil(async () => {
    const j = await jobById(clsC.id);
    return j && /the cluster could not be reached to check just now/.test(String(j.result ?? ""))
      ? String(j.result ?? "")
      : null;
  }, 90_000);
  must(
    unreachableMsg != null &&
      /the retry heartbeat tries again by itself/.test(unreachableMsg),
    `the unreachable probe is SPOKEN: the message says the check failed and retries by itself (${String(unreachableMsg).slice(0, 90)})`
  );
  must(
    /where its particles\.star lives is not on record/.test(unreachableMsg ?? ""),
    "the unreachable dialect keeps the registry-stale base (the probe's outcome rides ON the story, it does not replace it)"
  );
  must(
    readRecord(extractJob.id)?.remote?.outputProbeAt == null,
    "a probe that could not RUN leaves NO stamp (the next heartbeat retries for real — no false negative)"
  );

  // ---- the mock cluster RETURNS: the unstamped probe retries by itself,
  // re-finds the star, and the job completes
  startMock();
  const mockUp = await pollUntil(() => mockListening(), 30_000);
  must(mockUp === true, "the mock cluster is BACK UP");
  const doneC = await awaitJobTerminal(clsC.id, 300_000);
  must(
    doneC?.status === "completed",
    `after the mock returns, the class2d COMPLETES by itself (${doneC?.status}: ${String(doneC?.result ?? "").slice(0, 100)})`
  );

  // ======================================================================
  console.log("== PHASE E: LEDGER — the source contracts, pinned ==");

  const engineSrc = readFileSync(path.join(ROOT, "src/lib/relion/engine.ts"), "utf8");
  const dispatchSrc = readFileSync(path.join(ROOT, "src/lib/relion/dispatch.ts"), "utf8");
  const remoteSrc = readFileSync(path.join(ROOT, "src/lib/remote/remote-run.ts"), "utf8");
  const typesSrc = readFileSync(path.join(ROOT, "src/lib/remote/types.ts"), "utf8");

  must(
    /export function liveConnectionForHost/.test(engineSrc) &&
      /normalizeClusterHost\(`\$\{c\.host\}:\$\{c\.port\}`\) === want/.test(engineSrc),
    "the registry-level host lookup lives in the engine (normalized host:port, newest profile wins)"
  );
  must(
    /liveConnectionForHost\(triggerRec\.remote\.host\)/.test(dispatchSrc) &&
      /const passthroughConn = triggerConn \?\? hostConn/.test(dispatchSrc),
    "the passthrough door recovers a same-host LIVE connection when the record's own profile is gone (trigger conn → same-host conn → project binding)"
  );
  must(
    /recovered a live same-host connection/.test(dispatchSrc),
    "the recovery is SPOKEN in the server log (a field diagnosis can see the wire come back)"
  );
  must(
    /outputProbeAbsent\?: string\[\]/.test(typesSrc) &&
      /keys the last SUCCESSFUL probe verified ABSENT/.test(typesSrc),
    "the record carries the probe's absent verdict (types)"
  );
  must(
    /outputProbeAbsent: foundAny/.test(remoteSrc) &&
      /\(cur\.remote\.outputProbeAbsent \?\? \[\]\)\.filter\(\(k\) => !twins\[k\]\)/.test(remoteSrc),
    "the probe persists its verdict per-key and CLEARS found keys on re-find (the lazy heal's persist)"
  );
  must(
    /outputProbeAbsent: outputProbeAbsent \?\? \[\]/.test(remoteSrc) &&
      /finalizeMissing\.filter\(\(k\) => !remoteOutputs\[k\]\)/.test(remoteSrc),
    "the FINALIZE leg persists the same verdict (the first probe a record ever gets owns its negative)"
  );
  must(
    /let probeUnreachable = false/.test(remoteSrc) &&
      /the cluster could not be reached to check just now/.test(remoteSrc),
    "a probe that could not RUN is spoken in the waiting message (the SSH blip is information, not silence)"
  );
  must(
    /verified ABSENT on the cluster \(t328\)/.test(remoteSrc),
    "the honest negative gets its own log line (a field diagnosis can tell 'not there' from 'never checked')"
  );
  must(
    /is not in its workdir on \$\{rhost\} either \(checked there\)/.test(engineSrc) &&
      /the output is genuinely gone; re-run the upstream to regenerate it/.test(engineSrc),
    "the absent-verdict dialect lives in the engine (the verdict in hand beats the probe re-promised)"
  );
  must(
    /this job starts by itself on \$\{rhost\} on the next retry heartbeat/.test(engineSrc) &&
      /connect a cluster profile for \$\{rhost\}/.test(engineSrc),
    "the LOCAL lane is route-aware: heartbeat promise with a live route, the door named without one"
  );
  must(
    /this job starts by itself on \$\{shost\} on the next retry heartbeat \(it chains off the cluster copy in place\)/.test(engineSrc),
    "the stay-behind LOCAL lane is route-aware too (the same doctrine, both dialects)"
  );

  console.log(fail === 0 ? "\n== t328 diag: ALL GREEN ==" : `\n== t328 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side shells + the levers ----
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  if (projectId) {
    try {
      client(`rm -rf /projects/cryoflow/${projectId}`);
    } catch { /* the jobs DELETE already dropped the local twin */ }
    try {
      rmSync(path.join(ROOT, "data/relion", projectId), { recursive: true, force: true });
    } catch { /* may not exist */ }
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  try {
    client("rm -rf /data2/t328-mics /tmp/.t328-mic.mrc ~/.cf-mock-star-pad");
  } catch { /* fixtures are runtime, gitignored */ }
  for (const c of [CONN_A, CONN_B]) {
    await api(`/api/remote/connections/${c}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  // the mock must SURVIVE this suite (later suites + the environment use it)
  if (!(await mockListening())) {
    startMock();
    await pollUntil(() => mockListening(), 30_000);
  }
}

process.exit(fail === 0 ? 0 : 1);

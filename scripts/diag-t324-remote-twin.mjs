#!/usr/bin/env node
/**
 * t324 diag — the cluster is the truth for a remote chain: outputs the
 * sync-back left behind still unblock downstream cluster jobs.
 *
 * The user's ticket (the real cluster, post-t323):
 *   2D Classification 1 — Pending, created 10h ago
 *   "Waiting for upstream output: particles.star (run Extract first) —
 *    runs automatically once ready"
 *   …while Particle Extraction 1 sits COMPLETED right upstream.
 *
 * The anatomy: EVERY readiness gate was LOCAL. resolveInputs' provider
 * scan requires `outputs[key] && existsSync(path)` — the sync-back's local
 * copy — and startRemoteJob gated on the very same call before any staging.
 * But the sync-back legitimately leaves files behind (per-file caps, the
 * total budget, a download that failed mid-way — an extract on 576
 * micrographs writes a many-MB particles.star beside 576 .mrcs stacks), so
 * a remote pipeline whose key star stayed on the cluster PENDING-ed
 * FOREVER with "run Extract first" — over a run that had already
 * succeeded, with the file sitting RIGHT THERE on the cluster the
 * downstream job was about to run on. The record even carries
 * remote.remoteOutputs twins for exactly this consumption — the gate just
 * never got that far. Two more defects ride along:
 *   - the auto-start promise ("runs automatically once ready") had NO
 *     retry: the one-shot triggers (finalize, exit handler) fire once, and
 *     a consumer that missed its moment (SSH blip, pre-t324 record) waits
 *     until a server restart;
 *   - the waiting message LIED for the stay-behind shape — "run Extract
 *     first" sends the user hunting a run that already completed.
 *
 * THE FIX (four blades):
 *   1. resolveInputs grows a REMOTE flavor ({ remote, connectionId }): a
 *      requirement may resolve through the record's CLUSTER-verified twin
 *      when the local copy is missing — the value IS the cluster path, the
 *      staging skip and the argv both key off it (identity entries in the
 *      dispatch's twin map). The LOCAL lane keeps pure-local semantics but
 *      speaks the honest message ("stayed there — over the sync caps").
 *   2. finalizeRemoteRun PROBES the cluster for keys the sync-back left
 *      behind (REMOTE_OUTPUT_CANDIDATES: exact names + iteration globs,
 *      one SSH round, only when something is missing) — the record holds
 *      the cluster truth, and the receipt says where the file lives
 *      instead of "no expected outputs appeared".
 *   3. startRemoteJob carries the LAZY HEAL for pre-t324 records: when the
 *      remote flavor still comes up missing, one batched probe over the
 *      lineage's completed remote records (same connection, probe not
 *      fresh), then re-resolve — existing stuck pipelines recover on their
 *      next attempt, no re-run needed.
 *   4. The jobs GET sweep grows the pending RETRY: every ~20s, pending
 *      consumers re-attempt through their completed upstreams — the
 *      "runs automatically" promise finally has a heartbeat.
 *
 * PHASES:
 *  A. UNIT (bun, the engine import chain + a fixture state file) — the
 *     remote flavor's truth table: twin resolution, local-wins-over-twin,
 *     foreign-connection refusal, the honest local message, the user's
 *     verbatim base message, failed-provider priority, the probe worklist.
 *  B. LIVE A — the user's ENTIRE pipeline on the mock cluster, forced
 *     honestly: a tight connection (maxFileMb=1) + the mock's star-pad
 *     lever make extract's particles.star (1.4 MB) exceed the per-file cap
 *     — the sync REALLY skips it, no surgery. import → [pending extract,
 *     pending class2d] → LoG autopick (slurm) completes → auto-cascade:
 *     extract runs, its star stays on the cluster, the finalize probe
 *     records the twin, class2d auto-starts THROUGH the twin (--i is the
 *     cluster path), completes — zero manual clicks after the first
 *     dispatches.
 *  C. LIVE B — the pre-t324 record + the retry heartbeat: a second chain
 *     completes normally (the control), then surgery regresses the extract
 *     record to the pre-t324 shape (outputs empty, twins empty, local star
 *     deleted). A fresh class2d is dispatched LOCAL first — it pendings
 *     with the HONEST message (not "run Extract first") — and then the
 *     ~20s retry sweep fires the auto-start, the lazy heal probes the
 *     cluster, the record regains its twin, and the job completes against
 *     the cluster copy. The heal never re-downloads: the local star stays
 *     absent the whole time.
 *  D. LEDGER — every source contract pinned (the candidates table, the
 *     remote flavor, the identity twins, the probe, the heal, the stamp,
 *     the retry cadence, the mock lever).
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t324";
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

const mrcHdr = (() => {
  const b = Buffer.alloc(64);
  b.writeInt32LE(4096, 0);
  b.writeInt32LE(4096, 4);
  b.writeInt32LE(1, 8); // NZ=1 — single-section, CTF-ready
  b.writeInt32LE(2, 12); // mode 2
  return b.toString("base64");
})();

let projectIdA = null;
let projectIdB = null;

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  // t324's tight connection: the per-file cap of 1 MB is what forces the
  // sync-back to leave the (padded, 1.4 MB) particles.star behind — the
  // user's shape, forced honestly through the REAL caps machinery
  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t324 tight",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      maxFileMb: 1,
      maxTotalMb: 16,
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the tight connection upserts (${mk.status})`);

  const projA = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t324 twin chain", mode: "remote", remoteConnectionId: CONN }),
  });
  must(projA.status >= 200 && projA.status < 300, `the remote project A creates (${projA.status})`);
  projectIdA = projA.body?.project?.id;
  if (projectIdA) createdProjects.push(projectIdA);
  must(!!projectIdA, "the project A id rides the response");

  // the mock's star-pad lever: extract writes a VALID star padded past the
  // per-file cap with comment lines (every parser in the family skips #)
  client("echo 1 > ~/.cf-mock-star-pad");
  must(
    client("test -e ~/.cf-mock-star-pad && echo ARMED").includes("ARMED"),
    "the star-pad lever arms in the mock HOME"
  );

  // ======================================================================
  console.log("== PHASE A: UNIT — resolveInputs' remote flavor + the probe worklist ==");

  const unit = (() => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "t324-unit-"));
    const localStar = path.join(tmp, "particles.star");
    writeFileSync(localStar, "data_particles\n\nloop_\n_rlnImageName #1\n000001@extra/x.mrcs\n");
    const twin = "/home/cryo/cryoflow/pA/extract_00000001/particles.star";
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
      ...over,
      ...(over.remote ? { remote: over.remote } : {}),
    });
    const state = {
      // stay-behind shape: no local copy, cluster twin verified
      jStay: mkRec({ remote: {
        connectionId: "c1", connectionName: "qa", host: "h:22", user: "u",
        module: "", mode: "slurm", remoteRoot: "/home/cryo/cryoflow",
        remoteWorkdir: "/home/cryo/cryoflow/pA/extract_00000001",
        pid: null, slurmId: "1", phase: "running",
        remoteOutputs: { particles_star: twin },
      } }),
      // healthy shape: local copy present AND a twin — the local file wins
      jBoth: mkRec({
        outputs: { particles_star: localStar },
        remote: {
          connectionId: "c1", connectionName: "qa", host: "h:22", user: "u",
          module: "", mode: "slurm", remoteRoot: "/home/cryo/cryoflow",
          remoteWorkdir: "/home/cryo/cryoflow/pA/extract_00000001",
          pid: null, slurmId: "1", phase: "running",
          remoteOutputs: { particles_star: twin },
        },
      }),
      // a FAILED upstream that also holds a twin: the failed-provider
      // message outranks the stay-behind note on the LOCAL lane
      jFail: mkRec({ exitCode: 1, remote: {
        connectionId: "c1", connectionName: "qa", host: "h:22", user: "u",
        module: "", mode: "slurm", remoteRoot: "/home/cryo/cryoflow",
        remoteWorkdir: "/home/cryo/cryoflow/pA/extract_00000001",
        pid: null, slurmId: "1", phase: "running",
        remoteOutputs: { particles_star: twin },
      } }),
    };
    writeFileSync(path.join(tmp, "engine-state.json"), JSON.stringify(state));
    const prog = `
process.env.CRYOFLOW_DATA_DIR = ${JSON.stringify(tmp)};
const m = await import(${JSON.stringify(path.join(ROOT, "src/lib/relion/engine.ts"))});
const up = (id, type, status) => ({ id, type, status, name: "Particle Extraction 1" });
const out = {};
out.localStay = m.resolveInputs("class2d", [up("jStay", "extract", "completed")]);
out.remoteSame = m.resolveInputs("class2d", [up("jStay", "extract", "completed")], undefined, { remote: true, connectionId: "c1" });
out.remoteBare = m.resolveInputs("class2d", [up("jStay", "extract", "completed")], undefined, { remote: true });
out.remoteForeign = m.resolveInputs("class2d", [up("jStay", "extract", "completed")], undefined, { remote: true, connectionId: "OTHER" });
out.localBoth = m.resolveInputs("class2d", [up("jBoth", "extract", "completed")]);
out.remoteBoth = m.resolveInputs("class2d", [up("jBoth", "extract", "completed")], undefined, { remote: true, connectionId: "c1" });
out.localFail = m.resolveInputs("class2d", [up("jFail", "extract", "failed")]);
out.base = m.resolveInputs("class2d", [up("jNothing", "extract", "completed")]);
out.missNothing = m.missingRemoteOutputKeys("extract", {}, undefined);
out.missTwin = m.missingRemoteOutputKeys("extract", {}, { particles_star: "/x" });
out.missLocal = m.missingRemoteOutputKeys("extract", { particles_star: ${JSON.stringify(localStar)} }, undefined);
out.missUnknown = m.missingRemoteOutputKeys("dynamight", {}, undefined);
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
    must(
      /completed on the cluster, but its particles\.star stayed there \(over the sync caps\)/.test(
        String(unit.localStay?.missing)
      ) && unit.localStay?.wait === "not-ready",
      "LOCAL lane: the stay-behind shape speaks the honest message (WHERE the file lives)"
    );
    must(
      !/run Extract first/.test(String(unit.localStay?.missing)) ||
        /stayed there/.test(String(unit.localStay?.missing)),
      "LOCAL lane: the old 'run Extract first' advice no longer stands alone for a stay-behind"
    );
    must(
      unit.remoteSame?.missing == null && unit.remoteSame?.inputs?.particles_star === "/home/cryo/cryoflow/pA/extract_00000001/particles.star",
      "REMOTE lane (same connection): the requirement resolves THROUGH the cluster twin"
    );
    must(
      unit.remoteBare?.missing == null && unit.remoteBare?.inputs?.particles_star === "/home/cryo/cryoflow/pA/extract_00000001/particles.star",
      "REMOTE lane (no connection gate): a bare remote flavor still accepts the twin"
    );
    must(
      /ran on a different cluster/.test(String(unit.remoteForeign?.missing)),
      "REMOTE lane (foreign connection): the twin is refused with the cross-cluster story"
    );
    must(
      unit.localBoth?.missing == null && unit.localBoth?.inputs?.particles_star.endsWith("particles.star") && !unit.localBoth?.inputs?.particles_star.startsWith("/home/cryo"),
      "the LOCAL copy wins over the twin when both exist (the synced path resolves first)"
    );
    must(
      unit.remoteBoth?.inputs?.particles_star === unit.localBoth?.inputs?.particles_star,
      "remote flavor keeps the LOCAL preference too (twin is the fallback, never the override)"
    );
    must(
      /Upstream "Particle Extraction 1" failed/.test(String(unit.localFail?.missing)) && unit.localFail?.wait === "upstream-failed",
      "a FAILED provider still outranks the stay-behind note (the priority order is intact)"
    );
    must(
      String(unit.base?.missing) ===
        "Waiting for upstream output: particles.star (run Extract first) — runs automatically once ready",
      "the user's VERBATIM base message survives (no record, nothing anywhere)"
    );
    must(
      JSON.stringify(unit.missNothing) === JSON.stringify(["particles_star"]),
      "the probe worklist names the unaccounted key (no outputs, no twins)"
    );
    must(
      JSON.stringify(unit.missTwin) === JSON.stringify([]),
      "a verified twin clears the worklist (no probe needed)"
    );
    must(
      JSON.stringify(unit.missLocal) === JSON.stringify([]),
      "an existing local copy clears the worklist"
    );
    must(
      JSON.stringify(unit.missUnknown) === JSON.stringify([]),
      "a type without candidates never probes (dynamight's outputs stay collectOutputs' business)"
    );
  }

  // ======================================================================
  console.log("== PHASE B: LIVE A — the user's pipeline, the star REALLY stays behind ==");

  const fx = clientBoth(
    "mkdir -p /data2/t324-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t324-mic.mrc; ` +
      "for i in $(seq 1 8); do cp /tmp/.t324-mic.mrc /data2/t324-mics/mic_$(printf %02d $i).mrc; done"
  );
  must(fx === "", `the 8 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId: projectIdA,
    type: "import",
    name: "QA t324 import",
    params: {
      micrographsPath: Array.from({ length: 8 }, (_, i) => `/data2/t324-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!importJob?.id, "the import job creates");
  const runImport = await api(`/api/jobs/${importJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImport.status >= 200 && runImport.status < 300, `the import run accepts (${runImport.status})`);
  const doneImport = await awaitJobTerminal(importJob.id, 90_000);
  must(doneImport?.status === "completed", `the import completes (${doneImport?.status}: ${String(doneImport?.result ?? "").slice(0, 80)})`);

  // the whole DAG up front — the user's canvas: import → autopick → extract
  // → class2d, with extract and class2d opting INTO the wait (pending)
  // BEFORE their upstreams complete, exactly like the real project
  const autopickJob = await mkJob({
    projectId: projectIdA,
    type: "autopick",
    name: "QA t324 autopick LoG",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractJob = await mkJob({
    projectId: projectIdA,
    type: "extract",
    name: "QA t324 extract",
    params: { boxSize: 128 },
  });
  const clsJob = await mkJob({
    projectId: projectIdA,
    type: "class2d",
    name: "QA t324 class2d",
    params: { iterations: 2 },
  });
  must(!!autopickJob?.id && !!extractJob?.id && !!clsJob?.id, "the autopick/extract/class2d jobs create");
  const eAP = await mkEdge(importJob.id, autopickJob.id, "micrographs", "micrographs");
  const eEXm = await mkEdge(importJob.id, extractJob.id, "micrographs", "micrographs");
  const eEXc = await mkEdge(autopickJob.id, extractJob.id, "coords", "coords");
  const eCL = await mkEdge(extractJob.id, clsJob.id, "particles", "particles");
  must(
    [eAP, eEXm, eEXc, eCL].every((s) => s === 200 || s === 201),
    `the DAG wires import → autopick → extract → class2d (${eAP}/${eEXm}/${eEXc}/${eCL})`
  );

  // class2d opts in while NOTHING upstream has run — this is the user's
  // verbatim pending receipt
  const pendCls = await dispatch(clsJob.id, { local: true });
  must(pendCls.status >= 200 && pendCls.status < 300, `the class2d local door answers (${pendCls.status})`);
  must(pendCls.body?.waiting === "not-ready", "the class2d pendings (not-ready)");
  must(
    String(pendCls.body?.job?.result ?? pendCls.body?.error ?? "") ===
      "Waiting for upstream output: particles.star (run Extract first) — runs automatically once ready",
    "the pending receipt is the user's VERBATIM message (the bug's face, reproduced)"
  );

  // extract opts in too — it will auto-start when autopick lands
  const pendEx = await dispatch(extractJob.id, { local: true });
  must(pendEx.body?.waiting === "not-ready", "the extract pendings (coords not ready yet)");

  // the only REMOTE dispatch in the whole chain: the LoG autopick. Everything
  // after it must cascade by itself.
  const dispatchAP = await dispatch(autopickJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 1 },
  });
  must(dispatchAP.status >= 200 && dispatchAP.status < 300, `the LoG autopick dispatch answers (${dispatchAP.status})`);
  must(!dispatchAP.body?.error, `the LoG autopick is ACCEPTED (${String(dispatchAP.body?.error ?? "").slice(0, 100)})`);
  const doneAP = await awaitJobTerminal(autopickJob.id, 180_000);
  must(doneAP?.status === "completed", `the LoG autopick completes (${doneAP?.status}: ${String(doneAP?.result ?? "").slice(0, 90)})`);

  // extract: auto-started by the cascade (nobody clicked), star stays behind
  const doneEx = await awaitJobTerminal(extractJob.id, 240_000);
  must(
    doneEx?.status === "completed",
    `the extract auto-starts and completes via the passthrough (${doneEx?.status}: ${String(doneEx?.result ?? "").slice(0, 120)})`
  );
  must(
    /stayed on the cluster \(verified there\)/.test(String(doneEx?.result ?? "")),
    "the extract receipt says the star STAYED on the cluster (verified there) — the honest stay-note"
  );
  must(
    !/no expected outputs appeared/.test(String(doneEx?.result ?? "")),
    "the old 'no expected outputs appeared' lie is extinct for this shape"
  );
  must(
    /particles\.star stayed on the cluster/.test(String(doneEx?.result ?? "")),
    "the receipt speaks the FILE name (particles.star), not the record key"
  );

  // the sync REALLY skipped it — the local mirror never saw the star
  const exRec = readRecord(extractJob.id);
  must(!!exRec, "the extract record is in the ledger");
  const localStarA = exRec?.workdir ? path.join(exRec.workdir, "particles.star") : null;
  must(localStarA != null && !existsSync(localStarA), "the local mirror has NO particles.star (the cap really skipped it)");
  must(
    exRec?.remote?.remoteOutputs?.particles_star === `${path.dirname(String(localStarA))}`.replace(/\/$/, "") + "/particles.star" ||
      /particles\.star$/.test(String(exRec?.remote?.remoteOutputs?.particles_star ?? "")),
    "the record carries the CLUSTER twin for particles_star (the finalize probe)"
  );
  must(
    exRec?.remote?.outputProbeAt != null && Date.now() - exRec.remote.outputProbeAt < 10 * 60_000,
    "the record stamps outputProbeAt (fresh — the probe ran at finalize)"
  );
  const twinA = String(exRec?.remote?.remoteOutputs?.particles_star ?? "");
  must(
    client(`test -e ${twinA} && echo YES`).includes("YES"),
    "the twin path EXISTS on the cluster (verified by the probe's own grammar)"
  );

  // class2d: the money shot — auto-started THROUGH the twin, zero clicks
  const doneCls = await awaitJobTerminal(clsJob.id, 240_000);
  must(
    doneCls?.status === "completed",
    `the class2d auto-starts THROUGH the cluster twin and completes (${doneCls?.status}: ${String(doneCls?.result ?? "").slice(0, 110)})`
  );
  const cmdCls = await recordedCmd(clsJob.id);
  must(
    new RegExp(`--i ${twinA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(cmdCls),
    `the class2d's recorded command consumes the CLUSTER twin (--i ${twinA})`
  );
  must(!/wsl /.test(cmdCls), "no WSL wrapper anywhere near the command (the old Beijing ghost)");

  // the run itself — the mock refine read the cluster copy and liked it
  const clsWorkdir = String(readRecord(clsJob.id)?.remote?.remoteWorkdir ?? "");
  const runOutCls = client(`cat ${clsWorkdir}/run.out 2>/dev/null`);
  must(
    clsWorkdir.length > 0 && /from particles\.star/.test(runOutCls),
    "the class2d's run.out speaks the mock refine's input line (from particles.star)"
  );

  // disarm the pad lever — LIVE B wants the star to sync normally
  client("rm -f ~/.cf-mock-star-pad");
  must(
    !client("test -e ~/.cf-mock-star-pad && echo ARMED").includes("ARMED"),
    "the star-pad lever disarms (LIVE B runs the normal sync)"
  );

  // ======================================================================
  console.log("== PHASE C: LIVE B — the pre-t324 record, the honest message, the retry heartbeat ==");

  const projB = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t324 heal chain", mode: "remote", remoteConnectionId: CONN }),
  });
  must(projB.status >= 200 && projB.status < 300, `the remote project B creates (${projB.status})`);
  projectIdB = projB.body?.project?.id;
  if (projectIdB) createdProjects.push(projectIdB);

  const import2 = await mkJob({
    projectId: projectIdB,
    type: "import",
    name: "QA t324 import B",
    params: {
      micrographsPath: Array.from({ length: 4 }, (_, i) => `/data2/t324-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  const runImport2 = await api(`/api/jobs/${import2.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImport2.status >= 200 && runImport2.status < 300, `the import B run accepts (${runImport2.status})`);
  const doneImport2 = await awaitJobTerminal(import2.id, 90_000);
  must(doneImport2?.status === "completed", `the import B completes (${doneImport2?.status})`);

  const autopick2 = await mkJob({
    projectId: projectIdB,
    type: "autopick",
    name: "QA t324 autopick B",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extract2 = await mkJob({
    projectId: projectIdB,
    type: "extract",
    name: "QA t324 extract B",
    params: { boxSize: 128 },
  });
  const cls2 = await mkJob({
    projectId: projectIdB,
    type: "class2d",
    name: "QA t324 class2d B (control)",
    params: { iterations: 2 },
  });
  must(!!autopick2?.id && !!extract2?.id && !!cls2?.id, "the B-chain jobs create");
  await mkEdge(import2.id, autopick2.id, "micrographs", "micrographs");
  await mkEdge(import2.id, extract2.id, "micrographs", "micrographs");
  await mkEdge(autopick2.id, extract2.id, "coords", "coords");
  await mkEdge(extract2.id, cls2.id, "particles", "particles");

  // the CONTROL: with the star synced normally, the cascade is unaffected
  await dispatch(cls2.id, { local: true });
  await dispatch(extract2.id, { local: true });
  const dispatchAP2 = await dispatch(autopick2.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 1 },
  });
  must(dispatchAP2.status >= 200 && dispatchAP2.status < 300, `the B autopick dispatch answers (${dispatchAP2.status})`);
  const doneCls2 = await awaitJobTerminal(cls2.id, 300_000);
  must(
    doneCls2?.status === "completed",
    `the CONTROL chain completes untouched (star synced → class2d B: ${doneCls2?.status}: ${String(doneCls2?.result ?? "").slice(0, 90)})`
  );

  // ---- surgery: regress extract2's record to the pre-t324 shape ----------
  const ex2Rec = readRecord(extract2.id);
  must(!!ex2Rec?.remote, "the extract B record exists with its remote state");
  const localStarB = path.join(String(ex2Rec?.workdir ?? ""), "particles.star");
  must(existsSync(localStarB), "the B star DID sync normally (the control's own proof)");
  rmSync(localStarB, { force: true });
  {
    const st = JSON.parse(readFileSync(stateFile(), "utf8"));
    const rec = st[extract2.id];
    rec.outputs = {}; // the sync "missed" it
    delete rec.remote.remoteOutputs; // pre-t324 finalize never probed
    delete rec.remote.outputProbeAt; // never stamped → healable now
    writeFileSync(stateFile(), JSON.stringify(st, null, 2));
  }
  must(!existsSync(localStarB), "surgery: the local star is gone (the pre-t324 stay-behind shape)");
  must(
    readRecord(extract2.id)?.remote?.remoteOutputs == null,
    "surgery: the record lost its twins (the pre-t324 ledger)"
  );

  // the honest LOCAL door: for the PRE-t324 ledger (no twins, no local
  // copy) the honest ceiling used to be the user's verbatim base message
  // ("nothing on this machine knows where the file is yet"). t325 upgraded
  // the ceiling: the record IS remote+completed with the key accounted
  // NOWHERE, and the message now says exactly that (the registry-stale
  // dialect) instead of "run Extract first" over a run that succeeded.
  const cls3 = await mkJob({
    projectId: projectIdB,
    type: "class2d",
    name: "QA t324 class2d B (heal)",
    params: { iterations: 2 },
  });
  must(!!cls3?.id, "the heal class2d creates");
  await mkEdge(extract2.id, cls3.id, "particles", "particles");
  const pend3 = await dispatch(cls3.id, { local: true });
  must(pend3.body?.waiting === "not-ready", "the heal class2d pendings through the local door");
  const msg3 = String(pend3.body?.job?.result ?? pend3.body?.error ?? "");
  must(
    msg3 ===
      'Upstream "QA t324 extract B" completed on the cluster, but where its particles.star lives is not on record — this job starts by itself on 127.0.0.1 on the next retry heartbeat (the upstream\'s workdir is probed there and the job chains off the copy in place); or re-run the upstream to refresh its record',
    "the pre-t324 ledger pendings with the t325/t328 registry-stale message — a completed remote run with an unaccounted key, and since a LIVE profile reaches that host the LOCAL lane promises the heartbeat instead of a manual click (no more 'run Extract first' lie, no more click-imperative the app was about to make unasked)"
  );

  // the retry heartbeat: nobody dispatches this job again — the ~20s sweep
  // must fire the auto-start, the lazy heal must probe the cluster, and the
  // job must complete against the cluster copy. Under the OLD code this
  // poll would watch a pending row forever (the user's 10 hours).
  const done3 = await awaitJobTerminal(cls3.id, 300_000);
  must(
    done3?.status === "completed",
    `the heal class2d COMPLETES via the retry sweep + lazy heal (${done3?.status}: ${String(done3?.result ?? "").slice(0, 110)})`
  );

  const ex2RecAfter = readRecord(extract2.id);
  must(
    /particles\.star$/.test(String(ex2RecAfter?.remote?.remoteOutputs?.particles_star ?? "")),
    "the heal PATCHED the record: the twin is back on the ledger"
  );
  must(
    ex2RecAfter?.remote?.outputProbeAt != null,
    "the heal stamped outputProbeAt (the negative-probe rate limit is armed)"
  );
  const twinB = String(ex2RecAfter?.remote?.remoteOutputs?.particles_star ?? "");
  const cmd3 = await recordedCmd(cls3.id);
  must(
    new RegExp(`--i ${twinB.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(cmd3),
    `the heal class2d's recorded command consumes the healed twin (--i ${twinB})`
  );
  must(
    !existsSync(localStarB),
    "the heal NEVER re-downloads — the local mirror still has no particles.star (the chain ran cluster-side)"
  );

  // the server's own log tells the same story
  const serverLog = (() => {
    try {
      return readFileSync(path.join(ROOT, "prod-3001.log"), "utf8");
    } catch {
      return "";
    }
  })();
  must(
    /t324 heal/.test(serverLog) && /probing 1 upstream record/.test(serverLog),
    "the server log witnessed the lazy heal (probing 1 upstream record … t324)"
  );
  must(
    /verified on the cluster \(t324\)/.test(serverLog),
    "the server log witnessed the probe's verdict (… verified on the cluster (t324))"
  );

  // ---- the post-heal LOCAL door: NOW the ledger knows where the file
  // lives (the healed twin), so the local lane must speak the honest
  // stay-behind message instead of the "run Extract first" lie — the
  // receipt for a user who tries the local door after the heal
  const cls4 = await mkJob({
    projectId: projectIdB,
    type: "class2d",
    name: "QA t324 class2d B (post-heal local door)",
    params: { iterations: 2 },
  });
  must(!!cls4?.id, "the post-heal class2d creates");
  await mkEdge(extract2.id, cls4.id, "particles", "particles");
  const pend4 = await dispatch(cls4.id, { local: true });
  const msg4 = String(pend4.body?.job?.result ?? pend4.body?.error ?? "");
  must(
    /completed on the cluster, but its particles\.star stayed there/.test(msg4),
    "the post-heal local-lane receipt says WHERE the file lives (the honest message)"
  );
  must(
    !/^Waiting for upstream output: particles\.star \(run Extract first\)/.test(msg4),
    "the 'run Extract first' wording is GONE once the twin is known (extract already ran!)"
  );
  must(
    /starts by itself on 127\.0\.0\.1 on the next retry heartbeat/.test(msg4) &&
      /raise the connection's sync caps/.test(msg4),
    "the honest message carries BOTH remediations (the heartbeat's own cluster dispatch + the sync caps)"
  );

  // ======================================================================
  console.log("== PHASE D: LEDGER — the source contracts, pinned ==");

  const engineSrc = readFileSync(path.join(ROOT, "src/lib/relion/engine.ts"), "utf8");
  const remoteSrc = readFileSync(path.join(ROOT, "src/lib/remote/remote-run.ts"), "utf8");
  const jobsRouteSrc = readFileSync(path.join(ROOT, "src/app/api/jobs/route.ts"), "utf8");
  const typesSrc = readFileSync(path.join(ROOT, "src/lib/remote/types.ts"), "utf8");
  const mockExtractSrc = readFileSync(
    path.join(ROOT, "services/mock-cluster/fs/opt/bin/relion_preprocess"),
    "utf8"
  );

  must(
    /export const REMOTE_OUTPUT_CANDIDATES/.test(engineSrc) &&
      /export function missingRemoteOutputKeys/.test(engineSrc),
    "the candidates table + the probe worklist live in the engine (shared truth)"
  );
  must(
    /opts\?: ResolveInputsOpts/.test(engineSrc) && /twinRemote\?\.remoteOutputs\?\.\[key\]/.test(engineSrc),
    "resolveInputs carries the remote flavor (opts + the twin fallback)"
  );
  must(
    /let stayedOnCluster/.test(engineSrc) &&
      /completed on the cluster, but its \$\{what\} stayed there/.test(engineSrc),
    "the honest stay-behind message is generated from the provider's name"
  );
  must(
    /ran on a different cluster/.test(engineSrc),
    "the cross-cluster refusal is a NAMED shape, not a silent miss"
  );
  must(
    /sameClusterTarget\(rec\.remote, \{ connectionId: conn\.id, host: connHostPort \}\)/.test(remoteSrc) &&
      /upstreamRemoteTwins\.set\(norm, remoteTw\)/.test(remoteSrc),
    "the dispatch's twin map grows IDENTITY entries, gated on the same CLUSTER (t325: connection OR host — the drift-hardened gate)"
  );
  must(
    /async function probeRemoteOutputs/.test(remoteSrc) && /OUTPUT_PROBE_FRESH_MS = 10 \* 60_000/.test(remoteSrc),
    "the cluster probe + the 10-minute freshness stamp live in the remote layer"
  );
  must(
    /remote: true,\s*\n\s*connectionId: target\.connectionId,\s*\n\s*host: connHostPort/.test(remoteSrc),
    "startRemoteJob resolves with the REMOTE flavor + the host:port identity (t325 — the gate that used to be local-only, now drift-proof)"
  );
  must(
    /t324 heal/.test(remoteSrc) && /probeRemoteOutputs\(conn, st\)/.test(remoteSrc),
    "the lazy heal probes healable upstream records before giving up"
  );
  must(
    /probeRemoteOutputs\(conn, rec, \{ outputs, persist: false \}\)/.test(remoteSrc) &&
      /outputProbeAt: outputProbedAt/.test(remoteSrc),
    "finalize probes for missing keys and stamps the record"
  );
  must(
    /stayed on the cluster \(verified there\)/.test(remoteSrc),
    "the finalize receipt speaks the stay-behind story"
  );
  must(
    /PENDING_RETRY_MS = 20_000/.test(jobsRouteSrc) && /lastPendingRetryAt/.test(jobsRouteSrc),
    "the jobs GET sweep owns the ~20s pending retry (the promise's heartbeat)"
  );
  must(
    /retryTriggers/.test(jobsRouteSrc) && /autoStartPendingDownstream\(id\)/.test(jobsRouteSrc),
    "the retry fires the auto-start through completed upstreams"
  );
  must(/outputProbeAt\?: number/.test(typesSrc), "RemoteRunState carries the probe stamp");
  must(
    /\.cf-mock-star-pad/.test(mockExtractSrc),
    "the mock's star-pad lever exists (the sync-cap forcing dialect)"
  );
  // t324-a — the review's residuals, pinned (source-level invariant
  // verification: both MEDIUM shapes need disproportionate live rigs — a
  // remote motioncorr→ctffind chain with a stayed corrected star, and a
  // remote topaztrain chain — so their contracts ride the ledger)
  must(
    /micrographs star consumed in place from the cluster \(no local copy was synced\)/.test(remoteSrc),
    "t324-a: a twin-resolved ctffind star degrades to the ADVISORY note, never silence (the NZ door's own dialect)"
  );
  must(
    /Topaz training builds its picks index from the input stars on THIS machine/.test(remoteSrc) &&
      /waiting: "not-ready"/.test(remoteSrc),
    "t324-a: topaztrain with cluster-only stars pendings with the remediation instead of spawning a doomed run"
  );
  must(
    /cd \$\{W\} 2>\/dev\/null \|\| exit 3/.test(remoteSrc) && /res\.code === 0/.test(remoteSrc),
    "t324-a: an unenterable workdir is an UNSTAMPED negative (exit 3 ≠ verified absent — the heal retries for real)"
  );
  must(
    /LC_ALL=C sort/.test(remoteSrc),
    "t324-a: the iteration glob's sort is byte-order pinned (LC_ALL=C — no locale reorders the pick)"
  );

  console.log(fail === 0 ? "\n== t324 diag: ALL GREEN ==" : `\n== t324 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side shells + the levers ----
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  for (const pid of [projectIdA, projectIdB]) {
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
    client("rm -rf /data2/t324-mics /tmp/.t324-mic.mrc ~/.cf-mock-star-pad");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

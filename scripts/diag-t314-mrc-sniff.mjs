#!/usr/bin/env node
/**
 * t314 diag — the CTF gate reads BYTES, not names. The user's follow-up to
 * t312: "我导入的是做过motion correction的micrograph了啊，可以直接做ctf啊" —
 * and they were RIGHT. Their Micrographs/ folder holds MotionCor2 outputs
 * (*_Fractions_DW.mrc — motioncor2 keeps the movie basename), summed
 * single-section micrographs that the t312 filename smell refused as "raw
 * movie stacks". The evidence was on their own listing all along: Fractions
 * + Fractions_DW pairs at IDENTICAL 64.0 MB (4096×4096 float32, one
 * section) — a real stack never matches its sum's size.
 *
 * This suite proves the t314 contract end to end against the mock cluster:
 *
 *  1. THE REGRESSION (the user's exact case): a folder of *_Fractions.mrc +
 *     *_Fractions_DW.mrc files whose REAL headers say NZ=1 — import says
 *     "single-section MRCs … CTF-ready" in the receipt, and the CTF
 *     dispatch is ACCEPTED (t312 refused it), completes, and the submitted
 *     script + run.out carry the CRYOFLOW_NOTE receipt.
 *  2. THE HONEST REFUSAL: *_Fractions.mrc files whose headers say NZ=40 —
 *     import says "40-section frame stacks", the CTF dispatch is refused
 *     pre-staging with the header's own numbers as evidence, the row is
 *     not failed, nothing lands on the cluster.
 *  3. .eer: raw by definition — refused without any bytes crossing the wire.
 *  4. THE CONTROL: mic_*.mrcs (no smell) dispatch for real, no note —
 *     zero false positives, zero noise.
 *
 * Run against the standalone prod server on :3001 (t301/t311 doctrine).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t314";
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
/** stdout AND stderr — a bash syntax error in a fixture command must not
 *  pass silently as "built quietly" (the first run's lesson). */
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

// ---------------------------------------------------------------- try/catch
try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t314",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t314 bytes over names", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");

  // ======================================================================
  console.log("== PHASE 1: fixtures with REAL MRC headers ==");
  // the user's exact case: Fractions + Fractions_DW pairs, every header NZ=1
  // (motioncor2's summed outputs — 4096x4096 float32 like a Falcon 4i)
  // plus a raw-movie folder (NZ=40 stacks) and a clean control folder.
  const mrc = (nx, ny, nz, mode) => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(nx, 0);
    b.writeInt32LE(ny, 4);
    b.writeInt32LE(nz, 8);
    b.writeInt32LE(mode, 12);
    return b;
  };
  const singleB64 = mrc(4096, 4096, 1, 2).toString("base64");
  const stackB64 = mrc(5760, 4092, 40, 1).toString("base64");
  const mkFixtures =
    "mkdir -p /data2/corrected-t314 /data2/rawmovies-t314 /data2/mics-t314 /data2/eer-t314; " +
    `echo ${singleB64} | base64 -d > /tmp/.t314-single.mrc; ` +
    `echo ${stackB64} | base64 -d > /tmp/.t314-stack.mrc; ` +
    "for i in $(seq 1 60); do " +
    "if [ $((i % 2)) -eq 0 ]; then " +
    "cp /tmp/.t314-single.mrc /data2/corrected-t314/20241031_lijing_925_neiyan_2_1_20241031_${i}_Fractions_DW.mrc; " +
    "else cp /tmp/.t314-single.mrc /data2/corrected-t314/20241031_lijing_925_neiyan_2_1_20241031_${i}_Fractions.mrc; fi; done; " +
    "for i in $(seq 1 40); do cp /tmp/.t314-stack.mrc /data2/rawmovies-t314/20241031_lijing_925_neiyan_2_1_20241031_${i}_Fractions.mrc; done; " +
    "for i in $(seq 1 12); do cp /tmp/.t314-single.mrc /data2/mics-t314/mic_${i}.mrcs; done; " +
    "for i in $(seq 1 20); do printf EERMOCK > /data2/eer-t314/20241031_${i}.eer; done";
  const fixtureOut = clientBoth(mkFixtures);
  must(fixtureOut === "", `the fixtures build quietly (${fixtureOut.slice(0, 120)})`);
  const nCorrected = client("ls /data2/corrected-t314 | wc -l");
  const nRaw = client("ls /data2/rawmovies-t314 | wc -l");
  const nMics = client("ls /data2/mics-t314 | wc -l");
  must(nCorrected.trim() === "60", `corrected-t314 holds 60 (${nCorrected})`);
  must(nRaw.trim() === "40", `rawmovies-t314 holds 40 (${nRaw})`);
  must(nMics.trim() === "12", `mics-t314 holds 12 (${nMics})`);

  // ======================================================================
  console.log("== PHASE 2: THE REGRESSION — corrected micrographs ride the CTF lane ==");
  const importA = await mkJob({
    projectId,
    type: "import",
    name: "QA t314 corrected mics",
    params: { micrographsPath: "/data2/corrected-t314", pixelSize: 0.93, voltage: 300 },
  });
  must(!!importA?.id, "the corrected import job creates");
  const runA = await api(`/api/jobs/${importA.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runA.status >= 200 && runA.status < 300, `the corrected import run accepts (${runA.status})`);
  const doneA = await pollUntil(async () => {
    const j = await jobById(importA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneA?.status === "completed", `the corrected import completes (${doneA?.status})`);
  const resA = String(doneA?.result ?? "");
  must(/60 micrographs imported/.test(resA), `the import counts 60: ${resA.slice(0, 110)}`);
  must(
    /single-section MRCs 4096×4096 \(mode 2\)/i.test(resA) && /CTF-ready/i.test(resA),
    `the import receipt says what the bytes are: ${resA.slice(0, 200)}`
  );

  const ctfA = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t314 corrected ctf",
    params: {},
  });
  must(!!ctfA?.id, "the corrected ctffind job creates");
  const edgeA = await mkEdge(importA.id, ctfA.id, "micrographs", "micrographs");
  must(edgeA === 200 || edgeA === 201, `the edge wires import → ctffind (${edgeA})`);

  // THE assertion of this ticket: t312 refused exactly this dispatch
  const dispatchA = await api(`/api/jobs/${ctfA.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
    }),
  });
  must(dispatchA.status >= 200 && dispatchA.status < 300, `the dispatch route answers (${dispatchA.status})`);
  must(!dispatchA.body?.error, `the corrected-micrograph dispatch is ACCEPTED, not refused (${String(dispatchA.body?.error ?? "").slice(0, 120)})`);
  const doneCtfA = await pollUntil(async () => {
    const j = await jobById(ctfA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(doneCtfA?.status === "completed", `the corrected ctffind completes (${doneCtfA?.status}: ${String(doneCtfA?.result ?? "").slice(0, 90)})`);
  must(!/frame stack/i.test(String(doneCtfA?.result ?? "")), "no movie-stack smell on the corrected result");

  // the receipt: the submitted script + run.out carry the CRYOFLOW_NOTE
  const workdirA = `/projects/cryoflow/${projectId}/ctffind_${ctfA.id.slice(-8)}`;
  const sbatchA = client(`cat ${workdirA}/.cf-sbatch.sh 2>/dev/null`);
  must(/CRYOFLOW_NOTE:/.test(sbatchA), `the submitted script carries the receipt (CRYOFLOW_NOTE)`);
  must(
    /single-section MRCs 4096×4096/i.test(sbatchA) && /motion-corrected micrographs/i.test(sbatchA),
    `the receipt names the verified bytes: ${sbatchA.split("\n").find((l) => l.includes("CRYOFLOW_NOTE"))?.slice(0, 140) ?? ""}`
  );
  const runOutA = client(`cat ${workdirA}/run.out 2>/dev/null`);
  must(/CRYOFLOW_NOTE:.*single-section/i.test(runOutA), "run.out carries the echoed receipt (the Log tab's view)");

  // ======================================================================
  console.log("== PHASE 3: THE HONEST REFUSAL — verified frame stacks stay out ==");
  const importB = await mkJob({
    projectId,
    type: "import",
    name: "QA t314 raw movies",
    params: { micrographsPath: "/data2/rawmovies-t314", pixelSize: 0.5, voltage: 300 },
  });
  must(!!importB?.id, "the raw import job creates");
  const runB = await api(`/api/jobs/${importB.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runB.status >= 200 && runB.status < 300, `the raw import run accepts (${runB.status})`);
  const doneB = await pollUntil(async () => {
    const j = await jobById(importB.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneB?.status === "completed", `the raw import completes (${doneB?.status})`);
  const resB = String(doneB?.result ?? "");
  must(
    /40-section frame stacks/i.test(resB) && /MotionCorr/.test(resB),
    `the raw import receipt warns by the headers: ${resB.slice(0, 200)}`
  );

  const ctfB = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t314 doomed ctf",
    params: {},
  });
  must(!!ctfB?.id, "the doomed ctffind job creates");
  const edgeB = await mkEdge(importB.id, ctfB.id, "micrographs", "micrographs");
  must(edgeB === 200 || edgeB === 201, `the doomed edge wires (${edgeB})`);

  const projShellBefore = client("ls /projects/cryoflow/ 2>/dev/null").split("\n").filter(Boolean);
  const dispatchB = await api(`/api/jobs/${ctfB.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
    }),
  });
  must(dispatchB.status >= 200 && dispatchB.status < 300, `the dispatch route answers (${dispatchB.status})`);
  must(!!dispatchB.body?.error, "the verified-stack dispatch is refused (an error rides the response)");
  const errB = String(dispatchB.body?.error ?? "");
  must(/MotionCorr/.test(errB), "the refusal teaches the fix (MotionCorr first)");
  must(/frame stack/i.test(errB), "the refusal names the disease");
  must(/40 sections/.test(errB), `the refusal carries the header's NZ as evidence: ${errB.slice(0, 120)}…`);
  must(/5760×4092|5760x4092/.test(errB), "the refusal names the verified dimensions");
  must(/40 of 40/.test(errB), "the refusal counts the smelled rows");
  must(
    dispatchB.body?.waiting === undefined,
    "the refusal rides the request lane (no `waiting` — the row is neither pending nor failed)"
  );
  const ctfBafter = await jobById(ctfB.id);
  must(ctfBafter?.status !== "failed", `the job row is NOT failed (${ctfBafter?.status})`);
  const projShellAfter = client("ls /projects/cryoflow/ 2>/dev/null").split("\n").filter(Boolean);
  must(
    projShellAfter.length === projShellBefore.length,
    "NOTHING landed on the cluster (refused before staging)"
  );

  // ======================================================================
  console.log("== PHASE 3b: .eer is raw by definition (no bytes needed) ==");
  const importE = await mkJob({
    projectId,
    type: "import",
    name: "QA t314 eer movies",
    params: { micrographsPath: "/data2/eer-t314", pixelSize: 0.5, voltage: 300 },
  });
  must(!!importE?.id, "the eer import job creates");
  const runE = await api(`/api/jobs/${importE.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runE.status >= 200 && runE.status < 300, `the eer import run accepts (${runE.status})`);
  const doneE = await pollUntil(async () => {
    const j = await jobById(importE.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneE?.status === "completed", `the eer import completes (${doneE?.status})`);
  must(
    /\.eer event records — raw movies/i.test(String(doneE?.result ?? "")),
    `the eer import receipt says raw: ${String(doneE?.result ?? "").slice(0, 160)}`
  );
  const ctfE = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t314 eer ctf",
    params: {},
  });
  const edgeE = await mkEdge(importE.id, ctfE.id, "micrographs", "micrographs");
  must(edgeE === 200 || edgeE === 201, `the eer edge wires (${edgeE})`);
  const dispatchE = await api(`/api/jobs/${ctfE.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
    }),
  });
  must(!!dispatchE.body?.error, "the .eer dispatch is refused");
  must(
    /\.eer electron event records/i.test(String(dispatchE.body?.error ?? "")) && /MotionCorr/.test(String(dispatchE.body?.error ?? "")),
    `the .eer refusal speaks the format: ${String(dispatchE.body?.error ?? "").slice(0, 120)}…`
  );

  // ======================================================================
  console.log("== PHASE 4: the control — no smell, no GATE sniff, same factual receipt ==");
  const importC = await mkJob({
    projectId,
    type: "import",
    name: "QA t314 control mics",
    params: { micrographsPath: "/data2/mics-t314", pixelSize: 1.0, voltage: 300 },
  });
  must(!!importC?.id, "the control import job creates");
  const runC = await api(`/api/jobs/${importC.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runC.status >= 200 && runC.status < 300, `the control import run accepts (${runC.status})`);
  const doneC = await pollUntil(async () => {
    const j = await jobById(importC.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneC?.status === "completed", `the control import completes (${doneC?.status})`);
  // the import receipt sniffs ALWAYS (the user deserves the bytes' identity
  // on every import — that confusion started this ticket); the GATE sniffs
  // only when the names smell. So the control gets the same factual note,
  // never a stack warning.
  must(
    /headers \(3 sampled\): single-section MRCs 4096×4096/i.test(String(doneC?.result ?? "")) &&
      !/frame stack/i.test(String(doneC?.result ?? "")),
    `the control receipt carries the factual sniff, no stack warning: ${String(doneC?.result ?? "").slice(0, 180)}`
  );

  const ctfC = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t314 control ctf",
    params: {},
  });
  const edgeC = await mkEdge(importC.id, ctfC.id, "micrographs", "micrographs");
  must(edgeC === 200 || edgeC === 201, `the control edge wires (${edgeC})`);
  const dispatchC = await api(`/api/jobs/${ctfC.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
    }),
  });
  must(dispatchC.body?.ok !== false, `the control dispatches (${dispatchC.body?.error ?? "accepted"})`);
  const doneCtfC = await pollUntil(async () => {
    const j = await jobById(ctfC.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(doneCtfC?.status === "completed", `the control ctffind completes (${doneCtfC?.status}: ${String(doneCtfC?.result ?? "").slice(0, 90)})`);
  // no smell → the gate exits before any sniff → NO note in the script
  const workdirC = `/projects/cryoflow/${projectId}/ctffind_${ctfC.id.slice(-8)}`;
  const sbatchC = client(`cat ${workdirC}/.cf-sbatch.sh 2>/dev/null`);
  must(!/CRYOFLOW_NOTE:/.test(sbatchC), "the control script carries NO note (the gate never sniffed)");

  // ======================================================================
  console.log("== PHASE 5: the ledger (source contracts) ==");
  const sniffSrc = readFileSync(`${ROOT}/src/lib/relion/mrc-sniff.ts`, "utf8");
  must(
    /parseMrcHeaderBytes/.test(sniffSrc) && /SNIFF_SAMPLE_N/.test(sniffSrc) && /spreadSample/.test(sniffSrc),
    "B: mrc-sniff.ts owns the pure parser + spread sampler"
  );
  const remoteSniffSrc = readFileSync(`${ROOT}/src/lib/remote/sniff.ts`, "utf8");
  must(/head -c 64/.test(remoteSniffSrc) && /base64/.test(remoteSniffSrc), "B: the remote sniffer is one SSH round trip (head -c | base64)");
  const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  must(
    /ctffindInputGate/.test(engineSrc) && /localHeaderSniffer/.test(engineSrc) && !/ctffindMovieStackRefusal/.test(engineSrc),
    "B: the t312 filename refusal is GONE — the gate + local sniffer own the door"
  );
  must(
    /remoteHeaderSniffer\(conn\)\(spreadSample\(mrcs\)\)/.test(engineSrc),
    "B: the import leg sniffs the bytes and speaks the receipt"
  );
  const remoteRunSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  must(
    remoteRunSrc.includes("ctffindInputGate") && remoteRunSrc.includes("remoteHeaderSniffer(conn)") &&
      /note: ctffindGateNote \?\? extractGateNote \?\? particlesGateNote,/.test(remoteRunSrc),
    "B: the remote dispatch gates by bytes and passes the note to the script builders (the t338 chain: CTF → extract → particles-ref gates, first note wins)"
  );
  must(
    remoteRunSrc.includes("CRYOFLOW_NOTE") && remoteRunSrc.includes("rejected EVERY micrograph at once"),
    "B: the receipt rides the script + the compact diagnosis speaks the new truth"
  );
  const diagSrc = readFileSync(`${ROOT}/src/lib/log-diagnosis.ts`, "utf8");
  must(
    /ctffind-no-fit/.test(diagSrc) && /NZ>1 means raw frame stacks/.test(diagSrc) && /mode 12/.test(diagSrc),
    "B: the Log tab hint orders the honest suspects (stacks → ctffind build → pixel size)"
  );
  // the regex itself against the USER'S OWN pasted error text (verbatim)
  const userError =
    "WARNING: skipping, since cannot get CTF values for /data06/x.mrc\nERROR:\n/opt/ohpc/pub/apps/relion//deps/bin/ctffind failed to estimate CTF parameters for any micrograph, exiting...";
  must(
    /failed to estimate CTF parameters for any micrograph|cannot get CTF values for/i.test(userError),
    "the signature still matches the user's real cluster error verbatim"
  );

  console.log(`\n== t314 diag: ${fail === 0 ? "ALL GREEN" : `${fail} FAIL`} ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side shells + the fixtures ----
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
    client("rm -rf /data2/corrected-t314 /data2/rawmovies-t314 /data2/mics-t314 /data2/eer-t314 /tmp/.t314-single.mrc /tmp/.t314-stack.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

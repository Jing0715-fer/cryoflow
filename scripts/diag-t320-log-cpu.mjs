#!/usr/bin/env node
/**
 * t320 diag — the LoG picker never sees --gpu, on any lane.
 *
 * The user's ticket (the real cluster, post-t319):
 *   ----- stderr -----
 *   in: /data2/home/relion5/relion2/relion-master/src/autopicker.cpp, line 146
 *   ERROR:
 *   The Laplacian-of-Gaussian picker does not support GPU acceleration.
 *   Please remove --gpu option.
 *   === Backtrace === (…build/bin/relion_autopick …)
 *
 * The anatomy: EVERY GPU decision in the app is TYPE-driven (gpuStrategyFor:
 * autopick → "array", gpus: 1; the remote dispatch's append block then added
 * `--gpu 0` + `#SBATCH --gres=gpu:1`), but the refusal is a property of the
 * FLAG PAIR — RELION's autopicker.cpp read() hard-errors on `do_gpu &&
 * do_LoG` (verified against master: the check sits right after the LoG
 * option section, line ~146 in the user's build). The user's LoG dispatch
 * (the DEFAULT pick method!) carried the pair and died at argv-parse time,
 * before the first micrograph. THREE surfaces sent that pair:
 *   1. remote-run.ts's GPU adaptation (slurm AND direct lanes),
 *   2. the sbatch EXPORT route (hpc/slurm.ts buildSbatchForJob),
 *   3. the run dialog's GPU stepper (a knob the dispatch would refuse).
 *
 * THE FIX: one pure predicate (src/lib/relion/log-autopick.ts —
 * isLogAutopick) shared by every layer; the strategy gains a logAutopick
 * door (gpus → 0: no --gpu, no --gres, gpusRequested 0); the append block
 * carries a belt-and-braces splice on the FINAL argv; the stepper states
 * the CPU contract instead of offering a width; the mock relion_autopick
 * now refuses the pair EXACTLY where the real binary does, so a regression
 * that re-adds --gpu fails LOUDLY instead of completing silently.
 * References (template matching) and Topaz (the CNN wrapper) keep their
 * GPUs — RELION's own GUI allows them there.
 *
 * PHASES:
 *  A. UNIT — the pure predicate's truth table; the strategy door (LoG →
 *     gpus 0, References/default control → 1, flag inert for other types);
 *     the mock gate executed DIRECTLY (exit 1 + the user's exact stderr
 *     text on the pair; exit 0 without --gpu; exit 0 for --gpu WITHOUT
 *     --LoG — References keeps its GPU).
 *  B. LIVE A — the user's exact scenario: import 8 cluster-side micrographs
 *     → Auto-picking (LoG, the default) dispatched sbatch @ gpus: 6 (the
 *     stepper default): COMPLETED, the sbatch script carries NO --gpu, NO
 *     --gres, --ntasks=1, no mpirun; run.out speaks LoG picking with zero
 *     refusal text; the record's gpusRequested is 0; the recorded launch
 *     command carries no --gpu.
 *  C. LIVE B — the CONTROL chain keeps its word: the LoG picks feed
 *     Extract → Class2D → a SECOND Auto-picking in References mode, whose
 *     sbatch script DOES carry `--gpu 0` + `--gres=gpu:1` and COMPLETES —
 *     the fix narrows to the LoG door, it never gates the whole type.
 *  D. EXPORT — the /api/hpc/sbatch dry-run door agrees with the dispatch:
 *     LoG script has no --gpu and strategy.gpus 0; References script has
 *     `--gpu 0` and strategy.gpus 1.
 *  E. DIRECT — the second lane: a LoG Auto-picking dispatched DIRECT-mode
 *     completes and its recorded launch command carries no --gpu.
 *  F. LEDGER — every source contract pinned (predicate, strategy door,
 *     splice, gpusRequested 0, UI CPU row, mock gate, diagnosis pattern).
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t320";
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

/** run the pure predicate in bun (TS imports natively, zero heavy deps). */
const unitIsLog = (type, params) => {
  const prog = [
    `const { isLogAutopick } = await import(${JSON.stringify(
      path.join(ROOT, "src/lib/relion/log-autopick.ts")
    )});`,
    `console.log(isLogAutopick(${JSON.stringify(type)}, ${JSON.stringify(params)}));`,
  ].join("\n");
  const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
  return r.stdout?.trim().split("\n").pop();
};

/** the strategy door, in bun with the DB env the engine import chain needs. */
const unitStrategy = (type, opts) => {
  const prog = [
    `const { gpuStrategyFor } = await import(${JSON.stringify(path.join(ROOT, "src/lib/hpc/slurm.ts"))});`,
    `const s = gpuStrategyFor(${JSON.stringify(type)}, ${JSON.stringify(opts)});`,
    `console.log(JSON.stringify({ gpus: s.gpus, mode: s.mode, reason: s.reason }));`,
  ].join("\n");
  const r = spawnSync("bun", ["-e", prog], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, DATABASE_URL: "file:/home/z/cryoflow/db/cryoflow.db" },
  });
  if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
  const v = r.stdout?.trim().split("\n").pop();
  try {
    return JSON.parse(v);
  } catch {
    return `UNIT-PARSE-ERROR: ${v?.slice(0, 120)}`;
  }
};

/** execute the mock's relion_autopick DIRECTLY — the gate is a property of
 *  the binary, so prove it at the binary, before any app layer. */
const runMockAutopick = (args) => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "t320-autopick-"));
  try {
    const star = path.join(tmp, "mics.star");
    writeFileSync(star, "data_\n\nloop_\n_rlnMicrographName #1\nmic_01.mrc\n");
    const r = spawnSync(
      "python3",
      [path.join(ROOT, "services/mock-cluster/fs/opt/bin/relion_autopick"), "--i", star, "--odir", tmp, ...args],
      { encoding: "utf8", timeout: 60_000 }
    );
    return { code: r.status, stderr: r.stderr ?? "", stdout: r.stdout ?? "" };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

const awaitJobTerminal = async (id, deadlineMs) => {
  const done = await pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);
  return done;
};

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t320",
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
    body: JSON.stringify({ name: "QA t320 log cpu", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const projRoot = `/projects/cryoflow/${projectId}`;

  // ======================================================================
  console.log("== PHASE A: UNIT — the predicate, the strategy door, the binary's own gate ==");

  // the predicate's truth table — the DEFAULT is LoG (safe side)
  must(unitIsLog("autopick", {}) === "true", "autopick with no params IS LoG (the default)");
  must(unitIsLog("autopick", undefined) === "true", "autopick with NO params object IS LoG");
  must(
    unitIsLog("autopick", { pickingMethod: "References" }) === "false",
    "References picking is NOT LoG (GPU path)"
  );
  must(unitIsLog("autopick", { pickingMethod: "Topaz" }) === "false", "Topaz picking is NOT LoG (GPU path)");
  must(
    unitIsLog("autopick", JSON.stringify({ pickingMethod: "Laplacian of Gaussian" })) === "true",
    "the prisma JSON-STRING params form parses (the dispatch's Job shape)"
  );
  must(unitIsLog("autopick", "not-json{") === "true", "unparseable params default to the SAFE side (LoG)");
  must(unitIsLog("motioncorr", {}) === "false", "the predicate never speaks for another type");
  must(
    unitIsLog("ctffind", { pickingMethod: "Laplacian of Gaussian" }) === "false",
    "a LoG-named param on another type is inert"
  );

  // t321 — the MIRROR: the predicate's classification must agree with the
  // argv builder byte-for-byte (engine str(): no trim, no case-folding;
  // exactly two NAMED branches). Whatever the builder would send --LoG for,
  // the GPU decision must treat as CPU-only — the review's HIGH was an
  // exact-match predicate that handed non-canonical forms a GPU.
  must(unitIsLog("autopick", { pickingMethod: "LoG" }) === "true", "non-canonical 'LoG' mirrors the builder's else-branch (CPU)");
  must(unitIsLog("autopick", { pickingMethod: "laplacian of gaussian" }) === "true", "the lower-case variant mirrors the builder (→ --LoG → CPU)");
  must(unitIsLog("autopick", { pickingMethod: " References " }) === "true", "padded ' References ' mirrors the builder (str() never trims → --LoG → CPU)");
  must(unitIsLog("autopick", { pickingMethod: 5 }) === "true", "a NUMBER param mirrors the builder (String(5) → else-branch → CPU)");
  must(unitIsLog("autopick", { pickingMethod: "" }) === "true", "empty string mirrors the builder (else-branch → CPU)");
  must(unitIsLog("autopick", JSON.stringify({ pickingMethod: "Topaz" })) === "false", "the prisma-string form still classifies Topaz (GPU)");

  // the strategy door
  const logStrategy = unitStrategy("autopick", { micrographs: 8, logAutopick: true });
  must(logStrategy?.gpus === 0, `gpuStrategyFor(autopick, logAutopick) → gpus 0 (got ${logStrategy?.gpus})`);
  must(
    /CPU-only/.test(String(logStrategy?.reason ?? "")),
    "the LoG strategy's reason states the CPU-only contract"
  );
  const refStrategy = unitStrategy("autopick", { micrographs: 8 });
  must(refStrategy?.gpus === 1, `gpuStrategyFor(autopick) default → gpus 1, the control (got ${refStrategy?.gpus})`);
  const refStrategy2 = unitStrategy("autopick", { micrographs: 8, logAutopick: false });
  must(refStrategy2?.gpus === 1, "logAutopick:false → gpus 1 (References/Topaz keep their GPU)");
  const mcStrategy = unitStrategy("motioncorr", { micrographs: 8, logAutopick: true });
  must(mcStrategy?.gpus === 1, "the logAutopick flag is INERT for other types (motioncorr still 1 GPU)");
  const clsStrategy = unitStrategy("class2d", { particles: 5000, gpus: 4, logAutopick: true });
  must(clsStrategy?.gpus === 4, "class2d multi-GPU untouched by the flag (4 GPUs stay 4)");

  // the BINARY's own gate — the user's exact receipt, reproduced at the stub
  const gateHit = runMockAutopick(["--LoG", "--LoG_diam_min", "120", "--LoG_diam_max", "180", "--gpu", "0"]);
  must(gateHit.code === 1, `the mock binary REFUSES --LoG + --gpu (exit ${gateHit.code})`);
  must(
    /Laplacian-of-Gaussian picker does not support GPU acceleration\. Please remove --gpu option\./.test(
      gateHit.stderr
    ),
    "the refusal text is VERBATIM the user's stderr (…does not support GPU acceleration. Please remove --gpu option.)"
  );
  must(/autopicker\.cpp/.test(gateHit.stderr), "the refusal cites autopicker.cpp (the user's backtrace anchor)");
  const gatePass = runMockAutopick(["--LoG", "--LoG_diam_min", "120", "--LoG_diam_max", "180"]);
  must(gatePass.code === 0, `--LoG WITHOUT --gpu completes (exit ${gatePass.code}) — the fix's target state`);
  const gateRef = runMockAutopick(["--ref", "refs.mrc", "--particle_diameter", "180", "--gpu", "0"]);
  must(
    gateRef.code === 0 || /cannot read input star/.test(gateRef.stderr) === false,
    "--gpu WITHOUT --LoG does not trip the gate (References keeps its GPU)"
  );

  // ======================================================================
  console.log("== PHASE B: LIVE A — the user's exact scenario, LoG @ sbatch gpus:6 ==");
  const mrcHdr = (() => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(4096, 0);
    b.writeInt32LE(4096, 4);
    b.writeInt32LE(1, 8); // NZ=1 — single-section, CTF-ready
    b.writeInt32LE(2, 12); // mode 2
    return b.toString("base64");
  })();
  const fx = clientBoth(
    "mkdir -p /data2/t320-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t320-mic.mrc; ` +
      "for i in $(seq 1 8); do cp /tmp/.t320-mic.mrc /data2/t320-mics/mic_$(printf %02d $i).mrc; done"
  );
  must(fx === "", `the 8 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t320 import",
    params: {
      micrographsPath: Array.from({ length: 8 }, (_, i) => `/data2/t320-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!importJob?.id, "the import job creates");
  const runImport = await api(`/api/jobs/${importJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImport.status >= 200 && runImport.status < 300, `the import run accepts (${runImport.status})`);
  const doneImport = await awaitJobTerminal(importJob.id, 90_000);
  must(doneImport?.status === "completed", `the import completes (${doneImport?.status}: ${String(doneImport?.result ?? "").slice(0, 80)})`);

  // the LoG Auto-picking — DEFAULT params (pickingMethod unset = LoG, the
  // user's world), dispatched at the stepper's default width of SIX
  const logJob = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t320 autopick LoG",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  must(!!logJob?.id, "the LoG autopick job creates");
  const edgeB = await mkEdge(importJob.id, logJob.id, "micrographs", "micrographs");
  must(edgeB === 200 || edgeB === 201, `the edge wires import → autopick LoG (${edgeB})`);
  const workdirB = `${projRoot}/autopick_${logJob.id.slice(-8)}`;

  const dispatchB = await dispatch(logJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 6 },
  });
  must(dispatchB.status >= 200 && dispatchB.status < 300, `the LoG dispatch answers (${dispatchB.status})`);
  must(!dispatchB.body?.error, `the LoG dispatch is ACCEPTED (${String(dispatchB.body?.error ?? "").slice(0, 100)})`);

  const doneLog = await awaitJobTerminal(logJob.id, 180_000);
  must(
    doneLog?.status === "completed",
    `the LoG autopick COMPLETES on the cluster (${doneLog?.status}: ${String(doneLog?.result ?? "").slice(0, 90)})`
  );

  // the script itself — the pair must be absent at every layer
  const sbatchB = client(`cat ${workdirB}/.cf-sbatch.sh 2>/dev/null`);
  must(sbatchB.length > 0, "the sbatch script is on disk (.cf-sbatch.sh)");
  must(!/--gpu/.test(sbatchB), "the sbatch script carries NO --gpu (the pair is dead at the source)");
  must(!/--gres/.test(sbatchB), "the sbatch script requests NO --gres (no GPU is wasted on a CPU job)");
  must(/#SBATCH --ntasks=1/.test(sbatchB), "the sbatch script runs a single task (no MPI width for a CPU picker)");
  must(!/mpirun/.test(sbatchB), "no mpirun wrapper (the picker is not an MPI type)");
  must(/--LoG/.test(sbatchB), "the script still picks LoG (--LoG --LoG_diam_min/max ride along)");

  // the run itself — LoG picking happened, zero refusal text
  const runOutB = client(`cat ${workdirB}/run.out 2>/dev/null`);
  must(/log \(Laplacian of Gaussian\)/.test(runOutB), "run.out speaks the LoG picking line");
  must(/autopick done: \d+ particles across 8 micrographs/.test(runOutB), "run.out completes the pick count");
  must(
    !/does not support GPU acceleration/.test(runOutB),
    "run.out is FREE of the user's refusal text (the bug is extinct on this lane)"
  );

  // the record — the ledger tells the truth too
  const logRow = await jobById(logJob.id);
  must(logRow?.runRemote?.gpusRequested === 0, `the record's gpusRequested is 0 (got ${logRow?.runRemote?.gpusRequested})`);

  // the recorded launch command — what the inspector's "Command line
  // (recorded at launch)" would show the user
  const cmdB = await api(`/api/jobs/${logJob.id}/outputs`, { headers: SH });
  must(!/--gpu/.test(String(cmdB.body?.cmd ?? "")), "the RECORDED launch command carries no --gpu");

  // ======================================================================
  console.log("== PHASE C: LIVE B — the CONTROL chain: References keeps its GPU ==");
  // LoG picks → Extract → Class2D → a SECOND autopick in References mode,
  // dispatched the same way — it MUST still get its GPU.
  const extractJob = await mkJob({
    projectId,
    type: "extract",
    name: "QA t320 extract",
    params: { boxSize: 128, downsampleTo: 64 },
  });
  must(!!extractJob?.id, "the extract job creates");
  const edgeEx1 = await mkEdge(importJob.id, extractJob.id, "micrographs", "micrographs");
  const edgeEx2 = await mkEdge(logJob.id, extractJob.id, "coords", "coords");
  must(
    (edgeEx1 === 200 || edgeEx1 === 201) && (edgeEx2 === 200 || edgeEx2 === 201),
    `the edges wire import+autopick → extract (${edgeEx1}/${edgeEx2})`
  );
  const dispatchEx = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
  });
  must(dispatchEx.status >= 200 && dispatchEx.status < 300, `the extract dispatch answers (${dispatchEx.status})`);
  const doneEx = await awaitJobTerminal(extractJob.id, 180_000);
  must(doneEx?.status === "completed", `the extract completes (${doneEx?.status}: ${String(doneEx?.result ?? "").slice(0, 80)})`);

  const clsJob = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t320 class2d",
    params: { iterations: 2 },
  });
  must(!!clsJob?.id, "the class2d job creates");
  const edgeCls = await mkEdge(extractJob.id, clsJob.id, "particles", "particles");
  must(edgeCls === 200 || edgeCls === 201, `the edge wires extract → class2d (${edgeCls})`);
  const dispatchCls = await dispatch(clsJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2 },
  });
  must(dispatchCls.status >= 200 && dispatchCls.status < 300, `the class2d dispatch answers (${dispatchCls.status})`);
  const doneCls = await awaitJobTerminal(clsJob.id, 180_000);
  must(doneCls?.status === "completed", `the class2d completes (${doneCls?.status}: ${String(doneCls?.result ?? "").slice(0, 80)})`);

  // the References autopick — SAME type, DIFFERENT method: GPU stays
  const refJob = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t320 autopick References",
    params: { pickingMethod: "References", threshold: 0.4, particleDiameter: 180 },
  });
  must(!!refJob?.id, "the References autopick job creates");
  const edgeRef1 = await mkEdge(importJob.id, refJob.id, "micrographs", "micrographs");
  const edgeRef2 = await mkEdge(clsJob.id, refJob.id, "classAverages", "references");
  must(
    (edgeRef1 === 200 || edgeRef1 === 201) && (edgeRef2 === 200 || edgeRef2 === 201),
    `the edges wire import+class2d → autopick References (${edgeRef1}/${edgeRef2})`
  );
  const workdirC = `${projRoot}/autopick_${refJob.id.slice(-8)}`;

  const dispatchC = await dispatch(refJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2 },
  });
  must(dispatchC.status >= 200 && dispatchC.status < 300, `the References dispatch answers (${dispatchC.status})`);
  const doneRef = await awaitJobTerminal(refJob.id, 180_000);
  must(
    doneRef?.status === "completed",
    `the References autopick COMPLETES (${doneRef?.status}: ${String(doneRef?.result ?? "").slice(0, 90)})`
  );

  const sbatchC = client(`cat ${workdirC}/.cf-sbatch.sh 2>/dev/null`);
  must(sbatchC.length > 0, "the References sbatch script is on disk");
  must(/--gpu 0/.test(sbatchC), "the References sbatch script DOES carry --gpu 0 (the control keeps its GPU)");
  must(/--gres=gpu:1/.test(sbatchC), "the References sbatch script requests --gres=gpu:1");
  must(/--ref/.test(sbatchC), "the References script carries --ref (the template-matching face)");
  const refRow = await jobById(refJob.id);
  must(refRow?.runRemote?.gpusRequested === 2, `the References record's gpusRequested is the asked width (${refRow?.runRemote?.gpusRequested})`);
  const runOutC = client(`cat ${workdirC}/run.out 2>/dev/null`);
  must(
    !/does not support GPU acceleration/.test(runOutC),
    "the References run.out is free of refusal text (no --LoG, no gate)"
  );

  // ======================================================================
  console.log("== PHASE D: EXPORT — the sbatch dry-run door agrees ==");
  const exportLog = await api(`/api/hpc/sbatch/${logJob.id}`, { headers: SH });
  must(exportLog.status === 200, `the LoG export answers (${exportLog.status})`);
  must(!/--gpu/.test(String(exportLog.body?.script ?? "")), "the exported LoG script carries no --gpu");
  must(!/--gres/.test(String(exportLog.body?.script ?? "")), "the exported LoG script requests no --gres");
  must(exportLog.body?.strategy?.gpus === 0, `the exported LoG strategy.gpus is 0 (got ${exportLog.body?.strategy?.gpus})`);
  const exportRef = await api(`/api/hpc/sbatch/${refJob.id}`, { headers: SH });
  must(exportRef.status === 200, `the References export answers (${exportRef.status})`);
  must(/--gpu 0/.test(String(exportRef.body?.script ?? "")), "the exported References script carries --gpu 0");
  must(exportRef.body?.strategy?.gpus === 1, `the exported References strategy.gpus is 1 (got ${exportRef.body?.strategy?.gpus})`);

  // t321 — the queue SIMULATOR speaks the same dialect: the LoG autopick
  // bills 0 GPUs, the References one bills its 1 — the plan the user reads
  // must match what the dispatch actually requests.
  const sim = await api("/api/hpc/simulate", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ clusterGpus: 8, nodes: 2 }),
  });
  must(sim.status === 200, `the simulate route answers (${sim.status})`);
  const bars = sim.body?.bars ?? [];
  const logBars = bars.filter((b) => b.key === logJob.id);
  const refBars = bars.filter((b) => b.key === refJob.id);
  must(
    logBars.length > 0 && logBars.every((b) => b.gpus === 0),
    `the simulated LoG autopick bills 0 GPUs (bars: ${JSON.stringify(logBars.map((b) => b.gpus))})`
  );
  must(
    refBars.length > 0 && refBars.every((b) => b.gpus === 1),
    `the simulated References autopick bills its 1 GPU (bars: ${JSON.stringify(refBars.map((b) => b.gpus))})`
  );

  // ======================================================================
  console.log("== PHASE E: DIRECT — the second lane keeps the same word ==");
  const logJob2 = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t320 autopick LoG direct",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  must(!!logJob2?.id, "the direct-mode LoG autopick job creates");
  const edgeE = await mkEdge(importJob.id, logJob2.id, "micrographs", "micrographs");
  must(edgeE === 200 || edgeE === 201, `the edge wires import → autopick LoG direct (${edgeE})`);
  const workdirE = `${projRoot}/autopick_${logJob2.id.slice(-8)}`;
  const dispatchE = await dispatch(logJob2.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "direct" },
  });
  must(dispatchE.status >= 200 && dispatchE.status < 300, `the direct dispatch answers (${dispatchE.status})`);
  const doneE = await awaitJobTerminal(logJob2.id, 180_000);
  must(
    doneE?.status === "completed",
    `the direct-mode LoG autopick COMPLETES (${doneE?.status}: ${String(doneE?.result ?? "").slice(0, 90)})`
  );
  const cmdE = await api(`/api/jobs/${logJob2.id}/outputs`, { headers: SH });
  must(
    !/--gpu/.test(String(cmdE.body?.cmd ?? "")),
    "the direct lane's RECORDED launch command carries no --gpu"
  );
  const runOutE = client(`cat ${workdirE}/run.out 2>/dev/null`);
  must(/autopick done: \d+ particles across 8 micrographs/.test(runOutE), "the direct lane's run.out completes the pick count");
  must(
    !/does not support GPU acceleration/.test(runOutE),
    "the direct lane's run.out is free of the refusal text"
  );

  // ======================================================================
  console.log("== PHASE F: the LEDGER (source contracts) ==");
  const pureSrc = readFileSync(`${ROOT}/src/lib/relion/log-autopick.ts`, "utf8");
  const slurmSrc = readFileSync(`${ROOT}/src/lib/hpc/slurm.ts`, "utf8");
  const remoteSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const uiSrc = readFileSync(`${ROOT}/src/components/workflow/remote-run-button.tsx`, "utf8");
  const mockSrc = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/relion_autopick`, "utf8");
  const diagSrc = readFileSync(`${ROOT}/src/lib/log-diagnosis.ts`, "utf8");

  must(pureSrc.includes("export function isLogAutopick"), "the predicate lives in a PURE module (client/server/test)");
  must(
    /return method !== "References" && method !== "Topaz";/.test(pureSrc),
    "t321 — the predicate MIRRORS the builder's branches (non-canonical → LoG → CPU)"
  );
  const simulateSrc = readFileSync(`${ROOT}/src/app/api/hpc/simulate/route.ts`, "utf8");
  must(
    /logAutopick: isLogAutopick\(j\.type, j\.params\)/.test(simulateSrc),
    "t321 — the queue simulator threads the predicate (the plan bills no GPU for LoG)"
  );
  const dispatchSrc = readFileSync(`${ROOT}/src/lib/relion/dispatch.ts`, "utf8");
  must(
    /gpusRequested > 0/.test(dispatchSrc),
    "t321 — the passthrough omits a 0 width instead of forwarding it (the || 6 coercion trap)"
  );
  must(
    /logAutopick\?: boolean/.test(slurmSrc) && /isAutoPick && opts\.logAutopick/.test(slurmSrc),
    "the strategy has the logAutopick door (gpus → 0 branch)"
  );
  must(
    /const logAutopick = isLogAutopick\(job\.type, job\.params\)/.test(slurmSrc),
    "buildSbatchForJob threads the predicate into the strategy (the export door)"
  );
  must(
    /const logPick = isLogAutopick\(job\.type, job\.params\)/.test(remoteSrc) &&
      /logAutopick: logPick/.test(remoteSrc),
    "the remote dispatch threads the predicate into the strategy"
  );
  must(
    /if \(logPick\) \{[\s\S]*?argv\.splice\(gi, 2\)/.test(remoteSrc),
    "the belt-and-braces splice guards the FINAL argv"
  );
  must(
    /gpusRequested: logPick \? 0 : gpuWidth/.test(remoteSrc),
    "the record's gpusRequested tells the CPU truth for LoG"
  );
  must(
    /const logPick = isLogAutopick\(job\.type, job\.params\)/.test(uiSrc) &&
      /data-log-cpu-row/.test(uiSrc) &&
      /CPU \(LoG picker\)/.test(uiSrc),
    "the run dialog states the CPU contract (stepper trap removed)"
  );
  must(
    mockSrc.includes("does not support GPU acceleration") && /if "gpu" in opts and "LoG" in opts/.test(mockSrc),
    "the mock binary refuses the pair with the user's exact text"
  );
  must(
    /autopick-log-gpu/.test(diagSrc) && /Laplacian-of-Gaussian picker does not support GPU acceleration/i.test(diagSrc),
    "the log-diagnosis table knows the signature (old scripts get a named cause)"
  );

  console.log(fail === 0 ? "\n== t320 diag: ALL GREEN ==" : `\n== t320 diag: ${fail} FAIL ==`);
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
    client("rm -rf /data2/t320-mics /tmp/.t320-mic.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

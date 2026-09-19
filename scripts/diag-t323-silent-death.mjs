#!/usr/bin/env node
/**
 * diag-t323 — the silent death gets a name; the warning chorus gets paid off.
 *
 * The user's real-cluster receipt (576-micrograph LoG autopick, sbatch):
 *
 *   REMOTE[lijing@192.168.2.253]: exit 1 (RELION reported an error)
 *   — + WARNING: add --skip_optimise_scale to your autopick command …
 *   … run.out ends on a LIVE progress bar (0.31/3.82 hrs), run.err EMPTY,
 *   Failure diagnosis: 0 findings.
 *
 * THREE defects, all closed here:
 *   1. The receipt LIED about the cause: RELION master prints on EVERY
 *      in-code death (RelionError → stderr ERROR/backtrace; the exit
 *      wrapper → stdout "exiting with an error") — a silent exit 1 is an
 *      EXTERNAL kill (login-node CPU reaper / OOM / walltime), and the
 *      receipt must say so instead of sending the user hunting a RELION
 *      error that does not exist.
 *   2. The t318 evidence rescue never fired for this shape: errTail's
 *      run.out fallback made the `!errTail.trim()` gate always false
 *      whenever run.out had content — the cluster's run.err was never
 *      fetched, so a mid-run stderr error would stay invisible too. The
 *      trigger is now "no LOCAL stderr content".
 *   3. The warning chorus: RELION's own text says "add
 *      --skip_optimise_scale" — the LoG dispatch now carries the flag, the
 *      warnings are extinct at the source.
 *
 * Phases:
 *  A. UNIT — the diagnosis autopsy (bun, the pure module): the user's log
 *     shape → silent-run-death; signatures outrank the autopsy (gpu /
 *     Killed / completed tails); the stderr separator is structural.
 *     The mock binary's two new dialects: silent-death fixture (bars on
 *     stdout, exit 1, ZERO stderr) and the warning chorus WITHOUT the flag.
 *  B. LIVE SILENT DEATH — the user's scenario on the mock cluster: silent-
 *     death fixtures → import → LoG autopick @ sbatch → FAILED with the
 *     honest receipt ("printed no error", the external-kill suspects,
 *     sacct), the sbatch script carries --skip_optimise_scale, run.out has
 *     the bars and NO chorus, the cluster's run.err is empty.
 *  C. LIVE CONTROL — healthy fixtures: the LoG run completes, no chorus,
 *     the flag rides, the t320 contracts stay green (gpusRequested 0).
 *  D. LEDGER — every source contract pinned.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t323";
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

/** the diagnosis autopsy in bun (the pure module, no DB). */
const unitDiagnose = (lines) => {
  const prog = [
    `const { diagnoseFailureLines } = await import(${JSON.stringify(
      path.join(ROOT, "src/lib/log-diagnosis.ts")
    )});`,
    `const f = diagnoseFailureLines(${JSON.stringify(lines)});`,
    `console.log(JSON.stringify(f.map(x => ({ id: x.id, excerpt: x.excerpt }))));`,
  ].join("\n");
  const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
  try {
    return JSON.parse(r.stdout?.trim().split("\n").pop());
  } catch {
    return `UNIT-PARSE-ERROR: ${r.stdout?.slice(0, 160)}`;
  }
};

/** execute the mock's relion_autopick DIRECTLY (the binary's own dialects). */
const runMockAutopick = (mics, args) => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "t323-autopick-"));
  try {
    const star = path.join(tmp, "mics.star");
    writeFileSync(star, `data_\n\nloop_\n_rlnMicrographName #1\n${mics.join("\n")}\n`);
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

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/api/jobs", { headers: SH })).status === 200, "the dev server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t323",
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
    body: JSON.stringify({ name: "QA t323 silent death", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const projRoot = `/projects/cryoflow/${projectId}`;

  // ======================================================================
  console.log("== PHASE A: UNIT — the autopsy + the binary's two dialects ==");

  // the USER'S EXACT log shape → the silent-death finding
  const userShape = unitDiagnose([
    "    * micrographs/20241031_lijing_925_Fractions_DW.mrc",
    " + Will use following diameters for Laplacian-of-Gaussian filter: ",
    " + WARNING: Requested rescale of micrographs is 4096 pixels. The largest prime factor in FFTs is 683",
    " + WARNING: add --skip_optimise_scale to your autopick command to prevent rescaling",
    "Autopicking ...",
    '0.31/3.82 hrs ....~~(,_,"> [oo]',
  ]);
  must(
    Array.isArray(userShape) && userShape.length === 1 && userShape[0]?.id === "silent-run-death",
    `the user's log shape yields exactly the silent-run-death finding (got ${JSON.stringify(userShape).slice(0, 120)})`
  );
  must(
    Array.isArray(userShape) && /0\.31\/3\.82/.test(String(userShape[0]?.excerpt ?? "")),
    "the finding's excerpt is the final progress bar (the death spot)"
  );

  // signatures OUTRANK the autopsy
  const gpuShape = unitDiagnose([
    "in: src/autopicker.cpp, line 146",
    "ERROR:",
    "The Laplacian-of-Gaussian picker does not support GPU acceleration. Please remove --gpu option.",
  ]);
  must(
    Array.isArray(gpuShape) && gpuShape.length === 1 && gpuShape[0]?.id === "autopick-log-gpu",
    "a narrated death (the t320 GPU refusal) keeps its SIGNATURE (the autopsy stands down)"
  );
  const killedShape = unitDiagnose(["Micrograph 2/8: b.mrc", "Killed"]);
  must(
    Array.isArray(killedShape) && killedShape[0]?.id === "oom-kill",
    "a 'Killed' narration keeps the oom-kill signature (no silent verdict over a spoken death)"
  );
  const stderrTrail = unitDiagnose(['0.31/3.82 hrs ....~~(,_,"> [oo]', "----- stderr -----", "Killed"]);
  must(
    Array.isArray(stderrTrail) && stderrTrail[0]?.id === "oom-kill",
    "the stderr section's 'Killed' outranks the bar tail (the separator is structural, not evidence)"
  );

  // no false fires
  const doneShape = unitDiagnose([
    "Micrograph 8/8: h.mrc",
    "autopick done: 112 particles across 8 micrographs",
  ]);
  must(
    Array.isArray(doneShape) && doneShape.length === 0,
    "a COMPLETED tail finds nothing (no silent verdict over a finished run)"
  );
  const midBarHealthy = unitDiagnose([]);
  must(Array.isArray(midBarHealthy) && midBarHealthy.length === 0, "an empty log stays empty (t318's null-grade contract)");

  // the binary's SILENT-DEATH dialect, at the binary
  const silentRun = runMockAutopick(["silent-death-01.mrc"], ["--LoG", "--LoG_diam_min", "120", "--LoG_diam_max", "240", "--skip_optimise_scale", "--LoG_adjust_threshold", "0"]);
  must(silentRun.code === 1, `the silent-death fixture exits 1 (got ${silentRun.code})`);
  must(silentRun.stderr.trim() === "", "the silent-death fixture writes ZERO stderr (the user's exact shape)");
  must(/Autopicking \.\.\./.test(silentRun.stdout), "the silent-death fixture narrates stdout progress first");
  must(/0\.31\/3\.82 hrs/.test(silentRun.stdout), "the silent-death fixture ends on the live bar");
  must(!/ERROR/.test(silentRun.stdout), "the silent-death fixture prints no ERROR anywhere (silence is the point)");

  // the binary's WARNING-CHORUS dialect: present WITHOUT the flag, extinct WITH it
  const noFlag = runMockAutopick(["mic_01.mrc"], ["--LoG", "--LoG_diam_min", "120", "--LoG_diam_max", "240"]);
  must(/add --skip_optimise_scale to your autopick command/.test(noFlag.stdout), "WITHOUT the flag the chorus prints (RELION's own advice text)");
  must(/The calculations will be done at a lower resolution than requested/.test(noFlag.stdout), "the chorus carries the lower-resolution warning");
  const withFlag = runMockAutopick(["mic_01.mrc"], ["--LoG", "--LoG_diam_min", "120", "--LoG_diam_max", "240", "--skip_optimise_scale"]);
  must(!/add --skip_optimise_scale/.test(withFlag.stdout), "WITH the flag the chorus is extinct (the regression guard's baseline)");

  // ======================================================================
  console.log("== PHASE B: LIVE — the user's scenario, the honest receipt ==");
  const mrcHdr = (() => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(4096, 0);
    b.writeInt32LE(4096, 4);
    b.writeInt32LE(1, 8); // NZ=1
    b.writeInt32LE(2, 12); // mode 2
    return b.toString("base64");
  })();
  const fx = clientBoth(
    "mkdir -p /data2/t323-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t323-mic.mrc; ` +
      "for i in 1 2 3 4; do cp /tmp/.t323-mic.mrc /data2/t323-mics/silent-death-0$i.mrc; done"
  );
  must(fx === "", `the silent-death fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t323 import",
    params: {
      micrographsPath: Array.from({ length: 4 }, (_, i) => `/data2/t323-mics/silent-death-0${i + 1}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!importJob?.id, "the import job creates");
  const runImport = await api(`/api/jobs/${importJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImport.status >= 200 && runImport.status < 300, `the import run accepts (${runImport.status})`);
  const doneImport = await awaitJobTerminal(importJob.id, 90_000);
  must(doneImport?.status === "completed", `the import completes (${doneImport?.status})`);

  const logJob = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t323 autopick LoG silent",
    params: { logDiamMin: 120, logDiamMax: 240 },
  });
  must(!!logJob?.id, "the LoG autopick job creates");
  const edge = await mkEdge(importJob.id, logJob.id, "micrographs", "micrographs");
  must(edge === 200 || edge === 201, `the edge wires import → autopick (${edge})`);
  const workdir = `${projRoot}/autopick_${logJob.id.slice(-8)}`;

  const d = await dispatch(logJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 6 },
  });
  must(d.status >= 200 && d.status < 300, `the LoG dispatch answers (${d.status})`);

  const done = await awaitJobTerminal(logJob.id, 180_000);
  must(done?.status === "failed", `the silent-death run FAILS (${done?.status})`);
  const result = String(done?.result ?? "");
  must(/exit 1/.test(result), "the receipt carries exit 1 (the wrapper's verdict)");
  must(
    /printed no error/.test(result),
    `the receipt names the SILENT death ("RELION printed no error") — not a fabricated RELION error`
  );
  must(
    !/RELION reported an error/.test(result),
    "the old misleading label is GONE for the silent shape"
  );
  must(/external kill/i.test(result), "the receipt names the external-kill suspects");
  must(/Slurm mode|sacct/.test(result), "the receipt points at the actionable next step (Slurm mode / sacct)");

  // the evidence itself, on the cluster
  const sbatch = client(`cat ${workdir}/.cf-sbatch.sh 2>/dev/null`);
  must(sbatch.length > 0, "the sbatch script is on disk (.cf-sbatch.sh)");
  must(/--skip_optimise_scale/.test(sbatch), "the sbatch script carries --skip_optimise_scale (the advice, paid off)");
  must(/--LoG/.test(sbatch), "the script still picks LoG");
  const runOut = client(`cat ${workdir}/run.out 2>/dev/null`);
  must(/Autopicking \.\.\./.test(runOut), "run.out narrates the picking start");
  must(/0\.31\/3\.82 hrs/.test(runOut), "run.out ends on the live bar (the death spot)");
  must(!/add --skip_optimise_scale/.test(runOut), "run.out carries NO warning chorus (the flag rode the command)");
  must(!/ERROR/.test(runOut), "run.out carries no ERROR text (silence is the scenario)");
  const runErr = client(`cat ${workdir}/run.err 2>/dev/null`);
  must(runErr === "", `the cluster's run.err is EMPTY (the user's exact shape; got ${JSON.stringify(runErr.slice(0, 80))})`);

  // the log route serves both streams to the UI (where the autopsy renders)
  const logView = await api(`/api/jobs/${logJob.id}/log?full=1`, { headers: SH });
  must(logView.status === 200, `the full log route answers (${logView.status})`);
  const logText = String(logView.body?.tail ?? "");
  must(/0\.31\/3\.82 hrs/.test(logText), "the log view ends on the live bar (the autopsy's input)");
  must(!/----- stderr -----/.test(logText), "the log view appends no stderr section (run.err is empty — honest)");

  // ======================================================================
  console.log("== PHASE C: LIVE CONTROL — the healthy LoG lane is unharmed ==");
  const fx2 = clientBoth(
    "mkdir -p /data2/t323-healthy; " +
      "for i in 1 2 3 4; do cp /tmp/.t323-mic.mrc /data2/t323-healthy/mic_0$i.mrc; done"
  );
  must(fx2 === "", `the healthy fixtures build quietly (${fx2.slice(0, 80)})`);
  const import2 = await mkJob({
    projectId,
    type: "import",
    name: "QA t323 import healthy",
    params: {
      micrographsPath: Array.from({ length: 4 }, (_, i) => `/data2/t323-healthy/mic_0${i + 1}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!import2?.id, "the control import job creates");
  await api(`/api/jobs/${import2.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneImport2 = await awaitJobTerminal(import2.id, 90_000);
  must(doneImport2?.status === "completed", `the control import completes (${doneImport2?.status})`);

  const logJob2 = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t323 autopick LoG healthy",
    params: { logDiamMin: 120, logDiamMax: 240 },
  });
  must(!!logJob2?.id, "the control autopick job creates");
  const edge2 = await mkEdge(import2.id, logJob2.id, "micrographs", "micrographs");
  must(edge2 === 200 || edge2 === 201, `the control edge wires (${edge2})`);
  const workdir2 = `${projRoot}/autopick_${logJob2.id.slice(-8)}`;
  const d2 = await dispatch(logJob2.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 6 },
  });
  must(d2.status >= 200 && d2.status < 300, `the control dispatch answers (${d2.status})`);
  const done2 = await awaitJobTerminal(logJob2.id, 180_000);
  must(done2?.status === "completed", `the control LoG run COMPLETES (${done2?.status}: ${String(done2?.result ?? "").slice(0, 80)})`);

  const sbatch2 = client(`cat ${workdir2}/.cf-sbatch.sh 2>/dev/null`);
  must(/--skip_optimise_scale/.test(sbatch2), "the control script also carries the flag (every LoG dispatch)");
  const runOut2 = client(`cat ${workdir2}/run.out 2>/dev/null`);
  must(/autopick done: \d+ particles across 4 micrographs/.test(runOut2), "the control run.out completes the pick count");
  must(!/add --skip_optimise_scale/.test(runOut2), "the control run.out has NO warning chorus");
  const row2 = await jobById(logJob2.id);
  must(row2?.runRemote?.gpusRequested === 0, `the t320 contract holds (gpusRequested 0; got ${row2?.runRemote?.gpusRequested})`);

  // ======================================================================
  console.log("== PHASE D: the LEDGER (source contracts) ==");
  const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  const remoteSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const diagSrc = readFileSync(`${ROOT}/src/lib/log-diagnosis.ts`, "utf8");
  const inspSrc = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  const panelSrc = readFileSync(`${ROOT}/src/components/workflow/job-panel.tsx`, "utf8");
  const mockSrc = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/relion_autopick`, "utf8");

  must(
    engineSrc.includes('argv.push("--skip_optimise_scale")'),
    "the LoG argv builder pays off RELION's own advice (the flag rides every dispatch)"
  );
  must(
    /if \(!localErrTail\.trim\(\)\)/.test(remoteSrc),
    "the evidence rescue triggers on NO LOCAL STDERR CONTENT (run.out alone is not evidence run.err is empty)"
  );
  must(
    /const silentDeath = exitCode === 1 && !hasErrorSignature/.test(remoteSrc),
    "the receipt's silent-death verdict is gated on exit 1 + zero error signatures"
  );
  must(
    /RELION printed no error — the run ended silently mid-job/.test(remoteSrc),
    "the receipt's honest label lives in the source"
  );
  must(
    /id: "silent-run-death"/.test(diagSrc) && /diagnoseFailureLines/.test(diagSrc),
    "the autopsy finding + the failure-scanner entry point live in log-diagnosis"
  );
  must(
    /diagnoseFailureLines\(lines\)/.test(inspSrc) && /diagnoseFailureLog\(text\)/.test(inspSrc),
    "both UI surfaces (Log console + Overview teaser) run the failure scanner"
  );
  must(
    !/DropdownMenuTrigger/.test(inspSrc) && !/Choose run mode/.test(inspSrc),
    "the inspector's Re-run ▾ split is RETIRED (the user's crowded-button receipt)"
  );
  must(
    !/DropdownMenuTrigger/.test(panelSrc) && !/Choose run mode/.test(panelSrc) && !/Run \(re-check inputs\)/.test(panelSrc),
    "the panel's Run ▾ split is RETIRED and the crowded labels are gone"
  );
  must(
    /silent-death/.test(mockSrc) && /add --skip_optimise_scale to your autopick command/.test(mockSrc),
    "the mock speaks both new dialects (the silent fixture + the chorus-without-flag guard)"
  );

  console.log(fail === 0 ? "\n== t323 diag: ALL GREEN ==" : `\n== t323 diag: ${fail} FAIL ==`);
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
    client("rm -rf /data2/t323-mics /data2/t323-healthy /tmp/.t323-mic.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

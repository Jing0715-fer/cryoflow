#!/usr/bin/env node
/**
 * t334 diag — one micrograph, one stack: the names must not collide.
 *
 * The user's ticket (the real cluster, a COPIED extraction job):
 *   「新的提取颗粒为何运行到一半报错了？」
 *   — "Particle Extraction 1 (copy)" died 83% through 1034 micrographs
 *   at relion_preprocess's image.h:1534, "write: target and source
 *   objects have different size", with 865 per-mic .mrcs stacks already
 *   written (the bulky files the sync left on the cluster).
 *
 * THE MECHANICS (verified against the RELION 3.1 → master sources):
 *   extraction writes ONE stack per micrograph at
 *   part_dir + <mic name minus extension> + ".mrcs"; the FIRST particle
 *   replaces that path blindly, every later particle APPENDS — and the
 *   append reads the file on disk and refuses on a dimension mismatch
 *   (image.h:1534). One run has one box size ⇒ a mid-run clash always
 *   means the stack path was occupied by ANOTHER writer: a previous
 *   generation with a different box (the t333 scenario) or a concurrent
 *   process on the same micrograph — duplicate rows in the input STAR
 *   (two array shards race the same .mrcs) or two names that compose the
 *   same stack ("X.mrc" + "X.mrcs" — the extension strip collides them).
 *
 * THE FEATURE (three blades + the diagnosis card):
 *   1. scanExtractCollisions (pure) — the dispatch refuses naming the
 *      colliding rows BEFORE staging (remote lane: request error, row
 *      untouched; local lane: the row fails with the message).
 *   2. starIsArraySplittable (pure) — the sbatch slicer passes every row
 *      of data blocks BEFORE the second `data_` block to EVERY shard, so
 *      a single-block STAR would hand EVERY micrograph to EVERY shard;
 *      the split is now refused with the remedy (run with split = 1).
 *   3. the shard script's `|| cp` whole-STAR fallback is dead — a slice
 *      failure now speaks (CRYOFLOW_ERR in run.err, rc 111 in the tally).
 *   4. the Log tab's failure strip knows the image.h size-clash signature.
 *
 * PHASES:
 *  A. UNIT — the pure scanner's truth table (the user's dialect: distinct
 *     .mrc mics clean; duplicate rows; the .mrc/.mrcs twin clash; the
 *     pipeliner-prefix collision; the relink __cfN dialect NOT a clash; a
 *     star without the mic column → null), the array-splittability table
 *     (the import leg's two-block star ok; the mock ctffind's
 *     single-block dialect refused; a rowless star ok), and the diagnosis
 *     pattern on the user's EXACT stderr (backtrace included) — with the
 *     healthy-extract log as the no-false-positive control.
 *  B. LIVE — the user's flow on dev :3000 + mock :3022: the clean chain
 *     (import → autopick @slurm → extract @slurm) COMPLETES (the guard
 *     does not cry wolf on a healthy star); then the poisoned-star legs:
 *     a duplicate row refuses the dispatch (row keeps its completed
 *     state — the request-error contract), the .mrc/.mrcs twin row
 *     refuses with the stack named, and a single-block star with
 *     shards=2 fails with the block remedy.
 *  C. CONTRACTS — the source pins: the guard's lane positions (remote:
 *     before any staging; local: before the workdir mkdir), the refusal
 *     wordings, the twin-skip degradations, the slicer's block check,
 *     the dead `|| cp`, and the diagnosis pattern's presence.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const CONN = "qa-t334";
const MODULE = "relion/5.0.1";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
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
const awaitJobTerminal = async (id, deadlineMs) =>
  pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);

const stateFile = () => path.join(ROOT, "data/engine-state.json");
const readRecord = (jobId) => {
  try {
    return JSON.parse(readFileSync(stateFile(), "utf8"))[jobId] ?? null;
  } catch {
    return null;
  }
};

const mrcHdr = (() => {
  const b = Buffer.alloc(64);
  b.writeInt32LE(1024, 0);
  b.writeInt32LE(1024, 4);
  b.writeInt32LE(1, 8);
  b.writeInt32LE(2, 12);
  return b.toString("base64");
})();

const src = (p) => readFileSync(path.join(ROOT, p), "utf8");

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the dev server answers on :3000");
  must(await mockListening(), "the mock cluster answers on :3022");

  // ======================================================================
  console.log("== PHASE A: UNIT — the pure scanner + the splittability table + the diagnosis ==");

  const pureSrc = src("src/lib/relion/extract-collide.ts");
  must(
    !/^import\s/m.test(pureSrc) && !/^}\s*from\s/m.test(pureSrc),
    "extract-collide.ts stays PURE (zero imports — the t326/t327 recipe)"
  );

  const unit = (modPath, expr) => {
    const prog = [
      `const m = await import(${JSON.stringify(path.join(ROOT, modPath))});`,
      `const out = (${expr});`,
      `console.log("__UNIT__" + JSON.stringify(out));`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("__UNIT__"));
    if (!line) return `UNIT-PARSE-ERROR: ${(r.stdout ?? "").slice(0, 120)}`;
    return JSON.parse(line.slice("__UNIT__".length));
  };
  const EC = "src/lib/relion/extract-collide.ts";

  // THE USER'S DIALECT — the import leg's two-block star with distinct
  // cluster-absolute micrograph rows (the Beijing *_Fractions_DW shape).
  const micStar = (rows) =>
    [
      "data_optics",
      "",
      "loop_",
      "_rlnOpticsGroup #1",
      "_rlnMicrographPixelSize #2",
      "1 1.77",
      "",
      "data_micrographs",
      "",
      "loop_",
      "_rlnMicrographName #1",
      "_rlnOpticsGroup #2",
      ...rows.map((r) => `${r} 1`),
      "",
    ].join("\n");

  const clean = unit(EC, `m.scanExtractCollisions(${JSON.stringify(micStar([
    "/data2/925_neiyan/20241031_lijing_925_neiyan_2_1_20241031_143419_Fractions_DW.mrc",
    "/data2/925_neiyan/20241031_lijing_925_neiyan_2_1_20241031_144227_Fractions_DW.mrc",
  ]))})`);
  must(
    clean && clean.rows === 2 && clean.duplicates.length === 0 && clean.clashes.length === 0,
    `the user's healthy star scans clean (rows ${clean?.rows}, dups ${clean?.duplicates?.length}, clashes ${clean?.clashes?.length})`
  );

  // LEG: the same micrograph listed twice (the array race's seed)
  const dup = unit(EC, `m.scanExtractCollisions(${JSON.stringify(micStar([
    "/data2/mics/mic_01.mrc",
    "/data2/mics/mic_02.mrc",
    "/data2/mics/mic_01.mrc",
  ]))})`);
  must(
    dup && dup.duplicates.length === 1 && dup.duplicates[0] === "/data2/mics/mic_01.mrc" && dup.clashes.length === 0,
    `a duplicate row is named (dups: ${JSON.stringify(dup?.duplicates)})`
  );

  // LEG: the .mrc + .mrcs twin — the extension strip collides the stacks
  const twin = unit(EC, `m.scanExtractCollisions(${JSON.stringify(micStar([
    "/data2/mics/mic_01.mrc",
    "/data2/mics/mic_01.mrcs",
  ]))})`);
  must(
    twin && twin.clashes.length === 1 && twin.clashes[0].names.length === 2 &&
      twin.clashes[0].stack === "/data2/mics/mic_01" &&
      twin.duplicates.length === 0,
    `the .mrc/.mrcs twin clashes on one stack (${JSON.stringify(twin?.clashes?.[0] ?? null)})`
  );

  // LEG: the pipeliner prefix strips — two jobs' outputs of one mic collide
  const pipe = unit(EC, `m.scanExtractCollisions(${JSON.stringify(micStar([
    "MotionCor/job002/micrographs/foo.mrc",
    "MotionCor/job007/micrographs/foo.mrc",
  ]))})`);
  must(
    pipe && pipe.clashes.length === 1 && pipe.clashes[0].stack === "micrographs/foo",
    `decomposePipelineFileName's prefix strip is mirrored (stack ${pipe?.clashes?.[0]?.stack})`
  );

  // LEG: the relink __cfN dialect is NOT a clash (planRelinks dedups
  // same-basename files before they ever reach a STAR)
  const cf = unit(EC, `m.scanExtractCollisions(${JSON.stringify(micStar([
    "micrographs/foo.mrc",
    "micrographs/foo__cf2.mrc",
  ]))})`);
  must(cf && cf.clashes.length === 0 && cf.duplicates.length === 0, "the __cfN relink dialect scans clean (no false positive)");

  // LEG: a star without the mic column is not extraction-shaped
  const none = unit(EC, `m.scanExtractCollisions("data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n1\\n")`);
  must(none === null, "a star without _rlnMicrographName answers null (the guard degrades)");

  // LEG: describe renders names + the shared stack (the refusal speaks files)
  const desc = unit(EC, `m.describeExtractCollisions(m.scanExtractCollisions(${JSON.stringify(micStar([
    "/data2/mics/mic_01.mrc",
    "/data2/mics/mic_01.mrcs",
  ]))}))`);
  must(
    typeof desc === "string" && desc.includes("mic_01.mrc + /data2/mics/mic_01.mrcs") && desc.includes("one stack /data2/mics/mic_01.mrcs"),
    `describeExtractCollisions names both rows and the stack (${JSON.stringify(desc)})`
  );

  // ---- the array-splittability table ------------------------------------
  const split = (star) => unit(EC, `m.starIsArraySplittable(${JSON.stringify(star)})`);

  const twoBlock = split(micStar(["a.mrc", "b.mrc", "c.mrc"]));
  must(twoBlock && twoBlock.ok === true && twoBlock.blocks === 2 && twoBlock.dataRows === 4,
    `the import leg's two-block star is splittable (blocks ${twoBlock?.blocks}, rows ${twoBlock?.dataRows})`);

  // the MOCK ctffind's own dialect — single `data_` block, rows inside it:
  // every shard would receive EVERY micrograph (the concurrent-writer bomb)
  const mockCtf = ["", "data_", "", "loop_", "_rlnMicrographName #1", "mic_01.mrc\t1", "mic_02.mrc\t1", ""].join("\n");
  const oneBlock = split(mockCtf);
  must(oneBlock && oneBlock.ok === false && oneBlock.blocks === 1 && oneBlock.dataRows === 2,
    `the single-block dialect is REFUSED (blocks ${oneBlock?.blocks}, rows ${oneBlock?.dataRows})`);

  const rowless = split("data_optics\n\nloop_\n_rlnOpticsGroup #1\n");
  must(rowless && rowless.ok === true && rowless.dataRows === 0, `a rowless star is nothing to double (ok, rows ${rowless?.dataRows})`);

  // ---- the diagnosis pattern: the user's EXACT stderr --------------------
  const userStderr = [
    " Extracting particles from 1034 micrographs ...",
    "20.43/37.65 min ................................~~(,_,\">                        [oo]",
    "----- stderr -----",
    " WARNING: no particles on micrograph: micrographs/20241031_lijing_925_neiyan_2_1_20241031_144227_Fractions_DW.mrc",
    "in: /data2/home/relion5/relion2/relion-master/src/image.h, line 1534",
    "ERROR:",
    "write: target and source objects have different size",
    "=== Backtrace  ===",
    "/data2/home/relion5/relion2/relion-master/build/bin/relion_preprocess(_ZN5ImageIdE6_writeERK8FileNameR13fImageHandlerlb9WriteMode8DataType+0x1038) [0x4a7d18]",
    "==================",
  ].join("\n");
  const diag = unit("src/lib/log-diagnosis.ts", `m.diagnoseFailureLog(${JSON.stringify(userStderr)})`);
  must(
    Array.isArray(diag) && diag.length === 1 && diag[0].id === "extract-stack-size-clash" && diag[0].firstLine === 7,
    `the user's exact stderr diagnoses as the stack-size clash (id ${diag?.[0]?.id}, line ${diag?.[0]?.firstLine})`
  );
  must(
    Array.isArray(diag) && /box size/i.test(diag[0].hint) && /re-run the job/.test(diag[0].hint),
    "the hint names the mechanism and the remedy"
  );

  const healthy = unit("src/lib/log-diagnosis.ts", `m.diagnoseFailureLog(" Extracting particles from 1034 micrographs ...\\n20.43/37.65 min ....~~(,_,\\\"> [oo]\\n")`);
  must(
    Array.isArray(healthy) && !healthy.some((f) => f.id === "extract-stack-size-clash"),
    "a healthy extract log never trips the clash pattern (no false positive)"
  );

  // ======================================================================
  console.log("== PHASE B: LIVE — the user's flow, guarded at the dispatch door ==");

  const mkConn = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t334 (user shape)",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      maxFileMb: 16,
      maxTotalMb: 64,
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t334 extract collisions", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  const fx = clientBoth(
    "mkdir -p /data2/t334-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t334-mic.mrc; ` +
      "for i in $(seq 1 4); do cp /tmp/.t334-mic.mrc /data2/t334-mics/mic_$(printf %02d $i).mrc; done"
  );
  must(fx === "", `the 4 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t334 import",
    params: {
      micrographsPath: Array.from({ length: 4 }, (_, i) => `/data2/t334-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  await api(`/api/jobs/${importJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneImport = await awaitJobTerminal(importJob.id, 90_000);
  must(doneImport?.status === "completed", `the import completes (${doneImport?.status})`);

  const autopickJob = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t334 autopick LoG",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractJob = await mkJob({
    projectId,
    type: "extract",
    name: "QA t334 extract",
    params: { boxSize: 128 },
  });
  must(!!autopickJob?.id && !!extractJob?.id, "the autopick/extract jobs create");
  const eAP = await mkEdge(importJob.id, autopickJob.id, "micrographs", "micrographs");
  const eEXm = await mkEdge(importJob.id, extractJob.id, "micrographs", "micrographs");
  const eEXc = await mkEdge(autopickJob.id, extractJob.id, "coords", "coords");
  must(
    [eAP, eEXm, eEXc].every((s) => s === 200 || s === 201),
    `the DAG wires import → autopick → extract (${eAP}/${eEXm}/${eEXc})`
  );

  // autopick on the cluster (Slurm), then the extract — the user's pipeline
  const dAP = await dispatch(autopickJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 0 },
  });
  must(dAP.status >= 200 && dAP.status < 300 && !dAP.body?.error, `the LoG autopick dispatch is accepted (${dAP.status}${dAP.body?.error ? `: ${dAP.body.error}` : ""})`);
  const doneAP = await awaitJobTerminal(autopickJob.id, 180_000);
  must(doneAP?.status === "completed", `the LoG autopick completes (${doneAP?.status})`);

  // ---- LEG 1: the CLEAN star sails (the guard does not cry wolf) ---------
  const dEX = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 0 },
  });
  must(dEX.status >= 200 && dEX.status < 300 && !dEX.body?.error, `LEG1: the clean extract dispatch is accepted (${dEX.status}${dEX.body?.error ? `: ${dEX.body.error}` : ""})`);
  const doneEX = await awaitJobTerminal(extractJob.id, 240_000);
  must(
    doneEX?.status === "completed",
    `LEG1: the clean extract COMPLETES on the cluster (${doneEX?.status}: ${String(doneEX?.result ?? "").slice(0, 100)})`
  );

  // the import's own star — the file the extract's micrographs input resolves to
  const impRec = readRecord(importJob.id);
  const micStarPath =
    impRec?.outputs?.micrographs_star ?? (impRec?.workdir ? path.join(impRec.workdir, "micrographs.star") : null);
  must(!!micStarPath && existsSync(micStarPath), `the import's micrographs.star is locatable (${micStarPath})`);
  const starOriginal = micStarPath ? readFileSync(micStarPath, "utf8") : "";
  must(/data_optics/.test(starOriginal) && /data_micrographs/.test(starOriginal), "the import star speaks the two-block dialect");

  // ---- LEG 2: the duplicate row — refused BEFORE staging, row untouched --
  writeFileSync(micStarPath, starOriginal + "/data2/t334-mics/mic_01.mrc 1\n");
  const dDup = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 0 },
  });
  must(
    dDup.status === 200 && typeof dDup.body?.error === "string" && /collide inside the extraction/.test(dDup.body.error) && /listed twice: .*mic_01\.mrc/.test(dDup.body.error),
    `LEG2: the duplicate row refuses the dispatch naming the file (${String(dDup.body?.error ?? dDup.status).slice(0, 120)})`
  );
  const rowAfterDup = await jobById(extractJob.id);
  must(rowAfterDup?.status === "completed", `LEG2: the request-error contract keeps the row's state (${rowAfterDup?.status})`);

  // ---- LEG 3: the .mrc/.mrcs twin — refused with the stack named ---------
  writeFileSync(micStarPath, starOriginal + "/data2/t334-mics/mic_01.mrcs 1\n");
  const dTwin = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 0 },
  });
  must(
    dTwin.status === 200 && typeof dTwin.body?.error === "string" &&
      /mic_01\.mrc \+ .*mic_01\.mrcs → one stack .*mic_01\.mrcs/.test(dTwin.body.error),
    `LEG3: the extension-twin clash refuses with the shared stack named (${String(dTwin.body?.error ?? dTwin.status).slice(0, 120)})`
  );
  const rowAfterTwin = await jobById(extractJob.id);
  must(rowAfterTwin?.status === "completed", `LEG3: the row keeps its state again (${rowAfterTwin?.status})`);

  // ---- LEG 4: the single-block star + shards — the split is refused ------
  // (the mock ctffind's own dialect: one data_ block — every shard would
  // receive every micrograph and write the same stacks at the same time)
  writeFileSync(
    micStarPath,
    ["", "data_", "", "loop_", "_rlnMicrographName #1", "_rlnOpticsGroup #2",
      "/data2/t334-mics/mic_01.mrc 1", "/data2/t334-mics/mic_02.mrc 1",
      "/data2/t334-mics/mic_03.mrc 1", "/data2/t334-mics/mic_04.mrc 1", ""].join("\n")
  );
  const dSplit = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", shards: 2 },
  });
  must(dSplit.status >= 200 && dSplit.status < 300, `LEG4: the split dispatch is accepted to stage (${dSplit.status})`);
  const doneSplit = await pollUntil(async () => {
    const j = await jobById(extractJob.id);
    return j && j.status === "failed" && /single data block/.test(String(j.result ?? "")) ? j : null;
  }, 120_000);
  must(
    !!doneSplit,
    `LEG4: the single-block star + shards fails with the block remedy (${String(doneSplit?.result ?? "no refusal seen").slice(0, 130)})`
  );

  // restore the healthy two-block star BEFORE the control leg (LEG 4 left
  // the single-block poison in place — the control must dispatch the clean
  // dialect, not the refused one)
  writeFileSync(micStarPath, starOriginal);
  must(/data_optics/.test(readFileSync(micStarPath, "utf8")), "the star is restored to the two-block dialect before the control");

  // ---- LEG 5: the CONTROL — a healthy two-block star + shards still splits -
  // (the block-check must never refuse a legitimate array: this is the
  // t306/t307/t308 family's own scenario — the import leg's optics-group
  // star, sliced round-robin, merged by the last shard home)
  const dArr = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", shards: 2 },
  });
  must(
    dArr.status >= 200 && dArr.status < 300 && !dArr.body?.error,
    `LEG5: the two-block star + 2 shards dispatches (the control) (${dArr.status}${dArr.body?.error ? `: ${dArr.body.error}` : ""})`
  );
  const doneArr = await awaitJobTerminal(extractJob.id, 240_000);
  must(
    doneArr?.status === "completed",
    `LEG5: the sharded extract COMPLETES (the split still works for healthy stars) (${doneArr?.status}: ${String(doneArr?.result ?? "").slice(0, 90)})`
  );
  const arrRec = readRecord(extractJob.id);
  must(
    arrRec?.remote?.slurmArray?.total === 2,
    `LEG5: the record speaks the split (slurmArray ${JSON.stringify(arrRec?.remote?.slurmArray ?? null)})`
  );


  // ======================================================================
  console.log("== PHASE C: CONTRACTS — the source ledger ==");

  const rr = src("src/lib/remote/remote-run.ts");
  // the guard's lane position: after the CTF gate, BEFORE the t267 probe
  const ctfGateAt = rr.indexOf("ctffindInputGate(");
  const guardAt = rr.indexOf("scanExtractCollisions(");
  const probeAt = rr.indexOf("never-probed connection must not dispatch blind");
  must(ctfGateAt > 0 && guardAt > ctfGateAt && probeAt > guardAt, "the remote guard sits after the CTF gate, before the probe/staging legs");
  must(
    /remote-run: extract collision scan skipped/.test(rr),
    "the twin-resolved star degrades with a console note (never a silent guarantee)"
  );
  must(
    /starIsArraySplittable/.test(rr) && /single data block \(no separate optics block/.test(rr),
    "the array split's block contract is enforced at dispatch with the remedy named"
  );
  must(
    !/\|\| cp \$\{shQuote\(array\.inputStar\)\}/.test(rr) && /CRYOFLOW_ERR: could not slice the input STAR/.test(rr),
    "the silent whole-STAR `|| cp` fallback is dead — a slice failure speaks (CRYOFLOW_ERR + rc 111)"
  );

  const eng = src("src/lib/relion/engine.ts");
  const engGateAt = eng.indexOf("ctffindInputGate(inputs.micrographs_star");
  const engGuardAt = eng.indexOf("scanExtractCollisions(readFileSync(inputs.micrographs_star");
  const workdirAt = eng.indexOf("---- workdir");
  must(engGateAt > 0 && engGuardAt > engGateAt && workdirAt > engGuardAt, "the local-lane guard sits after the CTF gate, BEFORE the workdir mkdir (no disk mutation on refusal)");

  const ld = src("src/lib/log-diagnosis.ts");
  must(/extract-stack-size-clash/.test(ld) && /write: target and source objects have different size/i.test(ld), "the failure-catalog pattern carries RELION's own error string");

  const docs = src("docs/remote-relion.md");
  must(/4m\. One micrograph, one stack/.test(docs), "docs §4m speaks the collision doctrine");
  must(/`image\.h:1534` mid-run on a FRESH job/.test(docs), "the failure catalog carries the fresh-job clash row");

  console.log(fail === 0 ? "\n== t334 diag: ALL GREEN ==" : `\n== t334 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: only this suite's own artifacts ----
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
    client("rm -rf /data2/t334-mics /tmp/.t334-mic.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
  process.exitCode = fail === 0 ? 0 : 1;
}

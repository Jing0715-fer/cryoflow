#!/usr/bin/env node
/**
 * CryoFlow diag — t330: "Could not load outputs (HTTP 404)" + the key numbers.
 *
 * The user's report (fourth week, after Extract completed on the cluster and
 * 2D finally ran): the Results tab of Particle Extraction 1 shows
 * "Could not load outputs / HTTP 404" and the user reads it as a broken
 * cluster ("好像连接不上cluster了"); plus — "每一步的UI界面结果中都要突出
 * particles 的数量，这个信息很关键" and "提取有一些警告 / 只从部分照片中
 * 完成了提取".
 *
 * This suite pins the whole story:
 *   UNIT  — the O(n) star column scanner, the warning parser, the per-type
 *           summarizer truth table (incl. PARTIAL coverage and the honest
 *           absences: remote-only star → null, unreadable input → no total).
 *   LIVE  — the user's flow on the mock cluster: import → autopick (remote
 *           Slurm) → extract dispatched TO THE CLUSTER (their "re-run the
 *           upstream" action) → the outputs listing answers 200 with a
 *           particles stat, a micrographs coverage stat, and warnings read
 *           from run.out (surgery injects a WARNING line — the card must
 *           surface it).
 *   TRUTH — the 404 anatomy: this route's OWN 404 always carries a JSON
 *           body ("Job not found") — the bare "HTTP 404" the user saw is a
 *           FRAMEWORK 404 (stale build / mid-restart), which the t330 error
 *           card now names by layer; plus the honest missing-record note
 *           (completed job, record gone → "re-run the job to rebuild it").
 *   PINS  — the UI source ledger: the stat strip, the warnings card, the
 *           layer-named error card with its Retry trigger and the "cluster
 *           connection is not involved" line.
 *
 * Run: node scripts/diag-t330-outputs-404.mjs   (prod :3001 + mock :3022)
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t330";
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

/** fetch but keep the RAW text too — the 404 anatomy needs to prove the
 *  body is (or is NOT) JSON */
const apiRaw = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  const text = await r.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: r.status, body, text, isJson: body !== null };
};
const api = async (url, init) => {
  const { status, body } = await apiRaw(url, init);
  return { status, body };
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
/** surgery that PRESERVES every other record (t328's whole-file rewrite
 *  pattern, one record at a time) */
const surgeryRecord = (jobId, fn) => {
  const st = JSON.parse(readFileSync(stateFile(), "utf8"));
  fn(st[jobId], st);
  writeFileSync(stateFile(), JSON.stringify(st, null, 2));
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

let extractJobId = null;

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  // ======================================================================
  console.log("== PHASE A: UNIT — scanner, warnings, summarizer ==");

  const unit = (() => {
    const prog = `
process.env.CRYOFLOW_DATA_DIR = ${JSON.stringify(mkdtempSync(path.join(os.tmpdir(), "t330-unit-")))};
const m = await import(${JSON.stringify(path.join(ROOT, "src/lib/relion/output-summary.ts"))});
const out = {};

// ---- scanStarColumn: RELION-5 shape (optics loop without the column,
//      particles loop with it), quoted values, # comments) ----
const star = [
  "data_optics",
  "",
  "loop_",
  "_rlnOpticsGroup #1",
  "_rlnOpticsSize #2",
  "1 512",
  "",
  "data_particles",
  "",
  "loop_",
  "_rlnMicrographName #1",
  "_rlnImageName #2",
  "_rlnCoordinateX #3",
  "mic_01.mrc 'extra/mic_01_extract.mrcs' 12.5",
  "mic_02.mrc extra/mic_02_extract.mrcs 13.5  # trailing comment",
  "mic_01.mrc extra/mic_01_extract.mrcs 99.0",
  "",
].join("\\n");
out.scan = m.scanStarColumn(star, "_rlnMicrographName");

// multi-line row reconstruction (tokens spanning lines)
const ml = [
  "data_particles",
  "loop_",
  "_rlnMicrographName",
  "_rlnImageName",
  "mic_07.mrc",
  "extra/mic_07.mrcs",
].join("\\n");
out.scanMulti = m.scanStarColumn(ml, "_rlnMicrographName");

// no such column anywhere → null
out.scanAbsent = m.scanStarColumn(star, "_rlnNoSuchColumn");

// O(n) smoke: 200k rows must count fast (the shared parseStar's per-row
// slice would crawl; the scanner must not)
{
  const N = 200_000;
  const parts = ["data_particles", "", "loop_", "_rlnMicrographName", "_rlnImageName"];
  for (let i = 0; i < N; i++) parts.push(\`mic_\${i % 50}.mrc img_\${i}.mrcs\`);
  const big = parts.join("\\n");
  const t0 = Date.now();
  out.bigScan = m.scanStarColumn(big, "_rlnMicrographName");
  out.bigMs = Date.now() - t0;
  out.bigLen = big.length;
}

// ---- parseRunWarnings dialects ----
const log = [
  "relion_preprocess: starting",
  "WARNING: box size (128) is larger than the micrograph",
  "relion_refine: WARNING: lowering the resolution",
  "WARNING: box size (128) is larger than the micrograph", // dupe
  "note: not a warning line",
  "WARNING: skipped optimise_scale",
].join("\\n");
out.warn = m.parseRunWarnings(log);
out.warnEmpty = m.parseRunWarnings("all quiet\\nnothing here");

// ---- summarizeOutputs truth table ----
const F = (name, over = {}) => ({
  path: name, name, kind: "star", size: 1000, ...over,
});
const files = {
  import: [F("micrographs.star", { rows: 42 })],
  motioncorr: [F("corrected_micrographs.star", { rows: 40 })],
  ctffind: [F("micrographs_ctf.star", { rows: 38 })],
  autopick: [
    F("autopick.star", { rows: 0 }),
    ...[1, 2, 3, 4].map((i) => F(\`mic_0\${i}.mrc_autopick.star\`, { rows: i * 10 })),
  ],
  extractFull: [F("particles.star", { rows: 120, path: "particles.star" })],
  class2d: [
    F("run_it000_data.star", { rows: 90 }),
    F("run_it025_data.star", { rows: 118 }),
    F("run_it000_classes.mrcs", { kind: "mrc", slices: 10 }),
    F("run_it025_classes.mrcs", { kind: "mrc", slices: 10 }),
  ],
  class3d: [
    F("run_it014_data.star", { rows: 55 }),
    F("run_it014_class001.mrc", { kind: "mrc" }),
    F("run_it014_class002.mrc", { kind: "mrc" }),
    F("run_it000_class001.mrc", { kind: "mrc" }),
  ],
  refine3d: [F("run_data.star", { rows: 118 })],
  remoteOnly: [F("particles.star", { rows: undefined, remote: true, size: 9 * 1024 * 1024 })],
  postprocess: [F("postprocess.star", { rows: 40 })],
};
// extract star text whose micrograph column covers 3 of the 4 input mics
const pstar = [
  "data_particles",
  "loop_",
  "_rlnMicrographName",
  "_rlnImageName",
  "mic_01.mrc a",
  "mic_02.mrc b",
  "mic_03.mrc c",
  "mic_02.mrc d",
].join("\\n");
// the image-name fallback dialect (no _rlnMicrographName column — the
// mock's simplified star shape): the extract stack base names the micrograph
const pstarImg = [
  "data_optics",
  "loop_",
  "_rlnOpticsGroup",
  "1",
  "data_particles",
  "loop_",
  "_rlnImageName",
  "_rlnCoordinateX",
  "000001@extra/mic_01_extract.mrcs 10.0",
  "000002@extra/mic_01_extract.mrcs 11.0",
  "000003@extra/mic_02_extract.mrcs 12.0",
].join("\\n");
const istar = [
  "data_micrographs",
  "loop_",
  "_rlnMicrographName",
  "mic_01.mrc",
  "mic_02.mrc",
  "mic_03.mrc",
  "mic_04.mrc",
].join("\\n");
const rdOk = { readStarText: () => pstar, readStarAbs: () => istar, cmd: "relion_preprocess --i /up/import/micrographs.star --coord_dir /up/autopick/" };
out.extractPartial = m.summarizeOutputs("extract", files.extractFull, rdOk);
out.extractFullCov = m.summarizeOutputs("extract", files.extractFull, { readStarText: () => pstar, readStarAbs: () => null, cmd: "x --i /up/import/micrographs.star" });
out.extractNoCmd = m.summarizeOutputs("extract", files.extractFull, { readStarText: () => pstar });
out.extractImgFallback = m.summarizeOutputs("extract", files.extractFull, { readStarText: () => pstarImg, readStarAbs: () => istar, cmd: "x --i /up/import/micrographs.star" });
out.import = m.summarizeOutputs("import", files.import, {});
out.motioncorr = m.summarizeOutputs("motioncorr", files.motioncorr, {});
out.ctffind = m.summarizeOutputs("ctffind", files.ctffind, {});
out.autopick = m.summarizeOutputs("autopick", files.autopick, { readStarText: () => null, cmd: "relion_autopick --i /up/import/micrographs.star" });
out.class2d = m.summarizeOutputs("class2d", files.class2d, {});
out.class3d = m.summarizeOutputs("class3d", files.class3d, {});
out.refine3d = m.summarizeOutputs("refine3d", files.refine3d, {});
out.remoteOnly = m.summarizeOutputs("extract", files.remoteOnly, { readStarText: () => null });
out.postprocess = m.summarizeOutputs("postprocess", files.postprocess, {});
console.log("CFUNIT" + JSON.stringify(out));
`;
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("CFUNIT"));
    if (!line) return { error: `${String(r.stderr ?? "").slice(0, 400)} ${String(r.stdout ?? "").slice(0, 200)}` };
    try {
      return JSON.parse(line.slice("CFUNIT".length));
    } catch {
      return { error: "parse" };
    }
  })();

  must(!unit.error, `the unit leg imports the summarizer cleanly (${unit.error ?? "ok"})`);
  if (!unit.error) {
    const S = (v) => String(v ?? "");
    // ---- scanner ----
    must(
      unit.scan?.rows === 3 && unit.scan?.distinct === 2,
      `scanStarColumn: rows + distinct micrographs (got ${S(unit.scan?.rows)}/${S(unit.scan?.distinct)})`
    );
    must(
      unit.scanMulti?.rows === 1 && unit.scanMulti?.distinct === 1,
      "scanStarColumn: a multi-line row reconstructs (tokens spanning lines)"
    );
    must(unit.scanAbsent == null, "scanStarColumn: a column nowhere in the file → null");
    must(
      unit.bigScan?.rows === 200_000 && unit.bigScan?.distinct === 50,
      `scanStarColumn: 200k-row star counts exactly (${S(unit.bigScan?.rows)} rows / ${S(unit.bigScan?.distinct)} mics)`
    );
    must(
      typeof unit.bigMs === "number" && unit.bigMs < 4000,
      `scanStarColumn: O(n) — 200k rows in ${S(unit.bigMs)} ms (a ${S(Math.round((unit.bigLen ?? 0) / 1024))} KB star)`
    );
    // ---- warnings ----
    must(
      Array.isArray(unit.warn) && unit.warn.length === 3,
      `parseRunWarnings: 3 unique WARNING lines from 4 candidates (${S(unit.warn?.length)})`
    );
    must(
      Array.isArray(unit.warn) && unit.warn[0].includes("box size"),
      "parseRunWarnings: prefixed dialects (relion_refine: WARNING: …) survive"
    );
    must(
      Array.isArray(unit.warnEmpty) && unit.warnEmpty.length === 0,
      "parseRunWarnings: a quiet log → empty array (the card stays silent)"
    );
    // ---- summarizer ----
    must(unit.import?.stats?.[0]?.value === "42" && unit.import.stats[0].label.includes("micrographs"), "import: micrographs stat");
    must(unit.motioncorr?.stats?.[0]?.value === "40", "motioncorr: corrected micrographs stat");
    must(unit.ctffind?.stats?.[0]?.value === "38", "ctffind: micrographs with CTF stat");
    must(
      unit.autopick?.stats?.[0]?.value === "100" && unit.autopick.stats[0].label === "particles picked",
      `autopick: picks summed across per-mic stars (${S(unit.autopick?.stats?.[0]?.value)})`
    );
    must(
      unit.extractPartial?.stats?.[0]?.value === "120" && unit.extractPartial.stats[0].label === "particles extracted",
      "extract: particles stat leads"
    );
    must(
      unit.extractPartial?.stats?.[1]?.value === "3 / 4" && unit.extractPartial.stats[1].tone === "warn",
      `extract PARTIAL: coverage stat "3 / 4" with the warn tone (${S(unit.extractPartial?.stats?.[1]?.value)})`
    );
    must(
      /3 of 4 micrographs produced particles — 1 had none/.test(S(unit.extractPartial?.coverage?.note)),
      "extract PARTIAL: the amber note names the missing micrograph count"
    );
    must(
      unit.extractFullCov?.stats?.[1]?.value === "3" && !S(unit.extractFullCov?.coverage?.note),
      "extract, unreadable input star: covered count alone — NO invented denominator"
    );
    must(
      unit.extractNoCmd?.stats?.[1]?.value === "3",
      "extract, no recorded command: covered count alone (honest absence of the total)"
    );
    must(
      unit.extractImgFallback?.stats?.[1]?.value === "2 / 4",
      `extract, image-name dialect: stack bases become the coverage stat (${S(unit.extractImgFallback?.stats?.[1]?.value)})`
    );
    must(
      /2 of 4 micrographs produced particles — 2 had none/.test(S(unit.extractImgFallback?.coverage?.note)),
      "extract, image-name dialect PARTIAL: the amber note counts the missing micrographs"
    );
    must(
      unit.class2d?.stats?.[0]?.value === "118" && unit.class2d.stats[0].label === "particles classified",
      "class2d: LATEST iteration's data star wins (118, not the it000 90)"
    );
    must(
      unit.class2d?.stats?.[1]?.value === "10" && unit.class2d.stats[1].tone === "class",
      "class2d: classes from the stack's slice count"
    );
    must(
      unit.class3d?.stats?.[0]?.value === "55" && unit.class3d?.stats?.[1]?.value === "2",
      "class3d: particles + class maps at the latest iteration"
    );
    must(unit.refine3d?.stats?.[0]?.value === "118", "refine3d: particles refined");
    must(
      unit.remoteOnly == null,
      "extract, REMOTE-ONLY star: NO summary (the t289 on-cluster card speaks, no guessed number)"
    );
    must(unit.postprocess == null, "postprocess: no key numbers (the FSC chart speaks)");
  }

  // ======================================================================
  console.log("== PHASE B: LIVE — the user's flow, the listing, the truth of 404 ==");

  const mkConn = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t330 (user shape)",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      maxFileMb: 16, // the user's cap: stars sync back, bulky mrcs stay
      maxTotalMb: 64,
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t330 outputs key numbers", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  const fx = clientBoth(
    "mkdir -p /data2/t330-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t330-mic.mrc; ` +
      "for i in $(seq 1 4); do cp /tmp/.t330-mic.mrc /data2/t330-mics/mic_$(printf %02d $i).mrc; done"
  );
  must(fx === "", `the 4 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t330 import",
    params: {
      micrographsPath: Array.from({ length: 4 }, (_, i) => `/data2/t330-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
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
    name: "QA t330 autopick LoG",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractJob = await mkJob({
    projectId,
    type: "extract",
    name: "QA t330 extract",
    params: { boxSize: 128 },
  });
  must(!!autopickJob?.id && !!extractJob?.id, "the autopick/extract jobs create");
  extractJobId = extractJob.id;
  const eAP = await mkEdge(importJob.id, autopickJob.id, "micrographs", "micrographs");
  const eEXm = await mkEdge(importJob.id, extractJob.id, "micrographs", "micrographs");
  const eEXc = await mkEdge(autopickJob.id, extractJob.id, "coords", "coords");
  must(
    [eAP, eEXm, eEXc].every((s) => s === 200 || s === 201),
    `the DAG wires import → autopick → extract (${eAP}/${eEXm}/${eEXc})`
  );

  // autopick on the cluster (Slurm), exactly like the user's pipeline
  const dAP = await dispatch(autopickJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 1 },
  });
  must(dAP.status >= 200 && dAP.status < 300 && !dAP.body?.error, `the LoG autopick dispatch is accepted (${dAP.status})`);
  const doneAP = await awaitJobTerminal(autopickJob.id, 180_000);
  must(doneAP?.status === "completed", `the LoG autopick completes (${doneAP?.status})`);

  // the extract sent TO THE CLUSTER — the user's "re-run the upstream" /
  // "send this job to the cluster" door
  const dEX = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 1 },
  });
  must(dEX.status >= 200 && dEX.status < 300 && !dEX.body?.error, `the extract dispatch to the cluster is accepted (${dEX.status})`);
  const doneEX = await awaitJobTerminal(extractJob.id, 240_000);
  must(
    doneEX?.status === "completed",
    `the extract COMPLETES on the cluster (${doneEX?.status}: ${String(doneEX?.result ?? "").slice(0, 100)})`
  );

  // ---- THE LISTING: the endpoint the user's Results tab could not load ----
  const outputs = await apiRaw(`/api/jobs/${extractJob.id}/outputs`, { headers: SH });
  must(outputs.status === 200, `the outputs listing answers 200 (got ${outputs.status})`);
  must(Array.isArray(outputs.body?.files) && outputs.body.files.length > 0, "the listing carries files");
  must(
    outputs.body?.summary?.stats?.some((s) => s.key === "particles" && /^\d[\d,]*$/.test(s.value) && s.label === "particles extracted"),
    `the listing carries the PARTICLES key number (${outputs.body?.summary?.stats?.map((s) => `${s.key}=${s.value}`).join(", ") ?? "none"})`
  );
  must(
    outputs.body?.summary?.stats?.some((s) => s.key === "micrographs" && /4/.test(s.value)),
    `the listing carries the micrographs coverage stat (${outputs.body?.summary?.stats?.find((s) => s.key === "micrographs")?.value ?? "none"})`
  );
  must(Array.isArray(outputs.body?.warnings), "the listing carries a warnings array");

  // ---- warnings surface from run.out (surgery: inject one line) ----
  const exRec = readRecord(extractJob.id);
  must(!!exRec?.workdir, "the extract record names its workdir");
  const runOut = path.join(String(exRec?.workdir ?? ""), "run.out");
  must(existsSync(runOut), "run.out synced back to the local mirror");
  appendFileSync(runOut, "\nWARNING: t330 injected warning — box smaller than particle\n");
  const outputs2 = await api(`/api/jobs/${extractJob.id}/outputs`, { headers: SH });
  must(
    (outputs2.body?.warnings ?? []).some((w) => w.includes("t330 injected warning")),
    `the warnings array surfaces the run.out WARNING line (${(outputs2.body?.warnings ?? []).length} lines)`
  );

  // ---- the honest missing-record note (completed job, record gone) ----
  surgeryRecord(extractJob.id, (rec) => {
    if (rec) delete rec.workdir;
  });
  // ^ deleting workdir from the record is the same early-return the route
  // takes for !run.workdir; the note must speak of a MISSING RECORD for a
  // completed job, not "has not run yet"
  const outputs3 = await api(`/api/jobs/${extractJob.id}/outputs`, { headers: SH });
  must(
    outputs3.status === 200 &&
      /run record is missing — re-run the job to rebuild it/.test(String(outputs3.body?.note ?? "")),
    `a completed job without a run record gets the honest note (${String(outputs3.body?.note ?? "").slice(0, 80)})`
  );
  // restore the record for the teardown (jobs DELETE drops the local twin)
  surgeryRecord(extractJob.id, (rec, st) => {
    if (rec) rec.workdir = exRec.workdir;
    else st[extractJob.id] = exRec;
  });

  // ---- THE 404 ANATOMY ----
  const ghost = await apiRaw(`/api/jobs/does-not-exist-t330/outputs`, { headers: SH });
  must(ghost.status === 404, `an unknown job id answers 404 (${ghost.status})`);
  must(
    ghost.isJson && ghost.body?.error === "Job not found",
    "the route's OWN 404 always carries a JSON body (\"Job not found\") — the UI can classify it"
  );
  const framework = await apiRaw(`/api/t330-not-a-route`, { headers: SH });
  must(
    framework.status === 404 && !framework.isJson,
    "a FRAMEWORK 404 (route absent — stale build / mid-restart) has NO JSON body: the exact bare \"HTTP 404\" the user saw"
  );

  // ======================================================================
  console.log("== PHASE C: PINS — the UI + route source ledger ==");

  const route = src("src/app/api/jobs/[id]/outputs/route.ts");
  must(route.includes("summarizeOutputs(job.type, files"), "the route computes the per-type summary on every listing");
  must(route.includes("parseRunWarnings(readRunOutTail(workdir)"), "the route parses run.out warnings on every listing");
  must(route.includes("SUMMARY_STAR_CAP"), "the summary's star re-read has an explicit cap (multi-MB particle stars count)");
  must(
    /job\.status === "completed"[\s\S]{0,200}run record is missing/.test(route),
    "the route's completed-but-record-missing note is honest (re-run, not 'has not run yet')"
  );

  const ui = src("src/components/workflow/results/results-view.tsx");
  must(ui.includes('data-key-numbers'), "the Results view mounts the key-numbers strip (test seam present)");
  must(ui.includes('data-stat={s.key}'), "each stat carries its stable key (particles/micrographs/classes)");
  must(
    /KeyNumbersStrip summary=\{data\.summary\}/.test(ui) &&
      ui.indexOf("KeyNumbersStrip summary={") < ui.indexOf('aria-label="Maps and images"'),
    "the stat strip leads the Results view (mounted before the maps gallery)"
  );
  must(ui.includes('data-warnings-card'), "the Results view mounts the run-warnings card");
  must(
    /warnings\.length === 1 \? "" : "s"/.test(ui),
    "the warnings card counts plural honestly"
  );
  must(ui.includes('data-outputs-error={error.kind}'), "the error card names its failure LAYER (gone/server/route/network)");
  must(
    /cluster connection is not involved/.test(ui),
    "the error card says the cluster is NOT involved in this listing (the user's misread, answered)"
  );
  must(
    /body\?\.error === "Job not found"[\s\S]{0,400}stale view/.test(ui),
    "a Job-not-found 404 is classified as a stale canvas, not a server failure"
  );
  must(
    /retriedRef\.current/.test(ui) && /r\.kind !== "gone"/.test(ui),
    "one automatic retry for transient failures — never for the gone-record verdict"
  );

  console.log(fail === 0 ? "\n== t330 diag: ALL GREEN ==" : `\n== t330 diag: ${fail} FAIL ==`);
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
    client("rm -rf /data2/t330-mics /tmp/.t330-mic.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
  process.exitCode = fail === 0 ? 0 : 1;
}

#!/usr/bin/env bun
/**
 * t335 diag — the extract frame census + the twin-star closure, verified
 * live against the Beijing abort's little brother.
 *
 * The user's ticket (both windows converged on the same source-verified
 * answer):
 *   「Extracting particles from 1034 micrographs ... 20.43/37.65 min ...
 *    WARNING: no particles on micrograph: ..._144227_Fractions_DW.mrc
 *    ERROR: write: target and source objects have different size
 *    (image.h, line 1534)」 → Slurm FAILED 21m02s.
 *
 * The parallel window's t334 already refuses the NAME-level shapes
 * (duplicate rows, extension twins) and t333 wipes stale generations on
 * re-run. THIS suite pins t335's two complements:
 *
 *   1. the FRAME CENSUS — .mrcs rows byte-verified through the real SSH
 *      header sniffer: nz>1 is a movie stack, not a micrograph (RELION
 *      reads it as (x,y,1,N) and windows frame 0 — garbage particles even
 *      when the names never collide). A name-only scan cannot see this
 *      when the stems are distinct.
 *   2. the TWIN-STAR CLOSURE — when the star stayed on the cluster (no
 *      local copy), t334's scan used to skip with a console note; the
 *      dispatch now cat's the star over SSH, re-runs the t334 collision
 *      scan on the cluster's own text, and runs the frame census.
 *
 * PHASES:
 *  A. UNIT — the PURE census (extract-gate.ts): frame stacks refuse with
 *     the header's own numbers, verified singles pass with a note, a
 *     missing sniffer degrades to the note, a throwing sniffer never
 *     blocks, a pure .mrc star is silent, and the row reader speaks the
 *     two-block star dialect.
 *  B. LIVE — the mixed import (mic_02.mrc + mic_02.mrcs twin): the receipt
 *     carries the extension census; the extract dispatch refuses with the
 *     t334 collision wording (the local star path).
 * B2. LIVE — stacks-only rows (distinct stems): the refusal is earned
 *     BYTE-level (nz=8 read over SSH).
 * B3. LIVE — the twin-star closure: the local star copy removed → the
 *     dispatch cat's the cluster's star over SSH → the SAME refusal.
 *  C. CLEAN — .mrc-only rows dispatch and complete (no false positive).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t335";
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

// 64-byte MRC headers the sniffer can settle: nx, ny, nz, mode (LE int32)
const mrcHeaderB64 = (nx, ny, nz, mode) => {
  const b = Buffer.alloc(64);
  b.writeInt32LE(nx, 0);
  b.writeInt32LE(ny, 4);
  b.writeInt32LE(nz, 8);
  b.writeInt32LE(mode, 12);
  return b.toString("base64");
};

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  // ====================================================================
  console.log("== PHASE A: UNIT — the PURE frame census ==");

  const gate = await import(`${ROOT}/src/lib/relion/extract-gate.ts`);
  const V = (kind, nx, ny, nz, mode) => ({ kind, facts: { nx, ny, nz, mode, bytesPerVoxel: 4 } });
  const sniffOf = (map) => async (paths) => {
    const out = {};
    for (const p of paths) out[p] = map[p] ?? { kind: "unknown" };
    return out;
  };
  const ID = (r) => r;

  // A1 — the frame stack refuses with the header's own numbers
  {
    const seen = [];
    const r = await gate.extractInputGate(
      ["micrographs/st_01.mrcs", "micrographs/st_02.mrcs", "micrographs/st_03.mrcs"],
      sniffOf({ "/proj/micrographs/st_02.mrcs": V("mrc-stack", 4096, 4092, 24, 2) }),
      (row) => {
        const mapped = `/proj/${row}`;
        seen.push(mapped);
        return mapped;
      }
    );
    must(!!r.refusal, "A1 a verified frame stack refuses");
    must(/FRAME STACKS/.test(r.refusal) && /24 sections × 4096×4092/.test(r.refusal), "A1 carries the header's own numbers");
    must(/movie stack, not a micrograph/.test(r.refusal), "A1 teaches MotionCorr first");
    must(/garbage particles even when the names/.test(r.refusal), "A1 names the name-only scan's blind spot");
    must(seen.every((p) => p.startsWith("/proj/")), "A1 the sniffer received mapped cluster paths");
  }

  // A2 — verified SINGLE-section .mrcs rows pass with the honest note
  {
    const r = await gate.extractInputGate(
      ["micrographs/s1.mrcs", "micrographs/s2.mrcs"],
      sniffOf({ "/proj/micrographs/s1.mrcs": V("mrc-single", 4096, 4092, 1, 2) }),
      (row) => `/proj/${row}`
    );
    must(!r.refusal && /single-section 4096×4092/.test(r.note), "A2 verified singles pass with a note");
  }

  // A3 — no sniffer → advisory note, never a block
  {
    const r = await gate.extractInputGate(["micrographs/x.mrcs"], null, ID);
    must(!r.refusal && /were not verified/.test(r.note), "A3 sniffer-less degrades to the note");
  }

  // A4 — a THROWING sniffer degrades to the note (the t312 lesson)
  {
    const r = await gate.extractInputGate(
      ["micrographs/y.mrcs"],
      async () => {
        throw new Error("ssh hiccup");
      },
      ID
    );
    must(!r.refusal && /could not be verified/.test(r.note), "A4 a throwing sniffer never blocks");
  }

  // A5 — a pure .mrc star and an empty row list are SILENT (name-level
  // geometry belongs to t334's scan; this census has nothing to say)
  {
    const r1 = await gate.extractInputGate(["micrographs/a.mrc", "micrographs/b.mrc"], null, ID);
    must(!r1.refusal && r1.note === null, "A5a a pure .mrc star is silent");
    const r2 = await gate.extractInputGate([], null, ID);
    must(!r2.refusal && r2.note === null, "A5b an empty row list is silent");
    const r3 = await gate.extractInputGate(["micrographs/a.mrc", "micrographs/a.mrc"], null, ID);
    must(!r3.refusal, "A5c duplicates are NOT this census's word (t334 owns them)");
  }

  // A6 — the star-row reader (optics block skipped, data_micrographs rows)
  {
    const star = [
      "# some comment",
      "",
      "data_optics",
      "",
      "loop_",
      "_rlnOpticsGroup #1",
      "_rlnMicrographPixelSize #2",
      "1 0.93",
      "",
      "data_micrographs",
      "",
      "loop_",
      "_rlnMicrographName #1",
      "_rlnOpticsGroup #2",
      "micrographs/mic_01.mrc 1",
      "micrographs/st_01.mrcs 1",
      "",
    ].join("\n");
    const rows = gate.micrographRowsFromContent(star);
    must(
      rows.length === 2 && rows[0] === "micrographs/mic_01.mrc" && rows[1] === "micrographs/st_01.mrcs",
      "A6 the reader takes the micrographs block's first column, optics untouched"
    );
  }

  // ====================================================================
  console.log("== PHASE B: LIVE — the mixed shape: t334's wording + the census receipt ==");

  const mkConn = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t335",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);

  const probeRes = await api(`/api/remote/connections/${CONN}/test`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({}),
  });
  must(probeRes.status >= 200 && probeRes.status < 300, `the probe answers (${probeRes.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t335 frame census", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  // the Beijing shape on the mock's disk: 2 .mrc sums + 1 .mrcs FRAME STACK
  // that is the TWIN of mic_02 (nz=8 — the header says frames)
  const MIC = mrcHeaderB64(1024, 1024, 1, 2);
  const STACK = mrcHeaderB64(1024, 1024, 8, 2);
  const fx = client(
    "mkdir -p /data2/t335-mics; " +
      `echo ${MIC} | base64 -d > /tmp/.t335-mic.mrc; ` +
      `echo ${STACK} | base64 -d > /tmp/.t335-stack.mrcs; ` +
      "cp /tmp/.t335-mic.mrc /data2/t335-mics/mic_01.mrc; " +
      "cp /tmp/.t335-mic.mrc /data2/t335-mics/mic_02.mrc; " +
      "cp /tmp/.t335-stack.mrcs /data2/t335-mics/mic_02.mrcs"
  );
  must(fx === "", `the Beijing fixtures build quietly (${fx.slice(0, 80)})`);

  const importA = await mkJob({
    projectId,
    type: "import",
    name: "QA t335 import (mixed)",
    params: {
      micrographsPath: ["/data2/t335-mics/mic_01.mrc", "/data2/t335-mics/mic_02.mrc", "/data2/t335-mics/mic_02.mrcs"].join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  await api(`/api/jobs/${importA.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneImportA = await awaitJobTerminal(importA.id, 90_000);
  must(doneImportA?.status === "completed", `the mixed import completes (${doneImportA?.status})`);
  must(
    /mixed extensions: 2 \.mrc \+ 1 \.mrcs/.test(String(doneImportA?.result ?? "")),
    `the import receipt carries the extension census (${String(doneImportA?.result ?? "").slice(0, 160)})`
  );

  const autopickA = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t335 autopick (mixed)",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractA = await mkJob({
    projectId,
    type: "extract",
    name: "QA t335 extract (should refuse)",
    params: { boxSize: 128 },
  });
  must(!!autopickA?.id && !!extractA?.id, "the autopick/extract jobs create");
  must(
    [await mkEdge(importA.id, autopickA.id, "micrographs", "micrographs"),
     await mkEdge(importA.id, extractA.id, "micrographs", "micrographs"),
     await mkEdge(autopickA.id, extractA.id, "coords", "coords")]
      .every((s) => s === 200 || s === 201),
    "the DAG wires import → autopick → extract"
  );

  const dAP = await dispatch(autopickA.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm" },
  });
  must(dAP.status >= 200 && dAP.status < 300 && !dAP.body?.error, `the LoG autopick dispatch is accepted (${dAP.status})`);
  const doneAP = await awaitJobTerminal(autopickA.id, 180_000);
  must(doneAP?.status === "completed", `the LoG autopick completes (${doneAP?.status})`);

  // ---- the DOOR: t334's collision wording on the local star path -------
  const before = await jobById(extractA.id);
  const dEX = await dispatch(extractA.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm" },
  });
  must(dEX.status >= 200 && dEX.status < 300, `the refusal answers on the dispatch channel (${dEX.status})`);
  const errText = String(dEX.body?.error ?? "");
  must(
    !!dEX.body?.error,
    `the refusal carries an error body (body: ${JSON.stringify(dEX.body ?? {}).slice(0, 240)})`
  );
  must(/would collide inside the extraction/.test(errText), `t334's wording speaks (${errText.slice(0, 110)}…)`);
  must(/mic_02\.mrc\b/.test(errText) && /mic_02\.mrcs\b/.test(errText), "the refusal names the colliding pair");
  must(/target and source objects have different size/.test(errText), "the refusal quotes the image.h:1534 abort");

  const after = await jobById(extractA.id);
  must(
    after?.status === before?.status,
    `the job row keeps its state (${before?.status} → ${after?.status}) — nothing was dispatched`
  );
  must(
    client(`ls /projects/cryoflow/${projectId}/extract_${extractA.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`) === "",
    "no sbatch script ever landed on the cluster (the refusal preceded staging)"
  );

  // ====================================================================
  console.log("== PHASE B2: LIVE — stacks only: the byte-verified refusal ==");

  const fx2 = client(
    "mkdir -p /data2/t335-stacks; " +
      "cp /tmp/.t335-stack.mrcs /data2/t335-stacks/st_01.mrcs; " +
      "cp /tmp/.t335-stack.mrcs /data2/t335-stacks/st_02.mrcs"
  );
  must(fx2 === "", `the stack fixtures build quietly (${fx2.slice(0, 80)})`);

  const importC = await mkJob({
    projectId,
    type: "import",
    name: "QA t335 import (stacks only)",
    params: {
      micrographsPath: ["/data2/t335-stacks/st_01.mrcs", "/data2/t335-stacks/st_02.mrcs"].join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  await api(`/api/jobs/${importC.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneImportC = await awaitJobTerminal(importC.id, 90_000);
  must(doneImportC?.status === "completed", `the stacks import completes (${doneImportC?.status})`);

  const autopickC = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t335 autopick (stacks)",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractC = await mkJob({
    projectId,
    type: "extract",
    name: "QA t335 extract (stacks — should refuse)",
    params: { boxSize: 128 },
  });
  must(
    [await mkEdge(importC.id, autopickC.id, "micrographs", "micrographs"),
     await mkEdge(importC.id, extractC.id, "micrographs", "micrographs"),
     await mkEdge(autopickC.id, extractC.id, "coords", "coords")]
      .every((s) => s === 200 || s === 201),
    "the stacks DAG wires"
  );
  const dAPC = await dispatch(autopickC.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm" },
  });
  must(dAPC.status >= 200 && dAPC.status < 300 && !dAPC.body?.error, `the stacks autopick dispatch is accepted (${dAPC.status})`);
  const doneAPC = await awaitJobTerminal(autopickC.id, 180_000);
  must(doneAPC?.status === "completed", `the stacks autopick completes (${doneAPC?.status})`);

  const dEXC = await dispatch(extractC.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm" },
  });
  const errC = String(dEXC.body?.error ?? "");
  must(
    !!dEXC.body?.error,
    `B2 the sniffed refusal carries an error body (body: ${JSON.stringify(dEXC.body ?? {}).slice(0, 240)})`
  );
  must(/FRAME STACKS/.test(errC), `B2 names the frame stacks (${errC.slice(0, 90)}…)`);
  must(/8 sections × 1024×1024/.test(errC), "B2 carries the fixture header's own numbers (nz=8 read over SSH)");
  must(/movie stack, not a micrograph/.test(errC), "B2 teaches the MotionCorr-first fix");
  const afterC = await jobById(extractC.id);
  must(afterC?.status !== "failed", `B2 the job row never flips to failed (${afterC?.status})`);
  must(
    client(`ls /projects/cryoflow/${projectId}/extract_${extractC.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`) === "",
    "B2 nothing dispatched to the cluster"
  );

  // ====================================================================
  console.log("== PHASE B3: LIVE — the twin-star closure (SSH cat) ==");

  // The REAL t324-a shape: the upstream is a REMOTE ctffind whose output
  // star stays registered as a cluster twin. (The import job cannot play
  // this role — its star is generated by the APP, locally; its record has
  // no remote section, so deleting the local file is an honest missing
  // input, not a twin resolution. The probe run proved both halves.)
  const ctfA = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t335 ctffind (mixed)",
    params: {},
  });
  must(!!ctfA?.id, "the ctffind job creates");
  const eCTF = await mkEdge(importA.id, ctfA.id, "micrographs", "micrographs");
  must(eCTF === 200 || eCTF === 201, `the import → ctffind edge wires (${eCTF})`);
  const dCTF = await dispatch(ctfA.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm" },
  });
  must(
    dCTF.status >= 200 && dCTF.status < 300 && !dCTF.body?.error,
    `the mixed ctffind dispatch is accepted — the CTF gate's movie-naming smell does not flag these names (${dCTF.status})`
  );
  const doneCTF = await awaitJobTerminal(ctfA.id, 240_000);
  must(doneCTF?.status === "completed", `the mixed ctffind completes (${doneCTF?.status})`);

  // a fresh extract wired from the CTF star (twin-carrying) + autopick coords
  const extractD = await mkJob({
    projectId,
    type: "extract",
    name: "QA t335 extract (twin star)",
    params: { boxSize: 128 },
  });
  must(!!extractD?.id, "the twin-star extract job creates");
  const eD1 = await mkEdge(ctfA.id, extractD.id, "micrographs", "micrographs");
  const eD2 = await mkEdge(autopickA.id, extractD.id, "coords", "coords");
  must(
    (eD1 === 200 || eD1 === 201) && (eD2 === 200 || eD2 === 201),
    `the twin-star extract wires (ctf ${eD1} / coords ${eD2})`
  );

  // the twin moment: delete the CTF star's LOCAL copy — the record's
  // cluster twin (remoteOutputs, or the t324 heal's probe) must resolve
  // the input to the CLUSTER path, and the dispatch cat's it over SSH
  const ctfRec = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[ctfA.id] ?? null;
  const ctfStarLocal = ctfRec?.outputs?.micrographs_ctf_star ?? null;
  must(!!ctfStarLocal && existsSync(ctfStarLocal), "the ctffind star's local copy exists (stars always sync home)");
  rmSync(ctfStarLocal, { force: true });
  must(!existsSync(ctfStarLocal), "the local CTF star copy is gone — the dispatch must resolve the cluster twin");

  const dEX2 = await dispatch(extractD.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm" },
  });
  const err2 = String(dEX2.body?.error ?? "");
  const jobD = await jobById(extractD.id);
  must(
    !!dEX2.body?.error,
    `B3 the twin-star refusal still speaks (status ${jobD?.status}, body: ${JSON.stringify(dEX2.body ?? {}).slice(0, 260)})`
  );
  must(/would collide inside the extraction/.test(err2), "B3 the t334 scan re-ran on the SSH-read text (same wording)");
  must(/mic_02\.mrcs\b/.test(err2), "B3 the colliding pair is still named");
  must(jobD?.status !== "failed", `B3 the twin-star row keeps its state (${jobD?.status})`);

  // ====================================================================
  console.log("== PHASE C: CLEAN — no false positive ==");

  const importB = await mkJob({
    projectId,
    type: "import",
    name: "QA t335 import (clean)",
    params: {
      micrographsPath: ["/data2/t335-mics/mic_01.mrc", "/data2/t335-mics/mic_02.mrc"].join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  await api(`/api/jobs/${importB.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneImportB = await awaitJobTerminal(importB.id, 90_000);
  must(doneImportB?.status === "completed", `the clean import completes (${doneImportB?.status})`);
  must(!/mixed extensions/.test(String(doneImportB?.result ?? "")), "the clean receipt has no census warning");

  const autopickB = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t335 autopick (clean)",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractB = await mkJob({
    projectId,
    type: "extract",
    name: "QA t335 extract (clean)",
    params: { boxSize: 128 },
  });
  must(
    [await mkEdge(importB.id, autopickB.id, "micrographs", "micrographs"),
     await mkEdge(importB.id, extractB.id, "micrographs", "micrographs"),
     await mkEdge(autopickB.id, extractB.id, "coords", "coords")]
      .every((s) => s === 200 || s === 201),
    "the clean DAG wires"
  );
  const dAPB = await dispatch(autopickB.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm" },
  });
  must(dAPB.status >= 200 && dAPB.status < 300 && !dAPB.body?.error, `the clean autopick dispatch is accepted (${dAPB.status})`);
  const doneAPB = await awaitJobTerminal(autopickB.id, 180_000);
  must(doneAPB?.status === "completed", `the clean autopick completes (${doneAPB?.status})`);

  const dEXB = await dispatch(extractB.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm" },
  });
  must(
    dEXB.status >= 200 && dEXB.status < 300 && !dEXB.body?.error,
    `the clean extract dispatch is ACCEPTED — no false positive (${dEXB.status})`
  );
  const doneEXB = await awaitJobTerminal(extractB.id, 240_000);
  must(
    doneEXB?.status === "completed",
    `the clean extract COMPLETES on the cluster (${(await jobById(extractB.id))?.status ?? "?"}: ${String((await jobById(extractB.id))?.result ?? "").slice(0, 120)})`
  );

  // ====================================================================
  console.log("== PHASE D: PINS — the source ledger ==");

  const gateSrc = readFileSync(`${ROOT}/src/lib/relion/extract-gate.ts`, "utf8");
  const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  const rrSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");

  must(/the extract frame census \(t335\)/.test(gateSrc), "D1 the pure module carries the t335 contract");
  must(/mrc-stack/.test(gateSrc) && /single-section/.test(gateSrc), "D2 both sniff verdicts speak");
  must(/async function catRemote/.test(rrSrc) && /catRemote\(conn, twin\)/.test(rrSrc), "D3 the twin-resolved star is cat'd over SSH (t334's skip closed; t343's catRemote, one lane one address)");
  must(/scanExtractCollisions\(starText\)/.test(rrSrc), "D4 the t334 scan re-runs on the SSH-read text");
  must(/extractInputGate\(\s*rows,/.test(rrSrc), "D5 the dispatch calls the frame census");
  must(/ctffindGateNote \?\? extractGateNote/.test(rrSrc), "D6 the census note rides the submitted script's log");
  must(/mixed extensions/.test(engineSrc), "D7 the import receipt carries the extension census");
  must(/extractInputGate/.test(engineSrc), "D8 the local lane runs the same census");
  must(!/rm -rf \$\{clearW\}\/micrographs/.test(rrSrc), "D9 the redundant blade-3 sweep is gone (t333's generation wipe owns it)");

  console.log(`\n${fail === 0 ? "ALL GREEN" : `${fail} FAILURE(S)`}`);
} finally {
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  }
  if (projectId) client(`rm -rf /projects/cryoflow/${projectId}`);
  client("rm -rf /data2/t335-mics /data2/t335-stacks /tmp/.t335-mic.mrc /tmp/.t335-stack.mrcs");
}
process.exit(fail === 0 ? 0 : 1);

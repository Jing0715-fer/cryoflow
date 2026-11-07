#!/usr/bin/env bun
/**
 * t338 diag — the particle-star ↔ stack consistency gate, verified live
 * against the field report's exact poison.
 *
 * The user's ticket (2D classification, ~1 minute in):
 *   「readMRC: Image number 341 exceeds stack size 340 of image
 *     00000341@/data03/Lijing/cryoflow/…/extract_ufh1hg0u/micrographs/
 *     …_133825_Fractions_DW.mrcs」 (rwMRC.h line 178, inside
 *   relion_refine's initialiseSigma2Noise) — while the upstream extraction
 *   had COMPLETED (exit 0). Its particles.star numbers more images than
 *   the stack holds: the t334 collision's SILENT variant (two same-stem
 *   rows in the extraction's input — "X.mrc" + "X.mrcs" — compose ONE
 *   stack path; the later writer's first particle blindly truncates the
 *   earlier writer's images while the merged star keeps both writers'
 *   rows).
 *
 * THIS suite pins three blades:
 *   1. the CONSUMER-side gate (particle-ref-gate.ts): every "N@path" ref
 *      in a particles star is checked against the stack's own MRC header
 *      before a class2d-class job stages — a star that outruns its stacks
 *      is refused with the exact numbers RELION would die on; healthy
 *      stars pass with a receipt note; unverifiable refs degrade to the
 *      note, never a block.
 *   2. the MOCK's extract dialect now numbers rows PER STACK (real
 *      RELION's grammar — the old global counter was a shape no real
 *      RELION produces and the gate rightly refuses).
 *   3. the log-diagnosis pattern (readmrc-exceeds-stack) heals the logs
 *      that already died.
 *
 * PHASES:
 *  A. UNIT — the PURE gate: the user's exact shape refuses with numbers;
 *     healthy passes with the verified note; no/throwing sniffer and
 *     unresolvable/.eer refs degrade to notes; the candidate grammar;
 *     multi-violation truncation; the diagnosis pattern fires on the
 *     user's verbatim stderr and never on a healthy log.
 *  B. LIVE — the healthy control: import → autopick → extract @slurm
 *     completes; the extract star is per-stack numbered (mock fidelity);
 *     class2d dispatches, the gate VERIFIES (receipt note in run.out),
 *     and the job completes — zero false positives.
 *  C. LIVE — the poison: one stack's NZ rewritten in place (341→340's
 *     exact shape: maxImage-1) → a fresh class2d's dispatch is REFUSED as
 *     a request error with the numbers; the row keeps its state; nothing
 *     lands on the cluster.
 *  D. LIVE — the twin-star closure analog: the extract star's LOCAL copy
 *     deleted → the input resolves to the cluster twin → the gate cat's
 *     the star over SSH → the SAME refusal.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t338";
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
  console.log("== PHASE A: UNIT — the PURE gate ==");

  const gate = await import(`${ROOT}/src/lib/relion/particle-ref-gate.ts`);
  const diag = await import(`${ROOT}/src/lib/log-diagnosis.ts`);
  const V = (kind, nx, ny, nz) => ({ kind, facts: { nx, ny, nz, mode: 2, bytesPerVoxel: 4 } });
  const sniffOf = (map) => async (paths) => {
    const out = {};
    for (const p of paths) out[p] = map[p] ?? { kind: "unknown" };
    return out;
  };
  // the gate's candidatesOf returns an ARRAY of candidate paths (absolute
  // refs ride alone — one entry); identity here means "the ref as written"
  const ID = (r) => [r];

  // the user's EXACT dialect: absolute refs into the extract workdir's
  // micrographs/ tree, the last row of the FIRST micrograph's stack
  // numbering one past what the stack actually holds (341 vs 340)
  const USER_STACK = "/data03/Lijing/cryoflow/prj/extract_ufh1hg0u/micrographs/20241031_lijing_925_neiyan_2_1_20241031_133825_Fractions_DW.mrcs";
  const USER_STACK2 = "/data03/Lijing/cryoflow/prj/extract_ufh1hg0u/micrographs/20241031_lijing_925_neiyan_2_1_20241031_133817_Fractions_DW.mrcs";
  const userStar = [
    "data_optics", "", "loop_", "_rlnOpticsGroup #1", "1", "",
    "data_particles", "", "loop_", "_rlnImageName #1", "_rlnCoordinateX #2", "_rlnCoordinateY #3",
  ];
  for (let i = 1; i <= 341; i++) {
    userStar.push(`${String(i).padStart(6, "0")}@${USER_STACK}\t${100 + i}.0\t${120 + i}.0`);
  }
  for (let i = 1; i <= 8; i++) {
    userStar.push(`${String(i).padStart(6, "0")}@${USER_STACK2}\t${90 + i}.0\t${80 + i}.0`);
  }
  const userStarText = userStar.join("\n") + "\n";

  // A1 — the user's shape refuses with the exact numbers
  {
    const r = await gate.particlesRefGate(
      "/data03/Lijing/cryoflow/prj/extract_ufh1hg0u/particles.star",
      userStarText,
      sniffOf({
        [USER_STACK]: V("mrc-stack", 128, 128, 340),
        [USER_STACK2]: V("mrc-stack", 128, 128, 8),
      }),
      ID
    );
    must(!!r.refusal, "A1 a star that outruns its stack refuses");
    must(/image 341 in .*133825_Fractions_DW\.mrcs but that stack holds 340 image\(s\)/.test(r.refusal), "A1 carries the user's exact numbers (341 vs 340)");
    must(/readMRC/.test(r.refusal) && /exceeds stack size/.test(r.refusal), "A1 names the rwMRC death it prevents");
    must(/upstream extraction COMPLETED but its output is internally inconsistent/.test(r.refusal), "A1 says the quiet part: extract succeeded, the star lies");
    must(/Re-run the upstream extraction/.test(r.refusal), "A1's remedy names the upstream job");
    must(!r.note, "A1 no note rides a refusal");
  }

  // A2 — the healthy star passes with the verified receipt
  {
    const r = await gate.particlesRefGate(
      "x/particles.star",
      userStarText,
      sniffOf({
        [USER_STACK]: V("mrc-stack", 128, 128, 341),
        [USER_STACK2]: V("mrc-stack", 128, 128, 8),
      }),
      ID
    );
    must(!r.refusal, "A2 a healthy star passes");
    must(/349 particle ref\(s\) verified/.test(r.note ?? ""), "A2 the receipt counts the verified refs (341+8)");
    must(/within its stack's size/.test(r.note ?? ""), "A2 the receipt says what was checked");
  }

  // A3 — no sniffer → advisory note, never a block
  {
    const r = await gate.particlesRefGate("x/particles.star", userStarText, null, ID);
    must(!r.refusal && /were not verified/.test(r.note ?? ""), "A3 sniffer-less degrades to the note");
  }

  // A4 — a THROWING sniffer degrades to the note (the t312 lesson)
  {
    const r = await gate.particlesRefGate(
      "x/particles.star",
      userStarText,
      async () => {
        throw new Error("ssh hiccup");
      },
      ID
    );
    must(!r.refusal, "A4 a throwing sniffer never blocks");
  }

  // A5 — unresolvable refs (all candidates missing) are the note's
  // business, not the refusal's
  {
    const r = await gate.particlesRefGate(
      "x/particles.star",
      userStarText,
      sniffOf({}),
      ID
    );
    must(!r.refusal && /could not be verified/.test(r.note ?? ""), "A5 missing stacks degrade to the note");
  }

  // A6 — an .eer ref cannot be judged by NZ (kind without facts)
  {
    const r = await gate.particlesRefGate(
      "x/particles.star",
      "00000005@/data/movies/raw.eer\t1.0\t2.0\n",
      sniffOf({ "/data/movies/raw.eer": { kind: "eer" } }),
      ID
    );
    must(!r.refusal && /could not be verified/.test(r.note ?? ""), "A6 an .eer ref is never a block");
  }

  // A7 — the candidate grammar: absolute rides alone; relative tries the
  // project root first (RELION's CWD truth), then the star's own dir;
  // identical roots collapse to one candidate
  {
    must(gate.refCandidates("/abs/x.mrcs", "/proj", "/proj/job").length === 1, "A7a absolute refs ride alone");
    const rel = gate.refCandidates("extra/x.mrcs", "/proj", "/proj/job");
    must(rel.length === 2 && rel[0] === "/proj/extra/x.mrcs" && rel[1] === "/proj/job/extra/x.mrcs", "A7b relative refs try root then star dir");
    must(gate.refCandidates("extra/x.mrcs", "/proj", "/proj").length === 1, "A7c identical roots collapse");
    must(gate.refCandidates("./extra/x.mrcs", "/proj", "/proj/job")[0] === "/proj/extra/x.mrcs", "A7d a leading ./ is normalized away");
  }

  // A8 — many violations truncate to three + the count
  {
    const rows = ["data_particles", "loop_", "_rlnImageName #1"];
    const map = {};
    for (let s = 1; s <= 4; s++) {
      const p = `/proj/extra/st_${s}.mrcs`;
      for (let i = 1; i <= 10; i++) rows.push(`${String(i).padStart(6, "0")}@${p}\t${i}.0\t${i}.0`);
      map[p] = V("mrc-stack", 64, 64, 3);
    }
    const r = await gate.particlesRefGate("x/particles.star", rows.join("\n") + "\n", sniffOf(map), ID);
    must(!!r.refusal, "A8 four poisoned stacks refuse");
    must(/\+1 more/.test(r.refusal), "A8 the evidence truncates at three with the count");
    must(/st_1\.mrcs/.test(r.refusal) && /st_3\.mrcs/.test(r.refusal), "A8 the first three are named");
  }

  // A9 — the log-diagnosis pattern: the user's verbatim stderr matches;
  // a healthy log and the t334 write-clash signature do not cross-match
  {
    const userLine = [
      "in: /data2/home/relion5/relion2/relion-master/src/rwMRC.h, line 178",
      "ERROR:",
      `readMRC: Image number 341 exceeds stack size 340 of image 00000341@${USER_STACK}`,
    ].join("\n");
    const f = diag.diagnoseLog(userLine);
    must(f.some((x) => x.id === "readmrc-exceeds-stack"), "A9a the user's verbatim stderr matches the new pattern");
    const label = f.find((x) => x.id === "readmrc-exceeds-stack")?.label ?? "";
    must(/outruns its stack/.test(label), "A9b the label speaks the mechanism");
    const healthy = diag.diagnoseLog("Micrograph 3/4: mic_03 — 9 particles (box=128)\ncryoflow-mock extract: 31 particles across 4 micrographs");
    must(!healthy.some((x) => x.id === "readmrc-exceeds-stack"), "A9c a healthy extract log never matches");
    const writeClash = diag.diagnoseLog("ERROR: write: target and source objects have different size");
    must(
      writeClash.some((x) => x.id === "extract-stack-size-clash") &&
        !writeClash.some((x) => x.id === "readmrc-exceeds-stack"),
      "A9d the t334 write-clash keeps its own pattern (no cross-talk)"
    );
  }

  // ====================================================================
  console.log("== PHASE B: LIVE — the healthy control (zero false positives) ==");

  const mkConn = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t338",
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
    body: JSON.stringify({ name: "QA t338 particle-ref gate", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  // three single-section micrographs on the mock's disk
  const MIC = mrcHeaderB64(1024, 1024, 1, 2);
  const fx = client(
    "mkdir -p /data2/t338-mics; " +
      `echo ${MIC} | base64 -d > /tmp/.t338-mic.mrc; ` +
      "cp /tmp/.t338-mic.mrc /data2/t338-mics/mic_01.mrc; " +
      "cp /tmp/.t338-mic.mrc /data2/t338-mics/mic_02.mrc; " +
      "cp /tmp/.t338-mic.mrc /data2/t338-mics/mic_03.mrc"
  );
  must(fx === "", `the fixtures build quietly (${fx.slice(0, 80)})`);

  const importB = await mkJob({
    projectId,
    type: "import",
    name: "QA t338 import",
    params: {
      micrographsPath: ["/data2/t338-mics/mic_01.mrc", "/data2/t338-mics/mic_02.mrc", "/data2/t338-mics/mic_03.mrc"].join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  await api(`/api/jobs/${importB.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneImportB = await awaitJobTerminal(importB.id, 90_000);
  must(doneImportB?.status === "completed", `the import completes (${doneImportB?.status})`);

  const autopickB = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t338 autopick",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractB = await mkJob({
    projectId,
    type: "extract",
    name: "QA t338 extract",
    params: { boxSize: 128 },
  });
  const class2dB = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t338 class2d (healthy)",
    params: { numClasses: 2 },
  });
  must(!!autopickB?.id && !!extractB?.id && !!class2dB?.id, "the autopick/extract/class2d jobs create");
  must(
    [
      await mkEdge(importB.id, autopickB.id, "micrographs", "micrographs"),
      await mkEdge(importB.id, extractB.id, "micrographs", "micrographs"),
      await mkEdge(autopickB.id, extractB.id, "coords", "coords"),
      await mkEdge(extractB.id, class2dB.id, "particles", "particles"),
    ].every((s) => s === 200 || s === 201),
    "the DAG wires import → autopick → extract → class2d"
  );

  const dAP = await dispatch(autopickB.id, { remote: { connectionId: CONN, module: MODULE, mode: "slurm" } });
  must(dAP.status >= 200 && dAP.status < 300 && !dAP.body?.error, `the LoG autopick dispatch is accepted (${dAP.status})`);
  const doneAP = await awaitJobTerminal(autopickB.id, 180_000);
  must(doneAP?.status === "completed", `the LoG autopick completes (${doneAP?.status})`);

  const dEX = await dispatch(extractB.id, { remote: { connectionId: CONN, module: MODULE, mode: "slurm" } });
  must(dEX.status >= 200 && dEX.status < 300 && !dEX.body?.error, `the extract dispatch is accepted (${dEX.status})`);
  const doneEX = await awaitJobTerminal(extractB.id, 240_000);
  must(doneEX?.status === "completed", `the extract completes (${doneEX?.status})`);

  // B0 — the mock fidelity pin: the extract star's rows are numbered
  // PER STACK (real RELION's grammar; the t338 renumber)
  {
    const exW = `/projects/cryoflow/${projectId}/extract_${extractB.id.slice(-8)}`;
    const starText = client(`cat ${exW}/particles.star`);
    must(/data_particles/.test(starText) && /_rlnImageName/.test(starText), "B0a the extract star is readable on the cluster");
    const perStack = new Map();
    for (const line of starText.split("\n")) {
      const m = /^(\d{6})@(\S+)/.exec(line.trim());
      if (m) {
        const cur = perStack.get(m[2]) ?? 0;
        perStack.set(m[2], Math.max(cur, Number(m[1])));
      }
    }
    must(perStack.size === 3, `B0b one stack per micrograph (got ${perStack.size})`);
    const maxes = [...perStack.values()];
    must(
      maxes.every((v) => v >= 8 && v <= 12),
      `B0c per-stack maxima in the mock's 8..12 range (${maxes.join(",")}) — the numbering is PER STACK, not global`
    );
  }

  // B1 — the healthy class2d: the gate VERIFIES (receipt note rides the
  // submitted script's log) and the job completes
  {
    const dC2 = await dispatch(class2dB.id, {
      remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 2 },
    });
    must(dC2.status >= 200 && dC2.status < 300 && !dC2.body?.error, `B1a the healthy class2d dispatch is accepted (${dC2.status})`);
    const doneC2 = await awaitJobTerminal(class2dB.id, 240_000);
    must(doneC2?.status === "completed", `B1b the healthy class2d completes (${doneC2?.status})`);
    const c2W = `/projects/cryoflow/${projectId}/class2d_${class2dB.id.slice(-8)}`;
    const runOut = client(`cat ${c2W}/run.out`);
    must(
      /particle ref\(s\) verified against their stacks' own MRC headers/.test(runOut),
      `B1c the verified receipt rides the run's log (CRYOFLOW_NOTE)`
    );
    must(!/Image number \d+ exceeds/.test(runOut), "B1d no poison wording in the healthy run");
  }

  // ====================================================================
  console.log("== PHASE C: LIVE — the poison (the user's 341→340 shape) ==");

  // rewrite ONE stack's header NZ to maxImage-1, exactly the silent-twin
  // arithmetic the field report carried (writer B's overwrite left one
  // image fewer than the star's rows count)
  let poisonStack = null;
  let poisonMaxImage = 0;
  {
    const exRec = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[extractB.id] ?? null;
    const starLocal = exRec?.outputs?.particles_star ?? null;
    must(!!starLocal && existsSync(starLocal), "C0a the extract star's local copy exists (small stars sync home)");
    const text = readFileSync(starLocal, "utf8");
    const perStack = new Map();
    for (const line of text.split("\n")) {
      const m = /^(\d{6})@(\S+)/.exec(line.trim());
      if (m) {
        const cur = perStack.get(m[2]) ?? 0;
        perStack.set(m[2], Math.max(cur, Number(m[1])));
      }
    }
    // pick the SECOND stack (the middle micrograph — arbitrary but stable)
    const entries = [...perStack.entries()];
    poisonStack = entries[1]?.[0] ?? null;
    poisonMaxImage = entries[1]?.[1] ?? 0;
    must(!!poisonStack && poisonMaxImage > 1, `C0b the poison target resolves (${poisonStack} → max image ${poisonMaxImage})`);

    // the CLUSTER-side path of that stack: the star's dir on the cluster
    const exW = `/projects/cryoflow/${projectId}/extract_${extractB.id.slice(-8)}`;
    const clusterStack = poisonStack.startsWith("/")
      ? poisonStack
      : `${exW}/${poisonStack.replace(/^\.\//, "")}`;
    const nz = poisonMaxImage - 1;
    const poisoned = mrcHeaderB64(128, 128, nz, 2);
    const fxp = client(`echo ${poisoned} | base64 -d > ${clusterStack}`);
    must(fxp === "", `C0c the stack's NZ is rewritten to ${nz} (maxImage-1) quietly (${fxp.slice(0, 80)})`);
  }

  // a FRESH class2d wired to the same (still "completed") extract
  const class2dC = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t338 class2d (poisoned star)",
    params: { numClasses: 2 },
  });
  must(!!class2dC?.id, "C1a the poisoned class2d job creates");
  {
    const eC = await mkEdge(extractB.id, class2dC.id, "particles", "particles");
    must(eC === 200 || eC === 201, `C1b the extract → class2d edge wires (${eC})`);
  }

  {
    const before = await jobById(class2dC.id);
    const dC2 = await dispatch(class2dC.id, {
      remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 2 },
    });
    must(dC2.status >= 200 && dC2.status < 300, `C2a the refusal answers on the dispatch channel (${dC2.status})`);
    const errText = String(dC2.body?.error ?? "");
    must(!!dC2.body?.error, `C2b the refusal carries an error body (${JSON.stringify(dC2.body ?? {}).slice(0, 200)})`);
    must(
      new RegExp(`image ${poisonMaxImage} in .* but that stack holds ${poisonMaxImage - 1} image\\(s\\)`).test(errText),
      `C2c the refusal carries the exact numbers (${poisonMaxImage} vs ${poisonMaxImage - 1}: ${errText.slice(0, 140)}…)"`
    );
    must(/readMRC/.test(errText) && /exceeds stack size/.test(errText), "C2d the refusal names the death it prevents");
    must(/upstream extraction COMPLETED but its output is internally inconsistent/.test(errText), "C2e the refusal says the upstream is the liar");
    const after = await jobById(class2dC.id);
    must(after?.status === before?.status, `C2f the job row keeps its state (${before?.status} → ${after?.status}) — nothing was dispatched`);
    must(
      client(`ls /projects/cryoflow/${projectId}/class2d_${class2dC.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`) === "",
      "C2g no sbatch script ever landed on the cluster (the refusal preceded staging)"
    );
  }

  // ====================================================================
  console.log("== PHASE D: LIVE — the twin-star closure analog (SSH cat) ==");

  // delete the extract star's LOCAL copy — the input resolves to the
  // cluster twin, and the gate must read the star IN PLACE over SSH and
  // refuse with the same numbers
  {
    const exRec = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[extractB.id] ?? null;
    const starLocal = exRec?.outputs?.particles_star ?? null;
    must(!!starLocal && existsSync(starLocal), "D0a the local star copy exists before the deletion");
    rmSync(starLocal, { force: true });
    must(!existsSync(starLocal), "D0b the local star copy is gone — the dispatch must resolve the cluster twin");

    const class2dD = await mkJob({
      projectId,
      type: "class2d",
      name: "QA t338 class2d (twin star)",
      params: { numClasses: 2 },
    });
    must(!!class2dD?.id, "D1a the twin-star class2d job creates");
    const eD = await mkEdge(extractB.id, class2dD.id, "particles", "particles");
    must(eD === 200 || eD === 201, `D1b the extract → class2d edge wires (${eD})`);

    const dC2 = await dispatch(class2dD.id, {
      remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 2 },
    });
    const errText = String(dC2.body?.error ?? "");
    must(
      !!dC2.body?.error,
      `D2a the twin-star refusal still speaks (body: ${JSON.stringify(dC2.body ?? {}).slice(0, 240)})`
    );
    must(
      new RegExp(`image ${poisonMaxImage} in .* but that stack holds ${poisonMaxImage - 1} image\\(s\\)`).test(errText),
      "D2b the SSH-read star earns the SAME refusal with the same numbers"
    );
    const after = await jobById(class2dD.id);
    must(after?.status !== "failed", `D2c the job row never flips to failed (${after?.status})`);
    must(
      client(`ls /projects/cryoflow/${projectId}/class2d_${class2dD.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`) === "",
      "D2d nothing dispatched to the cluster"
    );
  }

  // ---- the witness burns (the t334/t337 doctrine: the mock's fake FS
  // stays a repo tree, not a fixture landfill) --------------------------
  const burn = client(
    "rm -rf /data2/t338-mics /tmp/.t338-mic.mrc; " +
      `rm -rf /projects/cryoflow/${projectId}; ls /data2 2>/dev/null`
  );
  must(!/t338/.test(burn), `the fixtures burn quietly (${burn.slice(0, 80)})`);

  console.log(fail === 0 ? "\nDIAG t338: ALL GREEN" : `\nDIAG t338: ${fail} FAILURE(S)`);
  process.exit(fail === 0 ? 0 : 1);
} catch (e) {
  console.error("DIAG t338 crashed:", e);
  process.exit(1);
}

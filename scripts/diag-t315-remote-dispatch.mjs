#!/usr/bin/env node
/**
 * t315 diag — "remote tasks must never be submitted to WSL" (the user's
 * words), plus the two legacy asks. The Beijing evidence: a remote
 * project's ctffind ran LOCALLY through the WSL bridge with a star full of
 * cluster-absolute /data06 rows — 195× "cannot get CTF values" and a
 * recorded command line wrapped in `wsl -d Debian -- bash -c {…}`.
 *
 * Root cause under test (A): the auto-start passthrough inherited remote-ness
 * ONLY from the trigger's own run record — but a remote project's IMPORT is
 * engine-native, runs locally by design, and carries no remote record. The
 * passthrough now falls back to the PROJECT's cluster binding.
 *
 * This suite proves the t315 contract end to end against the mock cluster:
 *
 *  A. THE REGRESSION: import (local, native) completes → the PENDING wired
 *     ctffind auto-starts ON THE CLUSTER (staging → direct-mode spawn →
 *     REMOTE[cryo@…] result, cluster workdir holds micrographs_ctf.star).
 *  B. THE LOCAL REFUSAL: the same star + a manual "run on this machine"
 *     is refused BEFORE any spawn — the error names the cluster door.
 *  C. THE ACTIVE DIAGNOSIS: a remote ctffind that fails with the all-failed
 *     signature gets a login-node readability verdict woven into the result
 *     (readable → compute-node mount story; gone → re-import story).
 *  D. NODE TYPES: movies/micrographs imports cross-checked against the byte
 *     sniff; a particles STAR imports (cluster-side, verbatim rows) and
 *     feeds Class2D's command preview; a micrographs star is refused
 *     honestly under the particles node type.
 *  E. THE RANDOM-5 GALLERY: a cluster-resident import's manifest carries
 *     the cluster strip + five random samples; the SSH preview door serves
 *     real PNGs (thumb + full), and refuses paths that are not this job's
 *     own rows.
 *
 * Run against the standalone prod server on :3001 (t301/t311 doctrine).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t315";
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
const apiRaw = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()) };
};

const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
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

// a REAL small MRC (1024-byte header + 64×64 float32 pixels) — the preview
// door renders actual pixels, header-only fixtures would not
const realMrcB64 = (() => {
  const nx = 64;
  const ny = 64;
  const data = Buffer.alloc(1024 + nx * ny * 4);
  data.writeInt32LE(nx, 0);
  data.writeInt32LE(ny, 4);
  data.writeInt32LE(1, 8); // NZ=1 — a summed micrograph
  data.writeInt32LE(2, 12); // MODE=2 — float32
  // NSYMBT stays 0 — the pixels start right after the 1024-byte header
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const v = Math.sin(x / 6.0) * Math.cos(y / 8.0) + (x + y) / 128;
      data.writeFloatLE(v, 1024 + (y * nx + x) * 4);
    }
  }
  return data.toString("base64");
})();

// a REAL small MRC stack for the particles star to point at (2 sections —
// the header says NZ>1 which is all the sniff needs; one exec command must
// stay well under the SSH channel's comfort size)
const stackMrcB64 = (() => {
  const nx = 48;
  const ny = 48;
  // t338 — NZ must cover every image the particles star references (the
  // dispatch's consumer gate refuses a star that outruns its stack; the
  // old nz=2 under a 24-row star was exactly that lie)
  const nz = 24;
  const data = Buffer.alloc(1024); // header-only (t338): the sniffers read the header; full pixel data would bloat the inline base64 past the mock's exec limits
  data.writeInt32LE(nx, 0);
  data.writeInt32LE(ny, 4);
  data.writeInt32LE(nz, 8);
  data.writeInt32LE(2, 12);
  return data.toString("base64");
})();

const cleanRemoteTree = (projectId = null) => {
  clientBoth(
    "rm -rf /data2/qa-t315-mics /data2/qa-t315-movies /data2/qa-t315-particles /data2/qa-t315-micstar.star; " +
      // t309 doctrine: the project's OWN cluster tree burns by id (the API
      // DELETE removes the app's records, not the cluster-side workdirs)
      `rm -rf /projects/cryoflow/qa-*${projectId ? " /projects/cryoflow/" + projectId : ""} /projects/cryoflow/_staged; ls /projects/cryoflow 2>/dev/null`
  );
  // the persistent stage map makes re-runs rewrite the fixture's (mock-
  // translated) FS_ROOT rows into _staged/ paths the mock's stubs cannot
  // resolve — a fresh map keeps every run at the first-encounter truth
  try {
    rmSync(`${ROOT}/data/remote-stage-map.json`, { force: true });
  } catch {
    /* best-effort */
  }
};

// ---------------------------------------------------------------- try/catch
try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");
  cleanRemoteTree();

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t315",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      defaultModule: "relion/5.0.1",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t315 remote dispatch", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  const projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const activate = await api("/api/projects/switch", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ id: projectId }),
  });
  must(activate.status >= 200 && activate.status < 300, "the project activates");

  // ======================================================================
  console.log("== PHASE 1: fixtures (real-bytes MRCs + stacks) ==");
  // one base64 payload per exec command — the channel chokes past ~100KB
  const fx1 = clientBoth(
    "mkdir -p /data2/qa-t315-mics /data2/qa-t315-movies /data2/qa-t315-particles; " +
      `echo ${realMrcB64} | base64 -d > /tmp/.t315-mic.mrc; ` +
      "for i in $(seq 1 20); do cp /tmp/.t315-mic.mrc /data2/qa-t315-mics/20241031_lijing_925_${i}_Fractions_DW.mrc; done"
  );
  must(fx1 === "", `the micrograph fixtures build quietly (${fx1.slice(0, 160)})`);
  const fx2 = clientBoth(
    `echo ${stackMrcB64} | base64 -d > /data2/qa-t315-particles/stack24.mrcs; ` +
      "for i in $(seq 1 8); do cp /data2/qa-t315-particles/stack24.mrcs /data2/qa-t315-movies/20241031_${i}_Fractions.mrc; done"
  );
  must(fx2 === "", `the stack fixtures build quietly (${fx2.slice(0, 160)})`);
  const fx3 = clientBoth(
    // a particles STAR: cluster-absolute idx@stack rows + optics
    "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/qa-t315-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/qa-t315-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/qa-t315-particles/particles.star; done; " +
      // a MICROGRAPHS-shaped star (for the wrong-dialect refusal)
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n1 0.93\\n\\ndata_micrographs\\n\\nloop_\\n_rlnMicrographName #1\\n_rlnOpticsGroup #2\\n' > /data2/qa-t315-micstar.star; " +
      "for i in $(seq 1 3); do printf '/data2/qa-t315-mics/20241031_lijing_925_${i}_Fractions_DW.mrc 1\\n' >> /data2/qa-t315-micstar.star; done"
  );
  must(fx3 === "", `the star fixtures build quietly (${fx3.slice(0, 160)})`);
  must(client("ls /data2/qa-t315-mics | wc -l").trim() === "20", "20 real-bytes micrographs");
  must(client("ls /data2/qa-t315-movies | wc -l").trim() === "8", "8 raw movie stacks");
  must(client("grep -c '@' /data2/qa-t315-particles/particles.star").trim() === "24", "the particles star holds 24 image rows");

  // ======================================================================
  console.log("== PHASE A: THE REGRESSION — the auto-start hands the cluster over ==");
  // ctffindA first: running it before the import flips it to PENDING
  // (waiting for upstream) — exactly the state the auto-start consumes.
  const importA = await mkJob({
    projectId,
    type: "import",
    name: "QA t315 import",
    params: { micrographsPath: "/data2/qa-t315-mics", pixelSize: 0.93, voltage: 300, nodeType: "micrographs" },
  });
  must(!!importA?.id, "the import job creates");
  const ctfA = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t315 auto ctffind",
    params: {},
  });
  must(!!ctfA?.id, "the auto ctffind job creates");
  must((await mkEdge(importA.id, ctfA.id, "micrographs", "micrographs")) < 300, "the edge wires import → ctffind");

  const preStart = await api(`/api/jobs/${ctfA.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(preStart.status >= 200 && preStart.status < 300, `the pre-wiring run accepts (${preStart.status})`);
  const pendingA = await jobById(ctfA.id);
  must(pendingA?.status === "pending", `the ctffind waits for its upstream (${pendingA?.status})`);

  // the import itself runs LOCALLY (engine-native) — the completion must
  // hand the PROJECT's cluster to the waiting ctffind, not the local lane
  const runImport = await api(`/api/jobs/${importA.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImport.status >= 200 && runImport.status < 300, `the import run accepts (${runImport.status})`);
  const doneImport = await pollUntil(async () => {
    const j = await jobById(importA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneImport?.status === "completed", `the import completes (${doneImport?.status})`);
  must(/20 micrographs imported/.test(String(doneImport?.result ?? "")), `the import counts 20: ${String(doneImport?.result ?? "").slice(0, 120)}`);

  // the assertion of the ticket: the PENDING ctffind auto-started REMOTELY
  const doneCtfA = await pollUntil(async () => {
    const j = await jobById(ctfA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(doneCtfA?.status === "completed", `the auto-started ctffind completes (${doneCtfA?.status}: ${String(doneCtfA?.result ?? "").slice(0, 140)})`);
  must(
    /REMOTE\[cryo@127\.0\.0\.1/.test(String(doneCtfA?.result ?? "")),
    `the result carries the REMOTE origin (not a local run): ${String(doneCtfA?.result ?? "").slice(0, 160)}`
  );
  const workdirA = `/projects/cryoflow/${projectId}/ctffind_${ctfA.id.slice(-8)}`;
  must(
    client(`test -f ${workdirA}/micrographs_ctf.star && echo YES`).trim() === "YES",
    "the cluster workdir holds the CTF output (it ran THERE)"
  );
  must(!!doneCtfA?.runRemote, "the DTO carries the remote strip (runRemote)");

  // ======================================================================
  console.log("== PHASE B: THE LOCAL REFUSAL — Run on this machine is refused honestly ==");
  const ctfB = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t315 local refusal",
    params: {},
  });
  must(!!ctfB?.id, "the refusal ctffind job creates");
  must((await mkEdge(importA.id, ctfB.id, "micrographs", "micrographs")) < 300, "the refusal edge wires");
  // t317 — the explicit local door now speaks { local: true }: a bare POST
  // inherits the project's cluster binding (the manual-door twin of the
  // passthrough fix), and only the EXPLICIT choice meets the refusal
  const localRun = await api(`/api/jobs/${ctfB.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ local: true }),
  });
  must(localRun.status >= 200 && localRun.status < 300, `the local run route answers (${localRun.status})`);
  const localErr = String(localRun.body?.error ?? "");
  must(/live on the CLUSTER/i.test(localErr), `the refusal names where the files live: ${localErr.slice(0, 140)}`);
  must(/Run on cluster/i.test(localErr), "the refusal names the right door");
  const failedB = await jobById(ctfB.id);
  must(failedB?.status === "failed", `the row fails honestly with the lesson (${failedB?.status})`);
  must(/live on the CLUSTER/i.test(String(failedB?.result ?? "")), "the row's result carries the lesson");
  must(
    client(`test -d /projects/cryoflow/${projectId}/ctffind_${ctfB.id.slice(-8)} && echo YES`).trim() !== "YES",
    "nothing landed on the cluster for the refused job"
  );

  // ======================================================================
  console.log("== PHASE C: THE ACTIVE DIAGNOSIS — the all-failed signature gets a verdict ==");
  // C1: files READABLE on the login node, the run still fails (the compute-
  // node mount story) — the .qa-ctf-allfail flag replays the user's log.
  const ctfC = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t315 allfail readable",
    params: {},
  });
  must(!!ctfC?.id, "the readable-diagnosis ctffind creates");
  must((await mkEdge(importA.id, ctfC.id, "micrographs", "micrographs")) < 300, "the readable-diagnosis edge wires");
  // plant the failure flag next to where the star WILL stage — BEFORE the
  // dispatch, so the stub reads it the moment it runs (no race)
  const stagedStarDirC = `/projects/cryoflow/${projectId}/import_${importA.id.slice(-8)}`;
  clientBoth(`mkdir -p ${stagedStarDirC} && touch ${stagedStarDirC}/.qa-ctf-allfail`);
  const dispatchC = await api(`/api/jobs/${ctfC.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchC.status >= 200 && dispatchC.status < 300, `the readable-diagnosis dispatch accepts (${dispatchC.status})`);
  const doneCtfC = await pollUntil(async () => {
    const j = await jobById(ctfC.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(doneCtfC?.status === "failed", `the flagged ctffind fails (${doneCtfC?.status})`);
  const resC = String(doneCtfC?.result ?? "");
  must(
    /IS readable on the login node/i.test(resC),
    `the diagnosis carries the READABLE verdict: ${resC.slice(0, 220)}`
  );
  must(/may not mount/i.test(resC), "the diagnosis tells the compute-node mount story");
  clientBoth(`rm -f ${stagedStarDirC}/.qa-ctf-allfail`);

  // C2: files GONE from the cluster (the re-import story) — import a real
  // folder, then delete it before the ctf runs
  const importC2 = await mkJob({
    projectId,
    type: "import",
    name: "QA t315 vanishing",
    params: { micrographsPath: "/data2/qa-t315-movies", pixelSize: 0.5, nodeType: "movies" },
  });
  must(!!importC2?.id, "the vanishing import creates");
  const runC2 = await api(`/api/jobs/${importC2.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runC2.status >= 200 && runC2.status < 300, `the vanishing import run accepts (${runC2.status})`);
  const doneC2 = await pollUntil(async () => {
    const j = await jobById(importC2.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneC2?.status === "completed", `the vanishing import completes (${doneC2?.status})`);
  must(/8 movies imported/.test(String(doneC2?.result ?? "")), "the movies import counts 8");
  clientBoth("rm -rf /data2/qa-t315-movies");
  const ctfC2 = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t315 allfail gone",
    params: {},
  });
  must(!!ctfC2?.id, "the gone-diagnosis ctffind creates");
  must((await mkEdge(importC2.id, ctfC2.id, "micrographs", "micrographs")) < 300, "the gone-diagnosis edge wires");
  const stagedStarDirC2 = `/projects/cryoflow/${projectId}/import_${importC2.id.slice(-8)}`;
  clientBoth(`mkdir -p ${stagedStarDirC2} && touch ${stagedStarDirC2}/.qa-ctf-allfail`);
  const dispatchC2 = await api(`/api/jobs/${ctfC2.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchC2.status >= 200 && dispatchC2.status < 300, `the gone-diagnosis dispatch accepts (${dispatchC2.status})`);
  const doneCtfC2 = await pollUntil(async () => {
    const j = await jobById(ctfC2.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(doneCtfC2?.status === "failed", `the gone ctffind fails (${doneCtfC2?.status})`);
  const resC2 = String(doneCtfC2?.result ?? "");
  must(
    /CANNOT read/i.test(resC2),
    `the diagnosis carries the GONE verdict: ${resC2.slice(0, 220)}`
  );
  must(/Re-import/i.test(resC2), "the gone diagnosis teaches the re-import");
  clientBoth(`rm -f ${stagedStarDirC2}/.qa-ctf-allfail`);

  // ======================================================================
  console.log("== PHASE D: NODE TYPES — movies / micrographs / particles ==");
  // D1: node type Movies on REAL frame stacks — agrees, no mismatch note
  const importMovies = await mkJob({
    projectId,
    type: "import",
    name: "QA t315 movies import",
    params: { micrographsPath: "/data2/qa-t315-mics", pixelSize: 0.93, nodeType: "movies" },
  });
  must(!!importMovies?.id, "the movies import creates");
  // (reuse the same folder — the headers are NZ=1, so Movies is the WRONG
  // type for it: the mismatch note must fire)
  const runMovies = await api(`/api/jobs/${importMovies.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runMovies.status >= 200 && runMovies.status < 300, `the movies import run accepts (${runMovies.status})`);
  const doneMovies = await pollUntil(async () => {
    const j = await jobById(importMovies.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneMovies?.status === "completed", `the movies import completes (${doneMovies?.status})`);
  const resMovies = String(doneMovies?.result ?? "");
  must(/20 movies imported/.test(resMovies), `the receipt speaks Movies: ${resMovies.slice(0, 140)}`);
  must(
    /Node type says Movies but the sampled headers say single-section/i.test(resMovies),
    "the Movies-on-micrographs mismatch note rides the receipt"
  );

  // D2: node type Micrographs on REAL frame stacks — the reverse mismatch
  const importMicsWrong = await mkJob({
    projectId,
    type: "import",
    name: "QA t315 mics-on-stacks",
    params: { micrographsPath: "/data2/qa-t315-particles", pixelSize: 0.93, nodeType: "micrographs" },
  });
  must(!!importMicsWrong?.id, "the mics-on-stacks import creates");
  const runMicsWrong = await api(`/api/jobs/${importMicsWrong.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneMicsWrong = await pollUntil(async () => {
    const j = await jobById(importMicsWrong.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneMicsWrong?.status === "completed", `the mics-on-stacks import completes (${doneMicsWrong?.status})`);
  const resMicsWrong = String(doneMicsWrong?.result ?? "");
  must(
    /Node type says Micrographs but the sampled headers say FRAME STACKS/i.test(resMicsWrong),
    `the Micrographs-on-stacks mismatch note rides the receipt: ${resMicsWrong.slice(0, 200)}`
  );

  // D3: node type Particles — a cluster-side particles STAR imports and
  // feeds Class2D's command preview
  const importParts = await mkJob({
    projectId,
    type: "import",
    name: "QA t315 particles import",
    params: { micrographsPath: "/data2/qa-t315-particles/particles.star", nodeType: "particles" },
  });
  must(!!importParts?.id, "the particles import creates");
  const runParts = await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runParts.status >= 200 && runParts.status < 300, `the particles import run accepts (${runParts.status})`);
  const doneParts = await pollUntil(async () => {
    const j = await jobById(importParts.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneParts?.status === "completed", `the particles import completes (${doneParts?.status})`);
  const resParts = String(doneParts?.result ?? "");
  must(/24 particles imported/.test(resParts), `the receipt counts particles: ${resParts.slice(0, 160)}`);
  must(/image refs kept verbatim/i.test(resParts), "the receipt says the cluster-absolute refs stayed verbatim");

  const class2d = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t315 class2d",
    params: {},
  });
  must(!!class2d?.id, "the class2d job creates");
  must((await mkEdge(importParts.id, class2d.id, "particles", "particles")) < 300, "the particles edge wires");
  // dispatch it to the CLUSTER: a completion there proves resolveInputs
  // found the import's particles_star (a miss would have parked the row
  // in pending/waiting instead) — and the submitted script carries the
  // --i particles.star contract verbatim
  const dispatch2d = await api(`/api/jobs/${class2d.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatch2d.status >= 200 && dispatch2d.status < 300, `the class2d dispatch accepts (${dispatch2d.status})`);
  must(
    !dispatch2d.body?.waiting || dispatch2d.body?.waiting === "not-ready",
    `the class2d inputs RESOLVED (staging "not-ready" is fine — a miss is not): waiting=${String(dispatch2d.body?.waiting)} ${String(dispatch2d.body?.error ?? "").slice(0, 120)}`
  );
  const done2d = await pollUntil(async () => {
    const j = await jobById(class2d.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  if (done2d?.status !== "completed") {
    console.log(
      "  DEBUG staged star:",
      client(`cat /projects/cryoflow/${projectId}/import_${importParts.id.slice(-8)}/particles.star 2>/dev/null | head -6`)
    );
    console.log(
      "  DEBUG fixture stack:",
      client("ls -la /data2/qa-t315-particles/ 2>/dev/null")
    );
    console.log(
      "  DEBUG class2d run.err:",
      client(`cat /projects/cryoflow/${projectId}/class2d_${class2d.id.slice(-8)}/run.err 2>/dev/null | head -3`)
    );
  }
  must(done2d?.status === "completed", `the class2d consumes the imported particles (${done2d?.status}: ${String(done2d?.result ?? "").slice(0, 140)})`);
  const run2d = client(`cat /projects/cryoflow/${projectId}/class2d_${class2d.id.slice(-8)}/.cf-run.sh 2>/dev/null`);
  must(
    /--i [^\s]*particles\.star/.test(run2d),
    `the submitted script carries the particles star: ${(run2d.split("\n").find((l) => l.includes("--i")) || "").slice(0, 160)}`
  );

  // D4: the wrong dialect — a micrographs star under the particles node type
  const importWrong = await mkJob({
    projectId,
    type: "import",
    name: "QA t315 wrong dialect",
    params: { micrographsPath: "/data2/qa-t315-micstar.star", nodeType: "particles" },
  });
  must(!!importWrong?.id, "the wrong-dialect import creates");
  const runWrong = await api(`/api/jobs/${importWrong.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runWrong.status >= 200 && runWrong.status < 300, `the wrong-dialect run route answers (${runWrong.status})`);
  must(
    /describes MICROGRAPHS/i.test(String(runWrong.body?.error ?? "")),
    `the wrong dialect is refused with the switch instruction: ${String(runWrong.body?.error ?? "").slice(0, 160)}`
  );

  // ======================================================================
  console.log("== PHASE E: THE RANDOM-5 GALLERY — cluster-resident previews ==");
  const manifest = await api(`/api/jobs/${importA.id}/micrographs`, { headers: SH });
  must(manifest.status === 200, `the manifest answers (${manifest.status})`);
  const mb = manifest.body;
  must(!!mb?.cluster, "the manifest carries the cluster strip");
  must(mb?.cluster?.host === "127.0.0.1", `the strip names the host (${mb?.cluster?.host})`);
  must(mb?.total === 20, `the manifest carries the FULL count (${mb?.total})`);
  must(mb?.micrographs?.length === 5, `exactly five samples ride the manifest (${mb?.micrographs?.length})`);
  const starText = readFileSync(
    `${ROOT}/data/relion/${projectId}/import_${importA.id.slice(-8)}/micrographs.star`,
    "utf8"
  );
  must(
    (mb?.micrographs ?? []).every((m) => starText.includes(m.path)),
    "every sampled path is a row of this job's own star"
  );

  // the preview door: thumb + full are REAL PNGs
  const samplePath = mb?.micrographs?.[0]?.path;
  const thumb = await apiRaw(
    `/api/jobs/${importA.id}/micrographs?preview=${encodeURIComponent(samplePath)}`,
    { headers: SH }
  );
  must(thumb.status === 200, `the preview door answers (${thumb.status})`);
  must(
    thumb.bytes.length > 100 && thumb.bytes[0] === 0x89 && thumb.bytes[1] === 0x50,
    `the preview is a real PNG (${thumb.bytes.length} bytes)`
  );
  const full = await apiRaw(
    `/api/jobs/${importA.id}/micrographs?preview=${encodeURIComponent(samplePath)}&full=1`,
    { headers: SH }
  );
  must(full.status === 200 && full.bytes[0] === 0x89, `the full-scale preview renders (${full.status})`);
  must(full.bytes.length >= thumb.bytes.length, "the full render is at least as large as the thumb");

  // the door refuses paths that are not this job's rows
  const intruder = await api(
    `/api/jobs/${importA.id}/micrographs?preview=${encodeURIComponent("/data2/qa-t315-particles/stack24.mrcs")}`,
    { headers: SH }
  );
  must(intruder.status === 404, `an intruder path is refused (${intruder.status})`);

  // the sampling: deterministic per (job, reroll) — the preview cache's
  // own doctrine (the old Math.random re-roll is gone). Two fetches with
  // DIFFERENT reroll seeds sample differently (the re-sample button's
  // exact contract); the same seed would return the same five by design.
  const manifest2 = await api(`/api/jobs/${importA.id}/micrographs?reroll=1`, { headers: SH });
  const set1 = (mb?.micrographs ?? []).map((m) => m.path).sort().join("|");
  const set2 = (manifest2.body?.micrographs ?? []).map((m) => m.path).sort().join("|");
  must(set1 !== set2, "two manifest fetches sample five different micrographs");

  // ======================================================================
  console.log("== PHASE F: cleanup ==");
  for (const jid of createdJobs) {
    await api(`/api/jobs/${jid}`, { method: "DELETE", headers: SHJ }).catch(() => null);
  }
  await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SHJ }).catch(() => null);
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => null);
  cleanRemoteTree(projectId);
  const residue = client("ls /projects/cryoflow/ 2>/dev/null").split("\n").filter((l) => l.includes("qa-"));
  must(residue.length === 0, `the cluster tree burns clean (${residue.join(", ")})`);
  const localResidue = `${ROOT}/data/relion/${projectId}`;
  if (existsSync(localResidue)) rmSync(localResidue, { recursive: true, force: true });
  const previewResidue = `${ROOT}/data/remote-preview`;
  if (existsSync(previewResidue)) rmSync(previewResidue, { recursive: true, force: true });
  must(true, "local mirrors + preview cache burned");
} catch (err) {
  fail++;
  console.error("SUITE ERROR:", err);
}

console.log(fail === 0 ? "\nALL GREEN" : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);

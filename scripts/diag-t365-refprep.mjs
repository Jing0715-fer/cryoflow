/**
 * DIAG t365 — the reference-sampling pre-flight (方案 A, automated).
 *
 * The user's ticket: the first 3D classification on the cluster died at
 * MlModel::initialiseFromImages — "The reference pixel size is 0.808
 * A/px, but the pixel size of the first optics group of the data is
 * 3.232 A/px! / The reference box size is 256 px, but … 100 px!" — an
 * imported full-resolution map meeting 4×-binned particles. The fix
 * (方案 A, the user's own remedy, made automatic): the dispatch reads
 * the reference's MRC header and the star's first optics group IN PLACE
 * on the cluster, and on a mismatch prepares a sampling-matched copy ON
 * the cluster (relion_image_handler --scale → --new_box, verified by the
 * product's own header) and points --ref there.
 *
 * This suite walks the whole shape against the mock cluster (:3022):
 *
 *   PHASE 2 — the happy lane: a 16³ @ 0.808 Å map (the imported full-res
 *     reference) + particles whose optics group says 3.232 Å / 8 px →
 *     the class3d dispatch auto-prepares 8³ @ 3.232 ON the cluster, the
 *     receipt rides run.out, --ref points at the prepared copy, the
 *     original twin is byte-identical to the fixture, and the only wire
 *     traffic the twin sees is the 1 KB header probe / image_handler /
 *     hygiene (zero map bytes);
 *   PHASE 3 — the match lane: a reference already at 3.232 / 8 verifies
 *     in place, nothing is prepared;
 *   PHASE 4 — the honest lanes: an optics-less star skips with a note
 *     (RELION's own check decides), --ref_angpix in the extra args
 *     hands the wheel to the user, and a DELETED twin refuses the
 *     dispatch by name before the queue ever hears about it.
 *
 * The mock cluster (:3022) and the dev server (:3001) must both be up.
 * CF_ROOT / CF_BASE override the defaults.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3001";
const CONN = "qa-t365";

let fail = 0;
const must = (cond, label, extra) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fail++;
};
const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 60_000,
  }).stdout?.trim() ?? "";
const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  const body = await r.json().catch(() => null);
  return { status: r.status, body, text: body === null ? await r.text().catch(() => "") : JSON.stringify(body) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const awaitTerminal = async (id, deadlineMs) => {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    const { body } = await api("/api/jobs", { headers: SH });
    const j = (body?.jobs ?? []).find((x) => x.id === id);
    if (j && j.status !== "running" && j.status !== "pending") return j;
    await sleep(600);
  }
  return null;
};
const auditText = () => {
  try {
    return readFileSync(path.join(ROOT, "services/mock-cluster/fs/home/cryo/.slurm/exec-audit.log"), "utf8");
  } catch {
    return "";
  }
};
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };

/* ---- fixtures: REAL MRC volumes (the pre-flight parses true headers) --- */
function mrcVolume(n, angpix) {
  const bpp = 4; // mode 2 = float32
  const buf = Buffer.alloc(1024 + n * n * n * bpp);
  buf.writeInt32LE(n, 0); buf.writeInt32LE(n, 4); buf.writeInt32LE(n, 8);
  buf.writeInt32LE(2, 12);
  buf.writeFloatLE(angpix * n, 40); buf.writeFloatLE(angpix * n, 44); buf.writeFloatLE(angpix * n, 48);
  buf.writeFloatLE(-1, 76); buf.writeFloatLE(1, 80); buf.writeFloatLE(0, 84);
  buf.writeFloatLE(0.5, 216);
  buf.write("MAP ", 208, "ascii");
  for (let i = 0; i < n * n * n; i++) buf.writeFloatLE((i % 97) / 97, 1024 + i * bpp);
  return buf;
}
// the ticket's shape in miniature: 16³ @ 0.808 (the imported full-res map)
// vs particles binned 4× (3.232 Å, 8 px boxes) — scale 4 lands 4³, the
// new_box pass pads to 8³ @ 3.232 (cella 25.856)
const FULLRES = mrcVolume(16, 0.808);
const MATCHED = mrcVolume(8, 3.232);
const FULLRES_B64 = FULLRES.toString("base64");
const MATCHED_B64 = MATCHED.toString("base64");

// header-only .mrcs stack (8×8×12): the census sniffs 16 header bytes,
// the stub audits existence — the t363 fixture shape
const STACK_B64 = (() => {
  const d = Buffer.alloc(1024);
  d.writeInt32LE(8, 0); d.writeInt32LE(8, 4); d.writeInt32LE(12, 8); d.writeInt32LE(2, 12);
  return d.toString("base64");
})();

const FIX = {
  refDir: "/data2/t365/ref",
  fullres: "/data2/t365/ref/fullres_map.mrc",
  matched: "/data2/t365/ref/matched_map.mrc",
  starDir: "/data2/t365/particles",
  star: "/data2/t365/particles/particles.star",
  starNoOptics: "/data2/t365/particles/no_optics.star",
  stack: "/data2/t365/particles/stack.mrcs",
};
const STAR_ROWS = (starPath) =>
  `for i in $(seq 1 6); do printf '%d@${FIX.stack} 1 %d\\n' $i $((i * 15)) >> ${starPath}; done`;
const STAR_HEAD = (starPath) =>
  `printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 3.232 8\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > ${starPath}`;

let projectId = null;
const jobIds = [];
const mkJob = async (body) => {
  const r = await api("/api/jobs", { method: "POST", headers: SHJ, body: JSON.stringify(body) });
  const job = r.body?.job;
  if (job?.id) jobIds.push(job.id);
  return { job, resp: r };
};
const runJob = (id, remote) =>
  api(`/api/jobs/${id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify(remote ? { remote } : {}) });
const errTextOf = (post, job) =>
  `${String(post?.body?.error ?? post?.body?.message ?? "")} ${String(job?.result ?? job?.error ?? "")}`;
const dispatchRemote = (id) =>
  runJob(id, { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 });
const wireEdge = async (fromJobId, fromPort, toJobId, toPort) => {
  const e = await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
  });
  must(e.status === 200 || e.status === 201, `the edge ${fromPort}→${toPort} wires (${e.status})`);
};
// the job's own workdir, straight from the run record — deterministic per
// job id (dir-name sorting is not chronological: the id suffix is random)
const workdirOf = (jobId) => {
  try {
    return JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[jobId]?.workdir ?? null;
  } catch {
    return null;
  }
};
const remoteWorkdirOf = (jobId) => {
  const wd = workdirOf(jobId);
  return wd ? `/projects/cryoflow/${projectId}/${path.basename(wd)}` : null;
};
const parseClusterHeader = (b64) => {
  const b = Buffer.from(b64.replace(/\s+/g, ""), "base64");
  if (b.length < 52) return null;
  return {
    nx: b.readInt32LE(0), ny: b.readInt32LE(4), nz: b.readInt32LE(8),
    cella: [b.readFloatLE(40), b.readFloatLE(44), b.readFloatLE(48)],
  };
};
const clusterHeader = (p) => parseClusterHeader(client(`head -c 1024 ${p} 2>/dev/null | base64 -w0`));

try {
  console.log("== PHASE 0: the stage ==");
  const mockUp = await new Promise((resolve) => {
    const s = new net.Socket();
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(1200);
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
    s.connect(3022, "127.0.0.1");
  });
  must(mockUp, "the mock cluster answers on :3022");
  must((await api("/api/jobs", { headers: SH })).status === 200, `the dev server answers on ${BASE}`);
  if (fail > 0) throw new Error("stage not ready");

  console.log("== PHASE 1: connection + project + fixtures + the imports ==");
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  const mkConn = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t365", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t365 refprep", mode: "remote", remoteConnectionId: CONN }),
  });
  projectId = proj.body?.project?.id;
  must(!!projectId, `the remote project creates (${proj.status})`);

  const fx = client(
    `mkdir -p ${FIX.refDir} ${FIX.starDir}; ` +
    `echo ${FULLRES_B64} | base64 -d > ${FIX.fullres}; chmod 444 ${FIX.fullres}; ` +
    `echo ${MATCHED_B64} | base64 -d > ${FIX.matched}; ` +
    `echo ${STACK_B64} | base64 -d > ${FIX.stack}; ` +
    STAR_HEAD(FIX.star) + "; " + STAR_ROWS(FIX.star) + "; " +
    `printf 'data_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnAngleRot #2\\n' > ${FIX.starNoOptics}; ` + STAR_ROWS(FIX.starNoOptics)
  );
  must(fx === "", `the fixtures build quietly (${fx.slice(0, 140)})`);
  client("rm -f ~/.slurm/exec-audit.log");

  const { job: impMap1 } = await mkJob({
    projectId, type: "mapimport", name: "QA t365 fullres map",
    params: { mapPath: FIX.fullres },
  });
  must(!!impMap1?.id, "the fullres mapimport creates");
  const impMap1Run = await runJob(impMap1.id);
  must(impMap1Run.status === 200, `the fullres mapimport accepts (${impMap1Run.status})`);
  must((await awaitTerminal(impMap1.id, 60_000))?.status === "completed", "the fullres mapimport completes");

  const { job: impParts } = await mkJob({
    projectId, type: "import", name: "QA t365 particles import",
    params: { micrographsPath: FIX.star, nodeType: "particles" },
  });
  must(!!impParts?.id, "the particles import creates");
  const impPartsRun = await runJob(impParts.id);
  must(impPartsRun.status === 200, `the particles import accepts (${impPartsRun.status})`);
  must((await awaitTerminal(impParts.id, 60_000))?.status === "completed", "the particles import completes");

  console.log("== PHASE 2: the mismatch auto-prepares ON the cluster (方案 A) ==");
  const { job: cls1 } = await mkJob({
    projectId, type: "class3d", name: "QA t365 class3d mismatch",
    params: { iterations: 5, numClasses: 2, particleDiameter: 20 },
  });
  must(!!cls1?.id, "the mismatched class3d creates");
  await wireEdge(impParts.id, "particles", cls1.id, "particles");
  await wireEdge(impMap1.id, "model_mrc", cls1.id, "reference");
  const d1 = await dispatchRemote(cls1.id);
  must(d1.status === 200 && !d1.body?.error, `the mismatched dispatch is ACCEPTED (${d1.status}: ${String(d1.body?.error ?? "").slice(0, 120)})`);
  const done1 = await awaitTerminal(cls1.id, 120_000);
  must(done1?.status === "completed", `the mismatched class3d completes (${done1?.status}: ${String(done1?.result ?? "").slice(0, 140)})`);

  const wd1 = remoteWorkdirOf(cls1.id);
  must(!!wd1, `T0 the class3d workdir resolves (${workdirOf(cls1.id)})`);
  const prepared = `${wd1}/fullres_map_cf_8box_3p232.mrc`;
  const runOut1 = client(`cat ${wd1}/run.out 2>/dev/null`);
  must(/CRYOFLOW_NOTE: .*reference auto-prepared ON the cluster \(t365\)/.test(runOut1), "T1a run.out carries the auto-prepared receipt");
  must(/the imported map was 16³ @ 0\.8080 Å\/px vs the particles' 8 px @ 3\.232 Å\/px/.test(runOut1), `T1b the receipt names both samplings (${runOut1.split("\n").find((l) => l.includes("t365"))?.slice(0, 160)})`);
  must(/verified 8³ @ 3\.2320 Å\/px by its own header/.test(runOut1), "T1c the receipt swears by the product's own header");
  must(/zero map bytes crossed the wire/.test(runOut1), "T1d the receipt speaks the zero-transit law");

  const prepStat = client(`stat -c '%s' ${prepared} 2>/dev/null`);
  must(prepStat.trim() === "3072", `T2 the prepared map EXISTS on the cluster (${prepared.slice(-46)}: ${prepStat.trim() || "missing"} bytes)`);
  const ph = clusterHeader(prepared);
  must(
    ph != null && ph.nx === 8 && ph.ny === 8 && ph.nz === 8 && Math.abs(ph.cella[0] / 8 - 3.232) < 0.001,
    `T3 the prepared map's header is 8³ @ 3.232 Å/px (got ${ph ? `${ph.nx}×${ph.ny}×${ph.nz} cella ${ph.cella[0].toFixed(3)}` : "nothing"})`
  );

  const sbatch = client(`cat ${wd1}/.cf-sbatch.sh 2>/dev/null`);
  must(sbatch.includes(prepared), "T4 the sbatch argv's --ref points at the prepared copy");
  must(!new RegExp(`--ref '?${FIX.fullres}`).test(sbatch), "T4b the original full-res path is NOT the job's --ref");

  const audit = auditText();
  const twin = `${remoteWorkdirOf(impMap1.id)}/fullres_map.mrc`;
  const twinLines = audit.split("\n").filter((l) => l.includes(twin));
  must(
    twinLines.length > 0 &&
      twinLines.every((l) => /head -c 1024|stat -c|relion_image_handler|rm -f|mv -f|cp -f/.test(l)),
    `T5 ZERO TRANSIT: every twin-touching wire line is a probe or cluster-internal step (${twinLines.length} line(s))`
  );
  const twinB64 = client(`base64 -w0 ${twin} 2>/dev/null`).replace(/\s+/g, "");
  must(twinB64 === FULLRES_B64, `T6 the original twin is byte-identical to the fixture (${twinB64.length} vs ${FULLRES_B64.length} b64 chars)`);

  console.log("== PHASE 3: the match lane verifies IN PLACE ==");
  const { job: impMap2 } = await mkJob({
    projectId, type: "mapimport", name: "QA t365 matched map",
    params: { mapPath: FIX.matched },
  });
  const impMap2Run = await runJob(impMap2.id);
  must(impMap2Run.status === 200, `the matched mapimport accepts (${impMap2Run.status})`);
  must((await awaitTerminal(impMap2.id, 60_000))?.status === "completed", "the matched mapimport completes");
  const { job: cls2 } = await mkJob({
    projectId, type: "class3d", name: "QA t365 class3d matched",
    params: { iterations: 5, numClasses: 2, particleDiameter: 20 },
  });
  await wireEdge(impParts.id, "particles", cls2.id, "particles");
  await wireEdge(impMap2.id, "model_mrc", cls2.id, "reference");
  const d2 = await dispatchRemote(cls2.id);
  must(d2.status === 200, `the matched dispatch accepts (${d2.status})`);
  const done2 = await awaitTerminal(cls2.id, 120_000);
  must(done2?.status === "completed", `the matched class3d completes (${done2?.status})`);
  const wd2 = remoteWorkdirOf(cls2.id);
  must(!!wd2, "T0b the matched class3d workdir resolves");
  const runOut2 = client(`cat ${wd2}/run.out 2>/dev/null`);
  must(/reference verified in place — 8³ @ 3\.2320 Å\/px matches the particles' first optics group \(t365\)/.test(runOut2), `T7a the matched lane verifies in place (${runOut2.split("\n").find((l) => l.includes("t365"))?.slice(0, 140)})`);
  const prep2 = client(`ls ${wd2} 2>/dev/null | grep '_cf_' || true`);
  must(prep2 === "", `T7b nothing was prepared in the matched workdir (${prep2})`);

  console.log("== PHASE 4: the honest lanes (skip notes + the named refusal) ==");
  // N1 — a star with no data_optics: the pre-flight cannot judge → note, never a block
  const { job: impNoOpt } = await mkJob({
    projectId, type: "import", name: "QA t365 optics-less import",
    params: { micrographsPath: FIX.starNoOptics, nodeType: "particles" },
  });
  const impNoOptRun = await runJob(impNoOpt.id);
  must(impNoOptRun.status === 200, `the optics-less import accepts (${impNoOptRun.status})`);
  must((await awaitTerminal(impNoOpt.id, 60_000))?.status === "completed", "the optics-less import completes");
  const { job: cls3 } = await mkJob({
    projectId, type: "class3d", name: "QA t365 class3d optics-less",
    params: { iterations: 5, numClasses: 2, particleDiameter: 20 },
  });
  await wireEdge(impNoOpt.id, "particles", cls3.id, "particles");
  await wireEdge(impMap1.id, "model_mrc", cls3.id, "reference");
  const d3 = await dispatchRemote(cls3.id);
  must(d3.status === 200, `the optics-less dispatch accepts (${d3.status})`);
  const done3 = await awaitTerminal(cls3.id, 120_000);
  must(done3?.status === "completed", `N1 the optics-less class3d still completes — a note, never a block (${done3?.status})`);
  const wd3 = remoteWorkdirOf(cls3.id);
  const runOut3 = client(`cat ${wd3}/run.out 2>/dev/null`);
  must(/pre-flight did not run \(no _rlnImagePixelSize\/_rlnImageSize in the first optics group/.test(runOut3), `N1a the note names the missing optics (${runOut3.split("\n").find((l) => l.includes("t365"))?.slice(0, 140)})`);

  // N2 — the user drives: --ref_angpix in the extra args skips the pre-flight
  const { job: cls4 } = await mkJob({
    projectId, type: "class3d", name: "QA t365 class3d user-drives",
    params: { iterations: 5, numClasses: 2, particleDiameter: 20, extraArgs: "--ref_angpix 3.232" },
  });
  await wireEdge(impParts.id, "particles", cls4.id, "particles");
  await wireEdge(impMap1.id, "model_mrc", cls4.id, "reference");
  const d4 = await dispatchRemote(cls4.id);
  must(d4.status === 200, `the user-drives dispatch accepts (${d4.status})`);
  const done4 = await awaitTerminal(cls4.id, 120_000);
  must(done4?.status === "completed", `N2 the user-drives class3d completes (${done4?.status})`);
  const wd4 = remoteWorkdirOf(cls4.id);
  const runOut4 = client(`cat ${wd4}/run.out 2>/dev/null`);
  must(/pre-flight skipped — the extra args carry --trust_ref_size\/--ref_angpix/.test(runOut4), `N2a the note hands the wheel to the user (${runOut4.split("\n").find((l) => l.includes("t365"))?.slice(0, 140)})`);

  // N3 — a deleted twin: the certain death, refused by name before submit
  const { job: cls5 } = await mkJob({
    projectId, type: "class3d", name: "QA t365 class3d twin-gone",
    params: { iterations: 5, numClasses: 2, particleDiameter: 20 },
  });
  await wireEdge(impParts.id, "particles", cls5.id, "particles");
  await wireEdge(impMap1.id, "model_mrc", cls5.id, "reference");
  client(`rm -f ${twin}`);
  const d5 = await dispatchRemote(cls5.id);
  const done5 = await awaitTerminal(cls5.id, 90_000);
  must(done5?.status === "failed", `N3 the twin-gone dispatch FAILS honestly (${done5?.status})`);
  must(
    /the reference map is not readable on 127\.0\.0\.1 at .*fullres_map\.mrc/.test(errTextOf(d5, done5)),
    `N3a the refusal names the unreadable reference (${errTextOf(d5, done5).slice(0, 160)})`
  );
} catch (e) {
  console.error("DIAG aborted:", e);
  must(false, "the diag ran to completion", String(e?.stack ?? e));
} finally {
  console.log("== CLEANUP ==");
  for (const id of jobIds) await api(`/api/jobs/${id}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  if (projectId) {
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SHJ }).catch(() => {});
    client(`rm -rf /projects/cryoflow/${projectId}`);
  }
  client(`rm -rf /data2/t365`);
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  console.log("  cleaned: jobs, project (+cluster workdirs), the t365 fixture tree, connection");
}

const ok = fail === 0;
console.log(`\nDIAG t365 reference pre-flight: ${ok ? "ALL GREEN" : `${fail} FAILURES`}`);
process.exit(ok ? 0 : 1);

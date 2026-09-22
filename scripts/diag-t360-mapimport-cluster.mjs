/**
 * DIAG t360 — the CLUSTER-SIDE map import (the user's ticket: import map on
 * a remote project pointed at /data03/…/cryosparc_P48_J999_004_volume_map.mrc
 * and died "Map file not accessible" — the engine's existsSync only ever
 * looked at the app's own disk, and the user's own diagnosis was right:
 * 「这个目录应该没有写入权限，但是有读取权限啊，理论上可以copy到cryoflow的
 * 工作目录下」. The fix runs exactly that copy ON the cluster. This suite
 * walks the whole shape against the mock cluster (:3022):
 *
 *   PHASE 2 — the happy lane: a read-only (chmod 444) source map imported
 *     cluster-side, byte-verified, twin-registered, manifest-written, with
 *     ZERO map bytes over the wire (the exec audit proves it: the only
 *     /data03 traffic is the 1 KB header probe and the cp itself);
 *   PHASE 3 — the sub-volume-crop shape: a LOCAL mapPath on the same remote
 *     project keeps the local lane (nothing regresses);
 *   PHASE 4 — the honest failures: missing path, directory, no-read-
 *     permission source, .mrcs extension, junk header — each answers with
 *     its own verdict, and the user's「是权限问题？」gets a YES/NO answer.
 *
 * The mock cluster (:3022) and the dev server (:3001) must both be up.
 * CF_ROOT / CF_BASE override the defaults.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3001";
const CONN = "qa-t360";
// the mock cluster's writable virtual mounts are data2/home/opt/projects —
// /data03 (the ticket's literal mount) is not among them, so the fixture
// rides /data2: same semantics (a cluster path outside cryoflow's root),
// a mount the mock actually maps
const SRC_DIR = "/data2/Lijing/test/P48/J999";
const SRC = `${SRC_DIR}/cryosparc_P48_J999_004_volume_map.mrc`;
const MAP_NAME = "cryosparc_P48_J999_004_volume_map.mrc";

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

/* ---- the MRC fixture builder: a real 16³ float32 volume, pixel 4.0 Å --- */
function mrcBuffer(nx, ny, nz) {
  const bpp = 4; // mode 2
  const buf = Buffer.alloc(1024 + nx * ny * nz * bpp);
  buf.writeInt32LE(nx, 0); buf.writeInt32LE(ny, 4); buf.writeInt32LE(nz, 8);
  buf.writeInt32LE(2, 12); // mode 2 = float32
  buf.writeFloatLE(4.0 * nx, 40); buf.writeFloatLE(4.0 * ny, 44); buf.writeFloatLE(4.0 * nz, 48);
  buf.writeFloatLE(-1, 76); buf.writeFloatLE(1, 80); buf.writeFloatLE(0, 84);
  buf.writeFloatLE(0.5, 216);
  buf.write("MAP ", 208, "ascii");
  for (let i = 0; i < nx * ny * nz; i++) buf.writeFloatLE(i / (nx * ny * nz), 1024 + i * bpp);
  return buf;
}
const MAP = mrcBuffer(16, 16, 16); // 1024 + 16384 = 17408 bytes
const MAP_B64 = MAP.toString("base64");

let projectId = null;
const jobIds = [];
const mkJob = async (name, params) => {
  const r = await api("/api/jobs", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ projectId, type: "mapimport", x: 60, y: 60, name, params }),
  });
  const id = r.body?.job?.id;
  if (id) jobIds.push(id);
  return { id, resp: r };
};
const runJob = (id) => api(`/api/jobs/${id}/run`, { method: "POST", headers: SHJ, body: "{}" });
const errTextOf = (post, job) =>
  `${String(post?.body?.error ?? post?.body?.message ?? "")} ${String(job?.result ?? job?.error ?? "")}`;

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

  console.log("== PHASE 1: connection + remote project + the P48/J999 fixture ==");
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  const mkConn = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t360", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t360 mapimport cluster-side", mode: "remote", remoteConnectionId: CONN }),
  });
  projectId = proj.body?.project?.id;
  must(!!projectId, `the remote project creates (${proj.status})`);

  // the source map: the ticket's directory shape (a read-only 444 source —
  // write permission absent, read present), then a FRESH exec audit so the
  // zero-transit assertions below judge the RUN's wire traffic alone
  const fx = client(
    `mkdir -p ${SRC_DIR}; echo ${MAP_B64} | base64 -d > ${SRC}; chmod 444 ${SRC}; ` +
    `stat -c '%s %A' ${SRC}`
  );
  must(/17408\s+-r--r--r--/.test(fx), `the read-only source map builds (${fx.replace(/\n/g, " ")})`);
  client("rm -f ~/.slurm/exec-audit.log");

  console.log("== PHASE 2: the import copies the map ON the cluster ==");
  const { id: jobId } = await mkJob("Import map (t360)", { mapPath: SRC });
  must(!!jobId, "the mapimport job creates");
  const run1 = await runJob(jobId);
  must(run1.status === 200, `the run accepts (${run1.status}: ${String(run1.body?.error ?? "").slice(0, 120)})`);
  const done1 = await awaitTerminal(jobId, 90_000);
  const result = String(done1?.result ?? "");
  must(done1?.status === "completed", `the import completes (${done1?.status}: ${result.slice(0, 160)})`);
  must(/REMOTE\[cryo@127\.0\.0\.1\]: Map imported: cryosparc_P48_J999_004_volume_map\.mrc/.test(result), "T1a the receipt leads with the cluster lane + the map's own name");
  must(/\(16×16×16 vox · pixel 4\.00 Å/.test(result), `T1b the receipt speaks dims + pixel off the probed header (${result.slice(0, 120)})`);
  must(/copied ON the cluster, zero bytes over the connection/.test(result), "T1c the receipt says the copy ran on the cluster");

  const workdir = `${ROOT}/data/relion/${projectId}`;
  const jobDir = readdirSync(workdir).find((d) => d.startsWith("mapimport_"));
  must(!!jobDir, "T2a the mapimport workdir exists");
  const runOut = readFileSync(`${workdir}/${jobDir}/run.out`, "utf8");
  must(/map import \(cluster lane\)/.test(runOut), "T2b run.out speaks the cluster lane");
  must(/cluster-side cp → /.test(runOut), "T2c run.out names the cluster-side copy");
  must(/verified 17,408 bytes/.test(runOut), "T2d run.out carries the byte-verified size");

  must(!existsSync(`${workdir}/${jobDir}/${MAP_NAME}`), "T3 ZERO DOWNLOAD: the map bytes never landed in the local workdir");

  // the wire-traffic proof, read BEFORE this phase's own verification calls
  const audit1 = auditText();
  const srcLines = audit1.split("\n").filter((l) => l.includes(SRC_DIR));
  must(
    srcLines.length > 0 && srcLines.every((l) => l.includes("head -c 1024") || l.includes("cp -f --")),
    `T4 ZERO TRANSIT: every ${SRC_DIR} command on the wire is the 1 KB header probe or the cp itself (${srcLines.length} line(s))`
  );
  must(/cp -f --/.test(audit1), "T4b the cluster-side cp is on the wire (the mock's own disk did the copy)");

  const twinPath = `/projects/cryoflow/${projectId}/${jobDir}/${MAP_NAME}`;
  const twinStat = client(`stat -c '%s' ${twinPath} 2>/dev/null`);
  must(twinStat.trim() === "17408", `T5a the twin EXISTS on the cluster at the mirror address (stat: "${twinStat.trim()}")`);
  const rec = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[jobId] ?? null;
  must(String(rec?.outputs?.model_mrc ?? "").endsWith(path.join(jobDir, MAP_NAME)), `T5b the record's output speaks the local mirror path (${rec?.outputs?.model_mrc})`);
  must(rec?.remote?.remoteOutputs?.model_mrc === twinPath, `T5c the record carries the verified twin (${rec?.remote?.remoteOutputs?.model_mrc})`);
  must(rec?.remote?.mode === "direct", `T5d mode direct — the twin is a fact on disk, not a live session (${rec?.remote?.mode})`);
  must(rec?.remote?.connectionId === CONN, `T5e the twin is bound to THIS connection (${rec?.remote?.connectionId})`);

  const twinB64 = client(`base64 -w0 ${twinPath} 2>/dev/null`).replace(/\s+/g, "");
  must(twinB64 === MAP_B64, `T6 BYTE-IDENTITY: the twin === the source fixture (${twinB64.length} vs ${MAP_B64.length} b64 chars)`);

  const srcAfter = client(`stat -c '%s %A' ${SRC}`);
  must(/17408\s+-r--r--r--/.test(srcAfter), `T7 the read-only source is untouched (${srcAfter.replace(/\n/g, " ")})`);

  const manifestPath = `${workdir}/${jobDir}/.cf-remote-manifest.json`;
  must(existsSync(manifestPath), "T8a the remote manifest lets the Files tab list the map");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  must(
    manifest?.files?.some((f) => f.path === MAP_NAME && f.size === 17408) &&
      manifest?.remoteWorkdir === twinPath.slice(0, twinPath.lastIndexOf("/")) &&
      manifest?.connectionId === CONN,
    "T8b the manifest names the twin dir + the verified size + the connection"
  );
  const outputs = await api(`/api/jobs/${jobId}/outputs`, { headers: SH });
  must(outputs.status === 200 && (outputs.text ?? "").includes(MAP_NAME), `T9 the outputs view lists the on-cluster map card (${outputs.status})`);

  console.log("== PHASE 3: the sub-volume-crop shape keeps the LOCAL lane ==");
  // a LOCAL mapPath on the same remote project (the crop flow writes one
  // into the parent job's workdir) — must NOT take the cluster lane
  const cropDir = `${workdir}/cropparent_00000001/SubVolumes`;
  mkdirSync(cropDir, { recursive: true });
  writeFileSync(`${cropDir}/crop_test.mrc`, MAP);
  chmodSync(`${cropDir}/crop_test.mrc`, 0o644);
  const { id: cropJobId } = await mkJob("Sub-volume crop (t360)", { mapPath: `${cropDir}/crop_test.mrc` });
  must(!!cropJobId, "the crop-shaped mapimport creates");
  const run2 = await runJob(cropJobId);
  must(run2.status === 200, `the crop-shaped run accepts (${run2.status})`);
  const done2 = await awaitTerminal(cropJobId, 60_000);
  const result2 = String(done2?.result ?? "");
  must(done2?.status === "completed", `the crop-shaped import completes (${done2?.status}: ${result2.slice(0, 140)})`);
  must(!/REMOTE\[/.test(result2) && /Map imported: crop_test\.mrc/.test(result2), `T10a the LOCAL lane ran (no REMOTE receipt) (${result2.slice(0, 100)})`);
  const cropJobDir = readdirSync(workdir).filter((d) => d.startsWith("mapimport_") && d !== jobDir).pop();
  must(!!cropJobDir && existsSync(`${workdir}/${cropJobDir}/crop_test.mrc`), "T10b the local lane materialized the map into its own workdir");
  const rec2 = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[cropJobId] ?? null;
  must(!rec2?.remote?.remoteOutputs?.model_mrc, `T10c no twin registration on the local lane — staging uploads it downstream, as before (${rec2?.remote?.remoteOutputs?.model_mrc})`);

  console.log("== PHASE 4: the honest failures (「是权限问题？」— each answers itself) ==");
  // N1 — no READ permission
  client(`echo ${MAP_B64} | base64 -d > ${SRC_DIR}/secret_map.mrc; chmod 000 ${SRC_DIR}/secret_map.mrc`);
  const n1 = await mkJob("N1 noread (t360)", { mapPath: `${SRC_DIR}/secret_map.mrc` });
  const n1run = await runJob(n1.id);
  const n1job = await awaitTerminal(n1.id, 60_000);
  must(n1job?.status === "failed", `N1 the no-read import fails honestly (${n1job?.status})`);
  must(/no READ permission on/.test(errTextOf(n1run, n1job)), `N1a the verdict names the permission (${errTextOf(n1run, n1job).slice(0, 160)})`);
  must(/read is all the import needs/.test(errTextOf(n1run, n1job)), "N1b the verdict explains read suffices for the copy");

  // N2 — missing path
  const n2 = await mkJob("N2 missing (t360)", { mapPath: `${SRC_DIR}/never_created_map.mrc` });
  const n2run = await runJob(n2.id);
  const n2job = await awaitTerminal(n2.id, 60_000);
  must(n2job?.status === "failed", `N2 the missing-path import fails (${n2job?.status})`);
  must(/does not exist on 127\.0\.0\.1/.test(errTextOf(n2run, n2job)), `N2a the verdict says the map does not exist on the cluster (${errTextOf(n2run, n2job).slice(0, 160)})`);

  // N3 — a directory, not a file
  const n3 = await mkJob("N3 dir (t360)", { mapPath: SRC_DIR });
  const n3run = await runJob(n3.id);
  const n3job = await awaitTerminal(n3.id, 60_000);
  must(n3job?.status === "failed", `N3 the directory import fails (${n3job?.status})`);
  must(/is a directory, not a map file/.test(errTextOf(n3run, n3job)), `N3a the verdict names the directory shape (${errTextOf(n3run, n3job).slice(0, 160)})`);

  // N4 — .mrcs is not a volume
  client(`echo ${MAP_B64} | base64 -d > ${SRC_DIR}/particles.mrcs`);
  const n4 = await mkJob("N4 mrcs (t360)", { mapPath: `${SRC_DIR}/particles.mrcs` });
  const n4run = await runJob(n4.id);
  const n4job = await awaitTerminal(n4.id, 60_000);
  must(n4job?.status === "failed", `N4 the .mrcs import fails (${n4job?.status})`);
  must(/Not a 3D map file \(\.mrc\/\.map\)/.test(errTextOf(n4run, n4job)), `N4a the verdict names the extension (${errTextOf(n4run, n4job).slice(0, 160)})`);

  // N5 — a readable .mrc whose header is junk
  client(`head -c 2048 /dev/zero > ${SRC_DIR}/junk.mrc`);
  const n5 = await mkJob("N5 junk (t360)", { mapPath: `${SRC_DIR}/junk.mrc` });
  const n5run = await runJob(n5.id);
  const n5job = await awaitTerminal(n5.id, 60_000);
  must(n5job?.status === "failed", `N5 the junk-header import fails (${n5job?.status})`);
  must(/not a supported MRC volume/.test(errTextOf(n5run, n5job)), `N5a the verdict names the header (${errTextOf(n5run, n5job).slice(0, 160)})`);

  // N6 — the old ticket's exact message must be GONE for cluster paths
  must(!/Map file not accessible/.test(errTextOf(n1run, n1job) + errTextOf(n2run, n2job)), "N6 the old disk-blind「Map file not accessible」no longer answers cluster paths");
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
  client(`rm -rf ${SRC_DIR}`);
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  console.log("  cleaned: jobs, project (+cluster twin dir), the P48/J999 fixture tree, connection");
}

const ok = fail === 0;
console.log(`\nDIAG t360 mapimport cluster-side: ${ok ? "ALL GREEN" : `${fail} FAILURES`}`);
process.exit(ok ? 0 : 1);

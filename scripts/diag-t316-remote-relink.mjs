#!/usr/bin/env node
/**
 * t316 diag — the cluster-native STAR rows ride project-relative (the RELION
 * pipeliner law), and the sbatch cwd leaves the --o directory.
 *
 * The user's ticket (post-t314): the CTF dispatch PASSES the byte gate
 * ("1034 of 1034 rows … safe for CTF") and then relion_run_ctffind dies
 * inside filename.cpp:610:
 *
 *   Failed to make a symlink from
 *   /data03/.../ctffind_fq0069iq//data06/.../DW.mrc to
 *   /data03/.../ctffind_fq0069iq//data06/.../DW.mrc     ← from == to!
 *
 * Two cooperating causes, both proven in this suite:
 *
 *  1. THE WORKDIR TRAP: the sbatch script `cd`'d into remoteWorkdir — the
 *     SAME directory --o points at. RELION builds its scratch symlinks as
 *     `cwd + star-row` (src) and `fn_out + star-row` (dst); when cwd ==
 *     fn_out both concatenations are the SAME STRING — a self-referencing
 *     symlink (and on a re-dispatch, exists(dst) is false for a looping
 *     link while ::symlink(2) answers EEXIST — the "Failed to make" the
 *     user saw). The direct-mode wrapper always cd'd to the project root;
 *     the sbatch variant now speaks the same dialect.
 *  2. THE ABSOLUTE ROW: runImportRemoteLeg's zero-upload design writes
 *     CLUSTER-ABSOLUTE paths into micrographs.star. The relink pass now
 *     gives every such row a symlink under <remoteProjectRoot>/micrographs
 *     and rewrites the uploaded STAR to `micrographs/<name>` — the exact
 *     convention the LOCAL engine already runs (projectDirFor +
 *     linkDirInto), so no movie byte ever leaves the cluster AND the rows
 *     resolve from the project root cwd.
 *
 * Proven end to end against the mock cluster on the DEV server (:3000 —
 * API-only traffic; the browser-free lane):
 *
 *  A. the REGRESSION: remote import (cluster-absolute rows) → CTF dispatch
 *     (sbatch) → completes; the cluster carries the micrographs/ re-links,
 *     the uploaded STAR speaks project-relative, the sbatch script cd's to
 *     the project root, and run.out has no symlink failure.
 *  B. basename COLLISIONS from different folders get __cfN aliases (both
 *     files keep their own link).
 *  C. IDempotence: a re-dispatch re-points the links (ln -sfn) and completes.
 *  D. the LEDGER: the source contracts (the pass, the ceiling, the cd).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const CONN = "qa-t316";
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

const dispatchCtf = (id) =>
  api(`/api/jobs/${id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
    }),
  });

// ---------------------------------------------------------------- try/catch
try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the dev server answers on :3000");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t316",
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
    body: JSON.stringify({ name: "QA t316 relink", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");

  // ======================================================================
  console.log("== PHASE 1: fixtures — real-header micrographs + a basename collision ==");
  // the user's shape: motion-corrected single-section MRCs on the CLUSTER's
  // own storage; a subfolder carrying a file with the SAME basename proves
  // the __cfN aliasing.
  const mrc = (nx, ny, nz, mode) => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(nx, 0);
    b.writeInt32LE(ny, 4);
    b.writeInt32LE(nz, 8);
    b.writeInt32LE(mode, 12);
    return b;
  };
  const singleB64 = mrc(4096, 4096, 1, 2).toString("base64");
  const mkFixtures =
    "mkdir -p /data2/relink-t316/sub; " +
    `echo ${singleB64} | base64 -d > /tmp/.t316-single.mrc; ` +
    "for i in $(seq 1 12); do cp /tmp/.t316-single.mrc /data2/relink-t316/20241031_lijing_${i}_Fractions_DW.mrc; done; " +
    "cp /tmp/.t316-single.mrc /data2/relink-t316/sub/20241031_lijing_1_Fractions_DW.mrc; " +
    "cp /tmp/.t316-single.mrc /data2/relink-t316/sub/20241031_lijing_2_Fractions_DW.mrc";
  const fixtureOut = clientBoth(mkFixtures);
  must(fixtureOut === "", `the fixtures build quietly (${fixtureOut.slice(0, 120)})`);
  const nTop = client("ls /data2/relink-t316/*.mrc 2>/dev/null | wc -l");
  const nSub = client("ls /data2/relink-t316/sub/*.mrc 2>/dev/null | wc -l");
  must(nTop.trim() === "12", `the top folder holds 12 (${nTop})`);
  must(nSub.trim() === "2", `the subfolder holds 2 colliding basenames (${nSub})`);

  // ======================================================================
  console.log("== PHASE 2: the remote import — CLUSTER-ABSOLUTE rows (the user's world) ==");
  // an explicit multi-FILE list (folder+file mixes are not a legal import
  // shape): 12 from the top folder + the 2 same-basename files from sub/
  const fileList = [
    ...Array.from({ length: 12 }, (_, i) => `/data2/relink-t316/20241031_lijing_${i + 1}_Fractions_DW.mrc`),
    "/data2/relink-t316/sub/20241031_lijing_1_Fractions_DW.mrc",
    "/data2/relink-t316/sub/20241031_lijing_2_Fractions_DW.mrc",
  ];
  const importA = await mkJob({
    projectId,
    type: "import",
    name: "QA t316 remote mics",
    params: { micrographsPath: fileList.join("\n"), pixelSize: 0.93, voltage: 300 },
  });
  must(!!importA?.id, "the import job creates");
  const runA = await api(`/api/jobs/${importA.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runA.status >= 200 && runA.status < 300, `the import run accepts (${runA.status})`);
  const doneA = await pollUntil(async () => {
    const j = await jobById(importA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneA?.status === "completed", `the import completes (${doneA?.status}: ${String(doneA?.result ?? "").slice(0, 90)})`);
  const resA = String(doneA?.result ?? "");
  must(/14 micrographs imported/.test(resA), `the import counts 14 (12 + 2 explicit): ${resA.slice(0, 120)}`);
  must(/zero upload/i.test(resA), "the receipt keeps the zero-upload promise");

  // the LOCAL mirror star carries cluster-absolute rows — the world the
  // dispatch will now translate
  const localStar = path.join(ROOT, "data/relion", projectId, `import_${importA.id.slice(-8)}`, "micrographs.star");
  const starBody = existsSync(localStar) ? readFileSync(localStar, "utf8") : "";
  must(/\/data2\/relink-t316\/20241031_lijing_1_Fractions_DW\.mrc/.test(starBody), "the local mirror star writes CLUSTER-ABSOLUTE rows (the zero-upload dialect)");

  // ======================================================================
  console.log("== PHASE 3: THE REGRESSION — the sbatch CTF dispatch over absolute rows ==");
  const ctfA = await mkJob({ projectId, type: "ctffind", name: "QA t316 ctf", params: {} });
  must(!!ctfA?.id, "the ctffind job creates");
  const edgeA = await mkEdge(importA.id, ctfA.id, "micrographs", "micrographs");
  must(edgeA === 200 || edgeA === 201, `the edge wires import → ctffind (${edgeA})`);

  const dispatchA = await dispatchCtf(ctfA.id);
  must(dispatchA.status >= 200 && dispatchA.status < 300, `the dispatch route answers (${dispatchA.status})`);
  must(!dispatchA.body?.error, `the dispatch is ACCEPTED (${String(dispatchA.body?.error ?? "").slice(0, 120)})`);
  const doneCtfA = await pollUntil(async () => {
    const j = await jobById(ctfA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(doneCtfA?.status === "completed", `the ctffind completes (${doneCtfA?.status}: ${String(doneCtfA?.result ?? "").slice(0, 90)})`);

  const projRoot = `/projects/cryoflow/${projectId}`;
  const workdirA = `${projRoot}/ctffind_${ctfA.id.slice(-8)}`;

  // ---- the cluster-side evidence: the re-links themselves ----
  const linkCount = client(`ls -la ${projRoot}/micrographs/ 2>/dev/null | grep -c '\\->'`);
  must(linkCount.trim() === "14", `the project root carries 14 re-links (${linkCount.trim()})`);
  // the mock's readlink answers in its OWN fs-root dialect (the link target
  // lands under <mock fs>/data2/...), so the assertion matches the tail
  const linkSample = client(`readlink ${projRoot}/micrographs/20241031_lijing_1_Fractions_DW.mrc 2>/dev/null`);
  must(
    linkSample.trim().endsWith("/data2/relink-t316/20241031_lijing_1_Fractions_DW.mrc") && !linkSample.trim().includes("/sub/"),
    `the link points at the real cluster file (${linkSample.trim().slice(-70)})`
  );
  // the collision pair: sub/1 has its own alias, not the top folder's link
  const aliasCount = client(`ls ${projRoot}/micrographs/ 2>/dev/null | grep -c '__cf'`);
  must(aliasCount.trim() === "2", `the two colliding basenames got __cfN aliases (${aliasCount.trim()})`);
  const aliasSample = client(`ls ${projRoot}/micrographs/ 2>/dev/null | grep '__cf' | head -1`);
  must(/20241031_lijing_[12]_Fractions_DW__cf2\.mrc/.test(aliasSample.trim()), `the alias keeps the stem + suffix (${aliasSample.trim()})`);
  const aliasTarget = client(`readlink ${projRoot}/micrographs/20241031_lijing_1_Fractions_DW__cf2.mrc 2>/dev/null`);
  must(
    aliasTarget.trim().endsWith("/data2/relink-t316/sub/20241031_lijing_1_Fractions_DW.mrc"),
    `the alias points at the SUBFOLDER file (${aliasTarget.trim().slice(-70)})`
  );

  // ---- the uploaded STAR speaks project-relative ----
  const remoteStar = client(`cat ${projRoot}/import_${importA.id.slice(-8)}/micrographs.star 2>/dev/null`);
  must(/micrographs\/20241031_lijing_1_Fractions_DW\.mrc/.test(remoteStar), "the uploaded star's rows are project-relative (micrographs/<name>)");
  must(!/\/data2\/relink-t316/.test(remoteStar), "the uploaded star carries NO cluster-absolute residue");
  must((remoteStar.match(/micrographs\//g) ?? []).length >= 14, `all 14 rows ride the alias (${(remoteStar.match(/micrographs\//g) ?? []).length})`);

  // ---- the sbatch script cd's to the PROJECT ROOT (the trap removed) ----
  const sbatchA = client(`cat ${workdirA}/.cf-sbatch.sh 2>/dev/null`);
  if (process.env.T316_DEBUG) console.log("---- sbatch script ----\n" + sbatchA + "\n-----------------------");
  // the mock's upload layer rewrites cluster-absolute paths inside .sh
  // CONTENT into its own fs-root dialect (so the script's mkdir/cd land on
  // the host) — the cd target therefore shows up as <mock-fs>+projRoot on
  // the mock and bare projRoot on a real cluster. Match by SUFFIX: the cd
  // line's target ENDS at the project root in both dialects.
  const cdSuffix = projRoot.replace(/\//g, "\\/");
  const ctfSuffix = ctfA.id.slice(-8);
  must(
    new RegExp(`cd ['"]?[^\n]*${cdSuffix}['"]?(\s|\|\||$)`).test(sbatchA),
    `the sbatch script cd's to the project root (cd line: ${sbatchA.split("\n").find((l) => l.startsWith("cd ")) ?? "(none)"})`
  );
  must(
    !new RegExp(`cd ['"]?[^\n]*ctffind_${ctfSuffix}`).test(sbatchA),
    "the sbatch script does NOT cd into the --o workdir (the self-reference trap)"
  );

  // ---- run.out: no symlink failure, the receipt present ----
  const runOutA = client(`cat ${workdirA}/run.out 2>/dev/null`);
  must(!/Failed to make a symlink/i.test(runOutA), "run.out has NO symlink failure (the user's ticket text is gone)");
  must(/14 micrograph\(s\)/.test(runOutA), `the fake processed all 14 rows (${runOutA.split("\n").find((l) => l.includes("micrograph(s)")) ?? ""})`);

  // ---- the output star echoes the project-relative rows (downstream-ready) ----
  const outStar = client(`cat ${workdirA}/micrographs_ctf.star 2>/dev/null`);
  must(/micrographs\/20241031_lijing_1_Fractions_DW\.mrc/.test(outStar), "the output star's rows are project-relative");
  must(!/\/data2\/relink-t316/.test(outStar), "the output star carries NO cluster-absolute residue");

  // ======================================================================
  console.log("== PHASE 4: idempotence — a re-dispatch re-points and completes ==");
  const dispatchA2 = await dispatchCtf(ctfA.id);
  must(dispatchA2.status >= 200 && dispatchA2.status < 300, `the re-dispatch route answers (${dispatchA2.status})`);
  must(!dispatchA2.body?.error, `the re-dispatch is accepted (${String(dispatchA2.body?.error ?? "").slice(0, 100)})`);
  const doneCtfA2 = await pollUntil(async () => {
    const j = await jobById(ctfA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(doneCtfA2?.status === "completed", `the re-dispatched ctffind completes (${doneCtfA2?.status})`);
  const linkCount2 = client(`ls -la ${projRoot}/micrographs/ 2>/dev/null | grep -c '\\->'`);
  must(linkCount2.trim() === "14", `the re-links stand at 14 after the re-run (ln -sfn re-pointed, no dupes) (${linkCount2.trim()})`);

  // ======================================================================
  console.log("== PHASE 4b: the array split rides the same dialect (shards=2) ==");
  // the shard tasks read $SHARD (sliced from the RE-WRITTEN star — the rows
  // ride micrographs/<name>) and run with cwd = project root; the merged
  // output must carry the same project-relative rows.
  const ctfS = await mkJob({ projectId, type: "ctffind", name: "QA t316 ctf shards", params: {} });
  must(!!ctfS?.id, "the shard ctffind job creates");
  const edgeS = await mkEdge(importA.id, ctfS.id, "micrographs", "micrographs");
  must(edgeS === 200 || edgeS === 201, `the shard edge wires (${edgeS})`);
  const dispatchS = await api(`/api/jobs/${ctfS.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1, shards: 2 },
    }),
  });
  must(dispatchS.status >= 200 && dispatchS.status < 300, `the shard dispatch route answers (${dispatchS.status})`);
  must(!dispatchS.body?.error, `the shard dispatch is accepted (${String(dispatchS.body?.error ?? "").slice(0, 100)})`);
  const doneCtfS = await pollUntil(async () => {
    const j = await jobById(ctfS.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 240_000);
  must(doneCtfS?.status === "completed", `the shard ctffind completes (${doneCtfS?.status}: ${String(doneCtfS?.result ?? "").slice(0, 90)})`);
  const workdirS = `${projRoot}/ctffind_${ctfS.id.slice(-8)}`;
  const sbatchS = client(`cat ${workdirS}/.cf-sbatch.sh 2>/dev/null`);
  must(/--array=1-2%4/.test(sbatchS), "the shard script carries the array directive");
  const outStarS = client(`cat ${workdirS}/micrographs_ctf.star 2>/dev/null`);
  must(
    /micrographs\/20241031_lijing_1_Fractions_DW\.mrc/.test(outStarS) && !/\/data2\/relink-t316/.test(outStarS),
    "the MERGED shard output star stays project-relative (no absolute residue)"
  );

  // ======================================================================
  console.log("== PHASE 4c: the direct mode rides the same dialect ==");
  const ctfD = await mkJob({ projectId, type: "ctffind", name: "QA t316 ctf direct", params: {} });
  must(!!ctfD?.id, "the direct ctffind job creates");
  const edgeD = await mkEdge(importA.id, ctfD.id, "micrographs", "micrographs");
  must(edgeD === 200 || edgeD === 201, `the direct edge wires (${edgeD})`);
  const dispatchD = await api(`/api/jobs/${ctfD.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "direct" },
    }),
  });
  must(dispatchD.status >= 200 && dispatchD.status < 300, `the direct dispatch route answers (${dispatchD.status})`);
  must(!dispatchD.body?.error, `the direct dispatch is accepted (${String(dispatchD.body?.error ?? "").slice(0, 100)})`);
  const doneCtfD = await pollUntil(async () => {
    const j = await jobById(ctfD.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 240_000);
  must(doneCtfD?.status === "completed", `the direct ctffind completes (${doneCtfD?.status}: ${String(doneCtfD?.result ?? "").slice(0, 90)})`);
  const runOutD = client(`cat ${projRoot}/ctffind_${ctfD.id.slice(-8)}/run.out 2>/dev/null`);
  must(!/Failed to make a symlink/i.test(runOutD), "the direct run.out has NO symlink failure either");

  // ======================================================================
  console.log("== PHASE 5: the ledger (source contracts) ==");
  const src = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  must(
    /function remoteNativeRefs/.test(src) && /function planRelinks/.test(src) && /function applyRelinks/.test(src),
    "B: the relink trio owns the pass (detect → plan → rewrite)"
  );
  must(/RELINK_MAX = 20_000/.test(src), "B: the 20k ceiling caps a runaway STAR");
  must(
    /function ensureRemoteRelinks/.test(src) && /ln -sfn /.test(src) && src.includes("const BATCH = 250"),
    "B: the links land in batched SSH rounds (ln -sfn, idempotent)"
  );
  must(
    /function stageStarWithRelinks/.test(src) && src.includes("stageStarWithRelinks(conn, u.local, u.remote, relinkRewrites)"),
    "B: the uploaded STARs ride the rewrite (the cluster copy speaks pipeliner)"
  );
  must(
    src.includes("await ensureRemoteRelinks(conn, remoteProjectRoot, relinkLinks)"),
    "B: the links are created BEFORE the uploads/spawn"
  );
  must(
    /cd \$\{shQuote\(remoteProjectRoot\)\}/.test(src) && !/cd \$\{shQuote\(remoteWorkdir \+ "\/.cf-exit/.test(src),
    "B: both script builders cd to the project root (the workdir trap is gone)"
  );
  // the user's own error signature — the diagnosis this suite pins
  const userError =
    "Failed to make a symlink from /data03/Lijing/cryoflow/cmu77omju0000uwfcauoi30d7/ctffind_fq0069iq//data06/x.mrc to /data03/Lijing/cryoflow/cmu77omju0000uwfcauoi30d7/ctffind_fq0069iq//data06/x.mrc";
  must(/^Failed to make a symlink from (.+) to \1$/.test(userError), "the from == to signature is the trap's fingerprint (regex pins it)");

  console.log(`\n== t316 diag: ${fail === 0 ? "ALL GREEN" : `${fail} FAIL`} ==`);
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
    client("rm -rf /data2/relink-t316 /tmp/.t316-single.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

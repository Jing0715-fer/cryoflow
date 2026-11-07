#!/usr/bin/env node
/**
 * t417 — project deletion must reclaim BOTH file planes.
 *
 * The wound (witnessed 2026-09-28 10:30 QA): DELETE /api/projects/[id] purged
 * DB rows, sidecar edges, run records and meta — but left the LOCAL workdir
 * root <RELION_DIR>/<projectId> and the CLUSTER mirror <remoteRoot>/<projectId>
 * on disk. 21 cluster husks + ~35 local roots (1.4GB) accumulated from earlier
 * deletes, while the dialog promises "removes the project with all of its
 * jobs ... cannot be undone". The single-job route keeps workdirs ON PURPOSE
 * (undo re-attaches them); project delete has no restore — files outliving it
 * are not a tombstone, they are a landfill.
 *
 * t418 grew Phase E — a LIVE remote run dies with its project: the stop loop
 * used to call the LOCAL stopRun for every record, so a remote (sbatch) run
 * was never scancelled — it ran on for its full walltime writing into a
 * mirror the same request was rm -rf'ing (and a pid collision on the app host
 * could kill an unrelated local process). The smoking gun this suite pins:
 * the mock's accounting journal must speak a CANCELLED row for the job the
 * record knew, and the delete's response must count the stop.
 *
 * Phases:
 *   B  the product face — a fixture project with a local workdir and a
 *      cluster mirror, BOUND to a connection, DELETES with reclaimed.local
 *      naming the root, cluster[0].ok, both dirs GONE. The witness lane is
 *      the BOUND CONNECTION (pure product semantics: PATCH binding + delete);
 *      the records lane is covered at unit level (t417-unit-reclaim-bench.ts) —
 *      planting a fake record here would test nothing the product does, and
 *      the first draft's file-level record planting raced the live server's
 *      own state ownership (the poll sweep owns the file, not the suite).
 *   C  the two-plane honesty boundary — a project with NO mirrors deletes
 *      cleanly with an EMPTY cluster ledger (nothing guessed, nothing lied)
 *   E  t418 — the live lane: a remote motioncorr RUNNING on the mock (slurm
 *      mode), the project DELETED underneath it — the scancel must land
 *      (CANCELLED accounting row for the record's slurmId), the teardown
 *      settle before the rm, the mirror + local root reclaimed, the response
 *      counts the stop. The RECORD lane rides for real here too: a live
 *      dispatched run's rec.remote is the primary mirror witness.
 *   F  t420 — the STAGING lane: a remote dispatch caught MID-STAGING (bytes
 *      moving, no slurmId yet) dies with its project — the dispatch must
 *      STAND DOWN before the rm (t341's per-file gate only read the cleared
 *      record, which the route cleared long after the reclaim), nothing is
 *      ever submitted (the scheduler's journal stays unchanged), and the
 *      mirror is GONE with nothing recreated after it.
 *   D  the world survives — the demo project's jobs and its cluster tree
 *      (marked by this suite before any delete: a fresh world has no healed
 *      chain, so the suite guarantees its own precondition) are untouched.
 *
 * PORTABILITY (t418): ROOT resolves from THIS FILE's location — the suite
 * runs against whatever app serves :3000 with its data/ + mock tree in the
 * repo that owns it (the cron lane's /home/z/my-project and a fresh clone's
 * own root both resolve correctly; the old hardcode assumed one checkout).
 *
 * SURVIVOR NOTE: this suite is the THIRD writing. The first died in the
 * 04:14 sandbox reboot (uncommitted work is uncommitted work); the second
 * lived long enough to prove the two-plane reclaim end to end (ALL PASS)
 * before the same reboot ate it. The witness-lane redesign above is the
 * one lesson the second writing paid for.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const BASE = "http://localhost:3000";
const RELION_DIR = `${ROOT}/data/relion`;
const CLUSTER_TREE = "services/mock-cluster/fs/projects/cryoflow";
const MOCK_SLURM = `${ROOT}/services/mock-cluster/fs/home/cryo/.slurm`;
const STATE_FILE = `${ROOT}/data/engine-state.json`;

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollUntil(fn, ms, step = 1500) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s?.runs ?? s ?? {};
  } catch {
    return {};
  }
};

// fabricate one tiny but VALID mrc (t265's recipe — 64×64 float32)
function mrcBuffer() {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12); // mode 2 = float32
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
  return buf;
}

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Content-Type": "application/json",
};
async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: SH,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const b = await res.json().catch(() => ({}));
  return { status: res.status, body: b };
}

// ---- identity bookkeeping (this suite owns everything it creates) --------
const createdProjects = [];
const createdConnections = [];

async function mkProject(name) {
  const r = await api("POST", "/api/projects", { name });
  must(r.status === 201 || r.status === 200, `project "${name}" created (${r.status})`);
  const id = r.body?.project?.id;
  if (id) createdProjects.push(id);
  return id;
}

/* ------------------------------------------------------------------ */
/* world precondition — the demo tree witness (t418): a fresh world has  */
/* no healed demo chain, so Phase D's protection would assert against a   */
/* tree that never existed (vacuous). The suite plants a marker BEFORE    */
/* any delete runs; Phase D then verifies the marker SURVIVED every      */
/* delete this suite performed. mkdir -p on a healed world is a no-op.   */
/* ------------------------------------------------------------------ */
const projects0 = await api("GET", "/api/projects");
const demo0 = (projects0.body?.projects ?? []).find((p) => p.name.includes("demo"));
must(!!demo0, "the demo project is present (the seeded world)");
const DEMO_TREE = demo0 ? `${ROOT}/${CLUSTER_TREE}/${demo0.id}` : null;
const DEMO_MARKER = DEMO_TREE ? `${DEMO_TREE}/t417-witness.txt` : null;
if (DEMO_TREE) {
  mkdirSync(DEMO_TREE, { recursive: true });
  writeFileSync(DEMO_MARKER, "the demo tree must survive every fixture delete");
}

console.log("\n== Phase B — the two-plane reclaim ==\n");

// B1 — connection (the cluster the mirror lives on). The t416 payload
// shape exactly: the id is client-chosen, the auth is password (the mock
// cluster accepts demo/demo), remoteRoot = the mock tree.
const connId = `qa-t417-${Date.now().toString(36)}`;
createdConnections.push(connId);
const mk = await api("POST", "/api/remote/connections", {
  id: connId,
  name: "t417-reclaim-fixture",
  host: "127.0.0.1",
  port: 3022,
  username: "cryo",
  password: "demo",
  authMethod: "password",
  remoteRoot: "/projects/cryoflow",
});
must(mk.status === 201 || mk.status === 200, `fixture connection created (${mk.status})`);
must(!!connId, "connection id resolves");

const proj = await mkProject("t417 Reclaim Fixture");
must(!!proj, "fixture project id resolves");

// B2 — the local plane: a workdir root with a marker file inside
const localRoot = `${RELION_DIR}/${proj}`;
mkdirSync(`${localRoot}/import_t417a`, { recursive: true });
writeFileSync(`${localRoot}/import_t417a/mic.mrc`, "t417 local marker");
must(existsSync(localRoot), "local workdir root exists pre-delete");

// B3 — the cluster plane: a mirror dir with a workdir inside
execSync(`mkdir -p ${CLUSTER_TREE}/${proj}/import_t417a`, { cwd: ROOT });
writeFileSync(`${ROOT}/${CLUSTER_TREE}/${proj}/import_t417a/out.txt`, "t417 cluster marker");
must(existsSync(`${ROOT}/${CLUSTER_TREE}/${proj}`), "cluster mirror exists pre-delete");

// B4 — bind the connection to the project (the fallback witness lane: the
// binding names the cluster the project's data lived on even when every
// run record is already gone)
const bind = await api("PATCH", `/api/projects/${proj}`, { remoteConnectionId: connId });
must(bind.status === 200, `connection bound to project (${bind.status})`);

// B5 — DELETE and read the ledger
const del = await api("DELETE", `/api/projects/${proj}`);
must(del.status === 200, `delete answers 200 (got ${del.status})`);
const rec_ = del.body?.reclaimed;
must(rec_?.local === localRoot, `reclaimed.local names the root (${rec_?.local})`);
must(!existsSync(localRoot), "local workdir root GONE");
must(
  existsSync(`${ROOT}/${CLUSTER_TREE}/${proj}`) === false,
  "cluster mirror GONE"
);
must(Array.isArray(rec_?.cluster) && rec_.cluster.length >= 1, "cluster ledger spoken");
const c0 = rec_?.cluster?.[0];
must(c0?.ok === true, `cluster rm verdict ok (${c0?.error ?? "ok"})`);
must(c0?.path === `/projects/cryoflow/${proj}`, "cluster ledger names the mirror path");

console.log("\n== Phase C — a mirrorless project deletes honestly ==\n");

const proj2 = await mkProject("t417 No Mirror");
const del2 = await api("DELETE", `/api/projects/${proj2}`);
must(del2.status === 200, `mirrorless delete answers 200 (got ${del2.status})`);
must(del2.body?.reclaimed?.local === null, "local ledger honest: null (nothing on disk)");
must(
  Array.isArray(del2.body?.reclaimed?.cluster) &&
    del2.body.reclaimed.cluster.length === 0,
  "cluster ledger honest: empty (nothing guessed)"
);

console.log("\n== Phase E — t418: a LIVE remote run dies with its project ==\n");

{
  // E0 — the mock cluster must be listening (launch it if no resident one)
  const net = await import("node:net");
  const listening = await new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });
  if (!listening) {
    execSync("bash services/mock-cluster/launch.sh", { cwd: ROOT, stdio: "pipe" });
    await sleep(2500);
  }
  must(true, "the mock cluster is listening on :3022");

  // E1 — fixture project + a REAL local import of 25 micrographs (the
  // mock's motioncorr paces 1s/mic capped at 60s — 25 mics ≈ a 25s live
  // window, wide enough for the delete to land mid-run, quick enough not
  // to tax the suite)
  const projE = await mkProject("t417 Live Stop Fixture");
  must(!!projE, "the live-stop fixture project exists");
  const FIXDIR = `${ROOT}/data/t417-live-stop-mics`;
  mkdirSync(FIXDIR, { recursive: true });
  for (let k = 1; k <= 25; k++) writeFileSync(`${FIXDIR}/mic_${String(k).padStart(2, "0")}.mrc`, mrcBuffer());
  const mkJob = async (body) => {
    const r = await api("POST", "/api/jobs", body);
    return r.body?.job;
  };
  const imp = await mkJob({ type: "import", name: "t417 LS Import", params: { micrographsPath: FIXDIR, pixelSize: 1.77 } });
  must(!!imp?.id, "the import job exists");
  const mcr = await mkJob({ type: "motioncorr", name: "t417 LS Motioncorr", params: {} });
  must(!!mcr?.id, "the motioncorr job exists");
  const edge = await api("POST", "/api/edges", { fromJobId: imp.id, toJobId: mcr.id, fromPort: "micrographs", toPort: "movies" });
  must(edge.status === 201 || edge.status === 200, `import → motioncorr wired (${edge.status}${edge.status !== 201 && edge.status !== 200 ? `: ${edge.body?.error ?? ""}` : ""})`);

  const runImp = await api("POST", `/api/jobs/${imp.id}/run`, {});
  must(runImp.status === 200 || runImp.status === 201, `the import runs locally (${runImp.status})`);
  const impDone = await pollUntil(async () => {
    const j = await api("GET", "/api/jobs");
    const row = (j.body?.jobs ?? []).find((x) => x.id === imp.id);
    return row?.status === "completed" ? row : null;
  }, 60_000);
  must(!!impDone, "the local import completes (25 real mics)");

  // E2 — dispatch the motioncorr REMOTE, slurm mode (the scancel lane)
  const connE = `qa-t417e-${Date.now().toString(36)}`;
  createdConnections.push(connE);
  const mkc = await api("POST", "/api/remote/connections", {
    id: connE,
    name: "t417 live-stop conn",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  });
  must(mkc.status === 201 || mkc.status === 200, `the live-stop connection is created (${mkc.status})`);
  const disp = await api("POST", `/api/jobs/${mcr.id}/run`, {
    remote: { connectionId: connE, module: "relion/5.0.1", mode: "slurm" },
  });
  must(disp.status === 200 || disp.status === 201, `the motioncorr dispatches to the cluster (${disp.status})`);

  // E3 — wait for RUNNING with a slurmId in the record (the stop loop's
  // witness): dispatch → staging (upload 25 mics) → sbatch → running
  const live = await pollUntil(async () => {
    const j = await api("GET", "/api/jobs");
    const row = (j.body?.jobs ?? []).find((x) => x.id === mcr.id);
    const rec = stateRuns()[mcr.id];
    return row?.status === "running" && rec?.remote?.slurmId ? { row, rec } : null;
  }, 90_000, 1000);
  must(!!live, "the motioncorr reaches RUNNING on the mock with a slurmId");
  const slurmId = live?.rec?.remote?.slurmId ? String(Number(live.rec.remote.slurmId)) : "";
  must(!!slurmId, `the record speaks the slurmId (${slurmId || "none"})`);
  const accountingBefore = existsSync(`${MOCK_SLURM}/accounting`)
    ? readFileSync(`${MOCK_SLURM}/accounting`, "utf8")
    : "";

  // E4 — DELETE the project while the run is live. THE REGRESSION: before
  // t418 this scancelled NOTHING (the stop loop called the local stopRun
  // on a cluster-side pid) — the sbatch job ran on into a deleted mirror.
  const delE = await api("DELETE", `/api/projects/${projE}`);
  must(delE.status === 200, `the live-stop delete answers 200 (got ${delE.status})`);
  const bodyE = delE.body ?? {};
  must(
    typeof bodyE.stoppedLiveRuns === "number" && bodyE.stoppedLiveRuns >= 1,
    `the response counts the stopped live run (${JSON.stringify(bodyE.stoppedLiveRuns)})`
  );
  must(bodyE?.reclaimed?.local === `${RELION_DIR}/${projE}`, `the local root is reclaimed (${bodyE?.reclaimed?.local})`);
  const mirrorE = bodyE?.reclaimed?.cluster?.find((c) => c.path === `/projects/cryoflow/${projE}`);
  must(!!mirrorE, "the RECORD witness named the mirror (a live run's rec.remote is the primary witness)");
  must(mirrorE?.ok === true, `the mirror rm verdict ok (${mirrorE?.error ?? "ok"})`);
  must(!existsSync(`${RELION_DIR}/${projE}`), "local root GONE on disk");
  must(!existsSync(`${ROOT}/${CLUSTER_TREE}/${projE}`), "cluster mirror GONE on disk");

  // E5 — the smoking gun: the mock's accounting journal gained a CANCELLED
  // row for THIS job (pre-fix the job would run to COMPLETED — the delete
  // only stopped the local side of a record whose pid lived on the cluster)
  const accountingAfter = existsSync(`${MOCK_SLURM}/accounting`)
    ? readFileSync(`${MOCK_SLURM}/accounting`, "utf8")
    : "";
  const cancelledRow = accountingAfter
    .split("\n")
    .find((l) => l.startsWith(`${slurmId}|CANCELLED|`));
  must(
    !!cancelledRow,
    `the scheduler's journal speaks CANCELLED for slurm job ${slurmId} — the scancel landed`
  );
  must(
    !accountingBefore.split("\n").some((l) => l.startsWith(`${slurmId}|CANCELLED|`)),
    "the CANCELLED row is NEW (not a stale witness from an earlier run)"
  );
  must(
    existsSync(`${MOCK_SLURM}/job-${slurmId}.cancelled`),
    "the cancel marker file exists (scancel's own receipt)"
  );
  execSync(`rm -rf ${FIXDIR}`, { stdio: "pipe" });
}

console.log("\n== Phase F — t420: a delete that lands MID-STAGING stands the dispatch down before the rm ==\n");

{
  // F0 — the mock cluster must be listening (same as E0)
  const net = await import("node:net");
  const listening = await new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });
  if (!listening) {
    execSync("bash services/mock-cluster/launch.sh", { cwd: ROOT, stdio: "pipe" });
    await sleep(2500);
  }
  must(true, "the mock cluster is listening on :3022");

  // F1 — fixture: 160 mics. Phase E's 25 were sized for the RUNNING window
  // (the mock's motioncorr pacing); the STAGING window needs WIDE UPLOAD
  // TIME — 160 per-file SFTP round-trips give the delete a deterministic
  // mid-upload landing zone (stagedBytes moving, slurmId not yet born).
  const projF = await mkProject("t420 Staging Stop Fixture");
  must(!!projF, "the staging-stop fixture project exists");
  const FIXDIRF = `${ROOT}/data/t420-staging-mics`;
  mkdirSync(FIXDIRF, { recursive: true });
  for (let k = 1; k <= 160; k++) writeFileSync(`${FIXDIRF}/mic_${String(k).padStart(3, "0")}.mrc`, mrcBuffer());
  const mkJobF = async (body) => {
    const r = await api("POST", "/api/jobs", body);
    return r.body?.job;
  };
  const impF = await mkJobF({ type: "import", name: "t420 F Import", params: { micrographsPath: FIXDIRF, pixelSize: 1.77 } });
  must(!!impF?.id, "the import job exists");
  const mcrF = await mkJobF({ type: "motioncorr", name: "t420 F Motioncorr", params: {} });
  must(!!mcrF?.id, "the motioncorr job exists");
  const edgeF = await api("POST", "/api/edges", { fromJobId: impF.id, toJobId: mcrF.id, fromPort: "micrographs", toPort: "movies" });
  must(edgeF.status === 201 || edgeF.status === 200, `import → motioncorr wired (${edgeF.status})`);
  const runImpF = await api("POST", `/api/jobs/${impF.id}/run`, {});
  must(runImpF.status === 200 || runImpF.status === 201, `the import runs locally (${runImpF.status})`);
  const impFDone = await pollUntil(async () => {
    const j = await api("GET", "/api/jobs");
    const row = (j.body?.jobs ?? []).find((x) => x.id === impF.id);
    return row?.status === "completed" ? row : null;
  }, 120_000, 1000);
  must(!!impFDone, "the local import completes (160 real mics)");

  // F2 — connection + the remote dispatch, and the accounting snapshot the
  // no-submit assertion reads against
  const connF = `qa-t420f-${Date.now().toString(36)}`;
  createdConnections.push(connF);
  const mkcF = await api("POST", "/api/remote/connections", {
    id: connF,
    name: "t420 staging conn",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  });
  must(mkcF.status === 201 || mkcF.status === 200, `the staging conn is created (${mkcF.status})`);
  const accountingBeforeF = existsSync(`${MOCK_SLURM}/accounting`)
    ? readFileSync(`${MOCK_SLURM}/accounting`, "utf8")
    : "";
  const dispF = await api("POST", `/api/jobs/${mcrF.id}/run`, {
    remote: { connectionId: connF, module: "relion/5.0.1", mode: "slurm" },
  });
  must(dispF.status === 200 || dispF.status === 201, `the motioncorr dispatches to the cluster (${dispF.status})`);

  // F3 — catch the dispatch MID-STAGING: bytes moving, no slurmId yet
  const mid = await pollUntil(async () => {
    const rec = stateRuns()[mcrF.id];
    return rec?.remote?.phase === "staging" && (rec?.remote?.stagedBytes ?? 0) > 0 && !rec?.remote?.slurmId
      ? rec
      : null;
  }, 60_000, 60);
  must(!!mid, "the dispatch is caught MID-STAGING (phase staging, bytes moving, no slurmId yet)");
  // the record the delete will meet — it may have flipped to RUNNING in the
  // gap between the poll and the request (160 files can finish fast); the
  // assertion below branches on which lane the delete actually met
  const recAtDelete = stateRuns()[mcrF.id];
  const slurmIdAtDelete = recAtDelete?.remote?.slurmId ? String(Number(recAtDelete.remote.slurmId)) : "";

  // F4 — DELETE while staging. THE REGRESSION (t418's known edge): the
  // staging task's per-file gate (t341) reads the CLEARED record, and the
  // record was cleared LONG after the mirror rm — the task kept uploading
  // straight through the reclaim (one file + mkdir -p dirs recreated the
  // husk) and could even reach the submit. The fix stands the dispatch
  // down BEFORE the rm and waits for its exit (the teardown-settle
  // symmetry the scancel branch already carries).
  const delF = await api("DELETE", `/api/projects/${projF}`);
  must(delF.status === 200, `the mid-staging delete answers 200 (got ${delF.status})`);
  const bodyF = delF.body ?? {};
  const mirrorF = bodyF?.reclaimed?.cluster?.find((c) => c.path === `/projects/cryoflow/${projF}`);
  must(!!mirrorF, "the RECORD witness named the mirror (a staging run's rec.remote is the primary witness)");
  must(mirrorF?.ok === true, `the mirror rm verdict ok (${mirrorF?.error ?? "ok"})`);
  must(!existsSync(`${RELION_DIR}/${projF}`), "local root GONE on disk");
  must(!existsSync(`${ROOT}/${CLUSTER_TREE}/${projF}`), "cluster mirror GONE — NOTHING recreated after the reclaim");

  // F5 — the submit fence, honest about which lane the delete met: a pure
  // staging-phase kill must leave the scheduler's journal UNCHANGED (there
  // was no slurmId to scancel — the only acceptable outcome is that no
  // sbatch was ever born); a record that flipped to RUNNING in the gap is
  // fenced by Phase E's contract instead (CANCELLED row for the slurmId).
  const accountingAfterF = existsSync(`${MOCK_SLURM}/accounting`)
    ? readFileSync(`${MOCK_SLURM}/accounting`, "utf8")
    : "";
  if ((bodyF.stoppedLiveRuns ?? 0) >= 1 && slurmIdAtDelete) {
    must(
      accountingAfterF.split("\n").some((l) => l.startsWith(`${slurmIdAtDelete}|CANCELLED|`)),
      `the record flipped to RUNNING before the delete — Phase E's fence holds (CANCELLED row for ${slurmIdAtDelete})`
    );
  } else {
    const newRows = accountingAfterF
      .split("\n")
      .filter((l) => l && !accountingBeforeF.includes(l));
    must(
      newRows.length === 0,
      `the scheduler's journal is UNCHANGED — nothing was submitted, the staging dispatch stood down before the rm (${newRows.length} unexpected row(s))`
    );
  }
  execSync(`rm -rf ${FIXDIRF}`, { stdio: "pipe" });
}

console.log("\n== Phase D — the world survives ==\n");

const projects = await api("GET", "/api/projects");
const demo = (projects.body?.projects ?? []).find((p) => p.name.includes("demo"));
must(!!demo, "demo project still present");
must(
  existsSync(`${ROOT}/services/mock-cluster/fs/projects/cryoflow/${demo?.id ?? "___"}`),
  "demo cluster tree untouched"
);
must(
  DEMO_MARKER && existsSync(DEMO_MARKER),
  "the demo tree witness marker survived every delete (no blast radius)"
);

console.log("\n== Cleanup (own names only) ==\n");
for (const id of createdProjects) {
  await api("DELETE", `/api/projects/${id}`).catch(() => {});
}
for (const cid of createdConnections) {
  await fetch(`${BASE}/api/remote/connections/${cid}`, {
    method: "DELETE",
    headers: SH,
  }).catch(() => {});
}
console.log(`  fixture projects cleaned: ${createdProjects.join(", ") || "none"}`);

console.log(
  fail === 0 ? "\nALL PASS" : `\n${fail} FAIL — read above`
);
process.exit(fail === 0 ? 0 : 1);

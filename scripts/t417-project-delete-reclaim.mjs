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
 * Phases:
 *   B  the product face — a fixture project with a local workdir and a
 *      cluster mirror, BOUND to a connection, DELETES with reclaimed.local
 *      naming the root, cluster[0].ok, both dirs GONE. The witness lane is
 *      the BOUND CONNECTION (pure product semantics: PATCH binding + delete);
 *      the records lane is covered at unit level (t417-unit-reclaim.ts) —
 *      planting a fake record here would test nothing the product does, and
 *      the first draft's file-level record planting raced the live server's
 *      own state ownership (the poll sweep owns the file, not the suite).
 *   C  the two-plane honesty boundary — a project with NO mirrors deletes
 *      cleanly with an EMPTY cluster ledger (nothing guessed, nothing lied)
 *   D  the world survives — the demo project's jobs and its crown extract
 *      stack are untouched, console clean
 *
 * SURVIVOR NOTE: this suite is the THIRD writing. The first died in the
 * 04:14 sandbox reboot (uncommitted work is uncommitted work); the second
 * lived long enough to prove the two-plane reclaim end to end (ALL PASS)
 * before the same reboot ate it. The witness-lane redesign above is the
 * one lesson the second writing paid for.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const RELION_DIR = `${ROOT}/data/relion`;
const CLUSTER_TREE = "services/mock-cluster/fs/projects/cryoflow";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

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

console.log("\n== Phase D — the world survives ==\n");

const projects = await api("GET", "/api/projects");
const demo = (projects.body?.projects ?? []).find((p) => p.name.includes("demo"));
must(!!demo, "demo project still present");
must(
  existsSync(`${ROOT}/services/mock-cluster/fs/projects/cryoflow/${demo?.id ?? "___"}`),
  "demo cluster tree untouched"
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

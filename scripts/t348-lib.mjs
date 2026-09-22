/**
 * CryoFlow E2E review harness — shared helpers (2026-09 code review).
 *
 * Drives the app's REST API exactly like the browser does (same headers),
 * talks to the mock cluster through its real SSH door (test-client.mjs),
 * and records evidence (cluster/local listings, manifests, slurm
 * accounting) for the reset/delete residue analysis.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The repo root, resolved from THIS script (scripts/) — the old absolute
// path pointed at a layout that no longer exists. CF_ROOT/CF_BASE env
// overrides keep the suite movable (e.g. a second checkout on another
// port) without editing the lib.
export const ROOT = process.env.CF_ROOT
  ?? fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
export const BASE = process.env.CF_BASE ?? "http://localhost:3000";
export const MOCK = `${ROOT}/services/mock-cluster`;
export const SH = { Origin: BASE, Referer: `${BASE}/` };
export const SHJ = { ...SH, "Content-Type": "application/json" };

export const CONN_ID = "e2e-conn";
export const CLUSTER_WORKROOT = "/projects/cryoflow"; // remoteRoot on the mock cluster

let passCount = 0;
let failCount = 0;
const failures = [];

export function must(cond, label, extra = "") {
  const ok = !!cond;
  if (ok) {
    passCount++;
    console.log(`  ✓ ${label}`);
  } else {
    failCount++;
    failures.push(`${label}${extra ? ` — ${extra}` : ""}`);
    console.log(`  ✗ FAIL: ${label}${extra ? ` — ${String(extra).slice(0, 400)}` : ""}`);
  }
  return ok;
}

export function summary(name) {
  console.log(`\n===== ${name}: ${passCount} passed, ${failCount} failed =====`);
  if (failures.length) {
    console.log("FAILURES:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  return { pass: passCount, fail: failCount, failures };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function api(url, init) {
  const r = await fetch(`${BASE}${url}`, init);
  let body = null;
  try {
    body = await r.json();
  } catch {
    /* non-json */
  }
  return { status: r.status, body };
}

/** Run a command on the mock cluster through the REAL SSH door. */
export function client(cmd, { timeoutMs = 60_000 } = {}) {
  const r = spawnSync("node", [`${MOCK}/test-client.mjs`, cmd], {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: r.status,
    out: (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim(),
  };
}

/** Cluster-side listing of a workdir (find, type|size|relpath) — the same
 * dialect remote-cleanup.ts rides, so our evidence matches the app's view. */
export function clusterFind(dir) {
  const r = client(
    `test -d '${dir}' || { echo __NO_DIR__; exit 0; }; ` +
      `find '${dir}' -mindepth 1 -maxdepth 4 \\( -type f -o -type l \\) -printf '%y|%s|%P\\n' 2>/dev/null | sort`
  );
  if (r.out === "__NO_DIR__") return null;
  return r.out
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [y, s, ...p] = l.split("|");
      return { type: y, size: Number(s), path: p.join("|") };
    });
}

/** Cluster-side byte total of a workdir's files. */
export function clusterBytes(dir) {
  const r = client(
    `test -d '${dir}' || { echo -1; exit 0; }; find '${dir}' -type f -printf '%s\\n' 2>/dev/null | awk '{s+=$1} END {print s+0}'`
  );
  const n = Number(r.out.trim().split("\n").pop());
  return Number.isFinite(n) ? n : null;
}

/** Local mirror listing (the app's data/relion tree). */
export function localFind(dir) {
  if (!existsSync(dir)) return null;
  const out = [];
  const visit = (d, rel, depth) => {
    if (depth > 5) return;
    let dirents;
    try {
      dirents = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    dirents.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of dirents) {
      const r2 = rel ? `${rel}/${e.name}` : e.name;
      try {
        if (e.isSymbolicLink()) out.push({ type: "l", size: 0, path: r2 });
        else if (e.isDirectory()) visit(path.join(d, e.name), r2, depth + 1);
        else if (e.isFile()) out.push({ type: "f", size: statSync(path.join(d, e.name)).size, path: r2 });
      } catch {
        /* vanished */
      }
    }
  };
  visit(dir, "", 0);
  return out;
}

export const localWorkdir = (projectId, job) =>
  `${ROOT}/data/relion/${projectId}/${job.type}_${job.id.slice(-8)}`;
export const remoteWorkdir = (projectId, job) =>
  `${CLUSTER_WORKROOT}/${projectId}/${job.type}_${job.id.slice(-8)}`;

/** The engine run-state file (jobId -> record). */
export function readEngineState() {
  try {
    return JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Surgical record editor (t343): read → mutate → write the engine ledger.
 * The app's readRuns cache keys on mtime/size, so an external write busts
 * it naturally. Only call BETWEEN dispatches (a live run's record is the
 * app's own truth — never edit under it).
 */
export function editEngineState(mutate) {
  const st = readEngineState();
  mutate(st);
  writeFileSync(`${ROOT}/data/engine-state.json`, JSON.stringify(st, null, 2));
  return st;
}

/** The remote manifest the Files tab rides. */
export function readManifest(workdir) {
  try {
    return JSON.parse(readFileSync(`${workdir}/.cf-remote-manifest.json`, "utf8"));
  } catch {
    return null;
  }
}

/** Poll /api/jobs (drives the server-side sweep + auto-start, like the browser
 * does) until the job reaches a terminal status. Returns the final job DTO +
 * every status observed on the way (queued/running evidence). */
export async function waitTerminal(jobId, { timeoutMs = 180_000 } = {}) {
  const t0 = Date.now();
  const seen = [];
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    const { body } = await api("/api/jobs", { headers: SH });
    const j = (body?.jobs ?? []).find((x) => x.id === jobId);
    if (j) {
      last = j;
      const st = j.status + (j.runRemote?.slurmState ? `/${j.runRemote.slurmState}` : "");
      if (seen[seen.length - 1] !== st) {
        seen.push(st);
        console.log(`    [${((Date.now() - t0) / 1000).toFixed(1)}s] ${st} ${j.progress ?? 0}%`);
      }
      if (j.status === "completed" || j.status === "failed") return { job: j, seen };
    }
    await sleep(2000);
  }
  return { job: last, seen, timeout: true };
}

export async function mkJob(body) {
  const { body: b, status } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (status !== 200 && status !== 201) throw new Error(`mkJob failed ${status}: ${JSON.stringify(b)}`);
  return b.job;
}

export async function mkEdge(fromJobId, toJobId, fromPort, toPort) {
  const { status, body } = await api("/api/edges", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
  });
  if (status !== 200 && status !== 201)
    throw new Error(`mkEdge ${fromPort}->${toPort} failed ${status}: ${JSON.stringify(body)}`);
  return true;
}

/** Run a job on the cluster with an explicit remote target. */
export async function runRemote(jobId, target) {
  const { status, body } = await api(`/api/jobs/${jobId}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ remote: target }),
  });
  return { status, body };
}

export const slurmTarget = (over = {}) => ({
  connectionId: CONN_ID,
  module: "relion/5.0.1",
  mode: "slurm",
  ...over,
});

/** cluster workdir slurm-accounting evidence */
export function slurmAccounting(grep = "") {
  const r = client(`cat $HOME/.slurm/accounting 2>/dev/null ${grep ? `| grep -- '${grep}'` : ""} | tail -40`);
  return r.out;
}

export function logSection(name) {
  console.log(`\n========== ${name} ==========`);
}

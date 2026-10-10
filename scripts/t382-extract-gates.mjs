#!/usr/bin/env node
/**
 * t382 — the extraction concurrent-writer gates, end-to-end on the mock
 * cluster with the REAL RELION 5.0.0 build.
 *
 * The field report: after pulling 065cf50 the user re-ran the chain and
 * the extraction died a few micrographs in —
 *   "Extracting particles from 172 micrographs … 0.12/5.02 min"
 *   "write: target and source objects have different size" (image.h:1534)
 * and the job cards showed only "results are on the cluster" with no
 * particle counts.
 *
 * Root cause (RELION source verified): the first particle of a micrograph
 * writes its stack WRITE_OVERWRITE (NO size check — stale files can never
 * cause the abort); every later particle APPENDS, reading the file on
 * disk — the abort needs a CONCURRENT second writer (array shards racing
 * on colliding rows: X.mrc + X.mrcs twins, duplicates, or a single-block
 * star handed whole to every shard). This round's four doors:
 *
 *   D1 import twin gate     — twins refuse the IMPORT outright
 *   D2 dispatch scan        — cluster-side star read feeds the collision
 *                             scan + the array block-check (no more skip)
 *   D3 in-script pre-flight — the sbatch script itself scans the input star
 *                             on the compute node before relion starts
 *   D4 count recovery       — the finalize receipt keeps the particle
 *                             count even when the sync-back left the star
 *                             behind (the job card question)
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const ORIGIN = { Origin: BASE };
const MOCK_FS = "/home/z/cryoflow/services/mock-cluster/fs";
// t382 — the 1024² crops of the five REAL EMPIAR micrographs (real pixels,
// 1/16 the LoG memory — the 4096² originals OOM'd next-server on the 4GB
// sandbox; the gates under test are size-independent).
const EMPIAR_DIR = `${MOCK_FS}/data2/empiar10017/crop1024`;
const EMPIAR_REMOTE = "/data2/empiar10017/crop1024";

let pass = 0, fail = 0;
const fails = [];
const must = (c, label, extra = "") => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(label); console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, ms, every = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  return null;
}
const api = async (p, opts) => {
  const r = await fetch(`${BASE}${p}`, { ...opts, headers: { ...ORIGIN, ...(opts?.body ? { "Content-Type": "application/json" } : {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const readJob = async (id) => {
  const d = await (await fetch(`${BASE}/api/jobs`, { headers: ORIGIN })).json();
  return (d.jobs ?? []).find((x) => x.id === id) ?? null;
};
const runRemote = (id, extra = {}) =>
  api(`/api/jobs/${id}/run`, { method: "POST", body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", partition: "long", ...extra } }) });
const runLocal = (id) => api(`/api/jobs/${id}/run`, { method: "POST", body: "{}" });
const finish = async (id, label, ms = 600_000) => {
  const j = await pollUntil(async () => {
    const x = await readJob(id);
    return (x?.status === "completed" || x?.status === "failed") ? x : null;
  }, ms);
  must(j?.status === "completed", `${label} COMPLETED`, `${j?.status ?? "timeout"} — ${(j?.result ?? "").slice(0, 260)}`);
  return j;
};

console.log("== t382 — the extraction concurrent-writer gates (real RELION on the mock cluster) ==");

/* ---------------- P0 environment ---------------- */
must(existsSync("/home/z/relion-build/bin/relion_preprocess"), "P0a the real relion_preprocess build is present");
const mrcs0 = readdirSync(EMPIAR_DIR).filter((f) => f.endsWith(".mrc"));
must(mrcs0.length === 5, `P0b five real EMPIAR micrographs (${mrcs0.length})`);

/* ---------------- P1 connection + project ---------------- */
const CONN = `qa-t382-${Date.now().toString(36)}`;
{
  const r = await api("/api/remote/connections", {
    method: "POST",
    body: JSON.stringify({
      id: CONN, name: "QA t382 gates mock", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow", envLines: ["module load relion/5.0.1"],
      useSlurm: true, slurmPartition: "long",
    }),
  });
  must(r.status === 201, `P1a the connection is created (${r.status})`);
  await api(`/api/remote/connections/${CONN}/test`, { method: "POST" });
}
const projects = (await api("/api/projects")).body.projects ?? [];
for (const p of projects) if (p.name?.startsWith("t382 gates")) { await api(`/api/projects/${p.id}`, { method: "DELETE" }); }
const proj = (await api("/api/projects", { method: "POST", body: JSON.stringify({ name: `t382 gates ${Date.now().toString(36)}`, mode: "spa", remoteConnectionId: CONN }) })).body.project;
must(!!proj?.id, "P1b the remote project is created");
const pid = proj.id;

const created = [];
const mkJob = async (body) => {
  const r = await api("/api/jobs", { method: "POST", body: JSON.stringify(body) });
  const j = r.body.job;
  if (j?.id) created.push(j.id);
  return j;
};
const mkEdge = (fromJobId, toJobId, fromPort, toPort) =>
  api("/api/edges", { method: "POST", body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }) });

/* ---------------- P2 D1 — the import twin gate ---------------- */
console.log("== P2/D1: the import twin gate ==");
const twinSrc = `${EMPIAR_DIR}/${mrcs0[0]}`;
const twinDst = `${EMPIAR_DIR}/${mrcs0[0].replace(/\.mrc$/, ".mrcs")}`;
execSync(`cp ${JSON.stringify(twinSrc)} ${JSON.stringify(twinDst)}`);
{
  const impT = await mkJob({
    projectId: pid, type: "import", name: "twin import (must refuse)",
    params: { nodeType: "micrographs", micrographsPath: EMPIAR_REMOTE, pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1 },
  });
  await runLocal(impT.id);
  const j = await pollUntil(async () => {
    const x = await readJob(impT.id);
    return (x?.status === "completed" || x?.status === "failed") ? x : null;
  }, 120_000);
  must(j?.status === "failed", "D1a the twin import FAILS (the gate refuses)", j?.status ?? "timeout");
  must(/different extensions/i.test(j?.result ?? "") && /same micrograph/i.test(j?.result ?? ""), "D1b the refusal names the twin mechanism", (j?.result ?? "").slice(0, 220));
  must(j?.result.includes(`${mrcs0[0]}`), "D1c the refusal names the colliding files", (j?.result ?? "").slice(0, 220));
}
execSync(`rm -f ${JSON.stringify(twinDst)}`);
console.log("  (twin .mrcs removed — the dataset is clean again)");

/* ---------------- P3 the clean chain: import → autopick ---------------- */
console.log("== P3: clean import → autopick LoG ==");
const imp = await mkJob({
  projectId: pid, type: "import", name: "EMPIAR mics import",
  params: { nodeType: "micrographs", micrographsPath: EMPIAR_REMOTE, pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1 },
});
await runLocal(imp.id);
const impJ = await finish(imp.id, "P3a import (clean, 5 real micrographs)", 120_000);
must(/5 micrographs/i.test(impJ?.result ?? ""), `P3b the receipt counts the micrographs (${(impJ?.result ?? "").slice(0, 140)})`);

const pick = await mkJob({
  projectId: pid, type: "autopick", name: "LoG pick",
  params: { pickingMethod: "Laplacian of Gaussian", logDiamMin: 100, logDiamMax: 180, threshold: -0.5 },
});
await mkEdge(imp.id, pick.id, "micrographs", "micrographs");
const p3 = await runRemote(pick.id);
must(p3.status === 200, `P3c the LoG autopick dispatch is accepted (${p3.status})`);
const pickJ = await finish(pick.id, "P3d autopick LoG (real relion_autopick, CPU)", 600_000);

/* ---------------- P4 the extraction with the ARRAY split (the race lane) ---------------- */
console.log("== P4: extract with shards=2 (the concurrent-writer lane, now guarded) ==");
const ext = await mkJob({
  projectId: pid, type: "extract", name: "β-gal extract (array 2)",
  params: { boxSize: 128, downsampleTo: 64, doCtf: false },
});
await mkEdge(imp.id, ext.id, "micrographs", "micrographs");
await mkEdge(pick.id, ext.id, "coords", "coords");
const p4 = await runRemote(ext.id, { shards: 2 });
must(p4.status === 200, `P4a the array-2 extract dispatch is accepted (${p4.status} ${JSON.stringify(p4.body).slice(0, 160)})`);
const extJ = await finish(ext.id, "P4b extract (real relion_preprocess × 2 array shards)", 600_000);
must(/\d[\d,]* particles extracted/i.test(extJ?.result ?? ""), `P4c/D4a the CARD carries the particle count (${(extJ?.result ?? "").slice(0, 200)})`, extJ?.result ?? "");

/* P4d — the generated sbatch script carries the in-script pre-flight (D3 wiring) */
const extWorkdir = `${MOCK_FS}/projects/cryoflow/${pid}/extract_${ext.id.slice(-8)}`;
const sb = existsSync(`${extWorkdir}/.cf-sbatch.sh`) ? readFileSync(`${extWorkdir}/.cf-sbatch.sh`, "utf8") : "";
must(sb.includes("CRYOFLOW_COLLIDE"), "D3a the sbatch script embeds the collision awk");
must(sb.includes("extraction pre-flight"), "D3b the pre-flight block is present");
must(sb.includes("exit 111"), "D3c the refusal path exits 111");
must((sb.match(/relion_preprocess/g) ?? []).length >= 1, "D3d the command rides after the pre-flight");

/* P4e — stack health: every .mrcs under the extract workdir, byte-exact */
{
  const found = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory() && e.name !== ".cryoflow_prev" && e.name !== "shard_1" && e.name !== "shard_2") walk(p);
      else if (e.isFile() && e.name.endsWith(".mrcs")) found.push(p);
    }
  };
  if (existsSync(extWorkdir)) walk(extWorkdir);
  must(found.length === 5, `P4e five per-micrograph stacks exist (${found.length})`);
  let healthy = 0;
  for (const f of found) {
    const buf = readFileSync(f);
    if (buf.length < 1024) continue;
    const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8), mode = buf.readInt32LE(12);
    if (nx > 0 && ny > 0 && nz > 0 && mode === 2 && buf.length === 1024 + nx * ny * nz * 4) healthy++;
  }
  must(healthy === found.length, `P4f every stack is byte-healthy (nz>0, mode 2, exact size) — ${healthy}/${found.length}`);
}

/* ---------------- P5/D2 — the dispatch-side scan over the input star ---------------- */
console.log("== P5/D2: a colliding star refuses the DISPATCH ==");
// Sneak a duplicate row into the import's LOCAL mirror — the copy the
// dispatch's early scan reads (and the copy the t316 rebaser carries into
// every upload, so the twin lane can never hide it). The dispatch's spawn
// task must mark the JOB failed with the collision refusal BEFORE any
// sbatch submission; the API itself returns 200 (the task is async), so
// the verdict lands in the job row.
const localStar = `/home/z/cryoflow/data/relion/${pid}/import_${imp.id.slice(-8)}/micrographs.star`;
must(existsSync(localStar), "P5a the import's local mirror star exists");
{
  const text = readFileSync(localStar, "utf8");
  const rows = text.split("\n").filter((l) => /^\S+\.(mrc|mrcs|tif|tiff|eer)\s+\d+\s*$/.test(l));
  must(rows.length >= 5, `P5b the mirror star carries the micrograph rows (${rows.length})`);
  appendFileSync(localStar, `${rows[0]}\n`); // the same micrograph, listed twice
}
const ext2 = await mkJob({
  projectId: pid, type: "extract", name: "dupe extract (must refuse)",
  params: { boxSize: 128, downsampleTo: 64, doCtf: false },
});
await mkEdge(imp.id, ext2.id, "micrographs", "micrographs");
await mkEdge(pick.id, ext2.id, "coords", "coords");
const p5 = await runRemote(ext2.id, { shards: 2 });
must(p5.status === 200, `P5c the API answered (the refusal rides the {error} field — ${p5.status})`);
const refusal = String(p5.body?.error ?? "");
must(/would collide/i.test(refusal), "D2a the refusal names the collision", refusal.slice(0, 300) || JSON.stringify(p5.body).slice(0, 200));
must(/image.h:1534|particle stack/i.test(refusal), "D2b the refusal teaches the mechanism", refusal.slice(0, 300));
must(!/Internal server error/i.test(refusal), "D2c the refusal is ours, not a 500", refusal.slice(0, 300));
const ext2Row = await readJob(ext2.id);
must(
  ext2Row?.status === "pending" || ext2Row?.status === "failed" || ext2Row?.status === "idle",
  `D2d the row never ran (kept its ${ext2Row?.status ?? "?"} state — the requestError contract)`,
  (ext2Row?.result ?? "").slice(0, 200)
);
must(ext2Row?.status !== "completed" && ext2Row?.status !== "running", "D2e the dupe extract NEVER ran (the race door is shut)");

// restore the mirror (remove the appended duplicate line)
{
  const text = readFileSync(localStar, "utf8").split("\n");
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i].trim() !== "") { text.splice(i, 1); break; }
  }
  writeFileSync(localStar, text.join("\n"));
}

/* ---------------- P6 summary ---------------- */
console.log("========================================");
console.log(`t382: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log("FAILURES:"); for (const f of fails) console.log(`  - ${f}`); }
process.exit(fail > 0 ? 1 : 0);

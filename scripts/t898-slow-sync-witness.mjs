#!/usr/bin/env node
/**
 * t898 — THE SLOW-SYNC WITNESS (the strip flash's change-path, live).
 *
 * The t897 code read proved the remote sync-back IS staged per-file (the
 * `for … await remoteDownload` loop) and that the KeyNumbersStrip's ring
 * fires on any changed stat between the inspector's refresh bumps. The
 * remaining condition was TIMING: the sync must span poll intervals.
 *
 * This witness supplies the timing with the mock's OWN torture lever
 * (`cat-slow-ms`: every `cat` exec whose command matches the substring
 * sleeps N ms first — the mock's t346 infrastructure, zero src change),
 * then dispatches a REAL remote topazdenoise run and records the outputs
 * route's summary at 300ms cadence: if the coverage leg climbs across
 * mid-run samples (0/4 → 1/4 → … → 4/4), the staged world is witnessed
 * AT THE DATA LEVEL the strip polls — the ring's fire is then a
 * component-level consequence (its diff logic was live-verified at rest
 * in t896; the browser leg is a separate, memory-gated production).
 *
 * The t533 cleanup law aboard: the lever file is the only write outside
 * the app's own DB/FS lanes — armed before, DISARMED after, and the
 * disarm is VERIFIED (existsSync false). The new job is a real job in
 * the real world (the run really ran); its receipt stays.
 *
 * Usage: node scripts/t898-slow-sync-witness.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const LEVER = join(ROOT, "services/mock-cluster/fs/home/cryo/.slurm/cat-slow-ms");
const PROVIDER = "cmv3x1a040004lt89yb3fmxq7"; // the witness job's micrographs parent
const SLOW_MS = 1500;
const POLL_MS = 300;
const MAX_MS = 150_000;

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const api = (method, path, body) => {
  // shell-honest: the JSON body rides single quotes, embedded single
  // quotes escaped the standard '\'' way (the quoted heredoc's cousin)
  const dataArg = body ? ` -d '${JSON.stringify(body).replace(/'/g, `'\\''`)}'` : "";
  const cmd = `curl -s -X ${method} -H "Origin: ${ORIGIN}" -H "Content-Type: application/json"${dataArg} "${BASE}${path}"`;
  const out = execSync(cmd, { encoding: "utf8", cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  try { return JSON.parse(out); } catch { return { raw: out.slice(0, 200) }; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("t898 slow-sync witness — the mock's own throttle, one real remote run\n");

/* 1 — arm the lever */
writeFileSync(LEVER, `${SLOW_MS} topazdenoise\n`, { flag: "wx" });
ok("1 the cat-slow-ms lever armed (1500ms on any topazdenoise cat)", existsSync(LEVER));

/* 2 — mint the job (type-direct, NO linkedJobId: a soft link MIRRORS the
 * linked job's type — the first mint came back a motioncorr because the
 * provider IS one; the witness wiring is a real pipeline EDGE instead) */
let job = null;
try {
  job = api("POST", "/api/jobs", {
    type: "topazdenoise",
    name: "t898 slow-sync witness",
    params: { topazDownscale: -1, topazWorkers: 1, topazArgs: "" },
  });
} catch (e) {
  ok("2 the job minted", false, String(e).slice(0, 120));
}
const jobId = job?.id ?? job?.job?.id ?? null;
ok("2 the job minted", !!jobId, JSON.stringify(job).slice(0, 160));

/* 2b — the pipeline edge (micrographs → the new denoise), the witness's
 * own wiring cloned */
let edge = null;
if (jobId) {
  try {
    edge = api("POST", "/api/edges", {
      fromJobId: PROVIDER,
      toJobId: jobId,
      fromPort: "micrographs",
      toPort: "micrographs",
    });
  } catch {
    edge = null;
  }
  ok("2b the micrographs edge drawn", !!edge && !edge.error, JSON.stringify(edge).slice(0, 160));
}

if (!jobId) {
  rmSync(LEVER, { force: true });
  console.log("lever disarmed, aborting");
  process.exit(1);
}

/* 3 — run it (bare POST — the t317 law routes a remote-bound project) */
let runResp = null;
try {
  runResp = api("POST", `/api/jobs/${jobId}/run`);
} catch (e) {
  runResp = { raw: String(e).slice(0, 200) };
}
console.log(`  run -> ${JSON.stringify(runResp).slice(0, 200)}`);

/* 4 — poll the outputs route at 300ms; record the summary's climb.
 * The summary's REAL shape (the t892 chip's contract):
 *   summary.coverage = { covered, total, note? } — the note speaks the
 *   cluster-held remainder honestly ("N of 4 synced home — M live on the
 *   cluster only"). The job's status rides the ROSTER (the outputs
 *   route's `status` is its own "ok", not the job's). */
const samples = [];
const t0 = Date.now();
let done = false;
while (Date.now() - t0 < MAX_MS && !done) {
  const o = api("GET", `/api/jobs/${jobId}/outputs`);
  let jobStatus = null;
  if (samples.length % 4 === 0 || done) {
    const roster = api("GET", "/api/jobs");
    const mine = (roster?.jobs ?? roster ?? []).find?.((j) => j.id === jobId);
    jobStatus = mine?.status ?? null;
  }
  const cov = o?.summary?.coverage ?? null;
  samples.push({
    t: Date.now() - t0,
    routeStatus: o?.status ?? null,
    jobStatus,
    files: Array.isArray(o?.files) ? o.files.length : null,
    covered: cov?.covered ?? null,
    total: cov?.total ?? null,
    note: cov?.note ?? null,
  });
  // t898 — the equality guard must be NON-NULL: with cov null,
  // `cov?.covered === cov?.total` is `undefined === undefined` — true — and
  // the loop would exit after one sample (live-caught on the second ride).
  if (jobStatus === "completed" || (cov != null && cov.covered != null && cov.covered === cov.total)) done = true;
  await sleep(POLL_MS);
}

/* 5 — disarm the lever, VERIFIED */
rmSync(LEVER, { force: true });
ok("5 the lever disarmed (existsSync false — verified)", !existsSync(LEVER));

/* 6 — the receipt: print the climb, judge the staged world */
console.log(`\n  ${samples.length} samples over ${((samples[samples.length - 1]?.t ?? 0) / 1000) | 0}s`);
let last = "";
for (const s of samples) {
  const line = `${s.covered}/${s.total ?? "?"}${s.note ? " (note)" : ""}`;
  if (line !== last) {
    console.log(`  t=${String(s.t).padStart(6)}ms job=${String(s.jobStatus ?? "?").padEnd(10)} covered=${line}`);
    last = line;
  }
}
writeFileSync(join(ROOT, "shots-qa/t898-slow-sync-witness.json"), JSON.stringify({ jobId, SLOW_MS, POLL_MS, samples, at: new Date().toISOString() }, null, 2) + "\n");

/* the verdict: the coverage must CLIMB across mid-run samples — at least
 * three distinct covered values, in MONOTONE order, and the climb's own
 * honest note (the cluster-held remainder) must speak mid-run */
const climb = samples.filter((s) => s.covered != null).map((s) => s.covered);
const distinctVals = [...new Set(climb)];
let monotone = true;
for (let i = 1; i < climb.length; i++) if (climb[i] < climb[i - 1]) monotone = false;
const noted = samples.some((s) => s.note && s.covered != null && s.covered < (s.total ?? 0));
ok("6 the coverage climbed across >= 3 distinct values (the staged world at the strip's own data source)", distinctVals.length >= 3, `distinct: ${distinctVals.join(" → ")}`);
ok("6b the climb is monotone (files only land, never un-land)", monotone, climb.slice(0, 20).join(","));
ok("6c the mid-run samples speak the honest note (the cluster-held remainder)", noted);
const final = samples[samples.length - 1];
ok("6d the final state is fully covered", final?.covered != null && final.covered === final.total, `${final?.covered}/${final?.total}`);

console.log(`\nt898 slow-sync witness: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

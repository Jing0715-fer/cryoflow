#!/usr/bin/env node
// t1132-heal-motioncorr-pixels.mjs — the pixels' resurrection ride.
//
// THE DEFECT (found live this window): relion_run_motioncorr's reader
// gated on os.path.isabs alone — the engine family's odd one out — so the
// import star's project-relative movie rows (the pipeliner dialect the
// engine's OWN output rows speak) never read: all 24 movies fell to the
// flat-zero fallback, the cluster-side corrected micrographs carried
// all-zero payloads, the autopick's real dark-blob reader found nothing in
// zeros and retired to its legacy synthetic grid, and Extract's REAL crops
// cropped REAL boxes of ZERO pixels — 24 structurally perfect, pixel-dead
// stacks whose quick-look montage renders black tiles.
//
// THE RIDE (the demo-chain-resurrect precedent — the product's OWN run
// door, never hand-written receipts):
//   1. discover the demo project, the motioncorr + extract jobs, and the
//      Mock Cluster connection LIVE (no fossil ids);
//   2. the BEFORE witness — payload stats of a corrected micrograph and an
//      extract stack, read from the bytes;
//   3. clear the zero artifacts (cluster-side extract extra/*.mrcs and the
//      two fetched local copies) so the engines regenerate, not skip;
//   4. re-run motioncorr through POST /api/jobs/:id/run, poll to
//      completion, then the MID-RIDE GATE: the corrected payload must be
//      non-zero — abort loudly rather than feed zeros downstream;
//   5. re-run extract the same way, poll, verify: non-zero stack payloads,
//      nz=4, the star's promise still 96 rows, the listing still 24 cards;
//   6. the AFTER witness — the same stats readbacks, healed.
//
// The world's job count stays 15 (a re-run refreshes the record; it does
// not mint a job). The autopick stars stand — the synthetic pick dialect
// is that stub's own contract, and the extract's 96-row promise must not
// move under this ride.

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "fs";
import http from "node:http";

const BASE = "http://localhost:3000";
const CLUSTER_ROOT = "/home/z/my-project/services/mock-cluster/fs/projects/cryoflow";
const LOCAL_ROOT = "/home/z/my-project/data/relion";

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiOnce(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const req = http.request(
      `${BASE}${url}`,
      {
        method,
        headers: {
          ...SH,
          ...(payload !== null ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => { text += c; });
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(text); } catch { /* non-JSON */ }
          resolve({ status: res.statusCode ?? 0, body: json });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error(`ride api timeout (no byte in 30s) on ${method} ${url}`)));
    if (payload !== null) req.write(payload);
    req.end();
  });
}

async function api(method, url, body, attempt = 0) {
  try {
    return await apiOnce(method, url, body);
  } catch (e) {
    if (attempt >= 30) throw e;
    if (attempt === 0) console.log(`  (lane hiccup — retrying ${url})`);
    await sleep(3000);
    return api(method, url, body, attempt + 1);
  }
}

/* ------------------------------------------------------------------ */
/* MRC payload stats — the pixels' own witness (node-native)            */
/* ------------------------------------------------------------------ */

function mrcPayloadStats(file) {
  const buf = readFileSync(file);
  if (buf.length < 1024) return null;
  if (buf.subarray(208, 212).toString("ascii") !== "MAP ") return null;
  const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8);
  const mode = buf.readInt32LE(12);
  const nsymbt = buf.readInt32LE(92);
  const n = nx * ny * nz;
  const off = 1024 + nsymbt;
  if (buf.length < off + n * 4) return null;
  // stride sample: every 8th float — a zero payload reads all-zero at any
  // stride; a real payload shows its spread cheaply
  let nonZero = 0, sampled = 0, min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < n; i += 8) {
    const v = buf.readFloatLE(off + i * 4);
    if (Math.abs(v) > 1e-6) nonZero++;
    sampled++;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return {
    nx, ny, nz, mode,
    sampled, nonZero,
    nonZeroPct: (nonZero / sampled) * 100,
    min, max, mean: sum / sampled,
  };
}

const fmt = (s) =>
  s == null
    ? "unreadable"
    : `${s.nx}x${s.ny}x${s.nz} mode=${s.mode} nonzero=${s.nonZero}/${s.sampled} (${s.nonZeroPct.toFixed(1)}%) min=${s.min.toFixed(3)} max=${s.max.toFixed(3)} mean=${s.mean.toFixed(4)}`;

/* ------------------------------------------------------------------ */
/* 1. the live discovery                                                */
/* ------------------------------------------------------------------ */

console.log("== step 1: the live discovery ==");
const conns = (await api("GET", "/api/remote/connections")).body?.connections ?? [];
const conn = conns.find((c) => /mock/i.test(c.name ?? "")) ?? conns[0];
must(conn != null, `the Mock Cluster connection answers (${conn?.name ?? "none"}, id ${conn?.id ?? "-"})`);

const projects = (await api("GET", "/api/projects")).body;
const proj = Array.isArray(projects) ? projects.find((p) => /demo/i.test(p.name ?? "")) : projects?.projects?.find?.((p) => /demo/i.test(p.name ?? ""));
const projId = proj?.id;
must(projId != null, `the demo project answers (${proj?.name ?? "?"} ${projId ?? ""})`);

const jobs = (await api("GET", "/api/jobs")).body?.jobs ?? [];
const mine = jobs.filter((j) => j.projectId === projId);
const motioncorr = mine.find((j) => j.type === "motioncorr");
const extract = mine.find((j) => j.type === "extract");
must(motioncorr != null, `the motioncorr job answers (${motioncorr?.id ?? "?"}, ${motioncorr?.status ?? "?"})`);
must(extract != null, `the extract job answers (${extract?.id ?? "?"}, ${extract?.status ?? "?"})`);

const clusterDir = `${CLUSTER_ROOT}/${projId}`;
const localDir = `${LOCAL_ROOT}/${projId}`;
must(existsSync(clusterDir), `the cluster project root stands (${clusterDir.replace("/home/z/my-project/", "")})`);

/* ------------------------------------------------------------------ */
/* 2. the BEFORE witness                                                */
/* ------------------------------------------------------------------ */

console.log("== step 2: the BEFORE witness (the pixels as found) ==");
const beforeMic = mrcPayloadStats(`${clusterDir}/motioncorr_1vdd3im1/micrographs/mic_001.mrc`);
const beforeStack = mrcPayloadStats(`${clusterDir}/extract_rnjjp9yr/extra/mic_001_extract.mrcs`);
console.log(`  corrected mic_001: ${fmt(beforeMic)}`);
console.log(`  extract stack:     ${fmt(beforeStack)}`);
must(beforeMic != null && beforeMic.nonZero === 0, "BEFORE: the corrected micrograph's payload is all-zero (the defect, on the record)");
must(beforeStack != null && beforeStack.nonZero === 0, "BEFORE: the extract stack's payload is all-zero (the defect, on the record)");

/* ------------------------------------------------------------------ */
/* 3. clear the zero artifacts (the engines regenerate, not skip)       */
/* ------------------------------------------------------------------ */

console.log("== step 3: clear the zero artifacts ==");
const extraDir = `${clusterDir}/extract_rnjjp9yr/extra`;
let clearedCluster = 0;
if (existsSync(extraDir)) {
  for (const f of readdirSync(extraDir)) {
    if (f.endsWith(".mrcs")) {
      rmSync(`${extraDir}/${f}`);
      clearedCluster++;
    }
  }
}
const localExtra = `${localDir}/extract_rnjjp9yr/extra`;
let clearedLocal = 0;
if (existsSync(localExtra)) {
  for (const f of readdirSync(localExtra)) {
    if (f.endsWith(".mrcs")) {
      rmSync(`${localExtra}/${f}`);
      clearedLocal++;
    }
  }
}
must(clearedCluster === 24, `the cluster-side zero stacks cleared (${clearedCluster}/24)`);
must(clearedLocal <= 2, `the local fetched pair cleared (${clearedLocal}) — the fetch door re-arms`);

/* ------------------------------------------------------------------ */
/* 4. re-run motioncorr through the product's run door                  */
/* ------------------------------------------------------------------ */

console.log("== step 4: the motioncorr re-run (the product's own door) ==");
const runBody = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };
const r1 = await api("POST", `/api/jobs/${motioncorr.id}/run`, runBody);
must(r1.status === 200 || r1.status === 409, `the run door answers (${r1.status})`);

const pollJob = async (id, label, budgetMs) => {
  const t0 = Date.now();
  for (;;) {
    await sleep(5000);
    const js = (await api("GET", "/api/jobs")).body?.jobs ?? [];
    const j = js.find((x) => x.id === id);
    const st = j?.status;
    if (st === "completed") return true;
    if (st === "failed") { console.log(`  FAIL: ${label} run failed`); return false; }
    if (Date.now() - t0 > budgetMs) { console.log(`  FAIL: ${label} poll budget spent (still ${st})`); return false; }
    process.stdout.write(`  … ${label} ${st} (${Math.round((Date.now() - t0) / 1000)}s)\r`);
  }
};

const okMc = await pollJob(motioncorr.id, "motioncorr", 240_000);
must(okMc, "motioncorr re-run completed");

console.log("== step 4b: THE MID-RIDE GATE (the pixels must be alive before extract eats) ==");
const afterMc = mrcPayloadStats(`${clusterDir}/motioncorr_1vdd3im1/micrographs/mic_001.mrc`);
console.log(`  corrected mic_001: ${fmt(afterMc)}`);
must(afterMc != null && afterMc.nonZero > 0, "GATE: the corrected micrograph's payload is ALIVE (non-zero)");
if (fail > 0) {
  console.log("THE RIDE ABORTS AT THE GATE — extract must not eat from dead pixels.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 5. re-run extract through the same door                              */
/* ------------------------------------------------------------------ */

console.log("== step 5: the extract re-run (REAL crops of REAL pixels) ==");
const r2 = await api("POST", `/api/jobs/${extract.id}/run`, runBody);
must(r2.status === 200 || r2.status === 409, `the run door answers (${r2.status})`);
const okEx = await pollJob(extract.id, "extract", 240_000);
must(okEx, "extract re-run completed");

console.log("== step 5b: the AFTER witness ==");
const afterStack = mrcPayloadStats(`${clusterDir}/extract_rnjjp9yr/extra/mic_001_extract.mrcs`);
const afterStack2 = mrcPayloadStats(`${clusterDir}/extract_rnjjp9yr/extra/mic_024_extract.mrcs`);
console.log(`  extract stack 001: ${fmt(afterStack)}`);
console.log(`  extract stack 024: ${fmt(afterStack2)}`);
must(afterStack != null && afterStack.nonZero > 0, "AFTER: the extract stack's payload is ALIVE (non-zero)");
must(afterStack2 != null && afterStack2.nonZero > 0, "AFTER: the last stack's payload is ALIVE too");
must(afterStack != null && afterStack.nz === 4 && afterStack.nx === 64, "AFTER: the stack's shape stands (64x64x4, the same promise)");

const star = readFileSync(`${clusterDir}/extract_rnjjp9yr/particles.star`, "utf8");
const rows = star.split(/\r?\n/).filter((l) => l.includes("@"));
must(rows.length === 96, `the star's promise stands (96 rows, found ${rows.length})`);

const outs = (await api("GET", `/api/jobs/${extract.id}/outputs`)).body;
const cards = (outs?.files ?? []).filter((f) => f.name.endsWith(".mrcs"));
must(cards.length === 24, `the listing still carries 24 stack cards (${cards.length})`);
must(cards.every((f) => f.remote === true), "the cards are remote again (the local pair was cleared — the fetch door re-arms)");

console.log(`\n${fail === 0 ? "THE RIDE IS GREEN — the pixels are born." : `THE RIDE CARRIES ${fail} FAIL(S).`}`);
process.exit(fail === 0 ? 0 : 1);

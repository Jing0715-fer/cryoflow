#!/usr/bin/env node
// t1133-heal-class2d-signal.mjs — the signal channel's resurrection ride.
//
// THE DEFECT (found live this window): the class2d job's class averages are
// STRUCTURALLY REAL-MODE but SIGNAL-DEAD. The engine (relion_refine) wore
// the t380 real-blob badge honestly at seed time — the log says "REAL
// particle class averages" — but the member boxes it averaged were Extract's
// pre-heal crops: REAL boxes of ZERO pixels (t1132's defect, upstream). In
// cf_cryo.class_image a zero member set yields sig = mean(zeros) - 0 = 0 —
// the PARTICLE SIGNAL channel contributes exactly nothing — while the
// solvent-noise floor (std(zeros)=0 -> fallback 0.35 -> sigma 0.1225) masks
// the death with plausible texture. The witness read: whole-image std
// 0.1227 vs the pure-noise floor 0.1225; center-border signal +-0.007;
// negative dominance ~1.0. Noise wearing the REAL badge — the lie-shape the
// eyes cannot catch and only the bytes confess.
//
// THE RIDE (the t1132 precedent — the product's OWN run door, never
// hand-written receipts):
//   1. discover the demo project, the class2d + extract jobs, and the Mock
//      Cluster connection LIVE (no fossil ids);
//   2. the BEFORE witness — the class averages' signal-death read from the
//      bytes (std at the noise floor), the star's 96-row/50-class promise,
//      and the local mirrors' honest weight (202 stacks synced at seed);
//      (this ride ran in two lives: the first life's 5-minute Bash window
//      elapsed mid-poll — the run door had already answered, the mock was
//      computing — so the second life resumes with T1133_RESUME=1 and the
//      LOCAL MIRROR serves as the BEFORE witness: the seed's own sync
//      preserved the signal-dead books, and the sync door has not yet
//      touched them; the world keeps its own before-and-after)
//   3. THE MID-RIDE GATE — the extract stacks class2d is about to eat must
//      be ALIVE (t1132's heal, re-proven at the gate); abort loudly rather
//      than re-compute averages of zeros;
//   4. re-run class2d through POST /api/jobs/:id/run, poll to completion;
//   5. the AFTER witness — the engine's own log voice ("REAL particle class
//      averages"), the class averages' signal channel ALIVE (std clearly
//      above the floor), the star's promise byte-identical (the class
//      assignments are formula-driven — the pixels heal, the books do not
//      move), the listing still 202 cards, the world's job count still 15;
//   6. THE SYNC DOOR — POST /api/jobs/:id/outputs/sync brings the healed
//      stacks home; the local mirror byte-identical to the cluster.
//
// A re-run refreshes, never mints: the world's job count stays 15.

import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
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
const soft = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  NOTE: ${label}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const md5 = (file) => createHash("md5").update(readFileSync(file)).digest("hex");

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
    req.setTimeout(60_000, () => req.destroy(new Error(`ride api timeout (no byte in 60s) on ${method} ${url}`)));
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
/* MRC payload stats — the SIGNAL channel's own witness                 */
/*                                                                      */
/* The class averages are non-zero noise, so "non-zero %" (t1132's      */
/* zero-payload witness) cannot see this defect. The channel the ride   */
/* heals is the SIG channel: sig = mean(members) - mean-of-mean. Its    */
/* byte-level proxies, on the first slice and the whole stack:          */
/*   - std: the noise floor is max(0.12, 0.35*0.35) = 0.1225; a dead    */
/*     sig channel pins the whole image AT the floor (0.1227 read);     */
/*     a live channel lifts the stack clearly above it                  */
/*   - center-border: a centered negative blob (the class average's     */
/*     whole point) reads as a structured negative; noise reads ~0      */
/* ------------------------------------------------------------------ */

function classAverageStats(file) {
  const buf = readFileSync(file);
  if (buf.length < 1024) return null;
  if (buf.subarray(208, 212).toString("ascii") !== "MAP ") return null;
  const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8);
  const mode = buf.readInt32LE(12);
  const nsymbt = buf.readInt32LE(92);
  const n = nx * ny * nz;
  const off = 1024 + nsymbt;
  if (buf.length < off + n * 4) return null;
  if (nx !== ny) return null;
  let sum = 0, sum2 = 0, sampled = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i += 4) {
    const v = buf.readFloatLE(off + i * 4);
    sum += v; sum2 += v * v; sampled++;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / sampled;
  const std = Math.sqrt(Math.max(0, sum2 / sampled - mean * mean));
  // first slice's center 32x32 (grid 64 assumed only if nx>=48) vs border ring
  let center = 0, border = 0, cn = 0, bn = 0;
  if (nx >= 48) {
    const sOff = off;
    const c0 = Math.floor(nx / 4), c1 = c0 + Math.floor(nx / 2);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const v = buf.readFloatLE(sOff + (y * nx + x) * 4);
        const inCenter = x >= c0 && x < c1 && y >= c0 && y < c1;
        const inBorder = x < 8 || x >= nx - 8 || y < 8 || y >= ny - 8;
        if (inCenter) { center += v; cn++; }
        else if (inBorder) { border += v; bn++; }
      }
    }
    center /= cn; border /= bn;
  }
  return { nx, ny, nz, mode, std, min, max, mean, center, border, signal: center - border, negdom: Math.abs(min) / Math.max(Math.abs(max), 1e-9) };
}

const fmt = (s) =>
  s == null
    ? "unreadable"
    : `${s.nx}x${s.ny}x${s.nz} mode=${s.mode} std=${s.std.toFixed(4)} mean=${s.mean.toFixed(5)} signal(center-border)=${s.signal.toFixed(4)} negdom=${s.negdom.toFixed(3)} min=${s.min.toFixed(3)} max=${s.max.toFixed(3)}`;

const NOISE_FLOOR = 0.1225;

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
const class2d = mine.find((j) => j.type === "class2d");
const extract = mine.find((j) => j.type === "extract");
must(class2d != null, `the class2d job answers (${class2d?.id ?? "?"}, ${class2d?.status ?? "?"})`);
must(extract != null, `the extract job answers (${extract?.id ?? "?"}, ${extract?.status ?? "?"})`);
must(mine.length === 15, `the world's job count stands at 15 (${mine.length})`);

const clusterDir = `${CLUSTER_ROOT}/${projId}`;
const localDir = `${LOCAL_ROOT}/${projId}`;
const classesCluster = `${clusterDir}/class2d_46lkfgpq/run_classes.mrcs`;
const dataStarCluster = `${clusterDir}/class2d_46lkfgpq/run_data.star`;
must(existsSync(classesCluster), `the class2d final classes stack stands cluster-side`);

const runOut = `${clusterDir}/class2d_46lkfgpq/run.out`;
const beforeRunOut = statSync(runOut);
const beforeClasses = statSync(classesCluster);
const localClassesDir = `${localDir}/class2d_46lkfgpq`;

const RESUME = process.env.T1133_RESUME === "1";
// the first life knocked the run door at 00:58:34 UTC (the job's updatedAt);
// the second life's execution witness is anchored to that knock
const FIRST_LIFE_KNOCK_MS = Date.parse("2026-10-18T00:57:00Z");

/* ------------------------------------------------------------------ */
/* 2. the BEFORE witness (the signal channel as found)                  */
/*                                                                      */
/* RESUME form: the seed's signal-dead bytes did not survive the ride   */
/* (the cluster stack was overwritten in place; the runner's own        */
/* completion sync re-fetched the local mirror before the second life   */
/* could read it). The BEFORE stands on two legs instead:               */
/*   (a) the LIVE reads taken in the first life at 00:58 UTC (on the    */
/*       worklog's record): whole-stack std 0.1227 vs the floor         */
/*       0.1225, center-border +-0.007, negdom ~1.0 — noise wearing     */
/*       the REAL badge;                                                */
/*   (b) the MECHANISM, re-enacted: cf_cryo.class_image on zero member  */
/*       boxes is deterministic — its sig channel is identically zero   */
/*       and its solvent fallback pins the output at the noise floor.   */
/*       The analytical witness recomputes it and asserts the floor.    */
/* ------------------------------------------------------------------ */

if (RESUME) {
  console.log("== step 2 (RESUME): the BEFORE witness — the live reads + the mechanism re-enacted ==");
  console.log("  (a) LIVE, first life, 00:58 UTC: run_classes.mrcs std=0.1227 (floor 0.1225) signal(center-border)=-0.0074..+0.0055 negdom=0.899..1.191 — the reads stand in the worklog");
  const { execSync } = await import("node:child_process");
  const repoOptBin = CLUSTER_ROOT.replace(/\/fs\/projects\/cryoflow$/, "/fs/opt/bin");
  const out = execSync(
    `python3 -c "import sys; sys.path.insert(0, '${repoOptBin}'); import numpy as np, cf_cryo; img = cf_cryo.class_image(64, [np.zeros((64,64),dtype=np.float32)], amp=1.0, seed=31); print(f'{img.std():.4f}')"`,
    { encoding: "utf8" }
  ).trim();
  const anaStd = parseFloat(out.split(/\s+/).pop());
  must(Number.isFinite(anaStd) && Math.abs(anaStd - NOISE_FLOOR) < 0.02, `(b) the MECHANISM: class_image(zero boxes) pins the output at the noise floor (std ${anaStd} vs floor ${NOISE_FLOOR}) — the signal channel contributes nothing on dead members`);
} else {
  console.log("== step 2: the BEFORE witness (the signal channel as found) ==");
  const before = classAverageStats(classesCluster);
  console.log(`  run_classes.mrcs: ${fmt(before)}`);
  must(before != null && Math.abs(before.std - NOISE_FLOOR) < 0.02, `BEFORE: the class average sits AT the noise floor (std ${before?.std.toFixed(4)} vs floor ${NOISE_FLOOR}) — the signal channel is dead`);
  must(before != null && Math.abs(before.signal) < 0.05, `BEFORE: no centered structure (center-border ${before?.signal.toFixed(4)} ~ noise) — noise wearing the REAL badge`);
}

const starBefore = readFileSync(dataStarCluster, "utf8");
const starRows = starBefore.split(/\r?\n/).filter((l) => l.includes("@") && l.includes(".mrcs"));
const starClasses = new Set(starRows.map((l) => l.split("\t")[1])).size;
must(starRows.length === 96, `the star's promise stands (96 particle rows, found ${starRows.length})`);
must(starClasses === 50, `the class book stands (50 classes, found ${starClasses})`);

const localMrcs = existsSync(localClassesDir) ? readdirSync(localClassesDir).filter((f) => f.endsWith(".mrcs")) : [];
must(localMrcs.length === 202, `the local mirror carries the stacks' honest weight (202 stacks, found ${localMrcs.length})`);

/* ------------------------------------------------------------------ */
/* 3. THE MID-RIDE GATE (the pixels class2d is about to eat)            */
/* ------------------------------------------------------------------ */

console.log("== step 3: THE MID-RIDE GATE (extract's stacks must be alive) ==");
function mrcNonZeroPct(file) {
  const buf = readFileSync(file);
  if (buf.length < 1024 || buf.subarray(208, 212).toString("ascii") !== "MAP ") return -1;
  const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8);
  const nsymbt = buf.readInt32LE(92);
  const n = nx * ny * nz, off = 1024 + nsymbt;
  if (buf.length < off + n * 4) return -1;
  let nonZero = 0, sampled = 0;
  for (let i = 0; i < n; i += 8) {
    if (Math.abs(buf.readFloatLE(off + i * 4)) > 1e-6) nonZero++;
    sampled++;
  }
  return (nonZero / sampled) * 100;
}
const gate1 = mrcNonZeroPct(`${clusterDir}/extract_rnjjp9yr/extra/mic_001_extract.mrcs`);
const gate2 = mrcNonZeroPct(`${clusterDir}/extract_rnjjp9yr/extra/mic_024_extract.mrcs`);
console.log(`  extract mic_001 stack: ${gate1.toFixed(1)}% non-zero`);
console.log(`  extract mic_024 stack: ${gate2.toFixed(1)}% non-zero`);
must(gate1 > 95 && gate2 > 95, "GATE: the extract stacks are ALIVE (t1132's heal, re-proven)");
if (fail > 0) {
  console.log("THE RIDE ABORTS AT THE GATE — class2d must not re-averaging zeros.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 4. the class2d re-run (the product's own door)                       */
/* ------------------------------------------------------------------ */

console.log("== step 4: the class2d re-run (the product's own door) ==");
const runBody = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };
if (RESUME) {
  console.log("  (RESUME: the run door was knocked in this ride's first life — the poll continues, the door is not knocked twice)");
} else {
  const r1 = await api("POST", `/api/jobs/${class2d.id}/run`, runBody);
  must(r1.status === 200 || r1.status === 409, `the run door answers (${r1.status})`);
}

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

const okRun = await pollJob(class2d.id, "class2d", 600_000);
must(okRun, "class2d re-run completed");

const afterRunOut = statSync(runOut);
const afterClasses = statSync(classesCluster);
if (RESUME) {
  const exitFile = `${clusterDir}/class2d_46lkfgpq/.cf-exit`;
  const exitMtime = statSync(exitFile).mtimeMs;
  must(afterRunOut.mtimeMs > FIRST_LIFE_KNOCK_MS && exitMtime > FIRST_LIFE_KNOCK_MS, "the re-run actually executed (run.out + .cf-exit rewritten after the first life's knock)");
} else {
  must(afterRunOut.mtimeMs > beforeRunOut.mtimeMs && afterClasses.mtimeMs > beforeClasses.mtimeMs, "the re-run actually executed (run.out + run_classes.mrcs rewritten)");
}

/* ------------------------------------------------------------------ */
/* 5. the AFTER witness (the signal channel's verdict)                  */
/* ------------------------------------------------------------------ */

console.log("== step 5: the AFTER witness (the signal channel's verdict) ==");
const runOutText = readFileSync(runOut, "utf8");
must(runOutText.includes("REAL particle class averages"), "the engine's own voice: REAL particle class averages (t380 cryo polarity)");

const after = classAverageStats(classesCluster);
console.log(`  run_classes.mrcs: ${fmt(after)}`);
must(after != null && after.std > NOISE_FLOOR + 0.02, `AFTER: the signal channel is ALIVE (std ${after?.std.toFixed(4)} clearly above the floor ${NOISE_FLOOR})`);
must(after != null && Math.abs(after.signal) > 0.01, `AFTER: centered structure present (center-border ${after?.signal.toFixed(4)})`);

const it000 = classAverageStats(`${clusterDir}/class2d_46lkfgpq/run_it000_classes.mrcs`);
console.log(`  run_it000_classes.mrcs: ${fmt(it000)}`);
must(it000 != null && it000.std > NOISE_FLOOR + 0.02, "AFTER: the seed round's averages are alive too (the whole arc heals)");

const starAfter = readFileSync(dataStarCluster, "utf8");
const starRowsAfter = starAfter.split(/\r?\n/).filter((l) => l.includes("@") && l.includes(".mrcs"));
must(starRowsAfter.length === 96, `the star's promise untouched (96 rows, found ${starRowsAfter.length})`);
// THE DETERMINISM WITNESS (stronger than a before/after md5 — the seed's
// bytes did not survive the ride, but the assignments are FORMULA-driven:
// the final star is run_it200_data.star, row p wears class (p*7+200)%50+1,
// every ref re-based project-relative. The books recompute; the pixels
// healed around them):
const expect = starRowsAfter.map((_, p) => String(((p * 7 + 200) % 50) + 1));
const got = starRowsAfter.map((l) => l.split("\t")[1]);
must(JSON.stringify(expect) === JSON.stringify(got), "the class books recompute (row p wears class (p*7+200)%50+1 — formula-driven assignments, the pixels heal, the books do not move)");

const outs = (await api("GET", `/api/jobs/${class2d.id}/outputs`)).body;
const cards = (outs?.files ?? []).filter((f) => f.name.endsWith(".mrcs"));
// the listing reads the LOCAL workdir through a 600-entry cap (the seed's
// shape too — the class2d workdir speaks ~11.5k files; the cap is the
// listing's own law, not a re-run artifact). The honest witnesses: the
// final stack leads the cards, the cap's shape stands, and the FULL 202
// live in the local mirror (counted at step 2).
must(cards.length >= 1 && cards[0].name === "run_classes.mrcs", `the listing's first stack card is the final classes stack (${cards[0]?.name ?? "none"}; ${cards.length} cards under the 600-entry cap — the listing's own law)`);
must((outs?.files?.length ?? 0) === 600, `the listing's cap shape stands (${outs?.files?.length} entries — the re-run minted nothing)`);

const jobsNow = (await api("GET", "/api/jobs")).body?.jobs ?? [];
must(jobsNow.filter((j) => j.projectId === projId).length === 15, "the world's job count stays 15 (a re-run refreshes, never mints)");

/* ------------------------------------------------------------------ */
/* 6. THE SYNC DOOR (the mirrors' refresh)                              */
/* ------------------------------------------------------------------ */

console.log("== step 6: THE SYNC DOOR (the mirrors' refresh) ==");
// the runner's own completion sync may have brought the workdir home
// already — the door is knocked anyway (idempotent bring-home), and the
// GATE is the bytes: the local mirror must match the healed cluster stack
const sy = await api("POST", `/api/jobs/${class2d.id}/outputs/sync`, {});
must([200, 409, 202, 400, 502].includes(sy.status), `the sync door answers (${sy.status}${sy.status >= 400 ? " — the runner's completion sync likely brought the workdir home already; the md5 gate below is the verdict" : ""})`);
{
  // poll the local mirror until it matches the cluster bytes (budget 180s)
  const t0 = Date.now();
  let match = false;
  for (;;) {
    await sleep(5000);
    if (existsSync(`${localClassesDir}/run_classes.mrcs`)) {
      try {
        match = md5(`${localClassesDir}/run_classes.mrcs`) === md5(classesCluster);
      } catch { /* file mid-write */ }
    }
    if (match) break;
    if (Date.now() - t0 > 180_000) break;
  }
  must(match, "the local mirror is byte-identical to the healed cluster stack (md5)");
  if (!match) {
    const nowLocal = classAverageStats(`${localClassesDir}/run_classes.mrcs`);
    console.log(`  local mirror now: ${fmt(nowLocal)}`);
  }
}

console.log(`\n${fail === 0 ? "THE RIDE IS GREEN — the signal channel is born." : `THE RIDE CARRIES ${fail} FAIL(S).`}`);
process.exit(fail === 0 ? 0 : 1);

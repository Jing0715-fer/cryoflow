#!/usr/bin/env node
/**
 * t319 diag — the progress bar tells the truth: RELION's OWN time bar is
 * the ground truth, and a running job's progress NEVER regresses.
 *
 * The user's ticket (post-t318, the real cluster):
 *   "进度条似乎有些问题，很多次到99%后又回到0% … import好像也有问题
 *    … 其实log中会有
 *    Estimating CTF parameters using Alexis Rohou's and Niko Grigorieff's CTFFIND4.1 ...
 *    3.53/53.72 min ...~~(,_,">                                                     [oo]"
 *
 * The anatomy (two defects, both fixed):
 *  1. THE PARSER SPOKE A DEAD DIALECT. parseProgressText counted
 *     "micrograph" lines in the tail window and divided by SIX — a
 *     hardcoded 6-micrograph EMPIAR denominator. The user's 1034-micrograph
 *     ctffind run.out speaks RELION's real dialect (src/time.cpp's
 *     progress_bar: "\r3.53/53.72 min ~~(,_,\"> [oo]", " yum!" at the end),
 *     which the old parser could not read at all.
 *  2. THE NULL FALLTHROUGH FORGED 0%. The sweep reads a 4096-byte SLIDING
 *     window of run.out; whenever the window held no countable line the
 *     parse returned null and the GET response fell back to the DB's
 *     dispatch-time 0 — so the card read 99% (window had lines) → 0%
 *     (window slid past them) → 99% → 0%… forever. The fix is the
 *     monotonic contract: parsed beats stored, stored beats null, and the
 *     progress is PERSISTED (status-guarded) so every GET agrees.
 *  3. IMPORT SHOWED A DEAD 0% THE WHOLE WAY. The native import runs
 *     in-process for the whole listing/stat/sniff marathon with the row at
 *     dispatch-time 0 — phase witnesses (per stat batch, sniff, star write)
 *     now move the bar; it still flips 100 only at finalize.
 *
 * PHASES:
 *  A. UNIT — the pure parser (src/lib/relion/progress-parse.ts) against the
 *     REAL dialects, verbatim from the relion sources: the user's exact
 *     line, the sec/min/hrs formats, the 000/??? init placeholder, \r
 *     in-place rewrites (last wins), the refine "Expectation iteration N of
 *     M" + per-iteration bar combination, the legacy "it [003]" and the
 *     mock's "Micrograph n/N" counters.
 *  B. IMPORT LIVE — a 450-file multi-select (3 stat rounds on the mock):
 *     the bar moves through the phases, never regresses, completes at 100.
 *  C. CTF LIVE — the mock's ctffind now speaks the REAL bar dialect: the
 *     progress samples are monotonic AND move with the bar (not stuck, not
 *     regressing), run.out carries the real dialect bytes, 100 at finalize.
 *  D. REFINE LIVE — the iterations dialect ("it [003]", 4 iters): monotonic
 *     samples, 100 at finalize — the refine family's share of the contract.
 *  E. LEDGER — source contracts (pure module, re-export, monotonic guards
 *     in BOTH sweeps, status-guarded persistence, import phase witnesses,
 *     the dead /6 hardcode extinct).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const CONN = "qa-t319";
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

const dispatch = (id, body) =>
  api(`/api/jobs/${id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify(body) });

/** run the pure parser in bun (TS imports natively, zero heavy deps). */
const unitParse = (type, tail, params = {}) => {
  const prog = [
    `const { parseProgressText } = await import(${JSON.stringify(
      path.join(ROOT, "src/lib/relion/progress-parse.ts")
    )});`,
    `console.log(JSON.stringify(parseProgressText(${JSON.stringify(type)}, ${JSON.stringify(
      tail
    )}, ${JSON.stringify(params)})));`,
  ].join("\n");
  const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
  const v = r.stdout?.trim().split("\n").pop();
  try {
    return JSON.parse(v);
  } catch {
    return `UNIT-PARSE-ERROR: ${v?.slice(0, 120)}`;
  }
};

const monotonic = (samples) => samples.every((v, i) => i === 0 || v >= samples[i - 1]);

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the dev server answers on :3000");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t319",
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
    body: JSON.stringify({ name: "QA t319 real progress", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const projRoot = `/projects/cryoflow/${projectId}`;

  // ======================================================================
  console.log("== PHASE A: UNIT — the pure parser speaks RELION's real dialects ==");
  // the user's EXACT quoted line (verbatim from the ticket)
  const userLine =
    "Estimating CTF parameters using Alexis Rohou's and Niko Grigorieff's CTFFIND4.1 ...\r" +
    '3.53/53.72 min ...~~(,_,">                                                     [oo]';
  must(
    unitParse("ctffind", userLine) === 7,
    `the user's exact line parses (3.53/53.72 min → 7%, got ${unitParse("ctffind", userLine)})`
  );
  // the init placeholder never lies (000/??? sec — ??? is not a digit)
  must(
    unitParse("ctffind", '000/??? sec ~~(,_,">    [oo]') === null,
    "the bar's init placeholder (000/??? sec) claims NOTHING"
  );
  // the three unit variants (src/time.cpp)
  must(unitParse("ctffind", "1.25/3.10 hrs ...~~(,_,\">") === 40, "the hrs variant parses (1.25/3.10 → 40)");
  must(unitParse("ctffind", " 120/480 sec ...") === 25, "the sec variant parses (120/480 → 25)");
  // \r in-place rewrites: the FRESHEST segment speaks
  must(
    unitParse("ctffind", "bar\r10/100 min..\r20/100 min..\r30/100 min..[oo]") === 30,
    "\\r rewrites collapse to the freshest update (30/100 → 30)"
  );
  // the yum! completion ≈ ratio 1 (the bar's own final update)
  must(
    unitParse("ctffind", "\r52.9/53.7 min ...~~(,_,\"> yum!\n") === 99,
    "the finished bar (yum!) reads ~99, never 100-before-finalize"
  );
  // refine: the real header + the per-iteration bar combine
  must(
    unitParse("refine3d", " Expectation iteration 3 of 25\n 2.50/10.00 min ...[oo]") === 9,
    "refine combines header + in-iteration bar ((3-1+0.25)/25 → 9)"
  );
  // t353 — the 7-of-20-shows-99% field shape: a 6-rank class2d's 4096-byte
  // tail holds ONLY bar segments (the "Expectation iteration 7 of 20"
  // header scrolled out under ~40 bytes/tick × 6 ranks × a quarter hour).
  // The bare bar is the WITHIN-iteration bar — reading it as global gave
  // 99% at every iteration's end. The honest verdict is null (hold).
  const bareBar =
    "  14.30/14.32 min ~~(,_,\">                                                     [oo]\n" +
    "  14.31/14.32 min ~~(,_,\">                                                     [oo]\n" +
    "  14.32/14.32 min ~~(,_,\">                                                     [oo]";
  must(
    unitParse("class2d", bareBar) === null,
    "t353: a refine-family BARE bar (header scrolled out) claims NOTHING (the 7/20 → 99% lie is dead)"
  );
  must(
    unitParse("class2d", bareBar, { iterations: 20 }) === null,
    "t353: even with the params' iteration count known, a bare bar cannot be placed — still null"
  );
  must(
    unitParse("class2d", "particle 349999/350000") === null,
    "t353: a refine-family n/N counter is the CURRENT iteration's step, not the run — null"
  );
  must(
    unitParse("ctffind", bareBar) === 99,
    "t353: the per-image family KEEPS the global bar as ground truth (ctffind bar → 99)"
  );
  must(
    unitParse("initialmodel", " Gradient optimisation iteration 4 of 10") === 40,
    "initialmodel's gradient header parses (4 of 10 → 40)"
  );
  // refine legacy/mock: "it [003]"
  must(
    unitParse("class2d", " it [003]  :   R1=0.43 R2=0.38", { iterations: 25 }) === 12,
    "the legacy it [003] dialect still parses (3/25 → 12)"
  );
  // the mock's countable dialect
  must(
    unitParse("ctffind", "Micrograph 5/8: a.mrc — CTF estimated") === 63,
    "the n/N counter dialect parses (5/8 → 63)"
  );
  // garbage stays null — the CALLER keeps the previous progress
  must(
    unitParse("ctffind", "nothing parsable here at all") === null,
    "an unparsable tail returns null (never a fabricated number)"
  );

  // ======================================================================
  console.log("== PHASE B: IMPORT LIVE — the phases move the bar, dead-0 is extinct ==");
  // 450 files → 3 stat rounds of 200 → the per-batch witness fires 3 times,
  // then the sniff (60), the native top-up (75) and the star write (90).
  const mrcHdr = (() => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(4096, 0);
    b.writeInt32LE(4096, 4);
    b.writeInt32LE(1, 8); // NZ=1 — single-section, CTF-ready
    b.writeInt32LE(2, 12); // mode 2
    return b.toString("base64");
  })();
  const fx = clientBoth(
    "mkdir -p /data2/t319-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t319-mic.mrc; ` +
      "for i in $(seq 1 450); do cp /tmp/.t319-mic.mrc /data2/t319-mics/mic_$(printf %04d $i).mrc; done"
  );
  must(fx === "", `the 450 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t319 import progress",
    params: {
      micrographsPath: Array.from({ length: 450 }, (_, i) => `/data2/t319-mics/mic_${String(i + 1).padStart(4, "0")}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!importJob?.id, "the import job creates");

  // fire the run POST and poll the row CONCURRENTLY — the import runs
  // in-process; the phases must be visible through the jobs GET door.
  const importPost = fetch(`${BASE}/api/jobs/${importJob.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: "{}",
  }).then((r) => ({ status: r.status, body: r.json().catch(() => null) }));
  const importSamples = [];
  const bDeadline = Date.now() + 90_000;
  while (Date.now() < bDeadline) {
    const j = await jobById(importJob.id);
    if (j) {
      importSamples.push(j.progress);
      if (j.status === "completed" || j.status === "failed") break;
    }
    await sleep(120);
  }
  const importRun = await importPost;
  must(importRun.status >= 200 && importRun.status < 300, `the import run answers (${importRun.status})`);
  const importFinal = await jobById(importJob.id);
  must(importFinal?.status === "completed", `the import completes (${importFinal?.status}: ${String(importFinal?.result ?? "").slice(0, 80)})`);
  must(/450 micrographs imported/.test(String(importFinal?.result ?? "")), "the import counts 450");
  must(importFinal?.progress === 100, `the import's final progress is 100 (${importFinal?.progress})`);
  must(monotonic(importSamples), `the import's samples NEVER regress (${importSamples.join(", ").slice(0, 90)}…)`);
  must(
    importSamples.some((v) => v > 0 && v < 100),
    `the import's bar MOVED mid-run (samples: ${importSamples.filter((v) => v > 0 && v < 100).join(", ") || "NONE — dead 0% the whole way"})`
  );

  // ======================================================================
  console.log("== PHASE C: CTF LIVE — the REAL bar dialect on the wire ==");
  const ctfJob = await mkJob({ projectId, type: "ctffind", name: "QA t319 ctf real dialect", params: {} });
  must(!!ctfJob?.id, "the ctffind job creates");
  const edgeC = await mkEdge(importJob.id, ctfJob.id, "micrographs", "micrographs");
  must(edgeC === 200 || edgeC === 201, `the edge wires import → ctffind (${edgeC})`);
  const workdirC = `${projRoot}/ctffind_${ctfJob.id.slice(-8)}`;

  // 450 mics at the t311 pace cap = 60s wall — a real-duration run whose
  // bar advances through many sweep ticks
  const dispatchC = await dispatch(ctfJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
  });
  must(dispatchC.status >= 200 && dispatchC.status < 300, `the dispatch answers (${dispatchC.status})`);
  must(!dispatchC.body?.error, `the dispatch is ACCEPTED (${String(dispatchC.body?.error ?? "").slice(0, 100)})`);

  const ctfSamples = [];
  const ctfDeadline = Date.now() + 180_000;
  while (Date.now() < ctfDeadline) {
    const j = await jobById(ctfJob.id);
    if (j) {
      ctfSamples.push(j.progress);
      if (j.status === "completed" || j.status === "failed") break;
    }
    await sleep(600);
  }
  const ctfFinal = await jobById(ctfJob.id);
  must(ctfFinal?.status === "completed", `the ctffind completes (${ctfFinal?.status}: ${String(ctfFinal?.result ?? "").slice(0, 80)})`);
  must(ctfFinal?.progress === 100, `the ctffind's final progress is 100 (${ctfFinal?.progress})`);
  must(monotonic(ctfSamples), `the ctffind's samples NEVER regress — the 99→0 oscillation is dead (${ctfSamples.join(", ").slice(0, 100)}…)`);
  const ctfMoving = ctfSamples.filter((v, i) => i > 0 && v !== ctfSamples[i - 1] && v < 100).length;
  must(ctfMoving >= 2, `the ctffind's bar ADVANCES with the run (≥2 distinct moves, saw ${ctfMoving})`);
  // the real dialect bytes landed in run.out (the mock now speaks time.cpp)
  const runOutC = client(`cat ${workdirC}/run.out 2>/dev/null`);
  must(/Estimating CTF parameters using Alexis Rohou's and Niko Grigorieff's CTFFIND4\.1/.test(runOutC), "run.out carries the real ctffind header line");
  must(/\d+\.\d+\/\d+\.\d+ (min|sec)/.test(runOutC), "run.out carries the REAL time-bar dialect (elapsed/total min|sec)");
  must(runOutC.includes("~~(,_,\">"), "run.out carries the bar's worm (~~(,_,\">)");
  must(runOutC.includes(" yum!"), "run.out carries the bar's completion word (yum!)");

  // ======================================================================
  console.log("== PHASE D: REFINE LIVE — the iterations dialect keeps its word ==");
  // class2d eats PARTICLES (t315's pattern): a cluster-side particles star
  // + a 24-row stack import feeds it directly.
  const stackB64 = (() => {
    const nx = 48;
    const ny = 48;
    // t338 — NZ must cover every image the particles star references (the
    // dispatch's consumer gate refuses a star that outruns its stack; the
    // old nz=2 under a 24-row star was exactly that lie)
    const nz = 24;
    const data = Buffer.alloc(1024); // header-only (t338): the sniffers read the header; full pixel data would bloat the inline base64 past the mock's exec limits
    data.writeInt32LE(nx, 0);
    data.writeInt32LE(ny, 4);
    data.writeInt32LE(nz, 8);
    data.writeInt32LE(2, 12);
    return data.toString("base64");
  })();
  const fxD = clientBoth(
    "mkdir -p /data2/t319-particles; " +
      `echo ${stackB64} | base64 -d > /data2/t319-particles/stack24.mrcs; ` +
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t319-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/t319-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t319-particles/particles.star; done"
  );
  must(fxD === "", `the particles fixtures build quietly (${fxD.slice(0, 120)})`);

  const importParts = await mkJob({
    projectId,
    type: "import",
    name: "QA t319 particles import",
    params: { micrographsPath: "/data2/t319-particles/particles.star", nodeType: "particles" },
  });
  must(!!importParts?.id, "the particles import creates");
  const runParts = await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runParts.status >= 200 && runParts.status < 300, `the particles import accepts (${runParts.status})`);
  const doneParts = await pollUntil(async () => {
    const j = await jobById(importParts.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneParts?.status === "completed", `the particles import completes (${doneParts?.status})`);

  const clsJob = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t319 class2d progress",
    params: { iterations: 4 },
  });
  must(!!clsJob?.id, "the class2d job creates");
  const edgeD = await mkEdge(importParts.id, clsJob.id, "particles", "particles");
  must(edgeD === 200 || edgeD === 201, `the particles edge wires import → class2d (${edgeD})`);

  const dispatchD = await dispatch(clsJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
  });
  must(dispatchD.status >= 200 && dispatchD.status < 300, `the class2d dispatch answers (${dispatchD.status})`);
  must(!dispatchD.body?.error, `the class2d dispatch is ACCEPTED (${String(dispatchD.body?.error ?? "").slice(0, 100)})`);

  const clsSamples = [];
  const clsDeadline = Date.now() + 120_000;
  while (Date.now() < clsDeadline) {
    const j = await jobById(clsJob.id);
    if (j) {
      clsSamples.push(j.progress);
      if (j.status === "completed" || j.status === "failed") break;
    }
    await sleep(500);
  }
  const clsFinal = await jobById(clsJob.id);
  must(clsFinal?.status === "completed", `the class2d completes (${clsFinal?.status}: ${String(clsFinal?.result ?? "").slice(0, 80)})`);
  must(clsFinal?.progress === 100, `the class2d's final progress is 100 (${clsFinal?.progress})`);
  must(monotonic(clsSamples), `the class2d's samples NEVER regress (${clsSamples.join(", ").slice(0, 80)}…)`);
  must(
    clsSamples.some((v) => v > 0 && v < 100),
    `the class2d's bar moved on the iterations dialect (samples: ${clsSamples.filter((v) => v > 0 && v < 100).join(", ") || "none"})`
  );

  // ======================================================================
  console.log("== PHASE E: the LEDGER (source contracts) ==");
  const pureSrc = readFileSync(`${ROOT}/src/lib/relion/progress-parse.ts`, "utf8");
  const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  const remoteSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const lsSrc = readFileSync(`${ROOT}/src/lib/remote/remote-ls.ts`, "utf8");
  const fakeSrc = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/relion_run_ctffind`, "utf8");

  must(existsSync(`${ROOT}/src/lib/relion/progress-parse.ts`), "the parser lives in a PURE module (testable, client-safe)");
  must(
    engineSrc.includes('export { parseProgressText } from "./progress-parse"'),
    "the engine re-exports the pure parser (importers unchanged)"
  );
  must(!/micLines\s*\/\s*6|\/\s*6\s*\)\\s*\*\s*100/.test(pureSrc), "the dead /6 EMPIAR denominator is EXTINCT");
  must(
    /sec\|min\|hrs/.test(pureSrc) && /expectation\|optimisation/.test(pureSrc),
    "the parser knows the real dialects (time bar + iteration headers)"
  );
  must(
    /Math\.max\(e\.job\.progress, progress\)/.test(remoteSrc) &&
      /where: \{ id: e\.job\.id, status: "running" \}, data: \{ progress: next \}/.test(remoteSrc),
    "the REMOTE sweep: monotonic max + status-guarded persistence"
  );
  must(
    /Math\.max\(job\.progress, parsed\)/.test(engineSrc) &&
      /where: \{ id: job\.id, status: "running" \}, data: \{ progress: next \}/.test(engineSrc),
    "the LOCAL sweep: the same monotonic contract"
  );
  must(
    /onProgress\?: \(fraction: number\) => void/.test(lsSrc),
    "statRemoteFiles takes a per-batch progress witness"
  );
  must(
    /setProgress\(90\)/.test(engineSrc) && /setProgress\(75\)/.test(engineSrc) && /setProgress\(60\)/.test(engineSrc),
    "the import's phase witnesses are wired (60 sniff/listing · 75 remote done · 90 star write)"
  );
  must(
    fakeSrc.includes("~~(,_,\">") && fakeSrc.includes(" yum!") && fakeSrc.includes("{_el:3.2f}/{_tot:3.2f}"),
    "the mock ctffind speaks RELION's real bar dialect"
  );

  console.log(fail === 0 ? "\n== t319 diag: ALL GREEN ==" : `\n== t319 diag: ${fail} FAIL ==`);
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
    client("rm -rf /data2/t319-mics /data2/t319-particles /tmp/.t319-mic.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);

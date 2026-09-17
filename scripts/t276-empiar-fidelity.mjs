/**
 * t276 — real data speaks, and our parsers must transcribe it faithfully
 * (the EMPIAR 真数据回归 leftover, finally delivered — t263 yielded it,
 * t270 yielded it, t272 yielded it, t275 gave the data a clear address
 * `_legacy-archive/relion-projects/empiar-10017-真实全流程/`, and this
 * window makes it testify).
 *
 * The ground truth: a REAL RELION 5.0.1 full pipeline ran on EMPIAR-10017
 * (the 2012 Falcon β-galactosidase movies) during the real-RELION
 * validation era — Import → CtfFind → ManualPick/Extract → Class2D →
 * Refine3D → Masks → PostProcess. Every artifact below is what RELION
 * itself wrote, not a fixture we fabricated. Three layers of fidelity:
 *
 *   A  ground truth present (read-only): the archive at its quarantine
 *      address, the verdict README naming it, the sandbox bundle restored
 *      (symlink /home/z/empiar-10017/micrographs → the archive's Import
 *      data dir — zero copies, reversible, the seed's pre-fill address
 *      and the engine's empiarData mode breathe again)
 *   B  parser fidelity — OUR parsers read REAL RELION 5 output in place:
 *      optics truth (1.77 Å / 300 kV / Cs 2.0 / Q0 0.1), 10 real Falcon
 *      micrographs, the FSC curve crossing 0.143 within an honest
 *      tolerance of the header's own _rlnFinalResolution (two parts of
 *      one real file agreeing about resolution), the model's
 *      EstimatedResolution == the postprocess FinalResolution (two
 *      independent FILES agreeing), real MRC binary headers (4096×4096
 *      Falcon frames whose cella is honestly ZERO — pixel size lives
 *      only in the star; the postprocess map 128³ at exactly 3.54 Å,
 *      matching the --angpix 3.54 command line in its own header
 *      comment), and the era pipeline's internal arithmetic (a coord
 *      file's 632 picks == that micrograph's extract-star rows)
 *   C  the product's rails carry real data (the t272 recipe, now fed
 *      truth): a SECOND project imports the REAL bundle through the
 *      product's own import (10 real mrcs, 10 coord files honestly
 *      skipped as non-images), the product's micrographs.star parses
 *      back with our parser, and a real ManualPick downstream converts
 *      the REAL Henderson coordinates verbatim into data_coordinate_files
 *      rows (no transform — every x/y equals the 1978-era pick values)
 *   Z  the demo canvas untouched: roster 21, product alive
 *
 * Honest SKIP: if the archive is absent (quarantine moved, era renamed),
 * the suite exits 0 with a loud SKIP — fidelity needs its ground truth,
 * and a missing archive is a world drift, not a product failure.
 */
import { readFileSync, existsSync, readlinkSync, symlinkSync, mkdirSync, rmSync, lstatSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { parseStar, biggestLoop, extractFsc, fscResolutionAtThreshold } from "../src/lib/starfile.ts";
import { readMrcHeader } from "../src/lib/mrc.ts";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const ARCHIVE = path.join(ROOT, "_legacy-archive/relion-projects/empiar-10017-真实全流程");
const BUNDLE_PARENT = "/home/z/empiar-10017";
const BUNDLE = path.join(BUNDLE_PARENT, "micrographs");
const BUNDLE_SOURCE = path.join(ARCHIVE, "Import/job001/data");
const SECOND_NAME = "t276 EMPIAR Fidelity";
const RELION_DIR = path.join(ROOT, "data/relion");

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 1200) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- honest SKIP -----------------------------------------------------------
if (!existsSync(ARCHIVE)) {
  console.log(`t276: SKIP — the ground truth is gone (${ARCHIVE} missing); the era moved, fidelity has nothing to transcribe`);
  process.exit(0);
}

console.log("== PHASE A: ground truth present ==");
must(existsSync(path.join(ARCHIVE, "Import/job001/micrographs.star")), "the real RELION 5 import star is at the quarantine address");
const verdict = readFileSync(path.join(ROOT, "_legacy-archive/README.md"), "utf8");
must(verdict.includes("empiar-10017"), "the verdict README names the EMPIAR project (ownership travels with the data)");

// the sandbox bundle: restore if the rebuilt sandbox lost it (t273/t274's
// rebuilds did) — the restoration IS part of this suite's contract, idempotent
let weRestoredBundle = false;
if (!existsSync(BUNDLE)) {
  mkdirSync(BUNDLE_PARENT, { recursive: true });
  symlinkSync(BUNDLE_SOURCE, BUNDLE);
  weRestoredBundle = true;
  console.log("  (fixture) restored the sandbox bundle symlink → the archive's Import data dir");
}
must(existsSync(path.join(BUNDLE, "Falcon_2012_06_12-14_33_35_0.mrc")), "the bundle resolves to real Falcon micrographs (10 mrc + 10 coord)");

console.log("== PHASE B: parser fidelity — real RELION 5 output, our parsers ==");
const R = (p) => readFileSync(path.join(ARCHIVE, p), "utf8");

// ---- B1: the real import star ---------------------------------------------
const mic = parseStar(R("Import/job001/micrographs.star"));
const optics = mic.blocks.find((b) => b.name === "optics");
must(!!optics?.loop && optics.loop.rows.length === 1, "the optics block has exactly one optics group");
const opticsRow = optics?.loop?.rows?.[0] ?? [];
must(
  opticsRow[2] === "1.770000" && opticsRow[4] === "300.000000" && opticsRow[5] === "2.000000" && opticsRow[6] === "0.100000",
  `the optics truth transcribes (angpix ${opticsRow[2]} · kV ${opticsRow[4]} · Cs ${opticsRow[5]} · Q0 ${opticsRow[6]})`
);
const micLoop = mic.blocks.find((b) => b.name === "micrographs")?.loop;
const micRows = micLoop?.rows ?? [];
must(micRows.length === 10, `10 real Falcon micrographs (${micRows.length})`);
must(
  micRows.every((r) => /Falcon_2012_06_12.*\.mrc$/.test(r[0])) && micRows.every((r) => r[1] === "1"),
  "every row names a Falcon 2012 micrograph in optics group 1"
);

// ---- B2: the real postprocess star — one file's two parts agree -----------
const post = parseStar(R("PostProcess/job010/postprocess.star"));
const general = post.blocks.find((b) => b.name === "general");
const finalRes = parseFloat(general?.pairs?._rlnFinalResolution ?? "nan");
must(near(finalRes, 25.173333, 0.001), `the header's _rlnFinalResolution transcribes (${finalRes})`);
const fscLoop = post.blocks.find((b) => b.name === "fsc")?.loop;
const fsc = fscLoop ? extractFsc(fscLoop) : null;
must(!!fsc && fsc.resolution.length === 65, `the FSC curve extracts from the real loop (${fsc?.resolution?.length ?? 0} shells)`);
must(
  fsc?.correlationColumn === "_rlnFourierShellCorrelationCorrected",
  `the corrected-FSC column is the one used (${fsc?.correlationColumn})`
);
const at143 = fsc ? fscResolutionAtThreshold(fsc, 0.143) : null;
must(
  at143 !== null && at143 >= 24 && at143 <= 26 && near(at143, finalRes, 0.6),
  `FSC crosses 0.143 at ${at143?.toFixed(2)} Å — within the honest tolerance of the header's ${finalRes.toFixed(2)} Å (RELION interpolates, the two parts AGREE)`
);
must(
  fsc !== null && fsc.correlation[fsc.correlation.length - 1] < 0.143,
  `the curve actually crosses (final shell ${fsc?.correlation?.[fsc.correlation.length - 1]?.toFixed(3)} < 0.143)`
);

// ---- B3: two independent FILES agree --------------------------------------
const model = parseStar(R("Refine3D/job008/run_model.star"));
const classes = model.blocks.find((b) => b.name === "model_classes")?.loop;
must(!!classes && classes.rows.length === 1, "the refinement converged to a single class (K=1)");
const classRow = classes?.rows?.[0] ?? [];
const distIdx = classes?.columns?.indexOf("_rlnClassDistribution") ?? -1;
const estResIdx = classes?.columns?.indexOf("_rlnEstimatedResolution") ?? -1;
must(near(parseFloat(classRow[distIdx] ?? "0"), 1.0, 1e-6), `the single class holds ALL particles (${classRow[distIdx]})`);
must(
  near(parseFloat(classRow[estResIdx] ?? "nan"), finalRes, 0.001),
  `the model's EstimatedResolution (${classRow[estResIdx]}) == the postprocess FinalResolution (${finalRes.toFixed(6)}) — two files, one truth`
);
const optimiser = parseStar(R("Refine3D/job008/run_optimiser.star"));
const optPairs = optimiser.blocks[0]?.pairs ?? {};
must(
  optPairs._rlnOutputRootName === "Refine3D/job008/run",
  `the optimiser transcribes (output root "${optPairs._rlnOutputRootName}")`
);
must(
  optPairs._rlnCurrentIteration !== undefined && Number.isInteger(parseFloat(optPairs._rlnCurrentIteration)),
  `the iteration field exists (${optPairs._rlnCurrentIteration} — RELION 5's finished-job sentinel is -1, another real-world value transcribed as-is)`
);

// ---- B4: real MRC binary headers ------------------------------------------
const falconHdr = readMrcHeader(path.join(ARCHIVE, "CtfFind/job002/data/Falcon_2012_06_12-14_33_35_0.mrc"));
must(
  !!falconHdr && falconHdr.nx === 4096 && falconHdr.ny === 4096 && falconHdr.nz === 1 && falconHdr.mode === 2,
  `a real Falcon frame: 4096×4096×1 float32 (${falconHdr && `${falconHdr.nx}×${falconHdr.ny}`})`
);
must(
  !!falconHdr && falconHdr.cella[0] === 0 && falconHdr.cella[1] === 0,
  "the Falcon header's cell dims are honestly ZERO — the producer wrote no cella; the star is the only pixel-size carrier (real-world messiness, transcribed as-is)"
);
const postHdr = readMrcHeader(path.join(ARCHIVE, "PostProcess/job010/postprocess.mrc"));
const postAngpix = postHdr ? postHdr.cella[0] / postHdr.nx : NaN;
must(
  !!postHdr && postHdr.nx === 128 && postHdr.ny === 128 && postHdr.nz === 128,
  `the postprocessed map: 128³ (${postHdr && `${postHdr.nx}³`})`
);
must(
  near(postAngpix, 3.54, 0.01),
  `the map's header angpix (${postAngpix.toFixed(3)} Å) == the --angpix 3.54 in its own command line`
);

// ---- B5: the era pipeline's internal arithmetic ----------------------------
const parts = parseStar(R("Extract/job004/particles.star"));
const partsLoop = biggestLoop(parts);
must(partsLoop?.rows?.length === 5539, `the extract pulled 5539 particles (${partsLoop?.rows?.length})`);
must(
  ["_rlnCoordinateX", "_rlnCoordinateY", "_rlnImageName", "_rlnMicrographName"].every((c) => partsLoop?.columns?.includes(c)),
  "the particle vocabulary is the real RELION one (coords + image + micrograph)"
);
const perMicName = "Falcon_2012_06_12-14_33_35_0";
const perMic = parseStar(R(`Extract/job004/data/${perMicName}_extract.star`));
const perLoop = biggestLoop(perMic);
const coordText = R(`Import/job001/data/${perMicName}.coord`);
const coordRows = coordText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#"));
must(
  perLoop?.rows?.length === coordRows.length,
  `the era arithmetic holds: ${perMicName} — ${coordRows.length} Henderson picks → ${perLoop?.rows?.length} extracted particles`
);
must(
  coordRows.every((l) => { const [x, y] = l.split(/\s+/).map(Number); return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < 4096 && y >= 0 && y < 4096; }),
  "every real pick is integer pixel coordinates inside the 4096 frame"
);

console.log("== PHASE C: the product's rails carry real data (second canvas) ==");
const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;
must(roster0 === 21, `the demo canvas starts at its 21 jobs (got ${roster0})`);

let secondProjectId = null;
const createdJobs = [];
try {
  const mkProj = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ name: SECOND_NAME }),
  });
  const projBody = await mkProj.json();
  secondProjectId = projBody.project?.id ?? null;
  must(mkProj.status === 201 && !!secondProjectId, "the second canvas is born");
  const activeJobs = await (await fetch(`${BASE}/api/jobs`)).json();
  must((activeJobs.jobs ?? []).length === 0, "creation flipped the active pointer — the second canvas starts EMPTY");

  const mkJob = async (body) => {
    const r = await fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await r.json();
    if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
    return b.job;
  };
  const mkEdge = async (fromJobId, toJobId) => {
    const r = await fetch(`${BASE}/api/edges`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ fromJobId, toJobId }),
    });
    return r.status;
  };
  const readJob = async (id) => {
    const d = await (await fetch(`${BASE}/api/jobs`)).json();
    return (d.jobs ?? []).find((x) => x.id === id) ?? null;
  };
  const readLog = async (id) => {
    const r = await fetch(`${BASE}/api/jobs/${id}/log`, { headers: SH });
    const b = await r.json().catch(() => ({}));
    return b.tail ?? b.log ?? b.text ?? (typeof b === "string" ? b : "");
  };

  // C1 — the REAL bundle rides the product's import
  const importJob = await mkJob({
    type: "import",
    name: "t276 Import (real EMPIAR)",
    params: { micrographsPath: BUNDLE, pixelSize: 1.77, voltage: 300, cs: 2.0, ampContrast: 0.1 },
  });
  must(!!importJob?.id, "the import job exists on the second canvas");
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 40_000);
  must(importDone?.status === "completed", `the product imports the REAL bundle (${importDone?.status})`);
  must(
    /10 micrographs imported/.test(importDone?.result ?? "") && /\(pixel 1\.77 Å\)/.test(importDone?.result ?? ""),
    `the result speaks the era truth ("${(importDone?.result ?? "").slice(0, 90)}")`
  );
  // t277 — the folder's non-images are COUNTED now (the bundle holds 10 real
  //        Henderson .coord files beside the 10 real mrcs; the era of silent
  //        filtering is over)
  must(
    /10 non-image files skipped/.test(importDone?.result ?? ""),
    `the folder's 10 real .coord files are reported, not swallowed ("${(importDone?.result ?? "").slice(0, 90)}")`
  );
  const importLog = await readLog(importJob.id);
  const starMatch = importLog.match(/output: (.+micrographs\.star)/);
  must(!!starMatch, "the import log names its output star");
  const productStarPath = starMatch ? starMatch[1] : "";
  const productMic = productStarPath ? parseStar(readFileSync(productStarPath, "utf8")) : null;
  const productMicLoop = productMic?.blocks.find((b) => b.name === "micrographs")?.loop;
  must(
    !!productMicLoop && productMicLoop.rows.length === 10,
    `the product's micrographs.star carries all 10 real micrographs (${productMicLoop?.rows?.length ?? 0})`
  );
  must(
    !!productMicLoop && productMicLoop.rows.every((r) => r[0] === `micrographs/${path.basename(r[0])}` && r[0].includes("Falcon_2012_06_12")),
    "the product writes the project-relative Falcon names the era wrote"
  );
  const productOptics = productMic?.blocks.find((b) => b.name === "optics")?.loop?.rows?.[0] ?? [];
  must(
    productOptics[2] === "1.77" && productOptics[3] === "300" && productOptics[4] === "2" && productOptics[5] === "0.1",
    `the product's optics block matches the era's truth (angpix ${productOptics[2]} · kV ${productOptics[3]} · Cs ${productOptics[4]} · Q0 ${productOptics[5]})`
  );

  // C2 — the REAL Henderson picks ride the product's manualpick, verbatim
  const pickJob = await mkJob({ type: "manualpick", name: "t276 ManualPick (real Henderson coords)" });
  must(!!pickJob?.id, "the manualpick job exists");
  const edgeSt = await mkEdge(importJob.id, pickJob.id);
  must(edgeSt === 200 || edgeSt === 201, `import → manualpick wired with default ports (${edgeSt})`);
  await fetch(`${BASE}/api/jobs/${pickJob.id}/run`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const pickDone = await pollUntil(async () => {
    const j = await readJob(pickJob.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(pickDone?.status === "completed", `the real picks convert (${pickDone?.status})`);

  const pickLog = await readLog(pickJob.id);
  const pickStarMatch = pickLog.match(/output: (.+manualpick\.star)/);
  must(!!pickStarMatch, "the manualpick log names its output star");
  const expectedPicks = 5539; // the era's total — asserted against the archive in phase B
  must(
    new RegExp(`${expectedPicks} picks imported`).test(pickDone?.result ?? ""),
    `the result counts the real picks (${expectedPicks}) — "${(pickDone?.result ?? "").slice(0, 60)}"`
  );
  const pickStar = pickStarMatch ? parseStar(readFileSync(pickStarMatch[1], "utf8")) : null;
  const pickBlock = pickStar?.blocks.find((b) => b.name === "coordinate_files");
  must(!!pickBlock?.loop, "the product writes data_coordinate_files (topaz-trainable naming)");
  const pickRows = pickBlock?.loop?.rows ?? [];
  must(pickRows.length === 5539, `every real pick transcribed (${pickRows.length})`);
  // VERBATIM fidelity: the rows for our mic equal the 1978-era values exactly
  const ours = pickRows.filter((r) => r[2] === `micrographs/${perMicName}.mrc`);
  must(ours.length === coordRows.length, `our mic's rows match its coord file (${ours.length})`);
  const verbatim = ours.length === coordRows.length && ours.every((r, i) => {
    const [x, y] = coordRows[i].split(/\s+/);
    return r[0] === x && r[1] === y;
  });
  must(
    verbatim,
    "VERBATIM: every x/y equals the real Henderson coordinate, zero transform, zero drift (non-vacuous: 632 rows)"
  );
} catch (e) {
  must(false, `phase C crashed: ${e?.message ?? e}`);
}

console.log("== PHASE Z: the demo canvas untouched ==");
if (secondProjectId) {
  const delProj = await fetch(`${BASE}/api/projects/${secondProjectId}`, { method: "DELETE", headers: SH });
  must(delProj.status === 200, `the second project is deleted (got ${delProj.status})`);
  secondProjectId = null;
}
const jobsEnd = await (await fetch(`${BASE}/api/jobs`)).json();
must((jobsEnd.jobs ?? []).length === 21, `the demo canvas stands at its 21 jobs again (${(jobsEnd.jobs ?? []).length})`);
const home = await fetch(`${BASE}/`, { headers: { Origin: BASE } }).catch(() => null);
must(home?.status === 200, `the product is alive (${home?.status ?? "no response"})`);

console.log(fail === 0 ? "\nt276: ALL PASS" : `\nt276: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;

// finally — cleanup in reverse, the suite digs its own graves shut
try {
  if (secondProjectId) {
    await fetch(`${BASE}/api/projects/${secondProjectId}`, { method: "DELETE", headers: SH });
    console.log("  (cleanup) removed the second project");
  }
  for (const id of [...createdJobs].reverse()) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }); } catch { /* best effort */ }
  }
  try {
    const projectsNow = await (await fetch(`${BASE}/api/projects`, { headers: SH })).json();
    const demo = (projectsNow.projects ?? []).find((p) => p.name !== SECOND_NAME);
    if (demo) {
      await fetch(`${BASE}/api/projects/switch`, {
        method: "POST",
        headers: { ...SH, "Content-Type": "application/json" },
        body: JSON.stringify({ id: demo.id }),
      });
    }
  } catch { /* best effort */ }
  // the second canvas's project dir (its whole tree belongs to this suite)
  try {
    const ids = createdJobs.map((id) => id.slice(-8));
    for (const proj of readdirSync(RELION_DIR)) {
      const inner = path.join(RELION_DIR, proj);
      let entries = [];
      try { entries = readdirSync(inner); } catch { continue; }
      const touched = entries.some((d) => ids.some((s) => d.endsWith(`_${s}`)));
      if (touched) {
        try { rmSync(inner, { recursive: true, force: true }); console.log(`  (cleanup) removed ${proj}/`); } catch { /* best effort */ }
      }
    }
  } catch { /* best effort */ }
  // the bundle stays (it is a RESTORATION, not litter) — but if WE created it
  // during a skip-adjacent partial run and phase A never validated it, remove it
  if (weRestoredBundle && fail > 0) {
    try {
      const st = lstatSync(BUNDLE);
      if (st.isSymbolicLink() && readlinkSync(BUNDLE) === BUNDLE_SOURCE) {
        rmSync(BUNDLE, { force: true });
        console.log("  (cleanup) un-restored the bundle (failed run leaves no half-state)");
      }
    } catch { /* gone */ }
  }
} catch (e) {
  console.log(`  (cleanup) best-effort cleanup hit: ${e?.message ?? e}`);
}

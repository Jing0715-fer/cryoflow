#!/usr/bin/env node
// t1134-autopick-honest-word-unit.mjs — the autopick's honest retirement
// word, the census's 72nd instrument.
//
// THE WEIGH (this window's decision record, evidence-first): t1133's heal
// made the class2d real-blob promise fireable, and the natural question
// was whether the autopick's t380 dark-blob lane is fireable too — a
// re-run would cascade the 96-row promise and every downstream receipt.
// THE EVIDENCE: cf_cryo.dark_blob_picks run READ-ONLY against all 24
// HEALED micrographs returns ZERO detections (the mock's generator draws
// BRIGHT blobs — min 0.000, the pixels clamped non-negative — while the
// detector seeks the real cryo polarity's DARK cores; the dark bar
// mean-0.9σ holds only ~3.7% of pixels and the DoG bar clears nowhere).
// THE VERDICT: the autopick re-run is a NO-GO — the real lane cannot fire
// on this world's pixels at all, a re-run would rewrite identical
// synthetic-grid picks (deterministic) and cascade nothing. The grid is
// not a stale fallback — it is the only lane this world's pixels speak.
//
// THE DEFECT THE WEIGH EXPOSED: the autopick's legacy lane logged
// success-shaped words — "N particles picked" — over a retirement the
// reader could not see (the t1132 law: THE FALLBACK MUST SAY ITS NAME;
// motioncorr's flat fallback got its honest zero word in t1132 — the
// autopick had not worn it yet).
//
// THE CURE (services/mock-cluster/fs/opt/bin/relion_autopick): the
// per-micrograph legacy line names the lane AND the reason ("K
// synthetic-grid picks (the dark-blob reader retired: unreadable |
// no-detection; the grid is this stub's own contract, t1134)") and the
// summary line counts the grid's share ("— M of N picked on the synthetic
// grid (the honest retirement, t1134)").
//
// THE INSTRUMENT: a real e2e of the ENGINE at unit level — a fabricated
// micro-world (a 2-micrograph star: one flat-zero mic, one carrying DARK
// blobs drawn at the detector's own scale), the engine invoked as a
// subprocess, both lanes' log words + the summary's share count + the
// picks' geometry (real picks land ON the blobs; grid picks ride the
// grid formula) pinned from the run's own outputs.

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import os from "os";

const OPT_BIN = "/home/z/my-project/services/mock-cluster/fs/opt/bin";

let fail = 0;
let n = 0;
const must = (cond, label) => {
  n++;
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

// ---- the fabricated micro-world --------------------------------------
// THE SCALE LAW the fixture taught: the detector's dark bar is the GLOBAL
// mean − 0.9σ — the ice plane must DOMINATE the statistics the way it does
// on a real 4k micrograph. A 256² toy canvas made even three honest blobs
// own the mean and the bar chased them below themselves; the fixture speaks
// the real scale (4096², 36 dark discs ≈ 2.3% of the area) or it lies.
const world = mkdtempSync();
function mkdtempSync() {
  return path.join(os.tmpdir(), `t1134-world-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
}
mkdirSync(world, { recursive: true });

const flatMic = `${world}/flat.mrc`;
const blobMic = `${world}/blobs.mrc`;

// build both fixtures through the engine family's own writer; the blob
// field rides the detector's OWN scale (r_small = 120/4/2 = 15 ds-px = 60
// orig-px; the discs' full-depth radius 70 with a 22px ramp fills the
// r_small window and clears m_large) and the REAL cryo polarity (dark
// cores on a bright ice plane).
execSync(
  `python3 -c "
import sys; sys.path.insert(0, '${OPT_BIN}')
import numpy as np, cf_cryo
# flat mic: the t1132 zero-world's own shape — structurally perfect, pixel-dead
N = 4096
flat = np.full((N, N), 0.3, dtype=np.float32)
flat += (np.random.default_rng(5).random((N, N), dtype=np.float32) - 0.5) * 0.02
cf_cryo.write_mrc('${flatMic}', N, N, 1, flat)
# dark-blob mic: 36 dark discs on a bright ice plane (the real cryo polarity)
img = np.full((N, N), 0.6, dtype=np.float32)
rng = np.random.default_rng(23)
pitch = 640
for gy in range(512, N, pitch):
    for gx in range(512, N, pitch):
        cy = gx + int(rng.integers(-140, 140)); cx = gy + int(rng.integers(-140, 140))
        y0, y1 = max(0, cy - 90), min(N, cy + 90)
        x0, x1 = max(0, cx - 90), min(N, cx + 90)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        rr = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
        core = np.clip((70 - rr) / 22.0, 0, 1)
        img[y0:y1, x0:x1] -= 1.3 * core
img += (rng.random((N, N), dtype=np.float32) - 0.5) * 0.05
cf_cryo.write_mrc('${blobMic}', N, N, 1, img)
print('fixtures written')
"`,
  { encoding: "utf8", timeout: 120_000 }
);

const star = `${world}/micrographs.star`;
// the engine resolves rows against the star's dir / cwd / the star's parent
// — write the star NEXT to the mics and run the engine from there
writeFileSync(star, [
  "data_micrographs", "",
  "loop_", "_rlnMicrographName #1", "",
  "flat.mrc", "blobs.mrc", "",
].join("\n"));

const outDir = "autopick_out";
rmSync(`${world}/${outDir}`, { recursive: true, force: true });
let run = "";
try {
  run = execSync(
    `cd '${world}' && python3 '${OPT_BIN}/relion_autopick' --i micrographs.star --odir ${outDir}/ --pickname autopick --LoG --LoG_diam_min 120 --LoG_diam_max 180`,
    { encoding: "utf8", timeout: 60_000 }
  );
} catch (e) {
  run = String(e.stdout ?? "") + String(e.stderr ?? "");
}

try {
  console.log("== A: the engine ran its two lanes ==");
  must(run.includes("log (Laplacian of Gaussian) — 2 micrograph(s)"), "the engine answers with the LoG method line (2 micrographs)");

  console.log("== B: the flat mic's retirement SPEAKS ITS NAME (the cure) ==");
  must(/Micrograph 1\/2: flat\.mrc — \d+ synthetic-grid picks \(the dark-blob reader retired: no-detection; the grid is this stub's own contract, t1134\)/.test(run), "the flat mic's line names the lane AND the reason (retired: no-detection — readable pixels, nothing found)");

  console.log("== C: the dark-blob mic fires the REAL lane ==");
  must(/Micrograph 2\/2: blobs\.mrc — \d+ REAL dark-blob picks \(LoG 120–180 Å, cryo polarity\)/.test(run), "the dark mic's line wears the REAL badge with the LoG window");

  console.log("== D: the summary counts the grid's share ==");
  must(/autopick done: \d+ particles across 2 micrographs — 1 of 2 picked on the synthetic grid \(the honest retirement, t1134\)/.test(run), "the summary carries the honest retirement count (1 of 2)");

  console.log("== E: the picks' geometry (the lanes' own signatures) ==");
  const flatStar = `${world}/${outDir}/micrographs/flat_autopick.star`;
  const blobStar = `${world}/${outDir}/micrographs/blobs_autopick.star`;
  must(existsSync(flatStar) && existsSync(blobStar), "both per-mic pick stars landed");
  const flatRows = readFileSync(flatStar, "utf8").split(/\r?\n/).filter((l) => /^\d/.test(l));
  must(flatRows.length >= 3, `the flat mic's grid picks landed (${flatRows.length} rows)`);
  // the grid's law: x = 120 + (k*61)%1800, y = 140 + (k*97)%1700
  const k0 = flatRows[0].split("\t");
  must(Number(k0[0]) === 120 && Number(k0[1]) === 140, "the flat mic's first pick rides the grid formula (120,140)");
  const blobRows = readFileSync(blobStar, "utf8").split(/\r?\n/).filter((l) => /^\d/.test(l));
  must(blobRows.length >= 30, `the dark mic's real picks landed (${blobRows.length} rows — the drawn field's own 36)`);
  // the real picks must sit ON the drawn discs: the geometry witness reads
  // the blob mic's own pixels — a pick is ON a blob when its 70px
  // neighborhood's mean sits clearly below the ice plane
  const onBlob = execSync(
    `python3 -c "
import sys; sys.path.insert(0, '${OPT_BIN}')
import numpy as np, cf_cryo
r = cf_cryo.read_mrc('${blobMic}')
nx, ny, nz, vals = r
img = np.asarray(vals, dtype=np.float32).reshape(ny, nx)
picks = [tuple(map(float, l.split('\\t')[:2])) for l in '''${blobRows.join(";")}'''.split(';')]
on = 0
for x, y in picks:
    xi, yi = int(x), int(y)
    if 70 <= xi < nx - 70 and 70 <= yi < ny - 70:
        patch = img[yi - 35:yi + 35, xi - 35:xi + 35]
        if patch.mean() < img.mean() - 0.5 * img.std():
            on += 1
print(on)
"`,
    { encoding: "utf8" }
  ).trim();
  must(Number(onBlob) >= blobRows.length * 0.8, `the real picks sit ON dark blobs (${onBlob}/${blobRows.length} pick patches read clearly below the ice plane)`);
} finally {
  rmSync(world, { recursive: true, force: true });
}

console.log(`\n${n}/${n - fail} green${fail === 0 ? " — the honest retirement word stands." : ` — ${fail} FAIL(S).`}`);
process.exit(fail === 0 ? 0 : 1);

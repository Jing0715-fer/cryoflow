/**
 * t457 bench — the final verdict: one postprocess's honesty read.
 *
 * Pure-brain assertions + the stub's own law (the t456 lesson: the mock
 * dialect is pinned by a bench, not by trust):
 *   FV1 the crossing     — linear interpolation of a 0.143 descent; flat
 *                          curves never cross; single shells say nothing
 *   FV2 the verdict word — honest / modest gift / generous gift /
 *                          mask-carried / beyond the box; the gift's size
 *                          picks the word; guards refuse non-postprocess
 *                          tables
 *   FV3 the weather      — the B-factor's gentle / strong / aggressive
 *   FV4 the headline     — three numbers one line; the claw line rides
 *                          under the word
 *   FV5 the stub's law   — the REAL relion_postprocess stub runs on a
 *                          synthetic half-map: official never beats the
 *                          box edge, all three curves cross inside the
 *                          table, the refinement's own estimate leads
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";
import { findPair, parseStar } from "../src/lib/starfile";
import {
  crossingOf,
  postprocessVerdictOf,
  sharpeningRead,
  FSC_CRITERION,
  GIFT_MODEST_ANGSTROM,
  GIFT_GENEROUS_ANGSTROM,
  BFACTOR_GENTLE,
  BFACTOR_STRONG,
  type VerdictShell,
} from "../src/lib/postprocess-verdict";

let pass = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    failures.push(label);
    console.error(`  ✗ ${label}`);
  }
}
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  ok(a === b, `${label} — expected ${b}, got ${a}`);
}
const near = (a: number, b: number, tol: number): boolean =>
  Math.abs(a - b) <= tol;

/* ---------------------------------------------------------------- */
/* FV1 — the crossing.                                               */
/* ---------------------------------------------------------------- */
console.log("FV1 — the crossing");
{
  // 0.30 at f=0.10 → 0.10 at f=0.15: threshold 0.143 sits 78.5% down
  ok(
    near(
      crossingOf([
        { freq: 0.1, value: 0.3 },
        { freq: 0.15, value: 0.1 },
      ]) ?? 0,
      1 / (0.1 + ((0.3 - 0.143) / 0.2) * 0.05),
      1e-9
    ),
    "FV1a linear interpolation lands where the threshold says"
  );
  // asymmetric straddle: 0.20 → 0.10, threshold 57% down the drop
  const t = (0.2 - 0.143) / (0.2 - 0.1);
  ok(
    near(
      crossingOf([
        { freq: 0.1, value: 0.2 },
        { freq: 0.2, value: 0.1 },
      ]) ?? 0,
      1 / (0.1 + t * 0.1),
      1e-9
    ),
    "FV1b weighted interpolation"
  );
  eq(
    crossingOf([
      { freq: 0.1, value: 0.05 },
      { freq: 0.2, value: 0.02 },
    ]),
    null,
    "FV1c always below — no crossing"
  );
  eq(
    crossingOf([
      { freq: 0.1, value: 0.1 },
      { freq: 0.15, value: 0.3 },
    ]),
    null,
    "FV1d ascending curve — no descent, no crossing"
  );
  eq(
    crossingOf([{ freq: 0.1, value: 0.3 }]),
    null,
    "FV1e a single shell crosses nothing"
  );
  ok(
    near(
      crossingOf([
        { freq: 0.1, value: 0.3 },
        { freq: 0.15, value: 0.2 },
        { freq: 0.2, value: 0.05 },
      ]) ?? 0,
      1 / (0.15 + ((0.2 - 0.143) / (0.2 - 0.05)) * 0.05),
      1e-9
    ),
    "FV1f the first descending straddle wins"
  );
  eq(
    crossingOf(
      [
        { freq: 0.1, value: 0.3 },
        { freq: 0.2, value: 0.28 },
      ],
      0.25
    ),
    null,
    "FV1g never dips under the custom threshold — no crossing"
  );
  eq(
    crossingOf(
      [
        { freq: 0.1, value: 0.3 },
        { freq: 0.2, value: 0.25 },
      ],
      0.25
    ),
    null,
    "FV1h ends exactly AT the threshold without dipping — no crossing"
  );
}

/* ---------------------------------------------------------------- */
/* FV2/FV4 — the verdict word, via explicit shell tables.            */
/*                                                                   */
/* Each fixture is ONE freq axis with three per-curve value arrays   */
/* (each a monotone descent with its 0.143 dip placed exactly where  */
/* the test says). crossAt() mirrors the brain's interpolation so    */
/* every expected crossing is exact. Shell.fsc carries the UNMASKED  */
/* curve (the FSC route's convention).                               */
/* ---------------------------------------------------------------- */

/** exact crossing of a curve descending va→vb across (fa, fb) */
const crossAt = (fa: number, va: number, fb: number, vb: number): number =>
  1 / (fa + ((va - FSC_CRITERION) / (va - vb)) * (fb - fa));

/** zip one freq axis + three value arrays into the brain's input */
function table3(
  freqs: number[],
  corrected: number[],
  unmasked: number[],
  masked: number[] | null,
  general: {
    finalResolution: number | null;
    bfactor: number | null;
    angpix: number | null;
  } | null
) {
  const shells: VerdictShell[] = freqs.map((f, i) => ({
    freq: f,
    fsc: unmasked[i],
    correctedFsc: corrected[i],
    ...(masked ? { maskedFsc: masked[i] } : {}),
  }));
  return { shells, postprocessGeneral: general };
}

/* the shared axis + the official (corrected) crossing every fixture uses */
const FREQS = [0.1, 0.19, 0.2, 0.208, 0.21, 0.22, 0.23, 0.27, 0.29, 0.4];
const CORRECTED = [0.5, 0.5, 0.45, 0.4, 0.3, 0.05, 0.02, 0.01, 0.01, 0.005];
const OFFICIAL = crossAt(0.21, 0.3, 0.22, 0.05); // ≈ 4.624 Å
const MASKED = [0.6, 0.55, 0.5, 0.45, 0.42, 0.3, 0.1, 0.03, 0.02, 0.01];
const MASKED_CROSS = crossAt(0.22, 0.3, 0.23, 0.1); // ≈ 4.389 Å
const general = (bfactor: number | null, finalResolution: number | null = null) => ({
  finalResolution,
  bfactor,
  angpix: 1.24,
});

console.log("FV2 — the verdict word");
{
  // honest — the unmasked dip sits a hair coarser than the official one
  const honest = postprocessVerdictOf(
    table3(
      FREQS,
      CORRECTED,
      [0.6, 0.5, 0.42, 0.2, 0.04, 0.02, 0.02, 0.01, 0.01, 0.005],
      MASKED,
      general(-60)
    )
  );
  ok(honest != null, "FV2a a real table yields a verdict");
  eq(honest?.word, "honest", "FV2b a noise-level gift → honest");
  const honestGift = crossAt(0.208, 0.2, 0.21, 0.04) - OFFICIAL;
  ok(
    honest?.maskGift != null && near(honest.maskGift, honestGift, 0.01),
    `FV2c the gift is the unmasked-official distance (${honest?.maskGift?.toFixed(3)} vs ${honestGift.toFixed(3)})`
  );
  ok(
    honest?.maskGift != null &&
      honest.maskGift >= 0 &&
      honest.maskGift <= GIFT_MODEST_ANGSTROM,
    "FV2d the honest gift sits inside its own band"
  );

  // modest — the unmasked dip at (0.1, 0.19) crosses ≈ 6.0 Å: gift ≈ 1.39
  const modest = postprocessVerdictOf(
    table3(
      FREQS,
      CORRECTED,
      [0.4, 0.05, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.001],
      MASKED,
      general(-60)
    )
  );
  eq(modest?.word, "modest gift", "FV2e gift between the bands → modest gift");
  ok(
    modest?.maskGift != null &&
      modest.maskGift > GIFT_MODEST_ANGSTROM &&
      modest.maskGift <= GIFT_GENEROUS_ANGSTROM,
    `FV2f the modest gift sits inside its own band (${modest?.maskGift?.toFixed(3)})`
  );

  // generous — the unmasked dip crosses ≈ 7.6 Å: gift ≈ 3.0
  const generous = postprocessVerdictOf(
    table3(
      FREQS,
      CORRECTED,
      [0.19, 0.05, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.001],
      MASKED,
      general(-60)
    )
  );
  eq(
    generous?.word,
    "generous gift",
    "FV2g gift beyond the generous band → generous gift"
  );
  ok(
    (generous?.maskGift ?? 0) > GIFT_GENEROUS_ANGSTROM,
    `FV2h the generous gift exceeds its own band (${generous?.maskGift?.toFixed(3)})`
  );
  ok(
    (generous?.detail ?? "").includes("over-tightening"),
    "FV2i the generous word points at the over-tight mask"
  );

  // mask-carried — the unmasked curve never crosses
  const carried = postprocessVerdictOf(
    table3(
      FREQS,
      CORRECTED,
      [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02],
      MASKED,
      general(-60)
    )
  );
  eq(carried?.word, "mask-carried", "FV2j no unmasked crossing → mask-carried");
  eq(carried?.unmasked, null, "FV2k the carried verdict's unmasked stays null");
  ok(carried?.maskGift == null, "FV2l a carried verdict has no gift to speak of");

  // beyond the box — official finer than 2x angpix is physics' denial
  const beyond = postprocessVerdictOf(
    table3(FREQS, CORRECTED, [0.4, 0.05, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.001], MASKED, {
      finalResolution: 6.0,
      bfactor: -60,
      angpix: 3.54,
    })
  );
  eq(beyond?.word, "beyond the box", "FV2m official < Nyquist → beyond the box");
  ok(
    (beyond?.detail ?? "").includes("box edge"),
    "FV2n the box's denial names the box edge"
  );

  // negative gift — the unmasked halves cross FINER than the official
  const negative = postprocessVerdictOf(
    table3(
      FREQS,
      CORRECTED,
      [0.6, 0.55, 0.5, 0.45, 0.42, 0.35, 0.3, 0.05, 0.02, 0.01],
      null,
      general(-60)
    )
  );
  eq(negative?.word, "honest", "FV2o a negative gift stays honest (with a note)");
  ok(
    (negative?.detail ?? "").includes("unusual read"),
    "FV2p the negative gift's detail says the read is unusual"
  );

  // guards: no corrected column, too few shells, empty table
  eq(
    postprocessVerdictOf({
      shells: [
        { freq: 0.1, fsc: 0.3 },
        { freq: 0.2, fsc: 0.1 },
      ],
    }),
    null,
    "FV2q a model-star table (no corrected curve) yields no verdict"
  );
  eq(
    postprocessVerdictOf({
      shells: [{ freq: 0.1, fsc: 0.3, correctedFsc: 0.35 }],
      postprocessGeneral: null,
    }),
    null,
    "FV2r a single shell yields no verdict"
  );
  eq(postprocessVerdictOf({ shells: [] }), null, "FV2s an empty table yields no verdict");

  // the official number: general's word first, the crossing as fallback
  const fallback = postprocessVerdictOf(
    table3(FREQS, CORRECTED, [0.4, 0.05, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.001], null, null)
  );
  ok(
    fallback != null && near(fallback.official, OFFICIAL, 0.01),
    `FV2t without data_general the corrected crossing speaks (${fallback?.official.toFixed(3)})`
  );

  // unsorted shells read the same verdict (the brain sorts defensively)
  const shuffled = postprocessVerdictOf({
    shells: [
      ...table3(FREQS, CORRECTED, [0.4, 0.05, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.001], MASKED, general(-60))
        .shells,
    ].reverse(),
    postprocessGeneral: general(-60),
  });
  eq(shuffled?.word, "modest gift", "FV2u reversed shells read the same verdict");
}

/* ---------------------------------------------------------------- */
/* FV3 — the sharpening weather.                                     */
/* ---------------------------------------------------------------- */
console.log("FV3 — the B-factor weather");
{
  eq(sharpeningRead(-30)?.word, "gentle", "FV3a under 50 → gentle");
  eq(sharpeningRead(-80)?.word, "strong", "FV3b mid band → strong");
  eq(sharpeningRead(-150)?.word, "aggressive", "FV3c beyond 110 → aggressive");
  eq(sharpeningRead(null), null, "FV3d no B-factor — no weather");
  ok(
    (sharpeningRead(-150)?.detail ?? "").includes("noise"),
    `FV3e the aggressive weather names the noise (bands ${BFACTOR_GENTLE}/${BFACTOR_STRONG})`
  );
}

/* ---------------------------------------------------------------- */
/* FV4 — the headline + the claw line.                               */
/* ---------------------------------------------------------------- */
console.log("FV4 — the headline");
{
  const full = postprocessVerdictOf(
    table3(
      FREQS,
      CORRECTED,
      [0.4, 0.05, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.001],
      MASKED,
      general(-62.4)
    )
  );
  ok(full != null, "FV4a the full table yields a verdict");
  ok(
    (full?.headline ?? "").includes(`${OFFICIAL.toFixed(1)} Å final`) &&
      (full?.headline ?? "").includes(`${crossAt(0.1, 0.4, 0.19, 0.05).toFixed(1)} Å`) &&
      (full?.headline ?? "").includes(`${MASKED_CROSS.toFixed(1)} Å`),
    `FV4b the headline carries all three crossings ("${full?.headline}")`
  );
  ok(
    (full?.detail ?? "").includes("clawed"),
    "FV4c the claw line rides under the word"
  );
  ok(
    full?.clawBack != null && near(full.clawBack, OFFICIAL - MASKED_CROSS, 0.01),
    `FV4d the claw is official minus the raw crossing (${full?.clawBack?.toFixed(3)})`
  );
}

/* ---------------------------------------------------------------- */
/* FV5 — the stub's own law: the REAL relion_postprocess runs here.  */
/* ---------------------------------------------------------------- */
console.log("FV5 — the stub's law");
{
  const TMP = "/home/z/my-project/.qa-logs/t457-bench";
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, "with-refine"), { recursive: true });
  mkdirSync(join(TMP, "box-only"), { recursive: true });
  const STUB = join(
    "/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_postprocess"
  );

  const writeMrc = (p: string, n: number) => {
    const header = Buffer.alloc(1024);
    header.writeInt32LE(n, 0);
    header.writeInt32LE(n, 4);
    header.writeInt32LE(n, 8);
    header.writeInt32LE(2, 12); // mode 2 float32
    writeFileSync(p, Buffer.concat([header, Buffer.alloc(n * n * n * 4)]));
  };

  /** a minimal loop parser for the stub's data_fsc block, mapped onto
   *  the brain's shell shape (fsc = the unmasked head curve) */
  const parseFsc = (text: string): VerdictShell[] => {
    const lines = text.split(/\r?\n/);
    const rows: VerdictShell[] = [];
    let inFsc = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("data_")) inFsc = t === "data_fsc";
      if (!inFsc || !t || t.startsWith("_") || t.startsWith("#") || t === "loop_") continue;
      const c = t.split(/\s+/).map(Number);
      if (c.length === 6 && c.every((x) => Number.isFinite(x))) {
        rows.push({ freq: c[0], fsc: c[3], correctedFsc: c[2], maskedFsc: c[4] });
      }
    }
    return rows;
  };

  const angpix = 3.54;
  const nyqRes = 2 * angpix; // 7.08 Å — the box edge
  const STUB_DIR = join(TMP, "with-refine");
  writeMrc(join(STUB_DIR, "half.mrc"), 8);
  // the refinement's own word: 7.11 Å → the mask buys ≤4% but the box
  // floor (2.2x angpix = 7.788) owns the ceiling
  writeFileSync(
    join(STUB_DIR, "run_model.star"),
    "data_model_general\n\n_rlnCurrentResolution 7.11\n"
  );

  const run = (dir: string) =>
    spawnSync(
      "python3",
      [
        STUB,
        "--i",
        join(dir, "half.mrc"),
        "--o",
        join(dir, "postprocess"),
        "--angpix",
        String(angpix),
        "--randomize_at",
        "10",
      ],
      { stdio: "pipe" }
    );

  // --- run A: the refinement's estimate present ---
  const rA = run(STUB_DIR);
  ok(rA.status === 0, `FV5a the stub runs (exit ${rA.status})`);
  const starA = existsSync(join(STUB_DIR, "postprocess.star"));
  ok(starA, "FV5b the stub wrote its star");

  if (starA) {
    const text = readFileSync(join(STUB_DIR, "postprocess.star"), "utf8");
    const shells = parseFsc(text);
    ok(shells.length >= 20, `FV5c a real ladder (${shells.length} shells)`);
    const general = {
      finalResolution: parseFloat(findPair(parseStar(text), "_rlnFinalResolution") ?? ""),
      bfactor: parseFloat(findPair(parseStar(text), "_rlnBfactorUsedForSharpening") ?? ""),
      angpix: parseFloat(findPair(parseStar(text), "_rlnPixelSize") ?? ""),
    };
    ok(
      Number.isFinite(general.finalResolution) &&
        Number.isFinite(general.bfactor) &&
        Number.isFinite(general.angpix),
      "FV5d the data_general trio parses"
    );
    const verdict = postprocessVerdictOf({ shells, postprocessGeneral: general });
    ok(verdict != null, "FV5e the stub's table yields a verdict");
    if (verdict) {
      ok(
        near(general.finalResolution, Math.max(7.11 * 0.96, 2.2 * angpix), 0.05),
        `FV5f the refinement's word leads, the box floor owns the ceiling (${general.finalResolution})`
      );
      ok(
        near(verdict.official, general.finalResolution, 0.01),
        "FV5g the official number IS the star's word"
      );
      ok(
        verdict.official >= nyqRes,
        `FV5h the official never beats the box edge (${verdict.official.toFixed(2)} ≥ ${nyqRes})`
      );
      ok(
        verdict.unmasked != null && verdict.unmasked > verdict.official,
        "FV5i the unmasked crossing is the worse one"
      );
      ok(
        verdict.rawMasked != null && verdict.rawMasked < verdict.official,
        "FV5j the raw mask's crossing is the flattering one"
      );
      ok(
        verdict.clawBack != null && verdict.clawBack > 0,
        `FV5k the correction's claw is positive work (${verdict.clawBack?.toFixed(3)})`
      );
      ok(verdict.word === "modest gift", `FV5l the world's word (${verdict.word})`);
    }
  }

  // --- run B: no refinement word — the box law speaks alone ---
  const BOX_DIR = join(TMP, "box-only");
  writeMrc(join(BOX_DIR, "half.mrc"), 8);
  const rB = run(BOX_DIR);
  ok(rB.status === 0, `FV5m the box-only stub runs (exit ${rB.status})`);
  const textB = readFileSync(join(BOX_DIR, "postprocess.star"), "utf8");
  const shellsB = parseFsc(textB);
  const generalB = {
    finalResolution: parseFloat(findPair(parseStar(textB), "_rlnFinalResolution") ?? ""),
    bfactor: null,
    angpix,
  };
  ok(
    near(generalB.finalResolution, Math.max(6.0, 3.2 * angpix, 2.2 * angpix), 0.05),
    `FV5n without the refinement's word the box law speaks (${generalB.finalResolution})`
  );
  const verdictB = postprocessVerdictOf({ shells: shellsB, postprocessGeneral: generalB });
  ok(verdictB != null, "FV5o the box-only table yields a verdict");
  ok(
    verdictB?.word === "modest gift",
    `FV5p the box law's word (${verdictB?.word})`
  );

  rmSync(TMP, { recursive: true, force: true });
}

/* ---------------------------------------------------------------- */
console.log(
  failures.length === 0
    ? `\nPASS — ${pass} assertions green`
    : `\nFAIL — ${failures.length} red:\n${failures.map((f) => `  - ${f}`).join("\n")}`
);
process.exit(failures.length === 0 ? 0 : 1);

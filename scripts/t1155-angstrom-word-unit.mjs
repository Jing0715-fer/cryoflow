#!/usr/bin/env node
/**
 * t1155 — THE ANGSTROM-WORD unit: the Å / µm / B-factor fathers are the
 * ONLY rounding births (chart-rows' shared formatters, the NEW map's
 * fourth vein — the walk that followed t1154's boundary lines home).
 *
 * The t1155 window walked the percent/fraction map's remaining
 * boundaries (storage share, zoom, axis/position — all documented
 * dialects, zero drift) and then swept the Å word the same way — and
 * found the drift the Å father's own header predicted: the SAME
 * quantities wore two grains across faces. The FSC 0.143 estimate said
 * "3.2 Å" in the agent's summary (the father) and "3.24 Å" in the QC
 * report's resolution lines; the class2d judge prompt and the class
 * tool quoted the raw parseFloat float ("3.2145678 Å"); the resolution
 * chart's annotations said 2 decimals while the same SVG's y axis said
 * 1; the B-factor word existed THREE times by separate hands (the
 * agent's Guinier line, the report's Guinier verdict, the sharpening
 * weather report — agreeing by luck at 1 decimal); the postprocess
 * verdict module ran its own local fmt(). All of them died into the
 * fathers the same day. The agent-voice law's second ride: a wire
 * contract's audit ends at the last voice that speaks it — and the
 * judge PROMPT is a voice the model then repeats.
 *
 * A — the fathers run FOR REAL: the 1-decimal Å grain (half-up), the
 *     trailing-zero face ("6 Å", never "6.0 Å" — the t457 lesson), the
 *     junk face ("?"), the µm father's 3-decimal, the B-factor
 *     father's Å² face, the determinism.
 * B — the source law: the agent's three raw births dead, the report's
 *     word faces ride the fathers, the annotations ride the father,
 *     the local fmt birth dead, the sharpening words ride fmtBFactor,
 *     the DATA faces keep their grain (the report's tables), the
 *     engine's before→after dialect untouched, the qc-board's
 *     documented docstring untouched, motion-compare's digits schema
 *     untouched, the live well generation-proof.
 * C — the doctrine: the census paragraph at the father, the rounding
 *     rule's law line, the boundary enumeration.
 *
 * node scripts/unit-runner.mjs scripts/t1155-angstrom-word-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fmtAngstrom, fmtMicron, fmtBFactor } from "@/lib/chart-rows";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const fatherSrc = read("src/lib/chart-rows.ts");
const toolsSrc = read("src/lib/ai/tools.ts");
const resultsSrc = read("src/components/workflow/results/results-view.tsx");
const snapshotsSrc = read("src/lib/report-snapshots.ts");
const verdictSrc = read("src/lib/postprocess-verdict.ts");
const qcReportSrc = read("src/lib/qc-report.ts");
const qcBoardSrc = read("src/lib/qc-board.ts");
const bench488Src = read("scripts/t488-panel-grammar-bench.ts");

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- A — the fathers run FOR REAL ---------- */
console.log("A — the fathers run FOR REAL");

ok("A1 the 1-decimal Å grain — the raw float the judge prompt used to quote now folds",
  fmtAngstrom(3.2145678) === "3.2 Å" && fmtAngstrom(1.77) === "1.8 Å",
  `got ${fmtAngstrom(3.2145678)} / ${fmtAngstrom(1.77)}`);
ok("A2 the half-up edge — 3.25 speaks 3.3, never the float quirk",
  fmtAngstrom(3.25) === "3.3 Å",
  `got ${fmtAngstrom(3.25)}`);
ok("A3 the trailing-zero face — 6.04 speaks the honest \"6 Å\", never the padded \"6.0 Å\"",
  fmtAngstrom(6.04) === "6 Å" && fmtAngstrom(10.04) === "10 Å",
  `got ${fmtAngstrom(6.04)} / ${fmtAngstrom(10.04)}`);
ok("A4 the junk face — null / undefined / NaN / Infinity all speak \"?\"",
  fmtAngstrom(null) === "?" && fmtAngstrom(undefined) === "?" &&
    fmtAngstrom(NaN) === "?" && fmtAngstrom(Infinity) === "?",
  `got ${fmtAngstrom(null)} / ${fmtAngstrom(NaN)}`);
ok("A5 the µm father — the 3-decimal µm grain (the star grammar's defocus voice)",
  fmtMicron(1.2345) === "1.235 µm" && fmtMicron(0.5) === "0.5 µm" && fmtMicron(null) === "?",
  `got ${fmtMicron(1.2345)} / ${fmtMicron(0.5)}`);
ok("A6 the B-factor father — the negative sharpening slope speaks Å² at 1 decimal",
  fmtBFactor(-62.34) === "-62.3 Å²" && fmtBFactor(88.86) === "88.9 Å²" && fmtBFactor(null) === "?",
  `got ${fmtBFactor(-62.34)} / ${fmtBFactor(88.86)}`);
ok("A7 the determinism — same value, same word, twice",
  fmtAngstrom(3.2145678) === fmtAngstrom(3.2145678) &&
    fmtBFactor(-62.34) === fmtBFactor(-62.34));

/* ---------- B — the source law ---------- */
console.log("B — the source law");

ok("B1 the class table line rides the father (the per-class estimated resolution)",
  toolsSrc.includes("estimated resolution ${fmtAng(c.resolution)}") &&
    !toolsSrc.includes("estimated resolution ${c.resolution} Å"));
ok("B2 the judge PROMPT's global line rides the father — the voice the model repeats",
  toolsSrc.includes("gold-standard): ${fmtAng(stats.globalResolution)}.") &&
    !toolsSrc.includes("${stats.globalResolution} Å"));
ok("B3 the class tool's globalNote rides the father",
  toolsSrc.includes("run at ${fmtAng(stats.globalResolution)} (global)"));
ok("B4 no raw resolution interpolation survives in the agent's voice",
  !/\$\{[a-zA-Z.]*resolution\} Å/.test(toolsSrc),
  "the raw parseFloat float could read 3.2145678 Å");
ok("B5 the report's resolution lines ride the father (FSC 0.143 / 0.5 / RELION reported / Nyquist / current-best)",
  resultsSrc.includes("**${fmtAngstrom(fsc.resolutionAt143)}**") &&
    resultsSrc.includes("**${fmtAngstrom(fsc.resolutionAt05)}**") &&
    resultsSrc.includes("**${fmtAngstrom(fsc.reportedResolution)}**") &&
    resultsSrc.includes("**${fmtAngstrom(nyq)}**") &&
    resultsSrc.includes("fmtAngstrom(res.current)"));
ok("B6 the report captions ride the father — no hand toFixed Å word survives in results-view",
  resultsSrc.includes("![Resolution progress — ${fmtAngstrom(lastPt.resolution)}") &&
    !/toFixed\(\d\)\} Å(?! \/ voxel)/.test(resultsSrc),
  "the pixel word (Å / voxel) is the param identity's own boundary");
ok("B7 the CTF report line rides the fathers — µm 3-decimal, Å 1-decimal, the FOM follows the majority grain",
  resultsSrc.includes("**${fmtMicron(s.meanDefocus)}**") &&
    resultsSrc.includes("**${fmtMicron(s.maxAstigmatism)}**") &&
    resultsSrc.includes("**${fmtAngstrom(s.worstResolution)}**") &&
    resultsSrc.includes("mean FOM **${s.meanFom.toFixed(2)}**"));
ok("B8 the chart's annotation words ride the father — the labels match the axis they sit on",
  snapshotsSrc.includes("label: `best ${fmtAngstrom(best.resolution)}`") &&
    snapshotsSrc.includes("label: `current ${fmtAngstrom(last.resolution)}`"));
ok("B9 the postprocess verdict's local fmt birth is DEAD — the verdict faces ride the father (t1156 re-key: the sampling rate's slot rides fmtPixel now — the raw angpix?.toFixed(2) said \"undefined Å/px\" aloud when angpix was null, the t1156 pixel father's junk face speaks \"?\" instead)",
  !/const fmt = \(v: number\)/.test(verdictSrc) &&
    verdictSrc.includes("${fmtAngstrom(official)} final (masked, corrected)") &&
    verdictSrc.includes("${fmtAngstrom(nyquist)} at ${fmtPixel(angpix)} Å/px"));
ok("B10 the sharpening weather report rides the B-factor father — three words, one birthplace",
  verdictSrc.includes("a gentle ${fmtBFactor(bfactor)}") &&
    verdictSrc.includes("a strong ${fmtBFactor(bfactor)}") &&
    verdictSrc.includes("an aggressive ${fmtBFactor(bfactor)}") &&
    !verdictSrc.includes("bfactor.toFixed"));
ok("B11 the report's Guinier verdict rides the B-factor father; the range word documented as its own dialect",
  qcReportSrc.includes("B-factor ${fmtBFactor(d.bfactor)} (used for sharpening)") &&
    qcReportSrc.includes("the range word is its own dialect"));
ok("B12 the DATA faces keep their grain — the report's tables are data, not words",
  snapshotsSrc.includes("p.resolution.toFixed(2)} |") &&
    read("src/lib/fsc-snapshot.ts").includes("| Resolution (Å) |"),
  "the trajectory markdown and the per-shell FSC table speak their own precision");
ok("B13 the engine's before→after dialect untouched — the delta claim needs the 2nd decimal (the engine's voice)",
  read("src/lib/relion/engine.ts").includes("meanResolutionBefore.toFixed(2)}→${s.meanResolutionAfter.toFixed(2)} Å"));
ok("B14 the qc-board's documented grain stands — its own docstring is the doctrine",
  qcBoardSrc.includes("Resolution speaks Å with one decimal, astigmatism µm with two") &&
    qcBoardSrc.includes("FOM three decimals"));
ok("B15 motion-compare's digits schema untouched — each lens declares its own grain",
  read("src/lib/motion-compare.ts").includes("digits: 2"));
ok("B16 the live well is generation-proof — no hardcoded projectId in t488's fixture lookup",
  bench488Src.includes('where: { type: "ctffind" }') &&
    !bench488Src.includes("cmukrk2yy0000rjobryvy0pzu"),
  "the old generation's id rotted the well into a permanent skip");
ok("B17 the fathers stay pure — no fs, no db, no clock in the formatter births",
  !/from "(node:)?fs"|from "@\/lib\/db"|Date\.now/.test(fatherSrc));

/* ---------- C — the doctrine ---------- */
console.log("C — the doctrine");

ok("C1 the census paragraph at the father — the drift the header predicted, found and cured",
  fatherSrc.includes("the drift the header predicted, found and cured") &&
    fatherSrc.includes("All of them died into these fathers the same day"));
ok("C2 the rounding rule's law line — two faces rounded in one place, or they drift one decimal at a time",
  fatherSrc.includes("must be ROUNDED in one place, or the faces will"));
ok("C3 the boundary enumeration — data faces, the engine's voice, the digits schema, the param vocabulary",
  fatherSrc.includes("data faces, not words") &&
    fatherSrc.includes("the engine's rebalance") &&
    fatherSrc.includes("motion-compare's `digits: 2`") &&
    fatherSrc.includes("the editor's param"));

console.log(`\nANGSTROM-WORD-UNIT t1155: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

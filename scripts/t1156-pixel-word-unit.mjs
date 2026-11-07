#!/usr/bin/env node
/**
 * t1156 — THE PIXEL-WORD unit: the sampling rate's precision father
 * (fmtPixel, chart-rows — the NEW map's fifth vein, t1155's NEXT-VEIN
 * candidate walked home).
 *
 * The t1156 window hunted the Å/voxel word's four faces (the editor
 * param, the map imports' toFixed(2), the report's map chip, the
 * remote-run diagnostics' toFixed(4)) and found the sampling rate
 * wearing THREE precisions and NO father: the map cards rounded
 * locally (toFixed(2)), the particle browser and the import gallery
 * spoke the RAW STAR float unrounded ("1.23666667 Å/px" beside the
 * report's "1.24 Å / voxel" for the SAME map), and the postprocess
 * verdict interpolated `undefined` outright when its angpix was null
 * ("at undefined Å/px" — a template-literal interpolation of an
 * optional chain's undefined). The ONE grain is 2 decimals — the
 * editor's own `step: 0.01` is the identity's native grain — and the
 * unit WORDS are a DOCUMENTED FAMILY, not drift: "Å/px" on the
 * diagnostics and receipts, "Å / voxel" on the map cards, "Å" on the
 * editor's param cup and the engine's map-import log (RELION's own
 * convention). The father returns the NUMBER WORD ONLY; each face
 * keeps its unit; the DIGITS have one birthplace.
 *
 * A — the father runs FOR REAL: the 2-decimal grain on the MRC
 *     header's division (1.236666… → "1.24"), the identity values,
 *     the trailing-zero face (honest fall, never "1.20"), the junk
 *     face ("?"), the half-up edge on an exactly-representable value,
 *     the determinism.
 * B — the source law: the map cards ride the father, the raw STAR
 *     floats dead, the gallery's unit split healed ("Å" → "Å/px" on
 *     the StatChip), the verdict's undefined sentence dead, the
 *     remote-run 4-decimal diagnostic face kept BY CONTRACT with its
 *     boundary comment, the editor cup and the engine log untouched.
 * C — the doctrine: the census paragraph at the father, the
 *     precision-vs-unit judgment (family, not drift), the 4-decimal
 *     boundary drawn at BOTH ends (the father's header and
 *     remote-run's own sentences).
 *
 * Census slot 95. Run: node scripts/unit-runner.mjs scripts/t1156-pixel-word-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fmtPixel } from "@/lib/chart-rows";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const fatherSrc = read("src/lib/chart-rows.ts");
const resultsSrc = read("src/components/workflow/results/results-view.tsx");
const refCardSrc = read("src/components/workflow/reference-map-card.tsx");
const browserSrc = read("src/components/workflow/results/particle-browser.tsx");
const gallerySrc = read("src/components/workflow/results/import-gallery.tsx");
const verdictSrc = read("src/lib/postprocess-verdict.ts");
const remoteSrc = read("src/lib/remote/remote-run.ts");
const engineSrc = read("src/lib/relion/engine.ts");
const workflowSrc = read("src/lib/workflow.ts");

let pass = 0;
let fail = 0;
/** the doctrine comments speak across wrapped lines — join them before
 *  the includes() assertions, or a reflow REDs a sentence that is true. */
const prose = (src) => src.replace(/\n\s*(\/\/|\*)\s?/g, " ");
function ok(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- A — the father runs FOR REAL ---------- */
console.log("A — the father runs FOR REAL");

ok("A1 the 2-decimal grain — the MRC header's division folds",
  fmtPixel(1.2366666666666667) === "1.24" && fmtPixel(0.885) === "0.89",
  `got ${fmtPixel(1.2366666666666667)} / ${fmtPixel(0.885)}`);
ok("A2 the identity values — a STAR-declared 1.24 speaks 1.24",
  fmtPixel(1.24) === "1.24" && fmtPixel(1.77) === "1.77" && fmtPixel(1.35) === "1.35",
  `got ${fmtPixel(1.24)} / ${fmtPixel(1.77)} / ${fmtPixel(1.35)}`);
ok("A3 the trailing-zero face — 1.2 speaks the honest \"1.2\", never the padded \"1.20\"",
  fmtPixel(1.2) === "1.2" && fmtPixel(2) === "2" && fmtPixel(1.1) === "1.1",
  `got ${fmtPixel(1.2)} / ${fmtPixel(2)} / ${fmtPixel(1.1)}`);
ok("A4 the junk face — null / undefined / NaN / Infinity all speak \"?\"",
  fmtPixel(null) === "?" && fmtPixel(undefined) === "?" &&
    fmtPixel(NaN) === "?" && fmtPixel(Infinity) === "?",
  `got ${fmtPixel(null)} / ${fmtPixel(NaN)}`);
ok("A5 the half-up edge on an exactly-representable value — 0.125 speaks 0.13",
  fmtPixel(0.125) === "0.13",
  `got ${fmtPixel(0.125)}`);
ok("A6 the determinism — same value, same word, twice",
  fmtPixel(1.2366666666666667) === fmtPixel(1.2366666666666667) &&
    fmtPixel(0.885) === fmtPixel(0.885));

/* ---------- B — the source law ---------- */
console.log("B — the source law");

ok("B1 the map cards ride the father — the local toFixed(2) births dead on BOTH cards",
  resultsSrc.includes("{fmtPixel(map.pixel)} Å / voxel") &&
    refCardSrc.includes("{fmtPixel(map.pixel)} Å / voxel") &&
    !resultsSrc.includes("map.pixel.toFixed") &&
    !refCardSrc.includes("map.pixel.toFixed"));
ok("B2 the particle browser's raw float dead — the optics chip rides the father",
  browserSrc.includes("{fmtPixel(o.pixelSize)} Å/px") &&
    !browserSrc.includes("{o.pixelSize} Å/px"));
ok("B3 the gallery's two faces ride the father AND speak ONE unit — the Å/Åpx split healed",
  gallerySrc.includes("${fmtPixel(data.pixelSize)} Å/px") &&
    gallerySrc.includes("${fmtPixel(data.pixelSize)} Å/px") &&
    !/\$\{data\.pixelSize\} Å`/.test(gallerySrc) &&
    !/\$\{data\.pixelSize\} Å\/px/.test(gallerySrc),
  "the StatChip said \"1.24 Å\" while the dialog said \"1.24 Å/px\" for the SAME optics row");
ok("B4 the verdict's undefined sentence dead — the null angpix speaks \"?\" now",
  verdictSrc.includes("at ${fmtPixel(angpix)} Å/px") &&
    !verdictSrc.includes("angpix?.toFixed(2)"));
ok("B5 the remote-run diagnostic face kept BY CONTRACT — 4 decimals with the boundary comment",
  (remoteSrc.match(/toFixed\(4\)\} Å\/px/g) || []).length >= 6 &&
    prose(remoteSrc).includes("DIAGNOSTIC precision face") &&
    prose(remoteSrc).includes("the fmtPixel father in chart-rows"));
ok("B6 the editor's word cup untouched — the param vocabulary keeps \"Å\" (the t1155 boundary)",
  workflowSrc.includes('unit: "Å"') &&
    workflowSrc.includes('step: 0.01'),
  "the editor's step is the identity's native grain — the father quotes it");
ok("B7 the engine's map-import log untouched — the engine's own dialect keeps \"pixel X Å\"",
  engineSrc.includes("pixel ${pixel.toFixed(2)} Å"));
ok("B8 the father stays pure — no fs, no db, no clock in the pixel birth",
  !/from "(node:)?fs"|from "@\/lib\/db"|Date\.now/.test(fatherSrc.split("fmtPixel")[1] ?? ""));

/* ---------- C — the doctrine ---------- */
console.log("C — the doctrine");

ok("C1 the census paragraph at the father — the shape-hunt's confession",
  prose(fatherSrc).includes("wearing THREE precisions and NO father") &&
    prose(fatherSrc).includes('"at undefined Å/px"'));
ok("C2 the precision-vs-unit judgment — the units are a DOCUMENTED FAMILY, the digits one birthplace",
  prose(fatherSrc).includes("DOCUMENTED FAMILY, not drift") &&
    prose(fatherSrc).includes("the DIGITS now have one birthplace") &&
    prose(fatherSrc).includes('"Å / voxel"') &&
    prose(fatherSrc).includes('"Å/px"'));
ok("C3 the 4-decimal boundary drawn at BOTH ends — the father's header AND remote-run's sentences",
  prose(fatherSrc).includes("Kept at 4 decimals by contract") &&
    prose(remoteSrc).includes("keep toFixed(4) BY"));

console.log(`\nPIXEL-WORD-UNIT t1156: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

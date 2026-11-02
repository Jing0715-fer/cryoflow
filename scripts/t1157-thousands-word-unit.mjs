#!/usr/bin/env node
/**
 * t1157 — THE THOUSANDS-WORD unit: the count faces ride the ONE
 * father (formatCountFull, result-counts t347) and the engine's words
 * pin their locale BY LITERAL (the NEW map's sixth vein, t1157's
 * candidate walked home).
 *
 * The t1157 window's shape-hunt counted 127 toLocaleString births and
 * found the thousands word wearing every locale its host happened to
 * speak: 79 count faces called bare `toLocaleString()` — the UI chips,
 * the storage lens, the class gallery, AND the engine's own result
 * words, which the result-counts parser READS with a comma-only
 * contract (`toNum` strips ","; a de-DE server's "82.000" would parse
 * as 82 and the card's particle badge would lie). The codemod folded
 * them in one counted pass: the engine's and remote-run's words pin
 * "en-US" BY LITERAL (the t1152 voice boundary keeps the engine's
 * dialect its own — a locale pin is not a voice change), the UI/lib
 * faces ride the father, the shadcn chart base pins its own literal
 * (the base stays self-contained), and every `new Date(...)` call
 * stays bare BY DESIGN — the date-time face is a DIFFERENT word that
 * rides the browser's locale on purpose.
 *
 * A — the fathers run FOR REAL: formatCountFull's en-US shape on the
 *     counts the receipts actually speak, formatCountCompact's k/M
 *     bands, the determinism.
 * B — the source law: the engine's bare births dead + the literal pin
 *     present (16 lines, 22 calls), remoteCountLead's pin (the
 *     parser's own input), the chart base's pin, the UI faces riding
 *     the father (the import census), the surviving bare births are
 *     EXACTLY the temporal faces, the parser's comma contract intact.
 * C — the doctrine: the census paragraph at the father, the voice
 *     boundary judgment (a locale pin is not a voice change), the
 *     temporal boundary (the date-time face is another claim).
 *
 * Census slot 96. Run: node scripts/unit-runner.mjs scripts/t1157-thousands-word-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { formatCountFull, formatCountCompact } from "@/lib/result-counts";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const fatherSrc = read("src/lib/result-counts.ts");
const engineSrc = read("src/lib/relion/engine.ts");
const remoteSrc = read("src/lib/remote/remote-run.ts");
const chartBaseSrc = read("src/components/ui/chart.tsx");
const inspectorSrc = read("src/components/workflow/job-inspector.tsx");
const storageLensSrc = read("src/lib/storage-run-lens.ts");

/** every bare toLocaleString() birth left in src — the expected
 *  survivors are the TEMPORAL faces (new Date) + the census comment's
 *  own quoted literal. */
const glob = (p) => p;
const files = [
  "src/lib/relion/engine.ts", "src/lib/remote/remote-run.ts",
  "src/components/ui/chart.tsx", "src/components/ai/assistant-panel.tsx",
  "src/components/workflow/storage-dialog.tsx", "src/components/workflow/job-inspector.tsx",
  "src/components/workflow/remote-cluster-dialog.tsx", "src/components/workflow/results/rebalance-report.tsx",
  "src/components/workflow/results/picks-map.tsx", "src/components/workflow/results/particle-browser.tsx",
  "src/components/workflow/class-gallery.tsx", "src/components/workflow/system-diagnostics-dialog.tsx",
  "src/components/workflow/results/results-view.tsx", "src/components/workflow/results/molstar-embed.tsx",
  "src/components/workflow/results/cryosparc-angle-plot.tsx", "src/components/workflow/results/class-distribution-chart.tsx",
  "src/components/workflow/results/class-averages-teaser.tsx", "src/components/workflow/results/angular-distribution-chart.tsx",
  "src/components/workflow/path-browser-dialog.tsx", "src/components/workflow/cluster-usage-panel.tsx",
  "src/components/workflow/results/class-iteration-gallery.tsx", "src/components/workflow/pipeline-kpi.tsx",
  "src/components/workflow/pipeline-analytics.tsx", "src/components/workflow/kpi-sparkline.tsx",
  "src/components/workflow/job-card.tsx", "src/components/workflow/hpc-queue-sim.tsx",
  "src/lib/storage-run-lens.ts", "src/lib/file-ledger.ts",
  "src/lib/result-counts.ts",
];
const bareByFile = new Map(files.map((f) => [f, (read(f).match(/toLocaleString\(\)/g) || []).length]));
const bareTotal = [...bareByFile.values()].reduce((a, b) => a + b, 0);
const bareTemporal = files
  .map((f) => (read(f).match(/new Date\([^()]*\)\.toLocaleString\(\)/g) || []).length)
  .reduce((a, b) => a + b, 0);

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

/* ---------- A — the fathers run FOR REAL ---------- */
console.log("A — the fathers run FOR REAL");

ok("A1 the en-US shape — the receipt counts speak commas",
  formatCountFull(82000) === "82,000" && formatCountFull(1234567) === "1,234,567" && formatCountFull(382) === "382",
  `got ${formatCountFull(82000)} / ${formatCountFull(1234567)} / ${formatCountFull(382)}`);
ok("A2 the compact bands — 82k / 1.2M / the full word under 10k",
  formatCountCompact(82000) === "82k" && formatCountCompact(1234567) === "1.2M" && formatCountCompact(382) === "382",
  `got ${formatCountCompact(82000)} / ${formatCountCompact(1234567)} / ${formatCountCompact(382)}`);
ok("A3 the determinism — same value, same word, twice",
  formatCountFull(82000) === formatCountFull(82000) &&
    formatCountCompact(82000) === formatCountCompact(82000));

/* ---------- B — the source law ---------- */
console.log("B — the source law");

ok("B1 the engine's bare births dead — every count call pins en-US BY LITERAL",
  !engineSrc.includes(".toLocaleString()") &&
    (engineSrc.match(/toLocaleString\("en-US"\)/g) || []).length >= 16,
  `bare: ${(engineSrc.match(/toLocaleString\(\)/g) || []).length}, pinned: ${(engineSrc.match(/toLocaleString\("en-US"\)/g) || []).length}`);
ok("B2 remoteCountLead's pin — the parser's own INPUT speaks the contract",
  remoteSrc.includes('const fmt = n.toLocaleString("en-US");') &&
    !remoteSrc.includes(".toLocaleString()"));
ok("B3 the shadcn chart base pins its own literal — self-contained, no app import",
  !chartBaseSrc.includes(".toLocaleString()") &&
    chartBaseSrc.includes('.toLocaleString("en-US")') &&
    !chartBaseSrc.includes("formatCountFull"));
ok("B4 the UI faces ride the father — the import census counts 21 riders",
  files.filter((f) => !f.includes("engine") && !f.includes("remote-run") && !f.includes("ui/chart"))
    .filter((f) => read(f).includes('from "@/lib/result-counts"')).length >= 21,
  "the codemod's 25 face files − 4 pure-temporal files (their only bare births were Date calls) = 21 riders");
ok("B5 the surviving bare births are EXACTLY the temporal faces + the census's quoted literal",
  bareTotal === bareTemporal + 1,
  `bare ${bareTotal} = temporal ${bareTemporal} + 1 (the father's own comment)`);
ok("B6 the temporal faces live — the date-time word rides the browser's locale BY DESIGN",
  bareTemporal >= 12,
  `temporal births: ${bareTemporal}`);
ok("B7 the parser's comma contract intact — toNum strips commas, the receipt dialect unchanged",
  fatherSrc.includes('s.replace(/,/g, "")') &&
    fatherSrc.includes('"82,000 particles extracted"'),
  "the engine's en-US pin feeds the regex that only knows commas");

/* ---------- C — the doctrine ---------- */
console.log("C — the doctrine");

ok("C1 the census paragraph at the father — the codemod's counted pass",
  prose(fatherSrc).includes("the THOUSANDS WORD's census") &&
    prose(fatherSrc).includes("79 of the app's count faces") &&
    prose(fatherSrc).includes("would parse as 82"));
ok("C2 the voice boundary judgment — a locale pin is NOT a voice change",
  prose(fatherSrc).includes("the engine's dialect its own") &&
    prose(fatherSrc).includes("the parser's contract made unilateral-proof"));
ok("C3 the temporal boundary — the date-time face is another claim, kept bare",
  prose(fatherSrc).includes("the date-time face") &&
    prose(fatherSrc).includes("riding the browser's locale on purpose"));

console.log(`\nTHOUSANDS-WORD-UNIT t1157: ${pass}/${pass + fail} green`);
glob; // keep the helper named (the runner strips nothing)
process.exit(fail === 0 ? 0 : 1);

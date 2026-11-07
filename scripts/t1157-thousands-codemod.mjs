#!/usr/bin/env node
/**
 * t1157 — the thousands word's codemod (the text-surgery law: a formal
 * script with counted anchors, never an inline regex injection).
 *
 * The map: 127 toLocaleString births, THREE classes:
 *   ENGINE  — engine.ts (16) + remote-run.ts (2, incl. the
 *             remoteCountLead father whose words the result-counts
 *             parser READS): the locale is PINNED to "en-US" by
 *             literal. The engine's voice keeps its dialect (the
 *             t1152 boundary — no father import); the PIN is not a
 *             voice change (the sandbox already speaks en-US), it is
 *             the contract the parser depends on made unilateral-proof.
 *   FACES   — the UI/lib components' count faces: they ride the ONE
 *             father formatCountFull (result-counts, t347) — the
 *             1:1 wrap changes nothing the eye can see (en-US was
 *             already the sandbox's default) and gives the digits one
 *             birthplace.
 *   BASE    — ui/chart.tsx (the shadcn base): pinned by literal too —
 *             the base stays self-contained, no app import.
 *   TEMPORAL — every `new Date(...).toLocaleString()` is a DIFFERENT
 *             word (the date-time face) and is NOT touched: it rides
 *             the browser's locale by design, a separate census if it
 *             ever drifts.
 * Idempotent: re-running finds zero unparameterized count births and
 * reports as much.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PIN_FILES = [
  "src/lib/relion/engine.ts",
  "src/lib/remote/remote-run.ts",
  "src/components/ui/chart.tsx",
];
const FACE_FILES = [
  "src/components/workflow/storage-dialog.tsx",
  "src/components/workflow/job-inspector.tsx",
  "src/components/workflow/remote-cluster-dialog.tsx",
  "src/components/workflow/results/rebalance-report.tsx",
  "src/components/workflow/results/picks-map.tsx",
  "src/components/workflow/results/particle-browser.tsx",
  "src/components/workflow/class-gallery.tsx",
  "src/components/workflow/system-diagnostics-dialog.tsx",
  "src/components/workflow/results/results-view.tsx",
  "src/components/workflow/results/molstar-embed.tsx",
  "src/components/workflow/results/cryosparc-angle-plot.tsx",
  "src/components/workflow/results/class-distribution-chart.tsx",
  "src/components/workflow/results/class-averages-teaser.tsx",
  "src/components/workflow/results/angular-distribution-chart.tsx",
  "src/components/workflow/path-browser-dialog.tsx",
  "src/components/workflow/cluster-usage-panel.tsx",
  "src/components/ai/assistant-panel.tsx",
  "src/components/workflow/results/class-iteration-gallery.tsx",
  "src/components/workflow/pipeline-kpi.tsx",
  "src/components/workflow/pipeline-analytics.tsx",
  "src/components/workflow/kpi-sparkline.tsx",
  "src/components/workflow/job-card.tsx",
  "src/components/workflow/hpc-queue-sim.tsx",
  "src/lib/storage-run-lens.ts",
  "src/lib/file-ledger.ts",
];
const DATE_GUARD = /new Date\([^()]*\)\.toLocaleString\(\)/g;
const COUNT_BIRTH = /([\w\.\[\]]+)\.toLocaleString\(\)(?!")/g;
const IMPORT_LINE = 'import { formatCountFull } from "@/lib/result-counts"; // t1157 — the thousands word rides its ONE father (the locale pin lives in result-counts, the parser\'s own contract)';

let pinned = 0;
let wrapped = 0;
const touched = [];

for (const f of PIN_FILES) {
  const src = readFileSync(f, "utf8");
  const { before, after } = pin(src);
  if (after !== before) {
    writeFileSync(f, after);
    pinned += before.match(COUNT_BIRTH)?.length ?? 0;
    touched.push(`${f} (pinned)`);
  }
}

for (const f of FACE_FILES) {
  const src = readFileSync(f, "utf8");
  // protect the temporal faces, wrap the count faces, restore the temporal
  const dates = [];
  const guarded = src.replace(DATE_GUARD, (m) => {
    dates.push(m);
    return `@@DATE${dates.length - 1}@@`;
  });
  const { before, after } = wrap(guarded);
  let out = after.replace(/@@DATE(\d+)@@/g, (_, i) => dates[Number(i)]);
  if (out !== src) {
    if (!out.includes('from "@/lib/result-counts"')) {
      const lines = out.split("\n");
      let lastImport = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^import\b/.test(lines[i])) lastImport = i;
      }
      lines.splice(lastImport + 1, 0, IMPORT_LINE);
      out = lines.join("\n");
    }
    writeFileSync(f, out);
    wrapped += before.match(COUNT_BIRTH)?.length ?? 0;
    touched.push(`${f} (wrapped)`);
  }
}

function pin(s) {
  return { before: s, after: s.replace(COUNT_BIRTH, '$1.toLocaleString("en-US")') };
}
function wrap(s) {
  return {
    before: s,
    after: s.replace(COUNT_BIRTH, "formatCountFull($1)"),
  };
}

console.log(`pinned (literal en-US): ${pinned}`);
console.log(`wrapped (father ride): ${wrapped}`);
console.log(touched.map((t) => "  " + t).join("\n"));

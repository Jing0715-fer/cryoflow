#!/usr/bin/env node
/**
 * t869 — the propagation patch: the arrival laws ride the family's
 * remaining carriers (t862/t863/t864/t865/t866), the t844 pattern's
 * one-implementation form — the carriers import scripts/arrival-laws.mjs
 * instead of inlining the laws a fifth time. Every bare
 * ab("open http://localhost:3000") becomes openRetry + the roster-arrival
 * door, labeled honestly from its face (the clean room's reload speaks
 * its own name). Idempotent: a second run changes nothing.
 */
import { readFileSync, writeFileSync } from "node:fs";

const CARRIERS = [
  "scripts/t862-overlay-a11y.mjs",
  "scripts/t863-job-panel-a11y.mjs",
  "scripts/t864-report-diff-a11y.mjs",
  "scripts/t865-results-a11y.mjs",
  "scripts/t866-star-table-a11y.mjs",
];
const RULER_IMPORT = 'import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";';
const LAWS_IMPORT =
  'import { arrivalDoor, openRetry } from "./arrival-laws.mjs"; // t869 — the arrival laws aboard (the t846/t867 pattern, one implementation)';

for (const file of CARRIERS) {
  let src = readFileSync(file, "utf8");
  if (src.includes('from "./arrival-laws.mjs"')) {
    console.log(`${file}: the laws already ride — skipped`);
    continue;
  }
  if (!src.includes(RULER_IMPORT)) {
    console.error(`${file}: the shared-ruler import anchor missing — stopped honestly`);
    process.exit(1);
  }
  src = src.replace(RULER_IMPORT, `${RULER_IMPORT}\n${LAWS_IMPORT}`);

  // label each load from its face: a seed-clearing reload = the clean
  // room's; a restore/world-back face = the restored canvas; else opening.
  let count = 0;
  const re = /ab\("open http:\/\/localhost:3000"\);\n(\s*)sleep\((\d+)\);/g;
  src = src.replace(re, (match, indent, secs, offset) => {
    const before = src.slice(Math.max(0, offset - 900), offset);
    let label = "the opening canvas";
    if (/localStorage\.setItem\("cryoflow\.selectedJob\.v1"[^\n]*\n[^]*$/.test(before.slice(before.lastIndexOf("console.log")))) {
      label = "the clean room's reload";
    }
    const faceLine = before.slice(before.lastIndexOf("console.log")).trim();
    if (/world back|Restore|restored canvas/i.test(faceLine)) label = "the restored canvas";
    count++;
    return `openRetry("http://localhost:3000");\n${indent}sleep(${secs});\n${indent}await arrivalDoor("${label}");`;
  });
  if (count === 0) {
    console.error(`${file}: no bare loads found — the anchor moved, stopped honestly`);
    process.exit(1);
  }
  writeFileSync(file, src);
  console.log(`${file}: ${count} load(s) walk through the doors now`);
}
console.log("propagation complete");

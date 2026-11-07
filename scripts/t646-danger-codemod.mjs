#!/usr/bin/env node
// t646 — danger codemod: sweep the SAFE census buckets to the semantic
// token vocabulary (text-danger / bg-danger[/α] / border-danger[/α]).
//
// Law of the sweep (t646):
//   1. Legislation MUST land before this codemod (globals.css --danger +
//      @theme inline mapping) — a class with no theme token generates no
//      rule (the Task 175 silent-generation family).
//   2. INK_PAIR folds ONLY prefix-less base pairs. Prefixed pairs
//      (hover:text-rose-700 dark:hover:text-rose-200) encode a hover
//      shade LADDER — folding would kill the affordance, so they stay.
//   3. bg/border/ring sweeps preserve their variant prefix (hover:,
//      group-hover:, dark:hover: stay attached).
//   4. Content-level exemptions protect CATEGORY identity (not danger):
//      header.tsx references2d hue ternaries, fsc-chart masked-curve
//      legend, fsc-compare-dialog series colors (whole file).
//   5. The dark flip is a documented canonicalization: --danger is
//      rose-600 (light) / rose-400 (dark); surfaces that had no dark
//      variant (bg-rose-500 washes/dots) gain the 400-flip by design.
//
// Usage: node scripts/t646-danger-codemod.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const SKIP_FILES = new Set([
  "src/lib/workflow.ts", // category color map + palette names (identity, not danger)
  "src/components/workflow/results/fsc-compare-dialog.tsx", // FSC series colors (curve identity)
]);
// content-level exemptions: a line carrying category identity is never swept
const SKIP_LINE_IF = [
  { file: "src/components/workflow/header.tsx", test: (l) => l.includes('=== "rose"') },
  { file: "src/components/workflow/results/fsc-chart.tsx", test: (l) => l.includes("linear-gradient(90deg, currentColor") },
];

const RULES = [
  ["INK_PAIR", [/(?<![\w:-])text-(?:rose|red)-[567]00 dark:text-(?:rose|red)-[3456]00/g, "text-danger"]],
  ["SOFT", [/((?:[a-z-]+:)*)bg-(?:rose|red)-500\/(\d|\[0?\.\d+\])(?![\w-])/g, "$1bg-danger/$2"]],
  ["BORDER", [/((?:[a-z-]+:)*)border-(?:rose|red)-500(\/(?:\d|\[0?\.\d+\]))?(?![\w/-])/g, "$1border-danger$2"]],
  ["RING", [/((?:[a-z-]+:)*)ring-(?:rose|red)-500(\/(?:\d|\[0?\.\d+\]))?(?![\w/-])/g, "$1ring-danger$2"]],
  ["SOLID", [/((?:[a-z-]+:)*)bg-(?:rose|red)-500(?![\w./-])/g, "$1bg-danger"]],
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const dry = process.argv.includes("--dry");
const files = walk(ROOT).filter((f) => !SKIP_FILES.has(f.replaceAll("\\", "/")));
const counts = {};
let filesTouched = 0;

for (const f of files) {
  const rel = f.replaceAll("\\", "/");
  const lines = readFileSync(f, "utf8").split("\n");
  let fileChanged = 0;
  // t646 lesson — tally BEFORE writing: the applied pass reads converted
  // content otherwise and reports zeros (the first run's bug, kept honest).
  const out = lines.map((line, idx) => {
    if (SKIP_LINE_IF.some(({ file, test }) => file === rel && test(line))) return line;
    let l = line;
    for (const [bucket, [re, sub]] of RULES) {
      re.lastIndex = 0;
      const m = l.match(re);
      if (m) counts[bucket] = (counts[bucket] ?? 0) + m.length;
      const before = l;
      l = l.replace(re, sub);
      if (l !== before) fileChanged++;
    }
    return l;
  });
  if (!dry && fileChanged) {
    writeFileSync(f, out.join("\n"));
    filesTouched++;
  } else if (dry && fileChanged) {
    filesTouched++;
  }
}

console.log(`== t646 danger codemod ${dry ? "(DRY)" : "(APPLIED)"} ==`);
for (const [b, n] of Object.entries(counts)) console.log(`  ${b.padEnd(10)} ${n}`);
console.log(`  files to touch: ${filesTouched}`);
if (dry) console.log("  (--dry — nothing written; re-run without --dry to apply)");

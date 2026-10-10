#!/usr/bin/env node
// t649 — danger hue-name retirement codemod (rose/red → danger rungs).
//
// One rule, two verdicts (the t648 shape, one hue family further):
//   ROSE — pure rename, zero-pixel. rose-NNN → danger-NNN keeps every
//          prefix, every alpha, every dark: twin. The rung values are
//          the palette verbatim (globals.css t649 block), so the class
//          renders the same oklch under a semantic name.
//   RED  — documented pixel change. t646 pinned --danger/--destructive
//          to rose-600's oklch (hue unification verdict); the red
//          dialect's survivors now follow that rose base. 12 sites,
//          each role-read by hand (11 danger semantics + 1 identity
//          exemption below).
//
// Exemptions (the census must mirror these exactly):
//   FILES  src/lib/workflow.ts                 — references2d palette
//                                              identity (t646/t647 verdict)
//          src/components/workflow/results/fsc-compare-dialog.tsx
//   LINES  toast.tsx        comment lines      — Task 175 verdict record
//           (any trimmed-starts-with-"//" line, all files, is skipped:
//            comments are history, not field)
//          header.tsx       '=== "rose"'       — category identity rows
//          fsc-chart.tsx    legend gradient    — series-color swatch
//          molstar-embed.tsx REC badge        — recording red (media
//                                              convention), not danger
//
// Mechanics carry the scar tissue: count-before-write (t647 tally bug),
// dry-run first (t646 globals.css bite), rung-coverage FATAL (t648 —
// 50/950 are NOT legislated; a hit means the field has a shade the law
// doesn't cover and the sweep must stop), idempotent re-run = 0.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const SKIP_FILES = new Set([
  "src/lib/workflow.ts",
  "src/components/workflow/results/fsc-compare-dialog.tsx",
]);
const SKIP_LINE_IF = [
  { file: "src/components/workflow/header.tsx", test: (l) => l.includes('=== "rose"') },
  { file: "src/components/workflow/results/fsc-chart.tsx", test: (l) => l.includes("linear-gradient(90deg, currentColor") },
  { file: "src/components/workflow/results/molstar-embed.tsx", test: (l) => l.includes("bg-red-600/90") },
];
const LEGAL_RUNGS = new Set(["50","100","200","300","400","500","600","700","800","900","950"]);

const SITE = /(?<![\w-])((?:[a-z-]+:)*)((?:text|bg|border|ring|from|via|to|fill|stroke|outline|decoration|divide|shadow|accent|caret)(?:-(?:x|y|t|b|l|r|s|e|offset))?)-(rose|red)-(\d{2,3})(\/(?:\d+|\[0?\.\d+\]))?(?![\w/-])/g;

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
let total = 0;
const perFile = {};
const skipped = [];

for (const f of files) {
  const rel = f.replaceAll("\\", "/");
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  const outLines = [];
  let fileCount = 0;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const isComment = line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("/*");
    const lineSkip = isComment || SKIP_LINE_IF.some(({ file, test }) => file === rel && test(line));
    if (lineSkip) {
      if (SITE.test(line)) skipped.push(`${rel}:${i + 1}`);
      SITE.lastIndex = 0;
      outLines.push(line);
      continue;
    }
    SITE.lastIndex = 0;
    let m;
    while ((m = SITE.exec(line))) {
      if (!LEGAL_RUNGS.has(m[4])) {
        console.error(`FATAL: uncovered rung ${m[3]}-${m[4]} at ${rel}:${i + 1} — legislate before sweeping`);
        process.exit(1);
      }
    }
    SITE.lastIndex = 0;
    const replaced = line.replace(SITE, (_all, prefix, prop, hue, rung, alpha) => {
      fileCount++;
      return `${prefix}${prop}-danger-${rung}${alpha ?? ""}`;
    });
    outLines.push(replaced);
  }
  if (fileCount) {
    perFile[rel] = fileCount;
    total += fileCount;
    if (!dry) writeFileSync(f, outLines.join("\n"));
  }
}

console.log(`t649 danger-rung codemod ${dry ? "(DRY)" : "(APPLIED)"}: ${total} sites / ${Object.keys(perFile).length} files`);
for (const [f, c] of Object.entries(perFile).sort((a, b) => b[1] - a[1])) console.log(`  ${c}  ${f}`);
if (skipped.length) {
  console.log(`skipped (exempt lines carrying rose/red):`);
  for (const s of skipped) console.log(`  ${s}`);
}

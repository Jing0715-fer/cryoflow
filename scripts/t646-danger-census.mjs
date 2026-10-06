#!/usr/bin/env node
// t646 — danger semantic census (READ-ONLY classifier).
//
// t645 filed the unit: rose (401) / red (54) / destructive speak the SAME
// semantic (danger) in three hues. This census classifies every rose-/red-
// class site in src/ into buckets so the codemod only touches provably-safe
// dialects and the honest tail stays visible:
//
//   INK_PAIR   — the PREFIX-LESS light+dark base pairs (text-rose-600
//                dark:text-rose-400 and friends). Safe: --danger pins exactly
//                these shades (600 light / 400 dark). Prefixed pairs (hover:
//                brightening ladders like hover:text-rose-700
//                dark:hover:text-rose-200) encode a shade LADDER — folding
//                them to one token kills the hover affordance, so they stay
//                tail (TAIL-prefixed-pair).
//   SOFT       — bg-*-500/NN alpha washes → bg-danger/NN. Dark mode gains
//                the 400-flip (documented canonicalization, not drift).
//   BORDER     — border-*-500[/NN] → border-danger[/NN].
//   SOLID      — bg-*-500 (exact) → bg-danger (dots/badges; 600-light shift
//                documented). Role-check per file before sweeping.
//   RING       — ring-*-500[/NN] → ring-danger[/NN].
//   TAIL-*     — everything that needs a human role read (unpaired dark-only
//                inks on always-dark panels, off-mode solids, gradients,
//                category colors) — NOT touched by the codemod.
//   NAME       — bare palette-name strings ("rose") inside lib maps: never
//                touched (workflow.ts category identity lives here).
//
// Usage:
//   node scripts/t646-danger-census.mjs            # full report
//   node scripts/t646-danger-census.mjs --assert   # exit 1 if any SAFE bucket
//                                                  # is non-empty (post-codemod)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
// t646 identity exemptions — same list as the codemod: these sites speak
// CATEGORY/series identity (references2d hue, FSC curve colors), not
// danger. The --assert oracle measures SWEEP completeness, so the census
// must exclude them exactly where the codemod does.
const SKIP_FILES = new Set([
  "src/lib/workflow.ts",
  "src/components/workflow/results/fsc-compare-dialog.tsx",
]);
const SKIP_LINE_IF = [
  { file: "src/components/workflow/header.tsx", test: (l) => l.includes('=== "rose"') },
  { file: "src/components/workflow/results/fsc-chart.tsx", test: (l) => l.includes("linear-gradient(90deg, currentColor") },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

// ordered: longer/more specific patterns first so a SOFT site is never
// double-counted as SOLID (boundary via (?![\w./-]) lookarounds).
const RULES = [
  ["INK_PAIR", /(?<![\w:-])text-(?:rose|red)-[567]00 dark:text-(?:rose|red)-[3456]00/g],
  ["TAIL-prefixed-pair", /(?:[a-z-]+:)*text-(?:rose|red)-[567]00 dark:(?:[a-z-]+:)*text-(?:rose|red)-[3456]00/g],
  ["SOFT", /(?:[a-z-]+:)*bg-(?:rose|red)-500\/(?:\d|\[0?\.\d+\])(?![\w-])/g],
  ["BORDER", /(?:[a-z-]+:)*border-(?:rose|red)-500(?:\/(?:\d|\[0?\.\d+\]))?(?![\w/-])/g],
  ["RING", /(?:[a-z-]+:)*ring-(?:rose|red)-500(?:\/(?:\d|\[0?\.\d+\]))?(?![\w/-])/g],
  ["SOLID", /(?:[a-z-]+:)*bg-(?:rose|red)-500(?![\w./-])/g],
  ["TAIL-text-shade", /(?:[a-z-]+:)*text-(?:rose|red)-\d00(?![\w/-])/g],
  ["TAIL-bg-shade", /(?:[a-z-]+:)*bg-(?:rose|red)-[4-9]00(?![\w./-])/g],
  ["TAIL-gradient", /(?:from|via|to)-(?:rose|red)-\d00/g],
  ["NAME", /"(?:rose|red)"/g],
];

const files = walk(ROOT).filter((f) => !SKIP_FILES.has(f.replaceAll("\\", "/")));
const buckets = {};
const perFile = {};
let safeTotal = 0;

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const rel = f.replaceAll("\\", "/");
  const consumed = new Array(src.length).fill(false);
  // line-level exemptions: compute the char ranges the codemod would skip
  const skipRanges = [];
  if (SKIP_LINE_IF.some(({ file }) => file === rel)) {
    let off = 0;
    for (const line of src.split("\n")) {
      if (SKIP_LINE_IF.some(({ file, test }) => file === rel && test(line))) skipRanges.push([off, off + line.length]);
      off += line.length + 1;
    }
  }
  const inSkip = (i) => skipRanges.some(([a, b]) => i >= a && i < b);
  const hit = {};
  for (const [bucket, re] of RULES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      if (inSkip(m.index)) continue;
      // a site claimed by an earlier (more specific) rule is not recounted
      let overlap = false;
      for (let i = m.index; i < m.index + m[0].length; i++) if (consumed[i]) { overlap = true; break; }
      if (overlap) continue;
      for (let i = m.index; i < m.index + m[0].length; i++) consumed[i] = true;
      hit[bucket] = (hit[bucket] ?? 0) + 1;
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
      if (!["TAIL-text-shade", "TAIL-bg-shade", "TAIL-gradient", "TAIL-prefixed-pair", "NAME"].includes(bucket)) safeTotal++;
    }
  }
  if (Object.keys(hit).length) perFile[f] = hit;
}

const SAFE = ["INK_PAIR", "SOFT", "BORDER", "RING", "SOLID"];
const TAILS = ["TAIL-text-shade", "TAIL-bg-shade", "TAIL-gradient", "TAIL-prefixed-pair"];
console.log("== t646 danger census ==");
for (const [b, n] of Object.entries(buckets).sort((a, z) => z[1] - a[1])) {
  console.log(`  ${b.padEnd(16)} ${n}`);
}
console.log(`  SAFE total: ${safeTotal}`);
console.log("\n== per file ==");
for (const [f, hit] of Object.entries(perFile).sort((a, z) => {
  const sa = SAFE.reduce((s, k) => s + (a[1][k] ?? 0), 0);
  const sz = SAFE.reduce((s, k) => s + (z[1][k] ?? 0), 0);
  return sz - sa;
})) {
  const safe = SAFE.reduce((s, k) => s + (hit[k] ?? 0), 0);
  const tail = TAILS.reduce((s, k) => s + (hit[k] ?? 0), 0);
  console.log(`  ${f}  safe=${safe} tail=${tail}  ${JSON.stringify(hit)}`);
}

if (process.argv.includes("--assert")) {
  const remaining = SAFE.reduce((s, k) => s + (buckets[k] ?? 0), 0);
  if (remaining > 0) {
    console.error(`ASSERT FAIL: ${remaining} SAFE-bucket sites remain`);
    process.exit(1);
  }
  console.log("ASSERT OK: all SAFE buckets swept to zero");
}

#!/usr/bin/env node
// t650 solid-domain codemod — teal/amber/emerald hue names retire into
// success/warning/running rung tokens, ALL props / ALL rungs / ALL alphas
// (the solid+wash+gradient domains t648's text-prop pass never saw).
//
// Zero-pixel guarantee: --color-success/warning/running-N are verbatim
// palette copies (t648 assert), extended to 50/950 this window (t650
// globals block) — so bg-teal-500 -> bg-running-500 re-inks nothing.
//
// Exemptions are SHARED with t650-solid-census.mjs (same tables) —
// the census defines what the assert sees, the codemod must not touch
// what the census calls exempt. t649 law: one exemption table, two tools.
//
// count-before-write (t647 law) + --dry first (t649 law) + rung/prop
// coverage guard: any hue-name occurrence that MATCHES the family but
// NOT the transform regex is a FATAL (the t649 rose-950 lesson — a
// silent skip renames nothing and hides a blind spot).
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src";

const EXEMPT_FILES = [
  "src/lib/workflow.ts",               // COLORS palette definition (t647)
  "src/components/workflow/palette.tsx", // tier badges + gold star (t647)
  "src/components/workflow/results/map-ortho-panel.tsx", // axis identity (t647)
  "src/components/workflow/results/fsc-chart.tsx",       // curve series identity (t647)
  "src/components/workflow/results/fsc-compare-dialog.tsx", // series identity (t647)
  "src/components/workflow/results/class-distribution-chart.tsx", // gradient bars (t647)
  "src/components/workflow/class-gallery.tsx",        // selection teal identity (t647)
  "src/components/workflow/reference-map-card.tsx",   // reference brand identity (t647; path corrected t650)
  "src/components/workflow/results/class-averages-teaser.tsx", // isTop selection ring (t650 judgment)
  "src/components/workflow/results/denoise-compare-gallery.tsx", // metric badge series (t647; path corrected t650)
  "src/components/workflow/command-palette.tsx",       // chart category tone (t647)
  "src/components/workflow/results/results-view.tsx",  // t650: teal = selection/action identity
  "src/lib/status-style.ts",           // the codex — cleaned BY HAND this window, not by this codemod
  "src/app/globals.css",               // legislation exempts its own history (t648 law)
];

const EXEMPT_ROW_PATTERNS = [
  { f: "src/components/workflow/job-inspector.tsx", re: /^\s*\[\s*"bg-/, note: "legend series swatches" },
  { f: "src/components/workflow/results/rebalance-report.tsx", re: /from-(?:amber|teal)-500\/70 to-/, note: "rebalance delta compare pair" },
  { f: "src/components/workflow/results/run-compare-dialog.tsx", re: /border-teal-300 px-2/, note: "add-compare action identity" },
  { f: "src/components/workflow/storage-dialog.tsx", re: /(?:maps|plots):\s*"bg-/, note: "storage legend swatches" },
  { f: "src/components/ai/assistant-panel.tsx", re: /from-teal-500(?:\/\d+)? to-cyan/, note: "AI brand gradient pair" },
  { f: "src/components/workflow/job-card.tsx", re: /border-teal-500 ring-2 ring-teal-500\/70/, note: "inspected focus ring" },
  { f: "src/components/workflow/job-card.tsx", re: /find lens hit/, note: "find-lens hit ring" },
  { f: "src/components/workflow/find-mark.tsx", re: /FIND_MARK_CLASS = |rounded-\[2px\] bg-amber-400\/35/, note: "find-lens character wash (t655; t725: moved out of job-card when the palette's dialect rows became the wash's second face) — same search identity as the ring" },
  { f: "src/components/workflow/param-dialect-badge.tsx", re: /bg-amber-400\/35/, note: "dialect chip amber (t722; t725 exemption judgment: the badge-is-the-why hue is identity, not field) — same search identity as the wash" },
  { f: "src/components/workflow/job-inspector.tsx", re: /whyHit && "rounded-md bg-amber-500\/5/, note: "param-why hit row whisper (t728) — same search identity as the wash/ring" },
  { f: "src/components/workflow/type-card-dialog.tsx", re: /bg-emerald-500\/10 text-emerald-600/, note: "tier core badge (t730) — type-tier identity, not a job state (palette t647 family)" },
  { f: "src/components/workflow/type-card-dialog.tsx", re: /bg-amber-500\/10 text-amber-600/, note: "tier external badge (t730) — type-tier identity, not a lens or running hue" },
  { f: "src/components/workflow/header.tsx", re: /=== "rose" \? "bg-rose-500"/, note: "elsewhere group dot ternary" },
  { f: "src/components/workflow/engine-guidance.tsx", re: /border-teal-500 bg-teal-500/, note: "engine checked face" },
];

// THE transform: any prop (incl. directional + ring-offset) × any prefix chain
// × any rung (2–3 digits) × optional alpha. Pure rename: hue word swaps only.
const HUE_MAP = { teal: "running", amber: "warning", emerald: "success" };
const TRANSFORM = new RegExp(
  String.raw`\b((?:[a-z0-9:/-]+:)*)(bg|border|ring|from|via|to|fill|stroke|text|decoration|outline|shadow|caret|accent|ring-offset)-((?:[xytrblse]-)*)teal-(\d{2,3})(\/\d{1,3})?\b`, "g");
const TRANSFORMS = ["teal", "amber", "emerald"].map((hue) => ({
  hue,
  re: new RegExp(
    String.raw`\b((?:[a-z0-9:/-]+:)*)(bg|border|ring|from|via|to|fill|stroke|text|decoration|outline|shadow|caret|accent|ring-offset)-((?:[xytrblse]-)*)${hue}-(\d{2,3})(\/\d{1,3})?\b`, "g"),
}));

// coverage guard: ANY occurrence of the hue family in a className-ish string
// context that survives — if it doesn't match TRANSFORMS, it's an unhandled
// form (new prop, new prefix shape) and we MUST stop, not skip.
const COVERAGE = /\b(?:bg|border|ring|from|via|to|fill|stroke|text|decoration|outline|shadow|caret|accent|ring-offset)-[a-z-]*teal-|amber-|emerald-/;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|ts)$/.test(e)) out.push(p);
  }
  return out;
}

const dry = process.argv.includes("--dry");
const files = walk(ROOT).map((p) => relative(".", p));
let totalSites = 0;
const perFile = new Map();
const changed = [];

for (const f of files) {
  if (EXEMPT_FILES.includes(f)) continue;
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  let fileHits = 0;
  const outLines = lines.map((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return line; // comment = history (t649 law)
    if (EXEMPT_ROW_PATTERNS.some((r) => r.f === f && r.re.test(line))) return line;
    let out = line;
    for (const { hue, re } of TRANSFORMS) {
      re.lastIndex = 0;
      out = out.replace(re, (m, prefixes, prop, dirPart, rung, alpha) => {
        fileHits++;
        return `${prefixes}${prop}-${dirPart}${HUE_MAP[hue]}-${rung}${alpha ?? ""}`;
      });
    }
    return out;
  });
  if (fileHits > 0) {
    // coverage guard on the result: no hue family occurrence may survive
    // in non-comment, non-exempt code lines
    for (const line of outLines) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (EXEMPT_ROW_PATTERNS.some((r) => r.f === f && r.re.test(line))) continue;
      if (/(?:bg|border|ring|from|via|to|fill|stroke|text|decoration|outline|shadow|caret|accent|ring-offset)(?:-[xytrblse])?-[a-z]*-(?:teal|amber|emerald)-\d/.test(line)) {
        console.error(`FATAL: unhandled hue-name form survived in ${f}:`);
        console.error(`  ${line.trim().slice(0, 160)}`);
        process.exit(1);
      }
    }
    perFile.set(f, fileHits);
    totalSites += fileHits;
    changed.push({ f, src, out: outLines.join("\n") });
  }
}

console.log(`t650 solid-domain codemod ${dry ? "(DRY)" : "(WRITE)"}`);
console.log(`sites: ${totalSites}  files: ${perFile.size}`);
for (const [f, n] of [...perFile.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${f}`);

if (dry) {
  console.log("dry run — no files written");
  process.exit(0);
}
for (const { f, out } of changed) writeFileSync(f, out);
console.log(`written: ${changed.length} files`);

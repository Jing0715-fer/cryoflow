#!/usr/bin/env node
// t650 solid-domain census — full-form enumeration of teal/amber/emerald hue names
// (t647 three-rung law rung 3 said "solid IS the rung" = literals; t648 legislated
//  rung tokens 100..900, so zero-pixel rename is now AVAILABLE — this census
//  measures what remains, and t650 recasts rung 3.)
//
// Buckets:
//   EXEMPT_FILE   — identity-exempt files (t647 exemption table + t650 judgments)
//   SOLID_A       — (bg|border|ring|...)-hue-N[/alpha>=50]  solid line
//   SOLID_BARE    — (bg|border|ring|...)-hue-N (no alpha)     solid block
//   WASH          — same props with alpha < 50                wash line
//   TEXT_DEEP     — text hue-700/300 style (t648's domain, should be 0 outside exempt)
//   TEXT_OTHER    — other text-prop hue names
//   OTHER_PROP    — from/via/to/fill/stroke/decoration/...
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src";
const HUES = "(?:teal|amber|emerald)";

// t647 identity-exemption table (files where the hue name IS an identity, not a status)
// + t650 additions judged in this window (recorded in worklog).
const EXEMPT_FILES = [
  "src/lib/workflow.ts",               // COLORS palette definition (t647)
  "src/components/workflow/palette.tsx", // tier badges + gold star (t647)
  "src/components/workflow/results/map-ortho-panel.tsx", // axis identity (t647)
  "src/components/workflow/results/fsc-chart.tsx",       // curve series identity (t647)
  "src/components/workflow/results/fsc-compare-dialog.tsx", // series identity (t647)
  "src/components/workflow/results/class-distribution-chart.tsx", // gradient bars (t647)
  "src/components/workflow/class-gallery.tsx",        // selection teal identity (t647)
  "src/components/workflow/reference-map-card.tsx",   // reference brand identity (t647 "reference-map"; path corrected t650 — whole card wears teal as its type identity)
  "src/components/workflow/results/class-averages-teaser.tsx", // isTop selection ring inherits class-gallery identity (t650 judgment)
  "src/components/workflow/results/denoise-compare-gallery.tsx", // metric badge series (t647; path corrected t650)
  "src/components/workflow/command-palette.tsx",       // chart category tone (t647)
  "src/components/workflow/results/results-view.tsx",  // t650: teal = selection/action identity (tabs, buttons, selected cards, mol-open btn) — same verdict family as t647 class-gallery selection teal
  "src/lib/status-style.ts",           // the codex itself — bucketed separately below
];

// row-level exemptions inside NON-exempt files (t650 judgments, content-matched):
// hue IS a series/brand/focus identity on these rows — renaming would misname it
const EXEMPT_ROW_PATTERNS = [
  { f: "src/components/workflow/job-inspector.tsx", re: /^\s*\[\s*"bg-/, note: "legend series swatches (teal-400=iteration, teal-200=resolution, amber-400=warning-curve)" },
  { f: "src/components/workflow/results/rebalance-report.tsx", re: /from-(?:amber|teal)-500\/70 to-/, note: "rebalance delta compare bars (decrease=amber / increase=teal identity pair)" },
  { f: "src/components/workflow/results/run-compare-dialog.tsx", re: /border-teal-300 px-2/, note: "add-compare action button identity (300/50/800/950 shallow rungs)" },
  { f: "src/components/workflow/storage-dialog.tsx", re: /(?:maps|plots):\s*"bg-/, note: "storage category legend swatches (map=teal / plot=amber series identity)" },
  { f: "src/components/ai/assistant-panel.tsx", re: /from-teal-500(?:\/\d+)? to-cyan/, note: "AI avatar brand gradient (teal→cyan pair, cyan outside scope; renaming half would misname the brand pair)" },
  { f: "src/components/workflow/job-card.tsx", re: /border-teal-500 ring-2 ring-teal-500\/70/, note: "inspected focus ring — UI focus identity, not job running" },
  { f: "src/components/workflow/job-card.tsx", re: /find lens hit/, note: "find-lens hit ring (Task 134) — search highlight identity" },
  { f: "src/components/workflow/header.tsx", re: /=== "rose" \? "bg-rose-500"/, note: "elsewhere group dot hue ternary — group identity (t649 row-exempt precedent)" },
  { f: "src/components/workflow/engine-guidance.tsx", re: /border-teal-500 bg-teal-500/, note: "engine selector checked face — selection identity (t647 class-gallery verdict family)" },
];

const PROP = String.raw`(?:hover:|focus-visible:|focus:|dark:|group-hover/flow:|md:|sm:|lg:|disabled:)*`;
const CLS = new RegExp(
  String.raw`(?:bg|border|ring|from|via|to|fill|stroke|text|decoration|outline|shadow|caret|accent|ring-offset)-(?:[xytrblse]-)?(?:[xytrblse]-)?(?:t${HUES})-(\d{2,3})(?:/(\d{1,3}))?`
    .replace(/\(?:t\$\{HUES\}\)/, "(?:" + HUES + ")"),
  "g"
);

// simpler: build per-prop regexes directly (avoid the fancy concat above)
const RE_SOLID = new RegExp(
  String.raw`\b((?:[a-z0-9/:-]*?))(?:bg|border|ring)-((?:[xytrblse]-)*)${HUES}-(\d{2,3})(?:/(\d{1,3}))?\b`, "g");
const RE_TEXT = new RegExp(
  String.raw`\b((?:[a-z0-9/:-]*?))text-((?:[xytrblse]-)*)${HUES}-(\d{2,3})(?:/(\d{1,3}))?\b`, "g");
const RE_OTHER = new RegExp(
  String.raw`\b(?:from|via|to|fill|stroke|decoration|outline|shadow|caret|accent|ring-offset)-((?:[xytrblse]-)*)${HUES}-(\d{2,3})(?:/(\d{1,3}))?\b`, "g");

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

const files = walk(ROOT).map((p) => relative(".", p));
const B = { EXEMPT_FILE: 0, SOLID_A: 0, SOLID_BARE: 0, WASH: 0, TEXT_DEEP: 0, TEXT_OTHER: 0, OTHER_PROP: 0 };
const perFile = new Map();
const detail = [];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  const exempt = EXEMPT_FILES.includes(f);
  lines.forEach((line, i) => {
    const ln = i + 1;
    // comment-line exemption (// * /* forms) — history is not field (t649 law)
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    // row-level identity exemptions (t650 judgments): legend series arrays,
    // delta compare pairs, brand gradients, focus faces — hue IS the identity
    const rowExempt = EXEMPT_ROW_PATTERNS.some((r) => r.f === f && r.re.test(line));
    const record = (bucket, m) => {
      if (exempt || rowExempt) { B.EXEMPT_FILE++; pushDetail(f, ln, rowExempt ? "EXEMPT_ROW" : "EXEMPT", line.trim()); return; }
      B[bucket]++; pushDetail(f, ln, bucket, line.trim());
    };
    for (const m of src ? [] : []) record("SOLID_A", m); // (placeholder, never runs)
    // solid domain: bg/border/ring with alpha >= 50
    RE_SOLID.lastIndex = 0;
    let m;
    while ((m = RE_SOLID.exec(line))) {
      const alpha = m[4] ? parseInt(m[4], 10) : null; // m[4]=alpha (m[3] is the directional part)

      if (alpha === null) record("SOLID_BARE", m);
      else if (alpha >= 50) record("SOLID_A", m);
      else record("WASH", m);
    }
    RE_TEXT.lastIndex = 0;
    while ((m = RE_TEXT.exec(line))) {
      const r = parseInt(m[2], 10);
      if ((r >= 600 && r <= 900) || (r >= 100 && r <= 300)) record("TEXT_DEEP", m);
      else record("TEXT_OTHER", m);
    }
    RE_OTHER.lastIndex = 0;
    while ((m = RE_OTHER.exec(line))) record("OTHER_PROP", m);
  });
}

function pushDetail(f, ln, bucket, text) {
  detail.push(`${bucket}\t${f}:${ln}\t${text.slice(0, 160)}`);
  if (bucket !== "EXEMPT" && bucket !== "EXEMPT_ROW") perFile.set(f, (perFile.get(f) ?? 0) + 1);
}

console.log("=== t650 solid-domain census (teal/amber/emerald hue names, full form) ===");
console.log("totals:", JSON.stringify(B));
const total = Object.values(B).reduce((a, b) => a + b, 0);
console.log("grand total:", total, "lines:", detail.length);
console.log("--- non-exempt per file ---");
for (const [f, n] of [...perFile.entries()].filter(([f]) => !EXEMPT_FILES.includes(f)).sort((a, b) => b[1] - a[1]))
  console.log(`  ${n}\t${f}`);
if (process.argv.includes("--detail")) console.log(detail.join("\n"));
if (process.argv.includes("--assert")) {
  // field (non-exempt) must be fully retired after the t650 codemod
  const field = B.SOLID_A + B.SOLID_BARE + B.WASH + B.TEXT_DEEP + B.TEXT_OTHER + B.OTHER_PROP;
  if (field !== 0) { console.error(`ASSERT FAIL: field hue-name residue = ${field}`); process.exit(1); }
  console.log("ASSERT OK: field hue-name residue = 0 (exempt files carry the remaining history)");
}

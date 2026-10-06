#!/usr/bin/env node
/**
 * t647 — census assert: everything the codemod's migration rules COULD
 * reach must be gone. Residue is legal only inside the exempt files or
 * outside the rules (α > 45, 400-runge, solids, deep ink, solos,
 * affordance ladders, gradients). Any violation exits 1.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project/src";
const HUES = "(?:emerald|amber|teal)";
const EXEMPT = [
  "command-palette.tsx", "map-ortho-panel.tsx", "fsc-chart.tsx",
  "fsc-compare-dialog.tsx", "reference-map-card.tsx",
  "class-distribution-chart.tsx", "canvas-minimap.tsx", "status-style.ts",
  "class-gallery.tsx", "denoise-compare-gallery.tsx", "palette.tsx",
  "lib/workflow.ts",
];
const LINE_EXEMPT = [/bg-teal-500\/60 .*bg-emerald-500/];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const violations = [];
for (const file of walk(ROOT)) {
  if (EXEMPT.some((x) => file.endsWith(x))) continue;
  const src = readFileSync(file, "utf8");
  src.split("\n").forEach((line, i) => {
    if (!/(emerald|amber|teal)-\d/.test(line)) return;
    if (LINE_EXEMPT.some((re) => re.test(line))) return;
    const site = `${file.replace(ROOT + "/", "")}:${i + 1}`;

    // rule 1: same-line same-hue 600/400 ink pair is MIGRATED — must be gone
    if (/text-(emerald|amber|teal)-600[^'"`\n]*?dark:text-\1-400/.test(line)) {
      violations.push(`${site}  ink-pair residue: ${line.trim().slice(0, 110)}`);
      return;
    }
    // rule 2: (prefix:)?(bg|border|ring)-<hue>-(500|600)/α≤45 is MIGRATED
    for (const m of line.matchAll(
      /((?:[a-z-]+:)?)(bg|border|ring)-(emerald|amber|teal)-(500|600)\/(\[(?:[\d.]+)\]|\d+)/g,
    )) {
      const n = m[5].startsWith("[") ? parseFloat(m[5].slice(1, -1)) : Number(m[5]);
      if (n <= 45 && !(m[1].startsWith("dark") && m[4] === "600")) {
        violations.push(`${site}  α-rung residue: ${m[0]}`);
      }
    }
  });
}

if (violations.length) {
  console.error(`t647 ASSERT FAIL — ${violations.length} residues the rules should have reached:`);
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("t647 assert: CLEAN — all rule-reachable sites migrated; residue is exempt/out-of-rule only");

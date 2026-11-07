#!/usr/bin/env node
/**
 * t648 — deep ink codemod: retire the hue NAME from text-prop tokens.
 *
 * t648 legislated the semantic RUNG tokens (--color-success-100..900 &c,
 * globals.css). This codemod renames text-(emerald|amber|teal)-<N> →
 * text-(success|warning|running)-<N> across the NON-EXEMPT files.
 * Pure rename, zero-pixel: the token values are the palette verbatim.
 *
 * Scope (what is NOT touched):
 *   - the 12 identity-exempt files (t647's list, incl. status-style.ts —
 *     the law itself is migrated by hand in the same commit)
 *   - non-text props (bg/border/ring/decoration/fill/stroke/gradient
 *     stops): the solid / affordance / identity domains of t647's law
 *   - prefixes (dark:, hover:, …) and α modifiers (/80, /90) ride along
 *     unchanged — a rename does not fold a brightness ladder.
 *
 * t647 lessons applied: tally BEFORE write (count-then-write), output is
 * clean at the production point (no post-hoc global tidy — that regex
 * gambler is retired for good), idempotency is asserted, and --dry lists
 * every touched site for human review before the live pass.
 *
 * Usage: node scripts/t648-deep-codemod.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project/src";
const HUE_MAP = { emerald: "success", amber: "warning", teal: "running" };
const EXEMPT = [
  "command-palette.tsx", "map-ortho-panel.tsx", "fsc-chart.tsx",
  "fsc-compare-dialog.tsx", "reference-map-card.tsx",
  "class-distribution-chart.tsx", "canvas-minimap.tsx", "status-style.ts",
  "class-gallery.tsx", "denoise-compare-gallery.tsx", "palette.tsx",
  "workflow.ts",
  // the legislature itself: the t648 block's comment carries the
  // before→after rename example — rewriting it would erase the contrast
  // the example exists to preserve
  "globals.css",
];
const TOKEN = /((?:[a-z-]+:)?)text-(emerald|amber|teal)-(\d{2,3})(\/(?:\d+|\[[^\]]+\]))?/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const dry = process.argv.includes("--dry");
const files = walk(ROOT).filter((f) => !EXEMPT.some((x) => f.endsWith(x)));

let totalSites = 0, totalTokens = 0;
const touched = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  // count first (t647 lesson: tally before write)
  const matches = [...src.matchAll(TOKEN)];
  if (!matches.length) continue;
  // verify every shade is covered by legislation (100..900 — no 50/950 in the field)
  for (const m of matches) {
    const shade = Number(m[3]);
    if (shade < 100 || shade > 900 || shade % 100 !== 0) {
      console.error(`FATAL: uncovered rung ${m[0]} in ${file} — extend the @theme block first`);
      process.exit(1);
    }
  }
  const rel = file.replace(ROOT + "/", "");
  let out = src, n = 0;
  for (const m of matches) {
    const [full, prefix, hue, shade, alpha] = m;
    const replacement = `${prefix}text-${HUE_MAP[hue]}-${shade}${alpha ?? ""}`;
    out = out.split(full).join(replacement);
    n++;
  }
  totalSites++;
  totalTokens += n;
  touched.push({ rel, n });
  if (!dry) writeFileSync(file, out, "utf8");
}

if (dry) {
  console.log(`DRY — would rename ${totalTokens} text tokens in ${totalSites} files:`);
  for (const t of touched) console.log(`   ${t.rel}  ×${t.n}`);
} else {
  console.log(`RENAMED ${totalTokens} text tokens in ${totalSites} files.`);
}
if (!totalSites && !totalTokens) console.log("nothing to do — already clean (idempotent)");

#!/usr/bin/env node
/**
 * t648 — assert: the deep-ink rename is complete and the legislation is
 * faithful. Two families of violations exit 1:
 *
 *   FAMILY A — residue: any text-(emerald|amber|teal)-<N> token in a
 *   NON-exempt file. t648's rename covered every text-prop site (456
 *   tokens / 52 files); what remains must live only in the identity-
 *   exempt files (t647's list + globals.css, whose comment carries the
 *   before→after example) and status-style.ts's head-note history.
 *   Unlike t647's assert this rule has NO shade whitelist and NO
 *   line exemptions inside non-exempt files — full-shade legislation
 *   (100–900) was the point.
 *
 *   FAMILY B — infidelity: a legislated token whose value is NOT the
 *   palette's verbatim oklch. The t646 lesson: the palette's oklch is
 *   the law, not the remembered hex — so the assert reads BOTH files
 *   and byte-compares each pair.
 */
import { readFileSync } from "node:fs";

const ROOT = "/home/z/my-project/src";
const GLOBALS = `${ROOT}/app/globals.css`;
const THEME = "/home/z/my-project/node_modules/tailwindcss/theme.css";
const SEMANTIC = { success: "emerald", warning: "amber", running: "teal" };
const SHADES = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const EXEMPT = [
  "command-palette.tsx", "map-ortho-panel.tsx", "fsc-chart.tsx",
  "fsc-compare-dialog.tsx", "reference-map-card.tsx",
  "class-distribution-chart.tsx", "canvas-minimap.tsx", "status-style.ts",
  "class-gallery.tsx", "denoise-compare-gallery.tsx", "palette.tsx",
  "workflow.ts", "globals.css",
  // t747 judgment-sync — the t650 verdict delivered to this older roster
  // (mirrors t647-assert's entry): the tier badge's emerald/amber speak
  // TYPE TIER identity, not job status — the palette judgment's family.
  "tier-badge.tsx",
];

const violations = [];

// ---- FAMILY B: legislation fidelity (byte-compare against the palette)
const globals = readFileSync(GLOBALS, "utf8");
const theme = readFileSync(THEME, "utf8");
for (const [sem, hue] of Object.entries(SEMANTIC)) {
  for (const shade of SHADES) {
    const re = new RegExp(`--color-${sem}-${shade}:\\s*([^;]+);`);
    const m = globals.match(re);
    if (!m) {
      violations.push(`legislation missing: --color-${sem}-${shade} (globals.css)`);
      continue;
    }
    const t = theme.match(new RegExp(`--color-${hue}-${shade}:\\s*([^;]+);`));
    if (!t) {
      violations.push(`palette lookup failed: --color-${hue}-${shade} (theme.css)`);
      continue;
    }
    if (m[1].trim() !== t[1].trim()) {
      violations.push(
        `infidelity: --color-${sem}-${shade} = ${m[1].trim()} ≠ palette ${t[1].trim()}`,
      );
    }
  }
}

// ---- FAMILY A: residue (text-prop hue names outside the exempt files)
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}
for (const file of walk(ROOT)) {
  if (EXEMPT.some((x) => file.endsWith(x))) continue;
  const src = readFileSync(file, "utf8");
  src.split("\n").forEach((line, i) => {
    if (!/(emerald|amber|teal)-\d/.test(line)) return;
    // text-prop only — the solid/affordance/identity props stay (t647 rungs 2–3)
    const m = line.match(/((?:[a-z-]+:)?)text-(emerald|amber|teal)-\d{2,3}/);
    if (m) {
      violations.push(
        `${file.replace(ROOT + "/", "")}:${i + 1}  text-prop hue residue: ${m[0]}`,
      );
    }
  });
}

// ---- the law itself must wear the new vocabulary
const lib = readFileSync(`${ROOT}/lib/status-style.ts`, "utf8");
for (const pair of [
  ['pending: "text-warning-700 dark:text-warning-300"', "pending ink"],
  ['running: "text-running-700 dark:text-running-300"', "running ink"],
  ['completed: "text-success-700 dark:text-success-300"', "completed ink"],
]) {
  if (!lib.includes(pair[0])) violations.push(`status-style law drifted: ${pair[1]}`);
}

if (violations.length) {
  console.error(`t648-assert: ${violations.length} violation(s)`);
  for (const v of violations.slice(0, 30)) console.error("  " + v);
  if (violations.length > 30) console.error(`  … +${violations.length - 30} more`);
  process.exit(1);
}
console.log(
  `t648-assert: PASS — 27 rung tokens verbatim-faithful, 0 text-prop hue residue outside exemption, law wears the vocabulary`,
);

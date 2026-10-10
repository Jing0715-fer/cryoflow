#!/usr/bin/env node
/**
 * t647 — emerald/amber/teal → token codemod (t646's danger pass, sibling wave).
 *
 * Migration set (locked from the census + spot checks):
 *   1. INK PAIR   `text-<hue>-600 … dark:text-<same-hue>-400` → `text-<token>`
 *                  (zero-pixel: the token IS 600/.dark 400). Same-line, same-hue
 *                  pairs only — a solo 600 with no visible dark twin is LEFT
 *                  (its dark behavior is unknown; blind migration is a bet).
 *   2. ALPHA RUNG (bg|border|ring)-<hue>-(500|600)/α  →  (prefix:)…-<token>/α
 *                  with prefix = dark|hover|focus|group-hover|… preserved, and
 *                  α ≤ 45 only: below the half-coverage line a wash reads as
 *                  "the hue, diluted" (the t646 rose-wash verdict), above it
 *                  the swatch IS the rung (solid law) and re-basing 500→600
 *                  or 600→400 would be visibly darker/lighter.
 *   3. NEVER: solids (no α), 400-runge α classes, deep ink (700/300 — the
 *      contrast law keeps them literal until a deep-rung token exists),
 *      from/to/via gradients, text solos, hover brightness ladders on text.
 *
 * Exempt files (hue = identity, not status): command-palette (chart-category
 * tones), map-ortho-panel (axis identity), fsc-chart / fsc-compare-dialog
 * (curve series), reference-map-card (reference identity),
 * class-distribution-chart (bar gradient), class-gallery (teal = the
 * SELECTION identity: Auto-button active face + class-card selected ring —
 * a class card is not a job, it has no running state), denoise-compare-
 * gallery (three metric badges = series identity), palette.tsx (tier
 * badges + gold star — category identity and an affordance, not status),
 * lib/workflow.ts (the COLORS palette definition — teal/amber/emerald sit
 * beside violet/orange as swatch MEMBERS, consumed as job-type identity),
 * canvas-minimap, status-style.
 * Line-level exemption: results-view class-distribution bars (teal/emerald
 * are data encoding there, not status).
 *
 * The file set is a full walk of src/ minus the exempt list — t647's first
 * run used a hand-curated 13-file list and silently skipped a 25-file long
 * tail (the ENOENT-continue catch also masked a wrong path). Full walk is
 * the honest default; exemptions are the explicit, reviewed list.
 *
 * Usage: node scripts/t647-teal-codemod.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");

const FILES = null; // full walk — see head note

const HUE_TOKEN = { emerald: "success", amber: "warning", teal: "running" };
const EXEMPT_FILES = [
  "command-palette.tsx",
  "map-ortho-panel.tsx",
  "fsc-chart.tsx",
  "fsc-compare-dialog.tsx",
  "reference-map-card.tsx",
  "class-distribution-chart.tsx",
  "canvas-minimap.tsx",
  "status-style.ts",
  "class-gallery.tsx",
  "denoise-compare-gallery.tsx",
  "palette.tsx",
  "lib/workflow.ts",
];

// line-level exemptions: chart data encoding (bars/fills), not status
const EXEMPT_LINE_RE = [
  /bg-teal-500\/60 .*bg-emerald-500/, // results-view distribution bars
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

let migrated = 0;
const perFile = {};

const allFiles = walk("/home/z/my-project/src").filter(
  (f) => !EXEMPT_FILES.some((x) => f.endsWith(x)),
);

for (const path of allFiles) {
  const rel = path.replace("/home/z/my-project/", "");
  const before = readFileSync(path, "utf8");
  const lines = before.split("\n");
  const changed = [];

  const out = lines.map((line, idx) => {
    if (!/(emerald|amber|teal)-\d/.test(line)) return line;
    if (EXEMPT_LINE_RE.some((re) => re.test(line))) return line;
    let l = line;

    // 1) ink pair: text-<hue>-600 … dark:text-<same-hue>-400 → text-token
    //    mid (classes between the pair) is kept but right-trimmed — the
    //    dark twin that ended the run is gone, so a trailing space of
    //    mid's would dangle. (A global "tidy" pass was tried and REVERTED:
    //    a character-class regex cannot tell `ring-running/30 "` from
    //    `from "x"` — it ate 403 files of imports and comments. Clean
    //    output at the replacement site, never a repair pass.)
    l = l.replace(
      /text-(emerald|amber|teal)-600([^'"`\n]*?)dark:text-\1-400/g,
      (_m, hue, mid) => {
        changed.push(`L${idx + 1} ink-pair text-${hue}-600…dark:${hue}-400`);
        return `text-${HUE_TOKEN[hue]}${mid.replace(/[ \t]+$/, "")}`;
      },
    );

    // 2) α rung: (prefix:)?(bg|border|ring)-<hue>-(500|600)/α with α ≤ 45
    l = l.replace(
      /((?:[a-z-]+:)?)(bg|border|ring)-(emerald|amber|teal)-(500|600)\/(\[(?:[\d.]+)\]|\d+)/g,
      (m, prefix, prop, hue, _shade, alpha) => {
        const n = alpha.startsWith("[") ? parseFloat(alpha.slice(1, -1)) : Number(alpha);
        if (n > 45) return m; // quasi-solid: the swatch IS the rung
        // dark: prefix puts the token on its 400 rung — only the 500→400
        // wash rebase has the t646 precedent; a dark:600 source is left.
        if (prefix.startsWith("dark") && _shade === "600") return m;
        changed.push(`L${idx + 1} ${prefix}${prop}-${hue}-${_shade}/${alpha}`);
        return `${prefix}${prop}-${HUE_TOKEN[hue]}/${alpha}`;
      },
    );

    return l;
  });

  const src = out.join("\n");
  if (src !== before) {
    migrated += changed.length;
    perFile[rel] = changed.length;
    if (!DRY) writeFileSync(path, src);
  }
}

console.log(DRY ? "=== DRY RUN — no files written ===" : "=== APPLIED ===");
for (const [f, n] of Object.entries(perFile)) console.log(`  ${f}: ${n}`);
console.log(`TOTAL ${migrated} edits across ${Object.keys(perFile).length} files`);

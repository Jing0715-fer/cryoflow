#!/usr/bin/env node
/**
 * t648 — deep ink census (READ-ONLY).
 *
 * t647 left the DEEP rung (700-base ink pairs + deep solos) as literals,
 * judged by the contrast law: emerald/amber/teal 600 misses 4.5:1, so the
 * 700/300(400) pairs stayed. t647's entry ① promises rung tokens
 * (--color-success-700 &c.) to retire the hue names. This census maps the
 * exact shapes so the token set is decided on evidence.
 *
 * Buckets:
 *   PAIR_700_300   text-X-700 + dark:text-X-300      → rung tokens (zero-pixel rename)
 *   PAIR_700_400   text-X-700 + dark:text-X-400      → rung tokens
 *   PAIR_700_ALPHA base/dark ink carrying /α         → rung tokens + α (color-mix keeps working)
 *   PAIR_OTHER     other paired shades               → manual
 *   SOLO_DEEP      text-X-700/600 solo (no twin)     → rung tokens per shade
 *   EXEMPT_HITS    tokens inside identity-exempt files (counted, not migrated)
 *
 * Usage: node scripts/t648-deep-census.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project/src";
const HUES = "(?:emerald|amber|teal)";
const TOKEN = new RegExp(
  "(?:(dark|hover|focus|group-hover|peer|disabled|sm|md|lg|xl):)*" +
    "((?:text|bg|border|ring|from|to|via|fill|stroke|shadow|outline|accent|decoration|divide|ring-offset|caret)-" +
    HUES + "-(\\d+)(?:/(\\d+))?)",
  "g",
);

// t647's FULL identity-exempt list (as codified in t647-assert.mjs —
// wider than the census's: category-tone / selection-identity / palette
// files ride along as whole-file exemptions)
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
  "workflow.ts",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
    else if (/\.py$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

const buckets = {
  PAIR_700_300: [],
  PAIR_700_400: [],
  PAIR_700_ALPHA: [],
  PAIR_OTHER: [],
  SOLO_DEEP: [],
  EXEMPT_HITS: [],
};

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const isExempt = EXEMPT_FILES.some((x) => file.endsWith(x));
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (!/(emerald|amber|teal)-\d/.test(line)) return;
    const rel = file.replace(ROOT + "/", "");
    const site = `${rel}:${i + 1}`;
    const toks = [...line.matchAll(TOKEN)].map((m) => ({
      prefix: m[1] || "",
      cls: m[2],
      shade: Number(m[3]),
      alpha: m[4] ? Number(m[4]) : null,
      hue: m[2].split("-").slice(-2)[0],
      prop: m[2].split("-")[0],
    }));
    if (!toks.length) return;

    if (isExempt) {
      for (const t of toks) buckets.EXEMPT_HITS.push({ site, cls: t.cls });
      return;
    }

    const texts = toks.filter((t) => t.prop === "text");
    const baseInks = texts.filter((t) => !t.prefix);
    const darkInks = texts.filter((t) => t.prefix === "dark");
    const isAffordance = texts.some((t) =>
      ["hover", "focus", "group-hover", "peer", "disabled"].some((p) => t.prefix.startsWith(p)),
    );

    if (baseInks.length > 0 && darkInks.length > 0 && !isAffordance) {
      const b = baseInks[0], d = darkInks[0];
      const hasAlpha = baseInks.concat(darkInks).some((t) => t.alpha != null);
      const multiHue = new Set(baseInks.concat(darkInks).map((t) => t.hue)).size > 1;
      let key;
      if (multiHue) key = "PAIR_OTHER";
      else if (hasAlpha) key = "PAIR_700_ALPHA";
      else if (b.shade === 700 && d.shade === 300) key = "PAIR_700_300";
      else if (b.shade === 700 && d.shade === 400) key = "PAIR_700_400";
      else key = "PAIR_OTHER";
      buckets[key].push({ site, line: line.trim().slice(0, 150), toks: toks.map((t) => t.cls) });
      return;
    }

    // solos: text tokens standing alone (no dark twin, no affordance prefix)
    if (!isAffordance) {
      for (const t of texts) {
        if (t.prefix) continue; // dark: solo → not today's bucket
        if (t.shade === 600 || t.shade === 700) {
          buckets.SOLO_DEEP.push({ site, cls: t.cls });
        }
      }
    }
  });
}

const total =
  buckets.PAIR_700_300.length + buckets.PAIR_700_400.length + buckets.PAIR_700_ALPHA.length +
  buckets.PAIR_OTHER.length + buckets.SOLO_DEEP.length;
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(buckets, null, 1));
} else {
  console.log("=== t648 deep ink census ===");
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`\n[${k}] ${v.length}`);
    const shown = k === "EXEMPT_HITS" ? 8 : 10;
    for (const item of v.slice(0, shown)) {
      console.log(`   ${item.site}  ${item.cls ?? item.toks?.join(" ") ?? item.line ?? ""}`);
    }
    if (v.length > shown) console.log(`   … +${v.length - shown} more`);
  }
  console.log(`\nMIGRATION TARGET TOTAL ${total}`);
}

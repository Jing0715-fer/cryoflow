#!/usr/bin/env node
/**
 * t647 — emerald/amber/teal census (READ-ONLY).
 *
 * t646's danger pass (census → codemod → assert) gets its sibling pass.
 * This census buckets every emerald/amber/teal Tailwind color token in
 * src/ so the codemod's migration set is decided on evidence, not vibes.
 *
 * Buckets (the t647 three-rung law from lib/status-style.ts):
 *   INK_PAIR_600   text-X-600 + dark:text-X-400 base pair  → MIGRATE (zero-pixel: token IS 600/400)
 *   INK_PAIR_DEEP  text-X-700 + dark:text-X-300 base pair  → KEEP (contrast law: 600 rungs miss 4.5:1)
 *   ALPHA_BG       bg-X-<n>/<α> α-washes                   → MIGRATE (t646 rose-wash precedent)
 *   ALPHA_BORDER   border-X-.../<α>                        → MIGRATE
 *   ALPHA_RING     ring-X-.../<α>                          → MIGRATE
 *   SOLID          bg-X-<n> (no α)                         → KEEP (a solid IS the rung)
 *   AFFORDANCE     hover:/focus:/group-hover: prefixed     → KEEP (folding a brightness ladder kills affordance)
 *   GRADIENT       from-/to-/via-                          → KEEP (chart series identity)
 *   TEXT_SOLO      text-X-<n> without its dark twin        → MANUAL (inspect each)
 *   OTHER          everything else (accent, fill, shadow…) → MANUAL
 *
 * Identity-exempt files (hue = category identity, NOT status semantics):
 *   map-ortho-panel (XYZ axis identity), fsc-chart / fsc-compare-dialog
 *   (curve series), reference-map-card (reference-map identity),
 *   class-distribution-chart (bar gradient), canvas-minimap (SVG hex
 *   canon, already migrated), lib/status-style.ts (the law itself).
 *
 * Usage: node scripts/t647-teal-census.mjs [--json]
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

const EXEMPT_FILES = [
  "map-ortho-panel.tsx",
  "fsc-chart.tsx",
  "fsc-compare-dialog.tsx",
  "reference-map-card.tsx",
  "class-distribution-chart.tsx",
  "canvas-minimap.tsx",
  "status-style.ts",
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

const files = walk(ROOT).filter((f) => !EXEMPT_FILES.some((x) => f.endsWith(x)));

/** per-file: collect tokens per line, then pair ink ladders within a line */
const buckets = {
  INK_PAIR_600: [],
  INK_PAIR_DEEP: [],
  ALPHA_BG: [],
  ALPHA_BORDER: [],
  ALPHA_RING: [],
  SOLID: [],
  AFFORDANCE: [],
  GRADIENT: [],
  TEXT_SOLO: [],
  OTHER: [],
};

for (const file of files) {
  const src = readFileSync(file, "utf8");
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
    }));
    if (!toks.length) return;

    // ink-pair detection: text token + its dark: twin on the same line
    const texts = toks.filter((t) => t.cls.startsWith("text-"));
    const baseInks = texts.filter((t) => !t.prefix);
    const darkInks = texts.filter((t) => t.prefix === "dark");
    const paired = baseInks.length > 0 && darkInks.length > 0;
    const isAffordance = texts.some((t) =>
      ["hover", "focus", "group-hover", "peer", "disabled"].some((p) => t.prefix.startsWith(p)),
    );

    // whole-line routing: a line that carries an ink pair is classified by the pair
    if (paired && !isAffordance) {
      const shades = [...baseInks.map((t) => t.shade), ...darkInks.map((t) => t.shade)];
      const bucket = shades.includes(600) && shades.includes(400) ? "INK_PAIR_600" : "INK_PAIR_DEEP";
      buckets[bucket].push({ site, line: line.trim().slice(0, 160), toks: toks.map((t) => t.cls) });
      return;
    }

    let routed = false;
    for (const t of toks) {
      if (["hover", "focus", "group-hover", "peer", "disabled"].some((p) => t.prefix.startsWith(p))) {
        buckets.AFFORDANCE.push({ site, cls: t.cls });
        routed = true;
      } else if (["from", "to", "via", "fill", "stroke"].includes(t.prefix)) {
        buckets.GRADIENT.push({ site, cls: t.cls });
        routed = true;
      } else if (t.prefix) {
        // dark: solos and responsive prefixes → manual
        buckets.OTHER.push({ site, cls: `${t.prefix}:${t.cls}` });
        routed = true;
      } else if (t.cls.startsWith("bg-")) {
        if (t.alpha != null) {
          buckets.ALPHA_BG.push({ site, cls: t.cls });
          routed = true;
        } else {
          buckets.SOLID.push({ site, cls: t.cls });
          routed = true;
        }
      } else if (t.cls.startsWith("border-")) {
        buckets[t.alpha != null ? "ALPHA_BORDER" : "OTHER"].push({ site, cls: t.cls });
        routed = true;
      } else if (t.cls.startsWith("ring-")) {
        buckets[t.alpha != null ? "ALPHA_RING" : "OTHER"].push({ site, cls: t.cls });
        routed = true;
      } else if (t.cls.startsWith("text-")) {
        buckets.TEXT_SOLO.push({ site, cls: t.cls });
        routed = true;
      } else {
        buckets.OTHER.push({ site, cls: t.cls });
        routed = true;
      }
    }
    if (!routed) buckets.OTHER.push({ site, line: line.trim().slice(0, 160) });
  });
}

const total = Object.values(buckets).reduce((n, b) => n + b.length, 0);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(buckets, null, 1));
} else {
  console.log("=== t647 emerald/amber/teal census (exempt files excluded) ===");
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`\n[${k}] ${v.length}`);
    for (const item of v.slice(0, k === "OTHER" || k === "TEXT_SOLO" ? 14 : 6)) {
      console.log(`   ${item.site}  ${item.cls ?? item.line ?? ""}`);
    }
    if (v.length > (k === "OTHER" || k === "TEXT_SOLO" ? 14 : 6)) console.log(`   … +${v.length - (k === "OTHER" || k === "TEXT_SOLO" ? 14 : 6)} more`);
  }
  console.log(`\nTOTAL ${total}`);
}

/**
 * t803-scroll-census-second-pass.mjs — the census rides again with the
 * WIDENED net: t801 bucketed by `overflow-auto` alone and missed the
 * `overflow-y-auto` family (t802's two wounds); this pass enumerates
 * EVERY overflow-ish container class in src/components —
 *
 *   overflow-auto · overflow-y-auto · overflow-x-auto · overflow-scroll
 *   overflow-y-scroll · and overflow-hidden pairs that co-occur with max-h
 *
 * — plus every DialogContent className override (the content-node faces),
 * and for each hit dumps the facts the judgment needs: the container's
 * classes, whether the opening tag carries a tab stop, and the children
 * window (buttons vs text-only). The BUCKETS are still human judgment —
 * this script is the enumeration arm, not the verdict.
 *
 * Run:  node scripts/t803-scroll-census-second-pass.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
};

const files = walk(SRC).filter((f) => !f.includes("ui/dialog.tsx")); // the wrapper is law, not a hit

const CLASSES = [
  "overflow-auto",
  "overflow-y-auto",
  "overflow-x-auto",
  "overflow-scroll",
  "overflow-y-scroll",
];

let hitCount = 0;
const dead = [];
const speaking = [];
const contentFaces = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // --- DialogContent className overrides (content-node faces) ---
    if (line.includes("<DialogContent") && line.includes("className=")) {
      const m = line.match(/className="([^"]*)"/);
      if (m && !/overflow-hidden/.test(m[1])) {
        contentFaces.push(`${rel}:${i + 1}  DialogContent "${m[1]}"`);
      } else if (m) {
        contentFaces.push(`${rel}:${i + 1}  DialogContent(overflow-hidden) "${m[1]}"`);
      }
    }

    for (const cls of CLASSES) {
      if (!line.includes(cls)) continue;
      hitCount++;
      // the opening tag may span lines — read the tag window around the hit
      const tagStart = text.lastIndexOf("<", text.indexOf(line) + line.indexOf(cls));
      const tagWindow = text.slice(tagStart, tagStart + 600);
      const hasStop = /tabIndex=\{0\}/.test(tagWindow);
      // children window: 70 lines after the hit
      const childWindow = lines.slice(i, i + 70).join("\n");
      const buttons = (childWindow.match(/<button[\s>]|<Button[\s>]/g) || []).length;
      const bucket = hasStop ? "SPEAKING" : buttons > 0 ? "covered?" : "DEAD?";
      const row = `${rel}:${i + 1}  [${cls}] buttons~${buttons} ${bucket}  "${line.trim().slice(0, 110)}"`;
      (hasStop ? speaking : dead).push(row);
    }
  }
}

console.log(`=== enumeration: ${hitCount} container hits in ${files.length} files ===\n`);
console.log("--- SPEAKING (tabIndex present in tag window) ---");
for (const r of speaking) console.log("  " + r);
console.log("\n--- candidates (no stop in tag window; judge the children) ---");
for (const r of dead) console.log("  " + r);
console.log("\n--- DialogContent className overrides (content-node faces) ---");
for (const r of contentFaces) console.log("  " + r);

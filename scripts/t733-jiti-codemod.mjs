// t733 — the jiti codemod: Node ≥24 ESM stopped resolving extensionless
// imports, which broke every probe that live-fires the REAL lib (the
// t653 paradigm's live-fire leg — `import { jobType } from "../src/lib/
// workflow"`). jiti (already in the tree, next's own loader) resolves
// TS + extensionless + the project's @/ alias.
//
// REWRITE LAW — in-place, not hoisted: the FIRST lib import's exact
// position grows the preamble + that module's load; every later lib
// import collapses to its own load line at the same spot. Static ESM
// imports hoist, dynamic awaits don't — so the probes' deliberate
// execution order (t720's window-mock BEFORE the lib reads window) is
// inherited bit-for-bit instead of being re-derived by a hoisting rule.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const files = execSync(
  `rg -l 'from "\\.\\./src/' ${path.join(root, "scripts")} --glob '*.mjs'`,
  { encoding: "utf8" }
).trim().split("\n").filter((f) => !f.endsWith("t733-shelf-info-door-unit.mjs") && !f.endsWith("t733-jiti-codemod.mjs"));

const STATIC_IMPORT = /import\s*\{([^}]*)\}\s*from\s*"(\.\.\/src\/[^"]+)";?/g;

let patched = 0, skipped = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!STATIC_IMPORT.test(src)) { skipped++; continue; }
  STATIC_IMPORT.lastIndex = 0;

  let first = true;
  const patchedSrc = src.replace(STATIC_IMPORT, (match, names, mod) => {
    const bindings = names.split(",").map((s) => s.trim()).filter(Boolean).join(", ");
    const load = `const { ${bindings} } = await __jiti.import("${mod}");`;
    if (!first) return load;
    first = false;
    return [
      "// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless",
      "// imports; jiti (in-tree) loads the REAL lib for live-fire, with the",
      "// project's @/ alias wired so lib-internal @/ imports resolve too.",
      "// In-place (not hoisted): the probe's own execution order is law.",
      'import { createJiti } from "jiti";',
      'import * as __path from "node:path";',
      "const __jiti = createJiti(import.meta.url, {",
      '  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },',
      "});",
      load,
    ].join("\n");
  }).replace(/\n{3,}/g, "\n\n");

  writeFileSync(file, patchedSrc);
  patched++;
  console.log(`  patched: ${path.basename(file)}`);
}
console.log(`\n=== jiti codemod: ${patched} patched / ${skipped} skipped ===`);

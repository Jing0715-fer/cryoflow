#!/usr/bin/env node
// t859 — patch the nonet's provenance lines onto the world-identity key.
// Mechanical, reviewed-by-diff: import + buildId line + console label +
// receipt worldMode field, seven instruments, then node --check each.
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "scripts/t834-band-sweep.mjs",
  "scripts/t837-wordmark-probe.mjs",
  "scripts/t839-zone-rehearsal.mjs",
  "scripts/t840-options-rehearsal.mjs",
  "scripts/t843-a11y-rewitness.mjs",
  "scripts/t844-a11y-fragile-pair.mjs",
  "scripts/t846-a11y-maintenance.mjs",
];

const OLD_LINE = `const buildId = readFileSync(join(ROOT, ".next/BUILD_ID"), "utf8").trim();`;
const NEW_LINE = `const world = worldIdentity(ROOT); // t859 — the world key: build id on build days, dev@src-hash otherwise (t858's dev-only world must not strand the battery)\nconst buildId = world.id;`;

let fail = 0;
for (const f of FILES) {
  let src = readFileSync(f, "utf8");
  const before = src;

  // 1. the provenance read
  if (!src.includes(OLD_LINE)) { console.log(`FAIL ${f}: buildId line not found`); fail++; continue; }
  src = src.replace(OLD_LINE, NEW_LINE);

  // 2. the import (after the node:path import line)
  if (!src.includes(`import { worldIdentity }`)) {
    const pathImport = `import { join } from "node:path";`;
    if (!src.includes(pathImport)) { console.log(`FAIL ${f}: path import anchor missing`); fail++; continue; }
    src = src.replace(
      pathImport,
      pathImport + `\nimport { worldIdentity } from "./world-identity.mjs";`
    );
  }

  // 3. the console label — speak the mode
  src = src.replaceAll("— build ${buildId}", "— world ${world.mode}:${buildId}");

  // 4. the receipt gains the mode (the key alone doesn't say which kind)
  src = src.replaceAll("  build: buildId,", "  build: buildId,\n  worldMode: world.mode,");

  if (src !== before) {
    writeFileSync(f, src);
    console.log(`patched ${f}`);
  } else {
    console.log(`NOOP ${f}`);
  }
}
process.exit(fail ? 1 : 0);

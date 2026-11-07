#!/usr/bin/env node
// t414 codemod — migrate the 11 shape-B suites (test-client single-string
// cleanup) from bare cross-project globs to the world-safe cleanup law.
// The 4 shape-A suites (t304/t306/t307/t308) were hand-edited before this.
//
// For each file:
//   1. add the helper import (after the last existing top import line)
//   2. find the execSync(`node services/mock-cluster/test-client.mjs 'rm -rf
//      /projects/cryoflow/<glob> ...'`) cleanup call
//   3. insert the protect-set fetch before it, and swap the bare glob list
//      for worldSafeRmScript([...patterns], worldProtect)
//
// node scripts/codemod-t414-world-safe.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const FILES = [
  "scripts/t262-remote-run-e2e.mjs",
  "scripts/t263-remote-hardening.mjs",
  "scripts/t264-remote-externals.mjs",
  "scripts/t265-remote-topaz-train.mjs",
  "scripts/t266-topaz-training-curve.mjs",
  "scripts/t267-probeless-dispatch.mjs",
  "scripts/t268-probe-cost-heartbeat.mjs",
  "scripts/t269-time-ledger.mjs",
  "scripts/t270-run-resume.mjs",
  "scripts/t272-cross-canvas-resume.mjs",
  "scripts/t293-slurm-submit.mjs",
];

const dry = process.argv.includes("--dry");
const IMPORT_LINE = `import { worldProtectBasenames, worldSafeRmScript, worldGuardLine } from "./lib/world-safe-cleanup.mjs";`;

let changed = 0;
for (const f of FILES) {
  const src = readFileSync(f, "utf8");
  if (src.includes("world-safe-cleanup.mjs")) {
    console.log(`skip (already migrated): ${f}`);
    continue;
  }

  // 1. the exec call with the bare glob list inside a template string
  const re = /(\s*)execSync\(\s*\n?\s*`node services\/mock-cluster\/test-client\.mjs '(rm -rf [^']+)'`/g;
  const m = re.exec(src);
  if (!m) {
    console.log(`NO MATCH (needs hand edit): ${f}`);
    continue;
  }
  const indent = m[1];
  const inner = m[2];
  // split the glob statement into patterns (drop non-/projects patterns like
  // ~/.slurm-mock — those stay literal, they are not world paths)
  const tokens = inner.split(/\s+/);
  const patterns = tokens.filter((t) => t.startsWith("/projects/cryoflow/"));
  const rest = tokens.filter((t) => !t.startsWith("/projects/cryoflow/") && t !== "rm" && t !== "-rf");

  // 2. the import — after the last top-of-file import line
  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 120); i++) {
    if (/^import /.test(lines[i])) lastImport = i;
  }
  if (lastImport < 0) {
    console.log(`NO IMPORT ANCHOR: ${f}`);
    continue;
  }

  const protectBlock = [
    `${indent}// t414 — the world-safe cleanup law: the bare glob's blast radius ate the`,
    `${indent}// demo chain's ancestral workdirs (t313's guard caught it live). Protect`,
    `${indent}// every workdir the world still speaks, then glob.`,
    `${indent}let worldProtect = [];`,
    `${indent}try {`,
    `${indent}  const wj = await fetch(\`\${BASE}/api/jobs\`, { headers: SH }).then((r) => r.json());`,
    `${indent}  worldProtect = worldProtectBasenames(wj?.jobs ?? [], createdJobs);`,
    `${indent}} catch { /* the API is gone — the glob degrades to plain rm */ }`,
    `${indent}console.log(worldGuardLine(worldProtect.length));`,
  ].join("\n");

  const patternsArg = JSON.stringify(patterns);
  const restArg = rest.length ? ` ${rest.join(" ")}` : "";
  const newCall = `${indent}execSync(\n${indent}  \`node services/mock-cluster/test-client.mjs '\${worldSafeRmScript(${patternsArg}, worldProtect)}${restArg}'\``;

  let out = src.replace(m[0], protectBlock + "\n" + newCall);
  // insert the import after the last top import
  out = out.split("\n");
  out.splice(lastImport + 1, 0, IMPORT_LINE);
  out = out.join("\n");

  if (dry) {
    console.log(`(dry) would migrate: ${f} — patterns: ${patterns.length}, rest: ${rest.join(" ") || "none"}`);
  } else {
    writeFileSync(f, out);
    console.log(`migrated: ${f} — patterns: ${patterns.length}, rest: ${rest.join(" ") || "none"}`);
    changed++;
  }
}
console.log(dry ? "dry run — nothing written" : `${changed} files migrated`);

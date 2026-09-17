#!/usr/bin/env node
// t274 — the legacy-tree DETECTOR: the repo root must stay free of the
// early era's data trees, or the next build pays their memory bill again
// (Task 273: turbopack tracer EACCES + tailwind content-scan OOM, three
// identical panics in one window).
//
// Verdict (see _legacy-archive/README.md): persist/, relion-projects/,
// mini-services/, qa-shots/, qa-shots-17/, public/molstar{,.css} are the
// real-RELION validation era's untracked runtime data (commit 5a72d14 is
// IN our history — same repo, earlier era) with ZERO product references.
// They live quarantined under _legacy-archive/; this script fails loudly
// (exit 2) if any of those names reappears where the build can see them.
//
//   node scripts/check-foreign-trees.mjs          # the check (exit 0|2)
//
// The qa68 suite drives this script directly AND stages a fake root
// intrusion to watch the exit code flip 0 -> 2 -> 0 (the living proof).

import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

// Names that must NEVER sit in the repo root again (quarantined era data).
const LEGACY_ROOT_NAMES = [
  "persist",
  "relion-projects",
  "mini-services",
  "qa-shots",
  "qa-shots-17",
];

// The standalone molstar bundle copy (23M) — the product imports molstar
// from node_modules; a public/ copy is era legacy wherever it shows up.
const LEGACY_PUBLIC_NAMES = ["molstar", "molstar.css"];

// Where the quarantined trees must live, and the verdict document.
const ARCHIVE = "_legacy-archive";
const ARCHIVE_MEMBERS = [
  "persist",
  "relion-projects",
  "mini-services",
  "molstar",
  "molstar.css",
  "qa-shots",
  "qa-shots-17",
];

let failures = 0;
const ok = (msg) => console.log(`  ok: ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`FAIL: ${msg}`);
};

// 1. repo root must be clean of every legacy name
for (const name of LEGACY_ROOT_NAMES) {
  const p = join(ROOT, name);
  if (existsSync(p)) {
    bad(`legacy tree "${name}/" is BACK in the repo root — the build will pay for it again; move it into ${ARCHIVE}/ (mv ${name} ${ARCHIVE}/)`);
  } else {
    ok(`root is free of "${name}/"`);
  }
}
for (const name of LEGACY_PUBLIC_NAMES) {
  const p = join(ROOT, "public", name);
  if (existsSync(p)) {
    bad(`public/${name} is back — the product imports molstar from node_modules; this 23M copy belongs in ${ARCHIVE}/`);
  } else {
    ok(`public/ is free of "${name}"`);
  }
}

// 2. the archive root itself must exist, hold the verdict README, and
//    actually contain the quarantined members (the mv must have landed)
if (!existsSync(join(ROOT, ARCHIVE))) {
  bad(`the quarantine root ${ARCHIVE}/ is missing — where did the era data go?`);
} else {
  ok(`quarantine root ${ARCHIVE}/ exists`);
  const readme = join(ROOT, ARCHIVE, "README.md");
  if (!existsSync(readme)) {
    bad(`${ARCHIVE}/README.md missing — the ownership verdict must travel with the data`);
  } else {
    const txt = readFileSync(readme, "utf8");
    if (txt.includes("5a72d14") && txt.includes("检疫")) {
      ok(`${ARCHIVE}/README.md carries the ownership verdict`);
    } else {
      bad(`${ARCHIVE}/README.md exists but does not read like the verdict document`);
    }
  }
  for (const member of ARCHIVE_MEMBERS) {
    const p = join(ROOT, ARCHIVE, member);
    if (existsSync(p)) ok(`${ARCHIVE}/${member} present`);
    else bad(`${ARCHIVE}/${member} missing — the quarantine is incomplete`);
  }
}

// 3. the build exclusions must speak the single quarantine root (one line
//    each instead of the per-tree scatter the era trees used to need)
const nextConfig = readFileSync(join(ROOT, "next.config.ts"), "utf8");
if (nextConfig.includes('"_legacy-archive/**"')) {
  ok('next.config.ts outputFileTracingExcludes names "_legacy-archive/**"');
} else {
  bad("next.config.ts does not exclude _legacy-archive/** — the tracer will enumerate 3.3G again");
}
for (const stale of ['"persist/**"', '"relion-projects/**"', '"mini-services/**"']) {
  if (nextConfig.includes(stale)) bad(`next.config.ts still excludes ${stale} — the tree lives in the archive now; one root, one line`);
}
const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
if (css.includes('@source not "../../_legacy-archive"')) {
  ok('globals.css @source not names "../../_legacy-archive"');
} else {
  bad("globals.css lost the _legacy-archive exclusion — tailwind's content scan will OOM again");
}
for (const stale of ['@source not "../../relion-projects"', '@source not "../../persist"', '@source not "../../mini-services"']) {
  if (css.includes(stale)) bad(`globals.css still carries the stale exclusion ${stale} — one root, one line`);
}
// .gitignore must hide the archive (untracked era data must not nag git status)
const gitignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
if (gitignore.includes("/_legacy-archive/")) ok(".gitignore hides /_legacy-archive/");
else bad(".gitignore does not hide /_legacy-archive/ — git status noise returns");

// t276 — the fourth exclusion layer: the TYPE CHECKER. tsconfig's include is
// `**/*.ts`, so bare `tsc --noEmit` (every editor, every CI) used to walk the
// archive and the other non-product trees and report their errors — 12 lines
// of noise drowning the zero-error signal the product itself earns. The
// exclusion law now has four layers: tracer, tailwind, gitignore, tsc.
const tsconfig = readFileSync(join(ROOT, "tsconfig.json"), "utf8");
const tscExcludes = ["_legacy-archive", "examples", "scripts/diag-archive", "skills"];
for (const dir of tscExcludes) {
  if (tsconfig.includes(`"${dir}"`)) ok(`tsconfig exclude hides ${dir}/`);
  else bad(`tsconfig does not exclude "${dir}" — bare tsc walks a non-product tree; the noise hides the next real wound`);
}

if (failures > 0) {
  console.log(`\nFOREIGN-TREE CHECK: ${failures} FAIL — see _legacy-archive/README.md for the verdict and the fix`);
  process.exit(2);
}
console.log("\nFOREIGN-TREE CHECK GREEN (root clean, archive complete, exclusions single-root)");

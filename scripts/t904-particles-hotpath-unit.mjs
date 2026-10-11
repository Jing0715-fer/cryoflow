#!/usr/bin/env node
// t904 — the #8 audit's census unit (the t903 containment/hotpath pattern,
// source-level): the recital's BFS N+1 is confirmed FOSSIL (batched since
// its doctrine was cited by two sibling routes), the LIVING remainder —
// the whole-star parse per request (every page fetch paid a full 13k-row
// parse) and the per-row existsSync storm — is closed: the parse rides
// cachedFileCompute under a unique computeId, the storm collapses to a
// per-request memo, and the honest division (decode NOT cached across
// requests — FS/DB is the mtime key's blind spot) is pinned in source.
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t904-particles-hotpath-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const route = readFileSync(
  join(process.cwd(), "src/app/api/jobs/[id]/particles/route.ts"),
  "utf8"
);

console.log("A — the fossil stays dead (the BFS batched shape)");

ok("A1 one edge query per depth level (findMany over the frontier)", route.includes("db.edge.findMany"));
ok("A2 the batch job query (findMany over the discovered ids)", route.includes("db.job.findMany"));
ok("A3 no per-edge findEffectiveJob await remains in the walk", !/for \(const e of edges\)[\s\S]{0,400}?findEffectiveJob/.test(route));
ok("A4 the batching doctrine docblock stands", route.includes("Batched BFS"));

console.log("B — the living remainder: the parse rides the statcache");

ok("B1 the route imports cachedFileCompute", route.includes('cachedFileCompute } from "@/lib/relion/statcache"'));
ok("B2 the parser is the PURE text twin (no readFileSync inside)", (() => {
  const m = route.match(/function parseParticlesStarText\(text: string\)[\s\S]*?\n\}/);
  return !!m && !m[0].includes("readFileSync");
})(), "parseParticlesStarText must take text, not read the file");
ok("B3 no whole-file readFileSync remains at the parse call site", !route.includes('readFileSync(file, "utf8")'));
ok("B4 the call site rides the cache", route.includes('cachedFileCompute(starPath, "particles:star", parseParticlesStarText)'));
ok("B5 the vanished-between-listing-and-read door is an honest 400", /cachedFileCompute\(starPath[\s\S]{0,400}?No particles STAR file in this job/.test(route));
ok("B6 the shared-instance hazard is pinned (clone-before-mutate law)", route.includes("must clone before mutating"));

console.log("C — the computeId contract (unique per parse site)");

const ids = [...route.matchAll(/"(particles:[a-z-]+)"/g)].map((m) => m[1]);
ok("C1 the particles namespace carries exactly one id (docblock cites the same)", ids.length >= 1 && ids.every((i) => i === "particles:star"), ids.join(", "));

// tree-wide collision census: every computeId literal in src, the new one
// must not collide with any existing (file, computeId) consumer
let tree = "";
let treeFiles = 0;
const particlesFiles = [];
for (const dir of ["src/lib", "src/app/api"]) {
  const walk = (d) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f.name)) {
        const src = readFileSync(p, "utf8");
        tree += src;
        treeFiles++;
        if (src.includes('"particles:star"')) particlesFiles.push(p);
      }
    }
  };
  walk(dir);
}
ok("C2 only the route speaks the particles id", particlesFiles.length === 1 && particlesFiles[0].includes("particles"), particlesFiles.join(", "));
ok("C3 the sibling ids keep their own namespaces", tree.includes('"convergence:class-run"') && tree.includes('"resolution-arc:final-model-reported"'));

console.log("D — the storm collapse (the per-request stack facts memo)");

ok("D1 the memo exists", route.includes("const stackFacts = new Map<"));
ok("D2 the memo caches absence as null (the honest per-request fact)", route.includes("{ ownerJobId: string; stackRel: string } | null"));
ok("D3 the decode loop rides factsFor, not bare existsSync", /for \(const r of rows\) \{[\s\S]*?factsFor\(stackAbs\)/.test(route));
ok("D4 the memo is PER-REQUEST (declared inside the GET body, after resolveOwner)", route.indexOf("const stackFacts") > route.indexOf("const resolveOwner"));
ok("D5 the blind-spot law is pinned (FS state outside the mtime key)", route.includes("mtime key's blind spot"));
ok("D6 exactly one existsSync inside factsFor (the storm collapsed)", (() => {
  const m = route.match(/const factsFor = \(stackAbs: string\) => \{[\s\S]*?\n    \};/);
  return !!m && (m[0].match(/existsSync/g) || []).length === 1;
})());
ok("D7 the absent-stack fallback keeps the old shape (relativize)", /factsFor\(stackAbs\) \?\? \{[\s\S]*?relativize\(workdir, parsed\.stack\)/.test(route));

console.log(`\nt904 particles-hotpath unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

#!/usr/bin/env node
// t903 — the #7 remainder's census unit (the containment-unit pattern,
// source-level): the chart-poll paths ride the statcache, no raw
// readFileSync remains on them, and every new computeId is unique (the
// (file, computeId) contract — one file, several parsers, no collisions).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t903-chart-hotpath-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const conv = readFileSync(join(process.cwd(), "src/lib/convergence-rows.ts"), "utf8");
const arc = readFileSync(join(process.cwd(), "src/app/api/jobs/[id]/resolution-arc/route.ts"), "utf8");

console.log("A — no raw readFileSync remains on the chart-poll paths");

// A1 — convergence-rows: the lib reads dirs, parses through the cache
ok("A1 convergence-rows has no readFileSync", !conv.includes("readFileSync"));
ok("A2 convergence-rows imports the statcache", conv.includes('cachedFileCompute } from "@/lib/relion/statcache"'));

// A2 — the arc route: the final-model read rides the cache
ok("A3 the arc route has no readFileSync", !arc.includes("readFileSync"));
ok("A4 the arc route imports the statcache", arc.includes('cachedFileCompute } from "@/lib/relion/statcache"'));

console.log("B — the computeId contract (unique per parse site)");

const ids = [
  ...[...conv.matchAll(/"(convergence:[a-z-]+)"/g)].map((m) => m[1]),
  ...[...arc.matchAll(/"(resolution-arc:[a-z-]+)"/g)].map((m) => m[1]),
];
ok("B1 three new computeIds present", ids.length === 3, ids.join(", "));
ok(
  "B2 the computeIds are unique",
  new Set(ids).size === ids.length,
);
ok(
  "B3 the arc's reported id differs from chart-data's fsc reader (same file, different parser)",
  !ids.includes("fsc:final-model-reported") && ids.includes("resolution-arc:final-model-reported")
);

console.log("C — the science trio's fossil stays dead (chart-data is cache-only)");

const cd = readFileSync(join(process.cwd(), "src/lib/chart-data.ts"), "utf8");
ok("C1 chart-data has no raw readFileSync", !cd.includes("readFileSync"));
ok("C2 chart-data carries the statcache import", cd.includes("@/lib/relion/statcache"));

console.log(`\nt903 chart-hotpath unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

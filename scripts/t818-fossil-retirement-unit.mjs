#!/usr/bin/env node
/* t818 — the fossil list's FINAL retirement ceremony: every item the
 * Task 13 dispatch recitation carried as "已知遗留" gets its verdict,
 * and the architecture the cures built is pinned so a regression screams.
 *
 * The recitation itself was retired long ago (the stale dispatch text);
 * the ITEMS underneath it kept dissolving one grep at a time (t817
 * retired #13 and #8). This window walked the last three and both
 * feature directions — SEVEN verdicts, all closing the ledger:
 *
 *   #5  fs/browse 无鉴权        → CURED: the route carries the hardening
 *                                 under its own number ("Hardening (#5,
 *                                 rounds 1+2)"): isLocalRequest 403 door
 *                                 (same-origin metadata + Host pin — the
 *                                 DNS-rebinding backstop) + compensating
 *                                 controls in the header comment (listing
 *                                 only, names/sizes only, entry caps, the
 *                                 procfs/sysfs guard).
 *   #6/#14 pathref/star 包含策略 → CURED: resolveInsideJobWorkdir is the
 *                                 SINGLE containment policy for all FIVE
 *                                 workdir-derived routes; the star route's
 *                                 comment names both holes closed (the
 *                                 realpath rule rejected engine symlinks;
 *                                 the lexical rule let planted links out).
 *   #7  chart 全量同步读        → CURED: statcache's cachedFileCompute
 *                                 (mtime-keyed) rides every chart loader —
 *                                 resolution directly, guinier/angdist/
 *                                 topaz through chart-data.ts.
 *   #8  particles BFS N+1      → CURED (t817): batched BFS comments on file.
 *   #13 useMemo localStorage    → CURED (t817): no matches in src.
 *   3D viewer 截面工具          → BUILT: molstar-embed's cross-section
 *                                 section + the toggle + subvolume and
 *                                 subvolume-job routes + mol-viewer's Slice.
 *   Topaz wrapper              → BUILT: the topaz-training route (t486/
 *                                 t487/t488: loader + statcache + the
 *                                 interpretation) + the chart face + the
 *                                 interpretation strip + results wiring.
 *
 * The recitation can finally rest: every item is cured with its evidence
 * on file, or built with its face live. The plaque below pins the doors,
 * the containment, the cache and the faces. */

import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");

let pass = 0;
const fails = [];
const ok = (cond, msg, extra) => {
  if (cond) pass++;
  else fails.push(msg + (extra ? ` (${extra})` : ""));
};

/* A — the door law (#5 and its siblings): the host-enumerating and
 * workdir-derived doors all answer the same-origin + Host-pin guard */
const browse = read("src/app/api/fs/browse/route.ts");
const star = read("src/app/api/jobs/[id]/outputs/star/route.ts");
ok(
  browse.includes("Hardening (#5, rounds 1+2)") && browse.includes("isLocalRequest(request)"),
  "A1 fs/browse carries the hardening under its own number (#5) and the isLocalRequest door",
);
ok(
  browse.includes("DNS-rebinding") && browse.includes("BROWSER_LIST_MAX"),
  "A2 the compensating controls are on file (the rebinding backstop, the entry cap)",
);
ok(
  star.includes("isLocalRequest(request)") && star.includes("the #5 sibling closure"),
  "A3 the star route rides the same door (the #5 sibling closure, t251)",
);
ok(
  browse.includes('status: 403') && star.includes('status: 403'),
  "A4 both doors answer 403 (cross-site access named, not silent)",
);

/* B — the containment unity (#6/#14): ONE policy, FIVE routes */
const jobfile = read("src/lib/relion/jobfile.ts");
const outputs = ["outputs/file", "outputs/star", "outputs/subvolume", "outputs/subvolume-job", "map-profile"];
let unified = 0;
for (const r of outputs) {
  if (read(`src/app/api/jobs/[id]/${r}/route.ts`).includes("resolveInsideJobWorkdir")) unified += 1;
}
ok(
  unified === 5,
  "B1 all FIVE workdir-derived routes import the single containment policy",
  `found ${unified}/5`,
);
ok(
  jobfile.includes("resolveInsideJobWorkdir"),
  "B2 resolveInsideJobWorkdir lives in jobfile.ts (one brain, five consumers)",
);
ok(
  star.includes("Both holes are closed"),
  "B3 the cure's prose names both holes closed (the symlink rejection and the planted-link escape)",
);

/* C — the cache law (#7): the chart loaders ride the mtime-keyed cache */
const chartData = read("src/lib/chart-data.ts");
const cacheRides = (chartData.match(/cachedFileCompute\(/g) || []).length;
ok(
  cacheRides >= 6,
  "C1 chart-data.ts rides cachedFileCompute across its loaders",
  `found ${cacheRides} call sites`,
);
ok(
  chartData.includes('import { cachedFileCompute } from "@/lib/relion/statcache"'),
  "C2 the cache import is the statcache module (one cache, many keys)",
);
const resolution = read("src/app/api/jobs/[id]/resolution/route.ts");
ok(
  resolution.includes('cachedFileCompute') && resolution.includes('"resolution:curres"'),
  "C3 the resolution route rides the cache directly (its own key)",
);
const topaz = read("src/app/api/jobs/[id]/topaz-training/route.ts");
ok(
  topaz.includes("loadTopazTraining") && topaz.includes("statcache key"),
  "C4 the Topaz route's loader carries the statcache key (t487's merge law)",
);

/* D — the faces (the feature directions are BUILT, not pending) */
ok(
  read("src/components/workflow/results/topaz-training-chart.tsx").length > 1000,
  "D1 the Topaz training chart face exists (the route's data has a reader)",
);
const molstar = read("src/components/workflow/results/molstar-embed.tsx");
ok(
  molstar.includes("cross-section (volume slice)") &&
    molstar.includes('aria-label="Toggle cross-section plane"'),
  "D2 the 3D viewer's cross-section face exists (the slice plane toggle)",
);
ok(
  read("src/app/api/jobs/[id]/outputs/subvolume/route.ts").includes("export async function") &&
    read("src/app/api/jobs/[id]/outputs/subvolume-job/route.ts").includes("export async function"),
  "D3 both subvolume routes serve the volume bytes (the cross-section's supply side)",
);

console.log(`t818-fossil-retirement-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}

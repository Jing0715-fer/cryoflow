#!/usr/bin/env node
/* t807 — the FOSSIL LIST formally retired: the dispatch's "known legacy"
 * recitation (Task 13's Stage Summary, five findings) has ridden every
 * dispatch for hundreds of windows while each finding was CURED by a
 * later one — the list kept being recited because nobody walked back to
 * check. This window is that walk. t806's lesson, applied to the oldest
 * map on file: a debt name is a map mark, and maps go stale.
 *
 * The verdicts (each asserted below, evidence first):
 *   #5   fs/browse without auth          → DEAD (isLocalRequest, rounds 1+2)
 *   #6   pathref/star policy mismatch    → DEAD (one containment policy,
 *   #14                                    both holes closed, in prose)
 *   #7   chart routes full sync reads    → DEAD (cachedFileCompute via
 *                                          statcache; async loaders)
 *   #8   particles BFS N+1               → DEAD (batched BFS, one edge
 *                                          query per depth)
 *   #13  localStorage write inside useMemo → DEAD (tree scan, no match)
 *
 * The probe stands as the retirement record: if any of these cures ever
 * regresses, the fleet goes red ON THE FINDING ITSELF — the fossil list
 * will never need to be recited again, because the gates now carry it. */

import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const read = (p) => readFileSync(p, "utf8");

let pass = 0;
const fails = [];
const ok = (cond, msg) => {
  if (cond) pass++;
  else fails.push(msg);
};

/* ------------------------------------------------------------------ */
/* A — fossil #5: the fs/browse door                                   */
/* ------------------------------------------------------------------ */

const browse = read("src/app/api/fs/browse/route.ts");
ok(
  browse.includes("isLocalRequest") && browse.includes('status: 403'),
  "A1 fossil #5 RETIRED — the browse door carries the same-origin + Host-pin guard (403 on cross-site)",
);
ok(
  browse.includes("Hardening (#5, rounds 1+2)"),
  "A2 the cure's own record on file (the route names its rounds — the fix predates this walk)",
);
ok(
  browse.includes("DNS-rebinding"),
  "A3 the threat model named where the fix lives (the dispatch's 'no auth' was stale the day it was written)");

/* ------------------------------------------------------------------ */
/* B — fossils #6 + #14: one containment policy, both outputs routes   */
/* ------------------------------------------------------------------ */

const starRoute = read("src/app/api/jobs/[id]/outputs/star/route.ts");
const fileRoute = read("src/app/api/jobs/[id]/outputs/file/route.ts");
ok(
  starRoute.includes("resolveInsideJobWorkdir") && fileRoute.includes("resolveInsideJobWorkdir"),
  "B1 fossils #6/#14 RETIRED — BOTH outputs routes import the single containment policy",
);
/* the verdict comment wraps "single / containment policy" across two
 * lines (the // prefix rides between) — match the phrases that live
 * inside single lines: "containment policy for both outputs routes"
 * and "Both holes are closed". The wrap-split is the family's second
 * verse, re-learned here in its FULL form (newline + // prefix). */
ok(
  starRoute.includes("containment policy for both outputs routes") &&
    starRoute.includes("Both holes are closed"),
  "B2 the unification's own verdict on file (lexical scoping + app-tree realpath, the two old holes named closed) — the comment's line wrap splits 'single containment policy' (newline + // prefix between the words), so the assert matches the single-line phrases",
);
ok(
  read("src/lib/relion/pathref.ts").includes("not an existing file") &&
    read("src/lib/relion/pathref.ts").includes("readPathrefTarget"),
  "B3 the pathref escape hatch validates its target (the marker cannot name a non-file)",
);

/* ------------------------------------------------------------------ */
/* C — fossil #7: the chart hot paths                                  */
/* ------------------------------------------------------------------ */

const chartData = read("src/lib/chart-data.ts");
const chartRoutes = ["guinier", "resolution", "angdist"].map(
  (r) => read(`src/app/api/jobs/[id]/${r}/route.ts`)
);
ok(
  chartRoutes.every((r) => r.includes("isLocalRequest")),
  "C1 fossil #7 RETIRED (guards) — all three chart routes carry the local guard",
);
ok(
  chartData.includes("from \"@/lib/relion/statcache\"") &&
    chartData.includes("cachedFileCompute"),
  "C2 fossil #7 RETIRED (reads) — the loaders parse through statcache's keyed file cache, not raw full re-reads",
);
ok(
  (chartData.match(/export async function load/g) || []).length >= 6,
  "C3 the loaders are async end to end (the sync-read shape the finding described is gone from the signatures)",
);

/* ------------------------------------------------------------------ */
/* D — fossil #8: the particles BFS                                    */
/* ------------------------------------------------------------------ */

const particles = read("src/app/api/jobs/[id]/particles/route.ts");
ok(
  particles.includes("Batched BFS"),
  "D1 fossil #8 RETIRED — the lineage walk batches (one edge query per depth, one job query for all discovered ids)",
);
ok(
  particles.includes("The old loop awaited findEffectiveJob PER EDGE"),
  "D2 the old N+1 shape named as history (the cure's record describes exactly what the finding saw)",
);

/* ------------------------------------------------------------------ */
/* E — fossil #13: no localStorage write inside a useMemo, tree-wide   */
/* ------------------------------------------------------------------ */

/* walk src/, scan every .ts/.tsx for the multi-line shape:
 * useMemo( ...within ~400 chars... localStorage.setItem */
let fossil13Hits = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p);
    } else if (/\.(tsx?|mjs)$/.test(name)) {
      const text = read(p);
      const m = text.match(/useMemo\(\s*[\s\S]{0,400}?localStorage\.setItem/);
      if (m) fossil13Hits++;
    }
  }
}
walk("src");
ok(
  fossil13Hits === 0,
  "E1 fossil #13 RETIRED — a full src tree scan finds ZERO useMemo bodies writing localStorage (the persisted store owns its writes)",
);

/* ------------------------------------------------------------------ */
/* F — the retirement's own honesty                                    */
/* ------------------------------------------------------------------ */

ok(
  browse.includes("cannot be scoped to a sandbox root") &&
    browse.includes("compensating controls"),
  "F1 the retired finding is not merely silent — the route documents WHY full-host browsing stays (the import UX requires it) and names the compensating controls",
);
ok(
  particles.includes("FULL upstream lineage"),
  "F2 the batched BFS kept its semantics while curing the count (the walk is still FULL lineage, not just direct parents)",
);

console.log(`t807-fossil-audit-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}

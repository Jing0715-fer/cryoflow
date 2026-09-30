/**
 * t492 — the tables refuse to die quietly: the resilience well's
 * second act. The seven chart panels joined the well in t491; this
 * window the TABLE family follows, and each of them brings a different
 * disease the well cures:
 *
 *   star-table      — had a destructive verdict face, but 4xx and a
 *                     network blip shared it, and nothing was retryable.
 *                     It lives in a dialog the user OPENED, so it may
 *                     never self-hide: two failures, two faces (amber
 *                     retryable wound vs destructive final verdict).
 *   picks-map       — caught errors into a state it never rendered
 *                     (`error && !data → null`): a dev-lane blip read
 *                     as "this job picked nothing".
 *   particle-browser
 *     (outer)       — same captured-then-discarded error, same lie.
 *     (inner pages) — `if (res.ok) setPage(...)` swallowed non-ok
 *                     outright, and a network throw escaped the
 *                     try/FINALLY as an unhandled rejection; first
 *                     open fell through to "No particles returned",
 *                     which LIED about a fetch that never landed.
 *
 *   T1 the hook      — the reset moved to render (official pattern);
 *                      empty still carries the reason (t492's law)
 *   T2 star-table    — wired, dual-face contract, no self-hide
 *   T3 picks-map     — wired, FOM floor re-derived in render, silence
 *                      reserved for honest absence only
 *   T4 particle outer— wired, same contract
 *   T5 particle pages— pageError face + retry, old page stays alive
 *   T6 the neighbors — different contracts are not impostors
 *   T7 the wells     — every url matches a real route segment
 */

import { readFileSync, existsSync } from "fs";

const REPO = "/home/z/my-project";
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}

const read = (p: string): string => readFileSync(`${REPO}/${p}`, "utf8");

// ---------------------------------------------------------------- T1
section("T1 the hook — render-time reset, empty still carries the reason");
const hookSrc = read("src/lib/use-chart-resource.ts");
ok(/if \(key !== prevKey\)/.test(hookSrc), "the loading reset lives in RENDER (official adjust-state-on-prop-change pattern)");
ok(!/useEffect\(\(\) => \{\s*let cancelled = false;\s*lastGood\.current = null;\s*setState\(/.test(hookSrc.replace(/\s+/g, " ")), "the effect body no longer setState()s synchronously (set-state-in-effect extinct)");
ok(/lastGood\.current = null;/.test(hookSrc), "lastGood still resets per identity change (ref write in the effect, not render)");
ok(/"empty",\s*data:\s*null,\s*error:\s*msg/.test(hookSrc.replace(/\s+/g, " ")), "empty carries the reason: the verdict travels even when nobody renders it (t492's law)");

// ---------------------------------------------------------------- T2
section("T2 star-table — the user-opened view owes its reader a face");
const starSrc = read("src/components/workflow/results/star-table.tsx");
ok(starSrc.includes("useChartResource<StarResponse>"), "the fetch belongs to the well");
ok(/outputs\/star\?path=\$\{encodeURIComponent\(path\)\}&rows=100/.test(starSrc), "url literal: outputs/star + encoded path + rows=100 (byte-faithful)");
ok(!/await fetch\(/.test(starSrc), "no hand-rolled fetch residue");
ok(!/useState</.test(starSrc), "no hand-rolled data/error state (the hook owns the machine)");
ok(starSrc.includes('label="STAR table"'), "wounded → ChartErrorStrip, the panel's own voice");
ok(/status === "wounded"/.test(starSrc) && /onRetry=\{retry\}/.test(starSrc), "transient is retryable (the strip's Retry chip)");
ok(/status === "empty"/.test(starSrc) && /border-destructive\/30/.test(starSrc), "definitive 4xx keeps the destructive verdict (retrying a 404 says the same thing twice)");
ok(/\{error \?\? "/.test(starSrc), "the verdict quotes the hook's evidence (empty's reason is information)");
ok(starSrc.includes("Skeleton"), "loading keeps the skeleton face");
ok(!/return null/.test(starSrc), "never self-hides: a user-opened dialog with no table is a lie (t492's contract)");

// ---------------------------------------------------------------- T3
section("T3 picks-map — captured-then-discarded error, rendered at last");
const picksSrc = read("src/components/workflow/results/picks-map.tsx");
ok(picksSrc.includes("useChartResource<PicksResponse>"), "the fetch belongs to the well");
ok(/\/api\/jobs\/\$\{jobId\}\/picks/.test(picksSrc), "url literal: /picks");
ok(!/await fetch\(/.test(picksSrc), "no hand-rolled fetch residue");
ok(!/useState<string \| null>\(null\)/.test(picksSrc), "the never-rendered error state is extinct");
ok(/status === "wounded"/.test(picksSrc) && picksSrc.includes('label="Picked particles map"'), "wounded → the amber strip, named");
ok(/status === "empty"\) return null/.test(picksSrc), "empty (job gone) stays honestly silent — silence reserved for ABSENCE only");
ok(/data\.micrographs\.length === 0 \|\| data\.imageWidth === 0\) return null/.test(picksSrc), "ready-but-empty still renders null (the 200-empty-body contract, byte-preserved)");
ok(/if \(data !== seenData\)/.test(picksSrc) && /setFomMin\(Number\.isFinite\(lo\) \? lo : 0\)/.test(picksSrc), "the FOM floor re-derives during render (no cascading effect setState)");
ok(!/useEffect/.test(picksSrc), "no effect left in the component (the fetch is the hook's, the derivation is render's)");

// ---------------------------------------------------------------- T4
section("T4 particle-browser (outer) — same disease, same cure");
const pbSrc = read("src/components/workflow/results/particle-browser.tsx");
ok(pbSrc.includes("useChartResource<ParticlesResponse>"), "the outer fetch belongs to the well");
ok(/\/api\/jobs\/\$\{jobId\}\/particles`/.test(pbSrc), "url literal: /particles");
ok(/status === "wounded"/.test(pbSrc) && pbSrc.includes('label="Particle stacks"'), "wounded → the amber strip, named");
ok(/status === "empty"\) return null/.test(pbSrc), "empty (400 no particle stacks / 404 job gone) stays honestly silent");
ok(/if \(!data \|\| data\.groups\.length === 0\) return null/.test(pbSrc), "ready-but-empty still renders null (contract preserved)");

// ---------------------------------------------------------------- T5
section("T5 particle pages — the page that refused speaks, the old page stays");
ok(/const \[pageError, setPageError\] = useState<string \| null>\(null\)/.test(pbSrc), "pageError state exists (the swallowed non-ok finally has a face)");
ok(/setPageError\(body\?\.error \?\? `HTTP \$\{res\.status\}`\)/.test(pbSrc), "non-ok no longer swallowed: the route's own error message is quoted");
ok(/catch \(err\) \{[\s\S]*?setPageError\(err instanceof Error \? err\.message : "fetch failed"\)/.test(pbSrc), "the catch exists (the unhandled rejection of the try/FINALLY is extinct)");
ok(pbSrc.split('data-page-error=""').length - 1 === 2, "two pageError faces: first-open verdict + mid-paging note");
ok(pbSrc.split("data-page-error-retry").length - 1 === 2, "both faces carry a Retry chip");
ok(/\) : pageError \? \(/.test(pbSrc.replace(/\s+/g, " ")), "first-open failure renders BEFORE the 'No particles returned' line (the old fall-through LIED)");
ok(/void loadPage\(page\.offset\)/.test(pbSrc), "mid-paging retry re-fires the SAME offset (the old page stayed alive)");
ok(/void loadPage\(0\)/.test(pbSrc), "first-open retry re-fires page zero");
ok(/\{pageError \? \(/.test(pbSrc.replace(/\s+/g, " ")) && /page\.offset \+ 1\}–/.test(pbSrc), "the pagination row keeps its counter next to the failure note (stale but alive)");

// ---------------------------------------------------------------- T6
section("T6 the neighbors — different contracts are not impostors");
const rvSrc = read("src/components/workflow/results/results-view.tsx");
ok(/const res = await fetch\(\s*`\/api\/jobs\/\$\{job\.id\}\/outputs`/.test(rvSrc.replace(/\s+/g, " ")), "results-view's outputs loader keeps its own hand-rolled contract (t491's 'no impostors' law)");
ok(/retriedRef/.test(rvSrc) && /Job not found/.test(rvSrc), "its verdict semantics (one retry, record-gone) are intact");
ok(!/error && !data\) return null/.test(picksSrc) && !/error && !data\) return null/.test(pbSrc), "the captured-then-discarded idiom is extinct in both family members");
ok(read("src/components/workflow/results/chart-error-strip.tsx").includes('data-chart-error-retry=""'), "the strip's Retry chip stays addressable (t491 marker untouched)");

// ---------------------------------------------------------------- T7
section("T7 the wells — every url matches a real route segment");
ok(existsSync(`${REPO}/src/app/api/jobs/[id]/picks/route.ts`), "route exists: /api/jobs/[id]/picks");
ok(existsSync(`${REPO}/src/app/api/jobs/[id]/particles/route.ts`), "route exists: /api/jobs/[id]/particles");
ok(existsSync(`${REPO}/src/app/api/jobs/[id]/outputs/star/route.ts`), "route exists: /api/jobs/[id]/outputs/star");
ok(/No particles STAR file in this job/.test(read("src/app/api/jobs/[id]/particles/route.ts")), "particles' 400 carries its own verdict (the empty face quotes it via the hook's msg)");
ok(/Job not found/.test(read("src/app/api/jobs/[id]/picks/route.ts")), "picks' 404 carries its own verdict");

console.log(`\n== t492 bench: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

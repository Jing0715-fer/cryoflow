/**
 * t491 — the panels refuse to die quietly: the seven result panels
 * (fsc / guinier / angdist / ctf / motion / topaz / resolution) hand
 * their fetches to ONE shared state machine (use-chart-resource) whose
 * four statuses separate the three things silence used to conflate —
 * loading, honest absence (definitive 4xx → self-hide, contract
 * preserved), and a WOUND (transient failures exhausted → a visible
 * amber strip with a Retry chip). classifyFetchFailure is the readable
 * half of retry-fetch's own law: 4xx (non-429) is definitive, network
 * errors and 5xx/429 are transient.
 *
 *   T1 the classifier — behavioral: which failures may hide, which may not
 *   T2 the hook      — one birthplace of loading/ready/empty/wounded
 *   T3 the strip     — the wound's face: marker, evidence, Retry chip
 *   T4 seven panels  — wired, silent-catch residue extinct, contracts kept
 *   T5 the neighbors — the report builder's honest gaps are NOT wounds;
 *                      retry-fetch's defaults untouched
 *   T6 the wells     — every panel url matches a real route segment (a
 *                      typo would 404 → empty → the OLD invisible trap)
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

const { classifyFetchFailure } = await import("../src/lib/retry-fetch");

const PANELS: { file: string; label: string; poll: string | null }[] = [
  { file: "fsc-chart.tsx", label: "FSC curve", poll: "30_000" },
  { file: "guinier-chart.tsx", label: "Guinier plot", poll: "30_000" },
  { file: "angular-distribution-chart.tsx", label: "Angular distribution", poll: "30_000" },
  { file: "ctf-quality-chart.tsx", label: "CTF fit quality", poll: null },
  { file: "motion-drift-chart.tsx", label: "Motion drift", poll: null },
  { file: "topaz-training-chart.tsx", label: "Picker training", poll: "20_000" },
  { file: "resolution-chart.tsx", label: "Resolution evolution", poll: "30_000" },
];

// ---------------------------------------------------------------- T1
section("T1 the classifier — definitive 4xx vs transient everything else");
ok(classifyFetchFailure(new Error("HTTP 404")) === "definitive", "HTTP 404 → definitive (honest absence may hide)");
ok(classifyFetchFailure(new Error("HTTP 403")) === "definitive", "HTTP 403 → definitive");
ok(classifyFetchFailure(new Error("HTTP 400")) === "definitive", "HTTP 400 → definitive");
ok(classifyFetchFailure(new Error("HTTP 429")) === "transient", "HTTP 429 → transient (retry exhausts, then a WOUND)");
ok(classifyFetchFailure(new Error("HTTP 500")) === "transient", "HTTP 500 → transient");
ok(classifyFetchFailure(new Error("HTTP 502")) === "transient", "HTTP 502 → transient");
ok(classifyFetchFailure(new TypeError("Failed to fetch")) === "transient", "network TypeError → transient (the OOM face)");
ok(classifyFetchFailure("fetch failed") === "transient", "non-Error → transient");
ok(
  /^HTTP 4\\d\\d\$/.test(readFileSync(`${REPO}/src/lib/retry-fetch.ts`, "utf8"))
    ? true
    : /return \/\^HTTP 4/.test(readFileSync(`${REPO}/src/lib/retry-fetch.ts`, "utf8")),
  "the 4xx boundary lives in retry-fetch (one birthplace, not per-panel)"
);

// ---------------------------------------------------------------- T2
section("T2 the hook — one birthplace of loading/ready/empty/wounded");
const hookPath = `${REPO}/src/lib/use-chart-resource.ts`;
ok(existsSync(hookPath), "use-chart-resource.ts exists");
const hookSrc = existsSync(hookPath) ? readFileSync(hookPath, "utf8") : "";
ok(hookSrc.includes('"use client"'), "hook is a client module");
ok(hookSrc.includes('"loading"') && hookSrc.includes('"ready"') && hookSrc.includes('"empty"') && hookSrc.includes('"wounded"'), "four statuses: loading / ready / empty / wounded");
ok(hookSrc.includes("classifyFetchFailure"), "the hook reads the classifier (no string-matching twin)");
ok(hookSrc.includes("fetchJsonRetry"), "the hook fetches through retry-fetch (transient retries preserved)");
ok(hookSrc.includes("lastGood"), "lastGood ref: a poll blip keeps the live chart (stale but alive)");
ok(hookSrc.includes("setNonce") || hookSrc.includes("setNonce((n)"), "retry() bumps a nonce → the effect re-fires");
ok(/pollMs\?:\s*number\s*\|\s*null/.test(hookSrc), "pollMs option (null = one-shot fetch for completed jobs)");
ok(/"empty",\s*data:\s*null,\s*error:\s*msg/.test(hookSrc.replace(/\s+/g, " ")), "definitive → empty still carries the reason (t492: an absence's reason is information; panels self-hide, user-opened views quote it)");
ok(hookSrc.includes("ChartResource<"), "the ChartResource face is exported for the panels");

// ---------------------------------------------------------------- T3
section("T3 the strip — the wound's visible face");
const stripPath = `${REPO}/src/components/workflow/results/chart-error-strip.tsx`;
ok(existsSync(stripPath), "chart-error-strip.tsx exists");
const stripSrc = existsSync(stripPath) ? readFileSync(stripPath, "utf8") : "";
ok(stripSrc.includes('data-chart-error=""'), "marker: data-chart-error (bench/eval can find the wound)");
ok(stripSrc.includes('data-chart-error-retry=""'), "marker: data-chart-error-retry (the chip is addressable)");
ok(stripSrc.includes('aria-live="polite"'), "aria-live polite — the wound announces itself without screaming");
ok(stripSrc.includes("TriangleAlert"), "amber family icon");
ok(stripSrc.includes("onRetry"), "the chip re-fires the hook's retry");
ok(stripSrc.includes("detail?") || stripSrc.includes("detail:"), "detail param: the wound carries its evidence (HTTP 502 …)");
ok(stripSrc.includes("amber-600/25") && stripSrc.includes("amber-600/5"), "amber tone — same family as the interpretation strips");
ok(stripSrc.includes("busy or restarting"), "the reason is honest: busy/restarting, not a fake science verdict");

// ---------------------------------------------------------------- T4
section("T4 the seven panels — wired, silent residue extinct, contracts kept");
for (const p of PANELS) {
  const src = readFileSync(`${REPO}/src/components/workflow/results/${p.file}`, "utf8");
  ok(src.includes("useChartResource") && src.includes("ChartErrorStrip"), `${p.file}: hook + strip wired`);
  ok(!src.includes("fetchJsonRetry"), `${p.file}: no direct fetchJsonRetry (one birthplace)`);
  ok(!src.includes("useEffect") && !src.includes("setData") && !src.includes("setError"), `${p.file}: hand-rolled effect residue extinct`);
  ok(src.includes('status === "wounded"'), `${p.file}: the wound gate exists`);
  const woundedIdx = src.indexOf('status === "wounded"');
  // the honest-empty gate is the FIRST return null AFTER the wounded gate —
  // derivation helpers (e.g. motion's stats useMemo) may return null earlier
  const nullIdx = woundedIdx === -1 ? -1 : src.indexOf("return null", woundedIdx);
  ok(woundedIdx !== -1 && nullIdx !== -1, `${p.file}: wounded strip renders BEFORE the honest-empty return null`);
  ok(src.includes(`label="${p.label}"`), `${p.file}: the strip speaks the chart's own name ("${p.label}")`);
  ok(src.includes("detail={error ?? undefined}") && src.includes("onRetry={retry}"), `${p.file}: strip carries evidence + retry`);
  if (p.poll) {
    ok(src.includes(`pollMs: running ? ${p.poll} : null`), `${p.file}: poll contract preserved (${p.poll} while running)`);
  } else {
    ok(!src.includes("pollMs"), `${p.file}: no poll (completed-job history does not change)`);
  }
  ok(/return null/.test(src), `${p.file}: self-hide contract preserved (loading/empty → null)`);
}

// ---------------------------------------------------------------- T5
section("T5 the neighbors — report gaps stay honest gaps, retry-fetch untouched");
const resultsViewSrc = readFileSync(`${REPO}/src/components/workflow/results/results-view.tsx`, "utf8");
ok(resultsViewSrc.includes(".catch(() => {})"), "the report builder's honest gaps remain (a failed probe is not a section — t490 contract)");
ok(!resultsViewSrc.includes("useChartResource"), "results-view's report probes do NOT drink the panel hook (different contract: absence = no section)");
const retrySrc = readFileSync(`${REPO}/src/lib/retry-fetch.ts`, "utf8");
ok(retrySrc.includes("retries = 2") && retrySrc.includes("backoffMs = 1500"), "retry-fetch defaults untouched (3 attempts, linear backoff)");
ok(retrySrc.includes('res.status < 500 && res.status !== 429'), "retry-fetch's definitive-4xx immediate throw untouched");

// ---------------------------------------------------------------- T6
section("T6 the wells — every panel url matches a real route (a typo = invisible forever)");
const ROUTES: Record<string, string> = {
  "fsc-chart.tsx": "/fsc",
  "guinier-chart.tsx": "/guinier",
  "angular-distribution-chart.tsx": "/angdist",
  "ctf-quality-chart.tsx": "/ctf",
  "motion-drift-chart.tsx": "/motion",
  "topaz-training-chart.tsx": "/topaz-training",
  "resolution-chart.tsx": "/resolution",
};
for (const p of PANELS) {
  const seg = ROUTES[p.file];
  const src = readFileSync(`${REPO}/src/components/workflow/results/${p.file}`, "utf8");
  const urlRe = new RegExp("`/api/jobs/\\$\\{jobId\\}" + seg.replace("-", "\\-") + "`");
  ok(urlRe.test(src), `${p.file}: url literal → ${seg}`);
  ok(
    existsSync(`${REPO}/src/app/api/jobs/[id]${seg}/route.ts`),
    `route exists: /api/jobs/[id]${seg}`
  );
}

console.log(`\n== t491 bench: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

/**
 * diag-t368 — three field tickets, one smoke:
 *
 *   1. the duplicate React key (`extracted` twice in the particle-flow
 *      funnel) — a re-run extract/classify makes two completed jobs answer
 *      the SAME stage; the old key={row.key} (the stage name) rendered two
 *      siblings with one key. Fixed: the row keys by the JOB id.
 *   2. live-round streaming (t368) — a RUNNING remote classification now
 *      streams its per-round class stacks home DURING the run: the sweep's
 *      heartbeat carries a ---CF:ROUNDS--- stat listing, and settled rounds
 *      of the current generation go straight to the render scheduler.
 *   3. the dashboard deferral — the spotlight rides useDeferredValue so
 *      pollTick's 1.2s job-array merges re-render the chart-heavy sections
 *      at transition priority (the recurring open-page stutter).
 *
 * A. source X-ray (the merged tree carries every fix)
 * B. the app boots: canvas cards + the analytics section mount, zero
 *    console/page errors (lean-load aborts excluded per the t356 doctrine)
 * C. server parity: /api/jobs count === DOM [data-job] cards
 *
 * Run (single tool call, per the box's memory doctrine — the server must be
 * warm from curls BEFORE the browser lands, one browser load per session):
 *   bun scripts/diag-t368-live-rounds-smoke.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa/";
let pass = 0, fail = 0;
const must = (cond, name) => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
};

/* ---------- A — source X-ray ---------- */
console.log("A — source X-ray (the three fixes are in the tree)");
const analytics = readFileSync("src/components/workflow/pipeline-analytics.tsx", "utf8");
const remoteRun = readFileSync("src/lib/remote/remote-run.ts", "utf8");
const dashboard = readFileSync("src/components/workflow/project-dashboard.tsx", "utf8");

must(
  /key=\{row\.jobId\}/.test(analytics) && /jobId: job\.id/.test(analytics),
  "A1 pipeline-analytics: the flow row keys by the JOB id (duplicate `extracted` impossible)"
);
must(
  /---CF:ROUNDS---/.test(remoteRun) && /reason: "live-sweep"/.test(remoteRun),
  "A2 remote-run: the heartbeat carries the rounds listing + the live-sweep scheduler"
);
must(
  /x\.mtime \+ 90 >= fenceSec && x\.mtime \+ 60 <= nowSec/.test(remoteRun),
  "A3 remote-run: generation gate (≥ dispatch fence) + settle gate (≥ 60s old) on streamed rounds"
);
must(
  /useDeferredValue\(jobs\)/.test(dashboard) && /\[\.\.\.deferredJobs\]\.sort/.test(dashboard),
  "A4 project-dashboard: the spotlight rides a deferred jobs copy (poll merges at transition priority)"
);

/* ---------- B/C — one browser load, shaved chromium (4GB doctrine) ---------- */
console.log("B — the app boots (single-process chromium, lean assets)");
const abortedUrls = new Set();
const routeLean = (route) => {
  abortedUrls.add(route.request().url());
  route.abort();
};
const consoleErrors = [];
const onConsoleError = (m) => {
  if (m.type() !== "error") return;
  const loc = m.location()?.url ?? "";
  if (abortedUrls.has(loc)) return; // our own lean-load aborts
  if (/net::ERR_FAILED/.test(m.text()) && [...abortedUrls].some((u) => m.text().includes(u))) return;
  consoleErrors.push(m.text().slice(0, 160));
};

const browser = await chromium.launch({
  args: [
    "--single-process",
    "--js-flags=--max-old-space-size=256",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--renderer-process-limit=1",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/\.(woff2?|png|svg|jpe?g)$/i, routeLean);
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 160)));
  page.on("console", onConsoleError);

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-job]", { timeout: 60000 });
  await page.waitForTimeout(2500);

  const domJobs = await page.evaluate(() => document.querySelectorAll("[data-job]").length);
  must(domJobs > 0, `B1 canvas renders job cards (${domJobs} on the DOM)`);

  // switch to the PROJECT DASHBOARD view (the surface the user opens —
  // the roster + the spotlight + the analytics section live there)
  await page.click('button[role="tab"][title*="Project dashboard"]');
  await page.waitForTimeout(1200);

  // the dashboard spotlight mounts its roster chrome (the "newest first"
  // band rides above the jobs table); the analytics section itself follows
  // the honest-hide contract — it mounts ONLY with content (flow ≥ 2 rows,
  // milestones, or runs), so a result-less seed project must NOT show it
  const rosterMounted = await page.evaluate(
    () => document.body.textContent?.includes("newest first") === true
  );
  must(rosterMounted, "B2 the dashboard's roster chrome mounted");

  const res = await fetch(BASE + "/api/jobs");
  const jobsData = await res.json().catch(() => ({}));
  const srvJobs = Array.isArray(jobsData?.jobs) ? jobsData.jobs.length : -1;
  const seedHasResults = jobsData?.jobs?.some?.((j) => j.status === "completed" && j.result) ?? false;
  const analyticsMounted = await page.evaluate(
    () => document.querySelector('section[aria-label="Pipeline analytics"]') != null
  );
  must(
    analyticsMounted === seedHasResults,
    "B2b the analytics section follows the honest-hide contract (mounted=" +
      analyticsMounted + ", seed carries completed results=" + seedHasResults + ")"
  );

  must(res.status === 200 && srvJobs >= 0, `C1 /api/jobs answers 200 (${srvJobs} rows)`);
  must(srvJobs === domJobs, `C2 DOM cards (${domJobs}) === server jobs (${srvJobs})`);

  must(
    consoleErrors.length === 0,
    "B3 zero console/page errors" + (consoleErrors.length ? " — " + consoleErrors.slice(0, 3).join(" ; ") : "")
  );

  await page.screenshot({ path: SHOTS + "t368-live-rounds-smoke.png" });
} finally {
  await browser.close();
}

console.log(`\ndiag-t368: ${pass} passed, ${fail} failed ${fail === 0 ? "— ALL GREEN" : "— RED"}`);
process.exit(fail === 0 ? 0 : 1);

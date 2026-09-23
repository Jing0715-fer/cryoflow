/**
 * diag-t361 — the merged-tree smoke: BOTH t360 cards (the sandbox's mpirun
 * single-writer fix + the user's cluster-side mapimport) landed intact, the
 * t361 local-lane follow-ups are in, and the app still boots clean.
 *
 * A. source X-ray — the five fixes are present in the merged tree:
 *    A1 remote-run.ts: MPI lane swaps relion_refine → relion_refine_mpi (t360)
 *    A2 remote-run.ts: sbatch preflight refuses a module with no _mpi build (t360)
 *    A3 engine.ts: no _mpi build → SEQUENTIAL fallback, never mpirun around
 *       the serial binary (t361 — the t360 catastrophe's local edition)
 *    A4 engine.ts: resume without mpirun/_mpi resumes SERIALLY instead of
 *       silently discarding the checkpoint (t361)
 *    A5 iteration-live.ts: a right-sized all-zero-header stack gets the
 *       multi-writer verdict + re-dispatch remedy (t361)
 * B. page boots: canvas renders job cards, zero console/page errors
 *    (lean-load aborts excluded per the t356 doctrine)
 * C. server parity: /api/jobs count === DOM [data-job] cards
 *
 * Run (single tool call, per the box's memory doctrine — the server must be
 * warm from curls BEFORE the browser lands, one browser load per session):
 *   bun scripts/diag-t361-merged-smoke.mjs
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

/* ---------- A — source X-ray: the fixes survived the merge ---------- */
console.log("A — source X-ray (the merged tree carries every fix)");
const remoteRun = readFileSync("src/lib/remote/remote-run.ts", "utf8");
const engine = readFileSync("src/lib/relion/engine.ts", "utf8");
const iterLive = readFileSync("src/lib/remote/iteration-live.ts", "utf8");

must(
  /argv\[0\]\s*=\s*argv\[0\]\.replace\(\/relion_refine\$\/i,\s*"relion_refine_mpi"\)/.test(remoteRun),
  "A1 remote-run.ts: MPI lane swaps the serial binary for relion_refine_mpi (t360)"
);
must(
  /command -v relion_refine_mpi/.test(remoteRun) && /CRYOFLOW_ERR: relion_refine_mpi not found/.test(remoteRun),
  "A2 remote-run.ts: preflight refuses a module with mpirun but no _mpi build (t360)"
);
must(
  /let mpiWrapped = false/.test(engine) && /if \(mpiEligible && !mpiWrapped\)/.test(engine),
  "A3 engine.ts: no _mpi build → sequential fallback, never mpirun around the serial binary (t361)"
);
must(
  /Resume sequentially instead of restarting from zero/.test(engine),
  "A4 engine.ts: serial --continue resume when mpirun/_mpi absent (t361)"
);
must(
  /MRC header is all zeros/.test(iterLive) && /re-dispatch this job/.test(iterLive),
  "A5 iteration-live.ts: zero-header stack → multi-writer verdict + re-dispatch remedy (t361)"
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
  consoleErrors.push(m.text().slice(0, 120));
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
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 120)));
  page.on("console", onConsoleError);

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-job]", { timeout: 60000 });
  await page.waitForTimeout(2500);

  const domJobs = await page.evaluate(() => document.querySelectorAll("[data-job]").length);
  must(domJobs > 0, `B1 canvas renders job cards (${domJobs} on the DOM)`);

  const res = await fetch(BASE + "/api/jobs");
  const jobsData = await res.json().catch(() => ({}));
  const srvJobs = Array.isArray(jobsData?.jobs) ? jobsData.jobs.length : -1;
  must(res.status === 200 && srvJobs >= 0, `C1 /api/jobs answers 200 (${srvJobs} rows)`);
  must(srvJobs === domJobs, `C2 DOM cards (${domJobs}) === server jobs (${srvJobs})`);

  must(consoleErrors.length === 0, "B2 zero console/page errors" + (consoleErrors.length ? " — " + consoleErrors.slice(0, 3).join(" ; ") : ""));

  await page.screenshot({ path: SHOTS + "t361-merged-smoke.png" });
} finally {
  await browser.close();
}

console.log(`\ndiag-t361: ${pass} passed, ${fail} failed ${fail === 0 ? "— ALL GREEN" : "— RED"}`);
process.exit(fail === 0 ? 0 : 1);

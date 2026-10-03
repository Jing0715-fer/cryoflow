/** t533 — the reaper learns the whole graveyard, and the speech is tested.
 *
 *  t532's exam ledger convicted the lazy-polling law: a remote world's
 *  finalize was only OBSERVED while a human drove the jobs GET tick — the
 *  ten-ring chain froze at the finish line the moment the examiner stopped
 *  polling. The fix is the global reaper: a background beat that reconciles
 *  EVERY project's running+pending rows through the same machinery the GET
 *  route uses. The laws this bench pins:
 *
 *    LAW 1 — composers are pure: the interval clamp, the completed-flip
 *            diff and the pending-retry planner are functions of their
 *            arguments, never of the box or the DB they run on. The clamp
 *            boundaries encode the t525 lesson (5s floor, 5min ceiling);
 *            the flip diff accepts BOTH running→completed and the orphan
 *            heal's pending→completed; the planner dedupes multi-consumer
 *            upstreams.
 *    LAW 2 — honest wiring: the reaper mounts TWICE (instrumentation's
 *            dynamic import — the static graph would delay the listener —
 *            and the jobs GET route's free static mount), the singleton is
 *            a globalThis holder (dev-mode dual module instances share one
 *            interval), the escape hatch and the env knob have names, and
 *            the interval is unref'd (a correctness loop must never hold
 *            the process). Structure is asserted on the file bytes, not on
 *            re-implementation.
 *    LAW 3 — live smoke, read-only: the reaper's own query runs against
 *            the real DB and returns a count — self-consistency, no rows
 *            are written (a beat that flips rows belongs to the server
 *            process, not to a bench that may overlap a QA batch).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// the in-process door key (t523 pattern): teach node the product's two import
// dialects (@/ alias + extensionless relatives) before the lib import.
try {
  const { register } = await import("node:module");
  if (typeof register === "function") {
    register(pathToFileURL(new URL("./ts-alias-hook.mjs", import.meta.url).pathname));
  }
} catch {
  // bun (or another runtime with native path-alias eyes) — no key needed
}

const SRC = path.resolve(new URL("..", import.meta.url).pathname, "src");
const readSrc = (...p: string[]): string => readFileSync(path.join(SRC, ...p), "utf8");

const { clampReconcileMs, completedFlips, planPendingRetries } = await import(
  "@/lib/relion/global-reconcile"
);

let passed = 0;
const must = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exit(1);
  }
  passed++;
  console.log(`PASS ${msg}`);
};

// ---- LAW 1a — the interval clamp: the t525 lesson encoded -----------------
must(clampReconcileMs(undefined) === 15_000, "clamp — absent knob falls to the 15s default");
must(clampReconcileMs("") === 15_000, "clamp — empty knob falls to the default");
must(clampReconcileMs("nonsense") === 15_000, "clamp — non-numeric knob falls to the default");
must(clampReconcileMs(-5) === 15_000, "clamp — negative knob falls to the default (never a busy loop)");
must(clampReconcileMs(0) === 15_000, "clamp — zero knob falls to the default");
must(clampReconcileMs(4_999) === 5_000, "clamp — 4999ms lifts to the 5s floor (the SSH floors are 2.5-4s)");
must(clampReconcileMs(5_000) === 5_000, "clamp — exactly 5s is honored");
must(clampReconcileMs(15_000) === 15_000, "clamp — the default passes through");
must(clampReconcileMs(300_000) === 300_000, "clamp — exactly 5min is honored");
must(clampReconcileMs(300_001) === 300_000, "clamp — 5min+1s is capped (no coma)");
must(clampReconcileMs(9_000.7) === 9_001, "clamp — fractional ms round to whole ms");
must(clampReconcileMs("20000") === 20_000, "clamp — a numeric STRING is honored (env vars arrive as text)");
must(clampReconcileMs("20") === 5_000, "clamp — a sub-floor STRING lifts to the floor (no busy loop from a typo)");

// ---- LAW 1b — the flip diff: both completion doors are seen ---------------
const before = [
  { id: "j-local", status: "running" },
  { id: "j-remote", status: "running" },
  { id: "j-heal", status: "pending" },
  { id: "j-fail", status: "running" },
  { id: "j-done", status: "completed" },
];
const after = [
  { id: "j-local", status: "completed" },
  { id: "j-remote", status: "completed" },
  { id: "j-heal", status: "completed" }, // the orphan heal's pending→completed door
  { id: "j-fail", status: "failed" }, // a failure is NOT a dispatch trigger
  { id: "j-done", status: "completed" }, // already terminal — not a flip
  { id: "j-new", status: "completed" }, // unknown id (concurrent create) — not a flip
];
must(
  JSON.stringify(completedFlips(before, after)) ===
    JSON.stringify(["j-local", "j-remote", "j-heal"]),
  "flips — running→completed AND pending→completed fire; failed/terminal/unknown do not"
);
must(completedFlips([], []).length === 0, "flips — an empty beat diffs to empty");

// ---- LAW 1c — the retry planner: one upstream, one poke -------------------
const pending = ["p1", "p2", "p3"];
const edges = [
  { fromJobId: "u-done", toJobId: "p1" },
  { fromJobId: "u-done", toJobId: "p2" }, // two consumers, ONE trigger
  { fromJobId: "u-running", toJobId: "p2" },
  { fromJobId: "u-done", toJobId: "other" }, // not a pending consumer
  { fromJobId: "u-also-done", toJobId: "p3" },
];
const done = new Set(["u-done", "u-also-done"]);
must(
  JSON.stringify(planPendingRetries(pending, edges, done)) ===
    JSON.stringify(["u-done", "u-also-done"]),
  "planner — completed upstreams of pending consumers, deduped, in first-seen order"
);
must(planPendingRetries(pending, edges, new Set()).length === 0, "planner — no completed upstream, no trigger");
must(planPendingRetries([], edges, done).length === 0, "planner — no pending consumers, no trigger");

// ---- LAW 2 — the wiring: two mounts, one singleton, named knobs -----------
const reaperSrc = readSrc("lib", "relion", "global-reconcile.ts");
must(reaperSrc.includes("__cryoflowReaper"), "wiring — the singleton lives on globalThis (dev-mode dual instances share one interval)");
must(reaperSrc.includes("CRYOFLOW_NO_REAPER"), "wiring — the escape hatch has a name");
must(reaperSrc.includes("CRYOFLOW_GLOBAL_RECONCILE_MS"), "wiring — the beat knob has a name");
must(reaperSrc.includes("unref"), "wiring — the interval is unref'd (never holds the process)");
must(reaperSrc.includes("reconcileRealJobs") && reaperSrc.includes("reconcileRemoteJobs"), "wiring — the beat drives BOTH the local finalize and the remote sweep");
must(reaperSrc.includes("autoStartPendingDownstream"), "wiring — flips and retries both fire the dispatch");
must(reaperSrc.includes('status: { in: ["running", "pending"] }'), "wiring — the beat's query spans ALL projects' stuck rows (no project filter — the whole point)");

const instrSrc = readSrc("instrumentation.ts");
must(
  instrSrc.includes('await import("@/lib/relion/global-reconcile")'),
  "wiring — instrumentation mounts the reaper via DYNAMIC import (the static graph would delay the listener)"
);
must(
  !instrSrc.includes('from "@/lib/relion/global-reconcile"'),
  "wiring — instrumentation never STATICALLY imports the reaper graph"
);
must(instrSrc.includes("mountReaper"), "wiring — the boot mount is its own fire-and-forget leg");

const routeSrc = readSrc("app", "api", "jobs", "route.ts");
must(
  routeSrc.includes('import { ensureGlobalReconciler } from "@/lib/relion/global-reconcile";') &&
    routeSrc.includes("ensureGlobalReconciler();"),
  "wiring — the jobs GET route is the defensive static mount"
);

// ---- LAW 3 — live smoke, read-only ----------------------------------------
// house rule (t522/t523): a HARD assignment, not ||= — a QA window can leak
// a template DATABASE_URL (t402b's custom.db) into the persistent shell, and
// ||= would faithfully inherit the wrong world.
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
try {
  const { db } = await import("@/lib/db");
  const stuck = await db.job.count({ where: { status: { in: ["running", "pending"] } } });
  must(typeof stuck === "number" && stuck >= 0, `live — the reaper's query runs on the real DB (stuck rows right now: ${stuck})`);
  await db.$disconnect();
} catch (error) {
  must(false, `live — the DB smoke failed to run: ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`\n${passed} checks passed — the reaper watches every world, and the speech holds.`);

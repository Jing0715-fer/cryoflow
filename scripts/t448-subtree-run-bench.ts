/**
 * t448 bench — the wavefront's verb: the SUBTREE re-run plan.
 *
 *   S1 (the run order): BFS from the root, level by level, name tie-break
 *      — a linear chain comes out spine-order, a fan-out comes out with
 *      same-depth siblings in a stable alphabetical order, and a deep DAG
 *      never puts a child before its parent.
 *   S2 (upstream never runs): only OUT-edges count — the subtree is
 *      "this job and everything it feeds"; the root's own upstream stays
 *      out of the plan.
 *   S3 (churn blocks the whole plan): a running or pending node anywhere
 *      inside the subtree refuses the WHOLE run (a dispatch is already in
 *      flight; re-dispatching under it queues a second run of the same
 *      work). Completed/failed/idle nodes block nothing. The blocked
 *      roster speaks in run order.
 *   S4 (the missing root): an unknown root yields an empty plan — no
 *      order, no blocked, nothing to describe as runnable.
 *   S5 (the sentence): the roster names the first four in run order with
 *      " → " and counts the tail; the refusal names the churning node;
 *      a single-job subtree says so plainly.
 *   S6 (defensive shape): a duplicate edge (same pair twice) never
 *      duplicates a node in the order.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  describeSubtreeRun,
  planSubtreeRun,
  subtreeOrder,
} from "../src/lib/subtree-run";
import type { SubtreeJobLike } from "../src/lib/subtree-run";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL — ${label}`);
  }
}

type Edge = { fromJobId: string; toJobId: string };
const e = (from: string, to: string): Edge => ({ fromJobId: from, toJobId: to });
const j = (id: string, name: string, status = "completed"): SubtreeJobLike => ({
  id,
  name,
  status,
});

// ─────────────────────── S1 — the run order ─────────────────────────────

// S1a — a linear spine comes out spine-order (root first)
const spine = [j("a", "Import"), j("b", "MotionCorr"), j("c", "CTF")];
const spineEdges = [e("a", "b"), e("b", "c")];
const s1a = subtreeOrder(spine, spineEdges, "b");
must(
  s1a.map((n) => n.id).join(",") === "b,c",
  "S1a spine order from the middle"
);
// S1b — same-depth siblings break by name, stably
const fan = [j("r", "Root"), j("x", "Xtract"), j("m", "Mask Create"), j("a", "Auto-pick")];
const fanEdges = [e("r", "x"), e("r", "m"), e("r", "a")];
const s1b = subtreeOrder(fan, fanEdges, "r");
must(
  s1b.map((n) => n.name).join(",") === "Root,Auto-pick,Mask Create,Xtract",
  "S1b siblings alphabetical"
);
// S1c — a deep DAG never puts a child before its parent
const dag = [
  j("r", "R"),
  j("a", "A"),
  j("b", "B"),
  j("z", "Z"),
];
const dagEdges = [e("r", "a"), e("r", "b"), e("a", "z"), e("b", "z")];
const s1c = subtreeOrder(dag, dagEdges, "r");
const posOf = (id: string) => s1c.findIndex((n) => n.id === id);
must(posOf("a") < posOf("z") && posOf("b") < posOf("z"), "S1c parents before child");
must(s1c.length === 4, "S1c whole subtree present");

// ─────────────────── S2 — upstream never runs ───────────────────────────

// S2a — the root's own upstream stays out of the plan
const s2a = subtreeOrder(spine, spineEdges, "b");
must(!s2a.some((n) => n.id === "a"), "S2a upstream excluded");
// S2b — only OUT-edges: the root's other in-feeds are not the subtree's business
const twoFeeds = [j("u1", "Up 1"), j("u2", "Up 2"), j("m", "Merge"), j("d", "Down")];
const twoFeedEdges = [e("u1", "m"), e("u2", "m"), e("m", "d")];
const s2b = subtreeOrder(twoFeeds, twoFeedEdges, "m");
must(s2b.map((n) => n.id).join(",") === "m,d", "S2b in-feeds excluded");

// ─────────────────── S3 — churn blocks the plan ─────────────────────────

// S3a — a running node deep in the subtree blocks everything
const s3world = [j("a", "A"), j("b", "B", "running"), j("c", "C")];
const s3edges = [e("a", "b"), e("b", "c")];
const s3a = planSubtreeRun(s3world, s3edges, "a");
must(s3a.blocked.length === 1 && s3a.blocked[0].name === "B", "S3a deep runner blocks");
must(s3a.order.length === 3, "S3a order still computed");
// S3b — pending blocks too
const s3b = planSubtreeRun(
  [j("a", "A"), j("b", "B", "pending")],
  [e("a", "b")],
  "a"
);
must(s3b.blocked.length === 1 && s3b.blocked[0].status === "pending", "S3b pending blocks");
// S3c — completed/failed/idle block nothing
const s3c = planSubtreeRun(
  [j("a", "A", "failed"), j("b", "B", "completed"), j("c", "C", "idle")],
  [e("a", "b"), e("b", "c")],
  "a"
);
must(s3c.blocked.length === 0, "S3c terminal statuses free");
// S3d — the blocked roster speaks in run order (not world order)
const s3world2 = [
  j("a", "A"),
  j("z", "Zed", "running"),
  j("b", "Bee", "pending"),
];
const s3edges2 = [e("a", "b"), e("a", "z")];
const s3d = planSubtreeRun(s3world2, s3edges2, "a");
must(
  s3d.blocked.map((x) => x.name).join(",") === "Bee,Zed",
  "S3d blocked roster in run order"
);
// S3e — the ROOT itself churning blocks (it is inside its own subtree)
const s3e = planSubtreeRun([j("a", "A", "running")], [], "a");
must(s3e.blocked.length === 1 && s3e.blocked[0].id === "a", "S3e churning root blocks");

// ──────────────────── S4 — the missing root ─────────────────────────────

const s4 = planSubtreeRun(spine, spineEdges, "nope");
must(s4.order.length === 0 && s4.blocked.length === 0, "S4 unknown root = empty plan");

// ────────────────────── S5 — the sentence ───────────────────────────────

// S5a — a big roster caps at four and counts the tail
const bigWorld = [
  j("r", "Root"),
  ...["D1", "D2", "D3", "D4", "D5", "D6"].map((n) => j(n.toLowerCase(), n)),
];
const bigEdges = ["d1", "d2", "d3", "d4", "d5", "d6"].map((id) => e("r", id));
const s5a = describeSubtreeRun(planSubtreeRun(bigWorld, bigEdges, "r"));
must(s5a.includes("Root → D1 → D2 → D3"), "S5a head of roster");
must(s5a.includes("… and 3 more"), "S5a tail counted");
must(s5a.includes("7 jobs"), "S5a total spoken");
// S5b — the refusal names the churning node
const s5b = describeSubtreeRun(s3a);
must(s5b.startsWith("Blocked —"), "S5b refusal prefix");
must(s5b.includes("B (running)"), "S5b refusal names the node");
// S5c — a single-job subtree (a leaf) is a plain 1-job re-run — the
// "no downstream" sentence belongs to an UNKNOWN root, not to a leaf
const s5c = describeSubtreeRun(planSubtreeRun([j("a", "Lonely")], [], "a"));
must(s5c.includes("Re-runs 1 job"), "S5c leaf = plain re-run");
// S5e — an unknown root's empty plan describes as nothing-to-run
const s5e = describeSubtreeRun(planSubtreeRun(spine, spineEdges, "nope"));
must(s5e.includes("No downstream jobs"), "S5e unknown root sentence");
// S5d — the runnable sentence carries the stop law
const s5d = describeSubtreeRun(planSubtreeRun(spine, spineEdges, "a"));
must(
  s5d.includes("Stops at the first refusal"),
  "S5d stop law in the sentence"
);

// ────────────────── S6 — defensive shape ────────────────────────────────

// S6a — a duplicate edge never duplicates a node
const dupeEdges = [e("a", "b"), e("a", "b"), e("b", "c")];
const s6a = subtreeOrder(spine, dupeEdges, "a");
must(s6a.map((n) => n.id).join(",") === "a,b,c", "S6a duplicate edge collapsed");

console.log(`t448 subtree-run bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

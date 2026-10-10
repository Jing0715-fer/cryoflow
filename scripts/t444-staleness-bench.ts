/**
 * t444 bench — the staleness wavefront: the graph knows what the
 * statuses don't say.
 *
 *   W1 (the wavefront law): a finished direct upstream whose startedAt
 *      is newer than the child's marks the child stale — and ONLY the
 *      direct child; the grandchild is the wave's NEXT step, not this
 *      one (labeling it early claims a rebuild that hasn't happened).
 *   W2 (evidence discipline): a missing startedAt on either side is no
 *      verdict; a non-terminal upstream (running/pending) is mid-churn
 *      and warns nothing; a failed upstream still counts (the churn is
 *      real, the output moved).
 *   W3 (edits don't pollute): updatedAt is NOT the law — an upstream
 *      dragged or param-edited after the child (updatedAt newer,
 *      startedAt older) stays silent. Only a real RUN moves the era.
 *   W4 (adoption fits for free): re-parenting to a younger run marks
 *      the child stale; adopting back to the original un-marks it —
 *      the timestamp law and the provenance truth agree both ways.
 *   W5 (multi-upstream): the report aggregates every offending
 *      upstream and keeps the newest instant.
 *   W6 (the spoken form): one sentence true in every scenario —
 *      "predates X's latest run" — names resolved by the caller, id
 *      fallback on a gap, the 2- and 3-name joins read naturally.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  describeStaleness,
  findStaleJobs,
  type StaleJobLike,
} from "../src/lib/staleness";

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

/* helpers — ISO strings from the same clock, lexicographic = chronological */
const T = (h: number, m = 0) =>
  `2026-09-29T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
const job = (
  id: string,
  status: string,
  startedAt: string | null,
  name = id,
): StaleJobLike => ({ id, name, status, startedAt });

const MOTION = T(10);
const MOTION_RERUN = T(14);
const CTF = T(12);
const CTF_RERUN = T(16);

/* ================= W1 — the wavefront law ================= */
console.log("W1 — wavefront: direct upstream re-ran after me; grandchild waits its turn");
{
  const jobs = [
    job("motion", "completed", MOTION, "Motion Correction 1"),
    job("motion2", "completed", MOTION_RERUN, "Motion Correction 1 (copy)"),
    job("ctf", "completed", CTF, "CTF Estimation 1"),
    job("pick", "completed", CTF, "Auto-pick 1"),
  ];
  // the adopted world: CTF now consumes the YOUNGER twin; pick still eats CTF
  const edges = [
    { fromJobId: "motion2", toJobId: "ctf" },
    { fromJobId: "ctf", toJobId: "pick" },
  ];
  const report = findStaleJobs(jobs, edges);

  must(report.has("ctf"), "W1a the child of the younger upstream is stale");
  must(
    report.get("ctf")?.upstreamIds[0] === "motion2",
    "W1b the report names the offending upstream",
  );
  must(report.get("ctf")?.since === MOTION_RERUN, "W1c the report carries the upstream's instant");
  must(
    !report.has("pick"),
    "W1d the grandchild is NOT marked — the wave lands when CTF re-runs, not before",
  );

  // the wave's second step: CTF re-runs → the grandchild goes stale too
  const jobsAfter = jobs.map((j) => (j.id === "ctf" ? job("ctf", "completed", CTF_RERUN) : j));
  const reportAfter = findStaleJobs(jobsAfter, edges);
  must(reportAfter.has("pick"), "W1e after the child re-runs, the wave reaches the grandchild");
  must(
    !reportAfter.has("ctf"),
    "W1f the re-run clears the child's own staleness (it caught up)",
  );
}

/* ================= W2 — evidence discipline ================= */
console.log("W2 — no startedAt, no verdict; non-terminal upstreams stay silent");
{
  const edges = [{ fromJobId: "up", toJobId: "down" }];

  must(
    findStaleJobs([job("up", "completed", MOTION), job("down", "completed", null)], edges).size ===
      0,
    "W2a a child with no startedAt is never stale (no evidence, no verdict)",
  );
  must(
    findStaleJobs([job("up", "completed", null), job("down", "completed", CTF)], edges).size === 0,
    "W2b an upstream that never ran is never an offense",
  );
  must(
    findStaleJobs([job("up", "running", MOTION_RERUN), job("down", "completed", CTF)], edges)
      .size === 0,
    "W2c a running upstream is mid-churn — the wave lands when it finishes",
  );
  must(
    findStaleJobs([job("up", "pending", MOTION_RERUN), job("down", "completed", CTF)], edges)
      .size === 0,
    "W2d a pending upstream warns nothing",
  );
  must(
    findStaleJobs([job("up", "failed", MOTION_RERUN), job("down", "completed", CTF)], edges).has(
      "down",
    ),
    "W2e a FAILED upstream still counts — the churn is real, the era moved",
  );
  must(
    findStaleJobs([job("up", "completed", MOTION), job("down", "failed", CTF)], edges).size === 0,
    "W2f only completed children are marked (failed jobs already demand eyes)",
  );
  must(
    findStaleJobs([job("up", "completed", MOTION), job("down", "completed", CTF)], edges).size ===
      0,
    "W2g an OLDER upstream (ran before the child) is no offense — the child is current",
  );
}

/* ================= W3 — edits don't pollute ================= */
console.log("W3 — updatedAt noise never marks a job; only a real RUN moves the era");
{
  // the upstream was EDITED after the child (drag, param tweak) — its
  // startedAt is still from before the child. The law stays silent.
  // (The lib only reads startedAt; this case pins the silence against
  // a future refactor that might reach for updatedAt.)
  const jobs = [
    job("up", "completed", MOTION, "Motion Correction 1"),
    job("down", "completed", CTF, "CTF Estimation 1"),
  ];
  const edges = [{ fromJobId: "up", toJobId: "down" }];
  must(
    findStaleJobs(jobs, edges).size === 0,
    "W3a an upstream edited-but-not-rerun after the child never marks it",
  );

  // and the boundary is exact: upstream started LATER than the child → stale
  must(
    findStaleJobs(
      [job("up", "completed", MOTION_RERUN), job("down", "completed", CTF)],
      edges,
    ).size === 1,
    "W3b the same pair with a LATER upstream start marks the child",
  );

  // equal instants (a chain started in the same tick) are not stale —
  // strictly-newer is the law; ties carry no information
  must(
    findStaleJobs([job("up", "completed", CTF), job("down", "completed", CTF)], edges).size === 0,
    "W3c equal startedAt is a tie, not an offense (strictly-newer law)",
  );
}

/* ================= W4 — adoption fits for free ================= */
console.log("W4 — adoption both ways: the timestamp law and provenance agree");
{
  const twin = job("twin", "completed", MOTION_RERUN, "Motion Correction 1 (copy)");
  const original = job("motion", "completed", MOTION, "Motion Correction 1");
  const ctf = job("ctf", "completed", CTF, "CTF Estimation 1");

  // ADOPT to the twin: CTF has never consumed the twin's output → stale
  const adopted = findStaleJobs([original, twin, ctf], [{ fromJobId: "twin", toJobId: "ctf" }]);
  must(adopted.has("ctf"), "W4a after adopting the younger twin, the child is stale");

  // ADOPT BACK to the original: CTF's result WAS produced from the
  // original → the badge disappears, nothing to re-run
  const reverted = findStaleJobs([original, twin, ctf], [{ fromJobId: "motion", toJobId: "ctf" }]);
  must(!reverted.has("ctf"), "W4b after adopting back, the child is current again");
}

/* ================= W5 — multi-upstream ================= */
console.log("W5 — multiple offenders aggregate; the newest instant wins");
{
  const jobs = [
    job("a", "completed", MOTION, "Motion A"),
    job("b", "completed", MOTION_RERUN, "Motion B"),
    job("c", "completed", T(13), "Motion C"),
    job("down", "completed", CTF, "CTF Estimation 1"),
  ];
  const edges = [
    { fromJobId: "a", toJobId: "down" },
    { fromJobId: "b", toJobId: "down" },
    { fromJobId: "c", toJobId: "down" },
  ];
  const report = findStaleJobs(jobs, edges);
  const info = report.get("down");

  must(info != null, "W5a the child with offending upstreams is stale");
  must(
    info?.upstreamIds.length === 2 &&
      info.upstreamIds.includes("b") &&
      info.upstreamIds.includes("c") &&
      !info.upstreamIds.includes("a"),
    "W5b exactly the two NEWER upstreams are named — the older one stays silent",
  );
  must(info?.since === MOTION_RERUN, "W5c the newest offender's instant is the since");
}

/* ================= W6 — the spoken form ================= */
console.log("W6 — one sentence true in every scenario; names over ids");
{
  const info1 = { upstreamIds: ["motion"], upstreamNames: ["Motion Correction 1"], since: MOTION_RERUN };
  const d1 = describeStaleness(info1);
  must(
    d1.short === "Predates Motion Correction 1's latest run",
    "W6a the short form names the upstream and never says 're-ran' (the twin never did)",
  );
  must(
    d1.long.includes("Re-run this job to catch up") &&
      d1.long.includes("before Motion Correction 1's latest run"),
    "W6b the long form carries the verdict AND the duty",
  );
  must(d1.since === MOTION_RERUN, "W6c the raw instant passes through for locale rendering");

  const d2 = describeStaleness({ upstreamIds: ["a", "b"], upstreamNames: ["Motion A", "Motion B"], since: MOTION });
  must(
    d2.short === "Predates Motion A and Motion B's latest run",
    "W6d the two-name join reads naturally",
  );

  const d3 = describeStaleness({ upstreamIds: ["a", "b", "c"], upstreamNames: ["Motion A", "Motion B", "Motion C"], since: MOTION });
  must(
    d3.short === "Predates Motion A, Motion B and Motion C's latest run",
    "W6e the three-name join uses the serial comma",
  );

  // names missing at build time fall back to the raw id (never a blank)
  const d4 = describeStaleness({ upstreamIds: ["ghost"], upstreamNames: ["ghost"], since: MOTION });
  must(
    d4.short.includes("ghost"),
    "W6f a name the caller couldn't resolve falls back to the raw id, never a blank",
  );
}

console.log(`\nt444 staleness bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

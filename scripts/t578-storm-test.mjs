/**
 * t578 — the judge worker under a STORM: the queue's fairness, pinned bare.
 *
 * t574's unit suite proved the planner's gates one by one; t577 left the
 * "storm observation window" open — cap=1's fairness with MANY candidates
 * in flight. This suite is that window, at the bench: a 12-job completion
 * storm (originals, mirrors, wrong types, a straggler still running, a
 * pre-watermark relic) drained tick by tick, simulating the shell stamping
 * each pick between beats.
 *
 * Faces:
 *   S1  the first tick admits exactly the globally oldest eligible job;
 *   S2  a full drain: one verdict per tick, strictly oldest-first ACROSS
 *       types (class2d and class3d share one fair queue), the storm ends
 *       in exactly as many ticks as there are eligible jobs, and the
 *       planner then stays empty (no busy churn on a drained queue);
 *   S3  mirror storm: mirrors older than everything are invisible in every
 *       tick; their ORIGINALS still get their slot;
 *   S4  mid-storm arrival: a job that finishes while the backlog drains
 *       waits its AGE — it lands after the older backlog, not before;
 *   S5  watermark honesty: pre-watermark jobs never surface, even as the
 *       only candidates left (the per-ERA memory keeps the back catalog out);
 *   S6  policy dominates backlog: autoJudge off silences a full queue;
 *   S7  cadence clamp edges: 10s floor, 10min ceiling, garbage → default.
 *
 * Usage: node scripts/t578-storm-test.mjs
 */

import {
  planJudgeCandidates,
  clampJudgeTickMs,
  DEFAULT_JUDGE_TICK_MS,
} from "../src/lib/ai/judge-worker-plan.ts";

let pass = 0, fail = 0;
const check = (name, ok, evidence) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${evidence != null ? ` — ${evidence}` : ""}`);
  if (ok) pass++; else fail++;
};

const job = (id, type, status, updatedAtMs, linkedJobId = null) => ({
  id, type, status, updatedAtMs, linkedJobId,
});
const CTX = (over = {}) => ({
  watermarkMs: 1000,
  autoJudge: true,
  providerOk: true,
  stampedIds: new Set(),
  ...over,
});

/* ---- S1: the storm opens on the globally oldest ------------------------ */
{
  const storm = [
    job("j-old-3d", "class3d", "completed", 2000),
    job("j-young-2d", "class2d", "completed", 9000),
    job("j-mid-2d", "class2d", "completed", 5000),
    job("mirror-of-mid", "class2d", "completed", 1200, "j-mid-2d"), // oldest entry, but a mirror
    job("j-extract", "extract", "completed", 1500), // wrong type
    job("j-running", "class2d", "running", 1600), // not final
  ];
  const plan = planJudgeCandidates(storm, CTX());
  check("S1: first tick admits exactly the oldest ELIGIBLE (mirror/wrong-type/running all invisible)",
    plan.length === 1 && plan[0]?.id === "j-old-3d", plan.map((j) => j.id).join(","));
}

/* ---- S2: the full drain — one per tick, oldest-first across types ------ */
{
  const storm = [
    job("d5", "class3d", "completed", 6000),
    job("d1", "class2d", "completed", 2000),
    job("d4", "class2d", "completed", 5000),
    job("d2", "class3d", "completed", 3000),
    job("d3", "class2d", "completed", 4000),
  ];
  const expect = ["d1", "d2", "d3", "d4", "d5"];
  const stamped = new Set();
  const drained = [];
  for (let tick = 0; tick < 20; tick++) {
    const plan = planJudgeCandidates(storm, CTX({ stampedIds: stamped }));
    if (plan.length === 0) break;
    if (plan.length !== 1) { drained.push(...plan.map((j) => j.id)); break; } // cap violation
    drained.push(plan[0].id);
    stamped.add(plan[0].id); // the shell stamps between beats
  }
  check("S2: the queue drains strictly oldest-first, one verdict per tick",
    JSON.stringify(drained) === JSON.stringify(expect), drained.join(" → "));
  check("S2: a 5-job storm ends in exactly 5 ticks", drained.length === 5, `${drained.length} ticks`);
  const settled = planJudgeCandidates(storm, CTX({ stampedIds: stamped }));
  check("S2: a drained queue plans empty (no churn on the quiet world)", settled.length === 0, settled.length);
}

/* ---- S3: a mirror storm — mirrors never judge, originals still do ------ */
{
  const storm = [
    job("m1-mirror", "class2d", "completed", 1100, "m1"),
    job("m2-mirror", "class3d", "completed", 1200, "m2"),
    job("m1", "class2d", "completed", 5000),
    job("m2", "class3d", "completed", 6000),
  ];
  const stamped = new Set();
  const seen = [];
  for (let tick = 0; tick < 10; tick++) {
    const plan = planJudgeCandidates(storm, CTX({ stampedIds: stamped }));
    if (plan.length === 0) break;
    seen.push(plan[0].id);
    stamped.add(plan[0].id);
  }
  check("S3: mirrors never surface across the whole drain",
    seen.every((id) => !id.endsWith("-mirror")), seen.join(" → "));
  check("S3: both originals get their slot (mirrors older than everything)",
    JSON.stringify(seen) === JSON.stringify(["m1", "m2"]), seen.join(" → "));
}

/* ---- S4: mid-storm arrival waits its age ------------------------------- */
{
  const backlog = [
    job("b-old", "class2d", "completed", 2000),
    job("b-mid", "class3d", "completed", 3000),
  ];
  const stamped = new Set();
  // tick 1: the oldest of the backlog
  const t1 = planJudgeCandidates(backlog, CTX({ stampedIds: stamped }));
  check("S4: tick 1 takes the backlog head", t1[0]?.id === "b-old", t1.map((j) => j.id).join(","));
  stamped.add(t1[0].id);
  // tick 2: a NEW completion lands mid-storm — younger than the backlog,
  // older than nothing; age ordering must keep it behind b-mid
  const withArrival = [...backlog, job("b-new", "class2d", "completed", 8000)];
  const t2 = planJudgeCandidates(withArrival, CTX({ stampedIds: stamped }));
  check("S4: the mid-storm arrival queues BEHIND the older backlog (age, not arrival)",
    t2.length === 1 && t2[0]?.id === "b-mid", t2.map((j) => j.id).join(","));
  stamped.add(t2[0].id);
  const t3 = planJudgeCandidates(withArrival, CTX({ stampedIds: stamped }));
  check("S4: only after the backlog drains does the arrival take its slot",
    t3.length === 1 && t3[0]?.id === "b-new", t3.map((j) => j.id).join(","));
}

/* ---- S5: watermark honesty — the back catalog stays out ---------------- */
{
  const relics = [
    job("r-ancient", "class2d", "completed", 500),
    job("r-older", "class3d", "completed", 900),
  ];
  const drained = planJudgeCandidates(relics, CTX({ watermarkMs: 1000 }));
  check("S5: everything pre-watermark is invisible", drained.length === 0, drained.length);
  const onlyRelics = planJudgeCandidates(
    [job("r2", "class2d", "completed", 700)],
    CTX({ watermarkMs: 1000, stampedIds: new Set() })
  );
  check("S5: relics stay out even as the ONLY candidates (queue honestly empty)",
    onlyRelics.length === 0, onlyRelics.length);
}

/* ---- S6: policy dominates any backlog ---------------------------------- */
{
  const storm = [job("s1", "class2d", "completed", 2000), job("s2", "class3d", "completed", 3000)];
  check("S6: autoJudge off silences a full queue",
    planJudgeCandidates(storm, CTX({ autoJudge: false })).length === 0);
  check("S6: provider down silences a full queue",
    planJudgeCandidates(storm, CTX({ providerOk: false })).length === 0);
}

/* ---- S7: the cadence clamp (no busy loop, no coma) --------------------- */
{
  check("S7: below the floor clamps to 10s", clampJudgeTickMs(9_999) === 10_000, clampJudgeTickMs(9_999));
  check("S7: above the ceiling clamps to 10min", clampJudgeTickMs(600_001) === 600_000, clampJudgeTickMs(600_001));
  check("S7: garbage falls to the default 30s", clampJudgeTickMs("abc") === DEFAULT_JUDGE_TICK_MS, clampJudgeTickMs("abc"));
  check("S7: numeric strings parse (env vars are strings)", clampJudgeTickMs("45000") === 45_000, clampJudgeTickMs("45000"));
  check("S7: fractional ms round to whole ms", clampJudgeTickMs(30_000.6) === 30_001, clampJudgeTickMs(30_000.6));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

/**
 * t574 — the judge worker's PLANNER, pinned bare (node 24 runs TS — the
 * t562/t573 pattern; the module imports nothing, so node reads it raw).
 *
 * The planner is the worker's entire POLICY: who gets judged, who never
 * does, and how many per beat. Every gate below is a law the live-fire
 * would take minutes (and a VLM call) to reach — here they cost nothing:
 *   • the policy dead-lifts (autoJudge off / provider down) silence everything;
 *   • jurisdiction — only class2d/class3d, only completed;
 *   • mirrors never judge (the original carries the one opinion);
 *   • freshness — the watermark keeps the back catalog out;
 *   • one opinion per job — stamped ids are skipped;
 *   • oldest first, capped at one per tick (the politeness ceiling).
 * Plus the cadence clamp (no busy loop, no coma — the reaper's t525 law).
 *
 * Usage: node scripts/t574-judge-test.mjs
 */

import {
  planJudgeCandidates,
  clampJudgeTickMs,
  DEFAULT_JUDGE_TICK_MS,
  MAX_JUDGES_PER_TICK,
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

/* ---- the happy path ---------------------------------------------------- */
{
  const jobs = [
    job("a", "class2d", "completed", 2000),
    job("b", "class3d", "completed", 3000),
  ];
  const plan = planJudgeCandidates(jobs, CTX());
  check("the queue admits the oldest first (cap one per tick)",
    plan.length === 1 && plan[0]?.id === "a", plan.map((j) => j.id).join(","));
  const next = planJudgeCandidates(jobs, CTX({ stampedIds: new Set(["a"]) }));
  check("once the head carries its opinion, the next oldest takes the slot",
    next.length === 1 && next[0]?.id === "b", next.map((j) => j.id).join(","));
}

/* ---- the policy dead-lifts ---------------------------------------------- */
{
  const jobs = [job("a", "class2d", "completed", 2000)];
  check("autoJudge off → nobody", planJudgeCandidates(jobs, CTX({ autoJudge: false })).length === 0);
  check("provider down → nobody", planJudgeCandidates(jobs, CTX({ providerOk: false })).length === 0);
}

/* ---- jurisdiction -------------------------------------------------------- */
{
  const jobs = [
    job("m", "motioncorr", "completed", 2000),
    job("e", "extract", "completed", 2500),
    job("c", "class2d", "running", 3000),
    job("d", "class3d", "failed", 3500),
    job("i", "class2d", "idle", 4000),
  ];
  const plan = planJudgeCandidates(jobs, CTX());
  check("non-classifications and non-completions are outside the jurisdiction",
    plan.length === 0, `got ${plan.length}`);
}

/* ---- mirrors never judge ------------------------------------------------- */
{
  const jobs = [
    job("orig", "class2d", "completed", 2000, null),
    job("mirror", "class2d", "completed", 9000, "orig"),
  ];
  const plan = planJudgeCandidates(jobs, CTX());
  check("a soft-link mirror is skipped — the original owns the opinion",
    plan.length === 1 && plan[0].id === "orig", plan.map((j) => j.id).join(","));
}

/* ---- freshness: the watermark -------------------------------------------- */
{
  const jobs = [
    job("old1", "class2d", "completed", 500),
    job("old2", "class2d", "completed", 1000), // boundary is exclusive
    job("new1", "class2d", "completed", 1001),
    job("new2", "class2d", "completed", 7000),
  ];
  const plan = planJudgeCandidates(jobs, CTX({ watermarkMs: 1000 }));
  check("only completions AFTER the watermark survive (boundary exclusive, oldest heads the queue)",
    plan.length === 1 && plan[0]?.id === "new1", plan.map((j) => j.id).join(","));
  const drained = planJudgeCandidates(jobs, CTX({ watermarkMs: 1000, stampedIds: new Set(["new1"]) }));
  check("the queue keeps draining in completion order",
    drained.length === 1 && drained[0]?.id === "new2", drained.map((j) => j.id).join(","));
}

/* ---- one opinion per job -------------------------------------------------- */
{
  const jobs = [
    job("stamped", "class2d", "completed", 2000),
    job("fresh", "class2d", "completed", 3000),
  ];
  const plan = planJudgeCandidates(jobs, CTX({ stampedIds: new Set(["stamped"]) }));
  check("an already-stamped job is never re-judged by the worker",
    plan.length === 1 && plan[0].id === "fresh", plan.map((j) => j.id).join(","));
  check("a re-run that keeps its old stamp stays quiet (the explicit re-ask is the overwrite path)",
    planJudgeCandidates([job("stamped", "class2d", "completed", 99999)], CTX({ stampedIds: new Set(["stamped"]) })).length === 0);
}

/* ---- the politeness ceiling ------------------------------------------------ */
{
  const jobs = Array.from({ length: 7 }, (_, i) => job(`j${i}`, "class2d", "completed", 2000 + i));
  const plan = planJudgeCandidates(jobs, CTX());
  check(`a completion storm drains one verdict per tick (cap ${MAX_JUDGES_PER_TICK})`,
    plan.length === MAX_JUDGES_PER_TICK && plan[0].id === "j0",
    `cap=${plan.length}, head=${plan[0]?.id}`);
}

/* ---- the cadence clamp ------------------------------------------------------ */
{
  check("default tick is the documented 30s", clampJudgeTickMs(undefined) === DEFAULT_JUDGE_TICK_MS,
    `${clampJudgeTickMs(undefined)}ms`);
  check("garbage → default", clampJudgeTickMs("abc") === DEFAULT_JUDGE_TICK_MS && clampJudgeTickMs(-5) === DEFAULT_JUDGE_TICK_MS);
  check("floor 10s — no busy loop", clampJudgeTickMs(500) === 10_000, `${clampJudgeTickMs(500)}ms`);
  check("ceiling 10min — no coma", clampJudgeTickMs(999_999_999) === 600_000, `${clampJudgeTickMs(999_999_999)}ms`);
  check("honest values pass through", clampJudgeTickMs(45_000) === 45_000);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

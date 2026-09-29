/**
 * t450 bench — the walk's second breath: the boot-time resurrection scan.
 *
 *   R1 (leading-completed counting): the walk's own dispatches landed
 *      while the tab was dead — completed nodes at the head count as
 *      done; the count stops at the first live non-completed node.
 *   R2 (missing is not unfinished): nodes the world lost are named and
 *      skipped — they never break the leading count (completed and
 *      deleted interleave freely) and never enter the remaining walk.
 *   R3 (all landed): every node completed while away — the success
 *      receipt arrives late, but it arrives; an empty live world is not
 *      "all landed".
 *   R4 (the armed stop): a persisted stop request is honored without
 *      dispatching anything — the scan itself is agnostic (the store
 *      branches before walking), the record's flag rides the scan's
 *      input contract.
 *   R5 (the failed frontier): the resume node failed while away — the
 *      walk stops with a receipt that carries the witness.
 *   R6 (the resume point): running/pending = the in-flight node (await
 *      it); idle = never dispatched (dispatch it).
 *   R7 (the sentences): the resume welcome names the count and the next
 *      node, the missing roster speaks the census dialect, the frontier
 *      reason carries the while-away witness, and BOTH tab laws stay
 *      true — the fresh one promises reload survival, the resumed one
 *      keeps the closing-tab boundary.
 *
 * World contract: pure functions only — no store, no fetch, no fs,
 * no sessionStorage (the session module is client-gated; its shape
 * guard is exercised in the browser, not here).
 */

import {
  ORCH_TAB_LAW,
  ORCH_TAB_LAW_RESUMED,
  resumeFrontierReason,
  resumeScan,
  resumeToastDescription,
  resumeToastTitle,
} from "../src/lib/subtree-run";
import type { SubtreeJobLike } from "../src/lib/subtree-run";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL ${label}`);
  }
}
function eq(a: unknown, b: unknown, label: string): void {
  must(JSON.stringify(a) === JSON.stringify(b), `${label} — got ${JSON.stringify(a)}`);
}

function job(id: string, name: string, status: string): SubtreeJobLike {
  return { id, name, status };
}
function node(id: string, name: string) {
  return { id, name };
}

/* R1 — leading-completed counting ------------------------------------ */

{
  const order = [node("a", "A"), node("b", "B"), node("c", "C")];
  // the world the tab left behind: A dispatched, B in flight — both
  // landed while the reload was dark; C never dispatched
  const jobs = [job("a", "A", "completed"), job("b", "B", "completed"), job("c", "C", "idle")];
  const s = resumeScan(order, jobs);
  eq(s.done, 2, "R1a two landed while away — done counts both");
  eq(s.resumeNode?.id, "c", "R1b resume point is the first live non-completed node");
  eq(s.remaining.map((n) => n.id), ["c"], "R1c remaining is the undispatched tail");
  must(!s.allLanded && !s.failedFrontier, "R1d a healthy mid-walk death is neither terminal state");
}

/* R2 — missing is not unfinished -------------------------------------- */

{
  // B was deleted while the tab was away — between two COMPLETED nodes
  const order = [node("a", "A"), node("b", "B"), node("c", "C"), node("d", "D")];
  const jobs = [
    job("a", "A", "completed"),
    job("c", "C", "completed"),
    job("d", "D", "idle"),
  ];
  const s = resumeScan(order, jobs);
  eq(s.done, 2, "R2a the deleted B never breaks the leading count");
  eq(s.missing.map((n) => n.id), ["b"], "R2b the missing node is named");
  eq(s.remaining.map((n) => n.id), ["d"], "R2c the missing node never enters the remaining walk");
  eq(s.resumeNode?.id, "d", "R2d the resume point skips past the grave");
}
{
  // a TAIL deletion: C gone entirely
  const order = [node("a", "A"), node("b", "B")];
  const jobs = [job("a", "A", "completed"), job("b", "B", "running")];
  const s = resumeScan(order, jobs);
  eq(s.missing, [], "R2e a full live world has no missing nodes");
}

/* R3 — all landed ------------------------------------------------------ */

{
  const order = [node("a", "A"), node("b", "B")];
  const jobs = [job("a", "A", "completed"), job("b", "B", "completed")];
  const s = resumeScan(order, jobs);
  must(s.allLanded, "R3a every node completed while away — the late success");
  eq(s.done, 2, "R3b done equals the whole order");
  eq(s.remaining, [], "R3c nothing remains to dispatch");
}
{
  // a completely alien world (project switch): every node missing —
  // that is NOT "all landed", it is a degenerate record
  const order = [node("a", "A")];
  const s = resumeScan(order, []);
  must(!s.allLanded, "R3d an empty live world is never all-landed");
  eq(s.done, 0, "R3e nothing live, nothing counted");
}

/* R4 — the armed stop (the record's flag rides the contract) ---------- */

{
  // the scan stays agnostic — the STORE branches on rec.stopRequested
  // before walking; here we pin the scan's honest output for a world
  // where the in-flight node landed after the armed stop
  const order = [node("a", "A"), node("b", "B")];
  const jobs = [job("a", "A", "completed"), job("b", "B", "idle")];
  const s = resumeScan(order, jobs);
  eq(s.done, 1, "R4a the landed head counts even under an armed stop");
  eq(s.remaining.map((n) => n.id), ["b"], "R4b the untouched tail is visible — the store refuses to walk it");
}

/* R5 — the failed frontier -------------------------------------------- */

{
  const order = [node("a", "A"), node("b", "B"), node("c", "C")];
  const jobs = [
    job("a", "A", "completed"),
    job("b", "B", "failed"),
    job("c", "C", "idle"),
  ];
  const s = resumeScan(order, jobs);
  eq(s.done, 1, "R5a the landed head counts");
  eq(s.failedFrontier?.id, "b", "R5b the failed node is the frontier");
  eq(s.resumeNode?.id, "b", "R5c the frontier IS the resume point — the walk never reaches C");
}

/* R6 — the resume point statuses --------------------------------------- */

{
  const order = [node("a", "A"), node("b", "B")];
  const running = resumeScan(order, [job("a", "A", "completed"), job("b", "B", "running")]);
  eq(running.resumeNode?.id, "b", "R6a still running — await it, no re-dispatch");
  must(!running.failedFrontier, "R6b running is not a frontier");
  must(running.resumeInflight, "R6c running flags the await-only first node (never re-dispatch under a live run)");
  const pending = resumeScan(order, [job("a", "A", "completed"), job("b", "B", "pending")]);
  eq(pending.resumeNode?.id, "b", "R6d staging — the same await law");
  must(pending.resumeInflight, "R6e pending flags the await-only first node too");
  const idle = resumeScan(order, [job("a", "A", "completed"), job("b", "B", "idle")]);
  eq(idle.resumeNode?.id, "b", "R6f never dispatched — the walk dispatches it");
  must(!idle.resumeInflight, "R6g idle is a dispatch, not an await");
}

/* R7 — the sentences ---------------------------------------------------- */

eq(resumeToastTitle(1, 2), "Subtree re-run resumed — 1 of 2 already landed", "R7a the welcome names the count");
eq(
  resumeToastDescription("CTF Estimation 1 (copy)", []),
  "Continuing from CTF Estimation 1 (copy).",
  "R7b the welcome names the next node"
);
eq(
  resumeToastDescription(null, []),
  "Nothing left to dispatch.",
  "R7c the late success has nothing to continue from"
);
eq(
  resumeToastDescription("D", [node("b", "B"), node("x", "X"), node("y", "Y"), node("z", "Z"), node("w", "W")]),
  "Continuing from D. Skipped — gone from the canvas while the tab was away: B, X, Y, Z and 1 more.",
  "R7d the missing roster speaks the census dialect (cap 4 + tail)"
);
must(
  resumeFrontierReason(node("b", "B")).includes("B failed while the tab was away"),
  "R7e the frontier reason carries the while-away witness"
);
must(
  resumeFrontierReason(node("b", "B")).includes("its downstream did not re-run"),
  "R7f the frontier reason states the consequence"
);
must(ORCH_TAB_LAW.startsWith("Survives a reload"), "R7g the fresh law promises the new survival");
must(ORCH_TAB_LAW.includes("closing this tab"), "R7h the fresh law keeps the closing-tab boundary");
must(
  ORCH_TAB_LAW_RESUMED.startsWith("Resumed after a reload") &&
    ORCH_TAB_LAW_RESUMED.includes("closing this tab"),
  "R7i the resumed law states what happened and what still ends"
);

console.log(`t450 orchestration-resume bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

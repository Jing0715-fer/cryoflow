/**
 * t455 bench — the convergence verdict's continue verb.
 *
 * Pure-brain assertions only (the face is React; the brain is laws):
 *   CQ1 checkpoint          — the arc's head: self > upstream, live >
 *                             archived, complete-only, newest-first trust
 *   CQ2 self scan errors    — the degraded row's honest why
 *   CQ3 the --iter knob     — the engine's exact mirror: algorithm
 *                             select vs raw do_em/do_grad, VDAM counts
 *                             mini-batches, EM/class3d count epochs,
 *                             curated write keys only (PATCH allow list)
 *   CQ4 totals + ceilings   — RELION's restart arithmetic (current+more)
 *                             clamped to the form's own caps, honestly
 *   CQ5 stepper             — the two domains' own scales
 *   CQ6 plan assembly       — fn_cont + knob write + clamp flag, and the
 *                             fire button's param writes in one face
 */

import {
  checkpointOf,
  continueLaneOf,
  continuePlanOf,
  continueParamWrites,
  ceilingFor,
  iterKnobOf,
  moreOptionsFor,
  selfScanErrorOf,
  totalIterationsOf,
  type ContinueSourceLite,
} from "../src/lib/convergence-continue";

let pass = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    failures.push(label);
    console.error(`  ✗ ${label}`);
  }
}
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  ok(a === b, `${label} — expected ${b}, got ${a}`);
}

/* ---------------------------------------------------------------- */
/* CQ1 — the checkpoint: the arc's head, chosen like the picker.     */
/* ---------------------------------------------------------------- */
console.log("CQ1 — checkpoint");
const selfLive: ContinueSourceLite = {
  relation: "self",
  entries: [
    { iteration: 25, path: "/w/class3d_aaa1/run_it025_optimiser.star", complete: true, newest: true },
    { iteration: 20, path: "/w/class3d_aaa1/run_it020_optimiser.star", complete: true, newest: false },
    { iteration: 15, path: "/w/class3d_aaa1/run_it015_optimiser.star", complete: false, newest: false },
  ],
};
eq(checkpointOf([selfLive]), { path: "/w/class3d_aaa1/run_it025_optimiser.star", iteration: 25, archived: false }, "CQ1a self live newest complete wins");
eq(checkpointOf(undefined), null, "CQ1b no sources at all — no checkpoint");
eq(checkpointOf([]), null, "CQ1c empty sources — no checkpoint");
ok(
  checkpointOf([selfLive]) !== null && checkpointOf([selfLive])!.iteration === 25,
  "CQ1d the newest COMPLETE entry wins even mid-list",
);

const upstreamOnly: ContinueSourceLite = {
  relation: "upstream",
  entries: [{ iteration: 25, path: "/w/class3d_zzz9/run_it025_optimiser.star", complete: true, newest: true }],
};
eq(checkpointOf([upstreamOnly]), null, "CQ1e upstream optimisers are the picker's world, not the verb's");

const selfArchived: ContinueSourceLite = {
  relation: "self",
  archived: true,
  entries: [{ iteration: 25, path: "/w/.cryoflow_prev-1/class3d_aaa1/run_it025_optimiser.star", complete: true, newest: true }],
};
eq(
  checkpointOf([selfArchived])?.archived ?? null,
  true,
  "CQ1f archived self generation is a legal checkpoint (flagged)",
);
eq(
  checkpointOf([selfLive, selfArchived])?.archived ?? null,
  false,
  "CQ1g live self outranks archived self",
);
const selfIncomplete: ContinueSourceLite = {
  relation: "self",
  entries: [{ iteration: 25, path: "/w/class3d_aaa1/run_it025_optimiser.star", complete: false, newest: false }],
};
eq(checkpointOf([selfIncomplete]), null, "CQ1h a died-mid-write flush is no checkpoint");
eq(
  checkpointOf([selfIncomplete, selfArchived])?.path ?? null,
  "/w/.cryoflow_prev-1/class3d_aaa1/run_it025_optimiser.star",
  "CQ1i a live incomplete round falls through to the archived generation",
);
const selfError: ContinueSourceLite = { relation: "self", error: "workdir unreadable", entries: [] };
eq(checkpointOf([selfError, upstreamOnly]), null, "CQ1j an errored self scan never borrows upstream");

/* ---------------------------------------------------------------- */
/* CQ2 — the self scan's honest why (the degraded row's voice).      */
/* ---------------------------------------------------------------- */
console.log("CQ2 — self scan errors");
eq(selfScanErrorOf([selfError]), "workdir unreadable", "CQ2a the error speaks verbatim");
eq(selfScanErrorOf([selfLive]), null, "CQ2b a healthy scan has no why");
eq(selfScanErrorOf(undefined), null, "CQ2c absent sources — absence, not error");
eq(selfScanErrorOf([{ relation: "upstream", error: "ssh down", entries: [] }]), null, "CQ2d upstream errors are not the verb's why");

/* ---------------------------------------------------------------- */
/* CQ3 — the --iter knob: the engine's exact mirror.                 */
/* ---------------------------------------------------------------- */
console.log("CQ3 — iter knob");
eq(iterKnobOf("class2d", { algorithm: "em" }), { key: "iterations", current: 25, vdam: false }, "CQ3a algorithm=em → epochs knob, default 25");
eq(iterKnobOf("class2d", { algorithm: "vdam" }), { key: "miniBatches", current: 200, vdam: true }, "CQ3b algorithm=vdam → mini-batches knob, default 200");
eq(iterKnobOf("class2d", {}), { key: "iterations", current: 25, vdam: false }, "CQ3c no keys — curated historical default (EM)");
eq(iterKnobOf("class2d", { do_grad: "true" }), { key: "miniBatches", current: 200, vdam: true }, "CQ3d raw do_grad pair (template import) → VDAM");
eq(iterKnobOf("class2d", { do_grad: "true", do_em: "true" }), { key: "iterations", current: 25, vdam: false }, "CQ3e do_grad+do_em → the pair is ambiguous, EM keeps");
eq(iterKnobOf("class2d", { algorithm: "em", do_grad: "true" }), { key: "iterations", current: 25, vdam: false }, "CQ3f explicit algorithm=em beats a stray do_grad");
eq(iterKnobOf("class2d", { algorithm: "vdam", miniBatches: 100 }), { key: "miniBatches", current: 100, vdam: true }, "CQ3g moved miniBatches wins over nr_iter_grad");
eq(iterKnobOf("class2d", { algorithm: "vdam", nr_iter_grad: 300 }), { key: "miniBatches", current: 300, vdam: true }, "CQ3h RELION-twin row read through the fallback chain");
eq(iterKnobOf("class3d", {}), { key: "iterations", current: 25, vdam: false }, "CQ3i class3d → epochs knob");
eq(iterKnobOf("class3d", { iterations: 25 }), { key: "iterations", current: 25, vdam: false }, "CQ3j class3d current read");
eq(iterKnobOf("autopick", {}), null, "CQ3k non-classification types have no knob");

/* ---------------------------------------------------------------- */
/* CQ4 — totals + ceilings: RELION's arithmetic, the form's caps.    */
/* ---------------------------------------------------------------- */
console.log("CQ4 — totals and ceilings");
eq(totalIterationsOf(25, 5), 30, "CQ4a 25 + 5 = 30 (the total, not +5 more)");
eq(totalIterationsOf(0, 10), 10, "CQ4b from zero");
eq(ceilingFor("class2d", false), 50, "CQ4c class2d EM ceiling 50");
eq(ceilingFor("class2d", true), 500, "CQ4d class2d VDAM ceiling 500");
eq(ceilingFor("class3d", false), 100, "CQ4e class3d ceiling 100");
eq(ceilingFor("refine3d", false), 50, "CQ4f refine3d's ceiling landed in t456 (the verb's reach grew)");
ok(!Number.isFinite(ceilingFor("polish", false)), "CQ4g truly unknown shapes clamp nowhere");

/* ---------------------------------------------------------------- */
/* CQ5 — the stepper: two domains, two scales.                       */
/* ---------------------------------------------------------------- */
console.log("CQ5 — more options");
eq(moreOptionsFor(false), [5, 10, 25], "CQ5a EM epochs speak hours: +5/+10/+25");
eq(moreOptionsFor(true), [50, 100, 200], "CQ5b VDAM mini-batches speak minutes: +50/+100/+200");

/* ---------------------------------------------------------------- */
/* CQ6 — the plan: one face for the fire button.                     */
/* ---------------------------------------------------------------- */
console.log("CQ6 — plan assembly");
const emPlan = continuePlanOf({
  type: "class3d",
  params: { iterations: 25 },
  checkpoint: { path: "/w/class3d_aaa1/run_it025_optimiser.star", iteration: 25, archived: false },
  more: 10,
});
eq(emPlan?.fnCont, "/w/class3d_aaa1/run_it025_optimiser.star", "CQ6a fn_cont = the checkpoint path");
eq(emPlan?.paramKey, "iterations", "CQ6b class3d writes the curated epochs key");
eq(emPlan?.totalIter, 35, "CQ6c 25 + 10 → 35 (the RELION total)");
eq(emPlan?.clamped, false, "CQ6d within the ceiling — no clamp");
const clampedPlan = continuePlanOf({
  type: "class3d",
  params: { iterations: 90 },
  checkpoint: { path: "/w/class3d_aaa1/run_it090_optimiser.star", iteration: 90, archived: false },
  more: 25,
});
eq(clampedPlan?.totalIter, 100, "CQ6e 90 + 25 clamps to the form's 100");
eq(clampedPlan?.clamped, true, "CQ6f the clamp is announced, not silent");
const vdamPlan = continuePlanOf({
  type: "class2d",
  params: { algorithm: "vdam", miniBatches: 200 },
  checkpoint: { path: "/w/class2d_aaa1/run_it200_optimiser.star", iteration: 200, archived: false },
  more: 100,
});
eq(vdamPlan?.paramKey, "miniBatches", "CQ6g VDAM writes miniBatches");
eq(vdamPlan?.totalIter, 300, "CQ6h 200 + 100 → 300 mini-batches");
eq(continuePlanOf({ type: "autopick", params: {}, checkpoint: selfLive.entries[0]! ? { path: selfLive.entries[0]!.path, iteration: 25, archived: false } : null!, more: 5 }), null, "CQ6i no knob → no plan (the degraded face)");
eq(
  continueParamWrites(emPlan!),
  { fn_cont: "/w/class3d_aaa1/run_it025_optimiser.star", iterations: 35 },
  "CQ6j the fire button's writes: fn_cont + the knob, nothing else",
);
eq(
  continueParamWrites(vdamPlan!),
  { fn_cont: "/w/class2d_aaa1/run_it200_optimiser.star", miniBatches: 300 },
  "CQ6k VDAM's writes carry miniBatches (a PATCH-allowed key)",
);

/* ---------------------------------------------------------------- */
/* CQ7 — the lane: the verb speaks the job's own world.              */
/* ---------------------------------------------------------------- */
console.log("CQ7 — lane law");
const clusterJob = {
  runRemote: { connectionId: "conn-1", connectionName: "Mock Cluster", module: "relion/5.0.1", mode: "slurm" },
};
eq(
  continueLaneOf(clusterJob),
  { connectionId: "conn-1", module: "relion/5.0.1", mode: "slurm" },
  "CQ7a the ledger IS the target (same connection, module, mode)",
);
eq(continueLaneOf({ runRemote: null }), null, "CQ7b no ledger — the local lane");
eq(continueLaneOf(null), null, "CQ7c no job — the local lane");
eq(
  continueLaneOf({ runRemote: { connectionId: "conn-2", module: "", mode: "direct" } }),
  { connectionId: "conn-2", module: null, mode: "direct" },
  "CQ7d empty module degrades to the connection's default (null rides)",
);
eq(
  continueLaneOf({ runRemote: { connectionId: "", module: "relion/5.0.1", mode: "slurm" } }),
  null,
  "CQ7e an anonymous connection is no lane at all",
);
eq(
  continueLaneOf({ runRemote: { connectionId: "conn-3", mode: "weird" } }),
  { connectionId: "conn-3", module: null, mode: "direct" },
  "CQ7f an unknown mode falls to direct (the honest default), never slurm",
);

/* ---------------------------------------------------------------- */
console.log(`\nt455 bench: ${pass} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(failures.map((f) => `  FAIL ${f}`).join("\n"));
  process.exit(1);
}

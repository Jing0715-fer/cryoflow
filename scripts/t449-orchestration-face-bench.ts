/**
 * t449 bench — the verb's face: the orchestration strip's smallest truths.
 *
 *   O1 (the dot row): ticks are done / active / todo — done count filled,
 *      exactly one active while a node is in flight, none when the walk
 *      is complete; the counter clamps (a face that reads backwards is a
 *      lie, never a glitch); the row retires past TICKS_CAP and for an
 *      empty world.
 *   O2 (the headline): one sentence true at every instant — count so
 *      far, who is running now, the refreshed close; singular and plural
 *      worlds; total 0 refuses to compose a sentence at all.
 *   O3 (the stop receipt): the user's stop is intent, not failure — the
 *      sentence counts what re-ran and what keeps its results, with verb
 *      agreement on the remaining count (1 keeps, N keep).
 *   O4 (the guard): a second walk is refused by naming the active root.
 *   O5 (the honesty line): the strip's tab law says "tab" and "cluster" —
 *      the face must tell the user what dies with the tab before they
 *      learn it the hard way.
 *   O6 (the strip's composition contract): the aria sentence is the
 *      headline composed with the root and the stop state — the same
 *      brain functions the component calls, asserted end-to-end so the
 *      spoken word and the visual cannot drift apart.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  ORCH_TAB_LAW,
  TICKS_CAP,
  orchGuardSentence,
  orchestrationHeadline,
  orchestrationTicks,
  stopReceiptSentence,
  ticksVisible,
} from "../src/lib/subtree-run";

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

/* O1 — the dot row -------------------------------------------------- */

eq(orchestrationTicks(0, 0), [], "O1a empty world — no dots");
eq(
  orchestrationTicks(5, 0),
  ["active", "todo", "todo", "todo", "todo"],
  "O1b nothing landed — the FIRST node is the one in flight"
);
eq(
  orchestrationTicks(5, 3),
  ["done", "done", "done", "active", "todo"],
  "O1c three landed — active sits exactly at the frontier"
);
eq(
  orchestrationTicks(5, 5),
  ["done", "done", "done", "done", "done"],
  "O1d complete walk — no active tick, all done"
);
eq(
  orchestrationTicks(5, 7),
  ["done", "done", "done", "done", "done"],
  "O1e overcount clamps down — never reads backwards"
);
eq(
  orchestrationTicks(3, -1),
  ["active", "todo", "todo"],
  "O1f negative clamps up to zero"
);
eq(
  orchestrationTicks(2, 1),
  ["done", "active"],
  "O1g single-done world — active is the last"
);
eq(orchestrationTicks(30, 29).length, 30, "O1h past-cap world still counts (retirement is the strip's lens)");

must(ticksVisible(0) === false, "O1i empty world hides the row");
must(ticksVisible(1) === true, "O1j one node shows its dot");
must(ticksVisible(TICKS_CAP) === true, "O1k exactly at cap still visible");
must(ticksVisible(TICKS_CAP + 1) === false, "O1l past cap retires");

/* O2 — the headline ------------------------------------------------- */

eq(orchestrationHeadline({ total: 0, done: 0 }), "Nothing to re-run", "O2a empty world refuses to compose");
eq(
  orchestrationHeadline({ total: 13, done: 3, currentName: "Auto-pick (tutorial)" }),
  "3 of 13 re-ran — Auto-pick (tutorial) is running now",
  "O2b count + who is running now"
);
eq(
  orchestrationHeadline({ total: 13, done: 0, currentName: null }),
  "0 of 13 re-ran",
  "O2c nothing landed yet — the count alone is true"
);
eq(
  orchestrationHeadline({ total: 1, done: 1 }),
  "1 of 1 re-ran — subtree refreshed",
  "O2d singular complete walk"
);
eq(
  orchestrationHeadline({ total: 2, done: 2 }),
  "2 of 2 re-ran — subtree refreshed",
  "O2e plural complete walk"
);
eq(
  orchestrationHeadline({ total: 5, done: 7 }),
  "5 of 5 re-ran — subtree refreshed",
  "O2f clamped overcount reads as complete, not nonsense"
);

/* O3 — the stop receipt --------------------------------------------- */

must(
  stopReceiptSentence(3, 13).includes("3 of 13") && stopReceiptSentence(3, 13).includes("remaining 10 keep"),
  "O3a counts what re-ran and what keeps (plural)"
);
eq(
  stopReceiptSentence(0, 1),
  "You stopped the dispatching — 0 of 1 re-ran; the remaining 1 keeps their current results.",
  "O3b singular remaining keeps"
);
must(
  stopReceiptSentence(5, 5).includes("remaining 0 keep"),
  "O3c nothing remaining — the verb agrees anyway"
);
must(
  stopReceiptSentence(2, 8).startsWith("You stopped the dispatching"),
  "O3d the sentence opens with the user's own act"
);
must(
  !stopReceiptSentence(2, 8).includes("failed") && !stopReceiptSentence(2, 8).includes("refused"),
  "O3e intent is never worded as failure"
);

/* O4 — the guard ----------------------------------------------------- */

eq(
  orchGuardSentence("CTF Estimation 1"),
  "A subtree re-run from CTF Estimation 1 is already in flight — stop it or let it land before starting another.",
  "O4a the guard names the active root"
);
must(
  orchGuardSentence("Motion Correction 1").includes("already in flight"),
  "O4b the guard names the state, not an accusation"
);

/* O5 — the honesty line ---------------------------------------------- */

must(ORCH_TAB_LAW.includes("tab"), "O5a the law says where the walk lives");
must(ORCH_TAB_LAW.includes("cluster"), "O5b the law says what survives (the in-flight run)");
must(ORCH_TAB_LAW.includes("never dispatched"), "O5c the law says what dies (the remaining nodes)");

/* O6 — the strip's composition contract ------------------------------ */

// the component composes: `Re-running subtree from ${rootName} — ${headline}`
// + (stopRequested ? " — stopping after this job" : "") — the same brain
// calls, asserted here so the spoken aria word and the visual stay one truth.
const orch = { rootId: "j1", rootName: "Motion Correction 1", order: [], index: 2, stopRequested: false };
const headlineA = orchestrationHeadline({ total: 3, done: orch.index, currentName: "CTF Estimation 1" });
const ariaA = `Re-running subtree from ${orch.rootName} — ${headlineA}${orch.stopRequested ? " — stopping after this job" : ""}`;
eq(
  ariaA,
  "Re-running subtree from Motion Correction 1 — 2 of 3 re-ran — CTF Estimation 1 is running now",
  "O6a mid-walk aria sentence composes from the brain"
);
const orchStop = { ...orch, stopRequested: true };
const headlineB = orchestrationHeadline({ total: 3, done: orchStop.index, currentName: null });
const ariaB = `Re-running subtree from ${orchStop.rootName} — ${headlineB}${orchStop.stopRequested ? " — stopping after this job" : ""}`;
must(ariaB.endsWith("— stopping after this job"), "O6b the stop state enters the spoken sentence");
const headlineC = orchestrationHeadline({ total: 3, done: 3, currentName: null });
const ariaC = `Re-running subtree from ${orch.rootName} — ${headlineC}`;
must(ariaC.includes("subtree refreshed"), "O6c the complete walk's aria closes with the refresh");

console.log(`t449 orchestration-face bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

/**
 * t462 — the canvas funnel door bench.
 *
 * The plain-sight door (canvas toolbar) has a pure brain:
 * funnelDoorCandidate(jobs, selectedIds) decides — before any fetch —
 * which chain the door opens, or blocks with an honest line. Every
 * assertion below pins one law of that decision:
 *
 *   D1 — no receipts, no door: an empty world and an all-running world
 *        both block with the same honest line.
 *   D2 — the crown: the deepest finished ENTRY verb wins by the same
 *        canonical order the walk uses; maskcreate (ranked, but not an
 *        entry type) is never the crown; unknown verbs rank mid-chain.
 *   D3 — deterministic ties: same rank → most-recently-touched wins;
 *        same rank and same updatedAt → id order decides. The same
 *        world always opens the same chain.
 *   D4 — SELECTION IS THE QUESTION: one selected finished verb beats
 *        the crown, whatever the crown was.
 *   D5 — honest blocks: a selected unfinished verb blocks (never swaps
 *        another run's funnel in); a crowded selection blocks (the
 *        compare toolbar owns that gesture); a non-stage or dangling
 *        selection falls back to the crown (the selection says nothing
 *        about chains).
 *   D6 — the block lines are the family's copy: the three reasons speak
 *        the pinned FUNNEL_DOOR_BLOCK_LINES verbatim.
 *   D7 — the crown ignores failed verbs: a finished-but-failed
 *        postprocess is not a receipt holder.
 *
 * World contract: pure functions — no store, no fetch, no fs.
 * Run: bun run scripts/t462-funnel-door-bench.ts
 */

import {
  funnelDoorCandidate,
  FUNNEL_DOOR_BLOCK_LINES,
  type FunnelDoorJob,
} from "../src/lib/particle-funnel";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL — ${label}`);
  }
}

let seq = 0;
function job(partial: Partial<FunnelDoorJob>): FunnelDoorJob {
  seq += 1;
  return {
    id: `j${String(seq).padStart(3, "0")}`,
    name: partial.name ?? `Job ${seq}`,
    type: partial.type ?? "import",
    status: partial.status ?? "completed",
    updatedAt: partial.updatedAt ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* D1 — no receipts, no door                                           */
/* ------------------------------------------------------------------ */
{
  const empty = funnelDoorCandidate([], []);
  must(empty.kind === "blocked", "D1a empty world blocks");
  must(
    empty.kind === "blocked" && empty.reason === "no-receipts",
    "D1b empty world says no-receipts",
  );
  must(
    empty.kind === "blocked" &&
      empty.line === FUNNEL_DOOR_BLOCK_LINES["no-receipts"],
    "D1c empty world speaks the pinned line",
  );

  const running = funnelDoorCandidate(
    [job({ type: "extract", status: "running" }), job({ type: "refine3d", status: "running" })],
    [],
  );
  must(
    running.kind === "blocked" && running.reason === "no-receipts",
    "D1d all-running world says no-receipts",
  );

  const failed = funnelDoorCandidate(
    [job({ type: "postprocess", status: "failed" })],
    [],
  );
  must(
    failed.kind === "blocked" && failed.reason === "no-receipts",
    "D1e a failed-only world says no-receipts",
  );
}

/* ------------------------------------------------------------------ */
/* D2 — the crown: the deepest finished ENTRY verb                     */
/* ------------------------------------------------------------------ */
{
  const world = [
    job({ type: "import" }),
    job({ type: "extract" }),
    job({ type: "class2d" }),
    job({ type: "refine3d" }),
    job({ type: "postprocess" }),
  ];
  const crown = funnelDoorCandidate(world, []);
  must(
    crown.kind === "ready" && crown.job.type === "postprocess",
    "D2a postprocess is the crown of a full chain",
  );
  must(
    crown.kind === "ready" && crown.picked === "crown",
    "D2b the crown confesses it was picked by law, not by selection",
  );

  const noPost = world.filter((j) => j.type !== "postprocess");
  const crown2 = funnelDoorCandidate(noPost, []);
  must(
    crown2.kind === "ready" && crown2.job.type === "refine3d",
    "D2c without postprocess the crown is refine3d",
  );

  // maskcreate outranks refine3d in the walk's canonical order (130>120)
  // but is NOT an entry type — the door never opens on a volume verb.
  const volume = funnelDoorCandidate(
    [job({ type: "import" }), job({ type: "maskcreate" }), job({ type: "class2d" })],
    [],
  );
  must(
    volume.kind === "ready" && volume.job.type === "class2d",
    "D2d maskcreate is ranked but never crowned",
  );

  // an unknown verb may sit mid-chain in the WALK (forced paths work),
  // but the door's root set is the entry types — an unknown verb is
  // never a door root, and the deepest ENTRY verb keeps the crown.
  const unknown = funnelDoorCandidate(
    [job({ type: "import" }), job({ type: "mystage" }), job({ type: "select" })],
    [],
  );
  must(
    unknown.kind === "ready" && unknown.job.type === "select",
    "D2e an unknown verb is never crowned — the deepest entry verb wins",
  );

  // a completed IMPORT alone is still a door — the chain of one
  const solitary = funnelDoorCandidate([job({ type: "import" })], []);
  must(
    solitary.kind === "ready" && solitary.job.type === "import",
    "D2f a solitary import is a door, not a block",
  );
}

/* ------------------------------------------------------------------ */
/* D3 — deterministic ties                                             */
/* ------------------------------------------------------------------ */
{
  const twins = [
    job({ type: "refine3d", name: "Run A", updatedAt: "2026-09-29T10:00:00Z" }),
    job({ type: "refine3d", name: "Run B", updatedAt: "2026-09-29T12:00:00Z" }),
  ];
  const latest = funnelDoorCandidate(twins, []);
  must(
    latest.kind === "ready" && latest.job.name === "Run B",
    "D3a same rank → the most-recently-touched run is crowned",
  );
  const reversed = funnelDoorCandidate([...twins].reverse(), []);
  must(
    reversed.kind === "ready" && reversed.job.name === "Run B",
    "D3b the tie-break is order-independent",
  );

  const stalemates = [
    job({ type: "refine3d", name: "Twin 1", updatedAt: "2026-09-29T10:00:00Z" }),
    job({ type: "refine3d", name: "Twin 2", updatedAt: "2026-09-29T10:00:00Z" }),
  ];
  const byId = funnelDoorCandidate(stalemates, []);
  must(
    byId.kind === "ready" && byId.job.name === "Twin 1",
    "D3c same rank and stamp → id order decides",
  );
}

/* ------------------------------------------------------------------ */
/* D4 — SELECTION IS THE QUESTION                                      */
/* ------------------------------------------------------------------ */
{
  const world = [
    job({ type: "import" }),
    job({ type: "refine3d", name: "The Big Refine" }),
    job({ type: "postprocess" }),
    job({ type: "class2d", name: "The Humble 2D" }),
  ];
  const picked = funnelDoorCandidate(world, [world[3].id]);
  must(
    picked.kind === "ready" && picked.job.name === "The Humble 2D",
    "D4a one selected verb beats the postprocess crown",
  );
  must(
    picked.kind === "ready" && picked.picked === "selection",
    "D4b the door confesses the selection picked it",
  );
}

/* ------------------------------------------------------------------ */
/* D5 — honest blocks and graceful fallbacks                           */
/* ------------------------------------------------------------------ */
{
  const world = [
    job({ type: "import" }),
    job({ type: "refine3d", name: "Finished Refine" }),
    job({ type: "refine3d", name: "Still Cooking", status: "running" }),
  ];

  const unfinished = funnelDoorCandidate(world, [world[2].id]);
  must(
    unfinished.kind === "blocked" && unfinished.reason === "selection-unfinished",
    "D5a a selected running verb blocks — never a silent swap",
  );
  must(
    unfinished.kind === "blocked" &&
      unfinished.line === FUNNEL_DOOR_BLOCK_LINES["selection-unfinished"],
    "D5b the unfinished block speaks its pinned line",
  );

  const crowded = funnelDoorCandidate(world, [world[0].id, world[1].id]);
  must(
    crowded.kind === "blocked" && crowded.reason === "selection-crowded",
    "D5c a two-finger selection blocks",
  );
  must(
    crowded.kind === "blocked" &&
      crowded.line === FUNNEL_DOOR_BLOCK_LINES["selection-crowded"],
    "D5d the crowded block speaks its pinned line",
  );

  // a selected NON-STAGE verb says nothing about chains → crown
  const w = [
    job({ type: "gatherdose", name: "The Outsider" }),
    job({ type: "ctffind", name: "The CTF" }),
  ];
  const fallback = funnelDoorCandidate(w, [w[0].id]);
  must(
    fallback.kind === "ready" && fallback.job.name === "The CTF",
    "D5e a non-stage selection falls back to the crown",
  );

  // a dangling selection id falls back to the crown too
  const dangling = funnelDoorCandidate(w, ["no-such-job"]);
  must(
    dangling.kind === "ready" && dangling.job.name === "The CTF",
    "D5f a dangling selection id falls back to the crown",
  );
}

/* ------------------------------------------------------------------ */
/* D6 — the block lines are pinned copy                                */
/* ------------------------------------------------------------------ */
{
  must(
    FUNNEL_DOOR_BLOCK_LINES["no-receipts"] ===
      "The funnel reads receipts — no finished verbs yet. Complete a verb and the chain question opens here.",
    "D6a the no-receipts line is pinned",
  );
  must(
    FUNNEL_DOOR_BLOCK_LINES["selection-unfinished"] ===
      "The selected verb hasn't finished — its receipt isn't written yet, so its chain can't be read.",
    "D6b the selection-unfinished line is pinned",
  );
  must(
    FUNNEL_DOOR_BLOCK_LINES["selection-crowded"] ===
      "The chain question reads one line — select a single verb on the canvas.",
    "D6c the selection-crowded line is pinned",
  );
}

/* ------------------------------------------------------------------ */
/* D7 — failed verbs hold no receipts                                  */
/* ------------------------------------------------------------------ */
{
  const world = [
    job({ type: "refine3d", name: "The Good Chain" }),
    job({ type: "postprocess", name: "Broken Post", status: "failed" }),
  ];
  const crown = funnelDoorCandidate(world, []);
  must(
    crown.kind === "ready" && crown.job.name === "The Good Chain",
    "D7a a failed postprocess is never crowned over a finished refine3d",
  );
}

console.log(`\nt462 — funnel door bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

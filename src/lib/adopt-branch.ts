/**
 * CryoFlow — branch adoption (t443): the verdict gets a verb.
 *
 * The A/B arc: t439 gave the per-micrograph verdict, t440 the second
 * domain, t442 the twin (duplicate → tweak → run → compare). What the
 * loop never had is the DECISION: the verdict says "B improved 20
 * micrographs", and then the user re-draws every downstream wire by
 * hand. Adoption is that decision as one gesture — run A's downstream
 * jobs stop consuming A and start consuming B.
 *
 * The laws (each one a refusal bucket, never a silent surprise):
 *
 *  - DIRECT CHILDREN ONLY: the wires that move are the ones leaving A.
 *    Grandchildren keep their own inputs — they rebuild transitively
 *    when their parents re-run on B. Re-parenting whole subtrees would
 *    duplicate the transitive work the graph already does.
 *
 *  - THE CYCLE GUARD: the new wire B→X closes a loop exactly when X can
 *    already reach B. The check runs on the FULL graph, deliberately
 *    conservative — edges that will be refused stay on the real graph
 *    after adoption, so a path through them must still refuse. New
 *    edges all START at B, so they never help a path TO B; refusing is
 *    always the safe reading. X === B (A feeds B directly) is the
 *    trivial self-loop case.
 *
 *  - THE PORT GUARD: the wire keeps its port names, and the new source
 *    must actually declare that output port. The compare face only
 *    pairs same-type runs, so this never fires there — the guard exists
 *    so the lib stays honest when called from anywhere else.
 *
 *  - ALREADY-WIRED IS NOT A MOVE: if X already consumes B through the
 *    same port pair, the adoption has nothing to add — the wire is
 *    reported, not duplicated (the DB's unique (from,to) constraint
 *    would refuse it anyway). Both wires stay: a multi-input job fed by
 *    both branches keeps both until the user says otherwise.
 *
 *  - THE RECEIPT NAMES NAMES: moves, already-wired and refusals are all
 *    reported with child names — a graph mutation the user cannot see
 *    is a graph mutation that did not happen honestly.
 *
 * Pure brain: no React, no store, no fetch — the same law as
 * duplicate-run.ts (t442). The store applies the plan; the dialog
 * renders its honest disabled states from it.
 */

/** The slice of an edge the planner needs — EdgeDTO satisfies this. */
export interface AdoptEdgeLike {
  id: string;
  fromJobId: string;
  toJobId: string;
  fromPort?: string | null;
  toPort?: string | null;
}

/** The slice of a job the planner needs — JobDTO satisfies this. */
export interface AdoptJobLike {
  id: string;
  type: string;
  name: string;
}

/** A wire leaving A, re-parented to start at B. */
export interface AdoptionMove {
  /** the existing A→child edge that will be deleted */
  edge: AdoptEdgeLike;
  /** the child that changes source */
  child: AdoptJobLike;
}

export interface AdoptionRefusal {
  move: AdoptionMove;
  /** cycle: the child can already reach B (or IS B) — the new wire would
   *  close a loop. port: B does not declare the wire's output port. */
  reason: "cycle" | "port";
}

export interface AdoptionPlan {
  /** wires to re-parent: delete edge, create B→child with the same ports */
  moves: AdoptionMove[];
  /** children already consuming B through the same port pair — left
   *  untouched, reported so the receipt accounts for every wire */
  alreadyWired: AdoptionMove[];
  /** wires the adoption refuses, with the reason */
  refused: AdoptionRefusal[];
  /** A === B — the picker can produce it (A is switchable); nothing to do */
  sameRun: boolean;
  /** A has no outgoing wires at all — a leaf run, nothing downstream */
  noDownstream: boolean;
}

/**
 * Plan an adoption of `toRunId` over `fromRunId`'s downstream.
 *
 * `outputPortsOf` is injected (the workflow catalog lives behind
 * jobType()) so the brain stays dependency-free; the store passes
 * (type) => jobType(type)?.outputs.map(p => p.name) ?? [].
 */
export function planAdoption(opts: {
  edges: AdoptEdgeLike[];
  jobs: AdoptJobLike[];
  fromRunId: string;
  toRunId: string;
  outputPortsOf: (type: string) => string[];
}): AdoptionPlan {
  const { edges, jobs, fromRunId, toRunId, outputPortsOf } = opts;

  const sameRun = fromRunId === toRunId;
  const outgoing = edges.filter((e) => e.fromJobId === fromRunId);
  const noDownstream = outgoing.length === 0;

  if (sameRun || noDownstream) {
    return { moves: [], alreadyWired: [], refused: [], sameRun, noDownstream };
  }

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const bOutputs = new Set(outputPortsOf(
    jobById.get(toRunId)?.type ?? "",
  ));

  const moves: AdoptionMove[] = [];
  const alreadyWired: AdoptionMove[] = [];
  const refused: AdoptionRefusal[] = [];

  // THE CYCLE CHECK RUNS ON THE FULL GRAPH — deliberately conservative.
  // An edge that will be refused (cycle/port) STAYS on the real graph
  // after adoption, and a path through it must still refuse new wires;
  // removing "probably-moving" edges upfront could miss exactly those
  // loops. Over-refusing is the safe reading of a cycle guard, and in
  // the compare face's canonical world (A and B siblings in a DAG) no
  // path child⇒B exists at all — the conservatism never fires there.
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.fromJobId);
    if (list) list.push(e.toJobId);
    else adj.set(e.fromJobId, [e.toJobId]);
  }

  const reaches = (start: string, target: string): boolean => {
    if (start === target) return true;
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length > 0) {
      const node = queue.shift() as string;
      for (const next of adj.get(node) ?? []) {
        if (next === target) return true;
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return false;
  };

  for (const edge of outgoing) {
    const child = jobById.get(edge.toJobId);
    if (!child) {
      // a wire into a ghost job (deleted under us) — nothing to re-parent,
      // nothing to report as a child; skip it entirely
      continue;
    }
    const move: AdoptionMove = { edge, child };

    // already wired: the child consumes B through the same port pair —
    // the adoption has nothing to add (report, never duplicate)
    const dup = edges.some(
      (e) =>
        e.id !== edge.id &&
        e.fromJobId === toRunId &&
        e.toJobId === child.id &&
        e.fromPort == edge.fromPort &&
        e.toPort == edge.toPort,
    );
    if (dup) {
      alreadyWired.push(move);
      continue;
    }

    // cycle guard: the child reaching B in G_minus (or being B) means
    // the new wire closes a loop
    if (reaches(child.id, toRunId)) {
      refused.push({ move, reason: "cycle" });
      continue;
    }

    // port guard: the wire keeps its ports; B must declare the output
    // (portless legacy wires pass through untouched by this guard)
    if (edge.fromPort != null && !bOutputs.has(edge.fromPort)) {
      refused.push({ move, reason: "port" });
      continue;
    }

    moves.push(move);
  }

  return { moves, alreadyWired, refused, sameRun, noDownstream };
}

/* ------------------------------------------------------------------ */
/* The receipt — one toast speaks for the whole adoption (t146's       */
/* aggregate law, extended to graph surgery in t442's duplication).    */
/* ------------------------------------------------------------------ */

export interface AdoptionReceipt {
  title: string;
  detail: string;
}

const CAP = 4;

function nameList(names: string[]): string {
  const head = names.slice(0, CAP).join(", ");
  return names.length > CAP ? `${head} … and ${names.length - CAP} more` : head;
}

/**
 * The adoption's spoken form. `failures` carries child names whose
 * persistence failed mid-gesture — the receipt must never claim a wire
 * the server did not take (t441's law: the map's own walk, not the
 * shovel's口头账).
 */
export function describeAdoption(
  plan: AdoptionPlan,
  nameA: string,
  nameB: string,
  failures: string[] = [],
): AdoptionReceipt {
  const moved = plan.moves.length;

  if (moved === 0 && plan.alreadyWired.length === 0 && plan.refused.length === 0) {
    return {
      title: "Nothing to adopt",
      detail: plan.sameRun
        ? "Runs A and B are the same run — pick a different run B."
        : `${nameA} has no downstream jobs to re-wire.`,
    };
  }

  const parts: string[] = [];
  if (moved > 0) {
    parts.push(
      `${moved} downstream ${moved === 1 ? "wire" : "wires"} re-wired from ${nameA} to ${nameB}`,
    );
    const affected = plan.moves.map((m) => m.child.name);
    parts.push(`${nameList(affected)} now consume${affected.length === 1 ? "s" : ""} ${nameB}`);
    parts.push("their current results stay until re-run");
  }
  if (plan.alreadyWired.length > 0) {
    parts.push(
      `${plan.alreadyWired.length} ${plan.alreadyWired.length === 1 ? "job" : "jobs"} already on ${nameB} (left as is)`,
    );
  }
  for (const r of plan.refused) {
    parts.push(
      r.reason === "cycle"
        ? `${r.move.child.name} refused — re-wiring would close a loop`
        : `${r.move.child.name} refused — ${nameB} has no matching output port`,
    );
  }
  if (failures.length > 0) {
    parts.push(`failed to persist: ${nameList(failures)} — the wire may reappear on reload`);
  }

  return {
    title:
      moved > 0
        ? `Downstream adopted by ${nameB}`
        : failures.length > 0
          ? "Adoption failed"
          : "Nothing moved",
    detail: parts.join(" · "),
  };
}

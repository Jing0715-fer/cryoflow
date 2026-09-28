/**
 * t443 bench — branch adoption: the verdict gets a verb.
 *
 *   A1 (planAdoption · the move set): only the wires LEAVING run A move;
 *      ports ride along untouched; grandchildren keep their own inputs;
 *      the move order follows the outgoing edge order.
 *   A2 (the cycle guard): a child that can already reach B (or IS B)
 *      refuses — the new wire would close a loop. The check is
 *      conservative by law: it runs on the FULL graph, so a path that
 *      threads through another candidate's wire still refuses.
 *   A3 (already wired): a child consuming B through the same port pair
 *      is reported, never duplicated, never touched.
 *   A4 (the port guard): the wire keeps its port names and B must
 *      declare that output — a mismatched source refuses with "port".
 *   A5 (describeAdoption): the receipt names names — counts, affected
 *      children (capped), refusals with reasons, failures honestly; an
 *      empty plan says exactly why it is empty.
 *   A6 (the honest empty shapes): sameRun and noDownstream produce
 *      empty plans that describe themselves.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  describeAdoption,
  planAdoption,
  type AdoptEdgeLike,
  type AdoptJobLike,
} from "../src/lib/adopt-branch";

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

/* helpers — a tiny world factory */
let seq = 0;
const job = (id: string, type = "motioncorr", name = id): AdoptJobLike => ({
  id,
  type,
  name,
});
const edge = (
  from: string,
  to: string,
  fromPort = "micrographs",
  toPort = "movies",
): AdoptEdgeLike => ({ id: `e${++seq}`, fromJobId: from, toJobId: to, fromPort, toPort });

const portsOf = (type: string) =>
  type === "motioncorr" ? ["micrographs"] : type === "ctffind" ? ["micrographs"] : ["out"];

/* ================= A1 — the move set ================= */
console.log("A1 — planAdoption: direct children only, ports preserved, order kept");
{
  // Import → A, A → X, A → Y, X → Z. Adopt B over A: X and Y move, Z keeps X.
  const jobs = [
    job("imp", "import", "Import"),
    job("a", "motioncorr", "Motion A"),
    job("b", "motioncorr", "Motion B"),
    job("x", "ctffind", "CTF X"),
    job("y", "ctffind", "CTF Y"),
    job("z", "extract", "Extract Z"),
  ];
  const edges = [
    edge("imp", "a"),
    edge("a", "x", "micrographs", "movies"),
    edge("a", "y", "micrographs", "movies"),
    edge("x", "z", "micrographs", "particles"),
  ];
  const plan = planAdoption({ edges, jobs, fromRunId: "a", toRunId: "b", outputPortsOf: portsOf });

  must(plan.moves.length === 2, "A1a exactly the two wires leaving A move");
  must(
    plan.moves.every((m) => m.edge.fromJobId === "a"),
    "A1b every move's old wire starts at A",
  );
  must(
    plan.moves.every((m) => m.edge.fromPort === "micrographs" && m.edge.toPort === "movies"),
    "A1c ports ride along untouched",
  );
  must(
    !plan.moves.some((m) => m.child.id === "z"),
    "A1d the grandchild keeps its own input (no subtree duplication)",
  );
  must(
    plan.moves.map((m) => m.child.id).join(",") === "x,y",
    "A1e move order follows the outgoing edge order",
  );
  must(
    plan.moves.every((m) => m.child.name === m.child.name) && plan.moves[0]?.child.name === "CTF X",
    "A1f moves carry the child's name (the receipt names names)",
  );
}

/* ================= A2 — the cycle guard ================= */
console.log("A2 — cycle guard: a child that reaches B refuses, conservatively");
{
  // B downstream of A: Import → A → X → B. Adopting B over A would close A→X→B→X.
  const jobs = [job("imp", "import"), job("a"), job("b"), job("x", "ctffind")];
  const chain = planAdoption({
    edges: [edge("imp", "a"), edge("a", "x"), edge("x", "b", "micrographs", "movies")],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  must(
    chain.moves.length === 0 && chain.refused.length === 1 && chain.refused[0]?.reason === "cycle",
    "A2a a child that reaches B refuses as cycle",
  );

  // A feeds B directly: the A→B wire would become B→B.
  const direct = planAdoption({
    edges: [edge("a", "b")],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  must(
    direct.moves.length === 0 &&
      direct.refused.length === 1 &&
      direct.refused[0]?.reason === "cycle",
    "A2b a child that IS B refuses (the trivial self-loop)",
  );

  // Sane sibling world: no path X ⇒ B — the move sails through.
  const sane = planAdoption({
    edges: [edge("imp", "a"), edge("imp", "b"), edge("a", "x", "micrographs", "movies")],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  must(
    sane.moves.length === 1 && sane.refused.length === 0,
    "A2c the canonical sibling world refuses nothing",
  );

  // Conservative law: the path may thread through ANOTHER candidate's
  // wire (it would stay only if that candidate refuses — the guard
  // refuses first and asks never). Import → A → X; A → M; X → M; M → B.
  const threaded = planAdoption({
    edges: [
      edge("imp", "a"),
      edge("a", "x", "micrographs", "movies"),
      edge("a", "m", "micrographs", "movies"),
      edge("x", "m", "micrographs", "movies"),
      edge("m", "b", "micrographs", "movies"),
    ],
    jobs: [...jobs, job("m", "extract")],
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  must(
    threaded.refused.some((r) => r.move.child.id === "x" && r.reason === "cycle"),
    "A2d a path through another candidate's wire still refuses (conservative law)",
  );
}

/* ================= A3 — already wired ================= */
console.log("A3 — already wired: reported, never duplicated, never touched");
{
  const jobs = [job("a"), job("b"), job("x", "ctffind")];
  // X consumes BOTH: A→X (micrographs→movies) and B→X with the SAME pair.
  const edges = [
    edge("a", "x"),
    edge("b", "x"),
  ];
  const plan = planAdoption({ edges, jobs, fromRunId: "a", toRunId: "b", outputPortsOf: portsOf });

  must(plan.alreadyWired.length === 1, "A3a the same-pair wire reports as already wired");
  must(plan.moves.length === 0, "A3b nothing moves (the DB's unique pair would refuse it)");
  must(
    plan.alreadyWired[0]?.child.id === "x",
    "A3c the already-wired report names the child",
  );

  // A DIFFERENT port pair is not "already wired" — multi-input jobs keep
  // both branches; the move proceeds for the pair it is asked about.
  const multi = planAdoption({
    edges: [edge("a", "x", "micrographs", "movies"), edge("b", "x", "micrographs", "movies2")],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  must(
    multi.moves.length === 1 && multi.alreadyWired.length === 0,
    "A3d a different port pair is a real move, not a duplicate",
  );
}

/* ================= A4 — the port guard ================= */
console.log("A4 — port guard: B must declare the wire's output port");
{
  const jobs = [job("a", "motioncorr"), job("b", "extract"), job("x", "ctffind")];
  const plan = planAdoption({
    edges: [edge("a", "x", "micrographs", "movies")],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf, // extract declares only ["out"]
  });

  must(
    plan.moves.length === 0 && plan.refused[0]?.reason === "port",
    "A4a a source without the wire's output port refuses",
  );

  // portless legacy wires pass through untouched by this guard
  const legacy = planAdoption({
    edges: [{ id: "e0", fromJobId: "a", toJobId: "x" }],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  must(
    legacy.moves.length === 1 && legacy.refused.length === 0,
    "A4b a portless legacy wire passes the port guard",
  );
}

/* ================= A5 — the receipt ================= */
console.log("A5 — describeAdoption: the receipt names names, honestly");
{
  const jobs = [
    job("a", "motioncorr", "Motion Correction 1"),
    job("b", "motioncorr", "Motion Correction 1 (copy)"),
    job("x", "ctffind", "CTF Estimation 1"),
    job("y", "ctffind", "CTF Estimation 2"),
  ];
  const plan = planAdoption({
    edges: [edge("a", "x", "micrographs", "movies"), edge("a", "y", "micrographs", "movies")],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  const ok = describeAdoption(plan, "Motion Correction 1", "Motion Correction 1 (copy)");

  must(
    ok.title === "Downstream adopted by Motion Correction 1 (copy)",
    "A5a a successful adoption's title names the winner",
  );
  must(ok.detail.includes("2 downstream wires re-wired"), "A5b the count speaks");
  must(
    ok.detail.includes("CTF Estimation 1") && ok.detail.includes("CTF Estimation 2"),
    "A5c the affected children are named",
  );
  must(
    ok.detail.includes("their current results stay until re-run"),
    "A5d the receipt carries the re-run duty (statuses stay)",
  );

  // refusals and already-wired ride in the same receipt
  const mixed = planAdoption({
    edges: [
      edge("a", "x", "micrographs", "movies"),
      edge("a", "y", "micrographs", "movies"),
      edge("b", "y", "micrographs", "movies"),
    ],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  const mixedReceipt = describeAdoption(mixed, "A", "B");
  must(
    mixedReceipt.detail.includes("already on B"),
    "A5e an already-wired child is reported in the receipt",
  );

  const refusedPlan = planAdoption({
    edges: [edge("a", "b", "micrographs", "movies"), edge("a", "x", "micrographs", "movies")],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  const refusedReceipt = describeAdoption(refusedPlan, "A", "B");
  must(
    refusedReceipt.detail.includes("would close a loop"),
    "A5f a cycle refusal says why it was refused",
  );

  // persistence failures downgrade the claim (t441: the walk's own walk)
  const failReceipt = describeAdoption(plan, "A", "B", ["CTF Estimation 1"]);
  must(
    failReceipt.detail.includes("failed to persist") &&
      failReceipt.detail.includes("CTF Estimation 1"),
    "A5g a failed wire is named, never claimed",
  );

  // the cap: six children, four named, the tail counted
  const many = planAdoption({
    edges: [
      edge("a", "c1", "micrographs", "movies"),
      edge("a", "c2", "micrographs", "movies"),
      edge("a", "c3", "micrographs", "movies"),
      edge("a", "c4", "micrographs", "movies"),
      edge("a", "c5", "micrographs", "movies"),
      edge("a", "c6", "micrographs", "movies"),
    ],
    jobs: [
      job("a"),
      job("b"),
      job("c1", "ctffind", "C1"),
      job("c2", "ctffind", "C2"),
      job("c3", "ctffind", "C3"),
      job("c4", "ctffind", "C4"),
      job("c5", "ctffind", "C5"),
      job("c6", "ctffind", "C6"),
    ],
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  const capped = describeAdoption(many, "A", "B");
  must(
    capped.detail.includes("… and 2 more") && !capped.detail.includes("C5"),
    "A5h the roster caps at four and counts the tail",
  );
}

/* ================= A6 — the honest empty shapes ================= */
console.log("A6 — empty plans describe themselves");
{
  const jobs = [job("a"), job("b")];
  const same = planAdoption({
    edges: [edge("a", "x", "micrographs", "movies")],
    jobs,
    fromRunId: "a",
    toRunId: "a",
    outputPortsOf: portsOf,
  });
  must(
    same.sameRun && same.moves.length === 0,
    "A6a sameRun produces an empty plan with the flag up",
  );
  must(
    describeAdoption(same, "A", "B").detail.includes("same run"),
    "A6b the same-run receipt says exactly that",
  );

  const leaf = planAdoption({
    edges: [edge("imp", "a")],
    jobs,
    fromRunId: "a",
    toRunId: "b",
    outputPortsOf: portsOf,
  });
  must(
    leaf.noDownstream && leaf.moves.length === 0,
    "A6c a leaf run produces an empty plan with the flag up",
  );
  must(
    describeAdoption(leaf, "A", "B").detail.includes("no downstream"),
    "A6d the leaf receipt says exactly that",
  );
}

console.log(`\nt443 adopt-branch bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

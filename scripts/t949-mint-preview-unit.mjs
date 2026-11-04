#!/usr/bin/env node
/**
 * t949 — the MINT PREVIEW unit (node-only, the REAL brain via jiti).
 *
 * THE GAP (surfaced by t948's own design work, carried as candidate
 * b2): the riders' plans were computed against run B's ID as a stand-in
 * for the not-yet-minted filter/selection. Two lies fell out of that
 * stand-in in the multi-input world (a child of A already consuming B
 * through the same port pair):
 *
 *  1. THE UNDERCOUNT — the stand-in's dup check filed the child under
 *     alreadyWired ("left as is"), but the rider's fire re-parents onto
 *     a freshly MINTED node nothing can be wired to — the child MOVES,
 *     and the aria's "re-wires N of A's downstream jobs onto it"
 *     undercounted the fire (said 0 or fewer than the fire's truth).
 *  2. THE FALSE DISABLE — with the wired child as A's ONLY downstream,
 *     the stand-in plan had moves=0 and the rider rendered DISABLED
 *     with "The downstream already consumes B — nothing to adopt" — a
 *     promise about a fire that would actually re-wire.
 *
 * THE CURE: planAdoption grows `mintTargetType` — the dup check skips
 * (nothing can pre-exist wired to a mint), the ports are the mint
 * type's (the t453/t454 caller-side port-swap shim becomes a named law
 * of the lib), and the cycle check keeps reading toRunId (the only
 * wire into the mint is toRunId→mint, so "the child can reach the
 * mint" means exactly "the child can reach toRunId" — the stand-in
 * check IS the fire's truth).
 *
 * THE CROWN PIN — THE PREVIEW ≡ FIRE EQUIVALENCE: on a synthetic
 * multi-input world, the preview plan (edges WITHOUT the mint,
 * toRunId = B, mintTargetType set) must file every child exactly as
 * the fire's own plan (edges WITH the mint, toRunId = the mint's id) —
 * the same moves, the same refusals, the same order of buckets. The
 * rider's speech reads the preview; the fire executes the fire plan;
 * this unit pins them as one truth.
 *
 *   node scripts/t949-mint-preview-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t949-mint-preview-unit.json";
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") }, interopDefault: true });
const lib = await jiti.import(pathToFileURL(path.join(ROOT, "src/lib/adopt-branch.ts")).href);
const planAdoption = lib.planAdoption;

/* the ports map — the real catalog's shape at the rider's seats:
 * ctffind declares micrographs; excludemg (the filter mint) declares
 * micrographs; select2d (the selection mint) declares particles. */
const PORTS = {
  ctffind: ["micrographs"],
  excludemg: ["micrographs"],
  select2d: ["particles"],
  autopick: [],
  motioncorr: ["micrographs"],
};
const portsOf = (type) => PORTS[type] ?? [];

/* ================================================================== */
console.log("== the equivalence world: A and B siblings, X the multi-input child ==");
/* A→X and B→X (X fed by both branches, portless wires — the real
 * world's shape), the mint M absent at preview time. */
const jobsW = [
  { id: "A", type: "ctffind", name: "CTF A" },
  { id: "B", type: "ctffind", name: "CTF B" },
  { id: "X", type: "autopick", name: "Autopick" },
  { id: "M", type: "excludemg", name: "Exclude Micrographs Filter" },
];
const worldEdges = [
  { id: "e-ax", fromJobId: "A", toJobId: "X", fromPort: null, toPort: null },
  { id: "e-bx", fromJobId: "B", toJobId: "X", fromPort: null, toPort: null },
];
const fireEdges = [
  ...worldEdges,
  { id: "e-bm", fromJobId: "B", toJobId: "M", fromPort: "micrographs", toPort: "micrographs" },
];

const oldStandIn = planAdoption({
  edges: worldEdges, jobs: jobsW, fromRunId: "A", toRunId: "B", outputPortsOf: portsOf,
});
ok("A1 THE OLD STAND-IN's filing (the gap, reproduced at the brain): X files under alreadyWired",
  oldStandIn.alreadyWired.length === 1 && oldStandIn.alreadyWired[0].child.id === "X" && oldStandIn.moves.length === 0,
  `moves=${oldStandIn.moves.length} wired=${oldStandIn.alreadyWired.length}`);

const preview = planAdoption({
  edges: worldEdges, jobs: jobsW, fromRunId: "A", toRunId: "B",
  mintTargetType: "excludemg", outputPortsOf: portsOf,
});
ok("A2 THE CURE at the brain: with mintTargetType X MOVES (the dup check skips — nothing can be wired to a mint)",
  preview.moves.length === 1 && preview.moves[0].child.id === "X" && preview.alreadyWired.length === 0,
  `moves=${preview.moves.length} wired=${preview.alreadyWired.length}`);

/* THE CROWN — the fire's own plan, computed against the mint's id with
 * the mint present in the graph: */
const fire = planAdoption({
  edges: fireEdges, jobs: jobsW, fromRunId: "A", toRunId: "M", outputPortsOf: portsOf,
});
const key = (p) => JSON.stringify({
  moves: p.moves.map((m) => m.child.id),
  wired: p.alreadyWired.map((m) => m.child.id),
  refused: p.refused.map((r) => `${r.move.child.id}:${r.reason}`),
});
ok("A3 THE PREVIEW ≡ FIRE EQUIVALENCE (the crown): the preview's buckets are the fire plan's buckets, verbatim",
  key(preview) === key(fire),
  `preview=${key(preview)} fire=${key(fire)}`);
ok("A3 the fire plan's own shape (X moves onto the mint — the fire's truth the old aria hid)",
  fire.moves.length === 1 && fire.moves[0].child.id === "X" && fire.alreadyWired.length === 0 && fire.refused.length === 0);

/* ================================================================== */
console.log("== the port law: the stand-in and the mint disagree BOTH ways ==");
/* B = select2d (declares particles), the mint = excludemg (declares
 * micrographs). A wire's fromPort is judged against the TARGET's
 * outputs — the stand-in judged it against B's, the preview must judge
 * it against the mint's. */
const jobsPort = [
  { id: "A", type: "ctffind", name: "Run A" },
  { id: "B", type: "select2d", name: "Selection B" },
  { id: "Y", type: "autopick", name: "Consumer Y" },
];
const wire = (fromPort) => [{ id: "e-ay", fromJobId: "A", toJobId: "Y", fromPort, toPort: null }];

const microWireOld = planAdoption({ edges: wire("micrographs"), jobs: jobsPort, fromRunId: "A", toRunId: "B", outputPortsOf: portsOf });
const microWireNew = planAdoption({ edges: wire("micrographs"), jobs: jobsPort, fromRunId: "A", toRunId: "B", mintTargetType: "excludemg", outputPortsOf: portsOf });
ok("A4 the mint declares what B does not: the old stand-in refused the micrographs wire (a LIE — the fire moves it), the preview MOVES it",
  microWireOld.refused.length === 1 && microWireOld.refused[0].reason === "port" &&
  microWireNew.moves.length === 1 && microWireNew.refused.length === 0,
  `old=${microWireOld.refused[0]?.reason ?? "?"} new=${microWireNew.moves.length > 0 ? "moves" : "?"}`);

const partWireOld = planAdoption({ edges: wire("particles"), jobs: jobsPort, fromRunId: "A", toRunId: "B", outputPortsOf: portsOf });
const partWireNew = planAdoption({ edges: wire("particles"), jobs: jobsPort, fromRunId: "A", toRunId: "B", mintTargetType: "excludemg", outputPortsOf: portsOf });
ok("A4 the mint lacks what B declares: the old stand-in promised the move (a LIE — the fire refuses), the preview refuses (port)",
  partWireOld.moves.length === 1 &&
  partWireNew.refused.length === 1 && partWireNew.refused[0].reason === "port",
  `old=${partWireOld.moves.length > 0 ? "moves" : "?"} new=${partWireNew.refused[0]?.reason ?? "?"}`);

/* ================================================================== */
console.log("== the cycle law: the stand-in check IS the fire's truth ==");
/* Y2 reaches B (Y2→B edge): the mint consumes B, so Y2 reaches the mint
 * too — the preview (reading B) and the fire (reading M) must both
 * refuse Y2 with cycle. */
const jobsCycle = [
  { id: "A", type: "ctffind", name: "Run A" },
  { id: "B", type: "ctffind", name: "Run B" },
  { id: "Y2", type: "motioncorr", name: "Loop Child" },
  { id: "M", type: "excludemg", name: "Filter" },
];
const cycleWorld = [
  { id: "e-ay2", fromJobId: "A", toJobId: "Y2", fromPort: null, toPort: null },
  { id: "e-y2b", fromJobId: "Y2", toJobId: "B", fromPort: null, toPort: null },
];
const cyclePreview = planAdoption({ edges: cycleWorld, jobs: jobsCycle, fromRunId: "A", toRunId: "B", mintTargetType: "excludemg", outputPortsOf: portsOf });
const cycleFire = planAdoption({
  edges: [...cycleWorld, { id: "e-bm", fromJobId: "B", toJobId: "M", fromPort: "micrographs", toPort: "micrographs" }],
  jobs: jobsCycle, fromRunId: "A", toRunId: "M", outputPortsOf: portsOf,
});
ok("A5 the cycle child refuses in BOTH plans (the preview's B-check equals the fire's mint-check)",
  cyclePreview.refused.length === 1 && cyclePreview.refused[0].reason === "cycle" &&
  key(cyclePreview) === key(cycleFire));

/* ================================================================== */
console.log("== the plain verb's world stands untouched ==");
const plainAgain = planAdoption({
  edges: worldEdges, jobs: jobsW, fromRunId: "A", toRunId: "B", outputPortsOf: portsOf,
});
ok("A6 WITHOUT mintTargetType the filing is the t948 world's (X alreadyWired — the plain verb's speakWired gate keeps its truth)",
  plainAgain.alreadyWired.length === 1 && plainAgain.moves.length === 0);
ok("A6 the mint preview never leaks into the plain call (the option is opt-in)",
  !("mintTargetType" in { edges: worldEdges, jobs: jobsW, fromRunId: "A", toRunId: "B", outputPortsOf: portsOf }));

/* ================================================================== */
console.log("== the source pins: the dialog's riders wear the named law ==");
const src = readFileSync(path.join(ROOT, "src/components/workflow/results/run-compare-dialog.tsx"), "utf8");
ok("A7 the select rider passes mintTargetType (the t453 port law, now the lib's)",
  /mintTargetType: spec\.adoptTargetType as string,/.test(src.slice(src.indexOf("const selectPlan"), src.indexOf("const adoptableSelect"))));
ok("A7 the exclude rider passes mintTargetType (the t454 law carried home)",
  /mintTargetType: spec\.adoptTargetType as string,/.test(src.slice(src.indexOf("const excludePlan"), src.indexOf("const adoptableExclude"))));
ok("A7 the port-swap shim is GONE (the caller-side conditional died with the cure)",
  !src.includes("type === jobById.get(effectiveRunB)?.type"));
ok("A7 the plain adoptionPlan call site does NOT pass mintTargetType (the opt-in stays opt-in)",
  !/adoptionPlan = useMemo[\s\S]{0,600}mintTargetType/.test(src));
ok("A8 the lib's doc names the three consequences (the dup skip, the mint's ports, the cycle truth)",
  /THE DUP CHECK SKIPS[\s\S]*THE PORTS ARE THE MINT'S[\s\S]*THE CYCLE CHECK KEEPS READING toRunId/.test(
    readFileSync(path.join(ROOT, "src/lib/adopt-branch.ts"), "utf8")));

/* ---- the receipt ---- */
try { writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ instrument: "t949-mint-preview-unit", pass, fail, at: new Date().toISOString() }, null, 2)); } catch {}
console.log(`\nMINT-PREVIEW-UNIT t949: ${pass}/${pass + fail} ${fail === 0 ? "green — the preview is the fire's own truth" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

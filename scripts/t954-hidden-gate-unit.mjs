#!/usr/bin/env node
/**
 * t954 — the HIDDEN GATE unit (node-only, the REAL brain via jiti).
 *
 * THE FACE: a class3d host's class A/B dialog hides the SELECT rider
 * entirely (run-compare-dialog's selectWired gate — the t453 wiring
 * law: "the host's OWN outputs must cover every select2d mouth").
 * Until this window the gate had NO direct pin anywhere: the t453
 * bench (C7) pins the selection-shaped PLAN, the browser witnesses
 * (t952/t953) pin the rider's PRESENT faces on class2d hosts — the
 * hiding itself, the gate's FALSE side, lived only in the source.
 *
 * THE LAW THIS UNIT PINNS — the hiding is the MOUTH-COVERAGE gate's
 * choice, never the plan's refusal:
 *
 *   G  the mouths and the outputs (the gate's own vocabulary):
 *      select2d's classes mouth accepts references2d only; class2d
 *      declares references2d (wired — the t952/t953 world's standing
 *      shape); class3d declares volume+particles (NOT wired — the
 *      t954 world's shape). The gate's every-check, replicated
 *      verbatim from the component over the REAL catalog.
 *   M  THE MINT-PREVIEW COUNTER-PROOF: on the t954 graph (A class3d,
 *      its ONLY downstream wire on the PARTICLES mouth — the friendly
 *      twin of t953's classes-mouth child), the rider's plan
 *      (mintTargetType=select2d) MOVES that wire — moves=1, refused=0.
 *      So in the very face where the rider is hidden, the plan would
 *      speak the ENABLED speech: the silence is the gate's honesty
 *      (the mint's gallery would starve — a 3D classification has no
 *      class-averages references), not a data verdict.
 *   P  the plain verb's plan (no mint) over the same graph: moves=1,
 *      refused=0 — B (a class3d) declares the particles mouth; the
 *      plain fire moves C honestly — the face's other half (the
 *      t953 split verdict's shape, now on the 3D ladder).
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createJiti } from "jiti";

const ROOT = path.join(process.cwd());
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") }, interopDefault: true });

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra ?? ""}` : ""}`); }
};
const eq = (actual, expected, label) =>
  ok(label, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const { jobType } = await jiti.import(pathToFileURL(path.join(ROOT, "src/lib/workflow.ts")).href);
const { planAdoption } = await jiti.import(pathToFileURL(path.join(ROOT, "src/lib/adopt-branch.ts")).href);

/** THE COMPONENT'S GATE, VERBATIM (run-compare-dialog selectWired):
 *  the host's OWN outputs must cover every select2d mouth. */
function selectWired(hostType) {
  const hostOutKinds = (jobType(hostType)?.outputs ?? [])
    .map((o) => o.kind)
    .filter(Boolean);
  const selIns = jobType("select2d")?.inputs ?? [];
  return selIns.every(
    (i) => !i.accepts?.length || i.accepts.some((k) => hostOutKinds.includes(k)),
  );
}

/* ---------------------------------------------------------------- */
/* G — the mouths and the outputs (the gate's own vocabulary).       */
/* ---------------------------------------------------------------- */
console.log("G — the mouths and the outputs");
const selIns = jobType("select2d")?.inputs ?? [];
eq(selIns.map((i) => i.name), ["classes", "particles"], "G1 the select2d mint speaks TWO mouths (classes, particles)");
eq(selIns.find((i) => i.name === "classes")?.accepts, ["references2d"], "G2 the classes mouth accepts references2d only");
eq(selIns.find((i) => i.name === "particles")?.accepts, ["particles"], "G3 the particles mouth accepts particles only");
const c2dKinds = (jobType("class2d")?.outputs ?? []).map((o) => o.kind);
eq(c2dKinds, ["references2d", "particles"], "G4 a class2d declares references2d + particles (the t952/t953 hosts)");
const c3dKinds = (jobType("class3d")?.outputs ?? []).map((o) => o.kind);
eq(c3dKinds, ["volume", "particles"], "G5 a class3d declares volume + particles — NO references2d (the t954 host)");

/* ---------------------------------------------------------------- */
/* W — the gate's verdicts over the REAL catalog.                    */
/* ---------------------------------------------------------------- */
console.log("W — the gate's verdicts");
eq(selectWired("class2d"), true, "W1 class2d host: every mouth covered — the rider RENDERS (the t952/t953 standing shape)");
eq(selectWired("class3d"), false, "W2 class3d host: the classes mouth starves — the rider HIDES (the t453 honest silence)");
eq(selectWired("refine3d"), false, "W3 refine3d host hides too (same volume+particles shape) — the gate is about the MOUTHS, not one type");
eq(selectWired("extract"), false, "W4 a particles-only host hides the rider (the classes mouth still starves)");

/* ---------------------------------------------------------------- */
/* M — THE MINT-PREVIEW COUNTER-PROOF (the hidden face's graph).     */
/* ---------------------------------------------------------------- */
console.log("M — the mint preview would ADOPT in the hidden face");
const A = "A3d", B = "B3d", C = "sel";
const t954Jobs = [
  { id: A, type: "class3d", name: "3D Classification 1 (t954)" },
  { id: B, type: "class3d", name: "3D Classification 2 (t954)" },
  { id: C, type: "select2d", name: "Particles Consumer (t954)" },
];
/* the t954 world's graph: A's ONLY downstream wire on the PARTICLES
 * mouth (the friendly twin of t953's classes-mouth child) */
const t954Edges = [
  { id: "e1", fromJobId: A, toJobId: C, fromPort: "particles", toPort: "particles" },
];
const portsOf = (type) => (jobType(type)?.outputs ?? []).map((p) => p.name);

const mintPlan = planAdoption({
  edges: t954Edges, jobs: t954Jobs, fromRunId: A, toRunId: B,
  mintTargetType: "select2d", outputPortsOf: portsOf,
});
eq(mintPlan.moves.length, 1, "M1 THE COUNTER-PROOF: the rider's plan MOVES A's only wire (moves=1)");
eq(mintPlan.moves[0]?.edge.id, "e1", "M2 the moved wire IS A.particles→C.particles");
eq(mintPlan.refused.length, 0, "M3 the plan refuses NOTHING — the silence is the gate's, not the port guard's");
eq(mintPlan.noDownstream, false, "M4 the plan sees real downstream (noDownstream=false)");
eq(mintPlan.sameRun, false, "M5 different runs (sameRun=false)");

/* ---------------------------------------------------------------- */
/* P — the plain verb's plan (no mint) over the same graph.          */
/* ---------------------------------------------------------------- */
console.log("P — the plain verb's plan moves C honestly");
const plainPlan = planAdoption({
  edges: t954Edges, jobs: t954Jobs, fromRunId: A, toRunId: B,
  outputPortsOf: portsOf,
});
eq(plainPlan.moves.length, 1, "P1 the plain plan moves C onto B (B declares the particles mouth)");
eq(plainPlan.refused.length, 0, "P2 the plain plan refuses nothing (clean speech — no refusal clause)");
eq(plainPlan.alreadyWired.length, 0, "P3 nothing already on B (clean speech — no wired clause)");

/* the gate and the plan DISAGREE on the same graph — the face's whole
 * honesty in one pin: the plan says YES (M1), the gate says NOTHING
 * (W2) — hiding is the mouth-coverage law's choice */
ok("M6 THE FACE'S HONESTY: the plan would enable (moves=1) while the gate hides (selectWired=false) — the silence is a choice",
  mintPlan.moves.length === 1 && selectWired("class3d") === false);

/* ---------------------------------------------------------------- */
console.log(`\nt954-hidden-gate-unit: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
if (fail > 0) process.exit(1);

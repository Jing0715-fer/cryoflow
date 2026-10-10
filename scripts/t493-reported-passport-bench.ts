/**
 * t493 — the reported gets its passport. A number that travels without
 * its provenance invites misreading: "reported 3.2 Å" from a class2d's
 * model.star (RELION auto-refine, smoothed FSC) is a DIFFERENT claim
 * from "reported 7.8 Å" on a postprocess's postprocess.star (masked,
 * sharpened final resolution) — same grammar, different instrument.
 * The loader has carried the human label (reportedLabel) since the FSC
 * well was dug; the chart badge quotes it as a tooltip and the identity
 * card prints it — but the TWO faces added since (the paper's curve
 * verdict row, t490; the agent tool's spoken line) dropped it. This
 * window both faces quote the passport, compressed in ONE place
 * (chart-rows' reportedPassport — "RELION " stripped, because both
 * sentences already say RELION), plus the guinier B-factor's fixed
 * passport (its star field IS _rlnBfactorUsedForSharpening).
 *
 *   T1 the passport  — behavioral: strip, null-preserve, foreign labels
 *   T2 the paper     — fsc row quotes the passport; guinier row its own
 *   T3 the tool      — the spoken line quotes the SAME compression
 *   T4 one birthplace — both faces import chart-rows' passport; the
 *                       loader's two real labels are intact
 *   T5 the neighbors — the tooltip and identity-card passports survive
 */

import { readFileSync } from "fs";

/* t503 — the checkout moves between sandbox resets (my-project era ->
 * cryoflow home); resolve the repo root from THIS file, not a
 * hardcoded absolute path that rots the bench the moment the tree moves. */
const REPO = (await import("node:path")).default.resolve(
  (await import("node:url")).fileURLToPath(new URL(".", import.meta.url)),
  "..",
);
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}

const read = (p: string): string => readFileSync(`${REPO}/${p}`, "utf8");
const { reportedPassport } = await import("../src/lib/chart-rows");
const { curveVerdictOf } = await import("../src/lib/qc-report");

// ---------------------------------------------------------------- T1
section("T1 the passport — one compression birthplace");
ok(
  reportedPassport("RELION final resolution (masked, sharpened)") ===
    "final resolution (masked, sharpened)",
  "postprocess label → masked-final passport"
);
ok(
  reportedPassport("RELION auto-refine estimate (smoothed FSC)") ===
    "auto-refine estimate (smoothed FSC)",
  "model-star label → auto-refine passport"
);
ok(reportedPassport(null) === null, "no label → no passport (honest absence)");
ok(reportedPassport("") === null, "empty label → no passport");
ok(reportedPassport("RELION") === null, "a bare RELION prefix strips to nothing → null (never an empty dash)");
ok(
  reportedPassport("some other source's label") === "some other source's label",
  "foreign label passes through untouched (strip only the RELION prefix)"
);

// ---------------------------------------------------------------- T2
section("T2 the paper — the verdict row quotes the passport");
const fscData = {
  source: "postprocess" as const,
  sourceFile: "postprocess.star",
  shells: [{ freq: 0.1, res: 30, fsc: 0.9 }],
  resolutionAt143: 7.785,
  resolutionAt05: 7.2,
  reportedResolution: 7.788,
  reportedLabel: "RELION final resolution (masked, sharpened)",
  interpretation: { atNyquist: false, reportedDiffers: false },
};
ok(
  curveVerdictOf("fsc", fscData) ===
    "FSC 0.143 at 7.8 Å (0.5 at 7.2 Å) · reported 7.8 Å — final resolution (masked, sharpened)",
  "postprocess fsc row: the masked-final passport rides in"
);
ok(
  curveVerdictOf("fsc", {
    ...fscData,
    source: "model" as const,
    sourceFile: "run_it012_half1_model.star",
    reportedLabel: "RELION auto-refine estimate (smoothed FSC)",
  }) ===
    "FSC 0.143 at 7.8 Å (0.5 at 7.2 Å) · reported 7.8 Å — auto-refine estimate (smoothed FSC)",
  "model-star fsc row: the auto-refine passport — same grammar, different instrument, both named"
);
ok(
  curveVerdictOf("fsc", { ...fscData, reportedLabel: null }) ===
    "FSC 0.143 at 7.8 Å (0.5 at 7.2 Å) · reported 7.8 Å",
  "no label → the number still travels, no dangling dash (honest degradation)"
);
const guinierData = {
  jobId: "j1",
  sourceFile: "postprocess.star",
  points: [
    { x: 0.01, amp: 0.9, lnAmp: -0.1, lnAmpSharpened: -0.05 },
    { x: 0.03, amp: 0.5, lnAmp: -0.7, lnAmpSharpened: -0.5 },
    { x: 0.06, amp: 0.25, lnAmp: -1.4, lnAmpSharpened: -1.0 },
  ],
  bfactor: -62.4,
  interpretation: { hasSharpened: true, rangeAngstrom: { from: 7.069, to: 169.0 } },
};
ok(
  (curveVerdictOf("guinier", guinierData) ?? "").includes(
    "B-factor -62.4 Å² (used for sharpening)"
  ),
  "guinier row: the B-factor carries its star-field passport"
);

// ---------------------------------------------------------------- T3
section("T3 the tool — the spoken line quotes the SAME compression");
const toolsSrc = read("src/lib/ai/tools.ts");
ok(toolsSrc.includes("reportedPassport(d.reportedLabel)"), "the fsc spoken line calls the shared passport (no local re-compression)");
ok(
  toolsSrc.includes("` — ${reportedPassport(d.reportedLabel)}`"),
  "the passport rides the spoken line with the em-dash grammar the paper uses"
);
ok(
  toolsSrc.includes("B-factor ${d.bfactor.toFixed(1)} Å² (used for sharpening)"),
  "the guinier spoken line carries the same sharpening passport as the paper"
);
ok(
  toolsSrc.includes("reportedLabel: d.reportedLabel"),
  "the structured payload still carries the full label (short form speaks, long form travels)"
);

// ---------------------------------------------------------------- T4
section("T4 one birthplace — both faces import chart-rows' passport");
const paperSrc = read("src/lib/qc-report.ts");
ok(
  paperSrc.includes("reportedPassport,") && paperSrc.includes('from "@/lib/chart-rows"'),
  "the paper imports the passport from the shared surface"
);
ok(
  toolsSrc.includes('reportedPassport } from "@/lib/chart-rows"'),
  "the tool imports the SAME export (two faces, one compression)"
);
const loaderSrc = read("src/lib/chart-data.ts");
ok(
  loaderSrc.includes('"RELION final resolution (masked, sharpened)"'),
  "loader's postprocess label intact (the passport compresses it, never rewrites it)"
);
ok(
  loaderSrc.includes('"RELION auto-refine estimate (smoothed FSC)"'),
  "loader's model-star label intact"
);

// ---------------------------------------------------------------- T5
section("T5 the neighbors — the tooltip passports survive");
const chartSrc = read("src/components/workflow/results/fsc-chart.tsx");
ok(chartSrc.includes("data.reportedLabel ?? undefined"), "the badge tooltip still quotes the full label");
const rvSrc = read("src/components/workflow/results/results-view.tsx");
ok(/reportedLabel \? ` — \$\{fsc\.reportedLabel\}`/.test(rvSrc.replace(/\s+/g, " ")), "the identity card still prints the full label");
ok(
  !/reportedPassport/.test(chartSrc) && !/reportedPassport/.test(rvSrc),
  "the neighbors keep the LONG label (the short passport belongs to sentences that already say RELION)"
);

console.log(`\n== t493 bench: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

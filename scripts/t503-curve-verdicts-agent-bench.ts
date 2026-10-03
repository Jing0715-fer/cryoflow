/**
 * t503-curve-verdicts-agent-bench.ts — The Verdicts Learn to Speak.
 *
 * The curve-verdicts family's AGENT face: get_curve_verdicts walks the
 * paper's own roster, probes the paper's own map and words every answer
 * through the paper's own builder — the same sister-task t501 did for
 * the Map QC inventory.
 *
 *   T1  the well        — lib/curve-walk: probe map behavior, honest
 *                         empty, import-free runtime posture
 *   T2  tool shape      — catalog entry, zero knobs, description laws
 *   T3  walk law        — roster/order/cap/probes/skips/wounded/wording
 *                         in the executor, all one-well imports
 *   T4  wording         — curveVerdictOf byte identity + labels dialect
 *   T5  neighbors       — dialog twin deleted, route segment intact,
 *                         t498 CSV + t501 landscape + t486 well alive
 */

import { readFileSync } from "fs";
import path from "path";
import { AI_TOOLS } from "../src/lib/ai/tools";
import { CURVE_PROBES_BY_TYPE, probesForType } from "../src/lib/curve-walk";
import { curveVerdictOf, CURVE_KIND_LABELS } from "../src/lib/qc-report";
import type { FscData } from "../src/lib/chart-data";

const REPO = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(REPO, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${msg}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${msg}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);

/* ------------------------------------------------------------------ */
section("T1 — the well (lib/curve-walk: one probe map, two walkers)");

ok(probesForType("postprocess").join(",") === "fsc,guinier", "postprocess probes fsc+guinier");
ok(probesForType("relion_refine3d").join(",") === "fsc,angdist", "refine3d probes fsc+angdist");
ok(probesForType("class2d").join(",") === "fsc,angdist", "class2d probes fsc+angdist (t486: a 2D class can carry an FSC)");
ok(probesForType("ctffind").join(",") === "ctf", "ctffind probes ctf");
ok(probesForType("motioncorr").join(",") === "motion", "motioncorr probes motion");
ok(probesForType("topaz").join(",") === "topaz", "topaz probes topaz");
ok(probesForType("import").length === 0, "a type outside the map probes nothing (honest empty)");
ok(probesForType("postprocess")[0] === "fsc" && CURVE_PROBES_BY_TYPE[0][0].test("postprocess"), "first-match wins: the probe map's own order is the walk's order");

const walkSrc = read("src/lib/curve-walk.ts");
ok(!/from "(?!@\/lib\/qc-report)/.test(walkSrc.replace(/import type[^;]+;/g, "")), "runtime import-free: the only import is the type-only CurveKind");
ok(/import type \{ CurveKind \} from "@\/lib\/qc-report"/.test(walkSrc), "CurveKind rides as a type-only import (erased before any bundle)");
ok(/Constants with two consumers live in ONE place/.test(walkSrc), "the well's docstring states the twins law (same line)");

/* ------------------------------------------------------------------ */
section("T2 — tool shape (the 24th tool, zero knobs)");

ok(AI_TOOLS.length === 34, `AI_TOOLS holds 34 tools — t530's diagnostics read is the newest birth (t530 count-debt, caught by the t547 family run) (got ${AI_TOOLS.length})`);
const tool = AI_TOOLS.find((t) => t.name === "get_curve_verdicts");
ok(!!tool, "get_curve_verdicts is in the catalog");
const props = (tool?.parameters as { properties?: Record<string, unknown> })?.properties ?? {};
ok(Object.keys(props).length === 0, "zero knobs: the walk is the paper's walk, not a filtered one");
ok((tool?.parameters as { additionalProperties?: boolean })?.additionalProperties === false, "additionalProperties locked");

const desc = tool?.description ?? "";
ok(/byte for byte/.test(desc), "description promises the paper's own wording, byte for byte");
ok(/honestly skipped/.test(desc), "description promises honest skips (counted, never guessed)");
ok(/wounded and the walk goes on/.test(desc), "description carries the wounded-walk doctrine (partial truth over silence)");
ok(/get_job_curves reads ONE job's curves/.test(desc), "description draws the boundary against get_job_curves");
ok(/zero knobs/i.test(desc), "description states the zero-knob law");

const toolsSrc = read("src/lib/ai/tools.ts");
ok(/case "get_curve_verdicts":\s*\n\s*return await getCurveVerdicts\(ctx\);/.test(toolsSrc), "dispatch case wired to getCurveVerdicts(ctx)");

/* ------------------------------------------------------------------ */
section("T3 — walk law (the executor obeys the paper's walk)");

// roster + order: completed only, the three-way byRecency comparator, the paper's cap
ok(/const completed = jobs\.filter\(\(j\) => j\.status === "completed"\);/.test(toolsSrc), "walks the completed roster");
ok(/a\.updatedAt < b\.updatedAt \? 1 : a\.updatedAt > b\.updatedAt \? -1 : a\.id < b\.id \? -1 : 1;/.test(toolsSrc), "newest first as a real three-way comparator (id tiebreak keeps same-instant stamps deterministic)");
ok(/\[...completed\]\.sort\(byRecency\)\.slice\(0, MAP_BRIEF_CAP\)/.test(toolsSrc), "roster capped at the paper's own budget (MAP_BRIEF_CAP)");

// probes: from the well, never re-derived
ok(/import \{ probesForType \} from "@\/lib\/curve-walk"/.test(toolsSrc), "probes come from the well (one birthplace, two walkers)");
ok(!/CURVE_PROBES_BY_TYPE: \[RegExp/.test(toolsSrc), "no local probe-map twin in tools.ts");
ok(/for \(const kind of probesForType\(job\.type\)\)/.test(toolsSrc), "each candidate probes the kinds its type predicts");

// data: the chart-data well, no HTTP self-fetch inside the executor
ok(/async function loadCurveData\(/.test(toolsSrc), "loadCurveData rides the chart-data well (t486)");
ok(/case "fsc":\s*\n\s*return loadFsc\(jobId\);/.test(toolsSrc), "fsc through loadFsc");
ok(/case "topaz":\s*\n\s*return loadTopazTraining\(jobId\);/.test(toolsSrc), "topaz through loadTopazTraining (the one kind whose route segment differs — irrelevant here, the loader is called directly)");
const execStart = toolsSrc.indexOf("async function getCurveVerdicts");
const execEnd = toolsSrc.indexOf("async function getJobCurves");
const exec = toolsSrc.slice(execStart, execEnd);
ok(!/\bfetch\(/.test(exec), "no HTTP self-fetch inside the executor (the loaders ARE the well)");
ok(!/Promise\.all/.test(exec), "no fan-out on purpose: a server walk drinks from disk, the slowest-probe bill doesn't apply (docstring carries the doctrine)");
ok(/fan-out here on purpose/.test(toolsSrc), "the no-fan-out doctrine is written down, not just obeyed (same line)");

// wording + skips: the paper's own builder BEFORE travel, honest accounting
ok(/const verdict = curveVerdictOf\(kind, d\);/.test(exec), "every answer is worded through curveVerdictOf BEFORE it travels to the model");
ok(/curve: CURVE_KIND_LABELS\[kind\]/.test(exec), "the curve column speaks the paper's own word (never a raw token)");
ok(/skippedEmpty \+= 1; \/\/ this workdir holds no such curve/.test(exec), "an empty body is an honest skip — counted");
ok(/refused \+= 1; \/\/ this probe's data refused/.test(exec), "a refused read is counted — the walk goes on");
ok(/const wounded = refused > 0;/.test(exec), "wounded = any refusal (partial truth over silence, the t211 doctrine)");
ok(/No completed jobs yet — no curve has spoken\./.test(exec), "the empty roster says its own truth");
ok(/no curve spoke \(/.test(exec), "a walked-but-silent roster says what it counted, never a guess");

/* ------------------------------------------------------------------ */
section("T4 — wording (one birthplace, byte for byte)");

// behavior: the builder's own output, verbatim
const fscVerdict = curveVerdictOf("fsc", {
  jobId: "j1",
  source: "postprocess",
  sourceFile: "postprocess.star",
  shells: [{ freq: 0.01, res: 10, fsc: 0.9 }],
  resolutionAt143: 4.1,
  resolutionAt05: 4.9,
  reportedResolution: 4.0,
  reportedLabel: "masked",
  interpretation: null,
} as FscData);
ok(fscVerdict === "FSC 0.143 at 4.1 Å (0.5 at 4.9 Å) · reported 4 Å — masked", `curveVerdictOf owns the wording (got: ${fscVerdict})`);
ok(curveVerdictOf("fsc", null) === null, "no data — no verdict (the honest skip the walk counts)");
ok(
  CURVE_KIND_LABELS.fsc === "FSC" &&
    CURVE_KIND_LABELS.guinier === "Guinier" &&
    CURVE_KIND_LABELS.angdist === "Angular distribution" &&
    CURVE_KIND_LABELS.ctf === "CTF fit" &&
    CURVE_KIND_LABELS.motion === "Motion drift" &&
    CURVE_KIND_LABELS.topaz === "Picker training",
  "the curve dialect is CURVE_KIND_LABELS' own six words",
);

// the dialog drinks the SAME builder — paper and agent cannot drift
const dialogSrc = read("src/components/workflow/session-report-dialog.tsx");
ok(/import \{\s*[^}]*curveVerdictOf,/.test(dialogSrc), "the paper's table words through the same curveVerdictOf (one birthplace)");
ok(/import \{ CURVE_KIND_LABELS,?/.test(dialogSrc) || /CURVE_KIND_LABELS,/.test(dialogSrc), "the paper's curve column speaks the same labels dialect");

/* ------------------------------------------------------------------ */
section("T5 — neighbors (the family's other faces, untouched)");

ok(!/const CURVE_PROBES_BY_TYPE: \[RegExp, CurveKind\[\]\]\[\] = \[/.test(dialogSrc), "dialog twin deleted: the probe map's local definition is gone");
ok(/import \{ probesForType \} from "@\/lib\/curve-walk"; \/\/ t503/.test(dialogSrc), "the dialog drinks the same well (import with the t503 note)");
ok(/const CURVE_ROUTE_SEGMENT: Record<CurveKind, string> = \{/.test(dialogSrc), "CURVE_ROUTE_SEGMENT stays client-side (wire-only, single consumer)");
ok(/probesForType\(job\.type\)/.test(dialogSrc), "the dialog's probe loop asks the well, not a local map");

ok(/export const curveVerdictsCsv/.test(read("src/lib/qc-report.ts")), "t498's CSV builder alive (the machine grid is another face of the same rows)");
ok(/line\(\["job_id", "job", "curve", "verdict"\]\)/.test(read("src/lib/qc-report.ts")), "t498's CSV header intact (the tool's detail rows carry the same four facts)");
ok(/case "get_map_landscape":/.test(toolsSrc) && /VOLUME_CAPABLE_RE\.test\(j\.type\)/.test(toolsSrc), "t501's landscape walk untouched (the MAP walk keeps its capable-first queue)");
ok(/import \{ loadFsc, ChartJobNotFound \} from "@\/lib\/chart-data"/.test(read("src/app/api/jobs/[id]/fsc/route.ts")), "t486's well still serves the routes (one loader, three consumers)");

/* ------------------------------------------------------------------ */
console.log(`\nt503: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

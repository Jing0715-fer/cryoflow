#!/usr/bin/env node
/**
 * t1087-target-well-unit — the TARGET FACT's one home (the hunt's
 * eighth family: the fact grew a WELL; t1088 grows the THIRD mouth).
 *
 * The face: the verdict pill carried the published mark alone — the
 * arithmetic (the mark, the distance, the met comparison) lived inline
 * in pipeline-kpi.tsx, and the agent's ear (get_job_curves' fsc read)
 * could speak the resolution but never the DISTANCE to the paper's
 * mark. The cure: lib/resolution-target hoists ONE verdict (one
 * subtraction); the pill drinks the tail builder and the passport; the
 * ear appends the named-mark clause and ships the structured verdict.
 * t1088: the session report's fsc verdict row closes with the EAR's
 * own sentence (the paper's row and the agent's ear share a dialect —
 * named-mark prose — so they share the sentence), guarded like the
 * ear's. One arithmetic, one passport, three dialects — two of them
 * one sentence.
 *
 * Band law: static source pins (the t1047 discipline) + LIVE arithmetic
 * (the builders answer with their own words).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  TARGET_ANGSTROM,
  TARGET_PASSPORT,
  targetEarClause,
  targetTitleTail,
  targetVerdict,
} from "../src/lib/resolution-target";
import { curveVerdictOf } from "../src/lib/qc-report";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const kpi = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
const tools = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
const qcReport = readFileSync(path.join(ROOT, "src/lib/qc-report.ts"), "utf8");

let pass = 0;
let fail = 0;
const pin = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* ---- W band: the WELL itself (exports + live arithmetic) ---- */
pin("W1 the mark and the passport live in the well (one home; 4.2 and the EMD-2824 passport verbatim)",
  TARGET_ANGSTROM === 4.2 && TARGET_PASSPORT === "EMPIAR-10017 published: 4.2 Å (EMD-2824)");
pin("W2 LIVE the verdict's one subtraction answers both sides (met at 4.2 exactly — the bar is inclusive; the distance is the absolute gap)",
  (() => {
    const met = targetVerdict(4.0);
    const at = targetVerdict(4.2);
    const above = targetVerdict(4.9);
    return Math.abs(met.distance - 0.2) < 1e-9 && met.met === true &&
      at.met === true && at.distance === 0 &&
      above.met === false && Math.abs(above.distance - 0.7) < 1e-9;
  })());
pin("W3 LIVE the title tail speaks the glance dialect's own sentences (t1052's words, byte-exact from the well)",
  targetTitleTail(targetVerdict(4.0)) === "0.20 Å inside the bar" &&
    targetTitleTail(targetVerdict(4.9)) === "0.70 Å above the bar — push the refinement and the medal turns gold");
pin("W4 LIVE the ear clause NAMES the mark (no chart to point at — the passport rides the spoken line)",
  targetEarClause(targetVerdict(4.0)) === "0.20 Å inside the EMPIAR-10017 published mark (4.2 Å, EMD-2824)" &&
    targetEarClause(targetVerdict(4.9)) === "0.70 Å above the EMPIAR-10017 published mark (4.2 Å, EMD-2824)");

/* ---- P band: the PILL drinks the well (the glance mouth) ---- */
pin("P1 the pill imports the well's four names",
  kpi.includes('import {\n  TARGET_ANGSTROM,\n  TARGET_PASSPORT,\n  targetTitleTail,\n  targetVerdict,\n} from "@/lib/resolution-target"'));
pin("P2 the pill's title drinks the passport and the tail builder (one template, no ternary — the well's words carry both branches)",
  kpi.includes("title={`${TARGET_PASSPORT} — this map: ${resValue.toFixed(2)} Å, ${targetTitleTail(verdict)}`}"));
pin("P3 the pill hoists ONE verdict (the one-arithmetic law's shape: targetVerdict called once per render of the seat)",
  kpi.includes("const verdict = targetVerdict(resValue);") &&
    kpi.split("targetVerdict(resValue)").length === 2);
pin("P4 the face labels keep their glance words and branch on verdict.met",
  kpi.includes("target ≤{TARGET_ANGSTROM} Å met") && kpi.includes("above {TARGET_ANGSTROM} Å target") &&
    kpi.includes("{verdict.met ? ("));
pin("P5 the inline arithmetic is retired (the old const and both inline distance computations pinned GONE)",
  !kpi.includes("const TARGET_ANGSTROM = 4.2;") &&
    !kpi.includes("(TARGET_ANGSTROM - resValue)") &&
    !kpi.includes("(resValue - TARGET_ANGSTROM)"));

/* ---- E band: the EAR drinks the well (the agent's mouth) ---- */
pin("E1 tools imports the well's three names",
  tools.includes('import {\n  TARGET_PASSPORT,\n  targetEarClause,\n  targetVerdict,\n} from "@/lib/resolution-target"'));
pin("E2 the fsc read hoists ONE verdict (null when the 0.143 crossing never spoke)",
  tools.includes("const verdict = d.resolutionAt143 != null ? targetVerdict(d.resolutionAt143) : null;") &&
    tools.split("targetVerdict(d.resolutionAt143)").length === 2);
pin("E3 the spoken line appends the ear clause (guarded on the verdict — a silent crossing stays silent)",
  tools.includes("(verdict ? ` — ${targetEarClause(verdict)}` : \"\")"));
pin("E4 the structured read ships the verdict (met / distance at two decimals / the mark as the passport)",
  tools.includes("target: {\n                  met: verdict.met,\n                  distance: Number(verdict.distance.toFixed(2)),\n                  mark: TARGET_PASSPORT,\n                }"));
pin("E5 the well is the ONLY home (the passport's words live once in the lib and once per mouth only as an import — no re-declared mark anywhere)",
  readFileSync(path.join(ROOT, "src/lib/resolution-target.ts"), "utf8").split("TARGET_ANGSTROM = 4.2").length === 2 &&
    !tools.includes("TARGET_ANGSTROM = 4.2"));

/* ---- R band: the REPORT drinks the well (the third mouth, t1088) ---- */
pin("R1 qc-report imports the well's two names (the ear's clause and the verdict — the paper's row drinks, never re-derives)",
  qcReport.includes('import { targetEarClause, targetVerdict } from "@/lib/resolution-target"'));
pin("R2 the fsc case appends the EAR'S OWN SENTENCE (the shared dialect's shared sentence — verbatim template, no local wording)",
  qcReport.includes("v += ` — ${targetEarClause(targetVerdict(d.resolutionAt143))}`;"));
pin("R3 the append is guarded (the \"?\" row earns no distance — a silent 0.143 crossing stays silent, the ear's own law)",
  qcReport.includes("if (d.resolutionAt143 != null) {"));
pin("R4 LIVE the report row CLOSES with the well's answer (7.785 → the t493 row byte-exact, the named-mark clause last)",
  curveVerdictOf("fsc", {
    source: "postprocess",
    sourceFile: "postprocess.star",
    shells: [{ freq: 0.1, res: 30, fsc: 0.9 }],
    resolutionAt143: 7.785,
    resolutionAt05: 7.2,
    reportedResolution: 7.788,
    reportedLabel: "RELION final resolution (masked, sharpened)",
    interpretation: { atNyquist: false, reportedDiffers: false },
  }) ===
    "FSC 0.143 at 7.8 Å (0.5 at 7.2 Å) · reported 7.8 Å — final resolution (masked, sharpened) — 3.58 Å above the EMPIAR-10017 published mark (4.2 Å, EMD-2824)");
pin("R5 LIVE the inside face through the paper's mouth (4.1 → 0.10 inside — the met branch rides the same sentence)",
  curveVerdictOf("fsc", {
    source: "postprocess",
    sourceFile: "postprocess.star",
    shells: [{ freq: 0.1, res: 30, fsc: 0.9 }],
    resolutionAt143: 4.1,
    resolutionAt05: 4.3,
    reportedResolution: null,
    reportedLabel: null,
    interpretation: null,
  })?.endsWith(" — 0.10 Å inside the EMPIAR-10017 published mark (4.2 Å, EMD-2824)") === true);
pin("R6 the other kinds don't drink (the mark belongs to the FSC row — the guinier verdict carries no EMPIAR clause)",
  !(curveVerdictOf("guinier", {
    jobId: "j1",
    sourceFile: "postprocess_guinier.star",
    points: [{ x: 0.02, amp: 1, lnAmp: 0, lnAmpSharpened: 0 }],
    bfactor: -62.4,
    interpretation: { hasSharpened: true, rangeAngstrom: { from: 7.069, to: 169.0 } },
  }) ?? "").includes("EMPIAR"));

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * t1154 — THE PROGRESS-SCALE unit: one birthplace for the progress
 * column's percent word AND the wire→fraction boundary (lib/
 * progress-scale.ts, the NEW map's third vein).
 *
 * The t1154 window swept the percent/fraction scale the way t1153
 * swept the duration word — and found the 4200% bug's THIRD life
 * hiding in the agent lane the t181 cure never reached: three tool
 * summaries multiplied the raw 0–100 wire by 100 again, so the model
 * told the user "(progress 4200%)" for a 42% run while every screen
 * face spoke the column correctly. The cure is the t181 scale law's
 * ONE home: progressToFraction (the app's only /100 of the column)
 * and fmtProgressPct (the only word). Fourteen word births died into
 * it; the frame (toFractionFrame) rides the father's division; the
 * bar widths and Progress values stay value faces (arithmetic, not
 * words). Everything else ×100 in src/ is a DIFFERENT claim — the
 * census in the father's header enumerates the boundaries.
 *
 * A — the father run FOR REAL: the integer grain, the rounding face,
 *     the junk contract (no guard invented), the fraction face, the
 *     round-trip (the feed's back-translation speaks the same word),
 *     the determinism.
 * B — the source law: the three 4200% births dead in tools.ts, the
 *     seven UI drinkers import the father, the frame rides
 *     progressToFraction, the width face stays a value face, the
 *     class-share boundary drawn at the gallery, the father stays
 *     client-safe (no fs, no clock).
 * C — the doctrine: the wire contract quoted, the t181 story told
 *     (both lives), the boundary census present, one claim one
 *     birthplace.
 *
 * node scripts/unit-runner.mjs scripts/t1154-progress-scale-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fmtProgressPct, progressToFraction } from "@/lib/progress-scale";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const fatherSrc = read("src/lib/progress-scale.ts");
const toolsSrc = read("src/lib/ai/tools.ts");
const cardSrc = read("src/components/workflow/job-card.tsx");
const inspectorSrc = read("src/components/workflow/job-inspector.tsx");
const dashboardSrc = read("src/components/workflow/project-dashboard.tsx");
const minimapSrc = read("src/components/workflow/canvas-minimap.tsx");
const kpiSrc = read("src/components/workflow/pipeline-kpi.tsx");
const ledgerSrc = read("src/components/workflow/print-receipt-ledger.tsx");
const gallerySrc = read("src/components/workflow/class-gallery.tsx");

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- A — the father run FOR REAL ---------- */
console.log("A — the father run FOR REAL");

ok("A1 the integer grain — the wire's own precision, nothing invented",
  fmtProgressPct(0) === "0%" && fmtProgressPct(42) === "42%" && fmtProgressPct(100) === "100%",
  `got ${fmtProgressPct(0)} / ${fmtProgressPct(42)} / ${fmtProgressPct(100)}`);
ok("A2 the rounding face — halves go up, fractions fold into the grain",
  fmtProgressPct(41.6) === "42%" && fmtProgressPct(42.4) === "42%" && fmtProgressPct(99.6) === "100%",
  `got ${fmtProgressPct(41.6)} / ${fmtProgressPct(42.4)} / ${fmtProgressPct(99.6)}`);
ok("A3 the engine's clamp band speaks honestly — 1 and 99 are the running walls",
  fmtProgressPct(1) === "1%" && fmtProgressPct(99) === "99%",
  `got ${fmtProgressPct(1)} / ${fmtProgressPct(99)}`);
ok("A4 the junk contract — no guard invented (the faces never guarded)",
  fmtProgressPct(NaN) === "NaN%" && fmtProgressPct(Infinity) === "Infinity%",
  `got ${fmtProgressPct(NaN)} / ${fmtProgressPct(Infinity)}`);
ok("A5 the fraction face — the ONE /100 (42% is 0.42, never 0.42 of something else)",
  progressToFraction(0) === 0 && progressToFraction(42) === 0.42 && progressToFraction(100) === 1,
  `got ${progressToFraction(42)}`);
ok("A6 the round-trip — the feed's ×100 back-translation speaks the SAME word",
  fmtProgressPct(progressToFraction(42) * 100) === fmtProgressPct(42) &&
    fmtProgressPct(progressToFraction(100) * 100) === fmtProgressPct(100));
ok("A7 the determinism — same wire, same word, twice",
  fmtProgressPct(42) === fmtProgressPct(42) && progressToFraction(42) === progressToFraction(42));

/* ---------- B — the source law ---------- */
console.log("B — the source law");

ok("B1 tools.ts imports the father (the agent's voice drinks ONE word)",
  toolsSrc.includes('import { fmtProgressPct } from "@/lib/progress-scale"'));
ok("B2 the 4200% bug's three lives are DEAD — no progress ×100 word birth survives in tools.ts",
  !toolsSrc.includes("r.progress * 100") &&
    !toolsSrc.includes("job.progress * 100") &&
    !/\(\w+\.progress \* 100\)\.toFixed/.test(toolsSrc),
  "the wire is 0–100; ×100 here multiplied a percent into a four-digit one");
ok("B3 the report line rides the father",
  /report\.map\(\n[^\n]*\n[^\n]*\n[^\n]*\(\w\) => `\$\{r\.name\}: \$\{r\.status\}\$\{r\.status === "running" \? ` \(\$\{fmtProgressPct\(r\.progress\)\}\)`/.test(toolsSrc) ||
    toolsSrc.includes("(${fmtProgressPct(r.progress)})"),
  "the wait/report summary quotes the column, not a re-derivation");
ok("B4 run_job's already-running summary rides the father",
  toolsSrc.includes("is already running (progress ${fmtProgressPct(job.progress)})`"),
  "the second 4200% life's grave");
ok("B5 continue_run's already-running summary rides the father",
  toolsSrc.includes("(progress ${fmtProgressPct(job.progress)}) — a continue resumes a SETTLED run"),
  "the third 4200% life's grave");
ok("B6 job-card speaks the father (chip, aria title, eta chip) — no residue",
  cardSrc.includes('from "@/lib/progress-scale"') &&
    !/Math\.round\(job\.progress\)/.test(cardSrc),
  "three births died into the father");
ok("B7 job-inspector speaks the father (the header row + the progress bar chip) — no residue",
  inspectorSrc.includes('from "@/lib/progress-scale"') &&
    !/Math\.round\(job\.progress\)/.test(inspectorSrc));
ok("B8 the dashboard's row chip and roster rows ride the father — no residue",
  dashboardSrc.includes('from "@/lib/progress-scale"') &&
    !/Math\.round\(job\.progress\)/.test(dashboardSrc) &&
    !/Math\.round\(j\.progress \* 100\)/.test(dashboardSrc));
ok("B9 the frame rides the father's division — the ONE /100 (t181's boundary, now one birthplace)",
  dashboardSrc.includes("progress: progressToFraction(j.progress)") &&
    !/progress: j\.progress \/ 100/.test(dashboardSrc),
  "the frame cannot drift from the scale contract it exists to enforce");
ok("B10 the feed's word sites ride the father through the documented ×100 back-translation",
  dashboardSrc.includes("fmtProgressPct(j.progress * 100)") &&
    (dashboardSrc.match(/fmtProgressPct\(j\.progress \* 100\)/g) || []).length === 2,
  "aria + text: the frame's back-translation is documented, the word is the father's");
ok("B11 the width face stays a value face — the bar's clamp arithmetic is not a word",
  /Math\.min\(100, Math\.max\(2, j\.progress \* 100\)\)\}%/.test(dashboardSrc),
  "a bar's width is arithmetic the eye reads, not a number the model quotes");
ok("B12 the minimap title rides the father",
  minimapSrc.includes("(${fmtProgressPct(job.progress)})") &&
    !/Math\.round\(job\.progress\)/.test(minimapSrc));
ok("B13 the KPI rides the father (the ?? 0 guard stays at the call)",
  kpiSrc.includes("fmtProgressPct(rj.progress ?? 0)") &&
    !/Math\.round\(rj\.progress/.test(kpiSrc));
ok("B14 the paper ledger rides the father",
  ledgerSrc.includes("Running — ${fmtProgressPct(job.progress)}") &&
    !/Math\.round\(job\.progress\)/.test(ledgerSrc));
ok("B15 the father is CLIENT-SAFE by construction — no fs, no clock, no db",
  !/from "(node:)?fs"|from "path"|from "node:path"|from "@\/lib\/db"|Date\.now/.test(fatherSrc),
  "six client faces import it — the byte father's t1152 law");
ok("B16 the class-share boundary is DRAWN at the gallery (two grains of one claim)",
  gallerySrc.includes("Two grains of ONE claim") &&
    gallerySrc.includes("the agent tools' word is one-decimal"),
  "screen compactness vs the model's precision — named so a hunter doesn't arrest the grain");
ok("B17 the Progress VALUE faces still speak the wire — the bar drinks 0–100, not the word",
  inspectorSrc.includes("<Progress value={job.progress}") &&
    dashboardSrc.includes("<Progress value={job.progress}"),
  "a value face and a word face are different claims");

/* ---------- C — the doctrine ---------- */
console.log("C — the doctrine");

ok("C1 the wire contract quoted at the father — the engine writes round(frac*100) clamped",
  fatherSrc.includes("0–100 scale") && fatherSrc.includes("Math.round(frac * 100)"));
ok("C2 the t181 story told at the father — BOTH lives (the feed's cure and the agent lane's survival)",
  fatherSrc.includes("4200%") && fatherSrc.includes("agent lane"));
ok("C3 the boundary census present — the other ×100 claims are named, not arrested",
  fatherSrc.includes("DOCUMENTED BOUNDARIES") &&
    fatherSrc.includes("the zoom word") &&
    fatherSrc.includes("timelineSharePct") &&
    fatherSrc.includes("the engine's voice"));
ok("C4 one claim, one birthplace — the census says the word and the division live here alone",
  fatherSrc.includes("the only place that divides the wire by 100") &&
    fatherSrc.includes("the only place that renders the column's percent WORD"));

console.log(`\nPROGRESS-SCALE-UNIT t1154: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

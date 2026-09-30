/**
 * t499 — the compass shows its pulse. The report's two measured
 * sections (Map QC, Curve verdicts) tell the reader "still measuring"
 * in ITALIC PROSE inside the scroll — a face you only meet after
 * scrolling to the section. The compass chips above the fold now carry
 * the same news: a breathing violet dot while the walk is out, amber
 * when the walk came back deaf (the wound family's ink), emerald when
 * it landed — and NO dot on chips whose section has no measuring walk
 * (the dot MEANS a live measurement; a constant dot means nothing).
 *
 *   T1 the faces    — three states on the dot, CSS grammar, reduced
 *                     motion honored (information, not decoration)
 *   T2 exact words  — the pulse lands only on the exact-words heads
 *                     (the deep report's "Map QC summary" chip never
 *                     borrows it); the consts speak the builder's bytes
 *   T3 the wiring   — the four state wires read directly; priority
 *                     pending > error > settled; honest-empty is settled
 *   T4 the ear      — pending and error announce themselves; settled
 *                     rests (the visible text already speaks it)
 *   T5 the neighbors — needle, landing light, keyboard nav and the
 *                     no-print contract untouched; exported bytes carry
 *                     no pulse markers (the dot lives on screen only)
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
const dialogSrc = read("src/components/workflow/session-report-dialog.tsx");
const cssSrc = read("src/app/globals.css");
const qcSrc = read("src/lib/qc-report.ts");
const reportHtmlSrc = read("src/lib/report-html.ts");

// ---------------------------------------------------------------- T1
section("T1 the faces — three states, one grammar");
ok(/data-compass-pulse=\{pulse\}/.test(dialogSrc), "the dot carries the state on a data attribute (the inspector's hook, the CSS's hook)");
ok(/className="report-compass-dot"/.test(dialogSrc), "the dot wears the compass's own class (inside the strip's grammar, not a foreign chip)");
ok(/\{pulse && \(/.test(dialogSrc), "no pulse, no dot (a constant dot means nothing — only the measured sections carry one)");
ok(/\.report-compass-dot\[data-compass-pulse="pending"\]/.test(cssSrc), "pending has a face in the CSS");
ok(/\.report-compass-dot\[data-compass-pulse="error"\]/.test(cssSrc), "error has a face in the CSS");
ok(/\.report-compass-dot\[data-compass-pulse="settled"\]/.test(cssSrc), "settled has a face in the CSS");
ok(/@keyframes compass-pulse/.test(cssSrc), "the pending dot breathes (its own keyframes, not a borrowed utility)");
const afterKeyframes = cssSrc.split("@keyframes compass-pulse")[1] ?? "";
ok(/@media \(prefers-reduced-motion: reduce\)/.test(afterKeyframes) && /compass-pulse/.test(afterKeyframes.split("@media (prefers-reduced-motion: reduce)")[1] ?? ""), "reduced motion silences the breathing (the news survives without the motion)");
ok(/rgb\(245 158 11\)/.test(cssSrc.split('report-compass-dot[data-compass-pulse="error"]')[1] ?? ""), "error wears the wound family's amber (the t491 ink)");

// ---------------------------------------------------------------- T2
section("T2 exact words — the pulse lands on the one section");
ok(/const CURVES_HEAD = "Curve verdicts";/.test(dialogSrc), "the curve head is a named constant (never retyped inline)");
ok(qcSrc.includes('lines.push("## Curve verdicts")'), "the constant speaks the builder's bytes (one vocabulary, two readers)");
ok(/t\.text === MAP_QC_HEAD/.test(dialogSrc) && /t\.text === CURVES_HEAD/.test(dialogSrc), "the match is exact-words (===), the same law the hero's bouncer obeys");
ok(!/startsWith\(MAP_QC_HEAD\)/.test(dialogSrc) && !/includes\(MAP_QC_HEAD\)/.test(dialogSrc), "no partial matching (a 'Map QC summary — …' chip is a different destination and never borrows the pulse)");
ok(/if \(t\.level !== 2\) return null;/.test(dialogSrc), "h3 subsections never carry the pulse (the dot belongs to a walk, and walks belong to top sections)");

// ---------------------------------------------------------------- T3
section("T3 the wiring — the four wires, one priority");
ok(/mapPending \? "pending" : mapError \? "error" : "settled"/.test(dialogSrc), "the map chip reads its own walk's states (pending > error > settled)");
ok(/curvesPending \? "pending" : curvesError \? "error" : "settled"/.test(dialogSrc), "the curve chip reads its own walk's states");
ok(/const compassPulseOf = \(t: ReportTocItem\)/.test(dialogSrc), "one function answers every chip (no per-chip twins)");
ok(/type ReportTocItem \} from "@\/lib\/report-html"/.test(dialogSrc), "the toc item's type rides the existing report-html import (the parse stays one father)");

// ---------------------------------------------------------------- T4
section("T4 the ear — the pulse speaks before you click");
ok(/still measuring`/.test(dialogSrc) && /compassPulseAria/.test(dialogSrc), "a pending chip announces 'still measuring' to the ear");
ok(/the measurement refused/.test(dialogSrc), "an error chip announces the refusal (the wound is audible, not just amber)");
ok(/settled is the resting truth — the visible text already speaks it/.test(dialogSrc), "settled adds no aria label (the resting truth is the visible text's job — no noise)");
ok(/aria-hidden="true"/.test(dialogSrc.split("data-compass-pulse={pulse}")[1] ?? ""), "the dot itself is decorative (the aria-label speaks for it)");

// ---------------------------------------------------------------- T5
section("T5 the neighbors — needle, light, keyboard, and the plain bytes");
ok(/report-compass-here/.test(cssSrc) && /box-shadow: inset 0 -2px 0 rgb\(124 58 237/.test(cssSrc), "the needle's violet underline untouched (position stays the strip's persistent ink)");
ok(/onCompassKeyDown/.test(dialogSrc) && /data-landing/.test(dialogSrc), "keyboard nav and the landing light untouched (the pulse adds a face, not a behavior)");
ok(/"report-compass no-print"/.test(dialogSrc), "the compass keeps its no-print dress (the pulse rides the map, and the map stays off the paper)");
ok(!qcSrc.includes("compass-pulse") && !reportHtmlSrc.includes("compass-pulse"), "the exported bytes (md + HTML echo) carry no pulse markers (the dot lives on screen — the t483 law at chip scale)");
ok(!/report-compass/.test(reportHtmlSrc), "the echo has no compass at all (a document alone can only congratulate — t239's law intact)");

console.log(`\n----\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

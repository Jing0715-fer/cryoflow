/**
 * t494 — the verdicts learn to point: the paper's fourth family joins
 * the wire. The curve verdicts table (t490) was the ONLY inert family
 * on the report: the inventory rows are doors (t213 pressOwner), the
 * comparison rows carry the winner's portrait (t226), the local rows
 * carry the quarter bands (t227) — but a verdict row named
 * "Post-process (tutorial) · FSC" and the reader went to find that job
 * by hand. This window the rows learned to point: same wire grammar,
 * fourth context, three-cell exact match, pressOwner reuse.
 *
 *   T1 the head      — CURVE_HEAD speaks the builder's own bytes, and
 *                      collides with nobody (full-head match is the
 *                      identity: three cells vs seven)
 *   T2 the context   — fourth provider, exact-words bouncer, thead
 *                      neutralizes (a head row is a label, not a door)
 *   T3 the door      — all THREE rendered cells match (job, kind label
 *                      imported, verdict), pressOwner reused, keyboard
 *                      pressable — a door that needs a mouse is half
 *   T4 the honesty   — unmatched rows stay plain; curves joined the
 *                      memo deps (a stale closure points doors at
 *                      yesterday's rows)
 *   T5 the wire law  — doors live ONLY on the screen: the exported
 *                      bytes (md builder + HTML echo) keep their
 *                      three-column facts, un-doorred (t483's door law
 *                      at paper scale)
 *   T6 the neighbors — inventory/comparison/local grammars untouched;
 *                      pressOwner's engine unchanged (one door, one
 *                      father — no second openJob)
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
const reportSrc = read("src/lib/qc-report.ts");
const htmlSrc = read("src/lib/report-html.ts");

// ---------------------------------------------------------------- T1
section("T1 the head — the builder's own bytes, collision-free");
ok(/const CURVE_HEAD = \["Job", "Curve", "Verdict"\];/.test(dialogSrc), "CURVE_HEAD constant exists, three cells in paper order");
ok(reportSrc.includes("| Job | Curve | Verdict |"), "the builder's md table head speaks the SAME bytes (the wire matches the paper, never retypes it)");
ok(
  ["Job", "Curve", "Verdict"].join("|") !== ["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest"].join("|"),
  "no collision with the inventory septet (full-head match is the identity)",
);
ok(
  ["Job", "Curve", "Verdict"].join("|") !== ["Map", "Bins", "Peak at", "Agreement r", "Verdict"].join("|") &&
    ["Job", "Curve", "Verdict"].join("|") !== ["Map", "Q1", "Q2", "Q3", "Q4", "Weakest", "Depth (fraction)"].join("|"),
  "no collision with the comparison/local heads either",
);

// ---------------------------------------------------------------- T2
section("T2 the context — fourth provider, exact bouncer, thead neutralizes");
ok(/const CurveTableContext = React\.createContext\(false\);/.test(dialogSrc), "CurveTableContext declared (fourth sibling, default false — plain until proven)");
const tableFn = dialogSrc.slice(dialogSrc.indexOf("table: ({ node, children, ...rest }: TableProps)"), dialogSrc.indexOf("thead: ({ node, children"));
ok(/headTexts\.length === CURVE_HEAD\.length && CURVE_HEAD\.every\(\(h, i\) => headTexts\[i\] === h\)/.test(tableFn), "the bouncer matches EVERY head cell at once (a partial head cannot mint a door)");
ok(/<CurveTableContext\.Provider value=\{true\}>/.test(tableFn), "the curve table rides its provider (value=true)");
const theadFn = dialogSrc.slice(dialogSrc.indexOf("thead: ({ node, children"), dialogSrc.indexOf("// a NAMED function expression"));
(
  ["InventoryTableContext", "ComparisonTableContext", "LocalTableContext", "CurveTableContext"] as const
).forEach((c) => {
  ok(theadFn.includes(`<${c}.Provider value={false}>`), `thead neutralizes ${c} (a head row is a label, not a door)`);
});

// ---------------------------------------------------------------- T3
section("T3 the door — three-cell match, pressOwner reuse, keyboard-pressable");
const trFn = dialogSrc.slice(dialogSrc.indexOf("tr: function ReportTr"), dialogSrc.indexOf("// t494: curves joins the deps"));
ok(/const inCurve = React\.useContext\(CurveTableContext\);/.test(trFn), "the tr reads the fourth context");
ok(/if \(inCurve && cells\.length === CURVE_HEAD\.length\) \{/.test(trFn), "the curve branch is gated on the context AND the paper's own three cells");
ok(
  /cells\[0\] === c\.jobName &&\s*\n\s*cells\[1\] === CURVE_KIND_LABELS\[c\.kind\] &&\s*\n\s*cells\[2\] === c\.verdict,/.test(trFn),
  "ALL THREE rendered cells match (job + kind label + verdict — the grammar that refuses partial matches)",
);
ok(/CURVE_KIND_LABELS/.test(dialogSrc.slice(0, dialogSrc.indexOf("const OWNER_HEAD"))), "the kind word is IMPORTED from the logic layer (twins fork, imports don't)");
ok(/data-curve-door=\{curveRow\.jobId\}/.test(trFn), "the door carries its address (data-curve-door = jobId)");
ok(/tabIndex=\{0\}/.test(trFn), "keyboard-focusable (a door that needs a mouse is half a door)");
ok(/e\.key === "Enter" \|\| e\.key === " "/.test(trFn), "Enter/Space press the door");
ok(/onClick=\{\(\) => pressOwner\(curveRow\)\}/.test(trFn), "the press reuses pressOwner — the SAME engine t213 gave the inventory rows (no second openJob)");
ok(/aria-label=\{`Open \$\{curveRow\.jobName\}'s results — the \$\{CURVE_KIND_LABELS\[curveRow\.kind\]\.toLowerCase\(\)\} curve's verdict`\}/.test(trFn), "the aria names the job AND the curve kind (the promise says what it opens)");
ok(/hover:bg-violet-500\/10 focus-visible:bg-violet-500\/15/.test(trFn), "the door wears the report's violet wire grammar (same hover/focus as its three siblings)");

// ---------------------------------------------------------------- T4
section("T4 the honesty — unmatched rows stay plain, deps stay truthful");
ok(/if \(!curveRow\) return <tr \{\.\.\.rest\}>\{children\}<\/tr>;/.test(trFn), "an unmatched row stays plain (a door must promise what the paper says)");
ok(/}, \[mapInventory, mapQc, pressOwner, curves\]\);/.test(dialogSrc), "curves joined the memo deps (a stale closure points doors at yesterday's rows)");
ok(/void useWorkflowStore\.getState\(\)\.openJob\(owner\.jobId\);/.test(dialogSrc) && /onOpenChange\(false\);/.test(dialogSrc), "pressOwner's engine unchanged — openJob, then the paper closes (the results live on the canvas)");

// ---------------------------------------------------------------- T5
section("T5 the wire law — the exported bytes keep their three-column facts");
ok(
  reportSrc.includes("lines.push(`| ${mdCell(row.jobName)} | ${CURVE_KIND_LABELS[row.kind]} | ${mdCell(row.verdict)} |`);"),
  "the md builder's row format unchanged (doors are RENDERED on the wire, never written into the bytes)",
);
ok(!reportSrc.includes("data-curve-door"), "the md builder stays door-free (t483's door law at paper scale)");
ok(!htmlSrc.includes("data-curve-door") && !htmlSrc.includes("pressOwner"), "the HTML echo stays door-free — portable, zero-script, no app to open (the door would promise what the file cannot keep)");

// ---------------------------------------------------------------- T6
section("T6 the neighbors — the other three families keep their own grammar");
ok(/data-owner-door=\{owner\.jobId\}/.test(trFn), "the inventory doors untouched (t213's grammar intact)");
ok(/cells\[0\] === o\.jobName && cells\[1\] === o\.mainName && cells\[2\] === String\(o\.volumeCount\)/.test(trFn), "the inventory's three-cell key unchanged");
ok(/data-shape-cell=\{ov\?\.bins \? "spark" : "empty"\}/.test(trFn), "the comparison portrait cell untouched (t226)");
ok(/<BandStrip bands=\{bands\} \/>/.test(trFn), "the local bands cell untouched (t227)");
ok(
  trFn.indexOf("if (inCurve && cells.length === CURVE_HEAD.length)") < trFn.indexOf("const owner = mapInventory?.find("),
  "the curve branch sits BEFORE the inventory fallback (order is the bouncer's queue — each family meets its own door first)",
);

console.log(`\n----\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

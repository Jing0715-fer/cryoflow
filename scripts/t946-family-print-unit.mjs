#!/usr/bin/env node
/**
 * t946 — the COMPARE FAMILY's print-face unit (node-only).
 *
 * THE LAW (the Task 114 doctrine's third seat): the compare family's
 * four single-run readings — class convergence, resolution arc, final
 * verdict, particle funnel — are DOCUMENTS, not chrome. Paper re-lays
 * the open family face into flow (globals.css's :has() block, one hook
 * data-family-read-dialog driving all four), the inspector's own revival
 * steps aside while a family face owns the sheet, the close X dies (a
 * button on paper is a promise the paper cannot keep), and every face
 * signs its paper through a provenance line (data-family-read-print-doc,
 * screen-hidden, print:block — the revival rides CSS, the provenance
 * rides JSX; the CSS never names the print-doc hook, the t945 law).
 *
 * The per-face honesty: a face's provenance line carries WHAT DIES with
 * the chrome — the convergence's round pickers take the pair with them,
 * so its line speaks Run + pair + clock; the arc/verdict/funnel have no
 * pickers (nothing identity-bearing dies — the title signs the run), so
 * their lines are the paper's clock alone.
 *
 *   node scripts/t946-family-print-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t946-family-print-unit.json";
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const srcOf = (f) => readFileSync(path.join(ROOT, f), "utf8");

const FACES = [
  { key: "convergence", file: "src/components/workflow/results/class-convergence-dialog.tsx", title: "Class convergence" },
  { key: "arc", file: "src/components/workflow/results/resolution-arc-dialog.tsx", title: "Resolution arc" },
  { key: "verdict", file: "src/components/workflow/results/postprocess-verdict-dialog.tsx", title: "Final verdict" },
  { key: "funnel", file: "src/components/workflow/results/particle-funnel-dialog.tsx", title: "Particle funnel" },
];
const srcs = Object.fromEntries(FACES.map((f) => [f.key, srcOf(f.file)]));
const css = srcOf("src/app/globals.css");

/* ---- A1 — every face opts into the print face (hook + the standalone
 * translate kill; the Lightning CSS probe: a same-block translate:none
 * folds into an identity transform, so the kill must be its own rule) */
for (const f of FACES) {
  const src = srcs[f.key];
  const i = src.indexOf("data-family-read-dialog=\"\"");
  ok(`A1 ${f.key}: the DialogContent carries the family hook`, i > 0);
  const kill = src.includes("print:[translate:none]") && src.includes("print:[scale:none]") && src.includes("print:[rotate:none]");
  ok(`A1 ${f.key}: the standalone translate kill rides the className`, kill);
}

/* ---- A2 — every face signs its paper (the provenance line) */
for (const f of FACES) {
  const src = srcs[f.key];
  const has = src.includes("data-family-read-print-doc") && src.includes("hidden print:mt-2 print:block") && src.includes("printed ${printed}");
  ok(`A2 ${f.key}: the provenance line is screen-hidden, print:block, carries the paper clock`, has);
}

/* ---- A3 — the per-face honesty: what dies with the chrome is spoken */
ok("A3 convergence: the line speaks the RUN and the PAIR (the pickers die on paper)",
  srcs.convergence.includes("`Run: ${job.name} · ${nameA} vs ${nameB} · printed ${printed}`"),
  "the pair lives in the line, not in the dying pickers");
ok("A3 arc/verdict/funnel: the line is the paper's clock (no pickers die — the title signs the run)",
  ["arc", "verdict", "funnel"].every((k) => !srcs[k].includes("${nameA}") && srcs[k].includes("{`printed ${printed}`}")),
  "each line carries exactly what the face loses to chrome");

/* ---- A4 — the chrome stays chrome */
ok("A4 convergence: the round pickers carry .no-print",
  srcs.convergence.includes('no-print grid gap-2 sm:grid-cols-2'),
  "the provenance line speaks the pair instead");
ok("A4 convergence + arc: the continue verb row hides whole (a verb that prints is a verb that lies — its whys speak for it)",
  (srcs.convergence.match(/<div className="no-print">\s*\n\s*<ContinueVerbRow/g) ?? []).length === 1 &&
  (srcs.arc.match(/<div className="no-print">\s*\n\s*<ContinueVerbRow/g) ?? []).length === 1);
ok("A4 funnel: the ledger's copy/CSV row carries .no-print (the ledger itself prints above)",
  srcs.funnel.includes('no-print flex justify-end gap-2 border-t pt-3'));
ok("A4 verdict: verbless by design — no verb row to hide",
  !srcs.verdict.includes("ContinueVerbRow"),
  "the reading points at the dial, it does not mutate");

/* ---- A5 — every scroll region unrolls on paper */
for (const f of FACES) {
  ok(`A5 ${f.key}: the scroll region unrolls (print:max-h-none print:overflow-visible)`,
    srcs[f.key].includes("print:max-h-none print:overflow-visible"),
    "the reading prints in full, never behind a scrollbar");
}

/* ---- A6 — the CSS block: one hook, one family, the :has() chain */
ok("A6 the globals.css family block exists (the html:has chain rides the family hook)",
  css.includes('html:has([data-family-read-dialog][data-state="open"])'));
ok("A6 the overlay becomes plain flow under the family hook",
  /html:has\(\[data-family-read-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="dialog-overlay"\]/.test(css));
ok("A6 the inspector's revival steps aside while a family face owns the sheet (the hide outranks on specificity, (0,4,1) over (0,3,1))",
  /html:has\(\[data-family-read-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-inspector-dialog\]\[data-slot="dialog-content"\]\s*\{[^}]*display: none !important/.test(css));
ok("A6 the content re-layout rides the family hook (modal → document)",
  /html:has\(\[data-family-read-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="dialog-content"\]/.test(css));
ok("A6 the close X dies on the family paper (a button on paper closes nothing)",
  /html:has\(\[data-family-read-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-family-read-dialog\]\s*\n\s*>\s*\[data-slot="dialog-close"\]/.test(css));
ok("A6 the CSS never names the print-doc hook (the provenance rides JSX — the t945 law)",
  !css.includes("data-family-read-print-doc"));

/* ---- A7 — the family's census: exactly four hooks, four lines, the
 * compare face keeps its own seat (t945's law untouched) */
const census = (attr) => {
  const out = [];
  for (const f of FACES) {
    const n = (srcs[f.key].match(new RegExp(attr, "g")) ?? []).length;
    if (n > 0) out.push(`${f.key}×${n}`);
  }
  return out;
};
const hooks = census('data-family-read-dialog=""');
const lines = census("data-family-read-print-doc");
ok(`A7 the family census: 4 hooks (${hooks.join(", ")})`, hooks.length === 4 && hooks.every((h) => h.endsWith("×1")));
ok(`A7 the family census: 4 provenance lines (${lines.join(", ")})`, lines.length === 4 && lines.every((l) => l.endsWith("×1")));
const cmpSrc = srcOf("src/components/workflow/results/run-compare-dialog.tsx");
ok("A7 the compare face keeps its own seat (data-compare-dialog untouched — no t945 re-key owed)",
  cmpSrc.includes('data-compare-dialog=""') && !cmpSrc.includes("data-family-read-dialog"));
ok("A7 the four files never borrow the compare hook (the seats stay separate)",
  FACES.every((f) => !srcs[f.key].includes("data-compare-dialog")));

/* ---- A8 — the paper-clock law: every face mounts the clock the same way */
ok("A8 every face reads the clock through usePrintedDate (the t232 law: paper clocks do NOT hydrate)",
  FACES.every((f) => srcs[f.key].includes('import { usePrintedDate } from "@/lib/use-now"')),
  "one well, four drinkers");

/* ---- the receipt ---- */
try { writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ instrument: "t946-family-print-unit", pass, fail, at: new Date().toISOString() }, null, 2)); } catch {}
console.log(`\nFAMILY-PRINT-UNIT t946: ${pass}/${pass + fail} ${fail === 0 ? "green — the law is pinned to the source" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

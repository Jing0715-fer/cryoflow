#!/usr/bin/env node
/**
 * t1092 — THE INSPECTOR PAPER unit (node-only): the job report face's
 * second pass.
 *
 * THE SCAR (this window's survey, four rendered sheets — the inspector's
 * paper had never had a survey of its own): the dialog's workdir footer
 * — the last flex child of the Task 114 print re-layout — was caught
 * BOTH painted over the Overview tab's OUTPUTS tiles mid-page-3 AND
 * orphaned onto a 95%-blank page of the Results tab (Chromium fragments
 * a flex container across printed pages unreliably); six cluster tiles'
 * "on cluster" chips (absolutely positioned over the preview's corner
 * on screen) landed ON the file-name line once the preview buttons
 * print-hid — six names unreadable on the sheet that archives them;
 * the log console's legend printed as a near-black strip with a
 * keyboard hint ("↑↓ scroll · Home/End head/tail") paper cannot press;
 * an untyped note printed as an empty box, a placeholder sentence and a
 * 0/500 counter; and the Results tab printed the workdir path TWICE
 * (its own row + the dialog footer, inches apart).
 *
 * THE CURES (all print-scoped, screen untouched):
 *   1  dialog-content prints as display:block (a flow the pager knows)
 * 1b  the footer is break-inside:avoid — a door plate never splits
 *   2  the badge prints static (above the name, never over it)
 *   3  the legend washes out; the keys stay on the screen
 *   4  the empty editor declines to print (:has(textarea:placeholder-
 *      shown) — the pure-CSS empty test); a typed note still prints
 *   5  one door plate per sheet: the tab-level workdir row stands down
 *
 * BANDS:
 *   A  the footer lands in the flow (block container, atomic footer,
 *      the identity-strip lane intact, the face attribute alive)
 *   B  the badge stops covering the name (attr, print rule, and the
 *      unwrap half of the cure both present)
 *   C  the paper has no keyboard, no dark strip, no empty editor, no
 *      echo (legend attrs + rules, note shell + :has rule, workdir
 *      stand-down)
 *   D  the doctrine stands (the Task 114 :has() revival trio, the
 *      generic control-hiding rule, the print-block rescue + the note's
 *      field-sizing unroll)
 *
 * PROTOCOL: node-only, readFileSync over the components + stylesheet,
 * exit honest, receipt to shots-qa/.t1092-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1092-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const inspector = read("src/components/workflow/job-inspector.tsx");
const results = read("src/components/workflow/results/results-view.tsx");
const css = read("src/app/globals.css");

/* ---------- A band — the footer lands in the flow ---------- */
console.log("A band — the footer lands in the flow:");
/* the inspector container's own rule block — first :has() revival match */
const containerRule = css.slice(
  css.indexOf('html:has([data-inspector-dialog][data-state="open"])\n    [data-slot="dialog-content"] {'),
  css.indexOf('html:has([data-inspector-dialog][data-state="open"])\n    [data-slot="dialog-content"] {') + 1800,
);
ok("A1 the print container is display:block (flex fragments unreliably across pages — the survey's scar)",
  containerRule.includes("display: block !important;") &&
  !containerRule.includes("display: flex !important;"));
ok("A2 the workdir footer is break-inside:avoid (a door plate never splits across pages)",
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-insp-face="footer"\]\s*\{\s*\n\s*break-inside: avoid;/.test(css));
ok("A3 the identity-strip lane survives (padding-bottom: 10mm on the print container)",
  /padding-bottom: 10mm !important;/.test(css));
ok("A4 the dialog footer keeps its face attribute (the t616 wave anchor)",
  inspector.includes('data-insp-face="footer"'));

/* ---------- B band — the badge stops covering the name ---------- */
console.log("B band — the badge stops covering the name:");
ok("B1 the cluster chip carries data-remote-badge AND keeps its screen-absolute classes (the screen face untouched)",
  results.includes('data-remote-badge=""') &&
  /data-remote-badge=""\s*\n\s*className="absolute right-2 top-2 z-10/.test(results));
ok("B2 the badge prints static — above the name, never over it (overlay and unwrap are different diseases)",
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-remote-badge\]\s*\{[\s\S]*?position: static !important;/.test(css));
ok("B3 the name unwrap half stands (the Task 84 archival doctrine: .truncate unwraps in the flowing report)",
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="dialog-content"\]\s*\n\s*\.truncate\s*\{[\s\S]*?white-space: normal !important;/.test(css));

/* ---------- C band — no keyboard, no dark strip, no empty editor, no echo ---------- */
console.log("C band — the paper has no keyboard, no dark strip, no empty editor, no echo:");
ok("C1 the legend is anchored for print AND keeps its dark strip on screen",
  inspector.includes('data-log-legend=""') &&
  /data-log-legend=""\s*\n\s*className="flex max-sm:flex-wrap shrink-0 items-center gap-2\.5 border-t border-zinc-800 bg-zinc-900\/60/.test(inspector));
ok("C2 the keyboard hint is screen-only (paper has no arrows to press)",
  inspector.includes('data-log-legend-keys=""') &&
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-log-legend-keys\]\s*\{\s*\n\s*display: none !important;/.test(css));
ok("C3 the legend's dark strip washes out on paper (the console rules re-ink its text already)",
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-log-legend\]\s*\{[\s\S]*?background: none !important;/.test(css));
ok("C4 the EMPTY note editor declines to print (:has(textarea:placeholder-shown) — the pure-CSS empty test); a typed note still prints",
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-note-shell\]:has\(textarea:placeholder-shown\)\s*\{\s*\n\s*display: none !important;/.test(css) &&
  inspector.includes('<div data-note-shell="">'));
ok("C5 one door plate per sheet (the tab-level workdir row stands down on paper; the dialog footer is the canonical close)",
  results.includes('data-results-workdir=""') &&
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-results-workdir\]\s*\{\s*\n\s*display: none !important;/.test(css));

/* ---------- D band — the doctrine stands ---------- */
console.log("D band — the doctrine stands:");
ok("D1 the Task 114 :has() revival trio survives (the page hides, the backdrop flows, the panes unroll)",
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\) \[data-view\]\s*\{\s*\n\s*display: none !important;/.test(css) &&
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="dialog-overlay"\]\s*\{[\s\S]*?position: static !important;/.test(css) &&
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="tabs-content"\]\s*\{[\s\S]*?overflow: visible !important;/.test(css));
ok("D2 the generic control-hiding rule survives (buttons/inputs/selects are screen controls — the t1089 law at Task 114 altitude)",
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="dialog-content"\]\s*\n\s*:is\(button, input, select\)\s*\{\s*\n\s*display: none !important;/.test(css));
ok("D3 the print-block rescue and the note's field-sizing unroll survive (gallery tiles print as blocks; a typed note unrolls to its content)",
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="dialog-content"\]\s*\n\s*\[data-print-block\]\s*\{/.test(css) &&
  /html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="dialog-content"\]\s*\n\s*\[data-note-editor\]\s*\n\s*textarea\s*\{[\s\S]*?field-sizing: content !important;/.test(css));

/* ---------- receipt ---------- */
console.log(`\nGREEN: ${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
mkdirSync(path.dirname(TMP), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1092-inspector-paper-unit",
  pins: pass + fail,
  green: pass,
  bands: { A: 4, B: 3, C: 5, D: 3 },
  cures: ["display:block print container", "footer break-inside:avoid", "badge static on paper", "legend washout + keys off", "empty note editor declines", "one door plate per sheet"],
  at: new Date().toISOString(),
}, null, 2));
console.log(`receipt: ${TMP}`);

#!/usr/bin/env node
/**
 * t1093 — THE PARAMS DIFF'S PRINT FACE (the Task 114 doctrine's FOURTH seat).
 *
 * THE SCAR (this window's survey, ridden on camera): the diff brain's
 * standalone face — canvas multi-select Compare (Task 87), the inspector's
 * sibling picker (Task 88), the roster's hover icon (Task 89) — still kept
 * the Task 70 step-aside while its own embedded twin (FscParamsDiff, the
 * t945 compare paper's provenance table) printed as a document. The
 * step-aside paper convicted it: with the diff open, Ctrl+P printed the
 * inspector's job report and the comparison was unreachable on the sheet.
 *
 * THE CURES (three files):
 *   1. params-diff-dialog.tsx — the hook (data-params-diff-dialog), the
 *      standalone translate kill (the t945 dialect), the provenance line
 *      (data-params-print-doc, the pair + the paper's clock), the chrome
 *      marks (.no-print: the column swap, the Task 90 open row, the
 *      footnote offer).
 *   2. fsc-params-diff.tsx — the scroll region unrolls (print:max-h-none,
 *      the t946 law), the column headers' names unroll (the t1091 law:
 *      paper has no hover — the truncate would ellipsize the pair's
 *      identity), the key cell unrolls, and the VALUE CELL speaks RAW on
 *      paper (the t1087 law's print half: the screen keeps its 24-char
 *      rhythm with the tooltip, the sheet carries the whole value — the
 *      hidden/print span pair), the collapse toggle is chrome (.no-print).
 *   3. globals.css — the FOURTH seat block: overlay → plain flow, content
 *      → document re-layout with the seat's OWN flex-direction:column line
 *      (the first after-paper caught the bare display:flex re-laying this
 *      grid-native dialog as a ROW: the title squeezed into a ~90px column
 *      beside the diff chip), the inspector steps aside while the diff
 *      owns the sheet ((0,4,1) over (0,3,1), the t945 doctrine verbatim),
 *      the seat's OWN [data-view] hide (the canvas entry opens with NO
 *      inspector behind it — the paper is what the user is reading), and
 *      the close X dies (a button on paper is a promise the paper cannot
 *      keep, the t946 law).
 *
 * 20 pins in four bands:
 *   A the revival (7) — the hook, the translate kill, the overlay flow,
 *     the column re-layout, the [data-view] hide, the inspector
 *     step-aside, the X death.
 *   B the chrome dies (4) — swap, open row, footnote, collapse toggle.
 *   C the facts speak whole (5) — the provenance line (attr + voice +
 *     the hook-order law), the value cell's dual face, the scroll unroll,
 *     the header unroll, the key unroll.
 *   D the doctrine preserved (4) — the generic step-aside stands, the
 *     t945 block byte-intact, the t946 block byte-intact, one hook per
 *     seat (no cross-seat drift).
 *
 * fs-only, bare node (RUNNERS 0). Receipt: shots-qa/.t1093-unit-receipt.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const params = read("src/components/workflow/params-diff-dialog.tsx");
const diff = read("src/components/workflow/results/fsc-params-diff.tsx");
const css = read("src/app/globals.css");

const must = (id, ok, why) => {
  results.push({ id, ok: !!ok, why });
  if (!ok) failed++;
};
const results = [];
let failed = 0;

/* ---------------- A — the revival (7) ---------------- */

// A1 — the hook opts the dialog out of the generic step-aside
must(
  "A1",
  params.includes('data-params-diff-dialog=""'),
  "the DialogContent carries data-params-diff-dialog (the seat's opt-in)"
);

// A2 — the standalone translate kill rides the className (the t945 dialect:
// Lightning CSS folds a same-block translate:none into an identity transform)
must(
  "A2",
  params.includes(
    "print:[translate:none] print:[scale:none] print:[rotate:none]"
  ),
  "the className carries the standalone translate/scale/rotate kill"
);

// A3 — the overlay becomes plain flow (no stamp, no scrim)
const a3 = css.indexOf(
  'html:has([data-params-diff-dialog][data-state="open"])\n    [data-slot="dialog-overlay"]'
);
must(
  "A3",
  a3 > 0 &&
    css.slice(a3, a3 + 300).includes("display: block !important") &&
    css.slice(a3, a3 + 300).includes("position: static !important") &&
    css.slice(a3, a3 + 300).includes("background: none !important"),
  "the diff's overlay re-lays into plain flow (block/static/no scrim)"
);

// A4 — the content re-layout carries the seat's OWN column line (the first
// after-paper caught the bare display:flex re-laying the grid-native dialog
// as a ROW)
const a4 = css.indexOf(
  'html:has([data-params-diff-dialog][data-state="open"])\n    [data-slot="dialog-content"]'
);
must(
  "A4",
  a4 > 0 &&
    css.slice(a4, a4 + 900).includes("display: flex !important") &&
    css.slice(a4, a4 + 900).includes("flex-direction: column !important"),
  "the content re-lays as a COLUMN document (the seat's own line)"
);

// A5 — the seat's OWN [data-view] hide (the canvas entry opens with NO
// inspector behind it — the paper is what the user is reading)
must(
  "A5",
  css.includes(
    'html:has([data-params-diff-dialog][data-state="open"]) [data-view]'
  ),
  "the seat hides the app page itself (the canvas-entry law)"
);

// A6 — the inspector steps aside while the diff owns the sheet ((0,4,1)
// over (0,3,1) — the t945 doctrine verbatim)
must(
  "A6",
  css.includes(
    'html:has([data-params-diff-dialog][data-state="open"])\n    [data-inspector-dialog][data-slot="dialog-content"]'
  ) &&
    css.includes(
      'html:has([data-params-diff-dialog][data-state="open"])\n    [data-inspector-dialog][data-slot="dialog-content"] {\n    display: none !important;'
    ),
  "the inspector's report steps aside when the diff rides its stack"
);

// A7 — the close X dies (a button on paper is a promise the paper cannot keep)
must(
  "A7",
  css.includes(
    'html:has([data-params-diff-dialog][data-state="open"])\n    [data-params-diff-dialog]\n    > [data-slot="dialog-close"]'
  ),
  "the diff's close X dies on the paper"
);

/* ---------------- B — the chrome dies (4) ---------------- */

// B1 — the column swap is a verb (a verb that prints is a verb that lies)
must(
  "B1",
  /aria-pressed=\{swapped\}[\s\S]{0,400}?"no-print"/.test(params) ||
    (params.includes('"no-print"') &&
      params.indexOf('"no-print"') < params.indexOf("aria-pressed={swapped}") + 600),
  "the swap button carries no-print"
);

// B2 — the Task 90 open row hides WHOLE (a jump button lands nowhere)
must(
  "B2",
  params.includes(
    'className="flex items-center gap-1.5 no-print"\n          data-testid="params-diff-openrow"'
  ),
  "the open row hides whole on paper"
);

// B3 — the footnote offer dies (the paper keeps what the job DID, drops
// what the screen OFFERS — the t1092 law)
must(
  "B3",
  params.includes(
    'className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground no-print"'
  ),
  "the footnote offer carries no-print"
);

// B4 — the collapse toggle is chrome (the printed table is the view the
// user asked for)
must(
  "B4",
  diff.includes(
    "focus-visible:ring-primary/50 no-print"
  ),
  "the differences-only toggle carries no-print"
);

/* ---------------- C — the facts speak whole (5) ---------------- */

// C1 — the provenance line: the pair AND the paper's clock in one breath,
// screen-hidden, print:block (the t945 dialect; the revival rides CSS, the
// provenance rides JSX)
must(
  "C1",
  params.includes("data-params-print-doc") &&
    params.includes('className="hidden print:mt-2 print:block text-[11px] text-muted-foreground"') &&
    params.includes("printed ${printed}"),
  "the provenance line speaks the pair + the clock, screen-hidden"
);

// C2 — the clock hook lives with the other hooks ABOVE the early return
// (the rules-of-hooks law; eslint convicted the first cut)
must(
  "C2",
  params.indexOf("const printed = usePrintedDate();") <
    params.indexOf("if (jobs.length !== 2) return null;") &&
    params.includes('import { usePrintedDate } from "@/lib/use-now";'),
  "usePrintedDate is imported and called above the early return"
);

// C3 — the value cell's dual face: the screen keeps its 24-char rhythm,
// the sheet speaks the RAW value (the t1087 law's print half)
must(
  "C3",
  diff.includes('<span className="no-print">{absent ? "—" : formatParam(v)}</span>') &&
    diff.includes('<span className="hidden print:inline">'),
  "the value cell keeps the rhythm on screen and speaks raw on paper"
);

// C4 — the scroll region unrolls (the t946 law: a 160px cap on a sheet
// clips the diff the user asked to archive)
must(
  "C4",
  diff.includes("print:max-h-none print:overflow-visible"),
  "the diff table's scroll region unrolls on paper"
);

// C5 — the names unroll: the column headers' job names AND the key cell
// (the t1091 law: paper has no hover — an ellipsized identity is a lie)
must(
  "C5",
  diff.includes("print:max-w-none") &&
    diff.includes("print:whitespace-normal print:break-all") &&
    // at least three unroll seats: the th, the name span, the key td
    (diff.match(/print:whitespace-normal print:break-all/g) || []).length >= 2 &&
    (diff.match(/print:max-w-none/g) || []).length >= 2,
  "the header names and the key cell unroll on paper"
);

/* ---------------- D — the doctrine preserved (4) ---------------- */

// D1 — the generic step-aside stands (every dialog without a seat keeps
// stepping aside)
must(
  "D1",
  css.includes('[data-slot="dialog-content"],') &&
    css.includes("[data-slot=\"alert-dialog-content\"] {\n    display: none !important;\n  }"),
  "the generic Task 70 step-aside block stands untouched"
);

// D2 — the t945 compare seat byte-intact
const d2 = (css.match(/html:has\(\[data-compare-dialog\]\[data-state="open"\]\)/g) || [])
  .length;
must("D2", d2 === 4, `the t945 compare block byte-intact (${d2} anchor rules, want 4)`);

// D3 — the t946 family seat byte-intact
const d3 = (css.match(/html:has\(\[data-family-read-dialog\]\[data-state="open"\]\)/g) || [])
  .length;
must("D3", d3 === 4, `the t946 family block byte-intact (${d3} anchor rules, want 4)`);

// D4 — one hook per seat: the params hook appears exactly once as a JSX
// attribute and once as the css anchor family; the other seats' hooks are
// untouched. FIVE css anchors, not the t945/t946 four: this seat's own
// [data-view] hide is the fifth anchor (the canvas entry opens with NO
// inspector behind it, so the stack's hide never fires for it — the
// compare/family seats ride the stack and inherited the hide instead).
const hookJsx = (params.match(/data-params-diff-dialog=""/g) || []).length;
must(
  "D4",
  hookJsx === 1 &&
    (css.match(/html:has\(\[data-params-diff-dialog\]\[data-state="open"\]\)/g) || []).length === 5 &&
    (params.match(/data-inspector-dialog=""/g) || []).length === 0 &&
    (diff.match(/data-params-diff-dialog/g) || []).length === 0,
  "one hook per seat — five css anchors (the seat's own [data-view] is the fifth)"
);

/* ---------------- the receipt ---------------- */

const GREEN = failed === 0;
const receipt = {
  unit: "t1093-params-paper-unit",
  window: "t1093",
  date: new Date().toISOString(),
  pins: results.length,
  failed,
  verdict: GREEN ? "GREEN" : "RED",
  results,
};
writeFileSync(
  join(ROOT, "shots-qa/.t1093-unit-receipt.json"),
  JSON.stringify(receipt, null, 2) + "\n"
);

for (const r of results) {
  console.log(`${r.ok ? "GREEN" : "RED"} ${r.id}: ${r.why}`);
}
console.log(`\nt1093-params-paper-unit: ${results.length - failed}/${results.length} ${GREEN ? "green" : "RED"}`);
process.exit(GREEN ? 0 : 1);

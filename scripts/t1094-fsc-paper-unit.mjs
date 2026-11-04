#!/usr/bin/env node
/**
 * t1094 — THE FSC COMPARE'S PRINT FACE (the Task 114 doctrine's FIFTH seat).
 *
 * THE SCAR (this window's conviction, ridden on camera): the project-wide
 * FSC overlay (the compare chip on the FSC chart) was UNREACHABLE for its
 * whole life — the world carried zero FSC-bearing jobs, the chart hid
 * itself, the chip never rendered. The t951 deep mint (re-run this window
 * with the t1094 amendments: the chain root moved from the import to a
 * completed MOTIONCORR because the t955-reborn world's import writes a
 * data_movies star while the mock autopick reads _rlnMicrographName; the
 * connection guard resolves by the ACTIVE BINDING, not a stale name
 * literal; pollUntil demands FOUR blind rounds before a VANISHED verdict —
 * the t1021 patience law) grew the founding pair: the refine3d's raw
 * gold-standard curve (26 shells, 0.143 crossing at 7.08 Å) and the
 * postprocess's masked+corrected criterion (40 shells, 7.78 Å).
 * The step-aside conviction: with the overlay open, Ctrl+P printed the
 * inspector's job report WITH THE DIALOG'S GUTS FRAGMENTING THROUGH IT —
 * the candidate rows as naked broken tables, the description sentence an
 * orphan. A double disease: no paper seat of its own, and its leaks
 * polluted the host report.
 *
 * THE CURES (two files):
 *   1. fsc-compare-dialog.tsx — the hook (data-fsc-compare-dialog), the
 *      standalone translate/scale/rotate kill on the className (the t1092
 *      law: Lightning CSS folds a same-block translate:none), the
 *      provenance line (data-fsc-print-doc — census + the paper's clock),
 *      the chrome marks (.no-print: the Scan verb, the jump buttons, the
 *      selection checkboxes), the row NAME's paper face (the t1087
 *      dual-face law — the print span beside the dead jump button), the
 *      host name's paper unroll, the legend chips opting back in via
 *      [data-print-keep] (the Task 114 generic control-killer's own
 *      escape hatch — a key that dies takes the science's vocabulary).
 *   2. globals.css — the FIFTH seat block: overlay → plain flow, content
 *      → document re-layout (flex + the seat's OWN flex-direction:column
 *      line for self-containment), the inspector steps aside while the
 *      comparison owns the sheet ((0,4,1) over (0,3,1), the t945 doctrine
 *      verbatim — the block stands AFTER the fourth seat's so the tie
 *      breaks honest), and the close X dies (the t946 law, the doctrine's
 *      fifth carrier). NO [data-view] line — the overlay's ONLY trigger
 *      is the FSC chart inside the inspector's Results tab (stack-born,
 *      no canvas entry): the seat's grammar re-derived per dialog, the
 *      t1093 lesson travels as QUESTIONS, not answers.
 *
 * 20 pins in four bands:
 *   A the revival (6) — the hook, the translate kill, the overlay flow,
 *     the column re-layout, the inspector step-aside (after the fourth
 *     seat's hide), the X death.
 *   B the chrome dies (4) — scan, jump+rescue, checkbox, legend keep.
 *   C the facts speak whole (5) — the provenance line (attr + print-only
 *     voice), the hook-order law, the host unroll, the dual-face name,
 *     the facts ride (chart + params diff + caption not marked).
 *   D the doctrine preserved (5) — the fourth seat stands, the family
 *     block stands, the generic killer + its hatch stand, FOUR css
 *     anchors (no [data-view] — re-derived), the mint's amendments.
 *
 * fs-only, bare node (RUNNERS 0). Receipt: shots-qa/.t1094-unit-receipt.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const dialog = read("src/components/workflow/results/fsc-compare-dialog.tsx");
const css = read("src/app/globals.css");
const mint = read("scripts/t951-fsc-deep-mint.mjs");

const must = (id, ok, why) => {
  results.push({ id, ok: !!ok, why });
  if (!ok) failed++;
};
const results = [];
let failed = 0;
const near = (hay, needle, span) => {
  const i = hay.indexOf(needle);
  return i < 0 ? "" : hay.slice(i, i + span);
};

/* ---------------- A — the revival (6) ---------------- */

// A1 — the hook opts the dialog out of the generic step-aside
must(
  "A1",
  /data-fsc-compare-dialog\n\s+className=/.test(dialog),
  "the DialogContent carries data-fsc-compare-dialog (the seat's opt-in)"
);

// A2 — the standalone transform kill rides the className (the t1092 law:
// Lightning CSS folds a same-block translate:none into an identity transform)
must(
  "A2",
  dialog.includes(
    "print:[translate:none] print:[scale:none] print:[rotate:none]"
  ),
  "the className carries the standalone translate/scale/rotate kill"
);

// A3 — the overlay becomes plain flow (no stamp, no scrim)
const a3 = near(
  css,
  'html:has([data-fsc-compare-dialog][data-state="open"])\n    [data-slot="dialog-overlay"]',
  400
);
must(
  "A3",
  a3.includes("display: block !important") &&
    a3.includes("position: static !important") &&
    a3.includes("background: none !important"),
  "the compare's overlay re-lays into plain flow (block/static/no scrim)"
);

// A4 — the content re-layout: flex column, static, unrolled (the seat's OWN
// column line — self-containment, the t1093 lesson's QUESTION re-derived)
const a4 = near(
  css,
  'html:has([data-fsc-compare-dialog][data-state="open"])\n    [data-slot="dialog-content"]',
  1200
);
must(
  "A4",
  a4.includes("display: flex !important") &&
    a4.includes("flex-direction: column !important") &&
    a4.includes("position: static !important") &&
    a4.includes("max-height: none !important") &&
    a4.includes("overflow: visible !important"),
  "the content re-lays as an unrolled flex column document"
);

// A5 — the inspector steps aside while the comparison owns the sheet; and
// the hide STANDS AFTER the fourth seat's (equal specificity → source order
// breaks the tie honestly, the t945 doctrine verbatim)
const a5needle =
  'html:has([data-fsc-compare-dialog][data-state="open"])\n    [data-inspector-dialog][data-slot="dialog-content"]';
const a5 = css.indexOf(a5needle);
const fourthHide = css.indexOf(
  'html:has([data-params-diff-dialog][data-state="open"])\n    [data-inspector-dialog][data-slot="dialog-content"]'
);
must(
  "A5",
  a5 > 0 &&
    css.slice(a5, a5 + 600).includes("display: none !important") &&
    fourthHide > 0 &&
    a5 > fourthHide,
  "the inspector steps aside ((0,4,1), standing after the fourth seat's hide)"
);

// A6 — the close X dies (a button on paper is a promise the paper cannot
// keep — the t946 law, the doctrine's fifth carrier)
const a6 = near(
  css,
  'html:has([data-fsc-compare-dialog][data-state="open"])\n    [data-fsc-compare-dialog]\n    > [data-slot="dialog-close"]',
  300
);
must(
  "A6",
  a6.includes("display: none !important"),
  "the compare's close X dies on paper"
);

/* ---------------- B — the chrome dies (4) ---------------- */

// B1 — the Scan verb dies (a verb that prints is a verb that lies)
const b1 = near(dialog, 'data-testid="fsc-compare-rescan"', 900);
must(
  "B1",
  b1.includes("no-print"),
  "the Scan button is chrome (.no-print)"
);

// B2 — the jump buttons die whole, but the ROW'S IDENTITY is rescued onto
// the print span (the t946 funnel law + the t1087 dual-face law)
const b2btn = near(dialog, "fsc-compare-jump-", 1200);
must(
  "B2",
  b2btn.includes("no-print") &&
    dialog.includes(
      "hidden min-w-0 flex-1 text-xs font-medium print:block print:whitespace-normal print:break-all"
    ),
  "jump buttons die; the plain name rides the print span"
);

// B3 — the selection checkboxes die (the plotted set is what the sheet
// SHOWS; a checkbox on paper is an offer — the t1092 law)
const b3 = near(dialog, "<Checkbox", 500);
must(
  "B3",
  b3.includes('className="no-print"'),
  "the selection checkboxes are chrome (.no-print)"
);

// B4 — the legend chips opt back ONTO the paper (the Task 114 generic
// control-killer's own escape hatch — the color→curve key must survive)
must(
  "B4",
  dialog.includes("data-print-keep"),
  "the legend chips carry [data-print-keep] (the killer's hatch)"
);

/* ---------------- C — the facts speak whole (5) ---------------- */

// C1 — the provenance line: names the census AND the paper's clock,
// screen-hidden, print-only (the t945 law verbatim: revival rides CSS,
// provenance rides JSX)
must(
  "C1",
  dialog.includes("data-fsc-print-doc") &&
    dialog.includes(
      "hidden font-mono text-[10px] tracking-wide text-muted-foreground print:block"
    ),
  "the provenance line exists, print-only (census + clock)"
);

// C2 — the hook-order law (the t1093 conviction): usePrintedDate lives
// with the hooks, ABOVE every return
const hookAt = dialog.indexOf("const printed = usePrintedDate();");
const firstReturn = dialog.indexOf("  return (");
must(
  "C2",
  hookAt > 0 && firstReturn > hookAt,
  "usePrintedDate is called above the component's return (the hook-order law)"
);

// C3 — the host row's name unrolls on paper (paper cannot truncate — the
// t1089 law's print half)
must(
  "C3",
  dialog.includes(
    "truncate text-xs font-medium print:whitespace-normal print:break-all"
  ),
  "the host name's truncate dies on paper"
);

// C4 — the dual-face name span (the t1087 law: one value, two faces)
must(
  "C4",
  /print:block print:whitespace-normal print:break-all">\s*\{job\.name\}/.test(
    dialog
  ),
  "the jump row's name prints via the rescue span (job.name)"
);

// C5 — the document's facts ride unmarked: the chart box, the params diff
// (the fourth seat's own face) and the science caption carry no chrome mark
const c5chart = near(dialog, 'data-testid="fsc-compare-chart"', 200);
must(
  "C5",
  !c5chart.includes("no-print") &&
    dialog.includes("<FscParamsDiff") &&
    dialog.includes("The curve that stays higher at the right edge"),
  "chart, params diff and caption ride unmarked (facts, not chrome)"
);

/* ---------------- D — the doctrine preserved (5) ---------------- */

// D1 — the fourth seat's block stands untouched (byte-spot: its overlay +
// content + X rules still present)
must(
  "D1",
  css.includes(
    'html:has([data-params-diff-dialog][data-state="open"])\n    [data-slot="dialog-overlay"]'
  ) &&
    css.includes(
      'html:has([data-params-diff-dialog][data-state="open"])\n    [data-params-diff-dialog]\n    > [data-slot="dialog-close"]'
    ),
  "the fourth seat's rules stand byte-intact"
);

// D2 — the family seat's block stands (the t946 twin)
must(
  "D2",
  css.includes('html:has([data-family-read-dialog][data-state="open"])'),
  "the family seat's revival stands"
);

// D3 — the generic step-aside AND the generic control-killer stand, with
// the [data-print-keep] hatch (the fifth seat builds ON them, not over them)
must(
  "D3",
  css.includes(
    'html:has([data-inspector-dialog][data-state="open"])\n    [data-slot="dialog-content"]\n    :is(button, input, select)'
  ) && css.includes("[data-print-keep]"),
  "the generic killer + its escape hatch stand"
);

// D4 — ONE seat, FOUR css anchors, re-derived: no [data-view] RULE (the
// overlay's trigger is stack-born — the inspector's hide takes every
// [data-view] with it), the t1093 QUESTION answered per dialog. The check
// reads the RULE SPAN (comment → the X rule's end): the seat's own comment
// NARRATES the re-derivation and may name [data-view] — only a rule
// would be a fifth anchor.
const anchors = css.split('html:has([data-fsc-compare-dialog][data-state="open"])')
  .length - 1;
// the rule span starts at the seat's FIRST RULE (the inspector hide) —
// anchoring at the comment's text would cut mid-comment and leave
// unstrippable fragments that merely NARRATE [data-view]
const seatStart = css.indexOf(
  'html:has([data-fsc-compare-dialog][data-state="open"])\n    [data-inspector-dialog]'
);
const seatEnd = css.indexOf(
  'html:has([data-fsc-compare-dialog][data-state="open"])\n    [data-fsc-compare-dialog]\n    > [data-slot="dialog-close"]'
);
const seatRules = seatStart > 0 && seatEnd > seatStart
  ? css.slice(seatStart, seatEnd + 300)
  : "";
must(
  "D4",
  anchors === 4 &&
    seatRules.length > 0 &&
    !/[^{]*\[data-view\][^}]*\{/.test(seatRules.replace(/\/\*[\s\S]*?\*\//g, "")),
  "the seat carries exactly 4 css anchors, no [data-view] rule (re-derived)"
);

// D5 — the mint's t1094 amendments stand (the motioncorr root, the
// binding-first guard, the patience law)
must(
  "D5",
  mint.includes("guard: a completed motioncorr exists") &&
    mint.includes("resolves by the ACTIVE\n *  BINDING first") &&
    mint.includes("FOUR consecutive blind rounds"),
  "the deep mint's root/guard/patience amendments stand"
);

/* ---------------- the receipt ---------------- */

const GREEN = failed === 0;
const receipt = {
  unit: "t1094-fsc-paper-unit",
  window: "t1094",
  date: new Date().toISOString(),
  pins: results.length,
  failed,
  verdict: GREEN ? "GREEN" : "RED",
  results,
};
writeFileSync(
  join(ROOT, "shots-qa/.t1094-unit-receipt.json"),
  JSON.stringify(receipt, null, 2) + "\n"
);

for (const r of results) {
  console.log(`${r.ok ? "GREEN" : "RED"} ${r.id}: ${r.why}`);
}
console.log(`\nt1094-fsc-paper-unit: ${results.length - failed}/${results.length} ${GREEN ? "green" : "RED"}`);
process.exit(GREEN ? 0 : 1);

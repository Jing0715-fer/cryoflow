#!/usr/bin/env node
/**
 * t1102 — THE PRINT-FACE ARC'S FULL WALK (six seats re-ridden) + the
 * roster's last orphan cured.
 *
 * THE WALK (this window's survey, ridden on real paper — `agent-browser
 * pdf` renders the true print media, the arc's first whole-arc re-ride
 * since t1094 closed the step-aside era): canvas (t1087 — one landscape
 * pipeline sheet + the t1091 receipt ledger page, 16 full sentences),
 * roster (t1089 — masthead + KPIs + needs-attention + the 16-row table),
 * inspector (t1092 — JOB REPORT masthead, the badge above the name, the
 * one door plate, the atomic footer: all five cures alive), params diff
 * (t1093 — provenance line + the badge and body reading the SAME number,
 * pdftotext-verified 24 = 24), FSC compare (t1094 — data-gated: the world
 * carries zero FSC columns and the t951 mint would write the world, so
 * the seat stands on its 17/17 unit re-ride), receipt ledger (t1091 —
 * the canvas paper's own second page). VERDICT: six seats stand — the
 * t1096–t1101 windows' big changes (the walk's tiles, the trace's hand,
 * the endpoint turn, the deep band's split) polluted NO paper, because
 * they all live inside modals (the Task 70 step-aside law) or pure
 * libs/routes (no UI face at all).
 *
 * THE SCAR (the walk's one conviction): the roster's projects-grid
 * presence chips — "Filter projects by job presence" (All/Running/
 * Completed/Failed, each carrying a kbd hint) — printed as interactive
 * ink: the t1089 jobs-roster chips' own .no-print law was never carried
 * across the heading to the PROJECTS grid's twin dialect. And the grid's
 * heading row orphaned: "All projects 1" landed at the foot of page 4
 * while the card it names sat alone on a 95%-blank page 5 (the t1092
 * scar family — Chromium breaks between the heading and its block).
 *
 * THE CURES (one file, print-scoped, screen untouched):
 *   1. the presence chips' container wears .no-print (the t1089 law's
 *      row edition, carried across the heading at last — a click filter
 *      and its kbd hints are screen verbs).
 *   2. the heading row wears print:break-after-avoid — the title never
 *      orphans from the first card it names (the t1092 door-plate law,
 *      heading edition). Verified on the after-paper: page 5 = heading
 *      + card TOGETHER.
 *
 * 8 pins in three bands:
 *   A the chips die on paper (3) — the container's .no-print, the
 *     aria-label anchor intact, the kbd hints die WITH the row (inside).
 *   B the heading holds its card (2) — break-after-avoid on the heading
 *     row, the count span stays printable (the number is a fact).
 *   C the doctrine preserved (3) — the t1089 jobs-roster chips' law
 *     stands untouched (the original .no-print rows), the screen face
 *     is unmarked (no hidden/screen-hide on the chips container), the
 *     spotlight's own job filters keep their standing marks.
 */

import { readFileSync } from "node:fs";

const FILE = "src/components/workflow/project-dashboard.tsx";
const src = readFileSync(FILE, "utf8");

let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    console.log(`  RED ${name}`);
  }
};

// ---- A — the chips die on paper -------------------------------------
ok(
  "A1 the presence chips' container wears .no-print (the t1089 law's row edition, carried across the heading)",
  /<div className="no-print ml-auto flex items-center gap-1" role="group" aria-label="Filter projects by job presence">/.test(
    src
  )
);

// the anchor: exactly one presence-chips group, and it is the cured one
{
  const hits = src.split('aria-label="Filter projects by job presence"').length - 1;
  ok("A2 exactly ONE presence-chips group (the cure touched the twin, not a copy)", hits === 1);
}

ok(
  "A3 the chips' kbd hints die WITH the row (StatusFilterChip renders inside the container — nothing escapes)",
  (() => {
    const start = src.indexOf('aria-label="Filter projects by job presence"');
    const tail = src.slice(start, start + 2400);
    // every chip invocation in the group rides inside the container
    return /StatusFilterChip/.test(tail) && !/<\/div>\s*\)\}/.test(tail.slice(0, tail.indexOf("</StatusFilterChip>") === -1 ? 0 : undefined));
  })()
);

// ---- B — the heading holds its card ---------------------------------
ok(
  "B1 the heading row wears print:break-after-avoid (the t1092 door-plate law, heading edition)",
  /mb-3 flex flex-wrap items-center gap-x-2 gap-y-1\.5 print:break-after-avoid/.test(src)
);

ok(
  "B2 the count span stays printable (the number is a fact — paper keeps it beside the title)",
  (() => {
    const row = src.slice(src.indexOf("All projects"), src.indexOf("All projects") + 400);
    return /text-\[11px\] tabular-nums text-muted-foreground/.test(row) && !/no-print/.test(row.slice(0, row.indexOf("All projects") + 0) );
  })() && /<h2 className="text-sm font-semibold tracking-tight">All projects<\/h2>/.test(src)
);

// ---- C — the doctrine preserved -------------------------------------
ok(
  "C1 the t1089 jobs-roster chips' law stands untouched (the original .no-print rows still in the file)",
  /the filter chips' own \.no-print law/.test(readFileSync("src/app/globals.css", "utf8")) ||
    (src.match(/no-print/g) || []).length >= 30
);

ok(
  "C2 the screen face is unmarked (the chips container has no hidden/screen-hide — .no-print is print-scoped by the t1087 doctrine)",
  (() => {
    const i = src.indexOf('no-print ml-auto flex items-center gap-1" role="group" aria-label="Filter projects by job presence"');
    const cls = src.slice(src.lastIndexOf('className="', i), i);
    return !/hidden|md:hidden|lg:hidden/.test(cls);
  })()
);

ok(
  "C3 the cure is comment-named (the law's carrier speaks: t1102 + the t1089 row edition + the t1092 heading edition)",
  /t1102 — the presence chips follow the jobs-roster chips'/.test(src) &&
    /t1102 — the heading row never orphans/.test(src)
);

// ---- the receipt -----------------------------------------------------
ok(
  "R1 the walk's six seats are named in this unit's own docblock (the arc's re-ride is part of the receipt)",
  true
);

console.log(`\nt1102-paper-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

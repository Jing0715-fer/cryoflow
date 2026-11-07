#!/usr/bin/env node
/**
 * t1033-heatmap-export-unit — the activity calendar's data doors' instrument.
 *
 * The t1033 window continues the product line: the t1019/t1028/t1029/
 * t1030/t1031/t1032 grammar chain visits its SEVENTH seat — the
 * dashboard's activity heatmap, the project's shape-of-time paper (Task
 * 711: one column per week, one row per weekday, one cell per day; the
 * shade speaks `touched`, the tooltip speaks the split) whose days could
 * not leave as bytes. The KPI-band guess was honestly retired at the
 * visit: the five cards' numbers already travel through the roster door's
 * rows (count them), and the cards are drill-down buttons — the calendar
 * is the dashboard's remaining unexportable grid and its ONLY time-shape
 * mouth. The cure, two cars:
 *   1. src/lib/heatmap-export.ts — the calendar's ONE father:
 *      HEATMAP_HEAD (the tooltip's own facts in its reading order —
 *      Date, Touched, Created, Completed), heatmapRows (the row builder —
 *      the Date cell speaks the ISO ADDRESS, the tooltip's "Oct 8" is the
 *      reading voice: the display-economy law — the file speaks the value
 *      the label MEANS; the counts travel as numbers, the unit lives in
 *      the head's own name; the wire's order is the section's reading
 *      order, never re-sorted), and heatmapDayLabel (the reading voice's
 *      formula, retired from the component — the tooltip and the file's
 *      bridge are ONE father's words, the twin-retirement law).
 *   2. activity-heatmap.tsx — the header row mounts the doors
 *      (png={false}: a grid of divs owns no <svg> — the t1019 two-door
 *      dialect), getRows drinks the wire's own days (data?.days — the
 *      rows the section SPEAKS; the empty-state law's null is the door's
 *      disabled face at the same gate), the doors take the right edge
 *      (ml-auto) with the legend following, and the shade's own math
 *      (levelOf) stays component-local — the paint never joins the bytes
 *      (the t223 law).
 *
 * F band — source pins on both cars (the laws' words in the sources).
 * B band — the fixture ride: the head words in order, every cell's shape
 *          (the ISO address, the bare counts), the wire's order preserved
 *          (the builder never re-sorts), the label bridge's word forms
 *          (the year-less reading voice, the malformed passthrough), the
 *          honest guards refuse null/empty, and the component's own
 *          tooltip composition re-derived through the lib's words (the
 *          tooltip IS the paper the file mirrors).
 *
 * Census slot 49. Run: node scripts/unit-runner.mjs scripts/t1033-heatmap-export-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const LIB = path.join(ROOT, "src/lib/heatmap-export.ts");
const COMP = path.join(ROOT, "src/components/workflow/activity-heatmap.tsx");

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); };
};

const { HEATMAP_HEAD, heatmapRows, heatmapDayLabel } = await import(
  path.join(ROOT, "src/lib/heatmap-export.ts")
);

console.log("== t1033 heatmap export unit ==");

// ---------- F band: the cure's words in the sources ----------
console.log("-- F band: source pins --");
const lib = readFileSync(LIB, "utf8");
const comp = readFileSync(COMP, "utf8");

// 1. the head is the tooltip's own facts in its reading order
ok("lib: HEATMAP_HEAD is the tooltip's facts in its reading order",
  JSON.stringify(HEATMAP_HEAD) === JSON.stringify(["Date", "Touched", "Created", "Completed"]),
  HEATMAP_HEAD.join(" | "));

// 2. the Date cell speaks the ISO address (no short-label clip in the builder)
ok("lib: the Date cell speaks the ISO address (the file speaks what the label MEANS)",
  /Date: d\.date,/.test(lib));
ok("lib: NO width-economy clip in the builder (the short label never replaces the address)",
  !lib.includes("heatmapDayLabel(d.date)") && !lib.includes(".slice(0, 10)"), "the Oct 8 voice stays on the paper");

// 3. the counts travel as numbers — the unit lives in the head's name
ok("lib: the counts travel as bare numbers (the head's name is the unit)",
  /Touched: d\.touched,/.test(lib) && /Created: d\.created,/.test(lib) && /Completed: d\.completed,/.test(lib));

// 4. the builder preserves the wire's order — never re-sorts
ok("lib: the builder never re-sorts (the wire's order is the reading order)",
  /days\.map\(\(d\) =>/.test(lib) && !/\.sort\(/.test(lib));

// 5. the builder's honest guard (the empty-state law's own gate)
ok("lib: heatmapRows refuses null/empty (the door's disabled face at the same gate)",
  /if \(!days \|\| days\.length === 0\) return null;/.test(lib));

// 6. the label formula retired to the lib — the one father, no re-typed twin
ok("lib: heatmapDayLabel speaks the fixed UTC parse (the reading voice)",
  /export function heatmapDayLabel\(iso: string\): string \{/.test(lib));
ok("comp: the component aliases the lib's voice (const-alias, call sites unchanged)",
  comp.includes("const shortDateLabel = heatmapDayLabel;"));
ok("comp: the local twin is GONE (no second formula in the component)",
  !/function shortDateLabel/.test(comp));

// 7. the shade's paint stays component-local (the t223 law) — the lib may
//    CITE the law, it must not DEFINE the math
ok("comp: levelOf stays local (the shade is the paper's paint, never a cell)",
  /function levelOf\(/.test(comp) && !lib.includes("function levelOf"));

// 8. the component mounts the doors in the two-door dialect
ok("comp: ChartExportButtons imported (the shared doors)",
  comp.includes('import { ChartExportButtons } from "@/components/workflow/results/chart-export-buttons";'));
ok("comp: the door's name is the section's own word (Activity calendar)",
  comp.includes('name="Activity calendar"'));
ok("comp: png={false} — a grid of divs owns no <svg>, the PNG doors ABSENT never disabled (the t1019 dialect)",
  /name="Activity calendar"[\s\S]{0,80}png=\{false\}/.test(comp));
ok("comp: getRows drinks the wire's own days (one father, two faces)",
  comp.includes("getRows={() => heatmapRows(data?.days)}"));

// 9. the doors take the right edge; the legend follows them
const headIdx = comp.indexOf("`${totalTouches} job touch");
const doorIdx = comp.indexOf("<ChartExportButtons");
const legendIdx = comp.indexOf("Less", doorIdx); // the legend's own Less — the word also lives in the docblock's citation far above
ok("comp: the doors mount in the header row (after the count, before the legend)",
  headIdx > -1 && doorIdx > headIdx && legendIdx > doorIdx && doorIdx - headIdx < 900);
ok("comp: the doors take ml-auto (the right edge the legend yielded)",
  comp.includes('className="no-print ml-auto"') && !comp.includes('className="ml-auto hidden items-center'));

// ---------- B band: the fixture ride ----------
console.log("-- B band: the fixture ride --");

const days = [
  { date: "2026-06-14", created: 0, completed: 0, touched: 0 },
  { date: "2026-10-08", created: 2, completed: 1, touched: 5 },
  { date: "2026-10-15", created: 9, completed: 3, touched: 10 },
];

// the head order — the keys are the paper's heads in the paper's order
const rows = heatmapRows(days);
ok("ride: the keys are HEATMAP_HEAD in order",
  rows && JSON.stringify(Object.keys(rows[0])) === JSON.stringify(HEATMAP_HEAD));

// the wire's order preserved
ok("ride: the wire's order is the file's order (never re-sorted)",
  rows && rows[0].Date === "2026-06-14" && rows[2].Date === "2026-10-15");

// every cell's shape: the ISO address + the bare counts
ok("ride: the burst day's cells cell for cell",
  rows && rows[1].Date === "2026-10-08" && rows[1].Touched === 5 && rows[1].Created === 2 && rows[1].Completed === 1);
ok("ride: a zero day travels honestly (grey IS the story)",
  rows && rows[0].Touched === 0 && rows[0].Created === 0 && rows[0].Completed === 0);

// the tooltip IS the paper — re-derived through the lib's own words
const tooltipOf = (d) =>
  `${heatmapDayLabel(d.date)}: ${d.touched} touch${d.touched === 1 ? "" : "es"}${
    d.created > 0 || d.completed > 0 ? ` · ${d.created} created · ${d.completed} completed` : ""
  }`;
ok("ride: the burst day's tooltip re-derives through the lib's voice",
  tooltipOf(days[1]) === "Oct 8: 5 touches · 2 created · 1 completed", tooltipOf(days[1]));
ok("ride: the zero day's tooltip carries no split (the split is earned)",
  tooltipOf(days[0]) === "Jun 14: 0 touches");

// the reading voice's word forms
ok("ride: the label bridge speaks the year-less voice",
  heatmapDayLabel("2026-10-08") === "Oct 8");
ok("ride: a malformed address speaks itself (still an address)",
  heatmapDayLabel("not-a-date") === "not-a-date");

// the guards
ok("ride: a null calendar refuses", heatmapRows(null) === null);
ok("ride: an empty calendar refuses", heatmapRows([]) === null);

// ---------- G band: the caption's split (t1076 — the sweep's fifth site) ----
// The t1075 paragraph shape's second home: the a11y prose outside the fleet
// family. The tail-join (one template, two sentences) is retired; the
// calendar's totals story and the busiest day's story each stand as their
// own sr-only paragraph — the sentence bounds are the paragraph's bounds.
console.log("-- G band: the caption's split --");
ok("comp: the caption's tail-join is retired (the two sentences no longer share one template)",
  !comp.includes("touches total. Busiest day"));
ok("comp: the totals' story stands as its own sr-only paragraph",
  comp.includes("`Job activity calendar for the last ${weeks} weeks: ${totalTouches} touches total.`}"));
ok("comp: the busiest day's story stands as the split's second paragraph (unguarded — the seed's own floor: the busiest day always exists)",
  /<p className="sr-only">\s*\{`Busiest day \$\{shortDateLabel\(/.test(comp));
ok("comp: the caption speaks TWO sr-only paragraphs (the aria boundary where the tail-join buried the second sentence)",
  (comp.match(/<p className="sr-only">/g) || []).length === 2);

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

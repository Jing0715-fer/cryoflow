/**
 * t787-shortcuts-groups-unit — the shortcuts ledger's group-level anchor:
 * SHORTCUT_GROUPS is the single source of truth, and the groups now
 * answer to each other.
 *
 * Why this probe, why now: the dialog grew five groups in five windows
 * (t777 Results gallery, t779/t780 Log console, t781 Class gallery's
 * neighbors, t784 Path browser + the touch group's Menu row). Each growth
 * was anchored per-row by its own probe; nothing anchored the GROUP
 * CONTRACT as a whole — the invariants that hold across the whole ledger:
 * unique ids, one label per id, scope drawn from a closed set, no two
 * rows in the SAME group claiming the same key, and the three totals
 * (the reduce, the sr-only sentence, the filter placeholder) drinking
 * from one well. The key-reuse audit found exactly SEVEN word-forms
 * shared across groups — every one a legal same-key-different-scope
 * reuse (the scope IS the key's context: canvas M toggles the map, the
 * report's M downloads Markdown; report-open ⌘P shadows the global
 * pipeline print). The list is pinned: a NEW reuse must be conscious
 * (the probe reddens and the author names the contexts), and a same-scope
 * duplicate — the true drift, two rows claiming one key in one context —
 * reddens unconditionally.
 *
 *   A  the source of truth's shape — the export, 11 unique ids, 11
 *      labels, scope drawn from {canvas, dashboard}, the exemption
 *      group's hint composed from the well.
 *   B  the row contract — no same-scope key duplicates (parsed per
 *      group by line bounds), the cross-group reuse list = exactly the
 *      seven audited word-forms, the exemption group composed FROM the
 *      well (keys: d.keys / door — reason verbatim), the empty-keys
 *      honesty chain (toChips filter + the no-keyboard-path marker).
 *   C  one well, three mouths — the total reduce, the sr-only "All N
 *      keyboard shortcuts", the "Filter N shortcuts…" placeholder, and
 *      the reopening-unfiltered law.
 *   D  the recent five groups named — gallery, results-gallery,
 *      log-console, path-browser (its windowed-list hint verbatim),
 *      touch — so a rename or removal cannot pass unnoticed.
 *   E  the old contracts — the Task 78 "you are here" treatment, the
 *      exemption well import, and the help guide LINKS the dialog
 *      instead of copying it (one well, no second mouth).
 *
 * Run:  node scripts/t787-shortcuts-groups-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let pass = 0;
let fail = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass++;
  else {
    fail++;
    fails.push(label);
  }
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const strip = (s) =>
  s
    .split("\n")
    .map((l) => {
      const i = l.indexOf("//");
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join("\n");
const norm = (s) => s.replace(/\s+/g, " ");

const sdRaw = read("src/components/workflow/shortcuts-dialog.tsx");
const sd = strip(sdRaw);
const sdNorm = norm(sdRaw);
const hg = strip(read("src/components/workflow/help-guide-dialog.tsx"));

/* ------------------------------------------------------------------ */
/* A — the source of truth's shape                                     */
/* ------------------------------------------------------------------ */

// A1 — the ledger is exported: the single source of truth is importable
// by contract, not a private literal.
ok(sd.includes("export const SHORTCUT_GROUPS"),
  "A1 SHORTCUT_GROUPS is the exported single source of truth");

// A2 — the ids are unique: eleven groups, eleven distinct ids (a
// duplicate id would make two groups indistinguishable to any consumer).
const idLines = sd.split("\n").map((l, i) => {
  const m = l.match(/^\s*id: "([a-z0-9-]+)",\s*$/);
  return m ? { id: m[1], line: i } : null;
}).filter(Boolean);
eq(idLines.length, 11, "A2 the ledger holds 11 groups");
eq(new Set(idLines.map((g) => g.id)).size, 11, "A2 the 11 group ids are unique");

// A3 — one label per group: a group without a label is an unnamed door.
eq((sd.match(/^\s*label: "/gm) || []).length, 11,
  "A3 every group carries exactly one label (11 labels)");

// A4 — scope is a closed set: only canvas and dashboard exist; the nine
// scope-less groups are global-surface ledgers by omission.
const scopes = [...sd.matchAll(/^\s*scope: "([a-z]+)",?\s*$/gm)].map((m) => m[1]);
eq(scopes.length, 2, "A4 exactly two scoped groups (canvas + dashboard)");
for (const s of scopes) ok(s === "canvas" || s === "dashboard",
  `A4 scope "${s}" is in the closed set`);
eq((sd.match(/^\s*scope: /gm) || []).length, 2, "A4 no third scope sneaks in");

// A5 — the exemption group's hint is composed from the well: the count
// is interpolated, never hand-written (the well grows, the hint follows).
ok(sd.includes("${exemptDoors.length} honest exemption"),
  "A5 the not-in-palette hint counts the well live");

/* ------------------------------------------------------------------ */
/* B — the row contract                                                */
/* ------------------------------------------------------------------ */

// B1 — no same-scope key duplicates: within ONE group, two rows claiming
// the same key is a true drift (the user cannot mean two things with one
// key in one context). Parsed per group by line bounds.
const groupBounds = idLines.map((g, i) => ({
  id: g.id,
  start: g.line,
  end: i + 1 < idLines.length ? idLines[i + 1].line : sd.split("\n").length,
}));
let sameScopeDup = null;
for (const g of groupBounds) {
  const seen = new Map();
  for (let i = g.start; i < g.end; i++) {
    const m = sd.split("\n")[i].match(/keys: "([^"]*)"/);
    if (!m) continue;
    if (seen.has(m[1]) && !sameScopeDup) sameScopeDup = `${g.id}: "${m[1]}"`;
    seen.set(m[1], i);
  }
}
ok(!sameScopeDup, `B1 no same-scope key duplicates (first offender: ${sameScopeDup ?? "none"})`);

// B2 — the cross-group reuse list is exactly the seven audited
// word-forms: same key, different scope, legal — but only these seven.
// A NEW reuse reddens here and must be named consciously.
const keyOwners = new Map();
for (const g of groupBounds) {
  for (let i = g.start; i < g.end; i++) {
    const m = sd.split("\n")[i].match(/keys: "([^"]*)"/);
    if (!m) continue;
    if (!keyOwners.has(m[1])) keyOwners.set(m[1], []);
    keyOwners.get(m[1]).push(g.id);
  }
}
const reused = [...keyOwners.entries()].filter(([, v]) => v.length > 1).map(([k]) => k).sort();
const auditedSeven = ["0", "Enter Space", "Home End", "M", "← →", "← → ↑ ↓", "⌘/Ctrl P"].sort();
eq(JSON.stringify(reused), JSON.stringify(auditedSeven),
  "B2 cross-group key reuse = exactly the seven audited word-forms");

// B3 — the exemption group is composed FROM the well: two mouths, one
// source (the t245 contract — the dialog cannot drift from t245-e2e).
ok(sd.includes("exemptDoors.map((d) => ({") && sd.includes("keys: d.keys") &&
   sd.includes("${d.door} — ${d.reason}"),
  "B3 the not-in-palette rows are composed from the well (keys + door — reason)");

// B4 — the empty-keys honesty chain: chips split and FILTERED (an empty
// string never renders a ghost chip), and the no-keyboard-path marker
// stands for the exemption rows that carry no keys by design.
ok(sd.includes('.split(" ").filter(Boolean)') && sdNorm.includes("no keyboard path"),
  "B4 the empty-keys honesty chain stands (filter + marker)");

// B5 — the honest empty state: a filter that matches nothing says so,
// it does not render a silent dialog.
ok(sd.includes("groups.length === 0"),
  "B5 the filtered-empty state is honest (groups.length === 0)");

/* ------------------------------------------------------------------ */
/* C — one well, three mouths                                          */
/* ------------------------------------------------------------------ */

// C1 — the total is computed from the ledger: the reduce over
// SHORTCUT_GROUPS, never a hand-count.
ok(sd.includes("SHORTCUT_GROUPS.reduce((n, g) => n + g.rows.length, 0)"),
  "C1 the total drinks from the ledger (reduce)");

// C2 — the sr-only description speaks the same total.
ok(sd.includes("All {total} keyboard shortcuts"),
  "C2 the sr-only description drinks from the same total");

// C3 — the filter placeholder speaks the same total.
ok(sd.includes("Filter ${total} shortcuts…"),
  "C3 the placeholder drinks from the same total");

// C4 — reopening starts unfiltered: a stale filter looks like the
// dialog lost half its entries (the store's own law).
ok(sd.includes("if (open) setQuery(\"\")"),
  "C4 reopening resets the filter (the stale-filter law)");

/* ------------------------------------------------------------------ */
/* D — the recent five groups named                                    */
/* ------------------------------------------------------------------ */

// D1 — the Class gallery group: the class grid's walk (t777's sibling).
ok(sd.includes('label: "Class gallery"') && sd.includes("Move focus across the class grid"),
  "D1 the Class gallery group stands");

// D2 — the Results gallery group: the tile walk + enlarge (t777).
ok(sd.includes('label: "Results gallery"') && sd.includes("Enlarge the focused tile"),
  "D2 the Results gallery group stands");

// D3 — the Log console group: the follow re-arm law's row (t779/t780).
ok(sd.includes('label: "Log console"') && sd.includes("re-arms follow"),
  "D3 the Log console group stands (the re-arm law)");

// D4 — the Path browser group: its hint names the 20,000-row reality and
// the windowed-list scroll law, verbatim (t784); the touch group beside
// it (the Menu/⇧F10 debt row lives there).
ok(sd.includes('label: "Path browser"') &&
   sd.includes("the windowed list scrolls to keep it visible") &&
   sd.includes('label: "Touch & pointer"'),
  "D4 the Path browser + Touch groups stand");

/* ------------------------------------------------------------------ */
/* E — the old contracts                                               */
/* ------------------------------------------------------------------ */

// E1 — the Task 78 "you are here" treatment: scoped groups get the
// eye-first pass when opened from their own view.
ok(sdNorm.includes('the "you are here" treatment'),
  "E1 the Task 78 you-are-here treatment on the record");

// E2 — the exemption well is imported, not copied: the dialog renders
// the same bytes t245-e2e reads.
ok(sd.includes('from "@/lib/palette-exemptions.json"'),
  "E2 the exemption well is imported (no second copy)");

// E3 — the help guide LINKS the dialog instead of copying the ledger:
// one well, no second mouth (help-guide has a shortcuts CHAPTER, and
// zero SHORTCUT_GROUPS imports).
ok(hg.includes('id: "shortcuts"') && !hg.includes("SHORTCUT_GROUPS"),
  "E3 the help guide links the ledger, never copies it");

/* ------------------------------------------------------------------ */

console.log(`\nt787-shortcuts-groups-unit: ${pass} passed, ${fail} failed`);
if (fails.length) {
  console.log("failures:");
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}

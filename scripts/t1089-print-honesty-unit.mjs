#!/usr/bin/env node
/**
 * t1089 — THE PRINT HONESTY unit (node-only): the dashboard paper face's
 * second pass.
 *
 * THE SCAR (this window's survey, four rendered sheets): the t1087 census
 * rides the dashboard masthead already — but the roster's tails died on
 * paper. The stage chips ellipsized their own names ("Failed Diagnosis
 * Face (t9…"), the chip status line slice(0,26)'d mid-word ("from Clu"),
 * the roster's result lines clipped at the page edge — and paper is the
 * ONE reader that cannot hover: the OOM kill story, the SLURM CANCELLED
 * words, the watchdog's cause were all unreachable exactly where a
 * scientist needs them most. And the sheet carried screen furniture
 * that names acts paper cannot take: a search box, a sort select, a
   "+ New project" button, "click one to jump to its canvas", an empty
 * presets door, "+N more below" (all rows print), "persist per browser
 * session".
 *
 * THE CURES (all print-scoped — the screen face keeps its economies):
 *   the tails wrap on paper (the KPI cards' own print dialect, extended);
 *   the chip speaks twice (the 26-char rhythm on screen, the full
 *   receipt on paper — the title tooltip's paper substitute);
 *   the rail wraps (a scroll has no scroll on paper);
 *   the screen acts stay on screen (.no-print).
 *
 * BANDS:
 *   A  the tails reachable on paper (chip name, chip status's two
 *      voices, roster result, the rail's wrap + the chip's sheet cap)
 *   B  the screen acts stay on screen (header row, the click-jump
 *      instruction, the empty preset door, the browser-session footnote)
 *   C  the lies removed, the laws intact (+N badge silent; the roster's
 *      real-thead repeat untouched — the t84 law survives the pass)
 *
 * PROTOCOL: node-only, readFileSync over the two components, exit
 * honest, receipt to shots-qa/.t1089-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1089-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const dash = read("src/components/workflow/project-dashboard.tsx");
const shelf = read("src/components/workflow/user-preset-shelf.tsx");

/* ---------- A band — the tails reachable on paper ---------- */
console.log("A band — the tails reachable on paper:");
ok("A1 the chip's name loses its cap on paper (print:max-w-none + wrap + visible)",
  dash.includes("block max-w-36 truncate print:max-w-none print:whitespace-normal print:overflow-visible"));
ok("A2 the chip's status speaks TWICE (the screen voice print:hidden, the paper voice full)",
  dash.includes('<span className="print:hidden">{chipStatusScreen}</span>') &&
  dash.includes('<span className="hidden print:inline">{chipStatusPaper}</span>'));
ok("A3 the paper voice carries the FULL receipt (the slice stays screen-only)",
  /chipStatusPaper =[\s\S]*?receipt \|\| "done"/.test(dash) &&
  /chipStatusScreen[\s\S]*?receipt\.slice\(0, 26\)/.test(dash));
ok("A4 the roster's result lines wrap on paper (the OOM/SLURM stories reachable)",
  (dash.match(/block truncate print:whitespace-normal print:overflow-visible/g) || []).length >= 1);
ok("A5 the rail wraps on paper (a scroll has no scroll on paper) and the chip cannot exceed the sheet",
  dash.includes("nice-scroll print:flex-wrap") &&
  dash.includes("text-left transition-all hover:shadow-sm print:max-w-full"));

/* ---------- B band — the screen acts stay on screen ---------- */
console.log("B band — the screen acts stay on screen:");
ok("B1 the interactive header row is silent on paper (search, sort, new project)",
  dash.includes('className="no-print flex items-center gap-2"') &&
  dash.indexOf('className="no-print flex items-center gap-2"') < dash.indexOf("Search projects…"));
ok("B2 the click-jump instruction stays on screen (the failed names print, the act does not)",
  dash.includes('failed jobs across all projects') &&
  dash.includes('<span className="no-print"> — click one to jump to its canvas</span>'));
ok("B3 the EMPTY preset shelf is silent on paper (a populated shelf keeps printing)",
  shelf.includes('(isEmpty ? " no-print" : "")'));
ok("B4 the browser-session footnote stays on screen (the assurance names a screen act)",
  /no-print mt-8 text-center[\s\S]*?persist per browser session/.test(dash));

/* ---------- C band — the lies removed, the laws intact ---------- */
console.log("C band — the lies removed, the laws intact:");
ok("C1 the +N-more badge is silent on paper (every row prints — the badge would lie)",
  /no-print pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg bg-gradient-to-t from-card via-card\/85 to-transparent/.test(dash));
ok("C2 the roster's real thead still repeats across pages (the t84 law survives the pass)",
  dash.includes('hidden print:table-header-group') &&
  dash.includes("Jobs · {visibleJobs.length} · newest first"));

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1089-print-honesty-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["A the tails reachable on paper", "B the screen acts stay on screen", "C the lies removed, the laws intact"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);

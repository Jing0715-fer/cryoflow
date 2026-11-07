#!/usr/bin/env node
/**
 * t1087 — the PAPER CENSUS unit (node-only).
 *
 * THE WINDOW: three windows rode the exam lane and no style debt was
 * paid — t1087 pays the product line's two faces. The law this unit
 * pins has three seats:
 *
 *   A  THE PAPER CENSUS (print-doc-header.tsx): the screen footer's
 *      status census reaches the print masthead's right column. The
 *      order is the CANONICAL one — FIND_STATUSES borrowed from
 *      canvas-find-bar (the footer's own precedent; a private order
 *      here would sooner or later disagree with the footer's), nonzero
 *      voices only (a status with no jobs keeps the paper silent), the
 *      words lowercase (the footer's own voice), the line hooked
 *      data-print-census for the QA glass. Derived from the store's
 *      jobs — never the clock — so the t232 no-hydration law holds
 *      untouched (the census is a snapshot fact, not a wall time).
 *
 *   B  THE RAW TOOLTIP (fsc-params-diff.tsx): the compare table's value
 *      cells truncate at 24 chars — the CELL's rhythm — but the title
 *      tooltip re-formatted through the SAME truncating formatter, so
 *      the tooltip showed the same 24 chars the cell showed and the
 *      tail was unreachable EVERYWHERE (a 60-char path's right half
 *      existed on no surface). The cure: rawParam — the uncut voice,
 *      answering the same five shapes — rides the tooltip while the
 *      cell keeps its slice; the populated cell gains cursor-help (the
 *      cursor asks where the title tells).
 *
 *   C  THE SWAP'S FACE (params-diff-dialog.tsx): the swap button spoke
 *      aria-pressed to ears only. A swapped pair now wears a muted
 *      wash + full-ink icon (the t904 memory's visible half — the
 *      store remembers, the face confirms, a screenshot carries the
 *      state).
 *
 *   node scripts/t1087-paper-census-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t1087-paper-census-unit.json";
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const header = readFileSync(path.join(ROOT, "src/components/workflow/print-doc-header.tsx"), "utf8");
const diff = readFileSync(path.join(ROOT, "src/components/workflow/results/fsc-params-diff.tsx"), "utf8");
const dialog = readFileSync(path.join(ROOT, "src/components/workflow/params-diff-dialog.tsx"), "utf8");
const findBar = readFileSync(path.join(ROOT, "src/components/workflow/canvas-find-bar.tsx"), "utf8");

/* ---- A — the paper census ------------------------------------------------ */
ok("A1 the masthead borrows the CANONICAL order (FIND_STATUSES from canvas-find-bar — the footer's own precedent, no private taxonomy)",
  header.includes('import { FIND_STATUSES } from "./canvas-find-bar"'));
ok("A1 the canonical order still lives in canvas-find-bar (the source the footer and the masthead both read)",
  /export const FIND_STATUSES: \{ value: JobStatus; label: string \}\[\] = \[\s*"running"|"running"|"completed"|"failed"|"idle"|"pending"/.test(findBar.replace(/\{ value: "(\w+)", label: "[^"]*" \}/g, '"$1"')));

const censusSlice = header.slice(header.indexOf("t1087 — the paper census"));
ok("A2 the census derives from the store's jobs, per FIND_STATUSES voice (never the clock — the t232 law untouched)",
  /FIND_STATUSES\.map\(\(\{ value, label \}\) => \(\{\s*label,\s*count: jobs\.filter\(\(j\) => j\.status === value\)\.length,\s*\}\)\)\.filter\(\(c\) => c\.count > 0\)/.test(censusSlice));
ok("A3 the census line carries the QA hook (data-print-census — the glass reads the paper's health story)",
  censusSlice.includes('data-print-census'));
ok("A4 the census words are the footer's voice: lowercase labels, dot-joined, nonzero only",
  censusSlice.includes("`${c.count} ${c.label.toLowerCase()}`") && censusSlice.includes('.join(" · ")'));
ok("A5 the census rides the masthead's identity column (print-scoped reveal inside the print-only header)",
  /<span data-print-census className="print:mt-1 block">/.test(header));
ok("A6 the masthead's identity line is UNTOUCHED (printed date · jobs · edges · annotated still first — the census is additive, under it)",
  header.indexOf("{printed}") < header.indexOf("data-print-census") &&
  header.indexOf("data-print-notes-count") < header.indexOf("data-print-census"));

/* ---- B — the raw tooltip -------------------------------------------------- */
ok("B1 rawParam exists and answers uncut (no length slice in the raw voice)",
  /function rawParam\(v: unknown\): string \{[\s\S]*?return JSON\.stringify\(v\) \?\? String\(v\);\s*\}/.test(diff) &&
  !/rawParam[\s\S]{0,400}\.slice\(0,/.test(diff));
ok("B2 the tooltip rides the RAW value (the value td's title speaks rawParam — the tail is reachable)",
  diff.includes("= ${rawParam(v)}"));
ok("B3 the cell keeps its rhythm slice (formatParam still truncates at 24 — the cell hides, the tooltip tells)",
  /if \(typeof v === "string"\) return v\.length > 24 \? `\$\{v\.slice\(0, 23\)\}…` : v;/.test(diff) &&
  diff.includes("{absent ? \"—\" : formatParam(v)}"));
ok("B4 the populated cell asks for the hover (cursor-help marks where the title tells)",
  /!absent && "cursor-help"/.test(diff));
ok("B5 the raw voice answers the same five shapes (null, boolean, number, string, object)",
  (diff.match(/function rawParam[\s\S]*?\n\}/) ?? [""])[0].split("\n").filter((l) => l.includes("typeof v ===") || l.includes("v === undefined")).length === 4);

/* ---- C — the swap's face --------------------------------------------------- */
ok("C1 the swap button keeps its ears (aria-pressed survives the face work)",
  dialog.includes('aria-pressed={swapped}'));
ok("C2 the pressed state has a FACE (swapped → the muted wash + full ink — the t904 memory's visible half)",
  /swapped && "bg-muted text-foreground"/.test(dialog));
ok("C3 the face joins the conditional-class law (cn(, not string concatenation)",
  /className=\{cn\(\s*"ml-1 h-6 w-6 gap-0[\s\S]*?swapped && "bg-muted text-foreground"/.test(dialog));
ok("C4 the pressed face is named at its seat (the t1087 comment pins the why — a screenshot carries the state)",
  dialog.includes("the memory law's visible") && dialog.includes("the t904 store remembers, the face confirms"));

/* ---- the receipt ---- */
try { writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ instrument: "t1087-paper-census-unit", pass, fail, at: new Date().toISOString() }, null, 2)); } catch {}
console.log(`\nPAPER-CENSUS-UNIT t1087: ${pass}/${pass + fail} ${fail === 0 ? "green — the paper census, the raw tooltip and the swap's face are pinned to the source" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

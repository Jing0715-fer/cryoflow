#!/usr/bin/env node
/**
 * t947 — the COMPARE paper's own X unit (node-only).
 *
 * THE LAW: the t946 family law ("a button on paper is a promise the
 * paper cannot keep") reaches the Task 114 doctrine's SECOND seat — the
 * A/B compare dialog's close X dies on paper too. The rule lives in
 * globals.css's compare print-face block, shaped EXACTLY like the
 * family's own (the t946 A6 verbatim, re-hooked): the :has() chain →
 * the compare face's own content → the direct close slot. The hide is
 * print-scoped (it rides inside the @media print block — on screen the
 * X stays; the t945 witness probes it). And the SEATS STAY SEPARATE:
 * the family block never names the compare hook and the compare rule
 * never names the family hook (the t946 A7 law, both directions).
 *
 *   node scripts/t947-compare-x-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t947-compare-x-unit.json";
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

/* ---- A1 — the rule exists, the family's shape verbatim (re-hooked) */
ok("A1 the compare X-kill rule exists (the :has() chain → the face's own content → the direct close slot)",
  /html:has\(\[data-compare-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-compare-dialog\]\s*\n\s*>\s*\[data-slot="dialog-close"\]\s*\{[^}]*display:\s*none\s*!important/.test(css));

/* ---- A2 — the print scoping: the rule rides inside the print media
 * block (the screen keeps its X — the t945 witness probes the screen
 * half; this unit pins the source half). Ownership by brace balance:
 * between the NEAREST preceding "@media print" and the rule, the media
 * block's own brace is still open (net +1) — the rule is its child. */
const compareRule = css.indexOf('html:has([data-compare-dialog][data-state="open"])\n    [data-compare-dialog]\n    > [data-slot="dialog-close"]');
const before = css.slice(0, compareRule);
const printOpen = before.lastIndexOf("@media print");
const braces = before.slice(printOpen);
const net = (braces.match(/\{/g) ?? []).length - (braces.match(/\}/g) ?? []).length;
const familyHook = css.indexOf("[data-family-read-dialog]");
ok("A2 the rule sits INSIDE the print media block (the hide is print-scoped)",
  printOpen >= 0 && net >= 1 && compareRule < familyHook,
  `print@${printOpen} rule@${compareRule} net=${net}`);

/* ---- A3 — the seats stay separate (the t946 A7 law, both directions):
 * the compare rule never borrows the family hook; the family X-kill
 * never borrows the compare hook. */
const compareBlock = css.slice(css.indexOf("The A/B compare dialog's print face"), css.indexOf("The compare family's print face"));
ok("A3 the compare block never names the family hook (the seats stay separate)",
  compareBlock.length > 0 && !compareBlock.includes("[data-family-read-dialog]"));
const familyBlock = css.slice(css.indexOf("The compare family's print face"), css.indexOf("Task 124 — reveal arrivals"));
ok("A3 the family block never names the compare hook (no cross-seat borrow)",
  familyBlock.length > 0 && !/\[data-compare-dialog\]/.test(familyBlock));

/* ---- A4 — the family's own X-kill still stands (no t946 re-key owed:
 * the new rule is ADDITIVE — the family block's five laws untouched) */
ok("A4 the family X-kill still stands (the t946 A6 verbatim)",
  /html:has\(\[data-family-read-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-family-read-dialog\]\s*\n\s*>\s*\[data-slot="dialog-close"\]/.test(css));
ok("A4 the compare rule is ADDITIVE (exactly one compare X-kill chain in the sheet)",
  (css.match(/html:has\(\[data-compare-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-compare-dialog\]\s*\n\s*>\s*\[data-slot="dialog-close"\]/g) ?? []).length === 1);

/* ---- A5 — the carried comment resolved (the t946 block's debt note is
 * paid, not carried): the family comment no longer says the compare X
 * "keeps riding". */
ok("A5 the carried debt resolved (the comment no longer says the compare X keeps riding)",
  !css.includes("keeps riding its face until"));
ok("A5 the resolution is named (the comment points at the t947 rule)",
  css.includes("the t947 rule"));

/* ---- the receipt ---- */
try { writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ instrument: "t947-compare-x-unit", pass, fail, at: new Date().toISOString() }, null, 2)); } catch {}
console.log(`\nCOMPARE-X-UNIT t947: ${pass}/${pass + fail} ${fail === 0 ? "green — the law is pinned to the source" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

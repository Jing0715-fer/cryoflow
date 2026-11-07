#!/usr/bin/env node
/**
 * t948 — the ALREADY-WIRED twin unit (node-only).
 *
 * THE LAW: t931's pre-announcement doctrine ("before the fire, the
 * enabled speech must account for EVERY one of A's downstream wires")
 * had one bucket still unspoken on the enabled face — the children
 * already consuming B through the same port pair, reported only by the
 * toast after the fire ("N job(s) already on B (left as is)"). The
 * cure is the refusal clause's TWIN: wiredClause (aria/title) and
 * wiredSentence (the contract line), speaking the toast's own words
 * BEFORE the click. Three laws ride with the twin:
 *
 *  1. THE EMPTY-CLEAN LAW (t926): with no already-wired children the
 *     clause is "" — every clean face's speech is byte-identical to
 *     the t920/t925/t926/t928 pins. Proven here at the source (the
 *     early return) and live by the t948 witness's clean bands.
 *  2. THE SPEAK-WIRED HONESTY GATE: the title grows the clause ONLY
 *     where the fire actually leaves the wired children as is — the
 *     plain adopt verb (re-parents onto B itself). The riders'
 *     (select/exclude) fires re-parent onto a freshly MINTED node, so
 *     their plan's alreadyWired bucket is the port-proxy's artifact
 *     and their speech stays refusal-only.
 *  3. THE ORDER LAW: the wired clause joins AFTER the refusal clause
 *     (the refusal is the surprising fact, the wired count the benign
 *     tail), with the t931 separator doctrine carried verbatim (aria
 *     " and", title " — and").
 *
 *   node scripts/t948-wired-twin-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t948-wired-twin-unit.json";
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const src = readFileSync(path.join(ROOT, "src/components/workflow/results/run-compare-dialog.tsx"), "utf8");
const lib = readFileSync(path.join(ROOT, "src/lib/adopt-branch.ts"), "utf8");

/* ---- A1 — the twin exists, the refusal clause's shape verbatim ---- */
ok("A1 wiredClause exists with the sep join (the refusal clause's own doctrine: default \" and\")",
  /function wiredClause\(\s*\n\s*alreadyWired: unknown\[\] \| null \| undefined,\s*\n\s*nameB: string,\s*\n\s*sep = " and",\s*\n\)/.test(src));
ok("A1 the wired clause speaks the toast's own register (\"already on <B> (left as is)\")",
  /return `\$\{sep\} \$\{alreadyWired\.length\} already on \$\{nameB\} \(left as is\)`;/.test(src));

/* ---- A2 — the contract twin exists ---- */
ok("A2 wiredSentence exists (the visible, non-tooltip twin — as refusalSentence is to refusesClause)",
  /function wiredSentence\(\s*\n\s*alreadyWired: unknown\[\] \| null \| undefined,\s*\n\s*nameB: string,\s*\n\)/.test(src));
ok("A2 the wired sentence carries the toast's job-count form (\"Also N job(s) already on <B> (left as is).\")",
  /return ` Also \$\{alreadyWired\.length\} \$\{alreadyWired\.length === 1 \? "job" : "jobs"\} already on \$\{nameB\} \(left as is\)\.`;/.test(src));

/* ---- A3 — the empty-clean law (t926) at the source: BOTH twins'
 * first statement is the early return, so a clean plan's speech is
 * byte-identical to the pre-t948 pins ---- */
ok("A3 wiredClause's first statement is the empty-clean early return (the t926 law, now proven for BOTH clauses)",
  /sep = " and",\s*\n\): string \{\s*\n\s*if \(!alreadyWired \|\| alreadyWired\.length === 0\) return "";/.test(src));
ok("A3 wiredSentence's first statement is the empty-clean early return",
  /nameB: string,\s*\n\): string \{\s*\n\s*if \(!alreadyWired \|\| alreadyWired\.length === 0\) return "";/.test(src));

/* ---- A4 — the ORDER LAW: the plain aria's wired clause joins AFTER
 * the refusal clause (refusal first — the surprising fact; wired last
 * — the benign tail) ---- */
ok("A4 the plain aria speaks refusal THEN wired (the order law)",
  /\$\{refusesClause\(adoptionPlan\.refused\)\}\$\{wiredClause\(adoptionPlan\.alreadyWired, nameB\)\}/.test(src));

/* ---- A5 — the SPEAK-WIRED HONESTY GATE: the title's enabled branch
 * gates the clause on speakWired; the plain verb opens the gate, the
 * riders keep it shut ---- */
ok("A5 the title's enabled branch gates the wired clause on speakWired (title sep \" — and\")",
  /\$\{speakWired \? wiredClause\(plan\.alreadyWired, nameB, " — and"\) : ""\}/.test(src));
ok("A5 the plain adopt verb's title call opens the gate (adoptionPlanTitle(adoptionPlan, nameA, nameB, true))",
  /adoptionPlanTitle\(adoptionPlan, nameA, nameB, true\)/.test(src));
ok("A5 the riders' title calls keep the gate shut (the default false — no 4th arg)",
  /adoptionPlanTitle\(selectPlan, nameA, nameB\)/.test(src) &&
  /adoptionPlanTitle\(excludePlan, nameA, nameB\)/.test(src) &&
  !/adoptionPlanTitle\((?:select|exclude)Plan, nameA, nameB, true\)/.test(src));

/* ---- A6 — the riders' HONESTY LAW: their aria/title templates never
 * speak the wired bucket (their fire re-parents onto a freshly minted
 * node — nothing can be already wired to it; the proxy plan's bucket
 * is the port-proxy's artifact, and "left as is" would promise the
 * opposite of the fire) ---- */
const riderStart = src.indexOf('data-testid="adopt-with-exclude"');
const riderEnd = src.indexOf('Open run A', riderStart) > 0
  ? src.indexOf('Open run A', riderStart)
  : -1;
const riderBlock = riderStart > 0 && riderEnd > riderStart ? src.slice(riderStart, riderEnd) : "";
ok("A6 the rider block found (the exclude + select riders' speech lives between the exclude testid and the Open-run cluster)",
  riderStart > 0 && riderBlock.length > 0, `${riderBlock.length} chars`);
ok("A6 the riders' speech never names wiredClause/wiredSentence (the honesty gate at the call sites)",
  riderBlock.length > 0 && !riderBlock.includes("wiredClause") && !riderBlock.includes("wiredSentence"));
ok("A6 the riders' speech never says \"already on\" (the mint-targeted fire has no already-wired bucket to speak)",
  riderBlock.length > 0 && !riderBlock.includes("already on"));

/* ---- A7 — the contract line carries the wired sentence, AFTER the
 * refusal sentence (the accounting order mirrors the aria) ---- */
ok("A7 the contract line speaks refusalSentence THEN wiredSentence (the accounting order)",
  /\{refusalSentence\(adoptionPlan\.refused, nameA\)\}\s*\n\s*\{wiredSentence\(adoptionPlan\.alreadyWired, nameB\)\}/.test(src));

/* ---- A8 — the toast's own line untouched (describeAdoption's
 * already-wired part is the register's SOURCE and stays verbatim —
 * the twin teaches exactly what the fire will say) ---- */
ok("A8 the toast's already-wired line verbatim in the lib (the twin's register source)",
  lib.includes('`${plan.alreadyWired.length} ${plan.alreadyWired.length === 1 ? "job" : "jobs"} already on ${nameB} (left as is)`'));

/* ---- A9 — the lineage is named (the twins' doc comments carry the
 * t931 doctrine and the t926 clean-face law forward) ---- */
const wiredDoc = src.slice(src.indexOf("/** t948 — the mixed plan's ALREADY-WIRED"), src.indexOf("function wiredClause"));
ok("A9 the wired clause's doc names the t931 doctrine and the t926 empty-clean law (the lineage)",
  wiredDoc.includes("t931") && wiredDoc.includes("t926") && wiredDoc.includes("EVERY one of A's downstream wires"));

/* ---- the receipt ---- */
try { writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ instrument: "t948-wired-twin-unit", pass, fail, at: new Date().toISOString() }, null, 2)); } catch {}
console.log(`\nWIRED-TWIN-UNIT t948: ${pass}/${pass + fail} ${fail === 0 ? "green — the twin's laws are pinned to the source" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

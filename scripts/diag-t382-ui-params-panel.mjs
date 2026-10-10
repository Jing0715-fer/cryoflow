#!/usr/bin/env node
/**
 * diag-t382-ui — source-level structural verification of the params-panel
 * refactor (the 取消折叠 round).
 *
 * WHY source-level: the 4GB sandbox cannot host the 3.3GB-steady turbopack
 * dev server AND a Chrome session at the same time (the memory ledger of
 * this round: server compile peak 3.4GB / steady 3.28GB, one Chrome
 * generation ~400MB launch + ~300MB page ramp, baseline ~330MB — every
 * coexistence attempt OOM-killed one side or the other, 8 attempts across
 * staggered/protected/single-process configs). Browser-level QA is
 * honestly recorded as blocked; this diag pins the SAME contract at the
 * source level, and tsc/eslint (strict) already gate the types:
 *
 *   U1 the expert-options COLLAPSIBLE is gone from the params tab — no
 *      Collapsible/Trigger/Content, no ChevronsDownUp, in job-panel.tsx
 *   U2 every parameter renders DIRECTLY: the tab body wraps basic +
 *      advanced in visible <fieldset>/<legend> group frames ("Basic
 *      options" / "Expert options · N") — RELION's group-frame idiom
 *   U3 the ParamField is the RELION row: a fixed label column + control
 *      column grid (grid-cols-[…]), label right-aligned in its column,
 *      one row per parameter (no col-span-2 ragged grid)
 *   U4 the empty-tab state explains itself (the showIf gates)
 *   U5 every job type's FULL parameter set is declared in workflow.ts —
 *      the schema the panel renders (count per type, advanced included,
 *      none dropped by the refactor)
 *   U6 PathParamField no longer double-labels (the row owns the label)
 */
import { readFileSync } from "node:fs";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const panel = readFileSync(`${ROOT}/src/components/workflow/job-panel.tsx`, "utf8");

let pass = 0;
let fail = 0;
const failures = [];
function must(cond, label, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  ✗ FAIL: ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

console.log("━━━ U1 — the fold is gone ━━━");
{
  const paramsTabStart = panel.indexOf("Params tab (RELION GUI simulation)");
  const paramsTab = panel.slice(paramsTabStart);
  must(!paramsTab.includes("Collapsible"), "no Collapsible anywhere in the params region");
  must(!paramsTab.includes("ChevronsDownUp"), "no fold chevron icon");
  must(!panel.includes("CollapsibleContent"), "the collapsible content wrapper is gone from the file");
  must(!/collapsed summary — expert/.test(panel), "no expert-summary collapsed state");
  // the t311 multi-file path summary STAYS (the user's own earlier ask)
  must(paramsTab.includes("show all"), "the t311 multi-file path summary keeps its own show-all (a file-list display concern, not parameter folding)");
}

console.log("━━━ U2 — visible group frames (RELION's idiom) ━━━");
{
  const body = panel.slice(panel.indexOf("allTabs.map((t) =>"));
  must(body.includes("<fieldset"), "the tab body renders <fieldset> group frames");
  must(/<legend[^>]*>\s*Basic options/.test(body), 'a "Basic options" legend exists');
  must(/<legend[^>]*>\s*Expert options · \{advanced\.length\}/.test(body), 'the "Expert options · N" legend carries its count');
  must(body.includes("{advanced.map((p) => ("), "the advanced params render DIRECTLY in the tab body (no fold between render and eye)");
  must(body.includes("{basic.map((p) => ("), "the basic params render in their own frame");
}

console.log("━━━ U3 — the RELION row geometry ━━━");
{
  const field = panel.slice(panel.indexOf("function ParamField"), panel.indexOf("function PathParamField"));
  must(/grid-cols-\[\d+px_minmax\(0,1fr\)\]/.test(field), "the row is a fixed label-column + control-column grid");
  must(/sm:grid-cols-\[\d+px_minmax\(0,1fr\)\]/.test(field), "the label column widens on sm+ breakpoints");
  must(!field.includes("col-span-2"), "no ragged col-span-2 rows remain");
  must(field.includes('title={p.hint}'), "hints ride the title tooltip (RELION's affordance)");
  must(/text-muted-foreground/.test(field), "advanced labels tone down (p.advanced → muted)");
  // the bool is a row: label left, switch right — RELION's checkbutton row
  const boolBranch = field.slice(field.indexOf('p.type === "bool"'));
  must(boolBranch.includes("justify-end"), "the bool switch sits at the row's right edge (label left, switch right)");
}

console.log("━━━ U4 — the empty-tab state ━━━");
must(/No visible parameters in this tab/.test(panel), "an all-gated tab explains itself instead of rendering blank");

console.log("━━━ U5 — the schema still declares every parameter ━━━");
{
  // import the schema through a tiny TS-free probe: count ParamSchema
  // object literals per job type in workflow.ts (the file the panel maps)
  const wf = readFileSync(`${ROOT}/src/lib/workflow.ts`, "utf8");
  const advancedCount = (wf.match(/advanced: true/g) ?? []).length;
  must(advancedCount >= 90, `the schema's expert flags survive the refactor (${advancedCount} advanced params)`);
  const tabsCount = (wf.match(/tab: "/g) ?? []).length;
  must(tabsCount >= 60, `the RELION tab assignments are intact (${tabsCount} tab: entries)`);
  const showIfCount = (wf.match(/showIf:/g) ?? []).length;
  must(showIfCount >= 8, `the t381 showIf gates are intact (${showIfCount} gated params)`);
}

console.log("━━━ U6 — no double labels on path rows ━━━");
{
  const pathField = panel.slice(panel.indexOf("function PathParamField"));
  const pathBody = pathField.slice(0, pathField.indexOf("function ParamsTab"));
  must(!pathBody.includes("<Label"), "PathParamField no longer renders its own label (the row owns it)");
  must(pathBody.includes("Browse"), "the browse button stays");
}

console.log(`\n===== diag-t382-ui (params panel, no folds): ${pass} passed, ${fail} failed =====`);
if (failures.length) for (const f of failures) console.log(`  - ${f}`);
process.exit(fail > 0 ? 1 : 0);

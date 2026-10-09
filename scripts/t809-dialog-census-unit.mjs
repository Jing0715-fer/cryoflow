#!/usr/bin/env node
// t809 — the dialog census, GATED: the full enumeration arm the t808 tail
// named, now living in the fleet. The walk (scripts/t809-dialog-census-walk.mjs)
// classified all 46 DialogContent faces; this probe pins the census's verdicts:
//   A — the two disease-live faces cured (remote-run + map/stack, the t804
//       dialect verbatim, each card's own cap and rhythm kept)
//   B — the census's arithmetic as a RETIREMENT GATE: exactly one self-scroll
//       face remains (fsc-compare, the qa62 documented verdict); a new
//       undocumented body-scroll face moves the count and screams
//   C — the exemptions' honesty: the documented verdict honored, the inner
//       grounds on file, the small forms left small (one law per window)
//   D — the dialect's consistency: the t808 houses ride on, the spine shared,
//       the old shapes retired
//   E — the walk instrument itself is re-runnable
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert";

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log(`  ok ${msg}`); }
  else { fail++; console.log(`  FAIL ${msg}${extra ? " — " + extra : ""}`); }
};

const RR = readFileSync("src/components/workflow/remote-run-button.tsx", "utf8");
const RV = readFileSync("src/components/workflow/results/results-view.tsx", "utf8");
const FSC = readFileSync("src/components/workflow/results/fsc-compare-dialog.tsx", "utf8");
const RC = readFileSync("src/components/workflow/remote-cluster-dialog.tsx", "utf8");

console.log("A — the two disease-live faces cured (the t804 dialect verbatim)");
{
  ok(RR.includes('className="flex max-h-[calc(100vh-3rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"'),
    "A1 remote-run house: flex col + gap-0 + overflow-hidden + p-0, the card's own calc(100vh-3rem) cap kept");
  ok(RR.includes('className="shrink-0 border-b px-5 pb-4 pt-5"') &&
     RR.includes('className="flex shrink-0 items-center justify-end gap-2 border-t px-5 pb-4 pt-3"'),
    "A2 remote-run header pinned AND footer pinned (the actions stay visible while the sections scroll)");
  ok(RR.includes('role="region"') &&
     RR.includes('aria-label="Remote run — connection, mode, and the submission preview"') &&
     RR.includes("min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"),
    "A3 remote-run ONE main region: the stop + the honest name + the scroll");
  ok(RR.includes('aria-label="Remote run — the cluster connection state"'),
    "A4 the empty-state face carries its own honest region name");
  ok((RR.match(/focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary\/50/g) ?? []).length === 2,
    "A5 the inset ring rides BOTH remote-run regions (the t808 dialect form verbatim)", String((RR.match(/focus-visible:ring-inset/g) ?? []).length));
  ok(RV.includes('className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"'),
    "A6 map/stack house: the same spine, the card's own 90dvh cap kept");
  ok(RV.includes('className="shrink-0 border-b px-6 pb-4 pt-6"') &&
     RV.includes('aria-label="Map and stack preview — the image, its window controls, and the histogram"') &&
     RV.includes("min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-6 pt-4"),
    "A7 map/stack pinned header + ONE region (stop + honest name + scroll + the 6-unit rhythm)");
  ok(!RR.includes('role="dialog"') && !RV.includes('role="dialog"'),
    "A8 role=dialog untouched — Radix owns the dialog face (the t799 third-family law; nobody hardcodes it in source)");
  ok(RR.includes("onKeyDown={onEscapeClose(() => setOpen(false))}") &&
     RV.includes("onKeyDown={onEscapeClose(() => setImageFile(null))}"),
    "A9 the escape laws ride on verbatim (one press peels one layer)");
}

console.log("B — the census's arithmetic, gated (the retirement record)");
{
  let out = "";
  try { out = execFileSync("node", ["scripts/t809-dialog-census-walk.mjs"], { encoding: "utf8" }); }
  catch (e) { out = String(e.stdout ?? e); }
  const totals = out.match(/total instantiations \(non-ui-primitive files\): (\d+)/);
  const counts = out.match(/HOUSE (\d+) \| BODYSCROLL (\d+) \| PLAIN (\d+) \| READ\(hand\) (\d+)/);
  ok(!!totals && !!counts, "B1 the walk instrument runs and reports (total + classification line)");
  if (totals && counts) {
    const [, total, house, body] = [null, +totals[1], +counts[1], +counts[2]];
    ok(total === 46, `B2 the census covers FORTY-SIX faces (growth amends the census, never skips it)`, `found ${total}`);
    ok(body === 1, `B3 exactly ONE self-scroll face remains on file (fsc-compare, the qa62 documented verdict) — a new undocumented body-scroll face moves this and screams`, `found ${body}`);
    ok(house >= 17, `B4 the house count sits at its t809 floor (15 elders + the two t809 cures; future dress-up only raises it)`, `found ${house}`);
  }
}

console.log("C — the exemptions' honesty (one law per window)");
{
  ok(FSC.includes("overflow-y-auto, NOT overflow-hidden") && FSC.includes("SILENTLY CLIPPED the legend chips"),
    "C1 fsc-compare's qa62 verdict stands HONORED — the documented middle form is not bulldozed by the census");
  ok(readFileSync("src/components/workflow/results/text-preview.tsx", "utf8").includes("max-h-[55vh] overflow-auto"),
    "C2a TextPreview keeps its own 55vh ground (the text viewers stay grounded)");
  ok(readFileSync("src/components/workflow/results/star-table.tsx", "utf8").includes("max-h-96 overflow-auto"),
    "C2b StarTable keeps its own ground (the star viewers stay grounded)");
  ok(readFileSync("src/components/workflow/session-report-dialog.tsx", "utf8").includes("report-doc max-h-[62vh] overflow-y-auto"),
    "C2c session-report keeps its 62vh doc-body ground");
  ok(readFileSync("src/components/workflow/pipeline-script-dialog.tsx", "utf8").includes("max-h-[55vh] overflow-auto"),
    "C2d pipeline-script keeps its 55vh pre ground");
  ok(readFileSync("src/components/workflow/path-browser-dialog.tsx", "utf8").includes("h-72 overflow-y-auto"),
    "C2e path-browser keeps its h-72 list ground");
  ok(readFileSync("src/components/workflow/hpc-profiles-editor.tsx", "utf8").includes('max-h-[56vh] space-y-1 overflow-y-auto'),
    "C2f hpc-profiles-editor's list keeps its 56vh ground (the census records the editor column's PARTIAL rider)");
  const WP = readFileSync("src/components/workflow/workspace-panel.tsx", "utf8");
  ok(WP.includes('className="sm:max-w-sm"') && !/New workspace[\s\S]{0,200}flex-col gap-0 overflow-hidden/.test(WP),
    "C3 the small forms stay small — the census did NOT blanket-house the never-overflow faces");
}

console.log("D — the dialect's consistency");
{
  ok(RC.includes('className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"'),
    "D1 the t808 remote house rides on verbatim (the elder not disturbed)");
  const spine = (s) => s.includes("flex-col gap-0 overflow-hidden p-0");
  ok(spine(RR) && spine(RV) && spine(RC),
    "D2 the spine is ONE spine: t808's elder and t809's two cures share flex-col + gap-0 + overflow-hidden + p-0");
  ok(RR.includes("focus-visible:ring-2 focus-visible:ring-inset") &&
     RV.includes("focus-visible:ring-2 focus-visible:ring-inset") &&
     RC.includes("focus-visible:ring-2 focus-visible:ring-inset"),
    "D3 the inset ring dialect is ONE dialect across all three windows' regions");
  ok(!RR.includes('className="max-h-[calc(100vh-3rem)] gap-3 overflow-y-auto p-5') &&
     !RV.includes('className="max-h-[90dvh] max-w-2xl overflow-y-auto'),
    "D4 the old shapes RETIRED: remote-run's explicit body-scroll and map/stack's 90dvh self-scroll are gone");
}

console.log("E — the walk instrument itself");
{
  const W = readFileSync("scripts/t809-dialog-census-walk.mjs", "utf8");
  ok(W.includes("const HOUSE") && W.includes("const BODYSCROLL_SELF"),
    "E1 the classification lives in the instrument (re-runnable, not prose)");
  ok(W.includes("false positives") || W.includes("never beyond"),
    "E2 the greedy-window lesson is IN the instrument (the first walk swallowed inner JSX and miscounted)");
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

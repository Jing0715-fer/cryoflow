#!/usr/bin/env node
/* t812 — the fresh-debt sweep's harvest: the two NAKED inner grounds.
 *
 * The t811 tail named three candidates; the first (storage's inner
 * grounds) was falsified by the source itself — the storage dialog has
 * exactly ONE scroll ground and it already wears the whole roster
 * dialect (tabIndex + region + honest name + ring, the t804 house).
 * The fresh-debt sweep then walked the census's GROUNDED faces' INNER
 * grounds with the t811 lesson in hand ("a naked ground is not a
 * ground") and found the old nakedness alive on exactly TWO:
 *
 *   star-table — the star file's table (max-h-96 overflow-auto, the
 *     sticky header + sticky index choreography inside): it scrolled
 *     for the mouse with NO stop, NO name, NO ring. Wound measured
 *     live on the frozen world through the inspector's Files peek:
 *     overflow auto, maxH 384px, tabindex null, role null, name null.
 *   pipeline-analytics — the session timeline's ground (max-h-72
 *     overflow-y-auto pr-1, the gantt rows inside): same nakedness.
 *     Wound live: overflowY auto, maxH 288px, tabindex null,
 *     role null, name null.
 *
 * The cure dresses both with the t811 dressing verbatim (tabIndex 0 +
 * role region + the honest name + the inset ring) and keeps every
 * family rhythm: the caps (max-h-96 / max-h-72), the pr-1, the
 * rounded border, the print unroll (print:max-h-none +
 * print:overflow-visible — t123's B2 guardrail rides untouched).
 * One law, two grounds, one batch — the t809 precedent. The other
 * grounded faces' verdicts stand: text-preview, pipeline-script,
 * path-browser, molstar-embed, particle-browser, job-panel's pre all
 * already wear their doors; session-report's doc body keeps its own
 * shape (its content carries its own stops — the curve and owner
 * doors are the rows' law, not the ground's). */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const star = read("src/components/workflow/results/star-table.tsx");
const analytics = read("src/components/workflow/pipeline-analytics.tsx");

let pass = 0;
const fails = [];
const ok = (cond, msg, extra) => {
  if (cond) pass++;
  else fails.push(msg + (extra ? ` (${extra})` : ""));
};

/* A — the star table's ground dressed */
ok(
  star.includes("tabIndex={0}") && star.includes('role="region"'),
  "A1 the star table's ground gained the stop and the role",
);
ok(
  star.includes(
    'aria-label="Star table — the file\'s columns and rows, the header and index sticking while the cells scroll"',
  ),
  "A2 the ground carries the honest name (what sticks, what scrolls — one breath)",
);
ok(
  star.includes(
    "max-h-96 overflow-auto rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
  ),
  "A3 the ground keeps its own cap and border verbatim and wears the inset ring (the t802 verse)",
);
ok(
  star.includes('className="sticky top-0 z-20"') &&
    star.includes("sticky left-0 z-30"),
  "A4 the t656 sticky choreography untouched (header above, corner above header — the z law rides)",
);

/* B — the session timeline's ground dressed */
ok(
  analytics.includes("tabIndex={0}") && analytics.includes('role="region"'),
  "B1 the timeline's ground gained the stop and the role",
);
ok(
  analytics.includes(
    'aria-label="Session timeline — the session\'s runs as start-and-duration bars"',
  ),
  "B2 the ground carries the honest name (the runs' story in one breath)",
);
ok(
  analytics.includes(
    "max-h-72 overflow-y-auto pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 print:max-h-none print:overflow-visible",
  ),
  "B3 the ground keeps its cap, its pr rhythm, and the print unroll verbatim (t123's B2 tokens ride inside the same string)",
);
ok(
  analytics.includes('data-canvas-ui="analytics-timeline"') &&
    analytics.includes("data-tl-count={runs.rows.length}"),
  "B4 the instrument hooks untouched (the canvas UI markers ride on)",
);

/* C — the family's other grounds stand as their verdicts pinned them */
const textPreview = read("src/components/workflow/results/text-preview.tsx");
const pipelineScript = read("src/components/workflow/pipeline-script-dialog.tsx");
const pathBrowser = read("src/components/workflow/path-browser-dialog.tsx");
const particleBrowser = read("src/components/workflow/results/particle-browser.tsx");
ok(
  textPreview.includes('tabIndex={0}') && textPreview.includes('aria-label="File content preview"'),
  "C1 text-preview's 55vh ground keeps its door (already dressed — not this batch's law)",
);
ok(
  pipelineScript.includes("tabIndex={0}"),
  "C2 pipeline-script's 55vh pre keeps its door",
);
ok(
  pathBrowser.includes('role="listbox"') && pathBrowser.includes("tabIndex={0}"),
  "C3 path-browser's h-72 list keeps its listbox law",
);
ok(
  particleBrowser.includes('aria-label="Micrograph groups"') &&
    particleBrowser.includes("tabIndex={0}"),
  "C4 particle-browser's 96 ground keeps its door",
);

/* D — the census arithmetic: INNER grounds, not cards — the card
 * counts stand exactly where t811 left them */
let walk = "";
try {
  walk = execFileSync("node", ["scripts/t809-dialog-census-walk.mjs"], {
    encoding: "utf8",
  });
} catch (e) {
  walk = String(e.stdout || "");
}
const counts = walk.match(/HOUSE (\d+) \| BODYSCROLL (\d+) \| PLAIN (\d+) \| READ\(hand\) (\d+)/);
if (counts) {
  const total = parseInt(counts[1], 10) + parseInt(counts[2], 10) + parseInt(counts[3], 10) + parseInt(counts[4], 10);
  const house = parseInt(counts[1], 10);
  const bodyscroll = parseInt(counts[2], 10);
  ok(total === 46, "D1 the census still covers FORTY-SIX faces (the sweep grew no dialog)", `found ${total}`);
  ok(house === 18, "D2 the house count stands at t811's floor (18 — inner grounds are not card shape)", `found ${house}`);
  ok(bodyscroll === 1, "D3 exactly ONE self-scroll card remains — the documented fsc-compare", `found ${bodyscroll}`);
} else {
  fails.push("D1 the walk instrument produced no counts line");
}

console.log(`t812-naked-grounds-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}

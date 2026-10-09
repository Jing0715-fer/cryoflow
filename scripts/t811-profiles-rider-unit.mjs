#!/usr/bin/env node
/* t811 — the census's PARTIAL rider dressed: hpc-profiles-editor.
 *
 * The t809 census walked all 46 DialogContent faces and classified this
 * one GROUNDED-PARTIAL: the list kept its 56vh ground, but the CARD
 * itself rode the primitive's default cap-and-scroll (grid + gap-4 +
 * p-6 + overflow-y-auto + max-h-[calc(100dvh-2rem)]), so on short
 * viewports the card scrolled and the header drifted away with it
 * (the wound, measured live on the frozen world at a 510px viewport:
 * scrollTop 8 moved the header's top from 41 to 33 — the old disease's
 * signature), and the editor column's own ground was NAKED — it
 * scrolled for the mouse but had no stop, no name, no ring.
 *
 * The cure speaks the t804 dialect verbatim with the family's own cap
 * and rhythm kept: the card never scrolls (flex col + gap-0 +
 * overflow-hidden + p-0; the calc(100dvh-2rem) cap it already rode,
 * now explicit), the header and the footer are pinned, the body row
 * shrinks (min-h-0 flex-1), and the two columns keep their 56vh
 * grounds — the list's ground gains min-h-0 flex-1 so it shrinks with
 * the card instead of clipping, and the editor column is dressed as
 * the census's named law: tabIndex 0 + role region + the honest name +
 * the inset ring (one law per window: the list keeps its role=list). */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const editor = read("src/components/workflow/hpc-profiles-editor.tsx");

let pass = 0;
const fails = [];
const ok = (cond, msg, extra) => {
  if (cond) pass++;
  else fails.push(msg + (extra ? ` (${extra})` : ""));
};

/* A — the card's spine (the PARTIAL wound: the card rode the primitive's
 * default cap-and-scroll; now it never scrolls) */
ok(
  editor.includes(
    'className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 max-w-4xl"',
  ),
  "A1 the card wears the house shape (flex col + gap-0 + overflow-hidden + p-0; the calc cap it rode is now explicit; the 4xl width is the card's own)",
);
ok(
  editor.includes('<DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5">'),
  "A2 the header pinned (shrink-0 + the border that holds the scroll's top edge)",
);
ok(
  editor.includes(
    '<DialogFooter className="flex shrink-0 items-center gap-2 border-t px-5 pb-4 pt-3 sm:justify-between">',
  ),
  "A3 the footer pinned (the Delete / unsaved-edits / Save row stays visible while the columns scroll)",
);
ok(
  editor.includes('<div className="flex min-h-0 flex-1 gap-4 px-5 py-4">'),
  "A4 the body row shrinks with the card (min-h-0 flex-1) and carries the family's px-5 py-4 rhythm",
);
ok(
  editor.includes('className="flex h-64 shrink-0 items-center justify-center px-5 text-muted-foreground"'),
  "A5 the loading face holds its own height and padding under the p-0 card (shrink-0 + px-5)",
);
ok(
  editor.includes('className="mx-5 shrink-0 rounded-md border border-danger-500/30'),
  "A6 the error strip stays pinned above the footer (mx-5 shrink-0 — an alert must never be clipped away)",
);

/* B — the census's named law: the editor column dressed */
ok(
  editor.includes("tabIndex={0}") && editor.includes('role="region"'),
  "B1 the editor column gained the stop (tabIndex 0) and the role (region) — the ground answers the keyboard",
);
ok(
  editor.includes(
    'aria-label="Profile editor — the selected profile\'s identity, connection, resources, and environment"',
  ),
  "B2 the region carries the honest name (what the ground holds, in one breath)",
);
ok(
  editor.includes(
    "min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
  ),
  "B3 the ground keeps its scroll (overflow-y-auto + pr-1) and wears the inset ring (the t802 verse, verbatim)",
);
ok(
  editor.includes('style={{ maxHeight: "56vh" }}'),
  "B4 the editor's own 56vh cap kept verbatim (the family's rhythm — the cure dresses, it does not resize)",
);
ok(
  (editor.match(/role="region"/g) || []).length === 1,
  "B5 exactly one region in the file (no role inflation — the list keeps its list semantics)",
);

/* C — the list's ground, shrunk safe (one law per window) */
ok(
  editor.includes('className="min-h-0 max-h-[56vh] flex-1 space-y-1 overflow-y-auto pr-0.5"'),
  "C1 the list's 56vh ground kept and made shrink-safe (min-h-0 flex-1 — it shrinks with the card instead of clipping)",
);
ok(
  editor.includes('role="list" aria-label="Profile list"'),
  "C2 the list keeps its role and name (the t809 census's a11y ledger rides on)",
);
ok(
  editor.includes('className="flex shrink-0 items-center justify-between"') &&
    editor.includes('className="flex shrink-0 gap-1.5"'),
  "C3 the rail's title and button rows hold their own height (shrink-0 — the chrome does not compete with the list for shrinking room)",
);
ok(
  editor.includes('aria-pressed={p.id === selectedId}'),
  "C4 the list rows' aria-pressed untouched (the t808 inner-grounds law: what was honest stays honest)",
);

/* D — the dialect's consistency (the house is recognizable from the street) */
ok(
  !editor.includes('className="max-w-4xl"') &&
    editor.includes("<DialogContent"),
  "D1 the old shape retired (no bare max-w-4xl card; the Radix role still answers 'what am I' — no hardcoded role=dialog)",
);
ok(
  editor.includes("onEscapeClose(() => setOpen(false))"),
  "D2 the t797 escape law rides on (the hand-back chain untouched by the surgery)",
);
ok(
  editor.includes("px-5 pb-4 pt-5") && editor.includes("px-5 pb-4 pt-3"),
  "D3 the padding dialect shared with the t809 houses (the header's and footer's measures match the family)",
);

/* E — the census arithmetic rides (the walk re-run in-probe) */
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
  ok(total === 46, "E1 the census still covers FORTY-SIX faces (growth amends the census, never skips it)", `found ${total}`);
  ok(house >= 18, "E2 the rider's cure raised the house floor (17 elders + this dressing)", `found ${house}`);
  ok(bodyscroll === 1, "E3 exactly ONE self-scroll face remains — the documented fsc-compare; no new disease moved in", `found ${bodyscroll}`);
  ok(
    /^HOUSE\s+components\/workflow\/hpc-profiles-editor\.tsx/m.test(walk),
    "E4 the census now reads this face as HOUSE (the instrument and the prose agree)",
  );
} else {
  fails.push("E1 the walk instrument produced no counts line");
}

console.log(`t811-profiles-rider-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}

#!/usr/bin/env node
/* t827 — the door's two-band footer and the capped pull-list: the
 * mobile-width glance that caught a desktop disease.
 *
 * The twice-carried tail (t823's footer seats, t824's "the door never
 * got a MOBILE-width glance") had teeth: the worst-case staging (8 rows
 * + the from-job list open) showed the footer's own box overflowing at
 * ANY width (scrollWidth 253 vs clientWidth 238 at the fixed w-64) —
 * "Copy view link" folded into three lines, "From job" broke mid-label,
 * the N/8 counter clipped at the door's right edge — and the from-job
 * list grew rows UNCAPPED, pushing the whole door past the viewport
 * bottom at 375px (h 542, bottom edge 743 > 667) AND at the 720px
 * desktop (the help text unreachable). The canvas's own pan-surface
 * horizontal scroll at mobile is the canvas's nature (door closed, the
 * scroll stayed) — separate case, not this window's law.
 *
 * The cure is structural, not cosmetic:
 *
 *   A. the two-band footer (molstar-embed.tsx)
 *      1. the outer footer wraps: flex-wrap + gap-y-1 (at the fixed
 *         w-64 the bands wrap by construction; if the door ever grows
 *         they ride one row again)
 *      2. band one: the file-ops trio rides inside its own flex span
 *      3. band two: the share seat + the counter ride an ml-auto flex
 *         span — the counter keeps its right-edge anchor on either row
 *      4. every seat label is whitespace-nowrap — a seat folds whole
 *         rows, never its own words ("Copy view link" stays one seat)
 *      5. the t823 divider rides band one's TAIL (after "From job"):
 *         at the wrap point it marks where the file-ops band ends
 *      6. the counter rides band two (the ml-auto span holds it)
 *
 *   B. the capped pull-list (the shelf's sibling gets the shelf's cap)
 *      7. the from-job list is max-h-40 overflow-y-auto (8 job rows
 *          can no longer push the door past the screen)
 *      8. nice-scroll rides the pull-list (the house scroll treatment)
 *      9. the main shelf's own cap untouched (max-h-44 on the list)
 *
 *   C. the story on file
 *     10. the footer comment names the t824 worst-case evidence
 *     11. the pull-list comment names the uncapped growth
 *
 *   D. the door keeps its waist — and learns the screen's height
 *     12. the camera-bookmarks PopoverContent is still w-64 p-2 — the
 *         fix is inside the door, not a wider door
 *     13. the door caps itself to Radix's collision-settled available
 *         height (--radix-popover-content-available-height) and scrolls
 *         internally on short/mobile screens (the t824 glance caught
 *         the worst case 69px past the fold even after A+B)
 *     14. the comment names the law
 *
 *   E. the calibre
 *     15. no new API route — 18 api dirs + src/app/api/route.ts = 19
 */

import { readFileSync, readdirSync, statSync } from "node:fs";

const embed = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");

let pass = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fails.push(label);
    console.log(`  FAIL  ${label}`);
  }
};

const between = (src, startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + 1);
  return a > -1 && b > a ? src.slice(a, b) : "";
};

console.log("A. the two-band footer (molstar-embed.tsx)");
{
  const footWin = between(embed, "export / import — saved views are work product", "{fromJobOpen && (");
  ok(
    footWin.includes("flex flex-wrap items-center gap-y-1 border-t pt-1.5"),
    "A1 the outer footer wraps: flex-wrap + gap-y-1 — two bands at w-64, one row if the door grows"
  );
  const bandOne = footWin.indexOf('<span className="flex items-center gap-1">');
  const fromJobSeat = footWin.indexOf("Import view bookmarks from another job");
  const bandTwo = footWin.indexOf('<span className="ml-auto flex items-center gap-1">');
  ok(
    bandOne > -1 && fromJobSeat > bandOne,
    "A2 band one: the file-ops trio rides inside its own flex span"
  );
  ok(
    bandTwo > -1 && bandTwo > bandOne,
    "A3 band two: the share seat + counter ride an ml-auto flex span"
  );
  const nowrapSeats = (footWin.match(/whitespace-nowrap rounded px-1 py-0\.5/g) || []).length;
  ok(nowrapSeats === 4, `A4 all four seat labels are whitespace-nowrap (found ${nowrapSeats}/4)`);
  const divider = footWin.indexOf('bg-border/70');
  const fromJobIcon = footWin.indexOf("FolderOpen"); // the From job seat's icon — unique in the window
  ok(
    divider > -1 && fromJobIcon > -1 && fromJobIcon < divider && divider < bandTwo,
    "A5 the t823 divider rides band one's TAIL (after From job, before band two)"
  );
  const counter = footWin.indexOf("{bookmarks.length}/8");
  ok(
    counter > bandTwo,
    "A6 the counter rides band two (inside the ml-auto span)"
  );
}

console.log("B. the capped pull-list");
{
  const fjWin = between(embed, 'data-canvas-ui="from-job-list"', "Saves the full view");
  const listWin = between(embed, "{fromJobOpen && (", "Saves the full view");
  ok(
    listWin.includes("max-h-40 overflow-y-auto"),
    "B7 the from-job list is max-h-40 overflow-y-auto — rows can't push the door off-screen"
  );
  ok(
    listWin.includes("nice-scroll"),
    "B8 nice-scroll rides the pull-list (the house scroll treatment)"
  );
  const shelfWin = between(embed, 'ref={bmListRef}', "export / import — saved views are work product");
  ok(
    shelfWin.includes("max-h-44 space-y-0.5 overflow-y-auto"),
    "B9 the main shelf's own cap untouched (max-h-44)"
  );
}

console.log("C. the story on file");
{
  const footWin = between(embed, "export / import — saved views are work product", "{fromJobOpen && (");
  ok(
    footWin.includes("t824's worst-case read caught the counter clipped") &&
      footWin.includes("folded into three lines"),
    "C10 the footer comment names the t824 worst-case evidence"
  );
  const fjComment = between(embed, "t827 — the shelf's sibling", 'data-canvas-ui="from-job-list"');
  ok(
    fjComment.includes("rows uncapped") || embed.includes("grew\n                      rows uncapped"),
    "C11 the pull-list comment names the uncapped growth"
  );
}

console.log("D. the door keeps its waist — and learns the screen's height");
{
  // the className sits BEFORE the data-canvas-ui marker (attribute order) —
  // the window must start at the Popover open prop to see it
  const doorWin = between(embed, "open={bookmarksOpen}", "Save the exact camera pose");
  ok(
    embed.includes('className="w-64 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto nice-scroll p-2"'),
    "D12 the door is still w-64 p-2 — the fix is inside, not a wider door"
  );
  ok(
    doorWin.includes("max-h-[var(--radix-popover-content-available-height)]") &&
      doorWin.includes("overflow-y-auto") &&
      doorWin.includes("nice-scroll"),
    "D13 the door caps itself to Radix's collision-settled available height and scrolls internally when the screen is short"
  );
  ok(
    doorWin.includes("--radix-popover-content-available-height") &&
      doorWin.includes("t824 mobile glance caught the worst case"),
    "D14 the comment names the law: the door respects the screen it opens on"
  );
}

console.log("E. the calibre");
{
  const apiDir = "src/app/api";
  const dirs = readdirSync(apiDir).filter((f) => statSync(`${apiDir}/${f}`).isDirectory()).length;
  const hasRootRoute = readFileSync(`${apiDir}/route.ts`, "utf8").length > 0;
  ok(dirs + (hasRootRoute ? 1 : 0) === 19, `E15 the 19-entry calibre (${dirs} api dirs + root route)`);
}

console.log(`\nFLEET t827: ${pass}/${pass + fails.length}`);
if (fails.length) {
  console.log("FAILED:");
  fails.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}

#!/usr/bin/env node
/* t816 — the doc ground's verdict + the phantom's autopsy.
 *
 * TWO verdicts this window, one probe:
 *
 * 1. THE SESSION-REPORT DOC BODY'S VERDICT (t812's named remainder,
 *    carried four windows): the doc body keeps its ROWS-ONLY LAW —
 *    the ground carries no stop of its own because its content IS
 *    the stops (the compass chips first — Tab from the door row
 *    lands INSIDE the scroller — then the curve doors and owner
 *    doors; 27 stops lived inside when the verdict was walked).
 *    Focus inside makes the ground keyboard-obedient through the
 *    browser's native chain: ArrowDown under a chip's focus scrolled
 *    the ground 0→183px live while the chip kept focus (t816's
 *    receipt t816-doc-ground-verdict.png). The naked-ground wound is
 *    keyboard-INVISIBLE scroll — a scroller whose content offers no
 *    stop at all (the star table's cells, the timeline's bars, both
 *    dressed by t812); this ground never had it. A stop on the
 *    ground would be a toll paid before the compass, not a new
 *    reach, and it would double-speak under two named organs
 *    ("Report sections", "Session QC report"). The t812 probe
 *    pinned the family's dressed grounds; this probe pins the fifth
 *    member's exemption — the verdict, not a bulldoze.
 *
 * 2. THE PHANTOM'S AUTOPSY (the fossil candidate retired by
 *    evidence): five windows of ledger carried "the primitive's
 *    fossil class grid-cols-inmax(0,1fr)]" (t811 recorded it,
 *    t812~t815 carried the cleanup candidate). The string NEVER
 *    EXISTED in src or in any commit (git pickaxe empty): it was
 *    born in the shell DISPLAY layer, whose ANSI stripper eats `[m`
 *    pairs (an overzealous `[...m` pattern with no ESC requirement)
 *    — `grid-cols-[minmax` DISPLAYS as `grid-cols-inmax`. The file
 *    always carried the valid grid-cols-[minmax(0,1fr)] (since
 *    1137b65), and the compiled CSS carries its rule. Minimal repro
 *    on film: printf 'grid-cols-[minmax]' displayed as
 *    grid-cols-inmax]. The third instrument-calibre lesson in three
 *    windows (t812's bookmark attribution, t815's census reading the
 *    wrong DB, t816's display phantom): a reading that cannot say
 *    WHICH instrument it used is not a reading — class strings are
 *    read through byte-honest tools (Grep/Read) or counted with
 *    grep -c, never trusted to a piped display.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const report = read("src/components/workflow/session-report-dialog.tsx");
const dialogPrimitive = read("src/components/ui/dialog.tsx");

let pass = 0;
const fails = [];
const ok = (cond, msg, extra) => {
  if (cond) pass++;
  else fails.push(msg + (extra ? ` (${extra})` : ""));
};

/* A — the doc body's rows-only shape (the negative pin) */
ok(
  report.includes('className="report-doc max-h-[62vh] overflow-y-auto pr-1" data-report-body'),
  "A1 the doc body keeps its 62vh ground verbatim (data-report-body, pr-1, the cap)",
);
const bodyDiv = report.match(/<div className="report-doc max-h-\[62vh\][^>]*>/);
ok(!!bodyDiv, "A2 the doc body's opening tag is readable");
ok(
  !!bodyDiv &&
    !bodyDiv[0].includes("tabIndex") &&
    !bodyDiv[0].includes("role=") &&
    !bodyDiv[0].includes("aria-label"),
  "A3 the ground carries NO stop of its own (the rows-only law: no tabIndex, no role, no name)",
);
ok(
  report.includes("t816's VERDICT") && report.includes("rows-only law"),
  "A4 the verdict's prose rides the file (the comment pins the fifth member's exemption)",
);

/* B — the content IS the stops (the law's positive side) */
ok(
  report.includes('aria-label="Report sections"') && report.includes("report-compass-chip"),
  "B1 the compass rides inside the ground (Report sections, the chips) — Tab lands INSIDE the scroller",
);
ok(
  (report.match(/tabIndex=\{0\}/g) || []).length >= 2,
  "B2 the curve doors and owner doors are stops inside the ground (tabIndex 0 rows)",
);
ok(
  report.includes('if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;'),
  "B3 the compass consumes only Left/Right — ArrowDown falls to the native scroll chain (the live walk's key)",
);
ok(
  report.includes("jumpToToc") && report.includes("onCompassKeyDown"),
  "B4 the compass keeps its jump law and its roving handler (the organ untouched)",
);

/* C — the census arithmetic: the verdict grows no card */
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
  ok(total === 46, "C1 the census still covers FORTY-SIX faces (the verdict grew no dialog)", `found ${total}`);
  ok(house === 18, "C2 the house count stands at the t811 floor (18 — an exemption is not a card)", `found ${house}`);
  ok(bodyscroll === 1, "C3 exactly ONE self-scroll card remains — the documented fsc-compare", `found ${bodyscroll}`);
} else {
  fails.push("C1 the walk instrument produced no counts line");
}

/* D — the phantom's autopsy (the fossil candidate retired by evidence) */
ok(
  !dialogPrimitive.includes("grid-cols-inmax"),
  "D1 the primitive carries NO fossil string (the ledger's phantom never lived in src)",
);
ok(
  dialogPrimitive.includes("grid-cols-[minmax(0,1fr)]"),
  "D2 the primitive's grid-cols-[minmax(0,1fr)] is and always was the valid form (since 1137b65)",
);
let pickaxe = "";
try {
  pickaxe = execFileSync(
    "git",
    ["log", "-S", "grid-cols-inmax", "--oneline", "--", "src/components/ui/dialog.tsx"],
    { encoding: "utf8" },
  );
} catch (e) {
  pickaxe = String(e.stdout || "");
}
ok(
  pickaxe.trim() === "",
  "D3 git pickaxe: NO commit ever contained the fossil string (the phantom was display-born)",
);
let cssHasRule = false;
try {
  // t820 amendment — the rebuild moved the compiled CSS: the old build
  // kept it at .next/static/css/<hash>.css; the new build (BUILD_ID
  // QCTxzO4ceFujGgajpxZ1i) houses it under .next/static/chunks/<hash>.css.
  // The walk now covers BOTH addresses so the instrument survives the
  // build-layout drift; the assertion's truth ("the compiled CSS carries
  // the rule") never moved.
  const cssDirs = [".next/static/css", ".next/static/chunks"];
  for (const dir of cssDirs) {
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue; // the address may not exist on a given build — honest skip
    }
    for (const f of entries) {
      if (f.endsWith(".css") && readFileSync(`${dir}/${f}`, "utf8").includes("grid-cols-\\[minmax"))
        cssHasRule = true;
    }
  }
} catch {
  cssHasRule = false;
}
ok(
  cssHasRule,
  "D4 the compiled CSS carries the valid grid-cols rule (css/ or chunks/ — the t820 dual-address walk)",
);

console.log(`t816-doc-ground-verdict-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}

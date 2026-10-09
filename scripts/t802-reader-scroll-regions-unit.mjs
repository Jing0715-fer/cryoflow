/**
 * t802-reader-scroll-regions-unit — the census's blind spot: the two
 * reader scroll regions the overflow-auto buckets missed learn the law.
 *
 * The recon (the t801 tail's fresh-recon candidate: "the diagnostics
 * drawer's keyboard face, the help overlay's focus trap") found the
 * census's own class-boundary bug instead of a new disease family:
 * t801 bucketed by the `overflow-auto` Tailwind class, and both of this
 * window's wounds speak `overflow-y-auto` —
 *
 *   1. the SYSTEM DIAGNOSTICS dialog: the content node itself was the
 *      scroll surface — live-witnessed on the frozen world: 932px of
 *      report in a 488px window, Radix modal parks tabIndex=-1 on it,
 *      and the panel held exactly TWO tabbables (Refresh + Close) at
 *      opposite ends. Every lane bar, verdict note and census tile
 *      between them was keyboard-unreachable scroll.
 *   2. the SHORTCUTS dialog's list: a spans-only region (dl/dd rows +
 *      Kbd chips, zero <button> in the file — the t801 note-hover-card
 *      shape at dialog scale): below the filter input the keyboard had
 *      NOTHING to reach with, and on a short viewport the inventory
 *      overflows the region unread.
 *
 * The cures:
 *   • the diagnostics dialog takes the help-guide house shape (flex col,
 *     pinned header, an inner region owning the scroll) and the region
 *     speaks the roster's dialect — tabIndex, role=region, an honest
 *     name, the visible ring (ring-inset: the region runs edge-to-edge,
 *     an outward ring would clip against the dialog's own border). The
 *     content node KEEPS role=dialog — a tab stop and a dialog role are
 *     not rivals.
 *   • the shortcuts list gains the same dialect, one region, no blanket.
 *   • the help-guide's region is judged COVERED BY CHILDREN (7 door
 *     buttons + the footer CTA — Tab auto-scrolls) and stays untouched.
 *
 *   A  the diagnostics readings region — the house shape + the dialect.
 *   B  the shortcuts list region — the dialect at a spans-only face.
 *   C  the census verdicts — the blind spot named, help-guide covered.
 *   D  the elders' regression — every prior region's dialect intact.
 *   E  the scope honesty — one stop per file, the wrapper untouched.
 *   F  the history — the t383 cap, the t798 memory, the manual's doors.
 *
 * Run:  node scripts/t802-reader-scroll-regions-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let pass = 0;
let fail = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass++;
  else {
    fail++;
    fails.push(label);
  }
};

const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const diag = read("src/components/workflow/system-diagnostics-dialog.tsx");
const shortcuts = read("src/components/workflow/shortcuts-dialog.tsx");
const guide = read("src/components/workflow/help-guide-dialog.tsx");
const wrapper = read("src/components/ui/dialog.tsx");
const dash = read("src/components/workflow/project-dashboard.tsx");
const storage = read("src/components/workflow/storage-dialog.tsx");
const assistant = read("src/components/ai/assistant-panel.tsx");
const jobPanel = read("src/components/workflow/job-panel.tsx");
const jobCard = read("src/components/workflow/job-card.tsx");
const cleanup = read("src/components/workflow/cleanup-dialog.tsx");

/* ------------------------------------------------------------------ */
/* A — the diagnostics readings region (the house shape + the dialect) */
/* ------------------------------------------------------------------ */

// A1 — the verdict comment opens the slice (the blind spot confessed)
const diagVerdict = "t802 — the readings become the dialog's own keyboard region";
const dvStart = diag.indexOf(diagVerdict);
ok(dvStart > -1, "A1 diagnostics verdict comment present");

// the slice runs from the comment to the region's aria-label — know
// where it stops and which channel speaks each fact (anchor-bounds)
const diagLabel = 'aria-label="System diagnostics readings — memory lanes, engine, disk, world census"';
const dlIdx = diag.indexOf(diagLabel);
const dvSlice = dlIdx > dvStart ? diag.slice(dvStart, dlIdx + diagLabel.length) : "";
ok(dvSlice.length > 0, "A1b slice reaches the region's own aria-label");

// A2 — the region speaks the full dialect inside the slice
ok(dvSlice.includes("tabIndex={0}"), "A2 readings region tabIndex={0}");
ok(dvSlice.includes('role="region"'), "A3 readings region role=region");
ok(dvSlice.includes(diagLabel), "A4 readings region honest name");

// A5 — the ring rides the region, inset (edge-to-edge honesty)
// (the className line comes AFTER the aria-label in the JSX — the slice
// runs to the next content anchor, the memory-lanes comment)
const diagRegionBlock = diag.slice(dvStart, diag.indexOf("---- memory lanes"));
ok(
  diagRegionBlock.includes("focus-visible:ring-2") &&
    diagRegionBlock.includes("focus-visible:ring-inset") &&
    diagRegionBlock.includes("focus-visible:ring-primary/50"),
  "A5 readings region visible ring, inset verse",
);

// A6 — the house shape: the content node yields the scroll
ok(
  diag.includes('className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"'),
  "A6 DialogContent takes the help-guide house shape (flex col, overflow-hidden, p-0)",
);
ok(
  diag.includes('DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6"'),
  "A7 the header pins (shrink-0 + border-b + its own padding)",
);
ok(diagRegionBlock.includes("min-h-0 flex-1"), "A8 the region owns the scroll (min-h-0 flex-1)");
// A9 — the verdict names the census blind spot and the live wound
// (whitespace-normalized: the comment's line breaks must not split facts)
const dvFlat = dvSlice.replace(/\s+/g, " ");
ok(
  dvFlat.includes("overflow-y-auto") && dvFlat.includes("overflow-auto"),
  "A9 the verdict names the class boundary (overflow-auto vs overflow-y-auto)",
);
ok(
  dvFlat.includes("932px") && dvFlat.includes("488px"),
  "A10 the live wound's numbers on file (932px of report in a 488px window)",
);
ok(
  dvFlat.includes("tabIndex=-1") && dvFlat.includes("exactly TWO tabbables"),
  "A11 the Radix modal's tabIndex=-1 and the two-tabbable face on record",
);
ok(
  dvFlat.includes("role=dialog"),
  "A12 the verdict keeps the dialog role — a stop and a role are not rivals",
);

/* ------------------------------------------------------------------ */
/* B — the shortcuts list region (the dialect at a spans-only face)     */
/* ------------------------------------------------------------------ */

const scVerdict = "t802 — the shortcuts list gains the tab stop";
const svStart = shortcuts.indexOf(scVerdict);
const scLabel = 'aria-label="Keyboard shortcut inventory — grouped by context"';
const slIdx = shortcuts.indexOf(scLabel);
const svSlice = slIdx > svStart ? shortcuts.slice(svStart, slIdx + scLabel.length) : "";
ok(svStart > -1 && svSlice.length > 0, "B1 shortcuts verdict comment + slice to its label");

ok(svSlice.includes("tabIndex={0}"), "B2 shortcuts region tabIndex={0}");
ok(svSlice.includes('role="region"'), "B3 shortcuts region role=region");
ok(svSlice.includes(scLabel), "B4 shortcuts region honest name");
// B5 — the ring rides the region (the className comes after the label;
// the slice runs to the region's first content anchor)
const scRegionBlock = shortcuts.slice(svStart, shortcuts.indexOf("{groups.length === 0"));
ok(
  scRegionBlock.includes("focus-visible:ring-2") &&
    scRegionBlock.includes("focus-visible:ring-inset"),
  "B5 shortcuts region visible ring, inset verse",
);
ok(
  scRegionBlock.includes("min-h-0 flex-1 overflow-y-auto"),
  "B5b the shortcuts region keeps its scroll container shape",
);

// B6 — the spans-only verdict on file (the t801 hover-card shape named)
ok(
  svSlice.includes("spans-only") && svSlice.includes("note-hover-card shape"),
  "B6 the spans-only verdict cites the t801 hover-card family",
);
// B7 — the face is REAL: the file holds zero <button> elements
ok(!shortcuts.includes("<button"), "B7 the shortcuts file truly has zero <button> (the face is honest)");

/* ------------------------------------------------------------------ */
/* C — the census verdicts (the blind spot + help-guide covered)        */
/* ------------------------------------------------------------------ */

// C1 — the diagnostics verdict confesses the census's blind spot
ok(
  dvSlice.includes("t801 census missed this face"),
  "C1 the verdict names the t801 census's miss",
);

// C2 — help-guide's region stays untouched: its container line unchanged
const guideRegionLine = 'className="min-h-0 flex-1 overflow-y-auto px-5 py-4"';
ok(guide.includes(guideRegionLine), "C2 help-guide region container unchanged");
ok(
  !guide.includes("guide-row-door\");\n        }} tabIndex"),
  "C2b no stop smuggled onto the guide's door rows",
);

// C3 — the covered verdict's FACT: door buttons ride inside the region
const guideRegionStart = guide.indexOf(guideRegionLine);
const guideTail = guide.slice(guideRegionStart);
ok(
  guideTail.includes('data-testid="guide-row-door"'),
  "C3 the guide's region carries its door buttons (covered by children)",
);
// C4 — and the count: seven doors registered in the manual
const doorOpens = guideTail.split("GUIDE_DOORS.find").length - 1;
ok(doorOpens === 1, "C4 the door lookup rides the row renderer (one path, seven registry entries)");
ok(
  (guide.match(/id: "/g) || []).length >= 7,
  "C5 GUIDE_DOORS registers seven doors (assistant, storage, clusters, palette, shortcuts, report, diagnostics)",
);

/* ------------------------------------------------------------------ */
/* D — the elders' regression (every prior region's dialect intact)     */
/* ------------------------------------------------------------------ */

// D1 — the roster's 2672 region (the dialect's first speaker)
const dash2672 = dash.indexOf('aria-label="Storage contents');
ok(
  dash
    .slice(dash.indexOf("tabIndex={0}"), dash2672)
    .includes('role="region"'),
  "D1 the roster's 2672 region verbatim (tabIndex + role=region)",
);

// D2 — the storage runs region (t798)
const stLabel = 'aria-label="Storage contents — disk totals and run directories"';
ok(storage.includes(stLabel) && storage.includes("tabIndex={0}"), "D2 the storage runs region (t798) intact");

// D3 — the assistant's transcript + session list (t799)
ok(
  assistant.includes('role="log"') &&
    assistant.includes('aria-label="AI assistant transcript"') &&
    assistant.includes('aria-label="Session history"'),
  "D3 the assistant's log + list (t799) intact",
);

// D4 — the engine log tail (t801)
ok(
  jobPanel.includes('aria-label="Engine log tail"') &&
    jobPanel.slice(jobPanel.indexOf("t801"), jobPanel.indexOf('aria-label="Engine log tail"')).includes("tabIndex={0}"),
  "D4 the engine log tail's stop (t801) intact",
);

// D5 — the note hover-card (t801): the SECOND HoverCardContent in the
// file (the first is another card's face) — anchor at the last one
const noteCard = jobCard.slice(jobCard.lastIndexOf("<HoverCardContent"));
ok(
  noteCard.includes("tabIndex={0}") && noteCard.includes("focus-visible:ring-2"),
  "D5 the note hover-card's stop (t801) intact",
);

// D6 — the cleanup file preview (t801): the anchor is its verdict
// comment (the preview has no testid — the comment IS the marker)
const prevIdx = cleanup.indexOf("t801 — the file preview");
ok(
  prevIdx > -1 && cleanup.slice(prevIdx, prevIdx + 500).includes("tabIndex={0}"),
  "D6 the cleanup file preview's stop (t801) intact",
);

/* ------------------------------------------------------------------ */
/* E — the scope honesty (one stop per file, the wrapper untouched)     */
/* ------------------------------------------------------------------ */

// E1 — exactly one new region in the diagnostics file
ok(
  (diag.match(/role="region"/g) || []).length === 1,
  "E1 exactly one role=region in the diagnostics file",
);
// E2 — exactly one new region in the shortcuts file
ok(
  (shortcuts.match(/role="region"/g) || []).length === 1,
  "E2 exactly one role=region in the shortcuts file",
);
// E3 — the shared wrapper gained NO blanket stop (its content stays
//      Radix's own — the cure lives in the two homes, not the house)
ok(
  !wrapper.includes("tabIndex={0}"),
  "E3 the dialog wrapper carries no blanket tabIndex (no house-wide stop)",
);
// E4 — the wrapper's t798 scroll memory + t383 cap still stand
ok(
  wrapper.includes("scrollMemoryRef") && wrapper.includes("max-h-[calc(100dvh-2rem)]"),
  "E4 the wrapper's t798 memory + t383 cap intact",
);
// E5 — no roving MACHINERY crept in (the shortcuts file's prose may
// honestly name the app's roving history — the word-forms that count
// are the machinery's: activedescendant, RovingFocusGroup)
ok(
  !diag.includes("aria-activedescendant") &&
    !shortcuts.includes("aria-activedescendant") &&
    !shortcuts.includes("RovingFocusGroup") &&
    !diag.includes("RovingFocusGroup"),
  "E5 no activedescendant / RovingFocusGroup machinery in the cured files",
);

/* ------------------------------------------------------------------ */
/* F — the history (the cap, the memory, the manual's doors)            */
/* ------------------------------------------------------------------ */

// F1 — the t383 cap comment still speaks in the wrapper
ok(
  wrapper.includes("t383") && wrapper.includes("577px"),
  "F1 the t383 short-viewport law on file in the wrapper",
);
// F2 — the diagnostics dialog's manual row (t547) still names the door
ok(
  guide.includes('id: "diagnostics"') && guide.includes("SYSTEM_DIAGNOSTICS_EVENT"),
  "F2 the manual's diagnostics door intact (t547 row, owner-listens bell)",
);
// F3 — the INSET FOCUS verse is t802's own: every elder scroll region
// speaks the outward focus-visible ring (the elder ring-inset hits are
// decorative chips — ring-1, not the focus family)
ok(
  !storage.includes("focus-visible:ring-inset") &&
    !dash.includes("focus-visible:ring-inset") &&
    !assistant.includes("focus-visible:ring-inset"),
  "F3 the elders' scroll regions keep the outward ring — inset focus is the edge-to-edge verse, t802's own",
);
// F4 — the ring-inset verse is named in the verdict prose
ok(
  dvSlice.includes("ring-inset because the region runs edge-to-edge"),
  "F4 the inset verse's reason written where the ring lives",
);

/* ------------------------------------------------------------------ */
console.log(`t802-reader-scroll-regions-unit: ${pass} pass / ${fail} fail`);
if (fail > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}

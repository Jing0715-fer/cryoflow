/**
 * t804 — the content-node houses unit: the six faces recorded in t803's J
 * arm get the t802 house surgery, one batch.
 *
 * The wound (live-witnessed on the frozen world, t804-typecard-frozen.png):
 * all six DialogContent nodes WERE the scroll surface — the old overrides
 * spoke "flex-col gap-4 overflow-y-auto" (five results dialogs) or
 * "max-h-[85vh] overflow-y-auto" (the type card), Radix's modal parks
 * tabIndex=-1 on the content node itself, and everything between the two
 * extreme tabbables was keyboard-unreachable scroll. The type card's face:
 * 1353px of dictionary page in a 488px window, exactly FIVE tabbables (three
 * downstream chips + Add + Close) — the PARAMETER REFERENCE (the hints are
 * the lib's richest prose and the card's reason to exist) unreachable.
 *
 * The cure: the t802 dialect at family scale — each DialogContent takes the
 * house shape (flex col + gap-0 + overflow-hidden + p-0), the header pins
 * (shrink-0 border-b px-6 pb-4 pt-6), and an inner region owns the scroll
 * (tabIndex={0} + role="region" + its own honest name + min-h-0 flex-1 +
 * space-y-4 + the family's inset ring). role=dialog stays — a stop and a
 * role are not rivals (t799's law, third home). The type card's footer pins
 * with border-t (the verb never scrolls away).
 *
 * Anchor-bounds lessons riding along (seven verses, all paid): the className
 * comes AFTER the aria-label in JSX (slices run downward from role="region");
 * verdict comments live OUTSIDE the element above it (slices from a comment
 * anchor run down); verdict slices are whitespace-normalized before matching;
 * a slice TO an end anchor excludes it (indexOf arithmetic); ring-inset is
 * judged in its focus-visible family form.
 */
import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const failures = [];

function ok(cond, label) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(label);
  }
}

const read = (p) => readFileSync(p, "utf8");
const dvFlat = (s) => s.replace(/\s+/g, " ");

const classConv = read("src/components/workflow/results/class-convergence-dialog.tsx");
const funnel = read("src/components/workflow/results/particle-funnel-dialog.tsx");
const postproc = read("src/components/workflow/results/postprocess-verdict-dialog.tsx");
const arc = read("src/components/workflow/results/resolution-arc-dialog.tsx");
const runCompare = read("src/components/workflow/results/run-compare-dialog.tsx");
const typeCard = read("src/components/workflow/type-card-dialog.tsx");
const wrapper = read("src/components/ui/dialog.tsx");
const t802unit = read("scripts/t802-reader-scroll-regions-unit.mjs");

/* The shared house dialect — every cure speaks it verbatim. */
const HOUSE = "flex max-h-[85vh]";
const HOUSE_TAIL = "flex-col gap-0 overflow-hidden p-0";
const PINNED_HEADER = "shrink-0 border-b px-6 pb-4 pt-6";
const REGION_CLASS =
  "min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50";
const OLD_OVERRIDE = "flex-col gap-4 overflow-y-auto sm:max-w-3xl";

/* For each file: find the t804 verdict comment, then the region open tag
 * BELOW it (the comment lives outside the element, above it — slices run
 * down). The region block runs from role="region" far enough to cover the
 * className line (which comes AFTER the aria-label — second verse). */
function regionBlock(src, startMark) {
  const c = src.indexOf(startMark);
  if (c === -1) return null;
  // the verdict comment itself runs ~750 chars — the region sits BELOW the
  // whole comment (distance budget 1600, not 400: the eighth lesson of the
  // anchor-bounds ledger — the mark is the comment's START, not its end)
  const r = src.indexOf('role="region"', c);
  if (r === -1 || r - c > 1600) return null;
  // tabIndex={0} sits ABOVE role= in the JSX attribute order — back up 60
  // chars so the slice covers the whole open tag (ninth lesson: slices
  // must cover the attribute ABOVE the anchor, not only those below)
  return src.slice(Math.max(0, r - 60), r + 700);
}

function verdictBlock(src, startMark, span = 900) {
  const c = src.indexOf(startMark);
  if (c === -1) return null;
  return dvFlat(src.slice(c, c + span));
}

/* ---------- A. class-convergence ---------- */
{
  ok(classConv.includes(`${HOUSE} w-[calc(100vw-2rem)] max-w-3xl ${HOUSE_TAIL} sm:max-w-3xl`),
    "A1 the house shape replaces the old flex-col gap-4 overflow-y-auto (width kept)");
  ok(classConv.includes(`<DialogHeader className="${PINNED_HEADER}"`),
    "A2 the header pins (shrink-0 border-b px-6 pb-4 pt-6)");
  const rb = regionBlock(classConv, "t804 — the content-node census's house cure");
  ok(rb !== null, "A3 the t804 verdict comment sits above the region (slice reaches it)");
  if (rb) {
    ok(rb.includes('aria-label="Class convergence reading — verdict, scatter, movers, census"'),
      "A4 the region's honest name");
    ok(rb.includes("tabIndex={0}") && rb.includes(REGION_CLASS),
      "A5 the full dialect: stop + min-h-0 flex-1 + space-y-4 + overflow-y-auto + the inset ring");
  }
  const vb = verdictBlock(classConv, "t804 — the content-node census's house cure");
  ok(vb !== null && vb.includes("keyboard-unreachable scroll"),
    "A6 the verdict's wound fact on file");
  ok(vb !== null && vb.includes("t799's law"),
    "A7 role=dialog stays — a stop and a role are not rivals (third home)");
  ok(!classConv.includes(OLD_OVERRIDE),
    "A8 the old gap-4 overflow-y-auto override is retired");
}

/* ---------- B. particle-funnel ---------- */
{
  ok(funnel.includes(`${HOUSE} w-[calc(100vw-2rem)] max-w-3xl ${HOUSE_TAIL} sm:max-w-3xl`),
    "B1 the house shape");
  ok(funnel.includes(`<DialogHeader className="${PINNED_HEADER}"`), "B2 the header pins");
  const rb = regionBlock(funnel, "t804 — the content-node census's house cure");
  ok(rb !== null && rb.includes('aria-label="Particle funnel reading — what each stage kept, shed, multiplied"'),
    "B3 the region's honest name (the funnel's own verb triple)");
  if (rb) ok(rb.includes("tabIndex={0}") && rb.includes(REGION_CLASS), "B4 the full dialect");
  const vb = verdictBlock(funnel, "t804 — the content-node census's house cure");
  ok(vb !== null && vb.includes("the funnel, the per-stage receipts"),
    "B5 the verdict names this face's unreachable content");
  ok(!funnel.includes(OLD_OVERRIDE), "B6 the old override retired");
}

/* ---------- C. postprocess-verdict ---------- */
{
  ok(postproc.includes(`${HOUSE} w-[calc(100vw-2rem)] max-w-3xl ${HOUSE_TAIL} sm:max-w-3xl`),
    "C1 the house shape");
  ok(postproc.includes(`<DialogHeader className="${PINNED_HEADER}"`), "C2 the header pins");
  const rb = regionBlock(postproc, "t804 — the content-node census's house cure");
  ok(rb !== null && rb.includes('aria-label="Postprocess verdict reading — three curves, three crossings, one box edge"'),
    "C3 the region's honest name (the reading's own geometry)");
  if (rb) ok(rb.includes("tabIndex={0}") && rb.includes(REGION_CLASS), "C4 the full dialect");
  const vb = verdictBlock(postproc, "t804 — the content-node census's house cure");
  ok(vb !== null && vb.includes("the ladder, the crossings, the box edge"),
    "C5 the verdict names this face's unreachable content");
  ok(!postproc.includes(OLD_OVERRIDE), "C6 the old override retired");
}

/* ---------- D. resolution-arc ---------- */
{
  ok(arc.includes(`${HOUSE} w-[calc(100vw-2rem)] max-w-3xl ${HOUSE_TAIL} sm:max-w-3xl`),
    "D1 the house shape");
  ok(arc.includes(`<DialogHeader className="${PINNED_HEADER}"`), "D2 the header pins");
  const rb = regionBlock(arc, "t804 — the content-node census's house cure");
  ok(rb !== null && rb.includes('aria-label="Resolution arc reading — the estimate curve and the plateau law"'),
    "D3 the region's honest name (curve + the law that reads it)");
  if (rb) ok(rb.includes("tabIndex={0}") && rb.includes(REGION_CLASS), "D4 the full dialect");
  const vb = verdictBlock(arc, "t804 — the content-node census's house cure");
  ok(vb !== null && vb.includes("the arc, the plateau census, the verb"),
    "D5 the verdict names this face's unreachable content");
  ok(!arc.includes(OLD_OVERRIDE), "D6 the old override retired");
}

/* ---------- E. run-compare ---------- */
{
  ok(runCompare.includes(`${HOUSE} w-[calc(100vw-2rem)] max-w-3xl ${HOUSE_TAIL} sm:max-w-3xl`),
    "E1 the house shape");
  ok(runCompare.includes(`<DialogHeader className="${PINNED_HEADER}"`), "E2 the header pins");
  const rb = regionBlock(runCompare, "t804 — the content-node census's house cure");
  ok(rb !== null && rb.includes('aria-label="Run comparison reading — the A/B verdict and its adoption verbs"'),
    "E3 the region's honest name");
  if (rb) ok(rb.includes("tabIndex={0}") && rb.includes(REGION_CLASS), "E4 the full dialect");
  const vb = verdictBlock(runCompare, "t804 — the content-node census's house cure");
  ok(vb !== null && vb.includes("between the pair pickers and the adoption verbs"),
    "E5 the verdict names this face's unreachable content");
  ok(!runCompare.includes(OLD_OVERRIDE), "E6 the old override retired");
}

/* ---------- F. type-card — the live-witnessed face ---------- */
{
  ok(typeCard.includes(`${HOUSE} ${HOUSE_TAIL} sm:max-w-lg`),
    "F1 the house shape (the card's own width kept; no w-calc — it never had one)");
  ok(typeCard.includes(`<DialogHeader className="${PINNED_HEADER}"`), "F2 the header pins");
  const rb = regionBlock(typeCard, "t804 — the content-node census's house cure");
  ok(rb !== null && rb.includes('aria-label="Type card dictionary — description, water, upstream, downstream, parameters"'),
    "F3 the region's honest name (the dictionary's five sections)");
  if (rb) ok(rb.includes("tabIndex={0}") && rb.includes(REGION_CLASS), "F4 the full dialect");
  const vb = verdictBlock(typeCard, "t804 — the content-node census's house cure", 1200);
  ok(vb !== null && vb.includes("1353px of dictionary page in a 488px window"),
    "F5 the wound's live numbers on file (1353/488)");
  ok(vb !== null && vb.includes("exactly FIVE tabbables") && vb.includes("tabIndex=-1"),
    "F6 the wound's anatomy on file (five tabbables, Radix's modal stop)");
  ok(vb !== null && vb.includes("the hints are the lib's richest prose"),
    "F7 the verdict says WHY the params mattered (the card's reason to exist)");
  ok(typeCard.includes(`<DialogFooter className="shrink-0 border-t px-6 py-4">`),
    "F8 the footer pins with border-t — the verb never scrolls away");
  ok(!typeCard.includes('max-h-[85vh] overflow-y-auto sm:max-w-lg'),
    "F9 the card's old bare overflow override retired");
  ok(!typeCard.includes(OLD_OVERRIDE),
    "F10 no results-family override ever lived here (the card's wound wore the bare form)");
}

/* ---------- G. census verdicts ---------- */
{
  /* The six files each carry exactly one new region — the family map. */
  const six = [classConv, funnel, postproc, arc, runCompare, typeCard];
  ok(six.every((s) => s.split('role="region"').length === 2),
    "G1 exactly one role=region per cured file (six faces, six regions, no blanket)");
  /* t803's J3 asserted the old override as "recorded, untouched"; the fleet
   * gate is a map-update mechanism — the amendment names the cure. */
  const t803unit = read("scripts/t803-scroll-census-second-pass-unit.mjs");
  ok(t803unit.includes("gap-0 overflow-hidden p-0") && t803unit.includes("t804"),
    "G2 t803's J3 amended to the grown map (the amendment names t804, not a loosened count)");
  ok(!wrapper.includes("tabIndex"),
    "G3 the shared wrapper carries no blanket stop (per-dialog cures only)");
  ok(t803unit.includes('phase === "error"'),
    "G4 the mol* error fallback verdict stands (its own retirement untouched)");
  const t803enum = read("scripts/t803-scroll-census-second-pass.mjs");
  ok(t803enum.includes("WIDENED net") || t803enum.includes("widen"),
    "G5 the enumeration arm's widened net stands persisted");
  ok(typeCard.includes('data-testid="type-card"') && typeCard.includes('data-testid="type-card-add"'),
    "G6 the card's testids survive the surgery (the dictionary's face unchanged)");
}

/* ---------- H. elders' regression ---------- */
{
  /* t802's two readers — the house dialect's first speakers — untouched. */
  const diag = read("src/components/workflow/system-diagnostics-dialog.tsx");
  const shortcuts = read("src/components/workflow/shortcuts-dialog.tsx");
  ok(diag.includes('aria-label="System diagnostics readings — memory lanes, engine, disk, world census"'),
    "H1 the diagnostics readings region stands");
  ok(shortcuts.includes('aria-label="Keyboard shortcut inventory — grouped by context"'),
    "H2 the shortcuts list region stands");
  /* t803's nine — three spot checks across the batch. */
  const assistant = read("src/components/ai/assistant-panel.tsx");
  ok(assistant.includes("Tool detail payload window"),
    "H3 t803's tool-detail pre stands (the engine-log shape inside the companion)");
  ok(runCompare.includes("Parameter diff table") === false && assistant.includes("Tool detail payload window"),
    "H4 the diff-table cure lives where t803 put it (not disturbed here)");
  const workspace = read("src/components/workflow/workspace-panel.tsx");
  ok(workspace.includes("tabIndex={0}") && workspace.includes("Workspaces"),
    "H5 t803's workspace ground stands (the family's second ring-inset verse)");
  /* t801's three — one spot check. */
  const jobPanel = read("src/components/workflow/job-panel.tsx");
  ok(jobPanel.includes('aria-label="Engine log tail"'),
    "H6 t801's engine log tail stands (the job PANEL's pre, not the card)");
  /* t798's runs list / t799's log+list — the roster's 2672 keeps its count. */
  const storage = read("src/components/workflow/storage-dialog.tsx");
  ok(storage.includes("2672"), "H7 the roster's 2672 stop stands");
}

/* ---------- I. scope honesty ---------- */
{
  ok(!classConv.includes("RovingFocusGroup") && !classConv.includes("aria-activedescendant") &&
     !typeCard.includes("RovingFocusGroup") && !typeCard.includes("aria-activedescendant"),
    "I1 no roving machinery in the cured faces (the prose's honest 'roving' is history's word)");
  ok((classConv.match(/focus-visible:ring-inset/g) || []).length === 1 &&
     (typeCard.match(/focus-visible:ring-inset/g) || []).length === 1,
    "I2 the inset ring is the region's own, once per file (not a blanket on the house)");
  ok(wrapper.includes("max-h-[calc(100dvh-2rem)]") && wrapper.includes("scrollMemoryRef"),
    "I3 the t383 cap and the t798 scroll memory stand in the wrapper");
  /* The pointer-face row debt is NOT cured here (one law per window) —
   * the card's chips were already buttons; the workspace, molstar and
   * particle rows keep their t784-family debt named, not fixed. */
  ok(typeCard.includes('type="button"') && typeCard.includes("type-card-upstream-chip-"),
    "I4 the card's chips keep their button faces (they always had them)");
  const vb = verdictBlock(typeCard, "t804 — the content-node census's house cure", 1200);
  ok(vb !== null && vb.includes("the census judged, not touched"),
    "I5 the front-door verdict: Import's empty upstream judged honestly, left alone");
  ok((funnel.match(/<DialogFooter/) || []).length === 0 &&
     (arc.match(/<DialogFooter/) || []).length === 0,
    "I6 the five results dialogs keep their body-flow verbs (no footer invented)");
}

/* ---------- J. history ---------- */
{
  ok(t802unit.includes("focus-visible:ring-inset"),
    "J1 the inset verse's first speaker was t802 (the diagnostics readings region)");
  ok(wrapper.includes("t383") || wrapper.includes("577px"),
    "J2 the t383 cap's reason still lives where the cap lives");
  ok(wrapper.includes("t798") || wrapper.includes("flip's scroll memory"),
    "J3 the t798 memory's reason still lives where the memory lives");
  const diag = read("src/components/workflow/system-diagnostics-dialog.tsx");
  ok(diag.includes("flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0"),
    "J4 the t802 house shape the six faces now speak was the diagnostics dialog's");
  ok(verdictBlock(classConv, "t804 — the content-node census's house cure") !== null &&
     verdictBlock(classConv, "t804 — the content-node census's house cure").includes("flex ... flex-col gap-4 overflow-y-auto"),
    "J5 the old override archived in the verdict where the next census will read it");
}

console.log(`\nt804 content-node houses unit: ${pass}/${pass + fail}`);
if (fail > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("the six faces wear the house; the census's J-arm debt is paid.");

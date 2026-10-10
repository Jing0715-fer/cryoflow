/**
 * t788-bookmark-focus-unit — the bookmark panel's focus continuity: a
 * deleted or renamed row hands the keyboard to its neighbor, never to body.
 *
 * The old world, judged live (t788 scouting): the bookmark popover's list
 * was a loose div stack of plain buttons — Tab could reach everything (8
 * rows max, NOT virtualized, so the t784 windowed-list law does not apply),
 * but pressing Delete on a focused row removed the row from the DOM with
 * zero focus management: activeElement fell to BODY mid-popover, and the
 * keyboard user's place in a 21-stop panel was gone (measured live:
 * focusAfterDelete = BODY). The same disease ran through the inline rename:
 * commit lives in onBlur (the ONE commit path), the editor unmounts on
 * commit/cancel/untouched, and focus fell to body every time.
 *
 * The t788 verdict: focus continuity is not a new keyboard path (the t783
 * verdict — inventing a second path needs a second maintenance — stands;
 * the roving/listbox upgrade stays JUDGED-DEFERRED for a non-virtualized
 * list). It is the SAME row handing the SAME keyboard to its neighbor: the
 * doomed row's index is recorded before the commit, a handoff effect runs
 * after the DOM commits, and focus lands on the neighbor row's restore
 * button — or, when the list emptied, on the name field (the next natural
 * action: save a new view).
 *
 *   A  the handoff mechanism — pendingFocusRef recorded before every
 *      commit, the renaming-row cleanup, the effect that spends it once.
 *   B  the landing contract — bmListRef on the list container, the
 *      :scope > div row query, the min(idx, len-1) neighbor math, the
 *      name-field fallback, the focus() call.
 *   C  the verdict notes on the raw channel (single-line word-form
 *      anchors only — the t781/t783 anchor lesson).
 *   D  the old contracts untouched — the filter commit, the single
 *      mutation path, the ONE rename commit path, the dupe hint, the
 *      name-field placeholder, the B quick-save hint.
 *   E  the paths NOT invented — zero listbox/activedescendant/roving
 *      word-forms anywhere in the embed (the roving upgrade stays
 *      deferred: 8 rows, non-virtualized, Tab is honest here).
 *   F  the history in the margins — t671's third mouth, t675's fourth
 *      ear, t679's defensive reads.
 *
 * Run:  node scripts/t788-bookmark-focus-unit.mjs
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

const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const strip = (s) =>
  s
    .split("\n")
    .map((l) => {
      const i = l.indexOf("//");
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join("\n");
const norm = (s) => s.replace(/\s+/g, " ");

const srcRaw = read("src/components/workflow/results/molstar-embed.tsx");
const src = strip(srcRaw);
const srcNorm = norm(srcRaw);

/* ------------------------------------------------------------------ */
/* A — the handoff mechanism                                           */
/* ------------------------------------------------------------------ */

// A1 — the ref exists: a nullable { idx } pocket between commits.
ok(src.includes("const pendingFocusRef = useRef<{ idx: number } | null>(null);"),
  "A1 pendingFocusRef is declared (nullable { idx } pocket)");

// A2 — the doomed row's index is recorded BEFORE the commit: the effect
// needs the OLD list's position to find the NEW list's neighbor.
const rmIdx = src.indexOf("const removeBookmark = (id: string) =>");
const rmFilter = src.indexOf("commitBookmarks(bookmarksRef.current.filter((x) => x.id !== id));", rmIdx);
const rmNext = src.indexOf("small JPEG snapshot", rmIdx);
ok(rmIdx >= 0 && rmFilter > rmIdx
  && src.slice(rmIdx, rmFilter).includes("pendingFocusRef.current = { idx };"),
  "A2 removeBookmark records the doomed idx before the commit");

// A3 — the doomed idx comes from the live mirror (bookmarksRef), the same
// list every commit PUTs wholesale — never from the render state.
ok(src.slice(rmIdx, rmFilter).includes("bookmarksRef.current.findIndex((x) => x.id === id)"),
  "A3 the doomed idx is read from bookmarksRef (the commit's own source)");

// A4 — deleting the row that is being renamed drops its editor: a
// rename input pointing at a dead id would be a stranded editor.
ok(src.slice(rmIdx, rmFilter).includes("if (renamingId === id) setRenamingId(null);"),
  "A4 deleting the renaming row clears its editor");

// A5 — every rename exit hands the keyboard back BEFORE the editor
// unmounts: commit, cancel and untouched all ride the same handoff
// (the assignment sits before setRenamingId(null) in commitRename).
const crIdx = src.indexOf("const commitRename = () => {");
const crAnchor = src.indexOf("setRenamingId(null);", crIdx);
ok(crIdx >= 0 && crAnchor > crIdx
  && src.slice(crIdx, crAnchor).includes("if (id) pendingFocusRef.current = { idx: bookmarksRef.current.findIndex((x) => x.id === id) };"),
  "A5 commitRename hands the keyboard back on EVERY exit (before the editor unmounts)");

// A6 — the handoff effect listens to exactly the two states a row's DOM
// identity depends on: the list (delete/commit) and the editor (cancel).
ok(src.includes("}, [bookmarks, renamingId]);"),
  "A6 the handoff effect rides [bookmarks, renamingId]");

// A7 — the pocket is spent exactly once: an empty pocket exits early, a
// live pocket is cleared before any focus work (no double-spend on a
// re-render that changes neither list nor editor).
// strip-channel anchor: the effect body is anchored by its CODE word-forms
// (the comment channel is silent here — the t787 lesson, channel before word).
const effIdx = src.indexOf("const pending = pendingFocusRef.current;");
const effEnd = src.indexOf("}, [bookmarks, renamingId]);", effIdx);
ok(effIdx >= 0 && effEnd > effIdx
  && src.slice(effIdx, effEnd).includes("if (!pending) return;")
  && src.slice(effIdx, effEnd).indexOf("pendingFocusRef.current = null;")
  < src.slice(effIdx, effEnd).indexOf("target?.focus();"),
  "A7 the pocket is spent once (early exit, cleared before focus)");

/* ------------------------------------------------------------------ */
/* B — the landing contract                                            */
/* ------------------------------------------------------------------ */

// B1 — the list container is ref'd: the effect queries rows through it,
// not through document (multi-instance embeds must not cross wires).
ok(src.includes('<div ref={bmListRef} className="mt-1.5 max-h-44'),
  "B1 bmListRef sits on the max-h-44 list container");

// B2 — rows are the container's OWN children: :scope keeps the query
// inside the ref'd list (no descendant bleed from nested stacks).
ok(src.includes('querySelectorAll<HTMLDivElement>(":scope > div")'),
  "B2 rows are queried with :scope > div inside the ref'd list");

// B3 — the neighbor math: deleting row i hands the keyboard to the row
// that NOW sits at i; deleting the last row hands it to the new last.
ok(src.includes("Math.min(pending.idx, rows.length - 1)"),
  "B3 the neighbor is min(idx, len-1) of the NEW list");

// B4 — an emptied list (or an unfindable row) hands the keyboard to the
// name field: the next natural action is saving a new view.
ok(src.includes(`closest('[data-canvas-ui="camera-bookmarks"]')`)
  && src.includes('querySelector<HTMLInputElement>("input[maxlength]")'),
  "B4 the fallback lands on the name field inside the popover root");

// B5 — the landing is a plain focus(): no scroll-into-view gymnastics —
// the popover is small, the browser's own focus-scroll is enough.
ok(effIdx >= 0 && src.slice(effIdx, effEnd).includes("target?.focus();"),
  "B5 the handoff lands with a plain focus()");

/* ------------------------------------------------------------------ */
/* C — the verdict notes (raw channel, single-line anchors)            */
/* ------------------------------------------------------------------ */

// C1 — the mechanism's one-line verdict: the neighbor, never body.
ok(srcNorm.includes("a deleted or renamed row hands the keyboard to its neighbor, never to body"),
  "C1 the verdict note: neighbor, never body");

// C2 — the effect's one-line verdict: after the DOM commits.
ok(srcNorm.includes("the handoff lands after the DOM commits: neighbor row first, name field when the list emptied"),
  "C2 the effect note: after the DOM commits");

// C3 — the removal note: the index is recorded BEFORE the commit.
ok(srcNorm.includes("focus continuity: record the doomed row's index BEFORE the"),
  "C3 the removal note: doomed idx recorded before commit");

// C4 — the rename note: every exit hands back.
ok(srcNorm.includes("every exit (commit, cancel, untouched) hands the keyboard back"),
  "C4 the rename note: every exit hands back");

/* ------------------------------------------------------------------ */
/* D — the old contracts untouched                                     */
/* ------------------------------------------------------------------ */

// D1 — the removal still rides the single mutation path: filter + commit
// (the t671 broadcast chain inherits every delete unchanged).
ok(rmFilter > rmIdx && (rmNext < 0 || rmFilter < rmNext),
  "D1 removeBookmark still rides commitBookmarks(filter)");

// D2 — the single mutation path's doc still stands (state + mirror +
// localStorage + server row move together).
ok(srcNorm.includes("single mutation path — state, synchronous mirror, localStorage and"),
  "D2 the single-mutation-path doc stands");

// D3 — the rename's ONE commit path stands: commit lives in onBlur,
// Enter just blurs, Esc raises the cancel flag first.
ok(srcNorm.includes("commit lives in onBlur (Enter just blurs) so there is exactly ONE"),
  "D3 the ONE-commit-path rename contract stands");

// D4 — the dupe-name warning chain keeps its id hook.
ok(src.includes('id="bm-name-dupe-hint"') && src.includes("aria-describedby={nameDupe ? \"bm-name-dupe-hint\" : undefined}"),
  "D4 the dupe hint chain (aria-describedby + id) stands");

// D5 — the name field still announces the next number (the t785 regrowth
// probe rides this word-form).
ok(src.includes("placeholder={bookmarks.length ? `Name view ${bookmarks.length + 1}…` : \"Name this view…\"}"),
  "D5 the placeholder still announces Name view N");

// D6 — the B quick-save hint survives in the empty state.
ok(src.includes("or press B to quick-save the current angle"),
  "D6 the empty-state B quick-save hint stands");

/* ------------------------------------------------------------------ */
/* E — the paths NOT invented                                          */
/* ------------------------------------------------------------------ */

// E1 — no listbox upgrade: the list stays a plain stack (8 rows max,
// non-virtualized — the t784 windowed-list law does not apply here, and
// the t783 verdict says a second navigation path needs a second
// maintenance). Word-boundary search — "proving" must not match "roving".
ok(!/\brole="listbox"/.test(src),
  "E1 zero listbox role in the embed (the roving upgrade stays deferred)");

// E2 — no activedescendant contract borrowed from the path browser.
ok(!/activedescendant/i.test(src),
  "E2 zero activedescendant word-forms in the embed");

// E3 — no roving-cursor machinery.
ok(!/\broving\b/.test(src),
  "E3 zero roving word-forms in the embed (word-bounded — proving is not roving)");

/* ------------------------------------------------------------------ */
/* F — the history in the margins                                      */
/* ------------------------------------------------------------------ */

// F1 — t671's third mouth still speaks (every mutation broadcasts).
ok(srcNorm.includes("the THIRD mouth speaks"),
  "F1 the t671 third-mouth note stands");

// F2 — t675's fourth ear still listens (foreign deletions are heard).
ok(srcNorm.includes("the FOURTH EAR"),
  "F2 the t675 fourth-ear note stands");

// F3 — t679's defensive reads still guard the chips renderer.
ok(srcNorm.includes("defensive reads"),
  "F3 the t679 defensive-reads note stands");

/* ------------------------------------------------------------------ */

console.log(`t788-bookmark-focus-unit: ${pass} pass / ${fail} fail`);
if (fail) {
  console.log(fails.map((f) => `  FAIL ${f}`).join("\n"));
  process.exit(1);
}

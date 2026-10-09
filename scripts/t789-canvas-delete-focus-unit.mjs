/**
 * t789-canvas-delete-focus-unit — the canvas card delete's focus relay:
 * a CONFIRMED delete hands the keyboard to the canvas itself; a cancel
 * keeps Radix's healthy hand-back to the living trigger.
 *
 * The old world, judged live (t789 scouting): deleting a card through its
 * menu (Delete… → AlertDialog → Delete) removed the card and then dropped
 * focus on BODY — Radix's default close hand-back targets the trigger the
 * dialog opened from, but that trigger (a menu item inside the deleted
 * card) had just unmounted. Measured TWICE: focusAfterDelete = BODY. The
 * same fate awaits the bulk path (the toolbar's own Delete selection
 * button survives, but the selection it belongs to does not — the toolbar
 * itself unmounts with the emptied selection). The t788 relay (bookmark
 * rows) was the first family; the canvas card is the second.
 *
 * The t789 verdict: Radix's onCloseAutoFocus is the FRONT DOOR of the
 * close-time focus hand-off — not a race with the default return, but a
 * replacement of it. preventDefault there refuses the (dead) trigger
 * return and hands the keyboard to the canvas section — t783's tab stop,
 * the keyboard's landmark: the user stands where the card used to be, one
 * Tab from the next card, one Shift+F10 from the background menu. The
 * cancel path touches nothing: the trigger is alive, Radix's default is
 * already right, and a relay that fires on cancel would steal the
 * keyboard from a healthy return.
 *
 *   A  the relay's front door — onCloseAutoFocus on both confirm
 *      dialogs, the deletedRef gate (cancel exits early), the
 *      preventDefault, the flag cleared before the hand-off, the
 *      confirm paths setting the flag.
 *   B  the landing contract — handFocusToCanvas (stable useCallback
 *      identity the memo comparator watches), the JobCard prop wire,
 *      the landing target being the section's own ref (tabIndex=0).
 *   C  the interface & the comparator — JobCardMenu's prop, JobCard's
 *      declaration + doc, the pass-through, the memo comparator field.
 *   D  the old contracts untouched — the dialog titles, the Keep job /
 *      Cancel buttons, t783's Menu-key branch, t775's arrows-only-MOVE.
 *   E  the verdict notes on the raw channel (single-line word-forms).
 *   F  the history in the margins — t783, t788, Task 177's token truce.
 *
 * Run:  node scripts/t789-canvas-delete-focus-unit.mjs
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

const cardRaw = read("src/components/workflow/job-card.tsx");
const canvasRaw = read("src/components/workflow/canvas.tsx");
const card = strip(cardRaw);
const canvas = strip(canvasRaw);
const cardNorm = norm(cardRaw);
const canvasNorm = norm(canvasRaw);

/* ------------------------------------------------------------------ */
/* A — the relay's front door                                          */
/* ------------------------------------------------------------------ */

// A1 — the single-card dialog wires the close-time hand-off: Radix's own
// hook, not a setTimeout race with the framework.
const cardDlgIdx = card.indexOf("<AlertDialogContent");
const cardDlgEnd = card.indexOf("<AlertDialogHeader", cardDlgIdx); // the open tag spans lines — anchor at the header (a bare > would hit the => arrow)
ok(cardDlgIdx >= 0 && card.slice(cardDlgIdx, cardDlgEnd).includes("onCloseAutoFocus={(e) => {"),
  "A1 the card dialog wires onCloseAutoFocus (Radix's front door)");

// A2 — the cancel path ALSO takes the hand-off: the dialog opened from a
// menu item inside the card, and the menu died when the dialog opened —
// Radix's default return is dead on BOTH exits (measured: BODY on cancel
// too). The cancel branch returns the keyboard to the LIVING card.
ok(card.slice(cardDlgIdx, cardDlgEnd).includes("e.preventDefault();")
  && card.slice(cardDlgIdx, cardDlgEnd).includes('querySelector<HTMLElement>(`[data-job="${job.id}"] [role="button"][tabindex]`)'),
  "A2 the cancel branch hands the keyboard back to the living card");

// A3 — BOTH exits refuse the dead default: preventDefault fires before
// the branch, then confirm relays to the canvas / cancel returns to the card.
ok(card.slice(cardDlgIdx, cardDlgEnd).includes("e.preventDefault();"),
  "A3 the confirmed path preventDefaults the dead return");

// A4 — the flag is cleared BEFORE the hand-off: a second close (another
// delete in the same session) must re-arm, not inherit a stale flag.
const a4seg = card.slice(cardDlgIdx, cardDlgEnd);
ok(a4seg.indexOf("deletedRef.current = false;") >= 0
  && a4seg.indexOf("deletedRef.current = false;") < a4seg.indexOf("onDeleteFocus?.();"),
  "A4 the flag is re-armed before the hand-off");

// A5 — the confirm path sets the flag BEFORE the delete runs: the close
// (and its auto-focus) happens after, so the flag must already stand.
const cardConfirmIdx = card.indexOf("deletedRef.current = true;");
const cardDelIdx = card.indexOf("void deleteJob(job.id);", cardConfirmIdx);
ok(cardConfirmIdx >= 0 && cardDelIdx > cardConfirmIdx,
  "A5 the confirm sets the flag before deleteJob runs");

// A6 — the bulk dialog keeps the SINGLE-exit relay: its trigger (the
// toolbar's Delete button) SURVIVES a cancel, so the cancel path lets
// Radix's healthy default stand — only the confirmed path redirects.
const bulkDlgIdx = canvas.indexOf("<AlertDialogContent");
const bulkDlgEnd = canvas.indexOf("<AlertDialogHeader", bulkDlgIdx); // same line-span rule
ok(bulkDlgIdx >= 0 && canvas.slice(bulkDlgIdx, bulkDlgEnd).includes("onCloseAutoFocus={(e) => {")
  && canvas.slice(bulkDlgIdx, bulkDlgEnd).includes("if (!deletedRef.current) return;")
  && canvas.slice(bulkDlgIdx, bulkDlgEnd).includes("rootRef.current?.focus();"),
  "A6 the bulk dialog relays the confirm path only (its trigger survives cancel)");

// A7 — the bulk confirm sets its flag before the store delete runs.
const bulkConfirmIdx = canvas.indexOf("deletedRef.current = true;");
const bulkDelIdx = canvas.indexOf("void deleteSelected();", bulkConfirmIdx);
ok(bulkConfirmIdx >= 0 && bulkDelIdx > bulkConfirmIdx,
  "A7 the bulk confirm sets the flag before deleteSelected runs");

/* ------------------------------------------------------------------ */
/* B — the landing contract                                            */
/* ------------------------------------------------------------------ */

// B1 — the landing pad exists and lands on the canvas's own ref.
ok(canvas.includes("const handFocusToCanvas = React.useCallback(() => {")
  && canvas.includes("rootRef.current?.focus();"),
  "B1 handFocusToCanvas lands on rootRef.current");

// B2 — the identity is stable (empty deps): the card memo comparator
// watches callback identities — a fresh function every render would
// re-render every card on every canvas pass.
ok(canvasNorm.includes("const handFocusToCanvas = React.useCallback(() => { rootRef.current?.focus(); }, []);"),
  "B2 the landing pad's identity is stable (useCallback, empty deps)");

// B3 — the wire: every card receives the relay.
ok(canvas.includes("onDeleteFocus={handFocusToCanvas}"),
  "B3 the JobCard wire passes the relay down");

// B4 — the landing target IS the keyboard landmark: the same rootRef
// ref sits on the section that carries tabIndex=0 (t783's tab stop).
const secIdx = canvas.indexOf('ref={rootRef}');
const secEnd = canvas.indexOf(">", secIdx);
ok(secIdx >= 0 && canvas.slice(secIdx, secEnd).includes('tabIndex={0}')
  && canvas.slice(secIdx, secEnd).includes('data-canvas="viewport"'),
  "B4 the landing target is the tabIndex=0 section (t783's landmark)");

/* ------------------------------------------------------------------ */
/* C — the interface & the comparator                                  */
/* ------------------------------------------------------------------ */

// C1 — JobCardMenu takes the relay and documents the second family.
ok(card.includes("onDeleteFocus?: () => void;")
  && cardNorm.includes("second family: the card unmounts, Radix's default hand-back targets a"),
  "C1 JobCardMenu's prop documents the second family");

// C2 — JobCard's own declaration names the lineage (t788 first, canvas second).
ok(cardNorm.includes("second family of the focus-continuity law (t788 was the first: the"),
  "C2 JobCardProps names the t788 lineage");

// C3 — the pass-through: JobCard hands the relay to its menu.
ok(card.includes("onDeleteFocus={onDeleteFocus}"),
  "C3 JobCard passes the relay to JobCardMenu");

// C4 — the memo comparator watches the new callback: a changed relay
// identity must re-render (correctness over memo savings).
ok(card.includes("a.onDeleteFocus !== b.onDeleteFocus"),
  "C4 the memo comparator watches onDeleteFocus");

/* ------------------------------------------------------------------ */
/* D — the old contracts untouched                                     */
/* ------------------------------------------------------------------ */

// D1 — the single-card dialog's title and copy stand.
ok(card.includes("Delete {job.name}?") && card.includes("<AlertDialogCancel>Keep job</AlertDialogCancel>"),
  "D1 the card dialog's title + Keep job stand");

// D2 — the bulk dialog's title stands.
ok(canvas.includes("Delete {sel.length} jobs?"),
  "D2 the bulk dialog's title stands");

// D3 — t783's Menu-key branch stands (the card's keyboard menu face).
ok(card.includes('e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)'),
  "D3 t783's Menu-key branch stands");

// D4 — t775's arrows-only-MOVE stands.
ok(cardNorm.includes("arrows only MOVE, they never act"),
  "D4 t775's arrows-only-MOVE stands");

// D5 — the delete confirm's undo promise stands (the toast window).
ok(card.includes("You'll get a short window to undo from the toast afterwards."),
  "D5 the undo-from-toast promise stands");

/* ------------------------------------------------------------------ */
/* E — the verdict notes (raw channel, single-line anchors)            */
/* ------------------------------------------------------------------ */

// E1 — the landing pad's note.
ok(canvasNorm.includes("the delete relay's landing pad: a confirmed delete hands the"),
  "E1 the landing-pad note is on the record");

// E2 — the gate's note (why the two dialogs diverge on cancel).
ok(canvasNorm.includes("only the confirmed one redirects the keyboard to the canvas"),
  "E2 the cancel-divergence note is on the record");

// E3 — the menu prop's note (the second family's why).
ok(cardNorm.includes("where the keyboard lands after a CONFIRMED delete (the relay's"),
  "E3 the second-family note is on the record");

/* ------------------------------------------------------------------ */
/* F — the history in the margins                                      */
/* ------------------------------------------------------------------ */

// F1 — t783's landmark is quoted as the landing's lineage.
ok(canvasNorm.includes("t783's tab stop — the keyboard's"),
  "F1 the t783 landmark lineage is on the record");

// F2 — t788's first family is quoted.
ok(canvasNorm.includes("t788") || cardNorm.includes("t788"),
  "F2 the t788 relay lineage is on the record");

// F3 — Task 177's token truce still guards the destructive buttons.
ok(cardNorm.includes("Task 177 token truce") && canvasNorm.includes("Task 177 token truce"),
  "F3 Task 177's token truce stands on both dialogs");

/* ------------------------------------------------------------------ */

console.log(`t789-canvas-delete-focus-unit: ${pass} pass / ${fail} fail`);
if (fail) {
  console.log(fails.map((f) => `  FAIL ${f}`).join("\n"));
  process.exit(1);
}

/**
 * t783-canvas-menu-keyboard-unit — the canvas context menus grow their
 * keyboard face: the Menu key / Shift+F10 opens the SAME menu through
 * the SAME path a physical right-click uses.
 *
 * The old world, judged live (agent-browser receipts): a focused card
 * + Shift+F10 opened NOTHING (the doc's "Right-click / Shift+F10"
 * promise was airborne — the browser's synthesized contextmenu never
 * arrived with usable coordinates, and in the headless live body never
 * arrived at all), and the background menu — zoom to fit, reset, tidy,
 * export PNG, copy PNG, export JSON, import JSON — had NO keyboard path
 * because the section was unreachable (no tabIndex) and nothing
 * translated the keys. t783 wires both faces with one mechanism:
 * preventDefault the key, dispatch a synthetic contextmenu MouseEvent
 * at the surface's center — the same event type, the same Radix path,
 * no second menu implementation to drift. Live receipts: the dispatched
 * menu auto-focuses its content (role=menu holds the focus), ArrowDown
 * highlights, Enter activates and closes, Escape closes.
 *
 *   A  the section's keyboard face — tabIndex 0 (a real tab stop, the
 *      click-to-focus parity), the inset focus ring (visible only to
 *      keyboard users), the keydown wired AFTER dropProps (later props
 *      win — the handler can never be overridden), the target guard
 *      (a card's bubbling keydown is the card's), the two-key judgment,
 *      preventDefault before dispatch, the section-center coordinates.
 *   B  the card's keyboard face — the branch rides AFTER the t775 arrow
 *      branch (else-if order), the same two keys, the card-center
 *      coordinates, dispatched on the card body so it bubbles into the
 *      Radix trigger, and the menu doc's promise updated to name t783.
 *   C  the old contracts untouched — Enter/Space still opens/inspects,
 *      the t775 arrows still only MOVE, the find bar's Escape still
 *      belongs to the find bar, the minimap's contextmenu swallow still
 *      guards the long-press.
 *   D  one mechanism, two inputs — exactly one synthetic dispatch per
 *      file, both speaking the same event grammar (bubbles + cancelable
 *      + button 2), the verdict notes leading their blocks on the raw
 *      channel.
 *   E  the ledger — the background menu's items untouched (the same
 *      seven actions answer), the hidden file input keeps its own
 *      tabIndex=-1 (no collision with the section's stop).
 *
 * Run:  node scripts/t783-canvas-menu-keyboard-unit.mjs
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
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

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

const cvRaw = read("src/components/workflow/canvas.tsx");
const cv = strip(cvRaw);
const jcRaw = read("src/components/workflow/job-card.tsx");
const jc = strip(jcRaw);
const fb = strip(read("src/components/workflow/canvas-find-bar.tsx"));
const mm = strip(read("src/components/workflow/canvas-minimap.tsx"));

/* ------------------------------------------------------------------ */
/* A — the section's keyboard face                                     */
/* ------------------------------------------------------------------ */

// A1 — the section becomes a real tab stop: the canvas is a named
// landmark a keyboard user can reach, and the focus target after any
// click on empty canvas (where a pointer user's right-click already was).
ok(/aria-label="Workflow canvas"\s*\n\s*tabIndex=\{0\}/.test(cv),
  "A1 the canvas section is a tab stop (tabIndex 0 beside its aria-label)");

// A2 — the focus ring is the inspector log's grammar: inset, quiet, and
// only for keyboard users (focus-visible never fires on mouse focus).
ok(/outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring\/60/.test(cv),
  "A2 the section wears the inset keyboard ring (focus-visible only)");

// A3 — the handler is wired AFTER dropProps: JSX later props win, so no
// future drop-prop growth can silently override the keyboard face.
const dropPropsAt = cv.indexOf("{...dropProps}");
const keydownAt = cv.indexOf("onKeyDown={onCanvasKeyDown}");
ok(dropPropsAt > 0 && keydownAt > 0, "A3 both props are present on the section");
ok(keydownAt > dropPropsAt, "A3 the keydown is wired after the spread (later props win)");

// A4 — the target guard: when a CARD holds the focus its keydown bubbles
// up to the section, but the card's menu is the card's to open.
ok(/if \(e\.target !== e\.currentTarget\) return;/.test(cv),
  "A4 the target guard stands down for bubbling card keydowns");

// A5 — both keys judged: the Menu key's own name AND Shift+F10 (the
// documented Windows/Linux equivalent).
ok(/e\.key !== "ContextMenu" && !\(e\.key === "F10" && e\.shiftKey\)\) return/.test(cv),
  "A5 the handler judges the Menu key and Shift+F10, nothing else");

// A6 — preventDefault comes BEFORE the dispatch: cancelling the keydown
// suppresses the browser's own synthesis (whose coordinates would be
// unpredictable) — one menu opens, never two.
const pdAt = cv.indexOf("e.preventDefault();", keydownAt - 2000);
const guarded = cv.slice(cv.indexOf("const onCanvasKeyDown"), cv.indexOf("const onCanvasKeyDown") + 1200);
ok(/e\.preventDefault\(\);/.test(guarded), "A6 the section preventDefaults the key");
ok(guarded.indexOf("e.preventDefault();") < guarded.indexOf("dispatchEvent"),
  "A6 preventDefault precedes the dispatch (the browser's synthesis stands down)");

// A7 — the synthetic event speaks the right-click grammar: bubbles so it
// reaches the Radix trigger, cancelable, button 2, coordinates at the
// section's CENTER (a predictable position that names the canvas).
ok(/new MouseEvent\("contextmenu",\s*\{\s*bubbles: true,\s*cancelable: true,\s*clientX: r\.left \+ r\.width \/ 2,\s*clientY: r\.top \+ r\.height \/ 2,\s*button: 2,/.test(norm(guarded)),
  "A7 the synthetic contextmenu is a right-click at the section's center");

// A8 — the dispatch rides rootRef (the section itself is the trigger).
ok(/rootRef\.current\?\.dispatchEvent/.test(guarded),
  "A8 the dispatch targets the section (the Radix trigger's own element)");

/* ------------------------------------------------------------------ */
/* B — the card's keyboard face                                        */
/* ------------------------------------------------------------------ */

// B1 — the branch rides AFTER the t775 arrow branch in the else-if
// chain: arrows still only MOVE, and the menu key never steals a press
// an arrow should answer.
const arrowsAt = jc.indexOf('e.key === "ArrowUp" || e.key === "ArrowDown"');
const cardMenuAt = jc.indexOf('e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)');
ok(arrowsAt > 0 && cardMenuAt > 0, "B1 both card branches are present");
ok(cardMenuAt > arrowsAt, "B1 the menu branch follows the arrows branch (else-if order)");

// B2 — the card branch does NOT require onCardNavigate: every card gets
// the menu key, navigation-capable or not.
ok(/else if \(e\.key === "ContextMenu" \|\| \(e\.key === "F10" && e\.shiftKey\)\) \{/.test(jc),
  "B2 the card branch is unconditional (no navigation capability required)");

// B3 — the card preventDefaults before dispatching (same law as A6).
const cardBlock = jc.slice(cardMenuAt, cardMenuAt + 700);
ok(cardBlock.indexOf("e.preventDefault();") >= 0 &&
   cardBlock.indexOf("e.preventDefault();") < cardBlock.indexOf("dispatchEvent"),
  "B3 the card preventDefaults before its dispatch");

// B4 — the coordinates are the CARD's center (a position that names the
// card — the menu opens where the card is, not at viewport zero).
ok(/const r = e\.currentTarget\.getBoundingClientRect\(\);/.test(cardBlock) &&
   /clientX: r\.left \+ r\.width \/ 2,\s*clientY: r\.top \+ r\.height \/ 2,/.test(norm(cardBlock)),
  "B4 the synthetic contextmenu opens at the card's center");

// B5 — dispatched on the card body (currentTarget) so the event bubbles
// up into the ContextMenuTrigger's merged props.
ok(/e\.currentTarget\.dispatchEvent/.test(cardBlock),
  "B5 the dispatch rides the card body (bubbles into the Radix trigger)");

// B6 — the doc promise is no longer airborne: the JobCardMenu doc names
// the Menu key and t783's receipt (raw channel — comments count here).
ok(/Right-click \/ Menu-key \(Shift\+F10\) menu on a job card/.test(jcRaw),
  "B6 the menu doc names the Menu key");
ok(/Since t783 the keyboard half is REAL/.test(jcRaw),
  "B6 the doc records that t783 made the promise true");
ok(/the browser's own synthesis was unreliable/.test(jcRaw),
  "B6 the doc records WHY (the old synthesis never arrived)");

/* ------------------------------------------------------------------ */
/* C — the old contracts untouched                                     */
/* ------------------------------------------------------------------ */

// C1 — Enter/Space still opens idle / inspects running (the card's
// primary keyboard contract predates and outlives the menu key).
ok(/if \(e\.key === "Enter" \|\| e\.key === " "\) \{/.test(jc) &&
   /if \(job\.status === "idle"\) onSelect\(job\.id\);\s*\n\s*else onInspect\(job\.id\);/.test(jc),
  "C1 the Enter/Space open-or-inspect contract stands");

// C2 — the t775 arrow contract stands: arrows report direction, the
// canvas resolves geometry, preventDefault keeps scroll from eating them.
ok(/onCardNavigate &&\s*\n\s*\(e\.key === "ArrowUp"/.test(jc),
  "C2 the t775 arrows-only-MOVE contract stands");

// C3 — the find bar's Escape still belongs to the find bar (its own
// preventDefault makes the page ladder stand down).
ok(/e\.key === "Escape"/.test(fb) && /closeFind\(\);/.test(fb),
  "C3 the find bar's Escape contract stands");

// C4 — the minimap's contextmenu swallow still guards the touch
// long-press (t783 added no dispatch the minimap could see).
ok(/contextmenu/.test(mm), "C4 the minimap's contextmenu guard stands");

/* ------------------------------------------------------------------ */
/* D — one mechanism, two inputs                                       */
/* ------------------------------------------------------------------ */

// D1 — exactly ONE synthetic dispatch per file: no second menu
// implementation to drift, no double-open.
eq((cv.match(/new MouseEvent\("contextmenu"/g) || []).length, 1,
  "D1 canvas.tsx speaks the synthetic contextmenu exactly once");
eq((jc.match(/new MouseEvent\("contextmenu"/g) || []).length, 1,
  "D1 job-card.tsx speaks the synthetic contextmenu exactly once");

// D2 — both dispatches use the same grammar (the shared right-click
// shape: bubbles + cancelable + button 2).
eq((cv.match(/button: 2,/g) || []).length >= 1, true, "D2 the section's event carries button 2");
eq((jc.match(/button: 2,/g) || []).length >= 1, true, "D2 the card's event carries button 2");

// D3 — the verdict notes lead their blocks on the raw channel: the
// section's doc names the one-mechanism doctrine, the card's doc names
// the airborne promise it cures.
ok(/t783 — the background menu's keyboard face/.test(cvRaw),
  "D3 the section's verdict note is on the record");
ok(/t783 — the card menu's keyboard face, made real/.test(jcRaw),
  "D3 the card's verdict note is on the record");
ok(/mechanism, two inputs/.test(cvRaw) && /mechanism, two inputs/.test(jcRaw),
  "D3 both notes speak the one-mechanism doctrine");

/* ------------------------------------------------------------------ */
/* E — the ledger                                                      */
/* ------------------------------------------------------------------ */

// E1 — the background menu's seven actions still answer: t783 changed
// how the menu OPENS, never what it offers.
for (const item of [
  "Zoom to fit workflow",
  "Reset view (100%)",
  "Tidy layout",
  "Export canvas as PNG",
  "Copy canvas as PNG image",
  "Export workflow as JSON",
  "Import workflow from JSON",
]) {
  ok(cvRaw.includes(item), `E1 the background menu keeps "${item}"`);
}

// E2 — the hidden file input keeps its tabIndex=-1: it must never
// compete with the section's new stop in the tab order.
ok(/tabIndex=\{-1\}/.test(cv), "E2 the hidden picker stays out of the tab order");

/* ------------------------------------------------------------------ */

console.log(`\nt783-canvas-menu-keyboard-unit: ${pass} passed, ${fail} failed`);
if (fails.length) {
  console.log("failures:");
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}

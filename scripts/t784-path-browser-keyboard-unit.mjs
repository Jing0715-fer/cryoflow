/**
 * t784-path-browser-keyboard-unit — the path browser grows its keyboard
 * face: the canonical aria-activedescendant listbox walk over a
 * virtualized 20,000-row listing.
 *
 * The old world, judged live (agent-browser receipts): the listbox
 * container had NO tabIndex (unreachable — zero keyboard path to the
 * list itself), its options were loose buttons (Tab could only walk the
 * ~dozen rows the virtualization window had mounted — scroll and the
 * tab order changes under the user), and no arrow key moved anything.
 * The file picker is the door every star route and pathref param walks
 * through; its keyboard face was broken by the very virtualization that
 * makes it fast. t784 wires the canonical pattern: the container holds
 * the focus (ONE tab stop), the arrows walk a cursor (one integer over
 * whichever option list is live), aria-activedescendant announces the
 * focused option without moving DOM focus, Home/End jump the ends, and
 * Enter/Space mirrors the row's own CLICK — never the double-click.
 *
 *   A  the container — role listbox ON the scroll container (one element
 *      is both: the window math and the walk share it), tabIndex 0, the
 *      inset keyboard ring, aria-activedescendant bound to the cursor,
 *      the label following the view honestly (roots / files / contents
 *      — never one word for three different lists), the keydown wired,
 *      and the inner div demoted to presentation.
 *   B  the cursor — one nullable integer, reset when the list swaps
 *      (cwd / mode / filter / roots-view / open — a cursor into a dead
 *      list would name a row that no longer exists), the count read from
 *      the live list, the option ids' word forms, the clamp, and the
 *      two scroll laws (row-math for the virtualized window, the
 *      element's own scrollIntoView for the short roots grid).
 *   C  the key contract — ArrowDown from no cursor lands on row 0,
 *      ArrowUp on the last row (a walk must start somewhere), Home/End
 *      jump the ends, Enter/Space activate, every branch preventDefaults
 *      first (the container never eats its own keys), and an empty list
 *      stands down.
 *   D  the activation law — Enter mirrors the ROW'S OWN CLICK: a cursor
 *      folder enters (the same path word-form the click uses), a cursor
 *      file picks (single-file) or toggles (multi), and a read-only row
 *      answers with an honest no-op — the same silence a pointer user
 *      gets clicking it.
 *   E  the option faces — all four branches carry their id (announced
 *      via activedescendant) and the cursor's persistent tone (hover
 *      paints the pointer's candidate, this paints the keyboard's — same
 *      family, one shade firmer); the selection wash still wins the
 *      file row's face; aria-posinset/setsize and aria-selected stand.
 *   F  the ledger — the shortcuts dialog pays BOTH debts: the new
 *      Path browser group (three rows verbatim) and the t783 Menu/⇧F10
 *      row the touch group owed.
 *   G  the old contracts untouched — the t312 virtualization math, the
 *      manual path input's Enter, the Escape ladder (qa61's dialog
 *      layering), the rows' own click and double-click handlers.
 *
 * Run:  node scripts/t784-path-browser-keyboard-unit.mjs
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

const pbRaw = read("src/components/workflow/path-browser-dialog.tsx");
const pb = strip(pbRaw);
const scRaw = read("src/components/workflow/shortcuts-dialog.tsx");
const sc = strip(scRaw);

/* ------------------------------------------------------------------ */
/* A — the container                                                   */
/* ------------------------------------------------------------------ */

// A1 — role listbox and tabIndex 0 on the SAME element as the scroll
// ref: the window math and the walk share one container.
const containerBlock = pb.slice(pb.indexOf('ref={listScrollRef}'), pb.indexOf('ref={listScrollRef}') + 1800);
ok(/ref=\{listScrollRef\}/.test(containerBlock) &&
   /role="listbox"/.test(containerBlock) &&
   /tabIndex=\{0\}/.test(containerBlock),
  "A1 the scroll container IS the listbox (role + tabIndex on one element)");

// A2 — aria-activedescendant bound to the cursor's id expression.
ok(/aria-activedescendant=\{cursorOptionId\}/.test(containerBlock),
  "A2 aria-activedescendant announces the cursor row");

// A3 — the label follows the view honestly: three views, three words.
ok(/"Filesystem roots"/.test(containerBlock) &&
   /"Files in this folder"/.test(containerBlock) &&
   /"Folder contents"/.test(containerBlock),
  "A3 the label names the live list (roots / files / contents)");
ok(!/aria-label="Folders"/.test(pb),
  "A3 the old one-word-for-three-lists label is gone");

// A4 — the inset keyboard ring (the t783 grammar for big surfaces).
ok(/outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring\/60/.test(containerBlock),
  "A4 the container wears the inset keyboard ring (focus-visible only)");

// A5 — the keydown is wired on the container.
ok(/onKeyDown=\{onListKeyDown\}/.test(containerBlock),
  "A5 the container's keydown is wired");

// A6 — the inner div is demoted to presentation (one listbox, not two).
ok(/<div role="presentation" className="p-1">/.test(pb),
  "A6 the inner wrapper is presentation (the role moved out)");

/* ------------------------------------------------------------------ */
/* B — the cursor                                                      */
/* ------------------------------------------------------------------ */

// B1 — one nullable integer.
ok(/const \[cursor, setCursor\] = React\.useState<number \| null>\(null\);/.test(pb),
  "B1 the cursor is one nullable integer");

// B2 — the reset effect rides ALL FIVE list-identity deps.
ok(/setCursor\(null\);/.test(pb) &&
   /\[cwd, activeMode, needle, inRootsView, open\]/.test(pb),
  "B2 the cursor resets when the list swaps (all five deps carried)");

// B3 — the count reads the LIVE list (roots or entries, never both).
ok(/const optionCount = inRootsView \? \(data\?\.roots \?\? \[\]\)\.length : visibleEntries\.length;/.test(pb),
  "B3 the count reads the live option list");

// B4 — the option id word forms.
ok(/`pb-root-\$\{cursor\}`/.test(pb) && /`pb-opt-\$\{cursor\}`/.test(pb),
  "B4 the announced ids speak both word forms (roots and options)");

// B5 — the clamp: a walk can never leave the list.
ok(/Math\.max\(0, Math\.min\(optionCount - 1, next\)\)/.test(pb),
  "B5 the walk clamps into the live list");

// B6 — the two scroll laws: row math for the virtualized window (the
// same channel the window reads), the element's own scrollIntoView for
// the short roots grid.
ok(/const rowTop = clamped \* LIST_ROW_PX;/.test(pb) &&
   /rowTop < el\.scrollTop/.test(pb) &&
   /rowTop \+ LIST_ROW_PX > el\.scrollTop \+ LIST_VIEW_PX/.test(pb),
  "B6 the folder view scrolls by the exact row pitch");
ok(/scrollIntoView\(\{ block: "nearest" \}\)/.test(pb),
  "B6 the roots view borrows the element's own scrollIntoView");

/* ------------------------------------------------------------------ */
/* C — the key contract                                                */
/* ------------------------------------------------------------------ */

const keyBlock = pb.slice(pb.indexOf("const onListKeyDown"), pb.indexOf("const displayedMode"));

// C1 — the empty list stands down.
ok(/if \(optionCount === 0\) return;/.test(keyBlock),
  "C1 an empty list answers nothing");

// C2 — the walks: ArrowDown from no cursor lands on row 0, ArrowUp on
// the last row; from a cursor they step.
ok(/moveTo\(cursor == null \? 0 : cursor \+ 1\)/.test(keyBlock),
  "C2 ArrowDown starts the walk at row 0");
ok(/moveTo\(cursor == null \? optionCount - 1 : cursor - 1\)/.test(keyBlock),
  "C2 ArrowUp starts the walk at the last row");
ok(/moveTo\(0\)/.test(keyBlock) && /moveTo\(optionCount - 1\)/.test(keyBlock),
  "C2 Home and End jump the ends");

// C3 — Enter/Space activate.
ok(/ev\.key === "Enter" \|\| ev\.key === " "/.test(keyBlock) &&
   /activateCursor\(\)/.test(keyBlock),
  "C3 Enter and Space activate the cursor");

// C4 — every branch preventDefaults FIRST (the container never eats its
// own keys: arrows would scroll, Space would scroll, Enter is ours).
const pdCount = (keyBlock.match(/ev\.preventDefault\(\)/g) || []).length;
eq(pdCount, 5, "C4 all five branches preventDefault");

/* ------------------------------------------------------------------ */
/* D — the activation law                                              */
/* ------------------------------------------------------------------ */

const actBlock = pb.slice(pb.indexOf("const activateCursor"), pb.indexOf("const onListKeyDown"));

// D1 — no cursor, no activation.
ok(/if \(cursor == null\) return;/.test(actBlock),
  "D1 activation answers only a live cursor");

// D2 — a cursor root enters (the same setCwd the click uses).
ok(/const r = \(data\?\.roots \?\? \[\]\)\[cursor\];/.test(actBlock) &&
   /if \(r\) setCwd\(r\.path\);/.test(actBlock),
  "D2 a cursor root enters");

// D3 — the folder word-form is the CLICK's word-form verbatim (one path
// builder, two inputs). Anchor by includes — the template literal's
// backslashes tangle regexes (the t781 lesson: anchor on the word, not
// the punctuation).
ok(actBlock.includes('setCwd(currentPath ? `${currentPath.replace(/[\\\\/]$/, "")}/${e.name}` : e.name);'),
  "D3 the folder path word-form matches the click's verbatim");

// D4 — a cursor file picks or toggles (single vs multi), by abs.
ok(/activeMode === "files" && e\.abs/.test(actBlock) &&
   /if \(singleFile\) pick\(e\.abs\);/.test(actBlock) &&
   /else toggleFile\(e\.abs\);/.test(actBlock),
  "D4 a cursor file picks (single) or toggles (multi)");

// D5 — the read-only row falls off the else-if chain with NO branch: an
// honest no-op, the same silence a pointer user gets clicking it.
ok(!/else \{/.test(actBlock),
  "D5 read-only rows answer nothing (no else branch to invent a behavior)");

/* ------------------------------------------------------------------ */
/* E — the option faces                                                */
/* ------------------------------------------------------------------ */

// E1 — all four branches carry their id (announced via activedescendant).
eq((pb.match(/id=\{`pb-root-\$\{idx\}`\}/g) || []).length, 1,
  "E1 the roots branch carries its id");
eq((pb.match(/id=\{`pb-opt-\$\{rowIdx\}`\}/g) || []).length, 3,
  "E1 all three entry branches carry their id");

// E2 — the cursor's persistent tone: hover paints the pointer's
// candidate, this paints the keyboard's (same family, one shade firmer).
const toneLines = pb.split("\n").filter((x) => x.includes("cursor ===") && x.includes("bg-secondary/70")).length;
eq(toneLines, 4, "E2 the cursor tone rides all four branches");
ok(/cursor === rowIdx && !selected\.has\(e\.abs\) && "bg-secondary\/70/.test(pb),
  "E2 the selection wash still wins the file row's face");
ok(/cursor === rowIdx && "bg-secondary\/70 text-foreground\/80"/.test(pb),
  "E2 the read-only row's cursor tone lifts its muted face");

// E3 — the listbox semantics stand: posinset/setsize and selected.
ok(/aria-posinset=\{rowIdx \+ 1\}/.test(pb) && /aria-setsize=\{visibleEntries\.length\}/.test(pb),
  "E3 the windowed rows keep their position semantics");
ok(/aria-selected=\{singleFile \? false : selected\.has\(e\.abs\)\}/.test(pb),
  "E3 the file rows keep their selection semantics");

/* ------------------------------------------------------------------ */
/* F — the ledger                                                      */
/* ------------------------------------------------------------------ */

// F1 — the new Path browser group, three rows verbatim.
ok(/id: "path-browser",/.test(sc) && /label: "Path browser",/.test(sc),
  "F1 the Path browser group exists");
ok(/Inside the file\/folder picker — walk a 20,000-row listing without the mouse/.test(sc),
  "F1 the group's hint names the windowed reality");
ok(/Move the listing's cursor — ArrowDown lands on row 0, ArrowUp on the last row/.test(sc),
  "F1 the arrows row is on the books");
ok(/Jump the cursor to the first \/ last row — the windowed list scrolls to keep it visible/.test(sc),
  "F1 the Home/End row is on the books");
ok(/Open the cursor folder · pick or toggle the cursor file \(read-only rows stay silent\)/.test(sc),
  "F1 the Enter/Space row is on the books");

// F2 — the t783 debt: the Menu/⇧F10 row the touch group owed.
ok(/keys: "Menu ⇧F10", text: "The keyboard's right-click — the focused card's menu, or the canvas menu when the canvas holds the focus \(since t783\)"/.test(sc),
  "F2 the t783 Menu/⇧F10 row is on the books");
ok(/"Right-click", text: "Quick-action menu on a card \(run · duplicate · delete …\)"/.test(sc),
  "F2 the pointer's right-click row stands beside it");

/* ------------------------------------------------------------------ */
/* G — the old contracts untouched                                     */
/* ------------------------------------------------------------------ */

// G1 — the t312 virtualization math stands (the walk reads it, never
// rewrites it).
ok(/const LIST_ROW_PX = 30;/.test(pb) && /const LIST_VIEW_PX = 288;/.test(pb) && /const LIST_OVERSCAN = 8;/.test(pb),
  "G1 the window math constants stand");
ok(/Math\.floor\(listScrollTop \/ LIST_ROW_PX\) - LIST_OVERSCAN/.test(pb),
  "G1 the translateY window math stands");

// G2 — the manual path input's Enter stands (wildcard → pattern preview).
ok(/if \(ev\.key === "Enter" && manual\.trim\(\)\)/.test(pb) &&
   /\/\[\*\?\]\/\.test\(manual\.trim\(\)\)\) setMode\("files"\);/.test(pb),
  "G2 the manual input's Enter contract stands");

// G3 — the Escape ladder stands (qa61's dialog layering depends on it).
ok(/onEscapeClose\(\(\) => onOpenChange\(false\)\)/.test(pb),
  "G3 the Escape ladder stands");

// G4 — the rows' own pointer contracts stand: click and double-click.
ok(/single click on a folder = enter it \(fast nav\)/.test(pbRaw),
  "G4 the folder click's verdict note stands");
ok((pb.match(/onDoubleClick=/g) || []).length === 2,
  "G4 the folder double-click stands (roots and dir rows, both calling setCwd)");

/* ------------------------------------------------------------------ */

console.log(`\nt784-path-browser-keyboard-unit: ${pass} passed, ${fail} failed`);
if (fails.length) {
  console.log("failures:");
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}

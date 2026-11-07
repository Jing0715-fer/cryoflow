#!/usr/bin/env node
/**
 * t1001-dirty-draft-unit — the census's 34th instrument.
 *
 * THE STORY: the second dirty-draft census swept the family's other
 * text doors for the close-keeps-draft shape (the t1000 entry's
 * candidate — the create dialog was cured, the family was not). The
 * census's NEW classification dimension is the state's MOUNT MODEL —
 * where the draft state lives decides its fate:
 *
 *   unmount-clears  — the draft lives inside the DialogContent's
 *                     subtree (cmdk palette, the shelf's searchQ, the
 *                     remote editor's verifyInput, the inspector's tab
 *                     consoles): the Radix close unmounts it, the
 *                     state dies with the DOM. CLEAN BY ANATOMY — the
 *                     census's first false positive was exactly this
 *                     (the shelf's searchQ), caught by tsc before it
 *                     could ship.
 *   open-resets     — the draft lives in a permanently-mounted owner
 *                     but an effect re-seeds it on every open
 *                     (ai-settings' provider switch, the project
 *                     create form, the profiles' load()). CLEAN BY
 *                     HYGIENE.
 *   door-mouth      — (cured this window) the bookmark popover: the
 *                     name state lives in the canvas — a component
 *                     that NEVER unmounts — and every close path now
 *                     routes through ONE mouth that clears the draft.
 *   silent-survivor — (cured this window) the help guide's search:
 *                     the dialog body never unmounts and nothing
 *                     reset the query, so the last search silently
 *                     survived the close and shrank the next open's
 *                     world. Now an open-reset owns it (the find
 *                     bar's own ephemeral law, carried home).
 *
 * THE CONTRACT PINNED (in-process includes — the capture-layer law
 * t957 pinned: never a plain-text echo of source bytes):
 *   Q1  the bookmark popover's one mouth exists (openBookmarksDoor:
 *       the open set AND the draft cleared on close — the exact pair).
 *   Q2  the law lives in the source ("the bookmarks popover's doors
 *       keep no draft" — the comment IS the contract's home).
 *   Q3  the Radix door routes through the mouth
 *       (`onOpenChange={openBookmarksDoor}`) and the raw
 *       `onOpenChange={setBookmarksOpen}` is GONE.
 *   Q4  the success path keeps its own already-emptying form — both
 *       riders (Enter and the Save button) clear the name on a saved
 *       bookmark (saving is not closing — the popover stays open).
 *   Q5  the guide's open-reset exists (the effect's exact body:
 *       `if (open) setQuery("")` under an `[open]` dep).
 *   Q6  the guide's law lives in the source ("the guide's search lens
 *       is ephemeral").
 *   Q7  the find bar's ephemeral law still holds in the store (the
 *       closeFind needle: open, query, status, category, noted — all
 *       five cleared at the one mouth; the census's clean-face
 *       tripwire).
 *   Q8  the census's A6 exclusion law at file scope in BOTH cured
 *       files (canvas and help-guide carry no literal disabled prop —
 *       the literals are design decisions, not census population).
 *   Q9  the walk exists and names its receipt.
 *   Q10 the walk rides the family's shared skeleton (walk-kit import —
 *       the t991 kit law; no copy-pasted organs).
 *
 *   node scripts/t1001-dirty-draft-unit.mjs
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import url from "url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const CANVAS = path.join(ROOT, "src/components/workflow/canvas.tsx");
const GUIDE = path.join(ROOT, "src/components/workflow/help-guide-dialog.tsx");
const STORE = path.join(ROOT, "src/lib/store.ts");
const WALK = path.join(ROOT, "scripts/t1001-dirty-draft-walk.mjs");

const canvas = readFileSync(CANVAS, "utf8");
const guide = readFileSync(GUIDE, "utf8");
const store = readFileSync(STORE, "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

/* ---- the bookmark popover's door-mouth (canvas.tsx) ---- */

/* Q1 — the one mouth exists, and it is EXACTLY the pair (set open + clear on close) */
ok("Q1 the one mouth exists (openBookmarksDoor clears the draft on close)",
  /openBookmarksDoor = React\.useCallback\(\(o: boolean\) => \{\s*\n\s*setBookmarksOpen\(o\);\s*\n\s*if \(!o\) setBookmarkName\(""\);\s*\n\s*\}, \[\]\);/.test(canvas));

/* Q2 — the law's home is the source */
ok("Q2 the law lives in the source comment",
  canvas.includes("the bookmarks popover's doors keep no draft"));

/* Q3 — the Radix door routes through the mouth; the raw form is gone */
ok("Q3 the popover door routes through the mouth",
  canvas.includes(`onOpenChange={openBookmarksDoor}`));
ok("Q3b the raw onOpenChange={setBookmarksOpen} is GONE",
  !canvas.includes(`onOpenChange={setBookmarksOpen}`));

/* Q4 — the success path keeps its own already-emptying riders (saving is not closing) */
ok("Q4 the success path clears the name (Enter rider)",
  /if \(e\.key === "Enter" && bookmarkName\.trim\(\)\) \{\s*\n\s*if \(saveViewportBookmark\(bookmarkName\)\) setBookmarkName\(""\);\s*\n\s*\}/.test(canvas));
ok("Q4b the success path clears the name (Save button rider)",
  /onClick=\{\(\) => \{\s*\n\s*if \(saveViewportBookmark\(bookmarkName\)\) setBookmarkName\(""\);\s*\n\s*\}\}/.test(canvas));

/* ---- the help guide's open-reset (help-guide-dialog.tsx) ---- */

/* Q5 — the open-reset exists (exact body, [open] dep) */
ok("Q5 the guide's open-reset exists (if (open) setQuery(''))",
  /React\.useEffect\(\(\) => \{\s*\n\s*if \(open\) setQuery\(""\);\s*\n\s*\}, \[open\]\);/.test(guide));

/* Q6 — the law's home is the source */
ok("Q6 the law lives in the source comment",
  guide.includes("the guide's search lens is ephemeral"));

/* ---- the family's clean-face tripwire (store.ts) ---- */

/* Q7 — the find bar's ephemeral law still holds (the one-mouth clear of all five) */
ok("Q7 the find bar's closeFind clears all five (the ephemeral law holds)",
  store.includes(`closeFind: () => set({ findOpen: false, findQuery: "", findStatus: "all", findCategory: "all", findNoted: false })`));

/* ---- the census's A6 exclusion law at file scope (both cured files) ---- */

/* Q8 — no literal disabled prop in either cured file */
ok("Q8a no literal disabled prop in canvas.tsx (the design-exclusion law)",
  !canvas.includes(`disabled={true}`) && !canvas.includes(`disabled={false}`));
ok("Q8b no literal disabled prop in help-guide-dialog.tsx (the design-exclusion law)",
  !guide.includes(`disabled={true}`) && !guide.includes(`disabled={false}`));

/* ---- the walk ---- */

/* Q9 — the walk is in the tree */
ok("Q9 the walk exists and names its receipt",
  existsSync(WALK) && readFileSync(WALK, "utf8").includes("t1001-dirty-draft-walk.json"));

/* Q10 — the kit law */
ok("Q10 the walk rides the shared skeleton",
  existsSync(WALK) && readFileSync(WALK, "utf8").includes('from "./walk-kit.mjs"'));

console.log(`== t1001-dirty-draft-unit ${pass}/${pass + fail} green ==`);
process.exit(fail === 0 ? 0 : 1);

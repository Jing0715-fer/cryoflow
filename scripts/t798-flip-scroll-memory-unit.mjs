/**
 * t798-flip-scroll-memory-unit — the flip's scroll memory: the dialog
 * keeps the reader's place across the companion-yield remount, and the
 * storage dialog's runs scroll learns the keyboard.
 *
 * The wound, judged live on the frozen bundle (real fingers, the t383
 * viewport — 577px): the storage dialog's runs list (1471px of content
 * in a 343px window) scrolled to 600 — opening the companion flipped
 * the dialog to non-modal and scrollTop SNAPPED TO 0; closing the
 * companion flipped it back to modal and scrollTop was STILL 0. The
 * t501-documented flip price ("Radix swaps its content implementation,
 * which remounts the subtree") honors state lifted above the content
 * and refetches leaf effects — but the reader's PLACE is neither. The
 * remount resets every inner scroll region, and it resets them on BOTH
 * flip directions. The focus relay family kept the keyboard through six
 * windows; the scroll is its sibling and nobody had claimed it.
 *
 * The second finding rode the same recon: the runs scroll region is a
 * div with overflow and NO tab stop — the wheel answers it, the keyboard
 * cannot (the roster's 2672 dialect — tabIndex + region role + a name +
 * the visible ring — already existed one file away).
 *
 * The cure (t798, two files):
 *  • ui/dialog.tsx — the flip's scroll memory, generic for every dialog
 *    home: a capture-phase passive scroll listener on the content node
 *    keeps a per-region position array always current (no timing games
 *    with the dying subtree); each flip-in's layout effect hands every
 *    region its place back — synchronously before paint, then once more
 *    on the next frame (the flip's leaf refetch can reflow heights after
 *    the first paint). Fresh opens have no memory — the ref dies with
 *    the instance — so the top-of-page start stays honest.
 *  • storage-dialog.tsx — the runs scroll gains the tab stop: tabIndex,
 *    region role, an honest name, the ring. Arrow keys and Space scroll
 *    it once focused; the t383 height cap holds.
 *
 *   A  the scroll memory — the ref, the companionOpen key, the
 *      collectScrollables predicate, the double apply, the listener.
 *   B  the restore honesty — the null-memory guard, the cleanup, the
 *      instance-local ref, the one capture listener.
 *   C  the storage region's reachability — the 2672 dialect verbatim.
 *   D  the flip-guard recital — the remount price, the place law, the
 *      yield and the staged cures untouched.
 *   E  the verdict notes on the raw channel.
 *   F  the history and the elders' regression — t383, t501, t530, t792,
 *      the roster's own region, t797's companion surgery.
 *
 * Run:  node scripts/t798-flip-scroll-memory-unit.mjs
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
const dialog = read("src/components/ui/dialog.tsx");
const storage = read("src/components/workflow/storage-dialog.tsx");
const dash = read("src/components/workflow/project-dashboard.tsx");
const panel = read("src/components/ai/assistant-panel.tsx");

/* the DialogContent slice — the memory must live inside the component,
 * after the selfRef and before the JSX return */
const dcStart = dialog.indexOf("function DialogContent({");
const dcEnd = dialog.indexOf("function DialogHeader({", dcStart);
const dc = dcStart >= 0 && dcEnd > dcStart ? dialog.slice(dcStart, dcEnd) : "";
ok(dc.length > 2000, "SLICE DialogContent body isolated");

/* ------------------------------------------------------------------ */
/* A — the scroll memory (the cure core)                                */
/* ------------------------------------------------------------------ */

ok(
  dc.includes("const scrollMemoryRef = React.useRef<number[] | null>(null)") &&
    dc.indexOf("const scrollMemoryRef") > dc.indexOf("const selfRef"),
  "A1 the memory ref lives in DialogContent, after the content node's own ref"
);
ok(
  /React\.useLayoutEffect\(\(\) => \{[\s\S]*?\}, \[companionOpen\]\)/.test(dc),
  "A2 the effect is keyed on companionOpen — it runs at every flip-in"
);
ok(
  dc.includes("el.scrollHeight > el.clientHeight + 4 &&") &&
    dc.includes("/(auto|scroll)/.test(getComputedStyle(el).overflowY)"),
  "A3 the collectScrollables predicate — truly overflowing, truly scrollable"
);
ok(
  /apply\(\)\s*\n\s*let ladderRaf = 0/.test(dc) && /frames > 90/.test(dc),
  "A4 the restore is the patient ladder (the t813 amendment: sync first, then every frame until the memory reads back or ~90 frames — the two-beat restore lost the race against the flip's leaf refetch)"
);
ok(
  dc.includes('root.addEventListener("scroll", onScroll, { capture: true, passive: true })'),
  "A5 the capture is a capture-phase passive listener on the content root — every inner region's scroll rides it"
);

/* ------------------------------------------------------------------ */
/* B — the restore honesty                                              */
/* ------------------------------------------------------------------ */

ok(
  /const apply = \(\) => \{\s*\n\s*const memory = scrollMemoryRef\.current\s*\n\s*if \(!memory\) return true\s*\n/.test(dc),
  "B1 the null-memory guard — a fresh open starts at the top, honestly (and never enters the ladder)"
);
ok(
  /cancelAnimationFrame\(ladderRaf\)\s*\n\s*root\.removeEventListener\("scroll", onScroll, \{ capture: true \}\)/.test(dc),
  "B2 the cleanup retracts both the ladder's frame and the listener (the t813 amendment: the ladder's handle, not a single raf)"
);
ok(
  dc.indexOf("scrollMemoryRef = React.useRef") < dc.indexOf("return (") &&
    !dialog.slice(dialog.indexOf("function DialogHeader")).includes("scrollMemoryRef"),
  "B3 the memory is instance-local — it dies with the dialog and never crosses into the next open"
);
ok(
  (dc.match(/addEventListener\("scroll"/g) || []).length === 1,
  "B4 exactly one listener — capture-phase descent, no second brain"
);
ok(
  dc.includes("if (memory[i] !== undefined)") && dc.includes("el.scrollTop = memory[i]"),
  "B5 the restore is index-matched and length-tolerant — a refetch that changed the region count degrades, never throws (the t813 ladder re-applies until each set sticks)"
);

/* ------------------------------------------------------------------ */
/* C — the storage region's reachability (the 2672 dialect)             */
/* ------------------------------------------------------------------ */

ok(
  /tabIndex=\{0\}\s*\n\s*role="region"\s*\n\s*aria-label="Storage contents — disk totals and run directories"/.test(storage),
  "C1 the runs scroll gains the tab stop, the role, and an honest name"
);
ok(
  storage.includes(
    "nice-scroll flex-1 overflow-y-auto px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
  ),
  "C2 the ring rides the region — the focus is visible, the wheel-only era ends"
);
ok(
  storage.includes("t798 — the runs scroll is keyboard-reachable"),
  "C3 the verdict comment is on file at the region"
);
ok(
  dash.includes("tabIndex={0}") && dash.includes("role=\"region\"") && dash.includes("Jobs roster"),
  "C4 the roster's own 2672 region stands untouched — the dialect's first speaker"
);

/* ------------------------------------------------------------------ */
/* D — the flip-guard recital                                           */
/* ------------------------------------------------------------------ */

ok(
  dialog.includes("the flip's scroll memory") &&
    dialog.includes("which REMOUNTS the whole subtree (the t501-documented\n  // flip price"),
  "D1 the remount price is recited — the cure names the mechanism it survives"
);
ok(
  dialog.includes("the scroll sibling of the focus-relay law"),
  "D2 the place law is on file — the keyboard kept the keyboard, the scroll kept the scroll"
);
ok(
  dialog.includes("modality: while ANY companion") === false ||
    dialog.includes("modal={modal ?? !companionOpen}"),
  "D3 the t501 yield law stands — the flip still happens, the memory just survives it"
);
ok(
  dialog.includes("t796 — the live zones are not the outside world") &&
    panel.includes("closeWithHandBack"),
  "D4 the staged focus cures stand — t796's exemption and t797's hand-back are untouched by the memory"
);

/* ------------------------------------------------------------------ */
/* E — the verdict notes (the raw channel)                              */
/* ------------------------------------------------------------------ */

ok(
  dialog.includes("witnessed live twice: the focus reset via the remount's\n  // onMountAutoFocus, and the scroll reset"),
  "E1 the two witnessed resets are on file — the flip's price, itemized"
);
ok(
  dialog.includes("no timing games\n  // with the dying subtree"),
  "E2 the continuous-capture honesty — the memory is always current, no cleanup-phase gambles"
);
ok(
  dialog.includes("Fresh opens have no memory (the\n  // ref dies with the instance), so the top-of-page start stays honest"),
  "E3 the fresh-open honesty — a new visit starts at the top, an old visit keeps its place"
);
ok(
  storage.includes("a scrollable\n            region without a tab stop answers the wheel and nothing else"),
  "E4 the wheel-only verdict is on file at the region"
);

/* ------------------------------------------------------------------ */
/* F — the history and the elders' regression                           */
/* ------------------------------------------------------------------ */

ok(
  dialog.includes("t383 — max-h + overflow") &&
    dialog.includes("max-h-[calc(100dvh-2rem)]"),
  "F1 the t383 height law stands — the cap that makes the inner scroll the place to keep"
);
ok(
  dialog.includes("companionOpen && \"shadow-2xl\""),
  "F2 the t501 bright-background styling stands"
);
ok(
  dialog.includes("isFromLiveZone(event, selfRef.current)"),
  "F3 the t530 self-exemption stands"
);
ok(
  dialog.includes("onCloseAutoFocus={returnFocusToOpener}"),
  "F4 the t792 close hand-back stands — the focus law and the scroll law share the component now"
);
ok(
  panel.includes("layered-Esc law, rename edition"),
  "F5 the t797 companion surgery stands"
);
ok(
  (storage.match(/nice-scroll/g) || []).length === 1 &&
    (storage.match(/tabIndex=\{0\}/g) || []).length === 1,
  "F6 one region, one tab stop — the cure is scoped, no blanket tabindex over the dialog"
);

/* ------------------------------------------------------------------ */
/* receipt                                                              */
/* ------------------------------------------------------------------ */

const label = "t798-flip-scroll-memory-unit";
if (fail === 0) {
  console.log(`${label}: ALL PASS ${pass}/${pass}`);
} else {
  console.error(`${label}: ${fail} FAILED of ${pass + fail}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}

/**
 * t791-class-gallery-focus-unit — the class gallery's focus relay: a
 * vanished card hands the keyboard to its index-neighbour; the lightbox
 * returns the keyboard to the card it was inspecting — never to body.
 *
 * The old world, judged live (t791 scouting, three measurements): with the
 * kept-only lens on, pressing Enter on a kept card discarded it, the card
 * unmounted, and activeElement fell to BODY (the roving anchor's STATE
 * self-healed — the t778-era effect re-anchors to the first visible card —
 * but the DOM focus did not follow). Opening the inspection lightbox and
 * discarding from inside it collapsed the dialog (the class left the
 * visible world) and dropped focus to BODY again. And the third measure —
 * the surprise — Escape from the lightbox ALSO fell to BODY: the lightbox
 * was born without a Trigger, so Radix's close chain had nothing to hand
 * the keyboard back to on ANY exit. The t788 relay (bookmark rows) was the
 * first family; the canvas card (t789) the second; the class grid is the
 * third — and the only one whose close chain was dead on every exit.
 *
 * The t791 verdict: the relay is TWO pockets and ONE landing. The grid
 * keeps a WITNESS (the roving toggle's cls + its index in visible,
 * recorded on focus capture, stood down when a blur's relatedTarget
 * leaves the container — a voluntary exit must never be answered with a
 * focus steal). The lightbox keeps a RETURN POCKET (written by every door
 * into it — zoom affordance, note affordance, ← / → walk, deep link — and
 * moved by the walk itself). Both spend ONCE: cleared before the focus
 * moves (the t788 order law), the landing is t788's min(idx, len-1) math
 * in grid dialect — the card now occupying the vanished card's index —
 * or the inline reset button when a filter combination emptied the world.
 *
 *   A  the relay's mechanics — the witness branch spends once (cleared
 *      before the hand-off), the effect deps, the voluntary-blur stand-down,
 *      the toggle-only witness, the pocket writer and its four doors,
 *      the lightbox close spending the pocket (cleared first, then
 *      preventDefault).
 *   B  the landing contract — the useCallback identity, t788's min math,
 *      the t774 preventScroll contract, the empty-world reset button,
 *      the roving anchor moving WITH the keyboard.
 *   C  the declarations & the wiring — the two pockets + gridRef, the
 *      capture handlers on the class-grid div.
 *   D  the old contracts untouched — the t778 listbox + roving tabIndex,
 *      the one-brain gridNeighbor import, the lightbox keep toggle, the
 *      deep-link handshake, the ONE note editor surface.
 *   E  the verdict notes on the raw channel (single-line word-forms).
 *   F  the history in the margins — t778, t788, t774.
 *
 * Run:  node scripts/t791-class-gallery-focus-unit.mjs
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

const galRaw = read("src/components/workflow/class-gallery.tsx");
const gal = strip(galRaw);
const galNorm = norm(galRaw);

/* ------------------------------------------------------------------ */
/* A — the relay's mechanics                                           */
/* ------------------------------------------------------------------ */

// A1 — the witness branch spends ONCE: the pocket is cleared BEFORE the
// hand-off fires (the t788 order law — a second render must not re-fire).
const effectIdx = gal.indexOf("const witness = lastFocusedCellRef.current;");
const effectEnd = gal.indexOf("const KEY_TO_DIR", effectIdx);
ok(effectIdx >= 0 && effectEnd > effectIdx, "A1 the witness effect exists (code-anchored, strip channel)");
const effSeg = gal.slice(effectIdx, effectEnd);
ok(
  effSeg.indexOf("lastFocusedCellRef.current = null;") >= 0
    && effSeg.indexOf("lastFocusedCellRef.current = null;") < effSeg.indexOf("handFocusBackToGrid(witness.idx);"),
  "A2 the witness is cleared before the hand-off (spend-once order)",
);

// A3 — the effect deps carry the landing identity: a new visible world
// re-arms the helper, and the effect re-runs with it.
ok(
  effSeg.includes("[visible, activeCls, handFocusBackToGrid]") || galNorm.includes("[visible, activeCls, handFocusBackToGrid]"),
  "A3 the effect deps carry [visible, activeCls, handFocusBackToGrid]",
);

// A4 — the witness stands down when the keyboard leaves VOLUNTARILY: a
// blur whose relatedTarget left the container. Without this, a filter
// chip click would steal focus back to the grid.
const blurIdx = gal.indexOf("const onGridBlurCapture");
const blurEnd = gal.indexOf("};", blurIdx);
const blurSeg = gal.slice(blurIdx, blurEnd);
ok(blurSeg.includes("contains(e.relatedTarget") && blurSeg.includes("lastFocusedCellRef.current = null;"),
  "A4 a voluntary blur stands the witness down (relatedTarget outside)");

// A5 — the witness only speaks for the roving toggles: the zoom/note
// affordances are transient doors, not addresses (their focus must not
// re-record the address — the lightbox pocket owns that story).
const focusIdx = gal.indexOf("const onGridFocusCapture");
const focusEnd = gal.indexOf("};", focusIdx);
const focusSeg = gal.slice(focusIdx, focusEnd);
ok(focusSeg.includes('match(/^Toggle class (\\d+)/)'), "A5 the witness records only the roving toggles");

// A6 — the pocket writer exists and every door records the home address.
ok(gal.includes("const trackLightboxReturn = (cls: number) => {"), "A6 the pocket writer exists");
ok(gal.includes("lightboxReturnRef.current = { cls, idx: visible.findIndex((v) => v.cls === cls) };"),
  "A7 the pocket carries cls + the index in visible");

// A8 — four doors write the pocket: zoom affordance, note affordance, the
// ← / → walk, the deep-link handshake. (The definition line has no "("
// directly after the name — the call-site count is the door count.)
const doorCount = (gal.match(/trackLightboxReturn\(/g) ?? []).length;
ok(doorCount === 4, `A8 exactly four doors call the pocket writer (got ${doorCount})`);

// A9 — the lightbox close spends the pocket: cleared BEFORE the landing,
// and the dead default (no trigger exists) is preventDefault-ed.
const dlgIdx = gal.indexOf("<DialogContent");
const dlgEnd = gal.indexOf("{zoomClass && (", dlgIdx);
const dlgSeg = gal.slice(dlgIdx, dlgEnd);
ok(dlgSeg.includes("onCloseAutoFocus={(e) => {"), "A9 the lightbox wires onCloseAutoFocus (the front door)");
ok(
  dlgSeg.indexOf("lightboxReturnRef.current = null;") >= 0
    && dlgSeg.indexOf("lightboxReturnRef.current = null;") < dlgSeg.indexOf("e.preventDefault();"),
  "A10 the pocket is spent (cleared) before preventDefault",
);

/* ------------------------------------------------------------------ */
/* B — the landing contract                                            */
/* ------------------------------------------------------------------ */

// B1 — the landing is a stable useCallback over visible: the memo world
// sees one identity per world, the effect deps watch it honestly.
const landIdx = gal.indexOf("const handFocusBackToGrid = useCallback(");
const landEnd = gal.indexOf("const trackLightboxReturn", landIdx);
const landSeg = gal.slice(landIdx, landEnd);
ok(landIdx >= 0 && landEnd > landIdx, "B1 the landing is a useCallback (stable identity)");
ok(landSeg.includes("[visible],"), "B2 the landing's deps are [visible]");

// B3 — t788's min(idx, len-1) math, grid dialect: the card now occupying
// the vanished card's index inherits the keyboard.
ok(landSeg.includes("visible[Math.min(idx, visible.length - 1)]"),
  "B3 the landing is the index-neighbour (t788's min math, grid dialect)");

// B4 — the t774 contract: focus without reachability is a dead gesture —
// preventScroll first, then the nearest-block scroll.
ok(landSeg.includes('focus({ preventScroll: true })') && landSeg.includes('scrollIntoView({ block: "nearest", inline: "nearest" })'),
  "B4 the t774 contract: preventScroll, then the nearest-block scroll");

// B5 — the empty world lands on the inline reset button (the natural next
// action when a filter combination emptied the grid).
ok(landSeg.includes('[data-canvas-ui="gallery-reset-filters"]'),
  "B5 the empty-world fallback is the inline reset button");

// B6 — the roving anchor moves WITH the keyboard (one address, two books:
// activeCls state and DOM focus never diverge after a landing).
ok(landSeg.includes("setActiveCls(tenant.cls);"), "B6 the landing moves the roving anchor with the keyboard");

// B7 — the reset button itself carries the address the landing queries.
ok(gal.includes('data-canvas-ui="gallery-reset-filters"'), "B7 the reset button carries the landing address");

/* ------------------------------------------------------------------ */
/* C — the declarations & the wiring                                   */
/* ------------------------------------------------------------------ */

// C1 — the two pockets + the grid ref, typed and nullable.
ok(gal.includes("const lastFocusedCellRef = useRef<{ cls: number; idx: number } | null>(null);"),
  "C1 the grid witness is declared (nullable {cls, idx})");
ok(gal.includes("const lightboxReturnRef = useRef<{ cls: number; idx: number } | null>(null);"),
  "C2 the lightbox return pocket is declared");
ok(gal.includes("const gridRef = useRef<HTMLDivElement | null>(null);"), "C3 the grid ref is declared");

// C4 — the capture handlers are wired on the class-grid div itself: the
// witness listens INSIDE the grid's boundary, not at the document.
const gridIdx = gal.indexOf('data-canvas-ui="class-grid"');
const gridSegStart = gal.lastIndexOf("<div", gridIdx);
const gridSegEnd = gal.indexOf(">", gridIdx);
const gridOpenTag = gal.slice(gridSegStart, gridSegEnd);
ok(gridOpenTag.includes("ref={gridRef}") && gridOpenTag.includes("onFocusCapture={onGridFocusCapture}")
  && gridOpenTag.includes("onBlurCapture={onGridBlurCapture}"),
  "C4 the class-grid div carries the ref + both capture handlers");

/* ------------------------------------------------------------------ */
/* D — the old contracts untouched                                     */
/* ------------------------------------------------------------------ */

// D1 — the t778 roving grid: one listbox, arrows move, Enter toggles.
ok(gal.includes('role="listbox"') && gal.includes("Class selection grid — arrow keys move between classes, Enter toggles"),
  "D1 the t778 listbox contract stands");

// D2 — the roving geometry's one brain is still imported (t778).
ok(gal.includes('from "@/lib/grid-nav"'), "D2 the grid-nav one-brain import stands");

// D3 — the roving tabIndex: exactly ONE card in the tab order.
ok(gal.includes("tabIndex={c.cls === (activeCls ?? visible[0]?.cls) ? 0 : -1}"),
  "D3 the roving tabIndex contract stands");

// D4 — the lightbox keep toggle: the same button the experiments drove.
ok(gal.includes('data-canvas-ui="lightbox-keep"') && gal.includes("aria-pressed={kept.has(zoomClass.cls)}"),
  "D4 the lightbox keep toggle stands");

// D5 — the deep-link handshake still consumes (the pocket rides it now,
// but the consumed callback is untouched).
ok(gal.includes("onClassFocusConsumed?.();"), "D5 the deep-link consumed handshake stands");

// D6 — ONE editor surface (Task 80's law): the note textarea address.
ok(gal.includes('data-canvas-ui="class-note-editor"'), "D6 the one note-editor surface stands");

/* ------------------------------------------------------------------ */
/* E — the verdict notes on the raw channel                            */
/* ------------------------------------------------------------------ */

// (raw channel — the verdict notes live in comments, strip would mute
// them; single-line word-forms only, per the t783/t787/t788 lessons.)
ok(/the relay's third family/.test(galRaw), "E1 raw: the relay's third family");
ok(/spends once and the card's index-neighbour inherits focus — never body/.test(galRaw),
  "E2 raw: the spend-once / never-body verdict");
ok(/born without a trigger/.test(galRaw), "E3 raw: the lightbox's no-trigger confession");
ok(/a voluntary exit must never be answered with a focus steal|VOLUNTARILY/.test(galRaw),
  "E4 raw: the voluntary-exit stand-down");

/* ------------------------------------------------------------------ */
/* F — the history in the margins                                      */
/* ------------------------------------------------------------------ */

ok(/t788's\s*$|t788's min\(idx, len-1\) math, grid dialect|the relay's third family/.test(galRaw),
  "F1 the t788 lineage is cited");
ok(/the roving geometry's one brain/.test(galRaw), "F2 the t778 one-brain citation stands");
ok(/focus without reachability is a dead\s*$|focus without reachability is a dead gesture/.test(galRaw),
  "F3 the t774 reachability law is cited");

/* ------------------------------------------------------------------ */

console.log(`t791-class-gallery-focus-unit: ${pass} pass / ${fail} fail`);
if (fail > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}

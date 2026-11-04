#!/usr/bin/env node
/**
 * t1131 — the SHEET LEGEND unit: the face's gray key.
 *
 * THE FEATURE (this window's first knife, the t1131 script's own #1): the
 * t1130 mesh face wears a gray mosaic — K bands of flat gray quads — but
 * nothing on the 2D side says WHICH gray is WHICH density. The legend
 * strip finishes the instrument: a small key under the oblique block's
 * button row (lo … swatches … hi, a bands chip), each swatch confessing
 * its band-center density on hover.
 *
 * THE ONE-FATHER LAW: the legend is not a second ramp computed from the
 * raw window (two fathers disagree the first time one of them changes) —
 * it is DERIVED from the mesh arrays the scene actually wears
 * (sheetLegendOf(arrays, lo, hi) reads bandColors/bandLabels/stats, the
 * exact bytes the shape groups carry). The strip cannot disagree with the
 * face because it is MADE of the face.
 *
 * THE WIRE LAW: OBLIQUE_SHEET_LEGEND_EVENT ("cryoflow:oblique-sheet-legend")
 * is the legend's OWN wire — the cut's event speaks geometry, the sheet's
 * event speaks existence, the legend speaks what the face WEARS; none of
 * them grows a second meaning. ONE dispatch per settled pump (the dedup
 * seat skips a key that did not change), detail = { legend } with null =
 * the honest no-face announcement.
 *
 * THE DEBOUNCE LAW (the script's knife #2, riding the same unit): a
 * numbers-only scrub no longer storms the lattice — the rebuild rides a
 * trailing 180ms debounce (SHEET_SCRUB_DEBOUNCE_MS, the panel's
 * PROBE_REFETCH_MS law: the img chases the SETTLED pos); toggles stay
 * IMMEDIATE (a click must feel instant, the retirement law never waits);
 * an invert-only flip schedules NO pump at all (the mesh reads the plane,
 * never the kept half — the face cannot move).
 *
 * THE GATE LAW: the strip renders only when the ACK says a face is showing
 * (sheet3d && cut3d) AND a key has arrived; "reading the face…" is the
 * honest placeholder only UNTIL the pump answers — after a null answer the
 * block keeps silence (a solvent-quiet plane keeps no key), because a
 * placeholder that never clears would lie.
 *
 *   node --import ./scripts/ts-alias-register.mjs scripts/t1131-sheet-legend-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { sheetLegendOf, sheetLegendText } from "@/lib/voxel-voice";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) { pass++; console.log(`  ok — ${name}`); }
  else { fail++; console.log(`  RED — ${name}`); }
};
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), `${name} (${JSON.stringify(a)})`);

/* ===== A. the lib word — pure, MADE of the arrays ===== */

ok(typeof sheetLegendOf === "function", "A1 the lib mints the legend word (sheetLegendOf)");

const arrays = {
  positions: new Float32Array(12),
  indices: new Uint32Array(6),
  bandOfTri: new Int32Array([0, 0, 1, 1]),
  bandColors: [0x1f1f1f, 0x808080, 0xe0e0e0],
  bandLabels: ["0.25 density", "1 density", "1.75 density"],
  stats: { kept: 10006, dropped: 2094, lattice: 3136 },
};
const lg = sheetLegendOf(arrays, -0.4212, 1.312);
ok(lg !== null, "A2 a valid key mints from the mesh's own arrays");
if (lg) {
  eq(lg.bands, 3, "A3 bands = the arrays' own band count (the face IS the key)");
  eq(lg.swatches, ["#1f1f1f", "#808080", "#e0e0e0"], "A4 swatches are css hex, dark → light, byte-equal to the face's colors");
  eq(lg.labels, ["0.25 density", "1 density", "1.75 density"], "A5 labels are the mesh's own band-center words (one voice)");
  eq(lg.loLabel, "-0.421", "A6 loLabel rides the 3-significant-digit voice (the mesh labels' own precision)");
  eq(lg.hiLabel, "1.31", "A7 hiLabel rides the same voice");
  eq(lg.kept, 10006, "A8 kept rides the lattice's own harvest");
  ok(lg.aria.includes("3 bands") && lg.aria.includes("-0.421") && lg.aria.includes("1.31") && lg.aria.includes("10006 quads"),
    "A9 the aria word confesses count + ends + harvest (role=img speaks it)");
}

ok(sheetLegendOf(null, 0, 1) === null, "A10 no arrays → the honest no-legend (null, never a guessed key)");
ok(sheetLegendOf(undefined, 0, 1) === null, "A11 undefined arrays → null");
ok(sheetLegendOf({ ...arrays, bandColors: [0x101010] }, 0, 1) === null,
  "A12 one band is no key (a one-color legend explains nothing) → null");
ok(sheetLegendOf({ ...arrays, bandLabels: ["0.25 density"] }, 0, 1) === null,
  "A13 labels shorter than colors → null (the key would mis-speak a band)");
ok(sheetLegendOf(arrays, 1, 1) === null, "A14 an empty window (hi ≤ lo) → null");
ok(sheetLegendOf(arrays, NaN, 1) === null, "A15 a NaN window → null");
ok(sheetLegendOf(arrays, 0, Infinity) === null, "A16 an infinite window → null");

const lg9 = sheetLegendOf(
  { ...arrays, bandColors: Array.from({ length: 9 }, (_, i) => 0x101010 + i), bandLabels: Array.from({ length: 9 }, (_, i) => `b${i} density`) },
  0, 9
);
ok(lg9 !== null && lg9.swatches.length === 9 && lg9.swatches[0] === "#101010" && lg9.swatches[8] === "#101018",
  "A17 the K-band form: the real face's shape (9 bands) survives the same word");

/* ===== B. the debounce — the embed's own bytes ===== */

const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const lib = readFileSync(path.join(ROOT, "src/lib/voxel-voice.ts"), "utf8");
const panel = readFileSync(path.join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");

ok(embed.includes("const SHEET_SCRUB_DEBOUNCE_MS = 180;"),
  "B1 the scrub debounce is 180ms (the PROBE_REFETCH_MS law's own breath)");
ok(embed.includes("const requestSheetPump = (immediate: boolean)") && embed.includes("SHEET_SCRUB_DEBOUNCE_MS"),
  "B2 the pump's DOOR exists (immediate vs the trailing debounce)");
ok(embed.includes("requestSheetPump(true)") && embed.includes("requestSheetPump(false)"),
  "B3 both doors are called: existence words instant, numbers debounced");
ok(embed.includes("if (patch.on !== undefined)") && embed.includes("const numberWords ="),
  "B4 the routing law: existence vs numbers read off the patch, not guessed");
ok(embed.includes("if (sheetDebounceTimer.current) {") && embed.includes("clearTimeout(sheetDebounceTimer.current)"),
  "B5 the timer resets on every new word (a continuous drag holds the build until the breath)");
ok(embed.includes("if (sheetDebounceTimer.current) clearTimeout(sheetDebounceTimer.current);") &&
   embed.includes("unmount — never let a dying embed build a face for no one"),
  "B6 the unmount cleanup clears the pending build (a dying embed never pumps)");
ok(!embed.includes("re-pumps the sheet, so the density") &&
   embed.includes("HOW the face chooses to follow depends"),
  "B7 the old always-immediate CUT pump is gone (the door routes: toggles instant, numbers debounced, invert silent)");
ok(embed.includes("void pumpSheet();"),
  "B7b the sheet's OWN toggle still pumps directly (applySheetIntent — a face click must feel instant)");
ok(!embed.includes('"olstar]'), "B8 the debug prefixes speak the whole word (molstar] — the t1130 typo cured)");

/* ===== C. the legend's wire — the embed's announcements ===== */

ok(embed.includes("sheetLegendOf") && embed.includes('type SheetLegend'),
  "C1 the embed imports the legend word + type from the lib");
ok(embed.includes("sheetLegendRef.current = sheetLegendOf(arrays, window_[0], window_[1]);"),
  "C2 the legend is MADE of the committed arrays (one father — never a second ramp)");
ok((embed.match(/sheetLegendRef\.current = null;/g) || []).length >= 1 &&
   embed.includes("sheetLegendRef.current = null;") && embed.indexOf("sheetLegendRef.current = null;") < embed.indexOf("if (!sheetStateRef.current.on || !ob.on)"),
  "C3 the legend clears at the commitSheet gate (an error path announces the honest null too)");
ok(embed.indexOf("sheetLegendRef.current = sheetLegendOf") > embed.indexOf(".update(params)") ,
  "C4 the legend mints only AFTER the commit lands (create and update paths both end there)");
ok(embed.includes("OBLIQUE_SHEET_LEGEND_EVENT"),
  "C5 the legend rides its OWN wire (the cut's event speaks geometry, the sheet's speaks existence)");
ok(embed.includes("announcedSheetLegendRef.current !== sheetLegendRef.current"),
  "C6 the dedup seat: an unchanged key never re-speaks (the wire stays quiet)");
ok(embed.includes("detail: { legend: sheetLegendRef.current }"),
  "C7 the announcement's detail is { legend } (null = the honest no-face)");
ok((embed.match(/announcedSheetLegendRef/g) || []).length >= 3,
  "C8 the dedup seat is declared + read + written (a ref, not state — no render churn)");

/* ===== D. the panel's strip — the block's own key ===== */

ok(panel.includes('export const OBLIQUE_SHEET_LEGEND_EVENT = "cryoflow:oblique-sheet-legend";'),
  "D1 the wire is named in the panel (the wire family's own home) with its own law comment");
ok(panel.includes("type SheetLegend") && panel.includes("from \"@/lib/voxel-voice\""),
  "D2 the strip's type rides the lib (the panel renders the embed's key, never its own ramp)");
ok(panel.includes('window.addEventListener(OBLIQUE_SHEET_LEGEND_EVENT, onLegend)'),
  "D3 the block listens for the legend's own wire");
ok(panel.includes('if (!Array.isArray(o.swatches) || o.swatches.length < 2) return;'),
  "D4 a foreign key is not a key (the strip renders only a shape it understands)");
ok(panel.includes("if (!sheet3d || !cut3d) {") && panel.includes("setLegendSettled(false);") && !panel.includes("}, [sheet3d, cut3d]);"),
  "D5 the strip's retirement rides the RENDER phase (the prevNonce precedent — no effect setState)");
ok(panel.includes('data-canvas-ui="ortho-oblique-sheet-legend"'),
  "D6 the strip carries its own canvas-ui name (the census's seat)");
ok(panel.includes('data-canvas-ui="ortho-oblique-sheet-legend-pending"') && panel.includes("reading the face…"),
  "D7 the honest placeholder: 'reading the face…' only UNTIL the pump answers");
ok(panel.includes("role=\"img\"") && panel.includes("aria-label={sheetLegend.aria}"),
  "D8 the strip speaks (role=img + the lib's aria word)");
ok(panel.includes("sheet3d && cut3d && sheetLegend") && panel.includes("sheet3d && cut3d && !legendSettled"),
  "D9 the gate law: ACK-truth AND key-arrived (a placeholder that never clears would lie about a solvent-quiet plane)");
ok(panel.includes("sheetLegend.labels[i]") && panel.includes("backgroundColor: sw"),
  "D10 each swatch confesses its band-center density on hover (title = the mesh's own word)");
ok(panel.includes("{sheetLegend.loLabel}") && panel.includes("{sheetLegend.hiLabel}"),
  "D11 the ends speak the stretch (the tiles' own 2–98 percentiles)");
ok(panel.includes("{sheetLegend.bands} bands") && panel.includes("sheetLegend.kept"),
  "D12 the chip names the count + the harvest (the lattice's own numbers)");
ok(panel.includes("ortho-oblique-sheet-legend-chip"),
  "D13 the chip carries its own canvas-ui name");

/* ===== E. the stale-listener cure — the live-caught bug (this window) ===== */

ok(embed.includes("const obliqueClipIntentRef = useRef(applyObliqueClipIntent);") &&
   embed.includes("obliqueClipIntentRef.current = applyObliqueClipIntent;"),
  "E1 the clip listener's applier rides a ref (the family's own law — sliceIntentRef, sheetIntentRef)");
ok(embed.includes("obliqueClipIntentRef.current({ on: true, theta, phi, offset });"),
  "E2 the on-branch calls through the ref (a fresh closure every render — the stale phase can never gate the pump again)");
ok(embed.includes("if (obliqueClipRef.current.on) obliqueClipIntentRef.current({ on: false });"),
  "E3 the off-heartbeat branch rides the same ref (the retirement path is cured too)");
ok((embed.match(/applyObliqueClipIntent\(\{ on: true/g) || []).length === 0,
  "E4 no DIRECT intent call survives inside the [] listener (the stale 'loading' closure is unreachable)");
ok(embed.includes("the slice/clip listeners' own law") || embed.includes("THE STALE-LISTENER CURE"),
  "E5 the cure confesses its story at the scene (the Fast-Refresh false-positive named)");

/* ===== F. the copy chip — the key as text (t1132, this window) ===== */

ok(typeof sheetLegendText === "function", "F1 the lib mints the copy word (sheetLegendText — one father with the strip)");
ok(sheetLegendText(null) === "" && sheetLegendText(undefined) === "",
  "F2 no key → the honest empty string (the button stays idle, never copies a lie)");
ok(sheetLegendText({ ...lg, swatches: ["#101010"] }) === "",
  "F3 one swatch is no key (the strip's own refusal shape) yields the empty string");
ok(sheetLegendText({ ...lg, labels: ["only"] }) === "",
  "F4 labels shorter than swatches yields the empty string (the key would mis-speak a band in text too)");
ok(sheetLegendText({ ...lg, kept: NaN }) === "" && sheetLegendText({ ...lg, lattice: Infinity }) === "",
  "F5 a non-finite harvest refuses (numbers the chip could not confess)");
if (lg) {
  const text = sheetLegendText(lg);
  const lines = text.split("\n");
  ok(lines.length === 3 && lines[0] === lg.aria,
    "F6 the copy's first line IS the aria word (the role=img sentence, verbatim — never a second ramp)");
  ok(lines[1] === `kept ${lg.kept}/${lg.lattice} lattice quads · ${lg.dropped} dropped outside the grid`,
    "F7 the copy's second line confesses the harvest (the chip's own numbers)");
  ok(lines[2].startsWith("bands (dark → light): ") && lines[2].includes(lg.labels.join(" · ")),
    "F8 the copy's third line carries the band words (dark → light, the swatches' own sequence)");
}
ok(panel.includes("sheetLegendText") && panel.includes("from \"@/lib/voxel-voice\""),
  "F9 the panel's cargo rides the lib (the panel never composes the text itself)");
ok(panel.includes("copyTextToClipboard"),
  "F10 the house clipboard word (a PERMISSION, not a right — refusals collapse into one honest false)");
ok(panel.includes('data-canvas-ui="ortho-oblique-sheet-legend-copy"') && panel.includes('type="button"'),
  "F11 the copy chip exists with its own canvas-ui name (a real button, never a click-div)");
ok(panel.indexOf("ortho-oblique-sheet-legend-copy") > panel.indexOf('data-canvas-ui="ortho-oblique-sheet-legend"') &&
   panel.indexOf("ortho-oblique-sheet-legend-copy") < panel.indexOf("</button>", panel.indexOf("ortho-oblique-sheet-legend-copy")) &&
   panel.includes('data-canvas-ui="ortho-oblique-sheet-legend-row"'),
  "F12 the a11y sibling law: the button rides the row BESIDE the role=img strip, never inside it (interactive content in a role=img region is unexposed)");
ok(panel.includes('"The face\'s key copied to the clipboard"') &&
   panel.includes('"The clipboard refused the face\'s key"') &&
   panel.includes('"Copy the face\'s key as text"'),
  "F13 the flip speaks all three states (idle / copied / refused — aria-label AND title)");
ok(panel.includes("1600"),
  "F14 the 1600ms breath (the job-card idiom's own family — the flip self-resets)");
ok(panel.includes("if (legendCopyTimer.current !== null) clearTimeout(legendCopyTimer.current);"),
  "F15 the timer is cleaned up twice: the next click and the unmount (a dying strip fires no setter into the void)");
ok(panel.includes("if (!sheetLegend || legendCopied !== null) return;"),
  "F16 the handler's guard: no key, or a flip in flight, refuses (no double-copy storm)");
ok(panel.includes("if (legendCopied !== null) setLegendCopied(null);"),
  "F17 the flip retires with the face (the render-phase block — the prevNonce precedent's third rider)");
ok(panel.includes("<Check className=\"h-3.5 w-3.5\"") && panel.includes("<TriangleAlert className=\"h-3.5 w-3.5\"") && panel.includes("<Copy className=\"h-3.5 w-3.5\""),
  "F18 the three faces are lucide icons at the house size (Check / TriangleAlert / Copy — no glyph tofu risk)");
ok(panel.includes("motion-reduce:transition-none") && panel.includes("focus-visible:ring-1"),
  "F19 the chip obeys the motion law and carries a visible focus ring (keyboard-reachable copy)");

/* ------------------------------------------------------------------ */
/* G — the HOVER wire (t1134): the key's second voice — hovering a      */
/* swatch on the 2D strip lights the matching gray band IN THE 3D       */
/* SCENE. The ⧉ chip's cross-end linkage, the next inch: the key no     */
/* longer just describes the face, it POINTS at it.                     */
/* ------------------------------------------------------------------ */
ok(panel.includes('export const OBLIQUE_SHEET_LEGEND_HOVER_EVENT = "cryoflow:oblique-sheet-legend-hover"'),
  "G1 the hover wire is its OWN line (cryoflow:oblique-sheet-legend-hover — the cut speaks geometry, the sheet speaks existence, the legend speaks what the face wears, the HOVER speaks where the reader is looking)");
ok(embed.includes('OBLIQUE_SHEET_LEGEND_HOVER_EVENT, ') && embed.includes("addEventListener(OBLIQUE_SHEET_LEGEND_HOVER_EVENT"),
  "G2 the embed imports the wire and listens on it (the panel's mouth, the embed's ear)");
ok(panel.includes("onPointerEnter={() => hoverSheetBand(i)}") && panel.includes("onPointerLeave={() => hoverSheetBand(null)}"),
  "G3 each swatch speaks its band index on enter; leaving the ROW (not a swatch — sliding across swatch gaps must not flicker the 3D highlight) speaks the honest null");
ok(embed.includes("obliqueSheetLegendHoverRef.current(typeof d?.band === \"number\" ? d.band : null)") && embed.includes("obliqueSheetLegendHoverRef.current = applyObliqueSheetLegendHover"),
  "G4 the embed's listener rides the ref law (the t1131 cure's own shape — E's law, third carrier)");
ok(embed.includes("if (band === null || !Number.isFinite(band) || band < 0)") && embed.includes("lm.clearHighlights()") && embed.includes("if (!shape || typeof shape.groupCount !== \"number\" || band >= shape.groupCount) return"),
  "G5 the refusal family, t1144 RE-KEY — null/negative clears, a stale key (no node, or a band past the REAL shape's groupCount — the lazy provider's `.data` unwrapped first) paints NOTHING rather than the wrong band");
ok(embed.includes("kit.ShapeGroup.Loci(shape, [{ ids: int.OrderedSet.ofSortedArray([band]), instance: 0 }])") && embed.includes("plugin?.managers?.interactivity?.lociHighlights") && !embed.includes("managers?.interaction?"),
  "G6 the highlight rides the mol* 5.11 verbs, t1144 RE-KEY — ShapeGroup.Loci (the group-loci address the canvas's own picking speaks) into lociHighlights.highlight; the manager's REAL name is `interactivity` (the live probe's own census — there is NO `interaction` manager; the old dead optional chain bailed the applier on EVERY hover)");
ok(embed.includes("addProvider(markProvider") && embed.includes("plugin.canvas3d.mark(current, action)") && !embed.includes("removeProvider(markProvider"),
  "G9 the MARK provider (t1144's root cure) — the t201 amputation took `representation-highlight-loci` (the ONLY stock mark-provider registrant) out with the throwing structure observers, so every highlight landed on an EMPTY provider list and was born dead; the embed registers its OWN bridge — registered in the plugin's OWN creation effect (after the plugin exists — the race-free home) and dying with the plugin's own dispose (the managers are plugin-owned; no listener-effect race, no stale re-adds) — no hover observer resurrected, the t201 disease does not return");
ok(embed.includes("plugin.canvas3d.mark(current, action)"),
  "G10 the carrier contract — the provider passes the WHOLE {loci, repr} object (applyMark destructures it; a bare loci would arrive as {repr: undefined, loci: undefined} and every repr's mark would refuse the ghost)");
ok(panel.includes("A pointer instrument") && panel.includes("no focus, no tabIndex"),
  "G7 the hover is a pointer instrument (the minimap's precedent, named in the strip's own comment — the keyboard mirror is a named later knife, not an accident of absence)");
ok(embed.includes("ShapeGroup: shape.ShapeGroup") && embed.includes('import("molstar/lib/mol-data/int")'),
  "G8 the kit carries the address word (ShapeGroup) and the OrderedSet rides its own lazy import (the embed's dynamic-import doctrine)");
ok(embed.includes("(sheetCell.obj?.data as { data?: unknown } | null | undefined)?.data"),
  "G11 the lazy shape unwrap (t1144) — the transform's obj.data is the LAZY shape provider ({label, data, params, getShape, geometryUtils}); the REAL Shape (groupCount · getColor · geometry) lives one `.data` deeper — the old read took groupCount off the provider (undefined) and the Loci addressed the provider, not the shape");

console.log(`\n${fail === 0 ? "ALL GREEN" : "RED"} — t1131 sheet-legend unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

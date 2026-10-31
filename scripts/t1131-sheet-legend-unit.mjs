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
import { sheetLegendOf } from "@/lib/voxel-voice";

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

console.log(`\n${fail === 0 ? "ALL GREEN" : "RED"} — t1131 sheet-legend unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

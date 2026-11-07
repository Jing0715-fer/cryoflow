#!/usr/bin/env node
/**
 * t1039-bookmark-provenance-unit — the import's sibling-name honesty
 * reaching the row, and the mirror's stripping cure.
 *
 * The seat: the bookmark family's import dialog already named its sources
 * (group headers, aria labels), but the honesty stopped at the dialog's
 * edge — the confirm toast spoke a COUNT ("from 2 sources"), and the
 * imported rows forgot where they came from the moment the dialog burned.
 * The carry's own law (t1037: the sibling's label riding EVERY
 * description) demanded the row remember. And the audit's second catch:
 * the server mirror's view whitelist predated the box (t260) and the
 * oblique cut (t661) — a box-mode or oblique view synced through the
 * route silently lost its geometry on the cross-browser restore the row
 * exists for.
 *
 * Bands:
 *   A — the client's provenance laws (source pins on the embed): the
 *       CamBookmark type carries src, the ONE read-lane normalize (every
 *       lane rides cleanBookmarkList — the two inline duplicate maps
 *       retired), the confirm stamp with first-hand wins, the toast
 *       naming (one name, two names, the +N more face), the teaching
 *       description, the PUT whitelist's src growth, the duplicate's
 *       lineage, the update's preservation, the local saves' absent src
 *       (write-once), the export's wholesale spread (provenance travels),
 *       and the row chip (testid, the b.src gate, the "from" word, the
 *       chip dialect, the honest title).
 *   B — the route's door laws (source pins on the route): the view type
 *       carries box + oblique, the unit-vec3 helper (0..1 clamp, NaN
 *       voids the whole corner), the box's both-corners-required pin
 *       (corruption never half-lands), the oblique's slider-range bounds,
 *       and the src pass (trim + the 120 cap — one length law both sides
 *       of the wire).
 *   C — the vocabulary laws: the count face retired (names beat counts),
 *       the chip's word is the label verbatim, and the stamp's label is
 *       the group header's own word (one vocabulary, both doors).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const route = readFileSync(path.join(ROOT, "src/app/api/jobs/[id]/camera-bookmarks/route.ts"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};
const bodyOf = (code, startMarker) => {
  const start = code.indexOf(startMarker);
  if (start < 0) return "";
  return code.slice(start, code.indexOf("\n  };", start) + 5);
};
// top-level function form — closes at column 0 (the route's shape)
const fnOf = (code, startMarker) => {
  const start = code.indexOf(startMarker);
  if (start < 0) return "";
  return code.slice(start, code.indexOf("\n}", start) + 2);
};

console.log("A — the client's provenance laws");
{
  // the type carries the field
  ok(/type CamBookmark = \{[^}]*src\?: string \}/.test(embed), "the CamBookmark type carries src?: string (the provenance field)");

  // the ONE normalize site — cleanBookmarkList
  const cbl = bodyOf(embed, "const cleanBookmarkList =");
  ok(cbl.includes('typeof b.src === "string" && b.src.trim()'), "the read lane normalizes src (a non-string or an empty whisper degrades to absent)");
  ok(cbl.includes("slice(0, 120)"), "the label is capped at 120 at the read lane's door");

  // the dedup: the import lanes ride cleanBookmarkList (no inline maps left)
  ok(embed.split("cleanBookmarks(raw).map").length - 1 === 0, "the inline duplicate maps are retired — every import lane rides cleanBookmarkList (one normalize site)");

  // the confirm stamp: first-hand wins
  const confirm = bodyOf(embed, "const confirmImport =");
  ok(confirm.includes("flatMap((s) => s.entries.map((e) => ({ e, src: s.label })))"), "the merge carries each entry's source label (the group header's own word)");
  ok(confirm.includes("src: e.src ?? src"), "first-hand wins — an entry that already carries a src keeps its original hand");
  ok(confirm.includes("id: `bm-${Date.now()}-${i}`"), "ids re-generated at merge time (the re-import lands distinct rows — the standing law intact)");

  // the toast names the sources
  ok(confirm.includes('`${srcNames[0]} + ${srcNames[1]}`'), "two sources are both named (A + B)");
  ok(confirm.includes("(+${srcNames.length - 2} more)"), "three or more speak the +N more face (the count-face law)");
  ok(confirm.includes("Each row remembers its source"), "the description teaches the provenance (the toast is the teaching seat)");
  ok(!confirm.includes("sources`"), "the count face is retired — names beat counts");

  // the PUT whitelist grew src
  ok(embed.includes("({ id, name, ts, thumb, view, snapshot, src }) => ({ id, name, ts, thumb, view, snapshot, src })"), "the PUT whitelist carries src (the mirror follows the job across browsers)");

  // the duplicate's lineage + the update's preservation
  const dup = bodyOf(embed, "const duplicateBookmark =");
  ok(dup.includes("src: b.src"), "the duplicate carries the lineage (a copy is the same view's birth)");
  const upd = bodyOf(embed, "const updateBookmark =");
  ok(upd.includes("{ ...x, ts: Date.now(), thumb, snapshot, view: captureBookmarkView() }"), "the update spreads the row (src preserved — write-once holds through re-capture)");

  // the local saves construct no src (write-once at import)
  const save = bodyOf(embed, "const saveBookmark =");
  ok(save.length > 0 && !save.includes("src:"), "the local save mints no src (absent is honest — a guessed source is a lie)");

  // the export spreads wholesale (provenance travels)
  const exp = bodyOf(embed, "const exportBookmarks =");
  ok(exp.includes("bookmarks: bookmarksRef.current"), "the export spreads the list wholesale (the provenance rides the file)");

  // the row chip
  const chipIdx = embed.indexOf('data-testid="bm-src-chip"');
  ok(chipIdx > 0, "the row chip is born (the testid)");
  const chipBand = embed.slice(embed.lastIndexOf("{/* t1039", chipIdx), chipIdx + 400);
  ok(chipBand.includes("b.src &&"), "the chip is gated on the row's own src (local saves show no chip)");
  ok(embed.slice(chipIdx - 200, chipIdx + 400).includes("from {b.src}"), "the chip's word is the label verbatim (from {src})");
  ok(embed.slice(chipIdx - 200, chipIdx + 500).includes("rounded bg-muted/80 px-1 py-px font-mono text-[8px]"), "the chip rides the family's own chip dialect (the pose-only face)");
  ok(embed.slice(chipIdx, chipIdx + 400).includes("Imported from"), "the chip's title speaks the provenance honestly");

  // the chip lives in the LIST row (the door where provenance was invisible),
  // not duplicated in the import dialog (the group header already speaks there)
  const dialogIdx = embed.indexOf("{importPreview ? (");
  const popoverIdx = embed.indexOf('data-canvas-ui="camera-bookmarks"');
  ok(chipIdx > popoverIdx && chipIdx < dialogIdx, "the chip lives in the bookmark list row (the dialog's group header already names its sources)");
}

console.log("B — the route's door laws");
{
  // the view type carries the stripped geometry
  ok(route.includes("box?: { lo: [number, number, number]; hi: [number, number, number] } | null;"), "the route's view type carries the anchored box (the t260 arc reaches the mirror)");
  ok(route.includes("oblique?: { on: boolean; theta: number; phi: number; offset: number; invert: boolean };"), "the route's view type carries the oblique cut (the t661 arc reaches the mirror)");
  ok(route.includes("src?: string;"), "the route's entry type carries src");

  // the unit-vec3 helper
  const vecUnit = fnOf(route, "function vec3Unit");
  ok(vecUnit.includes("Math.min(1, Math.max(0, n))"), "the unit vec3 clamps to the sliders' own 0..1 language");
  ok(vecUnit.includes("Number.isNaN(n)"), "a non-finite component voids the corner (corruption never half-lands)");

  // the box: both corners required, absent on malformed
  const sview = fnOf(route, "function sanitizeView");
  ok(sview.includes("if (lo && hi) box = { lo, hi };"), "the box lands only when BOTH corners are honest unit vec3s");
  ok(sview.includes("...(box !== undefined ? { box } : {})"), "a malformed box degrades to absent (the client's documented absent face — never a guessed half-box)");

  // the oblique's slider-range bounds
  ok(sview.includes("theta: bounded(ob.theta, 0, 180, 45)"), "θ clamps to its slider range 0..180");
  ok(sview.includes("phi: bounded(ob.phi, 0, 360, 30)"), "φ clamps to its slider range 0..360");
  ok(sview.includes("offset: bounded(ob.offset, -1, 1, 0)"), "the offset clamps to its ±1 fraction");
  ok(sview.includes("...(oblique ? { oblique } : {})"), "the oblique spreads only when present (absent stays absent)");

  // the src pass: trim + the cap, one length law both sides
  const san = fnOf(route, "function sanitize(");
  ok(san.includes('typeof e.src === "string" && e.src.trim()'), "the door refuses a non-string or empty src (absent, not trusted)");
  ok(san.includes("entry.src = e.src.trim().slice(0, 120);"), "the door trims and caps at 120 (the client caps at 120 — one length law)");
}

console.log("C — the vocabulary laws");
{
  // the stamp's label is the dialog's own word
  ok(embed.includes("({ e, src: s.label })"), "the stamp rides the source object's label — the same word the group header spoke (one vocabulary, both doors)");
  ok(!embed.includes('label: other.name, entries: cleaned, rawCount })') === false, "the job import's label stays the job's name (the sibling-name honesty's source)");

  // the chip adds no state-disabled faces (the tally law's domain)
  const chip = embed.slice(embed.indexOf('data-testid="bm-src-chip"') - 300, embed.indexOf('data-testid="bm-src-chip"') + 400);
  ok(!chip.includes("disabled"), "the chip adds no state-disabled faces (the tallies stay untouched)");

  // the mirror law: no localStorage in the new seats (the lib's own boundary)
  const confirm = bodyOf(embed, "const confirmImport =");
  ok(!confirm.includes("localStorage"), "the confirm merge never touches storage directly (the single-mouth law — commitBookmarks is the mouth)");
}

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

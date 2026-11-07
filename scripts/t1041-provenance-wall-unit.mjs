#!/usr/bin/env node
/**
 * t1041-provenance-wall-unit — the provenance chip meets the aggregate
 * doors, and the wall's chip row catches up to the viewer's five-chip
 * family.
 *
 * The seat: the t1039 arc gave every bookmark row a memory of WHERE the
 * view came from (src, write-once at import), but the honesty stopped at
 * the viewer's own list — the two aggregate doors that read
 * /api/views/gallery (the dashboard's Saved-views wall and the command
 * palette's Saved views group) stripped src at the route's sanitize pass
 * and rendered no chip. An imported view on the wall looked exactly like
 * a local save: the provenance never left the job's own viewer. And the
 * wall's chip row was stale next to the viewer's five-chip family — a
 * sigma-less sliced/clipped/cut view showed only "pose" (the fallback
 * ATE the optics), the oblique cut and the anchored box were invisible.
 *
 * Bands:
 *   A — the route's door: the src field passes the aggregate sanitize
 *       under the owning route's own law (trim + the 120 cap, a
 *       non-string or empty whisper degrades to ABSENT), the neighbors'
 *       gates intact (thumb's data:image/ + 48_000, the view wholesale
 *       pass, the id/name/ts sanity).
 *   B — the wall's chip row catches up: the five-chip family (muted σ /
 *       teal slice / amber clip / cyan focus / violet cut), the clip box
 *       voice, and the pose fallback demoted to the ABSENCE voice (it
 *       renders only when NO other chip does).
 *   C — the chip on the doors: the wall card's small-print line and the
 *       palette's name tail carry the family's chip dialect (the same
 *       muted mono chip the viewer's date line speaks), local saves stay
 *       chipless (absent is honest), the viewer's own chip still stands.
 *   D — the neighbors' pins + the mirrored semantics: the wall trio and
 *       the palette trio testids intact, t1040's tail row and t827's
 *       capped windows survive, and the chip gates run on real fixture
 *       views — the semantics the classes speak.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const route = readFileSync(path.join(ROOT, "src/app/api/views/gallery/route.ts"), "utf8");
const dash = readFileSync(path.join(ROOT, "src/components/workflow/project-dashboard.tsx"), "utf8");
const palette = readFileSync(path.join(ROOT, "src/components/workflow/command-palette.tsx"), "utf8");
const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const owner = readFileSync(path.join(ROOT, "src/app/api/jobs/[id]/camera-bookmarks/route.ts"), "utf8");

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

console.log("A — the route's door (the provenance travels)");
{
  // the interface grows src
  ok(route.includes("  src?: string;"), "the aggregate's GalleryBookmark carries src (the field)");

  // the sanitize pass — the owning route's own law, verbatim shape
  const sIdx = route.indexOf('if (typeof b.src === "string" && b.src.trim())');
  ok(sIdx > 0, "the sanitize gate: a non-string or an empty whisper degrades to absent");
  const sBody = route.slice(sIdx, sIdx + 120);
  ok(sBody.includes("entry.src = b.src.trim().slice(0, 120);"), "the law's own arithmetic: trim + the 120 cap");

  // the law is the OWNING route's law — one law both sides of the wire
  ok(
    owner.includes('if (typeof e.src === "string" && e.src.trim())') && owner.includes("entry.src = e.src.trim().slice(0, 120);"),
    "the aggregate speaks the camera-bookmarks route's own t1039 law (one law, both sides)"
  );

  // the neighbors' gates intact
  ok(route.includes("b.thumb.length <= 48_000") && route.includes('b.thumb.startsWith("data:image/")'), "the thumb's gate intact (data:image/ + the 48_000 cap)");
  ok(route.includes("entry.view = b.view as Record<string, unknown>;"), "the view still passes wholesale (the optics face the card types)");
  ok(route.includes("if (typeof b.id !== \"string\" || !b.id) continue;") && route.includes("if (typeof b.name !== \"string\" || !b.name) continue;"), "the id/name sanity intact (a malformed row never sinks the rest)");
}

console.log("B — the wall's chip row catches up (the five-chip family)");
{
  // the absence voice demoted — the fallback renders only when nothing else does
  ok(dash.includes("const chips: React.ReactNode[] = [];"), "the chips array (the fallback is no longer the first gate)");
  const absIdx = dash.indexOf("if (chips.length === 0) {");
  ok(absIdx > 0, "the pose chip is the ABSENCE voice — only when no other chip rendered");
  ok(dash.slice(0, absIdx).includes("if (!v) {"), "a view-less row still poses (true absence, the early return)");

  // the five tones
  ok(dash.includes("typeof v.sigma === \"number\""), "σ keeps the defensive read");
  ok(dash.includes('slice {(v.slice.axis ?? "Z").toUpperCase()}'), "slice keeps the axis voice (teal family)");
  ok(dash.includes('{v.clip.box ? "clip box" : "clip"}'), "the clip chip names the anchored box (the t260 voice, wall-sized)");
  ok(dash.includes("bg-cyan-600/10 px-1 py-px font-mono text-[8px] font-medium tabular-nums text-cyan-700 dark:text-cyan-400"), "the focus chip wears the ortho panel's own cyan (the t280 face)");
  const fIdx = dash.indexOf("focus {Math.round(v.focus.x * 100)}/");
  ok(fIdx > 0 && dash.slice(fIdx - 900, fIdx).includes('typeof v.focus.x === "number"'), "the focus chip's defensive three-way gate (a guessed 50/50/50 is a lie)");
  ok(dash.includes("bg-violet-600/10 px-1 py-px font-mono text-[8px] font-medium tabular-nums text-violet-700 dark:text-violet-400"), "the cut chip wears the oblique family's violet (the t661 face)");
  const cIdx = dash.indexOf("cut {v.oblique.theta}");
  ok(cIdx > 0, "the cut chip speaks the plane AND the depth");
  ok(
    dash.slice(cIdx - 900, cIdx).includes('v.oblique?.on && typeof v.oblique.theta === "number" && typeof v.oblique.phi === "number"'),
    "the cut chip's defensive gate (on + honest θφ)"
  );
  ok(dash.includes('obliqueOffsetPctVoice(typeof v.oblique.offset === "number" ? v.oblique.offset : 0)'), "the offset rides the lib's voice, the optional face grounded at 0");

  // one lib, one byte-format
  ok(
    dash.includes('import { obliqueOffsetPctVoice } from "@/lib/voxel-voice";'),
    "the wall speaks the SAME offset lib the viewer's chip speaks (one lib, one byte-format)"
  );
  ok(dash.includes('return (\n    <span className="flex min-w-0 flex-wrap items-center gap-1">\n      {chips}\n    </span>\n  );'), "the chips wrap as WHOLE units (flex-wrap — a five-chip card never squeezes a chip below its text width)");
}

console.log("C — the chip on the doors (the wall card + the palette row)");
{
  // the wall card's chip
  const wIdx = dash.indexOf('data-testid="wall-src-chip"');
  ok(wIdx > 0, "the wall chip is born (the testid)");
  ok(dash.slice(wIdx - 120, wIdx).includes("{b.src && ("), "the wall chip rides the b.src gate (local saves stay chipless — absent is honest)");
  ok(
    dash.slice(wIdx, wIdx + 260).includes("bg-muted/80 px-1 py-px font-mono text-[8px] font-medium text-muted-foreground"),
    "the wall chip wears the family's chip dialect (muted mono, the viewer's own tones)"
  );
  ok(
    dash.slice(wIdx, wIdx + 320).includes('title={`Imported from \u201c${b.src}\u201d \u2014 this card remembers where the view came from`}'  ),
    "the wall chip's title teaches the lineage (the card's own word)"
  );
  ok(dash.slice(wIdx, wIdx + 520).includes("from {b.src}"), "the wall chip speaks the family's word (from …)");
  ok(dash.slice(wIdx, wIdx + 220).includes("min-w-0 max-w-28 shrink truncate"), "the wall chip shrinks before the jobName does (the small-print seat)");

  // the palette row's chip
  const pIdx = palette.indexOf('data-testid="palette-src-chip"');
  ok(pIdx > 0, "the palette chip is born (the testid)");
  ok(palette.slice(pIdx - 120, pIdx).includes("{b.src && ("), "the palette chip rides the same gate");
  ok(
    palette.slice(pIdx, pIdx + 320).includes('title={`Imported from \u201c${b.src}\u201d \u2014 this row remembers where the view came from`}'  ),
    "the palette chip's title teaches the lineage (the row's own word)"
  );
  ok(palette.slice(pIdx, pIdx + 220).includes("hidden max-w-24 shrink truncate") && palette.slice(pIdx, pIdx + 220).includes("sm:inline"), "the palette chip yields on narrow rows (hidden → sm:inline, the jump surface's economy)");

  // the type carries the field on both readers
  ok(palette.includes("  src?: string;"), "the palette's SavedViewBookmark carries src");
  ok(dash.includes("  /** t1041 \u2014 the row's provenance (WHERE the view was imported from);") || dash.includes("src?: string;"), "the wall's GalleryBookmark carries src");

  // the family's origin still stands
  ok(embed.includes('data-testid="bm-src-chip"'), "the viewer's own chip still stands (the family's origin)");
}

console.log("D — the neighbors' pins + the mirrored semantics");
{
  // the wall trio intact
  ok(dash.includes("data-saved-view-card={b.id}") && dash.includes("data-saved-view-rename={b.id}") && dash.includes("data-saved-view-delete={b.id}"), "the wall's trio intact (card / rename / delete)");
  // the palette trio intact
  ok(palette.includes("data-palette-savedview-row={b.id}") && palette.includes("data-palette-savedview-rename={b.id}") && palette.includes("data-palette-savedview-delete={b.id}"), "the palette's trio intact (row / rename / delete)");
  // t1040's tail row + t827's windows survive
  ok(embed.includes('data-testid="from-job-cap-note"'), "t1040's cap note stands (the import family untouched)");
  ok(embed.includes("max-h-40 overflow-y-auto") && embed.includes("max-h-44 space-y-0.5 overflow-y-auto"), "t827's capped windows survive");

  // the mirrored semantics — the chip gates, run on real fixture views
  const wallChipGate = (b) => (typeof b.src === "string" && b.src.trim() ? `from ${b.src.trim().slice(0, 120)}` : null);
  ok(wallChipGate({ src: "  Initial Model (tutorial)  " }) === "from Initial Model (tutorial)", "the mirrored chip: the import's label rides trimmed");
  ok(wallChipGate({}) === null, "the mirrored chip: a local save stays chipless (absent is honest)");
  ok(wallChipGate({ src: "x".repeat(130) }).length === 125, "the mirrored chip: a 130-char source caps at 120 + the 'from ' seat");
  ok(wallChipGate({ src: 42 }) === null, "the mirrored chip: a non-string degrades to absent");

  // the absence voice, mirrored — a sigma-less CUT view keeps its optics
  const mirrorChips = (v) => {
    if (!v) return ["pose"];
    const chips = [];
    if (typeof v.sigma === "number") chips.push("sigma");
    if (v.slice?.on) chips.push("slice");
    if (v.clip?.on) chips.push(v.clip.box ? "clip box" : "clip");
    if (v.focus && [v.focus.x, v.focus.y, v.focus.z].every((n) => typeof n === "number")) chips.push("focus");
    if (v.oblique?.on && typeof v.oblique.theta === "number" && typeof v.oblique.phi === "number") chips.push("cut");
    return chips.length ? chips : ["pose"];
  };
  ok(
    JSON.stringify(mirrorChips({ oblique: { on: true, theta: 60, phi: 45, offset: 0.25 } })) === JSON.stringify(["cut"]),
    "the mirrored fallback: a sigma-less cut view speaks its cut (the pose never eats the optics)"
  );
  ok(
    JSON.stringify(mirrorChips({ clip: { on: true, x: 1, y: 1, z: 0.7, box: { lo: [0, 0, 0], hi: [1, 1, 1] } } })) === JSON.stringify(["clip box"]),
    "the mirrored box voice: an anchored box clip names the box"
  );
  ok(
    JSON.stringify(mirrorChips({ slice: { on: true, axis: "z", pos: 0.5 }, clip: { on: true, x: 1, y: 1, z: 0.7 } })) === JSON.stringify(["slice", "clip"]),
    "the mirrored family order: σ → slice → clip → focus → cut"
  );
  ok(JSON.stringify(mirrorChips({})) === JSON.stringify(["pose"]), "the mirrored absence: a bare view still poses");
  ok(JSON.stringify(mirrorChips(null)) === JSON.stringify(["pose"]), "the mirrored early return: a view-less row poses before the array exists");
}

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

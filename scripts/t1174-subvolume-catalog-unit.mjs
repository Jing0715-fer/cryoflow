// t1174 — THE SUBVOLUME CATALOG UNIT: the crop shelf's math, shape laws
// and source contracts — the t892 window's feature face.
//
// The feature: the 3D viewer's send-to-new-job (t255) has always MATERI-
// ALIZED crops (SubVolumes/*.mrc, each self-describing — the MRC header's
// start fields answer "where do I sit in the map I was cut from"), but the
// folder had no working face: no listing, no re-open, no way back. The
// shelf closes it: a list route (header-evidenced rows + the parent map's
// own start fields — the one number the client cannot see), a pure
// re-anchor math (cropBoxFractions), and viewer rows that anchor the kept
// box (the t260 anchored-box law) or re-download exactly that crop.
//
// A — the pure helper's functional face: identity, plain, crop-of-crop
//     (the grandparent space cancels), the stale world's honest null,
//     degenerate inputs, and NO clamped guessing (a box that pokes
//     outside the parent is refused, not squeezed).
// B — sortCrops: newest first, the 24 cap, input untouched.
// C — the source law: the route's door+containment+hatch family ring, the
//     header-evidence rule (a refusing header is no row), the honest
//     empty shelf, the viewer's t260 anchor path and fraction-download
//     round-trip, the send-success refresh, the lib's purity, the
//     family's testid addresses.
// D — cropParentName, the provenance witness law (t893): the name's stem
//     chain AND the headers' start arithmetic must AGREE before the line
//     speaks "cut from <parent>"; every disagreement (prose-broken name,
//     renamed/deleted parent, contradicting starts, a box outside the
//     parent's own grid) is an honest null — and a direct crop of the map
//     (its "parent" is not a shelf row) stays unmarked. Frame-free:
//     shifting both starts by the same grandparent delta cannot change
//     the answer.
//
// node scripts/unit-runner.mjs scripts/t1174-subvolume-catalog-unit.mjs
//

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cropBoxFractions, cropParentName, sortCrops } from "@/lib/subvolume-catalog";

const ROOT = "/home/z/my-project";
const libSrc = readFileSync(join(ROOT, "src/lib/subvolume-catalog.ts"), "utf8");
const routeSrc = readFileSync(join(ROOT, "src/app/api/jobs/[id]/outputs/subvolume-list/route.ts"), "utf8");
const embedSrc = readFileSync(join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const v3 = (a) => `[${a.join(", ")}]`;
const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

try {
  console.log("A — the pure helper's functional face (cropBoxFractions)");
  {
    const parent = { dims: [100, 100, 100], start: [0, 0, 0] };
    const whole = cropBoxFractions({ dims: [100, 100, 100], start: [0, 0, 0] }, parent);
    ok("A1 the whole-map crop is the identity box", whole !== null && close(whole.lo, [0, 0, 0]) && close(whole.hi, [1, 1, 1]), whole && `lo ${v3(whole.lo)} hi ${v3(whole.hi)}`);

    const plain = cropBoxFractions({ dims: [20, 30, 40], start: [10, 20, 30] }, parent);
    ok("A2 the plain crop reads off/pd per axis", plain !== null && close(plain.lo, [0.1, 0.2, 0.3]) && close(plain.hi, [0.3, 0.5, 0.7]), plain && `lo ${v3(plain.lo)} hi ${v3(plain.hi)}`);

    const parentA = { dims: [64, 64, 64], start: [50, 50, 50] }; // A is itself a crop of the grandparent
    const inner = cropBoxFractions({ dims: [8, 8, 8], start: [60, 60, 60] }, parentA);
    ok("A3 crop-of-crop: the grandparent space cancels (start − parent.start)", inner !== null && close(inner.lo, [10 / 64, 10 / 64, 10 / 64]) && close(inner.hi, [18 / 64, 18 / 64, 18 / 64]), inner && `lo ${v3(inner.lo)}`);

    const before = cropBoxFractions({ dims: [10, 10, 10], start: [-5, 0, 0] }, parent);
    ok("A4a a box poking out the − side is refused, not squeezed", before === null);
    const after = cropBoxFractions({ dims: [10, 10, 10], start: [95, 0, 0] }, parent);
    ok("A4b a box poking out the + side is refused, not squeezed", after === null);
    const otherWorld = cropBoxFractions({ dims: [10, 10, 10], start: [1000, 1000, 1000] }, parent);
    ok("A4c a stale crop of a different map is honest null", otherWorld === null);

    ok("A5a a zero parent dim is honest null", cropBoxFractions({ dims: [1, 1, 1], start: [0, 0, 0] }, { dims: [0, 100, 100], start: [0, 0, 0] }) === null);
    ok("A5b a zero-dim crop (hi <= lo) is honest null", cropBoxFractions({ dims: [0, 10, 10], start: [5, 5, 5] }, parent) === null);
    ok("A5c a non-finite parent dim is honest null", cropBoxFractions({ dims: [1, 1, 1], start: [0, 0, 0] }, { dims: [NaN, 100, 100], start: [0, 0, 0] }) === null);
  }

  console.log("B — sortCrops (the shelf's order and cap)");
  {
    const rows = [
      { name: "a.mrc", rel: "SubVolumes/a.mrc", dims: [1, 1, 1], start: [0, 0, 0], bytes: 1, mtimeMs: 100 },
      { name: "c.mrc", rel: "SubVolumes/c.mrc", dims: [1, 1, 1], start: [0, 0, 0], bytes: 3, mtimeMs: 300 },
      { name: "b.mrc", rel: "SubVolumes/b.mrc", dims: [1, 1, 1], start: [0, 0, 0], bytes: 2, mtimeMs: 200 },
    ];
    const sorted = sortCrops(rows);
    ok("B1 newest first", sorted.map((r) => r.name).join(",") === "c.mrc,b.mrc,a.mrc", sorted.map((r) => r.name).join(","));
    ok("B2 the input array is untouched (pure)", rows.map((r) => r.name).join(",") === "a.mrc,c.mrc,b.mrc", rows.map((r) => r.name).join(","));
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `r${i}.mrc`, rel: `r${i}`, dims: [1, 1, 1], start: [0, 0, 0], bytes: i, mtimeMs: i }));
    ok("B3 the cap holds at 24 (a shelf, not an archive)", sortCrops(many).length === 24 && sortCrops(many)[0].name === "r29.mrc", `cap ${sortCrops(many).length}`);
    ok("B4 ties keep the input's order (stable, no second key invented)", (() => {
      const tied = [
        { name: "x.mrc", rel: "x", dims: [1, 1, 1], start: [0, 0, 0], bytes: 1, mtimeMs: 5 },
        { name: "y.mrc", rel: "y", dims: [1, 1, 1], start: [0, 0, 0], bytes: 1, mtimeMs: 5 },
      ];
      return sortCrops(tied).map((r) => r.name).join(",") === "x.mrc,y.mrc";
    })());
  }

  console.log("C — the source law (the route, the viewer, the lib's purity)");
  ok("C1 the route rides the family door (isLocalRequest, the t251 pair)", /if \(!isLocalRequest\(request\)\)/.test(routeSrc) && /Cross-site access to job data is not allowed/.test(routeSrc));
  ok("C2 the route's map path rides the shared containment policy + the t1169 hatch gate", /resolveInsideJobWorkdir\(run\.workdir, rel\)/.test(routeSrc) && /pathrefHatchApplies\(rel, name\)/.test(routeSrc));
  ok("C3 the rows are header-evidenced: a refusing header is NO row (the shelf speaks geometry)", /readMrcHeader\(abs\)/.test(routeSrc) && /if \(!head\) continue;/.test(routeSrc));
  ok("C4 no SubVolumes folder yet = an empty shelf, NOT an error", /readdirSync\(subDir\)/.test(routeSrc) && /no SubVolumes folder yet — an empty shelf, not an error/.test(routeSrc));
  ok("C5 the parent's own start fields ride along (the re-anchor's missing number)", /start: head\.start/.test(routeSrc) && /dims: \[head\.nx, head\.ny, head\.nz\]/.test(routeSrc));
  ok("C6 the lib is PURE (no fs, no db, no clock)", !/from "(node:)?fs"|from "node:fs"|prisma|@\/lib\/db|Date\.now/.test(libSrc), "text and numbers in, numbers out");
  ok("C7 the viewer anchors through the t260 law (applyClipBoxIntent — sliders stand down, the family follows)", /const anchorCrop = \(crop[\s\S]{0,200}applyClipBoxIntent\(box\.lo, box\.hi\)/.test(embedSrc));
  ok("C8 the download round-trips the header (the same fraction query the export speaks)", /outputs\/subvolume\?\$\{qs\.toString\(\)\}/.test(embedSrc) && /x0: String\(box\.lo\[0\]\)/.test(embedSrc) && /x1: String\(box\.hi\[0\]\)/.test(embedSrc));
  ok("C9 the send-success refresh: a crop the send just wrote joins the shelf", /flashSendNote\(`Sent — Import Map job "\$\{data\.job\?\.name \?\? ""\}" created beside its parent`, true\);\s*\n\s*void refreshCropShelf\(\)/.test(embedSrc));
  ok("C10 the family's testid addresses (shelf, count, refresh, row, anchor, download)", ["crop-shelf", "crop-shelf-count", "crop-shelf-refresh", "crop-shelf-row", "crop-shelf-anchor", "crop-shelf-download"].every((t) => embedSrc.includes(`data-testid="${t}"`)));
  ok("C11 the honest refusal keeps its WHY (a disabled action names the road out)", /its box does not lie inside the map on display/.test(embedSrc));
  ok("C12 the fetch is seq-guarded (a stale answer cannot evict a fresh one)", /const seq = \+\+cropShelfSeq\.current;/.test(embedSrc) && /seq === cropShelfSeq\.current/.test(embedSrc));

  console.log("D — cropParentName, the provenance witness law (t893)");
  {
    // the writer's convention: <parent stem>_crop_<ox>-<ox+sx>_<oy>-<oy+sy>_<oz>-<oz+sz>.mrc
    const parent = { name: "map_crop_0-128_0-128_0-128.mrc", dims: [128, 128, 128], start: [10, 10, 10] };
    const child = { name: "map_crop_0-128_0-128_0-128_crop_16-48_16-48_16-48.mrc", dims: [32, 32, 32], start: [26, 26, 26] }; // 10 + 16
    ok("D1 a two-step chain resolves to the shelf sibling", cropParentName(child, [parent, child]) === "map_crop_0-128_0-128_0-128.mrc", cropParentName(child, [parent, child]) ?? "null");

    ok("D2 a direct crop of the map stays unmarked (its parent is not a shelf row)", cropParentName({ name: "map_crop_0-64_0-64_0-64.mrc", dims: [64, 64, 64], start: [10, 10, 10] }, [child]) === null);
    ok("D3 no _crop_ marker in the name = no witness, honest null", cropParentName({ name: "somebody.mrc", dims: [8, 8, 8], start: [0, 0, 0] }, [parent]) === null);
    ok("D4 a name whose offsets contradict the header's dims is prose-broken", cropParentName({ name: "map_crop_0-128_0-128_0-128_crop_16-48_16-48_16-48.mrc", dims: [40, 32, 32], start: [26, 26, 26] }, [parent, child]) === null);
    ok("D5 starts that contradict the name's offsets = the witnesses disagree, neither trusted", cropParentName({ ...child, start: [30, 26, 26] }, [parent, child]) === null);
    ok("D6 a box poking outside the parent's own grid is refused", cropParentName({ ...child, start: [120, 26, 26] }, [parent, child]) === null); // 120+32 > 128 in the parent's frame
    ok("D7 a renamed/deleted parent (the stem names no sibling) is honest null", cropParentName(child, [child]) === null);
    ok("D8 a non-.mrc suffix (the writer's tongue is exactly .mrc) is no witness", cropParentName({ ...child, name: child.name.replace(/\.mrc$/, ".map") }, [parent, child]) === null);

    const shiftedParent = { ...parent, start: [510, 510, 510] };
    const shiftedChild = { ...child, start: [526, 526, 526] }; // both +500: the grandparent delta
    ok("D9 frame-free: the same grandparent shift answers the same", cropParentName(shiftedChild, [shiftedParent, shiftedChild]) === "map_crop_0-128_0-128_0-128.mrc");

    const grand = { name: "map_crop_0-128_0-128_0-128_crop_16-48_16-48_16-48_crop_0-8_0-8_0-8.mrc", dims: [8, 8, 8], start: [26, 26, 26] };
    ok("D10 a three-deep chain names the IMMEDIATE parent (the last marker splits)", cropParentName(grand, [parent, child, grand]) === "map_crop_0-128_0-128_0-128_crop_16-48_16-48_16-48.mrc", cropParentName(grand, [parent, child, grand]) ?? "null");

    ok("D11 an empty shelf has no provenance to speak", cropParentName(child, []) === null);
    ok("D12 the viewer renders the line only through the two-witness gate (testid + text + the lib's name)", embedSrc.includes('data-testid="crop-shelf-provenance"') && /cut from <span className="font-mono">\{cutFrom\}<\/span>/.test(embedSrc) && /cropParentName\(crop, cropShelf\.crops\)/.test(embedSrc));
    // D13 — the live-fire's red that earned its keep: in a FOREIGN
    // layout (the map file itself sitting among the crops) C1's stem names a
    // present sibling and the witnesses AGREE, so the line speaks "cut from
    // map.mrc" — honest there too. The pure fn doesn't know the shelf's
    // boundary; the ROUTE's world (it lists only the job's own SubVolumes/)
    // is what keeps the map out of the folder and direct crops unmarked.
    ok("D13 a sibling the stem names is a witness whoever it is (the map-as-sibling layout answers honestly)", cropParentName({ name: "map_crop_32-96_32-96_32-96.mrc", dims: [64, 64, 64], start: [32, 32, 32] }, [{ name: "map.mrc", dims: [128, 128, 128], start: [0, 0, 0] }]) === "map.mrc", "the shelf's own folder never holds the map — the route's world keeps direct crops unmarked");
  }
} finally {
  /* no temp dirs in this seat */
}

console.log(`\nt1174 subvolume catalog unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

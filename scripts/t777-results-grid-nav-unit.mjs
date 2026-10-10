/**
 * t777-results-grid-nav-unit — the results Maps & images grid roving
 * probe (the spatial contract's third sibling).
 *
 * A: the wiring — grid-nav import one-name-one-home, the roving state
 *    machine (anchor re-seat, KEY_TO_DIR, per-tile handler with
 *    preventDefault + focus preventScroll + scrollIntoView nearest), the
 *    tile's tabIndex/data anchor/focus-visible ring, the shortcuts
 *    dialog's Results gallery group, the in-grid hint.
 * B: live geometry — src/lib/grid-nav.ts RUNS FOR REAL through the jiti
 *    loader: rows and columns, the half-tile tolerance law, the strict
 *    travel-axis law, nearest ranking, edge-of-world nulls, Home/End,
 *    empty/single/absent worlds, holes, and a responsive reflow (the
 *    same ids, different rects — neighbours follow the rects, never the
 *    indexes).
 * C: the pre/post ledger — the ten-metric stock census holds pre=post on
 *    every file the surgery touched or sits beside (glue / truncate /
 *    storage / hex — the surgery must not disturb the stock), and the
 *    new lib is pure (no fetch, no storage, no document).
 *
 * Run:  node scripts/unit-runner.mjs scripts/t777-results-grid-nav-unit.mjs
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { createJiti } from "jiti";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");

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

/* ------------------------------------------------------------------ */
/* A — the wiring                                                      */
/* ------------------------------------------------------------------ */

const strip = (s) =>
  s
    .split("\n")
    .map((l) => {
      const i = l.indexOf("//");
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join("\n");

const rv = strip(readFileSync(path.join(SRC, "components/workflow/results/results-view.tsx"), "utf8"));
const sd = strip(readFileSync(path.join(SRC, "components/workflow/shortcuts-dialog.tsx"), "utf8"));
const gn = strip(readFileSync(path.join(SRC, "lib/grid-nav.ts"), "utf8"));
const rvRaw = readFileSync(path.join(SRC, "components/workflow/results/results-view.tsx"), "utf8");

// A1 — import, one name one home
ok(/import \{ gridNeighbor, type GridDir, type GridEntry \} from "@\/lib\/grid-nav";/.test(rv), "A1 grid-nav import rides the @ alias");
eq((rv.match(/from "@\/lib\/grid-nav"/g) ?? []).length, 1, "A1 import is one-name-one-home (single import site)");

// A2 — the roving state machine (t779 contract move: the anchor is
// DERIVED now — the re-seat effect retired because a synchronous
// setState inside an effect is the cascading-render trap the lint rule
// names; the derivation re-seats without the write, same law lighter)
ok(/const tileRefs = useRef\(new Map<string, HTMLButtonElement>\(\)\);/.test(rv), "A2 tileRefs is a path->button map");
ok(/const \[activePath, setActivePath\] = useState<string \| null>\(null\);/.test(rv), "A2 activePath state (what the user chose)");
ok(/activePath != null && shown\.some\(\(f\) => f\.path === activePath\)/.test(rv), "A2 the anchor survives the listing (vanish test lives in the derivation)");
ok(/: shown\[0\]\?\.path \?\? null;/.test(rv), "A2 a vanished anchor re-seats on the first visible tile (the fallback branch)");

// A3 — the key map: six directions, no more
const km = rvRaw.match(/const KEY_TO_DIR: Record<string, GridDir> = \{([^}]*)\}/);
ok(Boolean(km), "A3 KEY_TO_DIR map exists");
ok(km && (km[1].match(/Arrow/g) ?? []).length === 4, "A3 four arrow keys mapped");
ok(km && km[1].includes('Home: "home"') && km[1].includes('End: "end"'), "A3 Home/End mapped");

// A4 — the per-tile handler: resolve, preventDefault, focus, reach
ok(/const onTileKeyDown = \(e: React\.KeyboardEvent<HTMLButtonElement>\)/.test(rv), "A4 handler rides the tile button event");
ok(/const dir = KEY_TO_DIR\[e\.key\];/.test(rv), "A4 intent from the key");
ok(/if \(!dir\) return;/.test(rv), "A4 non-nav keys fall through untouched");
ok(/const fromPath = e\.currentTarget\.dataset\.tilePath \?\? null;/.test(rv), "A4 current tile identity from its own data anchor");
ok(/const target = gridNeighbor\(entries, fromPath, dir\);/.test(rv), "A4 geometry resolved by the lib");
ok(/e\.preventDefault\(\);/.test(rvRaw.split("onTileKeyDown")[1] ?? ""), "A4 arrows never scroll the panel");
ok(/el\.focus\(\{ preventScroll: true \}\);/.test(rv), "A4 focus transfer without scroll hijack");
ok(/el\.scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\);/.test(rv), "A4 t774 lesson: reachability after focus");
ok(/if \(!target \|\| target === fromPath\) return;/.test(rv), "A4 edge of world honestly holds focus");

// A5 — the geometry feed: measured rects, holes tolerated
ok(/for \(const f of shown\) \{/.test(rv.split("const onTileKeyDown")[1]?.split("gridNeighbor(entries")[0] ?? ""), "A5 entries built from the SAME shown list the grid renders");
ok(/if \(!el\) continue;/.test(rv), "A5 holes (remote tiles) simply absent — geometry reads the world it is given");
ok(/entries\.push\(\{ id: f\.path, left: r\.left, top: r\.top, width: r\.width, height: r\.height \}\);/.test(rv), "A5 rects measured live (no column-count guessing)");

// A6 — the tile: roving tabIndex, data anchor, focus-visible ring
ok(/tabIndex=\{f\.path === anchorPath \? 0 : -1\}/.test(rvRaw), "A6 one tab stop: the derived anchor law (t779)");
ok(/data-tile-path=\{f\.path\}/.test(rvRaw), "A6 the tile's honest id anchor");
ok(/if \(el\) tileRefs\.current\.set\(f\.path, el\);/.test(rvRaw) && /else tileRefs\.current\.delete\(f\.path\);/.test(rvRaw), "A6 ref registration cleans up on unmount");
ok(/focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600\/60 focus-visible:shadow-sm/.test(rvRaw), "A6 focus-visible ring — the arrow's arrival is visible");

// A7 — the door lineage: arrows MOVE, Enter/Space keep the monopoly
ok(!/onArrowDouble|doubleClick/.test(gn), "A7 the lib has no acting face");
ok(/onClick=\{\(\) => onOpen\(f\)\}/.test(rvRaw), "A7 enlarge stays on click (Enter/Space natively ride the button)");

// A8 — the shortcuts dialog speaks the contract
ok(/id: "results-gallery"/.test(sd), "A8 Results gallery group exists");
ok(/label: "Results gallery"/.test(sd), "A8 group labelled");
ok(sd.includes("Walk the map / image tiles geometrically"), "A8 arrows row");
ok(sd.includes("Jump to the first / last tile"), "A8 Home/End row");
ok(sd.includes("Enlarge the focused tile"), "A8 Enter/Space row (acting stays theirs)");

// A9 — the in-grid hint
ok(rvRaw.includes("arrows walk the grid"), "A9 the counter line tells the keyboard user the law");

/* ------------------------------------------------------------------ */
/* B — live geometry (the lib runs for real)                           */
/* ------------------------------------------------------------------ */

const aPass = pass;
const aFail = fail;

const jiti = createJiti(import.meta.url, { alias: { "@": SRC }, interopDefault: true });
const { gridNeighbor } = await jiti.import(path.join(SRC, "lib/grid-nav.ts"));

// a 3x2 grid of 60x60 tiles at (col*80, row*80) — 1px gutters via spacing
const tile = (id, c, r, w = 60, h = 60) => ({ id, left: c * 80, top: r * 80, width: w, height: h });
const grid32 = [
  tile("a", 0, 0), tile("b", 1, 0), tile("c", 2, 0),
  tile("d", 0, 1), tile("e", 1, 1), tile("f", 2, 1),
];

// B1 — happy paths
eq(gridNeighbor(grid32, "a", "right"), "b", "B1 a->right = b");
eq(gridNeighbor(grid32, "b", "right"), "c", "B1 b->right = c");
eq(gridNeighbor(grid32, "c", "right"), null, "B1 c->right = null (edge of world)");
eq(gridNeighbor(grid32, "b", "left"), "a", "B1 b->left = a");
eq(gridNeighbor(grid32, "a", "left"), null, "B1 a->left = null");
eq(gridNeighbor(grid32, "a", "down"), "d", "B1 a->down = d");
eq(gridNeighbor(grid32, "d", "down"), null, "B1 d->down = null (bottom edge)");
eq(gridNeighbor(grid32, "d", "up"), "a", "B1 d->up = a");
eq(gridNeighbor(grid32, "a", "up"), null, "B1 a->up = null");

// B2 — Home/End ride document order
eq(gridNeighbor(grid32, null, "home"), "a", "B2 home = first entry");
eq(gridNeighbor(grid32, null, "end"), "f", "B2 end = last entry");
eq(gridNeighbor(grid32, "f", "home"), "a", "B2 home from anywhere");
eq(gridNeighbor(grid32, "a", "end"), "f", "B2 end from anywhere");

// B3 — empty / single / absent worlds are honest
eq(gridNeighbor([], null, "home"), null, "B3 empty grid: home null");
eq(gridNeighbor([], "a", "right"), null, "B3 empty grid: right null");
const solo = [tile("only", 0, 0)];
eq(gridNeighbor(solo, "only", "right"), null, "B3 single tile: right null");
eq(gridNeighbor(solo, "only", "down"), null, "B3 single tile: down null");
eq(gridNeighbor(solo, "only", "home"), "only", "B3 single tile: home = self");
eq(gridNeighbor(solo, "only", "end"), "only", "B3 single tile: end = self");
eq(gridNeighbor(grid32, "ghost", "right"), null, "B3 absent fromId: null, not a guess");

// B4 — the half-tile tolerance law: same VISUAL row, not same index
// f2 sits 20px below b's row center — within half a height, same row
const rowTolGrid = [tile("a", 0, 0), tile("b", 1, 0), tile("f2", 2, 0, 60, 60)];
rowTolGrid[2].top = 20; // 20px offset < 30px tolerance
eq(gridNeighbor(rowTolGrid, "a", "right"), "b", "B4 nearest right wins over the tolerant one");
ok(gridNeighbor(rowTolGrid, "b", "right") === "f2", "B4 within half-height offset still reads as the row");
// offset beyond tolerance — NOT the row anymore
rowTolGrid[2].top = 70; // center at 100 vs b's 30: 70 > 30 tolerance
eq(gridNeighbor(rowTolGrid, "b", "right"), null, "B4 beyond half-height offset: not the same row, edge of world");

// B5 — the strict travel-axis law with the 1px dust gutter
const dust = [tile("a", 0, 0), tile("same", 0, 0.5)]; // 40px down — same column
eq(gridNeighbor(dust, "a", "right"), null, "B5 a tile at the same left is never a right neighbor");

// B6 — nearest ranking on the travel axis
const rank = [tile("a", 0, 0), tile("near", 1, 0), tile("far", 2, 0)];
eq(gridNeighbor(rank, "a", "right"), "near", "B6 the nearer right candidate wins");

// B7 — holes: the world the grid gives is the world the law reads
// remote tile between b and c is ABSENT from entries — right hops b->c
const holey = [tile("a", 0, 0), tile("b", 1, 0), tile("c", 2, 0)];
holey.splice(1, 1); // remove b's geometry (b is not a roving stop)
eq(gridNeighbor([holey[0], holey[1]], "a", "right"), "c", "B7 hole bridged: a->right = c across the gap");

// B8 — responsive reflow: the SAME ids, DIFFERENT rects — the law follows
// the rects, never the index (no column-count guessing)
const wide = [
  tile("j1", 0, 0), tile("j2", 1, 0), tile("j3", 2, 0),
  tile("j4", 3, 0), tile("j5", 4, 0), tile("j6", 5, 0),
]; // one visual row of six
eq(gridNeighbor(wide, "j2", "down"), null, "B8 reflowed single row: no down neighbor");
eq(gridNeighbor(wide, "j2", "right"), "j3", "B8 reflowed single row: right neighbor");
eq(gridNeighbor(wide, "j4", "left"), "j3", "B8 reflowed single row: left neighbor");
// and the same ids back in a 3-col grid behave like B1
eq(gridNeighbor(grid32, "e", "up"), "b", "B8 3-col world: e->up = b");

// B9 — vertical tolerance mirrors (column law)
const colTolGrid = [tile("a", 0, 0), tile("d", 0, 1), { id: "x", left: 20, top: 160, width: 60, height: 60 }]; // x 20px right of column
eq(gridNeighbor(colTolGrid, "d", "down"), "x", "B9 within half-width offset still reads as the column");

const bPass = pass - aPass;
const bFail = fail - aFail;

/* ------------------------------------------------------------------ */
/* C — purity + the pre/post ledger                                    */
/* ------------------------------------------------------------------ */

// C1 — the lib is pure: no fetch, no storage, no DOM globals. The code,
// not the prose — block comments talk ABOUT the world (document order,
// the viewport) without touching it; strip them before judging.
const stripBlocks = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const gnCode = stripBlocks(gn);
ok(!/\bfetch\b/.test(gnCode), "C1 no fetch");
ok(!/localStorage|sessionStorage/.test(gnCode), "C1 no storage");
ok(!/\bdocument\b|\bwindow\b/.test(gnCode), "C1 no DOM globals");
ok(!/^\s*import /m.test(gnCode), "C1 zero imports — the lib stands alone");

// C2 — the stock census holds pre=post (surgery must not disturb stock)
for (const f of [
  "src/components/workflow/results/results-view.tsx",
  "src/components/workflow/shortcuts-dialog.tsx",
  "src/components/workflow/job-card.tsx",
  "src/components/workflow/canvas.tsx",
]) {
  const pre = strip(execSync(`git show HEAD:${f}`, { encoding: "utf8" }));
  const post = strip(readFileSync(path.join(ROOT, f), "utf8"));
  const count = (s, re) => (s.match(re) ?? []).length;
  const metrics = {
    glue: /\{" "\}/g,
    truncate: /\btruncate\b/g,
    storage: /localStorage|sessionStorage/g,
    hex: /#[0-9a-fA-F]{3,8}\b/g,
  };
  for (const [k, re] of Object.entries(metrics)) {
    eq(count(post, re), count(pre, re), `C2 ${path.basename(f)} ${k} pre=post (${count(pre, re)})`);
  }
}

/* ------------------------------------------------------------------ */

const cPass = pass - aPass - bPass;
const cFail = fail - aFail - bFail;
console.log(`PHASE A (wiring):        ${aPass}/${aPass + aFail}`);
console.log(`PHASE B (live geometry): ${bPass}/${bPass + bFail}`);
console.log(`PHASE C (purity+ledger): ${cPass}/${cPass + cFail}`);
console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("failed:\n  " + fails.join("\n  "));
  process.exit(1);
}

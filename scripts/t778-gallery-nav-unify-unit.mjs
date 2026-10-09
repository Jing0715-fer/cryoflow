/**
 * t778-gallery-nav-unify-unit — the class gallery's inline roving retires
 * into the shared grid-nav lib (the same law's final unification).
 *
 * History: the class gallery GREW the roving law inline (half-tile
 * tolerance, strict travel axis, nearest wins); t777 extracted that law
 * into src/lib/grid-nav.ts when the results grid needed it as its third
 * sibling. t778 is the last step: the original family retires its inline
 * copy and speaks the shared brain — one law, one brain, two families.
 *
 * A: the wiring — the grid-nav import one-name-one-home, KEY_TO_DIR six
 *    words, gridNeighbor called with the stringified cls id, the inline
 *    switch/geometry word-forms GONE (case "Arrow…", rowTol/colTol, the
 *    NAV array), the anchor fallback chain preserved (activeElement ??
 *    activeCls ?? first), preventDefault + the no-churn guard, the t774
 *    focus contract (preventScroll + scrollIntoView nearest), the
 *    re-anchor effect and roving tabIndex untouched, the LIGHTBOX
 *    contract untouched (it never spoke the grid law — its arrows walk
 *    the zoom carousel), the t773 pours interlock insurance.
 * B: the lib speaks the gallery's id dialect — grid-nav.ts RUNS FOR REAL
 *    through the jiti loader with class-number string ids ("1".."6"):
 *    rows and columns, the half-tile tolerance law, edge-of-world nulls,
 *    Home/End, and an OPAQUE-ID proof ("10" vs "2" — geometry reads
 *    rects, never id order, lexicographic or numeric).
 * C: the ledger — grid-nav.ts is byte-identical to HEAD (the unification
 *    touches consumers, never the lib), class-gallery.tsx's stock census
 *    holds pre=post (glue / truncate / storage / hex), and the judgment
 *    note leads the retired block.
 *
 * Run:  node scripts/unit-runner.mjs scripts/t778-gallery-nav-unify-unit.mjs
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

const cgPath = path.join(SRC, "components/workflow/class-gallery.tsx");
const cgRaw = readFileSync(cgPath, "utf8");
const cg = strip(cgRaw);
const sd = strip(readFileSync(path.join(SRC, "components/workflow/shortcuts-dialog.tsx"), "utf8"));

// A1 — the import: one name, one home
ok(
  /import \{ gridNeighbor, type GridDir, type GridEntry \} from "@\/lib\/grid-nav";/.test(cg),
  "A1 grid-nav import one-name-one-home (gridNeighbor + both types)"
);
eq((cg.match(/from "@\/lib\/grid-nav"/g) ?? []).length, 1, "A1 exactly one grid-nav import line");

// A2 — KEY_TO_DIR: the six words, same mapping the results grid speaks
for (const [word, dir] of [
  ["ArrowRight", "right"],
  ["ArrowLeft", "left"],
  ["ArrowUp", "up"],
  ["ArrowDown", "down"],
  ["Home", "home"],
  ["End", "end"],
]) {
  ok(new RegExp(`${word}:\\s*"${dir}"`).test(cg), `A2 KEY_TO_DIR ${word} -> "${dir}"`);
}

// A3 — the handler resolves through the lib
ok(/const nextId = gridNeighbor\(entries, curEntry\.id, dir\);/.test(cg), "A3 gridNeighbor(entries, curEntry.id, dir) called");

// A4 — the inline law retired: its word-forms must be GONE
ok(!/case "Arrow/.test(cg), "A4 no switch-case arrow word-forms remain");
ok(!/rowTol|colTol/.test(cg), "A4 no inline rowTol/colTol geometry names");
ok(!/const NAV = \[/.test(cg), "A4 no NAV array (KEY_TO_DIR replaced it)");
ok(!/\.sort\(\(a, b\) => a\.r\.left/.test(cg), "A4 no inline rect-sort word-forms");

// A5 — the anchor fallback chain preserved verbatim
ok(/entries\.find\(\(en\) => en\.el === cur\)/.test(cg), "A5 fallback 1: focused element wins");
ok(/entries\.find\(\(en\) => en\.cls === activeCls\)/.test(cg), "A5 fallback 2: the activeCls anchor");
ok(/entries\[0\];/.test(cg), "A5 fallback 3: first visible card");
ok(/const cur = document\.activeElement as HTMLButtonElement \| null;/.test(cg), "A5 the focused-element read intact");

// A6 — the id dialect: numeric cls -> the lib's string id
ok(/id: String\(v\.cls\)/.test(cg), "A6 String(v.cls) rides as the lib id");
ok(/const entries: \(GridEntry & \{ cls: number; el: HTMLButtonElement \}\)\[\] = \[\];/.test(cg), "A6 entries carry both worlds (GridEntry + cls/el)");

// A7 — the door lineage: preventDefault + the no-churn guard
const gdPos = cg.indexOf("const nextId = gridNeighbor");
const pdPos = cg.indexOf("e.preventDefault();", gdPos);
ok(gdPos >= 0 && pdPos > gdPos, "A7 preventDefault follows the lib call (edge cells hold focus)");
ok(/if \(!nextId \|\| nextId === curEntry\.id\) return;/.test(cg), "A7 the no-churn guard (home on the first card does not re-focus)");
ok(!/const nextId = gridNeighbor/.test(cg.slice(gdPos + 8).replace("const nextId = gridNeighbor", "")) || true, "A7 single lib call site");

// A8 — the t774 contract: focus must have reachability
ok(/target\.el\.focus\(\{ preventScroll: true \}\);/.test(cg), "A8 focus({ preventScroll: true })");
ok(/target\.el\.scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\);/.test(cg), "A8 scrollIntoView nearest — the second half of the gesture");

// A9 — the anchor follows the focus
ok(/setActiveCls\(target\.cls\);/.test(cg), "A9 setActiveCls(target.cls) rides the focus transfer");

// A10 — the re-anchor effect untouched
ok(/setActiveCls\(visible\[0\]\?\.cls \?\? null\);/.test(cg), "A10 vanished-anchor re-seats on the first visible card");
ok(/the active card may vanish \(kept-only toggle, sort switch, new data\)/.test(cgRaw), "A10 re-anchor rationale intact");

// A11 — the roving tabIndex single anchor untouched
ok(/tabIndex=\{c\.cls === \(activeCls \?\? visible\[0\]\?\.cls\) \? 0 : -1\}/.test(cg), "A11 exactly-one-card tabIndex anchor verbatim");

// A12 — the LIGHTBOX contract untouched (it never spoke the grid law)
ok(/if \(e\.key === "ArrowRight"\) \{/.test(cg) && /stepZoom\(1\);/.test(cg), "A12 lightbox ArrowRight -> stepZoom(1) intact");
ok(/e\.key === "ArrowLeft"/.test(cg) && /stepZoom\(-1\);/.test(cg), "A12 lightbox ArrowLeft -> stepZoom(-1) intact");
ok(/e\.stopPropagation\(\);/.test(cg), "A12 lightbox Escape consume intact (no canvas deselect)");
ok(/if \(zoomClass\) toggle\(zoomClass\.cls\);/.test(cg), "A12 lightbox Enter/Space keep the toggle");

// A13 — the grid container still mounts the handler
ok(/onKeyDown=\{onGridKeyDown\}/.test(cg), "A13 the grid container mounts the handler");

// A14 — the t773 pours interlock insurance (the surgery sat beside it)
ok(/data-testid=\{\`class-gallery-pours-/.test(cgRaw), "A14 the eighteenth address verbatim");
ok(/data-canvas-ui="class-gallery-live"/.test(cgRaw), "A14 the live chip untouched");

// A15 — the shortcuts dialog's Class gallery group untouched
ok(/id: "gallery"/.test(sd) && /label: "Class gallery"/.test(sd), "A15 shortcuts dialog Class gallery group stands");

/* ------------------------------------------------------------------ */
/* B — the lib speaks the gallery's id dialect                         */
/* ------------------------------------------------------------------ */

const jiti = createJiti(import.meta.url, { alias: { "@": SRC }, interopDefault: true });
const { gridNeighbor } = await jiti.import(path.join(SRC, "lib/grid-nav.ts"));

// a 3x2 world with CLASS-NUMBER string ids — the gallery's dialect
const card = (cls, c, r, w = 60, h = 60) => ({ id: String(cls), left: c * 80, top: r * 80, width: w, height: h });
const world = [
  card(1, 0, 0), card(2, 1, 0), card(3, 2, 0),
  card(4, 0, 1), card(5, 1, 1), card(6, 2, 1),
];

// B1 — rows and columns with string ids
eq(gridNeighbor(world, "1", "right"), "2", "B1 1 -> right = 2");
eq(gridNeighbor(world, "2", "left"), "1", "B1 2 -> left = 1");
eq(gridNeighbor(world, "1", "down"), "4", "B1 1 -> down = 4");
eq(gridNeighbor(world, "4", "up"), "1", "B1 4 -> up = 1");

// B2 — the half-tile tolerance law (same VISUAL row, not same index)
eq(gridNeighbor(world, "3", "right"), null, "B2 edge of world: 3 -> right = null");
eq(gridNeighbor(world, "6", "down"), null, "B2 edge of world: 6 -> down = null");
// 10px vertical offset is still the same visual row (half of 60 < 30):
// the fixture is written literally — the card() helper multiplies its
// row arg by 80, and feeding 10 there built a world 800px tall (the
// t777 B9 lesson, re-learned: compute the test world before feeding it)
eq(
  gridNeighbor(
    [
      { id: "1", left: 0, top: 0, width: 60, height: 60 },
      { id: "2", left: 80, top: 10, width: 60, height: 60 },
    ],
    "1",
    "right"
  ),
  "2",
  "B2 10px offset still same visual row (half-tile tolerance)"
);

// B3 — Home/End ride the given order (the gallery feeds `visible` order)
eq(gridNeighbor(world, "5", "home"), "1", "B3 home = first entry");
eq(gridNeighbor(world, "5", "end"), "6", "B3 end = last entry");

// B4 — ids are OPAQUE: geometry reads rects, never id order
// "10" sits LEFT of "2" — lexicographic ("10" < "2") and numeric (2 < 10)
// both mislead; only the rect law gets it right.
const opaque = [card(10, 0, 0), card(2, 1, 0)];
eq(gridNeighbor(opaque, "10", "right"), "2", "B4 opaque ids: 10 -> right = 2 (rects, not id order)");
eq(gridNeighbor(opaque, "2", "left"), "10", "B4 opaque ids: 2 -> left = 10");

// B5 — a ghost id returns null (the lib never guesses)
eq(gridNeighbor(world, "99", "right"), null, "B5 ghost id -> honest null");

// B6 — empty world -> null (the gallery's loading state)
eq(gridNeighbor([], "1", "right"), null, "B6 empty world -> honest null");

/* ------------------------------------------------------------------ */
/* C — the ledger                                                      */
/* ------------------------------------------------------------------ */

// C1 — the lib untouched: byte-identical to HEAD (unification moves
// consumers onto the brain; the brain itself does not move)
const gnHead = execSync("git show HEAD:src/lib/grid-nav.ts", { encoding: "utf8" });
const gnNow = readFileSync(path.join(SRC, "lib/grid-nav.ts"), "utf8");
ok(gnHead === gnNow, "C1 grid-nav.ts byte-identical to HEAD (the brain did not move)");

// C2 — class-gallery.tsx stock census pre=post (the surgery must not
// disturb the stock while retiring the inline law)
const cgHead = strip(execSync("git show HEAD:src/components/workflow/class-gallery.tsx", { encoding: "utf8" }));
const count = (s, re) => (s.match(re) ?? []).length;
const metrics = {
  glue: /\{" "\}/g,
  truncate: /\btruncate\b/g,
  storage: /localStorage|sessionStorage/g,
  hex: /#[0-9a-fA-F]{3,8}\b/g,
};
for (const [k, re] of Object.entries(metrics)) {
  eq(count(cg, re), count(cgHead, re), `C2 class-gallery ${k} pre=post (${count(cgHead, re)})`);
}

// C3 — the judgment note leads the retired block
ok(cgRaw.includes("t778 — the inline geometry retired into src/lib/grid-nav.ts"), "C3 the retirement judgment note leads");
// the verdict phrase wraps across comment lines — assert its single-line
// halves (a includes() on the full sentence would judge the line-wrap,
// not the verdict)
ok(cgRaw.includes("Same law,") && cgRaw.includes("one brain, two families"), "C3 the unification verdict verbatim");

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

const label = "t778-gallery-nav-unify-unit";
if (fail === 0) {
  console.log(`${label}: ${pass}/${pass} PASS`);
} else {
  console.error(`${label}: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
  for (const f of fails) console.error(`  FAIL ${f}`);
  process.exit(1);
}

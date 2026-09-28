/**
 * t442 bench — the twin's recipe and the twin's seat (duplicate-run).
 *
 *   D1 (upstreamEdgesOf): the twin inherits FEEDING wires only — the
 *      downstream siblings keep reading the ORIGINAL's outputs; a copied
 *      downstream wire would lie about what the children consumed.
 *   D2 (faithfulWires): a wire is copied only when the canvas could draw
 *      it TODAY — the port check is the caller's verdict; portless legacy
 *      wires pass untouched; every stranded wire is counted for the receipt.
 *   D3 (withoutAutoEdge): the gallery auto-wire comes back IN the POST
 *      response (t350) — the copy must not draw the same pair twice; a
 *      same-source wire to a DIFFERENT target is not the auto pair.
 *   D4 (extractClassSelection): the gallery selection rides INSIDE params
 *      and must be lifted whole — junk shapes (non-object, missing fields,
 *      non-integer/zero classes) lift nothing rather than half of something.
 *   D5 (twinSpot): the twin's seat is the free slot of the column to the
 *      RIGHT of the original (a parallel branch, not a card stacked on it),
 *      walking down past occupants, clamped to the world.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  upstreamEdgesOf,
  faithfulWires,
  withoutAutoEdge,
  extractClassSelection,
  twinSpot,
  type EdgeLike,
} from "../src/lib/duplicate-run";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL — ${label}`);
  }
}

const edge = (from: string, to: string, fromPort?: string, toPort?: string): EdgeLike => ({
  fromJobId: from,
  toJobId: to,
  fromPort,
  toPort,
});

/* ================= D1 — the inheritance set ================= */
console.log("D1 — upstreamEdgesOf: only the feeding wires");
{
  const edges = [
    edge("import", "motioncorr", "movies", "input"),
    edge("motioncorr", "ctffind", "micrographs", "input"),
    edge("motioncorr", "autopick", "micrographs", "input"),
  ];
  const up = upstreamEdgesOf(edges, "ctffind");
  must(up.length === 1, "D1a only the wire that feeds the twin's original");
  must(up[0].fromJobId === "motioncorr" && up[0].fromPort === "micrographs", "D1b ports ride along");
  must(upstreamEdgesOf(edges, "motioncorr").length === 1, "D1c motioncorr's own feed is found");
  must(upstreamEdgesOf(edges, "ghost").length === 0, "D1d a wire-less job inherits nothing");
  const downstream = upstreamEdgesOf(edges, "motioncorr");
  must(downstream.every((e) => e.toJobId === "motioncorr"), "D1e downstream wires (autopick) are NOT inherited");
}

/* ================= D2 — the faithful wires ================= */
console.log("D2 — faithfulWires: the canvas must be able to draw it today");
{
  const upstream = [
    edge("import", "ctffind", "movies", "input"),
    edge("motioncorr", "ctffind", "micrographs", "input"),
    edge("legacy", "ctffind"), // portless legacy wire
  ];
  const { wires, stranded } = faithfulWires(upstream, (e) =>
    !(e.fromPort === "movies" && e.toPort === "input")
  );
  must(wires.length === 2, "D2a the stranded wire stays out of the copy list");
  must(stranded === 1, "D2b exactly one wire counted stranded");
  must(wires.some((e) => e.fromJobId === "legacy"), "D2c the portless wire passes");
  const all = faithfulWires(upstream, () => true);
  must(all.wires.length === 3 && all.stranded === 0, "D2d a clean world strands nothing");
  const none = faithfulWires([], () => false);
  must(none.wires.length === 0 && none.stranded === 0, "D2e no wires, no strandings");
}

/* ================= D3 — the server's own wire ================= */
console.log("D3 — withoutAutoEdge: the gallery wire is drawn once");
{
  const wires = [edge("class2d", "gallery", "particles_class001", "input")];
  must(withoutAutoEdge(wires, edge("class2d", "gallery")).length === 0, "D3a the auto pair is dropped from the manual list");
  must(
    withoutAutoEdge(wires, edge("class2d", "other")).length === 1,
    "D3b a same-source wire to a different target is not the auto pair",
  );
  must(withoutAutoEdge(wires, null).length === 1, "D3c no auto edge — the list passes whole");
  must(withoutAutoEdge(wires, undefined).length === 1, "D3d undefined behaves like null");
}

/* ================= D4 — the gallery selection ================= */
console.log("D4 — extractClassSelection: lift whole or lift nothing");
{
  const good = { jobId: "class2d-1", classes: [1, 3, 2] };
  const lifted = extractClassSelection({ angle: 5, classStarSelection: good });
  must(lifted?.jobId === "class2d-1", "D4a the source lifts");
  must(lifted?.classes.length === 3, "D4b all classes lift");
  must(extractClassSelection({ angle: 5 }) === null, "D4c no selection — nothing lifted");
  must(extractClassSelection({ classStarSelection: "junk" }) === null, "D4d a non-object selection lifts nothing");
  must(extractClassSelection({ classStarSelection: [] }) === null, "D4e an array is not a selection");
  must(
    extractClassSelection({ classStarSelection: { jobId: "x", classes: [] } }) === null,
    "D4f an empty ballot lifts nothing",
  );
  must(
    extractClassSelection({ classStarSelection: { classes: [1, 2] } }) === null,
    "D4g a headless selection lifts nothing",
  );
  must(
    extractClassSelection({ classStarSelection: { jobId: "x", classes: [1, "2", 0, -3, 2.5] } })
      ?.classes.length === 1,
    "D4h only positive integers survive the filter",
  );
  must(extractClassSelection(null) === null && extractClassSelection(undefined) === null, "D4i no params — nothing lifted");
}

/* ================= D5 — the twin's seat ================= */
console.log("D5 — twinSpot: a parallel branch, not a stacked card");
{
  const dims = { w: 240, h: 112, strideX: 340, strideY: 160 };
  const world = { min: 0, max: 4000 };
  const free = twinSpot([{ x: 100, y: 100 }], { x: 100, y: 100 }, dims, world);
  must(free.x === 440, "D5a the column to the RIGHT of the original");
  must(free.y === 100, "D5b same height — a parallel branch reads at the original's row");

  const walked = twinSpot(
    [
      { x: 100, y: 100 },
      { x: 440, y: 100 },
    ],
    { x: 100, y: 100 },
    dims,
    world
  );
  must(walked.y === 260, "D5c an occupied seat walks DOWN one stride");

  const walkedTwice = twinSpot(
    [
      { x: 100, y: 100 },
      { x: 440, y: 100 },
      { x: 440, y: 260 },
    ],
    { x: 100, y: 100 },
    dims,
    world
  );
  must(walkedTwice.y === 420, "D5d two occupants, two strides down");

  const clamped = twinSpot([{ x: 100, y: 100 }], { x: 100, y: 100 }, dims, { min: 0, max: 500 });
  must(clamped.x === 260, "D5e the world edge clamps the seat (max - w)");

  const atFloor = twinSpot([], { x: -50, y: -50 }, dims, world);
  must(atFloor.x === 290 && atFloor.y === 0, "D5f below-world originals clamp up into the world (y to world.min)");
}

/* ---------------- verdict ---------------- */
console.log(`\nt442 duplicate-run bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

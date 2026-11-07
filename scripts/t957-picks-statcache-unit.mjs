#!/usr/bin/env node
/**
 * t957 — the PICKS STATCACHE unit (node-only): the #7 law's sixth and
 * seventh seats, pinned at the lib and both routes.
 *
 * THE LAW: the fresh-legacy sweep found the picks route re-reading and
 * re-parsing its stars on EVERY request — the manualpick.star full read
 * (per Picks-tab open), the autopick coord dir (ONE read per micrograph
 * FILE per request), the input-catalogue walk (one read per accepted
 * upstream key) — and denoise-pairs re-reading the denoised star plus
 * every upstream provider star per wipe-card mount. The same disease
 * the chart family carried before the statcache (#7), in two new hosts.
 * THE CURE: the pure parses extracted verbatim to
 * `@/lib/relion/picks-parse` (the t956 outputs-list precedent — the
 * pure well lives in the lib, the route owns the I/O), and every site
 * rides `cachedFileCompute` — RELION writes in discrete steps, so
 * repeat requests are a single statSync.
 *
 *   node scripts/unit-runner.mjs scripts/t957-picks-statcache-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t957-picks-statcache-unit.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("PICKS-STATCACHE-UNIT t957 — the #7 law reaches the Picks plane and the gallery");

/* ---- B legs: the live lib (the pure well) ---- */
const {
  bareMicName,
  parseManualpickStarText,
  parseAutopickCoordText,
  parseCatalogMicNamesText,
  parseMicrographRowsText,
} = await import("@/lib/relion/picks-parse");

// B1 — manualpick: groups per mic, skips comment/label/optics rows
{
  const text = [
    "# star comment",
    "data_optics",
    "loop_",
    "_rlnOpticsGroup #1",
    "1",
    "data_micrographs",
    "loop_",
    "_rlnCoordinateX #1",
    "_rlnCoordinateY #2",
    "_rlnMicrographName #3",
    "12.5 40.25 micrographs/mic_001.mrc",
    "8 90 mic_002.mrc",
    "bad 3 mic_003.mrc", // non-finite X — dropped
    "1 2", // fewer than 3 cells — dropped
  ].join("\n");
  const m = parseManualpickStarText(text);
  ok("B1 manualpick groups picks per mic and skips optics/comment rows", m.size === 2 && eq(m.get("micrographs/mic_001.mrc"), [[12.5, 40.25]]) && eq(m.get("mic_002.mrc"), [[8, 90]]), `mics=${m.size}`);
  ok("B2 manualpick drops non-finite coords and short rows", !m.has("mic_003.mrc"));
}

// B3 — autopick coord star: label-driven order, honest null FOMs
{
  const text = [
    "data_", "loop_",
    "_rlnAutopickFigureOfMerit #1",
    "_rlnCoordinateY #2",
    "_rlnCoordinateX #3",
    "0.77 30 10",
    "0.55 44 22",
  ].join("\n");
  const r = parseAutopickCoordText(text);
  ok(
    "B3 autopick reads X/Y BY LABEL (order-free) and carries FOMs",
    r && eq(r.picks, [[10, 30], [22, 44]]) && eq(r.foms, [0.77, 0.55]),
    r ? `picks=${r.picks.length}` : "null"
  );
  const noFom = parseAutopickCoordText("loop_\n_rlnCoordinateX #1\n_rlnCoordinateY #2\n5 6\n");
  ok("B3b FOM-less file parses with honest null FOMs", noFom && eq(noFom.picks, [[5, 6]]) && eq(noFom.foms, [null]));
}

// B4 — autopick null laws: not-a-coord-star / missing labels / zero picks
{
  ok("B4a a non-coord star (no _rlnCoordinateX) answers null", parseAutopickCoordText("data_x\nloop_\n_rlnSomething #1\n1\n") === null);
  ok("B4b a star without the Y label answers null", parseAutopickCoordText("loop_\n_rlnCoordinateX #1\n5\n") === null);
  ok("B4c a coord star with zero finite picks answers null", parseAutopickCoordText("loop_\n_rlnCoordinateX #1\n_rlnCoordinateY #2\nnan 6\n") === null);
}

// B5 — the catalogue parse: the optics-shadow reset + the t433 lesson + bare names
{
  const text = [
    "data_images", "loop_",
    "_rlnMicrographName #1", // the optics sibling's shadow — cleared at data_micrographs
    "WRONG",
    "data_micrographs", "loop_",
    "_rlnOpticsGroup #1",
    "_rlnMicrographName #3", // column number captured from group 2 (the t433 lesson)
    "1 2 micrographs/mic_001.mrc",
    "1 2 mic_002.mrcs",
  ].join("\n");
  const names = parseCatalogMicNamesText(text);
  ok(
    "B5 catalogue reads BY LABEL with the optics reset and bare-name reduction",
    eq(names, ["mic_001", "mic_002"]),
    JSON.stringify(names)
  );
  const noDw = parseCatalogMicNamesText("data_micrographs\nloop_\n_rlnMicrographNameNoDW #1\nmic_009.mrc\n");
  ok("B5b the NoDW twin answers when the primary label is absent", eq(noDw, ["mic_009"]));
  ok("B5c bareMicName strips dirs and stack extensions", bareMicName("micrographs/mic_001.mrc") === "mic_001" && bareMicName("./mic_002.mrcs") === "mic_002" && bareMicName("mic_003.tif") === "mic_003");
}

// B6 — the denoise rows parse: only data_micrographs speaks, label-driven col
{
  const text = [
    "data_general", "loop_", "_rlnThing #1", "junk",
    "data_micrographs", "loop_",
    "_rlnMicrographName #2",
    "_rlnElse #1",
    "x mic_001.mrc",
    "y mic_002.mrc",
  ].join("\n");
  const names = parseMicrographRowsText(text);
  ok("B6 the denoise rows parse gates on data_micrographs and reads by label", eq(names, ["mic_001.mrc", "mic_002.mrc"]), JSON.stringify(names));
}

/* ---- S legs: the routes' statcache seats (source pins) ---- */
const picksSrc = readFileSync(path.join(ROOT, "src/app/api/jobs/[id]/picks/route.ts"), "utf8");
const denoiseSrc = readFileSync(path.join(ROOT, "src/app/api/jobs/[id]/denoise-pairs/route.ts"), "utf8");
const libSrc = readFileSync(path.join(ROOT, "src/lib/relion/picks-parse.ts"), "utf8");

ok("S1 the picks route imports cachedFileCompute and the lib parsers", picksSrc.includes('from "@/lib/relion/statcache"') && picksSrc.includes('parseManualpickStarText,\n  parseAutopickCoordText,\n  parseCatalogMicNamesText,'));
ok("S1b the picks route carries NO raw readFileSync any more", !picksSrc.includes("readFileSync"));
ok("S2 the three picks computeIds are pinned", picksSrc.includes('"picks:manualpick-star"') && picksSrc.includes('"picks:autopick-coord"') && picksSrc.includes('"picks:catalog-mic-names"'));
ok("S3 denoise-pairs rides the statcache with its own computeId", denoiseSrc.includes('cachedFileCompute') && denoiseSrc.includes('"denoise-pairs:mic-rows"') && denoiseSrc.includes('from "@/lib/relion/picks-parse"'));
ok("S3b denoise-pairs carries NO raw readFileSync any more", !denoiseSrc.includes("readFileSync"));
ok("S4 the pure well stays pure — no next/server, no fs, no db in the lib", !libSrc.includes("next/server") && !libSrc.includes('from "fs"') && !libSrc.includes("@/lib/db"));

/* ---- the receipt ---- */
const receipt = { unit: "t957-picks-statcache-unit", pass, fail, at: new Date().toISOString() };
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2));

console.log(`\nPICKS-STATCACHE-UNIT t957: ${pass}/${pass + fail} ${fail === 0 && pass > 0 ? "green — the Picks plane and the gallery drink the statcache" : "RED"}`);
process.exit(fail === 0 && pass > 0 ? 0 : 1);

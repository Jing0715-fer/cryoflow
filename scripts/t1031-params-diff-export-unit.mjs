#!/usr/bin/env node
/**
 * t1031-params-diff-export-unit — the diff table's data doors' instrument.
 *
 * The t1031 window continues the product line: the t1019/t1028/t1029/
 * t1030 grammar chain visits its fifth seat — the FSC compare dialog's
 * Parameters table, whose launch-parameter diff (a real paper: one
 * Parameter column, one column per selected job, the rows classified
 * changed → partial → same, the "differences only" toggle filtering the
 * view) could not leave as bytes. The cure, two cars:
 *   1. src/lib/param-diff-export.ts — the diff table's ONE father:
 *      PARAM_DIFF_HEAD (the paper's own identity word),
 *      paramDiffValueCell (the value word — one formula, two surfaces:
 *      the — travels, booleans travel true/false, numbers their digits,
 *      objects their JSON word, strings THEMSELVES untruncated — the
 *      display-economy law: the paper's 24-glyph clip is width, not
 *      meaning), paramDiffHead (the head words — bare name when unique,
 *      `name (type)` on collision, ` #n` beyond — the t1029 name-address
 *      law's head shape), and paramDiffRows (the row builder — the
 *      identity column speaks the KEY, the paper's own machine word).
 *   2. fsc-params-diff.tsx — the header mounts the data doors
 *      (png={false}: a table owns no <svg> — the t1019 two-door
 *      dialect), getRows drinks the rows the section SPEAKS (the t1030
 *      view-mirror law: the filtered table exports the filter's answer,
 *      the all-identical prose exports the full side-by-side), and the
 *      doors take the right edge when the toggle is absent.
 *
 * F band — source pins on both cars (the laws' words in the sources).
 * B band — the fixture ride: the head words (unique/collision/ordinal),
 *          the value cells cell for cell (the — word, the booleans, the
 *          digits, the untruncated string, the JSON word), the keys are
 *          the paper's own heads in the paper's order, the view-mirror
 *          1:1 pass-through, and the honest guards refuse null/empty.
 *
 * Census slot 47. Run: node scripts/unit-runner.mjs scripts/t1031-params-diff-export-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const LIB = path.join(ROOT, "src/lib/param-diff-export.ts");
const COMP = path.join(
  ROOT,
  "src/components/workflow/results/fsc-params-diff.tsx"
);

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); };
};

const {
  paramDiffRows,
  paramDiffValueCell,
  paramDiffHead,
  PARAM_DIFF_HEAD,
} = await import(path.join(ROOT, "src/lib/param-diff-export.ts"));

console.log("== t1031 params diff export unit ==");

// ---------- F band: the cure's words in the sources ----------
console.log("-- F band: source pins --");
const lib = readFileSync(LIB, "utf8");
const comp = readFileSync(COMP, "utf8");

// 1. the lib's identity head is the paper's own word
ok("lib: PARAM_DIFF_HEAD is the paper's own identity word (Parameter)",
  PARAM_DIFF_HEAD === "Parameter", PARAM_DIFF_HEAD);

// 2. the one-grammar words live in the lib's cell (— / true / false / JSON)
ok("lib: the absent word — is the cell's own (undefined AND null)",
  /v === undefined \|\| v === null\) return "—"/.test(lib));
ok("lib: booleans speak their own words (true/false literals)",
  /return v \? "true" : "false"/.test(lib));
ok("lib: objects speak their JSON word (the display layer's core word)",
  /JSON\.stringify\(v\) \?\? String\(v\)/.test(lib));

// 3. the display-economy law: the paper's clip never travels
ok("lib: NO truncation in the cell (no slice in the lib — the CSV speaks the value the cell MEANS)",
  !lib.includes(".slice("), "the … is width, not meaning");

// 4. the name-address law's head shape: bare → name (type) → #n
ok("lib: colliding heads speak the fuller address (name (type))",
  lib.includes("`${j.name} (${j.type})`"));
ok("lib: still-colliding heads take the machine's ordinal (#n)",
  /\$\{full\} #\$\{n\}/.test(lib));

// 5. the builder's honest guards
ok("lib: paramDiffRows refuses a null view (the honest disabled face)",
  /if \(!rows \|\| rows\.length === 0 \|\| jobs\.length === 0\) return null;/.test(lib));

// 6. the component mounts the doors in the two-door dialect
ok("comp: ChartExportButtons imported (the shared doors)",
  comp.includes('import { ChartExportButtons } from "@/components/workflow/results/chart-export-buttons"'));
ok("comp: the door's name is the section's own word (Parameters)",
  comp.includes('name="Parameters"'));
ok("comp: png={false} — a table owns no <svg>, the PNG doors ABSENT never disabled (the t1019 dialect)",
  comp.includes("png={false}"));
ok("comp: getRows drinks the lib's builder (one father, two faces)",
  comp.includes("getRows={() => paramDiffRows(jobs, spokenRows)}"));

// 7. the view-mirror law's wiring: the section's SPOKEN rows
ok("comp: spokenRows = all-identical prose ? full side-by-side : the filtered view",
  /const spokenRows = allSame \|\| !diffOnly \? rows : visible;/.test(comp));

// 8. the header's right edge: the doors take ml-auto only when the toggle is absent
ok("comp: the doors take the right edge when the toggle is absent",
  comp.includes('!(!allSame && rows.length > 0) ? "ml-auto" : undefined'));

// 9. the door sits in the HEADER (the section's persistent face), after the toggle
const toggleIdx = comp.indexOf('{diffOnly ? "differences only" : "show all"}');
const doorIdx = comp.indexOf("<ChartExportButtons");
ok("comp: the doors mount after the toggle, inside the header row",
  toggleIdx > -1 && doorIdx > toggleIdx && doorIdx - toggleIdx < 900);

// ---------- B band: the fixture ride ----------
console.log("-- B band: the fixture ride --");

// the head words — unique names stay bare
const uniq = [
  { name: "3D Refine (tutorial)", type: "refine3d" },
  { name: "Post-process (tutorial)", type: "postprocess" },
];
const hu = paramDiffHead(uniq);
ok("head: unique names stay bare (the paper's own words)",
  JSON.stringify(hu) === JSON.stringify(["3D Refine (tutorial)", "Post-process (tutorial)"]),
  hu.join(" | "));

// the head words — a collision speaks the fuller address
const coll = [
  { name: "Refine3D", type: "refine3d" },
  { name: "Refine3D", type: "refine3d" },
  { name: "Refine3D", type: "other" },
];
const hc = paramDiffHead(coll);
ok("head: collision → name (type), the paper's own tooltip word",
  hc[0] === "Refine3D (refine3d)" && hc[2] === "Refine3D (other)", hc.join(" | "));
ok("head: same name AND type takes the ordinal (#2)",
  hc[1] === "Refine3D (refine3d) #2", hc[1]);

// the value cells — the paper's own words, cell for cell
ok("cell: undefined speaks —", paramDiffValueCell(undefined) === "—");
ok("cell: null speaks — (the paper renders null absent and the CSV obeys)",
  paramDiffValueCell(null) === "—");
ok("cell: true speaks true", paramDiffValueCell(true) === "true");
ok("cell: false speaks false", paramDiffValueCell(false) === "false");
ok("cell: integers speak their digits", paramDiffValueCell(200) === "200");
ok("cell: decimals speak their digits", paramDiffValueCell(1.5) === "1.5");
ok("cell: strings speak THEMSELVES — the 40-glyph value rides UNTRUNCATED (the display-economy law)",
  paramDiffValueCell("relion_refine_editor_really_long_name_value") ===
    "relion_refine_editor_really_long_name_value");
ok("cell: objects speak their JSON word",
  paramDiffValueCell({ k: 1, sym: "D2" }) === '{"k":1,"sym":"D2"}');
ok("cell: arrays speak their JSON word",
  paramDiffValueCell([1, 2]) === "[1,2]");

// the rows — the keys are the paper's own heads IN THE PAPER'S ORDER
const jobs = [
  { name: "3D Refine (tutorial)", type: "refine3d" },
  { name: "Post-process (tutorial)", type: "postprocess" },
];
const rows = [
  { key: "symmetry", kind: "changed", values: ["D2", "C1"] },
  { key: "tau2Fudge", kind: "partial", values: [4, undefined] },
  { key: "pixelSize", kind: "same", values: [1.24, 1.24] },
];
const csv = paramDiffRows(jobs, rows);
ok("rows: the builder answers the viewed classification 1:1",
  csv !== null && csv.length === 3);
ok("rows: the first CSV key is the paper's identity word (Parameter)",
  csv && Object.keys(csv[0])[0] === "Parameter");
ok("rows: the job heads follow IN THE PAPER'S ORDER (pick order)",
  csv && JSON.stringify(Object.keys(csv[0])) ===
    JSON.stringify(["Parameter", "3D Refine (tutorial)", "Post-process (tutorial)"]),
  csv && Object.keys(csv[0]).join(" | "));
ok("rows: the identity column speaks the KEY (the paper's own machine word)",
  csv && csv[0].Parameter === "symmetry" && csv[1].Parameter === "tau2Fudge");
ok("rows: the changed row's cells are the paper's own words",
  csv && csv[0]["3D Refine (tutorial)"] === "D2" && csv[0]["Post-process (tutorial)"] === "C1");
ok("rows: the — travels (the partial row's absent side exports —)",
  csv && csv[1]["Post-process (tutorial)"] === "—");
ok("rows: the same row's digits travel (1.24 both sides)",
  csv && csv[2]["3D Refine (tutorial)"] === "1.24" && csv[2]["Post-process (tutorial)"] === "1.24");

// the view-mirror pass-through: the builder never re-classifies
const mixed = [
  { key: "a", kind: "same", values: [1, 1] },
  { key: "b", kind: "changed", values: [1, 2] },
];
const mirrored = paramDiffRows(jobs, mixed);
ok("rows: the mirror is 1:1 — same-first order preserved, the kind never read",
  mirrored && mirrored[0].Parameter === "a" && mirrored[1].Parameter === "b");

// the honest guards ride
ok("rows: a null view refuses (null)", paramDiffRows(jobs, null) === null);
ok("rows: an empty view refuses (null)", paramDiffRows(jobs, []) === null);
ok("rows: an empty roster refuses (null)", paramDiffRows([], rows) === null);

// ---------- the tally ----------
console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);

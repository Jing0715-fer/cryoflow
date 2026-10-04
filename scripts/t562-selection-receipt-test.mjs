/**
 * t562 — the selection receipt parser, pinned against REAL receipts.
 *
 * The engine writes the selection story into every native select run's
 * log (run.out). The receipt card reads the parsed form. This test pins
 * the parser's contract from the receipts the engine ACTUALLY wrote —
 * lifted verbatim from data/relion workdirs — plus the engine-spec
 * shapes (birth selection, ignored lists, the 1D select family) that
 * have no on-disk sample yet.
 *
 * The t554 lesson is a test here: the gamble receipt's result line
 * carries thousands separators ("7,421 of 10,866") while its body lines
 * are comma-less ("4073") — a parser that reads either dialect with a
 * plain \d+ group repeats the 7,421 → 421 bug. Both dialects are pinned,
 * plus the appended re-run (LAST block wins) and torn-write refusals.
 *
 * Usage: node scripts/t562-selection-receipt-test.mjs
 *        (imports the REAL src/lib/selection-receipt.ts — node 24 runs
 *        the erasable-syntax TS directly; no mirror copy in this file)
 */

import { parseSelectionReceipt } from "../src/lib/selection-receipt.ts";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};

/* ------------------------------------------------------------------ */
/* Fixture 1 — the REAL gamble receipt (EMPIAR t372 world,             */
/* select2d_2qwp7qcy — the t554 inclusive… actually borderline bet,    */
/* 68.3%). Body lines comma-less, result line comma'd. Verbatim.       */
/* ------------------------------------------------------------------ */
const GAMBLE = `CryoFlow engine-native select2d 2026-10-03T23:37:59.575Z
input:  /home/z/my-project/data/relion/cmuro2ufe000mn5nb3qkwuy49/class2d_ewxp1nl8/run_it003_data.star (10866 particles)
mode:   manual 3 classes
class occupancy (count · kept):
  class 5: 4073 · kept
  class 2: 2932 · kept
  class 1: 1935 · PRUNED
  class 4: 1510 · PRUNED
  class 3: 416 · kept
output: /home/z/my-project/data/relion/cmuro2ufe000mn5nb3qkwuy49/select2d_2qwp7qcy/particles_select2d.star (7421 particles)
7,421 of 10,866 particles kept · 3/5 classes (manual 3 classes)
`;

/* Fixture 2 — the REAL auto receipt (β-Gal demo world,               */
/* select2d_mm94x2te): the occupancy rule decided. Verbatim.           */
const AUTO = `CryoFlow engine-native select2d 2026-10-03T02:26:13.477Z
input:  /home/z/my-project/data/relion/cmur3ti510002n5831da9zcuk/class2d_etgj3moi/run_it012_data.star (240 particles)
mode:   auto — occupancy ≥ 0.5× best
class occupancy (count · kept):
  class 1: 96 · kept
  class 2: 72 · kept
  class 3: 24 · PRUNED
  class 4: 12 · PRUNED
  class 5: 12 · PRUNED
  class 6: 9 · PRUNED
  class 7: 9 · PRUNED
  class 8: 6 · PRUNED
output: /home/z/my-project/data/relion/cmur3ti510002n5831da9zcuk/select2d_mm94x2te/particles_select2d.star (168 particles)
168 of 240 particles kept · 2/8 classes (auto — occupancy ≥ 0.5× best)
`;

/* Fixture 3 — engine-spec shape (runSelect2dNative L6021-6043): the
   t402b intermediate ride (source note) + birth selection + an ignored
   class list, all in one block. No on-disk sample yet — the template
   IS the spec. */
const BIRTH = `CryoFlow engine-native select2d 2026-10-04T05:11:02.100Z
source: Class2D 4 — the selection rides the newest settled round, not the finished run
input:  /home/z/my-project/data/relion/demo/class2d_x/run_it007_data.star (5000 particles)
mode:   manual 2 classes (birth selection) (ignored: 9, 12)
class occupancy (count · kept):
  class 3: 3000 · kept
  class 1: 2000 · kept
output: /home/z/my-project/data/relion/demo/select2d_y/particles_select2d.star (5000 particles)
5,000 of 5,000 particles kept · 2/2 classes (manual 2 classes (birth selection) (ignored: 9, 12))
`;

/* Fixture 4 — engine-spec shape (runSelectNative L5741-5755, verbatim
   template): the 1D select family's TWO mutually exclusive shapes.
   t562's first draft mixed them (a mode: first-N line WITH class rows);
   the real engine never writes that — class-aware has NO mode line (the
   result line's occupancy verdict is the only rule evidence), first-N
   has the mode line but no class rows. Both pinned as the engine writes
   them. */
const SELECT_1D_CLASSES = `CryoFlow engine-native select 2026-10-04T05:30:00.000Z
input:  /data/extract/particles.star (1200 particles)
class occupancy (count · kept):
  class 1: 800 · kept
  class 2: 400 · PRUNED
output: /data/select/particles_select.star (800 particles)
800 of 1200 particles selected · kept 1/2 classes (occupancy ≥ 0.5× best)
`;
const SELECT_1D_BARE = `CryoFlow engine-native select 2026-10-04T05:31:00.000Z
input:  /data/extract/particles.star (1200 particles)
mode: first-N (no _rlnClassNumber column or classCutoff=0)
output: /data/select/particles_select.star (500 particles)
500 of 1200 particles selected
`;

/* Fixture 5 — recordNativeRun APPENDS: a re-run leaves two blocks; the
   LAST is the newest run's truth. Compressed: gamble → then a narrower
   re-run of the same job. */
const RERUN = GAMBLE + `CryoFlow engine-native select2d 2026-10-03T23:46:45.947Z
input:  /home/z/my-project/data/relion/cmuro2ufe000mn5nb3qkwuy49/class2d_ewxp1nl8/run_it003_data.star (10866 particles)
mode:   manual 2 classes
class occupancy (count · kept):
  class 5: 4073 · kept
  class 2: 2932 · kept
output: /home/z/my-project/data/relion/cmuro2ufe000mn5nb3qkwuy49/select2d_07cmphsk/particles_select2d.star (7005 particles)
7,005 of 10,866 particles kept · 2/5 classes (manual 2 classes)
`;

console.log("— fixture 1: the real gamble receipt (comma dialects both ways)");
const g = parseSelectionReceipt(GAMBLE);
check("parses", g !== null);
check("verb", g?.verb === "select2d", g?.verb);
check("ranAt ISO kept", g?.ranAt === "2026-10-03T23:37:59.575Z");
check("ranAtMs is a finite epoch", typeof g?.ranAtMs === "number" && Number.isFinite(g?.ranAtMs));
check("THE t554 pin: kept reads 7421, not 421", g?.kept === 7421, `kept=${g?.kept}`);
check("total reads 10866, not 866", g?.total === 10866, `total=${g?.total}`);
check("kept/total = 68.2956…% (「68.3%」的 worklog 收据)", Math.abs((g.kept / g.total) * 100 - 68.2956) < 0.001);
check("input comma-less line reads 10866", g?.inputParticles === 10866);
check("output comma-less line reads 7421", g?.outputParticles === 7421);
check("mode line", g?.mode === "manual 3 classes");
check("modeKind manual", g?.modeKind === "manual");
check("keptClasses 3/5", g?.keptClasses === 3 && g?.totalClasses === 5);
check("five classes parsed", g?.classes.length === 5, `n=${g?.classes.length}`);
check("class 5 kept 4073", g?.classes.some((c) => c.cls === 5 && c.kept && c.count === 4073));
check("class 3 kept 416 (the gamble's maybe that came along)", g?.classes.some((c) => c.cls === 3 && c.kept && c.count === 416));
check("class 1 pruned 1935", g?.classes.some((c) => c.cls === 1 && !c.kept && c.count === 1935));
check("no birth flag", g?.birth === false);
check("no ignored list", g?.ignored.length === 0);
check("no source note", g?.source === null);

console.log("— fixture 2: the real auto receipt (occupancy rule)");
const a = parseSelectionReceipt(AUTO);
check("parses", a !== null);
check("modeKind auto", a?.modeKind === "auto");
check("168 of 240", a?.kept === 168 && a?.total === 240);
check("2/8 classes", a?.keptClasses === 2 && a?.totalClasses === 8);
check("eight classes", a?.classes.length === 8);
check("70.0%", a && Math.abs((a.kept / a.total) * 100 - 70) < 1e-9);

console.log("— fixture 3: birth + ignored + source note (engine spec)");
const b = parseSelectionReceipt(BIRTH);
check("parses", b !== null);
check("source note trimmed before the engine copy", b?.source === "Class2D 4", b?.source);
check("birth flag on", b?.birth === true);
check("ignored [9, 12]", JSON.stringify(b?.ignored) === "[9,12]", JSON.stringify(b?.ignored));
check("modeKind still manual", b?.modeKind === "manual");
check("5000 of 5000 (the birth set covers the input)", b?.kept === 5000 && b?.total === 5000);

console.log("— fixture 4: the 1D select family (two real shapes, selected verb)");
const s1 = parseSelectionReceipt(SELECT_1D_CLASSES);
check("parses", s1 !== null);
check("verb select (no 2d)", s1?.verb === "select");
check("no mode line → mode stays null", s1?.mode === null);
check("t564 pin: result line's occupancy verdict → modeKind auto", s1?.modeKind === "auto", s1?.modeKind);
check("800 of 1200", s1?.kept === 800 && s1?.total === 1200);
check("'kept 1/2 classes' group read", s1?.keptClasses === 1 && s1?.totalClasses === 2);
check("two classes", s1?.classes.length === 2);
const s2 = parseSelectionReceipt(SELECT_1D_BARE);
check("bare result parses", s2 !== null);
check("mode line quoted", s2?.mode === "first-N (no _rlnClassNumber column or classCutoff=0)");
check("first-N kind", s2?.modeKind === "first-n");
check("kept 500 / no class group → nulls", s2?.kept === 500 && s2?.keptClasses === null && s2?.totalClasses === null);
check("no classes rows → empty list", s2?.classes.length === 0);

console.log("— fixture 5: the appended re-run (LAST block wins)");
const r = parseSelectionReceipt(RERUN);
check("parses", r !== null);
check("newest ranAt (23:46:45)", r?.ranAt === "2026-10-03T23:46:45.947Z");
check("newest result: 7,005 of 10,866", r?.kept === 7005 && r?.total === 10866);
check("newest mode: manual 2", r?.mode === "manual 2 classes");
check("newest classes: 2 rows, both kept", r?.classes.length === 2 && r.classes.every((c) => c.kept));

console.log("— refusals: torn writes, empty logs, foreign logs");
check("empty string → null", parseSelectionReceipt("") === null);
check("foreign log → null", parseSelectionReceipt("relion_refine: some stack trace\nmore noise\n") === null);
check("header without result line → null (torn write)",
  parseSelectionReceipt("CryoFlow engine-native select2d 2026-10-03T23:37:59.575Z\ninput:  /x (10 particles)\n") === null,
);
check("footer-only block after torn header still parses (last COMPLETE wins)",
  (() => {
    const text = `CryoFlow engine-native select2d 2026-10-03T23:37:59.575Z\ninput:  /x (10 particles)\nnoise\n` + GAMBLE;
    const p = parseSelectionReceipt(text);
    return p !== null && p.kept === 7421;
  })(),
);
check("garbage timestamp → ranAt null, receipt still stands",
  (() => {
    const text = GAMBLE.replace("2026-10-03T23:37:59.575Z", "yesterday-ish");
    const p = parseSelectionReceipt(text);
    return p !== null && p.ranAt === null && p.ranAtMs === null && p.kept === 7421;
  })(),
);

console.log("— the t554 bug class, one more angle: comma'd BODY lines must also read");
check("comma'd body line (future engine dialect) reads 4,073 → 4073",
  (() => {
    const text = GAMBLE.replace("class 5: 4073 · kept", "class 5: 4,073 · kept");
    const p = parseSelectionReceipt(text);
    return p?.classes.find((c) => c.cls === 5)?.count === 4073;
  })(),
);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

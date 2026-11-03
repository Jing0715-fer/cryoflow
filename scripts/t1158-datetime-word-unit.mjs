/**
 * t1158 — the DATE-TIME WORD's census seat (the NEW map's seventh
 * vein: the separate census the t1157 thousands-father promised).
 *
 * The t1157 shape-hunt spared every `new Date(...)` face BY DESIGN —
 * the date-time word rides the browser's locale on purpose. This
 * window looked, judged, and drew the boundary in ink:
 *
 *   A — the fathers run FOR REAL: the compact chip stamp (month short
 *       + day + hour:minute) and the row stamp (chip + year) speak
 *       the caller's instant in the HOST's dialect — the unit pins
 *       the FIELDS (a month word, the day digits, the time), never
 *       their order, because the locale ride IS the design; the three
 *       input dialects (Date | epoch-ms | ISO) speak byte-identical
 *       words; the junk contract is null (never "Invalid Date"
 *       wearing a sentence) so the call sites' absence words hold;
 *   B — the source law: the two byte-twins died (ai-verdict-stamp and
 *       selection-receipt rode copy-paste option objects — the t1152
 *       lesson: twins are how a family drifts); the import dialog's
 *       row face rides the year-bearing sibling and keeps its own
 *       "unknown date"; the fathers' ONE helper passes `undefined`
 *       as the locale — the ride is DELIBERATE, documented at the
 *       birthplace; the census block names the family (forensic /
 *       chip / row / machine / banned / explicit-default); the
 *       t1157 pointer kept its word; the machine word's ISO faces
 *       and the forensic bare faces stand untouched; the fathers
 *       carry no clock (the wall belongs to the caller — t1153);
 *   C — the doctrine: a stamp is a SPOKEN word, never a parsed one
 *       (the locale ride is the honesty); the year boundary is a
 *       FACE claim (a shelf entry can be a year old — a chip may
 *       drop it, a row may not); the lineage names the father it
 *       grew from.
 */
import { readFileSync } from "node:fs";
import { fmtStampChip, fmtStampRow } from "@/lib/duration";

let pass = 0;
let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const srcOf = (p) => readFileSync(p, "utf8");

/* ---------- A — the fathers run FOR REAL ---------- */
console.log("A — the fathers run FOR REAL (fields pinned, order free)");

const at = new Date("2026-11-03T01:20:00Z");
const chip = fmtStampChip(at);
const row = fmtStampRow(at);

ok("A1 the chip speaks the instant's fields — a month word, the day, the time",
  typeof chip === "string" &&
    /[A-Za-z]/.test(chip) &&
    /\b3\b/.test(chip) &&
    /01:20/.test(chip),
  `got "${chip}"`);
ok("A2 the row's year face — the year rides the row, never the chip",
  typeof row === "string" &&
    row.includes("2026") &&
    typeof chip === "string" &&
    !chip.includes("2026"),
  `got "${row}"`);
ok("A3 the chip and row speak the SAME clock digits (one instant, two faces)",
  typeof chip === "string" &&
    typeof row === "string" &&
    /01:20/.test(row),
  `row got "${row}"`);
ok("A4 the input dialects — Date | epoch-ms | ISO speak byte-identical words",
  chip === fmtStampChip(at.getTime()) &&
    chip === fmtStampChip(at.toISOString()),
  "one dialect, three shapes");
ok("A5 the determinism — the same instant, twice, one word",
  chip === fmtStampChip(new Date("2026-11-03T01:20:00Z")) &&
    row === fmtStampRow(new Date("2026-11-03T01:20:00Z")));
ok("A6 the junk contract — garbage/NaN/empty/invalid are null, never a sentence",
  fmtStampChip("garbage") === null &&
    fmtStampChip(Number.NaN) === null &&
    fmtStampRow("") === null &&
    fmtStampChip(new Date("nope")) === null);
ok("A7 the absence is NULL — the call sites' ?? word depends on it (never \"\")",
  fmtStampChip("") === null && fmtStampRow("not a date") === null);
ok("A8 the fathers differ by EXACTLY the year field (the face boundary in ink)",
  (() => {
    const s = srcOf("src/lib/duration.ts");
    const chipFn = s.slice(s.indexOf("fmtStampChip"), s.indexOf("fmtStampRow"));
    const rowFn = s.slice(s.indexOf("fmtStampRow"), s.indexOf("function fmtStampWith"));
    return !chipFn.includes('year: "numeric"') && rowFn.includes('year: "numeric"');
  })());

/* ---------- B — the source law ---------- */
console.log("B — the source law: the twins dead, the family named");

const stampSrc = srcOf("src/components/workflow/results/ai-verdict-stamp.tsx");
const receiptSrc = srcOf("src/components/workflow/results/selection-receipt.tsx");
const importSrc = srcOf("src/components/workflow/import-workflow-dialog.tsx");
const fatherSrc = srcOf("src/lib/duration.ts");
const countsSrc = srcOf("src/lib/result-counts.ts");

ok("B1 the chip twins are dead — no locale call survives in either chip face",
  !stampSrc.includes(".toLocaleString(") && !receiptSrc.includes(".toLocaleString("),
  "ai-verdict-stamp + selection-receipt");
ok("B2 both chip faces import the father",
  stampSrc.includes('import { fmtStampChip } from "@/lib/duration"') &&
    receiptSrc.includes('import { fmtStampChip } from "@/lib/duration"'));
ok("B3 the row face rides the year-bearing sibling and keeps its absence word",
  importSrc.includes('import { fmtStampRow } from "@/lib/duration"') &&
    !importSrc.includes(".toLocaleString(") &&
    importSrc.includes('"unknown date"'));
ok("B4 ONE helper, ONE call — the fathers' locale birth is single",
  (fatherSrc.match(/\.toLocaleString\(/g) || []).length === 1);
ok("B5 the ride is DELIBERATE — the helper passes undefined, the comment says so",
  fatherSrc.includes("toLocaleString(undefined, opts)") &&
    fatherSrc.includes("the browser's locale"));
ok("B6 the census block names the family — six dialects in ink",
  fatherSrc.includes("the FORENSIC full stamp") &&
    fatherSrc.includes("the COMPACT chip stamp") &&
    fatherSrc.includes("the ROW stamp") &&
    fatherSrc.includes("the MACHINE word") &&
    fatherSrc.includes("the BANNED face") &&
    fatherSrc.includes("the EXPLICIT default"));
ok("B7 the spoken-never-parsed judgment lives at the birthplace",
  fatherSrc.includes("SPOKEN word, never a parsed one"));
ok("B8 the t1157 pointer kept its word — the promised census is answered",
  countsSrc.includes("the separate census RAN, the design HELD") &&
    countsSrc.includes("DIFFERENT word"));
ok("B9 the machine word's faces stand — the ISO-UTC footer untouched",
  srcOf("src/components/workflow/results/results-view.tsx").includes(
    "Generated by CryoFlow on",
  ));
ok("B10 the forensic faces stand — the stale tooltip keeps its bare full stamp",
  srcOf("src/components/workflow/job-card.tsx").includes(
    "Upstream run started ${new Date(",
  ));
ok("B11 the explicit default stands — the calendar's month label rides BY HAND",
  srcOf("src/components/ui/calendar.tsx").includes('toLocaleString("default"'));
ok("B12 the fathers carry no clock — the wall belongs to the caller (t1153's law)",
  (() => {
    const s = fatherSrc.slice(fatherSrc.indexOf("function fmtStampWith"));
    return !s.includes("Date.now()");
  })());

/* ---------- C — the doctrine ---------- */
console.log("C — the doctrine");

ok("C1 the twins judgment — the drift shape named at the father",
  fatherSrc.includes("copy-paste twins are how a family drifts"));
ok("C2 the year boundary is a FACE claim — why the row may not drop it",
  fatherSrc.includes("a shelf entry can be a year old"));
ok("C3 the lineage — the census names the father it grew from (t1157's promise)",
  fatherSrc.includes("thousands-father paragraph promised"));

console.log(`\nDATETIME-WORD-UNIT t1158: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

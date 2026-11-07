#!/usr/bin/env node
/**
 * t1153 — THE DURATION-WORD unit: one birthplace for the app's duration /
 * ago word, the census father's seat (lib/duration.ts, the NEW map's
 * second vein).
 *
 * The t1153 window swept the duration/clock/ago words the way t1152
 * swept the byte word — and found the word-class boundary where t1152
 * found drift: the second birth (`fmtDur`, the QC report's local
 * builder in results-view.tsx) had NO day face, so a 3-day run printed
 * "72h 5m" in the report while the inspector said "3d 0h" for the same
 * run. It died and rides the father. Everything else outside the father
 * is a DIFFERENT claim with its own doctrine comment (the FACT face,
 * the PREDICTION pair, the LEDGER face, the AXIS face, the GRAVE face,
 * the SIM face, the freshness chip, SLURM's own grammar, the t123
 * oracle instrument, the engine's voice) — enumerated in the father's
 * own header, kept.
 *
 * The same sweep caught the byte word's EIGHTH birth hiding under its
 * own name (formatStagedBytes — the t1152 map was a name-hunt and
 * walked past it): the map's lesson is the SHAPE-HUNT law — births hide
 * under different names, hunt by the arithmetic. That cure is pinned in
 * the t1152 seat (B14-B16), not here; this seat owns the duration word.
 *
 * A — the father run FOR REAL: every band (s / m+0s / m s / h m / the
 *     48h day edge), the round-before-banding edge, the junk face, the
 *     ago bands (just-now / the m s ago), the numeric-ISO dialect
 *     (t714), the clock's shape, SLURM's own grammar (slurmHms: the
 *     floor-1 law, the padded fields), the determinism.
 * B — the source law: the QC report's fmtDur rides the father (the
 *     local h/m arithmetic gone), slurm's private hms twin dead (the
 *     --time leg rides the exported father), the census enumerates the
 *     documented dialects and dates the cure, elapsed.ts's fact face
 *     lives untouched, the t123 oracle keeps its independent copy (an
 *     instrument, not a face).
 * C — the doctrine: the word-class boundary law verbatim at the father,
 *     the shape-hunt law at the byte father (the map's lesson, cross-
 *     word), the father stays pure (no clock in fmtDuration — fmtAgo is
 *     the only clock reader).
 *
 * node scripts/unit-runner.mjs scripts/t1153-duration-word-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fmtDuration, fmtAgo, fmtClock } from "@/lib/duration";
import { slurmHms } from "@/lib/hpc/slurm";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const fatherSrc = read("src/lib/duration.ts");
const resultsSrc = read("src/components/workflow/results/results-view.tsx");
const slurmSrc = read("src/lib/hpc/slurm.ts");
const elapsedSrc = read("src/lib/elapsed.ts");
const probeSrc = read("scripts/t123-e2e.mjs");

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- A — the father run FOR REAL ---------- */
console.log("A — the father run FOR REAL");

ok("A1 the junk face — NaN / 0 / negative / Infinity all speak the absence word",
  fmtDuration(NaN) === "—" && fmtDuration(0) === "—" &&
    fmtDuration(-5) === "—" && fmtDuration(Infinity) === "—",
  `got ${fmtDuration(NaN)} / ${fmtDuration(0)} / ${fmtDuration(-5)} / ${fmtDuration(Infinity)}`);
ok("A2 the seconds band — the integer and the unit, no decimals",
  fmtDuration(8000) === "8s" && fmtDuration(59000) === "59s",
  `got ${fmtDuration(8000)} / ${fmtDuration(59000)}`);
ok("A3 the minute band — the zero-second face is data, never trimmed",
  fmtDuration(60000) === "1m 0s" && fmtDuration(480000) === "8m 0s",
  `got ${fmtDuration(60000)} / ${fmtDuration(480000)}`);
ok("A4 the Task-123 word — 2m 41s is the label the inspector taught the timeline",
  fmtDuration(161000) === "2m 41s",
  `got ${fmtDuration(161000)}`);
ok("A5 the hour band — 3h 12m, minutes past the hour",
  fmtDuration(11520000) === "3h 12m",
  `got ${fmtDuration(11520000)}`);
ok("A6 the day edge is 48h — 47h 59m stays hours, 48h becomes 2d 0h",
  fmtDuration(172740000) === "47h 59m" && fmtDuration(172800000) === "2d 0h",
  `got ${fmtDuration(172740000)} / ${fmtDuration(172800000)}`);
ok("A7 the 5d 4h word — days and the hour remainder",
  fmtDuration(446400000) === "5d 4h",
  `got ${fmtDuration(446400000)}`);
ok("A8 the round-before-banding edge — 59.5s rounds into the minute band",
  fmtDuration(59500) === "1m 0s",
  `got ${fmtDuration(59500)}`);
ok("A9 the ago bands — just now inside a minute, then the father's word + ago",
  fmtAgo(Date.now() - 30_000) === "just now" &&
    fmtAgo(Date.now() - 161_000) === "2m 41s ago",
  `got ${fmtAgo(Date.now() - 30_000)} / ${fmtAgo(Date.now() - 161_000)}`);
ok("A10 the t714 dialect — an epoch-ms number and its ISO twin speak the same word",
  fmtAgo(new Date(Date.now() - 161_000).toISOString()) === fmtAgo(Date.now() - 161_000));
ok("A11 the clock keeps its shape — the wall's own locale speaks (24h or AM/PM)",
  /^\d{1,2}:\d{2}:\d{2}( ?[AP]M)?$/.test(fmtClock("2026-11-02T06:33:05Z")),
  `got ${fmtClock("2026-11-02T06:33:05Z")}`);
ok("A12 slurm's own grammar — the floor-1 law (0 minutes still asks for one)",
  slurmHms(0) === "00:01:00",
  `got ${slurmHms(0)}`);
ok("A13 slurm's padded fields — [[DD-]HH:]MM:SS, the directive's own width",
  slurmHms(90) === "01:30:00" && slurmHms(600) === "10:00:00",
  `got ${slurmHms(90)} / ${slurmHms(600)}`);
ok("A14 the determinism — the same ms, twice, one word",
  fmtDuration(446400000) === fmtDuration(446400000) &&
    slurmHms(90) === slurmHms(90));

/* ---------- B — the source law ---------- */
console.log("B — the source law: one birthplace, the dialects enumerated");

ok("B1 the QC report's fmtDur rides the father (the t1153 cure's exact shape)",
  /const fmtDur = \(s: number\) => fmtDuration\(s \* 1000\);/.test(resultsSrc),
  "the report's rows carry seconds; the father speaks ms");
ok("B2 the local h/m arithmetic is gone from the report builder",
  !/Math\.floor\(s \/ 3600\)|Math\.round\(\(s % 3600\) \/ 60\)/.test(resultsSrc),
  "the day face now arrives — a 3-day run never prints 72h 5m again");
ok("B3 results-view imports the duration father",
  resultsSrc.includes('import { fmtDuration } from "@/lib/duration"'));
ok("B4 slurm's private hms twin is dead",
  !/function hms\(/.test(slurmSrc),
  "ONE birthplace, even inside one file");
ok("B5 the script builder's --time leg rides the exported father",
  slurmSrc.includes("slurmHms(profile.timeLimitMin)"));
ok("B6 slurmHms is still exported (the remote dispatch's import lives)",
  /export function slurmHms\(/.test(slurmSrc));
ok("B7 the father's census enumerates the documented dialects",
  fatherSrc.includes("the FACT face") &&
    fatherSrc.includes("PREDICTION pair") &&
    fatherSrc.includes("LEDGER face") &&
    fatherSrc.includes("AXIS") &&
    fatherSrc.includes("GRAVE face") &&
    fatherSrc.includes("SIM face") &&
    fatherSrc.includes("freshness chip") &&
    fatherSrc.includes("SLURM's own") &&
    fatherSrc.includes("INSTRUMENT, not a face") &&
    fatherSrc.includes("ENGINE's voice"));
ok("B8 the cure is dated in the census",
  fatherSrc.includes("2026-11-02 (t1153)") &&
    fatherSrc.includes("72h 5m"));
ok("B9 the fact face lives untouched — elapsed.ts's doctrine header still names its pair",
  elapsedSrc.includes("formatElapsed") &&
    elapsedSrc.includes("formatEta") &&
    elapsedSrc.includes("elapsed is a FACT"));
ok("B10 the t123 oracle keeps its independent copy — an instrument, not a face",
  /const fmtDur = \(ms\) => \{/.test(probeSrc) &&
    !probeSrc.split("\n").some((l) => /^import\b/.test(l.trim()) && l.includes("lib/duration")),
  "an oracle that imports the father cannot catch the father's bugs — the probe may NAME the father (its Phase F checks the single-source contract, quoted literals included) but never IMPORTS it");

/* ---------- C — the doctrine ---------- */
console.log("C — the doctrine");

ok("C1 the word-class boundary law, verbatim at the father",
  fatherSrc.includes("not drift but the word-class boundary") &&
    fatherSrc.includes("each a DIFFERENT claim with its own doctrine comment"));
ok("C2 the shape-hunt law at the byte father (the map's lesson, cross-word)",
  read("src/lib/relion/disk-usage.ts").includes("hunt by the") &&
    read("src/lib/relion/disk-usage.ts").includes("the EIGHTH birth"));
ok("C3 the father stays pure — fmtDuration has no clock (fmtAgo is the only clock reader)",
  /export function fmtDuration\(ms: number\): string \{\n  if \(!Number\.isFinite\(ms\) \|\| ms <= 0\) return "—";/.test(fatherSrc) &&
    (fatherSrc.match(/Date\.now\(\)/g) || []).length === 1,
  "the ages ride the caller's now; the banding arithmetic never reads the wall");

console.log(`\nDURATION-WORD-UNIT t1153: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

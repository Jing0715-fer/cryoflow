#!/usr/bin/env node
/**
 * t882 — the census seat re-key (the text-surgery law: a formal script,
 * never an inline regex injection). One key turns over this window:
 *
 *   Seat 114 — t879-pressure-words-unit: 48 → 79 pins. The war's DEEPER
 *   rows joined (the t881 window's own witnessed numbers ride the
 *   fixtures): A10-A14 (the rope's holders tally — every "X invoked
 *   oom-killer" line, the stewards never tally, the main fixture's rope,
 *   no trend where there is none), B9-B13 (the locator line's holders
 *   clause, the leak signature quoting the whale's curve 2770→2845→2951MB
 *   verbatim, the thread dialect riding the combatants clause, the single
 *   rope-holder ×3 speaking, the ×1 echo staying silent), I1-I5
 *   (oomInvokersWord's faces), L1-L6 (oomLeakWord's faces — the rising
 *   window, the dip that is weather, the flat face, the short history),
 *   T1-T5 (the thread-dialect law: isThreadComm, the combatants word's
 *   "(thread)" marker) and H6-H10 (the source laws — the mirror's
 *   invokers/trend, the dialog's diag-invokers/diag-trend/diag-thread-note
 *   rows via the ONE father, the header's law, the bench's pins, the law
 *   living in ONE client-safe birthplace). Bench 63→67.
 *
 * Two edits, each a counted anchor:
 *   1. EXPECTED — seat 114's `48` becomes `79` (positional).
 *   2. the roster's birth-marker comment (the story line).
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. EXPECTED — seat 114's 48 becomes 79.
{
  const m = out.match(/EXPECTED=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: EXPECTED not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 115 && vals[113] === "48") {
    vals[113] = "79";
    out = out.replace(m[0], `EXPECTED=(${vals.join(" ")})`);
    edits.push("EXPECTED 48→79");
  } else if (vals.length === 115 && vals[113] === "79") {
    // already re-keyed — idempotent pass
  } else {
    console.error(
      `rekey: EXPECTED length ${vals.length}/val[113]=${vals[113]} is not a known shape`,
    );
    process.exit(1);
  }
}

// 2. the birth-marker comment — the roster's own story names the cure.
if (out.includes("t881 cured the fixture's dialect") && !out.includes("t882 grew the war's deeper rows")) {
  const lines = out.split("\n");
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("declare -a NAMES=")) {
      idx = i;
      break;
    }
  }
  let story = idx - 1;
  while (story >= 0 && lines[story].startsWith("#")) story--;
  lines.splice(story + 1, 0,
    "# t882 grew the war's deeper rows: seat 114 rode 48→79 (the invokers histogram — who HOLDS the rope most, the stewards filtered, A10/A12/A14; the leak signature — the whale's last three deaths strictly rising, the machine's own curve 2770→2845→2951MB quoted verbatim, A11/L1-L6; the thread-dialect law — MainThread is chromium's main-thread title, never our lane, the combatants word marks it (thread), T1-T5; the locator line's holders clause behind the information rule, B9-B13; I1-I5 oomInvokersWord's faces; H6-H10 the source laws — the mirror's invokers/trend, the dialog's diag-invokers/diag-trend/diag-thread-note rows, the ONE client-safe birthplace) — the tempo says how fast, the combatants say WHO dies, the holders say who HOLDS the rope, the curve says whether the whale LEAKS",
  );
  out = lines.join("\n");
  edits.push("STORY");
}

if (edits.length === 0) {
  console.log("rekey: nothing to do — the census already rides t882's keys (79/79 on seat 114)");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey applied: ${edits.join(", ")} — seat 114 rides 79`);

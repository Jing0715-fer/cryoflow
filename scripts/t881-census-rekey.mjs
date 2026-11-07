#!/usr/bin/env node
/**
 * t881 — the census seat re-key (the text-surgery law: a formal script,
 * never an inline regex injection). One key turns over this window:
 *
 *   Seat 114 — t879-pressure-words-unit: 34 → 48 pins. The fixture-truth
 *   cure (the victim comm wears the kernel's 15-char dialect, "next-server
 *   (v1" — the eaten paren verbatim, A2 re-aimed) and the combatants
 *   histogram joined: A8 (the fixture's own histogram, recency tiebreak),
 *   A9 (the regular's tally — three deaths aggregate to one combatant),
 *   B7 (the locator line's combatants clause), B8 (the information rule —
 *   a single ×1 victim stays silent), G1-G5 (oomCombatantsWord's faces —
 *   the cap-3 tail, the exact-three face, the honest nulls, the single
 *   combatant, the garbage filter) and H1-H5 (the source laws — the
 *   client-safe father with BOTH words, the client mirror's victims, the
 *   dialog's diag-combatants row via the ONE father, the bench's pin, the
 *   header's law). The live ring itself answered the cure mid-window:
 *   "74 kills, last victim next-server (v1 at 2705MB".
 *
 * Three edits, each a counted anchor:
 *   1. EXPECTED — seat 114's `34` becomes `48` (positional).
 *   2. the roster's birth-marker comment (the story line).
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. EXPECTED — seat 114's 34 becomes 48.
{
  const m = out.match(/EXPECTED=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: EXPECTED not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 115 && vals[113] === "34") {
    vals[113] = "48";
    out = out.replace(m[0], `EXPECTED=(${vals.join(" ")})`);
    edits.push("EXPECTED 34→48");
  } else if (vals.length === 115 && vals[113] === "48") {
    // already re-keyed — idempotent pass
  } else {
    console.error(
      `rekey: EXPECTED length ${vals.length}/val[113]=${vals[113]} is not a known shape`,
    );
    process.exit(1);
  }
}

// 2. the birth-marker comment — the roster's own story names the cure.
if (out.includes("t880 added the mid-cohort audit unit") && !out.includes("t881 cured the fixture's dialect")) {
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
    "# t881 cured the fixture's dialect and grew the war's histogram: seat 114 rode 34→48 (the victim comm wears the kernel's 15-char truncation — next-server (v1, the eaten paren verbatim, the shape the t880 live ride witnessed) and the combatants face joined (A8/A9 the parser's histogram with the recency tiebreak, B7/B8 the locator's clause with the information rule, G1-G5 oomCombatantsWord's faces, H1-H5 the source laws: the client-safe father with BOTH words, the mirror's victims, the dialog's diag-combatants row, the bench's pin, the header's law) — the tempo said how fast, the combatants say WHO",
  );
  out = lines.join("\n");
  edits.push("STORY");
}

if (edits.length === 0) {
  console.log("rekey: nothing to do — the census already rides t881's keys (48/48 on seat 114)");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey applied: ${edits.join(", ")} — seat 114 rides 48`);

#!/usr/bin/env node
/**
 * t883 — the census seat re-key (the text-surgery law: a formal script,
 * never an inline regex injection). Two keys turn over this window:
 *
 *   Seat 114 — t879-pressure-words-unit: 79 → 92 pins. The war's PAIRINGS
 *   face joined (whose hand tripped WHOSE death): P1 (the parser's pairing
 *   tally on MULTIKILL — chrome's hand → the whale ×3, python3 ×1, the
 *   pair sum equals the kills), P2 (the main fixture's recency tiebreak —
 *   the whale's death rides first), P3 (the stewards' kills never pair),
 *   P4 (the pairing sum ≤ the kills — a steward's rope TERMINATES the
 *   search: that kill is the kernel's own housekeeping, never an older
 *   rope's crime), P5-P8 (oomPairingsWord's faces — the cap-3 tail, the
 *   exact-three face, the honest nulls, the garbage filter), P9 (the
 *   locator line's pairings clause on the war payload), P10 (the ×1 echo
 *   staying silent), P11-P13 (the source laws — the mirror's shape, the
 *   dialog's diag-pairings row via the ONE father, the header's law).
 *   Bench 67→69.
 *
 *   +Seat 116 — t883-harness-cure-unit (11 pins): the census's live-leg
 *   learns the honest AMBER verdict (the t1021 judgment's cure): W1-W6
 *   the source laws (the precondition, the ONE-shot reboot, the AMBER
 *   line, the external-lane no-raise clause, the guarded loop, the
 *   parameterized CENSUS_LANE_URL), W9 the judgment documented, and the
 *   FUNCTIONAL faces — W7 the AMBER path answers on a DEAD lane, W8 the
 *   healthy path rides a REAL listener, W10 a dead lane the census owns
 *   attempts the one reboot. The harness cure is TESTED, not just pinned.
 *
 * Four edits, each a counted anchor:
 *   1. EXPECTED — seat 114's `79` becomes `92` (positional).
 *   2. EXPECTED — append the 116th seat's `11` (115 → 116 entries).
 *   3. NAMES + RUNNERS — append the 116th seat (bare node: node: builtins
 *      + child_process only — no @/lib alias needed).
 *   4. the roster's birth-marker comment (the story line).
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1+2. EXPECTED — seat 114's 79 becomes 92, and the 116th seat's 11 appends.
{
  const m = out.match(/EXPECTED=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: EXPECTED not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 115 && vals[113] === "79") {
    vals[113] = "92";
    vals.push("11");
    out = out.replace(m[0], `EXPECTED=(${vals.join(" ")})`);
    edits.push("EXPECTED 79→92 +seat116 11");
  } else if (vals.length === 116 && vals[113] === "92" && vals[115] === "11") {
    // already re-keyed — idempotent pass
  } else {
    console.error(
      `rekey: EXPECTED length ${vals.length}/val[113]=${vals[113]}/val[115]=${vals[115]} is not a known shape`,
    );
    process.exit(1);
  }
}

// 3. NAMES — append the 116th seat before the array's closing paren.
{
  const anchor = `  "t880-mid-cohort-audit-unit"\n)`;
  const cured = `  "t880-mid-cohort-audit-unit"\n  "t883-harness-cure-unit"\n)`;
  if (out.includes(anchor)) {
    out = out.replace(anchor, cured);
    edits.push("NAMES +t883-harness-cure-unit");
  } else if (out.includes(cured)) {
    // idempotent pass
  } else {
    console.error("rekey: NAMES tail not found in a known shape");
    process.exit(1);
  }
}

// 3b. RUNNERS — append the 116th seat's runner digit (0 = bare node).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: RUNNERS not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 115 && vals[114] === "0") {
    vals.push("0");
    out = out.replace(m[0], `declare -a RUNNERS=(${vals.join(" ")})`);
    edits.push("RUNNERS +0 (bare node)");
  } else if (vals.length === 116 && vals[114] === "0" && vals[115] === "0") {
    // idempotent pass
  } else {
    console.error(`rekey: RUNNERS length ${vals.length}/val[115]=${vals[115]} is not a known shape`);
    process.exit(1);
  }
}

// 4. the birth-marker comment — the roster's own story names the cure.
if (out.includes("t882 grew the war's deeper rows") && !out.includes("t883 paired the rope's crimes")) {
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
    "# t883 paired the rope's crimes and taught the harness the honest AMBER: seat 114 rode 79→92 (the (invoker → victim) pairings — whose hand tripped WHOSE death, the nearest rope full stop, a steward's rope TERMINATES the search — P1-P13: the tally with the recency tiebreak, the stewards' kills never pair, the sum ≤ the kills, oomPairingsWord's faces, the locator line's pairings clause, the dialog's diag-pairings row, the ONE birthplace) and seat 116 BORN 11/11 (t883-harness-cure-unit — the t1021 judgment's cure landed: the live-leg's lane-health precondition + the ONE-shot reboot for a lane the census owns + the AMBER verdict that finally BELIEVES a seat's three windows of 19/19-alone, driven FUNCTIONALLY against a dead port and a real listener) — the census's wounds wear the harness's own line now, not a seat's grade",
  );
  out = lines.join("\n");
  edits.push("STORY");
}

if (edits.length === 0) {
  console.log("rekey: nothing to do — the census already rides t883's keys (92/92 on seat 114, seat 116 born)");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey applied: ${edits.join(", ")}`);

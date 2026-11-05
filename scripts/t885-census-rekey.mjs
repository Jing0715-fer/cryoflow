#!/usr/bin/env node
/**
 * t885 — the census seat re-key (the text-surgery law: a formal script,
 * never an inline regex injection). One key turns over this window:
 *
 *   Seat 114 — t879-pressure-words-unit: 115 → 127 pins. The war's
 *   ROPE-SIDE cross-boot face joined (the cadence word — who DROVE the
 *   war, boot over boot; the ledger's rows grew the boot's rope leader):
 *   CD1-CD8 (oomCadenceWord's faces — the honest nulls, the lone-invocation
 *   rest, the quiet share with the ring's own denominator, the no-denominator
 *   rest, the weather face, the loud engine verdict, the partial fraction,
 *   the two-mouths predicate), BLR1-BLR4 (the ledger's rope fields — the
 *   rope moves in place with the birth held, a ropeless observation never
 *   wipes a named one, the fact's ledBoots counts non-consecutive boots
 *   across whales, the pre-t885 rows' honest zeros). C11 re-aimed (the
 *   mirror grew the cadence fields). F2 re-aimed (the re-export line grew
 *   the two words). Bench 73→75 (the cadence clause's weather face on the
 *   war payload + the loud engine verdict on the labeled-synthetic face).
 *
 * One edit, a counted anchor:
 *   1. EXPECTED — seat 114's `115` becomes `127` (positional).
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. EXPECTED — seat 114's 115 becomes 127.
{
  const m = out.match(/EXPECTED=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: EXPECTED not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 116 && vals[113] === "115") {
    vals[113] = "127";
    out = out.replace(m[0], `EXPECTED=(${vals.join(" ")})`);
    edits.push("EXPECTED 115→127");
  } else if (vals.length === 116 && vals[113] === "127") {
    // already re-keyed — idempotent pass
  } else {
    console.error(`rekey: EXPECTED shape unexpected (len=${vals.length}, vals[113]=${vals[113]}) — no edit`);
    process.exit(1);
  }
}

if (edits.length > 0) {
  writeFileSync(CENSUS, out);
  console.log(`rekey: ${edits.join(" · ")}`);
} else {
  console.log("rekey: already re-keyed — idempotent pass");
}

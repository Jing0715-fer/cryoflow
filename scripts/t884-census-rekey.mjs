#!/usr/bin/env node
/**
 * t884 — the census seat re-key (the text-surgery law: a formal script,
 * never an inline regex injection). One key turns over this window:
 *
 *   Seat 114 — t879-pressure-words-unit: 92 → 115 pins. The war's
 *   CROSS-BOOT face joined (the whale's growth ACROSS boots — the ring is a
 *   per-boot buffer and forgets on reboot, the boot ledger remembers):
 *   PT1-PT2 (the thread-dialect law rides the pairing's VICTIM side — the
 *   crossfire marker), W1-W6 (oomBootLedgerWord's faces — the honest nulls,
 *   the one-boot rest, the quiet fact, the loud verdict, the tail window,
 *   the weather silence), BL1-BL6 (the composers — the birth, the in-place
 *   update with the never-rewritten firstSeenAt, the append, the 8-boot
 *   cap, the whale-run filter, the honest nulls), C10-C18 (the source laws
 *   — the type's field, the mirror, the dialog row via the ONE father, the
 *   bench's clause, the header's ledger law, the kernel's boot id, the
 *   ledger's .next-proof home, the .gitignore line, the atomic write).
 *   F2 re-aimed (the re-export line grew the two words). Bench 69→73.
 *
 * One edit, a counted anchor:
 *   1. EXPECTED — seat 114's `92` becomes `115` (positional).
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. EXPECTED — seat 114's 92 becomes 115.
{
  const m = out.match(/EXPECTED=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: EXPECTED not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 116 && vals[113] === "92") {
    vals[113] = "115";
    out = out.replace(m[0], `EXPECTED=(${vals.join(" ")})`);
    edits.push("EXPECTED 92→115");
  } else if (vals.length === 116 && vals[113] === "115") {
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

#!/usr/bin/env node
/**
 * t880 — the census seat re-key (the text-surgery law: a formal script,
 * never an inline regex injection). Two keys turn over this window:
 *
 *   Seat 114 — t879-pressure-words-unit: 23 → 34 pins. The tempo face
 *   joined: E1-E6 (oomTempoWord's faces — the violence word, the
 *   fresh-boot word, weather's decimal, the integer precision, the
 *   honest nulls) and F1-F5 (the client-safe birthplace law — the
 *   father lives in src/lib/pressure-words.ts with zero node imports,
 *   the lib re-exports ONE birthplace, the mirror carries the clock,
 *   the dialog speaks the tempo with its danger tone, the bench pins
 *   the locator line).
 *
 *   Seat 115 — t880-mid-cohort-audit-unit: 17 pins, born. The between-
 *   generation tier (5 doors, 2026-10-15 → 2026-11-02, 562 lines)
 *   walked line by line and came back CLEAN: the receipt became the
 *   fence (guards ×5, the ordering law ×5, the byte-bound-before-parse,
 *   the verbatim envelope, the one sanitize father, the derived twin
 *   address, the FS-free pace face, the opt-in live probe).
 *
 * Four edits, each a counted anchor:
 *   1. NAMES  — the seat joins the roster (after seat 114).
 *   2. RUNNERS — `0` joins the tail (bare node: the unit imports
 *      node:fs only — no @/lib alias needed).
 *   3. EXPECTED — `34` replaces seat 114's `23` (positional), `17` appended.
 *   4. the roster's birth-marker comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. NAMES — the seat joins after seat 114, before the closing paren.
if (!out.includes('"t880-mid-cohort-audit-unit"')) {
  const anchor = '  "t879-pressure-words-unit"\n)';
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES anchor (seat 114's entry) not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    '  "t879-pressure-words-unit"\n  "t880-mid-cohort-audit-unit"\n)',
  );
  edits.push("NAMES");
}

// 2. RUNNERS — `0` joins the tail (seat 115 rides bare node).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: RUNNERS not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 114) {
    vals.push("0");
    out = out.replace(m[0], `declare -a RUNNERS=(${vals.join(" ")})`);
    edits.push("RUNNERS");
  } else if (vals.length === 115 && vals[114] === "0") {
    // already re-keyed — idempotent pass
  } else {
    console.error(`rekey: RUNNERS length ${vals.length} is not a known shape`);
    process.exit(1);
  }
}

// 3. EXPECTED — seat 114's 23 becomes 34; `17` joins the tail.
{
  const m = out.match(/EXPECTED=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: EXPECTED not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 114 && vals[113] === "23") {
    vals[113] = "34";
    vals.push("17");
    out = out.replace(m[0], `EXPECTED=(${vals.join(" ")})`);
    edits.push("EXPECTED");
  } else if (vals.length === 115 && vals[113] === "34" && vals[114] === "17") {
    // already re-keyed — idempotent pass
  } else {
    console.error(
      `rekey: EXPECTED length ${vals.length}/val[113]=${vals[113]} is not a known shape`,
    );
    process.exit(1);
  }
}

// 4. the birth-marker comment — the roster's own story names the seat.
if (out.includes('"t880-mid-cohort-audit-unit"') && !out.includes("t880 added the mid-cohort audit unit")) {
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
    "# t880 added the mid-cohort audit unit, the 115th seat — the between-generation tier walked (5 doors, 2026-10-15 → 2026-11-02, 562 lines: pace · world-ledger · outputs/push · param-presets · fleet-ledger) and came back CLEAN, so the receipt became the fence: the guards and the ordering law ×5, world-ledger's byte-bound-before-parse and the verbatim envelope, param-presets' ONE sanitize father and the synced-flag upsert, push's derived twin address with the per-call cap and the dedupe law, the FS-free pace face, the opt-in fleet probe; seat 114 grew 23→34 with the tempo face (the t880 window's feature: oomTempoWord — the war's tempo needs its clock, the words live in ONE client-safe birthplace)",
  );
  out = lines.join("\n");
  edits.push("STORY");
}

if (edits.length === 0) {
  console.log("rekey: nothing to do — the census already rides 115 seats (t880's keys are turned)");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey applied: ${edits.join(", ")} — census rides 115 seats`);

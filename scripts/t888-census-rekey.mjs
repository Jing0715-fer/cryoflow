#!/usr/bin/env node
/**
 * t888 — the census seat re-key (the text-surgery law: a formal script,
 * never an inline regex injection). One seat joins this window:
 *
 *   Seat 117 — t888-write-bound-unit: BORN 22/22. The t886 audit
 *   receipt's three named observations became pins at the source:
 *   A1-A4 the layout door's raw-array 1–500 bound (the cap answers
 *   before the sanitize loop spends a pass; the restore door's family
 *   wording; the zero-valid face unchanged); B1-B6 the client's chunked
 *   writer (LAYOUT_CHUNK=400 under the server's cap, ordered slices,
 *   ONE fetch site, both call sites — the tidy and the drag commit —
 *   riding it); C1-C6 the classes LIST bound (500 beside the per-value
 *   1..10000, the cap before the source-job lookups, dedupe+sort and
 *   the non-empty face unchanged); D1-D4 the gallery birth's ONE
 *   $transaction (tx.job.create + tx.edge.create, the edge DTO derived
 *   from the transaction's result, the link mode's lone create the only
 *   bare write left); E1-E2 the family anchors (restore's bound,
 *   duplicate's exemplar).
 *
 * Three edits, counted anchors:
 *   1. the header grows the seat-117 line;
 *   2. NAMES grows the seat (after t883-harness-cure-unit);
 *   3. RUNNERS grows `0` (bare node) and EXPECTED grows `22`.
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

const SEAT = "t888-write-bound-unit";
const HEADER_LINE =
  "# t888 added the write-bound unit, the 117th seat — the t886 audit receipt's three named observations became pins at the source: the layout door's raw-array 1\u2013500 bound (the client's tidy writer chunks under it), the classes LIST bound beside the per-value bound, and the gallery birth's ONE $transaction (the two-write window that could leave an edge-less consumer is gone)\n";

if (out.includes(SEAT)) {
  // idempotency pass — verify the full shape, touch nothing
  const names = out.match(/declare -a NAMES=\(([^)]*)\)/);
  const runners = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  const expected = out.match(/EXPECTED=\(([^)]*)\)/);
  const nn = names ? names[1].trim().split(/\s+/).length : -1;
  const nr = runners ? runners[1].trim().split(/\s+/).length : -1;
  const ne = expected ? expected[1].trim().split(/\s+/).length : -1;
  if (nn === 117 && nr === 117 && ne === 117) {
    console.log("rekey: already applied (NAMES/RUNNERS/EXPECTED all 117) — idempotent pass");
    process.exit(0);
  }
  console.error(`rekey: seat present but shape unexpected (NAMES=${nn}, RUNNERS=${nr}, EXPECTED=${ne}) — no edit`);
  process.exit(1);
}

// 1. the header grows the seat-117 line (before `declare -a NAMES=(`).
{
  const anchor = "declare -a NAMES=(";
  const idx = out.indexOf(anchor);
  if (idx === -1) {
    console.error("rekey: NAMES anchor not found");
    process.exit(1);
  }
  out = out.slice(0, idx) + HEADER_LINE + out.slice(idx);
  edits.push("header +seat-117 line");
}

// 2. NAMES grows the seat after t883-harness-cure-unit.
{
  const before = `  "t883-harness-cure-unit"\n)`;
  if (!out.includes(before)) {
    console.error("rekey: NAMES tail anchor not found");
    process.exit(1);
  }
  out = out.replace(before, `  "t883-harness-cure-unit"\n  "${SEAT}"\n)`);
  edits.push("NAMES +1 (117)");
}

// 3. RUNNERS grows ` 0` (bare node).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\) #/);
  if (!m) {
    console.error("rekey: RUNNERS anchor not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length !== 116) {
    console.error(`rekey: RUNNERS shape unexpected (len=${vals.length}) — no edit`);
    process.exit(1);
  }
  out = out.replace(m[0], `declare -a RUNNERS=(${m[1].trim().replace(/\)\s*$/, "")} 0) #`);
  edits.push("RUNNERS +0 (117)");
}

// 4. EXPECTED grows ` 22`.
{
  const m = out.match(/EXPECTED=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: EXPECTED not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length !== 116) {
    console.error(`rekey: EXPECTED shape unexpected (len=${vals.length}) — no edit`);
    process.exit(1);
  }
  out = out.replace(m[0], `EXPECTED=(${m[1].trim()} 22)`);
  edits.push("EXPECTED +22 (117)");
}

writeFileSync(CENSUS, out);
console.log(`rekey: ${edits.join(" · ")}`);

// the count certification (the t880 law: a ride is counted)
const check = readFileSync(CENSUS, "utf8");
const names = check.match(/declare -a NAMES=\(([^)]*)\)/)[1].trim().split(/\s+/).length;
const runners = check.match(/declare -a RUNNERS=\(([^)]*)\) #/)[1].trim().split(/\s+/).length;
const expected = check.match(/EXPECTED=\(([^)]*)\)/)[1].trim().split(/\s+/).length;
console.log(`rekey: certified NAMES=${names} RUNNERS=${runners} EXPECTED=${expected}`);
if (names !== 117 || runners !== 117 || expected !== 117) {
  console.error("rekey: certification FAILED");
  process.exit(1);
}

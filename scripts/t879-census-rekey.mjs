#!/usr/bin/env node
/**
 * t879 — the census seat re-key (the text-surgery law: a formal script,
 * never an inline regex injection). Two keys turn over this window:
 *
 *   Seat 111 — t1171-second-tier-sweep-unit: 10 → 12 pins. The E-family
 *   joined: E1 every tier door's guard answers before its first data-touch
 *   (the ordering law, ×20) and E2 resolution-arc's door leads the db
 *   probe. The audit's catch: resolution-arc probed findEffectiveJob
 *   BEFORE its isLocalRequest door — a drive-by got a 404 for a missing
 *   job and a 403 for a live one (an existence oracle every
 *   presence-only pin walked past). The route was cured; the law is
 *   pinned at both faces (the tier unit here, the tree-wide LATE-GUARD
 *   phase in scripts/t1165-route-guard-census.mjs).
 *
 *   Seat 114 — t879-pressure-words-unit: 23 pins, born. The OOM war's
 *   ledger gets its product face (parseOomRing + readMemoryPressure +
 *   the presenter's three wordings + the dialog's diag-pressure row +
 *   the source laws on the payload/client-mirror/bench). Lane 1
 *   (unit-runner: the @/lib diagnostics import rides jiti).
 *
 * Four edits, each a counted anchor:
 *   1. NAMES  — the seat joins the roster (after seat 113).
 *   2. RUNNERS — `1` joins the tail (jiti lane).
 *   3. EXPECTED — `12` replaces seat 111's `10` (positional), `23` appended.
 *   4. the roster's birth-marker comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. NAMES — the seat joins after seat 113, before the closing paren.
if (!out.includes('"t879-pressure-words-unit"')) {
  const anchor = '  "t1173-exclude-dialect-unit"\n)';
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES anchor (seat 113's entry) not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    '  "t1173-exclude-dialect-unit"\n  "t879-pressure-words-unit"\n)',
  );
  edits.push("NAMES");
}

// 2. RUNNERS — `1` joins the tail (seat 114 rides jiti).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: RUNNERS not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 113) {
    vals.push("1");
    out = out.replace(m[0], `declare -a RUNNERS=(${vals.join(" ")})`);
    edits.push("RUNNERS");
  } else if (vals.length === 114 && vals[113] === "1") {
    // already re-keyed — idempotent pass
  } else {
    console.error(`rekey: RUNNERS length ${vals.length} is not a known shape`);
    process.exit(1);
  }
}

// 3. EXPECTED — seat 111's 10 becomes 12; `23` joins the tail.
{
  const m = out.match(/EXPECTED=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: EXPECTED not found");
    process.exit(1);
  }
  const vals = m[1].trim().split(/\s+/).filter(Boolean);
  if (vals.length === 113 && vals[110] === "10") {
    vals[110] = "12";
    vals.push("23");
    out = out.replace(m[0], `EXPECTED=(${vals.join(" ")})`);
    edits.push("EXPECTED");
  } else if (vals.length === 114 && vals[110] === "12" && vals[113] === "23") {
    // already re-keyed — idempotent pass
  } else {
    console.error(
      `rekey: EXPECTED length ${vals.length}/val[110]=${vals[110]} is not a known shape`,
    );
    process.exit(1);
  }
}

// 4. the birth-marker comment — the roster's own story names the seat.
const marker = /# t1173 added the edge-poll unit[^\n]*\n/;
if (out.includes('"t879-pressure-words-unit"') && !out.includes("t879 added the pressure-words unit")) {
  // find the LAST seat-story comment line before NAMES and append ours after it
  const lines = out.split("\n");
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("declare -a NAMES=")) {
      idx = i;
      break;
    }
  }
  // walk up to the last consecutive comment line
  let story = idx - 1;
  while (story >= 0 && lines[story].startsWith("#")) story--;
  lines.splice(story + 1, 0,
    "# t879 added the pressure-words unit, the 114th seat — the OOM war's ledger gets its product face: parseOomRing reads the kernel ring's own testimony (past kills, not a live process walk — the evidence-from-bytes law gains the ring clause, the no-sniffing law intact); readMemoryPressure caps the dmesg spawn at 3s and reads /proc/self/status's VmRSS for the lane's own footprint; the presenter speaks three wordings (kills · quiet · unreadable-ring); the dialog's memory card carries the diag-pressure row; the client mirror grew the same shape (MemoryPressureClient); the t530 bench pins the ledger's locator line; the birth evidence: seven witness deaths in one window (chrome invoked oom-killer → next-server at 2.7-2.8GB anon-rss) that no memory-lane bar could NAME",
  );
  out = lines.join("\n");
  edits.push("STORY");
}

if (edits.length === 0) {
  console.log("rekey: nothing to do — the census already rides 114 seats (t879's keys are turned)");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey applied: ${edits.join(", ")} — census rides 114 seats`);

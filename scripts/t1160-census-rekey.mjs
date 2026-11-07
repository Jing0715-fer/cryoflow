#!/usr/bin/env node
/**
 * t1160 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 98
 * (t1160-world-snapshot-unit) joins at 12 pins: the world snapshot
 * lane's durability vein — the world died twice in one week (t418's
 * echo, then t1159's recycle that zeroed db/cryoflow.db and emptied
 * the mock fs; each rebirth cost three chain rounds and two watchdog
 * rides). The cure: scripts/world-snapshot.mjs — the 9-model DB truth
 * (FK-safe order, IDs preserved) + the engine-state file, frozen into
 * ONE tracked JSON (fixtures/world-snapshot.json, 32 rows: project:1 ·
 * workspace:1 · job:15 · edge:14 · worldLedger:1, engine-state:15),
 * restorable in one command. The FILE half of the world (workdirs
 * under data/relion/) is honestly OUT — a restored job is
 * DB-complete but file-hollow, and the chain re-runs what needs
 * files; the boundary is spoken at the birthplace. A the instrument
 * runs FOR REAL (the selftest subprocess 7/7: the live export, the
 * temp-DB restore roundtrip byte-equal, the dump-twice determinism);
 * B the source law (the FK-safe roster walked backwards on wipe, the
 * two-pass linkedJobId self-FK, the URL jurisdiction — CRYOFLOW_DB_URL
 * overrides, the dev lane default, never the template leak; restore
 * wipes by design and names the file half); C the doctrine (the
 * snapshot's self-consistency — meta.counts match the data — the
 * tracked home the recycle cannot eat, the completed 15-job spine
 * riding the snapshot, never a stub).
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 97).
 *   2. RUNNERS — `0` (bare node: the script imports node: builtins +
 *      @prisma/client via createRequire — no @/lib alias needed) + the
 *      seat-98 comment prepended.
 *   3. EXPECTED — `12` appended (positional) + the seat-98 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 98: t1160 rides bare node (the snapshot script imports node: builtins + @prisma/client via createRequire — no @/lib alias needed) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 98 = t1160-world-snapshot-unit (12 pins; the durability vein — the world died twice in one week (t418's echo, then t1159's recycle that zeroed db/cryoflow.db and emptied the mock fs; each rebirth cost three chain rounds and two watchdog rides); the cure: world-snapshot.mjs freezes the 9-model DB truth (FK-safe order, IDs preserved) + the engine-state file into ONE tracked JSON (fixtures/world-snapshot.json, 32 rows, engine-state:15), restorable in one command; the FILE half is honestly OUT — a restored job is DB-complete but file-hollow, the chain re-runs what needs files, the boundary spoken at the birthplace; A the instrument runs FOR REAL (the selftest subprocess 7/7: the live export, the temp-DB restore roundtrip byte-equal, the dump-twice determinism); B the source law (the FK-safe roster walked backwards on wipe, the two-pass linkedJobId self-FK, the URL jurisdiction — CRYOFLOW_DB_URL overrides, the dev lane default, never the template leak, restore wipes by design); C the doctrine (meta.counts match the data, the tracked home the recycle cannot eat, the completed 15-job spine riding the snapshot, never a stub)) · ";

if (src.includes('"t1160-world-snapshot-unit"') && src.includes("27 17 13 23 12)")) {
  console.log("t1160-census-rekey: seat 98 already enrolled — idempotent exit");
  process.exit(0);
}

let out = src;
let edits = 0;

// 1. NAMES — the seat joins the roster after seat 97.
const namesOld = '  "t1158-datetime-word-unit"\n)';
const namesNew =
  '  "t1158-datetime-word-unit"\n  "t1160-world-snapshot-unit"\n)';
if (!out.includes(namesOld)) {
  console.error("t1160-census-rekey: NAMES anchor not found");
  process.exit(1);
}
out = out.replace(namesOld, namesNew);
edits += 1;

// 2. RUNNERS — `0` appended (bare node) + the seat comment prepended.
const runnersOld = " 1 1 1 1 1 1 1) #   ";
const runnersNew =
  " 1 1 1 1 1 1 1 0) #   " + SEAT_COMMENT_RUNNERS;
if (!out.includes(runnersOld)) {
  console.error("t1160-census-rekey: RUNNERS anchor not found");
  process.exit(1);
}
out = out.replace(runnersOld, runnersNew);
edits += 1;

// 3. EXPECTED — `12` appended (positional) + the seat reason prepended.
const expectedOld = "27 17 13 23) #   ";
const expectedNew = "27 17 13 23 12) #   " + SEAT_COMMENT_EXPECTED;
if (!out.includes(expectedOld)) {
  console.error("t1160-census-rekey: EXPECTED anchor not found");
  process.exit(1);
}
out = out.replace(expectedOld, expectedNew);
edits += 1;

// The header's roster history grows one clause.
const headerOld = "t1105 added the plate-hist unit, the 61st seat — the plate's σ leg (the density distribution joins the paper).";
const headerNew = headerOld.slice(0, -1) + "; t1160 added the world-snapshot unit, the 98th seat — the durability vein (the world's death is a command, not an afternoon).";
if (out.includes(headerOld)) {
  out = out.replace(headerOld, headerNew);
  edits += 1;
}

writeFileSync(P, out);
console.log(`t1160-census-rekey: seat 98 enrolled (${edits} edits) — NAMES + RUNNERS(0, bare node) + EXPECTED(12)`);

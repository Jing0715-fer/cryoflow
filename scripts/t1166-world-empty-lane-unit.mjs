// t1166 — THE EMPTY-LANE unit: the instruments must speak the lane's silence.
//
// The sandbox recycle of 2026-11-03 handed the windows a world they had
// never ridden: db/cryoflow.db at ZERO BYTES — not "zero rows" (the
// EMPTY-LIVE the t1162 ladder already knew) but ZERO TABLES, the recycle's
// sharpest signature. Every live-reading face of world-snapshot.mjs — the
// probe's ONE aggregate, the doctor's nine-model dump, even the RESTORE
// that exists to cure exactly this lane — crashed with an unhandled P2021
// stack trace instead of speaking. A crash is neither the worded absence
// (a mute says WHY) nor the fail-safe (an unknown state retires to the
// watch band): it is the instrument going mute WITHOUT words, the worst
// face a guard can wear. The cure (this window's feat car):
//
//   P2021 (no tables)  → EMPTY-LIVE, red:false, exit 0, the why rides the
//                        payload — the recycle's signature, the snapshot is
//                        the cure, restore decides (mirrors the probe's own
//                        zero-rows EMPTY-LIVE).
//   any OTHER db error → MUTE-LIVE (the ladder's SEVENTH word), red:true,
//                        exit 1 — a blind guard is a doorbell, and the why
//                        is dug out of Prisma's boilerplate by whyOf (the
//                        connector's own words: "file is not a database").
//   the wipe           → tolerates the bare lane (P2021 continue) — the
//                        restore cannot crash on the lane it exists to cure.
//
// The seat rides REAL lanes (a 0-byte file, a garbage file, the repo's own
// lane) through the REAL instruments, then pins the source law and the
// product face's integration.
//
// A — the rides: the 0-byte lane speaks EMPTY-LIVE (exit 0, why present),
//     the garbage lane doorbells MUTE-LIVE (exit 1, the connector's why),
//     the doctor speaks both words in prose, the REAL lane stays clean
//     (no why key on a healthy verdict — the payload's honesty budget is
//     spent only when there is something to say).
// B — the source law: both faces carry catches (no bare try/finally
//     around a live read), P2021 named in both, MUTE-LIVE rides exit 1,
//     whyOf digs the connector's words, the header documents the seventh
//     word in ladder order, the wipe tolerates the bare lane, the
//     doctor's EMPTY-LIVE names the cure.
// C — the integration: the words birthplace speaks seven (MUTE-LIVE the
//     fourth), its note names the move, the dialog's red clause catches
//     the blind guard by its flag, the lib father keeps the why face.
//
// node scripts/unit-runner.mjs scripts/t1166-world-empty-lane-unit.mjs
//

import { readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { WORLD_DURABILITY_VERDICTS, worldVerdictNote } from "@/lib/world-durability-words";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const SNAP = join(ROOT, "scripts", "world-snapshot.mjs");
const src = readFileSync(SNAP, "utf8");
const dialogSrc = readFileSync(
  join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"),
  "utf8",
);
const diagSrc = readFileSync(join(ROOT, "src/lib/diagnostics.ts"), "utf8");

/** Forward chain: each word must appear AFTER the previous one landed. */
function chain(hay, words) {
  let pos = 0;
  for (const w of words) {
    const i = hay.indexOf(w, pos);
    if (i < 0) return false;
    pos = i + w.length;
  }
  return true;
}

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}`);
  }
}

/** Ride the REAL instrument against a REAL lane; return {code, json, out, err}. */
function ride(cmd, dbUrl) {
  const env = { ...process.env, CRYOFLOW_DB_URL: dbUrl };
  try {
    const out = execFileSync("node", [SNAP, cmd], { env, encoding: "utf8" });
    return { code: 0, out, err: "", json: maybeJson(out) };
  } catch (e) {
    const out = (e.stdout || "").toString();
    const err = (e.stderr || "").toString();
    return { code: e.status ?? 1, out, err, json: maybeJson(out) };
  }
}
function maybeJson(out) {
  const line = out.split("\n").reverse().find((l) => l.trim().startsWith("{"));
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

// The temp lanes: a truly empty file (SQLite reads it as a db with NO
// tables) and a garbage file (not a database at all). Both deleted at close.
const emptyLane = `/tmp/t1166-empty-${process.pid}.db`;
const garbageLane = `/tmp/t1166-garbage-${process.pid}.db`;
writeFileSync(emptyLane, "");
writeFileSync(garbageLane, "this is not a database at all, just garbage bytes");

console.log("A — the rides (real instruments, real silent lanes)");

const pEmpty = ride("probe", `file:${emptyLane}`);
ok(
  "A1 the 0-byte lane speaks EMPTY-LIVE, exit 0 (no crash, no stack)",
  pEmpty.code === 0 &&
    pEmpty.json &&
    pEmpty.json.verdict === "EMPTY-LIVE" &&
    pEmpty.json.red === false
);
ok(
  "A2 the EMPTY-LIVE mute says why (worded, the 0-byte lane named)",
  typeof pEmpty.json?.why === "string" &&
    /no tables/.test(pEmpty.json.why)
);
ok("A3 the 0-byte lane reads zero jobs, honestly", pEmpty.json?.liveJobs === 0);

const dEmpty = ride("doctor", `file:${emptyLane}`);
ok(
  "A4 the doctor speaks EMPTY-LIVE on the same lane, exit 0",
  dEmpty.code === 0 && /EMPTY-LIVE/.test(dEmpty.out)
);

const pGarbage = ride("probe", `file:${garbageLane}`);
ok(
  "A5 the garbage lane doorbells MUTE-LIVE, exit 1",
  pGarbage.code === 1 &&
    pGarbage.json &&
    pGarbage.json.verdict === "MUTE-LIVE" &&
    pGarbage.json.red === true
);
ok(
  "A6 the MUTE-LIVE why digs the connector's words (never the boilerplate, never empty)",
  typeof pGarbage.json?.why === "string" &&
    pGarbage.json.why.length > 3 &&
    !/^Invalid/.test(pGarbage.json.why) &&
    /database/i.test(pGarbage.json.why)
);

const dGarbage = ride("doctor", `file:${garbageLane}`);
ok(
  "A7 the doctor speaks MUTE-LIVE on the same lane, exit 1",
  dGarbage.code === 1 && /MUTE-LIVE/.test(dGarbage.err + dGarbage.out)
);

const pReal = ride("probe", process.env.CRYOFLOW_DB_URL || `file:${ROOT}/db/cryoflow.db`);
ok(
  "A8 the REAL lane stays clean: exit 0, red false, a ladder word",
  pReal.code === 0 &&
    pReal.json &&
    pReal.json.red === false &&
    WORLD_DURABILITY_VERDICTS.includes(pReal.json.verdict)
);
ok(
  "A9 a healthy verdict carries NO why key (the honesty budget is spent only when there is something to say)",
  pReal.json && !("why" in pReal.json)
);
const pAgain = ride("probe", process.env.CRYOFLOW_DB_URL || `file:${ROOT}/db/cryoflow.db`);
ok(
  "A10 the rides read, never touch (the live count is stable across rides)",
  pAgain.json && pReal.json && pAgain.json.liveJobs === pReal.json.liveJobs
);

console.log("B — the source law (world-snapshot.mjs)");

ok(
  "B1 both faces carry catches — no bare try/finally around a live read",
  src.split("} catch (e) {").length - 1 >= 2
);
ok(
  "B2 P2021 is named in both faces (the 0-byte lane's own word)",
  (src.match(/e\.code === "P2021"/g) || []).length >= 2
);
ok(
  "B3 MUTE-LIVE rides the doorbell exit (1)",
  src.includes('verdict: "MUTE-LIVE", red: true, ...base }, 1')
);
ok(
  "B4 the why rides the mute payloads (the worded-absence law)",
  src.includes("...(liveMute ? { why: liveMute.why } : {})")
);
ok(
  "B5 whyOf digs the connector's own words out of Prisma's boilerplate",
  /message: Some\\\("/.test(src) && src.includes("function whyOf")
);
const hdrDoctor = src.slice(
  src.indexOf("doctor   is the tracked snapshot"),
  src.indexOf("probe    the doctor's THIRD face"),
);
const hdrProbe = src.slice(
  src.indexOf("probe    the doctor's THIRD face"),
  src.indexOf("The URL:"),
);
ok(
  "B6 the header documents the seventh word — the doctor's ladder in order",
  chain(hdrDoctor, [
    "LIED     meta.counts",
    "EMPTY-LIVE",
    "MUTE-LIVE",
    "DRIFTED",
    "STALE",
    "FRESH    counts",
  ])
);
ok(
  "B6b the probe's ladder in order (the seventh word after EMPTY-LIVE)",
  chain(hdrProbe, [
    "NO-SNAPSHOT",
    "LIED",
    "EMPTY-LIVE",
    "MUTE-LIVE",
    "DRIFTED",
    "STALE",
    "FRESH",
  ])
);
ok(
  "B7 the probe's exit-code law grew the blind guard (1 NO-SNAPSHOT/LIED/MUTE-LIVE/DRIFTED)",
  /1 NO-SNAPSHOT\/\s*\n?\s*\*?\s*LIED\/MUTE-LIVE\/DRIFTED/.test(src) ||
    src.includes("LIED/MUTE-LIVE/DRIFTED")
);
ok(
  "B8 the wipe tolerates the bare lane (the restore cannot crash on its own patient)",
  /if \(e && e\.code === "P2021"\) continue;/.test(src)
);
ok(
  "B9 the doctor's EMPTY-LIVE names the cure (restore)",
  /EMPTY-LIVE — \$\{liveMute\.why\} — the recycle's signature: the snapshot is the cure/.test(src)
);

console.log("C — the integration (the product face)");

ok(
  "C1 the words birthplace speaks seven, MUTE-LIVE the fourth",
  WORLD_DURABILITY_VERDICTS.length === 7 &&
    WORLD_DURABILITY_VERDICTS[3] === "MUTE-LIVE"
);
const muteNote = worldVerdictNote("MUTE-LIVE");
ok(
  "C2 the seventh note is worded, distinct, and names the move (check the db lane)",
  muteNote.length > 20 &&
    new Set(WORLD_DURABILITY_VERDICTS.map((v) => worldVerdictNote(v))).size === 7 &&
    /check the db lane/.test(muteNote)
);
ok(
  "C3 the dialog's red clause catches the blind guard by its flag",
  /if \(red \|\| verdict === "NO-SNAPSHOT"/.test(dialogSrc)
);
ok(
  "C4 the lib father keeps the why face (the mute face's type)",
  /\{ ok: false; why: string \}/.test(diagSrc)
);
ok(
  "C5 the server module re-speaks the seven words from the ONE birthplace",
  diagSrc.includes('export { WORLD_DURABILITY_VERDICTS } from "@/lib/world-durability-words"')
);
ok(
  "C6 the dialog's comment names the seven-word world (the map's own law, t1166)",
  /seven words since/.test(dialogSrc)
);

rmSync(emptyLane, { force: true });
rmSync(garbageLane, { force: true });

console.log("");
console.log(`\nWORLD-EMPTY-LANE-UNIT t1166: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

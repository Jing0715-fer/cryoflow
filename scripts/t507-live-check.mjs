/**
 * t507-live-check.mjs — byte-level cross-check of the two grids.
 *
 * The archive grid (jobs CSV, t507) and the timeline grid (t506) drink
 * the same walk. For every job both grids speak, started_at and
 * duration_ms must be BYTE-IDENTICAL; for every job the timeline never
 * spoke (never started), both new cells must be blank — never a guess.
 */
import { readFileSync } from "fs";
import os from "os";

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows;
};

const home = os.homedir();
const jobsText = readFileSync(`${home}/Downloads/cryoflow-galactosidase-tutorial-demo-jobs-2026-09-30.csv`, "utf8");
const tlText = readFileSync(`${home}/Downloads/session-timeline-2026-09-30T04-47-27.csv`, "utf8");

const jobs = parseCsv(jobsText);
const tl = parseCsv(tlText);
const [jh, ...jr] = jobs;
const [th, ...tr] = tl;

let fail = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  PASS ${msg}`);
  else { fail++; console.error(`  FAIL ${msg}`); }
};

ok(jh.length === 11 && jh[9] === "started_at" && jh[10] === "duration_ms",
  `archive header: ${jh.length} cols, window columns ride at the end`);
ok(jh.slice(0, 9).join(",") === "name,type,type_label,workspace,status,progress_pct,result,created_at,updated_at",
  "the old nine archive columns intact, in order");
ok(th.join(",") === "job_id,job,type,workspace,status,started_at,ended_at,duration_ms,duration_human,share_pct",
  "timeline header untouched (ten columns)");
ok(jr.length === 22, `archive grid: ${jr.length} data rows (22 jobs)`);
ok(tr.length === 15, `timeline grid: ${tr.length} data rows (15 runs)`);

// timeline rows keyed by name (both grids speak the job's name)
const byName = new Map(tr.map((r) => [r[1], r]));
let matched = 0, blanked = 0;
const mismatches = [];
for (const r of jr) {
  const [name, , , , status, , , , , startedAt, durationMs] = r;
  const twin = byName.get(name);
  if (twin) {
    // same job on both grids → same window bytes, by construction
    if (twin[5] === startedAt && twin[7] === durationMs) matched++;
    else mismatches.push(`${name}: archive(${startedAt},${durationMs}) vs timeline(${twin[5]},${twin[7]})`);
  } else {
    // never started → both cells blank, never a guess
    if (startedAt === "" && durationMs === "") blanked++;
    else mismatches.push(`${name}: absent from timeline but archive says (${startedAt},${durationMs})`);
  }
}
ok(matched === 15, `${matched}/15 window rows byte-identical across both grids`);
ok(blanked === 7, `${blanked}/7 never-started jobs speak blank in both new cells`);
ok(mismatches.length === 0, mismatches.length === 0 ? "zero disagreements — two machine readers, one truth" : mismatches.join(" | "));

// the walk's origin: the earliest started_at on the archive grid IS the walk's span origin (t506's live stamp)
const stamps = jr.map((r) => r[9]).filter(Boolean).sort();
ok(stamps[0] === "2026-09-28T04:45:08.151Z", `earliest stamp ${stamps[0]} = the walk's span origin (t506's live witness)`);

// engine floor: a duration cell is never below 1000 (the well's floor law);
// blank cells (never started) are the honest absence and sit outside the floor
const durs = jr.map((r) => r[10]).filter((s) => s !== "").map(Number);
ok(durs.length === 15 && durs.every((d) => d >= 1000), `all ${durs.length} written durations ≥ 1000 (the well's floor; 7 blanks exempt)`);

console.log(`\n=== t507 live check: ${fail === 0 ? "ALL GREEN" : fail + " FAILURES"} ===`);
process.exit(fail === 0 ? 0 : 1);

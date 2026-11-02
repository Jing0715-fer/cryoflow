#!/usr/bin/env node
/**
 * t1140 — THE JOBS' OWN HEALTH FACE unit: the board's verdicts were the
 * ENGINE's and the PIPELINE's; the jobs' own facts learn to speak.
 *
 * THE SLICE (the t1134 pool's largest piece — its 管道健康板 half):
 *   • the LAST FAILURE NAMED — the failures row above counts; this row
 *     names WHO broke, in the run's own first words (clipped at 80 — a
 *     nameplate, not a log), and WHEN the world learned. The newest
 *     failure wins; equal stamps fall to the array's last (deterministic).
 *   • the OLDEST RUNNING — a count says HOW MANY, not HOW LONG; the age
 *     rides the ONE duration father (worldAgeWords → formatElapsed).
 *   • the OLDEST WAITING — a pending job's silence has a length; the
 *     wait rides updatedAt (pending never started — startedAt is null).
 *   • facts, not verdicts — a row exists ONLY when its fact exists:
 *     silence is the honest absence, never a "nothing to see" filler.
 *     An unreadable stamp is an absent fact (never NaN wearing a
 *     sentence); a stamp in the future is clock skew — the age row
 *     steps aside rather than speak a negative duration.
 *   • ONE clock — the dialog's ages (timeline AND jobs) ride the SAME
 *     useNow tick (the one-clock law; an idle world pays zero timers).
 *
 * t1143 — THE COMPLETIONS' OWN WORDS (the verdicts' NEXT half), grown
 * into this seat:
 *   • Fresh — the newest completion DATED ("X finished 9m ago · ran
 *     1m 00s"); the census counts it, the row dates it.
 *   • Marathon — the longest completed run WEIGHED; ties fall to the
 *     array's last (the >= law).
 *   • the PACE JUDGMENT — the completions' own median duration is the
 *     world's OWN pace; the oldest run strictly outlasting twice the
 *     median earns the warn face (ok:false). Fewer than three
 *     completions is a rumor — the row keeps the honest fact shape;
 *     the even count takes the lower middle; the line is STRICT.
 *   • re-keys: A8 (the completed world SPEAKS its achievement now),
 *     B1 (the list's label teaches the new faces), B5 (the gate's
 *     disjunction extends — completed>0 — no second ticker).
 *
 * The unit RUNS the lib's pure functions and PINS the dialog's source.
 * node scripts/unit-runner.mjs scripts/t1140-world-job-rows-unit.mjs
 */
import { readFileSync } from "node:fs";
import { worldJobRows } from "../src/lib/world-vitals.ts";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const lib = readFileSync("src/lib/world-vitals.ts", "utf8");
const dlg = readFileSync("src/components/workflow/world-health-dialog.tsx", "utf8");

const NOW = Date.UTC(2026, 10, 2, 6, 20, 27); // 2026-11-02T06:20:27Z
const iso = (ms) => new Date(ms).toISOString();
const clockOf = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

/* ---------- A band — the rows' words (the lib runs) ---------- */
console.log("A band — the jobs' own facts:");
const failedJob = {
  name: "Import Movies 2", status: "failed", result: "stopped by user",
  startedAt: null, updatedAt: iso(NOW - 60_000),
};
const rows1 = worldJobRows([failedJob], NOW);
ok("A1 the last failure NAMED (who — the run's own words — when)",
  rows1.length === 1 && rows1[0].key === "last-failure" && rows1[0].ok === false &&
  rows1[0].detail === `Import Movies 2 — stopped by user · ${clockOf(NOW - 60_000)}`,
  rows1[0]?.detail);

const older = { name: "Old Pain", status: "failed", result: "older break", startedAt: null, updatedAt: iso(NOW - 600_000) };
const rows2 = worldJobRows([older, failedJob], NOW);
ok("A2 the NEWEST failure wins (two failed, the later stamp speaks)",
  rows2.length === 1 && rows2[0].detail.startsWith("Import Movies 2"));

const longWords = "x".repeat(120);
const rows3 = worldJobRows([{ ...failedJob, result: longWords }], NOW);
ok("A3 the long result clips at 80 with the ellipsis (a nameplate, not a log)",
  rows3[0].detail.includes("x".repeat(80) + "…") && !rows3[0].detail.includes("x".repeat(81)),
  `${rows3[0].detail.length} chars`);

const rows4 = worldJobRows([{ ...failedJob, result: null }], NOW);
ok("A4 a null result speaks the name and the when only (no invented words)",
  rows4[0].detail === `Import Movies 2 · ${clockOf(NOW - 60_000)}`,
  rows4[0].detail);

const runOld = { name: "R1", status: "running", result: null, startedAt: iso(NOW - 300_000), updatedAt: iso(NOW - 60_000) };
const runNew = { name: "R2", status: "running", result: null, startedAt: iso(NOW - 120_000), updatedAt: iso(NOW - 60_000) };
const rows5 = worldJobRows([runNew, runOld], NOW);
ok("A5 the OLDEST running speaks its age (the count says how many, the row says how long)",
  rows5.length === 1 && rows5[0].key === "oldest-running" && rows5[0].ok === true &&
  rows5[0].detail === "2 running — the oldest started 5m 00s ago",
  rows5[0]?.detail);

const future = { name: "Skew", status: "running", result: null, startedAt: iso(NOW + 3_600_000), updatedAt: iso(NOW - 60_000) };
ok("A6 a stamp in the future is clock skew — the age row steps aside (never a negative duration)",
  worldJobRows([future], NOW).length === 0);

const pendA = { name: "P1", status: "pending", result: null, startedAt: null, updatedAt: iso(NOW - 150_000) };
const pendB = { name: "P2", status: "pending", result: null, startedAt: null, updatedAt: iso(NOW - 30_000) };
const pendC = { name: "P3", status: "pending", result: null, startedAt: null, updatedAt: iso(NOW - 90_000) };
const rows7 = worldJobRows([pendB, pendC, pendA], NOW);
ok("A7 the OLDEST waiting speaks its wait (pending never started — the wait rides updatedAt)",
  rows7.length === 1 && rows7[0].key === "oldest-pending" &&
  rows7[0].detail === "3 pending — the oldest waited 2m 30s",
  rows7[0]?.detail);

const rows8 = worldJobRows(
  [{ name: "J", status: "completed", result: null, startedAt: iso(NOW - 60_000), updatedAt: iso(NOW - 30_000) }],
  NOW,
);
ok("A8 the honest absences, t1143 RE-KEY (the EMPTY world stays silent — silence, not filler; a completed world SPEAKS its achievement — dated AND weighed: the Fresh row and the Marathon row, one run two rows)",
  worldJobRows([], NOW).length === 0 && rows8.length === 2 &&
  rows8[0].key === "fresh-completion" && rows8[1].key === "marathon",
  rows8[0]?.detail);

const rows9 = worldJobRows(
  [{ name: "Ghost", status: "failed", result: null, startedAt: "not-a-date", updatedAt: "also-not-a-date" }],
  NOW,
);
ok("A9 an unreadable stamp is an ABSENT fact (never NaN wearing a sentence)",
  rows9.length === 0);

const tieA = { name: "Tie A", status: "failed", result: null, startedAt: null, updatedAt: iso(NOW - 60_000) };
const tieB = { name: "Tie B", status: "failed", result: null, startedAt: null, updatedAt: iso(NOW - 60_000) };
ok("A10 equal stamps fall to the array's last (deterministic, the >= law)",
  worldJobRows([tieA, tieB], NOW)[0].detail.startsWith("Tie B"));

ok("A11 the clip constant speaks once (the nameplate law's number)",
  lib.includes("const FAILURE_WORDS_CLIP = 80;") && (lib.match(/FAILURE_WORDS_CLIP/g) ?? []).length === 3,
  "declared once, used twice in one sentence");

ok("A12 the durations ride the ONE father (no second formatter born)",
  lib.includes("worldAgeWords(now - oldestRunMs)") && lib.includes("worldAgeWords(now - oldestWaitMs)") &&
  lib.includes("clockWordsOf(lastFailMs)") && !lib.includes("Math.round(ms / 1000)"),
  "worldAgeWords + clockWordsOf, never a re-derivation");

/* ---------- B band — the dialog's pins (source) ---------- */
console.log("B band — the board's second list:");
ok("B1 the jobs' own list exists (its own testid + its own aria-label, t1143 RE-KEY: the label teaches the completions' faces)",
  dlg.includes('data-testid="world-health-job-rows"') &&
  dlg.includes('aria-label="Job health facts — the last failure named, the oldest running job\'s age, the queue\'s oldest wait, the newest completion, the longest run"'));

ok("B2 the honest-empty render (the list exists only when it has rows)",
  dlg.includes("{jobRows.length > 0 && (\n          <ul"));

ok("B3 the ONE father import (the dialog re-derives nothing)",
  dlg.includes("\n  worldJobRows,") && dlg.includes('from "@/lib/world-vitals"'));

ok("B4 the memo rides [jobs, now] (the read-side compute, never a render write)",
  dlg.includes("React.useMemo(() => worldJobRows(jobs, now), [jobs, now])"));

ok("B5 ONE clock (the jobs' ages ride the SAME useNow tick — the one-clock law; t1143 RE-KEY: the gate's disjunction extends to completed>0, no second ticker born)",
  dlg.includes("vitals.running > 0 || vitals.pending > 0 || vitals.completed > 0;") &&
  dlg.includes("useNow(open && ((lastT !== null && history.length > 1) || hasAgeableJobs))"));

ok("B6 zero disabled sites (the tally census untouched)",
  !dlg.includes("disabled={"));

ok("B7 the family's faces stand (the t1133 verdicts + the t1139 inspector untouched)",
  dlg.includes('data-testid="world-health-rows"') &&
  dlg.includes('data-testid="world-health-transition-readout"') &&
  dlg.includes('data-testid="world-health-download"') &&
  dlg.includes('data-testid="world-health-timeline-group"'));

/* ---------- C band — the completions' own words (t1143) ---------- */
console.log("C band — the completions' own words:");

const compA = { name: "Done Early", status: "completed", result: null, startedAt: iso(NOW - 600_000), updatedAt: iso(NOW - 540_000), duration: 60_000 };
const compB = { name: "Done Late", status: "completed", result: null, startedAt: iso(NOW - 480_000), updatedAt: iso(NOW - 60_000), duration: 420_000 };
const compC = { name: "Done Mid", status: "completed", result: null, startedAt: iso(NOW - 400_000), updatedAt: iso(NOW - 200_000), duration: 200_000 };

const rowsC1 = worldJobRows([compA], NOW);
ok("C1 Fresh speaks (the achievement DATED: who — finished when — ran how long; the single run ALSO weighs — two rows, one run)",
  rowsC1.length === 2 && rowsC1[0].key === "fresh-completion" && rowsC1[0].ok === true &&
  rowsC1[0].label === "Fresh" &&
  rowsC1[0].detail === "Done Early finished 9m 00s ago · ran 1m 00s" &&
  rowsC1[1].key === "marathon" && rowsC1[1].detail === "Done Early ran the longest — 1m 00s",
  rowsC1[0]?.detail);

ok("C2 the NEWEST completion wins (two finished, the later stamp speaks)",
  worldJobRows([compA, compB], NOW)[0].detail.startsWith("Done Late finished 1m 00s ago"));

const rowsC3 = worldJobRows(
  [{ name: "Lone Finish", status: "completed", result: null, startedAt: null, updatedAt: iso(NOW - 120_000) }],
  NOW,
);
ok("C3 an unreadable duration speaks NO 'ran' words (never a guessed span wearing a sentence)",
  rowsC3.length === 1 && rowsC3[0].detail === "Lone Finish finished 2m 00s ago",
  rowsC3[0]?.detail);

const rowsC4 = worldJobRows(
  [{ name: "DTO Wins", status: "completed", result: null, startedAt: iso(NOW - 300_000), updatedAt: iso(NOW - 120_000), duration: 90_000 }],
  NOW,
);
ok("C4 the engine's own duration rides (the DTO's real elapsed beats the stamps' span)",
  rowsC4[0].detail.endsWith("ran 1m 30s"),
  rowsC4[0]?.detail);

const rowsC5 = worldJobRows(
  [{ name: "Skew Finish", status: "completed", result: null, startedAt: null, updatedAt: iso(NOW + 60_000) }],
  NOW,
);
ok("C5 a finish stamp in the future is clock skew — the Fresh row steps aside (never a negative age)",
  rowsC5.length === 0);

ok("C6 Marathon speaks (the longest completed run WEIGHED)",
  worldJobRows([compA, compB, compC], NOW)[1].detail === "Done Late ran the longest — 7m 00s");

const rowsC7 = worldJobRows(
  [
    { name: "Tie One", status: "completed", result: null, startedAt: null, updatedAt: iso(NOW - 120_000), duration: 120_000 },
    { name: "Tie Two", status: "completed", result: null, startedAt: null, updatedAt: iso(NOW - 120_000), duration: 120_000 },
  ],
  NOW,
);
ok("C7 Marathon's tie falls to the array's last (the >= law, the failure scan's own determinism)",
  rowsC7[1].detail === "Tie Two ran the longest — 2m 00s",
  rowsC7[1]?.detail);

const rowsC8 = worldJobRows(
  [{ name: "Ghost Finish", status: "completed", result: null, startedAt: "not-a-date", updatedAt: iso(NOW - 60_000) }],
  NOW,
);
ok("C8 Marathon is ABSENT without any readable duration (the Fresh face speaks, the weigher stays silent)",
  rowsC8.length === 1 && rowsC8[0].key === "fresh-completion");

const runSlow = { name: "Slow Run", status: "running", result: null, startedAt: iso(NOW - 500_000), updatedAt: iso(NOW - 60_000) };
const rowsC9 = worldJobRows([compA, compB, compC, runSlow], NOW);
const runRowC9 = rowsC9.find((r) => r.key === "oldest-running");
ok("C9 the PACE JUDGMENT (3 completions → median 3m 20s; 8m 20s > 2× median → the warn face + the median's own words)",
  runRowC9.ok === false &&
  runRowC9.detail === "1 running — the oldest started 8m 20s ago; outlasted the usual run (median 3m 20s)",
  runRowC9?.detail);

const rowsC10 = worldJobRows([compA, compB, runSlow], NOW);
const runRowC10 = rowsC10.find((r) => r.key === "oldest-running");
ok("C10 the judgment's FLOOR (two completions is a rumor — the row keeps the honest fact shape)",
  runRowC10.ok === true && runRowC10.detail === "1 running — the oldest started 8m 20s ago",
  runRowC10?.detail);

const compFast = { name: "F1", status: "completed", result: null, startedAt: null, updatedAt: iso(NOW - 300_000), duration: 100_000 };
const compMid = { name: "F2", status: "completed", result: null, startedAt: null, updatedAt: iso(NOW - 200_000), duration: 250_000 };
const compBig = { name: "F3", status: "completed", result: null, startedAt: null, updatedAt: iso(NOW - 100_000), duration: 400_000 };
const runEdge = { name: "Edge Run", status: "running", result: null, startedAt: iso(NOW - 500_000), updatedAt: iso(NOW - 60_000) };
const rowsC11 = worldJobRows([compFast, compMid, compBig, runEdge], NOW);
const runRowC11 = rowsC11.find((r) => r.key === "oldest-running");
ok("C11 the line is STRICT (exactly 2× the lower-middle median → not outlasted; the judgment errs late, never early)",
  runRowC11.ok === true && !runRowC11.detail.includes("outlasted"),
  runRowC11?.detail);

ok("C12 the judgment's numbers speak once (the floor and the factor are the lib's own constants)",
  lib.includes("const PACE_MEDIAN_FLOOR = 3;") && lib.includes("const PACE_JUDGE_FACTOR = 2;") &&
  (lib.match(/PACE_MEDIAN_FLOOR/g) ?? []).length === 2 &&
  (lib.match(/PACE_JUDGE_FACTOR/g) ?? []).length === 2);

ok("C13 JobClock carries the engine's duration (STRUCTURAL: JobDTO satisfies it, a fake may omit it)",
  lib.includes("duration?: number | null;"));

ok("C14 the gate's disjunction extends (the completed ages ride the SAME tick — ONE useNow call in the dialog, no second ticker born)",
  (dlg.match(/useNow\(/g) ?? []).length === 1);

ok("C15 the one-father law for the new words (worldAgeWords formats the fresh age, the marathon span, and the median — no second formatter)",
  lib.includes("worldAgeWords(now - freshMs)") && lib.includes("worldAgeWords(marathonMs)") &&
  lib.includes("worldAgeWords(median)"));

ok("C16 the achievements speak LAST (the failure first, the work now, the queue's patience, then the finished runs)",
  lib.indexOf('"fresh-completion"') > lib.indexOf('"oldest-pending"') &&
  lib.indexOf('"marathon"') > lib.indexOf('"fresh-completion"'));

/* ---------- receipt ---------- */
console.log(`\nWORLD-JOB-ROWS-UNIT t1140: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

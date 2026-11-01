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
ok("A8 the honest absences (a clean world speaks NO job rows — silence, not filler)",
  worldJobRows([], NOW).length === 0 && rows8.length === 0);

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
ok("B1 the jobs' own list exists (its own testid + its own aria-label)",
  dlg.includes('data-testid="world-health-job-rows"') &&
  dlg.includes('aria-label="Job health facts — the last failure named, the oldest running job\'s age, the queue\'s oldest wait"'));

ok("B2 the honest-empty render (the list exists only when it has rows)",
  dlg.includes("{jobRows.length > 0 && (\n          <ul"));

ok("B3 the ONE father import (the dialog re-derives nothing)",
  dlg.includes("\n  worldJobRows,") && dlg.includes('from "@/lib/world-vitals"'));

ok("B4 the memo rides [jobs, now] (the read-side compute, never a render write)",
  dlg.includes("React.useMemo(() => worldJobRows(jobs, now), [jobs, now])"));

ok("B5 ONE clock (the jobs' ages ride the SAME useNow tick — the one-clock law)",
  dlg.includes("const hasAgeableJobs = vitals.running > 0 || vitals.pending > 0;") &&
  dlg.includes("useNow(open && ((lastT !== null && history.length > 1) || hasAgeableJobs))"));

ok("B6 zero disabled sites (the tally census untouched)",
  !dlg.includes("disabled={"));

ok("B7 the family's faces stand (the t1133 verdicts + the t1139 inspector untouched)",
  dlg.includes('data-testid="world-health-rows"') &&
  dlg.includes('data-testid="world-health-transition-readout"') &&
  dlg.includes('data-testid="world-health-download"') &&
  dlg.includes('data-testid="world-health-timeline-group"'));

/* ---------- receipt ---------- */
console.log(`\nWORLD-JOB-ROWS-UNIT t1140: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

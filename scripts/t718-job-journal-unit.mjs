// t718-job-journal-unit.mjs — the event spine's laws, pinned before the
// bundle wakes (the t653 pattern, eighth reuse).
//
// The t718 lane: the inspector's Timeline strip answers "where is this
// job NOW?" in three milestone dots; lib/job-journal.ts + the store's
// five hook sites add the spine BETWEEN the dots — renames, knob-turns,
// notes, dispatches, the engine's own starts and landings. The unit
// probe pins the laws a build-day e2e should never have to re-derive:
//
//   A  the lib's laws — newest-first reads, the two coalescing windows
//      (identical neighbor 1.5s; kicked-after-run 30s — the dispatch's
//      record wins over the poll's re-witness), per-job and per-shelf
//      caps (oldest drops, least-recently-appended jobs evict), detail
//      trim, corruption tolerance, the DORMANT law (no purge API: the
//      journal outlives the job quietly and a restore finds its history).
//   B  the five hook sites — saveJob's intent classifier (params/note/
//      renamed; movement journals nothing), both dispatch paths, the
//      poll's kicked/finished collection, the preset-worn params fact.
//   C  the spine's face — seven kinds with their verbs, the synthetic
//      birth anchors, the cap-7 with honest +N earlier, the empty
//      whisper, the Timeline section placement.
//   D  purity — no fetch, no next, no react, no custom event (the
//      store's jobs slice is the change bus).
//
// Run:  node scripts/unit-runner.mjs scripts/t718-job-journal-unit.mjs

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

// ---------- the memory window ----------
const backing = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v)),
    removeItem: (k) => backing.delete(k),
  },
};

import { recordJobEvent, readJobJournal, JOB_JOURNAL_KEY } from "../src/lib/job-journal";
import { readFileSync } from "node:fs";

const NOW = 1_760_000_000_000;
const T = (offset) => NOW + offset;

// ---------- A: the lib's laws ----------
console.log("A lib:");

recordJobEvent("j1", "run", undefined, { now: T(0) });
recordJobEvent("j1", "completed", undefined, { now: T(1_000) });
recordJobEvent("j1", "params", "3 knobs", { now: T(2_000) });
const spine1 = readJobJournal("j1");
must(spine1.length === 3 && spine1[0].kind === "params" && spine1[2].kind === "run",
  "A1 record+read roundtrip, newest first");

recordJobEvent("j1", "params", "3 knobs", { now: T(2_800) }); // 800ms after, same kind+detail
must(readJobJournal("j1").length === 3,
  "A2 IDENTICAL NEIGHBOR — same kind+detail within 1.5s is one fact (the flush race)");
recordJobEvent("j1", "params", "3 knobs", { now: T(4_000) }); // 2s after, same face
must(readJobJournal("j1").length === 4,
  "A3 the same face beyond the window is a distinct fact (two edit moments)");
recordJobEvent("j1", "params", "5 knobs", { now: T(4_200) }); // 200ms after, different detail
must(readJobJournal("j1").length === 5,
  "A4 a different detail within the window is a distinct fact (the count moved)");

recordJobEvent("j2", "run", undefined, { now: T(0) });
recordJobEvent("j2", "kicked", undefined, { now: T(2_000) });
must(readJobJournal("j2").length === 1,
  "A5 KICKED-AFTER-RUN — the poll's re-witness within 30s dedups (the dispatch knew the finger)");
recordJobEvent("j2", "kicked", undefined, { now: T(40_000) });
must(readJobJournal("j2").length === 2,
  "A6 a kick beyond the window is the engine's own start — recorded");

for (let i = 0; i < 25; i++) recordJobEvent("j3", "params", `knobs ${i}`, { now: T(i * 60_000) });
const spine3 = readJobJournal("j3");
must(spine3.length === 20 && spine3[0].detail === "knobs 24" && spine3[19].detail === "knobs 5",
  "A7 per-job cap 20 — the spine stays a spine, the OLDEST drops");

for (let i = 0; i < 205; i++) recordJobEvent(`old-${i}`, "params", "1 knob", { now: T(i) });
const map = JSON.parse(backing.get(JOB_JOURNAL_KEY));
must(Object.keys(map).length === 200,
  "A8 per-shelf cap 200 — the shelf holds exactly the cap", `${Object.keys(map).length} jobs`);
must(!map["old-0"] && !map["old-4"] && !!map["old-204"],
  "A9 the eviction cut is the OLDEST side (insertion order = recency order)");
must(!map["j1"] && !map["j3"],
  "A10 the 205 newer appends evicted the earlier jobs too (LRU, not FIFO-of-creation)");

backing.set(JOB_JOURNAL_KEY, "{not json");
must(readJobJournal("j1").length === 0, "A11 corrupted JSON degrades to an empty journal (no throw)");
backing.set(JOB_JOURNAL_KEY, JSON.stringify({ jx: [{ jobId: "jx", kind: "run", at: 1 }, "junk", null, { kind: "params", at: 2 }] }));
must(readJobJournal("jx").length === 1,
  "A12 foreign-shaped entries are filtered, good neighbours live (the gallery law)");
backing.set(JOB_JOURNAL_KEY, JSON.stringify({ jy: "not an array" }));
must(readJobJournal("jy").length === 0, "A13 a non-array row reads as empty");

const longDetail = "x".repeat(300);
recordJobEvent("jz", "note", longDetail, { now: T(0) });
must(readJobJournal("jz")[0].detail.length === 120,
  "A14 detail trims at 120 chars (a spine row is a clause, not a paragraph)");

const libSrc = readFileSync("src/lib/job-journal.ts", "utf8");
must(!libSrc.includes("export function purge") && !libSrc.includes("deleteJob"),
  "A15 the DORMANT law — no purge API exists: the journal outlives the job quietly (a Ctrl+Z restore finds its history)");

// ---------- B: the five hook sites ----------
console.log("B hooks:");
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
must(storeSrc.includes('import { recordJobEvent } from "./job-journal"'),
  "B1 the store imports the spine lib");
must(storeSrc.includes('recordJobEvent(id, "params"') && storeSrc.includes('"note" in patch') &&
     storeSrc.includes('recordJobEvent(id, "renamed"'),
  "B2 saveJob's classifier journals params/note/renamed (the single PATCH write path, first match wins)");
must(storeSrc.includes('!("x" in patch || "y" in patch)'),
  "B3 movement journals nothing (a drag is not story)");
must(storeSrc.includes('recordJobEvent(id, "run")') && storeSrc.includes('recordJobEvent(id, "run", "to cluster")'),
  "B4 both dispatch paths journal the run (the cluster path says its venue)");
must(storeSrc.includes('for (const j of kicked) recordJobEvent(j.id, "kicked")') &&
     storeSrc.includes("for (const f of finished) recordJobEvent(f.job.id, f.kind)"),
  "B5 the poll's collection points journal the engine's own starts and landings");
must(/const before = \(prevParams \?\? \{\}\) as Record<string, unknown>;\s*\n\s*const moved = Object\.keys\(params\)/.test(storeSrc),
  "B6 the preset-worn path journals the knob count it moved (t713's updateJobParams)");

// ---------- C: the spine's face ----------
console.log("C spine face:");
const inspSrc = readFileSync("src/components/workflow/job-inspector.tsx", "utf8");
must(["run", "kicked", "completed", "failed", "params", "note", "renamed"].every((k) =>
  new RegExp(`^  ${k}: \\{ icon: `, "m").test(inspSrc)
),
  "C1 all seven kinds have their verb face");
must(inspSrc.includes("const startedMs = job.startedAt ? new Date(job.startedAt).getTime() : null") &&
     inspSrc.includes("verb: \"Started\" as const") && inspSrc.includes("verb: \"Created\" as const"),
  "C2 the birth anchors are SYNTHETIC (from the row — full birth coverage with zero hooks)");

must(inspSrc.includes("const JOURNAL_CAP = 7;") && inspSrc.includes('data-testid="job-journal-expand"') &&
     inspSrc.includes("+{hidden} earlier event"),
  "C3 cap 7 with an honest +N earlier expansion (the wall's overflow law)");
must(inspSrc.includes('data-testid="job-journal-empty"'),
  "C4 the empty journal whispers what will appear here (honest first-frame affordance)");
must(inspSrc.includes('data-testid="job-journal-row"') && inspSrc.includes("fmtAgo(row.at)"),
  "C5 rows speak by name and carry the one age dialect (fmtAgo right slot)");
must(inspSrc.includes("<Timeline job={job} />") && /<Timeline job=\{job\} \/>\s*\n\s*<JobJournal job={job} \/>/.test(inspSrc),
  "C6 the spine lives UNDER the milestone strip — one Timeline section, milestones then events");
must(inspSrc.includes('readJobJournal, type JobJournalKind'),
  "C7 the component reads through the ONE lib (no second storage path)");
must(inspSrc.includes("motion-reduce:transition-none"),
  "C8 motion-reduce discipline on the expand affordance (qa49's law)");

// ---------- D: purity ----------
console.log("D purity:");
must(!libSrc.includes("fetch(") && !libSrc.includes("next/") && !libSrc.includes("react"),
  "D1 the lib is pure — no fetch, no next, no react");
must(!libSrc.includes("dispatchEvent"),
  "D2 no custom event — the store's jobs slice is the change bus (every hook lands through a store update)");
must(storeSrc.includes('import { recordJobEvent } from "./job-journal"') &&
     !storeSrc.includes("from \"@/lib/job-journal\""),
  "D3 the store rides the relative sibling import (same lib, one path)");

// ---------- verdict ----------
console.log(`\n${PASS} pass / ${FAIL} fail`);
process.exit(FAIL > 0 ? 1 : 0);

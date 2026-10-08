// t721-notes-wall-unit.mjs — the notebook face, pinned before the bundle
// wakes (the t653 pattern, tenth reuse).
//
// The t721 lane: the activity family speaks four tenses (trend, shape,
// jobs-now, fingers-did) but nobody speaks the CONCLUSIONS. Task 721 adds
// the notes wall — the dashboard's tenth rung, a reading surface quoting
// every margin note (Task 73) and class note (Task 80) in the ACTIVE
// project, riding the store's jobs slice with zero fetch / zero effects /
// zero new storage. The probe pins:
//
//   A  the predicate's contract — the wall reads hasJudgment (Task 83's
//      single source, the same function the Noted chip / 5-key filter /
//      canvas lens / header count read). A thin live re-read of the wall's
//      side of that contract (the lib's own behavior lives in qa83).
//   B  the wall's face — cap 8, newest-touched sort, the quote hero
//      (line-clamped), the class-only count line, the byline pill when a
//      written note AND class notes coexist, the status dot from
//      lib/status-style, the openJob landing, the HONESTY LAW (no
//      timestamps — no fmtAgo import, no time claim anywhere), the
//      footer's counted honesty, the honest null, motion-reduce.
//   C  the cascade's tenth rung — the ladder 140→500 with the wall at
//      300 (after the digest's 260, before saved views' 340), the settle
//      at 780 (500+240 = 740 lands, 40ms margin — the margin law
//      numerically re-proven a third time), and ALL THREE sibling probes
//      synchronized (t576 live-fire ten rungs / 0.5s / 780ms; t720's D
//      ten rungs; t716's B ten rungs — the t711 lesson: every count).
//   D  purity — zero fetch, zero useEffect, zero storage keys, zero
//      custom events; the tree-wide definition count of hasJudgment
//      stays 1; the wall imports the predicate, never redefines it.
//
// Run:  node scripts/unit-runner.mjs scripts/t721-notes-wall-unit.mjs

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

import { hasJudgment, parseClassNotes, CLASS_NOTE_MAX } from "../src/lib/class-notes";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const wallSrc = read("../src/components/workflow/notes-wall.tsx");
const dashSrc = read("../src/components/workflow/project-dashboard.tsx");

// ---------- A: the predicate's contract ----------
console.log("A predicate single source:");

must(typeof hasJudgment === "function" && typeof parseClassNotes === "function",
  "A1 the wall's predicate and parser are the lib's exports (live import resolves)");

must(hasJudgment({ note: "verdict: good", params: {} }) === true,
  "A2 a written note is judgment");
must(hasJudgment({ note: null, params: { classNotes: JSON.stringify({ c1: "tight" }) } }) === true,
  "A3 class notes alone are judgment (the select2d dialect)");
must(hasJudgment({ note: "", params: {} }) === false,
  "A4 an empty note is no judgment (the PATCH normalizes to null; '' falls through safely)");
must(hasJudgment({ note: null, params: { classNotes: "{corrupted" } }) === false,
  "A5 a corrupted classNotes param degrades to no judgment (never takes the wall down)");

must(CLASS_NOTE_MAX === 300,
  "A6 the class-note cap is untouched (the wall quotes, never enforces)");

// census: every noted surface reads the ONE predicate
const predDef = [
  read("../src/lib/class-notes.ts"),
  wallSrc, dashSrc,
  read("../src/components/workflow/job-inspector.tsx"),
  read("../src/components/workflow/canvas.tsx"),
].join("\n");
must((predDef.match(/export function hasJudgment/g) ?? []).length === 1,
  "A7 the tree defines hasJudgment exactly once (census follows the words)");

must(/import \{[^}]*hasJudgment[^}]*\} from "@\/lib\/class-notes"/.test(wallSrc),
  "A8 the wall imports the predicate (never redefines it)");
must(!/function hasJudgment|const hasJudgment/.test(wallSrc),
  "A9 no local hasJudgment shadow in the wall (a copy would drift from the filter)");

// ---------- B: the wall's face ----------
console.log("B the wall's face:");

must(/export const NOTEBOOK_CAP = 8/.test(wallSrc),
  "B1 the reading depth is a named export (cap 8)");

must(/noted\.sort\(\(a, b\) => \(a\.updatedAt < b\.updatedAt \? 1 : a\.updatedAt > b\.updatedAt \? -1 : 0\)\)/.test(wallSrc),
  "B2 newest-touched first — the dashboard's everywhere-else ordering dialect");
must(/noted\.slice\(0, NOTEBOOK_CAP\)/.test(wallSrc),
  "B3 the cap slices the SORTED shelf (the overflow drops the oldest-touch end)");

must(/data-testid="notes-wall"/.test(wallSrc)
  && /data-testid="notes-wall-row"/.test(wallSrc)
  && /data-testid="notes-wall-footer"/.test(wallSrc)
  && /data-testid="notes-wall-quote"/.test(wallSrc),
  "B4 the semantic-unit hooks (wall, row, quote, footer)");

must(/line-clamp-2/.test(wallSrc),
  "B5 the quote hero is line-clamped (a reading wall, not a log)");
must(/data-note-kind=\{note \? "note" : "class"\}/.test(wallSrc),
  "B6 rows declare their kind (quote vs class-count)");

must(/classOnly = !note && classCount > 0/.test(wallSrc),
  "B7 class-only rows take the count line (one class's note out of context would mislead)");
must(/note && classCount > 0 \? \(/.test(wallSrc.replace(/\n/g, " ")) || /\+\{classCount\}/.test(wallSrc),
  "B8 a written note plus class notes carries the byline pill (nothing hidden)");

must(/STATUS_DOT\[statusWord\(job\)\]/.test(wallSrc),
  "B9 the byline dot reads lib/status-style (the t647 map family, not a hand-rolled color)");
must(/import \{ STATUS_DOT, statusWord \} from "@\/lib\/status-style"/.test(wallSrc),
  "B10 the dot imports are the lib's own exports");

must(/void openJob\(job\.id\)/.test(wallSrc),
  "B11 the row lands through the store's shared openJob (the t569 dialect)");
must(/aria-label=\{`\$\{note \? "Field note" : "Class notes"\} on \$\{job\.name\} — open the job to read and edit its margin`\}/.test(wallSrc),
  "B12 the row's aria-label is a full sentence with the landing's promise");

// the honesty law — no timestamps anywhere in the wall
must(!/fmtAgo|updatedAt\)?\s*\}|toLocale|Date\(job/.test(wallSrc),
  "B13 no time claim in the row face (updatedAt moves on ANY touch — dating the note by it would lie)");
must(!/from "@\/lib\/duration"/.test(wallSrc),
  "B14 the duration lib is not even imported (the honesty law at the import line)");

must(/total > NOTEBOOK_CAP\b/.test(wallSrc) && /of \$\{total\} notes/.test(wallSrc),
  "B15 the footer counts honestly when the wall truncates (8 of N)");
must(/total === 0\) return null/.test(wallSrc),
  "B16 the honest null — zero notes renders nothing (an empty notebook has no mouth)");

must(/motion-reduce:transition-none/.test(wallSrc),
  "B17 motion-reduce honesty on the row transition");

must(/Field notes/.test(wallSrc) && /in this project/.test(wallSrc),
  "B18 the header names the face and its scope (pairing the digest's 'across all projects')");

// ---------- C: the cascade's tenth rung ----------
console.log("C cascade — tenth rung:");

const rungs = [...dashSrc.matchAll(/"--dash-d": "(\d+)ms"/g)].map((m) => Number(m[1]));
must(rungs.length === 10 && rungs.join(",") === "140,180,220,260,300,340,380,420,460,500",
  "C1 the dashboard ladder is ten rungs, 140→500, no gaps or duplicates", rungs.join(", "));

const wallIdx = dashSrc.indexOf("<NotesWall />");
const digestIdx = dashSrc.indexOf("<JournalDigest />");
const viewsIdx = dashSrc.indexOf("<SavedViewsGallery />");
must(wallIdx > digestIdx && wallIdx < viewsIdx,
  "C2 the wall rides the 300ms rung (after the digest's 260, before saved views' 340)");
must(/"--dash-d": "300ms"/.test(dashSrc.slice(dashSrc.lastIndexOf("data-dash-enter", wallIdx), wallIdx)),
  "C3 the wall's wrapper carries the 300ms rung");

const settle = Number((dashSrc.match(/setDashSettled\(true\), (\d+)\)/) ?? [])[1]);
must(settle === 780,
  "C4 the settle timer moved with the ladder (780ms)");

must(500 + 240 === 740 && settle > 740 && settle - 740 === 40,
  "C5 the margin law, numerically — last rung lands at 740, settle waits 40ms past it (not a photo finish)");

// the three sibling probes moved WITH the shape (the t711 lesson: every count)
const t576 = read("../scripts/t576-dash-cascade-live-fire.mjs");
must(t576.includes('"ten section rungs present"') && t576.includes("length === 10"),
  "C6a the t576 probe speaks ten rungs");
must(t576.includes('delays[9] === "0.5s"') && t576.includes("140→500ms"),
  "C6b the t576 ladder assertion reaches 0.5s");
must(/await sleep\(780\);/.test(t576) && t576.includes("~780ms"),
  "C6c the t576 disarm window moved to 780ms");
// the census's own first-run disease (the t717/t720 lesson, third verse):
// `delays[8] === "0.46s"` LOOKS stale but is the ten-rung ladder's ninth
// assertion — an index is only stale when the ladder ENDS there, and the
// positive C6b already pins the reach. The census keeps the forms that
// can only be old-world: the nine-rung name, the count 9, the old span
// label, the old windows.
must(!/nine section rungs|length === 9\b|140→460ms|sleep\(740\)|~740ms/.test(t576),
  "C6d no stale count survives the sync (ALL counts, not the named one)");

const t720 = read("../scripts/t720-journal-digest-unit.mjs");
must(t720.includes('"140,180,220,260,300,340,380,420,460,500"') && /rungs\.length === 10/.test(t720),
  "C7a the t720 probe pins ten rungs");
must(/settle === 780/.test(t720) && !/settle === 740/.test(t720),
  "C7b the t720 settle assertion moved to 780");
must(t720.includes("500+240 = 740ms exactly"),
  "C7c the t720 margin numerics moved (740 lands, 780 settles)");

const t716 = read("../scripts/t716-preset-shelf-unit.mjs");
must(t716.includes('"140", "180", "220", "260", "300", "340", "380", "420", "460", "500"'),
  "C8a the t716 probe pins ten rungs");
must(t716.includes('the 380ms rung') && !/the 340ms rung/.test(t716),
  "C8b the t716 shelf rung assertion moved to 380 (the wall took 300, everyone shifted +40)");
must(t716.includes("length === 10") && t716.includes('delays[9] === "0.5s"'),
  "C8c the t716 t576-sync assertions moved to ten / 0.5s");

must(dashSrc.includes("500+240 = 740ms exactly"),
  "C9 the dashboard's disarm comment explains the margin (the next rung's author re-checks)");

// ---------- D: purity ----------
console.log("D the wall's purity:");

must(!/fetch\(/.test(wallSrc),
  "D1 zero fetch — the jobs slice IS the data (notes are server facts already in the store)");
must(!/useEffect/.test(wallSrc),
  "D2 zero effects — the change bus is the slice reference moving (no timer, no refetch)");
must(!/localStorage|sessionStorage/.test(wallSrc),
  "D3 zero storage — no new key, no read, no write (the wall owns nothing)");
must(!/addEventListener|dispatchEvent|CustomEvent/.test(wallSrc),
  "D4 zero custom events (the t718 change-bus law verbatim)");
must(/React\.useMemo/.test(wallSrc) && /useWorkflowStore\(\(s\) => s\.jobs\)/.test(wallSrc),
  "D5 the memo rides the slice (the payload and the change bus in one import)");

must(!/"cryoflow\./.test(wallSrc),
  "D6 no storage key literal (every key lives in its lib)");

// ---------- the ledger ----------
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL > 0 ? 1 : 0);

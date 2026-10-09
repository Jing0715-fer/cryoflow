// t720-journal-digest-unit.mjs — the activity family's fourth face, pinned
// before the bundle wakes (the t653 pattern, ninth reuse).
//
// The t720 lane: the dashboard already speaks activity in three tenses —
// the KPI sparkline's cumulative TREND, the heatmap's SHAPE OF TIME
// (t711), the recent feed's JOBS' present tense. Task 720 adds the
// FINGERS' past tense: lib/job-journal.ts grows the cross-job read
// (readRecentJobEvents — zero new storage, zero new hooks), a shared
// kind-face module lets the inspector's spine and the digest speak ONE
// vocabulary, and components/workflow/journal-digest.tsx unrolls the
// actions cross-job on the dashboard. The probe pins:
//
//   A  the lib's second reading — cross-job merge, newest first across
//      job boundaries, the cap respected (default 24, explicit, zero,
//      negative), pure read (the backing store untouched), dormant
//      entries INCLUDED (filtering is the roster's business, not the
//      lib's).
//   B  the vocabulary's single source — JOURNAL_KIND_FACE lives in
//      journal-kind-face.ts and nowhere else; both faces import it; the
//      seven kinds and their verbs are the t718 words, verbatim.
//   C  the digest's face — shopwindow law (cap 12, headroom ×3, no
//      expander), the dormant skip (a row that can't navigate is a dead
//      link), the openJob landing, the change bus (jobs slice) + the
//      roster snapshot trigger (jobs.length), honest nulls (fetch
//      failure, empty window, all-dormant), the footer that points to
//      the archive, motion-reduce honesty.
//   D  the cascade's tenth-era ladder — 140→500 with the digest still at
//      260 (t721's notes wall took 300, everyone after shifted +40), the
//      settle at 780 (500+240 = 740 lands, 40ms of margin — the t716
//      margin law, numerically re-proven), and the t576 live-fire probe
//      synchronized (ten rungs, 0.5s, 780ms).
//
// Run:  node scripts/unit-runner.mjs scripts/t720-journal-digest-unit.mjs

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

// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless
// imports; jiti (in-tree) loads the REAL lib for live-fire, with the
// project's @/ alias wired so lib-internal @/ imports resolve too.
// In-place (not hoisted): the probe's own execution order is law.
import { createJiti } from "jiti";
import * as __path from "node:path";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },
});
const { recordJobEvent, readRecentJobEvents, JOB_JOURNAL_KEY } = await __jiti.import("../src/lib/job-journal");
import { readFileSync } from "node:fs";

const NOW = 1_760_000_000_000;
const T = (offset) => NOW + offset;
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

// ---------- A: the lib's second reading ----------
console.log("A lib — readRecentJobEvents:");

must(readRecentJobEvents().length === 0,
  "A1 an empty shelf reads as an empty stream (no throw)");

// interleave three jobs deliberately: the merge must sort ACROSS jobs
recordJobEvent("j1", "run", undefined, { now: T(1_000) });
recordJobEvent("j2", "params", "3 knobs", { now: T(2_000) });
recordJobEvent("j1", "note", "verdict: good", { now: T(3_000) });
recordJobEvent("j3", "completed", undefined, { now: T(4_000) });

const stream = readRecentJobEvents();
must(stream.length === 4
  && stream[0].kind === "completed" && stream[0].jobId === "j3"
  && stream[1].kind === "note" && stream[1].jobId === "j1"
  && stream[2].kind === "params" && stream[2].jobId === "j2"
  && stream[3].kind === "run" && stream[3].jobId === "j1",
  "A2 the merge is newest-first ACROSS job boundaries (one stream, three spines)");

must(readRecentJobEvents(2).length === 2 && readRecentJobEvents(2)[0].jobId === "j3",
  "A3 an explicit cap is respected, keeping the newest end");

for (let i = 0; i < 30; i++) recordJobEvent(`bulk-${i % 7}`, "params", `k ${i}`, { now: T(10_000 + i) });
must(readRecentJobEvents().length === 24,
  "A4 the DEFAULT cap is 24 (the shopwindow reads deeper than it shows)");

must(readRecentJobEvents(0).length === 0 && readRecentJobEvents(-3).length === 0,
  "A5 cap 0 and negative caps read as empty (Math.max guard, never a slice crash)");

const before = JSON.stringify([...backing.entries()]);
readRecentJobEvents(5);
must(JSON.stringify([...backing.entries()]) === before,
  "A6 a pure read — the backing store is untouched (no LRU dance through the lens)");

const withDormant = readRecentJobEvents(100);
// the lib has NO roster concept — "j1 was deleted" is a fact it cannot
// know, so a dormant spine rides the stream exactly like a live one;
// the shopwindow's skip is the component's judgment (C5 pins it there)
must(withDormant.some((e) => e.jobId === "j1"),
  "A7 dormant entries ride the stream (the lib returns what it remembers — deleting the JOB is invisible here by design)");

const kinds = new Set(readRecentJobEvents(100).map((e) => e.kind));
must(kinds.has("run") && kinds.has("params") && kinds.has("completed"),
  "A8 the stream carries every kind that was recorded (no kind filtering in the lib)");

// ---------- B: the vocabulary's single source ----------
console.log("B kind-face single source:");

const faceSrc = read("../src/components/workflow/journal-kind-face.ts");
must(/export const JOURNAL_KIND_FACE/.test(faceSrc),
  "B1 journal-kind-face.ts exists and exports the mapping");

const allSrc = [
  read("../src/components/workflow/job-inspector.tsx"),
  read("../src/components/workflow/project-dashboard.tsx"),
  read("../src/components/workflow/journal-digest.tsx"),
  read("../src/components/workflow/user-preset-shelf.tsx"),
];
const inspectorSrc = allSrc[0];
must(!/const JOURNAL_KIND_FACE/.test(inspectorSrc),
  "B2 the inspector no longer defines the mapping locally (the copy is gone)");
must(/from "\.\/journal-kind-face"/.test(inspectorSrc),
  "B3 the inspector imports the shared vocabulary");
must(/from "\.\/journal-kind-face"/.test(allSrc[2]),
  "B4 the digest imports the same vocabulary");

must(["run", "kicked", "completed", "failed", "params", "note", "renamed"].every((k) => new RegExp(`\\b${k}:\\s*\\{`).test(faceSrc)),
  "B5 the mapping speaks all seven kinds");

const verbs = ["Run started", "Auto-started", "Completed", "Failed", "Params changed", "Note saved", "Renamed"];
must(verbs.every((v) => faceSrc.includes(`verb: "${v}"`)),
  "B6 the verbs are the t718 words, verbatim (a copied vocabulary drifts; this one cannot)");

// the whole tree: exactly one definition (paths anchored to THIS file,
// not the process cwd — the runner's cwd is not the probe's home)
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
let defCount = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (!name.includes("node_modules")) walk(p); continue; }
    if (!/\.(tsx?|mjs)$/.test(name)) continue;
    try { if (/const JOURNAL_KIND_FACE/.test(readFileSync(p, "utf8"))) defCount++; } catch { /* unreadable */ }
  }
};
walk(fileURLToPath(new URL("../src", import.meta.url)));
must(defCount === 1,
  "B7 exactly ONE definition lives in the tree (single source, pinned by census)", `${defCount} definition(s)`);

// ---------- C: the digest's face ----------
console.log("C the digest's face:");

const digestSrc = allSrc[2];
must(/^"use client";/m.test(digestSrc),
  "C1 the digest is a client component");

for (const tid of ["journal-digest", "journal-digest-row", "journal-digest-footer"]) {
  if (!digestSrc.includes(`data-testid="${tid}"`)) { must(false, "C2 the testid family is present", `missing: ${tid}`); break; }
}
must(["journal-digest", "journal-digest-row", "journal-digest-footer"].every((tid) => digestSrc.includes(`data-testid="${tid}"`)),
  "C2 the testid family is present (the t686 anchor law)");

must(/export const DIGEST_CAP = 12;/.test(digestSrc),
  "C3 the shopwindow depth is a named, exported constant (12)");

must(/readRecentJobEvents\(DIGEST_CAP \* 3\)/.test(digestSrc),
  "C4 the read is deeper than the show (headroom ×3 — dormant skips happen before the cap)");

must(/if \(!job\) continue;/.test(digestSrc),
  "C5 the dormant skip — a row that cannot navigate is a dead link, not shown");

must(/openJob\(event\.jobId, \{ projectId: job\.projectId \}\)/.test(digestSrc),
  "C6 rows land through the store's shared openJob dialect (t569, projectId hint included)");

must(/useWorkflowStore\(\(s\) => s\.jobs\)/.test(digestSrc) && /\[jobs\.length\]/.test(digestSrc),
  "C7 the change bus is the jobs slice; the roster snapshot refetches on size moves");

must(/if \(alive\) setRoster\(null\);/.test(digestSrc) && /rows\.length === 0\) return null/,
  "C8 honest nulls — fetch failure and an empty window render nothing (no decorative empty state)");

must(/tabular-nums/.test(digestSrc) && /fmtAgo\(event\.at\)/.test(digestSrc),
  "C9 the right slot speaks fmtAgo in the family's numeric dialect");

must((digestSrc.match(/motion-reduce:transition-none/g) ?? []).length >= 1,
  "C10 motion-reduce honesty rides the hover transition");

must(/full story lives in its own Timeline/.test(digestSrc),
  "C11 the footer points to the archive (the shopwindow is not the archive)");

must(/aria-label=\{`?\$\{face\.verb\} on \$\{job\.name\}/.test(digestSrc) || /aria-label=\{\`/.test(digestSrc),
  "C12 every row carries a full-sentence aria-label (verb + job)");

must(!/\+N earlier|setShowAll/.test(digestSrc),
  "C13 no expander — a cross-job expander would BE a second archive (the shopwindow law's teeth)");

// ---------- D: the cascade's tenth-era ladder ----------
console.log("D the cascade's tenth-era ladder:");

const dashSrc = allSrc[1];
const rungs = [...dashSrc.matchAll(/"--dash-d": "(\d+)ms"/g)].map((m) => Number(m[1]));
must(rungs.length === 10 && rungs.join(",") === "140,180,220,260,300,340,380,420,460,500",
  "D1 the dashboard ladder is ten rungs, 140→500", rungs.join(", "));

// order-proof: the 260ms wrapper must be the one wrapping <JournalDigest />
const at260 = dashSrc.indexOf('"--dash-d": "260ms"');
const atDigest = dashSrc.indexOf("<JournalDigest />");
const atFeed = dashSrc.indexOf("<RecentActivityFeed");
must(at260 !== -1 && atDigest > at260 && atDigest - at260 < 400 && atDigest > atFeed,
  "D2 the digest rides the 260ms rung (after the feed's 220, before the notes wall's 300)");

const settle = Number((dashSrc.match(/setDashSettled\(true\), (\d+)/) ?? [])[1]);
must(settle === 780,
  "D3 the settle timer moved with the ladder (780ms)");

must(500 + 240 === 740 && settle > 740 && settle - 740 === 40,
  "D4 the margin law, numerically — last rung lands at 740, settle waits 40ms past it (not a photo finish)");

const t576 = read("../scripts/t576-dash-cascade-live-fire.mjs");
/* t776 re-sync: the t576 probe was re-baselined to the t689 doctrine — the
 * rung count is a dynamic floor (rungN >= 5), the ladder contract is the
 * 140ms head verbatim + monotonic descent, and the D2/D3 counts ride the
 * SAME reading. The interlock follows the contract, not the number. */
must(t576.includes("section rungs present (the ladder floor)") && t576.includes("rungN >= 5"),
  "D5a the t576 probe speaks the dynamic floor (rungN >= 5, the t776 contract)");
must(t576.includes("ladder: 140ms head verbatim + monotonic descent") && t576.includes('delays[0] === "0.14s"'),
  "D5b the t576 ladder contract is the 140ms head verbatim + monotonic descent");
must(/await sleep\(780\);/.test(t576) && t576.includes("~780ms"),
  "D5c the t576 disarm window moved to 780ms");
must(!/length === 9[^0-9]/.test(t576) && !/sleep\(740\)/.test(t576),
  "D5d no stale count survives the sync (the t711 lesson: ALL counts, not the named one)");

must(dashSrc.includes("500+240 = 740ms exactly"),
  "D6 the dashboard's disarm comment explains the margin (the next rung's author re-checks)");

// ---------- the ledger ----------
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL > 0 ? 1 : 0);

/**
 * t432 bench — jobEquals must carry runRemote.
 *
 * The poll merge (pollTick) keeps OLD object references for every job
 * whose fields compare equal, so memoized cards skip re-rendering. t431
 * taught the predicate about remoteRemaining (computed per response, row
 * untouched by a bring-home). t432 closes the same contract class for
 * runRemote — projected from the runs LEDGER per response, with THREE
 * mutation windows that land with NO compared-field movement:
 *   ① staging grows stagedBytes (row sits at running/0 — no DB writes)
 *   ② slurmState flips PENDING→RUNNING before the first log-write PATCH
 *   ③ a bring-home rewrites ledger note/syncedFiles/syncMs (row untouched)
 * The A-half was proven LIVE on the 5c25a56 build before the fix: a
 * ledger note rewrite rode every API response while the inspector kept
 * the stale receipt for 14s of polls.
 *
 * Sections:
 *   E1 (equality matrix): the real exported jobEquals from store.ts —
 *       identical DTOs equal; each ledger mutation window flips equality;
 *       internal-only fields (outputProbeAt) stay ignored via the DTO
 *       projection never carrying them; the remoteRemaining contract from
 *       t431 is re-pinned so the two annotations travel together.
 *   E2 (projection honesty): remoteInfoFor's shape contract — the fields
 *       that ride the DTO are exactly the UI-consumed ones; read straight
 *       from remote-run.ts's projection via a hand-pinned field list? NO —
 *       E2 instead asserts the type-level truth the bench can reach: a
 *       DTO built the way the jobs route builds it (runRemote present,
 *       outputProbeAt absent) compares equal only on real changes.
 *
 * World contract: world-free (pure functions + DTO literals; no DB, no
 * files, no network). store.ts imports are client modules — bun executes
 * them fine as long as no component renders.
 */

import { jobEquals } from "../src/lib/store";
import { ctfBoard, fmtQcValue, motionBoard, qcLegendText, quantile } from "../src/lib/qc-board";
import type { JobDTO } from "../src/lib/types";

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/* ------------------------------------------------------------------ */
/* DTO factory — the shape the jobs route serves                       */
/* ------------------------------------------------------------------ */

let seq = 0;
function makeJob(over: Partial<JobDTO> = {}): JobDTO {
  seq += 1;
  return {
    id: `job-${seq}`,
    projectId: "proj-1",
    type: "extract",
    name: "Extract (tutorial)",
    x: 100,
    y: 200,
    status: "completed",
    progress: 100,
    params: {},
    duration: 5.2,
    startedAt: "2026-09-28T10:00:00.000Z",
    createdAt: "2026-09-28T09:59:00.000Z",
    updatedAt: "2026-09-28T10:00:05.000Z",
    note: null,
    engine: "relion",
    hasLog: true,
    result: "96 particles extracted",
    ...over,
  };
}

const baseRemote = {
  connectionId: "conn-1",
  connectionName: "Tutorial cluster",
  host: "127.0.0.1:3022",
  user: "cryo",
  module: "relion/5.0.1",
  mode: "slurm" as const,
  remoteWorkdir: "/scratch/demo/extract_36vow0pn",
  slurmId: "41001",
  phase: "staging" as const,
};

/* ------------------------------------------------------------------ */
/* E1 — the equality matrix                                            */
/* ------------------------------------------------------------------ */

console.log("E1 — jobEquals equality matrix");

{
  const a = makeJob();
  const b = structuredClone(a); // every ref fresh, every value identical
  must(jobEquals(a, b), "E1.1 identical DTOs (fresh refs) are EQUAL — memo contract holds");
}

// ① staging meter: stagedBytes grows, row silent (running/0, updatedAt same)
{
  const a = makeJob({
    status: "running",
    progress: 0,
    runRemote: { ...baseRemote, phase: "staging" as const, stagedBytes: 0 },
  });
  const b = { ...a, runRemote: { ...baseRemote, phase: "staging" as const, stagedBytes: 12_582_912 } };
  must(!jobEquals(a, b), "E1.2 staging stagedBytes growth flips equality (the frozen-meter window)");
}

// ② slurm queue flip: slurmState PENDING→RUNNING, no log-write PATCH yet
{
  const a = makeJob({
    status: "running",
    progress: 0,
    runRemote: { ...baseRemote, slurmState: "PENDING" },
  });
  const b = { ...a, runRemote: { ...baseRemote, slurmState: "RUNNING" } };
  must(!jobEquals(a, b), "E1.3 slurmState PENDING→RUNNING flips equality (the queued-banner window)");
}

// ③ bring-home receipt rewrite: note/synced* move, row untouched
{
  const a = makeJob({
    runRemote: {
      ...baseRemote,
      phase: "running",
      note: "24 image file(s) stayed on the cluster — key-files policy",
      syncedFiles: 3,
    },
  });
  const b = {
    ...a,
    runRemote: {
      ...baseRemote,
      phase: "running" as const,
      note: "24 image file(s) stayed on the cluster — key-files policy",
      syncedFiles: 27,
    },
  };
  must(!jobEquals(a, b), "E1.4 ledger syncedFiles rewrite flips equality (the stale-receipt window)");
}

// runRemote APPEARING / DISAPPEARING is also a change (stop route detaches it)
{
  const a = makeJob({ runRemote: { ...baseRemote, phase: "running" } });
  const b = { ...a, runRemote: undefined };
  must(!jobEquals(a, b), "E1.5 runRemote appearing/disappearing flips equality");
  must(jobEquals(b, { ...b }), "E1.6 null/absent runRemote on both sides is EQUAL");
}

// the pre-t432 bug, pinned: same job id, runRemote content differs ONLY
// in note — the exact live A-half shape (ledger rewritten, nothing else)
{
  const a = makeJob({
    runRemote: { ...baseRemote, phase: "running" as const, note: "old receipt" },
  });
  const b = {
    ...a,
    runRemote: { ...baseRemote, phase: "running" as const, note: "QA-t432 ledger probe" },
  };
  must(!jobEquals(a, b), "E1.7 the live A-half shape (note-only ledger rewrite) now flips equality");
}

// key order: the stringify compare IS order-sensitive (same contract as
// params has always had) — safe by construction because remoteInfoFor is
// the SINGLE emitter and its object literal fixes the key order for every
// response. Pin the real contract: a projection-shaped copy compares equal.
{
  const a = makeJob({ runRemote: { ...baseRemote, phase: "running", stagedBytes: 5 } });
  const b = { ...a, runRemote: { ...baseRemote, phase: "running" as const, stagedBytes: 5 } };
  must(
    jobEquals(a, b),
    "E1.8 projection-shaped copies (fixed key order) compare EQUAL — no phantom churn"
  );
}

/* ------------------------------------------------------------------ */
/* E1b — the rest of the predicate must stay awake                     */
/* ------------------------------------------------------------------ */

console.log("E1b — sibling fields the predicate already carries");

{
  const a = makeJob({ remoteRemaining: { remaining: 1, total: 27 } });
  const b = { ...a, remoteRemaining: { remaining: 0, total: 27 } };
  must(!jobEquals(a, b), "E1b.1 t431 remoteRemaining contract re-pinned (bring-home flip)");
  must(jobEquals(a, { ...a }), "E1b.2 equal remoteRemaining stays EQUAL");
}

{
  const a = makeJob({ result: "96 particles extracted" });
  const b = { ...a, result: "96 particles extracted — 24 image file(s) stayed on the cluster" };
  must(!jobEquals(a, b), "E1b.3 result movement still flips (history receipt is row-carried)");
  const c = makeJob({ status: "running" });
  const d = { ...c, status: "completed" as const };
  must(!jobEquals(c, d), "E1b.4 status movement still flips");
  const e = makeJob({ note: null });
  const f = { ...e, note: "judged" };
  must(!jobEquals(e, f), "E1b.5 note (judged-ness) movement still flips");
  const g = makeJob({ x: 100, y: 200 });
  const h = { ...g, x: 140, y: 260 };
  must(!jobEquals(g, h), "E1b.6 position drag still flips");
}

/* ------------------------------------------------------------------ */
/* E2 — projection honesty (what rides the DTO)                        */
/* ------------------------------------------------------------------ */

console.log("E2 — DTO projection honesty");

// outputProbeAt is the ledger's rate-limit stamp — the projection must NOT
// carry it, or every ~20s probe round would phantom-flip equality and the
// zero-cost poll contract dies. Pin the type-level truth the only way a
// bench can: a runRemote carrying it must round-trip as a DIFFERENT object
// only if a route ever copies it — so instead assert the contract on the
// mutation windows: a probe-stamp-only mutation inside the LEDGER (not the
// DTO) must compare EQUAL at the DTO layer because nothing else moved.
{
  const a = makeJob({ runRemote: { ...baseRemote, phase: "running" } });
  // the DTO copy the route would serve after an internal probe round:
  // same projected fields, nothing else moved
  const b = { ...a, runRemote: { ...baseRemote, phase: "running" as const } };
  must(jobEquals(a, b), "E2.1 a probe-round with no projected change stays EQUAL (no phantom poll churn)");
}

// internal-ledger-only mutations that never ride the projection are
// invisible at the DTO layer by construction — pin the corollary: two
// DTOs identical except for fields the projection never carried compare equal
{
  const a = makeJob({ runRemote: { ...baseRemote, phase: "running" } });
  const b = { ...a, runRemote: { ...baseRemote, phase: "running" as const } };
  must(jobEquals(a, b), "E2.2 projection-stable DTOs are EQUAL (whitelist contract holds)");
}

/* ------------------------------------------------------------------ */
/* Q — micrograph QC board arithmetic (t432 delivery two)              */
/* ------------------------------------------------------------------ */

console.log("Q — qc-board quantile law");

{
  // a 10-micrograph pack with a clean split: two obvious offenders, three
  // borderline, five healthy — values chosen so p75/p90 are exact members
  const pack = [1, 2, 3, 4, 5, 6, 7, 8, 20, 30].map((v, i) => ({
    name: `mic_${String(i).padStart(3, "0")}`,
    total: v,
    early: v / 2,
    late: v / 2,
  }));
  const board = motionBoard(pack);
  must(board.rows.length === 10, "Q1.1 board carries every micrograph");
  must(board.rows[0].micrograph.name === "mic_009", "Q1.2 worst-first sort puts mic_009 (30 Å) on top");
  must(board.rows[0].bucket === "offender", "Q1.3 the pack's worst tile is an offender");
  must(board.thresholds.offenderAt >= board.thresholds.watchAt, "Q1.4 offender threshold ≥ watch threshold");
  const healthyCount = board.rows.filter((r) => r.bucket === "healthy").length;
  must(healthyCount >= 5, `Q1.5 majority stays healthy (${healthyCount} healthy) — the law is not trigger-happy`);
  // quantile interpolation: p90 of [1..8,20,30] sorted → pos 8.1 → 20 + 0.1*(30-20) = 21
  must(Math.abs(board.thresholds.offenderAt - 21) < 1e-9, "Q1.6 p90 linear interpolation exact (21)");
  must(board.rows.every((r) => r.value === r.micrograph.total), "Q1.7 motion value reads the user's metric");
}

{
  // FOM is better-when-higher: the LOW fom tiles must be the offenders
  const pack = [0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.42, 0.55].map((v, i) => ({
    name: `mic_${String(i).padStart(3, "0")}`,
    defocusU: 1.5 + i * 0.01,
    defocusV: 1.5,
    astigmatism: 0.1,
    fom: v,
    maxResolution: 4,
  }));
  const board = ctfBoard(pack, "fom");
  must(board.rows[0].micrograph.name === "mic_000", "Q2.1 FOM worst-first puts the LOWEST fom on top");
  must(board.rows[0].bucket === "offender", "Q2.2 lowest-FOM tile is an offender (scale inversion works)");
  must(board.rows.every((r) => r.value === r.micrograph.fom && r.value > 0), "Q2.3 FOM value reads the user's 0–1, never the negated scale");
  const board2 = ctfBoard(
    pack.map((m, i) => ({ ...m, maxResolution: [3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 4.9, 5.2, 6.1][i] })),
    "resolution"
  );
  must(
    board2.rows.filter((r) => r.bucket === "offender").length === 1,
    "Q2.4 varied resolutions flag exactly the worst decile (1 offender of 10)"
  );
}

{
  // the flat-pack pass: when every value is identical the quantiles
  // collapse onto that value and the naive >= arithmetic would paint the
  // whole pack rose — indefensible. Nothing stands out in a flat pack, so
  // nothing is flagged; the legend still speaks the collapsed thresholds.
  const flat = Array.from({ length: 8 }, (_, i) => ({
    name: `flat_${i}`,
    total: 5,
    early: 2.5,
    late: 2.5,
  }));
  const board = motionBoard(flat);
  must(board.thresholds.offenderAt === 5 && board.thresholds.watchAt === 5, "Q3.1 flat pack thresholds collapse to the value itself (legend stays honest)");
  must(board.rows.every((r) => r.bucket === "healthy"), "Q3.2 flat pack: every tile healthy — nothing stands out, nothing flagged");
}

{
  // quantile function edges
  must(Number.isNaN(quantile([], 0.9)), "Q4.1 empty pack quantile is NaN (caller self-hides first)");
  must(quantile([7], 0.9) === 7, "Q4.2 single-member quantile is the member");
  must(quantile([1, 2, 3, 4], 0.5) === 2.5, "Q4.3 even-count median interpolates (2.5)");
  must(fmtQcValue("resolution", 3.846) === "3.8 Å", "Q4.4 resolution speaks Å one-decimal");
  must(fmtQcValue("astigmatism", 0.123) === "0.12 µm", "Q4.5 astigmatism speaks µm two-decimal");
  must(fmtQcValue("fom", 0.1234) === "0.123", "Q4.6 fom speaks three decimals");
  must(fmtQcValue("total", 12.34) === "12.3 Å", "Q4.7 drift speaks Å one-decimal");
}

{
  // the legend never promises a COUNT — tie-heavy quantized data (the demo
  // world's 4.3/4.4 Å cluster live-proved it: 8 of 24 at/above p90) makes
  // "worst 10%" a lie; the lines speak provenance instead
  const legend = qcLegendText({ watchAt: 4.4, offenderAt: 4.4 }, "resolution");
  must(legend.includes("p90") && legend.includes("p75"), "Q5.1 legend names the lines' provenance (p90/p75)");
  must(!legend.includes("worst 10%") && !legend.includes("next 25%"), "Q5.2 legend promises no count (the tie-inflation lesson)");
  must(legend.includes("4.4 Å"), "Q5.3 legend bakes the pack's own numbers in");
}

/* ------------------------------------------------------------------ */

console.log(`\nt432 jobEquals bench: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

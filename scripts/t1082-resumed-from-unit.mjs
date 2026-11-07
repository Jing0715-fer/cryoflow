#!/usr/bin/env node
/**
 * t1082 — THE RESUME RECEIPT unit (node-only, source-wiring): the honest
 * bookkeeping debt the t1081 walk recorded, now CLOSED at all three layers.
 *
 * THE DEBT (t1081's Act 3, named on the record): the resume's dispatch-level
 * --continue was proven by the record's cmd, but the record itself DROPPED
 * the iteration — spawnTrackedRun's resumedFrom param flowed only into the
 * RunOutcome return value (a shape nobody consumed), never into the
 * RunRecord. The exit handler's finalize spread ({ ...rec, ... }) preserves
 * whatever the record already holds, so the honest cure is to write the
 * field at SPAWN time — one conditional spread — and every later finalize
 * carries it for free.
 *
 * THE THREE LAYERS THIS UNIT PINS:
 *   F  the engine fix at source: RunRecord declares resumedFrom (with the
 *      doc naming the finalize-spread mechanism), spawnTrackedRun's record
 *      literal writes it conditionally, the resume caller passes the
 *      iteration, the fresh caller passes undefined, the exit handler's
 *      finalize spread is the carrier, and RunOutcome keeps the field (the
 *      dispatch response's shape is unchanged).
 *   W  the wiring: the log route's local response exposes
 *      resumedFrom (null for fresh runs — the honest zero), and the
 *      inspector's Log console reads it into state, resets it on a job
 *      switch (another run's receipt never survives a switch), and renders
 *      the toolbar chip (data-log-resumed) whose tooltip names the exact
 *      --continue target.
 *   R  the receipts: the t1081 walk's Act 3 check ("the record carries
 *      resumedFrom") still reads exactly this field — the walk's next ride
 *      (this window) turns that check green with NO walk edit.
 *
 * t1083 GROWTH — the receipt's SIBLING: the CLUSTER lane speaks too. The
 * remote record now carries the same resumedFrom (parseResumeIteration
 * reads it off the FINAL argv — post-relativize t537, post-MPI-wrap —
 * so the "Continue from here:" picker's self-round and any
 * pipeliner-dialect continue both speak), BOTH remote spawn faces
 * (slurm + direct) write it conditionally, the remote finalize spread
 * carries it into the completed row, and the log route's remote branch
 * exposes it — the chip reads it with ZERO UI change. The growth also
 * cures the unit's own t1082-era defect: W2b's remoteBlock slice bounds
 * produced an EMPTY slice (the remote branch's own raw-format if
 * precedes the 'remote: true,' anchor), so the old negation was
 * vacuously green — a verify that could not fail. The bounds are fixed
 * and the negation becomes the assertion it always should have been.
 *
 * PROTOCOL: node-only, read-only toward the tree (no server, no db, no
 * spawn) — pure source assertions, exit honest.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const engine = read("src/lib/relion/engine.ts");
const logRoute = read("src/app/api/jobs/[id]/log/route.ts");
const inspector = read("src/components/workflow/job-inspector.tsx");
const walk = read("scripts/t1081-interrupt-door-walk.mjs");
const remoteRun = read("src/lib/remote/remote-run.ts");

/* ---------- F — the engine fix at source ---------- */

// F1: the RunRecord interface declares the field (typed, optional).
const ifaceBlock = engine.slice(
  engine.indexOf("export interface RunRecord {"),
  engine.indexOf("export interface EngineJobRef")
);
ok("F1: RunRecord declares resumedFrom?: number", /resumedFrom\?: number;/.test(ifaceBlock));

// F2: the field's doc names the mechanism (the finalize spread carries it).
ok(
  "F2: the RunRecord doc names the exit-handler spread as the carrier",
  /finalizes?\s+with\s+\{\s*\.\.\.rec|finalize spread/.test(ifaceBlock),
  ifaceBlock.slice(-200)
);

// F3: the record literal writes the field conditionally — INSIDE the
// spawnTrackedRun record (between the literal's opening and upsertRun).
const recordStart = engine.indexOf("const record: RunRecord = {");
const recordEnd = engine.indexOf("upsertRun(job.id, record);", recordStart);
ok("F3: the spawn record literal exists", recordStart > 0 && recordEnd > recordStart);
const recordLit = engine.slice(recordStart, recordEnd);
ok(
  "F3b: the record literal spreads resumedFrom conditionally",
  recordLit.includes("...(resumedFrom != null ? { resumedFrom } : {}),"),
  recordLit.slice(-300)
);
ok(
  "F3c: the spread sits AFTER exitCode (the literal's last base field)",
  /exitCode: null,\s*\n\s*\/\/ t1082[\s\S]*?\.\.\.\(resumedFrom != null \? \{ resumedFrom \} : \{\}\),/.test(recordLit),
  recordLit.slice(-400)
);
ok(
  "F3d: the record comment names the t1081 gap (the honest-bookkeeping receipt)",
  recordLit.includes("t1081") && recordLit.includes("dropped the iteration"),
  "the comment is the receipt, not decoration"
);

// F4: the resume caller passes the checkpoint iteration.
ok(
  "F4: the resume caller passes resumableCheckpoint.iteration",
  /spawnTrackedRun\(\s*job,\s*resumeArgv,\s*workdir,\s*binDir,\s*resumableCheckpoint\.iteration,\s*bridge\s*\)/.test(engine)
);

// F5: the fresh caller passes undefined (the honest zero).
ok(
  "F5: the fresh caller passes undefined",
  /spawnTrackedRun\(\s*job,\s*argv,\s*workdir,\s*binDir,\s*undefined,\s*bridge/.test(engine)
);

// F6: the exit handler's finalize spread is the carrier (its shape unchanged —
// the fix rides it, it was never edited).
const finalizeIdx = engine.indexOf("updateRun(job.id, (rec) =>\n        rec.startedAt === startedAt ? { ...rec, done: true, exitCode, outputs, result } : null");
ok("F6: the exit handler's finalize spread stands untouched", finalizeIdx > 0);

// F7: RunOutcome keeps the field (the dispatch response's shape unchanged).
const outcomeBlock = engine.slice(
  engine.indexOf("export interface RunOutcome {"),
  engine.indexOf("/** Live child processes")
);
ok("F7: RunOutcome keeps resumedFrom (the response shape unchanged)", /resumedFrom\?: number;/.test(outcomeBlock));

/* ---------- W — the wiring ---------- */

// W1: the log route's local response exposes the receipt.
ok(
  "W1: the log route's local branch exposes resumedFrom (null for fresh runs)",
  logRoute.includes("resumedFrom: rec?.resumedFrom ?? null,")
);
// W2: the field line's count and the remote response block's face.
// t1082: the line appeared once, local branch only (remote records carried
// RemoteRunState, not the receipt). t1083's growth: the line appears
// exactly twice — the local branch AND the remote branch — and the remote
// block ASSERTS the field (the old vacuous negation, below, is the flip's
// story). The field line itself spells resumedFrom twice
// (`resumedFrom: rec?.resumedFrom ?? null`) — the assertion pins the LINE,
// not the token count.
const fieldLine = "resumedFrom: rec?.resumedFrom ?? null,";
const fieldLineCount = (logRoute.match(new RegExp(fieldLine.replace(/[?]/g, "\\$&"), "g")) || []).length;
// t1083 — the bounds cure: the FIRST 'format === raw' if in this file sits
// INSIDE the remote branch (its own raw download), before the
// 'remote: true,' anchor — the old slice was empty and W2b's negation was
// vacuously green. Anchor the block at 'remote: true,' and end it at the
// NEXT raw-if AFTER that anchor (the local branch's), so the block is the
// remote branch's actual JSON response.
const remoteStart = logRoute.indexOf('remote: true,');
const remoteBlock = logRoute.slice(
  remoteStart,
  logRoute.indexOf('if (url.searchParams.get("format") === "raw")', remoteStart)
);
ok(
  "W2: the route's field line appears exactly twice (local + remote branches)",
  fieldLineCount === 2,
  `count=${fieldLineCount}`
);
ok(
  "W2b: the remote response block exposes the receipt too (the t1083 flip)",
  remoteBlock.includes("resumedFrom:"),
  remoteBlock.slice(0, 160)
);
// W3: the route's comment names the t1082 law.
ok("W3: the route's receipt comment names t1082", logRoute.includes("t1082"));

// W4: the inspector's fetch body type carries the field.
ok(
  "W4: the inspector's log body type carries resumedFrom",
  inspector.includes("resumedFrom?: number | null;")
);
// W5: the inspector commits it with the text.
ok(
  "W5: the inspector commits the receipt with the text",
  inspector.includes("setResumedFrom(body.resumedFrom ?? null);")
);
// W6: the job switch resets it (another run's receipt never survives).
ok(
  "W6: the job switch resets the receipt",
  inspector.includes("setResumedFrom(null); // t1082")
);
// W7: the toolbar chip renders with its data seat.
ok("W7: the toolbar chip carries data-log-resumed", inspector.includes('data-log-resumed=""'));
// W8: the chip's text speaks the receipt.
ok(
  "W8: the chip's text is 'resumed from it {N}'",
  /resumed from it \{resumedFrom\}/.test(inspector)
);
// W9: the chip's tooltip names the exact --continue target (the walk's Act 3
// receipt grammar: run_itNNN_optimiser.star, zero-padded).
ok(
  "W9: the tooltip names the checkpoint contract (--continue run_itNNN_optimiser.star)",
  /--continue run_it\$\{String\(resumedFrom\)\.padStart\(3, "0"\)\}_optimiser\.star/.test(inspector)
);
// W10: the chip only speaks when the contract continued (null-gated).
ok(
  "W10: the chip is null-gated (fresh runs stay silent)",
  /\{resumedFrom != null \? \(/.test(inspector)
);

/* ---------- R — the receipts ---------- */

// R1: the t1081 walk's Act 3 check reads exactly this field — the fix serves
// the standing receipt, no walk edit needed.
ok(
  "R1: the walk's Act 3 receipt check still reads recAfter.resumedFrom",
  walk.includes('must(recAfter != null && recAfter.resumedFrom != null, "Act 3: the record carries resumedFrom')
);
// R2: the census seats this unit (the ledger entry exists).
const census = read("scripts/t927-census.sh");
ok(
  "R2: the census ledger seats t1082-resumed-from-unit",
  census.includes("t1082-resumed-from-unit")
);

/* ---------- RM — the receipt's sibling (t1083, the cluster lane) ---------- */

// RM1: the parser is exported from the remote module.
const parserIdx = remoteRun.indexOf("export function parseResumeIteration(");
ok("RM1: parseResumeIteration is exported from remote-run.ts", parserIdx > 0);
// RM2: the parser's grammar is RELION's own checkpoint name, and it scans
// for the --continue flag before the target.
const parserBody = remoteRun.slice(parserIdx, parserIdx + 900);
ok(
  "RM2: the parser reads --continue then run_itNNN_optimiser.star (RELION's own name)",
  parserBody.includes('argv[i] !== "--continue"') &&
    parserBody.includes("run_it(\\d+)_optimiser\\.star$")
);
// RM3: the dispatch parses the receipt from the FINAL argv (the const sits
// after the command build — post-relativize t537, post-MPI-wrap).
ok(
  "RM3: startRemoteJob parses the receipt from the final argv",
  remoteRun.includes("const resumeIter = parseResumeIteration(argv);")
);
// RM4: BOTH remote spawn faces write the receipt (slurm + direct).
const spread = "...(resumeIter != null ? { resumedFrom: resumeIter } : {}),";
const spreadCount = remoteRun.split(spread).length - 1;
ok("RM4: both remote spawn faces write the receipt (slurm + direct)", spreadCount === 2, `count=${spreadCount}`);
// RM5: the faces are ordered slurm-then-direct, with the slurm write's own
// PENDING state between them (the receipts ride the two real write sites,
// not a copy-paste into a comment).
const sp1 = remoteRun.indexOf(spread);
const sp2 = remoteRun.indexOf(spread, sp1 + 1);
const slurmStateIdx = remoteRun.indexOf('slurmState: "PENDING"');
ok(
  "RM5: the receipts ride the real write sites (slurm first, PENDING between, direct after)",
  sp1 > 0 && sp2 > sp1 && slurmStateIdx > sp1 && slurmStateIdx < sp2,
  `sp1=${sp1} slurm=${slurmStateIdx} sp2=${sp2}`
);
// RM6: the remote finalize spreads ...cur (the receipt survives into the
// completed row — the same carrier mechanism the local exit handler uses).
const finIdx = remoteRun.indexOf("exitCode: stampKept ? cur.exitCode : exitCode,");
const finBlock = remoteRun.slice(Math.max(0, finIdx - 200), finIdx + 200);
ok(
  "RM6: the remote finalize spreads the record (the receipt survives into the completed row)",
  finIdx > 0 && finBlock.includes("...cur,"),
  finBlock.slice(0, 160)
);

console.log(`\n===== t1082 resumed-from unit: ${pass}/${pass + fail} green =====`);
process.exit(fail === 0 ? 0 : 1);

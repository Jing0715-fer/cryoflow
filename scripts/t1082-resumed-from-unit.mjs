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
// W2: the field line appears exactly once and the REMOTE response block
// stays untouched (remote records carry RemoteRunState, not the local
// receipt). The field line itself spells resumedFrom twice
// (`resumedFrom: rec?.resumedFrom ?? null`) — the assertion pins the LINE,
// not the token count.
const fieldLine = "resumedFrom: rec?.resumedFrom ?? null,";
const fieldLineCount = (logRoute.match(new RegExp(fieldLine.replace(/[?]/g, "\\$&"), "g")) || []).length;
const remoteBlock = logRoute.slice(
  logRoute.indexOf('remote: true,'),
  logRoute.indexOf("if (url.searchParams.get(\"format\") === \"raw\")")
);
ok("W2: the route's field line appears exactly once", fieldLineCount === 1, `count=${fieldLineCount}`);
ok(
  "W2b: the remote response block carries no receipt field",
  !remoteBlock.includes("resumedFrom:"),
  remoteBlock.slice(0, 120)
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

console.log(`\n===== t1082 resumed-from unit: ${pass}/${pass + fail} green =====`);
process.exit(fail === 0 ? 0 : 1);

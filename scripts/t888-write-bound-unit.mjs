// t888 — THE WRITE-BOUND UNIT: the t886 audit receipt's named observations
// cured at the source. The tier-2 walk (13 CRUD doors) recorded three
// "observations, not defects" — this seat turns them into pins so the
// next window's drift flaps here instead of living quietly:
//
//   observation #1 — classStarSelection.classes bounded each VALUE
//     (1..10000) but not the ARRAY's length → the 500-entry family bound.
//   observation #2 — the gallery birth's job.create + edge.create were
//     two separate writes (a crash window left an edge-less consumer) →
//     ONE $transaction (duplicate's exemplar idiom).
//   observation #3 — jobs/layout accepted an UNCAPPED updates array into
//     an unbounded Promise.all → the restore door's 1–500 bound, and the
//     client's tidy writer chunks under it (400-row chunks, in order).
//
// The method (t880's, continued): bare node, source pins, comments
// stripped so prose mentions never count as code. The family anchors
// (restore's bound, duplicate's transaction) are pinned alongside —
// a law is only a law while its exemplars still stand.
//
// node scripts/t888-write-bound-unit.mjs
//

import { readFileSync } from "node:fs";

const ROOT = "/home/z/my-project";
const read = (rel) => readFileSync(`${ROOT}/${rel}`, "utf8");
/** strip comments so prose mentions never count as code */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const LAYOUT = "src/app/api/jobs/layout/route.ts";
const JOBS = "src/app/api/jobs/route.ts";
const STORE = "src/lib/store.ts";
const RESTORE = "src/app/api/jobs/restore/route.ts";
const DUPLICATE = "src/app/api/projects/[id]/duplicate/route.ts";

const layout = codeOf(read(LAYOUT));
const jobs = codeOf(read(JOBS));
const store = codeOf(read(STORE));
const restore = codeOf(read(RESTORE));
const duplicate = codeOf(read(DUPLICATE));

// ── A — the layout door's array bound (observation #3, server face) ─────

ok("A1 the raw updates array is capped at 500 before any pass is spent", layout.includes("body.updates.length > 500"), "the raw-array check, not a sanitize-output count");

const capIdx = layout.indexOf("body.updates.length > 500");
const sanitizeIdx = layout.indexOf("= sanitize(body.updates)");
ok("A2 the cap sits BEFORE the sanitize loop", capIdx !== -1 && sanitizeIdx !== -1 && capIdx < sanitizeIdx, `cap@${capIdx} < sanitize@${sanitizeIdx}`);

ok("A3 the cap message mirrors the restore door's family wording", layout.includes("with 1\u2013500 entries"), "Body must be { updates: [...] } with 1\u2013500 entries");

ok("A4 the empty-batch 400 face is unchanged", layout.includes('"No valid updates"'), "sanitize's zero-valid face keeps its own message");

// ── B — the client's chunked writer (observation #3, client face) ───────

ok("B1 the chunked writer exists", store.includes("function postLayoutUpdates") && store.includes("const LAYOUT_CHUNK"), "one writer, module scope");

{
  const m = store.match(/const LAYOUT_CHUNK = (\d+)/);
  const chunk = m ? Number(m[1]) : NaN;
  ok("B2 the chunk leaves headroom under the server's 500", chunk === 400, `LAYOUT_CHUNK = ${chunk}`);
}

ok("B3 the writer slices ordered chunks", store.includes("updates.slice(i, i + LAYOUT_CHUNK)"), "sequential for-loop, not a parallel map");

{
  const calls = store.split('"/api/jobs/layout"').length - 1;
  ok("B4 exactly ONE direct fetch site remains — inside the writer", calls === 1, `${calls} occurrence(s) of "/api/jobs/layout"`);
}

ok("B5 the tidy rides the writer", store.includes("await postLayoutUpdates(updates)"), "applyLayout's batch");
ok("B6 the drag commit rides the same writer", store.includes("await postLayoutUpdates(moves)"), "moveJobsCommit's batch — one obedience for both call sites");

// ── C — the classes list bound (observation #1) ──────────────────────────

ok("C1 the classes ARRAY is capped at 500", jobs.includes("classes.length > 500"), "the list bound, beside the per-value bound");

ok("C2 the cap message names the bound", jobs.includes("at most 500 class numbers"), "classStarSelection.classes must carry at most 500 class numbers");

ok("C3 the per-value bound still stands (1..10000)", jobs.includes("c <= 10000") && jobs.includes("Number.isInteger(c) && c > 0"), "each class number a positive integer \u2264 10000");

ok("C4 the dedupe+sort normalization still stands", jobs.includes("[...new Set(classes)].sort("), "the stored selection is canonical");

{
  const capIdx2 = jobs.indexOf("classes.length > 500");
  const linkIdx = jobs.indexOf("while (sourceRoot.linkedJobId)");
  ok("C5 the cap answers BEFORE the source-job lookups spend queries", capIdx2 !== -1 && linkIdx !== -1 && capIdx2 < linkIdx, `cap@${capIdx2} < link-walk@${linkIdx}`);
}

ok("C6 the non-empty face is unchanged", jobs.includes("must be a non-empty list of class numbers"), "zero-valid still 400s first");

// ── D — the gallery birth's ONE transaction (observation #2) ────────────

ok("D1 the job birth rides the transaction client", jobs.includes("tx.job.create"), "$transaction's tx, not the bare db");

ok("D2 the lineage edge rides the same transaction", jobs.includes("tx.edge.create"), "the pair commits atomically or not at all");

ok("D3 the only bare write left is the link mode's LONE create", !jobs.includes("db.edge.create") && (jobs.split("db.job.create").length - 1) === 1, "a single write needs no transaction — the edge exists only inside the pair's");

ok("D4 the edge DTO derives from the transaction's RESULT", jobs.includes("= edge ? toEdgeDTO(edge) : null"), "no outer-mutable carry — the return-shape is the truth");

// ── E — the family law's anchors still stand ─────────────────────────────

ok("E1 restore's 1\u2013500 bound still anchors the family", restore.includes("list.length > 500"), "the bound the cures mirror");

ok("E2 duplicate's $transaction is still the band's exemplar", duplicate.includes("db.$transaction"), "the model the birth now answers to");

console.log(`\nt888 write-bound unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

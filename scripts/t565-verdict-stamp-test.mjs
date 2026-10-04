/**
 * t565 — the verdict stamp's pure-core contract, node-direct over the
 * REAL TypeScript lib (no mirror copies — the t562 doctrine: the test
 * pins the contract to the code that ships).
 *
 * Run: node scripts/t565-verdict-stamp-test.mjs
 */

import assert from "node:assert/strict";
import {
  sanitizeStamp,
  upsertStamp,
  trimStamps,
  parseStampsFile,
  serializeStampsFile,
  MAX_STAMPS,
  MAX_REASON_CHARS,
  MAX_ADVICE_CHARS,
} from "../src/lib/ai/verdict-stamp-core.ts";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};

/* ---- sanitize: the valid stamp passes through, counts re-derived ------ */
const good = sanitizeStamp({
  jobId: "cmuro5ze3000wn5nbewxp1nl8",
  at: 1759550000000,
  iteration: 3,
  model: "glm-4.5v",
  twoPass: { agreed: 2, torn: 1, missing: 0 },
  classes: [
    { cls: 5, verdict: "keep", reason: "crisp boundary, helical rods" },
    { cls: 2, verdict: "maybe", reason: "soft interior" },
    { cls: 1, verdict: "reject", reason: "empty box" },
  ],
  advice: "Take classes 5 forward; the run is healthy.",
});
check("valid stamp sanitizes", good != null);
check("counts re-derived (not trusted)", good?.counts.keep === 1 && good?.counts.maybe === 1 && good?.counts.reject === 1,
  JSON.stringify(good?.counts));
check("fields ride", good?.jobId === "cmuro5ze3000wn5nbewxp1nl8" && good?.model === "glm-4.5v" && good?.at === 1759550000000);

/* ---- sanitize: garbage rejected at the door ---------------------------- */
check("no jobId → null", sanitizeStamp({ classes: [] }) === null);
check("null payload → null", sanitizeStamp(null) === null);
check("array payload → null", sanitizeStamp([]) === null);
check("non-object class dropped, verdict enum-guarded",
  sanitizeStamp({
    jobId: "j1",
    classes: [
      { cls: 0, verdict: "keep", reason: "zero cls dropped" },
      { cls: 2, verdict: "excellent", reason: "bad enum dropped" },
      { cls: 3, verdict: "keep", reason: "survives" },
      "junk string dropped",
    ],
  })?.counts.keep === 1,
  "only class 3 survives");
check("missing at defaults to now", sanitizeStamp({ jobId: "j1", classes: [] })?.at > 0);

/* ---- sanitize: string caps (the AI text never bloats the notebook) ----- */
const bloated = sanitizeStamp({
  jobId: "j2",
  classes: [{ cls: 1, verdict: "keep", reason: "r".repeat(5000) }],
  advice: "a".repeat(5000),
});
check("reason capped", bloated?.classes[0].reason.length === MAX_REASON_CHARS, `${bloated?.classes[0].reason.length}/${MAX_REASON_CHARS}`);
check("advice capped", bloated?.advice.length === MAX_ADVICE_CHARS, `${bloated?.advice.length}/${MAX_ADVICE_CHARS}`);

/* ---- upsert: one job, one stamp, newest wins --------------------------- */
const a = { jobId: "jobA", at: 1, iteration: null, model: "m", twoPass: null, classes: [], advice: "", counts: { keep: 0, maybe: 0, reject: 0 } };
const a2 = { jobId: "jobA", at: 2, iteration: null, model: "m", twoPass: null, classes: [], advice: "newer", counts: { keep: 0, maybe: 0, reject: 0 } };
const b = { jobId: "jobB", at: 3, iteration: null, model: "m", twoPass: null, classes: [], advice: "", counts: { keep: 0, maybe: 0, reject: 0 } };
let stamps = upsertStamp([], a);
stamps = upsertStamp(stamps, b);
stamps = upsertStamp(stamps, a2);
check("upsert keeps one entry per job", stamps.filter((s) => s.jobId === "jobA").length === 1);
check("newest moved to front", stamps[0].jobId === "jobA" && stamps[0].advice === "newer");
check("other job intact", stamps[1].jobId === "jobB");

/* ---- trim: the notebook cap (the store feeds newest-first via upsert) -- */
const many = Array.from({ length: MAX_STAMPS + 25 }, (_, i) => ({ ...a, jobId: `job${i}`, at: i })).reverse();
check("cap enforced", trimStamps(many).length === MAX_STAMPS);
check("newest survive the cap (front is newest)", trimStamps(many)[0].jobId === `job${MAX_STAMPS + 24}`);

/* ---- file round-trip + tolerant parse ---------------------------------- */
const text = serializeStampsFile([a2, b]);
const back = parseStampsFile(text);
check("round-trip preserves stamps", back.stamps.length === 2 && back.stamps[0].advice === "newer");
check("garbage text → empty notebook (no 500)", parseStampsFile("{not json").stamps.length === 0);
check("empty text → empty notebook", parseStampsFile("").stamps.length === 0);
check("hand-edited junk entries filtered",
  parseStampsFile(JSON.stringify({ version: 1, stamps: [{ jobId: "ok", classes: [] }, { junk: true }, null, 42] })).stamps.length === 1,
  "1 survivor");
check("non-array stamps → empty", parseStampsFile(JSON.stringify({ version: 1, stamps: "all" })).stamps.length === 0);

/* ---- the stamp is a notebook entry: counts can NEVER be trusted -------- */
const lying = sanitizeStamp({
  jobId: "j3",
  counts: { keep: 99, maybe: 99, reject: 99 },
  classes: [{ cls: 1, verdict: "keep", reason: "" }],
});
check("caller counts ignored, re-derived", lying?.counts.keep === 1 && lying?.counts.maybe === 0 && lying?.counts.reject === 0,
  JSON.stringify(lying?.counts));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

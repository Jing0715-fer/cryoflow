#!/usr/bin/env node
/**
 * t961 — the MESSAGE-QUALITY unit (node-only): the tree-level tripwires
 * for the refusal texts themselves — the string-level honesty law after
 * the t960 ISE extinction.
 *
 * THE AUDIT (this unit's birth): the t960 pass unified the
 * "Internal server error" dialect; the word-census over the remaining
 * 366 `{ error: "..." }` literals ranked the bespoke texts on three
 * axes (empty / verb-no-object / generic). Verdict: zero empty, zero
 * generic, and SEVEN verb-only sites — "read failed" ×4, "persist
 * failed" ×3 — all of them `catch {}` blocks that swallowed the
 * exception SILENTLY (no log, no binding, no reason). Two more were
 * cured on judgment: the funnel's bare "Forbidden" (the guard family
 * speaks "Cross-site access … is not allowed" in 24+ object-specific
 * variants — the funnel was the odd one out) and outputs/sync's
 * "Path rejected" (the reason WAS in scope: the traversal shape test).
 * Two short texts were JUDGED OK and stand: "Would create a cycle"
 * (names the reason; the store's optimistic twin speaks the same
 * words) and "Map scan failed" (names the operation; no reason exists
 * in scope — the scan returned null).
 *
 * THE CURE (what this unit pins):
 *  - the seven silent catches now carry a binding and speak through
 *    the birthplaces: the degrade doors (camera-bookmarks,
 *    overlay-session, param-presets, views/gallery) keep their payload
 *    shapes and ride serverErrorMessage + a console.error; the three
 *    persist doors ride serverErrorReply (which also LOGS — the
 *    exception is visible in the server log for the first time);
 *  - the verb-only / generic / empty dialects can never quietly grow
 *    back (M1–M3);
 *  - the guard dialect is uniform (M4 — no bare "Forbidden");
 *  - the short-vague bucket is a CLOSED allowlist (M7): a new vague
 *    text reddens this unit until it is judged and named.
 *
 *   node scripts/unit-runner.mjs scripts/t961-msg-quality-unit.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t961-msg-quality-unit.json";

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`); }
}

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};

const VERB_ONLY =
  /^(read|write|save|load|persist|update|delete|fetch|create|remove|open|parse|export|import|sync|restore|rename|revert|run|stop|cancel|retry|kill|move|copy|scan|search|upload|download|submit|send|connect|disconnect|start|build|compile|compute|render|save) failed$/i;
const GENERIC =
  /^(failed|error|unknown error|an error occurred|something went wrong|request failed|operation failed|action failed|no|none)$/i;
// the closed allowlist: the two short texts JUDGED OK on the evidence
// (edges' cycle door names its reason; map-profile's scan door names
// its operation and no reason exists in scope)
const JUDGED_OK = new Set(["Would create a cycle", "Map scan failed"]);
const SHORT_VAGUE = /^[^"]{1,23}$/;

/* ---- the census over the API tree's error literals ---- */
const apiFiles = walk(path.join(ROOT, "src/app/api"));
const sites = [];
for (const f of apiFiles) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    const m = line.match(/error:\s*"([^"]*)"/);
    if (m) sites.push({ f: path.relative(ROOT, f), line: i + 1, text: m[1] });
  });
}
ok("M0 the census sees a populated tree", sites.length >= 350, `sites=${sites.length}`);

{
  const verbOnly = sites.filter((s) => VERB_ONLY.test(s.text.trim()));
  ok("M1 zero verb-only refusal texts (read failed / persist failed …)", verbOnly.length === 0, verbOnly.slice(0, 3).map((s) => `${s.f}:${s.line}`).join(", "));
}
{
  const generic = sites.filter((s) => GENERIC.test(s.text.trim()));
  ok("M2 zero generic refusal texts", generic.length === 0, generic.slice(0, 3).map((s) => `${s.f}:${s.line}`).join(", "));
}
{
  const empty = sites.filter((s) => s.text.trim() === "");
  ok("M3 zero empty refusal texts", empty.length === 0, empty.slice(0, 3).map((s) => `${s.f}:${s.line}`).join(", "));
}
{
  const bare = sites.filter((s) => /^(Forbidden|Unauthorized)$/.test(s.text.trim()));
  ok("M4 the guard dialect is uniform — no bare Forbidden/Unauthorized", bare.length === 0, bare.slice(0, 3).map((s) => `${s.f}:${s.line}`).join(", "));
}
{
  const shortVague = sites.filter(
    (s) => SHORT_VAGUE.test(s.text) && s.text.trim().length > 0 && !/\b(not|no|missing|invalid|required|already|cannot|can't|must|unknown|unsupported|mismatch|too|expired|not found)\b/i.test(s.text) && s.text.trim().length < 24
  );
  const unjudged = shortVague.filter((s) => !JUDGED_OK.has(s.text.trim()));
  ok("M7 the short-vague bucket is the closed judged-OK allowlist", unjudged.length === 0, unjudged.slice(0, 3).map((s) => `"${s.text}" ${s.f}:${s.line}`).join(", "));
}
{
  let sem = 0;
  for (const f of walk(path.join(ROOT, "src/app"))) {
    sem += (readFileSync(f, "utf8").match(/serverErrorMessage\(/g) ?? []).length;
  }
  ok("M5 the degrade doors speak serverErrorMessage", sem >= 5, `sites=${sem}`);
}
{
  let ser = 0;
  for (const f of walk(path.join(ROOT, "src/app/api"))) {
    ser += (readFileSync(f, "utf8").match(/serverErrorReply\(/g) ?? []).length;
  }
  ok("M6 the birthplace's call sites cannot revert (77 + the three persist doors)", ser >= 80, `sites=${ser}`);
}
{
  const funnel = readFileSync(path.join(ROOT, "src/app/api/jobs/[id]/funnel/route.ts"), "utf8");
  ok("M8 the funnel's guard speaks the family dialect", funnel.includes('"Cross-site access to job data is not allowed"') && !funnel.includes('"Forbidden"'));
}

/* ---- the receipt ---- */
const receipt = { instrument: "t961-msg-quality-unit", pass, fail, at: new Date().toISOString() };
const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nMSG-QUALITY-UNIT t961: ${pass}/${pass + fail} ${fail === 0 ? "green — every refusal names its object, the vague dialect is extinct" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

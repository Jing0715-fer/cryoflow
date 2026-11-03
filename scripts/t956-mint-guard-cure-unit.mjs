#!/usr/bin/env node
/**
 * t956 — the MINT GUARD CURE unit (node-only): the t955 postscript
 * amendment ③'s law, pinned to the exact code text the six sibling
 * mints (t915/t916/t951/t952/t953/t954) now carry in their guards().
 *
 * THE DISEASE (the t955 postscript's live proof): api()'s six-window
 * total-failure return wears the envelope { error } — the OLD guard
 * line `Array.isArray(jobs())` let it flow through `.jobs ?? []` into
 * `Array.isArray([]) === true` and celebrated a corpse: the mint rode
 * on past a guard that had just watched the route die.
 *
 * THE CURE: the guard reads the envelope's error key FIRST —
 *
 *     const srvEnv = api("GET", "/api/jobs");
 *     ok("guard: server answers", !srvEnv.error && Array.isArray(srvEnv.jobs),
 *       srvEnv.error ?? `${(srvEnv.jobs ?? []).length} jobs on the world`);
 *
 * Four pins, the law's whole face:
 *   C1 the OLD expression passes on the error envelope — the false
 *      green preserved as the reason the cure exists (a regression's
 *      autopsy, not a strawman);
 *   C2 the CURED expression FAILS on the error envelope (the dead-route
 *      proof rode the real t954 file against a never-listening port —
 *      this pin pins the same verdict at the expression's own level);
 *   C3 the CURED expression passes on a LIVE envelope AND the extra
 *      message speaks the job count ("3 jobs on the world");
 *   C4 the shape liar caught too: an envelope with no jobs key at all
 *      fails the cured guard (Array.isArray(undefined) is false) —
 *      the guard demands the ARRAY, not merely the absence of an error.
 *
 * The guard text below is COPIED from scripts/t954-class3d-hidden-world-mint.mjs
 * (the cure's canonical note) and re-asserted here so a drift between
 * the unit's law and the mints' own line breaks one of them loudly.
 *
 *   node scripts/t956-mint-guard-cure-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t956-mint-guard-cure-unit.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---- S0: the source of truth — the mints still carry the cure ---- */
const SIBLINGS = [
  "t915-extract-mint.mjs",
  "t916-class2d-mint.mjs",
  "t951-fsc-deep-mint.mjs",
  "t952-class-world-mint.mjs",
  "t953-allrefused-world-mint.mjs",
  "t954-class3d-hidden-world-mint.mjs",
];
const CURE_SNIPPET =
  '!srvEnv.error && Array.isArray(srvEnv.jobs)';
for (const s of SIBLINGS) {
  const text = readFileSync(path.join(ROOT, "scripts", s), "utf8");
  ok(`S0 ${s} carries the cured guard line`, text.includes(CURE_SNIPPET) && text.includes("const srvEnv = api("),
    text.includes(CURE_SNIPPET) ? "" : "the cure text is MISSING");
}
ok("S0 the six mints read MINT_BASE (the dead-route proof's door)",
  SIBLINGS.every((s) => readFileSync(path.join(ROOT, "scripts", s), "utf8").includes('process.env.MINT_BASE')));

/* ---- the law at the expression level ---- */
const DEAD_ENVELOPE = { error: "the route never answered through six windows" };
const LIVE_ENVELOPE = { jobs: [{ id: "a" }, { id: "b" }, { id: "c" }] };
const SHAPE_LIAR = {}; // no error key, no jobs key — the silent liar

// the OLD guard, exactly as six mints carried it before the cure
const OLD_GUARD = (env) => Array.isArray(env.jobs ?? []);
// the CURED guard, exactly as the mints carry it now (the verdict AND the message)
const CURED_GUARD = (env) => ({
  verdict: !env.error && Array.isArray(env.jobs),
  extra: env.error ?? `${(env.jobs ?? []).length} jobs on the world`,
});

/* C1 — the autopsy: the old line passes on the error envelope */
ok("C1 the OLD guard celebrates the error envelope (the disease, preserved)",
  OLD_GUARD(DEAD_ENVELOPE) === true);

/* C2 — the cure: the cured line fails the error envelope */
const deadVerdict = CURED_GUARD(DEAD_ENVELOPE);
ok("C2 the CURED guard refuses the error envelope", deadVerdict.verdict === false,
  deadVerdict.extra);
ok("C2b the refusal's message speaks the route's own words", deadVerdict.extra === DEAD_ENVELOPE.error);

/* C3 — the live face: pass, with the count */
const liveVerdict = CURED_GUARD(LIVE_ENVELOPE);
ok("C3 the CURED guard passes a live envelope", liveVerdict.verdict === true);
ok("C3b the pass message speaks the job count", liveVerdict.extra === "3 jobs on the world",
  liveVerdict.extra);

/* C4 — the shape liar: no jobs key fails even without an error key */
const liarVerdict = CURED_GUARD(SHAPE_LIAR);
ok("C4 the shape liar (no jobs key) is refused", liarVerdict.verdict === false,
  liarVerdict.extra);

/* ---- the receipt ---- */
try { writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ instrument: "t956-mint-guard-cure-unit", pass, fail, at: new Date().toISOString() }, null, 2)); } catch {}
console.log(`\nMINT-GUARD-CURE-UNIT t956: ${pass}/${pass + fail} ${fail === 0 ? "green — the guard and the armor speak the same honesty" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

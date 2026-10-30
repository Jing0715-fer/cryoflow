#!/usr/bin/env node
/**
 * t1090 — THE LAZY HOST unit (node-only): the qa55 ride's precondition
 * cured at its own layer.
 *
 * THE SCAR (t1088 named the debt, this window paid it): qa55's honest-gap
 * phase (C) never names the refine host, but the suite's module load
 * resolved it EAGERLY — `const JOB = resolveRefineHost().name` — so the
 * phase died before its first step on the t1075 replant world (no
 * refine3d host: "run scripts/qa-t531-old-world-seed.mjs"). And the SEED
 * CLEAN it calls (qa53 → qa52) died the same death: the python seeders
 * resolved the host at module level too, so even a --clean whose
 * artifacts live ONLY in the host's workdir could not run on a hostless
 * world — a cleanup that cannot run when there is nothing to clean.
 *
 * THE CURES (the resolution goes lazy, the loud failures stay loud):
 *   qa55: JOB resolves on FIRST USE (phases A/B); phase C never pays;
 *   qa50/51/52/53: the module tolerates a hostless world, the --clean
 *   path prints its own VERIFIED absence claim (the artifacts live in
 *   the host's workdir — no host, no artifacts) and exits 0, the seed
 *   path re-resolves on demand and still SystemExits loudly;
 *   qa_lib's resolver is UNTOUCHED — it remains the loud A/B gate.
 *
 * BANDS:
 *   A  qa55's laziness (the lazy shape, the eager line gone, the call
 *      sites through the accessor)
 *   B  the seeders' lazy clean (the verified-absence voice in all four,
 *      the seed paths re-derived after the loud re-resolution, the
 *      project-relative FSC sweep that runs regardless)
 *   C  the loud failures preserved (qa_lib untouched, the seed paths
 *      re-resolve on demand)
 *
 * PROTOCOL: node-only, readFileSync over the five scripts, exit honest,
 * receipt to shots-qa/.t1090-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1090-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const qa55 = read("scripts/qa55-e2e.mjs");
const qa50 = read("scripts/qa50-seed-fsc.py");
const qa51 = read("scripts/qa51-seed-report.py");
const qa52 = read("scripts/qa52-seed-report.py");
const qa53 = read("scripts/qa53-seed-topaz.py");
const qaLib = read("scripts/qa_lib.py");

/* ---------- A band — qa55's laziness ---------- */
console.log("A band — qa55's laziness:");
ok("A1 the lazy shape stands (JOB null, the ??= accessor, the phase-C exemption named)",
  qa55.includes("let JOB = null;") &&
  qa55.includes("const refineJobName = () => (JOB ??= resolveRefineHost().name);") &&
  qa55.includes("the t531 old\n// world is phases A/B's fixture, not C's"));
ok("A2 the eager module-load resolution is GONE (no `const JOB = resolveRefineHost`)",
  !/const JOB = resolveRefineHost\(\)/.test(qa55));
ok("A3 the A/B uses ride the accessor (every JOB mention but the declaration goes through it)",
  (qa55.match(/refineJobName\(\)/g) || []).length >= 6 &&
  !/\$\{JOB\}/.test(qa55));

/* ---------- B band — the seeders' lazy clean ---------- */
console.log("B band — the seeders' lazy clean:");
ok("B1 qa53 tolerates a hostless world and its clean speaks the verified absence",
  qa53.includes("except SystemExit:") &&
  qa53.includes("no topaz log to clean (verified by the host's own absence)"));
ok("B2 qa52's clean verifies its own absence and its seed re-derives the paths after the loud resolve",
  qa52.includes("no seeded files to clean (verified by the host's own absence)") &&
  /_REFINE_JOB, WORKDIR = _resolve_host\(\)\s*\n\s+PP = os\.path\.join\(WORKDIR/.test(qa52));
ok("B3 qa50's clean verifies its own absence (the one-file seeder, same coat)",
  qa50.includes("nothing to clean (verified by the host's own absence)") &&
  qa50.includes("TARGET = os.path.join(WORKDIR, \"postprocess.star\") if WORKDIR else None"));
ok("B4 qa51's clean verifies its own absence (the intermediate generation, same coat)",
  qa51.includes("no seeded files to clean (verified by the host's own absence)") &&
  qa51.includes("PP = os.path.join(WORKDIR, \"postprocess.star\") if WORKDIR else None"));
ok("B5 the postprocess FSC sweep is project-relative (it runs even when the host is absent)",
  qa53.includes("(t1090: project-relative — swept even when the host is absent.)") &&
  qa53.includes('pp = os.path.join("/home/z/my-project/data/relion", _PROJECT,'));

/* ---------- C band — the loud failures preserved ---------- */
console.log("C band — the loud failures preserved:");
ok("C1 qa_lib's resolver is UNTOUCHED (the SystemExit gate keeps the seeder's name)",
  qaLib.includes("raise SystemExit(\n                f\"qa_lib: refine3d host '{name}' missing — run scripts/qa-t531-old-world-seed.mjs \""));
ok("C2 every seed path re-resolves on demand (the loud _resolve_host() in all four)",
  ["qa50", "qa51", "qa52", "qa53"].every((n) =>
    ({ qa50, qa51, qa52, qa53 })[n].includes("    _REFINE_JOB, WORKDIR = _resolve_host()")));

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1090-lazy-host-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["A qa55's laziness", "B the seeders' lazy clean", "C the loud failures preserved"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);

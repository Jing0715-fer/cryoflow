#!/usr/bin/env node
/**
 * t1095 — THE STRAY LAW'S SEEDER EDITION (the audit's four borderline
 * shapes cured at the source).
 *
 * THE SCAR (the t1088-era audit's boundary shapes, re-convicted this
 * window by the instrument's re-run): the audit's SUSPECTS section stood
 * empty (the one mint+delete suspect, qa55, was cured with the 405
 * lesson — the world read IS the verification), but the BORDERLINE
 * shapes stood: qa66/67 delete through RIDERS whose deletes are
 * warn-swallowed, qa63/68 swallow the same warns without deleting of
 * their own. The deep survey found the SOURCE the riders share: the
 * seeders' take-home/clean deletes answer-unchecked — `api(...,
 * "DELETE")` followed by an unconditional "deleted" print. A 200 whose
 * world did not move (the async/cascade race) printed a counted lie;
 * only 4xx/5xx raised (urlopen raises) — and the riders' warn coats
 * then carried an exception string instead of the world's verdict.
 *
 * THE LAW (the qa55 lesson, imported to the seeders): the delete's own
 * 200 is not the proof — the WORLD READ is. Every product-door DELETE
 * is followed by a re-read of /api/jobs (or the twin lookup); a row
 * that STANDS after its delete prints a REFUSAL naming the row and
 * exits 2 — so the riders' warn coats (qa63's take-home warn, qa66's
 * take-home warn, qa67's tenant clean warn, qa68's both) carry the
 * truth loudly instead of feeding the next round a fossil.
 *
 * THE CURES (three seeders, four delete sites):
 *   qa58-seed-gallery.py  take-home loop — verify + REFUSAL exit 2
 *   qa60-seed-fsc.py      clean (the live card) + take-home (the SPECS)
 *   seed-twin.py          --clean (the twin)
 * qa62-offline-clean.py inspected and LEFT ALONE — its Prisma delete
 *   already captures and prints its own answer (verified in its dialect).
 *
 * 16 pins in four bands:
 *   S the sites (4) — each DELETE followed by the world-read verify.
 *   R the refusal voice (3) — every REFUSAL pairs with sys.exit(2), the
 *     count is exactly four (one law, no drift).
 *   W the riders' coats (4) — qa63/66/67/68's warns PRINT (never silent
 *     catch{}), now fed by loud exits instead of bare exceptions.
 *   L the lineage (5) — the law's comment rides all three seeders, the
 *     python compiles (py_compile x3), and the audit instrument still
 *     runs clean (its SUSPECTS empty is the standing world's truth).
 *
 * fs-only, bare node (RUNNERS 0). Receipt: shots-qa/.t1095-unit-receipt.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const qa58 = read("scripts/qa58-seed-gallery.py");
const qa60 = read("scripts/qa60-seed-fsc.py");
const twin = read("scripts/seed-twin.py");
const qa63 = read("scripts/qa63-smoke.mjs");
const qa66 = read("scripts/qa66-e2e.mjs");
const qa67 = read("scripts/qa67-e2e.mjs");
const qa68 = read("scripts/qa68-e2e.mjs");

const must = (id, ok, why) => {
  results.push({ id, ok: !!ok, why });
  if (!ok) failed++;
};
const results = [];
let failed = 0;

/** the site law: after the DELETE literal, within `span` chars, the file
 *  must re-read the world (api("/api/jobs") or the twin lookup) — the
 *  delete's 200 alone is a lie the world read refuses */
const site = (text, anchor, span, worldNeedle) => {
  const i = text.indexOf(anchor);
  if (i < 0) return false;
  const spanText = text.slice(i, i + span);
  return spanText.includes(worldNeedle);
};

/* ---------------- S — the sites (4) ---------------- */

// S1 — qa58's take-home loop verifies by the world read
must(
  "S1",
  site(
    qa58,
    'api(f"/api/jobs/{row[\'id\']}", "DELETE")',
    700,
    'after = api("/api/jobs")'
  ),
  "qa58 take-home: the DELETE is followed by the world read"
);

// S2 — qa60's clean branch (the live card) verifies
must(
  "S2",
  site(
    qa60,
    'api(f"/api/jobs/{live[\'id\']}", "DELETE")',
    700,
    'after = api("/api/jobs")'
  ),
  "qa60 clean: the live card's DELETE is followed by the world read"
);

// S3 — qa60's take-home (the SPECS loop) verifies
const s3 = qa60.indexOf('api(f"/api/jobs/{row[\'id\']}", "DELETE")');
must(
  "S3",
  s3 > 0 &&
    qa60
      .slice(s3, s3 + 700)
      .includes('after = api("/api/jobs")') &&
    qa60.slice(s3, s3 + 700).includes('any(j.get("id") == row["id"]'),
  "qa60 take-home: the SPECS delete is followed by the world read"
);

// S4 — seed-twin's --clean verifies via the twin lookup (a live list_jobs)
const s4 = twin.indexOf('api(f"/api/jobs/{twin[\'id\']}", "DELETE")');
must(
  "S4",
  s4 > 0 && twin.slice(s4, s4 + 500).includes("after = find_by_name(TWIN_NAME)"),
  "seed-twin --clean: the twin delete is followed by the live lookup"
);

/* ---------------- R — the refusal voice (3) ---------------- */

// R1 — the REFUSAL count is exactly four (one law, four sites, no drift)
const refusals = [
  ...qa58.matchAll(/REFUSAL/g),
  ...qa60.matchAll(/REFUSAL/g),
  ...twin.matchAll(/REFUSAL/g),
].length;
must("R1", refusals === 4, `exactly 4 REFUSAL prints across the seeders (got ${refusals})`);

// R2 — every REFUSAL pairs with sys.exit(2) (loud, never a warn-and-pass)
const refusalOk = [qa58, qa60, twin].every((t) => {
  const spots = [...t.matchAll(/REFUSAL[^\n]*\n/g)];
  return (
    spots.length > 0 &&
    spots.every((m) => t.slice(m.index, m.index + 300).includes("sys.exit(2)"))
  );
});
must("R2", refusalOk, "every REFUSAL is followed by sys.exit(2)");

// R3 — the refusal NAMES the row (the world's verdict, not a bare code)
must(
  "R3",
  qa58.includes("still stands after its DELETE") &&
    qa60.includes("still stands after its DELETE") &&
    twin.includes("still stands after its DELETE"),
  "the refusals name the standing row"
);

/* ---------------- W — the riders' coats (4) ---------------- */

// W1..W4 — the riders' warn coats PRINT (the swallow is a print, never a
// silent catch{}) — now fed by the seeders' loud exits
must("W1", qa63.includes("take-home warn: ${String(e)"), "qa63's take-home warn prints");
must("W2", qa66.includes("take-home warn: ${String(e.message"), "qa66's take-home warn prints");
must("W3", qa67.includes("tenant clean warn: ${String(e)"), "qa67's tenant warn prints");
must(
  "W4",
  qa68.includes("tenant clean warn: ${String(e)") &&
    qa68.includes("take-home warn: ${String(e)"),
  "qa68's both warns print"
);

/* ---------------- L — the lineage (5) ---------------- */

// L1 — the law's comment rides all three seeders (the next reader inherits
// the WHY on sight)
must(
  "L1",
  qa58.includes("the stray law's seeder edition") &&
    qa60.includes("the stray law's seeder edition") &&
    twin.includes("the stray law's seeder edition"),
  "the law's comment rides all three seeders"
);

// L2..L4 — the python compiles (the law must not be a syntax fossil)
for (const [id, f] of [
  ["L2", "scripts/qa58-seed-gallery.py"],
  ["L3", "scripts/qa60-seed-fsc.py"],
  ["L4", "scripts/seed-twin.py"],
]) {
  let ok = false;
  try {
    execSync(`python3 -m py_compile ${f}`, { cwd: ROOT, stdio: "pipe" });
    ok = true;
  } catch {}
  must(id, ok, `${f} compiles`);
}

// L5 — the audit instrument still runs (the standing world's truth: its
// SUSPECTS section stays empty — no mint+delete without verification)
let auditEmpty = false;
try {
  const out = execSync("node scripts/t1088-qa-stray-audit.mjs", {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120_000,
  });
  auditEmpty = /=== SUSPECTS[^\n]*===\s*\(none\)/.test(out);
} catch {}
must("L5", auditEmpty, "the audit instrument runs clean (SUSPECTS none)");

/* ---------------- the receipt ---------------- */

const GREEN = failed === 0;
const receipt = {
  unit: "t1095-stray-verify-unit",
  window: "t1095",
  date: new Date().toISOString(),
  pins: results.length,
  failed,
  verdict: GREEN ? "GREEN" : "RED",
  results,
};
writeFileSync(
  join(ROOT, "shots-qa/.t1095-unit-receipt.json"),
  JSON.stringify(receipt, null, 2) + "\n"
);

for (const r of results) {
  console.log(`${r.ok ? "GREEN" : "RED"} ${r.id}: ${r.why}`);
}
console.log(`\nt1095-stray-verify-unit: ${results.length - failed}/${results.length} ${GREEN ? "green" : "RED"}`);
process.exit(GREEN ? 0 : 1);

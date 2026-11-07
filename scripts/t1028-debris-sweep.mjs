#!/usr/bin/env node
/**
 * t1028-debris-sweep.mjs — the mock-side ORPHAN SWEEPER (the debris audit's
 * standing instrument).
 *
 * Born from the t1028 window's own audit: the live-suffix cross-check found
 * ELEVEN mock-side workdirs whose suffixes matched no live job — five
 * autopick + one extract (past t915 rides: the mint's remove predated the
 * mock-side leg) and five imports (past t916/t922-era rides, same shape).
 * The local plane was clean (the t1027 sweep's legacy); the CLUSTER side had
 * been accumulating for its whole life, invisible to every world gate (they
 * count jobs and edges, not cluster dirs).
 *
 * The orphan test is ONE-DIRECTIONAL and honest: a mock-side dir shaped
 * `<type>_<suffix>` whose suffix matches NO live job id (id.slice(-8)) is
 * debris; a dir that matches a live job is a twin and is KEPT; the shared
 * `micrographs` dir and anything not job-shaped is kept. A live job that
 * ran locally (no mock twin) is untouched by construction — the test never
 * asks the local plane for anything.
 *
 * Idempotent by construction: sweep, then re-audit — the second ride finds
 * zero orphans. The receipt (shots-qa/t1028-debris-sweep.json) records the
 * swept list, the kept count, and the live world's size at sweep time.
 *
 * Usage: node scripts/t1028-debris-sweep.mjs [--receipt <path>]
 */
import { readdirSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const MOCK_PROJECTS = path.join(process.cwd(), "services", "mock-cluster", "fs", "projects", "cryoflow");
const RECEIPT = path.join(process.cwd(), "shots-qa", "t1028-debris-sweep.json");
const JOB_DIR_SHAPE = /^[a-z0-9]+_([a-z0-9]{6,})$/; // <type>_<id-suffix>; micrographs and strangers are not job-shaped

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim(); }
  catch (e) { return `ERR:${String(e.message).slice(0, 200)}`; }
};

const liveJobs = (() => {
  try { return JSON.parse(sh(`curl -s ${ORIGIN} "${BASE}/api/jobs"`)).jobs ?? []; }
  catch { return []; }
})();
const liveSuffixes = new Set(liveJobs.map((j) => String(j.id ?? "").slice(-8)).filter(Boolean));

let fail = 0;
const swept = [], kept = [], skipped = [];
if (!existsSync(MOCK_PROJECTS)) {
  console.log("no mock projects dir — nothing to sweep");
  process.exit(0);
}
for (const fam of readdirSync(MOCK_PROJECTS)) {
  const famDir = path.join(MOCK_PROJECTS, fam);
  let entries;
  try { entries = readdirSync(famDir); } catch { continue; }
  for (const dir of entries) {
    const full = path.join(famDir, dir);
    const m = JOB_DIR_SHAPE.exec(dir);
    if (!m) { skipped.push(`${fam}/${dir}`); continue; }        // micrographs + strangers: kept by shape
    if (liveSuffixes.has(m[1])) { kept.push(`${fam}/${dir}`); continue; } // a live job's twin
    try { rmSync(full, { recursive: true, force: true }); swept.push(`${fam}/${dir}`); console.log(`  swept ${fam}/${dir}`); }
    catch (e) { fail++; console.log(`  ✗ sweep failed for ${full}: ${e.message}`); }
  }
}

// re-audit — the idempotence word
let orphansLeft = 0;
for (const fam of existsSync(MOCK_PROJECTS) ? readdirSync(MOCK_PROJECTS) : []) {
  const famDir = path.join(MOCK_PROJECTS, fam);
  let entries; try { entries = readdirSync(famDir); } catch { continue; }
  for (const dir of entries) {
    const m = JOB_DIR_SHAPE.exec(dir);
    if (m && !liveSuffixes.has(m[1])) orphansLeft++;
  }
}

console.log(`== t1028 debris sweep ${fail === 0 && orphansLeft === 0 ? "GREEN" : "RED"} — swept ${swept.length}, kept ${kept.length} live twins, skipped ${skipped.length} non-job dirs, orphans left ${orphansLeft} ==`);
mkdirSync(path.dirname(RECEIPT), { recursive: true });
writeFileSync(RECEIPT, JSON.stringify({
  at: new Date().toISOString(),
  swept, keptCount: kept.length, kept, skippedCount: skipped.length, skipped,
  orphansLeft, liveJobs: liveJobs.length,
}, null, 2));
process.exit(fail === 0 && orphansLeft === 0 ? 0 : 1);

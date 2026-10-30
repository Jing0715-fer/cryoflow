#!/usr/bin/env node
/**
 * t1088 — the qa-family stray-law audit (the t1085 lesson generalized):
 * for every qaNN-e2e suite, does its cleanup VERIFY its own take-home?
 * qa60's lie in a different coat = a suite that mints, deletes (or
 * warns), and exits without asserting the world it leaves behind.
 * Read-only audit — prints the table, touches nothing.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const files = readdirSync(path.join(ROOT, "scripts"))
  .filter((f) => /^qa\d+.*\.mjs$/.test(f))
  .sort();

const rows = [];
for (const f of files) {
  const src = readFileSync(path.join(ROOT, "scripts", f), "utf8");
  const mints = /api\("POST",\s*[`"']\/api\/(jobs|projects)/.test(src) || /POST[^`"']*\/api\/(jobs|projects)/.test(src);
  const deletes = /DELETE/.test(src);
  // the verification shapes: the stray law's voices
  const verifies =
    /world carries no/.test(src) ||
    /after take-home/.test(src) ||
    /stray/i.test(src) ||
    /leftover/i.test(src) ||
    /must\([^)]*(delete|sweep|take.?home|clean)/i.test(src);
  // the warn-swallow coat: a catch that only warns near the cleanup tail
  const warnSwallow = /catch[^}]{0,120}(warn|console\.log\(`?cleanup)/i.test(src) || /cleanup warn/i.test(src);
  // cleanup verdict honesty: does the file's cleanup section feed fail/pass counters?
  const cleanupFeedsVerdict =
    /cleanup[\s\S]{0,400}(fail\+\+|ok\(|must\()/.test(src) || verifies;
  rows.push({ f, mints, deletes, verifies, warnSwallow, cleanupFeedsVerdict, lines: src.split("\n").length });
}

console.log("file | mints | deletes | verifies | warnSwallow | verdict-shaped");
const suspects = [];
for (const r of rows) {
  const mark = (b) => (b ? "Y" : ".");
  console.log(`${r.f} | ${mark(r.mints)} | ${mark(r.deletes)} | ${mark(r.verifies)} | ${mark(r.warnSwallow)} | ${mark(r.cleanupFeedsVerdict)}`);
  // the suspect shape: mints + deletes but NO verification anywhere
  if (r.mints && r.deletes && !r.verifies) suspects.push(r.f);
}
console.log("\n=== SUSPECTS (mints + deletes, zero verification) ===");
console.log(suspects.length ? suspects.join("\n") : "(none)");

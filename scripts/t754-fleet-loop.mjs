/**
 * t754-fleet-loop — the ceremony's exit-code fleet loop: run every unit
 * probe (34) and every verdict assert (4) through unit-runner, count
 * exits, print the piece count. Zero code surgery window (qa ceremony):
 * this loop IS the verification net, persisted so the next window can
 * re-run or extend it without re-deriving the roster.
 *
 * Law: each piece must exit 0. The loop reports per-piece and the total.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const SCRIPTS = path.dirname(new URL(import.meta.url).pathname);
const runner = path.join(SCRIPTS, "unit-runner.mjs");

const units = fs
  .readdirSync(SCRIPTS)
  .filter((f) => f.endsWith("-unit.mjs") && f !== "unit-runner.mjs")
  .sort();
const asserts = ["t647-assert.mjs", "t648-assert.mjs", "t649-assert.mjs", "t650-assert.mjs"];
const roster = [...units, ...asserts];

let pass = 0;
const fails = [];
for (const probe of roster) {
  const r = spawnSync("node", [runner, path.join(SCRIPTS, probe)], {
    encoding: "utf8",
    timeout: 120_000,
  });
  const ok = r.status === 0;
  if (ok) pass++;
  else fails.push(probe);
  console.log(`  ${ok ? "✓ PASS" : "✗ FAIL"}  ${probe}  ${r.status}`);
}

console.log(`\nFLEET: ${pass}/${roster.length} green (exit-code channel)`);
if (fails.length) {
  console.log(`failed: ${fails.join(", ")}`);
  process.exit(1);
}

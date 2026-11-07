#!/usr/bin/env node
/**
 * t1165 — the route-guard census: every route.ts verb vs the isLocalRequest
 * guard. A route with zero exported verbs is skipped (not a door).
 * Output: unguarded doors only (the census's RED rows), then a summary.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const API = join(ROOT, "src", "app", "api");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

const routes = walk(API);
const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
let doors = 0;
const unguarded = [];
const lateGuards = [];
const partial = [];

for (const file of routes) {
  const src = readFileSync(file, "utf8");
  const verbs = VERBS.filter((v) =>
    new RegExp(`export\\s+(async\\s+function|const)\\s+${v}\\b`).test(src)
  );
  if (verbs.length === 0) continue;
  doors++;
  const guarded = src.includes("isLocalRequest");
  if (!guarded) unguarded.push({ file: relative(ROOT, file), verbs });
  // t879 — the ORDERING law, phase 2 of the census: a guard that answers
  // AFTER the verb's first data-touch (db.*, findEffectiveJob, getRun, the
  // fs walkers) leaks an existence oracle to the drive-by — 404 for a
  // missing job, 403 for a live one, the difference a probe can read. The
  // drift lived in resolution-arc (findEffectiveJob ran before the door)
  // and escaped every presence-only pin; the ordering is now the law.
  // Comment/string noise is stripped the cheap way (line comments and the
  // doc blocks) — the scan only needs RELATIVE order, not a parse.
  const rel = relative(ROOT, file);
  for (const verb of verbs) {
    const vm = src.match(new RegExp(`export\\s+(?:async\\s+function|const)\\s+${verb}\\b`));
    if (!vm) continue;
    const body = stripNoise(src.slice(vm.index));
    const guard = body.indexOf("isLocalRequest(");
    const touch = body.search(/findEffectiveJob\(|db\.(job|edge|workspace|project|user)\.|getRun\(|readdirSync\(|readFileSync\(|statSync\(|existsSync\(/);
    if (guard === -1) continue; // the unguarded list already speaks it
    if (touch !== -1 && touch < guard) {
      lateGuards.push({ file: rel, verb, touchOffset: touch, guardOffset: guard });
    }
  }
}

/** strip line comments, block comments and single/double/template literal
 *  CONTENT for the ordering scan (a prose "db.job.findMany" in a doc block
 *  must not count as the verb's first touch — the resolution-arc cure's
 *  own comment names the disease it fixed). Escapes inside literals are
 *  tolerated: the scan is order-only, not a parser. */
function stripNoise(src) {
  let out = "";
  let i = 0;
  let lit = null;
  while (i < src.length) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    if (!lit && two === "//") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (!lit && two === "/*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (!lit && (c === '"' || c === "'" || c === "`")) {
      lit = c;
      out += " ";
      i++;
      continue;
    }
    if (lit && c === "\\") {
      i += 2;
      continue;
    }
    if (lit && c === lit) {
      lit = null;
      out += " ";
      i++;
      continue;
    }
    if (!lit) out += c;
    i++;
  }
  return out;
}

console.log(`route-guard census: ${doors} door files scanned (src/app/api/**/route.ts)`);
if (unguarded.length === 0) {
  console.log("UNGUARDED: none — every door file references isLocalRequest");
} else {
  console.log(`UNGUARDED: ${unguarded.length}`);
  for (const u of unguarded) console.log(`  ${u.file}  [${u.verbs.join(",")}]`);
}
if (lateGuards.length === 0) {
  console.log("LATE-GUARD: none — every door's guard answers before its first data-touch");
} else {
  console.log(`LATE-GUARD: ${lateGuards.length} — the existence-oracle drift (t879's law)`);
  for (const l of lateGuards)
    console.log(`  ${l.file} [${l.verb}] touch@+${l.touchOffset} < guard@+${l.guardOffset}`);
}
process.exit(unguarded.length === 0 && lateGuards.length === 0 ? 0 : 1);

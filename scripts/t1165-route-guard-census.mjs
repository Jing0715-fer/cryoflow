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
}

console.log(`route-guard census: ${doors} door files scanned (src/app/api/**/route.ts)`);
if (unguarded.length === 0) {
  console.log("UNGUARDED: none — every door file references isLocalRequest");
} else {
  console.log(`UNGUARDED: ${unguarded.length}`);
  for (const u of unguarded) console.log(`  ${u.file}  [${u.verbs.join(",")}]`);
}
process.exit(unguarded.length === 0 ? 0 : 1);

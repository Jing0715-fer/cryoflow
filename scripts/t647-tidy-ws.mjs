#!/usr/bin/env node
/** t647 — tidy whitespace left behind by the codemod: trailing spaces
 *  before a closing quote and doubled spaces INSIDE class strings.
 *  Guarded patterns only touch spaces preceded by a class-name char, so
 *  JSX indentation is untouched. */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = walk("/home/z/my-project/src");

let n = 0;
for (const p of FILES) {
  const before = readFileSync(p, "utf8");
  const after = before
    .replace(/([a-zA-Z0-9/[\]._-]) +"/g, "$1\"") // trailing run before a closing quote
    .replace(/([a-zA-Z0-9/[\]._-]) {2,}(?=[a-zA-Z-])/g, "$1 "); // doubled spaces inside a string
  if (after !== before) {
    writeFileSync(p, after);
    n++;
    console.log(`tidied: ${p.replace("/home/z/my-project/", "")}`);
  }
}
console.log(`done — ${n} files`);

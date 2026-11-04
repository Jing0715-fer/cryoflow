#!/usr/bin/env node
// t960 — inventory the "Internal server error" catch blocks.
// For each site: the enclosing catch signature, whether a console.error tag
// line precedes it, and whether the catch block carries extra lines.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project/src/app/api";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith(".ts")) files.push(p);
  }
})(ROOT);

let standard = 0;
const variants = [];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/Internal server error/i.test(lines[i])) continue;
    // walk back to the catch line
    let catchLine = -1;
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      if (/\}\s*catch\s*\(/.test(lines[j]) || /^catch\s*\(/.test(lines[j].trim())) { catchLine = j; break; }
    }
    // walk forward to the catch's closing brace (the line with lone `  }`)
    let endLine = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
      if (/^\s*\}\s*$/.test(lines[j])) { endLine = j; break; }
    }
    const block = lines.slice(catchLine >= 0 ? catchLine : i - 3, endLine + 1);
    const body = block.slice(1, -1); // between catch { and closing }
    const hasConsole = body.some((l) => /console\.error/.test(l));
    const onlyTwo = body.filter((l) => l.trim()).length === 2; // console.error + json return
    const shape = `${f}:${i + 1}`;
    if (hasConsole && onlyTwo && catchLine >= 0) {
      standard++;
    } else {
      variants.push({ at: shape, catch: catchLine >= 0 ? lines[catchLine].trim() : "(no catch found)", body: body.map((l) => l.trim()).join(" | ") });
    }
  }
}
console.log(`STANDARD (console.error + json, 2-line body): ${standard}`);
console.log(`VARIANTS: ${variants.length}`);
for (const v of variants) console.log(`\n  ${v.at}\n    catch: ${v.catch}\n    body: ${v.body}`);

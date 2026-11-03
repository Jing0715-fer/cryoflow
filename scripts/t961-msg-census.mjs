#!/usr/bin/env node
// t961 — the message-quality word-census: every { error: "..." } literal
// in src/app/api, ranked by the honesty axes (length, verb-no-object,
// empty/generic). The t960 audit unified the ISE dialect; this pass ranks
// the bespoke texts that remain.
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

const sites = [];
const LITERAL = /error:\s*"([^"]*)"/g;
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    let m;
    LITERAL.lastIndex = 0;
    while ((m = LITERAL.exec(line))) {
      sites.push({ f: f.replace("/home/z/my-project/", ""), line: i + 1, text: m[1] });
    }
  });
}

// honesty axes
const VERB_ONLY = /^(read|write|save|load|persist|update|delete|fetch|create|remove|open|parse|export|import|sync|restore|rename|revert|run|stop|cancel|retry|kill|move|copy|scan|search|upload|download|submit|send|connect|disconnect|start|build|compile|compute|render|save) failed$/i;
const GENERIC = /^(failed|error|unknown error|an error occurred|something went wrong|request failed|operation failed|action failed|no|none)$/i;

const buckets = { empty: [], verbOnly: [], generic: [], shortNoObject: [], ok: 0 };
for (const s of sites) {
  const t = s.text.trim();
  if (!t) { buckets.empty.push(s); continue; }
  if (VERB_ONLY.test(t)) { buckets.verbOnly.push(s); continue; }
  if (GENERIC.test(t)) { buckets.generic.push(s); continue; }
  // short (<24 chars) with no obvious object noun (no capitalized entity, no "the/x" pattern is hard —
  // use a lighter heuristic: <24 chars AND no space-noun-phrase (only a single word pair))
  if (t.length < 24 && !/\b(not|no|missing|invalid|required|already|cannot|can't|must|unknown|unsupported|mismatch|too|expired|not found)\b/i.test(t)) {
    buckets.shortNoObject.push(s);
    continue;
  }
  buckets.ok++;
}

console.log(`TOTAL {error: literal sites: ${sites.length}`);
for (const k of ["empty", "verbOnly", "generic"]) {
  console.log(`\n== ${k}: ${buckets[k].length}`);
  const seen = new Map();
  for (const s of buckets[k]) {
    const key = `${s.f}`;
    console.log(`  ${s.f}:${s.line} "${s.text}"`);
  }
}
console.log(`\n== shortNoObject (<24 chars, no negation word): ${buckets.shortNoObject.length}`);
{
  const byText = new Map();
  for (const s of buckets.shortNoObject) {
    const arr = byText.get(s.text) ?? [];
    arr.push(`${s.f}:${s.line}`);
    byText.set(s.text, arr);
  }
  for (const [text, at] of [...byText.entries()].sort((a, b) => a[1].length - b[1].length)) {
    console.log(`  "${text}" ×${at.length}  ${at.slice(0, 3).join(", ")}${at.length > 3 ? " …" : ""}`);
  }
}
console.log(`\nOK (object/reason named): ${buckets.ok}`);

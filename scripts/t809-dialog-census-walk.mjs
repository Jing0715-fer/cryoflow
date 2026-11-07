#!/usr/bin/env node
// t809 — the remaining dialog census: the FULL enumeration arm.
// t808's fresh-debt sweep found the old body-scroll shape on two manager cards;
// the t808 tail named the follow-up: walk EVERY remaining DialogContent and
// retire the question for good. This walk classifies each instantiation:
//   HOUSE  — the t804/t798 dialect: flex flex-col + overflow-hidden (+ pinned header + inner region)
//   BODYSCROLL — the OLD disease: overflow-y-auto rides the DialogContent ITSELF
//   PLAIN  — no overflow classes (small dialogs; Radix default, content grows unbounded)
//   CUSTOM — a className we must read by hand (dynamic or multi-line)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project/src";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) files.push(p);
  }
})(ROOT);

const instances = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  if (!src.includes("<DialogContent")) continue;
  // capture each instantiation with a window of following source (className may span lines)
  const re = /<DialogContent(?![A-Za-z])/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index;
    const window = src.slice(start, start + 2600);
    // stop at the end of the opening tag (first '>' that is not inside a string is hard;
    // practical heuristic: cut at '\n      >' or '/>' or '>' preceded by newline whitespace)
    // className extraction: from className= to the FIRST closing quote (the string itself,
    // never beyond — the greedy 900-char window swallowed inner JSX and produced false positives)
    let cls = "";
    const cs = window.search(/className=\{?["'`]/);
    if (cs !== -1) {
      const q = window[cs + window.slice(cs).match(/className=\{?/)[0].length];
      const rest = window.slice(cs + window.slice(cs).match(/className=\{?/)[0].length + 1);
      const end = rest.indexOf(q);
      if (end !== -1) cls = rest.slice(0, end);
    }
    const line = src.slice(0, start).split("\n").length;
    instances.push({ file: f.replace(ROOT + "/", ""), line, cls });
  }
}

const HOUSE = /flex-col[\s\S]*overflow-hidden|overflow-hidden[\s\S]*flex-col/;
const BODYSCROLL_SELF = /(^|\s)overflow-y-auto(\s|$)/;

let house = 0, bodyscroll = 0, plain = 0, custom = 0;
const rows = [];
for (const it of instances) {
  let kind;
  if (HOUSE.test(it.cls)) { kind = "HOUSE"; house++; }
  else if (BODYSCROLL_SELF.test(it.cls)) { kind = "BODYSCROLL"; bodyscroll++; }
  else if (it.cls.trim() === "") { kind = "PLAIN"; plain++; }
  else { kind = "READ"; custom++; }
  rows.push({ ...it, kind });
}

console.log(`total instantiations (non-ui-primitive files): ${instances.length}`);
console.log(`HOUSE ${house} | BODYSCROLL ${bodyscroll} | PLAIN ${plain} | READ(hand) ${custom}`);
console.log("");
for (const r of rows) {
  console.log(`${r.kind.padEnd(10)} ${r.file}:${r.line}`);
  if (r.kind === "READ") console.log(`   cls: ${r.cls.replace(/\s+/g, " ").slice(0, 220)}`);
}

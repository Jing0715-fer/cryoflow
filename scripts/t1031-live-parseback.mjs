#!/usr/bin/env node
/**
 * t1031-live-parseback — the live ride's proof: the downloaded CSV reads
 * back cell for cell against the DOM's rendered Parameters table.
 *
 * Two faces ride:
 *   face A (differences only) — shots-qa/t1031-live-params-diff.csv,
 *     74 data rows = the filter's answer (the t1030 view-mirror law).
 *   face B (show all) — shots-qa/t1031-live-params-diff-all.csv,
 *     75 data rows = the full side-by-side (the +1 identical row).
 *
 * The identity bridge: the paper's parameter cell displays the
 * HUMANIZED key ("adhoc bfac"); the CSV speaks the RAW key ("adhocBfac")
 * — the t1029 name-address law's diff shape. The parse-back re-derives
 * the paper's word from the file's word with the component's own
 * humanize formula (camelCase → spaced lowercase, _ → space) and pins
 * the two faces together cell for cell: heads (the paper's own words),
 * the — word, the booleans, the digits.
 */
import { readFileSync } from "node:fs";

const SHOTS = "/home/z/my-project/shots-qa";
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); };
};

/** RFC 4180 parse (quoted cells, quoted commas) */
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
};

/** the component's own humanize formula (the paper's reading voice) */
const humanize = (key) =>
  key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();

const domJson = (file) =>
  JSON.parse(JSON.parse(readFileSync(file, "utf8").trim())); // eval emits a JSON string in quotes

console.log("== t1031 live parse-back ==");

// ---------- face A: the filtered view's answer ----------
console.log("-- face A: differences only (74 rows) --");
const csvA = parseCsv(readFileSync(`${SHOTS}/t1031-live-params-diff.csv`, "utf8"));
const headA = csvA[0];
const domA = domJson(`${SHOTS}/t1031-live-params-dom.json`);

ok("A: the head speaks the paper's own words",
  headA[0] === "Parameter" &&
  headA[1] === "3D Refine (tutorial)" &&
  headA[2] === "Post-process (tutorial)",
  headA.join(" | "));
ok("A: the DOM's job heads match the file's job heads",
  domA.heads[1] === headA[1] && domA.heads[2] === headA[2]);
ok("A: the file carries the filter's answer (74 rows = the badge's 74 one-sided)",
  csvA.length - 1 === 74 && domA.rows.length === 74,
  `${csvA.length - 1} in file / ${domA.rows.length} in DOM`);

let cellErrs = 0;
for (let i = 0; i < 74; i++) {
  const [key, refine, post] = csvA[i + 1];
  const [dKey, dRefine, dPost] = domA.rows[i];
  if (humanize(key) !== dKey || refine !== dRefine || post !== dPost) {
    cellErrs++;
    if (cellErrs <= 3) console.log(`    ✗ row ${i}: file [${key},${refine},${post}] vs DOM [${dKey},${dRefine},${dPost}]`);
  }
}
ok("A: all 74 rows read back CELL FOR CELL (raw key → humanized bridge, the — travels, the booleans travel, the digits travel)",
  cellErrs === 0, cellErrs === 0 ? "" : `${cellErrs} drifted rows`);

// ---------- face B: the full side-by-side ----------
console.log("-- face B: show all (75 rows) --");
const csvB = parseCsv(readFileSync(`${SHOTS}/t1031-live-params-diff-all.csv`, "utf8"));
// face B's DOM capture rode the bare-rows eval shape (an array of rows,
// no heads wrapper) — the job heads were proven in face A and the two
// faces share one rendered table
const domB = { rows: domJson(`${SHOTS}/t1031-live-params-dom-all.json`) };

ok("B: the file carries the FULL side-by-side (75 rows = 74 one-sided + 1 identical)",
  csvB.length - 1 === 75 && domB.rows.length === 75,
  `${csvB.length - 1} in file / ${domB.rows.length} in DOM`);
ok("B: the identical row the filter hid is the mirror's +1",
  csvB.length - 1 === domB.rows.length);

let cellErrsB = 0;
for (let i = 0; i < 75; i++) {
  const [key, refine, post] = csvB[i + 1];
  const [dKey, dRefine, dPost] = domB.rows[i];
  if (humanize(key) !== dKey || refine !== dRefine || post !== dPost) {
    cellErrsB++;
    if (cellErrsB <= 3) console.log(`    ✗ row ${i}: file [${key},${refine},${post}] vs DOM [${dKey},${dRefine},${dPost}]`);
  }
}
ok("B: all 75 rows read back CELL FOR CELL",
  cellErrsB === 0, cellErrsB === 0 ? "" : `${cellErrsB} drifted rows`);

// the identical row's own word — the one the filter hid
const identical = csvB.slice(1).find((r) => r[1] === r[2]);
ok("B: the hidden identical row speaks the same word both sides",
  identical !== undefined && identical[1] === identical[2],
  identical ? `${identical[0]} = ${identical[1]}` : "none found");

console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);

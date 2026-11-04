#!/usr/bin/env node
/**
 * t1032-live-parseback — the roster door's live ride, read back as truth.
 *
 * The ride (on camera): the dashboard's spotlight roster opened on the
 * standing world (22 jobs); the jobs label row's CSV door clicked; the
 * file downloaded. THIS script reads the evidence back and proves the
 * paper's bytes cell for cell against the DOM's own words:
 *
 *   evidence 1 — shots-qa/t1032-live-roster-dom.json : the roster rows'
 *                spoken cells (name / status badge word / workspace chip /
 *                the row's second line, extracted from [data-roster-row]).
 *   evidence 2 — shots-qa/t1032-live-cards-dom.json  : the canvas cards'
 *                aria-labels ("{name} — {type label}, {status}") — the
 *                page's own Type vocabulary, bridged BY NAME (the world
 *                gate's fixture-dup: 0 makes the name the address).
 *   the file  — shots-qa/t1032-live-roster.csv       : the door's bytes.
 *
 * Asserts: the head speaks the paper's five words in order; the row count
 * is the roster's own; every row's five cells read back cell for cell —
 * the name-address (Job), the portrait's spoken name (Type, bridged
 * through the canvas's own aria-labels), the badge's word (Status), the
 * chip's word (Workspace), the full untruncated fact line (Detail — the
 * stay receipts travel whole: the display-economy law on camera).
 *
 * Run: node scripts/t1032-live-parseback.mjs
 */
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const domRows = JSON.parse(JSON.parse(readFileSync("/home/z/my-project/shots-qa/t1032-live-roster-dom.json", "utf8"))).rows;
const domCards = JSON.parse(JSON.parse(readFileSync("/home/z/my-project/shots-qa/t1032-live-cards-dom.json", "utf8"))).cards;
const csv = readFileSync("/home/z/my-project/shots-qa/t1032-live-roster.csv", "utf8");

// RFC-4180-ish reader matching the writer (chart-export.ts): quote anything
// holding comma/quote/newline, double the embedded quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", i = 0, q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ",") { row.push(cell); cell = ""; i++; continue; }
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    cell += c; i++;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

console.log("== t1032 live parse-back — the roster door's bytes vs the DOM ==");

const grid = parseCsv(csv).filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
const head = grid[0];
const body = grid.slice(1);

ok("the head speaks the paper's five words in the row's order",
  JSON.stringify(head) === JSON.stringify(["Job", "Type", "Status", "Workspace", "Detail"]),
  head.join(" | "));

ok("the file carries the roster's own row count (22)",
  body.length === 22 && domRows.length === 22, `file ${body.length} · dom ${domRows.length}`);

// the canvas's own Type vocabulary, bridged by name
const typeOf = new Map();
for (const c of domCards) {
  const m = /^(.*) — (.*), (?:completed|failed|running|idle|pending)$/.exec(c.label);
  if (m) typeOf.set(m[1], m[2]);
}
ok("the canvas answers every roster row's name (the name-address bridge)",
  domRows.every((r) => typeOf.has(r.name)), `${typeOf.size} cards speak`);

let cells = 0, bad = [];
for (let i = 0; i < Math.min(body.length, domRows.length); i++) {
  const [Job, Type, Status, Workspace, Detail] = body[i];
  const d = domRows[i];
  const wants = [
    ["Job", Job === d.name, d.name],
    ["Type", Type === typeOf.get(d.name), typeOf.get(d.name)],
    ["Status", Status === d.status, d.status],
    ["Workspace", Workspace === d.ws, d.ws],
    ["Detail", Detail === d.detail, d.detail],
  ];
  for (const [k, good, want] of wants) {
    if (good) { cells++; continue; }
    bad.push(`row ${i} (${d.name}) ${k}: file="${String(body[i][["Job","Type","Status","Workspace","Detail"].indexOf(k)])}" dom="${String(want)}"`);
  }
}
ok(`all five cells of all 22 rows read back cell for cell (${cells} cells)`,
  bad.length === 0, bad.length ? bad.slice(0, 3).join(" · ") : "the paper's bytes ARE the DOM's words");

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

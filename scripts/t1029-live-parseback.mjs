#!/usr/bin/env node
/**
 * t1029 live-ride parse-back — the downloaded CSVs must read the same
 * cells the rendered paper speaks (data-md), cell for cell. The t218
 * e2e's wire-relative doctrine at the t1029 grammar: no hard-coded
 * yesterday, every cell read from the document's own markdown.
 */
import { readFileSync } from "node:fs";

const ROOT = "/home/z/my-project";
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); };
};

const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

const parseTable = (head0, head1, mdText) => {
  const lines = mdText.split("\n");
  const headIdx = lines.findIndex((l) => l.startsWith("|") && l.includes(head0) && l.includes(head1));
  if (headIdx < 0) return null;
  const rows = [];
  for (let i = headIdx + 2; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith("|")) break;
    rows.push(l.split("|").slice(1, -1).map((c) => c.trim()));
  }
  return { head: lines[headIdx].split("|").slice(1, -1).map((c) => c.trim()), rows };
};

const cellEq = (a, b) => String(a) === String(b);

// the live bytes (downloaded through the doors this ride)
const invCsv = readFileSync(`${ROOT}/shots-qa/t1029-live-inventory.csv`, "utf8");
const curCsv = readFileSync(`${ROOT}/shots-qa/t1029-live-curves.csv`, "utf8");
// the live paper (the rendered document's own markdown)
const md = readFileSync(`${ROOT}/shots-qa/t1029-live-data-md.txt`, "utf8");

console.log("== t1029 live ride: the grids read the paper cell for cell ==");

const invRows = parseCsv(invCsv);
const curRows = parseCsv(curCsv);

ok("live: the inventory header speaks the septet",
  invRows[0]?.join(",") === "Job,Main map,Volumes,Peak,Δ winner,Agreement r,Weakest", invRows[0]?.join("/"));
ok("live: the curve header speaks the triad (no job_id)",
  curRows[0]?.join(",") === "Job,Curve,Verdict", curRows[0]?.join("/"));

const rosterPaper = parseTable("Job", "Main map", md);
ok("live: the roster table found in the rendered paper",
  !!rosterPaper && rosterPaper.rows.length === invRows.length - 1,
  rosterPaper ? `${rosterPaper.rows.length} paper rows vs ${invRows.length - 1} grid rows` : "no table");
ok("live: the inventory grid reads the paper cell for cell",
  !!rosterPaper &&
  rosterPaper.rows.every((cells, r) => cells.every((c, i) => cellEq(c, invRows[r + 1]?.[i]))),
  `${rosterPaper?.rows.length ?? 0} rows compared`);
ok("live: the winner row speaks +0.0 and self-r 1.00 in the grid",
  invRows[1]?.[4] === "+0.0" && invRows[1]?.[5] === "1.00", invRows[1]?.join(" | "));

const curvePaper = parseTable("Job", "Curve", md);
ok("live: the curve table found in the rendered paper",
  !!curvePaper && curvePaper.rows.length === curRows.length - 1,
  curvePaper ? `${curvePaper.rows.length} paper rows vs ${curRows.length - 1} grid rows` : "no table");
ok("live: the curve grid reads the paper cell for cell",
  !!curvePaper &&
  curvePaper.rows.every((cells, r) => cells.every((c, i) => cellEq(c, curRows[r + 1]?.[i]))),
  `${curvePaper?.rows.length ?? 0} rows compared`);
ok("live: the quoted verdict un-quotes to the paper's words (RFC 4180)",
  (curCsv).includes('"') && !!curvePaper &&
  curvePaper.rows.every((cells, r) => cellEq(cells[2], curRows[r + 1]?.[2])));

console.log(`== t1029 live parse-back ${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green ==`);
process.exit(fail === 0 ? 0 : 1);

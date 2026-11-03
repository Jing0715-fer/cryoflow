#!/usr/bin/env node
/**
 * t1033-live-parseback — the activity calendar's door, read back as truth.
 *
 * The ride (on camera): the dashboard's activity calendar opened on the
 * standing world (124 day cells); the header's CSV door clicked; the file
 * downloaded. THIS script reads the evidence back and proves the paper's
 * bytes cell for cell against the DOM's own words:
 *
 *   evidence 1 — shots-qa/t1033-live-heatmap-dom.json : the 124 cells'
 *                native tooltip words ("Oct 8: 5 touches · 2 created ·
 *                1 completed" / "Jun 14: 0 touches") — the paper's own
 *                reading voice, extracted from the live grid.
 *   evidence 2 — shots-qa/t1033-live-heatmap.csv      : the door's bytes.
 *   the bridge — the lib's OWN heatmapDayLabel (imported, never
 *                re-typed): the file's ISO address and the tooltip's
 *                short label are one father's two voices.
 *
 * Asserts: the head speaks the tooltip's facts in its reading order
 * (Date, Touched, Created, Completed); the file carries the calendar's
 * own 124 rows in the wire's order; every row's four cells read back
 * cell for cell — the address (the label bridge proves the row IS the
 * cell), the touch count (the tooltip's "N touches"), and the split
 * (created · completed) which the tooltip only speaks when EARNED —
 * a zero day's tooltip carries no split and the file's zeros stand
 * against the same silence.
 *
 * Run: node scripts/unit-runner.mjs scripts/t1033-live-parseback.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const { heatmapDayLabel } = await import(path.join(ROOT, "src/lib/heatmap-export.ts"));

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const titles = JSON.parse(readFileSync(path.join(ROOT, "shots-qa/t1033-live-heatmap-dom.json"), "utf8"));
const csv = readFileSync(path.join(ROOT, "shots-qa/t1033-live-heatmap.csv"), "utf8");

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", i = 0, q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
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

console.log("== t1033 live parse-back — the calendar door's bytes vs the DOM ==");

const grid = parseCsv(csv).filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
const head = grid[0];
const body = grid.slice(1);

ok("the head speaks the tooltip's facts in its reading order",
  JSON.stringify(head) === JSON.stringify(["Date", "Touched", "Created", "Completed"]),
  head.join(" | "));

ok("the file carries the calendar's own row count (124, the wire's order)",
  body.length === 124 && titles.length === 124, `file ${body.length} · dom ${titles.length}`);

// the tooltip's words, parsed back: "Oct 8: 5 touches · 2 created · 1 completed"
const TITLE_RE = /^(.+): (\d+) touch(?:es)?( · (\d+) created · (\d+) completed)?$/;
const dom = titles.map((t) => {
  const m = TITLE_RE.exec(t);
  if (!m) return null;
  return { label: m[1], touched: Number(m[2]), created: m[4] != null ? Number(m[4]) : null, completed: m[5] != null ? Number(m[5]) : null };
});
ok("every DOM title parses back (the tooltip's own grammar)",
  dom.every((d) => d !== null));

let cells = 0;
const bad = [];
for (let i = 0; i < Math.min(body.length, dom.length); i++) {
  const [Date_, Touched, Created, Completed] = body[i];
  const d = dom[i];
  const wants = [
    ["Date", d.label === heatmapDayLabel(Date_), `${d.label} ↔ ${heatmapDayLabel(Date_)}`],
    ["Touched", Number(Touched) === d.touched, String(d.touched)],
    ["Created", d.created == null ? (Created === "0") : Number(Created) === d.created,
      d.created == null ? "no split on the paper → the file's 0" : String(d.created)],
    ["Completed", d.completed == null ? (Completed === "0") : Number(Completed) === d.completed,
      d.completed == null ? "no split on the paper → the file's 0" : String(d.completed)],
  ];
  for (const [k, good, want] of wants) {
    if (good) { cells++; continue; }
    bad.push(`row ${i} (${Date_}) ${k}: file="${body[i][["Date","Touched","Created","Completed"].indexOf(k)]}" dom="${want}"`);
  }
}
ok(`all four cells of all 124 rows read back cell for cell (${cells} cells)`,
  bad.length === 0, bad.length ? bad.slice(0, 3).join(" · ") : "the paper's bytes ARE the DOM's words");

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

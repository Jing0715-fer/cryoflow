#!/usr/bin/env node
/**
 * t1029-csv-grammar-unit — the ONE-GRAMMAR instrument.
 *
 * The t1029 window paid the t1029-entry lead candidate: the session
 * report's CSV mouths spoke TWO dialects in ONE dialog — the header
 * families (the inventory t218, the curve verdicts t498) spoke the
 * snake_case machine keys while the deep tables (t1028) spoke the
 * paper's own head words. The weighing landed on the RE-KEY: the
 * header is the truth on camera (the t1019 grammar the deep tables
 * proved twice), the roster's names are unique addresses (the world
 * gate's fixture-dup: 0), the door stamp lives on the wire (t494), so
 *   1. inventoryCsv re-keys to the paper's OWN septet and speaks the
 *      paper's CELLS cell for cell (the "33.3%" word, the Δ, the 2-dec
 *      r, weakestCellOf) — and a pending cell speaks the paper's own
 *      "—" (the dash discipline the deep tables' CSVs already speak;
 *      the t218 blank-cell law retires WITH the snake_case keys);
 *   2. curveVerdictsCsv re-keys to the paper's OWN triad — the job_id
 *      column retires (the name is the address; the id stays on the
 *      wire where the door stamp lives);
 *   3. the timeline grid (t506) keeps its snake_case keys DELIBERATELY
 *      — it is the agent tool's twin (get_session_timeline speaks the
 *      same keys) and re-keying one twin would fork THAT well: two
 *      dialects, two audiences, one documented line between them.
 *
 * F band — source pins: the new headers stand, the old keys are gone,
 *          the timeline boundary holds, the dash cells ride, the
 *          dialog's bouncer arrays and tooltips speak the same words.
 * B band — the fixture parse-back: buildSessionReport renders a
 *          fixture roster + fixture curves into md bytes, the unit
 *          parses BOTH tables BACK from the paper, and the CSV
 *          builders must answer the SAME cells cell for cell — one
 *          grammar, one proof shape (the t1028 F4 law at the header
 *          scale), RFC 4180 quoting included.
 *
 * Census slot 45. Run: node scripts/unit-runner.mjs scripts/t1029-csv-grammar-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const QCLIB = path.join(ROOT, "src/lib/qc-report.ts");
const DIALOG = path.join(ROOT, "src/components/workflow/session-report-dialog.tsx");

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); };
};

const { buildSessionReport, inventoryCsv, curveVerdictsCsv } =
  await import(path.join(ROOT, "src/lib/qc-report.ts"));

console.log("== t1029 csv grammar unit ==");

// ---------- F band: the cure's words in the sources ----------
console.log("-- F band: source pins --");
const qc = readFileSync(QCLIB, "utf8");
const dlg = readFileSync(DIALOG, "utf8");

const SEPTET = ["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest"];
const TRIAD = ["Job", "Curve", "Verdict"];

// 1. the re-keyed headers stand
ok("lib: the inventory header speaks the paper's own septet",
  qc.includes('line(["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest"])'));
ok("lib: the curve header speaks the paper's own triad",
  qc.includes('line(["Job", "Curve", "Verdict"])'));
// 2. the snake_case keys are gone from the two builders
ok("lib: the snake_case septet header is gone",
  !qc.includes('["job", "main_map", "volumes", "peak_pct"'));
ok("lib: the snake_case triad header (job_id first) is gone",
  !qc.includes('["job_id", "job", "curve", "verdict"]'));
// 3. the timeline boundary holds — its OWN dialect stays (documented)
ok("lib: the timeline grid keeps its machine keys (the documented boundary)",
  qc.includes('["job_id", "job", "type", "workspace"'));
// 4. the dash discipline rides the re-keyed cells
ok("lib: a pending Peak speaks the paper's own —",
  qc.includes('const peak = o.peak ?? "—";'));
ok("lib: a pending Δ speaks — (deltaVsWinner ITSELF, never re-derived)",
  qc.includes('const delta = deltaVsWinner(o.peakPct, winnerPct) ?? "—";'));
ok("lib: the r cell keeps the 2-decimal paper grammar",
  qc.includes('const rCell = o.shapeR != null ? o.shapeR.toFixed(2) : "—";'));
// 5. the job_id column retired from the curve grid's bytes
ok("lib: the curve row speaks name/word/verdict (the stamp lives on the wire)",
  qc.includes("line([r.jobName, CURVE_KIND_LABELS[r.kind], r.verdict])"));
// 6. the paper's md heads and the CSV headers speak the SAME words
const mdRosterHead = qc.includes("| Job | Main map | Volumes | Peak | Δ winner | Agreement r | Weakest |");
const mdCurveHead = qc.includes("| Job | Curve | Verdict |");
ok("lib: the roster md head stands for the CSV to mirror", mdRosterHead);
ok("lib: the curve md head stands for the CSV to mirror", mdCurveHead);
// 7. the dialog's bouncer arrays repeat the builders' words (typed twice, pinned here)
ok("dialog: OWNER_HEAD repeats the septet verbatim",
  dlg.includes('const OWNER_HEAD = ["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest"]'));
ok("dialog: CURVE_HEAD repeats the triad verbatim",
  dlg.includes('const CURVE_HEAD = ["Job", "Curve", "Verdict"]'));
// 8. the tooltips speak the paper (the reader-facing words re-keyed too)
ok("dialog: the inventory door's tooltip speaks the paper's words",
  dlg.includes("as the paper speaks it — Job, Main map, Volumes, Peak, Δ winner") &&
  !dlg.includes("pending peaks blank") && !dlg.includes("machine grid — job, main map"));
ok("dialog: the curve door's tooltip drops the job_id column",
  dlg.includes("The curve verdict table as the paper speaks it — Job, Curve, Verdict") &&
  !dlg.includes("machine grid — job id, job, curve"));
// 9. the doors' faces unchanged (t218/t498 aria labels intact — bytes changed, doors did not)
ok("dialog: the four header doors keep their aria names",
  dlg.includes('aria-label="Copy map inventory CSV"') &&
  dlg.includes('aria-label="Download map inventory CSV"') &&
  dlg.includes('aria-label="Copy curve verdicts CSV"') &&
  dlg.includes('aria-label="Download curve verdicts CSV"'));

// ---------- B band: the fixture parse-back ----------
console.log("-- B band: the paper and the grids agree cell for cell --");

// a shaped fixture: a winner, a follower whose name carries a comma
// (RFC 4180 must quote it in the grid and mdCell must carry it in the
// paper), and a still-measuring owner (the — row)
const roster = [
  { jobId: "job-win", jobName: "Post-process (tutorial)", mainName: "postprocess_mask", volumeCount: 1, peak: "33.3%", peakPct: 33.3, shapeR: 1, weakest: { label: "Q1 (1.00)", r: 1, from: 0 } },
  { jobId: "job-fol", jobName: "QA Refine, phase B", mainName: "refine_mask", volumeCount: 1, peak: "52.6%", peakPct: 52.6, shapeR: -0.42, weakest: { label: "Q3 (-0.61)", r: -0.61, from: 0.5 } },
  { jobId: "job-pen", jobName: "still measuring", mainName: "pending_map", volumeCount: 2, peak: null, peakPct: null, shapeR: null, weakest: null },
];
const curves = [
  { jobId: "job-a", jobName: "Post-process (tutorial)", kind: "fsc", verdict: "FSC 0.143 at 4.1 Å — masked final" },
  { jobId: "job-b", jobName: "QA Refine, phase B", kind: "guinier", verdict: 'B-factor -21.5 Å², "used for sharpening"' },
  { jobId: "job-c", jobName: "CTF Estimation 1", kind: "ctf", verdict: "Defocus 1.9 µm — fit beyond 6.2 Å" },
];

const md = buildSessionReport({
  projectName: "β-Galactosidase Tutorial (demo)",
  pipeline: null,
  mapQc: null,
  mapPending: false,
  mapError: false,
  mapInventory: roster,
  sweep: null,
  curves,
  curvesPending: false,
  curvesError: false,
  timeline: null,
});

/** parse an md table's head + body rows into string-cell arrays (the
 *  paper's own bytes — the truth the grids must speak) */
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

/** an RFC 4180 reader — quoted cells, doubled quotes, commas inside */
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

const cellEq = (a, b) => String(a) === String(b);

// the INVENTORY grid vs the paper's roster table
const invCsv = inventoryCsv(roster);
ok("B: inventoryCsv answers a settled roster", typeof invCsv === "string" && !!invCsv);
const invRows = parseCsv(invCsv ?? "");
const rosterPaper = parseTable("Job", "Main map", md);
ok("B: the roster table parsed from the paper", !!rosterPaper && rosterPaper.rows.length === 3,
  rosterPaper ? `${rosterPaper.rows.length} body rows` : "no table");
ok("B: the inventory header is the paper's own septet, word for word",
  invRows.length > 0 && invRows[0].length === 7 &&
  SEPTET.every((w, i) => cellEq(invRows[0][i], w)),
  invRows[0]?.join("/"));
ok("B: the inventory header == the paper's head, cell for cell",
  !!rosterPaper && invRows[0].length === rosterPaper.head.length &&
  rosterPaper.head.every((c, i) => cellEq(c, invRows[0][i])));
ok("B: the inventory grid reads the paper cell for cell (winner, comma name, — row)",
  !!rosterPaper &&
  rosterPaper.rows.every((cells, r) =>
    cells.every((c, i) => cellEq(c, invRows[r + 1]?.[i]))),
  invRows[1]?.join(" | "));
ok("B: the still-measuring row speaks the paper's own — in the grid",
  invRows[3]?.slice(3).every((c) => c === "—"),
  invRows[3]?.join(" | "));
ok("B: the comma name is quoted in the bytes and un-quoted by the reader (RFC 4180)",
  (invCsv ?? "").includes('"QA Refine, phase B"') && invRows[2]?.[0] === "QA Refine, phase B");

// the CURVE grid vs the paper's verdict table
const curCsv = curveVerdictsCsv(curves);
ok("B: curveVerdictsCsv answers a settled walk", typeof curCsv === "string" && !!curCsv);
const curRows = parseCsv(curCsv ?? "");
const curvePaper = parseTable("Job", "Curve", md);
ok("B: the curve table parsed from the paper", !!curvePaper && curvePaper.rows.length === 3,
  curvePaper ? `${curvePaper.rows.length} body rows` : "no table");
ok("B: the curve header is the paper's own triad, word for word",
  curRows.length > 0 && curRows[0].length === 3 &&
  TRIAD.every((w, i) => cellEq(curRows[0][i], w)),
  curRows[0]?.join("/"));
ok("B: the curve header == the paper's head, cell for cell",
  !!curvePaper && curRows[0].length === curvePaper.head.length &&
  curvePaper.head.every((c, i) => cellEq(c, curRows[0][i])));
ok("B: the curve grid reads the paper cell for cell (verdict verbatim, passport included)",
  !!curvePaper &&
  curvePaper.rows.every((cells, r) =>
    cells.every((c, i) => cellEq(c, curRows[r + 1]?.[i]))),
  curRows[1]?.join(" | "));
ok("B: no job_id column rides the curve grid (the stamp stays on the wire)",
  curRows[0]?.length === 3 && !curRows.flat().some((c) => /^job-[abc]$/.test(c)));

// the honest guards
ok("B: a null roster refuses (a silent empty file would be a lying door)",
  inventoryCsv(null) === null && inventoryCsv([]) === null);
ok("B: a null curve walk refuses",
  curveVerdictsCsv(null) === null && curveVerdictsCsv([]) === null);

console.log(`== t1029-csv-grammar-unit ${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green ==`);
process.exit(fail === 0 ? 0 : 1);

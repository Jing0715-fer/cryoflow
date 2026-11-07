#!/usr/bin/env node
/**
 * t1028-session-export-unit — the deep tables' data doors' instrument.
 *
 * The t1028 window paid the t1028-entry candidate "session QC report
 * expansion — the t1019 export law could visit the QC report's tables".
 * The visit found the honest shape: the session report's FOUR md table
 * families had TWO mouths at the dialog header (the inventory t218, the
 * curve verdicts t498) and THREE orphans in the deep prose — Comparison,
 * Local agreement, Pairwise (the tables buildProfileReport details).
 * The cure, two cars:
 *   1. qc-report.ts grows the three ROW BUILDERS (comparisonMapsRows /
 *      localAgreementRows / pairwiseAgreementRows) drinking the SAME
 *      well buildProfileReport drank (ProfileWell: mainBins + overlays
 *      — measureMapQc's product, no second father) and speaking the
 *      SAME cells the paper prints; the row KEYS are the paper's own
 *      head words (the ChartExportButtons CSV header is the truth on
 *      camera — the t1019 grammar).
 *   2. session-report-dialog.tsx mounts the doors at the three deep
 *      tables (png={false} — a list owns no <svg> to rasterize; the
 *      PNG doors are ABSENT, never disabled) and the pairwise family
 *      joins the wire grammar as the FIFTH table (PairwiseTableContext,
 *      the thead reset grows with it).
 *
 * F band — source pins on both cars (the laws' words in the sources).
 * B band — the fixture parse-back: buildProfileReport renders a fixture
 *          well into md bytes, the unit parses the three tables' cells
 *          BACK from the paper, and the row builders must answer the
 *          SAME cells cell for cell — one well, every mouth, proven.
 *          Plus the honest guards: null well refuses, empty overlays
 *          refuse, a single overlay refuses pairwise only.
 *
 * Census slot 44. Run: node scripts/unit-runner.mjs scripts/t1028-session-export-unit.mjs
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

const { buildProfileReport, comparisonMapsRows, localAgreementRows, pairwiseAgreementRows } =
  await import(path.join(ROOT, "src/lib/qc-report.ts"));

console.log("== t1028 session export unit ==");

// ---------- F band: the cure's words in the sources ----------
console.log("-- F band: source pins --");
const qc = readFileSync(QCLIB, "utf8");
const dlg = readFileSync(DIALOG, "utf8");

// 1. the three builders exist and drink the well
ok("lib: the three row builders stand",
  qc.includes("export const comparisonMapsRows") &&
  qc.includes("export const localAgreementRows") &&
  qc.includes("export const pairwiseAgreementRows"));
// 2. the ProfileWell type — the builders' one father
ok("lib: the ProfileWell type names the well", qc.includes("export type ProfileWell"));
// 3. the well guard refuses the unsettled walk (null mainBins / empty overlays)
ok("lib: the wellOpen guard refuses null/empty wells",
  qc.includes("const wellOpen = (well: ProfileWell | null)") &&
  qc.includes("well.mainBins.length > 0") && qc.includes("well.overlays.length > 0"));
// 4. the builders speak the paper's OWN arithmetic (resample-then-pearson, quarter bands)
ok("lib: comparison drinks the resample-pearson path",
  qc.includes("pearson(resampleByFraction(o.bins, n), mainBins)"));
ok("lib: local drinks the quarter-band path",
  qc.includes("localAgreement(mainBins, o.bins)") && qc.includes("weakestBand(bands)"));
ok("lib: pairwise rides the pairwiseAgreement walk", qc.includes("pairwiseAgreement(well.overlays)"));
// 5. the honest dash discipline — every builder keeps the paper's "—"
ok("lib: the — discipline rides all three builders",
  (qc.match(/Number\.isNaN\(r\) \? "—" : r\.toFixed\(2\)/g) ?? []).length >= 2);
// 6. the pairwise builder keeps the paper's own guard (TWO terrains or none)
ok("lib: the pairwise guard is the paper's overlays.length < 2",
  qc.includes("well.overlays.length < 2"));
// 7. the dialog mounts the face at all three deep tables, png={false}
ok("dialog: three deepTableDoors mounts with the three names",
  (dlg.match(/deepTableDoors\(/g) ?? []).length === 3 &&
  dlg.includes('"Comparison maps"') && dlg.includes('"Local agreement"') &&
  dlg.includes('"Pairwise agreement"'));
// 8. the doors' shape is the t1019 law — png={false} at the shared mount
ok("dialog: the shared mount ships png={false} (absent, never disabled)",
  dlg.includes("png={false}") && dlg.includes("getRows={getRows}"));
// 9. the pairwise family joins the wire grammar (the fifth context + reset)
ok("dialog: PairwiseTableContext declared and reset at the thead",
  (dlg.match(/PairwiseTableContext/g) ?? []).length >= 4 &&
  dlg.includes("const PairwiseTableContext = React.createContext(false);"));
// 10. the pairwise head's exact-words bouncer
ok("dialog: PAIRWISE_HEAD matched EVERY cell at once",
  dlg.includes('const PAIRWISE_HEAD = ["Map A", "Map B", "Agreement r", "Verdict", "Depth (fraction)"]') &&
  dlg.includes("PAIRWISE_HEAD.every((h, i) => headTexts[i] === h)"));
// 11. the honest-closure law — the doors' well re-closes on mapQc
ok("dialog: profileWell reads mapQc inside the mdComponents memo",
  dlg.includes("mainBins: mapQc?.mainBins ?? null") &&
  dlg.includes("overlays: mapQc?.overlays ?? null"));
ok("dialog: mapQc rides the memo's deps (the closure cannot go stale)",
  /}, \[mapInventory, mapQc, pressOwner, curves\]\)/.test(dlg));

// ---------- B band: the fixture parse-back ----------
console.log("-- B band: the paper and the grid agree cell for cell --");

// a shaped fixture: a winner landscape with one clear peak, one follower,
// one divergent terrain (its mass sits in a different quarter)
const mainBins = [0.02, 0.03, 0.05, 0.09, 0.16, 0.27, 0.41, 0.52, 0.58, 0.55,
                  0.47, 0.38, 0.29, 0.21, 0.15, 0.11, 0.08, 0.06, 0.04, 0.03];
const overlays = [
  { name: "half map A", bins: mainBins.map((v, i) => v * (0.94 + 0.02 * Math.sin(i))) },
  { name: "masked variant", bins: mainBins.map((_, i) => (i > 13 ? 0.42 : 0.08) + (i % 3) * 0.01) },
];
const well = { mainBins, overlays };

const md = buildProfileReport({
  mapName: "main map",
  jobId: "job_fixture",
  axis: "z",
  bins: mainBins,
  overlays,
  pendingOverlays: 0,
});

/** parse an md table's body rows into string-cell arrays (the paper's
 *  own bytes — the truth the doors must speak) */
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

// the COMPARISON table — the paper's cells vs the builder's rows
const cmpPaper = parseTable("Map", "Bins", md);
ok("B: the comparison table parsed from the paper", !!cmpPaper && cmpPaper.rows.length === 2,
  cmpPaper ? `${cmpPaper.rows.length} body rows` : "no table");
const cmpRows = comparisonMapsRows(well);
ok("B: comparisonMapsRows answers", !!cmpRows && cmpRows.length === 2);
const CMP_HEAD = ["Map", "Bins", "Peak at", "Agreement r", "Verdict"];
ok("B: the comparison keys are the paper's own head words",
  !!cmpRows && JSON.stringify(Object.keys(cmpRows[0])) === JSON.stringify(CMP_HEAD),
  cmpRows ? Object.keys(cmpRows[0]).join("/") : "—");
ok("B: the comparison grid reads the paper cell for cell",
  !!cmpRows && !!cmpPaper &&
  cmpPaper.rows.every((cells, r) =>
    CMP_HEAD.every((_, c) => cellEq(cells[c], cmpRows[r][CMP_HEAD[c]]))),
  cmpRows ? cmpRows.map((r) => `${r.Map}:${r["Agreement r"]}`).join(" · ") : "—");

// the LOCAL agreement table
const locPaper = parseTable("Map", "Q1", md);
ok("B: the local table parsed from the paper", !!locPaper && locPaper.rows.length === 2);
const locRows = localAgreementRows(well);
ok("B: localAgreementRows answers", !!locRows && locRows.length === 2);
const LOC_HEAD = ["Map", "Q1 (0–25%)", "Q2 (25–50%)", "Q3 (50–75%)", "Q4 (75–100%)", "Weakest", "Depth (fraction)"];
ok("B: the local keys are the paper's own head words",
  !!locRows && JSON.stringify(Object.keys(locRows[0])) === JSON.stringify(LOC_HEAD));
ok("B: the local grid reads the paper cell for cell",
  !!locRows && !!locPaper &&
  locPaper.rows.every((cells, r) =>
    LOC_HEAD.every((_, c) => cellEq(cells[c], locRows[r][LOC_HEAD[c]]))),
  locRows ? locRows.map((r) => `${r.Map}:${r.Weakest}`).join(" · ") : "—");

// the PAIRWISE table
const pwPaper = parseTable("Map A", "Map B", md);
ok("B: the pairwise table parsed from the paper", !!pwPaper && pwPaper.rows.length === 1,
  pwPaper ? `${pwPaper.rows.length} pair row` : "no table");
const pwRows = pairwiseAgreementRows(well);
ok("B: pairwiseAgreementRows answers", !!pwRows && pwRows.length === 1);
const PW_HEAD = ["Map A", "Map B", "Agreement r", "Verdict", "Depth (fraction)"];
ok("B: the pairwise keys are the paper's own head words",
  !!pwRows && JSON.stringify(Object.keys(pwRows[0])) === JSON.stringify(PW_HEAD));
ok("B: the pairwise grid reads the paper cell for cell",
  !!pwRows && !!pwPaper &&
  pwPaper.rows.every((cells, r) =>
    PW_HEAD.every((_, c) => cellEq(cells[c], pwRows[r][PW_HEAD[c]]))),
  pwRows ? pwRows.map((r) => `${r["Map A"]}×${r["Map B"]}:${r["Agreement r"]}`).join(" · ") : "—");

// the honest guards
ok("B: a null well refuses all three mouths",
  comparisonMapsRows(null) === null && localAgreementRows(null) === null &&
  pairwiseAgreementRows(null) === null);
ok("B: an empty overlays well refuses all three",
  comparisonMapsRows({ mainBins, overlays: [] }) === null &&
  localAgreementRows({ mainBins, overlays: [] }) === null &&
  pairwiseAgreementRows({ mainBins, overlays: [] }) === null);
ok("B: a single overlay speaks comparison+local but refuses pairwise (the paper's own guard)",
  comparisonMapsRows({ mainBins, overlays: [overlays[0]] })?.length === 1 &&
  localAgreementRows({ mainBins, overlays: [overlays[0]] })?.length === 1 &&
  pairwiseAgreementRows({ mainBins, overlays: [overlays[0]] }) === null);
ok("B: a null mainBins well refuses (the walk has not settled)",
  comparisonMapsRows({ mainBins: null, overlays }) === null);

console.log(`== t1028-session-export-unit ${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green ==`);
process.exit(fail === 0 ? 0 : 1);

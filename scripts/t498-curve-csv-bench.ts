/**
 * t498 — the verdicts learn to travel: the fourth family's machine
 * grid. The report's export family had three machine faces (report md,
 * map-inventory CSV, portable HTML echo) and the paper's verdict table
 * — 15 rows of judgments the walk measures — had none. The grid follows
 * the PAPER (t493's ㉙ answered): the verdict cell is the verdict string
 * VERBATIM (passport included — the paper is the well; a re-worded
 * machine copy would be a second father), the curve column speaks
 * CURVE_KIND_LABELS (never retyped), and the grid carries job_id — the
 * machine face of the door stamp. The dialog's new door obeys the
 * inventory's two-mouth contract (t232): one builder, honest
 * empty-state refusals, the copyOrFallback ladder, the same receipts.
 *
 *   T1 the grid      — behavioral: header, body order, RFC 4180
 *                      quoting, null refusals, filename grammar
 *   T2 one well      — the grid imports the paper's own vocabulary;
 *                      the verdict cell never re-words
 *   T3 the mouth     — the dialog wires one builder through two
 *                      mouths with honest refusals per state
 *   T4 honest bytes  — the paper (md builder), the HTML echo and the
 *                      CSV bytes carry no door markers and no grid
 *                      references where they don't belong
 *   T5 the neighbors — the inventory grid and its dialect untouched
 */

import { readFileSync } from "fs";

/* t503 — the checkout moves between sandbox resets (my-project era ->
 * cryoflow home); resolve the repo root from THIS file, not a
 * hardcoded absolute path that rots the bench the moment the tree moves. */
const REPO = (await import("node:path")).default.resolve(
  (await import("node:url")).fileURLToPath(new URL(".", import.meta.url)),
  "..",
);
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}

const read = (p: string): string => readFileSync(`${REPO}/${p}`, "utf8");
const { curveVerdictsCsv, curveVerdictsCsvFilename, inventoryCsv, inventoryCsvFilename } = await import("../src/lib/qc-report");

const qcSrc = read("src/lib/qc-report.ts");
const dialogSrc = read("src/components/workflow/session-report-dialog.tsx");

const rows = [
  { jobId: "job-aaa", jobName: "Post-process (tutorial)", kind: "fsc" as const, verdict: "FSC 0.143 at 4.1 Å — masked final" },
  { jobId: "job-bbb", jobName: "QA Refine 410, phase B", kind: "guinier" as const, verdict: 'B-factor -21.5 Å², "used for sharpening"' },
  { jobId: "job-ccc", jobName: "CTF Estimation 1", kind: "ctf" as const, verdict: "Defocus 1.9 µm — fit beyond 6.2 Å" },
];

// ---------------------------------------------------------------- T1
section("T1 the grid — behavioral: header, quoting, refusals, filename");
const csv = curveVerdictsCsv(rows);
ok(csv !== null, "a settled roster produces grid bytes");
ok(csv?.startsWith("job_id,job,curve,verdict\n") === true, "the header speaks the four machine columns");
ok(csv?.includes("job-aaa,Post-process (tutorial),FSC,FSC 0.143 at 4.1 Å — masked final") === true, "a comma-free row travels unquoted, verdict verbatim");
ok(csv?.includes('job-bbb,"QA Refine 410, phase B",Guinier,') === true, "quoting is per-cell (the job id stays bare while its name is quoted)");
ok(csv?.includes('"QA Refine 410, phase B"') === true, "a name carrying a comma is quoted (RFC 4180)");
ok(csv?.includes('"B-factor -21.5 Å², ""used for sharpening"""') === true, "a verdict carrying commas AND quotes is quoted with doubled quotes (RFC 4180)");
ok(csv?.split("\n").length === 4, "one line per spoken row (header + three)");
ok(csv?.split("\n")[1]?.startsWith("job-aaa,") === true, "body rows keep the walk's order (no re-sort, no network order)");
ok(curveVerdictsCsv(null) === null && curveVerdictsCsv([]) === null, "null and empty rosters refuse (an empty file would be a lying door)");
const fname = curveVerdictsCsvFilename();
ok(/^session-curve-verdicts-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/.test(fname), "the filename follows the t218 timestamp grammar under its own flag");
ok(fname !== inventoryCsvFilename() && curveVerdictsCsv(rows) !== inventoryCsv([{ jobName: "x", mainName: "y", volumeCount: 1, peak: null, peakPct: null }]), "the verdicts' grid is not the inventory's grid (own name, own columns)");

// ---------------------------------------------------------------- T2
section("T2 one well — the grid speaks the paper's vocabulary");
ok(/CURVE_KIND_LABELS\[r\.kind\]/.test(qcSrc), "the curve column is the paper's own word (the label map, never retyped)");
ok(!/kind === "fsc" \? "FSC"/.test(qcSrc) && !/"FSC" : kind ===/.test(qcSrc), "no raw-token twin vocabulary (a second map would fork the well)");
ok(/line\(\[r\.jobId, r\.jobName, CURVE_KIND_LABELS\[r\.kind\], r\.verdict\]\)/.test(qcSrc), "the verdict cell is the row's verdict VERBATIM (no re-wording, no re-rounding)");
ok(/\| \$\{mdCell\(row\.jobName\)\} \| \$\{CURVE_KIND_LABELS\[row\.kind\]\} \| \$\{mdCell\(row\.verdict\)\}\|/.test(qcSrc.replace(/\s+/g, " ")) || /\$\{CURVE_KIND_LABELS\[row\.kind\]\}/.test(qcSrc), "the md table and the grid drink the same label map (one vocabulary, two faces)");

// ---------------------------------------------------------------- T3
section("T3 the mouth — one builder, two mouths, honest refusals");
ok(/import \{[\s\S]*?curveVerdictsCsv[\s\S]*?\} from "@\/lib\/qc-report"/.test(dialogSrc) || /curveVerdictsCsv,/.test(dialogSrc), "the dialog imports the grid's single builder");
ok(/const exportCurveCsv = async \(mode: "copy" \| "download"\)/.test(dialogSrc), "the mouth speaks both dialects (copy + download), one function");
ok(/curveVerdictsCsv\(curves \?\? null\)/.test(dialogSrc), "the builder drinks the table's OWN array (the grid can never disagree with the paper it mirrors)");
ok(/The curve verdicts are still reading — no CSV yet/.test(dialogSrc), "a pending walk refuses with the wait named (a silent no-op is a lying door)");
ok(/No curve verdicts to export yet/.test(dialogSrc), "a settled-empty roster refuses with its own truth (not the pending line)");
ok(/copyOrFallback\(\s*\n\s*csv,\s*\n\s*curveVerdictsCsvFilename\(\)/.test(dialogSrc), "copy rides the t233 ladder under the grid's own filename");
ok(/downloadText\(curveVerdictsCsvFilename\(\), csv, "text\/csv;charset=utf-8"\)/.test(dialogSrc), "download ships text/csv under the grid's own filename");
ok(/aria-label="Copy curve verdicts CSV"/.test(dialogSrc) && /aria-label="Download curve verdicts CSV"/.test(dialogSrc), "both doors say their name to the ear");

// ---------------------------------------------------------------- T4
section("T4 honest bytes — the paper and the echo stay plain");
const mdBuilder = qcSrc.slice(qcSrc.indexOf("export const buildSessionReport"), qcSrc.indexOf("export const sessionReportFilename"));
ok(!mdBuilder.includes("curveVerdictsCsv"), "the md builder carries no grid reference (the paper's bytes keep their table)");
ok(!/data-curve-door|data-owner-door/.test(qcSrc), "no door markers in the exported bytes (doors live on screen — the t483 law)");
ok(!/data-curve-door|data-owner-door/.test(curveVerdictsCsv(rows) ?? ""), "the grid's own bytes carry no door markers either (a CSV opens in a spreadsheet, not the app)");
const htmlBuilder = qcSrc.slice(qcSrc.indexOf("buildSessionReportHtml"), qcSrc.indexOf("export const sessionReportFilename") > 0 ? qcSrc.indexOf("export const sessionReportFilename") : qcSrc.length);
ok(!htmlBuilder.includes("curveVerdictsCsv"), "the HTML echo carries no grid reference (the portable page has no app to open)");

// ---------------------------------------------------------------- T5
section("T5 the neighbors — the inventory grid keeps its dialect");
ok(/export const inventoryCsv = \(rows: InventoryCsvRow\[\] \| null\): string \| null =>/.test(qcSrc), "the inventory grid's builder untouched");
ok(/line\(\["job", "main_map", "volumes", "peak_pct", "delta_winner", "shape_r", "thinnest"\]\)/.test(qcSrc), "the inventory header row intact (seven machine columns)");
ok((qcSrc.match(/\[",\\n\]/g) ?? []).length >= 2, "the RFC 4180 minimal-quote dialect shared by both grids (the same guard, twice — twins fork, imports don't)");
ok(/export const curveVerdictsCsv = \(rows: CurveVerdictRow\[\] \| null\): string \| null =>/.test(qcSrc), "the verdicts' builder sits beside its own row type (one CurveVerdictRow, two faces)");

console.log(`\n----\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

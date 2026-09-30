/**
 * t509-funnel-csv-bench.ts — The Ledger Learns the Grid.
 *
 * The funnel ledger had four faces — the dialog's bars (the shape),
 * the copy button's prose (t463), the agent's tool (t468) — but no
 * MACHINE grid: a script asking "where did my particles go" had to
 * re-walk the canvas or parse prose. t509 gives the ledger its CSV:
 * one row per mainline station, the walk's own edge verbs in cells,
 * blanks where the receipt said nothing countable — same rows, same
 * well, a new reader.
 *
 *   T1  the grid     — funnelLedgerCsv: eleven columns, machine
 *                      digits, amber blanks, edge verbs, RFC 4180
 *   T2  the flag     — the chain's host name rides the filename
 *   T3  the door     — the dialog's second button drinks the SAME
 *                      payload the bars and the copy drink
 *   T4  neighbors    — the prose twin, the agent face and the
 *                      roster keep their bytes
 *   T5  laws         — machine digits (no toLocaleString), \n join,
 *                      the prose voice never leaks into cells
 */

import { readFileSync } from "fs";
import path from "path";
import { funnelLedgerCsv, funnelLedgerCsvFilename, type FunnelRow } from "../src/lib/particle-funnel";
import { AI_TOOLS } from "../src/lib/ai/tools";

const REPO = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(REPO, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${msg}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${msg}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);

const row = (over: Partial<FunnelRow>): FunnelRow => ({
  jobId: `job-${Math.random().toString(36).slice(2, 7)}`,
  type: "extract",
  name: "Extract 1",
  count: 1000,
  unit: "particles",
  classes: null,
  subnote: null,
  kind: "ok",
  width: 0.5,
  perMic: null,
  delta: null,
  ...over,
});

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
};

/* ------------------------------------------------------------------ */
section("T1 — the grid (eleven columns, the walk's own truths)");

const LEDGER_ROWS: FunnelRow[] = [
  row({ name: "Import Movies 1", type: "import", count: 24, unit: "micrographs", perMic: null, delta: null }),
  row({ name: "Motion Correction 1", type: "motioncorr", count: 24, unit: "micrographs", delta: { line: "all 24 carried through", kind: "carry" } }),
  row({ name: "Auto-Pick 1", type: "autopick", count: 1234567, unit: "picks", perMic: 51.4, delta: { line: "1,234,567 picks across 24 micrographs — 51.4 per micrograph", kind: "transform" } }),
  row({ name: "Class 2D 1", type: "class2d", count: 987654, unit: "particles", classes: 50, delta: { line: "−246,913 · 20% lost at class2d", kind: "shed" } }),
  row({ name: "Sym Expand 1", type: "symexpand", count: 1975308, unit: "particles", subnote: "expand factor ×2.0", delta: { line: "+987,654 · ×2.0 at symexpand", kind: "gain" } }),
  row({ name: "CTF Estimation 1", type: "ctf", count: null, unit: null, kind: "amber", subnote: "status: completed", delta: null }),
];

const csv = funnelLedgerCsv({ rows: LEDGER_ROWS });
ok(csv !== null, "a ledger with stations produces a grid");
const grid = parseCsv(csv!);
ok(
  grid[0].join(",") === "stage,job_id,station,job_type,kind,unit,count,classes,per_mic,edge_verb,note",
  "eleven columns in the walk's own order (identity, shape, numbers, edge, note)",
);
ok(grid.length === LEDGER_ROWS.length + 1, `header + ${LEDGER_ROWS.length} station rows`);
ok(grid[1][0] === "1" && grid[5][0] === "5" && grid[6][0] === "6", "stage is the walk's order, 1..N — a sort cannot lose the chain");
ok(grid[3][6] === "1234567", "raw machine digits — no thousands separators in the grid (the prose twin speaks those)");
ok(grid[3][7] === "" && grid[2][7] === "", "classes blank when the receipt has none (never a zero)");
ok(grid[3][8] === "51.4", "per_mic rides the walk's own 1-decimal reading");
ok(grid[2][9] === "carry" && grid[3][9] === "transform" && grid[4][9] === "shed" && grid[5][9] === "gain",
  "edge verbs are the walk's own classification, verbatim");
ok(grid[1][9] === "" && grid[6][9] === "", "stations without an edge (first, and the amber after a null count) say blank");
ok(grid[6][5] === "" && grid[6][6] === "" && grid[6][4] === "amber",
  "an amber row: no unit, no count — blank is CSV grammar for never counted, never a guess");
ok(grid[6][10] === "status: completed", "the amber's own explanation rides the note column");
ok(grid[6][7] === "" && grid[6][8] === "", "an amber row's classes and per_mic stay blank too");

const quoted = funnelLedgerCsv({ rows: [row({ jobId: "job-x", name: "Class 2D (masked, sharpened)" })] });
ok(quoted!.startsWith("stage,job_id,station,job_type,kind,unit,count,classes,per_mic,edge_verb,note\n1,job-x,\"Class 2D (masked, sharpened)\""),
  "a station name with commas travels RFC 4180 quoted (and unquoted intact after parse)");

const quoteChar = funnelLedgerCsv({ rows: [row({ name: 'The "best" pick' })] })!;
ok(quoteChar.includes('"The ""best"" pick"'), "a quote inside a name doubles per RFC 4180");

ok(funnelLedgerCsv({ rows: [] }) === null, "an empty ledger returns null — the caller refuses, no silent empty file");

/* ------------------------------------------------------------------ */
section("T2 — the flag (the chain rides the filename)");

const fname = funnelLedgerCsvFilename("Import Movies 1");
ok(fname.startsWith("particle-funnel-import-movies-1-"), "the host name slugs into the flag");
ok(/-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/.test(fname), "the stamp grammar matches the family (no colons, .csv)");
ok(funnelLedgerCsvFilename("   ").startsWith("particle-funnel-chain-"), "a blank host falls back to chain — never an empty flag");

/* ------------------------------------------------------------------ */
section("T3 — the door (the dialog's second button drinks the same payload)");

const dialogSrc = read("src/components/workflow/results/particle-funnel-dialog.tsx");
ok(/exportLedgerCsv\(payload, job\.name\)/.test(dialogSrc), "the handler drinks the payload the bars and the copy drink — one father");
ok(/aria-label="Export the funnel ledger as CSV — one row per station, counts and edge verbs"/.test(dialogSrc),
  "the door carries its own name (a door needs a label)");
ok(/data-testid="funnel-export-csv"/.test(dialogSrc), "the grid door has its own test id");
ok(/data-testid="funnel-copy-ledger"/.test(dialogSrc), "t463's copy door keeps its seat beside the new one");
ok(/if \(!csv\) return;/.test(dialogSrc), "the honest refusal — no stations, no file");
ok(/funnelLedgerCsvFilename\(jobName\)/.test(dialogSrc), "the bytes leave under the chain's own flag");
ok(/title: "Funnel CSV exported"/.test(dialogSrc), "the toast names the export");
ok(/import \{ downloadText \} from "@\/lib\/download";/.test(dialogSrc), "the download rides the family's carrier");

/* ------------------------------------------------------------------ */
section("T4 — neighbors (each sibling keeps its own bytes)");

const libSrc = read("src/lib/particle-funnel.ts");
ok(/export function funnelLedgerText\(/.test(libSrc), "the prose twin (t463) keeps its builder");
ok(/The funnel reads the receipts; it does not mutate — a different chain comes from re-running a verb\./.test(libSrc),
  "the ledger's closing confession intact");
ok(/export const FUNNEL_NOTE =/.test(libSrc), "the bars' own note intact");
const toolsSrc = read("src/lib/ai/tools.ts");
ok(/case "get_funnel_chain":/.test(toolsSrc) && /funnelLedgerOf/.test(toolsSrc), "the agent face (t468) keeps its walk");
ok(AI_TOOLS.length === 30, "the roster holds 30 tools — t515's products read is the newest birth, the grid is still a lib export");
ok(/"started_at",\s*\n\s*"duration_ms",/.test(read("src/components/workflow/pipeline-analytics.tsx")),
  "t507's archive window columns keep their seats");
ok(/"job_id","job","type","workspace","status","started_at","ended_at","duration_ms","duration_human","share_pct"/.test(
  read("src/lib/qc-report.ts").replace(/\s*,\s*/g, ",").replace(/",\s*"/g, '","'),
), "t506's timeline grid header keeps its ten columns");

/* ------------------------------------------------------------------ */
section("T5 — laws (machine digits, plain join, no prose leak)");

const builderBody = libSrc.slice(libSrc.indexOf("const quote =", libSrc.indexOf("export function funnelLedgerCsv(")));
ok(!builderBody.includes("toLocaleString"), "no toLocaleString in the grid — raw digits are the machine voice");
ok(/\.join\("\\n"\)/.test(builderBody), "the grid joins with \\n (the family builders' grammar)");
ok(!builderBody.includes("no particles on its receipt"), "the prose twin's amber phrase never leaks into the grid (the verb column speaks kind=amber)");

console.log(`\n=== t509 — funnel csv: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);

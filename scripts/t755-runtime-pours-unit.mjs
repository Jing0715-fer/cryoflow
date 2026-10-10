// t755 — the analytics RUNTIME stats row borrows the water dots: the
// "Runtime by stage" table is the kind vocabulary's EIGHTEENTH reader.
// Each row IS a type's own stats line — the label span names the type in
// words (r.label), the icon speaks its colors, the numbers say how long
// it held the wall clock — but until this window nothing said WHAT the
// type pours. The t747 promise rides: before the median and the p90,
// the row reports the pours. Dialect is the t751 GATED form, but riding
// the spec the row ALREADY holds (the water ask never re-asks — it
// reads the row's own jobType answer; an unknown type keeps its honest
// silence: no spec, no water, the stats row stays a number-line).
// testid runtime-pours-{type} is row-unique by CONSTRUCTION: stageRuntime
// buckets by type, one row per type (proved live-fire in B). Seat: the
// column between label and bar — decor and ear, never inside the
// numbers' columns. one-reader discipline: the analytics face's other
// type-naming family (the Particle flow rows) stays undressed this
// window (the t752-to-t753 same-surface precedent).
//
//   A  one book: the import merges into the existing line; the gated ask
//      appears exactly once in the FILE (the one-reader's evidence);
//      the ask reuses the row's held spec (exactly one jobType call in
//      the runtime slice); the render gate closes; dots ride
//      PORT_COLORS[k].wire; the lib home keeps its question.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      SIXTH-interlocked (rows/chips/shelf/cmd catalog/cmd presets/
//      runtime analytics), stageRuntime proven one-row-per-type over a
//      synthetic full-type world, every known type's row would speak.
//   C  the face: runtime-pours-{type} testid (family grammar), exactly
//      one container, per-dot anatomy verbatim, whisper word, sr-only
//      ear line, seat order label -> water -> bar, dialect structurally
//      byte-equal to the t750 canonical block (lines trimmed, testid
//      normalized), the row's title contract verbatim.
//   D  purity: zero hex literals, both t755 judgment notes lead their
//      blocks, no storage writes, the old residents keep their seats
//      (runtime-row/bar/share/bottleneck anchors + the heading), the
//      numbers' columns verbatim, the flow rows verified undressed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");
const { stageRuntime } = await __jiti.import("../src/lib/stage-runtime");

const here = path.dirname(fileURLToPath(import.meta.url));
const pa = readFileSync(path.join(here, "..", "src", "components", "workflow", "pipeline-analytics.tsx"), "utf8");
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// slice discipline: the runtime rows map runs from its map head to the
// critical-path section (the next consumer in the file); the flow rows
// map runs from its map head to the timeline rows map (one-reader's
// undressed witness); the water block is the render gate inside the
// runtime rows slice.
const rtStart = pa.indexOf("{runtime.rows.map((r) => {");
const rtEnd = pa.indexOf("{critical.chain.map((s, i) => {");
const rtRows = rtStart >= 0 && rtEnd > rtStart ? pa.slice(rtStart, rtEnd) : "";

const flStart = pa.indexOf("{flow.map((row, i) => {");
const flEnd = pa.indexOf("{runs.rows.map((r, ti) => {");
const flowRows = flStart >= 0 && flEnd > flStart ? pa.slice(flStart, flEnd) : "";

const wStart = rtRows.indexOf("{spec ? (");
const wEnd = wStart >= 0 ? rtRows.indexOf(") : null}", wStart) + ") : null}".length : -1;
const water = wStart >= 0 && wEnd > wStart ? rtRows.slice(wStart, wEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, riding the spec the row already holds                 */
/* ================================================================== */
console.log("\nA — the runtime row asks through its own held spec, gated");

must((pa.match(/import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/g) || []).length === 1,
  "A the workflow import merges into the existing single line (three names, one home)");

must((pa.match(/const pouring = spec \? pourKindsOf\(r\.type\) : \[\];/g) || []).length === 1,
  "A the GATED ask appears exactly once in the file (one-reader: the flow rows stay undressed, their absence is this count)");

must((rtRows.match(/jobType\(/g) || []).length === 1,
  "A the water ask reuses the row's held spec — exactly one jobType call in the runtime slice (no re-asking)");

must(wStart >= 0 && rtRows.indexOf(") : null}", wStart) > wStart,
  "A the render gate closes (unknown type renders nothing — silence is the posture)");

must(water.includes("PORT_COLORS[k].wire"),
  "A dots ride PORT_COLORS[k].wire (the t735 sample, now on the stats row)");

must(libHomeHasPour(), "A pourKindsOf still lives in the lib home (the t746 question, not analytics logic)");
function libHomeHasPour() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  return start >= 0 && end > start && /export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(wf.slice(start, end));
}

/* ================================================================== */
/* B — live-fire over the type space AND the stageRuntime grouping     */
/* ================================================================== */
console.log("\nB — the pour account, re-counted at the analytics stats row");

let ghost = 0;
const dist = {};
for (const t of JOB_TYPES) {
  const pk = pourKindsOf(t.key);
  for (const k of pk) if (!PORT_COLORS[k]) ghost++;
  dist[pk.length] = (dist[pk.length] ?? 0) + 1;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every dot the stats row can show has a color)");

const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0]);
const expected = [[1, 35], [2, 3], [3, 2]];
const accountSame = JSON.stringify(account) === JSON.stringify(expected);
must(accountSame,
  "B the t747 account SIXTH-interlocked (rows/chips/shelf/cmd catalog/cmd presets/runtime analytics — sorted before compared)",
  JSON.stringify(account));

const inputs = JOB_TYPES.map((t, i) => ([
  { type: t.key, label: t.label, ms: 1000 + i * 7 },
  { type: t.key, label: t.label, ms: 2000 + i * 11 },
])).flat();
const rt = stageRuntime(inputs);
const rtTypes = rt.rows.map((r) => r.type);
must(new Set(rtTypes).size === rtTypes.length && rtTypes.length === JOB_TYPES.length,
  "B stageRuntime buckets one row per type — the testid's row-uniqueness is structural, not assumed",
  `${rtTypes.length} rows over ${JOB_TYPES.length} types`);
const allSpeaks = rt.rows.every((r) => pourKindsOf(r.type).length > 0 && jobType(r.type) != null);
must(allSpeaks,
  "B every per-type row in a full-type world would speak (spec resolves, pours non-empty — the gate never silences a known type)");

/* ================================================================== */
/* C — the face: testid, container, per-dot anatomy, seat, dialect     */
/* ================================================================== */
console.log("\nC — the stats row's water face");

must(rtRows.includes('data-testid={`runtime-pours-${r.type}`}'),
  "C the testid rides the family grammar {surface}-pours-{key} (palette-fav/palette/shelf/cmd/cmd-preset/cmd-user/runtime)");

must((rtRows.match(/\{spec \? \(/g) || []).length === 1,
  "C exactly one water container in the runtime rows (one row family, one seat)");

must(water.includes('aria-hidden="true"') && water.includes("title={`pours ${k}`}") &&
     water.includes("size-1.5 rounded-full"),
  "C per-dot anatomy verbatim (whisper decoration, per-dot word, the family's dot size)");

must(water.includes('<span className="sr-only">pours {pouring.join(", ")}</span>'),
  "C the sr-only ear line verbatim (enters the a11y tree, never the numbers' columns)");

const seatRe = /title=\{r\.label\}>\s*\{r\.label\}\s*<\/span>[\s\S]*?data-testid=\{`runtime-pours-\$\{r\.type\}`\}[\s\S]*?data-runtime-bar/;
must(seatRe.test(rtRows),
  "C the seat is label -> water -> bar (the dots sit in the column between the name and the time, never past it)");

const dialectEqual = (() => {
  const grabSpan = (src, anchor) => {
    const a = src.indexOf(anchor);
    if (a < 0) return "";
    const start = src.lastIndexOf("<span", a);
    const end = src.indexOf("</span>", src.indexOf("sr-only\">pours", a)) + "</span>".length;
    if (start < 0 || end < start) return "";
    return src.slice(start, end);
  };
  const norm = (block) =>
    block.split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => l.replace(/data-testid=\{`[a-z-]+pours-\$\{[a-z.]+\}`\}/, "data-testid={ID}"))
      .join("\n");
  return norm(grabSpan(pal, "data-testid={`palette-fav-pours-${t.key}`}")) ===
         norm(grabSpan(pa, "data-testid={`runtime-pours-${r.type}`}"));
})();
must(dialectEqual,
  "C the dialect is structurally byte-equal to the t750 canonical block (lines trimmed, testid normalized — the family's sixth staging)");

must(rtRows.includes('title={`${r.label} — ${r.n} run'),
  "C the row's own title contract stays verbatim (runs/median/p90/total — the dots never enter the reveal words)");

/* ================================================================== */
/* D — purity: hex, notes, storage, residents, numbers, one-reader     */
/* ================================================================== */
console.log("\nD — purity checks");

const hexLines = pa.split("\n").filter((l) => /#[0-9a-fA-F]{6}\b/.test(l));
must(hexLines.length === 0,
  "D zero hex literals in the file (no legal residents; the dots' ink rides PORT_COLORS)",
  `${hexLines.length} hex line(s)`);

must(pa.includes("asked once, read twice (dots + ear)") &&
     pa.includes("rides the spec the row already holds") &&
     water.includes("the type's own stats row reports pours") &&
     water.includes("never inside the numbers' columns"),
  "D both t755 judgment notes lead their blocks and name their laws (the riding ask + the seat)");

must(!/localStorage|sessionStorage|writeUserParamPresets/.test(water),
  "D no storage writes in the t755 water block");

must(pa.includes('data-canvas-ui="analytics-runtime"') && pa.includes("Runtime by stage") &&
     pa.includes('data-runtime-row={r.type}') && pa.includes('data-runtime-bar=""') &&
     pa.includes('data-runtime-share=""') && pa.includes("data-runtime-bottleneck"),
  "D the old residents keep their seats (the section anchor, heading, and row/bar/share/bottleneck hooks)");

must(rtRows.includes("×{r.n}") && rtRows.includes("~{fmtDuration(r.medianMs)}") &&
     rtRows.includes("{fmtDuration(r.totalMs)}"),
  "D the numbers' columns stay verbatim (count, median, total — the dots never enter the figures)");

must(!/pourKindsOf|pours-/.test(flowRows),
  "D one-reader discipline: the Particle flow rows are verified undressed (the t752-to-t753 same-surface precedent)");

/* ================================================================== */
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL === 0 ? 0 : 1);

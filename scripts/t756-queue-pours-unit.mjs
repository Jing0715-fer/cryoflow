// t756 — the HPC QUEUE SIM's schedule row borrows the water dots: the
// kind vocabulary's NINETEENTH reader. The simulated Slurm Gantt's rows
// are type-named schedule lines — the w-28 label span says the type's
// name in words (spec?.label ?? row.type), the segments say when it ran
// on the hypothetical cluster — and now each row reports what its type
// pours before the time math. Dialect is the t751 GATED form riding the
// spec the row ALREADY holds (the t755 fourth form: the water ask never
// re-asks — it reads the row's own jobType answer; an unknown type keeps
// its honest silence: no spec, no water, the queue row stays a schedule
// line). The testid queue-pours-{row.key} mirrors the ROW's own key —
// types repeat across a pipeline's jobs (the demo chain itself has
// motioncorr twice), so the tail is the row identity, load-bearing like
// t753's id tails. Seat: the column between label and gantt — decor and
// ear, never inside the segments' time math. one-reader discipline: the
// GPU sweep table (profile-named rows, not type-named) stays undressed.
//
//   A  one book: the import merges; the gated ask appears exactly once
//      in the FILE; the queue slice holds exactly one jobType call (the
//      riding ask); the render gate closes; dots ride PORT_COLORS; the
//      lib home keeps its question.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      SEVENTH-interlocked (rows/chips/shelf/cmd catalog/cmd presets/
//      runtime analytics/queue sim), every known type speaks.
//   C  the face: queue-pours-{row.key} tail mirrors the row key, exactly
//      one container, per-dot anatomy verbatim, sr-only ear line, seat
//      label -> water -> gantt, dialect structurally byte-equal to the
//      t750 canonical block, the label's title contract verbatim.
//   D  purity: zero hex, both t756 judgment notes lead their blocks, no
//      storage writes, the old residents keep their seats (Gantt aria,
//      segments, sweep table), the segments' time-math verbatim, the
//      sweep rows verified undressed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const hq = readFileSync(path.join(here, "..", "src", "components", "workflow", "hpc-queue-sim.tsx"), "utf8");
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// slice discipline: the queue rows map runs from its map head to the
// empty-state text that follows it; the sweep rows map runs from its own
// head to the adopt handler region (one-reader's undressed witness); the
// water block is the render gate inside the queue rows slice.
const qrStart = hq.indexOf("{rows.map((row) => {");
const qrEnd = hq.indexOf("Nothing to schedule", qrStart);
const queueRows = qrStart >= 0 && qrEnd > qrStart ? hq.slice(qrStart, qrEnd) : "";

const swStart = hq.indexOf("sweep.map((row) => {");
const swEnd = hq.indexOf("function adopt", swStart) >= 0 ? hq.indexOf("function adopt", swStart) : hq.indexOf("const adopt", swStart);
const sweepRows = swStart >= 0 && swEnd > swStart ? hq.slice(swStart, swEnd) : "";

const wStart = queueRows.indexOf("{spec ? (");
const wEnd = wStart >= 0 ? queueRows.indexOf(") : null}", wStart) + ") : null}".length : -1;
const water = wStart >= 0 && wEnd > wStart ? queueRows.slice(wStart, wEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, riding the spec the row already holds                 */
/* ================================================================== */
console.log("\nA — the queue row asks through its own held spec, gated");

must((hq.match(/import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/g) || []).length === 1,
  "A the workflow import merges into the existing single line (three names, one home)");

must((hq.match(/const pouring = spec \? pourKindsOf\(row\.type\) : \[\];/g) || []).length === 1,
  "A the GATED ask appears exactly once in the file (one-reader: the sweep rows stay undressed, their absence is this count)");

must((queueRows.match(/jobType\(/g) || []).length === 1,
  "A the water ask reuses the row's held spec — exactly one jobType call in the queue slice (no re-asking)");

must(wStart >= 0 && queueRows.indexOf(") : null}", wStart) > wStart,
  "A the render gate closes (unknown type renders nothing — silence is the posture)");

must(water.includes("PORT_COLORS[k].wire"),
  "A dots ride PORT_COLORS[k].wire (the t735 sample, now on the schedule row)");

must(libHomeHasPour(), "A pourKindsOf still lives in the lib home (the t746 question, not sim logic)");
function libHomeHasPour() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  return start >= 0 && end > start && /export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(wf.slice(start, end));
}

/* ================================================================== */
/* B — live-fire over the type space                                   */
/* ================================================================== */
console.log("\nB — the pour account, re-counted at the queue sim");

let ghost = 0;
const dist = {};
for (const t of JOB_TYPES) {
  const pk = pourKindsOf(t.key);
  for (const k of pk) if (!PORT_COLORS[k]) ghost++;
  dist[pk.length] = (dist[pk.length] ?? 0) + 1;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every dot the schedule row can show has a color)");

const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0]);
const expected = [[1, 35], [2, 3], [3, 2]];
const accountSame = JSON.stringify(account) === JSON.stringify(expected);
must(accountSame,
  "B the t747 account SEVENTH-interlocked (rows/chips/shelf/cmd catalog/cmd presets/runtime analytics/queue sim — sorted before compared)",
  JSON.stringify(account));

const allSpeaks = JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null);
must(allSpeaks,
  "B every known type speaks (the gate never silences a resolved type — silence is for the unknown only)");

must(JOB_TYPES.filter((t) => t.key === "motioncorr").length === 1 && jobType("motioncorr") != null,
  "B the repeated-type fact stands behind the tail (a pipeline's jobs repeat types — the demo chain runs motioncorr twice)");

/* ================================================================== */
/* C — the face: testid tail, container, per-dot anatomy, seat, dialect */
/* ================================================================== */
console.log("\nC — the schedule row's water face");

must(queueRows.includes("data-testid={`queue-pours-${row.key}`}") &&
     queueRows.includes("<div key={row.key}"),
  "C the testid tail mirrors the ROW's own key (types repeat — the tail is the row identity, t753's id-tail law)");

must((queueRows.match(/\{spec \? \(/g) || []).length === 1,
  "C exactly one water container in the queue rows (one row family, one seat)");

must(water.includes('aria-hidden="true"') && water.includes("title={`pours ${k}`}") &&
     water.includes("size-1.5 rounded-full"),
  "C per-dot anatomy verbatim (whisper decoration, per-dot word, the family's dot size)");

must(water.includes('<span className="sr-only">pours {pouring.join(", ")}</span>'),
  "C the sr-only ear line verbatim (enters the a11y tree, never the time math)");

const seatRe = /title=\{`\$\{label\} \(\$\{row\.segs\[0\]\?\.slurmId \?\? ""\}\)\`\}\s*>\s*\{label\}\s*<\/div>[\s\S]*?data-testid=\{`queue-pours-\$\{row\.key\}`\}[\s\S]*?relative h-\[18px\] flex-1/;
must(seatRe.test(queueRows),
  "C the seat is label -> water -> gantt (the dots sit in the column between the name and the segments, never past it)");

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
         norm(grabSpan(hq, "data-testid={`queue-pours-${row.key}`}"));
})();
must(dialectEqual,
  "C the dialect is structurally byte-equal to the t750 canonical block (lines trimmed, testid normalized — the family's seventh staging)");

must(queueRows.includes('title={`${label} (${row.segs[0]?.slurmId ?? ""})`}'),
  "C the label's title contract stays verbatim (label + slurm id — the dots never enter the reveal words)");

/* ================================================================== */
/* D — purity: hex, notes, storage, residents, time math, one-reader   */
/* ================================================================== */
console.log("\nD — purity checks");

const hexLines = hq.split("\n").filter((l) => /#[0-9a-fA-F]{6}\b/.test(l));
must(hexLines.length === 0,
  "D zero hex literals in the file (no legal residents; the dots' ink rides PORT_COLORS)",
  `${hexLines.length} hex line(s)`);

must(hq.includes("asked once, read twice (dots + ear)") &&
     hq.includes("rides the spec the row already holds") &&
     water.includes("the schedule's type-named row reports") &&
     water.includes("inside the segments' time math"),
  "D both t756 judgment notes lead their blocks and name their laws (the riding ask + the seat)");

must(!/localStorage|sessionStorage|writeUserParamPresets/.test(water),
  "D no storage writes in the t756 water block");

must(hq.includes('aria-label="Simulated schedule (Gantt)"') && hq.includes("TYPE_COLOR[row.type]") &&
     hq.includes("FALLBACK_COLOR") && hq.includes("MODEL_BADGE[row.p.gpuModel]"),
  "D the old residents keep their seats (the Gantt aria, the color tables, the sweep's model badge)");

must(queueRows.includes("title={`${s.slurmId} · ${label} · `") === false &&
     queueRows.includes("${s.slurmId} · ${label}") &&
     queueRows.includes("{s.gpus}G"),
  "D the segments' time math stays verbatim (slurm id · label · gpu chip — the dots never enter the segment titles)");

must(!/pourKindsOf|pours-/.test(sweepRows),
  "D one-reader discipline: the GPU sweep rows are verified undressed (profile-named, not type-named)");

/* ================================================================== */
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL === 0 ? 0 : 1);

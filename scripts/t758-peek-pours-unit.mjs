// t758 — the JOB CARD's hover peek borrows the water dots: the kind
// vocabulary's TWENTIETH reader. The canvas card's own face is ICON-ONLY
// at canvas distance (Row 1: an icon chip in category color + the job's
// name — seventeen cards stay quiet, that quiet is t605's canvas
// manners), but the peek IS the card's panel-distance face — the same
// face t322/t605 already taught to speak the queue dialect. The peek's
// type label line is a placard that names the type in words
// (spec?.label ?? job.type), and a placard that names the type can
// carry the pours line. Dialect is the t750 GATED form; the ask rides
// the spec the component ALREADY holds as a prop — JobCardPreview never
// re-asks jobType (its slice holds ZERO jobType calls: the answer came
// in through the door — the undefined-law's fourth form, its purest
// shape yet: reuse what's in hand, don't even re-ask). Mount-state is
// the vocabulary's third shape: t756 taught dormant (no consumer), the
// staged bundles taught waiting-for-build (t755/t757) — the peek is
// ON-DEMAND: mounted the moment a pointer rests on the card. The
// testid peek-pours-{job.type} mirrors the card's own type tail.
// one-reader discipline: the canvas card body (Row 1) stays undressed —
// the dots live ONLY inside the peek.
//
//   A  one book: the import merges; the gated ask appears exactly once
//      in the FILE and its slice holds ZERO jobType calls (the riding
//      spec is a prop); the render gate closes; dots ride PORT_COLORS;
//      the lib home keeps its question.
//   B  live-fire: 40 types speak, zero ghost kinds, unknown types stay
//      silent, the t747 account EIGHTH-interlocked (eight files each
//      independently ask lib), the peek's old residents keep their
//      seats (name row, preview-elapsed, StatusBadge), the label's
//      reveal words stay verbatim.
//   C  the face: peek-pours-{job.type} exactly one, per-dot anatomy
//      verbatim, sr-only ear line, seat label -> water on one flex row
//      (min-w-0 + shrink-0 = wrap-not-clip at text scale), dialect
//      structurally byte-equal to the t750 canonical block.
//   D  purity: zero hex on code lines (the comment's minimap hex is a
//      legal resident), the t758 judgment note leads its block and
//      names the distance law, no storage writes, the canvas Row 1
//      verified undressed (one-reader), the title word-form template.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const jcPath = path.join(here, "..", "src", "components", "workflow", "job-card.tsx");
const jc = readFileSync(jcPath, "utf8");
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// slice discipline: the peek component runs from its function head to
// the next top-level function (pendingRenderSig); the water block is
// the render gate inside that slice; the canvas Row 1 runs from its
// comment anchor to the note badge that ends the row (one-reader's
// undressed witness).
const pStart = jc.indexOf("function JobCardPreview(");
const pEnd = jc.indexOf("function pendingRenderSig(");
const peek = pStart >= 0 && pEnd > pStart ? jc.slice(pStart, pEnd) : "";

const wStart = peek.indexOf("{spec ? (");
const wEnd = wStart >= 0 ? peek.indexOf(") : null}", wStart) + ") : null}".length : -1;
const water = wStart >= 0 && wEnd > wStart ? peek.slice(wStart, wEnd) : "";

const r1Start = jc.indexOf("{/* Row 1: icon chip + name");
const r1End = r1Start >= 0 ? jc.indexOf("data-note-badge", r1Start) : -1;
const row1 = r1Start >= 0 && r1End > r1Start ? jc.slice(r1Start, r1End) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, riding the spec the component already holds           */
/* ================================================================== */
console.log("\nA — the peek asks through the spec handed to it, gated");

must((jc.match(/pourKindsOf,/g) || []).length === 1 && /  pourKindsOf,\n  visibleOutputs,/.test(jc),
  "A the workflow import merges into the existing block (one name, alphabetical seat, one home)");

must((jc.match(/const pouring = spec \? pourKindsOf\(spec\.key\) : \[\];/g) || []).length === 1,
  "A the GATED ask appears exactly once in the file, riding spec.key (the prop's answer re-read, not re-asked)");

must((peek.match(/jobType\(/g) || []).length === 0,
  "A the peek's slice holds ZERO jobType calls — the purest riding form: the spec arrived as a prop, no re-ask at all");

must(wStart >= 0 && (peek.match(/\{spec \? \(/g) || []).length === 1 &&
     water.endsWith(") : null}"),
  "A the render gate opens once and closes (unknown type: no spec, no dots — silence is a posture)");

must((water.match(/PORT_COLORS\[k\]\.wire/g) || []).length === 1,
  "A the dots ride PORT_COLORS wire hex (one ink source, the family's lib-owned palette)");

must(/export function pourKindsOf\(typeKey: string\): PortKind\[\] \{/.test(wf),
  "A the lib home keeps its question (pourKindsOf still lives in workflow.ts)");

/* ================================================================== */
/* B — live-fire: the vocabulary over the whole type world             */
/* ================================================================== */
console.log("\nB — live-fire over 40 types");

const ghosts = [];
for (const t of JOB_TYPES) {
  const pours = pourKindsOf(t.key);
  for (const k of pours) if (!(k in PORT_COLORS)) ghosts.push(`${t.key}:${k}`);
  if (pours.length === 0) ghosts.push(`${t.key}:silent`);
}
must(ghosts.length === 0,
  "B every known type speaks at least one pour kind, zero ghost kinds",
  `${JOB_TYPES.length} types walked`);

must(pourKindsOf("no-such-type").length === 0 && jobType("no-such-type") === undefined,
  "B unknown types keep the honest silence (no spec, no water)");

const pourFiles = ["palette.tsx", "type-card-dialog.tsx", "user-preset-shelf.tsx",
  "command-palette.tsx", "job-inspector.tsx", "pipeline-analytics.tsx",
  "hpc-queue-sim.tsx", "job-card.tsx"]
  .filter((f) => {
    try { return readFileSync(path.join(here, "..", "src", "components", "workflow", f), "utf8").includes("pourKindsOf("); }
    catch { return false; }
  });
must(pourFiles.length === 8,
  "B the t747 account is EIGHTH-interlocked — eight readers, each independently asking the lib",
  pourFiles.join(", "));

must(peek.includes('data-testid="preview-elapsed"') && peek.includes("<StatusBadge status={job.status}"),
  "B the peek's old residents keep their seats (status badge, elapsed clock)");

must(peek.includes('<p className="truncate text-xs font-semibold">{job.name}</p>'),
  "B the peek header's name row stays verbatim (the first line is the job's own name — untouched)");

must(peek.includes("{spec?.label ?? job.type}"),
  "B the placard's reveal words stay verbatim (spec?.label ?? job.type)");

/* ================================================================== */
/* C — the face: testid tail, dots anatomy, seat, dialect              */
/* ================================================================== */
console.log("\nC — the peek's placard face");

must((jc.match(/peek-pours-/g) || []).length === 1,
  "C the testid family's eighth address: peek-pours-{job.type} — exactly one in the file");

must(water.includes('data-testid={`peek-pours-${job.type}`}'),
  "C the testid tail mirrors the card's own type");

must(water.includes('aria-hidden="true"') && water.includes("title={`pours ${k}`}") &&
     water.includes("size-1.5 rounded-full"),
  "C per-dot anatomy verbatim (aria-hidden whisper, per-kind title word, size-1.5 round)");

must(water.includes('<span className="sr-only">pours {pouring.join(", ")}</span>'),
  "C the sr-only ear line verbatim (the family's spoken contract)");

const labelIdx = peek.indexOf("<p className=\"truncate text-[10px] text-muted-foreground\">");
must(labelIdx >= 0 && labelIdx < wStart &&
     /<div className="flex min-w-0 items-center gap-1\.5">/.test(peek) &&
     /className="flex shrink-0 items-center gap-1"/.test(water),
  "C the seat: label first, water after, one flex row — min-w-0 label + shrink-0 dots (wrap-not-clip at text scale)");

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
// the palette anchor uses palette's own variable name — declare the
// local twin BEFORE the equality runs (TDZ respects no dialects)
const t = { key: "motioncorr" };
const dialectEqual =
  norm(grabSpan(pal, "data-testid={`palette-fav-pours-${t.key}`}")) ===
  norm(grabSpan(jc, "data-testid={`peek-pours-${job.type}`}"));
must(dialectEqual,
  "C the dialect is structurally byte-equal to the t750 canonical block (lines trimmed, testid normalized — the family's eighth staging)");

/* ================================================================== */
/* D — purity: hex, note, storage, residents, one-reader, word-form    */
/* ================================================================== */
console.log("\nD — purity checks");

const hexCodeLines = jc.split("\n").filter((l) => {
  const s = l.trim();
  if (s.startsWith("*") || s.startsWith("//") || s.startsWith("/*")) return false;
  return /#[0-9a-fA-F]{6}\b/.test(l);
});
must(hexCodeLines.length === 0,
  "D zero hex on code lines (the comment's minimap hex #a1a1aa is a legal resident; the dots' ink rides PORT_COLORS)",
  `${hexCodeLines.length} code hex line(s)`);

const noteIdx = jc.indexOf("// t758 —");
must(noteIdx >= 0 && noteIdx < jc.indexOf("const pouring = spec") &&
     jc.includes("ICON-ONLY") && jc.includes("panel-distance face") &&
     jc.includes("canvas distance"),
  "D the t758 judgment note leads its block and names the distance law (canvas quiet, panel speech)");

must(!/localStorage|sessionStorage|writeUserParamPresets/.test(water),
  "D no storage writes in the t758 water block");

must(pStart < pEnd && peek.includes('side="top"') && peek.includes("previewParams(job, spec)"),
  "D the peek keeps its own bones (side=top hover, previewParams wiring)");

must((row1.match(/pours|peek-pours/g) || []).length === 0,
  "D one-reader discipline: the canvas Row 1 is verified undressed (icon chip + name — the dots live only inside the peek)");

must(water.includes("title={`pours ${k}`}"),
  "D the title word-form template stays exact (pours ${k} — per-kind, no decoration)");

/* ================================================================== */
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL === 0 ? 0 : 1);

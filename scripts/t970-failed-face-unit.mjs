#!/usr/bin/env node
/**
 * t970 — the FAILED-FACE unit (node-only): the ResultSummary's failed
 * branch — the "Job failed" card with the Task 120 diagnosis teaser —
 * pinned as a fold contract after its first measured ride.
 *
 * THE RIDE (this unit's birth): the t970 mint forged the world's sixth
 * job ("Failed Diagnosis Face (t970)") — a motioncorr whose run.out
 * carries the real OOM cascade (CUDA out of memory → the CPU retry → the
 * kernel's OOM killer, exit 137) — and the walk rode its Overview at the
 * 320 fold with the t969 panel-tier grammar. The verdict: the face was
 * BORN HONEST — panelOverX FALSE out of the box (the t969 cures
 * generalized across the tier), the teaser's chip row wraps (flex-wrap
 * since Task 120), every chip absorbs its label (min-w-0 truncate),
 * every standing LEAK is an aria-named hit-slop carrier (the Task 171
 * family — the t969 exoneration's law holds here too).
 *
 * THE CLOSED NOTE: the t968 entry recorded "the ResultSummary card's
 * chip row 258 vs 231" as a panel mouth; t969 measured the seed's face
 * over=0 and moved the number to "the bench's failed face"; the t970
 * ride opened THAT face (the real failed face, minted for the purpose)
 * and measured the chip row at sw=165=cw with the LONGEST label in the
 * signature table truncating by design. The recorded shape has NO living
 * address — the note's third correction closes it as a measured
 * NON-item, and this unit pins the design that makes it impossible.
 *
 * What the unit pins:
 *  - S: the failed branch's source shapes (the teaser's guard, the chip
 *       row's wrap at its address, the chip's absorption, the head
 *       note's fold hiding, the negative teaser's three-state law);
 *  - D: log-diagnosis's response to the OOM cascade's story shapes
 *       (2 findings, gpu-oom ×2, oom-kill ×2, clean log → no findings);
 *  - M: the mint's and walk's contracts (three stages, the failed
 *       row-flip with exit 137, the explicit x/y viewport lesson, the
 *       walk's two modes, the exoneration law);
 *  - A: the tree pairing guard — data-ovd-chip never orphans from its
 *       data-overview-diagnosis container.
 *
 *   node scripts/unit-runner.mjs scripts/t970-failed-face-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t970-failed-face-unit.json";

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`); }
}

const inspector = readFileSync(path.join(ROOT, "src/components/workflow/job-inspector.tsx"), "utf8");
const { diagnoseFailureLog } = await import("@/lib/log-diagnosis");

/* ---- S: the failed branch's source shapes ---- */
{
  /* the failed branch: the head, then the teaser inside it */
  const failedIdx = inspector.indexOf('job.status === "failed"');
  ok("S1 the failed branch exists at the status gate", failedIdx > 0);
  const failedCard = inspector.indexOf("Job failed");
  ok("S2 the failed card's head speaks (Job failed)", failedCard > failedIdx);
  ok("S3 the teaser container rides the failed branch (data-overview-diagnosis)", inspector.includes('data-overview-diagnosis=""'));

  /* the chip row's wrap at its address — the design that makes the
   * fold-honesty possible (the t970 ride's core measurement) */
  ok("S4 the chip row wraps (mt-2 flex flex-wrap gap-1.5)", inspector.includes('"mt-2 flex flex-wrap gap-1.5"'));

  /* the chip's absorption: max-w-full caps the chip, the label truncates */
  const chipIdx = inspector.indexOf('data-ovd-chip={f.id}');
  ok("S5 the chip carries data-ovd-chip with the finding id", chipIdx > 0);
  const chipBlock = chipIdx > 0 ? inspector.slice(chipIdx, chipIdx + 700) : "";
  ok("S6 the chip caps at max-w-full", chipBlock.includes("max-w-full"));
  ok("S7 the chip label absorbs (ovd-chip-label min-w-0 truncate)", chipBlock.includes("ovd-chip-label min-w-0 truncate"));
  ok("S8 the chip's ×N count span is shrink-0 (the count never squishes)", chipBlock.includes("ovd-chip-count shrink-0"));

  /* the head note hides at the fold — the honest hiding, not a clip */
  ok("S9 the head note hides below sm (ovd-note hidden ... sm:inline)", /ovd-note hidden min-w-0 truncate[^"]*sm:inline/.test(inspector));

  /* the three-state law (Task 121): the negative teaser's own seat */
  ok("S10 the negative teaser has its own seat (data-ovd-negative)", inspector.includes('data-ovd-negative=""'));

  /* the teaser's gate: only a non-empty diagnosis summons the classic leg */
  ok("S11 the classic teaser gates on diagnosis.length > 0", /diagnosis && diagnosis\.length > 0 \?/.test(inspector));
}

/* ---- D: the lib's response to the OOM cascade's story shapes ---- */
{
  const cascade = [
    "[2026-10-13 20:55:36.402] motioncor2: cudaMalloc returned out of memory for the full-frame stack (device 0)",
    "[2026-10-13 20:55:36.404] CUDA error: out of memory (tried to allocate 6.50 GB on device 0)",
    "[2026-10-13 20:55:44.517] motioncor2: CPU path started on movie 0013",
    "[  8423.117664] oom-killer: invoked oom-killer: gfp_mask=0x100cca(GFP_HIGHUSER_MOVABLE), order=4",
    "bash: line 1:  84231 Killed                  relion_motioncorr --i Movies/*.mrcs --o . --j 8 --gpu 0",
  ].join("\n");
  const findings = diagnoseFailureLog(cascade);
  ok("D1 the cascade yields exactly 2 findings", findings.length === 2, findings.map((f) => f.id).join("+"));
  ok("D2 gpu-oom leads (the log's story order)", findings[0]?.id === "gpu-oom");
  ok("D3 gpu-oom counts 2 lines", findings[0]?.count === 2, `count=${findings[0]?.count}`);
  ok("D4 oom-kill counts 2 lines (kernel + shell)", findings[1]?.id === "oom-kill" && findings[1]?.count === 2, `count=${findings[1]?.count}`);
  ok("D5 the ×N spans' truth: counts > 1 ride the finding", findings.every((f) => f.count > 1));

  const clean = diagnoseFailureLog("RELION motioncorr started\nmovie 0001 aligned — shift (2.31, -1.87) px\ndone.");
  ok("D6 a clean log yields no findings (the healthy face stays silent)", clean.length === 0, `got ${clean.length}`);
}

/* ---- L: the log strip's fold contract (t971 — the teaser's sibling) ---- */
{
  /* the strip renders only when the tail window's findings are non-empty,
   * INSIDE the log console, between toolbar and scroll area */
  const consoleIdx = inspector.indexOf('data-log-console=""');
  const stripIdx = inspector.indexOf('data-log-diagnosis=""');
  ok("L1 the strip exists at data-log-diagnosis", stripIdx > 0);
  ok("L2 the strip lives INSIDE the log console (after its opening)", stripIdx > consoleIdx && consoleIdx > 0);
  ok("L3 the strip gates on findings.length > 0 (the tail window's diagnosis)", /findings\.length > 0 \?/.test(inspector));
  ok("L4 the strip keeps its lane (shrink-0 — the log scrolls beneath)", /data-log-diagnosis[\s\S]{0,200}shrink-0/.test(inspector));
  ok("L5 the head's provenance note hides below xl (the honest hiding)", /diag-ml hidden truncate[^"]*xl:inline/.test(inspector));
  ok("L6 the findings list caps at max-h-52 with its OWN scroll (the one-axis law)", /max-h-52 space-y-1\.5 overflow-y-auto/.test(inspector));
  ok("L7 the list is the focusable reading face (tabIndex 0 — the t780 law)", /<ul\s+tabIndex=\{0\}/.test(inspector));
  ok("L8 every finding's label truncates (diag-label truncate)", inspector.includes("diag-label truncate"));
  ok("L9 every finding's excerpt truncates in mono (diag-excerpt mt-1 truncate font-mono)", inspector.includes("diag-excerpt mt-1 truncate font-mono"));
  ok("L10 the hint WRAPS and never truncates (diag-hint flex items-start, no truncate)", /diag-hint mt-1 flex items-start gap-1(?!.*truncate)/.test(inspector));
  ok("L11 the line badge carries first-line + ×N (the count rides the badge)", inspector.includes("L{f.firstLine}") && inspector.includes("· ×${f.count}"));
}

/* ---- M: the instruments' contracts ---- */
{
  const mint = readFileSync(path.join(ROOT, "scripts/t970-failed-face-mint.mjs"), "utf8");
  ok("M1 the mint has the three stages", mint.includes('stage === "mint"') && mint.includes('stage === "verify"') && mint.includes('stage === "remove"'));
  ok("M2 the row-flip writes FAILED (the honest face)", mint.includes('status: "failed"'));
  ok("M3 the run record exits 137 (128+9 — the SIGKILL exit)", mint.includes("exitCode: 137"));
  ok("M4 the mint passes explicit x/y (the viewport lesson: 2400 rode out of the fit)", mint.includes("x: 1960, y: 760"));
  ok("M5 the mint's log carries both signatures' shapes (gpu-oom + oom-kill)", mint.includes("CUDA error: out of memory") && mint.includes("Killed"));

  const walk = readFileSync(path.join(ROOT, "scripts/t970-failed-face-walk.mjs"), "utf8");
  ok("M6 the walk has the two modes (BEFORE records, GATE gates)", walk.includes('GATE = process.env.GATE === "1"') && walk.includes("the BEFORE witness"));
  ok("M7 the gate pins the panel-tier law on this face (G1 panelOverX FALSE)", walk.includes("G1 the panel never overflows at the fold"));
  ok("M8 the exoneration is the walk's law (every leak aria-named with an absolute ::before)", walk.includes("every LEAK button is an aria-named hit-slop carrier"));
  ok("M9 the teaser poll waits for the async leg before measuring", walk.includes("the diagnosis teaser never rendered"));

  const stripWalk = readFileSync(path.join(ROOT, "scripts/t971-log-strip-walk.mjs"), "utf8");
  ok("M10 the t971 walk has the two modes (BEFORE records, GATE gates)", stripWalk.includes('GATE = process.env.GATE === "1"') && stripWalk.includes("the BEFORE witness"));
  ok("M11 the t971 gate owns the strip's fold contract (G1..G8)", stripWalk.includes("G1 the panel never overflows at the fold") && stripWalk.includes("G8 the PNG receipts landed"));
  ok("M12 the t971 walk polls the strip's async leg before measuring", stripWalk.includes("the log diagnosis strip never rendered"));
  ok("M13 the exoneration law rides BOTH walks (the aria+pseudoAbs gate)", stripWalk.includes("every LEAK button is an aria-named hit-slop carrier"));
}

/* ---- A: the tree pairing guard ---- */
{
  /* the chip never orphans: any file that renders a data-ovd-chip must
   * also carry the data-overview-diagnosis container (the teaser is the
   * chips' only legitimate parent) */
  const filesWithChip = ["src/components/workflow/job-inspector.tsx"].filter((f) =>
    readFileSync(path.join(ROOT, f), "utf8").includes("data-ovd-chip")
  );
  ok(
    "A1 every data-ovd-chip lives beside its data-overview-diagnosis container",
    filesWithChip.every((f) => readFileSync(path.join(ROOT, f), "utf8").includes('data-overview-diagnosis=""')),
    filesWithChip.join(", ")
  );
}

/* ---- the receipt ---- */
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(
  path.join(ROOT, RECEIPT),
  JSON.stringify({ unit: "t970-failed-face-unit", at: new Date().toISOString(), pass, fail }, null, 2)
);
console.log(`t970-failed-face-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

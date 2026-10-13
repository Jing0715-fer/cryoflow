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
const { diagnoseFailureLog, LOG_PATTERNS } = await import("@/lib/log-diagnosis");

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

/* ---- N: the negative leg's contract (t972 → t976 — the flip) ----
 * The t972 mint minted the world's SEVENTH job as the negative teaser's
 * first face (the walltime death, zero signatures by the then-15-row
 * table). The t976 ride DECIDED the walltime question the other way:
 * SLURM's own "DUE TO TIME LIMIT" is the scheduler's narration — the
 * same epistemic class as bash's "Killed" — and a negative verdict the
 * log itself refutes is a lie. The table grew the walltime row, the
 * t972 face FLIPPED positive (exactly one finding), and the negative
 * leg was re-faced on the t976 cancelled face (a scancel death with no
 * reason named — zero signatures by construction). This band pins the
 * leg's source shapes (unchanged UI), the lib's response to BOTH
 * stories, both mints' mirror sync, and the t976 walk's contract. */
{
  /* the negative leg's source shapes (the same component, the other gate) */
  ok("N1 the negative leg gates on diagnosis.length === 0", /diagnosis && diagnosis\.length === 0 \?/.test(inspector));
  ok("N2 the negative marker rides the same container (data-ovd-negative)", inspector.includes('data-ovd-negative=""'));
  ok("N3 the aria verdict is the negative leg's own sentence", inspector.includes('aria-label="No known failure signature matched the full log"'));
  ok("N4 the count span reads 0 findings", inspector.includes("0 findings"));
  ok("N5 the zinc styling is the negative card's own (border-zinc-500/25)", inspector.includes("border-zinc-500/25"));
  ok("N6 the honest note rides its class (ovd-negative-note — the one text that reads whole)", inspector.includes("ovd-negative-note") && /the cause is\s+custom to this job/.test(inspector));
  ok("N7 the negative jump speaks its own words (Read the full log)", inspector.includes("Read the full log"));
  ok("N8 the SearchX icon rides the negative card", /SearchX/.test(inspector));

  /* the lib's truth, story one: the walltime story (the t972 mint's log
   * shape) now yields EXACTLY ONE finding — the t976 walltime row. The
   * t323 autopsy stays silent (the tail ends on the slurmd / Terminated
   * / slurmstepd trio, not on a live progress frame), but the signature
   * table answers first: the scheduler's own words are in the table. */
  const walltimeStory = [
    "  23.51/24.00 hrs — Maximisation step starting (4 reconstructions, tau_fudge 1.0)",
    "[2026-10-14 08:54:58.201] MPI rank 001: per-class reconstruction workspaces written",
    "[2026-10-14 08:55:29.887] MPI rank 000: intermediate checkpoint written (run_it007_data.star + run_it007_optimiser.star)",
    "slurmd[compute-0-1]: sending SIGTERM to the job's allocation (the partition's 24-hour walltime elapsed)",
    "bash: line 1:  48291 Terminated              mpirun -n 2 relion_refine_mpi --i Particles/job014/particles.star --o Class3D/job042 --ref InitialModel/job041/initial_model.mrc --K 4",
    "slurmstepd: error: *** JOB 482911 CANCELLED AT 2026-10-14T08:55:31 DUE TO TIME LIMIT *** on compute-0-1",
  ].join("\n");
  const wallFindings = diagnoseFailureLog(walltimeStory);
  ok("N9 the walltime story yields EXACTLY ONE finding — the t976 walltime row (the flip)", wallFindings.length === 1 && wallFindings[0].id === "walltime-limit", wallFindings.map((f) => f.id).join("+") || "clean");

  /* the lib's truth, story two: the t976 cancelled story (the negative
   * teaser's NEW face — a scancel death with no reason named) yields
   * ZERO findings through the REAL lib. The CANCELLED line's missing
   * "DUE TO TIME LIMIT" is what keeps the walltime row out of it. */
  const cancelledStory = [
    "  3.54/3.96 hrs — Maximisation step starting (4 reconstructions, tau_fudge 1.0)",
    "[2026-10-13 21:58:01.556] MPI rank 001: per-class reconstruction workspaces written",
    "slurmd[compute-0-3]: sending SIGTERM to the job's allocation",
    "bash: line 1:  48312 Terminated              mpirun -n 2 relion_refine_mpi --i Particles/job014/particles.star --o Class3D/job049 --ref InitialModel/job041/initial_model.mrc --K 4",
    "slurmstepd: error: *** JOB 483077 CANCELLED AT 2026-10-13T21:58:03 *** on compute-0-3",
  ].join("\n");
  const cancelFindings = diagnoseFailureLog(cancelledStory);
  ok("N9b the cancelled story yields ZERO findings (the negative teaser's new contract — the t976 face)", cancelFindings.length === 0, cancelFindings.map((f) => f.id).join("+") || "clean");

  /* the mirror sync — BOTH mints carry an inline transcription of the
   * signature table (t976 grew it by the walltime row); if the lib's
   * table grows again, the mirrors desync and these checks fail BEFORE
   * the mints lie (the re-key law: both mirrors in the same commit) */
  const negMint = readFileSync(path.join(ROOT, "scripts/t972-negative-face-mint.mjs"), "utf8");
  const negMirror = (negMint.match(/\["[a-z0-9-]+", \//g) ?? []).length;
  ok("N10 the t972 mint's mirror table stays in sync with the lib's signature table", negMirror === LOG_PATTERNS.length, `mirror=${negMirror} lib=${LOG_PATTERNS.length}`);
  const cancelMint = readFileSync(path.join(ROOT, "scripts/t976-cancelled-face-mint.mjs"), "utf8");
  const cancelMirror = (cancelMint.match(/\["[a-z0-9-]+", \//g) ?? []).length;
  ok("N10b the t976 mint's mirror stays in sync too (one table, two transcriptions)", cancelMirror === LOG_PATTERNS.length, `mirror=${cancelMirror} lib=${LOG_PATTERNS.length}`);
  ok("N11 the t972 mint's verify rides the FLIP (exactly one walltime match)", negMint.includes("EXACTLY ONE signature match across the full log") && negMint.includes("the t976 walltime row"));
  ok("N11b the t976 mint proves the zero-match property at the API tier (the mirror check rides verify)", cancelMint.includes("ZERO signature matches across the full log") && cancelMint.includes("the t323 autopsy stays silent"));
  ok("N12 the walltime mint's run record exits 143 (128+15 — the SIGTERM death)", negMint.includes("exitCode: 143") && negMint.includes("Terminated"));
  ok("N12b the cancelled mint's run record exits 143 too (the same SIGTERM death, no signature)", cancelMint.includes("exitCode: 143") && cancelMint.includes("Terminated"));

  /* the t976 walk's contract (the negative leg's browser witness moved
   * here after the flip; the walk also witnesses the flip itself) */
  const negWalk = readFileSync(path.join(ROOT, "scripts/t976-walltime-flip-walk.mjs"), "utf8");
  ok("N13 the t976 walk has the two modes (BEFORE records, GATE gates)", negWalk.includes('GATE = process.env.GATE === "1"') && negWalk.includes("the BEFORE witness"));
  ok("N14 the t976 gate owns the negative leg's fold contract (G1..G9)", negWalk.includes("G1 the panel never overflows at the fold") && negWalk.includes("G9 the PNG receipts landed"));
  ok("N15 the t976 walk witnesses the honest silence (the strip is ABSENT by design)", negWalk.includes("the strip is ABSENT on the cancelled face"));
  ok("N16 the exoneration law rides the t976 walk too (the aria+pseudoAbs gate)", negWalk.includes("every LEAK button is an aria-named hit-slop carrier"));
  ok("N17 the contrast leg rides the walk (the t970 positive teaser, 2 chips — the three-state law's both legs)", negWalk.includes("N10 the contrast leg: the t970 face still speaks the POSITIVE teaser"));
  ok("N18 the t976 walk witnesses the FLIP on the t972 face (the walltime chip + the strip's return)", negWalk.includes('data-finding="walltime-limit"') && negWalk.includes("the strip RETURNS on the flipped face"));
}

/* ---- W: the wrap toggle's fold contract (t973 — the t971 note's ①
 *        cashed in) ----
 * The t971 ride recorded the log's honest X-reach (the pre's
 * whitespace-pre long lines, +669px) and named the wrap toggle "the
 * design's answer" — the fold's reading aid. The t973 ride pinned the
 * contract and cured the toggle's one disease: the icon-only button was
 * the toolbar's ONLY unnamed control (tooltip-only naming). This band
 * pins the cure's source shapes, the pre's two faces, and the walk's
 * contract. */
{
  /* the t973 cure: the icon-only wrap button is NAMED */
  ok("W1 the wrap toggle carries its accessible name (aria-label — the toolbar's only unnamed control speaks)", inspector.includes('aria-label="Toggle line wrapping"'));
  ok("W2 the toggle announces its state (aria-pressed={wrap})", /aria-label="Toggle line wrapping"[\s\S]{0,80}aria-pressed=\{wrap\}/.test(inspector));
  ok("W3 the active face tints running (wrap && bg-zinc-800 text-running-300)", inspector.includes('wrap && "bg-zinc-800 text-running-300"'));
  ok("W4 the tooltip's words match the aria-label (name and hover speak with one voice)", inspector.includes(">Toggle line wrapping</TooltipContent>"));
  ok("W5 the icon is the WrapText glyph (the affordance)", inspector.includes('<WrapText className="size-3.5" />'));
  /* the pre's two faces: the wrap state swaps the whitespace law */
  ok("W6 the pre speaks BOTH faces (wrap ? whitespace-pre-wrap break-words : whitespace-pre)", inspector.includes('wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"'));
  ok("W7 the no-wrap face stays bare whitespace-pre (the log's honest shape — not pre-wrap)", /"\s*m-0", wrap \? "whitespace-pre-wrap break-words" : "whitespace-pre"/.test(inspector));

  /* the t973 walk's contract */
  const wrapWalk = readFileSync(path.join(ROOT, "scripts/t973-wrap-fold-walk.mjs"), "utf8");
  ok("W8 the t973 walk has the two modes (BEFORE records, GATE gates)", wrapWalk.includes('GATE = process.env.GATE === "1"') && wrapWalk.includes("the BEFORE witness"));
  ok("W9 the t973 gate owns the wrap contract (G1..G9)", wrapWalk.includes("G1 the default face is the honest X-reach") && wrapWalk.includes("G9 the PNG receipts landed"));
  ok("W10 the walk finds the toggle BY NAME (the cure's own proof — the address is the aria-label)", wrapWalk.includes('button[aria-label="Toggle line wrapping"]'));
  ok("W11 the walk witnesses the X-death under wrap (G5: role=log over === 0)", wrapWalk.includes("G5 under wrap the X-overflow DIES"));
  ok("W12 the keyboard leg rides the walk (Enter flips BOTH ways — no pointer required)", wrapWalk.includes("the keyboard toggles BOTH ways"));
  ok("W13 the poll waits for the log's async leg before measuring (the tab's own fetch)", wrapWalk.includes("the log pre never rendered"));
  ok("W14 the walk polls the wrap flip instead of assuming (the click's own async leg)", wrapWalk.includes("the wrap state never flipped"));

  /* the t977 persistence band: the reading mode survives the close — a
   * global preference (the user's viewport, not the job's content), the
   * write riding the HANDLER (the #13 law: storage writes never render —
   * StrictMode double-invokes updater functions), the read lazy at mount */
  ok("W15 the pref lives at its house key and reads LAZILY at mount (cryoflow.logWrap.v1 + React.useState(readWrapPref))", inspector.includes('cryoflow.logWrap.v1') && inspector.includes("React.useState(readWrapPref)"));
  ok("W16 the write rides the HANDLER — the updater stays pure (writeWrapPref appears exactly twice: definition + the one handler call; the functional updater is gone)", (inspector.match(/writeWrapPref\(/g) ?? []).length === 2 && !inspector.includes("setWrap((w)"), `calls=${(inspector.match(/writeWrapPref\(/g) ?? []).length}`);
  ok("W17 both helpers are guarded (typeof window + try/catch — private mode and quota degrade to OFF)", /function readWrapPref\(\)[\s\S]{0,220}typeof window[\s\S]{0,120}catch/.test(inspector) && /function writeWrapPref\([\s\S]{0,200}catch/.test(inspector));
  ok("W18 the walk carries the persistence legs (the reset-before-mount, the reopen witness, the no-trace cleanup)", wrapWalk.includes("cryoflow.logWrap.v1") && wrapWalk.includes("the reading mode SURVIVES the close") && wrapWalk.includes("the walk leaves no trace"));
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

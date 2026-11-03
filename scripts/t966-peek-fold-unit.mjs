#!/usr/bin/env node
/**
 * t966 — the peek doors' grammar unit: the t913 cure reaches the
 * INSPECTOR's Files-tab family (the second family), and the t832 Esc
 * seat rides along. The census's 24th instrument (fs-only — the rider
 * `t966-peek-fold-rider.mjs` carries the live behavior; this unit pins
 * the grammar so a regression fails fast at census time).
 *
 * The BEFORE numbers (the witness receipt, shots-qa/
 * t966-peek-fold-rider.json mode=before-witness): the STAR dialog at
 * 320 — descOver 52, dialogOverX true; the TEXT dialog — descOver 72,
 * dialogOverX true. The gate receipt (mode=gate): both FALSE, the
 * leaves clean, the t779 keyboard face intact.
 *
 * Bands:
 *   S — the inspector's two peek dialogs carry the t913 grammar verbatim
 *       (icon shrink-0, name span min-w-0 truncate, description
 *       break-all) + the two Esc keymap seats + the Kbd import.
 *   R — the results-view family's own cure stands untouched (the grammar
 *       traveled by ADDITION, never by deletion).
 *   B — the brains the doors share are untouched: TextPreview's tail
 *       contract (the 55vh break-words pre, the focus) and StarTable's
 *       scroll box (max-h-96 overflow-auto, the sticky choreography).
 *   A — the tree guard: EVERY font-mono dialog description in BOTH
 *       families carries break-all — the t913 family law, now file-wide.
 *   M — the mint + the rider are on disk with their contracts (the
 *       bench's four faces, the rider's two modes).
 *   G/M8 (t969) — the PANEL tier: the Overview's own mouths take the
 *       narrow step (the grid block's explicit single column) and the
 *       presets button group wraps internally; the panel-walk instrument
 *       pins the tier as a contract (panelOverX FALSE is the law).
 *
 *   node scripts/t966-peek-fold-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`ok ${pass} — ${label}${extra ? `  (${extra})` : ""}`); }
  else { fail++; console.log(`FAIL ${fail} — ${label}${extra ? `  (${extra})` : ""}`); }
};
const srcOf = (p) => readFileSync(path.join(ROOT, p), "utf8");

const insp = srcOf("src/components/workflow/job-inspector.tsx");
const rv = srcOf("src/components/workflow/results/results-view.tsx");
const tp = srcOf("src/components/workflow/results/text-preview.tsx");
const st = srcOf("src/components/workflow/results/star-table.tsx");

/* ---------- S — the inspector's peek doors speak the t913 grammar ---------- */

// the two dialog blocks (scoped by their state gates, not the whole file)
const textBlock = insp.match(/<Dialog open=\{textFile !== null\}[\s\S]*?<\/Dialog>/)?.[0] ?? "";
const starBlock = insp.match(/<Dialog open=\{starFile !== null\}[\s\S]*?<\/Dialog>/)?.[0] ?? "";
ok("S1 the text door's block exists in the inspector", textBlock.length > 200);
ok("S2 the star door's block exists in the inspector", starBlock.length > 200);

ok("S3 the TEXT description carries break-all (the t913 word)",
  /<DialogDescription className="break-all font-mono text-\[11px\]">/.test(textBlock),
  textBlock.match(/<DialogDescription className="([^"]*)"/)?.[1] ?? "none");
ok("S4 the STAR description carries break-all (the t913 word)",
  /<DialogDescription className="break-all font-mono text-\[11px\]">/.test(starBlock),
  starBlock.match(/<DialogDescription className="([^"]*)"/)?.[1] ?? "none");

ok("S5 the TEXT title's name is a min-w-0 truncate span (the t913 grammar)",
  /<DialogTitle className="flex items-center gap-2 text-sm">\s*<ScrollText className="h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" \/>\s*<span className="min-w-0 truncate">\{textFile\.name\}<\/span>/.test(textBlock));
ok("S6 the STAR title's label is a min-w-0 truncate span (the t913 grammar)",
  /<DialogTitle className="flex items-center gap-2 text-sm">\s*<Table2 className="h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" \/>\s*<span className="min-w-0 truncate">\{starFile\.label \?\? starFile\.name\}<\/span>/.test(starBlock));

ok("S7 the TEXT door carries the Esc keymap seat (the t832 voice)",
  textBlock.includes('data-canvas-ui="files-text-keymap"') && textBlock.includes("<Kbd>Esc</Kbd>"));
ok("S8 the STAR door carries the Esc keymap seat (the t832 voice)",
  starBlock.includes('data-canvas-ui="files-star-keymap"') && starBlock.includes("<Kbd>Esc</Kbd>"));

ok("S9 the Kbd import rides the inspector (the seat's own import)",
  insp.includes('import { Kbd } from "@/components/ui/kbd";'));

/* ---------- R — the results-view family's cure stands untouched ---------- */
const rvDescs = [...rv.matchAll(/<DialogDescription className="([^"]*)"/g)].map((m) => m[1]);
ok("R1 the results view still carries its break-all descriptions (the grammar traveled by addition)",
  rvDescs.filter((c) => c.includes("break-all")).length >= 2,
  rvDescs.join(" | ").slice(0, 120));
ok("R2 the results view still truncates its dialog titles (min-w-0 truncate spans present)",
  (rv.match(/<span className="min-w-0 truncate">/g) ?? []).length >= 2);
ok("R3 the results view's keymap seats stand (star-keymap + text-keymap)",
  rv.includes('data-canvas-ui="star-keymap"') && rv.includes('data-canvas-ui="text-keymap"'));

/* ---------- B — the shared brains are untouched ---------- */
ok("B1 TextPreview's tail contract stands (the 55vh break-words pre, focusable)",
  tp.includes('max-h-[55vh] overflow-auto whitespace-pre-wrap break-words') && tp.includes("tabIndex={0}") && tp.includes('aria-label="File content preview"'));
ok("B2 TextPreview's focus law stands (the pre takes the focus when the tail lands)",
  tp.includes("preRef.current?.focus()"));
ok("B3 StarTable's scroll box stands (max-h-96 overflow-auto, the sticky thead, the corner cell)",
  st.includes("max-h-96 overflow-auto") && st.includes('className="sticky top-0 z-20"') && st.includes("sticky left-0 z-30"));
ok("B4 the inspector's peek doors still mount the shared brains verbatim",
  textBlock.includes("<TextPreview jobId={job.id} path={textFile.path} />") &&
  starBlock.includes("<StarTable job={job} path={starFile.path} />"));
ok("B5 TextPreview's empty face speaks its honesty (the t967 kind note: the hook, the words, the conditional)",
  tp.includes('data-canvas-ui="text-preview-empty-note"') &&
  tp.includes("0 bytes — nothing to read") &&
  tp.includes('{text === "" && ('));

const rider = srcOf("scripts/t966-peek-fold-rider.mjs");
ok("B6 the cure traveled by ADDITION — the rider's gate pins the note both ways (present on the empty face, absent on the non-empty tail)",
  rider.includes("the KIND NOTE") && rider.includes("the note is CONDITIONAL"));

/* ---------- G — the WIDE-SURFACE band: the Overview's mrc wall ---------- */
const gallery = srcOf("src/components/workflow/results/import-gallery.tsx");
ok("G1 the wall's narrow step (the t968 cure: grid-cols-2 at the fold, the sm/lg steps keep the wide walls dense)",
  gallery.includes('"grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-5"'));
ok("G2 the compare tray's own steps still speak narrow-first (the cure touched ONE grid, never the tray)",
  gallery.includes('pickedEntries.length === 3 ? "grid-cols-3"') && gallery.includes('"grid-cols-2 sm:grid-cols-4"'));
const eyeball = srcOf("scripts/t968-empty-note-eyeball.mjs");
const stepWit = srcOf("scripts/t968-gallery-step-witness.mjs");
ok("M7 the t968 instruments stand (the eyeball's two widths + the step witness's two modes — the look and the squish are contracts now)",
  eyeball.includes('process.env.WIDE') && eyeball.includes('320 fold') &&
  stepWit.includes('process.env.BEFORE === "1"') && stepWit.includes("W2 the squish") && stepWit.includes("G1 the narrow step"));

/* ---------- G/M8 — the t969 PANEL tier: the Overview's own mouths ---------- */
const insp9 = insp;
ok("G3 the two-column grid block carries the explicit single column (the t969 narrow step: without minmax(0,1fr) the fold's auto track sizes to the inputs' nowrap mono path and the panel blows open)",
  insp9.includes('"grid grid-cols-1 gap-6 lg:grid-cols-2"'));
ok("G4 the presets button group wraps internally (the +27px LEAK's cure: one incompressible flex item folded into two honest rows at the fold, side by side wide)",
  insp9.includes("ml-auto flex flex-wrap items-center justify-end gap-1.5"));
const walk9 = srcOf("scripts/t969-panel-offender-walk.mjs");
ok("M8 the t969 instruments stand (the panel walk's two modes + the hit-slop exoneration — the PANEL tier is a contract now: panelOverX FALSE is the law)",
  walk9.includes('process.env.GATE === "1"') && walk9.includes("panelOverX FALSE") && walk9.includes("hit-slop"));

/* ---------- A — the file-wide tree guard ---------- */
const monoDescs = (src) => [...src.matchAll(/<DialogDescription className="([^"]*)"/g)]
  .map((m) => m[1]).filter((c) => c.includes("font-mono"));
const inspMono = monoDescs(insp);
const rvMono = monoDescs(rv);
ok("A1 EVERY font-mono description in the inspector carries break-all (the family law, file-wide)",
  inspMono.length >= 2 && inspMono.every((c) => c.includes("break-all")),
  inspMono.join(" | "));
ok("A2 EVERY font-mono description in the results view carries break-all (the standing law, re-asserted)",
  rvMono.length >= 2 && rvMono.every((c) => c.includes("break-all")),
  rvMono.join(" | "));

/* ---------- M — the mint + the rider contracts ---------- */
const mint = srcOf("scripts/t966-peek-stress-mint.mjs");
ok("M1 the bench mint carries its three stages", ["mint", "verify", "remove"].every((s) => mint.includes(`stage === "${s}"`)));
ok("M2 the bench's four faces are named (the wide star, the long log, run.out, run.err)",
  mint.includes("MotionCorr/job002/corrected_micrographs.star") &&
  mint.includes("LogFiles/relion_motioncorr_gpu_pipeline_run.log") &&
  mint.includes('path.join(workdir, "run.out")') && mint.includes('path.join(workdir, "run.err")'));
ok("M3 the mint writes the run record (the t963 lesson — the outputs route reads run.workdir)",
  mint.includes("writeRunRecord(job.id, workdir)") && mint.includes("engine-state.json"));
ok("M4 the mint's verify band pins the tail contract (the LAST chunk with the final marker)",
  mint.includes("last line ${LOG_LINES} of ${LOG_LINES}") && mint.includes("60 * 1024") && mint.includes("66 * 1024"));
ok("M5 the rider carries both modes (the BEFORE witness + the gate)",
  rider.includes('process.env.BEFORE === "1"') && rider.includes("BEFORE-WITNESS") && rider.includes("NEVER OVERFLOWS AT 320"));
ok("M6 the rider walks all three doors (the star, the long tail, the empty face)",
  rider.includes('Preview ${rowName}') && rider.includes('clickPreview("run.err"') && rider.includes('aria-label="File content preview"'));

console.log(`\nPEEK-FOLD-UNIT t966: ${pass}/${pass + fail} ${fail === 0 ? "green — the t913 grammar lives in BOTH families, the empty face speaks its honesty, the mrc wall takes the narrow step, the tree guard is file-wide" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

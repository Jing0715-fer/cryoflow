#!/usr/bin/env node
/**
 * t982 — the ARIA-REFUSAL unit (node-only): the message-quality FIFTH
 * pass's first sub-option, pinned. The first four passes judged refusal
 * TEXTS (t961 server literals, t962 client setters/toasts, t960 the ISE
 * dialect, the unit tripwires); this unit judges the refusal NAMES —
 * a state-disabled button whose accessible name never carries the
 * reason is a silent refusal, the same dishonesty in a different organ.
 *
 * THE AUDIT (this unit's birth): the census (t982-aria-refusal-census)
   walked 171 state-disabled tags across src/components and classified
 * each by its naming mechanism: stateful 61 · described 0 · silent-static
 * 43 · silent-text 67 — 110 silences in 38 files. The targeted cures
 * landed on 13 faces across 4 files (every one icon-only or
 * statically-labelled, every reason variable already in scope):
 *
 *   assistant-panel  Send            (empty input)
 *   canvas           Zoom out        (the ZOOM_MIN clamp)
 *   canvas           Zoom in         (the ZOOM_MAX clamp)
 *   canvas           Save current view (unnamed bookmark)
 *   canvas           Export canvas as PNG (poster busy / no jobs)
 *   canvas-find-bar  Previous match  (no results yet)
 *   canvas-find-bar  Next match      (no results yet)
 *   hpc-queue-sim    Compare profiles (a sweep running)
 *   hpc-queue-sim    Run simulation  (loading)
 *   hpc-queue-sim    Copy/Download CSV ×2, Copy/Download Markdown ×2
 *                                    (no comparison yet)
 *
 * THE LAWS PINNED:
 *   A1  the census is SELF-CONTAINED — this unit re-runs it live into a
 *       temp receipt (a stale receipt is a lie the unit refuses to read);
 *   A2–A5 the tally by SLOT (population 171, stateful 74, silent-static
 *       30, silences 97) — RE-KEY LAW: curing more silent faces re-keys
 *       these slots in the SAME commit (the F-band's own birth law);
 *   A6  the design-exclusion law — literal disabled={true|false} is a
 *       design decision, not a state refusal, and never counts;
 *   A7–A19 the THIRTEEN cured source shapes (in-process includes — the
 *       t957 capture-layer law: assert in-process, never via echoes).
 *
 * THE PROBE PROTOCOL: node-only, no imports from src — the census child
 * process plus readFileSync includes, exit honest.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CENSUS = path.join(ROOT, "scripts/t982-aria-refusal-census.mjs");
const TMP = path.join(ROOT, "shots-qa/.t982-unit-receipt.json");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* A1 — the census re-runs live */
let receipt = null;
try {
  execFileSync("node", [CENSUS, "--receipt", TMP], { encoding: "utf8", timeout: 60_000 });
  receipt = JSON.parse(readFileSync(TMP, "utf8"));
} catch (e) {
  console.log(`  ✗ the census child process — ${String(e).slice(0, 200)}`);
  fail++;
}
ok("A1 the census re-runs live and parses", !!receipt && typeof receipt.population === "number");
try { unlinkSync(TMP); } catch {}

/* A2–A5 — the tally by SLOT */
ok("A2 population = 171 (the world's shape)", receipt?.population === 171, `got ${receipt?.population}`);
ok("A3 stateful = 99 (61 standing + the 13 t982 + the 7 t983 + the 18 t984 cures)", receipt?.tally?.stateful === 99, `got ${receipt?.tally?.stateful}`);
ok("A4 silent-static = 30 (43 − the 13 cures)", receipt?.tally?.["silent-static"] === 30, `got ${receipt?.tally?.["silent-static"]}`);
ok("A5 silences = 72 (110 − the 13+7+18 cures)", receipt?.silences === 72, `got ${receipt?.silences}`);

/* A6 — the design-exclusion law, pinned at the census's source */
const censusSrc = readFileSync(CENSUS, "utf8");
ok("A6 the census excludes literal disabled={true|false} (design, not state)",
  censusSrc.includes("disabled=\\{(true|false)\\}") && censusSrc.includes("design, not state"));

/* A7–A19 — the thirteen cured source shapes */
const shape = (file, needle) => {
  try { return readFileSync(path.join(ROOT, file), "utf8").includes(needle); }
  catch { return false; }
};
const FACES = [
  ["A7", "src/components/ai/assistant-panel.tsx",
    'aria-label={!input.trim() ? "Send (type a message first)" : "Send"}'],
  ["A8", "src/components/workflow/canvas.tsx",
    'aria-label={zoom <= ZOOM_MIN ? "Zoom out (already at minimum zoom)" : "Zoom out"}'],
  ["A9", "src/components/workflow/canvas.tsx",
    'aria-label={zoom >= ZOOM_MAX ? "Zoom in (already at maximum zoom)" : "Zoom in"}'],
  ["A10", "src/components/workflow/canvas.tsx",
    'aria-label={!bookmarkName.trim() ? "Save current view (name the view first)" : "Save current view"}'],
  ["A11", "src/components/workflow/canvas.tsx",
    'aria-label={posterBusy !== null ? "Export canvas as PNG (a poster render is running)" : jobs.length === 0 ? "Export canvas as PNG (the world has no jobs yet)" : "Export canvas as PNG"}'],
  ["A12", "src/components/workflow/canvas-find-bar.tsx",
    'aria-label={n === 0 ? "Previous match (no results yet)" : "Previous match"}'],
  ["A13", "src/components/workflow/canvas-find-bar.tsx",
    'aria-label={n === 0 ? "Next match (no results yet)" : "Next match"}'],
  ["A14", "src/components/workflow/hpc-queue-sim.tsx",
    'aria-label={sweeping ? "Compare cluster profiles (a sweep is running)" : "Compare cluster profiles"}'],
  ["A15", "src/components/workflow/hpc-queue-sim.tsx",
    'aria-label={loading ? "Run queue simulation (running)" : "Run queue simulation"}'],
  ["A16", "src/components/workflow/hpc-queue-sim.tsx",
    'aria-label={!sweep.length ? "Copy comparison as CSV (run a comparison first)" : "Copy comparison as CSV"}'],
  ["A17", "src/components/workflow/hpc-queue-sim.tsx",
    'aria-label={!sweep.length ? "Download comparison as CSV (run a comparison first)" : "Download comparison as CSV"}'],
  ["A18", "src/components/workflow/hpc-queue-sim.tsx",
    'aria-label={!sweep.length ? "Copy comparison as Markdown (run a comparison first)" : "Copy comparison as Markdown"}'],
  ["A19", "src/components/workflow/hpc-queue-sim.tsx",
    'aria-label={!sweep.length ? "Download comparison as Markdown (run a comparison first)" : "Download comparison as Markdown"}'],
];
for (const [id, f, needle] of FACES) ok(`${id} ${path.basename(f)} speaks the refusal`, shape(f, needle));

/* A20–A21 — the NAME-STORY law (the t983 upgrade, the t984 sixth class):
   the census classifies every silent-text site by its story — flip (the
   text itself flips with state: honest), var (a dynamic name the scanner
   cannot judge: recorded), component (a self-closing custom component:
   the boundary), blind (a static name with no story — the cure pool,
   now CLOSED at zero), vendor (a stock-shelf file under src/components/ui/:
   the library's own code, recorded by the t984 ruling, never cured),
   unnamed (NO name at all: the heaviest disease — currently ZERO). The
   tally by SLOT; curing more blind faces re-keys A21 AND A3/A5 in the
   same commit. */
ok("A20 the story classifier lives (six classes in the census source)",
  ["flip", "var", "blind", "unnamed", "component", "vendor"].every((c) => censusSrc.includes(`"${c}"`)) &&
  censusSrc.includes("nameStory"));
const st = receipt?.storyTally ?? {};
ok("A21 the story tally by SLOT (flip 20 · var 19 · component 1 · blind 0 · vendor 2 · unnamed 0)",
  st.flip === 20 && st.var === 19 && st.component === 1 && (st.blind ?? 0) === 0 && st.vendor === 2 && (st.unnamed ?? 0) === 0,
  `flip=${st.flip} var=${st.var} comp=${st.component} blind=${st.blind ?? 0} vendor=${st.vendor} unnamed=${st.unnamed ?? 0}`);

/* A22–A28 — the seven t983 cures (the BLIND pool's first wave — every
   face a text button, every cure keeps the label-in-name law: the
   visible text is a PREFIX of the accessible name in both branches): */
const FACES3 = [
  ["A22", "src/components/workflow/canvas.tsx",
    'aria-label={jobs.length === 0 ? "Zoom to fit workflow (the canvas is empty)" : "Zoom to fit workflow"}'],
  ["A23", "src/components/workflow/canvas.tsx",
    'aria-label={jobs.length === 0 ? "Tidy layout (the canvas is empty)" : "Tidy layout"}'],
  ["A24", "src/components/workflow/canvas.tsx",
    'aria-label={posterBusy !== null ? "Export canvas as PNG (a poster render is running)" : jobs.length === 0 ? "Export canvas as PNG (the canvas is empty)" : "Export canvas as PNG"}'],
  ["A25", "src/components/workflow/canvas.tsx",
    'aria-label={posterBusy !== null ? "Copy canvas as PNG image (a poster render is running)" : jobs.length === 0 ? "Copy canvas as PNG image (the canvas is empty)" : "Copy canvas as PNG image"}'],
  ["A26", "src/components/workflow/canvas.tsx",
    'aria-label={jobs.length === 0 ? "Export workflow as JSON (the canvas is empty)" : "Export workflow as JSON"}'],
  ["A27", "src/components/workflow/job-inspector.tsx",
    'aria-label={!name.trim() ? "Save preset (name the preset first)" : name.trim().length > 60 ? "Save preset (the name is over 60 characters)" : "Save preset"}'],
  ["A28", "src/components/workflow/homecoming-sweep.tsx",
    'aria-label={owing.length === 0 ? "Bring home all (nothing is owed)" : "Bring home all"}'],
];
for (const [id, f, needle] of FACES3) ok(`${id} ${path.basename(f)} speaks the refusal`, shape(f, needle));

/* A29–A46 — the eighteen t984 cures (the BLIND pool's SECOND wave — the
   AMBIENT-REFUSAL ruling applied): the name carries the reason regardless
   of ambience (the modal's own announcement is why the reason is CHEAP to
   learn, not why the name may omit it); the ambient form speaks the
   ONGOING ACT ("the cleanup is running"), not an instruction; the
   discoverable-state faces keep the instruction form ("type a path
   first"); the label-in-name fence holds on every face. */
const FACES4 = [
  ["A29", "src/components/workflow/cleanup-dialog.tsx",
    'aria-label={executing ? "Close (the cleanup is running)" : "Close"}'],
  ["A30", "src/components/workflow/cleanup-dialog.tsx",
    'aria-label={executing ? "Keep them (the cleanup is running)" : "Keep them"}'],
  ["A31", "src/components/workflow/project-dashboard.tsx",
    'aria-label={deleting ? "Cancel (the deletion is running)" : "Cancel"}'],
  ["A32", "src/components/workflow/project-panel.tsx",
    'aria-label={creating ? "Cancel (the project is being created)" : "Cancel"}'],
  ["A33", "src/components/workflow/remote-cluster-dialog.tsx",
    'aria-label={creating ? "Add connection (the create form is open)" : "Add connection"}'],
  ["A34", "src/components/workflow/template-presets-dialog.tsx",
    'aria-label={busy ? "Reset (a pipeline is being created)" : "Reset"}'],
  ["A35", "src/components/workflow/template-presets-dialog.tsx",
    'aria-label={busy ? "Cancel (a pipeline is being created)" : "Cancel"}'],
  ["A36", "src/components/workflow/workspace-panel.tsx",
    'aria-label={deleting ? "Cancel (the workspace is being deleted)" : "Cancel"}'],
  ["A37", "src/components/workflow/workspace-panel.tsx",
    'aria-label={creating ? "Cancel (the workspace is being created)" : "Cancel"}'],
  ["A38", "src/components/workflow/import-workflow-dialog.tsx",
    'aria-label={busy ? "Cancel (the import is running)" : "Cancel"}'],
  ["A39", "src/components/workflow/job-inspector.tsx",
    'aria-label={busy ? "Apply preset (a preset is being applied)" : "Apply preset"}'],
  ["A40", "src/components/workflow/job-card.tsx",
    'aria-label={noteBusy ? "Clear note (the note is being saved)" : "Clear note"}'],
  ["A41", "src/components/workflow/hpc-profiles-editor.tsx",
    'aria-label={profiles.length >= MAX_PROFILES ? "Add (the profile limit is reached)" : "Add"}'],
  ["A42", "src/components/workflow/job-panel.tsx",
    'aria-label={!dirty ? "Reset (nothing to revert)" : "Reset"}'],
  ["A43", "src/components/workflow/path-browser-dialog.tsx",
    'aria-label={!manual.trim() ? "Go (type a path first)" : "Go"}'],
  ["A44", "src/components/workflow/path-browser-dialog.tsx",
    'aria-label={!manual.trim() ? "Use this path (type a path first)" : "Use this path"}'],
  ["A45", "src/components/workflow/path-browser-dialog.tsx", [
    '"Select this folder (the roots view is open)"',
    '"Select this folder (no folder is open yet)"',
  ]],
  ["A46", "src/components/workflow/pipeline-script-dialog.tsx",
    'aria-label={!data?.script ? "Download .sh (no script yet)" : "Download .sh"}'],
];
for (const [id, f, needle] of FACES4) {
  const needles = Array.isArray(needle) ? needle : [needle];
  ok(`${id} ${path.basename(f)} speaks the refusal`, needles.every((n) => shape(f, n)));
}

console.log(`VERDICT: ${fail === 0 ? `GREEN ${pass}/${pass + fail}` : `RED ${pass}/${pass + fail}`}`);
console.log(`${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

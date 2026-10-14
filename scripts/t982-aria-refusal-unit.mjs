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
ok("A3 stateful = 74 (61 standing + the 13 cures)", receipt?.tally?.stateful === 74, `got ${receipt?.tally?.stateful}`);
ok("A4 silent-static = 30 (43 − the 13 cures)", receipt?.tally?.["silent-static"] === 30, `got ${receipt?.tally?.["silent-static"]}`);
ok("A5 silences = 97 (110 − the 13 cures)", receipt?.silences === 97, `got ${receipt?.silences}`);

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

console.log(`VERDICT: ${fail === 0 ? `GREEN ${pass}/${pass + fail}` : `RED ${pass}/${pass + fail}`}`);
console.log(`${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

# diag-archive — one-shot diagnostics, kept for provenance

Everything in this directory answered ONE question once (usually during an
investigation round) and its findings live in `/home/z/my-project/worklog.md`
under the Task that spawned it. None of these run in the regression matrix;
none are maintained. They are kept (rather than deleted) because each one
documents a debugging technique or a bisect that took real effort to build,
and the next investigation of the same subsystem may want to start from it.

## Inventory

| File | Task | Question it answered |
|------|------|----------------------|
| diag-exit-reason.ts | — | failure-message specificity + exit-code meanings (engine) |
| diag-lineage.ts | — | replicate dispatch lineageFor + resolveInputs read-only |
| diag-wsl-bridge.ts | — | WSL path-bridge round-trip verification |
| qa39-diag.mjs | 39 | why bookmark restore did not reproduce the Top hash |
| qa63-esc-diag.mjs | 63 | layered-Esc race evidence gathering |
| qa63-page-diag.mjs | 63 | page-level error context for the smoke harness |
| qa63-race-test.ts | 63 | writeRuns migration race reproduction |
| qa64-diag.mjs | 64 | net/legend investigation support |
| qa64-legend-diag.mjs | 64 | legend rendering probes |
| qa64-net-diag.mjs | 64 | network-level probes behind the legend |
| qa64-setparams.cjs | 64 | direct Prisma param setter for qa64 fixtures |
| qa69-pgm-probe.mjs | 69 | PGM pixel sampling support probe |
| qa69-title-debug.mjs / -debug2.mjs | 69 | title attribute loss debug |
| qa70-esc-bisect.mjs | 70/88 | Esc flake bisect (agent-browser CDP vs Radix) |
| qa72-esc-diag.mjs / -measure / -probe | 72 | Radix dialog Esc layering diagnostics |
| qa73-click-probe.mjs | 73 | click-through reproduction |
| qa75-header-probe.mjs | 75 | header layout probe |
| t79-media-probe.mjs / t79-print-probe.mjs | 79 | media + paper assertions support |
| t80-esc-diag.mjs | 80 | lightbox Esc teardown bug evidence |
| t81-chain-replay.mjs / -palette-diag / -store-diag | 81 | chain replay / palette / store isolations |
| t84-table-probe.mjs / -probe2 | 84 | aside table geometry probes |
| qa58-geom-probe.mjs | 92 | zoom/note button overlap measurement (the smoking gun) |
| t96-shape-probe.mjs | 96 | curl experiment nailing the server rename scope: project-wide (iN) renames, never same-name duplicates |

| t99-diag*.mjs / t99-sample.mjs | 99 | #418 hunt: single/dense/3-tab reload samplers — pinned the culprit to the standalone data snapshot divergence, not hydration code |

## Status

Archived 2026-09-10 (Task 92) when the migration to playwright removed the
agent-browser channel these mostly drove. To resurrect one: `git mv` it back
to `scripts/` and check its hardcoded paths still exist.

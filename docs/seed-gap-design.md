# Seed-Gap Design — the two C-class workdirs, designed and executed

**What this is.** Task 692's strip-aliveness census priced two dead strips as
C-class SEED gaps (world limitations, not product bugs): `refine3d` (halves +
model.star present, the data star never seeded) and `initialmodel` (no workdir
at all — not even the directory). Task 695's entry list ② carried the design
as optional; this window designs it, executes it against the live world as an
idempotent patch, and documents one adjacent lib-tolerance question the
design work surfaced. Zero product code changes — the whole batch is world
data + documentation.

## The verdicts being executed (t692 census, re-verified this window)

```
[  refine3d | completed] cmuwipe635000refine3d    DEAD  walk-files=5
[initialmodel | completed] cmututold000initialmodel DEAD  walk-files=0
verdict: 5 alive / 12 dead / 17 completed of 17 jobs
```

- `refine3d` workdir (`data/relion/cmuwipe6350000demoproject/refine3d_refine3d/`):
  `run_it020_half1.mrc`, `run_it020_half2.mrc`, `run_it020_model.star`,
  `run.log`, `run.err` — a *completed refinement's tail* missing the one file
  every completed RELION auto-refine leaves behind: `run_data.star`.
- `initialmodel`: `workdirFor` derives `initialmodel_ialmodel`
  (`engine.ts` L742-744: `RELION_DIR/projectId/{type}_{id.slice(-8)}`) — the
  directory does not exist on disk. The seed created the job record and both
  edges (`select → initialmodel → class3d`, seed L686-688) but wrote nothing.

## The dialect anchors (what the lib reads, what real RELION writes)

**lib branch — initialmodel** (`src/lib/relion/output-summary.ts` L482-519,
shared with `class3d`):
- particles: `latestByPattern(/^run_it(\d+)_data\.star$/)` else
  `firstByName(["run_data.star"])` → "particles seeded"
- class maps: files matching `/^run_it\d+_class\d+\.mrcs?$/i` at the LATEST
  iteration → "class maps"
- both absent → `null` (the strip stays dark)

**lib branch — refine3d** (L521-549, shared with polish/ctfrefine/subtract/
symexpand/rebalance/tomo_extract):
- `firstByName(["run_data.star", "shiny.star", "particles_polished.star",
  "particles_ctf_refine.star", "particles_subtracted.star", "particles.star"])`
  → rowsOf → "particles refined"
- note what is NOT in the list: `run_itNNN_data.star` (see the adjacent
  question below)

**real RELION shapes** (the seed must speak the engine's dialect, and the
engine's dialect is real RELION's):
- a completed auto-refine writes per-iteration `run_itNNN_data.star` +
  `run_itNNN_model.star` + half maps, and the final `run_data.star` +
  `run_model.star` + half pair. The seeded world already carries the tail
  (it020 halves + model.star); it is missing exactly the final data star.
- a completed initialmodel (VDAM) writes per-iteration `run_itNNN_data.star` +
  `run_itNNN_classNNN.mrc` (K classes) + `run_itNNN_model.star`, and finals
  `run_data.star` / `run_model.star` / `run_class001.mrc`.
- in-repo corroboration that per-iteration data stars are the refine-family
  dialect: `engine.ts` L9049 lists `run_it${it}_data.star` inside the
  gold-standard iteration family, and L8378 reads
  `run_it${iterStr}_data.star` for class picking.

## The story numbers (world consistency)

The demo graph is import(10) → motioncorr(10) → ctffind(10) → autopick(175)
→ extract(240) → select(168) → class2d(240 rows seen / 8 classes) →
select2d(168) → class3d(168 / 3 classes) → symexpand / rebalance(168) →
refine3d → postprocess, with the workflow pair initialmodel between select
and class3d. Therefore:

- `refine3d/run_data.star` carries the **168** particles its upstream
  rebalance handed it — the strip wakes as "168 particles refined".
- `initialmodel` rides the same select verdict (its only upstream is
  select): `run_it005_data.star` carries the same 168 rows — "168 particles
  seeded" — and one class map per iteration (K=1: a single de novo reference
  is exactly what the downstream class3d reference gate consumes) —
  "1 class maps". Iteration number 005 is story-free (the strip reads only
  the latest); 005 sits between class3d's 003 and class2d's 012.

## The execution shape (two layers, one contract)

1. **The seed script fix (future worlds).** `scripts/qa-t531-old-world-seed.mjs`
   gains three `plan.push` lines: refine3d's `run_data.star`
   (`buildParticlesStar(keptRows, true)`) and initialmodel's workdir family
   (`run_it005_data.star`, `run_it005_class001.mrc` via `buildMrcSingle(64)`,
   `run_it005_model.star` via `buildModelStar(3.9, false)`, plus finals
   `run_data.star` / `run_model.star` / `run_class001.mrc`), and an
   `outputsPlan` entry for initialmodel if the ledger wants one. The seed is
   the honest place for the fix: a seeded COMPLETED job should leave the
   files a completed job leaves.
2. **The live-world patch (this window).** The current world was seeded once
   and is now load-bearing (the drill bed's roster floor, the t677 runtime
   probes, the t695 strip-wire probe all live in it). Re-running the whole
   seed to repair two workdirs would reset a world eight windows of probes
   have baselined against — rejected. Instead:
   `scripts/t696-seed-gap-patch.mjs` — idempotent, read-the-world-first:
   - reads the REAL `selected.star` rows from
     `select_00select/selected.star` (the world's own truth for "168 kept";
     no row-machinery replication) and reuses them verbatim for both data
     stars — the refined/seeded particles ARE the selected particles;
   - replicates `buildParticlesStar` / `buildMrcSingle` / `buildModelStar`
     byte-faithfully from the seed (t695's provenance law: copy fully, name
     the source lines in a comment — the builders are 10-30 lines, the
     drift risk is the copy's, and the provenance comment is its leash);
   - guards every write with an exists-check (re-collection idempotent —
     the same law `synthesizeSequentialHalves` obeys at engine L8007);
   - prints a per-file verdict and re-runs the t692 census for the tail.

   Why the patch writes exactly ONE record and NO job-DB rows: the outputs
   route resolves the workdir THROUGH the run record (`job-outputs.ts` L134
   `getRun` — the missing-record short-circuit fires BEFORE any walk, so a
   workdir without a record is invisible to the wire). The seed wrote
   records for its CHAIN jobs (refine3d's record carries
   `cmd: "seeded:refine3d"`) but skipped the WORKFLOW-PAIR jobs —
   initialmodel needed BOTH layers: the engine-state record AND the
   workdir. **This amends t692's pricing**: "workdir 全空" was one visible
   layer; the record gap sat behind it and the census could not see it
   (walk-files=0 read the outputs response, which short-circuits at the
   record). External writers are a documented, tolerated pattern
   (`engine.ts` L261-262: readRuns' mtime/size check picks up external
   writers; the seed itself wrote the `seeded:*` records this way). The
   job-DB roster stays 17; `RunRecord.logFile/errFile` are required fields,
   and the t636 claim-without-write law says a record may not name files
   that do not exist — so the patch writes run.log/run.err too.

## The adjacent question the design surfaced (build-day candidate, NOT auto-included)

The lib's refine3d branch accepts only the six final names — a refinement
stopped mid-run (real RELION leaves `run_it020_data.star`, no final) would
keep its strip dark despite a full data star sitting in the workdir. The
initialmodel/class3d branch right above it already speaks
`latestByPattern(run_itNNN_data.star)`. One-line tolerance
(`latestByPattern(/^run_it(\d+)_data\.star$/)` as a first fallback before
`firstByName`), same shape the family already uses. Priced as a CANDIDATE:
no probe exercises a mid-run refine3d today, and t692's census never flagged
it because the world never had one — it goes in the build-day batch's
optional annex, judged there by the same "方言缺口" criterion as the six
B-class tolerances, not by this document's enthusiasm.

## Safety audit (why the patch cannot break the watchers)

- **Bed world-guard is dynamic, not pinned**: t261's pre-suite roster check
  is a FLOOR (`roster0 >= 12`, t689's honest dialect); t262's cleanup deletes
  only its OWN created ids and protects "every workdir the world still
  speaks" via a live directory listing. A new workdir is shielded, not
  tripped. The "盾 17 workdirs" in past worklogs was descriptive prose, not
  an assertion.
- **No probe pins the refine3d file list**: every `run_it020` reference in
  scripts/ is `.find(path === …)` or `.includes(…)` (t661/t662/t664 MAP_PATH,
  t210's outputs check) — additive files cannot break find/includes.
- **initialmodel is dormant territory**: zero script references to
  `initialmodel_ialmodel` — nothing to break.
- **Sequencing law**: the patch runs only AFTER the window's bed rotation
  completes — world mutations never land under a live rehearsal.
- **Verification net after the patch**: t692 census re-run (expect 7 alive /
  10 dead), t677 re-run (30/0), t695 strip-ui-wire ×2 (world-following —
  the two waking faces are auto-verified in the UI without touching the
  probe), and one agent-browser spot check of the two faces.

# t699 — the engine-state record census: every completed job owes a full life

Window 699 (2026-10-08, trace `1a07549302235a99-cron-agent-loop-202610081355`).
The third legacy-audit candidate from Task 698's entry list, executed as a
read-only instrument plus one idempotent world patch.

## The instrument the strip censuses could not be

t692's strip-aliveness census measured the world through the outputs
endpoint's **summary leg**: a face is alive if the endpoint hands the
KeyNumbersStrip numbers. That measurement path has a blind spot — an
**A-class designed-silence** job has no summary to measure
(`output-summary.ts` L571: "training curve, maskcreate/localres (single
map) — no key numbers"), so nothing about its record layer can ever
register as a dead face that could wake. A missing record under an
A-class job is invisible to every instrument that looks at the summary.

The record census looks at the record itself. For every job whose DB row
says `completed`, it demands the full life (the t696 law, generalized to
a re-runnable instrument):

1. **a run record** in `data/engine-state.json` (the outputs route
   resolves the workdir THROUGH `getRun` — `job-outputs.ts` L134 — so no
   record means the whole endpoint short-circuits before any walk);
2. **a workdir on disk** at the record's path;
3. **logFile + errFile** present (required record fields, engine L114;
   the t636 claim-without-write law forbids naming files that don't exist);
4. **every `outputs` value exists** on disk (both shapes: path strings,
   and class2d's `classes_mrc` path LIST — the census audits arrays too);
5. **the outputs endpoint answers `status: "ok"`** — not the
   `missing-record` confession.

## The verdicts

### Completed-life audit: 16/17 → **17/17** after the patch

Exactly one incomplete life in the live world:

**`cmututold00000maskcreate`** — DB row: completed, progress 100,
duration 8s, `result: null`, `hasLog: false`. Seed wrote: a DB row, two
workflow edges, nothing else. No record, no workdir, no files. Its
outputs endpoint answered the missing-record confession: *"This job
completed, but its run record is missing — re-run the job to rebuild."*

Why it matters beyond doctrine — **it sits on the live main chain**:

```
refine3d --half1--> maskcreate --mask--> postprocess
```

`resolveInputs` (engine L1872) resolves each input by walking the BFS
lineage and reading `runs[up.id].outputs[key]`; with no record the
provider is skipped, so a re-run of postprocess would be told *"solvent
mask (run MaskCreate first)"* — over a provider that IS completed. The
t325-class lie ("run X first" about an X that already ran), local flavor.

Why the old-world seed skipped it: topaztrain/topazdenoise/initialmodel
(the other workflow-pair members) all got records; maskcreate alone got
a bare DB row. t696's design doc scoped the two gaps its census could
see; maskcreate was hidden behind the A-class silence. **The seed-gap
family is now complete: three C-class gaps found, three patched.**

### Orphan records: 20 — a complete fossil world, inert

All 20 orphan records (`cmuyb*`) belong to project
`cmuyb4tb50000on85bg44ugzz`, which no longer exists in the DB (the live
project is `cmuwipe6350000demoproject`). Their **workdirs all survive on
disk** — a fossil world whose jobs were deleted but whose records and
files were left intact. Classification: **inert**. Records are keyed by
job id; `resolveInputs` reaches providers only through the EDGES of live
jobs, and no live job shares an id with a fossil. `readRuns` loads all 36
records on every engine read — the cost is one JSON file of trivial size.

Disposition: **documented, left in place.** Deleting them would be world
surgery with zero functional gain and nonzero risk (the era pre-surgery
veto of earlier windows stands, now with measured evidence). If a future
window wants a cleanup, it is a mechanical idempotent patch of the same
shape as t696/t699 — exists-guarded, fixed-timestamp, self-verifying.

## The patch (idempotent, double-run verified)

`scripts/t699-maskcreate-life-patch.mjs` gives maskcreate its full life:

- **workdir** `maskcreate_skcreate` — `workdirFor`'s own convention
  (`type_id.slice(-8)`, engine L742);
- **`mask.mrc`** — the lib's exact dialect (engine L1744 exact table:
  `maskcreate → mask_mrc: ["mask.mrc"]`; L6955 `--o outPath(ctx,
  "mask.mrc")`), a **real 64³ float32 volume** (t661's law: nz=1 stubs
  poison the 3D viewer world) with mask VALUES — 1.0 inside a spherical
  core, smoothstep falloff to 0.0 across a soft edge (what
  `relion_mask_create --ini_threshold/--width_soft_edge` actually
  writes), dmin 0, dmax 1;
- **`run.log` / `run.err`** — the record names them, so they must exist;
- **the record** — `cmd: "seeded:maskcreate"`, `outputs.mask_mrc`,
  `startedAt: 2026-10-07T18:35:12.500Z` (the seed session's heartbeat
  family, fixed for byte-identical re-runs), `done: true, exitCode: 0`.

Safety audit before the surgery: no live probe references maskcreate in
the demo world (t677/t695/t692/t693 clean; family-run mentions the type
only in a comment about the EMPIAR chain, which builds its own world);
the bed's world-guard is a dynamic lower bound (18 workdirs ≥ 17 holds);
t695 is world-following (wire recomputed per job from the outputs
endpoint — maskcreate's summary stays null, so no-strip on both wire and
UI legs; the probe needed zero changes).

## Verification net (all green)

- post-fix census: **17/17 full lives, incomplete 0, orphans 20 (unchanged)**
- outputs endpoint: `status: "ok"`, files walk lists mask.mrc as
  `kind: "mrc"`, `slices: 64`, `dims: [64,64,64]` — the endpoint's own
  metadata reads the volume as a real volume
- t677 runtime-by-stage: **30/0**
- t695 strip-ui-wire: **125/0 ×2** (world-following acceptance, zero changes)
- agent-browser live (t695 protocol: explicit view switch, tenant by
  name, inner-button clicks, re-anchor on stale refs): inspector tenant
  "MaskCreate (seeded)" verified → Files tab: mask.mrc row "Mask · MRC ·
  64³ voxels · 1.0 MB · Download" → Results tab: "Maps & images (1)"
  with the Mask card → Enlarge: central slice renders ("Central slice
  (z=32 of 64) · 64 sections") → **"View in 3D (Mol*)": the isosurface
  renders the mask as the orange sphere it is** (screenshot
  `shots-qa/t699-mask-molstar.png`); Mol* console: `map fetched 1049600`
  → `ready`, zero errors
- voxel-math cross-check (the t697 flavor): Mol* contour 2.00σ shows
  0.9433 — with dmean 0.166 and the mask's voxel distribution σ ≈ 0.389,
  0.166 + 2·0.389 = 0.944 ✓ — the seeded volume's math reads back
  consistent from a third-party instrument

## The lessons

1. **Designed silence masks seed gaps.** The A-class jobs (no summary
   branch) are exactly the jobs the strip census can never audit — their
   record layer needs an instrument that reads records. When a census is
   built on one consumer's view of the world, the jobs that consumer
   ignores inherit the census's blind spot. The record census is that
   blind spot's retirement.
2. **The seed's completeness unit was already law; the audit was
   missing.** t696 legislated "a completed job must carry all its claimed
   artifacts" while fixing the two gaps its instrument could see. The
   law was right; the enforcement instrument arrived one window later —
   and immediately caught the third sibling. Laws without re-runnable
   audits stay as folklore; with them, every future seed is checked by
   running one script.
3. **"Re-run the job to rebuild" is a lie the world cannot obey.** The
   missing-record confession tells users to re-run a job in a seeded
   demo world where re-running re-runs nothing (the provider would
   resolve, the seed would not reproduce). The honest fix is the
   artifact, not the advice.
4. **Mol* remains the strictest MRC contract auditor.** The "MAP " magic
   and MACHST fields exist because Mol* refuses files without them; a
   mask that renders as a sphere, with contour math that reads back
   consistent, is a volume that satisfies the whole downstream family
   (slice views, histograms, subvolume, profiles — all served by the
   same mrc.ts readers).

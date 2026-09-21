# CryoFlow E2E review suite (2026-09 code review + t341 fix verification)

API-level end-to-end suites that drove the full review and the fix
regressions against the mock cluster (services/mock-cluster) with REAL
EMPIAR-10017 β-galactosidase data. Everything runs against a dev server
on :3001 and the mock SSH cluster on :3022 (see `launch.sh` in both
places; the suites assume both are up).

| suite | what it proves |
| --- | --- |
| `run-1-full-pipeline.mjs` | the 11-job structure-parsing chain (Import → … → PostProcess) on Slurm with real EMPIAR bytes; FSC(0.143) lands |
| `run-2-reset-rerun.mjs` | reset keeps files by design; re-run wipes stale generations on BOTH sides (t333/t318); changed-box re-runs never collide |
| `run-3-delete-restore.mjs` | delete keeps the workdir (undo's premise); the t341 tombstone restores run record + edges SERVER-side; downstream consumes a restored job with NO re-run |
| `run-4-ghost-sbatch.mjs` | reset during staging no longer leaks a ghost sbatch (t341 dispatch fence); the same-name stale-run reaper (`scancel -n`) reclaims a pre-fix cluster in one Re-run |
| `run-5-cleanup-api.mjs` | the cleanup plan/execution both ends, tiered, manifest-rewritten; a fresh dispatch no longer mutes the plan for a TTL (t341 publish:false) |
| `run-6-batch-size.mjs` | the memory-aware refine batch (box 360 → `--batch_size 32`, box ≤ 200 → RELION default, explicit param wins) + the sbatch shape (one rank per GPU as the script's own `CF_RANKS`/`CF_GPU_LIST` clamp variables, the t341 GPU-pin block, the t342 starved-card refusal block) |
| `run-7-gpu-coherence.mjs` | t342: a node exposing 1 GPU clamps a width-2 MPI dispatch to one rank (narrated in run.out, the job completes instead of freezing); a card below 1000 MB free is refused pre-launch with the holder PIDs named (exit 98); a particles.star with NO local copy is read through its cluster twin and verified — the "unreadable → check did not run" receipt is extinct |
| `run-8-star-lane.mjs` | t343: the consumption-lane star read — one map, one lane, one address. A poisoned LOCAL mirror never earns a verdict (the twin lane judges the cluster copy in place); the upload lane refuses on poisoned LOCAL bytes (those exact bytes would ship, the row keeps its state); a gone twin names the door + the cat's own word + the remedy while the job fails fast at relion's own door; a foreign-cluster upstream record takes the upload lane with a byte-level witness |
| `run-9-wipe-budget-poison-gate.mjs` | t344: the wipe's real budget + the poison caught before the burn. The mock's rm levers (`~/.slurm/rm-slow-ms`, one-shot `rm-channel-close`, witness `rm-lever.log`) reproduce the field report — a 35s rm (over the old 30s budget, inside the new 180s) no longer refuses the re-run; a channel that dies mid-rm retries once on a fresh connection; a star row bumped past its stack's NZ (the "Image number 383 exceeds stack size 382" shape) is refused at dispatch with the exact readMRC numbers, zero slurm accounting rows; the recovery path (re-run extract → the SAME class2d completes verified) is walked end-to-end |

## Real-data fixtures (not in git)

The suites read the EMPIAR-10017 Falcon micrographs from the mock
cluster's `/data2/empiar-10017/micrographs` (run-3/5/6 import them
cluster-side; run-1/2/4 copy 8 of them into `fixtures/mics/` — 512 MiB —
to stage a real upload window). Fetch once per machine:

```bash
# from https://empiar.org/10017 (Henderson group Falcon-II β-gal data)
curl -sO https://ftp.ebi.ac.uk/empiar/world_availability/10017/data/Falcon_2012_06_12-15_33_42_0.mrc   # …repeat for the 8 names below
```

The eight files the suites expect (4096² float32, 64 MiB each):
`Falcon_2012_06_12-14_33_35_0 / -14_57_34_0 / -15_07_41_0 / -15_14_01_0 /
-15_17_31_0 / -15_27_22_0 / -15_30_21_0 / -15_33_42_0` — place them in
`services/mock-cluster/fs/data2/empiar-10017/micrographs/` (and their
`.coord` siblings into `.../coords/` for autopick realism). Without them,
run-1/2/4/5/6 fail at their first import assertion; run-3 needs only the
cluster-side copies.

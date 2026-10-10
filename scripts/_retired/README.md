# Retired QA suites

Suites whose contracts were superseded by product evolution, kept here
(git mv, verdict inside) so the run lane never trips over a fossil while
git history plus this verdict preserve what they witnessed. A suite
earns retirement only after an archaeology pass proves each of its pins
is either covered by a living suite in evolved form, or names a feature
the product deliberately retired. Deletion without a verdict is
forbidden — the fossil is the receipt.

## t293-slurm-submit.mjs — retired 2026-10-04 (Task 541)

The suite pinned the t293-era user report: "为何看不到 relion 5？
environment lines 中我写的 module load …，确认这个命令可以调用 relion
5。另外检测不到 GPU 是因为登录的是管理节点 … 需要根据脚本设计成可以
条件 GPU 数量的方式提交任务". The archaeology (run against build
6de9523: A-phase 12/18 pins stale, B harness imports functions that no
longer exist anywhere in src, C3 honestly refused by the t536 movies
gate) settled every feature cluster:

| The suite pinned                                    | Verdict | Where it lives now |
|-----------------------------------------------------|---------|--------------------|
| envLines reach the job scripts (the load line works) | ALIVE   | both generated scripts carry the "# ---- connection environment lines ----" block (remote-run.ts sbatch + direct lanes); live-covered by t372/t382/t387, which dispatch real runs through envLines-carrying connections |
| GPU count + partition as per-submission directives   | ALIVE   | RemoteRunTarget.gpus/partition → buildSbatchScript --gres/--partition; covered by t387 (gpu-mrcs-integrity), t306 (array), t304 (sbatch directives + dependency) |
| .cf-exit contract + sacct terminal truth             | ALIVE   | t267/t268 (motioncorr slurm end-to-end), t417 (scancel → CANCELLED → exit 137 under project delete) |
| scancel stop path                                    | ALIVE   | t417-project-delete-reclaim.mjs |
| probe-side envLines module discovery + envLineModules badge (the "hidden module shows in the module list" door) | RETIRED | superseded by the t388 interactive-env snapshot lane: the login shell's own ritual (`module load`, conda, exports) is snapshotted per dispatch and merged onto the script's module block — the door moved from "probe lists what envLines load" to "the script inherits what the interactive shell holds" |
| parseSinfoPartitions + slurmPartitions probe DTO     | RETIRED | the probe still reads GPU inventory (gpusPerNode) in its own shape; the standalone partition parser was not survived by any refactor |
| C3 micrographs → motioncorr wiring                   | OBSOLETE | the stub-era shape is now honestly refused at dispatch (the t536 star-shape gate); the movies recipe lives in t268/t269 |
| source pins A5–A17 (grep spellings of the old generator/registry/dispatch) | STALE | the machinery evolved (t352/t367/t388/t397 refactors); the living contracts are pinned by the suites above |

The B-phase parse harness also depended on `bun run /tmp/t293-parse.ts`
importing `moduleLoadsInEnvLines`/`parseSinfoPartitions` from
`src/lib/remote/probe.ts` — both exports no longer exist anywhere in
src (verified by tree-wide grep), which alone made the suite
unrunnable.

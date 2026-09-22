# HPC sweep — cluster profile comparison

Generated 2026-09-14 20:04 UTC · CryoFlow queue simulation

2 of 2 profiles simulated on the same workflow graph. **Slurm H100 hub (2×8 GPU, burst queue)** wins with a 12m makespan — 37% faster than the slowest contestant (19m) — at a cost of 1.8 GPU-hours.

| # | Profile | GPU | Shape | Speedup | Status | Makespan | Utilization | Avg wait | GPU-hours |
|--:|---------|-----|-------|--------:|--------|---------:|------------:|---------:|----------:|
| 1 | Slurm GPU cluster (example: 4×A100 partition) | A100 | 4×4 | ×25 | ok | 19m | 46% | 1.0m | 2.3 |
| 2 | Slurm H100 hub (2×8 GPU, burst queue) | H100 | 2×8 | ×40 | ok | **12m** | 57% | 1.0m | 1.8 |

> GPU-hours ≈ cost proxy — the fastest cluster is not always the cheapest. The machine twin of this report is the CSV export (raw minutes, snake_case).

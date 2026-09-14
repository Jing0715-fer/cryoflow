# CryoFlow session QC report

Project **β-Galactosidase Tutorial (demo)** · 26 jobs — 16 succeeded · 1 running · 1 failed · 8 waiting.

## Pipeline at a glance

- **16** succeeded jobs feed this report's QC sections;
- **1** running · **1** failed — failures stay counted here, never dropped;
- **8** waiting (idle or submitted) — no verdict exists for work that has not run.

## Map QC

## Map QC summary — orthovol

Job `cmu140hdj000vq1dvsrt4eu6a` · mean-density landscape along **Z** (64 bins).

- **Peak** mean ρ at plane 48 (**76.2%** of depth) — where the specimen's mass concentrates on this axis
- **Trough** at plane 0 (0.0%)
- **Span** across planes: 0.0278 (max 0.0695, min 0.0417)

### Comparison maps (2)

| Map | Bins | Peak at | Agreement r | Verdict |
| --- | --- | --- | --- | --- |
| run_it020_half1 | 32 | 51.6% | -0.25 | diverges |
| run_it020_half2 | 32 | 77.4% | 0.99 | agrees |

Where a comparison line follows the main landscape, the density is consistent between maps; where it parts ways lives noise or masking. Agreement r is the Pearson correlation on the shared 0–100% fraction scale — each terrain self-scaled to its own map's stats (the shape is the signal, not absolute ρ).

### Pairwise agreement

| Map A | Map B | Agreement r | Verdict |
| --- | --- | --- | --- |
| run_it020_half1 | run_it020_half2 | -0.28 | diverges |

Two half-maps come from disjoint halves of the data — where they agree with EACH OTHER, the density is real (this is the question FSC asks). Maps that follow the main landscape but not each other deserve a second look.

_Exported from CryoFlow's slice instrument — the mean-density landscape is contour-independent and describes the whole map, not the current isosurface._

## Scheduling sweep

No sweep raced this session — open the HPC queue panel and run *Compare profiles*; the winner's verdict will be bound here verbatim.

_Bound from this session's live state — the pipeline glance, the map landscape and the sweep verdict each keep their own provenance. The filename carries the export stamp._
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
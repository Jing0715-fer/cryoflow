# t702 — the narrative census: a story may only tell what the world can prove, now enforced

Window 702 (2026-10-08, trace `1a07549302235a99-cron-agent-loop-202610081455`).
The QA-instrument candidate from Task 701's entry list: t701 legislated the
narrative law but left it without an enforcement instrument — and t699's own
lesson says a law without a re-runnable audit is folklore. This window closes
that gap: the census mechanically re-proves every claim the demo world's
narratives make, from the world's own evidence.

## The instrument

`scripts/t702-narrative-census.py` (read-only, re-runnable, world-riding —
it reads the actual logs on disk, not a copy of the patch's text). Three
layers, 158 assertions:

- **Layer A — the law's letter (shape).** For all 17 completed jobs: run.log
  on disk, ≤ 25 content lines (the AI tools' log-tail consumer window,
  `tools.ts` L2736), head-line echo fidelity — the text after the em-dash
  must equal the engine record's `result` field verbatim. The 14 t701
  narratives must keep the append-only shape: head + blank separator + the
  exact scripted count of `[seeded]` lines. The three canonical logs
  (t531/t696/t699 lineages) hold their line counts; topaztrain's CSV block
  must stay parseable (the t666 loader contract: 12 epochs, it=0..11, 5
  columns).
- **Layer B — the law's spirit (provenance).** Every number in every story
  re-read from the world's own artifacts: star row counts (10 / 170 / 240 /
  168×5), class distributions (96/240 = 40%, 72/240 = 30%, six minor
  classes), the defocus family's mechanical range, FSC anchors
  (`_rlnCurrentResolution` 3.62, `_rlnFinalResolution` 3.12, and
  3.62 − 3.12 = 0.50 — "0.50 A better than the raw refine" is arithmetic),
  the MRC header's own pixel (28.32 = 1.77 × 16, the binned micrograph
  scale the import story cites), the 40 FSC rows, the mask edge named by
  `postprocess.star`'s own `_rlnMaskName`. The engine argv defaults are
  proven at source level (engine.ts L6550-6555, L7054-7055). And every
  story's "downstream:" line is parsed for named consumers and compared
  **bidirectionally** against the DB's own Edge graph — no ghost consumers,
  no unclaimed targets; postprocess's "end of the chain" is proven by its
  zero outgoing edges.
- **Layer C — the idempotency witness.** The t701 patch re-runs inside the
  census: 14 skips, 0 enrichments — the world is stable under its own
  author.

## Four convictions, four adjudications

The census's first run ended 143/4. Each flag was adjudicated before any
code moved — the t697 lesson (fake negatives come from fake vocabularies)
applies to a census's own word list as much as to a UI probe:

1. **class3d downstream — census bug.** The world says "Symmetry-expand"
   (hyphenated); the census's consumer dictionary carried only
   "Symmetry expansion". Fix: both aliases map to `symexpand`.
2. **topaztrain head echo — the seed's dual voice.** The head carries the
   seed's short log voice ("…trained on the denoised stack (general-model
   flow)") while the record's `result` is the richer verdict ("12 epochs,
   best test loss 0.494 at epoch 9 · connect into Auto-picking"). Neither
   is drift — 16/17 heads echo their records; this one seed line chose the
   shorter form. The census now checks the head byte-stable AND proves the
   record's numbers from the CSV: row 9's test_loss is 0.494, the last
   it-row is 11 — the record's claims live in the artifact.
3. **import pixel 28.32 vs star 1.77 — two scales, one truth.** The star's
   optics row carries the detector scale (1.77 Å/px, equal to the DB
   import params); the MRC headers carry the micrograph scale
   (cella_x/nx = 28.320 = 1.77 × 16 exactly). The story's qualifier "at
   the micrograph scale" was already honest — the census just needed to
   read the right artifact (the MRC header, not the star row).
4. **the defocus family — a real world amendment.** The artifact proves
   the family spans [12722.7, 14850.9] Å — top **14.9k** — and carries an
   explicit `CtfAstigmatism` column (68.5–257.8 Å). The seed's arithmetic
   (qa-t531 L852) truncated the top to "14.6k", and the t701 narrative
   amplified it into "astigmatism free" — both under-provable by the law's
   standard. Fixed by `scripts/t702-defocus-verdict-patch.mjs`.

## The amendment: one fact, four layers, lockstep

The defocus fact lived in four layers chained by authorship: seed script →
engine-state record.result → the run.log head echo → the t701 narrative
(and the t701 patch script, the narrative's author). The head-echo contract
(run.log line 1 == "seeded by … — " + record.result) is a structural
invariant — patching the record alone would break it. So all four moved
together, in one idempotent patch (double-run verified: amend then
all-skip):

- "defocus family 14.6-12.7k Å" → "defocus family 14.9-12.7k Å" (seed,
  record, head echo)
- "defocus family 14.6k - 12.7k A … astigmatism free" → "defocus family
  14.9k - 12.7k A … astigmatism under 300 A" (narrative + its author)

This is an amendment, not a clobber: the head's structure, prefix and role
are untouched — only the false digit moves, and the echo contract never
breaks (the census asserts it before and after). The number in the census
is not a literal: it is recomputed from the artifact
(`round(max/1000, 1)`) and compared against what the story and the record
say — if the world's defocus data ever changes, the census convicts the
story mechanically, not by memorized constants.

## Verdict

- Census: **158 pass / 0 fail** (after adjudication and amendment).
- Verification net: t677 30/0 · t699 record census 17/17 full lives ·
  t695 strip-ui-wire 125/0 · qa-t531 `--check` CHECK PASS (the bed
  preflight carries no stale constant — next rotation will not false-alarm).
- Live: the amended ctffind narrative renders in the Log tab
  (`shots-qa/t702-ctffind-log-amended.png`) — head echo 14.9-12.7k, the
  argv line, the manifest, the downstream consumer, all present; console
  silent; browser closed after use.

## Lessons

- **A law's enforcement instrument finds its first violations in the law's
  own wording.** Three of four first-run flags were the census's vocabulary
  or its formalization, not the world. The sequence matters: adjudicate
  every flag before patching anything — a census that "fixes" the world to
  match its own fake word list would launder a bug into a verdict.
- **The seed's voice and the record's verdict are two voices, not one.**
  The head line is the log's anchor; the record's `result` is the
  job's verdict. They usually agree because the seed wrote them together —
  but agreement is a convention, not an identity. Where they diverge, the
  stronger check is not equality but provability: the record's numbers
  must live in an artifact.
- **"Astigmatism free" failed the law's letter, not its spirit.** The
  world's own column proves astigmatism 68.5–257.8 Å — small, but not
  free. The law's letter is about numbers; the fix was to write the
  number ("under 300 A") so the claim became mechanically checkable.
  Qualitative claims are loans against quantitative ones — the census
  calls the loan due.
- **The narrative layer is now the fourth layer with its own instrument**
  (artifacts: bed world-guard · records: t699 census · archive: t700
  audit · narrative: this census). Each layer's law arrived one window
  before its instrument; the pattern is now the convention.

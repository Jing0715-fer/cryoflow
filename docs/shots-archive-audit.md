# t700 — the shots-qa archive audit: 226 frames measured against their records

Window 700 (2026-10-08, trace `1a07549302235a99-cron-agent-loop-202610081419`).
The last unclaimed candidate of the legacy-audit series (t697 boilerplate
autopsy → t698 a11y census → t699 record census → **t700 archive audit**).

## The audit's shape

The archive (`shots-qa/`, 226 PNGs, ~41 MB, fully tracked) is HISTORY,
not state: a frame's world-picture is allowed to go stale (the world
moves), so staleness is not a defect. The true defects the audit hunts
are **corruption** (a .png that isn't a PNG) and **verdict-less
evidence** (a frame no record ever speaks of). Two record layers were
measured:

1. **worklog layer** — does `worklog.md` name the filename verbatim?
2. **commit layer** — does the frame's first-add commit message speak
   the task id or the filename stem? (The frames' verdicts often live
   in the commit that introduced them, per the split-car discipline.)

## Verdicts

| Layer | Result |
|---|---|
| Integrity | **226/226 real PNGs, 0 corrupt, 0 non-png files** — the archive's own claim (.png means PNG) holds everywhere |
| Attribution | 217 task-named (`t258..t699` — all inside the project's real task range), 6 `probe-*`, 3 `t402b-*` |
| Worklog alignment | **44/226** verbatim mentions |
| Commit alignment | **+157/182** orphans carry a verdict-bearing first-add commit |
| True orphans | **25/226 (11%)** — no verbatim worklog mention, no verdict-bearing commit |
| Age | first-adds back to **2026-09-16** (probe-*); archive spans the repo's full history |

Net: **201/226 (89%)** of the archive has a two-layer verdict record.
The 25 weak ones group into three families:

1. **Archive founders (6)** — `probe-a/b/d/e-*.png`, first-added
   2026-09-16 under a t260 commit. They predate the naming discipline;
   their verdicts were conversation, never written down. History's
   basement: left as-is, honestly labeled.
2. **UUID-titled commits (8)** — `t323-* ×4`, `t405-smoke-2`, `t426-drawer`
   and siblings were introduced by commits whose entire message is a UUID
   (`081cd39a-…`, `ff43d232-…-cron`, `3c7fd68c-…-cron`). **Verdict-less
   commits are a real era**: the split-car discipline (feat/qa/chore/docs
   with verdict-bearing messages) was adopted, not born. The gap is in
   the COMMIT layer, not the frames — retroactive repair is impossible
   (history is immutable), so this stands as the discipline's fossil
   record.
3. **Attribution drift (~11)** — frames named for task X committed under
   task X±1's verdict (`t397-*` under a `perf(t400)` message, `t410-*`
   under a `t377` message, `t542-*` under `t543`'s). The verdicts exist
   and are one hop away; only the filename↔task mapping is off. The
   neighbor's record covers the frame's reason to exist.

## Disposition: document, delete nothing

- Zero corruption → no frame is lost bytes; the 41 MB is all evidence.
- The 25 weak frames are history's shape (founders, the UUID era,
  neighbor commits), not rot — deleting them would burn evidence to
  tidy a scorecard.
- The convention that emerges (and that the current discipline already
  follows): **a frame's verdict must live in the worklog (verbatim
  filename) or in the committing message (task id)** — the audit's
  89% is that convention's retrospective scorecard, and future windows
  keep it at 100% by construction (worklog entries name their shots;
  qa/chore commits speak their tasks).

## The companion fix this window: the thumb codec vocabulary

The bed rotation (窗 5, 3-5 rhythm upper bound) surfaced it: family-run's
preflight flagged **OLD WORLD SICK** — `qa-t531-old-world-seed.mjs
--check` FAIL at "bookmark session: thumbs are honest data-URL PNGs".
Root cause chain:

- The app's bookmark save path (`molstar-embed.tsx` L1923) deliberately
  writes **JPEG** thumbs (`toDataURL("image/jpeg", 0.72)` — the in-code
  comment says "small JPEG thumbnail"; a size-conscious choice).
- The t668 check asserted `data:image/png;base64,` — **the probe's codec
  vocabulary was narrower than the app's real contract**.
- A human re-saved "Centered iso view" through the app this morning
  (05:20 +08, inside the orphan-browser window the t696 hygiene later
  killed): an honest 1.4 KB JPEG thumb landed, the png-only check broke.
- The last bed rotations bypassed family-run (the report had no recent
  keys), so the preflight — which lives in the runner — had been silent;
  this window ran the bed THROUGH family-run and the drift got caught
  exactly as designed.

The fix upgrades the assertion to be **stricter, not looser**: the
decoded payload must carry the magic bytes of the codec it declares
(PNG `89 50 4E 47`, JPEG `FF D8 FF`). "Honest thumb" now means "a real
raster whose bytes agree with its own Content-Type" — a data URL lying
about its own format is exactly the dishonesty the check exists to
catch. The world is right, the probe catches up, the law gets sharper.

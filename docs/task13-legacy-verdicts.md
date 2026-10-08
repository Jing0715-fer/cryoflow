# Task-13 Legacy Verdicts — the boilerplate's leftover claims, audited against today's source

**What this is.** Every dispatch window has carried the same boilerplate list of
"known leftovers" attributed to a Task-13-era code review: #5 fs/browse
unguarded, #6/#14 pathref-vs-star inclusion-policy divergence, #7 chart routes'
full synchronous reads on hot paths, #8 the particles BFS N+1, #13 a localStorage
write inside useMemo, plus two feature directions (a 3D-viewer volume-section
tool, a Topaz wrapper). Six hundred and eighty windows later, every one of these
claims is stale. This page is the extinction certificate — each verdict carries
its evidence lines so no future window needs to re-litigate, and the dispatch
boilerplate can finally be read as history instead of debt.

## The verdicts

**#5 — fs/browse unguarded: EXTINCT (closed in Task 251; re-verified t693/t694).**
The t693 door census swept all 88 API routes: 64 guarded with `isLocalRequest`,
every remaining route judged per the t259 world-shaping criterion. The chart
routes the boilerplate worried about all import the guard today
(`src/app/api/jobs/[id]/guinier/route.ts` L4, same in angdist/ctf/fsc/resolution).

**#6/#14 — pathref vs star inclusion-policy divergence: EXTINCT, with an in-source
tombstone.** Both outputs routes now run the SAME containment function —
`resolveInsideJobWorkdir` (`src/lib/relion/jobfile.ts`), called 4× in
`outputs/star/route.ts` and 4× in `outputs/file/route.ts`. The star route's
comment block states the unification explicitly: *"the single containment policy
for both outputs routes: lexical workdir scoping + realpath inside the app data
tree. The old realpath-inside-workdir rule rejected engine-created cross-job
symlinks; the file route's old lexical-only rule let planted links escape. Both
holes are closed."* The divergence the review saw is the very thing the unification
was built to kill.

**#7 — chart routes' full synchronous reads: EXTINCT, replaced by the statcache.**
`src/lib/chart-data.ts` wraps every hot-path read in `cachedFileCompute`
(14 call sites across loadFsc / loadGuinier / loadAngDist — the t486 trio),
keyed `(size, mtimeMs)` with an LRU cap (`src/lib/relion/statcache.ts` L51, L76,
plus the async twin). A header comment records the contract: *"cachedFileCompute
keys unchanged — the statcache hit rate survives the refactor untouched."* The
first read is synchronous; every subsequent read until the file's (size, mtime)
pair changes is a stat-check hit. The "hot path re-reads everything per request"
world no longer exists.

**#8 — particles BFS N+1: EXTINCT, with an in-source tombstone that names the crime.**
`src/app/api/jobs/[id]/particles/route.ts` L280-285: *"Batched BFS: ONE edge query
per depth level + ONE job query for all discovered ids. The old loop awaited
findEffectiveJob PER EDGE — 1–2 DB round-trips × every upstream job on each
ParticleBrowser open (the classic N+1)."* The BFS now queries `edge.findMany({
where: { toJobId: { in: frontier } } })` per depth and one `job.findMany({ where:
{ id: { in: discovered } } })` total; the per-node `getRun` is an in-memory
engine-state cache read, not a DB round-trip.

**#13 — localStorage write inside useMemo: EXTINCT, and the anti-pattern is
forbidden by design comment.** A same-line and 400-char multiline sweep over all
25 localStorage-bearing files finds ZERO `setItem`/`removeItem` inside any
useMemo body. Every persistence helper in `src/lib/store.ts` is intent-driven
(called from handlers, never render) with SSR guards (`typeof window ===
"undefined"`) and private-mode try/catch — and L228-230 states the doctrine
outright: *"Storage stays an echo of user intent, not of render state — a
hydration that merely READ the seed writes nothing back"* (Task 153). Whatever
the review once saw was either already the pre-153 shape or has since been
rebuilt into this one.

## The feature directions

**3D-viewer volume-section tool: BUILT — the family is larger than the request.**
`src/lib/mrc.ts` carries the full section arsenal: `readMrcSlice` (z), 
`readMrcOrthoSlice` (x/y tiles), `readMrcObliqueSlice` (t661's arbitrary-plane
cut), `readMrcSubvolume` (box crop — the sub-volume chain t694 gated), 
`readMrcAxisProfiles`, `readMrcVoxel`, `readMrcHistogram`. The file route serves
them live: this window's wire probes returned 200 PNGs for the z-slice (1949B),
x-ortho (1949B — byte-identical to the z-slice because the seeded phantom is an
isotropic Gaussian; the center x- and z-slices are the same picture), and the
oblique cut (3977B — genuinely different geometry), plus the voxel instrument
(`format=value` → `{value: 99.4, voxel: {x:32,y:32,z:32}}` — the phantom's peak
amplitude 100·exp(0) read back to three significant figures, a voxel-level
cross-verification of the t696 seed law) and the histogram instrument (262144 =
64³ finite voxels).

**Topaz wrapper: BUILT.** `topaztrain` and `topazdenoise` are first-class engine
types speaking topaz's CLI through the `relion_python_topaz` conda wrapper
(`engine.ts` L7196, L7284, L7342 — *"this job speaks topaz's CLI via the same
wrapper"*); both run in the seeded world and their designed-silent strips were
priced in the t692 census (A-class: the training curve and the denoise wall are
the faces that speak, not the key-numbers strip).

## What the extinction buys

The dispatch boilerplate's "已知遗留" list is now fully retired: every claim it
carried is either fixed (with in-source tombstones), re-audited into a different
verdict (t693/t694 doors), or built past (both feature directions). Future
windows should treat this page as the terminal state of that list — new needs
come from the live entry-list process (worklog per-window Stage Summaries), not
from a Task-13 snapshot.

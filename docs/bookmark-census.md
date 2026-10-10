# t704 — The Bookmark World Census

**Window**: cron 16:25 (+08), trace `1a07549302235a99-cron-agent-loop-202610081629`, Job 362852
**Instrument**: `scripts/t704-bookmark-census.py` (read-only, re-runnable, world-following)
**Verdict**: **44 pass / 0 fail** — the saved-state family is healthy end to end.

---

## 1. Why this census exists

Task 702's entry list named "bookmark 世界的普查" as the next free-lane candidate, and
Task 700 had already taught the thumbnail law (a data URL must prove its declared codec
by magic bytes) for ONE session — refine3d's, via the bed preflight. But a preflight
check is a door guard, not a census: it runs when the bed runs, sees only what the bed
touches, and answers only the question it was written to ask. The bookmark world as a
whole — storage, doors, consumers — had never been audited as a world.

The world is small (one row, three entries) and that is exactly why the census goes
deep: with the surface this narrow, every assertion can be per-entry, and the route's
own contractual claims — written in comments, never mechanically tested — can finally
be executed as code.

## 2. The world's shape

```
storage    BookmarkSession (jobId @unique, data = JSON entries)
           OverlaySession  (jobId @unique, data = JSON entries)   ← the twin
doors      GET/PUT /api/jobs/:id/camera-bookmarks   (strict whitelist owner)
           GET     /api/views/gallery               (read-only aggregate, MAX_JOBS=8)
           GET/PUT /api/jobs/:id/overlay-session    (the twin's door)
consumers  molstar-embed (dual mirror: localStorage + server row; server wins),
           project-dashboard Saved-views wall, command-palette jump surface
```

Today: 1 bookmark row (refine3d `cmuwipe635000refine3d`), 3 entries; 0 overlay rows.

## 3. Two sibling tables, two opposite contracts

The census's central design insight: `BookmarkSession` and `OverlaySession` are
siblings that carry **contradictory staleness contracts**, and both deserve the same
magnifier.

- **Bookmarks** hold *pure camera numbers* (position/up/target, σ, slice, clip). The
  route's comment claims: "a bookmark cannot go stale — the snapshot is pure camera
  numbers with no reference to files, so there is no self-heal pass here." That claim
  is now assertion **A4**: a mechanical scan of every stored string (outside the
  thumb's data URL) for file extensions, absolute-path shapes, and path-flavored key
  names. Zero violations — the anti-staleness contract is true because there is
  *nothing in the row that can rot*.
- **Overlays** hold *paths* (relative to the job workdir) — the exact property that
  makes bookmarks safe is the property that makes overlays perishable. Their contract
  is the opposite: paths are re-validated against the job's live mrc outputs on every
  restore, and the restore filter drops what no longer exists (healing both the
  localStorage mirror and the server row). Assertion **D4** replicates that filter's
  necessary condition (entry.path ∈ live mrc listing) and measures the staleness debt
  a row carries between visits. Today the table is empty — the instrument arrived
  before the first entry (the legislative form of the t699 lesson: enforcement
  instruments should exist before there is anything to enforce against).

A4 and D4 are the same question asked in mirror image: *can this row lie about the
world?* Bookmarks answer "it has nothing to say about the world"; overlays answer
"it must re-prove itself every visit."

## 4. The layers

**A. Storage truth.** Row→job FK live (LEFT JOIN, not trusted to the FK's cascade);
entry shape (id ≤64, name nonempty, ts finite); the pose is three finite vec3s within
the door's 1e9 clamps; view state shape (σ∈[0.01,100], sign∈{−1,1}, slice axis∈XYZ,
clip box∈[0,1]³, t279 focus∈[0,1]³); **thumbnail codec honesty** (declared png|jpeg,
magic bytes `89504e47`/`ffd8ff` prove it, IHDR/SOF parse to real pixel dims: 112×59
JPEG for the human-saved view, 8×8 PNG for the two seed stubs); caps (≤8 entries,
≤48k thumb chars); **write-after-claim invariant**: max(entry.ts) ≤ row.updatedAt +
61s — a row cannot have been written before its newest entry claims to exist.

**B. Door replay.** The route's own `sanitize()` ported to Python and replayed
against the stored row: `stored == sanitize(stored)` — the row passes its own door
**byte-equal, no silent shrink** (a row that would drop entries through its own GET
is the t702 two-voice pattern: DB says one thing, the API another). Then the live
GETs must agree: `/api/jobs/:id/camera-bookmarks` equals the replay; the gallery
aggregate includes exactly one card for the job with id/name/ts/thumb equal.

**C. Contract echoes.** The whitelist's numbers (8, 48_000, png|jpeg) asserted
against storage, not just enforced at the door.

**D. Overlay sibling.** FK, shape, caps, path resolution against the live outputs
listing, door replay, live GET — armed on an empty table.

## 5. The first run's two flags — both the probe's own disease

First run: **41 pass / 2 fail**. Both failures were seedview2/seedview3 "thumb codec
honesty — declared png, magic 89504e". The world was innocent: the payload's real
magic is the full four-byte `89 50 4E 47`, and the census's own dimension parser
(`png_dims`) had *just proven the payload is a valid PNG* (it returned 8×8 px) in the
very next assertion. The probe compared `payload[:3] == b"\x89PNG"` — three bytes
against a four-byte constant, a comparison that can never be true. JPEG passed only
because `ffd8ff` happens to be three bytes.

Verdict: **probe self-disease, world untouched** (the t702 pattern — a census that
"fixed" the world to match its own false vocabulary would have laundered a bug into a
judgment). Fix: `payload[:len(magic)] == magic`. Re-run: 44/0.

The meta-lesson is worth pricing: **the codec-honesty law's own enforcer must get the
magic right**. t700 wrote the law in JavaScript (`payload.slice(0,3)` against a
3-byte JPEG magic — correct for JPEG by luck); t704 ported it to Python and kept the
3-byte slice against a 4-byte constant — broken for PNG by the same luck, mirrored.
A law that travels between languages re-earns its correctness byte by byte.

## 6. The updatedAt drift — measured, explained, not condemned

The row's `updatedAt` is 2026-10-08T00:49:32.570Z, but the newest entry's ts is
2026-10-07T21:20:14.286Z — the row was written ~3.5 h after its newest entry claims
to have been saved. The app explains it without any corruption: overwrite-in-place
bumps ts (molstar-embed L2007), but **rename commits the list with ts preserved**
(L2027), and an add-then-delete pair leaves the surviving list intact while bumping
the row. Both are benign ts-preserving paths. The invariant that actually matters
mechanically — entries cannot be newer than the write that carried them — is
assertion A5, and it holds with slack. The census measures the invariant, not the
biography.

## 7. Live verification (agent-browser, t695 protocol)

- **Dashboard wall**: region "Saved 3D views across all projects" renders 3 cards —
  each with the view name, optical chips (σ 2.00/2.50, `slice Z`, `clip`), job +
  project names, and rename/delete buttons with full reachable names.
- **Server-fed menu**: in a browser with empty localStorage, the Mol* viewer's
  bookmark panel still shows "Camera view bookmarks — 3 saved" with all three
  entries and their dates — the cross-device contract ("server list wins") observed
  live from the storage layer through to the pixels.
- **Restore flight**: clicking "Centered iso view" flew the camera — the orange
  isosurface sits centered in the viewport; the t279 focus chip renders `50%/50%/50%`;
  seedview1's real JPEG thumbnail (the little orange ball photo) renders beside the
  two 8×8 seed stubs (honest gray). Console: only molstar debug lines
  (`map fetched 1049600 → state committed → ready`), zero errors.
- Screenshot: `shots-qa/t704-bookmark-restore.png`.

## 8. Regression

Product code untouched this window (census + docs only). t677 30/0 · t699 record
census 17/17 complete lives (0 incomplete; 20 inert fossils unchanged) · t702
narrative census 158/0 · t695 strip-ui-wire 125/0. Zero builds, zero restarts;
browser closed after use.

## 9. Lessons

1. **"Two sibling tables deserve one census when their contracts are opposites."**
   Bookmarks and overlays solve the same problem (a session that follows the job
   across devices) with opposite physics — one refuses references, the other re-proves
   them. Auditing them separately would have hidden the design symmetry; auditing them
   together turns A4/D4 into mirror assertions that test the *design*, not just the data.
2. **"The enforcer must re-earn the law byte by byte when the law changes languages."**
   The codec-honesty check survived one port (JS check → bed preflight) and broke on
   the second (JS → Python) — not because the law was wrong but because the magic's
   byte-length rode along unexamined. A comparison that *can never fire* is worse than
   no comparison: it masquerades as coverage until the day a real lie walks past it.
   The re-run's 44/0 is therefore worth exactly as much as the fixed comparison is
   true — which the dims-parse assertion (independent evidence the payload IS a PNG)
   is what made the misdiagnosis impossible to miss.
3. **"The instrument arrives before the first entry."** The overlay half of the census
   audits an empty table. That is not waste; it is the legislative form of the t699
   lesson (laws arrive one window before their enforcement instruments — this time the
   instrument is early instead of late). The first Layers-panel save in this app's
   future will be born audited.
4. **"Measure the invariant, not the biography."** The updatedAt drift looks like a
   finding until the app's own paths explain it. A census that asserted
   `updatedAt ≈ max(ts)` would flag every rename; asserting `max(ts) ≤ updatedAt + 61s`
   (the write-after-claim invariant, tightened by the door's own future clamp) flags
   only the impossible. Choosing which inequality to enforce *is* the audit's judgment.

## 10. Next-window entries

1. **Build-day batch (six-window account, list unchanged)**: t692 B-class six sites +
   t609 full-revival trio + t693 three-door GET gate + t694 ten-file write gate +
   seed-gap adjacent-tolerance candidates (refine3d `run_itNNN_data.star`) + a11y
   optional strengthening line (palette explicit aria-label) + **t703 resolver fix's
   rebuild + t260 re-run** + verification net.
2. **Non-build day**: saved-state family census is done — free lane (next candidates:
   cost/compute dashboard surface, run-history timeline view — new UI territory, or
   the gallery route's own census is now cheap to add as a t704 spin-off if the wall
   grows).
3. **Bed rotation**: t703 ran window 3; next window 4 — family-run standard gate,
   preflight verified non-false-alarming.
4. **Census family rotation**: t699/t702 after any world surgery; t704 after any
   bookmark/overlay door or seed change (the preflight's thumb check now has a
   full-world sibling to cross-reference).

## t706 addendum — the wall grows across jobs (the census scales with it)

The t705-era world carried one row (refine3d, 3 canonical entries). t706 grew
the wall across the job boundary: a second BookmarkSession row now lives on
the MaskCreate job (cmututold00000maskcreate, 1 entry "t706 aux-band mask",
cloned from the seeder's t668 entry shape — honest camera numbers, thumbless
by design, the wall renders the Mountain placeholder). The gallery aggregate
spoke for the first time with real multi-job data: 2 jobs, 4 entries.

The census was not edited — it SCALED: 43 assertions on the one-row world
became 59 on the two-row world (door replay, sanitize passthrough, gallery
inclusion and contract echoes all re-exercised on the second row), 59/0.
The write rode the per-job PUT door (the qa57 precedent — the same contract
the molstar-embed's saveBookmark speaks server-side); the Mol* relay chain
(node → inspector → Results → tile → enlarge → View in 3D → viewer) proved
flaky under the window's browser session and remains the honest full-drive
path for a calmer window. The overlay twin (D0) stays at 0 rows — the first
Layers-panel entry is still unborn, and the instrument is still waiting.

## t707 addendum — the calm window delivers: D0 born, the full drive clean, the door's last gap priced

The calmer window arrived and the Mol* full-drive relay ran clean end to end:
node → inspector → Results → tile (Enlarge run_it020_half1) → View in 3D →
viewer ready. Two firsts landed through the UI alone:

1. **The overlay twin's first row (D0 0 → 1).** The Layers panel offered
   orthovol + run_it020_half2; half2 went on (cyan, α 0.55), the σ-nudge
   slider walked +0.15 with keyboard arrows, and the debounced PUT spoke the
   merge contract. Both mirrors verified byte-identical (localStorage key
   `cryoflow.mol-overlays:*` and the server row). The client plumbing that
   t-dates built was exercised by a human-shaped drive for the first time —
   add → live edit → persist all worked first try.
2. **The first UI-driven bookmark save.** The popover's name field took
   "t707 UI-driven save"; refine3d's row went 3 → 4 (seeder's three +
   this one). Every prior row was API-staged; this one was born from the
   same mouth a user speaks.

The census scaled again without edits: 59 → **76/0** — Layer D armed on the
new row (D0 world measure, D1 FK, D3 cap, D4 live-outputs resolution
"self-heal debt: none", D2 shape, D5 sanitize replay, D6 live GET echo)
plus the B-layer growth from the fifth bookmark entry.

**D4's first execution caught a latent instrument gap.** With zero overlay
rows the D-layer never fetched anything; the first row made D4 hit
`/api/jobs/:id/outputs` — a t251-hardened route that rejects headerless
curl-style clients — and the census (a headerless urllib client) got 403.
The product door was RIGHT; the instrument learned to speak it: `fetch_json`
now sends `Origin: ${BASE}` (the guard's own documented cure). The gap was
invisible for exactly as long as the world was too small to reach it — the
same shape as the t25 rotation's latent pins.

**The saved-state door (staged, pending the next build day).** The full-API
audit found the saved-state pair (camera-bookmarks, overlay-session) was the
only jobs/[id] family without the t251 isLocalRequest gate. Both routes'
GET/PUT now carry the door — staged in source; the running server is the
frozen production bundle, so activation joins the next build-day batch with
its own curl verdict (bare 403 / Origin 200 × both routes). The threat model
is stated honestly in the routes: cross-origin PUT already needs a CORS
preflight a drive-by page cannot pass; the door's added value is closing
no-cors GET blind probing and making the job surface's policy uniform —
one door, every handler.

**The audit's larger territory (priced, next round).** The same sweep found
22 routes across the whole API without the door: ~10 drive-by-reachable
writers (workflow-import, pipeline-template, jobs POST, project POST, edges
POST/DELETE-adjacent, subvolume-job, layout, workspaces, custom-template
CRUD, hpc/simulate) and the blind-probeable GET readers (activity, command,
rebalance, views/gallery, api root, providers/health, judge-worker,
hpc/sbatch). That is the next hardening round's full ledger — the t251
family closure's honest completion, one build-day batch wide.

**The QA lane is forward-compatible.** Twelve probe scripts that touch the
two saved-state routes (t200/201/203-shots, t200-e2e, t208, t280, t674,
t675, t676 + curl-based qa45/54/57) now speak the door's language before
the door is even live: a shared `scripts/lib/qa-origin.mjs` shim (one
installOriginDoor() line per script) threads Origin through every Node
fetch, and the curl shells carry `-H "Origin: ${B}"` (qa45 hardcodes its
base — it has no B constant). Harmless against today's unguarded bundle,
required against tomorrow's — the same both-worlds property the census's
fetch_json fix has.

## t708 addendum — the writers batch: the ledger executes, the t252 doctrine retires half-true

The 22-route audit ledger's first half EXECUTED this window: all thirteen
write routes — workflow-import, pipeline-template, jobs POST, project POST,
edges POST/DELETE, jobs/[id] PATCH/DELETE (a ledger miss the per-file
sweep caught: "jobs POST" was listed, the [id] write pair wasn't),
subvolume-job, jobs/layout, workspaces POST/PATCH/DELETE,
custom-template's four mutating handlers, hpc/simulate — now carry the
isLocalRequest door on every POST/PUT/PATCH/DELETE handler (17 handlers,
13 files). Staged with the rest of the build-day batch; the running
bundle is untouched.

**The discovery that made the batch urgent: the t252 doctrine retired
half-true.** Class 2 claimed JSON-body routes self-defend because a
no-cors fetch "cannot send JSON". Half true: no-cors cannot send
*application/json*, but text/plain IS CORS-safelisted and a string body
may contain valid JSON — and `request.json()` reads bodies, not content
types. A bare cross-site POST could carry a full payload to any JSON
route (creating jobs, edges, workspaces, driving the subvolume send's
whole geometry contract). The door is the real closure; the strict
parses stay as the second layer (they still kill the urlencoded form
shape). Class 3 (PUT/PATCH/DELETE method immunity) survives review
intact — those handlers are doored for policy uniformity, not necessity.
t252's header comment carries the correction; its new Phase B2 fires a
headerless JSON write and asserts it dies (403 when the door is live;
201 + self-cleanup through the same bare channel on a stale bundle —
the hole demonstrated and healed in one probe).

**The QA lane learned the language before the door exists** (the t707
both-worlds doctrine, second verse, 21 files): the shared
`qa-origin.mjs` shim installed in every suite with bare node-level
write-calls (t256-t260's canvas cluster, the remote family's mkJob/mkEdge
helpers t262-t272, t296/t298, world-hygiene's janitor PATCH/DELETEs,
qa61/qa64/qa77) — one import + one call each, harmless today, required
tomorrow. t255's self-defense ledger now LAYERS: drive-by shapes stay
bare and accept either verdict (403 door / 400 body-parse), while the
contract probes (traversal, non-MRC, degenerate, missing job) speak
same-origin metadata so route-speak stays exactly assertable in both
worlds. t251/t252 deliberately stay raw — the doors' own tests must
speak headerless to prove the door.

**The sweep (scripts/t708-writers-sweep.sh) is the activation verdict,
pre-written.** Stateless probes only (invalid bodies, fake ids — zero
state change in either world). Today's doorless bundle: every probe
answers route-speak, bare and Origin columns identical, zero 403. After
the build-day build: the bare column flips to 403 (door speaks first),
the Origin column keeps route-speak. The flip IS the verdict; no
judgment calls on activation day.

## t709 addendum — the readers batch closes the ledger; the census prices its own blast radius

The 22-route ledger's second half EXECUTED this window: the nine pure-read
routes — activity ×2, judge-worker, providers/health, hpc/sbatch/[id], the
jobs/[id]/command and rebalance previews, views/gallery, the api root — now
carry the isLocalRequest door (staged like every batch before; the running
bundle answers 200 in both header columns, the bare-column flip is the
activation verdict). Two of the nine carry REAL execution stakes, not just
uniformity: judge-worker's GET is a defensive mount (a blind probe would
spin up the worker), and providers/health's `?refresh=1` would fire a full
probe volley from a page that never sees a byte of the answer — the route's
own t474-era "unguarded on secrecy grounds" comment is retired there, with
the t472 secret law (never name a key) untouched.

**The window's own instrument outran the ledger.** Building the door census
(`scripts/t709-door-coverage.py`, whole-API sweep: every exported handler
must call the guard in its own body) found 7 doorless handlers BEYOND the
nine — and one of them falsified a staged claim: jobs/restore POST, a
write, whose guard was IMPORTED at t477 but whose CALL was lost in the
restore-core extraction; the route's own comment said "This handler is the
door" while the body opened with the body-parse. That is the t252 lesson's
mirror: a half-true doctrine, now a half-installed gate — the doc claimed
it, the code forgot it, and only a mechanical sweep could see the gap.
Fixed in-batch (the t708 jobs/[id] precedent). The ai/settings GET — on no
ledger at all — joined the batch for free: its only QA touchers
(t574/t605/t606) already speak Origin, so its door costs the lane nothing.

**The census also priced the batch's STOP.** The other five finds are the
collection read-halves (jobs, edges, project, workspaces, custom-template
GET) — and their touch surface is ~300 bare scripts, the QA lane's hottest
route among them. Gating them in this window would have bought one line of
uniformity at the price of a mass breakage on activation day; so they are
DEFERRED, priced in their own route comments and exempted in the census's
EXPECTED_DOORLESS ledger (the sweep fails on any doorless handler OUTSIDE
that list — the deferral is a contract, not an omission). The read-halves
batch lands as a build-day-prep round fronted by a mass Origin-shim
patcher, the t708-patch-qa-origin2.py pattern scaled to the hot path.

**QA lane, forward-compatible (9 files).** The audit's real fetchers to
the eleven doored routes, all now speaking the door's language: t181
(activity/recent bare fetches), t184 (sbatch dry-run), t680 (judge-worker
status), t170 (command preview via headerless curl), t636-keepalive-probe
(raw socket — the Origin line rides the HTTP/1.1 bytes the guard's doc
prescribes), and FOUR t707-lane gaps the audit caught early: t671, t673,
t679, t669 fetch camera-bookmarks (and gallery) bare — red on the
saved-state door's activation day had the sweep not run this window. The
false-positive tax of the word-list audit ("command" the palette, t474 the
source-level import, qa42/qa45 the browser mocks) was paid in eyeballs and
kept the shim list honest: nine files, each verified.

Staged-world snapshot (honest): all eleven routes answer 200 bare and
Origin alike; jobs/restore answers 405 to GET (method-speak). On
activation day the bare column flips to 403 across all eleven — the
pre-written verdict, no judgment calls.

## t710 附记 — the read-halves close, the world resets, the census follows

The t709 deferral contract executed in full: the mass Origin shim
(289 .mjs + 6 .sh, installed by scripts/t710-mass-origin-shim.py after
the touchers census certified the active bare count at zero) landed
first, then the five collection GET doors (staged), and the census's
EXPECTED_DOORLESS list is now an empty set — t709-door-coverage.py
reports 112/112 handlers doored, 0 deferred.

World event: this window's qa-family rotation re-proved the t705
layering law — qa57's closing cleanup wiped the wall's refine3d session
(putBm([]) is per-session; the t706 cross-job row on the MaskCreate job
SURVIVED it, as did the D0 overlay row). The ritual ran as documented:
seeder re-run (CHECK PASS, 3 canonical views back) → t701 L1 narrative
patch → censuses re-run. t704 now audits 4 entries / 2 rows at 65/0 —
the 76→65 delta is the t707 UI-driven save row the wipe took; the
census's expectations export from the world (t706 law), so 65/0 is as
green as 76/0 was. The UI-driven growth rows are re-growable on a quiet
window; the D0 overlay layer never lost its armed state.

# The Storage Contract

*Task 688 — the family audit the ledger asked for ("值得，等稳定夜+文档窗" —
the stable night arrived, the build day did not; a contract costs no bytes
of heap). One page for every key the app will ever write: what the family
already agrees on, which dialects are legal, and which inconsistencies are
pardoned rather than paid for.*

## The first law: storage is a letter to a future reader

Every key here is read by a session that did not write it — next Tuesday's
tab, a colleague's browser, a future migration. The letter's schema must
distinguish **empty** from **absent** (the two-door law: a deselected job
writes `""`, a cleared trail writes `"[]"` — "the user explicitly did this"
is a fact; a missing key is a different fact; conflating them turns "you
cleared it" into "you never looked").

## The allocation law: the medium is the shadow of the semantics

| Medium | Meaning | Members |
|---|---|---|
| `sessionStorage` | tab-private, or a one-shot envelope; closing the tab burns it | `viewportMemory.v1`, `tabId.v1`, `pending-view` |
| `localStorage` | cross-session state the workspace shares | everything else |

The `subtreeOrch` precedent (t451) is the law in motion: when the record's
semantics changed (one tab's private memory → the workspace's shared
memory) it moved house — sessionStorage → localStorage — **and** bumped its
version. A medium change without a version bump would let old readers
mis-read new shapes; the bump is the notice.

## The naming law: prefix, dots for the static, colons for the dynamic, versions for the schema

1. **Prefix** — every key starts `cryoflow.` (the one namespace we own).
2. **Static segments** are dot-separated camelCase: `cryoflow.assistant.geometry.v1`.
3. **Dynamic boundaries** (per-entity key spaces that cannot be enumerated
   ahead of time) use a colon before the id: `cryoflow.fsc-compare:{projectId}`,
   `cryoflow:import-sample:{jobId}`.
4. **Version suffixes are schema generations, not decorations.** A `.vN`
   means "this shape changed under the same name at least once"
   (`viewportBookmarks.v2`, `subtreeOrch.v2`). A simple scalar contract
   (`knock.sound`'s `"1"/"0"`, `remote.active`'s id) needs no version —
   adding one would be a ritual, not information. When such a shape ever
   breaks compatibly, that is the day it earns a `.v2`.

**The grandfather clause:** three keys predate the law and use hyphens
(`cryoflow-fav-types`, `cryoflow-recent-types`, `cryoflow-eta-baselines`).
Renaming them today costs every user their saved preferences and buys only
tidiness. **Pardoned — the naming law binds new keys; old keys migrate when
their schema changes anyway** (read old → write new → sweep old, the
`subtreeOrch` move). The same pardon covers the mixed static-separator
dialects (`cryoflow:projects-sort`, `cryoflow:template-presets:last` — new
keys use dots).

## The corruption law: honest unknown falls back, never gets policed

No key trusts the shape it reads. Every family member picks one of five
dialects of the same law — *the safe default, not a repair*:

| Dialect | Members | Behavior |
|---|---|---|
| Shape-check whitelist, DROP | `viewportMemory`, `recentJobs`, `fav-types` | parse + verify every field (finite numbers, string arrays, cap); anything malformed drops silently |
| JSON.parse → clean start | `fsc-compare:*` | corrupted state starts clean ("start clean" — a fresh Set, not an empty UI lie) |
| Value whitelist | `classGallerySort.v1`, `leftRailTab.v1`, `panelTab.v1` | exact-string match or fall to the default |
| Tolerant scalar | `import-sample:*` | `parseInt ?? 0` — a NaN reads as "never rerolled" |
| Raw string | `selectedJob.v1`, `activeWorkspace.v1`, `knock.sound`, `tabId.v1` | no parse, no corruption surface; the reader compares the raw value |

What is **forbidden** everywhere: catching a parse error and *continuing
with partially-trusted data*. A shape that half-matches is a shape that
lies with confidence.

## The write-timing law: echoes follow actions, not renders

Writes happen in **event handlers and store actions** — the chevron's
synchronous click write, `noteRecentJob`'s echo, the ETA baseline's
explicit effect call (whose own comment says "WRITES localStorage — must be
called from an effect"). A write inside a render path or a `useMemo` is
violation #13, the family's one prosecuted crime. Corollary: every
**hydrate** is idempotent and post-mount (SSR-safe initial values, the
storage read is a seed that live state outranks — an in-memory trail is
never overwritten by a stale disk).

## The migration precedent (the only sanctioned upgrade path)

`viewportBookmarks` v1→v2 and `subtreeOrch` v1→v2 both did it the same way:
**read the old key, shape-check, seat the data into the new shape, persist
to the new key, remove the old key — once, at boot, idempotently.** The v1
key afterwards is a fossil with no readers. A version bump without a
sweep is an orphan-making machine; a sweep without a shape-check migrates
garbage with a stamp on it.

## The envelope dialect (the one one-shot pattern)

`cryoflow:pending-view` (sessionStorage) is a **letter between views**, not
state: written on click, consumed once by the landing view, overwritten by
any fresh intent, silently stale if never consumed. Envelopes are exempt
from the two-door law (their absence means exactly "no pending intent") —
but only envelopes: the exemption does not generalize.

## The family, as of Task 688

| Key | Medium | Shape | Version | Writer's law |
|---|---|---|---|---|
| `cryoflow.viewportMemory.v1` | session | JSON map | v1 | shape-check DROP; debounced trailing writes |
| `cryoflow.viewportBookmarks.v2` | local | JSON map | v2 | shape-check + v1 sweep at boot |
| `cryoflow.kpiCollapsed.v1` | local | `"true"/"false"` | v1 | raw string; event-handler write |
| `cryoflow.selectedJob.v1` | local | id or `""` | v1 | two doors: deselect writes `""` |
| `cryoflow.recentJobs.v1` | local | JSON array cap 6 | v1 | whitelist DROP; clear writes `"[]"`; echo in action |
| `cryoflow.activeWorkspace.v1` | local | id | v1 | raw string |
| `cryoflow.tabId.v1` | session | id | v1 | raw string; per-tab identity |
| `cryoflow.subtreeOrch.v2` | local | JSON | v2 | + v1 legacy sweep (t451 medium move) |
| `cryoflow.knock.sound` | local | `"1"/"0"` | — | scalar; no version needed |
| `cryoflow.remote.active` | local | id | — | scalar; survives reloads by design |
| `cryoflow.leftRailTab.v1` | local | tab id | v1 | value whitelist |
| `cryoflow.panelTab.v1` | local | tab id | v1 | trim + whitelist |
| `cryoflow.assistant.geometry.v1` | local | JSON | v1 | shape-checked geometry |
| `cryoflow.classGallerySort.v1` | local | enum string | v1 | value whitelist |
| `cryoflow.recent-types` | local | JSON array | — | grandfathered hyphen; whitelist DROP |
| `cryoflow-fav-types` | local | JSON array | — | grandfathered hyphen; whitelist DROP |
| `cryoflow-eta-baselines` | local | JSON map | — | grandfathered hyphen; effect-write + prune |
| `cryoflow:projects-sort` | local | enum string | — | grandfathered separator |
| `cryoflow:template-presets:last` | local | JSON | — | grandfathered separator |
| `cryoflow:import-sample:{jobId}` | local | int | — | per-entity colon; parseInt tolerant |
| `cryoflow.fsc-compare:{projectId}` | local | JSON array | — | per-entity colon; parse → clean start; known-id join |
| `cryoflow:pending-view` | session | JSON envelope | — | one-shot handoff; fresh intent overwrites stale |

## Verdicts on the inconsistencies found

- **Hyphen dialect (3 keys), mixed separators (2 keys), versionless scalars
  (2 keys): pardoned.** The cost is one-time data loss for every existing
  user; the benefit is aesthetic. Migration happens on schema change, when
  the sweep is free.
- **The `kpiCollapsed` / `selectedJob` / `knock.sound` raw-string dialect
  vs the JSON dialect: legal.** A boolean and an id don't need a parser;
  giving them one adds a corruption surface instead of removing one.
- **The per-entity colon family (3 keys): a functional dialect, not an
  accident.** Bound the id with a colon, prefix with dots, and the
  `localStorage` panel stays greppable per entity.
- **Nothing to fix this audit.** The family already agrees on every law
  that protects a reader; the inconsistencies are all in the cosmetic tier,
  and the grandfather clause prices them exactly right: zero.

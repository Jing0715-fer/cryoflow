# Write-Door Verdicts — the 13 candidates, judged per route

**What this is.** Task 693's proactive door census found 24 unguarded routes: 3 GET
findings (workdir-derived reads — already priced into the build-day batch) and 13
write candidates left as CANDIDATE, not findings, because t259's criterion must pass
over each route individually. This document IS that pass — the pre-review so the
build-day batch executes mechanically: every route below has a verdict, a threat-model
sentence, and (where gated) the symmetry anchor that convicts it.

**The criterion** (t259 threat model, restated in t693): a route earns the door when
it *shapes the world* — mutes rows, spawns or kills compute, rewrites a registry that
steers future behavior — *and* its payload rides a JSON body (the blind-write surface:
a cross-site `fetch` in `no-cors` mode can deliver valid JSON as `text/plain`;
`request.json()` never looks at Content-Type — proven empirically in t259 C2, where
the attack landed in the profiles registry before the gate existed). Low-stakes or
read-shaped routes stay bare: **a gate on a cosmetic route is ritual, not defense.**
Tiebreaker: sibling asymmetry — the same power already gated in a brother route.

**Verdicts: 10 files gated, 3 exempt.** Gate shape = `isLocalRequest` from
`lib/http-guard`, one guard line per handler, uniform across the file (the gated
family's pattern — no mixed files).

## GATE (build-day batch, one line each + threat-model comment)

1. **`api/jobs/[id]` PATCH+DELETE** — the sharpest asymmetry in the census: DELETE
   is a *superset* of the already-gated `jobs/[id]/stop` (it calls `remoteStopRun` +
   `stopRun`, then cascades rows, edges, and the run record). Killing compute is
   gated; killing compute *and erasing the job* is not. PATCH carries params and
   `status:"idle"` resets. Anchor: `jobs/[id]/stop` + `jobs/deleted/restore` both gated.
2. **`api/edges` POST (+GET rides)** — a blind wire is a *compute start through the
   side door*: edge completed→pending gets consumed by the t324 pending-retry cadence
   (~20 s) and auto-starts downstream — the gated `run` route's power, one hop removed.
   The cycle guard protects integrity, not authorization.
3. **`api/edges/[id]` DELETE** — silently unwires a pipeline (no data loss, but
   downstream consumers and auto-start topology change invisibly). Twin of #2.
4. **`api/workspaces` POST (+GET rides)** — creates world structure; sibling
   `api/projects` POST gated in t259. The 64:24 census asymmetry's cleanest exhibit.
5. **`api/workspaces/[id]` PATCH+DELETE** — rename + delete-with-job-relocation:
   reorganizes every canvas row in one blind write. Anchor: `projects/[id]`
   PATCH/DELETE gated; the workspace twin never got the line.
6. **`api/custom-template` all verbs** — shelf CRUD + the apply leg (PUT mints fresh
   jobs+edges into a workspace, same class as pipeline-template). A blind shelf write
   corrupts what one click later instantiates. Registry-write class (t259 profiles).
7. **`api/workflow-import` POST** — mints ≤500 jobs + edges, all-or-nothing. World-
   shaping import; the t693 classification stands.
8. **`api/pipeline-template` POST** — stamps the 10-job canonical chain. Same class
   as #7; gate them together or the door is a sieve.
9. **`api/jobs` POST (+GET rides)** — the single-job primitive the two batch writers
   above compose. Schema-sanitized params (no interpreter vector), but blind row
   planting is world-shaping-lite; gate for consistency with its own batch siblings.
10. **`api/jobs/[id]/outputs/subvolume-job` POST** — materializes a `.mrc` into the
    job workdir (`mkdirSync`+`writeFileSync`) and mints an Import job. **Its in-file
    ledger is half false** (see below) — the gate closes the leg the comment believes
    is already closed.

### The false ledger (found by this pre-review — fix the comment when gating)

`subvolume-job/route.ts` claims: *"a cross-site HTML form (urlencoded only) and a
no-cors fetch cannot reach state: request.json() throws and the route 400s."* The
form leg is true (urlencoded can't be valid JSON — t252 doctrine). The no-cors leg is
**refuted by the family's own t259 C2 record**: `no-cors` fetch sends valid JSON as
`text/plain`, `request.json()` ignores Content-Type, and pre-gate the attack
*wrote the profiles registry* ("2 saved" — t261's entry). The strict parse kills the
form carrier only. This is the t689 class in miniature: a comment asserting safety
that the threat model refutes — an "honestly absent door" ledger entry for a door the
route does not actually have. Fix wording to: strict parse stops the *form* carrier;
the no-cors blind write stops at the gate (once installed).

## EXEMPT (with in-file pricing comments so the next census doesn't re-flag)

1. **`api/project` POST** — a GET synonym by its own docstring ("kept for symmetry
   with older clients"): consumes no body, mutates nothing. The verb table said
   candidate; the semantics say read. Poster child for *the criterion weighs
   semantics, not verbs*.
2. **`api/hpc/simulate` POST** — pure calculator: reads jobs/edges/runs, returns a
   queue plan. Zero persist/create/update/write calls (verified by grep). Body params
   are number-clamped. Nothing to blind-write.
3. **`api/jobs/layout` POST** — moves x/y only, sanitized to finite numbers, scoped
   to the active project. Blind write scrambles card positions — annoyance, not
   damage; reversible by drag. Gate = ritual.

## Gate-ripple map (build day executes the full t259 procedure)

Probe-script hit counts (rg over `scripts/`, GET+write mixed — the *write* subset is
what breaks): `api/edges` ~143 files, `api/workspaces` ~51, `api/custom-template` 14,
`api/hpc/simulate` 6 (exempt — no ripple), `subvolume-job` 7, `api/jobs/layout` 2
(exempt), `api/workflow-import` 2, `api/pipeline-template` 1. Method unchanged from
t259: route-speak for the UI (same-origin fetch passes by construction), Origin
header for node-side probe writes (the qa58/t184 precedent), then the per-route
account of every caller. **Most edge/workspace hits are GETs — they stay open; the
precise write-caller list is produced the day the gates land, not before.**

## Expected end state

Census rerun after the batch: 64 → 74 guarded (+10 files), unguarded 24 → 14
(3 GET findings also gated same day → 11: the exempt 3 + views/gallery +
activity×2 + ai×2 + camera-bookmarks + overlay-session + api root, all documented
exemptions). The door family then has no unpriced member: every bare route is bare
*by verdict*, not by never having been counted.

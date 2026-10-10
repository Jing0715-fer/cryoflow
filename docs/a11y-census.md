# A11y Census — the UI's accessible-name layer, swept source-first and live

**What this is.** 698 windows in, no accessibility audit had ever run. This page
is the first: a two-layer census (source patterns + live DOM accessible-name
computation) across the four principal faces of the app. The verdict is an
extinction testimony of the best kind — the name layer is already 100% covered,
and the census found no gap worth a build-day line. What it did find were two
observations recorded honestly below, and one method artifact that mirrors the
family's oldest lesson.

## Layer 1 — source patterns (rg over src/components)

- **Click-divs without role**: ZERO. No `div/span/td/li` with an `onClick`
  lacks a `role=` (the sweep excluded role-bearing hits; nothing survived).
- **`<img>` without alt**: ZERO. The first lookahead pass flagged six open tags
  — all false positives from multiline JSX; every `<img>` carries `alt=` within
  its attribute block (verified per-site with context reads).
- **Form controls without names**: every file containing an
  `input/select/textarea` also carries `aria-label`/`aria-labelledby` usage
  (2-26 per file across the ten control-bearing files).

## Layer 2 — live DOM (agent-browser eval, accessible-name computation)

The live probe computed names the way an assistive tree does
(`aria-label` → `aria-labelledby` → textContent) and enumerated every button,
image, and form control on each face:

| Face | buttons | unnamed | imgs | alt-less | inputs | unnamed inputs |
|------|---------|---------|------|----------|--------|----------------|
| Workflow canvas | 142 | **0** | 0 | 0 | 2 | 0 |
| Dashboard | 114 | **0** | 3 | 0 | — | — |
| Inspector open (3D auto-refine tenant) | 180 | **0** | — | — | — | — |
| ⌘K command palette | 150 | **0** | — | — | 1 | 0 |

**586 button-views across four faces, zero without an accessible name.** The
dialog layer checks out too: the inspector dialog names itself via
`aria-labelledby` whose target element exists and carries the tenant heading
("3D auto-refine — job inspector"), and keyboard focus is trapped inside
(`document.activeElement` within the dialog subtree). Tab traversal lands on a
named, visible button. The palette's 26 `cmdk` groups render with the
Recent-group silence contract intact (t684's law holds in the a11y tree too —
an empty trail does not render an empty group shell).

## Two observations (recorded, not priced)

1. **`aria-modal` is systematically absent** on both Radix dialogs inspected.
   Modal semantics are still delivered — Radix traps focus and (in this
   version) hides outside content from the tree — so screen-reader users get
   the modal behavior through the alternative mechanism. Fixing it means
   upgrading/patching the Radix dependency, not editing product components; a
   dependency-level change is priced out of a one-line build-day annex and
   stays an observation until a Radix upgrade window exists anyway.
2. **The palette input's name rides placeholder/id** rather than an explicit
   `aria-label`. Reachable by name either way; explicit would be marginally
   stronger. One line, product code — parked in the build-day annex as an
   optional polish line, not a gap.

## The method artifact

The inspector face was reached by clicking what the probe THOUGHT was the
roster row — the first `/auto-refine/` button match, which turned out to be
the map card's "Centered iso view" control. The click opened a dialog anyway,
and the census ran on it productively; but the tenant extraction then read
empty (`aria-label` null) and nearly recorded a "dialog without a name"
finding — until the labelledby check showed the name living one indirection
away. **An a11y probe must compute names the way the tree does, and its own
tenant assertions must pass before its findings are findings** — the t695
negative-reading law, restated for the accessible tree: a name the probe
cannot see is first evidence about the probe, only second evidence about the
UI.

## The re-witness (t843) — the cheap honesty pair, walked again

The census's own promise ("one eval per face, ~a minute") was paid on
2026-10-10 by `scripts/t843-a11y-rewitness.mjs` (11/11 green, receipt
`shots-qa/t843-a11y-rewitness.json`): the two faces reachable without
fragile interaction chains — the workflow canvas and the dashboard, two
bit-identical rides per face, names computed exactly as in the table
above. **The invariant holds with the world grown**: 149 + 116 = 265
button-views across the pair (the census recorded 142 + 114 — the seats
added since all speak their names), zero unnamed buttons, zero unnamed
form controls, zero alt-less images.

The re-witness also paid the census's own method artifact forward: the
first exploratory pass read the dashboard's three images as "alt-less"
by a falsy check on `getAttribute('alt')` — but all three carry the
decorative `alt=""`, present and empty and CORRECT. The t695
negative-reading law's second bite: a finding about alt attributes must
use `hasAttribute`, because an empty alt is a name the tree already
honors. The instrument's A8 pin now says so by name.

## The re-witness, second course (t844) — the fragile pair, walked deliberately

One window later the rotation completed: `scripts/t844-a11y-fragile-pair.mjs`
(16/16 green, receipt `shots-qa/t844-a11y-fragile-pair.json`) walked the two
faces this page's own method artifact was written about — the ones that need
interaction chains, where the original probe clicked the first `/auto-refine/`
match and opened the WRONG dialog:

- **The job inspector**, door taken deliberately this time: the dashboard's
  saved-view card (textContent starts with "Centered iso view"). The dialog's
  `aria-labelledby` resolves and carries the tenant heading ("3D auto-refine —
  job inspector"), focus is trapped inside, 39 dialog buttons and 188
  page-wide buttons all named (the census recorded 180 — the +8 newcomers all
  speak), two bit-identical rides, and Escape closes cleanly.
- **The ⌘K palette**, door: the t483 contract event
  (`cryoflow:open-palette` — the same door the help guide uses; a synthetic
  ⌘K keydown does not reliably wake the React listener, and the contract
  event is the in-contract path). 157 page-wide buttons, zero unnamed (the
  census recorded 150 — +7 all named). Observation #2 was re-read and STANDS:
  the input carries no `aria-label`, and its `aria-labelledby` points at an
  EMPTY Radix styling `<label>` — the tree falls through to the placeholder
  ("Jump to a job, add a type, run an action…"), so the name rides the
  placeholder exactly as recorded. Parked in the build-day annex still, now
  with the mechanism named.

**All four faces re-witnessed this cycle**: the name layer's 100% coverage
holds with the world grown (+7 / +2 / +8 / +7 seats since the original
sweep, every newcomer named). The floors are pinned in the audit unit
(A4e-13/A4e-14) — any future control that forgets its name breaks a floor.

## What this census buys

The "样式越做越多" lane now has a verified foundation: every interactive
element in the app already speaks its name to the accessibility tree, dialogs
label themselves and trap focus, and the silence contracts (t684/t627) hold in
the a11y dimension. Future UI work inherits a baseline it can keep green
cheaply — any new control that forgets its name will now be the FIRST unnamed
button in a census that has never seen one, which is exactly the kind of
anomaly a repeat of this census (one eval per face, ~a minute) catches for
free.

## The maintenance sweep (t846) — all four faces in ONE command

The rotation's deep instruments (t843's two rides per face, t844's method
artifact) film; this window added the other half of the census's promise —
a SWEEP. `scripts/t846-a11y-maintenance.mjs` chains all four faces in one
command, one measurement per state (count-only), the doors the two deep
instruments own, by name:

- **C → D → I → P → restore**: the canvas (fresh load, sleep 3), the
  dashboard (the exact-text 'Dashboard' switcher click), the inspector
  (the saved-view card, one retry — the flicker lesson), the palette
  (the t483 contract event) — each face riding the previous one's state,
  both dialogs closed by Escape, a fresh load restoring the canvas.

**Numbers, first formal ride 20/20**: canvas 149 (floor 142), dashboard 116
(floor 114), inspector 188 (floor 180, dialog subset 39, tenant heading,
focus trapped), palette 157 (floor 150, the placeholder-named input) —
identical to the deep instruments' counts, so the sweep's single ride and
the deep pair's bit-identical double rides cross-certify each other. The
sweep's own check M19 pins the four counts distinct (149/116/188/157) —
no face is another face.

**The drift ledger (t857, M20-M24 — 25/25)**: the sweep now diffs its counts
against its OWN previous receipt — the receipt itself is the natural
comparator. The floors measure the census's AGE (+7/+2/+8/+7, stable since
the census was pinned); the ledger measures the world's STABILITY: on a
frozen build the ride-to-ride drift must be ZERO, face for face, key for
key — and it is (canvas 149→149, dashboard 116→116, inspector 188→188,
palette 157→157, restore 149→149; the FULL live object identical x5, every
key the measure films, not just the count). Three arms, recorded honestly
per face: no predecessor (first ride — vacuous), build moved (drift
informational — a build may change counts), same build (bit-for-bit or
red). The ledger block rides the receipt (`driftLedger`: prevFound /
prevBuild / prevDate / sameBuild / law / five faces), the comparator's own
date + build recorded as provenance. A fourth reproducibility axis for the
family: every prior identity compared worlds WITHIN one window's rides
(cross-load A4e-24, cross-instrument A4e-25, cross-receipt A4e-26) — this
one compares RIDES ACROSS WINDOWS: the previous window's receipt is the
comparator (measured first by the probe `scripts/t857-drift-ledger-probe.mjs`,
kept as provenance; the family audit carries it as F19, the audit unit as
A4e-27).

**What this buys**: the standing re-witness. Future windows run ONE command
first; if the name layer moved anywhere in the app, a floor breaks and the
deep instruments get called before any UI work. The census's own closing
paragraph promised "one eval per face, ~a minute" — the sweep now delivers
all four faces in one command, cheaper than the promise's own price.

## The overlay tier (t862) — the shortcuts dialog and the knock dropdown

The rotation's next page: the two doors reachable from the calm canvas with
zero mutation. The SHORTCUTS DIALOG (the app's own `?` key, the
typing-guarded window listener) arrives titled and focused, the inventory
region speaks its name ("Keyboard shortcut inventory — grouped by context",
99 Kbd chips), the filter input is named by aria-label — and the filter is
ALIVE: typing "canvas" shrinks the inventory 99 → 41, clearing restores it
bit-for-bit (a named input that did nothing would be a name over a corpse).
The KNOCK DROPDOWN (the header's bell seat) opens a role=menu whose three
items are all named, the chime checkbox carries aria-checked (recorded,
never gated — browser state), and Escape returns focus to the trigger (the
Radix contract). Zero unnamed buttons/controls/imgs on every face; two
settled rides bit-identical. The instrument was BORN with the drift ledger
aboard (three faces through the shared helper) and joined the fleet unit's
family table in the same window — the propagation is now the birthright.

## The job panel (t863) — the run form through the sanctioned mutation ride

The panel was named unreachable: the edit form mounts for IDLE jobs only and
the world speaks only completed (19/19). The ride the census finally paid:
CREATE one idle probe job through the app's own write door (POST /api/jobs,
the same-origin metadata), far-corner parked; walk the panel (the card's
plain-click law: pointerdown → pointerup); DELETE through the same door;
demand the world BACK bit-for-bit (the canvas count, the card gone, the
name layer intact — the tombstone file is the app's own undo ledger, by
design). The walk rides the panel's OWN tab doors — I/O, Params, Log (the
opening tab is localStorage world-state; the persistence is the app's own,
so the instrument opens the tab it films) — and two facts came home:

- **The Radix Tabs trigger switches on MOUSEDOWN, not click.** A `.click()`
  dispatch is silently ignored by the tab bar; the mousedown door is the
  contract. Recorded here because every future live walk needs it.
- **The census's ruler grew the label-for mechanism.** The param form's
  inputs are named the most semantic way the HTML spec offers —
  `<Label htmlFor>` — which the name computation (aria-label →
  aria-labelledby → textContent → value/placeholder) did not follow. One
  control was slandered "unnamed" until the ruler learned the spec's own
  step (label[for=id] resolved after aria-labelledby, before the value
  fallbacks). The fix is in the ruler, not the UI: the UI was right, the
  measurement was incomplete. The family's older receipts stay true (the
  old ruler was the stricter one — zero unnamed under it survives the
  growth); the shared-ruler module is the standing follow-up.

**Numbers, first formal ride 24/24**: the opening canvas 153 (ctrls 2), the
panel's I/O face 168 buttons / 3 controls (zero unnamed anywhere), the
Params face 177 / 9 (the param form's labels cover every input — the
strongest claim on this page, measured on its own tab), the Log face 168 /
3, the world back at 153 bit-for-bit. The Run button speaks the t397 MODE
face ("Run" — a fresh job never says Re-run, never Continue). Two settled
rides bit-identical on every face. The ledger aboard from birth (three
faces: panel / params / worldBack — the tab persistence's world-state rides
the arms honestly).

## The shared ruler (t864) — one name computation for the whole family

The t863 follow-up landed: the census's name computation now lives ONCE, in
`scripts/shared-ruler.mjs` — the canonical chain `aria-label →
aria-labelledby resolved → label[for] → textContent → img alt → input
value/placeholder` (t863's grown variant is the family's canon). Seven
instruments retired their inline copies onto it (t843/t844/t846/t857/t860/
t862/t863 — t186's job-id Map nameOf is a different thing, not a carrier),
each receipt now stamps the `ruler` law string beside the ledger's `law`.
The growth is name-monotone: label[for] can only NAME a control the older
copies fell through on, so every older receipt's zero-unnamed claim stays
true. The self-test is BEHAVIORAL (a DOM shim exercises every branch — it
even caught the chain's own double-space contract in multi-id labelledby)
plus the embeddability contract (no backtick, no `${` — the source must
live inside any quoting). The ruler grows ONCE from now on; every carrier
rides the growth the window it lands.

## The document and the compare dialogs (t864) — the report's print contract, the diff's shift door

The rotation's next two seats, both reachable with zero creation-mutation:

- **The session QC report (the one dialog that IS a document)** — the
  header's named button opens it; the PRINT CONTRACT is part of the a11y
  claim: `body[data-report-print]` flips ON while the document is up and
  OFF after Escape (the t197 dialog-is-a-document law, asserted BOTH ways).
  The ONE md carrier (`data-md`, t194) is aboard and non-empty; the
  copy/download doors are named. The report taught the census's newest
  settle lesson: the document's map-QC/curves families arrive ASYNC (the
  md grew 3459 → 7918 bytes AFTER two "settled" agreements — a false
  settle filmed the pre-arrival shell). The app has its own quiescence
  door: the compass pulse (t499) speaks "— still measuring" in the toc
  chips while the walks run. Settled now means the pulse SILENT and two
  consecutive measures equal — the app's own silence, not a clock.
- **The params diff (the selection toolbar's compare door)** — the card's
  SHIFT door (pointerdown → pointerup with shiftKey, the job-card's own
  "selection toggle, never a drag" law) joins two same-type cards; the
  toolbar arrives speaking the selection size in its aria-label; the
  compare button opens the dialog; the SWAP control is named and carries
  `aria-pressed` (a real boolean state, recorded never judged); the pair's
  shared type is MEASURED from the roster, printed as provenance, never
  pinned (the t826 lesson). Un-mutation is the SYMMETRIC door — shift+click
  each card again — and the canvas count returns bit-for-bit.

**Numbers, first formal ride 22/22** (four rides to green: SR7's red was
the false settle, the L wiring's red taught the faces-block convention):
the report face 166 buttons / 2 controls, the compare face 164 / 2, zero
unnamed everywhere on both, two settled rides bit-identical each, the
world back at 153. The ledger aboard from birth (three faces: report /
paramsdiff / worldBack — numeric from the third ride). The fleet unit's
family table grew the SAME window: t863's trio joined late (the birthright
completed — t863 rode green but never grew the table) and t864's trio
joined at birth: nine carriers, thirty-one faces.

## The results family (t865) — the question-doors porch, five dialogs, and the honest absence

The rotation's next surface: the inspector header hosts the whole question
row — one porch, six questions — and every door behind it is a lazy chunk
(the t391 barrel) whose own "Loading…" shimmer is the quiescence door the
settle law waits on. The walk (`scripts/t865-results-a11y.mjs`, 58/58 after
five rides): the postprocess inspector's porch names the final-verdict and
particle-funnel doors with the A/B doors HONESTLY ABSENT (the guard law:
none of the A/B domains on this face) and the Duplicate door present (the
A/B loop's front door); the FSC overlay rides its chip door (`fsc-compare-open`,
the candidate rows measured — 5 in the restored roster — the re-scan /
select / toggle doors named, the chart aboard); the verdict and funnel
dialogs speak their reading regions with the export doors named; the arc
and convergence dialogs ride their single-run doors with the Round A/B
selects named; and the ctffind porch proves the guard's POSITIVE absence —
zero A/B doors, zero sibling pickers, the two guards agreeing — an absent
door that was GUARDED into absence is a claim, not a gap. Zero unnamed on
every face; every dialog's two settled rides bit-identical; the world back
bit-for-bit (153 == 153). The birth's lessons, all measurement-side: the
sub-dialog's heading must be read from the TOPMOST dialog layer (nested
portals put the inspector's title first in DOM order), the toggle group is
a `role=group` aria-label not a button, and one async thumbnail arriving
between two rides (imgs 9→10, the t857/t860 mechanism) grew the settle law
its third silence door: `img.complete` — the image element's own contract.
The first ride also filmed an OOM corpse (next-server killed at 2.59GB mid-
walk; the watchdog booted clean; the re-ride reproduced the settled truth).

## The identity-vs-lens vocabulary (t865) — the identical flag's false speaks one word per field

The ledger's honest `identical: false` used to speak TWO words at once
("something changed") where one word was meant. The shared helper grew the
vocabulary at the one place the raws are in hand: `ledgerFace` now returns
`moved: { lens, world }` — `lens` = moved fields whose values are strings
or string-arrays (the name computation's own outputs — the ruler grew
richer, the world never moved), `world` = numeric/boolean moves (the page's
content itself moved). `armVerdict`'s arm-2′ detail NAMES the moved fields,
so a dev-key ride's receipt says what moved, not merely that it did. The
contract is pinned by the fleet's 103rd piece (`scripts/t865-identity-lens-
unit.mjs`, 18/18: the known pairs, the arm-2′ wording, and the family's
LIVE receipts — where the vocabulary's first real sentence was spoken: the
ctffind porch's face rode `identical false — lens [act] world [pageBtns]`,
one word per field). The drift-ledger self-test grew 10 → 16 with the
vocabulary's own branches.

## The star table's page (t866) — the clean room, the sort machine, and the lens-only sentence

The rotation's next un-walked room: the results family's own STAR tables —
the section (one door per `.star` output, the door's text IS its name:
file + rows + size) and the dialog behind it (a nested portal above the
inspector, so the t865 topmost-layer lesson applies at birth). The walk
(`scripts/t866-star-table-a11y.mjs`, 29/29 after three rides): the clean
room (below), the extract inspector through the plain door, the Results
tab through the MOUSEDOWN door, the section present and named (2 doors,
240 + 96 rows, measured never pinned), the dialog's heading read from the
TOPMOST layer, the region named with its keyboard door (tabIndex 0 — the
t812 grounded-verdict law), the sortable columns aboard with names, the
t832 keymap seat (`star-keymap`) teaching its one key, and the aria-sort
STATE MACHINE walked live: ascending -> descending -> the file's native
order (three clicks, the sort never pinned). Zero unnamed on every face;
two settled rides bit-identical; the world back bit-for-bit; the seed
hygiene (W2) rides every page now. The birth's reds, all the
instrument's own lens plus the world's own weight: the first ride filmed
an OOM corpse (next-server killed at 2.2GB mid-walk — the fifth ride of
that pattern; the watchdog booted clean; the re-ride reproduced the
settled truth), one selector spoke a syntax error through the shell's
quote-nesting (the measure grew the escaped-single-quote form), and the
tab probe read the CANVAS's active tab through the nested portal until
the query learned to scope to the topmost dialog.

## The clean-room law (t866) — the session seed made the boot state ride-dependent

The window's bug, born red and taught: t864's pair-toggle face went red
TWO rides in a row on a world whose src was bit-identical (the same dev
key). The root cause: Task 157's session-position seed
(`cryoflow.selectedJob.v1`) is echoed on EVERY selection transition — and
the load hydration puts the seeded job INTO the multi-selection
(`store.ts:2410` sets `selectedIds: [seedJob.id]`). A seed left by an
earlier ride therefore (a) re-opens the side panel at boot (+12 controls
— the canvas count 153 becomes 165) and (b) boots a one-card selection,
which flips the pair toggle's SECOND click from JOIN to REMOVE — the
compare toolbar never forms. The rides themselves were the seed-writers:
a red ride's un-mutation toggles acted as first-time JOINS, and the
join's echo persisted the seed. The fix, instrument-side (the world's
own design is defensible — the restored ring is visible, the shift-click
joins it consistently): Face 0 of every page CLEARS the seed, reloads,
and demands the panel-closed boot (O0); the pair face gained the
one-retry law; the world-back gained W2 — the ride leaves NO session
seed behind. The t864 instrument grew 22 -> 24 checks; the t866 page was
born with the law aboard. The family's lesson: the instrument owns its
measurement conditions (as it owns the viewport and the settle) — the
world's session position is the user's, not the film's.

## The lens-only sentence (t866) — the vocabulary's quietest form

The star table's second ride spoke the vocabulary's first LENS-ONLY
sentence on a live receipt: `identical false — lens [actTab] world []`
— the actTab probe's scope moved (page-wide tab query -> topmost-dialog
query), so the measured STRING changed while the world's drift stayed
+0. The ruler grew richer; the world never moved; the receipt says
exactly that, one word per field. The fleet's regression net (A4e-28)
grew to ELEVEN carriers / 42 faces the window the page was born — the
birthright now simply the family's shape.

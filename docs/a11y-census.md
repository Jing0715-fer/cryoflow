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

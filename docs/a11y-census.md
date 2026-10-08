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

## What this census buys

The "样式越做越多" lane now has a verified foundation: every interactive
element in the app already speaks its name to the accessibility tree, dialogs
label themselves and trap focus, and the silence contracts (t684/t627) hold in
the a11y dimension. Future UI work inherits a baseline it can keep green
cheaply — any new control that forgets its name will now be the FIRST unnamed
button in a census that has never seen one, which is exactly the kind of
anomaly a repeat of this census (one eval per face, ~a minute) catches for
free.

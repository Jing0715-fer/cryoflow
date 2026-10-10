# The Band Audit

*Task 835 — the header's band arithmetic as a contract for humans. The t832
audit formalized the right cluster's arithmetic from source; the t834 sweep
persisted the live instrument and derived the left cluster through the
squeeze law; the t835 completion weighed the right cluster seat by seat and
filmed the middle tier's squeeze live; the t837 font-metrics probe derived
the last text constants (the wordmark's 142, the tab labels' 120) and the
t838 box derivation closed the family (the lens chip's 90). This page
is what all of them now agree on — the numbers, the laws that produce them,
and the one residue still on the books.*

## The six bands and their truth

Measured on build `KtPKuXIbtB9d7uhItOOUS`, reproducible with one command
(see Instruments). `left` / `right` are the header's two clusters in px;
`slack` is what remains; `seats` counts the actions cluster's visible
controls. All integers are truth at rounding precision — the live DOM
carries subpixels (the wordmark's text, the chip's 162.3).

| band | left | right | slack | seats | the tier story |
|---|---|---|---|---|---|
| 375 | 68 | 236 | 71 | 6 | the ViewSwitcher alone (the brand icon and wordmark asleep) |
| 640 | 114 | 334 | 192 | 8 | brand icon aboard; storage + knock return |
| 768 | 264 | 460 | 44 | 11 | wordmark aboard — and squeezed 2px (the squeeze law's fingerprint) |
| 1024 | 266 | 460 | 298 | 11 | the same tier at its natural width |
| 1280 | 608 | 628 | 44 | 12 | row FULL — middle tier aboard, labels awake; the slack IS the chrome |
| 1536 | 864 | 628 | 44 | 12 | row full; the lens chip and the 220px trigger join |

## The laws the numbers obey

**1. The inventory law (t832) — seats from source, widths from the ruler.**
Every actions-cluster seat either carries an `aria-label` (counted) or is a
named component anchor (counted); the RELION chip is the twelfth. A future
seat must do one or the other — the census cannot be bypassed. Each seat's
tier comes from its own class: always / `max-sm:hidden` (returned at 640) /
`max-md:hidden` (at 768) / `hidden xl:block` (the chip, at 1280).

**2. The closed forms.** The right cluster reassembles at the child level
in every band: `right(band) = Σseats + 6×(n−1)` — 236 / 334 / 460 / 628.
The left cluster closes through the row's own squeeze law:
`left(band) = min(natural(band), band − chrome − right(band))`, where
chrome = the header's padding (24 below sm, 32 from sm) + the
justify-between gap (12). The natural width is assembled from the parsed
seats: the brand icon 36 (`size-9`), the ViewSwitcher 68 below xl — derived
from its own box classes (`border` 1 + `p-0.5` 2 + `gap-0.5` 2 + two tabs
of `px-2` 8 + `size-3.5` 14) — plus the wordmark and the tab labels
(derived constants: 142 / 120 — the t837 font-metrics probe: the
wordmark is the max of its two lines' canvas advances under the elements'
own computed fonts, "Cryo-EM Workflow Builder" at 11px carrying it at
142.46 live vs rect 142.47; the labels sum 120.2) and the lens chip 90
(derived too — the t838 box derivation at the chip's own 2xl band 1536:
chrome 34 = border 2 + px-2.5 20 + gap-1.5 6×2, + icon 14 + the tabular
count's advance (its own live rect — a variant canvas cannot set) +
"noted"'s canvas advance 34.65; box 90.29 vs rect 90.3, the fresh-load
count 0 recorded; receipt `shots-qa/t837-wordmark-probe.json`) and the
middle tier's triggers (128→160 /
150→170→220, the `w-[]` ladders). Every width in the closed form is now
source arithmetic, source-parsed chrome, or a derived constant.

**3. The squeeze law.** When the natural row misses the band, flexbox
yields the `min-w-0` items first — the wordmark (142 → 101 at 1280) and the
middle tier (338 → 240) — while the floored items hold: the project trigger
rides its 130px `min-w-[130px]` name-worthy floor, and the unfloored
ViewSwitcher sits at its min-content (200.2 with labels, identical at 1280
and 1536). The 2px between 768's 264 and 1024's 266 is this law, not noise.

**4. The 44 floor.** At the full bands (768 / 1280 / 1536) the slack IS the
chrome — 16 + left + 12 + right + 16 = band exactly. A new seat costs its
own width plus a 6px seam, and must find them in another seat's yield. The
audit's purpose is that price being visible BEFORE the seat ships.

**5. The tier law (t828) — seats yield by class, not by squeezing.** The
actions cluster never shrinks (`shrink-0`); the left row is the shock
absorber. A band that cannot fit a seat must not show it.

## The residue on the books (t835, zone formalized t836)

The t510 budget arithmetic ("626 ≤ 650 at xl") predates the right cluster's
growth — the budget at 1280 is **608** today, the natural row **746**. The
squeeze engages, and at the exact xl boundary the project trigger holds its
130px floor while its wrapper yields to 115.3: the overflow paints **2.7px
into the RELION chip's box**. Pinned as the sweep's D4 assertion; the fix
window lands the fix and moves the pin — red until then.

The zone, measured in 1px steps and pinned (the sweep's section E, 54/54):

- **Left-anchored at xl.** Below 1280 the middle tier sleeps
  (`hidden xl:flex`) — the zone cannot start before 1280 (1279 asleep).
- **Linear with slope −0.4px/px.** `overlap(W) = 2.7 − 0.4×(W−1280)` — the
  wrapper reclaims 0.4px per viewport px, the row's other yielders absorb
  the 0.6. The law closed with max deviation 0 across 1280..1290.
- **The edge: last paint 1286 (+0.3), first clear 1287 (−0.1).** The t835
  "clear by ~1290" was the named point (1290 = −1.3 exact); the measured
  edge is tighter.
- **No re-paint.** From 1287 through 1440 the overlap stays ≤ 0
  (1366 = −12, 1440 = −33.1 — the floor sleeps from 2xl, trigger 205 ≤
  wrapper 205).
- **The paint witness.** Inside the band the topmost element is the CHIP
  (DOM-order hit-test, no z-index) whose background is transparent: the
  trigger's edge paint shows through, and the chip owns the click. A
  consequence the fix window must price: option (a) `overflow-hidden`
  changes the PAINT, not the geometry — the ratchet needs this paint
  witness (elementFromPoint + computed bg), not the raw rect delta alone.
  **The sweep carries it permanently now (t841, the zone's second
  instrument)**: the zone measure grew the STACK witness
  (`elementsFromPoint` — the trigger is IN the hit stack at every
  painted width, E9) and the wrapper's computed overflow-x (the fix's
  fingerprint, watched in reverse, E10) — the fix window's flip is a
  per-width measured delta, and E10 goes red first if the src outlives
  the sweep.

**The fix's proof, pre-flighted (t839, still zero src).** Option (a) was
rehearsed on a throwaway documentElement clone — `overflowX = 'hidden'`
applied to the clone's PS wrapper, the live tree swapped out (React's
root stays on the detached original), the zone re-measured on the clone
(two rides bit-identical per section; receipt
`shots-qa/t839-zone-rehearsal.json`). The pricing is now an experiment,
not arithmetic alone: the geometry held exactly (2.7 / 130 / 115.3
before = after), the paint clipped (the trigger LEFT the band's
`elementsFromPoint` stack — hit-testing respects overflow clipping, the
sharper witness the pricing asked for), the click owner unchanged
(topmost still CHIP), the edge moved not on the clone (1286 = 0.3,
1287 = −0.1, both overflow hidden — the clip is total beyond the
wrapper's edge), and the fresh-load restore came back to the BEFORE
truth. The build day's ratchet is therefore measured, not guessed: D4's
narration flips to the clipped truth (the geometric 2.7 stays, the
stack loses the trigger), E8 gains the wrapper's computed `overflow-x`
fingerprint, and the fix lands as ONE grind with its proof already
aboard.

The build day's options — priced by arithmetic (t836), then MEASURED
(t840, every AFTER pre-filmed on throwaway clones; receipt
`shots-qa/t840-options-rehearsal.json`):

- **(a) `overflow-hidden` on the PS wrapper — THE fix.** The geometry
  stays exactly as measured (2.7 / 130 / 115.3), the paint clips (the
  stack witness loses the trigger), the chip keeps the click, one line
  of src. The t839/t840 rows agree.
- **(b) re-cut the wordmark's xl width — refuted AS WRITTEN, viable
  bound.** The wordmark is ALREADY squeezed to 101.3 at 1280 (its
  natural 142.46 minus the row's squeeze — the number (b)'s pricing
  lacked): a cap at 138 does not bind and nothing moves. A cap at 88
  binds and CLEARS the zone (overlap −4.8; the reclaim rate steepens,
  the t836 slope −0.4 becomes ≈ −0.55: 1283 = −6.4, 1286 = −8.1) — at
  the cost of truncating the brand text harder. More src churn, worse
  brand, same visual result as (a).
- **(c) drop the project trigger's xl tier from 170 to 150 — REFUTED.**
  The trigger still hits its 130 floor (the squeeze binds regardless of
  tier), the freed demand is eaten UPSTREAM (the tier law's shock
  absorber recovers), the wrapper yields DEEPER (115.3 → 106.6) and the
  paint WORSENS to 11.4 (+8.7). The arithmetic pricing assumed the
  freed width stays in the mid tier; the experiment shows the row sends
  it upstream.

The verdict is closed before the grind: land (a), ONE grind, the
ratchet's post-fix form already rehearsed (D4's narration flips to the
clipped truth, E8 gains the computed overflow-x fingerprint), and the
decision table rides in the receipt should the build day ever want the
comparison.

## Instruments

- `node scripts/t834-band-sweep.mjs` — the live half: six bands plus the
  residue's 1px-step zone (56 assertions; the zone rows carry the STACK
  witness and the wrapper's overflow-x fingerprint since t841), one
  command; receipt `shots-qa/t834-band-sweep.json` with the raw subpixels,
  per-seat anatomy, and the zone table.
- `node scripts/t832-slack-audit-unit.mjs` — the source half: the inventory
  parsed, the tiers computed, the closed forms (54 assertions, rides the
  fleet; A4e-5..8 close the t837/t838 receipt against the pins, A4e-9..10
  close the t839 rehearsal receipt against the pricing, A4e-11 closes the
  t840 decision table, A4e-12 closes the t842 family audit, A4e-13 closes
  the t843 a11y re-witness, A4e-14 closes the t844 fragile pair, A4e-15
  closes the t845 third seat, A4e-16 closes the t846 maintenance sweep).
- `node scripts/t837-wordmark-probe.mjs` — the constants' derivation:
  canvas advances under the elements' own computed fonts (two rides per
  section, bit-identical before the pins; sections W = the wordmark and
  the labels at 1024, C = the lens chip's box at 1536; receipt
  `shots-qa/t837-wordmark-probe.json`). The wordmark's 142 was the
  audit's load-bearing unknown — the 768 squeeze law hinges on it — and
  is now arithmetic; the chip's 90 closes the family: if the brand text
  or the chip's anatomy changes, the probe moves first, the law follows.
- `node scripts/t839-zone-rehearsal.mjs` — the residue fix's rehearsal:
  the t510 option (a) fix applied to a throwaway DOM clone and the zone
  re-measured (the sweep's walk + the `elementsFromPoint` STACK witness
  + the wrapper's computed overflow-x; two bit-identical rides per
  section; receipt `shots-qa/t839-zone-rehearsal.json`). The pricing
  "paint, not geometry" is an experiment now: on the build day the fix
  lands with its proof already aboard, and D4/E8 flip to the rehearsed
  clipped truth.
- `node scripts/t840-options-rehearsal.mjs` — the decision table: every
  build-day option's AFTER pre-filmed on its own throwaway clone ((a)
  the clip, (b) at 138 = no-op and 88 = clears with a steepened slope,
  (c) = backfires to 11.4; two bit-identical rides per option; receipt
  `shots-qa/t840-options-rehearsal.json`). The t836 arithmetic pricing
  is an experiment now — the build day's choice is closed by
  measurement, not by memory.
- `node scripts/t842-family-audit.mjs` — the family audit: one arithmetic,
  five instruments. A pure file pass over the five instrument receipts
  (t839's proof, t840's decision table, the sweep's live rows, and since
  t843 the t837 wordmark derivation, and since t845 the sweep's own
  pinned trio) asserting they tell the same story
  about the same 2.7px: the BEFORE
  quartet agrees at 1280, the AFTER pair agrees with the geometry unmoved
  and the TRIGGER gone (the ratchet — delta(geometry)=0, flip(stack)=1 —
  filmed twice by two independent harnesses), the clone's edges equal the
  live edges (1286 = 0.3, 1287 = -0.1), the t836 law rides all seven
  painted rows, the decision table's rows relate as filmed (B138 no-op at
  the squeezed 101.3, B88 clears and steepens to -0.55, C backfires +8.7),
  and all receipts speak the standing build (31 assertions; receipt
  `shots-qa/t842-family-audit.json`). The second seat (t843) pinned the
  BOUND CHAIN across receipts — the wordmark's natural 142.46 > B138's cap
  138 > the squeezed 101.3 > B88's cap 88 — the one line that proves B138
  is a no-op and B88 binds, so the number the no-op verdict stands on is
  receipt-to-receipt. The third seat (t845) brought the sweep's own MACRO
  pins (left/right/seats across six widths) into the same audit as F8 —
  the BAND layer cross-checking the zone rows the way F7 checks the
  wordmark: pinned == bands within the sweep's own ±0.5 rounding law
  (seats exact), the plateaus land on the breakpoints (6,8,11,11,12,12),
  the seat arithmetic closes (seats 12 == rightKids.length, rightW
  628.3 = Σkids 562.3 + 6px × 11), the three-way 115.3 (band midKids ==
  zone row wrap == the GEOM every receipt rides), and the shared 1280
  anchor — the only width both rulers sample — with the natural 1366 row
  (149.2/149.2/-12, TRIGGER on top) proving the squeeze is band-local.
  When the fix lands, all three paint instruments flip
  together — this receipt is the pre-flip family portrait the post-fix
  world is compared against.
- The handshake is the audit: source counts drift from rendered truth, and
  measured widths rot without a contract — neither half alone is honest.
  When the two instruments produce the same numbers, the header's band
  arithmetic is a contract, not a memory.

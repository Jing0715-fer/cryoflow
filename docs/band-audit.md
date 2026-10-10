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

The fifth seat (t848) carried the decision table to the BAND layer:
every option's clone now rides the sweep's BAND walk right after its
zone pair, and the measured law is simple — **the band's EDGES never
move on any option** (left 607.8, right 628.3, seats 12 on live, (a),
(b138), (b88), (c), and the restore alike); whatever the build day
picks, only the mid row's awake children pay. (a) and (b138) are
bit-for-bit the live band (PAINT and no-op, proven cross-harness: the
same answer t839's cloneBand gives). (b88) EQUALIZES the two awake
children at 122.8 (== the zone's wrapW — the freed 13.3 of wordmark
flows into the mid band). (c) DIVERGES them: the workspace label stays
fat at 121.3 while the wrapper alone pays the deeper yield to 106.6
(== the zone's wrapW). The decision table's band-layer AFTERs ride in
the receipt's `bandAfter` key, so the build day's comparison is filmed
at both layers before the first line of src moves.

The sixth seat (t849) carried the band layer ACROSS WIDTHS: t839's
cloneZone rows (1286/1287) now ride the BAND walk too, against fresh
LIVE rulers at 1280/1286/1287 taken on the restore load. Two laws:
**(1) PAINT is width-free** — the fix clone's band equals the live
band bit-for-bit at every width in the zone (1280: the fourth seat;
1286 and 1287: R11/R12). The fix never moves the band layer, at any
width the zone touches. **(2) The live band's own drift across the
zone is real and pinned**: the LEFT row grows +1.0/px (607.8 → 610.8
→ 613.8 → 614.8), the wrapper's kid +0.4/px (115.3 → 118.1 — equal
to the sweep's zone rows' wrapW at every sampled width: two
instruments, two layers, one number per width; the four-way 115.3
becomes a width-indexed family), the workspace label +0.3/px-ish
(0.1-rounding wobble — pinned per width, no slope claim), while the
RIGHT row (628.3) and the seats (12) NEVER move. So the fifth seat's
edges-never-move law was an AT-A-WIDTH law (across options at 1280);
across widths the left row drifts — but clone and live drift
TOGETHER, which is exactly what PAINT-not-geometry means.

The seventh seat (t850) took the mid-row-pays law ACROSS WIDTHS on the
option worlds: t840's (b88) slope rows (1283/1286) and the (c) world
gained the same BAND walks, and the probe (t850-option-across-probe)
rode the widths before any pin. Three measured laws: **(1) the edges
ride the live rulers on every option world at every width** (610.8
@1283, 613.8 @1286, rightW 628.3, seats 12 — width-free PAINT
generalized from the fix world to the decision table; the 1286 row is
cross-harness identity with t839's live ruler: two instruments, two
worlds, one number). **(2) The wrapper kid == the option's zone wrapW
at every width** (124.4/126.1 on (b88), 107.7/108.8 on (c)) — the
cross-layer identity is width-indexed on the option worlds too.
**(3) The mid row's own laws re-scope per option**: the (b88) EQUALIZE
is an AT-A-WIDTH phenomenon — exact at 1280 (122.8 == 122.8), then
decaying as the label trails the wrapper (124.1 vs 124.4 @1283, 125.4
vs 126.1 @1286: the kids' slopes differ, +0.43/px vs +0.55/px) — while
the (c) divergence is WIDTH-STABLE (the label grows at the live label's
own rate: 122.2/123.2, the gap holding 14.7 → 14.5 → 14.4). The fifth
seat's "equalize" was the zone's anchor coincidence; the pays law that
survives every cross-section is the wrapper-kid one.

The eighth seat (t851) COMPLETED the decision table's width form: (a)
the paint and (b138) the no-op gained the same width walks their
siblings rode (each against its OWN load's live rulers — the
comparators ride the same world the clone walks). Two laws and one
form: **(1) the no-op is WIDTH-FREE** — (b138)'s band == its own
load's live band bit-for-bit at 1283 AND 1286 (nothing moves anywhere
at any width; the cap-above-the-squeeze is a cross-width fact, not a
1280 accident). **(2) The paint is WIDTH-FREE on the options harness
too** — (a)'s band == its own load's live band bit-for-bit at 1283 AND
1286 (the sixth seat's law re-proven on a second harness; the 1286
leftW is cross-harness identity with t839's live ruler). **(3) The
bound chain's width form**: the wordmark's squeezed box loosens
+0.3/px-ish across the zone (101.3 → 102.2 → 103.0) but the 138 cap
NEVER binds (35+ short at the zone's edge), and the squeeze is
option-invariant — the live/A/B138 worlds' wmW identical at every
sampled width. The table now speaks at both layers and three widths:
the paint and the no-op move nothing at any width, the paying options
move only their mid rows, and the brand's price never comes due in the
zone.

The verdict is closed before the grind: land (a), ONE grind, the
ratchet's post-fix form already rehearsed (D4's narration flips to the
clipped truth, E8 gains the computed overflow-x fingerprint), and the
decision table rides in the receipt should the build day ever want the
comparison.

## Instruments

- `node scripts/t834-band-sweep.mjs` — the live half: six bands plus the
  residue's 1px-step zone (76 assertions; the zone rows carry the STACK
  witness and the wrapper's overflow-x fingerprint since t841; since t852
  the FAR EDGE rides too — 1366/1440/1536/1920, the band layer's first
  walk above the zone: the cross-layer identity is far-edge-proof (the
  wrapper kid == the zone's wrapW at every width, 2xl and the third kid
  included), the floor sleeps (trigW == wrapW x4), the right cluster
  never moves (628.3/12 x4), the named points hold and the gap runs
  away (-12/-33.1/-110.3/-463.1), the chip is width-free above 2xl
  (90.3), and the residue is 1280-local; since t853 the BELOW ZONE rides
  too — 768/900/1024 plus the edge ride 767-772, the band layer's first
  walk below xl: the mid row sleeps at every named tier (the twin
  vacuously at rest — E1's 1279 point now a cross-section), the residue
  has no below-form, the wordmark is BORN SQUEEZED at md (140 @768 —
  the row needs 738.5 vs available 736 and the min-w-0 yielder pays the
  whole 2.5, A4e-2's live form) in a LINEAR zone (squeeze(W) = 770.5 −
  W, [768, 770], clear by 771, slope −1.0/px — the row's only yielder
  below xl absorbs every pixel), the interior rides the natural
  266.5/142.5 (768-local), and the right plateau re-anchors below xl
  (460/11 x3, closed form); since t856 the WAKE EDGE rides too — the
  far edge's SECOND threshold (J1-J5): the stats chip WAKES AT 2xl, a
  1px POINT (last asleep 1535, first awake 1536 — a breakpoint, not a
  shortage; the far mirror of the below squeeze's 3px zone) whose STEP
  charges the row's own yielders for the birth (chip born 90.3 —
  constant forever — and the wrap tier-steps 170 → 205, while the label
  PAYS 9.1 (160 → 150.9) and the wordmark DIPS 7.1 (142.5 → 135.4)),
  then TWO CAPPED RAMPS repay the transient by 1570 (the wrap +0.44/px
  to its cap 220, the label +0.27/px back to 160, the wordmark
  +0.21/px back to 142.5), and above the caps the plateau holds to
  1920 — everything constant but the gap (−1.0/px, the t836 law's far
  form); receipt
  `shots-qa/t834-band-sweep.json` with the raw subpixels,
  per-seat anatomy, the zone table, and the farEdge (with the wake)
  and belowZone
  blocks), one
  command.
- `node scripts/t832-slack-audit-unit.mjs` — the source half: the inventory
  parsed, the tiers computed, the closed forms (64 assertions, rides the
  fleet; A4e-5..8 close the t837/t838 receipt against the pins, A4e-9..10
  close the t839 rehearsal receipt against the pricing, A4e-11 closes the
  t840 decision table, A4e-12 closes the t842 family audit, A4e-13 closes
  the t843 a11y re-witness, A4e-14 closes the t844 fragile pair, A4e-15
  closes the t845 third seat, A4e-16 closes the t846 maintenance sweep,
  A4e-17 closes the t847 fourth seat, A4e-18 closes the t848 fifth seat,
  A4e-19 closes the t849 sixth seat, A4e-20 closes the t850 seventh seat,
  A4e-21 closes the t851 eighth seat, A4e-22 closes the t852 far edge,
  A4e-23 closes the t853 below zone, A4e-24 closes the t854 ninth
  seat, A4e-25 closes the t855 tenth seat, A4e-26 closes the t856
  eleventh seat).
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
  section; since t847 the clone also carries its own BAND layer — the
  fourth seat: left 607.8, right 628.3, seats 12, bit-for-bit equal to
  the live band, PAINT-not-geometry proven on the band layer too;
  receipt `shots-qa/t839-zone-rehearsal.json`, 14 assertions). The pricing
  "paint, not geometry" is an experiment now: on the build day the fix
  lands with its proof already aboard, and D4/E8 flip to the rehearsed
  clipped truth. Since t849 the cloneZone rows carry BAND walks too (the
  sixth seat: PAINT is width-free — the clone's band == the live band
  bit-for-bit at 1286/1287 against live rulers at 1280/1286/1287, and the
  live band's own drift pinned: leftW +1.0/px, the wrapper's kid +0.4/px
  == the zone rows' wrapW, rightW/seats invariant; the receipt's
  `bandAcross` key). One harness law learned en route: the instrument
  OPENS its own page at boot — a battery rider that only sets the
  viewport inherits the previous rider's DOM mutations (the t849 first
  ride's two reds were true readings of a mislabeled world).
- `node scripts/t840-options-rehearsal.mjs` — the decision table: every
  build-day option's AFTER pre-filmed on its own throwaway clone ((a)
  the clip, (b) at 138 = no-op and 88 = clears with a steepened slope,
  (c) = backfires to 11.4; two bit-identical rides per option; since
  t848 each clone also carries its own BAND layer — the fifth seat: the
  edges never move on any option, the mid row pays, (b88) equalizes at
  122.8, (c) diverges 121.3/106.6; since t850 the (b88) slope rows and
  the (c) world carry BAND walks at 1283/1286 — the seventh seat: the
  edges ride the live rulers at every width on both option worlds, the
  wrapper kid == the zone wrapW at all four widths, the (b88) equalize
  is at-a-width (decays 0.3/0.7), the (c) divergence width-stable
  (14.5/14.4); since t851 the (a) and (b138) clones carry the same
  width walks against their own loads' rulers — the eighth seat: the
  paint and the no-op are bit-for-bit the live band at 1283/1286
  (nothing moves anywhere at any width), and the bound chain's width
  form holds (the squeezed box 101.3 → 103.0, the 138 cap never
  binding in the zone, the squeeze option-invariant); since t854 the
  RESTORE load walks the widths too — the ninth seat: the world's exit
  state == its entry state bit-for-bit at 1283/1286 on BOTH layers
  (the zone and band walks == the T0 load's rulers — T5+T10's 1280
  truth extended across the zone, the harness's own loop closed; and
  two independent fresh loads of the same build film the same world
  bit-for-bit across widths, the cross-load identity); since t855 the
  same two loads walk OUTSIDE the zone — the tenth seat: the far edge
  (1366/1920: edges 693.8/895, rightW 628.3, seats 12, the wrap twin
  149.2/220 alive at the far edge, the PS clearing deeper −12 →
  −463.1) and the below zone (768/1024: edges 264/266.5, rightW 460,
  seats 11, the mid row ASLEEP — midKids null, the zone walk exactly
  {mid:false}) both bit-for-bit, the restore's width map COMPLETE
  (below, zone, far); receipt
  `shots-qa/t840-options-rehearsal.json`, 22 assertions). The t836
  arithmetic pricing is an experiment now — the build day's choice is
  closed by measurement, not by memory.
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
  and all receipts speak the standing build (59 assertions; receipt
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
  The fourth seat (t847) brought the fix's own CLONE into the band layer:
  t839's BAND_MEASURE now rides the clone after the swap, and F9 pins the
  clone's band numbers EQUAL to the live band's bit-for-bit (left 607.8,
  right 628.3, seats 12) — PAINT-not-geometry proven on the band layer
  too — and the mid wrap joins the three-way as the FOUR-way 115.3 (band
  live / band clone / zone row / the GEOM every receipt rides). The fifth
  seat (t848) brought the DECISION TABLE's clones into the band layer as
  F10: t840's `bandAfter` (live/a/b138/b88/c/restored) films every
  option's AFTER at the band layer, and the law is the edges-never-move
  one — the EDGES hold at 607.8 / 628.3 / 12 on every option while only
  the mid row's awake children pay, (b88) equalizing at its zone wrapW
  and (c) the wrapper alone paying to its zone wrapW; PAINT and no-op
  hold cross-harness (t840's option-a clone == t839's cloneBand == the
  live band, bit-for-bit), the restore returns bit-for-bit, and the
  115.3 grows the FIVE-way (band live / band clone / band option-a /
  zone row / the GEOM). The sixth seat (t849) generalized the PAINT law
  across widths as F11: t839's `bandAcross` walks the clone's band at
  1286/1287 against live rulers at 1280/1286/1287, and the clone == the
  live band bit-for-bit at every width in the zone; the live band's own
  drift is pinned and SHARED (leftW +1.0/px, the wrapper's kid +0.4/px
  == the sweep's zone wrapW per width, rightW/seats invariant) — the
  at-a-width edges law and the across-widths drift law are two
  cross-sections of one fact: the fix is paint. The seventh seat (t850)
  brought the option worlds' WIDTH walks into the same audit as F12:
  t840's `bandAfter` now carries (b88)/(c) band walks at 1283/1286, and
  F12 pins the pays law's width form — the edges ride the live rulers on
  every option world at every width (610.8/613.8, rightW 628.3, seats
  12; the 1286 row cross-harness with t839's live ruler), the wrapper
  kid == the option's zone wrapW at all four widths (124.4/126.1,
  107.7/108.8), the (b88) equalize is at-a-width (exact at 1280, the
  label trailing 0.3/0.7 — the kids' slopes differ) while the (c)
  divergence is width-stable (14.5/14.4). The eighth seat (t851)
  COMPLETED the decision table's width form as F13: t840's
  `bandAfter.eighthSeat` carries (a)'s and (b138)'s width walks, each
  against its OWN load's live rulers — the paint and the no-op are
  bit-for-bit the live band at 1283/1286 (nothing moves anywhere at any
  width), and the bound chain's width form holds: the wordmark's
  squeezed box loosens +0.3/px-ish (101.3 → 103.0) but the 138 cap
  never binds in the zone, and the squeeze is option-invariant. The far
  edge (t852) took the band layer ABOVE the zone's neighborhood for the
  first time as F14: the sweep's `farEdge` walks 1366/1440/1536/1920 on
  both layers, and the cross-layer identity (the band's wrapper kid ==
  the zone's wrapW) proves FAR-EDGE-PROOF — it holds at every width,
  2xl and the third kid included (the chip wakes at 1536, 90.3, and the
  twin doesn't blink); the floor sleeps (trigW == wrapW exactly — the
  shock absorber retires above the zone), the right cluster never moves
  (628.3/12 at every width), the named points hold (-12/-33.1 — two
  sections of the sweep agreeing) while the gap runs away (-110.3/
  -463.1), and the paint witness is trigger-local at every far width:
  the t510 residue exists only where the floor binds. The below zone
  (t853) took the band layer BELOW xl for the first time as F15: the
  sweep's `belowZone` walks 768/900/1024 plus the edge ride 767-772, and
  the mid row SLEEPS at every named tier — the twin has no counterpart
  below the zone (vacuously at rest; E1's 1279 point now a
  cross-section) and the residue has no below-form. The discovery: the
  wordmark is BORN SQUEEZED at md — at 768 the row needs 738.5
  (266.5+460+12) vs available 736 and the min-w-0 wordmark pays the
  whole 2.5 (A4e-2's integer law refined to 0.1px) — in a LINEAR zone:
  squeeze(W) = 770.5 − W exactly (769 pays 1.5, 770 pays 0.5, 771
  clear), slope −1.0/px because the wordmark is the row's ONLY yielder
  below xl and absorbs every pixel (the 1280 zone's slope is −0.4 —
  there the row's other yielders take 0.6); the interior (900/1024)
  rides the natural 266.5/142.5 — the squeeze is 768-local, the below
  mirror of the residue's 1280-locality. The ninth seat (t854) closed
  the harness's own loop as F16: t840's `bandAfter.ninthSeat` walks the
  RESTORE load across 1283/1286 with both layers, and the world's exit
  state == its entry state bit-for-bit at every width and layer the
  table walks (the zone and band walks == the T0 load's rulers; the
  wrap-twin holds on the restore load, the named points ride along —
  overlap 1.5/0.3 == the live law, wmW 102.2/103); the cross-load
  identity is a law in its own right: two independent fresh loads of
  the same build film the same world bit-for-bit across widths — the
  table's width form now includes its own restore. The tenth seat
  (t855) took the identity OUTSIDE the zone as F17: t840's
  `bandAfter.tenthSeat` carries BOTH loads' far/below walks (the T0
  load and the restore load each walk 1366/1920/768/1024, zone +
  band), and the cross-load identity holds bit-for-bit at the far edge
  (edges 693.8/895, rightW 628.3, seats 12 — the wrap twin alive at
  149.2/220, the PS clearing deeper −12 → −463.1) and the below zone
  (edges 264/266.5, rightW 460, seats 11, the mid row asleep, the
  zone walk exactly {mid:false} — the sleep itself reproducible);
  F17.c adds the form nobody had pinned before: the identity SPANS
  INSTRUMENTS — t840's live rulers == the sweep receipt's own G/H rows
  bit-for-bit at the load level (the zone layers agree on the shared
  6-key projection: the sweep's zone rows carry a narrower shape —
  modeling, not drift; the t854 lesson learned twice by the t855
  probe, which rode all seven far/below widths first with zero
  drifts). The restore's width map is COMPLETE: two loads, one world,
  below, in, and far beyond the zone. The eleventh seat (t856) pinned
  the far edge's SECOND threshold as F18: the sweep's `farEdge.wake`
  walks 1535-1600 (rows + zone), and the chip WAKES AT 2xl — a 1px
  POINT (last asleep 1535, first awake 1536; a breakpoint, not a
  shortage — the far mirror of the below squeeze's 3px zone) — whose
  STEP charges the row's own yielders for the birth: one pixel delivers
  the chip (born 90.3, CONSTANT forever) and the trigger's 2xl tier
  (+35: 170 → 205) while the label pays 9.1 (160 → 150.9) and the
  wordmark dips 7.1 (142.5 → 135.4); two CAPPED RAMPS repay the
  transient by 1570 (the wrap +0.44/px to 220 — the 2xl tier is a
  floor, not a fixed width — the label +0.27/px back to 160, the
  wordmark +0.21/px back to 142.5), and above the caps the plateau
  holds to 1920 with the gap's two segments (−110.3 constant through
  the ramp, then −1.0/px); F18.c also pins the J-ride's own identity —
  the wake's 1536 row == the G block's 1536 row bit-for-bit, one
  world, two walks of the same receipt. When the
  fix lands, all three paint instruments flip
  together — this receipt is the pre-flip family portrait the post-fix
  world is compared against.
- The handshake is the audit: source counts drift from rendered truth, and
  measured widths rot without a contract — neither half alone is honest.
  When the two instruments produce the same numbers, the header's band
  arithmetic is a contract, not a memory.

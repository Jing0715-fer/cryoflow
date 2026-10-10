# The Band Audit

*Task 835 — the header's band arithmetic as a contract for humans. The t832
audit formalized the right cluster's arithmetic from source; the t834 sweep
persisted the live instrument and derived the left cluster through the
squeeze law; the t835 completion weighed the right cluster seat by seat and
filmed the middle tier's squeeze live. This page is what all of them now
agree on — the numbers, the laws that produce them, and the one residue
still on the books.*

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
of `px-2` 8 + `size-3.5` 14) — plus the wordmark and the tab labels (pinned
text variables: 142 / 120) and the middle tier's triggers (128→160 /
150→170→220, the `w-[]` ladders).

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

The build day's options, priced by the arithmetic: (a) `overflow-hidden` on
the PS wrapper — the floor stays name-worthy, the paint stays inside,
cheapest; (b) re-cut the wordmark's xl width; (c) drop the project
trigger's xl tier from 170 to 150.

## Instruments

- `node scripts/t834-band-sweep.mjs` — the live half: six bands plus the
  residue's 1px-step zone (54 assertions), one command; receipt
  `shots-qa/t834-band-sweep.json` with the raw subpixels, per-seat anatomy,
  and the zone table.
- `node scripts/t832-slack-audit-unit.mjs` — the source half: the inventory
  parsed, the tiers computed, the closed forms (42 assertions, rides the
  fleet).
- The handshake is the audit: source counts drift from rendered truth, and
  measured widths rot without a contract — neither half alone is honest.
  When the two instruments produce the same numbers, the header's band
  arithmetic is a contract, not a memory.

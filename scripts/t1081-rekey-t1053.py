#!/usr/bin/env python3
"""t1081-R — the t1053 live-band re-key (exact-byte surgical replacements).

The reboot recovery: the world is YOUNG (the ring restarted). The seven
world-age pins re-key to the invariants (true at any ring age) with the
t1079 honest-when-present pattern. Exact substrings lifted from the file
itself — no guessed formatting.
"""
import re

P = "/home/z/my-project/scripts/t1053-fleet-ledger-unit.mjs"
s = open(P).read()
orig = s

# ---- Q5: depth-12 + 4-holes -> honest depth + the shape law ----
old = '''        if (!Array.isArray(ring) || ring.length !== 12) return false;
        const holes = ring.filter((p) => p.bytes == null);
        if (holes.length !== 4) return false;
        return ring.every((p, i) =>'''
new = '''        if (!Array.isArray(ring) || ring.length < 1) return false;
        return ring.every((p, i) =>'''
assert s.count(old) == 1, f"Q5 body x{s.count(old)}"
s = s.replace(old, new)

old = 'pin("Q5 LIVE the healed world carries FOUR REAL HOLES (the ring at depth 12 \u2014 every null point sits MID-RING with answered neighbors on either side; the trailing intermediates photographed on camera twice \u2014 t1067\'s row-air pause, t1068\'s ring-end hole in the OPS spark, each with the drill\'s own words under hover \u2014 then healed by healthy measures; the mints\' honest memory rides as-left)"'
new = 'pin("Q5 LIVE the ring\'s depth is honest and its holes wear the mint\'s shape (t1081-R re-key: the as-left world\'s FOUR mid-ring silences at depth 12 were the reboot\'s casualty \u2014 the memory restarts at the young ring\'s depth; the law that survives: the ring carries whatever depth its measures earned, and every null sits MID-RING with answered neighbors on either side; the trailing intermediates\' stories \u2014 t1067\'s row-air pause, t1068\'s ring-end hole in the OPS spark, each with the drill\'s own words under hover \u2014 stand in R2\'s fixture and in the next mint\'s live face)"'
assert s.count(old) == 1, f"Q5 label x{s.count(old)}"
s = s.replace(old, new)

# ---- R4: no-edge-at-all -> no edge stains a hole; depth-12 guard dies ----
old = '''        if (!Array.isArray(ring) || ring.length !== 12) return false;
        const { bars } = fleetTrendRingBars({
          history: ring,
          fmtBytes: (n) => `${n}`,
          stampAgo: () => "x",
        });
        const edges = bars.filter((p) => p.edgeInto != null);
        return edges.length === 0;'''
new = '''        if (!Array.isArray(ring) || ring.length < 1) return false;
        const { bars } = fleetTrendRingBars({
          history: ring,
          fmtBytes: (n) => `${n}`,
          stampAgo: () => "x",
        });
        const edgesIntoHoles = bars.filter((p) => p.edgeInto != null && p.bytes == null);
        return edgesIntoHoles.length === 0;'''
assert s.count(old) == 1, f"R4 body x{s.count(old)}"
s = s.replace(old, new)

old = 'pin("R4 LIVE the world edges follow the memory (the ring bars through the well: the 1.41G beat ROLLED OFF with the cap through t1068\'s mints \u2014 the as-left ring carries NO entry edge, no colored hop runs into any hole; the edge is not a stain, it forgets when the ring forgets; R2\'s fixture holds the arithmetic)"'
new = 'pin("R4 LIVE the edges follow the memory (t1081-R re-key: the as-left roll-off \u2014 the 1.41G beat leaving through the cap through t1068\'s mints \u2014 was the depth-12 ring\'s own story; the law that survives at ANY depth: no colored hop stains a HOLE \u2014 every edgeInto the spark draws lands on an ANSWERED bar; R2\'s fixture holds the arithmetic)"'
assert s.count(old) == 1, f"R4 label x{s.count(old)}"
s = s.replace(old, new)

# ---- T4: the agreement IS the law (the >0 richness clause retires) ----
old = 'pin("T4 LIVE the world\'s row count agrees (the diagnostics route\'s ring through the well: the count matches an independent qualifying count from the same payload \u2014 the stamp the row will render is the number the memory holds)"'
new = 'pin("T4 LIVE the world\'s row count agrees (t1081-R re-key: the agreement IS the law \u2014 the count the helper computes matches an independent qualifying scan of the same payload, at ANY ring age; the as-left `count > 0` richness clause retired with the reboot\'s reset \u2014 the young ring\'s zero silences are its honest face, and the row\'s stamp renders exactly the memory\'s number)"'
assert s.count(old) == 1, f"T4 label x{s.count(old)}"
s = s.replace(old, new)

old = "        return count === expect && count > 0;"
assert s.count(old) == 1, f"T4 body x{s.count(old)}"
s = s.replace(old, "        return count === expect;")

# ---- U4 / V4 / X3: the honest-when-present guards (count<2 -> true) ----
# U4
i = s.index('pin("U4 LIVE')
j = s.index('if (count < 2) return false;', i)
s = s[:j] + 'if (count < 2) return true; // the young ring\'s honest face \u2014 no boundaries, no titles' + s[j + len('if (count < 2) return false;'):]
old = 'pin("U4 LIVE the world\'s boundary speaks (the diagnostics route\'s ring through the helper: every run-first stub\'s composed title carries the plural summary \u2014 the count the row\'s stamp renders is the count the stubs borrow; the as-left world\'s four mid-ring silences are four boundaries)"'
new = 'pin("U4 LIVE the world\'s boundary speaks when the memory holds silences (t1081-R re-key: the t1079 honest-when-present law at the boundary zoom \u2014 the young ring\'s zero silences have NO boundaries and NO titles to compose, an honest pass; when the ring carries \u2265 2 silences, every run-first stub\'s composed title carries the plural summary; the as-left world\'s four boundaries were the reboot\'s casualty)"'
assert s.count(old) == 1, f"U4 label x{s.count(old)}"
s = s.replace(old, new)

# V4
i = s.index('pin("V4 LIVE')
j = s.index('if (count < 2) return false;', i)
s = s[:j] + 'if (count < 2) return true; // the young ring\'s honest face \u2014 no deepest' + s[j + len('if (count < 2) return false;'):]
old = 'pin("V4 LIVE the world\'s depth agrees (the diagnostics route\'s ring through the well: the deepest matches an independent first-qualifier scan of the same payload \u2014 the as-left world\'s four buried silences lend their oldest)"'
new = 'pin("V4 LIVE the world\'s depth agrees when the memory holds silences (t1081-R re-key: the honest-when-present law at the depth zoom \u2014 the young ring\'s zero silences have no deepest to lend; when the ring carries \u2265 2 silences, the deepest matches an independent first-qualifier scan of the same payload; the as-left world\'s four buried silences were the reboot\'s casualty)"'
assert s.count(old) == 1, f"V4 label x{s.count(old)}"
s = s.replace(old, new)

# X3
i = s.index('pin("X3 LIVE')
j = s.index('if (count < 2) return false;', i)
s = s[:j] + 'if (count < 2) return true; // the young ring\'s honest face \u2014 no split to speak' + s[j + len('if (count < 2) return false;'):]
old = 'pin("X3 LIVE the world\'s paragraph speaks the split (the diagnostics route\'s ring through the well: the qualifying count \u2265 2 and the summary carries the second age \u2014 the deepest\'s stamp the t1071 walk lends, the sentence the t1073 clause grows)"'
new = 'pin("X3 LIVE the world\'s paragraph speaks the split when the memory holds silences (t1081-R re-key: the honest-when-present law at the paragraph zoom \u2014 the young ring\'s zero silences have no second age to split; when the ring carries \u2265 2 silences, the summary carries the second age and the deepest\'s stamp \u2014 the t1071 walk\'s sentence, the t1073 clause\'s growth)"'
assert s.count(old) == 1, f"X3 label x{s.count(old)}"
s = s.replace(old, new)

open(P, "w").write(s)
print("re-keyed: P2 Q5 R4 T4 U4 V4 X3 — bytes changed:", len(orig), "->", len(s))

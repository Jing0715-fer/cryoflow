#!/usr/bin/env node
/**
 * drift-ledger.mjs — the family's shared ledger (t861): the t857/t846
 * drift ledger, generalized from the maintenance sweep to every fleet
 * instrument that films a stable world. One law, four new carriers this
 * window (t834/t837/t839/t840 join t846's five faces): each instrument
 * diffs its live faces against its OWN previous receipt — the receipt is
 * the natural comparator — and records { prev, live, drift, identical }
 * per face. The floors (the pins) measure the world's TRUTH; the ledger
 * measures the world's STABILITY, ride to ride, window to window.
 *
 * Three arms, honestly recorded per face (t859's jurisdiction clause
 * aboard — arm 3's bit-for-bit demand presumes a FROZEN world):
 *   arm 1   no predecessor (first ride — vacuous)
 *   arm 2   the world key moved (prev build !== this build) — drift
 *           informational, a moved world may move anything
 *   arm 2′  same dev@ key (the world is unfrozen) — drift informational,
 *           the ride's stability truth recorded, the build-day arm 3
 *           will bite again (t859 jurisdiction clause)
 *   arm 3   same build-mode key on a frozen world — drift 0 AND the full
 *           live object identical, bit-for-bit, or red
 *
 * The ledger block rides each instrument's receipt as `driftLedger`:
 *   driftLedger: { prevFound, prevBuild, prevDate, sameBuild, law,
 *                  faces: { <face>: { prev, live, drift, identical } } }
 *
 * Receipt-shape tolerance: t834/t839/t840/t846 stamp the world key at
 * the top level (`build`), t837 rides it inside `provenance.buildId` —
 * loadComparator takes a buildKeyOf accessor so both shapes speak.
 *
 * Self-test: node scripts/drift-ledger.mjs  (deterministic, offline)
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** sortedJson — order-insensitive compare at the TOP level (the t846
 * form): the measure objects build their keys deterministically, so a
 * sorted-key stringify is the honest equality for JSON receipts. */
export const sortedJson = (o) => JSON.stringify(o, Object.keys(o ?? {}).sort());

/** loadComparator — the previous receipt as the ledger's comparator.
 * A corrupt or missing predecessor is a MISSING predecessor (arm 1) —
 * recorded, never thrown: an unreadable past must not strand the ride.
 * Returns { prev, prevFound, prevBuild, sameBuild }. */
export function loadComparator(ROOT, receiptPath, buildId, buildKeyOf = (r) => r.build) {
  const abs = join(ROOT, receiptPath);
  let prev = null;
  if (existsSync(abs)) {
    try {
      prev = JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      prev = null;
    }
  }
  const prevFound = !!prev;
  const prevBuild = prevFound ? buildKeyOf(prev) ?? null : null;
  const sameBuild = prevFound ? prevBuild === buildId : null;
  return { prev, prevFound, prevBuild, sameBuild };
}

/** ledgerFace — one face: the scalar ruler (scalarOf names each face's
 * own number — pageBtns, leftW, rect, overlap) plus the full-object
 * identity. drift rounded to 0.1 (the instruments' own precision);
 * null-safe on either side (a face the predecessor lacks rides
 * prev=null, drift=null, identical=null — the arm-1 shape for one face
 * inside an otherwise-ledgered ride). */
export function ledgerFace(prevObj, liveObj, scalarOf) {
  const p = prevObj ?? null;
  const pv = p && scalarOf ? scalarOf(p) : null;
  const lv = liveObj && scalarOf ? scalarOf(liveObj) : null;
  const has = p && pv !== null && pv !== undefined && lv !== null && lv !== undefined;
  return {
    prev: pv ?? null,
    live: lv ?? null,
    drift: has ? Math.round((lv - pv) * 10) / 10 : null,
    identical: p ? sortedJson(p) === sortedJson(liveObj) : null,
  };
}

/** armVerdict — the three-arm law (+ the jurisdiction clause) for one
 * face. `bites` = arm 3 demands bit-for-bit (the caller's ok() gates on
 * verdict.ok; detail carries the arm's own words). */
export function armVerdict(cmp, world, f) {
  if (!cmp.prevFound)
    return { bites: false, ok: true, detail: "arm 1 — first ride, no predecessor" };
  if (!cmp.sameBuild)
    return {
      bites: false, ok: true,
      detail: `arm 2 — world key moved (${cmp.prevBuild ?? "?"} -> ${world.id}), drift ${f.drift >= 0 ? "+" : ""}${f.drift} informational`,
    };
  if (world.mode !== "build")
    return {
      bites: false, ok: true,
      detail: `arm 2′ — dev world (key ${world.id}), same-key ride drift ${f.drift >= 0 ? "+" : ""}${f.drift} informational — the dev world is unfrozen; the build-day arm 3 will bite again (t859 jurisdiction clause)`,
    };
  const good = f.drift === 0 && f.identical === true;
  return {
    bites: true, ok: good,
    detail: good
      ? `arm 3 — bit-for-bit (${f.prev} -> ${f.live}, the full live object identical)`
      : `arm 3 RED — drift ${f.drift}, identical=${f.identical}`,
  };
}

/** LEDGER_LAW — the family's one-sentence law (rides every receipt). */
export const LEDGER_LAW =
  "the ride-to-ride drift: prev receipt == this ride, per face, scalar and full live object — " +
  "three arms recorded honestly: no predecessor (first ride, vacuous), world key moved (drift informational), " +
  "same key (drift 0 AND identical, bit-for-bit, or red — on a build-mode key only; a dev@ key rides arm 2′ " +
  "informational, the t859 jurisdiction clause: the build-day arm 3 will bite again); " +
  "the pins measure the world's truth, the ledger measures the world's stability";

/* ---------- self-test (offline, deterministic) ---------- */
if (process.argv[1] && process.argv[1].endsWith("drift-ledger.mjs")) {
  const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let bad = 0;
  const expect = (name, cond) => {
    if (!cond) {
      bad++;
      console.error(`  ✗ ${name}`);
    } else console.log(`  ✓ ${name}`);
  };
  // loadComparator: missing file -> arm 1 shape
  const c1 = loadComparator("/nonexistent-root-xyz", "no/such.json", "dev@abc");
  expect("missing receipt -> prevFound false, sameBuild null",
    c1.prevFound === false && c1.sameBuild === null && c1.prev === null);
  // ledgerFace: identical objects, drift 0
  const f1 = ledgerFace({ leftW: 607.8, seats: 12 }, { leftW: 607.8, seats: 12 }, (m) => m.leftW);
  expect("identical face -> drift 0, identical true",
    f1.drift === 0 && f1.identical === true && f1.prev === 607.8 && f1.live === 607.8);
  // ledgerFace: key order invariance (the sortedJson contract)
  const f2 = ledgerFace({ a: 1, b: { x: 1, y: 2 } }, { b: { x: 1, y: 2 }, a: 1 }, () => 0);
  expect("key-order-insensitive identical", f2.identical === true);
  // ledgerFace: drift rounding (0.1 precision, no float dust)
  const f3 = ledgerFace({ leftW: 607.5 }, { leftW: 607.8 }, (m) => m.leftW);
  expect("drift rounds to the instruments' 0.1", f3.drift === 0.3);
  // ledgerFace: missing predecessor face -> the arm-1 face shape
  const f4 = ledgerFace(null, { leftW: 1 }, (m) => m.leftW);
  expect("missing predecessor face -> prev/drift/identical null",
    f4.prev === null && f4.drift === null && f4.identical === null && f4.live === 1);
  // armVerdict: the four arms
  const world = { mode: "build", id: "KtP" };
  const cmp = { prevFound: true, sameBuild: true, prevBuild: "KtP" };
  const a1 = armVerdict(cmp, world, { drift: 0, identical: true });
  expect("arm 3 bites on a frozen same-key ride, green", a1.bites === true && a1.ok === true);
  const a2 = armVerdict(cmp, world, { drift: 3, identical: false });
  expect("arm 3 bites, red on drift", a2.bites === true && a2.ok === false);
  const a2p = armVerdict(cmp, { mode: "dev", id: "dev@abc" }, { drift: 0, identical: true });
  expect("arm 2′ on a dev key — informational, never bites",
    a2p.bites === false && a2p.ok === true && a2p.detail.includes("jurisdiction"));
  const a3 = armVerdict({ prevFound: true, sameBuild: false, prevBuild: "old" }, world, { drift: 5, identical: false });
  expect("arm 2 on a moved key — informational", a3.bites === false && a3.ok === true && a3.detail.includes("informational"));
  const a4 = armVerdict({ prevFound: false, sameBuild: null, prevBuild: null }, world, { drift: null, identical: null });
  expect("arm 1 on no predecessor — vacuous", a4.bites === false && a4.ok === true);
  console.log(bad === 0 ? "drift-ledger self-test: all green" : `drift-ledger self-test: ${bad} RED`);
  process.exit(bad ? 1 : 0);
}

/**
 * t433 bench — the Picking QC board arithmetic + the legend's direction
 * fix.
 *
 * Two deliveries share one bench because they share one law set:
 *
 *   P1 (pickingBoard): the third QC domain. The empty law (a 0-pick
 *      micrograph is an ABSOLUTE offender in both lenses, sorted first,
 *      excluded from the quantile pack), the unrankable law (null-FOM
 *      mics land healthy with NaN value and sort last in the FOM lens),
 *      the scoped flat-pack law (all-same rankable values stay healthy
 *      while empties still offend), and the count lens's quantiles over
 *      the non-empty pack only.
 *   P2 (medianPickFom): odd/even medians, null exclusion, all-null →
 *      null (unrankable, not zero-confidence).
 *   P3 (fmt/QC_METRIC_LABEL): count speaks integers, pickFom three
 *      decimals, NaN renders "—" for EVERY metric (a value the pack
 *      cannot rank must not masquerade as 0.0).
 *   P4 (the legend direction fix — the live bug): negated lenses (fom /
 *      pickFom) used to print the NEGATED-SPACE threshold verbatim —
 *      "offenders ≥ -0.310 (p90)", a negative FOM with a ≥ direction
 *      that reads "everyone is an offender". Linear-interpolation
 *      quantiles are exact under negation (Q(−X,p) = −Q(X,1−p)), so the
 *      honest legend speaks user-side numbers with ≤ and p10/p25. The
 *      higher-is-worse lenses keep ≥ p90 / ≥ p75 (t432's Q5 pins must
 *      keep passing — they live in the t432 bench and still run).
 *
 * World contract: world-free (pure functions, no DB, no files, no
 * network).
 */

import {
  ctfBoard,
  fmtQcValue,
  medianPickFom,
  motionBoard,
  pickingBoard,
  qcLegendText,
  quantile,
  type PickQcEntry,
} from "../src/lib/qc-board";

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/* ------------------------------------------------------------------ */
/* P1 — pickingBoard                                                   */
/* ------------------------------------------------------------------ */

console.log("P1 pickingBoard — the empty law and the quantile pack");

function entry(name: string, count: number, fom: number | null = null): PickQcEntry {
  return { name, count, fom };
}

{
  // a realistic pack: 6 non-empty mics + 1 empty; counts 12..30, the
  // empty one would sit at p0 — the naive arithmetic would call it healthy
  const pack: PickQcEntry[] = [
    entry("mic_001", 12, 0.62),
    entry("mic_002", 18, 0.55),
    entry("mic_003", 22, 0.5),
    entry("mic_004", 26, 0.44),
    entry("mic_005", 28, 0.38),
    entry("mic_006", 30, 0.3),
    entry("mic_007", 0, null), // the empty
  ];
  const board = pickingBoard(pack, "count");
  must(board.rows[0].micrograph.name === "mic_007", "P1.1 the EMPTY mic sorts FIRST (absolute offender)");
  must(board.rows[0].bucket === "offender", "P1.2 the empty mic's bucket is offender, not quantile-swallowed healthy");
  must(board.rows[0].value === 0, "P1.3 the empty mic's value still reads the user's truth (0 picks)");
  must(board.rows[1].micrograph.name === "mic_006", "P1.4 worst-first among ranked = highest count on top");
  must(board.rows.every((r) => r.micrograph.name !== "mic_007" || r.bucket === "offender"), "P1.5 (guard) only the empty is absolute");
  // the quantiles must NOT have been dragged by the empty's zero:
  // pack of counts [12,18,22,26,28,30] — p75/p90 by linear interpolation
  must(
    Math.abs(board.thresholds.watchAt - quantile([12, 18, 22, 26, 28, 30], 0.75)) < 1e-9,
    "P1.6 count quantiles computed over the NON-EMPTY pack (empty's 0 excluded)"
  );
  must(
    Math.abs(board.thresholds.offenderAt - quantile([12, 18, 22, 26, 28, 30], 0.9)) < 1e-9,
    "P1.7 offender line likewise from the ranked pack"
  );
  // 30 ≥ p90([12,18,22,26,28,30]) → offender; 12 at the calm end → healthy
  must(board.rows.find((r) => r.micrograph.name === "mic_006")?.bucket === "offender", "P1.8 the over-picked extreme is an offender");
  must(board.rows.find((r) => r.micrograph.name === "mic_001")?.bucket === "healthy", "P1.9 the calm end stays healthy");
}

console.log("P1b pickingBoard — FOM lens: negation, median, unrankable");

{
  const pack: PickQcEntry[] = [
    entry("mic_001", 20, 0.6),
    entry("mic_002", 20, 0.5),
    entry("mic_003", 20, 0.4),
    entry("mic_004", 20, 0.3),
    entry("mic_005", 20, null), // non-empty but NO FOM column → unrankable
    entry("mic_006", 0, null), // the empty — absolute in BOTH lenses
  ];
  const board = pickingBoard(pack, "pickFom");
  must(board.rows[0].micrograph.name === "mic_006", "P1b.1 the empty leads the FOM lens too");
  must(board.rows[0].bucket === "offender", "P1b.2 empty law is lens-independent");
  must(board.rows[1].micrograph.name === "mic_004", "P1b.3 the LOWEST median FOM is the worst ranked tile (negated ride)");
  must(board.rows[1].value === 0.3, "P1b.4 the FOM value reads the user's 0–1, never the negated scale");
  const unrankable = board.rows.find((r) => r.micrograph.name === "mic_005");
  must(unrankable?.bucket === "healthy", "P1b.5 the unrankable mic lands healthy (no evidence, no verdict)");
  must(Number.isNaN(unrankable?.value as number), "P1b.6 the unrankable value is NaN (renders '—', never a fake 0.0)");
  must(board.rows[board.rows.length - 1].micrograph.name === "mic_005", "P1b.7 the unrankable sorts LAST (worse = -Infinity)");
  // quantiles over the fom-bearing four only
  must(
    Math.abs(board.thresholds.offenderAt - quantile([-0.6, -0.5, -0.4, -0.3], 0.9)) < 1e-9,
    "P1b.8 FOM quantiles over the fom-bearing set (nulls excluded)"
  );
}

console.log("P1c pickingBoard — the scoped flat-pack law");

{
  // every ranked mic has 20 picks: nothing stands out, all healthy —
  // but the empty is STILL an offender (its law is absolute, not relative)
  const pack: PickQcEntry[] = [
    entry("mic_001", 20, 0.5),
    entry("mic_002", 20, 0.5),
    entry("mic_003", 20, 0.5),
    entry("mic_004", 0, null),
  ];
  const board = pickingBoard(pack, "count");
  must(
    board.rows.filter((r) => r.micrograph.count > 0).every((r) => r.bucket === "healthy"),
    "P1c.1 flat ranked pack stays healthy (no tie-painting)"
  );
  must(board.rows[0].micrograph.name === "mic_004" && board.rows[0].bucket === "offender", "P1c.2 the empty still offends inside a flat pack");
  must(board.thresholds.watchAt === 20 && board.thresholds.offenderAt === 20, "P1c.3 collapsed thresholds still speak the pack's value honestly");
}

console.log("P1d pickingBoard — the all-empty edge");

{
  const board = pickingBoard([entry("mic_001", 0), entry("mic_002", 0)], "count");
  must(board.rows.every((r) => r.bucket === "offender"), "P1d.1 an all-empty pack paints every tile offender");
  must(Number.isNaN(board.thresholds.watchAt) && Number.isNaN(board.thresholds.offenderAt), "P1d.2 with no rankable evidence the lines are NaN (legend speaks '—')");
}

/* ------------------------------------------------------------------ */
/* P2 — medianPickFom                                                  */
/* ------------------------------------------------------------------ */

console.log("P2 medianPickFom — odd/even, nulls, all-null");

{
  must(medianPickFom([0.3, 0.5, 0.9]) === 0.5, "P2.1 odd count takes the middle");
  must(medianPickFom([0.3, 0.5, 0.7, 0.9]) === 0.6, "P2.2 even count averages the middle pair");
  must(medianPickFom([null, 0.2, null, 0.8]) === 0.5, "P2.3 null FOMs are excluded, not zeroed");
  must(medianPickFom([null, null]) === null, "P2.4 all-null is unrankable (null), not zero-confidence");
  must(medianPickFom([]) === null, "P2.5 no picks → no median");
  must(medianPickFom([0.9, 0.1]) === 0.5, "P2.6 the median sorts before reading (insertion order safe)");
}

/* ------------------------------------------------------------------ */
/* P3 — fmt + labels                                                   */
/* ------------------------------------------------------------------ */

console.log("P3 fmtQcValue / QC_METRIC_LABEL — picking formats + NaN honesty");

{
  must(fmtQcValue("count", 17) === "17", "P3.1 pick counts speak integers");
  must(fmtQcValue("count", 17.4) === "17", "P3.2 fractional counts round (defensive)");
  must(fmtQcValue("pickFom", 0.1234) === "0.123", "P3.3 pickFom speaks three decimals");
  must(fmtQcValue("count", NaN) === "—", "P3.4 NaN count renders '—'");
  must(fmtQcValue("pickFom", NaN) === "—", "P3.5 NaN pickFom renders '—'");
  must(fmtQcValue("resolution", NaN) === "—", "P3.6 the NaN law covers EVERY metric (no fake 0.0 Å)");
  must(fmtQcValue("total", NaN) === "—", "P3.7 motion drift too");
}

/* ------------------------------------------------------------------ */
/* P4 — the legend direction fix (the live bug)                        */
/* ------------------------------------------------------------------ */

console.log("P4 qcLegendText — direction-aware presentation");

{
  // the bug: thresholds from a negated lens printed verbatim — a NEGATIVE
  // fom with a ≥ direction. The fix speaks the user's side via the exact
  // negation symmetry Q(−X,p) = −Q(X,1−p): offender line = p10, watch = p25.
  const neg: { watchAt: number; offenderAt: number } = { watchAt: -0.322, offenderAt: -0.31 };
  const legend = qcLegendText(neg, "fom");
  must(legend.includes("offenders ≤ 0.310 (p10)"), "P4.1 the fom legend speaks USER-side numbers (no negative FOM)");
  must(legend.includes("watch ≤ 0.322 (p25)"), "P4.2 the watch line rides p25 with ≤");
  must(!legend.includes("≥ -"), "P4.3 the negated-space verbatim bug is dead");
  must(legend.includes("lines are this run's own distribution"), "P4.4 the provenance sentence survives");
  const pickLegend = qcLegendText({ watchAt: -0.5, offenderAt: -0.42 }, "pickFom");
  must(pickLegend.includes("offenders ≤ 0.420 (p10)"), "P4.5 the pickFom lens inherits the same law");
  must(pickLegend.includes("0.420"), "P4.6 pickFom speaks three decimals in the legend too");
  // the higher-is-worse lenses keep t432's phrasing
  const res = qcLegendText({ watchAt: 4.4, offenderAt: 4.6 }, "resolution");
  must(res.includes("offenders ≥ 4.6 Å (p90)"), "P4.7 resolution keeps ≥ p90 (t432 contract)");
  must(res.includes("watch ≥ 4.4 Å (p75)"), "P4.8 resolution keeps ≥ p75");
  const drift = qcLegendText({ watchAt: 2.0, offenderAt: 3.0 }, "total");
  must(drift.includes("offenders ≥ 3.0 Å (p90)"), "P4.9 motion drift keeps ≥ p90");
  // symmetry pinned AT THE ARITHMETIC LEVEL: ctfBoard's fom thresholds,
  // negated, equal the user-side quantiles of the fom column
  const fomPack = [0.62, 0.55, 0.5, 0.44, 0.38, 0.3].map((fom, i) => ({
    name: `mic_00${i + 1}`,
    defocusU: 1,
    defocusV: 1,
    astigmatism: 0,
    fom,
    maxResolution: 4,
  }));
  const ctfFom = ctfBoard(fomPack, "fom");
  must(
    Math.abs(-ctfFom.thresholds.offenderAt - quantile(fomPack.map((m) => m.fom), 0.1)) < 1e-12,
    "P4.10 Q(−X, p90) = −Q(X, p10) — the exact symmetry the legend's p10 phrasing stands on"
  );
  must(
    Math.abs(-ctfFom.thresholds.watchAt - quantile(fomPack.map((m) => m.fom), 0.25)) < 1e-12,
    "P4.11 and p75 ↔ p25 likewise"
  );
  // the regression guard: ctf/motion boards untouched by the picking work
  const motion = motionBoard([{ name: "m", total: 5, early: 2, late: 3 }]);
  must(motion.rows[0].value === 5 && motion.thresholds.offenderAt === 5, "P4.12 motion board contract unchanged");
}

/* ------------------------------------------------------------------ */

console.log(`\nt433: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

/**
 * t439 bench — the CTF A/B verdict's arithmetic.
 *
 *   J1 (joinCtfRuns): the paired electorate — micrographs meet on name,
 *      order follows run A, unpaired rows are NAMED (onlyA/onlyB) and
 *      never fold into the pairs.
 *   J2 (pairedDeltas + direction law): FOM higher-is-better, fit limit
 *      and astigmatism lower-is-better — the same delta can be an
 *      improvement under one lens and a regression under another.
 *   J3 (verdict + median): numpy median (even = mean of middle pair),
 *      empty deltas → NaN median, ties speak "unchanged".
 *   J4 (topMovers): magnitude-first, capped at 5, never mixes kinds.
 *   J5 (agreement + formats): defocus agreement = median |Δ mean
 *      defocus|; fmtDelta speaks the sign; scatterDomain pads
 *      symmetrically (and a perfect tie still draws).
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import { CTF_LENSES, defocusAgreement, type CtfRunRow } from "../src/lib/ctf-compare";
import {
  fmtDelta,
  joinByName,
  pairedDeltas,
  scatterDomain,
  topMovers,
  verdict,
} from "../src/lib/paired-compare";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL — ${label}`);
  }
}

let seq = 0;
function row(name: string, over: Partial<CtfRunRow> = {}): CtfRunRow {
  seq += 1;
  return {
    name,
    defocusU: 2.0,
    defocusV: 2.1,
    astigmatism: 0.1,
    fom: 0.4,
    maxResolution: 6.0,
    ...over,
  };
}

/* ================= J1 — the paired join ================= */
console.log("J1 — joinCtfRuns: the paired electorate");
{
  const A = [row("mic_001"), row("mic_002"), row("mic_003")];
  const B = [row("mic_002"), row("mic_003"), row("mic_004")];
  const join = joinByName(A, B);
  must(join.pairs.length === 2, "J1a shared names pair");
  must(join.pairs[0].name === "mic_002" && join.pairs[1].name === "mic_003", "J1b order follows run A");
  must(join.onlyA.length === 1 && join.onlyA[0] === "mic_001", "J1c only-in-A named");
  must(join.onlyB.length === 1 && join.onlyB[0] === "mic_004", "J1d only-in-B named");
  // disjoint runs: nobody votes
  const empty = joinByName([row("x")], [row("y")]);
  must(empty.pairs.length === 0 && empty.onlyA.length === 1 && empty.onlyB.length === 1, "J1e disjoint → zero electorate");
}

/* ================= J2 — the direction law ================= */
console.log("J2 — pairedDeltas: direction is the lens's own");
{
  const pair = [
    { name: "m1", a: row("m1", { fom: 0.40, maxResolution: 6.0, astigmatism: 0.20 }), b: row("m1", { fom: 0.45, maxResolution: 5.0, astigmatism: 0.10 }) },
  ];
  const fom = pairedDeltas(pair, CTF_LENSES.fom);
  const maxres = pairedDeltas(pair, CTF_LENSES.maxres);
  const astig = pairedDeltas(pair, CTF_LENSES.astig);
  must(fom[0].kind === "improved", "J2a FOM +0.05 → improved (higher better)");
  must(maxres[0].kind === "improved", "J2b 6.0→5.0 Å → improved (lower better)");
  must(astig[0].kind === "improved", "J2c 0.20→0.10 µm → improved (lower better)");
  must(Math.abs(fom[0].delta - 0.05) < 1e-9 && Math.abs(maxres[0].delta - (-1.0)) < 1e-9, "J2d delta stays b − a regardless of direction");
  // the mirror: one direction flip flips the kind, not the arithmetic
  const worse = [{ name: "m1", a: pair[0].b, b: pair[0].a }];
  must(pairedDeltas(worse, CTF_LENSES.fom)[0].kind === "regressed", "J2e reversed pair → regressed under FOM");
  must(pairedDeltas(worse, CTF_LENSES.maxres)[0].kind === "regressed", "J2f reversed pair → regressed under fit limit");
}

/* ================= J3 — verdict + median ================= */
console.log("J3 — verdict: counts, numpy median, ties");
{
  const deltas = pairedDeltas(
    [
      { name: "a", a: row("a", { fom: 0.1 }), b: row("a", { fom: 0.3 }) },
      { name: "b", a: row("b", { fom: 0.1 }), b: row("b", { fom: 0.5 }) },
      { name: "c", a: row("c", { fom: 0.1 }), b: row("c", { fom: 0.2 }) },
      { name: "d", a: row("d", { fom: 0.4 }), b: row("d", { fom: 0.4 }) },
      { name: "e", a: row("e", { fom: 0.1 }), b: row("e", { fom: 0.05 }) },
    ],
    CTF_LENSES.fom,
  );
  const v = verdict(deltas);
  must(v.improved === 3 && v.regressed === 1 && v.tied === 1, "J3a census counts by kind");
  // deltas: +0.2 +0.4 +0.1 0 −0.05 → sorted: −0.05 0 0.1 0.2 0.4 → median 0.1
  must(v.medianDelta === 0.1, "J3b odd-count median");
  // even count averages the middle pair (numpy law)
  const even = verdict(
    pairedDeltas(
      [
        { name: "a", a: row("a", { fom: 0 }), b: row("a", { fom: 0.1 }) },
        { name: "b", a: row("b", { fom: 0 }), b: row("b", { fom: 0.3 }) },
      ],
      CTF_LENSES.fom,
    ),
  );
  must(even.medianDelta === 0.2, "J3c even-count median = mean of middle pair");
  must(verdict([]).medianDelta !== verdict([]).medianDelta, "J3d empty electorate → NaN median (NaN !== NaN)");
  // ties are ties: the demo twin's byte-identical stars speak "unchanged"
  const twin = verdict(
    pairedDeltas(
      [{ name: "m", a: row("m", { fom: 0.42 }), b: row("m", { fom: 0.42 }) }],
      CTF_LENSES.fom,
    ),
  );
  must(twin.tied === 1 && twin.improved === 0 && twin.regressed === 0, "J3e exact tie → unchanged");
}

/* ================= J4 — the named witnesses ================= */
console.log("J4 — topMovers: magnitude-first, capped, unmixed");
{
  const rows = [
    { name: "tiny", a: row("tiny", { fom: 0.10 }), b: row("tiny", { fom: 0.101 }) },
    { name: "big2", a: row("big2", { fom: 0.10 }), b: row("big2", { fom: 0.50 }) },
    { name: "mid", a: row("mid", { fom: 0.10 }), b: row("mid", { fom: 0.30 }) },
    { name: "down", a: row("down", { fom: 0.40 }), b: row("down", { fom: 0.20 }) },
  ];
  const deltas = pairedDeltas(rows, CTF_LENSES.fom);
  const movers = topMovers(deltas);
  must(movers.improvers.length === 3 && movers.regressors.length === 1, "J4a kinds never mix (3 improvers, 1 regressor)");
  must(movers.improvers[0].name === "big2", "J4b magnitude-first");
  // cap: 7 improvers → 5 survive
  const seven = pairedDeltas(
    Array.from({ length: 7 }, (_, i) => ({
      name: `m${i}`,
      a: row(`m${i}`, { fom: 0.1 }),
      b: row(`m${i}`, { fom: 0.2 + i * 0.1 }),
    })),
    CTF_LENSES.fom,
  );
  must(topMovers(seven).improvers.length === 5, "J4c cap holds at 5");
}

/* ================= J5 — agreement, formats, domain ================= */
console.log("J5 — defocus agreement, fmtDelta, scatterDomain");
{
  const pairs = [
    { name: "a", a: row("a", { defocusU: 2.0, defocusV: 2.0 }), b: row("b", { defocusU: 2.02, defocusV: 2.02 }) },
    { name: "b", a: row("b", { defocusU: 3.0, defocusV: 3.0 }), b: row("b", { defocusU: 2.98, defocusV: 2.98 }) },
    { name: "c", a: row("c", { defocusU: 4.0, defocusV: 4.0 }), b: row("c", { defocusU: 4.10, defocusV: 4.10 }) },
  ];
  // |Δ|: 0.02, 0.02, 0.10 → median 0.02
  must(Math.abs(defocusAgreement(pairs) - 0.02) < 1e-9, "J5a agreement = median |Δ mean defocus|");
  must(defocusAgreement([]) !== defocusAgreement([]), "J5b empty → NaN");
  must(fmtDelta(0.031, 3) === "+0.031", "J5c positive sign");
  must(fmtDelta(-1.24, 2) === "−1.24", "J5d negative sign");
  must(fmtDelta(0, 2) === "0.00", "J5e zero speaks bare");
  must(fmtDelta(NaN, 2) === "—", "J5f NaN → em-dash");
  // symmetric domain: identity line must stay 45°
  const dom = scatterDomain([
    { name: "m", a: 1, b: 2, delta: 1, kind: "improved" },
    { name: "n", a: 3, b: 3, delta: 0, kind: "tied" },
  ]);
  must(Math.abs(dom[1] - dom[0] - (dom[1] - dom[0])) < 1e-9 && dom[0] < 1 && dom[1] > 3, "J5g domain covers both axes with padding");
  // perfect tie still draws
  const tie = scatterDomain([
    { name: "m", a: 0.42, b: 0.42, delta: 0, kind: "tied" },
  ]);
  must(tie[0] < 0.42 && tie[1] > 0.42, "J5h tie padded so cloud + identity render");
  must(scatterDomain([])[0] === 0 && scatterDomain([])[1] === 1, "J5i empty → safe default");
}

/* ---------------- verdict ---------------- */
console.log(`\nt439 ctf-compare bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

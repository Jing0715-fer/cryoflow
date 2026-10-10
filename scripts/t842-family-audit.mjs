#!/usr/bin/env node
// t842-family-audit — ONE ARITHMETIC, THREE INSTRUMENTS.
//
// The three rehearsal-family receipts must tell the same story about the same
// 2.7px of paint:
//   1. scripts/t839-zone-rehearsal.mjs   — the fix's PROOF (before/after/cloneZone/restored)
//   2. scripts/t840-options-rehearsal.mjs — the fix's DECISION TABLE (optionA/B138/B88/C rows)
//   3. scripts/t834-band-sweep.mjs        — the LIVE world (zone.rows, 17 widths)
//
// The audit is a pure file pass (no browser): the receipts it reads are refreshed
// each window by their own one-command re-witnesses, so "live" means "the sweep
// receipt of THIS window". Families:
//   F1  the BEFORE quartet agrees at 1280 (live row == two rehearsals' before == their restorations)
//   F2  the AFTER pair agrees (t839.after == t840.optionA.rides: geometry unmoved, fingerprint
//       'hidden', the TRIGGER gone, the chip keeps the click) — THE RATCHET: delta(geometry)=0,
//       flip(stack)=1, filmed twice by two independent harnesses
//   F3  the clone zone's edges == the live zone's edges (1286 = 0.3, 1287 = -0.1) and the
//       zone.edge pins name exactly the painted set 1280..1286
//   F4  the t836 law rides the live rows: overlap(W) = 2.7 - 0.4*(W-1280), grid 0.05
//   F5  the decision table's internal arithmetic (B138 no-op at the squeezed 101.3; B88 clears
//       and steepens -0.4 -> -0.55 with the paintAt flip to TRIGGER; C backfires +8.7 with the
//       floor still binding at 130)
//   F6  the live residue is real across the whole measured zone (TRIGGER in the stack at all
//       16 awake widths) — the pre-fix truth the fix window will flip per width
// Receipt: shots-qa/t842-family-audit.json.
import { readFileSync, writeFileSync } from 'node:fs';

const R839 = JSON.parse(readFileSync('shots-qa/t839-zone-rehearsal.json', 'utf8'));
const R840 = JSON.parse(readFileSync('shots-qa/t840-options-rehearsal.json', 'utf8'));
const SWEEP = JSON.parse(readFileSync('shots-qa/t834-band-sweep.json', 'utf8'));

const checks = [];
const ok = (name, pass, detail) => { checks.push({ name, pass, detail }); };
const near = (a, b, grid = 0.05) => Math.abs(a - b) <= grid + 1e-9;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasTrig = (row) => (row.stack ?? []).some((s) => String(s).startsWith('TRIGGER'));
const G = (row) => [row.trigW, row.wrapW, row.overlap].join('/');
const GEOM = '130/115.3/2.7';

// ---- F0 provenance: the family speaks one tree ------------------------------------
ok('F0.a provenance trio equal', R839.build === R840.build && R840.build === SWEEP.build,
  `build=${R839.build}`);
ok('F0.b provenance is the standing build', R839.build === 'KtPKuXIbtB9d7uhItOOUS', R839.build);

// ---- F1 the BEFORE quartet at 1280 -------------------------------------------------
const [b839a, b839b] = R839.before;
ok('F1.a t839.before pair bit-identical', eq(b839a, b839b), `${G(b839a)} | ${G(b839b)}`);
const [b840a, b840b] = R840.before;
ok('F1.b t840.before pair bit-identical', eq(b840a, b840b), `${G(b840a)} | ${G(b840b)}`);
ok('F1.c BEFORE trio same geometry (live == two rehearsals)',
  G(SWEEP.zone.rows['1280']) === G(b839a) && G(b839a) === G(b840a) && G(b840a) === GEOM,
  `sweep=${G(SWEEP.zone.rows['1280'])} t839=${G(b839a)} t840=${G(b840a)}`);
ok('F1.d BEFORE fingerprint visible in both rehearsals',
  b839a.wrapOverflowX === 'visible' && b840a.wrapOverflowX === 'visible',
  `${b839a.wrapOverflowX}/${b840a.wrapOverflowX}`);
ok('F1.e restorations return to the BEFORE truth',
  G(R839.restored) === GEOM && G(R840.restored) === GEOM &&
  R839.restored.wrapOverflowX === 'visible' && R840.restored.wrapOverflowX === 'visible' &&
  hasTrig(R839.restored) && hasTrig(R840.restored),
  `t839=${G(R839.restored)} t840=${G(R840.restored)}`);

// ---- F2 the AFTER pair — THE RATCHET ------------------------------------------------
const [a839a, a839b] = R839.after;
const optA = R840.optionA.rides;
ok('F2.a t839.after pair bit-identical', eq(a839a, a839b), `${G(a839a)} | ${G(a839b)}`);
ok('F2.b t840.optionA pair bit-identical', eq(optA[0], optA[1]), `${G(optA[0])} | ${G(optA[1])}`);
ok('F2.c AFTER geometry == BEFORE geometry (the fix moves nothing)',
  [a839a, a839b, ...optA].every((r) => G(r) === GEOM),
  `t839=${G(a839a)} t840=${G(optA[0])}`);
ok('F2.d AFTER fingerprint hidden in both rehearsals',
  [a839a, a839b, ...optA].every((r) => r.wrapOverflowX === 'hidden'),
  `${a839a.wrapOverflowX}/${optA[0].wrapOverflowX}`);
ok('F2.e AFTER stack loses the TRIGGER, chip keeps the click',
  [a839a, a839b, ...optA].every((r) => !hasTrig(r) && String(r.paintAt).startsWith('CHIP')),
  `paintAt=${a839a.paintAt.slice(0, 12)}…`);
const ratchet = (before, after) => ({
  dGeom: (after.overlap - before.overlap),
  dStack: (hasTrig(before) ? 1 : 0) - (hasTrig(after) ? 1 : 0),
});
ok('F2.f THE RATCHET: delta(geometry)=0 and flip(stack)=1, filmed twice',
  [ratchet(b839a, a839a), ratchet(b840a, optA[0])].every((r) => r.dGeom === 0 && r.dStack === 1),
  JSON.stringify([ratchet(b839a, a839a), ratchet(b840a, optA[0])]));

// ---- F3 the clone zone's edges == the live zone's edges ------------------------------
const cz = R839.cloneZone, live = SWEEP.zone.rows;
ok('F3.a clone 1286 == live 1286',
  G(cz['1286']) === G(live['1286']) && G(cz['1286']) === '130/117.7/0.3',
  `clone=${G(cz['1286'])} live=${G(live['1286'])}`);
ok('F3.b clone 1287 == live 1287',
  G(cz['1287']) === G(live['1287']) && G(cz['1287']) === '130/118.1/-0.1',
  `clone=${G(cz['1287'])} live=${G(live['1287'])}`);
ok('F3.c clone edges carry the fix (hidden, TRIGGER gone)',
  cz['1286'].wrapOverflowX === 'hidden' && cz['1287'].wrapOverflowX === 'hidden' &&
  !hasTrig(cz['1286']) && !hasTrig(cz['1287']),
  `${cz['1286'].wrapOverflowX}/${cz['1287'].wrapOverflowX}`);
const awake = Object.keys(live).filter((w) => live[w].mid);
const painted = awake.filter((w) => live[w].overlap >= 0);
ok('F3.d zone.edge pins name exactly the painted set',
  String(SWEEP.zone.edge.lastPaint) === '1286' && String(SWEEP.zone.edge.firstClear) === '1287' &&
  painted.join(',') === '1280,1281,1282,1283,1284,1285,1286' && awake.length === 16,
  `edge=${SWEEP.zone.edge.lastPaint}/${SWEEP.zone.edge.firstClear} painted=${painted.length} awake=${awake.length}`);

// ---- F4 the law rides the live rows ---------------------------------------------------
const dev = painted.map((w) => [w, live[w].overlap, 2.7 - 0.4 * (Number(w) - 1280)])
  .filter(([, m, p]) => !near(m, p));
ok('F4 t836 law: overlap(W) = 2.7 - 0.4*(W-1280) on all painted rows',
  dev.length === 0,
  dev.length ? JSON.stringify(dev) : '7 rows within 0.05');

// ---- F5 the decision table's internal arithmetic --------------------------------------
const B138 = R840.optionB138, B88 = R840.optionB88, C = R840.optionC;
ok('F5.a optionB138 is a NO-OP at the squeezed 101.3',
  eq(B138.rides[0], B138.rides[1]) && G(B138.rides[0]) === GEOM &&
  B138.rides[0].wmMax === '138px' && B138.rides[0].wmW === 101.3,
  `${G(B138.rides[0])} wmW=${B138.rides[0].wmW} cap=${B138.rides[0].wmMax}`);
ok('F5.b optionB88 clears: -4.8 pinned twice',
  eq(B88.rides1280[0], B88.rides1280[1]) && G(B88.rides1280[0]) === '130/122.8/-4.8',
  `${G(B88.rides1280[0])} wmW=${B88.rides1280[0].wmW}`);
ok('F5.c optionB88 steepened law -0.55 rides its measured pins',
  near(B88.at1283.overlap, -4.8 - 0.55 * 3) && near(B88.at1286.overlap, -4.8 - 0.55 * 6),
  `1283=${B88.at1283.overlap} 1286=${B88.at1286.overlap}`);
ok('F5.d optionB88 paintAt flips CHIP -> TRIGGER once clear',
  String(B88.at1283.paintAt).startsWith('TRIGGER') && String(B88.at1286.paintAt).startsWith('TRIGGER'),
  `${B88.at1283.paintAt.slice(0, 12)}…`);
ok('F5.e optionC backfires +8.7 with the floor still binding',
  eq(C.rides[0], C.rides[1]) && near(C.rides[0].overlap, 2.7 + 8.7, 0.05) &&
  C.rides[0].trigW === 130 && C.rides[0].wrapOverflowX === 'visible',
  `${G(C.rides[0])} ofX=${C.rides[0].wrapOverflowX}`);

// ---- F6 the live residue is real across the whole zone --------------------------------
ok('F6 TRIGGER in the stack at all 16 awake widths (the pre-fix truth)',
  awake.every((w) => hasTrig(live[w])),
  `awake=${awake.length} without-trigger=0`);

// ---- verdict + receipt -----------------------------------------------------------------
const passed = checks.filter((c) => c.pass).length;
const failed = checks.length - passed;
const verdict = failed === 0
  ? `the family agrees: one arithmetic (2.7 / 130 / 115.3, the ratchet's zero-geometry stack-flip, the law, the table, the live truth) told identically by three instruments — the fix window flips all three with one grind`
  : `the family DISAGREES in ${failed} place(s) — reconcile before the build day`;
const receipt = {
  instrument: 'scripts/t842-family-audit.mjs',
  build: R839.build,
  date: new Date().toISOString(),
  sources: {
    t839: { file: 'shots-qa/t839-zone-rehearsal.json', date: R839.date },
    t840: { file: 'shots-qa/t840-options-rehearsal.json', date: R840.date },
    sweep: { file: 'shots-qa/t834-band-sweep.json', date: SWEEP.date },
  },
  arithmetic: {
    geometry: GEOM,
    ratchet: { dGeom: 0, dStack: 1, filmedBy: ['t839.after', 't840.optionA'] },
    law: SWEEP.zone.law,
    painted: painted.join(','),
    edges: SWEEP.zone.edge,
    decisionTable: { a: 'clips, geometry intact', b88: 'clears -4.8, slope -0.55', c: 'backfires +8.7' },
  },
  checks: checks,
  passed, failed, total: checks.length,
  verdict,
};
writeFileSync('shots-qa/t842-family-audit.json', JSON.stringify(receipt, null, 2) + '\n');
for (const c of checks) console.log(`${c.pass ? ' ✓' : '✗ FAIL'}  ${c.name}  ${c.detail}`);
console.log(`\nFAMILY-AUDIT t842: ${passed}/${checks.length}${failed ? ' RED' : ' green'}`);
process.exit(failed ? 1 : 0);

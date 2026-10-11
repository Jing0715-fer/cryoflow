#!/usr/bin/env node
// t842-family-audit — THE LIVING FAMILY (the t901 re-form).
//
// The previous form audited ONE ARITHMETIC told by five instruments — the
// T510 paint residue's arithmetic (2.7 / 130 / 115.3, the painted zone
// [1280..1286], the birth-squeeze [768,770], the 142.46 natural). That
// world is DEAD, twice over: the re-seed + the t895 font law (Geist loads
// AND is consumed; the fallback metrics died — the decisive experiment
// measured trigR − chipL = −32.8 at 1280: a GAP, not paint, and the fix
// candidate retired with the experiment as its headstone), and t897's
// re-cut (the GAP law −40.9 − 0.52×(W−1280), the wrapper's slack, the
// birth-squeeze dead, the wake re-anatomized — 83/83 at the current pin).
//
// THE RETIREMENTS (the t901 premise audit): t839 (the fix's rehearsal) and
// t840 (the fix's decision table) refuse to ride — their subject is gone.
// Their fossil receipts stay untouched as provenance. The families that
// priced the dead world (F1–F7, F9–F18 of the previous form) died with it.
//
// THIS FORM audits the LIVING family — cross-instrument agreement on the
// sources that still ride:
//   1. scripts/t834-band-sweep.mjs  — the zone/band/pinned laws (83/83, the
//      Geist world's own re-derived tables, --cut-pins provenance);
//   2. scripts/t837-wordmark-probe.mjs — the text-constants family (the
//      Geist re-pin 133/115/87; the tnum variant-witness);
//   3. scripts/t846-a11y-maintenance.mjs — the census (the re-keyed floors
//      125/104/147/126; the drift ledger, the reproducibility axis).
//
// The audit is a pure file pass (no browser): the receipts it reads are
// refreshed each window by their own one-command re-witnesses.
// Receipt: shots-qa/t842-family-audit.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { worldIdentity } from './world-identity.mjs';

// t859 — the standing-world key (build id on build days, dev@src-hash otherwise).
const world = worldIdentity(process.cwd());

const SWEEP = JSON.parse(readFileSync('shots-qa/t834-band-sweep.json', 'utf8'));
const R837 = JSON.parse(readFileSync('shots-qa/t837-wordmark-probe.json', 'utf8'));
const R846 = JSON.parse(readFileSync('shots-qa/t846-a11y-maintenance.json', 'utf8'));

const checks = [];
const ok = (name, pass, detail) => { checks.push({ name, pass, detail }); };
const near = (a, b, grid = 0.05) => Math.abs(a - b) <= grid + 1e-9;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const G = (row) => [row.trigW, row.wrapW, row.overlap].join('/');
const hasTrig = (row) => (row.stack ?? []).some((s) => String(s).startsWith('TRIGGER'));

// ---- F0 provenance: the family speaks one tree, one world ---------------------------
ok('F0.a the sweep is the standing world', SWEEP.build === world.id,
  `${SWEEP.build} vs ${world.id} (${world.mode})`);
ok('F0.b t837 rides the same world',
  R837.provenance && R837.provenance.buildId === SWEEP.build,
  `${R837.provenance ? R837.provenance.buildId : '?'} vs ${SWEEP.build}`);
ok('F0.c t846 rides the same world', R846.build === SWEEP.build,
  `${R846.build} vs ${SWEEP.build}`);

// ---- F1 the GAP law is the zone's own truth (read from the receipt) -----------------
const live = SWEEP.zone.rows;
const z1280 = live['1280'];
ok('F1.a the gap, not the paint: 1280 rides a NEGATIVE overlap with the trigger at its floor',
  typeof z1280.overlap === 'number' && z1280.overlap < 0 && z1280.trigW === 130,
  `1280 = ${G(z1280)} — the residue's +2.7 would fail this arm (the t895 headstone, re-asserted receipt-to-receipt)`);
ok('F1.b the edge is dead by the receipt\u2019s own certificate',
  SWEEP.zone.edge.lastPaint === null && SWEEP.zone.edge.firstClear === null &&
  typeof SWEEP.zone.edge.note === 'string' && SWEEP.zone.edge.note.length > 0,
  `edge=${SWEEP.zone.edge.lastPaint}/${SWEEP.zone.edge.firstClear} — "${String(SWEEP.zone.edge.note).slice(0, 72)}"`);
ok('F1.c the TRIGGER keeps its tooth: the 1280 stack still leads with it (the witness survives the gap)',
  String(z1280.paintAt).startsWith('TRIGGER') && hasTrig(z1280),
  `paintAt=${String(z1280.paintAt).slice(0, 24)}`);

// ---- F2 two rulers, one number at the shared anchor ---------------------------------
const BANDS = SWEEP.bands, P = SWEEP.pinned;
const widths6 = ['375', '640', '768', '1024', '1280', '1536'];
const mid1280 = (BANDS['1280'].midKids || [])[1] || {};
ok('F2.a the two-layer identity at 1280: the band\u2019s mid wrapper == the zone row\u2019s wrapW (two instruments, one number — the law that survived the world move, now at the Geist value)',
  mid1280.w > 0 && near(mid1280.w, z1280.wrapW),
  `band=${mid1280.w} zone=${z1280.wrapW}`);
ok('F2.b the anchor is exclusive: 1280 is the only width both rulers sample',
  widths6.filter((w) => live[w] !== undefined).join(',') === '1280' && P.seats['1280'] === BANDS['1280'].seats,
  `zone widths among the six: 1280 only; seats ${P.seats['1280']}`);
ok('F2.c 1366 rides the gap world: the gap DEEPENS with width (the −0.52 slope), the trigger stays at its 130 floor, the wrapper keeps slack (no squeeze anywhere)',
  Number(live['1366'].overlap) < Number(live['1280'].overlap) &&
  live['1366'].trigW === 130 && live['1366'].wrapW >= live['1366'].trigW,
  `1280 ${G(live['1280'])} → 1366 ${G(live['1366'])} — the gap deepens, the floor holds, the wrapper ≥ trigger`);

// ---- F3 the sweep's ACTIVE pinned trio: self-consistency (ex-F8, re-booked) ---------
// The t901 audit's second live capture: the receipt carries TWO books —
// `pins` (the ACTIVE cut table, provenanceWorld-stamped, born in the t895
// world-gate rework) and `pinned` (the FOSSIL: the fallback world's rounded
// 608/628, kept as provenance). The previous form read `pinned` back when it
// WAS the active book; the audit's red re-booked the family onto `pins`.
const A = (SWEEP.pins && SWEEP.pins.tables) || null;
ok('F3.pre the active book is aboard and world-stamped: pins.provenanceWorld == the receipt\u2019s build',
  A && SWEEP.pins.provenanceWorld === SWEEP.build && typeof SWEEP.pins.note === 'string',
  `provenanceWorld=${SWEEP.pins ? SWEEP.pins.provenanceWorld : '?'} vs build=${SWEEP.build} — "${SWEEP.pins ? String(SWEEP.pins.note).slice(0, 60) : ''}"`);
ok('F3.a the ACTIVE pinned == the bands under the sweep\u2019s own ±0.5 law (left/right/seats × 6 widths)',
  A && widths6.every((w) =>
    Math.abs(A.left[w] - BANDS[w].leftW) <= 0.5 &&
    Math.abs(A.right[w] - BANDS[w].rightW) <= 0.5 &&
    A.seats[w] === BANDS[w].seats),
  `1280: |${A ? A.left['1280'] : '?'}−${BANDS['1280'].leftW}|≤.5 |${A ? A.right['1280'] : '?'}−${BANDS['1280'].rightW}|≤.5 seats ${A ? A.seats['1280'] : '?'}`);
const seatsSeq = widths6.map((w) => A.seats[w]), rightSeq = widths6.map((w) => A.right[w]), leftSeq = widths6.map((w) => A.left[w]);
const nondec = (arr) => arr.every((v, i) => i === 0 || v >= arr[i - 1]);
ok('F3.b the breakpoint shape: monotone, plateaus on xl/2xl, the STRUCTURAL seat sequence (font-free — 6,8,11,11,12,12 survived the Geist move)',
  nondec(seatsSeq) && nondec(leftSeq) && nondec(rightSeq) &&
  seatsSeq.join(',') === '6,8,11,11,12,12' &&
  rightSeq[2] === rightSeq[3] && rightSeq[4] === rightSeq[5] &&
  seatsSeq[2] === seatsSeq[3] && seatsSeq[4] === seatsSeq[5],
  `seats=${seatsSeq.join(',')} right=${rightSeq.join(',')} left=${leftSeq.join(',')}`);
const kids1280 = BANDS['1280'].rightKids || [];
ok('F3.c the seat arithmetic: seats == rightKids.length and rightW = Σkids + 6px gap each',
  P.seats['1280'] === kids1280.length && kids1280.length === 12 &&
  near(BANDS['1280'].rightW, kids1280.reduce((s, k) => s + k.w, 0) + 6 * (kids1280.length - 1), 0.05),
  `seats=${P.seats['1280']} rightW=${BANDS['1280'].rightW} Σkids=${(kids1280.reduce((s, k) => s + k.w, 0)).toFixed(1)}+66`);
ok('F3.d the fossil book stays honest: the old `pinned` table differs in the widths the font moved but carries the SAME structural seat sequence (provenance, not law)',
  SWEEP.pinned && widths6.every((w) => SWEEP.pinned.seats[w] === A.seats[w]) &&
  (SWEEP.pinned.left['1280'] !== A.left['1280'] || SWEEP.pinned.right['1280'] !== A.right['1280']),
  `fossil 1280 ${SWEEP.pinned.left['1280']}/${SWEEP.pinned.right['1280']} vs active ${A.left['1280']}/${A.right['1280']} — seats equal, widths moved (the t895 font law, visible in one line)`);

// ---- F4 the text-constants family (t837): the Geist re-pin, receipt-to-receipt ------
const wmRun = R837.runs && R837.runs[0];
const chipRun = R837.chip && R837.chip.runs && R837.chip.runs[0];
ok('F4.a t837 aboard: provenance + both bit-identities',
  R837.provenance && R837.provenance.buildId === SWEEP.build &&
  R837.bitIdentical === true && R837.chip && R837.chip.bitIdentical === true,
  `derived=${wmRun ? wmRun.derived : '?'} chip=${chipRun ? chipRun.derived : '?'}`);
ok('F4.b the Geist pins ride receipt-to-receipt: wordmark 133 / labels 115 / chip 87 (the fallback\u2019s 142/120/90 ride as provenance — the t895 font law\u2019s metrics)',
  wmRun && chipRun &&
  Math.abs(Math.round(wmRun.derived) - 133) <= 0.5 &&
  Math.abs(wmRun.labelsSum - 115) <= 0.5 &&
  Math.abs(Math.round(chipRun.derived) - 87) <= 0.5,
  `wordmark ${wmRun ? wmRun.derived : '?'} / labels ${wmRun ? wmRun.labelsSum : '?'} / chip ${chipRun ? chipRun.derived : '?'}`);
ok('F4.c the tnum variant-witness is aboard (the re-scoped C6): the num\u2019s own rect is the ruler, the canvas advance bounded ≤ 2 and NAMED',
  chipRun && chipRun.numRect > 0 && typeof chipRun.numCanvas === 'number' &&
  Math.abs(chipRun.numCanvas - chipRun.numRect) <= 2,
  `num canvas ${chipRun ? chipRun.numCanvas : '?'} vs rect ${chipRun ? chipRun.numRect : '?'} — Geist\u2019s tabular-nums is the DOM\u2019s alone`);

// ---- F5 the census family (t846): the re-keyed floors, the fossils as provenance -----
const FIVE = ['canvas', 'dashboard', 'inspector', 'palette', 'restore'];
const facesOk = FIVE.every((f) => R846.faces[f] && typeof R846.faces[f].live.pageBtns === 'number');
ok('F5.a t846 aboard: five faces, each with a live pageBtns count',
  facesOk,
  FIVE.map((f) => `${f} ${R846.faces[f] ? R846.faces[f].live.pageBtns : '?'}`).join(', '));
ok('F5.b the floors ride THIS world\u2019s birth census 125/104/147/126 (the t899 re-key; the pre-re-seed fossils 142/114/180/150 priced a world that no longer exists — they ride as provenance, their age law died with it)',
  facesOk &&
  [R846.faces.canvas.live.pageBtns - 125, R846.faces.dashboard.live.pageBtns - 104,
   R846.faces.inspector.live.pageBtns - 147, R846.faces.palette.live.pageBtns - 126].every((d) => d >= 0),
  `floors vs birth census: +${R846.faces.canvas.live.pageBtns - 125}/+${R846.faces.dashboard.live.pageBtns - 104}/+${R846.faces.inspector.live.pageBtns - 147}/+${R846.faces.palette.live.pageBtns - 126} (age within the re-seeded world)`);
const DL = R846.driftLedger || {}, dlFaces = DL.faces || {};
ok('F5.c the ledger\u2019s honesty: the live faces agree with the ledger\u2019s own live numbers (two books, one count)',
  facesOk && FIVE.every((f) => dlFaces[f] && R846.faces[f].live.pageBtns === dlFaces[f].live),
  FIVE.map((f) => `${f} ${R846.faces[f].live.pageBtns}==${dlFaces[f] ? dlFaces[f].live : '?'}`).join(', '));

// ---- F6 the drift ledgers: the reproducibility axis (structure, both instruments) ----
ok('F6.a t837\u2019s ledger: two faces, each carrying prev/live/drift/identical',
  R837.driftLedger && R837.driftLedger.faces &&
  ['wordmark', 'chip'].every((f) => {
    const x = R837.driftLedger.faces[f];
    return x && 'prev' in x && 'live' in x && 'drift' in x && 'identical' in x;
  }),
  `wordmark ${R837.driftLedger && R837.driftLedger.faces.wordmark ? R837.driftLedger.faces.wordmark.prev + '->' + R837.driftLedger.faces.wordmark.live : '?'} / chip ${R837.driftLedger && R837.driftLedger.faces.chip ? R837.driftLedger.faces.chip.prev + '->' + R837.driftLedger.faces.chip.live : '?'}`);
ok('F6.b t846\u2019s ledger: five faces, each carrying prev/live/drift/identical (the census reproducible at the ride level)',
  FIVE.every((f) => {
    const x = dlFaces[f];
    return x && 'prev' in x && 'live' in x && 'drift' in x && 'identical' in x &&
      typeof x.prev === 'number' && typeof x.live === 'number' && typeof x.drift === 'number' && typeof x.identical === 'boolean';
  }),
  FIVE.map((f) => `${f} ${dlFaces[f] ? dlFaces[f].prev + '->' + dlFaces[f].live : '?'}`).join(', '));

// ---- verdict + receipt -----------------------------------------------------------------
const passed = checks.filter((c) => c.pass).length;
const failed = checks.length - passed;
const verdict = failed === 0
  ? `the LIVING family agrees (the t901 re-form): one world key across the sweep, the text-constants ruler, and the census; the GAP law rides the zone receipt-to-receipt (the residue dead by the sweep's own certificate, the TRIGGER's witness keeping its tooth); the two-layer identity holds at the shared anchor at the Geist values; the pinned trio is self-consistent across six widths with the structural seat sequence that survived the font move; the wordmark/labels/chip speak the Geist re-pin 133/115/87 with the tnum variant-witness aboard; the census rides its re-keyed birth floors 125/104/147/126 with the fossils as provenance; and both drift ledgers carry the reproducibility axis. The retired residue trio (t839/t840) and the dead families are named in the headstones — the family audit continues on the sources that still ride`
  : `the family DISAGREES in ${failed} place(s) — reconcile before trusting the living pins`;
const receipt = {
  instrument: 'scripts/t842-family-audit.mjs',
  build: SWEEP.build,
  date: new Date().toISOString(),
  form: 'the t901 re-form — the LIVING family (sweep + t837 + t846); the residue trio retired with headstones',
  headstones: {
    t839: 'RETIRED (the t901 premise audit): the T510 paint residue died with the fallback-font world — t895 measured trigR−chipL = −32.8 (a GAP, not paint) and retired the fix candidate with the experiment as its headstone; t897 cut the GAP law into the sweep. The instrument refuses to ride; its fossil receipt stays untouched as provenance.',
    t840: 'RETIRED (the t901 premise audit): the fix decision table has no subject — the residue is dead (t895/t897). The instrument refuses to ride; its fossil receipt stays untouched as provenance.',
    deadFamilies: 'F1–F7 and F9–F18 of the previous form priced the fallback world (2.7/130/115.3, the painted zone [1280..1286], the birth-squeeze [768,770], the 142.46 natural, the five-way 115.3) — the sweep re-derives the Geist world\u2019s own laws (83/83 at the current pin); the cross-instrument audit continues here on the living sources only.'
  },
  arithmetic: {
    gap: `overlap(1280) = ${z1280.overlap} (the receipt\u2019s own GAP law; the +2.7 paint is provenance)`,
    edge: SWEEP.zone.edge.note,
    textConstants: 'wordmark 133 / labels 115 / chip 87 (the t895 font law\u2019s Geist metrics; the fallback\u2019s 142/120/90 ride as provenance)',
    census: 'floors 125/104/147/126 (the re-seeded world\u2019s birth, the t899 re-key; the fossils 142/114/180/150 as provenance)'
  },
  sources: {
    sweep: { file: 'shots-qa/t834-band-sweep.json', date: SWEEP.date, role: 'the zone/band/pinned laws — the Geist world\u2019s own tables (83/83), the GAP law\u2019s owner' },
    t837: { file: 'shots-qa/t837-wordmark-probe.json', date: R837.provenance ? R837.provenance.date : undefined, role: 'the text-constants family — the Geist re-pin + the tnum variant-witness' },
    t846: { file: 'shots-qa/t846-a11y-maintenance.json', date: R846.date, role: 'the census — the re-keyed floors + the drift ledger (the reproducibility axis)' },
    retired: { t839: 'shots-qa/t839-zone-rehearsal.json (fossil, untouched)', t840: 'shots-qa/t840-options-rehearsal.json (fossil, untouched)' }
  },
  checks, passed, failed, total: checks.length,
  verdict,
};
writeFileSync('shots-qa/t842-family-audit.json', JSON.stringify(receipt, null, 2) + '\n');
for (const c of checks) console.log(`${c.pass ? ' ✓' : '✗ FAIL'}  ${c.name}  ${c.detail}`);
console.log(`\nFAMILY-AUDIT t842: ${passed}/${checks.length}${failed ? ' RED' : ' green'}`);
process.exit(failed ? 1 : 0);

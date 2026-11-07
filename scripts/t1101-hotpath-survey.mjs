#!/usr/bin/env node
// t1101 — THE #8 DEEP BAND's numeric instrument (the t1096-hotpath
// doctrine: numbers before touching). The particles route's three phases,
// timed on a representative star (13k rows, the t904 doc's own scale):
//   parse      text → { optics, rows }        (t904: cached since t904)
//   decode     rows → typed records          (t1101's split — was per-request)
//   ownership  existsSync per DISTINCT stack (per-request by policy)
// and the two regimes' per-request math:
//   before (t904): parse + decode + ownership — every page fetch
//   after  (t1101): statSync hit + ownership — the decode rides the
//                   parse's cache slot
// The instrument is honest about its own scope: the numbers measure the
// LIB functions directly (the same seats the route rides — the t653
// law), not the HTTP layer; the route's door/BFS/DB costs are common to
// both regimes and cancel in the comparison.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  decodeParticlesRows,
  parseParticlesStarText,
} from "@/lib/particles-star";

const WORKDIR = "/tmp/t1101-survey-workdir";
const STAR = join(WORKDIR, "particles.star");
const ROWS = 13000;
const MICS = 340; // distinct micrographs → distinct stacks (the storm's collapse target)

// --- synthesize the representative star -------------------------------
if (!existsSync(STAR)) {
  mkdirSync(WORKDIR, { recursive: true });
  const lines = [
    "data_optics", "loop_",
    "_rlnOpticsGroup #1", "_rlnImagePixelSize #2", "_rlnVoltage #3",
    "_rlnSphericalAberration #4", "_rlnAmplitudeContrast #5", "_rlnImageSize #6",
    "1 1.24 300 2.7 0.1 256",
    "", "data_particles", "loop_",
    "_rlnImageName #1", "_rlnMicrographName #2", "_rlnCoordinateX #3",
    "_rlnCoordinateY #4", "_rlnCtfFigureOfMerit #5", "_rlnCtfMaxResolution #6",
  ];
  for (let i = 1; i <= ROWS; i++) {
    const mic = (i % MICS) + 1;
    lines.push(
      `${String(i).padStart(6, "0")}@${WORKDIR}/stacks/mic_${String(mic).padStart(4, "0")}.mrcs ` +
      `MotionCorr/job002/mic_${String(mic).padStart(4, "0")}.mrc ` +
      `${(i * 37 % 512).toFixed(1)} ${(i * 91 % 512).toFixed(1)} ` +
      `${(0.2 + (i % 40) / 100).toFixed(3)} ${(2 + (i % 25) / 10).toFixed(1)}`
    );
  }
  writeFileSync(STAR, lines.join("\n") + "\n");
}

const text = (await import("node:fs")).readFileSync(STAR, "utf8");
const starKB = Math.round(text.length / 1024);

// --- the ownership phase, reproduced at the route's shape -------------
const { existsSync: es } = await import("node:fs");
const ownershipOf = (decoded) => {
  const memo = new Map();
  for (const d of decoded) {
    if (!memo.has(d.stackAbs)) memo.set(d.stackAbs, es(d.stackAbs));
  }
  return memo;
};

// --- warm once (JIT fair), then measure 5 runs each -------------------
const runs = 5;
const time = (fn) => {
  const xs = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const r = fn();
    xs.push(performance.now() - t0);
    if (i === 0 && r === undefined) throw new Error("no value");
  }
  xs.sort((a, b) => a - b);
  return { min: xs[0], med: xs[Math.floor(runs / 2)], max: xs[runs - 1] };
};

const ms = (x) => `${x.toFixed(2)}ms`;

const parsed0 = parseParticlesStarText(text);
const decoded0 = decodeParticlesRows(parsed0.rows, WORKDIR);
console.log(`star: ${starKB} KB · ${parsed0.rows.length} rows · ${decoded0.length} decoded · ${new Set(decoded0.map(d => d.stackAbs)).size} distinct stacks`);

const tParse = time(() => parseParticlesStarText(text));
const tDecode = time(() => decodeParticlesRows(parsed0.rows, WORKDIR));
const tOwn = time(() => ownershipOf(decoded0));
const stat = process.report ? 0 : 0;

// the per-request regimes (page fetch = the route's own work):
const oldReq = tParse.med + tDecode.med + tOwn.med;
const newReq = tOwn.med + 0.01; // + one statSync (~µs, invisible at this scale)
console.log(`\nphase timings (median of ${runs}):`);
console.log(`  parse      ${ms(tParse.med)}  (min ${ms(tParse.min)} · max ${ms(tParse.max)})`);
console.log(`  decode     ${ms(tDecode.med)}  (min ${ms(tDecode.min)} · max ${ms(tDecode.max)})`);
console.log(`  ownership  ${ms(tOwn.med)}  (min ${ms(tOwn.min)} · max ${ms(tOwn.max)})`);
console.log(`\nper-request math (the phases the HTTP layer shares cancel):`);
console.log(`  before t904: parse+decode+ownership = ${ms(oldReq)}`);
console.log(`  after  t1101: stat-hit+ownership     = ~${ms(newReq)}`);
console.log(`  the per-request saving: ~${(oldReq / newReq).toFixed(0)}x`);
console.log(`  at the 1–2s poll cadence: ~${((oldReq - newReq) * 30 / 1000).toFixed(1)}s of CPU saved per minute per open browser (the class2d/3d star re-reads)`);
console.log(`\nVERDICT: ${tDecode.med > tOwn.med * 3 ? "the decode IS the deep band — the split is earned" : "the decode is marginal — record and reconsider"}`);

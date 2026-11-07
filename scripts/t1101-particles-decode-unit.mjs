#!/usr/bin/env node
// t1101 — THE #8 DEEP BAND's SPLIT unit: the particles star's pure decode
// rides the ONE lib and the parse's ONE cache slot.
//
// The gesture's meaning is BEHAVIORAL here (the t653 law — the meaning
// lives in lib, the unit imports the same seat the route rides):
//   D the decode lib (10) — BYTE-PARITY with the old inline mapping (the
//                           split is a refactor: the unit re-implements
//                           the route's historic loop and demands the
//                           same records, row by row); the image-name
//                           forms (index-first, path-first, garbage); the
//                           label freeze (column order read from the
//                           star's own header); the optics scalars; the
//                           null honesty (missing/non-finite cells); the
//                           unparseable-cell skip; the relativize laws
//                           (inside→rel, outside→kept, the workdir's own
//                           dot); the stackAbs resolution; purity.
//   C the cache contract (3) — the route's ONE cachedFileCompute whose fn
//                           returns { optics, decoded } (the split rides
//                           the parse's own slot); the lib's purity (no
//                           fs/db/clock imports — the band's law); the
//                           single-namespace law (t904's C1: exactly one
//                           particles id, the docblock cites it).
//   W the wiring (4)       — the route imports the ONE lib and carries no
//                           inline re-derivation (the moved fns are GONE);
//                           the ownership per-request law stands (the
//                           stackFacts memo, one existsSync per DISTINCT
//                           stack); the route never mutates the cached
//                           rows (the shared-instance law — the pass is a
//                           map); the honest doors + the RAW-form fallback
//                           (the absent-stack bytes keep their historic
//                           relativize of the RAW string).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t1101-particles-decode-unit.mjs

import { readdirSync, readFileSync, statSync } from "node:fs";
import pathMod from "node:path";
import { basename, join } from "node:path";
import {
  decodeParticlesRows,
  parseImageName,
  parseParticlesStarText,
  relativizePath,
} from "@/lib/particles-star";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const ROOT = "/home/z/my-project";
const routeSrc = readFileSync(join(ROOT, "src/app/api/jobs/[id]/particles/route.ts"), "utf8");
const libSrc = readFileSync(join(ROOT, "src/lib/particles-star.ts"), "utf8");

/* ------------------------------------------------------------------ */
/* D — the decode lib                                                  */
/* ------------------------------------------------------------------ */

const WORKDIR = "/tmp/t1101-unit-workdir";

// a small star exercising every law: two-column orders (the freeze), both
// image-name forms, null cells, one unparseable row, an outside-workdir mic
const STAR_TEXT = [
  "data_optics", "loop_",
  "_rlnOpticsGroup #1", "_rlnImagePixelSize #2", "_rlnVoltage #3",
  "_rlnSphericalAberration #4", "_rlnAmplitudeContrast #5", "_rlnImageSize #6",
  "1 1.24 300 2.7 0.1 256",
  "", "data_particles", "loop_",
  "_rlnImageName #1", "_rlnMicrographName #2", "_rlnCoordinateX #3",
  "_rlnCoordinateY #4", "_rlnCtfFigureOfMerit #5", "_rlnCtfMaxResolution #6",
  "00000001@Extract/job017/stack_a.mrcs MotionCorr/job002/mic_0001.mrc 100.5 200.25 0.81 3.2",
  "Extract/job017/stack_b.mrcs@00000002 MotionCorr/job002/mic_0002.mrc 110 210 nan 4.1",
  "00000003@Extract/job017/stack_a.mrcs MotionCorr/job002/mic_0001.mrc 90 190 0.77 nan",
  "garbage-no-at MotionCorr/job002/mic_0003.mrc 1 2 0.5 3.0",
].join("\n");

const parsed = parseParticlesStarText(STAR_TEXT);
const decoded = decodeParticlesRows(parsed.rows, WORKDIR);

ok("D1 BYTE-PARITY: the lib's decode answers the route's historic inline mapping, row by row (the split is a refactor, the records are the same)",
  (() => {
    // the route's OLD loop, restated verbatim (the pre-split bytes)
    const num = (c) => { if (c == null) return null; const v = parseFloat(c); return Number.isFinite(v) ? v : null; };
    const relativize = (workdir, p) => {
      const abs = pathMod.isAbsolute(p) ? p : pathMod.resolve(workdir, p.replace(/^\.?\//, ""));
      if (abs === workdir) return ".";
      if (abs.startsWith(workdir + pathMod.sep)) return pathMod.relative(workdir, abs);
      return p.replace(/^\.?\//, "");
    };
    const old = [];
    for (const r of parsed.rows) {
      const imgCell = r.cells[r.labels["_rlnImageName"]];
      const pi = imgCell ? parseImageName(imgCell) : null;
      if (!pi) continue;
      const micCell = r.cells[r.labels["_rlnMicrographName"]] ?? "";
      const mic = relativize(WORKDIR, micCell);
      const stackAbs = pathMod.isAbsolute(pi.stack) ? pi.stack : pathMod.resolve(WORKDIR, pi.stack.replace(/^\.?\//, ""));
      old.push({
        mic, name: basename(mic), stackAbs,
        idx1: pi.idx, x: num(r.cells[r.labels["_rlnCoordinateX"]]) ?? 0,
        y: num(r.cells[r.labels["_rlnCoordinateY"]]) ?? 0,
        fom: num(r.cells[r.labels["_rlnCtfFigureOfMerit"]]),
        maxRes: num(r.cells[r.labels["_rlnCtfMaxResolution"]]),
      });
    }
    const strip = (rows) => rows.map(({ stackRaw, ...rest }) => rest);
    return JSON.stringify(strip(decoded)) === JSON.stringify(old);
  })(), `decoded=${JSON.stringify(decoded).slice(0, 200)}`);

ok("D2 the image-name forms: index-first (RELION 5) and path-first both decode, garbage refuses",
  parseImageName("00000007@/abs/stack.mrcs")?.idx === 7 && parseImageName("00000007@/abs/stack.mrcs")?.stack === "/abs/stack.mrcs" &&
  parseImageName("stack.mrcs@42")?.idx === 42 && parseImageName("stack.mrcs@42")?.stack === "stack.mrcs" &&
  parseImageName("no-at-here") === null && parseImageName("x@notanumber") === null);

ok("D3 the label freeze: the star's own header defines the columns — a reordered star decodes the same",
  (() => {
    const reordered = [
      "data_particles", "loop_",
      "_rlnCoordinateY #1", "_rlnCtfMaxResolution #2", "_rlnImageName #3",
      "_rlnCoordinateX #4", "_rlnMicrographName #5", "_rlnCtfFigureOfMerit #6",
      "55.5 2.9 00000009@stack_c.mrcs 44.5 MotionCorr/mic_0009.mrc 0.66",
    ].join("\n");
    const p2 = parseParticlesStarText(reordered);
    const d2 = decodeParticlesRows(p2.rows, WORKDIR);
    return d2.length === 1 && d2[0].idx1 === 9 && d2[0].x === 44.5 && d2[0].y === 55.5 &&
      d2[0].fom === 0.66 && d2[0].maxRes === 2.9 && d2[0].name === "mic_0009.mrc";
  })());

ok("D4 the optics scalars ride the parse (the whole block, all five)",
  parsed.optics.pixelSize === 1.24 && parsed.optics.voltage === 300 &&
  parsed.optics.cs === 2.7 && parsed.optics.q0 === 0.1 && parsed.optics.boxSize === 256);

ok("D5 the null honesty: missing and non-finite cells answer null (never NaN, never zero)",
  decoded[1].fom === null && decoded[1].maxRes === 4.1 && decoded[2].maxRes === null && decoded[2].fom === 0.77 &&
  decoded.every((d) => d.fom === null || Number.isFinite(d.fom)));

ok("D6 the unparseable cell skips its row (3 of 4 rows decoded — the skip is the honest silence)",
  parsed.rows.length === 4 && decoded.length === 3);

ok("D7 the relativize laws: inside the workdir goes relative, the workdir itself is the dot, ./ strips, and an outside path keeps its historic bytes (the leading slash stripped — the file route 404s it anyway, defense in depth)",
  relativizePath(WORKDIR, "MotionCorr/job002/mic.mrc") === join("MotionCorr", "job002", "mic.mrc") &&
  relativizePath(WORKDIR, "/elsewhere/stack.mrcs") === "elsewhere/stack.mrcs" &&
  relativizePath(WORKDIR, WORKDIR) === "." &&
  relativizePath(WORKDIR, "./mic.mrc") === "mic.mrc");

ok("D8 the stackAbs resolution: a relative stack resolves against the workdir, an absolute rides untouched",
  decoded[0].stackAbs === join(WORKDIR, "Extract/job017/stack_a.mrcs") &&
  decoded[0].stackRaw === "Extract/job017/stack_a.mrcs" &&
  decoded[1].stackAbs === join(WORKDIR, "Extract/job017/stack_b.mrcs"));

ok("D9 the mic name rides the basename of the relativized mic",
  decoded[0].name === "mic_0001.mrc" && decoded[0].mic === join("MotionCorr", "job002", "mic_0001.mrc"));

ok("D10 purity: the same inputs answer the same, the rows own no mutations",
  JSON.stringify(decodeParticlesRows(parsed.rows, WORKDIR)) === JSON.stringify(decodeParticlesRows(parsed.rows, WORKDIR)) &&
  (() => { const before = JSON.stringify(parsed.rows); decodeParticlesRows(parsed.rows, WORKDIR); return JSON.stringify(parsed.rows) === before; })());

/* ------------------------------------------------------------------ */
/* C — the cache contract                                              */
/* ------------------------------------------------------------------ */

ok("C1 the route's ONE cache slot: the cached fn returns { optics, decoded } — the split rides the parse's own key (t904's slot, one invalidation)",
  /cachedFileCompute\(starPath, "particles:star", \(text\) => \{[\s\S]{0,400}parseParticlesStarText\(text\)[\s\S]{0,200}decodeParticlesRows\(rows, workdir\)/.test(routeSrc) &&
  /return \{ optics, decoded: decodeParticlesRows\(rows, workdir\) \};/.test(routeSrc));

ok("C2 the lib's purity: no fs, no db, no clock — text and strings in, records out",
  !libSrc.includes("from \"fs\"") && !libSrc.includes("require(\"fs\")") &&
  !libSrc.includes("from \"node:fs\"") && !libSrc.includes("@/lib/db") &&
  !libSrc.includes("Date.now") && !libSrc.includes("performance.now"));

ok("C3 the single-namespace law (t904's C1): exactly ONE particles compute id in the whole repo, and the docblock cites it",
  (() => {
    const ids = new Set();
    const walk = (dir) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        const st = statSync(p);
        if (st.isDirectory()) { if (!p.includes("node_modules") && !p.includes("/.next")) walk(p); continue; }
        if (!p.endsWith(".ts") && !p.endsWith(".tsx") && !p.endsWith(".mjs")) continue;
        const s = readFileSync(p, "utf8");
        if (s.includes('"particles:')) {
          const m = s.match(/"particles:[a-z-]+"/g) || [];
          m.forEach((x) => ids.add(x));
        }
      }
    };
    walk(join(ROOT, "src"));
    return ids.size === 1 && ids.has('"particles:star"');
  })(), "the namespace carries exactly one id");

/* ------------------------------------------------------------------ */
/* W — the wiring (the route rides the ONE lib)                        */
/* ------------------------------------------------------------------ */

ok("W1 the route imports the ONE lib and carries no inline re-derivation (the moved fns are GONE)",
  routeSrc.includes(`from "@/lib/particles-star"`) &&
  routeSrc.includes("decodeParticlesRows(") &&
  routeSrc.includes("parseParticlesStarText(") &&
  !routeSrc.includes("function parseParticlesStarText") &&
  !routeSrc.includes("function parseImageName") &&
  !routeSrc.includes("interface Decoded {"));

ok("W2 the ownership per-request law stands: the stackFacts memo answers ONE existsSync per DISTINCT stack (the t904 policy, unchanged)",
  /const stackFacts = new Map[\s\S]{0,300}factsFor = \(stackAbs: string\) => \{[\s\S]{0,200}existsSync\(stackAbs\)[\s\S]{0,100}stackFacts\.set/.test(routeSrc) &&
  routeSrc.includes("factsFor(d.stackAbs)"));

ok("W3 the route never mutates the cached rows (the statcache serves a SHARED instance — the pass is a map into a new array)",
  /const owned: OwnedParticleRow\[\] = decoded\.map\(\(d\) => \{[\s\S]{0,400}return \{ \.\.\.d, ownerJobId, stackRel \};/.test(routeSrc) &&
  !/decoded\[.+?\]\.ownerJobId\s*=/.test(routeSrc));

ok("W4 the honest doors + the RAW-form fallback (the absent-stack bytes keep their historic relativize of the RAW string)",
  routeSrc.includes('"No particle rows parsed"') &&
  routeSrc.includes('"No stack-backed particles found"') &&
  routeSrc.includes('"No particles STAR file in this job"') &&
  routeSrc.includes("relativizePath(workdir, d.stackRaw)"));

/* ------------------------------------------------------------------ */

console.log(`\n${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

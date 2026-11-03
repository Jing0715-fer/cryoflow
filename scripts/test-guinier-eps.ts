/**
 * Verify parseGuinierEps — t597 rewrite: the round-trip, not the relic.
 *
 * The old test read a real RELION postprocess EPS from a long-deleted
 * world (data/relion/cmto3ts7j…) — when that world was cleaned up the
 * fixture died with it and the test crashed with ENOENT (caught live this
 * window). A test that depends on a graveyard is a test that only runs by
 * accident. This rewrite is self-contained:
 *
 *   A. the round trip — synthesize a CPlot2D-grammar EPS from an ANALYTIC
 *      guinier curve (the generator and the parser speak the same file
 *      format from opposite ends), parse it back, and compare per-point
 *      against the analytic source. Stronger than the old "looks sane"
 *      checks: it validates the parser's grid-calibration arithmetic
 *      against known ground truth, not just its survival instincts.
 *   B. the guard rails — empty text, curve-only EPS (no grid), a single
 *      x tick (calibration needs ≥2) must all return null so the route
 *      degrades to the empty response instead of lying.
 *   C. the legacy mode — pass a REAL postprocess EPS as argv[1] and the
 *      old sanity checks (monotonic x, y inside the printed axis range)
 *      still run, for whenever a genuine RELION 5.0 file is at hand.
 *
 * Usage: npx tsx scripts/test-guinier-eps.ts [real-postprocess.eps]
 */
import { existsSync, readFileSync } from "node:fs";
import { parseGuinierEps } from "../src/lib/relion/guinier-eps";

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, note: string = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};

/* ---- A. the synthetic CPlot2D writer ------------------------------------- */
/* The parser's contract (src/lib/relion/guinier-eps.ts): gray RELATIVE
 * dash strokes are the grid, ABSOLUTE moveto/lineto polylines are the data,
 * centered `show` lines are x tick labels, right-aligned ones are y tick
 * labels, colour arrives at the END of each stroke block. The generator
 * obeys that grammar exactly and draws through the SAME affine the parser
 * will have to re-fit — so recovered values must equal the source values
 * up to text quantization. */
const N_PTS = 40;
const X0 = 0.01, X1 = 0.15;          // data space, 1/Å²
const Y0 = -16, Y1 = -4;             // data space, ln amplitude
const PX0 = 90, PX1 = 540;           // plot area on the canvas (PostScript pts)
const PY0 = 90, PY1 = 540;

const canvasX = (x: number) => PX0 + ((x - X0) / (X1 - X0)) * (PX1 - PX0);
const canvasY = (y: number) => PY0 + ((y - Y0) / (Y1 - Y0)) * (PY1 - PY0);
/* both series must stay INSIDE the printed axis range — the parser filters
 * strokes outside the grid extents (legend rejection) by design, so a
 * synthetic curve that overflows the axis is silently dropped (first run's
 * sharpened Δ was NaN for exactly this reason — author's bug, not the
 * parser's). Keep original mid-axis, +2 offset stays under the ceiling. */
const lnAmpAt = (x: number) => -6 - 55 * x + 0.8 * Math.sin(40 * x);
const sharpenedAt = (x: number) => lnAmpAt(x) + 2.0;

const num = (v: number) => v.toFixed(4).replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
// keep the regex-fed grammar happy: plain decimals, no exponents, no commas
const dec = (v: number) => {
  const s = v.toFixed(4);
  return s === "-0.0000" ? "0.0000" : s;
};

const XTICKS = [0.01, 0.03, 0.05, 0.07, 0.09, 0.11, 0.13, 0.15];
const YTICKS = [-16, -14, -12, -10, -8, -6, -4];

function vGrid(cx: number): string {
  const dashes = Array.from({ length: 12 }, () => `0 ${dec((PY1 - PY0) / 12)} rlineto`);
  return ["newpath", `${dec(cx)} ${dec(PY0)} moveto`, ...dashes, "0.8 0.8 0.8 setrgbcolor", "stroke", ""].join("\n");
}
function hGrid(cy: number): string {
  const dashes = Array.from({ length: 12 }, () => `${dec((PX1 - PX0) / 12)} 0 rlineto`);
  return ["newpath", `${dec(PX0)} ${dec(cy)} moveto`, ...dashes, "0.8 0.8 0.8 setrgbcolor", "stroke", ""].join("\n");
}
const xLabel = (v: number) =>
  `${dec(canvasX(v))} 60 moveto\n(${v.toFixed(2)}) dup stringwidth pop 2 div neg 0 rmoveto show\n`;
const yLabel = (v: number) =>
  `40 ${dec(canvasY(v))} moveto\n(${v.toFixed(0)}) dup stringwidth pop neg 0 rmoveto show\n`;
function series(vals: Array<[number, number]>, color: string): string {
  const pts = vals.map(([x, y], i) => `${dec(canvasX(x))} ${dec(canvasY(y))} ${i === 0 ? "moveto" : "lineto"}`);
  return ["newpath", ...pts, color, "stroke", ""].join("\n");
}

function synthesizeEps(): string {
  // author's own guard: every data point lands inside the plot area
  const xs = Array.from({ length: N_PTS }, (_, i) => X0 + (i * (X1 - X0)) / (N_PTS - 1));
  for (const x of xs) {
    for (const y of [lnAmpAt(x), sharpenedAt(x)]) {
      if (!(y > Y0 && y < Y1)) throw new Error(`synthetic curve overflows the axis at x=${x}: ${y}`);
    }
  }
  const parts: string[] = ["%!PS-Adobe-3.0 EPSF-3.0", "%%BoundingBox: 0 0 612 792", "%% CPlot2D-shaped synthetic guinier plot (t597)", ""];
  for (const v of XTICKS) parts.push(vGrid(canvasX(v)));
  for (const v of YTICKS) parts.push(hGrid(canvasY(v)));
  for (const v of XTICKS) parts.push(xLabel(v));
  for (const v of YTICKS) parts.push(yLabel(v));
  parts.push(series(xs.map((x) => [x, lnAmpAt(x)]), "0 0 0 setrgbcolor"));      // black = original
  parts.push(series(xs.map((x) => [x, sharpenedAt(x)]), "0 0 1 setrgbcolor"));  // blue  = sharpened
  parts.push("showpage");
  return parts.join("\n");
}

console.log("[A] the round trip — analytic curve, written as CPlot2D, read back");
{
  const eps = synthesizeEps();
  const pts = parseGuinierEps(eps);
  check("parser accepts the synthetic EPS", !!pts && pts.length > 0, `${pts?.length ?? 0} points`);
  if (pts && pts.length === N_PTS) {
    const xs = Array.from({ length: N_PTS }, (_, i) => X0 + (i * (X1 - X0)) / (N_PTS - 1));
    const tolX = 1e-4, tolY = 1e-3;
    const worstX = Math.max(...pts.map((p, i) => Math.abs(p.x - xs[i])));
    const worstY = Math.max(...pts.map((p, i) => Math.abs(p.lnAmp - lnAmpAt(xs[i]))));
    const worstS = Math.max(...pts.map((p, i) => Math.abs((p.lnAmpSharpened ?? NaN) - sharpenedAt(xs[i]))));
    const mono = pts.every((p, i) => i === 0 || p.x > pts[i - 1].x);
    // 1e-4, not 1e-6: toFixed(4) canvas quantization is ~2.7e-6 in data units
    // per point, and both endpoints of the difference carry it. Wrong-x
    // pairing would miss by ~0.5 (the wiggle's slope) — 1e-4 still convicts.
    // (First run had the sign flipped — sharpened − original + 2 — which read
    // the EXACT +2.0 offset as a 4.0 deviation: the assertion convicted the
    // truth. Debug script's constant 4.000e+0 was the fingerprint.)
    const offset = pts.every((p) => Math.abs((p.lnAmpSharpened ?? NaN) - p.lnAmp - 2.0) < 1e-4);
    check(`all ${N_PTS} x values recovered (tol ${tolX})`, worstX < tolX, `worst Δ ${worstX.toExponential(2)}`);
    check("original series recovered (tol 1e-3)", worstY < tolY, `worst Δ ${worstY.toExponential(2)}`);
    check("sharpened series recovered (tol 1e-3)", worstS < tolY, `worst Δ ${worstS.toExponential(2)}`);
    check("x strictly increasing", mono);
    check("sharpened is original + the synthetic 2.0 offset, paired per x", offset);
  } else {
    check(`round trip returned ${N_PTS} points`, false, `got ${pts?.length ?? "null"}`);
  }
}

/* ---- B. the guard rails --------------------------------------------------- */
console.log("\n[B] the guard rails — degenerate inputs degrade to null");
{
  check("empty text → null", parseGuinierEps("") === null);
  check("curve-only EPS (no grid, no labels) → null", parseGuinierEps(
    ["newpath", "10 10 moveto", "20 20 lineto", "0 0 0 setrgbcolor", "stroke"].join("\n")) === null);
  const oneTick = [
    "newpath", `${dec(canvasX(0.03))} ${dec(PY0)} moveto`, "0 30 rlineto", "0.8 0.8 0.8 setrgbcolor", "stroke",
    "newpath", `${dec(PX0)} ${dec(canvasY(-8))} moveto`, "30 0 rlineto", "0.8 0.8 0.8 setrgbcolor", "stroke",
    "(0.03) dup stringwidth pop 2 div neg 0 rmoveto show",
    "(-8) dup stringwidth pop neg 0 rmoveto show",
  ].join("\n");
  check("a single x tick cannot calibrate (needs ≥2) → null", parseGuinierEps(oneTick) === null);
}

/* ---- C. the legacy mode — a real RELION EPS, when one exists --------------- */
const realPath = process.argv[2];
console.log(`\n[C] legacy real-file mode${realPath ? ` — ${realPath}` : " — no real EPS supplied (skipped)"}`);
if (realPath) {
  if (!existsSync(realPath)) {
    check("real EPS exists", false, realPath);
  } else {
    const pts = parseGuinierEps(readFileSync(realPath, "utf8"));
    check("real EPS parsed", !!pts && pts.length > 0, `${pts?.length ?? 0} points`);
    if (pts && pts.length) {
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.lnAmp);
      const mono = xs.every((v, i) => i === 0 || v >= xs[i - 1] - 1e-9);
      const inRange = ys.every((v) => v >= -16.5 && v <= -3.5);
      const sharp = pts.filter((q) => q.lnAmpSharpened !== null).length;
      check("real x monotonic", mono);
      check("real y inside the printed axis range (-16.5..-3.5)", inRange);
      check("real sharpened series present", sharp > 0, `${sharp}/${pts.length}`);
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

/**
 * CryoFlow — RELION 5 Guinier EPS extractor (SERVER ONLY).
 *
 * RELION 3/4 wrote `postprocess.guinier` — a plain numeric table the API
 * used to parse directly. RELION 5.0 ships ONLY the plot as PostScript
 * (`postprocess_guinier.eps`), so on every current install the Guinier
 * chart came up empty. The EPS, however, embeds the full data as absolute
 * `lineto` polylines (CPlot2D output) over a dashed grid whose lines pair
 * 1:1 with the axis tick labels — so the original data values can be
 * recovered exactly by:
 *
 *   1. collecting the dashed grid lines (gray, RELATIVE rlineto strokes)
 *      → canvas positions of the x / y ticks;
 *   2. reading the tick label VALUES from the `show`n strings (drawn in
 *      axis order) → data-space calibration for both axes;
 *   3. least-squares fitting canvas → data affinely per axis;
 *   4. converting the DATA polylines (ABSOLUTE moveto/lineto) back into
 *      (1/d², ln amplitude) points. Stroke colour identifies the series:
 *      black = _rlnLogAmplitudesOriginal, blue = …Sharpened (red =
 *      …Weighted is the weighting transient — not part of the table).
 *
 * Everything is best-effort: any structural surprise returns null and the
 * route degrades to the empty response (same as a missing file).
 */

export interface GuinierEpsPoint {
  /** 1/d² in Å⁻² */
  x: number;
  lnAmp: number;
  lnAmpSharpened: number | null;
}

interface Polyline {
  color: [number, number, number];
  pts: Array<[number, number]>;
}

const NUM_LINE = /^(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (moveto|lineto)$/;
const RLINE = /^(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) rlineto$/;
const COLOR = /^(\d*\.?\d+) (\d*\.?\d+) (\d*\.?\d+) setrgbcolor$/;
const SHOW_X = /^\(([^)]*)\) dup stringwidth pop 2 div neg 0 rmoveto show$/; // centered → x axis
const SHOW_Y = /^\(([^)]*)\) dup stringwidth pop neg 0 rmoveto show$/; // right-aligned → y axis

const GRAY = 0.8;

function nearly(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

/** Least-squares fit of y = a·x + b; null when degenerate. */
function affineFit(pairs: Array<[number, number]>): { a: number; b: number } | null {
  const n = pairs.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const [x, y] of pairs) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  return { a, b };
}

export function parseGuinierEps(text: string): GuinierEpsPoint[] | null {
  try {
    const lines = text.split(/\r?\n/);

    // ---- walk the file: grid segments, data polylines, tick labels -------
    // CPlot2D emits one stroke block per dash / tick / curve:
    //   <absolute moveto> [<absolute lineto>…] [<relative rlineto>…]
    //   <setlinewidth> <setrgbcolor> <stroke>
    // The colour arrives at the END of each block, so blocks are committed
    // on `stroke` with the pending colour — collecting then, not earlier.
    const vGridX = new Set<number>(); // canvas x of vertical dashed grid lines
    const hGridY = new Set<number>(); // canvas y of horizontal dashed grid lines
    const xLabels: number[] = []; // x tick values, drawing order (left→right)
    const yLabels: number[] = []; // y tick values, drawing order (top→bottom)
    const polylines: Polyline[] = [];

    let pathPts: Array<[number, number]> = []; // absolute pen positions
    let rels: Array<[number, number]> = []; // relative deltas of the block
    let pendingColor: [number, number, number] | null = null;

    const commit = () => {
      if (pendingColor) {
        const [r, g, b] = pendingColor;
        if (pathPts.length >= 2 && rels.length === 0) {
          // absolute polyline = a data curve
          polylines.push({ color: pendingColor, pts: pathPts });
        } else if (rels.length > 0 && pathPts.length >= 1 && nearly(r, GRAY) && nearly(g, GRAY) && nearly(b, GRAY)) {
          // dashed stroke = grid; vertical dashes mark x ticks, horizontal y
          let [cx, cy] = pathPts[0];
          for (const [dx, dy] of rels) {
            if (nearly(dx, 0) && !nearly(dy, 0)) vGridX.add(cx);
            if (nearly(dy, 0) && !nearly(dx, 0)) hGridY.add(cy);
            cx += dx;
            cy += dy;
          }
        }
      }
      pathPts = [];
      rels = [];
      pendingColor = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();

      const num = NUM_LINE.exec(t);
      if (num) {
        if (num[3] === "moveto") {
          // every stroke block starts at its moveto — flush any stray pen
          commit(); // resets only pending bookkeeping if never stroked
          pathPts = [[parseFloat(num[1]), parseFloat(num[2])]];
        } else {
          pathPts.push([parseFloat(num[1]), parseFloat(num[2])]);
        }
        continue;
      }

      const rel = RLINE.exec(t);
      if (rel) {
        rels.push([parseFloat(rel[1]), parseFloat(rel[2])]);
        continue;
      }

      const col = COLOR.exec(t);
      if (col) {
        pendingColor = [parseFloat(col[1]), parseFloat(col[2]), parseFloat(col[3])];
        continue;
      }

      if (t === "stroke") {
        commit();
        continue;
      }

      const sx = SHOW_X.exec(t);
      if (sx && Number.isFinite(parseFloat(sx[1]))) {
        xLabels.push(parseFloat(sx[1]));
        continue;
      }
      const sy = SHOW_Y.exec(t);
      if (sy && Number.isFinite(parseFloat(sy[1]))) {
        yLabels.push(parseFloat(sy[1]));
        continue;
      }
      // everything else (rotate/show/findfont/newpath/…) is ignored
    }

    // ---- axis calibration --------------------------------------------------
    // Pair grid lines with tick labels by ascending order on BOTH sides —
    // invariant to the direction RELION happens to draw the labels in
    // (the y labels go bottom→top, the x labels left→right).
    const vX = [...vGridX].sort((a, b) => a - b);
    const hY = [...hGridY].sort((a, b) => a - b);
    const xVals = [...xLabels].sort((a, b) => a - b);
    const yVals = [...yLabels].sort((a, b) => a - b);
    if (vX.length < 2 || hY.length < 2 || xVals.length < 2 || yVals.length < 2) return null;

    // grid lines pair 1:1 with tick labels in axis order; tolerate minor
    // mismatches by trimming the longer side from its tail (extra edge tick)
    const pair = (a: number[], b: number[]): Array<[number, number]> | null => {
      let aa = [...a];
      let bb = [...b];
      while (aa.length > bb.length) aa.pop();
      while (bb.length > aa.length) bb.pop();
      if (aa.length < 2) return null;
      return aa.map((v, k) => [v, bb[k]] as [number, number]);
    };

    const xPairs = pair(vX, xVals);
    const yPairs = pair(hY, yVals);
    if (!xPairs || !yPairs) return null;
    const fx = affineFit(xPairs);
    const fy = affineFit(yPairs);
    if (!fx || !fy) return null;

    // ---- series extraction -------------------------------------------------
    const isBlack = (c: [number, number, number]) => nearly(c[0], 0) && nearly(c[1], 0) && nearly(c[2], 0);
    const isBlue = (c: [number, number, number]) => nearly(c[0], 0) && nearly(c[1], 0) && nearly(c[2], 1);

    // plot-area bounds (grid extents) — data strokes live inside them; the
    // legend swatches below the axes do not
    const xLo = Math.min(...vX);
    const xHi = Math.max(...vX);
    const yLo = Math.min(...hY);
    const yHi = Math.max(...hY);

    const toSeries = (match: (c: [number, number, number]) => boolean): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (const pl of polylines) {
        if (!match(pl.color)) continue;
        for (const [cx, cy] of pl.pts) {
          if (cx < xLo - 1 || cx > xHi + 1 || cy < yLo - 1 || cy > yHi + 1) continue;
          out.push([fx.a * cx + fx.b, fy.a * cy + fy.b]);
        }
      }
      out.sort((p, q) => p[0] - q[0]);
      return out;
    };

    const original = toSeries(isBlack);
    if (original.length === 0) return null;
    const sharpened = toSeries(isBlue);
    const sharpByX = new Map(sharpened.map(([x, y]) => [x.toFixed(6), y]));

    const points: GuinierEpsPoint[] = original.map(([x, y]) => ({
      x,
      lnAmp: y,
      lnAmpSharpened: sharpByX.get(x.toFixed(6)) ?? null,
    }));
    return points.length > 0 ? points : null;
  } catch {
    return null;
  }
}

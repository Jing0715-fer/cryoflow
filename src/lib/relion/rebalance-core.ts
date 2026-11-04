/**
 * Orientation Rebalancer core — TypeScript port of
 * github.com/Jing0715-fer/Orient-Rebalancer (src/lib/rebalance.ts + fsc.ts).
 *
 * 3DFSC-aware orientation balancing for cryo-EM particle stacks:
 *   - Euler → viewing direction, Fibonacci-sphere binning
 *   - saturating resolution model (count → Å) as a 3DFSC ESTIMATE
 *   - per-bin percentile trimming (standard / resolution-weighted modes)
 *   - seeded-RNG exclusion criteria + anisotropy/uniformity metrics
 *
 * Honest limitation (from the tool's TECHNICAL_DOC): the 3DFSC here is a
 * distribution-based estimate, not a true two-half-map directional FSC.
 * All labels in the UI carry that caveat.
 *
 * Pure functions — server-side engine use (no fs; the engine does IO).
 */

import { fibonacciSphere } from "@/lib/symmetry";

/* ------------------------------------------------------------------ */
/* Types (trimmed from the original types.ts to server needs)          */
/* ------------------------------------------------------------------ */

export interface RebParticle {
  /** line index in the source STAR (row identity for output) */
  index: number;
  rot: number;
  tilt: number;
  /** criterion value (already oriented: higher = remove first) */
  score: number;
  vx: number;
  vy: number;
  vz: number;
  binIndex: number;
  included: boolean;
}

export interface RebBin {
  index: number;
  cx: number;
  cy: number;
  cz: number;
  countBefore: number;
  countAfter: number;
  threshold: number;
  removed: number;
  resolutionBefore: number;
  resolutionAfter: number;
}

export type ExclusionCriterion = "random" | "loglik" | "maxprob" | "ncc";

export interface RebalanceParams {
  numBins: number;
  percentile: number;
  exclusionCriterion: ExclusionCriterion;
  mode: "standard" | "resolution";
  resolutionWeight: number;
  seed: number;
}

export interface RebalanceStats {
  totalBefore: number;
  totalAfter: number;
  removed: number;
  removedPercent: number;
  binsTrimmed: number;
  effectiveBins: number;
  anisotropyBefore: number;
  anisotropyAfter: number;
  meanResolutionBefore: number;
  meanResolutionAfter: number;
  medianResolutionBefore: number;
  medianResolutionAfter: number;
  resolutionCVBefore: number;
  resolutionCVAfter: number;
  countUniformityBefore: number;
  countUniformityAfter: number;
}

export interface RebalanceReport {
  params: RebalanceParams;
  bins: RebBin[];
  stats: RebalanceStats;
  criterion: string;
  /** particle indices that were kept (for STAR row filtering) */
  keptIndices: number[];
}

/* ------------------------------------------------------------------ */
/* Geometry helpers (ported)                                           */
/* ------------------------------------------------------------------ */

function directionOf(rotDeg: number, tiltDeg: number): [number, number, number] {
  const rot = (rotDeg * Math.PI) / 180;
  const tilt = (tiltDeg * Math.PI) / 180;
  return [Math.sin(tilt) * Math.cos(rot), Math.sin(tilt) * Math.sin(rot), Math.cos(tilt)];
}

function dot3(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/* ------------------------------------------------------------------ */
/* Seeded RNG (mulberry32) for reproducible "random" exclusion         */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Statistics helpers (ported)                                         */
/* ------------------------------------------------------------------ */

function percentile(sortedAsc: number[], pct: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (pct / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return percentile(s, 50);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], mu?: number): number {
  if (values.length === 0) return 0;
  const m = mu ?? mean(values);
  const v = values.reduce((a, b) => a + (b - m) * (b - m), 0) / values.length;
  return Math.sqrt(v);
}

/** Anisotropy = max_res / min_res. 1.0 = isotropic. (ported) */
export function computeAnisotropy(resolutions: number[]): number {
  const vals = resolutions.filter((r) => r > 0);
  if (vals.length === 0) return 1;
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  return mn > 0 ? mx / mn : 1;
}

/** Count uniformity: 1 - CV. 1 = uniform. (ported) */
export function computeUniformity(counts: number[]): number {
  if (counts.length === 0) return 1;
  const m = counts.reduce((a, b) => a + b, 0) / counts.length;
  if (m === 0) return 1;
  const v = counts.reduce((a, b) => a + (b - m) * (b - m), 0) / counts.length;
  const cv = Math.sqrt(v) / m;
  return Math.max(0, 1 - cv);
}

/* ------------------------------------------------------------------ */
/* 3DFSC resolution model (ported from fsc.ts)                         */
/* ------------------------------------------------------------------ */

const RES_FLOOR = 2.5; // best achievable resolution (Å)
const RES_CEILING = 25; // worst resolution at near-zero sampling (Å)
const RES_TAU = 250; // particle count at half-saturation

/** Estimate directional resolution from a particle count (saturating model). */
export function resolutionFromCount(count: number): number {
  const c = Math.max(0, count);
  return RES_FLOOR + (RES_CEILING - RES_FLOOR) / (1 + c / RES_TAU);
}

/* ------------------------------------------------------------------ */
/* Main rebalance routine (ported; STAR row filtering left to caller)  */
/* ------------------------------------------------------------------ */

export function runRebalanceCore(particlesIn: RebParticle[], params: RebalanceParams): RebalanceReport {
  const particles: RebParticle[] = particlesIn.map((p) => ({ ...p, included: true }));
  const rng = mulberry32(params.seed);

  // 1. Build bins via Fibonacci sampling.
  const centers = fibonacciSphere(params.numBins);
  const bins: RebBin[] = centers.map((c, i) => ({
    index: i,
    cx: c[0],
    cy: c[1],
    cz: c[2],
    countBefore: 0,
    countAfter: 0,
    threshold: 0,
    removed: 0,
    resolutionBefore: 0,
    resolutionAfter: 0,
  }));

  // 2. Assign particles to bins (nearest center by dot product).
  for (const p of particles) {
    let bestDot = -Infinity;
    let bestBin = 0;
    for (let i = 0; i < centers.length; i++) {
      const d = dot3([p.vx, p.vy, p.vz], centers[i]);
      if (d > bestDot) {
        bestDot = d;
        bestBin = i;
      }
    }
    p.binIndex = bestBin;
  }

  // 3. Count before + per-bin 3DFSC estimate (count → Å).
  for (const p of particles) bins[p.binIndex].countBefore++;
  for (const b of bins) b.resolutionBefore = resolutionFromCount(b.countBefore);

  // 4. Base threshold = K-th percentile of non-empty bin counts.
  const nonEmptyCounts = bins
    .filter((b) => b.countBefore > 0)
    .map((b) => b.countBefore)
    .sort((a, b) => a - b);
  const baseThreshold = nonEmptyCounts.length
    ? Math.max(1, Math.floor(percentile(nonEmptyCounts, params.percentile)))
    : 0;

  // 5. Per-bin threshold:
  //    standard: threshold_i = base
  //    resolution: threshold_i = base × (res_i / medianRes)^α — bins BETTER
  //    than the median lose more, flattening the resolution field.
  const medianRes = median(bins.filter((b) => b.resolutionBefore > 0).map((b) => b.resolutionBefore));
  const alpha = params.mode === "resolution" ? params.resolutionWeight : 0;

  for (const b of bins) {
    let t = baseThreshold;
    if (params.mode === "resolution" && b.resolutionBefore > 0 && medianRes > 0) {
      const ratio = b.resolutionBefore / medianRes;
      t = baseThreshold * Math.pow(ratio, alpha);
    }
    t = Math.max(0, Math.min(b.countBefore, Math.round(t)));
    b.threshold = t;
  }

  // 6. Remove particles from over-populated bins by the criterion
  //    (REB particles carry a pre-oriented score: HIGHER = removed first;
  //    'random' uses the seeded RNG for reproducibility).
  const byBin: number[][] = Array.from({ length: bins.length }, () => []);
  particles.forEach((p, i) => byBin[p.binIndex].push(i));

  for (let bi = 0; bi < bins.length; bi++) {
    const b = bins[bi];
    const idxs = byBin[bi];
    if (b.countBefore <= b.threshold) {
      b.removed = 0;
      b.countAfter = b.countBefore;
      continue;
    }
    const removeCount = b.countBefore - b.threshold;
    const scored = idxs.map((i) => ({
      i,
      s: params.exclusionCriterion === "random" ? rng() : particles[i].score,
    }));
    scored.sort((a, b) => b.s - a.s);
    for (let k = 0; k < removeCount; k++) {
      particles[scored[k].i].included = false;
    }
    b.removed = removeCount;
    b.countAfter = b.threshold;
  }

  // 7. Re-estimate per-bin resolution AFTER rebalancing (invert the
  //    saturating model to an effective count, then scale by the kept ratio).
  for (const b of bins) {
    const before = b.resolutionBefore;
    let effBefore: number;
    if (before <= RES_FLOOR) {
      effBefore = b.countBefore;
    } else {
      effBefore = RES_TAU * ((RES_CEILING - RES_FLOOR) / (before - RES_FLOOR) - 1);
      if (!Number.isFinite(effBefore) || effBefore < 0) effBefore = b.countBefore;
    }
    const ratio = b.countBefore > 0 ? b.countAfter / b.countBefore : 1;
    const effAfter = effBefore * ratio;
    const est = RES_FLOOR + (RES_CEILING - RES_FLOOR) / (1 + effAfter / RES_TAU);
    b.resolutionAfter = Math.max(RES_FLOOR, Math.min(RES_CEILING * 1.2, est));
  }

  // 8. Stats.
  const totalBefore = particles.length;
  const totalAfter = particles.filter((p) => p.included).length;
  const removed = totalBefore - totalAfter;
  const binsTrimmed = bins.filter((b) => b.removed > 0).length;
  const effectiveBins = bins.filter((b) => b.countBefore > 0).length;

  const resBeforeAll = bins.filter((b) => b.resolutionBefore > 0).map((b) => b.resolutionBefore);
  const resAfterAll = bins.filter((b) => b.resolutionAfter > 0 && b.countAfter > 0).map((b) => b.resolutionAfter);
  const countsBefore = bins.filter((b) => b.countBefore > 0).map((b) => b.countBefore);
  const countsAfter = bins.filter((b) => b.countAfter > 0).map((b) => b.countAfter);

  const meanResBefore = mean(resBeforeAll);
  const meanResAfter = mean(resAfterAll);

  const stats: RebalanceStats = {
    totalBefore,
    totalAfter,
    removed,
    removedPercent: totalBefore ? (removed / totalBefore) * 100 : 0,
    binsTrimmed,
    effectiveBins,
    anisotropyBefore: computeAnisotropy(resBeforeAll),
    anisotropyAfter: computeAnisotropy(resAfterAll),
    meanResolutionBefore: meanResBefore,
    meanResolutionAfter: meanResAfter,
    medianResolutionBefore: median(resBeforeAll),
    medianResolutionAfter: median(resAfterAll),
    resolutionCVBefore: meanResBefore ? stdDev(resBeforeAll, meanResBefore) / meanResBefore : 0,
    resolutionCVAfter: meanResAfter ? stdDev(resAfterAll, meanResAfter) / meanResAfter : 0,
    countUniformityBefore: computeUniformity(countsBefore),
    countUniformityAfter: computeUniformity(countsAfter),
  };

  return {
    params,
    bins,
    stats,
    criterion: params.exclusionCriterion,
    keptIndices: particles.filter((p) => p.included).map((p) => p.index),
  };
}

/* ------------------------------------------------------------------ */
/* Orientation-distribution summary (shared by angdist plots)          */
/* ------------------------------------------------------------------ */

export interface OrientationSummary {
  total: number;
  /** fib-sphere bin centers + counts */
  bins: Array<{ x: number; y: number; z: number; count: number }>;
  /** marginal histogram of rot φ (numRotBins bins over 0–360°) */
  rotHist: number[];
  /** marginal histogram of tilt θ (numTiltBins bins over 0–180°) */
  tiltHist: number[];
  maxBin: number;
  anisotropy: number;
}

/** Bin (rot, tilt) lists into a fib-sphere + marginal summary. */
export function summarizeOrientation(
  angles: Array<{ rot: number; tilt: number }>,
  numBins = 610,
  numRotBins = 48,
  numTiltBins = 36
): OrientationSummary {
  const centers = fibonacciSphere(numBins);
  const bins = centers.map((c) => ({ x: c[0], y: c[1], z: c[2], count: 0 }));
  const rotHist = new Array<number>(numRotBins).fill(0);
  const tiltHist = new Array<number>(numTiltBins).fill(0);
  let total = 0;
  for (const { rot, tilt } of angles) {
    const v = directionOf(rot, tilt);
    let bestDot = -Infinity;
    let bestBin = 0;
    for (let i = 0; i < centers.length; i++) {
      const d = dot3(v, centers[i]);
      if (d > bestDot) {
        bestDot = d;
        bestBin = i;
      }
    }
    bins[bestBin].count++;
    const ri = Math.min(numRotBins - 1, Math.floor((((rot % 360) + 360) % 360) / (360 / numRotBins)));
    const ti = Math.min(numTiltBins - 1, Math.floor(Math.max(0, Math.min(180, tilt)) / (180 / numTiltBins)));
    rotHist[ri]++;
    tiltHist[ti]++;
    total++;
  }
  const counts = bins.map((b) => b.count);
  const res = bins.map((b) => (b.count > 0 ? resolutionFromCount(b.count) : 0));
  return {
    total,
    bins,
    rotHist,
    tiltHist,
    maxBin: counts.reduce((m, c) => Math.max(m, c), 0),
    anisotropy: computeAnisotropy(res),
  };
}

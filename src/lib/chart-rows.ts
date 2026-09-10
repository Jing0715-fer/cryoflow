/**
 * Single source of truth for the six results charts' DATA: response types,
 * render derivations, CSV row builders and renderability gates.
 *
 * WHY THIS EXISTS (Task 110): before this module every chart owned a private
 * getRows closure (and private type copies), so the command palette could not
 * export a chart's data without opening the inspector and re-deriving the
 * rows a second time — two implementations of the same derivation WILL drift.
 * Now the derivation lives here once: the chart's render memo delegates to
 * these functions, its export buttons consume the same row builders, and the
 * palette's Export group fetches the same endpoint through the same builder —
 * the palette CSV is BYTE-IDENTICAL to the chart's own CSV by construction.
 *
 * Gates: a builder returns [] exactly when its chart would render null. The
 * contract "the CSV holds what the curve draws" therefore holds everywhere —
 * a chart that isn't on screen has no rows to export, and the palette turns
 * an empty result into an honest toast instead of a zero-row file.
 */

import type { CsvRow } from "@/lib/chart-export";

/* ---------------- FSC curve ---------------- */

export interface FscShell {
  freq: number;
  res: number;
  fsc: number;
  correctedFsc?: number;
  phaseRandomizedFsc?: number;
  /** raw masked-maps FSC before the phase-rand correction (postprocess only) */
  maskedFsc?: number;
}

export interface FscResponse {
  source: "postprocess" | "model" | null;
  sourceFile: string | null;
  shells: FscShell[];
  resolutionAt143: number | null;
  resolutionAt05: number | null;
  /** RELION's own estimate (_rlnFinalResolution / _rlnCurrentResolution) */
  reportedResolution: number | null;
  reportedLabel: string | null;
}

/** Shells the FSC chart actually draws — clip 999-sentinel / non-finite
 *  rows, keep resolution ascending (low-res large Å first, high-res right);
 *  jobs whose FSC column is all zeros (e.g. VDAM initialmodel) drop out. */
export function fscShells(data: FscResponse | null | undefined): FscShell[] {
  return (data?.shells ?? [])
    .filter((s) => Number.isFinite(s.fsc) && Number.isFinite(s.res) && s.res < 900 && s.res > 0)
    .sort((a, b) => a.res - b.res);
}

/** The chart renders null below these floors (needs a real curve, not noise). */
export function fscRenderable(shells: FscShell[]): boolean {
  return shells.length >= 4 && shells.filter((s) => s.fsc > 0.05).length >= 4;
}

export function fscRows(data: FscResponse | null | undefined): CsvRow[] {
  const shells = fscShells(data);
  if (!fscRenderable(shells)) return [];
  return shells.map((s) => ({
    "resolution (A)": Number(s.res.toFixed(4)),
    "spatial frequency (1/A)": Number(s.freq.toFixed(6)),
    fsc: Number(s.fsc.toFixed(4)),
    ...(Number.isFinite(s.correctedFsc)
      ? { "fsc corrected": Number(s.correctedFsc!.toFixed(4)) }
      : {}),
    ...(Number.isFinite(s.phaseRandomizedFsc)
      ? { "fsc phase-randomized": Number(s.phaseRandomizedFsc!.toFixed(4)) }
      : {}),
    ...(Number.isFinite(s.maskedFsc)
      ? { "fsc masked (raw)": Number(s.maskedFsc!.toFixed(4)) }
      : {}),
  }));
}

/* ---------------- Guinier plot ---------------- */

export interface GuinierPoint {
  x: number;
  lnAmp: number | null;
  lnAmpSharpened: number | null;
}

export interface GuinierResponse {
  jobId: string;
  sourceFile: string | null;
  points: GuinierPoint[];
  bfactor: number | null;
}

/** Points the Guinier chart plots — non-finite amplitudes become null, then
 *  any point without a usable ln(amplitude) is dropped entirely. */
export function guinierPoints(data: GuinierResponse | null | undefined): GuinierPoint[] {
  return (data?.points ?? [])
    .map((p) => ({
      ...p,
      lnAmp: p.lnAmp != null && Number.isFinite(p.lnAmp) ? p.lnAmp : null,
      lnAmpSharpened:
        p.lnAmpSharpened != null && Number.isFinite(p.lnAmpSharpened)
          ? p.lnAmpSharpened
          : null,
    }))
    .filter((p) => Number.isFinite(p.x) && p.x > 0 && p.lnAmp != null);
}

export function guinierRenderable(points: GuinierPoint[]): boolean {
  return points.length >= 4; // silent until postprocess runs
}

export function guinierRows(data: GuinierResponse | null | undefined): CsvRow[] {
  const points = guinierPoints(data);
  if (!guinierRenderable(points)) return [];
  return points.map((p) => ({
    "1/s": p.x,
    "ln(amplitude)": p.lnAmp,
    "ln(amplitude) sharpened": p.lnAmpSharpened,
  }));
}

/* ---------------- Resolution evolution ---------------- */

export interface ResolutionPoint {
  iteration: number;
  resolution: number;
}

export interface ResolutionResponse {
  points: ResolutionPoint[];
  current: number | null;
  best: number | null;
}

export function resolutionRenderable(points: ResolutionPoint[]): boolean {
  return points.length >= 1;
}

export function resolutionRows(data: ResolutionResponse | null | undefined): CsvRow[] {
  const points = data?.points ?? [];
  if (!resolutionRenderable(points)) return [];
  return points.map((p) => ({
    iteration: p.iteration,
    "resolution (A)": p.resolution,
  }));
}

/* ---------------- CTF fit quality ---------------- */

export interface CtfMicrograph {
  name: string;
  relPath: string;
  defocusU: number;
  defocusV: number;
  astigmatism: number;
  defocusAngle: number;
  fom: number;
  maxResolution: number;
}

export interface CtfSummary {
  count: number;
  meanDefocus: number;
  minDefocus: number;
  maxDefocus: number;
  maxAstigmatism: number;
  meanFom: number;
  worstResolution: number;
}

export interface CtfResponse {
  micrographs: CtfMicrograph[];
  summary: CtfSummary | null;
}

export function ctfRenderable(micrographCount: number): boolean {
  return micrographCount > 0;
}

export function ctfRows(data: CtfResponse | null | undefined): CsvRow[] {
  const micrographs = data?.micrographs ?? [];
  if (!ctfRenderable(micrographs.length)) return [];
  return micrographs.map((m) => ({
    micrograph: m.name,
    "defocus U (um)": m.defocusU,
    "defocus V (um)": m.defocusV,
    "astigmatism (um)": m.astigmatism,
    "defocus angle (deg)": m.defocusAngle,
    fom: m.fom,
    "max resolution (A)": m.maxResolution,
  }));
}

/* ---------------- Topaz training ---------------- */

export interface TopazEpochDTO {
  it: number;
  trainLoss: number | null;
  testLoss: number | null;
  precision: number | null;
  recall: number | null;
  testPrecision: number | null;
  testRecall: number | null;
}

export interface TopazTrainingResponse {
  epochs: TopazEpochDTO[];
  source: string | null;
}

/** The per-epoch series the chart draws — one row per epoch with every
 *  metric the API carried (nulls included; the plot gaps them). */
export function topazSeries(data: TopazTrainingResponse | null | undefined): TopazEpochDTO[] {
  return (data?.epochs ?? []).map((e) => ({
    it: e.it,
    trainLoss: e.trainLoss,
    testLoss: e.testLoss,
    precision: e.precision,
    recall: e.recall,
    testPrecision: e.testPrecision,
    testRecall: e.testRecall,
  }));
}

export function topazRenderable(series: TopazEpochDTO[]): boolean {
  return series.length >= 2; // a single epoch is not a curve
}

export function topazRows(data: TopazTrainingResponse | null | undefined): CsvRow[] {
  const series = topazSeries(data);
  if (!topazRenderable(series)) return [];
  return series.map((r) => ({
    epoch: r.it,
    "train loss": r.trainLoss,
    "test loss": r.testLoss,
    precision: r.precision,
    recall: r.recall,
    "test precision": r.testPrecision,
    "test recall": r.testRecall,
  }));
}

/* ---------------- Orientation distribution ---------------- */

export interface AngDistResponse {
  iteration: number | null;
  total: number;
  rotBins: number;
  tiltBins: number;
  cells: number[];
  max: number;
  occupied: number;
  anisotropy: number;
  symmetry: string | null;
  starFile: string | null;
}

export function angDistRenderable(data: AngDistResponse | null | undefined): boolean {
  return !!data && data.total > 0 && data.cells.length > 0;
}

/** One row per polar cell — rot bin × tilt bin × particle count, the exact
 *  grid the heatmap paints. */
export function angDistRows(data: AngDistResponse | null | undefined): CsvRow[] {
  if (!angDistRenderable(data)) return [];
  const { cells, rotBins, tiltBins } = data!;
  const out: Array<Record<string, number>> = [];
  for (let t = 0; t < tiltBins; t++) {
    for (let r = 0; r < rotBins; r++) {
      out.push({ "rot bin": r, "tilt bin": t, particles: cells[t * rotBins + r] ?? 0 });
    }
  }
  return out;
}

/* ---------------- palette registry ---------------- */

/**
 * The six charts as export targets for the command palette's Export group.
 * `label` MUST equal the chart's own ChartExportButtons name — the CSV
 * filename is fileSlug(label), so a mismatch here would silently produce a
 * second filename for the same chart (cross-surface contract, t110 asserts
 * the equality against every chart's `name="…"` prop).
 */
export interface ChartExportTarget {
  key: string;
  label: string;
  endpoint: (jobId: string) => string;
  rows: (data: unknown) => CsvRow[];
}

export const CHART_EXPORT_TARGETS: ChartExportTarget[] = [
  {
    key: "fsc",
    label: "FSC curve",
    endpoint: (id) => `/api/jobs/${id}/fsc`,
    rows: (d) => fscRows(d as FscResponse),
  },
  {
    key: "guinier",
    label: "Guinier plot",
    endpoint: (id) => `/api/jobs/${id}/guinier`,
    rows: (d) => guinierRows(d as GuinierResponse),
  },
  {
    key: "resolution",
    label: "Resolution evolution",
    endpoint: (id) => `/api/jobs/${id}/resolution`,
    rows: (d) => resolutionRows(d as ResolutionResponse),
  },
  {
    key: "ctf",
    label: "CTF fit quality",
    endpoint: (id) => `/api/jobs/${id}/ctf`,
    rows: (d) => ctfRows(d as CtfResponse),
  },
  {
    key: "topaz",
    label: "Topaz training",
    endpoint: (id) => `/api/jobs/${id}/topaz-training`,
    rows: (d) => topazRows(d as TopazTrainingResponse),
  },
  {
    key: "angdist",
    label: "Orientation distribution",
    endpoint: (id) => `/api/jobs/${id}/angdist`,
    rows: (d) => angDistRows(d as AngDistResponse),
  },
];

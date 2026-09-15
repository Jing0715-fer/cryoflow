/**
 * CryoFlow — the report families' shared home (t197).
 *
 * Two human-facing report builders lived inside their instrument panels:
 * buildSweepReport (t194, hpc-queue-sim) and buildProfileReport (t195,
 * molstar-embed). The session QC report is their SECOND consumer — and a
 * lib is the only home that keeps it honest on both fronts:
 *   • doctrine — knowledge with two consumers must live in ONE place
 *     (the mdCell promotion precedent: twins fork, imports don't);
 *   • bundle hygiene — importing either panel into the report page would
 *     drag Mol* / the whole HPC panel into a document dialog's chunk.
 * The math moves VERBATIM — this is a change of address, not a rewrite.
 *
 * buildSessionReport (t197) is the binding father: it composes the
 * families' outputs VERBATIM and never parses them (parse-of-parse is a
 * second derivation waiting to drift). It adds only the pipeline glance
 * and honest empty states. Like every builder in this family it carries
 * NO timestamp — the same session state always yields the same bytes;
 * the filename carries the export stamp.
 */

import { mdCell } from "@/lib/md";

/* ------------------------------------------------------------------ */
/* Sweep family — moved verbatim from hpc-queue-sim.tsx (t194).        */
/* ------------------------------------------------------------------ */

/** The brief a sweep row needs — every field comes from the profile. */
export interface SweepProfile {
  id: string; name: string; gpuModel: string;
  gpusPerNode: number; nodes: number; arrayConcurrency: number; gpuSpeedup: number;
}
export interface SweepRow {
  p: SweepProfile;
  r?: { makespanMin: number; gpuUtilization: number; avgWaitMin: number; totalGpuHours: number };
  err?: string;
}

export const fmtMin = (m: number): string => {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
  return m >= 10 ? `${Math.round(m)}m` : `${(Math.round(m * 10) / 10).toFixed(1)}m`;
};

/**
 * The sweep's exit into prose (t194): the Markdown HUMAN twin of the
 * machine CSV. Same father — the sweep rows — but a different grammar:
 * the CSV speaks raw minutes and snake_case for spreadsheets; the
 * report speaks verdict, table and failures for people. ONE builder
 * feeds clipboard + download + the data-md carrier, and it derives
 * from the rows, NEVER from the CSV string — parsing your own export
 * to write a summary is a second derivation waiting to drift.
 *
 * t197: the "Generated <stamp>" line is gone — the report is a function
 * of the race alone (the same rows always yield the same bytes; the
 * filename carries the stamp, the doctrine t195 declared for profiles).
 */
export const buildSweepReport = (rows: SweepRow[], bestId: string | null): string => {
  const ok = rows.filter((r) => r.r);
  const failed = rows.filter((r) => !r.r);
  const best = ok.find((r) => r.p.id === bestId) ?? null;
  const worst = ok.reduce<SweepRow | null>(
    (w, r) => (!w || r.r!.makespanMin > w.r!.makespanMin ? r : w),
    null,
  );
  const lines: string[] = [];
  lines.push("# HPC sweep — cluster profile comparison", "");
  // The verdict — one sentence a human can act on, margins included.
  if (best?.r && worst?.r && worst.r.makespanMin > best.r.makespanMin) {
    const margin = Math.max(0, Math.round((1 - best.r.makespanMin / worst.r.makespanMin) * 100));
    lines.push(
      `${ok.length} of ${rows.length} profiles simulated on the same workflow graph. ` +
      `**${best.p.name}** wins with a ${fmtMin(best.r.makespanMin)} makespan — ` +
      `${margin}% faster than the slowest contestant (${fmtMin(worst.r.makespanMin)}) — ` +
      `at a cost of ${(Math.round(best.r.totalGpuHours * 10) / 10).toFixed(1)} GPU-hours.`,
    );
  } else if (best?.r) {
    lines.push(
      `${ok.length} of ${rows.length} profiles simulated on the same workflow graph. ` +
      `**${best.p.name}** wins with a ${fmtMin(best.r.makespanMin)} makespan at a cost of ` +
      `${(Math.round(best.r.totalGpuHours * 10) / 10).toFixed(1)} GPU-hours.`,
    );
  } else {
    lines.push(`${rows.length} profiles entered the race; none finished — see the failures below.`);
  }
  lines.push("");
  // The race table — human units (1h 03m, %), winner's makespan bold.
  lines.push("| # | Profile | GPU | Shape | Speedup | Status | Makespan | Utilization | Avg wait | GPU-hours |");
  lines.push("|--:|---------|-----|-------|--------:|--------|---------:|------------:|---------:|----------:|");
  rows.forEach((row, i) => {
    lines.push(
      [
        String(i + 1),
        row.p.name,
        row.p.gpuModel,
        `${row.p.nodes}×${row.p.gpusPerNode}`,
        `×${row.p.gpuSpeedup}`,
        row.r ? "ok" : "error",
        row.r
          ? row.p.id === bestId
            ? `**${fmtMin(row.r.makespanMin)}**`
            : fmtMin(row.r.makespanMin)
          : "—",
        row.r ? `${Math.round(row.r.gpuUtilization * 100)}%` : "—",
        row.r ? fmtMin(row.r.avgWaitMin) : "—",
        row.r ? `${(Math.round(row.r.totalGpuHours * 10) / 10).toFixed(1)}` : "—",
      ]
        .map(mdCell)
        .map((c) => `| ${c} `)
        .join("") + "|",
    );
  });
  // Failed profiles stay visible — a report that drops a contestant lies.
  if (failed.length > 0) {
    lines.push("");
    lines.push("Failed profiles (kept visible, never silently dropped):", "");
    for (const f of failed) lines.push(`- ${f.p.name} — ${f.err ?? "unavailable"}`);
  }
  lines.push("");
  lines.push(
    "> GPU-hours ≈ cost proxy — the fastest cluster is not always the cheapest. " +
    "The machine twin of this report is the CSV export (raw minutes, snake_case).",
  );
  return lines.join("\n") + "\n";
};

export const sweepReportFilename = (): string =>
  `hpc-sweep-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;

/* ------------------------------------------------------------------ */
/* Profile family — moved verbatim from molstar-embed.tsx (t195/t196). */
/* ------------------------------------------------------------------ */

/** one adopted comparison terrain the report can speak about */
export interface ReportOverlay { name: string; bins: number[] }

/** Resample `bins` onto `n` evenly spaced FRACTION stations (0..1) with
 *  linear interpolation — comparison terrains align on the shared fraction
 *  scale, never on bin index (a 64³ main map and a 32³ half-map are two
 *  different rulers over the same depth; t193's doctrine in numbers). */
export const resampleByFraction = (bins: number[], n: number): number[] => {
  if (bins.length === 0) return [];
  if (bins.length === 1) return Array.from({ length: n }, () => bins[0]);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n - 1)) * (bins.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(bins.length - 1, lo + 1);
    out.push(bins[lo] + (bins[hi] - bins[lo]) * (t - lo));
  }
  return out;
};

/** Pearson correlation — the shape-agreement number r. Affine-invariant,
 *  so self-scaling each terrain (the visual's own contract) changes
 *  nothing: the shape is the signal, not absolute ρ. A flat line has no
 *  shape — NaN, and the verdict says so instead of inventing a number. */
export const pearson = (a: number[], b: number[]): number => {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return NaN;
  return cov / Math.sqrt(va * vb);
};

export const agreementVerdict = (r: number): string =>
  Number.isNaN(r) ? "flat — no shape to compare"
  : r >= 0.85 ? "agrees"
  : r >= 0.5 ? "partial"
  : "diverges";

export const pctAt = (bins: number[], i: number): string =>
  `${((i / Math.max(1, bins.length - 1)) * 100).toFixed(1)}%`;

/** Every PAIR of comparison terrains, correlated on the shared fraction
 *  scale with both resampled to the FINER of the two grids (the finer
 *  ruler preserves more shape; t195's fraction doctrine, pairwise).
 *  half1 vs half2 is THE cryo-EM QC pair: two independent reconstructions
 *  built from disjoint halves of the data — where they agree the density
 *  is real, which is exactly the question FSC asks. Overlay-vs-main says
 *  "does this map follow the reconstruction"; pairwise says "do the
 *  halves corroborate each other". */
export const pairwiseAgreement = (overlays: ReportOverlay[]): { a: string; b: string; r: number }[] => {
  const out: { a: string; b: string; r: number }[] = [];
  for (let i = 0; i < overlays.length; i++) {
    for (let j = i + 1; j < overlays.length; j++) {
      const n = Math.max(overlays[i].bins.length, overlays[j].bins.length);
      out.push({
        a: overlays[i].name,
        b: overlays[j].name,
        r: pearson(resampleByFraction(overlays[i].bins, n), resampleByFraction(overlays[j].bins, n)),
      });
    }
  }
  return out;
};

/* ---- Local agreement (t198): the divergence earns an ADDRESS. ---- */

/** The four nominal quarter bands of the shared 0–100% fraction scale.
 *  Equal-COUNT cuts of the shared grid, so the labels are the bands'
 *  nominal fraction ranges (off by at most one plane when the count
 *  does not divide by four). */
export const QUARTER_LABELS = ["Q1 (0–25%)", "Q2 (25–50%)", "Q3 (50–75%)", "Q4 (75–100%)"];

export interface LocalBand { label: string; r: number }

/** LOCAL shape agreement: the shared fraction axis cut into four
 *  equal-count bands, each correlated independently. A global r can
 *  hide a localized betrayal — a map can agree over most of the depth
 *  and part ways in a single band (a mask edge, a noise shelf). The
 *  weakest band is the ADDRESS of the disagreement: t193's doctrine
 *  ("where the lines part ways lives the noise") now comes with a
 *  street number. Both sides are resampled to the finer grid — the
 *  same ruler pairwiseAgreement drinks from — and every band is judged
 *  on its OWN variance, so a band with no shape says NaN ("—") instead
 *  of inventing a correlation. ONE father: the report table and the
 *  wall's weakest-quarter chips both drink from this cup. */
export const localAgreement = (mainBins: number[], overlayBins: number[]): LocalBand[] => {
  const n = Math.max(mainBins.length, overlayBins.length);
  if (n < 4) return []; // four bands need at least four planes to exist
  const a = resampleByFraction(mainBins, n);
  const b = resampleByFraction(overlayBins, n);
  const out: LocalBand[] = [];
  for (let k = 0; k < 4; k++) {
    // equal-count cuts [floor(k*n/4), floor((k+1)*n/4)) — disjoint,
    // exhaustive, no shared boundary plane between neighbours
    const lo = Math.floor((k * n) / 4);
    const hi = Math.floor(((k + 1) * n) / 4);
    out.push({ label: QUARTER_LABELS[k], r: pearson(a.slice(lo, hi), b.slice(lo, hi)) });
  }
  return out;
};

/** The weakest band by r — the address to inspect. NaN bands (flat, or
 *  too short to have shape) are not ranked; when every band is flat
 *  there IS no weakest and the caller says so instead of inventing
 *  one (the flat-map doctrine, local). */
export const weakestBand = (bands: LocalBand[]): LocalBand | null => {
  let w: LocalBand | null = null;
  for (const b of bands) {
    if (!Number.isFinite(b.r)) continue;
    if (!w || b.r < w.r) w = b;
  }
  return w;
};

/* ---- The r profile (t200): the agreement earns a CONTOUR. ---- */

export interface RProfile { window: number; rs: number[] }

/** CONTINUOUS local shape agreement: a sliding window (n/8 planes,
 *  clamped to 4..16) walked across the shared fraction scale over
 *  STATIONS evenly spaced by window CENTRE, correlated independently
 *  at every stop. The quarter bands (localAgreement) give a betrayal
 *  its BAND; the r profile gives it a CONTOUR — the sparkline on the
 *  wall is this array drawn left to right, stations at k/(STEPS-1).
 *  NaN stations (a flat window has no shape) are honest holes, never
 *  zeros. ONE father: the wall's sparkline drinks from this cup — the
 *  REPORT keeps the quarter table, because the contour is a visual
 *  instrument and visual instruments don't enter reports (the t193
 *  CSV-export doctrine's report chapter: overlay terrains are on the
 *  wall, the numbers stay in the tables). */
export const RPROFILE_STEPS = 24;

export const rProfile = (mainBins: number[], overlayBins: number[]): RProfile => {
  const n = Math.max(mainBins.length, overlayBins.length);
  if (n < 4) return { window: 0, rs: [] };
  const a = resampleByFraction(mainBins, n);
  const b = resampleByFraction(overlayBins, n);
  const w = Math.min(16, Math.max(4, Math.round(n / 8)));
  const rs: number[] = [];
  for (let k = 0; k < RPROFILE_STEPS; k++) {
    const centre = Math.round((k / (RPROFILE_STEPS - 1)) * (n - 1));
    const lo = Math.max(0, Math.min(n - w, centre - Math.floor(w / 2)));
    rs.push(pearson(a.slice(lo, lo + w), b.slice(lo, lo + w)));
  }
  return { window: w, rs };
};

/**
 * ONE builder for the map's QC summary (t195): clipboard, download and
 * the data-md carrier all drink from this single cup, and it derives
 * from the profile ROWS exactly like buildProfileCsv does — it NEVER
 * parses the CSV (parse-of-parse is a second derivation waiting to
 * drift, t194's doctrine). The report is a function of the LANDSCAPE
 * and the ADOPTED COMPARISON TERRAINS — never the playhead — so
 * scrubbing never retires it, and the same landscape always yields the
 * same bytes (no timestamps inside; the filename carries the stamp).
 */
export const buildProfileReport = (opts: {
  mapName: string;
  jobId: string;
  axis: string;
  bins: number[];
  overlays: ReportOverlay[];
  pendingOverlays: number;
}): string => {
  const { mapName, jobId, axis, bins, overlays, pendingOverlays } = opts;
  const n = bins.length;
  let peak = 0, trough = 0;
  for (let i = 1; i < n; i++) {
    if (bins[i] > bins[peak]) peak = i;
    if (bins[i] < bins[trough]) trough = i;
  }
  const max = bins[peak], min = bins[trough];
  const span = max - min;
  const lines: string[] = [];
  lines.push(`## Map QC summary — ${mdCell(mapName)}`);
  lines.push("");
  lines.push(`Job \`${mdCell(jobId)}\` · mean-density landscape along **${axis.toUpperCase()}** (${n} bins).`);
  lines.push("");
  lines.push(`- **Peak** mean ρ at plane ${peak} (**${pctAt(bins, peak)}** of depth) — where the specimen's mass concentrates on this axis`);
  lines.push(`- **Trough** at plane ${trough} (${pctAt(bins, trough)})`);
  lines.push(`- **Span** across planes: ${span.toFixed(4)} (max ${max.toFixed(4)}, min ${min.toFixed(4)})`);
  lines.push("");
  lines.push(`### Comparison maps (${overlays.length})`);
  lines.push("");
  if (overlays.length > 0) {
    lines.push("| Map | Bins | Peak at | Agreement r | Verdict |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const o of overlays) {
      const r = pearson(resampleByFraction(o.bins, n), bins);
      const pk = o.bins.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
      lines.push(
        `| ${mdCell(o.name)} | ${o.bins.length} | ${pctAt(o.bins, pk)} | ${Number.isNaN(r) ? "—" : r.toFixed(2)} | ${agreementVerdict(r)} |`
      );
    }
    lines.push("");
    lines.push("Where a comparison line follows the main landscape, the density is consistent between maps; where it parts ways lives noise or masking. Agreement r is the Pearson correlation on the shared 0–100% fraction scale — each terrain self-scaled to its own map's stats (the shape is the signal, not absolute ρ).");
    // t198: the LOCAL agreement table — a global r can hide a band-local
    // betrayal, so each quarter of the fraction scale is correlated
    // independently and the weakest quarter names the ADDRESS to inspect.
    if (overlays.length > 0) {
      lines.push("");
      lines.push("### Local agreement");
      lines.push("");
      lines.push(`| Map | ${QUARTER_LABELS.join(" | ")} | Weakest |`);
      lines.push("| --- | --- | --- | --- | --- | --- |");
      for (const o of overlays) {
        const bands = localAgreement(bins, o.bins);
        const w = weakestBand(bands);
        const cell = (b: LocalBand | undefined) => (b && Number.isFinite(b.r) ? b.r.toFixed(2) : "—");
        lines.push(
          `| ${mdCell(o.name)} | ${cell(bands[0])} | ${cell(bands[1])} | ${cell(bands[2])} | ${cell(bands[3])} | ${w ? `${w.label} (${w.r.toFixed(2)})` : "flat — no local shape"} |`
        );
      }
      lines.push("");
      lines.push("A global r can hide a localized betrayal — a map can agree over most of the depth and part ways in a single band (a mask edge, a noise shelf). Each quarter of the shared fraction scale is correlated independently, and the weakest quarter is the address to inspect; where the half-maps disagree with each other in one band only, suspect that band, not the reconstruction.");
    }
    if (overlays.length > 1) {
      lines.push("");
      lines.push("### Pairwise agreement");
      lines.push("");
      lines.push("| Map A | Map B | Agreement r | Verdict |");
      lines.push("| --- | --- | --- | --- |");
      for (const p of pairwiseAgreement(overlays)) {
        lines.push(`| ${mdCell(p.a)} | ${mdCell(p.b)} | ${Number.isNaN(p.r) ? "—" : p.r.toFixed(2)} | ${agreementVerdict(p.r)} |`);
      }
      lines.push("");
      lines.push("Two half-maps come from disjoint halves of the data — where they agree with EACH OTHER, the density is real (this is the question FSC asks). Maps that follow the main landscape but not each other deserve a second look.");
    }
  } else {
    lines.push("None adopted yet — adopt half-maps or masked variants through Layers and they appear here. Where their lines follow the main landscape the density is real; where they part ways lives the noise.");
  }
  if (pendingOverlays > 0) {
    lines.push("");
    lines.push(`_${pendingOverlays} comparison map${pendingOverlays === 1 ? " is" : "s are"} still measuring — its landscape has not arrived, and this summary does not guess it._`);
  }
  lines.push("");
  lines.push("_Exported from CryoFlow's slice instrument — the mean-density landscape is contour-independent and describes the whole map, not the current isosurface._");
  return lines.join("\n");
};

export const profileReportFilename = (axis: string): string =>
  `map-qc-report-${axis}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;

/* ------------------------------------------------------------------ */
/* The session binding (t197) — the families meet in one document.     */
/* ------------------------------------------------------------------ */

/** The session's last HPC sweep — what the session report binds. One
 *  slot: a new race replaces the previous one wholesale. */
export interface SessionSweepState {
  rows: SweepRow[];
  bestId: string | null;
}

/** Job-status counts for the prologue's pipeline glance. */
export interface PipelineGlance {
  total: number;
  succeeded: number;
  running: number;
  failed: number;
  /** idle + submitted + anything the canvas can host — waiting for work */
  waiting: number;
}

/**
 * ONE father for the session QC report (t197): the document that binds
 * the report families under a single cover. It NEVER parses the family
 * outputs — the map section and the sweep annex are embedded VERBATIM
 * (the session report does not re-translate the families' translations;
 * it binds them), and the pipeline glance is derived from the counts the
 * caller measured, never from any other section's bytes. No timestamps:
 * the same session state yields the same bytes, the filename carries the
 * stamp. Every family that has nothing to say gets an honest empty
 * state that teaches where its numbers come from — a report that invents
 * a section's content lies just as much as one that drops it.
 */
export const buildSessionReport = (opts: {
  projectName: string | null;
  pipeline: PipelineGlance | null;
  mapQc: { jobId: string; report: string } | null;
  mapPending: boolean;
  mapError: boolean;
  sweep: string | null;
}): string => {
  const { projectName, pipeline, mapQc, mapPending, mapError, sweep } = opts;
  const lines: string[] = [];
  lines.push("# CryoFlow session QC report");
  lines.push("");
  if (pipeline && pipeline.total > 0) {
    lines.push(
      `Project **${mdCell(projectName ?? "untitled")}** · ${pipeline.total} job${pipeline.total === 1 ? "" : "s"} — ` +
      `${pipeline.succeeded} succeeded · ${pipeline.running} running · ${pipeline.failed} failed · ${pipeline.waiting} waiting.`
    );
  } else {
    lines.push(`Project **${mdCell(projectName ?? "untitled")}** · the canvas has no jobs yet.`);
  }
  lines.push("");
  lines.push("## Pipeline at a glance");
  lines.push("");
  if (pipeline && pipeline.total > 0) {
    lines.push(`- **${pipeline.succeeded}** succeeded job${pipeline.succeeded === 1 ? "" : "s"} feed this report's QC sections;`);
    lines.push(`- **${pipeline.running}** running · **${pipeline.failed}** failed — failures stay counted here, never dropped;`);
    lines.push(`- **${pipeline.waiting}** waiting (idle or submitted) — no verdict exists for work that has not run.`);
  } else {
    lines.push("No jobs on the canvas yet — add nodes, run them, and their verdicts will gather here.");
  }
  lines.push("");
  lines.push("## Map QC");
  lines.push("");
  if (mapQc) {
    lines.push(mapQc.report.trimEnd());
  } else if (mapPending) {
    lines.push("_Still measuring this session's maps — the landscape has not arrived, and this summary does not guess it._");
  } else if (mapError) {
    lines.push("_The map landscape could not be measured (the profile API refused, or the maps are gone) — this summary does not guess it._");
  } else {
    lines.push("None of this session's jobs has 3D maps yet — run a 3D reconstruction and its maps will be profiled here automatically (no viewer required).");
  }
  lines.push("");
  lines.push("## Scheduling sweep");
  lines.push("");
  if (sweep) {
    lines.push(sweep.trimEnd());
  } else {
    lines.push("No sweep raced this session — open the HPC queue panel and run *Compare profiles*; the winner's verdict will be bound here verbatim.");
  }
  lines.push("");
  lines.push("_Bound from this session's live state — the pipeline glance, the map landscape and the sweep verdict each keep their own provenance. The filename carries the export stamp._");
  return lines.join("\n");
};

export const sessionReportFilename = (): string =>
  `session-qc-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;

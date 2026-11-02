/**
 * Single source for the app's duration / clock / relative-time formatting.
 *
 * WHY THIS EXISTS (Task 123): the pipeline timeline prints the same
 * duration labels the inspector already prints, and a private copy inside
 * analytics would be the drift-by-twin this codebase keeps closing
 * (chart-rows.ts carries the identical argument for chart data). Lifted
 * verbatim from job-inspector.tsx — behavior unchanged by construction;
 * the inspector now imports from here.
 *
 * The t1153 census (the NEW map's second vein — which faces still
 * re-derive what this father knows): the DURATION word's second birth
 * (`fmtDur`, the QC report's local builder in results-view.tsx) died on
 * 2026-11-02 (t1153) — it had no day face, so a 3-day run printed
 * "72h 5m" in the report while the inspector said "3d 0h" for the same
 * run. What REMAINS outside is not drift but the word-class boundary —
 * each a DIFFERENT claim with its own doctrine comment, kept:
 *   - lib/elapsed.ts formatElapsed — the FACT face (seconds grain so the
 *     1s ticker visibly lives; padded "12m 05s" so it never jitters);
 *     formatEta (job-card.tsx) is its PREDICTION pair ("~", minute grain
 *     — seconds would be false precision). Task 141's doctrine.
 *   - formatLedgerMs (job-inspector.tsx) — the t269 LEDGER face (ms
 *     precision, tabular "2m05s", one language across the remote world).
 *   - fmtOffset / fmtOffsetPrecise (pipeline-analytics.tsx) — the AXIS
 *     face ("3m" ticks, no noise) and the zero face ("+0s reads as
 *     data") riding THIS father.
 *   - graveAge (storage-dialog.tsx) — the t478 GRAVE face (coarse
 *     glance; the exact timestamp lives in the title).
 *   - fmtMin (qc-report.ts) — the t194 SIM face (the sweep's native unit
 *     is minutes; "45.3m" is the data, seconds would be invented).
 *   - the freshness chip (cluster-usage-panel.tsx) — a different word
 *     class again: "how stale is MY last fetch" (seconds are the honest
 *     grain; this father's "just now" at <60s would lie about a 55s-old
 *     fetch).
 *   - slurmHms (lib/hpc/slurm.ts) — SLURM's own [[DD-]HH:]MM:SS grammar
 *     for the #SBATCH --time directive (the machine's dialect, not a
 *     display face; its private `hms` twin died same day).
 *   - the t123 e2e probe's fmtDur — an INSTRUMENT, not a face: the probe
 *     re-derives from the API to check the UI against the DATA (an
 *     oracle that imports the father cannot catch the father's bugs).
 *   - engine/remote-run/ai-tools second-count prose — the ENGINE's voice
 *     (same boundary the byte father drew: log prose keeps its own
 *     dialect).
 */

/** Human duration: "8s" · "2m 41s" · "3h 12m" · "5d 4h" (— for junk). */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Locale wall clock "14:32:05" — tooltips and run-window labels. */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Relative age: "just now" inside a minute, then "4m ago" etc.
 *  Accepts an ISO string or an epoch-ms number (t714: the user-param
 *  preset snapshots carry numeric createdAt; one dialect, both shapes). */
export function fmtAgo(iso: string | number): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  return `${fmtDuration(ms)} ago`;
}

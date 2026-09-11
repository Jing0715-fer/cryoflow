/**
 * Single source for the app's duration / clock / relative-time formatting.
 *
 * WHY THIS EXISTS (Task 123): the pipeline timeline prints the same
 * duration labels the inspector already prints, and a private copy inside
 * analytics would be the drift-by-twin this codebase keeps closing
 * (chart-rows.ts carries the identical argument for chart data). Lifted
 * verbatim from job-inspector.tsx — behavior unchanged by construction;
 * the inspector now imports from here.
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

/** Relative age: "just now" inside a minute, then "4m ago" etc. */
export function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  return `${fmtDuration(ms)} ago`;
}

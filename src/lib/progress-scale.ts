/**
 * CryoFlow — the progress scale's ONE home (t1154).
 *
 * THE WIRE CONTRACT (Task 181's scale law, now with ONE birthplace):
 * the DB jobs.progress column — and every API face that quotes it —
 * speaks the 0–100 scale. The engine writes `Math.round(frac * 100)`
 * clamped 1–99 while running and 100 at finalize (progress-parse.ts's
 * own pct()); job-restore clamps imports back into 0–100. This module
 * is the only place that divides the wire by 100 (progressToFraction)
 * and the only place that renders the column's percent WORD
 * (fmtProgressPct). One claim, one birthplace — a formatter the user
 * (or the model) reads is arithmetic, and two birthplaces of one
 * arithmetic contradict each other on the same screen.
 *
 * Task 181's 4200% bug was the missing boundary: the recent-activity
 * feed let the wire value flow through untouched and every ×100 label
 * multiplied a percent into a four-digit one. The feed's cure
 * normalized its internals to fractions at its fetch frame — and the
 * SAME bug shape survived in the agent lane, where three tool
 * summaries multiplied the raw wire by 100 again ("(progress 4200%)"
 * for a 42% run): the agent's own voice lied about the very column
 * the screen was speaking correctly. t1154 is that lane's cure.
 *
 * THE FACES (this module's own census):
 * - fmtProgressPct(wire) — the percent word every face speaks: the job
 *   card's chip, the inspector's header + progress row, the dashboard's
 *   row chip and feed rows, the canvas minimap's title, the pipeline
 *   KPI, the print ledger, and the agent tool summaries. Integer grain
 *   (Math.round) — the wire is already percent-grained, so the word
 *   adds no precision the column never had. Junk in, junk out, by
 *   contract: the column is DB-backed and finite; the faces never
 *   guarded and the father invents no guard.
 * - progressToFraction(wire) — the ONE /100: the recent-activity feed's
 *   frame (t181's toFractionFrame) normalizes at its fetch boundary;
 *   its internals stay fraction-native (sparkline thresholds 0.05 /
 *   0.005 are fraction claims), and its percent words ride
 *   fmtProgressPct through the frame's documented ×100
 *   back-translation at render.
 *
 * DOCUMENTED BOUNDARIES — different claims, not births (each drew its
 * own line at its own birth; not drift but the word-class boundary):
 * - the zoom word (canvas.tsx): viewport.zoom × 100 — the viewport
 *   scale, never the progress column.
 * - the axis/position words (map-ortho-panel's pct(), the oblique
 *   filmstrip's offsetPct, session-report's depth ticks): spatial
 *   fractions of a plane or a bar, each with its own grain.
 * - the class-share word (class-gallery's integer grain beside the
 *   agent tools' one-decimal toFixed(1) face): a class's share of
 *   particles — two grains drawn at their own births (screen
 *   compactness vs the model's precision), the same t506 lesson the
 *   timeline share well already spoke.
 * - the storage share words (storage-run-lens, storage-dialog): bytes
 *   of total, the lens family's own arithmetic.
 * - the ML metric faces (precision / recall / gpuUtilization × 100):
 *   0–1 metrics, not the progress column.
 * - timelineSharePct (t506's well in timeline-walk.ts): duration-share
 *   of a session span, round-half-up on the 1000th.
 * - the engine's voice (remote-run, engine.ts): RELION's own param
 *   scales (--helical_z_percentage / 100) — a log line is not a UI
 *   badge; the engine's conversions are its own dialect.
 */
export function progressToFraction(wire: number): number {
  return wire / 100;
}

export function fmtProgressPct(wire: number): string {
  return `${Math.round(wire)}%`;
}

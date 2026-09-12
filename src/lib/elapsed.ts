/**
 * Elapsed-time formatting for the running-job readout (Task 141).
 *
 * The dialect deliberately differs from formatEta() (job-card.tsx):
 * elapsed is a FACT — no "~", and it carries seconds so the 1s ticker
 * visibly advances (the readout must look alive, or the user cannot
 * tell a running job from a hung one at a glance). ETA is a PREDICTION —
 * "~" and minute-grain only (seconds would be false precision).
 *
 * Kept free of type annotations and imports on purpose: the e2e probe
 * lifts this exact source (strip the `export ` prefix, eval) as its
 * oracle — the product's formatter is the only formatter (Task 138
 * doctrine, function edition). A hand-copied oracle drifts; this one
 * cannot.
 */

/**
 * "42s" / "12m 05s" / "1h 04m" — fact grain: seconds under an hour,
 * minutes beyond it (nobody watches a 3-hour run tick by the second).
 * Negative / NaN input clamps to "0s" — a clock never reads backwards.
 */
export function formatElapsed(ms) {
  if (!Number.isFinite(ms)) return "0s";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  const ss = s % 60;
  if (m < 60) return m + "m " + String(ss).padStart(2, "0") + "s";
  const h = Math.floor(m / 60);
  return h + "h " + String(m % 60).padStart(2, "0") + "m";
}
